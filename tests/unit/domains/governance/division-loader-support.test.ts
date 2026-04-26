import assert from "node:assert/strict";
import test from "node:test";

import {
  tokenizeYaml,
  parseLimitedYaml,
  parseBlock,
  parseObject,
  parseArray,
  splitKeyValue,
  looksLikeKeyValue,
  parseScalar,
  isPlainObject,
  expectNonEmptyString,
  toObjectArray,
  toStringArray,
  toInteger,
  throwDivisionValidationError,
  throwDivisionWorkflowError,
  throwDivisionSandboxError,
} from "../../../../src/domains/governance/division-loader-support.js";

test("tokenizeYaml filters empty lines and comments", () => {
  const raw = `
# comment
key: value

  indented: true
- item1
- item2
`;
  const lines = tokenizeYaml(raw);

  const texts = lines.map(l => l.text);
  assert.ok(!texts.some(t => t.startsWith("#")));
  assert.ok(!texts.some(t => t.length === 0));
});

test("tokenizeYaml captures indent level", () => {
  const raw = `root: value
  child: nested
    grandchild: deep
`;
  const lines = tokenizeYaml(raw);

  assert.equal(lines[0]?.indent, 0);
  assert.equal(lines[1]?.indent, 2);
  assert.equal(lines[2]?.indent, 4);
});

test("tokenizeYaml preserves line numbers", () => {
  const raw = `line1: value
# comment
line3: value
`;
  const lines = tokenizeYaml(raw);

  assert.equal(lines[0]?.lineNumber, 1);
  assert.equal(lines[1]?.lineNumber, 3);
});

test("parseLimitedYaml returns empty object for empty input", () => {
  const result = parseLimitedYaml("", "test.yaml");
  assert.deepEqual(result, {});
});

test("parseLimitedYaml parses simple key-value", () => {
  const result = parseLimitedYaml("key: value", "test.yaml") as Record<string, unknown>;

  assert.equal(result.key, "value");
});

test("parseLimitedYaml parses nested objects", () => {
  const result = parseLimitedYaml(`
parent:
  child: value
`, "test.yaml") as Record<string, Record<string, unknown>>;

  assert.ok(result.parent);
  assert.equal(result.parent.child, "value");
});

test("parseLimitedYaml parses arrays", () => {
  const result = parseLimitedYaml(`
items:
  - item1
  - item2
`, "test.yaml") as { items: string[] };

  assert.deepEqual(result.items, ["item1", "item2"]);
});

test("parseScalar converts boolean true", () => {
  assert.equal(parseScalar("true"), true);
});

test("parseScalar converts boolean false", () => {
  assert.equal(parseScalar("false"), false);
});

test("parseScalar converts null", () => {
  assert.equal(parseScalar("null"), null);
});

test("parseScalar converts integer", () => {
  assert.equal(parseScalar("42"), 42);
  assert.equal(parseScalar("-10"), -10);
});

test("parseScalar converts quoted strings", () => {
  assert.equal(parseScalar('"quoted"'), "quoted");
  assert.equal(parseScalar("'single'"), "single");
});

test("parseScalar parses array notation", () => {
  assert.deepEqual(parseScalar("[a, b, c]"), ["a", "b", "c"]);
});

test("parseScalar returns plain string for unquoted", () => {
  assert.equal(parseScalar("plain"), "plain");
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
});

test("expectNonEmptyString returns trimmed string", () => {
  assert.equal(expectNonEmptyString("  value  ", "ERR"), "value");
});

test("expectNonEmptyString throws for empty string", () => {
  assert.throws(() => expectNonEmptyString("", "ERR"), /ERR/);
  assert.throws(() => expectNonEmptyString("   ", "ERR"), /ERR/);
});

test("expectNonEmptyString throws for non-string", () => {
  assert.throws(() => expectNonEmptyString(123 as unknown, "ERR"), /ERR/);
});

test("toObjectArray filters to plain objects", () => {
  const result = toObjectArray([{}, { a: 1 }, "string", null, { b: 2 }]);

  assert.equal(result.length, 3);
  assert.deepEqual(result[0], {});
  assert.equal(result[1].a, 1);
  assert.equal(result[2].b, 2);
});

test("toObjectArray returns empty for non-array", () => {
  assert.deepEqual(toObjectArray("not array"), []);
  assert.deepEqual(toObjectArray(123), []);
});

test("toStringArray filters to strings and trims", () => {
  const result = toStringArray(["  a  ", "b", null, 123, " c "]);

  assert.deepEqual(result, ["a", "b", "c"]);
});

test("toStringArray returns empty for non-array", () => {
  assert.deepEqual(toStringArray(123), []);
});

test("toInteger returns integer values", () => {
  assert.equal(toInteger(42, 0), 42);
  assert.equal(toInteger(-10, 0), -10);
});

test("toInteger parses string integers", () => {
  assert.equal(toInteger("42", 0), 42);
  assert.equal(toInteger("  -10  ", 0), -10);
});

test("toInteger returns fallback for non-integers", () => {
  assert.equal(toInteger(3.14, 0), 0);
  assert.equal(toInteger("not a number", 99), 99);
  assert.equal(toInteger(null, 99), 99);
});

test("looksLikeKeyValue detects key-value patterns", () => {
  assert.equal(looksLikeKeyValue("key: value"), true);
  assert.equal(looksLikeKeyValue("key:"), true);
  assert.equal(looksLikeKeyValue("just text"), false);
});

test("splitKeyValue splits on colon", () => {
  const [key, value] = splitKeyValue("name: John Doe", "test.yaml", 1);

  assert.equal(key, "name");
  assert.equal(value, "John Doe");
});

test("splitKeyValue throws for missing separator", () => {
  assert.throws(() => splitKeyValue("invalid", "test.yaml", 1), /yaml.invalid_mapping/);
});

test("splitKeyValue throws for empty key", () => {
  assert.throws(() => splitKeyValue(": value", "test.yaml", 1), /yaml.invalid_mapping/);
});

test("throwDivisionValidationError throws ValidationError", () => {
  assert.throws(
    () => throwDivisionValidationError("ERR_CODE", { detail: "value" }),
    (err: unknown) => (err as Error).message === "ERR_CODE"
  );
});

test("throwDivisionWorkflowError throws WorkflowStateError", () => {
  assert.throws(
    () => throwDivisionWorkflowError("WF_ERR", { detail: "value" }),
    (err: unknown) => (err as Error).message === "WF_ERR"
  );
});

test("throwDivisionSandboxError throws SandboxError", () => {
  assert.throws(
    () => throwDivisionSandboxError("SB_ERR", { detail: "value" }),
    (err: unknown) => (err as Error).message === "SB_ERR"
  );
});

test("parseObject parses nested structure", () => {
  const lines = tokenizeYaml(`
parent:
  child1: value1
  child2: value2
`);
  const [result] = parseObject(lines, 0, 0, "test.yaml");

  assert.ok(result.parent);
  const parent = result.parent as Record<string, unknown>;
  assert.equal(parent.child1, "value1");
  assert.equal(parent.child2, "value2");
});

test("parseArray parses array items with key-value syntax", () => {
  const lines = tokenizeYaml(`
items:
  - name: first
    value: 1
  - name: second
    value: 2
`);
  const [result] = parseArray(lines, 1, 2, "test.yaml");

  assert.ok(Array.isArray(result));
  assert.equal((result as Array<Record<string, unknown>>)[0].name, "first");
});
