# v4.3 Decision And HITL Contract

> v4.3 canonical contract。覆盖 `DecisionInputBundle` / `HarnessDecision` / `HumanResponsibilityRecord`。

## 1. 范围

本 contract defines runtime、policy、evaluator vs人工协作之间的裁决协议。审批、接管、override、resume、reject、patch 等lines为必须有结构化输入、裁决结果和责任record。

## 2. DecisionInputBundle

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `decisionInputBundleId` | `string` | 输入包 ID |
| `harnessRunId` | `string` | 所属 run |
| `nodeRunId` | `string?` | 所属 node |
| `decisionKind` | `approve \| reject \| patch \| takeover \| resume \| abort \| retry \| replan` | 裁决class型 |
| `riskClass` | `low \| medium \| high \| critical` | 风险 |
| `contextRefs` | `ArtifactRef[]` | 上下文references用 |
| `evidenceRefs` | `ArtifactRef[]` | 证据references用 |
| `policyFindings` | `PolicyFinding[]` | 策略结果 |
| `budgetSnapshotRef` | `ArtifactRef?` | budget快照 |
| `sideEffectRefs` | `string[]` | 相关副作用 |
| `createdAt` | `timestamp` | 创建time |

规则：

- high / critical 裁决必须contains足够 evidence vs责任范围。
- LLM-as-Judge 不得覆盖 deterministic failure、policy deny 或 hard cap failure。

## 3. HarnessDecision

最小字段：

- `harnessDecisionId`
- `decisionInputBundleId`
- `decisionKind`
- `decision` (`accept | reject | retry | replan | escalate | abort | takeover | patch`)
- `deciderType` (`system | policy | evaluator | human | operator`)
- `deciderRef`
- `reasonCode`
- `expiresAt?`
- `createdAt`

规则：

- `HarnessDecision` is append-only；新的裁决 supersede 旧裁决时必须显式references用旧 ID。
- `accept` 只table示当前 gate via，不等价于 run success。
- `patch` / `replan` 必须生成 `GraphPatch` 或拒绝原因。

## 4. HumanResponsibilityRecord

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `humanResponsibilityRecordId` | `string` | 责任record ID |
| `harnessDecisionId` | `string` | 关联裁决 |
| `humanActorRef` | `PrincipalRef` | 人class责任主体 |
| `responsibilityScope` | `approval \| override \| takeover \| patch \| resume \| abort \| compensation` | 责任范围 |
| `acknowledgedRiskClass` | `low \| medium \| high \| critical` | 已确认风险 |
| `acknowledgementReceiptRef` | `ArtifactRef` | 确认凭证 |
| `effectiveFrom` | `timestamp` | 生效time |
| `expiresAt` | `timestamp?` | 过期time |

规则：

- high / critical 人工动作必须record责任主体、风险确认和过期time。
- break-glass 必须双人审批、限时、限 scope、forensic logging vs事后复盘。
- 人工接管不得bypassing `RuntimeStateMachine.transition(command)`。

## 5. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `ControlDirective` | 拆分为运lines控制vs业务裁决；业务裁决uses `HarnessDecision` |
| approval status only | 不足以table达 v4.3 裁决；必须有 input bundle vs responsibility record |
| takeover event | projection；权威record为 `HarnessDecision` + `HumanResponsibilityRecord` |

## 6. 测试要求

- HITL responsibility record test 覆盖 high / critical 人工动作。
- LLM judge 不能覆盖 policy deny / hard cap failure。
- takeover / resume 必须viaStatus机推进。
