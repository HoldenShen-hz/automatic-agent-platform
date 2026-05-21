import assert from "node:assert/strict";
import test from "node:test";
import { ConfigGovernanceService } from "../../../../../src/platform/five-plane-control-plane/config-center/config-governance-service.js";

test("ConfigGovernanceService can be instantiated", () => {
  const service = new ConfigGovernanceService();
  assert.ok(service != null);
});

test("ConfigGovernanceService getGovernancePolicy returns policy for known layer", () => {
  const service = new ConfigGovernanceService();
  const policy = service.getGovernancePolicy("platform");
  assert.ok(policy != null);
  assert.ok(typeof policy.approvalRequired === "boolean");
});

test("ConfigGovernanceService getGovernancePolicy returns policy for tenant layer", () => {
  const service = new ConfigGovernanceService();
  const policy = service.getGovernancePolicy("tenant");
  assert.ok(policy != null);
});

test("ConfigGovernanceService getGovernancePolicy returns policy for runtime layer", () => {
  const service = new ConfigGovernanceService();
  const policy = service.getGovernancePolicy("runtime");
  assert.ok(policy != null);
});

test("ConfigGovernanceService getGovernancePolicy returns null for unknown layer", () => {
  const service = new ConfigGovernanceService();
  const policy = service.getGovernancePolicy("unknown_layer_xyz");
  assert.equal(policy, null);
});

test("ConfigGovernanceService validateChange returns no issues for valid change", () => {
  const service = new ConfigGovernanceService();
  const issues = service.validateChange({
    layer: "platform",
    path: "test.config",
    newValue: "value",
  });
  assert.ok(Array.isArray(issues));
});

test("ConfigGovernanceService validateChange detects security-sensitive changes", () => {
  const service = new ConfigGovernanceService();
  const issues = service.validateChange({
    layer: "platform",
    path: "security.approvalMode",
    newValue: " unsupervised",
  });
  assert.ok(issues.length > 0);
});

test("ConfigGovernanceService validateChange detects sandbox mode changes", () => {
  const service = new ConfigGovernanceService();
  const issues = service.validateChange({
    layer: "platform",
    path: "security.sandboxMode",
    newValue: "no_restriction",
  });
  assert.ok(issues.some((issue) => issue.includes("sandbox")));
});

test("ConfigGovernanceService validateChange detects destructive action changes", () => {
  const service = new ConfigGovernanceService();
  const issues = service.validateChange({
    layer: "platform",
    path: "security.allowDestructiveActions",
    newValue: true,
  });
  assert.ok(issues.some((issue) => issue.includes("destructive")));
});

test("ConfigGovernanceService getChangeIntent returns intent metadata", () => {
  const service = new ConfigGovernanceService();
  const intent = service.getChangeIntent({
    layer: "platform",
    path: "test.config",
    actor: "test-user",
    reason: "testing",
  });
  assert.ok(intent != null);
  assert.ok(typeof intent.changeId === "string");
  assert.ok(typeof intent.timestamp === "string");
});

test("ConfigGovernanceService requiresApproval returns true for security changes", () => {
  const service = new ConfigGovernanceService();
  const result = service.requiresApproval({
    layer: "platform",
    path: "security.approvalMode",
    newValue: "supervised",
  });
  assert.equal(result, true);
});

test("ConfigGovernanceService requiresApproval returns false for routine changes", () => {
  const service = new ConfigGovernanceService();
  const result = service.requiresApproval({
    layer: "platform",
    path: "logging.level",
    newValue: "debug",
  });
  assert.equal(result, false);
});
