import assert from "node:assert/strict";
import test from "node:test";

import type { UserConfirmationReceipt } from "../../../../src/interaction/nl-gateway/index.js";

test("UserConfirmationReceipt supports confirmed state with preview metadata", () => {
  const receipt: UserConfirmationReceipt = {
    confirmationId: "confirm-1",
    required: true,
    state: "confirmed",
    reasonCodes: ["nl_gateway.approval_required"],
    summary: "User confirmed the high-risk request.",
    scope: "production/database",
    timestamp: "2026-04-29T00:00:00.000Z",
    riskPreviewVersion: "risk-preview-v2",
    actor: "user-1",
  };

  assert.equal(receipt.state, "confirmed");
  assert.equal(receipt.scope, "production/database");
  assert.equal(receipt.riskPreviewVersion, "risk-preview-v2");
  assert.equal(receipt.actor, "user-1");
  assert.equal(receipt.timestamp, "2026-04-29T00:00:00.000Z");
});
