import { readJsonBody } from "../http-server/utils.js";
import { sanitizeJsonValue } from "./sanitize.js";

/**
 * Content-Type validation configuration per §6.2 input sanitization.
 */
export interface ContentTypeConfig {
  /** Allowed Content-Type header values for JSON requests */
  allowedContentTypes: readonly string[];
  /** Whether to require Content-Type header for POST/PUT/PATCH */
  requireContentType: boolean;
}

/**
 * Default Content-Type validation per §6.2.
 * Only application/json is accepted for JSON request bodies.
 */
export const DEFAULT_CONTENT_TYPE_CONFIG: ContentTypeConfig = {
  allowedContentTypes: ["application/json"],
  requireContentType: true,
};

/**
 * Validates Content-Type header for API requests per §6.2.
 * Rejects requests with missing or invalid Content-Type for methods that expect a body.
 */
export class ContentTypeValidation {
  private readonly config: ContentTypeConfig;

  public constructor(config: Partial<ContentTypeConfig> = {}) {
    this.config = { ...DEFAULT_CONTENT_TYPE_CONFIG, ...config };
  }

  /**
   * Validate Content-Type for a request.
   * @param method HTTP method
   * @param contentType Content-Type header value
   * @param hasBody Whether the request has a body
   * @returns true if valid, false if validation failed
   */
  public validate(method: string, contentType: string | undefined, hasBody: boolean): boolean {
    // OPTIONS requests don't need Content-Type validation
    if (method === "OPTIONS") {
      return true;
    }

    // GET/DELETE/HEAD without body are always valid
    if (!hasBody) {
      return true;
    }

    // For methods with body, validate Content-Type
    if (this.config.requireContentType) {
      if (contentType == null || contentType.trim().length === 0) {
        return false;
      }
    }

    if (contentType == null) {
      return true;
    }

    // Extract the media type without parameters (e.g., charset)
    const mediaType = contentType!.split(";")[0]!.trim().toLowerCase();
    return this.config.allowedContentTypes.some(
      (allowed) => allowed.toLowerCase() === mediaType,
    );
  }

  /**
   * Get the error response for Content-Type validation failure.
   */
  public getErrorResponse(): {
    statusCode: number;
    code: string;
    message: string;
  } {
    return {
      statusCode: 415,
      code: "api.unsupported_media_type",
      message: `Content-Type must be one of: ${this.config.allowedContentTypes.join(", ")}.`,
    };
  }
}

/**
 * Global Content-Type validation instance.
 */
export const globalContentTypeValidation = new ContentTypeValidation();

/**
 * Validate Content-Type header for incoming requests.
 * Returns error details if invalid, null if valid.
 */
export function validateContentType(
  method: string,
  contentType: string | undefined,
  hasBody: boolean,
): { code: string; message: string } | null {
  const validator = globalContentTypeValidation;
  if (!validator.validate(method, contentType, hasBody)) {
    return {
      code: validator.getErrorResponse().code,
      message: validator.getErrorResponse().message,
    };
  }
  return null;
}

export function readValidatedJsonBody<T>(
  body: string | null | undefined,
  parser: (payload: unknown) => T,
): T {
  const parsed = readJsonBody(body);
  return parser(sanitizeJsonValue(parsed));
}
