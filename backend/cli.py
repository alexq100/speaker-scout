"""Run one Speaker Scout search from the terminal and save the result to output/runs/.

    .venv/bin/python backend/cli.py --example ybec
    .venv/bin/python backend/cli.py "climate adaptation in cities" --looking-for panel
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402
from agents import SpeakerScout  # noqa: E402
from examples import EXAMPLES  # noqa: E402
from models import SearchBrief  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Run one Speaker Scout search.")
    ap.add_argument("theme", nargs="?", help="Conference theme")
    ap.add_argument("--example", choices=sorted(EXAMPLES), help="Use one of the example briefs")
    ap.add_argument("--looking-for", default="any", choices=["keynote", "panel", "moderator", "workshop", "any"])
    ap.add_argument("--categories", help="Comma-separated, e.g. academic,journalist (default: all six)")
    args = ap.parse_args()

    if args.example:
        brief = EXAMPLES[args.example].model_copy(deep=True)
    elif args.theme:
        brief = SearchBrief(conference_theme=args.theme, looking_for=args.looking_for)
    else:
        ap.error("give a theme or --example")
    if args.categories:
        brief.categories = [c.strip() for c in args.categories.split(",")]

    scout = SpeakerScout()
    result = asyncio.run(scout.run(brief, on_event=lambda e: print(f"[{e.seconds:6.1f}s] {e.agent}: {e.message}")))

    config.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    out = config.RUNS_DIR / f"{result.id}.json"
    out.write_text(result.model_dump_json(indent=2))

    print("\n" + "=" * 78)
    for cr in result.categories:
        print(f"\n## {cr.label}  ({cr.candidates_found} found, {len(cr.cards)} shown, {len(cr.dropped)} dropped, {cr.seconds}s)")
        if cr.error:
            print(f"   ! {cr.error}")
        for c in cr.cards:
            print(f"   - {c.name}: {c.job_title}, {c.organization}  [{c.level}, {'/'.join(c.best_for)}, "
                  f"speaking: {c.speaking_badge}, fit {c.fit_score}]  photo: {'yes' if c.photo_url else 'no'}")
            for link in c.links:
                print(f"       [{link.kind}] {link.label}: {link.url}")
        for d in cr.dropped:
            print(f"   x dropped {d.name}: {d.reason}")
    if result.removals:
        print("\nCode checks removed:")
        for r in result.removals:
            print(f"   - [{r.category}] {r.name}: {r.what}: {r.detail}")
    if result.injection_flags:
        print("\nInjection flags:", *result.injection_flags, sep="\n   ")
    u = result.usage
    print(f"\nStatus: {result.status}  {result.error or ''}")
    print(f"Time: {result.seconds}s | model calls: {u.model_calls} | input: {u.input_tokens:,} "
          f"(cached {u.cached_input_tokens:,}) | output: {u.output_tokens:,} | web searches: {u.web_searches} "
          f"| page reads: {u.page_reads} | cost: {u.cost_usd if u.cost_usd is not None else 'set prices in .env'}")
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
