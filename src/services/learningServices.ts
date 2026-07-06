import type { DecisionEvidencePackage, LearningSignal } from "../domain/types";

export function learnFromEvidence(evidence: DecisionEvidencePackage): LearningSignal[] {
  return [
    {
      service: "Context Retrieval Learning",
      update: "Increased Root Cause Analysis ranking weight for inventory, supplier incidents, and digital incidents when sales decline is breakfast-led.",
      effect: `Future retrieval model ${evidence.capabilityId}.context_ranker will prioritize supply and digital signals for similar questions.`,
    },
    {
      service: "Pattern Learning Service",
      update: "Created validated pattern: breakfast promotion risk rises when supplier fill rate, mobile health, and creative approvals fail together.",
      effect: "Curated Enterprise Memory can reuse this pattern for August promotion readiness checks.",
    },
  ];
}
