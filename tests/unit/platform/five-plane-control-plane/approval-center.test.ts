/**
 * Approval Center Unit Tests
 *
 * Tests approval center functionality including:
 * - Approval decision validation
 * - Decision type specific validation rules
 * - Terminal decision validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateApprovalDecision,
  type ApprovalDecision,
} from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createDecision(overrides: Partial<ApprovalDecision> = {}): ApprovalDecision {
  return {
    approvalId: "approval-123",
    decisionType: "confirmed",
    respondedBy: "user-456",
    respondedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: validateApprovalDecision - Option Selected
// ---------------------------------------------------------------------------

test("validateApprovalDecision passes for valid option_selected decision", () => {
  const decision = createDecision({
    decisionType: "option_selected",
    selectedOptionId: "option-1",
  });

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for option_selected without selectedOptionId [five-plane-control-plane]", () => {
  const decision = createDecision({
    decisionType: "option_selected",
    selectedOptionId: "",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_option_selected",
  );
});

test("validateApprovalDecision throws for option_selected with confirmed flag", () => {
  const decision = createDecision({
    decisionType: "option_selected",
    selectedOptionId: "option-1",
    confirmed: true,
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_option_selected",
  );
});

test("validateApprovalDecision throws for option_selected with inputText", () => {
  const decision = createDecision({
    decisionType: "option_selected",
    selectedOptionId: "option-1",
    inputText: "some text",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_option_selected",
  );
});

test("validateApprovalDecision throws for option_selected with both confirmed and inputText", () => {
  const decision = createDecision({
    decisionType: "option_selected",
    selectedOptionId: "option-1",
    confirmed: true,
    inputText: "some text",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_option_selected",
  );
});

// ---------------------------------------------------------------------------
// Tests: validateApprovalDecision - Confirmed
// ---------------------------------------------------------------------------

test("validateApprovalDecision passes for valid confirmed decision", () => {
  const decision = createDecision({
    decisionType: "confirmed",
    confirmed: true,
  });

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for confirmed without confirmed flag", () => {
  // Create a decision without the confirmed property
  const decision: ApprovalDecision = {
    approvalId: "approval-123",
    decisionType: "confirmed",
    respondedBy: "user-456",
    respondedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_confirmed",
  );
});

test("validateApprovalDecision throws for confirmed with selectedOptionId", () => {
  const decision = createDecision({
    decisionType: "confirmed",
    confirmed: true,
    selectedOptionId: "option-1",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_confirmed",
  );
});

test("validateApprovalDecision throws for confirmed with inputText", () => {
  const decision = createDecision({
    decisionType: "confirmed",
    confirmed: true,
    inputText: "some text",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_confirmed",
  );
});

test("validateApprovalDecision throws for confirmed with selectedOptionId and inputText", () => {
  const decision = createDecision({
    decisionType: "confirmed",
    confirmed: true,
    selectedOptionId: "option-1",
    inputText: "some text",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_confirmed",
  );
});

// ---------------------------------------------------------------------------
// Tests: validateApprovalDecision - Text Input
// ---------------------------------------------------------------------------

test("validateApprovalDecision passes for valid text_input decision", () => {
  const decision = createDecision({
    decisionType: "text_input",
    inputText: "This is my response",
  });

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for text_input without inputText", () => {
  const decision = createDecision({
    decisionType: "text_input",
    inputText: "",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_text_input",
  );
});

test("validateApprovalDecision throws for text_input with selectedOptionId", () => {
  const decision = createDecision({
    decisionType: "text_input",
    inputText: "My response",
    selectedOptionId: "option-1",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_text_input",
  );
});

test("validateApprovalDecision throws for text_input with confirmed", () => {
  const decision = createDecision({
    decisionType: "text_input",
    inputText: "My response",
    confirmed: true,
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_text_input",
  );
});

test("validateApprovalDecision throws for text_input with selectedOptionId and confirmed", () => {
  const decision = createDecision({
    decisionType: "text_input",
    inputText: "My response",
    selectedOptionId: "option-1",
    confirmed: true,
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_text_input",
  );
});

// ---------------------------------------------------------------------------
// Tests: validateApprovalDecision - Rejected
// ---------------------------------------------------------------------------

test("validateApprovalDecision passes for valid rejected decision", () => {
  const decision = createDecision({
    decisionType: "rejected",
  });

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for rejected with selectedOptionId", () => {
  const decision = createDecision({
    decisionType: "rejected",
    selectedOptionId: "option-1",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

test("validateApprovalDecision throws for rejected with confirmed", () => {
  const decision = createDecision({
    decisionType: "rejected",
    confirmed: true,
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

test("validateApprovalDecision throws for rejected with inputText", () => {
  const decision = createDecision({
    decisionType: "rejected",
    inputText: "reason for rejection",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

test("validateApprovalDecision throws for rejected with all extra fields", () => {
  const decision = createDecision({
    decisionType: "rejected",
    selectedOptionId: "option-1",
    confirmed: true,
    inputText: "reason",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

// ---------------------------------------------------------------------------
// Tests: validateApprovalDecision - Expired
// ---------------------------------------------------------------------------

test("validateApprovalDecision passes for valid expired decision", () => {
  const decision = createDecision({
    decisionType: "expired",
  });

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for expired with selectedOptionId", () => {
  const decision = createDecision({
    decisionType: "expired",
    selectedOptionId: "option-1",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

test("validateApprovalDecision throws for expired with confirmed", () => {
  const decision = createDecision({
    decisionType: "expired",
    confirmed: true,
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

test("validateApprovalDecision throws for expired with inputText", () => {
  const decision = createDecision({
    decisionType: "expired",
    inputText: "timeout reason",
  });

  assert.throws(
    () => validateApprovalDecision(decision),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "approval.invalid_terminal_payload",
  );
});

// ---------------------------------------------------------------------------
// Tests: ValidationError Details
// ---------------------------------------------------------------------------

test("ValidationError for invalid option_selected contains decision details", () => {
  const decision = createDecision({
    decisionType: "option_selected",
    selectedOptionId: "",
  });

  try {
    validateApprovalDecision(decision);
    assert.fail("Expected ValidationError to be thrown");
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, "approval.invalid_option_selected");
    assert.ok(err.details);
    assert.equal(err.details.decisionType, "option_selected");
  }
});

test("ValidationError for invalid confirmed contains decision details", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval-123",
    decisionType: "confirmed",
    respondedBy: "user-456",
    respondedAt: "2024-01-01T00:00:00.000Z",
  };

  try {
    validateApprovalDecision(decision);
    assert.fail("Expected ValidationError to be thrown");
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, "approval.invalid_confirmed");
    assert.ok(err.details);
    assert.equal(err.details.decisionType, "confirmed");
  }
});

test("ValidationError for invalid text_input contains decision details", () => {
  const decision = createDecision({
    decisionType: "text_input",
    inputText: "",
  });

  try {
    validateApprovalDecision(decision);
    assert.fail("Expected ValidationError to be thrown");
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, "approval.invalid_text_input");
    assert.ok(err.details);
    assert.equal(err.details.decisionType, "text_input");
  }
});

test("ValidationError for invalid terminal decision contains decision details", () => {
  const decision = createDecision({
    decisionType: "rejected",
    selectedOptionId: "option-1",
  });

  try {
    validateApprovalDecision(decision);
    assert.fail("Expected ValidationError to be thrown");
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, "approval.invalid_terminal_payload");
    assert.ok(err.details);
    assert.equal(err.details.decisionType, "rejected");
  }
});

// ---------------------------------------------------------------------------
// Tests: ApprovalDecision Structure
// ---------------------------------------------------------------------------

test("ApprovalDecision base fields are present", () => {
  const decision = createDecision();

  assert.equal(decision.approvalId, "approval-123");
  assert.equal(decision.respondedBy, "user-456");
  assert.equal(decision.respondedAt, "2024-01-01T00:00:00.000Z");
});

test("ApprovalDecision can have nullish optional fields", () => {
  // Omit optional fields entirely to test they work when not provided
  const decision: ApprovalDecision = {
    approvalId: "approval-123",
    decisionType: "rejected",
    respondedBy: "user-456",
    respondedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("ApprovalDecision with all optional fields explicitly undefined is valid for terminal types", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval-123",
    decisionType: "rejected",
    respondedBy: "system",
    respondedAt: "2024-01-01T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});
