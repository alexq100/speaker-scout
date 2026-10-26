"""Speaker Scout API (FastAPI). The website talks to these routes.

Run from the project folder:   ./start.sh          (API on :8000, website on :5173)
or just the API:                cd backend && ../.venv/bin/uvicorn main:app --port 8000

Routes
  GET    /api/health                      is the API up, and is the key set?
  GET    /api/conferences                 conferences (the main buckets) with counts
  POST   /api/conferences                 new conference  {name}
  PATCH  /api/conferences/{id}            rename  {name}
  DELETE /api/conferences/{id}            delete it with its searches, shortlist and panels (not the last one)
  GET/POST /api/conferences/{id}/balance  Panel Architect review of the whole program (saved)
  POST   /api/shortlist/{item_id}/replacements  replacement ideas for a declined speaker
  (Searches, shortlist and groups take ?conference_id=…; without it they use the first conference.)
  GET    /api/options                     categories, example briefs, limits (for the form)
  POST   /api/searches                    start a search  {brief, force?} -> {id, reused}
  GET    /api/searches                    saved searches in a conference (newest first)
  POST   /api/searches/{id}/move          file a search under another conference  {conference_id}
  GET    /api/searches/{id}               one search: live progress while running, full result when done
  POST   /api/searches/{id}/stop          stop a running search (stops spending tokens)
  POST   /api/searches/{id}/panels        (re)run the Panel Architect on a finished search
  POST   /api/searches/{id}/panels/{i}/save   turn suggested panel i into a Shortlist panel
  GET    /api/shortlist                   the team's shortlist
  POST   /api/shortlist                   add a speaker  {search_id, category, name}
  PATCH  /api/shortlist/{item_id}         edit the note  {note}
  DELETE /api/shortlist/{item_id}         remove a speaker
  POST   /api/shortlist/{item_id}/move    put a speaker in a panel / keynote group  {group_id | null}
  PATCH  /api/shortlist/{item_id}/outreach  outreach status and notes  {status?, notes?}
  PATCH  /api/shortlist/{item_id}/planning  owner, follow-up date, fee, travel, confirmed checklist
  GET    /api/shortlist/{item_id}/log       outreach log (status changes + dated notes)
  POST   /api/shortlist/{item_id}/log       add a dated outreach note  {text}
  POST   /api/shortlist/{item_id}/draft-email  draft an invitation email (draft only, never sent)
  POST   /api/speaker-chat                ask a question about one speaker (may search the web; sourced answers)
  GET    /api/shortlist/{item_id}/notes   speaker notes (from the chat or typed)
  POST   /api/shortlist/{item_id}/notes   save a note  {text, origin, question?, sources?}
  DELETE /api/notes/{note_id}             delete a note
  GET    /api/groups                      keynote group + named panels, with counts
  POST   /api/groups                      new panel  {name, theme?}
  PATCH  /api/groups/{group_id}           rename / set panel theme  {name?, theme?}
  POST   /api/groups/{group_id}/review    Panel Architect feedback on a panel (+ who to add, from shortlist/past searches)
  POST   /api/groups/{group_id}/move      move a panel and its people to another conference  {conference_id}
  DELETE /api/groups/{group_id}           delete a panel (its people go back to Unsorted)
  POST   /api/reset                       start over: clears saved searches and the shortlist {confirm: "start over"}

Safety and cost: one search at a time, a daily search cap, the same brief reloads for free for a week,
and the brief's fields are length-checked by models.SearchBrief before any agent sees them.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Literal

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

import audit  # noqa: E402
import config  # noqa: E402
import store  # noqa: E402
from agents import SpeakerScout  # noqa: E402
from examples import EXAMPLES  # noqa: E402
from models import ALL_CATEGORIES, CATEGORY_LABELS, SearchBrief, SearchResult, SpeakerCard  # noqa: E402

app = FastAPI(title="Speaker Scout API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

_scout: SpeakerScout | None = None
_live: dict[str, SearchResult] = {}          # searches running right now (live objects that fill in)
_tasks: dict[str, asyncio.Task] = {}


def scout() -> SpeakerScout:
    global _scout
    if _scout is None:
        _scout = SpeakerScout()
    return _scout


def conf_id(conference_id: int | None) -> int:
    """The conference a request is about: the one given, or the default if none was given."""
    if conference_id is None:
        return store.default_conference_id()
    if not store.conference_exists(conference_id):
        raise HTTPException(404, "No such conference.")
    return conference_id


def running_id() -> str | None:
    return next((sid for sid, t in _tasks.items() if not t.done()), None)


# ============================================================================
# Health and options
# ============================================================================

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "model": config.MODEL_NAME, "key_set": bool(os.environ.get("PORTKEY_API_KEY")),
            "running_search": running_id()}


@app.get("/api/options")
def options() -> dict[str, Any]:
    return {
        "model": config.MODEL_NAME,
        "categories": [{"id": c, "label": CATEGORY_LABELS[c]} for c in ALL_CATEGORIES],
        "examples": {k: {"label": v.conference_name, "brief": v.model_dump()} for k, v in EXAMPLES.items()},
        "limits": {"theme_chars": 200, "notes_chars": 300, "max_per_category": 5,
                   "searches_per_day": config.MAX_SEARCHES_PER_DAY, "searches_today": store.searches_today()},
        "pricing_set": config.PRICE_INPUT_PER_M is not None,
    }


# ============================================================================
# Searches
# ============================================================================

# ============================================================================
# Conferences: the main buckets (each has its own searches, shortlist and panels)
# ============================================================================

class ConferenceName(BaseModel):
    name: str = Field(min_length=1, max_length=100)


@app.get("/api/conferences")
def list_conferences() -> list[dict[str, Any]]:
    return store.list_conferences()


@app.post("/api/conferences")
def create_conference(req: ConferenceName) -> dict[str, Any]:
    return store.create_conference(req.name.strip())


@app.patch("/api/conferences/{conference_id}")
def rename_conference(conference_id: int, req: ConferenceName) -> dict[str, Any]:
    c = store.rename_conference(conf_id(conference_id), req.name.strip())
    if c is None:
        raise HTTPException(404, "No such conference.")
    return c


@app.delete("/api/conferences/{conference_id}")
def delete_conference(conference_id: int) -> dict[str, Any]:
    if running_id() is not None and store.search_conference(running_id()) == conference_id:
        raise HTTPException(409, "A search in this conference is running. Stop it first.")
    outcome = store.delete_conference(conference_id)
    if outcome == "missing":
        raise HTTPException(404, "No such conference.")
    if outcome == "last":
        raise HTTPException(409, "You need at least one conference. Rename this one instead.")
    return {"deleted": True}


def _candidate_pool(cid: int, exclude: set[str], items: list[dict]) -> list[tuple[str, str, SpeakerCard, bool]]:
    """Shortlisted people first (unplaced before placed), then people from this conference's past searches."""
    from guards import name_key
    shortlisted = {name_key(i["name"]) for i in items}
    pool, seen = [], set(exclude)
    for i in sorted(items, key=lambda i: i["group_id"] is not None):
        k = name_key(i["name"])
        if k not in seen:
            seen.add(k)
            pool.append((i["search_id"], i["category"], SpeakerCard.model_validate(i["card"]), True))
    for sid, cat, card in store.all_saved_cards(cid):
        k = name_key(card.name)
        if k not in seen:
            seen.add(k)
            pool.append((sid, cat, card, k in shortlisted))
    return pool[:70]


