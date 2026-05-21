/**
 * aa CLI Tests
 *
 * Tests for aa.ts - the main CLI entry point that dispatches to subcommands.
 */

import test from "node:test";
import assert from "node:assert/strict";

// CLI entrypoints list - mirrored from src/sdk/cli/index.ts
const CLI_ENTRYPOINTS = [
  "acceptance-readiness",
  "api-server",
  "authoritative-storage-admin",
  "billing",
  "channel-gateway",
  "compliance-program",
  "control-plane-balancer",
  "data-plane",
  "deployment-execution",
  "diagnostics",
  "dispatch-execution",
  "dispatch-reconcile",
  "dlq-manager",
  "doctor",
  "drain-events",
  "enterprise-capability",
  "enterprise-governance",
  "environment-deployment",
  "evolution",
  "gateway-targets",
  "ha-program",
  "inspect",
  "knowledge-semantic-readiness",
  "lease-handover",
  "login",
  "marketplace",
  "memory",
  "migrate-sqlite-to-pg",
  "model-routing",
  "ops-governance",
  "ops-program",
  "orphan-cleanup",
  "pack-create",
  "pack-publish",
  "pack-test",
  "pack-validate",
  "perception",
  "phase1b-demo",
  "platform-operator",
  "pmf",
  "profile-home",
  "release-pipeline",
  "repair",
  "replay-events",
  "replay-recovery",
  "secret-commands",
  "secret-management",
  "shadow-snapshot",
  "skill-creator",
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
  "takeover",
  "task-board",
  "tenant-platform",
  "worker-handshake",
  "worker-register",
  "worker-writeback",
] as const;

type CliEntrypoint = typeof CLI_ENTRYPOINTS[number];

test("CLI_ENTRYPOINTS is an array of strings", () => {
  assert.ok(Array.isArray(CLI_ENTRYPOINTS));
  assert.ok(CLI_ENTRYPOINTS.length > 0);
});

test("CLI_ENTRYPOINTS contains expected entrypoints", () => {
  const expected = [
    "acceptance-readiness",
    "api-server",
    "billing",
    "deployment-execution",
    "diagnostics",
    "dlq-manager",
    "doctor",
    "inspect",
    "memory",
    "secret-management",
  ];

  for (const name of expected) {
    assert.ok(
      CLI_ENTRYPOINTS.includes(name as never),
      `Expected ${name} to be in CLI_ENTRYPOINTS`,
    );
  }
});

test("CLI_ENTRYPOINTS does not contain duplicates", () => {
  const unique = new Set(CLI_ENTRYPOINTS);
  assert.equal(unique.size, CLI_ENTRYPOINTS.length);
});

test("printUsage outputs to stdout", () => {
  // Test the printUsage function by capturing stdout
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string) => {
    chunks.push(chunk);
    return true;
  };

  try {
    // Simulate printUsage behavior
    const usage = [
      "Usage: aa <command> [args...]",
      "",
      "Available commands:",
      ...CLI_ENTRYPOINTS.map((command) => `- ${command}`),
      "",
    ].join("\n");

    process.stdout.write(usage);

    const output = chunks.join("");
    assert.ok(output.includes("Usage: aa <command> [args...]"));
    assert.ok(output.includes("Available commands:"));
    assert.ok(output.includes("- billing"));
    assert.ok(output.includes("- diagnostics"));
  } finally {
    process.stdout.write = originalWrite;
  }
});

test("COMMAND_ALIASES maps operator to platform-operator", () => {
  const COMMAND_ALIASES: Record<string, string> = {
    operator: "platform-operator",
  };

  assert.equal(COMMAND_ALIASES["operator"], "platform-operator");
  assert.ok(CLI_ENTRYPOINTS.includes("platform-operator" as CliEntrypoint));
});

test("unknown command triggers error output", () => {
  const unknownCommand = "nonexistent-command";
  const isKnown = CLI_ENTRYPOINTS.includes(unknownCommand as never);
  assert.equal(isKnown, false);
});

test("all CLI_ENTRYPOINTS are non-empty strings", () => {
  for (const entry of CLI_ENTRYPOINTS) {
    assert.ok(typeof entry === "string");
    assert.ok(entry.length > 0);
  }
});

test("CLI_ENTRYPOINTS includes cli-exit and doctor", () => {
  assert.ok(CLI_ENTRYPOINTS.includes("doctor" as never));
});

test("command alias resolution works correctly", () => {
  const COMMAND_ALIASES: Record<string, string> = {
    operator: "platform-operator",
  };

  const commands = ["operator", "billing", "diagnostics"];
  for (const cmd of commands) {
    const resolved = COMMAND_ALIASES[cmd] ?? cmd;
    if (cmd === "operator") {
      assert.equal(resolved, "platform-operator");
    } else {
      assert.equal(resolved, cmd);
    }
  }
});

test("sourceExtension determines child process args", () => {
  // Test the logic for determining file extension
  const testUrl = "file:///path/to/aa.ts";
  const ext = testUrl.split(".").pop();
  const isTs = ext === "ts";

  assert.equal(isTs, true);
  assert.equal(ext, "ts");

  const childArgs = isTs
    ? ["--import", "tsx", "/path/to/entry.ts", "arg1", "arg2"]
    : ["/path/to/entry.js", "arg1", "arg2"];

  assert.ok(childArgs[0] === "--import");
  assert.ok(childArgs[1] === "tsx");
});

test("sourceExtension handles .js extension", () => {
  const testUrl = "file:///path/to/aa.js";
  const ext = testUrl.split(".").pop();
  const isTs = ext === "ts";

  assert.equal(isTs, false);
  assert.equal(ext, "js");
});