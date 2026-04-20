import assert from "node:assert/strict";
import test from "node:test";

import { FieldEncryptionService } from "../../../../../src/platform/compliance/encryption/index.js";

test("FieldEncryptionService protects nested fields and can reveal them with matching key", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      customer: {
        email: "alice@example.com",
        profile: { phone: "+8613800138000" },
      },
    },
    rules: [
      { fieldPath: "customer.email", classification: "confidential" },
      { fieldPath: "customer.profile.phone", classification: "restricted" },
    ],
    keyRef: "kms://tenant-a/key-1",
  });

  const emailCiphertext = result.protectedRecord.customer as Record<string, unknown>;
  assert.equal(result.protectedFields.length, 2);
  assert.equal(typeof emailCiphertext.email, "string");
  assert.equal(service.revealField({ ciphertext: emailCiphertext.email as string, keyRef: "kms://tenant-a/key-1" }), "alice@example.com");
});
