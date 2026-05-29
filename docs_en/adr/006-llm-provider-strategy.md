# ADR-006 LLM Provider 策略

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

平台contains总部角色、执lines角色、审查角色和后台任务，不同角色的质量、速度和成本要求差异很大。若每iterations都由 LLM 临时决定用哪个模型，会带来不可控成本和不可解释lines为。

## Decision

采用“模型层级 + Provider 抽象 + 规则选择”的组合策略：

- 用 `reasoning`、`coding`、`balanced`、`fast` 四个 tier Description能力分层。
- 角色到 tier 的映射在configure层声明，不在运lines时由 LLM 重新判断。
- via统一 Provider 接口屏蔽底层供应商差异。
- 在 Provider 层统一handle重试、退避、failover、cache和限速。
- 并进一步区分 provider 内 auth profile rotation vs provider 间 model fallback。

## 模型分级principle

典型映射：

- `reasoning`：CEO、Architecture师、Reviewer 等高质量判断场景。
- `coding`：Developer、data工程师等执lines密集场景。
- `balanced`：PM、Tester、研究员、VP 编排等综合平衡场景。
- `fast`：VP 运营回退分class、校对、QA、压缩等低成本场景。

关键约束：

- 角色vs tier 的映射必须可configure、可审计。
- 同名 tier 在不同版本中可以切换到底层不同模型，但lines为应有回归验证。

## Provider 层职责

Provider 层不只is“发request”，还需要统一handle：

- 凭据加载。
- auth profile 选择vs轮转。
- request / response 适配。
- 重试vs指数退避。
- Provider failover。
- token 计数vs计费埋点。
- prompt cache和responsecache。

同时Recommendation维护统一的 provider / model metadata registry，used for承载：

- capability labels
- context / output limits
- pricing
- modalities
- auth methods
- status (`active | degraded | disabled | deprecated`)
- metadata source (`bundled_snapshot | local_override | remote_refresh`)

该 registry 应尽量避免把模型能力散落在call点via字符串匹配hardcodes。

## 成本vs可靠性

Provider 策略必须vs成本模型协同：

- 高价值角色uses更强模型，但不允许no限升级。
- 压缩、回退分class和后台整理优先用便宜模型。
- 需要明确 rate limit 策略和 daily budget 策略。

当 LLM 不可用时：

- 允许 failover 到备选 provider。
- 若全面不可用，应暂停任务并通知user，而不is盲目重试。
- 系统进入降级模式时，只允许执lines不relies on LLM 的security能力。

Provider 内Recommendation规则：

- 同一 provider 的多个 auth profile 应supported rotation order、cooldown 和临时 disabled Status。
- 自动选择的 profile 可以按 session 保持 stickiness，降低cache抖动。
- user显式 pin 的 profile 优先级高于自动轮转，但failed时仍应给出可审计的恢复路径。

## cache策略

cache分为至少三class：

- Layer 1 prompt 静态cache。
- prompt caching。
- LLM responsecache。

目标：

- 降低repeats上下文的 token 浪费。
- 提高多 Agent 同构任务的复用率。
- 为成本预测提供更稳定的基础。

## 结果

优点：

- 可解释、可控、可审计。
- 便于针对某一class角色单独演化 tier 选择。
- 不锁定单一厂商，利于后续 failover 和企业化部署。

约束：

- tier 设计必须vs成本模型、工作流路径和角色职责一起维护。
- 新模型接入需要跑回归，不应只替换字符串。
- provider 抽象要避免只抽象“最小公分母”，no则会损失高价值特性。

## 交叉references用

- [ADR-005 security模型](./005-security-model.md)
- [ADR-007 进化references擎](./007-evolution-engine.md)（其中 rollout / release 相关语义已由 ADR-075 部分替代）
- [ADR-008 成本模型](./008-cost-model.md)

## 来源章节

- `§7.1`
- `§7.3`
- `§7.3.1`
- `§7.3.2`
- `§7.3.3`
- `§7.4`
- `§7.4.1`
- `§7.5`
- `§7.6`

## v4.3 ADR Remediation

- R5-63: 本 ADR 原先references用旧版章节号（如 `§7.1`/`§7.3` 等），现已更新为实际 architecture doc 中的正确章节映射。
