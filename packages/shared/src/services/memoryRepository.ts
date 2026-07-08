import pg from "pg";
import type {
  AccessTag,
  ContextType,
  EnterpriseSource,
  GraphEdge,
  GraphNode,
  IngestionBatch,
  IngestionPattern,
  KnowledgeBase,
  RawRecord,
  UserRole,
  VectorDocument,
} from "../domain/types";

const { Client } = pg;

export interface MemoryRepositoryOptions {
  connectionString?: string;
  database?: string;
}

export interface CuratedMemoryLoadResult {
  knowledgeBase: KnowledgeBase;
  ingestionBatches: IngestionBatch[];
}

export async function loadCuratedEnterpriseMemory(
  options: MemoryRepositoryOptions = {},
): Promise<CuratedMemoryLoadResult> {
  const client = new Client({
    connectionString: options.connectionString,
    database: options.connectionString ? undefined : options.database ?? "septon_memory",
  });

  await client.connect();

  try {
    const batchResult = await client.query<IngestionBatchRow>(`
        SELECT
          external_batch_id,
          source,
          pattern,
          file_name,
          received_at,
          read_only,
          attempted_record_count,
          accepted_record_count,
          rejected_record_count,
          status,
          validation_issues,
          updates_production_context
        FROM ingestion_batches
        ORDER BY received_at, source
      `);
    const recordResult = await client.query<RawRecordRow>(`
        SELECT
          id,
          source_record_id,
          source,
          type,
          title,
          region,
          market,
          city,
          week,
          business_unit,
          access_tags,
          required_roles,
          payload,
          body_text
        FROM raw_records
        ORDER BY source, source_record_id
      `);
    const entityResult = await client.query<MemoryEntityRow>(`
        SELECT stable_key, label, type, properties
        FROM memory_entities
        ORDER BY stable_key
      `);
    const relationshipResult = await client.query<MemoryRelationshipRow>(`
        SELECT
          from_entity.stable_key AS from_stable_key,
          to_entity.stable_key AS to_stable_key,
          relationship.relationship_type,
          relationship.weight
        FROM memory_relationships relationship
        JOIN memory_entities from_entity ON from_entity.id = relationship.from_entity_id
        JOIN memory_entities to_entity ON to_entity.id = relationship.to_entity_id
        ORDER BY from_entity.stable_key, to_entity.stable_key, relationship.relationship_type
      `);
    const documentResult = await client.query<MemoryDocumentRow>(`
        SELECT
          raw_records.source_record_id,
          memory_documents.source,
          memory_documents.context_type,
          memory_documents.title,
          memory_documents.body_text,
          memory_documents.tokens,
          memory_documents.metadata
        FROM memory_documents
        JOIN raw_records ON raw_records.id = memory_documents.source_record_id
        ORDER BY raw_records.source_record_id
      `);

    return {
      ingestionBatches: batchResult.rows.map(mapIngestionBatch),
      knowledgeBase: {
        records: recordResult.rows.map(mapRawRecord),
        nodes: entityResult.rows.map(mapGraphNode),
        edges: relationshipResult.rows.map(mapGraphEdge),
        documents: documentResult.rows.map(mapVectorDocument),
      },
    };
  } finally {
    await client.end();
  }
}

type JsonObject = Record<string, string | number | boolean | string[]>;

interface IngestionBatchRow {
  external_batch_id: string;
  source: EnterpriseSource;
  pattern: IngestionPattern;
  file_name: string;
  received_at: Date;
  read_only: boolean;
  attempted_record_count: number;
  accepted_record_count: number;
  rejected_record_count: number;
  status: IngestionBatch["status"];
  validation_issues: IngestionBatch["validationIssues"];
  updates_production_context: boolean;
}

interface RawRecordRow {
  source_record_id: string;
  source: EnterpriseSource;
  type: ContextType;
  title: string;
  region: string;
  market: string | null;
  city: string | null;
  week: string | null;
  business_unit: string | null;
  access_tags: AccessTag[];
  required_roles: UserRole[];
  payload: JsonObject;
  body_text: string;
}

interface MemoryEntityRow {
  stable_key: string;
  label: string;
  type: GraphNode["type"];
  properties: GraphNode["properties"];
}

interface MemoryRelationshipRow {
  from_stable_key: string;
  to_stable_key: string;
  relationship_type: string;
  weight: string;
}

interface MemoryDocumentRow {
  source_record_id: string;
  source: EnterpriseSource;
  context_type: ContextType;
  title: string;
  body_text: string;
  tokens: string[];
  metadata: { vectorDocumentId?: string };
}

function mapIngestionBatch(row: IngestionBatchRow): IngestionBatch {
  return {
    id: row.external_batch_id,
    source: row.source,
    pattern: row.pattern,
    fileName: row.file_name,
    receivedAt: row.received_at.toISOString(),
    readOnly: true,
    attemptedRecordCount: row.attempted_record_count,
    acceptedRecordCount: row.accepted_record_count,
    rejectedRecordCount: row.rejected_record_count,
    status: row.status,
    validationIssues: row.validation_issues,
    updatesProductionContext: row.updates_production_context,
  };
}

function mapRawRecord(row: RawRecordRow): RawRecord {
  return {
    id: row.source_record_id,
    source: row.source,
    type: row.type,
    title: row.title,
    region: row.region,
    market: row.market ?? undefined,
    city: row.city ?? undefined,
    week: row.week ?? undefined,
    businessUnit: row.business_unit ?? undefined,
    accessTags: row.access_tags.length > 0 ? row.access_tags : undefined,
    requiredRoles: row.required_roles.length > 0 ? row.required_roles : undefined,
    payload: row.payload,
    text: row.body_text,
  };
}

function mapGraphNode(row: MemoryEntityRow): GraphNode {
  return {
    id: row.stable_key,
    label: row.label,
    type: row.type,
    properties: row.properties,
  };
}

function mapGraphEdge(row: MemoryRelationshipRow): GraphEdge {
  return {
    from: row.from_stable_key,
    to: row.to_stable_key,
    label: row.relationship_type,
    weight: Number(row.weight),
  };
}

function mapVectorDocument(row: MemoryDocumentRow): VectorDocument {
  return {
    id: row.metadata.vectorDocumentId ?? `doc:${row.source_record_id}`,
    sourceRecordId: row.source_record_id,
    source: row.source,
    contextType: row.context_type,
    title: row.title,
    text: row.body_text,
    tokens: row.tokens,
  };
}
