"""
Wiki-based knowledge engine inspired by Karpathy's LLM Wiki pattern.

Three-layer architecture:
1. Raw sources (immutable input documents)
2. Wiki (LLM-generated markdown pages with cross-references)
3. Schema (instructions/configuration for how the LLM operates)
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any, Iterator

import faiss
import numpy as np

from app.services.llm_service import chat_completion, embed_texts

BASE_DIR = Path(__file__).resolve().parent.parent
TENANTS_ROOT = BASE_DIR / "data" / "tenants"


class WikiPage:
    """Represents a single wiki page."""

    def __init__(
        self,
        title: str,
        content: str,
        page_type: str,  # "summary", "entity", "topic", "concept"
        source_docs: list[str] | None = None,
        tags: list[str] | None = None,
        cross_references: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ):
        self.title = title
        self.content = content
        self.page_type = page_type
        self.source_docs = source_docs or []
        self.tags = tags or []
        self.cross_references = cross_references or []
        self.metadata = metadata or {}
        self.created_at = int(time.time())
        self.updated_at = self.created_at

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "content": self.content,
            "page_type": self.page_type,
            "source_docs": self.source_docs,
            "tags": self.tags,
            "cross_references": self.cross_references,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_markdown(self) -> str:
        """Render wiki page as markdown."""
        refs = ", ".join(f"[[{r}]]" for r in self.cross_references) if self.cross_references else "None"
        meta = ", ".join(f"{k}={v}" for k, v in self.metadata.items()) if self.metadata else "None"
        return f"""# {self.title}

**Type:** {self.page_type}
**Tags:** {', '.join(self.tags) if self.tags else 'None'}
**Sources:** {', '.join(self.source_docs) if self.source_docs else 'None'}
**Cross-refs:** {refs}
**Meta:** {meta}

---

{self.content}
"""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WikiPage:
        page = cls(
            title=data["title"],
            content=data["content"],
            page_type=data["page_type"],
            source_docs=data.get("source_docs"),
            tags=data.get("tags"),
            cross_references=data.get("cross_references"),
            metadata=data.get("metadata"),
        )
        page.created_at = data.get("created_at", page.created_at)
        page.updated_at = data.get("updated_at", page.updated_at)
        return page


def wiki_dir(tenant_id: str) -> Path:
    path = TENANTS_ROOT / tenant_id / "wiki"
    path.mkdir(parents=True, exist_ok=True)
    return path


def wiki_pages_path(tenant_id: str) -> Path:
    return wiki_dir(tenant_id) / "pages.json"


def wiki_index_path(tenant_id: str) -> Path:
    return wiki_dir(tenant_id) / "index.json"


def wiki_log_path(tenant_id: str) -> Path:
    return wiki_dir(tenant_id) / "log.json"


def wiki_schema_path(tenant_id: str) -> Path:
    return wiki_dir(tenant_id) / "schema.md"


def wiki_status_path(tenant_id: str) -> Path:
    return wiki_dir(tenant_id) / "status.json"


# ---------------------------------------------------------------------------
# Schema / Configuration
# ---------------------------------------------------------------------------

DEFAULT_SCHEMA = """# Wiki Schema

You are maintaining a personal wiki for a business AI assistant.

## Page Types

1. **Summary Pages** (`type: summary`)
   - High-level overview of a topic or document
   - Include key points, main findings, conclusions
   - Target: 200-500 words

2. **Entity Pages** (`type: entity`)
   - Specific people, places, things, or concepts
   - Include definition, attributes, relationships
   - Target: 100-300 words

3. **Topic Pages** (`type: topic`)
   - Broad subjects that span multiple documents
   - Aggregate related entity and summary pages
   - Target: 300-600 words

4. **Concept Pages** (`type: concept`)
   - Abstract ideas, processes, or methodologies
   - Include explanations, examples, applications
   - Target: 150-400 words

## Cross-Reference Rules

- Link related pages using double brackets: [[Page Title]]
- Each page should reference 2-5 related pages
- Prefer bidirectional links when appropriate
- Tags should use #hashtag format

## Content Guidelines

