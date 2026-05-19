import assert from "node:assert/strict";
import test from "node:test";
import { CLI_ENTRYPOINTS, } from "../../../../src/sdk/cli/index.js";
import { deriveCliWorkspaceRoot, resolveCliDbPath, describeCliAuthoritativeStoragePlan, assertCliAuthoritativeStorageExecutable, } from "../../../../src/sdk/cli/authoritative-storage.js";
test("CLI_ENTRYPOINTS exports expected entrypoints", () => {
    assert.ok(CLI_ENTRYPOINTS.length > 0, "CLI_ENTRYPOINTS should not be empty");
    assert.ok(CLI_ENTRYPOINTS.includes("platform-operator"));
    assert.ok(CLI_ENTRYPOINTS.includes("authoritative-storage"));
    assert.ok(CLI_ENTRYPOINTS.includes("doctor"));
    assert.ok(CLI_ENTRYPOINTS.includes("inspect"));
});
test("CLI_ENTRYPOINTS contains only string values", () => {
    for (const entrypoint of CLI_ENTRYPOINTS) {
        assert.equal(typeof entrypoint, "string");
        assert.ok(entrypoint.length > 0, `Entry point "${entrypoint}" should not be empty`);
    }
});
test("CliEntrypoint type accepts valid entrypoints", () => {
    const validEntrypoint = "platform-operator";
    assert.equal(validEntrypoint, "platform-operator");
});
test("CLI_ENTRYPOINTS includes critical operational commands", () => {
    const criticalCommands = [
        "platform-operator",
        "authoritative-storage",
        "authoritative-storage-admin",
        "worker-register",
        "worker-handshake",
        "dispatch-execution",
        "diagnostics",
        "doctor",
        "repair",
    ];
    for (const cmd of criticalCommands) {
        assert.ok(CLI_ENTRYPOINTS.includes(cmd), `Critical command "${cmd}" should be in CLI_ENTRYPOINTS`);
    }
});
test("CLI_ENTRYPOINTS includes stability and testing commands", () => {
    const stabilityCommands = CLI_ENTRYPOINTS.filter((e) => e.startsWith("stable-"));
    assert.ok(stabilityCommands.length > 0, "Should have stability commands");
    const testingCommands = CLI_ENTRYPOINTS.filter((e) => e.includes("demo") || e.includes("test"));
    assert.ok(testingCommands.length > 0, "Should have demo/testing commands");
});
test("deriveCliWorkspaceRoot handles standard layout", () => {
    const workspace = deriveCliWorkspaceRoot("/workspace/data/sqlite/authoritative.db");
    assert.equal(workspace, "/workspace");
});
test("deriveCliWorkspaceRoot handles fallback to db directory", () => {
    const dir = deriveCliWorkspaceRoot("/custom/path/mydb.db");
    assert.equal(dir, "/custom/path");
});
test("deriveCliWorkspaceRoot handles nested sqlite directory", () => {
    const workspace = deriveCliWorkspaceRoot("/var/data/sqlite/prod.db");
    assert.equal(workspace, "/var");
});
test("resolveCliDbPath returns a string path", () => {
    const path = resolveCliDbPath();
    assert.equal(typeof path, "string");
    assert.ok(path.length > 0);
    assert.ok(path.endsWith(".db"), "Should return a path ending in .db");
});
test("describeCliAuthoritativeStoragePlan returns storage plan", () => {
    const plan = describeCliAuthoritativeStoragePlan();
    assert.ok(plan != null);
    assert.ok("runtimeProfile" in plan);
    assert.ok("executable" in plan);
});
test("assertCliAuthoritativeStorageExecutable does not throw for valid path", () => {
    assert.doesNotThrow(() => {
        assertCliAuthoritativeStorageExecutable();
    });
});
test("CLI_ENTRYPOINTS has no duplicate entrypoints", () => {
    const seen = new Set();
    for (const entrypoint of CLI_ENTRYPOINTS) {
        assert.ok(!seen.has(entrypoint), `Duplicate entrypoint found: ${entrypoint}`);
        seen.add(entrypoint);
    }
});
//# sourceMappingURL=cli-command.test.js.map