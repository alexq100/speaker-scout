"""Settings for Speaker Scout: model, keys, paths, and every safety / cost limit in one place."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parent.parent

# Keys: this project's .env first, then the folder one level up (the course's submissions/.env).
load_dotenv(PROJECT_DIR / ".env")
load_dotenv(PROJECT_DIR.parent / ".env")
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

# ---- Model -------------------------------------------------------------------
# gpt-6-luna is the only model allowed on the course key. Use the plain name:
# prefixed strings like "openai/gpt-6-luna" fall back to gpt-5.6-luna on Portkey.
REQUIRED_MODEL = "gpt-6-luna"
MODEL_NAME = os.environ.get("MODEL", REQUIRED_MODEL)
if MODEL_NAME != REQUIRED_MODEL:
    raise RuntimeError(f"MODEL is {MODEL_NAME!r}, but Speaker Scout only runs on {REQUIRED_MODEL!r}.")
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"


def portkey_api_key() -> str:
    key = os.environ.get("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError(
            "PORTKEY_API_KEY is not set. Copy .env.example to .env (here or one folder up) and add your key."
        )
    return key


# ---- Paths -------------------------------------------------------------------
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DATA_DIR = Path(os.environ.get("SCOUT_DATA_DIR", PROJECT_DIR / "data"))
OUTPUT_DIR = Path(os.environ.get("SCOUT_OUTPUT_DIR", PROJECT_DIR / "output"))
AUDIT_TRAIL = OUTPUT_DIR / "audit_trail.jsonl"
RUNS_DIR = OUTPUT_DIR / "runs"

# ---- Model settings ----------------------------------------------------------
REASONING_EFFORT = "low"          # search-and-summarize jobs, not puzzles
MAX_OUTPUT_TOKENS = 8_000         # per model response (includes reasoning tokens)

# ---- Cost limits ---------------------------------------------------------------
SEARCHER_MAX_WEB_SEARCHES = 4     # web_search calls per searcher run (each call may run a few queries)
SEARCHER_SEARCH_CONTEXT = "low"   # how much page text built-in search pulls in
VERIFIER_MAX_WEB_SEARCHES = 4     # to find a missing profile page, or when a site blocks our page reader
SEARCHER_REQUEST_LIMIT = 4        # model calls per searcher run
VERIFIER_REQUEST_LIMIT = 8        # model calls per verifier run
VERIFIER_TOOL_CALL_LIMIT = 20     # fetch_page + wiki_lookup calls per verifier run
AGENT_TOKEN_LIMIT = 150_000       # tokens per single agent run
SEARCH_TOKEN_LIMIT = 900_000      # tokens per whole search, all agents combined
CANDIDATES_PER_CATEGORY = 6       # searchers aim for 3+ and up to 6; 1-5 confirmed people are shown
MIN_FIT_TO_SHOW = 3               # weaker fits are hidden, unless a category would otherwise be empty
MAX_LINKS = 4

# ---- Page reader limits ----------------------------------------------------------
PAGE_TIMEOUT_SECONDS = 10
PAGE_MAX_BYTES = 2_000_000
PAGE_CHAR_LIMIT = 4_000           # characters of page text handed to the model
PAGE_MAX_REDIRECTS = 3
# Test mode lets fetch_page open pages on this computer (127.0.0.1 / localhost), only for the
# planted prompt-injection demo page. Never on in normal use.
TEST_MODE = os.environ.get("SCOUT_TEST_MODE") == "1"

# ---- Pricing (USD per 1M tokens) -------------------------------------------------
# gpt-6-luna prices from the course (MGT 409 Lecture 11, citing OpenAI's pricing page). Override in .env if
# they change. Web search calls may also be billed per call by the provider; that's set separately
# (PRICE_WEB_SEARCH_PER_K, per 1,000 calls) and left out of the on-screen cost unless set.
def _price(name: str, default: float | None = None) -> float | None:
    raw = os.environ.get(name)
    return float(raw) if raw else default


PRICE_INPUT_PER_M = _price("PRICE_INPUT_PER_M", 0.10)
PRICE_CACHED_INPUT_PER_M = _price("PRICE_CACHED_INPUT_PER_M", 0.01)
PRICE_CACHE_WRITE_PER_M = _price("PRICE_CACHE_WRITE_PER_M", 0.125)
PRICE_OUTPUT_PER_M = _price("PRICE_OUTPUT_PER_M", 0.50)
PRICE_WEB_SEARCH_PER_K = _price("PRICE_WEB_SEARCH_PER_K")   # per 1,000 web search calls, if billed

# ---- API limits --------------------------------------------------------------------
MAX_SEARCHES_PER_DAY = int(os.environ.get("SCOUT_MAX_SEARCHES_PER_DAY", "25"))  # stops runaway spending
REUSE_DAYS = 7                    # the same brief within a week reloads the saved result for free
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

AUDIT_TEXT_LIMIT = 1_500          # characters kept per text field in the audit trail
