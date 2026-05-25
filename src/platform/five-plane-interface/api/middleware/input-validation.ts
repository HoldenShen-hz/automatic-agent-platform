import { readJsonBody } from "../http-server/utils.js";
import { sanitizeJsonValue } from "./sanitize.js";
import { ApiError } from "../http-server/api-error.js";
import type { ApiRequestLike } from "../http-server/types.js";

interface ContractEnvelopeLike {
  readonly envelopeId: string;
  readonly schemaVersion: string;
  readonly payload: unknown;
}

export interface ContentTypeValidationConfig {
  readonly allowedContentTypes: readonly string[];
  readonly requireContentType: boolean;
}

export const DEFAULT_CONTENT_TYPE_CONFIG: ContentTypeValidationConfig = {
  allowedContentTypes: ["application/json"],
  requireContentType: true,
};

function normalizeContentType(contentType: string | undefined): string | null {
  if (contentType == null) {
    return null;
  }
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export class ContentTypeValidation {
  private readonly config: ContentTypeValidationConfig;

  public constructor(config: Partial<ContentTypeValidationConfig> = {}) {
    this.config = {
      allowedContentTypes: config.allowedContentTypes ?? DEFAULT_CONTENT_TYPE_CONFIG.allowedContentTypes,
      requireContentType: config.requireContentType ?? DEFAULT_CONTENT_TYPE_CONFIG.requireContentType,
    };
  }

  public validate(method: string | undefined, contentType: string | undefined, hasBody: boolean): boolean {
    const normalizedMethod = (method ?? "GET").toUpperCase();
    if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
      return true;
    }
    if (!hasBody) {
      return true;
    }
    const normalizedType = normalizeContentType(contentType);
    if (normalizedType == null) {
      return !this.config.requireContentType;
    }
    return this.config.allowedContentTypes.map((value) => value.toLowerCase()).includes(normalizedType);
  }

  public getErrorResponse(): { statusCode: number; code: string; message: string } {
    return {
      statusCode: 415,
      code: "api.unsupported_media_type",
      message: `Content-Type must be one of: ${this.config.allowedContentTypes.join(", ")}`,
    };
  }
}

export function validateContentType(
  method: string | undefined,
  contentType: string | undefined,
  hasBody: boolean,
  config: Partial<ContentTypeValidationConfig> = {},
): { statusCode: number; code: string; message: string } | null {
  const validation = new ContentTypeValidation(config);
  return validation.validate(method, contentType, hasBody)
    ? null
    : validation.getErrorResponse();
}

export function assertJsonRequestContentType(
  request: Pick<ApiRequestLike, "method" | "headers">,
  body: string | null | undefined,
): void {
  const error = validateContentType(request.method, request.headers["content-type"], (body?.length ?? 0) > 0);
  if (error == null) {
    return;
  }
  throw new ApiError(error.statusCode, error.code, error.message);
}

export function readValidatedJsonBody<T>(
  body: string | null | undefined,
  parser: (payload: unknown) => T,
): T {
  const parsed = readJsonBody(body);
  const sanitized = sanitizeJsonValue(parsed);
  return parser(unwrapContractEnvelopePayload(sanitized));
}

function unwrapContractEnvelopePayload(value: unknown): unknown {
  if (!isContractEnvelope(value)) {
    return value;
  }
  return sanitizeJsonValue(value.payload);
}

function isContractEnvelope(value: unknown): value is ContractEnvelopeLike {
  return value != null
    && typeof value === "object"
    && typeof (value as ContractEnvelopeLike).envelopeId === "string"
    && typeof (value as ContractEnvelopeLike).schemaVersion === "string"
    && "payload" in value;
}
