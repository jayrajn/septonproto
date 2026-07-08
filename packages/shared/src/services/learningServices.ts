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
  NegativeDecisionPattern,
  PatternLearningStatus,
  RunStage,
  StoredEvidenceCounts,
} from "../domain/types";

export interface LearningArtifacts {
  learningSignals: LearningSignal[];
  patternArtifacts: DecisionPattern[];
  retrievalHints: ContextRetrievalHint[];
  negativePatternArtifacts: NegativeDecisionPattern[];
  rejectedRetrievalHints: ContextRetrievalHint[];
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
    storedCounts: { total: 0, approved: 0, rejected: 0 },
    patternLearningStatusByCapability: {},
  };
}

export function getCapabilityLearningState(
  learningState: LearningState,
  capabilityId: CapabilityId,
): CapabilityLearningState {
  return (
    learningState.byCapability[capabilityId] ?? {
      storedOutcomeCount: 0,
      approvedEvidenceIds: [],
      rejectedEvidenceIds: [],
      candidatePatterns: [],
      patterns: [],
      negativePatterns: [],
      approvedRetrievalHints: [],
      rejectedRetrievalHints: [],
    }
  );
}

export function getCurrentRunStage(learningState: LearningState, capabilityId: CapabilityId): RunStage {
  const storedOutcomeCount = getCapabilityLearningState(learningState, capabilityId).storedOutcomeCount;
  return toRunStage(storedOutcomeCount + 1);
}

export function getRunLearningMode(
  learningState: LearningState,
  capabilityId: CapabilityId,
): PatternLearningStatus["learningMode"] {
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);
  if (currentRunStage === 1) return "none";
  if (currentRunStage === 2) return "retrieval";
  if (currentRunStage === 3) return "retrieval_pattern";
  return "retrieval_memory";
}

export function getRunRetrievalHints(learningState: LearningState, capabilityId: CapabilityId): ContextRetrievalHint[] {
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);
  if (currentRunStage === 1) return [];

  return getCapabilityLearningState(learningState, capabilityId).approvedRetrievalHints.map((hint) => ({
    ...hint,
    appliedInCurrentRun: true,
  }));
}

export function getRunRejectedRetrievalHints(learningState: LearningState, capabilityId: CapabilityId): ContextRetrievalHint[] {
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);
  if (currentRunStage === 1) return [];

  return getCapabilityLearningState(learningState, capabilityId).rejectedRetrievalHints.map((hint) => ({
    ...hint,
    appliedInCurrentRun: true,
  }));
}

export function getRunDecisionPatterns(learningState: LearningState, capabilityId: CapabilityId): DecisionPattern[] {
  const capabilityState = getCapabilityLearningState(learningState, capabilityId);
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);

  if (currentRunStage === 3 && capabilityState.patterns.length === 0 && capabilityState.candidatePatterns.length > 0) {
    return capabilityState.candidatePatterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: true }));
  }

  if (currentRunStage === 4 && capabilityState.patterns.length > 0) {
    return capabilityState.patterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: true }));
  }

  return [];
}

export function getRunNegativeDecisionPatterns(
  learningState: LearningState,
  capabilityId: CapabilityId,
): NegativeDecisionPattern[] {
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);
  if (currentRunStage === 1) return [];

  return getCapabilityLearningState(learningState, capabilityId).negativePatterns.map((pattern) => ({
    ...pattern,
    appliedInCurrentRun: true,
  }));
}

export function buildMemorySnapshot(
  knowledgeBase: KnowledgeBase,
  learningState: LearningState,
  capabilityId?: CapabilityId,
): EnterpriseMemorySnapshot {
  const persistedPatterns = Object.values(learningState.byCapability)
    .flatMap((state) => state?.patterns ?? [])
    .map((pattern) => ({ ...pattern, appliedInCurrentRun: false }));
  const persistedNegativePatterns = Object.values(learningState.byCapability)
    .flatMap((state) => state?.negativePatterns ?? [])
    .map((pattern) => ({ ...pattern, appliedInCurrentRun: false }));

  const runSpecificPatterns =
    capabilityId != null
      ? getRunMemoryPatterns(learningState, capabilityId).filter(
          (pattern) => !persistedPatterns.some((existingPattern) => existingPattern.id === pattern.id),
        )
      : [];
  const runSpecificNegativePatterns =
    capabilityId != null
      ? getRunNegativeDecisionPatterns(learningState, capabilityId).filter(
          (pattern) => !persistedNegativePatterns.some((existingPattern) => existingPattern.id === pattern.id),
        )
      : [];

  return {
    entities: knowledgeBase.nodes,
    relationships: knowledgeBase.edges,
    semanticMemory: knowledgeBase.documents,
    decisionPatterns: [...persistedPatterns, ...runSpecificPatterns],
    negativeDecisionPatterns: [...persistedNegativePatterns, ...runSpecificNegativePatterns],
  };
}

