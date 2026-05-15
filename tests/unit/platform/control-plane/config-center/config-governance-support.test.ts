import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonObject,
  normalizeJsonc,
  validateLayerSchema,
  validateConfigField,
  addConfigIssue,
  stripJsonComments,
  stripTrailingCommas,
  stableStringify,
  mergeConfigObjects,
  sha256,
  isPositiveNumber,
  diffObjects,
  isPlainObject,
  BOOTSTRAP_LAYER_SCHEMA,
  GATEWAYS_LAYER_SCHEMA,
  PROVIDERS_LAYER_SCHEMA,
  RUNTIME_LAYER_SCHEMA,
  SECURITY_LAYER_SCHEMA,
  WORKFLOWS_LAYER_SCHEMA,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-governance-support.js";

test("stripJsonComments removes single-line comments", () => {
  const input = `{
  // This is a comment
  "key": "value"
}`;
  const result = stripJsonComments(input);
  assert.ok(!result.includes("// This is a comment"));
  assert.ok(result.includes('"key"'));
});

test("stripJsonComments removes multi-line comments", () => {
  const input = `{
  /* This is
     a multi-line
     comment */
  "key": "value"
}`;
  const result = stripJsonComments(input);
  assert.ok(!result.includes("/* This is"));
  assert.ok(result.includes('"key"'));
});

test("stripJsonComments preserves strings with comment-like content", () => {
  const input = `{
  "url": "http://example.com/api?foo=//bar"
}`;
  const result = stripJsonComments(input);
  assert.ok(result.includes("http://example.com"));
});

test("stripJsonComments handles nested quotes in strings", () => {
  const input = `{
  "sql": "SELECT * FROM /* comment */ table"
}`;
  const result = stripJsonComments(input);
  assert.ok(result.includes("SELECT"));
});

test("stripTrailingCommas removes trailing commas before closing braces", () => {
  const input = `{
  "key1": "value1",
  "key2": "value2",
}`;
  const result = stripTrailingCommas(input);
  assert.ok(!result.includes(",}"));
});

test("stripTrailingCommas removes trailing commas before closing brackets", () => {
  const input = `["item1", "item2",]`;
  const result = stripTrailingCommas(input);
  assert.ok(!result.includes(",]"));
});

test("stripTrailingCommas preserves commas between elements", () => {
  const input = `{
  "array": ["a", "b", "c"]
}`;
  const result = stripTrailingCommas(input);
  assert.ok(result.includes('"b", "c"'));
});

test("normalizeJsonc strips comments and trailing commas", () => {
  const input = `{
  // comment
  "key": "value",
}`;
  const result = normalizeJsonc(input);
  assert.ok(!result.includes("//"));
  assert.ok(!result.includes(",}"));
});

test("parseJsonObject parses valid JSON", () => {
  const result = parseJsonObject('{"key": "value"}', "test.json");
  assert.deepEqual(result, { key: "value" });
});

test("parseJsonObject parses JSONC with comments", () => {
  const input = `{
  // comment
  "key": "value"
}`;
  const result = parseJsonObject(input, "test.jsonc");
  assert.deepEqual(result, { key: "value" });
});

test("parseJsonObject throws for invalid JSON", () => {
  assert.throws(
    () => parseJsonObject("not valid json", "test.json"),
    (error: any) => error.code.startsWith("config.invalid_json")
  );
});

test("parseJsonObject throws for non-object JSON", () => {
  assert.throws(
    () => parseJsonObject('"just a string"', "test.json"),
    (error: any) => error.code.startsWith("config.invalid_shape")
  );
});

test("parseJsonObject throws for arrays", () => {
  assert.throws(
    () => parseJsonObject("[]", "test.json"),
    (error: any) => error.code.startsWith("config.invalid_shape")
  );
});

test("parseJsonObject throws for null", () => {
  assert.throws(
    () => parseJsonObject("null", "test.json"),
    (error: any) => error.code.startsWith("config.invalid_shape")
  );
});

test("isPlainObject returns true for plain objects", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ key: "value" }), true);
});

test("isPlainObject returns false for arrays", () => {
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject([1, 2, 3]), false);
});

test("isPlainObject returns false for null", () => {
  assert.equal(isPlainObject(null), false);
});

test("isPlainObject returns false for primitives", () => {
  assert.equal(isPlainObject("string"), false);
  assert.equal(isPlainObject(123), false);
  assert.equal(isPlainObject(true), false);
  assert.equal(isPlainObject(undefined), false);
});

