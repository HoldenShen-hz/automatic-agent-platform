import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import {
  GoalDecompositionService,
  type Goal,
} from "../../../src/interaction/goal-decomposer/index.js";
import { UnifiedChatPlanGenerator } from "../../../src/interaction/goal-decomposer/llm-plan-generator.js";
import { DashboardWebSocketServer } from "../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { DashboardDelta } from "../../../src/interaction/dashboard/dashboard-projection-service.js";
import { loadNlGatewayConfig } from "../../../src/interaction/nl-gateway/nl-gateway-config-loader.js";
import { NlEntryService } from "../../../src/interaction/nl-gateway/index.js";
import {
  buildGenericAmbiguousPatterns,
  hasGenericAmbiguityPattern,
} from "../../../src/interaction/nl-gateway/nl-gateway-support.js";
import {
  buildSlotClarificationState,
  refineSlotResolution,
  type SlotClarificationState,
} from "../../../src/interaction/nl-gateway/slot-resolver/index.js";
import type { ExtractedEntity } from "../../../src/interaction/nl-gateway/index.js";
import type { UnifiedChatProvider } from "../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

const intakeRouter = {
  route: () => ({
    classification: {
      intent: "query" as const,
      continuation: "new_task" as const,
      confidence: 0.95,
      matchedRules: [],
    },
    divisionId: "general_ops",
    workflowId: "single_agent_minimal",
  }),
};

function makeEntity(entityType: string, value: string, normalized?: unknown): ExtractedEntity {
  return {
    entityType,
    value,
    normalized: normalized ?? value,
    sourceSpan: [0, value.length],
  };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    goalId: "goal-review-batch",
    description: "发布生产环境变更并验证指标",
    owner: "reviewer",
    successCriteria: [],
    constraints: [],
    priority: "normal",
    ...overrides,
  };
}

