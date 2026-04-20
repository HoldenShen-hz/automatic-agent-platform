import assert from "node:assert/strict";
import test from "node:test";

import {
  missingEnv,
  invalidEnv,
  invalidGateValue,
  requiredEnv,
  optionalEnv,
  optionalNumber,
  requiredNumber,
  optionalEnumValue,
  requiredEnumValue,
  parseStringArrayJson,
  parseObjectJson,
  parseJsonValue,
  parseBooleanMapJson,
  parseBoolean,
  parseInteger,
  parseStringArrayFromCsv,
  ENVIRONMENT_NAMES,
  TENANT_ACTIONS,
  ENTERPRISE_ACTIONS,
  MARKETPLACE_ACTIONS,
  DEPLOYMENT_EXECUTION_ACTIONS,
  CONTROL_PLANE_ACTIONS,
  OPS_GOVERNANCE_ACTIONS,
  SECRET_ACTIONS,
  WORKER_REGISTER_ACTIONS,
  GATEWAY_TARGET_ACTIONS,
  INSPECT_KINDS,
  SKILL_CREATOR_ACTIONS,
  SHADOW_SNAPSHOT_ACTIONS,
  MEMORY_ACTIONS,
  MODEL_ROUTE_CLASSES,
  MODEL_ROUTE_RISK_LEVELS,
} from "../../../../../src/platform/control-plane/config-center/remaining-cli-env-support.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

const mockEnv: NodeJS.ProcessEnv = {};

test("ENVIRONMENT_NAMES contains expected values", () => {
  assert.deepEqual(Array.from(ENVIRONMENT_NAMES), ["dev", "test", "staging", "pre-prod", "prod"]);
});

test("TENANT_ACTIONS contains expected values", () => {
  assert.ok(TENANT_ACTIONS.includes("create_workspace"));
  assert.ok(TENANT_ACTIONS.includes("topology"));
});

test("ENTERPRISE_ACTIONS contains expected values", () => {
  assert.ok(ENTERPRISE_ACTIONS.includes("register_readiness"));
  assert.ok(ENTERPRISE_ACTIONS.includes("summary"));
});

test("MARKETPLACE_ACTIONS contains expected values", () => {
  assert.ok(MARKETPLACE_ACTIONS.includes("register_package"));
  assert.ok(MARKETPLACE_ACTIONS.includes("list_packages"));
});

test("DEPLOYMENT_EXECUTION_ACTIONS contains expected values", () => {
  assert.deepEqual(DEPLOYMENT_EXECUTION_ACTIONS, ["summary", "export"]);
});

test("CONTROL_PLANE_ACTIONS contains expected values", () => {
  assert.deepEqual(CONTROL_PLANE_ACTIONS, ["summary", "heartbeat", "select"]);
});

test("OPS_GOVERNANCE_ACTIONS contains expected values", () => {
  assert.deepEqual(OPS_GOVERNANCE_ACTIONS, ["summary", "export"]);
});

test("SECRET_ACTIONS contains expected values", () => {
  assert.ok(SECRET_ACTIONS.includes("register"));
  assert.ok(SECRET_ACTIONS.includes("resolve"));
});

test("WORKER_REGISTER_ACTIONS contains expected values", () => {
  assert.deepEqual(WORKER_REGISTER_ACTIONS, ["issue", "complete"]);
});

test("GATEWAY_TARGET_ACTIONS contains expected values", () => {
  assert.deepEqual(GATEWAY_TARGET_ACTIONS, ["upsert", "list", "resolve"]);
});

test("INSPECT_KINDS contains expected values", () => {
  assert.ok(INSPECT_KINDS.includes("task"));
  assert.ok(INSPECT_KINDS.includes("execution"));
});

test("SKILL_CREATOR_ACTIONS contains expected values", () => {
  assert.deepEqual(SKILL_CREATOR_ACTIONS, ["create", "validate"]);
});

test("SHADOW_SNAPSHOT_ACTIONS contains expected values", () => {
  assert.ok(SHADOW_SNAPSHOT_ACTIONS.includes("create"));
  assert.ok(SHADOW_SNAPSHOT_ACTIONS.includes("restore"));
});

test("MEMORY_ACTIONS contains expected values", () => {
  assert.ok(MEMORY_ACTIONS.includes("initialize"));
  assert.ok(MEMORY_ACTIONS.includes("remember"));
  assert.ok(MEMORY_ACTIONS.includes("consolidate"));
});

test("MODEL_ROUTE_CLASSES contains expected values", () => {
  assert.ok(MODEL_ROUTE_CLASSES.includes("default"));
  assert.ok(MODEL_ROUTE_CLASSES.includes("coding"));
});

test("MODEL_ROUTE_RISK_LEVELS contains expected values", () => {
  assert.deepEqual(MODEL_ROUTE_RISK_LEVELS, ["low", "medium", "high", "critical"]);
});

test("missingEnv throws ValidationError with correct code", () => {
  assert.throws(
    () => missingEnv("AA_MISSING_VAR"),
    (e: any) => e.code === "missing_env:AA_MISSING_VAR" && e instanceof ValidationError,
  );
});

