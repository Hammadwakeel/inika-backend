from __future__ import annotations

import time
from typing import Any

from fastapi import BackgroundTasks

from backend.app.services.auth import get_tenant_conn
from backend.app.services.llm_service import chat_completion
from backend.app.services.memory_manager import (
    append_session_message,
    ensure_session_schema,
    get_agent_settings,
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
    llm_timeout: int | None = None,
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

    # Get agent settings
    agent_settings = get_agent_settings(tenant_id)
    use_knowledge_base = agent_settings.get("use_knowledge_base", True)
    use_web_search_setting = agent_settings.get("use_web_search", False)

    rag_context = []
    rag_score = 0.0
    wiki_context = []
    wiki_score = 0.0

    # Only search knowledge base if enabled
    if use_knowledge_base:
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="SEARCHING",
            detail="RAG_SCAN_LOCAL_INDEX",
            source="faiss",
        )
        rag_context, rag_score = rag_search(tenant_id=tenant_id, query=user_msg, top_k=4)

        # Also try wiki search as additional context source
        try:
            from backend.wiki_engine import search_wiki
            wiki_context, wiki_score = search_wiki(tenant_id, user_msg, top_k=2)
        except Exception:  # noqa: BLE001
            pass

    live_query = is_live_information_query(user_msg)
    rag_threshold = get_rag_threshold(tenant_id)

    context_rows = rag_context
    route = "RAG"
    context_source = "faiss"

    # Determine best context based on agent settings and scores
    use_rag = use_knowledge_base and rag_score >= rag_threshold and rag_context
    use_wiki = use_knowledge_base and wiki_score >= 0.3 and wiki_context and not use_rag

    if use_rag:
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="ROUTING",
            detail=f"USING_RAG_CONTEXT (score={rag_score:.3f})",
            score=rag_score,
            source="router",
        )
        context_source = "faiss"
    elif use_wiki:
        context_rows = wiki_context
        context_source = "wiki"
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="ROUTING",
            detail=f"USING_WIKI_CONTEXT (score={wiki_score:.3f})",
            score=wiki_score,
            source="router",
        )
    elif use_web_search_setting and live_query:
        # Only use web search if enabled in settings AND it's a live query
        route = "WEB_SEARCH"
        context_rows = web_search(query=user_msg, max_results=5)
        context_source = "web"
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="ROUTING",
            detail=f"TRIGGERING_WEB_SEARCH (LIVE_INFO_QUERY, ENABLED_IN_SETTINGS)",
            score=rag_score,
            source="router",
        )
        log_search_event(
            tenant_id=tenant_id,
            session_id=session_id,
            user_query=user_msg,
            event_type="WEB_DATA",
            detail="FETCHED_REAL_TIME_INFO",
            source="web",
        )
    else:
        # No RAG or wiki results - use empty context or web if enabled for non-live queries
        if use_web_search_setting and not live_query:
            route = "WEB_SEARCH"
            context_rows = web_search(query=user_msg, max_results=5)
            context_source = "web"
            log_search_event(
                tenant_id=tenant_id,
                session_id=session_id,
                user_query=user_msg,
                event_type="ROUTING",
                detail=f"USING_WEB_SEARCH (ENABLED_IN_SETTINGS)",
                score=rag_score,
                source="router",
            )
        elif rag_context:
            log_search_event(
                tenant_id=tenant_id,
                session_id=session_id,
                user_query=user_msg,
                event_type="ROUTING",
                detail=f"USING_RAG_CONTEXT_BELOW_THRESHOLD (score={rag_score:.3f}, threshold={rag_threshold})",
                score=rag_score,
                source="router",
            )
        elif wiki_context:
            context_rows = wiki_context
            context_source = "wiki"
            log_search_event(
                tenant_id=tenant_id,
                session_id=session_id,
                user_query=user_msg,
                event_type="ROUTING",
                detail=f"USING_WIKI_CONTEXT (score={wiki_score:.3f})",
                score=wiki_score,
                source="router",
            )
        else:
            log_search_event(
                tenant_id=tenant_id,
                session_id=session_id,
                user_query=user_msg,
                event_type="ROUTING",
                detail="NO_CONTEXT_FOUND_USING_EMPTY_CONTEXT",
                score=rag_score,
                source="router",
            )

    context_block = _build_context_block(context_rows)
    history_block = _build_history_block(history_rows)

    # Build hotel-specific system prompt
    base_identity = identity.get('base_identity', '') or 'You are a helpful hotel concierge assistant.'
    behavioral_rules = identity.get('behavioral_rules', '') or (
        '1. Always answer questions about the hotel using the provided context\n'
        '2. Be friendly, helpful, and concise\n'
        '3. If the answer is not in the context, say you do not have that information\n'
        '4. Do not make up information about the hotel'
    )

    final_system_prompt = (
        f"You are a hotel concierge assistant.\n\n"
        f"{base_identity}\n\n"
        f"Guidelines:\n{behavioral_rules}\n\n"
        "IMPORTANT: Use the Retrieved Context below to answer questions about the hotel. "
        "If the context does not contain the answer, politely say you do not have that information. "
        "Do NOT provide generic hotel industry information."
    )
    final_user_prompt = (
        f"[Retrieved Context - Use this to answer]\n{context_block or 'No context available.'}\n\n"
        f"[Previous Conversation]\n{history_block or 'No prior messages.'}\n\n"
        f"[Guest Question]\n{user_msg}"
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
        assistant_response = chat_completion(system_prompt=final_system_prompt, user_prompt=final_user_prompt, timeout=llm_timeout)
    except TimeoutError as exc:
        raise TimeoutError(f"LLM request timed out: {exc}") from exc
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
        "rag_threshold": rag_threshold,
        "wiki_score": wiki_score,
        "live_query": live_query,
        "context_source": context_source,
        "context_count": len(context_rows),
        "context": context_rows,
        "response": assistant_response,
    }

