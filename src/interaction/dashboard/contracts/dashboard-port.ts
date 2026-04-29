/**
 * Dashboard Port Interfaces
 *
 * Defines the port interfaces for dashboard-related data consumption.
 * This allows P1 (Interaction) to consume system data without direct
 * coupling to P4/P5 internal implementations.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §43
 */

/**
 * System health status levels.
 */
export type DashboardHealthStatus = "ok" | "degraded" | "overloaded" | "unhealthy";

/**
 * Provider health status.
 */
export type DashboardProviderHealth = "healthy" | "degraded" | "failed";

/**
 * Queue backlog state for dashboard consumption.
 */
export interface DashboardQueueBacklog {
  readonly size: number;
  readonly degraded: boolean;
}

/**
 * System situation data for dashboard display.
 *
 * This is the minimal set of system health data needed by dashboard
 * components in the P1 Interaction layer.
 */
export interface SystemSituationPort {
  readonly healthStatus: DashboardHealthStatus;
  readonly queueBacklog: DashboardQueueBacklog;
  readonly findings: readonly string[];
}

/**
 * Converts a full SystemSituation to the DashboardPort interface.
 */
export function toSystemSituationPort(
  system: SystemSituationPort,
): SystemSituationPort {
  return {
    healthStatus: system.healthStatus,
    queueBacklog: system.queueBacklog,
    findings: [...system.findings],
  };
}