export function storeDecisionOutcome(
  evidence: DecisionEvidencePackage,
  knowledgeBase: KnowledgeBase,
  learningState: LearningState,
  evidenceStoreState: EvidenceStoreState,
): StoredLearningResult {
  const stageBeforeStore = getCurrentRunStage(learningState, evidence.capabilityId);
  const nextLearningState = cloneLearningState(learningState);
  const nextEvidenceStoreState = storeEvidence(evidenceStoreState, evidence);
  const capabilityState = getCapabilityLearningState(nextLearningState, evidence.capabilityId);
  const approvedArtifacts = evidence.approvalStatus === "approved" ? buildLearningArtifacts(evidence) : null;
  const rejectedArtifacts = evidence.approvalStatus === "rejected" ? buildRejectedLearningArtifacts(evidence) : null;

  capabilityState.storedOutcomeCount += 1;

  if (approvedArtifacts) {
    capabilityState.approvedEvidenceIds = dedupeStrings([...capabilityState.approvedEvidenceIds, evidence.id]);
    capabilityState.approvedRetrievalHints = mergeHints(
      capabilityState.approvedRetrievalHints,
      approvedArtifacts.retrievalHints,
    );
    capabilityState.candidatePatterns = mergePatterns(capabilityState.candidatePatterns, approvedArtifacts.patternArtifacts);
  }
  if (rejectedArtifacts) {
    capabilityState.rejectedEvidenceIds = dedupeStrings([...capabilityState.rejectedEvidenceIds, evidence.id]);
    capabilityState.rejectedRetrievalHints = mergeHints(
      capabilityState.rejectedRetrievalHints,
      rejectedArtifacts.rejectedRetrievalHints,
    );
    capabilityState.negativePatterns = mergeNegativePatterns(
      capabilityState.negativePatterns,
      rejectedArtifacts.negativePatternArtifacts,
    );
  }

  if (stageBeforeStore === 3 && capabilityState.patterns.length === 0 && capabilityState.candidatePatterns.length > 0) {
    const latestPattern = capabilityState.candidatePatterns[capabilityState.candidatePatterns.length - 1];
    capabilityState.patterns = mergePatterns(capabilityState.patterns, [latestPattern]);
  }

  nextLearningState.byCapability[evidence.capabilityId] = capabilityState;
  const refreshedEvidenceStoreState = refreshPatternStatuses(nextEvidenceStoreState, nextLearningState);
  const currentRunPatterns = getRunDecisionPatterns(learningState, evidence.capabilityId);
  const currentRunHints = getRunRetrievalHints(learningState, evidence.capabilityId);
  const currentRunNegativePatterns = getRunNegativeDecisionPatterns(learningState, evidence.capabilityId);
  const currentRejectedHints = getRunRejectedRetrievalHints(learningState, evidence.capabilityId);

  return {
    evidenceStoreState: refreshedEvidenceStoreState,
    learningState: nextLearningState,
    learningSignals: buildLearningSignals(
      stageBeforeStore,
      evidence.approvalStatus,
      capabilityState,
      approvedArtifacts,
      rejectedArtifacts,
    ),
    patternArtifacts: currentRunPatterns,
    retrievalHints: currentRunHints,
    negativePatternArtifacts: currentRunNegativePatterns,
    rejectedRetrievalHints: currentRejectedHints,
    memorySnapshot: buildMemorySnapshot(knowledgeBase, nextLearningState, evidence.capabilityId),
  };
}

