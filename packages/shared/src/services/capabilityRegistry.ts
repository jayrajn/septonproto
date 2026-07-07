import type { CapabilityContract } from "../domain/types";

export const capabilityRegistry: CapabilityContract[] = [
  {
    id: "root_cause_analysis",
    name: "Root Cause Analysis",
    businessDomains: ["Sales", "Operations", "Supply Chain", "Marketing", "Digital"],
    requiredContext: [
      "sales_kpi",
      "inventory",
      "supplier_incident",
      "campaign",
      "service_incident",
      "meeting_note",
      "weather",
    ],
    confidenceRules: [
      {
        metric: "marketSalesDeclinePercentage",
        operator: "<",
        threshold: -10,
        weight: 0.35,
        description: "The impacted market has a severe sales decline.",
      },
      {
        metric: "nationalDeclineContributionPercentage",
        operator: ">=",
        threshold: 30,
        weight: 0.35,
        description: "The impacted market contributes materially to the national decline.",
      },
      {
        metric: "supportingSourceCount",
        operator: ">=",
        threshold: 4,
        weight: 0.2,
        description: "Multiple enterprise systems support the explanation.",
      },
      {
        metric: "freshLiveRecordCount",
        operator: ">=",
        threshold: 3,
        weight: 0.1,
        description: "Fresh live operational records are available.",
      },
    ],
    retrievalStrategy: [
      "Identify impacted market and time period",
      "Prioritize KPI deltas by contribution to total decline",
      "Traverse graph from KPI nodes to related incidents, campaigns, and suppliers",
      "Use vector search for meeting notes and unstructured explanations",
      "Call live data access for freshness-sensitive inventory and incident records",
    ],
    workflow: [
      "Receive context bundle",
      "Rank probable causes by measured impact",
      "Validate causes against evidence freshness and governance rules",
      "Generate recommendation and prevention plan",
      "Create immutable decision evidence package",
    ],
    outputSchema: ["rootCauses", "recommendations", "confidence", "evidence", "promotionGuardrails"],
    evidenceSchema: ["decisionId", "question", "contextUsed", "contextIgnored", "reasoning", "recommendation", "confidence"],
    learningModel: "capability.root_cause.context_ranker.v1",
    promptTemplate:
      "Explain the most likely root causes using only governed context. Separate measured evidence from hypothesis and return prevention actions.",
  },
  {
    id: "inventory_optimization",
    name: "Inventory Optimization",
    businessDomains: ["Supply Chain", "Operations", "Sales"],
    requiredContext: ["inventory", "sales_kpi", "supplier_incident", "promotion_calendar"],
    confidenceRules: [
      {
        metric: "supportingSourceCount",
        operator: ">=",
        threshold: 3,
        weight: 0.65,
        description: "Inventory recommendation is supported by multiple enterprise systems.",
      },
      {
        metric: "freshLiveRecordCount",
        operator: ">=",
        threshold: 3,
        weight: 0.35,
        description: "Fresh inventory and distribution records are available.",
      },
    ],
    retrievalStrategy: [
      "Identify item, market, and planning horizon",
      "Retrieve current inventory by store cluster",
      "Compare current inventory against demand forecast and target stock",
      "Check promotion calendar and distribution constraints",
      "Generate transfer and replenishment recommendation",
    ],
    workflow: [
      "Receive inventory context bundle",
      "Calculate surplus and shortage by cluster",
      "Validate transfer capacity and promotion timing",
      "Recommend rebalancing actions",
      "Create decision evidence package",
    ],
    outputSchema: ["inventoryPosition", "shortageRisk", "transferPlan", "replenishmentActions", "confidence"],
    evidenceSchema: ["decisionId", "question", "contextUsed", "inventoryInputs", "transferPlan", "confidence"],
    learningModel: "capability.inventory_optimization.context_ranker.v1",
    promptTemplate:
      "Optimize inventory placement using governed inventory, demand, promotion, and distribution context. Return transfer actions and shortage risk.",
  },
  {
    id: "promotion_risk_planning",
    name: "Promotion Risk Planning",
    businessDomains: ["Marketing", "Supply Chain", "Digital"],
    requiredContext: ["promotion_calendar", "inventory", "supplier_incident", "campaign", "service_incident", "meeting_note"],
    confidenceRules: [
      {
        metric: "supportingSourceCount",
        operator: ">=",
        threshold: 3,
        weight: 0.7,
        description: "Multiple systems support the promotion readiness assessment.",
      },
      {
        metric: "freshLiveRecordCount",
        operator: ">=",
        threshold: 2,
        weight: 0.3,
        description: "Fresh operational records are available for launch readiness.",
      },
    ],
    retrievalStrategy: [
      "Find upcoming promotion",
      "Check supply readiness for promoted items",
      "Check approval and campaign readiness",
      "Check digital capacity and recent incidents",
    ],
    workflow: [
      "Receive planned promotion context",
      "Identify readiness gaps",
      "Create mitigation checklist",
      "Assign owners",
      "Capture promotion risk evidence",
    ],
    outputSchema: ["risks", "mitigations", "owners", "launchReadinessScore"],
    evidenceSchema: ["decisionId", "promotion", "risks", "contextUsed", "approvals", "confidence"],
    learningModel: "capability.promotion_risk.context_ranker.v1",
    promptTemplate:
      "Assess promotion launch risk from operational, supply, marketing approval, and digital readiness evidence.",
  },
  {
    id: "sales_forecast",
    name: "Sales Forecast",
    businessDomains: ["Sales", "Finance"],
    requiredContext: ["sales_kpi", "promotion_calendar", "weather"],
    confidenceRules: [
      {
        metric: "supportingSourceCount",
        operator: ">=",
        threshold: 2,
        weight: 1,
        description: "Forecast has enough supporting context sources.",
      },
    ],
    retrievalStrategy: ["Retrieve sales history", "Apply seasonality", "Adjust for promotions and weather"],
    workflow: ["Receive sales context", "Estimate baseline", "Apply adjustments", "Return forecast and assumptions"],
    outputSchema: ["forecast", "drivers", "assumptions", "confidence"],
    evidenceSchema: ["decisionId", "forecastInputs", "assumptions", "confidence"],
    learningModel: "capability.sales_forecast.context_ranker.v1",
    promptTemplate: "Forecast sales using governed historical and promotional context.",
  },
];

export function getCapability(id: string): CapabilityContract {
  const capability = capabilityRegistry.find((item) => item.id === id);
  if (!capability) {
    throw new Error(`Unknown capability: ${id}`);
  }
  return capability;
}
