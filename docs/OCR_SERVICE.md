# OCR service

`apps/ocr-service` turns an uploaded document into text, a few invoice fields, and candidate line items. It's stateless: the backend sends a file and stores whatever comes back.

## API

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `POST` | `/v1/ocr` | Multipart `file` (PDF, JPEG, PNG or TIFF). Returns `raw_text`, `fields`, `line_items`, `confidence`, `warnings` and `metadata`. |

`fields` covers `invoice_number`, `invoice_date` and `gstin`, each with a value and a confidence. Each line item has a description, quantity, unit and amount where they could be read.

## How it reads a document

1. **PDFs.** Pages with a text layer are read directly with PyMuPDF. Only scanned pages are rendered and passed to OCR. At most `OCR_MAX_PAGES` (default 20) pages are processed.
2. **Images** are deskewed and contrast-enhanced, then passed to PaddleOCR.
3. **Text reconstruction.** Words are grouped into lines by their vertical position and height, so table rows stay together.
4. **Parsing** (`pipeline/parsing.py`) finds:
   - quantities with units: kg, g, tonnes, quintals, plus counts and lengths, which are kept as non-weights;
   - Indian and international number formats (`1,00,000.50`, `100,000.50`);
   - dates in day-first and month-name forms, including labels stacked above values;
   - table rows, while skipping totals rows.

PaddleOCR isn't thread-safe. Calls are serialised with a lock and run in a worker thread, so concurrent uploads queue instead of crashing.

## Limits

| Setting | Default |
| --- | --- |
| `OCR_MAX_UPLOAD_SIZE_MB` | 25 (the backend caps uploads at 10 MB anyway) |
| `OCR_MAX_PAGES` | 20 |

## Running

In the stack: `make up`, then `make logs s=ocr-service`. On Apple Silicon the image runs the `linux/amd64` PaddlePaddle build under emulation, so the first requests are slow.

On its own (Python 3.10–3.12; scanned PDFs need Poppler):

```bash
brew install poppler
cd apps/ocr-service
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
PYTHONPATH=src uvicorn ocr_service.main:app --reload --port 8000
```

Try it on the fixtures:

```bash
curl -s -X POST http://localhost:8000/v1/ocr \
  -F "file=@apps/ocr-service/tests/fixtures/invoices/invoice_0.jpg" | python3 -m json.tool
```

## Tests

`make test-ocr` (after `make venv`). The unit tests cover parsing, PDF page selection and concurrent requests, and run without PaddleOCR installed.
