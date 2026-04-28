import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { ValidationError } from "../../contracts/errors.js";

import type { QueueAdapter, QueueBackendConfig } from "./queue-adapter-types.js";
import { RedisQueueAdapter } from "./redis-queue-adapter.js";
import { SqliteQueueAdapter } from "./sqlite-queue-adapter.js";

export function createQueueAdapter(config: QueueBackendConfig, db?: AuthoritativeSqlDatabase): QueueAdapter {
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
