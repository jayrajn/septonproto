import type { ContextBundle, DecisionEvidencePackage, Recommendation } from "../domain/types";
import { evaluateConfidence } from "./confidenceEvaluator";

export function createEvidencePackage(bundle: ContextBundle, recommendation: Recommendation): DecisionEvidencePackage {
  const idSuffix = Math.abs(hashCode(`${bundle.intent.question}${Date.now()}`)).toString(16).slice(0, 8);
  const confidenceEvaluation = evaluateConfidence(bundle);
  return {
    id: `DEP-${idSuffix.toUpperCase()}`,
    createdAt: new Date().toISOString(),
    question: bundle.intent.question,
    capabilityId: bundle.intent.capabilityId,
    contextUsed: bundle.vectorHits.map((hit) => `${hit.record.source}:${hit.record.id}`),
    contextIgnored: bundle.ignoredContextTypes,
    reasoningTrace: [
      `Capability contract selected: ${bundle.capability.name}.`,
      `Required context constrained retrieval to ${bundle.capability.requiredContext.join(", ")}.`,
      "Graph and vector retrieval assembled the governed context bundle.",
      "Recommendation was validated against live data access context and capability confidence rules.",
    ],
    confidenceRules: confidenceEvaluation.ruleResults,
    recommendation,
    confidence: recommendation.confidence,
    outcome: "pending_feedback",
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
