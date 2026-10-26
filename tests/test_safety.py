"""Safety tests for Speaker Scout. No AI calls and no tokens: these test the code-level defenses.

    .venv/bin/python -m pytest tests/test_safety.py -v
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
import tools  # noqa: E402
from guards import check_card, check_panels, finalize, scrub_contact, shared_stages  # noqa: E402
from models import CategoryResult, Link, PanelMember, PanelSuggestion, SpeakerCard, SpeakingItem  # noqa: E402
from tools import RunTrace, check_url, BlockedURL, read_page  # noqa: E402

INJECTION_DIR = ROOT / "tests" / "injection_pages"


def card(**over) -> SpeakerCard:
    base = dict(name="Jane Roe", job_title="Director of Circular Programs", organization="Example Org",
                level="established", best_for=["panelist"], speaking_badge="some", could_speak_on="Circularity",
                talk_ideas=["a"], topic_tags=["circularity"], bio="Bio.", why_fit="Fit.", fit_score=4,
                fit_reason="Good fit.", evidence_urls=["https://example.org/people/jane"],
                links=[Link(label="Profile", url="https://example.org/people/jane", kind="profile")])
    base.update(over)
    return SpeakerCard(**base)


def seen(*urls: str) -> RunTrace:
    t = RunTrace()
    for u in urls:
        t.saw(u)
    return t


# ---- 1. Web safety: blocked addresses -------------------------------------------------

@pytest.mark.parametrize("url", [
    "file:///etc/passwd", "ftp://example.com/x", "http://127.0.0.1/", "http://localhost/",
    "http://10.0.0.5/admin", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data",
    "http://example.com:8080/", "http://user:pass@example.com/",
])
def test_private_and_unsafe_urls_are_blocked(url, monkeypatch):
    monkeypatch.setattr(config, "TEST_MODE", False)
    with pytest.raises(BlockedURL):
        check_url(url)


# ---- 2. Prompt injection: the planted page is detected and its person is dropped -------

@pytest.fixture()
def injection_server(monkeypatch):
    monkeypatch.setattr(config, "TEST_MODE", True)   # allow 127.0.0.1 for the planted page only
    handler = partial(SimpleHTTPRequestHandler, directory=str(INJECTION_DIR))
    handler.log_message = lambda *a, **k: None
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}/speaker_bio.html"
    server.shutdown()


def test_injection_page_is_flagged(injection_server):
    trace = RunTrace()
    page = asyncio.run(read_page(injection_server, "Jordan Vale", trace))
    assert page["ok"]
    assert "warning" in page                                       # agents are told not to follow it
    assert "UNTRUSTED PAGE TEXT" in page["untrusted_page_text"]     # text is wrapped as data
    assert trace.injection_warnings and trace.injection_pages       # recorded for the code check


def test_person_backed_by_injection_page_is_dropped(injection_server):
    trace = RunTrace()
    asyncio.run(read_page(injection_server, "Jordan Vale", trace))
    planted = card(name="Jordan Vale", job_title="Chief Sustainability Officer", organization="Example Climate Co.",
                   evidence_urls=[injection_server], links=[Link(label="Bio", url=injection_server, kind="profile")])
    kept, removals = check_card(planted, "founder", trace)
    assert kept is None
    assert removals[0].what == "dropped_injection_source"


# ---- 3. Made-up people and claims ----------------------------------------------------

def test_invented_links_are_removed_and_unbacked_person_dropped():
    trace = seen("https://example.org/people/jane")
    c = card(links=[Link(label="Profile", url="https://example.org/people/jane", kind="profile"),
                    Link(label="Made up", url="https://not-real.example/fake", kind="work")],
             past_speaking=[SpeakingItem(event="Fake Summit", year=2025, url="https://not-real.example/talk")],
             speaking_badge="experienced")
    kept, removals = check_card(c, "practitioner", trace)
    assert kept is not None
    assert [l.url for l in kept.links] == ["https://example.org/people/jane"]
    assert kept.past_speaking == [] and kept.speaking_badge == "none_found"
    assert sum(r.what == "invented_link_removed" for r in removals) == 2

    nobody = card(evidence_urls=["https://not-real.example/a"],
                  links=[Link(label="X", url="https://not-real.example/b", kind="profile")])
    kept, removals = check_card(nobody, "practitioner", RunTrace())
    assert kept is None and removals[-1].what == "dropped_no_work_proof"


def test_event_listing_only_and_weak_title_are_dropped():
    trace = seen("https://conf.example/agenda", "https://example.org/people/jane")
    listing_only = card(evidence_urls=["https://conf.example/agenda"],
                        links=[Link(label="Agenda", url="https://conf.example/agenda", kind="talk")])
    assert check_card(listing_only, "academic", trace)[0] is None
    weak = card(job_title="Presenter; affiliation listed in conference agenda")
    assert check_card(weak, "academic", trace)[0] is None
    real = card(job_title="Author, speaker, and podcaster")          # a real line of work, kept
    assert check_card(real, "journalist", trace)[0] is not None


def test_linkedin_alone_is_not_enough():
    li = "https://www.linkedin.com/in/jane-roe"
    trace = seen(li, "https://conf.example/talk/jane")
    only = card(evidence_urls=[li], links=[Link(label="LinkedIn", url=li, kind="profile")])
    assert check_card(only, "advocate", trace)[0] is None
    plus = card(evidence_urls=[li], links=[Link(label="LinkedIn", url=li, kind="profile"),
                                           Link(label="Talk", url="https://conf.example/talk/jane", kind="talk")])
    assert check_card(plus, "advocate", trace)[0] is not None


def test_photo_must_come_from_their_own_profile():
    trace = seen("https://example.org/people/jane", "https://conf.example/agenda")
    trace.saw_image("https://example.org/jane.jpg", "https://example.org/people/jane")
    trace.saw_image("https://conf.example/someone.jpg", "https://conf.example/agenda")
    ok, _ = check_card(card(photo_url="https://example.org/jane.jpg"), "policy", trace)
    assert ok.photo_url == "https://example.org/jane.jpg"
    bad, removals = check_card(card(photo_url="https://conf.example/someone.jpg"), "policy", trace)
    assert bad.photo_url is None and removals[-1].what == "photo_removed"


# ---- 4. Privacy ----------------------------------------------------------------------

def test_contact_details_are_scrubbed():
    text, n = scrub_contact("Email jane.roe@gmail.com or call (203) 555-0142; office opened 2025.")
    assert "@" not in text and "555" not in text and "2025" in text and n == 2
    kept, removals = check_card(card(bio="Reach her at jane.roe@gmail.com"), "policy", seen("https://example.org/people/jane"))
    assert "[email removed]" in kept.bio and removals[-1].what == "contact_info_removed"


# ---- 5. Skip list, duplicates, panels ------------------------------------------------

def test_skip_list_and_duplicates():
    a = CategoryResult(category="founder", label="F", cards=[card(name="Dr. Jane Roe", fit_score=5), card(name="Sam Lee")])
    b = CategoryResult(category="practitioner", label="P", cards=[card(name="Jane Roe, PhD", fit_score=3), card(name="Ann Bo")])
    removals = finalize([a, b], skip_names=["Ann Bo"], per_category=5)
    assert [c.name for c in a.cards] == ["Dr. Jane Roe", "Sam Lee"]
    assert b.cards == []
    assert {r.what for r in removals} == {"skip_list", "duplicate_merged"}


def test_panel_architect_cannot_invent_panelists():
    cards = [("academic", card(name="Ann Bo")), ("policy", card(name="Sam Lee")), ("founder", card(name="Kai Wu"))]
    p = PanelSuggestion(title="T", question="Q", why_together=["w"], tension="t", balance_note="b",
                        members=[PanelMember(name=n, category=c, angle="a") for c, n in
                                 [("academic", "Ann Bo"), ("policy", "Sam Lee"), ("founder", "Kai Wu"), ("advocate", "Made Up")]])
    kept, notes = check_panels([p], cards, shared_stages(cards))
    assert [m.name for m in kept[0].members] == ["Ann Bo", "Sam Lee", "Kai Wu"]
    assert any("Made Up" in n for n in notes)


# ---- 6. Model lock -------------------------------------------------------------------

def test_only_gpt6_luna_is_allowed():
    env = {**os.environ, "MODEL": "gpt-4o"}
    r = subprocess.run([sys.executable, "-c", "import config"], cwd=ROOT / "backend", env=env,
                       capture_output=True, text=True)
    assert r.returncode != 0 and "only runs on 'gpt-6-luna'" in r.stderr


# ---- 7. API guards (temporary database, no AI calls) ---------------------------------

@pytest.fixture()
def client(tmp_path, monkeypatch):
    """A scratch database only: test accounts are never created in the real data/scout.db."""
    import store
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "scout.db")
    import main
    from fastapi.testclient import TestClient
    c = TestClient(main.app)
    tok = c.post("/api/auth/signup", json={"team_name": "Test team", "username": "test-team-a",
                                           "password": "correct horse battery"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {tok}", "X-Actor": "Tester"})
    return c, store


def test_login_required_and_teams_are_isolated(tmp_path, monkeypatch):
    import store
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "scout.db")
    import main
    from fastapi.testclient import TestClient
    anon = TestClient(main.app)
    assert anon.get("/api/conferences").status_code == 401                 # must log in
    assert anon.get("/api/health").status_code == 200                      # health stays public
    a = anon.post("/api/auth/signup", json={"team_name": "A", "username": "team-a", "password": "password-aaaa"}).json()
    b = anon.post("/api/auth/signup", json={"team_name": "B", "username": "team-b", "password": "password-bbbb"}).json()
    ta, tb = TestClient(main.app), TestClient(main.app)
    ta.headers["Authorization"] = f"Bearer {a['token']}"
    tb.headers["Authorization"] = f"Bearer {b['token']}"
    conf_a = ta.get("/api/conferences").json()[0]["id"]
    assert all(c["id"] != conf_a for c in tb.get("/api/conferences").json())  # B can't list A's conferences
    assert tb.get(f"/api/groups?conference_id={conf_a}").status_code == 404   # ...or read them
    assert tb.post(f"/api/conferences/{conf_a}/balance").status_code == 404
    assert tb.delete(f"/api/conferences/{conf_a}").status_code == 404
    # passwords are stored only as salted hashes
    import sqlite3
    row = sqlite3.connect(store.DB_PATH).execute("SELECT pw_hash, salt FROM accounts WHERE username='team-a'").fetchone()
    assert "password-aaaa" not in row[0] and len(row[1]) == 32
    # five wrong passwords lock the account
    for _ in range(5):
        anon.post("/api/auth/login", json={"username": "team-a", "password": "wrong"})
    r = anon.post("/api/auth/login", json={"username": "team-a", "password": "password-aaaa"})
    assert r.status_code == 401 and "Too many" in r.json()["detail"]


def test_api_guards(client):
    c, store = client
    assert c.post("/api/searches", json={"brief": {"conference_theme": "x" * 250}}).status_code == 422
    assert c.post("/api/reset", json={"confirm": "yes"}).status_code == 400
    assert c.post("/api/shortlist", json={"search_id": "nope", "category": "academic", "name": "Fake"}).status_code == 404
    keynote = c.get("/api/groups").json()[0]
    assert keynote["kind"] == "keynote" and c.delete(f"/api/groups/{keynote['id']}").status_code == 409
    only = c.get("/api/conferences").json()[0]
    assert c.delete(f"/api/conferences/{only['id']}").status_code == 409          # can't delete the last one
    other = c.post("/api/conferences", json={"name": "Other"}).json()
    assert c.get("/api/activity").json()[0]["actor"] == "Tester"            # activity records who did it
    panel = c.post("/api/groups", json={"name": "P", "conference_id": other["id"]}).json()
    from models import SearchBrief, SearchResult
    r = SearchResult(id="s1", status="done", brief=SearchBrief(conference_theme="test theme"), model="gpt-6-luna",
                     created_at=store._now())
    store.save_search(r, only["id"])
    item = store.add_to_shortlist(only["id"], "s1", "academic", card())
    assert c.post(f"/api/shortlist/{item['id']}/move", json={"group_id": panel["id"]}).status_code == 404  # cross-conference
    assert c.post("/api/speaker-chat", json={"search_id": "s1", "category": "academic", "name": "Not There",
                                             "question": "hi"}).status_code == 404   # chat only about real cards
