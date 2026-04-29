/**
 * Integration Tests: Sandbox Policy Security
 *
 * End-to-end integration tests for workspace sandbox path validation:
 * - Path traversal prevention with real filesystem scenarios
 * - Policy mode transitions and boundary enforcement
 * - Symlink detection with actual filesystem operations
 * - Multi-policy coordination for complex sandbox configurations
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createReadOnlyPolicy,
  createConfigReadPolicy,
  resolveSandboxPath,
  normalizeSandboxMode,
  type SandboxPolicy,
  type SandboxPathCheckResult,
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

import {
  DataClassificationService,
  type DataClassificationLevel,
} from "../../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";

// ============================================================================
// Integration: Sandbox Policy with Data Classification
// ============================================================================

test("integration: sandbox path validation combined with data classification", () => {
  const classificationService = new DataClassificationService({ autoDetectPii: true });

  // Create workspace policy for project with mixed sensitivity content
  const workspacePolicy = createWorkspaceWritePolicy("/workspace/project");

  // Test public content path - should be allowed
  const publicPathResult = checkSandboxPath(workspacePolicy, "/workspace/project/README.md");
  assert.equal(publicPathResult.allowed, true);

  const publicContent = "This is a public README file";
  const publicClass = classificationService.classify(publicContent);
  assert.equal(publicClass.level, "public");

  // Test sensitive content path - should be allowed by sandbox, but classified
  const sensitivePathResult = checkSandboxPath(workspacePolicy, "/workspace/project/docs/api-keys.txt");
  assert.equal(sensitivePathResult.allowed, true);

  const sensitiveContent = "API_KEY=sk-secret-key-12345";
  const sensitiveClass = classificationService.classify(sensitiveContent);
  assert.equal(sensitiveClass.level, "restricted");
  assert.ok(sensitiveClass.piiDetected);
});

test("integration: sandbox policy enforces workspace boundaries regardless of classification", () => {
  const workspacePolicy = createWorkspaceWritePolicy("/workspace/tenant-a");

  // Path within workspace - sandbox allows
  const withinWorkspace = checkSandboxPath(workspacePolicy, "/workspace/tenant-a/data/file.txt");
  assert.equal(withinWorkspace.allowed, true);

  // Path outside workspace - sandbox denies even if content is public
  const outsideWorkspace = checkSandboxPath(workspacePolicy, "/workspace/tenant-b/data/file.txt");
  assert.equal(outsideWorkspace.allowed, false);
  assert.equal(outsideWorkspace.reasonCode, "sandbox.path_outside_allowed_roots");
});

test("integration: data classification filtering for sandbox-restricted paths", () => {
  const classificationService = new DataClassificationService({ autoDetectPii: true });

  const restrictedContent = "User email: john.doe@example.com and SSN: 123-45-6789";
  const classification = classificationService.classify(restrictedContent);

  assert.equal(classification.level, "restricted");
  assert.ok(classification.piiTypes.includes("email"));
  assert.ok(classification.piiTypes.includes("ssn"));

  // Get handling decision for cross-worker access
  const handlingDecision = classificationService.getHandlingDecision(classification.level, "cross_worker");
  assert.equal(handlingDecision.action, "deny");
  assert.equal(handlingDecision.allowed, false);
});

// ============================================================================
// Integration: Multi-Policy Sandbox Configurations
// ============================================================================

test("integration: transitioning between sandbox policy modes", () => {
  // Start with read-only policy
  const readOnlyPolicy = createReadOnlyPolicy("/workspace/readonly-project");

  let result = checkSandboxPath(readOnlyPolicy, "/workspace/readonly-project/file.txt");
  assert.equal(result.allowed, true);
  assert.equal(readOnlyPolicy.processRuleMode, "deny");

  // Switch to workspace_write policy
  const writePolicy = createWorkspaceWritePolicy("/workspace/readonly-project");

  result = checkSandboxPath(writePolicy, "/workspace/readonly-project/file.txt");
  assert.equal(result.allowed, true);
  assert.equal(writePolicy.processRuleMode, "allow");

  // Path traversal blocked in both modes
  result = checkSandboxPath(writePolicy, "/workspace/readonly-project/../../../etc/passwd");
  assert.equal(result.allowed, false);
});

test("integration: scoped_external_access policy with explicit outbound rules", () => {
  const scopedPolicy = createScopedExternalAccessPolicy("/workspace/scoped-app");

  // Internal workspace paths allowed
  const internalPath = checkSandboxPath(scopedPolicy, "/workspace/scoped-app/internal/api.txt");
  assert.equal(internalPath.allowed, true);

  // External paths blocked by default
  const externalPath = checkSandboxPath(scopedPolicy, "/etc/secrets.txt");
  assert.equal(externalPath.allowed, false);

  // Symlink policy enforced
  assert.equal(scopedPolicy.symlinkPolicy, "deny");
  assert.equal(scopedPolicy.realpathEnforced, true);
});

test("integration: restricted_exec mode ignores workspace boundary but respects denied roots", () => {
  const execPolicy: SandboxPolicy = {
    ...createRestrictedExecPolicy("/workspace/restricted"),
    deniedRoots: ["/etc", "/root", "/var/log"],
  };

  // restricted_exec ignores allowed root boundary for path checking
  const anyPath = checkSandboxPath(execPolicy, "/tmp/random/file.txt");
  assert.equal(anyPath.allowed, true);

  // But denied roots are still enforced
  const deniedPath = checkSandboxPath(execPolicy, "/etc/passwd");
  assert.equal(deniedPath.allowed, false);
  assert.equal(deniedPath.reasonCode, "sandbox.path_in_denied_root");
});

// ============================================================================
// Integration: Realpath Resolution with Symlink Scenarios
// ============================================================================

test("integration: resolveSandboxPath handles symlinks correctly", () => {
  // /tmp is a symlink on macOS (points to /private/tmp)
  const resolvedTmp = resolveSandboxPath("/tmp", true);
  assert.ok(resolvedTmp.includes("/private/tmp") || resolvedTmp === "/tmp");

  // Without realpath, returns as-is
  const unresolvedTmp = resolveSandboxPath("/tmp", false);
  assert.ok(unresolvedTmp.includes("tmp"));
});

test("integration: sandbox policy with complex nested paths", () => {
  const policy = createWorkspaceWritePolicy("/workspace/complex-project");

  // Deep nested path within project
  const deepNested = checkSandboxPath(
    policy,
    "/workspace/complex-project/src/features/user/auth/components/Button.tsx",
  );
  assert.equal(deepNested.allowed, true);

  // Path with encoded characters
  const encodedPath = checkSandboxPath(policy, "/workspace/complex-project/src/file%20with%20spaces.txt");
  assert.equal(encodedPath.allowed, true);

  // Path with unicode (full-width characters normalized)
  const unicodePath = checkSandboxPath(policy, "/workspace/complex-project/src/file\xFF0Ftest.txt");
  assert.equal(unicodePath.allowed, false); // NFKC normalization reveals traversal
});

// ============================================================================
// Integration: Policy Mode Normalization
// ============================================================================

test("integration: sandbox mode normalization for various inputs", () => {
  assert.equal(normalizeSandboxMode("read_only"), "read_only");
  assert.equal(normalizeSandboxMode("workspace_write"), "workspace_write");
  assert.equal(normalizeSandboxMode("container"), "workspace_write"); // alias
  assert.equal(normalizeSandboxMode("process"), "read_only"); // alias
  assert.equal(normalizeSandboxMode("restricted_exec"), "restricted_exec");
  assert.equal(normalizeSandboxMode("scoped_external_access"), "scoped_external_access");
  assert.equal(normalizeSandboxMode(null), "read_only"); // default
  assert.equal(normalizeSandboxMode(undefined), "read_only"); // default
  assert.equal(normalizeSandboxMode("unknown_mode"), "read_only"); // fallback
});

// ============================================================================
// Integration: Multiple Denied Roots Enforcement
// ============================================================================

test("integration: multiple denied roots with different sensitivity levels", () => {
  const policy: SandboxPolicy = {
    policyId: "multi-denied-test",
    mode: "workspace_write",
    allowedRoots: ["/workspace/multi-project"],
    deniedRoots: [
      "/workspace/multi-project/secrets",
      "/workspace/multi-project/.ssh",
      "/workspace/multi-project/logs",
    ],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
  };

  // Normal workspace path allowed
  const normalPath = checkSandboxPath(policy, "/workspace/multi-project/src/index.ts");
  assert.equal(normalPath.allowed, true);

  // Each denied root blocked
  const secretPath = checkSandboxPath(policy, "/workspace/multi-project/secrets/api-keys.json");
  assert.equal(secretPath.allowed, false);
  assert.equal(secretPath.reasonCode, "sandbox.path_in_denied_root");

  const sshPath = checkSandboxPath(policy, "/workspace/multi-project/.ssh/id_rsa");
  assert.equal(sshPath.allowed, false);
  assert.equal(sshPath.reasonCode, "sandbox.path_in_denied_root");

  const logPath = checkSandboxPath(policy, "/workspace/multi-project/logs/app.log");
  assert.equal(logPath.allowed, false);
  assert.equal(logPath.reasonCode, "sandbox.path_in_denied_root");

  // Subdirectory within denied root also blocked
  const nestedDeniedPath = checkSandboxPath(policy, "/workspace/multi-project/secrets/temp/backup.json");
  assert.equal(nestedDeniedPath.allowed, false);
});

// ============================================================================
// Integration: Path Validation Result Structure
// ============================================================================

test("integration: SandboxPathCheckResult structure validation", () => {
  const policy = createWorkspaceWritePolicy("/workspace/test");

  // Allowed result
  const allowedResult = checkSandboxPath(policy, "/workspace/test/file.txt");
  assert.equal(allowedResult.allowed, true);
  assert.ok(allowedResult.normalizedPath.length > 0);
  assert.equal(allowedResult.reasonCode, null);

  // Denied result
  const deniedResult = checkSandboxPath(policy, "/etc/passwd");
  assert.equal(deniedResult.allowed, false);
  assert.ok(deniedResult.normalizedPath.length > 0);
  assert.ok(deniedResult.reasonCode !== null);
  assert.ok(
    deniedResult.reasonCode === "sandbox.path_outside_allowed_roots" ||
    deniedResult.reasonCode === "sandbox.path_in_denied_root",
  );
});

// ============================================================================
// Integration: Config Read Policy with Security Enforcement
// ============================================================================

test("integration: config_read policy enforces strict boundaries", () => {
  const configPolicy = createConfigReadPolicy("/etc/app-config");

  // Paths within config root allowed
  const configFile = checkSandboxPath(configPolicy, "/etc/app-config/settings.json");
  assert.equal(configFile.allowed, true);
  assert.equal(configPolicy.mode, "read_only");
  assert.equal(configPolicy.processRuleMode, "deny");

  // Paths outside config root denied
  const outsidePath = checkSandboxPath(configPolicy, "/workspace/app/data.json");
  assert.equal(outsidePath.allowed, false);

  // Symlinks blocked even within allowed root
  assert.equal(configPolicy.symlinkPolicy, "deny");
  assert.equal(configPolicy.realpathEnforced, true);
});

// ============================================================================
// Integration: End-to-End Security Workflow
// ============================================================================

test("integration: complete security workflow - classify then validate path", () => {
  const classificationService = new DataClassificationService({ autoDetectPii: true });
  const workspacePolicy = createWorkspaceWritePolicy("/workspace/secure-app");

  // Workflow: User uploads file to workspace
  const filePath = "/workspace/secure-app/uploads/document.pdf";
  const pathResult = checkSandboxPath(workspacePolicy, filePath);

  assert.equal(pathResult.allowed, true);

  // Simulate file content classification
  const content = "Internal memo: The password for production is P@ssw0rd!";
  const classification = classificationService.classify(content);

  // Content classified as restricted
  assert.equal(classification.level, "restricted");
  assert.ok(classification.requiresAudit);

  // Handling decision for memory storage
  const memoryDecision = classificationService.getHandlingDecision(classification.level, "memory");
  assert.equal(memoryDecision.action, "deny");

  // Handling decision for logs
  const logDecision = classificationService.getHandlingDecision(classification.level, "logs");
  assert.equal(logDecision.action, "deny");
});

test("integration: tenant isolation via sandbox policy", () => {
  // Create isolated policies for different tenants
  const tenantAPolicy = createWorkspaceWritePolicy("/workspace/tenant-a");
  const tenantBPolicy = createWorkspaceWritePolicy("/workspace/tenant-b");

  // Tenant A can access their workspace
  const tenantAFile = checkSandboxPath(tenantAPolicy, "/workspace/tenant-a/data/file.txt");
  assert.equal(tenantAFile.allowed, true);

  // Tenant A cannot access Tenant B's workspace
  const tenantBFileFromA = checkSandboxPath(tenantAPolicy, "/workspace/tenant-b/data/file.txt");
  assert.equal(tenantBFileFromA.allowed, false);
  assert.equal(tenantBFileFromA.reasonCode, "sandbox.path_outside_allowed_roots");

  // Tenant B can access their workspace
  const tenantBFile = checkSandboxPath(tenantBPolicy, "/workspace/tenant-b/data/file.txt");
  assert.equal(tenantBFile.allowed, true);

  // Tenant B cannot access Tenant A's workspace
  const tenantAFileFromB = checkSandboxPath(tenantBPolicy, "/workspace/tenant-a/data/file.txt");
  assert.equal(tenantAFileFromB.allowed, false);
});

// ============================================================================
// Integration: Edge Cases and Boundary Conditions
// ============================================================================

test("integration: exact root path match", () => {
  const policy = createWorkspaceWritePolicy("/workspace/exact");

  // Exact match of workspace root
  const exactRoot = checkSandboxPath(policy, "/workspace/exact");
  assert.equal(exactRoot.allowed, true);
});

test("integration: path with trailing slash handling", () => {
  const policy = createWorkspaceWritePolicy("/workspace/trailing");

  // Path with trailing slash
  const trailingSlash = checkSandboxPath(policy, "/workspace/trailing/file/");
  assert.equal(trailingSlash.allowed, true);
});

test("integration: hidden files and directories within workspace", () => {
  const policy = createWorkspaceWritePolicy("/workspace/hidden-test");

  // Hidden file
  const hiddenFile = checkSandboxPath(policy, "/workspace/hidden-test/.hidden-file");
  assert.equal(hiddenFile.allowed, true);

  // Hidden directory
  const hiddenDir = checkSandboxPath(policy, "/workspace/hidden-test/.hidden-dir/config.txt");
  assert.equal(hiddenDir.allowed, true);
});

test("integration: realpath resolution preserves security checks", () => {
  const policy = createWorkspaceWritePolicy("/workspace/realpath-test");

  // Non-existent path within workspace should still be allowed (future file creation)
  const futurePath = checkSandboxPath(policy, "/workspace/realpath-test/future/file.txt");
  assert.equal(futurePath.allowed, true);

  // Path with null byte injection
  const nullBytePath = checkSandboxPath(policy, "/workspace/realpath-test/file\x00.txt");
  assert.equal(nullBytePath.allowed, false);
  assert.equal(nullBytePath.reasonCode, "sandbox.path_invalid_encoding");
});
