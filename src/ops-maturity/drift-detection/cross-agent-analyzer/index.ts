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
    const worst = ranked.at(-1)!;
    return {
      bestAgentId: best.agentId,
      worstAgentId: worst.agentId,
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

function computeMeanStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

function scoreMetric(metric: CrossAgentMetric, metrics: CrossAgentMetric[]): number {
  // Statistical composite scoring using z-score normalization
  // to avoid hardcoded linear formula that doesn't account for
  // cross-agent variance or statistical significance.
  const { mean: costMean, stdDev: costStdDev } = computeMeanStdDev(
    metrics.map((m) => m.averageCostUsd),
  );
  const { mean: latencyMean, stdDev: latencyStdDev } = computeMeanStdDev(
    metrics.map((m) => m.averageLatencyMs),
  );
  const { mean: successRateMean, stdDev: successRateStdDev } = computeMeanStdDev(
    metrics.map((m) => m.successRate),
  );
  const costZScore = costStdDev > 0 ? (metric.averageCostUsd - costMean) / costStdDev : 0;
  const latencyZScore = latencyStdDev > 0 ? (metric.averageLatencyMs - latencyMean) / latencyStdDev : 0;
  const successRateZScore = successRateStdDev > 0 ? (metric.successRate - successRateMean) / successRateStdDev : 0;
  // All three metrics now contribute equally with z-score normalization.
  // Higher successRate is beneficial (positive z-score), lower cost/latency is beneficial (negative z-score).
  return successRateZScore - costZScore * 0.1 - latencyZScore * 0.1;
}
