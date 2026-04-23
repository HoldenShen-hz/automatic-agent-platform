/**
 * @fileoverview ID Generation and Timestamp Utilities
 *
 * Provides basic infrastructure utilities used throughout the system:
 * - ID generation with semantic prefixes for traceability
 * - ISO 8601 timestamp generation for event ordering
 *
 * ## ID Format
 *
 * IDs follow the pattern `{prefix}_{uuid}` where prefix indicates the entity type.
 * This allows quick identification of record types in logs and debugging.
 * Examples: `task_abc123`, `exec_def456`, `evt_789xyz`
 *
 * ## Timestamp Format
 *
 * All timestamps use ISO 8601 format (e.g., `2026-04-12T10:30:00.000Z`).
 * This ensures consistent ordering across distributed systems and timezone independence.
 */
import { randomUUID } from "node:crypto";
/**
 * Generates a unique identifier with a semantic prefix.
 *
 * The prefix indicates the entity type (task, execution, event, etc.) which helps
 * with log correlation and database querying. Each ID is a combination of the
 * prefix and a cryptographically random UUID.
 *
 * @param prefix - Semantic type indicator (e.g., "task", "exec", "sess")
 * @returns A unique ID string in format `{prefix}_{uuid}`
 */
export function newId(prefix) {
    return `${prefix}_${randomUUID()}`;
}
/**
 * Returns the current time as an ISO 8601 formatted timestamp string.
 *
 * Used throughout the system to record when events occurred, enabling
 * chronological ordering and event sourcing. ISO 8601 format ensures
 * universal compatibility and correct sorting across distributed nodes.
 *
 * @returns Current timestamp in ISO 8601 format (e.g., `2026-04-12T10:30:00.000Z`)
 */
export function nowIso() {
    return new Date(Date.now()).toISOString();
}
//# sourceMappingURL=ids.js.map