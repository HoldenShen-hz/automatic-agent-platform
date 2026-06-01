# Admin Console And Human Takeover Contract

## 1. Scope

This contract defines the admin console, on-call entry point, and human fallback takeover capabilities.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. Objectives

- Enable production on-call personnel to understand, take over, and mitigate issues.
- When a task fails, allow not just "retry" but also manual repair of the execution chain.
- Isolate admin capabilities from regular user capabilities.

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
- leadership claims governance

## 4. Human Takeover Minimum Actions

- Take over task
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

- Human takeover must write audit logs.
- High-risk takeover actions must re-pass through Policy Engine.
- Regular admins must not have break-glass permissions by default.
- Takeover actions must carry tenant / workspace / harness run / node run scope; global fuzzy operations are not acceptable.
- Actions such as manually supplementing artifact, switching worker, and forcefully ending task must preserve before/after state difference evidence.
- Any takeover action that changes running state must go through `RuntimeStateMachine.transition(command)` and budget reservation check; direct field overwrite is prohibited.

## v4.3 Contract Remediation

- T-70: This document originally described human takeover actions as direct operations on "some step/execution". Root cause: the on-call console contract inherited old step/execution operational semantics without connecting to runtime authority and budget gate. Fix: The main text now anchors takeover to `HarnessRun / NodeRun / NodeAttempt`, and mandates that state transitions and budget reservations go through the formal control chain.

## 7. UI Objectives

Administrators should be able to see:

- Current task tree
- Current execution and lease
- Recent events
- Current model, prompt, policy version
- Current OAPEFLIR stage / loop iteration / timeline
- Current alerts and restriction reasons
- Current tenant / workspace ownership and capability / entitlement restrictions
- Leadership Claims page readiness status, claim level, expiry, scanner hits, and allowlist status
- Claim review request entry point, plus review / revoke / expiry guidance aligned with the CI gate

### 7.1 Leadership Claim Operator Workflow

- A `review request` is an operator approval-flow object and does not directly create a new claim that the CI scanner can honor.
- `approved / rejected` apply only to the `review request` state and do not automatically write back to `config/division-coverage/claims/records.yaml`.
- `revoked / expired` apply to the claim `effectiveStatus`; `expired` is derived from `expiresAt` and does not support a runtime action that restores it to `approved`.
- A runtime revoke must record `reason_code / revoked_by / revoked_at / replacement_required`, and must affect both console presentation and scanner allow/deny behavior.

## 8. Closure Conclusion

Industrial-grade systems must default to assuming "automation will fail" and provide humans with a safe, auditable, and closeable takeover entry point.
