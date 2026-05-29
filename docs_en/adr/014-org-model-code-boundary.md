# ADR-014 组织模型isnodirectly映射到code对象

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集vs统一 DTO
- **Assess**：执lines前/后评估vs风险判断
- **Plan**：显式规划vs DAG 构建（ADR-060）
- **Execute**：步骤执linesvs Dual-Channel 输出
- **Feedback**：信号收集、预handlevs 7 class反馈源（ADR-079）
- **Learn**：模式检测vs知识提取（ADR-080）
- **Improve**：改进候选评估vs Rollout Status机（ADR-075）
- **Release**：六级受控发布vs自动回滚

---

- Status：Accepted
- Decision日期：2026-04-03

## Background

Automatic Agent 在产品叙事上uses了 CEO、VP、Lead、HR、事业部等拟人化命名，这有助于table达系统角色和协作方式。但若这些名称directly进入code对象、协议字段和configure主键，会提高实现复杂度，也会让后续重构更容易被产品文案牵着走。

需要明确：

- 产品叙事命名vs工程命名之间isnois一一directly映射。
- code层到底以什么命名为 authoritative。

## Decision

产品叙事命名保留，但工程实现、configure和协议优先uses canonical id。

统一规则：

- 对外讲述、产品材料、references导文档可继续uses业务 alias。
- configure、contract、API、Statustable、事件和实现code优先uses canonical id。
- 文档中允许uses `canonical id + business alias` 双层命名。

## 备选方案

### 方案 A：业务命名directly进入code对象

优点：

- 对产品table达最直观。

代价：

- 工程对象命名会被叙事层牵制。
- 随着角色演进，容易出现命名漂移和实现职责不清。
- 本地 sub-agent、remote worker、workflow planner 等抽象更难统一。

### 方案 B：彻底移除业务 alias

优点：

- 工程命名最稳定、最干净。

代价：

- 对业务沟通、路线图table达和角色理解不够友好。
- 会削弱系统“组织化 agent 协作”的产品叙事。

### 方案 C：当前Decision方案

- 工程层 canonical id 为 authoritative
- 业务 alias 作为叙事层保留
- 文档允许双层命名，但 contract / schema 只以 canonical id 为准

## 选择这个方案的原因

- 兼顾产品table达vs工程可维护性。
- 有利于把组织层叙事vs调度层实现解耦。
- 能降低“CEO/VP/Lead”命名对code复杂度的放大效应。

## 关键不variable

- contract、API、storage schema 和事件class型不得以业务 alias 作为唯一主键。
- canonical id 一旦进入实现，应保持稳定。
- 文档若uses双层命名，canonical id 必须在前或至少明确可识别。
- 业务 alias 变化不得迫使 schema 或核心协议重命名。

## 采用触发条件

当前所有 HQ / division / role 命名都应遵守该规则，尤其is：

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## 退出条件

该Decision没有“完全退出”目标，但若未来产品叙事发生大改版，仍应保持 canonical id 层稳定，不需要重新把业务 alias 回灌到实现主键。

## 实施Impact

当前实现vs文档要求：

- configure文件、事件和 API 返回字段优先 canonical id
- 文档首iterations出现时可写 `canonical id (business alias)`
- 运lines时派发模型应按职责命名，而不is按组织头衔命名

## 结果

优点：

- 保留table达力，同时压住实现复杂度。
- 让后续 execution plane、policy engine、tool registry 等技术层更容易统一抽象。
- 降低产品叙事变更带来的工程震荡。

代价：

- 文档和产品材料需要维护双层映射。
- 新成员需要先理解 canonical id vs alias 的对应关系。

## 交叉references用

- [ADR-001 三层分权Architecture](./001-three-layer-architecture.md)
- [ADR-002 事业部系统](./002-division-system.md)
- [ADR-015 Skill vs Plugin isno收敛为单市场](./015-unified-extension-marketplace.md)

## 来源章节

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`
