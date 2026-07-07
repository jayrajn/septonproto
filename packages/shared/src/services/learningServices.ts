import type {
  ContextRetrievalHint,
  DecisionEvidencePackage,
  DecisionPattern,
  EnterpriseMemorySnapshot,
  KnowledgeBase,
  LearningSignal,
} from "../domain/types";

export interface LearningArtifacts {
  learningSignals: LearningSignal[];
  patternArtifacts: DecisionPattern[];
  retrievalHints: ContextRetrievalHint[];
  memorySnapshot: EnterpriseMemorySnapshot;
}

export function buildInitialMemorySnapshot(knowledgeBase: KnowledgeBase): EnterpriseMemorySnapshot {
  return {
    entities: knowledgeBase.nodes,
    relationships: knowledgeBase.edges,
    semanticMemory: knowledgeBase.documents,
    decisionPatterns: [],
  };
}

export function buildLearningArtifacts(
  evidence: DecisionEvidencePackage,
  knowledgeBase: KnowledgeBase,
): LearningArtifacts {
  const supportingEvidenceIds = [evidence.id];

  if (evidence.capabilityId === "inventory_optimization") {
    const retrievalHint: ContextRetrievalHint = {
      id: `RH-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      prioritizedContextTypes: ["inventory", "sales_kpi", "promotion_calendar"],
      boostedEntities: ["Chicago North", "Chicago South", "Joliet DC", "egg patties"],
      deprioritizedContextTypes: ["meeting_note", "weather"],
      supportingEvidenceIds,
      explanation: "Inventory imbalance, promotion timing, and transfer capacity were the signals that led to the approved recommendation.",
      futureUse: "Context Engine boosts inventory, forecast, and distribution signals before the next inventory optimization run.",
    };

    const pattern: DecisionPattern = {
      id: `PAT-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      title: "Rebalance overstocked clusters before promotion demand lift",
      triggerConditions: [
        "North cluster overstock exceeds South cluster shortage",
        "Promotion demand lift is forecast above baseline",
        "Distribution transfer capacity is available in the launch window",
      ],
      supportingEvidenceIds,
      recommendedReuse: "Use this pattern to pre-stage transfer plans before promotion week inventory constraints become store stockouts.",
      validationState: "validated",
      writeBackTarget: "Curated Enterprise Memory / Inventory Optimization Patterns",
    };

    return {
      learningSignals: [
        {
          service: "Context Retrieval Learning",
          update: "Captured that inventory, demand forecast, promotion calendar, and distribution capacity were decisive for this approved recommendation.",
          effect: "Future inventory optimization retrieval can prioritize stock position and transfer-capacity context first.",
        },
        {
          service: "Pattern Learning Service",
          update: "Extracted a validated inventory rebalancing pattern from the approved evidence package.",
          effect: "Curated Enterprise Memory now stores the pattern for future promotion-readiness checks.",
        },
      ],
      patternArtifacts: [pattern],
      retrievalHints: [retrievalHint],
      memorySnapshot: {
        ...buildInitialMemorySnapshot(knowledgeBase),
        decisionPatterns: [pattern],
      },
    };
  }

  const retrievalHint: ContextRetrievalHint = {
    id: `RH-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    prioritizedContextTypes: ["inventory", "supplier_incident", "service_incident", "campaign"],
    boostedEntities: ["Chicago breakfast", "Omega Foods", "mobile ordering", "Breakfast Value Push"],
    deprioritizedContextTypes: ["weather", "meeting_note"],
    supportingEvidenceIds,
    explanation: "Supply, digital health, and campaign execution were the strongest evidence-backed signals behind the approved root cause recommendation.",
    futureUse: "Context Engine boosts supply, service, and campaign signals for future breakfast sales decline questions before broader background context.",
  };

  const pattern: DecisionPattern = {
    id: `PAT-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    title: "Promotion readiness gate for breakfast decline prevention",
    triggerConditions: [
      "Supplier fill rate falls below breakfast launch threshold",
      "Mobile ordering incidents impact breakfast conversion",
      "Campaign approvals or trafficking slip before launch",
    ],
    supportingEvidenceIds,
    recommendedReuse: "Use this pattern to approve or block promotion launch readiness when supply, digital health, and campaign execution weaken together.",
    validationState: "validated",
    writeBackTarget: "Curated Enterprise Memory / Root Cause Analysis Patterns",
  };

  return {
    learningSignals: [
      {
        service: "Context Retrieval Learning",
        update: "Captured the approved retrieval behavior for breakfast-led decline investigations.",
        effect: "Future root cause runs can front-load supply, supplier, and digital evidence instead of treating them as generic context.",
      },
      {
        service: "Pattern Learning Service",
        update: "Extracted a validated promotion-readiness decision pattern from the approved evidence package.",
        effect: "Curated Enterprise Memory now stores the pattern for future August promotion readiness checks.",
      },
    ],
    patternArtifacts: [pattern],
    retrievalHints: [retrievalHint],
    memorySnapshot: {
      ...buildInitialMemorySnapshot(knowledgeBase),
      decisionPatterns: [pattern],
    },
  };
}
