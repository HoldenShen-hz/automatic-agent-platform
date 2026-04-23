/**
 * Runtime Service Factory
 *
 * Centralized factory for creating runtime services with proper backend selection.
 * Provides async versions of all runtime services that can work with both
 * SQLite (sync) and PostgreSQL (async) backends.
 *
 * Usage:
 *   import { createRuntimeServices } from "./runtime-factory.js";
 *   const services = createRuntimeServices(backend);
 *   await services.dispatch.dispatchNext(options);
 */
import { requireSyncCompatibleAuthoritativeSqlDatabase } from "../../state-evidence/truth/storage-backend-factory.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
// HA Services
import { createHaCoordinatorService } from "../ha/ha-coordinator-factory.js";
// Lease Services
import { createExecutionLeaseService } from "../lease/execution-lease-factory.js";
// Hot Upgrade Services
import { createHotUpgradeService } from "../hot-upgrade/hot-upgrade-factory.js";
// Dispatch Services
import { ExecutionDispatchServiceAsync } from "../dispatcher/execution-dispatch-service-async.js";
// Handshake Services
import { ExecutionWorkerHandshakeServiceAsync } from "../worker-pool/execution-worker-handshake-service-async.js";
// Writeback Services
import { ExecutionWorkerWritebackServiceAsync } from "../worker-pool/execution-worker-writeback-service-async.js";
// Preemption Services
import { ExecutionPriorityPreemptionServiceAsync } from "../dispatcher/execution-priority-preemption-service-async.js";
export { ExecutionDispatchServiceAsync } from "../dispatcher/execution-dispatch-service-async.js";
export { ExecutionWorkerHandshakeServiceAsync } from "../worker-pool/execution-worker-handshake-service-async.js";
export { ExecutionWorkerWritebackServiceAsync } from "../worker-pool/execution-worker-writeback-service-async.js";
export { ExecutionPriorityPreemptionServiceAsync } from "../dispatcher/execution-priority-preemption-service-async.js";
/**
 * Creates all runtime services for the given storage backend.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A RuntimeServices container with all services
 */
export function createRuntimeServices(backend) {
    const db = requireSyncCompatibleAuthoritativeSqlDatabase(backend, "storage.postgres_shadow_sqlite_required_for_runtime_services");
    const store = new AuthoritativeTaskStore(db);
    return {
        ha: createHaCoordinatorService(backend),
        leases: createExecutionLeaseService(backend),
        hotUpgrade: createHotUpgradeService(backend),
        dispatch: new ExecutionDispatchServiceAsync(db, store),
        handshake: new ExecutionWorkerHandshakeServiceAsync(db, store),
        writeback: new ExecutionWorkerWritebackServiceAsync(db, store),
        preemption: new ExecutionPriorityPreemptionServiceAsync(db, store),
    };
}
/**
 * Creates individual runtime services when only specific services are needed.
 */
export const runtimeFactories = {
    /**
     * Creates an HA Coordinator Service for the given backend.
     */
    createHaCoordinatorService,
    /**
     * Creates an Execution Lease Service for the given backend.
     */
    createExecutionLeaseService,
    /**
     * Creates a Hot Upgrade Service for the given backend.
     */
    createHotUpgradeService,
    /**
     * Creates an Execution Dispatch Service for the given backend.
     */
    createDispatchService: (backend) => {
        const db = requireSyncCompatibleAuthoritativeSqlDatabase(backend, "storage.postgres_shadow_sqlite_required_for_dispatch_service");
        const store = new AuthoritativeTaskStore(db);
        return new ExecutionDispatchServiceAsync(db, store);
    },
    /**
     * Creates a Worker Handshake Service for the given backend.
     */
    createHandshakeService: (backend) => {
        const db = requireSyncCompatibleAuthoritativeSqlDatabase(backend, "storage.postgres_shadow_sqlite_required_for_handshake_service");
        const store = new AuthoritativeTaskStore(db);
        return new ExecutionWorkerHandshakeServiceAsync(db, store);
    },
    /**
     * Creates a Worker Writeback Service for the given backend.
     */
    createWritebackService: (backend) => {
        const db = requireSyncCompatibleAuthoritativeSqlDatabase(backend, "storage.postgres_shadow_sqlite_required_for_writeback_service");
        const store = new AuthoritativeTaskStore(db);
        return new ExecutionWorkerWritebackServiceAsync(db, store);
    },
    /**
     * Creates a Priority Preemption Service for the given backend.
     */
    createPreemptionService: (backend) => {
        const db = requireSyncCompatibleAuthoritativeSqlDatabase(backend, "storage.postgres_shadow_sqlite_required_for_preemption_service");
        const store = new AuthoritativeTaskStore(db);
        return new ExecutionPriorityPreemptionServiceAsync(db, store);
    },
};
//# sourceMappingURL=runtime-factory.js.map