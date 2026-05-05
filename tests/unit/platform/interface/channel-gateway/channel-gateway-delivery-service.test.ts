import assert from "node:assert/strict";
import test from "node:test";

import {
  ChannelGatewayDeliveryService,
  CHANNEL_DELIVERY_DDL,
  type DeliveryGuaranteeConfig,
} from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { join } from "node:path";

function createService(config?: Partial<DeliveryGuaranteeConfig>) {
  const workspace = createTempWorkspace("aa-delivery-");
  const db = new SqliteDatabase(join(workspace, "delivery-test.db"));
  db.migrate();
  db.connection.exec(CHANNEL_DELIVERY_DDL);
  const store = new AuthoritativeTaskStore(db);
  const service = new ChannelGatewayDeliveryService(db, config);
  return { workspace, db, store, service };
}

test("verifySignature validates correct HMAC signature", () => {
  const h = createService();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const timestamp = String(Math.floor(Date.now() / 1000));

    const signature = h.service.generateSignature(payload, secret, timestamp);
    const result = h.service.verifySignature(payload, signature, timestamp, { secret });

    assert.equal(result.valid, true);
    assert.equal(result.error, null);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifySignature rejects invalid signature", () => {
  const h = createService();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const timestamp = String(Math.floor(Date.now() / 1000));

    const result = h.service.verifySignature(payload, "sha256=invalidsignature", timestamp, { secret });

    assert.equal(result.valid, false);
    assert.ok(result.error!.includes("signature_mismatch"));
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifySignature rejects missing signature", () => {
  const h = createService();
  try {
    const result = h.service.verifySignature("payload", null, null, { secret: "secret" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "missing_signature");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifySignature rejects expired timestamp", () => {
  const h = createService();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago

    const signature = h.service.generateSignature(payload, secret, oldTimestamp);
    const result = h.service.verifySignature(payload, signature, oldTimestamp, { secret, toleranceSeconds: 300 });

    assert.equal(result.valid, false);
    assert.equal(result.error, "timestamp_outside_tolerance");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("generateSignature produces sha256= prefix", () => {
  const h = createService();
  try {
    const signature = h.service.generateSignature("payload", "secret");
    assert.ok(signature.startsWith("sha256="));
    assert.equal(signature.length, 71); // sha256= (7) + 64 hex chars
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifyNonce rejects reused nonce", () => {
  const h = createService();
  try {
    const nonce = h.service.generateNonce();
    const first = h.service.verifyNonce(nonce);
    assert.equal(first.valid, true);

    const second = h.service.verifyNonce(nonce);
    assert.equal(second.valid, false);
    assert.equal(second.error, "nonce_already_used");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifyNonce accepts new nonce", () => {
  const h = createService();
  try {
    const nonce = h.service.generateNonce();
    const result = h.service.verifyNonce(nonce);
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
    assert.equal(result.nonce, nonce);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("generateNonce creates unique nonces", () => {
  const h = createService();
  try {
    const nonce1 = h.service.generateNonce();
    const nonce2 = h.service.generateNonce();
    assert.notEqual(nonce1, nonce2);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("generateNonce keeps full 256-bit entropy by default", () => {
  const h = createService();
  try {
    const nonce = h.service.generateNonce();
    assert.equal(nonce.length, 64);
    assert.match(nonce, /^[0-9a-f]+$/);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("createDeliveryMessage creates message record", () => {
  const h = createService();
  try {
    const receipt = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });

    assert.equal(receipt.messageId.startsWith("dlvmsg_"), true);
    assert.equal(receipt.channel, "webhook");
    assert.equal(receipt.targetId, "target-1");
    assert.equal(receipt.status, "pending_retry");
    assert.equal(receipt.attempts, 0);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("recordAttempt tracks successful delivery", () => {
  const h = createService();
  try {
    const receipt = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });

    const attempt = h.service.recordAttempt(receipt.messageId, 1, "success", 200);

    assert.equal(attempt.attemptId.startsWith("dlvatt_"), true);
    assert.equal(attempt.status, "success");
    assert.equal(attempt.responseStatus, 200);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("recordAttempt tracks failed delivery", () => {
  const h = createService();
  try {
    const receipt = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });

    const attempt = h.service.recordAttempt(receipt.messageId, 1, "failed", 500, "Server error");

    assert.equal(attempt.status, "failed");
    assert.equal(attempt.errorMessage, "Server error");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("recordAttempt calculates retry backoff", () => {
  const h = createService();
  try {
    const receipt = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });

    const attempt = h.service.recordAttempt(receipt.messageId, 1, "retrying", 503);

    assert.equal(attempt.status, "retrying");
    assert.ok(attempt.nextRetryAt !== null);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("isRetryableStatus identifies retryable codes", () => {
  const h = createService();
  try {
    assert.equal(h.service.isRetryableStatus(500), true);
    assert.equal(h.service.isRetryableStatus(503), true);
    assert.equal(h.service.isRetryableStatus(429), true);
    assert.equal(h.service.isRetryableStatus(404), false);
    assert.equal(h.service.isRetryableStatus(200), false);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("getPendingDeliveries returns queued messages", () => {
  const h = createService();
  try {
    h.service.createDeliveryMessage("webhook", "target-1", { text: "hello1" });
    h.service.createDeliveryMessage("webhook", "target-2", { text: "hello2" });

    const pending = h.service.getPendingDeliveries();
    assert.equal(pending.length, 2);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("getDeliveryReceipt returns delivery status", () => {
  const h = createService();
  try {
    const created = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });
    h.service.recordAttempt(created.messageId, 1, "success", 200);

    const receipt = h.service.getDeliveryReceipt(created.messageId);
    assert.ok(receipt);
    assert.equal(receipt!.status, "delivered");
    assert.equal(receipt!.finalStatus, "success");
    assert.equal(receipt!.attempts, 1);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("markPermanentFailure updates message status", () => {
  const h = createService();
  try {
    const created = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" });
    h.service.markPermanentFailure(created.messageId, "Max retries exceeded");

    const receipt = h.service.getDeliveryReceipt(created.messageId);
    assert.equal(receipt!.status, "failed");
    assert.equal(receipt!.finalStatus, "permanent_failure");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("delivery receipt tracks multiple attempts", () => {
  const h = createService();
  try {
    const created = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" }, 3);

    h.service.recordAttempt(created.messageId, 1, "retrying", 503);
    h.service.recordAttempt(created.messageId, 2, "retrying", 503);
    h.service.recordAttempt(created.messageId, 3, "success", 200);

    const receipt = h.service.getDeliveryReceipt(created.messageId);
    assert.equal(receipt!.attempts, 3);
    assert.equal(receipt!.finalStatus, "success");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("recordDeliveryFailure schedules retries once per message and dead-letters when exhausted", () => {
  const h = createService({
    initialBackoffMs: 0,
    maxBackoffMs: 0,
  });
  try {
    const created = h.service.createDeliveryMessage("webhook", "target-1", { text: "hello" }, 2);

    const firstFailure = h.service.recordDeliveryFailure(created.messageId, {
      responseStatus: 503,
      errorMessage: "temporary outage",
      retryable: true,
    });
    const retryable = h.service.getRetryableMessages();
    const secondFailure = h.service.recordDeliveryFailure(created.messageId, {
      responseStatus: 503,
      errorMessage: "still failing",
      retryable: true,
    });

    assert.equal(firstFailure?.outcome, "retry_scheduled");
    assert.equal(retryable.length, 1);
    assert.equal(secondFailure?.outcome, "dead_lettered");
    assert.equal(h.service.getRetryableMessages().length, 0);
    assert.equal(h.service.getDeadLetters().length, 1);
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifySignature handles invalid hex in signature gracefully", () => {
  const h = createService();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const timestamp = String(Math.floor(Date.now() / 1000));

    // Signature with invalid hex characters (not valid hex) - Buffer.from throws
    const invalidHexSignature = "sha256=not_valid_hex_characterzzzz";
    const result = h.service.verifySignature(payload, invalidHexSignature, timestamp, { secret });

    // Should fail gracefully, not throw
    assert.equal(result.valid, false);
    assert.ok(result.error === "signature_mismatch" || result.error === "signature_verification_failed");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("verifySignature handles empty signature after sha256= prefix", () => {
  const h = createService();
  try {
    const payload = '{"text":"hello"}';
    const secret = "webhook-secret-123";
    const timestamp = String(Math.floor(Date.now() / 1000));

    // Empty signature after sha256= prefix
    const result = h.service.verifySignature(payload, "sha256=", timestamp, { secret });

    // Should fail gracefully - Buffer.from("") returns empty buffer which has different length
    assert.equal(result.valid, false);
  } finally {
    cleanupPath(h.workspace);
  }
});
