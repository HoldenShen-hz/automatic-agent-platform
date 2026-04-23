import type { DatabaseSync } from "node:sqlite";
import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord } from "./distributed-lock-types.js";
export declare class SqliteLockAdapter implements DistributedLockAdapter {
    private readonly db;
    readonly backendKind: LockBackendKind;
    private fencingCounter;
    constructor(db: DatabaseSync);
    acquire(input: AcquireLockInput): AcquireLockResult;
    release(lockKey: string, owner: string): boolean;
    extend(lockKey: string, owner: string, additionalMs: number): LockRecord | null;
    forceSteal(lockKey: string, newOwner: string, reason: string): LockRecord;
    inspect(lockKey: string): LockRecord | null;
}
