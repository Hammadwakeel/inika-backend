"""
RAG chatbot routes with LLM Wiki pattern support.
Combines wiki-based search with fallback to FAISS and web search.
"""

from __future__ import annotations

import json
import time
from typing import Any, AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.tenant import validate_tenant_id
from app.services.auth_service import get_tenant_conn
from app.services.llm_service import chat_completion
from app.services.memory_manager import (
    append_session_message,
    ensure_session_schema,
    get_or_create_session,
    get_recent_messages,
    get_session_summary,
)
from app.services.search_tool import is_live_information_query, rag_search, web_search
from app.services.wiki_search import format_wiki_context, wiki_search
from knowledge_engine import get_identity_prompts
from wiki_engine import (
    build_wiki,
    get_index,
    get_schema,
    lint_wiki,
    load_pages,
    read_wiki_status,
    save_schema,
)

router = APIRouter(prefix="/rag", tags=["rag"])


def log_event(tenant_id: str, session_id: str, event_type: str, detail: str, score: float | None = None) -> None:
    ensure_session_schema(tenant_id)
    now_ts = int(time.time())
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            "INSERT INTO search_logs (session_id, user_query, event_type, detail, score, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, event_type, detail, "", score, "rag", now_ts),
        )
        conn.commit()


def _build_context_block(context_rows: list[dict[str, Any]]) -> str:
    return "\n\n".join([f"[SOURCE: {row.get('source', 'unknown')}]\n{row.get('text', '')}" for row in context_rows]).strip()


def _build_history_block(history_rows: list[dict[str, Any]]) -> str:
    return "\n".join([f"{row.get('role', 'user').upper()}: {row.get('content', '')}" for row in history_rows]).strip()


def _stream_openrouter(system_prompt: str, user_prompt: str) -> AsyncIterator[dict[str, Any]]:
    import urllib.request
    import os

    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    OPENROUTER_CHAT_MODEL = os.getenv("OPENROUTER_CHAT_MODEL", "openai/gpt-4o-mini")

    payload = {
        "model": OPENROUTER_CHAT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": True,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url=f"{OPENROUTER_BASE_URL}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Axiom RAG Chatbot",
        },
        method="POST",
    )

    buffer = ""
    with urllib.request.urlopen(req, timeout=120) as response:
        for line in response:
            line = line.decode("utf-8")
            if line.startswith("data: "):
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                    content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                        buffer += content
                        yield {"type": "token", "content": content, "buffer": buffer}
                except json.JSONDecodeError:
                    continue
            elif line.startswith("error:"):
                yield {"type": "error", "content": line[7:].strip()}
                break

    yield {"type": "done", "buffer": buffer}


class RagQueryPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    user_message: str = Field(min_length=1, max_length=4096)
    guest_id: str = Field(default="guest")
    stream: bool = Field(default=True)


class WikiUploadPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    text: str = Field(min_length=1)
    source_name: str = Field(default="uploaded-doc")


class WikiSchemaPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    schema_text: str


# ---------------------------------------------------------------------------
# Query endpoints (with wiki pattern)
# ---------------------------------------------------------------------------

