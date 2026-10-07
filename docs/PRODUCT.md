# Product

## The problem

Indian companies already hold most of the data compliance asks for, but it's scattered across purchase invoices, recycler certificates, GST records and ERP exports. The usual workflow:

1. Operations or finance exports or photocopies the documents.
2. Someone, often a consultant, types line items into a spreadsheet and guesses which plastic each one is.
3. Totals are copied into the regulator's template.
4. When an auditor asks where a number came from, nobody can say quickly.

Provenance replaces the spreadsheet with a workflow in which the machine does the reading and suggesting, a person makes every decision, and every reported number keeps a link back to its evidence.

## Who it's for

**PIBOs** (producers, importers and brand owners of plastic packaging) that must register on the CPCB centralized EPR portal and file annual returns. The day-to-day user is a compliance, sustainability or finance person at such a company, or the consultant who files on its behalf.

## Plastic EPR in brief

Extended Producer Responsibility (EPR) under India's Plastic Waste Management Rules makes PIBOs responsible for the plastic packaging they put on the market. In practice, each year a PIBO has to:

- **Report what it introduced.** Plastic packaging placed on the market, by material and by CPCB category. Purchase invoices are the main evidence.
- **Meet targets.** Collect, recycle and reuse a share of that quantity, as set per category and year in the CPCB guidelines.
- **Prove fulfilment.** Recycling certificates and EPR certificates from registered recyclers, and collection records.
- **File an annual return** on the CPCB portal. Provenance shows the due date as 30 June after the financial year closes.

CPCB categories:

| Category | Covers |
| --- | --- |
| I | Rigid plastic packaging |
| II | Flexible plastic packaging (single or multilayer of different plastics), carry bags, sheets, covers |
| III | Multilayered packaging with at least one non-plastic layer |
| IV | Compostable plastic packaging |

The reporting period is the Indian financial year, April to March. A document belongs to the year of its invoice date, not the date it was uploaded.

## How Provenance works

| Step | What the user sees | What happens underneath |
| --- | --- | --- |
| 1. Set up | Company name, GSTIN, PIBO category, CPCB EPR registration number | Stored on the company profile; GSTIN and EPR number are validated |
| 2. Upload | Drag in documents and choose the type: purchase invoice, recycling certificate, collection receipt or EPR record | Duplicates are rejected by file hash; the file goes to private storage |
| 3. Read | A progress state per document | OCR extracts text, fields and line items; quantities become kilograms |
| 4. Suggest | Each line has a suggested material and category, with a confidence and the reason | Trade-name synonym search plus a local language model |
| 5. Review | One line at a time beside the source document: approve, correct or exclude | Nothing counts until a person decides; who and when are recorded |
| 6. File | The year's totals, blockers and warnings | Reviewed lines are summed per financial year and ledger (introduced, recycled, collected) |
| 7. Finalize | Sign off the year and export CSV, JSON or PDF | A snapshot is frozen; the year becomes read-only until reopened |
| 8. Obligations | What's owed per category, what's covered, and the shortfall | Q = A + B − C with default or company targets |

Alongside this:
- **Activity** is the audit trail: every action with who made it and when, exportable to CSV.
- **Materials library** holds the company's own trade names, matched before the classifier. Lines corrected in review are suggested as new entries, so suggestions improve from the company's own data.
- **Regulatory research** answers questions from the official CPCB and SEBI documents and cites the source.
- **Settings** covers the company profile, account security, service health and a full data export.

## Principles

These shape most product decisions. Keep to them when adding features.

1. **A person approves every number.** The models suggest and never decide. Bulk approval exists only for suggestions that are complete and high-confidence, and it's still an explicit action.
2. **Every number is traceable.** A total breaks down into lines, a line links to its document, and the decision records who made it and when.
3. **Signed-off means frozen.** A finalized year shows the snapshot that was signed off. Edits, late documents and drift are flagged, never merged silently.
4. **Never double-count.** The same file can't be uploaded twice, even if two uploads arrive at the same moment.
5. **Say what's missing.** Blockers (things that stop finalizing) and warnings (things to be aware of) are explicit, and each says where to fix it.
6. **Be honest about scope.** Provenance prepares the filing; it doesn't submit it, and it doesn't claim regulatory acceptance.

## Roadmap

### Now: hardening the EPR workflow

- **Better regulatory search** (keyword plus vector search, then re-ranking). Tests showed wrong regulatory answers come from the passage with the answer ranking too low, not from the model's size.
- Using OCR confidence to flag hard-to-read lines.
- **Integration and end-to-end tests**: the backend against a disposable database, and a browser test of upload → review → finalize.

### Built: EPR obligations

Totals become obligations on the Obligations page, using default targets from the 2022 guidelines that each company can override per year, since the rules change:

```text
EPR quantity       Q = A + B − C
  A = virgin plastic packaging introduced in the reference period
  B = pre-consumer plastic packaging waste
  C = quantity supplied to other registered or exempted entities

EPR obligation     = Q × EPR target %          (100% from FY 2023-24)
recycling minimum  = obligation × minimum %    (Category I: 50% in FY 2024-25, rising to 80%)
shortfall          = obligation − recycled
compensation       = shortfall × rate per kg   (only if the company sets a rate)
```

Worked example for Category I in FY 2025-26: A = 200 kg, B = 50 kg, C = 20 kg gives Q = 230 kg. With the defaults (100% EPR target, 60% minimum recycling), the obligation is 230 kg, of which at least 138 kg must be recycled. With 100 kg of recycling certificates, the shortfall is 130 kg and recycling is 38 kg below its minimum.

Next on this page: tracking EPR certificates and other fulfilment routes besides recycling certificates.

### Later: beyond plastic

The same pipeline (documents in, reviewed and traceable numbers out) extends to other Indian disclosures.

**BRSR Core.** Assurance-friendly ESG figures from utility, fuel, purchase, water, production and waste data, accepted as CSV templates:

```text
utilities.csv          month, facility, type(electricity|water), units, unit_type(kWh|kL), bill_amount
fuel_purchases.csv     date, facility, fuel_type, quantity, unit(L|kg|Nm3)
purchases.csv          date, supplier_name, supplier_gstin, item_desc, hsn_code, qty, unit, net_amount, plant
shipments.csv          date, from_pincode, to_pincode, mode(road|rail|air|sea), weight_kg, distance_km
production_output.csv  month, plant, product_code, output_qty, unit
sku_packaging.csv      sku, plastic_type, grams_per_unit, category
```

```text
Scope 2 electricity   tCO2e = Σ kWh × factor (kg/kWh) / 1000
Scope 1 fuel          tCO2e = quantity × factor (kg/unit) / 1000
Purchased materials   kgCO2e = standardised quantity × material factor
Transport add-on      kgCO2e = distance_km × weight_kg × factor (kg/t·km) / 1000
Intensities           GHG, water and energy ÷ output; waste diversion = recycled or reused ÷ total waste
```

**Carbon BOM and CCTS readiness.** Product-, order- and supplier-level carbon estimates from GST/HSN line items, with a versioned emission factor library and supplier overrides.

Each later module keeps the same rule: every factor carries its source, year and version, and every result can be reproduced.

## Out of scope

- Submitting returns to the CPCB portal or trading EPR certificates.
- Guaranteeing regulatory acceptance; a person remains responsible for every number.
- Full lifecycle assessment, or replacing an auditor.
