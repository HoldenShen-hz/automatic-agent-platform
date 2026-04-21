import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { QueueAdapter, QueueBackendConfig } from "./queue-adapter-types.js";
export declare function createQueueAdapter(config: QueueBackendConfig, db?: AuthoritativeSqlDatabase): QueueAdapter;
