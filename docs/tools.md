# Tools

Code: `backend/tools.py` (agent tools + run trace) and `backend/guards.py` (code checks on the output).

| Tool | Where | Used by | What it does | Rules it enforces |
|---|---|---|---|---|
| `web_search` | Built into gpt-6-luna (PydanticAI `WebSearch` capability) | Searchers; Verifiers (fallback) | Live search of the whole web. Every source URL it returns is recorded in the run trace. | Low search context; capped uses (`SEARCHER_MAX_WEB_SEARCHES = 3` calls, `VERIFIER_MAX_WEB_SEARCHES = 1`) |
| `fetch_page(url, person)` | `tools.py` | Verifiers | Reads a public page and returns its title, **the text around the person's name** (max 4,000 characters), and photos on the page whose file name or alt text matches the person | http/https only; blocks local and private network addresses; 10s timeout, 2 MB limit, 3 redirects (each re-checked); text wrapped as `UNTRUSTED PAGE TEXT`; instruction-like text flagged |
| `wiki_lookup(name)` | `tools.py` | Verifiers | Wikipedia summary + photo | Skips disambiguation pages; the summary is labeled untrusted |

## The run trace

`RunTrace` is shared by all agents in one search. It records:
- every URL that came back from web search (`sources`), and every page opened
- every page `fetch_page` read and the images found on it
- Wikipedia pages and photos
- injection warnings

`guards.py` then uses it to reject any link or photo on a card that **was never actually seen** in this search.

## Not used (and why)

- **OpenAlex** (academic papers): its free tier with no key is a tiny daily budget shared per IP address, and the course allows no other keys.
- **MCP server:** optional. The tools are plain Python functions the agents call directly, which keeps the app simple for the 10-minute rule. A thin MCP wrapper for smoke tests may come later.
