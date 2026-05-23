## Module: ops-maturity

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/` - primary location
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/ops-maturity/` - platform-specific extensions

Subdirectories reviewed: `agent-lifecycle`, `drift-detection`, `capacity-planner`, `learning`, `emergency`, `cost-optimizer`, `platform-ops-agent`, `explainability`, `workflow-debugger`, `compliance-reporter`, `monitoring`, `chaos`, `edge-runtime`, `version-management`, `multimodal`, `improvement`.

---

## Issue 1

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/agent-lifecycle/agent-lifecycle-service.ts`  
**Line:** 88-103  
**Problem:** `transition()` validates the lifecycle state change via `isValidLifecycleTransition` but the service holds agent state in private Maps. The registry `listActiveAgents()` returns agents filtered by a hardcoded state check, which can diverge from what the service tracks internally. This creates a split-brain scenario where `transition()` may succeed but the agent may not appear in "active" queries.  
**Severity:** high  
**Recommended fix:** Have `AgentLifecycleService` use the canonical `agent-registry` module as the source of truth for all state queries, or ensure `listActiveAgents()` receives the same agent instances the service manages. Consider adding an `onTransition` hook so the registry stays synchronized.

---

## Issue 2

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/agent-lifecycle/canary-controller/index.ts`  
**Line:** 41-56  
**Problem:** `shouldPromoteCanary()` uses a fallback that treats missing metrics as "perfect" (`successRate ??= 1.0`, `errorRate ??= 0.0`). This is dangerous because a canary that has not yet reported any metrics would pass promotion criteria trivially.  
**Severity:** high  
**Recommended fix:** Require that all metrics are present before evaluating promotion. Only apply fallback defaults when the metric key exists but the value is null/undefined. Add a `hasRequiredMetrics` guard that fails safe when data is absent.

---

## Issue 3

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/agent-lifecycle/canary-controller/index.ts`  
**Line:** 73-75  
**Problem:** `shouldRollbackCanary()` is hardcoded with literal thresholds (`errorRate > 0.05`, `successRate < 0.90`) that are not configurable and differ from the promotion gate criteria. This creates inconsistent behavior between rollback and promotion logic.  
**Severity:** medium  
**Recommended fix:** Extract these thresholds into a shared constants object or configuration passed to both functions. Align the rollback thresholds with the promotion gate criteria.

---

## Issue 4

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/emergency/platform-panic-service.ts`  
**Line:** 405-407  
**Problem:** `isDirectiveExpired()` compares `directive.expiresAt` against `Date.now()`. If `expiresAt` is malformed or an empty string, `Date.parse()` returns `NaN` and the comparison `NaN <= Date.now()` evaluates to `false`, meaning the directive never expires and stays active indefinitely.  
**Severity:** high  
**Recommended fix:** Add a guard: if `directive.expiresAt` is null/undefined, return false. Otherwise parse and check for NaN before comparison. Throw or log an error for unparseable timestamps rather than treating them as non-expired.

---

## Issue 5

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/emergency/panic-controller/index.ts`  
**Line:** 7-11  
**Problem:** `shouldEnterPanicMode()` returns `true` for any `reasonCode` starting with `"security."` regardless of the scope or severity. A low-severity security note could inadvertently trigger platform-wide panic mode. There is no check on `activeIncidents` for security reason codes either.  
**Severity:** high  
**Recommended fix:** Differentiate between security advisory prefixes and actual security incidents. Require `activeIncidents > 0` or a specific severity qualifier in the reason code before entering panic mode.

---

## Issue 6

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/emergency/resume-protocol/index.ts`  
**Line:** 20-53  
**Problem:** `canResumeFromPanic()` requires `plan.checkpointsVerified`, `plan.forensicSnapshotReviewed`, `plan.rollbackPlanReady`, and `plan.validationRunPassed` all to be true. However, if any of these fields is `undefined`, the `?? false` coalescing handles them correctly, but if they are `null` or a non-boolean truthy value, they bypass the check. Additionally, the `approvalCount` fallback logic does not validate that approvers themselves have actually approved.  
**Severity:** medium  
**Recommended fix:** Use explicit `=== true` checks rather than truthiness. Add validation that `plan.approvalCount` reflects the actual count of entries in `plan.approvedBy` when it is derived.

---

## Issue 7

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/drift-detection/drift-detector-service.ts`  
**Line:** 396-403  
**Problem:** `safeHashEquals()` converts both inputs to Buffers using `Buffer.from(left, "utf8")`. This is a constant-time comparison for the purpose of timing attack resistance, but the function is used for fingerprint equality, not security-sensitive comparison. The function name and constant-time approach suggests security intent, yet it is not documented.  
**Severity:** low  
**Recommended fix:** Document why constant-time comparison is needed here, or use a simpler equality check if timing safety is not a requirement.

---

## Issue 8

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/drift-detection/changepoint-detector/index.ts`  
**Line:** 519-521  
**Problem:** `hoursToSamples()` uses `Math.round(hours * samplesPerHour)` and then `Math.max(1, ...)`. For fractional hour inputs like `0.25` (15 minutes), this rounds to 0 then the `Math.max(1,...)`纠正 it to 1. The behavior is correct but the comment/docstring does not explain this rounding semantics.  
**Severity:** low  
**Recommended fix:** Add documentation explaining the rounding behavior and that the minimum sample count is always at least 1 regardless of input window size.

---

## Issue 9

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/drift-detection/drift-detector-service.ts`  
**Line:** 364-375  
**Problem:** `computeFeatureDifference()` computes a symmetric set difference but normalizes by raw count rather than union cardinality. Two fingerprints with 10 features each that share 9 would show a difference of 2 (10-9+10-9=2), yielding `driftScore = 0.2` which maps to "low" severity. This is not meaningful for small feature sets.  
**Severity:** medium  
**Recommended fix:** Normalize by the size of the union of features: `difference / union.size`. This yields a Jaccard-like metric that is more interpretable.

---

## Issue 10

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/capacity-planner/capacity-planning-service.ts`  
**Line:** 113-116  
**Problem:** `variance` calculation divides by `Math.max(1, usageValues.length - 1)` which is the sample variance formula (Bessel's correction). However, `standardDeviation` then takes `Math.sqrt(Math.max(variance, 0))`. The `Math.max(variance, 0)` guards against negative variance due to floating-point error, but the underlying `variance` formula can still produce small negative values (-0.000001) that get zeroed, slightly biasing the standard deviation downward.  
**Severity:** low  
**Recommended fix:** Use `Math.max(0, variance)` instead of `Math.max(variance, 0)` to properly handle negative floating-point edge cases before the sqrt.

---

## Issue 11

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/capacity-planner/capacity-planning-service.ts`  
**Line:** 244-250  
**Problem:** `computeDynamicFailoverReserve()` returns static percentages per SLA tier (30/20/15) with no consideration of actual load, error budget burn rate, or regional constraints. In a real capacity planning context, these static values could lead to over- or under-provisioned failover reserves.  
**Severity:** medium  
**Recommended fix:** Consider incorporating `providerQuotaLimits` and `regionFailoverReservePercent` from the capacity signal or forecast data to dynamically adjust the reserve rather than using static tier-based defaults.

---

## Issue 12

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts`  
**Line:** 70-79  
**Problem:** `recordCost()` throws an error if `decisionRef.trim().length === 0`. However, `unsourcedRecordCount` is decremented only after the throw check passes. If multiple invalid records arrive in sequence, the decrement can cause `unsourcedRecordCount` to go negative. The decrement logic does not guard against negative values.  
**Severity:** medium  
**Recommended fix:** Guard the decrement with `if (this.unsourcedRecordCount > 0) { this.unsourcedRecordCount -= 1; }` or use `Math.max(0, this.unsourcedRecordCount - 1)`.

---

## Issue 13

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts`  
**Line:** 143-152  
**Problem:** `riskLevelForSubject()` upgrades risk to "medium" when a record has `costType === "llm"` or `costType === "model"`. However, `costType === "model"` is not defined in the `CostSubjectType` union. This may be a legacy or misspelled type that falls through to the default `baseRisk`.  
**Severity:** low  
**Recommended fix:** Clarify whether `"model"` is a valid cost type. If not, remove it from the check. If it is valid, ensure it is added to the `CostSubjectType` union.

---

## Issue 14

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/recommendation-engine/index.ts`  
**Line:** 33-37  
**Problem:** `downgradePath` logic checks `recommendedProfile.pricing.inputPer1kUsd + recommendedProfile.pricing.outputPer1kUsd < currentProfile.pricing.inputPer1kUsd + currentProfile.pricing.outputPer1kUsd`. This uses raw price comparison without normalizing for capability or context differences. A "lower cost" model may not be appropriate for all task types.  
**Severity:** medium  
**Recommended fix:** Add a model capability compatibility check before declaring a downgrade viable. Log a warning when a downgrade is recommended but the task type does not match the lower model's strengths.

---

## Issue 15

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`  
**Line:** 51-71  
**Problem:** `simulateHealthCheck()` uses a regex test `/(rollback|failover)/.test(operation)` combined with `componentId.length % 2 === 0` as the sole determinism source for `healthCheckPassed`. This means health checks for the same component and operation can alternate between pass/fail unpredictably based solely on string length parity.  
**Severity:** high  
**Recommended fix:** Replace the deterministic-but-opaque length-parity check with a proper health status evaluation based on actual component state. If simulating, use a seeded random or explicit failure injection that is controllable.

---

## Issue 16

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`  
**Line:** 210-213  
**Problem:** `performHealingOperation()` uses a formula `deterministicScore % (action.operation === "failover" ? 5 : 4) !== 0` to determine success. This produces a deterministic-but-non-obvious success rate (~75-80%) that does not reflect actual healing effectiveness.  
**Severity:** high  
**Recommended fix:** Replace with a proper outcome model or make the success rate configurable via policy. Document the expected success rate behavior explicitly.

---

## Issue 17

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/platform-ops-agent-service.ts`  
**Line:** 119-149  
**Problem:** `createProposal()` calls `this.chooseActionType()` before checking whether the computed `actionType` is in `this.definition.allowedActionTypes`. The `computeBlockers()` method checks this, but by then `actionType` is already selected and stored in the proposal. If the action is not allowed, it appears in `blockedBy` but the proposal summary references an action that is not executable.  
**Severity:** medium  
**Recommended fix:** Move the allowed action type check before `chooseActionType()` so that a valid fallback action is chosen when the preferred action is not allowed. Avoid creating proposals with inherently blocked actions.

---

## Issue 18

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/workflow-debugger/workflow-debugger-service.ts`  
**Line:** 97-98  
**Problem:** `evaluateTrace()` finds a matching breakpoint via `find()` without checking if the find succeeded. The `!` assertion on `matched` could be undefined if the breakpoints Map was populated with different `nodeRunSelector` values than the frame's `nodeRunId`.  
**Severity:** high  
**Recommended fix:** Add a null check on `matched` and log a warning or skip the frame if no matching breakpoint is found. Do not use `!` assertion on potentially undefined values.

---

## Issue 19

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/explainability/explanation-pipeline-service.ts`  
**Line:** 128-130  
**Problem:** `generate()` throws if `depth === "L3"` and `options.forensicBudgetReservationId` is not provided, but `generate()` does not have access to actual billing or budget system to verify that the reservation is valid or has sufficient balance. The error is raised at generation time rather than at reservation confirmation time.  
**Severity:** medium  
**Recommended fix:** Validate the reservation ID exists in the billing system before throwing. Consider deferring the error to a later pipeline stage where budget confirmation can occur. Add a pre-flight check method that `generate()` calls before attempting rendering.

---

## Issue 20

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/explainability/explanation-pipeline-service.ts`  
**Line:** 139-162  
**Problem:** `buildVersionLockRef()` calls `JSON.stringify()` on `rationaleWithoutLock`. If any field contains a circular reference or non-serializable value, this throws at runtime rather than producing a graceful error.  
**Severity:** medium  
**Recommended fix:** Add a try/catch around `JSON.stringify` in `buildVersionLockRef()` and throw a descriptive error with the rationale ID if serialization fails.

---

## Issue 21

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts`  
**Line:** 295-326  
**Problem:** `resolveConflict()` returns a `merge` resolution for low-risk conflicts but then calls `performThreeWayMerge()` which produces a hash digest when actual payloads are digests. The merged payload is not usable for actual reconciliation because it is a hash of the combined inputs rather than a merge of the actual data.  
**Severity:** high  
**Recommended fix:** Implement actual payload merge logic or document clearly that `mergedPayload` is a hash reference rather than actual merged data. Downstream consumers expecting merged data may silently use the wrong value.

---

## Issue 22

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts`  
**Line:** 143-144  
**Problem:** The offline window check `Date.now() - createdAtMillis > profile.offlineMaxDuration!` compares milliseconds against a duration field. If `offlineMaxDuration` is meant to be in hours or minutes but is provided as milliseconds, the window check will incorrectly reject valid offline requests.  
**Severity:** medium  
**Recommended fix:** Normalize the duration unit explicitly. Document the expected unit for `offlineMaxDuration` and add a runtime assertion or conversion to ensure consistent units.

---

## Issue 23

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/drift-detection/learning/rollout-manager.ts`  
**Line:** 245-268  
**Problem:** `rollback()` calls the `RollbackHandler` but does not handle the case where the handler throws. If `handler(proposalId, reason)` rejects, the state is updated to `'rolled_back'` anyway and the error propagates without being caught.  
**Severity:** high  
**Recommended fix:** Wrap the handler call in try/catch. If the handler throws, either retry with backoff, mark the rollout as `'rollback_failed'`, or log and rethrow with context.

---

## Issue 24

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/drift-detection/learning/promotion-gate.ts`  
**Line:** 65-88  
**Problem:** The promotion gate evaluates multiple independent criteria and accumulates reasons, but the `allowed` flag is `reasons.length === 0`. If one criterion fails (e.g., insufficient success lift), subsequent criteria checks still execute. This is fine functionally, but there is no early-abort optimization for expensive report evaluations.  
**Severity:** low  
**Recommended fix:** Consider short-circuiting on first failure for high-cost evaluations by checking a `passed` boolean flag before subsequent checks. Not critical since the gate is not performance-sensitive.

---

## Issue 25

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/learning/evidence-store.ts`  
**Line:** 120-122  
**Problem:** `cloneEvidenceRecord()` uses `structuredClone()` which is not available in all Node.js versions prior to Node 17. The codebase may run on older Node versions where this would throw a `ReferenceError`.  
**Severity:** medium  
**Recommended fix:** Verify the minimum Node.js version for this project. If Node 17+ is guaranteed, document it in the README or package.json engines field. Otherwise, replace `structuredClone` with a manual shallow clone or `JSON.parse(JSON.stringify())`.

---

## Issue 26

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/monitoring/anomaly-detection-service.ts`  
**Line:** 65-68  
**Problem:** `ingestMetric()` stores the entire buffer array per metric name and relies on `evictExpired()` for cleanup. However, `evictExpired()` only triggers when `this.metricBuffer.size` exceeds `maxBufferEntries`. If many distinct metric names are ingested, this could cause unbounded memory growth before eviction triggers.  
**Severity:** medium  
**Recommended fix:** Evict based on per-metric buffer size or total age rather than total distinct keys. Consider a sliding window based on timestamp rather than count-based eviction.

---

## Issue 27

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/chaos/chaos-experiment-scheduler.ts`  
**Line:** 747-755  
**Problem:** The R21-18 fix tracks `evaluatedHypotheses` per `experimentId:hypothesisName`. However, `evaluatedHypotheses` is never cleared when an experiment ends. A subsequent run of the same experiment with the same hypothesis names would be treated as already evaluated.  
**Severity:** high  
**Recommended fix:** Clear `evaluatedHypotheses` entries for a given experiment when `clearSteadyStateCache()` is called or when the experiment reaches a terminal state.

---

## Issue 28

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/chaos/chaos-experiment-scheduler.ts`  
**Line:** 437-464  
**Problem:** `executeRollbackWithTimeout()` creates an AbortController but does not call `controller.abort()` when the experiment is found to not exist or during early returns. The controller's signal would remain listeners attached until abort or timeout fires.  
**Severity:** low  
**Recommended fix:** Call `controller.abort()` with an appropriate error message in all early-return paths within `executeRollbackWithTimeout()`.

---

## Issue 29

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/version-management/semver-validator.ts`  
**Line:** 298-302  
**Problem:** `satisfiesTilde()` has a bug in the minor version bound check: `if (version.minor < constraint.minor || version.minor > constraint.minor)` is always true when `version.minor !== constraint.minor`. This means the function returns `false` for any tilde range where minor versions are not equal, even if they should be satisfied.  
**Severity:** critical  
**Recommended fix:** The logic should be `if (version.minor < constraint.minor || version.minor > constraint.minor)` → change to `if (version.minor < constraint.minor || version.minor > constraint.minor)` is actually `minor < constraint OR minor > constraint`, which is equivalent to `minor !== constraint`. This should be `version.minor > constraint.minor` only, or simply removed since the next check `version.patch < constraint.patch` already handles the lower bound. The `<` check makes it impossible to satisfy. Fix to: `if (version.minor > constraint.minor) return false;` plus the patch lower bound check.

---

## Issue 30

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/version-management/version-compatibility-matrix.ts`  
**Line:** 143-162  
**Problem:** When checking wildcard source version entries, the `for...of` loop mutates entries by adding a `recommendedProfile` property via spread in `buildCostOptimizationRecommendation`. This mutation is indirect and could cause issues if the same profile object is used elsewhere.  
**Severity:** low  
**Recommended fix:** Ensure `findLowerCostPeerProfile()` returns a new object each call rather than returning a shared reference that gets mutated.

---

## Issue 31

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/compliance-reporter/compliance-reporter-service.ts`  
**Line:** 30-32  
**Problem:** `getActiveViolations()` returns violations filtered by `remediatedAt == null` but the returned array is not sorted or limited. Over time, this could return a very large array if many violations have been recorded.  
**Severity:** low  
**Recommended fix:** Add pagination or a limit parameter to `getActiveViolations()` to prevent unbounded return sizes.

---

## ADR Gaps Identified

1. **No ADR for drift detection threshold calibration** - The thresholds in `ChangepointDetectorService` and `drift-detector-service.ts` are hardcoded with values that appear reasonable but have no documented justification or sensitivity analysis. An ADR should specify how these were determined and under what conditions they should change.

2. **No ADR for canary promotion rollback boundary divergence** - `shouldPromoteCanary()` and `shouldRollbackCanary()` have different threshold values and no shared configuration. This split can cause conflicting signals.

3. **No ADR for offline execution risk scoring** - `EdgeRiskGate` in edge-runtime is responsible for blocking high-risk task types, but there is no documented decision record for the risk score threshold of 0.5 or the blocked task type list.

4. **No ADR for cost attribution "unknown_subject" fallback** - When `subjectId` is absent, cost records resolve to `"unknown_subject"`. This lumping can skew cost dashboards and recommendations. An ADR should specify the policy for handling unattributed costs.

5. **No ADR for version compatibility "warning" vs "incompatible" fallback behavior** - `VersionCompatibilityMatrix` in strict mode returns `incompatible`, in non-strict mode returns `warning + compatible`. The choice of strictness is not documented per deployment context. An ADR should define the default and when it should change.

6. **No ADR for panic mode allowList bypass** - The `evaluateExecution()` method in `PlatformPanicService` bypasses blocking for any actor in the `allowList`. This effectively disables panic mode enforcement for privileged actors. An ADR should specify the security model for allowList and whether this is intentional for break-glass scenarios.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 10    |
| Medium   | 14    |
| Low      | 6     |
| **Total**| 31    |

**ADR Gaps:** 6 identified

The most impactful issues are:
- The `satisfiesTilde()` semver bug (critical) which can cause version compatibility checks to incorrectly reject valid ranges
- The `evaluatedHypotheses` leak in chaos scheduler (high) that could prevent re-evaluation of steady-state on repeated experiment runs
- The non-obvious determinism in `SelfHealingService` health checks (high) that could mask actual component failures
- The `evaluateTrace()` null-dereference risk (high) that could crash workflow debugging

---

## Module: platform/contracts

Reviewed all files in `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/` including subdirectories: executable-contracts/, mission/, types/, constants/, control-directive/, delegation-request/, evidence-record/, execution-plan/, execution-receipt/, model-request/, prompt-bundle/, projection-update/, request-envelope/, result-envelope/, and state-command/.

---

## Critical Issues

### 1. FeedbackSignal timestamp preprocessing inconsistency

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/types/feedback.ts` (lines 47-66)

**Problem:** `FeedbackSignalSchema` uses `z.preprocess()` to convert timestamp to a number, but the `FeedbackSignal` interface defines `timestamp` as a number (via `z.output<>`). However, the `FeedbackBatch` interface at line 88 defines `emittedAt: number` while `FeedbackSignal` timestamps remain as the preprocessed number internally. The transform at lines 63-66 creates a new object where `feedbackTrustScore` is derived but the timestamp preprocessing means signals with ISO string timestamps become Unix integers, while the `FeedbackBatch.emittedAt` is `Date.now()` (also Unix integer). This is internally consistent but the original payload's timestamp ISO string information is lost.

**Severity:** Medium

**Recommended fix:** Add a comment documenting that timestamps are preprocessed to Unix integers for efficient storage/query, or preserve the original ISO string in a separate field if needed for debugging.

---

### 2. Contract envelope signature timing attack mitigation is incomplete

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-envelope.ts` (lines 74, 113-120)

**Problem:** `timingSafeHexEqual` at line 74 uses `timingSafeEqual` from `node:crypto` which compares buffers. However, the comparison at line 74 passes string buffers - when `leftBuffer.length !== rightBuffer.length` (line 117), it returns `false` immediately without constant-time comparison. The early return leaks length information via timing. Additionally, at line 89, errors during signature verification include the raw error message which could leak timing information differently than a signature mismatch.

**Severity:** Medium

**Recommended fix:** Use `crypto.timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))` directly without the early length check, or ensure the early return is also constant-time. Also sanitize error messages in the catch block at line 89 to avoid leaking internal details via timing differences.

---

### 3. BudgetLedger status enum missing states in schema vs factory mismatch

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (line 617)

**Problem:** `BudgetLedger.status` type allows `"open" | "soft_cap_reached" | "hard_cap_reached" | "closed" | "settling" | "reserving" | "releasing"` (7 states). However, the Zod schema at `BudgetLedgerSchema` (schemas.ts line 543) only has 4 states: `"open", "soft_cap_reached", "hard_cap_reached", "closed"`. The factory function `createBudgetLedger` (contract-models.ts line 504) defaults to status `"open"` and allows any of the 7 via casting (`as BudgetLedger`), but validation against the schema would reject `settling`, `reserving`, or `releasing` statuses.

**Severity:** High

**Recommended fix:** Add missing statuses to `BudgetLedgerSchema`: `settling`, `reserving`, `releasing`.

---

### 4. BudgetSettlement schema actualAmount allows negative values

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/schemas.ts` (line 564)

**Problem:** `BudgetSettlementSchema` defines `actualAmount: z.number().nonnegative()`. The factory function `createBudgetSettlement` (contract-models.ts line 596) validates with `requireNonNegative(input.actualAmount, ...)` which is correct. However, the schema constraint `.nonnegative()` is not enforced on parse paths that bypass the factory. If a settlement is constructed directly via schema parse (not factory), negative values could enter the system.

**Severity:** Medium

**Recommended fix:** Add explicit check in `createBudgetSettlement` factory (which exists at line 596) to use `requireNonNegative` which it does - this is already correct. No action needed.

---

### 5. HarnessRunStatusSchema in schemas.ts missing some statuses

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/schemas.ts` (lines 219-234)

**Problem:** `HarnessRunStatusSchema` defines statuses: `created, admitted, planning, ready, running, pausing, paused, resuming, replanning, compensating, completed, failed, cancelled, aborted` (13 statuses). The type `HarnessRunStatus` in contract-models.ts (lines 264-278) defines the same 13. This is consistent. However, `HarnessRunSchema` (lines 236-267) does not include `goal` and `mode` fields which are present in `HarnessRun` type at line 287-288 of contract-models.ts.

**Severity:** Medium

**Recommended fix:** Add `goal: z.string().optional()` and `mode: z.string().optional()` to `HarnessRunSchema`.

---

### 6. nextMissionStatus function allows invalid transitions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/mission/index.ts` (lines 315-325)

**Problem:** `nextMissionStatus` returns `true` for `draft -> archived` which is listed as allowed, but `archived` is a terminal state - nothing should transition FROM archived. Also `frozen -> archived` is listed but frozen typically should go through `paused -> archived` or similar path. The transition map is incomplete and doesn't model terminal states correctly.

**Severity:** Medium

**Recommended fix:** Remove `archived` from target states (it should be terminal). Review the state machine semantics for `frozen` transitions.

---

### 7. MissionStatus transitions inconsistent between spec and implementation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/mission/index.ts` (lines 316-323)

**Problem:** The allowed transitions defined in `nextMissionStatus`:
- `paused -> archived` is allowed, but `paused` typically should go `active` or stay `frozen`
- `completed -> archived` - should `completed` really transition to `archived` directly without going through some terminal handling?
- `draft -> archived` - drafts should be deleted or explicitly archived, not transitioned

**Severity:** Medium

**Recommended fix:** Document the intended state machine semantics in ADR and align the transition matrix.

---

### 8. DriftMitigationService state machine not enforced on all transitions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/types/drift-contracts.ts` (lines 289-340)

**Problem:** `approveAction` checks status === "proposed" (line 291), but `executeAction` checks status === "approved" (line 309). However, there is no validation that an action has gone through approval before execution in a single call - if someone calls `executeAction` without calling `approveAction` first, the action will be in `proposed` state and fail. But the service doesn't track this as an error - it just throws a generic error. Missing state transition validation error with specific code for invalid transition ordering.

**Severity:** Low

**Recommended fix:** Add state transition validation with specific error codes for out-of-order execution.

---

### 9. ResponsibilityBoundaryService assertion has no-op case

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/types/responsibility-boundary.ts` (lines 285-295)

**Problem:** `assertActionAllowed` at line 285 calls `assertBoundaryActionAllowed` at line 294 but if `boundary` is not found, it throws an error at line 292. However, the `requiresHumanReview` method at lines 280-283 returns `false` if boundary not found instead of throwing. Inconsistent behavior between query and mutation methods.

**Severity:** Low

**Recommended fix:** Document that `getBoundary` returns null for non-existent boundaries (query) vs mutations throwing. Make `requiresHumanReview` consistent with other methods.

---

### 10. InterPlaneContractGateway TTL comparison uses getTime() then subtraction

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/inter-plane-contract-gateway.ts` (lines 306-313)

**Problem:** TTL check at lines 306-313 computes `now - envelopeTime > envelope.ttl`. This is not a timing attack issue (TTL is not secret), but the comparison uses integer subtraction which could overflow on very large TTL values. More importantly, `envelopeTime` is extracted via `getTime()` which returns Unix epoch ms. If envelope timestamp is in the future (clock skew), the check could incorrectly accept expired envelopes. If `envelope.ttl` is `null`, the check is skipped (line 305).

**Severity:** Low

**Recommended fix:** Add check for clock skew: reject if `envelopeTime > now + acceptable_drift_ms`.

---

### 11. normalizeUnifiedRuntimeMode has unreachable default case

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/types/unified-runtime-mode.ts` (lines 97-124)

**Problem:** The function `normalizeUnifiedRuntimeMode` has a `default: return mode` at line 122 which is unreachable because all possible `UnifiedRuntimeMode | DocumentedUnifiedRuntimeMode` values are handled in the switch. The TypeScript type system may not flag this as the type is a union that's fully covered. This dead code could become reachable if new modes are added to the union type without updating this function.

**Severity:** Low

**Recommended fix:** Replace `default` with an exhaustive check using `default: assertExhaustive(mode)` that throws if reached.

---

### 12. Contract-envelope HMAC signing includes payload stringification but not metadata

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-envelope.ts` (lines 65-72, 99-104)

**Problem:** When signing, the `signatureInput` at line 69 (verify) and line 102 (sign) includes `schemaVersion:commandId:correlationId:timestamp:payload`. Metadata is NOT included in the signature. If metadata is modified after signing (e.g., `sourcePlane`, `targetPlane`, `messageType`), the envelope signature remains valid but the metadata is untrusted. Inter-plane gateway relies on metadata for routing (see inter-plane-contract-gateway.ts lines 343-351 which extract source/target planes from metadata).

**Severity:** High

**Recommended fix:** Include metadata hash in the signature input, or document clearly that metadata is not integrity-protected.

---

### 13. AppError toJSON serializes cause incorrectly for non-AppError causes

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/errors.ts` (lines 697-706)

**Problem:** `serializeCause` returns `{ name, message, ...(cause instanceof AppError ? { code } : {}) }`. For a standard Error, this is fine. But for an AppError cause, it includes `code` but NOT `category`, `statusCode`, `retryable`, or other AppError-specific fields. If code flows through `AppError.wrap`, the original AppError details are lost.

**Severity:** Medium

**Recommended fix:** Include all relevant AppError fields in the serialized cause, or document the limitation.

---

### 14. lastOccurredAtMs monotonic enforcement may skip timestamps under high load

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/errors.ts` (lines 691-695)

**Problem:** `lastOccurredAtMs = now > lastOccurredAtMs ? now : lastOccurredAtMs + 1` ensures monotonicity but if `Date.now()` is called multiple times within the same millisecond, it increments by 1. Under extremely high error rates (>1000 errors/ms), this could cause issues. More importantly, if `Date.now()` returns a value less than `lastOccurredAtMs` due to clock skew, it increments but doesn't indicate any problem.

**Severity:** Low

**Recommended fix:** Add a check/processing warning if clock skew is detected (now < lastOccurredAtMs).

---

### 15. GraphPatch version must advance validation doesn't check for negative versions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (line 196)

**Problem:** `if (input.newGraphVersion <= input.baseGraphVersion)` allows negative versions to pass through if both are negative (e.g., base=-5, new=-3 passes). While unlikely in practice, the validation should explicitly check `>= 0`.

**Severity:** Low

**Recommended fix:** Add `input.newGraphVersion < 0 || input.baseGraphVersion < 0` to the validation error.

---

### 16. NodeAttempt.attemptNo starts at 1 but no upper bound check

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (lines 300-301)

**Problem:** `createNodeAttempt` checks `attemptNo < 1` (line 300) but there's no upper bound. Extremely high retry counts could cause integer overflow or other issues in downstream systems.

**Severity:** Low

**Recommended fix:** Add an upper bound check (e.g., attemptNo <= 1000 or similar reasonable limit).

---

### 17. Missing ADR for 8-factor budget tracking (R25-20 mentioned in delegation-request)

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/delegation-request/index.ts` (line 17)

**Problem:** Comment at lines 17-18 references "ADR-026 8-factor budget tracking" but there is no ADR-026 in the codebase (or it's not linked). The budget tracking is mentioned across multiple files (model-request also references R25-19) but the architectural decision is not documented.

**Severity:** Medium

**Recommended fix:** Create ADR-026 documenting the 8-factor budget tracking model, or link to existing documentation.

---

## High-Level Architecture Observations

### ADR Gaps

1. **UnifiedRuntimeMode mapping** - Multiple mapping functions exist (`mapPolicyModeToUnifiedRuntimeMode`, `mapHealthDegradationModeToUnifiedRuntimeMode`, `mapAutonomyLevelToUnifiedRuntimeMode`, `normalizeUnifiedRuntimeMode`, `toDocumentedUnifiedRuntimeMode`) but there's no ADR explaining when each should be used and the semantic differences between modes.

2. **Budget Ledger hierarchy** - The `BudgetLedger.tier` field (`"platform" | "tenant" | "pack" | "step"`) and parent budget relationships are not documented in an ADR. How budget reservations flow through the hierarchy is unclear.

3. **Mission status lifecycle** - The state machine in `nextMissionStatus` (mission/index.ts lines 315-325) is not formally documented. The transition rules should be captured in an ADR.

4. **SideEffectRecord deadline semantics** - The `deadline` field (line 569 in contract-models.ts) says "must commit before this time per §14.11" but the enforcement mechanism and consequences of missing the deadline are not documented.

5. **Contract envelope signature scope** - ADR R7-44 is referenced for signature verification but the scope of what's signed (payload only, not metadata) is not documented. An ADR should clarify what fields are integrity-protected.

### Consistency Issues

1. **ErrorCode brand types** - `ErrorCode` type (errors.ts line 59-61) has a brand `__errorCodeBrand` but this is never actually used for type narrowing. The various error code formats (LegacyErrorCode, DottedErrorCode, etc.) are defined but there's no validation that codes match their supposed format.

2. **PrincipalRef vs PlatformPrincipal** - Two similar types exist: `PrincipalRef` (executable-contracts, has `type` discriminant) and `PlatformPrincipal` (platform-contracts, uses `actorId`). These are used in different contexts but the relationship between them is unclear.

3. **HarnessRun.fencingToken format** - The factory (contract-models.ts line 142) uses `${nodeId}-fence` as default but contract envelope comment (contract-models.ts line 279-281) says the harness runtime uses `${node.nodeId}-fence`. This is the same format - consistent.

4. **Schema vs Type mismatch for BudgetLedger** - As noted in Critical Issue #3.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 3     |
| Medium   | 9     |
| Low      | 5     |
| **Total**| 17    |

**ADR Gaps:** 5 identified

The most impactful issues are:
- **BudgetLedgerSchema missing statuses** (High) - Data integrity issue where settling/reserving/releasing states are not in the schema
- **Contract envelope metadata not signed** (High) - Security issue where sourcePlane/targetPlane metadata can be modified after signing
- **Multiple ADR gaps** - Architectural decisions made in code without supporting documentation
- **Inconsistent state machine handling** - Mission status transitions and similar stateful entities need formalization

The module is generally well-structured with good separation between canonical executable contracts, legacy adapters, and platform-specific types. The module correctly uses Zod for schema validation and has good patterns for factory functions with validation. The deprecation warnings for legacy contracts are well-implemented.

## Module: core + runtime

### Issue 1: Hardcoded Provider/Model in Cost Event WAL

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`
**Line:** 566-567

**Problem:** The cost event write-ahead logging (WAL) records hardcoded provider `"minimax"` and model `"MiniMax-M2.7"` instead of using the actual model from step configuration. This means all cost events will be attributed to MiniMax regardless of which provider actually processed the step.

**Severity:** high

**Recommended fix:** Extract the actual provider/model from the step configuration or routing decision:
```typescript
const costEventWAL: CostEventRecord = {
  // ...
  provider: step.provider ?? routing.provider ?? "minimax",
  model: step.model ?? routing.model ?? "MiniMax-M2.7",
  // ...
};
```

---

### Issue 2: Placeholder Token Values in Cost Event WAL

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`
**Line:** 568-570

**Problem:** Token counts and cost are placeholder calculations (`30 + index * 10`, `12 + index * 5`, `0.001 + index * 0.0005`) rather than actual measured values. This undermines the R4-28 (INV-COST-001) WAL purpose of providing accurate cost tracking.

**Severity:** high

**Recommended fix:** Either:
1. Remove the WAL until real measurement is implemented, or
2. Obtain actual token counts from `buildStepOutput` result (which contains `llmResult?.usage`), or
3. Add a TODO comment explicitly marking these as placeholders with a tracked issue reference.

---

### Issue 3: Raw SQL INSERT for HarnessRun Bypasses Store Abstraction

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
**Line:** 372-396

**Problem:** The R4-27 fix persists HarnessRun via raw SQL `INSERT INTO harness_runs` instead of using the AuthoritativeTaskStore abstraction. The comment notes "AuthoritativeTaskStore doesn't have harnessRun sub-store" but this is a workaround, not a proper solution. This creates maintenance debt and bypasses any store-level hooks or validation.

**Severity:** medium

**Recommended fix:** Either:
1. Add `harnessRun` support to AuthoritativeTaskStore, or
2. Create a proper `HarnessRunStore` in five-plane-state-evidence, or
3. Document this as a temporary shim with a TODO to track proper integration.

---

### Issue 4: Hardcoded Compaction Ratios Without Configuration

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/context-compaction-service.ts`
**Line:** 118-119

**Problem:** `stage1TriggerRatio` and `stage2TriggerRatio` have hardcoded fallback values of 0.7 and 0.85 respectively. These are critical tuning parameters that may need adjustment based on model context window size, cost sensitivity, or deployment requirements.

**Severity:** medium

**Recommended fix:** Make these configurable via environment variables or runtime configuration:
```typescript
const stage1TriggerRatio = clampRatio(
  options.stage1TriggerRatio ?? parseFloat(env.AA_COMPACTION_STAGE1_RATIO ?? "0.7"),
  0.7
);
```

---

### Issue 5: AgentExecutor Global Singleton With Initialization Race Guard

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/agent-executor.ts`
**Line:** 95-114

**Problem:** `initializeAgentExecutor` uses a global singleton pattern with `executorContext` and `isInitializing` flag to prevent concurrent initialization. However, the flag check and set are not atomic (lines 107-114), and the initialization creates middleware state that may not be safe for concurrent agent execution across different tasks/tenants.

**Severity:** medium

**Recommended fix:** Consider using a `AsyncLocalStorage` context or per-instance initialization instead of a global singleton for multi-tenant safety. If global state is required, use a proper mutex/lock instead of a boolean flag.

---

### Issue 6: ModelCallProvider BudgetGuard Uses Estimated, Not Actual Costs

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
**Line:** 145, 203-205

**Problem:** The budget reservation uses `estimateLlmCallCost()` for reservation but `estimateActualLlmCallCost()` for settlement. While there's a fallback to estimated cost when actual cannot be determined (`?? estimatedCostUsd`), this means budget tracking may be based on estimates rather than actual API response usage data.

**Severity:** medium

**Recommended fix:** Ensure `estimateActualLlmCallCost` can always extract actual usage from provider responses, or add validation that settlement uses real token counts from `result.usage`.

---

### Issue 7: src/runtime/agent-runtime Directory Empty

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/runtime/agent-runtime/index.ts`
**Line:** 1-34

**Problem:** The `src/runtime/agent-runtime/index.ts` file only re-exports from `../../platform/five-plane-execution/execution-engine/` and the directory itself is empty (no implementation files). Per CLAUDE.md, `src/core/runtime` is compatibility-only, but `src/runtime` has no clear purpose or implementation.

**Severity:** low

**Recommended fix:** Either remove the empty `src/runtime/agent-runtime` directory and consolidate all re-exports in `src/core/runtime`, or document the intended purpose of the `src/runtime` layer if it serves a different role than `src/core/runtime`.

---

### Issue 8: Missing Error Handling for Storage Migration Failure

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
**Line:** 133

**Problem:** `storage.migrate()` is called without checking its return value or handling potential migration failure. If migration fails, the code continues to execute with an potentially incompatible schema.

**Severity:** high

**Recommended fix:** Check migration result and wrap in try-catch:
```typescript
const migrationResult = storage.migrate();
if (!migrationResult.success) {
  throw new ValidationError(
    "storage.migration_failed",
    `Database migration failed: ${migrationResult.error}`,
  );
}
```

---

### Issue 9: Hardcoded Token Budget in ModelCallProvider Middleware Hook

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
**Line:** 360

**Problem:** The middleware hook's `createCompletion` call uses hardcoded `maxTokens: 4096` regardless of the actual model's context window or the specific request requirements.

**Severity:** medium

**Recommended fix:** Make maxTokens configurable:
```typescript
const result = await provider.createCompletion({
  model,
  messages,
  maxTokens: request.maxTokens ?? provider.getDefaultMaxTokens(),
});
```

---

### Issue 10: Loop Detection TTL Comment References Non-Existent C-11

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/loop-detection.ts`
**Line:** 85, 103

**Problem:** Comments reference "C-11" pattern (lines 85, 103, 381, 395) but there's no corresponding ADR entry for this pattern. The TTL-based eviction logic is implemented correctly but lacks architectural documentation.

**Severity:** low

**Recommended fix:** Document the loop detection memory management approach in an ADR, or rename the comment tag to something project-specific like "MEM-02" for consistency.

---

### Issue 11: No ADR Entries for Implemented Patterns

**File:** Multiple files

**Problem:** Several significant patterns are implemented without corresponding ADR entries:
- R4-26/R4-27: HarnessRun canonical execution tracking
- R4-28: Cost event WAL (INV-COST-001)
- G9: KV Cache prefix support in context compaction
- Loop detection TTL-based eviction (C-11)

**Severity:** medium

**Recommended fix:** Create ADR entries documenting:
1. The harness run lifecycle and its role in canonical execution
2. The cost event WAL pattern for crash recovery
3. The three-layer prompt partitioning (KV cache) design
4. The loop detection memory management strategy

---

### Issue 12: ContextCompactionService Requires Db/Store but Stores No Reference

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/context-compaction-service.ts`
**Line:** 110-114

**Problem:** The class stores `db` and `store` references but uses `this.store.dispatch.listMessagesBySession()` (line 131) which assumes a `dispatch` property exists on the store. If the store implementation changes, this will fail silently or throw a runtime error.

**Severity:** medium

**Recommended fix:** Add a check or document the store interface requirement:
```typescript
if (!("dispatch" in this.store) || typeof this.store.dispatch.listMessagesBySession !== "function") {
  throw new RuntimeError("store.dispatch_interface_required", "...");
}
```

---

### Issue 13: Missing Null Check for StreamBridge.createStreamId

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
**Line:** 338

**Problem:** `streamBridge.createStreamId()` return value is used directly without null checking. If the method returns null (e.g., on error), downstream `streamBridge.replayAfterSequence(streamId, 0)` calls will fail.

**Severity:** medium

**Recommended fix:** Add null check:
```typescript
const streamId = streamBridge.createStreamId(taskId, "cli");
if (streamId === null) {
  throw new RuntimeError("stream.bridge.create_failed", "Failed to create stream for task", { taskId });
}
```

---

### Issue 14: Single-Task-Execution Just Re-Exports

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/single-task-execution.ts`
**Line:** 1-8

**Problem:** This file simply re-exports from `single-task-happy-path.js` with no added value. If this is meant to be a stability layer for single-task execution, it should have concrete implementation or documentation explaining its role versus `multi-step-orchestration.ts`.

**Severity:** low

**Recommended fix:** Either remove the indirection and import directly from `single-task-happy-path.ts`, or add implementation that handles single-task specific logic.

---

### Issue 15: Queue Adapter Re-Exports Non-Existent Module

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/core/runtime/queue-adapter.ts`
**Line:** 1

**Problem:** The file attempts to export from `"../../platform/five-plane-execution/queue/queue-adapter.js"` but the path shows `queue-adapter.js` instead of the expected `index.js`. This may be a typo or indicate the file doesn't exist at the expected location.

**Severity:** critical

**Recommended fix:** Verify the correct path for queue adapter exports and fix the import path. Check if `five-plane-execution/queue/` directory exists and contains the expected exports.

---

## Module: interaction

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/` - primary location

Subdirectories reviewed: `nl-gateway`, `goal-decomposer`, `proactive-agent`, `autonomy`, `dashboard`, `ux`.

---

## Issue 1

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/nl-gateway-support.ts`  
**Line:** 516-530  
**Problem:** `buildRiskPreview()` has a dead code block in the dry-run execution path. Lines 519-524 set `dryRunResult` with hardcoded values and `// Note: In production, this would be awaited` but the result is never actually used - the function falls through to keyword-based assessment. The R9-41 comment suggests this was intended to be async but was implemented incompletely.  
**Severity:** medium  
**Recommended fix:** Either implement the async dry-run path fully in `buildRiskPreviewWithDryRun` (which correctly awaits), or remove the dead `dryRunResult` assignment in `buildRiskPreview` and document that keyword-based assessment is the fallback.

---

## Issue 2

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/nl-gateway-support.ts`  
**Line:** 467-482  
**Problem:** `deriveConversationState()` uses `confirmationRequired` as a signal but the logic can produce unexpected mappings. When `blockedByPolicy=true`, it returns `"Clarifying"` but this ignores the case where `blockedByPolicy` is true and `requiresClarification` is also true - the latter takes precedence. The function's truth table is not documented.  
**Severity:** medium  
**Recommended fix:** Document the full decision matrix for conversation state transitions. Consider extracting to a lookup table or switch expression that explicitly handles all combinations of `requiresClarification`, `confirmationRequired`, and `blockedByPolicy`.

---

## Issue 3

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/disambiguation-handler/index.ts`  
**Line:** 47-52  
**Problem:** `DEFAULT_DISAMBIGUATION_CONFIG` uses `threshold: 0.7` and `lowConfidenceThreshold: 0.5`, but `nl-gateway-config-loader.ts` line 156 sets the clarification threshold to `0.80` as a fix for §39.6. The disambiguation handler's default does not match the NL gateway's default, creating a zone of doubt between 0.70-0.79 where disambiguation may not trigger despite the higher gateway threshold.  
**Severity:** high  
**Recommended fix:** Align `DEFAULT_DISAMBIGUATION_CONFIG.threshold` with the NL gateway default of 0.80, or make the disambiguation handler accept threshold configuration from the NL gateway config.

---

## Issue 4

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/intent-parser/index.ts`  
**Line:** 130-134  
**Problem:** The single-word approval detection at line 132 has a regex `/approve|审批|通过|批准/i` but the message length check `message.trim().length < 10` does not account for multi-byte characters. A 7-character Chinese string like "审批通过" (4 bytes per char in UTF-8) would pass the length check but the regex requires English "approve" which is at least 7 ASCII chars, so no false positive. However, the logic is fragile - a 9-character Chinese approval phrase like "请审批通过" (5 chars) would trigger the short-circuit at higher confidence than the general intent signals.  
**Severity:** low  
**Recommended fix:** Add explicit handling for Chinese approval phrases in the short-circuit condition, or document the assumption that short messages with approval intent should default to `approval_action` regardless of locale.

---

## Issue 5

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/goal-decomposer/index.ts`  
**Line:** 238-241  
**Problem:** The anti-multiplication guard `decomposedGoalIds` is an in-memory Set. If `GoalDecompositionService` is instantiated multiple times (e.g., in separate request handlers), each instance has its own Set and the guard provides no protection against duplicate decomposition across instances. The decomposition result is also not shared, so callers could get different task graphs for the same goal.  
**Severity:** high  
**Recommended fix:** Make the anti-multiplication guard shared (e.g., via a static Map or external registry), or document that `GoalDecompositionService` must be a singleton. Consider adding an idempotency key check in the return path that validates against a distributed store.

---

## Issue 6

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/goal-decomposer/index.ts`  
**Line:** 465-508  
**Problem:** `detectTemplate()` first checks `domainRecipes` (via `matchDomainRecipe`), then falls through to `domainRecipeService.matchRecipe()`, then falls through to regex patterns. The regex patterns use broad keywords like `/campaign|marketing|广告|投放|素材|营销|推广/i` which can match incidental mentions rather than intentional template selection. A casual mention of "marketing" in a non-marketing goal description could trigger the `marketing_campaign` template incorrectly.  
**Severity:** medium  
**Recommended fix:** Raise the specificity of regex pattern matching. Require at least 2 matching keywords from distinct categories before assigning a template, or weight the recipe/service match significantly higher than regex fallthrough.

---

## Issue 7

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/goal-decomposer/index.ts`  
**Line:** 415-418  
**Problem:** The cycle detection throws an error after `graphAnalysis` is computed, but the error message only contains `goal.goalId` and not the specific cycle path. A developer debugging a cycle would need to reconstruct the cycle from the task graph to understand which edges caused it.  
**Severity:** medium  
**Recommended fix:** Include the cycle node IDs in the error message: `throw new Error(\`goal_decomposer.cycle_detected:${goal.goalId}:${graphAnalysis.cycleNodes.join("->")}\`);` where `cycleNodes` is derived from `topologicallySortedTaskIds.length !== taskIds.length`.

---

## Issue 8

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/proactive-agent/index.ts`  
**Line:** 417-419  
**Problem:** The autonomy level check for firing triggers requires `this.currentAutonomyLevel !== "semi_auto" && this.currentAutonomyLevel !== "full_auto"`. This means triggers only fire when autonomy is `semi_auto` or `full_auto`. But `suggestion` and `supervised` levels block firing. The logic is inverted - it reads as "if NOT suggestion AND NOT supervised", meaning "if semi_auto or full_auto". This is correct for the intended behavior but the condition is confusingly named and not documented.  
**Severity:** medium  
**Recommended fix:** Rename the reason code to `proactive_agent.autonomy_level_insufficient` and add a comment explaining that only `semi_auto` and `full_auto` autonomy levels permit trigger firing.

---

## Issue 9

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/proactive-agent/schedule-manager/index.ts`  
**Line:** 17-22  
**Problem:** `shouldRunScheduleTrigger()` compares `Date.parse(nowIso) - Date.parse(lastFiredAt) >= parseDurationMs(cooldown)`. `Date.parse` is legacy API and may produce different results across Node.js versions for non-ISO date strings. The function also assumes `nowIso` and `lastFiredAt` are in ISO format, but the function signature does not enforce this via type checking.  
**Severity:** low  
**Recommended fix:** Use `new Date(nowIso).getTime()` and `new Date(lastFiredAt).getTime()` consistently, or document the expected date format contract. Consider adding a validation step that throws if dates cannot be parsed.

---

## Issue 10

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/autonomy/autonomy-service.ts`  
**Line:** 42-53  
**Problem:** `resolveLevel()` uses a simple threshold-based mapping (`riskScore >= 80 → manual`, `>= 60 → supervised`, etc.) that does not account for domain-specific risk adjustments. The `AutonomyLevelRequest` includes `taskType` which is never used in the level determination. High-risk task types like `approval_action` or `deploy` should potentially have elevated autonomy requirements beyond the generic risk score.  
**Severity:** medium  
**Recommended fix:** Integrate `taskType` into the autonomy level determination. Add a task-type risk multiplier or domain-specific override table that adjusts the effective risk score before applying the threshold logic.

---

## Issue 11

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/autonomy/autonomy-governance-service.ts`  
**Line:** 40-42  
**Problem:** `canPromote()` uses `compareAutonomyLevels(targetLevel, this.getMaxAutonomyLevel(agentId)) <= 0`. This correctly checks that `targetLevel` is not higher than the agent's max autonomy, but the comparison is off-by-one in the index-based comparison. If `targetLevel` equals maxAutonomy (same level), `compareAutonomyLevels` returns 0, and `0 <= 0` is true, meaning an agent can "promote" to their current level (a no-op). This is not harmful but could mask actual logic errors.  
**Severity:** low  
**Recommended fix:** Clarify the boundary condition: `compareAutonomyLevels(targetLevel, maxAutonomy) < 0` means strictly lower autonomy, `compareAutonomyLevels(targetLevel, maxAutonomy) <= 0` means equal or lower. The current logic correctly permits promotion to the same level (no-op) but this should be documented.

---

## Issue 12

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/autonomy/trust-scorer/index.ts`  
**Line:** 42-52  
**Problem:** `applyTrustDecay()` applies exponential decay with a fixed `decayRate` of 0.05 per day. The formula `score * Math.pow(1 - decayRate, inactiveDays)` means that after 180 days of inactivity, a score of 100 becomes approximately 0 (full decay). The TrustDecayWorker also has a 180-day threshold but these are not connected - the worker calls `applyTrustDecay` but the decay rate and threshold are independently defined.  
**Severity:** medium  
**Recommended fix:** Connect the `NO_EXECUTION_DEMOTION_THRESHOLD_DAYS` constant to the decay rate calculation. If the threshold is 180 days, the decay rate should be calibrated so that at exactly 180 days, the score reaches the demotion threshold (e.g., suggestion level ≈ 30). Alternatively, compute the decay rate required to reach the target score at the threshold.

---

## Issue 13

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/dashboard/dashboard-websocket-server.ts`  
**Line:** 369-376  
**Problem:** `assertRequiredIdentity()` throws on missing `principal` or `tenantId` but the error messages are generic ("Principal is required", "Tenant ID is required"). In a security-sensitive context, this makes it difficult to distinguish which field failed in logs without capturing the actual values.  
**Severity:** low  
**Recommended fix:** Include a sanitized error code that indicates which field was missing without leaking the value. For example: `throw new Error("nl_gateway.identity_required:principal_missing")` and `throw new Error("nl_gateway.identity_required:tenantId_missing")`.

---

## Issue 14

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/dashboard/dashboard-projection-service.ts`  
**Line:** 444-452  
**Problem:** `scheduleEmit()` sets a debounce timer but the callback only clears the timer and emits nothing. The comment says "In real implementation, this would emit to WebSocket clients / For now, deltas are consumed via consumePendingDeltas()". This means the debounce mechanism has no effect - deltas are immediately available via `consumePendingDeltas()` without waiting for the debounce period.  
**Severity:** medium  
**Recommended fix:** Either implement the debounce emit path properly (deltas are held until the timer fires), or remove the debounce timer and `scheduleEmit()` entirely to avoid confusion. Document whether the debounce is a planned future feature or dead code.

---

## Issue 15

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/ux/ux-event-tracking-service.ts`  
**Line:** 106-108  
**Problem:** `maxEventLogSize` is set to 1000 but the trimming logic at lines 136-137 uses `this.eventLog.splice(0, this.eventLog.length - this.maxEventLogSize)`. For an event log of exactly 1001 entries, this removes 1 entry (splice(0, 1000)), leaving 1001 - 1000 = 1 entry. For 2000 entries, it removes 1000, leaving 1000. The intent is to keep the most recent `maxEventLogSize` entries, but the splice removes the oldest `this.eventLog.length - this.maxEventLogSize` entries. This is correct. However, the trim only happens after a push exceeds the limit, not proactively.  
**Severity:** low  
**Recommended fix:** The behavior is correct but consider using `this.eventLog.splice(0, this.eventLog.length - this.maxEventLogSize)` only when `this.eventLog.length > this.maxEventLogSize` to avoid unnecessary array allocation on every trim check.

---

## Issue 16

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/ux/conversation-history-service.ts`  
**Line:** 153-156  
**Problem:** The `isRestricted` flag is checked at line 154 before persisting, but the session's `isRestricted` flag is captured at the time of `addTurn()`. If a turn is added when the session is not restricted, but the session later becomes restricted (e.g., user escalates to a regulated domain), subsequent calls to `completeSession()` or `abandonSession()` correctly see `session.isRestricted` but the previously-persisted turns remain in memory.  
**Severity:** medium  
**Recommended fix:** Add a timestamp or version field to the session record so that restricted flag changes can be audited. Consider adding a cleanup pass when a session becomes restricted that explicitly removes prior non-restricted turns from the memory store if regulatory requirements demand it.

---

## Issue 17

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/ux/wizard/index.ts`  
**Line:** 78-83  
**Problem:** `goBackWizard()` pops from `history` but does not update `visitedStepIds`. The `advanceWizard()` function at line 92 correctly updates `visitedStepIds` with both current and next step IDs, but `goBackWizard` only updates `currentStepId` and `history`. This could cause `getWizardProgress()` to report inconsistent `visitedSteps` count.  
**Severity:** medium  
**Recommended fix:** Add `visitedStepIds` update to `goBackWizard()`: when going back, the previous step is still visited, so it should remain in `visitedStepIds`. The `visitedStepIds` set only grows, never shrinks, so going back should not remove entries.

---

## Issue 18

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/ux/onboarding/index.ts`  
**Line:** 165-170  
**Problem:** `resolveMode()` and `buildOnboardingPlan()` compute domain recommendations independently using different keyword matching approaches. `resolveMode()` uses the `recommendDomains()` private method, while `buildOnboardingPlan()` also calls `recommendDomains()`. The keyword scoring signals in `recommendDomains()` include `userModeBonus` but `resolveMode()` calls it without passing a `context.userMode`, making the bonus unreachable in the initial mode detection.  
**Severity:** medium  
**Recommended fix:** Ensure `resolveMode()` passes the `UserPortalContext` with `userMode` populated when calling `recommendDomains()`, or document that mode detection does not benefit from user mode hints.

---

## Issue 19

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/ux/workflow-builder-service.ts`  
**Line:** 624-668  
**Problem:** `validateGraph()` performs cycle detection via DFS with explicit visited/stack sets, which is correct. However, the cycle detection only runs when `validateGraph()` is called, and `validateGraph()` is called after `builder` is already constructed at line 710. The cycle check is not integrated into the graph building process itself - cycles could exist in the builder canvas before validation is invoked.  
**Severity:** medium  
**Recommended fix:** Integrate cycle detection into `build()` before returning `WorkflowBuilderResult`, or at minimum ensure `validateGraph()` is always called and its messages are propagated to the caller even if `nextStepAllowed` is true.

---

## Issue 20

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/nl-gateway-model.ts`  
**Line:** 69-71  
**Problem:** `IntentParseResult` has `riskClassification` as an optional property (line 74-78 shows it with `?`), but in `nl-gateway-support.ts` line 386, the `riskClassification` is always spread from `classifyRisk()`. The type should not be optional since the classification is always computed.  
**Severity:** low  
**Recommended fix:** Make `riskClassification` a required field in `IntentParseResult` since `parseDetailed()` always populates it via `classifyRisk()`.

---

## ADR Gaps Identified

1. **No ADR for NL Gateway clarification threshold divergence** - The NL gateway config loader sets `threshold: 0.80` per §39.6, but the disambiguation handler defaults to `0.70`. These need to be synchronized or the relationship documented.

2. **No ADR for goal decomposition anti-multiplication guard scope** - The `decomposedGoalIds` Set is in-memory and instance-scoped. The decision for guard scope (in-process vs distributed) should be documented.

3. **No ADR for proactive trigger autonomy level coupling** - The autonomy level in `ProactiveAgentService` (`currentAutonomyLevel`) directly controls whether triggers can fire, but there is no documented policy for how autonomy level changes should propagate to trigger behavior.

4. **No ADR for conversation history restricted session handling** - The R5-31 `isRestricted` flag prevents persistence but does not retroactively clean prior turns. The policy for regulated data retention across session lifecycle transitions needs documentation.

5. **No ADR for UX event tracking data retention** - The `UxEventTrackingService` event log is capped at 1000 entries but there is no documented policy for how long analytics events should be retained or whether they are eligible for subject access requests (GDPR/etc).

6. **No ADR for wizard session state durability** - `WizardSession` can be serialized/deserialized but the durable storage contract is not defined. If a user is mid-wizard and the session is lost, there is no recovery mechanism documented.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 4     |
| Medium   | 12    |
| Low      | 4     |
| **Total**| 20    |

**ADR Gaps:** 6 identified

The most impactful issues are:
- The in-memory anti-multiplication guard in `GoalDecompositionService` providing no cross-instance protection (high)
- The threshold divergence between NL gateway config (0.80) and disambiguation handler defaults (0.70) creating a clarification gap (high)
- The autonomy level gating of trigger firing with inverted logic that is not documented (high)
- The dead debounce timer in `DashboardProjectionService` that holds no functional purpose (medium)

## Module: documentation

### Issue 1: Architecture Entry Point Severely Unbalanced Between zh and en

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/architecture/00-platform-architecture.md`  
**Severity:** critical

**Problem:** The Chinese `00-platform-architecture.md` is only 18 lines - a bare index pointing to an archived monolith file. The English version has 8320 lines with full content. This creates an extreme disparity where:
- English docs provide ~8000+ lines of architecture content
- Chinese docs provide only 18 lines of index

The Chinese README.md itself (line 3) states: "历史 711KB 单体架构文档已归档到 `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md`" but this archive file exists only in docs_zh, while the English version has the actual architecture content inline.

**Recommended fix:** Ensure the Chinese architecture documentation is translated and contains the same architectural content as the English version, or document the decision to keep it as a short index with links to translated section documents.

---

### Issue 2: ADR-002 Status Inconsistency Between Chinese and English

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/adr/002-division-system.md` vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/adr/002-division-system.md`  
**Severity:** critical

**Problem:** 
- Chinese version (line 20): `- 状态：Partially Superseded by DomainDescriptor + BusinessPack Baseline`
- English version (line 20): `- Status: Accepted`

The ADR index in `docs_zh/adr/README.md` (line 10) also shows ADR-002 as "Accepted" while the actual file shows "Partially Superseded". The ADR README status column does not match the actual file header status.

**Recommended fix:** Align the status fields and verify all 110 ADRs have matching status values between the README index and the actual file headers in both languages.

---

### Issue 3: Missing Migration Guideline Documents in English

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/migrations/`  
**Severity:** high

**Problem:** The `docs_en/migrations/` directory is missing:
- `00-migration-guideline.md`
- `01-migration-scope.md`

These files exist in `docs_zh/migrations/` and are referenced in the main README.md reading order. The English documentation cannot follow the recommended reading path.

**Recommended fix:** Translate and add the missing migration guideline documents to `docs_en/migrations/`.

---

### Issue 4: OAPEFLIR Section Header Translation Inconsistency in ADR-083

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/adr/083-proactive-agent-and-progressive-autonomy.md`  
**Severity:** medium

**Problem:** The Chinese version uses "OAPEFLIR 关联" while English uses "OAPEFLIR Relationship" as the section header. This is consistent with other ADRs. However, the ADR README.md files state that index/status/date must be kept synchronized. The inconsistency in this case appears minor but the pattern suggests translation inconsistency across ADRs.

**Recommended fix:** Establish a translation glossary for standard ADR section headers and ensure consistent translation across all ADRs.

---

### Issue 5: ADR-057 Content Length Mismatch

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/adr/057-external-system-integration-framework.md` (2110 bytes) vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/adr/057-external-system-integration-framework.md` (1754 bytes)  
**Severity:** medium

**Problem:** The Chinese version is larger than the English version. A diff shows the Chinese has more complete content including a table in lines 14-19. The English version appears to be a truncated translation or original that is missing content.

**Recommended fix:** Verify that the English ADR-057 contains the complete translated content and is not missing the integration patterns table.

---

### Issue 6: Reference Directory Contents Differ

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/reference/` vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/reference/`  
**Severity:** low

**Problem:** 
- `docs_zh/reference/division-catalog.md` exists but `docs_en/reference/` does not have this file
- `docs_zh/quality/00-full-coverage-test-manual-append.md` exists in English but Chinese equivalent does not exist

These are minor asymmetries in reference material availability.

**Recommended fix:** Determine if these files should be translated and added to the opposite language directory.

---

### Issue 7: Operations Directory - review-closure-board.md Missing in Chinese

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/operations/`  
**Severity:** low

**Problem:** `docs_en/operations/review-closure-board.md` exists but has no Chinese equivalent. This file appears to be an operational process document.

**Recommended fix:** Either translate and add to Chinese operations or document why it is English-only.

---

### Issue 8: Architecture Sub-Directory v3.0-domain-research.md Exists Only in English

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/architecture/v3.0-domain-research.md`  
**Severity:** low

**Problem:** This 1917-line file exists only in docs_en/architecture/ and has no Chinese counterpart. Given the size, this appears to be substantial domain research content.

**Recommended fix:** Translate this document or move it to a shared location accessible to both language documentation sets.

---

### Issue 9: OAPEFLIR v4.4 Executable Spec Size Mismatch

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/architecture/oapeflir-v4.4-executable-spec.md` (2361 lines) vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/architecture/oapeflir-v4.4-executable-spec.md` (2577 lines)  
**Severity:** medium

**Problem:** The English version has 216 more lines than Chinese. This suggests incomplete translation of the OAPEFLIR executable specification document.

**Recommended fix:** Verify and complete the Chinese translation of the OAPEFLIR v4.4 executable specification.

---

### Issue 10: ADR README.md States Synchronization Requirement Not Enforced

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/adr/README.md` (line 4) and `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/adr/README.md` (line 4)  
**Severity:** medium

**Problem:** Both README files state: "docs_zh/adr/README.md and docs_en/adr/README.md must keep ADR numbers, status, and dates aligned; if body translation lags, track it under docs_zh/reference/docs-sync.md". 

However:
1. ADR-002 status differs (Partially Superseded vs Accepted)
2. The docs-sync.md file exists in both reference directories but may not be actively tracking translation status

**Recommended fix:** 
1. Fix ADR-002 status discrepancy immediately
2. Review docs-sync.md to ensure it accurately reflects translation progress
3. Implement a periodic audit to verify ADR synchronization

---

### Issue 11: No ADR Documentation for Key Architectural Decisions Found in Code

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/delegation-request/index.ts` (line 17)  
**Severity:** medium

**Problem:** Code references "ADR-026 8-factor budget tracking" but no ADR-026 exists in the documentation. The ADR index skips from 025 to 027. This indicates an architectural decision was made without proper ADR documentation, or the ADR was deleted/moved without updating references.

**Recommended fix:** Either create ADR-026 documenting the 8-factor budget tracking model, or update the code reference to point to the correct ADR number if it was renamed.

---

### Issue 12: Architecture Document Cross-References Use Mixed Path Formats

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/architecture/00-platform-architecture.md` (lines 7-11)  
**Severity:** low

**Problem:** The index file uses paths like `docs_zh/reviews/issues-table.md` with language prefix, but if the architecture content is meant to be language-neutral, cross-references should potentially use relative paths without language prefixes.

**Recommended fix:** Standardize cross-reference format - if docs are meant to be independently maintained in each language, keep current format; if they share content, use language-neutral references.

---

### Issue 13: ADR-004 Status Shows "Partially Superseded" But README Index Shows "Accepted"

**File:** Multiple ADR files and `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/adr/README.md`  
**Severity:** medium

**Problem:** ADR-004 file header shows "Partially Superseded" but the ADR index in README.md shows "Accepted" for entry 004 (line 14). This inconsistency exists for multiple ADRs.

**Recommended fix:** Run a systematic comparison of all 110 ADR file header statuses against the README index and fix discrepancies.

---

### Issue 14: Quality Directory Has Asymmetric Content

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/quality/` vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/quality/`  
**Severity:** low

**Problem:** 
- English has `00-full-coverage-test-manual-append.md` that Chinese doesn't have
- This creates an incomplete testing handbook in Chinese

**Recommended fix:** Translate and add missing quality documents to Chinese documentation.

---

### Issue 15: ADR Index Documents 8 ADR Numbers That Don't Have Corresponding Files

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/adr/README.md` (lines 55-56)  
**Severity:** high

**Problem:** The ADR index lists ADR-046, ADR-047, ADR-048, etc. but the actual files for ADR-045 (if it exists) and continuity of numbering should be verified. Earlier investigation showed both zh and en have 110 files, but the index structure shows gaps.

**Recommended fix:** Verify the count: ls showed 110 files including README.md, so 109 ADRs + 1 README. The index shows numbers 001-112 with some gaps. Confirm all listed ADRs have corresponding files.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 4     |
| Medium   | 7     |
| Low      | 5     |
| **Total**| 18    |

**Most Impactful Issues:**

1. **Architecture Entry Point Disparity (Critical)** - The 8000+ line gap in the main architecture document means English documentation provides comprehensive architecture guidance while Chinese provides only an index pointer.

2. **ADR-002 Status Inconsistency (Critical)** - Different status values between Chinese and English versions, and between file header and index, violates the documented synchronization requirement.

3. **Missing Migration Documents in English (High)** - The recommended reading path in English README cannot be followed due to missing migration guideline files.

4. **ADR-026 Missing (High)** - Code references an ADR that doesn't exist, indicating either a documentation gap or stale reference.

**Root Cause Analysis:**

The documentation drift appears to stem from:
1. The architecture index in Chinese was intentionally kept short (monolith archived) while English was expanded
2. Translation of new ADRs (083, 057) and migration docs was not completed before syncing
3. No automated validation exists to detect status/header mismatches between zh and en ADRs
4. The docs-sync.md mechanism mentioned in ADR README is not being actively maintained

**Recommended Priority Actions:**

1. Resolve ADR-002 status discrepancy immediately (both file header and index alignment)
2. Translate missing migration documents to English
3. Complete ADR-057 English translation (content length mismatch)
4. Review and align architecture documentation strategy (index-only vs full content)
5. Create ADR-026 for 8-factor budget tracking or fix stale code reference
6. Implement ADR synchronization validation in CI/CD

---

## Module: platform/five-plane-execution

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/` - primary execution module

Subdirectories reviewed: `execution-engine/`, `dispatcher/`, `worker-pool/`, `recovery/`, `state-transition/`, `lease/`.

Key files reviewed:
- `execution-engine/multi-step-orchestration.ts` - main orchestration entry point
- `execution-engine/multi-step-supervisor.ts` - step execution loop
- `state-transition/transition-service.ts` - entity state transition coordination
- `worker-pool/execution-worker-writeback-service.ts` - worker result writeback
- `dispatcher/execution-dispatch-service.ts` - ticket dispatch to workers
- `lease/execution-lease-service.ts` - execution lease management
- `runtime-state-machine.ts` (shared) - aggregate state machine
- `budget-allocator.ts` - budget reservation/settlement
- `compensation-manager.ts` - side effect compensation
- `side-effect-manager.ts` - side effect lifecycle
- `reconciliation-worker.ts` - ambiguous side effect reconciliation
- `recovery/runtime-recovery-service.ts` - recovery analysis
- `execution-engine/loop-detection.ts` - doom loop prevention
- `execution-engine/effect-buffer.ts` - post-transaction side effects

---

## Issue 1

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Line:** 424-499  
**Problem:** Budget reservation path has a conditional: if `ledgerRow` is found, it reserves budget and updates the ledger. However, if `ledgerRow` is undefined (e.g., ledger doesn't exist yet), the code silently skips reservation without any error or fallback. The task continues without budget protection, which violates R4-27 (INV-RUN-001) requirements for canonical execution tracking.  
**Severity:** high  
**Recommended fix:** If `ledgerRow` is null/undefined, either create the ledger on demand or throw a `ValidationError` with code `budget_ledger.not_found`. Do not silently skip budget reservation - the harness run requires a ledger to track execution costs.

---

## Issue 2

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Line:** 587-618  
**Problem:** `transitionTaskTerminalState()` is called with `lastExecutionId` which is derived from `store.execution.listExecutionsByTask(taskId).at(-1)`. If no execution exists for the task, `lastExecution?.id` would be `undefined` and fallback to `newId("exec")`. However, the transition service's `applyTaskTerminalState()` expects a valid executionId for the CAS update of execution status. An execution record may not exist if the task failed before any execution was created, causing `execution.transition_cas_failed` error.  
**Severity:** high  
**Recommended fix:** Before calling `transitionTaskTerminalState()`, verify that at least one execution record exists. If no executions exist, do not attempt to transition execution status - only transition task, workflow, and session. Add a guard: `if (!lastExecution && shouldTransitionExecution) { throw new Error("task.no_execution_record"); }`

---

## Issue 3

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/state-transition/transition-service.ts`  
**Line:** 441-558  
**Problem:** `TaskTerminalTransitionService.apply()` calls `workflowStateMachine.assertTransition()` before checking if `shouldTransitionWorkflow`. If `shouldTransitionWorkflow` is false (workflow is null), but the workflow status is "running", the assertTransition would throw before the null check prevented the update. The logic ordering is correct (assertTransition only runs when shouldTransitionWorkflow is true), but the error message for the workflow transition path in lines 496-512 could collide with the early CAS check.  
**Severity:** medium  
**Recommended fix:** Add a debug log or comment clarifying that `assertTransition` is only called after `shouldTransitionWorkflow` is confirmed true, and that the subsequent `updateWorkflowStateCas` also validates fromStatus. This double-check is intentional but needs documentation.

---

## Issue 4

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/state-transition/transition-service.ts`  
**Line:** 102-116 (TaskTransitionService.apply)  
**Problem:** `TaskTransitionService.apply()` performs a CAS update using `updateTaskStatusCas()` which returns `affected === 0` on failure. If the transition fails due to concurrent modification, the method throws an error but does NOT roll back any other state changes made in the same transaction block. However, looking at the caller chain, `transition()` wraps `apply()` in `db.transaction()`, so the entire transaction would roll back. The danger is that `apply()` is also called directly (bypassing `transition()`) in some code paths, where it would not be wrapped in a transaction.  
**Severity:** high  
**Recommended fix:** In `TaskTransitionService.apply()`, wrap the CAS update and event emission in `this.db.transaction()` consistently, even when called directly. Never allow a failed CAS update to emit an event while leaving the database in an inconsistent state. The `apply()` method should always manage its own transaction boundary for atomicity.

---

## Issue 5

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.ts`  
**Line:** 334-343  
**Problem:** The writeback service extracts `taskOutputJson` and `outputsJson` from either the writeback input or the existing records: `const taskOutputJson = input.taskOutputJson ?? task.outputJson ?? "{}"`. If both input and task record have null values, it defaults to `"{}"`. However, this JSON string `"{}"` is later passed to `transitionTaskTerminalState()` which expects valid JSON or null. An empty object `{}` may not be the correct default when both source values are null - it should perhaps be `null` to indicate no output was produced, or the transition should validate this case.  
**Severity:** medium  
**Recommended fix:** Clarify the default behavior: if no output was produced (both inputs are null), use `null` rather than `"{}"`. Update the null-coalescing chain to: `input.taskOutputJson ?? task.outputJson ?? null` and ensure downstream code handles `null` correctly.

---

## Issue 6

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.ts`  
**Line:** 579-598  
**Problem:** The catch block at line 579 catches all errors and maps them to either `"invalid_terminal_transition"` (if message contains "invalid_transition") or `"authoritative_store_unavailable"`. This blanket mapping could hide real bugs. For example, a `RangeError`, `TypeError`, or security exception would be silently mapped to store errors, causing incorrect diagnostic attribution.  
**Severity:** high  
**Recommended fix:** Log the actual error with its stack trace before mapping. Distinguish between state machine errors (expected) and programming errors (unexpected). Consider a catch block that re-throws unexpected errors while only absorbing expected ones.

---

## Issue 7

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`  
**Line:** 269-310  
**Problem:** When backpressure blocks a ticket, two near-identical event records are emitted in the same transaction: `dispatch:backpressure_rejected` (line 276) and `dispatch.backpressure_rejected` (line 292). The event names differ only in namespace separator (`:` vs `.`). Downstream consumers processing both events would see duplicate events for the same logical occurrence, causing double-counting in metrics.  
**Severity:** medium  
**Recommended fix:** Remove the duplicate event emission. Keep only `dispatch:backpressure_rejected` (with colon separator, matching the naming convention for tier-2 events). The `dispatch.backpressure_rejected` variant appears to be a typo or copy-paste error.

---

## Issue 8

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`  
**Line:** 389-440  
**Problem:** The poison pill handling path calls `shouldInvalidatePoisonPill()` and then `invalidatePoisonPillTicket()`. However, between these calls, there is no guarantee that the ticket state hasn't changed (e.g., a worker could claim it). The invalidation logic at line 956 uses `store.worker.invalidateExecutionTicket?.()` which has an optional call - if the method is not implemented on the store, the ticket silently remains active.  
**Severity:** high  
**Recommended fix:** Within `invalidatePoisonPillTicket()`, verify the ticket is still in a state that can be invalidated before proceeding. Check that `ticket.status === "pending"` and that no lease has been granted since the poison pill was detected. If the ticket has been claimed, either skip invalidation or escalate for human review.

---

## Issue 9

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts`  
**Line:** 132-201 (acquireLeaseWithinTransaction)  
**Problem:** The fence token initialization at line 173 uses `getLatestFencingToken(input.executionId) + 1`. If `getLatestFencingToken()` returns 0 (when no prior lease exists), the first lease gets fencing token = 1. However, `validateWriteAccess()` at line 683 compares `input.fencingToken !== activeLease.fencingToken`. This means workers must track the correct fencing token starting from 1. If a lease is created but never used (no writeback), and then a new lease is created, the fencing token increments. This is correct. But the `getLatestFencingToken()` method falls back to `workerStore.getLatestFencingToken?.() ?? 0` - if the store doesn't implement this method, every lease would get token 1, making fencing ineffective.  
**Severity:** high  
**Recommended fix:** Verify that `getLatestFencingToken` is implemented in all worker store implementations. If the method is missing, throw an error rather than silently using 0. A fallback of 0 defeats the entire fencing token mechanism and allows split-brain scenarios.

---

## Issue 10

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts`  
**Line:** 663  
**Problem:** The TTL expiration check `activeLease.expiresAt <= occurredAt` uses `<=` (less-than-or-equal). This means a lease that expires exactly at `occurredAt` is considered expired. However, `expireActiveLeaseIfNeeded()` at line 763 uses `>` (greater-than), meaning a lease that expires exactly at the boundary is NOT auto-expired. The inconsistency could allow a just-expired lease to still be considered "active" for write validation purposes.  
**Severity:** medium  
**Recommended fix:** Use consistent comparison operators. If `<=` is used for validation (meaning "expired if expiresAt <= now"), then `expireActiveLeaseIfNeeded()` should use the same comparison: `Date.parse(activeLease.expiresAt) <= Date.parse(occurredAt)` to expire.

---

## Issue 11

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/runtime-state-machine.ts` (shared module)  
**Line:** 63-65  
**Problem:** `assertAuditRef()` is called in the transition chain but the condition `!hasAuditRef(command.auditRef)` can throw even for transitions that don't require auditing (e.g., budget reservation status updates during normal operation). The audit ref requirement is unconditional for ALL transitions. If the audit ref format changes, all aggregate types fail transitions uniformly.  
**Severity:** medium  
**Recommended fix:** Consider making audit ref optional for non-critical transitions (e.g., budget ledger "reserved" to "settled" transitions could use an internal audit ref format). Add a configuration to the RuntimeStateMachine that controls which aggregate types require audit ref enforcement.

---

## Issue 12

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/budget-allocator.ts`  
**Line:** 218-251 (reserve method)  
**Problem:** In `reserve()`, after creating the result and updating ledgers, the code calls `persistLedger()` for both `input.ledger` and each hierarchy ledger. However, the `reserveBudgetHardCap()` call at line 228 already persists via `reserveBudgetHardCap`. If `persistLedger()` at line 244 uses a CAS update with `expectedVersion = input.expectedVersion`, but `result.ledger.version` may have been incremented by `reserveBudgetHardCap`, creating a mismatch.  
**Severity:** high  
**Recommended fix:** After calling `reserveBudgetHardCap()`, use `result.ledger.version` as the expected version for the subsequent `persistLedger()` call, not `input.expectedVersion`. The version has already been incremented by the reservation, so using the old expected version will cause CAS failures in concurrent scenarios.

---

## Issue 13

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/budget-allocator.ts`  
**Line:** 369-373  
**Problem:** The settle method has: `const expectedVersion = input.expectedVersion ?? input.ledger.version; if (input.ledger.version !== expectedVersion) { throwVersionCasError(...) }`. This checks that the ledger version matches the expected version, but this is redundant with the CAS update that will happen in `persistLedger()`. If `input.expectedVersion` is not provided, it defaults to `input.ledger.version` which always matches, so the check is a no-op. If it IS provided, the check is valid but then `persistLedger` also does a CAS - double check overhead.  
**Severity:** low  
**Recommended fix:** Remove the redundant version check before `persistLedger`. Let `persistLedger` handle the CAS verification. If you want to verify before persisting, at least don't default to the same value - use a distinct check that adds value.

---

## Issue 14

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/effect-buffer.ts`  
**Line:** 109-111 (EffectBuilder constructor)  
**Problem:** The effect builder creates IDs using `Date.now()` for the first part of the ID: `id: 'effect_${Date.now()}_${randomUUID()}'`. If two effects are created within the same millisecond (which is possible in fast code paths), they would have the same `Date.now()` portion, differing only in the UUID. This is fine for uniqueness, but the comment/docstring does not explain this.  
**Severity:** low  
**Recommended fix:** Document that effect IDs are designed to be unique even when created in rapid succession, and that the timestamp portion is for debugging/readability rather than uniqueness guarantees.

---

## Issue 15

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/loop-detection.ts`  
**Line:** 64-67 (normalizeToolInputForHash)  
**Problem:** `normalizeToolInputForHash()` sorts object keys with `Object.keys(input).sort()`. However, JSON.stringify with a custom replacer does NOT guarantee key ordering across all inputs. Some inputs may have already-sorted keys, others may not. Additionally, if the object has nested structures, only the top-level keys are sorted - nested object key order is not normalized.  
**Severity:** medium  
**Recommended fix:** Use a deep normalization approach that sorts keys at all levels, not just top-level. Consider using `JSON.stringify()` with sorted keys or a recursive normalization function.

---

## Issue 16

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/compensation-manager.ts`  
**Line:** 226-268 (executeCompensationSteps)  
**Problem:** `executeCompensationSteps()` iterates through compensation steps and catches errors per step. However, if `executeCompensationStep()` returns `false` (indicating failure), the code sets `finalStatus = "failed"` but does NOT record the error message or stack trace in `evidenceRefs`. The error is caught in the catch block (line 248), but when `success` is `false` from the step execution (not an exception), the error details are lost.  
**Severity:** medium  
**Recommended fix:** When `executeCompensationStep()` returns `false`, capture the failure reason in the evidenceRefs. Add logging or error recording that captures the step type and targetRef that failed, not just the exception stack.

---

## Issue 17

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/side-effect-manager.ts`  
**Line:** 49-53  
**Problem:** `applyReconciliation()` checks for lease and fencing token only when targetStatus is one of `["confirmed", "compensation_required", "compensating", "compensated"]`. However, if the reconciliation result is `"not_found"` with `nextAction = "compensate"`, the target status becomes `"compensation_required"`. But if the side effect is in an early state (e.g., "proposed"), the fencing token check is skipped, which could allow an unlease-protected side effect to be marked for compensation incorrectly.  
**Severity:** high  
**Recommended fix:** Verify the fencing token check applies regardless of the side effect's current status. Consider adding a comment or assertion that the side effect was in a lease-protected state before reconciliation can be applied.

---

## Issue 18

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/reconciliation-worker.ts`  
**Line:** 118-126 (isReconciliationExpired)  
**Problem:** `isReconciliationExpired()` computes `now - createdAt >= window` using `Date.now()` for `now`. However, `reconciliationCreatedAt` is parsed via `new Date(reconciliationCreatedAt).getTime()`. If `reconciliationCreatedAt` is malformed (e.g., `"invalid-date"`), `getTime()` returns `NaN` and `now - NaN = NaN`. `NaN >= window` is `false`, so the reconciliation would never expire. This could cause infinite retry loops for unparseable timestamps.  
**Severity:** high  
**Recommended fix:** Add validation: if `isNaN(createdAtMs)`, return `true` (expired/unparseable) or throw an error with a specific error code `reconciliation.invalid_timestamp`. Do not allow unparseable timestamps to bypass expiry logic.

---

## Issue 19

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`  
**Line:** 555-577 (cost event WAL)  
**Problem:** R4-28 comment says "Write-ahead logging for cost events - persist BEFORE execution" and the code inserts `costEventWAL` with "pending" status before the transaction commits. However, at line 594 inside the transaction, `commitCostEventWAL(costEventId)` is called. If the transaction fails after the WAL insert but before commit (e.g., crash), the pending cost event would remain in the WAL table. The comment mentions "On crash recovery, uncommitted cost events can be detected and cleaned up" but there is no visible cleanup/recovery code in this file for orphaned WAL entries.  
**Severity:** medium  
**Recommended fix:** Add a recovery sweep that cleans up pending WAL entries older than a threshold (e.g., entries where `created_at` is older than the longest possible transaction window). Document the recovery mechanism or point to the sweeper code that handles this.

---

## Issue 20

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`  
**Line:** 79-141 (step loop)  
**Problem:** The step execution loop has two nested structures: an outer `for` loop over `plannedWorkflow.executionSteps` and an inner `for` loop for retry attempts (line 144). However, when a step is skipped due to upstream dependency failure (line 92-140), the code calls `continue` to skip to the next step in the outer loop WITHOUT updating `executionAttemptCounter`. This is correct (skip doesn't count as an attempt), but the `workflowRetryCount` and `workflowLastErrorCode` are not reset for skipped steps.  
**Severity:** low  
**Recommended fix:** When a step is skipped, reset `workflowLastErrorCode = null` to avoid carry-over of previous step errors. Document that skipped steps do not affect retry counts.

---

## Issue 21

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`  
**Line:** 450-502 (lease acquisition and ticket claim)  
**Problem:** The lease acquisition and ticket claim are within a `db.transaction()` block, which is correct for atomicity. However, the code calls `leaseResult = this.leases.acquireLeaseWithinTransaction(...)` which ALSO starts a transaction (line 118 in execution-lease-service). Nested transactions in SQLite work via savepoints, but the logic is complex. If the inner transaction fails and rolls back, the outer transaction continues with an invalid lease result.  
**Severity:** high  
**Recommended fix:** Verify that `acquireLeaseWithinTransaction()` is designed to be called within an already-established transaction boundary. If so, document that the method uses savepoints rather than full transaction nesting. If not, refactor so the outer transaction calls a non-transactional lease acquisition method.

---

## Issue 22

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/state-transition/transition-service.ts`  
**Line:** 196-213 (WorkflowTransitionService.apply)  
**Problem:** `WorkflowTransitionService.apply()` has nested try-catch blocks at lines 197-214. The outer catch at line 210 catches errors and re-throws only if it's not the "unused" sentinel error. This is confusing and the indentation suggests the try-catch was added after initial implementation. The catch at line 206-208 catches `"unused"` errors from `createTier1StatusEvent`. If this sentinel is not thrown by the repository, the outer catch would silently suppress other errors.  
**Severity:** medium  
**Recommended fix:** Replace the nested try-catch with explicit conditional logic. If `createTier1StatusEvent` should only be called in certain cases (not "unused"), add an explicit flag or check BEFORE calling it rather than catching and suppressing sentinel errors.

---

## Issue 23

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/recovery/runtime-recovery-service.ts`  
**Line:** 516-575 (buildCompensationPlan)  
**Problem:** `buildCompensationPlan()` retrieves the task ID using `this.store.task.getTask?.(executionId, tenantId)?.id ?? ""`. This is incorrect - `executionId` is not a task ID, so `getTask(executionId, ...)` would return null or wrong data. The correct approach is to find the task from the execution, not pass the execution ID as a task lookup key. This bug would cause `candidates` to be empty and the compensation plan to be incomplete.  
**Severity:** critical  
**Recommended fix:** Change line 518 to: `const task = this.store.task.getTaskByExecution?.(executionId, tenantId) ?? this.store.task.getTask?.(/* first find execution then task id */, tenantId)` or use the correct repository method that finds the task from execution ID. The compensation plan would be fundamentally broken for any execution.

---

## ADR Gaps Identified

1. **No ADR for budget ledger creation on demand** - When a HarnessRun is created in `runMultiStepOrchestration`, if the budget ledger doesn't exist, the code silently skips reservation. An ADR should specify whether ledgers are created eagerly (during harness run creation) or lazily (on first reservation), and what happens when ledger lookup fails.

2. **No ADR for fencing token fallback behavior** - If `getLatestFencingToken()` is not implemented, the system falls back to token 0, effectively disabling fencing. An ADR should specify that this method is mandatory and must be implemented, or that a no-op fallback with warning is acceptable.

3. **No ADR for cost event WAL recovery** - R4-28 introduced write-ahead logging for cost events but no documented recovery mechanism for orphaned pending entries. An ADR should specify the sweeper cadence and what "orphaned" means in this context.

4. **No ADR for execution terminal state when no execution exists** - `transitionTaskTerminalState()` is called with a potentially undefined executionId when a task fails before creating any execution record. An ADR should specify whether a task without executions can reach terminal state and what the correct behavior is.

5. **No ADR for duplicate event emission in dispatch** - The `dispatch:backpressure_rejected` and `dispatch.backpressure_rejected` duplication suggests no formal event naming convention is enforced. An ADR should define the event naming rules and a linting rule to catch duplicates.

6. **No ADR for lease TTL consistency** - `acquireLeaseWithinTransaction` uses `<=` for expiry check while `expireActiveLeaseIfNeeded` uses `>`. An ADR should standardize the boundary condition for lease expiration to prevent off-by-one issues.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 11    |
| Medium   | 8     |
| Low      | 3     |
| **Total**| 23    |

**ADR Gaps:** 6 identified

**Critical Issue:**
- `buildCompensationPlan()` passes `executionId` to `getTask()` incorrectly, causing broken compensation plan generation for all executions.

**Most impactful issues:**
- The budget ledger fallback silently skipping reservation (high) defeats INV-RUN-001 canonical tracking
- The nested transaction in `acquireLeaseWithinTransaction` (high) could cause silent failures if savepoint behavior is not understood
- The fence token fallback to 0 (high) defeats the entire fencing mechanism for split-brain prevention
- The reconciliation timestamp NaN bypass (high) could cause infinite retry loops
- Missing transaction wrapper in `TaskTransitionService.apply()` (high) could leave DB in inconsistent state

---

## Module: org-governance

### Directory Coverage

Reviewed all files in:
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/` (root files)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/` - approval-routing-service.ts, delegation/, escalation/, route-engine/
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/org-model/` - hr-role-governance-service.ts, org-governance-saga.ts, org-node/, hierarchy/, sync/
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/` - compliance-governance-service.ts, evidence-collector.ts, compliance-exception-workflow.ts, framework-catalog.ts, control-coverage-report.ts, evidence-quality-score.ts, policy-resolver/, audit-enforcer/, inheritance/
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/knowledge-boundary/` - knowledge-boundary-service.ts, knowledge-federator.ts, chinese-wall-access-saga.ts, chinese-wall-policy.ts, boundary-manager/, access-log/, sharing-gate/
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/` - identity-sync-service.ts, group-role-mapping-service.ts, api-key-service.ts, scim-dlq-reconciliation.ts, oidc/, scim-sync/, saml/
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/` - delegated-governance-service.ts, governance-console-service.ts, governance-delegation-revocation-saga.ts, delegation-registry/, scope-manager/, stores/

---

## Critical Issues

### 1. Compliance evidence collector lock timeout race condition

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/evidence-collector.ts`
**Line:** 123-138

**Problem:** `acquireSnapshotLock()` uses a spin-wait loop with a 250ms timeout. Under high contention, multiple processes could be competing for the same lock file. The function calls `openSync(lockPath, 'wx')` which will throw if the file exists. The catch handler only checks for `EEXIST` - any other error (permissions, disk full, etc.) is re-thrown, potentially crashing the collector. The spin loop has no sleep between iterations, meaning it could hammer the filesystem with rapid open attempts during lock contention.

**Severity:** high

**Recommended fix:** Add `setTimeout` or `setImmediate` between retry attempts to reduce CPU spinning. Catch a broader set of transient errors and retry. Add diagnostic logging when lock acquisition times out.

---

### 2. Approval routing service calls `nowIso()` as a function

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/approval-routing-service.ts`
**Line:** 283

**Problem:** `buildAmountSnapshot()` passes `fxEntry.asOf ?? nowIso()` at line 283. However, `nowIso` is imported as a value (from `../../platform/contracts/types/ids.js`), not a function reference. The correct call should be `nowIso()` (with parentheses) to invoke the function. As written, `nowIso` is passed as the raw string result of calling the undefined `asOf` property - this is a runtime error that would cause the FX snapshot capture to use "undefined" as the timestamp, corrupting audit data.

**Severity:** critical

**Recommended fix:** Change `nowIso()` to `nowIso` (removing the parentheses) since `nowIso` is already a function that returns a string, not a property accessor. Or verify the import - if `nowIso` is a string constant rather than a function, remove the call syntax entirely.

---

### 3. OrgGovernanceSaga capability traversal allows unlimited depth

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/org-model/org-governance-saga.ts`
**Lines:** 117-150, 105

**Problem:** `maxTraversalDepth` defaults to 3 (line 105), but the capability traversal loop at lines 126-147 has no early exit if the root org node is reached (`currentNodeId` becomes `null`). The `depth` counter increments on each iteration, but if `maxTraversalDepth` is configured very high or the org tree is deeper than expected, traversal could be slower than necessary. More critically, if `orgNodes` contains a cycle (e.g., a node's parent points to an ancestor creating a loop), the `findNodeWithCapabilities` could loop indefinitely since there's no visited set to detect cycles.

**Severity:** high

**Recommended fix:** Add a `visitedNodeIds` Set to detect cycles and prevent infinite loops. If a cycle is detected, break and return `null` rather than continuing traversal. Add a maximum recursion guard.

---

## High Issues

### 4. Chinese wall policy reset context validation incomplete

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/knowledge-boundary/chinese-wall-policy.ts`
**Lines:** 37-79

**Problem:** `evaluateChineseWallPolicy()` checks `resetContext?.approvedByRole !== "compliance_officer"` at line 41 but doesn't validate that `resetContext?.approvedByRole` is actually a non-empty string. If `approvedByRole` is `""` (empty string), the check `"compliance_officer" !== "compliance_officer"` evaluates to `false`, meaning the reset would be incorrectly allowed. Additionally, the `residualScanCompleted` check only looks for `!== true` but doesn't reject `null` or `undefined` explicitly - while this works correctly, the intent should be clearer.

**Severity:** high

**Recommended fix:** Add explicit validation: `if (resetContext?.approvedByRole === "compliance_officer")` without the negation to avoid empty string bypass. Or add `if (!resetContext?.approvedByRole || resetContext.approvedByRole !== "compliance_officer")` to handle all non-compliant values.

---

### 5. KnowledgeFederator tenant scope comparison logic is inverted

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/knowledge-boundary/knowledge-federator.ts`
**Lines:** 86-93

**Problem:** The tenant check at lines 87-93 evaluates to:
```
(boundaryTenantId != null || sourceTenantId != null)
&& (boundaryTenantId == null || sourceTenantId == null || boundaryTenantId !== requesterTenantId || sourceTenantId !== requesterTenantId)
```
This denies access if BOTH boundary and source have the same tenant ID as the requester, which is backwards. The condition should deny when tenant IDs don't match, not when they DO match. This means a user from tenant A accessing a source from tenant A with boundary from tenant A would be incorrectly denied.

**Severity:** high

**Recommended fix:** Fix the tenant scope comparison to deny when boundary or source tenant doesn't match requester tenant, not when they DO match. The correct logic should be: `if (boundaryTenantId != null && boundaryTenantId !== requesterTenantId) deny;` similar check for source tenant.

---

### 6. IdentitySyncService DLQ retry delay calculation overflow

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/identity-sync-service.ts`
**Lines:** 269-272

**Problem:** `computeRetryDelayMs()` calculates `baseDelayMs * Math.max(retryCount, 1)`. With base delay of 5 minutes (300000ms) and retries up to 3 (line 82: `MAX_DLQ_RETRIES = 3`), the maximum delay is 900000ms (15 minutes). However, if `retryCount` is negative (due to malformed data), `Math.max(retryCount, 1)` returns 1, resulting in the minimum 5 minute delay which is correct. BUT if `retryCount` is 0, `Math.max(0, 1)` = 1 which is correct. The issue is that `record.retryCount` is typed as `number` but could be a negative number from bad data - this is handled but the retry calculation could grow unbounded if called with very large retry counts.

**Severity:** medium

**Recommended fix:** Cap the retry delay at a maximum value (e.g., 1 hour) to prevent runaway backoff. Add validation that `retryCount` is a non-negative integer.

---

### 7. ComplianceGovernanceService exception workflow expiry check off-by-one

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/compliance-governance-service.ts`
**Lines:** 176-180

**Problem:** `getExceptionWorkflow()` checks `expiryDate <= now` which means an exception expiring exactly at `now` is considered expired and returns `null`. This is likely correct behavior (expired means no longer valid). However, the time precision is milliseconds - if `expiresAt` is "2024-01-01T00:00:00.000Z" and `now` is "2024-01-01T00:00:00.000Z" (same instant), the exception is treated as expired. This could cause confusion where an exception that was valid at the start of a second becomes invalid before the end of that same second based on when the check runs.

**Severity:** medium

**Recommended fix:** Add a note explaining the expiring-at-equals behavior is intentional (common in time-based access control - "expires at" means "no longer valid at that instant"). Alternatively, use `<` instead of `<=` if you want the exception to be valid through its expiry moment.

---

### 8. ComplianceExceptionWorkflowEngine expiration parsing allows 0-duration

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/compliance-exception-workflow.ts`
**Lines:** 280-298

**Problem:** `parseIsoDurationMs()` returns `null` if `totalMs <= 0` (line 297). In `calculateExpiration()` at line 234-240, if `parsedDurationMs` is `null`, the code falls back to `90 * 24 * 60 * 60 * 1000` (90 days). This is fine. But if `requestedDuration` is `"P0D"` or `"PT0M"` (zero duration), `parseIsoDurationMs` returns `null` and the 90-day fallback applies. This is probably not what users expect - a "P0D" duration should probably be treated as "immediate expiration" or an error, not a 90-day extension.

**Severity:** medium

**Recommended fix:** Treat zero-duration as an error case rather than falling back to 90 days. If a user requests `P0D` or `PT0M`, it should be rejected or treated as immediate expiration (expires immediately). Add validation in `initiateWorkflow()` that `requestedApprovalDuration` is not a zero-duration string.

---

### 9. OidcIdentityService validateProductionToken has incomplete mock prefix check

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/oidc/oidc-service.ts`
**Lines:** 155-169

**Problem:** `validateProductionToken()` rejects tokens starting with `at_`, `id_`, or `rt_` in production. However, there are `simulateTokenResponse()` and `simulateRefreshResponse()` methods (lines 663-696) that intentionally generate tokens with these prefixes. The validation check happens at line 621-622 after token exchange, but the `simulate*` methods are called internally when mock fallback is allowed. The issue is if `allowMockFallback` is `false` (the default per line 132), the `exchangeTokens` method throws at line 606-609 before reaching `validateProductionToken`. But if some code path bypasses the throw and reaches validation, legitimate tokens that happen to start with these prefixes (very unlikely but possible) would be rejected.

**Severity:** medium

**Recommended fix:** Add a UUID format check so that only tokens that look like generated mocks (prefix + UUID pattern) are rejected, not any token that happens to start with `at_`. Or use a more robust mock detection mechanism that doesn't depend on prefix matching alone.

---

### 10. GroupRoleMappingService tenant validation missing in resolve

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/group-role-mapping-service.ts`
**Lines:** 35-39

**Problem:** `resolve()` checks `tenantId.trim().length === 0` at line 36 and throws if empty. However, it doesn't validate that `tenantId` is a valid format (e.g., starts with `tenant:` prefix). A blank or whitespace-only tenant ID would throw, but an invalid tenant ID format (like `"invalid"`) would pass and could lead to unexpected behavior when looking up rules.

**Severity:** medium

**Recommended fix:** Add tenant ID format validation (regex check for `tenant:` prefix or similar). Document the expected tenant ID format in a comment or interface.

---

### 11. ScimProvisionService bulk operation path sanitization incomplete

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/scim-sync/scim-service.ts`
**Lines:** 848-858

**Problem:** `parseBulkPath()` sanitizes the path at line 849: `const sanitized = path.replace(/^\/scim\/v2/, "")`. This regex only removes the leading `/scim/v2` prefix once. However, paths like `///scim/v2/Users` or `/scim/v2/Users/` with trailing slashes would not be handled correctly. The regex should use `replace(/^\/scim\/v2\/?/, "")` to optionally handle trailing slash. Additionally, if the path contains encoded characters like `%2Fscim%2Fv2`, it would not be matched.

**Severity:** medium

**Recommended fix:** Update the regex to handle optional trailing slash: `/^\/scim\/v2\/?/` and add path normalization before parsing. Handle URL-encoded characters by decoding before regex matching.

---

### 12. ScimProvisionService list endpoint tenant context resolution inconsistent

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/scim-sync/scim-service.ts`
**Lines:** 958-967

**Problem:** `resolveListTenantContext()` at line 958-966 has inconsistent behavior: if `tenantId` is provided and non-empty, it returns that tenant directly. If `tenantId` is null/empty and there are multiple known tenant IDs, it calls `requireTenantContextValue()` which throws. But if there's only one known tenant ID, it returns that tenant even if the caller didn't provide one. This means an empty-handed caller could get different results based on what's in the store, making the API behavior unpredictable.

**Severity:** medium

**Recommended fix:** Document the implicit tenant resolution behavior clearly. Consider making it explicit: if the caller doesn't provide tenant context and there are multiple tenants, throw an error rather than silently using the only known tenant. Add a warning log when implicit resolution occurs.

---

## Medium Issues

### 13. ApprovalEscalationRule cooldown check doesn't validate lastEscalatedAtIso format

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/escalation/index.ts`
**Lines:** 113-123

**Problem:** `evaluateApprovalEscalation()` checks cooldown at lines 113-123, parsing `context.lastEscalatedAtIso`. If `lastEscalatedAtIso` is an invalid date string like `"invalid-date"` or `""`, `Date.parse()` returns `NaN`. The comparison `Date.parse(nowIso) - NaN` is `NaN` which is not `< cooldownMs`, so the cooldown check passes incorrectly (no cooldown applied). This could allow rapid re-escalation if `lastEscalatedAtIso` is malformed.

**Severity:** medium

**Recommended fix:** Add validation that `lastEscalatedAtIso` is a finite timestamp before using it in calculations. If `Date.parse(lastEscalatedAtIso)` returns `NaN`, treat it as "never escalated" and skip the cooldown check.

---

### 14. DelegatedGovernanceService permission intersection logic has off-by-one

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegated-governance-service.ts`
**Lines:** 92-106

**Problem:** When `grantorPermissions` is provided (including empty array `[]`), the intersection is computed and then checked at line 99. If `grantorPermissions` is an empty array, `effectivePerms` would be empty (since `intersectPermissions([], grantedPerms)` returns `[]`). Then `requestedPerm` (which is `scope.permission`) would not be in `effectivePerms`, so the check fails and returns `allowed: false`. This is correct - someone with no permissions can't act. But the error message says "permission_exceeds_grantor_authority" which implies the grantee has MORE permissions than the grantor, not that the grantor has NO permissions.

**Severity:** low

**Recommended fix:** Refine the error message to distinguish between "grantor has no permissions" vs "grantee permission not in grantor's scope". Use different reason codes for these cases.

---

### 15. GovernanceDelegationRevocationSaga cascade depth tracking incomplete

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts`
**Lines:** 74-75, 107-115

**Problem:** `cascadeDepthApplied` is only incremented when revoking derived delegations (line 112), not when other cascade steps are executed. However, `prepareCascadeSteps` (lines 87-97) handles `pendingApprovals`, `activeSessions`, `secretLeases`, `workerLeases`, `scheduledTriggers` - these are cascade operations but don't increment `cascadeDepthApplied`. If someone requests cascade scope with depth 2 expecting transitive cascading, the depth counter only reflects revocation of direct derived delegations, not the broader cascade operations.

**Severity:** medium

**Recommended fix:** Clarify what `cascadeDepthApplied` represents. If it should count all cascade levels, increment it for each cascade step executed. If it's specifically for delegation chain depth, document that clearly and ensure the name matches the behavior.

---

### 16. SelfServiceGovernanceConsole permission check has role inconsistency

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/governance-console-service.ts`
**Lines:** 181-183

**Problem:** `revokeDelegation()` at line 181 checks `actorId !== delegation.grantorId && role !== "platform_team"`. This means if `actorId` matches `grantorId`, the revocation succeeds regardless of role. But if `role === "platform_team"` and `actorId !== grantorId`, revocation also succeeds. The logic is: grantor OR platform_team can revoke. But this means any platform_team member can revoke any delegation, not just those they have authority over. There's no check that the platform_team actor has appropriate scope.

**Severity:** medium

**Recommended fix:** Add scope validation: check that the platform_team actor's scope includes the org node of the delegation they're trying to revoke. Document that platform_team has global authority but still requires appropriate scope checks.

---

### 17. ApprovalRoutingService fallback approver chain could be empty

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/approval-routing-service.ts`
**Lines:** 144-151

**Problem:** If `base.approverChain` is empty and `fallbackApproverIds` is also empty (lines 125-126), the code at line 149-151 throws `Error(\`approval_route.empty_approver_chain:${base.matchedOrgNodeId}\`)`. This is correct behavior - it prevents routing to no one. However, if `fallbackApproverIds` is configured as an empty array explicitly, the route snapshot will show `approverIds: [...this.fallbackApproverIds]` which would be empty, leading to silent failures downstream when approvals are sought from an empty chain.

**Severity:** medium

**Recommended fix:** Add validation that throws early if `fallbackApproverIds` is configured as an empty array. Warn if fallback chain is empty. Document that fallback approvers must be explicitly configured.

---

### 18. KnowledgeBoundaryService dynamic policy evaluation has early return bug

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/knowledge-boundary/knowledge-boundary-service.ts`
**Lines:** 98-104

**Problem:** The `allowed` computation at lines 98-104 uses short-circuit evaluation:
```javascript
const allowed = chineseWallDecision.allowed
  && dynamicPolicyAllowed
  && tenantAllowed
  && (canAccessKnowledgeBoundary(...) || evaluateKnowledgeShare(...));
```
If `chineseWallDecision.allowed` is `false`, subsequent `&&` evaluations are skipped. However, `dynamicPolicyAllowed` evaluation at lines 88-96 may have pushed reason codes to `dynamicPolicyReasons` array even when returning false. The reason codes are collected regardless of early return in the outer condition. This means if Chinese wall blocks access first, the `dynamicPolicyReasons` may contain stale reasons from a previous evaluation that weren't cleared.

**Severity:** medium

**Recommended fix:** Clear `dynamicPolicyReasons` at the start of `evaluateDynamicAccess` before evaluating dynamic policy. Ensure reason codes only reflect the current evaluation, not accumulated state.

---

### 19. FrameworkCatalog minimumPolicy matching fails for non-boolean string values

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/framework-catalog.ts`
**Lines:** 292-303

**Problem:** `matchesFrameworkRequirement()` at lines 292-303 only handles `boolean`, `number`, and `string` types explicitly. Any other type (object, array, null, undefined) returns `observed != null` which is `true` for any non-null value including `false`, `0`, empty string, etc. This means if a minimum policy requires an object (like `{ encryption: true }`) and the observed value is `{ encryption: false }`, it would incorrectly pass because `observed != null` is `true`. Similarly, if minimum policy expects a number but a string is provided, it won't be caught.

**Severity:** medium

**Recommended fix:** Add explicit type checking: if `required` is an object/array, check that `observed` has the same type. If types mismatch, return `false` rather than falling through to `observed != null`.

---

### 20. OrgGovernanceSaga validateStepCapabilities doesn't check for null node capabilities

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/org-model/org-governance-saga.ts`
**Lines:** 155-186

**Problem:** `validateStepCapabilities()` at line 136 checks `node.capabilities.includes(cap)` for each required capability. If `node.capabilities` is `null` or `undefined` (which OrgNodeWithCapabilities allows via `readonly capabilities: readonly string[]`), this would throw a TypeError at runtime. The interface doesn't require capabilities to be non-null, and a malformed org node could cause the saga to crash.

**Severity:** medium

**Recommended fix:** Add null check: `if (!node.capabilities || node.capabilities.length === 0)` treat as no capabilities. Return `{ valid: false, reason: "missing_capabilities:..." }` if required capabilities are needed but node has none.

---

## Low Issues

### 21. HrRoleGovernanceService maxInstances validation allows 0

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/org-model/hr-role-governance-service.ts`
**Lines:** 456-457

**Problem:** `maxInstances` validation checks `proposal.maxInstances <= 0` at line 456, rejecting 0 and negative values. But a `maxInstances` of 0 means "no instances allowed" which is a valid business rule (effectively disabling the role). The validation should either allow 0 (meaning role exists but no instantiation permitted) or use a more meaningful constraint like `maxInstances < 0` (only negative is invalid).

**Severity:** low

**Recommended fix:** Change to `proposal.maxInstances < 0` to allow 0 as a "disabled" state. Add a comment explaining that 0 means no instances can be created.

---

### 22. ApprovalRouteRequestSchema amount. currency validation allows invalid codes

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/route-engine/index.ts`
**Line:** 13

**Problem:** `currency: z.string().min(3).max(3).default("CNY")` validates that currency is exactly 3 characters, which is correct for ISO 4217 codes. However, it doesn't validate that the code is a known valid currency (e.g., "XXX" would pass but isn't valid). While strict ISO validation is beyond scope, the 3-character constraint means "US" (2 chars) or "USD" (3 chars) both pass. "EU" would fail but is a valid region code, not currency.

**Severity:** low

**Recommended fix:** Document that only ISO 4217 3-letter codes are accepted. Add a comment that "US" would be rejected because it's 2 chars, not 3. Consider adding a regex for known currency codes if stricter validation is needed.

---

### 23. ComplianceEvidenceCollector record hash includes optional fields inconsistently

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/evidence-collector.ts`
**Lines:** 103-121

**Problem:** `computeRecordHash()` at lines 103-121 includes all fields of the record in the hash payload, including optional fields with `?? null` coalescing. This means records that differ only in optional fields (e.g., one has `sourceSystem` set, another doesn't) will have different hashes. This is correct behavior for integrity. However, the hash doesn't include `content` field (line 89 skips it) but includes `artifactRef`. If evidence content changes but the artifact reference stays the same, the hash would remain unchanged, incorrectly suggesting integrity.

**Severity:** low

**Recommended fix:** Include `content` in the hash computation if it represents the actual evidence data. Document why `content` is excluded and `artifactRef` is included. Ensure the hash truly represents the authoritative evidence data.

---

### 24. ScimDlqReconciliationService identity resolution incomplete

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/scim-dlq-reconciliation.ts`
**Lines:** 16-30

**Problem:** `reconcile()` classifies records with `retryCount >= maxRetries` as `unresolvedIdentityIds`. However, it doesn't check the `lastError` field to determine if the failure is actually an identity issue vs a transient error. A record that failed due to a network timeout 3 times (maxRetries=3) would be marked as "unresolved identity" even if the issue was transient connectivity. This misclassification could cause unnecessary investigation of non-identity issues.

**Severity:** low

**Recommended fix:** Add error type classification: if `lastError` indicates a permanent failure (schema validation, not found), mark as identity issue. If it indicates transient failure (timeout, network), mark differently or exclude from unresolved identity list.

---

### 25. OidcIdentityService fetchWithTimeout doesn't handle abort gracefully

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/sso-scim/oidc/oidc-service.ts`
**Lines:** 648-661

**Problem:** `fetchWithTimeout()` creates an AbortController at line 653 and clears timeout in finally. If the fetch completes after the timeout fires but before abort is called, the abort signal could cause the fetch to throw an AbortError. The controller is created fresh each call which is correct, but there's no handling for the AbortError specifically - it would propagate as a generic network error.

**Severity:** low

**Recommended fix:** Catch `AbortError` specifically and throw a more descriptive error like `"oidc.request_timeout:${url}"` so callers can handle timeouts distinctly from other network errors.

---

## ADR Gaps Identified

1. **No ADR for approval routing fallback chain configuration** - When both primary and delegation-based routing fails, the system falls back to `fallbackApproverIds`. There's no documented policy for when/why fallback approvers are configured or what the security implications are.

2. **No ADR for Chinese wall reset approval authority** - The `resetRequiresApprovalRole: "compliance_officer"` setting requires a specific role to reset an expired wall. There's no documented policy explaining why compliance_officer specifically, what the audit trail for resets should contain, and under what circumstances a reset should be granted vs requiring a new wall creation.

3. **No ADR for compliance exception workflow maximum duration** - `ComplianceExceptionWorkflowEngine` defaults to 90 days when no duration is specified (line 240). There's no documented policy for why 90 days is the default, what the maximum allowed duration should be, and what happens to exceptions that reach their expiry without approval.

4. **No ADR for knowledge boundary sharing grant lifecycle** - `KnowledgeShareGrant` has an `expiresAt` field but there's no documented policy for how long grants should live, whether they should be renewable, and what happens to downstream consumers when a grant expires mid-use.

5. **No ADR for API key hash pepper rotation** - `ApiKeyService` uses a `hashPepper` for HMAC key hashing (line 86). There's no documented policy for when/how this pepper should be rotated, what the security implications are if it's compromised, or how key validation works across pepper rotation periods.

6. **No ADR for OIDC session refresh token family tracking** - The `OidcIdentityService` implements refresh token family tracking for rotation detection (line 230). There's no documented policy for how session invalidation should work if a replay attack is detected, what the SLO is for revoking all sessions in a compromised family, or how this interacts with the broader session revocation system.

7. **No ADR for SCIM tenant isolation default behavior** - When `requireTenantContext` is false and no tenant is provided, the system defaults to `tenant:global`. There's no documented policy for when it's appropriate to use the global tenant vs requiring explicit tenant context, and what data isolation guarantees exist in global tenant mode.

8. **No ADR for governance delegation revocation cascade depth semantics** - `GovernanceDelegationRevocationSaga` tracks `cascadeDepthApplied` but it's unclear what each depth level means in terms of what's actually revoked. An ADR should clarify the cascade depth semantics and what operations occur at each depth.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 5     |
| Medium   | 13    |
| Low      | 6     |
| **Total**| 25    |

**ADR Gaps:** 8 identified

The most impactful issues are:
- **`nowIso()` function call bug** (Critical) - FX snapshot timestamp corruption in approval routing
- **Tenant scope logic inversion** (High) - Knowledge federator would incorrectly deny same-tenant access
- **Capability traversal cycle vulnerability** (High) - Potential infinite loop in org governance saga
- **Chinese wall reset bypass** (High) - Empty string could bypass compliance officer requirement
- **Multiple missing ADR documents** - Key architectural decisions made in code without supporting documentation for approval routing fallback, compliance exception lifecycle, knowledge boundary grants, API key pepper rotation, OIDC refresh token families, SCIM tenant isolation, and governance cascade depth semantics.

The org-governance module demonstrates solid foundational patterns for approval routing, knowledge boundaries, and delegated governance. The compliance engine is well-structured with proper evidence collection and framework catalog management. Key areas needing attention are the FX timestamp bug, tenant scope logic correction, and cycle detection in hierarchy traversal.

---

## Module: plugins

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/` - primary location
- Subdirectories: `adapters/`, `presenters/`, `retrievers/`, `planners/`, `validators/`

Files reviewed: `builtin-plugin-registry.ts`, `growth-config.ts`, `operations-config.ts`, `index.ts`, `adapters/` (5 files), `presenters/` (3 files), `retrievers/` (6 files), `planners/` (1 file), `validators/` (1 file), plus `plugin-spi.ts` and `plugin-spi-registry.ts` as reference.

---

## Issue 1

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 432-437  
**Problem:** The `evaluate()` and `produceHarnessDecision()` methods both call `evaluateWithLegacyScoring()` and return `EvaluatorAssessment`. However, the `DomainValidatorPlugin` interface (plugin-spi.ts lines 158-192) defines `validate()` as returning a `ValidationResult` with `{ valid, errors, suggestions, evaluation }` - NOT `EvaluatorAssessment`. The `evaluate()` method has a different return type (`EvaluatorAssessment` with fields like `deviationAnalysis`, `riskAssessment`, `recommendations`). If code calls `evaluate()` expecting the interface's `ValidationResult`, it will receive an incompatible object. This is a type safety violation.  
**Severity:** high  
**Recommended fix:** Ensure `evaluate()` returns an object conforming to `ValidationResult`, or rename the method to avoid confusion with the interface contract. Document the divergence clearly if the dual-return-type behavior is intentional for internal use.

---

## Issue 2

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/crm-adapter.ts`  
**Line:** 77-79  
**Problem:** `healthCheck()` is declared `async` and returns `Promise<boolean>`. However, the body contains `policy.evaluate(...).allowed` without `await`. Since `evaluate()` on `NetworkEgressPolicyService` returns a `Promise`, accessing `.allowed` on the unresolved promise will always be `false` (property access on a Promise object). The actual policy result is never awaited, so `healthCheck` always returns `false` for CRM adapter.  
**Severity:** high  
**Recommended fix:** Change line 78 to `return await policy.evaluate(...).allowed;`

---

## Issue 3

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/game-dev-adapter.ts`  
**Line:** 30-32  
**Problem:** `healthCheck()` returns `true` when `credentialFingerprint == null`. This means the Unity adapter reports as "healthy" even when it has not been authenticated. An unauthenticated adapter should not be considered healthy.  
**Severity:** high  
**Recommended fix:** Change the logic so that if `credentialFingerprint == null`, return `false`. The correct pattern is: `return credentialFingerprint != null && gameDevPolicy.evaluate(...).allowed;`

---

## Issue 4

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/asset-production-adapter.ts`  
**Line:** 28-31  
**Problem:** `healthCheck()` only validates policy for `api.figma.com`, but the adapter's `execute()` method (line 53) routes to `cdn.figma.com` for `cdn_*` actions. The egress policy check in `healthCheck` does not cover the CDN endpoint that the adapter actually uses.  
**Severity:** high  
**Recommended fix:** Add `policy.evaluate("https://cdn.figma.com").allowed` to the health check, or extract a helper that checks both domains used by the adapter.

---

## Issue 5

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/livestream-adapter.ts`  
**Line:** 33-36  
**Problem:** `healthCheck()` is async but the body at line 35-36 accesses `policy.evaluate(...).allowed` without `await`. The `evaluate()` method is async and returns a Promise. Accessing `.allowed` on an unfulfilled Promise yields `false`, so the health check will always return `false` for the Livestream adapter regardless of actual policy state.  
**Severity:** high  
**Recommended fix:** Add `await` before each `policy.evaluate()` call.

---

## Issue 6

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/builtin-plugin-registry.ts`  
**Line:** 96-119  
**Problem:** `plugin.growth.crm_adapter` is registered in `BUILTIN_PLUGIN_FACTORIES` (line 109) with factory `createCrmAdapterPlugin`. However, `plugin.growth.crm_adapter` is not listed in `BUILTIN_PLUGIN_MANIFESTS` (lines 123-567). When `createBuiltinPluginWithManifest()` is called for this plugin, it will return `null` because `getBuiltinPluginManifest()` won't find a manifest (line 603-606 checks manifest existence). The plugin can be created via `createBuiltinPlugin()` but lacks a proper manifest, breaking manifest-based plugin management.  
**Severity:** high  
**Recommended fix:** Add a `BUILTIN_PLUGIN_MANIFESTS` entry for `plugin.growth.crm_adapter` similar to the pattern used for other adapter plugins (e.g., `plugin.growth.crm_adapter` entry around line 385-410).

---

## Issue 7

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/growth-config.ts`  
**Line:** 201  
**Problem:** `externalAdapters: ["github", "jira"]` references `"jira"` as an external adapter, but there is no Jira adapter in the adapter registry. The `builtin-plugin-registry.ts` only has `github`, `crm`, `game-dev`, `asset-production`, and `livestream` adapters. A binding to `"jira"` would fail at activation.  
**Severity:** high  
**Recommended fix:** Either implement a Jira adapter or remove `"jira"` from the `externalAdapters` list. Document the intended integration if Jira is a planned future adapter.

---

## Issue 8

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/operations-config.ts`  
**Line:** 178  
**Problem:** `externalAdapters: ["github"]` is correct, but the `pluginBindings` at lines 179-183 reference `"plugin.operations.presenter"` etc. However, the `pluginType: "tool"` in these bindings does not match the actual `spiType: "presenter"` (for presenter) and `spiType: "retriever"` (for retriever) declared in the plugin implementations. This mismatch means the binding configuration doesn't accurately describe the plugins it targets.  
**Severity:** medium  
**Recommended fix:** Align `pluginType` in pluginBindings with the actual `spiType` of the referenced plugin. Use `pluginType: "presenter"` for presenter bindings, `pluginType: "retriever"` for retriever bindings, etc.

---

## Issue 9

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/growth-config.ts`  
**Line:** 202-207  
**Problem:** `pluginType: "tool"` is used for all plugin bindings (retriever, presenter, validator, planner) even though the actual plugins declare different `spiType` values. For example, `growth.presenter` binding uses `pluginType: "tool"` but the plugin declares `spiType: "presenter"`. The binding role is correctly separated into `bindingRole` property, but `pluginType` still carries an incorrect value that could confuse the registry's type validation.  
**Severity:** medium  
**Recommended fix:** Set `pluginType` to match the actual SPI type of the bound plugin (`"retriever"`, `"presenter"`, `"validator"`, `"planner"`), and use `bindingRole` for any semantic role differentiation.

---

## Issue 10

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 210-211  
**Problem:** The manifest for `plugin.core.basic-evaluator` declares `spiTypes: ["validator", "evaluator"]` (line 210), indicating it implements both roles. However, `createBasicValidatorPluginInternal()` (lines 397-441) only sets `spiType: "validator"` on the returned plugin object (line 402). This creates a discrepancy between the manifest and the actual plugin's declared type.  
**Severity:** medium  
**Recommended fix:** Either remove `"evaluator"` from the manifest's `spiTypes` array, or add an `evaluator` SPI type to the plugin object returned by the factory (which would require the plugin to implement the evaluator interface as well).

---

## Issue 11

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/presenters/coding-presenter.ts`  
**Line:** 45  
**Problem:** `citations` is declared as `string[]` (line 45 is the assignment: `citations: input.artifacts.map(...)`). But `input.artifacts` is typed as `ArtifactRef[]` (from plugin-spi.ts line 219). `ArtifactRef` is not necessarily a `string` - it is likely an object with fields like `artifactId`, `type`, etc. Pushing these objects into a `string[]` violates the type contract.  
**Severity:** medium  
**Recommended fix:** Extract the string identifier from each `ArtifactRef` before pushing to citations, e.g., `citations: input.artifacts.map((ref) => ref.artifactId ?? ref.toString())`.

---

## Issue 12

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/presenters/operations-presenter.ts`  
**Line:** 70-71  
**Problem:** Same issue as Issue 11. `input.artifacts` is `ArtifactRef[]` but is pushed directly into `citations: string[]`.  
**Severity:** medium  
**Recommended fix:** Same as Issue 11 - extract a string identifier from each `ArtifactRef`.

---

## Issue 13

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/presenters/growth-presenter.ts`  
**Line:** 78-83  
**Problem:** Same artifact-to-citation issue. The code pushes raw `artifactRef` strings to `citations` but does not verify that `ArtifactRef` is a string type.  
**Severity:** medium  
**Recommended fix:** Same as Issue 11 - ensure `ArtifactRef` values are properly converted to strings before adding to citations.

---

## Issue 14

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/retrievers/coding-retriever.ts`  
**Line:** 55-61  
**Problem:** The `score` field in `RetrieverKnowledgeResult` is typed as `number` in `plugin-spi.ts` (line 130), but at line 57 the code uses:
```typescript
score: Number((search.relevanceScores.get(`${symbol.name}@${symbol.filePath}`) ?? 0.8).toFixed(4))
```
`.toFixed(4)` returns a `string`, and `Number()` converts it back to `number`. This is unnecessarily verbose - just use the value directly. More importantly, if `relevanceScores.get()` returns a non-number value (e.g., from a bug in `SemanticRepoMapService`), `toFixed` would throw a runtime error since numbers don't have `toFixed` unless coerced first.  
**Severity:** low  
**Recommended fix:** Simplify to `score: search.relevanceScores.get(...) ?? 0.8` and ensure `relevanceScores` always stores numbers.

---

## Issue 15

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/retrievers/game-dev-retriever.ts`  
**Line:** 62, 71, 80, 89  
**Problem:** Multiple `score` calculations use `Math.min(0.97, 0.7 + Math.min(searchQuery.length / 240, 0.18))`. If `searchQuery` is extremely long, the inner `Math.min` caps at 0.18, so the score formula becomes `0.7 + 0.18 = 0.88`, capped at `0.97`. But if `searchQuery` is empty, the score is `0.7 + 0 = 0.7`. This is a reasonable heuristic, but the magic numbers (0.7, 0.18, 240) are not documented and differ from other retrievers (e.g., `growth-retriever.ts` uses static 0.95/0.88/0.82 scores). Inconsistent scoring heuristics across retrievers make it difficult to compare relevance across domains.  
**Severity:** low  
**Recommended fix:** Document the scoring formula and consider extracting scoring constants into a shared configuration for the domain.

---

## Issue 16

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/planners/basic-planner.ts`  
**Line:** 22-24  
**Problem:** `suggestWorkflow` accesses `task.assessment.complexity` and `task.assessment.approvalPolicy.required` without null checks. If `task.assessment` is `null` or `undefined`, this will throw a runtime error. The `DomainPlannerPlugin` interface (plugin-spi.ts lines 199-210) defines `assessment: UnifiedAssessment`, but the interface does not guarantee `assessment` is non-null within `UnifiedAssessment`.  
**Severity:** medium  
**Recommended fix:** Add null checks: `if (!task.assessment) return null;` at the start of `suggestWorkflow`, or use optional chaining with a fallback.

---

## Issue 17

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/github-adapter.ts`  
**Line:** 220-226  
**Problem:** `execute()` calls `requireRepository(params["repository"])` then `buildEndpoint()` which can throw for unknown actions before `policy.evaluate(endpoint)` is called. If an unknown action is passed, the policy check never executes because `buildEndpoint` throws first. This means security policy evaluation is skipped for unsupported actions - but since the action also doesn't execute (throws), the practical risk is low. However, the sequencing means an attacker could probe allowed endpoints by observing which actions get to the policy check vs. throw.  
**Severity:** low  
**Recommended fix:** Call `policy.evaluate()` with the unvalidated action before `buildEndpoint()`, or validate the action against a allowlist before the switch statement.

---

## Issue 18

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/crm-adapter.ts`  
**Line:** 94  
**Problem:** The action validation regex `/^[a-zA-Z0-9_]+$/` allows alphanumeric and underscore characters. However, CRM API endpoints can include hyphens (e.g., `contact_lists`, `email_campaigns`). If an action like `"contact-list"` is passed, it will fail the regex and throw an error, even though it might be a valid CRM action.  
**Severity:** low  
**Recommended fix:** Extend the regex to include hyphens if the CRM API uses them, or document the allowed action format and validate against the actual CRM API's action list.

---

## Issue 19

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/github-adapter.ts`  
**Line:** 151-153  
**Problem:** `createIdempotencyKey()` returns `null` for `get_file` actions, but this is treated differently at line 244-254 where `idempotencyKey` is spread into the result. The `null` return is intentional (file reads are idempotent without a key), but the code doesn't distinguish between "intentionally no key" and "error generating key". The ternary `idempotencyKey == null ? {} : { idempotencyKey }` handles the value correctly, but the intent is implicit rather than documented.  
**Severity:** low  
**Recommended fix:** Use an option bag pattern or explicit `undefined` return to distinguish intentional no-key from error cases. Document that `get_file` actions are inherently idempotent.

---

## ADR Gaps Identified

1. **No ADR for dual SPI type plugins** - `plugin.core.basic-evaluator` declares both `validator` and `evaluator` in its manifest, but the actual plugin object only has `spiType: "validator"`. The decision to treat "evaluator" as a capability rather than a separate SPI type instance is not documented.

2. **No ADR for plugin binding `pluginType` vs `bindingRole` semantics** - The growth and operations configs use `pluginType: "tool"` for all bindings regardless of actual SPI type, with `bindingRole` carrying the semantic role. This abstraction is not documented, and it is unclear whether `pluginType: "tool"` serves a specific purpose or is legacy inconsistency.

3. **No ADR for external adapter registry completeness** - The `operations-config.ts` references `"jira"` as an external adapter but no Jira adapter exists. There is no documented process for ensuring `externalAdapters` declarations match implemented adapters.

4. **No ADR for cross-domain adapter sharing** - The GitHub adapter is used by both `coding` and `growth` domains (and referenced in `operations` domain). When it is shared, there is no documented policy for how credential state is managed per-domain vs. globally, and whether domain-specific egress policies could conflict.

5. **No ADR for retriever score normalization** - Each retriever uses different scoring heuristics (static scores vs. query-length-based formulas vs. context-key-count-based formulas). There is no documented standard for what a "0.9" score means across domains, making cross-domain relevance comparison unreliable.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 6     |
| Medium   | 8     |
| Low      | 5     |
| **Total**| 19    |

**ADR Gaps:** 5 identified

**Most impactful issues:**
- The `evaluate()` / `produceHarnessDecision()` type mismatch in `basic-evaluator.ts` (high) can cause downstream code to receive `EvaluatorAssessment` when it expects `ValidationResult`
- The unawaited `policy.evaluate()` calls in `crm-adapter.ts` and `livestream-adapter.ts` (high) cause health checks to always return `false`
- The `game-dev-adapter.ts` health check returning `true` without authentication (high) can cause the system to trust an unauthenticated adapter
- The missing `plugin.growth.crm_adapter` manifest entry (high) causes `createBuiltinPluginWithManifest()` to return `null` for a registered plugin
- The `operations-config.ts` and `growth-config.ts` referencing unimplemented `jira` adapter (high) means those domain configurations are incomplete

## Module: tests/unit

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/` - root test directory
- 3944 total test files across multiple subdirectories

Subdirectories reviewed include: `apps`, `benchmarks`, `config`, `core`, `deploy`, `docs`, `domains`, `helpers`, `infrastructure`, `interaction`, `interaction-governance`, `ops-maturity`, `org-governance`, `platform`, `plugins`, `quality`, `repo`, `runtime`, `scale-ecosystem`, `scale-ops`, `scripts`, `sdk`, `testing`, `types`, `ui`.

---

## Issue 1

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/interaction-governance/interaction-governance-runtime-catalog.test.ts`  
**Line:** 88-92  
**Problem:** Test `buildInteractionGovernanceRuntimeCatalog governance array is frozen (but not interaction)` asserts `Object.isFrozen(catalog.governance)` and comments "Note: catalog itself is NOT frozen, interaction is NOT frozen". This test comments on implementation details (which arrays are frozen) that may change. The comment describes expected behavior inconsistently - it says "frozen (but not interaction)" but the assertion only checks `governance` is frozen. This is a golden test checking internal freeze state rather than behavior.  
**Severity:** medium  
**Recommended fix:** If the freeze behavior is a contract, document it as such and ensure it is tested through behavior rather than direct property checks. If not a contract, remove this test or convert it to verify behavior that depends on freeze immutability.

---

## Issue 2

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/interaction-governance/interaction-governance-runtime-catalog.test.ts`  
**Line:** 88-203  
**Problem:** Test file has no `test.afterEach` or `test.beforeEach` cleanup for the singleton `ServiceRegistry.getInstance()`. The tests at lines 117, 126, 135, 144, 155, 165, 175, 184, 195 use `ServiceRegistry.getInstance()` without resetting it between tests. If tests run in non-sequential order, state from one test could leak into another. Compare with `tests/unit/domains-runtime-orchestrator.test.ts` which correctly calls `await registry.reset()` in `test.afterEach` or before each test.  
**Severity:** medium  
**Recommended fix:** Add a `test.beforeEach` or `test.afterEach` hook that calls `await ServiceRegistry.getInstance().reset()` to ensure a clean registry state for each test. This pattern is already established in `domains-runtime-orchestrator.test.ts`.

---

## Issue 3

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform-architecture-bootstrap.test.ts`  
**Line:** 95-98  
**Problem:** Test `registerPlatformArchitectureServices enforces startup ordering before registration` uses `readFileSync` to read source code and then does a string regex match for `assertStartupOrderEnforced()`. This is a source code inspection test that tests implementation rather than behavior. If the function is renamed or refactored, this test would break despite the behavior being preserved.  
**Severity:** low  
**Recommended fix:** Either remove this test if the startup ordering is enforced through runtime behavior checked in other tests, or convert to a behavioral test that verifies startup ordering is enforced by actually calling the functions in wrong order and checking for errors.

---

## Issue 4

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/root-entry-summary.test.ts`  
**Line:** 1-58  
**Problem:** This is a golden test with hardcoded exact counts: `totalCapabilityCount: 31`, `ring1: 8, ring2: 11, ring3: 12`, etc. Any change to the actual counts in source code would break these tests even if the changes are intentional (e.g., adding new capabilities). The test file contains no indication of when these values were frozen or why they represent the expected canonical state.  
**Severity:** medium  
**Recommended fix:** Consider whether these exact counts should be validated against computed values from the actual catalog rather than hardcoded. If hardcoded values are intentional, add a comment explaining why these specific values represent the canonical state. Alternatively, derive expected values from the runtime catalogs dynamically.

---

## Issue 5

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform-root-types.test.ts`  
**Line:** 95-133  
**Problem:** Test `PlatformRootSummaryBuilderDeps structure validation` uses `as any` casts extensively to force-fit incompatible return types into the mock structure. The comment says "Create minimal mock functions to satisfy the function types" but the `as any` casts bypass TypeScript's type checking. This could mask type incompatibilities between what the test expects and what the actual `PlatformRootSummaryBuilderDeps` interface requires.  
**Severity:** low  
**Recommended fix:** Create properly typed mock implementations that return objects matching the expected shapes. Using `as any` hides potential type mismatches that could surface at runtime.

---

## Issue 6

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/domains-domain-recipe-service.test.ts`  
**Line:** 1-497  
**Problem:** The test `DomainRecipeService.getPrototypeTemplates returns all 12 templates` hardcodes the expected count of 12 templates. If new prototype templates are added (which is a reasonable extension), this test would fail. The test also checks for specific categories (`analysis`, `implementation`, `review`, etc.) but the ordering or presence of specific categories is not validated - only that they exist in the set.  
**Severity:** low  
**Recommended fix:** If 12 is a contractual number that should not change, document this in an comment. If it's subject to change, consider checking that the count is >= some minimum threshold rather than exact equality, or ensure the test has a comment noting it requires updates when templates are added.

---

## Issue 7

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/testing/golden.test.ts`  
**Line:** 1-101  
**Problem:** The golden test utilities create golden files in `tests/golden/snapshots/` at runtime via `mkdirSync` and `writeFileSync` within each test. This means the tests themselves are creating and modifying the golden files they then validate. This is circular - the tests write the files they then check. In a CI environment, if the golden files don't exist, the first run creates them (passing), but subsequent runs should validate against them. If the files already exist with different content, the test fails.  
**Severity:** medium  
**Recommended fix:** Separate golden file creation from validation. Golden files should be committed to source control and created once, not dynamically during test execution. Tests should only read and validate against existing golden files.

---

## Issue 8

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/domains-runtime-catalog.test.ts`  
**Line:** 34-40  
**Problem:** Test `buildDomainsRuntimeCatalog ring counts match expected baseline counts` uses exact equality assertions (`assert.equal(catalog.ring1.length, 8)`). These counts are duplicated from `root-entry-summary.test.ts` which also hardcodes `ring1: 8, ring2: 11, ring3: 12`. If ring counts change in the source, both tests would need updating. This violates DRY and makes updates error-prone.  
**Severity:** low  
**Recommended fix:** Centralize these magic numbers. Either create a shared constants file that both tests import, or derive the expected counts from the actual catalog builders dynamically and have a single canonical test that validates the counts are consistent across the system.

---

## Issue 9

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform-mainline-bootstrap.test.ts`  
**Line:** 91-113  
**Problem:** Test `criticalSubmodules arrays are non-empty for all capabilities` and `architectureSections arrays are non-empty for all capabilities` use loose assertions that could pass with empty arrays if the loop doesn't execute. The assertions `capability.criticalSubmodules.length > 0` and `capability.architectureSections.length > 0` would pass if an capability has an empty array, but only if the loop runs. If the array is somehow falsy (not possible with proper typing), it would throw.  
**Severity:** low  
**Recommended fix:** These tests are adequate as-is given TypeScript's type system ensures these are arrays. The severity is low - consider adding explicit null checks if the arrays could theoretically be undefined or null at runtime.

---

## Issue 10

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/domains-runtime-orchestrator.test.ts`  
**Line:** 107-108  
**Problem:** Test `DomainsRuntimeOrchestrator.startup later steps depend on earlier rings` uses a non-null assertion `result.steps.find((s) => s.stepId === "ring2")!` without checking if the result is undefined. If the startup order changes and ring2 is not found, this would throw a cryptic error rather than a clear assertion failure.  
**Severity:** medium  
**Recommended fix:** Add an explicit assertion that `ring2` step exists before accessing it: `const ring2 = result.steps.find((s) => s.stepId === "ring2"); assert.ok(ring2 !== undefined, "ring2 step should exist");`

---

## Issue 11

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/plugins.test.ts`  
**Line:** 334-352  
**Problem:** Test `PluginSpiRegistry can register validator and invoke it` uses type casting `(plugin as any).validate` to access the `validate` method. This bypasses TypeScript's type checking and assumes knowledge of the plugin's internal structure. The test validates that a validator plugin has a `validate` method but uses `any` to access it.  
**Severity:** low  
**Recommended fix:** If the plugin interface includes `DomainValidatorPlugin` type, the test should access the method through a properly typed interface rather than `any`. Consider defining a test-only interface that properly types the validator's methods.

---

## Issue 12

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/runtime/dispatcher.test.ts`  
**Line:** 1-100+  
**Problem:** Tests for `executeMultiStepToolCallForTests` return JSON strings that are then parsed with `JSON.parse(result)`. Some tests check `parsed.success === true` but don't validate the structure of `parsed` when `success` is false. For example, line 51 checks `parsed.errorCode` but only when `success` is false. This is good, but the pattern is inconsistent across tests - some only check success cases.  
**Severity:** low  
**Recommended fix:** Ensure all tests validate the complete structure of the result object, including both success and error paths. Add assertions for the presence of `errorCode`, `errorMessage`, or other relevant fields when `success` is false.

---

## Issue 13

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/interaction-governance-runtime-catalog.test.ts`  
**Line:** 1-27  
**Problem:** This file tests `buildInteractionGovernanceRuntimeCatalog` but the parallel file at `interaction-governance/interaction-governance-runtime-catalog.test.ts` tests the same functionality with more thorough coverage. The file `interaction-governance-runtime-catalog.test.ts` at the root level only has 2 tests while the nested version has 20+ tests. There's duplication of test coverage across two files.  
**Severity:** low  
**Recommended fix:** Consolidate the test coverage into a single file (preferably the more thorough one in `interaction-governance/`). Remove the duplicate root-level test file or mark the root-level one as deprecated and delegate to the nested version.

---

## Issue 14

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/root-entry-mode-consolidation.test.ts`  
**Line:** 11-18  
**Problem:** Test `PlatformStartupTargetKind is the single source of truth (issue 2002 fix)` uses a TypeScript type-level check with a conditional type (`Expected extends PlatformStartupTargetKind ? true : false`) that is then immediately discarded with `void _typeCheck`. This is a compile-time check only and provides no runtime test coverage. If the type check passes but the actual type definition is wrong at runtime, this test would not catch it.  
**Severity:** medium  
**Recommended fix:** While type-level testing has limited options in TypeScript, add runtime assertions that validate the type actually behaves as expected (e.g., test that values of type `PlatformStartupTargetKind` can be assigned and used correctly).

---

## Issue 15

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/domains-runtime-orchestrator.test.ts`  
**Line:** 179-225  
**Problem:** Tests `registerDomainsRuntimeOrchestrator registers orchestrator in registry` and similar tests that call `registerDomainsRuntimeOrchestrator(registry)` don't use `test.beforeEach` cleanup. However, `DomainsRuntimeOrchestrator` registers itself as a singleton service. If another test in the file calls `startup()` before these registration tests, state could leak. The file does have `await registry.reset()` calls throughout but the pattern is inconsistent - some tests reset before, some don't need to.  
**Severity:** low  
**Recommended fix:** Establish a consistent pattern of `test.beforeEach(async () => { await registry.reset(); })` at the top of the test file to ensure each test starts with a clean registry.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 0     |
| Medium   | 6     |
| Low      | 9     |
| **Total**| 15    |

**Key Observations:**

1. **Singleton State Management** - Several test files don't properly clean up `ServiceRegistry.getInstance()` between tests, risking cross-test contamination. The `domains-runtime-orchestrator.test.ts` pattern of `await registry.reset()` should be adopted uniformly.

2. **Golden Test Issues** - The `testing/golden.test.ts` creates its own golden files at runtime rather than using committed snapshots. This is a fundamental design issue with the golden test infrastructure.

3. **Implementation Detail Tests** - Tests like `platform-architecture-bootstrap.test.ts` line 95-98 inspect source code via `readFileSync` rather than testing behavior. This couples tests to implementation details.

4. **Magic Numbers** - Hardcoded capability counts (ring1: 8, ring2: 11, ring3: 12, etc.) are duplicated across multiple test files. These should be centralized or derived dynamically.

5. **Type Casting with `as any`** - Used in several places (`platform-root-types.test.ts`, `plugins.test.ts`) which bypasses TypeScript's type checking and could mask incompatibilities.

6. **Duplicate Test Coverage** - The `interaction-governance-runtime-catalog.test.ts` at root level duplicates tests that exist in the more thorough `interaction-governance/` subdirectory.

7. **Non-null Assertions Without Checks** - Several tests use `!` non-null assertions (e.g., `result.steps.find(...)!`) without first verifying the value exists, which could produce cryptic errors.

The overall test quality is good with strong coverage of startup order, catalog structure, and runtime behavior. The main concerns are around test isolation (singleton cleanup), avoiding implementation detail tests, and consolidating duplicated test constants.

---

## Cross-Review: ops-maturity ↔ execution

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/` - primary ops-maturity modules
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/` - execution engine modules

Key interaction points reviewed:
- `cost-optimization-service.ts` ↔ `multi-step-orchestration.ts` / `multi-step-supervisor.ts`
- `workflow-debugger-service.ts` ↔ `multi-step-supervisor.ts` (step output records)
- `self-healing-service.ts` ↔ `runtime-state-machine.ts` / `transition-service.ts`
- `platform-panic-service.ts` ↔ `multi-step-supervisor.ts` (crash injection, loop detection)

---

## Issue 1: Cost Optimizer "model" CostType Not in Union

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (line 148)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` (lines 560-577)

**Problem:** `riskLevelForSubject()` at line 148 checks `costType === "model"` but `"model"` is not defined in the `CostSubjectType` union (line 22). This means any cost record with `costType: "model"` would fall through to the default `baseRisk` without the upgrade to "medium" that LLM costs receive. Meanwhile, the execution engine's cost event WAL (lines 560-577) records hardcoded `provider: "minimax"` and `model: "MiniMax-M2.7"` for every step, creating a systematic attribution gap where actual model names from step configuration are ignored.

**Severity:** medium

**Recommended fix:** Add `"model"` to `CostSubjectType` union or remove the check from `riskLevelForSubject()`. In `multi-step-supervisor.ts`, extract actual provider/model from step configuration rather than hardcoding:
```typescript
provider: step.provider ?? routing.provider ?? "minimax",
model: step.model ?? routing.model ?? "MiniMax-M2.7",
```

---

## Issue 2: Cost Event WAL Hardcodes Provider/Model

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`  
**Lines:** 566-570

**Problem:** The R4-28 cost event WAL records hardcoded values:
```typescript
provider: "minimax",
model: "MiniMax-M2.7",
inputTokens: 30 + index * 10,
outputTokens: 12 + index * 5,
costUsd: 0.001 + index * 0.0005,
```
These are placeholder calculations. The cost optimizer's `recordCost()` expects `decisionRef` (line 70) and builds recommendations based on actual cost attribution. If the execution engine writes WAL entries with fake costs, and the cost optimizer later aggregates them, the recommendations will be meaningless. Additionally, the WAL entry does not include `decisionRef` which `recordCost()` requires - the WAL insert at line 577 does not populate this field.

**Severity:** high

**Recommended fix:** Either:
1. Remove the WAL until real measurement is implemented (per earlier recommendation), or
2. Obtain actual token counts from `buildStepOutput` result which contains `llmResult?.usage`, and
3. Include a `decisionRef` or mark the WAL entry with `harnessRunId` so it can be linked to execution decisions

---

## Issue 3: WorkflowDebugger evaluateTrace Null Dereference

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/workflow-debugger/workflow-debugger-service.ts`  
**Lines:** 97-98

**Problem:** `evaluateTrace()` finds a matching breakpoint:
```typescript
const matched = (this.breakpoints.get(planGraphId) ?? []).find((item) => item.nodeRunSelector === nodeRunId)!;
```
The `!` assertion assumes `matched` is defined, but if the breakpoints Map was populated with different `nodeRunSelector` values than the frame's `nodeRunId`, the `find()` returns `undefined` and the assertion throws. This could crash workflow debugging mid-execution. The execution engine's `multi-step-supervisor.ts` generates step outputs that could be passed to the debugger for trace evaluation, but there's no integration point that handles the debugger result.

**Severity:** high

**Recommended fix:** Add null check:
```typescript
const matched = (this.breakpoints.get(planGraphId) ?? []).find((item) => item.nodeRunSelector === nodeRunId);
if (!matched) continue; // skip frame if no matching breakpoint
```
Do not use `!` assertion on potentially undefined values.

---

## Issue 4: Self-Healing Deterministic Success Rate Conflicts with Execution State

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`  
**Lines:** 51-71, 210-213

**Problem:** `simulateHealthCheck()` (lines 51-71) uses:
```typescript
const healthCheckPassed = !/(rollback|failover)/.test(operation) || componentId.length % 2 === 0;
```
And `performHealingOperation()` (lines 210-213) uses:
```typescript
const deterministicScore = action.targetComponent.length + action.operation.length + (action.reasonCode?.length ?? 0);
return deterministicScore % (action.operation === "failover" ? 5 : 4) !== 0;
```
This produces deterministic-but-non-obvious success rates (~75-80%) that have no relationship to actual component health. If the self-healing service declares a component "healthy" but the execution state machine (`runtime-state-machine.ts` / `transition-service.ts`) tracks it as "failed" or "degraded", there is a direct conflict. The execution engine has no mechanism to respect or query the self-healing service's health assessments.

**Severity:** high

**Recommended fix:** Replace the deterministic-but-opaque length-parity check with a proper health status evaluation. If simulating, make the success rate configurable via policy and document the expected behavior. Add an integration point in the execution engine to query the self-healing service before marking steps as failed.

---

## Issue 5: Self-Healing Cooldown Bypasses Execution Retry Budget

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`  
**Lines:** 103-120

**Problem:** `execute()` checks `consecutiveFailures >= this.policy.maxRetries` (line 103) and then checks `timeSinceLastAttempt < this.policy.cooldownPeriodMs` (line 109). If both conditions are true, it returns early with `healed: false`. However, the execution engine's `multi-step-supervisor.ts` has its own retry logic (lines 144+) with separate retry counts (`executionAttemptCounter`, `workflowRetryCount`). The self-healing cooldown is independent of the execution retry budget - a component could be blocked from self-healing due to cooldown while the execution engine continues to retry the same failing step, burning budget without healing occurring.

**Severity:** medium

**Recommended fix:** Coordinate cooldown periods with execution retry budgets. Consider adding a callback or event that the execution engine can subscribe to, so that when self-healing declares a component in cooldown, the execution engine can respect that and avoid wasted retry attempts.

---

## Issue 6: Workflow Trace Cost Attribution Mismatch

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/workflow-debugger/workflow-debugger-service.ts`  
**Lines:** 140-181 (`compareTraceFields`)

**Problem:** `compareTraceFields()` at lines 154 compares `costUsd` between frames. The workflow debugger's `WorkflowTraceFrame` interface (line 30) includes `costUsd?: number`. However, the execution engine's step outputs (generated in `multi-step-supervisor.ts`) may not populate cost information in the same format. The comparison at line 154 does a simple equality check (`leftValue === rightValue`), but if one frame has cost from the WAL (hardcoded placeholder values) and another has actual cost from `recordCost()`, the comparison is meaningless. Additionally, `decisionRef` which is required by `recordCost()` is not part of `WorkflowTraceFrame`.

**Severity:** medium

**Recommended fix:** Ensure `WorkflowTraceFrame.costUsd` is populated from actual cost records, not WAL placeholders. Add `decisionRef` to `WorkflowTraceFrame` so cost can be properly attributed. Document the contract for cost fields in trace frames.

---

## Issue 7: Panic Mode AllowList Bypass Conflicts with Execution Blocking

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/emergency/platform-panic-service.ts` (from existing review Issue 5)  
**Cross-file interaction:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` (lines 579-585)

**Problem:** The existing review identified that `PlatformPanicService.evaluateExecution()` bypasses blocking for actors in the `allowList`. The `maybeInjectWorkflowCrash()` at line 579 of `multi-step-supervisor.ts` could be triggered for actors NOT in the allowList while allow-listed actors proceed normally. This means a panic-mode enforcement could be selectively bypassed based on actor identity, creating an inconsistent security boundary. The `maybeInjectWorkflowCrash` uses `crashInjection` config that is passed from the orchestration input - if an attacker can influence `input.crashInjection`, they could use an allow-listed actor to bypass panic enforcement.

**Severity:** high

**Recommended fix:** Ensure panic mode enforcement is consistent regardless of actor identity. The allowList bypass should only apply to non-destructive operations (monitoring, read-only access), not to execution loops that could propagate failures. Document the security model for allowList in panic mode.

---

## Issue 8: Self-Healing Action Conflicts with In-Flight Execution

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`  
**Lines:** 87-154

**Problem:** `execute()` can trigger a healing operation (`performHealingOperation`) while the execution engine is actively running steps in `executeStepLoop`. The self-healing service has no coordination with the execution loop - it simply performs the operation and returns a receipt. If `performHealingOperation` restarts or fails over a component that the execution loop is currently using (e.g., a database connection, a model endpoint), the in-flight execution could fail unexpectedly. There's no mutex or coordination to ensure self-healing doesn't disrupt active executions.

**Severity:** high

**Recommended fix:** Add a coordination mechanism: self-healing service should check with the execution engine before performing disruptive operations. Consider adding a `ExecutionGuard` interface that self-healing calls before performing restart/failover operations. The execution engine should be able to signal "in-flight" state that blocks disruptive healing.

---

## Issue 9: Cost Optimization Recommendations Not Integrated with Budget Allocation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts`  
**Cross-file interaction:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/budget-allocator.ts` (lines 218-251)

**Problem:** The cost optimizer's `buildRecommendations()` generates recommendations based on aggregated costs, but these recommendations are not integrated into the `BudgetAllocator`. The budget allocator reserves and settles costs without consulting the cost optimizer for dynamic limits. A recommendation to downgrade a model could be generated, but the budget allocator would continue using the current model without any enforcement mechanism. There's no feedback loop from cost optimization to budget allocation.

**Severity:** medium

**Recommended fix:** Create an integration point where `CostOptimizationService.buildRecommendations()` results can influence `BudgetAllocator` behavior. Consider adding a `CostRecommendationListener` interface that budget allocation subscribes to, so budget limits can be adjusted based on recommendations.

---

## Issue 10: Workflow Debugger Breakpoints Not Synchronized with Execution Step State

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/workflow-debugger/workflow-debugger-service.ts`  
**Lines:** 64-78 (`registerBreakpoint`), 84-109 (`evaluateTrace`)

**Problem:** `registerBreakpoint()` stores breakpoints by `planGraphId` (line 74-75), but the execution engine's `multi-step-supervisor.ts` does not query the debugger for active breakpoints before executing steps. The breakpoint evaluation happens AFTER execution via `evaluateTrace()`, not before. This means breakpoints cannot actually pause execution mid-workflow - they can only analyze what happened after the fact. The `action` field in `DebugBreakpointDefinition` supports `"pause" | "snapshot" | "compare"` but only `"snapshot"` and `"compare"` can work post-execution. A `"pause"` action would require pre-execution breakpoint checking.

**Severity:** high

**Recommended fix:** Add a pre-execution breakpoint check in `executeStepLoop` before each step runs. The debugger should expose a method `getActiveBreakpoints(workflowId)` that the supervisor calls to determine if the current step should be paused. Implement the pause mechanism by setting a flag that skips step execution and returns `blockedForDecision: true` to the orchestrator.

---

## Issue 11: Self-Healing Statistics Not Emitted to Execution Events

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`  
**Lines:** 171-208 (`getStatistics`)

**Problem:** `getStatistics()` returns aggregate healing metrics but these are not integrated into the execution engine's event system. The execution engine emits events like `platform.harness_run.status_changed` (line 401 in multi-step-orchestration.ts) but self-healing events are not emitted. Without events, there is no audit trail for healing operations in the context of execution runs. If a step fails, is healed, and then succeeds, there is no event linking the healing operation to the subsequent success.

**Severity:** medium

**Recommended fix:** Emit healing events to the event store with `eventType: "ops_maturity.self_healing.*"` so healing operations are traceable in the execution context. Include `harnessRunId` and `executionId` in healing receipts so healing can be correlated with execution runs.

---

## Issue 12: Cost Simulation Not Connected to Execution Budget Simulation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts`  
**Lines:** 112-125 (`simulate`)

**Problem:** `simulate()` takes `CostSimulationScenarioInput[]` and computes projected costs, but this simulation is not connected to the execution engine's budget simulation. The budget allocator in `budget-allocator.ts` has no simulation method - it only reserves and settles actual costs. If an operator wants to simulate "what if we reduce cost by 20%", the cost optimizer can simulate but the execution engine has no way to run a test execution with reduced budget. There's a gap between cost simulation (what-if analysis) and execution budget enforcement (actual limits).

**Severity:** medium

**Recommended fix:** Add a budget simulation mode to `BudgetAllocator` that accepts a `CostSimulationScenarioInput` and computes what the budget would look like under the scenario. Or document that cost simulation is for offline analysis only and should not affect execution budget limits without human review.

---

## Issue 13: ADR Gap - Self-Healing Determinism Model

**Files:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/platform-ops-agent/self-healing-service.ts`

**Problem:** The self-healing service uses deterministic formulas based on string length parity (`componentId.length % 2`) and modular arithmetic (`deterministicScore % 5 !== 0`) for healing success and health check determination. This is documented nowhere and has no ADR. An operator cannot configure or reason about what success rate to expect. The relationship between self-healing health assessments and the execution state machine is also undocumented.

**Recommended fix:** Create an ADR documenting:
1. The deterministic success rate model and why it was chosen (presumably for testability)
2. How self-healing health state should interact with execution state machine
3. The cooldown coordination mechanism with execution retry budgets
4. The integration points (or lack thereof) between self-healing and execution engine

---

## Issue 14: ADR Gap - Cost Event WAL Recovery Mechanism

**Files:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` (lines 555-577, 593-594)

**Problem:** R4-28 introduced write-ahead logging for cost events. The code at line 577 inserts with "pending" status and at line 594 commits inside the transaction. However, there's no documented recovery mechanism for orphaned pending entries. The comment says "On crash recovery, uncommitted cost events can be detected and cleaned up" but no sweeper code exists in this file. The cost optimizer's `unsourcedRecordCount` (line 67 in cost-optimization-service.ts) tracks records without `decisionRef` but there's no mechanism to clean up orphaned WAL entries that survived a crash.

**Recommended fix:** Create an ADR documenting:
1. The WAL recovery sweep frequency and entry age threshold for "orphaned"判定
2. How orphaned WAL entries should be handled (delete? flag for review?)
3. The relationship between WAL cleanup and cost optimizer's `unsourcedRecordCount`
4. Whether the cost optimizer should tolerate orphaned entries or fail-fast if they appear

---

## Issue 15: ADR Gap - Panic Mode AllowList Security Model

**Files:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/emergency/platform-panic-service.ts`

**Problem:** The allowList bypass in `evaluateExecution()` effectively disables panic mode enforcement for privileged actors. This is a significant security decision with no ADR. Questions that need answers:
1. What criteria determine allowList membership?
2. Does allowList apply to break-glass scenarios or normal operation?
3. Should allowListed actors still be rate-limited or throttled even if not blocked?
4. Is the allowList consistent with the execution engine's admission control?

**Recommended fix:** Create an ADR documenting:
1. The allowList membership criteria and approval process
2. What operations allowListed actors CANNOT perform even with allowList
3. The relationship between panic mode allowList and execution admission control
4. Audit trail requirements for allowList usage

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 7     |
| Medium   | 6     |
| Low      | 0     |
| **Total**| 13    |

**ADR Gaps:** 3 identified (self-healing determinism model, cost event WAL recovery, panic mode allowList security)

**Most impactful issues:**

1. **Self-healing deterministic success rates** (High) - opaque determinism that can conflict with execution state machine
2. **Workflow debugger null dereference** (High) - `evaluateTrace` can throw on breakpoint mismatch
3. **Pre-execution breakpoint not implemented** (High) - pause action cannot actually pause execution
4. **Panic mode allowList bypass** (High) - inconsistent security boundary for privileged actors
5. **Self-healing conflicts with in-flight execution** (High) - no coordination mechanism, disruptive healing can fail active executions
6. **Cost event WAL hardcodes provider/model** (High) - R4-28 WAL is recording fake data
7. **No self-healing event emission** (Medium) - healing operations not traceable in execution context

**Key architectural gaps:**

1. **No feedback loop** from cost optimization recommendations to budget allocation enforcement
2. **No pre-execution breakpoint check** in the step execution loop
3. **No coordination mechanism** between self-healing and execution engine for disruptive operations
4. **No unified cost attribution** - cost optimizer, WAL, and step outputs use different cost representations
5. **No health state integration** - self-healing assessments are not visible to execution state transitions


---

## Cross-Review: domains ↔ plugins

### Issue 1: DomainValidatorPlugin.validate() input type mismatch

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 415-431  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 163-169  

**Problem:** The `DomainValidatorPlugin` SPI interface defines `validate()` with input signature:
```typescript
validate(output: {
  nodeId?: string;
  stepId?: string;
  machineOutput: MachineOutput;
  contract: Record<string, unknown>;
})
```

However, `createBasicValidatorPluginInternal()` at line 415-431 in basic-evaluator.ts passes `ValidatorInput` which is defined as:
```typescript
type ValidatorInput = {
  machineOutput: { payload?: Record<string, unknown> };
  contract?: BasicEvaluationContract;
};
```

The basic-evaluator unwraps `input.machineOutput.payload` directly as a plain object, but the SPI expects `machineOutput` to be a structured `MachineOutput` object with fields `{ nodeId?, nodeRunId?, attemptId?, stepId?, outputRef, payload }`. The `nodeId`, `nodeRunId`, `outputRef`, and `attemptId` fields are completely ignored by the basic-evaluator.

**Severity:** high  

**Recommended fix:** In `basic-evaluator.ts`, extract `input.machineOutput.payload` as done now, but also extract and use `nodeId`/`nodeRunId` from the `MachineOutput` structure if available. Update `ValidatorInput` to properly include the full `MachineOutput` shape or clarify that this plugin only handles the payload subset.

---

### Issue 2: evaluate() and produceHarnessDecision() methods not in DomainValidatorPlugin SPI

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 432-437  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 158-192  

**Problem:** `createBasicValidatorPluginInternal()` returns a plugin object with three methods: `validate()`, `evaluate()`, and `produceHarnessDecision()`. The `DomainValidatorPlugin` SPI interface (plugin-spi.ts lines 158-192) only defines `validate()`. The `evaluate()` and `produceHarnessDecision()` methods are not part of the declared SPI contract. This means:
1. Callers invoking via the SPI interface cannot access `evaluate()` or `produceHarnessDecision()`
2. The plugin advertises extra methods not in the type definition
3. TypeScript may allow this due to structural typing, but the SPI contract is incomplete

**Severity:** high  

**Recommended fix:** Either:
1. Extend `DomainValidatorPlugin` in plugin-spi.ts to include `evaluate()` and `produceHarnessDecision()` methods, or
2. Remove these methods from the returned plugin object in basic-evaluator.ts, or
3. Cast to a broader type and document that this plugin exposes internal-only methods

---

### Issue 3: evaluator spiType not in PluginSpiTypeSchema

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 23  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 403, 463  

**Problem:** `PluginSpiTypeSchema` at line 23 of plugin-spi.ts includes `"evaluator"` as a valid SPI type. However, no plugin interface declares `spiType: "evaluator"`. The `DomainValidatorPlugin` interface at line 161 declares `spiType: "validator"`. All validator plugins use `spiType: "validator"`, making the `"evaluator"` entry in `PluginSpiTypeSchema` orphaned - it can be validated but no plugin actually uses it. Additionally, `normalizePluginManifestType()` in domain-registry-service.ts (line 420-435) maps `"validator"` to `["evaluator"]`, creating a conceptual confusion between validator and evaluator roles.

**Severity:** medium  

**Recommended fix:** 
1. If `"evaluator"` is meant to be a separate SPI type, add an `DomainEvaluatorPlugin` interface analogous to `DomainValidatorPlugin`
2. If `"evaluator"` is meant to be the same as validator, remove it from `PluginSpiTypeSchema`
3. Clarify in ADR the relationship between validator and evaluator plugin types

---

### Issue 4: Undefined capability IDs not validated against any schema

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 404, 464  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi-registry.ts`  
**Line:** 144-148  

**Problem:** `createBasicValidatorPluginInternal()` declares `capabilityIds: ["output.validate"]` and `createBasicEvaluatorPluginWithScoring()` declares `capabilityIds: ["output.validate", "output.quality_score"]`. Neither of these capability IDs are defined in any known capability schema. The `PluginSpiRegistry` at lines 144-148 accumulates capabilityIds from multiple sources but never validates them against a known set. The domain registry service `validateDefinition()` at lines 384-409 in domain-registry-service.ts also does not validate capability IDs.

**Severity:** medium  

**Recommended fix:** 
1. Define a `CapabilityIdSchema` that enumerates all valid capability IDs
2. Add validation in `PluginSpiRegistry.register()` to reject unknown capabilityIds
3. Document which capability IDs are valid for each SPI type

---

### Issue 5: ExternalAdapterPlugin adapterType union is incomplete

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 228-236  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/asset-production-adapter.ts`  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/livestream-adapter.ts`  

**Problem:** `ExternalAdapterPlugin.adapterType` defines a closed union of 8 adapter types:
```typescript
adapterType:
  | "github"
  | "jira"
  | "notion"
  | "figma"
  | "unity_cloud_build"
  | "obs_streaming"
  | "ad_platform"
  | "crm_analytics";
```

However, `asset-production-adapter.ts` and `livestream-adapter.ts` exist in `src/plugins/adapters/` but the file `index.ts` does not export them. These adapters may define their own `adapterType` values that are not in the union, or may not be registered at all. The closed union means any new adapter type added to the codebase would require a schema update in plugin-spi.ts.

**Severity:** low  

**Recommended fix:** Either expand the union to include all known adapter types, or change `adapterType` to `z.enum()` with a documented extension point.

---

### Issue 6: DomainRegistryService plugin type resolution uses inconsistent normalization

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts`  
**Line:** 420-435  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts`  
**Line:** 437-457  

**Problem:** `normalizePluginManifestType()` at lines 420-435 maps `"planner"` → `["tool"]`, `"presenter"` → `["tool"]`, and `"validator"` → `["evaluator"]`. This means when a domain declares a binding with pluginType `"validator"`, the registry resolves it against plugins with SPI type `"evaluator"` (per the mapping). But no plugin actually declares `spiType: "evaluator"` (see Issue 3). This creates a resolution gap where validator bindings cannot find validator plugins because the type normalization maps to a non-existent type.

**Severity:** critical  

**Recommended fix:** Fix the type normalization to map `"validator"` → `["validator"]` directly, or ensure all validator plugins declare `spiType: "evaluator"` if that is the intended normalization target.

---

### Issue 7: DomainValidatorPlugin.domainId is required but plugins may not have one

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 158-160  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 401, 461  

**Problem:** `DomainValidatorPlugin` interface requires `domainId: string` (line 160), but both `createBasicValidatorPluginInternal()` and `createBasicEvaluatorPluginWithScoring()` set `domainId: "core"`. This hardcoded "core" domain may not exist in the domain registry, causing domain binding validation at domain-registry-service.ts lines 395-397 to fail:
```typescript
if (registryRecord.manifest.domainIds.length > 0 && !registryRecord.manifest.domainIds.includes(parsed.domainId)) {
  throw this.validationError("domain_registry.plugin_domain_not_allowed", ...);
}
```

**Severity:** high  

**Recommended fix:** 
1. Document that validator plugins in the core domain should use `domainId: "core"` and ensure this domain exists
2. Or make `domainId` optional in `DomainValidatorPlugin` for cross-domain validators
3. Or ensure `PluginSpiRegistry` default manifest includes "core" in domainIds for validator plugins

---

### Issue 8: Adapter instantiation bypass in PluginSpiRegistry

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi-registry.ts`  
**Line:** 47-74  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/index.ts`  
**Line:** 1-5  

**Problem:** The `PluginSpiRegistry` builds default manifests in `defaultManifestFor()` without knowing plugin-specific adapter types. Adapters created via `createGithubAdapterPlugin()`, `createCrmAdapterPlugin()`, etc. return fully instantiated plugin objects with `adapterType` set. However, `defaultManifestFor()` at line 56 sets `extensionKind: "external_adapter"` based solely on `plugin.spiType === "adapter"`, without checking if the plugin actually has an `adapterType` that matches the `ExternalAdapterPlugin` interface. If an adapter plugin is missing `adapterType`, it would still be registered as an external adapter.

**Severity:** low  

**Recommended fix:** In `defaultManifestFor()`, add validation that if `plugin.spiType === "adapter"`, the plugin must have a valid `adapterType` property matching the `ExternalAdapterPlugin` interface.

---

### Issue 9: github-adapter capabilityIds include unregistered prefixes

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/adapters/github-adapter.ts`  
**Line:** 197  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi-registry.ts`  
**Line:** 144-148  

**Problem:** github-adapter.ts declares `capabilityIds: ["external.github", "external.github.issue", "external.github.workflow"]`. These are dot-separated hierarchical capability IDs. There is no documented schema for how capability IDs should be formatted or validated. The registry accumulates them but never validates they match any known pattern. The `"external.*"` prefix suggests a namespace convention, but this is not enforced.

**Severity:** low  

**Recommended fix:** Document the capability ID naming convention and add a regex validation in `PluginSpiRegistry.register()` for capability ID format.

---

### Issue 10: EvaluatorAssessment return type not exposed in SPI

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 62-74  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 158-192  

**Problem:** `evaluateWithLegacyScoring()` returns `EvaluatorAssessment` which is a richer result type than the basic `DomainValidatorPlugin.validate()` return type. The `DomainValidatorPlugin` SPI only exposes `evaluation?: { qualityScore, qualityThreshold, goalDeviation, riskFindings, harnessDecision }` as an optional sub-object. The `EvaluatorAssessment` also includes `deviationAnalysis`, `riskAssessment`, `recommendations` which are not part of the SPI. Callers using the SPI interface cannot access these additional fields without casting.

**Severity:** medium  

**Recommended fix:** Either:
1. Expand the `DomainValidatorPlugin.validate()` return type to include all `EvaluatorAssessment` fields
2. Add a separate `DomainEvaluatorPlugin` SPI interface with `evaluate()` returning `EvaluatorAssessment`
3. Document that callers should cast to `EvaluatorAssessment` for full result access

---

### Issue 11: ValidatorResult type conflicts between basic-evaluator and domain SPI

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/plugins/validators/basic-evaluator.ts`  
**Line:** 419-430  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/plugin-spi.ts`  
**Line:** 169-191  

**Problem:** The basic-evaluator returns from `validate()`:
```typescript
{
  valid: boolean;
  errors: Array<{ field: string; message: string; severity: "error" | "warning" }>;
  suggestions: string[];
  evaluation: { qualityScore, qualityThreshold, goalDeviation, riskFindings, harnessDecision };
}
```

The SPI defines the same structure but `evaluation` is marked optional (`evaluation?:`). The basic-evaluator always provides `evaluation` (it's not optional in the actual return), but the type signature says it might be undefined. This creates a false type mismatch - callers checking `if (result.evaluation)` would always pass but the type suggests it might not exist.

**Severity:** low  

**Recommended fix:** Make `evaluation` required in `DomainValidatorPlugin` if all validator implementations provide it, or clarify in ADR which validators may omit it.

---

### ADR Gaps Identified

1. **No ADR for validator/evaluator separation** - The codebase has both `validator` and `evaluator` SPI types but no documented policy for when each should be used. `DomainValidatorPlugin.validate()` returns a basic result while `evaluate()` (not in SPI) returns richer assessment. An ADR should define this hierarchy.

2. **No ADR for capability ID namespace convention** - Capability IDs like `"output.validate"`, `"external.github"`, `"external.github.issue"` follow a dot-separated hierarchy but no ADR documents the naming rules or validation requirements.

3. **No ADR for core domain semantics** - Several plugins hardcode `domainId: "core"` but the domain registry service validates against manifest domainIds. An ADR should clarify whether "core" is a reserved domain for cross-cutting plugins or if it must be explicitly registered.

4. **No ADR for adapter type schema extensibility** - The `ExternalAdapterPlugin.adapterType` is a closed union. No ADR documents the process for adding new adapter types.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 4     |
| Medium   | 4     |
| Low      | 4     |
| **Total**| 13    |

**ADR Gaps:** 4 identified

**Most Impactful Issues:**

1. **Critical:** DomainRegistryService validator type normalization (Issue 6) maps `"validator"` → `["evaluator"]` but no plugin uses `spiType: "evaluator"`, creating a resolution gap that would prevent validator plugins from being found by domain bindings.

2. **High:** DomainValidatorPlugin.validate() input type mismatch (Issue 1) - basic-evaluator receives a simpler `machineOutput.payload` but the SPI expects full `MachineOutput` with `nodeId`, `nodeRunId`, etc.

3. **High:** `evaluate()` and `produceHarnessDecision()` not in SPI (Issue 2) - These methods exist on the plugin object but are not part of the declared interface.

4. **High:** Hardcoded `domainId: "core"` (Issue 7) - Validator plugins hardcode "core" domain which may not exist in the registry, causing binding validation failures.

5. **High:** `PluginSpiRegistry` manifest domainId accumulation (Issue 7) - When `"domainId" in plugin` is false, domainIds are accumulated only from manifest sources without fallback to "core".

The most critical cross-module issue is the validator/evaluator type confusion combined with the domain binding resolution logic in `DomainRegistryService.normalizePluginManifestType()` which would silently fail to bind validator plugins to domains.



---

## Cross-Review: integration tests ↔ modules

### File Coverage

- **Integration tests reviewed:**
  - `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/integration/domains-runtime-orchestrator.test.ts`
  - `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/integration/cross-plane-event-propagation.test.ts`
- **Module implementations reviewed:**
  - `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (1005 lines)
  - `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` (234 lines)

---

### Cross-Module Issue 1: Integration Tests Never Verify Event Propagation to LayeredEventInbox

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 38-152, 158-289, 678-760)
- Module: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 249, 294, 373, 420, 468, 591, 692, 763)

**Problem:** `OapeflirLoopService.run()` calls `emitStageEvent()` at multiple points (observe completion at line 249, assess at line 294, plan at line 373, execute at line 420, feedback at line 468, learn at 591, improve at 692, release at 763). However, the integration tests in `cross-plane-event-propagation.test.ts` create a `createE2EHarness()` but never verify that events are actually emitted or that they would propagate to a `LayeredEventInbox`. The test harness does not include a `LayeredEventInbox` instance that would receive these events.

The test file header (lines 1-20) documents "Event propagation between orchestration → execution → state-evidence" as a coverage gap (R9-30), but the implemented tests still do not verify event delivery to the inbox.

**Severity:** high

**Recommended fix:** Add integration test setup that creates an `LayeredEventInbox` with registered consumers and verifies that after calling `runMultiStepOrchestration()`, events appear in the inbox via `peek()` or `drain()`. Check that consumer kind filtering (`canConsumerReceive`) correctly routes `PlatformFactEvent` to "truth" consumers and `OapeflirViewEvent` to "projection" consumers.

---

### Cross-Module Issue 2: Integration Tests Do Not Verify FSM Stage Transition Calls

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 295-479, 678-760)
- Module: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 214-224, 252-259, 297-304, 388-395, 449-456, 565-572, 631-637, 695-702)

**Problem:** `OapeflirLoopService.run()` creates an FSM via `createStageTransitionFSM()` at line 214 and calls `fsm.recordStageEntry()`, `fsm.recordStageCompletion()`, and `fsm.recordStageSkipped()` at each stage boundary. The integration tests call `runMultiStepOrchestration()` but never verify:
- That `observe` transitions to `assess` before assess stage runs
- That `assess` transitions to `plan` before plan stage runs  
- That invalid state transitions throw errors at FSM boundaries

The test "integration: OAPEFLIR FSM validation - harness run respects state machine" (lines 295-479) only tests the `TransitionService` FSM, not the OAPEFLIR stage transition FSM.

**Severity:** high

**Recommended fix:** Add integration tests that inject invalid FSM transitions (e.g., call `fsm.resetToStage("execute")` directly from "observe") and verify that `OapeflirLoopService` throws `Error("FSM transition denied: ...")` at the correct boundary.

---

### Cross-Module Issue 3: Budget Reservation Not Verified in Integration Tests

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 485-543, 678-760)
- Module: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 410-413)

**Problem:** At line 412-413, `OapeflirLoopService.run()` calls `await this.reserveBudgetForExecution(executionContext, input.taskId)` BEFORE `executeViaBridge()`. This is R4-25 (INV-BUDGET-001) fix per the comment. However, integration tests in `cross-plane-event-propagation.test.ts` that use `runMultiStepOrchestration()` never verify:
- That budget is reserved before execution begins
- That insufficient budget causes appropriate error handling
- That budget ledger is updated after execution completes

The `runMultiStepOrchestration()` at line 490 in the test file triggers OAPEFLIR execution but the harness setup does not include budget ledger verification.

**Severity:** high

**Recommended fix:** Add integration tests that verify budget reservation by checking the budget ledger state before and after execution. Test that when `BudgetAllocator.reserve()` fails (e.g., due to insufficient funds), the execution path properly aborts rather than proceeding.

---

### Cross-Module Issue 4: Legacy Event Type Acceptance Not Verified in Integration Tests

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (all tests use `task:*`, `workflow:*`, `execution:*` events)
- Module: `src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` (lines 112-127, 199-233)

**Problem:** `LayeredEventInbox.append()` at lines 112-127 accepts legacy event types via `isLegacyEventType()` check at line 115. The function accepts events starting with `task:`, `workflow:`, `execution:`, `session:`, `division:`, etc. (lines 201-233). Integration tests use `task:status_changed` and `execution:started` transitions via `TransitionService`, but none of the tests verify that:
1. The `LayeredEventInbox` accepts these legacy event types without throwing
2. The filtering via `canConsumerReceive()` correctly handles legacy events for different consumer kinds
3. Compaction (line 123-126) correctly preserves or evicts legacy events

**Severity:** medium

**Recommended fix:** Add integration test that creates a `LayeredEventInbox`, registers consumers of each kind (`truth`, `projection`, `audit`), appends legacy event types like `task:status_changed` and `workflow:step_completed`, then verifies that `peek()` and `drain()` return the correct events based on consumer kind.

---

### Cross-Module Issue 5: Integration Test Uses TransitionService but Doesn't Verify Event Inbox State

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 38-152)
- Module: `src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` (lines 94-182)

**Problem:** Test "integration: cross-plane event propagation - task status change emits PlatformFactEvent" (lines 38-152) creates entities and calls `ts.transitionTaskStatus()` (line 128) but only verifies the task status changed in the store (line 141-142). It never checks whether a `PlatformFactEvent` was appended to a `LayeredEventInbox`. The `TransitionService` should emit events, but the integration test doesn't set up an inbox to receive and verify them.

The comment at lines 144-147 acknowledges that "task transition emits its own plane event; execution status is advanced by explicit execution transitions" — but this is described, not verified.

**Severity:** medium

**Recommended fix:** Set up a `LayeredEventInbox` with registered consumers before calling `transitionTaskStatus()`. After the transition, call `inbox.peek(consumerId)` and verify the appropriate `PlatformFactEvent` was emitted and stored.

---

### Cross-Module Issue 6: DomainsRuntimeOrchestrator Test Uses Singleton Registry Without Proper Isoration from Other Tests

**Files:**
- Integration: `tests/integration/domains-runtime-orchestrator.test.ts` (lines 30-38)
- Module: `src/platform/shared/lifecycle/service-registry.js` (referenced but not reviewed)

**Problem:** The `test.beforeEach` (lines 30-33) and `test.afterEach` (lines 35-38) both call `registry.reset()`. This is correct isolation within this test file. However, the `cross-plane-event-propagation.test.ts` uses `createE2EHarness()` which creates its own database and store instances, but the two test files may run in parallel in some test runners, causing `ServiceRegistry` singleton state to leak between them.

The `domains-runtime-orchestrator.test.ts` at line 31 calls `ServiceRegistry.getInstance()` which is a global singleton. If `cross-plane-event-propagation.test.ts` also uses `ServiceRegistry` indirectly through `runMultiStepOrchestration()`, parallel execution could cause state contamination.

**Severity:** medium

**Recommended fix:** Ensure `createE2EHarness()` does not depend on `ServiceRegistry` singleton, or add `ServiceRegistry.getInstance().reset()` to the `finally` blocks in `cross-plane-event-propagation.test.ts`. Document whether tests are intended to run sequentially or in parallel.

---

### Cross-Module Issue 7: Integration Tests Never Verify Loop Controller Decision Impact

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 678-760)
- Module: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 358, 487, 508-510, 799-840)

**Problem:** `OapeflirLoopService` uses `HarnessLoopController` to track iteration cost (line 487), replan count (line 508), and guard violations (line 509). The `harnessDecision` at lines 799-840 is computed from loop controller state. Integration tests call `runMultiStepOrchestration()` but never:
- Verify that `loopController.recordIteration()` is called after each execute stage
- Verify that `loopController.getGuardViolation()` returning non-null causes `harnessDecision.action === "abort"`
- Verify that `loopController.recordReplan()` is called when `shouldReplan === true`

**Severity:** medium

**Recommended fix:** Add integration test that executes a plan with `stepOutputOverrides` that force replanning, then verify `harnessDecision.decisionKind === "replan"` and `action === "replan"`. Also test a scenario that triggers guard violations (excessive iterations or budget exhaustion) and verify `action === "abort"`.

---

### Cross-Module Issue 8: Cursor Management for Multiple Consumers Never Tested

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (no test exists)
- Module: `src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` (lines 133-169)

**Problem:** `LayeredEventInbox.drain()` at line 143-169 correctly updates consumer cursor via `setCursor(consumerId, nextCursor)` at line 167. This allows multiple consumers to independently consume events from the same inbox without missing or duplicating events. However, no integration test:
- Registers multiple consumers of different kinds
- Has one consumer drain events
- Verifies the other consumer still sees the same events (not affected by first consumer's drain)

The `peek()` method at line 133 respects consumer cursor position, but cursor management is only tested in unit tests (if at all), not in cross-plane integration tests.

**Severity:** high

**Recommended fix:** Add integration test: create inbox, register `consumerA` (kind: "truth") and `consumerB` (kind: "projection"), append mixed events (platform facts + OAPEFLIR view events), drain from `consumerA`, then verify `consumerB` still sees all events when peeking. This validates independent cursor behavior.

---

### Cross-Module Issue 9: Integration Tests Don't Verify Compact Behavior Affects Consumers

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (no test exists)
- Module: `src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` (lines 67-91, 123-126)

**Problem:** `LayeredEventInbox.append()` at line 123-126 calls `compact()` after every append with `MAX_RECORDS = 10_000` and `COMPACTION_RETENTION_RATIO = 0.5` (lines 96-98). The `compact()` method at line 67 removes old records based on the minimum cursor across all consumers. Integration tests never verify:
- What happens when events are added beyond `MAX_RECORDS`
- Whether consumers with lower cursors lose events first
- How `compact()` handles the case where one consumer has already drained events ahead of others

**Severity:** medium

**Recommended fix:** Add integration test that appends more than 10,000 events, then verifies that consumers with higher cursors (more advanced drain position) retain events while consumers with lower cursors may have events removed by compaction. Verify that `compact()` returns the correct number of removed records.

---

### Cross-Module Issue 10: DomainsRuntimeOrchestrator Test Assumes Startup Order but Implementation May Differ

**Files:**
- Integration: `tests/integration/domains-runtime-orchestrator.test.ts` (lines 52-58, 88-99, 175-182)
- Module: `src/domains-runtime-orchestrator.js` (referenced, not fully reviewed)

**Problem:** Test at lines 52-58 asserts `result.startupOrder === ["ring1", "ring2", "ring3"]`. Test at lines 88-99 asserts step dependencies: ring2 depends on ring1 bootstrap service ID, ring3 depends on ring2 bootstrap service ID. Test at lines 175-182 asserts `initializedDependencyServiceIds` for each step.

These tests assume a specific ring ordering and dependency chain. However, if `DomainsRuntimeOrchestrator.prepare()` implementation changes the ring order or dependency resolution, these tests would fail without the underlying behavior being incorrect — only the expected values being stale.

**Severity:** medium

**Recommended fix:** Add comment in the test file noting that these exact values (`ring1`, `ring2`, `ring3` sequence and dependencies) are contractual and must be updated if ring ordering changes. Alternatively, derive expected startup order from the actual `DOMAIN_RING_BOOTSTRAP_SERVICE_IDS` constants dynamically rather than hardcoding the sequence.

---

### Cross-Module Issue 11: OapeflirLoopSupport emitStageEvent Not Implemented in Tests

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 678-760)
- Module: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (line 249, 294, etc. call `this.emitStageEvent()`)
- Module: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.ts` (parent class, not reviewed)

**Problem:** `OapeflirLoopService` extends `OapeflirLoopSupport`. The `emitStageEvent()` method is called throughout `run()` but its implementation is in the parent class `OapeflirLoopSupport`. Integration tests that use `createE2EHarness()` do not set up a test harness that captures `emitStageEvent()` calls. Without a mock event publisher, there's no way to verify that stage events are emitted correctly.

**Severity:** medium

**Recommended fix:** Pass a mock `TypedEventPublisher` via `eventPublisher` option to `OapeflirLoopService` in integration tests. After `runMultiStepOrchestration()`, verify that `emitStageEvent` was called with correct stage names and payload attributes (e.g., `status: "completed"`).

---

### Cross-Module Issue 12: TransitionService Emits Events But Inbox Not Checked

**Files:**
- Integration: `tests/integration/cross-plane-event-propagation.test.ts` (lines 128-147)
- Module: `src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` (lines 184-192)

**Problem:** At line 144-147, the test comment acknowledges "task transition emits its own plane event; execution status is advanced by explicit execution transitions, not implicitly by task status updates." The test correctly identifies this behavior but doesn't verify it by checking an event inbox. The `TransitionService` likely calls event emission within the transaction at lines 128-138, but without an inbox to capture and verify events, the test only checks store state, not event emission.

**Severity:** low

**Recommended fix:** After `ts.transitionTaskStatus()`, query the event inbox to verify an event was emitted. This validates the event sourcing aspect, not just the state transition.

---

### ADR Gaps Identified

1. **No ADR for cross-plane event propagation verification strategy** - Integration tests don't verify event delivery to `LayeredEventInbox`. An ADR should specify how cross-plane events are tested (e.g., mock inbox vs real inbox in integration tests).

2. **No ADR for budget reservation enforcement in OAPEFLIR loop** - R4-25 introduces budget reservation before execution but integration tests don't verify the reservation/settlement lifecycle.

3. **No ADR for OAPEFLIR stage FSM testability** - The FSM is central to OAPEFLIR behavior but integration tests don't verify FSM state transitions. An ADR should specify how FSM transitions are tested (isolation vs integration).

4. **No ADR for consumer cursor independence in LayeredEventInbox** - Multiple consumers with independent cursors is an important correctness property that has no integration test coverage.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 4     |
| Medium   | 7     |
| Low      | 1     |
| **Total**| 12    |

**ADR Gaps:** 4 identified

**Most impactful issues:**
- **No event propagation verification** (High) - OAPEFLIR emits stage events but integration tests never verify they reach the `LayeredEventInbox`
- **No FSM stage transition verification** (High) - Stage transition FSM is central but not tested in integration
- **No budget reservation verification** (High) - R4-25 fix calls `reserveBudgetForExecution()` but tests don't verify it
- **No multi-consumer cursor independence test** (High) - `LayeredEventInbox` supports multiple independent consumers but this is never tested

**Root Cause Analysis:**
The integration tests were written to verify end-to-end execution through `runMultiStepOrchestration()` but omit verification of the internal state management mechanisms (event inbox, FSM, budget reservation, loop controller). These are implementation details that the tests treat as black boxes.

**Recommended Priority Actions:**
1. Add `LayeredEventInbox` setup to `cross-plane-event-propagation.test.ts` and verify event delivery
2. Add FSM stage transition verification tests
3. Add budget ledger state verification before/after execution
4. Add multi-consumer cursor independence test
5. Create ADR documenting the cross-plane event propagation verification strategy


## Cross-Review: scale-ecosystem ↔ execution

### Directory Coverage

**scale-ecosystem modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/fencing-token-service.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/rpo-rto-tracking.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/failover-controller/index.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/resource-manager/fair-scheduling-service.ts`

**five-plane-execution modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/recovery/runtime-recovery-service.ts`

---

## Issue 1: Dual Fencing Token Systems with No Coordination

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/fencing-token-service.ts` (lines 64-118, 157-217)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts` (lines 158-200, 622-749)

**Problem:** Two independent fencing token mechanisms exist with no coordination:

1. `FencingTokenService` (multi-region) manages region-level leadership with `epochCounter` incremented on `acquireLeadership()` (line 94). Token validation checks `epoch` match (lines 191-198).

2. `ExecutionLeaseService` manages per-execution leases with per-lease `fencingToken` incremented via `getLatestFencingToken(executionId) + 1` (line 173, 515). Token validation in `validateWriteAccess()` only checks workerId and leaseId (lines 703-720), never comparing against the multi-region fencing token.

During a region failover via `RegionFailoverController.resolve()`, the `FencingTokenService` epoch increments but `ExecutionLeaseService` has no mechanism to invalidate leases from the demoted region. A worker with an old lease could continue writing if its lease hasn't expired, bypassing the new region's leadership.

**Severity:** high

**Recommended fix:** Add a `validateFencingToken()` call in `ExecutionLeaseService.validateWriteAccess()` that checks the multi-region `FencingTokenService` when execution crosses region boundaries. Alternatively, add a `regionId` field to `ExecutionLeaseRecord` and validate that the lease's region matches the current leader.

---

## Issue 2: Preemption Victim May Have Active Dispatch Ticket

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/resource-manager/fair-scheduling-service.ts` (lines 75-77)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts` (lines 443-524)

**Problem:** `FairSchedulingService.schedule()` returns `victimExecutionId` from `choosePreemptionVictim()` (line 76) when quota is exceeded. However, the preemption candidate may already have been dispatched with an active lease in `ExecutionDispatchService`. The preemption decision does not check `ExecutionLeaseService.getActiveExecutionLease(victim.executionId)` before recommending the victim.

If a ticket is already claimed (lines 462-467 in dispatch service), preempting it causes a lease conflict. The worker holding the lease is not notified, and the execution may continue writing under a now-stale lease while the scheduling system believes resources were reclaimed.

**Severity:** high

**Recommended fix:** In `FairSchedulingService.schedule()`, before returning a `victimExecutionId`, call `ExecutionLeaseService.getActiveExecutionLease()` to verify the candidate does not have an active lease. If it does, exclude it from preemption or emit a warning.

---

## Issue 3: No Fencing Token Validation at Lease Grant Time

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/fencing-token-service.ts` (lines 157-217)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts` (lines 132-200)

**Problem:** `ExecutionLeaseService.acquireLeaseWithinTransaction()` grants leases without any fencing token validation. There is no call to `FencingTokenService.validateFencingToken()` to ensure the current region holds valid leadership before allowing new leases. This means:

1. Region A is primary, region B is follower
2. Region A's leadership epoch advances via failover to B
3. A worker in region A could still acquire a lease for an execution if the leadership state hasn't propagated

The comment at `execution-lease-service.ts` line 172 says "Fencing token prevents split-brain" but this only refers to the per-lease token, not the multi-region leadership token.

**Severity:** high

**Recommended fix:** Add an optional `fencingToken` parameter to `acquireLease()` and validate it against `FencingTokenService` when multi-region fencing is enabled. Alternatively, add a `requireLeadershipToken()` method that `ExecutionDispatchService` calls before dispatch.

---

## Issue 4: Region Failover Doesn't Invalidate Active Leases

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/failover-controller/index.ts` (lines 292-413)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts` (lines 588-605)

**Problem:** `RegionFailoverController.resolve()` (line 292) computes the failover decision including `reconciliationResult` but `ExecutionLeaseService.reclaimExpiredLeases()` is never called for the demoted region's leases. The reconciliation job (lines 381-393) checks for "pendingWriteCount, openBudgets, outboxMessages, restrictedWrites" but not for active execution leases.

If region A fails over to region B, any leases held by workers in region A remain active until their TTL expires naturally. Workers in region A could continue executing against the old epoch.

**Severity:** high

**Recommended fix:** After failover, the `ReconciliationJobInput` should include a step to call `ExecutionLeaseService.reclaimActiveLease()` for all executions that had leases in the demoted region. Add a `regionId` field to `ExecutionLeaseRecord` to enable efficient querying of leases by region.

---

## Issue 5: Starved Queue Items Not Prioritized in Dispatch

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/resource-manager/fair-scheduling-service.ts` (lines 68-70)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts` (lines 195-208)

**Problem:** `FairSchedulingService.schedule()` computes `starvedItemIds` as items with `ageMs >= 15 * 60_000` (line 69). However, `ExecutionDispatchService.dispatchNext()` calls `sortTicketsForDeterministicDispatch()` and `interleaveTicketsByTenant()` (lines 207-208) with no integration point that boosts priority for starved items.

The fair scheduling starved detection is never used to accelerate dispatch. Items that have been waiting for 15+ minutes are not given preferential treatment in the dispatch queue.

**Severity:** medium

**Recommended fix:** Add a `starvedItemIds` parameter to `DispatchExecutionOptions` or a separate `boostStarvedItems()` call that `FairSchedulingService` drives. When dispatching, `ExecutionDispatchService` should check if a ticket's executionId appears in the starved set and apply a priority boost.

---

## Issue 6: RPO/RTO Tracking Not Consulted Before Recovery Decisions

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/rpo-rto-tracking.ts` (lines 391-410)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/recovery/runtime-recovery-service.ts` (lines 346-374)

**Problem:** `RpoRtoTrackingService.assertSlaCompliance()` (line 391) throws if RPO or RTO targets are breached. `RuntimeRecoveryService.listRecoverableExecutingRuns()` (line 346) and `listStaleRuns()` (line 372) build recovery candidates but never call `assertSlaCompliance()` or check `getSlaCompliance()` before recommending recovery actions.

Recovery recommendations may be generated for executions in a region that is already in breach of its RTO. The recovery action itself (e.g., `retry_new_ticket`) would add load to a degraded system.

**Severity:** medium

**Recommended fix:** Before returning recovery candidates, `RuntimeRecoveryService` methods that list candidates for a breached region should check `RpoRtoTrackingService.getSlaCompliance()`. If RTO is breached, return candidates with `suggestedAction: "escalate_takeover"` to prevent automated retry from加重ing the outage.

---

## Issue 7: ReconciliationJobInput Excludes Execution Lease State

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/failover-controller/index.ts` (lines 381-393)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/failover-reconciliation-job.ts` (lines 1-100, not fully reviewed)

**Problem:** `ReconciliationJobInput` (failover-controller lines 382-392) includes `pendingWriteCount`, `pendingApprovals`, `openBudgets`, `outboxMessages`, `restrictedWrites`. It does not include active execution lease count, lease holder distribution, or stale lease count.

The reconciliation job cannot properly assess whether the new region can safely take over because it has no visibility into how many leases are active and in which state.

**Severity:** medium

**Recommended fix:** Add `activeLeaseCount`, `activeLeaseHolderRegionDistribution`, and `stalLeaseCount` to `ReconciliationJobInput`. The reconciliation job should block promotion if there are active leases in the demoted region with no available workers to take them over.

---

## Issue 8: Quota Evaluation Uses Hard Limits Without Failover Awareness

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/resource-manager/fair-scheduling-service.ts` (lines 62-67)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/resource-manager/quota-enforcer/index.ts` (lines 1-50, not fully reviewed)

**Problem:** `FairSchedulingService.schedule()` calls `evaluateMultiDimensionalQuota()` with `workerUnits` as the rejection threshold (line 64). The quota enforcement uses hard limits configured per tenant. If a region failover occurs, the quota state may be stale (pending writes from the demoted region not yet replicated), leading to incorrect rejection of valid scheduling requests.

**Severity:** medium

**Recommended fix:** Add a `quorumRegionCount` parameter to `FairSchedulingRequest` that indicates how many regions must acknowledge quota state before enforcing hard limits. During degraded state (fewer than quorum regions), use soft limits or defer to the new primary region's quota assessment.

---

## Issue 9: Execution Recovery Suggests resume_same_worker Without Checking Worker Region

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/recovery/runtime-recovery-service.ts` (lines 724-768)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/failover-controller/index.ts` (lines 292-413)

**Problem:** `RuntimeRecoveryService` returns `suggestedAction: "resume_same_worker"` (line 761-764) for executions with `status === "executing"` that are below attempt thresholds. This recommendation does not check whether the original worker is in the same region as the current primary.

If a region failover occurred, the "same worker" may be in the demoted region and unreachable. Retrying on the same (now unreachable) worker would stall indefinitely.

**Severity:** high

**Recommended fix:** Add `workerRegionId` to `RuntimeRecoveryCandidate`. In `inferSuggestedAction()`, if the action is `resume_same_worker`, verify that `workerRegionId` matches the current primary region. If not, downgrade to `retry_new_ticket`.

---

## Issue 10: Dispatch Preemption Doesn't Invalidate Prior Lease

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts` (lines 348-388)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts` (lines 305-359)

**Problem:** `ExecutionDispatchService` supports emergency lane preemption (lines 348-388) via `ExecutionPriorityPreemptionService.preemptForUrgentTicket()`. However, when a new ticket is dispatched to replace a preempted one, `ExecutionLeaseService.releaseLease()` is not called for the preempted ticket's lease.

The preemption only creates a new ticket for the urgent execution; the old ticket's lease remains active until it expires naturally. This means two executions (preempted old + urgent new) could overlap if the old worker doesn't release the lease.

**Severity:** high

**Recommended fix:** After `preemptForUrgentTicket()` succeeds, call `ExecutionLeaseService.releaseLease()` for the preempted ticket's leaseId with reasonCode `"preempted_for_urgent_dispatch"`.

---

## Issue 11: Heartbeat Staleness Check Uses 30s Threshold Not Aligned with RTO

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts` (lines 579-588)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/rpo-rto-tracking.ts` (lines 18-24)

**Problem:** `ExecutionDispatchService` uses a hardcoded `heartbeatStalenessThresholdMs = 30_000` (line 580) to reject workers with stale heartbeats. `RpoRtoTrackingService` has configurable `RpoRtoTarget.rtoMs` per region pair (line 22), but there is no integration.

If the RTO target for a region pair is 5 minutes but the heartbeat threshold is 30 seconds, the dispatch service could mark workers as unavailable before the failover logic would actually trigger a failover.

**Severity:** low

**Recommended fix:** Derive the heartbeat staleness threshold from the RTO target: `heartbeatStalenessThresholdMs = Math.min(30_000, targetRtoMs * 0.1)` or make it configurable per region pair. Add a comment explaining the relationship between heartbeat staleness and RTO.

---

## Issue 12: Fencing Token Persistence Path Uses Process CWD

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/multi-region/fencing-token-service.ts` (lines 325-338)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts` (lines 256-308)

**Problem:** `resolveFencingTokenStoragePath()` (line 337) defaults to `join(process.cwd(), "data", "multi-region", "fencing-token-state.json")`. `ExecutionLeaseService` uses `AuthoritativeTaskStore` for persistence (lines 183, 274, 337). The fencing token state and lease state are persisted to different backends.

During a region failover, the fencing token state file may not be accessible from the new region if it was stored locally in the old region. The lease state (in the SQL store) would be replicated, but the fencing token epoch counter would not be.

**Severity:** high

**Recommended fix:** Move `FencingTokenService` persistence to the same `AuthoritativeSqlDatabase` that `ExecutionLeaseService` uses, so that both states are replicated together. Alternatively, document clearly that the fencing token state file must be on shared storage accessible from all regions.

---

## ADR Gaps Identified

1. **No ADR for dual fencing token system coordination** - Two independent fencing mechanisms (multi-region leadership vs per-execution lease) exist without a documented policy for how they interact during failover. No ADR specifies whether the lease-level token should be invalidated when the region-level token changes.

2. **No ADR for execution recovery during region failover** - When a region failover occurs, active executions must be handled. The policy for whether they should be: (a) allowed to complete on the old worker, (b) forcibly terminated, or (c) migrated to the new region — is not documented. `RuntimeRecoveryService` is not aware of failover state.

3. **No ADR for RPO/RTO impact on recovery strategy** - When an RTO breach occurs, the recovery strategy should change. For example, `retry_new_ticket` is inappropriate during an active outage because it adds load. No ADR documents how RPO/RTO status should gate recovery actions.

4. **No ADR for preemption safety when victims have active leases** - The preemption algorithm in `FairSchedulingService` assumes preemption means resource reclamation. But if the victim has an active dispatch lease, preemption is not sufficient to actually reclaim resources. No ADR documents the safety requirements for preemption.

5. **No ADR for heartbeat staleness threshold derivation** - The 30-second heartbeat staleness threshold is hardcoded but should derive from RTO configuration. No ADR documents the relationship between operational timeouts (heartbeat, RTO, RPO) and how they should be consistently derived.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 7     |
| Medium   | 4     |
| Low      | 1     |
| **Total**| 12    |

**ADR Gaps:** 5 identified

**Most Impactful Issues:**

1. **Dual fencing token systems with no coordination (High)** - Region leadership tokens and execution lease tokens operate independently, allowing split-brain scenarios during failover when old leases remain valid.

2. **Region failover doesn't invalidate active leases (High)** - During failover, `ExecutionLeaseService` leases from the demoted region are not reclaimed. Workers continue executing under stale leases.

3. **Preemption victim may have active dispatch ticket (High)** - `FairSchedulingService` recommends preemption without checking if the victim has an active lease in `ExecutionDispatchService`.

4. **Execution recovery suggests resume_same_worker without region check (High)** - Recovery recommendations don't verify the original worker is reachable after a region failover.

5. **Dispatch preemption doesn't invalidate prior lease (High)** - Emergency lane preemption creates a new ticket but doesn't release the preempted ticket's lease, allowing overlapping executions.

**Root Cause Analysis:**
The scale-ecosystem modules (multi-region, resource-manager) implement global consistency guarantees (fencing tokens, fair scheduling, RPO/RTO) but the five-plane-execution modules (dispatch, lease, recovery) operate with local state that can become stale after global state changes (failover, preemption). The integration gaps stem from:
1. No shared source of truth for region leadership vs per-execution lease state
2. No callback hooks from failover controller to execution lease service
3. No integration between RPO/RTO tracking and recovery action recommendation
4. No cross-check between preemption decisions and active dispatch state

**Recommended Priority Actions:**
1. Add `FencingTokenService` validation to `ExecutionLeaseService.validateWriteAccess()` for multi-region deployments
2. Add lease invalidation to `RegionFailoverController` post-failover reconciliation
3. Add worker region check to `RuntimeRecoveryService.inferSuggestedAction()`
4. Add heartbeat staleness threshold derivation from RTO configuration
5. Create ADR documenting the dual fencing token coordination policy



## Cross-Review: business-pack ↔ domains

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/business-pack/` - business-pack module
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/` - domain registry module
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/operations/` - domain onboarding module

Key files reviewed:
- `business-pack/business-pack-manifest.ts` - pack manifest with lifecycle stages and sandbox tier
- `business-pack/pack-lifecycle-service.ts` - pack lifecycle state machine
- `business-pack/pack-registry-service.ts` - pack registration and discovery
- `business-pack/pack-domain-association.ts` - pack-domain linking
- `domains/registry/domain-registry-service.ts` - domain lifecycle management
- `domains/registry/domain-model.ts` - domain definition with securityLevel and trustTier
- `domains/registry/domain-smoke-test.ts` - sandbox compatibility check
- `domains/operations/domain-onboarding-service.ts` - domain onboarding phases
- `domains/operations/index.ts` - onboarding phase definitions

---

## Issue 1: Pack Lifecycle and Domain Lifecycle State Machines Are Not Aligned

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/business-pack/business-pack-manifest.ts`  
**Lines:** 123-128

**Problem:** Pack lifecycle stages are: `draft → certifying → published → deprecated → archived`. Domain lifecycle stages are: `draft → validated → registered → canary → active → updating → deprecated → archived`. The two state machines have incompatible stage progressions:
1. Pack has `certifying` while domain has `canary` - these serve similar "testing/review" purposes but have different names and no cross-reference mechanism
2. Pack transitions `certifying → published` directly, but domain goes through `canary → active`
3. Pack has no equivalent to domain's `canary` stage - a pack can go from `certifying` (under review) to `published` (available) without an intermediate canary-like staging period
4. Pack lifecycle allows `draft → archived` transition (line 138), but domain has no such direct path

**Severity:** high

**Recommended fix:** Add `canary` stage to pack lifecycle to match domain lifecycle, or establish a formal mapping/adapter between `certifying ↔ canary` states. Document the relationship in an ADR.

---

## Issue 2: Domain Onboarding Phase `pack_development` Has No Integration with Pack Lifecycle

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/operations/domain-onboarding-service.ts`  
**Lines:** 6-11, 50-99

**Problem:** Domain onboarding phase sequence is: `domain_modeling → pack_development → security_certification → gray_rollout`. The `pack_development` phase implies pack creation/development but:
1. `DomainOnboardingService.advance()` does not check or update pack lifecycle state
2. A domain could complete `pack_development` phase while its associated pack is still in `draft` or any other state
3. Pack lifecycle state changes (e.g., `draft → certifying`) are not gated by domain onboarding phase completion
4. There is no cross-service validation that "pack is ready for certification" when domain onboarding enters `security_certification` phase

**Severity:** high

**Recommended fix:** Add cross-service validation in `DomainOnboardingService.advance()` when transitioning to `security_certification` phase: verify that the associated pack (via `PackDomainAssociationService`) is in `certifying` or later stage, or transition it to `certifying`.

---

## Issue 3: Domain Onboarding Phase `security_certification` Does Not Trigger Pack Certification

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/operations/domain-onboarding-service.ts`  
**Lines:** 6-11, 68

**Problem:** The `security_certification` onboarding phase and the `certifying` pack lifecycle stage have the same semantic purpose (security/quality review before publishing), but:
1. Completing domain `security_certification` phase does not call `PackLifecycleService.submitForCertification()` or `certifyPack()`
2. Pack `certifying → published` transition does not verify domain onboarding has completed `security_certification`
3. There is a potential for a pack to be `published` while its domain is still in `security_certification` onboarding phase, or vice versa

**Severity:** high

**Recommended fix:** Establish a formal certification gate that coordinates both:
- Domain enters `security_certification` phase → pack transitions to `certifying`
- Pack transitions to `published` → domain completes `security_certification`
Consider adding a `CertificationCoordinator` service that enforces this coupling.

---

## Issue 4: Pack Sandbox Tier Not Validated Against Domain Security Level

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-smoke-test.ts`  
**Lines:** 106-118

**Problem:** `validateSandboxCompatibility()` checks that restricted tools require `securityLevel=restricted` in domain capabilities. However:
1. Pack manifest has its own `sandboxTier` field (business-pack-manifest.ts line 251) that is NOT validated against the domain's `securityLevel`
2. A pack could declare `sandboxTier: "read_only"` while associated with a domain that has `securityLevel: "restricted"` - this is a mismatch
3. `PackDomainAssociationService` links packs to domains but performs no compatibility validation
4. `DomainRegistryService.buildCapabilityEntry()` (line 332) only uses `domain.capabilities.securityLevel` for `trustTier`, ignoring pack's `sandboxTier`

**Severity:** high

**Recommended fix:** Add a cross-module sandbox tier / security level compatibility check in `PackDomainAssociationService.associatePackWithDomain()` and in `DomainRegistryService.buildCapabilityEntry()`:
- If pack `sandboxTier === "read_only"`, domain `securityLevel` must be `"standard"` or `"elevated"`
- If pack `sandboxTier === "restricted_exec"`, domain `securityLevel` must be `"restricted"`

---

## Issue 5: Domain's `trustTier` and Pack's `sandboxTier` Are Independent But Related Concepts

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts`  
**Lines:** 321-334

**Problem:** 
1. `DomainDefinition` has `trustTier: z.enum(["internal", "trusted", "community", "external"])` (domain-model.ts line 178)
2. `BusinessPackManifest` has `sandboxTier: z.enum(["read_only", "workspace_write", "scoped_external_access", "restricted_exec"])` (business-pack-manifest.ts line 251-254)
3. These are semantically related (both describe execution security boundaries) but:
   - No ADR documents the relationship between `trustTier` and `sandboxTier`
   - No validation enforces compatibility (e.g., `trustTier: "external"` should require `sandboxTier: "restricted_exec"`)
   - `DomainRegistryService.buildCapabilityEntry()` only exposes `domain.capabilities.securityLevel`, not pack's `sandboxTier`

**Severity:** medium

**Recommended fix:** Create ADR documenting the relationship between `trustTier` and `sandboxTier`. Add compatibility validation logic in pack registration or domain association.

---

## Issue 6: Pack Domain Association State Not Coordinated with Domain Lifecycle Transitions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/business-pack/pack-domain-association.ts`  
**Lines:** 59-78, 83-111

**Problem:** `PackDomainAssociationService` maintains pack-domain associations independently from domain lifecycle:
1. When a domain transitions to `deprecated` or `archived`, associated packs are not notified
2. When a pack transitions to `deprecated` or `archived`, domain association is not updated
3. `dissociatePackFromDomain()` at lines 83-111 does not check whether the domain is in a state that should prevent dissociation (e.g., domain is `active`)
4. Orphaned pack-domain associations can exist when domain is `archived` but pack is `published`

**Severity:** medium

**Recommended fix:** Add lifecycle state callbacks to `PackDomainAssociationService`:
- When domain is deprecated/archived, dissociate all associated packs or block the transition if packs are `published`
- When pack is deprecated/archived, remove association but preserve for audit

---

## Issue 7: Pack Lifecycle `certifying` Stage Missing Domain Verification Gate

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/business-pack/pack-lifecycle-service.ts`  
**Lines:** 118-126

**Problem:** `submitForCertification()` (line 118) transitions pack from `draft` to `certifying`, but does not verify:
1. The associated domain exists and is in an appropriate state (`registered` or later)
2. Domain onboarding has completed `pack_development` phase
3. The pack's `domainId` references a valid domain in `DomainRegistryService`

**Severity:** medium

**Recommended fix:** Add domain state verification in `submitForCertification()`:
- Query `DomainRegistryService` to verify the pack's `domainId` exists and is in `registered`, `canary`, or `active` state
- Query `DomainOnboardingService` to verify onboarding phase `pack_development` is complete

---

## Issue 8: Pack Registry and Domain Registry Are Independent With No Shared State Consistency

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/business-pack/pack-registry-service.ts`  
**Lines:** 79-106

**Problem:** 
1. Pack registration (`PackRegistryService.registerPack()`) does not verify the `domainId` exists in `DomainRegistryService`
2. Domain registration (`DomainRegistryService.register()`) does not check for existing packs in `PackRegistryService`
3. When a domain is `archived`, `PackRegistryService` still lists it as a valid domain for pack lookups
4. No orphaned-reference detection between the two registries

**Severity:** medium

**Recommended fix:** Add cross-registry validation in both registration paths:
- Pack registration: verify `domainId` exists and is not `archived`
- Domain registration: warn if packs already exist for that domainId (domain archival may need to handle existing packs)

---

## Issue 9: Domain Risk Level and Pack Risk Matrix Are Independent But Should Be Compatible

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts`  
**Lines:** 205-215, 246-304

**Problem:** 
1. Domain risk level (`DomainRiskLevel = "low" | "medium" | "high" | "critical"`) is defined in `risk-profile/index.ts`
2. Pack risk matrix (`BusinessPackRiskLevel = "low" | "medium" | "high" | "critical"`) is defined in `business-pack-manifest.ts`
3. Both use identical type definitions but there is no validation that:
   - A pack with `riskMatrix` entries of `level: "critical"` is associated with a domain that has `riskLevel: "critical"`
   - A domain with `riskLevel: "high"` doesn't have packs with only `low` risk entries (inadequate pack coverage)
4. `DomainRiskProfile` (risk-profile/index.ts) and `BusinessPackManifest.riskMatrix` are not linked

**Severity:** medium

**Recommended fix:** Add cross-validation when pack is associated with domain: pack's highest risk level in `riskMatrix` should not exceed domain's `defaultRiskLevel` by more than one tier. If pack is `critical` but domain is `low`, this is a security concern requiring explicit override.

---

## Issue 10: Domain Onboarding `gray_rollout` Phase Does Not Coordinate with Pack `published` State

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/operations/domain-onboarding-service.ts`  
**Lines:** 6-11, 68-76

**Problem:** Domain `gray_rollout` is the final onboarding phase before full activation. The pack lifecycle equivalent should be `published`. However:
1. `DomainOnboardingService.advance()` when completing `gray_rollout` (line 68) calls `this.promoteDomainToRegisteredIfNeeded()` and then `this.registry.activate()` (lines 71-75)
2. It does NOT verify or transition the associated pack to `published`
3. A domain could be `active` (fully onboarded) while its pack is still in `draft` or `certifying`

**Severity:** high

**Recommended fix:** When domain onboarding completes `gray_rollout` and activates the domain, also transition the associated pack to `published` via `PackLifecycleService`.

---

## Issue 11: No ADR Documents Pack-Domain Relationship Semantics

**File:** N/A - Architecture documentation gap

**Problem:** Several cross-module relationships lack ADR documentation:
1. Relationship between pack lifecycle stages and domain lifecycle stages (Issue 1)
2. Coupling between domain onboarding phases and pack lifecycle stages (Issues 2, 3, 10)
3. Compatibility rules between `trustTier`/`securityLevel` and `sandboxTier` (Issues 4, 5)
4. Pack domain association lifecycle during domain archival/deprecation (Issue 6)

**Severity:** medium

**Recommended fix:** Create ADR documenting:
1. Pack lifecycle stages and their relationship to domain lifecycle stages
2. Domain onboarding phase → pack lifecycle stage coordination rules
3. Security level / sandbox tier compatibility matrix
4. Pack-domain association behavior during domain/pack archival

---

## Issue 12: Duplicate Phase/Staging Naming Creates Confusion

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/operations/index.ts`  
**Lines:** 9-13 vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/business-pack/business-pack-manifest.ts`  
**Lines:** 123-128

**Problem:** 
- Domain onboarding has `security_certification` phase
- Pack lifecycle has `certifying` stage
- These are semantically similar but:
  1. Different terminology makes it unclear which one to use in documentation
  2. Code that refers to "certifying" could mean pack or domain context
  3. Error messages like "Pack must be in certifying stage" (pack-lifecycle-service.ts line 143) don't map clearly to domain onboarding phase

**Severity:** low

**Recommended fix:** Standardize terminology. Either:
- Rename pack `certifying` to `security_certification` to match domain onboarding, or
- Rename domain onboarding `security_certification` to `certifying`, or
- Document the equivalence explicitly in ADR

---

## ADR Gaps Identified

1. **No ADR for pack lifecycle and domain lifecycle relationship** - The two state machines operate independently with no documented mapping or coordination protocol.

2. **No ADR for domain onboarding phase to pack lifecycle stage coupling** - Domain `security_certification` should gate pack `certifying → published`, but this coupling is not documented.

3. **No ADR for trustTier/sandboxTier compatibility matrix** - No documented rules for which combinations are allowed (e.g., `trustTier: "external"` + `sandboxTier: "read_only"` might be invalid).

4. **No ADR for pack-domain association during archival** - When a domain or pack is archived/deprecated, the association state should be documented (preserve for audit? remove immediately?).

5. **No ADR for risk level alignment between domain and pack** - Domain risk level and pack risk matrix entries should be related but the rules are not documented.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 6     |
| Medium   | 6     |
| Low      | 1     |
| **Total**| 13    |

**ADR Gaps:** 5 identified

**Most Impactful Issues:**

1. **Pack Lifecycle and Domain Lifecycle Not Aligned (High)** - Incompatible stage progressions make cross-module coordination error-prone.

2. **Domain Onboarding `security_certification` Doesn't Trigger Pack Certification (High)** - A domain can be fully onboarded while its pack is not certified/published.

3. **Pack Sandbox Tier Not Validated Against Domain Security Level (High)** - Security boundary mismatch allowed (e.g., pack with `read_only` sandbox associated with `restricted` domain).

4. **Domain `gray_rollout` Doesn't Coordinate Pack `published` State (High)** - Domain can be `active` while associated pack is still in `draft`.

5. **Pack Registry and Domain Registry Independent (Medium)** - No orphaned-reference detection; domain archival doesn't handle existing packs.

6. **Risk Level / Sandbox Tier Semantic Gap (Medium)** - Two related concepts (`trustTier`/`sandboxTier`, domain risk/pack risk) have no documented compatibility rules.

**Root Cause Analysis:**

The business-pack module (§30 architecture) and domains module (§37 architecture) were designed with partially overlapping concerns:
- Both define lifecycle state machines with similar stages
- Both define security boundaries (sandbox tier vs security level/trust tier)
- Both define risk concepts (risk matrix vs risk profile)

However, the integration points were not fully specified:
1. No cross-registry validation between `PackRegistryService` and `DomainRegistryService`
2. No cross-lifecycle coordination between `PackLifecycleService` and `DomainOnboardingService`
3. No cross-security validation between pack's `sandboxTier` and domain's `securityLevel`/`trustTier`
4. No ADR documenting the intended relationship between these parallel concepts

**Recommended Priority Actions:**

1. Create ADR-027 documenting pack-domain relationship semantics (lifecycle coupling, security compatibility, archival behavior)
2. Add cross-registry validation in pack registration: verify domain exists and is not archived
3. Add domain state verification gate in `PackLifecycleService.submitForCertification()`
4. Add sandbox tier / security level compatibility validation in `PackDomainAssociationService.associatePackWithDomain()`
5. Coordinate `gray_rollout` completion with pack `published` transition
6. Standardize terminology (`certifying` vs `security_certification`) or document equivalence


## Cross-Review: agent-delegation ↔ org-governance

This section reviews the interaction points between the platform agent-delegation module (`src/platform/agent-delegation/` and `src/platform/five-plane-orchestration/agent-delegation/`) and the org-governance module (`src/org-governance/delegated-governance/` and `src/org-governance/approval-routing/`).

---

### Issue 1: Dual Delegation Tracking with Diverging Status Machines

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (line 132-143)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/delegation/index.ts` (lines 3-14, 19-45)

**Problem:** Platform `DelegationManagerService` uses a state-machine status model with statuses: `pending | pending_approval | discovery | bid | awarded | active | completed | failed | cancelled | expired | timed_out`. Org-governance `ApprovalDelegation` uses a time-activated model with `active: boolean` plus `startsAt`/`expiresAt`. When a platform delegation is in `pending_approval` state waiting for the org-governance approval flow, there is no bidirectional state synchronization between the two systems. The `ApprovalRoutingService` builds approver chains but does not create or update platform delegation records.

**Severity:** high

**Recommended fix:** Introduce a state bridge interface where `ApprovalRoutingService` calls back to `DelegationManagerService` to transition delegation status when approval is granted or denied. Alternatively, document that these are intentionally separate concerns and approval routing operates on a separate approval-chain concept rather than platform delegation state.

---

### Issue 2: Scope Manager and Topology Validator Use Different Organizational Models

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/scope-manager/index.ts` (lines 28-41)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/topology-validator.ts` (lines 190-205)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (lines 702-734)

**Problem:** `matchesGovernanceScope()` in org-governance scope-manager matches on `orgNodeIds` and `domainIds`. Platform `TopologyValidator` validates on `packId` and `agentId`. These represent orthogonal hierarchies: org chart (orgNode/domain) vs pack/agent hierarchy (packId). A governance delegation scoped to an orgNode does not prevent an agent within that orgNode from delegating across pack boundaries outside the org hierarchy. There is no validation that platform delegation chains respect org node boundaries.

**Severity:** high

**Recommended fix:** Add an org-node boundary check to `TopologyValidator.validate()` or `DelegationManagerService.delegate()`. When a delegation crosses org node boundaries, validate that the grantee has appropriate governance scope. Alternatively, document that platform delegation and org governance operate on independent scoping models by design.

---

### Issue 3: Guardrail Evaluation in Governance Does Not Influence Permission Narrowing

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegated-governance-service.ts` (lines 120-177)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/context-isolator.ts` (lines 54-87, 270-320)

**Problem:** `DelegatedGovernanceService.checkOperation()` evaluates governance guardrails (`max_risk_level`, `max_budget`, `forbidden_tools`) and returns a `GuardrailCheckResult`. However, `ContextIsolator.isolate()` narrows platform delegation permissions using only the parent context and delegation spec - it never consults governance guardrails. A governance guardrail that limits `max_budget` to 1000 does not reduce the platform delegation's `PermissionSet.constraints.maxTokens` accordingly. The two systems evaluate constraints independently.

**Severity:** high

**Recommended fix:** Add a `guardrailCheckResult: GuardrailCheckResult | null` parameter to `ContextIsolator.isolate()` or to `DelegationManagerService.delegate()`. When guardrails are present, apply their constraints to the narrowed permission set (e.g., cap `maxTokens` at `max_budget` guardrail value).

---

### Issue 4: Governance Revocation Saga Does Not Cancel Platform Delegations

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` (lines 60-156)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (lines 254-282)

**Problem:** `GovernanceDelegationRevocationSaga.revoke()` is a saga pattern for revoking governance delegations with cascade to derived resources. `DelegationManagerService.cancel()` handles platform delegation cancellation. These are completely independent - revoking a governance delegation does not trigger cancellation of any active platform delegations that relied on that governance grant. The saga has `freezeResource`, `revokePendingApprovals`, `revokeActiveSessions` handlers (lines 23-33) but no handler calls back to `DelegationManagerService` to cancel related delegations.

**Severity:** high

**Recommended fix:** Add a `platformDelegationCancellationHandler` to `GovernanceDelegationRevocationSagaHandlers` that calls `DelegationManagerService.cancel()` for delegations whose governance basis has been revoked. Alternatively, add a `DelegationManagerService.revokeByGovernanceDelegationId()` method that looks up active delegations linked to a governance delegation and cancels them.

---

### Issue 5: Derived Delegation Chain Not Tracked Across Platform/Governance Boundary

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegation-registry/index.ts` (line 72)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts` (line 72)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` (lines 107-114)

**Problem:** Both `GovernanceDelegation` (line 72) and `DelegationResult` (line 72 in delegation-types.ts) have a `derivedDelegationIds` field, but they are tracked independently and there is no unified chain. Platform `DelegationManagerService.updateDelegationChain()` (line 949) updates `chainStore` with platform delegation chain nodes, but governance-derived chains are not consulted. When the governance revocation saga reaches `maxCascadeScope >= 1` and calls `revokeDerivedDelegation` (line 110), it only revokes governance-derived delegations - platform delegation chains that were created under the revoked governance basis are not included in the cascade.

**Severity:** medium

**Recommended fix:** Add a cross-reference table or index linking governance `derivedDelegationIds` to platform delegation chain entries. When governance revocation cascades, also traverse and revoke platform delegations in the chain. Alternatively, document that governance and platform delegation chains are independent and revocation does not cascade across the boundary.

---

### Issue 6: Trust Level and Governance Level Are Not Reconciled

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts` (lines 123-124)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegation-registry/index.ts` (lines 21-23)

**Problem:** Platform `DelegationResult.trust_level` is a numeric value (0, or derived from governance evaluation). Governance `GovernanceDelegation.level` is categorical: `"view" | "operate" | "admin" | "super_admin"`. There is no conversion or reconciliation between these systems. An agent with governance level `super_admin` does not automatically get a higher numeric `trust_level` in its platform delegations. `DelegationManagerService` does not query governance level when creating delegations, and `DelegatedGovernanceService` does not set a numeric trust level.

**Severity:** medium

**Recommended fix:** Add a `governanceLevelToTrustLevel()` mapping function in the platform agent-delegation module that converts governance levels to numeric trust scores. Call this in `DelegationManagerService.delegate()` when the parent context includes governance context, to ensure trust levels are consistent with governance authority. Alternatively, document that trust_level and governance level are independent axes.

---

### Issue 7: Approval Delegation Resolution Bypasses Platform Delegation State

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/approval-routing/approval-routing-service.ts` (lines 244-251)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (lines 160-246)

**Problem:** `ApprovalRoutingService.buildDelegationMap()` resolves delegated approvers via `resolveDelegatedApprover()` using the org-governance `ApprovalDelegation` registry. However, the resolved approver ID is used without checking whether the original approver has an active platform delegation that might affect their availability or authority. If approver A has delegated their approval authority to approver B via org-governance, but A also has an active platform delegation to a worker agent, the delegation chain is not consulted when routing approval requests. The approval routing and agent delegation systems operate on entirely separate data stores.

**Severity:** medium

**Recommended fix:** In `ApprovalRoutingService.buildDelegationMap()`, add a check that resolved approvers do not have conflicting active platform delegations (e.g., a delegator who is themselves a child agent in an active delegation may not be available to approve). Alternatively, document that approval routing and agent delegation are independent concerns and approver availability is managed separately.

---

### Issue 8: Governance Service and DelegationGovernanceService Have Overlapping But Inconsistent Depth Limits

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-governance-service.ts` (lines 67-76)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/topology-validator.ts` (line 19)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/scope-manager/index.ts` (lines 129-169)

**Problem:** Platform `DelegationGovernanceService` has a rule `"max_depth"` with condition `delegationDepth: 5` (meaning deny when depth >= 5) at line 74. `TopologyValidator.DEFAULT_MAX_DEPTH` is 3 (line 19 in topology-validator.ts). These are inconsistent values for the same concept ("maximum delegation depth". The governance service evaluates at line 233: `if (request.parentContext.delegationDepth >= condition.delegationDepth) { return true; }` - this returns true (matches) when depth equals the condition value, triggering denial. Meanwhile the topology validator throws when `currentDepth >= maxDepth` (line 100-102). So a delegation at depth 3 would be allowed by governance (depth 3 < 5) but blocked by topology validator (depth 3 >= 3).

**Severity:** high

**Recommended fix:** Unify the depth limit constant - extract `MAX_DELEGATION_DEPTH` to a shared constants module and have both `DelegationGovernanceService` and `TopologyValidator` import from the same source. The governance rule should use `> condition.delegationDepth` not `>= condition.delegationDepth` to allow the boundary value, consistent with the topology validator's `>=` check blocking at exactly max.

---

### Issue 9: Governance Permission Intersect Logic May Over-Restrict vs Platform Permissions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegated-governance-service.ts` (lines 92-107)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/context-isolator.ts` (lines 270-320)

**Problem:** `DelegatedGovernanceService.resolve()` computes `effectivePerms = intersectPermissions(grantedPerms, grantorPermissions)` (line 96) to ensure grantees cannot exceed grantor authority. However, `grantorPermissions` passed to `resolve()` comes from the caller of `resolve()`, not from the platform delegation's actual `PermissionSet`. The governance service has no access to the platform delegation's `permissions` field. When governance grants a permission that the platform delegation doesn't actually include (because `ContextIsolator` narrowed it), the governance service believes the grantee has the permission but the platform delegation does not grant it. The intersect logic doesn't see the platform-level narrowing.

**Severity:** medium

**Recommended fix:** Pass the platform delegation's actual granted permissions as `grantorPermissions` to `DelegatedGovernanceService.resolve()` when calling from platform delegation context. This ensures the governance intersect check is performed against the actual narrowed permissions, not the theoretically granted set.

---

### Issue 10: ADR Gap - No ADR Documenting the Relationship Between Platform Delegation and Org-Governance Delegation

**Files:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/agent-delegation/index.ts` vs `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/index.ts`

**Problem:** These are architecturally distinct concepts that share the word "delegation":
- Platform agent delegation: task/authority delegation between agents (§19)
- Org-governance delegation: approval authority delegation between humans/org nodes (§51)

No ADR documents how they interact, whether a governance delegation is a prerequisite for platform delegation, or how revocation cascades across both systems. The architecture documentation treats them in separate sections with no explicit bridging ADR.

**Severity:** medium

**Recommended fix:** Create an ADR explaining the two delegation paradigms, when each applies, and the explicit interaction points (or intentional independence) between platform agent delegation and org-governance approval delegation. Document the data flow when a platform delegation requires org-governance approval.

---

### Issue 11: ADR Gap - Governance Guardrail Integration with Platform Permission Narrowing

**Files:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegated-governance-service.ts` (lines 135-176)  
**Files:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/context-isolator.ts`

**Problem:** No ADR documents the policy that governance guardrails should (or should not) influence platform permission narrowing. The current implementation has no integration - governance guardrail evaluation is entirely separate from context isolation. An operator reading architecture docs would not know whether these are meant to be independent layers or if guardrail results should propagate to permission sets.

**Severity:** medium

**Recommended fix:** Create an ADR documenting the guardrail integration policy: whether governance guardrails are intended to constrain platform delegation permissions, and if so, at which integration point (delegation creation time, context isolation time, or runtime enforcement).

---

### Issue 12: ADR Gap - Revocation Saga Pattern for Cross-System Delegation Cancellation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` (lines 1-178)

**Problem:** The `GovernanceDelegationRevocationSaga` is a well-structured saga pattern with prepare/commit/compensate/audit stages and cascade depth tracking, but there is no ADR documenting this pattern. The comment at line 7 mentions "cascade scope" but this concept is not defined in any architecture doc. The relationship between this saga and the platform `DelegationManagerService.cancel()` is undefined - they are separate systems with no documented coordination.

**Severity:** medium

**Recommended fix:** Create an ADR documenting the governance revocation saga pattern, the cascade depth semantics, and the integration contract with platform delegation cancellation. Specify which system "owns" the revocation decision and how other systems are notified or participate.

---

### Issue 13: Revocation Saga Cascade Scope Resolved But Not Verified Against Actual Chain

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` (lines 76-77, 159-178)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (lines 949-987)

**Problem:** `resolveCascadeScope()` at line 76 resolves numeric `maxCascadeScope` (default 1) from the request. At line 107-114, derived delegations are revoked if `maxCascadeScope >= 1`. However, the actual platform delegation chain depth is not consulted - the revocation saga has no way to know whether a governance delegation's `derivedDelegationIds` corresponds to a platform delegation chain of depth 1 or depth 5. The cascade depth tracking at line 75 (`cascadeDepthApplied`) increments to 1 for any revocation but doesn't reflect actual transitive closure of the platform delegation chain.

**Severity:** medium

**Recommended fix:** Before revoking derived delegations, query `DelegationManagerService.getDelegationChain()` to determine the actual platform chain depth and use that to set `cascadeDepthApplied`. This ensures the receipt accurately reflects the scope of revocation performed, not just the number of revocation calls made.

---

### Issue 14: No Synchronization Point for Org-Governance Scope Changes and Active Platform Delegations

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/delegated-governance/delegated-governance-service.ts` (lines 182-202)  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` (lines 595-646)

**Problem:** `DelegatedGovernanceService.getApplicableGuardrails()` and platform `DelegationManagerService.revokeExpiredDelegations()` both scan active delegations/governance rules, but there is no mechanism to invalidate or re-evaluate active platform delegations when governance scope changes (e.g., a new guardrail is added, org node boundary changes, or governance delegation is revoked). Active delegations continue with their original permissions until they naturally expire or are cancelled. Governance scope changes are not propagated to active delegations.

**Severity:** high

**Recommended fix:** Add a governance change notification mechanism: when governance scope changes, emit an event that `DelegationManagerService` subscribes to, triggering re-evaluation of active delegations against new guardrails. Alternatively, document that platform delegations are immutable once created and governance changes only affect new delegations.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 6     |
| Medium   | 7     |
| Low      | 0     |
| **Total**| 13    |

**ADR Gaps:** 3 identified (Issues 10, 11, 12)

**Most Impactful Issues:**

1. **Dual status machines with no bridge** (High) - Platform delegation status and org-governance approval activation are separate models with no synchronization

2. **Depth limit inconsistency between governance and topology validator** (High) - Governance says deny at depth >= 5, topology validator blocks at depth >= 3. A delegation at exactly depth 3 would be blocked by one but allowed by the other

3. **Governance revocation saga does not cancel platform delegations** (High) - Revoking a governance delegation leaves active platform delegations intact

4. **Guardrail evaluation doesn't influence permission narrowing** (High) - Governance guardrails like `max_budget` are evaluated but never reach the platform's `ContextIsolator`

5. **Scope models are orthogonal** (High) - Org node scope and pack/scope use completely different hierarchies with no cross-validation



## Cross-Review: ui ↔ api-client

### Directory Coverage

**ui/api-client modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/ws-client.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/interceptors.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/endpoints.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/state/src/stores/auth-store.ts`

**client-sdk modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client-types.ts`

---

## Cross-Module Issue 1: ContractEnvelope Wrapper Divergence — REST Client vs SDK

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts` (lines 315-378)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 388-424, 430-444)

**Problem:** The `RetryableApiClient` in `client-sdk` wraps all request bodies in a `ContractEnvelope` (line 405: `wrapRequestBody()`) and unwraps response envelopes (line 430: `unwrapResponseEnvelope()`). This is a core architectural decision for inter-plane messaging per R8-19. However, the UI REST client (`HttpTransport` and `DefaultRESTClient`) has **no envelope wrapping**. Requests go directly to `JSON.stringify(request.body)` (rest-client.ts line 317) and responses are unwrapped via `parseResponse()` which only handles `PlatformEnvelope<T>` not `ContractEnvelope`. This means:

- UI client sends plain JSON objects; server responds with `ContractEnvelope`-wrapped payloads
- The SDK's `unwrapResponseEnvelope()` checks for `envelopeId`, `schemaVersion`, `payload` fields (api-client.ts lines 432-436)
- The UI's `parseResponse()` only checks for `data` field (rest-client.ts line 290) — a different envelope format

**Severity:** high

**Recommended fix:** Align the UI REST client to detect and unwrap `ContractEnvelope` responses, or document that the UI layer communicates on a different API plane where envelopes are not required.

---

## Cross-Module Issue 2: Principal / AuthContext Encoding Diverges Between UI and SDK

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/state/src/stores/auth-store.ts` (lines 10-19, 70-86)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 388-403)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client-types.ts` (line 11)

**Problem:** The UI `AuthStore` encodes principal as `userId`, `tenantId`, `roles`, `permissions` on the `AuthSession` interface (auth-store.ts lines 14-17). The SDK `ApiClientConfig.principal` uses `subject` or `principalId`, `tenantId`, `roles` (api-client-types.ts line 11). These are semantically similar but use different field names:

| UI AuthStore | SDK principal |
|---|---|
| `userId` | `subject` or `principalId` |
| `tenantId` | `tenantId` |
| `roles` | `roles` |
| `permissions` | _(not in SDK principal)_ |
| `displayName` | _(not in SDK principal)_ |

The SDK's `wrapRequestBody()` (api-client.ts lines 388-403) builds metadata from `principal.subject` or `principal.principalId`, but the UI auth store stores this as `userId`. The UI interceptors (`createAuthInterceptor` in interceptors.ts) set the bearer token directly from `accessToken` (interceptors.ts line 122), with no principal encoding into request metadata.

**Severity:** high

**Recommended fix:** Normalize the principal field names. The UI should either use `subject`/`principalId` naming convention, or the SDK should accept a principal adapter that maps UI field names to SDK expectations. Document the principal encoding contract across modules.

---

## Cross-Module Issue 3: Accept-Version Header Mismatch

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts` (line 58)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (line 72-81)

**Problem:** The UI REST client uses `DEFAULT_ACCEPT_VERSION_HEADER = "2026-04-01,2026-01-01"` (rest-client.ts line 58). The SDK `buildAuthHeaders()` function (api-client.ts line 72-81) does **not** set an `Accept-Version` header — it only sets `authorization`, `X-Platform-Version`, `X-SDK-Version`, and `X-Contract-Version`. The SDK relies on `performVersionHandshake()` (api-client.ts lines 111-113) which fetches `/handshake` explicitly to negotiate version compatibility, rather than sending version headers with every request.

This creates an inconsistency:
- UI sends `Accept-Version: 2026-04-01,2026-01-01` on every request
- SDK sends no `Accept-Version` header by default

**Severity:** medium

**Recommended fix:** Add `Accept-Version` header support to the SDK's `buildAuthHeaders()` to match the UI's default. The SDK should send the same version headers the UI sends, or document why SDK requests are version-negotiated differently.

---

## Cross-Module Issue 4: Interceptor Chain Ordering Difference

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts` (lines 407-435)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/interceptors.ts` (passim)

**Problem:** The UI `DefaultRESTClient` executes interceptors in this order (rest-client.ts lines 409-434):

1. `onRequest` runs forward (`for` loop, line 410-412)
2. Transport dispatch happens
3. `onResponse` runs reverse (`[...interceptors].reverse()`, line 417-420)
4. `intercept` wraps dispatch in reverse order (line 426-431)

The `createAuthInterceptor` (interceptors.ts lines 90-158) implements `onRequest` (sets bearer token), `onResponse` (handles 401), and `intercept` (retries with refreshed token). The `intercept` method at line 132-155 is the primary auto-refresh mechanism.

The SDK's retry logic (api-client.ts lines 580-594) is built into the `request()` method directly, not as an interceptor. It retries on retryable status codes (429, 5xx) but not via an interceptor chain. The SDK does not have an equivalent to `createAuthInterceptor`'s auto-refresh-with-retry pattern.

**Severity:** medium

**Recommended fix:** Extract the UI's auth interceptor refresh logic into a reusable pattern that can be applied consistently, or document that the SDK handles retries differently (in-request vs interceptor-chain) and these two approaches must be kept in sync.

---

## Cross-Module Issue 5: WebSocket Reconnect Delay Divergence

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/ws-client.ts` (lines 304-311, 313-329)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 346-355)

**Problem:** The UI `BrowserWSClient` calculates reconnect delay as (ws-client.ts lines 305-311):
```typescript
const exponentialDelay = Math.min(baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelayMs);
const jitter = exponentialDelay * Math.random() * 0.3;
```

The SDK's SSE reconnect delay (api-client.ts lines 346-355) uses:
```typescript
const retryAfter = Math.min(1000 * (2 ** Math.min(reconnectAttempt - 1, 4)), 10000);
```

Key differences:
- UI base: `1000ms * 2^attempt`, cap `30000ms`; SDK: `1000 * 2^(attempt-1)`, cap `10000ms`
- UI adds 30% jitter; SDK does not
- UI has max 10 reconnect attempts (ws-client.ts line 103); SDK reconnects indefinitely (while loop at lines 319-356)
- UI reconnects WebSocket; SDK reconnects SSE stream

**Severity:** low

**Recommended fix:** Document the different reconnect strategies (WebSocket vs SSE) and ensure they are intentionally different rather than accidentally divergent.

---

## Cross-Module Issue 6: Idempotency Key Handling Inconsistency

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/interceptors.ts` (lines 223-236)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 130-131, 142-143)

**Problem:** The UI `createIdempotencyKeyInterceptor()` (interceptors.ts line 223) generates a `crypto.randomUUID()` idempotency key and sets it on both `Idempotency-Key` and `x-idempotency-key` headers for non-GET requests (interceptors.ts lines 227-231). The SDK's `wrapRequestBody()` (api-client.ts line 410-414) accepts `idempotencyKey` in the `ContractEnvelope` but the SDK's `post()` method (api-client.ts line 130) passes the idempotency key to `wrapRequestBody()`. However:

- The SDK idempotency key goes into the `ContractEnvelope.idempotencyKey` field, not an HTTP header
- The UI idempotency key goes into both HTTP headers

If the server expects the idempotency key as an HTTP header (as the UI sends), the SDK's envelope-based idempotency key may not be recognized.

**Severity:** high

**Recommended fix:** Ensure idempotency key handling is consistent — either both use HTTP headers or both use the envelope field. The current hybrid approach may cause duplicate submissions.

---

## Cross-Module Issue 7: Token Resolver Interface Not Used by UI Auth Store

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/interceptors.ts` (lines 24-30, 90-158)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/state/src/stores/auth-store.ts` (lines 70-86, 111-121)

**Problem:** The `createAuthInterceptor()` accepts a `TokenResolver` interface (interceptors.ts lines 24-30) with methods `getAccessToken`, `getAccessTokenWithRefresh`, `shouldRefresh`, and `handleUnauthorized`. This is a well-designed refresh token pattern. However:

1. The UI `auth-store.ts` exposes `accessToken`, `refreshToken` directly on the store state (lines 76-77)
2. The `updateTokens()` method (auth-store.ts lines 111-121) can update tokens but the store does not expose a `getAccessTokenWithRefresh()` method
3. The `TokenResolver` interface is defined in interceptors.ts but the UI auth store does not implement it

This means the UI's auth interceptor cannot leverage the `TokenResolver` interface for refresh — it must be manually passed a token string or a resolver object that manually exposes the refresh method. The `createAuthInterceptor` in interceptors.ts line 90 requires either a static string or a `TokenResolver`. Since the auth store stores tokens but doesn't expose a refresh method conforming to `TokenResolver`, the UI likely passes a static token string to the interceptor, bypassing the refresh capability.

**Severity:** medium

**Recommended fix:** Implement `TokenResolver` on the auth store, or create a bridge that wraps the auth store as a `TokenResolver`. This would enable the auto-refresh interceptor pattern to work with the UI's auth state.

---

## Cross-Module Issue 8: ApiError vs RestHttpError — Error Type Divergence

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts` (lines 62-81)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 666-702)

**Problem:** The UI REST client defines `RestHttpError` (rest-client.ts lines 62-81) with `status`, `uiAction` (redirect_to_login, access_denied, backoff_and_retry, version_not_supported), and `retryAfterMs`. The SDK defines `ApiError` (api-client.ts lines 666-678) with `category` (NETWORK, AUTH, VALIDATION, BUSINESS, CONTRACT), `statusCode`, and `isRetryable`.

These are two completely different error hierarchies for the same purpose (HTTP API error classification):

| UI `RestHttpError` | SDK `ApiError` |
|---|---|
| `status: number` | `statusCode: number \| null` |
| `uiAction: RestHttpUiAction` | `category: ApiErrorCategory` |
| `retryAfterMs: number \| null` | `isRetryable: boolean` |
| No error message preservation | `message: string` |
| No error code branding | Error code as message prefix |

Additionally, the SDK has `classifyApiError()` (api-client.ts lines 680-702) which maps status codes to categories:
- 401/403 → AUTH
- 400/422 → VALIDATION
- 409/412 → BUSINESS
- 500+ → NETWORK
- 4xx → BUSINESS

The UI's `RestHttpError.uiAction` maps differently: 401 → redirect_to_login, 403 → access_denied, 429 → backoff_and_retry, 406 → version_not_supported. 403 is mapped to `access_denied` in UI but the SDK classifies 403 as AUTH.

**Severity:** high

**Recommended fix:** Align the error classification between UI and SDK. Consider a shared error classification utility, or document the intentional differences (e.g., UI needs UI-actionable error types, SDK needs business-logic error categories).

---

## Cross-Module Issue 9: No SSE Event Subscription in UI API Client

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/ws-client.ts` (lines 1-483)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 261-375)

**Problem:** The SDK has a full SSE-based event subscription system (`subscribeToEvents()`, api-client.ts lines 261-375) with reconnection logic, abort controllers, and event parsing. The UI has only WebSocket clients (`BrowserWSClient`, `InMemoryWSClient`, `SharedWorkerWSClient`) with no SSE fallback path as a primary transport.

The UI `ws-client.ts` line 18 defines `useSseFallback()` but this only changes the status to `sse-fallback` — it does not establish an SSE connection. The `BrowserWSClient` does not implement SSE as an actual transport.

If the WebSocket connection fails and the UI calls `useSseFallback()`, the status changes but no actual SSE connection is established. The `InMemoryWSClient` is used as a fallback in-memory pub/sub but is not connected to a real SSE stream.

**Severity:** medium

**Recommended fix:** Implement actual SSE fallback in `BrowserWSClient` or document that SSE fallback is intentionally stubbed and the UI relies solely on WebSocket for real-time events.

---

## Cross-Module Issue 10: Circuit Breaker Config Not Shared

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts` (lines 216-219, 256-282)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 38-43, 550-646)

**Problem:** The UI `HttpTransport` has a circuit breaker (rest-client.ts lines 199-203: `failures`, `lastFailure`, `state`) with:
- `failureThreshold: 5` failures to open (line 217)
- `resetTimeoutMs: 30000` ms before half-open (line 218)

The SDK `RetryableApiClient` does not have a circuit breaker. It retries based on `RetryConfig` which has `maxRetries: 3`, `backoffMs: 100`, `maxBackoffMs: 1000` (api-client.ts lines 38-43). The retry logic in `request()` (api-client.ts lines 582-594) retries on `retryableStatus = response.status === 429 || response.status >= 500`.

This means:
- UI opens circuit after 5 failures, fails-fast for 30s, then half-open
- SDK retries up to 3 times with exponential backoff, then fails

These are different resilience strategies for the same goal (preventing cascading failures).

**Severity:** low

**Recommended fix:** Document the different resilience strategies, or extract a shared resilience configuration object that both modules use.

---

## Cross-Module Issue 11: API Version Path Structure Diverges

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts` (lines 306-313)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 45-67)

**Problem:** The UI `HttpTransport.resolveRequestUrl()` (rest-client.ts lines 306-313) concatenates `baseUrl` with `path` directly, with no API version prefix handling:
```typescript
const normalizedBaseUrl = this.options.baseUrl.replace(/\/$/, "");
return `${normalizedBaseUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
```

The SDK `buildApiUrl()` (api-client.ts lines 53-67) normalizes the API version segment and inserts it between base URL and path:
```typescript
const apiVersion = normalizeApiVersionSegment(config.apiVersion);
const url = new URL(`${baseUrl}/${apiVersion}/${path}`);
```

This means:
- UI: `baseUrl = "https://api.example.com"`, `path = "/tasks"` → `"https://api.example.com/tasks"`
- SDK: `baseUrl = "https://api.example.com"`, `apiVersion = "v1"`, `path = "/tasks"` → `"https://api.example.com/api/v1/tasks"`

The SDK adds an `api/` prefix (line 47: `normalized.startsWith("api/") ? normalized : `api/${normalized}``). If the UI's `baseUrl` already includes the version, both produce the same URL. But if the UI expects version in `baseUrl` and SDK expects version in `apiVersion`, configuration must be carefully aligned.

**Severity:** high

**Recommended fix:** Ensure the baseUrl + apiVersion configuration is consistent across UI and SDK. Document the expected URL structure and verify that server-side routing expects the same format from both clients.

---

## Cross-Module Issue 12: Offline Queue Interceptor Incompatible with SDK

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/interceptors.ts` (lines 188-213)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (passim)

**Problem:** The UI `createOfflineQueueInterceptor()` (interceptors.ts lines 188-213) queues write requests when `navigator.onLine === false`. It uses `queue.enqueue()` with a principal object containing `principalId: "ui-operator"` (line 203). The SDK has no offline queue mechanism — it does not handle network offline scenarios. This creates a feature gap where:

- UI can queue writes for later replay when coming back online
- SDK throws errors or fails on network failure with no offline support

Additionally, the hardcoded `principalId: "ui-operator"` (interceptors.ts line 203) in the offline queue entry uses a different principal naming convention than the SDK expects (`subject`/`principalId`).

**Severity:** medium

**Recommended fix:** Either add offline queue support to the SDK, or document that offline resilience is a UI-only concern. If the offline queue principal (`ui-operator`) is replayed through the SDK, ensure the server can handle this mismatched principal naming.

---

## ADR Gaps Identified

1. **No ADR for ContractEnvelope vs plain JSON decision boundary** — The SDK wraps requests/responses in ContractEnvelope for inter-plane messaging, but the UI layer sends plain JSON. There is no documented decision record explaining which API surfaces require envelopes vs plain payloads.

2. **No ADR for principal encoding across layers** — The principal context is encoded differently between UI auth store (`userId`), UI interceptors (bearer token only), and SDK (`subject`/`principalId` in metadata). An ADR should define the canonical principal representation across all client layers.

3. **No ADR for error hierarchy divergence** — Two independent error hierarchies (`RestHttpError` in UI, `ApiError` in SDK) exist without documentation explaining why they diverged or how they should be kept aligned.

4. **No ADR for client resilience strategy** — The UI uses circuit breaker pattern while the SDK uses retry-with-backoff. No document explains which pattern is appropriate for which client type, or whether these should be unified.

5. **No ADR for Accept-Version negotiation** — UI sends version headers on every request; SDK negotiates version via handshake endpoint. The different version negotiation strategies need documentation.

6. **No ADR for WebSocket vs SSE transport choice** — UI uses WebSocket as primary with SSE as fallback status only; SDK uses SSE as primary. The transport decision criteria should be documented.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 5     |
| Medium   | 6     |
| Low      | 2     |
| **Total**| 13    |

**ADR Gaps:** 6 identified

**Most Impactful Issues:**

1. **ContractEnvelope wrapper divergence (High)** — SDK wraps requests/responses in envelopes; UI sends plain JSON. This is a fundamental architectural mismatch that could cause silent failures or data loss.

2. **Principal field name divergence (High)** — UI uses `userId`, SDK uses `subject`/`principalId`. The SDK's `wrapRequestBody()` principal metadata extraction will fail to populate `principalSubject` from UI auth sessions because the field name mapping is wrong.

3. **ApiError vs RestHttpError divergence (High)** — Two independent error hierarchies with different classification schemes. Error handling code in the UI cannot share error handling utilities with the SDK.

4. **Idempotency key handling inconsistency (High)** — UI uses HTTP headers, SDK uses envelope field. Duplicate submissions possible when clients are mixed.

5. **API version path structure divergence (High)** — SDK adds `api/` prefix to version; UI does not. URL construction differs unless `baseUrl` is carefully configured to match.

6. **Accept-Version header missing from SDK (Medium)** — SDK does not send `Accept-Version` header; UI does. Server-side version routing may behave unexpectedly for SDK clients.

7. **TokenResolver interface not implemented by auth store (Medium)** — The well-designed `TokenResolver` refresh pattern exists in interceptors.ts but the auth store doesn't implement it, preventing auto-refresh from working.

8. **Offline queue principal uses wrong field name (Medium)** — Offline queue interceptor hardcodes `principalId: "ui-operator"` which does not match SDK's expected `subject` field. Replay could fail principal validation.

---

## Cross-Review: state-evidence ↔ orchestration

### Issue 1: Event Naming Inconsistency — emitStageEvent vs LayeredEventInbox Consumer Registration

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.ts` **Line:** 391-400  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/events/layered-event-inbox.ts` **Lines:** 111-127, 184-192  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/events/event-types.ts` **Lines:** 90-93, 152-154

**Problem:** `emitStageEvent()` (oapeflir-loop-support.ts:391-400) emits `"oapeflir.view.run_lifecycle"` with a `{ stage, ...data }` payload. The `LayeredEventInbox` class (layered-event-inbox.ts:111-127) accepts events via `append()` and filters via `canConsumerReceive()` (lines 184-192). The `canConsumerReceive()` for `consumer.kind === "projection"` returns `isPlatformFactEvent(event) || isOapeflirViewEvent(event)`. However, the inbox is never initialized with a consumer for `"oapeflir_projection"` in the default code path. This means if `LayeredEventInbox` is used as the event sink, OAPEFLIR stage events will be accepted by `append()` but silently dropped since no consumer is registered to drain them.

Additionally, `event-types.ts` line 90-93 defines three OAPEFLIR Tier 1 event types:
- `"oapeflir.view.run_lifecycle"`
- `"oapeflir.decision.recorded"`
- `"oapeflir.phase.transition"`

The `REQUIRED_CONSUMERS_BY_EVENT_TYPE` mapping (lines 152-154) maps these to `["oapeflir_projection", "inspect_projection"]`, but the actual consumer registration mechanism and the `oapeflir_projection` implementation are not cross-referenced.

**Severity:** high

**Recommended fix:** Either:
1. Ensure `LayeredEventInbox` is initialized with all required consumers (including `"oapeflir_projection"`) before use in the OAPEFLIR lifecycle, or
2. Document that OAPEFLIR stage events bypass `LayeredEventInbox` and are emitted directly to the event bus via `TypedEventBusPublisher`.

---

### Issue 2: Snapshot Version Mismatch — RuntimeTruthRepository vs PlanBuilder.graphVersion

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/runtime-truth-repository.ts` **Lines:** 24-56, 458-485  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/planner/plan-builder.ts` **Lines:** 217-221, 265-272

**Problem:** `RuntimeTruthRepository` defines `SnapshotVersion` (runtime-truth-repository.ts:24-29) with fields `versionId`, `version`, `stateHash`, `createdAt`. The `snapshot()` method (lines 458-485) increments `this.state.snapshotVersion` and returns it in `RuntimeTruthRepositorySnapshot.snapshotVersion`. However, `PlanBuilder` hardcodes `graphVersion: 1` (plan-builder.ts:220) for every new `PlanGraphBundle` and never reads from `RuntimeTruthRepository.snapshot()`. When `replan()` is called (line 265-272), it extracts `previousVersion` from `previousPlan.graphVersion` or `previousPlan.version` and increments it locally — but this version increment is not recorded in the `RuntimeTruthRepository` event store. If a crash occurs and state is rebuilt via `replayEvents()` (runtime-truth-repository.ts:415-456), the `graphVersion` embedded in `PlanGraphBundle` is not recoverable from events.

**Severity:** high

**Recommended fix:** Coordinate `graphVersion` increment with `RuntimeTruthRepository`:
1. Before building a new plan, call `repository.snapshot()` to get the current `snapshotVersion.version`.
2. Pass this version as an input to `PlanBuilderInput` (e.g., `baseSnapshotVersion`).
3. Record the plan version as a domain event via `RuntimeTruthRepository.appendEvent()` so replay can reconstruct it.
4. Alternatively, document that `PlanBuilder.graphVersion` is a separate version domain from `RuntimeTruthRepository.snapshotVersion` and they should not be conflated.

---

### Issue 3: Trust Level Integration Gap — TrustLevelService vs KnowledgePromotionService

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/memory/trust-level-service.ts` **Lines:** 26-30, 94-96  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` **Lines:** 589-600, 691-692  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/events/typed-event-payloads.ts` **Lines:** 254-270

**Problem:** `TrustLevelService` defines `TrustLevel` as `"private_unverified" | "team_reviewed" | "official" | "authoritative"` (trust-level-service.ts:26-30). `KnowledgePromotionService` (oapeflir-loop-core.ts:589-600) promotes `LearningObject`s and emits `learning:knowledge_promoted` events with `trustLevel: string` (typed-event-payloads.ts:259). However, the `emitStageEvent()` method (oapeflir-loop-support.ts:396-400) casts the payload to `Record<string, unknown>` without type validation, so the `TrustLevel` union is never enforced at the emit boundary.

This creates a gap where:
- `TrustLevelService` enforces transition rules (trust-level-service.ts:224-234) based on `currentTrustLevel` and `targetTrustLevel`
- `KnowledgePromotionService` promotes objects but emits events with untyped `trustLevel: string`
- Downstream consumers cannot validate trust transition rules from the event payload alone

**Severity:** medium

**Recommended fix:** 
1. Change `LearningKnowledgePromotedPayload.trustLevel` (typed-event-payloads.ts:259) from `string` to the typed `TrustLevel` union.
2. Add schema validation at `emitStageEvent()` for OAPEFLIR events that validates `trustLevel` against the `TrustLevel` type.
3. Document that trust level transitions in `TrustLevelService` are the source of truth and events carry the post-transition level.

---

### Issue 4: Budget/Billing Conflict — BudgetAllocator vs PlanBuilder.budgetIntent

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/budget-allocator.ts` **Lines:** 126-149  
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/planner/plan-builder.ts` **Lines:** 144-148, 226

**Problem:** `BudgetAllocator.checkWatermarkAlert()` (budget-allocator.ts:126-149) computes `percentUsed = usedAmount / hardCap` based on `ledger.reservedAmount + ledger.settledAmount`. `PlanBuilder` sets a hardcoded `budgetIntent.amount: 0.01` (plan-builder.ts:144-148) for every node regardless of actual step complexity, token consumption, or model pricing. The `budgetPlanRef` (line 226) references `budget://plan/${planGraphBundleId}` with no relationship to what `BudgetAllocator.reserve()` actually reserves.

`OapeflirLoopService.run()` (oapeflir-loop-core.ts:412) calls `await this.reserveBudgetForExecution(executionContext, input.taskId)` before execution via the bridge. However, there is no event emitted when budget is reserved that would update a `BudgetLedger` tracked in `RuntimeTruthRepository`. The `budgetPlanRef` in the `PlanGraphBundle` is a reference string, not a pointer to an actual reservation in the truth repository.

This means:
1. PlanBuilder creates a `budgetPlanRef` pointing to a non-existent budget entity
2. BudgetAllocator reserves actual budget but the reference in the plan is unresolvable
3. No event flows from `BudgetAllocator.reserve()` to `RuntimeTruthRepository` to create a corresponding `BudgetLedger`

**Severity:** high

**Recommended fix:**
1. Either remove `budgetIntent` from `PlanNode` (plan-builder.ts:144-148) as it is unused, or make it derive from `assessment.resourceAllocation.maxTokens` with realistic per-step cost estimates.
2. Ensure `BudgetAllocator.reserve()` emits a `platform.budget.reserved` event that flows into `LayeredEventInbox` so `RuntimeTruthRepository` can create and track the corresponding `BudgetLedger`.
3. Align `budgetPlanRef` with the actual budget reservation ID returned from `BudgetAllocator.reserve()`.

---

### Issue 5: ADR Gaps — state-evidence ↔ orchestration Cross-Module Integration

**Problem:** Several cross-cutting concerns between state-evidence and orchestration are implemented in code but lack corresponding ADR documentation:

1. **No ADR for OAPEFLIR stage event consumer registry**  
   The `REQUIRED_CONSUMERS_BY_EVENT_TYPE` mapping (event-types.ts:152-154) maps OAPEFLIR events to `["oapeflir_projection", "inspect_projection"]`, but there is no ADR explaining:
   - How `oapeflir_projection` is initialized and registered with `LayeredEventInbox`
   - What materialized view the projection maintains
   - How `inspect_projection` correlates OAPEFLIR stage events with other platform events

2. **No ADR for SnapshotVersion coordination between truth and orchestration**  
   `RuntimeTruthRepository.snapshotVersion` (runtime-truth-repository.ts:478-483) and `PlanBuilder.graphVersion` (plan-builder.ts:220, 266) are maintained independently. There is no documented policy for:
   - When to increment each version
   - How replay should reconstruct plan versions from event history
   - Whether they can diverge and what that means for execution

3. **No ADR for budget reservation lifecycle**  
   `BudgetAllocator.reserve()` (oapeflir-loop-core.ts:412) is called before bridge execution, but there is no ADR documenting:
   - The event flow from budget reservation to `LayeredEventInbox` to `RuntimeTruthRepository`
   - How `BudgetLedger` in truth state gets updated when actual costs are actualized
   - The relationship between `budgetPlanRef` in `PlanGraphBundle` and the actual budget reservation

4. **No ADR for LearningObject trust level propagation**  
   `KnowledgePromotionService.promote()` (oapeflir-loop-core.ts:589-600) moves `LearningObject`s through trust levels, but there is no ADR documenting:
   - The event-driven propagation path when trust level changes
   - How trust level changes in evidence affect downstream routing decisions in orchestration
   - The retry policy when promotion fails

**Severity:** medium

**Recommended fix:** Create ADR entries documenting:
1. OAPEFLIR event consumer registry architecture and projection behavior
2. Snapshot version coordination policy between truth repository and orchestration
3. Budget reservation event lifecycle and Ledger update path
4. LearningObject trust level propagation model and failure handling

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 3     |
| Medium   | 2     |
| **Total**| 5     |

**ADR Gaps:** 4 identified

**Most Impactful Issues:**

1. **OAPEFLIR stage events may be silently dropped (High)** — `emitStageEvent()` emits to a `TypedEventPublisher` but `LayeredEventInbox` is not initialized with an `oapeflir_projection` consumer, creating a blind spot in event processing.

2. **PlanBuilder.graphVersion not persisted in truth repository (High)** — Replay cannot reconstruct plan versions because `graphVersion` is not recorded as an event in `RuntimeTruthRepository`. This breaks event-sourced replay of orchestration state.

3. **BudgetPlanRef references non-existent budget entity (High)** — `PlanBuilder` creates `budgetPlanRef: budget://plan/${planGraphBundleId}` but `BudgetAllocator` never creates a corresponding `BudgetLedger` entry in `RuntimeTruthRepository`, making the reference unresolvable.

4. **TrustLevel type safety lost at event boundary (Medium)** — `KnowledgePromotionService` emits `trustLevel: string` instead of the typed `TrustLevel` union, making downstream validation impossible.

5. **Four missing ADRs for cross-module integration patterns (Medium)** — Event consumer registry, snapshot version coordination, budget lifecycle, and trust level propagation lack architectural documentation.

**Root Cause Analysis:**
The `five-plane-state-evidence` module (truth repository, event inbox, trust service) operates with strong consistency guarantees and event-sourced state, while `five-plane-orchestration` (OAPEFLIR loop, plan builder) operates with local version state that is not integrated into the truth event stream. The integration gaps stem from:
1. No shared version model between `RuntimeTruthRepository.snapshotVersion` and `PlanBuilder.graphVersion`
2. No event emission contract from `BudgetAllocator` to `RuntimeTruthRepository`
3. No type-safe trust level propagation at the `emitStageEvent()` boundary
4. No documented consumer registration policy for OAPEFLIR events in `LayeredEventInbox`

**Recommended Priority Actions:**
1. Register `oapeflir_projection` consumer in `LayeredEventInbox` or document event bus bypass
2. Emit `platform.plan.version_created` events to `RuntimeTruthRepository` when `PlanBuilder` increments `graphVersion`
3. Ensure `BudgetAllocator.reserve()` emits `platform.budget.reserved` events to update `BudgetLedger`
4. Add `TrustLevel` type validation at `emitStageEvent()` for `learning:knowledge_promoted` events
5. Create four ADRs documenting the cross-module integration patterns listed above

---

## Cross-Review: documentation ↔ code

### Issue 1: OAPEFLIR stage `knowledge_promotion` has no predecessor in FSM but is defined in stage list

**Documentation:** CLAUDE.md lines 34 and `stage-timeline.ts` define OAPEFLIR as 9 stages including `knowledge_promotion`.

**Code:** `stage-transition-fsm.ts` lines 55-64 show `VALID_PREDECESSORS` only maps up to `release`:
```typescript
["improve", ["learn"]],
["release", ["improve"]],
// knowledge_promotion is missing from VALID_PREDECESSORS
```

**Problem:** `knowledge_promotion` is included in `OAPEFLIR_STAGES` (line 13-23) and `STAGE_ENTRY_CONDITIONS` (line 75) but has no entry in `VALID_PREDECESSORS`. The FSM cannot correctly validate transitions to this stage.

**Severity:** high

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.ts:55-64`

**Recommended fix:** Add `["knowledge_promotion", ["release"]]` to `VALID_PREDECESSORS`.

---

### Issue 2: ADR-026 exists but code comment references wrong ADR context

**Code:** `delegation-request/index.ts` line 16-17:
```typescript
// R25-20 fix: budgetEnvelope and budgetReservationId for ADR-026 8-factor budget tracking
// Budget tracking is the 6th factor in the 8-factor risk model
```

**Documentation:** ADR-026 in `docs_zh/adr/026-risk-control-architecture.md` covers "风险控制架构" (Risk Control Architecture) with an 8-factor weighted scoring algorithm for risk.

**Problem:** The code comment says ADR-026 is about "8-factor budget tracking" but ADR-026 is actually about risk control architecture, not budget tracking. Budget tracking appears to be a different concern. The comment may be stale or misattributed.

**Severity:** medium

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/delegation-request/index.ts:16-17`

**Recommended fix:** Verify whether budget tracking should reference ADR-025 (stability architecture) or create a separate ADR for budget tracking. Fix the comment to reference the correct ADR.

---

### Issue 3: CLAUDE.md says `src/core/runtime/` is compatibility-only but `src/runtime/` is also used

**Documentation:** CLAUDE.md line 63:
```
- `src/core/runtime/` is compatibility-only; do not add new canonical runtime logic there.
```

**Code:** There exists a separate `src/runtime/` directory (not `src/core/runtime/`):
```
src/runtime/
  orchestrator/
  planner/
  process-tracker.ts
  queue-adapter.ts
  distributed-lock-service.ts
  supervisor/
```

**Problem:** CLAUDE.md only mentions `src/core/runtime/` as the compatibility layer. However, the separate `src/runtime/` directory exists but is undocumented in CLAUDE.md. Its relationship to `src/core/runtime/` is unclear.

**Severity:** medium

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/runtime/` (exists, unmentioned in CLAUDE.md)

**Recommended fix:** Document `src/runtime/` in CLAUDE.md or clarify whether it should be merged into `src/core/runtime/`.

---

### Issue 4: TransitionService documentation reference does not match actual file location

**Documentation:** CLAUDE.md line 52:
```
`TransitionService` — authoritative status transition gate in `src/platform/five-plane-execution/state-transition/transition-service.ts`
```

**Code:** The file exists at the documented path and is the canonical TransitionService.

**Problem:** None — this reference is accurate. Flagged for completeness.

**Severity:** info

---

### Issue 5: runMultiStepOrchestration documentation reference is accurate

**Documentation:** CLAUDE.md line 53:
```
`runMultiStepOrchestration` — canonical multi-step orchestrator in `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
```

**Code:** Confirmed — `runMultiStepOrchestration` is exported from `multi-step-orchestration.ts` line 105.

**Problem:** None — this reference is accurate.

**Severity:** info

---

### Issue 6: Five-plane directory names in CLAUDE.md vs actual structure

**Documentation:** CLAUDE.md lines 31-37 show five-plane directories as:
- `five-plane-interface/`
- `five-plane-control-plane/`
- `five-plane-orchestration/`
- `five-plane-execution/`
- `five-plane-state-evidence/`

**Code:** Actual directory listing confirms these names are correct:
```
src/platform/five-plane-control-plane/
src/platform/five-plane-execution/
src/platform/five-plane-interface/
src/platform/five-plane-orchestration/
src/platform/five-plane-state-evidence/
```

**Problem:** None — the directory structure matches CLAUDE.md exactly.

**Severity:** info

---

### Issue 7: BudgetLedger status schema mismatch (code vs code, flagged earlier)

**Code (contract-models.ts line 617):** `BudgetLedger.status` allows 7 states:
```typescript
| "open" | "soft_cap_reached" | "hard_cap_reached" | "closed" | "settling" | "reserving" | "releasing"
```

**Code (schemas.ts):** `BudgetLedgerSchema` only has 4 states: `"open", "soft_cap_reached", "hard_cap_reached", "closed"`.

**Problem:** Type definition and Zod schema are inconsistent. Runtime code could create a BudgetLedger with `status: "settling"` but schema validation would reject it.

**Severity:** high

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts:617`
**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/schemas.ts:543` (approximate)

**Recommended fix:** Add missing statuses to `BudgetLedgerSchema`: `settling`, `reserving`, `releasing`.

---

### Issue 8: contract-models.ts CANONICAL_CONTRACT_NAMES version mismatch

**Code (contract-models.ts line 4):** `CONTRACT_SCHEMA_VERSION = "v4.3"`

**Code (CANONICAL_CONTRACT_NAMES):** 35 contract names listed. No version comment indicates when this list was last synced with the schema version.

**Problem:** No ADR or comment indicates that `CONTRACT_SCHEMA_VERSION` v4.3 maps to these 35 contracts. If a new contract is added or removed, neither the version nor the ADR is updated.

**Severity:** low

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts:4`

**Recommended fix:** Add a comment linking the schema version to an ADR or changelog entry.

---

### Issue 9: StageTransitionFSM lacks ADR or design doc reference

**Code (stage-transition-fsm.ts lines 1-9):** Comment says:
```typescript
/**
 * @fileoverview OAPEFLIR Stage Transition FSM
 *
 * Defines the finite state machine for OAPEFLIR 9-stage transitions:
 * Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release → Knowledge Promotion
 */
```

**Problem:** No `@see` or ADR reference points to the authoritative OAPEFLIR design document. The 9-stage progression is a significant architectural decision but lacks traceability.

**Severity:** medium

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.ts:1-9`

**Recommended fix:** Add `@see` reference to the OAPEFLIR executable spec or an ADR.

---

### Issue 10: core/runtime README.md exists but is not referenced in CLAUDE.md

**Documentation:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/core/runtime/README.md` explicitly defines the directory as a legacy compatibility layer with migration rules.

**Problem:** CLAUDE.md line 63 says `src/core/runtime/` is "compatibility-only" but does not reference the `README.md` which contains the actual rules. Someone reading CLAUDE.md would not know about the detailed rules in the README.

**Severity:** low

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/core/runtime/README.md`

**Recommended fix:** CLAUDE.md could add `@see src/core/runtime/README.md` for those rules, or the README rules could be inlined into CLAUDE.md.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 2     |
| Medium   | 4     |
| Low      | 2     |
| Info     | 2     |
| **Total**| 10    |

**Most Impactful Issues:**

1. **OAPEFLIR knowledge_promotion missing predecessor** (High) — FSM cannot validate transitions to the 9th stage; stage progression enforcement is broken
2. **BudgetLedger schema/status mismatch** (High) — Type allows 7 states but schema validates only 4; data integrity risk
3. **ADR-026 misattributed** (Medium) — Code comment says "8-factor budget tracking" but ADR-026 is risk control architecture
4. **src/runtime/ undocumented** (Medium) — Separate runtime directory exists outside CLAUDE.md's documented structure

## Cross-Review: runtime ↔ execution

### Issue 1: src/core/runtime is Pure Pass-Through with No Compatibility Layer

**Files:** 
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/core/runtime/index.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/runtime/agent-runtime/index.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/CLAUDE.md` (line 63)

**Problem:** CLAUDE.md states "`src/core/runtime/` is compatibility-only; do not add new canonical runtime logic there." However, `src/core/runtime/index.ts` re-exports ALL components from `platform/five-plane-execution/execution-engine/` and other execution modules. The `src/runtime/agent-runtime/index.ts` also re-exports everything from the execution engine. This means `core/runtime` provides zero actual compatibility - it is merely an alias with no abstraction boundary. The compatibility-only mandate is not reflected in any actual compatibility code (adapters, wrappers, version gates).

**Severity:** high

**Recommended fix:** Either:
1. Remove `src/core/runtime` entirely and import directly from `platform/five-plane-execution`, documenting that "compatibility-only" means "import-only compatibility shim maintained for potential future extraction"
2. Or create actual compatibility adapters with version gates and capability checks if backward compatibility with older runtime versions is needed

---

### Issue 2: queue-adapter.ts Imports Non-Existent Module

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/core/runtime/queue-adapter.ts`  
**Line:** 1

**Problem:** The file contains:
```typescript
export * from "../../platform/five-plane-execution/queue/queue-adapter.js";
```
But `five-plane-execution/queue/queue-adapter.js` does not exist. The queue subdirectory structure does not contain this file. This would cause a module resolution error at import time for any code that imports from `core/runtime`.

**Severity:** critical

**Recommended fix:** Verify the correct path for queue adapter exports. If queue adapter functionality lives elsewhere, update the import path. If it doesn't exist, remove this file or mark it as unimplemented with a `throw new Error("not_implemented")` stub.

---

### Issue 3: Budget Settlement Uses Estimates for Reservation but Actual for Settlement - Divergence Risk

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/model-call-provider.ts`  
**Lines:** 145, 203-205

**Problem:** The budget flow is inconsistent:
1. Line 145: `const estimatedCostUsd = estimateLlmCallCost(request.maxTokens, request.model)` - reserves using estimate
2. Line 203-205: Settlement uses `estimateActualLlmCallCost()` with fallback to `estimatedCostUsd`

The reservation/settlement cycle mixes estimated and actual values. If actual LLM usage differs significantly from the estimate, the budget ledger shows one thing reserved but a different amount settled. There's no reconciliation pass to correct the ledger when actual costs diverge from estimates.

**Severity:** high

**Recommended fix:** Ensure `estimateActualLlmCallCost` can always extract actual usage from provider responses, or add an explicit reconciliation step after each LLM call that corrects the reservation amount against actual usage. Document the acceptable divergence threshold.

---

### Issue 4: BudgetLedger Schema Missing Three Statuses That Code Uses

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/budget-allocator.ts`  
**Line:** 458

**Problem:** `budget-allocator.ts` line 458 sets ledger status as:
```typescript
status: ledgerRow.status as "open" | "soft_cap_reached" | "hard_cap_reached" | "closed" | "settling" | "reserving" | "releasing",
```
The type includes `settling`, `reserving`, `releasing` (7 states). However, the `BudgetLedgerSchema` in contracts only defines 4 states: `"open" | "soft_cap_reached" | "hard_cap_reached" | "closed"`. The other three statuses can be created via factory casting but would fail schema validation if parsed directly.

**Severity:** high

**Recommended fix:** Add `settling`, `reserving`, `releasing` to `BudgetLedgerSchema` in the contracts schema definitions. This is a data integrity issue - ledger records created with these statuses cannot be re-validated against the schema.

---

### Issue 5: Budget Allocator Reserves Amount = 1 for All Executions Regardless of Actual Cost

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Line:** 461

**Problem:** The budget reservation uses:
```typescript
amount: 1,
resourceKind: "token",
```
A reservation of 1 token is made for every harness run, regardless of the actual step count, model, or expected token usage. This completely bypasses the R4-27 (INV-RUN-001) intent of tracking actual execution cost. The `budgetUsdLimit` on the execution record (set to `1` at line 163) is similarly hardcoded.

**Severity:** high

**Recommended fix:** Calculate actual expected token usage based on the planned workflow step count and model, then reserve that amount. Use `estimateLlmCallCost()` per step to build an accurate reservation. Add a pre-flight check that fails if the ledger doesn't have sufficient reserved capacity.

---

### Issue 6: Fencing Token Type Mismatch Between Writeback Service and Lease Service

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.ts`  
**Line:** 56

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts`  
**Line:** 173

**Problem:** 
- `WorkerWritebackInput.fencingToken` is typed as `number` (writeback-service.ts line 56)
- `ExecutionLeaseService.acquireLeaseWithinTransaction()` initializes fence token as string result from `getLatestFencingToken() + 1` 
- HarnessRun SQL INSERT (multi-step-orchestration.ts line 375) stores `fencing_token` 
- `validateWriteAccess()` compares `input.fencingToken !== activeLease.fencingToken`

If the lease service returns a string-based token but writeback sends a number, the validation would always fail. This creates a split-brain vulnerability where workers cannot successfully write back because their fencing token is typed incorrectly.

**Severity:** critical

**Recommended fix:** Normalize fencing token to a single type (either `string` or `number`) consistently across:
1. `ExecutionLeaseService.acquireLeaseWithinTransaction()` 
2. `WorkerWritebackInput.fencingToken`
3. `validateWriteAccess()` comparison
4. HarnessRun SQL schema and insertion

---

### Issue 7: getLatestFencingToken() Silent Fallback to 0 Defeats Fencing Mechanism

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts`  
**Line:** 173

**Problem:** The fence token initialization uses:
```typescript
getLatestFencingToken(input.executionId) + 1
```
If `getLatestFencingToken()` returns 0 (no prior lease), the first lease gets token = 1. But the method falls back to `workerStore.getLatestFencingToken?.() ?? 0` - if the store doesn't implement this method, every lease gets token 1, making fencing ineffective (a worker with stale token 0 would pass validation).

**Severity:** high

**Recommended fix:** Add an explicit check: if `getLatestFencingToken` is not implemented on the store, throw an error rather than silently using 0. A missing method should be a loud failure, not a silent fallback that defeats the entire split-brain protection mechanism.

---

### Issue 8: dispatchNext() Doesn't Verify Execution Status Before Dispatching

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`  
**Line:** 193-240

**Problem:** `dispatchNext()` evaluates backpressure, worker evaluations, and preemption, but it never checks whether the execution associated with a ticket is still in a state that can receive work. The `ExecutionWorkerWritebackService.recordWriteback()` at line 237 requires `execution.status === "executing"`, but `dispatchNext()` could dispatch to an execution that has already transitioned to a terminal state (e.g., if a prior dispatch succeeded but the worker never called writeback).

**Severity:** high

**Recommended fix:** In `dispatchNext()`, before selecting a worker for a ticket, verify that the execution is still in a dispatchable state (typically "admitted" or "ready"). If the execution has already been claimed or is terminal, skip that ticket and record a reason code.

---

### Issue 9: Emergency Lane Preemption Doesn't Coordinate with Execution State Transitions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`  
**Lines:** 343-387

**Problem:** The emergency lane (lines 343-347) allows preemption for critical/urgent/high priority tickets or critical risk class:
```typescript
const emergencyLaneRequested =
  ticket.priority === "critical"
  || ticket.priority === "urgent"
  || ticket.priority === "high"
  || ticket.riskClass === "critical";
```
This preempts an existing lease without any coordination with the `TransitionService` or the execution's state machine. A preemption could occur while the currently-executing worker is in the middle of a state transition (e.g., committing a side effect), creating a race condition where:
1. Worker is transitioning execution to "succeeded"
2. Preemption service grabs the lease
3. New worker starts executing before the original transition completes

**Severity:** high

**Recommended fix:** Before preempting, check that the target execution is not in a state transition. Add a coordination protocol where preemption requests wait for any in-flight transitions to complete, or implement a "preemption acknowledged" signal from the worker before forcing lease release.

---

### Issue 10: Worker Writeback Error Mapping Hides Programming Errors

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.ts`  
**Lines:** 579-598

**Problem:** The catch block maps all errors to either `"invalid_terminal_transition"` or `"authoritative_store_unavailable"`:
```typescript
catch {
  return {
    accepted: false,
    reasonCode: message?.includes("invalid_transition") 
      ? "invalid_terminal_transition" 
      : "authoritative_store_unavailable",
    ...
  };
}
```
A `TypeError`, `RangeError`, or other programming error would be silently mapped to a store error, hiding bugs. The stack trace is lost and the reason code is misleading.

**Severity:** medium

**Recommended fix:** In the catch block, log the actual error with its stack trace. Distinguish between expected state machine errors (which are acceptable to swallow) and unexpected programming errors (which should propagate with their original context). Consider a catch block like:
```typescript
catch (err) {
  logger.log({ level: "error", message: "Writeback unexpected error", data: { error: err } });
  if (err instanceof WorkflowStateError) {
    return { accepted: false, reasonCode: "invalid_terminal_transition", ... };
  }
  throw err; // Re-throw unexpected errors
}
```

---

### Issue 11: Cost Event WAL Hardcodes Provider/Model Undermining R4-28 Purpose

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`  
**Lines:** 566-570

**Problem:** The WAL cost event records:
```typescript
provider: "minimax",
model: "MiniMax-M2.7",
inputTokens: 30 + index * 10,
outputTokens: 12 + index * 5,
costUsd: 0.001 + index * 0.0005,
```
All values are hardcoded placeholders. The actual provider and model from step configuration are ignored. This means the R4-28 WAL for crash recovery contains fake cost data that cannot be used for actual cost attribution or reconciliation.

**Severity:** high

**Recommended fix:** Either:
1. Remove the WAL until real measurement is implemented and add a tracked issue
2. Extract actual provider/model from `step.agentId` or routing context
3. Use the `buildStepOutput` result's `llmResult?.usage` for actual token counts

---

### Issue 12: Budget Reservation Silent Skip When ledgerRow is Undefined

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Lines:** 424-499

**Problem:** When `ledgerRow` is undefined (ledger doesn't exist), the code silently skips reservation:
```typescript
if (ledgerRow) {
  // reservation logic
}
// No else clause - silently continues without budget protection
```
The harness run proceeds without any budget reservation, violating the R4-27 requirement for canonical execution cost tracking. There's no error, no fallback, no warning.

**Severity:** high

**Recommended fix:** If `ledgerRow` is null/undefined:
1. Create the ledger on-demand if the caller provided `budgetLedgerId`
2. Or throw a `ValidationError` with code `budget.ledger.not_found`
3. Document that harness runs require a ledger - don't silently skip

---

### Issue 13: Missing ADR for core/runtime "Compatibility-Only" Architectural Decision

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/core/runtime/index.ts`  
**Problem:** CLAUDE.md states `src/core/runtime/` is compatibility-only, but there's no ADR documenting:
1. What "compatibility-only" means operationally
2. Whether this layer should eventually be removed
3. What the boundary is between core/runtime and platform/five-plane-execution
4. Whether `src/runtime/` serves a different purpose

**Severity:** medium

**Recommended fix:** Create an ADR documenting the runtime layer architecture, specifically:
1. The role of `src/core/runtime/` (compatibility shim vs. legacy adapter)
2. The relationship between `src/core/runtime/`, `src/runtime/`, and `src/platform/five-plane-execution/`
3. Whether new code should import from core/runtime or platform/five-plane-execution
4. The deprecation/removal timeline if applicable

---

### Issue 14: No ADR for Budget Estimate vs Actual Divergence Policy

**Files:** 
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/budget-allocator.ts`

**Problem:** Budget reservation uses estimates but settlement reconciles against actual usage. There's no documented policy for:
1. Maximum acceptable divergence between reserved and actual
2. How to handle under-reservation (actual > reserved)
3. Whether estimates should be conservative (over-estimate) or accurate
4. The crash recovery behavior when WAL cost events have estimated vs actual values

**Severity:** medium

**Recommended fix:** Create an ADR for the budget tracking policy covering:
1. Estimate vs actual divergence tolerance
2. Under-reservation handling (fail-fast vs. allow-overage)
3. WAL recovery semantics when cost events are estimated vs actual
4. SLA implications for tasks that exceed reserved budget

---

### Issue 15: No ADR for Fencing Token Mechanism and Type Normalization

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/lease/execution-lease-service.ts`

**Problem:** The fencing token mechanism spans multiple services with no unified ADR:
- `ExecutionLeaseService` initializes tokens
- `ExecutionWorkerWritebackService` validates tokens  
- `HarnessRun` stores tokens
- Multiple SQL schemas use `fencing_token` column

There's no ADR documenting:
1. The fencing token lifecycle (creation, increment, validation)
2. Type normalization (string vs number)
3. Split-brain detection and recovery
4. Relationship to lease TTL and expiration

**Severity:** medium

**Recommended fix:** Create an ADR documenting the fencing token mechanism as implemented across the execution engine, including type expectations, validation rules, and recovery procedures.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 9     |
| Medium   | 4     |
| **Total**| 15    |

**ADR Gaps:** 3 identified (core/runtime compatibility layer, budget estimate vs actual divergence policy, fencing token mechanism documentation)

**Most impactful issues:**

1. **Fencing token type mismatch** (Critical) - writeback expects number, lease service uses string, causing validation failures
2. **queue-adapter non-existent module** (Critical) - import from non-existent path would fail at module resolution
3. **Budget reservation silent skip** (High) - harness runs without budget protection, violating R4-27
4. **getLatestFencingToken silent fallback to 0** (High) - defeats split-brain protection
5. **dispatchNext doesn't verify execution status** (High) - could dispatch to terminal execution
6. **Emergency lane preemption races with state transitions** (High) - no coordination with TransitionService
7. **BudgetLedgerSchema missing statuses** (High) - data integrity issue
8. **Cost event WAL hardcodes fake data** (High) - R4-28 WAL purpose undermined

**Key architectural gaps:**

1. **No compatibility implementation** in core/runtime - pure pass-through provides no abstraction
2. **No budget reconciliation** - estimates vs actuals diverge without correction
3. **No preemption coordination** - emergency lane can disrupt in-flight state transitions
4. **No fencing token type contract** - number vs string inconsistency across services
5. **No budget reservation enforcement** - harness runs can proceed without reserved budget

## Cross-Review: interface ↔ control-plane

### Directory Coverage

**five-plane-interface modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (1148 lines)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/channel-gateway/tenant-scope-filter.ts` (49 lines)

**five-plane-control-plane/iam modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (573 lines)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/session-management.ts` (577 lines)

Key interaction points reviewed:
- `HttpApiServer.dispatchRequest()` ↔ `session-management.ts` (access token validation, principal extraction)
- `HttpApiServer` rate limiting ↔ `DistributedRateLimiter` configuration
- `TenantScopeFilter.evaluate()` ↔ `session-management.ts` (tenantId in session vs principal)
- `service-auth.ts` ↔ `http-api-server.ts` (service-to-service auth headers)

---

## Issue 1: Rate Limit Key Pattern Mismatch Between `inject()` and `handleRequest()`

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 325-338 - inject path)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 415-427 - handleRequest path)

**Problem:** The `inject()` method at lines 325-338 uses rate limit key `inject:${endpoint}`, while `handleRequest()` at lines 415-427 uses `${clientIp}:${endpoint}`. The same logical endpoint accessed via different paths (direct inject vs HTTP request) would hit different rate limit buckets. This creates an inconsistency where:

1. A client hitting the HTTP endpoint gets rate limited by `clientIp:/api/v1/tasks`
2. The same client using `inject()` directly gets rate limited by `inject:/api/v1/tasks`

These are independent limiters with no coordination. A client could bypass HTTP rate limiting by routing through `inject()`. Additionally, `inject()` does not include `tenantId` in the key (line 327 uses `inject:${endpoint}` only), while the standard HTTP path includes `clientIp` which could be the same for multiple tenants behind a NAT.

**Severity:** high

**Recommended fix:** Normalize rate limit keys to include both `tenantId` (or tenant scope) and endpoint, regardless of entry path. Use a consistent format like `tenant:${tenantId}:endpoint:${endpoint}` for tenant-scoped limiting or `ip:${clientIp}:endpoint:${endpoint}` for IP-scoped. Consider adding `inject` vs `http` as a label rather than a separate bucket.

---

## Issue 2: Session Validation Does Not Extract or Return `tenantId`

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/session-management.ts` (lines 261-308 - validateAccessToken)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 587-594 - dispatchRequest principal extraction)

**Problem:** `validateAccessToken()` at line 261 returns `SessionValidationResult` with `{ valid, session, reason }`. The `session` object contains `principalId` and `principalType` but NOT `tenantId`. The `Session` interface at lines 50-62 has no `tenantId` field.

In `HttpApiServer.dispatchRequest()` (line 588), `authenticateOptionalPrincipal()` extracts `principal?.tenantId ?? null` (line 594) and stores it in `RouteContext`. But since `session-management.ts` never populates `tenantId` in the session, `principal.tenantId` would always be null for user sessions. The `TenantScopeFilter` at line 33 then checks `principal.tenantId !== taskScope.tenantId` which would always be `null !== tenantId` (false), effectively disabling tenant isolation for user sessions.

The comment at session-management.ts lines 50-62 shows `metadata` field but tenantId is not stored there either. Tenant resolution appears to happen elsewhere (likely via `TenantBoundaryRegistryService`).

**Severity:** critical

**Recommended fix:** Add `tenantId: string | null` to the `Session` interface and populate it during `createSession()`. Ensure `validateAccessToken()` returns tenantId via the session object. Alternatively, document the tenant resolution path if tenantId is derived from a different source (e.g., `TenantBoundaryRegistryService` lookup by principalId) rather than from the session token.

---

## Issue 3: Service Auth `extractServiceAuth()` Does Not Validate Tenant Scope

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (lines 501-537 - extractServiceAuth)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/channel-gateway/tenant-scope-filter.ts` (lines 24-48 - TenantScopeFilter.evaluate)

**Problem:** `extractServiceAuth()` at lines 501-537 validates service identity (checks `x-mtls-cert` or `x-service-id` headers) and returns `ServiceAuthResult` with `serviceIdentity` and `token`. The `ServiceIdentity` interface (lines 28-38) has `namespace` but no `tenantId` field.

`TenantScopeFilter.evaluate()` at lines 27-47 requires `principal.tenantId` to match `taskScope.tenantId`. Service principals (from `service-auth.ts`) have no `tenantId` - they have `namespace` (e.g., "execution", "orchestration") which is a different concept. A service calling across planes with no tenant context would fail the tenant mismatch check at line 33-35 with `reasonCode: "scope.tenant_mismatch"`.

However, if `principal.tenantId` is `null` (as it would be for service principals since `TenantScopeFilter` doesn't handle `tenantId: null` specially), the check `null !== taskScope.tenantId` at line 33 would return `false` (no mismatch), meaning service principals could access any tenant's tasks. This is a security gap - services should be scoped to their own namespace/tenant.

**Severity:** critical

**Recommended fix:** In `TenantScopeFilter.evaluate()`, add a check for service principals: if `principal.tenantId === null`, evaluate against `namespace` rather than `tenantId`. Or add a separate `serviceNamespace` field to `PrincipalScope` and validate that service calls are restricted to their own namespace. Document whether service principals are tenant-scoped or platform-wide.

---

## Issue 4: Inconsistent Auth Interceptor Layering Between HTTP and Service Auth

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 581-707 - dispatchRequest)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (lines 501-537 - extractServiceAuth)

**Problem:** `HttpApiServer.dispatchRequest()` calls `authenticateOptionalPrincipal()` at line 588 which uses the `authService` (likely session-based user auth). Service-to-service calls via `x-service-id` headers would be validated by `extractServiceAuth()` but this is not called in the standard HTTP request path - it's called by internal services that need service auth.

The comment at `service-auth.ts` lines 3-7 says: "§11.2: Internal API mTLS / service token authentication §8: Worker pool communication requires mTLS + service identity". Worker pool communication flows through `HttpApiServer` (via `WorkerRegistryService` usage at line 966), but the server's `dispatchRequest()` does not call `extractServiceAuth()` - it only calls `authenticateOptionalPrincipal()`.

This means:
1. User HTTP requests → `authenticateOptionalPrincipal()` (session-based)
2. Service HTTP requests (with `x-service-id` headers) → `authenticateOptionalPrincipal()` ignores service headers, falls through to session auth
3. Internal service calls → `extractServiceAuth()` directly (not via HttpApiServer)

The layering is inconsistent - `HttpApiServer` doesn't distinguish between user and service callers.

**Severity:** high

**Recommended fix:** In `HttpApiServer.dispatchRequest()`, check for service auth headers (`x-service-id`, `x-mtls-cert`) before falling through to `authenticateOptionalPrincipal()`. If service headers are present, call `extractServiceAuth()` to validate the service identity instead of user session auth. Document the precedence rules (service auth takes priority over user auth when both are present).

---

## Issue 5: `authenticateOptionalPrincipal()` Consumes Session But TenantScopeFilter Needs It

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 587-588)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/session-management.ts` (lines 261-308)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/channel-gateway/tenant-scope-filter.ts` (lines 27-47)

**Problem:** `authenticateOptionalPrincipal()` at line 588 calls into the auth service which internally calls `validateAccessToken()`. The `validateAccessToken()` function at line 261-308 consumes the access token for validation (checks expiry, revocation, context binding). However, in `TenantScopeFilter.evaluate()`, the `principal` object passed is the result of authentication, not the validated session.

If the session was validated in `authenticateOptionalPrincipal()` but the session object was not propagated to downstream handlers (only the `principal` was extracted), then `TenantScopeFilter.evaluate()` would be working with a principal that has `tenantId: null` (due to Issue 2). The session validation in control-plane and the tenant scope evaluation in interface are disconnected.

**Severity:** high

**Recommended fix:** Ensure the `Session` object (or at minimum the `tenantId` from the session) is propagated from `authenticateOptionalPrincipal()` through to the `RouteContext.principal`. Add a comment documenting the flow from `validateAccessToken()` → `principal` → `TenantScopeFilter.evaluate()`. Verify that `authService.authenticate()` (from `api-auth-service.ts`) returns or stores `tenantId`.

---

## Issue 6: Service Token TTL (1 hour) vs User Access Token TTL (15 min) Creates Auth Window Mismatch

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/session-management.ts` (line 18 - ACCESS_TOKEN_TTL_MS = 15 min)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (line 16 - SERVICE_TOKEN_TTL_MS = 60 min)

**Problem:** User access tokens have a 15-minute TTL (`ACCESS_TOKEN_TTL_MS` at session-management.ts line 18) while service tokens have a 60-minute TTL (`SERVICE_TOKEN_TTL_MS` at service-auth.ts line 16). If a service makes a call on behalf of a user (e.g., user action triggers a background service task), the service token remains valid for 45 minutes after the user's access token would have expired.

This creates an inconsistency where:
1. User authenticates, gets access token (15min TTL)
2. Service starts processing on user's behalf, gets service token (60min TTL)
3. User's session expires (15 min)
4. Service continues with valid service token but user's session is now expired

The `TenantScopeFilter` would still evaluate the service principal's tenant scope (Issue 3) - the service could access resources even after the originating user's session expired.

**Severity:** medium

**Recommended fix:** If services act on behalf of users, the service token's TTL should be bounded by the user's session TTL (or a refresh token TTL). Add a check in `extractServiceAuth()` or `validateServiceToken()` that verifies the calling user's session is still valid if the service call is user-delegated. Document the delegation model: whether services can act independently of user sessions or must respect user session expiry.

---

## Issue 7: No Rate Limit Headers Attached in `inject()` When Rate Limiter Is Null

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 296-370 - inject method)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 1029-1042 - attachRateLimitHeaders)

**Problem:** In `inject()` (lines 325-338), when `this.rateLimiter != null`, rate limit headers are attached via `attachRateLimitHeaders()`. However, when `this.rateLimiter` is `null` (disabled or not configured), no rate limit headers are attached. The standard HTTP path (`handleRequest()`) always calls `attachRateLimitHeaders()` at line 426 when rate limiter is present.

More critically, in the `else` branch of `inject()` (lines 339-345) where rate limiter is null, the code falls through to `dispatchRequest()` directly without calling `attachRateLimitHeaders()` at all. The response would never include `x-ratelimit-remaining` headers.

This inconsistency means API clients using `inject()` would not receive rate limit feedback, while clients using standard HTTP requests would. Clients cannot know their rate limit status when using `inject()`.

**Severity:** medium

**Recommended fix:** Always attach `x-ratelimit-remaining` header regardless of whether rate limiting is enabled. When rate limiter is null, use a default value like `-1` or the string `"unlimited"` to indicate rate limiting is not active. This provides consistent feedback to API clients.

---

## Issue 8: `TenantScopeFilter` Requires Task Scope Resolution but Interface Doesn't Provide Hook

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/channel-gateway/tenant-scope-filter.ts` (lines 24-48 - TenantScopeFilter class)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 581-707 - dispatchRequest)

**Problem:** `TenantScopeFilter.evaluate()` requires a `TaskProjectionScopeResolver` function (passed to constructor at line 25) to look up task tenant scope. The `HttpApiServer.dispatchRequest()` has no reference to `TenantScopeFilter` and never calls it. This means tenant scope filtering is defined in the interface module but not actually invoked in the request handling path.

If `TenantScopeFilter` is intended to be used by downstream handlers (e.g., channel gateway), the resolver function is not injected into the handlers. The `TaskProjectionScopeResolver` type at line 22 is a function `(taskId: string) => TaskProjectionScope | null`, but there's no way to provide this from `HttpApiServerOptions`.

**Severity:** high

**Recommended fix:** Either:
1. Integrate `TenantScopeFilter` into `HttpApiServer.dispatchRequest()` by injecting it and calling `evaluate()` before routing, or
2. Document that `TenantScopeFilter` is for downstream handlers (e.g., channel gateway) and provide a way to inject the resolver via `HttpApiServerOptions`, or
3. Remove `TenantScopeFilter` from the interface module if it's not used there and move it to the appropriate consumer module.

---

## Issue 9: Service Auth Does Not Check Token Audience Against Target Service

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (lines 323-371 - validateServiceToken)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 797-901 - buildRouteTable)

**Problem:** `validateServiceToken()` at lines 323-371 checks `token.audience !== input.audience && token.audience !== "*"` at line 353. This validates that the service token's audience matches the requested audience. However, `HttpApiServer.buildRouteTable()` at lines 797-901 creates routes for various services (task routes at lines 836-843, gateway routes at lines 829-835, etc.) but does not call `extractServiceAuth()` to validate that the calling service's token audience includes the target service.

For example, if a service with `audience: "execution"` tries to call a route intended for `"orchestration"` services, the call would succeed at the HTTP layer (if the service has valid headers) but would fail silently at the business logic layer if the target service checks audience. The `HttpApiServer` itself does not enforce audience validation.

**Severity:** medium

**Recommended fix:** In the route handler creation (e.g., `createTaskRoutes`, `createGatewayRoutes`), if the route is intended for internal service-to-service communication, add a check that the calling service's token audience matches the route's target service. Document the audience model for service-to-service calls.

---

## Issue 10: Session Store In-Memory Check Not Consistent Between Modules

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/session-management.ts` (lines 95-99 - assertInMemorySessionStoreAllowed)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (lines 95-99 - assertInMemoryServiceIdentityStoreAllowed)

**Problem:** `session-management.ts` line 96 checks `process.env.NODE_ENV === "production" && process.env.AA_ALLOW_IN_MEMORY_SESSION_STORE !== "1"` to throw if in-memory session store is used in production. `service-auth.ts` line 96 has an identical check for `AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE`.

Both modules check environment variables independently. There's no shared enforcement mechanism. If one module is configured to allow in-memory storage but the other is not, the system could have an inconsistent security posture - session data is durable but service identity is in-memory (or vice versa).

**Severity:** medium

**Recommended fix:** Create a shared utility function `assertInMemoryStorageAllowed(storeName: string)` that checks the appropriate environment variable and throws consistently. Use this in both `session-management.ts` and `service-auth.ts`. Document the expected behavior: both stores should either be in-memory or distributed together in production.

---

## Issue 11: Missing ADR for Session-to-Tenant Resolution Flow

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/session-management.ts` (Session interface - no tenantId)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/channel-gateway/tenant-scope-filter.ts` (lines 27-35 - tenantId check)

**Problem:** The `Session` interface (session-management.ts lines 50-62) has no `tenantId` field. The `TenantScopeFilter.evaluate()` at lines 33-35 checks `principal.tenantId !== taskScope.tenantId`. For user sessions, tenant resolution appears to happen via `TenantBoundaryRegistryService` (imported at http-api-server.ts line 13) rather than from the session token.

There's no documented ADR explaining how tenantId is resolved:
1. Is it embedded in the session JWT?
2. Is it looked up from `TenantBoundaryRegistryService` by principalId?
3. Is it passed as a header parameter trusted from the API gateway?

The `TenantBoundaryRegistryService` lookup pattern is: `tenantRegistryService.resolveTenantForActor(principal.actorId)` but this method doesn't exist on the service based on the constructor injection.

**Recommended fix:** Create an ADR documenting:
1. The session-to-tenant resolution path
2. Which component is authoritative for tenantId for a given principal
3. Whether tenantId can change mid-session (e.g., user switches tenant context)
4. How service principals (namespace-scoped) should be handled in tenant scope checks

---

## Issue 12: Missing ADR for Service Auth vs User Auth Precedence

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 587-594 - dispatchRequest)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/service-auth.ts` (lines 501-537 - extractServiceAuth)

**Problem:** When a request arrives at `HttpApiServer` with both user auth headers (e.g., `Authorization: Bearer <token>`) AND service auth headers (e.g., `x-service-id`), there's no documented precedence. The current implementation only processes user auth via `authenticateOptionalPrincipal()`. Service auth is handled by internal services calling `extractServiceAuth()` directly, not via the HTTP server.

There's no documented policy for:
1. Can a service call use user auth headers? Should it?
2. If both are present, which takes precedence?
3. Are services allowed to act on behalf of users (delegation), and if so, how is that modeled?

**Recommended fix:** Create an ADR documenting:
1. The auth header precedence model (service vs user)
2. Whether service calls can be user-delegated and how that affects session tracking
3. The audit trail when a service acts on behalf of a user (which session is charged?)
4. How tenant isolation applies to service-to-service calls

---

## Issue 13: No ADR for Rate Limit Key Design Across Entry Points

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/api/http-api-server.ts` (lines 325-338 vs 415-427)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/ingress/distributed-rate-limiter.ts` (not reviewed)

**Problem:** Rate limit keys differ between `inject()` and `handleRequest()`:
- `inject()`: `inject:${endpoint}` (no tenant, no IP)
- `handleRequest()`: `${clientIp}:${endpoint}` (IP but no tenant)

This creates two different rate limiting behaviors for what might be the same logical operation. An operator cannot reliably predict rate limit behavior based on entry point.

**Recommended fix:** Create an ADR documenting:
1. The rate limit key design principles (what dimensions are used: tenant, IP, endpoint, entry point?)
2. Whether inject() and HTTP requests should share rate limit buckets or have separate limits
3. How multi-tenant deployments should configure rate limiting (per-tenant vs per-IP)
4. The relationship between DistributedRateLimiter and any ingress-level rate limiter

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 5     |
| Medium   | 4     |
| Low      | 0     |
| **Total**| 11    |

**ADR Gaps:** 3 identified (session-to-tenant resolution, service vs user auth precedence, rate limit key design)

**Most Impactful Issues:**

1. **Session validation missing tenantId** (Critical) - `Session` interface has no `tenantId` field, causing `TenantScopeFilter` to always pass user sessions regardless of actual tenant

2. **Service principals bypass tenant isolation** (Critical) - `TenantScopeFilter.evaluate()` with `null` tenantId always passes, meaning services can access any tenant's resources

3. **Rate limit key mismatch** (High) - `inject()` uses `inject:${endpoint}` while `handleRequest()` uses `clientIp:endpoint`, allowing different rate limit behavior for same logical operations

4. **Auth interceptor layering inconsistent** (High) - `HttpApiServer` doesn't distinguish user vs service callers; service auth headers are ignored

5. **Session-to-tenant resolution undocumented** (High) - No clear path from session to tenantId; `TenantScopeFilter` cannot work without knowing where tenantId comes from

6. **Service token TTL vs user session TTL mismatch** (Medium) - Services can act for 60min while user sessions expire at 15min; no delegation model enforcement

7. **No rate limit headers when limiter disabled** (Medium) - `inject()` doesn't attach rate limit headers when limiter is null, providing inconsistent client feedback

8. **`TenantScopeFilter` not integrated into HTTP server** (High) - Defined in interface but never called in `dispatchRequest()`; no resolver is injected

**Root Cause Analysis:**

The interface ↔ control-plane interaction suffers from several fundamental architectural gaps:

1. **No shared principal type** - `session-management.ts` creates `Session` without `tenantId`, but `TenantScopeFilter` expects `PrincipalScope` with `tenantId`. The two modules use incompatible principal representations.

2. **Auth layering is incomplete** - `HttpApiServer` only handles user auth via `authenticateOptionalPrincipal()`. Service auth (`extractServiceAuth()`) is handled by internal services separately, creating two separate auth paths with no integration.

3. **Rate limiting is fragmented** - `inject()` and `handleRequest()` use different rate limit keys with no shared configuration. The rate limiter is optional (`DistributedRateLimiter | null`) and behaves differently depending on which path is used.

4. **Tenant scope filtering is isolated** - `TenantScopeFilter` exists in the interface module but is never invoked by `HttpApiServer`. There's no mechanism to inject the resolver or apply tenant checks to requests.

**Recommended Priority Actions:**

1. Add `tenantId: string | null` to `Session` interface and propagate from `validateAccessToken()` to `RouteContext.principal`
2. Integrate `TenantScopeFilter` into `HttpApiServer.dispatchRequest()` with a configurable resolver
3. Normalize rate limit keys to include `tenantId` consistently across `inject()` and `handleRequest()`
4. In `HttpApiServer`, check for service auth headers before falling through to user auth
5. Add `namespace` check to `TenantScopeFilter.evaluate()` for service principals (when `tenantId === null`)
6. Create ADR documenting session-to-tenant resolution, service vs user auth precedence, and rate limit key design


---

## Cross-Review: tests/unit ↔ contracts

### Directory Coverage
Cross-checking:
- Test file: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts`
- Test file: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/prompt-bundle/prompt-bundle.test.ts`
- Contract file: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/index.ts`
- Contract file: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts`

---

## Issue 1: displayVersion Mismatch Between PromptVersionManager and Contract

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (line 155)
- Test mock: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/prompt-bundle/prompt-bundle.test.ts` (lines 407, 410, 499)

**Problem:** The `PromptBundle` contract defines `displayVersion: string` as a required field (line 32 of prompt-bundle/index.ts). The `createMockBundle()` helper (line 499) correctly sets `displayVersion` to the provided parameter. However, the `listBundleVersions` return type (`PromptBundleVersion`) is tested with `assert.equal(v1!.displayVersion, undefined)` at lines 407 and 410, asserting that `displayVersion` is `undefined`. This contradicts the contract where `displayVersion` is always a `string`.

**Severity:** high

**Recommended fix:** Change assertions at lines 407 and 410 to check for the actual string value:
```typescript
assert.equal(v1!.displayVersion, "v1.0");
assert.equal(v2!.displayVersion, "v2.0");
```

---

## Issue 2: HarnessRun Schema Missing `goal` and `mode` Fields

**Files:**
- Contract model: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (lines 287-288)
- Contract schema: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/schemas.ts` (lines 236-267)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts` (lines 288-323)

**Problem:** The `HarnessRun` interface defines `goal?: string` and `mode?: string` at lines 287-288 of contract-models.ts. However, `HarnessRunSchema` at lines 236-267 of schemas.ts does not include `goal` or `mode` fields. The test at lines 288-323 validates canonical statuses but does not validate these optional fields, and `validateExecutableContract("HarnessRun", run)` would strip these fields during schema validation.

**Severity:** medium

**Recommended fix:** Add to `HarnessRunSchema`:
```typescript
goal: z.string().optional(),
mode: z.string().optional(),
```

---

## Issue 3: listBundleVersions numericVersion Uses Different Normalization Than Contract

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 324-353)
- PromptVersionManager: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/prompt-engine/registry/prompt-version-manager.ts` (lines 86-92)

**Problem:** The `normalizeVersion()` function in the prompt-bundle contract (line 332-338) converts semver to integer via `major * 100 + minor * 10 + patch`, e.g., "v1.2.3" → `123`. But `PromptVersionManager.normalizeComparableVersion()` (line 91) uses `major * 100 + minor * 10 + (patch ?? 0)`. These are consistent for full semver, but the contract's `normalizeVersion()` also handles "v1" (major-only) as `major * 10` (line 345), while the prompt-version-manager's `parseVersion()` would return `patch: undefined` for "v1", yielding the same `major * 100` calculation (different result).

Specifically, `"v1"` in contract normalization yields `10`, but `"v1"` parsed by prompt-version-manager yields `major=1, minor=0, patch=0` → `1*100 + 0*10 + 0 = 100`. This mismatch means version comparisons in tests (which use PromptVersionManager) may not reflect actual contract behavior.

**Severity:** high

**Recommended fix:** Align the version normalization logic. The contract's `normalizeVersion()` at line 345 should be reviewed for the `v1` → `10` mapping, or PromptVersionManager's `normalizeComparableVersion()` should be updated to match. Document which normalization is authoritative.

---

## Issue 4: Test Mock Bundle version Normalization Differs From Contract

**Files:**
- Test mock: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/prompt-bundle/prompt-bundle.test.ts` (lines 490-493)
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 324-353)

**Problem:** `createMockBundle()` (line 490-493) computes normalized version via:
```typescript
const normalizedVersion = displayVersion
  .replace(/^v/i, "")
  .split(".")
  .reduce((accumulator, segment, index) => accumulator + Number(segment) * (index === 0 ? 100 : index === 1 ? 10 : 1), 0);
```
This yields `"v1.0"` → `100`. But the contract's `normalizeVersion()` at line 332-338 yields `"v1.0"` → `1*100 + 0*10 + 0 = 100` — consistent. However, for `"v1"` (major-only), the mock yields `1*100 = 100`, while the contract at line 345 yields `1*10 = 10`. If tests use "v1" as displayVersion, version comparison would be incorrect.

**Severity:** medium

**Recommended fix:** Use `normalizeVersion()` from the actual contract in `createMockBundle()` to ensure consistency, or add a comment explaining the different normalization semantics.

---

## Issue 5: Missing Test Coverage for Contract Edge Case: deprecated=true + lifecycleStatus="active"

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 191-196)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/prompt-bundle/prompt-bundle.test.ts` (lines 415-423)

**Problem:** The contract at line 191-196 explicitly rejects a bundle where `deprecated === true` AND `lifecycleStatus === "active"`:
```typescript
if (bundle.metadata.deprecated === true && bundle.metadata.lifecycleStatus === "active") {
  throw new ValidationError(
    "prompt_bundle.invalid_lifecycle_status",
    "Deprecated bundles cannot retain lifecycleStatus active.",
  );
}
```
This is a critical invariant but no test verifies this rejection. The test at lines 415-423 only checks that `deprecated=true` bundles are marked correctly, not that the combination with `lifecycleStatus="active"` throws.

**Severity:** high

**Recommended fix:** Add test:
```typescript
test("createPromptBundle throws when deprecated=true but lifecycleStatus=active", () => {
  assert.throws(
    () => createPromptBundle({
      name: "Test",
      version: 1,
      displayVersion: "v1.0",
      domain: "test",
      taskType: "simple",
      systemPrompt: { content: "test", templateVariables: [], channel: "system" },
      compatibilityMatrix: emptyCompatibilityMatrix(),
      metadata: { deprecated: true, lifecycleStatus: "active" },
    }),
    ValidationError,
  );
});
```

---

## Issue 6: PromptVersionManager Tests Use DisplayVersion for Version Lookup

**Files:**
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/prompt-bundle/prompt-bundle.test.ts` (lines 234-256)
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 155)

**Problem:** Tests at lines 234-256 use `createMockBundle("TestBundle", "v1.0")` and then query with `manager.getVersionLineage("TestBundle", "v1.0")`. The bundle's `version` field (line 498) is the normalized integer (`100` for "v1.0"), but the PromptVersionManager stores entries by `displayVersion` string ("v1.0") when `registerBundleVersion` is called. The test queries use the string "v1.0" which matches, but this works only because `registerBundleVersion` uses displayVersion as the key, not the numeric version. This coupling is not obvious from reading the test.

**Severity:** low

**Recommended fix:** Add comments explaining that `registerBundleVersion` uses displayVersion as the key, and the tests use displayVersion strings for lookup. Consider adding a test that queries by numeric version to verify this works correctly.

---

## Issue 7: Test Mocks Do Not Include compatibilityMatrix Required Fields

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 15-24, 261-276)
- Test mock: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/prompt-bundle/prompt-bundle.test.ts` (lines 514-519)

**Problem:** The `PromptBundleCompatibilityMatrix` interface (lines 15-24) defines four required arrays: `toolSchemaVersions`, `evaluatorSchemaVersions`, `domainDescriptorVersions`, `modelRoutingProfiles`. The `validateCompatibilityMatrixShape()` function (lines 261-276) validates these are arrays. The mock at lines 514-519 provides empty arrays which is correct. However, there is no test verifying that a compatibilityMatrix with non-array fields throws the correct ValidationError.

**Severity:** low

**Recommended fix:** Add test for `validateCompatibilityMatrixShape` rejection of invalid input.

---

## Issue 8: No Test for BudgetLedger status Enum Mismatch (Schema vs Factory)

**Files:**
- Contract schema: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/schemas.ts` (line 543)
- Contract model: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (line 617)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts`

**Problem:** `BudgetLedger.status` type allows 7 states but `BudgetLedgerSchema` only defines 4 states ("open", "soft_cap_reached", "hard_cap_reached", "closed"). Tests for budget operations (lines 454-530) use "open" status primarily and don't exercise the "settling", "reserving", "releasing" states. If a ledger with status "settling" were parsed via schema validation, it would be rejected, but the factory `createBudgetLedger` can produce it.

**Severity:** medium

**Recommended fix:** Add test verifying that "settling", "reserving", "releasing" statuses are accepted by `BudgetLedgerSchema`, or add these states to the schema.

---

## Issue 9: Missing Edge Case Coverage for GraphPatch Safety Checks

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/index.ts` (lines 219-246)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts` (lines 325-452)

**Problem:** The `assertGraphPatchSafety()` function (lines 219-246) has two checks:
1. `safe_append` cannot affect executed nodes or side effects (lines 221-226)
2. Side effects require compensation plan (lines 227-232)
3. Cannot `mark_skipped` an executed node (lines 233-245)

The test at lines 365-452 covers most cases but does not test the combination where `affectedExecutedNodes` includes a node NOT in the operations' `targetRef` — this should be allowed under `safe_append`. Also, the edge case where `affectedSideEffects` is non-empty with `compensationPlanRef` but `compatibilityClass` is not `requires_human_approval` is not tested.

**Severity:** low

**Recommended fix:** Add test cases for:
1. `safe_append` with `affectedExecutedNodes` that don't match any operation targetRef (should pass)
2. Side effects with compensation plan but default `compatibilityClass` (should pass)

---

## Issue 10: Contract Comment References Non-Existent ADR-026

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/delegation-request/index.ts` (line 17)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts`

**Problem:** The delegation-request module has a comment referencing "ADR-026 8-factor budget tracking" but no ADR-026 exists in the documentation. This is cross-module leakage — tests for delegation-request contracts don't cover this gap.

**Severity:** medium

**Recommended fix:** Either create ADR-026 documenting the 8-factor budget tracking model, or update the code reference to point to the correct ADR number.

---

## Issue 11: NodeAttempt.attemptNo Lower Bound Enforcement Not Tested

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/index.ts` (lines 289-314)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts` (lines 203-264)

**Problem:** `createNodeAttempt()` at line 300 checks `attemptNo < 1` and throws `ValidationError`. The test at lines 232-238 creates an attempt with `attemptNo: 1` (valid), but there is no test for `attemptNo: 0` or negative values to verify the boundary enforcement.

**Severity:** medium

**Recommended fix:** Add test:
```typescript
test("createNodeAttempt throws on attemptNo < 1", () => {
  assert.throws(
    () => createNodeAttempt({ nodeRunId: "nr1", attemptNo: 0, attemptKind: "initial", executorRef: "w1", inputSnapshotRef: artifact }),
    ValidationError,
  );
});
```

---

## Issue 12: HarnessRun Schema Missing Fields Present in Type

**Files:**
- Contract model: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (lines 282-312)
- Contract schema: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/schemas.ts` (lines 236-267)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts`

**Problem:** The `HarnessRun` type has `goal?: string` and `mode?: string` (contract-models.ts lines 287-288), plus `orgId` (line 285, defaults to tenantId in factory), `riskLevel` (line 289, defaults to "medium"), `riskProfile` (line 290), `ownership` (line 291), `auditRefs` (line 292), `auditTrail` (line 293), `domainId` (line 294), and `missionBinding` (line 311). `HarnessRunSchema` at lines 236-267 is missing `goal`, `mode`, `riskLevel`, `riskProfile`, `ownership`, `auditRefs`, `auditTrail`, `domainId`, and `missionBinding`. The test at line 204-212 uses `createHarnessRun` factory which populates defaults, but `validateExecutableContract("HarnessRun", run)` would strip these optional fields because they are not in the schema.

**Severity:** high

**Recommended fix:** Add missing fields to `HarnessRunSchema` as optional/required as appropriate. This is a significant schema-type divergence that could cause data loss during validation.

---

## Issue 13: No Test for validateExecutableContract with PromptBundle Contracts

**Files:**
- Contract: `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/index.ts` (line 36)
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts`

**Problem:** `validateExecutableContract` is tested only for `TaskDraft`, `ConfirmedTaskSpec`, and `RequestEnvelope` (line 186-196). There is no test for validating `PromptBundle` contracts, which have their own validation logic (`validatePromptBundle`). The cross-module interaction between executable-contracts validation and prompt-bundle validation is untested at the integration point.

**Severity:** medium

**Recommended fix:** Add test:
```typescript
test("validateExecutableContract rejects invalid PromptBundle", () => {
  assert.throws(
    () => validateExecutableContract("PromptBundle", { bundleId: "" }),
    ValidationError,
  );
});
```

---

## Issue 14: Test at Line 196 Uses Invalid Object Literal for RequestEnvelope

**Files:**
- Test: `/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/unit/platform/contracts/executable-contracts/index.test.ts` (line 196)

**Problem:** The test asserts `validateExecutableContract("RequestEnvelope", { requestId: "" })` throws `ValidationError`. However, `{ requestId: "" }` is not a valid input to the `RequestEnvelope` schema — it would fail schema validation for multiple missing required fields (tenantId, principal, etc.). The test correctly expects a ValidationError, but the error could be thrown for the wrong reason (missing required field vs empty string validation). The specific error code is not checked.

**Severity:** low

**Recommended fix:** Check the specific error code:
```typescript
try {
  validateExecutableContract("RequestEnvelope", { requestId: "" });
  assert.fail("should throw");
} catch (e) {
  assert.ok(e instanceof ValidationError);
  assert.equal(e.code, "request_envelope.invalid_request_id");
}
```

---

## ADR Gaps Identified

1. **No ADR for PromptBundle version normalization strategy** — The contract normalizes versions to integers for ordering, but the PromptVersionManager has its own normalization logic. No ADR documents which is authoritative and when each should be used.

2. **No ADR for PromptLifecycleStatus state machine** — The `deprecated + lifecycleStatus="active"` rejection is a business rule with no documented rationale in ADR.

3. **No ADR for GraphPatch safety compatibilityClass semantics** — The distinction between `safe_append` and `requires_human_approval` and their enforcement rules is not documented.

4. **No ADR for BudgetLedger extended status states** — The "settling", "reserving", "releasing" states exist in the type but not in the schema, indicating an incomplete implementation. The decision to add these states needs an ADR.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 5     |
| Medium   | 6     |
| Low      | 3     |
| **Total**| 14    |

**ADR Gaps:** 4 identified

**Most impactful issues:**
- **HarnessRunSchema missing fields** (High) — `goal`, `mode`, `riskLevel`, `riskProfile`, `ownership`, etc. are not in the schema, causing data loss during validation
- **displayVersion undefined assertion** (High) — Tests assert displayVersion is undefined when contract defines it as required string
- **Version normalization mismatch** (High) — PromptVersionManager and prompt-bundle contract use different algorithms for converting "v1" to integer
- **Missing deprecated+lifecycleStatus test** (High) — Critical business rule has no test coverage
- **BudgetLedger schema missing states** (Medium) — "settling", "reserving", "releasing" in type but not schema

**Root Cause Analysis:**
The test mocks were created before the contract fields were finalized, and version normalization logic evolved in two places independently. The HarnessRun schema drift suggests schema updates are not automatically synchronized with type updates.

**Recommended Priority Actions:**
1. Add `goal`, `mode`, and other missing fields to `HarnessRunSchema`
2. Fix displayVersion assertions to expect actual string values
3. Align PromptVersionManager normalization with contract `normalizeVersion()`
4. Add test for deprecated=true + lifecycleStatus="active" rejection
5. Add missing BudgetLedger states to schema or remove from type

## Cross-Review: interaction ↔ orchestration

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/` - nl-gateway, goal-decomposer, proactive-agent, autonomy
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/` - oapeflir, routing

---

## Issue 1: Intent Classification Duplication Without Canonical Owner

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/nl-gateway-support.ts` (lines 516-530, 386-400)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/intake-router-model.ts` (lines 58-98, 384-413)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (line 292)

**Problem:** Two independent intent classification systems exist:
1. `nl-gateway-support.ts` `classifyRisk()` → produces `riskClassification` with `intentType` (task_create, task_modify, query, etc.)
2. `intake-router-model.ts` `classifyIntent()` → produces `IntakeIntentClassification` with intent (query, create, modify, approve, cancel, clarify, chitchat, correction)

The OAPEFLIR loop's `assess` stage (line 288) consumes `UnifiedAssessment` which contains `routingDecision.division` and `routingDecision.workflow` derived from the interaction layer's classification. However, the two classification models are incompatible:
- NL Gateway produces: `task_create | task_modify | task_query | approval_action | cancel_task | clarify | chitchat`
- Intake Router produces: `query | create | modify | approve | cancel | clarify | chitchat | correction`

A `create` intent in intake-router maps to `task_create` in nl-gateway, but there's no explicit mapping function. The routing decision at line 292 `assessment.routingDecision.division` receives `"coding"` as default when assessment validation fails (line 321), bypassing any intent-based routing logic from the intake layer.

**Severity:** high

**Recommended fix:** Create a canonical `IntentClassification` interface in a shared contracts location, with explicit mapping functions between NL Gateway's intent taxonomy and Intake Router's taxonomy. The OAPEFLIR assess stage should receive the classified intent from the intake layer rather than deriving it independently.

---

## Issue 2: Three Independent Autonomy Level Systems With No Unified Model

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/proactive-agent/index.ts` (lines 233-234, 262-284, 416-419)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/autonomy/autonomy-service.ts` (lines 42-53)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/improve-rollout/autonomy-boundary-policy.ts` (lines 23-44)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 346-357)

**Problem:** Three separate autonomy systems exist with incompatible models:

1. **ProactiveAgentService** (`interaction/proactive-agent/index.ts` line 233-234):
   - `currentAutonomyLevel: "suggestion" | "supervised" | "semi_auto" | "full_auto"`
   - Gates trigger firing (line 417): only fires when `semi_auto` or `full_auto`
   - Adjusts action mode via `getAutonomyAdjustedActionMode()` (line 262-284)

2. **AutonomyService** (`interaction/autonomy/autonomy-service.ts` line 42-53):
   - `resolveLevel()` uses threshold-based mapping on `riskScore >= 80 → manual, >= 60 → supervised, etc.`
   - Does NOT use task type in determination despite `taskType` field existing in request

3. **AutonomyBoundaryPolicy** (`platform/five-plane-orchestration/improve-rollout/autonomy-boundary-policy.ts` line 23-44):
   - Checks `AutonomyTarget` (`routing_policy`, `planning_policy`, `execution_policy`, etc.)
   - Gates improvement candidate approval based on `learningObject.promotionStatus === "validated" | "promoted"`
   - Has no concept of `suggestion/supervised/semi_auto/full_auto` levels

The OAPEFLIR loop's default constraintPack (line 346-357) sets `autonomyMode: "full_auto"` but this is never reconciled with ProactiveAgentService's `currentAutonomyLevel`. When ProactiveAgent fires a trigger and creates a task, the task enters OAPEFLIR with `full_auto` autonomy mode regardless of the actual autonomy state of the triggering agent.

**Severity:** critical

**Recommended fix:** Create a unified `AutonomyLevel` enum used across all three systems. Add an `AutonomyReconciliationService` that maps between the different autonomy models. Document in ADR which autonomy system has authority when conflicts arise (e.g., when ProactiveAgent is in `supervised` mode but OAPEFLIR constraintPack says `full_auto`).

---

## Issue 3: Proactive Agent Trigger Fire Loop vs OAPEFLIR Execute Loop Uncoordinated

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/proactive-agent/index.ts` (lines 329-448, 505-527)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 80-115, 381-420)

**Problem:** ProactiveAgentService can fire triggers that result in `actionType: "create_task"` (line 44), which calls `enqueueSuggestion()` and creates a suggestion. However, the OAPEFLIR loop has its own execute stage that processes tasks independently. There's no coordination mechanism to prevent:

1. ProactiveAgent firing a trigger that creates a task while that same task is already being processed by an OAPEFLIR loop
2. Duplicate execution: ProactiveAgent's `enqueueSuggestion()` (line 505) doesn't check if a task with the same trigger goal is already running in OAPEFLIR
3. Resource contention: Both loops can execute concurrently without sharing budget information

The `ProactiveTrigger` interface (line 5-10) has no field to track if a task derived from it is currently in an OAPEFLIR execution cycle. The ProactiveAgentService stores state in its own Map (line 225 `states`), completely independent of OAPEFLIR's `loopPlanGraphBundle` and execution state.

**Severity:** high

**Recommended fix:** Add a `activeTaskRef` field to `TriggerRuntimeState` that records the taskId when a trigger fire results in a task being sent to OAPEFLIR. Before allowing a trigger to fire, check if an active task already exists for that trigger. Add ADR documenting the trigger-to-OAPEFLIR handoff protocol.

---

## Issue 4: Goal Decomposition Output Not Directly Consumed by OAPEFLIR Planning

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/goal-decomposer/index.ts` (lines 238-241, 415-418)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 362-373)

**Problem:** `GoalDecompositionService` produces a task graph (via `decompose()`) with `taskIds`, `dependencies`, and `executionOrder`. However, OAPEFLIR's plan stage (line 362-373) builds a `PlanGraphBundle` directly from `input.workflow` (the `PlannedWorkflow`), not from the goal decomposition output.

The `OapeflirLoopInput` interface (line 80-92) receives `workflow: PlannedWorkflow` but has no field for `goalDecomposition`. The Assess stage's `observedTask` (line 262-286) is built from `TaskSituationBuilder` with no reference to a decomposed goal graph.

If a user request goes through goal decomposition first, the resulting task graph is stored in `GoalDecompositionResult` but never passed to OAPEFLIR's planning stage. OAPEFLIR rebuilds its own plan from `workflow.executionSteps`, ignoring any pre-computed decomposition.

**Severity:** high

**Recommended fix:** Add `goalDecomposition?: GoalDecompositionResult` field to `OapeflirLoopInput`. In the plan stage, if `goalDecomposition` is provided, use its task graph structure as the authoritative task list rather than `workflow.executionSteps`. Add validation that the workflow steps align with the decomposed task graph.

---

## Issue 5: OAPEFLIR Assess Stage Receives Unvalidated IntakeRouteDecision

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/intake-router-model.ts` (lines 467-495)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 262-286, 307-327)

**Problem:** `shouldRequireOrchestration()` at line 467-495 in intake-router-model.ts decides `requiresOrchestration: boolean` based on `riskClass`, `matchedHints.length`, `normalizedInput.length`, and `classification.continuation`. However:

1. The `riskClass` parameter is passed as optional `riskClass?: "low" | "medium" | "high" | "critical"`
2. When `riskClass` is not provided, `shouldRequireOrchestration()` defaults to `false` unless other conditions (matched hints, input length) are met
3. The `IntakeRouteDecision` (line 128-164) carries `requiresOrchestration` flag but this is never passed to OAPEFLIR's Assess stage
4. OAPEFLIR's Assess stage (line 288) calls `assessment.assess(observedTask, input.constraintPack, input.effectivePolicy)` without any `requiresOrchestration` context

If intake routing decides a task requires orchestration but OAPEFLIR Assess stage classifies it as low-risk and routes it to a simple single-step execution, the orchestration requirement is lost.

**Severity:** medium

**Recommended fix:** Add `requiresOrchestration: boolean` to `OapeflirLoopInput` and propagate it to the Assess stage. If `requiresOrchestration` is true, the Assess stage should set `executionMode: "orchestrated"` regardless of risk score, ensuring multi-step workflow execution.

---

## Issue 6: AutonomyBoundaryPolicy Target Mismatch With ProactiveAgent Action Modes

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/proactive-agent/index.ts` (lines 72-77, 262-284, 439-441)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/improve-rollout/autonomy-boundary-policy.ts` (lines 3-9, 16-21)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 640-688)

**Problem:** `ProactiveAgentService` produces action modes: `"auto_execute" | "suggest" | "silent_record"` (line 75-76). `AutonomyBoundaryPolicy` decides on `AutonomyTarget` values: `"routing_policy" | "planning_policy" | "execution_policy" | "memory_policy" | "sandbox_policy" | "provider_registry"` (line 3-9).

When OAPEFLIR's improve stage calls `autonomyBoundary.decide("planning_policy", validatedLearningObjects)` (line 640), it checks if learning objects are validated. But there's no mapping between:
- ProactiveAgent's `actionMode` (which controls whether a suggestion becomes an auto-executed action)
- OAPEFLIR's `AutonomyTarget` (which controls whether a planning policy improvement is allowed)

If ProactiveAgent fires with `actionMode: "auto_execute"` and creates learning objects, those objects go through OAPEFLIR's improve stage which applies `AutonomyBoundaryPolicy.decide("planning_policy", ...)`. The `auto_execute` intent from ProactiveAgent is completely ignored in the autonomy boundary decision.

**Severity:** medium

**Recommended fix:** Add `actionMode` context to the `AutonomyBoundaryDecision` request. When `actionMode === "auto_execute"`, the boundary policy should apply stricter validation (requiring not just `validated` status but also higher evidence thresholds). Document the mapping between ProactiveAgent action modes and AutonomyTarget authority levels.

---

## Issue 7: Duplicate Confidence Threshold Constants Without Canonical Source

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/intake-router-model.ts` (line 55: `CONFIDENCE_THRESHOLD = 0.80`)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/nl-gateway-support.ts` (line 156: `threshold: 0.80` in config)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/nl-gateway/disambiguation-handler/index.ts` (line 47-52: `DEFAULT_DISAMBIGUATION_CONFIG.threshold = 0.70`)

**Problem:** Multiple confidence threshold constants exist:
1. `intake-router-model.ts` line 55: `CONFIDENCE_THRESHOLD = 0.80` for LLM intent extraction
2. `nl-gateway-support.ts` line 156: `0.80` for clarification threshold per §39.6
3. `disambiguation-handler/index.ts` line 47-52: `0.70` for disambiguation threshold

These are not synchronized. The disambiguation handler default (0.70) is lower than the NL gateway's clarification threshold (0.80), creating a gap zone between 0.70-0.79 where disambiguation does not trigger despite the higher gateway threshold wanting clarification.

**Severity:** high

**Recommended fix:** Create a shared constants module (e.g., `src/platform/contracts/constants/intake-thresholds.ts`) that exports all intake-related thresholds. Both interaction and orchestration modules should import from this canonical source. Add ADR documenting the threshold synchronization requirement.

---

## Issue 8: OAPEFLIR Loop Controller vs ProactiveAgent State Tracking Split

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts` (lines 358, 488-510)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/interaction/proactive-agent/index.ts` (lines 225, 329-448)

**Problem:** `OapeflirLoopService` uses `HarnessLoopController` (line 358) to track iterations, cost, and replan decisions. `ProactiveAgentService` maintains its own `states` Map (line 225) tracking trigger fire counts, cooldown, consecutive failures.

Both track some form of "run budget" but with no coordination:
- OAPEFLIR's `loopController.getGuardViolation()` (line 509) can abort the loop
- ProactiveAgent's `dailyTriggerBudgetByDomain` (line 343-346) tracks domain daily budgets
- ProactiveAgent's `maxConsecutiveFailures` (line 339-340) circuit breaker

If ProactiveAgent fires multiple triggers that all result in OAPEFLIR task executions, there's no shared budget tracking. A domain could exhaust ProactiveAgent's daily budget but OAPEFLIR continues executing tasks for that domain because the loop controller doesn't know about ProactiveAgent's budget state.

**Severity:** medium

**Recommended fix:** Create a shared `ExecutionBudgetRegistry` that ProactiveAgent and OAPEFLIR both consult. ProactiveAgent should check the registry before firing, and OAPEFLIR should update the registry after execution. Add ADR for cross-module budget coordination protocol.

---

## ADR Gaps Identified

1. **No ADR for intent classification ownership** - Two independent classification systems exist (NL Gateway vs Intake Router) with no documented authority model. An ADR should designate which module is the canonical source for intent classification and how the other module should consume it.

2. **No ADR for autonomy level reconciliation** - Three autonomy systems (ProactiveAgent, AutonomyService, AutonomyBoundaryPolicy) have incompatible models. An ADR should define the unified autonomy model and the reconciliation protocol when systems disagree.

3. **No ADR for trigger-to-OAPEFLIR handoff** - ProactiveAgent can fire triggers that create tasks processed by OAPEFLIR, but there's no documented handoff protocol, no deduplication check, and no resource budget sharing. An ADR should define the trigger lifecycle and its interaction with the execution plane.

4. **No ADR for goal decomposition to planning pipeline** - Goal decomposition output is not consumed by OAPEFLIR's planning stage. An ADR should define whether goal decomposition is a pre-processing step or an independent path, and how the task graph should flow to the execution plane.

5. **No ADR for improvement candidate origin tracing** - `AutonomyBoundaryPolicy.decide("planning_policy", learningObjects)` doesn't track whether the learning objects originated from a proactive trigger fire or a user-initiated task. The origin context could affect the approval bar. An ADR should define whether provenance affects improvement policy.

6. **No ADR for cross-module threshold synchronization** - Confidence thresholds are duplicated across modules with different values. An ADR should establish a threshold governance model with a canonical constants source.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 5     |
| Medium   | 4     |
| Low      | 0     |
| **Total**| 10    |

**ADR Gaps:** 6 identified

**Most Impactful Issues:**

1. **Critical:** Three independent autonomy level systems with no unified model (Issue 2) - ProactiveAgent, AutonomyService, and AutonomyBoundaryPolicy all use different autonomy representations, creating silent miscommunication when tasks flow between interaction and orchestration.

2. **High:** Goal decomposition output not consumed by OAPEFLIR planning (Issue 4) - The pre-computed task graph from goal decomposition is discarded when OAPEFLIR builds its own plan from `workflow.executionSteps`, causing potential misalignment between planned and executed tasks.

3. **High:** ProactiveAgent trigger fire loop uncoordinated with OAPEFLIR execute loop (Issue 3) - No deduplication check prevents duplicate task execution when the same trigger fires while a task is already running in OAPEFLIR.

4. **High:** Intent classification duplication without canonical owner (Issue 1) - Two incompatible taxonomies (NL Gateway `intentType` vs Intake Router `IntakeIntent`) with no explicit mapping, causing routing decisions to potentially misclassify user intent.

5. **High:** Confidence threshold divergence (Issue 7) - Disambiguation handler at 0.70 vs NL gateway at 0.80 creates a gap zone where clarification behavior is undefined.

The cross-module interaction between interaction and orchestration is characterized by implicit handoffs, duplicated concepts (autonomy, intent, confidence), and no shared state coordination. The most critical architectural need is a unified intent and autonomy model that both modules commit to as the canonical representation.


## Cross-Review: state-evidence ↔ domains

### Directory Coverage

**five-plane-state-evidence modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/session-dual-storage.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts`

**domains modules:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts`
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts`

---

## Issue 1: CheckpointEnvelope domainId field conflicts with DomainBaseline domainId

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts` (lines 46-59, 80-89)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts` (lines 108-129)

**Problem:** `CheckpointEnvelopeMetadata` at line 46 defines `payloadSchemaVersion: string` but does not include a `domainId` field. The `DomainBaseline` interface (line 108-129) defines `domainId: VerticalDomainId` as a required field that identifies which domain owns the baseline. However, checkpoint envelopes have no domain affinity - they store arbitrary workflow step checkpoints with no reference to which domain the workflow belongs to.

This creates a conflict when domain-scoped checkpoints need to be stored and retrieved. If `SessionDualStorageService` records checkpoint data for sessions that belong to specific domains, the checkpoint envelope has no field to carry that domain context. The envelope's `schema` field (line 84) is a schema version string, not a domain identifier.

Conversely, `bootstrapVerticalDomainBaselines()` at line 608 registers knowledge namespaces via `stagedRegistry.registerKnowledgeNamespace(namespace, baseline.domainId)`, but these namespaces have no connection to checkpoint storage - there is no `registerCheckpointNamespace()` call or equivalent.

**Severity:** medium

**Recommended fix:** Add `domainId?: string` to `CheckpointEnvelopeMetadata` so domain context can be attached to checkpoints when needed. Update `SessionDualStorageService` to extract domain context from the session record and include it in the checkpoint envelope metadata when recording session events that include checkpoint references.

---

## Issue 2: SessionDualStorageService sessionId conflicts with DomainDefinition domainId namespace

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/session-dual-storage.ts` (lines 95-98, 116-165)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts` (lines 336-340)

**Problem:** `SessionDualStorageService` stores session events in JSONL files named after `sessionId` (line 96: `session-${safeSessionId}.jsonl`). The session record includes `taskId` and `channel` but no domain identifier. Meanwhile, `DomainRegistryService.registerKnowledgeNamespace()` at lines 336-340 tracks knowledge namespaces per domain via `knowledgeNamespacesByDomain`.

There is no intersection - session storage has no domain awareness and domain registry has no session awareness. However, `DomainBaseline` (line 116) includes `knowledgeSchema: DomainKnowledgeSchema` with `namespaceIds` like `${seed.domainId}/default`. If session events reference knowledge operations, the session's taskId could be correlated with domain via `TaskRegistry` or `WorkflowCatalog`, but this correlation is not made in `SessionDualStorageService`.

The session JSONL files use `sessionId` as the primary key but do not include `domainId` in the event payload (lines 171-186 record `session_created` payload without domain context). This means replaying a session's JSONL does not reveal which domain owned the session without external correlation.

**Severity:** medium

**Recommended fix:** Add `domainId: string` to `SessionEvent.payload` (line 51) so session events carry domain context. When `recordSessionCreated()` is called, extract domain context from `session.domainId` (if present) or from `DomainRegistryService` by resolving `session.taskId` to a domain. This enables session replay to understand domain ownership without external lookups.

---

## Issue 3: DomainBaseline.knowledgeSchema.namespaceIds not integrated with CheckpointEnvelope compression

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts` (lines 331-352)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts` (lines 129-169)

**Problem:** `buildKnowledgeSchema()` at line 331 creates namespaces like `${seed.domainId}/default` and `${seed.domainId}/governed`. The checkpoint envelope at line 156-168 creates a metadata block with `originalSizeBytes`, `compressedSizeBytes`, `checksum`, etc. but has no `namespaceId` or `knowledgeDomainId` field.

If domain-specific knowledge is embedded in checkpoint payloads (e.g., domain-specific prompt templates, guardrails, or eval criteria), the compression and storage layer has no awareness of which knowledge namespace the checkpoint belongs to. This means:
1. Checkpoints cannot be efficiently routed to domain-specific storage policies
2. Knowledge schema freshness windows (line 337: `freshnessWindowHours`) cannot be enforced on checkpoint lifecycle
3. Domain governance policies (line 440: `complianceRules`, `mandatoryEvidence`) cannot be applied to checkpoints

**Severity:** low

**Recommended fix:** Add `namespaceId?: string` to `CheckpointEnvelopeMetadata`. When creating checkpoints for domain-specific workflows, include the knowledge namespace so storage policies can apply domain-specific retention and access control.

---

## Issue 4: DomainRegistryService.registerKnowledgeNamespace uses Set but SessionDualStorageService uses Map

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts` (lines 23, 336-340)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/session-dual-storage.ts` (lines 71-76)

**Problem:** `DomainRegistryService` tracks knowledge namespaces per domain in `knowledgeNamespacesByDomain: Map<string, Set<string>>` (line 23). This is a read-only tracking structure - namespaces are registered but never queried for intersection with session data. `SessionDualStorageService` has no concept of knowledge namespaces - it treats sessions as pure event streams.

When a session ends and its events are replayed via `replaySessionEvents()` (line 298), there is no integration point that would use domain knowledge namespaces to filter, redact, or interpret session content. The two modules operate completely independently:
- Domain registry knows about domain boundaries and knowledge namespaces
- Session storage knows about session event chronology but not domain semantics

**Severity:** medium

**Recommended fix:** Add a `DomainKnowledgeIntegration` service that, given a `sessionId`, can:
1. Resolve the session's taskId to a domainId via some registry lookup
2. Query `DomainRegistryService.getKnowledgeNamespaces(domainId)` to get authorized namespaces
3. Use these namespaces to filter or annotate session events during replay

Alternatively, document that session storage is domain-agnostic by design and domain context must be injected at the session creation boundary.

---

## Issue 5: CheckpointEnvelope maxSizeBytes default (10MB) may exceed domain budget limits

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts` (line 36)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts` (lines 483-486)

**Problem:** `DEFAULT_MAX_CHECKPOINT_SIZE_BYTES` is set to 10MB (line 36). The domain baseline's `buildDefinition()` at lines 483-486 sets `maxTokensPerTask` and `maxCostPerTask` limits based on risk level, but has no `maxCheckpointSizeBytes` field. The `DomainRiskProfile` (line 281) defines blast radius and reversibility but not storage limits.

If a critical-risk domain (riskLevel === "critical") creates large checkpoints approaching 10MB, there is no domain-specific override to lower this limit. Critical domains should arguably have smaller checkpoint limits to reduce blast radius of corruption.

**Severity:** medium

**Recommended fix:** Add `maxCheckpointSizeBytes` to `DomainBaseline.capabilities` or `DomainRiskProfile`. In `createCheckpointEnvelope()`, check if the domain has a custom max and use that instead of the global default. For critical risk domains, recommend a smaller default (e.g., 2MB) to limit corruption blast radius.

---

## Issue 6: DomainRegistryService.buildCapabilityEntry includes knowledgeNamespaces but SessionDualStorage has no knowledge query

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts` (lines 321-334)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/session-dual-storage.ts` (lines 298-328)

**Problem:** `DomainRegistryService.buildCapabilityEntry()` at line 330 includes `knowledgeNamespaces: [...(this.knowledgeNamespacesByDomain.get(domainId) ?? new Set<string>())]`. This exposes domain knowledge namespaces as part of the capability entry. However, `SessionDualStorageService` has no method to query knowledge - `replaySessionEvents()` and `replayTaskSessionHistory()` return raw events without any knowledge namespace filtering.

If a session contains events that reference knowledge operations (e.g., `knowledge.retrieve`, `knowledge.store`), the session replay would not validate these against the domain's authorized knowledge namespaces. There is no `validateSessionKnowledgeAccess()` or similar integration point.

**Severity:** low

**Recommended fix:** If sessions can contain knowledge operations, add a `validateSessionKnowledgeNamespaces(events: SessionEvent[]): ValidationResult` method to `SessionDualStorageService` that checks event payload references against the domain's authorized knowledge namespaces from `DomainRegistryService`.

---

## Issue 7: DomainBaseline.metaModel vs CheckpointEnvelope schemaVersion — no cross-validation

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts` (lines 510-518, 141-148)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts` (lines 129-169)

**Problem:** `DomainBaseline.metaModel` is built via `seedDomainMetaModel()` (line 510) and validated via `MetaModelValidator` (line 518). The meta model tracks domain metadata including `taskTypes`, `tags`, and `riskLevel`. The checkpoint envelope's `schema` field (line 84) is a free-form string that could be any value - there is no validation that `envelope.schema` is consistent with the domain's meta model expectations.

For example, if a checkpoint's `schema` field says `"workflow_step_checkpoint.v1"` but the domain's meta model expects a different schema version, the checkpoint would be accepted without validation. The meta model validation at line 518 only validates the meta model itself, not its relationship to checkpoint schemas.

**Severity:** low

**Recommended fix:** Add a `validateCheckpointSchema(domainId: string, schema: string): boolean` method to `DomainRegistryService` that checks if a checkpoint schema is compatible with the domain's meta model. Call this in `unpackCheckpointEnvelope()` when domain context is available.

---

## Issue 8: DomainRegistryService pluginBindings validation uses installedPluginIds but SessionDualStorage has no plugin awareness

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts` (lines 384-409)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/session-dual-storage.ts` (lines 46-52, 116-165)

**Problem:** `validateDefinition()` at lines 384-409 validates plugin bindings against `installedPluginIds` and `healthyPluginIds`. The session dual storage service records events with `payload` that may include `pluginId` references (e.g., `message_added` event at line 258-274 includes message content that could reference plugin outputs). However, there is no validation that plugin IDs in session events correspond to plugins that are registered and healthy in `DomainRegistryService`.

If a session replays events that reference a plugin that has since been deregistered or marked unhealthy, the replay does not detect this inconsistency.

**Severity:** medium

**Recommended fix:** Add a `validateSessionPluginReferences(events: SessionEvent[]): PluginValidationResult` method to `SessionDualStorageService` that checks all `pluginId` values in event payloads against `DomainRegistryService.getPluginBindings()`. Flag any references to plugins that are no longer registered or healthy.

---

## Issue 9: DomainRegistryService status lifecycle (draft → registered → canary → active → updating → deprecated → archived) vs SessionDualStorage event types

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/registry/domain-registry-service.ts` (lines 40-247)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/truth/session-dual-storage.ts` (lines 33-41)

**Problem:** `DomainRegistryService` has a 7-state lifecycle: `draft → registered → canary → active → updating → deprecated → archived`. `SessionDualStorageService.SessionEventType` (line 33) includes `session_created`, `session_updated`, `session_completed`, `session_failed`, `session_cancelled`, `message_added`, `message_updated`, `compaction_recorded`. There is no direct mapping between domain lifecycle transitions and session events.

If a domain transitions from `active` to `updating`, there is no `domain_status_changed` session event recorded. The domain lifecycle is tracked entirely within `DomainRegistryService` via event publishing (e.g., `eventType: "domain:updating"` at line 157) but these are not stored in the session JSONL. Session storage only handles session-level events, not domain-level events.

This creates an audit gap - domain lifecycle transitions are not available in the session replay timeline.

**Severity:** low

**Recommended fix:** Add `domain_lifecycle_transition` to `SessionEventType` union. When `DomainRegistryService` publishes domain lifecycle events (lines 61-70, 100-109, 132-141, etc.), also record them in the session JSONL for the associated task/session so they appear in the replay timeline.

---

## Issue 10: DomainRegistryService knowledgeNamespaces registration happens after domain activation, but checkpoints may be created before

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/domains/domain-baseline-catalog.ts` (lines 608-654)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts` (lines 129-169)

**Problem:** `bootstrapVerticalDomainBaselines()` at line 608 registers domains and then activates them (line 622-624). Knowledge namespaces are registered at line 619-621 AFTER registration but the activation happens at line 623 in the same loop iteration. Checkpoints could be created during the activation process (or just after registration but before namespace registration completes), and they would have no knowledge namespace context.

The bootstrap process is sequential per domain: register → register namespaces → activate. But if multiple domains are being bootstrapped in parallel by different threads, the namespace registration could lag behind activation, creating a window where checkpoints for a domain lack namespace context.

**Severity:** low

**Recommended fix:** Register knowledge namespaces BEFORE activation in the bootstrap sequence. Ensure the namespace registration is atomic with the domain registration, not a separate step that could be reordered or delayed in concurrent scenarios.

---

## ADR Gaps Identified

1. **No ADR for domain-scoped checkpoint storage policy** - Checkpoints are currently domain-agnostic with no `domainId` in the envelope. An ADR should specify whether checkpoints should carry domain affinity and how domain-specific storage policies (retention, access control) should be applied.

2. **No ADR for session event domain context injection** - Session events do not carry domain context, making replay ambiguous about domain ownership. An ADR should specify when and how domain context should be injected into session events.

3. **No ADR for knowledge namespace and session storage integration** - Knowledge namespaces tracked in `DomainRegistryService` have no integration with session storage for knowledge operation validation. An ADR should specify the relationship between knowledge namespaces and session event filtering/redaction.

4. **No ADR for checkpoint size limits per domain risk level** - Critical risk domains may need smaller checkpoint size limits to limit corruption blast radius, but there is no configurable override. An ADR should specify the relationship between domain risk level and checkpoint storage limits.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 0     |
| Medium   | 7     |
| Low      | 4     |
| **Total**| 11    |

**ADR Gaps:** 4 identified

**Most impactful issues:**

1. **Checkpoint envelope has no domainId field** (Medium) - Domain context cannot be attached to checkpoints, preventing domain-specific storage policies
2. **Session events lack domain context** (Medium) - Session replay cannot determine domain ownership without external correlation
3. **No knowledge namespace validation in session replay** (Medium) - Domain knowledge namespaces are not integrated with session storage
4. **Plugin bindings in session events not validated against registry** (Medium) - Session events may reference deregistered/unhealthy plugins
5. **Domain lifecycle transitions not recorded in session timeline** (Low) - Domain status changes are not in session audit trail

**Root Cause Analysis:**

The `five-plane-state-evidence` and `domains` modules share a boundary at:
- Session events (which may reference domain-owned knowledge or plugins)
- Checkpoint storage (which could carry domain affinity)
- Knowledge namespaces (which are domain-scoped but session-agnostic)

But there is no integration layer that bridges:
- Domain registry's knowledge namespace tracking → session storage's event filtering
- Domain registry's plugin validation → session event plugin reference validation
- Domain risk level → checkpoint size limits
- Domain lifecycle → session timeline annotation

The modules were designed to be independent at this boundary, but real usage requires cross-module coordination for audit, security, and data governance purposes.

**Recommended Priority Actions:**

1. Add `domainId?: string` to `CheckpointEnvelopeMetadata` and `SessionEvent.payload`
2. Add `DomainKnowledgeIntegration` service to validate knowledge namespace references in session events
3. Add `validateSessionPluginReferences()` method to `SessionDualStorageService`
4. Add domain risk level to checkpoint size limit derivation
5. Record domain lifecycle transitions as session events for audit trail completeness


---

## Cross-Review: contracts ↔ execution

### Issue 1: HarnessRunStatus state machine exists in contracts but not enforced in execution

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Line:** 350-365  

**Problem:** The `createHarnessRun()` factory (contracts) creates `HarnessRun` entities with `HarnessRunStatus` values from the canonical contract model. However, the `TransitionService` in five-plane-execution has no knowledge of `HarnessRunStatus` transitions - there is no `HarnessRunTransitionService` or equivalent. The execution engine creates a `HarnessRun` with status `"created"` but never transitions it through `created → admitted → planning → ready → running → completed/failed`. The status remains `"created"` throughout execution lifecycle.

**Severity:** High  

**Recommended fix:** Either add a `HarnessRunTransitionService` that mirrors the `HarnessRunStatus` state machine from contract-models.ts, or document that HarnessRun status tracking is not yet implemented in the execution layer.

---

### Issue 2: NodeRunStatus state machine in contracts not integrated into execution

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts`  
**Line:** 140-227  

**Problem:** The `contract-models.ts` defines `NodeRunStatus` with 13 states including `created, ready, leased, running, retry_wait, awaiting_hitl, reconciling, succeeded, failed, skipped, cancelled, dependency_failed, policy_blocked, aborted` and `NODE_RUN_TERMINAL_STATUSES`. The multi-step-supervisor.ts creates `ExecutionRecord` with `status: "created"` and transitions it through `prechecking → executing`, but the statuses used (`created, prechecking, executing`) are from `ExecutionStatus` in status.ts, NOT `NodeRunStatus`. The `NodeRunStatus` state machine is never used.

**Severity:** High  

**Recommended fix:** Integrate `NodeRunStatus` state machine into the execution engine, or document that `ExecutionRecord.status` uses `ExecutionStatus` rather than `NodeRunStatus`.

---

### Issue 3: Contract envelope signature excludes metadata, but inter-plane gateway relies on metadata for routing

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-envelope.ts`  
**Lines:** 65-72, 99-104  

**Problem:** When signing an envelope, the `signatureInput` includes `schemaVersion:commandId:correlationId:timestamp:payload`. Metadata is NOT included in the signature. The inter-plane contract gateway extracts `sourcePlane` and `targetPlane` from metadata for routing decisions. If metadata is modified after signing (e.g., `sourcePlane` changed to redirect to a different plane), the envelope signature remains valid but routing is compromised.

**Severity:** High  

**Recommended fix:** Include a metadata hash in the signature input, or document clearly that metadata is not integrity-protected and must not be used for security-critical routing decisions without additional verification.

---

### Issue 4: Missing error handling for storage migration failure in orchestration entrypoint

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Line:** 133  

**Problem:** `storage.migrate()` is called without checking its return value or handling potential migration failure. If migration fails, the code continues to execute with a potentially incompatible schema. This is a consistency issue because contracts define schema versions but execution doesn't verify schema validity before proceeding.

**Severity:** High  

**Recommended fix:** Check migration result and wrap in try-catch:
```typescript
const migrationResult = storage.migrate();
if (!migrationResult.success) {
  throw new ValidationError(
    "storage.migration_failed",
    `Database migration failed: ${migrationResult.error}`,
  );
}
```

---

### Issue 5: BudgetLedger status schema missing states that contracts allow

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts`  
**Line:** 617  

**Problem:** `BudgetLedger.status` type allows `"open" | "soft_cap_reached" | "hard_cap_reached" | "closed" | "settling" | "reserving" | "releasing"` (7 states). However, the Zod schema only has 4 states: `"open", "soft_cap_reached", "hard_cap_reached", "closed"`. The execution engine (multi-step-orchestration.ts line 458) casts status to the full 7-state union, but validation against the schema would reject `settling`, `reserving`, or `releasing` statuses.

**Severity:** High  

**Recommended fix:** Add missing statuses to `BudgetLedgerSchema`: `settling`, `reserving`, `releasing`.

---

### Issue 6: HarnessRun status never updated after step execution completes

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Lines:** 586-618  

**Problem:** After `executeStepLoop` completes, the code transitions the task to terminal state via `transitionTaskTerminalState()`. However, the `harnessRun` status remains `"created"` throughout. The harness run is never updated to reflect actual execution outcomes (`running`, `completed`, `failed`, `cancelled`).

**Severity:** High  

**Recommended fix:** Update `harnessRun.status` after step execution completes. The `db.connection.prepare(...)` INSERT at line 372-396 could be followed by UPDATE statements, or a `harnessRun` sub-store should be added to `AuthoritativeTaskStore`.

---

### Issue 7: BudgetAllocator.reserve() bypasses event emission to RuntimeTruthRepository

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Lines:** 424-499  

**Problem:** `BudgetAllocator.reserve()` modifies `budget_ledgers` and `budget_reservations` tables via raw SQL but does not emit `platform.budget.reserved` events. The `RuntimeTruthRepository` relies on event sourcing for consistency - without events, budget state is not reproducible from the event log. This is an inter-module consistency issue between contracts (which define `BudgetReservation` and event types) and execution (which bypasses event emission).

**Severity:** High  

**Recommended fix:** Have `BudgetAllocator.reserve()` (or the caller in multi-step-orchestration.ts) emit `platform.budget.reserved` events to the event store.

---

### Issue 8: Contract envelope timing attack via length-leaking early return

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-envelope.ts`  
**Lines:** 113-120  

**Problem:** `timingSafeHexEqual` returns `false` immediately when `leftBuffer.length !== rightBuffer.length`. This early return leaks length information via timing. An attacker could measure response times to determine signature length. Additionally, error messages at line 89 could leak timing information differently than a signature mismatch.

**Severity:** Medium  

**Recommended fix:** Use `crypto.timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))` directly without the early length check, or ensure the early return is also constant-time. Sanitize error messages in the catch block to avoid leaking internal details via timing differences.

---

### Issue 9: SideEffectStatus state machine not enforced in execution layer

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts`  
**Lines:** 532-548  

**Problem:** The contract defines 16 `SideEffectStatus` values (`proposed`, `approved`, `reserved`, `committing`, `committed`, `confirming`, `confirmed`, `ambiguous`, `manual_review_required`, `reconciling`, `compensation_required`, `compensating`, `compensated`, `failed`, `revoked`, `expired`). The `SideEffectProfile` interface has `mayCommitExternalEffect` and `reversible` flags, but there is no state machine enforcing valid transitions between these statuses. The `side-effect-manager.ts` in five-plane-execution likely manages some of these states but without a centralized state machine.

**Severity:** Medium  

**Recommended fix:** Implement a `SideEffectStateMachine` (similar to `ExecutionStateMachine`) that enforces valid `SideEffectStatus` transitions, or document which subset of transitions are actually enforced.

---

### Issue 10: createHarnessRun accepts any HarnessRunStatus without state machine validation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/index.ts`  
**Lines:** 71-102, 126  

**Problem:** `createHarnessRun()` accepts `status?: HarnessRunStatus` as input and defaults to `"created"`, but there is no validation that the provided status is a valid transition from any previous status. The `HarnessRunStatus` state machine (contract-models.ts lines 264-278) defines transitions from `created → admitted → planning → ready → running → pausing → paused → resuming → replanning → compensating → completed/failed/cancelled/aborted`, but `createHarnessRun` does not enforce this.

**Severity:** Medium  

**Recommended fix:** Add state machine validation in `createHarnessRun()`, or document that status transition enforcement happens in a separate service.

---

### Issue 11: NodeRun has terminal statuses but no coordinated terminal transition service

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts`  
**Lines:** 430-454, 446-454  

**Problem:** `NODE_RUN_TERMINAL_STATUSES` defines 7 terminal states (`succeeded`, `failed`, `skipped`, `cancelled`, `dependency_failed`, `policy_blocked`, `aborted`). There is a `TaskTerminalTransitionService` that coordinates terminal transitions for task, workflow, session, and execution, but no equivalent `NodeRunTerminalTransitionService` for `NodeRun` entities. This creates an inconsistency where multi-entity terminal coordination omits `NodeRun`.

**Severity:** Medium  

**Recommended fix:** Either add a `NodeRunTerminalTransitionService` to coordinate `NodeRun` terminal states with other entities, or document why `NodeRun` terminal transitions are handled independently.

---

### Issue 12: Inter-plane TTL check doesn't account for clock skew

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/inter-plane-contract-gateway.ts`  
**Lines:** 306-313  

**Problem:** TTL check computes `now - envelopeTime > envelope.ttl`. If the envelope timestamp is in the future due to clock skew between planes, this check could incorrectly reject valid envelopes. If `envelope.ttl` is `null`, the check is skipped. The contracts define TTL semantics but execution doesn't handle clock skew gracefully.

**Severity:** Low  

**Recommended fix:** Add a check for clock skew: reject if `envelopeTime > now + acceptable_drift_ms`.

---

### Issue 13: Workflow status "cancelling" not properly handled in terminal transition mapping

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/state-transition/transition-service-model.ts`  
**Lines:** 22-31, 443  

**Problem:** `WORKFLOW_TRANSITIONS` defines `cancelling: ["cancelled"]` which is correct. However, at line 443 in transition-service.ts, the terminal mapping is:
```typescript
const workflowTerminal: WorkflowStatus = input.terminalStatus === "done" ? "completed" : input.terminalStatus;
```
This maps non-"done" terminal statuses directly. But `cancelled` as a `terminalStatus` on the task would map to `workflowTerminal = "cancelled"`, which is correct. However, if a task transitions to `failed`, the workflow would get `workflowTerminal = "failed"`, which is correct. The issue is that `cancelling` is a valid intermediate state (WORKFLOW_TRANSITIONS line 29: `cancelling: ["cancelled"]`), but there is no code path that transitions workflow to `cancelling` - only to `paused`, `completed`, `failed`, `cancelling`, or `cancelled`. The `TaskTerminalTransitionService` never transitions a workflow to `cancelling`.

**Severity:** Low  

**Recommended fix:** Verify that workflows can properly reach `cancelling` state when requested, or document that `cancelling` is a state that requires explicit workflow-level cancellation (not just task terminal transition).

---

### Issue 14: Inter-plane routing relies on unsigned metadata for security decisions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/inter-plane-contract-gateway.ts`  
**Lines:** 343-351  

**Problem:** The inter-plane gateway extracts `sourcePlane` and `targetPlane` from `envelope.metadata` for routing. Since metadata is not signed (see Issue 3), a malicious actor could modify metadata after signing to redirect envelopes to unintended planes. This is a cross-module security issue where contracts define the envelope structure but execution layer's inter-plane gateway trusts unsigned metadata.

**Severity:** High  

**Recommended fix:** Either include metadata in the envelope signature, or use a separate signing mechanism for routing metadata.

---

### Issue 15: ArtifactStore creation uses hardcoded sandbox policy path without validation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`  
**Lines:** 136-139  

**Problem:** `ArtifactStore` is created with `createWorkspaceWritePolicy(dirname(input.dbPath))`. The `createWorkspaceWritePolicy` call could fail or produce an overly permissive policy if the path is invalid, but the error would only surface later during artifact writes rather than at initialization. The contracts define `ArtifactRef` with security-relevant fields but the execution layer doesn't validate the policy at creation time.

**Severity:** Low  

**Recommended fix:** Validate the sandbox policy after creation to fail fast if misconfigured:
```typescript
if (!sandboxPolicy.allowsRead || !sandboxPolicy.allowsWrite) {
  throw new ValidationError("artifact.sandbox_policy_invalid", "...");
}
```

---

### Issue 16: SideEffectRecord deadline semantics not enforced in execution

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/side-effect-manager.ts`  
**Lines:** 560-577  

**Problem:** `SideEffectRecord.deadline` field is defined in contracts ("must commit before this time per §14.11") but the execution layer doesn't appear to enforce deadline checking before committing side effects. If a side effect is committed after its deadline, the contract semantics are violated but no error is raised.

**Severity:** Medium  

**Recommended fix:** Add deadline enforcement in `side-effect-manager.ts` before committing:
```typescript
if (new Date(sideEffect.deadline) < Date.now()) {
  throw new Error(`side_effect.deadline_exceeded:${sideEffect.sideEffectId}`);
}
```

---

### Issue 17: Contract defines DependencyType but dependency enforcement not visible in execution

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts`  
**Line:** 323  

**Problem:** `DependencyType` is defined as `"hard" | "soft" | "compensation" | "retry" | "replan"` in contracts. `PlanEdge` (line 337-343) includes `dependencyType`. However, the execution engine in `multi-step-supervisor.ts` doesn't appear to enforce dependency types when determining step execution order - it uses `step.dependsOnStepIds` but doesn't distinguish between hard/soft/compensation dependencies. If a "soft" dependency fails, the execution might incorrectly proceed or fail inappropriately.

**Severity:** Medium  

**Recommended fix:** Ensure the execution engine respects `DependencyType` semantics, particularly distinguishing hard (blocking) from soft (non-blocking) dependencies, or document which dependency types are actually enforced.

---

### Issue 18: Missing ADR for inter-plane contract routing security model

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/inter-plane-contract-gateway.ts`  
**Lines:** 1-50  

**Problem:** Several architectural decisions are made in code without ADR documentation:
1. The decision to exclude metadata from envelope signatures (noted in contract-envelope.ts but no ADR)
2. The inter-plane routing security model and failure handling
3. The lack of clock skew handling in TTL checks
4. The relationship between `HarnessRun` canonical tracking and `ExecutionRecord`

**Severity:** Medium  

**Recommended fix:** Create ADRs documenting:
1. The inter-plane contract gateway routing model and security assumptions
2. The HarnessRun canonical execution tracking pattern (R4-26/R4-27)
3. Budget event sourcing requirements for the five-plane-state-evidence module

---

## Cross-Review: contracts ↔ execution

### ADR Gaps Identified

1. **No ADR for inter-plane routing security model** - The decision to exclude metadata from envelope signatures, clock skew handling requirements, and plane-to-plane trust assumptions are not documented
2. **No ADR for HarnessRun canonical execution tracking** - R4-26/R4-27 patterns for HarnessRun creation and lifecycle are implemented without architectural documentation
3. **No ADR for BudgetLedger event sourcing** - The requirement for `BudgetAllocator` to emit events to `RuntimeTruthRepository` is not documented
4. **No ADR for NodeRun vs ExecutionRecord relationship** - The distinction between `NodeRun` (contract concept) and `ExecutionRecord` (execution concept) and their coordination is unclear

### Cross-Module Consistency Issues

1. **HarnessRunStatus state machine** exists in contracts (`contract-models.ts` lines 264-278) but is NOT enforced in execution layer - no `HarnessRunTransitionService` exists
2. **NodeRunStatus state machine** exists in contracts but is NOT used in execution - `ExecutionRecord` uses `ExecutionStatus` instead
3. **BudgetLedger status schema** missing `settling`, `reserving`, `releasing` states that contracts allow
4. **Inter-plane routing** relies on unsigned metadata for security decisions - `sourcePlane`/`targetPlane` can be modified after signing
5. **BudgetAllocator bypasses event emission** - Raw SQL updates without events to `RuntimeTruthRepository`, breaking event-sourced consistency
6. **SideEffectRecord deadline** semantics defined in contracts but not enforced in execution layer
7. **DependencyType** semantics defined in contracts but not visibly enforced in `multi-step-supervisor.ts`

### Summary Table

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 8     |
| Medium   | 7     |
| Low      | 3     |
| **Total**| 18    |

**ADR Gaps:** 4 identified

### Most Impactful Issues

1. **HarnessRunStatus state machine not enforced** (High) - `HarnessRun` stays in `"created"` status throughout execution lifecycle despite contract defining a 13-state machine
2. **Inter-plane metadata not integrity-protected** (High) - Security issue where `sourcePlane`/`targetPlane` can be modified after signing
3. **BudgetAllocator bypasses event emission** (High) - Event-sourced consistency violation between execution and state-evidence layers
4. **NodeRunStatus state machine not integrated** (High) - `ExecutionRecord` uses `ExecutionStatus` instead of the contract's `NodeRunStatus`
5. **BudgetLedgerSchema missing status values** (High) - Data integrity issue where settling/reserving/releasing states are not in schema

---

## Cross-Review: sdk ↔ platform contracts

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/` — API client, envelope wrapping, version handshake
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/harness-sdk/` — Harness SDK, PlanGraph, inter-plane transport
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/` — ContractEnvelope, PrincipalRef, RequestEnvelope canonical definitions
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/request-envelope/` — Legacy RequestEnvelope (deprecated path)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/` — PromptBundle contract

---

### Cross-Module Issue 1: ContractEnvelope principal Augmentation Conflicts With Canonical Definition

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 964–972)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-envelope.ts` (lines 6–17)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (lines 71–109)

**Problem:** `api-client.ts` declares a module augmentation at lines 964–972 that adds an optional `principal` field to `ContractEnvelope<TPayload>`:

```typescript
declare module "../../platform/contracts/executable-contracts/index.js" {
  interface ContractEnvelope<TPayload = unknown> {
    readonly principal?: {
      readonly subject?: string;
      readonly tenantId?: string;
      readonly roles?: readonly string[];
    };
  }
}
```

However, the canonical `ContractEnvelope` interface (`contract-envelope.ts` lines 6–17) defines no `principal` field. The augmentation adds a principal shape that is structurally incompatible with `PrincipalRef` from `contract-models.ts` (lines 71–109), which requires `{ principalId: string, type: PrincipalType, tenantId: string, roles: readonly string[], ... }`. The augmentation's principal uses `subject`/`tenantId`/`roles` but no `principalId` or `type` — it is a partial projection, not a proper PrincipalRef.

The `wrapRequestBody()` method at line 388 applies this augmentation by spreading `principal` onto the envelope (lines 416–423), producing an envelope that TypeScript accepts but that violates the canonical `ContractEnvelope` contract. The canonical contract is enforced at the inter-plane gateway layer, which will reject or misinterpret this field.

**Severity:** high

**Recommended fix:** Remove the module augmentation. Encode principal information in `metadata` fields (e.g., `principalSubject`, `principalTenantId`, `principalRoles`) rather than adding a top-level `principal` field. Alternatively, use the proper `PrincipalRef` type from contract-models.ts if a principal must be carried in the envelope.

---

### Cross-Module Issue 2: API Client Schema Version Hardcoded as "v4.3" but Canonical is "v4.3"

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (line 407)

**Problem:** `wrapRequestBody()` hardcodes `schemaVersion: "v4.3"` when creating a ContractEnvelope:

```typescript
const envelope = createExecutableContractEnvelope({
  payload,
  schemaVersion: "v4.3",
  ttl: 30000,
  metadata,
  ...
});
```

The canonical `CONTRACT_SCHEMA_VERSION` in `contract-models.ts` (line 654) is also `"v4.3"`, so these match. However, the SDK has no mechanism to detect when the platform contract version advances. The `VersionHandshakeResult` type (api-client-types.ts lines 50–59) includes `contractVersion?: string` received from the server, but the SDK never uses this field to update the hardcoded value. If the platform introduces contract version v4.4, the SDK will continue sending v4.3 indefinitely.

**Severity:** medium

**Recommended fix:** After a successful version handshake, update `this.config.contractVersion` with the server-returned `contractVersion`. Use `this.config.contractVersion` in `wrapRequestBody()` when creating envelopes. If no handshake was performed, fall back to `CONTRACT_SCHEMA_VERSION` from the platform contracts module.

---

### Cross-Module Issue 3: HarnessSdk Inter-Plane Envelope Metadata Not Integrity-Protected

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/harness-sdk/index.ts` (lines 839–859)

**Problem:** `createSignedInterPlaneEnvelope()` creates a ContractEnvelope and signs it via `signContractEnvelope()`, but the signature input (computed in `signContractEnvelope` at `contract-envelope.ts` line 102) covers only `schemaVersion:commandId:correlationId:timestamp:payload`. The `metadata` field (which carries `targetPlane`, `command`, `sourcePlane` in the Harness SDK's usage at lines 847–850) is NOT included in the signature input.

The inter-plane gateway relies on metadata for routing decisions (e.g., extracting `sourcePlane`/`targetPlane`). Since metadata is unsigned, a man-in-the-middle could modify routing metadata after signing and the signature would still appear valid.

**Severity:** high

**Recommended fix:** Include a metadata hash in the signature input. For example, compute `metadataHash = SHA256(JSON.stringify(metadata))` and append it to the signature input string: `${schemaVersion}:${commandId}:${correlationId}:${timestamp}:${payload}:${metadataHash}`. Alternatively, document clearly that metadata is not integrity-protected and that routing decisions should not rely solely on unsigned metadata.

---

### Cross-Module Issue 4: HarnessSdk AppendStepreceiptKind Not Validated Against NodeAttemptReceipt Contract

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/harness-sdk/index.ts` (line 509)

**Problem:** In `appendStepWithReceipt()` at line 509:

```typescript
receiptKind: input.receiptKind ?? "tool",
```

The default `"tool"` is used when `receiptKind` is not provided, but `"tool"` is not a valid `NodeAttemptReceipt["receiptKind"]` value. The valid values from the contract are `"llm" | "tool" | "evaluator" | "hitl_wait" | "subgraph" | "router" | "compensation"` — `"tool"` is indeed listed, so this is valid. The issue is that the Harnesse SDK does not validate that `receiptKind` is one of the allowed string literals. If an invalid value is passed, it flows through to `createNodeAttemptReceipt()` without checking.

**Severity:** low

**Recommended fix:** Add a validation step that ensures `receiptKind` matches one of the known `NodeAttemptKind` values from the contract before passing it to `createNodeAttemptReceipt()`.

---

### Cross-Module Issue 5: RequestEnvelope Legacy Contract Missing ADR-021 Routing Fields

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/request-envelope/index.ts` (lines 32–36)

**Problem:** The legacy `RequestEnvelope` (deprecated at line 6–12) has a comment at line 32:
```
// R24-58 FIX: ADR-021 requires 4/8 mandatory fields for inter-plane routing.
// Missing fields: principal (already present), source_plane, target_plane, directives.
```

This indicates that `sourcePlane`, `targetPlane`, and `directives` are marked as required by ADR-021 but are defined as optional (lines 34–36) with `?` suffixes. The comment says "Missing fields: principal (already present)" but `sourcePlane`, `targetPlane`, and `directives` are not mandatory — they are optional. This creates an inconsistency between the ADR requirement and the type definition.

**Severity:** medium

**Recommended fix:** Clarify in the ADR-021 whether these fields are mandatory for inter-plane routing. If they are mandatory, remove the `?` and enforce them in `createRequestEnvelope()`. If they are optional, remove the "Missing fields" comment and update the ADR to reflect that routing can proceed without them.

---

### Cross-Module Issue 6: Harness SDK Run State Type Conflicts With Canonical HarnessRun

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/harness/runtime-types.ts` (lines 168–219)

**Problem:** `HarnessRunRuntimeState` (line 168) and the canonical `HarnessRun` (contract-models.ts line 282) have structural conflicts:

1. `HarnessRunRuntimeState` has `runId: string` (line 170) which is not in canonical `HarnessRun`.
2. `HarnessRunRuntimeState` has `taskId: string` (line 187) which is not in canonical `HarnessRun`.
3. `HarnessRunRuntimeState` has `constraintPack: ConstraintPack` (line 189) but canonical `HarnessRun` has `constraintPackRef: string`.
4. `HarnessRunRuntimeState` has `planGraphBundle: PlanGraphBundle` (line 190) but canonical `HarnessRun` has `planGraphBundleId?: string`.
5. `HarnessRunRuntimeState` has `steps: readonly HarnessStep[]` (line 191) which is not in canonical `HarnessRun`.
6. `HarnessRunRuntimeState` has `nodeRunIds: readonly string[]` (line 192) which is not in canonical `HarnessRun`.

The `toCanonicalHarnessRun()` function at line 221 attempts to bridge these, but it does so via type casting (`as CanonicalHarnessRun`) with a partial type annotation that hides the incompatibility. The returned object has extra fields (`runId`, `taskId`, `steps`, `nodeRunIds`) that are not in `HarnessRun` and will be silently dropped or cause runtime issues if the object is used where a strict `HarnessRun` is expected.

**Severity:** high

**Recommended fix:** Either:
1. Make `HarnessRunRuntimeState` extend `HarnessRun` (add only the extra runtime fields to a subtype), or
2. Ensure `toCanonicalHarnessRun()` creates a properly shaped `HarnessRun` by explicitly excluding runtime-only fields before returning.

---

### Cross-Module Issue 7: PromptBundle Version Normalization Incompatibility With Contract Version Semantics

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 324–353)

**Problem:** `normalizeVersion()` at line 324 converts semver strings to integers via the formula `major * 100 + minor * 10 + patch` (line 338) for full semver (`v1.2.3`), and `major * 10` (line 345) for simple version (`v1` or `1`). This produces integer version numbers like `v1.2.3 → 123`, `v2 → 20`.

However, `PromptBundle.version` is defined in the contract as `number` (prompt-bundle/index.ts line 30) with a comment "Incrementing integer version for deterministic ordering". The SDK's `createPromptBundle` accepts `version: number | string` (line 105). If a client passes `"1.0"` or `"1.0.0"` as a string version, `normalizeVersion("1.0")` matches the simple regex at line 341 (`/^v?(\d+)$/`) and returns `10`, while `normalizeVersion("1.0.0")` matches the full regex at line 332 and returns `123`. These represent the same semver but map to drastically different integers — this breaks version comparison for prompt bundles.

**Severity:** high

**Recommended fix:** Ensure the normalization formula is consistent for all semver formats. The current formula treats `v1.0` as equivalent to `v1` (both yield 10), but `v1.0.0` yields 123. Document the version normalization strategy in an ADR and ensure all clients use the same normalization function.

---

### Cross-Module Issue 8: HarnessSdk AppendStep Uses Runtime State Field Not in Canonical

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/harness-sdk/index.ts` (lines 459–472)

**Problem:** In `appendStepWithReceipt()`, the SDK calls `this.runtime.appendStep()` with inputs that include `nodeRunId` and `stage`:

```typescript
const updated = this.runtime.appendStep(mutableRun, {
  role: input.role,
  nodeRunId: input.nodeRunId,
  ...(input.stage !== undefined ? { stage: input.stage } : {}),
  inputs: {
    ...input.inputs,
    nodeRunId: input.nodeRunId,
    planGraphId: input.planGraphId,
  },
  outputs: input.outputs,
  ...(input.iteration !== undefined ? { iteration: input.iteration } : {}),
});
```

The `appendStep()` method signature in `HarnessRuntimeService.appendStep()` expects a `HarnessRunRuntimeState` (not `HarnessRun`), and the runtime uses `nodeRunId` as the primary routing key (per R31-42 comment at line 460). However, `HarnessRunRuntimeState` does not have a `stage` field — stage is derived from `nodeRunId`. Passing `stage` explicitly could override the runtime's default stage derivation behavior, leading to inconsistent step tracking.

**Severity:** medium

**Recommended fix:** Remove the optional `stage` forwarding in `appendStepWithReceipt()` and let the runtime derive stage from `nodeRunId` as designed per R31-42. If explicit stage override is required, document it as a supported feature with its own API.

---

### Cross-Module Issue 9: SDK ContractEnvelope Wrapper Adds Principal That Gateway Rejects

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 416–423)

**Problem:** `wrapRequestBody()` returns a `ContractEnvelope` with a `principal` property that is not defined in the canonical `ContractEnvelope` interface. The canonical interface from `contract-envelope.ts` has no `principal` field. When this envelope is sent to the platform's inter-plane gateway, the gateway will either:
1. Ignore the unknown `principal` field (safe but semantics lost), or
2. Reject the envelope as malformed if strict schema validation is enabled

The `createContractEnvelope` function at line 224 does not accept or handle a `principal` argument — it only accepts `payload`, `metadata`, `ttl`, etc. The augmentation at line 964 adds `principal` to the interface, but `createContractEnvelope` has no way to populate it because the factory function doesn't handle it.

**Severity:** high

**Recommended fix:** Encode principal information in the `metadata` map (e.g., `X-Principal-Subject`, `X-Principal-TenantId`) rather than adding a top-level field. Update `createContractEnvelope` to accept principal as a metadata-normalized field if needed. Remove the module augmentation.

---

### Cross-Module Issue 10: Version Handshake Result Has No Contract Version Propagation to Envelope Creation

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/client-sdk/api-client.ts` (lines 111–113, 482–548)

**Problem:** `VersionHandshakeResult` (api-client-types.ts line 50) includes `contractVersion?: string`. The `fetchVersionCompatibility()` method at line 482 correctly parses and returns `contractVersion` from the response. However, after a successful handshake, this `contractVersion` is stored in the `VersionHandshakeResult` object but never propagated back to `this.config.contractVersion` or used in subsequent envelope creation.

The `wrapRequestBody()` at line 407 always uses hardcoded `"v4.3"` regardless of what the server accepted during handshake. This means a server that only supports `v4.4` would reject SDK requests because the SDK continues sending `v4.3` in every envelope.

**Severity:** medium

**Recommended fix:** After a successful `performVersionHandshake()`, update `this.config.contractVersion` with the returned `contractVersion`. Use this value in `wrapRequestBody()` instead of the hardcoded string. Fall back to `CONTRACT_SCHEMA_VERSION` only when no handshake was performed.

---

### Cross-Module Issue 11: PromptBundle CompatibilityMatrix Not Validated Against Tool/Evaluator Schema Versions

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/prompt-bundle/index.ts` (lines 261–276)

**Problem:** `validateCompatibilityMatrixShape()` at line 261 checks that `toolSchemaVersions`, `evaluatorSchemaVersions`, `domainDescriptorVersions`, and `modelRoutingProfiles` are all arrays, but it does not validate:
1. That `toolName` in `toolSchemaVersions` corresponds to a known tool
2. That `schemaVersion` is a positive integer
3. That `evaluatorName` in `evaluatorSchemaVersions` corresponds to a known evaluator
4. That `domainId` in `domainDescriptorVersions` exists in the domain registry
5. That `modelId` in `modelRoutingProfiles` corresponds to a known model

When the SDK creates a `PromptBundle` and sends it to the platform, the platform has no guarantee that the compatibility matrix entries reference valid entities. A bundle could declare compatibility with non-existent tools or models.

**Severity:** medium

**Recommended fix:** Add validation that checks `toolName`, `evaluatorName`, `domainId`, and `modelId` against their respective registries. If the registry lookups are async or external, add a `validateCompatibilityMatrixReferences()` method that can be called separately. Document the validation requirements in an ADR.

---

### Cross-Module Issue 12: HarnessSdk InterPlaneTransport.send Has Generic TargetPlane String Not Validated

**File:** `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/sdk/harness-sdk/index.ts` (lines 135–140)

**Problem:** `InterPlaneTransport.send()` accepts `targetPlane: string` with no validation that it is a known/allowed plane. The `createSignedInterPlaneEnvelope()` at line 847 uses `targetPlane` as metadata but does not validate the plane identifier format or existence.

If an SDK client sends a message to an unknown target plane, the inter-plane gateway will route it based on the metadata string without validation. Invalid plane identifiers could cause routing failures or security issues if plane authorization is based on the identifier string.

**Severity:** medium

**Recommended fix:** Add a `validTargetPlanes: ReadonlySet<string>` configuration to `HarnessSdkInterPlaneSecurityConfig`. Validate `targetPlane` against this set before creating the envelope. Throw `HarnessSdkError` with code `harness_sdk.invalid_target_plane` if the plane is not in the allowed set.

---

## ADR Gaps Identified

1. **No ADR for ContractEnvelope principal field semantics** — The SDK augmentation adds `principal` to `ContractEnvelope` but this is not in the canonical contract. An ADR should define whether principal belongs in the envelope, in metadata, or in a separate header.

2. **No ADR for inter-plane routing metadata integrity** — ADR-021 requires `sourcePlane`/`targetPlane` but these are in unsigned metadata. An ADR should clarify whether routing metadata must be integrity-protected and whether that protection is via the envelope signature or a separate mechanism.

3. **No ADR for PromptBundle version normalization strategy** — The integer compression formula (`major*100 + minor*10 + patch`) is implemented in code but not documented. An ADR should specify the version format, normalization rules, and how version ordering works across SDK and platform.

4. **No ADR for HarnessRunRuntimeState vs Canonical HarnessRun boundary** — The runtime state has fields that do not exist in the canonical type. An ADR should define the exact boundary between runtime-only state and the canonical representation, including which fields are persisted vs. ephemeral.

5. **No ADR for inter-plane version negotiation fallback** — When version handshake fails (426), the SDK throws but there is no fallback to a minimum compatible version. An ADR should document the version negotiation strategy and what happens when major version mismatch occurs.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 5     |
| Medium   | 6     |
| Low      | 1     |
| **Total**| 12    |

**ADR Gaps:** 5 identified

**Most Impactful Issues:**

1. **ContractEnvelope principal augmentation conflicts with canonical definition (High)** — The SDK adds a `principal` field to `ContractEnvelope` that is not in the canonical contract. The envelope factory (`createContractEnvelope`) does not handle this field, so the augmentation only affects the TypeScript interface — not runtime behavior. The field would be silently dropped or cause type errors at the gateway.

2. **HarnessSdk inter-plane envelope metadata not integrity-protected (High)** — `sourcePlane`/`targetPlane`/`command` in metadata are used for routing decisions but are not included in the HMAC signature. An attacker could modify these after signing and the signature would still validate.

3. **Harness SDK run state type conflicts with canonical HarnessRun (High)** — `HarnessRunRuntimeState` has fields (`runId`, `taskId`, `steps`, `nodeRunIds`) that are not in the canonical `HarnessRun` type. `toCanonicalHarnessRun()` uses type casting that hides these extra fields rather than properly transforming the runtime state into a canonical run.

4. **Version handshake result not propagated to envelope creation (Medium)** — The `contractVersion` returned from handshake is stored but never used — `wrapRequestBody()` always uses the hardcoded `"v4.3"`. This means the SDK cannot adapt to servers running newer contract versions.

5. **PromptBundle version normalization produces inconsistent results (High)** — `normalizeVersion("1.0")` yields `10` (same as `"1"`) while `normalizeVersion("1.0.0")` yields `123`. These represent the same semver but map to vastly different integers, breaking version ordering for prompt bundles.

## Cross-Review: cost ↔ ops-maturity ↔ model-gateway

### Directory Coverage
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/cost-management/` - cost management re-export layer
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/` - cost optimization service
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/provider-registry/` - model routing service
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/` - budget guard
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/shared/observability/` - provider health tracker
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/billing/` - cost estimation service

Key files reviewed:
- `ops-maturity/cost-optimizer/cost-optimization-service.ts` - attribution recording, aggregation, recommendations, simulation
- `ops-maturity/cost-optimizer/attribution-engine/index.ts` - cost aggregation by subject
- `ops-maturity/cost-optimizer/recommendation-engine/index.ts` - downgrade path analysis
- `ops-maturity/cost-optimizer/simulator/index.ts` - cost simulation
- `platform/model-gateway/provider-registry/model-routing-service.ts` - model selection with cost cap handling
- `platform/model-gateway/cost-tracker/budget-guard.ts` - atomic budget state machine
- `platform/shared/observability/provider-health-tracker.ts` - provider health status tracking
- `scale-ecosystem/billing/cost-estimation-service.ts` - historical cost estimation
- `platform/five-plane-control-plane/cost-alert/cost-alert-service.ts` - cost threshold alerting

---

### Cross-Module Issue 1: Cost Tracking and Cost Optimization Have No Integration

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (lines 65-170)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/billing/cost-estimation-service.ts` (lines 61-141)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/execution-engine/model-call-provider.ts` (lines 57-330)

**Problem:** `CostOptimizationService.recordCost()` stores `CostAttributionRecord[]` in-memory only (line 66: `private readonly records: CostAttributionRecord[] = []`). `CostEstimationService` queries a SQL database (`cost_events` table) for historical averages. `ModelCallProvider` uses `BudgetGuard.atomicReserve()` which creates in-memory `AtomicBudgetSession` objects. These three cost tracking mechanisms are completely decoupled:

1. `CostOptimizationService` aggregates in-memory records for dashboard/recommendations but never persists
2. `CostEstimationService` reads from `cost_events` SQL table but has no write path from execution
3. `BudgetGuard` manages real-time reservation/execution/settle in memory only

If `ModelCallProvider` calls `atomicSettle()` with actual token counts, those settled costs are not written to the `cost_events` table. `CostEstimationService` therefore uses stale/no data while `CostOptimizationService` has no visibility into actual execution costs.

**Severity:** high

**Recommended fix:** Add a write-through path from `BudgetGuard.atomicSettle()` to record actual costs in `cost_events` table, or add a cost event emission that `CostEstimationService` can consume. Alternatively, document that `CostOptimizationService` is for simulation/dashboard only and `CostEstimationService` is for pre-execution estimation only, with no闭环 feedback.

---

### Cross-Module Issue 2: Model Routing `maxInputPer1kUsd` and Budget Guard `maxTaskCostUsd` Use Incompatible Units

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/provider-registry/model-routing-service.ts` (lines 143-150, 657-659, 708-727)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 31-53, 567-592, 594-675)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/recommendation-engine/index.ts` (lines 33-37)

**Problem:** `ModelRoutingService.resolveMaxInputPer1kUsd()` returns `maxInputPer1kUsd` in units of "USD per 1k input tokens" (line 143-150). `BudgetGuard.evaluateTaskSpend()` uses `maxTaskCostUsd` which is a flat task-level USD limit (line 567-592). The recommendation engine at line 33-37 compares `inputPer1kUsd + outputPer1kUsd` sums against `currentCostUsd` but `currentCostUsd` is a total accumulated cost, not a per-token rate.

These three units are incompatible:
- `maxInputPer1kUsd`: per-1k-token price, applied at request time to filter profiles
- `maxTaskCostUsd`: flat task budget cap, enforced at execution time
- `estimatedSavingsUsd`: derived from `currentCostUsd * 0.22` without normalization to token counts

A profile with `inputPer1kUsd: 0.01` would be allowed by routing if `maxInputPer1kUsd >= 0.01`, but if the task processes 1M tokens, the actual cost ($10) could exceed `maxTaskCostUsd: 1` set in `BudgetGuard`. Routing and budget enforcement use different normalization bases and no cross-module validation exists.

**Severity:** high

**Recommended fix:** Ensure `ModelRoutingService` and `BudgetGuard` share a common cost normalization layer. One approach: `ModelRoutingService` should call `BudgetGuard.evaluateCost()` before returning a routing decision with `cost_cap_fallback`, passing the estimated token count to get a proper budget feasibility check. Alternatively, document that routing is cost-at-selection-time only and Budget Guard enforces at execution-time with independent limits.

---

### Cross-Module Issue 3: Provider Health Tracker Thresholds Are Hardcoded and Not Aligned with Model Routing Fallback Triggers

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/shared/observability/provider-health-tracker.ts` (lines 48-52)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/provider-registry/model-routing-service.ts` (lines 334-339, 597, 752-761)

**Problem:** `ProviderHealthTracker` uses hardcoded thresholds:
- `degradedThreshold ??= 0.8` (80% success rate = degraded)
- `failedThreshold ??= 0.5` (50% success rate = failed)

`ModelRoutingService` has three fallback reasons:
- `provider_health_fallback` - triggered when `normalHealthProfiles.length === 0` or `chosen.providerStatus === "degraded"` (lines 752-761)
- `cost_cap_fallback` - triggered by cost filtering (lines 712-725)
- `tier_fallback` - triggered when no candidate found for target tier (lines 736-738)

The issue: `providerStatus` in `ModelRoutingService` comes from `this.providerHealth[profile.provider]?.status ?? "unknown"` (line 491). The health tracker only marks a provider as "degraded" when success rate drops below 80%. But `ModelRoutingService` also treats "unknown" health as "healthy" implicitly by including `eligibleProfiles` with unknown status in the candidate pool (line 492: `providerStatus: this.providerHealth[profile.provider]?.status ?? "unknown"` - unknown status passes the `normalHealthProfiles` filter at line 597 which only excludes "failed").

Additionally, the 80%/50% thresholds in the health tracker have no documented relationship to the routing fallback triggers. No ADR explains what success rate triggers `provider_health_fallback` vs accepting a degraded provider as a fallback candidate.

**Severity:** medium

**Recommended fix:** 
1. Add configuration options to `ModelRoutingServiceOptions` for `providerHealthThresholdDegraded` and `providerHealthThresholdFailed` so routing can align with health tracker
2. Document in ADR the relationship between health tracker thresholds and routing fallback behavior
3. Consider having `ModelRoutingService` require explicit health status rather than defaulting to "unknown" = healthy

---

### Cross-Module Issue 4: Cost Optimization `riskLevelForSubject()` Uses Undefined `costType: "model"`

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (lines 143-152)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (line 29)

**Problem:** `riskLevelForSubject()` at line 148 checks `item.costType === "llm" || item.costType === "model"`. The `CostAttributionRecord` type at line 29 defines `costType` as:
```
"llm" | "tool" | "compute" | "storage" | "egress" | "humanReview" | "total" | "model" | "runtime"
```

But the `CostSubjectType` union at line 22 does NOT include `"model"`:
```
"task" | "workflow" | "agent" | "model" | "domain" | "run"
```

This means `"model"` is a valid `costType` but not a valid `CostSubjectType`. `riskLevelForSubject()` at line 148 treats `"model"` cost type as requiring elevated risk, but the type system suggests `"model"` was intended as a `subjectType` (which tier of the system), not a `costType` (what kind of cost). The inconsistency suggests a bug where `costType: "model"` records would not be correctly attributed to subjects since `subjectType` and `costType` are being confused.

**Severity:** medium

**Recommended fix:** Clarify the type taxonomy: `CostSubjectType` at line 22 includes `"model"` but `CostAttributionRecord.costType` at line 29 also includes `"model"`. If `"model"` in `costType` means "cost attributed to a model", it should be removed from `CostSubjectType` or a separate type introduced. Add validation in `recordCost()` that `subjectType` and `costType` are semantically consistent.

---

### Cross-Module Issue 5: Budget Guard Cascade Evaluation Uses `maxTaskCostUsd` as Remaining Budget but `maxPackCostUsd` / `maxPlatformCostUsd` Have Independent Limits

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 637-648)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 606-627)

**Problem:** `remainingBudgetUsd` at lines 637-648 is computed as the MIN of all limits minus projected costs:
```typescript
remainingBudgetUsd: Math.max(0, Math.min(
  input.policy.maxTaskCostUsd - projectedTask,
  input.policy.maxPackCostUsd - projectedPack,
  input.policy.maxPlatformCostUsd - projectedPlatform,
  ...
))
```

If `maxPackCostUsd` is $50 and `maxTaskCostUsd` is $100, but `currentPackCostUsd` is already $45, then `remainingBudgetUsd` = min(100-55, 50-45, ...) = min(45, 5, ...) = $5. This correctly reflects the most restrictive limit.

However, `warningScopes` at lines 629-636 uses a separate check: `check.projected >= check.limit * warnAtRatio`. This could flag "task" as a warning even when the remaining budget is dominated by pack-level constraints. The two checks (remaining calculation vs warning threshold) can give contradictory signals - a task might be flagged as "approaching limit" on task-level when the real constraint is pack-level.

**Severity:** medium

**Recommended fix:** Add `violatedScope` and `warningScopes` to the `remainingBudgetUsd` calculation to ensure the most restrictive scope is clearly identified. Consider returning which scope is the binding constraint in the result so the caller can prioritize correctly.

---

### Cross-Module Issue 6: Cost Alert Service and Budget Guard Have Overlapping Responsibilities but No Shared State

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/cost-alert/cost-alert-service.ts` (lines 56-121)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 259-488)

**Problem:** `CostAlertService` has its own `accumulators: Map<string, CostAccumulator>` (line 56) tracking per-scope spend. `BudgetGuard` has `atomicSessions: Map<string, AtomicBudgetSession>` (line 262) tracking per-session reservation/execution state. Neither shares state with the other.

When `BudgetGuard.atomicSettle()` settles a session with actual cost, no event is emitted to `CostAlertService` to update its accumulators. When `CostAlertService.evaluateCost()` is called, it has no visibility into the pending/active budget sessions from `BudgetGuard`.

This means:
1. Two independent cost tracking systems run in parallel with no reconciliation
2. Alerts from `CostAlertService` could fire even when `BudgetGuard` has reserved budget sufficient to cover the cost
3. Budget reservations in `BudgetGuard` could be exceeded without `CostAlertService` catching it if the alert threshold was crossed by an earlier accumulator update

**Severity:** high

**Recommended fix:** Have `BudgetGuard` emit a `budget.settled` event (using `LocalTypedEventEmitter`) after `atomicSettle()` completes, so `CostAlertService` can listen and update its accumulators. Alternatively, make `BudgetGuard` an optional caller to `CostAlertService.recordCost()` after settlement.

---

### Cross-Module Issue 7: Cost Optimization Recommendation `estimatedSavingsUsd` Uses Flat 22%/15% Multipliers Without Cost Basis Normalization

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/recommendation-engine/index.ts` (lines 25-49)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/attribution-engine/index.ts` (lines 12-27)

**Problem:** `buildCostOptimizationRecommendation()` (recommendation-engine/index.ts line 38) computes:
```typescript
const estimatedSavingsUsd = Number((currentCostUsd * (downgradePath ? 0.22 : 0.15)).toFixed(2));
```

This assumes all subjects have homogeneous cost structures where a 22% or 15% reduction is achievable. But `currentCostUsd` comes from `aggregateCostAttribution()` which sums `amountUsd` directly without normalizing for:
- Token volume differences across subjects
- Provider price differences across equivalent tasks
- Task complexity differences (simple vs multi-step)

A subject with `currentCostUsd: 200` and a downgrade recommendation gets `estimatedSavingsUsd: 44` (22%). But if that $200 was for 10M tokens at $20/k and the cheaper model still costs $18/k, the actual savings would be ~$4, not $44.

**Severity:** medium

**Recommended fix:** Compute `estimatedSavingsUsd` based on actual token counts and price differentials between current and recommended profiles, not flat multipliers. Use the pricing data from `ModelMetadataRegistry` profiles to compute realistic savings.

---

### Cross-Module Issue 8: Provider Health Tracker Uses Sliding Window but Model Routing Only Uses Snapshot Status

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/shared/observability/provider-health-tracker.ts` (lines 62-94)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/provider-registry/model-routing-service.ts` (lines 386-392, 491-499)

**Problem:** `ProviderHealthTracker.getSummary()` (lines 62-94) computes status based on a sliding window (`windowMs` parameter, default 5 minutes). The summary includes `successRate`, `totalCalls`, `failedCalls`, `fallbackCount`, `latestFailureCodes` - all time-window dependent.

However, `ModelRoutingService` receives `providerHealth: Record<string, ProviderHealthSummary>` (line 386) and only uses `.status` (line 491: `providerStatus: this.providerHealth[profile.provider]?.status ?? "unknown"`). It discards `successRate`, `totalCalls`, `latestFailureCodes` which could inform smarter routing decisions.

A provider at "degraded" status with 95% success rate (just below 0.8 threshold) is treated the same as one with 51% success rate. A provider with `fallbackCount: 50` vs one with `fallbackCount: 2` would be treated identically despite very different reliability profiles.

**Severity:** medium

**Recommended fix:** Extend `ModelRoutingService` to use additional health summary fields beyond just `status`. Consider:
- Using `successRate` as a secondary sort key within tier when selecting among candidates
- Using `fallbackCount` to weight against providers with high fallback history
- Adding a `totalCalls` threshold below which "degraded" should be treated more leniently (small sample size)

---

### Cross-Module Issue 9: Budget Guard `reserveExecutionChainBudget()` and `atomicReserve()` Use Different Reservation Patterns

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 269-324, 677-719)

**Problem:** `BudgetGuard` exposes two reserve pathways:
1. `atomicReserve()` (lines 273-324) - creates in-memory `AtomicBudgetSession`, returns immediately
2. `reserveExecutionChainBudget()` (lines 677-719) - calls `this.allocator.reserve()` which may be synchronous or async (line 786: `if (settled instanceof Promise)`)

`ModelCallProvider` at line 146 calls `atomicReserve()` directly. But if `reserveExecutionChainBudget()` is also called elsewhere, the two paths interact with the same `allocator` without coordination. Additionally, `atomicReserve()` does not accept a `ledger` parameter (line 273: `input: BudgetReservationRequest`) while `reserveExecutionChainBudget()` does (line 682: `ledger: input.ledger ?? createBudgetLedger(...)`).

The inconsistency means reservations created via `atomicReserve()` cannot benefit from existing ledger state, potentially causing double-reservation on the same ledger.

**Severity:** medium

**Recommended fix:** Unify the reservation paths so `atomicReserve()` also accepts an optional `ledger` and uses `BudgetAllocator.reserve()` consistently. Ensure both paths go through the same ledger state management.

---

### Cross-Module Issue 10: Cost Optimization Service `unsourcedRecordCount` Can Go Negative

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (lines 69-79)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (line 67)

**Problem:** `recordCost()` at line 74-76 decrements `unsourcedRecordCount`:
```typescript
if (this.unsourcedRecordCount > 0) {
  this.unsourcedRecordCount -= 1;
}
```

But `recordCost()` at line 70-73 throws if `decisionRef.trim().length === 0` AFTER the decrement check. If `unsourcedRecordCount` is 0 and an invalid record is passed, the decrement is skipped (via the guard), but if two valid records arrive after an invalid one, the decrement happens without a prior increment. More importantly, the guard `if (this.unsourcedRecordCount > 0)` prevents negative values but the counting logic is unclear - when does `unsourcedRecordCount` get incremented? Only when a valid record arrives with a non-empty `decisionRef`, but an invalid record throws without incrementing.

If `unsourcedRecordCount` starts at 0 and an invalid record arrives, it throws (line 72). If a valid record arrives next, it does NOT increment `unsourcedRecordCount` - only decrements when `unsourcedRecordCount > 0`. This means the counter can only go negative if logic elsewhere increments it, but there is no increment anywhere in the code.

**Severity:** low

**Recommended fix:** Clarify the semantics of `unsourcedRecordCount`. If it tracks records with empty `decisionRef` that were thrown away, it should be incremented when an invalid record is discarded, not decremented when a valid record arrives. The current design suggests it tracks "records that passed validation" vs "records that failed validation" but the counter only decrements, never increments.

---

### Cross-Module Issue 11: Model Routing `cost_cap_fallback` Fallback Lease Issued But CostCap Not Communicated to Budget Guard

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/provider-registry/model-routing-service.ts` (lines 764-777)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 269-324, 567-592)

**Problem:** When `route()` determines that the cost cap filtered out some profiles (lines 712-725), it sets `routeReason = "cost_cap_fallback"` (line 718) and may issue a `turnScopedFallbackLease` (lines 764-777) with `reason: "cost_cap_fallback"`.

However, `BudgetGuard.atomicReserve()` does not receive any indication that a cost cap fallback was triggered. The `BudgetGuard` evaluates cost based on `input.spend.nextEstimatedCostUsd` only (line 278: `input.spend.nextEstimatedCostUsd`). If the routing fallback selected a more expensive profile due to cost cap filtering, the budget reservation may not reflect the actual selected profile's cost.

The fallback lease tells the runtime "use this fallback profile for this turn" but Budget Guard is not party to that decision and cannot adjust its reservation accordingly.

**Severity:** high

**Recommended fix:** When `ModelRoutingService` issues a `cost_cap_fallback` lease, it should emit an event or provide metadata that `BudgetGuard` can consume to adjust the reservation estimate. Alternatively, the routing decision should return a `costEstimate` field that the caller passes to `BudgetGuard` to ensure budget alignment.

---

### Cross-Module Issue 12: No ADR for Cost Tracking Hierarchy (BudgetLedger Tier vs Platform/Pack/Step Budget Policy)

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/contract-models.ts` (lines 504-545)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/cost-tracker/budget-guard.ts` (lines 31-53, 606-648)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (lines 81-97)

**Problem:** `BudgetLedger` has a `tier` field: `"platform" | "tenant" | "pack" | "step"` (contract-models.ts). `BudgetGuard` has `maxPlatformCostUsd`, `maxPackCostUsd`, `maxStepCostUsd` (budget-guard.ts lines 33-37). `CostOptimizationService.aggregate()` groups by `subjectId` (lines 81-97) but does not respect tier hierarchy.

No ADR documents:
1. How `BudgetLedger.tier` relates to `BudgetPolicy.maxPlatformCostUsd` etc.
2. Whether a `pack` tier ledger should be constrained by `maxPackCostUsd` in the policy
3. How cost attribution across tiers (e.g., platform costs attributed to a pack subject) should be handled
4. Whether `CostOptimizationService` should aggregate by tier in addition to subjectId

**Severity:** medium

**Recommended fix:** Create ADR documenting the budget hierarchy and tier semantics. Specify how ledger tier and policy limits interact, and how cost attribution should flow across tier boundaries.

---

### Cross-Module Issue 13: CostEstimationService Uses Division-Avg but CostOptimizationService Ignores Division Context

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/billing/cost-estimation-service.ts` (lines 79-101)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/cost-optimizer/cost-optimization-service.ts` (lines 81-97, 99-110)

**Problem:** `CostEstimationService.estimate()` (line 79) takes an optional `divisionId` parameter and returns `basedOn: "division_avg" | "global_avg" | "default"` to indicate which aggregation was used. The returned `CostEstimate` includes `divisionId: string | null`.

`CostOptimizationService.aggregate()` (lines 81-97) and `buildRecommendations()` (lines 99-110) do NOT take a `divisionId` parameter. They aggregate all records globally without division scoping. This means:
1. A division with high actual costs but small sample count gets a low-confidence estimate (via `CostEstimationService`)
2. The same division's actual accumulated costs (tracked by `CostOptimizationService`) are aggregated into a global pool that includes other divisions
3. Recommendations for the division use global averages rather than division-specific patterns

**Severity:** medium

**Recommended fix:** Add `divisionId` parameter to `CostOptimizationService.aggregate()` and `buildRecommendations()` so recommendations can be scoped to division-specific patterns. Alternatively, document that `CostEstimationService` is for pre-execution planning only and `CostOptimizationService` operates on actual execution costs without division context.

---

### Cross-Module Issue 14: ProviderHealthTracker `recordAttempt()` Returns Input But Doesn't Persist or Emit

**Files:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/shared/observability/provider-health-tracker.ts` (lines 54-60)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/model-gateway/provider-registry/model-routing-service.ts` (lines 386-392)

**Problem:** `ProviderHealthTracker.recordAttempt()` adds to an in-memory array and returns the record. There is no persistence path and no event emission. If the process restarts, all health history is lost. Additionally, `ModelRoutingService` constructs `ProviderHealthTracker` internally (line 391: `this.providerHealth = options.providerHealth ?? {}`) but the health tracker has no mechanism to be populated from an external source - it only accumulates from its own `recordAttempt()` calls.

In a multi-region deployment, each region's `ModelRoutingService` would have its own `ProviderHealthTracker` with isolated health state. Failover decisions based on provider health would use local state only, not synchronized health data from other regions.

**Severity:** high

**Recommended fix:** Add an optional event emitter to `ProviderHealthTracker` so health events can be forwarded to a central observability system. Alternatively, add a `syncHealthFromExternal()` method that allows external health summaries to update the local tracker. Document the expected health sync strategy for multi-region deployments.

---

## ADR Gaps Identified

1. **No ADR for cost tracking闭环** - `BudgetGuard` (execution-time), `CostAlertService` (monitoring), and `CostOptimizationService` (dashboard) operate as independent systems with no event-driven闭环. An ADR should specify the data flow from reservation → execution → settlement → cost tracking → alerting → optimization.

2. **No ADR for budget policy tier vs ledger tier relationship** - `BudgetLedger.tier` ("platform/tenant/pack/step") and `BudgetPolicy.maxPlatformCostUsd` etc. are related but no documented policy specifies how they interact or which takes precedence.

3. **No ADR for provider health threshold derivation for routing** - The 80%/50% thresholds in `ProviderHealthTracker` are hardcoded but directly control `provider_health_fallback` behavior in routing. No ADR documents the relationship.

4. **No ADR for cost cap fallback coordination with budget reservation** - When `ModelRoutingService` issues a `cost_cap_fallback` lease, `BudgetGuard` is not notified and cannot adjust reservation estimates accordingly. The protocol for this cross-module communication is not defined.

5. **No ADR for division context in cost aggregation** - `CostEstimationService` uses division context but `CostOptimizationService` does not. The relationship between division-scoped estimation and global aggregation is undocumented.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 6     |
| Medium   | 7     |
| Low      | 1     |
| **Total**| 14    |

**ADR Gaps:** 5 identified

**Most Impactful Issues:**

1. **Cost tracking has no闭环** (High) - Budget Guard, Cost Alert Service, and Cost Optimization Service operate independently with no event-driven feedback path from execution to tracking to optimization.

2. **Budget Guard and Model Routing use incompatible cost units** (High) - `maxInputPer1kUsd` (per-token price) and `maxTaskCostUsd` (flat task limit) are enforced by different modules without normalization or cross-validation.

3. **Provider health state not synchronized across regions** (High) - Each `ModelRoutingService` instance has isolated `ProviderHealthTracker` state with no multi-region health sync mechanism.

4. **Cost cap fallback lease not communicated to Budget Guard** (High) - When routing triggers `cost_cap_fallback`, Budget Guard has no awareness and cannot adjust reservation estimates.

5. **Model routing discards health signal richness** (Medium) - Only `status` (healthy/degraded/failed) is used; `successRate`, `fallbackCount`, `totalCalls` are ignored despite being available.

6. **Cost optimization savings estimates use flat multipliers** (Medium) - `estimatedSavingsUsd = currentCostUsd * 0.22` ignores actual token counts and price differentials between profiles.


## Cross-Review: safety ↔ security

### File Coverage

**Key files reviewed for cross-module safety and security conflicts:**
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/sandbox-policy.ts` (683 lines)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-control-plane/iam/policy-engine.ts` (620 lines)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-interface/webhook/index.ts` (319 lines)
- `/Users/holden/Project/automatic_agent/automatic_agent_platform/src/org-governance/compliance-engine/compliance-exception-workflow.ts` (299 lines)

---

### Cross-Module Issue 1: SandboxMode and UnifiedRuntimeMode Are Unrelated Security Controls

**Files:**
- `sandbox-policy.ts:51` — defines `SandboxMode = "read_only" | "workspace_write" | "scoped_external_access" | "restricted_exec"`
- `policy-engine.ts:416-472` — `evaluateModeConstraints()` maps `UnifiedRuntimeMode` to action constraints

**Problem:** `SandboxMode` controls filesystem access boundaries while `UnifiedRuntimeMode` controls execution autonomy (e.g., `supervised`, `full_auto`, `manual_only`). These are independent security models with no mapping between them. A task running with `mode: "full_auto"` (policy engine) could have sandbox `mode: "read_only"` (filesystem), or vice versa. No code validates compatibility between runtime mode authorization and sandbox mode enforcement.

**Severity:** high

**Recommended fix:** Create a `SecurityModeMapping` ADR documenting how `UnifiedRuntimeMode` and `SandboxMode` should be combined. Add validation in `evaluateModeConstraints()` or in the orchestration layer that rejects requests where sandbox mode is more restrictive than the runtime mode would imply (e.g., `full_auto` with `read_only` sandbox is contradictory).

---

### Cross-Module Issue 2: Sandbox Policy `processRuleMode: "allow"` Bypasses Policy Engine Mutating Action Check

**Files:**
- `sandbox-policy.ts:604` — `createWorkspaceWritePolicy()` sets `processRuleMode: "allow"`
- `policy-engine.ts:70` — `MUTATING_POLICY_ACTIONS` includes `"exec_command"`, `"write_file"`, etc.
- `policy-engine.ts:416-430` — `evaluateModeConstraints()` blocks `"write_file"`, `"exec_command"` only when `mode === "no_write"`

**Problem:** `createWorkspaceWritePolicy()` sets `processRuleMode: "allow"`, meaning process execution is permitted by the sandbox. However, `policy-engine.ts` has `MUTATING_POLICY_ACTIONS` that include `"exec_command"`. When the policy engine evaluates a request with `action: "exec_command"` and `mode: "supervised"`, it escalates (line 387-393) but does not check sandbox `processRuleMode`. Conversely, if sandbox policy says `processRuleMode: "deny"`, the policy engine has no knowledge of this and could still approve the action. The two security controls are not coordinated.

**Severity:** high

**Recommended fix:** Add a `SandboxPolicyReference` to `PolicyDecisionRequest` so the policy engine can validate that the requested action is compatible with the sandbox policy's process rules. Alternatively, add a `sandboxConstraints` field to `PolicyDecisionResult.enforcedConstraints` that includes the sandbox policy's `processRuleMode`.

---

### Cross-Module Issue 3: Webhook `signatureVerified` Never Influences Policy Engine Authorization

**Files:**
- `webhook/index.ts:149` — `signatureVerified` is set on `WebhookDispatchEnvelope`
- `webhook/index.ts:122-128` — `verifySignature()` runs but result only stored in envelope
- `policy-engine.ts:300-412` — `evaluate()` has no knowledge of webhook signature verification

**Problem:** When `WebhookIngressService.receive()` processes a request, `verifySignature()` returns `true` only if the signature is valid and not a replay. This result is stored in `envelope.signatureVerified` but is never passed to the policy engine. The policy engine's `evaluate()` function has no field for "request was authenticated via webhook signature" — it only evaluates based on `action`, `riskCategory`, `mode`, and budget. An attacker who could intercept a webhook and remove the signature header would have the request reach the policy engine without any additional security flag.

**Severity:** high

**Recommended fix:** Add `webhookSignatureVerified: boolean` to `PolicyDecisionRequest.metadata`. When the webhook handler calls the policy engine, pass `signatureVerified` so the policy engine can treat unsigned webhooks differently (e.g., require higher approval level or block certain actions).

---

### Cross-Module Issue 4: Policy Engine Escalation and Compliance Exception Workflow Are Independent Approval Paths

**Files:**
- `policy-engine.ts:489-512` — `escalate()` creates escalation decision for approval
- `compliance-exception-workflow.ts:62-85` — `initiateWorkflow()` creates approval workflow
- `policy-engine.ts:105-136` — `recordDecision()` advances approval chain in compliance engine
- `policy-engine.ts:369-393` — escalation triggers based on `riskCategory` and `mode`

**Problem:** The policy engine creates escalation decisions (`"escalate_for_approval"`) while `ComplianceExceptionWorkflowEngine` manages its own approval chain with `currentApproverIndex`. These are two independent approval mechanisms with no shared state. When a task requires approval from the policy engine, it creates a separate workflow path from the compliance exception workflow. If both mechanisms are active for the same task, they operate independently — the compliance exception could be approved while the policy engine still requires its own approval.

**Severity:** high

**Recommended fix:** Define a `SecurityApprovalContext` interface that unifies approval requirements from both policy engine escalation and compliance exceptions. When `evaluate()` returns `"escalate_for_approval"`, check if a corresponding `ComplianceExceptionWorkflow` exists for the same `taskId` and merge the approval requirements.

---

### Cross-Module Issue 5: Compliance Exception Expiry Doesn't Trigger Sandbox Policy Revaluation

**Files:**
- `compliance-exception-workflow.ts:172-189` — `checkExpiration()` marks workflow as `"expired"`
- `sandbox-policy.ts:490-581` — `checkSandboxPath()` enforces path boundaries
- `sandbox-policy.ts:596-609` — `createWorkspaceWritePolicy()` creates sandbox policy for workspace

**Problem:** When a compliance exception expires (line 178: `readIsoTimestampMs(workflow.expiresAt) < Date.now()`), the workflow status changes to `"expired"` but no mechanism exists to re-evaluate the sandbox policy for tasks that were running under the exception. If an exception granted elevated sandbox access (e.g., `scoped_external_access` with broader allowed roots), the sandbox remains in that state until the task completes or a new policy is applied. The expired exception's security implications persist.

**Severity:** medium

**Recommended fix:** When `checkExpiration()` marks a workflow as expired, emit an event that the orchestration layer subscribes to. Upon receiving expiration, re-evaluate active tasks against their sandbox policies and enforce tighter constraints if the exception that authorized them is no longer valid.

---

### Cross-Module Issue 6: Webhook Replay Cache Not Coordinated with Policy Engine Cache

**Files:**
- `webhook/index.ts:247-257` — replay cache keyed by `${endpointId}:${normalizedSignature}`
- `policy-engine.ts:83` — decision cache keyed by composite of `decisionId + action + fingerprint`
- `policy-engine.ts:178-200` — `getCachedDecision()` uses TTL and policy fingerprint

**Problem:** The webhook replay cache at line 247 stores `${endpointId}:${signature}` to detect replay attacks, while the policy engine maintains its own cache with different TTL (5000ms default) and key composition. There's no coordination — a request that passes webhook verification could hit the policy engine cache with a stale decision, or a replayed signature that the webhook accepted could still reach the policy engine with a cached deny decision. The two caches operate independently with no shared invalidation mechanism.

**Severity:** medium

**Recommended fix:** Consider a unified cache key that includes a webhook signature component so that cached policy decisions are invalidated when a new signature is seen. Alternatively, document that these caches serve different purposes (webhook replay detection vs. policy decision optimization) and ensure the orchestration layer handles the case where a webhook passes but the policy engine returns a cached deny.

---

### Cross-Module Issue 7: Sandbox Policy DeniedRoots Includes Home Dir SSH but Policy Engine Has No Corresponding Check

**Files:**
- `sandbox-policy.ts:42` — `DEFAULT_SANDBOX_DENIED_ROOTS = ["/etc", "/proc", "/sys", homedir()/.ssh]`
- `policy-engine.ts:346-367` — budget check only, no path-based denial
- `policy-engine.ts:416-472` — mode constraints only block actions, not paths

**Problem:** The sandbox policy explicitly denies `homedir()/.ssh` (line 42) to protect SSH credentials. However, the policy engine has no corresponding check — `evaluateModeConstraints()` blocks actions based on mode, not paths. If a tool execution request has `action: "read_file"` with `path: "~/.ssh/id_rsa"` and `mode: "full_auto"`, the policy engine would approve it (budget ok, mode allows, risk category low) while the sandbox would deny it. This creates an inconsistency where authorization at the policy engine level doesn't match the sandbox enforcement.

**Severity:** medium

**Recommended fix:** Add a `sandboxDeniedRoots` field to `BudgetPolicy` so the policy engine can include denied paths in its evaluation. When `evaluateBudget()` is called, also check if the requested path is in the sandbox's denied roots and return `budget.denied` with reason `sandbox.path_in_denied_root` if so.

---

### Cross-Module Issue 8: Compliance Exception Workflow In-Memory State Lost on Restart

**Files:**
- `compliance-exception-workflow.ts:57` — `private readonly workflows = new Map<string, ComplianceExceptionWorkflow>()` (in-memory)
- `compliance-exception-workflow.ts:172-189` — `checkExpiration()` modifies in-memory state
- `compliance-exception-workflow.ts:191-210` — `expireDueWorkflows()` iterates in-memory workflows

**Problem:** `ComplianceExceptionWorkflowEngine` stores all workflows in a private in-memory `Map`. If the process restarts or crashes, all active exception workflows are lost. Any tasks running under elevated privileges granted by an exception would continue with those privileges because the exception state no longer exists to trigger re-evaluation. This is a security gap — exceptions are meant to be temporary overrides, but their state is not durable.

**Severity:** high

**Recommended fix:** Persist `ComplianceExceptionWorkflow` state to a durable store (database or file). Add `workflowId` to the store as a foreign key in the task record so that on restart, the system can reconstruct active exceptions and re-evaluate tasks that were running under them.

---

### Cross-Module Issue 9: Policy Engine Kill Switch Has No Corresponding Sandbox Enforcement

**Files:**
- `policy-engine.ts:323-339` — kill switch check returns deny for all actions when enabled
- `sandbox-policy.ts:490-581` — `checkSandboxPath()` has no kill switch awareness
- `sandbox-policy.ts:538-550` — realpath resolution can fail with error but kill switch not consulted

**Problem:** When `killSwitchEnabled: true` in the policy engine, ALL actions return `deny` (line 324-339). However, the sandbox policy `checkSandboxPath()` has no knowledge of the kill switch state. If a request passes through the policy engine (somehow) and reaches the sandbox check, the sandbox would evaluate paths normally. More critically, if the kill switch is activated while tasks are running in sandboxed environments, the sandbox continues to enforce paths without knowing the platform is in a locked-down state.

**Severity:** high

**Recommended fix:** Add a `killSwitchActive: boolean` parameter to sandbox policy evaluation. When `checkSandboxPath()` is called and `killSwitchActive === true`, return `allowed: false` for all paths regardless of the policy configuration. This ensures sandbox enforcement is consistent with policy engine's global kill switch.

---

### Cross-Module Issue 10: Webhook Algorithm "none" Returns False Instead of Throwing

**Files:**
- `webhook/index.ts:215-217` — `algorithm === "none"` returns `false` without throwing
- `webhook/index.ts:122-128` — `signatureVerified` is set to `false` when algorithm is "none"
- `policy-engine.ts:300-412` — policy engine evaluates the request without webhook authentication context

**Problem:** When `endpoint.algorithm === "none"`, `verifySignature()` returns `false` instead of throwing an error. This means a webhook endpoint configured WITHOUT signature verification (algorithm: "none") will set `signatureVerified: false` on the envelope. The policy engine receives no indication that this was an intentional "no signature" configuration vs. a failed signature verification. The policy engine cannot distinguish between "webhook doesn't require signatures" and "signature verification failed."

**Severity:** medium

**Recommended fix:** Add `signatureVerificationRequired: boolean` to `PolicyDecisionRequest.metadata` that is `true` if the endpoint has algorithm `"sha256_hmac"` and `false` otherwise. This way the policy engine knows whether a missing signature is expected (algorithm "none") or a security failure.

---

### Cross-Module Issue 11: Compliance Exception Approval Chain Bypasses Policy Engine Subject Validation

**Files:**
- `compliance-exception-workflow.ts:105-108` — approver validation only checks `approverId !== currentApprover`
- `policy-engine.ts:312-313` — `validateSubjectPermissions()` checks roles and capabilities
- `compliance-exception-workflow.ts:62-85` — `initiateWorkflow()` doesn't verify approver has policy engine permissions

**Problem:** `recordDecision()` at line 106 checks `approverId !== currentApprover` to ensure the correct approver in the chain is making the decision. However, it does not validate that the approver has the necessary permissions in the policy engine. A user could be in the approval chain but lack the `policy.approve_exception` capability that `validateSubjectPermissions()` would check. The compliance workflow's approval bypasses the policy engine's subject validation.

**Severity:** medium

**Recommended fix:** Before recording a decision, call `policyEngine.validateSubjectPermissions({ subjectId: approverId, action: "approve_exception" })`. If the approver lacks the required capability, throw `Error("compliance_exception.approver_lacks_permission")` rather than accepting the decision.

---

### Cross-Module Issue 12: Sandbox Policy `realpathEnforced` Can Be Bypassed by Policy Engine Cache

**Files:**
- `sandbox-policy.ts:103` — `realpathEnforced: boolean` in `SandboxPolicy`
- `sandbox-policy.ts:538-550` — realpath resolution throws on failure, denying the path
- `policy-engine.ts:315-319` — cached decisions returned without re-evaluating sandbox constraints

**Problem:** If a path access decision is cached in the policy engine (line 315-319: `getCachedDecision()`), the sandbox policy's `realpathEnforced` flag is not re-evaluated. The cached result includes `enforcedConstraints` from the policy engine but not the sandbox's realpath resolution. If the sandbox policy changes between cache entries (e.g., `realpathEnforced` is toggled from `false` to `true`), the cached decision would reflect the old sandbox state. A path that was allowed without realpath resolution could be cached and then incorrectly allowed even after realpath enforcement is enabled.

**Severity:** medium

**Recommended fix:** The policy engine cache key at line 242-258 should include `realpathEnforced` as a component, or the cache should be invalidated when sandbox policy changes. Add `policy.realpathEnforced` to the cache key computation.

---

### Cross-Module Issue 13: No Unified Security Decision Interface

**Files:**
- `sandbox-policy.ts:281-290` — `SandboxPathCheckResult = { allowed, normalizedPath, reasonCode }`
- `policy-engine.ts:554-595` — `PolicyDecisionResult` with `decision`, `reasonCode`, `enforcedConstraints`
- `webhook/index.ts:44-58` — `WebhookDispatchEnvelope` with `signatureVerified`, `dispatchState`

**Problem:** Each module produces its own security decision type with different structures. `SandboxPathCheckResult` has `allowed`, `normalizedPath`, `reasonCode`. `PolicyDecisionResult` has `decision: "allow" | "deny" | "escalate_for_approval" | "allow_with_constraints"`, `reasonCode`, `enforcedConstraints`. There's no unified `SecurityDecision` interface that aggregates sandbox, policy engine, and webhook decisions into a single verdict. The orchestration layer must manually compose these results.

**Severity:** high

**Recommended fix:** Create a `UnifiedSecurityDecision` interface:
```typescript
interface UnifiedSecurityDecision {
  allowed: boolean;
  sandboxResult: SandboxPathCheckResult | null;
  policyResult: PolicyDecisionResult | null;
  webhookVerified: boolean;
  reasonCodes: string[];
}
```
Use this as the return type for a `evaluateSecurityPolicy()` function that composes all three checks.

---

### Cross-Module Issue 14: Sandbox Path Check Uses Blocking I/O for Symlink Detection

**Files:**
- `sandbox-policy.ts:409-429` — `containsSymlinkWithinRoot()` uses `lstatSync` which is blocking
- `policy-engine.ts:264-283` — `emitAuditEvent()` calls audit service which could be async
- `webhook/index.ts:242` — `timingSafeEqual()` used for constant-time signature comparison

**Problem:** `containsSymlinkWithinRoot()` at line 409 uses `lstatSync(current)` which is a synchronous blocking filesystem call. Under high load with many concurrent path checks, this could create a denial-of-service vector — an attacker could trigger many path checks that each block on filesystem I/O. The webhook uses `timingSafeEqual` (line 242) for constant-time comparison to prevent timing attacks, but the sandbox path check has no such protection.

**Severity:** medium

**Recommended fix:** Replace the synchronous `lstatSync` loop with an async file operation or a worker thread pool for path checks. Document that `containsSymlinkWithinRoot()` is a potential bottleneck under high concurrency and consider adding rate limiting on path check operations.

---

### Cross-Module Issue 15: Policy Engine TTL Caching Can Mask Sandbox Policy Changes

**Files:**
- `policy-engine.ts:86` — `decisionCacheTtlMs: number` (default 5000ms)
- `policy-engine.ts:178-200` — `getCachedDecision()` returns cached result if TTL not expired
- `sandbox-policy.ts:490-581` — `checkSandboxPath()` has no cache of its own

**Problem:** The policy engine caches decisions for 5000ms by default. If a sandbox policy change occurs (e.g., a new denied root is added), the policy engine may return cached decisions that don't reflect the new sandbox configuration for up to 5 seconds. During this window, a path that is now denied by the sandbox would still be allowed because the cached policy decision doesn't re-evaluate sandbox constraints.

**Severity:** medium

**Recommended fix:** When `SandboxPolicy` changes, call `policyEngine.invalidate("sandbox_policy_changed")` to clear the decision cache. The sandbox module should expose a `onPolicyChange()` callback that the policy engine subscribes to.

---

## ADR Gaps for Security Decisions

1. **No ADR for UnifiedRuntimeMode ↔ SandboxMode mapping** — The relationship between runtime autonomy mode and filesystem sandbox mode is not documented. An ADR should specify which runtime modes are compatible with which sandbox modes and what constraints apply when they conflict.

2. **No ADR for webhook signature verification as an authorization factor** — There's no documented policy for how `signatureVerified` should influence access decisions. An ADR should define whether verified webhooks receive elevated trust and what the policy engine should do with unsigned requests.

3. **No ADR for compliance exception lifecycle and security implications** — When an exception expires or is revoked, there's no documented procedure for re-evaluating tasks running under elevated privileges. An ADR should define the security implications of exception expiration and the mechanism for enforcement.

4. **No ADR for sandbox kill switch coordination** — The relationship between the policy engine's kill switch and sandbox enforcement is not documented. An ADR should specify whether sandbox should mirror the policy engine's kill switch and what the correct behavior is when they diverge.

5. **No ADR for security decision caching across modules** — The policy engine caches decisions, the webhook has a replay cache, but these are independent with no coordinated invalidation. An ADR should define the caching strategy for security decisions and the invalidation triggers when related security state changes.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 8     |
| Medium   | 6     |
| Low      | 0     |
| **Total**| 14    |

**ADR Gaps:** 5 identified

**Most Impactful Issues:**

1. **SandboxMode and UnifiedRuntimeMode are independent security controls with no mapping** (High) — A task could be authorized at the policy engine level but blocked at the sandbox level, or vice versa, with no mechanism to detect the conflict.

2. **Webhook `signatureVerified` never reaches policy engine** (High) — The policy engine evaluates requests without knowledge of whether the webhook was authenticated, missing an opportunity to treat unsigned requests differently.

3. **Policy engine escalation and compliance exception workflow are independent approval paths** (High) — Two separate approval mechanisms operate without coordination, potentially allowing actions that should require multiple approvals.

4. **Compliance exception workflow state is in-memory and lost on restart** (High) — Exceptions granting elevated privileges are not durable, creating a security gap where exceptions could be lost and their privileges persist.

5. **Policy engine kill switch has no corresponding sandbox enforcement** (High) — When the policy engine activates kill switch, the sandbox continues normal enforcement, creating an inconsistency in the security posture.

6. **No unified security decision interface** (High) — Three separate security decision types (sandbox, policy engine, webhook) are composed manually in the orchestration layer without a unified interface.

7. **Sandbox `processRuleMode` bypasses policy engine mutating action check** (High) — The sandbox allows process execution but the policy engine has no knowledge of this, creating conflicting security signals.

The cross-module security model is characterized by independent security controls that don't coordinate their decisions. The most critical architectural need is a unified security decision interface that aggregates sandbox path validation, policy engine authorization, and webhook authentication into a single security verdict with consistent deny/allow semantics across all modules.
