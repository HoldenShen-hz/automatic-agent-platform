import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";

const TAKEOVER_ACTIONS = [
  "open",
  "modify_input",
  "switch_worker",
  "retry_execution",
  "set_current_step",
  "write_step_output",
  "skip_step",
  "complete_task",
] as const;

const STEP_OUTPUT_STATUSES = ["succeeded", "failed", "partial_success"] as const;
const TERMINAL_STATUSES = ["done", "failed", "cancelled"] as const;
type StepOutputStatus = typeof STEP_OUTPUT_STATUSES[number];

export interface TakeoverCliEnvConfig {
  dbPath: string | null;
  action: typeof TAKEOVER_ACTIONS[number];
  taskId: string | null;
  operatorId: string | null;
  takeoverSessionId: string | null;
  inputJson: string | null;
  normalizedInputJson: string | null;
  agentId: string | null;
  terminalStatus: TaskTerminalStatus | null;
  reasonCode: string | null;
  outputJson: string | null;
  nodeRunId: string | null;
  stepId: string | null;
  stepIndex: number | null;
  stepOutputJson: string | null;
  stepStatus: StepOutputStatus | null;
  stepSummary: string | null;
  note: string | null;
  tenantId: string | null;
}

function readAction(env: NodeJS.ProcessEnv): TakeoverCliEnvConfig["action"] {
  const action = readTrimmedEnv(env, "AA_TAKEOVER_ACTION");
  if (action == null) {
    throw new ValidationError("missing_env:AA_TAKEOVER_ACTION", "missing_env:AA_TAKEOVER_ACTION");
  }
  if (!TAKEOVER_ACTIONS.includes(action as TakeoverCliEnvConfig["action"])) {
    throw new ValidationError(`unknown_takeover_action:${action}`, `unknown_takeover_action:${action}`);
  }
  return action as TakeoverCliEnvConfig["action"];
}

function readOptionalInteger(env: NodeJS.ProcessEnv, name: string): number | null {
  const value = readTrimmedEnv(env, name);
  if (value == null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new ValidationError(`invalid_integer_env:${name}`, `invalid_integer_env:${name}`);
  }
  return parsed;
}

function readStepStatus(env: NodeJS.ProcessEnv): TakeoverCliEnvConfig["stepStatus"] {
  const value = readTrimmedEnv(env, "AA_STEP_STATUS");
  if (value == null) {
    return null;
  }
  if (!STEP_OUTPUT_STATUSES.includes(value as StepOutputStatus)) {
    throw new ValidationError("takeover.invalid_step_status", "takeover.invalid_step_status");
  }
  return value as StepOutputStatus;
}

function readTerminalStatus(env: NodeJS.ProcessEnv): TakeoverCliEnvConfig["terminalStatus"] {
  const value = readTrimmedEnv(env, "AA_TERMINAL_STATUS");
  if (value == null) {
    return null;
  }
  if (!TERMINAL_STATUSES.includes(value as TaskTerminalStatus)) {
    throw new ValidationError("takeover.invalid_terminal_status", "takeover.invalid_terminal_status");
  }
  return value as TaskTerminalStatus;
}

export function loadTakeoverCliEnv(env: NodeJS.ProcessEnv = process.env): TakeoverCliEnvConfig {
  return {
    dbPath: readTrimmedEnv(env, "AA_DB_PATH") ?? null,
    action: readAction(env),
    taskId: readTrimmedEnv(env, "AA_TASK_ID") ?? null,
    operatorId: readTrimmedEnv(env, "AA_OPERATOR_ID") ?? null,
    takeoverSessionId: readTrimmedEnv(env, "AA_TAKEOVER_SESSION_ID") ?? null,
    inputJson: readTrimmedEnv(env, "AA_INPUT_JSON") ?? null,
    normalizedInputJson: readTrimmedEnv(env, "AA_NORMALIZED_INPUT_JSON") ?? null,
    agentId: readTrimmedEnv(env, "AA_AGENT_ID") ?? null,
    terminalStatus: readTerminalStatus(env),
    reasonCode: readTrimmedEnv(env, "AA_REASON_CODE") ?? null,
    outputJson: readTrimmedEnv(env, "AA_OUTPUT_JSON") ?? null,
    nodeRunId: readTrimmedEnv(env, "AA_NODE_RUN_ID") ?? null,
    stepId: readTrimmedEnv(env, "AA_STEP_ID") ?? null,
    stepIndex: readOptionalInteger(env, "AA_STEP_INDEX"),
    stepOutputJson: readTrimmedEnv(env, "AA_STEP_OUTPUT_JSON") ?? null,
    stepStatus: readStepStatus(env),
    stepSummary: readTrimmedEnv(env, "AA_STEP_SUMMARY") ?? null,
    note: readTrimmedEnv(env, "AA_NOTE") ?? null,
    tenantId: readTrimmedEnv(env, "AA_TENANT_ID") ?? null,
  };
}
