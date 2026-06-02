/**
 * @fileoverview Time-Travel Debugging Service
 *
 * Provides:
 * - Event store replay for step-by-step execution reconstruction
 * - Breakpoint snapshots at any historical point
 * - Variable state capture and reconstruction
 * - Remote debugging session management
 *
 * §64 调试器 - 时间旅行调试
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface DebugSnapshot {
  snapshotId: string;
  taskId: string;
  executionId: string;
  harnessRunId?: string;
  stepId: string;
  nodeRunId?: string;
  timestamp: string;
  variablesJson: string;
  stackTrace: string | null;
  eventIndex: number;
}

export interface ReplayCursor {
  taskId: string;
  executionId: string;
  harnessRunId?: string;
  fromEventIndex: number;
  toEventIndex: number;
}

export interface VariableState {
  name: string;
  value: unknown;
  type: string;
  scope: "global" | "step" | "loop";
}

export interface ReplayState {
  cursor: ReplayCursor;
  currentEventIndex: number;
  variables: readonly VariableState[];
  reachedBreakpoint: boolean;
}

export interface TimeTravelDebugSession {
  sessionId: string;
  taskId: string;
  executionId: string;
  harnessRunId?: string;
  breakpoints: readonly string[];
  snapshots: readonly DebugSnapshot[];
  currentEventIndex: number;
  accessContext: ReplayAccessContext;
  sandboxPolicy: ReplaySandboxPolicy;
  startedAt: string;
  endedAt: string | null;
}

export interface TimeTravelDebugVariableEnvelope {
  readonly value?: unknown;
  readonly scope?: VariableState["scope"];
}

export interface TimeTravelDebugEvent {
  readonly stepId?: string | null;
  readonly nodeRunId?: string | null;
  readonly timestamp?: string | null;
  readonly variables?: Readonly<Record<string, unknown>> | null;
  readonly stackTrace?: string | null;
  readonly scope?: VariableState["scope"] | null;
  readonly effectType?: "read" | "write" | "network" | "process" | "tool_call" | null;
  readonly replayUnsafe?: boolean | null;
}

function readEventStepId(event: TimeTravelDebugEvent): string {
  return String(event.nodeRunId ?? event.stepId ?? "");
}

export interface TimeTravelDebugServiceOptions {
  maxSessions?: number;
  maxEventsPerExecution?: number;
  maxSnapshotsPerSession?: number;
}

export interface ReplaySandboxPolicy {
  readonly blockExternalSideEffects: boolean;
  readonly allowWrites: boolean;
  readonly allowNetwork: boolean;
  readonly allowProcess: boolean;
  readonly allowToolCalls: boolean;
}

export interface ReplayAccessContext {
  readonly actorId: string;
  readonly tenantId?: string;
  readonly environment: "prod" | "staging" | "dev";
  readonly mfaVerified: boolean;
  readonly sessionExpiresAt: string | null;
  readonly permissions: readonly string[];
}

function isVariableScope(value: unknown): value is VariableState["scope"] {
  return value === "global" || value === "step" || value === "loop";
}

function readVariables(event: TimeTravelDebugEvent): Readonly<Record<string, unknown>> {
  return event.variables ?? {};
}

function readVariableValue(value: unknown): unknown {
  if (typeof value === "object" && value !== null && "value" in value) {
    return (value as TimeTravelDebugVariableEnvelope).value;
  }
  return value;
}

function defaultReplayAccessContext(): ReplayAccessContext {
  return {
    actorId: "local_debugger",
    tenantId: "local",
    environment: "dev",
    mfaVerified: false,
    sessionExpiresAt: null,
    permissions: ["time_travel:replay"],
  };
}

function defaultReplaySandboxPolicy(): ReplaySandboxPolicy {
  return {
    blockExternalSideEffects: true,
    allowWrites: false,
    allowNetwork: false,
    allowProcess: false,
    allowToolCalls: false,
  };
}

export class TimeTravelDebugService {
  private readonly maxSessions: number;
  private readonly maxEventsPerExecution: number;
  private readonly maxSnapshotsPerSession: number;
  private readonly sessionsByTenant = new Map<string, Map<string, TimeTravelDebugSession>>();
  private readonly eventStoreByTenant = new Map<string, Map<string, ReadonlyArray<TimeTravelDebugEvent>>>();
  private readonly snapshotsByTenant = new Map<string, Map<string, DebugSnapshot[]>>();
  private readonly archivedSessions = new Map<string, TimeTravelDebugSession>();

  public constructor(options: TimeTravelDebugServiceOptions = {}) {
    this.maxSessions = options.maxSessions ?? 100;
    this.maxEventsPerExecution = options.maxEventsPerExecution ?? 10_000;
    this.maxSnapshotsPerSession = options.maxSnapshotsPerSession ?? 100;
  }

  public createSession(
    taskId: string,
    executionId: string,
    accessContext: ReplayAccessContext = defaultReplayAccessContext(),
    sandboxPolicy: ReplaySandboxPolicy = defaultReplaySandboxPolicy(),
  ): TimeTravelDebugSession {
    this.assertReplayAccess(accessContext);
    this.evictOldestSessionIfNeeded();
    const tenantId = resolveTenantId(accessContext);
    const tenantSessions = getOrCreateTenantBucket(this.sessionsByTenant, tenantId);
    const tenantEventStore = getOrCreateTenantBucket(this.eventStoreByTenant, tenantId);
    if (!tenantEventStore.has(executionId)) {
      tenantEventStore.set(executionId, []);
    }
    const session: TimeTravelDebugSession = {
      sessionId: newId("ttdebug"),
      taskId,
      executionId,
      harnessRunId: executionId,
      breakpoints: [],
      snapshots: [],
      currentEventIndex: 0,
      accessContext,
      sandboxPolicy,
      startedAt: nowIso(),
      endedAt: null,
    };
    tenantSessions.set(session.sessionId, session);
    return session;
  }

  public setBreakpoints(sessionId: string, stepIds: readonly string[]): void {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (!session) return;
    sessionRecord.tenantSessions.set(sessionId, {
      ...session,
      breakpoints: [...stepIds],
    });
  }

  public loadEventStore(
    executionId: string,
    events: readonly TimeTravelDebugEvent[],
    accessContext: ReplayAccessContext = defaultReplayAccessContext(),
  ): void {
    this.assertReplayAccess(accessContext);
    const tenantId = resolveTenantId(accessContext);
    const tenantEventStore = getOrCreateTenantBucket(this.eventStoreByTenant, tenantId);
    const previousEvents = tenantEventStore.get(executionId) ?? [];
    const boundedEvents = events.length > this.maxEventsPerExecution
      ? events.slice(events.length - this.maxEventsPerExecution)
      : [...events];
    tenantEventStore.set(executionId, boundedEvents);
    const truncatedCount = Math.max(0, previousEvents.length - boundedEvents.length);
    if (truncatedCount > 0) {
      for (const [sessionId, session] of getOrCreateTenantBucket(this.sessionsByTenant, tenantId).entries()) {
        if (session.executionId !== executionId) {
          continue;
        }
        getOrCreateTenantBucket(this.sessionsByTenant, tenantId).set(sessionId, {
          ...session,
          currentEventIndex: Math.max(0, session.currentEventIndex - truncatedCount),
        });
      }
    }
  }

  public replayToCursor(sessionId: string, toEventIndex: number): ReplayState | null {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (!session) return null;
    this.assertReplayAccess(session.accessContext);

    const events = sessionRecord.tenantEventStore.get(session.executionId) ?? [];
    const currentIndex = session.currentEventIndex;

    if (toEventIndex === currentIndex) {
      return this.buildReplayState(session, currentIndex, currentIndex, false);
    }

    const prevIndex = currentIndex; // capture before loop to preserve correct fromEventIndex

    for (let i = currentIndex; i < Math.min(toEventIndex, events.length); i++) {
      const event = events[i]!;
      this.assertReplayEventAllowed(session, event);
      const stepId = readEventStepId(event);
      if (session.breakpoints.includes(stepId)) {
        this.captureSnapshot(session, event, i);
        session.currentEventIndex = i + 1;
        return this.buildReplayState(session, prevIndex, session.currentEventIndex, true);
      }
    }

    session.currentEventIndex = Math.min(toEventIndex, events.length);
    return this.buildReplayState(session, prevIndex, session.currentEventIndex, false);
  }

  public replayStep(sessionId: string): ReplayState | null {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (!session) return null;
    this.assertReplayAccess(session.accessContext);

    const events = sessionRecord.tenantEventStore.get(session.executionId) ?? [];
    if (session.currentEventIndex >= events.length) {
      return this.buildReplayState(session, session.currentEventIndex, session.currentEventIndex, false);
    }

    const prevIndex = session.currentEventIndex;
    const event = events[session.currentEventIndex]!;
    this.assertReplayEventAllowed(session, event);
    const stepId = readEventStepId(event);
    session.currentEventIndex++;

    const reachedBreakpoint = session.breakpoints.includes(stepId);
    if (reachedBreakpoint) {
      this.captureSnapshot(session, event, prevIndex);
    }

    return this.buildReplayState(session, prevIndex, session.currentEventIndex, reachedBreakpoint);
  }

  public jumpToStep(sessionId: string, stepId: string): ReplayState | null {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (!session) return null;
    this.assertReplayAccess(session.accessContext);

    const events = sessionRecord.tenantEventStore.get(session.executionId) ?? [];
    const targetIndex = events.findIndex((e) => readEventStepId(e) === stepId);
    if (targetIndex === -1) return null;
    this.assertReplayEventAllowed(session, events[targetIndex]!);

    const prevIndex = session.currentEventIndex;
    session.currentEventIndex = targetIndex + 1;
    return this.buildReplayState(session, prevIndex, session.currentEventIndex, false);
  }

  public getSnapshot(sessionId: string, stepId: string): DebugSnapshot | null {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (session == null) {
      return null;
    }
    this.assertReplayAccess(session.accessContext);
    const sessionSnapshots = sessionRecord.tenantSnapshots.get(sessionId) ?? [];
    return sessionSnapshots.find((s) => s.stepId === stepId) ?? null;
  }

  public getVariableState(sessionId: string, atEventIndex: number): readonly VariableState[] {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (!session) return [];
    this.assertReplayAccess(session.accessContext);

    const events = sessionRecord.tenantEventStore.get(session.executionId) ?? [];
    // R21-19 fix: Use map to deduplicate, keeping only the latest value per variable name
    const variableMap = new Map<string, VariableState>();

    for (let i = 0; i <= atEventIndex && i < events.length; i++) {
      const event = events[i]!;
      const vars = readVariables(event);
      if (typeof vars === "object") {
        for (const [name, value] of Object.entries(vars)) {
          const unwrapped = readVariableValue(value);
          const perVariableScope = typeof value === "object" && value !== null && "scope" in value && isVariableScope((value as TimeTravelDebugVariableEnvelope).scope)
            ? (value as TimeTravelDebugVariableEnvelope).scope!
            : null;
          variableMap.set(name, {
            name,
            value: unwrapped,
            type: describeVariableType(unwrapped),
            scope: perVariableScope ?? (isVariableScope(event.scope) ? event.scope : "step"),
          });
        }
      }
    }

    return Array.from(variableMap.values());
  }

  public endSession(sessionId: string): void {
    const sessionRecord = this.findSessionRecord(sessionId);
    const session = sessionRecord?.session;
    if (!session) return;
    const endedSession = {
      ...session,
      endedAt: nowIso(),
    };
    sessionRecord.tenantSessions.set(sessionId, endedSession);
    this.archivedSessions.set(sessionId, endedSession);
  }

  private captureSnapshot(session: TimeTravelDebugSession, event: TimeTravelDebugEvent, eventIndex: number): void {
    const vars = readVariables(event);
    const snapshot: DebugSnapshot = {
      snapshotId: newId("snap"),
      taskId: session.taskId,
      executionId: session.executionId,
      harnessRunId: session.executionId,
      stepId: readEventStepId(event),
      nodeRunId: readEventStepId(event),
      timestamp: String(event.timestamp ?? nowIso()),
      variablesJson: JSON.stringify(vars),
      stackTrace: event.stackTrace ?? null,
      eventIndex,
    };

    const tenantSnapshots = getOrCreateTenantBucket(this.snapshotsByTenant, resolveTenantId(session.accessContext));
    const existing = tenantSnapshots.get(session.sessionId) ?? [];
    const nextSnapshots = [...existing, snapshot];
    tenantSnapshots.set(
      session.sessionId,
      nextSnapshots.length > this.maxSnapshotsPerSession
        ? nextSnapshots.slice(nextSnapshots.length - this.maxSnapshotsPerSession)
        : nextSnapshots,
    );
  }

  private buildReplayState(
    session: TimeTravelDebugSession,
    fromEventIndex: number,
    toEventIndex: number,
    reachedBreakpoint: boolean,
  ): ReplayState {
    const events = getOrCreateTenantBucket(this.eventStoreByTenant, resolveTenantId(session.accessContext)).get(session.executionId) ?? [];
    const normalizedToEventIndex = toEventIndex <= fromEventIndex ? fromEventIndex + 1 : toEventIndex;
    const variables = this.getVariableState(session.sessionId, normalizedToEventIndex);

    return {
      cursor: {
        taskId: session.taskId,
        executionId: session.executionId,
        harnessRunId: session.executionId,
        fromEventIndex,
        toEventIndex: normalizedToEventIndex,
      },
      currentEventIndex: session.currentEventIndex,
      variables,
      reachedBreakpoint,
    };
  }

  private evictOldestSessionIfNeeded(): void {
    const activeSessions = [...this.sessionsByTenant.values()].flatMap((tenantSessions) => [...tenantSessions.values()]);
    if (activeSessions.length < this.maxSessions) {
      return;
    }
    const oldest = activeSessions
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))[0];
    if (!oldest) {
      return;
    }
    const tenantId = resolveTenantId(oldest.accessContext);
    const tenantSessions = getOrCreateTenantBucket(this.sessionsByTenant, tenantId);
    const tenantSnapshots = getOrCreateTenantBucket(this.snapshotsByTenant, tenantId);
    const tenantEventStore = getOrCreateTenantBucket(this.eventStoreByTenant, tenantId);
    const executionIdToEvict = oldest.executionId;
    const stillUsed = [...tenantSessions.values()].some(
      (s) => s.sessionId !== oldest.sessionId && s.executionId === executionIdToEvict,
    );
    const archivedSession = {
      ...oldest,
      endedAt: nowIso(),
    };
    this.archivedSessions.set(oldest.sessionId, archivedSession);
    tenantSessions.delete(oldest.sessionId);
    tenantSnapshots.delete(oldest.sessionId);
    if (!stillUsed) {
      tenantEventStore.delete(executionIdToEvict);
    }
  }

  private assertReplayAccess(accessContext: ReplayAccessContext): void {
    if (accessContext.actorId.trim().length === 0) {
      throw new Error("time_travel_debug.actor_required");
    }
    if (!accessContext.permissions.includes("time_travel:replay")) {
      throw new Error(`time_travel_debug.permission_denied:${accessContext.actorId}`);
    }
    if (accessContext.sessionExpiresAt != null && Date.parse(accessContext.sessionExpiresAt) <= Date.now()) {
      throw new Error(`time_travel_debug.session_expired:${accessContext.actorId}`);
    }
    if (accessContext.environment === "prod") {
      if (!accessContext.mfaVerified) {
        throw new Error(`time_travel_debug.mfa_required:${accessContext.actorId}`);
      }
      if (!accessContext.permissions.includes("time_travel:replay:prod")) {
        throw new Error(`time_travel_debug.prod_permission_required:${accessContext.actorId}`);
      }
      if (accessContext.sessionExpiresAt == null) {
        throw new Error(`time_travel_debug.short_lived_session_required:${accessContext.actorId}`);
      }
    }
  }

  private assertReplayEventAllowed(session: TimeTravelDebugSession, event: TimeTravelDebugEvent): void {
    const effectType = event.effectType ?? (event.replayUnsafe ? "write" : null);
    if (!session.sandboxPolicy.blockExternalSideEffects || effectType == null) {
      return;
    }
    if (effectType === "read") {
      return;
    }
    if (effectType === "write" && session.sandboxPolicy.allowWrites) {
      return;
    }
    if (effectType === "network" && session.sandboxPolicy.allowNetwork) {
      return;
    }
    if (effectType === "process" && session.sandboxPolicy.allowProcess) {
      return;
    }
    if (effectType === "tool_call" && session.sandboxPolicy.allowToolCalls) {
      return;
    }
    throw new Error(`time_travel_debug.replay_side_effect_blocked:${effectType}`);
  }

  private findSessionRecord(sessionId: string): {
    readonly session: TimeTravelDebugSession;
    readonly tenantSessions: Map<string, TimeTravelDebugSession>;
    readonly tenantEventStore: Map<string, ReadonlyArray<TimeTravelDebugEvent>>;
    readonly tenantSnapshots: Map<string, DebugSnapshot[]>;
  } | null {
    for (const [tenantId, tenantSessions] of this.sessionsByTenant.entries()) {
      const session = tenantSessions.get(sessionId);
      if (session == null) {
        continue;
      }
      return {
        session,
        tenantSessions,
        tenantEventStore: getOrCreateTenantBucket(this.eventStoreByTenant, tenantId),
        tenantSnapshots: getOrCreateTenantBucket(this.snapshotsByTenant, tenantId),
      };
    }
    return null;
  }
}

function describeVariableType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function getOrCreateTenantBucket<TValue>(store: Map<string, Map<string, TValue>>, tenantId: string): Map<string, TValue> {
  const normalizedTenantId = tenantId.trim();
  let bucket = store.get(normalizedTenantId);
  if (bucket == null) {
    bucket = new Map<string, TValue>();
    store.set(normalizedTenantId, bucket);
  }
  return bucket;
}

function resolveTenantId(accessContext: ReplayAccessContext): string {
  return accessContext.tenantId?.trim().length ? accessContext.tenantId.trim() : "local";
}
