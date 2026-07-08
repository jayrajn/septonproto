import type {
  ExtractedEntity,
  ExtractedEntityType,
  ExtractedEvent,
  ExtractedFact,
  ExtractedRelationship,
  GraphEdge,
  GraphNode,
  KnowledgeBase,
  KnowledgeExtraction,
  RawRecord,
  VectorDocument,
} from "../domain/types";
import { tokenize } from "./textVector";

const numericFactMetadata: Record<string, { unit: string; category: string }> = {
  salesChangePct: { unit: "percent", category: "sales" },
  totalSalesChangePct: { unit: "percent", category: "sales" },
  breakfastSalesChangePct: { unit: "percent", category: "sales" },
  stockoutStores: { unit: "stores", category: "inventory" },
  fillRatePct: { unit: "percent", category: "inventory" },
  shortageUnits: { unit: "units", category: "inventory" },
  excessUnits: { unit: "units", category: "inventory" },
  daysOfSupply: { unit: "days", category: "inventory" },
  delayedShipments: { unit: "shipments", category: "supplier" },
  lateByHours: { unit: "hours", category: "supplier" },
  availableTransferUnits: { unit: "units", category: "supplier" },
  incidentCount: { unit: "incidents", category: "service" },
  degradedMinutes: { unit: "minutes", category: "service" },
  conversionDropPct: { unit: "percent", category: "service" },
  plannedReach: { unit: "people", category: "campaign" },
  actualReach: { unit: "people", category: "campaign" },
  expectedTrafficLiftPct: { unit: "percent", category: "campaign" },
};

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

export function extractKnowledgeFromRecord(record: RawRecord): KnowledgeExtraction {
  const entities: ExtractedEntity[] = [];
  const facts: ExtractedFact[] = [];
  const events: ExtractedEvent[] = [];
  const relationships: ExtractedRelationship[] = [];
  const trace: string[] = [`Classified ${record.id} as ${record.type}.`];
  const recordEntity = createRecordEntity(record);

  entities.push(recordEntity);

  addEntity(entities, trace, {
    id: `region:${record.region}`,
    label: record.region,
    canonicalType: "region",
    sourceField: "region",
    sourceRecordId: record.id,
  });
  relationships.push({
    from: recordEntity.id,
    to: `region:${record.region}`,
    label: "belongs_to_region",
    weight: 0.8,
    sourceField: "region",
    sourceRecordId: record.id,
  });

  if (record.city) {
    addEntity(entities, trace, {
      id: `city:${record.city}`,
      label: record.city,
      canonicalType: "city",
      sourceField: "city",
      sourceRecordId: record.id,
    });
    relationships.push(
      {
        from: recordEntity.id,
        to: `city:${record.city}`,
        label: "observed_in",
        weight: 0.9,
        sourceField: "city",
        sourceRecordId: record.id,
      },
      {
        from: `city:${record.city}`,
        to: `region:${record.region}`,
        label: "belongs_to_region",
        weight: 1,
        sourceField: "city",
        sourceRecordId: record.id,
      },
    );
  }

  if (record.businessUnit) {
    addEntity(entities, trace, {
      id: `business_unit:${canonicalKey(record.businessUnit)}`,
      label: record.businessUnit,
      canonicalType: "business_unit",
      sourceField: "businessUnit",
      sourceRecordId: record.id,
    });
    relationships.push({
      from: recordEntity.id,
      to: `business_unit:${canonicalKey(record.businessUnit)}`,
      label: "classified_as_event",
      weight: 0.65,
      sourceField: "businessUnit",
      sourceRecordId: record.id,
    });
  }

  if (record.businessUnit?.toLowerCase().includes("breakfast") || record.text.toLowerCase().includes("breakfast")) {
    addEntity(entities, trace, {
      id: "daypart:breakfast",
      label: "Breakfast",
      canonicalType: "daypart",
      sourceField: record.businessUnit?.toLowerCase().includes("breakfast") ? "businessUnit" : "text",
      sourceRecordId: record.id,
    });
    relationships.push({
      from: recordEntity.id,
      to: "daypart:breakfast",
      label: "affects_daypart",
      weight: 0.9,
      sourceField: "businessUnit/text",
      sourceRecordId: record.id,
    });
  }

  addPayloadEntity(record, entities, relationships, trace, "supplier", "supplier", "supplier", recordEntity.id, "supplied_by", 0.95);
  addPayloadEntity(
    record,
    entities,
    relationships,
    trace,
    "affectedDistributionCenter",
    "distribution_center",
    "distribution_center",
    recordEntity.id,
    "delayed_delivery_to",
    0.9,
  );
  addPayloadEntity(
    record,
    entities,
    relationships,
    trace,
    "distributionCenter",
    "distribution_center",
    "distribution_center",
    recordEntity.id,
    "delayed_delivery_to",
    0.85,
  );
  addPayloadEntity(record, entities, relationships, trace, "impactedSku", "product", "product", recordEntity.id, "impacted_product", 0.9);
  addPayloadEntity(record, entities, relationships, trace, "item", "product", "product", recordEntity.id, "impacted_product", 0.82);
  addPayloadEntity(record, entities, relationships, trace, "campaign", "campaign", "campaign", recordEntity.id, "describes_campaign", 0.85);
  addPayloadEntity(record, entities, relationships, trace, "promotion", "campaign", "campaign", recordEntity.id, "describes_campaign", 0.85);

  for (const [name, value] of Object.entries(record.payload)) {
    const metadata = numericFactMetadata[name];
    if (!metadata || typeof value !== "number") continue;

    const fact: ExtractedFact = {
      id: `fact:${record.id}:${name}`,
      name,
      value,
      unit: metadata.unit,
      category: metadata.category,
      sourceField: `payload.${name}`,
      sourceRecordId: record.id,
    };
    facts.push(fact);
    trace.push(`Extracted fact ${name}=${value} ${metadata.unit} from payload.${name}.`);
    relationships.push({
      from: recordEntity.id,
      to: fact.id,
      label: "has_fact",
      weight: 0.75,
      sourceField: `payload.${name}`,
      sourceRecordId: record.id,
    });
  }

  events.push({
    id: `event:${record.id}`,
    eventType: eventTypeForRecord(record),
    summary: record.title,
    sourceRecordId: record.id,
  });
  relationships.push({
    from: recordEntity.id,
    to: `event:${record.id}`,
    label: "classified_as_event",
    weight: 0.8,
    sourceField: "type/title",
    sourceRecordId: record.id,
  });
  trace.push(`Extracted event ${eventTypeForRecord(record)} from ${record.type}.`);

  return {
    sourceRecordId: record.id,
    classification: record.type,
    entities,
    facts,
    events,
    relationships,
    trace,
  };
}

