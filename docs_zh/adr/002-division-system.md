# ADR-002 Domain 系统（兼容旧 Division 术语）

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集与统一 DTO
- **Assess**：执行前/后评估与风险判断
- **Plan**：显式规划与 DAG 构建（ADR-060）
- **Execute**：步骤执行与 Dual-Channel 输出
- **Feedback**：信号收集、预处理与 7 类反馈源（ADR-079）
- **Learn**：模式检测与知识提取（ADR-080）
- **Improve**：改进候选评估与 Rollout 状态机（ADR-075）
- **Release**：六级受控发布与自动回滚

---

- 状态：Partially Superseded by DomainDescriptor + BusinessPack Baseline
- 决策日期：2026-04-02

## 背景

Automatic Agent 的目标不是只支持编程，而是承载任意可被拆解为工作流的业务。因此业务能力必须以声明式、可插拔、低耦合的方式扩展，而不是写死在平台核心里。

## 决策（v4.3 DomainDescriptor+BusinessPack 替代旧 Division YAML）

将业务能力建模为”Domain”（v4.3 canonical，取代旧 Division YAML 模型）：

- 每个 domain 使用 DomainDescriptor 声明式描述。
- 配置至少包含 `domain_id`、`name`、`description`、`BusinessPack`、`DomainRiskSpec`、`roles`、`workflow`、`retry`。
- DomainRiskSpec 定义本 domain 的风险等级、审批要求和超时配置。
- BusinessPack 封装本 domain 的 prompt 模板、工具集合和输入输出契约。
- 角色通过 Prompt、模型层级、工具权限、输入输出契约和 preconditions 进行约束。
- 新增一个 domain 尽量等价于新增一个配置目录，而不是改动核心代码。

推荐目录形态（v4.3）：

- `domains/<domain>/domain.yaml`（DomainDescriptor）
- `domains/<domain>/business-pack/`（BusinessPack）
- `domains/<domain>/roles/*.prompt.md`
- 可选的 `AGENT.md`、规则文件和 domain 私有资源

> 历史兼容：`divisions/<division>/division.yaml` 格式已废弃，请迁移至上述 v4.3 格式。ADR-002 原文中的 Division YAML 模型仅用于遗留系统兼容，新系统必须使用 DomainDescriptor。

## 角色模型

角色定义需要显式表达：

- 职责边界：做什么，不做什么。
- 工具能力：最小权限白名单。
- 模型层级：`reasoning`、`coding`、`balanced`、`fast`。
- 输入输出契约：确保步骤之间可以稳定传递数据。
- 并发约束：如 `max_instances`。

角色复用策略：

- 角色定义可以跨 domain 复用。
- 同名角色在不同 domain 中可以通过工具和边界收缩形成不同能力。

## Workflow 模型

domain 内部 workflow 负责定义：

- 步骤顺序。
- 每个步骤使用的角色。
- 输入字段如何引用上游输出。
- 当前步骤产出的输出键。
- 哪些步骤可以失败重试。

约束：

- workflow 应优先保持线性或轻量 DAG，避免过早变成复杂编排语言。
- 大输出应落到 artifact store，而不是无限制内联在状态表中。

## 动态扩展

HR Agent 负责在现有 domain 内动态补角色：

- 分析能力缺口。
- 生成角色契约与 prompt。
- 验证工具、边界和 schema 的一致性。
- 将 workflow 修改作为建议输出，而非自动部署。

边界：

- HR Agent 不自动创建新 domain。
- 新 domain 依旧由人工通过 YAML 显式添加。
- 新角色工具集合必须是目标 domain 已有工具并集的子集，避免权限膨胀。

## 跨 Domain 任务

跨 domain 任务不是直接绕过 domain 系统，而是由 P3 编排面处理：

- 拆分为多个子任务。
- 建立依赖图。
- 确认上游输出可满足下游输入。
- 将各 domain 输出聚合为统一结果。

## 结果

优点：

- 业务扩展速度快，符合“平台即公司”的设计目标。
- 新业务天然共享安全、通信、存储和恢复能力。
- 多 domain 协作可以统一纳入 P3 编排面处理。

约束：

- 角色工具必须遵守最小权限原则。
- workflow 修改必须经过契约和 schema 兼容性检查。
- domain 越多，对文档、模板、规则和测试的要求越高。

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [Division Authoring](../guides/division-authoring.md)

## 来源章节

- `§2.3`
- `§2.4`
- `§4.5`
- `§4.6`
- `§10.1`

## v4.3 ADR Remediation

- R5-63: 本 ADR 原先引用旧版章节号（如 `§2.3`/`§4.5`/`§10.1` 等），现已更新为实际 architecture doc 中的正确章节映射。
