export interface DebugBreakpointDefinition {
    readonly breakpointId: string;
    readonly workflowId: string;
    readonly stepSelector: string;
    readonly condition: string;
    readonly action: "pause" | "snapshot" | "compare";
}
export interface WorkflowTraceFrame {
    readonly workflowId: string;
    readonly stepId: string;
    readonly status: string;
    readonly timestamp: string;
    readonly label: string;
}
export interface BreakpointHit {
    readonly breakpointId: string;
    readonly workflowId: string;
    readonly stepId: string;
    readonly action: DebugBreakpointDefinition["action"];
    readonly timestamp: string;
}
export interface RunComparisonReport {
    readonly workflowId: string;
    readonly differences: readonly string[];
    readonly leftFrames: readonly WorkflowTraceFrame[];
    readonly rightFrames: readonly WorkflowTraceFrame[];
}
export interface DebuggerActor {
    readonly actorId: string;
    readonly canDebugProduction: boolean;
}
export declare class WorkflowDebuggerService {
    private readonly breakpoints;
    registerBreakpoint(actor: DebuggerActor, environment: "prod" | "staging" | "dev", breakpoint: DebugBreakpointDefinition): DebugBreakpointDefinition;
    listBreakpoints(workflowId: string): DebugBreakpointDefinition[];
    evaluateTrace(frames: readonly WorkflowTraceFrame[]): BreakpointHit[];
    buildComparisonReport(workflowId: string, leftFrames: readonly WorkflowTraceFrame[], rightFrames: readonly WorkflowTraceFrame[]): RunComparisonReport;
    renderTraceTimeline(frames: readonly WorkflowTraceFrame[]): string[];
}
