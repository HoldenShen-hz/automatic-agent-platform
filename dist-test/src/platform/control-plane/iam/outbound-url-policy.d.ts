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
export declare function isBlockedOutboundHostname(hostname: string): boolean;
/**
 * Checks if a protocol is allowed for outbound requests.
 *
 * @param protocol - The protocol to check
 * @returns true if the protocol is allowed
 */
export declare function isSupportedOutboundProtocol(protocol: string): boolean;
/**
 * Determines if a URL points to an internal network address.
 *
 * @param url - The parsed URL to check
 * @returns true if the URL is internal and should be blocked
 */
export declare function isInternalNetworkUrl(url: URL): boolean;
/**
 * Safely parses a URL string and validates it against the policy.
 * Throws ValidationError if the URL is invalid or blocked.
 *
 * @param urlString - The URL string to parse
 * @param errorCodes - Custom error codes for invalid and blocked cases
 * @returns The parsed URL object
 * @throws ValidationError if URL is invalid or points to internal network
 */
export declare function parseSafeOutboundUrl(urlString: string, errorCodes: OutboundUrlValidationErrorCodes): URL;
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
export declare function sanitizeUrlForTelemetry(url: string | URL): string;