- Use clear, concise language
- Include specific facts, numbers, and dates when available
- Mark uncertain information with [unverified]
- Indicate source documents at the end
"""


def get_schema(tenant_id: str) -> str:
    path = wiki_schema_path(tenant_id)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return DEFAULT_SCHEMA


def save_schema(tenant_id: str, schema: str) -> None:
    wiki_schema_path(tenant_id).write_text(schema, encoding="utf-8")


# ---------------------------------------------------------------------------
# Log operations
# ---------------------------------------------------------------------------

def append_log(tenant_id: str, operation: str, detail: str, pages_affected: list[str] | None = None) -> None:
    log_file = wiki_log_path(tenant_id)
    logs = []
    if log_file.exists():
        try:
            logs = json.loads(log_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logs = []

    logs.append({
        "timestamp": int(time.time()),
        "operation": operation,
        "detail": detail,
        "pages_affected": pages_affected or [],
    })
    log_file.write_text(json.dumps(logs, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# Index operations
# ---------------------------------------------------------------------------

def get_index(tenant_id: str) -> dict[str, Any]:
    path = wiki_index_path(tenant_id)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "pages": [],
        "last_updated": 0,
    }


def save_index(tenant_id: str, index: dict[str, Any]) -> None:
    index["last_updated"] = int(time.time())
    wiki_index_path(tenant_id).write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")


def build_index(pages: list[WikiPage]) -> dict[str, Any]:
    return {
        "pages": [
            {
                "title": p.title,
                "page_type": p.page_type,
                "tags": p.tags,
                "cross_references": p.cross_references,
                "source_docs": p.source_docs,
            }
            for p in pages
        ],
    }


# ---------------------------------------------------------------------------
# Page storage
# ---------------------------------------------------------------------------

def load_pages(tenant_id: str) -> list[WikiPage]:
    path = wiki_pages_path(tenant_id)
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return [WikiPage.from_dict(item) for item in data]


def save_pages(tenant_id: str, pages: list[WikiPage]) -> None:
    path = wiki_pages_path(tenant_id)
    data = [p.to_dict() for p in pages]
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    # Also rebuild index
    save_index(tenant_id, build_index(pages))


# ---------------------------------------------------------------------------
# Wiki generation prompt
# ---------------------------------------------------------------------------

def _build_ingest_prompt(schema: str, text: str, source_name: str, existing_titles: list[str]) -> str:
    existing_refs = "\n".join(f"- {t}" for t in existing_titles) if existing_titles else "None"
    return f"""{schema}

## New Document to Process

**Source:** {source_name}

---

CONTENT:
{text}

---

Based on this document, generate wiki pages following the schema above.

Requirements:
1. Create summary page(s) capturing main points
2. Create entity pages for important concepts, people, or things
3. Create topic pages if content spans multiple areas
4. Add cross-references to existing pages: {existing_refs}
5. Assign relevant tags using #hashtag format

Output format (JSON array of pages):
```json
[
  {{
    "title": "Page Title",
    "content": "Page content in markdown...",
    "page_type": "summary|entity|topic|concept",
    "tags": ["#tag1", "#tag2"],
    "cross_references": ["Existing Page 1", "Existing Page 2"],
    "metadata": {{"source_doc": "{source_name}"}}
  }}
]
```

