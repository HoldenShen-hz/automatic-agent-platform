/**
 * RPO/RTO Tracking Service
 *
 * Implements Recovery Point Objective (RPO) and Recovery Time Objective (RTO)
 * tracking and guarantees for multi-region deployments.
 *
 * RPO: Maximum acceptable data loss measured in time
 * RTO: Maximum acceptable downtime for recovery
 *
 * @see docs_zh/architecture/00-platform-architecture.md §52.3
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * RPO/RTO target configuration
 */
export interface RpoRtoTarget {
  readonly targetId: string;
  readonly regionPairId: string;
  readonly rpoMs: number;
  readonly rtoMs: number;
  readonly priority: "critical" | "high" | "medium" | "low";
}

/**
 * RPO/RTO actual measurement
 */
export interface RpoRtoMeasurement {
  readonly measurementId: string;
  readonly regionPairId: string;
  readonly measuredAt: string;
  readonly actualRpoMs: number;
  readonly actualRtoMs: number;
  readonly meetsTarget: boolean;
  readonly breachSeverity: "none" | "warning" | "critical";
}

/**
 * RPO/RTO status summary
 */
export interface RpoRtoStatus {
  readonly regionPairId: string;
  readonly targetRpoMs: number;
  readonly targetRtoMs: number;
  readonly currentRpoMs: number;
  readonly currentRtoMs: number;
  readonly rpoBreached: boolean;
  readonly rtoBreached: boolean;
  readonly lastMeasurementAt: string | null;
  readonly consecutiveBreaches: number;
}

/**
 * Failover event for RTO tracking
 */
export interface FailoverEvent {
  readonly eventId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly actualRtoMs: number | null;
  readonly success: boolean;
  readonly failureReason: string | null;
}

/**
 * Replication lag event for RPO tracking
 */
export interface ReplicationLagEvent {
  readonly eventId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly detectedAt: string;
  readonly lagMs: number;
  readonly exceedsRpo: boolean;
  readonly clearedAt: string | null;
}

/**
 * RPO/RTO Tracking Service
 *
 * Tracks RPO and RTO metrics and determines if SLAs are being met.
 */
export class RpoRtoTrackingService {
  private readonly targets = new Map<string, RpoRtoTarget>();
  private readonly measurements: RpoRtoMeasurement[] = [];
  private readonly failoverEvents = new Map<string, FailoverEvent>();
  private readonly replicationLagEvents = new Map<string, ReplicationLagEvent>();
  private readonly lastReplicationSequence = new Map<string, number>();

  /**
   * Register an RPO/RTO target for a region pair
   */
  public registerTarget(target: RpoRtoTarget): void {
    this.targets.set(target.regionPairId, target);
  }

  /**
   * Get RPO/RTO target for a region pair
   */
  public getTarget(regionPairId: string): RpoRtoTarget | undefined {
    return this.targets.get(regionPairId);
  }

  /**
   * Record replication sequence number for RPO calculation
   */
  public recordReplicationSequence(
    sourceRegionId: string,
    targetRegionId: string,
    sequence: number,
  ): void {
    const key = `${sourceRegionId}:${targetRegionId}`;
    this.lastReplicationSequence.set(key, sequence);
  }

  /**
   * Get last replication sequence for a region pair
   */
  public getLastReplicationSequence(
    sourceRegionId: string,
    targetRegionId: string,
  ): number {
    const key = `${sourceRegionId}:${targetRegionId}`;
    return this.lastReplicationSequence.get(key) ?? 0;
  }

