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
import { ValidationError } from "../../../contracts/errors.js";
/**
 * Normalizes a step ID by trimming whitespace.
 */
function normalizeStepId(value) {
    return value.trim();
}
/**
 * Checks if a value is a positive integer (>= 1).
 */
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
/**
 * Collects step IDs that have no dependencies (entrypoints).
 *
 * These steps can begin execution immediately without waiting
 * for any other steps to complete.
 */
function collectEntrypoints(steps) {
    return steps
        .filter((step) => (step.dependsOnStepIds?.length ?? 0) === 0)
        .map((step) => step.stepId);
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
export class WorkflowValidator {
    /**
     * Validates a workflow definition and returns a detailed lint report.
     *
     * @param definition - The workflow definition to validate
     * @returns Lint report with all issues found and error/warning counts
     */
    validate(definition) {
        const issues = [];
        const seenStepIds = new Set();
        const seenOutputKeys = new Set();
        const stepIds = new Set();
        if (definition.steps.length === 0) {
            issues.push({
                code: "workflow.empty",
                severity: "error",
                message: `Workflow ${definition.workflowId} must define at least one step.`,
            });
        }
        // Pass 1: Validate individual step fields and check for duplicates
        for (const step of definition.steps) {
            const stepId = normalizeStepId(step.stepId);
            const roleId = step.roleId.trim();
            const inputKeys = (step.inputKeys ?? []).map((inputKey) => inputKey.trim());
            const outputKey = step.outputKey.trim();
            const outputSchemaPath = step.outputSchemaPath?.trim() ?? "";
            if (stepId.length === 0) {
                issues.push({
                    code: "step.missing_id",
                    severity: "error",
                    message: "Workflow step id must be non-empty.",
                });
            }
            else if (seenStepIds.has(stepId)) {
                issues.push({
                    code: "step.duplicate_id",
                    severity: "error",
                    message: `Step id ${stepId} is duplicated.`,
                    stepId,
                });
            }
            else {
                seenStepIds.add(stepId);
                stepIds.add(stepId);
            }
            if (roleId.length === 0) {
                issues.push({
                    code: "step.missing_role",
                    severity: "error",
                    message: `Step ${stepId || "<unknown>"} must declare a role.`,
                    ...(stepId ? { stepId } : {}),
                });
            }
            for (const inputKey of inputKeys) {
                if (inputKey.length === 0) {
                    issues.push({
                        code: "step.invalid_input_key",
                        severity: "error",
                        message: `Step ${stepId || "<unknown>"} must not declare blank input keys.`,
                        ...(stepId ? { stepId } : {}),
                    });
                    break;
                }
            }
            if (outputKey.length === 0) {
                issues.push({
                    code: "step.missing_output_key",
                    severity: "error",
                    message: `Step ${stepId || "<unknown>"} must declare an output key.`,
                    ...(stepId ? { stepId } : {}),
                });
            }
            else if (seenOutputKeys.has(outputKey)) {
                issues.push({
                    code: "step.duplicate_output_key",
                    severity: "error",
                    message: `Output key ${outputKey} is duplicated.`,
                    ...(stepId ? { stepId } : {}),
                });
            }
            else {
                seenOutputKeys.add(outputKey);
            }
            if (outputSchemaPath.length === 0) {
                issues.push({
                    code: "step.missing_output_schema",
                    severity: "error",
                    message: `Step ${stepId || "<unknown>"} must declare an output schema path.`,
                    ...(stepId ? { stepId } : {}),
                });
            }
            if (!Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) {
                issues.push({
                    code: "step.invalid_timeout",
                    severity: "error",
                    message: `Step ${stepId || "<unknown>"} must declare a positive timeout.`,
                    ...(stepId ? { stepId } : {}),
                });
            }
            if (!isPositiveInteger(step.maxAttempts)) {
                issues.push({
                    code: "step.invalid_max_attempts",
                    severity: "error",
                    message: `Step ${stepId || "<unknown>"} must declare maxAttempts >= 1.`,
                    ...(stepId ? { stepId } : {}),
                });
            }
        }
        // Pass 2: Validate dependency references and relationships
        for (const step of definition.steps) {
            const stepId = normalizeStepId(step.stepId);
            const seenDependencies = new Set();
            const dependencyOutputKeys = new Set();
            for (const dependencyStepId of step.dependsOnStepIds ?? []) {
                const normalizedDependency = normalizeStepId(dependencyStepId);
                if (normalizedDependency.length === 0 || !stepIds.has(normalizedDependency)) {
                    issues.push({
                        code: "dependency.missing_target",
                        severity: "error",
                        message: `Step ${stepId} depends on missing step ${dependencyStepId}.`,
                        stepId,
                        dependencyStepId: dependencyStepId,
                    });
                    continue;
                }
                if (normalizedDependency === stepId) {
                    issues.push({
                        code: "dependency.self_reference",
                        severity: "error",
                        message: `Step ${stepId} cannot depend on itself.`,
                        stepId,
                        dependencyStepId: normalizedDependency,
                    });
                    continue;
                }
                if (seenDependencies.has(normalizedDependency)) {
                    issues.push({
                        code: "dependency.duplicate",
                        severity: "warning",
                        message: `Step ${stepId} repeats dependency ${normalizedDependency}.`,
                        stepId,
                        dependencyStepId: normalizedDependency,
                    });
                    continue;
                }
                seenDependencies.add(normalizedDependency);
                const dependency = definition.steps.find((candidate) => normalizeStepId(candidate.stepId) === normalizedDependency);
                const dependencyOutputKey = dependency?.outputKey.trim();
                if (dependencyOutputKey) {
                    dependencyOutputKeys.add(dependencyOutputKey);
                }
            }
            for (const inputKey of (step.inputKeys ?? []).map(normalizeStepId)) {
                if (!dependencyOutputKeys.has(inputKey)) {
                    issues.push({
                        code: "dependency.missing_input_key",
                        severity: "error",
                        message: `Step ${stepId} requires missing input key ${inputKey}.`,
                        stepId,
                    });
                }
            }
        }
        // Pass 3: Check for workflow-level issues (entrypoints, cycles)
        if (definition.steps.length > 0 && collectEntrypoints(definition.steps).length === 0) {
            issues.push({
                code: "workflow.no_entrypoint",
                severity: "error",
                message: `Workflow ${definition.workflowId} has no entrypoint step without dependencies.`,
            });
        }
        issues.push(...this.detectCycles(definition));
        const errorCount = issues.filter((issue) => issue.severity === "error").length;
        const warningCount = issues.length - errorCount;
        return {
            ok: errorCount === 0,
            issues,
            errorCount,
            warningCount,
        };
    }
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
    detectCycles(definition) {
        const issues = [];
        const graph = new Map();
        // Build adjacency list from step dependencies
        for (const step of definition.steps) {
            const stepId = normalizeStepId(step.stepId);
            if (stepId.length === 0) {
                continue;
            }
            graph.set(stepId, (step.dependsOnStepIds ?? []).map(normalizeStepId).filter((dependency) => dependency.length > 0));
        }
        const visiting = new Set();
        const visited = new Set();
        const visit = (stepId) => {
            if (visited.has(stepId)) {
                return;
            }
            if (visiting.has(stepId)) {
                // Found a back edge - cycle detected
                issues.push({
                    code: "dependency.cycle",
                    severity: "error",
                    message: `Dependency cycle detected at step ${stepId}.`,
                    stepId,
                });
                return;
            }
            visiting.add(stepId);
            for (const dependencyStepId of graph.get(stepId) ?? []) {
                if (graph.has(dependencyStepId)) {
                    visit(dependencyStepId);
                }
            }
            visiting.delete(stepId);
            visited.add(stepId);
        };
        for (const stepId of graph.keys()) {
            visit(stepId);
        }
        return issues;
    }
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
export function assertWorkflowValid(definition) {
    const report = new WorkflowValidator().validate(definition);
    if (!report.ok) {
        const firstError = report.issues.find((issue) => issue.severity === "error");
        throw new ValidationError(firstError ? `workflow.invalid:${firstError.code}` : "workflow.invalid:unknown", `${firstError ? `workflow.invalid:${firstError.code}` : "workflow.invalid:unknown"}: Workflow validation failed: ${firstError?.message ?? "unknown error"}`, { details: { issues: report.issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message })) } });
    }
    return report;
}
//# sourceMappingURL=workflow-validator.js.map