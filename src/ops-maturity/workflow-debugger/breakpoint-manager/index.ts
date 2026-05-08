export interface BreakpointDefinition {
  readonly breakpointId: string;
  readonly stepId: string;
}

export function isBreakpointHit(breakpoints: readonly BreakpointDefinition[], stepId: string): boolean {
  return breakpoints.some((item) => item.stepId === stepId);
}
