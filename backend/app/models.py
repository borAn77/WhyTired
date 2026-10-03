"""Shared data + API contract for WhyTired.

The synthetic data generator, the rule engine, the API and the frontend types
(`frontend/src/lib/types.ts`) all depend on these models. Change them only via a
PR that both team members have seen.
"""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

DataLevel = Literal["basic", "medium", "full"]
Scenario = Literal["improved", "not_improved"]
Confidence = Literal["high", "medium", "low"]
Lang = Literal["pl", "en"]
CauseId = Literal["load_spike", "sleep_debt", "stress_spike", "rhr_elevated"]
Recommendation = Literal["hard", "easy", "rest"]
ExperimentStatus = Literal["running", "improved", "not_improved", "not_enough_data"]


# --------------------------------------------------------------------------
# Input data: the synthetic JSON files in backend/data/ follow these shapes.
# --------------------------------------------------------------------------


class Profile(BaseModel):
    id: str
    name: str
    age: int
    goal: str
    sports: list[str]
    has_watch: bool


class CheckIn(BaseModel):
    """The 15-second morning check-in (5 questions)."""

    energy: int = Field(ge=1, le=5)
    sleep_hours: float = Field(ge=0, le=16)
    sleep_quality: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    soreness: int = Field(ge=1, le=5)


class Session(BaseModel):
    """A manually logged training session. Load = duration_min × rpe (Foster et al., 2001)."""

    sport: str
    duration_min: int = Field(gt=0)
    rpe: int = Field(ge=1, le=10)


class WatchDay(BaseModel):
    """One night/day of smartwatch data (Full data level). Any field may be missing."""

    resting_hr: float | None = None
    hrv_ms: float | None = None
    sleep_min: float | None = None
    sleep_coverage: float | None = Field(default=None, ge=0, le=1)  # share of the night with data
    sleep_hr_avg: float | None = None
    day_hr_avg: float | None = None


class DayRecord(BaseModel):
    date: dt.date
    checkin: CheckIn | None = None
    sessions: list[Session] = []
    steps: int | None = None  # phone step count (Medium data level)
    manual_pulse: int | None = None  # guided 30-second pulse, bpm (Medium data level)
    watch: WatchDay | None = None  # Full data level
    tags: list[str] = []  # story labels such as "holiday" or "exams"; only used to name periods in the UI


class PersonaFile(BaseModel):
    profile: Profile
    history: list[DayRecord]  # 90 days, the last one is the demo day (D0)
    future: dict[Scenario, list[DayRecord]]  # 14 days after D0 for each outcome branch


# --------------------------------------------------------------------------
# Requests. The backend is stateless: the client sends this context on every call.
# --------------------------------------------------------------------------


class Experiment(BaseModel):
    cause_id: CauseId
    start: dt.date  # first day of the experiment
    days: int = 7


class PlannedSession(BaseModel):
    sport: str
    duration_min: int = Field(gt=0)


class Ctx(BaseModel):
    persona_id: str
    today: dt.date
    scenario: Scenario = "not_improved"
    data_level: DataLevel = "full"
    checkins: dict[dt.date, CheckIn] = {}  # check-ins logged in the app; they override synthetic ones
    experiment: Experiment | None = None
    lang: Lang = "en"


class CoachRequest(Ctx):
    planned_session: PlannedSession | None = None


# --------------------------------------------------------------------------
# Results
# --------------------------------------------------------------------------


class ChartPoint(BaseModel):
    date: dt.date
    value: float | None
    baseline: float | None = None


class Chart(BaseModel):
    metric: str
    unit: str
    points: list[ChartPoint]


class Evidence(BaseModel):
    metric: str  # e.g. "weekly_load", "resting_hr", "sleep_hours", "stress", "energy"
    text: str  # plain-language sentence built from engine numbers
    value: float
    baseline: float | None = None
    unit: str = ""


class HistoryCheck(BaseModel):
    """Did this factor matter before? Compares a past period from the user's own data."""

    supports: bool
    text: str
    period_start: dt.date | None = None
    period_end: dt.date | None = None
    period_tag: str | None = None
    energy_delta: float | None = None
    rhr_delta: float | None = None


class Cause(BaseModel):
    id: CauseId
    title: str
    confidence: Confidence
    score: int
    strength: float  # effect size relative to the "strong" threshold, used for ranking
    evidence: list[Evidence]
    history_check: HistoryCheck | None = None
    data_level_used: DataLevel
    chart: Chart | None = None


class ExcludedPoint(BaseModel):
    date: dt.date
    metric: str
    value: float | None
    reason: str


class ExperimentPlan(BaseModel):
    cause_id: CauseId
    title: str
    steps: list[str]
    track: list[str]  # what to log each morning
    days: int = 7


class Explanation(BaseModel):
    text: str
    source: Literal["llm", "template"]


class DetectiveResult(BaseModel):
    triggered: bool
    low_energy_days: int
    data_level: DataLevel
    causes: list[Cause]
    excluded: list[ExcludedPoint]
    suggested_experiment: ExperimentPlan | None = None
    explanation: Explanation | None = None


class CoachResult(BaseModel):
    recommendation: Recommendation
    reasons: list[str]
    injury_warning: str | None = None
    detective_triggered: bool
    has_checkin: bool


class ExperimentResult(BaseModel):
    status: ExperimentStatus
    day: int  # 1..days while running
    days_total: int
    checkins_logged: int
    energy_before: float | None = None
    energy_during: float | None = None
    rhr_baseline: float | None = None
    rhr_during: float | None = None
    summary: str


class TimelineEntry(BaseModel):
    date: dt.date
    text: str


class Trend(BaseModel):
    title: str
    note: str
    chart: Chart


class DoctorSummary(BaseModel):
    lang: Lang
    patient: str  # first name + age; synthetic personas only
    period_start: dt.date
    period_end: dt.date
    data_level: DataLevel
    complaint: str
    timeline: list[TimelineEntry]
    trends: list[Trend]
    tried: str
    result: str
    questions: list[str]
    disclaimer: str
    explanation: Explanation | None = None


class Health(BaseModel):
    status: Literal["ok"]
    personas: list[str]
    llm_provider: str
