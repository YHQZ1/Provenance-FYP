import threading
import time

from fastapi.testclient import TestClient

from ocr_service.api.routes import ocr as ocr_route
from ocr_service.main import app


def test_documents_never_run_through_the_engine_concurrently(monkeypatch):
    active = 0
    peak = 0
    guard = threading.Lock()

    def fake_process(path, filename):
        nonlocal active, peak
        with guard:
            active += 1
            peak = max(peak, active)
        time.sleep(0.05)
        with guard:
            active -= 1
        return ocr_route.OCRResponse(pages=1, raw_text="", tokens=[], fields={}, line_items=[], confidence=0)

    monkeypatch.setattr(ocr_route.pipeline, "process", fake_process)
    client = TestClient(app)

    def upload():
        response = client.post("/v1/ocr", files={"file": ("a.png", b"\x89PNG", "image/png")})
        assert response.status_code == 200

    threads = [threading.Thread(target=upload) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert peak == 1


def test_health_answers_while_a_document_is_processing(monkeypatch):
    started = threading.Event()
    release = threading.Event()

    def slow_process(path, filename):
        started.set()
        release.wait(5)
        return ocr_route.OCRResponse(pages=1, raw_text="", tokens=[], fields={}, line_items=[], confidence=0)

    monkeypatch.setattr(ocr_route.pipeline, "process", slow_process)
    client = TestClient(app)
    worker = threading.Thread(
        target=lambda: client.post("/v1/ocr", files={"file": ("a.png", b"\x89PNG", "image/png")})
    )
    worker.start()
    assert started.wait(5)
    assert client.get("/health").status_code == 200
    release.set()
    worker.join()
