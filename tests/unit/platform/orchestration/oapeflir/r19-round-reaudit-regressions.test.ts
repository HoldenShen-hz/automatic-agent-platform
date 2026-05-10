import assert from "node:assert/strict";
import test from "node:test";

import { AssessmentService } from "../../../../../src/platform/orchestration/oapeflir/assessment-service.js";
import { OapeflirLoopService } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import { StageTransitionFSM } from "../../../../../src/platform/orchestration/oapeflir/stage-transition-fsm.js";
import type {
  ExecuteBridge,
  ExecutionContext,
  ExecutionResult,
  StepResult,
} from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";

class ReplanAwareBridge implements ExecuteBridge {
  public readonly contexts: ExecutionContext[] = [];
  public executionCount = 0;

  async executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult> {
    this.contexts.push(context);
    const shouldFail = this.executionCount === 0;
    return {
      stepId: step.stepId,
      status: shouldFail ? "failed" : "succeeded",
      durationMs: 25,
      tokenCost: 10,
      summary: shouldFail ? `Failed ${step.stepId}` : `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [],
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: !shouldFail,
    };
  }

  async executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    this.contexts.push(context);
    this.executionCount += 1;
    const shouldFail = this.executionCount === 1;
    const results = plan.steps.map((step) => ({
      stepId: step.stepId,
      status: shouldFail ? "failed" as const : "succeeded" as const,
      durationMs: 25,
      tokenCost: 10,
      summary: shouldFail ? `Failed ${step.stepId}` : `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [],
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: !shouldFail,
    }));
    return {
      planId: plan.planId,
      results,
      totalDurationMs: results.length * 25,
      totalTokenCost: results.length * 10,
      allSucceeded: !shouldFail,
      skippedStepIds: [],
      failedStepIds: shouldFail ? results.map((result) => result.stepId) : [],
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
    return result.results.map((stepResult) => ({
      stepId: stepResult.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: stepResult.summary,
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: stepResult.durationMs,
        tokensUsed: stepResult.tokenCost,
        modelId: stepResult.modelId,
        retryCount: stepResult.retryCount,
        validationPassed: stepResult.validationPassed,
      },
    }));
  }

  async executeSubgraph(subgraph: PlanStep[], context: ExecutionContext): Promise<ExecutionResult> {
    return this.executePlan({
      planId: "subgraph_test",
      taskId: context.taskId,
      version: 1,
      assessmentRef: "assessment_test",
      strategy: "linear",
      steps: subgraph,
      createdAt: Date.now(),
    }, context);
  }

  async executeChildRun(plan: Plan, context: ExecutionContext, _parentRunId: string): Promise<ExecutionResult> {
    return this.executePlan(plan, context);
  }
}

function createWorkflow(taskId: string) {
  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: [
      {
        stepId: `step_${taskId}`,
        divisionId: "coding",
        roleId: "writer",
        inputKeys: [],
        agentId: "agent_writer",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
    ],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };
}

function createSituation(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "task_assess",
    timestamp: Date.now(),
    objective: "review security deployment pipeline",
    currentPhase: "planning",
    userIntent: {
      raw: "review security deployment pipeline",
      normalized: "review security deployment pipeline",
      confidence: 0.92,
    },
    blockers: [],
    codebaseSnapshot: { rootPath: process.cwd(), fileCount: 1, relevantFiles: [] },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read"],
    },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [] },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
    ...overrides,
  };
}

test("R19-02: StageTransitionFSM allows feedback-driven re-entry to assess", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");

  const assessTransition = fsm.canTransitionTo("assess");

  assert.equal(assessTransition.allowed, true);
  assert.equal(assessTransition.reasonCode, "fsm.feedback_driven_replan");
});

test("R19-03/R19-04/R19-06: run re-enters plan after failed feedback and emits lifecycle events with reserved budget context", async () => {
  const executeBridge = new ReplanAwareBridge();
  const events: Array<{ eventType: string; taskId?: string | null; payload: Record<string, unknown> }> = [];
  const service = new OapeflirLoopService({
    executeBridge,
    eventPublisher: {
      publish(input: { eventType: string; taskId?: string | null; payload: Record<string, unknown> }) {
        events.push(input);
      },
    } as never,
  });

  const result = await service.run({
    taskId: "task_replan_round",
    objective: "Recover from failed validation and replan",
    workflow: createWorkflow("task_replan_round"),
  });

  assert.equal(executeBridge.executionCount, 2, "failed first execution should trigger a second execute pass");
  assert.equal(result.replanDecision.shouldReplan, false, "final iteration should converge after the second pass");
  assert.ok(executeBridge.contexts.every((context) => typeof context.budgetLedgerId === "string" && context.budgetLedgerId.length > 0));
  assert.ok(executeBridge.contexts.every((context) => context.tokenBudget === result.assessment.resourceAllocation.maxTokens));

  const lifecycleStages = events
    .filter((event) => event.eventType === "oapeflir.view.run_lifecycle")
    .map((event) => event.payload.stage);
  assert.ok(lifecycleStages.includes("observe"));
  assert.ok(lifecycleStages.includes("assess"));
  assert.ok(lifecycleStages.includes("plan"));
  assert.ok(lifecycleStages.includes("execute"));
  assert.ok(lifecycleStages.includes("feedback"));
});

test("R19-07/R19-12: AssessmentService exposes dynamic division routing and numeric complexity scoring in rationale", () => {
  const service = new AssessmentService();
  const { assessment } = service.assess(createSituation({
    objective: "security review for deployment pipeline",
    userIntent: {
      raw: "security review for deployment pipeline",
      normalized: "security review for deployment pipeline",
      confidence: 0.92,
    },
    fileRefs: ["a.ts", "b.ts", "c.ts", "d.ts"],
    codebaseSnapshot: { rootPath: process.cwd(), fileCount: 4, relevantFiles: [] },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["security_scan"],
    },
  }));

  assert.equal(assessment.routingDecision.division, "security");
  assert.match(assessment.routingDecision.rationale, /complexityScore=\d+(\.\d+)?/);
  assert.equal(assessment.complexity, "moderate");
});

test("R19-10: StageTransitionFSM persists skipped reason codes for evidence lookup", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageSkipped("learn", "learning.no_objects");
  assert.equal(fsm.getSkippedReasonCode("learn"), "learning.no_objects");
  assert.equal(fsm.getStageSkipReason("learn"), "learning.no_objects");
});

test("R19-13: Observe-to-assess fallback confidence no longer hardcodes a below-threshold 0.5", async () => {
  const service = new OapeflirLoopService();
  const fallbackObservation = (service as unknown as {
    deriveFallbackIntentConfidence: (input: {
      taskId: string;
      objective: string;
      workflow: ReturnType<typeof createWorkflow>;
      fileRefs?: string[];
      blockerSummaries?: string[];
    }) => number;
  }).deriveFallbackIntentConfidence({
    taskId: "task_fallback_confidence",
    objective: "Repair the broken pipeline",
    workflow: createWorkflow("task_fallback_confidence"),
    fileRefs: ["src/pipeline.ts"],
    blockerSummaries: ["build is failing"],
  });

  assert.ok(fallbackObservation >= 0.65);
  assert.notEqual(fallbackObservation, 0.5);
});
