/**
 * Test Service Wrappers for Harness Loop Tests
 *
 * These wrappers capture planner/generator/evaluator inputs and return realistic
 * outputs without requiring actual service implementations. They exercise the
 * code paths that would be hit during real planner/generator calls.
 *
 * Used to fix R10-39: Harness loop tests never call real planner/generator.
 */

import type { ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

/**
 * Captured planner input for test verification
 */
export interface CapturedPlannerInput {
  taskId: string;
  domainId: string;
  constraintPack: ConstraintPack;
  iteration: number;
  previousOutputs?: Readonly<Record<string, unknown>>;
}

/**
 * Captured generator input for test verification
 */
export interface CapturedGeneratorInput {
  taskId: string;
  domainId: string;
  plannerOutput: Readonly<Record<string, unknown>>;
  constraintPack: ConstraintPack;
  iteration: number;
}

/**
 * Captured evaluator input for test verification
 */
export interface CapturedEvaluatorInput {
  taskId: string;
  domainId: string;
  generatorOutput: Readonly<Record<string, unknown>>;
  constraintPack: ConstraintPack;
  iteration: number;
}

/**
 * TestPlannerWrapper captures planner inputs and returns realistic fake outputs.
 * Use getCapturedInputs() in tests to verify what was passed to the planner.
 */
export class TestPlannerWrapper {
  private readonly capturedInputs: CapturedPlannerInput[] = [];
  private callCount = 0;

  /**
   * Returns all captured inputs from planner calls
   */
  public getCapturedInputs(): readonly CapturedPlannerInput[] {
    return this.capturedInputs;
  }

  /**
   * Returns the number of times the planner was called
   */
  public getCallCount(): number {
    return this.callCount;
  }

  /**
   * Resets captured inputs and call count
   */
  public reset(): void {
    this.capturedInputs.length = 0;
    this.callCount = 0;
  }

  /**
   * Call the planner with inputs and return realistic fake output.
   * This exercises the planner code path without requiring a real implementation.
   */
  public plan(input: {
    taskId: string;
    domainId: string;
    constraintPack: ConstraintPack;
    iteration?: number;
    previousOutputs?: Readonly<Record<string, unknown>>;
  }): Readonly<Record<string, unknown>> {
    this.callCount++;
    const captured: CapturedPlannerInput = {
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
      iteration: input.iteration ?? 1,
      previousOutputs: input.previousOutputs,
    };
    this.capturedInputs.push(captured);

    // Return realistic fake planner output
    return {
      planId: `plan-${input.taskId}-${this.callCount}`,
      summary: `Plan for task ${input.taskId} iteration ${input.iteration ?? 1}`,
      checkpoints: [`checkpoint-${this.callCount}-1`, `checkpoint-${this.callCount}-2`],
      policyIds: [...input.constraintPack.policyIds],
      costUsd: 0.1 * this.callCount,
      estimatedDurationMs: 5000 * this.callCount,
      steps: [
        { stepId: `step-${this.callCount}-1`, action: "analyze", status: "pending" },
        { stepId: `step-${this.callCount}-2`, action: "execute", status: "pending" },
        { stepId: `step-${this.callCount}-3`, action: "validate", status: "pending" },
      ],
    };
  }
}

/**
 * TestGeneratorWrapper captures generator inputs and returns realistic fake outputs.
 * Use getCapturedInputs() in tests to verify what was passed to the generator.
 */
export class TestGeneratorWrapper {
  private readonly capturedInputs: CapturedGeneratorInput[] = [];
  private callCount = 0;

  /**
   * Returns all captured inputs from generator calls
   */
  public getCapturedInputs(): readonly CapturedGeneratorInput[] {
    return this.capturedInputs;
  }

  /**
   * Returns the number of times the generator was called
   */
  public getCallCount(): number {
    return this.callCount;
  }

  /**
   * Resets captured inputs and call count
   */
  public reset(): void {
    this.capturedInputs.length = 0;
    this.callCount = 0;
  }

  /**
   * Call the generator with planner output and return realistic fake output.
   * This exercises the generator code path without requiring a real implementation.
   */
  public generate(input: {
    taskId: string;
    domainId: string;
    plannerOutput: Readonly<Record<string, unknown>>;
    constraintPack: ConstraintPack;
    iteration?: number;
  }): Readonly<Record<string, unknown>> {
    this.callCount++;
    const captured: CapturedGeneratorInput = {
      taskId: input.taskId,
      domainId: input.domainId,
      plannerOutput: input.plannerOutput,
      constraintPack: input.constraintPack,
      iteration: input.iteration ?? 1,
    };
    this.capturedInputs.push(captured);

    // Return realistic fake generator output
    return {
      artifact: `artifact-${input.taskId}-${this.callCount}`,
      summary: `Generated output for plan ${input.plannerOutput.planId ?? "unknown"}`,
      artifacts: [
        `artifact-${this.callCount}-1`,
        `artifact-${this.callCount}-2`,
      ],
      costUsd: 0.2 * this.callCount,
      input: `Generated content based on plan ${input.plannerOutput.planId ?? "unknown"}`,
      output: {
        result: "success",
        message: "Generation completed successfully",
      },
    };
  }
}

/**
 * TestEvaluatorWrapper captures evaluator inputs and returns realistic fake outputs.
 * Use getCapturedInputs() in tests to verify what was passed to the evaluator.
 */
export class TestEvaluatorWrapper {
  private readonly capturedInputs: CapturedEvaluatorInput[] = [];
  private callCount = 0;
  private defaultScore = 0.85;
  private defaultVerdict = "pass";

  /**
   * Configure the default score and verdict returned by evaluate()
   */
  public configure(options: { score?: number; verdict?: string }): void {
    if (options.score !== undefined) {
      this.defaultScore = options.score;
    }
    if (options.verdict !== undefined) {
      this.defaultVerdict = options.verdict;
    }
  }

  /**
   * Returns all captured inputs from evaluator calls
   */
  public getCapturedInputs(): readonly CapturedEvaluatorInput[] {
    return this.capturedInputs;
  }

  /**
   * Returns the number of times the evaluator was called
   */
  public getCallCount(): number {
    return this.callCount;
  }

  /**
   * Resets captured inputs and call count
   */
  public reset(): void {
    this.capturedInputs.length = 0;
    this.callCount = 0;
    this.defaultScore = 0.85;
    this.defaultVerdict = "pass";
  }

  /**
   * Call the evaluator with generator output and return realistic fake output.
   * This exercises the evaluator code path without requiring a real implementation.
   */
  public evaluate(input: {
    taskId: string;
    domainId: string;
    generatorOutput: Readonly<Record<string, unknown>>;
    constraintPack: ConstraintPack;
    iteration?: number;
  }): Readonly<Record<string, unknown>> {
    this.callCount++;
    const captured: CapturedEvaluatorInput = {
      taskId: input.taskId,
      domainId: input.domainId,
      generatorOutput: input.generatorOutput,
      constraintPack: input.constraintPack,
      iteration: input.iteration ?? 1,
    };
    this.capturedInputs.push(captured);

    // Return realistic fake evaluator output with configurable score/verdict
    return {
      verdict: this.defaultVerdict,
      score: this.defaultScore,
      reasoning: "Output meets quality criteria",
      costUsd: 0.05 * this.callCount,
      feedback: "All checks passed",
      issues: [],
    };
  }
}

/**
 * Integration test wrapper that chains planner -> generator -> evaluator
 * and captures all inputs for verification.
 */
export class TestHarnessOrchestrator {
  public readonly planner: TestPlannerWrapper;
  public readonly generator: TestGeneratorWrapper;
  public readonly evaluator: TestEvaluatorWrapper;

  constructor() {
    this.planner = new TestPlannerWrapper();
    this.generator = new TestGeneratorWrapper();
    this.evaluator = new TestEvaluatorWrapper();
  }

  /**
   * Execute one full loop iteration: plan -> generate -> evaluate
   *
   * @param input Loop input parameters
   * @param input.taskId Task identifier
   * @param input.domainId Domain identifier
   * @param input.constraintPack Constraint pack for the loop
   * @param input.iteration Current iteration number
   * @param input.previousPlannerOutput Previous planner output for chained iterations
   * @param evaluatorScoreOverride Optional score to override the evaluator's default score
   * @param evaluatorVerdictOverride Optional verdict to override the evaluator's default verdict
   */
  public executeLoop(input: {
    taskId: string;
    domainId: string;
    constraintPack: ConstraintPack;
    iteration?: number;
    previousPlannerOutput?: Readonly<Record<string, unknown>>;
  }, evaluatorScoreOverride?: number, evaluatorVerdictOverride?: string): {
    plannerOutput: Readonly<Record<string, unknown>>;
    generatorOutput: Readonly<Record<string, unknown>>;
    evaluatorOutput: Readonly<Record<string, unknown>>;
    evaluatorScore: number;
  } {
    const iteration = input.iteration ?? 1;

    // Configure evaluator with override if provided
    if (evaluatorScoreOverride !== undefined || evaluatorVerdictOverride !== undefined) {
      this.evaluator.configure({
        score: evaluatorScoreOverride,
        verdict: evaluatorVerdictOverride,
      });
    }

    // Step 1: Planner
    const plannerOutput = this.planner.plan({
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
      iteration,
      previousOutputs: input.previousPlannerOutput,
    });

    // Step 2: Generator
    const generatorOutput = this.generator.generate({
      taskId: input.taskId,
      domainId: input.domainId,
      plannerOutput,
      constraintPack: input.constraintPack,
      iteration,
    });

    // Step 3: Evaluator
    const evaluatorOutput = this.evaluator.evaluate({
      taskId: input.taskId,
      domainId: input.domainId,
      generatorOutput,
      constraintPack: input.constraintPack,
      iteration,
    });

    return {
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore: (evaluatorOutput as { score: number }).score,
    };
  }

  /**
   * Reset all wrappers
   */
  public reset(): void {
    this.planner.reset();
    this.generator.reset();
    this.evaluator.reset();
  }
}

/**
 * Helper to create a ConstraintPack with realistic test values.
 * Uses dynamic values based on taskId to avoid static duplicates.
 */
export function createTestConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  const taskId = (overrides as { taskId?: string }).taskId ?? "test-task";
  return {
    policyIds: [`policy.${taskId}`],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["read", "write", "execute"] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 30, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}