function buildLearningArtifacts(evidence: DecisionEvidencePackage): LearningArtifacts {
  const supportingEvidenceIds = [evidence.id];

  if (evidence.capabilityId === "inventory_optimization") {
    const retrievalHint: ContextRetrievalHint = {
      id: `RH-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      learningSource: "approved",
      prioritizedContextTypes: ["inventory", "sales_kpi", "promotion_calendar"],
      boostedEntities: ["Chicago North", "Chicago South", "Joliet DC", "egg patties"],
      deprioritizedContextTypes: ["meeting_note", "weather"],
      supportingEvidenceIds,
      explanation: "Septon learned to look earlier at inventory imbalance, promotion timing, and transfer capacity.",
      futureUse: "Next time Septon will raise the priority of inventory, demand, and transfer context earlier in the run.",
      appliedInCurrentRun: false,
    };

    const pattern: DecisionPattern = {
      id: `PAT-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      title: "Pre-position inventory ahead of the demand increase",
      triggerConditions: [
        "North cluster overstock exceeds South cluster shortage",
        "Promotion demand lift is forecast above baseline",
        "Distribution transfer capacity is available in the launch window",
      ],
      supportingEvidenceIds,
      recommendedReuse: "Reuse this playbook when promotion demand is likely to expose inventory imbalance across store groups.",
      validationState: "validated",
      writeBackTarget: "Curated Enterprise Memory / Inventory Optimization Patterns",
      appliedInCurrentRun: false,
    };

    return {
      learningSignals: [],
      patternArtifacts: [pattern],
      retrievalHints: [retrievalHint],
      negativePatternArtifacts: [],
      rejectedRetrievalHints: [],
    };
  }

  const retrievalHint: ContextRetrievalHint = {
    id: `RH-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    learningSource: "approved",
    prioritizedContextTypes: ["inventory", "supplier_incident", "service_incident", "campaign"],
    boostedEntities: ["Chicago breakfast", "Omega Foods", "mobile ordering", "Breakfast Value Push"],
    deprioritizedContextTypes: ["weather", "meeting_note"],
    supportingEvidenceIds,
    explanation: "Septon learned to prioritize supply, digital reliability, and campaign execution sooner in similar decline questions.",
    futureUse: "Next time Septon will bring supply, service, and campaign signals to the top of the context bundle.",
    appliedInCurrentRun: false,
  };

  const pattern: DecisionPattern = {
    id: `PAT-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    title: "Breakfast launch readiness gate",
    triggerConditions: [
      "Supplier fill rate falls below breakfast launch threshold",
      "Mobile ordering incidents impact breakfast conversion",
      "Campaign approvals or trafficking slip before launch",
    ],
    supportingEvidenceIds,
    recommendedReuse: "Reuse this playbook when supply, digital health, and campaign readiness weaken together before a launch.",
    validationState: "validated",
    writeBackTarget: "Curated Enterprise Memory / Root Cause Analysis Patterns",
    appliedInCurrentRun: false,
  };

  return {
    learningSignals: [],
    patternArtifacts: [pattern],
    retrievalHints: [retrievalHint],
    negativePatternArtifacts: [],
    rejectedRetrievalHints: [],
  };
}

