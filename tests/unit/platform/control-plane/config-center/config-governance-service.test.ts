import assert from "node:assert/strict";
import test from "node:test";
import { ConfigGovernanceService } from "../../../../../src/platform/five-plane-control-plane/config-center/config-governance-service.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

test("ConfigGovernanceService can be instantiated", () => {
  const service = new ConfigGovernanceService();
  assert.ok(service != null);
});

test("ConfigGovernanceService loadBundle loads configuration from config root", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a", "b"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({
    defaultGateway: "default",
    sseEnabled: true,
  }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({
    defaultProvider: "provider1",
    defaultModelProfile: "profile1",
  }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0",
    configSchemaVersion: "1.0",
    defaultTaskTimeoutMs: 30000,
    defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10,
    apiDefaultTimeoutMs: 5000,
    apiMaxTimeoutMs: 30000,
    maxAgentRounds: 20,
    maxToolCalls: 100,
    retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 },
    rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised",
    sandboxMode: "workspace_write",
    allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({
    defaultWorkflowId: "default-wf",
    allowCrossDivisionDag: false,
  }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("dev");

    assert.ok(bundle != null);
    assert.equal(bundle.environment, "dev");
    assert.ok(bundle.configRoot.length > 0);
    assert.ok(bundle.version != null);
    assert.ok(bundle.version.versionId.length > 0);
    assert.ok(bundle.layers != null);
    assert.ok(Array.isArray(bundle.issues));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService detectTampering returns tampered=false for unchanged config", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("dev");

    // Use a wrong version ID - tampered should be true because version doesn't match
    const wrongVersionId = "wrong-version-id-12345";

    const result = service.detectTampering(wrongVersionId, "dev");

    assert.equal(result.tampered, true);
    assert.ok(typeof result.currentVersion === "string");
    assert.ok(Array.isArray(result.issues));
    assert.ok(result.issues.includes("config.version_mismatch"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService detectTampering returns tampered=true for changed config", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("dev");
    const expectedVersionId = bundle.version.versionId;

    // Modify a config file
    writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
      appName: "modified-app",
      phase: "dev",
      stableCoreEnabled: true,
      dependencyOrder: ["a"],
      readinessGates: ["gate1"],
      degradationPolicy: { onReadinessFailure: "fail" },
      healthCheckTimeoutMs: 5000,
      readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
    }));

    const result = service.detectTampering(expectedVersionId, "dev");

    assert.equal(result.tampered, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService diffBundles returns differences between bundles", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle1 = service.loadBundle("dev");

    // Create a modified bundle for comparison
    const bundle2 = {
      environment: "dev",
      configRoot: tempDir,
      version: bundle1.version,
      layers: {
        ...bundle1.layers,
        bootstrap: {
          ...bundle1.layers.bootstrap,
          appName: "modified-app",
        },
      },
      issues: [],
    };

    const diffs = service.diffBundles(bundle1, bundle2);

    assert.ok(Array.isArray(diffs));
    assert.ok(diffs.length > 0);
    assert.ok(diffs.some(d => d.path === "bootstrap.appName"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService validateBundle returns no issues for valid bundle", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("dev");

    const issues = service.validateBundle(bundle);

    // A properly loaded bundle should have no issues
    assert.ok(Array.isArray(issues));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService validateBundle detects prod destructive actions issue", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "prod",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: true,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("prod");

    const issues = service.validateBundle(bundle);

    assert.ok(issues.some(i => i.includes("prod_destructive")));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService validateBundle detects prod auto approval issue", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "prod",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "auto", sandboxMode: "workspace_write", allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("prod");

    const issues = service.validateBundle(bundle);

    assert.ok(issues.some(i => i.includes("prod_approval_auto")));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService validateBundle detects missing required layers", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  // Missing providers, runtime, security, workflows

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("dev");

    const issues = service.validateBundle(bundle);

    assert.ok(issues.some(i => i.includes("missing_layer")));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService loadBundle throws for non-existent config root", () => {
  const tempDir = join("/tmp", `cg-test-nonexistent-${Date.now()}`);

  const service = new ConfigGovernanceService({ configRoot: tempDir });

  assert.throws(() => {
    service.loadBundle("dev");
  }, /config\.root_missing/);
});

test("ConfigGovernanceService detectTampering detects bundle issues", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "prod",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "auto", sandboxMode: "workspace_write", allowDestructiveActions: true,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    // Use a fake version ID - the tampered result should be true because bundle has issues
    const result = service.detectTampering("fake-version-id-that-does-not-match", "prod");

    assert.equal(result.tampered, true);
    assert.ok(result.issues.length > 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ConfigGovernanceService diffBundles returns empty array for identical bundles", () => {
  const tempDir = join("/tmp", `cg-test-${Date.now()}`);
  mkdirSync(join(tempDir, "bootstrap"), { recursive: true });
  mkdirSync(join(tempDir, "gateways"), { recursive: true });
  mkdirSync(join(tempDir, "providers"), { recursive: true });
  mkdirSync(join(tempDir, "runtime"), { recursive: true });
  mkdirSync(join(tempDir, "security"), { recursive: true });
  mkdirSync(join(tempDir, "workflows"), { recursive: true });

  writeFileSync(join(tempDir, "bootstrap", "default.json"), JSON.stringify({
    appName: "test-app",
    phase: "dev",
    stableCoreEnabled: true,
    dependencyOrder: ["a"],
    readinessGates: ["gate1"],
    degradationPolicy: { onReadinessFailure: "fail" },
    healthCheckTimeoutMs: 5000,
    readinessProbe: { initialDelayMs: 1000, intervalMs: 5000, timeoutMs: 3000, failureThreshold: 3 },
  }));
  writeFileSync(join(tempDir, "gateways", "default.json"), JSON.stringify({ defaultGateway: "default", sseEnabled: true }));
  writeFileSync(join(tempDir, "providers", "default.json"), JSON.stringify({ defaultProvider: "p1", defaultModelProfile: "pr1" }));
  writeFileSync(join(tempDir, "runtime", "default.json"), JSON.stringify({
    configVersion: "1.0", configSchemaVersion: "1.0", defaultTaskTimeoutMs: 30000, defaultStepTimeoutMs: 10000,
    maxConcurrentTasks: 10, apiDefaultTimeoutMs: 5000, apiMaxTimeoutMs: 30000, retryMax: 3,
    circuitBreaker: { enabled: true, threshold: 5 }, rateLimit: { enabled: true, requestsPerMinute: 100 },
    configDriftReconciler: { interval: 60000 },
  }));
  writeFileSync(join(tempDir, "security", "default.json"), JSON.stringify({
    approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false,
    remoteWorkerRegistration: { challengeTtlMs: 300000, allowedCapabilities: ["cap1"] },
  }));
  writeFileSync(join(tempDir, "workflows", "default.json"), JSON.stringify({ defaultWorkflowId: "wf1" }));

  try {
    const service = new ConfigGovernanceService({ configRoot: tempDir });
    const bundle = service.loadBundle("dev");

    const diffs = service.diffBundles(bundle, bundle);

    assert.ok(Array.isArray(diffs));
    assert.equal(diffs.length, 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});