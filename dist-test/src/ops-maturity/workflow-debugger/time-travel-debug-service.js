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
function isVariableScope(value) {
    return value === "global" || value === "step" || value === "loop";
}
function readVariables(event) {
    return event.variables ?? {};
}
function readVariableValue(value) {
    if (typeof value === "object" && value !== null && "value" in value) {
        return value.value ?? value;
    }
    return value;
}
export class TimeTravelDebugService {
    maxSessions;
    maxEventsPerExecution;
    maxSnapshotsPerSession;
    sessions = new Map();
    eventStore = new Map();
    snapshots = new Map();
    constructor(options = {}) {
        this.maxSessions = options.maxSessions ?? 100;
        this.maxEventsPerExecution = options.maxEventsPerExecution ?? 10_000;
        this.maxSnapshotsPerSession = options.maxSnapshotsPerSession ?? 100;
    }
    createSession(taskId, executionId) {
        this.evictOldestSessionIfNeeded();
        const session = {
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
    setBreakpoints(sessionId, stepIds) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.breakpoints = [...stepIds];
    }
    loadEventStore(executionId, events) {
        const boundedEvents = events.length > this.maxEventsPerExecution
            ? events.slice(events.length - this.maxEventsPerExecution)
            : [...events];
        this.eventStore.set(executionId, boundedEvents);
    }
    replayToCursor(sessionId, toEventIndex) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const events = this.eventStore.get(session.executionId) ?? [];
        const currentIndex = session.currentEventIndex;
        for (let i = currentIndex; i < Math.min(toEventIndex, events.length); i++) {
            const event = events[i];
            const stepId = String(event.stepId ?? "");
            if (session.breakpoints.includes(stepId)) {
                this.captureSnapshot(session, event, i);
                session.currentEventIndex = i + 1;
                return this.buildReplayState(session, session.currentEventIndex, true);
            }
        }
        session.currentEventIndex = Math.min(toEventIndex, events.length);
        return this.buildReplayState(session, session.currentEventIndex, false);
    }
    replayStep(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const events = this.eventStore.get(session.executionId) ?? [];
        if (session.currentEventIndex >= events.length) {
            return this.buildReplayState(session, session.currentEventIndex, false);
        }
        const event = events[session.currentEventIndex];
        const stepId = String(event.stepId ?? "");
        session.currentEventIndex++;
        const reachedBreakpoint = session.breakpoints.includes(stepId);
        if (reachedBreakpoint) {
            this.captureSnapshot(session, event, session.currentEventIndex - 1);
        }
        return this.buildReplayState(session, session.currentEventIndex, reachedBreakpoint);
    }
    jumpToStep(sessionId, stepId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const events = this.eventStore.get(session.executionId) ?? [];
        const targetIndex = events.findIndex((e) => String(e.stepId) === stepId);
        if (targetIndex === -1)
            return null;
        session.currentEventIndex = targetIndex + 1;
        return this.buildReplayState(session, session.currentEventIndex, false);
    }
    getSnapshot(sessionId, stepId) {
        const sessionSnapshots = this.snapshots.get(sessionId) ?? [];
        return sessionSnapshots.find((s) => s.stepId === stepId) ?? null;
    }
    getVariableState(sessionId, atEventIndex) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return [];
        const events = this.eventStore.get(session.executionId) ?? [];
        const variables = [];
        for (let i = 0; i <= atEventIndex && i < events.length; i++) {
            const event = events[i];
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
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.endedAt = nowIso();
    }
    captureSnapshot(session, event, eventIndex) {
        const vars = readVariables(event);
        const snapshot = {
            snapshotId: newId("snap"),
            taskId: session.taskId,
            executionId: session.executionId,
            stepId: String(event.stepId ?? ""),
            timestamp: String(event.timestamp ?? nowIso()),
            variablesJson: JSON.stringify(vars),
            stackTrace: event.stackTrace ?? null,
            eventIndex,
        };
        const existing = this.snapshots.get(session.sessionId) ?? [];
        const nextSnapshots = [...existing, snapshot];
        this.snapshots.set(session.sessionId, nextSnapshots.length > this.maxSnapshotsPerSession
            ? nextSnapshots.slice(nextSnapshots.length - this.maxSnapshotsPerSession)
            : nextSnapshots);
    }
    buildReplayState(session, currentEventIndex, reachedBreakpoint) {
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
    evictOldestSessionIfNeeded() {
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
//# sourceMappingURL=time-travel-debug-service.js.map