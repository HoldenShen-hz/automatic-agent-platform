# Agent Handoff And Delegation Contract

> v4.3 canonical contract。覆盖 `DelegationRequest` / `DelegationReceipt` / `ACPMessage` / `AgentHandoff`。

## 1. 范围

本 contract defines多 Agent 委托、协作消息和 handoff payload 的权威边界。它补齐 architecture §19、ADR-019 vs当前 runtime 实现之间缺失的专属 contract。

相关实现：

- `src/platform/contracts/delegation-request/index.ts`
- `src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts`
- `src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/types.ts`
- `src/platform/five-plane-orchestration/oapeflir/handoff-model.ts`
- `src/platform/five-plane-orchestration/oapeflir/handoff-serializer.ts`

## 2. DelegationRequest

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `requestId` | `string` | 委托request ID |
| `taskId` | `string` | 父任务或父运lines上下文中的任务锚点 |
| `fromAgentId` | `string` | 父 agent |
| `toAgentId` | `string?` | 目标 agent；若为空则必须uses capability 路由 |
| `capabilityRef` | `string?` | 能力目标references用 |
| `priority` | `low \| normal \| high \| critical` | 委托优先级 |
| `reason` | `string` | 委托原因 |
| `contextRef` | `string?` | 上下文references用 |
| `tenantId` | `string?` | 租户 |
| `createdAt` | `timestamp` | 创建time |

规则：

- `toAgentId` vs `capabilityRef` 至少一者存在。
- `DelegationRequest` 只Description父级意图，不table示permission已授予。
- 新委托不得directly复制父级全部permission，必须via过子集收窄。

## 3. DelegationReceipt

`DelegationReceipt` 对齐当前 runtime `DelegationResult` / `DelegationHandle`。

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `delegationId` | `string` | 委托 ID |
| `parentAgentId` | `string` | 父 agent |
| `childAgentId` | `string` | 子 agent |
| `depth` | `number` | 当前委托深度 |
| `status` | `pending \| pending_approval \| discovery \| bid \| awarded \| active \| completed \| failed \| cancelled \| expired \| timed_out` | 委托Status |
| `correlationId` | `string` | 关联链 |
| `createdAt` | `timestamp` | 创建time |
| `expiresAt` | `timestamp` | 过期time |
| `summary` | `string` | 委托摘要 |
| `artifactRefs` | `string[]` | 产出references用 |
| `evidenceRefs` | `string[]` | 证据references用 |
| `trustLevel` | `number` | 结果信任分 |
| `taintLabels` | `string[]` | data污染标签 |
| `policyOutcome` | `string` | permission/策略收窄结果 |
| `dataClass` | `string` | 跨委托data分class |

规则：

- `DelegationReceipt` is委托主链的权威回执；不得只返回自然语言结果而缺少 `delegationId/status/evidenceRefs`。
- `completed/failed/cancelled/expired/timed_out` 为终态；终态后若要继续，必须新建委托。

## 4. ACPMessage

协作协议消息最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `messageId` | `string` | 消息 ID |
| `messageType` | `task_request \| task_offer \| task_accept \| task_reject \| partial_result \| escalation_request \| completion_report \| takeover_notice` | 消息class型 |
| `correlationId` | `string` | 关联链 |
| `parentRunId` | `string` | 父运lines锚点 |
| `delegationId` | `string` | 委托 ID |
| `childRunId` | `string` | 子运lines锚点 |
| `capabilityIntersection` | `string[]` | 父子permission交集 |
| `budgetCap` | `number` | 子运linesbudgetupper limit |
| `dataBoundary` | `string` | data边界 |
| `deadline` | `timestamp` | 截止time |
| `depth` | `number` | 当前深度 |
| `senderAgentId` | `string` | 发送方 |
| `receiverAgentId` | `string` | 接收方 |
| `domainId` | `string` | 域绑定 |
| `traceId` | `string` | trace |
| `payload` | `json` | 消息体 |
| `timestamp` | `timestamp` | 发送time |

