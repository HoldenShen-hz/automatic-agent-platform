# Admin Console And Human Takeover Contract

## 1. Scope

This contract defines administrator console, on-duty entry points, and manual fallback takeover capabilities.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. Objectives

- Enable production on-duty personnel to understand, take over, and mitigate damage.
- When task failures occur, enable more than just "retry" but also manual repair of the execution chain.
- Isolate administrator capabilities from ordinary user capabilities.

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

- Take over task
- Modify next step input
- Skip a step
- Retry a step
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
- High-risk takeover actions must be re-reviewed by the Policy Engine.
- Regular administrators must not have break-glass permissions by default.
- Takeover actions must carry tenant / workspace / execution scope and must not use global vague operations.
- Actions such as manually supplementing artifacts, switching workers, and forcefully ending tasks must preserve before/after state difference evidence.

## 7. UI Goals

Administrators should be able to see:

- Current task tree
- Current execution and lease
- Recent events
- Current model, prompt, and policy versions
- Current OAPEFLIR stage / loop iteration / timeline
- Current alerts and constraint reasons
- Current tenant / workspace ownership and capability / entitlement constraints

## 8. Closure Conclusion

Industrial-grade systems must assume "automation will fail" by default and provide humans with a safe, auditable, and closable takeover entry point.
