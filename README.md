# Provenance

Provenance is an India-first ESG compliance automation platform. It turns messy operational records - invoices, utility bills, purchase registers, recycling certificates, shipment logs, and packaging data - into regulator-ready ESG outputs with traceable calculations.

The first product spine is Plastic EPR compliance. The broader roadmap expands the same data pipeline into BRSR Core reporting, carbon intensity baselines, and CCTS readiness.

```text
upload files -> extract data -> classify materials -> validate exceptions -> calculate obligations -> export reports
```

## Why This Exists

Indian companies already have most of the data needed for ESG reporting, but it is scattered across ERP exports, GST records, PDFs, invoices, utility bills, and consultant spreadsheets.

The current manual workflow usually looks like this:

1. Finance and operations teams export raw data from Tally, SAP, Oracle, Zoho, Excel, or billing portals.
2. Consultants clean and multiply rows in spreadsheets.
3. Totals are copied into BRSR, EPR, or internal ESG templates.
4. Auditors ask where each number came from.

Provenance replaces that with a repeatable workflow where every number can be traced back to the uploaded document, input row, material classification, factor, formula, and reviewer action.

## Product Positioning

Provenance is not a generic ESG dashboard and it does not claim full lifecycle assessment on day one.

It is a compliance autopilot for Indian companies:

- **Plastic EPR first:** calculate CPCB-aligned obligations from PIBO registration data, purchase invoices, recycling certificates, collection receipts, and packaging records.
- **BRSR Core next:** generate assurance-friendly ESG numbers from utility, fuel, purchase, water, production, and waste data.
- **Carbon BOM later:** estimate product/order-level emissions from GST/HSN line items, factor libraries, and optional supplier overrides.
- **Audit trail always:** every output is backed by structured provenance.

## Current Repository Status

This repo is being consolidated. Several services exist, but the end-to-end data flow is not fully wired yet.

| Area            | Status                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| React web app   | Screens exist, but some views still need real API-backed data states.                       |
| Express backend | Main API orchestrator with real OCR, classifier RAG, and regulatory RAG adapters.              |
| OCR engine      | PaddleOCR extraction modules exist. FastAPI service entrypoint is not implemented yet.      |
| RAG classifier  | FastAPI/Qdrant/Ollama plastic material classifier wired into document processing.              |
| Regulatory RAG  | FastAPI/Qdrant/Ollama CPCB and SEBI research service exposed through the backend and frontend. |
| Database        | Supabase PostgreSQL is the shared source of truth for application data.                     |
| Infra           | Local compose currently starts Postgres only. Canonical infra is still being consolidated.  |

See [docs/REPO_MAP.md](docs/REPO_MAP.md) for the repo map and cleanup notes.

## MVP Flow

The first end-to-end MVP should support this flow:

1. **Company onboarding**
   - Company profile, GSTIN, PIBO category, approved material categories, target financial year.

2. **Document upload**
   - EPR registration certificate
   - Purchase invoices for raw plastic/materials
   - Recycling certificates from recyclers
   - Waste collection receipts
   - Optional GST returns or production/sales exports for cross-checking

3. **OCR and extraction**
   - Extract text/tables from PDFs and images.
   - Capture dates, quantities, units, supplier/recycler names, certificate numbers, CPCB authorization numbers, and line-item descriptions.

4. **Material classification**
   - Map messy invoice language to material categories.
   - Example: `Reliance Polypet 3020` -> PET resin.
   - Example: `SPIL HD5400G` -> HDPE granules.
   - Low-confidence or ambiguous classifications are flagged for human review.

5. **Human validation**
   - Users verify or correct material codes, quantities, and extracted fields.
   - Corrections are saved as feedback for future improvement.

6. **EPR calculation**
   - Calculate category-wise generated quantity, recycling targets, credits, shortfalls, and filing readiness.

7. **Reports and exports**
   - Dashboard summary
   - CPCB-style EPR draft
   - Reviewer/auditor appendix
   - Later: BRSR Core pack and carbon intensity reports

