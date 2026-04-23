/**
 * Federation Routing Service
 *
 * Implements API Gateway federation routing for ecosystem cooperation.
 * Allows routing requests to partner platforms through federation.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */
import { z } from "zod";
/**
 * Federation partner status
 */
export type FederationPartnerStatus = "active" | "inactive" | "suspended";
/**
 * Federation partner schema
 */
export declare const FederationPartnerSchema: z.ZodObject<{
    partnerId: z.ZodString;
    partnerName: z.ZodString;
    endpoint: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive", "suspended"]>>;
    retryPolicy: z.ZodDefault<z.ZodObject<{
        maxRetries: z.ZodDefault<z.ZodNumber>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        timeoutMs: number;
    }, {
        maxRetries?: number | undefined;
        timeoutMs?: number | undefined;
    }>>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "suspended" | "inactive";
    endpoint: string;
    retryPolicy: {
        maxRetries: number;
        timeoutMs: number;
    };
    capabilities: string[];
    metadata: Record<string, unknown>;
    partnerId: string;
    partnerName: string;
    apiKey?: string | undefined;
}, {
    endpoint: string;
    partnerId: string;
    partnerName: string;
    status?: "active" | "suspended" | "inactive" | undefined;
    retryPolicy?: {
        maxRetries?: number | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
    capabilities?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
    apiKey?: string | undefined;
}>;
export type FederationPartner = z.infer<typeof FederationPartnerSchema>;
/**
 * Federation route request
 */
export interface FederationRouteRequest {
    readonly partnerId: string;
    readonly path: string;
    readonly method: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
}
/**
 * Federation route decision
 */
export interface FederationRouteDecision {
    readonly partner: FederationPartner | null;
    readonly targetUrl: string | null;
    readonly allowed: boolean;
    readonly reason?: string;
    readonly fallbackEnabled: boolean;
}
/**
 * Federation routing configuration
 */
export interface FederationRoutingConfig {
    readonly defaultTimeout: number;
    readonly maxRetries: number;
    readonly enableFallback: boolean;
    readonly rateLimitPerPartner: number;
}
/**
 * Federation routing service for API Gateway
 */
export declare class FederationRoutingService {
    private readonly partners;
    private readonly config;
    constructor(config?: Partial<FederationRoutingConfig>);
    /**
     * Register a federation partner
     */
    registerPartner(partner: FederationPartner): void;
    /**
     * Get a federation partner by ID
     */
    getPartner(partnerId: string): FederationPartner | undefined;
    /**
     * List all active partners
     */
    listActivePartners(): readonly FederationPartner[];
    /**
     * Update partner status
     */
    updatePartnerStatus(partnerId: string, status: FederationPartnerStatus): boolean;
    /**
     * Route a request to a federation partner
     */
    route(request: FederationRouteRequest): FederationRouteDecision;
    /**
     * Check if a partner supports a capability
     */
    partnerSupportsCapability(partnerId: string, capability: string): boolean;
    /**
     * Get routing info for a partner
     */
    getRoutingInfo(partnerId: string): {
        targetUrl: string;
        timeout: number;
        maxRetries: number;
    } | null;
    /**
     * Check rate limit for partner
     */
    checkRateLimit(partnerId: string, currentRequests: number): boolean;
    /**
     * Build target URL for a partner request
     */
    private buildTargetUrl;
}
/**
 * Federation routing middleware configuration
 */
export interface FederationMiddlewareConfig {
    readonly federationEnabled: boolean;
    readonly partnerIdHeader: string;
    readonly authHeader: string;
    readonly traceHeader: string;
}
/**
 * Default federation middleware config
 */
export declare const DEFAULT_FEDERATION_MIDDLEWARE_CONFIG: FederationMiddlewareConfig;
