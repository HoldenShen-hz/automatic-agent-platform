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
export function toWorkerSchedulingStatus(status: WorkerStatus): WorkerSchedulingStatus {
  switch (status) {
    case "degraded":
      return "degraded";
    case "draining":
      return "draining";
    case "quarantined":
      return "quarantined";
    case "offline":
      return "offline";
    case "unavailable":
      return "unavailable";
    case "idle":
    case "busy":
    default:
      return "healthy";
  }
}
