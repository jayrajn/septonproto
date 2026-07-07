import type {
  CapabilityId,
  CapabilityLearningState,
  ContextRetrievalHint,
  DecisionEvidencePackage,
  DecisionPattern,
  EnterpriseMemorySnapshot,
  EvidenceStoreState,
  KnowledgeBase,
  LearningSignal,
  LearningState,
  PatternLearningStatus,
  StoredEvidenceCounts,
} from "../domain/types";

const PATTERN_THRESHOLD = 3;

export interface LearningArtifacts {
  learningSignals: LearningSignal[];
  patternArtifacts: DecisionPattern[];
  retrievalHints: ContextRetrievalHint[];
}

export interface StoredLearningResult extends LearningArtifacts {
  evidenceStoreState: EvidenceStoreState;
  learningState: LearningState;
  memorySnapshot: EnterpriseMemorySnapshot;
}

export function createEmptyLearningState(): LearningState {
  return {
    byCapability: {},
  };
}

export function createEmptyEvidenceStoreState(): EvidenceStoreState {
  return {
    storedEvidence: [],
    storedCounts: {
      total: 0,
      approved: 0,
      rejected: 0,
    },
    patternLearningStatusByCapability: {},
  };
}

export function buildMemorySnapshot(knowledgeBase: KnowledgeBase, learningState: LearningState): EnterpriseMemorySnapshot {
  return {
    entities: knowledgeBase.nodes,
    relationships: knowledgeBase.edges,
    semanticMemory: knowledgeBase.documents,
    decisionPatterns: Object.values(learningState.byCapability)
      .flatMap((state) => state?.patterns ?? [])
      .map((pattern) => ({ ...pattern, appliedInCurrentRun: false })),
  };
}

export function storeDecisionOutcome(
  evidence: DecisionEvidencePackage,
  knowledgeBase: KnowledgeBase,
  learningState: LearningState,
  evidenceStoreState: EvidenceStoreState,
): StoredLearningResult {
  const nextEvidenceStoreState = storeEvidence(evidenceStoreState, evidence);
  const nextLearningState = cloneLearningState(learningState);
  const learningSignals: LearningSignal[] = [];
  let patternArtifacts: DecisionPattern[] = [];
  let retrievalHints: ContextRetrievalHint[] = [];

  if (evidence.approvalStatus === "approved") {
    const approvedArtifacts = buildLearningArtifacts(evidence);
    retrievalHints = approvedArtifacts.retrievalHints;
    learningSignals.push(...approvedArtifacts.learningSignals.filter((signal) => signal.service === "Context Retrieval Learning"));

    const existingState = getCapabilityLearningState(nextLearningState, evidence.capabilityId);
    nextLearningState.byCapability[evidence.capabilityId] = {
      approvedEvidenceIds: dedupeStrings([...existingState.approvedEvidenceIds, evidence.id]),
      patterns: existingState.patterns,
      retrievalHints: mergeHints(existingState.retrievalHints, approvedArtifacts.retrievalHints),
    };
  }

  const promotion = maybePromotePatternToMemory(
    evidence,
    nextLearningState,
    nextEvidenceStoreState,
  );

  if (promotion.promotedPattern) {
    patternArtifacts = [promotion.promotedPattern];
    learningSignals.push({
      service: "Pattern Learning Service",
      update: "Threshold reached. Pattern Learning Service promoted one approved evidence package into enterprise memory.",
      effect: "Curated Enterprise Memory now contains one validated decision pattern for this capability.",
    });
  } else if (nextEvidenceStoreState.storedCounts.total >= PATTERN_THRESHOLD) {
    learningSignals.push({
      service: "Pattern Learning Service",
      update:
        promotion.status?.state === "no_promotable_approval"
          ? "Threshold reached, but there is no approved decision available to promote into memory."
          : "Threshold reached, but this capability already has a promoted pattern in enterprise memory.",
      effect: "Decision Evidence Store retains all outcomes, while enterprise memory remains limited to approved promoted patterns.",
    });
  }

  const refreshedEvidenceStoreState = refreshPatternStatuses(nextEvidenceStoreState, nextLearningState);

  return {
    evidenceStoreState: refreshedEvidenceStoreState,
    learningState: nextLearningState,
    learningSignals,
    patternArtifacts,
    retrievalHints,
    memorySnapshot: buildMemorySnapshot(knowledgeBase, nextLearningState),
  };
}

export function getCapabilityLearningState(
  learningState: LearningState,
  capabilityId: CapabilityId,
): CapabilityLearningState {
  return (
    learningState.byCapability[capabilityId] ?? {
      approvedEvidenceIds: [],
      patterns: [],
      retrievalHints: [],
    }
  );
}

