/**
 * Workflow Validator - Static analysis for workflow definitions
 *
 * This module provides validation services for workflow definitions. It performs
 * static analysis to detect common issues before workflow execution, including:
 *
 * - Structural problems (empty workflows, missing IDs)
 * - Duplicate entries (step IDs, output keys)
 * - Dependency issues (missing targets, self-references, cycles)
 * - Invalid configuration (negative timeouts, invalid attempt counts)
 * - Execution hazards (workflows with no entrypoint)
 *
 * The validator produces a lint report with categorized issues and a boolean
 * indicating whether the workflow is executable.
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/governance/glossary_and_terminology.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/architecture/00-platform-architecture.md}
 *
 * @packageDocumentation
 */
import type { MinimalWorkflowDefinition } from "./minimal-workflow.js";
/**
 * Severity levels for workflow validation issues.
 * - "error": Prevents workflow execution
 * - "warning": Potential issue but workflow may still run
 */
export type WorkflowLintSeverity = "error" | "warning";
/**
 * A single issue found during workflow validation.
 * Contains a machine-readable code, severity, human message, and optional
 * step identifiers for locating the issue within the workflow.
 */
export interface WorkflowLintIssue {
    /** Machine-readable error code identifying the issue type */
    code: "workflow.empty" | "step.missing_id" | "step.duplicate_id" | "step.missing_role" | "step.missing_output_key" | "step.missing_output_schema" | "step.invalid_input_key" | "step.duplicate_output_key" | "step.invalid_timeout" | "step.invalid_max_attempts" | "dependency.missing_target" | "dependency.self_reference" | "dependency.duplicate" | "dependency.missing_input_key" | "dependency.cycle" | "workflow.no_entrypoint";
    /** Error severity - errors prevent execution, warnings are advisory */
    severity: WorkflowLintSeverity;
    /** Human-readable description of the issue */
    message: string;
    /** Step ID where the issue was found (if applicable) */
    stepId?: string;
    /** Dependency step ID relevant to the issue (if applicable) */
    dependencyStepId?: string;
}
/**
 * Report from workflow validation containing all detected issues.
 *
 * The `ok` field indicates whether the workflow passed validation.
 * A workflow is considered valid (ok=true) only if it has zero errors.
 * Warnings do not prevent execution but should be reviewed.
 */
export interface WorkflowLintReport {
    /** True if workflow passed all validation checks (no errors) */
    ok: boolean;
    /** All issues found during validation */
    issues: WorkflowLintIssue[];
    /** Count of issues with severity "error" */
    errorCount: number;
    /** Count of issues with severity "warning" */
    warningCount: number;
}
/**
 * Validates workflow definitions for structural correctness and runtime safety.
 *
 * Performs multi-pass validation:
 * 1. Structural checks (empty workflow, missing IDs, duplicates)
 * 2. Field validation (non-empty roles, valid timeouts, positive attempts)
 * 3. Dependency validation (targets exist, no self-references, no duplicates)
 * 4. Graph analysis (entrypoint detection, cycle detection)
 *
 * Use {@link assertWorkflowValid} for fail-fast behavior, or {@link validate}
 * when you need to inspect all issues.
 */
export declare class WorkflowValidator {
    /**
     * Validates a workflow definition and returns a detailed lint report.
     *
     * @param definition - The workflow definition to validate
     * @returns Lint report with all issues found and error/warning counts
     */
    validate(definition: MinimalWorkflowDefinition): WorkflowLintReport;
    /**
     * Detects dependency cycles using depth-first search with three-color marking.
     *
     * Algorithm:
     * - WHITE (unvisited): Not yet examined
     * - GRAY (visiting): Currently in DFS stack, on current path
     * - BLACK (visited): Fully processed, no cycles on this path
     *
     * When a GRAY node is encountered during DFS, a cycle exists.
     */
    private detectCycles;
}
/**
 * Validates a workflow and throws if it contains any errors.
 *
 * Convenience function for fail-fast validation at workflow load time.
 *
 * @param definition - The workflow definition to validate
 * @returns The validation report if workflow is valid
 * @throws Error with code "workflow.invalid:{code}" if validation fails
 */
export declare function assertWorkflowValid(definition: MinimalWorkflowDefinition): WorkflowLintReport;
