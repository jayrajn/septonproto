# Septon Context Prototype

A working prototype of the Septon decision intelligence flow for a COO asking why U.S. sales declined and how to prevent recurrence before an August promotion.

## What It Demonstrates

- Batch-first, read-only enterprise connector simulation for SAP, BigQuery, Salesforce, ServiceNow, and SharePoint
- Postgres-backed curated enterprise memory for accepted raw records, extracted entities, relationships, and semantic documents
- Batch validation gates where rejected batches are recorded but do not update production context
- Capability routing for Root Cause Analysis
- Capability-configured confidence rules
- Knowledge processing with explicit entity, fact, event, relationship, and lineage extraction
- Context Engine with semantic ranking, graph paths, and live data access
- Decision Engine with recommendations, guardrails, and confidence
- Decision Evidence Package
- Context Retrieval Learning and Pattern Learning outputs

## Tech Stack

- Vite
- React
- TypeScript
- lucide-react
- pnpm
- Postgres
- pg / node-postgres

The browser UI still runs safely from local TypeScript data, while the MVP memory path can be created, seeded, and tested in Postgres through the database scripts.

## Run Locally

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Build

```bash
pnpm build
```

## Postgres Memory Setup

Install and start Postgres. On macOS with Homebrew:

```bash
brew install postgresql@14
brew services start postgresql@14
psql postgres -c "SELECT 1;"
```

Create the Septon memory database and schema:

```bash
psql postgres -f db/postgres/000_create_database.sql
psql septon_memory -f db/postgres/001_curated_enterprise_memory_schema.sql
```

Seed the database with the current prototype data:

```bash
pnpm db:seed:memory
```

Check the curated memory summary:

```bash
psql septon_memory -c "SELECT * FROM curated_enterprise_memory_summary;"
```

## Database Checks

Prove accepted and rejected batch behavior:

```bash
pnpm db:check:batch-write
```

Prove accepted batches are processed into curated memory:

```bash
pnpm db:check:batch-memory
```

Prove the Context Engine can use Postgres-backed curated memory:

```bash
pnpm db:check:runtime
```

Useful entity extraction check:

```bash
psql septon_memory -c "SELECT label, type, properties->>'sourceField' AS source_field, properties->>'canonicalType' AS canonical_type FROM memory_entities WHERE label IN ('Omega Foods', 'Joliet DC', 'Egg patties', 'Breakfast Value Push', 'August Family Value') ORDER BY label, type;"
```

`pgvector` is optional for the current MVP checks. If the local Postgres server has the extension installed, enable the vector column and index with:

```bash
psql septon_memory -f db/postgres/002_pgvector_memory_search.sql
```

## Main Files

- `apps/web/src/ui/App.tsx` - COO-facing UI and architecture panels
- `packages/shared/src/data/enterpriseRecords.ts` - mock enterprise records
- `packages/shared/src/services/connectors.ts` - batch-first connector simulation
- `packages/shared/src/services/batchIngestionRepository.ts` - Postgres batch write and validation gate
- `packages/shared/src/services/knowledgeProcessing.ts` - rule-based extraction of entities, facts, events, relationships, and documents
- `packages/shared/src/services/memoryProcessingRepository.ts` - accepted-batch processing into Postgres memory tables
- `packages/shared/src/services/memoryRepository.ts` - loads Postgres curated memory back into the existing `KnowledgeBase` shape
- `packages/shared/src/services/septonRuntime.ts` - in-memory browser-safe runtime orchestrator
- `packages/shared/src/services/septonRuntimePostgres.ts` - server-side Postgres-backed runtime with in-memory fallback
- `db/postgres/` - database creation, schema, optional pgvector setup, and database-specific README
- `scripts/` - seed and verification scripts for the MVP memory flow
