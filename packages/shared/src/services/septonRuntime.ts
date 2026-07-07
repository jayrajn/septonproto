import type { CapabilityId, SeptonRun } from "../domain/types";
import { syncEnterpriseConnectors } from "./connectors";
import { assembleContext } from "./contextEngine";
import { runDecisionWorkflow } from "./decisionEngine";
import { createEvidencePackage } from "./evidenceStore";
import { routeDecisionIntent } from "./intentRouter";
import { buildKnowledgeBase } from "./knowledgeProcessing";

export function runSepton(question: string, selectedCapabilityId?: CapabilityId): SeptonRun {
  const { records, statuses } = syncEnterpriseConnectors();
  const knowledgeBase = buildKnowledgeBase(records);
  const intent = routeDecisionIntent(question, selectedCapabilityId);
  const contextBundle = assembleContext(intent, knowledgeBase);
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
  };
}
