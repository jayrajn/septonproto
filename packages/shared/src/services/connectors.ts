import { enterpriseRecords } from "../data/enterpriseRecords";
import type { EnterpriseSource, IngestionBatch, IngestionPattern, IngestionValidationIssue, RawRecord } from "../domain/types";

export interface ConnectorStatus {
  source: EnterpriseSource;
  connected: boolean;
  recordCount: number;
  syncMode: "batch";
  freshness: string;
  readOnly: true;
  batchId: string;
  batchStatus: IngestionBatch["status"];
  ingestionPattern: IngestionPattern;
  rejectedRecordCount: number;
  updatesProductionContext: boolean;
}

export function syncEnterpriseConnectors(): { records: RawRecord[]; statuses: ConnectorStatus[]; batches: IngestionBatch[] } {
  const sources: Array<{ source: EnterpriseSource; ingestionPattern: IngestionPattern; freshness: string; fileName: string }> = [
    { source: "SAP", ingestionPattern: "export", freshness: "35 minutes", fileName: "sap_inventory_export_2026_w31.csv" },
    { source: "BigQuery", ingestionPattern: "batch_file", freshness: "42 minutes", fileName: "bigquery_sales_batch_2026_w26.jsonl" },
    { source: "Salesforce", ingestionPattern: "export", freshness: "1 hour", fileName: "salesforce_campaign_export_2026_w32.csv" },
    { source: "ServiceNow", ingestionPattern: "batch_file", freshness: "50 minutes", fileName: "servicenow_incidents_2026_w26.jsonl" },
    { source: "SharePoint", ingestionPattern: "s3_landing_zone", freshness: "2 hours", fileName: "sharepoint_meeting_notes_drop_2026_w26.json" },
  ];

  const batches = sources.map((item) => {
    const sourceRecords = enterpriseRecords.filter((record) => record.source === item.source);
    const validationIssues = validateBatchRecords(sourceRecords);
    const status = validationIssues.length > 0 ? "rejected" : "accepted";

    return {
      id: `batch-${item.source.toLowerCase()}-2026-w31`,
      source: item.source,
      pattern: item.ingestionPattern,
      fileName: item.fileName,
      receivedAt: "2026-07-07T09:15:00.000Z",
      readOnly: true,
      attemptedRecordCount: sourceRecords.length,
      acceptedRecordCount: status === "accepted" ? sourceRecords.length : 0,
      rejectedRecordCount: status === "accepted" ? 0 : sourceRecords.length,
      status,
      validationIssues,
      updatesProductionContext: status === "accepted",
    } satisfies IngestionBatch;
  });

  const acceptedSources = new Set(batches.filter((batch) => batch.updatesProductionContext).map((batch) => batch.source));

  const statuses = sources.map((item) => {
    const batch = batches.find((candidate) => candidate.source === item.source)!;

    return {
      source: item.source,
      connected: true,
      recordCount: batch.acceptedRecordCount,
      syncMode: "batch",
      freshness: item.freshness,
      readOnly: true,
      batchId: batch.id,
      batchStatus: batch.status,
      ingestionPattern: item.ingestionPattern,
      rejectedRecordCount: batch.rejectedRecordCount,
      updatesProductionContext: batch.updatesProductionContext,
    } satisfies ConnectorStatus;
  });

  return {
    records: enterpriseRecords.filter((record) => acceptedSources.has(record.source)),
    statuses,
    batches,
  };
}

function validateBatchRecords(records: RawRecord[]): IngestionValidationIssue[] {
  const issues: IngestionValidationIssue[] = [];

  for (const record of records) {
    if (!record.id) {
      issues.push({ recordId: "unknown", field: "id", message: "Record is missing a stable source ID." });
    }

    if (!record.region) {
      issues.push({ recordId: record.id, field: "region", message: "Region is required before context can be updated." });
    }

    if (!record.title) {
      issues.push({ recordId: record.id, field: "title", message: "Title is required for audit and lineage display." });
    }

    if (!record.text) {
      issues.push({ recordId: record.id, field: "text", message: "Text is required for semantic document creation." });
    }
  }

  return issues;
}
