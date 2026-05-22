import assert from "node:assert/strict";
import test from "node:test";

import { FieldEncryptionService } from "../../../../../src/platform/compliance/encryption/index.js";

test("FieldEncryptionService protectRecord handles deeply nested paths", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      level1: {
        level2: {
          level3: {
            level4: {
              data: "deep secret value",
            },
          },
        },
      },
    },
    rules: [{ fieldPath: "level1.level2.level3.level4.data", classification: "restricted" }],
    keyRef: "kms://tenant/deep-key",
  });

  assert.equal(result.protectedFields.length, 1);
  const rec = result.protectedRecord as Record<string, unknown>;
  const l1 = rec.level1 as Record<string, unknown>;
  const l2 = l1.level2 as Record<string, unknown>;
  const l3 = l2.level3 as Record<string, unknown>;
  const l4 = l3.level4 as Record<string, unknown>;
  assert.notStrictEqual(l4.data, "deep secret value");
});

test("FieldEncryptionService protectRecord encrypts array-indexed field paths", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      users: [
        { name: "Alice", phones: ["111-1111", "222-2222"] },
        { name: "Bob", phones: ["333-3333"] },
      ],
    },
    rules: [
      { fieldPath: "users[0].name", classification: "confidential" },
      { fieldPath: "users[0].phones[1]", classification: "restricted" },
    ],
    keyRef: "kms://tenant/array-index-key",
  });

  const users = (result.protectedRecord.users as Array<Record<string, unknown>>);
  assert.equal(result.protectedFields.length, 2);
  assert.notEqual(users[0]?.name, "Alice");
  assert.notEqual((users[0]?.phones as string[])[1], "222-2222");
  assert.equal(
    service.revealField({ ciphertext: users[0]?.name as string, keyRef: "kms://tenant/array-index-key" }),
    "Alice",
  );
  assert.equal(
    service.revealField({
      ciphertext: (users[0]?.phones as string[])[1] as string,
      keyRef: "kms://tenant/array-index-key",
    }),
    "222-2222",
  );
});

test("FieldEncryptionService protectRecord skips invalid array traversal paths", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      user: {
        profile: "not-an-object",
      },
      tags: "not-an-array",
    },
    rules: [
      { fieldPath: "user.profile.name", classification: "internal" },
      { fieldPath: "tags[0]", classification: "confidential" },
    ],
    keyRef: "kms://tenant/invalid-array-key",
  });

  assert.deepEqual(result.protectedRecord, {
    user: {
      profile: "not-an-object",
    },
    tags: "not-an-array",
  });
  assert.equal(result.protectedFields.length, 0);
});

test("FieldEncryptionService protectRecord tolerates malformed cloned roots and nested objects", () => {
  const service = new FieldEncryptionService();
  const originalStructuredClone = globalThis.structuredClone;

  try {
    globalThis.structuredClone = (() => "broken-root") as typeof structuredClone;
    const rootResult = service.protectRecord({
      record: {
        user: {
          name: "Alice",
        },
      },
      rules: [{ fieldPath: "user.name", classification: "confidential" }],
      keyRef: "kms://tenant/broken-root-key",
    });
    assert.equal(rootResult.protectedFields.length, 1);
    assert.equal(rootResult.protectedRecord, "broken-root");

    globalThis.structuredClone = (() => ({ user: {} })) as typeof structuredClone;
    const nestedResult = service.protectRecord({
      record: {
        user: {
          profile: {
            name: "Alice",
          },
        },
      },
      rules: [{ fieldPath: "user.profile.name", classification: "confidential" }],
      keyRef: "kms://tenant/broken-nested-key",
    });

    assert.equal(nestedResult.protectedFields.length, 1);
    const nestedUser = nestedResult.protectedRecord.user as Record<string, unknown>;
    const nestedProfile = nestedUser.profile as Record<string, unknown>;
    assert.equal(
      service.revealField({
        ciphertext: nestedProfile.name as string,
        keyRef: "kms://tenant/broken-nested-key",
      }),
      "Alice",
    );
  } finally {
    globalThis.structuredClone = originalStructuredClone;
  }
});

