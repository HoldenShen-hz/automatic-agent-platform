/**
 * Execution Lease Service Factory
 *
 * Creates the appropriate ExecutionLeaseService based on the storage backend type.
 */
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../state-evidence/truth/storage-backend-factory.js";
import { ExecutionLeaseServiceAsync } from "./execution-lease-service-async.js";
export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;
/**
 * Creates an ExecutionLeaseServiceAsync backed by the appropriate repository
 * for the given storage backend.
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A configured `ExecutionLeaseServiceAsync` instance
 */
export declare function createExecutionLeaseService(backend: AnyStorageBackendHandle): ExecutionLeaseServiceAsync;
