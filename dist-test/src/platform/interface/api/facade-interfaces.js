/**
 * @fileoverview Facade interfaces for P4/P5 service abstractions.
 *
 * These interfaces allow the interface layer (P1) to depend on abstractions
 * rather than concrete P4/P5 implementations, maintaining architectural boundaries.
 *
 * Part of P2.13: Cross-plane import violations
 */
// ─── No-op implementations for defaults ─────────────────────────────────────
/**
 * No-op implementation of IncidentFacadeService for when no service is configured.
 * Used as a default when incidentService is not provided.
 */
class NoOpIncidentFacadeService {
    listIncidents(limit) {
        return [];
    }
    getIncident(_incidentId) {
        return null;
    }
    openIncident(input) {
        throw new Error("Incident service not configured");
    }
    acknowledge(_incidentId, _owner) {
        throw new Error("Incident service not configured");
    }
    startMitigation(_incidentId) {
        throw new Error("Incident service not configured");
    }
    resolve(_incidentId) {
        throw new Error("Incident service not configured");
    }
}
export function createNoOpIncidentFacadeService() {
    return new NoOpIncidentFacadeService();
}
//# sourceMappingURL=facade-interfaces.js.map