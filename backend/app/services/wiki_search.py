"""
Wiki-based search tool for the LLM Wiki pattern.
Searches wiki pages and follows cross-references for richer context.
"""

from __future__ import annotations

from typing import Any

from wiki_engine import get_related_pages, search_wiki


def wiki_search(
    tenant_id: str, query: str, top_k: int = 4, follow_refs: bool = True
) -> tuple[list[dict[str, Any]], float]:
    """
    Search wiki pages and optionally follow cross-references.

    Returns:
        tuple of (results with context, best_score)
    """
    # Initial search
    results, best_score = search_wiki(tenant_id, query, top_k)

    if not results:
        return [], 0.0

    if follow_refs:
        # Follow cross-references for top results
        expanded_results = []
        seen_titles = set()

        for result in results[:3]:  # Start with top 3
            if result["title"] in seen_titles:
                continue
            seen_titles.add(result["title"])
            expanded_results.append(result)

            # Get related pages (depth 1 by default)
            related = get_related_pages(tenant_id, result["title"], depth=1)
            for rel_page in related:
                if rel_page.title not in seen_titles:
                    seen_titles.add(rel_page.title)
                    expanded_results.append({
                        "title": rel_page.title,
                        "content": rel_page.content,
                        "page_type": rel_page.page_type,
                        "tags": rel_page.tags,
                        "cross_references": rel_page.cross_references,
                        "source_docs": rel_page.source_docs,
                        "score": result["score"] * 0.9,  # Slightly lower score for expanded
                        "is_expanded": True,
                    })

        return expanded_results, best_score

    return results, best_score


def format_wiki_context(wiki_results: list[dict[str, Any]]) -> str:
    """Format wiki search results as context for LLM."""
    if not wiki_results:
        return "No relevant wiki pages found."

    blocks = []
    for i, r in enumerate(wiki_results, 1):
        refs = ", ".join(f"[[{ref}]]" for ref in r.get("cross_references", [])) if r.get("cross_references") else "None"
        is_expanded = r.get("is_expanded", False)
        marker = "(related)" if is_expanded else ""

        blocks.append(f"""[WIKI PAGE {i} {marker}]
Title: {r['title']}
Type: {r['page_type']}
Tags: {', '.join(r.get('tags', []))}
References: {refs}
Source: {', '.join(r.get('source_docs', [])) or 'Unknown'}

{r['content']}
""")

    return "\n\n".join(blocks)
