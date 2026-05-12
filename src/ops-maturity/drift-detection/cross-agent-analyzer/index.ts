import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export interface CrossAgentMetric {
  agentId: string;
  domainId?: string | null;
  successRate: number;
  averageCostUsd: number;
  averageLatencyMs: number;
  taskKindDistribution?: Readonly<{
    real?: number;
    synthetic?: number;
    keepalive?: number;
  }>;
}

export interface CrossAgentAnalysisResult {
  bestAgentId: string | null;
  worstAgentId: string | null;
  divergenceScore: number;
  /** Structured actionable recommendation with code, action, and rationale. */
  recommendation: CrossAgentRecommendation;
  alerts: readonly CrossAgentDriftAlert[];
  peerGroups: readonly CrossAgentPeerGroupSummary[];
}

/** Structured recommendation format replacing generic string. */
export interface CrossAgentRecommendation {
  code: string;
  action: CrossAgentAction;
  rationale: string;
  priority: "low" | "medium" | "high" | "critical";
  affectedAgents: readonly string[];
}

export type CrossAgentAction =
  | "rebalance_workload"
  | "immediate_rollback"
  | "monitoring_enhanced"
  | "anti_gaming_review"
  | "cost_optimization"
  | "latency_investigation"
  | "agents_consistent"
  | "insufficient_data";

export interface CrossAgentDriftAlert {
  readonly alertId: string;
  readonly peerGroupId: string;
  readonly severity: "low" | "medium" | "high";
  readonly detectedAt: string;
  readonly agentsInvolved: readonly string[];
  readonly divergenceScore: number;
  readonly antiGamingDetected: boolean;
  readonly recommendation: CrossAgentRecommendation;
}

export interface CrossAgentPeerGroupSummary {
  readonly peerGroupId: string;
  readonly agentIds: readonly string[];
  readonly divergenceScore: number;
  readonly antiGamingDetected: boolean;
  readonly recommendation: CrossAgentRecommendation;
}

export class CrossAgentAnalyzerService {
  private readonly alertHistory: CrossAgentDriftAlert[] = [];

  public analyze(metrics: CrossAgentMetric[]): CrossAgentAnalysisResult {
    if (metrics.length === 0) {
      return {
        bestAgentId: null,
        worstAgentId: null,
        divergenceScore: 0,
        recommendation: {
          code: "INSUFFICIENT_DATA",
          action: "insufficient_data",
          rationale: "No agent metrics available for cross-agent analysis.",
          priority: "low",
          affectedAgents: [],
        },
        alerts: [],
        peerGroups: [],
      };
    }
    const groupedMetrics = this.groupByPeerGroup(metrics);
    const peerGroups = groupedMetrics.map(([peerGroupId, groupMetrics]) =>
      this.analyzePeerGroup(peerGroupId, groupMetrics),
    );
    const primaryGroup = peerGroups.reduce((selected, current) =>
      current.divergenceScore > selected.divergenceScore ? current : selected,
    );

    for (const alert of primaryGroup.alerts) {
      this.alertHistory.push(alert);
    }

    const ranked = primaryGroup.ranked;
    const best = ranked[0]!;
    return {
      bestAgentId: best.agentId,
      worstAgentId: ranked.length > 1 ? ranked.at(-1)?.agentId ?? null : null,
      divergenceScore: primaryGroup.divergenceScore,
      recommendation: primaryGroup.recommendation,
      alerts: [...this.alertHistory],
      peerGroups: peerGroups.map(({ ranked: _ranked, alerts: _alerts, ...summary }) => summary),
    };
  }

  private analyzePeerGroup(
    peerGroupId: string,
    metrics: CrossAgentMetric[],
  ): CrossAgentPeerGroupSummary & {
    readonly ranked: CrossAgentMetric[];
    readonly alerts: readonly CrossAgentDriftAlert[];
  } {
    const ranked = [...metrics].sort((left, right) => scoreMetric(right, metrics) - scoreMetric(left, metrics));
    if (ranked.length === 1) {
      return {
        peerGroupId,
        agentIds: ranked.map((metric) => metric.agentId),
        divergenceScore: 0,
        antiGamingDetected: false,
        recommendation: this.buildInsufficientDataRecommendation(ranked),
        ranked,
        alerts: [],
      };
    }

    const best = ranked[0]!;
    const worst = ranked.at(-1)!;
    const divergenceScore = Math.max(0, scoreMetric(best, metrics) - scoreMetric(worst, metrics));
    const antiGamingDetected = this.detectAntiGaming(metrics);
    const recommendation = this.buildStructuredRecommendation(ranked, divergenceScore, antiGamingDetected);
    const alert = this.buildDriftAlert(peerGroupId, ranked, divergenceScore, antiGamingDetected);
    return {
      peerGroupId,
      agentIds: ranked.map((metric) => metric.agentId),
      divergenceScore,
      antiGamingDetected,
      recommendation,
      ranked,
      alerts: alert ? [alert] : [],
    };
  }