export function buildKnowledgeBase(records: RawRecord[]): KnowledgeBase {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const documents: VectorDocument[] = [];
  const extractions = records.map(extractKnowledgeFromRecord);

  uniqueNode(nodes, {
    id: "capability:root_cause_analysis",
    label: "Root Cause Analysis",
    type: "capability",
    properties: {
      contract: "required context, workflow, prompt, output schema, evidence schema",
      extractionMethod: "seeded capability contract",
    },
  });

  for (const extraction of extractions) {
    for (const entity of extraction.entities) {
      uniqueNode(nodes, {
        id: entity.id,
        label: entity.label,
        type: entity.canonicalType,
        properties: {
          canonicalType: entity.canonicalType,
          sourceField: entity.sourceField,
          sourceRecordId: entity.sourceRecordId,
          extractionMethod: "rule_based",
        },
      });
    }

    for (const fact of extraction.facts) {
      uniqueNode(nodes, {
        id: fact.id,
        label: `${fact.name}: ${fact.value}`,
        type: "kpi",
        properties: {
          canonicalType: "fact",
          factName: fact.name,
          value: fact.value,
          unit: fact.unit,
          category: fact.category,
          sourceField: fact.sourceField,
          sourceRecordId: fact.sourceRecordId,
          extractionMethod: "numeric_payload_rule",
        },
      });
    }

    for (const event of extraction.events) {
      uniqueNode(nodes, {
        id: event.id,
        label: event.summary,
        type: event.eventType.includes("incident") || event.eventType.includes("delay") ? "incident" : "kpi",
        properties: {
          canonicalType: "event",
          eventType: event.eventType,
          sourceRecordId: event.sourceRecordId,
          extractionMethod: "record_type_rule",
        },
      });
    }

    for (const relationship of extraction.relationships) {
      addEdge(edges, relationship.from, relationship.to, relationship.label, relationship.weight);
    }

    addEdge(edges, "capability:root_cause_analysis", `${extraction.classification}:${extraction.sourceRecordId}`, "can_use_context", 0.7);

    const record = records.find((item) => item.id === extraction.sourceRecordId)!;
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
    extractions,
  };
}

function createRecordEntity(record: RawRecord): ExtractedEntity {
  return {
    id: `${record.type}:${record.id}`,
    label: record.title,
    canonicalType: record.type.includes("incident") ? "incident" : record.type === "campaign" ? "campaign" : "kpi",
    sourceField: "record",
    sourceRecordId: record.id,
  };
}

function addEntity(entities: ExtractedEntity[], trace: string[], entity: ExtractedEntity) {
  if (!entities.some((item) => item.id === entity.id)) {
    entities.push(entity);
    trace.push(`Extracted ${entity.canonicalType} entity ${entity.label} from ${entity.sourceField}.`);
  }
}

function addPayloadEntity(
  record: RawRecord,
  entities: ExtractedEntity[],
  relationships: ExtractedRelationship[],
  trace: string[],
  payloadKey: string,
  idPrefix: string,
  canonicalType: ExtractedEntityType,
  from: string,
  relationshipLabel: string,
  weight: number,
) {
  const value = record.payload[payloadKey];
  if (typeof value !== "string") return;

  const entityId = `${idPrefix}:${canonicalKey(value)}`;
  addEntity(entities, trace, {
    id: entityId,
    label: value,
    canonicalType,
    sourceField: `payload.${payloadKey}`,
    sourceRecordId: record.id,
  });
  relationships.push({
    from,
    to: entityId,
    label: relationshipLabel,
    weight,
    sourceField: `payload.${payloadKey}`,
    sourceRecordId: record.id,
  });
}

function eventTypeForRecord(record: RawRecord): string {
  if (record.type === "supplier_incident") return "supplier_delivery_delay";
  if (record.type === "service_incident") return "service_degradation";
  if (record.type === "inventory") return "inventory_position";
  if (record.type === "campaign" || record.type === "promotion_calendar") return "campaign_or_promotion_event";
  if (record.type === "sales_kpi") return "sales_performance_event";
  return record.type;
}

function canonicalKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
