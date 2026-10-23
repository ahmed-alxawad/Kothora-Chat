import httpx
import pytest

from kothora.services.llm import ChatModelClient, ModelError, ModelUnavailableError, Usage

from .conftest import sse_response


async def collect(handler) -> list:
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = ChatModelClient("http://model.test/v1", http, api_key="k")
        return [e async for e in client.stream("m", [{"role": "user", "content": "hi"}])]


async def test_stream_yields_text_then_usage():
    events = await collect(
        lambda r: sse_response("a", "b", usage={"prompt_tokens": 3, "completion_tokens": 2})
    )
    assert events == ["a", "b", Usage(3, 2, 0.0)]


async def test_stream_sends_the_api_key():
    seen = []

    def handler(request):
        seen.append(request.headers["authorization"])
        return sse_response("ok")

    await collect(handler)
    assert seen == ["Bearer k"]


async def test_http_error_means_unavailable():
    with pytest.raises(ModelUnavailableError, match="HTTP 503"):
        await collect(lambda r: httpx.Response(503, text="overloaded"))


async def test_connection_failure_means_unavailable():
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ModelUnavailableError):
        await collect(handler)


async def test_error_inside_the_stream_is_raised():
    body = 'data: {"error": {"message": "context too long"}}\n\n'
    with pytest.raises(ModelError, match="context too long"):
        await collect(lambda r: httpx.Response(200, text=body))
