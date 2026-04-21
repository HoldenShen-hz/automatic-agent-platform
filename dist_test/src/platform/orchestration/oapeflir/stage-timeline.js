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
export class OapeflirStageTimelineBuilder {
    entries = [];
    tick = Date.now();
    record(stage, status, refId, reasonCode) {
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
    build() {
        return [...this.entries];
    }
}
//# sourceMappingURL=stage-timeline.js.map