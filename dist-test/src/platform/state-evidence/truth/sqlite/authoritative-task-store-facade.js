import { AuthoritativeTaskStore } from "./authoritative-task-store-core.js";
/**
 * Backward-compatible facade alias. Repository composition now lives in the
 * core store so both entry points expose the same cached repository set.
 */
export class AuthoritativeTaskStoreFacade extends AuthoritativeTaskStore {
    constructor(db) {
        super(db);
    }
}
//# sourceMappingURL=authoritative-task-store-facade.js.map