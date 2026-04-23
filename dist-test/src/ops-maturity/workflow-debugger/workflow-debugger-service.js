import { compareWorkflowRuns } from "./run-comparator/index.js";
import { isBreakpointHit } from "./breakpoint-manager/index.js";
import { renderWorkflowTimeline } from "./timeline-renderer/index.js";
export class WorkflowDebuggerService {
    breakpoints = new Map();
    registerBreakpoint(actor, environment, breakpoint) {
        if (environment === "prod" && !actor.canDebugProduction) {
            throw new Error(`workflow_debugger.prod_breakpoint_forbidden:${actor.actorId}`);
        }
        this.breakpoints.set(breakpoint.workflowId, [...(this.breakpoints.get(breakpoint.workflowId) ?? []), breakpoint]);
        return breakpoint;
    }
    listBreakpoints(workflowId) {
        return [...(this.breakpoints.get(workflowId) ?? [])];
    }
    evaluateTrace(frames) {
        if (frames.length === 0) {
            return [];
        }
        const workflowId = frames[0].workflowId;
        const breakpoints = (this.breakpoints.get(workflowId) ?? []).map((item) => ({
            breakpointId: item.breakpointId,
            stepId: item.stepSelector,
        }));
        return frames
            .filter((frame) => isBreakpointHit(breakpoints, frame.stepId))
            .map((frame) => {
            const matched = (this.breakpoints.get(frame.workflowId) ?? []).find((item) => item.stepSelector === frame.stepId);
            return {
                breakpointId: matched.breakpointId,
                workflowId: frame.workflowId,
                stepId: frame.stepId,
                action: matched.action,
                timestamp: frame.timestamp,
            };
        });
    }
    buildComparisonReport(workflowId, leftFrames, rightFrames) {
        const leftSnapshots = leftFrames.map((frame) => ({ stepId: frame.stepId, status: frame.status }));
        const rightSnapshots = rightFrames.map((frame) => ({ stepId: frame.stepId, status: frame.status }));
        return {
            workflowId,
            differences: compareWorkflowRuns(leftSnapshots, rightSnapshots),
            leftFrames: leftFrames.map((frame) => ({ ...frame })),
            rightFrames: rightFrames.map((frame) => ({ ...frame })),
        };
    }
    renderTraceTimeline(frames) {
        return renderWorkflowTimeline(frames.map((frame) => ({
            timestamp: frame.timestamp,
            label: frame.label,
        })));
    }
}
//# sourceMappingURL=workflow-debugger-service.js.map