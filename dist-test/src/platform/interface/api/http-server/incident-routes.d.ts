/**
 * Incident Routes - REST API for incident management.
 *
 * Routes:
 * - GET /v1/incidents - List incidents
 * - GET /v1/incidents/:id - Get incident
 * - POST /v1/incidents - Create incident
 * - PATCH /v1/incidents/:id - Update incident
 *
 * Part of §6 API Endpoints (REST Endpoints)
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { IncidentFacadeService } from "../facade-interfaces.js";
export interface IncidentRouteDeps {
    authService: ApiAuthService | null;
    incidentService: IncidentFacadeService;
}
export declare function createIncidentRoutes(deps: IncidentRouteDeps): RouteDefinition[];
