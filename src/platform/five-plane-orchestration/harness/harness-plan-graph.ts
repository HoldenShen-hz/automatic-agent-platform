import { MS_PER_HOUR } from "../../../platform/contracts/constants/time.js";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { PlanGraphBundle } from "../../../platform/contracts/executable-contracts/index.js";
import type { ConstraintPack } from "./constraint-pack.js";

export function createInitialPlanGraphBundle(input: {
  readonly runId: string;
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
}): PlanGraphBundle {
  const createdAt = nowIso();
  const plannerNodeId = newId("plan_node");
  const generatorNodeId = newId("plan_node");
  const evaluatorNodeId = newId("plan_node");
  const graphId = newId("graph");
  const graphHash = [
    input.taskId,
    input.domainId,
    plannerNodeId,
    generatorNodeId,
    evaluatorNodeId,
  ].join(":");
  const budgetEnvelope = input.constraintPack.budgetEnvelope ?? input.constraintPack.budget ?? {
    maxSteps: 100,
    maxCost: 100000,
    maxDurationMs: MS_PER_HOUR,
  };

  return {
    planGraphBundleId: newId("plan_graph_bundle"),
    harnessRunId: input.runId,
    graphVersion: 1,
    graph: {
      graphId,
      nodes: [
        {
          nodeId: plannerNodeId,
          nodeType: "llm",
          inputRefs: [`task:${input.taskId}`],
          outputSchemaRef: "schema:harness.plan",
          riskClass: "medium",
          budgetIntent: {
            amount: Math.max(1, budgetEnvelope.maxCost / 3),
            currency: "USD",
            resourceKinds: ["compute"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry:harness.default",
          timeoutMs: budgetEnvelope.maxDurationMs,
        },
        {
          nodeId: generatorNodeId,
          nodeType: "tool",
          inputRefs: [plannerNodeId],
          outputSchemaRef: "schema:harness.work_product",
          riskClass: "medium",
          budgetIntent: {
            amount: Math.max(1, budgetEnvelope.maxCost / 3),
            currency: "USD",
            resourceKinds: ["compute"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: input.constraintPack.tool_policy.allowedTools.length > 0,
            reversible: true,
          },
          retryPolicyRef: "retry:harness.default",
          timeoutMs: budgetEnvelope.maxDurationMs,
        },
        {
          nodeId: evaluatorNodeId,
          nodeType: "evaluator",
          inputRefs: [generatorNodeId],
          outputSchemaRef: "schema:harness.evaluation",
          riskClass: "medium",
          budgetIntent: {
            amount: Math.max(1, budgetEnvelope.maxCost / 3),
            currency: "USD",
            resourceKinds: ["compute"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry:harness.default",
          timeoutMs: budgetEnvelope.maxDurationMs,
        },
      ],
      edges: [
        {
          edgeId: newId("plan_edge"),
          fromNodeId: plannerNodeId,
          toNodeId: generatorNodeId,
          condition: { type: "always" },
          dependencyType: "hard",
        },
        {
          edgeId: newId("plan_edge"),
          fromNodeId: generatorNodeId,
          toNodeId: evaluatorNodeId,
          condition: { type: "always" },
          dependencyType: "hard",
        },
      ],
      entryNodeIds: [plannerNodeId],
      terminalNodeIds: [evaluatorNodeId],
      joinStrategy: "all",
      graphHash,
    },
    schedulerPolicy: {
      policyId: "scheduler:harness.deterministic_fifo",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:harness.initial",
    riskProfile: {
      riskClass: "medium",
      reasons: ["harness.initial_plan_graph_bundle"],
    },
    validationReport: {
      valid: true,
      findings: [],
      normalizedNodeIds: [plannerNodeId, generatorNodeId, evaluatorNodeId],
    },
    artifactRefs: [],
    createdAt,
  };
}
