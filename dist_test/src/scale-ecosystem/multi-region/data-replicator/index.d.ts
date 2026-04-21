/**
 * Data Replicator
 *
 * Implements CDC (Change Data Capture) based data replication across regions.
 * Part of §52 multi-region data sync.
 */
import { z } from "zod";
export declare const ReplicationPolicySchema: z.ZodObject<{
    sourceRegionId: z.ZodString;
    targetRegionIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    residencyMode: z.ZodEnum<["same_jurisdiction", "allowed_cross_border", "blocked"]>;
}, "strip", z.ZodTypeAny, {
    sourceRegionId: string;
    targetRegionIds: string[];
    residencyMode: "blocked" | "same_jurisdiction" | "allowed_cross_border";
}, {
    sourceRegionId: string;
    residencyMode: "blocked" | "same_jurisdiction" | "allowed_cross_border";
    targetRegionIds?: string[] | undefined;
}>;
export type ReplicationPolicy = z.infer<typeof ReplicationPolicySchema>;
export declare function shouldReplicateToRegion(policy: ReplicationPolicy, targetRegionId: string): boolean;
export interface ReplicationEvent {
    eventId: string;
    sourceRegionId: string;
    targetRegionId: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    timestamp: string;
    checksum: string;
}
export interface ReplicationCheckpoint {
    checkpointId: string;
    sourceRegionId: string;
    targetRegionId: string;
    sequenceNumber: number;
    timestamp: string;
    pendingCount: number;
}
export interface ReplicationResult {
    success: boolean;
    eventsReplicated: number;
    lastSequence: number;
    errors: readonly string[];
}
export interface DataReplicatorConfig {
    sourceRegionId: string;
    targetRegionIds: readonly string[];
    policy: ReplicationPolicy;
    batchSize: number;
    flushIntervalMs: number;
    retryAttempts: number;
    checksumAlgorithm: "sha256" | "md5";
}
export declare class ReplicationEventBuffer {
    private buffer;
    private readonly maxSize;
    private readonly flushIntervalMs;
    private lastFlushAt;
    private timer;
    constructor(maxSize?: number, flushIntervalMs?: number);
    add(event: ReplicationEvent): boolean;
    flush(): ReplicationEvent[];
    size(): number;
    shouldFlush(): boolean;
    private scheduleFlush;
}
export declare function computeChecksum(payload: unknown, algorithm?: "sha256" | "md5"): string;
export declare class DataReplicatorService {
    private readonly config;
    private readonly buffers;
    private checkpoints;
    private readonly eventHandlers;
    constructor(config: DataReplicatorConfig);
    /**
     * Get buffer for a target region
     */
    getBuffer(targetRegionId: string): ReplicationEventBuffer | null;
    /**
     * Get checkpoint for a target region
     */
    getCheckpoint(targetRegionId: string): ReplicationCheckpoint | null;
    /**
     * Record a replication event
     */
    recordEvent(targetRegionId: string, aggregateType: string, aggregateId: string, payload: unknown): ReplicationEvent;
    /**
     * Flush all buffers and return replication result
     */
    flush(targetRegionId: string): Promise<ReplicationResult>;
    /**
     * Flush all region buffers
     */
    flushAll(): Promise<Map<string, ReplicationResult>>;
    /**
     * Register event handler for incoming replication events
     */
    onEvent(sourceRegionId: string, handler: (event: ReplicationEvent) => Promise<void>): void;
    /**
     * Handle incoming replication event (called by remote region)
     */
    handleIncomingEvent(event: ReplicationEvent): Promise<void>;
    /**
     * Validate incoming event checksum
     */
    validateEvent(event: ReplicationEvent): boolean;
    /**
     * Get replication status for all target regions
     */
    getStatus(): ReadonlyMap<string, {
        bufferSize: number;
        pendingCheckpoint: ReplicationCheckpoint | null;
    }>;
    private sendToTarget;
    private emit;
}
export declare function createDataReplicator(sourceRegionId: string, targetRegionIds: readonly string[], policy: ReplicationPolicy, options?: Partial<Omit<DataReplicatorConfig, "sourceRegionId" | "targetRegionIds" | "policy">>): DataReplicatorService;
