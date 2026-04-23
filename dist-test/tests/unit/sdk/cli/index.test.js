import assert from "node:assert/strict";
import test from "node:test";
import { CLI_ENTRYPOINTS, } from "../../../../src/sdk/cli/index.js";
test("sdk cli barrel exposes the entrypoint manifest", () => {
    assert.ok(CLI_ENTRYPOINTS.includes("doctor"));
    assert.ok(CLI_ENTRYPOINTS.includes("dispatch-execution"));
    assert.ok(CLI_ENTRYPOINTS.includes("worker-writeback"));
});
//# sourceMappingURL=index.test.js.map