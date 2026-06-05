export type RequestGuardName = "rate-limit" | "request-deduplication" | "idempotency-key";

export interface RequestGuardPlan {
  readonly method: string;
  readonly path: string | null;
  readonly beforeRouting: readonly RequestGuardName[];
  readonly beforeDispatch: readonly RequestGuardName[];
}

export interface RequestGuardPlanInput {
  readonly method: string;
  readonly path: string | null;
  readonly idempotencyKey?: string | null | undefined;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AUTH_TOKEN_PATHS = new Set(["/auth/token", "/v1/auth/token"]);

export function buildRequestGuardPlan(input: RequestGuardPlanInput): RequestGuardPlan {
  const method = input.method.toUpperCase();
  const beforeRouting: RequestGuardName[] = method === "OPTIONS" ? [] : ["rate-limit"];
  const beforeDispatch: RequestGuardName[] = [];
  const path = input.path;
  const idempotencyKey = normalizeOptionalString(input.idempotencyKey);
  const isWebhookReceivePath = path === "/v1/webhooks" || path?.startsWith("/v1/webhooks/") === true;
  const isAuthTokenPath = path != null && AUTH_TOKEN_PATHS.has(path);

  if (WRITE_METHODS.has(method) && idempotencyKey == null && !isWebhookReceivePath && !isAuthTokenPath) {
    beforeDispatch.push("request-deduplication");
  }
  if (method !== "OPTIONS") {
    beforeDispatch.push("idempotency-key");
  }

  return {
    method,
    path,
    beforeRouting,
    beforeDispatch,
  };
}

export function planIncludesGuard(
  guards: readonly RequestGuardName[],
  guard: RequestGuardName,
): boolean {
  return guards.includes(guard);
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
