import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
const TAKEOVER_ACTIONS = [
    "open",
    "modify_input",
    "switch_worker",
    "retry_execution",
    "set_current_step",
    "write_step_output",
    "skip_step",
    "complete_task",
];
const STEP_OUTPUT_STATUSES = ["succeeded", "failed", "partial_success"];
const TERMINAL_STATUSES = ["done", "failed", "cancelled"];
function readAction(env) {
    const action = readTrimmedEnv(env, "AA_TAKEOVER_ACTION");
    if (action == null) {
        throw new ValidationError("missing_env:AA_TAKEOVER_ACTION", "missing_env:AA_TAKEOVER_ACTION");
    }
    if (!TAKEOVER_ACTIONS.includes(action)) {
        throw new ValidationError(`unknown_takeover_action:${action}`, `unknown_takeover_action:${action}`);
    }
    return action;
}
function readOptionalInteger(env, name) {
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
function readStepStatus(env) {
    const value = readTrimmedEnv(env, "AA_STEP_STATUS");
    if (value == null) {
        return null;
    }
    if (!STEP_OUTPUT_STATUSES.includes(value)) {
        throw new ValidationError("takeover.invalid_step_status", "takeover.invalid_step_status");
    }
    return value;
}
function readTerminalStatus(env) {
    const value = readTrimmedEnv(env, "AA_TERMINAL_STATUS");
    if (value == null) {
        return null;
    }
    if (!TERMINAL_STATUSES.includes(value)) {
        throw new ValidationError("takeover.invalid_terminal_status", "takeover.invalid_terminal_status");
    }
    return value;
}
export function loadTakeoverCliEnv(env = process.env) {
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
        stepId: readTrimmedEnv(env, "AA_STEP_ID") ?? null,
        stepIndex: readOptionalInteger(env, "AA_STEP_INDEX"),
        stepOutputJson: readTrimmedEnv(env, "AA_STEP_OUTPUT_JSON") ?? null,
        stepStatus: readStepStatus(env),
        stepSummary: readTrimmedEnv(env, "AA_STEP_SUMMARY") ?? null,
        note: readTrimmedEnv(env, "AA_NOTE") ?? null,
        tenantId: readTrimmedEnv(env, "AA_TENANT_ID") ?? null,
    };
}
//# sourceMappingURL=takeover-cli-env.js.map