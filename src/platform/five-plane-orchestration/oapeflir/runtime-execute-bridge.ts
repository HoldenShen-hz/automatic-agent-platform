import { nowIso } from "../../contracts/types/ids.js";
import type {
  PlanEdge,
  PlanGraphBundle,
  PlanNode,
} from "../../contracts/executable-contracts/index.js";
import type { StepOutputRecord } from "../../contracts/types/domain/task-types.js";
import type { Plan, PlanStep } from "./types/plan.js";
import type { DualChannelStepOutput } from "./types/dual-channel-step-output.js";
import type {
  ExecuteBridge,
  ExecutionContext,
  ExecutionResult,
  StepResult,
} from "./execute-bridge.js";

export function mapStepOutputRecord(record: StepOutputRecord): StepResult {
  let outputs: Record<string, unknown> = {};
  try {
    outputs = JSON.parse(record.dataJson);
  } catch {
    outputs = {};
  }
  let artifacts: string[] = [];
  if (record.artifactsJson != null) {
    try {
      artifacts = JSON.parse(record.artifactsJson) as string[];
    } catch {
      artifacts = [];
    }
  }
  let validationPassed = false;
  if (record.validationJson != null) {
    try {
      validationPassed = (JSON.parse(record.validationJson) as { valid?: unknown }).valid === true;
    } catch {
      validationPassed = false;
    }
  }
  return {
    stepId: record.stepId ?? record.nodeRunId ?? "unknown",
    status: record.status === "succeeded" ? "succeeded" : record.status === "skipped" ? "skipped" : "failed",
    durationMs: record.durationMs,
    tokenCost: record.tokenCost,
    summary: record.summary ?? `Step ${record.stepId ?? record.nodeRunId ?? "unknown"} ${record.status}`,
    outputs,
    artifacts,
    modelId: "runtime",
    retryCount: 0,
    validationPassed,
  };
}

export function mapToDualChannelStepOutputs(
  records: StepOutputRecord[],
  planId: string,
): DualChannelStepOutput[] {
  return records.map((record) => {
    const result = mapStepOutputRecord(record);
    return {
      stepId: result.stepId,
      planRef: planId,
      userFacingResult: {
        summary: result.summary,
        artifacts: result.artifacts.map((artifact) => `artifact:${artifact}`),
      },
      systemTelemetry: {
        durationMs: result.durationMs,
        tokensUsed: result.tokenCost,
        modelId: result.modelId,
        retryCount: result.retryCount,
        validationPassed: result.validationPassed,
      },
    };
  });
}

export function extractStepOutputRecords(result: { snapshot?: unknown }): StepOutputRecord[] {
  const snapshot = result.snapshot as { executionRecord?: { stepOutputs?: unknown } } | undefined;
  const stepOutputs = snapshot?.executionRecord?.stepOutputs;
  if (!Array.isArray(stepOutputs)) {
    return [];
  }
  return stepOutputs.filter(isStepOutputRecord);
}

export function serialiseOapeflirPlan(steps: PlanStep[] | PlanNode[], parentContext?: Record<string, unknown>): string {
  const payload = parentContext == null ? steps : { steps, parentContext };
  return `oapeflir://plan ${JSON.stringify(payload)}`;
}

