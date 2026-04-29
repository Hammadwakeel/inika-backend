from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any

import faiss
import numpy as np
from tavily import TavilyClient

from app.services.llm_service import embed_texts
from app.services.memory_manager import get_rag_threshold as _get_rag_threshold
from knowledge_engine import load_index_and_chunks

TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")

LIVE_INFO_PATTERN = re.compile(
    r"\b(weather|temperature|forecast|sports|score|news|headlines|nearby|near me|traffic|live)\b",
    re.IGNORECASE,
)


def is_live_information_query(query: str) -> bool:
    return bool(LIVE_INFO_PATTERN.search(query))


def rag_search(
    tenant_id: str, query: str, top_k: int = 4, rag_threshold: float | None = None
) -> tuple[list[dict[str, Any]], float]:
    try:
        index, chunks = load_index_and_chunks(tenant_id)
    except Exception:  # noqa: BLE001
        return [], 0.0

    if rag_threshold is None:
        rag_threshold = _get_rag_threshold(tenant_id)

    vec = np.array(embed_texts([query]), dtype="float32")
    faiss.normalize_L2(vec)
    distances, ids = index.search(vec, top_k)

    matched: list[dict[str, Any]] = []
    best_score = 0.0
    for score, idx in zip(distances[0].tolist(), ids[0].tolist(), strict=False):
        if idx < 0 or idx >= len(chunks):
            continue
        row = chunks[idx]
        score_float = float(score)
        best_score = max(best_score, score_float)
        matched.append(
            {
                "source": row.get("source", "knowledge"),
                "text": row.get("text", ""),
                "score": score_float,
            }
        )
    return matched, best_score


def tavily_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    if not TAVILY_API_KEY:
        return []
    client = TavilyClient(api_key=TAVILY_API_KEY)
    response = client.search(query=query, max_results=max_results, search_depth="advanced", include_answer=False)
    rows = response.get("results", [])
    return [{"source": row.get("url", "web"), "text": row.get("content", "")} for row in rows]


def serper_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    if not SERPER_API_KEY:
        return []
    payload = json.dumps({"q": query, "num": max_results}).encode("utf-8")
    req = urllib.request.Request(
        "https://google.serper.dev/search",
        data=payload,
        headers={"Content-Type": "application/json", "X-API-KEY": SERPER_API_KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = json.loads(response.read().decode("utf-8"))
    rows = raw.get("organic", [])
    return [{"source": row.get("link", "web"), "text": row.get("snippet", "")} for row in rows]


def web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    try:
        tavily_results = tavily_search(query=query, max_results=max_results)
        if tavily_results:
            return tavily_results
    except Exception:  # noqa: BLE001
        pass

    try:
        serper_results = serper_search(query=query, max_results=max_results)
        if serper_results:
            return serper_results
    except Exception:  # noqa: BLE001
        pass

    return [{"source": "web", "text": "No web results retrieved from Tavily/Serper."}]

