import type { DecisionEvidencePackage, LearningSignal } from "../domain/types";

export function learnFromEvidence(evidence: DecisionEvidencePackage): LearningSignal[] {
  if (evidence.capabilityId === "inventory_optimization") {
    return [
      {
        service: "Context Retrieval Learning",
        update: "Captured that inventory, demand forecast, promotion calendar, and distribution capacity were useful for Inventory Optimization.",
        effect: "Future inventory optimization retrieval suggestions can prioritize stock position and transfer capacity context.",
      },
      {
        service: "Pattern Learning Service",
        update: "Created candidate pattern: rebalance overstocked clusters into shortage clusters before promotion demand lift.",
        effect: "Curated Enterprise Memory can reuse this candidate after validation.",
      },
    ];
  }

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
