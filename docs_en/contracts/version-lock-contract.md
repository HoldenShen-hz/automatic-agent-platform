# v4.3 Version Lock Contract

> v4.3 canonical contract. Covers `RunVersionLock` / `ArtifactVersionLockSet`.

## 1. Scope

Each `HarnessRun` is frozen with a `RunVersionLock` at admission. Configuration releases during runtime must not alter the semantics of an already-running run; this can only be done via explicit GraphPatch, OperationalDirective, redrive, or a new HarnessRun using the new version.

## 2. RunVersionLock

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `runVersionLockId` | `string` | Version lock ID |
| `harnessRunId` | `string` | Associated run |
| `schemaVersion` | `string` | Contract / schema version |
| `runtimeProfileVersion` | `string` | Runtime profile |
| `promptVersions` | `Record<string,string>` | Prompt versions |
| `policyVersions` | `Record<string,string>` | Policy versions |
| `toolVersions` | `Record<string,string>` | Tool / connector versions |
| `modelVersions` | `Record<string,string>` | Model / provider versions |
| `evalVersions` | `Record<string,string>` | Eval / judge versions |
| `guardrailVersions` | `Record<string,string>` | Guardrail versions |
| `domainVersions` | `Record<string,string>` | Domain / pack versions |
| `createdAt` | `timestamp` | Freeze time |

Rules:

- After admission, `RunVersionLock` is append-only and must not be overwritten in place.
- GraphPatch must declare `inherit_lock`, `revalidate_with_new_lock`, or `force_restart`.
- `force_restart` must create a new `HarnessRun`.

## 3. ArtifactVersionLockSet

Minimum fields:

- `artifactVersionLockSetId`
- `harnessRunId`
- `artifactLocks[]`
- `createdAt`

`artifactLocks[]` minimum fields:

- `artifactId`
- `version`
- `hash`
- `storageUri`
- `retentionPolicyRef`

Rules:

- Large objects in input, plan, prompt, tool output, receipt, and audit evidence must be traceable via artifact lock.
- Artifact GC must not occur before the audit retention window.
- Re-execution Replay artifacts must enter an isolated namespace and must not overwrite the original artifact lock.

## 4. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| latest config lookup | Forbidden for active run truth |
| mutable artifact pointer | Must be replaced with artifact version lock |
| replay overwrite | Forbidden; must only write to isolated evidence namespace |

## 5. Test Requirements

- Configuration releases must not change the lock of an active `HarnessRun`.
- GraphPatch lock conflicts must be rejected, re-validated, or restarted according to policy.
- Artifact hash changes must be detected as new versions.

## v4.3 Architecture Remediation

The following entries fix the contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If the historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-4: Only 3 locking strategies supported (pinned/floating/range), architecture §22.4 defines 4 including digest-locked. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only allowed as legacy/deprecated/projection/migration inputs, and must not be used as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.