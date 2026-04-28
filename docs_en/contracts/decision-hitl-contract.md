# v4.3 Decision And HITL Contract

> v4.3 canonical contract. Covers `DecisionInputBundle` / `HarnessDecision` / `HumanResponsibilityRecord`.

## 1. Scope

This contract defines the adjudication protocol between runtime, policy, evaluator, and human collaboration. Approval, takeover, override, resume, reject, patch, and other actions must have structured input, adjudication results, and responsibility records.

## 2. DecisionInputBundle

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `decisionInputBundleId` | `string` | Input bundle ID |
| `harnessRunId` | `string` | Associated run |
| `nodeRunId` | `string?` | Associated node |
| `decisionKind` | `approve \| reject \| patch \| takeover \| resume \| abort \| retry \| replan` | Decision type |
| `riskClass` | `low \| medium \| high \| critical` | Risk level |
| `contextRefs` | `ArtifactRef[]` | Context references |
| `evidenceRefs` | `ArtifactRef[]` | Evidence references |
| `policyFindings` | `PolicyFinding[]` | Policy findings |
| `budgetSnapshotRef` | `ArtifactRef?` | Budget snapshot |
| `sideEffectRefs` | `string[]` | Related side effects |
| `createdAt` | `timestamp` | Creation time |

Rules:

- high / critical decisions must include sufficient evidence and scope of responsibility.
- LLM-as-Judge must not override deterministic failure, policy deny, or hard cap failure.

## 3. HarnessDecision

Minimum fields:

- `harnessDecisionId`
- `decisionInputBundleId`
- `decisionKind`
- `decision` (`accept | reject | retry | replan | escalate | abort | takeover | patch`)
- `deciderType` (`system | policy | evaluator | human | operator`)
- `deciderRef`
- `reasonCode`
- `expiresAt?`
- `createdAt`

Rules:

- `HarnessDecision` is append-only; when a new decision supersedes an old one, the old ID must be explicitly referenced.
- `accept` only indicates the current gate passed, and is not equivalent to run success.
- `patch` / `replan` must generate a `GraphPatch` or rejection reason.

## 4. HumanResponsibilityRecord

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `humanResponsibilityRecordId` | `string` | Responsibility record ID |
| `harnessDecisionId` | `string` | Associated decision |
| `humanActorRef` | `PrincipalRef` | Human responsible party |
| `responsibilityScope` | `approval \| override \| takeover \| patch \| resume \| abort \| compensation` | Scope of responsibility |
| `acknowledgedRiskClass` | `low \| medium \| high \| critical` | Acknowledged risk |
| `acknowledgementReceiptRef` | `ArtifactRef` | Acknowledgement receipt |
| `effectiveFrom` | `timestamp` | Effective time |
| `expiresAt` | `timestamp?` | Expiration time |

Rules:

- high / critical human actions must record the responsible party, risk acknowledgement, and expiration time.
- break-glass requires dual approval, time-limited, scope-limited, forensic logging, and post-incident review.
- Human takeover must not bypass `RuntimeStateMachine.transition(command)`.

## 5. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ControlDirective` | Split into runtime control and business adjudication; business adjudication uses `HarnessDecision` |
| approval status only | Insufficient to express v4.3 decisions; must have input bundle and responsibility record |
| takeover event | projection; authoritative record is `HarnessDecision` + `HumanResponsibilityRecord` |

## 6. Test Requirements

- HITL responsibility record test must cover high / critical human actions.
- LLM judge must not override policy deny / hard cap failure.
- takeover / resume must advance through the state machine.