function buildRejectedLearningArtifacts(evidence: DecisionEvidencePackage): LearningArtifacts {
  const supportingEvidenceIds = [evidence.id];

  if (evidence.capabilityId === "inventory_optimization") {
    const rejectedHint: ContextRetrievalHint = {
      id: `RRH-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      learningSource: "rejected",
      prioritizedContextTypes: ["inventory", "promotion_calendar"],
      boostedEntities: ["Chicago North", "Chicago South", "Joliet DC"],
      deprioritizedContextTypes: ["meeting_note", "weather"],
      supportingEvidenceIds,
      explanation: "Septon recorded that the reviewer rejected a broad Chicago North to Chicago South transfer as the lead recommendation.",
      futureUse: "Next time Septon will shift toward DC replenishment, supplier expedite, promotion controls, or smaller targeted moves before proposing another bulk transfer.",
      appliedInCurrentRun: false,
    };

    const negativePattern: NegativeDecisionPattern = {
      id: `NPAT-${evidence.id}`,
      capabilityId: evidence.capabilityId,
      title: "Reviewer rejected broad Chicago inventory transfer path",
      rejectedConditions: [
        "Broad transfer recommendation was rejected",
        "Same Chicago North to Chicago South rebalancing path was proposed without enough alternative checks",
        "Demand and transfer context alone should not dominate the next recommendation",
      ],
      supportingEvidenceIds,
      blockedRecommendation: evidence.recommendation.headline,
      rejectionEffect: "block_reuse",
      writeBackTarget: "Curated Enterprise Memory / Inventory Optimization Rejected Patterns",
      appliedInCurrentRun: false,
    };

    return {
      learningSignals: [],
      patternArtifacts: [],
      retrievalHints: [],
      negativePatternArtifacts: [negativePattern],
      rejectedRetrievalHints: [rejectedHint],
    };
  }

  const rejectedHint: ContextRetrievalHint = {
    id: `RRH-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    learningSource: "rejected",
    prioritizedContextTypes: ["supplier_incident", "service_incident", "campaign"],
    boostedEntities: ["Chicago breakfast", "Omega Foods", "mobile ordering", "Breakfast Value Push"],
    deprioritizedContextTypes: ["weather", "meeting_note"],
    supportingEvidenceIds,
    explanation: "Septon recorded that the rejected recommendation leaned too hard on the same supplier, service, and campaign framing.",
    futureUse: "Next time Septon will suppress the rejected framing and force a different recommendation path before reusing that launch narrative.",
    appliedInCurrentRun: false,
  };

  const negativePattern: NegativeDecisionPattern = {
    id: `NPAT-${evidence.id}`,
    capabilityId: evidence.capabilityId,
    title: "Avoid repeating the rejected breakfast launch recommendation",
    rejectedConditions: [
      "Same launch-readiness recommendation was rejected",
      "Supplier, digital, and campaign framing should not be reused unchanged",
      "Next run should prefer a different prevention path before repeating the same gate",
    ],
    supportingEvidenceIds,
    blockedRecommendation: evidence.recommendation.headline,
    rejectionEffect: "avoid",
    writeBackTarget: "Curated Enterprise Memory / Root Cause Analysis Rejected Patterns",
    appliedInCurrentRun: false,
  };

  return {
    learningSignals: [],
    patternArtifacts: [],
    retrievalHints: [],
    negativePatternArtifacts: [negativePattern],
    rejectedRetrievalHints: [rejectedHint],
  };
}

function buildLearningSignals(
  stageBeforeStore: RunStage,
  approvalStatus: DecisionEvidencePackage["approvalStatus"],
  capabilityState: CapabilityLearningState,
  approvedArtifacts: LearningArtifacts | null,
  rejectedArtifacts: LearningArtifacts | null,
): LearningSignal[] {
  const signals: LearningSignal[] = [];

  if (approvalStatus === "approved" && approvedArtifacts) {
    if (stageBeforeStore === 1) {
      signals.push({
        service: "Context Retrieval Learning",
        update: "Septon learned which context mattered most in this first decision.",
        effect: "Run 2 will change the context bundle and recommendation using those retrieval signals.",
      });
    } else if (stageBeforeStore === 2) {
      signals.push({
        service: "Context Retrieval Learning",
        update: "Septon refined the context bundle again based on the second stored outcome.",
        effect: "Run 3 will change the context again and activate pattern learning.",
      });
      signals.push({
        service: "Pattern Learning Service",
        update: "Septon has enough approved guidance to form a reusable playbook for the next run.",
        effect: "Run 3 will show both changed context and a new enterprise-memory pattern.",
      });
    } else if (stageBeforeStore === 3) {
      signals.push({
        service: "Pattern Learning Service",
        update: "Septon wrote a reusable playbook into enterprise memory from this decision sequence.",
        effect: "Run 4 will reuse that memory together with another context update.",
      });
    } else {
      signals.push({
        service: "Pattern Learning Service",
        update: "Septon reused stored enterprise memory and updated the context again.",
        effect: "This run reflects both prior memory and fresh retrieval learning.",
      });
    }
  } else if (approvalStatus === "rejected" && rejectedArtifacts) {
    signals.push({
      service: "Context Retrieval Learning",
      update: "Septon stored this rejected outcome as a negative retrieval signal.",
      effect: "The next run will suppress similar context emphasis and avoid repeating the same leading recommendation path.",
    });
    signals.push({
      service: "Pattern Learning Service",
      update: "Septon wrote a rejection-derived memory item so the same pattern is harder to reuse unchanged.",
      effect: "Future runs can block or deprioritize a recommendation path that matches this rejected evidence.",
    });
  }

  if (stageBeforeStore === 3 && capabilityState.patterns.length > 0) {
    signals.push({
      service: "Pattern Learning Service",
      update: "What Septon is learning from this decision has now been stored in enterprise memory.",
      effect: "The next run can reuse this stored playbook directly.",
    });
  }

  return signals;
}

function refreshPatternStatuses(evidenceStoreState: EvidenceStoreState, learningState: LearningState): EvidenceStoreState {
  const allCapabilities: CapabilityId[] = ["root_cause_analysis", "inventory_optimization"];

  return {
    ...evidenceStoreState,
    storedCounts: calculateStoredCounts(evidenceStoreState.storedEvidence),
    patternLearningStatusByCapability: allCapabilities.reduce<Partial<Record<CapabilityId, PatternLearningStatus>>>(
      (statuses, capabilityId) => {
        statuses[capabilityId] = buildPatternLearningStatus(capabilityId, evidenceStoreState, learningState);
        return statuses;
      },
      {},
    ),
  };
}

function buildPatternLearningStatus(
  capabilityId: CapabilityId,
  evidenceStoreState: EvidenceStoreState,
  learningState: LearningState,
): PatternLearningStatus {
  const capabilityState = getCapabilityLearningState(learningState, capabilityId);
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);
  const approvedCount = capabilityState.approvedEvidenceIds.length;
  const rejectedCount = capabilityState.rejectedEvidenceIds.length;
  const approvedMemoryAvailable = capabilityState.patterns.length > 0;
  const negativeMemoryAvailable = capabilityState.negativePatterns.length > 0;
  const anyMemoryAvailable = approvedMemoryAvailable || negativeMemoryAvailable;
  const learningMode = getRunLearningMode(learningState, capabilityId);

  let state: PatternLearningStatus["state"] = "baseline";
  if (currentRunStage === 2) state = "retrieval_learning";
  if (currentRunStage === 3) state = approvedCount > 0 || rejectedCount > 0 ? "pattern_learning" : "no_promotable_approval";
  if (currentRunStage === 4) state = anyMemoryAvailable ? "enterprise_memory_reuse" : "no_promotable_approval";

  return {
    capabilityId,
    storedObserved: capabilityState.storedOutcomeCount,
    eligibleApprovedCount: approvedCount,
    rejectedStoredCount: rejectedCount,
    currentRunStage,
    learningMode,
    memoryAvailable: anyMemoryAvailable,
    negativeMemoryAvailable,
    memoryReusedNextRun: currentRunStage === 4 && anyMemoryAvailable,
    state,
    selectedEvidenceId: approvedCount > 0 ? capabilityState.approvedEvidenceIds[capabilityState.approvedEvidenceIds.length - 1] : undefined,
    promotedPatternId: approvedMemoryAvailable ? capabilityState.patterns[capabilityState.patterns.length - 1]?.id : undefined,
    rejectedPatternId: negativeMemoryAvailable ? capabilityState.negativePatterns[capabilityState.negativePatterns.length - 1]?.id : undefined,
  };
}

