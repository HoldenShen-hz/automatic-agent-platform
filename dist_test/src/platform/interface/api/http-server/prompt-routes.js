import { buildJsonResponse, readLimit, readQueryParam, requirePrincipal } from "./utils.js";
export function createPromptRoutes(deps) {
    return [
        {
            method: "GET",
            pathname: "/v1/prompts",
            handler: (ctx) => {
                requirePrincipal(ctx.request, deps.authService, "viewer");
                const limit = readLimit(ctx.request, 50);
                const level = readQueryParam(ctx.request, "level", { maxLength: 32 });
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
//# sourceMappingURL=prompt-routes.js.map