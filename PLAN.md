# Final Project Plan: Speaker Scout

**A speaker search tool for conference planning teams**, built first for the Yale conference teams Alex works with. Planners fill in a short brief (theme, keynote or panel, location, budget…), and a team of AI agents searches the live internet, verifies every person against real sources, and returns sectioned cards of real people who could speak. Other planning tools come later, only if they make sense and there's time.

Last updated: Oct 25, 2026 · **Due Mon Oct 26, 2026, 6:00 PM on Canvas**

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Who uses it | Conference planning teams (an internal tool). **No attendee site.** |
| What it is | **Primarily a speaker search tool.** Other features (balanced panel builder, then maybe timeline or budget) come after the core works. |
| Model | **gpt-6-luna** through Portkey, for every agent. It's the only model on the course key; the app refuses to start with anything else. |
| Where people come from | **The live internet.** No seeded speaker data. gpt-6-luna's built-in `web_search` was tested and works (§9). |
| Truth rule | **Only real people found on a real page during this search.** Enforced in the prompts *and* in code. |
| Agent team | **Scout Lead → 6 × (Category Searcher → Category Verifier), running side by side** → plain Python merges duplicates and keeps the top 3 per category |
| Categories (6) | Academics & Researchers · Practitioners · Policy & Government · Founders & Industry · Advocates & Community · **Journalists & Communicators** |
| How many | **1–5 confirmed people per category.** Searchers aim for at least 3 and up to 6; rich categories (like policy for YBEC) can show 5, thin ones 1–2 (decided Oct 25 after test runs) |
| Card builder | **No separate agent.** Each Verifier confirms *and* writes the cards, since it already has the facts (a separate builder would roughly double the tokens). |
| Speaker levels | **Rising voice · Established expert · Headliner**, and **best suited for: Keynote · Panelist · Moderator · Workshop leader** |
| Input | A **fill-in-the-blank brief** (§3): 3 main questions plus "More options" |
| Look and feel | **HW4 Campus Customs Yale look:** white page, Yale Blue, serif headings, a grid of clean cards |
| Safety and cost | Designed in from the start (§6, §7) and documented in `docs/harness.md` and `docs/safety.md` |
| Test topics | Alex's three real conferences (YBEC, Yale Philanthropy, Urban Tree Summit). We compare the app's picks with who those conferences actually booked. |
| Run mode | Local first (`./start.sh`), then push to GitHub. We make the repo when it's time. |
| MCP | **Optional.** The tools live in `backend/tools.py`. A thin `mcp_server/server.py` that offers the same functions for smoke tests is a nice-to-have, not something the app depends on. |

## 2. Course rules that shape the build

| Rule | What it means for us |
|---|---|
| Deliverables | GitHub repo (public, or private with `zlisto` added), `report.html` (10–15 printed pages, 8 sections in order), `slides.html` (reveal.js, 10 slides max). A 2–3 minute demo video is optional but cheap insurance. |
| Keys | Only `PORTKEY_API_KEY` / `OPENAI_API_KEY`. **No other API keys**, so web search goes through gpt-6-luna's own tool. |
| `.env` | Look in the repo folder first, then one level up. Ship `.env.example`. |
| 10-minute rule | Staff must get it running from a fresh clone in 10 minutes: one venv, `pip install`, `npm install`, `./start.sh`. |
| Overdone ideas | Generic event planners are close to "travel planner". **Speaker Scout is the twist:** verified, cross-sector speaker discovery for real conferences. |
| Evidence | Each report row without its evidence gets **at most half** the points (§10). |

## 3. The search brief (input form)

Three main questions up front; everything else under **"More options"** with sensible defaults. Structured fields give better searches, fewer tokens, and less room for prompt injection.

**Main questions**
1. **Conference theme** (text, required)
2. **What are you looking for?** Keynote speaker · Panel · Moderator · Workshop leader · Open to anything
3. **If Panel:** the panel theme (under the conference theme) and the panel size (3 or 4)

**More options**

