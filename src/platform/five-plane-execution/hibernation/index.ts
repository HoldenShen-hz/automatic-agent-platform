/**
 * Hibernation Module
 *
 * §20.2 Workflow Hibernation Mechanism
 *
 * Provides workflow hibernation and wake functionality for long-running
 * workflows that need to wait for external events (approvals, callbacks, timers).
 */

export * from "./hibernation-types.js";
export { WakeEngine } from "./wake-engine.js";
export type {
  WakeEngineOptions,
  WakeEvent,
  ResumeContext,
  ResumeSnapshotDescriptor,
  ResumeCompatibilityOptions,
} from "./wake-engine.js";