规则：

- `ACPMessage` 的 canonical 运lines链锚点is `parentRunId / childRunId / delegationId`，不得回退到 `workflow_id`、`execution_id` 或其他 legacy 运lines键。
- `completion_report` 至少应携带 `evidence`、`result_summary`、`artifacts`。
- `capabilityIntersection`、`budgetCap`、`dataBoundary`、`deadline` ismandatory字段，不得只在comment里存在。

## 5. AgentHandoff

`AgentHandoff` is运lines时 handoff payload；当前实现uses三层对象并按 token budget 裁剪。

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `handoffId` | `string` | handoff ID |
| `taskId` | `string` | 任务锚点 |
| `fromAgentId` | `string` | 发送方 |
| `toAgentId` | `string` | 接收方 |
| `createdAt` | `timestamp` | 创建time |
| `fact.artifactRefs` | `string[]` | 事实层 artifact references用 |
| `fact.toolCallRecords` | `ToolCallRecord[]` | 工具callrecord |
| `state.currentPhase` | `string` | 当前阶段 |
| `state.blockers` | `string[]` | blocker |
| `state.remainingBudgetUsd` | `number?` | 剩余budget |
| `state.latestSummary` | `string` | 最新摘要 |
| `planDelta.addedSteps` | `string[]` | 新增步骤 |
| `planDelta.removedSteps` | `string[]` | 删除步骤 |
| `planDelta.changedSteps` | `Array<{ stepId: string; reason: string }>` | 变化步骤 |
| `primaryRefs` | `string[]` | 主references用集合 |

规则：

- 当前 runtime canonical handoff uses `AgentHandoff` 三层对象；ADR-019 的 L4 full context 仍belongs to扩展层，不得在文档里假装已成为 runtime defaults to payload。
- handoff 的事实回链应优先references用 `NodeAttemptReceipt`、artifact 和 tool call record，而不is裸 `StepResult`。
- serializer 的裁剪优先级必须保持 `planDelta -> state.summary/blockers -> fact.toolCallRecords -> fact.artifactRefs`。

## 6. Depth Governance（C1-C7）

`§19` 的深度治理在当前 contract 中冻结为以下约束：

- `C1 child_subset_of_parent`: 子委托permission必须is父permission子集。
- `C2 bounded_depth`: `depth` 必须单调递增且受globally深度upper limit约束。
- `C3 bounded_budget`: 每个子运lines必须显式声明 `budgetCap`。
- `C4 bounded_time`: 每个子运lines必须显式声明 `deadline` / `expiresAt`。
- `C5 bounded_data_boundary`: `dataBoundary` vs `dataClass` 必须随链条传播。
- `C6 evidence_on_completion`: 完成回执必须contains `evidenceRefs` 或 completion payload `evidence`。
- `C7 traceable_lineage`: `delegationId / correlationId / parentRunId / childRunId` 必须能串起整条 lineage。

## 7. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `StepResult` handoff 输入 | 只能作为 compatibility builder 输入；canonical 回链应收敛到 `NodeAttemptReceipt` / artifact / tool call record |
| `workflow_id` / `execution_id` | legacy 运lines键；新委托/协作消息必须uses `harnessRunId/nodeRunId` 或 `parentRunId/childRunId` |
| 自然语言 prior summary | 可以作为 `state.latestSummary` 的投影来源，但不得替代结构化 handoff / receipt |

## 8. 测试要求

- `DelegationRequest` 缺目标 agent vs capabilityRef 时必须拒绝。
- `ACPMessage` 必须拒绝缺失 `delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline` 的消息。
- handoff serializer 必须在budget受限时先裁剪 `planDelta`，而不is先丢事实层。
- 委托完成回执必须能回链 `delegationId -> evidenceRefs / artifactRefs -> childRunId`。
