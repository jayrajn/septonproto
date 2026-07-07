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

export function App() {
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [question, setQuestion] = useState("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<CapabilityId | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [run, setRun] = useState<SeptonRun | null>(null);
  const [evidenceStoreState, setEvidenceStoreState] = useState<EvidenceStoreState>(() => createEmptyEvidenceStoreState());
  const [learningState, setLearningState] = useState<LearningState>(() => createEmptyLearningState());
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
    setRun(runSepton(question, selectedCapabilityId, learningState));
    setRunCount((count) => count + 1);
  }

  function approveRecommendation() {
    if (!run) return;
    const approvedEvidence = approveEvidencePackage(run.evidence);
    const learningArtifacts = storeDecisionOutcome(approvedEvidence, run.knowledgeBase, learningState, evidenceStoreState);
    setLearningState(learningArtifacts.learningState);
    setEvidenceStoreState(learningArtifacts.evidenceStoreState);
    setRun({
      ...run,
      evidence: approvedEvidence,
      learningSignals: learningArtifacts.learningSignals,
      patternArtifacts: learningArtifacts.patternArtifacts,
      retrievalHints: learningArtifacts.retrievalHints,
      memorySnapshot: learningArtifacts.memorySnapshot,
    });
  }

  function rejectRecommendation() {
    if (!run) return;
    const rejectedEvidence = rejectEvidencePackage(run.evidence);
    const learningArtifacts = storeDecisionOutcome(rejectedEvidence, run.knowledgeBase, learningState, evidenceStoreState);
    setLearningState(learningArtifacts.learningState);
    setEvidenceStoreState(learningArtifacts.evidenceStoreState);
    setRun({
      ...run,
      evidence: rejectedEvidence,
      learningSignals: learningArtifacts.learningSignals,
      patternArtifacts: learningArtifacts.patternArtifacts,
      retrievalHints: learningArtifacts.retrievalHints,
      memorySnapshot: learningArtifacts.memorySnapshot,
    });
  }

  function resetDecision() {
    setQuestion("");
    setSelectedCapabilityId(null);
    setRun(null);
    setRunCount(0);
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

      <section className="ask-surface">
        <div className="question-box">
          <div className="step-label">Step 1</div>
          <label>Select a capability</label>
          <div className="capability-row">
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
          <div className="step-label">Step 2</div>
          <label htmlFor="coo-question">Ask Septon</label>
          <textarea
            id="coo-question"
            ref={questionInputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div className="question-actions">
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
        <TopEvidenceStoreSummary evidenceStoreState={evidenceStoreState} selectedCapabilityId={selectedCapabilityId} />
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
      </section>

      {run && <RuntimeFlow key={run.evidence.id} run={run} evidenceStoreState={evidenceStoreState} />}
    </main>
  );
}

function RuntimeFlow({ run, evidenceStoreState }: { run: SeptonRun; evidenceStoreState: EvidenceStoreState }) {
  const activePatternStatus = getPatternStatus(evidenceStoreState, run.intent.capabilityId);
  const canLearnContext = run.evidence.approvalStatus === "approved";

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
        summary={`${run.contextBundle.vectorHits.length} ranked context items selected and ${run.retrievalHints.length} learned retrieval hints available`}
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
        summary={canLearnContext ? "Retrieval learning enabled from approved evidence" : "Retrieval learning paused until approval"}
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
    <section className="answer-panel empty-state">
      <div className="panel-heading">
        <Sparkles size={18} />
        <h2>Ready when configured</h2>
      </div>
      <p className="headline">
        {selectedCapability
          ? `${selectedCapability} is selected. Review the question, then run the decision.`
          : "Select a capability first, then run a decision."}
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
    <section className="answer-panel">
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
      <h3>{run.intent.capabilityId === "inventory_optimization" ? "Inventory factors" : "Root cause contributors"}</h3>
      <div className="root-cause-list">
        {run.recommendation.rootCauses.slice(0, 3).map((cause) => (
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
      <h3>{run.intent.capabilityId === "inventory_optimization" ? "Inventory optimization plan" : "Preventive actions and guardrails"}</h3>
      <ul className="check-list">
        {run.recommendation.augustPromotionGuardrails.map((item) => (
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
  if (status === "approved") return "Evidence is stored. Retrieval learning is enabled, and pattern promotion depends on evidence-store threshold.";
  if (status === "rejected") return "Evidence is stored for audit, but rejected outcomes do not create retrieval hints or memory patterns.";
  return "Evidence is not stored until a human validates the recommendation.";
}

function TopEvidenceStoreSummary({
  evidenceStoreState,
  selectedCapabilityId,
}: {
  evidenceStoreState: EvidenceStoreState;
  selectedCapabilityId: CapabilityId | null;
}) {
  const activeStatus = selectedCapabilityId ? getPatternStatus(evidenceStoreState, selectedCapabilityId) : null;

  return (
    <section className="evidence-summary-panel">
      <div className="panel-heading">
        <ShieldCheck size={18} />
        <h2>Decision Evidence Store</h2>
      </div>
      <div className="field-grid compact-grid">
        <Metric icon={<Database size={17} />} label="Stored decisions" value={evidenceStoreState.storedCounts.total} />
        <Metric icon={<BadgeCheck size={17} />} label="Approved" value={evidenceStoreState.storedCounts.approved} />
        <Metric icon={<LockKeyhole size={17} />} label="Rejected" value={evidenceStoreState.storedCounts.rejected} />
      </div>
      <div className="threshold-box">
        <span>Pattern learning threshold</span>
        <strong>
          {evidenceStoreState.storedCounts.total} of {activeStatus?.threshold ?? 3} stored decisions
        </strong>
        <small>{activeStatus ? patternSummary(activeStatus) : "Select a capability to view pattern-learning status."}</small>
      </div>
      <div className="status-stack">
        {capabilityChoices.map((capability) => {
          const status = getPatternStatus(evidenceStoreState, capability.id);
          return (
            <article className="store-capability-status" key={capability.id}>
              <div>
                <strong>{capability.label}</strong>
                <p>{patternSummary(status)}</p>
              </div>
              <span className={status.promotedPatternId ? "status-pill promoted" : "status-pill"}>
                {status.promotedPatternId ? "Pattern promoted" : "Not promoted"}
              </span>
            </article>
          );
        })}
      </div>
    </section>
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
  const statusText =
    run.evidence.approvalStatus === "rejected"
      ? "Rejected. The evidence package is stored for audit, but it is not promotable for enterprise memory."
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
  const canLearn = run.evidence.approvalStatus === "approved";
  const serviceName = mode === "context" ? "Context Retrieval Learning" : "Pattern Learning Service";
  const signals = run.learningSignals.filter((signal) => signal.service === serviceName);
  const lockedText =
    mode === "context"
      ? "Context retrieval learning runs only after admin approval."
      : "Pattern learning waits for 3 stored decisions before promoting an approved pattern into enterprise memory.";
  const patternStatus = getPatternStatus(evidenceStoreState, run.intent.capabilityId);

  return (
    <section className="panel">
      <div className="panel-heading">
        <RefreshCcw size={18} />
        <h2>{serviceName}</h2>
      </div>
      {canLearn ? (
        mode === "context" ? (
          <ContextRetrievalLearningView evidenceId={run.evidence.id} hints={run.retrievalHints} signals={signals} />
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
          <h3>Recommended actions used for pattern learning</h3>
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
}: {
  evidenceId: string;
  hints: ContextRetrievalHint[];
  signals: SeptonRun["learningSignals"];
}) {
  return (
    <div className="learning-graph">
      <div className="learning-stage">
        <span>Evidence in</span>
        <strong>{evidenceId}</strong>
      </div>
      <div className="learning-stage">
        <span>Retrieval adjustments learned</span>
        <strong>{hints.length} hint{hints.length === 1 ? "" : "s"}</strong>
      </div>
      <div className="learning-stage">
        <span>Reused by Context Engine</span>
        <strong>{hints.length > 0 ? "Future retrieval boosted" : "Awaiting approval"}</strong>
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
          {patternStatus.storedObserved} / {patternStatus.threshold}
        </strong>
      </div>
      <div className="learning-stage">
        <span>Eligible approved decisions</span>
        <strong>{patternStatus.eligibleApprovedCount}</strong>
      </div>
      <div className="learning-stage">
        <span>Memory write-back</span>
        <strong>
          {patterns.length > 0
            ? `Promoted from ${patternStatus.selectedEvidenceId ?? evidenceId}`
            : patternStatus.state === "no_promotable_approval"
              ? "Threshold reached, no approved decision available"
              : "Waiting for threshold"}
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

function getPatternStatus(evidenceStoreState: EvidenceStoreState, capabilityId: CapabilityId): PatternLearningStatus {
  return (
    evidenceStoreState.patternLearningStatusByCapability[capabilityId] ?? {
      capabilityId,
      storedObserved: evidenceStoreState.storedCounts.total,
      eligibleApprovedCount: 0,
      threshold: 3,
      thresholdReached: false,
      state: "waiting_for_threshold",
    }
  );
}

function patternSummary(status: PatternLearningStatus): string {
  if (!status.thresholdReached) {
    return `Waiting for threshold: ${status.storedObserved} of ${status.threshold} stored decisions`;
  }
  if (status.state === "no_promotable_approval") {
    return "Threshold reached, but no approved decision is available for promotion";
  }
  if (status.promotedPatternId) {
    return `Pattern promoted to enterprise memory from ${status.selectedEvidenceId}`;
  }
  return "Threshold reached. Next approved decision can be promoted to enterprise memory";
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
