import type { RawRecord } from "../packages/shared/src/domain/types";
import { enterpriseRecords } from "../packages/shared/src/data/enterpriseRecords";
import { writeBatchToPostgres } from "../packages/shared/src/services/batchIngestionRepository";

const acceptedRecords = enterpriseRecords.filter((record) => record.source === "SAP").slice(0, 2);
const invalidRecord: RawRecord = {
  ...acceptedRecords[0],
  id: "sap-invalid-missing-region-demo",
  title: "Invalid SAP batch row missing region",
  region: "",
  text: "This invalid row is missing the required region and should not update production context.",
};

const acceptedBatch = await writeBatchToPostgres({
  externalBatchId: "demo-sap-accepted-batch",
  source: "SAP",
  pattern: "export",
  fileName: "demo_sap_accepted_batch.csv",
  receivedAt: "2026-07-08T09:00:00.000Z",
  records: acceptedRecords,
});

const rejectedBatch = await writeBatchToPostgres({
  externalBatchId: "demo-sap-rejected-batch",
  source: "SAP",
  pattern: "export",
  fileName: "demo_sap_rejected_batch.csv",
  receivedAt: "2026-07-08T09:05:00.000Z",
  records: [invalidRecord],
});

console.log("Batch ingestion write check");
console.log(
  `${acceptedBatch.batch.id}: ${acceptedBatch.batch.status}, accepted=${acceptedBatch.batch.acceptedRecordCount}, updates_context=${acceptedBatch.batch.updatesProductionContext}`,
);
console.log(
  `${rejectedBatch.batch.id}: ${rejectedBatch.batch.status}, rejected=${rejectedBatch.batch.rejectedRecordCount}, updates_context=${rejectedBatch.batch.updatesProductionContext}`,
);
console.log(`Rejected issues: ${rejectedBatch.batch.validationIssues.map((issue) => issue.message).join("; ")}`);
