/**
 * @fileoverview HTTP Server Route Utilities - Shared helper functions for routes.
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import { parse as parseUrl } from "node:url";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { ApiRequestLike, ApiResponsePayload } from "./types.js";
import { AppError } from "../../../contracts/errors.js";
import type { ApiAuthService, ApiPrincipal, ApiRole } from "../api-auth-service.js";
import { ApiAuthError } from "../api-auth-service.js";
import { extractServiceAuth, type ServiceAuthError } from "../../../five-plane-control-plane/iam/service-auth.js";
import { inferApiErrorCategory, inferApiErrorSource } from "./api-error.js";
import { newId } from "../../../contracts/types/ids.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: inferApiErrorCategory(statusCode, code),
      source: inferApiErrorSource(code),
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export const API_INVALID_JSON_ERROR_CODE = "api.invalid_json";
export const DEFAULT_MAX_JSON_BODY_BYTES = 256 * 1024;
const INTERNAL_ROUTE_AUDIENCE_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  tasks: ["tasks", "task"],
  gateway: ["gateway"],
  admin: ["admin"],
  approvals: ["approvals", "approval"],
  packs: ["packs", "pack"],
  prompts: ["prompts", "prompt"],
  costs: ["costs", "cost"],
  incidents: ["incidents", "incident"],
});
const DEFAULT_OPAQUE_CURSOR_SECRET_SEED = "automatic-agent-platform.http.opaque-cursor.v1";

export function readRequestId(request: ApiRequestLike): string {
  const candidate = request.headers["x-request-id"];
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return newId("req");
}

export function readLimit(request: ApiRequestLike, fallback: number): number {
  const raw = readQueryParam(request, "limit", { maxLength: 16 });
  if (raw == null) {
    return fallback;
  }
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new ApiError(400, "api.invalid_limit", "limit must be a positive integer.");
  }
  return Math.max(1, Math.min(200, numeric));
}

export function readStatusFilter(request: ApiRequestLike): string | undefined {
  return readQueryParam(request, "status", { maxLength: 64 });
}

export function readCursor(request: ApiRequestLike): string | undefined {
  return readQueryParam(request, "cursor", { maxLength: 1024, trim: false });
}

export interface ReadQueryParamOptions {
  required?: boolean;
  maxLength?: number;
  pattern?: RegExp;
  trim?: boolean;
}

export function readQueryParam(
  request: ApiRequestLike,
  name: string,
  options: ReadQueryParamOptions = {},
): string | undefined {
  const parsed = parseUrl(request.url ?? "/", true);
  const raw = parsed.query[name];
  if (typeof raw !== "string") {
    if (options.required) {
      throw new ApiError(400, `api.${name}_required`, `${name} is required.`);
    }
    return undefined;
  }
  const value = options.trim === false ? raw : raw.trim();
  if (value.length === 0) {
    if (options.required) {
      throw new ApiError(400, `api.${name}_required`, `${name} is required.`);
    }
    return undefined;
  }
  const maxLength = options.maxLength ?? 256;
  if (value.length > maxLength) {
    throw new ApiError(400, `api.invalid_${name}`, `${name} exceeds maximum length of ${maxLength}.`);
  }
  if (options.pattern && !options.pattern.test(value)) {
    throw new ApiError(400, `api.invalid_${name}`, `${name} contains invalid characters.`);
  }
  return value;
}

export function readJsonBody(body: string | null | undefined, maxBytes: number = DEFAULT_MAX_JSON_BODY_BYTES): unknown {
  if (body == null || body.length === 0) {
    return {};
  }
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new ApiError(413, "api.request_body_too_large", `Request body exceeds maximum size of ${maxBytes} bytes.`);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, API_INVALID_JSON_ERROR_CODE, "Request body must be valid JSON.");
  }
}

export function readJsonRecord(
  body: string | null | undefined,
  options: { maxBytes?: number; emptyValue?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const parsed = readJsonBody(body, options.maxBytes);
  if (parsed == null) {
    return options.emptyValue ?? {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, API_INVALID_JSON_ERROR_CODE, "Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export function readStoredJsonRecord(
  serialized: string,
  options: { maxBytes: number; fallback?: Record<string, unknown> },
): Record<string, unknown> {
  if (Buffer.byteLength(serialized, "utf8") > options.maxBytes) {
    return options.fallback ?? {};
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return options.fallback ?? {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return options.fallback ?? {};
  }
}

export function readStoredJsonValue<T>(
  serialized: string,
  options: {
    maxBytes: number;
    fallback: T;
    parse?: (value: unknown) => T;
  },
): T {
  if (Buffer.byteLength(serialized, "utf8") > options.maxBytes) {
    return options.fallback;
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return options.parse == null ? parsed as T : options.parse(parsed);
  } catch {
    return options.fallback;
  }
}

export function requirePrincipal(
  request: ApiRequestLike,
  authService: ApiAuthService | null,
  requiredRole: ApiRole,
): ApiPrincipal {
  try {
    const servicePrincipal = authenticateServicePrincipal(request);
    if (servicePrincipal != null) {
      return servicePrincipal;
    }
    if (authService == null) {
      throw new ApiError(401, "api.auth_not_configured", "This endpoint requires authentication to be configured.");
    }
    return authService.requireRole(request.headers, requiredRole);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      throw new ApiError(error.statusCode, error.code, error.message);
    }
    throw error;
  }
}

function authenticateServicePrincipal(request: ApiRequestLike): ApiPrincipal | null {
  const serviceHeaders: {
    "x-service-id"?: string;
    "x-service-token"?: string;
    "x-service-token-signature"?: string;
    "x-mtls-cert"?: string;
  } = {};
  if (request.headers["x-service-id"] != null) {
    serviceHeaders["x-service-id"] = request.headers["x-service-id"];
  }
  if (request.headers["x-service-token"] != null) {
    serviceHeaders["x-service-token"] = request.headers["x-service-token"];
  }
  if (request.headers["x-service-token-signature"] != null) {
    serviceHeaders["x-service-token-signature"] = request.headers["x-service-token-signature"];
  }
  if (request.headers["x-mtls-cert"] != null) {
    serviceHeaders["x-mtls-cert"] = request.headers["x-mtls-cert"];
  }
  if (
    serviceHeaders["x-service-id"] == null
    && serviceHeaders["x-service-token"] == null
    && serviceHeaders["x-service-token-signature"] == null
    && serviceHeaders["x-mtls-cert"] == null
  ) {
    return null;
  }
  const authResult = extractServiceAuth(serviceHeaders);
  if (!authResult.authenticated || authResult.serviceIdentity == null) {
    throw mapServiceAuthError(authResult.reason);
  }
  const acceptedAudiences = inferInternalRouteAudiences(request.url);
  const tokenAudience = authResult.token?.audience ?? "*";
  if (acceptedAudiences.length > 0 && tokenAudience !== "*" && !acceptedAudiences.includes(tokenAudience)) {
    throw mapServiceAuthError("audience_mismatch");
  }
  const roles = deriveServicePrincipalRoles(authResult.serviceIdentity.capabilities);
  if (roles.length === 0) {
    throw mapServiceAuthError("capability_not_granted");
  }
  return {
    actorId: authResult.serviceIdentity.serviceId,
    roles,
    authMethod: "jwt",
    tenantId: null,
  };
}

function deriveServicePrincipalRoles(capabilities: readonly string[]): ApiRole[] {
  const normalized = new Set(capabilities.map((capability) => capability.trim().toLowerCase()).filter((capability) => capability.length > 0));
  if (normalized.has("api:admin") || normalized.has("admin") || normalized.has("*")) {
    return ["admin"];
  }
  if (
    normalized.has("api:operator")
    || normalized.has("operator")
    || normalized.has("invoke_tool")
    || normalized.has("write_file")
    || normalized.has("dispatch_execution")
  ) {
    return ["operator"];
  }
  if (
    normalized.has("api:viewer")
    || normalized.has("viewer")
    || normalized.has("read")
    || normalized.has("tasks:read")
  ) {
    return ["viewer"];
  }
  return [];
}

function inferInternalRouteAudiences(url: string | undefined): string[] {
  const pathname = parseUrl(url ?? "/", true).pathname ?? "/";
  const normalized = pathname === "/api"
    ? "/"
    : pathname.startsWith("/api/")
      ? pathname.slice(4)
      : pathname;
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const surface = segments[1] ?? segments[0] ?? "";
  if (surface.length === 0) {
    return [];
  }
  return [...(INTERNAL_ROUTE_AUDIENCE_ALIASES[surface] ?? [surface])];
}

function mapServiceAuthError(reason: ServiceAuthError | null): ApiError {
  switch (reason) {
    case "audience_mismatch":
      return new ApiError(403, "api.service_audience_mismatch", "Service token audience does not match the target route.");
    case "capability_not_granted":
      return new ApiError(403, "api.service_capability_denied", "Service token is missing required capabilities.");
    case "service_suspended":
    case "service_revoked":
      return new ApiError(403, "api.service_forbidden", "Service identity is not allowed to access this route.");
    case "token_expired":
      return new ApiError(401, "api.service_token_expired", "Service token has expired.");
    case "token_invalid":
    case "token_mtls_required":
    case "service_not_found":
    default:
      return new ApiError(401, "api.service_auth_invalid", "Service authentication failed.");
  }
}

export function resolveTenantScope(principal: ApiPrincipal, requestedTenantId: string | undefined): string | undefined {
  if (principal.tenantId == null) {
    return requestedTenantId;
  }
  if (requestedTenantId != null && requestedTenantId !== principal.tenantId) {
    throw new ApiError(403, "api.tenant_scope_mismatch", "Authenticated principal cannot access another tenant scope.");
  }
  return principal.tenantId;
}

export function assertGlobalTenantScopeSupported(principal: ApiPrincipal, surface: string): void {
  if (principal.tenantId != null) {
    throw new ApiError(403, "api.tenant_scope_unsupported", `Authenticated tenant-scoped principal cannot access ${surface}.`);
  }
}

export function assertTaskTenantAccess(
  principal: ApiPrincipal,
  resourceTenantId: string | null,
  notFoundCode: string,
  notFoundMessage: string,
): void {
  if (resourceTenantId == null) {
    return;
  }
  if (principal.tenantId == null) {
    throw new ApiError(403, "api.tenant_scope_required", "Authenticated principal must include tenant scope.");
  }
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(403, "api.tenant_scope_mismatch", "Authenticated principal cannot access another tenant scope.");
  }
}

const MAX_TASK_ID_LENGTH = 128;
const TASK_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateTaskId(taskId: string | undefined, location: string): string {
  if (!taskId || typeof taskId !== "string") {
    throw new ApiError(404, "api.task_not_found", `${location} requires taskId.`);
  }
  if (taskId.length > MAX_TASK_ID_LENGTH) {
    throw new ApiError(400, "api.invalid_task_id", `taskId exceeds maximum length of ${MAX_TASK_ID_LENGTH}.`);
  }
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new ApiError(400, "api.invalid_task_id", "taskId contains invalid characters.");
  }
  return taskId;
}

export function buildJsonResponse(requestId: string, statusCode: number, payload: unknown): ApiResponsePayload {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
      "x-trace-id": requestId,
    },
      body: JSON.stringify({ requestId, data: payload }, null, 2),
  };
}

export function buildJsonErrorResponse(
  requestId: string,
  statusCode: number,
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
    traceId?: string | null;
  },
): ApiResponsePayload {
  const traceId = error.traceId ?? requestId;
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
      "x-trace-id": traceId,
    },
    body: JSON.stringify({
      requestId,
      traceId,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details != null ? { details: error.details } : {}),
      },
    }, null, 2),
  };
}

export function buildJsonDocumentResponse(payload: unknown, requestId?: string): ApiResponsePayload {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(requestId != null ? { "x-request-id": requestId } : {}),
    },
    body: JSON.stringify(payload, null, 2),
  };
}

export function buildHtmlResponse(html: string): ApiResponsePayload {
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: html,
  };
}

export function buildTextResponse(text: string): ApiResponsePayload {
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    body: text,
  };
}

export function encodeOpaqueCursor(payload: Record<string, unknown>): string {
  const payloadText = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signOpaqueCursorPayload(payloadText);
  return `${payloadText}.${signature}`;
}

export function decodeOpaqueCursor<T>(cursor: string, code = "api.invalid_cursor"): T {
  try {
    const separatorIndex = cursor.lastIndexOf(".");
    if (separatorIndex <= 0 || separatorIndex >= cursor.length - 1) {
      throw new Error("cursor signature missing");
    }
    const payloadText = cursor.slice(0, separatorIndex);
    const signature = cursor.slice(separatorIndex + 1);
    const expectedSignature = signOpaqueCursorPayload(payloadText);
    const actualBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new Error("cursor signature invalid");
    }
    return JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8")) as T;
  } catch {
    throw new ApiError(400, code, "cursor is invalid.");
  }
}

function signOpaqueCursorPayload(payloadText: string): string {
  return createHmac("sha256", resolveOpaqueCursorSigningSecret())
    .update(payloadText, "utf8")
    .digest("base64url");
}

function resolveOpaqueCursorSigningSecret(): Buffer {
  return createHash("sha256")
    .update(process.env["AA_OPAQUE_CURSOR_SIGNING_SECRET"]?.trim() || DEFAULT_OPAQUE_CURSOR_SECRET_SEED, "utf8")
    .digest();
}

/**
 * Normalizes route segments by stripping the leading "v1" prefix if present.
 * This allows handlers to match both /resource and /v1/resource with the same logic.
 *
 * @example
 * normalizeSegments(["v1", "divisions"]) => ["divisions"]
 * normalizeSegments(["divisions"]) => ["divisions"]
 * normalizeSegments(["v1", "tasks", "abc123"]) => ["tasks", "abc123"]
 */
