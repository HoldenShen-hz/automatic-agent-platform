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

export function buildRequestGuardPlan(input: RequestGuardPlanInput): RequestGuardPlan {
  const method = input.method.toUpperCase();
  const beforeRouting: RequestGuardName[] = method === "OPTIONS" ? [] : ["rate-limit"];
  const beforeDispatch: RequestGuardName[] = [];
  const path = input.path;
  const idempotencyKey = normalizeOptionalString(input.idempotencyKey);
  const isWebhookReceivePath = path === "/v1/webhooks" || path?.startsWith("/v1/webhooks/") === true;

  if (WRITE_METHODS.has(method) && idempotencyKey == null && !isWebhookReceivePath) {
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
