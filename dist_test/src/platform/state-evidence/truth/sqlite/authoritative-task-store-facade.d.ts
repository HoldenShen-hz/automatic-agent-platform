import type { AuthoritativeSqlDatabase } from "./sqlite-database.js";
import { AuthoritativeTaskStore } from "./authoritative-task-store-core.js";
/**
 * Backward-compatible facade alias. Repository composition now lives in the
 * core store so both entry points expose the same cached repository set.
 */
export declare class AuthoritativeTaskStoreFacade extends AuthoritativeTaskStore {
    constructor(db: AuthoritativeSqlDatabase);
}
