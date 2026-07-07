export type EnterpriseSource = "SAP" | "BigQuery" | "Salesforce" | "ServiceNow" | "SharePoint";

export type ContextType =
  | "sales_kpi"
  | "inventory"
  | "supplier_incident"
  | "campaign"
  | "service_incident"
  | "meeting_note"
  | "promotion_calendar"
  | "weather";

export type CapabilityId = "root_cause_analysis" | "inventory_optimization" | "promotion_risk_planning" | "sales_forecast";

export interface RawRecord {
  id: string;
  source: EnterpriseSource;
  type: ContextType;
  title: string;
  region: string;
  market?: string;
  city?: string;
  week?: string;
  businessUnit?: string;
  payload: Record<string, string | number | boolean | string[]>;
  text: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "region" | "city" | "daypart" | "supplier" | "campaign" | "incident" | "kpi" | "capability";
  properties: Record<string, string | number | boolean>;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  weight: number;
}

export interface VectorDocument {
  id: string;
  sourceRecordId: string;
  source: EnterpriseSource;
  contextType: ContextType;
  title: string;
  text: string;
  tokens: string[];
}

export interface KnowledgeBase {
  records: RawRecord[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  documents: VectorDocument[];
}

export interface CapabilityContract {
  id: CapabilityId;
  name: string;
  businessDomains: string[];
  requiredContext: ContextType[];
  confidenceRules: ConfidenceRule[];
  retrievalStrategy: string[];
  workflow: string[];
  outputSchema: string[];
  evidenceSchema: string[];
  learningModel: string;
  promptTemplate: string;
}

export type ConfidenceMetric =
  | "marketSalesDeclinePercentage"
  | "nationalDeclineContributionPercentage"
  | "supportingSourceCount"
  | "freshLiveRecordCount";

export type ConfidenceOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";

export interface ConfidenceRule {
  metric: ConfidenceMetric;
  operator: ConfidenceOperator;
  threshold: number;
  weight: number;
  description: string;
}

export interface DecisionIntent {
  question: string;
  capabilityId: CapabilityId;
  capabilityName: string;
  region: string;
  market: string;
  period: string;
  followUpObjective: string;
  entities: string[];
}

export interface ContextHit {
  record: RawRecord;
  score: number;
  reasons: string[];
}

export interface GraphPath {
  path: GraphNode[];
  edges: GraphEdge[];
  explanation: string;
}

export interface ContextBundle {
  intent: DecisionIntent;
  capability: CapabilityContract;
  vectorHits: ContextHit[];
  graphPaths: GraphPath[];
  liveData: RawRecord[];
  ignoredContextTypes: ContextType[];
  retrievalTrace: string[];
}

export interface Recommendation {
  headline: string;
  rootCauses: Array<{ cause: string; impact: string; evidence: string; confidence: number }>;
  actions: Array<{ action: string; owner: string; timing: string; expectedEffect: string }>;
  augustPromotionGuardrails: string[];
  confidence: number;
}

export type DecisionApprovalStatus = "awaiting_admin_approval" | "approved" | "rejected";
export type EvidenceStorageStatus = "not_stored" | "stored";

export interface DecisionEvidencePackage {
  id: string;
  createdAt: string;
  question: string;
  capabilityId: CapabilityId;
  contextUsed: string[];
  contextIgnored: ContextType[];
  reasoningTrace: string[];
  confidenceRules: Array<{
    description: string;
    metric: string;
    actualValue: number;
    operator: ConfidenceOperator;
    threshold: number;
    passed: boolean;
    weight: number;
  }>;
  recommendation: Recommendation;
  confidence: number;
  outcome: "pending_feedback" | "accepted" | "rejected";
  approvalStatus: DecisionApprovalStatus;
  storageStatus: EvidenceStorageStatus;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface LearningSignal {
  service: "Context Retrieval Learning" | "Pattern Learning Service";
  update: string;
  effect: string;
}

export interface SeptonRun {
  connectorStatuses: Array<{
    source: EnterpriseSource;
    connected: boolean;
    recordCount: number;
    syncMode: "batch" | "stream" | "api";
    freshness: string;
  }>;
  knowledgeBase: KnowledgeBase;
  intent: DecisionIntent;
  contextBundle: ContextBundle;
  recommendation: Recommendation;
  evidence: DecisionEvidencePackage;
  learningSignals: LearningSignal[];
}
