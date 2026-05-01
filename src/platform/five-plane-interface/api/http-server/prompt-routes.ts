import type { HierarchicalPromptRegistryService } from "../../../prompt-engine/registry/hierarchical-registry-service.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, readJsonBody, readLimit, readQueryParam, requirePrincipal } from "./utils.js";
import { z } from "zod";

const promptBundleRequestSchema = z.object({
  level: z.enum(["global", "domain", "pack", "task-type"]).optional(),
  domain: z.string().optional(),
  packId: z.string().optional(),
}).strict();

export interface PromptRouteDeps {
  authService: ApiAuthService | null;
  promptRegistryService: HierarchicalPromptRegistryService;
}

export function createPromptRoutes(deps: PromptRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/prompts",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 50);
        const level = readQueryParam(ctx.request, "level", { maxLength: 32 }) as "global" | "domain" | "pack" | undefined;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const prompts = deps.promptRegistryService.listBundles(level, domain, packId);
        return buildJsonResponse(ctx.requestId, 200, {
          prompts: prompts.slice(0, limit),
          total: prompts.length,
        });
      },
    },
    {
      method: "POST",
      pathname: "/v1/prompts",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        // §7.1: Use Zod inferred output type to preserve validated type safety
        // The payload is schema-validated at the HTTP boundary per §5.2
        const payload = readValidatedJsonBody(ctx.request.body, promptBundleRequestSchema.parse);
        const level = (payload.level as "global" | "domain" | "pack" | "task-type" | undefined) ?? "global";
        // §7.1: Replace 'as any' with explicit unsafe cast through unknown to make type bypass intentional
        // Zod has validated level/domain/packId; registerBundle requires additional fields not in this schema
        const bundle = deps.promptRegistryService.registerBundle(
          payload as unknown as Parameters<typeof deps.promptRegistryService.registerBundle>[0],
          level,
          payload.domain as string | undefined,
          payload.packId as string | undefined,
        );
        return buildJsonResponse(ctx.requestId, 201, { bundle });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        if (ctx.route.segments.length !== 3 || ctx.route.segments[0] !== "v1" || ctx.route.segments[1] !== "prompts") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const name = decodeURIComponent(ctx.route.segments[2] ?? "");
        const taskType = readQueryParam(ctx.request, "taskType", { required: true, maxLength: 128 })!;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const bundle = deps.promptRegistryService.getBundle(name, taskType, packId, domain);
        if (!bundle) {
          return buildJsonResponse(ctx.requestId, 404, { error: { code: "prompt.bundle_not_found", message: `Bundle ${name} not found.` } });
        }
        return buildJsonResponse(ctx.requestId, 200, { bundle });
      },
    },
    {
      method: "PUT",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        if (ctx.route.segments.length !== 4 || ctx.route.segments[0] !== "v1" || ctx.route.segments[1] !== "prompts" || ctx.route.segments[3] !== "deprecate") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "operator");
        const name = decodeURIComponent(ctx.route.segments[2] ?? "");
        const payload = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const level = (payload.level as "global" | "domain" | "pack" | "task-type" | undefined) ?? "global";
        const domain = payload.domain as string | undefined;
        const packId = payload.packId as string | undefined;
        // R20-23: Check if bundle exists before deprecating
        const existing = deps.promptRegistryService.getBundle(name, String(payload.version ?? ""), packId, domain);
        if (!existing) {
          return buildJsonResponse(ctx.requestId, 404, { error: { code: "prompt.bundle_not_found", message: `Bundle ${name} not found.` } });
        }
        deps.promptRegistryService.deprecateBundle(
          name,
          String(payload.version ?? ""),
          level,
          domain,
          packId,
        );
        return buildJsonResponse(ctx.requestId, 200, { deprecated: true, name });
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        if (ctx.route.segments.length !== 3 || ctx.route.segments[0] !== "v1" || ctx.route.segments[1] !== "prompts") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "admin");
        const name = decodeURIComponent(ctx.route.segments[2] ?? "");
        const level = (readQueryParam(ctx.request, "level", { maxLength: 32 }) as "global" | "domain" | "pack" | "task-type" | undefined) ?? "global";
        const version = readQueryParam(ctx.request, "version", { required: true, maxLength: 64 })!;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const removed = deps.promptRegistryService.removeBundle(name, version, level, domain, packId);
        return buildJsonResponse(ctx.requestId, removed ? 200 : 404, { removed, name, version });
      },
    },
  ];
}
