export interface BreakpointDefinition {
  readonly breakpointId: string;
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
}

export function isBreakpointHit(breakpoints: readonly BreakpointDefinition[], nodeRunId: string): boolean {
  return breakpoints.some((item) => (item.nodeRunId ?? item.stepId) === nodeRunId);
}
