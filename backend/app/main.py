"""WhyTired API. Routes only: all logic lives in app/engine (rules) and app/llm (explanations)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI

from . import store
from .models import Health, Profile

load_dotenv()

app = FastAPI(title="WhyTired API", version="0.1.0")


@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(
        status="ok",
        personas=sorted(store.load_personas()),
        llm_provider=os.getenv("LLM_PROVIDER", "none"),
    )


@app.get("/api/personas", response_model=list[Profile])
def personas() -> list[Profile]:
    return [persona.profile for persona in store.load_personas().values()]
