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
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../state-evidence/truth/storage-backend-factory.js";
import { createHaCoordinatorService } from "../ha/ha-coordinator-factory.js";
import type { HaCoordinatorServiceAsync } from "../ha/ha-coordinator-service-async.js";
import { createExecutionLeaseService } from "../lease/execution-lease-factory.js";
import type { ExecutionLeaseServiceAsync } from "../lease/execution-lease-service-async.js";
import { createHotUpgradeService } from "../hot-upgrade/hot-upgrade-factory.js";
import type { HotUpgradeServiceAsync } from "../hot-upgrade/hot-upgrade-service-async.js";
import { ExecutionDispatchServiceAsync } from "../dispatcher/execution-dispatch-service-async.js";
import { ExecutionWorkerHandshakeServiceAsync } from "../worker-pool/execution-worker-handshake-service-async.js";
import { ExecutionWorkerWritebackServiceAsync } from "../worker-pool/execution-worker-writeback-service-async.js";
import { ExecutionPriorityPreemptionServiceAsync } from "../dispatcher/execution-priority-preemption-service-async.js";
export type { HaCoordinatorServiceAsync } from "../ha/ha-coordinator-service-async.js";
export type { ExecutionLeaseServiceAsync } from "../lease/execution-lease-service-async.js";
export type { HotUpgradeServiceAsync } from "../hot-upgrade/hot-upgrade-service-async.js";
export { ExecutionDispatchServiceAsync } from "../dispatcher/execution-dispatch-service-async.js";
export { ExecutionWorkerHandshakeServiceAsync } from "../worker-pool/execution-worker-handshake-service-async.js";
export { ExecutionWorkerWritebackServiceAsync } from "../worker-pool/execution-worker-writeback-service-async.js";
export { ExecutionPriorityPreemptionServiceAsync } from "../dispatcher/execution-priority-preemption-service-async.js";
export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;
/**
 * Container for all runtime services created by the factory.
 *
 * Provides a single place to get all runtime services, all properly
 * configured for the given storage backend.
 */
export interface RuntimeServices {
    /** HA Coordinator Service - handles leader election and coordinator state */
    ha: HaCoordinatorServiceAsync;
    /** Execution Lease Service - manages execution leases and fencing tokens */
    leases: ExecutionLeaseServiceAsync;
    /** Hot Upgrade Service - handles zero-downtime upgrades */
    hotUpgrade: HotUpgradeServiceAsync;
    /** Execution Dispatch Service - manages dispatch of work to workers */
    dispatch: ExecutionDispatchServiceAsync;
    /** Worker Handshake Service - handles worker lease handshake */
    handshake: ExecutionWorkerHandshakeServiceAsync;
    /** Worker Writeback Service - handles result reporting from workers */
    writeback: ExecutionWorkerWritebackServiceAsync;
    /** Priority Preemption Service - preempts lower-priority executions */
    preemption: ExecutionPriorityPreemptionServiceAsync;
}
/**
 * Creates all runtime services for the given storage backend.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A RuntimeServices container with all services
 */
export declare function createRuntimeServices(backend: AnyStorageBackendHandle): RuntimeServices;
/**
 * Creates individual runtime services when only specific services are needed.
 */
export declare const runtimeFactories: {
    /**
     * Creates an HA Coordinator Service for the given backend.
     */
    readonly createHaCoordinatorService: typeof createHaCoordinatorService;
    /**
     * Creates an Execution Lease Service for the given backend.
     */
    readonly createExecutionLeaseService: typeof createExecutionLeaseService;
    /**
     * Creates a Hot Upgrade Service for the given backend.
     */
    readonly createHotUpgradeService: typeof createHotUpgradeService;
    /**
     * Creates an Execution Dispatch Service for the given backend.
     */
    readonly createDispatchService: (backend: AnyStorageBackendHandle) => ExecutionDispatchServiceAsync;
    /**
     * Creates a Worker Handshake Service for the given backend.
     */
    readonly createHandshakeService: (backend: AnyStorageBackendHandle) => ExecutionWorkerHandshakeServiceAsync;
    /**
     * Creates a Worker Writeback Service for the given backend.
     */
    readonly createWritebackService: (backend: AnyStorageBackendHandle) => ExecutionWorkerWritebackServiceAsync;
    /**
     * Creates a Priority Preemption Service for the given backend.
     */
    readonly createPreemptionService: (backend: AnyStorageBackendHandle) => ExecutionPriorityPreemptionServiceAsync;
};