function buildLearningArtifacts(evidence: DecisionEvidencePackage): LearningArtifacts {
  const supportingEvidenceIds = [evidence.id];

  if (evidence.capabilityId === "inventory_optimization") {
    const retrievalHint: ContextRetrievalHint = {
      id: `RH-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      prioritizedContextTypes: ["inventory", "sales_kpi", "promotion_calendar"],
      boostedEntities: ["Chicago North", "Chicago South", "Joliet DC", "egg patties"],
      deprioritizedContextTypes: ["meeting_note", "weather"],
      supportingEvidenceIds,
      explanation:
        "Inventory imbalance, promotion timing, and transfer capacity were the signals that led to the approved recommendation.",
      futureUse:
        "Context Engine boosts inventory, forecast, and distribution signals before the next inventory optimization run.",
      appliedInCurrentRun: false,
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
      recommendedReuse:
        "Use this pattern to pre-stage transfer plans before promotion week inventory constraints become store stockouts.",
      validationState: "validated",
      writeBackTarget: "Curated Enterprise Memory / Inventory Optimization Patterns",
      appliedInCurrentRun: false,
    };

    return {
      learningSignals: [
        {
          service: "Context Retrieval Learning",
          update:
            "Captured that inventory, demand forecast, promotion calendar, and distribution capacity were decisive for this approved recommendation.",
          effect: "Future inventory optimization retrieval prioritizes stock position and transfer-capacity context first.",
        },
        {
          service: "Pattern Learning Service",
          update: "Prepared an inventory rebalancing pattern candidate from the approved evidence package.",
          effect: "It can be promoted to enterprise memory once the evidence-store threshold is reached.",
        },
      ],
      patternArtifacts: [pattern],
      retrievalHints: [retrievalHint],
    };
  }

  const retrievalHint: ContextRetrievalHint = {
    id: `RH-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    prioritizedContextTypes: ["inventory", "supplier_incident", "service_incident", "campaign"],
    boostedEntities: ["Chicago breakfast", "Omega Foods", "mobile ordering", "Breakfast Value Push"],
    deprioritizedContextTypes: ["weather", "meeting_note"],
    supportingEvidenceIds,
    explanation:
      "Supply, digital health, and campaign execution were the strongest evidence-backed signals behind the approved root cause recommendation.",
    futureUse:
      "Context Engine boosts supply, service, and campaign signals for future breakfast sales decline questions before broader background context.",
    appliedInCurrentRun: false,
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
    recommendedReuse:
      "Use this pattern to approve or block promotion launch readiness when supply, digital health, and campaign execution weaken together.",
    validationState: "validated",
    writeBackTarget: "Curated Enterprise Memory / Root Cause Analysis Patterns",
    appliedInCurrentRun: false,
  };

  return {
    learningSignals: [
      {
        service: "Context Retrieval Learning",
        update: "Captured the approved retrieval behavior for breakfast-led decline investigations.",
        effect: "Future root cause runs front-load supply, supplier, and digital evidence instead of treating them as generic context.",
      },
      {
        service: "Pattern Learning Service",
        update: "Prepared a promotion-readiness pattern candidate from the approved evidence package.",
        effect: "It can be promoted to enterprise memory once the evidence-store threshold is reached.",
      },
    ],
    patternArtifacts: [pattern],
    retrievalHints: [retrievalHint],
  };
}

function maybePromotePatternToMemory(
  evidence: DecisionEvidencePackage,
  learningState: LearningState,
  evidenceStoreState: EvidenceStoreState,
): { promotedPattern: DecisionPattern | null; status: PatternLearningStatus | null } {
  const status = buildPatternLearningStatus(evidence.capabilityId, evidenceStoreState, learningState);
  if (!status.thresholdReached || status.state !== "promoted_to_memory" || status.promotedPatternId) {
    return {
      promotedPattern: null,
      status,
    };
  }

  const latestApprovedEvidence = evidenceStoreState.storedEvidence
    .filter((item) => item.capabilityId === evidence.capabilityId && item.approvalStatus === "approved")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!latestApprovedEvidence) {
    return {
      promotedPattern: null,
      status: {
        ...status,
        state: "no_promotable_approval",
      },
    };
  }

  const promotedPattern = buildLearningArtifacts(latestApprovedEvidence).patternArtifacts[0];
  const existingState = getCapabilityLearningState(learningState, evidence.capabilityId);
  learningState.byCapability[evidence.capabilityId] = {
    approvedEvidenceIds: existingState.approvedEvidenceIds,
    retrievalHints: existingState.retrievalHints,
    patterns: mergePatterns(existingState.patterns, [promotedPattern]),
  };

  return {
    promotedPattern,
    status: {
      ...status,
      selectedEvidenceId: latestApprovedEvidence.id,
      promotedPatternId: promotedPattern.id,
    },
  };
}

