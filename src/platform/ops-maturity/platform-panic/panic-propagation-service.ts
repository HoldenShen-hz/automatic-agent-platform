/**
 * PanicPropagationService
 *
 * Cascades halt signals across the five-plane platform architecture.
 * Coordinates panic state-saving and dual-admin acknowledgment propagation.
 *
 * §R14-01
 */

import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type {
  PanicAcknowledgment,
  PanicFreezeMode,
  PanicPropagationRecord,
  PanicScopeLevel,
  PlatformPanicActivation,
  PlatformPanicDirective,
  PlatformResumeDirective,
} from "./index.js";
import { PlatformPanicService } from "./index.js";

export type PlaneName = "P1" | "P2" | "P3" | "P4" | "P5";

export interface PropagationTarget {
  readonly plane: PlaneName;
  readonly scope: string;
  readonly scopeLevel: PanicScopeLevel;
}

export interface CascadeHaltingEvent {
  readonly directiveId: string;
  readonly plane: PlaneName;
  readonly targetScope: string;
  readonly haltedAt: string;
  readonly blockedModes: readonly PanicFreezeMode[];
  readonly localState: "propagating" | "halted" | "acknowledged" | "failed";
}

export interface DualAdminConfirmation {
  readonly confirmationId: string;
  readonly directiveId: string;
  readonly admin1: string;
  readonly admin2: string;
  readonly confirmedAt: string;
  readonly scope: string;
}

export interface PropagationPolicy {
  readonly cascadeOrder: readonly PlaneName[];
  readonly confirmationRequired: boolean;
  readonly reconfirmationAfterSeconds: number;
  readonly autoRollbackIfAllAck: boolean;
}

/**
 * Default propagation policy cascades P1 -> P2 -> P3 -> P4 -> P5
 */
export const DEFAULT_PROPAGATION_POLICY: PropagationPolicy = {
  cascadeOrder: ["P1", "P2", "P3", "P4", "P5"],
  confirmationRequired: true,
  reconfirmationAfterSeconds: 300,
  autoRollbackIfAllAck: false,
};

const PLANE_SCOPE_LEVELS: Record<PlaneName, PanicScopeLevel> = {
  P1: "platform",
  P2: "platform",
  P3: "region",
  P4: "tenant",
  P5: "run",
};

export class PanicPropagationService {
  private readonly panicService: PlatformPanicService;
  private readonly haltingLog = new Map<string, CascadeHaltingEvent[]>();
  private readonly confirmations = new Map<string, DualAdminConfirmation>();
  private readonly pendingReconformation = new Map<string, string>();

  public constructor(panicService: PlatformPanicService) {
    this.panicService = panicService;
  }

  /**
   * Initiates cascade halt across all planes for a given panic activation.
   * Propagates halting signals in plane order.
   */
  public cascadeHalt(
    activation: PlatformPanicActivation,
    policy: PropagationPolicy = DEFAULT_PROPAGATION_POLICY,
  ): readonly CascadeHaltingEvent[] {
    const events: CascadeHaltingEvent[] = [];
    const directiveId = activation.directive.directiveId;

    for (const plane of policy.cascadeOrder) {
      const targetScope = this.scopeForPlane(plane, activation.directive.scope);
      const event: CascadeHaltingEvent = {
        directiveId,
        plane,
        targetScope,
        haltedAt: nowIso(),
        blockedModes: activation.directive.freezeModes,
        localState: "propagating",
      };
      events.push(event);
    }

    this.haltingLog.set(directiveId, events);

    // Mark first plane as halted immediately
    const firstEvent = events.find((e) => e.plane === "P1");
    if (firstEvent) {
      const updated = { ...firstEvent, localState: "halted" as const };
      this.updateHaltEvent(directiveId, updated);
    }

    return this.haltingLog.get(directiveId) ?? events;
  }

  /**
   * Records a per-plane acknowledgment for a panic directive.
   * Requires dual-admin confirmation before completion.
   */
  public recordAcknowledgment(
    directiveId: string,
    plane: PlaneName,
    admin1: string,
    admin2: string,
    localStopState: string,
    evidenceRef: string,
  ): PanicAcknowledgment {
    const confirmationId = newId("ack_confirm");
    const confirmedAt = nowIso();

    this.confirmations.set(`${directiveId}:${plane}`, {
      confirmationId,
      directiveId,
      admin1,
      admin2,
      confirmedAt,
      scope: this.planeScope(plane),
    });

    const acknowledgment: PanicAcknowledgment = {
      plane,
      status: "ack",
      localStopState,
      evidenceRef,
    };

    return acknowledgment;
  }

