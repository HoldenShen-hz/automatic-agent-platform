/**
 * Base Test Fixtures
 *
 * Minimal factories for creating valid test entities.
 * These create the smallest possible valid records for testing.
 */
import type { TaskRecord, ExecutionRecord, ApprovalRecord } from "../../../src/platform/contracts/types/domain.js";
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
