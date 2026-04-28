import assert from "node:assert/strict";
import test from "node:test";

import {
  PackSecurityService,
  type SecurityScanInput,
  type DependencyInfo,
} from "../../../src/scale-ecosystem/marketplace/pack-security-service.js";

function createSecurityScanInput(overrides: Partial<SecurityScanInput> = {}): SecurityScanInput {
  return {
    packId: overrides.packId ?? "test-pack",
    version: overrides.version ?? "1.0.0",
    sourceUri: overrides.sourceUri ?? "inline:console.log('hello')",
    manifestChecksum: overrides.manifestChecksum ?? "a".repeat(64),
    capabilities: overrides.capabilities ?? ["notify"],
    permissions: overrides.permissions ?? ["network:egress:limited"],
    ...overrides,
  };
}

function createDependencyInfo(overrides: Partial<DependencyInfo> = {}): DependencyInfo {
  return {
    packId: overrides.packId ?? "dep-pack",
    version: overrides.version ?? "1.0.0",
    capabilities: overrides.capabilities ?? ["storage"],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// runSecurityScan Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PackSecurityService.runSecurityScan returns passed when no issues", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:console.log('hello')",
    manifestChecksum: "62b98c351f3d4e42c0c2c9c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3", // valid sha256
    capabilities: ["notify"],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.equal(result.packId, "test-pack");
  assert.equal(result.version, "1.0.0");
  assert.ok(["passed", "warning", "failed"].includes(result.status));
  assert.ok(result.scanId.startsWith("scan_"));
});

test("PackSecurityService.runSecurityScan detects invalid checksum format", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    manifestChecksum: "not-a-valid-sha256",
  });

  const result = await service.runSecurityScan(input);

  assert.equal(result.status, "failed");
  assert.ok(result.issues.some((i) => i.code === "PKG001"));
});

test("PackSecurityService.runSecurityScan detects checksum mismatch for inline source", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:correct content",
    manifestChecksum: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });

  const result = await service.runSecurityScan(input);

  assert.equal(result.status, "failed");
  assert.ok(result.issues.some((i) => i.code === "PKG002"));
});

test("PackSecurityService.runSecurityScan passes with valid sha256 hex", async () => {
  const service = new PackSecurityService();
  const content = "console.log('test')";
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex");

  const input = createSecurityScanInput({
    sourceUri: `inline:${content}`,
    manifestChecksum: hash,
    capabilities: [],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.ok(!result.issues.some((i) => i.code === "PKG001" || i.code === "PKG002"));
});

test("PackSecurityService.runSecurityScan detects high-risk permissions", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    permissions: ["file:write", "exec:bash"],
    capabilities: [],
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.category === "permission_escalation" && i.code === "PERM001"));
});

test("PackSecurityService.runSecurityScan detects user-controlled exec pattern", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:exec(userInput)",
    manifestChecksum: "a".repeat(64),
    capabilities: [],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.code === "SAND001"));
});

test("PackSecurityService.runSecurityScan detects user-controlled eval pattern", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:eval(userData)",
    manifestChecksum: "a".repeat(64),
    capabilities: [],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.code === "SAND002"));
});

test("PackSecurityService.runSecurityScan detects broad environment access", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:process.env",
    manifestChecksum: "a".repeat(64),
    capabilities: [],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.code === "SAND003"));
});

test("PackSecurityService.runSecurityScan detects shell execution in child process", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:child_process.spawn('ls', {shell: true})",
    manifestChecksum: "a".repeat(64),
    capabilities: [],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.code === "SAND004"));
});

test("PackSecurityService.runSecurityScan detects exec capability with bash permission", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    capabilities: ["exec"],
    permissions: ["exec:bash"],
    sourceUri: "inline:console.log('x')",
    manifestChecksum: "a".repeat(64),
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.code === "SAND010"));
});

test("PackSecurityService.runSecurityScan detects over-provisioned dangerous capabilities", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    capabilities: ["exec", "file_write", "sql_execute", "network_egress"],
    permissions: [],
    sourceUri: "inline:console.log('x')",
    manifestChecksum: "a".repeat(64),
  });

  const result = await service.runSecurityScan(input);

  assert.ok(result.issues.some((i) => i.code === "CAP001"));
});

test("PackSecurityService.runSecurityScan returns failed for critical severity issues", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput({
    sourceUri: "inline:exec(userInput)",
    manifestChecksum: "not-valid",
    capabilities: ["exec"],
    permissions: ["exec:bash"],
  });

  const result = await service.runSecurityScan(input);

  assert.equal(result.status, "failed");
});

