"""Audit trail: one JSON line per model call in output/audit_trail.jsonl, plus token and source accounting.

Each line records which agent ran, the model the provider reported, the tools it called, and its
token counts (input, cached input, output, reasoning) and web searches. These numbers feed the
Tokenomics section of the report.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Any

from pydantic_ai.messages import (ModelMessage, ModelResponse, NativeToolCallPart, NativeToolReturnPart,
                                  TextPart, ToolCallPart)

import config
from models import UsageTotals
from tools import RunTrace

_lock = threading.Lock()


def _trim(value: Any) -> Any:
    if isinstance(value, str):
        return value if len(value) <= config.AUDIT_TEXT_LIMIT else value[: config.AUDIT_TEXT_LIMIT] + "...[trimmed]"
    if isinstance(value, dict):
        return {k: _trim(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_trim(v) for v in value]
    return value


def write(event: str, **details: Any) -> None:
    entry = {"ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"), "event": event, **_trim(details)}
    config.AUDIT_TRAIL.parent.mkdir(parents=True, exist_ok=True)
    with _lock, config.AUDIT_TRAIL.open("a") as f:
        f.write(json.dumps(entry, default=str) + "\n")


def _web_searches(resp: ModelResponse) -> int:
    details = resp.usage.details or {}
    return int(details.get("web_search_requests", 0) or 0)


def usage_of(messages: list[ModelMessage]) -> UsageTotals:
    totals = UsageTotals()
    for msg in messages:
        if isinstance(msg, ModelResponse):
            u = msg.usage
            totals.model_calls += 1
            totals.input_tokens += u.input_tokens or 0
            totals.cached_input_tokens += u.cache_read_tokens or 0
            totals.cache_write_tokens += u.cache_write_tokens or 0
            totals.output_tokens += u.output_tokens or 0
            totals.reasoning_tokens += int((u.details or {}).get("reasoning_tokens", 0) or 0)
            totals.web_searches += _web_searches(msg)
    return totals


def cost_of(u: UsageTotals) -> float | None:
    """USD cost, if prices are configured. Cached input is billed at the cached rate, the rest at full rate."""
    if config.PRICE_INPUT_PER_M is None or config.PRICE_OUTPUT_PER_M is None:
        return None
    cached_rate = config.PRICE_CACHED_INPUT_PER_M if config.PRICE_CACHED_INPUT_PER_M is not None else config.PRICE_INPUT_PER_M
    write_rate = config.PRICE_CACHE_WRITE_PER_M if config.PRICE_CACHE_WRITE_PER_M is not None else config.PRICE_INPUT_PER_M
    # input_tokens includes cache reads and cache writes; bill each part at its own rate.
    fresh = max(u.input_tokens - u.cached_input_tokens - u.cache_write_tokens, 0)
    cost = (fresh * config.PRICE_INPUT_PER_M + u.cached_input_tokens * cached_rate
            + u.cache_write_tokens * write_rate + u.output_tokens * config.PRICE_OUTPUT_PER_M) / 1_000_000
    if config.PRICE_WEB_SEARCH_PER_K:
        cost += u.web_searches * config.PRICE_WEB_SEARCH_PER_K / 1000
    return round(cost, 4)


def collect_sources(messages: list[ModelMessage], trace: RunTrace) -> int:
    """Record every URL the built-in web search returned or opened. Returns how many were added."""
    before = len(trace.seen_urls)
    for msg in messages:
        for part in msg.parts:
            if isinstance(part, NativeToolReturnPart) and isinstance(part.content, dict):
                for src in part.content.get("sources") or []:
                    if isinstance(src, dict):
                        trace.saw(src.get("url"))
            elif isinstance(part, NativeToolCallPart):
                args = part.args if isinstance(part.args, dict) else {}
                trace.saw(args.get("url"))
    return len(trace.seen_urls) - before


def log_agent_run(search_id: str, agent: str, category: str | None, messages: list[ModelMessage]) -> None:
    """One audit line per model response in this agent run."""
    for msg in messages:
        if not isinstance(msg, ModelResponse):
            continue
        u = msg.usage
        tool_calls: list[dict[str, Any]] = []
        for part in msg.parts:
            if isinstance(part, ToolCallPart):
                tool_calls.append({"tool": part.tool_name, "args": part.args_as_dict()})
            elif isinstance(part, NativeToolCallPart):
                tool_calls.append({"tool": part.tool_name, "args": part.args})
        write(
            "model_response",
            search_id=search_id,
            agent=agent,
            category=category,
            model_requested=config.MODEL_NAME,
            model_reported=msg.model_name,
            input_tokens=u.input_tokens,
            cached_input_tokens=u.cache_read_tokens,
            cache_write_tokens=u.cache_write_tokens,
            output_tokens=u.output_tokens,
            reasoning_tokens=(u.details or {}).get("reasoning_tokens"),
            web_searches=_web_searches(msg),
            tool_calls=tool_calls,
            text=" ".join(p.content for p in msg.parts if isinstance(p, TextPart)) or None,
        )
