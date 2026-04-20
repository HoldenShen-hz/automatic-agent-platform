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

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AsyncSqlDatabase } from "../../state-evidence/truth/async-sql-database.js";
import type {
  SqliteAuthoritativeStorageBackendHandle,
  PostgresAuthoritativeStorageBackendHandle,
} from "../../state-evidence/truth/storage-backend-factory.js";
import { requireSyncCompatibleAuthoritativeSqlDatabase } from "../../state-evidence/truth/storage-backend-factory.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

// HA Services
import { createHaCoordinatorService } from "../ha/ha-coordinator-factory.js";
import type { HaCoordinatorServiceAsync } from "../ha/ha-coordinator-service-async.js";

// Lease Services
import { createExecutionLeaseService } from "../lease/execution-lease-factory.js";
import type { ExecutionLeaseServiceAsync } from "../lease/execution-lease-service-async.js";

// Hot Upgrade Services
import { createHotUpgradeService } from "../hot-upgrade/hot-upgrade-factory.js";
import type { HotUpgradeServiceAsync } from "../hot-upgrade/hot-upgrade-service-async.js";

// Dispatch Services
import { ExecutionDispatchServiceAsync } from "../dispatcher/execution-dispatch-service-async.js";

// Handshake Services
import { ExecutionWorkerHandshakeServiceAsync } from "../worker-pool/execution-worker-handshake-service-async.js";

// Writeback Services
import { ExecutionWorkerWritebackServiceAsync } from "../worker-pool/execution-worker-writeback-service-async.js";

// Preemption Services
import { ExecutionPriorityPreemptionServiceAsync } from "../dispatcher/execution-priority-preemption-service-async.js";

// Re-export for convenience
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
export function createRuntimeServices(backend: AnyStorageBackendHandle): RuntimeServices {
  const db = requireSyncCompatibleAuthoritativeSqlDatabase(
    backend,
    "storage.postgres_shadow_sqlite_required_for_runtime_services",
  ) as AuthoritativeSqlDatabase;
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
  createDispatchService: (backend: AnyStorageBackendHandle) => {
    const db = requireSyncCompatibleAuthoritativeSqlDatabase(
      backend,
      "storage.postgres_shadow_sqlite_required_for_dispatch_service",
    ) as AuthoritativeSqlDatabase;
    const store = new AuthoritativeTaskStore(db);
    return new ExecutionDispatchServiceAsync(db, store);
  },

  /**
   * Creates a Worker Handshake Service for the given backend.
   */
  createHandshakeService: (backend: AnyStorageBackendHandle) => {
    const db = requireSyncCompatibleAuthoritativeSqlDatabase(
      backend,
      "storage.postgres_shadow_sqlite_required_for_handshake_service",
    ) as AuthoritativeSqlDatabase;
    const store = new AuthoritativeTaskStore(db);
    return new ExecutionWorkerHandshakeServiceAsync(db, store);
  },

  /**
   * Creates a Worker Writeback Service for the given backend.
   */
  createWritebackService: (backend: AnyStorageBackendHandle) => {
    const db = requireSyncCompatibleAuthoritativeSqlDatabase(
      backend,
      "storage.postgres_shadow_sqlite_required_for_writeback_service",
    ) as AuthoritativeSqlDatabase;
    const store = new AuthoritativeTaskStore(db);
    return new ExecutionWorkerWritebackServiceAsync(db, store);
  },

  /**
   * Creates a Priority Preemption Service for the given backend.
   */
  createPreemptionService: (backend: AnyStorageBackendHandle) => {
    const db = requireSyncCompatibleAuthoritativeSqlDatabase(
      backend,
      "storage.postgres_shadow_sqlite_required_for_preemption_service",
    ) as AuthoritativeSqlDatabase;
    const store = new AuthoritativeTaskStore(db);
    return new ExecutionPriorityPreemptionServiceAsync(db, store);
  },
} as const;