@app.get("/api/conferences/{conference_id}/balance")
def get_balance(conference_id: int) -> dict[str, Any] | None:
    return store.get_balance(conf_id(conference_id))


@app.post("/api/conferences/{conference_id}/balance")
async def check_balance(conference_id: int) -> dict[str, Any]:
    """Panel Architect review of the whole program (keynotes + every panel + unplaced), with counts from code."""
    from collections import Counter
    from guards import name_key
    cid = conf_id(conference_id)
    items = store.list_shortlist(cid)
    if not items:
        raise HTTPException(400, "Save some speakers to this conference's shortlist first.")
    groups = store.list_groups(cid)
    sessions = []
    for g in groups:
        people = [(i["category"], SpeakerCard.model_validate(i["card"]), i["outreach_status"]) for i in items if i["group_id"] == g["id"]]
        sessions.append({"name": g["name"], "kind": g["kind"], "theme": g["theme"], "people": people})
    unplaced = [(i["category"], SpeakerCard.model_validate(i["card"]), i["outreach_status"]) for i in items if i["group_id"] is None]
    if unplaced:
        sessions.append({"name": "Not yet placed", "kind": "unplaced", "theme": "", "people": unplaced})
    cards = [(c, k) for s in sessions for c, k, _ in s["people"]]
    mix = {"people": len(cards), "sessions": len([g for g in groups if g["kind"] == "panel"]),
           "by_category": dict(Counter(c for c, _ in cards)), "by_level": dict(Counter(k.level for _, k in cards)),
           "by_speaking": dict(Counter(k.speaking_badge for _, k in cards)),
           "by_location": dict(Counter((k.location or "unknown").split(",")[-1].strip() for _, k in cards).most_common(8))}
    pool = _candidate_pool(cid, {name_key(k.name) for _, k in cards}, items)
    conference = next((c["name"] for c in store.list_conferences() if c["id"] == cid), "")
    review = await scout().review_program(conference, sessions, pool, mix)
    store.set_balance(cid, review.model_dump_json())
    return review.model_dump()


