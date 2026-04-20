/**
 * @fileoverview Division Routes - Division listing endpoints.
 *
 * Routes:
 * - GET /v1/divisions
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildJsonResponse } from "./utils.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { DivisionRegistry } from "../../../../domains/governance/division-loader.js";

export interface DivisionRouteDeps {
  divisionRegistry: DivisionRegistry | null;
  missionControlService: MissionControlService;
}

export function createDivisionRoutes(deps: DivisionRouteDeps): RouteDefinition[] {
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
