"""LLM client: one function, `complete()`, that turns a prompt into text.

Design rules (each one is explained in DECISIONS.md):
  * The LLM never decides. Callers send facts already computed by the core
    engine; the LLM only rewords them.
  * Every call has a fallback. If the LLM is turned off, slow, unreachable,
    returns nothing, or returns text that fails the caller's check, we return
    the caller's hand-written template instead. The demo never breaks.
  * Hard 10-second limit on the whole call (DNS + connect + generation).
  * Standard library only (urllib), so there is nothing extra to install.

Configuration (environment variables, read on every call, never hard-coded):
  LLM_PROVIDER       "ollama" (default, runs on this laptop) | "anthropic" | "off"
  LLM_MODEL          model name; default depends on the provider (DEFAULT_MODELS)
  OLLAMA_URL         Ollama server, default http://localhost:11434
  ANTHROPIC_API_KEY  required for "anthropic" (LLM_API_KEY also accepted)

Try it:  python3 -m engine.llm.client
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Callable

log = logging.getLogger("whytired.llm")

TIMEOUT_S = 10
TEMPERATURE = 0.2  # low: we want faithful rewording, not creativity
DEFAULT_PROVIDER = "ollama"
DEFAULT_MODELS = {
    # Small enough for a laptop and multilingual (the doctor brief is Polish).
    "ollama": "gemma3:4b",
    # Fastest Claude model, comfortably inside the 10-second budget.
    "anthropic": "claude-haiku-4-5-20251001",
}
OLLAMA_DEFAULT_URL = "http://localhost:11434"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

# The last 50 calls (without the text), so the demo can show "LLM" vs "template".
_recent: deque = deque(maxlen=50)

# HTTP calls run in a worker thread so we can enforce a hard wall-clock limit.
# urllib's own timeout covers connect and each read, but not DNS lookups,
# which can hang for 30 s or more on bad hackathon Wi-Fi.
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm")


class LLMUnavailable(Exception):
    """Any reason we could not get a usable answer from the LLM."""


def get_config() -> dict:
    """Read provider and model from the environment (at call time, so it can be switched)."""
    provider = os.getenv("LLM_PROVIDER", DEFAULT_PROVIDER).strip().lower()
    model = os.getenv("LLM_MODEL") or DEFAULT_MODELS.get(provider, "")
    return {"provider": provider, "model": model}


def complete(
    system: str,
    user: str,
    fallback: str,
    *,
    validate: Callable[[str], bool] | None = None,
    max_tokens: int = 400,
    expect_json: bool = False,
) -> dict:
    """Ask the LLM, or return `fallback` if anything goes wrong.

    Args:
        system:      guardrail instructions (role, tone, what is forbidden).
        user:        the facts to reword; only aggregated, anonymous values.
        fallback:    hand-written template text, used when the LLM cannot help.
        validate:    optional check on the LLM's text (e.g. no diagnosis words,
                     valid JSON). If it returns False, the fallback is used.
        max_tokens:  upper bound on answer length.
        expect_json: ask Ollama for JSON-only output (Claude follows the prompt).

    Returns a JSON-serialisable dict:
        {"text", "source": "llm" | "fallback", "provider", "model",
         "latency_ms", "reason": None or why the fallback was used}
    """
    cfg = get_config()
    started = time.monotonic()
    try:
        text = _ask_llm(cfg, system, user, max_tokens, expect_json)
        if validate is not None and not validate(text):
            raise LLMUnavailable("answer failed the safety/format check")
        source, reason = "llm", None
    except Exception as exc:  # any problem at all -> template; never crash the demo
        text, source, reason = fallback, "fallback", _describe(exc)

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
        log.info("LLM used: %s/%s in %d ms", cfg["provider"], cfg["model"], result["latency_ms"])
    else:
        log.warning("Template fallback used: %s", reason)
    return result


def recent_calls() -> list[dict]:
    """Newest-first list of recent calls: which path (llm/fallback) and why."""
    return list(reversed(_recent))


# --- internals -------------------------------------------------------------

def _ask_llm(cfg: dict, system: str, user: str, max_tokens: int, expect_json: bool) -> str:
    """Return non-empty LLM text, or raise. Never waits longer than TIMEOUT_S."""
    if cfg["provider"] == "off":
        raise LLMUnavailable("LLM turned off (LLM_PROVIDER=off)")
    call = _PROVIDERS.get(cfg["provider"])
    if call is None:
        raise LLMUnavailable(f"unknown LLM_PROVIDER '{cfg['provider']}'")

    future = _pool.submit(call, cfg["model"], system, user, max_tokens, expect_json)
    try:
        text = future.result(timeout=TIMEOUT_S)
    except FutureTimeout:
        future.cancel()  # if it never started, don't run it later
        raise LLMUnavailable(f"no answer within {TIMEOUT_S} s") from None

    text = (text or "").strip()
    if not text:
        raise LLMUnavailable("empty answer")
    return text


def _call_ollama(model: str, system: str, user: str, max_tokens: int, expect_json: bool) -> str:
    """Local model via Ollama's /api/chat. Health data never leaves the laptop."""
    url = os.getenv("OLLAMA_URL", OLLAMA_DEFAULT_URL).rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": TEMPERATURE, "num_predict": max_tokens},
    }
    if expect_json:
        payload["format"] = "json"
    data = _post_json(url, payload, headers={})
    return data["message"]["content"]


def _call_anthropic(model: str, system: str, user: str, max_tokens: int, expect_json: bool) -> str:
    """Claude via the Anthropic Messages API. The key comes only from the environment."""
    key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("LLM_API_KEY")
    if not key:
        raise LLMUnavailable("ANTHROPIC_API_KEY is not set")
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": TEMPERATURE,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
    data = _post_json(ANTHROPIC_URL, payload, headers)
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


_PROVIDERS = {"ollama": _call_ollama, "anthropic": _call_anthropic}


def _post_json(url: str, payload: dict, headers: dict) -> dict:
    """POST JSON and return the parsed JSON answer."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Keep the server's message; e.g. Ollama says "model 'x' not found".
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        raise LLMUnavailable(f"HTTP {exc.code}: {detail}") from None


def _describe(exc: Exception) -> str:
    """Short, human-readable reason for the demo log."""
    if isinstance(exc, LLMUnavailable):
        return str(exc)
    if isinstance(exc, urllib.error.URLError):
        return f"cannot reach LLM server ({exc.reason})"
    return f"{type(exc).__name__}: {exc}"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    demo = complete(
        system="Rewrite the facts for a recreational runner in one short, friendly "
               "sentence. Do not add facts. No medical advice.",
        user="Decision: rest. Resting HR 61 (usual 52). Soreness 4/5.",
        fallback="Take a rest day: your resting heart rate is 61 (usually 52) "
                 "and soreness is 4/5.",
    )
    print(json.dumps(demo, indent=2, ensure_ascii=False))
