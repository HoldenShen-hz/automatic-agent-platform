/**
 * SuccessCriterion — defines what constitutes successful task completion.
 *
 * §A.7: Describes the acceptance criteria for a plan or step,
 * used by validators and quality gates to assess execution outcomes.
 */
export interface SuccessCriterion {
    /** Unique identifier for this criterion */
    criterionId: string;
    /** Human-readable description of the criterion */
    description: string;
    /** Type of validation to perform */
    validationType: "boolean" | "threshold" | "regex_match" | "output_schema" | "artifact_exists";
    /** Field or path in the output to validate */
    targetPath: string;
    /** Expected value or condition */
    expectedValue: unknown;
    /** For threshold type: comparison operator */
    operator?: "gte" | "lte" | "gt" | "lt" | "eq" | "neq";
    /** Whether this criterion must pass for overall success */
    required: boolean;
    /** Severity when criterion fails */
    severity: "critical" | "warning" | "info";
}
