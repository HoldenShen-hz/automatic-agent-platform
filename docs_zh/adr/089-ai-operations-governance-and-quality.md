# ADR 089: AI Operations Governance and Quality

## 状态

Accepted

## 日期

2026-04-20

## 背景

`§15`-`§18`、`§21`、`§23`、`§27` 定义了 LLM Provider、Prompt、Eval、Cost、HITL、Compliance、SLO 等 AI 运营能力。过去这些能力分别落在 provider、prompt governance、quality、budget、approval contract 中，但缺少统一 ADR 说明 AI 层为什么必须被当成可治理运行时，而不是普通依赖。

## 决策

AI 运营层采用统一治理模型：

- LLM Provider 必须通过 ModelGateway 抽象接入，具备路由、故障切换、观测和降级能力。
- Prompt / model / policy 都必须版本化、可灰度、可回滚、可审计。
- Eval 与质量门禁是上线链路的一部分，不能作为离线报告附属能力。
- Token / model 成本必须进入 budget、metering、chargeback、optimization 闭环。
- HITL 是正式控制路径，不是 UI 交互特例。
- 合规、数据分级、prompt handling、SLO / error budget 共同决定 AI 动作能否执行。

## 取舍

- 不把模型供应商 API 作为平台主 contract，避免供应商锁定。
- 不允许 prompt 直接进入生产而不经过 governance。
- 不允许成本只做报表展示；成本必须可以参与执行前预算守卫和执行后优化。

## 影响

对应 authoritative contracts：

- `tool_and_provider_execution_contract.md`
- `prompt_model_policy_governance_contract.md`
- `quality_engineering_and_chaos_testing_contract.md`
- `cost_and_budget_contract.md`
- `token_budget_allocation_contract.md`
- `approval_and_hitl_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `data_classification_and_prompt_handling_contract.md`
- `slo_alerting_and_runbook_contract.md`

对应实现边界：

- `src/platform/model-gateway/*`
- `src/platform/prompt-engine/*`
- `src/platform/control-plane/*`
- `src/domains/eval-framework/*`
- `src/ops-maturity/cost-optimizer/*`

## 测试要求

- unit tests：provider selection、prompt version policy、budget guard、quality gate。
- integration tests：prompt/model release、HITL approval、cost attribution。
- contract tests：未通过质量门禁、预算或数据分级的 AI 动作不得执行。

## 备选方案

1. **将模型供应商 API 作为平台主 contract**：信息明确，但增加供应商锁定风险。
2. **允许 prompt 直接进入生产**：降低治理成本，但无法保证质量、合规和安全。
3. **成本仅作为报表展示**：实现简单，但成本无法参与执行前守卫和执行后优化。
4. **采用本决策**：统一治理 AI 运营层，确保质量、安全、合规和成本可控。

## 交叉引用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-088 平台表面、通信与扩展性](./088-platform-surface-communication-and-extensibility.md)

## 来源章节

- `§15 LLM Provider`
- `§16 Prompt`
- `§17 Eval`
- `§18 Cost`
- `§21 HITL`
- `§23 Compliance`
- `§27 SLO`
