# Division Definition Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines事业部的声明式configure结构，以及角色、workflow、触发器和重试策略的最小要求。

## 2. Division 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `id` | `string` | 事业部唯一标识 |
| `version` | `string \| number` | division defines版本 |
| `name` | `string` | 展示名称 |
| `description` | `string` | 事业部Description |
| `priority` | `number?` | 路由优先级，值越大优先级越高 |
| `triggers` | `string[]` | 路由触发规则 |
| `domain` | `string?` | division 绑定的 domain |
| `tool_bundle_ref` | `string?` | 绑定的 domain tool bundle |
| `plugin_refs` | `string[]?` | 允许加载的 plugin references用 |
| `knowledge_namespace` | `string?` | 该 division 的知识命名空间 |
| `roles` | `RoleRef[]` | 角色defines列table |
| `default_plan_blueprint_ref` | `string` | defaults to PlanGraph/blueprint references用 |
| `orchestration_plan_blueprint_ref` | `string?` | 多步编排 blueprint references用 |
| `default_workflow` | `string?` | legacy loader alias |
| `orchestration_workflow` | `string?` | legacy loader alias |

## 3. Trigger 规则

- trigger used for VP 运营的首轮规则匹配。
- 应优先table达高频user语言。
- 不应过宽，避免多个事业部大面积overlaps命中。

## 4. RoleRef 最小字段

- `id`
- `name`
- `prompt`
- `model`
- `tools`
- `domain_id?`
- `max_instances?`

## 5. Workflow 规则

- `division.yaml` 应优先via `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref` references用编排蓝图；`default_workflow` / `orchestration_workflow` 只保留兼容别名。
- workflow defines可以内联于加载器supported的最小defines中，也可以位于 `workflows/` 目录并由 loader 统一装载。
- 步骤间via output key 传递data；若存在返工或回退，应显式table达，不relies on隐式约定。
- division 若声明 `domain`，workflow 中的 tool / plugin references用必须vs该 domain 匹配。

## v4.3 Contract Remediation

- T-72: 本文原先把 `default_workflow / orchestration_workflow` 写成 canonical references用，Root cause:  division contract 成型时平台仍以 workflow loader 为中心，没有切换到计划蓝图vs图执lines语义。修复：正文现把 `*_plan_blueprint_ref` 提升为权威字段，旧 workflow 键only保留 loader 兼容作用。

## 6. vs HR Agent 的边界

- HR Agent 可在现有事业部内Recommendation新增角色。
- HR Agent 的 workflow patch defaults to不is自动生效configure。
- 新事业部必须人工创建。

## 7. 补充规则

### 7.0 `resource_boundaries` budget字段

- `resource_boundaries.budget_limit_per_task` 若存在，单位固定为 `USD`。
- 该字段必须is正数，table示单任务budgetupper limit，而不is抽象分值。
- loader 可以在运lines时补入 `budget_limit_per_task_unit: "usd"` 作为规范化视图。

### 7.1 `AGENT.md` 加载

- division 级 `AGENT.md` only补充该 division 的lines为Description，不覆盖平台硬规则。
- 加载顺序应为：platform base -> division -> role。

### 7.2 Trigger conflicts裁决

- 先看显式优先级，再看更具体匹配，再看人工defaults to路由。
- conflicts裁决结果必须可解释、可审计。

### 7.3 版本vs迁移

- `division.yaml` 必须携带版本。
- 破坏性 workflow / role 变更必须提供 migration note。
- 运lines中的任务继续绑定启动时解析出的 division 版本。

### 7.4 Domain Registry 集成

- 每个 division 最多绑定一个 authoritative `domain`。
- `tool_bundle_ref`、`plugin_refs`、`knowledge_namespace` 应vs Domain Registry / Plugin Registry 的注册Status一致。
- 未声明 `domain` 的 division 允许uses通用工具集，但不得as domain-specialized division。
