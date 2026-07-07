import type { GraphEdge, GraphNode, KnowledgeBase, RawRecord, VectorDocument } from "../domain/types";
import { tokenize } from "./textVector";

function uniqueNode(nodes: Map<string, GraphNode>, node: GraphNode) {
  if (!nodes.has(node.id)) {
    nodes.set(node.id, node);
  }
}

function addEdge(edges: GraphEdge[], from: string, to: string, label: string, weight = 1) {
  if (!edges.some((edge) => edge.from === from && edge.to === to && edge.label === label)) {
    edges.push({ from, to, label, weight });
  }
}

export function buildKnowledgeBase(records: RawRecord[]): KnowledgeBase {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const documents: VectorDocument[] = [];

  uniqueNode(nodes, {
    id: "capability:root_cause_analysis",
    label: "Root Cause Analysis",
    type: "capability",
    properties: { contract: "required context, workflow, prompt, output schema, evidence schema" },
  });

  for (const record of records) {
    const recordNodeId = `${record.type}:${record.id}`;
    uniqueNode(nodes, {
      id: recordNodeId,
      label: record.title,
      type: record.type.includes("incident") ? "incident" : record.type === "campaign" ? "campaign" : "kpi",
      properties: {
        source: record.source,
        region: record.region,
        market: record.market ?? "",
        city: record.city ?? "",
        week: record.week ?? "",
      },
    });

    uniqueNode(nodes, {
      id: `region:${record.region}`,
      label: record.region,
      type: "region",
      properties: { region: record.region },
    });
    addEdge(edges, recordNodeId, `region:${record.region}`, "belongs_to_region", 0.8);

    if (record.city) {
      uniqueNode(nodes, {
        id: `city:${record.city}`,
        label: record.city,
        type: "city",
        properties: { city: record.city, market: record.market ?? "" },
      });
      addEdge(edges, recordNodeId, `city:${record.city}`, "observed_in", 0.9);
      addEdge(edges, `city:${record.city}`, `region:${record.region}`, "part_of", 1);
    }

    if (record.businessUnit?.toLowerCase().includes("breakfast") || record.text.toLowerCase().includes("breakfast")) {
      uniqueNode(nodes, {
        id: "daypart:breakfast",
        label: "Breakfast",
        type: "daypart",
        properties: { daypart: "Breakfast" },
      });
      addEdge(edges, recordNodeId, "daypart:breakfast", "affects_daypart", 0.9);
    }

    if (typeof record.payload.supplier === "string") {
      const supplierId = `supplier:${record.payload.supplier}`;
      uniqueNode(nodes, {
        id: supplierId,
        label: record.payload.supplier,
        type: "supplier",
        properties: { supplier: record.payload.supplier },
      });
      addEdge(edges, recordNodeId, supplierId, "caused_by_supplier", 0.95);
    }

    if (typeof record.payload.campaign === "string") {
      const campaignId = `campaign:${record.payload.campaign}`;
      uniqueNode(nodes, {
        id: campaignId,
        label: record.payload.campaign,
        type: "campaign",
        properties: { campaign: record.payload.campaign },
      });
      addEdge(edges, recordNodeId, campaignId, "describes_campaign", 0.85);
    }

    addEdge(edges, "capability:root_cause_analysis", recordNodeId, "can_use_context", 0.7);

    documents.push({
      id: `doc:${record.id}`,
      sourceRecordId: record.id,
      source: record.source,
      contextType: record.type,
      title: record.title,
      text: `${record.title}. ${record.text}`,
      tokens: tokenize(`${record.title}. ${record.text}`),
    });
  }

  return {
    records,
    nodes: [...nodes.values()],
    edges,
    documents,
  };
}
