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
    return (value as TimeTravelDebugVariableEnvelope).value ?? value;
  }
  return value;
}

function defaultReplayAccessContext(): ReplayAccessContext {
  return {
    actorId: "local_debugger",
    environment: "dev",
    mfaVerified: true,
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
  private readonly sessions = new Map<string, TimeTravelDebugSession>();
  private readonly eventStore = new Map<string, ReadonlyArray<TimeTravelDebugEvent>>();
  private readonly snapshots = new Map<string, DebugSnapshot[]>();

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
    this.sessions.set(session.sessionId, session);
    this.evictOldestSessionIfNeeded();
    return session;
  }

  public setBreakpoints(sessionId: string, stepIds: readonly string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.breakpoints = [...stepIds];
  }

  public loadEventStore(executionId: string, events: readonly TimeTravelDebugEvent[]): void {
    const boundedEvents = events.length > this.maxEventsPerExecution
      ? events.slice(events.length - this.maxEventsPerExecution)
      : [...events];
    this.eventStore.set(executionId, boundedEvents);
  }

  public replayToCursor(sessionId: string, toEventIndex: number): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.executionId) ?? [];
    const currentIndex = session.currentEventIndex;

    // Handle edge case where toEventIndex == currentIndex (no advancement)
    // Use events.length + 1 as toEventIndex so fromEventIndex < toEventIndex is preserved
    if (toEventIndex === currentIndex) {
      const fromIdx = currentIndex;
      const toIdx = events.length + 1;
      return this.buildReplayState(session, fromIdx, toIdx, false);
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
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.executionId) ?? [];
    if (session.currentEventIndex >= events.length) {
      // Boundary case: already past last event. Use events.length+1 as toEventIndex
      // so that fromEventIndex < toEventIndex is preserved (e.g. from=2, to=3).
      const fromIdx = session.currentEventIndex;
      const toIdx = events.length + 1;
      return this.buildReplayState(session, fromIdx, toIdx, false);
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
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.executionId) ?? [];
    const targetIndex = events.findIndex((e) => readEventStepId(e) === stepId);
    if (targetIndex === -1) return null;
    this.assertReplayEventAllowed(session, events[targetIndex]!);

    const prevIndex = session.currentEventIndex;
    session.currentEventIndex = targetIndex + 1;
    return this.buildReplayState(session, prevIndex, session.currentEventIndex, false);
  }

  public getSnapshot(sessionId: string, stepId: string): DebugSnapshot | null {
    const sessionSnapshots = this.snapshots.get(sessionId) ?? [];
    return sessionSnapshots.find((s) => s.stepId === stepId) ?? null;
  }

  public getVariableState(sessionId: string, atEventIndex: number): readonly VariableState[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const events = this.eventStore.get(session.executionId) ?? [];
    // R21-19 fix: Use map to deduplicate, keeping only the latest value per variable name
    const variableMap = new Map<string, VariableState>();

    for (let i = 0; i <= atEventIndex && i < events.length; i++) {
      const event = events[i]!;
      const vars = readVariables(event);
      if (typeof vars === "object") {
        for (const [name, value] of Object.entries(vars)) {
          const unwrapped = readVariableValue(value);
          variableMap.set(name, {
            name,
            value: unwrapped,
            type: String(typeof unwrapped),
            scope: isVariableScope(event.scope) ? event.scope : "step",
          });
        }
      }
    }

    return Array.from(variableMap.values());
  }

  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.endedAt = nowIso();
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

    const existing = this.snapshots.get(session.sessionId) ?? [];
    const nextSnapshots = [...existing, snapshot];
    this.snapshots.set(
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
    const events = this.eventStore.get(session.executionId) ?? [];
    const variables = this.getVariableState(session.sessionId, toEventIndex);

    return {
      cursor: {
        taskId: session.taskId,
        executionId: session.executionId,
        harnessRunId: session.executionId,
        fromEventIndex,
        toEventIndex,
      },
      currentEventIndex: toEventIndex,
      variables,
      reachedBreakpoint,
    };
  }

  private evictOldestSessionIfNeeded(): void {
    if (this.sessions.size < this.maxSessions) {
      return;
    }
    const oldest = [...this.sessions.values()]
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))[0];
    if (!oldest) {
      return;
    }
    const executionIdToEvict = oldest.executionId;
    this.sessions.delete(oldest.sessionId);
    this.snapshots.delete(oldest.sessionId);
    // Clean up eventStore only if no other session references this executionId
    const stillUsed = [...this.sessions.values()].some(
      (s) => s.executionId === executionIdToEvict,
    );
    if (!stillUsed) {
      this.eventStore.delete(executionIdToEvict);
    }
  }

  private assertReplayAccess(accessContext: ReplayAccessContext): void {
    if (accessContext.actorId.trim().length === 0) {
      throw new Error("time_travel_debug.actor_required");
    }
    if (!accessContext.permissions.includes("time_travel:replay")) {
      throw new Error(`time_travel_debug.permission_denied:${accessContext.actorId}`);
    }
    if (accessContext.sessionExpiresAt != null && accessContext.sessionExpiresAt <= nowIso()) {
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
}