test("isPositiveNumber returns true for positive numbers", () => {
  assert.equal(isPositiveNumber(1), true);
  assert.equal(isPositiveNumber(0.5), true);
  assert.equal(isPositiveNumber(1000000), true);
});

test("isPositiveNumber returns false for zero", () => {
  assert.equal(isPositiveNumber(0), false);
});

test("isPositiveNumber returns false for negative numbers", () => {
  assert.equal(isPositiveNumber(-1), false);
  assert.equal(isPositiveNumber(-0.5), false);
});

test("isPositiveNumber returns false for non-finite numbers", () => {
  assert.equal(isPositiveNumber(Infinity), false);
  assert.equal(isPositiveNumber(-Infinity), false);
  assert.equal(isPositiveNumber(NaN), false);
});

test("isPositiveNumber returns false for non-numbers", () => {
  assert.equal(isPositiveNumber("1"), false);
  assert.equal(isPositiveNumber(null), false);
  assert.equal(isPositiveNumber(undefined), false);
});

test("stableStringify sorts object keys", () => {
  const obj = { b: 1, a: 2 };
  const result = stableStringify(obj);
  assert.equal(result, '{"a":2,"b":1}');
});

test("stableStringify handles arrays", () => {
  const arr = [{ b: 1, a: 2 }, { d: 3, c: 4 }];
  const result = stableStringify(arr);
  assert.equal(result, '[{"a":2,"b":1},{"c":4,"d":3}]');
});

test("stableStringify handles primitives", () => {
  assert.equal(stableStringify("string"), '"string"');
  assert.equal(stableStringify(123), "123");
  assert.equal(stableStringify(true), "true");
  assert.equal(stableStringify(null), "null");
});

test("stableStringify produces deterministic output", () => {
  const obj = { z: 1, a: { y: 2, x: 3 } };
  const result1 = stableStringify(obj);
  const result2 = stableStringify(obj);
  assert.equal(result1, result2);
});

test("sha256 produces consistent hashes", () => {
  const hash1 = sha256("hello");
  const hash2 = sha256("hello");
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64); // SHA-256 hex is 64 chars
});

test("sha256 produces different hashes for different inputs", () => {
  const hash1 = sha256("hello");
  const hash2 = sha256("world");
  assert.notEqual(hash1, hash2);
});

test("mergeConfigObjects deep merges nested objects", () => {
  const base = { a: 1, nested: { b: 2, c: 3 } };
  const overlay = { nested: { b: 99, d: 4 }, e: 5 };
  const result = mergeConfigObjects(base, overlay);
  assert.deepEqual(result, { a: 1, nested: { b: 99, c: 3, d: 4 }, e: 5 });
});

test("mergeConfigObjects overlay replaces non-object values", () => {
  const base = { a: 1, b: { c: 2 } };
  const overlay = { a: 99 };
  const result = mergeConfigObjects(base, overlay);
  assert.deepEqual(result, { a: 99, b: { c: 2 } });
});

test("mergeConfigObjects does not mutate inputs", () => {
  const base = { a: 1 };
  const overlay = { b: 2 };
  mergeConfigObjects(base, overlay);
  assert.deepEqual(base, { a: 1 });
  assert.deepEqual(overlay, { b: 2 });
});

test("diffObjects returns empty array for equal objects", () => {
  const obj = { a: 1, b: 2 };
  const result = diffObjects(obj, obj);
  assert.deepEqual(result, []);
});

test("diffObjects detects added fields", () => {
  const before = { a: 1 };
  const after = { a: 1, b: 2 };
  const result = diffObjects(before, after);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.changeType, "added");
  assert.equal(result[0]!.path, "b");
  assert.equal(result[0]!.afterValue, 2);
});

test("diffObjects detects removed fields", () => {
  const before = { a: 1, b: 2 };
  const after = { a: 1 };
  const result = diffObjects(before, after);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.changeType, "removed");
  assert.equal(result[0]!.path, "b");
  assert.equal(result[0]!.beforeValue, 2);
});

test("diffObjects detects changed fields", () => {
  const before = { a: 1, b: 2 };
  const after = { a: 1, b: 99 };
  const result = diffObjects(before, after);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.changeType, "changed");
  assert.equal(result[0]!.path, "b");
  assert.equal(result[0]!.beforeValue, 2);
  assert.equal(result[0]!.afterValue, 99);
});

test("diffObjects uses dot notation for nested paths", () => {
  const before = { a: { b: { c: 1 } } };
  const after = { a: { b: { c: 99 } } };
  const result = diffObjects(before, after);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.path, "a.b.c");
});

test("diffObjects handles deep equality", () => {
  const before = { a: { b: 1, c: { d: 2 } } };
  const after = { a: { b: 1, c: { d: 2 } } };
  const result = diffObjects(before, after);
  assert.deepEqual(result, []);
});

