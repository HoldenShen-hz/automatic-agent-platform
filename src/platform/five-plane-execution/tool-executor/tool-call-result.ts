/**
 * Tool Call Result Types
 *
 * Defines the core type system for tool execution results, including:
 * - Status codes (succeeded, failed, timed_out, blocked, cancelled)
 * - Error classification (provider, tool, network, security, validation, system)
 * - Structured result interface with metadata, artifacts, and execution receipts
 */

/**
 * Possible outcomes of a tool call execution.
 * - succeeded: Tool completed successfully
 * - failed: Tool encountered an error
 * - timed_out: Tool exceeded its timeout threshold
 * - blocked: Tool was blocked by security policy or sandbox
 * - cancelled: Tool execution was cancelled via AbortSignal
 */
export type ToolCallStatus = "succeeded" | "failed" | "timed_out" | "blocked" | "cancelled";

/**
 * Categorizes the source of a tool call error for routing and debugging.
 * - provider: External provider failure (API timeout, rate limit)
 * - tool: Internal tool error (invalid input, execution failure)
 * - network: Network connectivity issues
 * - security: Security policy violation or sandbox denial
 * - validation: Input validation failure
 * - system: Internal system error
 */
export type ToolCallErrorSource = "provider" | "tool" | "network" | "security" | "validation" | "system";

/**
 * Represents an error that occurred during tool execution.
 * Contains diagnostic information for debugging and retry decisions.
 */
export interface ToolCallError {
  /** Machine-readable error code for programmatic handling */
  code: string;

  /** Human-readable error message describing what went wrong */
  message: string;

  /** Whether this error is eligible for automatic retry */
  retryable: boolean;

  /** Categorizes where the error originated */
  source: ToolCallErrorSource;

  /** Additional context-specific details about the error */
  details?: Record<string, unknown>;
}

/**
 * Result of a tool call execution containing all output, metadata, and diagnostics.
 *
 * @template TOutput - The primary output type (e.g., string, structured data)
 * @template TData - Additional structured data attached to the result
 * @template TMetadata - Execution metadata attached to the result
 */
export interface ToolCallResult<
  TOutput,
  TData extends object | null = Record<string, unknown> | null,
  TMetadata extends object | null = Record<string, unknown> | null,
> {
  /** Unique identifier for this specific tool call */
  callId: string;

  /** Name of the tool that was executed */
  toolName: string;

  /** Execution outcome status */
  status: ToolCallStatus;

  /** Whether the tool call succeeded (convenience alias for status check) */
  success: boolean;

  /** Primary output from the tool execution */
  output: TOutput;

  /** Additional structured data from the tool */
  data: TData;

  /** Execution metadata including timing and diagnostics */
  metadata: TMetadata;

  /** References to any artifacts produced during execution */
  artifacts: readonly string[];

  /** How long the execution took in milliseconds */
  durationMs: number;

  /** Error details if the execution failed */
  error: ToolCallError | null;

  /** Unique receipt for audit trail and execution verification */
  executionReceipt: string | null;
}

/**
 * Convenience function to check if a tool call status represents success.
 * Returns true only for "succeeded" status.
 */
export function isToolCallSuccessful(status: ToolCallStatus): boolean {
  return status === "succeeded";
}