test("invalidEnv throws ValidationError with correct code", () => {
  assert.throws(
    () => invalidEnv("AA_INVALID_VAR"),
    (e: any) => e.code === "invalid_env:AA_INVALID_VAR" && e instanceof ValidationError,
  );
});

test("invalidGateValue throws ValidationError with correct code", () => {
  assert.throws(
    () => invalidGateValue("AA_GATE"),
    (e: any) => e.code === "invalid_gate_value:AA_GATE" && e instanceof ValidationError,
  );
});

test("requiredEnv returns value when present", () => {
  const env = { AA_TEST_VAR: "  hello world  " };
  assert.equal(requiredEnv(env, "AA_TEST_VAR"), "hello world");
});

test("requiredEnv throws when missing", () => {
  assert.throws(
    () => requiredEnv({}, "AA_MISSING"),
    (e: any) => e.code === "missing_env:AA_MISSING",
  );
});

test("optionalEnv returns trimmed value when present", () => {
  const env = { AA_OPT_VAR: "  value  " };
  assert.equal(optionalEnv(env, "AA_OPT_VAR"), "value");
});

test("optionalEnv returns null when missing", () => {
  assert.equal(optionalEnv({}, "AA_MISSING"), null);
});

test("optionalEnv returns null for empty string", () => {
  assert.equal(optionalEnv({ AA_EMPTY: "" }, "AA_EMPTY"), null);
});

test("optionalNumber returns parsed number when valid", () => {
  const env = { AA_NUM: "42" };
  assert.equal(optionalNumber(env, "AA_NUM"), 42);
});

test("optionalNumber returns null when missing", () => {
  assert.equal(optionalNumber({}, "AA_MISSING"), null);
});

test("optionalNumber throws for non-finite number", () => {
  assert.throws(
    () => optionalNumber({ AA_INF: "Infinity" }, "AA_INF"),
    (e: any) => e.code === "invalid_env:AA_INF",
  );
});

test("requiredNumber returns parsed number when valid", () => {
  const env = { AA_REQ_NUM: "123" };
  assert.equal(requiredNumber(env, "AA_REQ_NUM"), 123);
});

test("requiredNumber throws when missing", () => {
  assert.throws(
    () => requiredNumber({}, "AA_MISSING"),
    (e: any) => e.code === "missing_env:AA_MISSING",
  );
});

test("optionalEnumValue returns value when valid", () => {
  const env = { AA_MODE: "dev" };
  assert.equal(optionalEnumValue(env, "AA_MODE", ENVIRONMENT_NAMES), "dev");
});

test("optionalEnumValue returns null when missing", () => {
  assert.equal(optionalEnumValue({}, "AA_MISSING", ENVIRONMENT_NAMES), null);
});

