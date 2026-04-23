/**
 * @fileoverview Worker Scheduling Status - Maps raw worker status to scheduling suitability.
 *
 * Translates detailed worker status values into a simplified scheduling view.
 * The scheduler uses scheduling status to quickly filter eligible workers
 * without considering all the administrative states that affect visibility.
 *
 * @see Worker Registry Service: worker-registry-service.ts
 */
import type { WorkerSchedulingStatus, WorkerStatus } from "../../../contracts/types/domain.js";
/**
 * Maps detailed worker status to scheduling-friendly status.
 *
 * administrative/operational statuses (draining, quarantined, offline, unavailable)
 * are mapped to their scheduling equivalents. idle and busy are collapsed to "healthy"
 * as they represent normal operation capable of accepting work.
 */
export declare function toWorkerSchedulingStatus(status: WorkerStatus): WorkerSchedulingStatus;