@router.get("/query/stream")
async def rag_query_stream(request: Request, tenant_id: str, user_message: str, guest_id: str = "guest") -> StreamingResponse:
    safe_tenant = validate_tenant_id(tenant_id)

    async def event_generator() -> AsyncIterator[str]:
        try:
            session_id = get_or_create_session(tenant_id=safe_tenant, guest_id=guest_id)
            append_session_message(tenant_id=safe_tenant, session_id=session_id, role="user", content=user_message)

            # Try wiki search first (LLM Wiki pattern)
            yield json.dumps({"type": "status", "content": "searching_wiki"}) + "\n"
            wiki_results, wiki_score = wiki_search(tenant_id=safe_tenant, query=user_message, top_k=4)
            live_query = is_live_information_query(user_message)

            # Determine which source to use
            source_type = "wiki"
            context_text = ""
            sources = []

            if wiki_results and wiki_score >= 0.3:
                # Use wiki results
                yield json.dumps({"type": "context", "source": "wiki", "score": wiki_score}) + "\n"
                context_text = format_wiki_context(wiki_results)
                for r in wiki_results:
                    sources.append({
                        "title": r["title"],
                        "source": r.get("source_docs", []),
                        "type": r["page_type"],
                        "tags": r.get("tags", []),
                    })
            else:
                # Fall back to FAISS
                yield json.dumps({"type": "status", "content": "searching_faiss"}) + "\n"
                rag_context, rag_score = rag_search(tenant_id=safe_tenant, query=user_message, top_k=4)

                if live_query or rag_score < 0.3:
                    # Fall back to web search for live queries or very low scores
                    yield json.dumps({"type": "context", "source": "web", "live": True, "score": rag_score}) + "\n"
                    context_rows = web_search(query=user_message, max_results=5)
                    source_type = "web"
                    context_text = _build_context_block(context_rows)
                    sources = [{"source": r.get("source", ""), "text": r.get("text", "")[:200]} for r in context_rows]
                elif rag_context:
                    # Use FAISS results
                    yield json.dumps({"type": "context", "source": "faiss", "score": rag_score}) + "\n"
                    source_type = "faiss"
                    context_text = _build_context_block(rag_context)
                    sources = [{"source": r.get("source", ""), "text": r.get("text", "")[:200]} for r in rag_context]
                else:
                    # No results from any source
                    yield json.dumps({"type": "context", "source": "none", "score": 0}) + "\n"

            # Send sources to client
            for src in sources:
                yield json.dumps({"type": "source", **src}) + "\n"

            # Build prompts
            identity = get_identity_prompts(safe_tenant)
            summary = get_session_summary(tenant_id=safe_tenant, session_id=session_id)
            history_rows = get_recent_messages(tenant_id=safe_tenant, session_id=session_id, limit=10)
            history_block = _build_history_block(history_rows)

            system_prompt = (
                "You are an AI assistant with access to a wiki-based knowledge base.\n\n"
                f"[Base Identity]\n{identity.get('base_identity', '')}\n\n"
                f"[Behavioral Rules]\n{identity.get('behavioral_rules', '')}\n\n"
                "Use wiki pages with [[cross-references]] to provide comprehensive answers. "
                "Cite page titles and sources when referencing specific information."
            )
            user_prompt = (
                f"[Session Summary]\n{summary or 'No summary yet.'}\n\n"
                f"[Last 10 Messages]\n{history_block or 'No prior messages.'}\n\n"
                f"[Retrieved Wiki Context]\n{context_text or 'No context available.'}\n\n"
                f"[Current Query]\n{user_message}"
            )

            yield json.dumps({"type": "status", "content": "generating_response"}) + "\n"

            response_buffer = ""
            for chunk in _stream_openrouter(system_prompt, user_prompt):
                if chunk["type"] == "token":
                    response_buffer += chunk["content"]
                    yield json.dumps({"type": "token", "content": chunk["content"]}) + "\n"
                elif chunk["type"] == "error":
                    yield json.dumps({"type": "error", "content": chunk["content"]}) + "\n"
                elif chunk["type"] == "done":
                    response_buffer = chunk["buffer"]
                    break

            append_session_message(tenant_id=safe_tenant, session_id=session_id, role="assistant", content=response_buffer)
            yield json.dumps({"type": "done"}) + "\n"

        except Exception as exc:
            yield json.dumps({"type": "error", "content": str(exc)}) + "\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/query")