test("optionalEnumValue throws for invalid value", () => {
  assert.throws(
    () => optionalEnumValue({ AA_BAD: "invalid" }, "AA_BAD", ENVIRONMENT_NAMES),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("requiredEnumValue returns value when valid", () => {
  const env = { AA_MODE: "prod" };
  assert.equal(requiredEnumValue(env, "AA_MODE", ENVIRONMENT_NAMES), "prod");
});

test("requiredEnumValue throws when missing", () => {
  assert.throws(
    () => requiredEnumValue({}, "AA_MISSING", ENVIRONMENT_NAMES),
    (e: any) => e.code === "missing_env:AA_MISSING",
  );
});

test("parseStringArrayJson parses valid JSON array", () => {
  const env = { AA_ARRAY: '["a", "b", "c"]' };
  assert.deepEqual(parseStringArrayJson(env, "AA_ARRAY", false), ["a", "b", "c"]);
});

test("parseStringArrayJson returns null when missing (not required)", () => {
  assert.equal(parseStringArrayJson({}, "AA_MISSING", false), null);
});

test("parseStringArrayJson throws when required and missing", () => {
  assert.throws(
    () => parseStringArrayJson({}, "AA_MISSING", true),
    (e: any) => e.code === "missing_env:AA_MISSING",
  );
});

test("parseStringArrayJson throws for invalid JSON", () => {
  assert.throws(
    () => parseStringArrayJson({ AA_BAD: "not-json" }, "AA_BAD", false),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseStringArrayJson throws for non-array JSON", () => {
  assert.throws(
    () => parseStringArrayJson({ AA_BAD: '"single"' }, "AA_BAD", false),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseStringArrayJson throws for array with non-strings", () => {
  assert.throws(
    () => parseStringArrayJson({ AA_BAD: '[1, 2, 3]' }, "AA_BAD", false),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseObjectJson parses valid JSON object", () => {
  const env = { AA_OBJ: '{"key": "value"}' };
  assert.deepEqual(parseObjectJson(env, "AA_OBJ"), { key: "value" });
});

test("parseObjectJson returns null when missing", () => {
  assert.equal(parseObjectJson({}, "AA_MISSING"), null);
});

test("parseObjectJson throws for invalid JSON", () => {
  assert.throws(
    () => parseObjectJson({ AA_BAD: "not-json" }, "AA_BAD"),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseObjectJson throws for null", () => {
  assert.throws(
    () => parseObjectJson({ AA_NULL: "null" }, "AA_NULL"),
    (e: any) => e.code === "invalid_env:AA_NULL",
  );
});

test("parseObjectJson throws for array", () => {
  assert.throws(
    () => parseObjectJson({ AA_ARR: "[]" }, "AA_ARR"),
    (e: any) => e.code === "invalid_env:AA_ARR",
  );
});

test("parseJsonValue parses valid JSON", () => {
  const env = { AA_VAL: '{"key": 123}' };
  assert.deepEqual(parseJsonValue(env, "AA_VAL"), { key: 123 });
});

test("parseJsonValue parses primitives", () => {
  const env = { AA_STR: '"hello"', AA_NUM: "42", AA_BOOL: "true" };
  assert.equal(parseJsonValue(env, "AA_STR"), "hello");
  assert.equal(parseJsonValue(env, "AA_NUM"), 42);
  assert.equal(parseJsonValue(env, "AA_BOOL"), true);
});

test("parseJsonValue returns null when missing", () => {
  assert.equal(parseJsonValue({}, "AA_MISSING"), null);
});

test("parseJsonValue throws for invalid JSON", () => {
  assert.throws(
    () => parseJsonValue({ AA_BAD: "not-json" }, "AA_BAD"),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseBooleanMapJson parses valid boolean map", () => {
  const env = { AA_MAP: '{"enabled": true, "debug": false}' };
  assert.deepEqual(parseBooleanMapJson(env, "AA_MAP"), { enabled: true, debug: false });
});

test("parseBooleanMapJson returns undefined when missing", () => {
  assert.equal(parseBooleanMapJson({}, "AA_MISSING"), undefined);
});

test("parseBooleanMapJson throws for non-boolean values", () => {
  assert.throws(
    () => parseBooleanMapJson({ AA_BAD: '{"key": "yes"}' }, "AA_BAD"),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseBoolean parses true values", () => {
  assert.equal(parseBoolean({ AA_TRUE1: "true" }, "AA_TRUE1"), true);
  assert.equal(parseBoolean({ AA_TRUE2: "1" }, "AA_TRUE2"), true);
});

test("parseBoolean parses false values", () => {
  assert.equal(parseBoolean({ AA_FALSE1: "false" }, "AA_FALSE1"), false);
  assert.equal(parseBoolean({ AA_FALSE2: "0" }, "AA_FALSE2"), false);
});

test("parseBoolean returns undefined when missing", () => {
  assert.equal(parseBoolean({}, "AA_MISSING"), undefined);
});

test("parseBoolean throws for invalid value", () => {
  assert.throws(
    () => parseBoolean({ AA_BAD: "maybe" }, "AA_BAD"),
    (e: any) => e.code === "invalid_env:AA_BAD",
  );
});

test("parseInteger parses valid integers", () => {
  assert.equal(parseInteger({ AA_INT: "42" }, "AA_INT"), 42);
  assert.equal(parseInteger({ AA_NEG: "-10" }, "AA_NEG"), -10);
});

test("parseInteger returns undefined when missing", () => {
  assert.equal(parseInteger({}, "AA_MISSING"), undefined);
});

test("parseInteger parses integers (parseInt truncates decimals)", () => {
  // Number.parseInt("3.14", 10) returns 3 (truncates), so it does NOT throw
  assert.equal(parseInteger({ AA_FLOAT: "3.14" }, "AA_FLOAT"), 3);
  assert.equal(parseInteger({ AA_NEG_FLOAT: "-7.5" }, "AA_NEG_FLOAT"), -7);
});

test("parseStringArrayFromCsv parses comma-separated values", () => {
  const env = { AA_CSV: "a, b, c" };
  assert.deepEqual(parseStringArrayFromCsv(env, "AA_CSV"), ["a", "b", "c"]);
});

test("parseStringArrayFromCsv trims whitespace", () => {
  const env = { AA_CSV: "  a  ,  b  ,  c  " };
  assert.deepEqual(parseStringArrayFromCsv(env, "AA_CSV"), ["a", "b", "c"]);
});

test("parseStringArrayFromCsv filters empty strings", () => {
  const env = { AA_CSV: "a, , b, , c" };
  assert.deepEqual(parseStringArrayFromCsv(env, "AA_CSV"), ["a", "b", "c"]);
});

test("parseStringArrayFromCsv returns null when missing", () => {
  assert.equal(parseStringArrayFromCsv({}, "AA_MISSING"), null);
});

test("parseStringArrayFromCsv returns null for empty string", () => {
  // Empty string after trim becomes undefined, so the function returns null
  const env = { AA_EMPTY: "" };
  assert.equal(parseStringArrayFromCsv(env, "AA_EMPTY"), null);
});

test("parseStringArrayFromCsv handles single value", () => {
  const env = { AA_SINGLE: "only" };
  assert.deepEqual(parseStringArrayFromCsv(env, "AA_SINGLE"), ["only"]);
});
