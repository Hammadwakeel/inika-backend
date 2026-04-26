from __future__ import annotations

import json
import sqlite3
import time
import asyncio
from pathlib import Path
from typing import Annotated, Any

import faiss
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import zipfile
import io

from backend.app.core.tenant import validate_tenant_id
from backend.app.routes.auth_middleware import TokenData, get_current_user
from backend.app.services.llm_service import chat_completion, embed_texts


router = APIRouter(prefix="/knowledge", tags=["knowledge"])

BASE_DIR = Path(__file__).resolve().parent.parent
TENANTS_ROOT = BASE_DIR / "data" / "tenants"


class IdentityPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    base_identity: str = Field(default="")
    behavioral_rules: str = Field(default="")


class QueryPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    user_message: str = Field(min_length=1, max_length=4096)
    top_k: int = Field(default=4, ge=1, le=10)


def tenant_dir(tenant_id: str) -> Path:
    safe = validate_tenant_id(tenant_id)
    path = TENANTS_ROOT / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def tenant_db_path(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "axiom.db"


def knowledge_dir(tenant_id: str) -> Path:
    path = tenant_dir(tenant_id) / "knowledge"
    path.mkdir(parents=True, exist_ok=True)
    return path


def uploads_dir(tenant_id: str) -> Path:
    path = knowledge_dir(tenant_id) / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def index_path(tenant_id: str) -> Path:
    return knowledge_dir(tenant_id) / "kb.index.faiss"


def chunks_path(tenant_id: str) -> Path:
    return knowledge_dir(tenant_id) / "kb.chunks.json"


def status_path(tenant_id: str) -> Path:
    return knowledge_dir(tenant_id) / "status.json"


def write_status(tenant_id: str, payload: dict[str, Any]) -> None:
    status_path(tenant_id).write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def read_status(tenant_id: str) -> dict[str, Any]:
    path = status_path(tenant_id)
    if not path.exists():
        return {"processing": False, "progress": 0, "message": "idle"}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"processing": False, "progress": 0, "message": "idle"}


def ensure_identity_schema(tenant_id: str) -> None:
    conn = sqlite3.connect(tenant_db_path(tenant_id))
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS identity_prompts (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                base_identity TEXT NOT NULL DEFAULT '',
                behavioral_rules TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("INSERT OR IGNORE INTO identity_prompts (id, base_identity, behavioral_rules) VALUES (1, '', '')")
        conn.commit()
    finally:
        conn.close()


def save_identity_prompts(tenant_id: str, base_identity: str, behavioral_rules: str) -> None:
    ensure_identity_schema(tenant_id)
    conn = sqlite3.connect(tenant_db_path(tenant_id))
    try:
        conn.execute(
            """
            UPDATE identity_prompts
            SET base_identity = ?, behavioral_rules = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            """,
            (base_identity, behavioral_rules),
        )
        conn.commit()
    finally:
        conn.close()


def get_identity_prompts(tenant_id: str) -> dict[str, str]:
    ensure_identity_schema(tenant_id)
    conn = sqlite3.connect(tenant_db_path(tenant_id))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT base_identity, behavioral_rules FROM identity_prompts WHERE id = 1").fetchone()
        if not row:
            return {"base_identity": "", "behavioral_rules": ""}
        return {"base_identity": row["base_identity"], "behavioral_rules": row["behavioral_rules"]}
    finally:
        conn.close()


def clean_text(text: str) -> str:
    return "\n".join(line.strip() for line in text.replace("\r\n", "\n").splitlines() if line.strip())


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 120) -> list[str]:
    cleaned = clean_text(text)
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def build_faiss_index(tenant_id: str, text: str, source_name: str) -> dict[str, Any]:
    write_status(
        tenant_id,
        {
            "processing": True,
            "progress": 10,
            "message": "cleaning/chunking",
            "updated_at": int(time.time()),
        },
    )
    chunks = chunk_text(text)
    if not chunks:
        raise RuntimeError("No text content after cleaning/chunking")

    write_status(
        tenant_id,
        {
            "processing": True,
            "progress": 40,
            "message": "embedding chunks",
            "updated_at": int(time.time()),
        },
    )
    vectors = embed_texts(chunks)
    matrix = np.array(vectors, dtype="float32")
    if matrix.ndim != 2 or matrix.shape[0] == 0:
        raise RuntimeError("Embedding generation failed")
    dim = int(matrix.shape[1])
    faiss.normalize_L2(matrix)
    index = faiss.IndexFlatIP(dim)
    index.add(matrix)

    meta_rows = [{"id": i, "text": chunk, "source": source_name} for i, chunk in enumerate(chunks)]

    write_status(
        tenant_id,
        {
            "processing": True,
            "progress": 75,
            "message": "saving local faiss",
            "updated_at": int(time.time()),
        },
    )
    faiss.write_index(index, str(index_path(tenant_id)))
    chunks_path(tenant_id).write_text(json.dumps(meta_rows, ensure_ascii=True), encoding="utf-8")

    write_status(
        tenant_id,
        {
            "processing": False,
            "progress": 100,
            "message": "ready",
            "updated_at": int(time.time()),
            "chunks": len(meta_rows),
        },
    )
    return {"chunks": len(meta_rows), "source": source_name}


