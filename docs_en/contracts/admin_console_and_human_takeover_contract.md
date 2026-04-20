# Admin Console And Human Takeover Contract

## 1. Scope

This contract defines the admin console, on-duty entry points, and human fallback takeover capabilities.

Related documents:

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. Goals

- Allow production on-duty personnel to understand, take over, and stop losses.
- When a task fails, instead of only being able to "retry," allow humans to manually repair the execution chain.
- Isolate admin capabilities from regular user capabilities.

## 3. Console Minimum Modules

- worker management
- queue management
- tenant management
- approval management
- audit search
- feature flag management
- incident timeline

## 4. Human Takeover Minimum Actions

- Take over task
- Modify next step input
- Skip a step
- Retry a step
- Switch model
- Switch worker
- Manually supplement artifact
- End task and record reason

## 5. Key Objects

- `TakeoverSession`
- `OperatorAction`
- `ManualOverride`
- `IncidentContextBundle`

## 6. Security Boundaries

- Human takeover must write audit logs.
- High-risk takeover actions must again go through Policy Engine.
- Regular admins must not have break-glass permissions by default.
- Takeover actions must carry tenant / workspace / execution scope and cannot use global fuzzy operations as substitute.
- Actions such as manually supplementing artifacts, switching workers, and forcefully ending tasks must preserve before/after state difference evidence.

## 7. UI Goals

Admins should be able to see:

- Current task tree
- Current execution and lease
- Recent events
- Current model, prompt, and policy versions
- Current alerts and restriction reasons
- Current tenant / workspace ownership and capability / entitlement limits

## 8. Closure Conclusion

Industrial-grade systems must default to considering "automation will fail" and give humans a safe, auditable, and closeable takeover entry point.
