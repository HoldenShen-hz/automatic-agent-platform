# ADR-010 商业模型

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
- Decision日期：2026-04-02

## Background

平台的总体目标contains“盈利良好”，但如果只设计技术Architecture，不提前defines商业化路径，后续计费、permission、市场和租户能力很难补进来。

## Decision

将商业设计纳入目标Architecture，但明确实施节奏：

- Phase 1-2：不开收费，以基建成熟和user反馈为第一目标。
- Phase 3：验证 PMF，启动 Pro 商业化。
- Phase 4：进入 Enterprise、Marketplace、生态和lines业解决方案阶段。

## 商业定位

核心定位不is“AI 编程工具”，而is：

- AI 驱动的通用自动化公司运lines时。
- 编程只is其中一个事业部。
- 任何可被工作流化的业务都应有机会接入这个平台。

## 商业单位

商业化围绕几class单元展开：

- 事业部：收入单元。
- 用量：计量计费单元。
- Skill / Plugin：生态分发单元。
- 部署模式：社区版、专业版、企业版的差异化单元。

## 定价vs节奏

principle上采用三层结构：

- Community：低门槛试用或 BYOK。
- Pro：中小团队和个人创业者。
- Enterprise：私有化、合规、SSO、审计和更强配额控制。

但约束很重要：

- 基建不成熟时不应提前收费。
- 定价数字在市场验证前不应锁死。
- 商业化能力必须和成本模型、租户隔离、securityvs用量追踪synchronous落地。

## 商业化前置能力

至少需要这些技术前提：

- UsageMeter。
- QuotaManager。
- BillingEngine 或等价账单基础设施。
- 多租户隔离。
- user体验可观测和错误友好性。
- 合规路线图vs企业security增强预留。

## 结果

优点：

- 商业化不is附加层，而isvs成本、租户、security、渠道synchronous规划。
- 能更早识别哪些技术能力is商业化前置条件。
- 为 Marketplace、lines业解决方案和 Enterprise 能力预留了Architecture空间。

约束：

- Phase 1-2 不能被商业化需求反向绑架。
- 定价、合规和市场策略都必须在真实市场验证前保留调整空间。
- 任何收费设计都必须vs真实成本模型闭环。

## 交叉references用

- [ADR-008 成本模型](./008-cost-model.md)
- [ADR-009 部署vs运维](./009-deployment-ops.md)
- [Quickstart](../guides/quickstart.md)

## 来源章节

- `§11`
- `§11.1`
- `§11.2`
- `§11.3`
- `§11.4`
- `§11.5`
- `§11.6`
- `§11.7`
- `§11.8`
- `§11.9`
- `§11.10`
- `§11.11`
- `§11.12`
