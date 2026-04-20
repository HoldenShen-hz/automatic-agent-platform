/**
 * HA Coordinator Factory
 *
 * Creates the appropriate HA Coordinator Service based on the storage backend type.
 * - SQLite backend: uses SqliteHaRepository (sync operations via adapter)
 * - PostgreSQL backend: uses PostgresHaRepository (async operations with advisory locks)
 *
 * This factory enables the storage backend factory to provide a fully configured
 * HA coordinator without coupling to specific implementations.
 */

import type { HaRepository } from "./ha-repository.js";
import type { AnyStorageBackendHandle } from "./ha-repository.js";
import { createHaRepository } from "./ha-repository.js";
import { newId } from "../../contracts/types/ids.js";
import type { HaCoordinatorServiceAsyncOptions } from "./ha-coordinator-service-async.js";
import { HaCoordinatorServiceAsync } from "./ha-coordinator-service-async.js";

/**
 * Creates a `HaCoordinatorServiceAsync` backed by the appropriate repository
 * for the given storage backend.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @param options - Optional HA coordinator configuration
 * @returns A configured `HaCoordinatorServiceAsync` instance
 */
export function createHaCoordinatorService(
  backend: AnyStorageBackendHandle,
  options?: HaCoordinatorServiceAsyncOptions,
): HaCoordinatorServiceAsync {
  const coordinatorId = options?.coordinatorId ?? (backend.driver === "postgres" ? newId("coord") : undefined);
  const resolvedOptions = coordinatorId == null
    ? options
    : {
      ...(options ?? {}),
      coordinatorId,
    };
  const repo = createHaRepository(backend, coordinatorId);
  return new HaCoordinatorServiceAsync(repo, resolvedOptions);
}

/**
 * Creates a `HaRepository` directly for cases where only the repository is needed
 * without the full coordinator service.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @param coordinatorId - Optional coordinator ID for PostgreSQL advisory locks
 * @returns A `HaRepository` implementation for the given backend
 */
export function createHaRepositoryForBackend(
  backend: AnyStorageBackendHandle,
  coordinatorId?: string,
): HaRepository {
  return createHaRepository(backend, coordinatorId);
}