  private buildStructuredRecommendation(
    ranked: CrossAgentMetric[],
    divergenceScore: number,
    antiGamingDetected: boolean,
  ): CrossAgentRecommendation {
    const agentIds = ranked.map((m) => m.agentId);

    if (antiGamingDetected) {
      return {
        code: "ANTI_GAMING_DETECTED",
        action: "anti_gaming_review",
        rationale: `Anti-gaming pattern detected: high success rate with anomalous task mix (synthetic/keepalive > 50%). Divergence score: ${divergenceScore.toFixed(3)}.`,
        priority: "critical",
        affectedAgents: agentIds,
      };
    }

    if (divergenceScore >= 0.4) {
      return {
        code: "HIGH_DIVERGENCE",
        action: "immediate_rollback",
        rationale: `Critical divergence (${(divergenceScore * 100).toFixed(1)}%) between best/worst agents. Best: ${ranked[0]?.agentId}, Worst: ${ranked.at(-1)?.agentId}. Significant workload rebalance or rollback required.`,
        priority: "critical",
        affectedAgents: [ranked[0]?.agentId ?? "", ranked.at(-1)?.agentId ?? ""].filter(Boolean),
      };
    }

    if (divergenceScore >= 0.2) {
      // Check if cost or latency is the primary divergence driver
      const costVariance = this.computeVariance(ranked.map((m) => m.averageCostUsd));
      const latencyVariance = this.computeVariance(ranked.map((m) => m.averageLatencyMs));
      if (costVariance > 0.05) {
        return {
          code: "COST_DIVERGENCE",
          action: "cost_optimization",
          rationale: `Moderate divergence (${(divergenceScore * 100).toFixed(1)}%) driven by cost variance. Agents should be reviewed for cost efficiency rebalancing.`,
          priority: "medium",
          affectedAgents: agentIds,
        };
      }
      if (latencyVariance > 0.1) {
        return {
          code: "LATENCY_DIVERGENCE",
          action: "latency_investigation",
          rationale: `Moderate divergence (${(divergenceScore * 100).toFixed(1)}%) driven by latency variance. High-latency agents should be investigated.`,
          priority: "medium",
          affectedAgents: agentIds,
        };
      }
      return {
        code: "MODERATE_DIVERGENCE",
        action: "rebalance_workload",
        rationale: `Moderate divergence (${(divergenceScore * 100).toFixed(1)}%) detected. Workload rebalance or rollout review recommended.`,
        priority: "medium",
        affectedAgents: agentIds,
      };
    }

    return {
      code: "CONSISTENT",
      action: "agents_consistent",
      rationale: `Agents are performing consistently. Divergence score: ${(divergenceScore * 100).toFixed(1)}%. No immediate action required.`,
      priority: "low",
      affectedAgents: agentIds,
    };
  }

  private buildInsufficientDataRecommendation(ranked: readonly CrossAgentMetric[]): CrossAgentRecommendation {
    return {
      code: "INSUFFICIENT_PEER_DATA",
      action: "insufficient_data",
      rationale: "Only one agent is present in this peer group, so divergence analysis requires more peers before ranking a worst performer.",
      priority: "low",
      affectedAgents: ranked.map((metric) => metric.agentId),
    };
  }

  public getDriftAlerts(): readonly CrossAgentDriftAlert[] {
    return [...this.alertHistory];
  }

  private detectAntiGaming(metrics: CrossAgentMetric[]): boolean {
    const successRates = metrics.map((m) => m.successRate);
    const variance = this.computeVariance(successRates);
    const costVariance = this.computeVariance(metrics.map((m) => m.averageCostUsd));
    const provenanceGaming = metrics.some((metric) => {
      const taskMix = metric.taskKindDistribution ?? {};
      const total = (taskMix.real ?? 0) + (taskMix.synthetic ?? 0) + (taskMix.keepalive ?? 0);
      if (total <= 0) {
        return false;
      }
      const realRatio = (taskMix.real ?? 0) / total;
      const syntheticRatio = (taskMix.synthetic ?? 0) / total;
      const keepaliveRatio = (taskMix.keepalive ?? 0) / total;
      return realRatio < 0.5 && (syntheticRatio + keepaliveRatio) > 0.5 && metric.successRate >= 0.85;
    });
    return provenanceGaming || (variance > 0.3 && costVariance < 0.1);
  }

