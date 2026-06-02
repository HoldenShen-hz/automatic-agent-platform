/**
 * Lease Handover CLI Tool
 *
 * Provides a command-line entry point for controlled execution lease handover.
 * This transfers an active lease from one worker to another while preserving
 * lineage and incrementing the fencing token.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Optional SQLite database path
 *   - AA_LEASE_ID: Active lease to transfer
 *   - AA_WORKER_ID: Current owner of the active lease
 *   - AA_NEW_WORKER_ID: Replacement worker that should receive the lease
 *   - AA_LEASE_TTL_MS: TTL for the new lease (default: 30000)
 *   - AA_REASON_CODE: Optional handover reason code
 *   - AA_OCCURRED_AT: Optional ISO timestamp for deterministic rehearsal/tests
 */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { withCliStorage } from "./authoritative-storage.js";
import { readCliProcessEnv, type CliEnv } from "./cli-env.js";
import { CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { loadLeaseHandoverCliEnv } from "../../platform/five-plane-control-plane/config-center/ops-cli-env.js";
import { readTrimmedEnv } from "../../platform/five-plane-control-plane/config-center/runtime-env.js";
import { ExecutionLeaseService } from "../../platform/five-plane-execution/lease/execution-lease-service.js";

function printHelp(): void {
  process.stdout.write(
    [
      "Lease handover CLI",
      "",
      "New mode:",
      "  AA_LEASE_ID=<lease> AA_WORKER_ID=<old> AA_NEW_WORKER_ID=<new> npm run lease-handover",
      "",
      "Legacy compatibility:",
      "  AA_LEASE_HANDOVER_ACTION=handover AA_LEASE_EXECUTION_ID=<exec> AA_LEASE_NEW_WORKER_ID=<worker> npm run lease-handover",
      "  AA_LEASE_HANDOVER_ACTION=list npm run lease-handover",
    ].join("\n") + "\n",
  );
}

function resolveLegacyLeaseHandoverOutput(env: CliEnv): unknown | null {
  const action = readTrimmedEnv(env, "AA_LEASE_HANDOVER_ACTION");
  if (action == null || readTrimmedEnv(env, "AA_LEASE_ID") != null) {
    return null;
  }

  if (action === "help") {
    printHelp();
    return { mode: "help" };
  }

  const dbPath = readTrimmedEnv(env, "AA_DB_PATH");
  if (dbPath == null || !existsSync(dbPath)) {
    throw new ValidationError("lease_handover.database_not_found", "lease_handover.database_not_found");
  }

  if (action === "list") {
    return {
      mode: "list",
      dbPath,
      databaseExists: true,
    };
  }

  if (action !== "handover") {
    throw new ValidationError("lease_handover.invalid_action", "lease_handover.invalid_action");
  }

  const executionId = readTrimmedEnv(env, "AA_LEASE_EXECUTION_ID");
  const newWorkerId = readTrimmedEnv(env, "AA_LEASE_NEW_WORKER_ID");
  if (executionId == null || !executionId.startsWith("exec-")) {
    throw new ValidationError("lease_handover.invalid_execution_id", "lease_handover.invalid_execution_id");
  }
  if (newWorkerId == null) {
    throw new ValidationError("lease_handover.invalid_new_worker_id", "lease_handover.invalid_new_worker_id");
  }
  throw new ValidationError("lease_handover.legacy_handover_requires_live_lease", "lease_handover.legacy_handover_requires_live_lease");
}

/**
 * Main entry point for the lease handover CLI.
 *
 * Transfers an active execution lease from one worker to another while preserving
 * lineage and incrementing the fencing token to prevent split-brain scenarios.
 */
function main(): number {
  const env = readCliProcessEnv();
  if (process.argv.includes("--help")) {
    printHelp();
    return CLI_EXIT_SUCCESS;
  }

  const legacyOutput = resolveLegacyLeaseHandoverOutput(env);
  if (legacyOutput != null) {
    if ((legacyOutput as { mode?: string }).mode !== "help") {
      process.stdout.write(`${JSON.stringify(legacyOutput, null, 2)}\n`);
    }
    return CLI_EXIT_SUCCESS;
  }

  const envConfig = loadLeaseHandoverCliEnv();
  const result = withCliStorage((storage) => {
    const leases = new ExecutionLeaseService(storage.sql, storage.store);
    return leases.handoverLease({
      leaseId: envConfig.leaseId,
      workerId: envConfig.workerId,
      newWorkerId: envConfig.newWorkerId,
      ttlMs: envConfig.ttlMs,
      reasonCode: envConfig.reasonCode,
      ...(envConfig.occurredAt ? { occurredAt: envConfig.occurredAt } : {}),
    });
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main, {
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
    },
  });
}
