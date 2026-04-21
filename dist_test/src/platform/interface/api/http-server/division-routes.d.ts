/**
 * @fileoverview Division Routes - Division listing endpoints.
 *
 * Routes:
 * - GET /v1/divisions
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { RouteDefinition } from "./types.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { DivisionRegistry } from "../../../../domains/governance/division-loader.js";
export interface DivisionRouteDeps {
    divisionRegistry: DivisionRegistry | null;
    missionControlService: MissionControlService;
}
export declare function createDivisionRoutes(deps: DivisionRouteDeps): RouteDefinition[];
