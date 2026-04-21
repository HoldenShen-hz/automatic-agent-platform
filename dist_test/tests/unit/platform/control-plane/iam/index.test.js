import assert from "node:assert/strict";
import test from "node:test";
test("SandboxMode type accepts valid values", () => {
    const modes = ["read_only", "workspace_write", "danger_full_access"];
    assert.equal(modes.length, 3);
});
test("SymlinkPolicy type accepts valid values", () => {
    const policies = ["deny", "allow_explicit"];
    assert.equal(policies.length, 2);
});
test("ProcessRuleMode type accepts valid values", () => {
    const modes = ["allow", "deny"];
    assert.equal(modes.length, 2);
});
test("SandboxPolicy structure is correct", () => {
    const policy = {
        policyId: "test_policy",
        mode: "read_only",
        allowedRoots: ["/workspace"],
        deniedRoots: ["/system"],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "deny",
    };
    assert.equal(policy.policyId, "test_policy");
    assert.equal(policy.mode, "read_only");
    assert.equal(policy.realpathEnforced, true);
});
test("SandboxPathCheckResult structure is correct", () => {
    const result = {
        allowed: true,
        normalizedPath: "/workspace/src/index.ts",
        reasonCode: null,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.normalizedPath, "/workspace/src/index.ts");
    assert.equal(result.reasonCode, null);
});
test("SandboxPathCheckResult for disallowed path", () => {
    const result = {
        allowed: false,
        normalizedPath: "/etc/passwd",
        reasonCode: "sandbox.path_denied",
    };
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "sandbox.path_denied");
});
//# sourceMappingURL=index.test.js.map