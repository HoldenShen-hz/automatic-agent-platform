import { LockingError } from "../../contracts/errors.js";
import { PgAdvisoryLockAdapter } from "./pg-advisory-lock-adapter.js";
import { RedisLockAdapter } from "./redis-lock-adapter.js";
import { SqliteLockAdapter } from "./sqlite-lock-adapter.js";
export function createLockAdapter(kind, db) {
    switch (kind) {
        case "sqlite":
            if (!db)
                throw new LockingError("lock.sqlite_adapter_requires_db", "lock.sqlite_adapter_requires_db: sqlite lock adapter requires a database");
            return new SqliteLockAdapter(db);
        case "pg_advisory":
            return new PgAdvisoryLockAdapter();
        case "redis":
            return new RedisLockAdapter();
        default:
            throw new LockingError("lock.backend_not_supported", `Lock backend not supported: ${kind}`);
    }
}
//# sourceMappingURL=distributed-lock-factory.js.map