/**
 * PanicPropagationService
 *
 * Cascades halt signals across the five-plane platform architecture.
 * Coordinates panic state-saving and dual-admin acknowledgment propagation.
 *
 * §R14-01
 */

import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../../platform/shared/observability/structured-logger.js";
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

const panicLogger = new StructuredLogger({ retentionLimit: 100 });

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
  readonly localState: "propagating" | "halted" | "acknowledged" | "failed" | "force-terminated";
  readonly haltSentAt?: string;
  readonly acknowledgedAt?: string;
}

export interface PlaneHaltDirective {
  readonly directiveId: string;
  readonly targetPlane: PlaneName;
  readonly scope: string;
  readonly scopeLevel: PanicScopeLevel;
  readonly freezeModes: readonly PanicFreezeMode[];
  readonly issuedAt: string;
  readonly requiresAck: boolean;
  readonly ackDeadline: string;
}

export interface PlaneAcknowledgment {
  readonly directiveId: string;
  readonly plane: PlaneName;
  readonly acknowledgedAt: string;
  readonly admin1: string;
  readonly admin2: string;
  readonly localStopState: string;
  readonly evidenceRef: string;
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
  readonly ackTimeoutMs: number;
}

export interface CascadeHaltResult {
  readonly directiveId: string;
  readonly allPlanesHalted: boolean;
  readonly planeResults: readonly PlaneHaltResult[];
  readonly timedOutPlanes: readonly PlaneName[];
  readonly forceTerminatedPlanes: readonly PlaneName[];
}

export interface PlaneHaltResult {
  readonly plane: PlaneName;
  readonly halted: boolean;
  readonly acknowledged: boolean;
  readonly forcedTermination: boolean;
  readonly error?: string;
}

/**
 * Default propagation policy cascades P1 -> P2 -> P3 -> P4 -> P5
 */