function refreshPatternStatuses(evidenceStoreState: EvidenceStoreState, learningState: LearningState): EvidenceStoreState {
  const allCapabilities = new Set<CapabilityId>([
    "root_cause_analysis",
    "inventory_optimization",
  ]);

  return {
    ...evidenceStoreState,
    storedCounts: calculateStoredCounts(evidenceStoreState.storedEvidence),
    patternLearningStatusByCapability: Array.from(allCapabilities).reduce<
      Partial<Record<CapabilityId, PatternLearningStatus>>
    >((statuses, capabilityId) => {
      statuses[capabilityId] = buildPatternLearningStatus(capabilityId, evidenceStoreState, learningState);
      return statuses;
    }, {}),
  };
}

function buildPatternLearningStatus(
  capabilityId: CapabilityId,
  evidenceStoreState: EvidenceStoreState,
  learningState: LearningState,
): PatternLearningStatus {
  const storedObserved = evidenceStoreState.storedCounts.total;
  const eligibleApprovedEvidence = evidenceStoreState.storedEvidence
    .filter((item) => item.capabilityId === capabilityId && item.approvalStatus === "approved")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const promotedPattern = getCapabilityLearningState(learningState, capabilityId).patterns[0];
  const thresholdReached = storedObserved >= PATTERN_THRESHOLD;

  if (!thresholdReached) {
    return {
      capabilityId,
      storedObserved,
      eligibleApprovedCount: eligibleApprovedEvidence.length,
      threshold: PATTERN_THRESHOLD,
      thresholdReached,
      state: "waiting_for_threshold",
    };
  }

  if (!eligibleApprovedEvidence.length) {
    return {
      capabilityId,
      storedObserved,
      eligibleApprovedCount: 0,
      threshold: PATTERN_THRESHOLD,
      thresholdReached,
      state: "no_promotable_approval",
    };
  }

  return {
    capabilityId,
    storedObserved,
    eligibleApprovedCount: eligibleApprovedEvidence.length,
    threshold: PATTERN_THRESHOLD,
    thresholdReached,
    state: "promoted_to_memory",
    selectedEvidenceId: eligibleApprovedEvidence[0].id,
    promotedPatternId: promotedPattern?.id,
  };
}

function storeEvidence(evidenceStoreState: EvidenceStoreState, evidence: DecisionEvidencePackage): EvidenceStoreState {
  const storedEvidence = [
    evidence,
    ...evidenceStoreState.storedEvidence.filter((item) => item.id !== evidence.id),
  ];

  return {
    ...evidenceStoreState,
    storedEvidence,
    storedCounts: calculateStoredCounts(storedEvidence),
  };
}

function calculateStoredCounts(storedEvidence: DecisionEvidencePackage[]): StoredEvidenceCounts {
  return {
    total: storedEvidence.length,
    approved: storedEvidence.filter((evidence) => evidence.approvalStatus === "approved").length,
    rejected: storedEvidence.filter((evidence) => evidence.approvalStatus === "rejected").length,
  };
}

function cloneLearningState(learningState: LearningState): LearningState {
  return {
    byCapability: Object.fromEntries(
      Object.entries(learningState.byCapability).map(([capabilityId, state]) => [
        capabilityId,
        state
          ? {
              approvedEvidenceIds: [...state.approvedEvidenceIds],
              patterns: state.patterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: false })),
              retrievalHints: state.retrievalHints.map((hint) => ({ ...hint, appliedInCurrentRun: false })),
            }
          : state,
      ]),
    ) as LearningState["byCapability"],
  };
}

function mergePatterns(existingPatterns: DecisionPattern[], nextPatterns: DecisionPattern[]): DecisionPattern[] {
  const merged = new Map(existingPatterns.map((pattern) => [pattern.id, { ...pattern, appliedInCurrentRun: false }] as const));
  for (const pattern of nextPatterns) {
    merged.set(pattern.id, { ...pattern, appliedInCurrentRun: false });
  }
  return Array.from(merged.values());
}

function mergeHints(existingHints: ContextRetrievalHint[], nextHints: ContextRetrievalHint[]): ContextRetrievalHint[] {
  const merged = new Map(
    existingHints.map((hint) => [hint.id, { ...hint, appliedInCurrentRun: false }] as const),
  );
  for (const hint of nextHints) {
    merged.set(hint.id, { ...hint, appliedInCurrentRun: false });
  }
  return Array.from(merged.values());
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
