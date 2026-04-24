/**
 * @fileoverview Step Inspector
 *
 * Provides:
 * - Step-level state inspection
 * - Variable capture at each step
 * - Input/output tracking
 * - Stack frame inspection
 *
 * §64 调试器 - 步骤检查器
 */

export interface StepState {
  readonly stepId: string;
  readonly status: "pending" | "running" | "done" | "failed" | "skipped";
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly input: unknown;
  readonly output: unknown;
}

export interface StepVariable {
  readonly name: string;
  readonly value: unknown;
  readonly scope: "global" | "step" | "loop";
  readonly capturedAt: string;
}

export interface StepStackFrame {
  readonly frameId: string;
  readonly functionName: string;
  readonly fileName: string | null;
  readonly lineNumber: number | null;
  readonly locals: Readonly<Record<string, unknown>>;
}

export interface StepInspectionResult {
  readonly stepId: string;
  readonly state: StepState;
  readonly variables: readonly StepVariable[];
  readonly stackFrames: readonly StepStackFrame[];
  readonly error: string | null;
}

export interface StepInspectorOptions {
  maxVariablesPerStep?: number;
  maxStackFrames?: number;
  captureLocals?: boolean;
}

export class StepInspector {
  private readonly maxVariablesPerStep: number;
  private readonly maxStackFrames: number;
  private readonly captureLocals: boolean;
  private readonly stepStates = new Map<string, StepState>();
  private readonly stepVariables = new Map<string, StepVariable[]>();
  private readonly stepStackFrames = new Map<string, StepStackFrame[]>();

  public constructor(options: StepInspectorOptions = {}) {
    this.maxVariablesPerStep = options.maxVariablesPerStep ?? 100;
    this.maxStackFrames = options.maxStackFrames ?? 50;
    this.captureLocals = options.captureLocals ?? true;
  }

  public beginStep(stepId: string, input: unknown): void {
    this.stepStates.set(stepId, {
      stepId,
      status: "running",
      startedAt: new Date().toISOString(),
      completedAt: null,
      input,
      output: null,
    });
    this.stepVariables.set(stepId, []);
    this.stepStackFrames.set(stepId, []);
  }

  public captureVariable(stepId: string, name: string, value: unknown, scope: StepVariable["scope"]): void {
    const state = this.stepStates.get(stepId);
    if (!state || state.status !== "running") {
      return;
    }

    const existing = this.stepVariables.get(stepId) ?? [];
    if (existing.length >= this.maxVariablesPerStep) {
      return;
    }

    const variable: StepVariable = {
      name,
      value,
      scope,
      capturedAt: new Date().toISOString(),
    };

    this.stepVariables.set(stepId, [...existing, variable]);
  }

  public captureStackFrame(stepId: string, frame: Omit<StepStackFrame, "frameId">): void {
    if (!this.captureLocals) {
      return;
    }

    const state = this.stepStates.get(stepId);
    if (!state || state.status !== "running") {
      return;
    }

    const existing = this.stepStackFrames.get(stepId) ?? [];
    if (existing.length >= this.maxStackFrames) {
      return;
    }

    const stackFrame: StepStackFrame = {
      frameId: `frame_${existing.length}`,
      ...frame,
    };

    this.stepStackFrames.set(stepId, [...existing, stackFrame]);
  }

  public completeStep(stepId: string, output: unknown): void {
    const state = this.stepStates.get(stepId);
    if (!state) {
      return;
    }

    this.stepStates.set(stepId, {
      ...state,
      status: "done",
      completedAt: new Date().toISOString(),
      output,
    });
  }

  public failStep(stepId: string, error: string): void {
    const state = this.stepStates.get(stepId);
    if (!state) {
      return;
    }

    this.stepStates.set(stepId, {
      ...state,
      status: "failed",
      completedAt: new Date().toISOString(),
      output: error,
    });
  }

  public skipStep(stepId: string): void {
    const state = this.stepStates.get(stepId);
    if (!state) {
      return;
    }

    this.stepStates.set(stepId, {
      ...state,
      status: "skipped",
      completedAt: new Date().toISOString(),
    });
  }

  public getStepState(stepId: string): StepState | null {
    return this.stepStates.get(stepId) ?? null;
  }

  public getStepVariables(stepId: string): readonly StepVariable[] {
    return [...(this.stepVariables.get(stepId) ?? [])];
  }

  public getStepStackFrames(stepId: string): readonly StepStackFrame[] {
    return [...(this.stepStackFrames.get(stepId) ?? [])];
  }

  public inspectStep(stepId: string): StepInspectionResult | null {
    const state = this.stepStates.get(stepId);
    if (!state) {
      return null;
    }

    const variables = this.getStepVariables(stepId);
    const stackFrames = this.getStepStackFrames(stepId);
    const error = state.status === "failed" ? String(state.output) : null;

    return {
      stepId,
      state,
      variables,
      stackFrames,
      error,
    };
  }

  public listSteps(): readonly string[] {
    return [...this.stepStates.keys()];
  }

  public reset(): void {
    this.stepStates.clear();
    this.stepVariables.clear();
    this.stepStackFrames.clear();
  }
}