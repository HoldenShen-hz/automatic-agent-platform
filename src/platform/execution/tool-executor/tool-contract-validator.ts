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
  code:
    | "tool_name_missing"
    | "default_timeout_invalid"
    | "max_output_invalid"
    | "retryable_error_codes_invalid"
    | "retryable_error_codes_duplicate"
    | "read_only_side_effect_mismatch"
    | "read_only_lock_mismatch"
    | "artifact_output_mismatch"
    | "mutable_execution_receipt_required";

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
export function validateToolExecutionMetadata(metadata: ToolExecutionMetadata): ToolContractViolation[] {
  const violations: ToolContractViolation[] = [];
  const toolName = metadata.toolName.trim();

  // Tool name must be non-empty
  if (toolName.length === 0) {
    violations.push({
      toolName: metadata.toolName,
      code: "tool_name_missing",
      message: "Tool metadata must declare a non-empty toolName.",
    });
  }

  // Default timeout must be positive
  if (!Number.isFinite(metadata.defaultTimeoutMs) || metadata.defaultTimeoutMs <= 0) {
    violations.push({
      toolName: metadata.toolName,
      code: "default_timeout_invalid",
      message: `Tool ${metadata.toolName} must declare a positive default timeout.`,
    });
  }

  // Max output must be positive when provided
  if (metadata.maxOutputBytes !== undefined && (!Number.isFinite(metadata.maxOutputBytes) || metadata.maxOutputBytes <= 0)) {
    violations.push({
      toolName: metadata.toolName,
      code: "max_output_invalid",
      message: `Tool ${metadata.toolName} must declare a positive max output size when provided.`,
    });
  }

  // All retryable error codes must be non-empty strings
  if (
    metadata.retryableErrorCodes.some((code) => typeof code !== "string" || code.trim().length === 0)
  ) {
    violations.push({
      toolName: metadata.toolName,
      code: "retryable_error_codes_invalid",
      message: `Tool ${metadata.toolName} must declare only non-empty retryable error codes.`,
    });
  }

  // Retryable error codes must not have duplicates
  if (new Set(metadata.retryableErrorCodes).size !== metadata.retryableErrorCodes.length) {
    violations.push({
      toolName: metadata.toolName,
      code: "retryable_error_codes_duplicate",
      message: `Tool ${metadata.toolName} must not declare duplicate retryable error codes.`,
    });
  }

  // Read-only tools cannot declare side effects
  if (metadata.readOnly && metadata.sideEffectScope !== "none") {
    violations.push({
      toolName: metadata.toolName,
      code: "read_only_side_effect_mismatch",
      message: `Read-only tool ${metadata.toolName} cannot declare side effects.`,
    });
  }

  // Read-only tools cannot require write or dynamic file locks
  if (metadata.readOnly && (metadata.needsFileLock === "write" || metadata.needsFileLock === "dynamic")) {
    violations.push({
      toolName: metadata.toolName,
      code: "read_only_lock_mismatch",
      message: `Read-only tool ${metadata.toolName} cannot require write or dynamic file locks.`,
    });
  }

  // Tools that produce artifacts must expose artifact_ref or mixed output
  if (metadata.producesArtifact && metadata.outputKind !== "artifact_ref" && metadata.outputKind !== "mixed") {
    violations.push({
      toolName: metadata.toolName,
      code: "artifact_output_mismatch",
      message: `Artifact-producing tool ${metadata.toolName} must expose artifact_ref or mixed output.`,
    });
  }

  // State-mutating tools must require execution receipts for audit
  if (!metadata.readOnly && metadata.requiresExecutionReceipt === false) {
    violations.push({
      toolName: metadata.toolName,
      code: "mutable_execution_receipt_required",
      message: `State-mutating tool ${metadata.toolName} must require an execution receipt.`,
    });
  }

  return violations;
}

/**
 * Validates an entire registry of tool metadata.
 * Aggregates violations from all tools into a single report.
 *
 * @param metadataItems - Array of tool metadata to validate
 * @returns All violations found across all tools
 */
export function validateToolMetadataRegistry(metadataItems: readonly ToolExecutionMetadata[]): ToolContractViolation[] {
  return metadataItems.flatMap((metadata) => validateToolExecutionMetadata(metadata));
}
