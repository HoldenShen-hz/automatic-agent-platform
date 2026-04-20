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
  stepId: string;
  timestamp: string;
  variablesJson: string;
  stackTrace: string | null;
  eventIndex: number;
}

export interface ReplayCursor {
  taskId: string;
  executionId: string;
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
  breakpoints: readonly string[];
  snapshots: readonly DebugSnapshot[];
  currentEventIndex: number;
  startedAt: string;
  endedAt: string | null;
}

export class TimeTravelDebugService {
  private readonly sessions = new Map<string, TimeTravelDebugSession>();
  private readonly eventStore = new Map<string, ReadonlyArray<Record<string, unknown>>>();
  private readonly snapshots = new Map<string, DebugSnapshot[]>();

  public createSession(taskId: string, executionId: string): TimeTravelDebugSession {
    const session: TimeTravelDebugSession = {
      sessionId: newId("ttdebug"),
      taskId,
      executionId,
      breakpoints: [],
      snapshots: [],
      currentEventIndex: 0,
      startedAt: nowIso(),
      endedAt: null,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public setBreakpoints(sessionId: string, stepIds: readonly string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.breakpoints = [...stepIds];
  }

  public loadEventStore(executionId: string, events: readonly Record<string, unknown>[]): void {
    this.eventStore.set(executionId, [...events]);
  }

  public replayToCursor(sessionId: string, toEventIndex: number): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.executionId) ?? [];
    const currentIndex = session.currentEventIndex;

    for (let i = currentIndex; i < Math.min(toEventIndex, events.length); i++) {
      const event = events[i]!;
      const stepId = String(event.stepId ?? "");
      if (session.breakpoints.includes(stepId)) {
        session.currentEventIndex = i;
        return this.buildReplayState(session, i, true);
      }
    }

    session.currentEventIndex = Math.min(toEventIndex, events.length);
    return this.buildReplayState(session, session.currentEventIndex, false);
  }

  public replayStep(sessionId: string): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.executionId) ?? [];
    if (session.currentEventIndex >= events.length) {
      return this.buildReplayState(session, session.currentEventIndex, false);
    }

    const event = events[session.currentEventIndex]!;
    const stepId = String(event.stepId ?? "");
    session.currentEventIndex++;

    const reachedBreakpoint = session.breakpoints.includes(stepId);
    if (reachedBreakpoint) {
      this.captureSnapshot(session, event, session.currentEventIndex - 1);
    }

    return this.buildReplayState(session, session.currentEventIndex, reachedBreakpoint);
  }

  public jumpToStep(sessionId: string, stepId: string): ReplayState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const events = this.eventStore.get(session.executionId) ?? [];
    const targetIndex = events.findIndex((e) => String(e.stepId) === stepId);
    if (targetIndex === -1) return null;

    session.currentEventIndex = targetIndex + 1;
    return this.buildReplayState(session, targetIndex, false);
  }

  public getSnapshot(sessionId: string, stepId: string): DebugSnapshot | null {
    const sessionSnapshots = this.snapshots.get(sessionId) ?? [];
    return sessionSnapshots.find((s) => s.stepId === stepId) ?? null;
  }

  public getVariableState(sessionId: string, atEventIndex: number): readonly VariableState[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const events = this.eventStore.get(session.executionId) ?? [];
    const variables: VariableState[] = [];

    for (let i = 0; i <= atEventIndex && i < events.length; i++) {
      const event = events[i]!;
      const vars = (event as any).variables;
      if (vars && typeof vars === "object") {
        for (const [name, value] of Object.entries(vars)) {
          variables.push({
            name,
            value: (value as any)?.value ?? value,
            type: String(typeof value),
            scope: (event as any).scope ?? "step",
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

  private captureSnapshot(session: TimeTravelDebugSession, event: Record<string, unknown>, eventIndex: number): void {
    const vars = (event as any).variables ?? {};
    const snapshot: DebugSnapshot = {
      snapshotId: newId("snap"),
      taskId: session.taskId,
      executionId: session.executionId,
      stepId: String(event.stepId ?? ""),
      timestamp: String(event.timestamp ?? nowIso()),
      variablesJson: JSON.stringify(vars),
      stackTrace: (event as any).stackTrace ?? null,
      eventIndex,
    };

    const existing = this.snapshots.get(session.sessionId) ?? [];
    this.snapshots.set(session.sessionId, [...existing, snapshot]);
  }

  private buildReplayState(
    session: TimeTravelDebugSession,
    currentEventIndex: number,
    reachedBreakpoint: boolean,
  ): ReplayState {
    const events = this.eventStore.get(session.executionId) ?? [];
    const variables = this.getVariableState(session.sessionId, currentEventIndex);

    return {
      cursor: {
        taskId: session.taskId,
        executionId: session.executionId,
        fromEventIndex: session.currentEventIndex,
        toEventIndex: currentEventIndex,
      },
      currentEventIndex,
      variables,
      reachedBreakpoint,
    };
  }
}
