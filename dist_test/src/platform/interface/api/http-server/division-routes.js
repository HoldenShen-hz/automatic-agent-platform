/**
 * @fileoverview Division Routes - Division listing endpoints.
 *
 * Routes:
 * - GET /v1/divisions
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import { buildJsonResponse } from "./utils.js";
export function createDivisionRoutes(deps) {
    return [
        {
            method: "GET",
            pathname: "/divisions",
            handler: (ctx) => {
                const divisions = deps.divisionRegistry != null
                    ? [...deps.divisionRegistry.divisions.values()].map((division) => ({
                        divisionId: division.id,
                        name: division.name,
                        description: division.description,
                        defaultWorkflowId: division.defaultWorkflowId,
                    }))
                    : deps.missionControlService.getSnapshot().divisions;
                return buildJsonResponse(ctx.requestId, 200, { divisions });
            },
        },
        {
            method: "GET",
            pathname: "/v1/divisions",
            handler: (ctx) => {
                const divisions = deps.divisionRegistry != null
                    ? [...deps.divisionRegistry.divisions.values()].map((division) => ({
                        divisionId: division.id,
                        name: division.name,
                        description: division.description,
                        defaultWorkflowId: division.defaultWorkflowId,
                    }))
                    : deps.missionControlService.getSnapshot().divisions;
                return buildJsonResponse(ctx.requestId, 200, { divisions });
            },
        },
    ];
}
//# sourceMappingURL=division-routes.js.map