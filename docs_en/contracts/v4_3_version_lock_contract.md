# v4.3 Version Lock Contract

> v4.3 canonical contract. Covers `RunVersionLock` / `ArtifactVersionLockSet`.

## 1. Scope

Each `HarnessRun` freezes `RunVersionLock` at admission. Configuration releases during runtime must not change the semantics of already running runs; can only use new versions through explicit GraphPatch, OperationalDirective, redrive, or new HarnessRun.

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

- After admission, `RunVersionLock` is append-only, must not be overwritten in place.
- GraphPatch needs to declare `inherit_lock`, `revalidate_with_new_lock`, or `force_restart`.
- `force_restart` must create new `HarnessRun`.

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
- Artifact GC must not be earlier than audit retention window.
- Re-execution Replay artifacts must enter isolated namespace, must not overwrite original artifact lock.

## 4. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| latest config lookup | Forbidden for active run truth |
| mutable artifact pointer | Must be replaced with artifact version lock |
| replay overwrite | Forbidden; can only write to isolated evidence namespace |

## 5. Testing Requirements

- Configuration release must not change lock of active `HarnessRun`.
- GraphPatch lock conflict must reject, re-validate, or restart according to strategy.
- Artifact hash change must be detected as new version.
