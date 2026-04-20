import { z } from "zod";

export const DualChannelStepOutputSchema = z.object({
  stepId: z.string().min(1),
  planRef: z.string().min(1),
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
});

export type DualChannelStepOutput = z.output<typeof DualChannelStepOutputSchema>;

export function parseDualChannelStepOutput(input: unknown): DualChannelStepOutput {
  return DualChannelStepOutputSchema.parse(input);
}
