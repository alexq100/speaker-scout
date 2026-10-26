# The Agents

All agents use **gpt-6-luna** through Portkey (OpenAI Responses API, built with PydanticAI 2.56). Code: `backend/agents.py`. Prompts: `backend/prompts/`.

## Organization

```
                Search brief (form)
                        │
                 ┌──────▼──────┐
                 │ Scout Lead  │  plans 2–3 search angles per category (no web, cheap)
                 └──────┬──────┘
   ┌─────────┬──────────┼──────────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼          ▼          ▼
Academics Practitioners Policy  Founders  Advocates  Journalists   ← 6 Searchers in parallel (web_search)
   │         │          │          │          │          │
   ▼         ▼          ▼          ▼          ▼          ▼
Verifier  Verifier   Verifier   Verifier   Verifier   Verifier     ← 6 Verifiers; each starts when its searcher finishes
   └─────────┴──────────┼──────────┴──────────┴──────────┘
                        ▼
   guards.py: invented-link check, photo check, contact scrub, skip list, duplicates, top N
                        ▼
                Sectioned speaker cards ──► Panel Architect (no web) ──► guards.check_panels ──► Suggested panels
```

The order of work is **fixed in code**. No agent can call another agent, so the team cannot loop or hand work around forever. A category's Verifier starts as soon as its own Searcher finishes, without waiting for the other five.

## Roles

| Agent | Prompt | Job | Tools | Output (structured) |
|---|---|---|---|---|
| **Scout Lead** | `shared_rules.md` + `scout_lead.md` | Turns the brief into a plan: summary, target level and roles, location focus, and 2–3 search angles per category | none | `SearchPlan` |
| **Category Searcher** (×6, one per category) | `shared_rules.md` + `searcher.md` | Aims for 3+ (up to 6) real people, with at least one search aimed at conference speaker pages so past speaking comes with proof. Only returns people with a page about them specifically. Collects title, credentials, past talks, **profile page** and sources. | built-in `web_search` (low context, capped) | `SearcherOutput` → `Candidate[]` |
| **Panel Architect** (after the verifiers; also on demand) | `shared_rules.md` + `panel_architect.md` | Reads the verified cards (compact) plus the brief and proposes **2–3 cross-discipline panels**: title, central question, 3–4 members from 2+ categories (each with the angle they bring), a suggested moderator, why they work together, where they'd differ, and a balance note | none (no web) | `PanelPlan` → `PanelSuggestion[]` |
| **Category Verifier** (×6) | `shared_rules.md` + `verifier.md` | Reads each candidate's page (all in parallel in its first step), confirms name + real role, **searches for a missing profile page before dropping anyone**, picks a photo only from their own profile, writes the card with typed links (profile → work → talk), and flags prompt injection | `fetch_page`, `wiki_lookup`, `web_search` (max 4: finding profiles, blocked pages) | `VerifierOutput` → `SpeakerCard[]`, `DroppedCandidate[]`, `injection_flags` |

## Why this design

- **A team, not one agent:** a single agent doing all six categories would run one long, growing conversation, which is expensive. It also tends to stop early and drift toward famous academics. Six small searchers running at the same time are faster and give each category real attention.
- **One Verifier per category, and no separate card builder:** the Verifier already has the facts in front of it after reading the pages, so writing the card costs a few hundred output tokens. A separate card-writing agent would re-read everything and roughly double the tokens.
- **Checks in code as well as prompts:** prompts ask for real people, and `guards.py` *makes sure* every link was actually seen during the search (see `safety.md`).

## Model choice

gpt-6-luna is the only model allowed on the course key. Its built-in web search works through Portkey (tested in Step 2), so we need no other API keys. Reasoning effort is set to **low**, since these are search-and-summarize jobs.

## First real runs (Oct 25, 2026)

| Run | Brief | Result | Time | Model calls | Input (cached) | Output |
|---|---|---|---|---|---|---|
| `df320a2f23` | YBEC panel, 2 categories (academic, journalist) | 6 shown, 1 dropped | 35.7s | 8 | 85,469 (36,389) | 4,750 |
| `0b39462742` | **YBEC panel, all 6 categories** | **15 verified speakers**, 2 dropped, 0 code removals | **35.6s** | 22 | 244,270 (117,226) | 12,886 |
| `b8e34fa14b` | **YBEC panel, after tuning** (profile required, 1–5 per category, profile search) | **16 verified speakers** (2/4/3/3/2/2), 1 dropped | 52.5s | 28 | 405,472 (199,999) | 16,642 |

The full YBEC run turned up, among others:
- a Seattle Public Utilities circular economy policy advisor
- the CEO of the Product Stewardship Institute
- founders who spoke at Trellis Impact 25
- J.Crew's VP of Sustainability
- a REGENERATE conference speaker and farmer

I checked the links and photos by hand afterwards: every link loads a real page naming the person (two returned 403 only to scripts), and every photo is a headshot file named after that person.

**Prompt fix found through the website (Oct 25):** a journalists-only moderator search for "The future of philanthropy: trust-based giving and community power" (`a09e290860`) returned **0 people**. The Scout Lead's angles were abstract ("reporters who moderate philanthropy conferences"), and the searcher's queries found no names. We changed both prompts to **name concrete places** (specific publications, organizations, conferences) and to switch to staff pages of the top outlets if early searches find no names. The same brief (`9f31bd7b7b`) then found 3 verified journalists, including the Chronicle of Philanthropy's editor-in-chief and a senior writer, all with past moderating or speaking.

