-- Baseline schema: the database as it stood before migrations 001-004.
--
-- Generated with pg_dump --schema-only from the live project and trimmed to the public schema.
-- Apply it to a fresh Supabase project, then 001 onward. An existing project already has all
-- of this; with the Supabase CLI, mark it applied instead of running it:
--   supabase migration repair --status applied 000
--
-- Reference data the classifier needs (materials and trade-name synonyms) is in seed.sql.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Function: aggregate_filing_period(uuid, date, date)

CREATE FUNCTION public.aggregate_filing_period(p_company_id uuid, p_start_date date, p_end_date date) RETURNS TABLE(doc_count bigint, pet numeric, hdpe numeric, pp numeric, ldpe numeric, pvc numeric, ps numeric, mlp numeric)
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

-- Function: handle_new_user()

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.companies (id, email_id)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Function: update_updated_at_column()

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Table: classification_feedback

CREATE TABLE public.classification_feedback (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Table: companies

CREATE TABLE public.companies (
    id uuid NOT NULL,
    company_name character varying(255),
    gst_number character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email_id text NOT NULL,
    "Pibo_category" text[] DEFAULT '{}'::text[],
    onboarding_completed boolean DEFAULT false
);

-- Table: company_materials

CREATE TABLE public.company_materials (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    material_code character varying(10) NOT NULL,
    added_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Table: document_classifications

CREATE TABLE public.document_classifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    CONSTRAINT chk_confidence_range CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT chk_quantity_positive CHECK ((quantity_kg > (0)::numeric))
);

-- Table: documents

CREATE TABLE public.documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    mime_type character varying(100)
);

-- View: dashboard_summary

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

-- Table: filing_periods

CREATE TABLE public.filing_periods (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    compliance_pct numeric(5,2) DEFAULT 0
);

-- Table: material_synonyms

CREATE TABLE public.material_synonyms (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    material_code character varying(10) NOT NULL,
    synonym character varying(255) NOT NULL,
    manufacturer character varying(255),
    description text,
    qdrant_collection character varying(50) DEFAULT 'plastic_synonyms'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Table: materials_master

CREATE TABLE public.materials_master (
    material_code character varying(10) NOT NULL,
    material_name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    description text
);

-- Constraint: classification_feedback classification_feedback_pkey

ALTER TABLE ONLY public.classification_feedback
    ADD CONSTRAINT classification_feedback_pkey PRIMARY KEY (id);

-- Constraint: companies companies_email_id_key

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_email_id_key UNIQUE (email_id);

-- Constraint: companies companies_pkey

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);

-- Constraint: company_materials company_materials_company_id_material_code_key

ALTER TABLE ONLY public.company_materials
    ADD CONSTRAINT company_materials_company_id_material_code_key UNIQUE (company_id, material_code);

-- Constraint: company_materials company_materials_pkey

ALTER TABLE ONLY public.company_materials
    ADD CONSTRAINT company_materials_pkey PRIMARY KEY (id);

-- Constraint: document_classifications document_classifications_pkey

ALTER TABLE ONLY public.document_classifications
    ADD CONSTRAINT document_classifications_pkey PRIMARY KEY (id);

-- Constraint: documents documents_pkey

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

-- Constraint: filing_periods filing_periods_company_id_year_quarter_key

ALTER TABLE ONLY public.filing_periods
    ADD CONSTRAINT filing_periods_company_id_year_quarter_key UNIQUE (company_id, year, quarter);

-- Constraint: filing_periods filing_periods_pkey

ALTER TABLE ONLY public.filing_periods
    ADD CONSTRAINT filing_periods_pkey PRIMARY KEY (id);

-- Constraint: material_synonyms material_synonyms_material_code_synonym_manufacturer_key

ALTER TABLE ONLY public.material_synonyms
    ADD CONSTRAINT material_synonyms_material_code_synonym_manufacturer_key UNIQUE (material_code, synonym, manufacturer);

-- Constraint: material_synonyms material_synonyms_pkey

ALTER TABLE ONLY public.material_synonyms
    ADD CONSTRAINT material_synonyms_pkey PRIMARY KEY (id);

-- Constraint: materials_master materials_master_pkey

ALTER TABLE ONLY public.materials_master
    ADD CONSTRAINT materials_master_pkey PRIMARY KEY (material_code);

-- Index: idx_classifications_confidence

CREATE INDEX idx_classifications_confidence ON public.document_classifications USING btree (confidence_score);

-- Index: idx_classifications_document

CREATE INDEX idx_classifications_document ON public.document_classifications USING btree (document_id);

-- Index: idx_classifications_material

CREATE INDEX idx_classifications_material ON public.document_classifications USING btree (material_code);

-- Index: idx_classifications_review

CREATE INDEX idx_classifications_review ON public.document_classifications USING btree (requires_human_review, verified_by_user) WHERE ((requires_human_review = true) AND (verified_by_user = false));

-- Index: idx_company_materials_company

CREATE INDEX idx_company_materials_company ON public.company_materials USING btree (company_id);

-- Index: idx_documents_company

CREATE INDEX idx_documents_company ON public.documents USING btree (company_id);

-- Index: idx_documents_material

CREATE INDEX idx_documents_material ON public.documents USING btree (primary_material);

