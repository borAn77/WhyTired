"""WhyTired LLM layer.

Turns JSON computed by the core engine into readable text.
The LLM never decides anything; it only rewords facts it is given.

    from engine.llm import explain_daily, explain_evidence, doctor_brief
"""
from .texts import doctor_brief, explain_daily, explain_evidence

__all__ = ["explain_daily", "explain_evidence", "doctor_brief"]
