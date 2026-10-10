import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.observability import JsonFormatter, document_id_var, instrument, request_id_var


def make_app():
    app = FastAPI()

    @app.get("/items/{item_id}")
    def item(item_id: str):
        return {"id": item_id, "request_id": request_id_var.get(), "document_id": document_id_var.get()}

    @app.get("/boom")
    def boom():
        raise RuntimeError("boom")

    instrument(app, "test-service")
    return app


def test_every_response_carries_a_request_id_and_valid_ones_are_reused():
    client = TestClient(make_app())

    generated = client.get("/items/a").headers["x-request-id"]
    assert len(generated) == 36

    reused = client.get("/items/a", headers={"X-Request-ID": "trace-abc12345"})
    assert reused.headers["x-request-id"] == "trace-abc12345"
    assert reused.json()["request_id"] == "trace-abc12345"

    replaced = client.get("/items/a", headers={"X-Request-ID": "bad id!"})
    assert replaced.headers["x-request-id"] != "bad id!"


def test_the_document_id_header_reaches_the_handler():
    client = TestClient(make_app())
    response = client.get("/items/a", headers={"X-Document-ID": "doc-12345678"})
    assert response.json()["document_id"] == "doc-12345678"


def test_requests_are_timed_under_the_route_template():
    client = TestClient(make_app())
    client.get("/items/first")
    client.get("/items/second")
    text = client.get("/metrics").text
    assert 'route="/items/{item_id}"' in text
    assert "first" not in text
    assert 'route="/metrics"' not in text


def test_a_failing_handler_is_counted_as_a_500():
    client = TestClient(make_app(), raise_server_exceptions=False)
    assert client.get("/boom").status_code == 500
    assert 'route="/boom",status="500"' in client.get("/metrics").text


def test_log_lines_are_json_with_the_request_context():
    token = request_id_var.set("req-12345678")
    try:
        record = logging.LogRecord("x", logging.WARNING, __file__, 1, "slow %s", ("call",), None)
        record.fields = {"lines": 3}
        entry = json.loads(JsonFormatter("test-service").format(record))
    finally:
        request_id_var.reset(token)
    assert entry["service"] == "test-service"
    assert entry["level"] == "warn"
    assert entry["msg"] == "slow call"
    assert entry["request_id"] == "req-12345678"
    assert entry["lines"] == 3
