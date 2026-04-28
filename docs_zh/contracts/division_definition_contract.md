# Division Definition Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义事业部的声明式配置结构，以及角色、workflow、触发器和重试策略的最小要求。

## 2. Division 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 事业部唯一标识 |
| `version` | `string \| number` | division 定义版本 |
| `name` | `string` | 展示名称 |
| `description` | `string` | 事业部说明 |
| `priority` | `number?` | 路由优先级，值越大优先级越高 |
| `triggers` | `string[]` | 路由触发规则 |
| `domain` | `string?` | division 绑定的 domain |
| `tool_bundle_ref` | `string?` | 绑定的 domain tool bundle |
| `plugin_refs` | `string[]?` | 允许加载的 plugin 引用 |
| `knowledge_namespace` | `string?` | 该 division 的知识命名空间 |
| `roles` | `RoleRef[]` | 角色定义列表 |
| `default_plan_blueprint_ref` | `string` | **canonical** PlanGraphBundle blueprint 引用 |
| `orchestration_plan_blueprint_ref` | `string?` | **canonical** 多步编排 PlanGraphBundle blueprint 引用 |
| `default_workflow` | `string?` | **废弃** legacy loader alias，仅用于旧数据兼容 |
| `orchestration_workflow` | `string?` | **废弃** legacy loader alias，仅用于旧数据兼容 |

规则：
- `default_plan_blueprint_ref` 与 `orchestration_plan_blueprint_ref` 是 canonical 引用，必须指向 `PlanGraphBundle`。
- `default_workflow` / `orchestration_workflow` 仅保留向后兼容作用，不得作为新设计的数据主键。

## 3. Trigger 规则

- trigger 用于 VP 运营的首轮规则匹配。
- 应优先表达高频用户语言。
- 不应过宽，避免多个事业部大面积重叠命中。

## 4. RoleRef 最小字段

- `id`
- `name`
- `prompt`
- `model`
- `tools`
- `domain_id?`
- `max_instances?`

## 5. Workflow 规则

- `division.yaml` 应优先通过 `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref` 引用编排蓝图；`default_workflow` / `orchestration_workflow` 只保留兼容别名。
- workflow 定义可以内联于加载器支持的最小定义中，也可以位于 `workflows/` 目录并由 loader 统一装载。
- 步骤间通过 output key 传递数据；若存在返工或回退，应显式表达，不依赖隐式约定。
- division 若声明 `domain`，workflow 中的 tool / plugin 引用必须与该 domain 匹配。

## v4.3 Contract Remediation

- T-72: 本文原先把 `default_workflow / orchestration_workflow` 写成 canonical 引用，根因是 division contract 成型时平台仍以 workflow loader 为中心，没有切换到计划蓝图与图执行语义。修复：正文现把 `*_plan_blueprint_ref` 提升为权威字段，旧 workflow 键仅保留 loader 兼容作用。

## 6. 与 HR Agent 的边界

- HR Agent 可在现有事业部内建议新增角色。
- HR Agent 的 workflow patch 默认不是自动生效配置。
- 新事业部必须人工创建。

## 7. 补充规则

### 7.1 `AGENT.md` 加载

- division 级 `AGENT.md` 仅补充该 division 的行为说明，不覆盖平台硬规则。
- 加载顺序应为：platform base -> division -> role。

### 7.2 Trigger 冲突裁决

- 先看显式优先级，再看更具体匹配，再看人工默认路由。
- 冲突裁决结果必须可解释、可审计。

### 7.3 版本与迁移

- `division.yaml` 必须携带版本。
- 破坏性 workflow / role 变更必须提供 migration note。
- 运行中的任务继续绑定启动时解析出的 division 版本。

### 7.4 Domain Registry 集成

- 每个 division 最多绑定一个 authoritative `domain`。
- `tool_bundle_ref`、`plugin_refs`、`knowledge_namespace` 应与 Domain Registry / Plugin Registry 的注册状态一致。
- 未声明 `domain` 的 division 允许使用通用工具集，但不得伪装成 domain-specialized division。
