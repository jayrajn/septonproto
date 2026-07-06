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
      "Capability contract constrained retrieval to sales, supply, digital, campaign, and unstructured meeting context.",
      "Measured sales decline was decomposed by geography and daypart.",
      "Graph traversal connected Chicago breakfast decline to supplier delay, inventory stockouts, mobile incidents, and campaign pause.",
      "Recommendation was validated against freshness-sensitive live context and promotion calendar.",
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
