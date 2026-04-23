/**
 * @fileoverview Division Routes - Division listing endpoints.
 *
 * Routes:
 * - GET /divisions
 * - GET /v1/divisions
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import { buildJsonResponse } from "./utils.js";
function listDivisions(deps) {
    return deps.divisionRegistry != null
        ? [...deps.divisionRegistry.divisions.values()].map((division) => ({
            divisionId: division.id,
            name: division.name,
            description: division.description,
            defaultWorkflowId: division.defaultWorkflowId,
        }))
        : deps.missionControlService.getSnapshot().divisions;
}
export function createDivisionRoutes(deps) {
    return [
        {
            method: "GET",
            pathname: "/v1/divisions",
            handler: (ctx) => {
                const divisions = listDivisions(deps);
                return buildJsonResponse(ctx.requestId, 200, { divisions });
            },
        },
        // Legacy non-v1 route - uses same handler logic via pathname
        {
            method: "GET",
            pathname: "/divisions",
            handler: (ctx) => {
                const divisions = listDivisions(deps);
                return buildJsonResponse(ctx.requestId, 200, { divisions });
            },
        },
    ];
}
//# sourceMappingURL=division-routes.js.map