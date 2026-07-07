import type { ContextBundle, ContextHit, ContextType, DecisionIntent, GraphPath, KnowledgeBase, RawRecord } from "../domain/types";
import { applyAccessControl } from "./accessControl";
import { getCapability } from "./capabilityRegistry";
import { cosineLikeScore, tokenize } from "./textVector";

const contextPriority: Record<ContextType, number> = {
  sales_kpi: 1.2,
  inventory: 1.15,
  supplier_incident: 1.15,
  service_incident: 1.05,
  campaign: 1,
  meeting_note: 0.9,
  promotion_calendar: 0.95,
  weather: 0.75,
};

const sourceReliability: Record<RawRecord["source"], number> = {
  SAP: 0.9,
  BigQuery: 0.95,
  Salesforce: 0.85,
  ServiceNow: 0.9,
  SharePoint: 0.8,
};

const rankingWeights = {
  sourceReliability: 0.4,
  extractionConfidence: 0.3,
  evidenceStrength: 0.3,
};

const decayRate = 0.05;

export function assembleContext(intent: DecisionIntent, knowledgeBase: KnowledgeBase): ContextBundle {
  const capability = getCapability(intent.capabilityId);
  const queryTokens = tokenize(`${intent.question} ${intent.entities.join(" ")} ${capability.requiredContext.join(" ")}`);
  const accessControl = applyAccessControl(knowledgeBase.records);
  const allowedRecordIds = new Set(accessControl.allowedRecordIds);

  const vectorHits: ContextHit[] = knowledgeBase.documents
    .filter((document) => allowedRecordIds.has(document.sourceRecordId))
    .map((document) => {
      const record = knowledgeBase.records.find((item) => item.id === document.sourceRecordId)!;
      const semanticScore = cosineLikeScore(queryTokens, document.tokens);
      const freshnessScore = calculateFreshnessScore(record.week);
      const reliabilityScore = sourceReliability[record.source] ?? 0.5;
      const evidenceStrength = calculateEvidenceStrength(record);
      const confidenceScore = calculateConfidenceScore(reliabilityScore, evidenceStrength);
      const graphScore = calculateGraphScore(knowledgeBase, record);
      const impactScore = calculateImpactScore(record);
      const impactMultiplier = 0.75 + impactScore * 0.5;
      const requiredBoost = capability.requiredContext.includes(document.contextType) ? contextPriority[document.contextType] : 0.55;
      const regionBoost = record.region === intent.region ? 0.08 : 0;
      const periodBoost = record.week === intent.period || record.week === "2026-W32" ? 0.08 : 0;
      const baseRankingScore = semanticScore * freshnessScore * confidenceScore * graphScore * impactMultiplier * requiredBoost;
      const score = Number((baseRankingScore + regionBoost + periodBoost).toFixed(4));
      const reasons = [
        capability.requiredContext.includes(document.contextType) ? "capability-required context" : "optional context",
        record.region === intent.region ? "region match" : "region mismatch",
        record.week === intent.period ? "period match" : record.week === "2026-W32" ? "future promotion context" : "background",
        `semantic ${semanticScore.toFixed(2)}`,
        `freshness ${freshnessScore.toFixed(2)}`,
        `source reliability ${reliabilityScore.toFixed(2)}`,
        `evidence strength ${evidenceStrength.toFixed(2)}`,
        `graph relevance ${graphScore.toFixed(2)}`,
        `business impact ${impactScore.toFixed(2)}`,
      ];
      return { record, score, reasons };
    })
    .filter((hit) => hit.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const liveData = knowledgeBase.records.filter(
    (record) =>
      allowedRecordIds.has(record.id) &&
      record.region === intent.region &&
      ["inventory", "supplier_incident", "service_incident", "promotion_calendar"].includes(record.type),
  );

  const graphPaths = buildGraphPaths(knowledgeBase, vectorHits.map((hit) => hit.record));
  const usedTypes = new Set(vectorHits.map((hit) => hit.record.type));
  const ignoredContextTypes = capability.requiredContext.filter((type) => !usedTypes.has(type));

  return {
    intent,
    capability,
    vectorHits,
    graphPaths,
    liveData,
    ignoredContextTypes,
    accessControl,
    retrievalTrace: [
      `Capability contract selected: ${capability.name}`,
      ...accessControl.trace,
      `Required context: ${capability.requiredContext.join(", ")}`,
      `Vector index searched across ${accessControl.allowedRecordIds.length} role-authorized semantic documents`,
      `Graph traversal linked KPI decline to cities, dayparts, campaigns, suppliers, and incidents`,
      `Live data access refreshed ${liveData.length} freshness-sensitive records`,
    ],
  };
}

function calculateFreshnessScore(week?: string): number {
  const recordDate = week ? dateFromIsoWeek(week) : null;
  if (!recordDate) return 0.75;

  const ageInDays = Math.max(0, (Date.now() - recordDate.getTime()) / 86_400_000);
  return Number(Math.exp(-decayRate * ageInDays).toFixed(4));
}

function dateFromIsoWeek(week: string): Date | null {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  const fourthOfJanuary = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = fourthOfJanuary.getUTCDay() || 7;
  const firstMonday = new Date(fourthOfJanuary);
  firstMonday.setUTCDate(fourthOfJanuary.getUTCDate() - dayOfWeek + 1);
  firstMonday.setUTCDate(firstMonday.getUTCDate() + (weekNumber - 1) * 7);
  return firstMonday;
}

function calculateEvidenceStrength(record: RawRecord): number {
  let strength = 0.5;
  const numericPayloadCount = Object.values(record.payload).filter((value) => typeof value === "number").length;

  if (numericPayloadCount > 0) strength += 0.2;
  if (numericPayloadCount >= 3) strength += 0.1;
  if (/\d/.test(record.text)) strength += 0.1;
  if (record.city || record.market) strength += 0.05;

  return Math.min(1, Number(strength.toFixed(4)));
}

function calculateConfidenceScore(reliabilityScore: number, evidenceStrength: number): number {
  const extractionConfidence = 1;
  return Number(
    (
      rankingWeights.sourceReliability * reliabilityScore +
      rankingWeights.extractionConfidence * extractionConfidence +
      rankingWeights.evidenceStrength * evidenceStrength
    ).toFixed(4),
  );
}

function calculateGraphScore(knowledgeBase: KnowledgeBase, record: RawRecord): number {
  const nodeId = `${record.type}:${record.id}`;
  const directEdges = knowledgeBase.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId);
  if (directEdges.length === 0) return 0.65;

  const averageWeight = directEdges.reduce((total, edge) => total + edge.weight, 0) / directEdges.length;
  const connectionBoost = Math.min(0.18, directEdges.length * 0.03);
  return Number(Math.min(1, averageWeight + connectionBoost).toFixed(4));
}

