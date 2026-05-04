/**
 * Network Egress Policy
 *
 * Enforces network egress policies for outbound connections.
 * Supports audit-only and blocking modes.
 *
 * ## Purpose
 *
 * Control what network destinations the agent can access:
 * - Allow/deny specific domain patterns
 * - Allow/deny destination types (URL, SSH, S3, registry)
 * - Block internal network access
 * - Audit all egress attempts
 *
 * ## Modes
 *
 * - `audit_only`: Records decisions and logs, but doesn't block
 * - `deny`: Blocks prohibited connections (default)
 * - `enforce`: Alias for `deny`
 *
 * ## Configuration (Environment Variables)
 *
 * - AA_EGRESS_POLICY_ENABLED: Set to 0 to disable
 * - AA_EGRESS_POLICY_MODE: "audit_only", "deny", or "enforce"
 * - AA_EGRESS_ALLOWED_DOMAINS: Comma-separated allowed domains
 * - AA_EGRESS_BLOCKED_DOMAINS: Comma-separated blocked domains
 * - AA_EGRESS_ALLOWED_TYPES: Comma-separated allowed destination types
 * - AA_EGRESS_BLOCKED_TYPES: Comma-separated blocked destination types
 * - AA_EGRESS_ALLOW_INTERNAL: Set to 1 to allow internal hosts
 *
 * @see network-egress-audit.ts for the audit service used
 */

import {
  NetworkEgressAuditService,
  classifyUrl,
  extractDestination,
  getGlobalEgressAuditService,
  parseUrlForAudit,
  type EgressDestinationType,
} from "./network-egress-audit.js";
import { PolicyDeniedError } from "../../contracts/errors.js";

/**
 * Policy enforcement mode.
 * - `audit_only`: Records decisions and logs, but doesn't block
 * - `deny`: Blocks prohibited connections (default per §11.5)
 * - `enforce`: Alias for deny, actually blocks prohibited connections
 */
export type NetworkEgressPolicyMode = "audit_only" | "deny" | "enforce";

/**
 * Configuration for the network egress policy service.
 */
export interface NetworkEgressPolicyConfig {
  /** Enable/disable the policy */
  enabled?: boolean;

  /** Enforcement mode */
  mode?: NetworkEgressPolicyMode;

  /** Allowed destination domains (supports subdomain matching) */
  allowedDomains?: readonly string[];

  /** Blocked destination domains */
  blockedDomains?: readonly string[];

  /** Allowed destination types */
  allowedDestinationTypes?: readonly EgressDestinationType[];

  /** Blocked destination types */
  blockedDestinationTypes?: readonly EgressDestinationType[];

  /** Allow access to internal hosts (normally blocked) */
  allowInternalHosts?: boolean;

  /** Audit service to use (defaults to global) */
  auditService?: NetworkEgressAuditService;
}

/**
 * Result of evaluating a URL against the policy.
 */
export interface NetworkEgressDecision {
  /** Whether the destination is allowed */
  allowed: boolean;

  /** The classified destination type */
  destinationType: EgressDestinationType;

  /** The destination host */
  destination: string;

  /** Reason code if blocked, null if allowed */
  reasonCode: string | null;
}

/**
 * Options for creating a policy-aware fetch.
 */
export interface PolicyAwareFetchOptions {
  /** Action name for audit logging */
  action: string;

  /** Optional policy service to use */
  policy?: NetworkEgressPolicyService;
}

/**
 * Patterns for identifying internal/private hostnames.
 * Used to block access to internal infrastructure.
 */
const INTERNAL_HOSTNAME_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/i,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /^localhost$/i,
  /\.(local|localhost|internal|private)$/i,
];

/**
 * Parses a comma-separated list from environment variable.
 *
 * @param value - The environment variable value
 * @returns Array of trimmed, non-empty strings
 */
function parseCsvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses destination types from comma-separated string.
 *
 * @param value - The environment variable value
 * @returns Array of valid destination types
 */
function parseDestinationTypes(value: string | undefined): EgressDestinationType[] {
  const allowed: EgressDestinationType[] = [];
  for (const item of parseCsvList(value)) {
    if (
      item === "url"
      || item === "ssh"
      || item === "s3"
      || item === "registry"
      || item === "publish"
      || item === "unknown"
    ) {
      allowed.push(item);
    }
  }
  return allowed;
}

/**
 * Normalizes and deduplicates a list of domains.
 *
 * @param value - Array of domains or undefined
 * @returns Lowercase, trimmed, deduplicated domain list
 */
