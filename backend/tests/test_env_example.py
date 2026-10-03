from pathlib import Path

ENV_EXAMPLE = Path(__file__).resolve().parent.parent / ".env.example"


def test_env_example_contains_no_secrets():
    """.env.example is committed. Real keys belong in backend/.env, which git ignores."""
    for line in ENV_EXAMPLE.read_text().splitlines():
        if line.startswith("ANTHROPIC_API_KEY="):
            assert line == "ANTHROPIC_API_KEY=", "Put the real key in backend/.env, not .env.example"
