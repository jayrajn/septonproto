import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Brain,
  CheckCircle2,
  CircleDot,
  Database,
  FileSearch,
  GitBranch,
  Layers3,
  LockKeyhole,
  Network,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { ContextHit, GraphPath, SeptonRun } from "../../../../packages/shared/src/domain/types";
import { runSepton } from "../../../../packages/shared/src/services/septonRuntime";

const defaultQuestion =
  "Why did sales in the U.S. decline last week, and what should we do to prevent this from happening in the future or for the next promotion in August?";
const inventoryQuestion =
  "How should we optimize egg patty inventory across Chicago stores before the August promotion?";

const sampleQuestions = [
  { label: "Root cause", question: defaultQuestion },
  { label: "Inventory optimization", question: inventoryQuestion },
];

const pipeline = [
  "Connectors",
  "Knowledge Processing",
  "Curated Memory",
  "Intent + Capability",
  "Context Engine",
  "Decision Engine",
  "Evidence Store",
  "Learning",
];

const architectureStatuses = [
  {
    layer: "Enterprise Systems",
    status: "Simulated",
    summary: "Mock SAP, BigQuery, Salesforce, ServiceNow, and SharePoint records drive the demo.",
  },
  {
    layer: "Enterprise Onboarding",
    status: "Not operating",
    summary: "Connector auth, permission setup, and sync policy setup are not modeled yet.",
  },
  {
    layer: "Platform Configuration",
    status: "Partial operation",
    summary: "Capability contracts exist; model registry, glossary, feature flags, and approvals are still placeholders.",
  },
  {
    layer: "Data Sync & Ingestion",
    status: "Simulated",
    summary: "Static records are returned with connector status, sync mode, freshness, and source counts.",
  },
  {
    layer: "Knowledge Processing",
    status: "Operating",
    summary: "Raw records become graph nodes, graph edges, and vector-searchable documents.",
  },
  {
    layer: "Curated Enterprise Memory",
    status: "Partial operation",
    summary: "The memory layer exists in runtime only; persistent facts, events, and learned patterns come next.",
  },
  {
    layer: "Live Data Access",
    status: "Simulated",
    summary: "Freshness-sensitive inventory, supplier, incident, and promotion records are selected from local data.",
  },
  {
    layer: "Context Engine",
    status: "Operating",
    summary: "Context bundles include semantic ranking, graph paths, live data, ignored context, and retrieval trace.",
  },
  {
    layer: "Context Intent",
    status: "Partial operation",
    summary: "Questions route to structured intent by simple rules; richer entity and timeframe extraction is still needed.",
  },
  {
    layer: "Decision Engine",
    status: "Partial operation",
    summary: "Recommendations are generated from retrieved context, with some scenario-specific logic still in place.",
  },
  {
    layer: "Consume",
    status: "Partial operation",
    summary: "The web workspace shows the decision flow; feedback capture and approvals are still missing.",
  },
  {
    layer: "Decision Evidence Store",
    status: "Operating",
    summary: "Each run creates an in-memory evidence package with context, reasoning, confidence, and outcome.",
  },
  {
    layer: "Learning Services",
    status: "Simulated",
    summary: "Retrieval and pattern learning are visible as signals but do not yet update future runs.",
  },
  {
    layer: "Governance & Control",
    status: "Partial operation",
    summary: "Confidence, lineage, audit, RBAC, and HITL are shown, but enforcement is mostly simulated.",
  },
];

