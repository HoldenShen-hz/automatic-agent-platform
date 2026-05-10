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
  callbackUrl: z.string().url().optional(),
});

export const ConnectorExecutionResultSchema = z.object({
  connectorId: z.string().min(1),
  executionId: z.string().min(1).optional(),
  success: z.boolean(),
  status: z.enum(["succeeded", "failed", "deferred"]),
  resultPayload: z.record(z.string(), z.unknown()).optional(),
});

export type ConnectorExecutionRequest = z.infer<typeof ConnectorExecutionRequestSchema>;
export type ConnectorExecutionResult = z.infer<typeof ConnectorExecutionResultSchema>;

export function buildConnectorExecutionKey(request: ConnectorExecutionRequest): string {
  return `${request.connectorId}:${request.capability}`;
}

/**
 * Invokes a callback URL with the connector execution result.
 * Returns true if the callback was delivered successfully, false otherwise.
 */
export async function invokeCallback(callbackUrl: string, result: ConnectorExecutionResult): Promise<boolean> {
  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Connector-Callback": "true",
      },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
