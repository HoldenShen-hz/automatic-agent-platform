# v4.3 Version Lock Contract

> v4.3 canonical contract. Covers `RunVersionLock` / `ArtifactVersionLockSet`.

## 1. Scope

Each `HarnessRun` freezes `RunVersionLock` when admitted. Configuration release during runtime must not change the semantics of the already running run; new versions can only be used through explicit GraphPatch, OperationalDirective, redrive, or a new HarnessRun.

## 2. RunVersionLock

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `runVersionLockId` | `string` | Version lock ID |
| `harnessRunId` | `string` | Owning run |
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

- After admission, `RunVersionLock` is append-only and must not be rewritten in place.
- GraphPatch needs to declare `inherit_lock`, `revalidate_with_new_lock`, or `force_restart`.
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

- Large objects in input, plan, prompt, tool output, receipt, and audit evidence must all be traceable through artifact lock.
- Artifact GC must not be earlier than the audit retention window.
- Re-execution replay products must enter an isolated namespace, and must not overwrite the original artifact lock.

## 4. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| latest config lookup | Forbidden for active run truth |
| mutable artifact pointer | Must be replaced with artifact version lock |
| replay overwrite | Forbidden; can only write to isolated evidence namespace |

## 5. Testing Requirements

- Configuration release must not change the lock of the active `HarnessRun`.
- GraphPatch lock conflict must be rejected, re-validated, or restarted per policy.
- Artifact hash change must be detected as a new version.


## v4.3 Architecture Remediation

The following entries fix the contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-4: Only 3 locking strategies are supported (pinned / floating / range), but architecture §22.4 defines 4 strategies including digest-locked. Fix: This semantic is converged into the v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only allowed as legacy / deprecated / projection / migration input, and must not serve as new implementation entries.

Mandatory rules: state transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events may only use `platform.*`; OAPEFLIR may only act as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