test("FieldEncryptionService protectRecord tolerates malformed cloned arrays and terminal containers", () => {
  const service = new FieldEncryptionService();
  const originalStructuredClone = globalThis.structuredClone;

  try {
    globalThis.structuredClone = (() => ({ users: {} })) as typeof structuredClone;
    const nonArrayResult = service.protectRecord({
      record: {
        users: [{ name: "Alice" }],
      },
      rules: [{ fieldPath: "users[0].name", classification: "confidential" }],
      keyRef: "kms://tenant/non-array-key",
    });
    assert.equal(nonArrayResult.protectedFields.length, 1);
    assert.deepEqual(nonArrayResult.protectedRecord, { users: {} });

    globalThis.structuredClone = (() => ({ users: [null] })) as typeof structuredClone;
    const repairedArrayResult = service.protectRecord({
      record: {
        users: [{ name: "Alice" }],
      },
      rules: [{ fieldPath: "users[0].name", classification: "confidential" }],
      keyRef: "kms://tenant/repaired-array-key",
    });
    const repairedUsers = repairedArrayResult.protectedRecord.users as Array<Record<string, unknown>>;
    assert.equal(repairedArrayResult.protectedFields.length, 1);
    assert.equal(
      service.revealField({
        ciphertext: repairedUsers[0]?.name as string,
        keyRef: "kms://tenant/repaired-array-key",
      }),
      "Alice",
    );

    globalThis.structuredClone = (() => ({ users: {} })) as typeof structuredClone;
    const terminalResult = service.protectRecord({
      record: {
        users: ["Alice"],
      },
      rules: [{ fieldPath: "users[0]", classification: "restricted" }],
      keyRef: "kms://tenant/terminal-array-key",
    });
    assert.equal(terminalResult.protectedFields.length, 1);
    assert.deepEqual(terminalResult.protectedRecord, { users: {} });

    globalThis.structuredClone = (() => "broken-leaf") as typeof structuredClone;
    const brokenLeafResult = service.protectRecord({
      record: {
        name: "Alice",
      },
      rules: [{ fieldPath: "name", classification: "internal" }],
      keyRef: "kms://tenant/broken-leaf-key",
    });
    assert.equal(brokenLeafResult.protectedFields.length, 1);
    assert.equal(brokenLeafResult.protectedRecord, "broken-leaf");
  } finally {
    globalThis.structuredClone = originalStructuredClone;
  }
});

test("FieldEncryptionService protectRecord creates intermediate objects for existing paths", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      user: {
        profile: {
          name: "Alice",
        },
      },
    },
    rules: [{ fieldPath: "user.profile.name", classification: "internal" }],
    keyRef: "kms://tenant/new-key",
  });

  assert.equal(result.protectedFields.length, 1);
  const rec = result.protectedRecord as Record<string, unknown>;
  const user = rec.user as Record<string, unknown>;
  const profile = user.profile as Record<string, unknown>;
  assert.ok(profile.name);
  assert.notEqual(profile.name, "Alice");
});

test("FieldEncryptionService revealField rejects invalid ciphertext structure", () => {
  const service = new FieldEncryptionService();

  // Missing parts
  assert.throws(
    () => service.revealField({ ciphertext: "enc:fp", keyRef: "key" }),
    (err: unknown) => (err as { code: string }).code === "field_encryption.invalid_ciphertext",
  );

  // Wrong prefix
  assert.throws(
    () => service.revealField({ ciphertext: "wrong:fp:iv:tag:data", keyRef: "key" }),
    (err: unknown) => (err as { code: string }).code === "field_encryption.invalid_ciphertext",
  );
});

test("FieldEncryptionService protectRecord preserves arrays when not targeted", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      tags: ["敏感", "private"],
      numbers: [1, 2, 3],
      users: [{ name: "Alice" }, { name: "Bob" }],
    },
    rules: [{ fieldPath: "tags", classification: "confidential" }],
    keyRef: "kms://tenant/array-key",
  });

  const rec = result.protectedRecord as Record<string, unknown>;
  assert.deepEqual(rec.tags, ["敏感", "private"]);
  assert.deepEqual(rec.numbers, [1, 2, 3]);
  assert.deepEqual(rec.users, [{ name: "Alice" }, { name: "Bob" }]);
});

test("FieldEncryptionService protectRecord skips missing fields without throwing", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { existing: "value" },
    rules: [{ fieldPath: "deeply.nested.path.that.does.not.exist", classification: "internal" }],
    keyRef: "kms://tenant/missing-key",
  });

  assert.deepEqual(result.protectedRecord, { existing: "value" });
  assert.equal(result.protectedFields.length, 0);
});

