# v4.3 Decision And HITL Contract

> v4.3 canonical contract. Covers `DecisionInputBundle` / `HarnessDecision` / `HumanResponsibilityRecord`.

## 1. Scope

This contract defines the adjudication protocol between runtime, policy, evaluator, and human collaboration. Actions such as approval, takeover, override, resume, reject, and patch must have structured input, decision results, and responsibility records.

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

- High / critical decisions must include sufficient evidence and responsibility scope.
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
- `accept` only indicates the current gate passed, not that the run succeeded.
- `patch` / `replan` must generate `GraphPatch` or a rejection reason.

## 4. HumanResponsibilityRecord

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `humanResponsibilityRecordId` | `string` | Responsibility record ID |
| `harnessDecisionId` | `string` | Associated decision |
| `humanActorRef` | `PrincipalRef` | Human responsible party |
| `responsibilityScope` | `approval \| override \| takeover \| patch \| resume \| abort \| compensation` | Responsibility scope |
| `acknowledgedRiskClass` | `low \| medium \| high \| critical` | Acknowledged risk |
| `acknowledgementReceiptRef` | `ArtifactRef` | Acknowledgement receipt |
| `effectiveFrom` | `timestamp` | Effective time |
| `expiresAt` | `timestamp?` | Expiration time |

Rules:

- High / critical human actions must record the responsible party, risk acknowledgment, and expiration time.
- Break-glass must require dual approval, time limits, scope limits, forensic logging, and post-incident review.
- Human takeover must not bypass `RuntimeStateMachine.transition(command)`.

## 5. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ControlDirective` | Split into runtime control and business decision; business decision uses `HarnessDecision` |
| Approval status only | Insufficient to express v4.3 decisions; must have input bundle and responsibility record |
| Takeover event | Projection; authoritative record is `HarnessDecision` + `HumanResponsibilityRecord` |

## 6. Testing Requirements

- HITL responsibility record test must cover high / critical human actions.
- LLM judge cannot override policy deny / hard cap failure.
- Takeover / resume must progress through the state machine.
