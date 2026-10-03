"""WhyTired API. Routes only: all logic lives in app/engine (rules) and app/llm (explanations)."""

from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from . import store
from .engine import artifacts
from .engine.detective import run_detective
from .engine.experiment import evaluate_experiment
from .llm import explain_detective
from .llm.providers import active_provider
from .models import Ctx, DayRecord, DetectiveResult, ExperimentResult, Health, Profile

load_dotenv()

app = FastAPI(title="WhyTired API", version="0.1.0")


def days_for(ctx: Ctx) -> list[DayRecord]:
    """The days this request may see: up to `today`, in the chosen branch, at the chosen data level."""
    try:
        persona = store.get_persona(ctx.persona_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown persona '{ctx.persona_id}'")
    days = store.days_until(persona, ctx.today, ctx.scenario, ctx.checkins)
    if len(days) < 35:
        raise HTTPException(status_code=422, detail="Not enough days of data before this date")
    return store.restrict_to_level(days, ctx.data_level)


@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(
        status="ok",
        personas=sorted(store.load_personas()),
        llm_provider=active_provider(),
    )


@app.get("/api/personas", response_model=list[Profile])
def personas() -> list[Profile]:
    return [persona.profile for persona in store.load_personas().values()]


@app.post("/api/detective", response_model=DetectiveResult)
def detective(ctx: Ctx) -> DetectiveResult:
    result = run_detective(days_for(ctx))
    if result.triggered:
        result.explanation = explain_detective(result, ctx.lang)
    return result


@app.post("/api/experiment", response_model=ExperimentResult)
def experiment(ctx: Ctx) -> ExperimentResult:
    if ctx.experiment is None:
        raise HTTPException(status_code=422, detail="No experiment in the request")
    clean_days, _ = artifacts.clean(days_for(ctx))
    return evaluate_experiment(clean_days, ctx.experiment, ctx.today)
