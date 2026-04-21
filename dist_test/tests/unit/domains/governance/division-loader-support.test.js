import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeYaml, parseLimitedYaml, parseBlock, parseObject, parseArray, splitKeyValue, looksLikeKeyValue, parseScalar, isPlainObject, expectNonEmptyString, toObjectArray, toStringArray, toInteger, throwDivisionValidationError, throwDivisionWorkflowError, throwDivisionSandboxError, } from "../../../../src/domains/governance/division-loader-support.js";
test("tokenizeYaml returns empty array for empty string", () => {
    assert.deepEqual(tokenizeYaml(""), []);
});
test("tokenizeYaml returns empty array for whitespace only", () => {
    assert.deepEqual(tokenizeYaml("   \n\t\n  "), []);
});
test("tokenizeYaml returns empty array for comment only", () => {
    assert.deepEqual(tokenizeYaml("# comment\n# another"), []);
});
test("tokenizeYaml filters blank lines but keeps subsequent content", () => {
    const result = tokenizeYaml("key1: value1\n\nkey2: value2");
    assert.equal(result.length, 2);
    assert.equal(result[0].text, "key1: value1");
    assert.equal(result[1].text, "key2: value2");
});
test("tokenizeYaml handles Windows line endings", () => {
    const result = tokenizeYaml("key1: value1\r\nkey2: value2");
    assert.equal(result.length, 2);
    assert.equal(result[0].text, "key1: value1");
    assert.equal(result[1].text, "key2: value2");
});
test("tokenizeYaml handles Unix line endings", () => {
    const result = tokenizeYaml("key1: value1\nkey2: value2");
    assert.equal(result.length, 2);
    assert.equal(result[0].text, "key1: value1");
    assert.equal(result[1].text, "key2: value2");
});
test("tokenizeYaml calculates correct indent for spaces", () => {
    const result = tokenizeYaml("  key: value");
    assert.equal(result[0].indent, 2);
});
test("tokenizeYaml calculates correct indent for zero spaces", () => {
    const result = tokenizeYaml("key: value");
    assert.equal(result[0].indent, 0);
});
test("tokenizeYaml preserves line numbers", () => {
    const result = tokenizeYaml("line1\n  line2\n    line3");
    assert.equal(result[0].lineNumber, 1);
    assert.equal(result[1].lineNumber, 2);
    assert.equal(result[2].lineNumber, 3);
});
test("tokenizeYaml filters out empty lines", () => {
    const result = tokenizeYaml("key1: value1\n\nkey2: value2");
    assert.equal(result.length, 2);
});
test("tokenizeYaml filters out comment lines", () => {
    const result = tokenizeYaml("key1: value1\n# comment\nkey2: value2");
    assert.equal(result.length, 2);
    assert.equal(result[1].text, "key2: value2");
});
test("tokenizeYaml trims whitespace from lines", () => {
    const result = tokenizeYaml("  key: value  ");
    assert.equal(result[0].text, "key: value");
});
test("looksLikeKeyValue returns true for key:value", () => {
    assert.equal(looksLikeKeyValue("key: value"), true);
});
test("looksLikeKeyValue returns true for text with colon", () => {
    assert.equal(looksLikeKeyValue("http://example.com"), true);
});
test("looksLikeKeyValue returns false for text without colon", () => {
    assert.equal(looksLikeKeyValue("just text"), false);
});
test("looksLikeKeyValue returns false for empty string", () => {
    assert.equal(looksLikeKeyValue(""), false);
});
test("parseScalar parses true boolean", () => {
    assert.equal(parseScalar("true"), true);
});
test("parseScalar parses false boolean", () => {
    assert.equal(parseScalar("false"), false);
});
test("parseScalar parses null", () => {
    assert.equal(parseScalar("null"), null);
});
test("parseScalar parses positive integer", () => {
    assert.equal(parseScalar("42"), 42);
});
test("parseScalar parses negative integer", () => {
    assert.equal(parseScalar("-42"), -42);
});
test("parseScalar parses positive number string", () => {
    assert.equal(parseScalar("123"), 123);
});
test("parseScalar parses empty array notation", () => {
    assert.deepEqual(parseScalar("[]"), []);
});
test("parseScalar parses array with single element", () => {
    assert.deepEqual(parseScalar("[item]"), ["item"]);
});
test("parseScalar parses array with multiple elements", () => {
    assert.deepEqual(parseScalar("[a, b, c]"), ["a", "b", "c"]);
});
test("parseScalar parses array with trimmed elements", () => {
    assert.deepEqual(parseScalar("[ a , b , c ]"), ["a", "b", "c"]);
});
test("parseScalar parses double-quoted string", () => {
    assert.equal(parseScalar('"hello"'), "hello");
});
test("parseScalar parses single-quoted string", () => {
    assert.equal(parseScalar("'hello'"), "hello");
});
test("parseScalar returns plain string when not special", () => {
    assert.equal(parseScalar("hello world"), "hello world");
});
test("parseScalar handles mixed case boolean strings as string", () => {
    assert.equal(parseScalar("True"), "True");
    assert.equal(parseScalar("FALSE"), "FALSE");
});
test("isPlainObject returns true for empty object", () => {
    assert.equal(isPlainObject({}), true);
});
test("isPlainObject returns true for non-empty object", () => {
    assert.equal(isPlainObject({ key: "value" }), true);
});
test("isPlainObject returns false for array", () => {
    assert.equal(isPlainObject([]), false);
});
test("isPlainObject returns false for null", () => {
    assert.equal(isPlainObject(null), false);
});
test("isPlainObject returns false for undefined", () => {
    assert.equal(isPlainObject(undefined), false);
});
test("isPlainObject returns false for string", () => {
    assert.equal(isPlainObject("string"), false);
});
test("isPlainObject returns false for number", () => {
    assert.equal(isPlainObject(42), false);
});
test("isPlainObject returns false for boolean", () => {
    assert.equal(isPlainObject(true), false);
});
test("splitKeyValue parses key and value", () => {
    const [key, value] = splitKeyValue("key: value", "/path", 1);
    assert.equal(key, "key");
    assert.equal(value, "value");
});
test("splitKeyValue trims whitespace", () => {
    const [key, value] = splitKeyValue("  key  :  value  ", "/path", 1);
    assert.equal(key, "key");
    assert.equal(value, "value");
});
test("splitKeyValue handles empty value", () => {
    const [key, value] = splitKeyValue("key:", "/path", 1);
    assert.equal(key, "key");
    assert.equal(value, "");
});
test("splitKeyValue handles value with colons", () => {
    const [key, value] = splitKeyValue("key: value:with:colons", "/path", 1);
    assert.equal(key, "key");
    assert.equal(value, "value:with:colons");
});
test("splitKeyValue throws for missing separator", () => {
    assert.throws(() => splitKeyValue("invalid", "/path", 1), /yaml.invalid_mapping/);
});
test("splitKeyValue throws for empty key", () => {
    assert.throws(() => splitKeyValue(": value", "/path", 1), /yaml.invalid_mapping/);
});
test("splitKeyValue throws for key with only whitespace", () => {
    assert.throws(() => splitKeyValue("   : value", "/path", 1), /yaml.invalid_mapping/);
});
test("expectNonEmptyString returns trimmed string", () => {
    assert.equal(expectNonEmptyString("  hello  ", "err"), "hello");
});
test("expectNonEmptyString throws for null", () => {
    assert.throws(() => expectNonEmptyString(null, "err"), /err/);
});
test("expectNonEmptyString throws for undefined", () => {
    assert.throws(() => expectNonEmptyString(undefined, "err"), /err/);
});
test("expectNonEmptyString throws for empty string", () => {
    assert.throws(() => expectNonEmptyString("", "err"), /err/);
});
test("expectNonEmptyString throws for whitespace-only string", () => {
    assert.throws(() => expectNonEmptyString("   ", "err"), /err/);
});
test("expectNonEmptyString throws for non-string", () => {
    assert.throws(() => expectNonEmptyString(42, "err"), /err/);
});
test("expectNonEmptyString throws for object", () => {
    assert.throws(() => expectNonEmptyString({}, "err"), /err/);
});
test("toObjectArray filters array to plain objects", () => {
    const input = [{ a: 1 }, "string", { b: 2 }, 42, { c: 3 }];
    assert.deepEqual(toObjectArray(input), [{ a: 1 }, { b: 2 }, { c: 3 }]);
});
test("toObjectArray returns empty array for non-array", () => {
    assert.deepEqual(toObjectArray(null), []);
    assert.deepEqual(toObjectArray("string"), []);
    assert.deepEqual(toObjectArray(42), []);
});
test("toObjectArray returns empty array for empty array", () => {
    assert.deepEqual(toObjectArray([]), []);
});
test("toObjectArray handles mixed valid and invalid", () => {
    const input = [{}, "a", [], { key: "value" }, 123];
    assert.deepEqual(toObjectArray(input), [{}, { key: "value" }]);
});
test("toStringArray filters and trims strings", () => {
    const input = ["  a  ", "b", null, " c ", 42, undefined, "d"];
    assert.deepEqual(toStringArray(input), ["a", "b", "c", "d"]);
});
test("toStringArray returns empty array for non-array", () => {
    assert.deepEqual(toStringArray(null), []);
    assert.deepEqual(toStringArray(42), []);
});
test("toStringArray returns empty array for empty array", () => {
    assert.deepEqual(toStringArray([]), []);
});
test("toStringArray filters out empty strings after trim", () => {
    const input = ["a", "  ", "b", ""];
    assert.deepEqual(toStringArray(input), ["a", "b"]);
});
test("toInteger returns integer values", () => {
    assert.equal(toInteger(42, 0), 42);
    assert.equal(toInteger(-5, 0), -5);
    assert.equal(toInteger(0, 99), 0);
});
test("toInteger parses string integers", () => {
    assert.equal(toInteger("42", 0), 42);
    assert.equal(toInteger("  -5  ", 0), -5);
    assert.equal(toInteger("0", 99), 0);
});
test("toInteger returns fallback for non-integer numbers", () => {
    assert.equal(toInteger(3.14, 0), 0);
    assert.equal(toInteger(NaN, 0), 0);
    assert.equal(toInteger(Infinity, 0), 0);
});
test("toInteger returns fallback for non-numeric strings", () => {
    assert.equal(toInteger("hello", 0), 0);
    assert.equal(toInteger("3.14", 0), 0);
    assert.equal(toInteger("", 0), 0);
});
test("toInteger returns fallback for non-string non-number", () => {
    assert.equal(toInteger(null, 0), 0);
    assert.equal(toInteger(undefined, 0), 0);
    assert.equal(toInteger({}, 0), 0);
    assert.equal(toInteger([], 0), 0);
});
test("toInteger uses provided fallback type", () => {
    assert.equal(toInteger("invalid", "fallback"), "fallback");
    assert.equal(toInteger(null, "fallback"), "fallback");
});
test("parseLimitedYaml parses empty string as empty object", () => {
    assert.deepEqual(parseLimitedYaml("", "/path"), {});
});
test("parseLimitedYaml parses single key-value", () => {
    assert.deepEqual(parseLimitedYaml("key: value", "/path"), { key: "value" });
});
test("parseLimitedYaml parses nested object", () => {
    const yaml = `name: Test
config:
  option1: a
  option2: b`;
    const result = parseLimitedYaml(yaml, "/path");
    assert.deepEqual(result, {
        name: "Test",
        config: {
            option1: "a",
            option2: "b",
        },
    });
});
test("parseLimitedYaml parses array", () => {
    const yaml = `- item1
- item2
- item3`;
    const result = parseLimitedYaml(yaml, "/path");
    assert.deepEqual(result, ["item1", "item2", "item3"]);
});
test("parseLimitedYaml parses array of objects", () => {
    const yaml = `- name: first
  value: 1
- name: second
  value: 2`;
    const result = parseLimitedYaml(yaml, "/path");
    assert.deepEqual(result, [
        { name: "first", value: 1 },
        { name: "second", value: 2 },
    ]);
});
test("parseLimitedYaml parses multiple key-value pairs at same indent", () => {
    const yaml = `key: value
extra: alsoallowed`;
    const result = parseLimitedYaml(yaml, "/path");
    assert.deepEqual(result, { key: "value", extra: "alsoallowed" });
});
test("parseBlock returns empty object for indent less than required", () => {
    const lines = [
        { indent: 0, text: "key: value", lineNumber: 1 },
    ];
    const [value, index] = parseBlock(lines, 0, 5, "/path");
    assert.deepEqual(value, {});
    assert.equal(index, 0);
});
test("parseBlock parses object at correct indent", () => {
    const lines = [
        { indent: 0, text: "key: value", lineNumber: 1 },
    ];
    const [value, index] = parseBlock(lines, 0, 0, "/path");
    assert.deepEqual(value, { key: "value" });
    assert.equal(index, 1);
});
test("parseBlock parses array at correct indent", () => {
    const lines = [
        { indent: 0, text: "- item1", lineNumber: 1 },
        { indent: 0, text: "- item2", lineNumber: 2 },
    ];
    const [value, index] = parseBlock(lines, 0, 0, "/path");
    assert.deepEqual(value, ["item1", "item2"]);
    assert.equal(index, 2);
});
test("parseObject parses key-value pairs", () => {
    const lines = [
        { indent: 0, text: "key1: value1", lineNumber: 1 },
        { indent: 0, text: "key2: value2", lineNumber: 2 },
    ];
    const [result, index] = parseObject(lines, 0, 0, "/path");
    assert.deepEqual(result, { key1: "value1", key2: "value2" });
    assert.equal(index, 2);
});
test("parseObject handles inline values", () => {
    const lines = [
        { indent: 0, text: "key1: value1", lineNumber: 1 },
        { indent: 0, text: "key2:", lineNumber: 2 },
        { indent: 0, text: "key3: value3", lineNumber: 3 },
    ];
    const [result, index] = parseObject(lines, 0, 0, "/path");
    assert.deepEqual(result, { key1: "value1", key2: null, key3: "value3" });
    assert.equal(index, 3);
});
test("parseArray parses simple items", () => {
    const lines = [
        { indent: 0, text: "- item1", lineNumber: 1 },
        { indent: 0, text: "- item2", lineNumber: 2 },
    ];
    const [result, index] = parseArray(lines, 0, 0, "/path");
    assert.deepEqual(result, ["item1", "item2"]);
    assert.equal(index, 2);
});
test("parseArray requires lines to start with '- ' prefix", () => {
    // parseArray checks if text starts with "- ", if not it breaks
    const lines = [
        { indent: 0, text: "- item1", lineNumber: 1 },
        { indent: 0, text: "- item2", lineNumber: 2 },
    ];
    const [result, index] = parseArray(lines, 0, 0, "/path");
    assert.deepEqual(result, ["item1", "item2"]);
    assert.equal(index, 2);
});
test("parseArray breaks on non-array line", () => {
    const lines = [
        { indent: 0, text: "key: value", lineNumber: 1 },
    ];
    const [result, index] = parseArray(lines, 0, 0, "/path");
    assert.deepEqual(result, []);
    assert.equal(index, 0);
});
test("parseArray throws when indent exceeds allowed", () => {
    const lines = [
        { indent: 5, text: "- item", lineNumber: 1 },
    ];
    assert.throws(() => parseArray(lines, 0, 0, "/path"), /yaml.invalid_indent/);
});
test("throwDivisionValidationError throws ValidationError", () => {
    assert.throws(() => throwDivisionValidationError("test.code", { extra: "data" }), {
        name: "ValidationError",
        code: "test.code",
    });
});
test("throwDivisionWorkflowError throws WorkflowStateError", () => {
    assert.throws(() => throwDivisionWorkflowError("test.code", { extra: "data" }), {
        name: "WorkflowStateError",
        code: "test.code",
    });
});
test("throwDivisionSandboxError throws SandboxError", () => {
    assert.throws(() => throwDivisionSandboxError("test.code", { extra: "data" }), {
        name: "SandboxError",
        code: "test.code",
    });
});
test("ParsedLine interface structure", () => {
    const line = { indent: 2, text: "key: value", lineNumber: 5 };
    assert.equal(line.indent, 2);
    assert.equal(line.text, "key: value");
    assert.equal(line.lineNumber, 5);
});
//# sourceMappingURL=division-loader-support.test.js.map