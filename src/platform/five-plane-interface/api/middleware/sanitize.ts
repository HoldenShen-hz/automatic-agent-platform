import { AppError } from "../../../contracts/errors.js";

const DANGEROUS_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function buildValidationError(code: string, message: string): AppError {
  return new AppError(code, message, {
    statusCode: 400,
    category: "validation",
    source: "runtime",
    retryable: false,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 64) {
    throw buildValidationError("api.invalid_json_depth", "JSON payload exceeds maximum nesting depth.");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry, depth + 1));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const sanitized = Object.create(null) as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    if (DANGEROUS_JSON_KEYS.has(key)) {
      throw buildValidationError(
        "api.invalid_json_key",
        `JSON payload contains reserved key: ${key}.`,
      );
    }
    sanitized[key] = sanitizeJsonValue(entry, depth + 1);
  }
  return sanitized;
}
