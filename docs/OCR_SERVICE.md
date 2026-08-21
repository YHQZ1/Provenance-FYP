# OCR Service

The OCR service is the document-ingestion boundary for Provenance. It accepts PDF and image uploads and returns normalized tokens, reconstructed text, basic invoice fields, and candidate line items.

## Local development

Use Python 3.10-3.12. Poppler is required for scanned PDFs:

```bash
brew install poppler
cd apps/ocr-service
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
PYTHONPATH=src uvicorn ocr_service.main:app --reload --port 8000
```

## Container

The image installs Poppler and runs the service on port 8000. On Apple Silicon, the image intentionally uses the `linux/amd64` PaddlePaddle runtime for compatibility.

```bash
cd apps/ocr-service
docker build --platform linux/amd64 -t provenance-ocr .
docker run --rm --platform linux/amd64 -p 8000:8000 provenance-ocr
```

Check health:

```bash
curl http://localhost:8000/health
```

Process the three invoice fixtures after the container is running:

```bash
for i in 0 1 2; do
  curl -sS -X POST http://localhost:8000/v1/ocr \
    -F "file=@apps/ocr-service/tests/fixtures/invoices/invoice_${i}.jpg" \
    -o "invoice_${i}_ocr.json"
done
```
