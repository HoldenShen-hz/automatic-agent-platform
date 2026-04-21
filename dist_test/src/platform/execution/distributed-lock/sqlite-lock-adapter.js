import { LockingError } from "../../contracts/errors.js";
import { lockLogger } from "./locking-support.js";
export class SqliteLockAdapter {
    db;
    backendKind = "sqlite";
    fencingCounter = 0;
    constructor(db) {
        this.db = db;
        const stmt = this.db.prepare(`SELECT MAX(fencing_token) as max_token FROM distributed_locks`);
        const row = stmt.get();
        if (row?.max_token != null)
            this.fencingCounter = row.max_token;
    }
    acquire(input) {
        const { lockKey, owner, ttlMs = 30000 } = input;
        const existing = this.db.prepare(`SELECT * FROM distributed_locks WHERE lock_key = ?`).get(lockKey);
        if (existing) {
            if (existing.owner === owner && existing.status === "held") {
                this.db.prepare(`UPDATE distributed_locks SET ttl_ms = ?, acquired_at = ? WHERE lock_key = ? AND owner = ?`).run(ttlMs, new Date().toISOString(), lockKey, owner);
                const fencingToken = existing.fencing_token || Date.now();
                return { acquired: true, lock: { lockKey, owner, fencingToken, status: "held", acquiredAt: new Date().toISOString(), ttlMs, metadata: null } };
            }
            // RT-03: honour TTL on stale locks. Previously any existing row blocked
            // acquisition forever, so a crashed owner would hold the lock until
            // someone ran forceSteal manually. We now compute the expiry from
            // acquired_at + ttl_ms and, if elapsed, evict the stale row and take
            // over with a freshly incremented fencing token.
            const existingAcquiredMs = Date.parse(existing.acquired_at);
            const expiresAt = Number.isFinite(existingAcquiredMs)
                ? existingAcquiredMs + (existing.ttl_ms ?? 0)
                : Number.POSITIVE_INFINITY;
            if (Date.now() < expiresAt) {
                return { acquired: false };
            }
            this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ?`).run(lockKey);
            lockLogger.log({
                level: "info",
                message: "sqlite_lock.evicted_expired",
                data: { lockKey, previousOwner: existing.owner, expiresAt },
            });
        }
        this.fencingCounter += 1;
        const fencingToken = this.fencingCounter;
        const acquiredAt = new Date().toISOString();
        try {
            this.db.prepare(`INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms) VALUES (?, ?, ?, 'held', ?, ?)`)
                .run(lockKey, owner, fencingToken, acquiredAt, ttlMs);
            return { acquired: true, lock: { lockKey, owner, fencingToken, status: "held", acquiredAt, ttlMs, metadata: null } };
        }
        catch (err) {
            lockLogger.log({ level: "warn", message: "Lock acquire operation failed", data: { lockKey, owner, error: err instanceof Error ? err.message : String(err) } });
            return { acquired: false };
        }
    }
    release(lockKey, owner) {
        try {
            const result = this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ? AND owner = ?`).run(lockKey, owner);
            return result.changes > 0;
        }
        catch (err) {
            lockLogger.log({ level: "warn", message: "Lock release operation failed", data: { lockKey, owner, error: err instanceof Error ? err.message : String(err) } });
            return false;
        }
    }
    extend(lockKey, owner, additionalMs) {
        try {
            // Increment fencing token to prevent late-renewal problem
            this.fencingCounter += 1;
            const newFencingToken = this.fencingCounter;
            const result = this.db.prepare(`UPDATE distributed_locks SET ttl_ms = ttl_ms + ?, fencing_token = ? WHERE lock_key = ? AND owner = ?`).run(additionalMs, newFencingToken, lockKey, owner);
            if (result.changes === 0)
                return null;
            return this.inspect(lockKey);
        }
        catch (err) {
            lockLogger.log({ level: "warn", message: "Lock extend operation failed", data: { lockKey, owner, additionalMs, error: err instanceof Error ? err.message : String(err) } });
            return null;
        }
    }
    forceSteal(lockKey, newOwner, reason) {
        try {
            this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ?`).run(lockKey);
            this.fencingCounter += 1;
            const fencingToken = this.fencingCounter;
            const now = new Date().toISOString();
            const ttlMs = 30000;
            const metadata = JSON.stringify({ forceStealReason: reason });
            this.db.prepare(`INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms, metadata) VALUES (?, ?, ?, 'held', ?, ?, ?)`)
                .run(lockKey, newOwner, fencingToken, now, ttlMs, metadata);
            return { lockKey, owner: newOwner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata };
        }
        catch (err) {
            lockLogger.log({ level: "warn", message: "Lock forceSteal failed", data: { lockKey, newOwner, error: err instanceof Error ? err.message : String(err) } });
            throw new LockingError("lock.force_steal_failed", "Lock force steal operation failed", { details: { lockKey, newOwner } });
        }
    }
    inspect(lockKey) {
        try {
            const row = this.db.prepare(`SELECT * FROM distributed_locks WHERE lock_key = ?`).get(lockKey);
            return row
                ? { lockKey: row.lock_key, owner: row.owner, fencingToken: row.fencing_token, status: row.status, acquiredAt: row.acquired_at, ttlMs: row.ttl_ms || 0, metadata: row.metadata }
                : null;
        }
        catch (err) {
            lockLogger.log({ level: "warn", message: "Lock inspect operation failed", data: { lockKey, error: err instanceof Error ? err.message : String(err) } });
            return null;
        }
    }
}
//# sourceMappingURL=sqlite-lock-adapter.js.map