export function normalizeSegments(segments: string[]): string[] {
  if (segments.length > 0 && segments[0] === "v1") {
    return segments.slice(1);
  }
  return segments;
}

/**
 * Creates a segment-based route matcher that handles both v1 and non-v1 paths.
 * Returns the normalized segments (without v1 prefix) on match, or null on no match.
 *
 * @param segments - The route segments from RouteMatch
 * @param expected - The expected segments without v1 prefix (e.g., ["tasks", ":id"])
 * @param minLength - Minimum number of segments required (default: expected.length)
 * @param maxLength - Maximum number of segments allowed (default: expected.length)
 * @returns The normalized segments (without v1) on match, or null if no match
 */
export function matchNormalizedSegments(
  segments: string[],
  expected: string[],
  minLength?: number,
  maxLength?: number,
): string[] | null {
  const normalized = normalizeSegments(segments);
  const min = minLength ?? expected.length;
  const max = maxLength ?? expected.length;
  if (normalized.length < min || normalized.length > max) {
    return null;
  }
  for (let i = 0; i < expected.length; i++) {
    if (expected[i]?.startsWith(":")) {
      // This is a parameter placeholder, skip validation
      continue;
    }
    if (normalized[i] !== expected[i]) {
      return null;
    }
  }
  return normalized;
}
