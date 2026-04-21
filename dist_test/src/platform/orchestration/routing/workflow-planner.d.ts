/**
 * Workflow Planner (Business Alias: VP Orchestration)
 *
 * ## Overview
 *
 * Transforms workflow definitions into executable execution plans.
 * Bridges static workflow definitions (from divisions) with dynamic execution runtime.
 *
 * ## Architecture Role
 *
 * Part of the control layer canonical mapping:
 * - Canonical ID: workflow_planner
 * - Business Alias: VP Orchestration
 * - Responsibility: Cross-division splitting, dependency graph, result aggregation, failure escalation
 *
 * ## Key Concepts
 *
 * - **Workflow**: Structured execution path defining steps, dependencies, I/O, and failure paths
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: workflow}
 *
 * - **Step**: Single execution unit within a workflow
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: step}
 *
 * ## Output
 *
 * - Concrete execution steps ready for agent dispatch
 * - Dependency edges for step ordering (DAG construction)
 * - Agent assignments derived from role IDs
 *
 * @see Architecture: docs_zh/architecture/00-platform-architecture.md
 * @see Workflow Routing ADR: docs_zh/adr/004-workflow-routing.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md (workflow_planner)
 */
import type { CompensationModel, MinimalWorkflowDefinition } from "../oapeflir/workflow/minimal-workflow.js";
/**
 * A workflow step prepared for execution, including agent assignment
 * and runtime parameters derived from the workflow definition.
 */
export interface PlannedExecutionStep {
    /** Unique identifier for this step within the workflow */
    stepId: string;
    /** Division that owns the step execution */
    divisionId: string;
    /** ID of the role that will execute this step */
    roleId: string;
    /** Output keys this step expects from upstream dependencies */
    inputKeys: readonly string[];
    /** Computed agent ID that will handle this step (agent_{roleId}) */
    agentId: string;
    /** Key where this step's output will be stored */
    outputKey: string;
    /** Schema path used to validate the step output before it is committed */
    outputSchemaPath?: string | null;
    /** IDs of steps that must complete before this step begins */
    dependsOnStepIds: readonly string[];
    /** Dependency type per upstream step ID ("hard" default, "soft" allows null fallback) */
    dependencyTypes: Readonly<Record<string, "hard" | "soft">>;
    /** Maximum time in milliseconds before this step times out */
    timeoutMs: number;
    /** Maximum number of retry attempts for this step */
    maxAttempts: number;
    /** Compensation model for recovery when the step has side effects */
    compensationModel?: CompensationModel;
}
/**
 * A complete execution plan for a workflow, ready for the runtime executor.
 */
export interface PlannedWorkflow {
    /** The original workflow definition */
    workflow: MinimalWorkflowDefinition;
    /** All steps prepared for execution with agent assignments */
    executionSteps: PlannedExecutionStep[];
    /** Human-readable reason for why this plan was created */
    planReason: string;
    /** Directed edges representing step dependencies (fromStepId -> toStepId) */
    dependencyEdges: Array<{
        fromStepId: string;
        toStepId: string;
    }>;
}
/**
 * Input required to create a workflow execution plan.
 */
export interface WorkflowPlannerInput {
    /** ID of the workflow to plan for */
    workflowId: string;
    /** The original request that triggered this workflow */
    request: string;
}
/**
 * Creates execution plans from workflow definitions.
 *
 * The planner:
 * 1. Looks up the workflow definition by ID
 * 2. Transforms each step into a planned execution step
 * 3. Computes dependency edges between steps based on dependsOn relationships
 * 4. Determines the plan reason based on step count
 *
 * The resulting PlannedWorkflow can be passed directly to the execution runtime.
 */
export declare class WorkflowPlanner {
    /**
     * Creates an execution plan for a workflow.
     *
     * @param input - The workflow planner input containing workflow ID and request
     * @returns A complete planned workflow with execution steps and dependencies
     * @throws Error if the workflow ID is not found in the registry
     */
    plan(input: WorkflowPlannerInput): PlannedWorkflow;
}
