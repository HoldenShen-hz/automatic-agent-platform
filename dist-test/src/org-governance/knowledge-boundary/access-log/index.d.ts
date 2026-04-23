import { z } from "zod";
export declare const KnowledgeAccessLogRecordSchema: z.ZodObject<{
    recordId: z.ZodString;
    requesterId: z.ZodString;
    boundaryId: z.ZodString;
    purpose: z.ZodString;
    allowed: z.ZodBoolean;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    occurredAt: string;
    allowed: boolean;
    recordId: string;
    requesterId: string;
    boundaryId: string;
    purpose: string;
}, {
    occurredAt: string;
    allowed: boolean;
    recordId: string;
    requesterId: string;
    boundaryId: string;
    purpose: string;
}>;
export type KnowledgeAccessLogRecord = z.infer<typeof KnowledgeAccessLogRecordSchema>;
export declare function redactKnowledgeAccessLog(record: KnowledgeAccessLogRecord): KnowledgeAccessLogRecord;
