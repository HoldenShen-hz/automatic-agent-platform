import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import type {
  PanicAcknowledgment,
  PanicFreezeMode,
  PanicPropagationRecord,
  PanicScopeLevel,
  PlatformPanicActivation,
  PlatformResumeDirective,
} from "./platform-panic-service.js";
import { PlatformPanicService } from "./platform-panic-service.js";

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

export const DEFAULT_PROPAGATION_POLICY: PropagationPolicy = {
  cascadeOrder: ["P1", "P2", "P3", "P4", "P5"],
  confirmationRequired: true,
  reconfirmationAfterSeconds: 300,
  autoRollbackIfAllAck: false,
  ackTimeoutMs: 30000,
};

const PLANE_SCOPE_LEVELS: Record<PlaneName, PanicScopeLevel> = {
  P1: "platform",
  P2: "platform",
  P3: "region",
  P4: "tenant",
  P5: "run",
};

export interface PanicPropagationServiceOptions {
  readonly maxRetainedDirectives?: number;
}

export class PanicPropagationService {
  private static readonly DEFAULT_MAX_RETAINED_DIRECTIVES = 100;
  private readonly panicService: PlatformPanicService;
  private readonly maxRetainedDirectives: number;
  private readonly haltingLog = new Map<string, CascadeHaltingEvent[]>();
  private readonly confirmations = new Map<string, DualAdminConfirmation>();
  private readonly pendingReconformation = new Map<string, string>();
  private readonly pendingAcks = new Map<string, NodeJS.Timeout>();
  private readonly sentDirectives = new Map<string, PlaneHaltDirective[]>();

  public constructor(panicService: PlatformPanicService, options: PanicPropagationServiceOptions = {}) {
    this.panicService = panicService;
    this.maxRetainedDirectives = Math.max(
      1,
      options.maxRetainedDirectives ?? PanicPropagationService.DEFAULT_MAX_RETAINED_DIRECTIVES,
    );
  }

  public activate(
    activation: PlatformPanicActivation,
    policy: PropagationPolicy = DEFAULT_PROPAGATION_POLICY,
  ): CascadeHaltResult {
    const directiveId = activation.directive.directiveId;
    const issuedAt = nowIso();
    const directives = this.createPlaneDirectives(activation, issuedAt, policy);
    this.sentDirectives.set(directiveId, directives);
    const events = this.initializeHaltingEvents(directiveId, directives, activation);
    this.haltingLog.set(directiveId, events);
    this.enforceDirectiveRetention();

    const planeResults: PlaneHaltResult[] = [];
    const timedOutPlanes: PlaneName[] = [];
    const forceTerminatedPlanes: PlaneName[] = [];

    for (const directive of directives) {
      const sent = this.sendHaltDirective(directive);

      if (sent) {
        this.trackAckTimeout(directiveId, directive.targetPlane, policy.ackTimeoutMs);
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

    return {
      directiveId,
      allPlanesHalted: planeResults.every((result) => result.halted),
      planeResults,
      timedOutPlanes,
      forceTerminatedPlanes,
    };
  }

  public processPlaneAcknowledgment(
    directiveId: string,
    plane: PlaneName,
    admin1: string,
    admin2: string,
    localStopState: string,
    evidenceRef: string,
  ): PanicAcknowledgment | null {
    this.cancelAckTimeout(directiveId, plane);
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return null;
    }

    const directive = this.findDirective(directiveId, plane);
    if (!directive) {
      return null;
    }

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
    this.updatePlaneState(directiveId, plane, "acknowledged", confirmedAt);

    return {
      plane,
      status: this.allPlanesAcknowledged(directiveId) ? "ack" : "ack",
      localStopState,
      evidenceRef,
    };
  }

  public forceTerminatePlane(directiveId: string, plane: PlaneName): void {
    this.updatePlaneState(directiveId, plane, "force-terminated");
    panicLogger.error("panic.force_termination_triggered", { directiveId, plane });
  }

  public getPlaneStatus(directiveId: string, plane: PlaneName): CascadeHaltingEvent | null {
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return null;
    }
    return events.find((event) => event.plane === plane) ?? null;
  }

  public cascadeHalt(
    activation: PlatformPanicActivation,
    policy: PropagationPolicy = DEFAULT_PROPAGATION_POLICY,
  ): readonly CascadeHaltingEvent[] {
    this.activate(activation, policy);
    return this.haltingLog.get(activation.directive.directiveId) ?? [];
  }

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

