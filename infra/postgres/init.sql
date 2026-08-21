-- Provenance: local Postgres schema
-- Derived from actual Supabase pg_dump (schema-only). Changes from source:
--   1. extensions.uuid_generate_v4() -> uuid_generate_v4() (extension enabled in public,
--      not a separate "extensions" schema like Supabase uses)
--   2. companies.id no longer FKs to auth.users(id) -- that table doesn't exist here
--   3. handle_new_user() trigger dropped -- it fired on auth.users insert (Supabase Auth
--      internal), which has no equivalent locally. You must insert a companies row
--      manually/via seed until real auth exists.
--   4. RLS policies and ROW SECURITY dropped -- they all key off auth.uid(), which is a
--      Supabase Auth function that doesn't exist in vanilla Postgres. Your backend
--      connects with a full-privilege role and never went through RLS anyway
--      (supabaseAdmin = service role = bypasses RLS), so this was never your real
--      enforcement layer. Add real authorization in the Express layer instead.
--   5. aggregate_filing_period() kept as-is -- currently unused by the Node backend,
--      which duplicates this logic in JS (compliance.service.js -> recalculatePeriod).
--      Either wire the backend to call this instead, or drop it. Left in for now.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- Functions
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.aggregate_filing_period(p_company_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE(doc_count bigint, pet numeric, hdpe numeric, pp numeric, ldpe numeric, pvc numeric, ps numeric, mlp numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT d.id) as doc_count,
    COALESCE(SUM(CASE WHEN c.material_code = 'PET' THEN c.quantity_kg ELSE 0 END), 0) as pet,
    COALESCE(SUM(CASE WHEN c.material_code = 'HDPE' THEN c.quantity_kg ELSE 0 END), 0) as hdpe,
    COALESCE(SUM(CASE WHEN c.material_code = 'PP' THEN c.quantity_kg ELSE 0 END), 0) as pp,
    COALESCE(SUM(CASE WHEN c.material_code = 'LDPE' THEN c.quantity_kg ELSE 0 END), 0) as ldpe,
    COALESCE(SUM(CASE WHEN c.material_code = 'PVC' THEN c.quantity_kg ELSE 0 END), 0) as pvc,
    COALESCE(SUM(CASE WHEN c.material_code = 'PS' THEN c.quantity_kg ELSE 0 END), 0) as ps,
    COALESCE(SUM(CASE WHEN c.material_code = 'MLP' THEN c.quantity_kg ELSE 0 END), 0) as mlp
  FROM documents d
  JOIN document_classifications c ON d.id = c.document_id
  WHERE d.company_id = p_company_id
    AND d.created_at BETWEEN p_start_date AND (p_end_date || 'T23:59:59')::timestamptz
    AND c.verified_by_user = true;
END;
$$;

--
-- Tables
--

CREATE TABLE public.materials_master (
    material_code character varying(10) NOT NULL,
    material_name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    CONSTRAINT materials_master_pkey PRIMARY KEY (material_code)
);

CREATE TABLE public.companies (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    company_name character varying(255),
    gst_number character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email_id text NOT NULL,
    "Pibo_category" text[] DEFAULT '{}'::text[],
    onboarding_completed boolean DEFAULT false,
    CONSTRAINT companies_pkey PRIMARY KEY (id),
    CONSTRAINT companies_email_id_key UNIQUE (email_id)
);

CREATE TABLE public.company_materials (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    material_code character varying(10) NOT NULL,
    added_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT company_materials_pkey PRIMARY KEY (id),
    CONSTRAINT company_materials_company_id_material_code_key UNIQUE (company_id, material_code),
    CONSTRAINT company_materials_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT company_materials_material_code_fkey FOREIGN KEY (material_code) REFERENCES public.materials_master(material_code)
);

CREATE TABLE public.documents (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    file_path character varying(500),
    raw_text text,
    extracted_data jsonb DEFAULT '{}'::jsonb,
    document_type character varying(50),
    confidence_score numeric(5,2),
    status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ocr_confidence numeric(5,2),
    rag_confidence numeric(3,2),
    requires_human_review boolean DEFAULT false,
    verified_by_user boolean DEFAULT false,
    reasoning text,
    ocr_job_id character varying(100),
    primary_material character varying(10),
    file_size bigint,
    mime_type character varying(100),
    CONSTRAINT documents_pkey PRIMARY KEY (id),
    CONSTRAINT documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
    CONSTRAINT documents_primary_material_fkey FOREIGN KEY (primary_material) REFERENCES public.materials_master(material_code)
);

COMMENT ON COLUMN public.documents.extracted_data IS 'Raw OCR output. Structured classifications go to document_classifications table';

CREATE TABLE public.filing_periods (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    year integer NOT NULL,
    quarter character varying(2) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(50) DEFAULT 'OPEN'::character varying,
    total_pet_kg numeric(15,2) DEFAULT 0,
    total_hdpe_kg numeric(15,2) DEFAULT 0,
    total_pp_kg numeric(15,2) DEFAULT 0,
    total_ldpe_kg numeric(15,2) DEFAULT 0,
    total_pvc_kg numeric(15,2) DEFAULT 0,
    total_ps_kg numeric(15,2) DEFAULT 0,
    total_mlp_kg numeric(15,2) DEFAULT 0,
    documents_count integer DEFAULT 0,
    submitted_at timestamp with time zone,
    target_percentage numeric(5,2) DEFAULT 50.00,
    generated_kg numeric(12,2) DEFAULT 0,
    recycled_kg numeric(12,2) DEFAULT 0,
    compliance_pct numeric(5,2) DEFAULT 0,
    CONSTRAINT filing_periods_pkey PRIMARY KEY (id),
    CONSTRAINT filing_periods_company_id_year_quarter_key UNIQUE (company_id, year, quarter),
    CONSTRAINT filing_periods_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.document_classifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    document_id uuid NOT NULL,
    material_code character varying(10),
    quantity_kg numeric(15,2),
    confidence_score numeric(3,2),
    reasoning text,
    matched_synonym character varying(255),
    vector_similarity numeric(3,2),
    qdrant_point_id character varying(50),
    requires_human_review boolean DEFAULT false,
    verified_by_user boolean DEFAULT false,
    corrected_material_code character varying(10),
    corrected_quantity_kg numeric(15,2),
    reviewer_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_classifications_pkey PRIMARY KEY (id),
    CONSTRAINT chk_confidence_range CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT chk_quantity_positive CHECK ((quantity_kg > (0)::numeric)),
    CONSTRAINT document_classifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
    CONSTRAINT document_classifications_material_code_fkey FOREIGN KEY (material_code) REFERENCES public.materials_master(material_code),
    CONSTRAINT document_classifications_corrected_material_code_fkey FOREIGN KEY (corrected_material_code) REFERENCES public.materials_master(material_code)
);

CREATE TABLE public.material_synonyms (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    material_code character varying(10) NOT NULL,
    synonym character varying(255) NOT NULL,
    manufacturer character varying(255),
    description text,
    qdrant_collection character varying(50) DEFAULT 'plastic_synonyms'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT material_synonyms_pkey PRIMARY KEY (id),
    CONSTRAINT material_synonyms_material_code_synonym_manufacturer_key UNIQUE (material_code, synonym, manufacturer),
    CONSTRAINT material_synonyms_material_code_fkey FOREIGN KEY (material_code) REFERENCES public.materials_master(material_code) ON DELETE CASCADE
);

CREATE TABLE public.classification_feedback (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    classification_id uuid NOT NULL,
    original_material_code character varying(10),
    original_quantity_kg numeric(15,2),
    corrected_material_code character varying(10),
    corrected_quantity_kg numeric(15,2),
    user_id uuid,
    feedback_type character varying(50),
    notes text,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT classification_feedback_pkey PRIMARY KEY (id),
    CONSTRAINT classification_feedback_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.document_classifications(id) ON DELETE CASCADE,
    CONSTRAINT classification_feedback_corrected_material_code_fkey FOREIGN KEY (corrected_material_code) REFERENCES public.materials_master(material_code),
    CONSTRAINT classification_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.companies(id)
);

--
-- View
--

CREATE VIEW public.dashboard_summary AS
 SELECT d.id AS document_id,
    d.company_id,
    d.filename,
    d.document_type,
    d.status,
    d.requires_human_review,
    d.verified_by_user,
    d.created_at,
    d.primary_material,
    count(dc.id) AS classification_count,
    sum(dc.quantity_kg) AS total_quantity_kg,
    avg(dc.confidence_score) AS avg_confidence,
    bool_or(dc.requires_human_review) AS has_pending_review
   FROM (public.documents d
     LEFT JOIN public.document_classifications dc ON ((d.id = dc.document_id)))
  GROUP BY d.id, d.company_id, d.filename, d.document_type, d.status, d.requires_human_review, d.verified_by_user, d.created_at, d.primary_material;

--
-- Indexes
--

CREATE INDEX idx_classifications_confidence ON public.document_classifications USING btree (confidence_score);
CREATE INDEX idx_classifications_document ON public.document_classifications USING btree (document_id);
CREATE INDEX idx_classifications_material ON public.document_classifications USING btree (material_code);
CREATE INDEX idx_classifications_review ON public.document_classifications USING btree (requires_human_review, verified_by_user) WHERE ((requires_human_review = true) AND (verified_by_user = false));
CREATE INDEX idx_company_materials_company ON public.company_materials USING btree (company_id);
CREATE INDEX idx_documents_company ON public.documents USING btree (company_id);
CREATE INDEX idx_documents_material ON public.documents USING btree (primary_material);
CREATE INDEX idx_documents_review ON public.documents USING btree (requires_human_review, verified_by_user) WHERE (requires_human_review = true);
CREATE INDEX idx_documents_status ON public.documents USING btree (status);
CREATE INDEX idx_filing_periods_company ON public.filing_periods USING btree (company_id);
CREATE INDEX idx_synonyms_lookup ON public.material_synonyms USING btree (synonym, manufacturer);
CREATE INDEX idx_synonyms_material ON public.material_synonyms USING btree (material_code);

--
-- Triggers
--

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classifications_updated_at BEFORE UPDATE ON public.document_classifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();