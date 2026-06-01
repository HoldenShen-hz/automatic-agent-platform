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
  rationale: z.string().nullable().default(null),
});

export type OapeflirStage = z.infer<typeof OapeflirStageSchema>;
export type OapeflirStageStatus = z.infer<typeof OapeflirStageStatusSchema>;
export type OapeflirStageRecord = z.infer<typeof OapeflirStageRecordSchema>;

function createMonotonicStageTick(startMs = Date.now()): () => number {
  let lastMs = startMs;
  return () => {
    const nextMs = Date.now();
    lastMs = nextMs > lastMs ? nextMs : lastMs + 1;
    return lastMs;
  };
}

export class OapeflirStageTimelineBuilder {
  private readonly entries: OapeflirStageRecord[] = [];
  private readonly nextTick = createMonotonicStageTick();

  public record(
    stage: OapeflirStage,
    status: OapeflirStageStatus,
    refId?: string | null,
    reasonCode?: string | null,
    rationale?: string | null,
  ): OapeflirStageRecord {
    const startedAt = this.nextTick();
    const completedAt = this.nextTick();
    const record = OapeflirStageRecordSchema.parse({
      stage,
      status,
      startedAt,
      completedAt,
      refId: refId ?? null,
      reasonCode: reasonCode ?? null,
      rationale: rationale ?? null,
    });
    this.entries.push(record);
    return record;
  }

  public build(): OapeflirStageRecord[] {
    return [...this.entries];
  }
}
