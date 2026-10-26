"""Load the official example searches (saved in output/runs/) into the app, so you can explore real results
without spending any tokens. Each goes into its own conference.

    .venv/bin/python backend/load_examples.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402
import store  # noqa: E402
from models import SearchResult  # noqa: E402

EXAMPLES = {  # search id -> conference
    "fa7a94541e": "Yale Business & the Environment (example)",
    "e2b6c3e7a5": "Yale Philanthropy Conference (example)",
    "35e14ff0f8": "Urban Tree Summit (example)",
}

# If a team account already exists, give the examples to the first team; otherwise leave them unclaimed so
# the first team account created on the website adopts them.
with store._db() as conn:
    row = conn.execute("SELECT MIN(id) FROM accounts").fetchone()
team = row[0] if row and row[0] else None

for search_id, conf_name in EXAMPLES.items():
    path = config.RUNS_DIR / f"{search_id}.json"
    if not path.exists():
        print(f"missing {path}")
        continue
    conf = next((c for c in store.list_conferences(team) if c["name"] == conf_name), None) \
        or store.create_conference(conf_name, team)
    store.save_search(SearchResult.model_validate_json(path.read_text()), conf["id"])
    print(f"loaded {search_id} into '{conf_name}'")
print("Done. Log in (or create your team account) and pick a conference from the Conference menu at the top right.")