  /**
   * Record a replication lag event for RPO tracking
   */
  public recordReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
    lagMs: number,
  ): ReplicationLagEvent {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const target = this.targets.get(key);
    const rpoMs = target?.rpoMs ?? 30000; // Default 30s RPO

    const event: ReplicationLagEvent = {
      eventId: newId("replag"),
      sourceRegionId,
      targetRegionId,
      detectedAt: nowIso(),
      lagMs,
      exceedsRpo: lagMs > rpoMs,
      clearedAt: null,
    };

    this.replicationLagEvents.set(key, event);
    return event;
  }

  /**
   * Clear a replication lag event (lag has been caught up)
   */
  public clearReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
  ): void {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const event = this.replicationLagEvents.get(key);
    if (event) {
      this.replicationLagEvents.set(key, {
        ...event,
        clearedAt: nowIso(),
      });
    }
  }

  /**
   * Get current replication lag for a region pair
   */
  public getCurrentReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
  ): number {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const event = this.replicationLagEvents.get(key);
    return event?.lagMs ?? 0;
  }

  /**
   * Start tracking a failover event for RTO
   */
  public startFailover(
    sourceRegionId: string,
    targetRegionId: string,
  ): FailoverEvent {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const event: FailoverEvent = {
      eventId: newId("failover"),
      sourceRegionId,
      targetRegionId,
      startedAt: nowIso(),
      completedAt: null,
      actualRtoMs: null,
      success: false,
      failureReason: null,
    };
    this.failoverEvents.set(key, event);
    return event;
  }

  /**
   * Complete a failover event
   */
  public completeFailover(
    sourceRegionId: string,
    targetRegionId: string,
    success: boolean,
    failureReason: string | null = null,
  ): FailoverEvent {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const event = this.failoverEvents.get(key);

    if (!event) {
      throw new Error(`failover_event_not_found:${key}`);
    }

    const completedAt = nowIso();
    const actualRtoMs = new Date(completedAt).getTime() - new Date(event.startedAt).getTime();

    const completedEvent: FailoverEvent = {
      ...event,
      completedAt,
      actualRtoMs,
      success,
      failureReason,
    };

    this.failoverEvents.set(key, completedEvent);
    return completedEvent;
  }

  /**
   * Record an RPO/RTO measurement
   */
  public recordMeasurement(
    regionPairId: string,
    actualRpoMs: number,
    actualRtoMs: number,
  ): RpoRtoMeasurement {
    const target = this.targets.get(regionPairId);
    const rpoMs = target?.rpoMs ?? 30000;
    const rtoMs = target?.rtoMs ?? 60000;

    const meetsTarget = actualRpoMs <= rpoMs && actualRtoMs <= rtoMs;
    const rpoBreached = actualRpoMs > rpoMs;
    const rtoBreached = actualRtoMs > rtoMs;

    let breachSeverity: "none" | "warning" | "critical" = "none";
    if (rpoBreached || rtoBreached) {
      breachSeverity = actualRpoMs > rpoMs * 2 || actualRtoMs > rtoMs * 2 ? "critical" : "warning";
    }

    const measurement: RpoRtoMeasurement = {
      measurementId: newId("rpo_rto"),
      regionPairId,
      measuredAt: nowIso(),
      actualRpoMs,
      actualRtoMs,
      meetsTarget,
      breachSeverity,
    };

    this.measurements.push(measurement);

    // Keep last 1000 measurements
    if (this.measurements.length > 1000) {
      this.measurements.splice(0, this.measurements.length - 1000);
    }

    return measurement;
  }

  /**
   * Get RPO/RTO status for a region pair
   */
  public getStatus(regionPairId: string): RpoRtoStatus | null {
    const target = this.targets.get(regionPairId);
    if (!target) {
      return null;
    }

    // Get current lag as RPO estimate
    const [source, targetRegion] = regionPairId.split("->");
    if (!source || !targetRegion) {
      return null;
    }

    const currentRpoMs = this.getCurrentReplicationLag(source, targetRegion);

    // Check if there's an active failover (RTO estimate)
    const failover = this.failoverEvents.get(regionPairId);
    let currentRtoMs = 0;
    if (failover && !failover.completedAt) {
      currentRtoMs = Date.now() - new Date(failover.startedAt).getTime();
    }

    // Count consecutive breaches
    const recentMeasurements = this.measurements
      .filter((m) => m.regionPairId === regionPairId)
      .slice(-10);
    const consecutiveBreaches = recentMeasurements.filter((m) => !m.meetsTarget).length;

    return {
      regionPairId,
      targetRpoMs: target.rpoMs,
      targetRtoMs: target.rtoMs,
      currentRpoMs,
      currentRtoMs,
      rpoBreached: currentRpoMs > target.rpoMs,
      rtoBreached: currentRtoMs > target.rtoMs,
      lastMeasurementAt: recentMeasurements[recentMeasurements.length - 1]?.measuredAt ?? null,
      consecutiveBreaches,
    };
  }

  /**
   * Check if RPO/RTO guarantees are being met
   */
  public isMeetingSla(regionPairId: string): boolean {
    const status = this.getStatus(regionPairId);
    if (!status) {
      return true; // No target = no SLA to breach
    }
    return !status.rpoBreached && !status.rtoBreached;
  }

  /**
   * Get all measurements for a region pair
   */
  public getMeasurements(regionPairId: string, limit = 100): readonly RpoRtoMeasurement[] {
    return this.measurements
      .filter((m) => m.regionPairId === regionPairId)
      .slice(-limit);
  }

  /**
   * Get failover history for a region pair
   */
  public getFailoverHistory(
    sourceRegionId: string,
    targetRegionId: string,
  ): readonly FailoverEvent[] {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const event = this.failoverEvents.get(key);
    return event ? [event] : [];
  }

  /**
   * Get average RTO from completed failovers
   */
  public getAverageRto(sourceRegionId: string, targetRegionId: string): number | null {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const event = this.failoverEvents.get(key);
    if (!event?.completedAt || event.actualRtoMs === null) {
      return null;
    }
    return event.actualRtoMs;
  }

  /**
   * R13-23: Assert SLA compliance for a region pair.
   * Throws if RPO or RTO targets are breached.
   * Used to enforce §52 RPO/RTO guarantees.
   */
  public assertSlaCompliance(regionPairId: string): void {
    const status = this.getStatus(regionPairId);
    if (!status) {
      return; // No SLA target = no assertion to make
    }

    const breaches: string[] = [];
    if (status.rpoBreached) {
      breaches.push(`RPO breach: actual=${status.currentRpoMs}ms, target=${status.targetRpoMs}ms`);
    }
    if (status.rtoBreached) {
      breaches.push(`RTO breach: actual=${status.currentRtoMs}ms, target=${status.targetRtoMs}ms`);
    }

    if (breaches.length > 0) {
      throw new Error(
        `SLA_COMPLIANCE_FAILED:${regionPairId} - ${breaches.join("; ")}`,
      );
    }
  }

  /**
   * R13-23: Get SLA compliance status as a result object (non-throwing).
   * Returns { compliant: true } if SLA is met, { compliant: false, breaches: [...] } otherwise.
   */
  public getSlaCompliance(regionPairId: string): {
    readonly compliant: boolean;
    readonly breaches: readonly string[];
  } {
    const status = this.getStatus(regionPairId);
    if (!status) {
      return { compliant: true, breaches: [] };
    }

    const breaches: string[] = [];
    if (status.rpoBreached) {
      breaches.push(`RPO: actual=${status.currentRpoMs}ms, target=${status.targetRpoMs}ms`);
    }
    if (status.rtoBreached) {
      breaches.push(`RTO: actual=${status.currentRtoMs}ms, target=${status.targetRtoMs}ms`);
    }

    return {
      compliant: breaches.length === 0,
      breaches,
    };
  }

  /**
   * R13-23: Get guarantee summary for a region pair.
   * Provides detailed RPO/RTO guarantee status for monitoring dashboards.
   */
  public getGuaranteeSummary(regionPairId: string): {
    readonly hasTarget: boolean;
    readonly rpoTargetMs: number | null;
    readonly rtoTargetMs: number | null;
    readonly currentRpoMs: number;
    readonly currentRtoMs: number;
    readonly rpoMet: boolean;
    readonly rtoMet: boolean;
    readonly consecutiveBreaches: number;
    readonly lastMeasurementAt: string | null;
  } | null {
    const target = this.targets.get(regionPairId);
    const status = this.getStatus(regionPairId);

    if (!target && !status) {
      return null;
    }

    return {
      hasTarget: target !== undefined,
      rpoTargetMs: target?.rpoMs ?? null,
      rtoTargetMs: target?.rtoMs ?? null,
      currentRpoMs: status?.currentRpoMs ?? 0,
      currentRtoMs: status?.currentRtoMs ?? 0,
      rpoMet: status ? !status.rpoBreached : true,
      rtoMet: status ? !status.rtoBreached : true,
      consecutiveBreaches: status?.consecutiveBreaches ?? 0,
      lastMeasurementAt: status?.lastMeasurementAt ?? null,
    };
  }
}

/**
 * Singleton instance
 */
let GLOBAL_RPO_RTO_SERVICE: RpoRtoTrackingService | null = null;

export function getRpoRtoTrackingService(): RpoRtoTrackingService {
  if (!GLOBAL_RPO_RTO_SERVICE) {
    GLOBAL_RPO_RTO_SERVICE = new RpoRtoTrackingService();
  }
  return GLOBAL_RPO_RTO_SERVICE;
}

export function resetRpoRtoTrackingService(): void {
  GLOBAL_RPO_RTO_SERVICE = null;
}
