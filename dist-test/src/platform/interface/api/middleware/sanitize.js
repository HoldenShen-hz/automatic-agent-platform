import { AppError } from "../../../contracts/errors.js";
const DANGEROUS_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);
function buildValidationError(code, message) {
    return new AppError(code, message, {
        statusCode: 400,
        category: "validation",
        source: "runtime",
        retryable: false,
    });
}
function isPlainObject(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
export function sanitizeJsonValue(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeJsonValue(entry));
    }
    if (!isPlainObject(value)) {
        return value;
    }
    const sanitized = Object.create(null);
    for (const [key, entry] of Object.entries(value)) {
        if (DANGEROUS_JSON_KEYS.has(key)) {
            throw buildValidationError("api.invalid_json_key", `JSON payload contains reserved key: ${key}.`);
        }
        sanitized[key] = sanitizeJsonValue(entry);
    }
    return sanitized;
}
//# sourceMappingURL=sanitize.js.map