function calculateImpactScore(record: RawRecord): number {
  const payload = record.payload;

  switch (record.type) {
    case "sales_kpi":
      return clamp01(
        Math.abs(numberMetric(payload.salesChangePct ?? payload.totalSalesChangePct ?? payload.breakfastSalesChangePct)) / 20 +
          numberMetric(payload.nationalContributionToDeclinePct) / 100 +
          numberMetric(payload.affectedStores) / 300 +
          numberMetric(payload.forecastDemandLiftPct) / 25,
      );
    case "inventory":
      return clamp01(
        numberMetric(payload.stockoutStores) / 100 +
          numberMetric(payload.shortageUnits) / 6000 +
          numberMetric(payload.excessUnits) / 8000 +
          Math.max(0, 100 - numberMetric(payload.fillRatePct)) / 30 +
          Math.max(0, 7 - numberMetric(payload.daysOfSupply)) / 7,
      );
    case "supplier_incident":
      return clamp01(
        numberMetric(payload.delayedShipments) / 20 +
          numberMetric(payload.lateByHours) / 48 +
          numberMetric(payload.availableTransferUnits) / 10000 +
          numberMetric(payload.coldChainCapacityPct) / 200,
      );
    case "service_incident":
      return clamp01(
        numberMetric(payload.incidentCount) / 60 +
          numberMetric(payload.degradedMinutes) / 120 +
          Math.abs(numberMetric(payload.conversionDropPct)) / 10,
      );
    case "campaign": {
      const plannedReach = numberMetric(payload.plannedReach);
      const actualReach = numberMetric(payload.actualReach);
      return plannedReach > 0 ? clamp01((plannedReach - actualReach) / plannedReach) : 0.5;
    }
    case "promotion_calendar":
      return clamp01(numberMetric(payload.expectedTrafficLiftPct) / 15);
    case "weather":
      return clamp01(Math.abs(numberMetric(payload.commuteTrafficChangePct)) / 10 + numberMetric(payload.stormDays) / 6);
    case "meeting_note":
      return 0.55;
  }
}

function numberMetric(value: string | number | boolean | string[] | undefined): number {
  return typeof value === "number" ? value : 0;
}

function clamp01(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function buildGraphPaths(knowledgeBase: KnowledgeBase, records: RawRecord[]): GraphPath[] {
  const paths: GraphPath[] = [];
  const priorityRecords = records.filter((record) =>
    ["sales_kpi", "inventory", "supplier_incident", "service_incident", "campaign"].includes(record.type),
  );

  for (const record of priorityRecords.slice(0, 5)) {
    const node = knowledgeBase.nodes.find((item) => item.id === `${record.type}:${record.id}`);
    if (!node) continue;
    const edges = knowledgeBase.edges.filter((edge) => edge.from === node.id);
    const pathNodes = [
      node,
      ...edges
        .map((edge) => knowledgeBase.nodes.find((candidate) => candidate.id === edge.to))
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)),
    ];
    paths.push({
      path: pathNodes,
      edges,
      explanation: `${record.title} is connected to ${pathNodes.slice(1).map((item) => item.label).join(", ")}.`,
    });
  }

  return paths;
}
