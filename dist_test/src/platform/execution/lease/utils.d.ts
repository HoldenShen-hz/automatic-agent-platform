import type { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { WorkerSnapshotRecord } from "../../contracts/types/domain.js";
import type { WorkerRegistryService } from "../worker-pool/worker-registry-service.js";
export declare function plusMs(iso: string, ms: number): string;
export declare function parseJsonArray(value: string, logger: StructuredLogger): string[];
export declare function mergeExecutionIds(existing: string[], executionId: string): string[];
export declare function removeExecutionId(existing: string[], executionId: string): string[];
export declare function toWorkerStatus(snapshot: WorkerSnapshotRecord, runningExecutionIds: string[]): WorkerSnapshotRecord["status"];
export declare function buildWorkerSnapshotRefreshInput(snapshot: WorkerSnapshotRecord, runningExecutionIds: string[], occurredAt: string, logger: StructuredLogger): Parameters<WorkerRegistryService["recordHeartbeat"]>[0];
