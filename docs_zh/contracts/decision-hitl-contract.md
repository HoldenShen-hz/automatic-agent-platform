# v4.3 Decision And HITL Contract

> v4.3 canonical contract。覆盖 `DecisionInputBundle` / `HarnessDecision` / `HumanResponsibilityRecord`。

## 1. 范围

本 contract 定义 runtime、policy、evaluator 与人工协作之间的裁决协议。审批、接管、override、resume、reject、patch 等行为必须有结构化输入、裁决结果和责任记录。

## 2. DecisionInputBundle

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `decisionInputBundleId` | `string` | 输入包 ID |
| `harnessRunId` | `string` | 所属 run |
| `nodeRunId` | `string?` | 所属 node |
| `decisionKind` | `approve \| reject \| patch \| takeover \| resume \| abort \| retry \| replan` | 裁决类型 |
| `riskClass` | `low \| medium \| high \| critical` | 风险 |
| `contextRefs` | `ArtifactRef[]` | 上下文引用 |
| `evidenceRefs` | `ArtifactRef[]` | 证据引用 |
| `policyFindings` | `PolicyFinding[]` | 策略结果 |
| `budgetSnapshotRef` | `ArtifactRef?` | 预算快照 |
| `sideEffectRefs` | `string[]` | 相关副作用 |
| `createdAt` | `timestamp` | 创建时间 |

规则：

- high / critical 裁决必须包含足够 evidence 与责任范围。
- LLM-as-Judge 不得覆盖 deterministic failure、policy deny 或 hard cap failure。

## 3. HarnessDecision

最小字段：

- `harnessDecisionId`
- `decisionInputBundleId`
- `decisionKind`
- `decision` (`accept | retry_same_plan | replan | escalate_to_human | downgrade_mode | abort | quarantine | revoke_approval | pause_for_external | require_revalidation`)
- `deciderType` (`system | policy | evaluator | human | operator | llm`)
- `deciderRef`
- `reasonCode`
- `expiresAt?`
- `createdAt`

规则：

- `HarnessDecision` 是 append-only；新的裁决 supersede 旧裁决时必须显式引用旧 ID。
- `accept` 只表示当前 gate 通过，不等价于 run 成功。
- `patch` / `replan` 必须生成 `GraphPatch` 或拒绝原因。

## 4. HumanResponsibilityRecord

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `humanResponsibilityRecordId` | `string` | 责任记录 ID |
| `harnessDecisionId` | `string` | 关联裁决 |
| `humanActorRef` | `PrincipalRef` | 人类责任主体 |
| `responsibilityScope` | `approval \| override \| takeover \| patch \| resume \| abort \| compensation` | 责任范围 |
| `acknowledgedRiskClass` | `low \| medium \| high \| critical` | 已确认风险 |
| `acknowledgementReceiptRef` | `ArtifactRef` | 确认凭证 |
| `effectiveFrom` | `timestamp` | 生效时间 |
| `expiresAt` | `timestamp?` | 过期时间 |

规则：

- high / critical 人工动作必须记录责任主体、风险确认和过期时间。
- break-glass 必须双人审批、限时、限 scope、forensic logging 与事后复盘。
- 人工接管不得绕过 `RuntimeStateMachine.transition(command)`。

## 5. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `ControlDirective` | 拆分为运行控制与业务裁决；业务裁决使用 `HarnessDecision` |
| approval status only | 不足以表达 v4.3 裁决；必须有 input bundle 与 responsibility record |
| takeover event | projection；权威记录为 `HarnessDecision` + `HumanResponsibilityRecord` |

## 6. 测试要求

- HITL responsibility record test 覆盖 high / critical 人工动作。
- LLM judge 不能覆盖 policy deny / hard cap failure；当前 executable contract 已显式保留 `llm` 作为 `deciderType`。
- takeover / resume 必须通过状态机推进。
