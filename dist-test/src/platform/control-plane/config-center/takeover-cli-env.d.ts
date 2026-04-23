import type { TaskTerminalStatus } from "../../contracts/types/status.js";
declare const TAKEOVER_ACTIONS: readonly ["open", "modify_input", "switch_worker", "retry_execution", "set_current_step", "write_step_output", "skip_step", "complete_task"];
declare const STEP_OUTPUT_STATUSES: readonly ["succeeded", "failed", "partial_success"];
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
    stepId: string | null;
    stepIndex: number | null;
    stepOutputJson: string | null;
    stepStatus: StepOutputStatus | null;
    stepSummary: string | null;
    note: string | null;
    tenantId: string | null;
}
export declare function loadTakeoverCliEnv(env?: NodeJS.ProcessEnv): TakeoverCliEnvConfig;
export {};
