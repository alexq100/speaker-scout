"""Code-level safety checks that run on agent output, after the model is done.

Prompts ask the agents to behave; these functions make sure, whatever the model wrote:
  0. A person backed by a page that tries to instruct AI agents (prompt injection) is dropped.
  1. Every link on a card was really seen during this search (no invented URLs).
  2. The profile page is linked first; links are ordered profile, work, talks.
  3. A person with no profile page or page about their work (only event listings) is dropped.
  4. A person without a real job title (e.g. just "Presenter") is dropped.
  5. Photos only come from images found on their own profile page or Wikipedia.
  6. Email addresses and phone numbers are scrubbed from every text field.
  7. People on the planner's skip list are removed, and the same person found in two categories is kept once.
  8. 1-5 people are shown per category: strong fits first, a weak fit only if nothing else was found.
Everything removed is recorded as a Removal, so the site (and the report) can show the checks working.
"""

from __future__ import annotations

import re
import unicodedata

import config

from models import CategoryResult, Link, PanelMember, PanelSuggestion, Removal, SpeakerCard
from tools import RunTrace, normalize_url

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<!\w)(\+?\d{1,3}[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\w)")


def name_key(name: str) -> str:
    """'Dr. Ana María López, PhD' -> 'ana maria lopez'."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(dr|prof|professor|mr|mrs|ms|mx|sir|dame)\.?\s+", "", s)
    s = re.sub(r",.*$", "", s)                     # drop ", PhD" etc.
    s = re.sub(r"[^a-z\s-]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def scrub_contact(text: str) -> tuple[str, int]:
    """Remove email addresses and phone numbers. Returns (clean text, how many were removed)."""
    count = 0

    def _sub(pattern: re.Pattern[str], value: str, label: str) -> str:
        nonlocal count
        def repl(_: re.Match[str]) -> str:
            nonlocal count
            count += 1
            return label
        return pattern.sub(repl, value)

    text = _sub(EMAIL_RE, text, "[email removed]")
    text = _sub(PHONE_RE, text, "[phone removed]")
    return text, count


def _scrub_card(card: SpeakerCard) -> int:
    removed = 0
    for fld in ("bio", "why_fit", "could_speak_on", "fit_reason", "job_title", "organization", "yale_connection"):
        if getattr(card, fld) is None:
            continue
        clean, n = scrub_contact(getattr(card, fld))
        setattr(card, fld, clean)
        removed += n
    for fld in ("talk_ideas", "topic_tags", "credentials", "notable_work"):
        items = []
        for item in getattr(card, fld):
            clean, n = scrub_contact(item)
            items.append(clean)
            removed += n
        setattr(card, fld, items)
    return removed


# Titles that describe an event appearance rather than a job, e.g. "Presenter; affiliation listed in agenda".
# "Author, speaker, and podcaster" is a real line of work, so only a title that is *nothing but* an event role,
# or that admits it came from a listing, counts as weak.
WEAK_TITLE_RE = re.compile(
    r"^\s*((keynote|guest|panel|featured|invited|conference) )?(presenter|panelist|speaker|attendee|participant|guest|unknown|n/?a)\s*[.;,]?\s*$"
    r"|\b(listed (in|on)|affiliation listed|per (the )?agenda|title (not|un)(known|confirmed))\b",
    re.IGNORECASE)
KIND_ORDER = {"profile": 0, "work": 1, "talk": 2}


def check_card(card: SpeakerCard, category: str, trace: RunTrace) -> tuple[SpeakerCard | None, list[Removal]]:
    """Apply the per-card checks. Returns (card, or None if dropped, plus what was removed)."""
    removals: list[Removal] = []

    def note(what: str, detail: str) -> None:
        removals.append(Removal(category=category, name=card.name, what=what, detail=detail))

    # 0. A person whose evidence comes from a page that tried to instruct the agents is not trusted.
    flagged = [u for u in [*card.evidence_urls, *(l.url for l in card.links), card.profile_url or ""]
               if u and normalize_url(u) in trace.injection_pages]
    if flagged:
        note("dropped_injection_source", f"evidence came from a page with hidden instructions to AI agents: {flagged[0]}")
        return None, removals

    # 1. Every link must point to a page seen in this search.
    kept_evidence = []
    for u in card.evidence_urls:
        if trace.was_seen(u):
            kept_evidence.append(u)
        else:
            note("invented_link_removed", f"evidence link never seen in this search: {u}")
    card.evidence_urls = list(dict.fromkeys(kept_evidence))
    if card.profile_url and not trace.was_seen(card.profile_url):
        note("invented_link_removed", f"profile link never seen in this search: {card.profile_url}")
        card.profile_url = None

    kept_links: list[Link] = []
    for link in card.links:
        if trace.was_seen(link.url):
            kept_links.append(link)
        else:
            note("invented_link_removed", f"link never seen in this search: {link.url}")
    kept_talks = []
    for item in card.past_speaking:
        if trace.was_seen(item.url):
            kept_talks.append(item)
        else:
            note("invented_link_removed", f"speaking link never seen in this search: {item.event} ({item.url})")
    card.past_speaking = kept_talks[:3]
    # A Yale connection is shown to planners as a way in, so it must come with a page seen in this search.
    if card.yale_connection and not (card.yale_connection_url and trace.was_seen(card.yale_connection_url)):
        note("yale_connection_removed", f"Yale connection had no page from this search behind it: {card.yale_connection}")
        card.yale_connection, card.yale_connection_url = None, None
    elif not card.yale_connection:
        card.yale_connection_url = None
    if not card.past_speaking and card.speaking_badge != "none_found":
        card.speaking_badge = "none_found"  # the badge must be backed by a real link

    # 2. Profile page goes first in the links; then work about them; then talks. No duplicates.
    if card.profile_url and not any(normalize_url(l.url) == normalize_url(card.profile_url) for l in kept_links):
        kept_links.insert(0, Link(label="Profile", url=card.profile_url, kind="profile"))
    if not card.profile_url:
        card.profile_url = next((l.url for l in kept_links if l.kind == "profile"), None)
    seen_links: set[str] = set()
    ordered = []
    for link in sorted(kept_links, key=lambda l: KIND_ORDER.get(l.kind, 3)):
        key = normalize_url(link.url)
        if key not in seen_links:
            seen_links.add(key)
            ordered.append(link)
    card.links = ordered[:config.MAX_LINKS]

    # 3. Proof of their work: a profile page or a page about their work, not only event listings.
    if not any(l.kind in ("profile", "work") for l in card.links):
        note("dropped_no_work_proof", "only event listings found; no profile page or page about their work")
        return None, removals

    # 3b. LinkedIn can't be read by our page reader, so a LinkedIn profile alone isn't enough proof:
    #     it needs one more confirmed page (a talk, article, or organization page) alongside it.
    non_linkedin = [l for l in card.links if "linkedin.com" not in l.url.lower()]
    if not non_linkedin and not any("linkedin.com" not in u.lower() for u in card.evidence_urls):
        note("dropped_linkedin_only", "LinkedIn was the only page about them; needs one more confirmed page")
        return None, removals

    # 4. A real job title, not an event role.
    if WEAK_TITLE_RE.search(card.job_title) or len(card.job_title.strip()) < 3:
        note("dropped_weak_title", f"no real job title confirmed (got: {card.job_title!r})")
        return None, removals

    # 5. Photos: only an image found on their own profile page, or Wikipedia.
    if card.photo_url:
        owner = trace.image_owner_pages.get(normalize_url(card.photo_url), "")
        profile_pages = {normalize_url(l.url) for l in card.links if l.kind == "profile"}
        if not trace.image_was_seen(card.photo_url):
            note("photo_removed", f"photo was not found on any page read in this search: {card.photo_url}")
            card.photo_url = None
        elif normalize_url(owner) not in profile_pages and "wikipedia.org" not in owner:
            note("photo_removed", f"photo came from a page that is not their profile ({owner})")
            card.photo_url = None

    # 6. Scrub contact details.
    from datetime import datetime, timezone
    card.verified_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    n = _scrub_card(card)
    if n:
        note("contact_info_removed", f"{n} email address(es) or phone number(s) removed")

    return card, removals


def finalize(results: list[CategoryResult], skip_names: list[str], per_category: int) -> list[Removal]:
    """Checks 5 and 6 across categories, then keep the top `per_category` per category."""
    removals: list[Removal] = []
    skip = {name_key(n) for n in skip_names}

    # 5. Skip list.
    for res in results:
        keep = []
        for card in res.cards:
            if name_key(card.name) in skip:
                removals.append(Removal(category=res.category, name=card.name, what="skip_list",
                                        detail="on the planner's already-booked / skip list"))
            else:
                keep.append(card)
        res.cards = keep

    # 6. Same person in two categories: keep the higher fit score.
    best: dict[str, tuple[int, str]] = {}
    for res in results:
        for card in res.cards:
            key = name_key(card.name)
            if key not in best or card.fit_score > best[key][0]:
                best[key] = (card.fit_score, res.category)
    kept: set[str] = set()
    for res in results:
        keep = []
        for card in res.cards:
            key = name_key(card.name)
            if best[key][1] == res.category and key not in kept:
                keep.append(card)
                kept.add(key)
            else:
                removals.append(Removal(category=res.category, name=card.name, what="duplicate_merged",
                                        detail="also found in another category; kept once"))
        res.cards = keep

    # Show 1-5 per category: the strongest fits first, weak fits only if nothing else was found.
    for res in results:
        ranked = sorted(res.cards, key=lambda c: (c.fit_score, len(c.past_speaking)), reverse=True)
        strong = [c for c in ranked if c.fit_score >= config.MIN_FIT_TO_SHOW]
        res.cards = (strong or ranked[:1])[:per_category]
    return removals


# ============================================================================
# Panels
# ============================================================================

def _talk_urls(card: SpeakerCard) -> dict[str, str]:
    """Normalized URL -> event label, for every talk / speaking page on a card."""
    out = {normalize_url(t.url): t.event for t in card.past_speaking}
    for link in card.links:
        if link.kind == "talk":
            out.setdefault(normalize_url(link.url), link.label)
    return out


def shared_stages(cards: list[tuple[str, SpeakerCard]]) -> dict[frozenset[str], list[str]]:
    """Pairs of people who appear on the same event page. Zero tokens: just comparing links.

    Returns {frozenset({name_a, name_b}): [event labels]}.
    """
    talks = [(card.name, _talk_urls(card)) for _, card in cards]
    pairs: dict[frozenset[str], list[str]] = {}
    for i in range(len(talks)):
        for j in range(i + 1, len(talks)):
            (a, ta), (b, tb) = talks[i], talks[j]
            common = set(ta) & set(tb)
            if common:
                pairs[frozenset({a, b})] = sorted({ta[u] for u in common})[:2]
    return pairs


def check_panels(panels: list[PanelSuggestion], cards: list[tuple[str, SpeakerCard]],
                 stages: dict[frozenset[str], list[str]], max_size: int = 4) -> tuple[list[PanelSuggestion], list[str]]:
    """Keep only panels made of real people from this search, from 2+ categories. Returns (panels, notes)."""
    lookup = {name_key(card.name): (cat, card.name) for cat, card in cards}
    kept: list[PanelSuggestion] = []
    notes: list[str] = []
    for p in panels:
        members: list[PanelMember] = []
        for m in p.members:
            hit = lookup.get(name_key(m.name))
            if hit is None:
                notes.append(f"Panel '{p.title}': removed '{m.name}' (not a verified person in this search)")
                continue
            if any(name_key(x.name) == name_key(m.name) for x in members):
                continue
            members.append(PanelMember(name=hit[1], category=hit[0], angle=m.angle))
        members = members[:max_size]
        if p.moderator:
            hit = lookup.get(name_key(p.moderator.name))
            if hit is None or any(name_key(x.name) == name_key(p.moderator.name) for x in members):
                if hit is None:
                    notes.append(f"Panel '{p.title}': removed moderator '{p.moderator.name}' (not in this search)")
                p.moderator = None
            else:
                p.moderator = PanelMember(name=hit[1], category=hit[0], angle=p.moderator.angle)
        if len(members) < 3 or len({m.category for m in members}) < 2:
            notes.append(f"Panel '{p.title}': dropped (needs 3+ verified people from 2+ categories)")
            continue
        p.members = members
        names = [m.name for m in members] + ([p.moderator.name] if p.moderator else [])
        p.shared_stage = [
            f"{a} and {b} both appeared at: {', '.join(events)}"
            for pair, events in stages.items() if pair <= set(names)
            for a, b in [sorted(pair)]
        ]
        kept.append(p)
    return kept, notes


__all__ = ["check_card", "finalize", "scrub_contact", "name_key", "normalize_url", "shared_stages", "check_panels"]
