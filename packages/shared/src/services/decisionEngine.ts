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
  const stage = bundle.currentRunStage;
  const confidenceBoost = stage === 1 ? 0 : stage === 2 ? 0.03 : stage === 3 ? 0.06 : 0.09;
  const hasRejectedLearning =
    bundle.appliedRejectedRetrievalHints.length > 0 || bundle.appliedNegativeDecisionPatterns.length > 0;

  return {
    headline:
      hasRejectedLearning
        ? "Choose a different August prevention path and avoid repeating the previously rejected breakfast launch recommendation."
        : stage === 1
        ? "Approve a breakfast promotion readiness gate for August, focused on Chicago supply, mobile ordering stability, and campaign launch readiness."
        : stage === 2
          ? "Tighten August breakfast recovery around supplier stability and mobile ordering reliability before campaign scale-up."
          : stage === 3
            ? "Activate a launch-readiness playbook for August and block launch until supply, digital health, and campaign execution all clear the learned gate."
            : "Reuse the stored August launch playbook and refresh this week's context before final launch approval.",
    rootCauses: [
      {
        cause: hasRejectedLearning
          ? "Previously rejected launch gate should not be reused unchanged"
          : "Breakfast supply constraint in Chicago",
        impact: hasRejectedLearning
          ? `The prior recommendation was rejected, so Septon is keeping the supply evidence but requiring a materially different Chicago recovery path before launch approval.`
          : `${numberFromPayload(inventory?.payload.stockoutStores)} stores had partial egg item stockouts; Midwest fill rate fell to ${numberFromPayload(inventory?.payload.fillRatePct)}%.`,
        evidence: `${inventory?.source}: ${inventory?.title}. ${supplier?.source}: ${supplier?.title}.`,
        confidence: hasRejectedLearning ? 0.84 : stage >= 3 ? 0.94 : stage === 2 ? 0.92 : 0.91,
      },
      {
        cause: hasRejectedLearning
          ? "Store-level recovery evidence is now required"
          : "Digital ordering degradation during breakfast peak",
        impact:
          hasRejectedLearning
            ? `${numberFromPayload(service?.payload.incidentCount)} mobile incidents still matter, but Septon is reducing the weight of the previously rejected supplier-service-campaign framing and looking for a different prevention path.`
            : stage >= 2
            ? `${numberFromPayload(service?.payload.incidentCount)} mobile incidents occurred during 07:00-09:00; retrieval learning pushed digital reliability higher in the context bundle because conversion dropped ${Math.abs(numberFromPayload(service?.payload.conversionDropPct)).toFixed(1)}%.`
            : `${numberFromPayload(service?.payload.incidentCount)} mobile incidents occurred during 07:00-09:00; estimated conversion dropped ${Math.abs(numberFromPayload(service?.payload.conversionDropPct)).toFixed(1)}%.`,
        evidence: `${service?.source}: ${service?.title}.`,
        confidence: hasRejectedLearning ? 0.77 : stage >= 4 ? 0.89 : stage >= 2 ? 0.86 : 0.82,
      },
      {
        cause: "Marketing support missed the launch window",
        impact:
          stage === 1
            ? "Breakfast Value Push reached 420k people versus 1.2M planned, reducing demand recovery during the same week."
            : stage === 2
              ? "Breakfast Value Push reached 420k people versus 1.2M planned, and retrieval learning raised launch execution as a stronger contributor to the decline."
              : stage === 3
                ? "Breakfast Value Push reached 420k people versus 1.2M planned, and the learned readiness playbook now treats delayed approvals as a launch blocker."
                : "Breakfast Value Push reached 420k people versus 1.2M planned, and enterprise memory reused the prior launch playbook to keep campaign readiness in the final recommendation.",
        evidence: `${campaign?.source}: ${campaign?.title}.`,
        confidence: stage >= 3 ? 0.84 : stage === 2 ? 0.81 : 0.78,
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
        action:
          hasRejectedLearning
            ? "Replace the rejected launch-readiness recommendation with a narrower Chicago breakfast recovery plan focused on store-level controls and hourly launch monitoring."
            : stage === 1
            ? "Create a breakfast promotion readiness gate covering supplier fill rate, DC delivery status, mobile order health, and creative approvals."
            : stage === 2
              ? "Escalate supplier and digital health checks earlier and hold August campaign scale-up until those checks are green."
              : stage === 3
                ? "Activate the learned breakfast launch readiness gate and require explicit COO sign-off if supplier, digital, or campaign thresholds are below target."
                : "Reuse the stored launch-readiness playbook from enterprise memory and revalidate it against this run's refreshed supply, service, and campaign context.",
        owner: "US Operations",
        timing: "Before August promotion launch",
        expectedEffect: "Reduces repeat decline risk by catching cross-functional readiness gaps before traffic is stimulated.",
      },
      {
        action:
          hasRejectedLearning
            ? "Run a Chicago-only recovery checkpoint before approving the August push, and require store-level evidence that breakfast execution can recover without reusing the rejected launch gate."
            : stage === 1
            ? "Set an August supply buffer for egg patties in Midwest distribution centers and require supplier confirmation 7 days before launch."
            : stage === 2
              ? "Move supplier confirmation earlier and tie it to a stricter Midwest fill-rate checkpoint before launch."
              : stage === 3
                ? "Set the Midwest egg patty buffer earlier and require supplier confirmation 10 days before launch so the learned supply gate can be enforced before media spend starts."
                : "Carry forward the stored supply gate from enterprise memory and refresh the supplier checkpoint using this run's current inventory and incident signals.",
        owner: "Supply Chain",
        timing: stage >= 3 ? "T-21 to T-10 days" : stage === 2 ? "T-18 to T-10 days" : "T-14 to T-7 days",
        expectedEffect: "Protects promoted breakfast items from supplier delay and local stockout risk.",
      },
      {
        action:
          stage === 1
            ? "Run mobile ordering load and incident review for breakfast windows in Midwest stores."
            : stage === 2
              ? "Treat breakfast-window mobile incidents as a higher-priority gate and run a focused digital reliability review before launch."
              : stage === 3
                ? "Run a pre-launch mobile ordering load test and incident hold-point for Midwest breakfast windows because approved evidence showed digital reliability is an early warning signal."
                : "Reuse the stored digital gate from enterprise memory and refresh the mobile readiness decision using this run's latest incident context.",
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
      hasRejectedLearning
        ? "Do not repeat the previously rejected launch-readiness recommendation without materially different Chicago evidence."
        : stage >= 3
        ? "Do not launch Chicago breakfast-heavy promotion unless the learned readiness gate is green across fill rate, supplier delivery, digital health, and campaign approval."
        : stage === 2
          ? "Do not scale the August breakfast push until supplier and digital checkpoints both clear the updated retrieval-based review."
          : "Do not launch Chicago breakfast-heavy promotion unless egg patty fill rate is at least 96%.",
      stage >= 2
        ? "Require a clean breakfast-window mobile test run and zero Sev-1 or Sev-2 mobile ordering incidents in the prior 72 hours."
        : "Require zero Sev-1 or Sev-2 mobile ordering incidents in the prior 72 hours.",
      stage >= 3
        ? "Require campaign creative approval and media trafficking complete by July 18, 2026 to satisfy the learned launch gating window."
        : "Require campaign creative approval and media trafficking complete by July 20, 2026.",
      "Monitor Chicago breakfast transactions hourly for the first three launch days.",
    ],
    confidence: hasRejectedLearning
      ? Math.max(0.58, Number((confidenceEvaluation.confidence - 0.08).toFixed(2)))
      : Math.min(0.98, Number((confidenceEvaluation.confidence + confidenceBoost).toFixed(2))),
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
  const stage = bundle.currentRunStage;
  const confidenceBoost = stage === 1 ? 0 : stage === 2 ? 0.03 : stage === 3 ? 0.06 : 0.09;
  const hasRejectedLearning =
    bundle.appliedRejectedRetrievalHints.length > 0 || bundle.appliedNegativeDecisionPatterns.length > 0;

  return {
    headline:
      hasRejectedLearning
        ? `Avoid repeating the rejected transfer-first plan. Re-evaluate Chicago inventory using a different shortage prevention path before moving ${transferUnits.toLocaleString()} units.`
        : stage === 1
        ? `Move ${transferUnits.toLocaleString()} egg patty units from Chicago North to Chicago South before the August promotion.`
        : stage === 2
          ? `Move ${transferUnits.toLocaleString()} units earlier because expected promotion demand and transfer capacity both support an early shift.`
          : stage === 3
            ? `Pre-position ${transferUnits.toLocaleString()} egg patty units from Chicago North to Chicago South before promotion demand begins.`
            : `Reuse the stored inventory playbook and refresh the transfer using the latest demand and transfer data.`,
    rootCauses: [
      {
        cause: hasRejectedLearning
          ? "Rejected transfer-first path requires an alternate stock plan"
          : "Inventory imbalance across Chicago store clusters",
        impact: hasRejectedLearning
          ? `The prior transfer-first recommendation was rejected, so Septon is keeping the imbalance evidence but requiring an alternate shortage prevention option before repeating the same move.`
          : `Chicago North has ${excessUnits.toLocaleString()} excess units while Chicago South is short ${shortageUnits.toLocaleString()} units.`,
        evidence: `${north?.source}: ${north?.title}. ${south?.source}: ${south?.title}.`,
        confidence: hasRejectedLearning ? 0.81 : stage >= 3 ? 0.93 : stage === 2 ? 0.91 : 0.9,
      },
      {
        cause: hasRejectedLearning
          ? "Demand risk still exists, but the transfer answer is constrained"
          : "Expected promotion demand increases shortage risk",
        impact:
          hasRejectedLearning
            ? `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, but Septon is suppressing the previously rejected transfer-first framing and forcing a different inventory recommendation path.`
            : stage === 1
            ? `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, with Chicago South marked as the highest risk cluster.`
            : stage === 2
              ? `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, and this run prioritized that demand signal earlier in the context bundle.`
              : stage === 3
                ? `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, and Septon now treats that uplift as a signal to rebalance before launch rather than after the first demand spike.`
                : `Breakfast demand is forecast to rise ${demandLift}% during the August promotion, and Septon reused the earlier inventory playbook together with refreshed demand and transfer context.`,
        evidence: `${demand?.source}: ${demand?.title}. ${promotion?.source}: ${promotion?.title}.`,
        confidence: stage >= 4 ? 0.9 : stage >= 2 ? 0.88 : 0.84,
      },
      {
        cause: "Distribution capacity can support the transfer",
        impact: `Joliet DC can move up to ${numberFromPayload(dc?.payload.availableTransferUnits).toLocaleString()} units within ${numberFromPayload(dc?.payload.transferWindowHours)} hours.`,
        evidence: `${dc?.source}: ${dc?.title}.`,
        confidence: 0.81,
      },
    ],
    actions: [
      {
        action:
          hasRejectedLearning
            ? "Validate an alternative shortage prevention plan before approving another Chicago North to Chicago South transfer."
            : stage === 1
            ? `Transfer ${transferUnits.toLocaleString()} egg patty units from Chicago North stores to Chicago South stores.`
            : stage === 2
              ? `Move ${transferUnits.toLocaleString()} units earlier because promotion demand risk and transfer capacity were prioritized in this run.`
              : stage === 3
                ? `Pre-position the transfer of ${transferUnits.toLocaleString()} egg patty units from Chicago North stores to Chicago South stores before promotion week opens.`
                : `Reuse the stored inventory playbook and refresh the transfer amount using this run's latest demand and transfer context.`,
        owner: "Supply Chain",
        timing: stage >= 3 ? "Before promotion week" : stage === 2 ? "Within 72 hours" : "Within 48 hours",
        expectedEffect: "Closes the South cluster shortage without creating a new North cluster stockout.",
      },
      {
        action:
          hasRejectedLearning
            ? "Tighten launch-week shortage monitoring and require a second inventory option if the same transfer-first recommendation would be repeated."
            : stage === 1
            ? "Pause Chicago North replenishment until days of supply returns to target."
            : stage === 2
              ? "Pause Chicago North replenishment sooner because this run raised the imbalance signal earlier in the recommendation."
              : stage === 3
                ? "Pause Chicago North replenishment and release stock only after South shortage risk normalizes."
                : "Reuse the stored replenishment rule and refresh it with this run's latest imbalance context.",
        owner: "Inventory Planning",
        timing: "Before next replenishment cycle",
        expectedEffect: "Prevents additional overstock while demand shifts toward shortage clusters.",
      },
      {
        action:
          stage === 1
            ? "Monitor Chicago South breakfast item availability hourly during the first three promotion days."
            : stage === 2
              ? "Start shortage monitoring earlier because this run raised launch-week demand risk sooner."
              : stage === 3
                ? "Monitor Chicago South breakfast item availability starting 24 hours before launch and continue through the first three promotion days."
                : "Reuse the stored monitoring playbook and refresh it with this run's latest launch-week demand context.",
        owner: "Operations",
        timing: "Promotion launch week",
        expectedEffect: "Detects shortage risk early while promotion demand is highest.",
      },
    ],
    augustPromotionGuardrails: [
      hasRejectedLearning
        ? "Do not reuse the previously rejected transfer-first inventory plan without a materially different shortage mitigation path."
        : stage >= 3
        ? `Transfer ${transferUnits.toLocaleString()} units before demand rises, not after launch-day shortages begin.`
        : stage === 2
          ? `Move ${transferUnits.toLocaleString()} units earlier because launch-week shortage risk is elevated.`
          : `Transfer ${transferUnits.toLocaleString()} units before promotion start.`,
      stage >= 2
        ? "Keep Chicago South above 6 days of supply during launch week to reduce shortage risk."
        : "Keep Chicago South above 5 days of supply during launch week.",
      "Pause North replenishment until excess inventory normalizes.",
      "Escalate if Joliet DC cold chain capacity drops below 85%.",
    ],
    confidence: hasRejectedLearning
      ? Math.max(0.55, Number((confidenceEvaluation.confidence - 0.09).toFixed(2)))
      : Math.min(0.97, Number((confidenceEvaluation.confidence + confidenceBoost).toFixed(2))),
  };
}
