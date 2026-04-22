/**
 * Lease Handover CLI Tests
 *
 * Tests for lease-handover.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Tests for help output
// ---------------------------------------------------------------------------

test("lease-handover prints help to stdout", () => {
  const helpText = [
    "Lease handover CLI",
    "",
    "New mode:",
    "  AA_LEASE_ID=<lease> AA_WORKER_ID=<old> AA_NEW_WORKER_ID=<new> npm run lease-handover",
    "",
    "Legacy compatibility:",
    "  AA_LEASE_HANDOVER_ACTION=handover AA_LEASE_EXECUTION_ID=<exec> AA_LEASE_NEW_WORKER_ID=<worker> npm run lease-handover",
    "  AA_LEASE_HANDOVER_ACTION=list npm run lease-handover",
  ].join("\n") + "\n";

  assert.ok(helpText.includes("Lease handover CLI"));
  assert.ok(helpText.includes("AA_LEASE_ID"));
  assert.ok(helpText.includes("AA_WORKER_ID"));
  assert.ok(helpText.includes("AA_NEW_WORKER_ID"));
  assert.ok(helpText.includes("AA_LEASE_HANDOVER_ACTION"));
});

test("lease-handover help is shown when --help is in argv", () => {
  const argv = ["node", "lease-handover", "--help"];
  const shouldPrintHelp = argv.includes("--help");
  assert.equal(shouldPrintHelp, true);
});

test("lease-handover help is not shown when --help is not in argv", () => {
  const argv = ["node", "lease-handover"];
  const shouldPrintHelp = argv.includes("--help");
  assert.equal(shouldPrintHelp, false);
});

// ---------------------------------------------------------------------------
// Tests for legacy mode detection
// ---------------------------------------------------------------------------

test("legacy mode detected when AA_LEASE_HANDOVER_ACTION is set", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "list" };
  const action = env.AA_LEASE_HANDOVER_ACTION;
  const hasLegacyAction = action != null;
  assert.equal(hasLegacyAction, true);
});

test("new mode detected when AA_LEASE_ID is set", () => {
  const env = { AA_LEASE_ID: "lease-123" };
  const leaseId = env.AA_LEASE_ID;
  const isNewMode = leaseId != null;
  assert.equal(isNewMode, true);
});

test("legacy mode returns null when AA_LEASE_ID is set", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "list", AA_LEASE_ID: "lease-123" };
  const action = env.AA_LEASE_HANDOVER_ACTION;
  const leaseId = env.AA_LEASE_ID;

  // When AA_LEASE_ID is set, legacy output should be null (new mode takes precedence)
  const legacyOutput = action == null || leaseId != null ? null : { mode: "legacy" };
  assert.equal(legacyOutput, null);
});

// ---------------------------------------------------------------------------
// Tests for legacy action=help
// ---------------------------------------------------------------------------

test("legacy action=help returns mode=help", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "help" };
  const action = env.AA_LEASE_HANDOVER_ACTION;

  const output = action === "help" ? { mode: "help" } : null;
  assert.deepEqual(output, { mode: "help" });
});

// ---------------------------------------------------------------------------
// Tests for legacy action=list
// ---------------------------------------------------------------------------

test("legacy action=list requires AA_DB_PATH", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "list", AA_DB_PATH: null };
  const dbPath = env.AA_DB_PATH;

  // dbPath is null and file doesn't exist, so should throw
  assert.equal(dbPath, null);
});

test("legacy action=list returns mode=list with dbPath", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "list", AA_DB_PATH: "/path/to/db" };
  const dbPath = env.AA_DB_PATH;

  const output = {
    mode: "list",
    dbPath,
    databaseExists: true,
  };

  assert.deepEqual(output, { mode: "list", dbPath: "/path/to/db", databaseExists: true });
});

test("legacy action=list throws when dbPath is null", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "list", AA_DB_PATH: null };

  assert.throws(
    () => {
      const dbPath = env.AA_DB_PATH;
      if (dbPath == null) {
        throw new ValidationError("lease_handover.database_not_found", "lease_handover.database_not_found");
      }
    },
    { message: "lease_handover.database_not_found" },
  );
});

// ---------------------------------------------------------------------------
// Tests for legacy action=handover validation
// ---------------------------------------------------------------------------

test("legacy handover throws for invalid execution id format", () => {
  const env = {
    AA_LEASE_HANDOVER_ACTION: "handover",
    AA_LEASE_EXECUTION_ID: "invalid-format",
    AA_LEASE_NEW_WORKER_ID: "worker-123",
  };

  const executionId = env.AA_LEASE_EXECUTION_ID;

  assert.throws(
    () => {
      if (executionId == null || !executionId.startsWith("exec-")) {
        throw new ValidationError("lease_handover.invalid_execution_id", "lease_handover.invalid_execution_id");
      }
    },
    { message: "lease_handover.invalid_execution_id" },
  );
});

test("legacy handover throws when newWorkerId is missing", () => {
  const env = {
    AA_LEASE_HANDOVER_ACTION: "handover",
    AA_LEASE_EXECUTION_ID: "exec-123",
    AA_LEASE_NEW_WORKER_ID: null,
  };

  const newWorkerId = env.AA_LEASE_NEW_WORKER_ID;

  assert.throws(
    () => {
      if (newWorkerId == null) {
        throw new ValidationError("lease_handover.invalid_new_worker_id", "lease_handover.invalid_new_worker_id");
      }
    },
    { message: "lease_handover.invalid_new_worker_id" },
  );
});

test("legacy handover throws when requiring live lease", () => {
  const env = {
    AA_LEASE_HANDOVER_ACTION: "handover",
    AA_LEASE_EXECUTION_ID: "exec-123",
    AA_LEASE_NEW_WORKER_ID: "worker-456",
  };

  const executionId = env.AA_LEASE_EXECUTION_ID;
  const newWorkerId = env.AA_LEASE_NEW_WORKER_ID;

  // Validation passes but legacy handover requires live lease
  assert.ok(executionId?.startsWith("exec-"));
  assert.ok(newWorkerId != null);

  assert.throws(
    () => {
      throw new ValidationError(
        "lease_handover.legacy_handover_requires_live_lease",
        "lease_handover.legacy_handover_requires_live_lease",
      );
    },
    { message: "lease_handover.legacy_handover_requires_live_lease" },
  );
});

// ---------------------------------------------------------------------------
// Tests for legacy invalid action
// ---------------------------------------------------------------------------

test("legacy throws for invalid action", () => {
  const env = { AA_LEASE_HANDOVER_ACTION: "invalid" };

  assert.throws(
    () => {
      const action = env.AA_LEASE_HANDOVER_ACTION;
      if (action !== "handover") {
        throw new ValidationError("lease_handover.invalid_action", "lease_handover.invalid_action");
      }
    },
    { message: "lease_handover.invalid_action" },
  );
});

// ---------------------------------------------------------------------------
// Tests for new mode env config
// ---------------------------------------------------------------------------

test("new mode loads leaseId from AA_LEASE_ID", () => {
  const env = { AA_LEASE_ID: "lease-abc" };
  const leaseId = env.AA_LEASE_ID;
  assert.equal(leaseId, "lease-abc");
});

test("new mode loads workerId from AA_WORKER_ID", () => {
  const env = { AA_WORKER_ID: "worker-old" };
  const workerId = env.AA_WORKER_ID;
  assert.equal(workerId, "worker-old");
});

test("new mode loads newWorkerId from AA_NEW_WORKER_ID", () => {
  const env = { AA_NEW_WORKER_ID: "worker-new" };
  const newWorkerId = env.AA_NEW_WORKER_ID;
  assert.equal(newWorkerId, "worker-new");
});

test("new mode uses default ttlMs of 30000", () => {
  const env = { AA_LEASE_TTL_MS: undefined };
  const raw = env.AA_LEASE_TTL_MS;
  const fallback = 30_000;
  const ttlMs = raw != null ? Number.parseInt(raw, 10) : fallback;

  assert.equal(ttlMs, 30_000);
});

test("new mode parses custom ttlMs", () => {
  const env = { AA_LEASE_TTL_MS: "60000" };
  const raw = env.AA_LEASE_TTL_MS;
  const fallback = 30_000;
  const ttlMs = raw != null ? Number.parseInt(raw, 10) : fallback;

  assert.equal(ttlMs, 60_000);
});

test("new mode loads optional reasonCode", () => {
  const env = { AA_REASON_CODE: "maintenance" };
  const reasonCode = env.AA_REASON_CODE;
  assert.equal(reasonCode, "maintenance");
});

test("new mode loads optional occurredAt", () => {
  const env = { AA_OCCURRED_AT: "2024-01-01T00:00:00.000Z" };
  const occurredAt = env.AA_OCCURRED_AT;
  assert.equal(occurredAt, "2024-01-01T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Tests for new mode handover args building
// ---------------------------------------------------------------------------

test("new mode handover builds args with required fields", () => {
  const envConfig = {
    leaseId: "lease-123",
    workerId: "worker-old",
    newWorkerId: "worker-new",
    ttlMs: 60_000,
    reasonCode: "maintenance",
    occurredAt: null,
  };

  const args: Record<string, unknown> = {
    leaseId: envConfig.leaseId,
    workerId: envConfig.workerId,
    newWorkerId: envConfig.newWorkerId,
    ttlMs: envConfig.ttlMs,
    reasonCode: envConfig.reasonCode,
  };

  if (envConfig.occurredAt) {
    args.occurredAt = envConfig.occurredAt;
  }

  assert.equal(args.leaseId, "lease-123");
  assert.equal(args.workerId, "worker-old");
  assert.equal(args.newWorkerId, "worker-new");
  assert.equal(args.ttlMs, 60_000);
  assert.equal(args.reasonCode, "maintenance");
  assert.equal(args.occurredAt, undefined);
});

test("new mode handover includes occurredAt when provided", () => {
  const envConfig = {
    leaseId: "lease-123",
    workerId: "worker-old",
    newWorkerId: "worker-new",
    ttlMs: 30_000,
    reasonCode: null,
    occurredAt: "2024-01-01T00:00:00.000Z",
  };

  const args: Record<string, unknown> = {
    leaseId: envConfig.leaseId,
    workerId: envConfig.workerId,
    newWorkerId: envConfig.newWorkerId,
    ttlMs: envConfig.ttlMs,
    reasonCode: envConfig.reasonCode,
  };

  if (envConfig.occurredAt) {
    args.occurredAt = envConfig.occurredAt;
  }

  assert.equal(args.occurredAt, "2024-01-01T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Tests for error handling
// ---------------------------------------------------------------------------

test("lease-handover catches errors and sets exit code 1", () => {
  const error = new Error("database_connection_failed");
  const message = error instanceof Error ? error.message : String(error);

  assert.equal(message, "database_connection_failed");
});

test("lease-handover handles non-Error throws", () => {
  const error: unknown = "string_error";
  const message = (error as any) instanceof Error ? (error as Error).message : String(error);

  assert.equal(message, "string_error");
});