def load_index_and_chunks(tenant_id: str) -> tuple[faiss.Index, list[dict[str, Any]]]:
    idx_path = index_path(tenant_id)
    ch_path = chunks_path(tenant_id)
    if not idx_path.exists() or not ch_path.exists():
        raise HTTPException(status_code=404, detail="Knowledge index not found for tenant")
    index = faiss.read_index(str(idx_path))
    chunks = json.loads(ch_path.read_text(encoding="utf-8"))
    return index, chunks


def get_response(tenant_id: str, user_message: str, top_k: int = 4) -> dict[str, Any]:
    safe_tenant = validate_tenant_id(tenant_id)
    identity = get_identity_prompts(safe_tenant)
    index, chunks = load_index_and_chunks(safe_tenant)

    query_vec = np.array(embed_texts([user_message]), dtype="float32")
    faiss.normalize_L2(query_vec)
    distances, ids = index.search(query_vec, top_k)

    matched: list[dict[str, Any]] = []
    for score, idx in zip(distances[0].tolist(), ids[0].tolist(), strict=False):
        if idx < 0 or idx >= len(chunks):
            continue
        row = chunks[idx]
        matched.append(
            {
                "score": float(score),
                "text": row.get("text", ""),
                "source": row.get("source", "unknown"),
            }
        )

    context = "\n\n".join(f"[Source: {m['source']}]\n{m['text']}" for m in matched)
    system_prompt = (
        "You are the Axiom tenant AI assistant.\n\n"
        f"Base Identity:\n{identity['base_identity']}\n\n"
        f"Behavioral Rules:\n{identity['behavioral_rules']}\n\n"
        "Always use provided context when relevant."
    )
    user_prompt = (
        f"User question:\n{user_message}\n\n"
        f"Retrieved context:\n{context if context else 'No relevant context found.'}"
    )
    answer = chat_completion(system_prompt=system_prompt, user_prompt=user_prompt)
    return {"answer": answer, "context": matched}


def list_uploaded_files(tenant_id: str) -> list[dict[str, Any]]:
    rows = []
    for path in sorted(uploads_dir(tenant_id).glob("*")):
        if path.is_file():
            rows.append(
                {
                    "name": path.name,
                    "size": path.stat().st_size,
                    "modified_at": int(path.stat().st_mtime),
                }
            )
    return rows


def _background_build(tenant_id: str, raw_text: str, source_name: str) -> None:
    try:
        build_faiss_index(tenant_id, raw_text, source_name)
    except Exception as exc:  # noqa: BLE001
        write_status(
            tenant_id,
            {
                "processing": False,
                "progress": 0,
                "message": f"failed: {str(exc)}",
                "updated_at": int(time.time()),
            },
        )


