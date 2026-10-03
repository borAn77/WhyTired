"""Daily coach: "what should I do today?"

get_daily_plan(df, date) ->
  {"date": "2026-09-26", "decision": "rest",
   "reasons": ["Resting HR 62 bpm (your normal: 54 bpm)", "Soreness 4/5", ...],
   "plan_change": "Instead of your usual Saturday hard session (~22 km): rest today. ...",
   "explanation_text": "",    # stays empty; the LLM layer fills it later
   "signals_used": ["resting_hr", "hrv_7d", "sleep_hours", "soreness", "feeling_sick"]}

The decision, step by step (plain rules, no ML):
1. Red signals, each checked only if its data exists:
     resting HR > baseline + 5 bpm, HRV 7-day avg < baseline - 1 SD,
     sleep < 6 h, energy <= 2/5   (the low-day rules from baseline.py)
     soreness >= 4/5
   2+ red signals -> rest, 1 -> easy at most, 0 -> hard allowed.
   Feeling sick -> rest, always: we never coach anyone through feeling sick.
2. The plan is the user's own habit: the usual session on a weekday is the
   median training load of that weekday over the last 4 weeks, classed as
   rest (no training), hard (above the median training-day load of the last
   30 days) or easy. The same rule serves both personas: training load from
   the watch for runners, session-RPE (RPE 1-10 x minutes) from the workout
   log for gym users. A day without a log entry counts as no training.
3. Never two hard days in a row: hard yesterday -> easy at most today.
4. A missed hard session (usual hard, not done hard) moves to the next free
   day: no usual hard session that day, not right after a hard day, within
   7 days. Only the latest one; older ones are dropped, never crammed in.
5. 10% rule (runners only): never plan a run longer than the longest run of
   the last 30 days + 10%.

Run:  python -m engine.coach   (from the repo root)
"""
import pandas as pd

from .artifacts import detect_artifacts
from .baseline import is_low_day

SORENESS_RED = 4      # soreness >= 4 on a 1-5 scale
HABIT_WEEKS = 4       # usual session = same weekday over the last 4 weeks
MISSED_DAYS = 7       # a missed hard session can be made up within 7 days
LONG_RUN_MAX = 1.10   # 10% rule
LEVELS = ["rest", "easy", "hard"]   # from light to heavy
SESSION_TEXT = {"rest": "rest day", "easy": "easy session", "hard": "hard session"}
DAY = pd.Timedelta(days=1)


def ten_percent_rule(planned_km, longest_km):
    """Never plan a run longer than the longest run of the last 30 days + 10%.
    No runs in the last 30 days -> nothing to compare with, plan unchanged."""
    if longest_km > 0:
        return min(planned_km, longest_km * LONG_RUN_MAX)
    return planned_km


def _session(load, hard_above):
    """Class one day's training load as rest / easy / hard."""
    if pd.isna(load) or load <= 0:
        return "rest"
    return "hard" if load > hard_above else "easy"


def _same_weekday(series, day):
    """Values of the same weekday over the last 4 weeks (NaN where no data)."""
    return series.reindex([day - 7 * k * DAY for k in range(1, HABIT_WEEKS + 1)])


def _lighter(a, b):
    return min(a, b, key=LEVELS.index)


def _missed_hard_session(day, done, usual):
    """The latest day in the last 7 whose usual hard session was not done,
    as long as no hard session has been done since. None if nothing is owed."""
    for back in range(1, MISSED_DAYS + 1):
        d = day - back * DAY
        if done(d) == "hard":
            return None              # trained hard since -> nothing owed
        if usual(d) == "hard":
            return d
    return None


