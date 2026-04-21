/**
 * Network Egress Audit
 *
 * Provides audit trail for outbound network connections made by the agent.
 * Audits URLs, SSH connections, S3 access, registry access, and publish operations.
 *
 * ## Purpose
 *
 * Track all external network connections made during agent execution for:
 * - Security auditing and incident investigation
 * - Compliance with data handling policies
 * - Detecting unauthorized data exfiltration
 * - Monitoring agent behavior patterns
 *
 * ## Destination Types
 *
 * The auditor classifies connections into types:
 * - url: Regular HTTP/HTTPS web requests
 * - ssh: SSH connections (git@github.com style)
 * - s3: AWS S3 storage access
 * - registry: Code registries (GitHub, GitLab, Bitbucket)
 * - publish: Publishing operations (npm, pypi, etc.)
 * - unknown: Cannot be classified
 *
 * @see SEC-37: Establish network egress audit
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
/**
 * URL pattern for standard HTTP/HTTPS URLs (IPv4 and hostname).
 */
const URL_PATTERN = /^https?:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/i;
/**
 * URL pattern for HTTP/HTTPS URLs with IPv6 addresses.
 * IPv6 addresses are enclosed in brackets, e.g., http://[::1]:8080/
 */
const URL_IPV6_PATTERN = /^https?:\/\/\[([^\]]+)\](?::(\d+))?(\/.*)?$/i;
/**
 * URL pattern for SSH URLs.
 */
const SSH_PATTERN = /^ssh:\/\/([^/:]+)(?::(\d+))?$/i;
/**
 * URL pattern for S3-style URLs.
 */
const S3_PATTERN = /^s3:\/\/([^/]+)(?:\/(.*))?$/i;
/**
 * Parses a URL string into components for audit classification.
 * Supports HTTP, HTTPS, SSH, and S3 URL formats.
 *
 * @param url - The URL string to parse
 * @returns Parsed URL components or null if unparseable
 */
export function parseUrlForAudit(url) {
    // Check IPv6 URL pattern first (urls with brackets like http://[::1]:8080/)
    const ipv6Match = URL_IPV6_PATTERN.exec(url);
    if (ipv6Match && ipv6Match[1] !== undefined) {
        return {
            protocol: "http",
            host: ipv6Match[1], // The IPv6 address without brackets
            port: ipv6Match[2] !== undefined ? parseInt(ipv6Match[2], 10) : null,
            path: ipv6Match[3] ?? "/",
        };
    }
    const urlMatch = URL_PATTERN.exec(url);
    if (urlMatch && urlMatch[1] !== undefined) {
        return {
            protocol: "http",
            host: urlMatch[1],
            port: urlMatch[2] !== undefined ? parseInt(urlMatch[2], 10) : null,
            path: urlMatch[3] ?? "/",
        };
    }
    const sshMatch = SSH_PATTERN.exec(url);
    if (sshMatch && sshMatch[1] !== undefined) {
        return {
            protocol: "ssh",
            host: sshMatch[1],
            port: sshMatch[2] !== undefined ? parseInt(sshMatch[2], 10) : 22,
            path: "/",
        };
    }
    const s3Match = S3_PATTERN.exec(url);
    if (s3Match && s3Match[1] !== undefined) {
        return {
            protocol: "s3",
            host: s3Match[1],
            port: null,
            path: s3Match[2] ?? "/",
        };
    }
    return null;
}
/**
 * Classifies a URL into an egress destination type.
 * Uses pattern matching to identify the type of service being accessed.
 *
 * @param url - The URL to classify
 * @returns The destination type classification
 */
export function classifyUrl(url) {
    const lowerUrl = url.toLowerCase();
    // Code registries
    if (lowerUrl.includes("github.com") || lowerUrl.includes("gitlab.com") || lowerUrl.includes("bitbucket.org")) {
        return "registry";
    }
    // SSH-style connections
    if (lowerUrl.startsWith("ssh://") || lowerUrl.startsWith("git@")) {
        return "ssh";
    }
    // AWS S3
    if (lowerUrl.startsWith("s3://") || lowerUrl.includes(".s3.") || lowerUrl.includes("amazonaws.com")) {
        return "s3";
    }
    // Standard web URLs
    if (lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://")) {
        return "url";
    }
    return "unknown";
}
/**
 * Extracts the destination host from a URL.
 * Used as a simpler identifier than the full URL for logging.
 *
 * @param url - The URL to extract destination from
 * @returns The host or a simplified identifier
 */
