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
/**
 * Type of network destination for an egress event.
 */
export type EgressDestinationType = "url" | "ssh" | "s3" | "registry" | "publish" | "unknown";
/**
 * A recorded egress audit event.
 */
export interface EgressAuditEvent {
    /** Unique identifier for this event */
    id: string;
    /** ISO timestamp when the egress occurred */
    timestamp: string;
    /** Classified type of destination */
    destinationType: EgressDestinationType;
    /** The destination host or URL */
    destination: string;
    /** Action performed (e.g., "fetch", "git_push", "s3_download") */
    action: string;
    /** Whether the operation succeeded */
    success: boolean;
    /** Error code if the operation failed */
    errorCode?: string;
    /** Additional metadata about the event */
    metadata?: Record<string, unknown>;
}
/**
 * Configuration for the egress audit service.
 */
export interface EgressAuditConfig {
    /** Whether auditing is enabled */
    enabled?: boolean;
    /** Whether to capture request bodies (may contain sensitive data) */
    captureRequestBody?: boolean;
    /** Whether to capture response bodies */
    captureResponseBody?: boolean;
    /** Maximum bytes to capture from bodies */
    maxBodyCaptureBytes?: number;
    /** Filter to only audit specific destination types */
    filterDestinationTypes?: readonly EgressDestinationType[];
}
/**
 * Parsed components of a URL for audit purposes.
 */
export interface ParsedUrl {
    /** Protocol (http, https, ssh, s3) */
    protocol: string;
    /** Hostname */
    host: string;
    /** Port number (null if standard port) */
    port: number | null;
    /** URL path */
    path: string;
}
/**
 * Parses a URL string into components for audit classification.
 * Supports HTTP, HTTPS, SSH, and S3 URL formats.
 *
 * @param url - The URL string to parse
 * @returns Parsed URL components or null if unparseable
 */
export declare function parseUrlForAudit(url: string): ParsedUrl | null;
/**
 * Classifies a URL into an egress destination type.
 * Uses pattern matching to identify the type of service being accessed.
 *
 * @param url - The URL to classify
 * @returns The destination type classification
 */
export declare function classifyUrl(url: string): EgressDestinationType;
/**
 * Extracts the destination host from a URL.
 * Used as a simpler identifier than the full URL for logging.
 *
 * @param url - The URL to extract destination from
 * @returns The host or a simplified identifier
 */
export declare function extractDestination(url: string): string;
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
export declare function createEgressAuditEvent(destination: string, destinationType: EgressDestinationType, action: string, success: boolean, options?: {
    errorCode?: string;
    metadata?: Record<string, unknown>;
}): EgressAuditEvent;
/**
 * Network Egress Audit Service
 *
 * Records and queries egress audit events.
 * Maintains an in-memory store of all egress events for the session.
 */
export declare class NetworkEgressAuditService {
    private events;
    private config;
    constructor(config?: EgressAuditConfig);
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
    recordEgress(url: string, action: string, success: boolean, options?: {
        errorCode?: string;
        metadata?: Record<string, unknown>;
    }): EgressAuditEvent;
    /**
     * Returns all recorded egress events.
     *
     * @returns All audit events in chronological order
     */
    getEvents(): readonly EgressAuditEvent[];
    /**
     * Returns events filtered by destination type.
     *
     * @param type - The destination type to filter by
     * @returns Filtered audit events
     */
    getEventsByType(type: EgressDestinationType): readonly EgressAuditEvent[];
    /**
     * Returns only failed egress events.
     * Useful for security review and debugging.
     *
     * @returns Failed audit events
     */
    getFailedEvents(): readonly EgressAuditEvent[];
    /**
     * Clears all recorded events.
     */
    clearEvents(): void;
    /**
     * Returns the current configuration.
     *
     * @returns Copy of the service configuration
     */
    getConfig(): Readonly<Required<EgressAuditConfig>>;
}
/**
 * Gets or creates the global egress audit service instance.
 *
 * @returns The global audit service
 */
export declare function getGlobalEgressAuditService(): NetworkEgressAuditService;
/**
 * Convenience function to record an egress event via the global service.
 *
 * @param url - The URL that was accessed
 * @param action - The action performed
 * @param success - Whether it succeeded
 * @param options - Optional error code and metadata
 * @returns The created audit event
 */
export declare function recordEgress(url: string, action: string, success: boolean, options?: {
    errorCode?: string;
    metadata?: Record<string, unknown>;
}): EgressAuditEvent;