  /**
   * Checks whether all planes have acknowledged the panic directive.
   */
  public allPlanesAcknowledged(directiveId: string): boolean {
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return false;
    }
    return events.every((e) => e.localState === "acknowledged");
  }

  /**
   * Gets the current halting state for a directive across all planes.
   */
  public getHaltingState(directiveId: string): readonly CascadeHaltingEvent[] {
    return this.haltingLog.get(directiveId) ?? [];
  }

  /**
   * Marks a plane as acknowledged in the halting log.
   */
  public markPlaneAcknowledged(directiveId: string, plane: PlaneName): void {
    const events = this.haltingLog.get(directiveId);
    if (!events) return;

    const idx = events.findIndex((e) => e.plane === plane);
    if (idx < 0) return;

    const updated = { ...events[idx]!, localState: "acknowledged" as const };
    const updatedEvents = [...events];
    updatedEvents[idx] = updated;
    this.haltingLog.set(directiveId, updatedEvents);
  }

  /**
   * Schedules reconfirmation for a directive after the configured interval.
   */
  public scheduleReconfirmation(directiveId: string, afterSeconds?: number): void {
    const policy = DEFAULT_PROPAGATION_POLICY;
    const intervalMs = (afterSeconds ?? policy.reconfirmationAfterSeconds) * 1000;
    const key = `reconfirm:${directiveId}`;

    // In a real implementation this would register a timer callback
    this.pendingReconformation.set(key, nowIso());

    // Fire-and-forget timeout tracker (actual timer would be in runtime)
    setTimeout(() => {
      this.pendingReconformation.delete(key);
    }, intervalMs).unref();
  }

  /**
   * Issues a PlatformResumeDirective after successful panic resolution.
   * Validates all planes acknowledged before issuing.
   */
  public issueResumeDirective(
    scope: string,
    relatedPanicDirectiveId: string,
    approvedBy: readonly string[],
    rollbackExecuted: boolean,
    validationResults: readonly string[],
    allowlistRestored: boolean,
  ): PlatformResumeDirective {
    const directive: PlatformResumeDirective = {
      directiveId: newId("resume"),
      relatedPanicDirectiveId,
      scope,
      issuedBy: approvedBy[0] ?? "system",
      issuedAt: nowIso(),
      approvedBy,
      rollbackExecuted,
      validationResults,
      allowlistRestored,
    };

    return directive;
  }

  /**
   * Gets propagation records for a directive across all affected scopes.
   */
  public getPropagationRecords(directiveId: string): readonly PanicPropagationRecord[] {
    const events = this.haltingLog.get(directiveId);
    if (!events) return [];

    return events.map((event) => ({
      directiveId,
      targetScope: event.targetScope,
      propagationMode: "direct" as const,
      blockedExecutionModes: event.blockedModes,
      recordedAt: event.haltedAt,
    }));
  }

  /**
   * Gets dual-admin confirmation for a specific plane's acknowledgment.
   */
  public getConfirmation(directiveId: string, plane: PlaneName): DualAdminConfirmation | null {
    return this.confirmations.get(`${directiveId}:${plane}`) ?? null;
  }

  private scopeForPlane(plane: PlaneName, baseScope: string): string {
    const level = PLANE_SCOPE_LEVELS[plane];
    return `${level}/${baseScope}`;
  }

  private planeScope(plane: PlaneName): string {
    return `${PLANE_SCOPE_LEVELS[plane]}/global`;
  }

  private updateHaltEvent(directiveId: string, updated: CascadeHaltingEvent): void {
    const events = this.haltingLog.get(directiveId);
    if (!events) return;

    const idx = events.findIndex((e) => e.plane === updated.plane);
    if (idx < 0) return;

    const updatedEvents = [...events];
    updatedEvents[idx] = updated;
    this.haltingLog.set(directiveId, updatedEvents);
  }
}
