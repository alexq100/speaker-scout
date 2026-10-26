# output/

Evidence from **real runs**. The report's numbers and screenshots come from here.

| Path | What it holds |
|---|---|
| `audit_trail.jsonl` | Every model call: agent, model reported, tool calls, input / cached input / output tokens |
| `runs/` | One JSON file per official search run (topics, speakers found, drops, tokens, cost, time) |
| `mcp_smoke.json` | Result of testing every MCP tool |
| `tokenomics.json` | Measured token and cost numbers used in the report |
| `screenshots/` | App screenshots: good runs, the step-by-step trace, safety defenses catching something |