export function minimalWorkflowToPlanGraphBundle(
  workflow: {
    workflowId: string;
    divisionId?: string;
    steps?: readonly {
      stepId: string;
      outputKey?: string;
      timeoutMs?: number;
      maxAttempts?: number;
      dependsOnStepIds?: readonly string[];
    }[];
    executionSteps?: readonly {
      stepId: string;
      outputKey?: string;
      timeoutMs?: number;
      maxAttempts?: number;
      dependsOnStepIds?: readonly string[];
    }[];
  },
  harnessRunId: string,
): PlanGraphBundle {
  const steps = [...(workflow.steps ?? workflow.executionSteps ?? [])];
  const nodes: PlanNode[] = steps.map((step) => {
    const rawRoleId: unknown = "roleId" in step ? step.roleId : undefined;
    const roleId = typeof rawRoleId === "string" ? rawRoleId : undefined;
    return {
      nodeId: step.stepId,
      nodeType: inferNodeType(step.stepId, roleId),
      inputRefs: [...(step.dependsOnStepIds ?? [])],
      outputSchemaRef: step.outputKey ?? `schema:${step.stepId}`,
      riskClass: "medium",
      budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token", "compute"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: `retry:max:${step.maxAttempts ?? 1}`,
      timeoutMs: step.timeoutMs ?? 60_000,
    };
  });
  const edges: PlanEdge[] = steps.flatMap((step) =>
    [...(step.dependsOnStepIds ?? [])].map((dep) => ({
      edgeId: `edge:${dep}->${step.stepId}`,
      fromNodeId: dep,
      toNodeId: step.stepId,
      condition: { type: "dependency_satisfied" },
      dependencyType: "hard",
    })),
  );
  const dependedOn = new Set(edges.map((edge) => edge.fromNodeId));
  const entryNodeIds = steps.filter((step) => (step.dependsOnStepIds ?? []).length === 0).map((step) => step.stepId);
  const terminalNodeIds = steps.filter((step) => !dependedOn.has(step.stepId)).map((step) => step.stepId);
  return {
    planGraphBundleId: `pgb:${workflow.workflowId}:${harnessRunId}`,
    harnessRunId,
    graphVersion: 1,
    graph: {
      graphId: `graph:${workflow.workflowId}`,
      nodes,
      edges,
      entryNodeIds,
      terminalNodeIds: terminalNodeIds.length > 0 ? terminalNodeIds : entryNodeIds,
      joinStrategy: "all",
      graphHash: `hash:${workflow.workflowId}:${nodes.length}:${edges.length}`,
    },
    schedulerPolicy: {
      policyId: "scheduler:oapeflir.default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: `budget:${workflow.workflowId}`,
    riskProfile: { riskClass: "medium", reasons: ["minimal_workflow"] },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: nowIso(),
  };
}

function inferNodeType(stepId: string, roleId: string | undefined): PlanNode["nodeType"] {
  const seed = `${roleId ?? ""}:${stepId}`.toLowerCase();
  if (seed.includes("evaluator")) {
    return "evaluator";
  }
  if (seed.includes("planner") || seed.includes("llm")) {
    return "llm";
  }
  return "tool";
}

export class RuntimeExecuteBridge implements ExecuteBridge {
  public constructor(
    private readonly dbPath: string,
    private readonly defaultModelId = "MiniMax-M2.7",
    private readonly executor?: (plan: Plan, context: ExecutionContext) => Promise<{ snapshot?: unknown }>,
  ) {}

  public async executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult> {
    const result = await this.executePlan({
      planId: `plan:${step.stepId}`,
      taskId: context.taskId,
      version: 1,
      assessmentRef: `assessment:${context.taskId}`,
      strategy: "linear",
      steps: [step],
      createdAt: Date.now(),
    } as Plan, context);
    return result.results[0] ?? {
      stepId: step.stepId,
      status: "failed",
      durationMs: 0,
      tokenCost: 0,
      summary: `Step ${step.stepId} produced no results`,
      outputs: {},
      artifacts: [],
      modelId: this.defaultModelId,
      retryCount: 0,
      validationPassed: false,
    };
  }

  public async executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    const normalizedPlan = normalizeExecutablePlan(plan, context);
    if (this.executor != null) {
      const executed = await this.executor({
        ...normalizedPlan,
        dbPath: this.dbPath,
        contextBudgetTokens: context.tokenBudget,
        parentContext: (context as { parentContext?: unknown }).parentContext,
      } as Plan, context);
      const records = extractStepOutputRecords(executed);
      const results = records.map(mapStepOutputRecord);
      return buildExecutionResult(normalizedPlan.planId, results);
    }
    const results = normalizedPlan.steps.map((step, index) => ({
      stepId: step.stepId,
      status: "succeeded" as const,
      durationMs: 100 + index * 50,
      tokenCost: 200 + index * 75,
      summary: `Completed ${step.action} for ${step.stepId}`,
      outputs: {},
      artifacts: (step.outputs ?? []).map((output) => `artifact:${output}`),
      modelId: this.defaultModelId,
      retryCount: 0,
      validationPassed: true,
    }));
    return buildExecutionResult(normalizedPlan.planId, results);
  }

  public toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
    return result.results.map((item) => ({
      stepId: item.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: item.summary,
        artifacts: item.artifacts.map((artifact) => artifact.startsWith("artifact:") ? artifact : `artifact:${artifact}`),
      },
      systemTelemetry: {
        durationMs: item.durationMs,
        tokensUsed: item.tokenCost,
        modelId: item.modelId,
        retryCount: item.retryCount,
        validationPassed: item.validationPassed,
      },
    }));
  }

  public async executeSubgraph(subgraph: PlanStep[], context: ExecutionContext): Promise<ExecutionResult> {
    return this.executePlan({
      planId: "subgraph",
      taskId: context.taskId,
      version: 1,
      assessmentRef: `assessment:${context.taskId}`,
      strategy: "linear",
      steps: subgraph,
      createdAt: Date.now(),
    } as Plan, context);
  }

  public async executeChildRun(plan: Plan, context: ExecutionContext, _parentRunId: string): Promise<ExecutionResult> {
    return this.executePlan(plan, context);
  }
}

