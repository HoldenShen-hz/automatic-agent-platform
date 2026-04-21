/**
 * @fileoverview ExecuteBridge — interface between OAPEFLIR Execute phase and the runtime.
 *
 * GAP-V2-01: The OAPEFLIR loop's Execute stage previously returned hardcoded mock data
 * via `buildStepOutputs()`. This interface + implementation replaces that with real
 * runtime execution by connecting to the orchestrator / supervisor layer.
 *
 * ## Interface Design
 *
 * The bridge translates OAPEFLIR's `Plan` / `PlanStep` domain objects into the
 * runtime's execution model (`StepOutputRecord[]`) and translates the results back
 * into `DualChannelStepOutput` for consumption by the Feedback stage.
 *
 * ## Two Implementation Strategies
 *
 * - **RuntimeExecuteBridge** (production): calls `runMultiStepOrchestration` with a
 *   serialised representation of the OAPEFLIR plan, then maps `StepOutputRecord[]`
 *   → `DualChannelStepOutput[]`.
 *
 * - **MockExecuteBridge** (testing / demo): returns fabricated `DualChannelStepOutput[]`
 *   without touching any runtime service. This is the existing `buildStepOutputs()`
 *   behaviour retained for cases where full execution is not desirable.
 *
 * Part of GAP-V2-01.
 */
export {};
//# sourceMappingURL=execute-bridge.js.map