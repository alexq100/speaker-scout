# Speaker Scout: AI speaker discovery for conference planning teams

**Find real, verified speakers for your conference in about 90 seconds, then plan panels and run outreach in one place.**

Planners fill in a short brief (theme, keynote or panel, location, budget…). A team of AI agents searches the live web across six kinds of speakers (academics, practitioners, policy, founders, advocates, journalists), **verifies every person against real pages**, surfaces their speaking history, and suggests cross-discipline panels. The team then shortlists people into keynote slots and panels, tracks outreach, drafts invitation emails, and asks a chat assistant for more research on any speaker.

Built for MGT 409 (AI Foundations for Managers, Yale SOM) by Alex Kew. Repo: https://github.com/alexq100/speaker-scout All agents run on **gpt-6-luna** through Portkey.

## Run it locally

You need **Python 3.11+** and **Node 18+** (with npm).

1. **Key:** the app reads `PORTKEY_API_KEY` from a `.env` file, **first in this folder, then in the folder one level up**. Either keep a `.env` one folder above the repo, or:
   ```bash
   cp .env.example .env    # then put your PORTKEY_API_KEY in .env
   ```
2. **Start:**
   ```bash
   ./start.sh
   ```
   The first run creates the Python environment and installs the website packages (about 2–4 minutes). Then open **http://localhost:5173**. Press Ctrl+C once to stop everything.
3. **Create a team account** on the first screen (team name, username, an 8+ character password, and your name). Teammates share this login, and each person's name appears in **What's new**. The first account on a computer also gets any work saved there before.
4. **Optional: see real results without spending tokens.** In a second terminal, load the three official example searches:
   ```bash
   .venv/bin/python backend/load_examples.py
   ```
   Refresh the site and pick a conference from the **Conference** menu at the top right.

**Try it:** on the home page, click **"Try a real conference"** (e.g. Urban Tree Summit), then **Find speakers**. A full search takes about 1–2.5 minutes and costs about $0.03 in gpt-6-luna tokens. Choose fewer categories for a faster search.

Other ways to run things:
- API only: `cd backend && ../.venv/bin/uvicorn main:app --port 8000`, then open http://localhost:8000/docs
- One search in the terminal: `.venv/bin/python backend/cli.py --example trees` (examples: `ybec`, `philanthropy`, `trees`)
- Safety tests (no tokens): `.venv/bin/python -m pytest tests/test_safety.py -v`
- Live prompt-injection demo (about 45k tokens): `.venv/bin/python tests/demo_injection.py`

## What it does

| Feature | |
|---|---|
| **Speaker search** | Brief form → Scout Lead plans → **6 category searchers + 6 verifiers in parallel** → code checks → 1–5 verified speakers per category, each with title, location, topic tags, a "could speak on" line, past talks, credentials, profile links, photo (only from their own profile page), level (rising / established / headliner) and best role (keynote / panelist / moderator / workshop) |
| **Panel Architect** | Suggests 2–3 cross-discipline panels per search (theme question, why they work together, where they'd differ, moderator, shared-stage history). Reviews any panel you build and suggests who's missing. |
| **Conferences** | Each conference has its own searches, shortlist, keynote group and panels |
| **Shortlist** | Tabs for Keynote and named panels, drag-and-drop, session date/time/room, **outreach status**, follow-up dates, owner, outreach log, confirmed-speaker checklist, notes. "At a glance" table, copy and CSV export. |
| **Team accounts** | One login per planning team (shared by teammates), each team's work kept separate, a "What's new" feed showing who added which speakers and who updated outreach |
| **Planning tab + chat** | Per-speaker planning: drafted invitation emails (**drafts only, never sent**) and an "Ask about this speaker" chat with sourced answers you can save to notes |

## How it's kept safe and cheap

- **No made-up speakers:** every link on a card must be a page actually seen during the search (checked in code), every person needs a profile or work page, and weak titles and LinkedIn-only matches are dropped.
- **Prompt injection:** web text is treated as data, agents have no tools that act, and anyone whose source page tries to instruct the AI is dropped. Tested with a planted page.
- **Privacy:** email addresses and phone numbers are scrubbed in code. **The app cannot send email.**
- **Cost:** gpt-6-luna only (enforced); about 53% of input tokens are cached; capped searches; 25 searches per day; free reloads.

Details: [docs/safety.md](docs/safety.md), [docs/tokenomics.md](docs/tokenomics.md).

## Repo layout

| Path | What it is |
|---|---|
| `backend/` | FastAPI app (`main.py`), the agent team (`agents.py`), tools and web safety (`tools.py`), code checks (`guards.py`), storage (`store.py`), audit trail (`audit.py`), settings (`config.py`), one prompt per agent in `prompts/` |
| `frontend/` | React + Vite + TypeScript site (HW4 Yale look): `src/pages`, `src/components`, `src/lib` |
| `docs/` | [harness](docs/harness.md) (start here), [agents](docs/agents.md), [tools](docs/tools.md), [safety](docs/safety.md), [tokenomics](docs/tokenomics.md), [design](docs/design.md), [impact](docs/impact.md), [conference research](docs/conference_research.md) |
| `output/` | Evidence from real runs: `audit_trail.jsonl` (every model call), `runs/` (every search), `official/` (the 3 official runs), `tokenomics.json`, `safety/`, `safety_tests.txt` |
| `tests/` | `test_safety.py` (20 tests), `demo_injection.py`, `injection_pages/` (the planted page), `spike_web_search.py` |
| `submission/` | `report.html` and `slides.html` |
| `data/` | Local SQLite database (created on first run, git-ignored) |
| `AI_prompts.md` | Every prompt used to build this |
| `PLAN.md` | Build plan and decisions |
