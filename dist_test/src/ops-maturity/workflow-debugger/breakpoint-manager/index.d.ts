export interface BreakpointDefinition {
    readonly breakpointId: string;
    readonly stepId: string;
}
export declare function isBreakpointHit(breakpoints: readonly BreakpointDefinition[], stepId: string): boolean;
