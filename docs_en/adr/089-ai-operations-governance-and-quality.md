# ADR 089: AI Operations Governance and Quality

- Status：Accepted
- Decision日期：2026-04-20

## Background

`§15`-`§18`、`§21`、`§23`、`§27` defines了 LLM Provider、Prompt、Eval、Cost、HITL、Compliance、SLO 等 AI 运营能力。过去这些能力分别落在 provider、prompt governance、quality、budget、approval contract 中，但缺少统一 ADR Description AI 层为什么必须被当成可治理运lines时，而不is普通relies on。

## Decision

AI 运营层采用统一治理模型：

- LLM Provider 必须via ModelGateway 抽象接入，具备路由、故障切换、观测和降级能力。
- Prompt / model / policy 都必须版本化、可灰度、可回滚、可审计。
- Eval vs质量门禁is上线链路的一部分，不能作为离线报告附属能力。
- Token / model 成本必须进入 budget、metering、chargeback、optimization 闭环。
- HITL is正式控制路径，不is UI 交互特例。
- 合规、data分级、prompt handling、SLO / error budget 共同决定 AI 动作能no执lines。

## 取舍

- 不把模型供应商 API 作为平台主 contract，避免供应商锁定。
- 不允许 prompt directly进入生产而不via过 governance。
- 不允许成本只做报table展示；成本必须可以参vs执lines前budget守卫和执lines后优化。

## Impact

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
- `src/platform/five-plane-control-plane/*`
- `src/domains/eval-framework/*`
- `src/ops-maturity/cost-optimizer/*`

## 测试要求

- unit tests：provider selection、prompt version policy、budget guard、quality gate。
- integration tests：prompt/model release、HITL approval、cost attribution。
- contract tests：未via质量门禁、budget或data分级的 AI 动作不得执lines。

## 备选方案

1. **将模型供应商 API 作为平台主 contract**：信息明确，但增加供应商锁定风险。
2. **允许 prompt directly进入生产**：降低治理成本，但no法保证质量、合规和security。
3. **成本only作为报table展示**：实现简单，但成本no法参vs执lines前守卫和执lines后优化。
4. **采用本Decision**：统一治理 AI 运营层，确保质量、security、合规和成本可控。

## 交叉references用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-088 平台table面、communicationvs扩展性](./088-platform-surface-communication-and-extensibility.md)

## 来源章节

- `§15 LLM Provider`
- `§16 Prompt`
- `§17 Eval`
- `§18 Cost`
- `§21 HITL`
- `§23 Compliance`
- `§27 SLO`
