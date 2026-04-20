# ADR-014 组织模型是否直接映射到代码对象

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

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

Automatic Agent 在产品叙事上使用了 CEO、VP、Lead、HR、事业部等拟人化命名，这有助于表达系统角色和协作方式。但若这些名称直接进入代码对象、协议字段和配置主键，会提高实现复杂度，也会让后续重构更容易被产品文案牵着走。

需要明确：

- 产品叙事命名与工程命名之间是否是一一直接映射。
- 代码层到底以什么命名为 authoritative。

## 决策

产品叙事命名保留，但工程实现、配置和协议优先使用 canonical id。

统一规则：

- 对外讲述、产品材料、引导文档可继续使用业务 alias。
- 配置、contract、API、状态表、事件和实现代码优先使用 canonical id。
- 文档中允许使用 `canonical id + business alias` 双层命名。

## 备选方案

### 方案 A：业务命名直接进入代码对象

优点：

- 对产品表达最直观。

代价：

- 工程对象命名会被叙事层牵制。
- 随着角色演进，容易出现命名漂移和实现职责不清。
- 本地 sub-agent、remote worker、workflow planner 等抽象更难统一。

### 方案 B：彻底移除业务 alias

优点：

- 工程命名最稳定、最干净。

代价：

- 对业务沟通、路线图表达和角色理解不够友好。
- 会削弱系统“组织化 agent 协作”的产品叙事。

### 方案 C：当前决策方案

- 工程层 canonical id 为 authoritative
- 业务 alias 作为叙事层保留
- 文档允许双层命名，但 contract / schema 只以 canonical id 为准

## 选择这个方案的原因

- 兼顾产品表达与工程可维护性。
- 有利于把组织层叙事与调度层实现解耦。
- 能降低“CEO/VP/Lead”命名对代码复杂度的放大效应。

## 关键不变量

- contract、API、存储 schema 和事件类型不得以业务 alias 作为唯一主键。
- canonical id 一旦进入实现，应保持稳定。
- 文档若使用双层命名，canonical id 必须在前或至少明确可识别。
- 业务 alias 变化不得迫使 schema 或核心协议重命名。

## 采用触发条件

当前所有 HQ / division / role 命名都应遵守该规则，尤其是：

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## 退出条件

该决策没有“完全退出”目标，但若未来产品叙事发生大改版，仍应保持 canonical id 层稳定，不需要重新把业务 alias 回灌到实现主键。

## 实施影响

当前实现与文档要求：

- 配置文件、事件和 API 返回字段优先 canonical id
- 文档首次出现时可写 `canonical id (business alias)`
- 运行时派发模型应按职责命名，而不是按组织头衔命名

## 结果

优点：

- 保留表达力，同时压住实现复杂度。
- 让后续 execution plane、policy engine、tool registry 等技术层更容易统一抽象。
- 降低产品叙事变更带来的工程震荡。

代价：

- 文档和产品材料需要维护双层映射。
- 新成员需要先理解 canonical id 与 alias 的对应关系。

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-002 事业部系统](./002-division-system.md)
- [ADR-015 Skill 与 Plugin 是否收敛为单市场](./015-unified-extension-marketplace.md)

## 来源章节

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`
