"""Turns search results into a citation-bearing prompt and maps the answer's [n] markers
back to sources."""

import re

from kothora.services.llm import ChatMessage
from kothora.services.search import Source

BASE_INSTRUCTIONS = (
    "You are Kothora, an AI assistant for users in Bangladesh. Answer in the language the "
    "user writes in (Bangla or English). Be accurate and concise, and say so when you are "
    "not sure."
)

GROUNDING_INSTRUCTIONS = (
    "Use the numbered sources below. After every sentence that relies on a source, cite it "
    "as [n], for example [1] or [2][3]. Cite only the numbers listed. If the sources do not "
    "answer the question, say that, then answer from general knowledge without citations."
)

_CITATION_PATTERN = re.compile(r"\[(\d{1,2})\]")
# Each source's snippet is trimmed so a handful of sources stays well inside small
# local context windows (Llama 3 8B: 8k tokens).
_MAX_SNIPPET_CHARS = 700


def build_messages(
    history: list[ChatMessage], question: str, sources: list[Source]
) -> list[ChatMessage]:
    system = BASE_INSTRUCTIONS
    if sources:
        system += "\n\n" + GROUNDING_INSTRUCTIONS + "\n\n" + format_sources(sources)
    return [{"role": "system", "content": system}, *history, {"role": "user", "content": question}]


def format_sources(sources: list[Source]) -> str:
    blocks = []
    for number, source in enumerate(sources, start=1):
        snippet = source.snippet[:_MAX_SNIPPET_CHARS]
        blocks.append(f"[{number}] {source.title}\nURL: {source.url}\n{snippet}")
    return "Sources:\n\n" + "\n\n".join(blocks)


def cited_numbers(answer: str, source_count: int) -> set[int]:
    """Citation numbers in the answer that point at a real source; invented ones are dropped."""
    return {
        number
        for match in _CITATION_PATTERN.finditer(answer)
        if 1 <= (number := int(match.group(1))) <= source_count
    }


def annotate_sources(answer: str, sources: list[Source]) -> list[dict]:
    cited = cited_numbers(answer, len(sources))
    return [
        {"n": number, "cited": number in cited, **source.to_dict()}
        for number, source in enumerate(sources, start=1)
    ]
