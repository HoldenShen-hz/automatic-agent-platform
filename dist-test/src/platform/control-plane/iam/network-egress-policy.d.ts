/**
 * Network Egress Policy
 *
 * Enforces network egress policies for outbound connections.
 * Supports both audit-only and enforcement modes.
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
 * - `enforce`: Actually blocks prohibited connections
 *
 * ## Configuration (Environment Variables)
 *
 * - AA_EGRESS_POLICY_ENABLED: Set to 0 to disable
 * - AA_EGRESS_POLICY_MODE: "audit_only" or "enforce"
 * - AA_EGRESS_ALLOWED_DOMAINS: Comma-separated allowed domains
 * - AA_EGRESS_BLOCKED_DOMAINS: Comma-separated blocked domains
 * - AA_EGRESS_ALLOWED_TYPES: Comma-separated allowed destination types
 * - AA_EGRESS_BLOCKED_TYPES: Comma-separated blocked destination types
 * - AA_EGRESS_ALLOW_INTERNAL: Set to 1 to allow internal hosts
 *
 * @see network-egress-audit.ts for the audit service used
 */
import { NetworkEgressAuditService, type EgressDestinationType } from "./network-egress-audit.js";
/**
 * Policy enforcement mode.
 */
export type NetworkEgressPolicyMode = "audit_only" | "enforce";
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
 * Loads network egress policy configuration from environment variables.
 * Provides a convenient way to configure the policy from env vars.
 *
 * @param env - Environment to read from (defaults to process.env)
 * @returns Policy configuration object
 */
export declare function loadNetworkEgressPolicyConfigFromEnv(env?: NodeJS.ProcessEnv): NetworkEgressPolicyConfig;
/**
 * Network Egress Policy Service
 *
 * Evaluates outbound connection requests against configured policies.
 * Can operate in audit-only mode (log only) or enforce mode (block).
 */
export declare class NetworkEgressPolicyService {
    private readonly enabled;
    private readonly mode;
    private readonly allowedDomains;
    private readonly blockedDomains;
    private readonly allowedDestinationTypes;
    private readonly blockedDestinationTypes;
    private readonly allowInternalHosts;
    private readonly auditService;
    constructor(config?: NetworkEgressPolicyConfig);
    /**
     * Returns the current policy mode.
     */
    getMode(): NetworkEgressPolicyMode;
    /**
     * Evaluates a URL against the policy.
     * Returns a decision object indicating whether the URL is allowed.
     *
     * @param url - The URL to evaluate
     * @returns NetworkEgressDecision with the evaluation result
     */
    evaluate(url: string): NetworkEgressDecision;
    /**
     * Records an egress event to the audit service.
     *
     * @param url - The URL that was accessed
     * @param action - The action performed
     * @param success - Whether it succeeded
     * @param options - Optional error code and metadata
     */
    record(url: string, action: string, success: boolean, options?: {
        errorCode?: string;
        metadata?: Record<string, unknown>;
    }): void;
}
/**
 * Gets or creates the global network egress policy service.
 * Configuration is loaded from environment variables.
 *
 * @returns The global policy service
 */
export declare function getGlobalNetworkEgressPolicyService(): NetworkEgressPolicyService;
/**
 * Resets the global policy service.
 * Primarily used for testing.
 */
export declare function resetGlobalNetworkEgressPolicyService(): void;
/**
 * Creates a policy-aware fetch function.
 * The returned fetch automatically checks URLs against the policy
 * and records all requests to the audit service.
 *
 * @param fetchImpl - The underlying fetch implementation
 * @param options - Options including action name and policy to use
 * @returns A wrapped fetch function that enforces egress policy
 */
export declare function createPolicyAwareFetch(fetchImpl: typeof fetch, options: PolicyAwareFetchOptions): typeof fetch;
