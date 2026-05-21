# Admin Console And Human Takeover Contract

## 1. Scope

This contract defines admin console, on-call entry point, and human fallback takeover capabilities.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. Goals

- Enable production on-call personnel to understand, take over, and mitigate issues.
- When a task fails, not only "retry" is available, but also manual repair of the execution chain.
- Isolate admin capabilities from ordinary user capabilities.

## 3. Console Minimum Modules

- worker management
- queue management
- tenant management
- approval management
- audit search
- feature flag management
- incident timeline
- oapeflir loop management
- rollout management
- feedback / learning management

## 4. Human Takeover Minimum Actions

- Take over a task
- Modify next step input
- Skip a `NodeRun`
- Retry a `NodeAttempt`
- Switch model
- Switch worker
- Manually supplement artifact
- Manually inject feedback signal
- Manually create improvement candidate
- Manually advance or rollback rollout
- End task and record reason

## 5. Key Objects

- `TakeoverSession`
- `OperatorAction`
- `ManualOverride`
- `IncidentContextBundle`

## 6. Security Boundaries

- Human takeover must be audited.
- High-risk takeover actions must be re-reviewed through Policy Engine.
- Regular admins must not have break-glass permissions by default.
- Takeover actions must be scoped to tenant / workspace / harness run / node run; global fuzzy operations cannot replace this.
- Actions like manually supplementing artifacts, switching workers, or forcefully ending tasks must preserve before/after state difference evidence.
- Any takeover action that changes runtime state must go through `RuntimeStateMachine.transition(command)` with budget reservation check; direct state field modification is not allowed.

## v4.3 Contract Remediation

- T-70: This document previously described human takeover actions as direct operations on "a step / an execution". Root cause: on-call console contract reused old step/execution operational semantics and did not connect to runtime authority and budget gate. Fix: The text now anchors takeover to `HarnessRun / NodeRun / NodeAttempt`, and mandates that state transitions and budget reservation go through the formal control chain.

## 7. UI Goals

Admin should be able to see:

- Current task tree
- Current execution and lease
- Recent events
- Current model, prompt, and policy versions
- Current OAPEFLIR stage / loop iteration / timeline
- Current alerts and constraint reasons
- Current tenant / workspace ownership and capability / entitlement limits

## 8. Closure Conclusion

Industrial-grade systems must assume "automation will fail" by default, and provide humans with a safe, auditable, and closeable takeover entry point.