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
export declare class TimeTravelDebugService {
    private readonly sessions;
    private readonly eventStore;
    private readonly snapshots;
    createSession(taskId: string, executionId: string): TimeTravelDebugSession;
    setBreakpoints(sessionId: string, stepIds: readonly string[]): void;
    loadEventStore(executionId: string, events: readonly Record<string, unknown>[]): void;
    replayToCursor(sessionId: string, toEventIndex: number): ReplayState | null;
    replayStep(sessionId: string): ReplayState | null;
    jumpToStep(sessionId: string, stepId: string): ReplayState | null;
    getSnapshot(sessionId: string, stepId: string): DebugSnapshot | null;
    getVariableState(sessionId: string, atEventIndex: number): readonly VariableState[];
    endSession(sessionId: string): void;
    private captureSnapshot;
    private buildReplayState;
}