| Field | Choices | How the agents use it |
|---|---|---|
| Conference type / audience | Business · Academic · Practitioner · Philanthropy & nonprofit · Policy · Community · Student-led | Picks the search angles |
| Location | City or region, plus reach: Local · Regional · National · Global · Virtual is fine | Leans searches toward nearby people. "Virtual is fine" removes the limit. |
| Speaker budget | No fee / volunteer · Small · Medium · Large | Steers the speaker level only. We can't know real fees. |
| Speaker level | Rising voice · Established expert · Headliner · Mix | Filled in automatically from role and budget, and can be changed |
| Categories | The 6 checkboxes, all on | Unchecked categories are skipped, which saves tokens |
| Prioritize | Has spoken before (on by default) · Ties to Yale / New Haven · Early-career voices · A range of perspectives | Ranking guidance |
| Already booked / skip | Names | Kept out of the results |
| Anything else? | Free text, 300 characters max | Passed to the Scout Lead and labeled as the planner's notes |

**Try an example** buttons fill the form with YBEC, Yale Philanthropy, and the Urban Tree Summit.

**Keynote vs. panel:**
- **Keynote:** look for crossover communicators with big-stage speaking history, books, or major media.
- **Panel:** the topic becomes the panel theme. Look for people whose work touches it from different angles, so they'd make an interesting conversation together (the YBEC model).

**Fairness rule:** "A range of perspectives" means a mix of sectors, career stages, places, and kinds of organizations. **Agents never guess anyone's race, gender, or other personal traits.**

## 4. The agent team (all gpt-6-luna, built with PydanticAI)

```
                Search brief (form)
                        │
                 ┌──────▼──────┐
                 │ Scout Lead  │  plans 2–3 search angles per category (no web, cheap)
                 └──────┬──────┘
   ┌─────────┬──────────┼──────────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼          ▼          ▼
Academics Practitioners Policy  Founders  Advocates  Journalists   ← 6 Searchers in parallel (web_search, ~5 candidates each)
   │         │          │          │          │          │
   ▼         ▼          ▼          ▼          ▼          ▼
Verifier  Verifier   Verifier   Verifier   Verifier   Verifier     ← 6 Verifiers in parallel; each starts when its searcher finishes
   └─────────┴──────────┼──────────┴──────────┴──────────┘
                        ▼
      Python: source-link check, merge duplicates, top 3 per category
                        ▼
                Sectioned speaker cards
```

| Agent | Job | Tools | Output |
|---|---|---|---|
| **Scout Lead** | Turns the brief into a search plan: 2–3 angles per category, the target level and role, location focus, and names to skip | none | `SearchPlan` |
| **Category Searcher** ×6 | Finds about 5 real people for its category, **gathering most card details as it searches** (title, credentials, past talks, links, profile page) | `web_search` (low search context, at most ~3 searches) | `Candidate[]` with source URLs |
| **Category Verifier** ×6 | Confirms each person really holds that role on a real page, drops anyone it can't confirm (with a reason), flags injection attempts, writes the final cards, and ranks them | `fetch_page` (main tool, cheap), `wiki_lookup`, `web_search` (at most 1, only when a site blocks page reading) | `SpeakerCard[]` + `Dropped[]` |

About 13 model calls per search, mostly running at the same time. Expected time is about 1.5–2 minutes. We chose trustworthy over fast.

## 5. The speaker card

**On the card (HW4 product-card style)**
- Category label (ACADEMIC, PRACTITIONER, POLICY, FOUNDER, ADVOCATE, JOURNALIST)
- Photo: **only from a credible page that is clearly that person's profile** (university, organization, government page, or Wikipedia). Otherwise their initials in a Yale Blue circle. Never generated.
- **Name**, then **job title and organization**
- **Level badge:** Rising voice / Established expert / Headliner
- **Best suited for:** Keynote / Panelist / Moderator / Workshop leader
- **Speaking badge:** Experienced speaker / Some speaking found / None found
- A "Could speak on…" line tied to the brief, plus topic tags
- Verified ✓ and the number of sources

