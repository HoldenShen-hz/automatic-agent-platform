# Admin Console And Human Takeover Contract

## 1. Scope

This contract defines administrator console, on-call entry point, and human fallback takeover capabilities.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. Objectives

- Enable production on-call personnel to understand, takeover, and mitigate issues.
- Allow tasks to have human repair of execution chain instead of just "retry" upon failure.
- Isolate administrator capabilities from regular user capabilities.

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

- Takeover task
- Modify next step input
- Skip a specific `NodeRun`
- Retry a specific `NodeAttempt`
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

- Human takeover must write audit logs.
- High-risk takeover actions must pass through Policy Engine again.
- Regular administrators must not have break-glass permissions by default.
- Takeover actions must carry tenant / workspace / harness run / node run scope, and cannot use global fuzzy operations as substitutes.
- Actions such as manually supplementing artifacts, switching workers, and forcibly ending tasks must retain before/after state difference evidence.
- Any takeover action that changes runtime state must go through `RuntimeStateMachine.transition(command)` with budget reservation check, and must not directly modify state fields.

## v4.3 Contract Remediation

- T-70: Originally this document described human takeover actions as direct operations on "a step / an execution". The root cause was that the on-call console contract reused old step/execution operational semantics without connecting to runtime authority and budget gate. Fix: The main text now anchors takeover to `HarnessRun / NodeRun / NodeAttempt`, and mandates that state migration and budget reservation go through the formal control chain.

## 7. UI Objectives

Administrators should be able to see:

- Current task tree
- Current execution and lease
- Recent events
- Current model, prompt, and policy versions
- Current OAPEFLIR stage / loop iteration / timeline
- Current alerts and restriction reasons
- Current tenant / workspace affiliation and capability / entitlement restrictions

## 8. Closure Conclusion

Industrial-grade systems must default to considering "automation will fail", and provide humans with a safe, auditable, and closable takeover entry point.
