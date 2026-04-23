/**
 * Runbook Executor Types
 *
 * Defines types for parsing, executing, and auditing markdown runbooks.
 *
 * ## Runbook Format
 *
 * Markdown runbooks have the following structure:
 * ```markdown
 * # Runbook Title
 *
 * ## Symptoms
 * - symptom description
 *
 * ## Diagnosis
 * 1. First diagnostic step
 * 2. Second diagnostic step
 *
 * ## Mitigation
 * 1. First mitigation action
 * 2. Second mitigation action
 *
 * ## Verification
 * 1. First verification check
 * 2. Second verification check
 * ```
 */
/**
 * Default runbook executor configuration.
 */
export const DEFAULT_RUNBOOK_EXECUTOR_CONFIG = {
    autoExecute: false,
    stepTimeoutMs: 300_000, // 5 minutes
    continueOnFailure: false,
    executeVerification: true,
};
//# sourceMappingURL=types.js.map