Only output the JSON array, no other text."""


def _parse_wiki_pages(llm_output: str) -> list[dict[str, Any]]:
    """Extract JSON array from LLM output."""
    # Try to find JSON array in output
    json_match = re.search(r'\[\s*\{.*\}\s*\]', llm_output, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Try to find markdown code blocks
    code_match = re.search(r'```(?:json)?\s*(\[[\s\S]*?\])```', llm_output, re.DOTALL)
    if code_match:
        try:
            return json.loads(code_match.group(1))
        except json.JSONDecodeError:
            pass

    return []


# ---------------------------------------------------------------------------
# Build wiki from text
# ---------------------------------------------------------------------------

def write_wiki_status(tenant_id: str, payload: dict[str, Any]) -> None:
    wiki_status_path(tenant_id).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def read_wiki_status(tenant_id: str) -> dict[str, Any]:
    path = wiki_status_path(tenant_id)
    if not path.exists():
        return {"processing": False, "progress": 0, "message": "idle"}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"processing": False, "progress": 0, "message": "idle"}


def build_wiki(tenant_id: str, text: str, source_name: str) -> dict[str, Any]:
    """Ingest document and build wiki pages using LLM."""
    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 10,
        "message": "loading existing pages",
        "updated_at": int(time.time()),
    })

    schema = get_schema(tenant_id)
    existing_pages = load_pages(tenant_id)
    existing_titles = [p.title for p in existing_pages]

    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 30,
        "message": "generating wiki pages via LLM",
        "updated_at": int(time.time()),
    })

    # Truncate text if too long (LLM context limits)
    max_chars = 12000
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[... content truncated ...]"

    prompt = _build_ingest_prompt(schema, text, source_name, existing_titles)

    try:
        llm_output = chat_completion(
            system_prompt="You are a wiki engineer. Generate structured wiki pages from documents.",
            user_prompt=prompt,
        )
    except Exception as exc:
        write_wiki_status(tenant_id, {
            "processing": False,
            "progress": 0,
            "message": f"failed: {str(exc)}",
            "updated_at": int(time.time()),
        })
        raise RuntimeError(f"LLM failed to generate wiki pages: {exc}") from exc

    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 60,
        "message": "parsing generated pages",
        "updated_at": int(time.time()),
    })

    page_dicts = _parse_wiki_pages(llm_output)
    if not page_dicts:
        raise RuntimeError("Failed to parse wiki pages from LLM output")

    # Create WikiPage objects
    new_pages: list[WikiPage] = []
    for pd in page_dicts:
        page = WikiPage(
            title=pd.get("title", "Untitled"),
            content=pd.get("content", ""),
            page_type=pd.get("page_type", "summary"),
            tags=pd.get("tags", []),
            cross_references=pd.get("cross_references", []),
            source_docs=[source_name],
            metadata=pd.get("metadata", {}),
        )
        new_pages.append(page)

    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 80,
        "message": "saving wiki pages",
        "updated_at": int(time.time()),
    })

    # Update cross-references for existing pages
    all_pages = existing_pages + new_pages
    _update_cross_references(all_pages)

    # Save everything
    save_pages(tenant_id, all_pages)
    save_index(tenant_id, build_index(all_pages))
    append_log(tenant_id, "ingest", f"Added {len(new_pages)} pages from {source_name}", [p.title for p in new_pages])

    write_wiki_status(tenant_id, {
        "processing": False,
        "progress": 100,
        "message": "ready",
        "updated_at": int(time.time()),
        "pages": len(all_pages),
        "new_pages": len(new_pages),
    })

    return {
        "pages_created": len(new_pages),
        "total_pages": len(all_pages),
        "source": source_name,
    }


def _update_cross_references(pages: list[WikiPage]) -> None:
    """Ensure cross-references are bidirectional and valid."""
    titles = {p.title for p in pages}

    for page in pages:
        valid_refs = [r for r in page.cross_references if r in titles]
        # Add bidirectional links
        for other_title in valid_refs:
            other = next((p for p in pages if p.title == other_title), None)
            if other and page.title not in other.cross_references:
                other.cross_references.append(page.title)
        page.cross_references = valid_refs


# ---------------------------------------------------------------------------
# Query wiki
# ---------------------------------------------------------------------------

def search_wiki(tenant_id: str, query: str, top_k: int = 5) -> tuple[list[dict[str, Any]], float]:
    """Search wiki pages by semantic similarity."""
    pages = load_pages(tenant_id)
    if not pages:
        return [], 0.0

    # Build content for each page (title + content for better matching)
    texts = [f"{p.title}\n{p.content}" for p in pages]

    try:
        query_vec = np.array(embed_texts([query]), dtype="float32")
        page_vecs = np.array(embed_texts(texts), dtype="float32")
    except Exception:
        return [], 0.0

    faiss.normalize_L2(query_vec)
    faiss.normalize_L2(page_vecs)

    # Search
    distances, ids = page_vecs.dot(query_vec.reshape(-1, 1)).flatten().argsort()[-top_k:][::-1], \
                    list(range(len(pages)))[-top_k:][::-1]

    results = []
    for dist, idx in zip(distances, ids):
        if idx < 0 or idx >= len(pages):
            continue
        p = pages[idx]
        results.append({
            "title": p.title,
            "content": p.content,
            "page_type": p.page_type,
            "tags": p.tags,
            "cross_references": p.cross_references,
            "source_docs": p.source_docs,
            "score": float(dist),
        })

    best_score = results[0]["score"] if results else 0.0
    return results, best_score


def get_page_by_title(tenant_id: str, title: str) -> WikiPage | None:
    """Retrieve a specific wiki page."""
    pages = load_pages(tenant_id)
    for p in pages:
        if p.title.lower() == title.lower():
            return p
    return None


def get_related_pages(tenant_id: str, title: str, depth: int = 1) -> list[WikiPage]:
    """Get pages related to a given page (follows cross-references)."""
    pages = load_pages(tenant_id)
    page_map = {p.title: p for p in pages}

    target = page_map.get(title)
    if not target:
        return []

    visited = {title}
    result = [target]

    def _expand(t: str, d: int):
        if d <= 0:
            return
        p = page_map.get(t)
        if not p:
            return
        for ref in p.cross_references:
            if ref not in visited:
                visited.add(ref)
                result.append(page_map[ref])
                _expand(ref, d - 1)

    _expand(title, depth)
    return result


# ---------------------------------------------------------------------------
# Lint wiki (cleanup/merge)
# ---------------------------------------------------------------------------

def lint_wiki(tenant_id: str) -> dict[str, Any]:
    """Lint and clean up wiki pages."""
    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 10,
        "message": "linting wiki",
        "updated_at": int(time.time()),
    })

    pages = load_pages(tenant_id)
    schema = get_schema(tenant_id)

    if not pages:
        return {"merged": 0, "removed": 0, "updated": 0}

    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 40,
        "message": "generating lint recommendations",
        "updated_at": int(time.time()),
    })

    # Create lint prompt
    page_summaries = "\n\n".join([
        f"- {p.page_type}: {p.title} (tags: {', '.join(p.tags)}, refs: {', '.join(p.cross_references)})"
        for p in pages
    ])

    lint_prompt = f"""{schema}

