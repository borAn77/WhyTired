"""LLM providers: one function, `complete()`, that returns LLM text or the caller's template.

Rules (docs/PLAN.md "LLM layer interface", DECISIONS D9):
- The LLM never decides. Callers send findings already computed by the rule engine.
- Every call has a template fallback. The template is returned when the LLM is turned off,
  the API key is missing, or the call errors, times out, is refused, is cut off, or fails
  the caller's validation. The demo never breaks.
- Hard 10-second limit on the whole call, the retry included.
- Validated answers are cached in memory by a hash of the prompt, so repeating a request
  (e.g. switching screens in the demo) is instant and costs nothing.

Settings (environment variables, read on every call; keys are never hard-coded):
    LLM_PROVIDER       anthropic (default) | ollama | none | off
    ANTHROPIC_MODEL    default claude-haiku-4-5 (fast enough for the 10-second limit)
    ANTHROPIC_API_KEY  required for anthropic
    OLLAMA_MODEL       default gemma3:4b (local option; Render has no Ollama)
    OLLAMA_URL         default http://localhost:11434
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import urllib.error
import urllib.request
from collections import deque
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from functools import lru_cache

import anthropic

log = logging.getLogger("whytired.llm")

TIMEOUT_S = 10.0  # hard limit for the whole call, retry included
ATTEMPT_TIMEOUT_S = 8.0  # one HTTP attempt (docs/PLAN.md: about 8 s)
MAX_RETRIES = 1  # one quick retry for transient errors; TIMEOUT_S still wins
MAX_TOKENS = 1024  # upper bound only; answers are 2-4 sentences
CACHE_SIZE = 256

DEFAULT_PROVIDER = "anthropic"
OFF = {"none", "off"}
DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5"
DEFAULT_OLLAMA_MODEL = "gemma3:4b"
DEFAULT_OLLAMA_URL = "http://localhost:11434"
# These models reject the `effort` setting; every newer model gets effort "low" for speed.
NO_EFFORT_MODELS = ("claude-haiku", "claude-sonnet-4-5")

_cache: dict[str, str] = {}
_recent: deque[dict] = deque(maxlen=50)
# The HTTP call runs in a worker thread so the 10-second limit holds even when the SDK
# retries or a DNS lookup hangs (socket timeouts do not cover DNS).
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm")


class LLMUnavailable(Exception):
    """Any reason we could not get a usable answer from the LLM."""


def get_config() -> dict:
    """Provider and model from the environment, read at call time."""
    provider = os.getenv("LLM_PROVIDER", DEFAULT_PROVIDER).strip().lower() or DEFAULT_PROVIDER
    if provider in OFF:
        return {"provider": "none", "model": ""}
    if provider == "ollama":
        return {"provider": provider, "model": os.getenv("OLLAMA_MODEL") or DEFAULT_OLLAMA_MODEL}
    if provider == "anthropic":
        return {"provider": provider, "model": os.getenv("ANTHROPIC_MODEL") or DEFAULT_ANTHROPIC_MODEL}
    return {"provider": provider, "model": ""}


def active_provider() -> str:
    """Human-readable LLM setup for /api/health, e.g. "anthropic/claude-haiku-4-5"."""
    cfg = get_config()
    if cfg["provider"] == "none":
        return "none"
    if cfg["provider"] not in PROVIDERS:
        return f"{cfg['provider']} (unknown, templates only)"
    if cfg["provider"] == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
        return f"anthropic/{cfg['model']} (no API key, templates only)"
    return f"{cfg['provider']}/{cfg['model']}"


def complete(
    system: str,
    user: str,
    fallback: str,
    *,
    validate: Callable[[str], bool] | None = None,
    max_tokens: int = MAX_TOKENS,
) -> dict:
    """Ask the LLM, or return `fallback` if anything goes wrong.

    Args:
        system:   the rules (role, tone, what is forbidden).
        user:     the findings to explain, as aggregated JSON plus the task.
        fallback: the hand-written template text.
        validate: check on the LLM text (numbers, blocked terms...). False -> template.

    Returns {"text", "source": "llm" | "template", "provider", "model", "latency_ms", "reason"},
    where "reason" says why the template was used (None when the LLM text was used).
    """
    cfg = get_config()
    started = time.monotonic()
    key = _cache_key(cfg, system, user)
    try:
        text = _cache.get(key) or _ask_llm(cfg, system, user, max_tokens)
        if validate is not None and not validate(text):
            raise LLMUnavailable("answer failed validation")
        _remember(key, text)
        source, reason = "llm", None
    except Exception as exc:  # any problem at all -> template; never break the demo
        text, source, reason = fallback, "template", _describe(exc)

    result = {
        "text": text,
        "source": source,
        "provider": cfg["provider"],
        "model": cfg["model"],
        "latency_ms": round((time.monotonic() - started) * 1000),
        "reason": reason,
    }
    _recent.append({k: v for k, v in result.items() if k != "text"})
    if source == "llm":
        log.info("LLM text used: %s/%s in %d ms", cfg["provider"], cfg["model"], result["latency_ms"])
    else:
        log.warning("Template used: %s", reason)
    return result


def recent_calls() -> list[dict]:
    """Newest first: which path each recent call took (llm/template) and why."""
    return list(reversed(_recent))


def clear_cache() -> None:
    _cache.clear()


# ---------- internals ----------


def _ask_llm(cfg: dict, system: str, user: str, max_tokens: int) -> str:
    """Non-empty LLM text, or raise. Never waits longer than TIMEOUT_S."""
    if cfg["provider"] == "none":
        raise LLMUnavailable("LLM turned off (LLM_PROVIDER=none/off)")
    call = PROVIDERS.get(cfg["provider"])
    if call is None:
        raise LLMUnavailable(f"unknown LLM_PROVIDER '{cfg['provider']}'")

    future = _pool.submit(call, cfg["model"], system, user, max_tokens)
    try:
        text = future.result(timeout=TIMEOUT_S)
    except FutureTimeout:
        future.cancel()  # if it never started, do not run it later
        raise LLMUnavailable(f"no answer within {TIMEOUT_S:g} s") from None

    text = (text or "").strip()
    if not text:
        raise LLMUnavailable("empty answer")
    return text


@lru_cache(maxsize=2)
def _anthropic_client(api_key: str) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key, timeout=ATTEMPT_TIMEOUT_S, max_retries=MAX_RETRIES)


def _call_anthropic(model: str, system: str, user: str, max_tokens: int) -> str:
    """Claude through the official SDK. The key is read only from ANTHROPIC_API_KEY."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise LLMUnavailable("ANTHROPIC_API_KEY is not set")
    options = {} if model.startswith(NO_EFFORT_MODELS) else {"output_config": {"effort": "low"}}
    response = _anthropic_client(api_key).messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        **options,
    )
    if response.stop_reason == "refusal":
        raise LLMUnavailable("the model declined to answer (refusal)")
    if response.stop_reason == "max_tokens":
        raise LLMUnavailable("the answer was cut off (max_tokens)")
    return "".join(block.text for block in response.content if block.type == "text")


