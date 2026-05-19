/**
 * Base Test Fixtures
 *
 * Minimal factories for creating valid test entities.
 * These create the smallest possible valid records for testing.
 *
 * R6-32 FIX: Added canonical fixture factories for HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation.
 */
import type { TaskRecord, ExecutionRecord, ApprovalRecord } from "../../../src/platform/contracts/types/domain.js";
import type { HarnessRun, PlanGraphBundle, PlanNode, PlanEdge, NodeRun, BudgetLedger, BudgetReservation } from "../../../src/platform/contracts/executable-contracts/index.js";
/**
 * Creates a minimal valid TaskRecord with required fields populated.
 * Optional fields are set to safe defaults.
 */
export declare function createMinimalTask(overrides?: Partial<TaskRecord>): TaskRecord;
/**
 * Creates a minimal valid ExecutionRecord with required fields populated.
 * Requires a valid taskId that references an existing task.
 */
export declare function createMinimalExecution(taskId: string, overrides?: Partial<ExecutionRecord>): ExecutionRecord;
/**
 * Creates a minimal valid ApprovalRecord.
 */
export declare function createMinimalApproval(overrides?: Partial<ApprovalRecord>): ApprovalRecord;
/**
 * Creates a minimal valid HarnessRun with required fields populated.
 * This is the canonical replacement for ExecutionRecord-based fixtures.
 */
export declare function createMinimalHarnessRun(overrides?: Partial<HarnessRun>): HarnessRun;
/**
 * Creates a minimal PlanNode for use in PlanGraphBundle fixtures.
 */
export declare function createMinimalPlanNode(nodeId: string, overrides?: Partial<PlanNode>): PlanNode;
/**
 * Creates a minimal PlanEdge for connecting nodes in a PlanGraph.
 */
export declare function createMinimalPlanEdge(edgeId: string, fromNodeId: string, toNodeId: string, overrides?: Partial<PlanEdge>): PlanEdge;
/**
 * Creates a minimal PlanGraphBundle for testing.
 * This is the canonical replacement for ExecutionPlan-based fixtures.
 */
export declare function createMinimalPlanGraphBundle(harnessRunId: string, overrides?: Partial<PlanGraphBundle>): PlanGraphBundle;
/**
 * Creates a minimal valid NodeRun with required fields populated.
 * This represents a single node execution within a HarnessRun.
 */
export declare function createMinimalNodeRun(harnessRunId: string, planGraphBundleId: string, overrides?: Partial<NodeRun>): NodeRun;
/**
 * Creates a minimal valid BudgetLedger for testing.
 * BudgetLedger tracks the overall budget for a HarnessRun.
 */
export declare function createMinimalBudgetLedger(harnessRunId: string, overrides?: Partial<BudgetLedger>): BudgetLedger;
/**
 * Creates a minimal valid BudgetReservation for testing.
 * BudgetReservation tracks reserved budget for a specific NodeRun within a HarnessRun.
 */
export declare function createMinimalBudgetReservation(budgetLedgerId: string, harnessRunId: string, overrides?: Partial<BudgetReservation>): BudgetReservation;
