import { z } from "zod";
export const ConnectorExecutionRequestSchema = z.object({
    connectorId: z.string().min(1),
    capability: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).default({}),
});
export const ConnectorExecutionResultSchema = z.object({
    connectorId: z.string().min(1),
    success: z.boolean(),
    status: z.enum(["succeeded", "failed", "deferred"]),
});
export function buildConnectorExecutionKey(request) {
    return `${request.connectorId}:${request.capability}`;
}
//# sourceMappingURL=index.js.map