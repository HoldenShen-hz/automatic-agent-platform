import { z } from "zod";
export declare const ImprovementTrackingRecordSchema: z.ZodObject<{
    candidateId: z.ZodString;
    sourceSignalIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodEnum<["proposed", "reviewing", "approved", "rejected", "released"]>;
    owner: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "released" | "approved" | "rejected" | "proposed" | "reviewing";
    owner: string;
    candidateId: string;
    sourceSignalIds: string[];
}, {
    status: "released" | "approved" | "rejected" | "proposed" | "reviewing";
    owner: string;
    candidateId: string;
    sourceSignalIds?: string[] | undefined;
}>;
export type ImprovementTrackingRecord = z.infer<typeof ImprovementTrackingRecordSchema>;
export declare function summarizeImprovementTracking(records: readonly ImprovementTrackingRecord[]): Record<string, number>;