test("addConfigIssue adds issue to array", () => {
  const issues: string[] = [];
  addConfigIssue(issues, "config.error");
  assert.deepEqual(issues, ["config.error"]);
});

test("addConfigIssue does not add duplicate", () => {
  const issues = ["config.error"];
  addConfigIssue(issues, "config.error");
  assert.deepEqual(issues, ["config.error"]);
});

test("validateConfigField validates string type", () => {
  const schema = { kind: "string" as const, issue: "config.invalid" };
  const issues: string[] = [];

  assert.equal(validateConfigField("valid", schema, issues), true);
  assert.deepEqual(issues, []);
});

test("validateConfigField rejects non-string for string schema", () => {
  const schema = { kind: "string" as const, issue: "config.invalid" };
  const issues: string[] = [];

  assert.equal(validateConfigField(123, schema, issues), false);
  assert.deepEqual(issues, ["config.invalid"]);
});

test("validateConfigField validates string minLength", () => {
  const schema = { kind: "string" as const, issue: "config.invalid", minLength: 3 };
  const issues: string[] = [];

  assert.equal(validateConfigField("ab", schema, issues), false);
  assert.equal(validateConfigField("abc", schema, issues), true);
});

test("validateConfigField validates boolean type", () => {
  const schema = { kind: "boolean" as const, issue: "config.invalid" };
  const issues: string[] = [];

  assert.equal(validateConfigField(true, schema, issues), true);
  assert.equal(validateConfigField(false, schema, issues), true);
  assert.equal(validateConfigField(1, schema, issues), false);
});

test("validateConfigField validates number type", () => {
  const schema = { kind: "number" as const, issue: "config.invalid" };
  const issues: string[] = [];

  assert.equal(validateConfigField(42, schema, issues), true);
  assert.equal(validateConfigField(0, schema, issues), true);
  assert.equal(validateConfigField("42", schema, issues), false);
});

test("validateConfigField validates integer constraint", () => {
  const schema = { kind: "number" as const, issue: "config.invalid", integer: true };
  const issues: string[] = [];

  assert.equal(validateConfigField(42, schema, issues), true);
  assert.equal(validateConfigField(42.5, schema, issues), false);
});

test("validateConfigField validates minExclusive constraint", () => {
  const schema = { kind: "number" as const, issue: "config.invalid", minExclusive: 0 };
  const issues: string[] = [];

  assert.equal(validateConfigField(1, schema, issues), true);
  assert.equal(validateConfigField(0, schema, issues), false);
  assert.equal(validateConfigField(-1, schema, issues), false);
});

test("validateConfigField validates enum values", () => {
  const schema = {
    kind: "enum" as const,
    issue: "config.invalid",
    values: ["enabled", "disabled"] as const,
  };
  const issues: string[] = [];

  assert.equal(validateConfigField("enabled", schema, issues), true);
  assert.equal(validateConfigField("disabled", schema, issues), true);
  assert.equal(validateConfigField("unknown", schema, issues), false);
});

test("validateConfigField validates array minLength", () => {
  const schema = {
    kind: "array" as const,
    issue: "config.invalid",
    minLength: 2,
    element: { kind: "string" as const },
  };
  const issues: string[] = [];

  assert.equal(validateConfigField(["a", "b"], schema, issues), true);
  assert.equal(validateConfigField(["a"], schema, issues), false);
});

test("validateConfigField validates array element type", () => {
  const schema = {
    kind: "array" as const,
    issue: "config.invalid",
    element: { kind: "string" as const },
  };
  const issues: string[] = [];

  assert.equal(validateConfigField(["a", "b"], schema, issues), true);
  assert.equal(validateConfigField(["a", 1], schema, issues), false);
});

test("validateConfigField validates object shape", () => {
  const schema = {
    kind: "object" as const,
    issue: "config.invalid",
    shape: {
      name: { kind: "string" as const, issue: "config.invalid.name", minLength: 1 },
    },
  };
  const issues: string[] = [];

  assert.equal(validateConfigField({ name: "test" }, schema, issues), true);
  assert.equal(validateConfigField({ name: "" }, schema, issues), false);
});

test("validateConfigField skips optional undefined fields", () => {
  const schema = {
    kind: "object" as const,
    issue: "config.invalid",
    shape: {
      optionalField: { kind: "string" as const, issue: "config.invalid", optional: true },
    },
  };
  const issues: string[] = [];

  assert.equal(validateConfigField({}, schema, issues), true);
});

