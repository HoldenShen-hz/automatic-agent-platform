/**
 * SystemSituation — aggregated system-level health and resource state.
 *
 * §3.4: Complements TaskSituation (task-level) with system-level observability.
 * Exists primarily in observability/system-situation-model.ts; this file provides
 * the canonical re-export for agent-loop consumers.
 *
 * R2 §L.5: SystemSituation fields must not leak into Observe output blacklisted fields.
 */
export { SystemSituationSchema, type SystemSituation, parseSystemSituation } from "../../../shared/observability/system-situation-model.js";
