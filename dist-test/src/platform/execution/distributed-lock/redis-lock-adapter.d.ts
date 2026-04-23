import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord, RedisLockConfig } from "./distributed-lock-types.js";
export declare class RedisLockAdapter implements DistributedLockAdapter {
    readonly backendKind: LockBackendKind;
    private readonly redis;
    private fencingCounter;
    private readonly cliPath;
    private readonly connectTimeoutMs;
    private readonly host;
    private readonly port;
    constructor(config?: RedisLockConfig & {
        cliPath?: string;
        connectTimeoutMs?: number;
    });
    private ensureConnected;
    acquire(input: AcquireLockInput): AcquireLockResult;
    release(_lockKey: string, _owner: string): boolean;
    extend(_lockKey: string, _owner: string, _additionalMs: number): LockRecord | null;
    forceSteal(_lockKey: string, _newOwner: string, _reason: string): LockRecord;
    inspect(_lockKey: string): LockRecord | null;
    acquireAsync(input: AcquireLockInput): Promise<AcquireLockResult>;
    releaseAsync(lockKey: string, owner: string): Promise<boolean>;
    extendAsync(lockKey: string, owner: string, additionalMs: number): Promise<LockRecord | null>;
    forceStealAsync(lockKey: string, newOwner: string, reason: string): Promise<LockRecord>;
    inspectAsync(lockKey: string): Promise<LockRecord | null>;
    listHeldAsync(limit?: number): Promise<LockRecord[]>;
    close(): Promise<void>;
}
