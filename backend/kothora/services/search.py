"""Search providers used for grounding. Web search is configurable; scholarly search
uses OpenAlex, which is free and needs no key."""

from dataclasses import asdict, dataclass, field
from typing import Protocol

import httpx

from kothora.config import Settings


class SearchError(Exception):
    pass


@dataclass
class Source:
    title: str
    url: str
    snippet: str
    kind: str = "web"  # web|scholarly
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    doi: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class SearchProvider(Protocol):
    async def search(self, query: str, limit: int) -> list[Source]: ...


async def _get_json(http: httpx.AsyncClient, method: str, url: str, **kwargs) -> dict:
    try:
        response = await http.request(method, url, timeout=15.0, **kwargs)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SearchError(f"{url}: {exc}") from exc


class NoSearch:
    async def search(self, query: str, limit: int) -> list[Source]:
        return []


class SearxngSearch:
    def __init__(self, http: httpx.AsyncClient, base_url: str) -> None:
        self._http, self._url = http, base_url.rstrip("/") + "/search"

    async def search(self, query: str, limit: int) -> list[Source]:
        data = await _get_json(self._http, "GET", self._url, params={"q": query, "format": "json"})
        return [
            Source(title=r.get("title", ""), url=r["url"], snippet=r.get("content", ""))
            for r in data.get("results", [])[:limit]
            if r.get("url")
        ]


class BraveSearch:
    URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, http: httpx.AsyncClient, api_key: str) -> None:
        self._http, self._api_key = http, api_key

    async def search(self, query: str, limit: int) -> list[Source]:
        data = await _get_json(
            self._http,
            "GET",
            self.URL,
            params={"q": query, "count": limit},
            headers={"X-Subscription-Token": self._api_key, "Accept": "application/json"},
        )
        results = (data.get("web") or {}).get("results", [])
        return [
            Source(title=r.get("title", ""), url=r["url"], snippet=r.get("description", ""))
            for r in results[:limit]
            if r.get("url")
        ]


class TavilySearch:
    URL = "https://api.tavily.com/search"

    def __init__(self, http: httpx.AsyncClient, api_key: str) -> None:
        self._http, self._api_key = http, api_key

    async def search(self, query: str, limit: int) -> list[Source]:
        data = await _get_json(
            self._http,
            "POST",
            self.URL,
            json={"query": query, "max_results": limit},
            headers={"Authorization": f"Bearer {self._api_key}"},
        )
        return [
            Source(title=r.get("title", ""), url=r["url"], snippet=r.get("content", ""))
            for r in data.get("results", [])[:limit]
            if r.get("url")
        ]


class OpenAlexSearch:
    """Peer-reviewed and preprint literature, with the metadata a bibliography needs."""

    URL = "https://api.openalex.org/works"

    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def search(self, query: str, limit: int) -> list[Source]:
        data = await _get_json(
            self._http, "GET", self.URL, params={"search": query, "per_page": limit}
        )
        sources = []
        for work in data.get("results", [])[:limit]:
            doi = work.get("doi")
            landing = (work.get("primary_location") or {}).get("landing_page_url")
            url = doi or landing or work.get("id")
            if not url:
                continue
            sources.append(
                Source(
                    title=work.get("display_name") or "Untitled",
                    url=url,
                    snippet=_abstract_text(work.get("abstract_inverted_index"))[:600],
                    kind="scholarly",
                    authors=[
                        a["author"]["display_name"]
                        for a in work.get("authorships", [])
                        if (a.get("author") or {}).get("display_name")
                    ],
                    year=work.get("publication_year"),
                    doi=doi.removeprefix("https://doi.org/") if doi else None,
                )
            )
        return sources


def _abstract_text(inverted_index: dict[str, list[int]] | None) -> str:
    """OpenAlex stores abstracts as {word: [positions]}; rebuild the running text."""
    if not inverted_index:
        return ""
    positioned = [(pos, word) for word, positions in inverted_index.items() for pos in positions]
    return " ".join(word for _, word in sorted(positioned))


def make_web_search(settings: Settings, http: httpx.AsyncClient) -> SearchProvider:
    match settings.search_provider:
        case "searxng":
            return SearxngSearch(http, settings.searxng_url)
        case "brave":
            if not settings.brave_api_key:
                raise ValueError("KOTHORA_BRAVE_API_KEY is required for the brave search provider")
            return BraveSearch(http, settings.brave_api_key)
        case "tavily":
            if not settings.tavily_api_key:
                raise ValueError(
                    "KOTHORA_TAVILY_API_KEY is required for the tavily search provider"
                )
            return TavilySearch(http, settings.tavily_api_key)
        case _:
            return NoSearch()