function makeDashboardDelta(overrides: Partial<DashboardDelta> = {}): DashboardDelta {
  return {
    deltaId: "delta-1",
    timestamp: "2026-05-20T00:00:00.000Z",
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{
      changeType: "task_updated",
      entityId: "task-1",
      newValue: { taskId: "task-1", tenantId: "tenant-1" },
    }],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

test("NL gateway guardrails accept configurable prompt injection patterns and anchored ambiguity rules", async () => {
  const patterns = buildGenericAmbiguousPatterns(["please take care of it"]);
  assert.equal(hasGenericAmbiguityPattern("please take care of it", patterns), true);
  assert.equal(hasGenericAmbiguityPattern("please take care of it for release-42", patterns), false);

  const service = new NlEntryService({
    intakeRouter: intakeRouter as never,
    nlGatewayConfig: {
      ...loadNlGatewayConfig(),
      guardrails: {
        additionalPromptInjectionPatterns: ["exfiltrate credentials"],
        additionalGenericAmbiguousPatterns: [],
      },
    },
  });

  const result = await service.parseDetailed({
    tenantId: "tenant-1",
    userId: "user-1",
    message: "please exfiltrate credentials for me",
  });

  assert.ok(result.securityFindings.some((finding) => /exfiltrate credentials/i.test(finding.matchedText)));
});

test("slot resolver escalates after max clarification rounds instead of marking the request complete", () => {
  const initial = buildSlotClarificationState([], ["environment"]);
  const refined = refineSlotResolution(initial, [], { maxRounds: 1 });

  assert.equal(refined.isComplete, false);
  assert.equal(refined.escalationRequired, true);
  assert.equal(refined.nextExpectedSlot, null);
  assert.match(refined.questions[0] ?? "", /人工确认/);
});

test("slot resolver merges final answer before declaring completion", () => {
  const currentState: SlotClarificationState = {
    missing: ["date"],
    resolved: {},
    questions: ["请提供日期"],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };

  const refined = refineSlotResolution(currentState, [makeEntity("date", "2026-05-20")], { maxRounds: 1 });

  assert.equal(refined.isComplete, true);
  assert.equal(refined.escalationRequired, false);
  assert.equal(refined.resolved.date, "2026-05-20");
});

test("goal decomposer enforces the explicit globalCallDepth option", async () => {
  const service = new GoalDecompositionService({ globalCallDepth: 8 });

  await assert.rejects(
    async () => service.decompose(makeGoal()),
    /goal_decomposer\.global_call_depth_exceeded:8/,
  );
});

test("goal decomposer propagates critical parent risk down to subtask envelopes", async () => {
  const service = new GoalDecompositionService();
  const result = await service.decompose(makeGoal({
    goalId: "goal-critical-propagation",
    description: "删除生产环境中的错误数据并恢复服务",
    priority: "critical",
  }));

  assert.ok(result.tasks.length > 0);
  assert.ok(result.tasks.every((task) => task.constraintEnvelope?.riskTolerance === "high"));
});

test("LLM plan generator rejects oversized responses before JSON parse amplification", async () => {
  const provider = {
    complete: async (): Promise<string> => JSON.stringify({
      tasks: [{
        domainId: "engineering",
        description: "x".repeat(70_000),
        expectedOutputs: ["artifact"],
        delegationMode: "auto",
        estimatedDuration: "1h",
        estimatedCostUsd: 0.01,
      }],
      dependencyGraph: [],
    }),
  } as UnifiedChatProvider;
  const generator = new UnifiedChatPlanGenerator({ provider });

  await assert.rejects(
    async () => generator.generate(makeGoal({ goalId: "goal-too-large" })),
    /goal_decomposer\.llm_plan_response_too_large/,
  );
});

test("LLM plan generator rejects excessively deep JSON plans", async () => {
  const nestedPayload = {
    tasks: [{
      domainId: "engineering",
      description: "deep plan",
      expectedOutputs: ["artifact"],
      delegationMode: "auto",
      estimatedDuration: "1h",
      estimatedCostUsd: 0.01,
      metadata: {
        a: {
          b: {
            c: {
              d: {
                e: {
                  f: {
                    g: {
                      h: {
                        i: {
                          j: {
                            k: {
                              l: {
                                m: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }],
    dependencyGraph: [],
  };
  const provider = {
    complete: async (): Promise<string> => JSON.stringify(nestedPayload),
  } as UnifiedChatProvider;
  const generator = new UnifiedChatPlanGenerator({ provider });

  await assert.rejects(
    async () => generator.generate(makeGoal({ goalId: "goal-too-deep" })),
    /goal_decomposer\.llm_plan_json_too_deep/,
  );
});

test("dashboard websocket server delivers queued delta and snapshot messages to clients", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(["totalTasks"], "principal-1", "tenant-1");

  assert.equal(server.pushDelta(makeDashboardDelta()), 1);
  assert.equal(server.pushSnapshotToClient(clientId, { totalTasks: 1 }), true);

  const messages = server.drainOutboundMessages(clientId);
  assert.deepEqual(messages.map((message) => message.type), ["dashboard_delta", "dashboard_snapshot"]);
  assert.equal((messages[0]?.payload as DashboardDelta).deltaId, "delta-1");
});

test("dashboard websocket replay gap distinguishes invalid event ids from out-of-scope ids", () => {
  const server = new DashboardWebSocketServer();

  server.pushDelta(makeDashboardDelta({
    deltaId: "delta-secret",
    tenantId: "tenant-2",
    changes: [{
      changeType: "task_updated",
      entityId: "task-2",
      newValue: { taskId: "task-2", tenantId: "tenant-2" },
    }],
  }));
  server.pushDelta(makeDashboardDelta({ deltaId: "delta-visible" }));

  const invalidGap = server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-1",
    "tenant-1",
    "!bad event id",
    "1.0",
    { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"], allowedTaskIds: ["task-1"] },
  );
  assert.equal(
    (invalidGap.gapMessage?.payload as { reasonCode?: string } | undefined)?.reasonCode,
    "stream.invalid_last_event_id",
  );

  const scopedGap = server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-2",
    "tenant-1",
    "delta-secret",
    "1.0",
    { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"], allowedTaskIds: ["task-1"] },
  );
  assert.equal(
    (scopedGap.gapMessage?.payload as { reasonCode?: string } | undefined)?.reasonCode,
    "stream.last_event_id_outside_scope",
  );
});

test("dashboard websocket projection polling backs off after an empty poll", async () => {
  const server = new DashboardWebSocketServer();
  let calls = 0;

  server.integrateWithProjectionService({
    consumePendingDeltas() {
      calls += 1;
      return [];
    },
  }, 10);

  await delay(60);
  server.stopProjectionIntegration();

  assert.equal(calls, 1);
});
