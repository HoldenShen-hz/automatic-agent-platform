import { z } from "zod";

export const DualChannelStepOutputSchema = z.object({
  nodeRunId: z.string().min(1).optional(),
  stepId: z.string().min(1).optional(),
  planRef: z.string().min(1),
  status: z.enum(["succeeded", "failed", "partial_success", "skipped"]).default("succeeded"),
  userFacingResult: z.object({
    summary: z.string().min(1),
    artifacts: z.array(z.string()).default([]),
  }),
  systemTelemetry: z.object({
    durationMs: z.number().int().nonnegative(),
    tokensUsed: z.number().int().nonnegative(),
    modelId: z.string().min(1),
    retryCount: z.number().int().nonnegative(),
    validationPassed: z.boolean(),
  }),
}).superRefine((value, ctx) => {
  if (value.nodeRunId == null && value.stepId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DualChannelStepOutput requires nodeRunId or legacy stepId",
      path: ["nodeRunId"],
    });
  }
}).transform((value) => {
  const canonicalNodeRunId = value.nodeRunId ?? value.stepId!;
  return {
    ...value,
    nodeRunId: canonicalNodeRunId,
    stepId: value.stepId ?? canonicalNodeRunId,
  };
});

export interface DualChannelStepOutput {
  nodeRunId?: string;
  stepId: string;
  planRef: string;
  status: "succeeded" | "failed" | "partial_success" | "skipped";
  userFacingResult: {
    summary: string;
    artifacts: string[];
  };
  systemTelemetry: {
    durationMs: number;
    tokensUsed: number;
    modelId: string;
    retryCount: number;
    validationPassed: boolean;
  };
}

export function getDualChannelNodeRunId(output: DualChannelStepOutput): string {
  return output.nodeRunId ?? output.stepId;
}

export function parseDualChannelStepOutput(input: unknown): DualChannelStepOutput {
  return DualChannelStepOutputSchema.parse(input) as DualChannelStepOutput;
}