## Current Wiki Pages

{page_summaries}

## Lint Task

Analyze these pages and suggest:
1. Pages that should be merged (similar topics, redundant content)
2. Pages that should be deleted (empty, too short, duplicates)
3. Missing cross-references between related pages
4. Orphan pages (no cross-references)

Output format (JSON):
```json
{{
  "merges": [["Page A", "Page B"], ...],
  "deletes": ["Page Title to Delete", ...],
  "missing_refs": [["Page A", "Page B"], ...],
  "orphans": ["Page Title", ...]
}}
```
"""

    try:
        llm_output = chat_completion(
            system_prompt="You are a wiki librarian. Analyze and clean up wiki pages.",
            user_prompt=lint_prompt,
        )
    except Exception as exc:
        write_wiki_status(tenant_id, {
            "processing": False,
            "progress": 0,
            "message": f"lint failed: {str(exc)}",
            "updated_at": int(time.time()),
        })
        raise RuntimeError(f"LLM lint failed: {exc}") from exc

    # Parse lint output
    json_match = re.search(r'\{[\s\S]*\}', llm_output)
    if not json_match:
        return {"merged": 0, "removed": 0, "updated": 0, "error": "Failed to parse lint output"}

    try:
        lint_recs = json.loads(json_match.group())
    except json.JSONDecodeError:
        return {"merged": 0, "removed": 0, "updated": 0, "error": "Invalid JSON in lint output"}

    # Apply lint recommendations
    merges = lint_recs.get("merges", [])
    deletes = lint_recs.get("deletes", [])
    missing_refs = lint_recs.get("missing_refs", [])

    # Build title index
    page_map = {p.title: p for p in pages}

    # Apply merges
    for merge_pair in merges:
        if len(merge_pair) < 2:
            continue
        titles = [m for m in merge_pair if m in page_map]
        if len(titles) < 2:
            continue
        primary = page_map[titles[0]]
        for t in titles[1:]:
            other = page_map[t]
            primary.content += f"\n\n---\n\n{other.content}"
            primary.source_docs.extend(other.source_docs)
            primary.tags = list(set(primary.tags + other.tags))
            primary.cross_references = list(set(primary.cross_references + other.cross_references))
            primary.updated_at = int(time.time())
            del page_map[t]

    # Apply deletes
    for t in deletes:
        if t in page_map:
            del page_map[t]

    # Apply missing refs
    for ref_pair in missing_refs:
        if len(ref_pair) < 2:
            continue
        if ref_pair[0] in page_map and ref_pair[1] in page_map:
            if ref_pair[1] not in page_map[ref_pair[0]].cross_references:
                page_map[ref_pair[0]].cross_references.append(ref_pair[1])
            if ref_pair[0] not in page_map[ref_pair[1]].cross_references:
                page_map[ref_pair[1]].cross_references.append(ref_pair[0])

    final_pages = list(page_map.values())

    write_wiki_status(tenant_id, {
        "processing": True,
        "progress": 80,
        "message": "saving cleaned wiki",
        "updated_at": int(time.time()),
    })

    save_pages(tenant_id, final_pages)
    append_log(tenant_id, "lint", f"Merged {len(merges)}, deleted {len(deletes)}", [p.title for p in final_pages])

    write_wiki_status(tenant_id, {
        "processing": False,
        "progress": 100,
        "message": "lint complete",
        "updated_at": int(time.time()),
        "pages": len(final_pages),
    })

    return {
        "merged": len(merges),
        "removed": len(deletes),
        "updated": len(missing_refs),
        "final_pages": len(final_pages),
    }


# ---------------------------------------------------------------------------
# Wiki markdown export
# ---------------------------------------------------------------------------

def export_wiki_markdown(tenant_id: str) -> Iterator[tuple[str, str]]:
    """Export all wiki pages as markdown files."""
    pages = load_pages(tenant_id)
    index = get_index(tenant_id)

    # Generate index.md
    index_content = """# Wiki Index

This index catalogs all wiki pages in the knowledge base.

## Pages by Type

"""
    by_type: dict[str, list[str]] = {}
    for p in pages:
        by_type.setdefault(p.page_type, []).append(f"- [[{p.title}]]")

    for ptype, items in by_type.items():
        index_content += f"\n### {ptype.capitalize()} Pages\n\n" + "\n".join(items) + "\n"

    index_content += "\n\n## All Pages\n\n" + "\n".join(f"- [[{p.title}]]" for p in pages)

    yield "index.md", index_content

    # Generate individual pages
    for p in pages:
        filename = re.sub(r'[^\w\s-]', '', p.title.lower()).replace(' ', '-') + '.md'
        yield filename, p.to_markdown()