  public allPlanesAcknowledged(directiveId: string): boolean {
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return false;
    }
    return events.every((event) => event.localState === "acknowledged");
  }

  public getHaltingState(directiveId: string): readonly CascadeHaltingEvent[] {
    return this.haltingLog.get(directiveId) ?? [];
  }

  public markPlaneAcknowledged(directiveId: string, plane: PlaneName): void {
    this.updatePlaneState(directiveId, plane, "acknowledged");
  }

  public scheduleReconfirmation(directiveId: string, afterSeconds?: number): void {
    const intervalMs = (afterSeconds ?? DEFAULT_PROPAGATION_POLICY.reconfirmationAfterSeconds) * 1000;
    const key = `reconfirm:${directiveId}`;
    this.pendingReconformation.set(key, nowIso());
    setTimeout(() => {
      this.pendingReconformation.delete(key);
    }, intervalMs).unref();
  }

  public issueResumeDirective(
    scope: string,
    relatedPanicDirectiveId: string,
    approvedBy: readonly string[],
    rollbackExecuted: boolean,
    validationResults: readonly string[],
    allowlistRestored: boolean,
  ): PlatformResumeDirective {
    return {
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
  }

  public getPropagationRecords(directiveId: string): readonly PanicPropagationRecord[] {
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return [];
    }

    return events.map((event) => ({
      directiveId,
      targetScope: event.targetScope,
      propagationMode: "direct" as const,
      blockedExecutionModes: event.blockedModes,
      recordedAt: event.haltedAt,
    }));
  }

  public getConfirmation(directiveId: string, plane: PlaneName): DualAdminConfirmation | null {
    return this.confirmations.get(`${directiveId}:${plane}`) ?? null;
  }

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
    return directives.map((directive) => ({
      directiveId,
      plane: directive.targetPlane,
      targetScope: this.scopeForPlane(directive.targetPlane, activation.directive.scope),
      haltedAt: directive.issuedAt,
      blockedModes: directive.freezeModes,
      localState: "propagating",
    }));
  }

  private sendHaltDirective(directive: PlaneHaltDirective): boolean {
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
      this.forceTerminatePlane(directiveId, plane);
      this.pendingAcks.delete(key);
    }, timeoutMs);
    timeout.unref?.();
    this.pendingAcks.set(key, timeout);
  }

  private cancelAckTimeout(directiveId: string, plane: PlaneName): void {
    const key = `${directiveId}:${plane}`;
    const timeout = this.pendingAcks.get(key);
    if (!timeout) {
      return;
    }
    clearTimeout(timeout);
    this.pendingAcks.delete(key);
  }

  private updatePlaneState(
    directiveId: string,
    plane: PlaneName,
    state: CascadeHaltingEvent["localState"],
    timestamp?: string,
  ): void {
    const events = this.haltingLog.get(directiveId);
    if (!events) {
      return;
    }

    const idx = events.findIndex((event) => event.plane === plane);
    if (idx < 0) {
      return;
    }
    const existingEvent = events[idx];
    if (!existingEvent) {
      return;
    }

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
    if (!directives) {
      return null;
    }
    return directives.find((directive) => directive.targetPlane === plane) ?? null;
  }

  private scopeForPlane(plane: PlaneName, baseScope: string): string {
    return `${PLANE_SCOPE_LEVELS[plane]}/${baseScope}`;
  }

  private planeScope(plane: PlaneName): string {
    return `${PLANE_SCOPE_LEVELS[plane]}/global`;
  }

  private enforceDirectiveRetention(): void {
    while (this.haltingLog.size > this.maxRetainedDirectives) {
      const oldestDirectiveId = this.haltingLog.keys().next().value;
      if (typeof oldestDirectiveId !== "string") {
        return;
      }
      this.clearDirectiveState(oldestDirectiveId);
    }
  }

  private clearDirectiveState(directiveId: string): void {
    this.haltingLog.delete(directiveId);
    this.sentDirectives.delete(directiveId);
    this.pendingReconformation.delete(`reconfirm:${directiveId}`);

    for (const [key, timeout] of this.pendingAcks.entries()) {
      if (!key.startsWith(`${directiveId}:`)) {
        continue;
      }
      clearTimeout(timeout);
      this.pendingAcks.delete(key);
    }

    for (const key of this.confirmations.keys()) {
      if (key.startsWith(`${directiveId}:`)) {
        this.confirmations.delete(key);
      }
    }
  }
}
