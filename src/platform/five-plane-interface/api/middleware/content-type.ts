import type { ApiRequestLike } from "../http-server/types.js";
import { assertJsonRequestContentType } from "./input-validation.js";

/**
 * Validates Content-Type header for API requests.
 * Ensures requests with bodies use application/json content type.
 */
export function validateContentType(request: ApiRequestLike): void {
  assertJsonRequestContentType(request, request.body);
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
