import type { ContextBundle, Recommendation } from "../domain/types";
import { evaluateConfidence } from "./confidenceEvaluator";

function numberFromPayload(value: string | number | boolean | string[] | undefined): number {
  return typeof value === "number" ? value : 0;
}

export function runDecisionWorkflow(bundle: ContextBundle): Recommendation {
  if (bundle.intent.capabilityId === "inventory_optimization") {
    return runInventoryOptimizationWorkflow(bundle);
  }

  const recordById = new Map([
    ...bundle.vectorHits.map((hit) => [hit.record.id, hit.record] as const),
    ...bundle.liveData.map((record) => [record.id, record] as const),
  ]);
  const inventory = recordById.get("sap-egg-inventory-midwest");
  const supplier = recordById.get("sap-supplier-omega-foods-delay");
  const service = recordById.get("servicenow-pos-mobile-midwest");
  const campaign = recordById.get("sf-june-breakfast-campaign-paused");
  const confidenceEvaluation = evaluateConfidence(bundle);
  const hasLearnedPattern = bundle.appliedDecisionPatterns.length > 0;
  const hasLearnedHints = bundle.appliedRetrievalHints.length > 0;
  const confidenceBoost = hasLearnedPattern || hasLearnedHints ? 0.05 : 0;

  return {
    headline: hasLearnedPattern
      ? "Approve an August breakfast launch readiness gate and block launch until Chicago supply, mobile ordering health, and campaign execution all clear the learned pre-launch threshold."
      : "Approve a breakfast promotion readiness gate for August, focused on Chicago supply, mobile ordering stability, and campaign launch readiness.",
    rootCauses: [
      {
        cause: "Breakfast supply constraint in Chicago",
        impact: `${numberFromPayload(inventory?.payload.stockoutStores)} stores had partial egg item stockouts; Midwest fill rate fell to ${numberFromPayload(inventory?.payload.fillRatePct)}%.`,
        evidence: `${inventory?.source}: ${inventory?.title}. ${supplier?.source}: ${supplier?.title}.`,
        confidence: hasLearnedPattern ? 0.94 : 0.91,
      },
      {
        cause: "Digital ordering degradation during breakfast peak",
        impact: `${numberFromPayload(service?.payload.incidentCount)} mobile incidents occurred during 07:00-09:00; estimated conversion dropped ${Math.abs(numberFromPayload(service?.payload.conversionDropPct)).toFixed(1)}%.`,
        evidence: `${service?.source}: ${service?.title}.`,
        confidence: hasLearnedHints ? 0.86 : 0.82,
      },
      {
        cause: "Marketing support missed the launch window",
        impact: hasLearnedPattern
          ? "Breakfast Value Push reached 420k people versus 1.2M planned, and the learned readiness pattern now treats delayed approvals as a launch blocker rather than a secondary issue."
          : "Breakfast Value Push reached 420k people versus 1.2M planned, reducing demand recovery during the same week.",
        evidence: `${campaign?.source}: ${campaign?.title}.`,
        confidence: hasLearnedPattern ? 0.84 : 0.78,
      },
      {
        cause: "Weather amplified the local decline",
        impact: `Two storm mornings reduced commute traffic; this is a contributing factor, not the primary controllable cause.`,
        evidence: "External weather feed linked storms to a moderate breakfast traffic correlation.",
        confidence: 0.62,
      },
    ],
    actions: [
      {
        action: hasLearnedPattern
          ? "Activate the learned breakfast launch readiness gate and require explicit COO sign-off if supplier, digital, or campaign thresholds are below target."
          : "Create a breakfast promotion readiness gate covering supplier fill rate, DC delivery status, mobile order health, and creative approvals.",
        owner: "US Operations",
        timing: "Before August promotion launch",
        expectedEffect: "Reduces repeat decline risk by catching cross-functional readiness gaps before traffic is stimulated.",
      },
      {
        action: hasLearnedPattern
          ? "Set the Midwest egg patty buffer earlier and require supplier confirmation 10 days before launch so the learned supply gate can be enforced before media spend starts."
          : "Set an August supply buffer for egg patties in Midwest distribution centers and require supplier confirmation 7 days before launch.",
        owner: "Supply Chain",
        timing: hasLearnedPattern ? "T-21 to T-10 days" : "T-14 to T-7 days",
        expectedEffect: "Protects promoted breakfast items from supplier delay and local stockout risk.",
      },
      {
        action: hasLearnedHints
          ? "Run a pre-launch mobile ordering load test and incident hold-point for Midwest breakfast windows because approved evidence showed digital reliability is an early warning signal."
          : "Run mobile ordering load and incident review for breakfast windows in Midwest stores.",
        owner: "Digital Operations",
        timing: "T-10 days",
        expectedEffect: "Prevents conversion loss during the highest demand windows.",
      },
      {
        action: "Lock campaign creative approvals two weeks before launch and add COO exception alerts for missed approvals.",
        owner: "Marketing Operations",
        timing: "T-21 to T-14 days",
        expectedEffect: "Ensures paid media and app placements are live when demand generation is needed.",
      },
    ],
    augustPromotionGuardrails: [
      hasLearnedPattern
        ? "Do not launch Chicago breakfast-heavy promotion unless the learned readiness gate is green across fill rate, supplier delivery, digital health, and campaign approval."
        : "Do not launch Chicago breakfast-heavy promotion unless egg patty fill rate is at least 96%.",
      hasLearnedHints
        ? "Require a clean breakfast-window mobile test run and zero Sev-1 or Sev-2 mobile ordering incidents in the prior 72 hours."
        : "Require zero Sev-1 or Sev-2 mobile ordering incidents in the prior 72 hours.",
      hasLearnedPattern
        ? "Require campaign creative approval and media trafficking complete by July 18, 2026 to satisfy the learned launch gating window."
        : "Require campaign creative approval and media trafficking complete by July 20, 2026.",
      "Monitor Chicago breakfast transactions hourly for the first three launch days.",
    ],
    confidence: Math.min(0.98, Number((confidenceEvaluation.confidence + confidenceBoost).toFixed(2))),
  };
}