@router.post("/upload")
async def upload_knowledge(
    request: Request,
    background_tasks: BackgroundTasks,
    tenant_id: str = Form(...),
    text: str = Form(default=""),
    file: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    input_text = text.strip()
    source_name = "inline-text"

    if file is not None:
        payload = await file.read()
        decoded = payload.decode("utf-8", errors="ignore")
        if decoded.strip():
            source_name = file.filename or "uploaded-file.txt"
            input_text = f"{input_text}\n\n{decoded}".strip() if input_text else decoded
            save_path = uploads_dir(safe_tenant) / source_name
            save_path.write_text(decoded, encoding="utf-8")

    if not input_text:
        raise HTTPException(status_code=400, detail="Provide text or a readable file")

    write_status(
        safe_tenant,
        {
            "processing": True,
            "progress": 1,
            "message": "queued",
            "updated_at": int(time.time()),
        },
    )
    background_tasks.add_task(_background_build, safe_tenant, input_text, source_name)
    return {"tenant_id": safe_tenant, "queued": True, "source": source_name}


@router.post("/upload-zip")
async def upload_zip_knowledge(
    request: Request,
    background_tasks: BackgroundTasks,
    tenant_id: str = Form(...),
    zip_file: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")

    if zip_file is None:
        raise HTTPException(status_code=400, detail="No zip file provided")

    contents = await zip_file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty zip file")

    allowed_extensions = {".txt", ".pdf", ".zip"}
    processed_files = 0
    combined_text = ""

    try:
        with zipfile.ZipFile(io.BytesIO(contents), "r") as zf:
            for name in zf.namelist():
                # Skip directories and check if it's a file with extension
                if name.endswith("/"):
                    continue
                file_name = name.split("/")[-1] if "/" in name else name
                if "." not in file_name:
                    continue
                ext = "." + file_name.split(".")[-1].lower()
                if ext not in allowed_extensions:
                    continue

                if ext == ".zip":
                    # Handle nested zip
                    nested_data = zf.read(name)
                    try:
                        with zipfile.ZipFile(io.BytesIO(nested_data), "r") as nested_zf:
                            for nested_name in nested_zf.namelist():
                                if nested_name.endswith("/"):
                                    continue
                                nested_file = nested_name.split("/")[-1]
                                nested_ext = "." + nested_file.split(".")[-1].lower() if "." in nested_file else ""
                                if nested_ext == ".txt":
                                    content = nested_zf.read(nested_name).decode("utf-8", errors="ignore")
                                    if content.strip():
                                        combined_text += f"\n\n--- {nested_name} ---\n{content}"
                                        processed_files += 1
                    except:
                        pass
                    continue

                content = zf.read(name).decode("utf-8", errors="ignore")
                if content.strip():
                    combined_text += f"\n\n--- {name} ---\n{content}"
                    processed_files += 1
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")

    if not combined_text.strip():
        raise HTTPException(status_code=400, detail="No valid files found in zip (supported: .txt, .pdf, .zip)")

    write_status(
        safe_tenant,
        {
            "processing": True,
            "progress": 1,
            "message": f"queued {processed_files} files from zip",
            "updated_at": int(time.time()),
        },
    )
    background_tasks.add_task(_background_build, safe_tenant, combined_text, "zip-archive")
    return {"tenant_id": safe_tenant, "queued": True, "files_processed": processed_files}


@router.get("/status")
def knowledge_status(
    request: Request,
    tenant_id: str,
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    status = read_status(safe_tenant)
    status["tenant_id"] = safe_tenant
    status["files"] = list_uploaded_files(safe_tenant)
    status["index_exists"] = index_path(safe_tenant).exists()
    return status


@router.get("/status/stream")
async def knowledge_status_stream(
    request: Request,
    tenant_id: str,
) -> StreamingResponse:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")

    async def event_generator():
        previous_payload = ""
        while True:
            if await request.is_disconnected():
                break
            status = read_status(safe_tenant)
            status["tenant_id"] = safe_tenant
            status["files"] = list_uploaded_files(safe_tenant)
            status["index_exists"] = index_path(safe_tenant).exists()
            serialized = json.dumps(status, separators=(",", ":"))
            if serialized != previous_payload:
                previous_payload = serialized
                yield f"data: {serialized}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/identity")
def get_identity(
    request: Request,
    tenant_id: str,
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    prompts = get_identity_prompts(safe_tenant)
    return {"tenant_id": safe_tenant, **prompts}


@router.post("/identity")
def save_identity(
    request: Request,
    payload: IdentityPayload,
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(payload.tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    save_identity_prompts(safe_tenant, payload.base_identity, payload.behavioral_rules)
    return {"tenant_id": safe_tenant, "saved": True}


@router.post("/query")
def query_knowledge(
    request: Request,
    payload: QueryPayload,
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(payload.tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    return get_response(payload.tenant_id, payload.user_message, top_k=payload.top_k)

