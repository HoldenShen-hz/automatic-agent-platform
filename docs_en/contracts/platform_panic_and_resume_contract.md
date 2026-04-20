# Platform Panic And Resume Contract

## 1. Scope

This contract defines global circuit breaking, propagation mechanisms, recovery protocols, and drill requirements for `§60`.

## 2. Canonical Objects

- `PlatformPanicDirective`
- `PanicPropagationRecord`
- `ResumePlan`
- `PanicDrillRecord`

## 3. `PlatformPanicDirective` Minimum Fields

- `directive_id`
- `scope`
- `reason_code`
- `issued_by`
- `issued_at`
- `freeze_modes`
- `allow_list?`

## 4. Rules

- Panic must be operable at platform / tenant / org / domain / workflow multiple levels.
- After panic takes effect, new high-risk executions must be blocked.
- Recovery must go through explicit `ResumePlan` and must not rely on implicit restart to clear.

## 5. Test Requirements

- unit: scope match, propagation, resume validation
- integration: panic -> execution block -> resume
- contract: no unaudited automatic recovery during panic
