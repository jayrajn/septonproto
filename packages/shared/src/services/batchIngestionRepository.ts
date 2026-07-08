import pg from "pg";
import type {
  EnterpriseSource,
  IngestionBatch,
  IngestionPattern,
  IngestionValidationIssue,
  RawRecord,
} from "../domain/types";

const { Client } = pg;

export interface BatchIngestionRepositoryOptions {
  connectionString?: string;
  database?: string;
}

export interface WriteBatchInput {
  externalBatchId: string;
  source: EnterpriseSource;
  pattern: IngestionPattern;
  fileName: string;
  receivedAt?: string;
  records: RawRecord[];
}

export interface WriteBatchResult {
  batch: IngestionBatch;
  productionContextUpdated: boolean;
}

export async function writeBatchToPostgres(
  input: WriteBatchInput,
  options: BatchIngestionRepositoryOptions = {},
): Promise<WriteBatchResult> {
  const validationIssues = validateBatchRecords(input);
  const status = validationIssues.length > 0 ? "rejected" : "accepted";
  const batch: IngestionBatch = {
    id: input.externalBatchId,
    source: input.source,
    pattern: input.pattern,
    fileName: input.fileName,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    readOnly: true,
    attemptedRecordCount: input.records.length,
    acceptedRecordCount: status === "accepted" ? input.records.length : 0,
    rejectedRecordCount: status === "accepted" ? 0 : input.records.length,
    status,
    validationIssues,
    updatesProductionContext: status === "accepted",
  };

  const client = new Client({
    connectionString: options.connectionString,
    database: options.connectionString ? undefined : options.database ?? "septon_memory",
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    const batchResult = await client.query<{ id: string }>(
      `
        INSERT INTO ingestion_batches (
          external_batch_id,
          source,
          pattern,
          file_name,
          received_at,
          attempted_record_count,
          accepted_record_count,
          rejected_record_count,
          status,
          validation_issues,
          updates_production_context
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
        ON CONFLICT (external_batch_id) DO UPDATE SET
          source = EXCLUDED.source,
          pattern = EXCLUDED.pattern,
          file_name = EXCLUDED.file_name,
          received_at = EXCLUDED.received_at,
          attempted_record_count = EXCLUDED.attempted_record_count,
          accepted_record_count = EXCLUDED.accepted_record_count,
          rejected_record_count = EXCLUDED.rejected_record_count,
          status = EXCLUDED.status,
          validation_issues = EXCLUDED.validation_issues,
          updates_production_context = EXCLUDED.updates_production_context
        RETURNING id
      `,
      [
        batch.id,
        batch.source,
        batch.pattern,
        batch.fileName,
        batch.receivedAt,
        batch.attemptedRecordCount,
        batch.acceptedRecordCount,
        batch.rejectedRecordCount,
        batch.status,
        JSON.stringify(batch.validationIssues),
        batch.updatesProductionContext,
      ],
    );

    const databaseBatchId = batchResult.rows[0].id;

    if (batch.status === "rejected") {
      await client.query("DELETE FROM raw_records WHERE batch_id = $1", [databaseBatchId]);
      await client.query("COMMIT");
      return {
        batch,
        productionContextUpdated: false,
      };
    }

    for (const record of input.records) {
      await client.query(
        `
          INSERT INTO raw_records (
            source_record_id,
            batch_id,
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
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
          ON CONFLICT (source, source_record_id) DO UPDATE SET
            batch_id = EXCLUDED.batch_id,
            type = EXCLUDED.type,
            title = EXCLUDED.title,
            region = EXCLUDED.region,
            market = EXCLUDED.market,
            city = EXCLUDED.city,
            week = EXCLUDED.week,
            business_unit = EXCLUDED.business_unit,
            access_tags = EXCLUDED.access_tags,
            required_roles = EXCLUDED.required_roles,
            payload = EXCLUDED.payload,
            body_text = EXCLUDED.body_text,
            accepted_at = now()
        `,
        [
          record.id,
          databaseBatchId,
          record.source,
          record.type,
          record.title,
          record.region,
          record.market ?? null,
          record.city ?? null,
          record.week ?? null,
          record.businessUnit ?? null,
          record.accessTags ?? [],
          record.requiredRoles ?? [],
          JSON.stringify(record.payload),
          record.text,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  return {
    batch,
    productionContextUpdated: true,
  };
}

function validateBatchRecords(input: WriteBatchInput): IngestionValidationIssue[] {
  const issues: IngestionValidationIssue[] = [];

  if (input.records.length === 0) {
    issues.push({
      recordId: input.externalBatchId,
      field: "payload",
      message: "Batch must contain at least one record.",
    });
  }

  for (const record of input.records) {
    if (record.source !== input.source) {
      issues.push({
        recordId: record.id || "unknown",
        field: "source",
        message: `Record source ${record.source} does not match batch source ${input.source}.`,
      });
    }

    if (!record.id) {
      issues.push({
        recordId: "unknown",
        field: "id",
        message: "Record is missing a stable source ID.",
      });
    }

    if (!record.region) {
      issues.push({
        recordId: record.id || "unknown",
        field: "region",
        message: "Region is required before context can be updated.",
      });
    }

    if (!record.title) {
      issues.push({
        recordId: record.id || "unknown",
        field: "title",
        message: "Title is required for audit and lineage display.",
      });
    }

    if (!record.text) {
      issues.push({
        recordId: record.id || "unknown",
        field: "text",
        message: "Text is required for semantic document creation.",
      });
    }
  }

  return issues;
}
