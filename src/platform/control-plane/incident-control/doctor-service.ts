/**
 * Doctor Service Re-export
 *
 * Re-exports DoctorService from shared/observability for backward compatibility.
 * The actual implementation has been moved to src/platform/shared/observability/doctor-service.ts
 * to comply with plane isolation architecture rules.
 */

export {
  DoctorService,
  summarizeDoctorChecks,
  type DoctorCheckId,
  type DoctorCheckReport,
  type DoctorCheckStatus,
  type DoctorEventBacklogSummary,
  type DoctorLockSummary,
  type DoctorReport,
  type DoctorSelfCheckSummary,
  type DoctorServiceOptions,
} from "../../shared/observability/doctor-service.js";
