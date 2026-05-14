/**
 * Federation Routing Service
 *
 * Implements API Gateway federation routing for ecosystem cooperation.
 * Allows routing requests to partner platforms through federation.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import { z } from "zod";

export const FEDERATION_API_DEFAULT_VERSION = "2026-04-01";
export const FEDERATION_API_MINIMUM_VERSION = "2026-01-01";

/**
 * Federation partner status
 */
export type FederationPartnerStatus = "active" | "inactive" | "suspended";

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

const DEFAULT_FEDERATION_CONFIG: FederationRoutingConfig = {
  defaultTimeout: 30000,
  maxRetries: 3,
  enableFallback: true,
  rateLimitPerPartner: 1000,
};

/**
 * Federation routing service for API Gateway
 */
export class FederationRoutingService {
  private readonly partners = new Map<string, FederationPartner>();
  private readonly config: FederationRoutingConfig;

  public constructor(config?: Partial<FederationRoutingConfig>) {
    this.config = { ...DEFAULT_FEDERATION_CONFIG, ...config };
  }

  /**
   * Register a federation partner
   */
  public registerPartner(partner: FederationPartner): void {
    const validated = FederationPartnerSchema.parse(partner);
    this.partners.set(validated.partnerId, validated);
  }

  /**
   * Get a federation partner by ID
   */
  public getPartner(partnerId: string): FederationPartner | undefined {
    return this.partners.get(partnerId);
  }

  /**
   * List all active partners
   */
  public listActivePartners(): readonly FederationPartner[] {
    return Array.from(this.partners.values()).filter((p) => p.status === "active");
  }

  /**
   * Update partner status
   */
  public updatePartnerStatus(partnerId: string, status: FederationPartnerStatus): boolean {
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
  public route(request: FederationRouteRequest): FederationRouteDecision {
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
  public partnerSupportsCapability(partnerId: string, capability: string): boolean {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      return false;
    }
    return partner.capabilities.includes(capability);
  }

  /**
   * Get routing info for a partner
   */
  public getRoutingInfo(partnerId: string): {
    targetUrl: string;
    timeout: number;
    maxRetries: number;
  } | null {
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
  public checkRateLimit(partnerId: string, currentRequests: number): boolean {
    return currentRequests < this.config.rateLimitPerPartner;
  }

  /**
   * Build target URL for a partner request
   */
  private buildTargetUrl(partner: FederationPartner, path: string): string {
    const baseUrl = partner.endpoint.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }
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
export const DEFAULT_FEDERATION_MIDDLEWARE_CONFIG: FederationMiddlewareConfig = {
  federationEnabled: true,
  partnerIdHeader: "X-Federation-Partner-ID",
  authHeader: "Authorization",
  traceHeader: "X-Federation-Trace-ID",
};
