import assert from "node:assert/strict";
import test from "node:test";

import { validateApprovalDecision as validateDecision } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

/**
 * TEST-N01: These tests must exercise the real `validateApprovalDecision`
 * from approval-service.ts. The previous version kept a local copy of the
 * validator and stray `assert.ok(true)` calls, so the suite was green even
 * when the production validator was broken.
 */

test("validateDecision passes for valid option_selected decision", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "option_selected" as const,
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  // Should not throw
  assert.doesNotThrow(() => validateDecision(decision));
});

test("validateDecision passes for valid confirmed decision", () => {
  const decision: {
    approvalId: string;
    decisionType: "confirmed";
    confirmed: true;
    respondedBy: string;
    respondedAt: string;
  } = {
    approvalId: "approval_123",
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateDecision(decision));
});

test("validateDecision passes for valid text_input decision", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "text_input" as const,
    inputText: "User typed this response",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateDecision(decision));
});

test("validateDecision passes for valid rejected decision", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "rejected" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateDecision(decision));
});

test("validateDecision passes for valid expired decision", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "expired" as const,
    respondedBy: "system",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateDecision(decision));
});

test("validateDecision throws for option_selected without selectedOptionId", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "option_selected" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_option_selected"
  );
});

test("validateDecision throws for option_selected with extra fields", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "option_selected" as const,
    selectedOptionId: "option_1",
    confirmed: true,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_option_selected"
  );
});

test("validateDecision throws for confirmed without confirmed=true", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "confirmed" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_confirmed"
  );
});

test("validateDecision throws for confirmed with extra fields", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "confirmed" as const,
    confirmed: true,
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_confirmed"
  );
});

test("validateDecision throws for text_input without inputText", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "text_input" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_text_input"
  );
});

test("validateDecision throws for terminal decision with extra fields", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "rejected" as const,
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_terminal_payload"
  );
});

test("validateDecision throws for expired with extra fields", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "expired" as const,
    inputText: "some text",
    respondedBy: "system",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateDecision(decision as any),
    (err: any) => err.code === "approval.invalid_terminal_payload"
  );
});

