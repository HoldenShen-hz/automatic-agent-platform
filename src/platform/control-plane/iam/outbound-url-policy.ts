/**
 * Outbound URL Policy
 *
 * Provides URL validation and sanitization for outbound HTTP requests.
 * Prevents accidental access to internal network resources and sanitizes
 * URLs for telemetry/logging to protect sensitive data.
 *
 * ## Purpose
 *
 * 1. Block access to internal network addresses (localhost, AWS metadata, etc.)
 * 2. Sanitize URLs before logging to redact sensitive query parameters
 * 3. Provide safe URL parsing utilities
 *
 * ## Blocked Destinations
 *
 * The following are considered internal and blocked:
 * - localhost, 127.0.0.1, 0.0.0.0, ::1
 * - AWS metadata endpoint (169.254.169.254)
 * - GCP metadata endpoint (metadata.google.internal)
 * - Private IP ranges (10.x, 172.16-31.x, 192.168.x)
 * - Link-local addresses (fe80:, fc00:, fd00:)
 * - TLDs like .local, .internal, .private
 */

import { ValidationError } from "../../contracts/errors.js";

/**
 * Set of hostnames that are always blocked.
 * These represent internal services that should never be accessed.
 */
const BLOCKED_OUTBOUND_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
  "metadata.google.internal",
]);

/**
 * Patterns for identifying internal/private hostnames.
 * Covers IPv4 private ranges, link-local, and suspicious TLDs.
 */
const BLOCKED_OUTBOUND_HOSTNAME_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,                   // 127.x.x.x (loopback)
  /^10\.\d+\.\d+\.\d+$/,                    // 10.x.x.x (private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/, // 172.16-31.x.x (private)
  /^192\.168\.\d+\.\d+$/,                   // 192.168.x.x (private)
  /^169\.254\.\d+\.\d+$/,                   // 169.254.x.x (link-local)
  /^::1$/,                                  // IPv6 loopback
  /^fe80:/i,                                // IPv6 link-local
  /^fc00:/i,                                // IPv6 unique local
  /^fd00:/i,                                // IPv6 unique local
  /\.(local|localhost|internal|private)$/i, // Suspicious TLDs
];

/**
 * Query parameter names that are considered sensitive.
 * These are redacted in telemetry/logging.
 */
const SENSITIVE_QUERY_PARAM_NAMES = new Set([
  "access_token",
  "api_key",
  "auth",
  "authorization",
  "credential",
  "credentials",
  "key",
  "passwd",
  "password",
  "secret",
  "sig",
  "signature",
  "token",
]);

/**
 * Error codes for URL validation failures.
 */
export interface OutboundUrlValidationErrorCodes {
  invalid: string;
  blocked: string;
}

/**
 * Checks if a hostname is in the blocked list or matches blocked patterns.
 *
 * @param hostname - The hostname to check
 * @returns true if the hostname should be blocked
 */
export function isBlockedOutboundHostname(hostname: string): boolean {
  // Strip brackets from IPv6 addresses (e.g., "[fe80::1]" -> "fe80::1")
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_OUTBOUND_HOSTNAMES.has(normalized)) {
    return true;
  }
  return BLOCKED_OUTBOUND_HOSTNAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Checks if a protocol is allowed for outbound requests.
 *
 * @param protocol - The protocol to check
 * @returns true if the protocol is allowed
 */
export function isSupportedOutboundProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

/**
 * Determines if a URL points to an internal network address.
 *
 * @param url - The parsed URL to check
 * @returns true if the URL is internal and should be blocked
 */
export function isInternalNetworkUrl(url: URL): boolean {
  return !isSupportedOutboundProtocol(url.protocol) || isBlockedOutboundHostname(url.hostname);
}

/**
 * Safely parses a URL string and validates it against the policy.
 * Throws ValidationError if the URL is invalid or blocked.
 *
 * @param urlString - The URL string to parse
 * @param errorCodes - Custom error codes for invalid and blocked cases
 * @returns The parsed URL object
 * @throws ValidationError if URL is invalid or points to internal network
 */
export function parseSafeOutboundUrl(
  urlString: string,
  errorCodes: OutboundUrlValidationErrorCodes,
): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new ValidationError(errorCodes.invalid, `${errorCodes.invalid}: Invalid URL: ${urlString}`);
  }
  if (isInternalNetworkUrl(parsed)) {
    throw new ValidationError(errorCodes.blocked, `${errorCodes.blocked}: Blocked internal network URL: ${urlString}`);
  }
  return parsed;
}

/**
 * Sanitizes a URL for safe logging/telemetry.
 * Removes or redacts:
 * - Username/password if present
 * - Sensitive query parameters (api_key, token, etc.)
 * - Bot tokens from paths
 *
 * @param url - The URL string or URL object to sanitize
 * @returns Sanitized URL string safe for logging
 */
export function sanitizeUrlForTelemetry(url: string | URL): string {
  const raw = typeof url === "string" ? url : url.toString();
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
  } catch {
    // If we can't parse it, do our best to redact manually
    return raw
      .replace(/\/bot[^/]+\//, "/bot***/")
      .replace(/:\/\/[^/@:]+:[^/@]+@/, "://***:***@")
      .replace(
        /([?&](?:access_token|api_key|auth|authorization|credential|credentials|key|passwd|password|secret|sig|signature|token))=[^&]+/gi,
        "$1=***",
      );
  }

  // Redact username/password
  if (parsed.username.length > 0) {
    parsed.username = "***";
  }
  if (parsed.password.length > 0) {
    parsed.password = "***";
  }

  // Redact bot tokens from path
  parsed.pathname = parsed.pathname.replace(/\/bot[^/]+\//, "/bot***/");

  // Redact sensitive query parameters
  for (const [name] of parsed.searchParams.entries()) {
    if (SENSITIVE_QUERY_PARAM_NAMES.has(name.toLowerCase())) {
      parsed.searchParams.set(name, "***");
    }
  }

  return parsed.toString();
}