test("validateConfigField treats undefined as optional only", () => {
  const schema = { kind: "string" as const, issue: "config.invalid" };
  const issues: string[] = [];

  assert.equal(validateConfigField(undefined, schema, issues), false);
  assert.equal((schema as any).optional, undefined);
});

test("validateConfigField allows optional undefined fields", () => {
  const schema = { kind: "string" as const, issue: "config.invalid", optional: true };
  const issues: string[] = [];

  assert.equal(validateConfigField(undefined, schema, issues), true);
});

test("validateLayerSchema skips undefined layers", () => {
  const issues: string[] = [];
  validateLayerSchema(undefined, BOOTSTRAP_LAYER_SCHEMA, issues);
  assert.deepEqual(issues, []);
});

test("validateLayerSchema validates defined layers", () => {
  const layer = {
    appName: "test-app",
    phase: "ring_1",
    stableCoreEnabled: true,
    dependencyOrder: ["bootstrap", "platform"],
    readinessGates: ["config_loaded"],
    degradationPolicy: {
      onReadinessFailure: "fail_closed",
    },
    healthCheckTimeoutMs: 5000,
    readinessProbe: {
      initialDelayMs: 1000,
      intervalMs: 5000,
      timeoutMs: 3000,
      failureThreshold: 3,
    },
  };
  const issues: string[] = [];
  validateLayerSchema(layer, BOOTSTRAP_LAYER_SCHEMA, issues);
  assert.deepEqual(issues, []);
});

test("validateLayerSchema rejects missing required fields", () => {
  const layer = {
    appName: "test-app",
    // missing phase and stableCoreEnabled
  };
  const issues: string[] = [];
  validateLayerSchema(layer, BOOTSTRAP_LAYER_SCHEMA, issues);
  assert.ok(issues.length > 0);
});

test("validateConfigField rejects NaN for number", () => {
  const schema = { kind: "number" as const, issue: "config.invalid" };
  const issues: string[] = [];
  assert.equal(validateConfigField(NaN, schema, issues), false);
});

test("validateConfigField rejects Infinity for number", () => {
  const schema = { kind: "number" as const, issue: "config.invalid" };
  const issues: string[] = [];
  assert.equal(validateConfigField(Infinity, schema, issues), false);
});

test("BOOTSTRAP_LAYER_SCHEMA accepts readiness and startup-order defaults required by bootstrap config", () => {
  const issues: string[] = [];
  validateLayerSchema({
    appName: "automatic-agent-system",
    phase: "ring_1",
    stableCoreEnabled: true,
    dependencyOrder: ["bootstrap", "platform"],
    readinessGates: ["config_loaded"],
    degradationPolicy: {
      onReadinessFailure: "fail_closed",
      allowSummaryMode: true,
    },
    healthCheckTimeoutMs: 5000,
    readinessProbe: {
      initialDelayMs: 1000,
      intervalMs: 5000,
      timeoutMs: 3000,
      failureThreshold: 3,
    },
  }, BOOTSTRAP_LAYER_SCHEMA, issues);

  assert.deepEqual(issues, []);
});

test("RUNTIME_LAYER_SCHEMA accepts config schema version, breaker threshold, and drift interval", () => {
  const issues: string[] = [];
  validateLayerSchema({
    configVersion: "v4.3",
    configSchemaVersion: "v4.3",
    maxConcurrentTasks: 1,
    defaultTaskTimeoutMs: 300000,
    defaultStepTimeoutMs: 120000,
    apiDefaultTimeoutMs: 5000,
    apiMaxTimeoutMs: 30000,
    maxAgentRounds: 6,
    maxToolCalls: 8,
    retryMax: 3,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 120,
    },
    configDriftReconciler: {
      interval: 300000,
    },
  }, RUNTIME_LAYER_SCHEMA, issues);

  assert.deepEqual(issues, []);
});

test("RUNTIME_LAYER_SCHEMA rejects runtime defaults that omit config schema version and drift interval", () => {
  const issues: string[] = [];
  validateLayerSchema({
    maxConcurrentTasks: 1,
    defaultTaskTimeoutMs: 300000,
    defaultStepTimeoutMs: 120000,
  }, RUNTIME_LAYER_SCHEMA, issues);

  assert.ok(issues.includes("config.invalid_runtime.configVersion"));
  assert.ok(issues.includes("config.invalid_runtime.configSchemaVersion"));
  assert.ok(issues.includes("config.invalid_runtime.circuitBreaker"));
  assert.ok(issues.includes("config.invalid_runtime.rateLimit"));
  assert.ok(issues.includes("config.invalid_runtime.configDriftReconciler"));
});