export class MockExecuteBridge extends RuntimeExecuteBridge {
  public constructor() {
    super("mock://runtime", "local-simulated");
  }
}

export function runtimeExecuteBridge(dbPath: string, defaultModelId?: string): RuntimeExecuteBridge {
  return new RuntimeExecuteBridge(dbPath, defaultModelId);
}

function buildExecutionResult(planId: string, results: StepResult[]): ExecutionResult {
  return {
    planId,
    results,
    totalDurationMs: results.reduce((sum, item) => sum + item.durationMs, 0),
    totalTokenCost: results.reduce((sum, item) => sum + item.tokenCost, 0),
    allSucceeded: results.every((item) => item.status === "succeeded" || item.status === "skipped"),
    skippedStepIds: results.filter((item) => item.status === "skipped").map((item) => item.stepId),
    failedStepIds: results.filter((item) => item.status === "failed").map((item) => item.stepId),
  };
}

function isStepOutputRecord(value: unknown): value is StepOutputRecord {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<StepOutputRecord>;
  return typeof (record.stepId ?? record.nodeRunId) === "string"
    && typeof record.status === "string"
    && typeof record.dataJson === "string"
    && typeof record.durationMs === "number"
    && typeof record.tokenCost === "number";
}

function normalizeExecutablePlan(plan: Plan | PlanGraphBundle, context: ExecutionContext): Plan {
  if (isPlanGraphBundle(plan)) {
    return {
      planId: plan.planGraphBundleId,
      taskId: context.taskId,
      version: plan.graphVersion,
      assessmentRef: plan.validationReport.valid ? `assessment:${plan.planGraphBundleId}` : `assessment:invalid:${plan.planGraphBundleId}`,
      strategy: "linear",
      steps: plan.graph.nodes.map(planNodeToPlanStep),
      createdAt: Date.parse(plan.createdAt) || Date.now(),
    };
  }
  return plan;
}

function isPlanGraphBundle(plan: Plan | PlanGraphBundle): plan is PlanGraphBundle {
  return "planGraphBundleId" in plan && "graph" in plan && Array.isArray((plan as PlanGraphBundle).graph.nodes);
}

function planNodeToPlanStep(node: PlanNode): PlanStep {
  return {
    stepId: node.nodeId,
    action: node.nodeType,
    inputs: {},
    outputs: [node.outputSchemaRef],
    dependencies: [...node.inputRefs],
    status: "pending",
    timeout: node.timeoutMs,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
}