function getRunMemoryPatterns(learningState: LearningState, capabilityId: CapabilityId): DecisionPattern[] {
  const capabilityState = getCapabilityLearningState(learningState, capabilityId);
  const currentRunStage = getCurrentRunStage(learningState, capabilityId);

  if (currentRunStage === 3 && capabilityState.patterns.length === 0 && capabilityState.candidatePatterns.length > 0) {
    return capabilityState.candidatePatterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: false }));
  }

  return capabilityState.patterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: false }));
}

function storeEvidence(evidenceStoreState: EvidenceStoreState, evidence: DecisionEvidencePackage): EvidenceStoreState {
  const storedEvidence = [evidence, ...evidenceStoreState.storedEvidence.filter((item) => item.id !== evidence.id)];
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
              storedOutcomeCount: state.storedOutcomeCount,
              approvedEvidenceIds: [...state.approvedEvidenceIds],
              rejectedEvidenceIds: [...state.rejectedEvidenceIds],
              candidatePatterns: state.candidatePatterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: false })),
              patterns: state.patterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: false })),
              negativePatterns: state.negativePatterns.map((pattern) => ({ ...pattern, appliedInCurrentRun: false })),
              approvedRetrievalHints: state.approvedRetrievalHints.map((hint) => ({ ...hint, appliedInCurrentRun: false })),
              rejectedRetrievalHints: state.rejectedRetrievalHints.map((hint) => ({ ...hint, appliedInCurrentRun: false })),
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
  const merged = new Map(existingHints.map((hint) => [hint.id, { ...hint, appliedInCurrentRun: false }] as const));
  for (const hint of nextHints) {
    merged.set(hint.id, { ...hint, appliedInCurrentRun: false });
  }
  return Array.from(merged.values());
}

function mergeNegativePatterns(
  existingPatterns: NegativeDecisionPattern[],
  nextPatterns: NegativeDecisionPattern[],
): NegativeDecisionPattern[] {
  const merged = new Map(existingPatterns.map((pattern) => [pattern.id, { ...pattern, appliedInCurrentRun: false }] as const));
  for (const pattern of nextPatterns) {
    merged.set(pattern.id, { ...pattern, appliedInCurrentRun: false });
  }
  return Array.from(merged.values());
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function toRunStage(value: number): RunStage {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 4;
}