function normalizeDomains(value: readonly string[] | undefined): string[] {
  return [...new Set((value ?? []).map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0))];
}

/**
 * Checks if a hostname is internal/private.
 *
 * @param hostname - The hostname to check
 * @returns true if the hostname is internal
 */
function isInternalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return INTERNAL_HOSTNAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Checks if a hostname matches a domain pattern.
 * Supports exact match and subdomain matching (*.example.com).
 *
 * @param hostname - The hostname to check
 * @param candidate - The domain pattern to match against
 * @returns true if hostname matches the pattern
 */
function domainMatches(hostname: string, candidate: string): boolean {
  return hostname === candidate || hostname.endsWith(`.${candidate}`);
}

/**
 * Extracts URL string from various input types.
 *
 * @param input - URL string, URL object, or Request
 * @returns The URL string
 */
function extractUrlString(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

/**
 * Loads network egress policy configuration from environment variables.
 * Provides a convenient way to configure the policy from env vars.
 *
 * @param env - Environment to read from (defaults to process.env)
 * @returns Policy configuration object
 */
export function loadNetworkEgressPolicyConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NetworkEgressPolicyConfig {
  const modeValue = (env["AA_EGRESS_POLICY_MODE"] ?? "deny").trim().toLowerCase();
  const mode: NetworkEgressPolicyMode = modeValue === "audit_only"
    ? "audit_only"
    : modeValue === "enforce"
      ? "enforce"
      : "deny";
  return {
    enabled: env["AA_EGRESS_POLICY_ENABLED"] !== "0",
    mode,
    allowedDomains: parseCsvList(env["AA_EGRESS_ALLOWED_DOMAINS"]),
    blockedDomains: parseCsvList(env["AA_EGRESS_BLOCKED_DOMAINS"]),
    allowedDestinationTypes: parseDestinationTypes(env["AA_EGRESS_ALLOWED_TYPES"]),
    blockedDestinationTypes: parseDestinationTypes(env["AA_EGRESS_BLOCKED_TYPES"]),
    allowInternalHosts: env["AA_EGRESS_ALLOW_INTERNAL"] === "1",
  };
}

/**
 * Network Egress Policy Service
 *
 * Evaluates outbound connection requests against configured policies.
 * Can operate in audit-only mode (log only) or blocking mode (`deny` / `enforce`).
 */
export class NetworkEgressPolicyService {
  private readonly enabled: boolean;
  private readonly mode: NetworkEgressPolicyMode;
  private readonly allowedDomains: string[];
  private readonly blockedDomains: string[];
  private readonly allowedDestinationTypes: EgressDestinationType[];
  private readonly blockedDestinationTypes: EgressDestinationType[];
  private readonly allowInternalHosts: boolean;
  private readonly auditService: NetworkEgressAuditService;

  public constructor(config: NetworkEgressPolicyConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.mode = config.mode ?? "deny";
    this.allowedDomains = normalizeDomains(config.allowedDomains);
    this.blockedDomains = normalizeDomains(config.blockedDomains);
    this.allowedDestinationTypes = [...new Set(config.allowedDestinationTypes ?? [])];
    this.blockedDestinationTypes = [...new Set(config.blockedDestinationTypes ?? [])];
    this.allowInternalHosts = config.allowInternalHosts === true;
    this.auditService = config.auditService ?? getGlobalEgressAuditService();
  }

  /**
   * Returns the current policy mode.
   */
  public getMode(): NetworkEgressPolicyMode {
    return this.mode;
  }

  private isBlockingMode(): boolean {
    return this.mode !== "audit_only";
  }

  /**
   * Evaluates a URL against the policy.
   * Returns a decision object indicating whether the URL is allowed.
   *
   * @param url - The URL to evaluate
   * @returns NetworkEgressDecision with the evaluation result
   */
  public evaluate(url: string): NetworkEgressDecision {
    const destinationType = classifyUrl(url);
    const destination = extractDestination(url);

    // Policy disabled means everything is allowed
    if (!this.enabled) {
      return { allowed: true, destinationType, destination, reasonCode: null };
    }

    const parsed = parseUrlForAudit(url);
    const hostname = parsed?.host?.toLowerCase() ?? destination.toLowerCase();

    // Check internal hostname block
    if (!this.allowInternalHosts && isInternalHostname(hostname)) {
      // R12-20 fix: blocked destinations always report allowed:false per §11.5
      // The mode (audit_only vs deny) only controls enforcement, not the decision fact
      return {
        allowed: false,
        destinationType,
        destination,
        reasonCode: "EGRESS_INTERNAL_BLOCKED",
      };
    }

    // Check blocked destination types
    if (this.blockedDestinationTypes.includes(destinationType)) {
      return {
        allowed: false,
        destinationType,
        destination,
        reasonCode: "EGRESS_TYPE_BLOCKED",
      };
    }

    // Check allowed destination types (if specified, only these are allowed)
    if (
      this.allowedDestinationTypes.length > 0
      && !this.allowedDestinationTypes.includes(destinationType)
    ) {
      return {
        allowed: false,
        destinationType,
        destination,
        reasonCode: "EGRESS_TYPE_NOT_ALLOWED",
      };
    }

    // Check blocked domains
    if (this.blockedDomains.some((item) => domainMatches(hostname, item))) {
      return {
        allowed: false,
        destinationType,
        destination,
        reasonCode: "EGRESS_DOMAIN_BLOCKED",
      };
    }

    // Check allowed domains (if specified, only these are allowed)
    if (
      this.allowedDomains.length > 0
      && !this.allowedDomains.some((item) => domainMatches(hostname, item))
    ) {
      return {
        allowed: false,
        destinationType,
        destination,
        reasonCode: "EGRESS_DOMAIN_NOT_ALLOWED",
      };
    }

    return { allowed: true, destinationType, destination, reasonCode: null };
  }

  /**
   * Records an egress event to the audit service.
   *
   * @param url - The URL that was accessed
   * @param action - The action performed
   * @param success - Whether it succeeded
   * @param options - Optional error code and metadata
   */
  public record(
    url: string,
    action: string,
    success: boolean,
    options?: {
      errorCode?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    this.auditService.recordEgress(url, action, success, options);
  }
}

/**
 * Global singleton policy service instance.
 */
let globalPolicyService: NetworkEgressPolicyService | null = null;

/**
 * Gets or creates the global network egress policy service.
 * Configuration is loaded from environment variables.
 *
 * @returns The global policy service
 */
export function getGlobalNetworkEgressPolicyService(): NetworkEgressPolicyService {
  if (globalPolicyService == null) {
    globalPolicyService = new NetworkEgressPolicyService(loadNetworkEgressPolicyConfigFromEnv());
  }
  return globalPolicyService;
}

/**
 * Resets the global policy service.
 * Primarily used for testing.
 */
export function resetGlobalNetworkEgressPolicyService(): void {
  globalPolicyService = null;
}

/**
 * Creates a policy-aware fetch function.
 * The returned fetch automatically checks URLs against the policy
 * and records all requests to the audit service.
 *
 * @param fetchImpl - The underlying fetch implementation
 * @param options - Options including action name and policy to use
 * @returns A wrapped fetch function that enforces egress policy
 */
export function createPolicyAwareFetch(
  fetchImpl: typeof fetch,
  options: PolicyAwareFetchOptions,
): typeof fetch {
  const policy = options.policy ?? getGlobalNetworkEgressPolicyService();
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = extractUrlString(input);
    const decision = policy.evaluate(url);

    // Record the decision to audit log
    // §11.5: All egress decisions must be recorded
    if (!decision.allowed) {
      policy.record(url, options.action, false, {
        errorCode: decision.reasonCode ?? "EGRESS_BLOCKED",
        metadata: {
          policyMode: policy.getMode(),
          destinationType: decision.destinationType,
        },
      });
      // In blocking mode (deny/enforce), throw on blocked destinations
      // In audit_only mode, log and continue
      if (policy.getMode() !== "audit_only") {
        throw new PolicyDeniedError("egress.blocked", `egress.blocked:${decision.reasonCode ?? "EGRESS_DOMAIN_BLOCKED"}:${decision.destination}`, {
          details: {
            destination: decision.destination,
            reasonCode: decision.reasonCode ?? "EGRESS_BLOCKED",
            destinationType: decision.destinationType,
          },
        });
      }
      // Fall through in audit_only mode - request proceeds but is logged
    }

    // Attempt the fetch
    try {
      const response = await fetchImpl(input, init);
      policy.record(url, options.action, response.ok, {
        ...(response.ok ? {} : { errorCode: `HTTP_${response.status}` }),
        metadata: {
          policyMode: policy.getMode(),
          destinationType: decision.destinationType,
          statusCode: response.status,
        },
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      policy.record(url, options.action, false, {
        errorCode: "EGRESS_REQUEST_FAILED",
        metadata: {
          policyMode: policy.getMode(),
          destinationType: decision.destinationType,
          message,
        },
      });
      throw error;
    }
  }) as typeof fetch;
}
