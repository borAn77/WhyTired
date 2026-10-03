"""Shared test setup.

Every test runs with LLM_PROVIDER=none, so no test ever calls a real LLM API, even when
backend/.env holds a real key (main.py loads it). Tests that need the LLM path replace the
provider with a fake (see test_llm.py).
"""

import pytest


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
