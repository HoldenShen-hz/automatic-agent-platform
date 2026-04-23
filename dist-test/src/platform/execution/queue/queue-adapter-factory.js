import { ValidationError } from "../../contracts/errors.js";
import { RedisQueueAdapter } from "./redis-queue-adapter.js";
import { SqliteQueueAdapter } from "./sqlite-queue-adapter.js";
export function createQueueAdapter(config, db) {
    if (config.kind === "redis") {
        if (!config.redis) {
            throw new ValidationError("queue.missing_redis_config: Redis queue backend selected but no redis config provided", "queue.missing_redis_config: Redis queue backend selected but no redis config provided", {
                retryable: false,
            });
        }
        return new RedisQueueAdapter(config.redis);
    }
    if (!db) {
        throw new ValidationError("queue.missing_sqlite_db: SQLite queue backend selected but no database provided", "queue.missing_sqlite_db: SQLite queue backend selected but no database provided", {
            retryable: false,
        });
    }
    return new SqliteQueueAdapter(db);
}
//# sourceMappingURL=queue-adapter-factory.js.map