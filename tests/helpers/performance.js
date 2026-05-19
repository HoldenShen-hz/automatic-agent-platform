import assert from "node:assert/strict";
export function reportSoftPerformanceMiss(t, error) {
    if (error instanceof assert.AssertionError) {
        t.diagnostic(`performance soft miss: ${error.message}`);
        return;
    }
    throw error;
}
export function failOnListenSocketDenied(error) {
    if (error.code === "EPERM") {
        assert.fail("local listen sockets are required for this network-path test");
    }
    throw error;
}
//# sourceMappingURL=performance.js.map