@app.post("/api/shortlist/{item_id}/replacements")
async def find_replacements(item_id: int) -> dict[str, Any]:
    """A speaker declined: who from the shortlist / past searches could fill their seat?"""
    from guards import name_key
    item = store.get_item(item_id)
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    items = store.list_shortlist(item["conference_id"])
    session = None
    if item["group_id"]:
        g = store.get_group(item["group_id"])
        others = [(i["category"], SpeakerCard.model_validate(i["card"])) for i in items
                  if i["group_id"] == item["group_id"] and i["id"] != item_id and i["outreach_status"] != "declined"]
        session = {"name": g["name"], "kind": g["kind"], "theme": g["theme"], "others": others}
    exclude = {name_key(item["name"])} | ({name_key(k.name) for _, k in session["others"]} if session else set())
    pool = _candidate_pool(item["conference_id"], exclude, items)
    out = await scout().find_replacement((item["category"], SpeakerCard.model_validate(item["card"])), session, pool)
    return out.model_dump()


class StartSearch(BaseModel):
    brief: SearchBrief
    conference_id: int | None = None
    force: bool = Field(default=False, description="Run again even if the same brief was searched recently")


async def _run(search_id: str, brief: SearchBrief) -> None:
    def on_start(result: SearchResult) -> None:
        _live[search_id] = result

    try:
        result = await scout().run(brief, search_id=search_id, on_start=on_start)
    except asyncio.CancelledError:
        result = _live.get(search_id)
        if result is not None:
            result.status = "stopped"
            result.error = "Stopped by the planner."
            audit.write("search_stopped", search_id=search_id)
    if result is not None:
        store.save_search(result)
    _live.pop(search_id, None)


@app.post("/api/searches")
async def start_search(req: StartSearch) -> dict[str, Any]:
    if (rid := running_id()) is not None:
        raise HTTPException(409, f"A search is already running ({rid}). Wait for it to finish or stop it.")
    cid = conf_id(req.conference_id)
    if not req.force and (prev := store.find_recent(req.brief, config.REUSE_DAYS, cid)):
        return {"id": prev.id, "reused": True}
    if store.searches_today() >= config.MAX_SEARCHES_PER_DAY:
        raise HTTPException(429, f"Daily limit of {config.MAX_SEARCHES_PER_DAY} searches reached. "
                                 "This protects the token budget; it resets tomorrow.")
    search_id = uuid.uuid4().hex[:10]
    # Save a placeholder right away so it counts toward the daily cap even if the server stops.
    store.save_search(SearchResult(id=search_id, status="running", brief=req.brief, model=config.MODEL_NAME,
                                   created_at=store._now()), cid)
    _tasks[search_id] = asyncio.create_task(_run(search_id, req.brief))
    await asyncio.sleep(0)  # let the run start so the live object exists
    return {"id": search_id, "reused": False}


