"""Bibliography export for the Education plan (business document, Section 4.3)."""

import re


def to_bibtex(sources: list[dict]) -> str:
    return "\n\n".join(_bibtex_entry(source) for source in sources)


def to_plain_text(sources: list[dict]) -> str:
    """APA-like reference list, one entry per line."""
    return "\n".join(_plain_entry(source) for source in sources)


def _bibtex_entry(source: dict) -> str:
    is_article = source.get("kind") == "scholarly"
    fields = {"title": source.get("title") or "Untitled"}
    if source.get("authors"):
        fields["author"] = " and ".join(source["authors"])
    if source.get("year"):
        fields["year"] = str(source["year"])
    if source.get("doi"):
        fields["doi"] = source["doi"]
    fields["url"] = source.get("url", "")
    body = ",\n".join(f"  {name} = {{{_escape_bibtex(value)}}}" for name, value in fields.items())
    entry_type = "article" if is_article else "misc"
    return f"@{entry_type}{{{_citation_key(source)},\n{body}\n}}"


def _plain_entry(source: dict) -> str:
    authors = source.get("authors") or []
    author_text = f"{authors[0]} et al." if len(authors) > 3 else ", ".join(authors)
    year = f"({source['year']})" if source.get("year") else "(n.d.)"
    parts = [part for part in (author_text, year, source.get("title") or "Untitled") if part]
    location = f"https://doi.org/{source['doi']}" if source.get("doi") else source.get("url", "")
    return ". ".join(parts) + f". {location}"


def _citation_key(source: dict) -> str:
    authors = source.get("authors") or []
    surname = authors[0].split()[-1] if authors else "source"
    first_word = (source.get("title") or "untitled").split()[0]
    raw = f"{surname}{source.get('year') or ''}{first_word}"
    return re.sub(r"[^A-Za-z0-9]", "", raw).lower() or f"source{source.get('n', '')}"


def _escape_bibtex(value: str) -> str:
    return value.replace("\\", "\\textbackslash{}").replace("{", "\\{").replace("}", "\\}")
