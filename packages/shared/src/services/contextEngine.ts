import type { ContextBundle, ContextHit, ContextType, DecisionIntent, GraphPath, KnowledgeBase, RawRecord } from "../domain/types";
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

export function assembleContext(intent: DecisionIntent, knowledgeBase: KnowledgeBase): ContextBundle {
  const capability = getCapability(intent.capabilityId);
  const queryTokens = tokenize(`${intent.question} ${intent.entities.join(" ")} ${capability.requiredContext.join(" ")}`);

  const vectorHits: ContextHit[] = knowledgeBase.documents
    .map((document) => {
      const record = knowledgeBase.records.find((item) => item.id === document.sourceRecordId)!;
      const semanticScore = cosineLikeScore(queryTokens, document.tokens);
      const requiredBoost = capability.requiredContext.includes(document.contextType) ? contextPriority[document.contextType] : 0.4;
      const regionBoost = record.region === intent.region ? 0.25 : 0;
      const periodBoost = record.week === intent.period || record.week === "2026-W32" ? 0.18 : 0;
      const score = Number((semanticScore * requiredBoost + regionBoost + periodBoost).toFixed(4));
      const reasons = [
        capability.requiredContext.includes(document.contextType) ? "capability-required context" : "optional context",
        record.region === intent.region ? "region match" : "region mismatch",
        record.week === intent.period ? "period match" : record.week === "2026-W32" ? "future promotion context" : "background",
      ];
      return { record, score, reasons };
    })
    .filter((hit) => hit.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const liveData = knowledgeBase.records.filter(
    (record) =>
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
    retrievalTrace: [
      `Capability selected: ${capability.name}`,
      `Required context: ${capability.requiredContext.join(", ")}`,
      `Vector index searched across ${knowledgeBase.documents.length} semantic documents`,
      `Graph traversal linked KPI decline to cities, dayparts, campaigns, suppliers, and incidents`,
      `Live data access refreshed ${liveData.length} freshness-sensitive records`,
    ],
  };
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
