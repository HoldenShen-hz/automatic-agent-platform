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
export class TimeTravelDebugService {
    sessions = new Map();
    eventStore = new Map();
    snapshots = new Map();
    createSession(taskId, executionId) {
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
        this.eventStore.set(executionId, [...events]);
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
                session.currentEventIndex = i;
                return this.buildReplayState(session, i, true);
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
        return this.buildReplayState(session, targetIndex, false);
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
            const vars = event.variables;
            if (vars && typeof vars === "object") {
                for (const [name, value] of Object.entries(vars)) {
                    variables.push({
                        name,
                        value: value?.value ?? value,
                        type: String(typeof value),
                        scope: event.scope ?? "step",
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
        const vars = event.variables ?? {};
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
        this.snapshots.set(session.sessionId, [...existing, snapshot]);
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
}
//# sourceMappingURL=time-travel-debug-service.js.map