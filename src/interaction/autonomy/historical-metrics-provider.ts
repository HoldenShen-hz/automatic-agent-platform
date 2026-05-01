/**
 * Historical Metrics Provider
 *
 * Provides interface for fetching historical execution data
 * to dynamically calculate autonomy level recommendations.
 */

import type { CapabilityTrustScore, AutonomyLevel } from "./index.js";

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  humanOverrides: number;
  incidents: number;
  lastIncidentAt: string | null;
}

export interface HistoricalMetricsInput {
  agentId: string;
  capabilityId: string;
  currentAutonomy: AutonomyLevel;
  windowDays: number;
}

export interface HistoricalMetricsProvider {
  fetchMetrics(input: HistoricalMetricsInput): Promise<ExecutionMetrics>;
}

import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionStatus } from "../../platform/contracts/types/status.js";

export class SqlExecutionMetricsProvider implements HistoricalMetricsProvider {
  public constructor(private readonly db: AuthoritativeSqlDatabase) {}

  public async fetchMetrics(input: HistoricalMetricsInput): Promise<ExecutionMetrics> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - input.windowDays);
    const windowStartIso = windowStart.toISOString();

    const rows = this.db.connection
      .prepare(
        `SELECT
          e.status,
          e.requires_approval,
          e.last_error_code,
          e.created_at
         FROM executions e
         WHERE e.agent_id = ?
           AND e.capability_id = ?
           AND e.created_at >= ?
         ORDER BY e.created_at DESC`,
      )
      .all(input.agentId, input.capabilityId, windowStartIso) as Array<{
        status: ExecutionStatus;
        requires_approval: number;
        last_error_code: string | null;
        created_at: string;
      }>;

    const totalExecutions = rows.length;
    const successfulExecutions = rows.filter((r: { status: ExecutionStatus }) => r.status === "succeeded").length;
    const failedExecutions = rows.filter((r: { status: ExecutionStatus }) => r.status === "failed").length;
    const humanOverrides = rows.filter((r: { requires_approval: number }) => r.requires_approval === 1).length;
    // §42: incidents are failed executions, not any execution that happened to log an error code.
    const incidents = rows.filter((r: { status: ExecutionStatus }) => r.status === "failed").length;
    const lastIncidentRow = rows.find((r: { status: ExecutionStatus }) => r.status === "failed");
    const lastIncidentAt = lastIncidentRow?.created_at ?? null;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      humanOverrides,
      incidents,
      lastIncidentAt,
    };
  }
}

export function toCapabilityTrustScore(
  metrics: ExecutionMetrics,
  input: HistoricalMetricsInput,
): CapabilityTrustScore {
  return {
    capabilityId: input.capabilityId,
    currentAutonomy: input.currentAutonomy,
    trustScore: 0,
    totalExecutions: metrics.totalExecutions,
    successfulExecutions: metrics.successfulExecutions,
    failedExecutions: metrics.failedExecutions,
    humanOverrides: metrics.humanOverrides,
    incidents: metrics.incidents,
    lastIncidentAgeDays: metrics.lastIncidentAt
      ? Math.floor((Date.now() - new Date(metrics.lastIncidentAt).getTime()) / (1000 * 60 * 60 * 24))
      : null,
  };
}
