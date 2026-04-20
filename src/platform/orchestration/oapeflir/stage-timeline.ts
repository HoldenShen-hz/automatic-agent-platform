import { z } from "zod";

export const OapeflirStageSchema = z.enum(["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release", "knowledge_promotion"]);
export const OapeflirStageStatusSchema = z.enum(["completed", "skipped"]);

export const OapeflirStageRecordSchema = z.object({
  stage: OapeflirStageSchema,
  status: OapeflirStageStatusSchema,
  startedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative(),
  refId: z.string().nullable().default(null),
  reasonCode: z.string().nullable().default(null),
});

export type OapeflirStage = z.infer<typeof OapeflirStageSchema>;
export type OapeflirStageStatus = z.infer<typeof OapeflirStageStatusSchema>;
export type OapeflirStageRecord = z.infer<typeof OapeflirStageRecordSchema>;

export class OapeflirStageTimelineBuilder {
  private readonly entries: OapeflirStageRecord[] = [];
  private tick = Date.now();

  public record(stage: OapeflirStage, status: OapeflirStageStatus, refId?: string | null, reasonCode?: string | null): OapeflirStageRecord {
    const startedAt = this.tick;
    this.tick += 1;
    const completedAt = this.tick;
    this.tick += 1;
    const record = OapeflirStageRecordSchema.parse({
      stage,
      status,
      startedAt,
      completedAt,
      refId: refId ?? null,
      reasonCode: reasonCode ?? null,
    });
    this.entries.push(record);
    return record;
  }

  public build(): OapeflirStageRecord[] {
    return [...this.entries];
  }
}