const architectureKpis = [
  { status: "Operating", label: "Operating" },
  { status: "Partial operation", label: "Partial operation" },
  { status: "Simulated", label: "Simulated" },
  { status: "Not operating", label: "Not operating" },
];

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function App() {
  const [question, setQuestion] = useState(defaultQuestion);
  const [lastQuestion, setLastQuestion] = useState(defaultQuestion);
  const [runCount, setRunCount] = useState(1);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showHitlApproval, setShowHitlApproval] = useState(false);
  const run = useMemo(() => runSepton(lastQuestion), [lastQuestion, runCount]);

  function executeDecision() {
    setLastQuestion(question);
    setRunCount((count) => count + 1);
  }

  function resetDecision() {
    setQuestion(defaultQuestion);
    setLastQuestion(defaultQuestion);
    setRunCount((count) => count + 1);
  }

  function useSampleQuestion(nextQuestion: string) {
    setQuestion(nextQuestion);
    setLastQuestion(nextQuestion);
    setRunCount((count) => count + 1);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Septon working prototype</p>
          <h1>COO Context Workspace</h1>
        </div>
        <div className="governance">
          <ShieldCheck size={18} />
          <span>RBAC</span>
          <span>Lineage</span>
          <span>Model governance</span>
          <button
            type="button"
            className={showHitlApproval ? "governance-button active" : "governance-button"}
            aria-expanded={showHitlApproval}
            onClick={() => setShowHitlApproval((isVisible) => !isVisible)}
          >
            HITL approval
          </button>
          <button
            type="button"
            className={showAuditTrail ? "governance-button active" : "governance-button"}
            aria-expanded={showAuditTrail}
            onClick={() => setShowAuditTrail((isVisible) => !isVisible)}
          >
            Audit trail
          </button>
        </div>
      </header>

      {showHitlApproval && <HitlApprovalNotice run={run} />}
      {showAuditTrail && <AuditTrailPanel run={run} runCount={runCount} />}

      <section className="ask-surface">
        <div className="question-box">
          <label htmlFor="coo-question">Ask Septon</label>
          <div className="sample-row">
            {sampleQuestions.map((sample) => (
              <button type="button" className="sample-button" key={sample.label} onClick={() => useSampleQuestion(sample.question)}>
                {sample.label}
              </button>
            ))}
          </div>
          <textarea id="coo-question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          <div className="question-actions">
            <button type="button" onClick={resetDecision} className="ghost-button">
              <RefreshCcw size={16} />
              Reset
            </button>
            <button type="button" onClick={executeDecision} className="primary-button">
              <Play size={16} />
              Run decision
            </button>
          </div>
        </div>
        <DecisionSummary run={run} runCount={runCount} />
      </section>

      <section className="pipeline-band" aria-label="Septon runtime pipeline">
        {pipeline.map((item, index) => (
          <div className="pipeline-step" key={item}>
            <CircleDot size={16} />
            <span>{item}</span>
            {index < pipeline.length - 1 && <ArrowRight className="pipe-arrow" size={15} />}
          </div>
        ))}
      </section>

      <section className="grid two">
        <ConnectorPanel run={run} />
        <IntentPanel run={run} />
      </section>

      <section className="grid two wide-left">
        <ContextPanel run={run} />
        <GraphPanel paths={run.contextBundle.graphPaths} />
      </section>

      <section className="grid two">
        <EvidencePanel run={run} />
        <LearningPanel run={run} />
      </section>

      <ArchitectureStatusPanel />
    </main>
  );
}

function HitlApprovalNotice({ run }: { run: SeptonRun }) {
  const [approvalDecision, setApprovalDecision] = useState<
    "pending" | "confirming-accept" | "confirming-deny" | "accepted" | "denied"
  >("pending");
  const approvalReason =
    run.intent.capabilityId === "inventory_optimization"
      ? "Inventory movement and supplier follow-up should be approved before operational execution."
      : "Promotion guardrails and cross-functional actions should be approved before rollout.";
  const approver =
    run.intent.capabilityId === "inventory_optimization" ? "Supply Chain Director" : "COO / Operations Lead";
  const confidencePercent = Math.round(run.recommendation.confidence * 100);

  const isFinalDecision = approvalDecision === "accepted" || approvalDecision === "denied";

  return (
    <section className={`hitl-notice ${approvalDecision}`} aria-label="Human in the loop approval notification">
      <div className="hitl-icon">
        <ShieldCheck size={20} />
      </div>
      <div className="hitl-copy">
        <span>Human approval required</span>
        <strong>{run.intent.capabilityName} is awaiting sign-off</strong>
        <p>
          {approvalReason} Approval request generated for {approver} with {confidencePercent}% confidence and evidence
          package {run.evidence.id}.
        </p>
      </div>
      <div className="hitl-meta">
        <span>{approvalStatusLabel(approvalDecision)}</span>
        <small>
          {approvalDecision === "pending"
            ? `${run.evidence.contextUsed.length} evidence records attached`
            : `Decision recorded against ${run.evidence.id}`}
        </small>
        <div className="hitl-actions">
          <button
            type="button"
            className="hitl-accept"
            disabled={isFinalDecision}
            onClick={() => setApprovalDecision(approvalDecision === "confirming-accept" ? "accepted" : "confirming-accept")}
          >
            {approvalDecision === "confirming-accept" ? "Confirm rollout" : "Accept"}
          </button>
          <button
            type="button"
            className="hitl-deny"
            disabled={isFinalDecision}
            onClick={() => setApprovalDecision(approvalDecision === "confirming-deny" ? "denied" : "confirming-deny")}
          >
            {approvalDecision === "confirming-deny" ? "Confirm denial" : "Deny"}
          </button>
        </div>
        {approvalDecision === "confirming-accept" && (
          <p className="hitl-confirmation">Confirm rollout to record approval and release the recommended action plan.</p>
        )}
        {approvalDecision === "confirming-deny" && (
          <p className="hitl-confirmation deny">Confirm denial to block rollout and record the rejection reason.</p>
        )}
      </div>
    </section>
  );
}

