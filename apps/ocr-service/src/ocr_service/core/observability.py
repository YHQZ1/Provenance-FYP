import contextvars
import json
import logging
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Histogram, generate_latest

request_id_var = contextvars.ContextVar("request_id", default=None)
document_id_var = contextvars.ContextVar("document_id", default=None)

VALID_ID = re.compile(r"^[\w.-]{8,64}$")
SILENT_PATHS = {"/health", "/metrics"}
LEVEL_NAMES = {"warning": "warn", "critical": "error"}

HTTP_DURATION = Histogram(
    "http_request_duration_seconds",
    "Request duration by route and status",
    ["method", "route", "status"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 180),
)


class JsonFormatter(logging.Formatter):
    def __init__(self, service):
        super().__init__()
        self.service = service

    def format(self, record):
        level = record.levelname.lower()
        entry = {
            "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(
                timespec="milliseconds"
            ),
            "level": LEVEL_NAMES.get(level, level),
            "service": self.service,
            "msg": record.getMessage(),
        }
        request_id = request_id_var.get()
        document_id = document_id_var.get()
        if request_id:
            entry["request_id"] = request_id
        if document_id:
            entry["document_id"] = document_id
        entry.update(getattr(record, "fields", None) or {})
        if record.exc_info:
            entry["error"] = str(record.exc_info[1])
            entry["stack"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure_logging(service, level=None):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel((level or os.getenv("LOG_LEVEL", "INFO")).upper())
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False


def _valid(value):
    return value if value and VALID_ID.match(value) else None


def instrument(app: FastAPI, service: str) -> None:
    configure_logging(service)
    log = logging.getLogger("request")

    @app.middleware("http")
    async def observe(request: Request, call_next):
        request_id = _valid(request.headers.get("x-request-id")) or str(uuid.uuid4())
        document_id = _valid(request.headers.get("x-document-id"))
        request_token = request_id_var.set(request_id)
        document_token = document_id_var.set(document_id)
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            elapsed = time.perf_counter() - started
            if request.url.path not in SILENT_PATHS:
                route = getattr(request.scope.get("route"), "path", None) or "unmatched"
                HTTP_DURATION.labels(request.method, route, str(status)).observe(elapsed)
                log.log(
                    logging.ERROR if status >= 500 else logging.INFO,
                    "request",
                    extra={
                        "fields": {
                            "method": request.method,
                            "route": route,
                            "status": status,
                            "duration_ms": round(elapsed * 1000),
                        }
                    },
                )
            request_id_var.reset(request_token)
            document_id_var.reset(document_token)

    @app.get("/metrics", include_in_schema=False)
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
