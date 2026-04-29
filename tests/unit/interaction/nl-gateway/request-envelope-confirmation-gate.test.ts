import assert from "node:assert/strict";
import test from "node:test";

import { NlEntryService } from "../../../../src/interaction/nl-gateway/index.js";

test("NlEntryService.buildTask keeps requestEnvelope null while user confirmation is pending", async () => {
  const criticalRouter = {
    route: () => ({
      classification: {
        intent: "modify" as const,
        continuation: "new_task" as const,
        confidence: 0.98,
        matchedRules: ["delete", "production"],
      },
      divisionId: "platform_engineering",
      workflowId: "change_managed_release",
    }),
  };
  const service = new NlEntryService({ intakeRouter: criticalRouter as never });

  const task = await service.buildTask({
    tenantId: "tenant-confirmation-gate",
    userId: "user-confirmation-gate",
    message: "delete production database",
  });

  assert.equal(task.confirmationRequired, true);
  assert.equal(task.requestEnvelope, null);
  assert.equal(task.confirmationReceipt.state, "pending_user_confirmation");
  assert.equal(task.confirmationReceipt.scope, "platform_engineering/production");
  assert.equal(task.confirmationReceipt.actor, "user-confirmation-gate");
  assert.match(task.confirmationReceipt.riskPreviewVersion ?? "", /^risk-preview-v1:/);
  assert.ok(task.confirmationReceipt.timestamp != null);
  assert.equal(task.clarificationState.rounds, 0);
});

test("NlEntryService.buildTask emits requestEnvelope only when confirmation is not required", async () => {
  const lowRiskRouter = {
    route: () => ({
      classification: {
        intent: "query" as const,
        continuation: "new_task" as const,
        confidence: 0.98,
        matchedRules: ["list"],
      },
      divisionId: "platform_engineering",
      workflowId: "read_only_inquiry",
    }),
  };
  const service = new NlEntryService({ intakeRouter: lowRiskRouter as never });

  const task = await service.buildTask({
    tenantId: "tenant-confirmation-gate",
    userId: "user-confirmation-gate",
    message: "list platform engineering incidents for staging",
  });

  assert.equal(task.confirmationRequired, false);
  assert.ok(task.requestEnvelope != null);
  assert.equal(task.confirmationReceipt.state, "not_required");
  assert.ok(task.confirmedTaskSpec != null);
  assert.ok(task.canonicalRequestEnvelope != null);
  assert.equal(task.canonicalRequestEnvelope?.confirmedTaskSpecId, task.confirmedTaskSpec?.confirmedTaskSpecId);
  assert.equal(task.clarificationState.rounds, 0);
});

test("NlEntryService.buildTask tracks clarification rounds across repeated blocked requests", async () => {
  const ambiguousRouter = {
    route: () => ({
      classification: {
        intent: "modify" as const,
        continuation: "follow_up" as const,
        confidence: 0.6,
        matchedRules: ["ambiguous"],
      },
      divisionId: "platform_engineering",
      workflowId: "change_managed_release",
    }),
  };
  const service = new NlEntryService({ intakeRouter: ambiguousRouter as never });
  const request = {
    tenantId: "tenant-clarification-rounds",
    userId: "user-clarification-rounds",
    message: "帮我改一下",
  };

  const first = await service.buildTask(request);
  const second = await service.buildTask(request);
  const third = await service.buildTask(request);

  assert.equal(first.clarificationState.rounds, 1);
  assert.equal(second.clarificationState.rounds, 2);
  assert.equal(third.clarificationState.rounds, 3);
  assert.equal(third.clarificationState.state, "blocked");
  assert.ok(third.clarificationState.reasonCodes.includes("nl_gateway.max_clarification_rounds_exceeded"));
});

test("NlEntryService.buildTask materializes canonical intake artifacts before admission", async () => {
  const lowRiskRouter = {
    route: () => ({
      classification: {
        intent: "query" as const,
        continuation: "new_task" as const,
        confidence: 0.98,
        matchedRules: ["list"],
      },
      divisionId: "platform_engineering",
      workflowId: "read_only_inquiry",
    }),
  };
  const service = new NlEntryService({ intakeRouter: lowRiskRouter as never });

  const task = await service.buildTask({
    tenantId: "tenant-canonical-intake",
    userId: "user-canonical-intake",
    message: "list platform engineering incidents for staging",
  });

  assert.equal(task.canonicalTaskDraft.tenantId, "tenant-canonical-intake");
  assert.equal(task.canonicalTaskDraft.source, "nl");
  assert.equal(task.canonicalTaskDraft.normalizedIntent["workflowId"], "read_only_inquiry");
  assert.ok(task.confirmedTaskSpec != null);
  assert.equal(task.confirmedTaskSpec?.taskDraftId, task.canonicalTaskDraft.taskDraftId);
  assert.ok(task.canonicalRequestEnvelope != null);
  assert.equal(task.canonicalRequestEnvelope?.confirmedTaskSpecId, task.confirmedTaskSpec?.confirmedTaskSpecId);
});
