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
  const endpoint = resolveCallbackUrl(callbackUrl);
  if (endpoint == null) {
    return false;
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Connector-Callback": "true",
      },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch (error) {
    process.stderr.write(`connector_runtime.callback_failed:${error instanceof Error ? error.message : String(error)}\n`);
    return false;
  }
}

function resolveCallbackUrl(value: string): string | null {
  try {
    const endpoint = new URL(value);
    const isLoopbackHost = endpoint.hostname === "localhost"
      || endpoint.hostname === "127.0.0.1"
      || endpoint.hostname === "::1";
    const isExplicitlyAllowed = isAllowedCallbackHost(endpoint.hostname);
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
      return null;
    }
    if (endpoint.protocol === "http:" && !isLoopbackHost) {
      return null;
    }
    if (endpoint.protocol === "https:" && !isLoopbackHost && !isExplicitlyAllowed) {
      return null;
    }
    if (endpoint.username || endpoint.password) {
      return null;
    }
    return endpoint.toString();
  } catch {
    return null;
  }
}

function isAllowedCallbackHost(hostname: string): boolean {
  const raw = process.env.AA_CONNECTOR_CALLBACK_ALLOWED_HOSTS;
  if (raw == null) {
    return false;
  }
  const allowedHosts = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const normalizedHost = hostname.toLowerCase();
  return allowedHosts.some((allowed) => normalizedHost === allowed || normalizedHost.endsWith(`.${allowed}`));
}
