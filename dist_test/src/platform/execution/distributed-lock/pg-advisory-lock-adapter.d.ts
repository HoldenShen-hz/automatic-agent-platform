import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord, PgAdvisoryLockConfig } from "./distributed-lock-types.js";
export declare class PgAdvisoryLockAdapter implements DistributedLockAdapter {
    readonly backendKind: LockBackendKind;
    private sql;
    private connected;
    private connectionError;
    private readonly dsn;
    private readonly poolMin;
    private readonly poolMax;
    private readonly idleTimeoutSeconds;
    private readonly connectTimeoutSeconds;
    private readonly ssl;
    private readonly postgresFactory;
    private fencingCounter;
    constructor(config?: PgAdvisoryLockConfig);
    private lockKeyToAdvisoryKey;
    private ensureConnected;
    acquire(_input: AcquireLockInput): AcquireLockResult;
    release(_lockKey: string, _owner: string): boolean;
    extend(lockKey: string, _owner: string, _additionalMs: number): LockRecord | null;
    forceSteal(_lockKey: string, _newOwner: string, _reason: string): LockRecord;
    inspect(_lockKey: string): LockRecord | null;
    acquireAsync(input: AcquireLockInput): Promise<AcquireLockResult>;
    releaseAsync(lockKey: string, _owner: string): Promise<boolean>;
    close(): Promise<void>;
}
