import type { ContextBundle, Recommendation } from "../domain/types";
import { evaluateConfidence } from "./confidenceEvaluator";

function numberFromPayload(value: string | number | boolean | string[] | undefined): number {
  return typeof value === "number" ? value : 0;
}

export function runDecisionWorkflow(bundle: ContextBundle): Recommendation {
  const recordById = new Map([
    ...bundle.vectorHits.map((hit) => [hit.record.id, hit.record] as const),
    ...bundle.liveData.map((record) => [record.id, record] as const),
  ]);
  const usSales = recordById.get("bq-us-week-2026-06-22");
  const chicagoSales = recordById.get("bq-chicago-breakfast-2026-06-22");
  const inventory = recordById.get("sap-egg-inventory-midwest");
  const supplier = recordById.get("sap-supplier-omega-foods-delay");
  const service = recordById.get("servicenow-pos-mobile-midwest");
  const campaign = recordById.get("sf-june-breakfast-campaign-paused");

  const nationalDecline = numberFromPayload(usSales?.payload.totalSalesChangePct);
  const contribution = numberFromPayload(chicagoSales?.payload.nationalContributionToDeclinePct);
  const confidenceEvaluation = evaluateConfidence(bundle);

  return {
    headline: `US sales declined ${Math.abs(nationalDecline).toFixed(1)}% last week, with Chicago breakfast explaining about ${contribution}% of the national decline.`,
    rootCauses: [
      {
        cause: "Breakfast supply constraint in Chicago",
        impact: `${numberFromPayload(inventory?.payload.stockoutStores)} stores had partial egg item stockouts; Midwest fill rate fell to ${numberFromPayload(inventory?.payload.fillRatePct)}%.`,
        evidence: `${inventory?.source}: ${inventory?.title}. ${supplier?.source}: ${supplier?.title}.`,
        confidence: 0.91,
      },
      {
        cause: "Digital ordering degradation during breakfast peak",
        impact: `${numberFromPayload(service?.payload.incidentCount)} mobile incidents occurred during 07:00-09:00; estimated conversion dropped ${Math.abs(numberFromPayload(service?.payload.conversionDropPct)).toFixed(1)}%.`,
        evidence: `${service?.source}: ${service?.title}.`,
        confidence: 0.82,
      },
      {
        cause: "Marketing support missed the launch window",
        impact: `Breakfast Value Push reached 420k people versus 1.2M planned, reducing demand recovery during the same week.`,
        evidence: `${campaign?.source}: ${campaign?.title}.`,
        confidence: 0.78,
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
        action: "Create a breakfast promotion readiness gate covering supplier fill rate, DC delivery status, mobile order health, and creative approvals.",
        owner: "US Operations",
        timing: "Before August promotion launch",
        expectedEffect: "Reduces repeat decline risk by catching cross-functional readiness gaps before traffic is stimulated.",
      },
      {
        action: "Set an August supply buffer for egg patties in Midwest distribution centers and require supplier confirmation 7 days before launch.",
        owner: "Supply Chain",
        timing: "T-14 to T-7 days",
        expectedEffect: "Protects promoted breakfast items from supplier delay and local stockout risk.",
      },
      {
        action: "Run mobile ordering load and incident review for breakfast windows in Midwest stores.",
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
      "Do not launch Chicago breakfast-heavy promotion unless egg patty fill rate is at least 96%.",
      "Require zero Sev-1 or Sev-2 mobile ordering incidents in the prior 72 hours.",
      "Require campaign creative approval and media trafficking complete by July 20, 2026.",
      "Monitor Chicago breakfast transactions hourly for the first three launch days.",
    ],
    confidence: confidenceEvaluation.confidence,
  };
}
