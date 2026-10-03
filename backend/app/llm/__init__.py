"""WhyTired LLM layer (owner: Berken). The rule engine decides; this layer only explains.

    from app.llm import explain_detective, explain_summary

Files: providers.py (LLM call, time limit, cache), validate.py (output checks),
templates.py (EN/PL fallback texts), explain.py (findings -> Explanation).
"""

from .explain import explain_detective, explain_summary

__all__ = ["explain_detective", "explain_summary"]
