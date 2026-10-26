# tests/

| File | What it checks |
|---|---|
| `spike_web_search.py` | Step 2 test: gpt-6-luna's built-in `web_search` works through Portkey and returns cited sources |
| `injection_pages/` | Planted web pages with hidden instructions, used to show the prompt-injection defense working (Step 8) |
| `test_mcp_tools.py` | Smoke test of every MCP tool, which writes `output/mcp_smoke.json` (Step 4) |
| `test_safety.py` | Safety defenses: injection ignored, unverified speakers dropped, token caps enforced (Step 8) |
