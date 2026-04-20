/**
 * Pack Routes - REST API for pack management.
 *
 * Routes:
 * - GET /v1/packs - List packs
 * - GET /v1/packs/:id - Get pack
 * - POST /v1/packs - Create pack
 *
 * Part of §6 API Endpoints (REST Endpoints)
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { buildJsonResponse, requirePrincipal, resolveTenantScope, readLimit } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { AppError } from "../../../contracts/errors.js";
import { z } from "zod";
import type { PackCatalogService } from "../pack-catalog-service.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const nonEmptyStringSchema = z.string().trim().min(1);

const createPackSchema = z.object({
  packId: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  version: nonEmptyStringSchema,
  domainId: nonEmptyStringSchema,
  description: z.string().optional(),
  riskMatrix: z.array(z.object({
    riskId: nonEmptyStringSchema,
    level: z.enum(["low", "medium", "high", "critical"]),
    triggers: z.array(z.string()).optional(),
    mitigation: z.string().optional(),
    escalationPolicy: z.string().optional(),
  })).optional(),
  toolBundles: z.array(z.string()).optional(),
  pluginIds: z.array(z.string()).optional(),
  dependencies: z.array(z.object({
    packId: nonEmptyStringSchema,
    versionRange: z.string().optional(),
    optional: z.boolean().optional(),
    reason: z.string().optional(),
  })).optional(),
  sandboxTier: z.enum(["none", "process", "container", "scoped_external_access"]).optional(),
}).strict();

export interface CreatePackPayload {
  packId: string;
  name: string;
  version: string;
  domainId: string;
  description?: string;
  riskMatrix?: Array<{
    riskId: string;
    level: "low" | "medium" | "high" | "critical";
    triggers?: string[];
    mitigation?: string;
    escalationPolicy?: string;
  }>;
  toolBundles?: string[];
  pluginIds?: string[];
  dependencies?: Array<{
    packId: string;
    versionRange?: string;
    optional?: boolean;
    reason?: string;
  }>;
  sandboxTier?: "none" | "process" | "container" | "scoped_external_access";
}

// ─── Route Deps ─────────────────────────────────────────────────────────────

export interface PackRouteDeps {
  authService: ApiAuthService | null;
  packCatalogService: PackCatalogService;
}

// ─── Route Factory ─────────────────────────────────────────────────────────

export function createPackRoutes(deps: PackRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/packs",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const tenantId = resolveTenantScope(principal, undefined);
        const limit = readLimit(ctx.request, 50);

        void tenantId;
        return buildJsonResponse(ctx.requestId, 200, {
          packs: deps.packCatalogService.listPacks(limit),
          total: deps.packCatalogService.listPacks(Number.MAX_SAFE_INTEGER).length,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "v1" || segments[1] !== "packs" || segments.length !== 3) {
          return null;
        }

        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const packId = segments[2]!;

        void principal;
        const pack = deps.packCatalogService.getPack(packId);
        if (pack == null) {
          throw new ApiError(404, "pack.not_found", `Pack ${packId} not found.`);
        }
        return buildJsonResponse(ctx.requestId, 200, pack);
      },
    },
    {
      method: "POST",
      pathname: "/v1/packs",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, createPackSchema.parse);
        const tenantId = resolveTenantScope(principal, undefined);

        void tenantId;
        const pack = deps.packCatalogService.createPack({
          packId: payload.packId,
          name: payload.name,
          version: payload.version,
          domainId: payload.domainId,
          createdBy: principal.actorId,
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.sandboxTier !== undefined ? { sandboxTier: payload.sandboxTier } : {}),
          riskCount: payload.riskMatrix?.length ?? 0,
          dependencyCount: payload.dependencies?.length ?? 0,
          pluginCount: payload.pluginIds?.length ?? 0,
          toolBundleCount: payload.toolBundles?.length ?? 0,
        });

        return buildJsonResponse(ctx.requestId, 201, pack);
      },
    },
  ];
}