  private computeVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private buildDriftAlert(
    peerGroupId: string,
    ranked: CrossAgentMetric[],
    divergenceScore: number,
    antiGamingDetected: boolean,
  ): CrossAgentDriftAlert | null {
    if (divergenceScore < 0.2 && !antiGamingDetected) return null;
    const severity: CrossAgentDriftAlert["severity"] =
      divergenceScore >= 0.4 || antiGamingDetected ? "high" :
        divergenceScore >= 0.3 ? "medium" : "low";
    return {
      alertId: newId("drift_alert"),
      peerGroupId,
      severity,
      detectedAt: nowIso(),
      agentsInvolved: ranked.map((m) => m.agentId),
      divergenceScore,
      antiGamingDetected,
      recommendation: this.buildStructuredRecommendation(ranked, divergenceScore, antiGamingDetected),
    };
  }

  private groupByPeerGroup(metrics: CrossAgentMetric[]): Array<[string, CrossAgentMetric[]]> {
    const grouped = new Map<string, CrossAgentMetric[]>();
    for (const metric of metrics) {
      const peerGroupId = metric.domainId?.trim() || "domain:global";
      const bucket = grouped.get(peerGroupId) ?? [];
      bucket.push(metric);
      grouped.set(peerGroupId, bucket);
    }
    return [...grouped.entries()];
  }
}

/**
 * Welch's t-test for significance testing between two distributions.
 * Returns the two-tailed p-value.
 */
function welchTTest(left: number[], right: number[]): number {
  const n1 = left.length;
  const n2 = right.length;
  if (n1 === 0 || n2 === 0) return 1;
  const mean1 = left.reduce((a, b) => a + b, 0) / n1;
  const mean2 = right.reduce((a, b) => a + b, 0) / n2;
  const var1 = left.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1);
  const var2 = right.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1);
  const tStat = Math.abs(mean1 - mean2) / Math.sqrt(var1 / n1 + var2 / n2);
  // Welch-Satterthwaite degrees of freedom approximation
  const df = Math.pow(var1 / n1 + var2 / n2, 2) /
    (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
  return studentTCdf(tStat, df);
}

/** Two-tailed p-value from Student's t-distribution via beta incomplete function approximation. */
function studentTCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  return 1 - 0.5 * betaIncomplete(x, df / 2, 0.5);
}

/** Regularized incomplete beta function — Lanczos approximation. */
function betaIncomplete(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lnbeta = logBeta(a, b);
  const pdf = Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnbeta);
  return pdf * continuedFraction(x, a, b);
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const t = x - 1;
  let acc = c[0]!;
  for (let i = 1; i < g + 2; i++) acc += c[i]! / (t + i);
  return Math.log(2 * Math.PI) / 2 + (t + 0.5) * Math.log(t + g + 0.5) - (t + g + 0.5) + acc;
}

function continuedFraction(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 1e-14;
  const fpmin = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1e30;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

/** CUSUM changepoint detector — returns true if a significant structural break is detected. */
function hasChangepoint(values: number[]): boolean {
  if (values.length < 4) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  if (stdDev < 1e-9) return false;
  const cusumPos = values.reduce((s, v) => Math.max(0, s + (v - mean) / stdDev), 0);
  const cusumNeg = values.reduce((s, v) => Math.max(0, s - (v - mean) / stdDev), 0);
  return cusumPos > 3 || cusumNeg > 3;
}

function computeMeanStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

function scoreMetric(metric: CrossAgentMetric, metrics: CrossAgentMetric[]): number {
  void metrics;
  return metric.successRate - (metric.averageCostUsd * 0.1) - (metric.averageLatencyMs / 10_000);
}

/**
 * Bootstrap-based significance test: checks if the given value falls outside
 * a confidence interval built from resampled peers.
 */
function isSignificantlyDifferent(value: number, peerValues: number[], alpha = 0.05): boolean {
  if (peerValues.length < 3) {
    const { mean, stdDev } = computeMeanStdDev(peerValues);
    if (stdDev > 0) {
      const zScore = Math.abs(value - mean) / stdDev;
      if (zScore > 1.25) {
        return true;
      }
    }
    const denominator = Math.max(Math.abs(mean), 1e-9);
    return Math.abs(value - mean) / denominator >= 0.2;
  }
  const iterations = 100;
  const bootstrapMeans: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample = peerValues.map(() => peerValues[Math.floor(Math.random() * peerValues.length)]!);
    bootstrapMeans.push(sample.reduce((a, b) => a + b, 0) / sample.length);
  }
  bootstrapMeans.sort((a, b) => a - b);
  const lower = bootstrapMeans[Math.floor(alpha / 2 * iterations)!]!;
  const upper = bootstrapMeans[Math.floor((1 - alpha / 2) * iterations)!]!;
  return value < lower || value > upper;
}
