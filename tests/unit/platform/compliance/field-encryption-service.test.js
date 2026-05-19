import assert from "node:assert/strict";
import test from "node:test";
import { FieldEncryptionService } from "../../../../src/platform/compliance/encryption/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("FieldEncryptionService protectRecord encrypts specified field", () => {
    const service = new FieldEncryptionService();
    const record = {
        name: "John Doe",
        email: "john@example.com",
        status: "active",
    };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.notEqual(result.protectedRecord.email, "john@example.com");
    assert.equal(result.protectedRecord.name, "John Doe");
    assert.equal(result.protectedRecord.status, "active");
    assert.equal(result.protectedFields.length, 1);
    assert.equal(result.protectedFields[0].fieldPath, "email");
    assert.equal(result.protectedFields[0].keyRef, "key_123");
});
test("FieldEncryptionService protectRecord handles nested fields", () => {
    const service = new FieldEncryptionService();
    const record = {
        user: {
            name: "John Doe",
            email: "john@example.com",
        },
    };
    const rules = [
        { fieldPath: "user.email", classification: "confidential" },
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.notEqual(result.protectedRecord.user.email, "john@example.com");
    assert.equal(result.protectedRecord.user.name, "John Doe");
});
test("FieldEncryptionService protectRecord handles missing fields", () => {
    const service = new FieldEncryptionService();
    const record = { name: "John" };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.equal(result.protectedFields.length, 0);
});
test("FieldEncryptionService protectRecord handles empty string values", () => {
    const service = new FieldEncryptionService();
    const record = { email: "" };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.equal(result.protectedFields.length, 0);
});
test("FieldEncryptionService protectRecord rejects empty keyRef", () => {
    const service = new FieldEncryptionService();
    const record = { email: "test@example.com" };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
    ];
    assert.throws(() => service.protectRecord({
        record,
        rules,
        keyRef: "  ",
    }), ValidationError);
});
test("FieldEncryptionService revealField decrypts ciphertext", () => {
    const service = new FieldEncryptionService();
    const record = {
        email: "john@example.com",
    };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
    ];
    const protectedResult = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    const revealed = service.revealField({
        ciphertext: protectedResult.protectedRecord.email,
        keyRef: "key_123",
    });
    assert.equal(revealed, "john@example.com");
});
test("FieldEncryptionService revealField rejects mismatched key", () => {
    const service = new FieldEncryptionService();
    const record = {
        email: "john@example.com",
    };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
    ];
    const protectedResult = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.throws(() => service.revealField({
        ciphertext: protectedResult.protectedRecord.email,
        keyRef: "different_key",
    }), ValidationError);
});
test("FieldEncryptionService protectRecord encrypts with correct classification", () => {
    const service = new FieldEncryptionService();
    const record = { email: "john@example.com" };
    const rules = [
        { fieldPath: "email", classification: "restricted" },
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.equal(result.protectedFields[0].classification, "restricted");
});
test("FieldEncryptionService protectRecord handles multiple rules", () => {
    const service = new FieldEncryptionService();
    const record = {
        email: "john@example.com",
        phone: "555-1234",
        name: "John",
    };
    const rules = [
        { fieldPath: "email", classification: "confidential" },
        { fieldPath: "phone", classification: "internal" },
    ];
    const result = service.protectRecord({
        record,
        rules,
        keyRef: "key_123",
    });
    assert.equal(result.protectedFields.length, 2);
    assert.ok(result.protectedFields.some((f) => f.fieldPath === "email"));
    assert.ok(result.protectedFields.some((f) => f.fieldPath === "phone"));
    assert.equal(result.protectedRecord.name, "John");
});
test("FieldEncryptionService protectRecord does not modify original record", () => {
    const service = new FieldEncryptionService();
    const record = {
        email: "john@example.com",
    };
    const originalEmail = record.email;
    service.protectRecord({
        record,
        rules: [{ fieldPath: "email", classification: "confidential" }],
        keyRef: "key_123",
    });
    assert.equal(record.email, originalEmail);
});
//# sourceMappingURL=field-encryption-service.test.js.map