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
import type { CapabilityId, ContextHit, GraphPath, SeptonRun } from "../../../../packages/shared/src/domain/types";
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

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function App() {
  const [question, setQuestion] = useState("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<CapabilityId | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [run, setRun] = useState<SeptonRun | null>(null);
  const selectedCapability = useMemo(
    () => capabilityChoices.find((capability) => capability.id === selectedCapabilityId) ?? null,
    [selectedCapabilityId],
  );

  function executeDecision() {
    if (!selectedCapabilityId) return;
    setRun(runSepton(question, selectedCapabilityId));
    setRunCount((count) => count + 1);
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
          <label htmlFor="coo-question">Ask Cepton</label>
          <textarea id="coo-question" value={question} onChange={(event) => setQuestion(event.target.value)} />
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
        {run ? <DecisionSummary run={run} runCount={runCount} /> : <EmptyDecisionState selectedCapability={selectedCapability?.label ?? null} />}
      </section>

      <section className="pipeline-band" aria-label="Cepton runtime pipeline">
        {pipeline.map((item, index) => (
          <div className="pipeline-step" key={item}>
            <CircleDot size={16} />
            <span>{item}</span>
            {index < pipeline.length - 1 && <ArrowRight className="pipe-arrow" size={15} />}
          </div>
        ))}
      </section>

      {run && (
        <>
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
        </>
      )}
    </main>
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
  const topContextScore = Math.max(...run.contextBundle.vectorHits.map((hit) => hit.score), 0);

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
