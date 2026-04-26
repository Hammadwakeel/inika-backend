from __future__ import annotations

import time
from typing import Any

from fastapi import BackgroundTasks

from backend.app.services.auth_service import get_tenant_conn
from backend.app.services.llm_service import chat_completion
from backend.app.services.memory_manager import (
    append_session_message,
    ensure_session_schema,
    get_message_count,
    get_or_create_session,
    get_rag_threshold,
    get_recent_messages,
    get_session_summary,
    summarize_session_window,
)
from backend.app.services.search_tool import is_live_information_query, rag_search, web_search
from backend.knowledge_engine import get_identity_prompts


def log_search_event(
    tenant_id: str,
    session_id: str,
    user_query: str,
    event_type: str,
    detail: str,
    score: float | None = None,
    source: str = "",
) -> None:
    ensure_session_schema(tenant_id)
    now_ts = int(time.time())
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            """
            INSERT INTO search_logs (session_id, user_query, event_type, detail, score, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (session_id, user_query, event_type, detail, score, source, now_ts),
        )
        conn.commit()


def get_recent_search_logs(tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    ensure_session_schema(tenant_id)
    with get_tenant_conn(tenant_id) as conn:
        rows = conn.execute(
            """
            SELECT session_id, user_query, event_type, detail, score, source, created_at
            FROM search_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        items: list[dict[str, Any]] = []
        for row in rows:
            ts = int(row["created_at"] or int(time.time()))
            hhmmss = time.strftime("%H:%M:%S", time.localtime(ts))
            score_text = f"_{float(row['score']):.2f}" if row["score"] is not None else ""
            items.append(
                {
                    "timestamp": ts,
                    "decision": row["event_type"],
                    "detail": f"[{hhmmss}] [SYSTEM]: {row['event_type']}{score_text} -> {row['detail']}",
                    "source": row["source"],
                    "session_id": row["session_id"],
                    "user_query": row["user_query"],
                    "score": row["score"],
                }
            )
        return items


def _build_context_block(context_rows: list[dict[str, Any]]) -> str:
    return "\n\n".join([f"[SOURCE: {row.get('source', 'unknown')}]\n{row.get('text', '')}" for row in context_rows]).strip()


def _build_history_block(history_rows: list[dict[str, Any]]) -> str:
    return "\n".join([f"{row.get('role', 'user').upper()}: {row.get('content', '')}" for row in history_rows]).strip()


def _summary_task(tenant_id: str, session_id: str) -> None:
    summarize_session_window(tenant_id=tenant_id, session_id=session_id)


def smart_query_router(
    tenant_id: str,
    guest_id: str,
    user_msg: str,
    background_tasks: BackgroundTasks | None = None,
) -> dict[str, Any]:
    session_id = get_or_create_session(tenant_id=tenant_id, guest_id=guest_id)
    append_session_message(tenant_id=tenant_id, session_id=session_id, role="user", content=user_msg)

    total_messages = get_message_count(tenant_id=tenant_id, session_id=session_id)
    if total_messages > 20:
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="MEMORY",
            detail="TRIGGERING_SUMMARIZATION_WINDOW",
            source="memory",
        )
        if background_tasks is not None:
            background_tasks.add_task(_summary_task, tenant_id, session_id)
        else:
            summarize_session_window(tenant_id=tenant_id, session_id=session_id)

    identity = get_identity_prompts(tenant_id)
    summary = get_session_summary(tenant_id=tenant_id, session_id=session_id)
    history_rows = get_recent_messages(tenant_id=tenant_id, session_id=session_id, limit=10)

    log_search_event(
        tenant_id=tenant_id,
        session_id=session_id,
        user_query=user_msg,
        event_type="SEARCHING",
        detail="RAG_SCAN_LOCAL_INDEX",
        source="faiss",
    )
    rag_context, rag_score = rag_search(tenant_id=tenant_id, query=user_msg, top_k=4)
    live_query = is_live_information_query(user_msg)
    rag_threshold = get_rag_threshold(tenant_id)

    context_rows = rag_context
    route = "RAG"
    if live_query or rag_score < rag_threshold:
        route = "WEB_SEARCH"
        reason = "LIVE_INFO_QUERY" if live_query else "LOW_RAG_SCORE"
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="ROUTING",
            detail=f"TRIGGERING_WEB_SEARCH ({reason})",
            score=rag_score,
            source="router",
        )
        context_rows = web_search(query=user_msg, max_results=5)
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="WEB_DATA",
            detail="FETCHED_REAL_TIME_INFO",
            source="web",
        )
    else:
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="ROUTING",
            detail="USING_RAG_CONTEXT",
            score=rag_score,
            source="router",
        )

    context_block = _build_context_block(context_rows)
    history_block = _build_history_block(history_rows)
    final_system_prompt = (
        "You are the Axiom Multi-Tenant AI Concierge.\n\n"
        f"[Base Identity]\n{identity.get('base_identity', '')}\n\n"
        f"[Behavioral Rules]\n{identity.get('behavioral_rules', '')}\n\n"
        "Follow identity and behavioral rules strictly."
    )
    final_user_prompt = (
        f"[Session Summary]\n{summary or 'No summary yet.'}\n\n"
        f"[Last 10 Messages]\n{history_block or 'No prior messages.'}\n\n"
        f"[Retrieved Context]\n{context_block or 'No context available.'}\n\n"
        f"[Current Query]\n{user_msg}"
    )

    log_search_event(
        tenant_id=tenant_id,
        session_id=session_id,
        user_query=user_msg,
        event_type="RESPONDING",
        detail="CALLING_OPENROUTER",
        source="llm",
    )
    try:
        assistant_response = chat_completion(system_prompt=final_system_prompt, user_prompt=final_user_prompt)
    except Exception:
        assistant_response = (
            "Routing and retrieval are complete, but the model response service is unavailable right now."
        )
    append_session_message(tenant_id=tenant_id, session_id=session_id, role="assistant", content=assistant_response)

    return {
        "tenant_id": tenant_id,
        "session_id": session_id,
        "route": route,
        "rag_score": rag_score,
        "live_query": live_query,
        "context": context_rows,
        "response": assistant_response,
    }

