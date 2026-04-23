import test from "node:test";
import assert from "node:assert/strict";
// Validator for runtime messages
function isValidMessage(msg) {
    if (typeof msg !== "object" || msg === null)
        return false;
    const m = msg;
    if (m.type === "ready")
        return typeof m.pid === "number";
    if (m.type === "response") {
        return typeof m.requestId === "string" && typeof m.ok === "boolean" && typeof m.pid === "number";
    }
    return false;
}
test("PluginRuntimeMessage parses ready message", () => {
    const input = { type: "ready", pid: 12345 };
    assert.equal(input.type, "ready");
    assert.equal(input.pid, 12345);
    assert.ok(isValidMessage(input));
});
test("PluginRuntimeMessage parses response message", () => {
    const input = { type: "response", requestId: "req_1", ok: true, pid: 12345, result: { data: "test" } };
    assert.equal(input.type, "response");
    assert.equal(input.ok, true);
    assert.ok(isValidMessage(input));
});
test("PluginRuntimeMessage parses error response", () => {
    const input = { type: "response", requestId: "req_1", ok: false, pid: 12345, error: { name: "Error", message: "Something went wrong" } };
    assert.equal(input.ok, false);
    assert.equal(input.error?.name, "Error");
    assert.ok(isValidMessage(input));
});
test("isValidMessage rejects invalid type", () => {
    const invalid = { type: "invalid", pid: 12345 };
    assert.ok(!isValidMessage(invalid));
});
test("isValidMessage rejects missing pid", () => {
    const invalid = { type: "ready" };
    assert.ok(!isValidMessage(invalid));
});
//# sourceMappingURL=plugin-runtime-child.test.js.map