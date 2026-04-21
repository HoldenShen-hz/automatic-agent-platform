/**
 * FailureMode — categorizes how and why task execution failed.
 *
 * §A.8: Structured failure classification used by the learning system
 * to identify patterns, group related failures, and generate recovery playbooks.
 */
export interface FailureMode {
    /** Unique identifier for this failure mode */
    failureModeId: string;
    /** Category of the failure */
    category: FailureCategory;
    /** Human-readable name of the failure type */
    name: string;
    /** Detailed explanation of what went wrong */
    description: string;
    /** Likely root cause(s) */
    rootCauses: string[];
    /** Steps taken before the failure occurred */
    contextBeforeFailure: string[];
    /** Error code pattern this failure matches (for programmatic detection) */
    errorCodePattern: string;
    /** Severity level */
    severity: "low" | "medium" | "high" | "critical";
    /** Whether recovery is possible via retry or workaround */
    recoverable: boolean;
    /** Suggested recovery strategy if recoverable */
    recoveryStrategy?: string;
    /** Tags for grouping related failure modes */
    tags: string[];
}
/** High-level failure categories */
export type FailureCategory = "tool_execution" | "validation" | "resource_exhaustion" | "dependency" | "timeout" | "auth_permission" | "network" | "data_quality" | "planning" | "unknown";
