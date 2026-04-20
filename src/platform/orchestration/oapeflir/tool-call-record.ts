/**
 * ToolCallRecord — complete audit record for a single tool invocation.
 *
 * §A.2: Full 13-field version used for Feedback/Learn complete audit.
 * Distinct from ToolCallSummary (§12.3) which is the compressed version for Handoff.
 *
 * Correlated via callId.
 */

import type { ArtifactRef } from "./ref-types.js";

export interface ToolCallRecord {
  /** Unique identifier for this tool call */
  callId: string;
  /** Name of the tool invoked */
  toolName: string;
  /** Tool input arguments as key-value pairs */
  inputArgs: Record<string, unknown>;
  /** Raw string output from the tool (before parsing) */
  rawOutput: string;
  /** Parsed output as structured data, or null if parsing failed */
  parsedOutput: Record<string, unknown> | null;
  /** Whether the tool call succeeded */
  success: boolean;
  /** Machine-readable error code, null on success */
  errorCode: string | null;
  /** Human-readable error message, null on success */
  errorMessage: string | null;
  /** Duration of the tool call in milliseconds */
  durationMs: number;
  /** Token usage for this call */
  tokenUsage: {
    input: number;
    output: number;
  };
  /** Whether a sandbox security violation was detected */
  sandboxViolation: boolean;
  /** Which retry attempt this is (0 = first attempt) */
  retryAttempt: number;
  /** Reference to the output artifact, if one was produced */
  outputRef: ArtifactRef | null;
}
