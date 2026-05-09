/**
 * FinalResponse — envelope for the final output returned to the user or caller.
 *
 * §A.3: Complete output envelope wrapping HumanOutput with execution metadata,
 * artifacts, citations, and confidence score.
 *
 * 13 fields covering: task/execution/plan identity, human output, artifacts,
 * knowledge citations, confidence, disclaimer, and timestamp.
 * Plus additional fields per §27: audience/runId/limitations/citationsRequired/
 * evidenceRefs/dataClass/redactionApplied/safetyLabels.
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
 * §27 adds additional required fields: audience/runId/limitations/
 * citationsRequired/evidenceRefs/dataClass/redactionApplied/safetyLabels.
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
  /** §27: Target audience for this response (operator/admin/auditor/stakeholder) */
  audience: string;
  /** §27: Run identifier for tracing */
  runId: string;
  /** Structured human-readable output */
  human: HumanOutput;
  /** References to artifacts produced during execution */
  artifacts: ArtifactRef[];
  /** References to knowledge sources cited in the response */
  citations: KnowledgeRef[];
  /** §27: Whether citations are required for this response */
  citationsRequired: boolean;
  /** §27: References to evidence records */
  evidenceRefs: readonly string[];
  /** §27: Data classification of this response */
  dataClass: string;
  /** §27: Whether redaction was applied */
  redactionApplied: boolean;
  /** Confidence score of the response quality (0-1) */
  confidenceScore: number;
  /** §27: Limitations applicable to this response */
  limitations: string;
  /** §27: Safety labels applied to this response */
  safetyLabels: readonly string[];
  /** Disclaimer text if any limitations apply, null if none */
  disclaimer: string | null;
  /** ISO 8601 timestamp of generation */
  generatedAt: string;
  // R9-18 fix: Add missing fields for complete execution metadata
  /** Total execution duration in milliseconds */
  executionDurationMs: number;
  /** Model ID used for generation */
  modelId: string;
  /** Number of retries attempted */
  retryCount: number;
}
