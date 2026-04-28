from __future__ import annotations

import hashlib
import json
import math
import os
from typing import Iterable
from urllib import request

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_CHAT_MODEL = os.getenv("OPENROUTER_CHAT_MODEL", "openai/gpt-4o-mini")
OPENROUTER_EMBED_MODEL = os.getenv("OPENROUTER_EMBED_MODEL", "openai/text-embedding-3-small")
USE_LOCAL_EMBEDDINGS = os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"


OPENROUTER_TIMEOUT = int(os.getenv("OPENROUTER_TIMEOUT", "30"))


def _post_json(url: str, payload: dict, timeout: int | None = None) -> dict:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url=url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Axiom Platform",
        },
        method="POST",
    )
    effective_timeout = timeout if timeout is not None else OPENROUTER_TIMEOUT
    try:
        with request.urlopen(req, timeout=effective_timeout) as response:
            raw = response.read().decode("utf-8")
        return json.loads(raw)
    except TimeoutError:
        raise TimeoutError(f"OpenRouter request timed out after {effective_timeout}s: {url}")
    except Exception as exc:
        raise RuntimeError(f"OpenRouter request failed: {exc}") from exc


def _local_embedding(text: str, dim: int = 1536) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values = []
    seed = int.from_bytes(digest, byteorder="big", signed=False)
    mod = 2**31 - 1
    cur = seed % mod
    for _ in range(dim):
        cur = (1103515245 * cur + 12345) % mod
        values.append((cur / mod) * 2.0 - 1.0)
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def embed_texts(texts: Iterable[str]) -> list[list[float]]:
    texts_list = list(texts)
    if not texts_list:
        return []
    if USE_LOCAL_EMBEDDINGS:
        return [_local_embedding(t) for t in texts_list]
    data = _post_json(f"{OPENROUTER_BASE_URL}/embeddings", {"model": OPENROUTER_EMBED_MODEL, "input": texts_list})
    rows = data.get("data", [])
    if not rows:
        raise RuntimeError("OpenRouter embeddings returned no data")
    return [row["embedding"] for row in rows]


def chat_completion(system_prompt: str, user_prompt: str, timeout: int | None = None) -> str:
    payload = {
        "model": OPENROUTER_CHAT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    data = _post_json(f"{OPENROUTER_BASE_URL}/chat/completions", payload, timeout=timeout)
    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("OpenRouter chat returned no choices")
    return choices[0].get("message", {}).get("content", "").strip()

