import assert from "node:assert/strict";
import test from "node:test";

import { NlEntryService } from "../../../src/interaction/nl-gateway/index.js";

function createService(intentType: "cancel_task" | "create_goal" | "decompress_goal") {
  return new NlEntryService({
    intakeRouter: {
      route: () => ({
        divisionId: "platform_engineering",
        workflowId: "workflow_goal",
        classification: {
          intent: "query",
          confidence: 0.2,
          continuation: "new_task",
        },
      }),
    } as any,
    intentParser: {
      parseWithLlm: async () => ({
        intentType,
        confidence: 0.99,
      }),
    },
  });
}

test("NlEntryService maps ADR create_goal into canonical task_create intent", async () => {
  const service = createService("create_goal");
  const result = await service.parseDetailed({
    tenantId: "tenant_001",
    userId: "user_001",
    message: "Create a quarterly OKR goal for reliability",
  });

  assert.equal(result.detectedIntents[0]?.intentType, "task_create");
});

test("NlEntryService maps ADR decompress_goal into canonical task_query intent", async () => {
  const service = createService("decompress_goal");
  const result = await service.parseDetailed({
    tenantId: "tenant_001",
    userId: "user_001",
    message: "Break this goal into weekly milestones",
  });

  assert.equal(result.detectedIntents[0]?.intentType, "task_query");
});

test("NlEntryService maps cancel_task into canonical task_modify with medium mutation risk", async () => {
  const service = createService("cancel_task");
  const result = await service.buildTask({
    tenantId: "tenant_001",
    userId: "user_001",
    message: "Cancel task 123 on 2026-05-12",
  });

  assert.equal(result.taskDraft.intent.intentType, "task_modify");
  assert.equal(result.riskPreview.overallRisk, "medium");
  assert.equal(result.riskPreview.approvalNeeded, false);
});