@app.get("/api/searches")
def list_searches(conference_id: int | None = None) -> list[dict[str, Any]]:
    return store.list_searches(conf_id(conference_id))


class MoveSearch(BaseModel):
    conference_id: int


@app.post("/api/searches/{search_id}/move")
def move_search(search_id: str, req: MoveSearch) -> dict[str, Any]:
    """File a saved search under another conference. People already shortlisted stay where they are."""
    if not store.move_search(search_id, conf_id(req.conference_id)):
        raise HTTPException(404, "No search with that id.")
    return {"moved": True, "conference_id": req.conference_id}


@app.get("/api/searches/{search_id}")
def get_search(search_id: str) -> SearchResult:
    if search_id in _live:
        return _live[search_id]
    result = store.get_search(search_id)
    if result is None:
        raise HTTPException(404, "No search with that id.")
    if result.status == "running" and search_id not in _tasks:
        result.status = "stopped"
        result.error = "The server restarted before this search finished."
    return result


@app.get("/api/searches/{search_id}/conference")
def get_search_conference(search_id: str) -> dict[str, Any]:
    cid = store.search_conference(search_id)
    if cid is None:
        raise HTTPException(404, "No search with that id.")
    return {"conference_id": cid}


@app.post("/api/searches/{search_id}/stop")
async def stop_search(search_id: str) -> dict[str, Any]:
    task = _tasks.get(search_id)
    if task is None or task.done():
        raise HTTPException(409, "That search isn't running.")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    return {"stopped": True}


# ---- Panel Architect --------------------------------------------------------

_panel_jobs: set[str] = set()


@app.post("/api/searches/{search_id}/panels")
async def suggest_panels(search_id: str) -> SearchResult:
    """(Re)run the Panel Architect on a finished search. Cheap: no web search, just the verified cards."""
    if search_id in _live:
        raise HTTPException(409, "Wait for the search to finish first.")
    if search_id in _panel_jobs:
        raise HTTPException(409, "Already suggesting panels for this search.")
    result = store.get_search(search_id)
    if result is None:
        raise HTTPException(404, "No search with that id.")
    _panel_jobs.add(search_id)
    try:
        await scout().suggest_panels(result)
    finally:
        _panel_jobs.discard(search_id)
    store.save_search(result)
    return result


@app.post("/api/searches/{search_id}/panels/{index}/save")
def save_panel(search_id: str, index: int) -> dict[str, Any]:
    """Turn a suggested panel into a Shortlist panel: create the group and add its people (and moderator)."""
    result = store.get_search(search_id)
    if result is None or not (0 <= index < len(result.panels)):
        raise HTTPException(404, "No such suggested panel.")
    panel = result.panels[index]
    cards = {(c.category, card.name): card for c in result.categories for card in c.cards}
    cid = store.search_conference(search_id) or store.default_conference_id()
    group = store.create_group(cid, panel.title[:80], panel.question[:200])
    people = list(panel.members) + ([panel.moderator] if panel.moderator else [])
    for m in people:
        card = cards.get((m.category, m.name))
        if card is None:
            continue
        note = "Suggested moderator. " + m.angle if panel.moderator and m is panel.moderator else m.angle
        item = store.add_to_shortlist(cid, search_id, m.category, card)
        if not item["note"]:
            store.update_note(item["id"], note[:500])
        store.move_item(item["id"], group["id"])
    return {"group": store.update_group(group["id"], None, None)}


# ============================================================================
# Shortlist
# ============================================================================

