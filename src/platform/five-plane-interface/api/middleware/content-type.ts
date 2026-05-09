import { AppError } from "../../../contracts/errors.js";
import type { ApiRequestLike } from "../http-server/types.js";
import { ApiError } from "../http-server/api-error.js";

/**
 * Validates Content-Type header for API requests.
 * Ensures requests with bodies use application/json content type.
 */
export function validateContentType(request: ApiRequestLike): void {
  const method = request.method ?? "GET";
  const contentType = request.headers["content-type"] ?? "";

  // Skip validation for GET/HEAD/OPTIONS requests (no body expected)
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  // If Content-Type is provided, it must be application/json
  if (contentType.length > 0 && !contentType.includes("application/json")) {
    throw new ApiError(
      415,
      "api.unsupported_content_type",
      `Content-Type must be application/json. Received: ${contentType}`,
    );
  }
}

/**
 * Creates a middleware function that validates Content-Type header.
 * Returns a function suitable for use in route handlers.
 */
export function createContentTypeValidationMiddleware() {
  return function contentTypeValidationMiddleware(
    request: ApiRequestLike,
  ): void {
    validateContentType(request);
  };
}