def _call_ollama(model: str, system: str, user: str, max_tokens: int) -> str:
    """Local model through Ollama's /api/chat (standard library only). Data stays on the laptop."""
    url = os.getenv("OLLAMA_URL", DEFAULT_OLLAMA_URL).rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "stream": False,
        "options": {"num_predict": max_tokens},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=ATTEMPT_TIMEOUT_S) as response:
            return json.loads(response.read().decode("utf-8"))["message"]["content"]
    except urllib.error.HTTPError as exc:  # e.g. 404 "model 'x' not found"
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        raise LLMUnavailable(f"Ollama HTTP {exc.code}: {detail}") from None


PROVIDERS: dict[str, Callable[[str, str, str, int], str]] = {
    "anthropic": _call_anthropic,
    "ollama": _call_ollama,
}


def _cache_key(cfg: dict, system: str, user: str) -> str:
    raw = json.dumps([cfg["provider"], cfg["model"], system, user], ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _remember(key: str, text: str) -> None:
    if key not in _cache and len(_cache) >= CACHE_SIZE:
        _cache.pop(next(iter(_cache)))  # drop the oldest entry
    _cache[key] = text


def _describe(exc: Exception) -> str:
    """Short reason for the log. Never includes the API key."""
    if isinstance(exc, LLMUnavailable):
        return str(exc)
    if isinstance(exc, anthropic.APITimeoutError):  # subclass of APIConnectionError: check first
        return "Anthropic API timed out"
    if isinstance(exc, anthropic.APIStatusError):
        return f"Anthropic API error {exc.status_code}"
    if isinstance(exc, anthropic.APIConnectionError):
        return "cannot reach the Anthropic API"
    if isinstance(exc, urllib.error.URLError):
        return f"cannot reach Ollama ({exc.reason})"
    return f"{type(exc).__name__}: {exc}"
