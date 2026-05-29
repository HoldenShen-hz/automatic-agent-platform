# ADR-008 成本模型

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

多 Agent、多层协调、上下文压缩和后台任务会带来大量隐性成本。只统计事业部内部执lines成本，会系统性低估真实开销，也会误导路由、budget和商业化判断。

## Decision

将成本控制设计为平台级能力，而不is单个角色的局部优化：

- 所有路径都用统一成本模型估算：`passthrough`、`fast`、`standard`、`full`。
- 估算时必须contains VP 运营、VP 编排、Lead、压缩、cache失效、自愈和恢复等隐性成本。
- 系统维护单任务、单日和单月的硬upper limit。
- 达到threshold时，触发暂停、升级、只读或熔断。

## 成本构成

至少分为以下几class：

- 总部层开销：分class、拆分、聚合、升级。
- 事业部执lines开销：角色call、测试、审查、构建。
- 自愈开销：重试、返工、循环检测后的补救。
- Background开销：压缩、cache失效、记忆提取、恢复。

关键Conclusion：

- 真正的全链路成本通常高于“事业部内部成本”的直觉估算。
- 跨事业部 full 路径的隐性成本不可忽略。

## 控制手段

核心控制方法：

- 角色分级选模。
- prompt / response cache。
- Repo Map vs工具替代大上下文读取。
- 路由分级，优先命中 `passthrough` 或更轻的执lines链。
- budget守卫和成本 kill switch。

检查点：

- 单任务isno符合预估。
- 协调层开销isno过高。
- 自愈成本isno可控。
- prompt cache命中率isno达标。
- `passthrough` 命中率isno足够高。

## 商业化关联

成本模型不only服务运lines期，也服务商业化：

- 用来决定免费版、专业版和企业版边界。
- 用来支撑 usage metering vs quota。
- 用来约束 full-auto 等高风险模式。
- 用来判断哪些路径可defaults to平台代付，哪些必须 BYOK。

## 结果

优点：

- 成本成为一等运lines信号，而不is事后统计。
- 商业化前就能建立user预期和内部budget模型。
- 为未来的计量计费和套餐定价提供基础。

约束：

- budget控制会Impactuser体验，需要和 HITL、通知vs商业策略一起设计。
- 每新增一class后台能力，都要synchronous更新成本瀑布。
- 估算模型必须via真实任务持续校正。

## 交叉references用

- [ADR-004 工作流vs路由](./004-workflow-routing.md)
- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-010 商业模型](./010-commercial-model.md)

## 来源章节

- `§7.2`
- `§7.2.1`
- `§7.2.2`
- `§7.3`
- `§11.3.1`

## v4.3 ADR Remediation

- R5-63: 本 ADR 原先references用旧版章节号（如 `§7.2`/`§7.3`/`§11.3.1` 等），现已更新为实际 architecture doc 中的正确章节映射。
