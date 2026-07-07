import type { CapabilityId, LearningState, SeptonRun } from "../domain/types";
import { syncEnterpriseConnectors } from "./connectors";
import { assembleContext } from "./contextEngine";
import { runDecisionWorkflow } from "./decisionEngine";
import { createEvidencePackage } from "./evidenceStore";
import { routeDecisionIntent } from "./intentRouter";
import { buildKnowledgeBase } from "./knowledgeProcessing";
import { buildMemorySnapshot } from "./learningServices";

export function runSepton(question: string, selectedCapabilityId?: CapabilityId, learningState?: LearningState): SeptonRun {
  const { records, statuses } = syncEnterpriseConnectors();
  const knowledgeBase = buildKnowledgeBase(records);
  const intent = routeDecisionIntent(question, selectedCapabilityId);
  const contextBundle = assembleContext(intent, knowledgeBase, learningState);
  const recommendation = runDecisionWorkflow(contextBundle);
  const evidence = createEvidencePackage(contextBundle, recommendation);

  return {
    connectorStatuses: statuses,
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
