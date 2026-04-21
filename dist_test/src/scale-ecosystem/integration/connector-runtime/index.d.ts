import { z } from "zod";
export declare const ConnectorExecutionRequestSchema: z.ZodObject<{
    connectorId: z.ZodString;
    capability: z.ZodString;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    payload: Record<string, unknown>;
    connectorId: string;
    capability: string;
}, {
    connectorId: string;
    capability: string;
    payload?: Record<string, unknown> | undefined;
}>;
export declare const ConnectorExecutionResultSchema: z.ZodObject<{
    connectorId: z.ZodString;
    success: z.ZodBoolean;
    status: z.ZodEnum<["succeeded", "failed", "deferred"]>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "succeeded" | "deferred";
    success: boolean;
    connectorId: string;
}, {
    status: "failed" | "succeeded" | "deferred";
    success: boolean;
    connectorId: string;
}>;
export type ConnectorExecutionRequest = z.infer<typeof ConnectorExecutionRequestSchema>;
export type ConnectorExecutionResult = z.infer<typeof ConnectorExecutionResultSchema>;
export declare function buildConnectorExecutionKey(request: ConnectorExecutionRequest): string;