def get_daily_plan(df, date):
    day = pd.Timestamp(date)
    data = df.set_index(pd.to_datetime(df["date"]))
    row = data.loc[day]
    load = data["training_load"].fillna(0)                    # no log = no training
    km = data["longest_run_km"].fillna(0) if "longest_run_km" in data else None

    # 1. Red signals -> how hard today may be ("readiness").
    artifacts = detect_artifacts(df)["artifacts"]
    low = is_low_day(df, date, artifacts)
    reasons, signals = list(low["reasons"]), list(low["signals_used"])
    if pd.notna(row.get("soreness")):
        signals.append("soreness")
        if row["soreness"] >= SORENESS_RED:
            reasons.append(f"Soreness {row['soreness']:.0f}/5")
    sick = False
    if pd.notna(row.get("feeling_sick")):
        signals.append("feeling_sick")
        sick = bool(row["feeling_sick"])
    readiness = "rest" if sick or len(reasons) >= 2 else "easy" if reasons else "hard"
    if sick:
        reasons.append("You reported feeling sick: rest until you feel better")

    # 2. The plan from habits.
    recent = load[day - 30 * DAY: day - DAY]
    hard_above = recent[recent > 0].median()

    def done(d):    # what was actually done that day
        return _session(load.get(d, 0), hard_above)

    def usual(d):   # what is normally done on that weekday
        return _session(_same_weekday(load, d).median(), hard_above)

    planned = usual(day)
    hard_yesterday = done(day - DAY) == "hard"

    # 4. A missed hard session takes today if today is a free day.
    missed = None
    if planned != "hard" and not hard_yesterday:
        missed = _missed_hard_session(day, done, usual)
    target = "hard" if missed is not None else planned

    # 3. Never two hard days in a row.
    if hard_yesterday and target == "hard":
        readiness = _lighter(readiness, "easy")
        reasons.append("Yesterday was a hard session: never two hard days in a row")

    decision = _lighter(readiness, target)

    # Tell the user when last night's watch data was ignored.
    today = day.strftime("%Y-%m-%d")
    reasons += [f"Ignored watch data: {a['reason']}" for a in artifacts if a["date"] == today]

    # 5. Distance for runners: usual distance of that session, 10% rule applied.
    distance = ""
    if km is not None and target != "rest":
        usual_km = _same_weekday(km, missed if missed is not None else day).median()
        longest = km[day - 30 * DAY: day - DAY].max()
        planned_km = ten_percent_rule(usual_km, longest)
        if planned_km > 0:
            distance = f" (~{planned_km:.0f} km)"
            if planned_km < usual_km:
                distance = (f" (~{planned_km:.0f} km instead of your usual {usual_km:.0f} km: "
                            f"10% rule, your longest run in the last 30 days was {longest:.0f} km)")

    what = (f"the hard session you missed on {missed:%A}" if missed is not None
            else f"your usual {day:%A} {SESSION_TEXT[planned]}")
    if decision == target:
        change = f"Make up {what}{distance}." if missed is not None else f"No change: {what}{distance}."
    else:
        change = f"Instead of {what}{distance}: {'rest' if decision == 'rest' else 'an easy session'} today."
        if target == "hard":
            change += (" The hard session moves to the next free day (no hard session planned, "
                       "not right after a hard day), at most a week later.")

    return {"date": today, "decision": decision, "reasons": reasons,
            "plan_change": change, "explanation_text": "", "signals_used": signals}


if __name__ == "__main__":
    import json
    from pathlib import Path

    df = pd.read_csv(Path(__file__).parent / "data" / "demo_ania.csv")
    for d in ["2026-08-20", "2026-09-22", "2026-09-26", "2026-09-28"]:
        print(json.dumps(get_daily_plan(df, d), indent=1))

    # Self-checks on the demo story.
    assert get_daily_plan(df, "2026-09-28")["decision"] == "rest"       # low days -> rest
    art = get_daily_plan(df, "2026-08-20")                              # artifact night
    assert not any(r.startswith("Resting HR") for r in art["reasons"])
    assert any(r.startswith("Ignored watch data") for r in art["reasons"])
    # Missed session: skip Tuesday 08-11's hard run -> made up on Wednesday.
    skipped = df.assign(training_load=df["training_load"].mask(df["date"] == "2026-08-11", 0))
    assert get_daily_plan(skipped, "2026-08-12")["decision"] == "hard"
    # ...and if Wednesday was then done hard, Thursday's hard run becomes easy.
    made_up = skipped.assign(training_load=skipped["training_load"].mask(skipped["date"] == "2026-08-12", 90))
    assert get_daily_plan(made_up, "2026-08-13")["decision"] == "easy"
    assert ten_percent_rule(25, 20) == 22 and ten_percent_rule(15, 20) == 15
    # Persona 2 (gym, no watch): check-in only, low energy + soreness -> rest.
    gym = df[["date", "sleep_hours", "soreness", "mood", "feeling_sick", "training_load"]].assign(energy=2)
    plan = get_daily_plan(gym, "2026-09-26")
    assert plan["signals_used"] == ["sleep_hours", "energy", "soreness", "feeling_sick"], plan
    assert plan["decision"] == "rest" and "km" not in plan["plan_change"]
    print("OK: rest on low days, artifact ignored, missed session moved, "
          "no two hard days in a row, 10% rule, no-watch user")
