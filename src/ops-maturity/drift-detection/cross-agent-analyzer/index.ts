import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export interface CrossAgentMetric {
  agentId: string;
  domain: string;
  successRate: number;
  averageCostUsd: number;
  averageLatencyMs: number;
}

export interface CrossAgentAnalysisResult {
  bestAgentId: string | null;
  worstAgentId: string | null;
  divergenceScore: number;
  recommendation: string;
  /** §63.4: Alerts with domain peer grouping and anti-gaming filter */
  alerts: CrossAgentDriftAlert[];
  /** §63.4: Peer groups by domain for cross-agent comparison */
  peerGroups: Readonly<Record<string, readonly string[]>>;
}

export interface CrossAgentDriftAlert {
  readonly alertId: string;
  readonly severity: "low" | "medium" | "high";
  readonly detectedAt: string;
  readonly agentsInvolved: readonly string[];
  readonly domain: string;
  readonly divergenceScore: number;
  readonly antiGamingDetected: boolean;
  readonly recommendation: string;
}

export class CrossAgentAnalyzerService {
  private readonly alertHistory: CrossAgentDriftAlert[] = [];

  public analyze(metrics: CrossAgentMetric[]): CrossAgentAnalysisResult {
    if (metrics.length === 0) {
      return {
        bestAgentId: null,
        worstAgentId: null,
        divergenceScore: 0,
        recommendation: "insufficient_data",
        alerts: [],
        peerGroups: {},
      };
    }

    // §63.4: Build domain peer groups
    const peerGroups = this.buildPeerGroups(metrics);
    const allAlerts: CrossAgentDriftAlert[] = [];

    // Analyze each domain peer group separately
    for (const [domain, agentIds] of Object.entries(peerGroups)) {
      const domainMetrics = metrics.filter((m) => agentIds.includes(m.agentId));
      const groupResult = this.analyzePeerGroup(domainMetrics, domain);
      allAlerts.push(...groupResult.alerts);
    }

    // Cross-domain analysis for overall divergence
    const ranked = [...metrics].sort((left, right) =>
      scoreMetric(right) - scoreMetric(left),
    );
    const best = ranked[0]!;
    const worst = ranked.at(-1)!;
    const divergenceScore = Math.max(0, scoreMetric(best) - scoreMetric(worst));
    const antiGamingDetected = this.detectAntiGaming(metrics);

    const crossDomainAlert = this.buildDriftAlert(
      ranked.map((m) => m.agentId),
      divergenceScore,
      antiGamingDetected,
      "cross_domain",
    );
    if (crossDomainAlert) {
      allAlerts.push(crossDomainAlert);
      this.alertHistory.push(crossDomainAlert);
    }

    return {
      bestAgentId: best.agentId,
      worstAgentId: worst.agentId,
      divergenceScore,
      recommendation: divergenceScore >= 0.2
        ? "rebalance_or_rollout_review"
        : "agents_are_consistent",
      alerts: allAlerts,
      peerGroups,
    };
  }

  /**
   * Builds peer groups by domain per §63.4.
   */
  private buildPeerGroups(metrics: CrossAgentMetric[]): Record<string, readonly string[]> {
    const groups: Record<string, string[]> = {};
    for (const metric of metrics) {
      if (!groups[metric.domain]) {
        groups[metric.domain] = [];
      }
      groups[metric.domain].push(metric.agentId);
    }
    // Freeze the arrays to enforce readonly
    const readonlyGroups: Record<string, readonly string[]> = {};
    for (const [domain, agents] of Object.entries(groups)) {
      readonlyGroups[domain] = Object.freeze([...agents]);
    }
    return Object.freeze(readonlyGroups);
  }

  /**
   * Analyzes a single peer group (domain-specific).
   */
  private analyzePeerGroup(
    metrics: CrossAgentMetric[],
    domain: string,
  ): { alerts: CrossAgentDriftAlert[] } {
    if (metrics.length < 2) {
      return { alerts: [] };
    }

    const ranked = [...metrics].sort((left, right) =>
      scoreMetric(right) - scoreMetric(left),
    );
    const best = ranked[0]!;
    const worst = ranked.at(-1)!;
    const divergenceScore = Math.max(0, scoreMetric(best) - scoreMetric(worst));
    const antiGamingDetected = this.detectAntiGaming(metrics);

    const alert = this.buildDriftAlert(
      ranked.map((m) => m.agentId),
      divergenceScore,
      antiGamingDetected,
      domain,
    );
    const alerts: CrossAgentDriftAlert[] = [];
    if (alert) {
      alerts.push(alert);
      this.alertHistory.push(alert);
    }
    return { alerts };
  }

  public getDriftAlerts(): readonly CrossAgentDriftAlert[] {
    return [...this.alertHistory];
  }

  private detectAntiGaming(metrics: CrossAgentMetric[]): boolean {
    // Detect if agents are gaming metrics by checking for suspicious patterns
    const successRates = metrics.map((m) => m.successRate);
    const variance = this.computeVariance(successRates);
    const costVariance = this.computeVariance(metrics.map((m) => m.averageCostUsd));
    // High variance in success rates with low variance in cost may indicate gaming
    return variance > 0.3 && costVariance < 0.1;
  }

  private computeVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private buildDriftAlert(
    agentIds: string[],
    divergenceScore: number,
    antiGamingDetected: boolean,
    domain: string,
  ): CrossAgentDriftAlert | null {
    if (divergenceScore < 0.2 && !antiGamingDetected) return null;
    const severity: CrossAgentDriftAlert["severity"] =
      divergenceScore >= 0.4 || antiGamingDetected ? "high"
        : divergenceScore >= 0.3 ? "medium" : "low";
    return {
      alertId: newId("drift_alert"),
      severity,
      detectedAt: nowIso(),
      agentsInvolved: Object.freeze([...agentIds]),
      domain,
      divergenceScore,
      antiGamingDetected,
      recommendation: antiGamingDetected
        ? "anti_gaming_review_required"
        : divergenceScore >= 0.4
          ? "immediate_rebalance_required"
          : "monitoring_recommended",
    };
  }
}

function scoreMetric(metric: CrossAgentMetric): number {
  return metric.successRate - metric.averageCostUsd * 0.1 - metric.averageLatencyMs / 10_000;
}
