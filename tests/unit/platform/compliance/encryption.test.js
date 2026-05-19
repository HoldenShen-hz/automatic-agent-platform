import assert from "node:assert/strict";
import test from "node:test";
import { FieldEncryptionService } from "../../../../src/platform/compliance/encryption/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// Helper to create a protection rule with defaults
function createRule(overrides = {}) {
    return {
        fieldPath: "secret",
        classification: "confidential",
        ...overrides,
    };
}
test("protectRecord encrypts specified fields", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "my-password", public: "data" };
    const rules = [createRule({ fieldPath: "secret" })];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    const protectedSecret = result.protectedRecord.secret;
    assert.notEqual(protectedSecret, "my-password", "secret should be encrypted");
    if (typeof protectedSecret !== "string") {
        assert.fail("protected secret should be a string");
    }
    assert.ok(protectedSecret.startsWith("enc:"), "should have encryption prefix");
    assert.equal(result.protectedRecord.public, "data", "unprotected field should remain unchanged");
    assert.equal(result.protectedFields.length, 1);
    const firstProtectedField = result.protectedFields.at(0);
    assert.ok(firstProtectedField);
    assert.equal(firstProtectedField.fieldPath, "secret");
    assert.equal(firstProtectedField.keyRef, "key_123");
    assert.equal(firstProtectedField.classification, "confidential");
});
test("protectRecord handles nested field paths", () => {
    const service = new FieldEncryptionService();
    const record = { user: { password: "secret123" }, public: "info" };
    const rules = [createRule({ fieldPath: "user.password" })];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_456",
    });
    assert.notEqual(result.protectedRecord.user.password, "secret123");
    assert.equal(result.protectedRecord.public, "info");
});
test("protectRecord throws for empty keyRef", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "value" };
    const rules = [createRule()];
    assert.throws(() => service.protectRecord({
        record,
        rules,
        keyRef: "   ",
    }), ValidationError);
});
test("protectRecord skips non-string field values", () => {
    const service = new FieldEncryptionService();
    const record = { secret: 12345, other: "string" };
    const rules = [createRule({ fieldPath: "secret" })];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_789",
    });
    assert.equal(result.protectedRecord.secret, 12345, "non-string should not be encrypted");
    assert.equal(result.protectedFields.length, 0);
});
test("protectRecord skips empty string field values", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "", other: "value" };
    const rules = [createRule({ fieldPath: "secret" })];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_abc",
    });
    assert.equal(result.protectedRecord.secret, "", "empty string should not be encrypted");
    assert.equal(result.protectedFields.length, 0);
});
test("protectRecord skips missing fields", () => {
    const service = new FieldEncryptionService();
    const record = { public: "data" };
    const rules = [createRule({ fieldPath: "nonexistent" })];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_xyz",
    });
    assert.equal(result.protectedFields.length, 0);
});
test("protectRecord handles multiple rules", () => {
    const service = new FieldEncryptionService();
    const record = { password: "pass", apiKey: "key", public: "data" };
    const rules = [
        createRule({ fieldPath: "password", classification: "restricted" }),
        createRule({ fieldPath: "apiKey", classification: "confidential" }),
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_multi",
    });
    assert.equal(result.protectedFields.length, 2);
    assert.ok(result.protectedFields.some((f) => f.fieldPath === "password" && f.classification === "restricted"));
    assert.ok(result.protectedFields.some((f) => f.fieldPath === "apiKey" && f.classification === "confidential"));
});
test("protectRecord does not modify original record", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "original" };
    const rules = [createRule({ fieldPath: "secret" })];
    service.protectRecord({
        record,
        rules,
        keyRef: "key_clone",
    });
    assert.equal(record.secret, "original", "original record should not be modified");
});
test("revealField decrypts ciphertext encrypted with same key", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "my-password" };
    const rules = [createRule({ fieldPath: "secret" })];
    const protectedResult = service.protectRecord({
        record,
        rules,
        keyRef: "reveal_key",
    });
    const protectedField = protectedResult.protectedFields.at(0);
    assert.ok(protectedField);
    const ciphertext = protectedField.ciphertext;
    const revealed = service.revealField({ ciphertext, keyRef: "reveal_key" });
    assert.equal(revealed, "my-password");
});
test("revealField throws for ciphertext with different key prefix", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "password" };
    const rules = [createRule({ fieldPath: "secret" })];
    const protectedResult = service.protectRecord({
        record,
        rules,
        keyRef: "key_1",
    });
    const protectedField = protectedResult.protectedFields.at(0);
    assert.ok(protectedField);
    const ciphertext = protectedField.ciphertext;
    assert.throws(() => service.revealField({ ciphertext, keyRef: "key_2" }), ValidationError);
});
test("revealField throws for invalid ciphertext format", () => {
    const service = new FieldEncryptionService();
    assert.throws(() => service.revealField({ ciphertext: "invalid_format", keyRef: "key_1" }), ValidationError);
});
test("protectRecord and revealField roundtrip for all classifications", () => {
    const service = new FieldEncryptionService();
    const classifications = ["internal", "confidential", "restricted"];
    for (const classification of classifications) {
        const record = { data: "sensitive" };
        const rules = [createRule({ fieldPath: "data", classification })];
        const protectedResult = service.protectRecord({
            record,
            rules,
            keyRef: "roundtrip_key",
        });
        const revealed = service.revealField({
            ciphertext: (() => {
                const protectedField = protectedResult.protectedFields.at(0);
                assert.ok(protectedField);
                return protectedField.ciphertext;
            })(),
            keyRef: "roundtrip_key",
        });
        assert.equal(revealed, "sensitive", `roundtrip should work for ${classification}`);
    }
});
test("protectRecord uses correct key fingerprint in ciphertext", () => {
    const service = new FieldEncryptionService();
    const record = { secret: "value" };
    const rules = [createRule({ fieldPath: "secret" })];
    const result1 = service.protectRecord({ record, rules, keyRef: "key_a" });
    const result2 = service.protectRecord({ record, rules, keyRef: "key_b" });
    // Different keys should produce different ciphertext prefixes
    assert.notEqual((() => {
        const protectedField = result1.protectedFields.at(0);
        assert.ok(protectedField);
        return protectedField.ciphertext;
    })(), (() => {
        const protectedField = result2.protectedFields.at(0);
        assert.ok(protectedField);
        return protectedField.ciphertext;
    })(), "different keys should produce different ciphertext");
});
//# sourceMappingURL=encryption.test.js.map