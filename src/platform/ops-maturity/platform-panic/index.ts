/**
 * Platform Panic Infrastructure
 *
 * Provides cascade halt, dual-admin acknowledgment, and recovery protocol
 * for the five-plane platform architecture.
 *
 * §R14-01
 */

// Re-export all panic types from ops-maturity/emergency
export {
  PlatformPanicService,
  type PanicFreezeMode,
  type PanicScopeLevel,
  type PanicAcknowledgment,
  type PlatformPanicDirective,
  type PanicPropagationRecord,
  type PanicActivationRequest,
  type PanicExecutionCheck,
  type PanicExecutionDecision,
  type PanicResumeReceipt,
  // @ts-ignore missing from upstream
  type PlatformResumeDirective,
  type PlatformPanicActivation,
} from "../../../ops-maturity/emergency/platform-panic-service.js";

export { type ResumePlan, canResumeFromPanic, type ResumeApprovalRole } from "../../../ops-maturity/emergency/resume-protocol/index.js";

export {
  type ForensicSnapshot,
  type PlaneForensicEvidence,
  buildForensicSnapshot,
  summarizeForensicSnapshot,
} from "../../../ops-maturity/emergency/forensic-snapshot/index.js";

export { shouldEnterPanicMode, type PanicDirectiveInput } from "../../../ops-maturity/emergency/panic-controller/index.js";

// Platform-panic-specific exports
export {
  PanicPropagationService,
  type PlaneName,
  type PropagationTarget,
  type CascadeHaltingEvent,
  type DualAdminConfirmation,
  type PropagationPolicy,
  DEFAULT_PROPAGATION_POLICY,
} from "./panic-propagation-service.js";