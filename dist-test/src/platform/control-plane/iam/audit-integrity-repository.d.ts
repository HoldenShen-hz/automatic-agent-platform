/**
 * @fileoverview Audit Integrity Repository
 *
 * Stores Tier 1 audit event integrity records (hash chain) and provides
 * verification queries. Integrates with the events table to detect
 * tampering in the audit trail.
 *
 * §50 Compliance Audit - Audit Log Tampering Protection
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type Tier1AuditIntegrityRecord } from "./audit-event-integrity.js";
export declare const AUDIT_INTEGRITY_DDL = "\nCREATE TABLE IF NOT EXISTS audit_integrity_records (\n  id TEXT PRIMARY KEY,\n  event_id TEXT NOT NULL UNIQUE,\n  chain_position INTEGER NOT NULL,\n  event_type TEXT NOT NULL,\n  event_created_at TEXT NOT NULL,\n  event_checksum TEXT NOT NULL,\n  previous_chain_hash TEXT NULL,\n  chain_hash TEXT NOT NULL,\n  recorded_at TEXT NOT NULL,\n  verified_at TEXT NULL\n);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_audit_integrity_event_id ON audit_integrity_records(event_id);\nCREATE INDEX IF NOT EXISTS idx_audit_integrity_chain_position ON audit_integrity_records(chain_position);\nCREATE INDEX IF NOT EXISTS idx_audit_integrity_recorded_at ON audit_integrity_records(recorded_at);\n";
export interface AuditIntegrityRepository {
    insertIntegrityRecord(eventId: string, chainPosition: number, eventType: string, eventCreatedAt: string, eventChecksum: string, previousChainHash: string | null, chainHash: string): void;
    getIntegrityRecord(eventId: string): Tier1AuditIntegrityRecord | null;
    getLatestChainHash(): string | null;
    getChainHashForEvent(eventId: string): string | null;
    getIntegrityRecordsInRange(windowStart: string, windowEnd: string): Tier1AuditIntegrityRecord[];
}
export declare function createAuditIntegrityRepository(db: AuthoritativeSqlDatabase): AuditIntegrityRepository;
