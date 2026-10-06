# Database

Provenance uses a hosted Supabase project: Postgres for data, Storage for uploaded files, and Auth for users. The schema lives in `supabase/` and is applied in order.

## Migrations

| File | Adds |
| --- | --- |
| `000_baseline.sql` | The core schema: tables, the sign-up trigger, indexes and the original policies. Only for a fresh project. |
| `001_fy_filings.sql` | `fy_filings`: one finalized snapshot per company and financial year |
| `002_classification_category.sql` | `cpcb_category` and `corrected_cpcb_category` on each line |
| `003_company_epr_registration.sql` | `companies.epr_registration_number` |
| `004_review_audit_and_upload_dedupe.sql` | `reviewed_by`, `reviewed_by_name` and `reviewed_at` on each line; a unique file hash per company |
| `005_lock_down_public_access.sql` | Row-level security on `companies`; `dashboard_summary` runs as the caller |
| `006_read_only_client_access.sql` | Client policies on tables and stored files become read-only |
| `007_activity_obligations_trade_names.sql` | `activity_events` (audit trail, backfilled once from existing uploads, reviews and finalizations), `epr_obligation_inputs`, `company_trade_names` |
| `seed.sql` | Reference data: 7 polymers and 26 trade-name synonyms. Safe to re-run. |

**Fresh project:** apply 000 → 007, then `seed.sql`. Either paste each file into the Supabase SQL editor, or set `DATABASE_URL` in `apps/rag-classify/.env` and run:

```bash
for f in supabase/migrations/*.sql supabase/seed.sql; do make db-migrate f=$f; done
```

**Existing project:** apply only the migrations you don't have yet. Every migration after 000 is written to be safe to re-run (`if not exists`, `drop policy if exists`).

**Adding a migration:**
- Name it with the next number, for example `007_short_description.sql`.
- Start it with a comment explaining why it exists.
- Make it safe to re-run.
- Test it on a scratch Postgres before applying it to a shared project. If the backend depends on the new column or table, add a probe in `apps/backend-service/src/config/schema.js` so the feature switches off cleanly when the migration hasn't been applied.

## Tables

| Table | One row per | Notes |
| --- | --- | --- |
| `companies` | user | Keyed by the auth user id; created by the `on_auth_user_created` trigger. Holds the company name, GSTIN, PIBO categories and EPR registration number. |
| `documents` | uploaded file | `status`, `file_path` in Storage, OCR output in `raw_text` and `extracted_data`. `extracted_data` holds the document type, file hash, document date, fields, warnings and parsed items. |
| `document_classifications` | line item | The suggestion (`material_code`, `cpcb_category`, `quantity_kg`, `confidence_score`, `reasoning`), the reviewer's corrections (`corrected_*`), `verified_by_user`, `reviewer_notes` and the reviewer stamp. An excluded line is verified with no material. |
| `classification_feedback` | correction | The original and corrected values whenever a reviewer changes a suggestion, kept to improve the classifier later. |
| `fy_filings` | finalized year | `snapshot` is the full filing summary at sign-off. Unique per company and year. |
| `activity_events` | recorded action | Who (`actor_name`), what (`action`, `summary`, `details`), which document and financial year. Written only by the backend, never edited, and kept after the document is deleted. |
| `epr_obligation_inputs` | company, year and category | Pre-consumer waste (B), quantity supplied to registered entities (C), and any EPR target, minimum recycling share or compensation rate the company sets instead of the defaults |
| `company_trade_names` | trade name | A company's own name for a material (unique per company, ignoring case), with an optional CPCB category |
| `materials_master` | polymer | PET, HDPE, LDPE, PP, PVC, PS, MLP |
| `material_synonyms` | trade name | For example `POLYPET 3020 → PET`. Seeded into Qdrant by the classifier. |

**Legacy objects.** `filing_periods`, `company_materials`, the `dashboard_summary` view, the `aggregate_filing_period()` function, and the `documents.document_type` and `documents.primary_material` columns come from the earlier quarterly design. Nothing uses them now. They can be dropped in a future migration.

## Row-level security

The backend uses the service-role key, which bypasses row-level security. RLS therefore exists to stop anyone who has the public anon key, or a signed-in user's token, from going around the backend.

| Object | Clients can |
| --- | --- |
| `companies`, `activity_events`, `epr_obligation_inputs`, `company_trade_names` | Read their own rows |
| `documents`, `document_classifications`, `company_materials`, `filing_periods` | Read their own rows |
| `material_synonyms` | Read all (public reference data) |
| `materials_master`, `classification_feedback`, `fy_filings` | Nothing |
| Storage bucket `documents` | Read files in their own folder (`<user id>/…`), through a policy created in the dashboard; the app itself uses signed URLs |

No client can insert, update or delete anything. If a feature ever needs a direct client write, add a narrow policy for that one operation in a new migration, rather than widening an existing one.

To check what the public key can see, query the REST API with only the anon key. Every table should return no rows:

```bash
curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Prefer: count=exact" \
  -I "$SUPABASE_URL/rest/v1/companies?select=id" | grep -i content-range   # expect */0
```

## Auth settings (Supabase dashboard)

- **Providers:** Email, Google, and Azure (Microsoft). Each OAuth app's redirect URI is `https://<project>.supabase.co/auth/v1/callback`.
- **URL configuration:**
  - **Site URL** is the deployed app, for example `https://provenanceio.vercel.app`.
  - **Redirect URLs** must list every origin the app runs on, for example `http://localhost:5173/**` and `https://provenanceio.vercel.app/**`.
  - If an origin is missing, sign-in and password-reset links silently send users to the Site URL instead.
- **Email:** Supabase's built-in sender is rate-limited and meant for testing. Configure a custom SMTP provider before real users rely on password reset or sign-up confirmation.
