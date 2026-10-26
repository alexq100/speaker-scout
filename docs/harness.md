# Speaker Scout Harness

The complete guide to how the app works: the one place to start. Each part has its own file:

| Doc | What it covers | Report section it feeds |
|---|---|---|
| [agents.md](agents.md) | The three agent roles, their prompts, how they hand work to each other, the diagram, and the model choice | 4. The agents |
| [tools.md](tools.md) | Every tool, which agent may use it, and the rules each tool enforces | 4. The agents |
| [safety.md](safety.md) | Risks, the defenses we built, and proof that each one works | 6. Safety |
| [tokenomics.md](tokenomics.md) | Measured tokens per run, cost per run, user and scale, and cost cutting | 5. Tokenomics |
| [design.md](design.md) | The look and feel (HW4 Yale style), layout decisions, and why | Look + feel |
| [impact.md](impact.md) | The problem, competitors, real-user evidence, and impact numbers with sources | 2, 3, 7 |
| [conference_research.md](conference_research.md) | Who real conferences book, and what that means for the Scout | 2, 7 |

## How a search runs (overview)

1. A planner types topic ideas on the site → `POST /api/searches`.
2. **Scout Lead** turns the topics into a search plan with angles for each category.
3. **Category Searchers** (one per category, run at the same time) use live `web_search` to find candidates with sources.
4. The **Verifier** confirms each person against their sources, drops anyone it can't confirm, and merges duplicates.
4b. The **Panel Architect** proposes 2–3 cross-discipline panels from the verified people (no web search), and code checks every member.
5. The site shows sectioned speaker cards. Every model call and its token counts are written to `output/audit_trail.json`.

## Backend files

| File | What it does |
|---|---|
| `backend/config.py` | Model lock (gpt-6-luna only), `.env` lookup (project folder, then one level up), paths, and every limit below |
| `backend/models.py` | Data shapes: `SearchBrief` (form), `SearchPlan`, `Candidate`, `SpeakerCard`, `VerifierOutput`, `SearchResult`, `UsageTotals`, `Removal`, `ProgressEvent` |
| `backend/agents.py` | `SpeakerScout`: builds the 3 agent roles and runs the pipeline, with plain-English progress events |
| `backend/tools.py` | `fetch_page`, `wiki_lookup`, URL safety, and the `RunTrace` of every page actually seen |
| `backend/guards.py` | Code checks on agent output (invented links, photos, contact info, skip list, duplicates, top N) |
| `backend/audit.py` | Audit trail (`output/audit_trail.jsonl`), token totals, cost, and web-search source collection |
| `backend/examples.py` | Example briefs: YBEC, Yale Philanthropy, Urban Tree Summit |
| `backend/cli.py` | Run a search from the terminal: `.venv/bin/python backend/cli.py --example ybec` |
| `backend/store.py` | SQLite: saved searches (free reloads) and the shortlist |
| `backend/main.py` | FastAPI routes (below) |
| `start.sh` | One command: first-run setup, then API + website, Ctrl+C stops both |
| `backend/prompts/` | `shared_rules.md` (all agents, comes first so it can be cached), `scout_lead.md`, `searcher.md`, `verifier.md`, `panel_architect.md`, `panel_reviewer.md`, `email_writer.md`, `speaker_chat.md` |

## Backend routes (`backend/main.py`, FastAPI on port 8000)

| Route | What it does |
|---|---|
| `GET /api/conferences` | Conferences (the main buckets) with counts of searches, saved people and panels |
| `POST /api/conferences` `{name}` | Creates a conference (with its own Keynote group) |
| `PATCH /api/conferences/{id}` `{name}` | Renames it |
| `DELETE /api/conferences/{id}` | Deletes it with its searches, shortlist and panels (refused for the last one, or while one of its searches runs). Full results stay in `output/runs/`. |
| `PATCH /api/shortlist/{id}/outreach` `{status?, notes?}` | Outreach tracking: status (`not_contacted`, `reached_out`, `following_up`, `in_conversation`, `confirmed`, `declined`) and notes. Records the first-contacted date, and keeps outreach info when a panel moves to a conference where the person is already saved. |
| `PATCH /api/shortlist/{id}/planning` | Owner, next follow-up date (YYYY-MM-DD), fee, travel, confirmed checklist (6 known keys), `clear_draft` |
| `GET` / `POST /api/shortlist/{id}/log` `{text}` | The outreach log (status changes + dated notes), and adding a note (updates the last-outreach date) |
| `POST /api/shortlist/{id}/draft-email` `{sender_name, notes}` | The Email Writer agent drafts an invitation (about 1.7k tokens, about 5s). **Draft only; nothing is ever sent.** |
| `POST /api/speaker-chat` `{search_id, category, name, question, history}` | Speaker Chat: a sourced answer about one speaker (card loaded on the server; up to 2 web searches) |
| `GET` / `POST /api/shortlist/{id}/notes`, `DELETE /api/notes/{id}` | Speaker notes (`origin` = chat or manual, plus the question and sources) |
| `POST /api/groups/{id}/move` `{conference_id}` | Moves a panel and its people (with notes) to another conference; people already saved there are reused, not duplicated. Keynote groups can't be moved (409). |
| `POST /api/searches/{id}/move` `{conference_id}` | Files a saved search under another conference |
| `GET /api/searches/{id}/conference` | Which conference a search belongs to |
| `GET /api/health` | Is the API up, is the key set, and is a search running? |
| `GET /api/options` | Categories, the 3 example briefs, limits (for the form) |
| `POST /api/searches` `{brief, force?}` | Starts a search in the background and returns `{id, reused}`. The same brief within 7 days returns the saved result **for free** (`reused: true`) unless `force`. |
| `GET /api/searches` | Saved searches, newest first, with speakers found, time and tokens |
| `GET /api/searches/{id}` | One search. **While it runs:** live progress events and categories as they finish. **When done:** the full result (cards, drops, removals, injection flags, tokens). |
| `POST /api/searches/{id}/stop` | Stops a running search (stops spending tokens). Saved as `stopped`. |
| `POST /api/searches/{id}/panels` | (Re)runs the Panel Architect on a finished search (no web; about 3–6k tokens) |
| `POST /api/searches/{id}/panels/{i}/save` | Turns suggested panel *i* into a Shortlist panel (name = title, theme = question, members + moderator added, angles as notes) |
| `GET /api/shortlist` | The team's shortlist (card snapshot + note) |
| `POST /api/shortlist` `{search_id, category, name}` | Adds a speaker. **The card is copied from the saved search, never from the request**, so a fake card can't be added. |
| `PATCH /api/shortlist/{id}` `{note}` | Edits the note (500 characters max) |
| `DELETE /api/shortlist/{id}` | Removes a speaker |
| `POST /api/shortlist/{id}/move` `{group_id \| null}` | Puts a speaker in a panel or the keynote group (null means Unsorted) |
| `GET /api/groups` | The Keynote speakers group plus named panels, with counts |
| `POST /api/groups` `{name, theme?}` | Creates a panel |
| `PATCH /api/groups/{id}` `{name?, theme?, session_date?, session_time?, session_room?}` | Renames a group, sets the panel theme, or sets the session details |
| `POST /api/groups/{id}/review` | Panel Architect feedback on a panel, with suggestions from the shortlist and past searches only (saved on the group) |
| `DELETE /api/groups/{id}` | Deletes a panel; its people go back to Unsorted. The keynote group is protected (409). |
| `POST /api/reset` `{confirm: "start over"}` | Clears saved searches and the shortlist. Requires the exact phrase, and is refused while a search runs. |

