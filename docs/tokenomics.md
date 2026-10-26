# Tokenomics

All numbers come from **real runs**. `output/audit_trail.jsonl` has one line per model call (agent, model, input / cached input / output tokens, web searches). `output/official/official_runs.json` and `output/tokenomics.json` hold the totals. Script: `output/official/tokenomics.py`.

**Prices (gpt-6-luna, per 1M tokens, from MGT 409 Lecture 11):** input $0.10 · cached input $0.01 · cache write $0.125 · output $0.50.

## Official runs (Oct 26, 2026): Alex's three real conferences, fresh full searches

| Conference brief | Speakers verified | Dropped | Time | Model calls | Input tokens | Cached input | Output | Web searches* | **Token cost** |
|---|---|---|---|---|---|---|---|---|---|
| YBEC: circularity panel (`fa7a94541e`) | 19 | 3 | 146.9s | 28 | 398,697 | 203,368 (51%) | 20,421 | 64 | **$0.032** |
| Yale Philanthropy: keynote (`e2b6c3e7a5`) | 16 | 1 | 62.2s | 28 | 401,571 | 219,617 (55%) | 18,517 | 57 | **$0.030** |
| Urban Tree Summit: panel (`35e14ff0f8`) | 10 | 2 | 64.7s | 25 | 362,794 | 188,639 (52%) | 14,274 | 46 | **$0.026** |
| **Average** | **15** | 2 | **91s** | 27 | **387,687** | **203,875 (53%)** | **17,737** | 56 | **$0.029** |

\*`web_search_requests` reported by the provider (search queries; one search call can run several queries).

**Per verified speaker:** about **$0.002** in tokens.

### Where the tokens go (average official run)

| Agent | Calls | Input tokens | Output tokens | Share of cost |
|---|---|---|---|---|
| Scout Lead | 1 | about 1.4k | about 0.5k | about 1% |
| 6 Category Searchers | 6 | about 162k | about 5.2k | about 40% |
| 6 Category Verifiers | 17–20 | about 219k | about 11.3k | about 56% |
| Panel Architect | 1 | about 4.7k | about 0.8k | about 3% |

The Verifiers cost the most because they read each person's pages. That's the price of the "no made-up speakers" guarantee, and we chose it on purpose.

### Other features (measured in testing)

| Feature | Tokens | Cost |
|---|---|---|
| Panel Architect review of a Shortlist panel | about 9.3k | about $0.0013 |
| Speaker chat question | about 15k (0–3 searches) | about $0.002 |
| Drafted invitation email | about 1.7k | about $0.0004 |

## Cost per planner per month, and at scale

Assumed use per active planner during planning season: **12 searches, 40 chat questions, 20 email drafts, 8 panel reviews** a month.

| | Tokens only | If web search is billed per query ($10 / 1,000)** |
|---|---|---|
| **Per planner per month** | **$0.44** | $7.52 |
| **100 planners** | **$44 / month** | $752 / month |
| **10,000 planners** | **$4,360 / month** | $75,160 / month |

\*\*Assumption: OpenAI's published web-search tool fee, counted per query (an upper bound). Whether the course key bills this separately is unknown. On the token side the app is very cheap. **Web search is the cost to watch at scale**, which is why searches per agent are capped.

For context, a single speaker bureau search or a few hours of a planner's time (see `docs/impact.md`) costs far more than a month of Speaker Scout.

## What we did to keep cost down

1. **A shared, cacheable prompt prefix:** the shared rules come first and are identical in every agent, and the brief is identical across all calls in a search. Result: **53% of input tokens are cached**, saving about **$0.018 per search** (39% of token cost).
2. **The Verifier reads pages with our own `fetch_page`,** cut to 4,000 characters focused on the person, instead of re-running built-in search, which pulls in 20–45k tokens of results at a time.
3. **Capped web searches** (4 calls per searcher, 2 per verifier, 2 per chat question), **low search context**, and **low reasoning effort**.
4. **Short structured outputs only.**
5. **Duplicates, skip list, ranking and shared-stage detection run in plain Python at zero tokens.**
6. **Free reloads:** the same brief in the same conference within 7 days reloads the saved result. Past searches reopen for free.
7. **Panel suggestions, reviews and emails reuse the verified cards,** with no new web search. That's 1–3% of a search's cost.
8. **Spending guards:** a 25-searches-per-day cap, one search at a time, and token caps per agent and per search.

## Did cost cutting hurt quality? (Evidence from the tuning runs, Oct 25)

| Version | Input tokens | Speakers shown | Quality |
|---|---|---|---|
| Cheapest (`370be78406`) | 246k | 14 | 1 bad title ("Presenter; affiliation listed…"), founders linked only to a shared speaker grid, 3 of 14 photos |
| Strict, without letting the Verifier search (`42389f993a`) | 321k | 11 | Too strict: 0 policy people, well-known founders dropped |
| **Final (`b8e34fa14b`)** | **405k** | **16** | Profile link first on almost every card, "experienced" speaking badge on most, 8 of 16 photos |

**Yes, the cheapest version was worse,** so we spent more tokens (about +65%), but only where it bought trust: finding each person's profile page. We kept every saving that didn't hurt quality: caching, focused page reads, low reasoning, and Python for ranking. Even after that increase a search costs about **3 cents**.

**Caching note:** one test (`ef7315745a`) finished in 17.5s because its searcher calls were word-for-word repeats of the previous run. It looks like Portkey answered those from its cache. The official runs used fresh briefs.
