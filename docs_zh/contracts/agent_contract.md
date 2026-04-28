# Agent Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 8 阶段的 Agent 边界，对应 ADR-016、ADR-080 和 ADR-075。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义平台内 Agent 的身份、职责边界、输入输出 schema、前置检查和权限约束。

相关文档：
- [ADR-016 OAPEFLIR 八阶段模型](../adr/016-oapeflir-loop-model.md)
- [ADR-075 六级受控发布](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. 关键对象

- `AgentDefinition`
- `AgentScope`
- `InputSchema`
- `OutputSchema`
- `PreconditionCheck`
- `DispatchMode`
- `AgentMiddlewareHook`
- `DomainBinding`

## 3. AgentDefinition 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Agent/角色标识 |
| `name` | `string` | 展示名称 |
| `model_tier` | `reasoning \| coding \| balanced \| fast` | 模型分级 |
| `tools` | `string[]` | 可用工具列表 |
| `scope` | `AgentScope` | 职责与边界 |
| `domain_binding` | `DomainBinding` | 域绑定与领域约束 |
| `input_schema` | `schema` | 输入要求 |
| `output_schema` | `schema` | 输出要求 |
| `preconditions` | `PreconditionCheck[]` | 执行前检查 |
| `prompt_template` | `string` | 系统提示模板 |
| `business_alias?` | `string` | 叙事化别名，例如 `VP 编排` |

命名规则：

- 工程实现应优先使用稳定的 canonical role / component id。
- `business_alias` 只用于产品叙事、文档说明或 UI 展示，不应成为底层调度主键。

## 4. Scope 约束

`scope` 至少包含：

- `responsibilities`
- `boundaries`

`DomainBinding` 至少包含：

- `domain_id`
- `domain_descriptor_ref`
- `risk_profile_ref?`
- `tool_bundle_ids?`
- `knowledge_namespaces?`

规则：

- responsibilities 说明能做什么。
- boundaries 说明明确不能做什么。
- 角色间不得出现高重叠核心职责而没有裁决边界。
- `domain_id` 必须指向已注册 `DomainDescriptor`；Agent 的工具、知识和治理边界应从 domain binding 派生，而不是从组织叙事单元反推。

## 5. Preconditions

每个 precondition 至少包含：

- `check`
- `description`
- `severity`

语义：

- 父级 Agent 在真正执行前进行检查。
- 不通过时进入补救、回退或升级，而不是直接让子 Agent 自己猜。

Phase 边界：

- Phase 1a 的 precondition 以确定性检查为主，例如输入完整性、权限、预算、依赖是否存在。
- 语义型或模型驱动的 precondition 属于后续增强，不应默认假设在 Phase 1a 已普遍生效。

## 6. 权限规则

- Agent 只能调用已授权工具。
- 高风险工具必须与边界说明一起出现。
- 新角色工具集不得无约束膨胀。
- `spawn_agent`、`send_message` 等协作工具应受更严格角色限制。

## 6.1 Dispatch 抽象边界

`DispatchMode` 至少区分三类：

- `workflow_delegation`: 父级工作流把步骤委派给角色，这是业务编排语义。
- `sub_agent_spawn`: 在同一逻辑运行面内拉起协作子 Agent，这是协作执行策略。
- `worker_dispatch`: execution plane 通过 `PlanGraphDispatch (PlanGraphBundle)` 把执行票据派给 worker，这是基础设施调度语义。

规则：

- 三者不能混用为同一个抽象词“派发”。
- 业务文档谈角色委派时，不应默认等同于 worker 调度。
- execution plane 的 queue / lease / worker 语义由 `execution_plane_contract.md` 负责，且 canonical handoff 必须是 `PlanGraphDispatch (PlanGraphBundle)`。

## 7. 失败语义

- 输入不满足 schema：不得直接执行。
- precondition 失败：进入父级处理逻辑。
- 输出缺字段：允许有限补全重试。

## 7A. OAPEFLIR Executor 边界

Agent executor 在 phase1-4 范围内应按 OAPEFLIR 阶段消费或产出结果（对应 ADR-016）：

| OAPEFLIR 阶段 | Agent 角色 | 约束 |
|--------------|-----------|------|
| Observe | 收集信号 | 不得做评估决策 |
| Assess | 评估风险/复杂度 | 不得绕过 Plan 直接执行 |
| Plan | 生成执行计划 | 必须符合 R3-SINGLE 约束 |
| Execute | 执行计划 | 不得绕过 `PlanGraphBundle`（R3-NOBYPASS） |
| Feedback | 收集信号 | 不得直接影响执行 |
| Learn | 提取模式 | 不得直接写受控状态 |
| Improve | 评估候选 | 必须经过 guardrail + approval |
| Release | 受控发布 | 必须遵守 autonomy boundary |

**规则**：

- Agent 可以辅助 Observe / Assess / Plan / Feedback / Learn 的内容生成，但不能直接越过 deterministic guardrail 写最终受控状态。
- Agent 输出若用于 Improve / Release，必须进入 policy / guardrail / approval 链后才能生效（R4-EVIDENCE 约束）。

## 7B. Middleware Hooks

`AgentMiddlewareHook` 当前至少应允许：

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

规则：

- middleware hook 是 runtime seam，不是绕过 policy 的后门。
- hook 产出若进入 feedback / learning / improvement 链，必须具备可审计 provenance。

## 8. 补充规则

### 8.1 统一角色 schema

所有角色至少统一包含：

- `role_id`
- `role_kind` (`platform | domain`)
- `display_name`
- `objective`
- `prompt_ref`
- `tool_permissions`
- `model_profile`
- `output_contract_ref`
- `version`

规则：

- 平台角色与领域角色只是在 `role_kind`、`domain_binding` 和权限范围上不同，不应演化为两套对象模型。
- 任何新角色都必须声明输出 contract 和工具边界。

### 8.2 Prompt 模板变量

prompt 模板变量最少分为：

- `system_vars`
- `task_vars`
- `domain_vars`
- `runtime_vars`

规则：

- 未声明变量默认视为 lint error，不允许静默忽略。
- 高风险运行时约束不得只存在于 prompt 变量里，必须有系统层强约束。

### 8.3 角色版本化

- 角色版本使用单调递增语义版本或整数版本。
- 破坏性 prompt / output contract 变更必须升级主版本。
- 运行中的 execution 继续绑定其启动时的角色版本，不得被热替换污染。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-27: 本文原先沿用 `division` 叙事作为 Agent 的主要组织边界，并把 `worker_dispatch` 写成不带 `PlanGraphDispatch` 的泛化派发语义，根因是角色合同继承了 v3 组织编排模型，没有随 v4.3 的域中心模型和 graph dispatch handoff 同步重写。修复：正文现把 Agent 绑定收敛到 `domain_id / DomainDescriptor`，并把 `worker_dispatch` 明确绑定到 `PlanGraphDispatch (PlanGraphBundle)`。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
