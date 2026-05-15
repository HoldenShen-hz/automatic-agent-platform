/**
 * Human Takeover CLI
 *
 * This module provides a command-line interface for human-in-the-loop takeover operations.
 * It enables human operators to intervene in automated workflows by opening takeover sessions,
 * modifying task inputs, switching workers, and completing tasks with terminal statuses.
 *
 * Environment Variables (via loadTakeoverCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_TAKEOVER_ACTION: Action to perform - open, modify_input, switch_worker, retry_execution,
 *                        set_current_step, write_step_output, skip_step, complete_task
 *   - AA_TASK_ID: Task identifier for opening a takeover session
 *   - AA_OPERATOR_ID: Operator identifier taking over the task
 *   - AA_TAKEOVER_SESSION_ID: Takeover session identifier
 *   - AA_TENANT_ID: Optional tenant identifier
 *   - AA_NODE_RUN_ID: Canonical execution reference for manual step output correlation
 *   - Additional action-specific variables documented in loadTakeoverCliEnv
 *
 * Actions:
 *   - open: Open a human takeover session for a task
 *   - modify_input: Modify task input during a takeover session
 *   - switch_worker: Switch to a different worker agent
 *   - retry_execution: Retry execution of a step or task
 *   - set_current_step: Set the current step being worked on
 *   - write_step_output: Write output for a workflow step
 *   - skip_step: Skip the current step in the workflow
 *   - complete_task: Complete the task with a terminal status
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for takeover architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for workflow terminology
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadTakeoverCliEnv } from "../../platform/five-plane-control-plane/config-center/takeover-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { HumanTakeoverService } from "../../platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import type { TaskTerminalStatus } from "../../platform/contracts/types/status.js";

/**
 * Retrieves a required environment variable value, throwing if null or empty.
 *
 * @param value - The environment variable value to validate
 * @param name - The name of the environment variable (for error messages)
 * @returns The non-empty string value
 * @throws ValidationError if the value is null or empty
 */
function requireEnvValue(value: string | null, name: string): string {
  if (value == null) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
  }
  return value;
}

/**
 * Retrieves a required terminal status value, throwing if null.
 *
 * @param value - The environment variable value to validate
 * @param name - The name of the environment variable (for error messages)
 * @returns The terminal status value
 * @throws ValidationError if the value is null
 */
function requireTerminalStatus(value: TaskTerminalStatus | null, name: string): TaskTerminalStatus {
  if (value == null) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
  }
  return value;
}

function main(): void {
  const envConfig = loadTakeoverCliEnv();
  const result = withCliStorage((storage) => {
    const db = storage.sql;
    const store = storage.store;
    const takeover = new HumanTakeoverService(db, store);
    const stepIndex = envConfig.stepIndex ?? undefined;
    const stepStatus = envConfig.stepStatus ?? undefined;

    switch (envConfig.action) {
      case "open":
        return takeover.openSession({
          taskId: requireEnvValue(envConfig.taskId, "AA_TASK_ID"),
          operatorId: requireEnvValue(envConfig.operatorId, "AA_OPERATOR_ID"),
          reasonCode: envConfig.reasonCode ?? "takeover.open",
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "modify_input":
        return takeover.modifyInput({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          inputJson: requireEnvValue(envConfig.inputJson, "AA_INPUT_JSON"),
          reasonCode: envConfig.reasonCode ?? "takeover.modify_input",
          ...(envConfig.normalizedInputJson ? { normalizedInputJson: envConfig.normalizedInputJson } : {}),
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "switch_worker":
        return takeover.switchWorker({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          agentId: requireEnvValue(envConfig.agentId, "AA_AGENT_ID"),
          reasonCode: envConfig.reasonCode ?? "takeover.switch_worker",
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "retry_execution":
        return takeover.retryExecution({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          reasonCode: envConfig.reasonCode ?? "takeover.retry_execution",
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "set_current_step":
        return takeover.setCurrentStep({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          reasonCode: envConfig.reasonCode ?? "takeover.set_current_step",
          ...(envConfig.stepId ? { stepId: envConfig.stepId } : {}),
          ...(stepIndex !== undefined ? { stepIndex } : {}),
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "write_step_output":
        return takeover.writeStepOutput({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          outputJson: requireEnvValue(envConfig.stepOutputJson, "AA_STEP_OUTPUT_JSON"),
          reasonCode: envConfig.reasonCode ?? "takeover.write_step_output",
          ...(envConfig.nodeRunId ? { nodeRunId: envConfig.nodeRunId } : {}),
          ...(envConfig.stepId ? { stepId: envConfig.stepId } : {}),
          ...(stepIndex !== undefined ? { stepIndex } : {}),
          ...(stepStatus !== undefined ? { status: stepStatus } : {}),
          ...(envConfig.stepSummary ? { summary: envConfig.stepSummary } : {}),
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "skip_step":
        return takeover.skipCurrentStep({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          reasonCode: envConfig.reasonCode ?? "takeover.skip_step",
          ...(envConfig.note ? { note: envConfig.note } : {}),
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      case "complete_task":
        return takeover.completeTask({
          takeoverSessionId: requireEnvValue(envConfig.takeoverSessionId, "AA_TAKEOVER_SESSION_ID"),
          terminalStatus: requireTerminalStatus(envConfig.terminalStatus, "AA_TERMINAL_STATUS"),
          reasonCode: envConfig.reasonCode ?? "takeover.complete_task",
          ...(envConfig.outputJson ? { outputJson: envConfig.outputJson } : {}),
          ...(envConfig.tenantId != null ? { tenantId: envConfig.tenantId } : {}),
        });
      default:
        throw new ValidationError(`unknown_takeover_action:${envConfig.action}`, `unknown_takeover_action:${envConfig.action}`);
    }
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