class AddToShortlist(BaseModel):
    search_id: str
    category: str
    name: str
    note: str = Field(default="", max_length=500)


class NoteUpdate(BaseModel):
    note: str = Field(max_length=500)


@app.get("/api/shortlist")
def get_shortlist(conference_id: int | None = None) -> list[dict[str, Any]]:
    return store.list_shortlist(conf_id(conference_id))


@app.post("/api/shortlist")
def add_to_shortlist(req: AddToShortlist) -> dict[str, Any]:
    # The card always comes from a saved search, never from the request, so nobody can inject a fake card.
    result = _live.get(req.search_id) or store.get_search(req.search_id)
    if result is None:
        raise HTTPException(404, "No search with that id.")
    for cr in result.categories:
        if cr.category == req.category:
            for card in cr.cards:
                if card.name == req.name:
                    # Saved into the conference the search belongs to.
                    cid = store.search_conference(req.search_id) or store.default_conference_id()
                    return store.add_to_shortlist(cid, req.search_id, req.category, card, req.note)
    raise HTTPException(404, "That speaker isn't in that search.")


@app.patch("/api/shortlist/{item_id}")
def edit_note(item_id: int, req: NoteUpdate) -> dict[str, Any]:
    item = store.update_note(item_id, req.note)
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    return item


class OutreachUpdate(BaseModel):
    status: Literal["not_contacted", "reached_out", "following_up", "in_conversation", "confirmed", "declined"] | None = None
    notes: str | None = Field(default=None, max_length=2000)


@app.patch("/api/shortlist/{item_id}/outreach")
def update_outreach(item_id: int, req: OutreachUpdate) -> dict[str, Any]:
    """Outreach tracking: status (not contacted → reached out → … → confirmed / declined) and notes."""
    item = store.update_outreach(item_id, req.status, req.notes)
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    return item


class PlanningUpdate(BaseModel):
    owner: str | None = Field(default=None, max_length=80)
    follow_up_date: str | None = Field(default=None, pattern=r"^(\d{4}-\d{2}-\d{2})?$")
    fee: str | None = Field(default=None, max_length=200)
    travel: str | None = Field(default=None, max_length=300)
    checklist: dict[str, bool] | None = None
    clear_draft: bool = False


CHECKLIST_KEYS = {"bio", "headshot", "talk_title", "av_needs", "travel_booked", "release_form"}


@app.patch("/api/shortlist/{item_id}/planning")
def update_planning(item_id: int, req: PlanningUpdate) -> dict[str, Any]:
    """Planning-team fields: outreach owner, next follow-up date, fee, travel, confirmed-speaker checklist."""
    fields = req.model_dump(exclude_unset=True, exclude={"clear_draft"})
    if "checklist" in fields and fields["checklist"] is not None:
        fields["checklist"] = {k: bool(v) for k, v in fields["checklist"].items() if k in CHECKLIST_KEYS}
    if req.clear_draft:
        fields["draft"] = None
    item = store.update_planning(item_id, fields)
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    return item


class LogNote(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.get("/api/shortlist/{item_id}/log")
def get_log(item_id: int) -> list[dict[str, Any]]:
    return store.list_log(item_id)


@app.post("/api/shortlist/{item_id}/log")
def add_log(item_id: int, req: LogNote) -> dict[str, Any]:
    """A dated outreach note ('Replied: interested…'). Also updates the speaker's last-outreach date."""
    item = store.add_log_note(item_id, req.text.strip())
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    return item


class DraftRequest(BaseModel):
    sender_name: str = Field(default="", max_length=80)
    notes: str = Field(default="", max_length=500)


@app.post("/api/shortlist/{item_id}/draft-email")
async def draft_email(item_id: int, req: DraftRequest) -> dict[str, Any]:
    """Draft a personalized invitation email (draft only: the app never sends email)."""
    item = store.get_item(item_id)
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    conference = next((c["name"] for c in store.list_conferences() if c["id"] == item["conference_id"]), "")
    group = store.get_group(item["group_id"]) if item["group_id"] else None
    draft = await scout().draft_email(item, conference, group, req.sender_name.strip(), req.notes.strip())
    return store.update_planning(item_id, {"draft": draft.model_dump()})


# ---- Speaker chat + speaker notes ----

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)


