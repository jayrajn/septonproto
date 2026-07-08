# Curated Enterprise Memory Postgres Schema

This folder contains the MVP Postgres database shape for Septon's curated enterprise memory.

## What This Covers

- Batch-first, read-only ingestion metadata
- Accepted raw enterprise records
- Knowledge Graph v1 using Postgres tables
- Semantic memory documents with `pgvector`
- Configuration-driven retrieval settings
- Candidate and approved decision patterns
- Decision evidence packages

## Run Locally

Create the database:

```bash
psql postgres -f db/postgres/000_create_database.sql
```

Create the schema:

```bash
psql septon_memory -f db/postgres/001_curated_enterprise_memory_schema.sql
```

Enable pgvector search when the Postgres server has the `pgvector` extension available:

```bash
psql septon_memory -f db/postgres/002_pgvector_memory_search.sql
```

Check the memory summary:

```bash
psql septon_memory -c "select * from curated_enterprise_memory_summary;"
```

Seed the database with the current prototype data:

```bash
pnpm db:seed:memory
```

Then re-check the memory summary to see raw records, entities, relationships, documents, and candidate patterns.

## MVP Mapping

- `ingestion_batches`: batch files, exports, and S3/file landing-zone drops.
- `raw_records`: validated records from accepted batches only.
- `memory_entities`: Knowledge Graph nodes.
- `memory_relationships`: Knowledge Graph edges using Postgres relationship tables.
- `memory_documents`: searchable semantic memory, including optional `pgvector` embeddings.
- `retrieval_configs`: manual capability retrieval workflows.
- `context_retrieval_hints`: learning suggestions that do not automatically change production retrieval behavior.
- `decision_patterns`: candidate or approved learned patterns.
- `decision_evidence_packages`: stored decision audit/evidence packages.

Rejected batches must keep `updates_production_context = false`, which prevents invalid batches from becoming production context.

## Local pgvector Note

The core schema can run without `pgvector`, but MVP vector search requires running
`002_pgvector_memory_search.sql` on a Postgres server where the extension is installed for that server version.
