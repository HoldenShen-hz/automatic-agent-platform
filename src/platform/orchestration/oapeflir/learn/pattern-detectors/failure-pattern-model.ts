import { z } from "zod";

/**
 * FailurePattern — a structured representation of a detected failure mode.
 * Used internally by pattern detectors and output by FailurePatternMiner.
 */
export const FailurePatternTypeSchema = z.enum([
  "llm_truncation",
  "schema_validation_loop",
  "tool_permission_denial",
  "model_hallucination",
  "generic_failure",
]);

export const FailurePatternSchema = z.object({
  patternType: FailurePatternTypeSchema,
  taskId: z.string().min(1),
  stepId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  recommendation: z.string().min(1),
  detectedAt: z.number().int().nonnegative(),
});

export type FailurePatternType = z.infer<typeof FailurePatternTypeSchema>;
export type FailurePattern = z.infer<typeof FailurePatternSchema>;