Step-by-step trace with screenshots: the site's "Step-by-step: what each agent did" panel shows every event. Screenshots will be captured during the official runs.


## Panel Architect (Step 9)

- **Input:** the brief, compact versions of the verified cards (name, category, title, level, could-speak-on, talk ideas, tags, past events), and a list of **pairs who already appeared at the same event**. That list is computed in code by matching the cards' speaking links (`guards.shared_stages`) at **zero tokens**.
- **Output checks** (`guards.check_panels`): every member and moderator must be a verified person in this search (anyone else is removed and logged); each panel needs 3+ people from 2+ categories; size is capped at the brief's panel size; shared-stage facts are attached by code, not by the model.
- **Cost:** one call. YBEC used 5,016 input and 815 output tokens (8s); the Urban Tree Summit test used 2,682 input (1,389 cached) and 521 output. A search costs about 100–400k, so panels add about 1–2%.
- **Save as panel:** `POST /api/searches/{id}/panels/{i}/save` creates a Shortlist panel with the title as its name and the question as its theme, adds the members and moderator, and writes each person's angle into their note.

**First results:**
- **YBEC:** "From Farm to Factory: Scaling Regenerative Sourcing" (Nestlé sourcing lead + Truterra president + Rutgers professor, moderated by a circular-economy podcaster), "Circularity by Design—and by Rule", and "The New Feedstock: Recycled, Reused, or Regenerative?". It used the shared-stage signal ("Deborah Dull and Monica Becker both appeared at the Circular Supply Chain Summit").
- **Urban Tree Summit (2 categories, `9785b505f4`):** "From Canopy Maps to Fairer Streets" and "Can Nature Be Prescribed Equitably?". **Dr. Robert Zarr (Park Rx America) and Jamie King (American Forests) are both real 2026 Urban Tree Summit speakers**, which is a good quality signal for the report.


## Panel Architect review (Step 11)

A second Panel Architect mode (`prompts/panel_reviewer.md`, `SpeakerScout.review_panel`, `POST /api/groups/{id}/review`) gives feedback on a panel the planner built on the Shortlist:
- **Input:** the panel's name and theme, its members' compact cards plus planner notes, and a **candidate pool** of up to 70 people from the shortlist (unplaced first) and recent saved searches. Each candidate is marked `on_shortlist` and `already_in_group`.
- **Output (`PanelReview`):** verdict, score 1–5, summary, strengths, concerns, missing angles, up to 4 suggestions (add / swap / moderator), a moderator note, a sharper theme, and a suggested new search when no one in the pool fills a gap.
- **Code checks:** every suggestion must be in the pool and not already on the panel; the code fills in `search_id` and `on_shortlist`. The review is saved on the group (`groups.review_json`).
- **Cost:** about 9k tokens and 13s for a 3-person panel with a full pool, with no web search.
- **Example (Alex's "Water and AI" panel):** "Promising, 3/5". It flagged that the theme is ambiguous (AI's water footprint vs. AI for water management) and that no technical or utility voice is present, suggested a utility AI practitioner from a past search plus Kamini Singha from the shortlist, and proposed a sharper theme.


## Email Writer (Step 13b)

`prompts/email_writer.md`, `SpeakerScout.draft_email`, `POST /api/shortlist/{id}/draft-email`.
- **Input:** the speaker's card (role, could-speak-on, talk ideas, notable work, past talks), the conference name, the session (panel or keynote name, theme, date, time, room), fee and travel, the sender's name, and optional planner notes.
- **Output:** `EmailDraft` (subject + plain-text body, about 150–220 words). It uses only facts from the card. Anything unknown (date, venue, honorarium) becomes a **[placeholder]**, so it never invents logistics, and it never mentions that an AI found the person.
- **Never sends:** there's no email tool anywhere in the app. The planner copies the draft into their own email.
- **Cost:** about 1.7k tokens, about 5–7s.


## Speaker Chat (Step 15)

`prompts/speaker_chat.md`, `SpeakerScout.ask_about`, `POST /api/speaker-chat`.
- **Input:** the speaker's verified card, **loaded on the server from the saved search** (the request only names the person, so nobody can slip in a fake card), today's date, the last 6 turns of the conversation, and the question.
- **Tools:** `web_search` (low context, at most 2 calls), `fetch_page`, `wiki_lookup`. Same rules as the rest of the team: card first, search only if needed, same-person check, web text is data.
- **Output (`ChatAnswer`):** answer, sources, and a short `note` worth saving.
- **Code checks:** sources must be pages actually seen (on the card, or returned or read in this answer); emails and phone numbers are scrubbed; stray inline citation markers are removed.
- **Limits:** 6 model calls, 6 tool calls and 80k tokens per question; one question at a time per speaker.
- **Measured:** a card-only answer took 12s and about 15.5k tokens (0 searches). A "recent news" question took 5s and about 15k tokens (3 searches) and found real 2025–26 Trove news. Emily King: 8s, found her May 2026 Austin Urban Forestry Committee briefing and a 2025 TreeFolks interview.
