import {
  Activity,
  BadgeCheck,
  Brain,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Database,
  FileSearch,
  GitBranch,
  HardDrive,
  Layers3,
  LockKeyhole,
  Network,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type {
  CapabilityId,
  ContextHit,
  ContextRetrievalHint,
  EvidenceStoreState,
  LearningState,
  NegativeDecisionPattern,
  PatternLearningStatus,
  DecisionPattern,
  GraphEdge,
  GraphNode,
  GraphPath,
  SeptonRun,
  VectorDocument,
} from "../../../../packages/shared/src/domain/types";
import { approveEvidencePackage, rejectEvidencePackage } from "../../../../packages/shared/src/services/evidenceStore";
import {
  createEmptyEvidenceStoreState,
  createEmptyLearningState,
  getCapabilityLearningState,
  getCurrentRunStage,
  getRunLearningMode,
  storeDecisionOutcome,
} from "../../../../packages/shared/src/services/learningServices";
import { runSepton } from "../../../../packages/shared/src/services/septonRuntime";

const defaultQuestion =
  "Why did sales in the U.S. decline last week, and what should we do to prevent this from happening in the future or for the next promotion in August?";
const inventoryQuestion =
  "How should we optimize egg patty inventory across Chicago stores before the August promotion?";

const capabilityChoices: Array<{ id: CapabilityId; label: string; description: string; question: string }> = [
  {
    id: "root_cause_analysis",
    label: "Root Cause Analysis",
    description: "Explain why sales declined and what to do next.",
    question: defaultQuestion,
  },
  {
    id: "inventory_optimization",
    label: "Inventory Optimization",
    description: "Rebalance stock before demand changes.",
    question: inventoryQuestion,
  },
];

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

type CapabilityRunHistory = Partial<Record<CapabilityId, RunSnapshot[]>>;

type RunSnapshot = {
  runId: string;
  stage: number;
  learningMode: SeptonRun["contextBundle"]["learningMode"];
  vectorHitIds: string[];
  liveDataIds: string[];
  graphPathIds: string[];
  retrievalHintIds: string[];
  decisionPatternIds: string[];
  memoryPatternIds: string[];
};

type RunChangeSnapshot = {
  summary: string;
  addedContextTitles: string[];
  retainedContextTitles: string[];
  retrievalDrivenItems: string[];
  patternDrivenItems: string[];
  memoryReuseItems: string[];
};

type MemoryGraphNodeCandidate = {
  id: string;
  label: string;
  kind: string;
};

type MemoryGraphEdgeCandidate = {
  from: string;
  label: string;
  to: string;
};

export function App() {
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [question, setQuestion] = useState("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<CapabilityId | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [run, setRun] = useState<SeptonRun | null>(null);
  const [showArchitectureFlow, setShowArchitectureFlow] = useState(false);
  const [evidenceStoreState, setEvidenceStoreState] = useState<EvidenceStoreState>(() => createEmptyEvidenceStoreState());
  const [learningState, setLearningState] = useState<LearningState>(() => createEmptyLearningState());
  const [runHistoryByCapability, setRunHistoryByCapability] = useState<CapabilityRunHistory>({});
  const selectedCapability = useMemo(
    () => capabilityChoices.find((capability) => capability.id === selectedCapabilityId) ?? null,
    [selectedCapabilityId],
  );

  useEffect(() => {
    const textarea = questionInputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [question]);

  function executeDecision() {
    if (!selectedCapabilityId) return;
    const nextRun = runSepton(question, selectedCapabilityId, learningState);
    setRun(nextRun);
    setRunHistoryByCapability((history) => appendRunSnapshot(history, nextRun));
    setRunCount((count) => count + 1);
  }

  function approveRecommendation() {
    if (!run) return;
    const approvedEvidence = approveEvidencePackage(run.evidence);
    const learningArtifacts = storeDecisionOutcome(approvedEvidence, run.knowledgeBase, learningState, evidenceStoreState);
    setLearningState(learningArtifacts.learningState);
    setEvidenceStoreState(learningArtifacts.evidenceStoreState);
    const nextRun = {
      ...run,
      evidence: approvedEvidence,
      learningSignals: learningArtifacts.learningSignals,
      patternArtifacts: learningArtifacts.patternArtifacts,
      retrievalHints: learningArtifacts.retrievalHints,
      negativePatternArtifacts: learningArtifacts.negativePatternArtifacts,
      rejectedRetrievalHints: learningArtifacts.rejectedRetrievalHints,
      memorySnapshot: learningArtifacts.memorySnapshot,
    };
    setRun(nextRun);
    setRunHistoryByCapability((history) => replaceLatestRunSnapshot(history, nextRun));
  }

  function rejectRecommendation() {
    if (!run) return;
    const rejectedEvidence = rejectEvidencePackage(run.evidence);
    const learningArtifacts = storeDecisionOutcome(rejectedEvidence, run.knowledgeBase, learningState, evidenceStoreState);
    const revisedRun = runSepton(question, run.intent.capabilityId, learningArtifacts.learningState);
    const rejectedRun = {
      ...run,
      evidence: rejectedEvidence,
      learningSignals: learningArtifacts.learningSignals,
      patternArtifacts: learningArtifacts.patternArtifacts,
      retrievalHints: learningArtifacts.retrievalHints,
      negativePatternArtifacts: learningArtifacts.negativePatternArtifacts,
      rejectedRetrievalHints: learningArtifacts.rejectedRetrievalHints,
      memorySnapshot: learningArtifacts.memorySnapshot,
    };
    const nextRun = {
      ...revisedRun,
      learningSignals: learningArtifacts.learningSignals,
    };
    setLearningState(learningArtifacts.learningState);
    setEvidenceStoreState(learningArtifacts.evidenceStoreState);
    setRun(nextRun);
    setRunCount((count) => count + 1);
    setRunHistoryByCapability((history) => appendRunSnapshot(replaceLatestRunSnapshot(history, rejectedRun), nextRun));
  }

  function resetDecision() {
    setQuestion("");
    setSelectedCapabilityId(null);
    setRun(null);
    setRunCount(0);
    setShowArchitectureFlow(false);
    setEvidenceStoreState(createEmptyEvidenceStoreState());
    setLearningState(createEmptyLearningState());
    setRunHistoryByCapability({});
  }

  function selectCapability(capability: (typeof capabilityChoices)[number]) {
    setSelectedCapabilityId(capability.id);
    setQuestion(capability.question);
    setRun(null);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="app-title">Septon</h1>
          <p className="tagline">Context + Decisions + Evidence</p>
        </div>
        <div className="governance">
          <ShieldCheck size={18} />
          <span>RBAC</span>
          <span>Lineage</span>
          <span>Model governance</span>
          <span>HITL approval</span>
          <span>Audit trail</span>
        </div>
      </header>

      <section className="top-input-row">
        <div className="question-box top-card top-card-step slim-step-card">
          <div className="slim-step-group">
          <div className="step-label">Step 1</div>
          <label>Select a capability</label>
          <div className="capability-row compact-capability-row">
            {capabilityChoices.map((capability) => (
              <button
                type="button"
                className={selectedCapabilityId === capability.id ? "capability-button selected" : "capability-button"}
                key={capability.id}
                onClick={() => selectCapability(capability)}
              >
                <strong>{capability.label}</strong>
                <span>{capability.description}</span>
              </button>
            ))}
          </div>
          </div>
          <div className="slim-step-group slim-question-group">
          <div className="step-label">Step 2</div>
          <label htmlFor="coo-question">Ask Septon</label>
          <textarea
            id="coo-question"
            ref={questionInputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          </div>
          <div className="question-actions slim-actions">
            <button type="button" onClick={resetDecision} className="ghost-button">
              <RefreshCcw size={16} />
              Reset
            </button>
            <button type="button" onClick={executeDecision} className="primary-button" disabled={!selectedCapabilityId}>
              <Play size={16} />
              {selectedCapabilityId ? "Run decision" : "Select capability first"}
            </button>
          </div>
        </div>
      </section>
      <section className="ask-surface">
        <ContextBundleSummary
          run={run}
          selectedCapability={selectedCapability?.label ?? null}
          runHistoryByCapability={runHistoryByCapability}
        />
        {run ? (
          <DecisionSummary
            run={run}
            runCount={runCount}
            onApprove={approveRecommendation}
            onReject={rejectRecommendation}
          />
        ) : (
          <EmptyDecisionState selectedCapability={selectedCapability?.label ?? null} />
        )}
        <TopEvidenceStoreSummary
          evidenceStoreState={evidenceStoreState}
          run={run}
          selectedCapabilityId={selectedCapabilityId}
        />
      </section>

      {(selectedCapabilityId || run) && (
        <TopLearningSnapshots
          run={run}
          learningState={learningState}
          evidenceStoreState={evidenceStoreState}
          selectedCapabilityId={selectedCapabilityId}
        />
      )}

      {run && (
        <section className="behind-scenes">
          <button
            type="button"
            className="behind-scenes-toggle"
            aria-expanded={showArchitectureFlow}
            onClick={() => setShowArchitectureFlow((value) => !value)}
          >
            <span>
              <strong>How Septon works behind the scenes</strong>
              <small>Expand to inspect the architecture flow from onboarding through learning.</small>
            </span>
            {showArchitectureFlow ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showArchitectureFlow && <RuntimeFlow key={run.evidence.id} run={run} evidenceStoreState={evidenceStoreState} />}
        </section>
      )}
    </main>
  );
}

function RuntimeFlow({ run, evidenceStoreState }: { run: SeptonRun; evidenceStoreState: EvidenceStoreState }) {
  const activePatternStatus = getPatternStatus(evidenceStoreState, run.intent.capabilityId);

  return (
    <section className="runtime-flow" aria-label="Septon architecture flow">
      <CollapsibleRuntimeSection
        step="1"
        title="Enterprise Onboarding"
        icon={<Database size={18} />}
        summary={`${run.connectorStatuses.length} enterprise systems connected for this prototype run`}
      >
        <ConnectorPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="2"
        title="Platform Configuration"
        icon={<ShieldCheck size={18} />}
        summary={`${run.intent.capabilityName} capability, governance rules, and retrieval policy selected`}
      >
        <PlatformConfigurationPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="3"
        title="Data Sync & Ingestion"
        icon={<Layers3 size={18} />}
        summary={`${run.knowledgeBase.records.length} records normalized into the prototype runtime`}
      >
        <IngestionPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="4"
        title="Knowledge Processing"
        icon={<Brain size={18} />}
        summary={`${run.knowledgeBase.documents.length} semantic documents and ${run.knowledgeBase.nodes.length} graph nodes created`}
      >
        <KnowledgeProcessingPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="5"
        title="Curated Enterprise Memory"
        icon={<Database size={18} />}
        summary={`${run.memorySnapshot.entities.length} entities, ${run.memorySnapshot.relationships.length} relationships, and ${run.memorySnapshot.decisionPatterns.length} decision patterns stored`}
      >
        <EnterpriseMemoryPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="6"
        title="Live Data Access Layer"
        icon={<Activity size={18} />}
        summary={`${run.contextBundle.liveData.length} freshness-sensitive records checked for this decision`}
      >
        <LiveDataAccessPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="7"
        title="Context Engine"
        icon={<FileSearch size={18} />}
        summary={`Run ${run.contextBundle.currentRunStage}: ${contextModeLabel(run.contextBundle.learningMode)}`}
      >
        <ContextPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="8"
        title="Context Intent"
        icon={<Network size={18} />}
        summary={`${run.intent.capabilityName} selected for ${run.intent.market}`}
      >
        <IntentPanel run={run} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="9"
        title="Decision Evidence Store"
        icon={<ShieldCheck size={18} />}
        summary={`${evidenceStoreState.storedCounts.total} stored decisions, ${evidenceStoreState.storedCounts.approved} approved, ${evidenceStoreState.storedCounts.rejected} rejected`}
      >
        <EvidencePanel run={run} evidenceStoreState={evidenceStoreState} />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="10A"
        title="Context Retrieval Learning"
        icon={<RefreshCcw size={18} />}
        summary={retrievalLearningSummary(run.contextBundle.currentRunStage, run.contextBundle.learningMode)}
      >
        <LearningPanel run={run} evidenceStoreState={evidenceStoreState} mode="context" />
      </CollapsibleRuntimeSection>

      <CollapsibleRuntimeSection
        step="10B"
        title="Pattern Learning Service"
        icon={<RefreshCcw size={18} />}
        summary={patternSummary(activePatternStatus)}
      >
        <LearningPanel run={run} evidenceStoreState={evidenceStoreState} mode="pattern" />
      </CollapsibleRuntimeSection>
    </section>
  );
}

function CollapsibleRuntimeSection({
  step,
  title,
  icon,
  summary,
  children,
}: {
  step: string;
  title: string;
  icon: ReactNode;
  summary: string;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="collapsible-section">
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span className="flow-step">{step}</span>
        <span className="flow-icon">{icon}</span>
        <span className="collapsible-title">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span className="collapsible-action">
          {isExpanded ? "Hide details" : "Show details"}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {isExpanded && <div className="collapsible-body">{children}</div>}
    </section>
  );
}

function NestedDetailSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="nested-detail">
      <button
        type="button"
        className="nested-detail-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span className="nested-detail-action">
          {isExpanded ? "Hide" : "Show"}
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>
      {isExpanded && <div className="nested-detail-body">{children}</div>}
    </section>
  );
}

function EmptyDecisionState({ selectedCapability }: { selectedCapability: string | null }) {
  return (
    <section className="answer-panel empty-state top-card top-card-recommendation">
      <div className="panel-heading">
        <Sparkles size={18} />
        <h2>Decision Engine Recommendation</h2>
      </div>
      <p className="headline">
        {selectedCapability
          ? `${selectedCapability} is selected. Review the question, then run the decision to generate the recommendation.`
          : "Select a capability first, then run the decision to generate the recommendation."}
      </p>
      <div className="empty-steps">
        <span>1. Select capability</span>
        <span>2. Review question</span>
        <span>3. Run decision</span>
      </div>
    </section>
  );
}

function DecisionSummary({
  run,
  runCount,
  onApprove,
  onReject,
}: {
  run: SeptonRun;
  runCount: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isAwaitingApproval = run.evidence.approvalStatus === "awaiting_admin_approval";

  return (
    <section className="answer-panel top-card top-card-recommendation">
      <div className="panel-heading">
        <Sparkles size={18} />
        <h2>Decision Engine Recommendation</h2>
      </div>
      <div className="run-stamp">
        <span>Run {runCount}</span>
        <span>{new Date(run.evidence.createdAt).toLocaleTimeString()}</span>
      </div>
      <div className={`approval-status ${run.evidence.approvalStatus}`}>
        <strong>{approvalStatusLabel(run.evidence.approvalStatus)}</strong>
        <span>{approvalStatusDescription(run.evidence.approvalStatus)}</span>
      </div>
      <div className="recommendation-target">
        <span>What you are approving</span>
        <p className="headline">{run.recommendation.headline}</p>
      </div>
      <div className="confidence">
        <span>Overall recommendation confidence</span>
        <strong>{Math.round(run.recommendation.confidence * 100)}%</strong>
      </div>
      {isAwaitingApproval && (
        <div className="approval-actions">
          <button type="button" className="primary-button" onClick={onApprove}>
            <ShieldCheck size={16} />
            Approve recommendation
          </button>
          <button type="button" className="danger-button" onClick={onReject}>
            Reject recommendation
          </button>
        </div>
      )}
      <h3>{run.intent.capabilityId === "inventory_optimization" ? "Key inventory drivers" : "Root cause contributors"}</h3>
      <div className="root-cause-list">
        {run.recommendation.rootCauses.slice(0, 2).map((cause) => (
          <article className="compact-card" key={cause.cause}>
            <div>
              <strong>{cause.cause}</strong>
              <p>{cause.impact}</p>
            </div>
            <span>
              {Math.round(cause.confidence * 100)}%
              <small>evidence confidence</small>
            </span>
          </article>
        ))}
      </div>
      <h3>{run.intent.capabilityId === "inventory_optimization" ? "Recommended inventory actions" : "Preventive actions and guardrails"}</h3>
      <ul className="check-list">
        {run.recommendation.augustPromotionGuardrails.slice(0, 2).map((item) => (
          <li key={item}>
            <CheckCircle2 size={15} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function approvalStatusLabel(status: SeptonRun["evidence"]["approvalStatus"]): string {
  if (status === "approved") return "Approved by admin";
  if (status === "rejected") return "Rejected by admin";
  return "Awaiting admin approval";
}

function approvalStatusDescription(status: SeptonRun["evidence"]["approvalStatus"]): string {
  if (status === "approved") return "Evidence is stored. Septon can reuse approved learning across later runs.";
  if (status === "rejected") return "Evidence is stored and reused as negative learning so Septon avoids repeating the rejected path on later runs.";
  return "Evidence is not stored until a human validates the recommendation.";
}

function ContextBundleSummary({
  run,
  selectedCapability,
  runHistoryByCapability,
}: {
  run: SeptonRun | null;
  selectedCapability: string | null;
  runHistoryByCapability: CapabilityRunHistory;
}) {
  const changeSnapshot = run ? getRunChangeSnapshot(run, runHistoryByCapability) : null;
  const liveRecords = run?.contextBundle.liveData ?? [];
  const vectorHits = run?.contextBundle.vectorHits ?? [];
  const graphPaths = run?.contextBundle.graphPaths ?? [];
  const sapLiveRecord = liveRecords.find((record) => record.source === "SAP" && record.type === "inventory");
  const retrievalSignals = changeSnapshot?.retrievalDrivenItems.slice(0, 3) ?? [];
  const storedPatternCount = run?.memorySnapshot.decisionPatterns.length ?? 0;
  const rejectedHintCount = run?.contextBundle.appliedRejectedRetrievalHints.length ?? 0;
  const rejectedPatternCount = run?.memorySnapshot.negativeDecisionPatterns.length ?? 0;
  const bundledItems = [
    ...liveRecords.slice(0, 2).map((record) => (record.source === "SAP" && record.type === "inventory" ? "SAP egg inventory check" : record.title)),
    ...vectorHits.slice(0, 2).map((hit) => hit.record.title),
    ...graphPaths.slice(0, 1).map((path) => path.path.map((node) => node.label).slice(0, 3).join(" -> ")),
  ].slice(0, 5);

  return (
    <section className="evidence-summary-panel top-card top-card-context">
      <div className="panel-heading">
        <FileSearch size={18} />
        <h2>Context</h2>
      </div>
      {run ? (
        <>
          <article className="store-capability-status">
            <div>
              <strong>{run.intent.capabilityName}</strong>
              <p>
                Run {run.contextBundle.currentRunStage} using {contextModeLabel(run.contextBundle.learningMode)}
              </p>
            </div>
            <span className="status-pill">{run.contextBundle.contextChanged ? "Changed" : "Baseline"}</span>
          </article>
          <div className="context-section">
            <div className="section-headline">
              <strong>What Context Retrieval Learning is using</strong>
              <span>{run.contextBundle.contextChanged ? `This run is using ${contextModeLabel(run.contextBundle.learningMode)}.` : "Baseline retrieval only."}</span>
            </div>
            <div className="technical-inline-note">
              <span>Using {run.contextBundle.appliedRetrievalHints.length} retrieval hints</span>
              <span>Using {storedPatternCount} stored patterns</span>
              <span>Using {rejectedHintCount} rejected hints</span>
              <span>Using {rejectedPatternCount} rejected memory items</span>
            </div>
            <div className="summary-chip-group">
              {retrievalSignals.length > 0 ? (
                retrievalSignals.map((signal) => <span key={signal}>{signal}</span>)
              ) : (
                <span>Baseline retrieval only</span>
              )}
            </div>
          </div>

          <div className="context-section">
            <div className="section-headline">
              <strong>What is bundled right now</strong>
              <span>{buildCompactContextSummary(run, sapLiveRecord)}</span>
            </div>
            <div className="compact-bundle-grid">
              {bundledItems.map((item) => (
                <article className="business-card compact-business-card" key={item}>
                  <strong>{item}</strong>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="headline compact-headline">
            {selectedCapability
              ? `${selectedCapability} is selected. Septon will assemble the context bundle after you run the decision.`
              : "Choose a capability first. Septon will assemble a ranked context bundle after you run the decision."}
          </p>
          <div className="empty-steps">
            <span>Capability</span>
            <span>Context</span>
            <span>Sources</span>
          </div>
        </>
      )}
    </section>
  );
}

function TopEvidenceStoreSummary({
  evidenceStoreState,
  run,
  selectedCapabilityId,
}: {
  evidenceStoreState: EvidenceStoreState;
  run: SeptonRun | null;
  selectedCapabilityId: CapabilityId | null;
}) {
  const activeCapabilityId = selectedCapabilityId ?? "root_cause_analysis";
  const activeStatus = getPatternStatus(evidenceStoreState, activeCapabilityId);

  return (
    <section className="evidence-summary-panel top-card top-card-evidence">
      <div className="panel-heading">
        <ShieldCheck size={18} />
        <h2>Decision Evidence Store</h2>
      </div>
      <article className="store-capability-status">
        <div>
          <strong>What was stored from this decision</strong>
          <p>{run?.evidence.storageStatus === "stored" ? run.evidence.id : "Awaiting storage"}</p>
        </div>
        <span className="status-pill">{run?.evidence.storageStatus === "stored" ? "Stored" : "Pending"}</span>
      </article>
      <div className="field-grid compact-grid compact-grid-two">
        <Metric icon={<BadgeCheck size={17} />} label="Approval" value={run ? formatLabel(run.evidence.approvalStatus) : "n/a"} />
        <Metric icon={<Database size={17} />} label="Context used" value={run?.evidence.contextUsed.length ?? 0} />
        <Metric icon={<FileSearch size={17} />} label="Reasoning steps" value={run?.evidence.reasoningTrace.length ?? 0} />
        <Metric icon={<LockKeyhole size={17} />} label="Latest stored outcome" value={formatLabel(activeStatus.state)} />
      </div>
      <div className="context-summary-block">
        <strong>Stored contents summary</strong>
        <p>
          {run?.evidence.storageStatus === "stored"
            ? `Septon stored the approval outcome, ${run.evidence.contextUsed.length} context references, and ${run.evidence.reasoningTrace.length} reasoning steps for this decision.`
            : "This decision has not been stored yet because admin approval is still required."}
        </p>
      </div>
    </section>
  );
}

function TopLearningSnapshots({
  run,
  learningState,
  evidenceStoreState,
  selectedCapabilityId,
}: {
  run: SeptonRun | null;
  learningState: LearningState;
  evidenceStoreState: EvidenceStoreState;
  selectedCapabilityId: CapabilityId | null;
}) {
  const activeCapabilityId = selectedCapabilityId ?? "root_cause_analysis";
  const currentStage = run?.contextBundle.currentRunStage ?? getCurrentRunStage(learningState, activeCapabilityId);
  const activeStatus = getPatternStatus(evidenceStoreState, activeCapabilityId);
  const currentMode = run?.contextBundle.learningMode ?? getRunLearningMode(learningState, activeCapabilityId);
  const capabilityState = getCapabilityLearningState(learningState, activeCapabilityId);

  return (
    <>
      <section className="learning-snapshot-strip">
        <article className="evidence-summary-panel learning-snapshot-card learning-snapshot-context">
          <div className="panel-heading">
            <RefreshCcw size={18} />
            <h2>Context Retrieval Learning</h2>
          </div>
          <TechnicalLearningGroup
            title="Learned retrieval hints"
            content={
              capabilityState.approvedRetrievalHints.length > 0 ? (
                <div className="debug-card-list">
                  {capabilityState.approvedRetrievalHints.map((hint) => (
                    <article className="debug-card" key={hint.id}>
                      <strong>{hint.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="prioritizedContextTypes" value={hint.prioritizedContextTypes.map(formatLabel)} />
                        <DebugField label="boostedEntities" value={hint.boostedEntities} />
                        <DebugField label="deprioritizedContextTypes" value={hint.deprioritizedContextTypes.map(formatLabel)} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No retrieval hints stored for this capability yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Source evidence"
            content={
              <div className="debug-grid">
                <DebugField label="supportingEvidenceIds" value={capabilityState.approvedRetrievalHints.flatMap((hint) => hint.supportingEvidenceIds)} />
                <DebugField label="currentCapability" value={capabilityLabel(activeCapabilityId)} />
              </div>
            }
          />
          <TechnicalLearningGroup
            title="Rejected retrieval hints"
            content={
              capabilityState.rejectedRetrievalHints.length > 0 ? (
                <div className="debug-card-list">
                  {capabilityState.rejectedRetrievalHints.map((hint) => (
                    <article className="debug-card rejected-debug-card" key={hint.id}>
                      <strong>{hint.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="suppressedContextTypes" value={hint.prioritizedContextTypes.map(formatLabel)} />
                        <DebugField label="suppressedEntities" value={hint.boostedEntities} />
                        <DebugField label="effect" value={hint.futureUse} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No rejected retrieval hints stored for this capability yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Applied in this run"
            content={
              <div className="debug-grid">
                <DebugField label="hintApplied" value={run ? (run.contextBundle.appliedRetrievalHints.length > 0 ? "true" : "false") : "false"} />
                <DebugField label="learningMode" value={contextModeLabel(currentMode)} />
              </div>
            }
          />
          <TechnicalLearningGroup
            title="Forwarded to Context Engine"
            content={
              run && (run.contextBundle.appliedRetrievalHints.length > 0 || run.contextBundle.appliedRejectedRetrievalHints.length > 0) ? (
                <div className="debug-card-list">
                  {run.contextBundle.appliedRetrievalHints.map((hint) => (
                    <article className="debug-card" key={hint.id}>
                      <strong>{hint.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="prioritizedContextTypes" value={hint.prioritizedContextTypes.map(formatLabel)} />
                        <DebugField label="boostedEntities" value={hint.boostedEntities} />
                        <DebugField label="futureUse" value={hint.futureUse} />
                      </div>
                    </article>
                  ))}
                  {run.contextBundle.appliedRejectedRetrievalHints.map((hint) => (
                    <article className="debug-card rejected-debug-card" key={hint.id}>
                      <strong>{hint.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="suppressedContextTypes" value={hint.prioritizedContextTypes.map(formatLabel)} />
                        <DebugField label="suppressedEntities" value={hint.boostedEntities} />
                        <DebugField label="futureUse" value={hint.futureUse} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No retrieval hints were forwarded to Context Engine in this run.</div>
              )
            }
          />
        </article>

        <article className="evidence-summary-panel learning-snapshot-card learning-snapshot-pattern">
          <div className="panel-heading">
            <Sparkles size={18} />
            <h2>Pattern Learning Service</h2>
          </div>
          <TechnicalLearningGroup
            title="Learned decision patterns"
            content={
              capabilityState.patterns.length > 0 || capabilityState.candidatePatterns.length > 0 ? (
                <div className="debug-card-list">
                  {[...capabilityState.patterns, ...capabilityState.candidatePatterns.filter((candidate) => !capabilityState.patterns.some((stored) => stored.id === candidate.id))].map((pattern) => (
                    <article className="debug-card" key={pattern.id}>
                      <strong>{pattern.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="title" value={pattern.title} />
                        <DebugField label="capabilityId" value={pattern.capabilityId} />
                        <DebugField label="validationState" value={pattern.validationState} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No promotable decision pattern stored yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Rejected negative memory items"
            content={
              capabilityState.negativePatterns.length > 0 ? (
                <div className="debug-card-list">
                  {capabilityState.negativePatterns.map((pattern) => (
                    <article className="debug-card rejected-debug-card" key={pattern.id}>
                      <strong>{pattern.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="title" value={pattern.title} />
                        <DebugField label="rejectionEffect" value={pattern.rejectionEffect} />
                        <DebugField label="blockedRecommendation" value={pattern.blockedRecommendation} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No rejected memory items stored yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Trigger conditions"
            content={
              capabilityState.candidatePatterns.length > 0 || capabilityState.patterns.length > 0 ? (
                <div className="debug-chip-list">
                  {[...capabilityState.patterns, ...capabilityState.candidatePatterns].flatMap((pattern) =>
                    pattern.triggerConditions.map((condition) => (
                      <span key={`${pattern.id}-${condition}`}>{condition}</span>
                    )),
                  )}
                </div>
              ) : (
                <div className="empty-detail">No trigger conditions available yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Supporting evidence"
            content={
              <div className="debug-grid">
                <DebugField
                  label="supportingEvidenceIds"
                  value={[...capabilityState.patterns, ...capabilityState.candidatePatterns].flatMap((pattern) => pattern.supportingEvidenceIds)}
                />
              </div>
            }
          />
          <TechnicalLearningGroup
            title="Write-back target"
            content={
              <div className="debug-grid">
                <DebugField
                  label="memoryTarget"
                  value={[...capabilityState.patterns, ...capabilityState.candidatePatterns].map((pattern) => pattern.writeBackTarget)}
                />
              </div>
            }
          />
          <TechnicalLearningGroup
            title="Current state"
            content={
              <div className="debug-grid">
                <DebugField label="state" value={activeStatus.state} />
                <DebugField label="currentRunStage" value={`Run ${currentStage}`} />
                <DebugField label="reusedThisRun" value={run?.contextBundle.currentRunStage === 4 && run.contextBundle.appliedDecisionPatterns.length > 0 ? "true" : "false"} />
                <DebugField label="rejectedConstraintActive" value={run?.contextBundle.appliedNegativeDecisionPatterns.length ? "true" : "false"} />
              </div>
            }
          />
        </article>

        <article className="evidence-summary-panel learning-snapshot-card learning-snapshot-memory">
          <div className="panel-heading">
            <Database size={18} />
            <h2>Enterprise Memory</h2>
          </div>
          <TechnicalLearningGroup
            title="Stored approved decision patterns"
            content={
              run?.memorySnapshot.decisionPatterns.length ? (
                <div className="debug-card-list">
                  {run.memorySnapshot.decisionPatterns.map((pattern) => (
                    <article className="debug-card" key={pattern.id}>
                      <strong>{pattern.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="title" value={pattern.title} />
                        <DebugField label="writeBackTarget" value={pattern.writeBackTarget} />
                        <DebugField label="state" value={pattern.appliedInCurrentRun ? "reused" : "stored"} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No stored decision patterns are present in enterprise memory yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Stored rejected memory items"
            content={
              run?.memorySnapshot.negativeDecisionPatterns.length ? (
                <div className="debug-card-list">
                  {run.memorySnapshot.negativeDecisionPatterns.map((pattern) => (
                    <article className="debug-card rejected-debug-card" key={pattern.id}>
                      <strong>{pattern.id}</strong>
                      <div className="debug-grid">
                        <DebugField label="title" value={pattern.title} />
                        <DebugField label="blockedRecommendation" value={pattern.blockedRecommendation} />
                        <DebugField label="state" value={pattern.appliedInCurrentRun ? "active constraint" : "stored"} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-detail">No rejected memory items are present in enterprise memory yet.</div>
              )
            }
          />
          <TechnicalLearningGroup
            title="Memory graph view"
            content={<MemoryGraphView patterns={run?.memorySnapshot.decisionPatterns ?? []} negativePatterns={run?.memorySnapshot.negativeDecisionPatterns ?? []} />}
          />
          <TechnicalLearningGroup
            title="Memory reuse state"
            content={
              <div className="debug-grid">
                <DebugField label="memoryChangedThisRun" value={run?.contextBundle.currentRunStage === 3 && (run.memorySnapshot.decisionPatterns.length ?? 0) > 0 ? "true" : "false"} />
                <DebugField label="memoryReusedThisRun" value={run?.contextBundle.currentRunStage === 4 && ((run.contextBundle.appliedDecisionPatterns.length ?? 0) > 0 || (run.contextBundle.appliedNegativeDecisionPatterns.length ?? 0) > 0) ? "true" : "false"} />
              </div>
            }
          />
        </article>
      </section>
      <ClosedLoopSnapshot />
    </>
  );
}

function TechnicalLearningGroup({ title, content }: { title: string; content: ReactNode }) {
  return (
    <section className="technical-learning-group">
      <strong>{title}</strong>
      {content}
    </section>
  );
}

function DebugField({ label, value }: { label: string; value: string | string[] }) {
  const items = Array.isArray(value) ? Array.from(new Set(value)).filter(Boolean) : [value];

  return (
    <div className="debug-field">
      <span>{label}</span>
      {items.length > 1 ? (
        <div className="debug-chip-list">
          {items.map((item) => (
            <small key={item}>{item}</small>
          ))}
        </div>
      ) : (
        <small>{items[0] || "none"}</small>
      )}
    </div>
  );
}

function ClosedLoopSnapshot() {
  return (
    <div className="closed-loop-strip">
      <span>Approved decision</span>
      <span>→</span>
      <span>Learning</span>
      <span>→</span>
      <span>Enterprise memory</span>
      <span>→</span>
      <span>Reused context</span>
    </div>
  );
}

function ConnectorPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Database size={18} />
        <h2>Enterprise Onboarding</h2>
      </div>
      <div className="connector-grid">
        {run.connectorStatuses.map((status) => (
          <article className="connector" key={status.source}>
            <div>
              <strong>{status.source}</strong>
              <p>{status.recordCount} synced records</p>
            </div>
            <span className="status-pill">{status.syncMode}</span>
            <small>Fresh {status.freshness} ago</small>
          </article>
        ))}
      </div>
      <div className="metric-row">
        <Metric icon={<Layers3 size={17} />} label="Canonical records" value={run.knowledgeBase.records.length} />
        <Metric icon={<GitBranch size={17} />} label="Graph nodes" value={run.knowledgeBase.nodes.length} />
        <Metric icon={<Search size={17} />} label="Vector docs" value={run.knowledgeBase.documents.length} />
      </div>
    </section>
  );
}

function PlatformConfigurationPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <ShieldCheck size={18} />
        <h2>Platform Configuration</h2>
      </div>
      <div className="intent-result">
        <p className="eyebrow">Configuration selected for this run</p>
        <h3>{run.intent.capabilityName}</h3>
        <p>
          Capability catalog, governance policy, confidence rules, output schema, and evidence schema are selected
          before context retrieval starts.
        </p>
      </div>
      <div className="field-grid">
        <Metric icon={<Brain size={17} />} label="Capability" value={run.intent.capabilityName} />
        <Metric icon={<ShieldCheck size={17} />} label="Confidence rules" value={run.contextBundle.capability.confidenceRules.length} />
        <Metric icon={<LockKeyhole size={17} />} label="Evidence schema" value={run.contextBundle.capability.evidenceSchema.length} />
      </div>
      <h3>Configured retrieval strategy</h3>
      <ol className="number-list">
        {run.contextBundle.capability.retrievalStrategy.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function IngestionPanel({ run }: { run: SeptonRun }) {
  const syncModes = Array.from(new Set(run.connectorStatuses.map((status) => status.syncMode))).join(", ");

  return (
    <section className="panel">
      <div className="panel-heading">
        <Layers3 size={18} />
        <h2>Data Sync & Ingestion</h2>
      </div>
      <div className="field-grid">
        <Metric icon={<Database size={17} />} label="Canonical records" value={run.knowledgeBase.records.length} />
        <Metric icon={<Activity size={17} />} label="Sync modes" value={syncModes} />
        <Metric icon={<BadgeCheck size={17} />} label="Sources" value={run.connectorStatuses.length} />
      </div>
      <h3>Records moved into Septon</h3>
      <div className="tag-row">
        {Array.from(new Set(run.knowledgeBase.records.map((record) => record.source))).map((source) => (
          <span key={source}>{source}</span>
        ))}
      </div>
    </section>
  );
}

function KnowledgeProcessingPanel({ run }: { run: SeptonRun }) {
  const nodeGroups = groupNodesByType(run.knowledgeBase.nodes);

  return (
    <section className="panel">
      <div className="panel-heading">
        <Brain size={18} />
        <h2>Knowledge Processing</h2>
      </div>
      <div className="intent-result">
        <p className="eyebrow">Meaning extracted</p>
        <h3>Raw records converted into searchable enterprise knowledge</h3>
        <p>
          The prototype classifies records, creates semantic documents, maps entities, builds graph relationships, and
          prepares embeddings for retrieval.
        </p>
      </div>
      <div className="field-grid">
        <Metric icon={<Search size={17} />} label="Semantic documents" value={run.knowledgeBase.documents.length} />
        <Metric icon={<GitBranch size={17} />} label="Graph nodes" value={run.knowledgeBase.nodes.length} />
        <Metric icon={<Network size={17} />} label="Graph edges" value={run.knowledgeBase.edges.length} />
      </div>
      <div className="nested-detail-list">
        <NestedDetailSection title="Semantic documents" summary={`${run.knowledgeBase.documents.length} searchable documents created`}>
          <SemanticDocumentGraph documents={run.knowledgeBase.documents} />
        </NestedDetailSection>
        <NestedDetailSection title="Graph nodes" summary={`${run.knowledgeBase.nodes.length} entities created`}>
          <GraphNodeMatrix groups={nodeGroups} />
        </NestedDetailSection>
        <NestedDetailSection title="Graph edges" summary={`${run.knowledgeBase.edges.length} relationships created`}>
          <GraphEdgeFlow edges={run.knowledgeBase.edges} nodes={run.knowledgeBase.nodes} />
        </NestedDetailSection>
      </div>
    </section>
  );
}

function EnterpriseMemoryPanel({ run }: { run: SeptonRun }) {
  const memory = run.memorySnapshot;
  const entityGroups = groupNodesByType(memory.entities);

  return (
    <section className="panel">
      <div className="panel-heading">
        <Database size={18} />
        <h2>Curated Enterprise Memory</h2>
      </div>
      <div className="intent-result">
        <p className="eyebrow">Memory available to Septon</p>
        <h3>Semantic memory, entities, relationships, facts, events, sources, and decision patterns</h3>
        <p>
          This prototype stores curated references instead of copying every raw enterprise record into the decision
          workflow.
        </p>
      </div>
      <div className="field-grid">
        <Metric icon={<Layers3 size={17} />} label="Entities" value={memory.entities.length} />
        <Metric icon={<GitBranch size={17} />} label="Relationships" value={memory.relationships.length} />
        <Metric icon={<FileSearch size={17} />} label="Semantic memory items" value={memory.semanticMemory.length} />
        <Metric icon={<HardDrive size={17} />} label="Decision patterns" value={memory.decisionPatterns.length} />
      </div>
      <MemoryLoopDiagram evidenceId={run.evidence.id} patterns={memory.decisionPatterns} />
      <div className="nested-detail-list">
        <NestedDetailSection title="Stored entities" summary={`${memory.entities.length} entity nodes in memory`}>
          <GraphNodeMatrix groups={entityGroups} />
        </NestedDetailSection>
        <NestedDetailSection title="Stored relationships" summary={`${memory.relationships.length} relationships in memory`}>
          <GraphEdgeFlow edges={memory.relationships} nodes={memory.entities} />
        </NestedDetailSection>
        <NestedDetailSection title="Stored semantic memory" summary={`${memory.semanticMemory.length} semantic memory references`}>
          <SemanticDocumentGraph documents={memory.semanticMemory} />
        </NestedDetailSection>
        <NestedDetailSection title="Stored decision patterns" summary={`${memory.decisionPatterns.length} learned patterns written back into memory`}>
          <DecisionPatternMemoryView patterns={memory.decisionPatterns} />
        </NestedDetailSection>
      </div>
    </section>
  );
}

function LiveDataAccessPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Activity size={18} />
        <h2>Live Data Access Layer</h2>
      </div>
      <div className="intent-result">
        <p className="eyebrow">Freshness-sensitive access</p>
        <h3>{run.contextBundle.liveData.length} live operational records checked</h3>
        <p>
          Enterprise adapters apply freshness policy and retrieve current operational context for inventory, incidents,
          supplier status, and promotion readiness.
        </p>
      </div>
      <div className="hit-list">
        {run.contextBundle.liveData.map((record) => (
          <article className="hit-row" key={record.id}>
            <div>
              <strong>{record.title}</strong>
              <p>
                {record.source} · {formatLabel(record.type)} · {record.week ?? "current period"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IntentPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Brain size={18} />
        <h2>Context Intent</h2>
      </div>
      <div className="intent-result">
        <p className="eyebrow">What Septon understood</p>
        <h3>{intentSummary(run)}</h3>
        <p>{intentExplanation(run)}</p>
      </div>
      <div className="field-grid">
        <Metric icon={<Brain size={17} />} label="Selected capability" value={run.intent.capabilityName} />
        <Metric icon={<Activity size={17} />} label="Period" value={run.intent.period} />
        <Metric icon={<Network size={17} />} label="Market scope" value={run.intent.market} />
      </div>
      <h3>Data Septon will retrieve for this capability</h3>
      <div className="tag-row">
        {run.contextBundle.capability.requiredContext.map((type) => (
            <span key={type}>{formatLabel(type)}</span>
        ))}
      </div>
      <div className="routing-note">
        <LockKeyhole size={16} />
        <span>
          Context Intent converts the natural-language question into structured business intent for the Decision Engine.
        </span>
      </div>
    </section>
  );
}

function intentSummary(run: SeptonRun): string {
  if (run.intent.capabilityId === "inventory_optimization") {
    return "This is an inventory optimization decision.";
  }

  return "This is a root cause analysis decision.";
}

function intentExplanation(run: SeptonRun): string {
  if (run.intent.capabilityId === "inventory_optimization") {
    return "Septon will look for inventory position, demand signals, promotion timing, and transfer constraints before recommending what stock to move.";
  }

  return "Septon will look for KPI movement, operational incidents, supplier issues, campaign changes, and supporting notes before recommending what action to approve.";
}

function capabilityLabel(capabilityId: CapabilityId): string {
  return capabilityChoices.find((capability) => capability.id === capabilityId)?.label ?? formatLabel(capabilityId);
}

function createRunSnapshot(run: SeptonRun): RunSnapshot {
  return {
    runId: run.evidence.id,
    stage: run.contextBundle.currentRunStage,
    learningMode: run.contextBundle.learningMode,
    vectorHitIds: run.contextBundle.vectorHits.map((hit) => hit.record.id),
    liveDataIds: run.contextBundle.liveData.map((record) => record.id),
    graphPathIds: run.contextBundle.graphPaths.map((path) => path.explanation),
    retrievalHintIds: run.contextBundle.appliedRetrievalHints.map((hint) => hint.id),
    decisionPatternIds: run.contextBundle.appliedDecisionPatterns.map((pattern) => pattern.id),
    memoryPatternIds: run.memorySnapshot.decisionPatterns.map((pattern) => pattern.id),
  };
}

function appendRunSnapshot(history: CapabilityRunHistory, run: SeptonRun): CapabilityRunHistory {
  const snapshots = history[run.intent.capabilityId] ?? [];
  return {
    ...history,
    [run.intent.capabilityId]: [...snapshots, createRunSnapshot(run)],
  };
}

function replaceLatestRunSnapshot(history: CapabilityRunHistory, run: SeptonRun): CapabilityRunHistory {
  const snapshots = history[run.intent.capabilityId] ?? [];
  if (snapshots.length === 0) {
    return appendRunSnapshot(history, run);
  }

  return {
    ...history,
    [run.intent.capabilityId]: [...snapshots.slice(0, -1), createRunSnapshot(run)],
  };
}

function getRunChangeSnapshot(run: SeptonRun, history: CapabilityRunHistory): RunChangeSnapshot {
  const snapshots = history[run.intent.capabilityId] ?? [];
  const current = createRunSnapshot(run);
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const currentVectorTitles = run.contextBundle.vectorHits.map((hit) => hit.record.title);
  const previousVectorIds = new Set(previous?.vectorHitIds ?? []);
  const currentVectorIds = new Set(current.vectorHitIds);
  const addedHits = run.contextBundle.vectorHits.filter((hit) => !previousVectorIds.has(hit.record.id)).map((hit) => hit.record.title);
  const retainedHits = run.contextBundle.vectorHits.filter((hit) => previousVectorIds.has(hit.record.id)).map((hit) => hit.record.title);
  const retrievalDrivenItems = run.contextBundle.appliedRetrievalHints.flatMap((hint) => [
    ...hint.prioritizedContextTypes.map((type) => `${formatLabel(type)} signals`),
    ...hint.boostedEntities.map((entity) => `${entity} evidence`),
  ]);
  const patternDrivenItems = run.contextBundle.appliedDecisionPatterns.map((pattern) => pattern.title);
  const previousMemoryIds = new Set(previous?.memoryPatternIds ?? []);
  const memoryReuseItems = run.memorySnapshot.decisionPatterns
    .filter((pattern) => current.learningMode === "retrieval_memory" && previousMemoryIds.has(pattern.id))
    .map((pattern) => pattern.title);

  let summary = "Baseline context. No previous run exists for comparison yet.";
  if (run.contextBundle.currentRunStage === 2) {
    summary = `This run elevated ${listOrFallback(retrievalDrivenItems, "the operational signals")} because the previous approved decision showed they mattered.`;
  } else if (run.contextBundle.currentRunStage === 3) {
    summary = `This run changed the context again and added pattern influence from ${listOrFallback(patternDrivenItems, "the learned playbook")}.`;
  } else if (run.contextBundle.currentRunStage === 4) {
    summary = `This run reused enterprise memory from run 3 and refreshed ${listOrFallback(addedHits, "the latest operational context")}.`;
  } else if (previous) {
    summary = `This run retained ${retainedHits.length} prior evidence item${retainedHits.length === 1 ? "" : "s"} and added ${addedHits.length} new one${addedHits.length === 1 ? "" : "s"}.`;
  }

  return {
    summary,
    addedContextTitles: addedHits,
    retainedContextTitles: retainedHits,
    retrievalDrivenItems,
    patternDrivenItems,
    memoryReuseItems,
  };
}

function buildCompactContextSummary(
  run: SeptonRun,
  sapLiveRecord?: SeptonRun["contextBundle"]["liveData"][number],
): string {
  const liveRecords = run.contextBundle.liveData.length;
  const vectorHits = run.contextBundle.vectorHits.length;
  const graphPaths = run.contextBundle.graphPaths.length;
  const sapNote = sapLiveRecord ? "SAP inventory is included." : "No SAP inventory record matched this run.";

  return `${liveRecords} live checks, ${vectorHits} selected evidence items, and ${graphPaths} graph links are bundled. ${sapNote}`;
}

function retrievalLearningBusinessSummary(run: SeptonRun, changeSnapshot: RunChangeSnapshot | null): string {
  if (run.contextBundle.currentRunStage === 1) {
    return "This run used the baseline context bundle with no learned retrieval adjustments yet.";
  }
  return changeSnapshot?.summary ?? retrievalLearningSummary(run.contextBundle.currentRunStage, run.contextBundle.learningMode);
}

function retrievalLearningReasonSummary(run: SeptonRun, changeSnapshot: RunChangeSnapshot | null): string {
  const prioritized = changeSnapshot?.retrievalDrivenItems ?? [];
  if (prioritized.length === 0) {
    return "Septon is still using the baseline retrieval logic because no approved retrieval hints have been applied yet.";
  }
  return `Septon changed the bundle because prior approved decisions showed that ${listOrFallback(prioritized, "these signals")} were useful to explain or prevent the business outcome.`;
}

function retrievalLearningNextSummary(run: SeptonRun, changeSnapshot: RunChangeSnapshot | null): string {
  const nextItems = changeSnapshot?.retrievalDrivenItems ?? [];
  if (run.contextBundle.currentRunStage === 4) {
    return `Septon is now carrying forward ${listOrFallback(nextItems, "the learned context priorities")} together with stored enterprise memory.`;
  }
  return `Septon will keep prioritizing ${listOrFallback(nextItems, "the strongest validated context")} on the next run.`;
}

function patternLearningWhatSummary(run: SeptonRun | null, status: PatternLearningStatus): string {
  if (!run || status.currentRunStage === 1) {
    return "No approved decision has been learned into a reusable playbook yet.";
  }
  if (status.currentRunStage === 2) {
    return "Septon is collecting approved evidence to determine which actions and guardrails should become reusable patterns.";
  }
  return `Septon learned a reusable playbook from approved evidence for ${run.intent.capabilityName}.`;
}

function patternLearningWriteSummary(run: SeptonRun | null, status: PatternLearningStatus): string {
  if (!run || !status.memoryAvailable) {
    return "No enterprise-memory write-back has happened yet for this capability.";
  }
  if (status.currentRunStage === 3) {
    return `This run wrote ${listOrFallback(run.memorySnapshot.decisionPatterns.map((pattern) => pattern.title), "a learned playbook")} into curated enterprise memory.`;
  }
  return `Enterprise memory already contains ${listOrFallback(run.memorySnapshot.decisionPatterns.map((pattern) => pattern.title), "the stored playbook")} from the earlier approved run.`;
}

function patternLearningReuseSummary(run: SeptonRun | null, status: PatternLearningStatus): string {
  if (!run || !status.memoryAvailable) {
    return "Nothing is being reused yet because no approved enterprise-memory pattern is available.";
  }
  if (run.contextBundle.currentRunStage === 4) {
    return `This run reused ${listOrFallback(run.memorySnapshot.decisionPatterns.map((pattern) => pattern.title), "the stored playbook")} from run 3.`;
  }
  return "The newly stored pattern is ready to be reused on the next run.";
}

function listOrFallback(items: string[], fallback: string): string {
  const unique = Array.from(new Set(items)).filter(Boolean);
  if (unique.length === 0) return fallback;
  return unique.slice(0, 3).join(", ");
}

function contextModeLabel(mode: SeptonRun["contextBundle"]["learningMode"]): string {
  if (mode === "retrieval") return "retrieval learning";
  if (mode === "retrieval_pattern") return "retrieval learning + pattern learning";
  if (mode === "retrieval_memory") return "retrieval learning + enterprise memory";
  return "baseline";
}

function retrievalLearningSummary(stage: number, mode: SeptonRun["contextBundle"]["learningMode"]): string {
  if (stage === 1) return "Run 1 baseline context";
  if (stage === 2) return "Run 2 changed the context bundle using retrieval learning";
  if (stage === 3) return "Run 3 changed the context again and activated pattern learning";
  return `Run 4 changed the context again using ${contextModeLabel(mode)}`;
}

function ContextPanel({ run }: { run: SeptonRun }) {
  const topContextScore = Math.max(...run.contextBundle.vectorHits.map((hit) => hit.score), 0);
  const appliedHints = run.contextBundle.appliedRetrievalHints;
  const appliedPatterns = run.contextBundle.appliedDecisionPatterns;

  return (
    <section className="panel context-panel">
      <div className="panel-heading">
        <FileSearch size={18} />
        <h2>Context Engine</h2>
      </div>
      <div className="trace">
        {run.contextBundle.retrievalTrace.map((item) => (
          <div key={item}>
            <BadgeCheck size={15} />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="approval-status approved">
        <strong>Run {run.contextBundle.currentRunStage}</strong>
        <span>
          {run.contextBundle.contextChanged
            ? `Context changed using ${contextModeLabel(run.contextBundle.learningMode)}.`
            : "Baseline context in use."}
        </span>
      </div>
      <h3>Context used by Septon</h3>
      <div className="hit-list">
        {run.contextBundle.vectorHits.map((hit) => (
          <ContextHitRow hit={hit} key={hit.record.id} topScore={topContextScore} />
        ))}
      </div>
      <NestedDetailSection
        title="What Context Engine reuses from learning"
        summary={
          appliedHints.length > 0 || appliedPatterns.length > 0
            ? `${appliedHints.length} retrieval hint${appliedHints.length === 1 ? "" : "s"} and ${appliedPatterns.length} pattern${appliedPatterns.length === 1 ? "" : "s"} applied in this run`
            : "No approved retrieval hints or patterns were applied in this run"
        }
      >
        <AppliedLearningView hints={appliedHints} patterns={appliedPatterns} />
      </NestedDetailSection>
      <h3>Graph search used by Context Engine</h3>
      <GraphPanel paths={run.contextBundle.graphPaths} />
    </section>
  );
}

function contextMatchLabel(matchPercent: number): string {
  if (matchPercent >= 90) return "High match";
  if (matchPercent >= 70) return "Good match";
  if (matchPercent >= 50) return "Supporting context";
  return "Low match";
}

function ContextHitRow({ hit, topScore }: { hit: ContextHit; topScore: number }) {
  const matchPercent = topScore > 0 ? Math.round((hit.score / topScore) * 100) : 0;

  return (
    <article className="hit-row">
      <div>
        <strong>{hit.record.title}</strong>
        <p>
          {hit.record.source} · {formatLabel(hit.record.type)} · {hit.reasons.join(", ")}
        </p>
      </div>
      <div className="context-match">
        <strong>{matchPercent}%</strong>
        <span>{contextMatchLabel(matchPercent)}</span>
      </div>
    </article>
  );
}

function GraphPanel({ paths }: { paths: GraphPath[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedPaths = paths.slice(0, 4);
  const selectedNodeCount = new Set(selectedPaths.flatMap((path) => path.path.map((node) => node.id))).size;

  return (
    <section className="panel">
      <div className="panel-heading">
        <GitBranch size={18} />
        <h2>Graph Search</h2>
      </div>
      <div className="graph-summary">
        <p className="eyebrow">Selected for decision engine</p>
        <strong>
          {selectedPaths.length} relationship paths across {selectedNodeCount} business entities
        </strong>
        <span>
          Septon used these graph relationships to connect the question, KPI movement, incidents, campaigns, and
          operational signals before creating the recommendation.
        </span>
      </div>
      <button type="button" className="graph-toggle" onClick={() => setIsExpanded((value) => !value)}>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {isExpanded ? "Hide selected graph" : "Show selected nodes and edges"}
      </button>
      {isExpanded && (
        <div className="graph-viz">
          {selectedPaths.map((path) => (
            <article className="graph-path" key={path.explanation}>
              <div className="graph-chain" aria-label="Selected graph path">
                {path.path.slice(0, 5).map((node, index) => (
                  <span className="graph-node-wrap" key={node.id}>
                    <span className="graph-node">{node.label}</span>
                    {index < Math.min(path.path.length, 5) - 1 && <span aria-hidden="true">→</span>}
                  </span>
                ))}
              </div>
              <p>{path.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EvidencePanel({ run, evidenceStoreState }: { run: SeptonRun; evidenceStoreState: EvidenceStoreState }) {
  const isStored = run.evidence.storageStatus === "stored";
  const passedConfidenceRules = run.evidence.confidenceRules.filter((rule) => rule.passed);
  const latestStored = evidenceStoreState.storedEvidence.slice(0, 4);
  const status = getPatternStatus(evidenceStoreState, run.intent.capabilityId);
  const statusText =
    run.evidence.approvalStatus === "rejected"
      ? "Rejected. The evidence package is stored and now drives negative learning for later runs."
      : isStored
        ? "Stored after admin approval."
        : "Not stored yet. Admin approval is required first.";

  return (
    <section className="panel">
      <div className="panel-heading">
        <ShieldCheck size={18} />
        <h2>Decision Evidence Store</h2>
      </div>
      <div className={isStored ? "evidence-id stored" : "evidence-id pending"}>
        <span>{isStored ? "Evidence package" : "Storage status"}</span>
        <strong>{isStored ? run.evidence.id : "Not stored yet"}</strong>
      </div>
      <p className="storage-note">{statusText}</p>
      <div className="field-grid">
        <Metric icon={<Database size={17} />} label="Context used" value={run.evidence.contextUsed.length} />
        <Metric icon={<FileSearch size={17} />} label="Reasoning steps" value={run.evidence.reasoningTrace.length} />
        <Metric icon={<BadgeCheck size={17} />} label="Approval" value={formatLabel(run.evidence.approvalStatus)} />
      </div>
      <div className="field-grid compact-grid">
        <Metric icon={<Database size={17} />} label="Stored total" value={evidenceStoreState.storedCounts.total} />
        <Metric icon={<BadgeCheck size={17} />} label="Approved stored" value={evidenceStoreState.storedCounts.approved} />
        <Metric icon={<LockKeyhole size={17} />} label="Rejected stored" value={evidenceStoreState.storedCounts.rejected} />
      </div>
      <div className="threshold-box">
        <span>Run progression for {run.intent.capabilityName}</span>
        <strong>Run {status.currentRunStage} of 4</strong>
        <small>{patternSummary(status)}</small>
      </div>
      {run.evidence.reviewedBy && run.evidence.reviewedAt && (
        <div className="review-note">
          <span>Reviewed by {run.evidence.reviewedBy}</span>
          <span>{new Date(run.evidence.reviewedAt).toLocaleString()}</span>
        </div>
      )}
      <h3>Reasoning trace</h3>
      <ol className="number-list">
        {run.evidence.reasoningTrace.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <h3>Why Septon is confident</h3>
      <p className="section-note">
        {passedConfidenceRules.length > 0
          ? "These checks explain why the recommendation is backed by strong evidence."
          : "No confidence drivers passed for this recommendation."}
      </p>
      <div className="rule-list">
        {run.evidence.confidenceRules.map((rule) => {
          const confidenceDriver = describeConfidenceRule(rule);
          return (
            <article className={rule.passed ? "rule-row passed" : "rule-row"} key={rule.metric}>
              <strong>{confidenceDriver.title}</strong>
              <p>{confidenceDriver.explanation}</p>
            </article>
          );
        })}
      </div>
      <h3>Stored evidence history</h3>
      <div className="rule-list">
        {latestStored.map((evidence) => (
          <article className="rule-row" key={evidence.id}>
            <strong>{evidence.id}</strong>
            <p>
              {formatLabel(evidence.capabilityId)} · {formatLabel(evidence.approvalStatus)} ·{" "}
              {new Date(evidence.createdAt).toLocaleTimeString()}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function describeConfidenceRule(rule: SeptonRun["evidence"]["confidenceRules"][number]): {
  title: string;
  explanation: string;
} {
  switch (rule.metric) {
    case "marketSalesDeclinePercentage":
      return {
        title: "Severe decline detected in the impacted market",
        explanation: `The market declined ${Math.abs(rule.actualValue)}%, which is beyond the ${Math.abs(rule.threshold)}% severity threshold.`,
      };
    case "nationalDeclineContributionPercentage":
      return {
        title: "This market is a major driver of the national decline",
        explanation: `${rule.actualValue}% of the national decline comes from this market, above the ${rule.threshold}% materiality threshold.`,
      };
    case "supportingSourceCount":
      return {
        title: "Multiple enterprise systems support the explanation",
        explanation: `${rule.actualValue} enterprise systems contributed evidence, meeting the minimum requirement of ${rule.threshold}.`,
      };
    case "freshLiveRecordCount":
      return {
        title: "Fresh live operational data is available",
        explanation: `${rule.actualValue} live records were pulled into the decision, above the minimum freshness threshold of ${rule.threshold}.`,
      };
    default:
      return {
        title: rule.description,
        explanation: `${rule.actualValue} ${rule.operator} ${rule.threshold}`,
      };
  }
}

function LearningPanel({
  run,
  evidenceStoreState,
  mode,
}: {
  run: SeptonRun;
  evidenceStoreState: EvidenceStoreState;
  mode: "context" | "pattern";
}) {
  const canLearn = run.contextBundle.currentRunStage > 1 || run.evidence.approvalStatus === "approved";
  const serviceName = mode === "context" ? "Context Retrieval Learning" : "Pattern Learning Service";
  const signals = run.learningSignals.filter((signal) => signal.service === serviceName);
  const lockedText =
    mode === "context"
      ? "Context retrieval learning becomes more active on each stored run."
      : "Pattern learning becomes visible on run 3, and run 4 reuses enterprise memory from run 3.";
  const patternStatus = getPatternStatus(evidenceStoreState, run.intent.capabilityId);

  return (
    <section className="panel">
      <div className="panel-heading">
        <RefreshCcw size={18} />
        <h2>{serviceName}</h2>
      </div>
      {canLearn ? (
        mode === "context" ? (
          <ContextRetrievalLearningView evidenceId={run.evidence.id} hints={run.retrievalHints} signals={signals} run={run} />
        ) : (
          <PatternLearningView
            evidenceId={run.evidence.id}
            patterns={run.patternArtifacts}
            patternStatus={patternStatus}
            signals={signals}
          />
        )
      ) : (
        <div className="learning-locked">
          <LockKeyhole size={18} />
          <div>
            <strong>Learning is paused</strong>
            <p>{lockedText}</p>
          </div>
        </div>
      )}
      {mode === "pattern" && (
        <>
          <h3>What Septon is learning from this decision</h3>
          <div className="action-list">
            {run.recommendation.actions.map((action) => (
              <article key={action.action}>
                <strong>{action.action}</strong>
                <p>
                  {action.owner} · {action.timing} · {action.expectedEffect}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function groupNodesByType(nodes: GraphNode[]): Array<{ type: string; nodes: GraphNode[] }> {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const groupedNodes = groups.get(node.type) ?? [];
    groupedNodes.push(node);
    groups.set(node.type, groupedNodes);
  }

  return Array.from(groups.entries()).map(([type, groupedNodes]) => ({ type, nodes: groupedNodes }));
}

function SemanticDocumentGraph({ documents }: { documents: VectorDocument[] }) {
  return (
    <div className="semantic-graph">
      {documents.map((document) => (
        <article className="semantic-card" key={document.id}>
          <span>{document.source}</span>
          <strong>{document.title}</strong>
          <small>{formatLabel(document.contextType)}</small>
        </article>
      ))}
    </div>
  );
}

function GraphNodeMatrix({ groups }: { groups: Array<{ type: string; nodes: GraphNode[] }> }) {
  return (
    <div className="node-matrix">
      {groups.map((group) => (
        <section className="node-cluster" key={group.type}>
          <h4>{formatLabel(group.type)}</h4>
          <div className="node-chip-list">
            {group.nodes.map((node) => (
              <div className="node-chip" key={node.id}>
                <strong>{node.label}</strong>
                <small>{node.id}</small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GraphEdgeFlow({ edges, nodes }: { edges: GraphEdge[]; nodes: GraphNode[] }) {
  const nodeLabels = new Map(nodes.map((node) => [node.id, node.label] as const));

  return (
    <div className="edge-flow">
      {edges.map((edge) => (
        <article className="edge-link" key={`${edge.from}-${edge.to}-${edge.label}`}>
          <span>{nodeLabels.get(edge.from) ?? edge.from}</span>
          <strong>{edge.label}</strong>
          <span>{nodeLabels.get(edge.to) ?? edge.to}</span>
        </article>
      ))}
    </div>
  );
}

function MemoryLoopDiagram({ evidenceId, patterns }: { evidenceId: string; patterns: DecisionPattern[] }) {
  return (
    <div className="memory-loop">
      <div className="memory-loop-node">
        <span>Decision Evidence Store</span>
        <strong>{evidenceId}</strong>
      </div>
      <div className="memory-loop-arrow">→</div>
      <div className="memory-loop-node">
        <span>Pattern Learning Service</span>
        <strong>{patterns.length > 0 ? "Pattern extracted" : "Awaiting approval"}</strong>
      </div>
      <div className="memory-loop-arrow">→</div>
      <div className="memory-loop-node">
        <span>Curated Enterprise Memory</span>
        <strong>{patterns.length > 0 ? `${patterns.length} stored pattern` : "No pattern stored yet"}</strong>
      </div>
    </div>
  );
}

function DecisionPatternMemoryView({ patterns }: { patterns: DecisionPattern[] }) {
  if (patterns.length === 0) {
    return <div className="empty-detail">No approved decision patterns stored in enterprise memory yet.</div>;
  }

  const patternsByCapability = new Map<CapabilityId, DecisionPattern[]>();
  for (const pattern of patterns) {
    const groupedPatterns = patternsByCapability.get(pattern.capabilityId) ?? [];
    groupedPatterns.push(pattern);
    patternsByCapability.set(pattern.capabilityId, groupedPatterns);
  }

  return (
    <div className="pattern-memory-list">
      {Array.from(patternsByCapability.entries()).map(([capabilityId, capabilityPatterns]) => (
        <section className="pattern-capability-group" key={capabilityId}>
          <h4>{formatLabel(capabilityId)}</h4>
          {capabilityPatterns.map((pattern) => (
            <article className="pattern-card" key={pattern.id}>
              <div className="pattern-card-header">
                <span>{pattern.id}</span>
                <strong>{pattern.title}</strong>
              </div>
              <p>{pattern.recommendedReuse}</p>
              <div className="pattern-chip-row">
                {pattern.triggerConditions.map((condition) => (
                  <span key={condition}>{condition}</span>
                ))}
              </div>
              <small>{pattern.writeBackTarget}</small>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function AppliedLearningView({
  hints,
  patterns,
}: {
  hints: ContextRetrievalHint[];
  patterns: DecisionPattern[];
}) {
  if (hints.length === 0 && patterns.length === 0) {
    return <div className="empty-detail">No approved learning artifacts were reused by Context Engine in this run.</div>;
  }

  return (
    <div className="hint-list">
      {hints.map((hint) => (
        <article className="hint-card" key={hint.id}>
          <strong>{hint.futureUse}</strong>
          <p>{hint.explanation}</p>
          <div className="hint-columns">
            <div>
              <span>Applied context boosts</span>
              <div className="pattern-chip-row">
                {hint.prioritizedContextTypes.map((type) => (
                  <span key={type}>{formatLabel(type)}</span>
                ))}
              </div>
            </div>
            <div>
              <span>Applied entity boosts</span>
              <div className="pattern-chip-row">
                {hint.boostedEntities.map((entity) => (
                  <span key={entity}>{entity}</span>
                ))}
              </div>
            </div>
            <div>
              <span>Deprioritized context</span>
              <div className="pattern-chip-row">
                {hint.deprioritizedContextTypes.map((type) => (
                  <span key={type}>{formatLabel(type)}</span>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
      {patterns.map((pattern) => (
        <article className="pattern-card" key={pattern.id}>
          <div className="pattern-card-header">
            <span>{pattern.id}</span>
            <strong>{pattern.title}</strong>
          </div>
          <p>{pattern.recommendedReuse}</p>
          <div className="pattern-chip-row">
            {pattern.triggerConditions.map((condition) => (
              <span key={condition}>{condition}</span>
            ))}
          </div>
          <small>Applied as pattern match boost in this run</small>
        </article>
      ))}
    </div>
  );
}

function RetrievalHintView({ hints }: { hints: ContextRetrievalHint[] }) {
  if (hints.length === 0) {
    return <div className="empty-detail">No approved retrieval hints are available for Context Engine reuse yet.</div>;
  }

  return (
    <div className="hint-list">
      {hints.map((hint) => (
        <article className="hint-card" key={hint.id}>
          <strong>{hint.futureUse}</strong>
          <p>{hint.explanation}</p>
          <div className="hint-columns">
            <div>
              <span>Boosted context</span>
              <div className="pattern-chip-row">
                {hint.prioritizedContextTypes.map((type) => (
                  <span key={type}>{formatLabel(type)}</span>
                ))}
              </div>
            </div>
            <div>
              <span>Boosted entities</span>
              <div className="pattern-chip-row">
                {hint.boostedEntities.map((entity) => (
                  <span key={entity}>{entity}</span>
                ))}
              </div>
            </div>
            <div>
              <span>Deprioritized context</span>
              <div className="pattern-chip-row">
                {hint.deprioritizedContextTypes.map((type) => (
                  <span key={type}>{formatLabel(type)}</span>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ContextRetrievalLearningView({
  evidenceId,
  hints,
  signals,
  run,
}: {
  evidenceId: string;
  hints: ContextRetrievalHint[];
  signals: SeptonRun["learningSignals"];
  run: SeptonRun;
}) {
  return (
    <div className="learning-graph">
      <div className="learning-stage">
        <span>Evidence in</span>
        <strong>{evidenceId}</strong>
      </div>
      <div className="learning-stage">
        <span>What changed in context</span>
        <strong>{run.contextBundle.contextChanged ? contextModeLabel(run.contextBundle.learningMode) : "Baseline"}</strong>
      </div>
      <div className="learning-stage">
        <span>Reused by Context Engine</span>
        <strong>{run.contextBundle.contextChanged ? `Run ${run.contextBundle.currentRunStage} context updated` : "No retrieval reuse yet"}</strong>
      </div>
      {signals.map((signal) => (
        <article className="learning-card" key={signal.service}>
          <strong>{signal.update}</strong>
          <small>{signal.effect}</small>
        </article>
      ))}
      <RetrievalHintView hints={hints} />
    </div>
  );
}

function PatternLearningView({
  evidenceId,
  patterns,
  patternStatus,
  signals,
}: {
  evidenceId: string;
  patterns: DecisionPattern[];
  patternStatus: PatternLearningStatus;
  signals: SeptonRun["learningSignals"];
}) {
  return (
    <div className="learning-graph">
      <div className="learning-stage">
        <span>Evidence in</span>
        <strong>{evidenceId}</strong>
      </div>
      <div className="learning-stage">
        <span>Stored decisions observed</span>
        <strong>
          {patternStatus.storedObserved} / 4
        </strong>
      </div>
      <div className="learning-stage">
        <span>Eligible approved decisions</span>
        <strong>{patternStatus.eligibleApprovedCount}</strong>
      </div>
      <div className="learning-stage">
        <span>Enterprise memory</span>
        <strong>
          {patternStatus.memoryAvailable
            ? patternStatus.currentRunStage === 4
              ? `Reused from ${patternStatus.selectedEvidenceId ?? evidenceId}`
              : `Written from ${patternStatus.selectedEvidenceId ?? evidenceId}`
            : patternStatus.state === "no_promotable_approval"
              ? "No approved decision available"
              : "Not written yet"}
        </strong>
      </div>
      {signals.map((signal) => (
        <article className="learning-card" key={signal.service}>
          <strong>{signal.update}</strong>
          <small>{signal.effect}</small>
        </article>
      ))}
      <div className="learning-status-bar">
        <strong>{patternSummary(patternStatus)}</strong>
        {patternStatus.promotedPatternId && <small>Promoted pattern: {patternStatus.promotedPatternId}</small>}
      </div>
      <DecisionPatternMemoryView patterns={patterns} />
    </div>
  );
}

function buildMemoryGraphUpdateView(
  patterns: DecisionPattern[],
  negativePatterns: NegativeDecisionPattern[],
): {
  nodes: MemoryGraphNodeCandidate[];
  edges: MemoryGraphEdgeCandidate[];
} {
  if (patterns.length === 0 && negativePatterns.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: MemoryGraphNodeCandidate[] = [];
  const edges: MemoryGraphEdgeCandidate[] = [];

  for (const pattern of patterns) {
    const capabilityNodeId = `capability:${pattern.capabilityId}`;
    const patternNodeId = `pattern:${pattern.id}`;
    nodes.push({ id: capabilityNodeId, label: capabilityLabel(pattern.capabilityId), kind: "capability" });
    nodes.push({ id: patternNodeId, label: pattern.title, kind: "pattern" });
    edges.push({ from: capabilityNodeId, label: "stores", to: patternNodeId });

    for (const evidenceId of pattern.supportingEvidenceIds) {
      const evidenceNodeId = `evidence:${evidenceId}`;
      nodes.push({ id: evidenceNodeId, label: evidenceId, kind: "evidence" });
      edges.push({ from: patternNodeId, label: "supported by", to: evidenceNodeId });
    }

    for (const condition of pattern.triggerConditions) {
      const conditionNodeId = `condition:${pattern.id}:${condition}`;
      nodes.push({ id: conditionNodeId, label: condition, kind: "trigger" });
      edges.push({ from: patternNodeId, label: "triggered by", to: conditionNodeId });
    }

    const targetNodeId = `target:${pattern.id}`;
    nodes.push({ id: targetNodeId, label: pattern.writeBackTarget, kind: "memory target" });
    edges.push({ from: patternNodeId, label: "writes to", to: targetNodeId });
  }

  for (const pattern of negativePatterns) {
    const capabilityNodeId = `capability:${pattern.capabilityId}`;
    const patternNodeId = `rejected-pattern:${pattern.id}`;
    nodes.push({ id: capabilityNodeId, label: capabilityLabel(pattern.capabilityId), kind: "capability" });
    nodes.push({ id: patternNodeId, label: pattern.title, kind: "rejected pattern" });
    edges.push({ from: capabilityNodeId, label: "blocks via", to: patternNodeId });

    for (const evidenceId of pattern.supportingEvidenceIds) {
      const evidenceNodeId = `evidence:${evidenceId}`;
      nodes.push({ id: evidenceNodeId, label: evidenceId, kind: "evidence" });
      edges.push({ from: patternNodeId, label: "rejected by", to: evidenceNodeId });
    }

    for (const condition of pattern.rejectedConditions) {
      const conditionNodeId = `rejected-condition:${pattern.id}:${condition}`;
      nodes.push({ id: conditionNodeId, label: condition, kind: "rejected condition" });
      edges.push({ from: patternNodeId, label: "blocks when", to: conditionNodeId });
    }

    const targetNodeId = `rejected-target:${pattern.id}`;
    nodes.push({ id: targetNodeId, label: pattern.writeBackTarget, kind: "memory target" });
    edges.push({ from: patternNodeId, label: "writes to", to: targetNodeId });
  }

  return {
    nodes: Array.from(new Map(nodes.map((node) => [node.id, node])).values()),
    edges,
  };
}

function MemoryGraphView({
  patterns,
  negativePatterns,
}: {
  patterns: DecisionPattern[];
  negativePatterns: NegativeDecisionPattern[];
}) {
  const graph = buildMemoryGraphUpdateView(patterns, negativePatterns);

  if (graph.nodes.length === 0) {
    return <div className="empty-detail">No derived memory graph updates are available yet.</div>;
  }

  return (
    <div className="memory-graph-view">
      <div className="memory-graph-note">Derived memory update view. This prototype is not mutating the underlying knowledge graph database.</div>
      <div className="debug-card-list">
        <article className="debug-card">
          <strong>New memory node candidates</strong>
          <div className="debug-chip-list">
            {graph.nodes.map((node) => (
              <span key={node.id}>{node.kind}: {node.label}</span>
            ))}
          </div>
        </article>
        <article className="debug-card">
          <strong>New memory relationship candidates</strong>
          <div className="memory-edge-list">
            {graph.edges.map((edge) => (
              <div className="memory-edge-row" key={`${edge.from}-${edge.label}-${edge.to}`}>
                <span>{graph.nodes.find((node) => node.id === edge.from)?.label ?? edge.from}</span>
                <strong>{edge.label}</strong>
                <span>{graph.nodes.find((node) => node.id === edge.to)?.label ?? edge.to}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

function getPatternStatus(evidenceStoreState: EvidenceStoreState, capabilityId: CapabilityId): PatternLearningStatus {
  return (
    evidenceStoreState.patternLearningStatusByCapability[capabilityId] ?? {
      capabilityId,
      storedObserved: 0,
      eligibleApprovedCount: 0,
      rejectedStoredCount: 0,
      currentRunStage: 1,
      learningMode: "none",
      memoryAvailable: false,
      negativeMemoryAvailable: false,
      memoryReusedNextRun: false,
      state: "baseline",
    }
  );
}

function patternSummary(status: PatternLearningStatus): string {
  if (status.state === "no_promotable_approval") {
    return `Run ${status.currentRunStage}: no approved decision is available for reusable memory`;
  }
  if (status.currentRunStage === 1) {
    return "Run 1 baseline";
  }
  if (status.currentRunStage === 2) {
    return "Run 2 will change the context bundle using retrieval learning";
  }
  if (status.currentRunStage === 3) {
    return status.memoryAvailable
      ? `Run 3 writes enterprise memory from ${status.selectedEvidenceId ?? status.rejectedPatternId}`
      : "Run 3 activates pattern learning";
  }
  if (status.memoryAvailable) {
    return status.negativeMemoryAvailable
      ? `Run 4 reuses rejection constraints from ${status.rejectedPatternId ?? status.selectedEvidenceId}`
      : `Run 4 reuses enterprise memory from ${status.selectedEvidenceId}`;
  }
  return "Run 4 changes context again and reuses any stored memory if available";
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="metric">
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