## Input Data

### EPR Documents

| Document                          | Why it matters                                | Data extracted                                                     |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| CPCB EPR registration certificate | Verifies registration and approved categories | Registration number, valid-until date, approved plastic categories |
| Purchase invoices                 | Calculates plastic introduced/generated       | Plastic type, quantity, unit, date, supplier, GSTIN                |
| Recycling certificates            | Proves recycling fulfillment                  | Recycler name, CPCB authorization number, recycled quantity, date  |
| Waste collection receipts         | Tracks material before recycling              | Collector details, quantity collected, date                        |
| GST returns or sales exports      | Cross-checks production/sales volumes         | Turnover, product categories, sales units                          |

### BRSR / Carbon Inputs

The broader platform should accept these CSV templates:

```text
utilities.csv
month, facility, type(electricity|water), units, unit_type(kWh|kL), bill_amount

fuel_purchases.csv
date, facility, fuel_type(diesel|lpg|png...), quantity, unit(L|kg|Nm3)

purchases.csv
date, supplier_name, supplier_gstin, item_desc, hsn_code, qty, unit, net_amount, plant, state_from, state_to

shipments.csv
date, from_pincode, to_pincode, mode(road|rail|air|sea), weight_kg, distance_km

production_output.csv
month, plant, product_code, output_qty, unit

sku_packaging.csv
sku, plastic_type, grams_per_unit, category
```

## Material Categories

The EPR module should support CPCB-style plastic categories and detailed material codes.

| High-level type             | Common examples                                                            |
| --------------------------- | -------------------------------------------------------------------------- |
| PET                         | Water bottles, soda bottles, food containers, PET resin, PET film          |
| HDPE                        | Milk jugs, detergent bottles, pipes, HDPE granules                         |
| PVC                         | Pipes, cables, flooring                                                    |
| LDPE                        | Plastic bags, films, squeeze bottles                                       |
| PP                          | Bottle caps, straws, yogurt containers                                     |
| PS                          | Foam cups, trays, packaging peanuts                                        |
| MLP / Multi-layer           | Chips packets, juice boxes, tetra packs, metallized films, laminated tubes |
| Compostable / biodegradable | Compostable bags, sheets, films, commodities                               |
| Other                       | Mixed plastics, composites, ambiguous products                             |

The classifier should support both broad codes such as `PET`, `HDPE`, and more specific codes such as `PET_RIGID`, `LDPE_FLEX`, `MLP_TETRA`, and `COMPOST_BAG`.

## Core Calculations

### Plastic EPR

EPR quantity:

```text
Q = A + B - C
```

Where:

- `A` = average virgin plastic packaging material sold/introduced in the reference period
- `B` = average pre-consumer plastic packaging waste
- `C` = quantity supplied to other registered or exempted entities

Recycling obligation:

```text
recycling_target = Q * target_percentage
```

Sample:

```text
A = 200 kg
B = 50 kg
C = 20 kg
target = 60%

Q = 200 + 50 - 20 = 230 kg
recycling_target = 230 * 0.60 = 138 kg
```

Shortfall estimate:

```text
shortfall = target_kg - fulfilled_kg
environmental_compensation = shortfall * rate_per_kg
```

Rates and targets should live in configurable tables, not hardcoded business logic, because regulatory values can change.

### Scope 2 Electricity

```text
tCO2e_electricity = sum(electricity_kWh) * factor_kg_per_kWh / 1000
```

### Scope 1 Fuel

```text
tCO2e_fuel = quantity * factor_kg_per_unit / 1000
```

### Carbon BOM / Purchased Materials

```text
co2e_line_kg = standardized_quantity * material_factor_kg_per_unit
```

Optional transport add-on:

```text
transport_kg = distance_km * weight_kg * factor_kg_per_tkm / 1000
```

### Water

```text
total_water_kL = sum(water_kL)
```

### Intensity Metrics