async def rag_query(payload: RagQueryPayload) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(payload.tenant_id)

    session_id = get_or_create_session(tenant_id=safe_tenant, guest_id=payload.guest_id)
    append_session_message(tenant_id=safe_tenant, session_id=session_id, role="user", content=payload.user_message)

    # Try wiki search first
    wiki_results, wiki_score = wiki_search(tenant_id=safe_tenant, query=payload.user_message, top_k=4)
    live_query = is_live_information_query(payload.user_message)

    if wiki_results and wiki_score >= 0.3:
        source_type = "wiki"
        context_text = format_wiki_context(wiki_results)
        sources = [{"title": r["title"], "type": r["page_type"], "tags": r.get("tags", [])} for r in wiki_results]
    else:
        # Fall back to FAISS
        rag_context, rag_score = rag_search(tenant_id=safe_tenant, query=payload.user_message, top_k=4)

        if live_query or rag_score < 0.3:
            context_rows = web_search(query=payload.user_message, max_results=5)
            source_type = "web"
            context_text = _build_context_block(context_rows)
            sources = context_rows
        elif rag_context:
            source_type = "faiss"
            context_text = _build_context_block(rag_context)
            sources = rag_context
        else:
            source_type = "none"
            context_text = ""
            sources = []
            wiki_score = 0.0

    identity = get_identity_prompts(safe_tenant)
    summary = get_session_summary(tenant_id=safe_tenant, session_id=session_id)
    history_rows = get_recent_messages(tenant_id=safe_tenant, session_id=session_id, limit=10)
    history_block = _build_history_block(history_rows)

    system_prompt = (
        "You are an AI assistant with access to a wiki-based knowledge base.\n\n"
        f"[Base Identity]\n{identity.get('base_identity', '')}\n\n"
        f"[Behavioral Rules]\n{identity.get('behavioral_rules', '')}\n\n"
        "Use wiki pages with [[cross-references]] to provide comprehensive answers."
    )
    user_prompt = (
        f"[Session Summary]\n{summary or 'No summary yet.'}\n\n"
        f"[Last 10 Messages]\n{history_block or 'No prior messages.'}\n\n"
        f"[Retrieved Context]\n{context_text or 'No context available.'}\n\n"
        f"[Current Query]\n{payload.user_message}"
    )

    response_text = chat_completion(system_prompt=system_prompt, user_prompt=user_prompt)
    append_session_message(tenant_id=safe_tenant, session_id=session_id, role="assistant", content=response_text)

    return {
        "tenant_id": safe_tenant,
        "session_id": session_id,
        "response": response_text,
        "sources": sources,
        "source_type": source_type,
        "score": wiki_score,
    }


# ---------------------------------------------------------------------------
# Wiki management endpoints
# ---------------------------------------------------------------------------

@router.get("/wiki/status")
def wiki_status(request: Request, tenant_id: str) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(tenant_id)
    status = read_wiki_status(safe_tenant)
    index = get_index(safe_tenant)
    return {
        **status,
        "tenant_id": safe_tenant,
        "total_pages": len(index.get("pages", [])),
    }


@router.get("/wiki/index")
def wiki_index(request: Request, tenant_id: str) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(tenant_id)
    index = get_index(safe_tenant)
    index["tenant_id"] = safe_tenant
    return index


@router.get("/wiki/pages")
def wiki_pages(request: Request, tenant_id: str) -> list[dict[str, Any]]:
    safe_tenant = validate_tenant_id(tenant_id)
    pages = load_pages(safe_tenant)
    return [p.to_dict() for p in pages]


@router.get("/wiki/schema")
def wiki_get_schema(request: Request, tenant_id: str) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(tenant_id)
    return {
        "tenant_id": safe_tenant,
        "schema": get_schema(safe_tenant),
    }


@router.post("/wiki/schema")
def wiki_save_schema(request: Request, payload: WikiSchemaPayload) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(payload.tenant_id)
    save_schema(safe_tenant, payload.schema_text)
    return {"tenant_id": safe_tenant, "saved": True}


@router.post("/wiki/ingest")
def wiki_ingest(request: Request, background_tasks: BackgroundTasks, payload: WikiUploadPayload) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(payload.tenant_id)

    def _build():
        return build_wiki(safe_tenant, payload.text, payload.source_name)

    # Run synchronously for now (could make async)
    result = _build()
    return {
        "tenant_id": safe_tenant,
        "source": payload.source_name,
        "pages_created": result.get("pages_created", 0),
        "total_pages": result.get("total_pages", 0),
    }


@router.post("/wiki/lint")
def wiki_lint(request: Request, background_tasks: BackgroundTasks, tenant_id: str) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(tenant_id)

    def _lint():
        return lint_wiki(safe_tenant)

    result = _lint()
    return {
        "tenant_id": safe_tenant,
        **result,
    }
