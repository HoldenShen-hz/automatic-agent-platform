import { z } from "zod";

export const ConnectorExecutionRequestSchema = z.object({
  connectorId: z.string().min(1),
  capability: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  policyRef: z.string().min(1).optional(),
  secretBindings: z.array(z.object({
    secretRef: z.string().min(1),
    purpose: z.string().min(1),
  })).default([]),
});

export const ConnectorExecutionResultSchema = z.object({
  connectorId: z.string().min(1),
  success: z.boolean(),
  status: z.enum(["succeeded", "failed", "deferred"]),
});

export type ConnectorExecutionRequest = z.infer<typeof ConnectorExecutionRequestSchema>;
export type ConnectorExecutionResult = z.infer<typeof ConnectorExecutionResultSchema>;

export function buildConnectorExecutionKey(request: ConnectorExecutionRequest): string {
  return `${request.connectorId}:${request.capability}`;
}
