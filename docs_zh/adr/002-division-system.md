# ADR-002 事业部系统（历史兼容，已由域模型取代）

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

- 状态：Superseded by ADR-081 and ADR-085
- 决策日期：2026-04-02

## 背景

> 说明：本 ADR 保留为历史迁移文档，用于解释旧 `division` 叙事如何收敛到 v4.3 的 `DomainDescriptor + OrgUnit` 模型。新实现不得再把 `division_id` 作为执行 truth 主键。

Automatic Agent 的目标不是只支持编程，而是承载任意可被拆解为工作流的业务。因此业务能力必须以声明式、可插拔、低耦合的方式扩展，而不是写死在平台核心里。

## 决策

将业务能力建模为 v4.3 规定的 `DomainDescriptor + BusinessPack + DomainRiskSpec` 三元组；旧 `division` 只允许作为兼容别名或产品叙事投影存在。

### DomainDescriptor

声明式 domain 标识与能力边界：

- `domain_id`、`name`、`description`。
- `capabilities[]`：该 domain 暴露的能力列表。
- `constraints[]`：运行时约束（预算、超时、并发）。
- `risk_profile`：关联的 DomainRiskSpec 引用。

### BusinessPack

可插拔业务能力包：

- 对应 `src/domains/business-pack/` 下的独立包。
- 包含 roles、workflows、prompts、tools 和 schema。
- 通过 PluginSPI 与平台交互，不污染核心代码。
- 推荐目录形态：`business-pack/<domain>/manifest.yaml`。

### DomainRiskSpec

领域风险规格（v4.3 §10 强制要求）：

| 级别 | 策略 |
|------|------|
| `advisory_only` | 仅提供建议，需人工确认 |
| `human_accountable` | 所有执行需人工审批 |
| `deterministic_hot_path_only` | 仅允许确定性执行路径 |

高风险域（quant-trading / financial-services / healthcare / legal）必须声明 DomainRiskSpec。

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

## 跨域任务

跨 domain 任务由 P3 编排面处理：

- 拆分为多个子任务。
- 建立依赖图。
- 确认上游输出可满足下游输入。
- 通过 PlanGraphBundle 将各 domain 输出聚合为统一结果。

## 动态扩展

HR Agent 负责在现有 domain 内动态补角色：

- 分析能力缺口。
- 生成角色契约与 prompt。
- 验证工具、边界和 schema 的一致性。
- 将 workflow 修改作为建议输出，而非自动部署。

边界：

- HR Agent 不自动创建新 domain。
- 新 domain 依旧由人工通过 BusinessPack 显式添加。
- 新角色工具集合必须是目标 domain 已有工具并集的子集，避免权限膨胀。

## 结果

优点：

- 业务扩展速度快，符合“平台即公司”的设计目标。
- 新业务天然共享安全、通信、存储和恢复能力。
- 多 domain 协作可以统一纳入 P3 编排面处理。

约束：

- 角色工具必须遵守最小权限原则。
- workflow 修改必须经过契约和 schema 兼容性检查。
- domain / pack 越多，对文档、模板、规则和测试的要求越高。

## v4.3 ADR Remediation

- R8-76: 本 ADR 原先以 “事业部/division” 作为业务与执行边界的 canonical 主语，根因是早期组织建模先于域模型冻结。修复：正文现明确 `division` 只保留为历史叙事或 alias，运行时 canonical 绑定统一收敛到 `domain_id / DomainDescriptor`，组织责任边界则由 `OrgUnit` 承担。

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-081 Domain Descriptor 与 Onboarding](./081-domain-descriptor-and-onboarding.md)
- [ADR-085 组织治理与知识边界](./085-organization-governance-and-knowledge-boundary.md)
- [Division Authoring](../guides/division-authoring.md)

## 来源章节

注：v4.3 迁移后，原 §2.3/§2.4/§4.5/§4.6/§10.1 节号已重构。本 ADR 相关内容现分布于 §4（五平面架构）、§10（风险控制）、§40（目标分解）、§55（规模化生态-商业化）。

v4.3 有效引用：
- `§4` 五平面+X1 架构
- `§10.1` 域风险规格
- `§40.2` 目标分解与能力验证
- `§55` 商业化与 Marketplace
