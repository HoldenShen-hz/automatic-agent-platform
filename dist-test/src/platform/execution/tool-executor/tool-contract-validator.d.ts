/**
 * Tool Contract Validator
 *
 * Validates tool execution metadata against the tool contract requirements.
 * Ensures all registered tools conform to the expected schema for:
 * - Required fields (name, timeout, risk level)
 * - Consistency constraints (read-only tools cannot have side effects)
 * - Artifact output requirements
 * - Execution receipt requirements for state-mutating tools
 */
import type { ToolExecutionMetadata } from "./tool-metadata.js";
/**
 * Represents a violation of the tool contract.
 * Used to report schema violations during tool registration or validation.
 */
export interface ToolContractViolation {
    /** Name of the tool that has the violation */
    toolName: string;
    /** Specific violation code for programmatic handling */
    code: "tool_name_missing" | "default_timeout_invalid" | "max_output_invalid" | "retryable_error_codes_invalid" | "retryable_error_codes_duplicate" | "read_only_side_effect_mismatch" | "read_only_lock_mismatch" | "artifact_output_mismatch" | "mutable_execution_receipt_required";
    /** Human-readable description of the violation */
    message: string;
}
/**
 * Validates a single tool's execution metadata against the contract.
 * Checks for required fields, value ranges, and internal consistency.
 *
 * @param metadata - The tool metadata to validate
 * @returns Array of violations found; empty array means valid
 */
export declare function validateToolExecutionMetadata(metadata: ToolExecutionMetadata): ToolContractViolation[];
/**
 * Validates an entire registry of tool metadata.
 * Aggregates violations from all tools into a single report.
 *
 * @param metadataItems - Array of tool metadata to validate
 * @returns All violations found across all tools
 */
export declare function validateToolMetadataRegistry(metadataItems: readonly ToolExecutionMetadata[]): ToolContractViolation[];
