CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE enterprise_source AS ENUM (
  'SAP',
  'BigQuery',
  'Salesforce',
  'ServiceNow',
  'SharePoint'
);

CREATE TYPE context_type AS ENUM (
  'sales_kpi',
  'inventory',
  'supplier_incident',
  'campaign',
  'service_incident',
  'meeting_note',
  'promotion_calendar',
  'weather'
);

CREATE TYPE ingestion_pattern AS ENUM (
  'batch_file',
  'export',
  's3_landing_zone'
);

CREATE TYPE ingestion_batch_status AS ENUM (
  'accepted',
  'rejected'
);

CREATE TYPE memory_entity_type AS ENUM (
  'region',
  'city',
  'daypart',
  'supplier',
  'campaign',
  'incident',
  'kpi',
  'capability',
  'distribution_center',
  'product',
  'business_unit'
);

CREATE TYPE review_status AS ENUM (
  'candidate',
  'approved',
  'rejected'
);

CREATE TABLE ingestion_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_batch_id text UNIQUE NOT NULL,
  source enterprise_source NOT NULL,
  pattern ingestion_pattern NOT NULL,
  file_name text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_only boolean NOT NULL DEFAULT true,
  attempted_record_count integer NOT NULL DEFAULT 0 CHECK (attempted_record_count >= 0),
  accepted_record_count integer NOT NULL DEFAULT 0 CHECK (accepted_record_count >= 0),
  rejected_record_count integer NOT NULL DEFAULT 0 CHECK (rejected_record_count >= 0),
  status ingestion_batch_status NOT NULL,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  updates_production_context boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_batches_read_only CHECK (read_only = true),
  CONSTRAINT rejected_batches_do_not_update_context CHECK (
    status = 'accepted' OR updates_production_context = false
  )
);

CREATE TABLE raw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id text NOT NULL,
  batch_id uuid NOT NULL REFERENCES ingestion_batches(id) ON DELETE RESTRICT,
  source enterprise_source NOT NULL,
  type context_type NOT NULL,
  title text NOT NULL,
  region text NOT NULL,
  market text,
  city text,
  week text,
  business_unit text,
  access_tags text[] NOT NULL DEFAULT '{}',
  required_roles text[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_text text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_record_id)
);

CREATE INDEX raw_records_batch_id_idx ON raw_records(batch_id);
CREATE INDEX raw_records_source_type_idx ON raw_records(source, type);
CREATE INDEX raw_records_region_week_idx ON raw_records(region, week);
CREATE INDEX raw_records_payload_gin_idx ON raw_records USING gin(payload);
CREATE INDEX raw_records_access_tags_gin_idx ON raw_records USING gin(access_tags);

CREATE TABLE memory_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_key text UNIQUE NOT NULL,
  label text NOT NULL,
  type memory_entity_type NOT NULL,
  source_record_id uuid REFERENCES raw_records(id) ON DELETE SET NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_entities_type_idx ON memory_entities(type);
CREATE INDEX memory_entities_properties_gin_idx ON memory_entities USING gin(properties);

CREATE TABLE memory_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  weight numeric(5,4) NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 1),
  source_record_id uuid REFERENCES raw_records(id) ON DELETE SET NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_entity_id, to_entity_id, relationship_type, source_record_id)
);

CREATE INDEX memory_relationships_from_idx ON memory_relationships(from_entity_id);
CREATE INDEX memory_relationships_to_idx ON memory_relationships(to_entity_id);
CREATE INDEX memory_relationships_type_idx ON memory_relationships(relationship_type);

CREATE TABLE memory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL REFERENCES raw_records(id) ON DELETE CASCADE,
  source enterprise_source NOT NULL,
  context_type context_type NOT NULL,
  title text NOT NULL,
  body_text text NOT NULL,
  tokens text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_record_id)
);

CREATE INDEX memory_documents_source_context_idx ON memory_documents(source, context_type);
CREATE INDEX memory_documents_tokens_gin_idx ON memory_documents USING gin(tokens);

CREATE TABLE retrieval_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  required_context_types context_type[] NOT NULL DEFAULT '{}',
  preferred_sources enterprise_source[] NOT NULL DEFAULT '{}',
  retrieval_workflow jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, version)
);

CREATE UNIQUE INDEX retrieval_configs_one_active_per_capability_idx
  ON retrieval_configs(capability_id)
  WHERE active = true;

CREATE TABLE context_retrieval_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id text NOT NULL,
  prioritized_context_types context_type[] NOT NULL DEFAULT '{}',
  boosted_entities text[] NOT NULL DEFAULT '{}',
  deprioritized_context_types context_type[] NOT NULL DEFAULT '{}',
  supporting_evidence_ids text[] NOT NULL DEFAULT '{}',
  explanation text NOT NULL,
  future_use text NOT NULL,
  review_status review_status NOT NULL DEFAULT 'candidate',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz
);

CREATE TABLE decision_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id text NOT NULL,
  title text NOT NULL,
  trigger_conditions text[] NOT NULL DEFAULT '{}',
  supporting_evidence_ids text[] NOT NULL DEFAULT '{}',
  recommended_reuse text NOT NULL,
  review_status review_status NOT NULL DEFAULT 'candidate',
  write_back_target text NOT NULL DEFAULT 'curated_enterprise_memory',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz
);

CREATE TABLE decision_evidence_packages (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  question text NOT NULL,
  capability_id text NOT NULL,
  context_used text[] NOT NULL DEFAULT '{}',
  context_ignored context_type[] NOT NULL DEFAULT '{}',
  reasoning_trace text[] NOT NULL DEFAULT '{}',
  confidence_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  outcome text NOT NULL DEFAULT 'pending_feedback',
  approval_status text NOT NULL DEFAULT 'awaiting_admin_approval',
  storage_status text NOT NULL DEFAULT 'not_stored',
  created_by text,
  reviewed_by text,
  reviewed_at timestamptz
);

CREATE VIEW curated_enterprise_memory_summary AS
SELECT
  (SELECT count(*) FROM raw_records) AS raw_record_count,
  (SELECT count(*) FROM memory_entities) AS entity_count,
  (SELECT count(*) FROM memory_relationships) AS relationship_count,
  (SELECT count(*) FROM memory_documents) AS document_count,
  (SELECT count(*) FROM decision_patterns WHERE review_status = 'approved') AS approved_pattern_count,
  (SELECT count(*) FROM decision_patterns WHERE review_status = 'candidate') AS candidate_pattern_count;