Interactive docs: `http://localhost:8000/docs`. Storage: `backend/store.py` → `data/scout.db` (SQLite, git-ignored). Tables: `conferences`; `searches`, `groups` and `shortlist`, each with a `conference_id`. The shortlist is unique per (conference, name, category), so the same person can be saved for two conferences. Searches, shortlist and groups routes take `?conference_id=` (or `conference_id` in the body); without it they use the first conference. Moving a person into a group from another conference is refused. A search's reuse-for-free check is per conference. Older databases get the new column and the default Keynote group automatically.

**API test (Oct 25):**
- Health and options ✓
- A theme over 200 characters is rejected (422) ✓
- Reset without the phrase is refused ✓
- A one-category moderator search found 4 journalists in 50s (54k input, 25k cached) ✓
- A second search while one runs is refused (409) ✓
- The same brief with different spacing and case reused the saved result ✓
- Shortlist add, note, list and remove ✓
- Adding a fake person is refused (404) ✓
- Stop mid-search gives `stopped` ✓
- Reset ✓
- `./start.sh` starts the API, and a second copy is refused because the port is taken ✓

## Website (`frontend/`)

React + Vite + TypeScript on port 5173, proxying `/api` to the backend. Pages:
- **Find speakers** (brief form)
- **Search**: live progress, then results with a speaker drawer and the checks panel
- **Shortlist**: notes, copy, CSV
- **Past searches**
- **How it works**
- **Shortlist at a glance** (`/at-a-glance`): a printable table of every keynote and panel in the current conference

See `docs/design.md`.

## Limits (`backend/config.py`)

| Setting | Value | Why |
|---|---|---|
| `REASONING_EFFORT` | low | search-and-summarize, not puzzles |
| `MAX_OUTPUT_TOKENS` | 8,000 per response | includes reasoning |
| `SEARCHER_MAX_WEB_SEARCHES` / context | 4 calls / low | built-in search is the biggest token cost |
| `VERIFIER_MAX_WEB_SEARCHES` | 4 | finding a missing profile page, or when a site blocks `fetch_page` |
| `SEARCHER_REQUEST_LIMIT` / `VERIFIER_REQUEST_LIMIT` | 4 / 8 model calls | stops runaway loops |
| `VERIFIER_TOOL_CALL_LIMIT` | 20 | page reads per category |
| `AGENT_TOKEN_LIMIT` | 150,000 per agent run | one agent can't burn the budget |
| `SEARCH_TOKEN_LIMIT` | 900,000 per search | checked before each Verifier starts |
| `MAX_SEARCHES_PER_DAY` | 25 | daily cap on new searches (reloads don't count) |
| `REUSE_DAYS` | 7 | the same brief reloads for free |
| `CANDIDATES_PER_CATEGORY` / shown | aim 3+, up to 6 found / **1–5 shown** | rich categories show more; thin ones are fine |
| `MIN_FIT_TO_SHOW` | 3 | weak fits hidden unless a category would be empty |
| `MAX_LINKS` | 4 | profile first, then work, then talks |
| `PAGE_CHAR_LIMIT` / timeout / size / redirects | 4,000 chars / 10s / 2 MB / 3 | keeps page reads cheap and safe |

## Audit trail (`output/audit_trail.jsonl`)

One JSON line per event:
- `search_start`: the brief and limits
- `model_response`: agent, category, model requested vs. reported, input / cached / output / reasoning tokens, web searches, tool calls with arguments
- `search_end`: status, time, totals, how many shown and dropped per category, removals, injection flags

Each search's full result (cards, drops, removals, progress events) is saved to `output/runs/<id>.json`.

## How to run

See the [README](../README.md).
