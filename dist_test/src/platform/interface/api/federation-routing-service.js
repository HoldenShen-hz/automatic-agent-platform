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
 * Federation partner schema
 */
export const FederationPartnerSchema = z.object({
    partnerId: z.string().min(1),
    partnerName: z.string().min(1),
    endpoint: z.string().url(),
    apiKey: z.string().optional(),
    capabilities: z.array(z.string()).default([]),
    status: z.enum(["active", "inactive", "suspended"]).default("active"),
    retryPolicy: z.object({
        maxRetries: z.number().default(3),
        timeoutMs: z.number().default(30000),
    }).default({}),
    metadata: z.record(z.unknown()).default({}),
});
const DEFAULT_FEDERATION_CONFIG = {
    defaultTimeout: 30000,
    maxRetries: 3,
    enableFallback: true,
    rateLimitPerPartner: 1000,
};
/**
 * Federation routing service for API Gateway
 */
export class FederationRoutingService {
    partners = new Map();
    config;
    constructor(config) {
        this.config = { ...DEFAULT_FEDERATION_CONFIG, ...config };
    }
    /**
     * Register a federation partner
     */
    registerPartner(partner) {
        const validated = FederationPartnerSchema.parse(partner);
        this.partners.set(validated.partnerId, validated);
    }
    /**
     * Get a federation partner by ID
     */
    getPartner(partnerId) {
        return this.partners.get(partnerId);
    }
    /**
     * List all active partners
     */
    listActivePartners() {
        return Array.from(this.partners.values()).filter((p) => p.status === "active");
    }
    /**
     * Update partner status
     */
    updatePartnerStatus(partnerId, status) {
        const partner = this.partners.get(partnerId);
        if (!partner) {
            return false;
        }
        partner.status = status;
        return true;
    }
    /**
     * Route a request to a federation partner
     */
    route(request) {
        const partner = this.partners.get(request.partnerId);
        if (!partner) {
            return {
                partner: null,
                targetUrl: null,
                allowed: false,
                reason: "Partner not found",
                fallbackEnabled: this.config.enableFallback,
            };
        }
        if (partner.status !== "active") {
            return {
                partner,
                targetUrl: null,
                allowed: false,
                reason: `Partner status is ${partner.status}`,
                fallbackEnabled: this.config.enableFallback,
            };
        }
        const targetUrl = this.buildTargetUrl(partner, request.path);
        return {
            partner,
            targetUrl,
            allowed: true,
            fallbackEnabled: this.config.enableFallback,
        };
    }
    /**
     * Check if a partner supports a capability
     */
    partnerSupportsCapability(partnerId, capability) {
        const partner = this.partners.get(partnerId);
        if (!partner) {
            return false;
        }
        return partner.capabilities.includes(capability);
    }
    /**
     * Get routing info for a partner
     */
    getRoutingInfo(partnerId) {
        const partner = this.partners.get(partnerId);
        if (!partner || partner.status !== "active") {
            return null;
        }
        return {
            targetUrl: partner.endpoint,
            timeout: partner.retryPolicy.timeoutMs ?? this.config.defaultTimeout,
            maxRetries: partner.retryPolicy.maxRetries ?? this.config.maxRetries,
        };
    }
    /**
     * Check rate limit for partner
     */
    checkRateLimit(partnerId, currentRequests) {
        return currentRequests < this.config.rateLimitPerPartner;
    }
    /**
     * Build target URL for a partner request
     */
    buildTargetUrl(partner, path) {
        const baseUrl = partner.endpoint.replace(/\/$/, "");
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    }
}
/**
 * Default federation middleware config
 */
export const DEFAULT_FEDERATION_MIDDLEWARE_CONFIG = {
    federationEnabled: true,
    partnerIdHeader: "X-Federation-Partner-ID",
    authHeader: "Authorization",
    traceHeader: "X-Federation-Trace-ID",
};
//# sourceMappingURL=federation-routing-service.js.map