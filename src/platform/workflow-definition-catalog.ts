/**
 * Workflow Definition Catalog
 *
 * Neutral workflow-definition read model shared across planes.
 * Control-plane and execution paths consume this catalog without
 * depending on orchestration implementation modules directly.
 */

import { join } from "node:path";

import { getDefaultDivisionRegistry } from "../domains/governance/division-loader.js";
import { DEFAULT_DIVISIONS_ROOT } from "../domains/governance/division-loader-support.js";

export const GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH = join(
  DEFAULT_DIVISIONS_ROOT,
  "general-ops",
  "schemas",
  "minimal-output.json",
);

const MINIMAL_WORKFLOW_TIMEOUTS_MS = {
  analyze: 120_000,
  triage: 60_000,
  draft: 180_000,
  review: 90_000,
} as const;

export type CompensationModel =
  | "idempotent_replay"
  | "compare_and_swap_write"
  | "compensating_action"
  | "manual_reconciliation_required";

export interface MinimalWorkflowStep {
  stepId: string;
  divisionId?: string | null;
  roleId: string;
  inputKeys?: readonly string[];
  outputKey: string;
  outputSchemaPath?: string | null;
  timeoutMs: number;
  maxAttempts: number;
  dependsOnStepIds?: readonly string[];
  dependencyTypes?: Readonly<Record<string, "hard" | "soft">>;
  compensationModel?: CompensationModel;
}

export interface MinimalWorkflowDefinition {
  workflowId: string;
  divisionId: string;
  steps: readonly MinimalWorkflowStep[];
}

export type WorkflowTemplate = MinimalWorkflowDefinition;

export const SINGLE_AGENT_MINIMAL_WORKFLOW: MinimalWorkflowDefinition = {
  workflowId: "single_agent_minimal",
  divisionId: "general-ops",
  steps: [
    {
      stepId: "analyze_request",
      roleId: "general_executor",
      outputKey: "analysis",
      outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
      timeoutMs: MINIMAL_WORKFLOW_TIMEOUTS_MS.analyze,
      maxAttempts: 1,
      compensationModel: "idempotent_replay",
    },
  ],
};

export const PHASE_1B_SINGLE_DIVISION_WORKFLOW: MinimalWorkflowDefinition = {
  workflowId: "single_division_multi_step_orchestration",
  divisionId: "general-ops",
  steps: [
    {
      stepId: "intake_triage",
      roleId: "intake_router",
      inputKeys: [],
      outputKey: "triage",
      outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
      timeoutMs: MINIMAL_WORKFLOW_TIMEOUTS_MS.triage,
      maxAttempts: 1,
      dependsOnStepIds: [],
      compensationModel: "idempotent_replay",
    },
    {
      stepId: "draft_solution",
      roleId: "general_executor",
      inputKeys: ["triage"],
      outputKey: "draft",
      outputSchemaPath: GENERAL_OPS_MINIMAL_OUTPUT_SCHEMA_PATH,
      timeoutMs: MINIMAL_WORKFLOW_TIMEOUTS_MS.draft,
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
      timeoutMs: MINIMAL_WORKFLOW_TIMEOUTS_MS.review,
      maxAttempts: 1,
      dependsOnStepIds: ["draft_solution"],
      compensationModel: "idempotent_replay",
    },
  ],
};

export const WORKFLOW_DEFINITIONS: ReadonlyMap<string, MinimalWorkflowDefinition> = new Map([
  [SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId, SINGLE_AGENT_MINIMAL_WORKFLOW],
  [PHASE_1B_SINGLE_DIVISION_WORKFLOW.workflowId, PHASE_1B_SINGLE_DIVISION_WORKFLOW],
]);

export function getWorkflowDefinition(workflowId: string): MinimalWorkflowDefinition | null {
  return getDefaultDivisionRegistry()?.workflows.get(workflowId) ?? WORKFLOW_DEFINITIONS.get(workflowId) ?? null;
}
