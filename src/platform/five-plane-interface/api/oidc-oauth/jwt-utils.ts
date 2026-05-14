import { AuthError, ValidationError } from "../../../contracts/errors.js";
import type { FederatedTokenClaims } from "./types.js";

function throwOidcValidationError(code: string): never {
  throw new ValidationError(code, code, {
    retryable: false,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function decodeJwtJsonSegment(segment: string, kind: "header" | "payload"): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString());
  } catch {
    throw new AuthError(`jwt.${kind}_invalid`, `jwt.${kind}_invalid`, {
      retryable: false,
      statusCode: 401,
    });
  }
}

export function parseJwtHeader(value: unknown): { kid?: string; alg?: string } {
  if (!isRecord(value)) {
    throwOidcValidationError("jwt.header_invalid");
  }
  if ("kid" in value && value.kid != null && typeof value.kid !== "string") {
    throwOidcValidationError("jwt.header_invalid");
  }
  if ("alg" in value && value.alg != null && typeof value.alg !== "string") {
    throwOidcValidationError("jwt.header_invalid");
  }
  return {
    ...(typeof value.kid === "string" ? { kid: value.kid } : {}),
    ...(typeof value.alg === "string" ? { alg: value.alg } : {}),
  };
}

export function parseFederatedTokenClaims(value: unknown): FederatedTokenClaims {
  if (!isRecord(value)) {
    throwOidcValidationError("jwt.payload_invalid");
  }
  if (typeof value.sub !== "string" || typeof value.iss !== "string") {
    throwOidcValidationError("jwt.payload_invalid");
  }
  if (typeof value.exp !== "number" || !Number.isFinite(value.exp) || typeof value.iat !== "number" || !Number.isFinite(value.iat)) {
    throwOidcValidationError("jwt.payload_invalid");
  }

  let aud: string | string[];
  if (typeof value.aud === "string") {
    aud = value.aud;
  } else if (Array.isArray(value.aud) && value.aud.length > 0 && value.aud.every((item) => typeof item === "string")) {
    aud = value.aud;
  } else {
    throwOidcValidationError("jwt.payload_invalid");
  }

  if ("email" in value && value.email != null && typeof value.email !== "string") {
    throwOidcValidationError("jwt.payload_invalid");
  }
  if ("name" in value && value.name != null && typeof value.name !== "string") {
    throwOidcValidationError("jwt.payload_invalid");
  }
  if ("roles" in value && value.roles != null && (!Array.isArray(value.roles) || !value.roles.every((item) => typeof item === "string"))) {
    throwOidcValidationError("jwt.payload_invalid");
  }

  return {
    sub: value.sub,
    iss: value.iss,
    aud,
    exp: value.exp,
    iat: value.iat,
    ...(typeof value.email === "string" ? { email: value.email } : {}),
    ...(typeof value.name === "string" ? { name: value.name } : {}),
    ...(Array.isArray(value.roles) ? { roles: value.roles as string[] } : {}),
  };
}
