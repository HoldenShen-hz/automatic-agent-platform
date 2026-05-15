/**
 * Replay Recovery CLI Tool
 *
 * This module provides a command-line interface for building replay reports
 * that reconstruct task or execution state for recovery analysis.
 *
 * Kinds:
 *   - task: Build replay report for a task
 *   - execution: Build replay report for an execution
 *
 * Usage:
 *   npm run replay-recovery
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Recovery replay
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md} - Recovery drills
 * @see {@link docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md} - Disaster recovery
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
import { existsSync } from "node:fs";

import { withCliStorage } from "./authoritative-storage.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { loadReplayRecoveryCliEnv } from "../../platform/five-plane-control-plane/config-center/ops-cli-env.js";
import { readTrimmedEnv } from "../../platform/five-plane-control-plane/config-center/runtime-env.js";
import { RuntimeRecoveryReplayService } from "../../platform/five-plane-execution/recovery/runtime-recovery-replay-service-root.js";

function printHelp(): void {
  process.stdout.write(
    [
      "Replay recovery CLI",
      "",
      "New mode:",
      "  AA_RECOVERY_REPLAY_KIND=task AA_TASK_ID=<id> npm run replay-recovery",
      "  AA_RECOVERY_REPLAY_KIND=execution AA_EXECUTION_ID=<id> npm run replay-recovery",
      "",
      "Legacy compatibility:",
      "  AA_REPLAY_RECOVERY_ACTION=replay AA_REPLAY_TASK_ID=<id> npm run replay-recovery",
      "  AA_REPLAY_RECOVERY_ACTION=status npm run replay-recovery",
    ].join("\n") + "\n",
  );
}

function resolveLegacyReplayOutput(): unknown | null {
  const action =
    readTrimmedEnv(process.env, "AA_REPLAY_RECOVERY_ACTION")
    ?? readTrimmedEnv(process.env, "AA_RECOVERY_ACTION");
  if (action == null || readTrimmedEnv(process.env, "AA_RECOVERY_REPLAY_KIND") != null) {
    return null;
  }

  if (action === "help") {
    printHelp();
    return { mode: "help" };
  }

  const dbPath = readTrimmedEnv(process.env, "AA_DB_PATH");
  if (dbPath == null || !existsSync(dbPath)) {
    throw new ValidationError("replay_recovery.database_not_found", "replay_recovery.database_not_found");
  }

  if (action === "status" || action === "scan") {
    return {
      mode: action,
      dbPath,
      databaseExists: true,
    };
  }

  if (action !== "replay") {
    throw new ValidationError("replay_recovery.invalid_action", "replay_recovery.invalid_action");
  }

  const taskId = readTrimmedEnv(process.env, "AA_REPLAY_TASK_ID") ?? readTrimmedEnv(process.env, "AA_TASK_ID");
  if (taskId == null) {
    throw new ValidationError("missing_env:AA_REPLAY_TASK_ID", "missing_env:AA_REPLAY_TASK_ID");
  }

  return withCliStorage((storage) => {
    const replay = new RuntimeRecoveryReplayService(storage.store);
    return replay.buildTaskReplayReport(taskId);
  }, { dbPath, migrate: false });
}

function main(): void {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const legacyOutput = resolveLegacyReplayOutput();
  if (legacyOutput != null) {
    if ((legacyOutput as { mode?: string }).mode !== "help") {
      process.stdout.write(`${JSON.stringify(legacyOutput, null, 2)}\n`);
    }
    return;
  }

  const envConfig = loadReplayRecoveryCliEnv();
  const output = withCliStorage((storage) => {
    const replay = new RuntimeRecoveryReplayService(storage.store);
    switch (envConfig.kind) {
      case "task":
        if (envConfig.taskId == null) {
          throw new ValidationError("missing_env:AA_TASK_ID", "missing_env:AA_TASK_ID");
        }
        return replay.buildTaskReplayReport(envConfig.taskId);
      case "execution":
        if (envConfig.executionId == null) {
          throw new ValidationError("missing_env:AA_EXECUTION_ID", "missing_env:AA_EXECUTION_ID");
        }
        return replay.buildExecutionReplayReport(envConfig.executionId);
      default:
        throw new ValidationError(
          `unknown_recovery_replay_kind:${envConfig.kind}`,
          `unknown_recovery_replay_kind:${envConfig.kind}`,
        );
    }
  }, { dbPath: envConfig.dbPath });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
