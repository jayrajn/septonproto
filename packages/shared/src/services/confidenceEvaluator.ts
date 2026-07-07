import type { ConfidenceOperator, ConfidenceRule, ContextBundle } from "../domain/types";

export interface ConfidenceEvaluation {
  confidence: number;
  baseConfidence: number;
  earnedWeight: number;
  totalWeight: number;
  ruleResults: Array<{
    description: string;
    metric: string;
    actualValue: number;
    operator: ConfidenceOperator;
    threshold: number;
    passed: boolean;
    weight: number;
  }>;
}

export function evaluateConfidence(bundle: ContextBundle): ConfidenceEvaluation {
  const metrics = collectConfidenceMetrics(bundle);
  const ruleResults = bundle.capability.confidenceRules.map((rule) => {
    const actualValue = metrics[rule.metric] ?? 0;
    const passed = compare(actualValue, rule.operator, rule.threshold);
    return {
      description: rule.description,
      metric: rule.metric,
      actualValue,
      operator: rule.operator,
      threshold: rule.threshold,
      passed,
      weight: rule.weight,
    };
  });

  const totalWeight = sumWeights(bundle.capability.confidenceRules);
  const earnedWeight = ruleResults.reduce((total, result) => total + (result.passed ? result.weight : 0), 0);
  const baseConfidence = 0.55;
  const confidenceRange = 0.35;
  const normalizedScore = totalWeight === 0 ? 0 : earnedWeight / totalWeight;
  const confidence = Number((baseConfidence + normalizedScore * confidenceRange).toFixed(2));

  return {
    confidence,
    baseConfidence,
    earnedWeight,
    totalWeight,
    ruleResults,
  };
}

function collectConfidenceMetrics(bundle: ContextBundle): Record<string, number> {
  const impactRecord = bundle.vectorHits
    .map((hit) => hit.record)
    .filter(
      (record) =>
        record.type === "sales_kpi" &&
        typeof record.payload.salesChangePct === "number" &&
        typeof record.payload.nationalContributionToDeclinePct === "number",
    )
    .sort(
      (left, right) =>
        numberMetric(right.payload.nationalContributionToDeclinePct) -
        numberMetric(left.payload.nationalContributionToDeclinePct),
    )[0];
  const supportingSources = new Set(bundle.vectorHits.map((hit) => hit.record.source));

  return {
    marketSalesDeclinePercentage: numberMetric(impactRecord?.payload.salesChangePct),
    nationalDeclineContributionPercentage: numberMetric(impactRecord?.payload.nationalContributionToDeclinePct),
    supportingSourceCount: supportingSources.size,
    freshLiveRecordCount: bundle.liveData.length,
  };
}

function compare(actualValue: number, operator: ConfidenceOperator, threshold: number): boolean {
  switch (operator) {
    case "<":
      return actualValue < threshold;
    case "<=":
      return actualValue <= threshold;
    case ">":
      return actualValue > threshold;
    case ">=":
      return actualValue >= threshold;
    case "==":
      return actualValue === threshold;
    case "!=":
      return actualValue !== threshold;
  }
}

function numberMetric(value: string | number | boolean | string[] | undefined): number {
  return typeof value === "number" ? value : 0;
}

function sumWeights(rules: ConfidenceRule[]): number {
  return rules.reduce((total, rule) => total + rule.weight, 0);
}