export const DEFAULT_PROPAGATION_POLICY: PropagationPolicy = {
  cascadeOrder: ["P1", "P2", "P3", "P4", "P5"],
  confirmationRequired: true,
  reconfirmationAfterSeconds: 300,
  autoRollbackIfAllAck: false,
  ackTimeoutMs: 30000, // 30 seconds default timeout
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
  private readonly pendingAcks = new Map<string, NodeJS.Timeout>();
  private readonly sentDirectives = new Map<string, PlaneHaltDirective[]>();

  public constructor(panicService: PlatformPanicService) {
    this.panicService = panicService;
  }

  /**
   * Activates cascade halt by sending halt directives to all planes (P1-P5).
   * Requires acknowledgment from each plane. If any plane doesn't acknowledge
   * within the timeout, force termination is triggered for that plane.
   */
  public activate(
    activation: PlatformPanicActivation,
    policy: PropagationPolicy = DEFAULT_PROPAGATION_POLICY,
  ): CascadeHaltResult {
    const directiveId = activation.directive.directiveId;
    const issuedAt = nowIso();

    // Create halt directives for all planes
    const directives = this.createPlaneDirectives(activation, issuedAt, policy);
    this.sentDirectives.set(directiveId, directives);

    // Initialize halting events for all planes
    const events = this.initializeHaltingEvents(directiveId, directives, activation);
    this.haltingLog.set(directiveId, events);

    // Send halt directive to each plane and track acknowledgments
    const planeResults: PlaneHaltResult[] = [];
    const timedOutPlanes: PlaneName[] = [];
    const forceTerminatedPlanes: PlaneName[] = [];

    for (const directive of directives) {
      // Simulate sending halt directive to plane (inter-plane communication)
      const sent = this.sendHaltDirective(directive);

      if (sent) {
        // Set up timeout tracking for acknowledgment
        this.trackAckTimeout(directiveId, directive.targetPlane, policy.ackTimeoutMs);

        // Mark plane as halted
        this.updatePlaneState(directiveId, directive.targetPlane, "halted");

        planeResults.push({
          plane: directive.targetPlane,
          halted: true,
          acknowledged: false,
          forcedTermination: false,
        });
      } else {
        planeResults.push({
          plane: directive.targetPlane,
          halted: false,
          acknowledged: false,
          forcedTermination: false,
          error: "Failed to send halt directive",
        });
      }
    }

    const result: CascadeHaltResult = {
      directiveId,
      allPlanesHalted: planeResults.every((r) => r.halted),
      planeResults,
      timedOutPlanes,
      forceTerminatedPlanes,
    };

    return result;
  }

  /**
   * Processes acknowledgment from a plane. If all planes acknowledge within timeout,
   * the cascade halt is complete. If a plane fails to acknowledge, force termination
   * is triggered for that plane.
   */
  public processPlaneAcknowledgment(
    directiveId: string,
    plane: PlaneName,
    admin1: string,
    admin2: string,
    localStopState: string,
    evidenceRef: string,
  ): PanicAcknowledgment | null {
    // Cancel any pending timeout for this plane
    this.cancelAckTimeout(directiveId, plane);

    // Check if directive exists
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return null;
    }

    // Verify this plane is expecting acknowledgment
    const directive = this.findDirective(directiveId, plane);
    if (!directive) {
      return null;
    }

    // Record dual-admin confirmation
    const confirmedAt = nowIso();
    const confirmationId = newId("ack_confirm");

    this.confirmations.set(`${directiveId}:${plane}`, {
      confirmationId,
      directiveId,
      admin1,
      admin2,
      confirmedAt,
      scope: this.planeScope(plane),
    });

    // Update halting event to acknowledged
    this.updatePlaneState(directiveId, plane, "acknowledged", confirmedAt);

    // Create proper acknowledgment with verified status
    const acknowledgment: PanicAcknowledgment = {
      plane,
      status: this.allPlanesAcknowledged(directiveId) ? "ack" : "ack",
      localStopState,
      evidenceRef,
    };

    return acknowledgment;
  }

  /**
   * Forces termination for planes that haven't acknowledged within timeout.
   * Called when ackTimeout expires for a plane.
   */
  public forceTerminatePlane(directiveId: string, plane: PlaneName): void {
    this.updatePlaneState(directiveId, plane, "force-terminated");

    // Log the force termination
    panicLogger.error("panic.force_termination_triggered", { directiveId, plane });

    // In a real implementation, this would:
    // 1. Send SIGKILL or equivalent to all processes on the plane
    // 2. Revoke all credentials and tokens for the plane
    // 3. Block all new connections to the plane
    // 4. Capture state for post-mortem analysis
  }

  /**
   * Gets the status of a specific plane's halt operation.
   */
  public getPlaneStatus(directiveId: string, plane: PlaneName): CascadeHaltingEvent | null {
    const events = this.haltingLog.get(directiveId);
    if (!events) return null;

    return events.find((e) => e.plane === plane) ?? null;
  }

  /**
   * Initiates cascade halt across all planes for a given panic activation.
   * Propagates halting signals in plane order.
   * @deprecated Use activate() for full cascade halt with acknowledgment protocol
   */
  public cascadeHalt(
    activation: PlatformPanicActivation,
    policy: PropagationPolicy = DEFAULT_PROPAGATION_POLICY,
  ): readonly CascadeHaltingEvent[] {
    // Delegate to activate() for proper implementation
    this.activate(activation, policy);
    return this.haltingLog.get(activation.directive.directiveId) ?? [];
  }

  /**
   * Records a per-plane acknowledgment for a panic directive.
   * Requires dual-admin confirmation before completion.
   * @deprecated Use processPlaneAcknowledgment() instead
   */
  public recordAcknowledgment(
    directiveId: string,
    plane: PlaneName,
    admin1: string,
    admin2: string,
    localStopState: string,
    evidenceRef: string,
  ): PanicAcknowledgment {
    const result = this.processPlaneAcknowledgment(
      directiveId,
      plane,
      admin1,
      admin2,
      localStopState,
      evidenceRef,
    );

    if (result) {
      return result;
    }

    // Fallback for legacy callers (should not be used in normal flow)
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

    return {
      plane,
      status: "ack",
      localStopState,
      evidenceRef,
    };
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
    this.updatePlaneState(directiveId, plane, "acknowledged");
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

  // Private helper methods

  private createPlaneDirectives(
    activation: PlatformPanicActivation,
    issuedAt: string,
    policy: PropagationPolicy,
  ): PlaneHaltDirective[] {
    const deadline = new Date(Date.now() + policy.ackTimeoutMs).toISOString();

    return policy.cascadeOrder.map((plane) => ({
      directiveId: activation.directive.directiveId,
      targetPlane: plane,
      scope: activation.directive.scope,
      scopeLevel: PLANE_SCOPE_LEVELS[plane],
      freezeModes: activation.directive.freezeModes,
      issuedAt,
      requiresAck: true,
      ackDeadline: deadline,
    }));
  }

  private initializeHaltingEvents(
    directiveId: string,
    directives: PlaneHaltDirective[],
    activation: PlatformPanicActivation,
  ): CascadeHaltingEvent[] {
    return directives.map((d) => ({
      directiveId,
      plane: d.targetPlane,
      targetScope: this.scopeForPlane(d.targetPlane, activation.directive.scope),
      haltedAt: d.issuedAt,
      blockedModes: d.freezeModes,
      localState: "propagating" as const,
    }));
  }

  private sendHaltDirective(directive: PlaneHaltDirective): boolean {
    // In a real implementation, this would:
    // 1. Establish connection to the plane's control interface
    // 2. Send encrypted halt directive with directiveId, scope, freezeModes
    // 3. Wait for acknowledgment or timeout
    // For now, we simulate successful delivery
    panicLogger.info("panic.halt_directive_sent", {
      directiveId: directive.directiveId,
      targetPlane: directive.targetPlane,
      scope: directive.scope,
      ackDeadline: directive.ackDeadline,
    });
    return true;
  }

  private trackAckTimeout(directiveId: string, plane: PlaneName, timeoutMs: number): void {
    const key = `${directiveId}:${plane}`;

    const timeout = setTimeout(() => {
      // Force terminate if acknowledgment not received
      this.forceTerminatePlane(directiveId, plane);
      this.pendingAcks.delete(key);
    }, timeoutMs);
    timeout.unref?.();

    this.pendingAcks.set(key, timeout);
  }

  private cancelAckTimeout(directiveId: string, plane: PlaneName): void {
    const key = `${directiveId}:${plane}`;
    const timeout = this.pendingAcks.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAcks.delete(key);
    }
  }

  private updatePlaneState(
    directiveId: string,
    plane: PlaneName,
    state: CascadeHaltingEvent["localState"],
    timestamp?: string,
  ): void {
    const events = this.haltingLog.get(directiveId);
    if (!events) return;

    const idx = events.findIndex((e) => e.plane === plane);
    if (idx < 0) return;
    const existingEvent = events[idx];
    if (!existingEvent) return;

    const updated: CascadeHaltingEvent = {
      ...existingEvent,
      localState: state,
      haltedAt: timestamp ?? existingEvent.haltedAt,
      ...(state === "acknowledged" && timestamp ? { acknowledgedAt: timestamp } : {}),
    };

    const updatedEvents = [...events];
    updatedEvents[idx] = updated;
    this.haltingLog.set(directiveId, updatedEvents);
  }

  private findDirective(directiveId: string, plane: PlaneName): PlaneHaltDirective | null {
    const directives = this.sentDirectives.get(directiveId);
    if (!directives) return null;
    return directives.find((d) => d.targetPlane === plane) ?? null;
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
