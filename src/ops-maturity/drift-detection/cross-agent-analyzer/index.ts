import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export interface CrossAgentMetric {
  agentId: string;
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
  readonly severity: "low" | "medium" | "high";
  readonly detectedAt: string;
  readonly agentsInvolved: readonly string[];
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
      };
    }
    const ranked = [...metrics].sort((left, right) =>
      scoreMetric(right) - scoreMetric(left),
    );
    const best = ranked[0]!;
    const worst = ranked.at(-1)!;
    const divergenceScore = Math.max(0, scoreMetric(best) - scoreMetric(worst));
    const antiGamingDetected = this.detectAntiGaming(metrics);
    const alert = this.buildDriftAlert(ranked, divergenceScore, antiGamingDetected);
    if (alert) {
      this.alertHistory.push(alert);
    }

    // Build structured recommendation based on analysis results
    const recommendation = this.buildStructuredRecommendation(ranked, divergenceScore, antiGamingDetected);
    return {
      bestAgentId: best.agentId,
      worstAgentId: worst.agentId,
      divergenceScore,
      recommendation,
      alerts: [...this.alertHistory],
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
      severity,
      detectedAt: nowIso(),
      agentsInvolved: ranked.map((m) => m.agentId),
      divergenceScore,
      antiGamingDetected,
      recommendation: this.buildStructuredRecommendation(ranked, divergenceScore, antiGamingDetected),
    };
  }
}

function scoreMetric(metric: CrossAgentMetric): number {
  return metric.successRate - metric.averageCostUsd * 0.1 - metric.averageLatencyMs / 10_000;
}
