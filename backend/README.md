# backend/

The Speaker Scout agent team (PydanticAI + gpt-6-luna through Portkey), plus the FastAPI app (API step). See [`docs/harness.md`](../docs/harness.md) for the full guide.

| File | What it holds |
|---|---|
| `config.py` | Model lock, `.env` lookup, paths, all limits |
| `models.py` | Data shapes (brief, plan, candidate, speaker card, result, usage) |
| `agents.py` | Scout Lead → 6 × (Searcher → Verifier) pipeline |
| `tools.py` | `fetch_page`, `wiki_lookup`, URL safety, run trace |
| `guards.py` | Code checks on agent output |
| `audit.py` | Audit trail, token totals, cost |
| `examples.py` | Example briefs from real conferences |
| `cli.py` | Terminal test: `.venv/bin/python backend/cli.py --example ybec` |
| `prompts/` | `shared_rules.md`, `scout_lead.md`, `searcher.md`, `verifier.md` |
| `main.py` | FastAPI routes (API step) |
