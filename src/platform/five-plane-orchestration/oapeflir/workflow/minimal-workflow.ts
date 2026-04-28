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

const GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH = join(
  DEFAULT_DIVISIONS_ROOT,
  "general_ops",
  "schemas",
  "minimal-output.json",
);

/**
 * Compensation model for steps that produce side effects.
 * @see workflow_static_analysis_and_compensation_contract.md §5
 */
export type CompensationModel =
  | "idempotent_replay"
  | "compare_and_swap_write"
  | "compensating_action"
  | "manual_reconciliation_required";

/**
 * Represents a single step within a workflow.
 *
 * Each step is assigned to a role and produces an output under a specified key.
 * Steps can declare dependencies on other steps, creating a directed acyclic graph
 * of execution order.
 */
export interface MinimalWorkflowStep {
  /** Unique identifier for this step within the workflow */
  stepId: string;
  /** Division that owns the step execution. Defaults to the workflow's division when omitted. */
  divisionId?: string | null;
  /** Role that will execute this step (determines available tools and permissions) */
  roleId: string;
  /** Output keys from upstream dependencies that must be available before this step can execute. */
  inputKeys?: readonly string[];
  /** Key to store step output under for consumption by dependent steps */
  outputKey: string;
  /** Absolute schema path used to validate this step's output before downstream consumption */
  outputSchemaPath?: string | null;
  /** Maximum time in milliseconds before step times out */
  timeoutMs: number;
  /** Maximum number of execution attempts on failure */
  maxAttempts: number;
  /** Step IDs this step depends on (will not execute until all dependencies complete) */
  dependsOnStepIds?: readonly string[];
  /** Dependency type per upstream step ID. Defaults to "hard" if not specified.
   *  - "hard": downstream is skipped if upstream fails/is skipped
   *  - "soft": downstream still executes; missing input filled with null */
  dependencyTypes?: Readonly<Record<string, "hard" | "soft">>;
  /** Compensation model for steps with side effects (§5 of workflow_static_analysis_and_compensation_contract).
   *  - "idempotent_replay": re-executing the step produces the same result
   *  - "compare_and_swap_write": uses CAS to detect stale writes
   *  - "compensating_action": a reverse action undoes the side effect
   *  - "manual_reconciliation_required": human intervention needed on failure */
  compensationModel?: CompensationModel;
}

/**
 * A complete workflow definition with ordered steps and dependencies.
 *
 * Workflows are directed acyclic graphs of steps. Steps without dependencies
 * are entrypoints and execute first. Steps with dependencies wait for all
 * their dependencies to complete before starting.
 */
export interface MinimalWorkflowDefinition {
  /** Unique identifier for this workflow */
  workflowId: string;
  /** Division that owns this workflow (determines configuration context) */
  divisionId: string;
  /** Ordered steps with dependency relationships */
  steps: readonly MinimalWorkflowStep[];
}

/**
 * Pre-defined workflow for simple single-agent operations.
 *
 * Executes a single step with the general_executor role to analyze
 * the incoming request. Suitable for straightforward tasks that
 * don't require approval or multi-phase processing.
 */
export const SINGLE_AGENT_MINIMAL_WORKFLOW: MinimalWorkflowDefinition = {
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
export const PHASE_1B_SINGLE_DIVISION_WORKFLOW: MinimalWorkflowDefinition = {
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
export const WORKFLOW_DEFINITIONS: ReadonlyMap<string, MinimalWorkflowDefinition> = new Map([
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
export function getWorkflowDefinition(workflowId: string): MinimalWorkflowDefinition | null {
  return getDefaultDivisionRegistry()?.workflows.get(workflowId) ?? WORKFLOW_DEFINITIONS.get(workflowId) ?? null;
}
