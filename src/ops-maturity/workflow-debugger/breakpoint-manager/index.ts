export interface BreakpointDefinition {
  readonly breakpointId: string;
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
}

export function isBreakpointHit(breakpoints: readonly BreakpointDefinition[], nodeRunId: string): boolean {
  return breakpoints.some((item) => (item.nodeRunId ?? item.stepId) === nodeRunId);
}

export class BreakpointManager {
  private readonly breakpoints = new Map<string, BreakpointDefinition>();

  public setBreakpoint(
    breakpoint: BreakpointDefinition & {
      readonly taskId?: string;
      readonly stepIndex?: number;
      readonly condition?: string | null;
      readonly enabled?: boolean;
      readonly createdAt?: string;
    },
  ): void {
    const nodeRunId = breakpoint.nodeRunId ?? breakpoint.stepId ?? String(breakpoint.stepIndex ?? "");
    this.breakpoints.set(breakpoint.breakpointId, {
      breakpointId: breakpoint.breakpointId,
      nodeRunId,
      stepId: nodeRunId,
    });
  }

  public hasBreakpoint(_taskId: string, stepIndex: number): boolean {
    const key = String(stepIndex);
    return [...this.breakpoints.values()].some((item) => (item.nodeRunId ?? item.stepId) === key);
  }

  public getBreakpoint(breakpointId: string): (BreakpointDefinition & { readonly stepIndex?: number }) | null {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint == null) {
      return null;
    }
    const rawStep = breakpoint.nodeRunId ?? breakpoint.stepId;
    const numericStep = rawStep != null && /^\d+$/.test(rawStep) ? Number(rawStep) : undefined;
    return {
      ...breakpoint,
      ...(numericStep == null ? {} : { stepIndex: numericStep }),
    };
  }
}
