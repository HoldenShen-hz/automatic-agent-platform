/**
 * @fileoverview Audit Integrity Repository
 *
 * Stores Tier 1 audit event integrity records (hash chain) and provides
 * verification queries. Integrates with the events table to detect
 * tampering in the audit trail.
 *
 * §50 Compliance Audit - Audit Log Tampering Protection
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
export const AUDIT_INTEGRITY_DDL = `
CREATE TABLE IF NOT EXISTS audit_integrity_records (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  chain_position INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_created_at TEXT NOT NULL,
  event_checksum TEXT NOT NULL,
  previous_chain_hash TEXT NULL,
  chain_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  verified_at TEXT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_integrity_event_id ON audit_integrity_records(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_integrity_chain_position ON audit_integrity_records(chain_position);
CREATE INDEX IF NOT EXISTS idx_audit_integrity_recorded_at ON audit_integrity_records(recorded_at);
`;
export function createAuditIntegrityRepository(db) {
    return new AuditIntegrityRepositoryImpl(db);
}
class AuditIntegrityRepositoryImpl {
    db;
    constructor(db) {
        this.db = db;
    }
    insertIntegrityRecord(eventId, chainPosition, eventType, eventCreatedAt, eventChecksum, previousChainHash, chainHash) {
        const now = nowIso();
        this.db.connection
            .prepare(`INSERT INTO audit_integrity_records (id, event_id, chain_position, event_type, event_created_at, event_checksum, previous_chain_hash, chain_hash, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(newId("aint"), eventId, chainPosition, eventType, eventCreatedAt, eventChecksum, previousChainHash, chainHash, now);
    }
    getIntegrityRecord(eventId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM audit_integrity_records WHERE event_id = ?`)
            .get(eventId);
        return row ? this.mapRow(row) : null;
    }
    getLatestChainHash() {
        const row = this.db.connection
            .prepare(`SELECT chain_hash FROM audit_integrity_records ORDER BY chain_position DESC LIMIT 1`)
            .get();
        return row ? String(row.chain_hash) : null;
    }
    getChainHashForEvent(eventId) {
        const row = this.db.connection
            .prepare(`SELECT chain_hash FROM audit_integrity_records WHERE event_id = ?`)
            .get(eventId);
        return row ? String(row.chain_hash) : null;
    }
    getIntegrityRecordsInRange(windowStart, windowEnd) {
        return this.db.connection
            .prepare(`SELECT air.* FROM audit_integrity_records air
         JOIN events e ON e.id = air.event_id
         WHERE e.created_at >= ? AND e.created_at <= ?
         ORDER BY air.chain_position ASC`)
            .all(windowStart, windowEnd).map((r) => this.mapRow(r));
    }
    mapRow(row) {
        return {
            eventId: String(row.event_id),
            chainPosition: Number(row.chain_position),
            eventType: String(row.event_type),
            eventCreatedAt: String(row.event_created_at),
            eventChecksum: String(row.event_checksum),
            previousChainHash: row.previous_chain_hash != null ? String(row.previous_chain_hash) : null,
            chainHash: String(row.chain_hash),
            recordedAt: String(row.recorded_at),
        };
    }
}
//# sourceMappingURL=audit-integrity-repository.js.map