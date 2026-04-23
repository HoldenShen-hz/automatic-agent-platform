import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMetadata, requireNonEmpty, readTrackedDeliveryPayload } from "../../../../../src/platform/interface/channel-gateway/helpers.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

describe("channel-gateway/helpers", () => {
  describe("parseMetadata", () => {
    it("should return empty object for null", () => {
      assert.deepEqual(parseMetadata(null), {});
    });

    it("should return empty object for invalid JSON", () => {
      assert.deepEqual(parseMetadata("not valid json"), {});
    });

    it("should parse valid JSON object", () => {
      const result = parseMetadata('{"key": "value", "num": 123}');
      assert.equal(result.key, "value");
      assert.equal(result.num, 123);
    });

    it("should return empty object for arrays", () => {
      assert.deepEqual(parseMetadata('["a", "b"]'), {});
    });

    it("should return empty object for non-object JSON (string)", () => {
      assert.deepEqual(parseMetadata('"just a string"'), {});
    });

    it("should return empty object for null JSON", () => {
      assert.deepEqual(parseMetadata("null"), {});
    });

    it("should return empty object for numbers", () => {
      assert.deepEqual(parseMetadata("123"), {});
    });
  });

  describe("requireNonEmpty", () => {
    it("should return trimmed non-empty string", () => {
      assert.equal(requireNonEmpty("  hello  ", "test.code"), "hello");
    });

    it("should throw ValidationError for empty string", () => {
      assert.throws(() => requireNonEmpty("", "test.code"), ValidationError);
    });

    it("should throw ValidationError for whitespace-only string", () => {
      assert.throws(() => requireNonEmpty("   ", "test.code"), ValidationError);
    });

    it("should use provided error code", () => {
      try {
        requireNonEmpty("", "my.error.code");
      } catch (e) {
        assert.equal((e as ValidationError).code, "my.error.code");
      }
    });
  });

  describe("readTrackedDeliveryPayload", () => {
    it("should return valid payload", () => {
      const payload = { targetId: "tgt-123", text: "Hello world", metadata: { key: "value" } };
      const result = readTrackedDeliveryPayload(payload);
      assert.ok(result !== null);
      assert.equal(result?.targetId, "tgt-123");
      assert.equal(result?.text, "Hello world");
      assert.deepEqual(result?.metadata, { key: "value" });
    });

    it("should return null if targetId is missing", () => {
      const payload = { text: "Hello" };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return null if targetId is empty string", () => {
      const payload = { targetId: "", text: "Hello" };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return null if targetId is whitespace", () => {
      const payload = { targetId: "   ", text: "Hello" };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return null if text is missing", () => {
      const payload = { targetId: "tgt-123" };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return null if text is empty string", () => {
      const payload = { targetId: "tgt-123", text: "" };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return null if metadata is not an object", () => {
      const payload = { targetId: "tgt-123", text: "Hello", metadata: "string" };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return null if metadata is an array", () => {
      const payload = { targetId: "tgt-123", text: "Hello", metadata: [1, 2, 3] };
      assert.equal(readTrackedDeliveryPayload(payload), null);
    });

    it("should return payload without metadata if metadata is null", () => {
      const payload = { targetId: "tgt-123", text: "Hello", metadata: null };
      const result = readTrackedDeliveryPayload(payload);
      assert.ok(result !== null);
      assert.equal(result?.targetId, "tgt-123");
      assert.equal(result?.text, "Hello");
      assert.ok(!("metadata" in result!));
    });

    it("should include metadata when provided as valid object", () => {
      const payload = { targetId: "tgt-123", text: "Hello", metadata: { nested: { deep: true } } };
      const result = readTrackedDeliveryPayload(payload);
      assert.ok(result !== null);
      assert.deepEqual(result?.metadata, { nested: { deep: true } });
    });
  });
});
