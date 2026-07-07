import type { CapabilityId, DecisionIntent } from "../domain/types";
import { getCapability } from "./capabilityRegistry";

export function routeDecisionIntent(question: string): DecisionIntent {
  const lower = question.toLowerCase();
  let capabilityId: CapabilityId = "root_cause_analysis";

  if (
    lower.includes("inventory") ||
    lower.includes("stock") ||
    lower.includes("replenish") ||
    lower.includes("rebalance") ||
    lower.includes("optimize")
  ) {
    capabilityId = "inventory_optimization";
  }
  if (lower.includes("promotion") || lower.includes("august")) {
    capabilityId =
      capabilityId === "inventory_optimization"
        ? "inventory_optimization"
        : lower.includes("decline") || lower.includes("why")
          ? "root_cause_analysis"
          : "promotion_risk_planning";
  }
  if (lower.includes("forecast")) {
    capabilityId = "sales_forecast";
  }

  const region = lower.includes("u.s") || lower.includes("us") || lower.includes("united states") ? "US" : "US";
  const market = lower.includes("chicago") ? "Midwest" : "United States";
  const entities = [
    lower.includes("sales") ? "sales" : "",
    lower.includes("chicago") ? "Chicago" : "",
    lower.includes("august") ? "August Family Value" : "",
    lower.includes("promotion") ? "promotion" : "",
    lower.includes("inventory") || lower.includes("stock") ? "inventory" : "",
    lower.includes("egg") ? "egg patties" : "",
  ].filter(Boolean);
  const capability = getCapability(capabilityId);

  return {
    question,
    capabilityId,
    capabilityName: capability.name,
    region,
    market,
    period: lower.includes("last week") ? "2026-W26" : "current period",
    followUpObjective:
      capabilityId === "inventory_optimization"
        ? "Optimize inventory placement and reduce shortage risk"
        : lower.includes("prevent") || lower.includes("future")
          ? "Prevent recurrence and prepare the August promotion"
          : "Explain performance movement",
    entities,
  };
}
