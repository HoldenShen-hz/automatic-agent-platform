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
  harnessRunId: string;
  nodeRunId: string;
  timestamp: string;
  variablesJson: string;
  stackTrace: string | null;
  eventIndex: number;
  /** @deprecated use nodeRunId */
  stepId?: string;
  /** @deprecated use harnessRunId */
  executionId?: string;
}

export interface ReplayCursor {
  taskId: string;
  harnessRunId: string;
  fromEventIndex: number;
  toEventIndex: number;
  /** @deprecated use harnessRunId */
  executionId?: string;
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
  harnessRunId: string;
  breakpoints: readonly string[];
  snapshots: readonly DebugSnapshot[];
  currentEventIndex: number;
  startedAt: string;
  endedAt: string | null;
  /** @deprecated use harnessRunId */
  executionId?: string;
}

export interface TimeTravelDebugVariableEnvelope {
  readonly value?: unknown;
}

export interface TimeTravelDebugEvent {
  readonly nodeRunId?: string | null;
  readonly timestamp?: string | null;
  readonly variables?: Readonly<Record<string, unknown>> | null;
  readonly stackTrace?: string | null;
  readonly scope?: VariableState["scope"] | null;
  /** @deprecated use nodeRunId */
  readonly stepId?: string | null;
}

export interface TimeTravelDebugServiceOptions {
  maxSessions?: number;
  maxEventsPerExecution?: number;
  maxSnapshotsPerSession?: number;
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

  public createSession(taskId: string, harnessRunId: string): TimeTravelDebugSession {
    this.evictOldestSessionIfNeeded();
    const session: TimeTravelDebugSession = {
      sessionId: newId("ttdebug"),
      taskId,
      harnessRunId,
      executionId: harnessRunId, // deprecated alias
      breakpoints: [],
      snapshots: [],
      currentEventIndex: 0,
      startedAt: nowIso(),
      endedAt: null,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public setBreakpoints(sessionId: string, nodeRunIds: readonly string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.breakpoints = [...nodeRunIds];
  }

  public loadEventStore(harnessRunId: string, events: readonly TimeTravelDebugEvent[]): void {
    const boundedEvents = events.length > this.maxEventsPerExecution
      ? events.slice(events.length - this.maxEventsPerExecution)
      : [...events];
    this.eventStore.set(harnessRunId, boundedEvents);
  }

  public replayToCursor(sessionId: string, toEventIndex: number): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.harnessRunId) ?? [];
    const currentIndex = session.currentEventIndex;

    for (let i = currentIndex; i < Math.min(toEventIndex, events.length); i++) {
      const event = events[i]!;
      const nodeRunId = String(event.nodeRunId ?? event.stepId ?? "");
      if (session.breakpoints.includes(nodeRunId)) {
        this.captureSnapshot(session, event, i);
        session.currentEventIndex = i + 1;
        return this.buildReplayState(session, session.currentEventIndex, true);
      }
    }

    session.currentEventIndex = Math.min(toEventIndex, events.length);
    return this.buildReplayState(session, session.currentEventIndex, false);
  }

  public replayStep(sessionId: string): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.harnessRunId) ?? [];
    if (session.currentEventIndex >= events.length) {
      return this.buildReplayState(session, session.currentEventIndex, false);
    }

    const event = events[session.currentEventIndex]!;
    const nodeRunId = String(event.nodeRunId ?? event.stepId ?? "");
    session.currentEventIndex++;

    const reachedBreakpoint = session.breakpoints.includes(nodeRunId);
    if (reachedBreakpoint) {
      this.captureSnapshot(session, event, session.currentEventIndex - 1);
    }

    return this.buildReplayState(session, session.currentEventIndex, reachedBreakpoint);
  }

  public jumpToStep(sessionId: string, nodeRunId: string): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.harnessRunId) ?? [];
    const targetIndex = events.findIndex((e) => String(e.nodeRunId ?? e.stepId) === nodeRunId);
    if (targetIndex === -1) return null;

    session.currentEventIndex = targetIndex + 1;
    return this.buildReplayState(session, session.currentEventIndex, false);
  }

  public getSnapshot(sessionId: string, nodeRunId: string): DebugSnapshot | null {
    const sessionSnapshots = this.snapshots.get(sessionId) ?? [];
    return sessionSnapshots.find((s) => s.nodeRunId === nodeRunId || s.stepId === nodeRunId) ?? null;
  }

  public getVariableState(sessionId: string, atEventIndex: number): readonly VariableState[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const events = this.eventStore.get(session.harnessRunId) ?? [];
    const variables: VariableState[] = [];

    for (let i = 0; i <= atEventIndex && i < events.length; i++) {
      const event = events[i]!;
      const vars = readVariables(event);
      if (typeof vars === "object") {
        for (const [name, value] of Object.entries(vars)) {
          variables.push({
            name,
            value: readVariableValue(value),
            type: String(typeof value),
            scope: isVariableScope(event.scope) ? event.scope : "step",
          });
        }
      }
    }

    return variables;
  }

  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.endedAt = nowIso();
  }

  private captureSnapshot(session: TimeTravelDebugSession, event: TimeTravelDebugEvent, eventIndex: number): void {
    const vars = readVariables(event);
    const nodeRunId = String(event.nodeRunId ?? event.stepId ?? "");
    const snapshot: DebugSnapshot = {
      snapshotId: newId("snap"),
      taskId: session.taskId,
      harnessRunId: session.harnessRunId,
      executionId: session.harnessRunId, // deprecated alias
      nodeRunId,
      stepId: nodeRunId, // deprecated alias
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
    currentEventIndex: number,
    reachedBreakpoint: boolean,
  ): ReplayState {
    const events = this.eventStore.get(session.harnessRunId) ?? [];
    const variables = this.getVariableState(session.sessionId, currentEventIndex);

    return {
      cursor: {
        taskId: session.taskId,
        harnessRunId: session.harnessRunId,
        executionId: session.harnessRunId, // deprecated alias
        fromEventIndex: session.currentEventIndex,
        toEventIndex: currentEventIndex,
      },
      currentEventIndex,
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
    this.sessions.delete(oldest.sessionId);
    this.snapshots.delete(oldest.sessionId);
  }
}
