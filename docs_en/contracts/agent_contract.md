# Agent Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR 8 阶段的 Agent 边界，对应 ADR-016、ADR-080 和 ADR-075。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines平台内 Agent 的身份、职责边界、输入输出 schema、前置检查和permission约束。

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

| 字段 | class型 | Description |
|---|-------|--------|
| `id` | `string` | Agent/角色标识 |
| `name` | `string` | 展示名称 |
| `model_tier` | `reasoning \| coding \| balanced \| fast` | 模型分级 |
| `tools` | `string[]` | 可用工具列table |
| `scope` | `AgentScope` | 职责vs边界 |
| `domain_binding` | `DomainBinding` | 域绑定vs领域约束 |
| `input_schema` | `schema` | 输入要求 |
| `output_schema` | `schema` | 输出要求 |
| `preconditions` | `PreconditionCheck[]` | 执lines前检查 |
| `prompt_template` | `string` | 系统提示模板 |
| `business_alias?` | `string` | 叙事化别名，例如 `VP 编排` |

命名规则：

- 工程实现应优先uses稳定的 canonical role / component id。
- `business_alias` 只used for产品叙事、文档Description或 UI 展示，不应成为底层调度主键。

## 4. Scope 约束

`scope` 至少contains：

- `responsibilities`
- `boundaries`

`DomainBinding` 至少contains：

- `domain_id`
- `domain_descriptor_ref`
- `risk_profile_ref?`
- `tool_bundle_ids?`
- `knowledge_namespaces?`

规则：

- responsibilities Description能做什么。
- boundaries Description明确不能做什么。
- 角色间不得出现高overlaps核心职责而没有裁决边界。
- `domain_id` 必须指向已注册 `DomainDescriptor`；Agent 的工具、知识和治理边界应从 domain binding 派生，而不is从组织叙事单元反推。

## 5. Preconditions

每个 precondition 至少contains：

- `check`
- `description`
- `severity`

语义：

- 父级 Agent 在真正执lines前进lines检查。
- 不via时进入补救、回退或升级，而不isdirectly让子 Agent 自己猜。

Phase 边界：

- Phase 1a 的 precondition 以确定性检查为主，例如输入完整性、permission、budget、relies onisno存在。
- 语义型或模型驱动的 precondition belongs to后续增强，不应defaults to假设在 Phase 1a 已普遍生效。

## 6. permission规则

- Agent 只能call已authorization工具。
- 高风险工具必须vs边界Description一起出现。
- 新角色工具集不得no约束膨胀。
- `spawn_agent`、`send_message` 等协作工具应受更严格角色限制。

## 6.1 Dispatch 抽象边界

`DispatchMode` 至少区分三class：

- `workflow_delegation`: 父级工作流把步骤委派给角色，这is业务编排语义。
- `sub_agent_spawn`: 在同一逻辑运lines面内拉起协作子 Agent，这is协作执lines策略。
- `worker_dispatch`: execution plane via `PlanGraphDispatch (PlanGraphBundle)` 把执lines票据派给 worker，这is基础设施调度语义。

规则：

- 三者不能混用为同一个抽象词“派发”。
- 业务文档谈角色委派时，不应defaults to等同于 worker 调度。
- execution plane 的 queue / lease / worker 语义由 `execution_plane_contract.md` 负责，且 canonical handoff 必须is `PlanGraphDispatch (PlanGraphBundle)`。

## 7. failed语义

- 输入不满足 schema：不得directly执lines。
- precondition failed：进入父级handle逻辑。
- 输出缺字段：允许有限补全重试。

## 7A. OAPEFLIR Executor 边界

Agent executor 在 phase1-4 范围内应按 OAPEFLIR 阶段消费或产出结果（对应 ADR-016）：

| OAPEFLIR 阶段 | Agent 角色 | 约束 |
|--------------|-----------|------|
| Observe | 收集信号 | 不得做评估Decision |
| Assess | 评估风险/复杂度 | 不得bypassing Plan directly执lines |
| Plan | 生成执lines计划 | 必须符合 R3-SINGLE 约束 |
| Execute | 执lines计划 | 不得bypassing `PlanGraphBundle`（R3-NOBYPASS） |
| Feedback | 收集信号 | 不得directlyImpact执lines |
| Learn | 提取模式 | 不得directly写受控Status |
| Improve | 评估候选 | 必须via过 guardrail + approval |
| Release | 受控发布 | 必须遵守 autonomy boundary |

**规则**：

- Agent 可以辅助 Observe / Assess / Plan / Feedback / Learn 的内容生成，但不能directly越过 deterministic guardrail 写最终受控Status。
- Agent 输出若used for Improve / Release，必须进入 policy / guardrail / approval 链后才能生效（R4-EVIDENCE 约束）。

## 7B. Middleware Hooks

`AgentMiddlewareHook` 当前至少应允许：

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

规则：

- middleware hook is runtime seam，不isbypassing policy 的后门。
- hook 产出若进入 feedback / learning / improvement 链，必须具备可审计 provenance。

## 8. 补充规则

### 8.1 统一角色 schema

所有角色至少统一contains：

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

- 平台角色vs领域角色只is在 `role_kind`、`domain_binding` 和permission范围上不同，不应演化为两套对象模型。
- 任何新角色都必须声明输出 contract 和工具边界。

### 8.2 Prompt 模板variable

prompt 模板variable最少分为：

- `system_vars`
- `task_vars`
- `domain_vars`
- `runtime_vars`

规则：

- 未声明variabledefaults to视为 lint error，不允许静默忽略。
- 高风险运lines时约束不得只存在于 prompt variable里，必须有系统层强约束。

### 8.3 角色版本化

- 角色版本uses单调递增语义版本或整数版本。
- 破坏性 prompt / output contract 变更必须升级主版本。
- 运lines中的 execution 继续绑定其启动时的角色版本，不得被热替换污染。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-27: 本文原先accesses along用 `division` 叙事作为 Agent 的主要组织边界，并把 `worker_dispatch` 写成不带 `PlanGraphDispatch` 的泛化派发语义，Root cause: 角色合同继承了 v3 组织编排模型，没有随 v4.3 的域中心模型和 graph dispatch handoff synchronous重写。修复：正文现把 Agent 绑定收敛到 `domain_id / DomainDescriptor`，并把 `worker_dispatch` 明确绑定到 `PlanGraphDispatch (PlanGraphBundle)`。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
