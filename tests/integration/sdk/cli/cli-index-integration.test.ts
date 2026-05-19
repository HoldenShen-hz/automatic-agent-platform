/**
 * @fileoverview Integration tests for SDK CLI index exports
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_ENTRYPOINTS,
  type CliEntrypoint,
} from "../../../../src/sdk/cli/index.js";

test("CLI_ENTRYPOINTS is a tuple of all available CLI entrypoints", () => {
  assert.ok(Array.isArray(CLI_ENTRYPOINTS));
  assert.ok(CLI_ENTRYPOINTS.length > 0, "CLI_ENTRYPOINTS should not be empty");
});

test("CLI_ENTRYPOINTS contains all expected operational commands", () => {
  const expectedCommands = [
    "acceptance-readiness",
    "api-server",
    "authoritative-storage-admin",
    "billing",
    "diagnostics",
    "doctor",
    "inspect",
    "login",
    "platform-operator",
    "pmf",
    "worker-handshake",
    "worker-register",
  ];

  for (const cmd of expectedCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Expected command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS contains all stability commands", () => {
  const stabilityCommands = [
    "stable-campaign",
    "stable-chaos",
    "stable-concurrency",
    "stable-db-queue-disconnect",
    "stable-db-writability",
    "stable-dispatch",
    "stable-dispatch-reconcile",
    "stable-evidence",
    "stable-gate",
    "stable-gray",
    "stable-lease",
    "stable-maintenance",
    "stable-migration-compatibility",
    "stable-package",
    "stable-prompt-injection",
    "stable-queue-delivery",
    "stable-recovery-drill",
    "stable-replay",
    "stable-restore",
    "stable-rollback",
    "stable-sequence",
    "stable-soak",
    "stable-upgrade",
    "stable-validate",
    "stable-worker-handshake",
    "stable-worker-writeback",
  ];

  for (const cmd of stabilityCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Stability command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS contains all execution and dispatch commands", () => {
  const executionCommands = [
    "deployment-execution",
    "dispatch-execution",
    "dispatch-reconcile",
    "replay-events",
    "replay-recovery",
    "takeover",
  ];

  for (const cmd of executionCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Execution command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS contains governance and ops commands", () => {
  const governanceCommands = [
    "channel-gateway",
    "compliance-program",
    "control-plane-balancer",
    "enterprise-capability",
    "enterprise-governance",
    "ops-governance",
    "ops-program",
  ];

  for (const cmd of governanceCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Governance command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS contains data and memory commands", () => {
  const dataCommands = [
    "authoritative-storage-admin",
    "dlq-manager",
    "drain-events",
    "memory",
    "migrate-sqlite-to-pg",
    "orphan-cleanup",
    "shadow-snapshot",
  ];

  for (const cmd of dataCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Data command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS contains marketplace and ecosystem commands", () => {
  const ecosystemCommands = [
    "evolution",
    "gateway-targets",
    "lease-handover",
    "marketplace",
    "model-routing",
    "perception",
    "secret-management",
    "skill-creator",
    "tenant-platform",
    "worker-writeback",
  ];

  for (const cmd of ecosystemCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Ecosystem command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS has no duplicates", () => {
  const seen = new Set<string>();
  for (const entrypoint of CLI_ENTRYPOINTS) {
    assert.ok(
      !seen.has(entrypoint),
      `Duplicate entrypoint found: ${entrypoint}`,
    );
    seen.add(entrypoint);
  }
});

test("CliEntrypoint type can be used as type annotation", () => {
  const validEntrypoint: CliEntrypoint = "doctor";
  assert.equal(validEntrypoint, "doctor");
});

test("All CLI_ENTRYPOINTS values satisfy CliEntrypoint type", () => {
  const entrypoints: CliEntrypoint[] = [...CLI_ENTRYPOINTS];
  assert.equal(entrypoints.length, CLI_ENTRYPOINTS.length);
});

test("CLI_ENTRYPOINTS includes demo and testing commands", () => {
  const demoCommands = ["phase1b-demo", "profile-home"];
  for (const cmd of demoCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Demo command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS includes repair and maintenance commands", () => {
  const maintenanceCommands = ["repair", "release-pipeline"];
  for (const cmd of maintenanceCommands) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(cmd as CliEntrypoint),
      `Maintenance command "${cmd}" should be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS count matches documented total", () => {
  assert.equal(CLI_ENTRYPOINTS.length, 80);
});

test("CLI_ENTRYPOINTS are sorted alphabetically", () => {
  const sorted = [...CLI_ENTRYPOINTS].sort();
  assert.deepEqual(CLI_ENTRYPOINTS, sorted);
});
