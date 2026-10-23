from kothora.services.bibliography import to_bibtex, to_plain_text
from kothora.services.grounding import annotate_sources, build_messages, cited_numbers
from kothora.services.search import Source, _abstract_text

SOURCES = [
    Source(title="A", url="https://a.example", snippet="alpha"),
    Source(title="B", url="https://b.example", snippet="beta"),
]


def test_cited_numbers_ignore_citations_to_missing_sources():
    assert cited_numbers("One [1]. Two [2][3]. Zero [0].", source_count=2) == {1, 2}


def test_annotate_sources_marks_which_were_cited():
    annotated = annotate_sources("Only the second [2].", SOURCES)
    assert [(s["n"], s["cited"]) for s in annotated] == [(1, False), (2, True)]


def test_build_messages_numbers_sources_in_the_system_prompt():
    messages = build_messages([{"role": "user", "content": "earlier"}], "now?", SOURCES)
    assert messages[0]["role"] == "system"
    assert "[1] A" in messages[0]["content"] and "[2] B" in messages[0]["content"]
    assert messages[1:] == [
        {"role": "user", "content": "earlier"},
        {"role": "user", "content": "now?"},
    ]


def test_build_messages_without_sources_asks_for_no_citations():
    system = build_messages([], "hi", [])[0]["content"]
    assert "Sources" not in system


def test_openalex_abstract_is_rebuilt_in_word_order():
    assert _abstract_text({"world": [1], "hello": [0], "again": [2]}) == "hello world again"
    assert _abstract_text(None) == ""


SCHOLARLY = {
    "n": 1,
    "kind": "scholarly",
    "title": "Mobile money in {Bangladesh}",
    "url": "https://doi.org/10.1/xyz",
    "authors": ["Rahim Uddin", "Karim Ahmed"],
    "year": 2024,
    "doi": "10.1/xyz",
}


def test_bibtex_export_escapes_braces_and_uses_article_for_papers():
    bibtex = to_bibtex([SCHOLARLY])
    assert bibtex.startswith("@article{uddin2024mobile,")
    assert "author = {Rahim Uddin and Karim Ahmed}" in bibtex
    assert "title = {Mobile money in \\{Bangladesh\\}}" in bibtex


def test_plain_text_export_handles_web_sources_without_authors():
    web = {"title": "Dhaka", "url": "https://example.org"}
    assert to_plain_text([web]) == "(n.d.). Dhaka. https://example.org"
    assert to_plain_text([SCHOLARLY]).startswith("Rahim Uddin, Karim Ahmed. (2024).")


def test_cache_key_separates_tiers_and_search_scopes():
    from kothora.services.cache import cache_key

    base = cache_key("What is bKash?", "standard", "web")
    assert cache_key("  what is BKASH? ", "standard", "web") == base
    assert cache_key("What is bKash?", "local", "web") != base
    assert cache_key("What is bKash?", "standard", "scholarly+web") != base
    assert cache_key("What is bKash?", "standard", "none") != base
