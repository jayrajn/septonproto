import { enterpriseRecords } from "../packages/shared/src/data/enterpriseRecords";
import { writeBatchToPostgres } from "../packages/shared/src/services/batchIngestionRepository";
import { processAcceptedBatchToMemory } from "../packages/shared/src/services/memoryProcessingRepository";

const externalBatchId = "demo-sap-memory-processing-batch";
const records = enterpriseRecords.filter((record) => record.source === "SAP").slice(0, 3);

const writeResult = await writeBatchToPostgres({
  externalBatchId,
  source: "SAP",
  pattern: "export",
  fileName: "demo_sap_memory_processing_batch.csv",
  receivedAt: "2026-07-08T10:00:00.000Z",
  records,
});

const processResult = await processAcceptedBatchToMemory(externalBatchId);

console.log("Batch memory processing check");
console.log(
  `${writeResult.batch.id}: ${writeResult.batch.status}, raw_records=${writeResult.batch.acceptedRecordCount}, updates_context=${writeResult.batch.updatesProductionContext}`,
);
console.log(
  `processed=${processResult.processed}, entities=${processResult.entityCount}, relationships=${processResult.relationshipCount}, documents=${processResult.documentCount}`,
);

const rejectedExternalBatchId = "demo-rejected-memory-processing-batch";
await writeBatchToPostgres({
  externalBatchId: rejectedExternalBatchId,
  source: "SAP",
  pattern: "export",
  fileName: "demo_rejected_memory_processing_batch.csv",
  receivedAt: "2026-07-08T10:05:00.000Z",
  records: [{ ...records[0], id: "sap-memory-processing-invalid", region: "" }],
});

const rejectedProcessResult = await processAcceptedBatchToMemory(rejectedExternalBatchId);
console.log(
  `${rejectedProcessResult.externalBatchId}: processed=${rejectedProcessResult.processed}, reason=${rejectedProcessResult.reason}`,
);
