/**
 * Incident Control Module Barrel
 *
 * Re-exports incident management types, services, and utilities for:
 * - Incident detection with SEV1-4 severity classification
 * - Incident resolution with automated post-mortem (72h)
 * - War room coordination for SEV1 multi-participant response
 *
 * §R14-02: SEV1-4 unified severity standard
 * §R14-03: 6-state incident lifecycle (open/triaged/mitigating/reviewed/resolved/closed)
 * §R14-04: Post-mortem automation with 72h Post-Incident Report
 * §R14-10: War-room coordination service for SEV1
 */

export * from "./incident-resolver.js";
export * from "./war-room-coordination-service.js";
export * from "./doctor-service.js";
export * from "./release-pipeline-service.js";
