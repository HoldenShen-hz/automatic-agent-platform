import assert from "node:assert/strict";
import test from "node:test";
test("SandboxMode accepts all valid values", () => {
    const modes = ["read_only", "workspace_write", "danger_full_access"];
    assert.equal(modes.length, 3);
});
test("SymlinkPolicy accepts all valid values", () => {
    const policies = ["deny", "allow_explicit"];
    assert.equal(policies.length, 2);
});
test("ProcessRuleMode accepts all valid values", () => {
    const modes = ["allow", "deny"];
    assert.equal(modes.length, 2);
});
test("SandboxPolicy structure is correct", () => {
    const policy = {
        policyId: "policy_123",
        mode: "workspace_write",
        allowedRoots: ["/workspace", "/tmp"],
        deniedRoots: ["/etc", "/root"],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "deny",
    };
    assert.equal(policy.policyId, "policy_123");
    assert.equal(policy.mode, "workspace_write");
    assert.deepEqual(policy.allowedRoots, ["/workspace", "/tmp"]);
});
test("SandboxPolicy allows read_only mode", () => {
    const policy = {
        policyId: "policy_readonly",
        mode: "read_only",
        allowedRoots: ["/workspace"],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "allow",
    };
    assert.equal(policy.mode, "read_only");
    assert.equal(policy.deniedRoots.length, 0);
});
test("SandboxPolicy allows danger_full_access mode", () => {
    const policy = {
        policyId: "policy_danger",
        mode: "danger_full_access",
        allowedRoots: ["/"],
        deniedRoots: [],
        realpathEnforced: false,
        symlinkPolicy: "allow_explicit",
        processRuleMode: "allow",
    };
    assert.equal(policy.mode, "danger_full_access");
    assert.equal(policy.realpathEnforced, false);
});
test("SandboxPolicy allows empty deniedRoots", () => {
    const policy = {
        policyId: "policy_minimal",
        mode: "read_only",
        allowedRoots: ["/workspace"],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "deny",
    };
    assert.deepEqual(policy.deniedRoots, []);
});
test("SandboxPathCheckResult structure for allowed path", () => {
    const result = {
        allowed: true,
        normalizedPath: "/workspace/project/file.txt",
        reasonCode: null,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.normalizedPath, "/workspace/project/file.txt");
    assert.equal(result.reasonCode, null);
});
test("SandboxPathCheckResult structure for denied path", () => {
    const result = {
        allowed: false,
        normalizedPath: "/etc/passwd",
        reasonCode: "path_denied",
    };
    assert.equal(result.allowed, false);
    assert.equal(result.normalizedPath, "/etc/passwd");
    assert.equal(result.reasonCode, "path_denied");
});
test("SandboxPathCheckResult reasonCode is null when allowed", () => {
    const result = {
        allowed: true,
        normalizedPath: "/workspace/allowed.txt",
        reasonCode: null,
    };
    assert.equal(result.reasonCode, null);
});
test("SandboxPathCheckResult reasonCode can be path_traversal", () => {
    const result = {
        allowed: false,
        normalizedPath: "/workspace/../../../etc/passwd",
        reasonCode: "path_traversal_detected",
    };
    assert.equal(result.reasonCode, "path_traversal_detected");
});
test("SandboxPathCheckResult reasonCode can be symlink_escape", () => {
    const result = {
        allowed: false,
        normalizedPath: "/real/path/here",
        reasonCode: "symlink_escape_attempt",
    };
    assert.equal(result.reasonCode, "symlink_escape_attempt");
});
test("SandboxPathCheckResult reasonCode can be outside_allowed_roots", () => {
    const result = {
        allowed: false,
        normalizedPath: "/forbidden/file.txt",
        reasonCode: "outside_allowed_roots",
    };
    assert.equal(result.reasonCode, "outside_allowed_roots");
});
//# sourceMappingURL=sandbox-policy-types.test.js.map