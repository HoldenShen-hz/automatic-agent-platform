import { z } from "zod";
export declare const OapeflirStageSchema: z.ZodEnum<["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release", "knowledge_promotion"]>;
export declare const OapeflirStageStatusSchema: z.ZodEnum<["completed", "skipped"]>;
export declare const OapeflirStageRecordSchema: z.ZodObject<{
    stage: z.ZodEnum<["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release", "knowledge_promotion"]>;
    status: z.ZodEnum<["completed", "skipped"]>;
    startedAt: z.ZodNumber;
    completedAt: z.ZodNumber;
    refId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reasonCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "skipped";
    stage: "plan" | "execute" | "release" | "improve" | "observe" | "assess" | "feedback" | "learn" | "knowledge_promotion";
    reasonCode: string | null;
    startedAt: number;
    completedAt: number;
    refId: string | null;
}, {
    status: "completed" | "skipped";
    stage: "plan" | "execute" | "release" | "improve" | "observe" | "assess" | "feedback" | "learn" | "knowledge_promotion";
    startedAt: number;
    completedAt: number;
    reasonCode?: string | null | undefined;
    refId?: string | null | undefined;
}>;
export type OapeflirStage = z.infer<typeof OapeflirStageSchema>;
export type OapeflirStageStatus = z.infer<typeof OapeflirStageStatusSchema>;
export type OapeflirStageRecord = z.infer<typeof OapeflirStageRecordSchema>;
export declare class OapeflirStageTimelineBuilder {
    private readonly entries;
    private tick;
    record(stage: OapeflirStage, status: OapeflirStageStatus, refId?: string | null, reasonCode?: string | null): OapeflirStageRecord;
    build(): OapeflirStageRecord[];
}
