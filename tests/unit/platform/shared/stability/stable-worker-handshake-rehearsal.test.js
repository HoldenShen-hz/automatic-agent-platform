import assert from "node:assert/strict";
import test from "node:test";
import * as stabilityStableWorkerHandshakeRehearsal from "../../../../../src/platform/shared/stability/stable-worker-handshake-rehearsal.js";
test("stable-worker-handshake-rehearsal module exports something", () => {
    const exports = Object.keys(stabilityStableWorkerHandshakeRehearsal);
    assert.ok(exports.length > 0, "stable-worker-handshake-rehearsal should export something");
});
test("stable-worker-handshake-rehearsal module exports StableWorkerHandshakeRehearsalService or similar", () => {
    // Check for any export that contains "Handshake" or "Rehearsal"
    const exports = Object.keys(stabilityStableWorkerHandshakeRehearsal);
    const hasRelevantExport = exports.some(e => e.includes("Handshake") || e.includes("Rehearsal"));
    assert.ok(hasRelevantExport, `Expected export containing 'Handshake' or 'Rehearsal', got: ${exports.join(", ")}`);
});
//# sourceMappingURL=stable-worker-handshake-rehearsal.test.js.map