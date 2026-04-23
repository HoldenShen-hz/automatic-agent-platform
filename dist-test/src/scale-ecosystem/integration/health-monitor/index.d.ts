import { z } from "zod";
export declare const ConnectorHealthReportSchema: z.ZodObject<{
    connectorId: z.ZodString;
    status: z.ZodEnum<["healthy", "degraded", "failed"]>;
    latencyMs: z.ZodNumber;
    checkedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "degraded" | "healthy";
    latencyMs: number;
    connectorId: string;
    checkedAt: string;
}, {
    status: "failed" | "degraded" | "healthy";
    latencyMs: number;
    connectorId: string;
    checkedAt: string;
}>;
export type ConnectorHealthReport = z.infer<typeof ConnectorHealthReportSchema>;
export declare function summarizeConnectorHealth(reports: readonly ConnectorHealthReport[]): "healthy" | "degraded" | "failed";
