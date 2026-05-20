import { z } from "zod";
import type { EventReplayMetadata } from "./event-registry.js";

const optionalStringSchema = z.string().optional();
const optionalNullableStringSchema = z.string().nullable().optional();
const traceContextSchema = z.object({
  traceId: z.string(),
  spanId: z.string().nullable(),
  parentSpanId: z.string().nullable(),
  correlationId: z.string().nullable(),
}).passthrough();

const taskStatusChangedPayloadSchema = z.object({
  fromStatus: optionalNullableStringSchema,
  toStatus: z.string(),
  reasonCode: optionalStringSchema,
  occurredAt: optionalStringSchema,
  entityKind: optionalStringSchema,
  entityId: optionalStringSchema,
  reasonDetail: optionalNullableStringSchema,
  actorType: optionalStringSchema,
  actorId: optionalNullableStringSchema,
  idempotencyKey: optionalNullableStringSchema,
  metadataJson: optionalNullableStringSchema,
  manualOverride: z.boolean().optional(),
  traceContext: traceContextSchema.optional(),
}).passthrough();

const workflowStepCompletedPayloadSchema = z.object({
  stepId: z.string(),
  roleId: optionalStringSchema,
  status: optionalStringSchema,
  outputKey: optionalNullableStringSchema,
  attempt: z.number().int().nonnegative().optional(),
  manualOverride: z.boolean().optional(),
  workflowId: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const decisionRequestedPayloadSchema = z.object({
  approvalId: z.string(),
  taskId: optionalStringSchema,
  executionId: optionalNullableStringSchema,
  sourceAgentId: optionalStringSchema,
  reason: optionalStringSchema,
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  options: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  timeoutPolicy: z.enum(["reject", "approve", "remain_pending"]).optional(),
  createdAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const decisionRespondedPayloadSchema = z.object({
  approvalId: z.string(),
  decisionType: z.enum(["option_selected", "confirmed", "text_input", "rejected", "expired"]).optional(),
  selectedOptionId: optionalStringSchema,
  confirmed: z.literal(true).optional(),
  inputText: optionalStringSchema,
  respondedBy: optionalStringSchema,
  respondedAt: optionalStringSchema,
  cascadeDeny: z.literal(true).optional(),
  cascadeSourceApprovalId: optionalStringSchema,
  cascadeSessionId: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const divisionOutcomePayloadSchema = z.object({
  divisionId: z.string(),
  workflowId: optionalNullableStringSchema,
  executionId: optionalNullableStringSchema,
  reasonCode: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const subtaskOutcomePayloadSchema = z.object({
  stepId: optionalStringSchema,
  subtaskId: optionalStringSchema,
  roleId: optionalStringSchema,
  status: optionalStringSchema,
  attempt: z.number().int().nonnegative().optional(),
  parentTaskId: optionalStringSchema,
  occurredAt: optionalStringSchema,
  reasonCode: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough().superRefine((value, ctx) => {
  if (value.stepId == null && value.subtaskId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stepId"],
      message: "Expected at least one of stepId or subtaskId.",
    });
  }
});

const costLimitReachedPayloadSchema = z.object({
  budgetId: z.string(),
  currentCostUsd: z.number(),
  limitUsd: z.number(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const domainLifecyclePayloadSchema = z.object({
  domainId: z.string(),
  status: z.string(),
  capabilityCount: z.number().int().nonnegative(),
  pluginCount: z.number().int().nonnegative(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const pluginLifecyclePayloadSchema = z.object({
  pluginId: z.string(),
  domainId: optionalNullableStringSchema,
  spiType: z.string(),
  lifecycleState: z.string(),
  bindingId: optionalNullableStringSchema,
  occurredAt: optionalStringSchema,
  reasonCode: optionalNullableStringSchema,
  errorMessage: optionalNullableStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const pluginInvocationPayloadSchema = z.object({
  pluginId: z.string(),
  domainId: optionalNullableStringSchema,
  spiType: z.string(),
  phase: z.string(),
  invocationId: z.string(),
  lifecycleState: z.string(),
  runtimeIsolation: z.string(),
  activeInvocationCount: z.number().int().nonnegative(),
  queuedInvocationCount: z.number().int().nonnegative(),
  bindingId: optionalNullableStringSchema,
  occurredAt: optionalStringSchema,
  durationMs: z.number().int().nonnegative().optional(),
  status: z.enum(["started", "completed", "failed"]).optional(),
  reasonCode: optionalNullableStringSchema,
  errorMessage: optionalNullableStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const knowledgeChunkIndexedPayloadSchema = z.object({
  namespace: z.string(),
  documentId: z.string(),
  chunkId: z.string(),
  trustLevel: z.string(),
  keywordCount: z.number().int().nonnegative(),
  relationCount: z.number().int().nonnegative(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const learningKnowledgePromotedPayloadSchema = z.object({
  learningObjectId: z.string(),
  learningType: z.string(),
  documentId: z.string(),
  namespace: z.string(),
  trustLevel: z.string(),
  promotedCount: z.number().int().nonnegative(),
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const recoveryPayloadSchema = z.object({
  taskId: optionalStringSchema,
  executionId: optionalStringSchema,
  traceId: optionalStringSchema,
  correlationId: optionalStringSchema,
  reasonCode: optionalStringSchema,
}).passthrough().superRefine((value, ctx) => {
  if (value.taskId == null && value.executionId == null && value.traceId == null && value.correlationId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correlationId"],
      message: "Expected at least one recovery correlation identifier.",
    });
  }
});

const harnessRunStatusChangedPayloadSchema = z.object({
  aggregateType: z.string(),
  fromStatus: optionalNullableStringSchema,
  toStatus: z.string(),
  reasonCode: optionalStringSchema,
  emittedBy: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const oapeflirRunLifecyclePayloadSchema = z.object({
  stage: z.string(),
  runId: z.string(),
  taskId: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

const oapeflirPhaseTransitionPayloadSchema = z.object({
  runId: z.string(),
  fromPhase: z.string(),
  toPhase: z.string(),
  taskId: optionalStringSchema,
  occurredAt: optionalStringSchema,
  traceContext: traceContextSchema.optional(),
}).passthrough();

export const genericEventPayloadSchema = z.record(z.unknown());

export const EVENT_PAYLOAD_VALIDATORS: Partial<Record<string, z.ZodType<Record<string, unknown>>>> = {
  "task:status_changed": taskStatusChangedPayloadSchema,
  "workflow:step_completed": workflowStepCompletedPayloadSchema,
  "decision:requested": decisionRequestedPayloadSchema,
  "decision:responded": decisionRespondedPayloadSchema,
  "division:completed": divisionOutcomePayloadSchema,
  "division:failed": divisionOutcomePayloadSchema,
  "subtask:completed": subtaskOutcomePayloadSchema,
  "subtask:failed": subtaskOutcomePayloadSchema,
  "cost:limit_reached": costLimitReachedPayloadSchema,
  "domain:registered": domainLifecyclePayloadSchema,
  "domain:activated": domainLifecyclePayloadSchema,
  "domain:canary": domainLifecyclePayloadSchema,
  "domain:updating": domainLifecyclePayloadSchema,
  "domain:updated": domainLifecyclePayloadSchema,
  "domain:deprecated": domainLifecyclePayloadSchema,
  "domain:archived": domainLifecyclePayloadSchema,
  "plugin:spi_registered": pluginLifecyclePayloadSchema,
  "plugin:activated": pluginLifecyclePayloadSchema,
  "plugin:error_isolated": pluginLifecyclePayloadSchema,
  "plugin:suspended": pluginLifecyclePayloadSchema,
  "plugin:invocation_started": pluginInvocationPayloadSchema,
  "plugin:invocation_completed": pluginInvocationPayloadSchema,
  "knowledge:chunk_indexed": knowledgeChunkIndexedPayloadSchema,
  "learning:knowledge_promoted": learningKnowledgePromotedPayloadSchema,
  "recovery:repair_applied": recoveryPayloadSchema,
  "recovery:decision_recorded": recoveryPayloadSchema,
  "recovery:dead_lettered": recoveryPayloadSchema,
  "recovery:cancelled": recoveryPayloadSchema,
  "platform.harness_run.created": genericEventPayloadSchema,
  "platform.harness_run.admitted": genericEventPayloadSchema,
  "platform.harness_run.planning": genericEventPayloadSchema,
  "platform.harness_run.ready": genericEventPayloadSchema,
  "platform.harness_run.pausing": genericEventPayloadSchema,
  "platform.harness_run.replanning": genericEventPayloadSchema,
  "platform.harness_run.compensating": genericEventPayloadSchema,
  "platform.harness_run.aborted": genericEventPayloadSchema,
  "platform.harness_run.completed": genericEventPayloadSchema,
  "platform.harness_run.failed": genericEventPayloadSchema,
  "platform.harness_run.status_changed": harnessRunStatusChangedPayloadSchema,
  "platform.node_run.status_changed": genericEventPayloadSchema,
  "platform.node_run.created": genericEventPayloadSchema,
  "platform.node_run.admitted": genericEventPayloadSchema,
  "platform.node_run.planning": genericEventPayloadSchema,
  "platform.node_run.ready": genericEventPayloadSchema,
  "platform.node_run.pausing": genericEventPayloadSchema,
  "platform.node_run.replanning": genericEventPayloadSchema,
  "platform.node_run.started": genericEventPayloadSchema,
  "platform.node_run.completed": genericEventPayloadSchema,
  "platform.node_run.failed": genericEventPayloadSchema,
  "platform.node_run.compensating": genericEventPayloadSchema,
  "platform.node_run.skipped": genericEventPayloadSchema,
  "platform.budget_ledger.status_changed": genericEventPayloadSchema,
  "platform.budget_reservation.status_changed": genericEventPayloadSchema,
  "platform.budget.status_changed": genericEventPayloadSchema,
  "platform.budget.reserved": genericEventPayloadSchema,
  "platform.budget.actualized": genericEventPayloadSchema,
  "platform.budget.exceeded": genericEventPayloadSchema,
  "platform.budget_reconciliation.status_changed": genericEventPayloadSchema,
  "platform.side_effect.status_changed": genericEventPayloadSchema,
  "platform.side_effect.triggered": genericEventPayloadSchema,
  "platform.side_effect.completed": genericEventPayloadSchema,
  "platform.side_effect.failed": genericEventPayloadSchema,
  "oapeflir.view.run_lifecycle": oapeflirRunLifecyclePayloadSchema,
  "oapeflir.phase.transition": oapeflirPhaseTransitionPayloadSchema,
};

export const RUNTIME_EVENT_REPLAY_METADATA: Record<string, EventReplayMetadata> = {
  "platform.request_envelope.admitted": {
    eventType: "platform.request_envelope.admitted",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "intake-admission-service",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["intake-admission-service.test.ts"],
  },
  "platform.harness_run.status_changed": {
    eventType: "platform.harness_run.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "runtime-state-machine",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["runtime-state-machine.test.ts", "runtime-truth-repository.test.ts"],
  },
  "platform.node_run.status_changed": {
    eventType: "platform.node_run.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "runtime-state-machine",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["runtime-state-machine.test.ts", "plan-graph-harness-runtime.test.ts"],
  },
  "platform.side_effect.status_changed": {
    eventType: "platform.side_effect.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: false,
    schemaOwner: "side-effect-manager",
    replayBehavior: "skip_side_effect",
    consumerContractTests: ["side-effect-manager.test.ts"],
  },
  "platform.budget_ledger.status_changed": {
    eventType: "platform.budget_ledger.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "budget-allocator",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["budget-allocator.test.ts", "runtime-state-machine.test.ts"],
  },
  "platform.budget_reservation.status_changed": {
    eventType: "platform.budget_reservation.status_changed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "budget-allocator",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["budget-allocator.test.ts", "runtime-state-machine.test.ts"],
  },
  "platform.graph_scheduler.decision_recorded": {
    eventType: "platform.graph_scheduler.decision_recorded",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "graph-scheduler",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
  },
  "oapeflir.view.run_lifecycle": {
    eventType: "oapeflir.view.run_lifecycle",
    sourceOfTruth: "projection",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "oapeflir-projection",
    replayBehavior: "simulate",
    consumerContractTests: ["layered-event-inbox.test.ts"],
  },
  "oapeflir.graph.scheduled": {
    eventType: "oapeflir.graph.scheduled",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "graph-scheduler",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
  },
  "oapeflir.node.executed": {
    eventType: "oapeflir.node.executed",
    sourceOfTruth: "platform",
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "harness-runtime",
    replayBehavior: "replay_as_fact",
    consumerContractTests: ["plan-graph-harness-runtime.test.ts"],
  },
};