```text
GHG_intensity = total_tCO2e / output_qty
water_intensity = total_water_kL / output_qty
energy_intensity = total_energy_GJ / output_qty
waste_diversion_rate = recycled_or_reused_waste / total_waste * 100
```

Revenue intensity can also be calculated against PPP-adjusted revenue where needed for BRSR-style reporting.

## Architecture

```text
apps/
  web-app/             React/Vite frontend
  backend-service/     Express orchestration API
  ocr-service/         OCR engine and future OCR API
  rag-classify/        Plastic material classification service
  rag-regulatory/      Optional regulatory RAG chatbot/scraper

infra/
  docker-compose.yaml  Shared Qdrant, Ollama, and classifier runtime

docs/
  REPO_MAP.md          Repo map, cleanup status, decision log
  LOCAL_DEV.md         Local setup notes while infra is being consolidated
```

### Intended Data Flow

```text
Frontend
  -> Backend API
    -> Storage
    -> OCR service
    -> RAG classification service
    -> Postgres/Supabase tables
    -> Dashboard/report exports
```

The backend should be the orchestration layer. OCR and RAG should be replaceable services behind stable backend adapters.

## Local Development

Current canonical setup instructions live in [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md).

Short version:

```bash
docker compose -f infra/docker-compose.yaml up -d

cd apps/backend-service
cp .env.example .env.development
npm install
npm run dev

cd ../web-app
cp .env.example .env
npm install
npm run dev
```

The local setup is not yet a complete one-command product boot. That is an active cleanup target.

### Regulatory RAG

The regulatory research service runs on port `8002` and uses the shared Qdrant and Ollama containers. Seed the configured official CPCB and SEBI sources after the stack is running:

```bash
docker compose -f infra/docker-compose.yaml up -d rag-regulatory
docker exec infra-rag-regulatory-1 python scripts/ingest.py --config src/config/sources.yaml

curl -X POST http://localhost:8002/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What is extended producer responsibility for plastic packaging?"}'
```

The service returns a grounded answer with the source document URL for each retrieved passage. The backend exposes it at POST /api/regulatory/query, and the authenticated frontend screen is available at /regulatory.

## Roadmap

### Phase 1 - Repo and Infra Hygiene

- Centralize README/docs.
- Consolidate `.gitignore` rules at the root.
- Decide one canonical compose file.
- Remove vendored/generated artifacts where possible.
- Make local boot predictable.

### Phase 2 - EPR MVP Spine

- Implement real OCR FastAPI entrypoint.
- Wire backend OCR adapter to the real OCR service.
- Expand regulatory research into filing-specific guidance and citation review.
- Store extracted fields, line items, confidence, and review status.
- Complete EPR calculation and filing-period aggregation.
- Remove dummy frontend data.

### Phase 3 - BRSR Core Lite

- Add utility, fuel, purchase, water, production, and waste CSV ingestion.
- Implement energy, water, GHG, waste, and intensity calculations.
- Generate BRSR Core CSV/PDF pack with a provenance appendix.

### Phase 4 - Carbon BOM and CCTS Readiness

- Add HSN-driven material mapping.
- Add factor library with source/year/version.
- Add product/order/plant/supplier carbon summaries.
- Add what-if improvements and supplier override workflow.

### Phase 5 - Hardening

- Add migrations and seed strategy.
- Add end-to-end smoke tests.
- Add auth/RBAC hardening.
- Add audit log and formula versioning.
- Add export tests for generated reports.

## What Provenance Does Not Claim Yet

- It is not a verified full LCA tool.
- It does not submit directly to government portals.
- It does not guarantee regulatory acceptance without review.
- It does not replace auditors or consultants for edge cases.

The goal is to automate the repeatable 80% and make the remaining 20% visible, reviewable, and traceable.

## Development Principle

Every calculated number should answer:

```text
Where did this come from?
Which input rows support it?
Which formula was used?
Which factor version was used?
Who reviewed or corrected it?
Can it be reproduced later?
```

That is the core of Provenance.
