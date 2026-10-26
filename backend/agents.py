"""The Speaker Scout agent team.

    Scout Lead ──► 6 × (Category Searcher ──► Category Verifier), side by side ──► code checks ──► cards

Every agent is gpt-6-luna through Portkey (PydanticAI, OpenAI Responses API).
  - Scout Lead: plans search angles per category. No tools.
  - Category Searcher: gpt-6-luna's built-in web search (capped), returns candidates with sources.
  - Category Verifier: fetch_page + wiki_lookup (+ one fallback web search), confirms people, writes cards.
Then guards.py rejects invented links and photos, scrubs contact details, applies the skip list,
merges duplicates, and keeps the top N per category.

The work order is fixed (no agent can call another), so nothing can loop.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from collections.abc import Callable
from datetime import datetime, timezone

from openai import AsyncOpenAI
from pydantic_ai import Agent
from pydantic_ai.capabilities import WebSearch
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.models.openai import OpenAIResponsesModel, OpenAIResponsesModelSettings
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

import audit
import config
from guards import check_card, check_panels, finalize, name_key, shared_stages
from models import (CATEGORY_LABELS, ChatAnswer, EmailDraft, ProgramReview, ReplacementResult, SpeakerCard, CategoryResult, DroppedCandidate, PanelPlan, PanelReview, ProgressEvent, Removal, SearchBrief, SearcherOutput, SearchPlan,
                    SearchResult, VerifierOutput)
from tools import RunTrace, ScoutDeps, fetch_page, wiki_lookup

EventCallback = Callable[[ProgressEvent], None]


# ============================================================================
# Model and prompts
# ============================================================================

def build_model() -> OpenAIResponsesModel:
    key = config.portkey_api_key()
    client = AsyncOpenAI(base_url=config.PORTKEY_BASE_URL, api_key=key,
                         default_headers={"x-portkey-api-key": key})
    settings = OpenAIResponsesModelSettings(
        max_tokens=config.MAX_OUTPUT_TOKENS,
        openai_reasoning_effort=config.REASONING_EFFORT,
        openai_include_web_search_sources=True,   # so the code knows every URL search returned
    )
    return OpenAIResponsesModel(config.MODEL_NAME, provider=OpenAIProvider(openai_client=client), settings=settings)


def _instructions(role: str) -> str:
    # Shared rules first and identical for every agent, so repeated calls can reuse the cached prefix.
    shared = (config.PROMPTS_DIR / "shared_rules.md").read_text()
    return shared + "\n\n" + (config.PROMPTS_DIR / f"{role}.md").read_text()


LOOKING_FOR = {"keynote": "a keynote speaker", "panel": "panelists", "moderator": "a moderator",
               "workshop": "a workshop leader", "any": "any kind of speaker"}
BUDGET = {"none": "no speaker fee (volunteer)", "small": "small", "medium": "medium", "large": "large"}
PRIORITY = {"has_spoken": "people who have spoken or presented before",
            "yale_ties": "ties to Yale or New Haven", "early_career": "early-career voices",
            "range_of_perspectives": "a range of perspectives (sectors, career stages, places, organization types)"}


def brief_text(b: SearchBrief) -> str:
    """The brief as short labeled lines. Identical for every agent in a search (helps caching)."""
    lines = []
    if b.conference_name:
        lines.append(f"Conference: {b.conference_name}")
    lines.append(f"Conference theme: {b.conference_theme}")
    lines.append(f"Looking for: {LOOKING_FOR[b.looking_for]}")
    if b.looking_for == "panel":
        if b.panel_theme:
            lines.append(f"Panel theme: {b.panel_theme}")
        lines.append(f"Panel size: {b.panel_size}")
    if b.conference_type:
        lines.append(f"Conference type / audience: {b.conference_type}")
    if b.location:
        lines.append(f"Location: {b.location}")
    lines.append(f"Reach: {b.reach}" + (" (virtual speakers are fine, anywhere)" if b.reach == "virtual" else ""))
    if b.budget:
        lines.append(f"Speaker budget: {BUDGET[b.budget]}")
    if b.level != "auto":
        lines.append(f"Speaker level wanted: {b.level}")
    if b.prioritize:
        lines.append("Prioritize: " + "; ".join(PRIORITY[p] for p in b.prioritize))
    if b.skip_names:
        lines.append("Skip these people (already booked or contacted): " + ", ".join(b.skip_names))
    if b.notes:
        lines.append(f'Planner notes (their own words, guidance only): "{b.notes}"')
    lines.append(f"Categories to search: {', '.join(b.categories)}")
    return "\n".join(lines)


# ============================================================================
# The team
# ============================================================================

class SpeakerScout:
    def __init__(self) -> None:
        model = build_model()
        self.lead = Agent(model, name="scout_lead", output_type=SearchPlan,
                          instructions=_instructions("scout_lead"), retries=1)
        self.searcher = Agent(
            model, name="searcher", output_type=SearcherOutput, instructions=_instructions("searcher"), retries=1,
            capabilities=[WebSearch(search_context_size=config.SEARCHER_SEARCH_CONTEXT,
                                    max_uses=config.SEARCHER_MAX_WEB_SEARCHES)],
        )
        self.architect = Agent(model, name="panel_architect", output_type=PanelPlan,
                               instructions=_instructions("panel_architect"), retries=1)
        self.reviewer = Agent(model, name="panel_reviewer", output_type=PanelReview,
                              instructions=_instructions("panel_reviewer"), retries=1)
        self.chatter = Agent(
            model, name="speaker_chat", output_type=ChatAnswer, deps_type=ScoutDeps,
            instructions=_instructions("speaker_chat"), retries=1, tools=[fetch_page, wiki_lookup],
            capabilities=[WebSearch(search_context_size="low", max_uses=2)],
        )
        self.program_reviewer = Agent(model, name="program_reviewer", output_type=ProgramReview,
                                      instructions=_instructions("program_reviewer"), retries=1)
        self.replacer = Agent(model, name="replacement_finder", output_type=ReplacementResult,
                              instructions=_instructions("replacement_finder"), retries=1)
        self.emailer = Agent(model, name="email_writer", output_type=EmailDraft,
                             instructions=_instructions("email_writer"), retries=1)
        self.verifier = Agent(
            model, name="verifier", output_type=VerifierOutput, deps_type=ScoutDeps,
            instructions=_instructions("verifier"), retries=1, tools=[fetch_page, wiki_lookup],
            capabilities=[WebSearch(search_context_size="low", max_uses=config.VERIFIER_MAX_WEB_SEARCHES)],
        )

    async def suggest_panels(self, result: SearchResult, emit=None) -> None:
        """Panel Architect: propose 2-3 cross-discipline panels from the verified cards. No web search."""
        cards = [(c.category, card) for c in result.categories for card in c.cards]
        if len(cards) < 3 or len({cat for cat, _ in cards}) < 2:
            result.panels = []
            return
        if emit:
            emit("Panel Architect", "Looking for people who would make great panels together…")
        stages = shared_stages(cards)
        compact = [{
            "name": card.name, "category": cat, "title": f"{card.job_title}, {card.organization}",
            "level": card.level, "best_for": card.best_for, "could_speak_on": card.could_speak_on,
            "talk_ideas": card.talk_ideas[:3], "tags": card.topic_tags[:4],
            "past_events": [t.event for t in card.past_speaking[:3]],
        } for cat, card in cards]
        stage_text = "\n".join(f"- {' & '.join(sorted(pair))}: {', '.join(ev)}" for pair, ev in stages.items()) or "- none found"
        run = await self.architect.run(
            f"Planner's brief:\n{brief_text(result.brief)}\n\n"
            f"People who already appeared at the same event:\n{stage_text}\n\n"
            f"Verified speaker cards:\n{json.dumps(compact, indent=1)}",
            usage_limits=UsageLimits(request_limit=2, total_tokens_limit=config.AGENT_TOKEN_LIMIT),
        )
        msgs = run.all_messages()
        audit.log_agent_run(result.id, "panel_architect", None, msgs)
        u = audit.usage_of(msgs)
        u.cost_usd = audit.cost_of(u)
        result.panel_usage = u
        size = result.brief.panel_size if result.brief.looking_for == "panel" else 4
        panels, notes = check_panels(run.output.panels, cards, stages, max_size=size)
        result.panels = panels
        for n in notes:
            result.removals.append(Removal(category="panel", name="Panel Architect", what="panel_member_removed", detail=n))
        if emit:
            emit("Panel Architect", f"Suggested {len(panels)} panel(s)" + (": " + "; ".join(p.title for p in panels) if panels else ""))

    async def review_panel(self, group: dict, members: list[tuple[str, SpeakerCard, str]],
                           pool: list[tuple[str, str, SpeakerCard, bool]],
                           placed: dict[str, str | None] | None = None) -> PanelReview:
        """Panel Architect reviews a panel the planner built. members: (category, card, note).
        pool: (search_id, category, card, on_shortlist) people who could be added. No web search."""
        def brief_card(cat: str, card: SpeakerCard) -> dict:
            return {"name": card.name, "category": cat, "title": f"{card.job_title}, {card.organization}",
                    "location": card.location, "level": card.level, "best_for": card.best_for,
                    "could_speak_on": card.could_speak_on, "tags": card.topic_tags[:6],
                    "past_events": [t.event for t in card.past_speaking[:3]]}
        panel = [{**brief_card(cat, card), "planner_note": note} for cat, card, note in members]
        placed = placed or {}
        candidates = [{**brief_card(cat, card), "on_shortlist": on,
                       "already_in_group": placed.get(name_key(card.name))} for _, cat, card, on in pool]
        run = await self.reviewer.run(
            f"Panel name: {group['name']}\nPanel theme / question: {group['theme'] or '(not set)'}\n\n"
            f"Current panel ({len(panel)} people):\n{json.dumps(panel, indent=1)}\n\n"
            f"Candidate pool (people the planner has found; suggest only from here):\n{json.dumps(candidates, indent=1)}",
            usage_limits=UsageLimits(request_limit=2, total_tokens_limit=config.AGENT_TOKEN_LIMIT),
        )
        msgs = run.all_messages()
        audit.log_agent_run(f"group-{group['id']}", "panel_reviewer", None, msgs)
        review = run.output
        u = audit.usage_of(msgs)
        review.tokens = u.input_tokens + u.output_tokens
        # Code check: suggestions must be real people from the pool, not already on the panel.
        lookup = {name_key(card.name): (sid, cat, card, on) for sid, cat, card, on in pool}
        on_panel = {name_key(card.name) for _, card, _ in members}
        kept = []
        for sug in review.suggestions:
            hit = lookup.get(name_key(sug.name))
            if hit is None or name_key(sug.name) in on_panel or any(name_key(k.name) == name_key(sug.name) for k in kept):
                continue
            sid, cat, card, on = hit
            sug.name, sug.category, sug.search_id, sug.on_shortlist = card.name, cat, sid, on
            kept.append(sug)
        review.suggestions = kept[:4]
        review.reviewed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return review

    @staticmethod
    def _brief_card(cat: str, card: SpeakerCard) -> dict:
        return {"name": card.name, "category": cat, "title": f"{card.job_title}, {card.organization}",
                "location": card.location, "level": card.level, "best_for": card.best_for,
                "speaking": card.speaking_badge, "could_speak_on": card.could_speak_on, "tags": card.topic_tags[:6]}

    @staticmethod
    def _filter_pool(suggestions, pool, exclude: set[str]):
        lookup = {name_key(card.name): (sid, cat, card, on) for sid, cat, card, on in pool}
        kept = []
        for sug in suggestions:
            hit = lookup.get(name_key(sug.name))
            if hit is None or name_key(sug.name) in exclude or any(name_key(k.name) == name_key(sug.name) for k in kept):
                continue
            sid, cat, card, on = hit
            sug.name, sug.category, sug.search_id, sug.on_shortlist = card.name, cat, sid, on
            kept.append(sug)
        return kept

    async def review_program(self, conference: str, sessions: list[dict], pool: list[tuple[str, str, SpeakerCard, bool]],
                             mix: dict) -> ProgramReview:
        """Panel Architect review of the whole program. sessions: [{name, kind, theme, people:[(cat, card, status)]}]."""
        program = [{"session": s["name"], "kind": s["kind"], "theme": s["theme"] or None,
                    "people": [{**self._brief_card(cat, card), "outreach": st} for cat, card, st in s["people"]]}
                   for s in sessions]
        candidates = [self._brief_card(cat, card) | {"on_shortlist": on} for _, cat, card, on in pool]
        run = await self.program_reviewer.run(
            f"Conference: {conference}\n\nCounts computed by code: {json.dumps(mix)}\n\n"
            f"Program:\n{json.dumps(program, indent=1)}\n\nCandidate pool:\n{json.dumps(candidates, indent=1)}",
            usage_limits=UsageLimits(request_limit=2, total_tokens_limit=config.AGENT_TOKEN_LIMIT))
        msgs = run.all_messages()
        audit.log_agent_run(f"program-{name_key(conference).replace(' ', '-')}", "program_reviewer", None, msgs)
        review = run.output
        placed = {name_key(card.name) for s in sessions for _, card, _ in s["people"]}
        review.suggestions = self._filter_pool(review.suggestions, pool, placed)[:5]
        review.mix = mix
        u = audit.usage_of(msgs)
        review.tokens = u.input_tokens + u.output_tokens
        review.reviewed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return review

    async def find_replacement(self, declined: tuple[str, SpeakerCard], session: dict | None,
                               pool: list[tuple[str, str, SpeakerCard, bool]]) -> ReplacementResult:
        cat, card = declined
        sess = None
        if session:
            sess = {"name": session["name"], "kind": session["kind"], "theme": session["theme"] or None,
                    "other_members": [self._brief_card(c, k) for c, k in session["others"]]}
        run = await self.replacer.run(
            f"Declined speaker:\n{json.dumps(self._brief_card(cat, card), indent=1)}\n\n"
            f"Session they were meant for: {json.dumps(sess, indent=1) if sess else '(not placed in a session)'}\n\n"
            f"Candidate pool:\n{json.dumps([self._brief_card(c, k) | {'on_shortlist': on} for _, c, k, on in pool], indent=1)}",
            usage_limits=UsageLimits(request_limit=2, total_tokens_limit=config.AGENT_TOKEN_LIMIT))
        msgs = run.all_messages()
        audit.log_agent_run(f"replace-{name_key(card.name).replace(' ', '-')}", "replacement_finder", None, msgs)
        out = run.output
        exclude = {name_key(card.name)} | ({name_key(k.name) for _, k in session["others"]} if session else set())
        out.suggestions = self._filter_pool(out.suggestions, pool, exclude)[:3]
        u = audit.usage_of(msgs)
        out.tokens = u.input_tokens + u.output_tokens
        return out

    async def ask_about(self, card: SpeakerCard, question: str, history: list[dict]) -> ChatAnswer:
        """Answer a planner's question about one speaker, searching the web only if needed.
        Code check: every source must be a page that was actually seen in this answer (or on the card)."""
        trace = RunTrace()
        for u in [*card.evidence_urls, *(l.url for l in card.links), *(t.url for t in card.past_speaking)]:
            trace.saw(u)
        convo = "\n".join(f"{m['role'].upper()}: {m['text'][:800]}" for m in history[-6:])
        prompt = (f"Today's date: {datetime.now(timezone.utc).date().isoformat()}\n\nSpeaker card (verified):\n{card.model_dump_json(indent=1, exclude={'photo_url'})}\n\n"
                  + (f"Conversation so far:\n{convo}\n\n" if convo else "")
                  + f"Planner's question: {question}")
        run = await self.chatter.run(prompt, deps=ScoutDeps(trace=trace, category="chat"),
                                     usage_limits=UsageLimits(request_limit=6, tool_calls_limit=6,
                                                              total_tokens_limit=80_000))
        msgs = run.all_messages()
        audit.collect_sources(msgs, trace)
        audit.log_agent_run(f"chat-{name_key(card.name).replace(' ', '-')}", "speaker_chat", None, msgs)
        ans = run.output
        ans.sources = [s for s in ans.sources if trace.was_seen(s.url)][:6]
        from guards import scrub_contact
        # Built-in search sometimes leaves inline citation markers in the text; sources are listed separately.
        clean = lambda t: re.sub(r"\s*(\ue200.*?\ue201|cite(?:turn\d+[a-z]+\d+)+)", "", t).strip()
        ans.answer, ans.note = clean(ans.answer), clean(ans.note)
        ans.answer, _ = scrub_contact(ans.answer)
        ans.note, _ = scrub_contact(ans.note)
        u = audit.usage_of(msgs)
        ans.tokens, ans.web_searches = u.input_tokens + u.output_tokens, u.web_searches
        return ans

    async def draft_email(self, item: dict, conference: str, group: dict | None, sender: str, extra: str) -> EmailDraft:
        """Draft a first invitation email for a shortlisted speaker. Draft only: the app never sends email."""
        card = SpeakerCard.model_validate(item["card"])
        session = None
        if group:
            session = {"type": "keynote" if group["kind"] == "keynote" else "panel", "name": group["name"],
                       "theme": group["theme"] or None, "date": group.get("session_date"),
                       "time": group.get("session_time") or None, "room": group.get("session_room") or None}
        payload = {
            "speaker": {"name": card.name, "title": card.job_title, "organization": card.organization,
                        "could_speak_on": card.could_speak_on, "talk_ideas": card.talk_ideas[:3],
                        "notable_work": card.notable_work[:3], "past_talks": [t.event for t in card.past_speaking[:3]],
                        "best_for": card.best_for},
            "conference": conference, "session": session,
            "fee": item.get("fee") or None, "travel_support": item.get("travel") or None,
            "sender_name": sender or None, "planner_notes": extra or None,
        }
        run = await self.emailer.run(f"Draft the invitation from this information:\n{json.dumps(payload, indent=1)}",
                                     usage_limits=UsageLimits(request_limit=2, total_tokens_limit=40_000))
        msgs = run.all_messages()
        audit.log_agent_run(f"item-{item['id']}", "email_writer", None, msgs)
        draft = run.output
        u = audit.usage_of(msgs)
        draft.tokens = u.input_tokens + u.output_tokens
        draft.created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return draft

    async def run(self, brief: SearchBrief, on_event: EventCallback | None = None,
                  search_id: str | None = None,
                  on_start: Callable[[SearchResult], None] | None = None) -> SearchResult:
        """Run one search. `on_start` gets the live result object, which fills in as categories finish."""
        start = time.monotonic()
        result = SearchResult(
            id=search_id or uuid.uuid4().hex[:10], status="running", brief=brief, model=config.MODEL_NAME,
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )
        trace = RunTrace()
        if on_start:
            on_start(result)

        def emit(agent: str, message: str, category: str | None = None) -> None:
            ev = ProgressEvent(ts=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                               seconds=round(time.monotonic() - start, 1), agent=agent,
                               category=category, message=message)
            result.events.append(ev)
            if on_event:
                on_event(ev)

        audit.write("search_start", search_id=result.id, model=config.MODEL_NAME, brief=brief.model_dump(),
                    limits={"searches_per_searcher": config.SEARCHER_MAX_WEB_SEARCHES,
                            "tokens_per_agent": config.AGENT_TOKEN_LIMIT,
                            "tokens_per_search": config.SEARCH_TOKEN_LIMIT})
        b_text = brief_text(brief)
        try:
            # ---- 1. Scout Lead ------------------------------------------------
            emit("Scout Lead", "Reading your brief and planning the search…")
            lead_run = await self.lead.run(
                f"Planner's brief:\n{b_text}",
                usage_limits=UsageLimits(request_limit=2, total_tokens_limit=config.AGENT_TOKEN_LIMIT),
            )
            plan = lead_run.output
            plan.angles = [a for a in plan.angles if a.category in brief.categories]
            result.plan = plan
            messages = lead_run.all_messages()
            audit.log_agent_run(result.id, "scout_lead", None, messages)
            result.usage.add(audit.usage_of(messages))
            emit("Scout Lead", f"Plan ready: {plan.summary}")

            # ---- 2. Searcher → Verifier per category, all at once ---------------
            result.categories = [CategoryResult(category=c, label=CATEGORY_LABELS[c]) for c in brief.categories]
            await asyncio.gather(*(self._run_category(cr, brief, b_text, plan, trace, result, emit)
                                   for cr in result.categories))

            # ---- 3. Cross-category checks ---------------------------------------
            result.removals.extend(finalize(result.categories, brief.skip_names, brief.per_category))
            result.injection_flags = list(dict.fromkeys(result.injection_flags + trace.injection_warnings))

            # ---- 4. Panel Architect (cheap: no web, just the verified cards) ----
            try:
                await self.suggest_panels(result, emit)
                if result.panel_usage:
                    result.usage.add(result.panel_usage)
            except Exception as e:  # noqa: BLE001 - panels are a bonus; never fail the search over them
                emit("Panel Architect", f"Couldn't suggest panels this time ({type(e).__name__}).")
            shown = sum(len(c.cards) for c in result.categories)
            emit("Scout", f"Done: {shown} verified speakers across {len(result.categories)} categories.")
            result.status = "done"
        except Exception as e:  # noqa: BLE001 - report any failure to the planner instead of crashing
            result.status = "error"
            result.error = f"{type(e).__name__}: {e}"
            emit("Scout", f"Something went wrong: {result.error}")
        finally:
            result.usage.page_reads = trace.page_reads
            result.usage.cost_usd = audit.cost_of(result.usage)
            result.seconds = round(time.monotonic() - start, 1)
            audit.write("search_end", search_id=result.id, status=result.status, error=result.error,
                        seconds=result.seconds, usage=result.usage.model_dump(),
                        shown={c.category: len(c.cards) for c in result.categories},
                        dropped={c.category: len(c.dropped) for c in result.categories},
                        removals=len(result.removals), injection_flags=result.injection_flags)
        return result

    async def _run_category(self, cr: CategoryResult, brief: SearchBrief, b_text: str, plan: SearchPlan,
                            trace: RunTrace, result: SearchResult, emit) -> None:
        cat, label = cr.category, cr.label
        t0 = time.monotonic()
        angles = next((a.angles for a in plan.angles if a.category == cat), [])
        plan_text = (f"Scout Lead summary: {plan.summary}\nTarget level: {plan.target_level}\n"
                     f"Target roles: {', '.join(plan.target_roles)}\n"
                     f"Location focus: {plan.location_focus or 'anywhere'}")
        try:
            # ---- Searcher ----
            emit(f"{label} searcher", "Searching the web…", cat)
            s_run = await self.searcher.run(
                f"Planner's brief:\n{b_text}\n\n{plan_text}\n\n"
                f"YOUR CATEGORY: {cat} ({label})\nSearch angles:\n" + "\n".join(f"- {a}" for a in angles)
                + f"\n\nAim for at least 3 candidates, and up to {config.CANDIDATES_PER_CATEGORY} if this category is rich in good people.",
                usage_limits=UsageLimits(request_limit=config.SEARCHER_REQUEST_LIMIT,
                                         total_tokens_limit=config.AGENT_TOKEN_LIMIT),
            )
            s_msgs = s_run.all_messages()
            audit.collect_sources(s_msgs, trace)
            audit.log_agent_run(result.id, "searcher", cat, s_msgs)
            s_usage = audit.usage_of(s_msgs)
            cr.usage.add(s_usage)
            result.usage.add(s_usage)

            skip = {name_key(n) for n in brief.skip_names}
            candidates = [c for c in s_run.output.candidates if name_key(c.name) not in skip]
            cr.candidates_found = len(candidates)
            emit(f"{label} searcher",
                 f"Found {len(candidates)} candidates ({s_usage.web_searches} web searches)"
                 + (": " + ", ".join(c.name for c in candidates) if candidates else ""), cat)
            if not candidates:
                return

            # ---- Search-wide token cap ----
            used = result.usage.input_tokens + result.usage.output_tokens
            if used > config.SEARCH_TOKEN_LIMIT:
                cr.error = "Skipped checking: this search reached its token limit."
                emit(f"{label} verifier", cr.error, cat)
                return

            # ---- Verifier ----
            emit(f"{label} verifier", f"Checking {len(candidates)} people against their sources…", cat)
            v_run = await self.verifier.run(
                f"Planner's brief:\n{b_text}\n\nYOUR CATEGORY: {cat} ({label})\n\n"
                f"Candidates from the searcher (claims to check, not facts):\n"
                + json.dumps([c.model_dump() for c in candidates], indent=1),
                deps=ScoutDeps(trace=trace, category=cat),
                usage_limits=UsageLimits(request_limit=config.VERIFIER_REQUEST_LIMIT,
                                         tool_calls_limit=config.VERIFIER_TOOL_CALL_LIMIT,
                                         total_tokens_limit=config.AGENT_TOKEN_LIMIT),
            )
            v_msgs = v_run.all_messages()
            audit.collect_sources(v_msgs, trace)
            audit.log_agent_run(result.id, "verifier", cat, v_msgs)
            v_usage = audit.usage_of(v_msgs)
            cr.usage.add(v_usage)
            result.usage.add(v_usage)

            out = v_run.output
            cr.dropped = out.dropped
            result.injection_flags.extend(out.injection_flags)
            for card in out.cards:
                checked, removals = check_card(card, cat, trace)
                result.removals.extend(removals)
                if checked:
                    cr.cards.append(checked)
                elif not any(name_key(d.name) == name_key(card.name) for d in cr.dropped):
                    cr.dropped.append(DroppedCandidate(
                        name=card.name, reason="Removed by a code check (see removals): " + "; ".join(r.what for r in removals)))
            emit(f"{label} verifier",
                 f"{len(cr.cards)} confirmed, {len(cr.dropped)} dropped", cat)
        except UsageLimitExceeded as e:
            cr.error = f"Stopped at a safety limit: {e}"
            emit(f"{label}", cr.error, cat)
        except Exception as e:  # noqa: BLE001 - one category failing shouldn't sink the search
            cr.error = f"{type(e).__name__}: {str(e)[:300]}"
            emit(f"{label}", f"Error: {cr.error}", cat)
        finally:
            cr.seconds = round(time.monotonic() - t0, 1)