function approvalStatusLabel(
  decision: "pending" | "confirming-accept" | "confirming-deny" | "accepted" | "denied",
): string {
  if (decision === "accepted") return "Approved";
  if (decision === "denied") return "Denied";
  if (decision === "confirming-accept") return "Confirm rollout";
  if (decision === "confirming-deny") return "Confirm denial";
  return "Pending approval";
}

function AuditTrailPanel({ run, runCount }: { run: SeptonRun; runCount: number }) {
  const usedBySource = run.evidence.contextUsed.reduce<Record<string, number>>((totals, reference) => {
    const [source] = reference.split(":");
    totals[source] = (totals[source] ?? 0) + 1;
    return totals;
  }, {});

  const auditedSystems = run.connectorStatuses.map((status) => ({
    ...status,
    evidenceCount: usedBySource[status.source] ?? 0,
  }));

  const auditSteps = [
    `Run ${runCount} created evidence package ${run.evidence.id}.`,
    `Capability audited: ${run.intent.capabilityName}.`,
    `${run.evidence.contextUsed.length} source records were used and ${run.evidence.contextIgnored.length} context types were ignored.`,
    `Confidence was calculated at ${Math.round(run.evidence.confidence * 100)}% from ${run.evidence.confidenceRules.length} rules.`,
    `Outcome is currently ${formatLabel(run.evidence.outcome)}.`,
  ];

  return (
    <section className="panel audit-panel" aria-label="Audit trail">
      <div className="panel-heading">
        <ShieldCheck size={18} />
        <h2>Audit Trail</h2>
      </div>
      <div className="audit-summary">
        <Metric icon={<Database size={17} />} label="Systems audited" value={auditedSystems.length} />
        <Metric icon={<FileSearch size={17} />} label="Evidence records" value={run.evidence.contextUsed.length} />
        <Metric icon={<BadgeCheck size={17} />} label="Evidence package" value={run.evidence.id} />
      </div>
      <div className="audit-grid">
        {auditedSystems.map((system) => (
          <article className={system.evidenceCount > 0 ? "audit-system used" : "audit-system"} key={system.source}>
            <div>
              <strong>{system.source}</strong>
              <span>{system.evidenceCount > 0 ? "Used in audit" : "Checked"}</span>
            </div>
            <p>
              {system.evidenceCount} evidence records · {system.recordCount} available · {system.syncMode} sync · fresh{" "}
              {system.freshness} ago
            </p>
          </article>
        ))}
      </div>
      <h3>Decision audit log</h3>
      <ol className="number-list audit-log">
        {auditSteps.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function ArchitectureStatusPanel() {
  const counts = architectureStatuses.reduce<Record<string, number>>((totals, item) => {
    totals[item.status] = (totals[item.status] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <section className="panel architecture-panel">
      <div className="panel-heading">
        <Network size={18} />
        <h2>Architecture Status</h2>
      </div>
      <div className="architecture-summary">
        {architectureKpis.map((item) => (
          <article className={`status-kpi ${statusClass(item.status)}`} key={item.status}>
            <span>{item.label}</span>
            <strong>{counts[item.status] ?? 0}</strong>
            <small>{item.status}</small>
          </article>
        ))}
      </div>
      <div className="architecture-grid">
        {architectureStatuses.map((item) => (
          <article className="architecture-card" key={item.layer}>
            <div>
              <strong>{item.layer}</strong>
              <span className={`status-chip ${statusClass(item.status)}`}>{item.status}</span>
            </div>
            <p>{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DecisionSummary({ run, runCount }: { run: SeptonRun; runCount: number }) {
  return (
    <section className="answer-panel">
      <div className="panel-heading">
        <Sparkles size={18} />
        <h2>Recommendation</h2>
      </div>
      <div className="run-stamp">
        <span>Run {runCount}</span>
        <span>{new Date(run.evidence.createdAt).toLocaleTimeString()}</span>
      </div>
      <p className="headline">{run.recommendation.headline}</p>
      <div className="confidence">
        <span>Confidence</span>
        <strong>{Math.round(run.recommendation.confidence * 100)}%</strong>
      </div>
      <div className="root-cause-list">
        {run.recommendation.rootCauses.slice(0, 3).map((cause) => (
          <article className="compact-card" key={cause.cause}>
            <div>
              <strong>{cause.cause}</strong>
              <p>{cause.impact}</p>
            </div>
            <span>{Math.round(cause.confidence * 100)}%</span>
          </article>
        ))}
      </div>
      <h3>{run.intent.capabilityId === "inventory_optimization" ? "Inventory optimization plan" : "August promotion guardrails"}</h3>
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

function ConnectorPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Database size={18} />
        <h2>Enterprise Connectors</h2>
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

function IntentPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <Brain size={18} />
        <h2>Intent + Capability Router</h2>
      </div>
      <div className="intent-box">
        <p className="eyebrow">Capability contract</p>
        <h3>{run.intent.capabilityName}</h3>
        <p>{run.contextBundle.capability.promptTemplate}</p>
      </div>
      <div className="field-grid">
        <Metric icon={<Network size={17} />} label="Region" value={run.intent.region} />
        <Metric icon={<Activity size={17} />} label="Period" value={run.intent.period} />
        <Metric icon={<LockKeyhole size={17} />} label="Learning model" value={run.contextBundle.capability.learningModel} />
      </div>
      <h3>Required context</h3>
      <div className="tag-row">
        {run.contextBundle.capability.requiredContext.map((type) => (
            <span key={type}>{formatLabel(type)}</span>
        ))}
      </div>
    </section>
  );
}

function ContextPanel({ run }: { run: SeptonRun }) {
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
      <h3>Ranked context bundle</h3>
      <div className="hit-list">
        {run.contextBundle.vectorHits.map((hit) => (
          <ContextHitRow hit={hit} key={hit.record.id} />
        ))}
      </div>
    </section>
  );
}

function ContextHitRow({ hit }: { hit: ContextHit }) {
  return (
    <article className="hit-row">
      <div>
        <strong>{hit.record.title}</strong>
        <p>
          {hit.record.source} · {formatLabel(hit.record.type)} · {hit.reasons.join(", ")}
        </p>
      </div>
      <span>{hit.score.toFixed(2)}</span>
    </article>
  );
}

function GraphPanel({ paths }: { paths: GraphPath[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <GitBranch size={18} />
        <h2>Graph Search</h2>
      </div>
      <div className="graph-viz">
        {paths.slice(0, 4).map((path) => (
          <article className="graph-path" key={path.explanation}>
            <strong>{path.path[0]?.label}</strong>
            <div className="node-row">
              {path.path.slice(1, 4).map((node) => (
                <span key={node.id}>{node.label}</span>
              ))}
            </div>
            <p>{path.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidencePanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <ShieldCheck size={18} />
        <h2>Decision Evidence Store</h2>
      </div>
      <div className="evidence-id">
        <span>Evidence package</span>
        <strong>{run.evidence.id}</strong>
      </div>
      <div className="field-grid">
        <Metric icon={<Database size={17} />} label="Context used" value={run.evidence.contextUsed.length} />
        <Metric icon={<FileSearch size={17} />} label="Reasoning steps" value={run.evidence.reasoningTrace.length} />
        <Metric icon={<BadgeCheck size={17} />} label="Status" value={formatLabel(run.evidence.outcome)} />
      </div>
      <h3>Reasoning trace</h3>
      <ol className="number-list">
        {run.evidence.reasoningTrace.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <h3>Confidence rules</h3>
      <div className="rule-list">
        {run.evidence.confidenceRules.map((rule) => (
          <article className={rule.passed ? "rule-row passed" : "rule-row"} key={rule.metric}>
            <strong>{rule.description}</strong>
            <p>
              {rule.metric}: {rule.actualValue} {rule.operator} {rule.threshold}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningPanel({ run }: { run: SeptonRun }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <RefreshCcw size={18} />
        <h2>Learning Loop</h2>
      </div>
      {run.learningSignals.map((signal) => (
        <article className="learning-card" key={signal.service}>
          <strong>{signal.service}</strong>
          <p>{signal.update}</p>
          <small>{signal.effect}</small>
        </article>
      ))}
      <h3>Recommended actions</h3>
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
    </section>
  );
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

function statusClass(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "-");
}
