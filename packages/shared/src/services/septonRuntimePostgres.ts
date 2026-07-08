import type { CapabilityId, IngestionBatch, KnowledgeBase, LearningState, SeptonRun } from "../domain/types";
import { assembleContext } from "./contextEngine";
import { syncEnterpriseConnectors } from "./connectors";
import { runDecisionWorkflow } from "./decisionEngine";
import { createEvidencePackage } from "./evidenceStore";
import { routeDecisionIntent } from "./intentRouter";
import { buildMemorySnapshot } from "./learningServices";
import { loadCuratedEnterpriseMemory, type MemoryRepositoryOptions } from "./memoryRepository";
import { runSepton } from "./septonRuntime";

export async function runSeptonWithPostgresMemory(
  question: string,
  selectedCapabilityId?: CapabilityId,
  learningState?: LearningState,
  options?: MemoryRepositoryOptions,
): Promise<SeptonRun> {
  try {
    const { knowledgeBase, ingestionBatches } = await loadCuratedEnterpriseMemory(options);
    if (knowledgeBase.records.length === 0) {
      return runSepton(question, selectedCapabilityId, learningState);
    }

    return createPostgresMemoryRun(question, knowledgeBase, ingestionBatches, selectedCapabilityId, learningState);
  } catch {
    return runSepton(question, selectedCapabilityId, learningState);
  }
}

function createPostgresMemoryRun(
  question: string,
  knowledgeBase: KnowledgeBase,
  ingestionBatches: IngestionBatch[],
  selectedCapabilityId?: CapabilityId,
  learningState?: LearningState,
): SeptonRun {
  const intent = routeDecisionIntent(question, selectedCapabilityId);
  const contextBundle = assembleContext(intent, knowledgeBase, learningState);
  const recommendation = runDecisionWorkflow(contextBundle);
  const evidence = createEvidencePackage(contextBundle, recommendation);

  return {
    connectorStatuses: buildConnectorStatuses(ingestionBatches),
    ingestionBatches,
    knowledgeBase,
    intent,
    contextBundle,
    recommendation,
    evidence,
    learningSignals: [],
    patternArtifacts: contextBundle.appliedDecisionPatterns,
    retrievalHints: contextBundle.appliedRetrievalHints,
    memorySnapshot: buildMemorySnapshot(knowledgeBase, learningState ?? { byCapability: {} }),
  };
}

function buildConnectorStatuses(ingestionBatches: IngestionBatch[]): SeptonRun["connectorStatuses"] {
  return ingestionBatches.map((batch) => ({
    source: batch.source,
    connected: true,
    recordCount: batch.acceptedRecordCount,
    syncMode: "batch",
    freshness: "database-backed",
    readOnly: true,
    batchId: batch.id,
    batchStatus: batch.status,
    ingestionPattern: batch.pattern,
    rejectedRecordCount: batch.rejectedRecordCount,
    updatesProductionContext: batch.updatesProductionContext,
  }));
}

export function runSeptonWithInMemoryFallback(
  question: string,
  selectedCapabilityId?: CapabilityId,
  learningState?: LearningState,
): SeptonRun {
  const { records } = syncEnterpriseConnectors();
  return runSepton(question, selectedCapabilityId, learningState);
}
