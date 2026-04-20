import { z } from "zod";

export const ImprovementTrackingRecordSchema = z.object({
  candidateId: z.string().min(1),
  sourceSignalIds: z.array(z.string()).default([]),
  status: z.enum(["proposed", "reviewing", "approved", "rejected", "released"]),
  owner: z.string().min(1),
});

export type ImprovementTrackingRecord = z.infer<typeof ImprovementTrackingRecordSchema>;

export function summarizeImprovementTracking(records: readonly ImprovementTrackingRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
}
