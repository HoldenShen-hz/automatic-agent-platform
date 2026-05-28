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

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import {
  createGlobalSingletonSlot,
  getOrCreateGlobalSingleton,
} from "../../shared/lifecycle/global-singleton.js";

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

  /** Maximum number of in-memory events retained */
  maxEvents?: number;
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
export function parseUrlForAudit(url: string): ParsedUrl | null {
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
export function classifyUrl(url: string): EgressDestinationType {
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
export function extractDestination(url: string): string {
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
export function createEgressAuditEvent(
  destination: string,
  destinationType: EgressDestinationType,
  action: string,
  success: boolean,
  options?: {
    errorCode?: string;
    metadata?: Record<string, unknown>;
  },
): EgressAuditEvent {
  const event: EgressAuditEvent = {
    id: newId("egress"),
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
  private static readonly DEFAULT_MAX_EVENTS = 1000;
  private events: EgressAuditEvent[] = [];
  private config: Required<EgressAuditConfig>;

  constructor(config: EgressAuditConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      captureRequestBody: config.captureRequestBody ?? false,
      captureResponseBody: config.captureResponseBody ?? false,
      maxBodyCaptureBytes: config.maxBodyCaptureBytes ?? 1024,
      filterDestinationTypes: config.filterDestinationTypes ?? [],
      maxEvents: Math.max(1, config.maxEvents ?? NetworkEgressAuditService.DEFAULT_MAX_EVENTS),
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
  recordEgress(
    url: string,
    action: string,
    success: boolean,
    options?: {
      errorCode?: string;
      metadata?: Record<string, unknown>;
    },
  ): EgressAuditEvent {
    if (!this.config.enabled) {
      throw new ValidationError("network_egress_audit.disabled", "Network egress audit is disabled", {
        retryable: false,
      });
    }

    const destinationType = classifyUrl(url);
    const destination = extractDestination(url);

    const event = createEgressAuditEvent(destination, destinationType, action, success, options);
    this.events.push(event);
    if (this.events.length > this.config.maxEvents) {
      this.events.splice(0, this.events.length - this.config.maxEvents);
    }
    return event;
  }

  /**
   * Returns all recorded egress events.
   *
   * @returns All audit events in chronological order
   */
  getEvents(): readonly EgressAuditEvent[] {
    return this.events;
  }

  /**
   * Returns events filtered by destination type.
   *
   * @param type - The destination type to filter by
   * @returns Filtered audit events
   */
  getEventsByType(type: EgressDestinationType): readonly EgressAuditEvent[] {
    return this.events.filter((e) => e.destinationType === type);
  }

  /**
   * Returns only failed egress events.
   * Useful for security review and debugging.
   *
   * @returns Failed audit events
   */
  getFailedEvents(): readonly EgressAuditEvent[] {
    return this.events.filter((e) => !e.success);
  }

  /**
   * Clears all recorded events.
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Returns the current configuration.
   *
   * @returns Copy of the service configuration
   */
  getConfig(): Readonly<Required<EgressAuditConfig>> {
    return { ...this.config };
  }
}

/**
 * Global singleton instance of the audit service.
 * Provides a convenient way to record egress from anywhere.
 */
const globalAuditService = createGlobalSingletonSlot<NetworkEgressAuditService>();

export function setGlobalEgressAuditService(service: NetworkEgressAuditService): NetworkEgressAuditService {
  return getOrCreateGlobalSingleton(
    globalAuditService,
    () => service,
    { name: "network-egress-audit-service" },
  );
}

/**
 * Gets or creates the global egress audit service instance.
 *
 * @returns The global audit service
 */
export function getGlobalEgressAuditService(): NetworkEgressAuditService {
  return getOrCreateGlobalSingleton(
    globalAuditService,
    () => new NetworkEgressAuditService(),
    { name: "network-egress-audit-service" },
  );
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
export function recordEgress(
  url: string,
  action: string,
  success: boolean,
  options?: {
    errorCode?: string;
    metadata?: Record<string, unknown>;
  },
): EgressAuditEvent {
  return getGlobalEgressAuditService().recordEgress(url, action, success, options);
}
