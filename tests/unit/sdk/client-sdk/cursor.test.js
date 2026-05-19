import assert from "node:assert/strict";
import test from "node:test";
import { parseCursor, encodeCursor } from "../../../../src/sdk/client-sdk/api-client.js";
test("parseCursor decodes valid base64 cursor", () => {
    const encoded = Buffer.from(JSON.stringify({ cursor: "page-123", limit: 50 })).toString("base64");
    const result = parseCursor(encoded);
    assert.deepEqual(result, { cursor: "page-123", limit: 50 });
});
test("parseCursor returns undefined for null input", () => {
    assert.equal(parseCursor(null), undefined);
});
test("parseCursor returns undefined for undefined input", () => {
    assert.equal(parseCursor(undefined), undefined);
});
test("parseCursor returns undefined for empty string", () => {
    assert.equal(parseCursor(""), undefined);
});
test("parseCursor returns undefined for invalid base64", () => {
    assert.equal(parseCursor("not-valid-base64!!!"), undefined);
});
test("parseCursor returns undefined for valid base64 but invalid JSON", () => {
    const invalidJson = Buffer.from("this is not json").toString("base64");
    assert.equal(parseCursor(invalidJson), undefined);
});
test("encodeCursor produces valid base64", () => {
    const cursor = { cursor: "test-cursor", limit: 25 };
    const encoded = encodeCursor(cursor);
    assert.ok(encoded.length > 0);
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    assert.deepEqual(JSON.parse(decoded), cursor);
});
test("encodeCursor handles cursor-only spec", () => {
    const cursor = { cursor: "next-page" };
    const encoded = encodeCursor(cursor);
    const decoded = parseCursor(encoded);
    assert.deepEqual(decoded, { cursor: "next-page" });
});
test("encodeCursor handles limit-only spec", () => {
    const cursor = { limit: 100 };
    const encoded = encodeCursor(cursor);
    const decoded = parseCursor(encoded);
    assert.deepEqual(decoded, { limit: 100 });
});
test("parseCursor and encodeCursor are reversible", () => {
    const original = { cursor: "round-trip-cursor", limit: 75 };
    const encoded = encodeCursor(original);
    const decoded = parseCursor(encoded);
    assert.deepEqual(decoded, original);
});
test("encodeCursor handles empty spec", () => {
    const cursor = {};
    const encoded = encodeCursor(cursor);
    const decoded = parseCursor(encoded);
    assert.deepEqual(decoded, {});
});
test("parseCursor handles cursor with special characters", () => {
    const original = { cursor: "page-abc-123_456", limit: 10 };
    const encoded = encodeCursor(original);
    const decoded = parseCursor(encoded);
    assert.deepEqual(decoded, original);
});
//# sourceMappingURL=cursor.test.js.map