-- Index: idx_documents_review

CREATE INDEX idx_documents_review ON public.documents USING btree (requires_human_review, verified_by_user) WHERE (requires_human_review = true);

-- Index: idx_documents_status

CREATE INDEX idx_documents_status ON public.documents USING btree (status);

-- Index: idx_filing_periods_company

CREATE INDEX idx_filing_periods_company ON public.filing_periods USING btree (company_id);

-- Index: idx_synonyms_lookup

CREATE INDEX idx_synonyms_lookup ON public.material_synonyms USING btree (synonym, manufacturer);

-- Index: idx_synonyms_material

CREATE INDEX idx_synonyms_material ON public.material_synonyms USING btree (material_code);

-- Trigger: document_classifications update_classifications_updated_at

CREATE TRIGGER update_classifications_updated_at BEFORE UPDATE ON public.document_classifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: documents update_documents_updated_at

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fk Constraint: classification_feedback classification_feedback_classification_id_fkey

ALTER TABLE ONLY public.classification_feedback
    ADD CONSTRAINT classification_feedback_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.document_classifications(id) ON DELETE CASCADE;

-- Fk Constraint: classification_feedback classification_feedback_corrected_material_code_fkey

ALTER TABLE ONLY public.classification_feedback
    ADD CONSTRAINT classification_feedback_corrected_material_code_fkey FOREIGN KEY (corrected_material_code) REFERENCES public.materials_master(material_code);

-- Fk Constraint: classification_feedback classification_feedback_user_id_fkey

ALTER TABLE ONLY public.classification_feedback
    ADD CONSTRAINT classification_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.companies(id);

-- Fk Constraint: companies companies_id_fkey

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

-- Fk Constraint: company_materials company_materials_company_id_fkey

ALTER TABLE ONLY public.company_materials
    ADD CONSTRAINT company_materials_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Fk Constraint: company_materials company_materials_material_code_fkey

ALTER TABLE ONLY public.company_materials
    ADD CONSTRAINT company_materials_material_code_fkey FOREIGN KEY (material_code) REFERENCES public.materials_master(material_code);

-- Fk Constraint: document_classifications document_classifications_corrected_material_code_fkey

ALTER TABLE ONLY public.document_classifications
    ADD CONSTRAINT document_classifications_corrected_material_code_fkey FOREIGN KEY (corrected_material_code) REFERENCES public.materials_master(material_code);

-- Fk Constraint: document_classifications document_classifications_document_id_fkey

ALTER TABLE ONLY public.document_classifications
    ADD CONSTRAINT document_classifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

-- Fk Constraint: document_classifications document_classifications_material_code_fkey

ALTER TABLE ONLY public.document_classifications
    ADD CONSTRAINT document_classifications_material_code_fkey FOREIGN KEY (material_code) REFERENCES public.materials_master(material_code);

-- Fk Constraint: documents documents_company_id_fkey

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

-- Fk Constraint: documents documents_primary_material_fkey

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_primary_material_fkey FOREIGN KEY (primary_material) REFERENCES public.materials_master(material_code);

-- Fk Constraint: filing_periods filing_periods_company_id_fkey

ALTER TABLE ONLY public.filing_periods
    ADD CONSTRAINT filing_periods_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

-- Fk Constraint: material_synonyms material_synonyms_material_code_fkey

ALTER TABLE ONLY public.material_synonyms
    ADD CONSTRAINT material_synonyms_material_code_fkey FOREIGN KEY (material_code) REFERENCES public.materials_master(material_code) ON DELETE CASCADE;

-- Policy: material_synonyms Public read access to synonyms

CREATE POLICY "Public read access to synonyms" ON public.material_synonyms FOR SELECT USING (true);

-- Policy: document_classifications Users can view own classifications

CREATE POLICY "Users can view own classifications" ON public.document_classifications USING ((document_id IN ( SELECT documents.id
   FROM public.documents
  WHERE (documents.company_id = auth.uid()))));

-- Policy: documents Users can view own company documents

CREATE POLICY "Users can view own company documents" ON public.documents USING ((company_id = auth.uid()));

-- Policy: company_materials Users can view own company materials

CREATE POLICY "Users can view own company materials" ON public.company_materials USING ((company_id = auth.uid()));

-- Policy: filing_periods Users can view own filing periods

CREATE POLICY "Users can view own filing periods" ON public.filing_periods USING ((company_id = auth.uid()));

-- Row Security: classification_feedback

ALTER TABLE public.classification_feedback ENABLE ROW LEVEL SECURITY;

-- Row Security: company_materials

ALTER TABLE public.company_materials ENABLE ROW LEVEL SECURITY;

-- Row Security: document_classifications

ALTER TABLE public.document_classifications ENABLE ROW LEVEL SECURITY;

-- Row Security: documents

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Row Security: filing_periods

ALTER TABLE public.filing_periods ENABLE ROW LEVEL SECURITY;

-- Row Security: material_synonyms

ALTER TABLE public.material_synonyms ENABLE ROW LEVEL SECURITY;

-- Row Security: materials_master

ALTER TABLE public.materials_master ENABLE ROW LEVEL SECURITY;

-- New sign-ups get a company row keyed by their auth user id.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
