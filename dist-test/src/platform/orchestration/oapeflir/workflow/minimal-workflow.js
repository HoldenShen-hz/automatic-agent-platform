/**
 * Minimal Workflow Definitions
 *
 * ## Overview
 *
 * Defines core workflow structures composed of steps that execute sequentially
 * or with dependencies, each assigned to a specific role.
 *
 * ## Key Concepts
 *
 * - **Workflow**: Structured execution path for a task
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: workflow}
 *
 * - **Step**: Single execution unit within a workflow
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: step}
 *
 * - **Division**: Business capability domain or division boundary
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: division}
 *
 * ## Workflow Structure
 *
 * - Division ownership (determines available roles and configuration)
 * - Ordered steps with dependency relationships (DAG)
 * - Timeout and retry configuration per step
 * - Output keys for capturing step results
 *
 * @see Workflow Contract: docs_zh/contracts/workflow_static_analysis_and_compensation_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 *
 * @packageDocumentation
 */
import { join } from "node:path";
import { getDefaultDivisionRegistry } from "../../../../domains/governance/division-loader.js";
import { DEFAULT_DIVISIONS_ROOT } from "../../../../domains/governance/division-loader-support.js";
const GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH = join(DEFAULT_DIVISIONS_ROOT, "general_ops", "schemas", "minimal-output.json");
/**
 * Pre-defined workflow for simple single-agent operations.
 *
 * Executes a single step with the general_executor role to analyze
 * the incoming request. Suitable for straightforward tasks that
 * don't require approval or multi-phase processing.
 */
export const SINGLE_AGENT_MINIMAL_WORKFLOW = {
    workflowId: "single_agent_minimal",
    divisionId: "general_ops",
    steps: [
        {
            stepId: "analyze_request",
            roleId: "general_executor",
            outputKey: "analysis",
            outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
            timeoutMs: 120_000,
            maxAttempts: 1,
            compensationModel: "idempotent_replay",
        },
    ],
};
/**
 * Pre-defined three-phase workflow for production operations.
 *
 * Phase 1b workflow demonstrating dependency chains:
 * 1. Intake triage (entrypoint) - classifies incoming request
 * 2. Draft solution - executes based on triage, depends on triage
 * 3. Final review - validates draft, depends on draft solution
 *
 * Suitable for operations requiring review and approval before completion.
 */
export const PHASE_1B_SINGLE_DIVISION_WORKFLOW = {
    workflowId: "single_division_multi_step_orchestration",
    divisionId: "general_ops",
    steps: [
        {
            stepId: "intake_triage",
            roleId: "intake_router",
            outputKey: "triage",
            outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
            timeoutMs: 60_000,
            maxAttempts: 1,
            compensationModel: "idempotent_replay",
        },
        {
            stepId: "draft_solution",
            roleId: "general_executor",
            inputKeys: ["triage"],
            outputKey: "draft",
            outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
            timeoutMs: 180_000,
            maxAttempts: 2,
            dependsOnStepIds: ["intake_triage"],
            compensationModel: "idempotent_replay",
        },
        {
            stepId: "final_review",
            roleId: "workflow_planner",
            inputKeys: ["draft"],
            outputKey: "final",
            outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
            timeoutMs: 90_000,
            maxAttempts: 1,
            dependsOnStepIds: ["draft_solution"],
            compensationModel: "idempotent_replay",
        },
    ],
};
/**
 * Registry of built-in workflow definitions.
 * Maps workflow ID to definition for quick lookup.
 */
export const WORKFLOW_DEFINITIONS = new Map([
    [SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId, SINGLE_AGENT_MINIMAL_WORKFLOW],
    [PHASE_1B_SINGLE_DIVISION_WORKFLOW.workflowId, PHASE_1B_SINGLE_DIVISION_WORKFLOW],
]);
/**
 * Retrieves a workflow definition by ID.
 *
 * Checks the default division registry first for custom workflows,
 * then falls back to built-in definitions.
 *
 * @param workflowId - The workflow identifier to look up
 * @returns The workflow definition or null if not found
 */
export function getWorkflowDefinition(workflowId) {
    return getDefaultDivisionRegistry()?.workflows.get(workflowId) ?? WORKFLOW_DEFINITIONS.get(workflowId) ?? null;
}
//# sourceMappingURL=minimal-workflow.js.map