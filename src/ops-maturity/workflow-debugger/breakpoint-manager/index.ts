export interface BreakpointDefinition {
  readonly breakpointId: string;
  readonly stepId?: string;
  readonly nodeRunId?: string;
}

export function isBreakpointHit(breakpoints: readonly BreakpointDefinition[], stepId: string): boolean {
  return breakpoints.some((item) => (item.nodeRunId ?? item.stepId) === stepId);
}
