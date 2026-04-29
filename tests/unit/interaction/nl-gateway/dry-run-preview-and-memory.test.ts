import assert from "node:assert/strict";
import test from "node:test";

import { NlEntryService, type ConversationContext } from "../../../../src/interaction/nl-gateway/index.js";

test("NlEntryService.buildTask emits a structured dry-run preview for high-risk NL requests", async () => {
  const service = new NlEntryService({
    intakeRouter: {
      route: async () => ({
        classification: {
          intent: "modify",
          continuation: "new_task" as const,
          confidence: 0.93,
          matchedRules: ["deploy", "notify"],
        },
        divisionId: "platform_engineering",
        workflowId: "release_orchestration",
      }),
    } as any,
  });

  const result = await service.buildTask({
    tenantId: "tenant-dry-run",
    userId: "operator-a",
    message: "deploy to production and notify via slack",
  });

  assert.equal(result.requestEnvelope, null);
  assert.equal(result.confirmationRequired, true);
  assert.ok(result.dryRunPreview != null);
  assert.equal(result.dryRunPreview?.mode, "dry_run");
  assert.equal(result.dryRunPreview?.scope, "platform_engineering/production");
  assert.ok(result.dryRunPreview?.proposedOperations.some((item) => item.includes("目标环境 production")));
  assert.ok(result.dryRunPreview?.proposedOperations.some((item) => item.includes("结果通知渠道 slack")));
  assert.ok((result.dryRunPreview?.sideEffectPreview.length ?? 0) > 0);
  assert.ok(result.confirmationReceipt.reasonCodes.includes("nl_gateway.dry_run_preview_ready"));
  assert.match(result.humanSummary, /dry-run 预演/);
});

test("NlEntryService rehydrates prior conversation context from memory-backed storage", async () => {
  const storedMemories = new Map<string, { content: string }[]>();
  const memoryService = {
    remember(input: { scope: string; content: string; classification?: string }) {
      const current = storedMemories.get(input.scope) ?? [];
      current.push({ content: input.content });
      storedMemories.set(input.scope, current);
    },
    findMemories(query: { scope: string }) {
      return storedMemories.get(query.scope) ?? [];
    },
  };

  const seedService = new NlEntryService({
    memoryService,
    intakeRouter: {
      route: async () => ({
        classification: {
          intent: "query",
          continuation: "new_task" as const,
          confidence: 0.94,
          matchedRules: ["status"],
        },
        divisionId: "support_ops",
        workflowId: "status_lookup",
      }),
    } as any,
  });

  await seedService.buildTask({
    tenantId: "tenant-memory",
    userId: "user-memory",
    message: "show deployment status for staging",
  });

  let capturedPriorContext: ConversationContext | undefined;
  const resumedService = new NlEntryService({
    memoryService,
    intakeRouter: {
      route: async (input: { priorConversationContext?: ConversationContext }) => {
        capturedPriorContext = input.priorConversationContext;
        return {
          classification: {
            intent: "query",
            continuation: "follow_up" as const,
            confidence: 0.91,
            matchedRules: ["follow-up"],
          },
          divisionId: "support_ops",
          workflowId: "status_lookup",
        };
      },
    } as any,
  });

  const result = await resumedService.parseDetailed({
    tenantId: "tenant-memory",
    userId: "user-memory",
    message: "what changed since the last check",
  });

  assert.ok(capturedPriorContext != null);
  assert.equal(capturedPriorContext?.turns.length, 1);
  assert.equal(capturedPriorContext?.turns[0]?.message, "show deployment status for staging");
  assert.equal(result.priorConversationTurns.length, 1);
  assert.equal(result.priorConversationTurns[0]?.message, "show deployment status for staging");
});