function runInventoryOptimizationWorkflow(bundle: ContextBundle): Recommendation {
  const recordById = new Map([
    ...bundle.vectorHits.map((hit) => [hit.record.id, hit.record] as const),
    ...bundle.liveData.map((record) => [record.id, record] as const),
  ]);
  const north = recordById.get("sap-inventory-chicago-north-overstock");
  const south = recordById.get("sap-inventory-chicago-south-shortage");
  const demand = recordById.get("bq-chicago-august-breakfast-demand");
  const dc = recordById.get("sap-joliet-dc-transfer-capacity");
  const promotion = recordById.get("sf-august-family-value-promo");
  const confidenceEvaluation = evaluateConfidence(bundle);

  const excessUnits = numberFromPayload(north?.payload.excessUnits);
  const shortageUnits = numberFromPayload(south?.payload.shortageUnits);
  const transferUnits = Math.min(excessUnits, shortageUnits, numberFromPayload(dc?.payload.availableTransferUnits));
  const demandLift = numberFromPayload(demand?.payload.forecastDemandLiftPct);
  const hasLearnedPattern = bundle.appliedDecisionPatterns.length > 0;
  const hasLearnedHints = bundle.appliedRetrievalHints.length > 0;
  const confidenceBoost = hasLearnedPattern || hasLearnedHints ? 0.04 : 0;

  return {
    headline: hasLearnedPattern
      ? `Inventory Optimization selected: pre-stage a learned rebalancing move of ${transferUnits.toLocaleString()} egg patty units from Chicago North to Chicago South before promotion demand begins.`
      : `Inventory Optimization selected: move ${transferUnits.toLocaleString()} egg patty units from Chicago North to Chicago South before the August promotion.`,
    rootCauses: [
      {
        cause: "Inventory imbalance across Chicago store clusters",
        impact: `Chicago North has ${excessUnits.toLocaleString()} excess units while Chicago South is short ${shortageUnits.toLocaleString()} units.`,
        evidence: `${north?.source}: ${north?.title}. ${south?.source}: ${south?.title}.`,
        confidence: hasLearnedPattern ? 0.93 : 0.9,
      },
      {
        cause: "Promotion-driven demand lift increases shortage risk",
        impact: hasLearnedPattern
          ? `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, and the learned pattern now treats that uplift as a signal to rebalance before launch rather than after the first demand spike.`
          : `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, with Chicago South marked as the highest risk cluster.`,
        evidence: `${demand?.source}: ${demand?.title}. ${promotion?.source}: ${promotion?.title}.`,
        confidence: hasLearnedHints ? 0.88 : 0.84,
      },
      {
        cause: "Distribution capacity is sufficient for the recommended transfer",
        impact: `Joliet DC can move up to ${numberFromPayload(dc?.payload.availableTransferUnits).toLocaleString()} units within ${numberFromPayload(dc?.payload.transferWindowHours)} hours.`,
        evidence: `${dc?.source}: ${dc?.title}.`,
        confidence: 0.81,
      },
    ],
    actions: [
      {
        action: hasLearnedPattern
          ? `Pre-stage the transfer of ${transferUnits.toLocaleString()} egg patty units from Chicago North stores to Chicago South stores before promotion week opens.`
          : `Transfer ${transferUnits.toLocaleString()} egg patty units from Chicago North stores to Chicago South stores.`,
        owner: "Supply Chain",
        timing: hasLearnedPattern ? "Before promotion week" : "Within 48 hours",
        expectedEffect: "Closes the South cluster shortage without creating a new North cluster stockout.",
      },
      {
        action: hasLearnedHints
          ? "Hold Chicago North replenishment and use learned cluster imbalance signals to release stock only after South shortage risk normalizes."
          : "Hold Chicago North replenishment until days of supply falls below target.",
        owner: "Inventory Planning",
        timing: "Before next replenishment cycle",
        expectedEffect: "Prevents additional overstock while demand shifts toward shortage clusters.",
      },
      {
        action: hasLearnedPattern
          ? "Monitor Chicago South breakfast item availability starting 24 hours before launch and continue through the first three promotion days."
          : "Monitor Chicago South breakfast item availability hourly during the first three promotion days.",
        owner: "Operations",
        timing: "Promotion launch week",
        expectedEffect: "Detects shortage risk early while promotion demand is highest.",
      },
    ],
    augustPromotionGuardrails: [
      hasLearnedPattern
        ? `Transfer ${transferUnits.toLocaleString()} units before demand lift begins, not after launch-day depletion appears.`
        : `Transfer ${transferUnits.toLocaleString()} units before promotion start.`,
      hasLearnedHints
        ? "Keep Chicago South above 6 days of supply during launch week because learned retrieval favored early shortage prevention."
        : "Keep Chicago South above 5 days of supply during launch week.",
      "Pause North replenishment until excess inventory normalizes.",
      "Escalate if Joliet DC cold chain capacity drops below 85%.",
    ],
    confidence: Math.min(0.97, Number((confidenceEvaluation.confidence + confidenceBoost).toFixed(2))),
  };
}
