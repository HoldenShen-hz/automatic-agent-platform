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

import { createHash, createHmac } from "node:crypto";

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
 * Configuration for audit event integrity service.
 */
export interface AuditEventIntegrityOptions {
  /**
   * HMAC signing key for tamper-evident chain.
   * §11.5 requires tamper-evident audit - without a signing key,
   * an attacker with DB write access could recompute the entire chain.
   * If not provided, falls back to plain SHA-256 (less secure).
   */
  signingKey?: string;
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
type Tier1AuditEventShape = Pick<
  EventRecord,
  "id" | "taskId" | "sessionId" | "executionId" | "eventType" | "eventTier" | "payloadJson" | "traceId" | "createdAt"
>;

/**
 * Internal SHA-256 hashing utility.
 * Uses Node.js crypto module for fast, reliable hashing.
 *
 * @param value - String to hash
 * @returns Hex-encoded hash string
 */
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Internal HMAC-SHA-256 hashing utility for tamper-evident signing.
 * §11.5: Uses HMAC with a signing key so attackers with DB write access
 * cannot recompute the chain after modifying events.
 *
 * @param value - String to hash
 * @param key - HMAC signing key
 * @returns Hex-encoded HMAC hash string
 */
function hmacSha256(value: string, key: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

/**
 * Computes a checksum for a Tier 1 audit event.
 * Uses HMAC-SHA-256 if a signing key is configured, otherwise plain SHA-256.
 * The checksum covers all fields that must remain immutable for integrity.
 * Changes to any of these fields would indicate tampering.
 *
 * @param event - The event to compute checksum for
 * @param signingKey - Optional HMAC signing key for tamper-evident audit
 * @returns Hex-encoded checksum string
 */
export function computeTier1AuditEventChecksum(
  event: Tier1AuditEventShape,
  signingKey?: string,
): string {
  const data = JSON.stringify({
    id: event.id,
    taskId: event.taskId,
    sessionId: event.sessionId,
    executionId: event.executionId,
    eventType: event.eventType,
    eventTier: event.eventTier,
    payloadJson: event.payloadJson,
    traceId: event.traceId,
    createdAt: event.createdAt,
  });
  return signingKey != null ? hmacSha256(data, signingKey) : sha256(data);
}

/**
 * Computes the chain hash that links this event to the previous one.
 * This creates the tamper-evident chain property - changing any event
 * breaks all subsequent chain hashes.
 * Uses HMAC-SHA-256 if a signing key is configured.
 *
 * @param input - Components needed for chain hash computation
 * @param signingKey - Optional HMAC signing key for tamper-evident audit
 * @returns Hex-encoded chain hash
 */
export function computeTier1AuditChainHash(
  input: {
    chainPosition: number;
    previousChainHash: string | null;
    eventChecksum: string;
    eventId: string;
  },
  signingKey?: string,
): string {
  const data = JSON.stringify({
    chainPosition: input.chainPosition,
    previousChainHash: input.previousChainHash,
    eventChecksum: input.eventChecksum,
    eventId: input.eventId,
  });
  return signingKey != null ? hmacSha256(data, signingKey) : sha256(data);
}

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
 * @param signingKey - HMAC signing key for tamper-evident verification (required for HMAC-protected events)
 * @returns Verification report with findings and statistics
 */
export function verifyTier1AuditIntegrity(
  entries: ReadonlyArray<Tier1AuditIntegrityVerificationEntry>,
  signingKey?: string,
): Tier1AuditIntegrityReport {
  const compromisedEventIds = new Set<string>();
  const missingEventIds = new Set<string>();
  const findings = new Set<string>();
  let verifiedEvents = 0;
  let chainBreaks = 0;
  let previousChainHash: string | null = null;

  // Process entries in chain position order
  for (const entry of [...entries].sort((left, right) => left.integrityRecord.chainPosition - right.integrityRecord.chainPosition)) {
    const integrityRecord = entry.integrityRecord;
    let compromised = false;

    // Check 1: Chain hash continuity
    if (integrityRecord.previousChainHash !== previousChainHash) {
      compromised = true;
      chainBreaks += 1;
      findings.add(`audit_chain_prev_hash_mismatch:${integrityRecord.eventId}`);
    }

    // Check 2: Event existence
    if (entry.event == null) {
      compromised = true;
      missingEventIds.add(integrityRecord.eventId);
      findings.add(`audit_event_missing:${integrityRecord.eventId}`);
    } else {
      // Check 3: Event tier is correct for Tier 1 integrity
      if (entry.event.eventTier !== "tier_1") {
        compromised = true;
        findings.add(`audit_event_tier_mismatch:${integrityRecord.eventId}`);
      }

      // Check 4: Event checksum matches stored value
      // R12-16: Use HMAC-SHA-256 with signing key for tamper-evident verification
      const eventChecksum = computeTier1AuditEventChecksum(entry.event, signingKey);
      if (eventChecksum !== integrityRecord.eventChecksum) {
        compromised = true;
        findings.add(`audit_event_checksum_mismatch:${integrityRecord.eventId}`);
      }
    }

    // Check 5: Chain hash can be recomputed correctly
    // R12-16: Use HMAC-SHA-256 with signing key for tamper-evident chain verification
    const expectedChainHash = computeTier1AuditChainHash({
      chainPosition: integrityRecord.chainPosition,
      previousChainHash: integrityRecord.previousChainHash,
      eventChecksum: integrityRecord.eventChecksum,
      eventId: integrityRecord.eventId,
    }, signingKey);

    if (expectedChainHash !== integrityRecord.chainHash) {
      compromised = true;
      chainBreaks += 1;
      findings.add(`audit_chain_hash_mismatch:${integrityRecord.eventId}`);
    }

    if (compromised) {
      compromisedEventIds.add(integrityRecord.eventId);
    } else {
      verifiedEvents += 1;
    }

    previousChainHash = integrityRecord.chainHash;
  }

  return {
    checked: true,
    totalTrackedEvents: entries.length,
    verifiedEvents,
    compromisedEvents: compromisedEventIds.size,
    missingEvents: missingEventIds.size,
    chainBreaks,
    latestChainHash: entries.at(-1)?.integrityRecord.chainHash ?? null,
    compromisedEventIds: Array.from(compromisedEventIds).sort(),
    missingEventIds: Array.from(missingEventIds).sort(),
    findings: Array.from(findings).sort(),
  };
}
