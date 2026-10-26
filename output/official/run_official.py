"""Official runs for the report: the 3 example briefs (Alex's real conferences), each a fresh full search,
saved to output/runs/ and filed under the matching conference in the app. Run from the project folder:
    .venv/bin/python output/official/run_official.py
"""
import asyncio, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
import config, store
from agents import SpeakerScout
from examples import EXAMPLES

CONFERENCE_FOR = {"ybec": "Environment Conference", "philanthropy": "Philanthropy", "trees": "Urban Tree Summit 2027"}

async def main():
    scout = SpeakerScout()
    summary = []
    for key, conf_name in CONFERENCE_FOR.items():
        brief = EXAMPLES[key].model_copy(deep=True)
        print(f"== {key}: {brief.conference_name}", flush=True)
        r = await scout.run(brief, on_event=lambda e: print(f"  [{e.seconds:5.1f}s] {e.agent}: {e.message[:110]}", flush=True))
        (config.RUNS_DIR / f"{r.id}.json").write_text(r.model_dump_json(indent=2))
        conf = next((c for c in store.list_conferences() if c["name"] == conf_name), None) or store.create_conference(conf_name)
        store.save_search(r, conf["id"])
        u = r.usage
        row = {"example": key, "conference": brief.conference_name, "search_id": r.id, "status": r.status,
               "seconds": r.seconds, "speakers": {c.category: len(c.cards) for c in r.categories},
               "speakers_total": sum(len(c.cards) for c in r.categories),
               "dropped": sum(len(c.dropped) for c in r.categories), "code_removals": len(r.removals),
               "panels": [p.title for p in r.panels], "model_calls": u.model_calls, "input_tokens": u.input_tokens,
               "cached_input_tokens": u.cached_input_tokens, "output_tokens": u.output_tokens,
               "reasoning_tokens": u.reasoning_tokens, "web_searches": u.web_searches, "page_reads": u.page_reads,
               "panel_architect_tokens": (r.panel_usage.input_tokens + r.panel_usage.output_tokens) if r.panel_usage else 0,
               "names": {c.category: [k.name for k in c.cards] for c in r.categories}}
        summary.append(row)
        print(json.dumps({k: row[k] for k in ("search_id", "seconds", "speakers_total", "dropped", "input_tokens", "cached_input_tokens", "output_tokens")}), flush=True)
    (ROOT / "output" / "official" / "official_runs.json").write_text(json.dumps(summary, indent=2))

asyncio.run(main())
