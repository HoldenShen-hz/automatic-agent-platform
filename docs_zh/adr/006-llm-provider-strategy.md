# ADR-006 LLM Provider 策略

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
- 决策日期：2026-04-02

## 背景

平台包含总部角色、执行角色、审查角色和后台任务，不同角色的质量、速度和成本要求差异很大。若每次都由 LLM 临时决定用哪个模型，会带来不可控成本和不可解释行为。

## 决策

采用“模型层级 + Provider 抽象 + 规则选择”的组合策略：

- 用 `reasoning`、`coding`、`balanced`、`fast` 四个 tier 描述能力分层。
- 角色到 tier 的映射在配置层声明，不在运行时由 LLM 重新判断。
- 通过统一 Provider 接口屏蔽底层供应商差异。
- 在 Provider 层统一处理重试、退避、failover、缓存和限速。
- 并进一步区分 provider 内 auth profile rotation 与 provider 间 model fallback。

## 模型分级原则

典型映射：

- `reasoning`：CEO、架构师、Reviewer 等高质量判断场景。
- `coding`：Developer、数据工程师等执行密集场景。
- `balanced`：PM、Tester、研究员、VP 编排等综合平衡场景。
- `fast`：VP 运营回退分类、校对、QA、压缩等低成本场景。

关键约束：

- 角色与 tier 的映射必须可配置、可审计。
- 同名 tier 在不同版本中可以切换到底层不同模型，但行为应有回归验证。

## Provider 层职责

Provider 层不只是“发请求”，还需要统一处理：

- 凭据加载。
- auth profile 选择与轮转。
- request / response 适配。
- 重试与指数退避。
- Provider failover。
- token 计数与计费埋点。
- prompt 缓存和响应缓存。

同时建议维护统一的 provider / model metadata registry，用于承载：

- capability labels
- context / output limits
- pricing
- modalities
- auth methods
- status (`active | degraded | disabled | deprecated`)
- metadata source (`bundled_snapshot | local_override | remote_refresh`)

该 registry 应尽量避免把模型能力散落在调用点通过字符串匹配硬编码。

## 成本与可靠性

Provider 策略必须与成本模型协同：

- 高价值角色使用更强模型，但不允许无限升级。
- 压缩、回退分类和后台整理优先用便宜模型。
- 需要明确 rate limit 策略和 daily budget 策略。

当 LLM 不可用时：

- 允许 failover 到备选 provider。
- 若全面不可用，应暂停任务并通知用户，而不是盲目重试。
- 系统进入降级模式时，只允许执行不依赖 LLM 的安全能力。

Provider 内建议规则：

- 同一 provider 的多个 auth profile 应支持 rotation order、cooldown 和临时 disabled 状态。
- 自动选择的 profile 可以按 session 保持 stickiness，降低缓存抖动。
- 用户显式 pin 的 profile 优先级高于自动轮转，但失败时仍应给出可审计的恢复路径。

## 缓存策略

缓存分为至少三类：

- Layer 1 prompt 静态缓存。
- prompt caching。
- LLM 响应缓存。

目标：

- 降低重复上下文的 token 浪费。
- 提高多 Agent 同构任务的复用率。
- 为成本预测提供更稳定的基础。

## 结果

优点：

- 可解释、可控、可审计。
- 便于针对某一类角色单独演化 tier 选择。
- 不锁定单一厂商，利于后续 failover 和企业化部署。

约束：

- tier 设计必须与成本模型、工作流路径和角色职责一起维护。
- 新模型接入需要跑回归，不应只替换字符串。
- provider 抽象要避免只抽象“最小公分母”，否则会损失高价值特性。

## 交叉引用

- [ADR-005 安全模型](./005-security-model.md)
- [ADR-007 进化引擎](./007-evolution-engine.md)
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
