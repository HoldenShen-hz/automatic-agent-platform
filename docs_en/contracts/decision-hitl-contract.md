# Decision HITL Contract

> **v4.3 canonical contract**. Covers `DecisionInputBundle` / `HarnessDecision` / `HumanResponsibilityRecord`.

## 1. Scope

This contract defines the adjudication protocol between runtime, policy, evaluator, and human collaboration. Approval, takeover, override, resume, reject, patch and other actions must have structured input, adjudication results, and responsibility records.

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
| `policyFindings` | `PolicyFinding[]` | Policy results |
| `budgetSnapshotRef` | `ArtifactRef?` | Budget snapshot |
| `sideEffectRefs` | `string[]` | Related side effects |
| `createdAt` | `timestamp` | Creation time |

Rules:

- High / critical decisions must contain sufficient evidence and responsibility scope.
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

- `HarnessDecision` is append-only; when a new decision supersedes an old one, it must explicitly reference the old ID.
- `accept` only indicates the current gate passed, not that the run succeeded.
- `patch` / `replan` must generate `GraphPatch` or a rejection reason.

## 4. HumanResponsibilityRecord

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `humanResponsibilityRecordId` | `string` | Responsibility record ID |
| `harnessDecisionId` | `string` | Associated decision |
| `humanActorRef` | `PrincipalRef` | Human responsibility subject |
| `responsibilityScope` | `approval \| override \| takeover \| patch \| resume \| abort \| compensation` | Responsibility scope |
| `acknowledgedRiskClass` | `low \| medium \| high \| critical` | Acknowledged risk |
| `acknowledgementReceiptRef` | `ArtifactRef` | Acknowledgement receipt |
| `effectiveFrom` | `timestamp` | Effective time |
| `expiresAt` | `timestamp?` | Expiration time |

Rules:

- High / critical human actions must record the responsibility subject, risk acknowledgement, and expiration time.
- Break-glass requires dual approval, time-limited, scoped, with forensic logging and post-incident review.
- Human takeover must not bypass `RuntimeStateMachine.transition(command)`.

## 5. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `ControlDirective` | Split into runtime control and business decision; business decisions use `HarnessDecision` |
| approval status only | Insufficient to express v4.3 decisions; must have input bundle and responsibility record |
| takeover event | Projection; authoritative record is `HarnessDecision` + `HumanResponsibilityRecord` |

## 6. Test Requirements

- HITL responsibility record test covers high / critical human actions.
- LLM judge cannot override policy deny / hard cap failure.
- Takeover / resume must go through state machine transition.
