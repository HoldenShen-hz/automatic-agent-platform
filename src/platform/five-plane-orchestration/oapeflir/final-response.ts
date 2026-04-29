/**
 * FinalResponse — envelope for the final output returned to the user or caller.
 *
 * §A.3: Complete output envelope wrapping HumanOutput with execution metadata,
 * artifacts, citations, and confidence score.
 *
 * 13 fields covering: task/execution/plan identity, human output, artifacts,
 * knowledge citations, confidence, disclaimer, and timestamp.
 */

import type { ArtifactRef, KnowledgeRef } from "./ref-types.js";

/**
 * Human-readable output section.
 * §6.5 defines this as the user-facing portion of step output.
 */
export interface HumanOutput {
  summary: string;
  sections: string[];
  citations: string[];
}

/**
 * Final response envelope sent to the caller at task completion.
 * §A.3 defines 13 fields covering execution metadata and output.
 */
export interface FinalResponse {
  /** Task this response is for */
  taskId: string;
  /** Execution ID of the run that produced this response */
  executionId: string;
  /** Plan ID that was executed */
  planId: string;
  /** Version of the plan that was executed */
  planVersion: number;
  /** Structured human-readable output */
  human: HumanOutput;
  /** End-to-end execution duration in milliseconds */
  executionDurationMs: number;
  /** Primary model identifier that produced the final answer */
  modelId: string;
  /** Number of retries consumed before the final answer was produced */
  retryCount: number;
  /** References to artifacts produced during execution */
  artifacts: ArtifactRef[];
  /** References to knowledge sources cited in the response */
  citations: KnowledgeRef[];
  /** Confidence score of the response quality (0-1) */
  confidenceScore: number;
  /** Disclaimer text if any limitations apply, null if none */
  disclaimer: string | null;
  /** ISO 8601 timestamp of generation */
  generatedAt: string;
}
