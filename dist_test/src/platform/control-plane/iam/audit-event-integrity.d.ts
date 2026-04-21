/**
 * Audit Event Integrity Service
 *
 * Provides cryptographic integrity verification for Tier 1 audit events.
 * Tier 1 events are high-value audit records that must be preserved unaltered.
 *
 * ## Purpose
 *
 * This service detects tampering with audit event records by computing and
 * verifying checksums for each event and maintaining a hash chain similar to
 * blockchain technology. Any modification, deletion, or reordering of events
 * will break the chain and be detected during verification.
 *
 * ## How It Works
 *
 * 1. Each event has a SHA-256 checksum computed over its core fields
 * 2. Events are linked via a chain hash computed from: previous chain hash + event checksum + position
 * 3. Verification recomputes all hashes and compares against stored values
 * 4. Any mismatch indicates tampering
 *
 * ## Usage
 *
 * Use this when you need to prove audit records have not been altered:
 * - Compliance requirements
 * - Legal evidence preservation
 * - Security incident investigation
 * - External audit handed-off records
 *
 * @see Tier 1 audit contract: docs_zh/contracts/audit_event_integrity_contract.md
 */
import type { EventRecord } from "../../contracts/types/domain.js";
/**
 * Integrity record stored alongside each Tier 1 audit event.
 * Contains checksums for the event and chain linking information.
 */
export interface Tier1AuditIntegrityRecord {
    /** Event this record belongs to */
    eventId: string;
    /** Position in the event chain (1-indexed) */
    chainPosition: number;
    /** Type of the audited event */
    eventType: string;
    /** When the event was created */
    eventCreatedAt: string;
    /** SHA-256 checksum of the event's core fields */
    eventChecksum: string;
    /** Hash of the previous record in the chain (null for first event) */
    previousChainHash: string | null;
    /** Hash linking this event to the previous chain */
    chainHash: string;
    /** When this integrity record was computed */
    recordedAt: string;
}
/**
 * Entry for verification - pairs an integrity record with its corresponding event.
 */
export interface Tier1AuditIntegrityVerificationEntry {
    /** The integrity record to verify */
    integrityRecord: Tier1AuditIntegrityRecord;
    /** The actual event record (null if event is missing) */
    event: EventRecord | null;
}
/**
 * Report of integrity verification results.
 * Contains counts and lists of any compromised or missing events.
 */
export interface Tier1AuditIntegrityReport {
    /** Whether verification was performed */
    checked: boolean;
    /** Total number of events that were tracked */
    totalTrackedEvents: number;
    /** Number of events that passed verification */
    verifiedEvents: number;
    /** Number of events that failed verification (tampered) */
    compromisedEvents: number;
    /** Number of events that are missing from the expected sequence */
    missingEvents: number;
    /** Number of chain breaks detected (gap or hash mismatch) */
    chainBreaks: number;
    /** Hash of the last event in the chain (for continuation verification) */
    latestChainHash: string | null;
    /** IDs of all events that failed verification */
    compromisedEventIds: string[];
    /** IDs of events that were referenced but not found */
    missingEventIds: string[];
    /** Human-readable descriptions of each integrity failure */
    findings: string[];
}
/**
 * Subset of EventRecord fields used for checksum computation.
 * Only immutable fields that should not change after creation are included.
 */
type Tier1AuditEventShape = Pick<EventRecord, "id" | "taskId" | "sessionId" | "executionId" | "eventType" | "eventTier" | "payloadJson" | "traceId" | "createdAt">;
/**
 * Computes a SHA-256 checksum for a Tier 1 audit event.
 * The checksum covers all fields that must remain immutable for integrity.
 * Changes to any of these fields would indicate tampering.
 *
 * @param event - The event to compute checksum for
 * @returns Hex-encoded SHA-256 checksum string
 */
export declare function computeTier1AuditEventChecksum(event: Tier1AuditEventShape): string;
/**
 * Computes the chain hash that links this event to the previous one.
 * This creates the tamper-evident chain property - changing any event
 * breaks all subsequent chain hashes.
 *
 * @param input - Components needed for chain hash computation
 * @param input.chainPosition - Position in the chain (1-indexed)
 * @param input.previousChainHash - Hash of the previous event (null for first)
 * @param input.eventChecksum - Checksum of this event
 * @param input.eventId - ID of this event
 * @returns Hex-encoded chain hash
 */
export declare function computeTier1AuditChainHash(input: {
    chainPosition: number;
    previousChainHash: string | null;
    eventChecksum: string;
    eventId: string;
}): string;
/**
 * Verifies the integrity of a sequence of Tier 1 audit events.
 * This is the main verification function - call this to validate that
 * audit records have not been tampered with.
 *
 * Checks performed:
 * 1. Chain hash continuity - each event links to previous correctly
 * 2. Event existence - no events are missing from the sequence
 * 3. Event checksum - each event's content matches its stored checksum
 * 4. Event tier - confirms events are actually Tier 1
 *
 * @param entries - Array of integrity records with their corresponding events
 * @returns Verification report with findings and statistics
 */
export declare function verifyTier1AuditIntegrity(entries: ReadonlyArray<Tier1AuditIntegrityVerificationEntry>): Tier1AuditIntegrityReport;
export {};
