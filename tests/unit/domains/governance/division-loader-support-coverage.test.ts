import { describe, it, expect } from "node:test";
import {
  tokenizeYaml,
  parseLimitedYaml,
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
} from "../../../../../src/domains/governance/division-loader-support.js";

describe("division-loader-support", () => {
  describe("tokenizeYaml", () => {
    it("should parse simple key-value pairs", () => {
      const lines = tokenizeYaml("key: value");
      expect(lines).toHaveLength(1);
      expect(lines[0]!.text).toBe("key: value");
      expect(lines[0]!.indent).toBe(0);
      expect(lines[0]!.lineNumber).toBe(1);
    });

    it("should track line numbers correctly", () => {
      const lines = tokenizeYaml("key1: value1\nkey2: value2");
      expect(lines).toHaveLength(2);
      expect(lines[0]!.lineNumber).toBe(1);
      expect(lines[1]!.lineNumber).toBe(2);
    });

    it("should calculate indentation correctly", () => {
      const lines = tokenizeYaml("  key: value");
      expect(lines).toHaveLength(1);
      expect(lines[0]!.indent).toBe(2);
    });

    it("should skip empty lines", () => {
      const lines = tokenizeYaml("key1: value1\n\nkey2: value2");
      expect(lines).toHaveLength(2);
    });

    it("should skip comment lines", () => {
      const lines = tokenizeYaml("key: value\n# this is a comment\nkey2: value2");
      expect(lines).toHaveLength(2);
    });

    it("should handle mixed indentation", () => {
      const yaml = "root:\n  child1: value1\n    grandchild: value2\n  child2: value2";
      const lines = tokenizeYaml(yaml);
      expect(lines).toHaveLength(4);
      expect(lines[0]!.indent).toBe(0);
      expect(lines[1]!.indent).toBe(2);
      expect(lines[2]!.indent).toBe(4);
      expect(lines[3]!.indent).toBe(2);
    });
  });

  describe("parseScalar", () => {
    it("should parse true boolean", () => {
      expect(parseScalar("true")).toBe(true);
    });

    it("should parse false boolean", () => {
      expect(parseScalar("false")).toBe(false);
    });

    it("should parse null", () => {
      expect(parseScalar("null")).toBe(null);
    });

    it("should parse positive integers", () => {
      expect(parseScalar("123")).toBe(123);
    });

    it("should parse negative integers", () => {
      expect(parseScalar("-456")).toBe(-456);
    });

    it("should parse quoted strings with double quotes", () => {
      expect(parseScalar('"hello world"')).toBe("hello world");
    });

    it("should parse quoted strings with single quotes", () => {
      expect(parseScalar("'hello world'")).toBe("hello world");
    });

    it("should parse arrays in bracket notation", () => {
      const result = parseScalar("[a, b, c]");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should handle empty arrays", () => {
      expect(parseScalar("[]")).toEqual([]);
    });

    it("should return raw string for unquoted values", () => {
      expect(parseScalar("some_text")).toBe("some_text");
    });
  });

  describe("looksLikeKeyValue", () => {
    it("should return true for key-value format", () => {
      expect(looksLikeKeyValue("key: value")).toBe(true);
    });

    it("should return false for array items", () => {
      expect(looksLikeKeyValue("- item")).toBe(false);
    });

    it("should return true for complex key-value", () => {
      expect(looksLikeKeyValue("nested: key: value")).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(looksLikeKeyValue("plain text without colon")).toBe(false);
    });
  });

  describe("splitKeyValue", () => {
    it("should split key and value", () => {
      const [key, value] = splitKeyValue("key: value", "test.yaml", 1);
      expect(key).toBe("key");
      expect(value).toBe("value");
    });

    it("should handle values with colons", () => {
      const [key, value] = splitKeyValue("key: http://example.com", "test.yaml", 1);
      expect(key).toBe("key");
      expect(value).toBe("http://example.com");
    });

    it("should trim whitespace from key and value", () => {
      const [key, value] = splitKeyValue("  key  :  value  ", "test.yaml", 1);
      expect(key).toBe("key");
      expect(value).toBe("value");
    });

    it("should throw for missing separator", () => {
      expect(() => splitKeyValue("invalid line", "test.yaml", 1)).toThrow();
    });

    it("should throw for empty key", () => {
      expect(() => splitKeyValue(": value", "test.yaml", 1)).toThrow();
    });
  });

  describe("isPlainObject", () => {
    it("should return true for plain objects", () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ key: "value" })).toBe(true);
    });

    it("should return false for arrays", () => {
      expect(isPlainObject([])).toBe(false);
    });

    it("should return false for null", () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isPlainObject("string")).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
    });
  });

  describe("expectNonEmptyString", () => {
    it("should return trimmed string for valid input", () => {
      expect(expectNonEmptyString("  hello  ", "err")).toBe("hello");
    });

    it("should throw for empty string", () => {
      expect(() => expectNonEmptyString("", "err")).toThrow();
    });

    it("should throw for whitespace only", () => {
      expect(() => expectNonEmptyString("   ", "err")).toThrow();
    });

    it("should throw for non-string values", () => {
      expect(() => expectNonEmptyString(123, "err")).toThrow();
    });
  });

  describe("toObjectArray", () => {
    it("should convert array of objects", () => {
      const input = [{ a: 1 }, { b: 2 }];
      expect(toObjectArray(input)).toEqual(input);
    });

    it("should filter out non-objects", () => {
      const input = [{ a: 1 }, "string", { b: 2 }, null];
      expect(toObjectArray(input)).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it("should return empty array for non-array input", () => {
      expect(toObjectArray("string")).toEqual([]);
      expect(toObjectArray(null)).toEqual([]);
      expect(toObjectArray(123)).toEqual([]);
    });
  });

  describe("toStringArray", () => {
    it("should convert array of strings", () => {
      const input = ["a", "b", "c"];
      expect(toStringArray(input)).toEqual(["a", "b", "c"]);
    });

    it("should filter non-strings and trim", () => {
      const input = ["  a  ", "b", 123, " c "];
      expect(toStringArray(input)).toEqual(["a", "b", "c"]);
    });

    it("should filter empty strings", () => {
      const input = ["a", "", "  ", "b"];
      expect(toStringArray(input)).toEqual(["a", "b"]);
    });

    it("should return empty array for non-array input", () => {
      expect(toStringArray(null)).toEqual([]);
      expect(toStringArray(123)).toEqual([]);
    });
  });

  describe("toInteger", () => {
    it("should return integer values unchanged", () => {
      expect(toInteger(42, 0)).toBe(42);
    });

    it("should parse string integers", () => {
      expect(toInteger("42", 0)).toBe(42);
      expect(toInteger("-17", 0)).toBe(-17);
    });

    it("should return fallback for non-integer numbers", () => {
      expect(toInteger(3.14, 0)).toBe(0);
    });

    it("should return fallback for non-parseable strings", () => {
      expect(toInteger("not a number", 99)).toBe(99);
    });

    it("should return fallback for null/undefined", () => {
      expect(toInteger(null, 99)).toBe(99);
      expect(toInteger(undefined, 99)).toBe(99);
    });
  });

  describe("parseObject", () => {
    it("should parse simple object", () => {
      const lines = tokenizeYaml("key1: value1\nkey2: value2");
      const [result] = parseObject(lines, 0, 0, "test.yaml");
      expect(result).toEqual({ key1: "value1", key2: "value2" });
    });

    it("should handle nested objects", () => {
      const yaml = "outer:\n  inner: value";
      const lines = tokenizeYaml(yaml);
      const [result] = parseObject(lines, 0, 0, "test.yaml");
      expect(result).toEqual({ outer: { inner: "value" } });
    });

    it("should handle nested arrays", () => {
      const yaml = "items:\n  - item1\n  - item2";
      const lines = tokenizeYaml(yaml);
      const [result] = parseObject(lines, 0, 0, "test.yaml");
      expect(result).toEqual({ items: ["item1", "item2"] });
    });
  });

  describe("parseArray", () => {
    it("should parse simple array", () => {
      const lines = tokenizeYaml("- item1\n- item2");
      const [result] = parseArray(lines, 0, 0, "test.yaml");
      expect(result).toEqual(["item1", "item2"]);
    });

    it("should parse array of objects", () => {
      const lines = tokenizeYaml("- key: value1\n- key: value2");
      const [result] = parseArray(lines, 0, 0, "test.yaml");
      expect(result).toEqual([{ key: "value1" }, { key: "value2" }]);
    });

    it("should handle empty items", () => {
      const lines = tokenizeYaml("- \n- item2");
      const [result] = parseArray(lines, 0, 0, "test.yaml");
      expect(result[0]).toBe(null);
      expect(result[1]).toBe("item2");
    });
  });

  describe("parseLimitedYaml", () => {
    it("should parse empty yaml as empty object", () => {
      expect(parseLimitedYaml("", "test.yaml")).toEqual({});
    });

    it("should parse simple yaml", () => {
      const result = parseLimitedYaml("key: value", "test.yaml");
      expect(result).toEqual({ key: "value" });
    });

    it("should reject trailing content", () => {
      expect(() => parseLimitedYaml("key: value\ntrailing: content", "test.yaml")).toThrow();
    });
  });
});