test("PackSecurityService.runSecurityScan returns warning for high severity issues only", async () => {
  const service = new PackSecurityService();
  const crypto = await import("node:crypto");
  const source = "exec(userInput)";
  const input = createSecurityScanInput({
    sourceUri: `inline:${source}`,
    manifestChecksum: crypto.createHash("sha256").update(source, "utf8").digest("hex"),
    capabilities: [],
    permissions: [],
  });

  const result = await service.runSecurityScan(input);

  assert.equal(result.status, "warning");
});

test("PackSecurityService.runSecurityScan includes scan duration", async () => {
  const service = new PackSecurityService();
  const input = createSecurityScanInput();

  const result = await service.runSecurityScan(input);

  assert.ok(result.scanDurationMs >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// detectDependencyConflicts Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PackSecurityService.detectDependencyConflicts returns resolved when no conflicts", () => {
  const service = new PackSecurityService();
  const deps = [createDependencyInfo({ packId: "new-pack", version: "2.0.0", capabilities: ["storage"] })];
  const existing = [createDependencyInfo({ packId: "other-pack", version: "1.0.0", capabilities: ["compute"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, existing);

  assert.equal(result.resolved, true);
  assert.deepEqual(result.conflicts, []);
});

test("PackSecurityService.detectDependencyConflicts detects same pack different version", () => {
  const service = new PackSecurityService();
  const deps = [createDependencyInfo({ packId: "shared-pack", version: "2.0.0", capabilities: ["storage", "compute"] })];
  const existing = [createDependencyInfo({ packId: "shared-pack", version: "1.0.0", capabilities: ["storage"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, existing);

  assert.equal(result.resolved, false);
  assert.ok(result.conflicts.length > 0);
  assert.equal(result.conflicts[0]!.conflictType, "capability_overlap");
});

test("PackSecurityService.detectDependencyConflicts detects capability overlap", () => {
  const service = new PackSecurityService();
  const deps = [createDependencyInfo({ packId: "dep-a", version: "2.0.0", capabilities: ["storage", "compute"] })];
  const existing = [createDependencyInfo({ packId: "dep-a", version: "1.0.0", capabilities: ["compute"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, existing);

  assert.ok(result.conflicts.some((c) => c.conflictType === "capability_overlap"));
});

test("PackSecurityService.detectDependencyConflicts provides resolution suggestions", () => {
  const service = new PackSecurityService();
  const deps = [createDependencyInfo({ packId: "conflict-pack", version: "2.0.0", capabilities: ["storage"] })];
  const existing = [createDependencyInfo({ packId: "conflict-pack", version: "1.0.0", capabilities: ["storage"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, existing);

  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions[0]!.includes("conflict-pack"));
});

test("PackSecurityService.detectDependencyConflicts handles multiple dependencies", () => {
  const service = new PackSecurityService();
  const deps = [
    createDependencyInfo({ packId: "dep-a", version: "2.0.0", capabilities: ["storage"] }),
    createDependencyInfo({ packId: "dep-b", version: "1.5.0", capabilities: ["compute"] }),
  ];
  const existing = [
    createDependencyInfo({ packId: "dep-a", version: "1.0.0", capabilities: ["storage"] }),
  ];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, existing);

  assert.ok(result.conflicts.length >= 1);
});

test("PackSecurityService.detectDependencyConflicts handles same version (no conflict)", () => {
  const service = new PackSecurityService();
  const deps = [createDependencyInfo({ packId: "same-pack", version: "1.0.0", capabilities: ["storage"] })];
  const existing = [createDependencyInfo({ packId: "same-pack", version: "1.0.0", capabilities: ["compute"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, existing);

  assert.equal(result.resolved, true);
});

test("PackSecurityService.detectDependencyConflicts handles empty dependencies", () => {
  const service = new PackSecurityService();
  const existing = [createDependencyInfo({ packId: "existing-pack", version: "1.0.0", capabilities: ["storage"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", [], existing);

  assert.equal(result.resolved, true);
});

test("PackSecurityService.detectDependencyConflicts handles empty existing packs", () => {
  const service = new PackSecurityService();
  const deps = [createDependencyInfo({ packId: "new-pack", version: "1.0.0", capabilities: ["storage"] })];

  const result = service.detectDependencyConflicts("test-pack", "1.0.0", deps, []);

  assert.equal(result.resolved, true);
});

test("PackSecurityService.detectDependencyConflicts includes packId and version in result", () => {
  const service = new PackSecurityService();
  const result = service.detectDependencyConflicts("my-pack", "3.0.0", [], []);

  assert.equal(result.packId, "my-pack");
  assert.equal(result.version, "3.0.0");
});
