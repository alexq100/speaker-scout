"""Tokenomics from the official runs, measured from output/audit_trail.jsonl (one line per model call).
Writes output/tokenomics.json. Prices: gpt-6-luna per 1M tokens from MGT 409 Lecture 11."""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P_IN, P_CACHED, P_WRITE, P_OUT = 0.10, 0.01, 0.125, 0.50
WEB_SEARCH_PER_K = 10.00   # assumption: OpenAI's published web search tool fee, $10 per 1,000 calls (if billed)

def cost(inp, cached, out, write=0):
    return ((inp - cached - write) * P_IN + cached * P_CACHED + write * P_WRITE + out * P_OUT) / 1e6

runs = json.loads((ROOT / "output/official/official_runs.json").read_text())
ids = {r["search_id"] for r in runs}
by_run_agent = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
for line in (ROOT / "output/audit_trail.jsonl").read_text().splitlines():
    e = json.loads(line)
    if e.get("event") == "model_response" and e.get("search_id") in ids:
        a = by_run_agent[e["search_id"]][e["agent"]]
        a["calls"] += 1
        a["input"] += e.get("input_tokens") or 0
        a["cached"] += e.get("cached_input_tokens") or 0
        a["output"] += e.get("output_tokens") or 0
        a["web_searches"] += e.get("web_searches") or 0

out_runs = []
for r in runs:
    agents = {k: dict(v) for k, v in by_run_agent[r["search_id"]].items()}
    for v in agents.values():
        v["cost_usd"] = round(cost(v["input"], v["cached"], v["output"]), 5)
    c = cost(r["input_tokens"], r["cached_input_tokens"], r["output_tokens"])
    out_runs.append({**{k: r[k] for k in ("example", "conference", "search_id", "seconds", "speakers_total", "dropped",
                                          "model_calls", "input_tokens", "cached_input_tokens", "output_tokens",
                                          "web_searches", "page_reads")},
                     "cached_share": round(r["cached_input_tokens"] / r["input_tokens"], 3),
                     "token_cost_usd": round(c, 4),
                     "web_search_fee_usd_if_billed": round(r["web_searches"] * WEB_SEARCH_PER_K / 1000, 4),
                     "cost_per_verified_speaker_usd": round(c / max(r["speakers_total"], 1), 5),
                     "by_agent": agents})

n = len(out_runs)
avg = {k: sum(r[k] for r in out_runs) / n for k in ("seconds", "speakers_total", "input_tokens", "cached_input_tokens",
                                                   "output_tokens", "web_searches", "token_cost_usd", "web_search_fee_usd_if_billed")}
# Small extras measured in testing (Steps 9-15): panel review ~9.3k, email draft ~1.7k, chat question ~15k tokens.
extra = {"chat_question": cost(15000, 3000, 900), "email_draft": cost(1200, 0, 450), "panel_review": cost(8400, 0, 900)}
# Assumed monthly use per active planner (a conference team member during planning season):
usage = {"searches": 12, "chat_questions": 40, "email_drafts": 20, "panel_reviews": 8}
per_user_tokens = (usage["searches"] * avg["token_cost_usd"] + usage["chat_questions"] * extra["chat_question"]
                   + usage["email_drafts"] * extra["email_draft"] + usage["panel_reviews"] * extra["panel_review"])
per_user_search_fees = (usage["searches"] * avg["web_searches"] + usage["chat_questions"] * 1) * WEB_SEARCH_PER_K / 1000
scale = {str(u): {"tokens_only_usd_per_month": round(u * per_user_tokens, 2),
                  "with_web_search_fees_usd_per_month": round(u * (per_user_tokens + per_user_search_fees), 2)}
         for u in (1, 100, 10_000)}
result = {"prices_per_1M": {"input": P_IN, "cached_input": P_CACHED, "cache_write": P_WRITE, "output": P_OUT},
          "web_search_fee_assumption_per_1k_calls": WEB_SEARCH_PER_K, "runs": out_runs,
          "average_per_search": {k: round(v, 4) for k, v in avg.items()},
          "average_cached_share": round(avg["cached_input_tokens"] / avg["input_tokens"], 3),
          "extras_cost_usd": {k: round(v, 5) for k, v in extra.items()}, "assumed_monthly_use_per_planner": usage,
          "per_planner_per_month_usd": {"tokens_only": round(per_user_tokens, 3),
                                        "with_web_search_fees": round(per_user_tokens + per_user_search_fees, 3)},
          "scale": scale,
          "caching_savings_per_search_usd": round(avg["cached_input_tokens"] * (P_IN - P_CACHED) / 1e6, 4)}
(ROOT / "output/tokenomics.json").write_text(json.dumps(result, indent=2))
print(json.dumps({k: result[k] for k in ("average_per_search", "average_cached_share", "per_planner_per_month_usd", "scale", "caching_savings_per_search_usd")}, indent=1))
for r in out_runs:
    print(r["example"], r["token_cost_usd"], {a: (v["calls"], v["input"], v["output"]) for a, v in r["by_agent"].items()})