**Details view (like HW4's product page)**
- Short bio, plus **credentials and certifications** (PhD, MD/MPH, PE, ISA Certified Arborist, AICP, books, awards)
- Why they fit this conference or panel
- 2–4 talk ideas
- **Has spoken before:** 1–3 past talks, panels, lectures, podcasts, or articles (event, year, link)
- Notable work
- **2–4 typed links: the profile page always first**, then work about them (articles, interviews, podcasts), then places they've spoken. **Every card must have a profile or work page**, not just event listings (enforced in code).
- Fit score (1–5) with a one-line reason
- **Add to shortlist**

**Never shown:** personal emails, phone numbers, home addresses, or personal life.

## 6. Safety (built into the agents and written up in `docs/harness.md` and `docs/safety.md`)

| Risk | Defense (built) | Proof for the report |
|---|---|---|
| **Made-up people or claims** | Prompts require real pages. **The code checks** that every link on a card actually came back from a search or page read in this run; invented links are removed, and a person left with no real source is dropped. Drops are kept with reasons. | Screenshot of the "removed: couldn't verify" list, plus a test |
| **Prompt injection from web pages** | Page text is wrapped and labeled as untrusted data. Agents have **no tools that act** (no email, saving, or payments). Verifiers flag injection attempts and the site shows them. | A planted test page in `tests/injection_pages/`, plus a screenshot and test |
| **Injection from the user's notes** | Dropdowns for most fields; free text has length limits and is labeled as the planner's notes | Test |
| **Privacy** | Public professional info only. **Code removes anything that looks like an email address or phone number** from cards. | Test |
| **Web safety (reaching local or private addresses)** | `fetch_page` only opens public http/https, blocks local and private network addresses, and has size and time limits. A test-mode switch allows the planted demo page. | Test |
| **Fairness** | Never guess race, gender, or other personal traits. A range of perspectives means sectors, career stages, places, and kinds of organizations. | Prompt rule + doc |
| **Overspending / loops** | Model lock; caps on searches per agent, tokens per search, and topic length; one search at a time; a fixed order of work (no free delegation, so no loops). Token use is shown on the page. | Test + audit trail |
| **Defamation / gossip** | Professional facts only, each with a source | Prompt rule |

Real example from Step 2: OpenAlex's API reply contained text telling AI agents to sign up for a key. We ignored it, which shows why web text must be treated as data.

## 7. Token efficiency

1. Searchers gather card details while they search, so Verifiers confirm instead of searching again.
2. Verifiers read pages with our own `fetch_page`, which cuts each page to about 4,000 characters. Built-in search can bring in 20–45k tokens at a time.
3. Searchers use low search context and **at most about 3 searches**. Verifiers do at most 1 search, only as a fallback.
4. **The shared part of each prompt comes first and is identical across the six copies**, so the repeated text counts as cached input (measured for the report).
5. Reasoning effort is low/medium; outputs are short and structured.
6. Unchecked categories are skipped.
7. **Saved searches reload from SQLite for free.**
8. Duplicates are merged in Python (no tokens), and there's a hard token cap per search.
9. **The site shows each search's tokens and cost**, and every call is logged in `output/audit_trail.json`.

## 8. Build order

| # | Step | Done when |
|---|---|---|
| 1 | Vision + plan ✅ | This document |
| 2 | Web search test ✅ | gpt-6-luna `web_search` works through Portkey (§9) |
| 3 | Folder structure ✅ | `backend/ mcp_server/ frontend/ data/ docs/ output/ tests/ submission/` plus docs stubs |
| 4 | ✅ **Backend agent team:** `models.py`, `tools.py`, `prompts/`, `agents.py`, `audit.py`, `cli.py` | `cli.py` on one real brief returns verified, sourced people in all 6 categories, with drops, tokens, and time |
| 5 | ✅ **Safety tests:** injection page, made-up-link removal, contact-info removal, private-address block | `tests/test_safety.py` passes |
| 6 | ✅ **API:** `main.py` (FastAPI) + `store.py` + `start.sh` | Start a search, watch progress, get results, shortlist, reset. Tested with curl. |
| 7 | ✅ **Frontend:** React + Vite + TypeScript, HW4 look | Brief form → live progress → sectioned cards → details → shortlist. A newcomer can use it. |
| 8 | ✅ Official runs on the 3 real conferences + tokenomics | Measured numbers and screenshots in `output/` |
| 9 | ✅ Extras (panel builder, conferences, outreach, chat): **Build a balanced panel** (first), MCP wrapper, others | Each works end to end, or is left out |
| 10 | ✅ Fresh-clone check + GitHub (github.com/alexq100/speaker-scout) | Running in under 10 minutes with `.env` one folder up |
| 11 | `report.html` | 8 sections, 10–15 pages, images embedded |
| 12 | `slides.html` | reveal.js, 10 slides, images embedded |
| 13 | Optional demo video + real-user test | A Yale teammate tries it (quote + before/after time) |

**Tonight:** steps 4–7. **Tomorrow before 6 PM:** steps 8–13.

## 9. Step 2 results: web search (Oct 25)

| Test | Result |
|---|---|
| gpt-6-luna + `web_search` through Portkey | ✅ Found real city resilience officers (Austin, Philadelphia, Atlantic Council) with source links. The model reported `gpt-6-luna-global`. |
| `web_search_preview` | ✅ Also works, and was faster (22s vs 40s) |
| Are the sources real? | ✅ The Austin page names the person. ⚠️ Some government sites (miami.gov) block scripted fetches (403), so the Verifier falls back to one `web_search`. |
| Cost signal | About 24k–46k input tokens and 1.2k–1.7k output tokens per search call |
| PydanticAI | v2.56 has a built-in `WebSearchTool` with `max_uses` and `search_context_size` |
| OpenAlex | Works, but its free budget with no key is small and shared, so it's optional |
| Wikipedia REST | ✅ No key needed; gives a description and a photo |

## 10. Tier 3 checklist

Tier 3 means "It makes a difference": a very clever idea that clearly helps real people, **backed by evidence**.

| Points | What earns the top | Our plan | Where it lives |
|---|---|---|---|
| **Idea 21** | New, real problem, usable | Verified, cross-sector speaker discovery for real Yale conferences | `docs/impact.md` |
| **It works 15** | Real tools and data, end to end, no crashes, clean repo, no secrets | Live web search, verified cards, shortlist; `.env` git-ignored | app + repo |
| **Staff can run 5** | Fresh clone in under 10 minutes | `./start.sh` installs everything the first time; dry run in step 10 | `README.md` |
| **Look + feel 10** | Clean, a newcomer can use it | HW4 Yale look, one main button, plain-English progress | `docs/design.md` |
| **Motivation + new 8** | Real person behind the problem; **named competitors** | Alex + the Yale teams; compare LinkedIn, Google, speaker bureaus (BigSpeak, Leading Authorities, AllAmericanSpeakers), ChatGPT | `docs/impact.md` |
| **Agent design 10** | Agents, tools, diagram; **a real run traced with screenshots** | The site shows each agent's steps live; screenshots from the official runs | `docs/agents.md` |
| **Tokenomics 8** | Per run, per user, at scale, cost cuts; **real counts (the app can show its own)** | Audit trail with input, cached input, and output; tokens and cost shown on the site | `docs/tokenomics.md` |
| **Safety 8** | **A defense shown working** | Injection page + made-up-link removal, shown on screen and in tests | `docs/safety.md` |
| **Impact 5** | Sourced numbers; **a real user tried it** | A Yale teammate tries it; compare the app's picks with the 3 conferences' real lineups; time vs. a manual search | `docs/impact.md` |
| **Report design 2 / Slides 8** | Clean, sharp, the whole story | Same Yale style | `submission/` |

Course tips: start with a person, talk to a real user, **screenshot as you go**, and ship something that works before making it clever.

## 11. Look and feel (from HW4)

- **Colors:** Yale Blue `#00356b`, Intensity Blue `#286dc0`, Yale Gray `#978d85`, white page, light gray panels, plus a small green accent for "verified"
- **Type:** Libre Baskerville for headings, Open Sans for body text
- **Layout:** top bar (name + tabs: Speaker Scout, Shortlist) → the brief form as the hero → a plain-English progress feed → category sections of cards in a 3-column grid → a details view
- **HW5 lessons:** one main button per page, always say what to do next, keep it uncluttered

## 12. Folder structure

```
final_project/
├── README.md  AI_prompts.md  PLAN.md  .env.example  .gitignore  requirements.txt  start.sh
├── backend/      main.py  agents.py  tools.py  models.py  audit.py  cli.py  prompts/
├── mcp_server/   server.py (optional wrapper for smoke tests)
├── frontend/     React + Vite + TS
├── data/         SQLite: saved searches + shortlist (created on first run, git-ignored)
├── docs/         harness, agents, tools, safety, tokenomics, design, impact, conference_research
├── output/       audit_trail.json, runs/, tokenomics.json, screenshots/
├── tests/        spike_web_search.py, test_safety.py, injection_pages/
└── submission/   report.html, slides.html
```

See also: [docs/conference_research.md](docs/conference_research.md) for who real conferences book and why it shaped these choices.