class SpeakerChat(BaseModel):
    search_id: str
    category: str
    name: str
    question: str = Field(min_length=2, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


_chat_busy: set[str] = set()


@app.post("/api/speaker-chat")
async def speaker_chat(req: SpeakerChat) -> dict[str, Any]:
    """Ask a question about one speaker. The card is loaded from the saved search (never taken from the
    request), the agent may run up to 2 web searches, and every source is checked against pages it saw."""
    result = _live.get(req.search_id) or store.get_search(req.search_id)
    card = next((c for cr in (result.categories if result else []) if cr.category == req.category
                 for c in cr.cards if c.name == req.name), None)
    if card is None:
        raise HTTPException(404, "That speaker isn't in that search.")
    key = f"{req.search_id}:{req.name}"
    if key in _chat_busy:
        raise HTTPException(409, "Still answering the last question.")
    _chat_busy.add(key)
    try:
        answer = await scout().ask_about(card, req.question.strip(), [t.model_dump() for t in req.history])
    finally:
        _chat_busy.discard(key)
    return answer.model_dump()


class NewNote(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    origin: Literal["chat", "manual"] = "manual"
    question: str = Field(default="", max_length=500)
    sources: list[dict[str, str]] = Field(default_factory=list, max_length=8)


@app.get("/api/shortlist/{item_id}/notes")
def get_speaker_notes(item_id: int) -> list[dict[str, Any]]:
    return store.list_speaker_notes(item_id)


@app.post("/api/shortlist/{item_id}/notes")
def add_speaker_note(item_id: int, req: NewNote) -> dict[str, Any]:
    sources = [{"title": s.get("title", "")[:200], "url": s.get("url", "")[:500]} for s in req.sources
               if s.get("url", "").startswith(("http://", "https://"))]
    note = store.add_speaker_note(item_id, req.text.strip(), req.origin, req.question.strip(), sources)
    if note is None:
        raise HTTPException(404, "Not on the shortlist.")
    return note


@app.delete("/api/notes/{note_id}")
def delete_speaker_note(note_id: int) -> dict[str, Any]:
    if not store.delete_speaker_note(note_id):
        raise HTTPException(404, "No such note.")
    return {"deleted": True}


class MoveRequest(BaseModel):
    group_id: int | None = Field(description="Group to move into, or null for Unsorted")


@app.post("/api/shortlist/{item_id}/move")
def move_item(item_id: int, req: MoveRequest) -> dict[str, Any]:
    try:
        item = store.move_item(item_id, req.group_id)
    except KeyError:
        raise HTTPException(404, "No such panel in this conference.")
    if item is None:
        raise HTTPException(404, "Not on the shortlist.")
    return item


# ---- Groups: keynote speakers + named panels ----

class NewGroup(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    conference_id: int | None = None
    theme: str = Field(default="", max_length=200)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    theme: str | None = Field(default=None, max_length=200)
    session_date: str | None = Field(default=None, pattern=r"^(\d{4}-\d{2}-\d{2})?$")
    session_time: str | None = Field(default=None, max_length=40)
    session_room: str | None = Field(default=None, max_length=80)


@app.get("/api/groups")
def list_groups(conference_id: int | None = None) -> list[dict[str, Any]]:
    return store.list_groups(conf_id(conference_id))


@app.post("/api/groups")
def create_group(req: NewGroup) -> dict[str, Any]:
    return store.create_group(conf_id(req.conference_id), req.name.strip(), req.theme.strip())


@app.patch("/api/groups/{group_id}")
def update_group(group_id: int, req: GroupUpdate) -> dict[str, Any]:
    session = req.model_dump(exclude_unset=True, include={"session_date", "session_time", "session_room"})
    group = store.update_group(group_id, req.name.strip() if req.name else None,
                               req.theme.strip() if req.theme is not None else None, session)
    if group is None:
        raise HTTPException(404, "No such panel.")
    return group


_review_jobs: set[int] = set()


@app.post("/api/groups/{group_id}/review")
async def review_group(group_id: int) -> dict[str, Any]:
    """Panel Architect feedback on a panel: is it good, why, what's missing, and who to add (from the
    shortlist and past searches only). Cheap: no web search."""
    from guards import name_key
    group = store.get_group(group_id)
    if group is None:
        raise HTTPException(404, "No such panel.")
    cid = group["conference_id"]
    items = store.list_shortlist(cid)
    members = [(i["category"], SpeakerCard.model_validate(i["card"]), i["note"]) for i in items if i["group_id"] == group_id]
    if not members:
        raise HTTPException(400, "Add at least one person to this panel first.")
    if group_id in _review_jobs:
        raise HTTPException(409, "Already reviewing this panel.")
    on_panel = {name_key(card.name) for _, card, _ in members}
    shortlisted = {name_key(i["name"]) for i in items}
    pool, seen = [], set(on_panel)
    group_names = {g["id"]: g["name"] for g in store.list_groups(cid)}
    placed = {name_key(i["name"]): group_names.get(i["group_id"]) for i in items if i["group_id"]}
    for i in sorted(items, key=lambda i: i["group_id"] is not None):  # shortlist first, unplaced people first
        k = name_key(i["name"])
        if k not in seen:
            seen.add(k)
            pool.append((i["search_id"], i["category"], SpeakerCard.model_validate(i["card"]), True))
    for sid, cat, card in store.all_saved_cards(cid):  # only this conference's searches
        k = name_key(card.name)
        if k not in seen:
            seen.add(k)
            pool.append((sid, cat, card, k in shortlisted))
    pool = pool[:70]  # keeps the call small and cheap
    _review_jobs.add(group_id)
    try:
        review = await scout().review_panel(group, members, pool, placed)
    finally:
        _review_jobs.discard(group_id)
    store.set_group_review(group_id, review.model_dump_json())
    return store.get_group(group_id)


class MoveGroup(BaseModel):
    conference_id: int


@app.post("/api/groups/{group_id}/move")
def move_group(group_id: int, req: MoveGroup) -> dict[str, Any]:
    """Move a panel and its people to another conference."""
    outcome = store.move_group(group_id, req.conference_id)
    if outcome in ("missing", "no_conference"):
        raise HTTPException(404, "No such panel or conference.")
    if outcome == "protected":
        raise HTTPException(409, "The Keynote speakers group stays with its conference. Move people one at a time instead.")
    if outcome == "same":
        raise HTTPException(409, "That panel is already in this conference.")
    return {"moved": True, "group": store.get_group(group_id)}


@app.delete("/api/groups/{group_id}")
def delete_group(group_id: int) -> dict[str, Any]:
    outcome = store.delete_group(group_id)
    if outcome == "missing":
        raise HTTPException(404, "No such panel.")
    if outcome == "protected":
        raise HTTPException(409, "The Keynote speakers group can be renamed but not deleted.")
    return {"deleted": True}


@app.delete("/api/shortlist/{item_id}")
def remove_from_shortlist(item_id: int) -> dict[str, Any]:
    if not store.remove_from_shortlist(item_id):
        raise HTTPException(404, "Not on the shortlist.")
    return {"removed": True}


# ============================================================================
# Start over
# ============================================================================

class ResetRequest(BaseModel):
    confirm: str


@app.post("/api/reset")
def reset(req: ResetRequest) -> dict[str, Any]:
    if req.confirm.strip().lower() != "start over":
        raise HTTPException(400, 'To clear everything, send {"confirm": "start over"}.')
    if running_id() is not None:
        raise HTTPException(409, "Stop the running search first.")
    store.reset()
    audit.write("reset")
    return {"reset": True}