test("FieldEncryptionService key fingerprint is deterministic", () => {
  const service = new FieldEncryptionService();
  const result1 = service.protectRecord({
    record: { data: "same" },
    rules: [{ fieldPath: "data", classification: "confidential" }],
    keyRef: "same-key-ref",
  });

  const result2 = service.protectRecord({
    record: { data: "same" },
    rules: [{ fieldPath: "data", classification: "confidential" }],
    keyRef: "same-key-ref",
  });

  // Same key should produce same prefix (fingerprint)
  const cf1 = result1.protectedFields[0]!.ciphertext;
  const cf2 = result2.protectedFields[0]!.ciphertext;

  const prefix1 = cf1.split(":").slice(0, 2).join(":");
  const prefix2 = cf2.split(":").slice(0, 2).join(":");
  assert.equal(prefix1, prefix2, "Same key should produce same fingerprint prefix");
});

test("FieldEncryptionService different keys produce different fingerprints", () => {
  const service = new FieldEncryptionService();
  const result1 = service.protectRecord({
    record: { data: "same" },
    rules: [{ fieldPath: "data", classification: "confidential" }],
    keyRef: "key-alpha",
  });

  const result2 = service.protectRecord({
    record: { data: "same" },
    rules: [{ fieldPath: "data", classification: "confidential" }],
    keyRef: "key-beta",
  });

  const cf1 = result1.protectedFields[0]!.ciphertext;
  const cf2 = result2.protectedFields[0]!.ciphertext;

  const prefix1 = cf1.split(":").slice(0, 2).join(":");
  const prefix2 = cf2.split(":").slice(0, 2).join(":");
  assert.notEqual(prefix1, prefix2, "Different keys should produce different fingerprints");
});

test("FieldEncryptionService roundtrip preserves unicode", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      name: "张三",
      bio: "Hello, 世界! 🌍",
      email: "test@例子.测试",
    },
    rules: [
      { fieldPath: "name", classification: "internal" },
      { fieldPath: "bio", classification: "internal" },
      { fieldPath: "email", classification: "confidential" },
    ],
    keyRef: "kms://tenant/unicode-key",
  });

  const rec = result.protectedRecord as Record<string, unknown>;
  const revealed1 = service.revealField({ ciphertext: rec.name as string, keyRef: "kms://tenant/unicode-key" });
  assert.equal(revealed1, "张三");

  const revealed2 = service.revealField({ ciphertext: rec.bio as string, keyRef: "kms://tenant/unicode-key" });
  assert.equal(revealed2, "Hello, 世界! 🌍");

  const revealed3 = service.revealField({ ciphertext: rec.email as string, keyRef: "kms://tenant/unicode-key" });
  assert.equal(revealed3, "test@例子.测试");
});

test("FieldEncryptionService protectRecord with empty record returns empty protectedFields", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {},
    rules: [{ fieldPath: "nonexistent", classification: "internal" }],
    keyRef: "kms://tenant/empty-key",
  });

  assert.deepEqual(result.protectedRecord, {});
  assert.equal(result.protectedFields.length, 0);
});

test("FieldEncryptionService multiple encryption rules on same field both apply", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { name: "Alice" },
    rules: [
      { fieldPath: "name", classification: "internal" },
      { fieldPath: "name", classification: "confidential" },
    ],
    keyRef: "kms://tenant/multi-key",
  });

  // Both rules apply to same field - second encryption overwrites first
  assert.equal(result.protectedFields.length, 2);
});

test("FieldEncryptionService protectRecord with numeric values skipped", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: {
      name: "Alice",
      age: 30,
      active: true,
      score: 99.5,
    },
    rules: [
      { fieldPath: "name", classification: "confidential" },
      { fieldPath: "age", classification: "confidential" },
      { fieldPath: "active", classification: "confidential" },
      { fieldPath: "score", classification: "confidential" },
    ],
    keyRef: "kms://tenant/numeric-key",
  });

  // Only name (string) is encrypted, numeric and boolean values are skipped
  assert.equal(result.protectedFields.length, 1);
  const rec = result.protectedRecord as Record<string, unknown>;
  assert.notEqual(rec.name, "Alice");
  assert.equal(rec.age, 30);
  assert.equal(rec.active, true);
  assert.equal(rec.score, 99.5);
});
