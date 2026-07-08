import pg from "pg";
import type { RawRecord } from "../domain/types";
import { buildKnowledgeBase } from "./knowledgeProcessing";

const { Client } = pg;

export interface MemoryProcessingRepositoryOptions {
  connectionString?: string;
  database?: string;
}

export interface ProcessAcceptedBatchResult {
  externalBatchId: string;
  rawRecordCount: number;
  entityCount: number;
  relationshipCount: number;
  documentCount: number;
  processed: boolean;
  reason?: string;
}

export async function processAcceptedBatchToMemory(
  externalBatchId: string,
  options: MemoryProcessingRepositoryOptions = {},
): Promise<ProcessAcceptedBatchResult> {
  const client = new Client({
    connectionString: options.connectionString,
    database: options.connectionString ? undefined : options.database ?? "septon_memory",
  });

  await client.connect();

  try {
    const batchResult = await client.query<BatchRow>(
      `
        SELECT id, external_batch_id, status, updates_production_context
        FROM ingestion_batches
        WHERE external_batch_id = $1
      `,
      [externalBatchId],
    );

    const batch = batchResult.rows[0];
    if (!batch) {
      return emptyResult(externalBatchId, "Batch was not found.");
    }

    if (batch.status !== "accepted" || !batch.updates_production_context) {
      return emptyResult(externalBatchId, "Batch is not accepted for production context.");
    }

    const rawRecords = await loadRawRecordsForBatch(client, batch.id);
    if (rawRecords.length === 0) {
      return emptyResult(externalBatchId, "Batch has no accepted raw records.");
    }

    const knowledgeBase = buildKnowledgeBase(rawRecords.map((item) => item.record));
    const rawRecordIds = new Map(rawRecords.map((item) => [item.record.id, item.databaseId]));
    const entityIds = new Map<string, string>();

    await client.query("BEGIN");

    for (const node of knowledgeBase.nodes) {
      const sourceRecordId = sourceRecordIdFromNodeId(node.id);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO memory_entities (
            stable_key,
            label,
            type,
            source_record_id,
            properties,
            last_seen_at
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, now())
          ON CONFLICT (stable_key) DO UPDATE SET
            label = EXCLUDED.label,
            type = EXCLUDED.type,
            source_record_id = COALESCE(EXCLUDED.source_record_id, memory_entities.source_record_id),
            properties = EXCLUDED.properties,
            last_seen_at = now()
          RETURNING id
        `,
        [
          node.id,
          node.label,
          node.type,
          sourceRecordId ? rawRecordIds.get(sourceRecordId) ?? null : null,
          JSON.stringify(node.properties),
        ],
      );

      entityIds.set(node.id, result.rows[0].id);
    }

    for (const edge of knowledgeBase.edges) {
      const fromEntityId = entityIds.get(edge.from);
      const toEntityId = entityIds.get(edge.to);
      if (!fromEntityId || !toEntityId) continue;

      const sourceRecordId = sourceRecordIdFromNodeId(edge.from) ?? sourceRecordIdFromNodeId(edge.to);

      await client.query(
        `
          INSERT INTO memory_relationships (
            from_entity_id,
            to_entity_id,
            relationship_type,
            weight,
            source_record_id,
            properties
          )
          VALUES ($1, $2, $3, $4, $5, '{}'::jsonb)
          ON CONFLICT (from_entity_id, to_entity_id, relationship_type, source_record_id) DO UPDATE SET
            weight = EXCLUDED.weight,
            properties = EXCLUDED.properties
        `,
        [fromEntityId, toEntityId, edge.label, edge.weight, sourceRecordId ? rawRecordIds.get(sourceRecordId) ?? null : null],
      );
    }

    for (const document of knowledgeBase.documents) {
      const rawRecordId = rawRecordIds.get(document.sourceRecordId);
      if (!rawRecordId) continue;

      await client.query(
        `
          INSERT INTO memory_documents (
            source_record_id,
            source,
            context_type,
            title,
            body_text,
            tokens,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT (source_record_id) DO UPDATE SET
            source = EXCLUDED.source,
            context_type = EXCLUDED.context_type,
            title = EXCLUDED.title,
            body_text = EXCLUDED.body_text,
            tokens = EXCLUDED.tokens,
            metadata = EXCLUDED.metadata
        `,
        [
          rawRecordId,
          document.source,
          document.contextType,
          document.title,
          document.text,
          document.tokens,
          JSON.stringify({ vectorDocumentId: document.id }),
        ],
      );
    }

    await client.query("COMMIT");

    return {
      externalBatchId,
      rawRecordCount: rawRecords.length,
      entityCount: knowledgeBase.nodes.length,
      relationshipCount: knowledgeBase.edges.length,
      documentCount: knowledgeBase.documents.length,
      processed: true,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

interface BatchRow {
  id: string;
  external_batch_id: string;
  status: "accepted" | "rejected";
  updates_production_context: boolean;
}

interface RawRecordRow {
  database_id: string;
  source_record_id: string;
  source: RawRecord["source"];
  type: RawRecord["type"];
  title: string;
  region: string;
  market: string | null;
  city: string | null;
  week: string | null;
  business_unit: string | null;
  access_tags: NonNullable<RawRecord["accessTags"]>;
  required_roles: NonNullable<RawRecord["requiredRoles"]>;
  payload: RawRecord["payload"];
  body_text: string;
}

async function loadRawRecordsForBatch(
  client: pg.Client,
  batchId: string,
): Promise<Array<{ databaseId: string; record: RawRecord }>> {
  const result = await client.query<RawRecordRow>(
    `
      SELECT
        id AS database_id,
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
      WHERE batch_id = $1
      ORDER BY source_record_id
    `,
    [batchId],
  );

  return result.rows.map((row) => ({
    databaseId: row.database_id,
    record: {
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
    },
  }));
}

function emptyResult(externalBatchId: string, reason: string): ProcessAcceptedBatchResult {
  return {
    externalBatchId,
    rawRecordCount: 0,
    entityCount: 0,
    relationshipCount: 0,
    documentCount: 0,
    processed: false,
    reason,
  };
}

function sourceRecordIdFromNodeId(nodeId: string): string | null {
  const recordPrefixes = [
    "sales_kpi:",
    "inventory:",
    "supplier_incident:",
    "campaign:",
    "service_incident:",
    "meeting_note:",
    "promotion_calendar:",
    "weather:",
  ];
  const prefix = recordPrefixes.find((candidate) => nodeId.startsWith(candidate));
  return prefix ? nodeId.slice(prefix.length) : null;
}
