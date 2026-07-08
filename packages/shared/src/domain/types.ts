export type EnterpriseSource = "SAP" | "BigQuery" | "Salesforce" | "ServiceNow" | "SharePoint";

export type UserRole = "COO" | "Supply Chain Manager" | "Marketing Manager" | "Finance Analyst";

export type AccessTag =
  | "executive"
  | "sales"
  | "supply_chain"
  | "marketing"
  | "digital"
  | "operations"
  | "external"
  | "finance_restricted"
  | "employee_detail"
  | "pii";

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
  accessTags?: AccessTag[];
  requiredRoles?: UserRole[];
  payload: Record<string, string | number | boolean | string[]>;
  text: string;
}

export type IngestionPattern = "batch_file" | "export" | "s3_landing_zone";

export type BatchStatus = "accepted" | "rejected";

export interface IngestionValidationIssue {
  recordId: string;
  field: keyof RawRecord | "payload";
  message: string;
}

export interface IngestionBatch {
  id: string;
  source: EnterpriseSource;
  pattern: IngestionPattern;
  fileName: string;
  receivedAt: string;
  readOnly: true;
  attemptedRecordCount: number;
  acceptedRecordCount: number;
  rejectedRecordCount: number;
  status: BatchStatus;
  validationIssues: IngestionValidationIssue[];
  updatesProductionContext: boolean;
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

export interface UserContext {
  id: string;
  name: string;
  role: UserRole;
}

export interface RolePolicy {
  role: UserRole;
  description: string;
  allowedSources: EnterpriseSource[];
  allowedContextTypes: ContextType[];
  deniedAccessTags: AccessTag[];
}

export interface RestrictedRecord {
  id: string;
  title: string;
  source: EnterpriseSource;
  type: ContextType;
  reason: string;
}

export interface AccessControlReport {
  user: UserContext;
  policy: RolePolicy;
  allowedRecordIds: string[];
  restrictedRecords: RestrictedRecord[];
  trace: string[];
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
  accessControl: AccessControlReport;
  appliedDecisionPatterns: DecisionPattern[];
  appliedRetrievalHints: ContextRetrievalHint[];
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

export interface DecisionPattern {
  id: string;
  capabilityId: CapabilityId;
  title: string;
  triggerConditions: string[];
  supportingEvidenceIds: string[];
  recommendedReuse: string;
  validationState: "candidate" | "validated";
  writeBackTarget: string;
  appliedInCurrentRun: boolean;
}

export interface ContextRetrievalHint {
  id: string;
  capabilityId: CapabilityId;
  prioritizedContextTypes: ContextType[];
  boostedEntities: string[];
  deprioritizedContextTypes: ContextType[];
  supportingEvidenceIds: string[];
  explanation: string;
  futureUse: string;
  appliedInCurrentRun: boolean;
}

export interface EnterpriseMemorySnapshot {
  entities: GraphNode[];
  relationships: GraphEdge[];
  semanticMemory: VectorDocument[];
  decisionPatterns: DecisionPattern[];
}

export interface StoredEvidenceCounts {
  total: number;
  approved: number;
  rejected: number;
}

export interface PatternLearningStatus {
  capabilityId: CapabilityId;
  storedObserved: number;
  eligibleApprovedCount: number;
  threshold: number;
  thresholdReached: boolean;
  state: "waiting_for_threshold" | "no_promotable_approval" | "promoted_to_memory";
  selectedEvidenceId?: string;
  promotedPatternId?: string;
}

export interface CapabilityLearningState {
  approvedEvidenceIds: string[];
  patterns: DecisionPattern[];
  retrievalHints: ContextRetrievalHint[];
}

export interface LearningState {
  byCapability: Partial<Record<CapabilityId, CapabilityLearningState>>;
}

export interface EvidenceStoreState {
  storedEvidence: DecisionEvidencePackage[];
  storedCounts: StoredEvidenceCounts;
  patternLearningStatusByCapability: Partial<Record<CapabilityId, PatternLearningStatus>>;
}

export interface SeptonRun {
  connectorStatuses: Array<{
    source: EnterpriseSource;
    connected: boolean;
    recordCount: number;
    syncMode: "batch";
    freshness: string;
    readOnly: true;
    batchId: string;
    batchStatus: BatchStatus;
    ingestionPattern: IngestionPattern;
    rejectedRecordCount: number;
    updatesProductionContext: boolean;
  }>;
  ingestionBatches: IngestionBatch[];
  knowledgeBase: KnowledgeBase;
  intent: DecisionIntent;
  contextBundle: ContextBundle;
  recommendation: Recommendation;
  evidence: DecisionEvidencePackage;
  learningSignals: LearningSignal[];
  patternArtifacts: DecisionPattern[];
  retrievalHints: ContextRetrievalHint[];
  memorySnapshot: EnterpriseMemorySnapshot;
}
