/**
 * @fileoverview HTTP request parsing / authentication helpers.
 *
 * Extracted from http-api-server.ts as part of GAP24A-02 deep split.
 */

import { parse as parseUrl } from "node:url";
import type { IncomingMessage } from "node:http";

import { ApiAuthError, type ApiAuthService, type ApiPrincipal } from "../api-auth-service.js";
import type { ApiRequestLike, RouteMatch } from "./types.js";
import { ApiError } from "./api-error.js";

/** Maximum HTTP request body size to prevent DoS attacks (1 MB) */
export const MAX_BODY_BYTES = 1_048_576;

export function matchRoute(request: ApiRequestLike): RouteMatch | null {
  const method = request.method ?? "GET";
  if (
    method !== "GET"
    && method !== "POST"
    && method !== "PUT"
    && method !== "PATCH"
    && method !== "DELETE"
    && method !== "OPTIONS"
  ) {
    return null;
  }
  const rawUrl = request.url ?? "/";
  const normalizedUrl = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const parsed = parseUrl(normalizedUrl, true);
  const rawPathname = parsed.pathname ?? "/";
  const pathname = rawPathname === "/api"
    ? "/"
    : rawPathname.startsWith("/api/")
      ? rawPathname.slice(4)
      : rawPathname;
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  return { pathname, segments };
}

export async function readIncomingBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.from(chunk).length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new ApiError(413, "api.payload_too_large", "Request body exceeds 1 MB limit.");
    }
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return null;
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function normalizeHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  if (headers == null) {
    return normalized;
  }
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return normalized;
}

export function authenticateOptionalPrincipal(
  request: ApiRequestLike,
  authService: ApiAuthService | null,
): ApiPrincipal | null {
  if (authService == null) {
    return null;
  }
  const authorization = request.headers.authorization;
  const apiKey = request.headers["x-api-key"];
  if (
    (typeof authorization !== "string" || authorization.trim().length === 0)
    && (typeof apiKey !== "string" || apiKey.trim().length === 0)
  ) {
    return null;
  }
  try {
    return authService.authenticate(request.headers);
  } catch (error) {
    if (error instanceof ApiAuthError && error.code === "api.auth_required") {
      return null;
    }
    throw error;
  }
}