export function extractDestination(url) {
    const parsed = parseUrlForAudit(url);
    if (parsed) {
        return parsed.host;
    }
    // Handle SSH-style git URLs (git@github.com:...)
    if (url.includes("@")) {
        const atIndex = url.indexOf("@");
        const afterAt = url.slice(atIndex + 1);
        const colonIndex = afterAt.indexOf(":");
        if (colonIndex > 0) {
            return afterAt.slice(0, colonIndex);
        }
        const slashIndex = afterAt.indexOf("/");
        if (slashIndex > 0) {
            return afterAt.slice(0, slashIndex);
        }
        return afterAt;
    }
    // Handle host:port format
    const colonIndex = url.indexOf(":");
    if (colonIndex > 0) {
        return url.slice(0, colonIndex);
    }
    return url;
}
/**
 * Creates an egress audit event with standardized fields.
 *
 * @param destination - The destination host/URL
 * @param destinationType - The classified type
 * @param action - The action being performed
 * @param success - Whether it succeeded
 * @param options - Optional error code and metadata
 * @returns A complete audit event
 */
export function createEgressAuditEvent(destination, destinationType, action, success, options) {
    const event = {
        id: `egress_${Date.now()}_${randomUUID()}`,
        timestamp: nowIso(),
        destinationType,
        destination,
        action,
        success,
    };
    if (options?.errorCode !== undefined) {
        event.errorCode = options.errorCode;
    }
    if (options?.metadata !== undefined) {
        event.metadata = options.metadata;
    }
    return event;
}
/**
 * Network Egress Audit Service
 *
 * Records and queries egress audit events.
 * Maintains an in-memory store of all egress events for the session.
 */
export class NetworkEgressAuditService {
    events = [];
    config;
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            captureRequestBody: config.captureRequestBody ?? false,
            captureResponseBody: config.captureResponseBody ?? false,
            maxBodyCaptureBytes: config.maxBodyCaptureBytes ?? 1024,
            filterDestinationTypes: config.filterDestinationTypes ?? [],
        };
    }
    /**
     * Records an egress event.
     * Classifies the URL and extracts destination automatically.
     *
     * @param url - The URL that was accessed
     * @param action - The action performed
     * @param success - Whether it succeeded
     * @param options - Optional error code and metadata
     * @returns The created audit event
     */
    recordEgress(url, action, success, options) {
        if (!this.config.enabled) {
            throw new ValidationError("network_egress_audit.disabled", "Network egress audit is disabled", {
                retryable: false,
            });
        }
        const destinationType = classifyUrl(url);
        const destination = extractDestination(url);
        const event = createEgressAuditEvent(destination, destinationType, action, success, options);
        this.events.push(event);
        return event;
    }
    /**
     * Returns all recorded egress events.
     *
     * @returns All audit events in chronological order
     */
    getEvents() {
        return this.events;
    }
    /**
     * Returns events filtered by destination type.
     *
     * @param type - The destination type to filter by
     * @returns Filtered audit events
     */
    getEventsByType(type) {
        return this.events.filter((e) => e.destinationType === type);
    }
    /**
     * Returns only failed egress events.
     * Useful for security review and debugging.
     *
     * @returns Failed audit events
     */
    getFailedEvents() {
        return this.events.filter((e) => !e.success);
    }
    /**
     * Clears all recorded events.
     */
    clearEvents() {
        this.events = [];
    }
    /**
     * Returns the current configuration.
     *
     * @returns Copy of the service configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
/**
 * Global singleton instance of the audit service.
 * Provides a convenient way to record egress from anywhere.
 */
let globalAuditService = null;
/**
 * Gets or creates the global egress audit service instance.
 *
 * @returns The global audit service
 */
export function getGlobalEgressAuditService() {
    if (!globalAuditService) {
        globalAuditService = new NetworkEgressAuditService();
    }
    return globalAuditService;
}
/**
 * Convenience function to record an egress event via the global service.
 *
 * @param url - The URL that was accessed
 * @param action - The action performed
 * @param success - Whether it succeeded
 * @param options - Optional error code and metadata
 * @returns The created audit event
 */
export function recordEgress(url, action, success, options) {
    return getGlobalEgressAuditService().recordEgress(url, action, success, options);
}
//# sourceMappingURL=network-egress-audit.js.map