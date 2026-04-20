import type { HierarchicalPromptRegistryService } from "../../../prompt-engine/registry/hierarchical-registry-service.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, readLimit, readQueryParam, requirePrincipal } from "./utils.js";

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
  ];
}
