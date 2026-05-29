# Domain Descriptor And Onboarding Contract

## 1. 范围

本 contract defines `§37-§38` 的领域建模vs四阶段接入 runbook，作为 `src/domains/*` 的 authoritative 边界。

## 2. Canonical 对象

- `DomainDescriptor`
- `DomainRiskProfile`
- `DomainKnowledgeSchema`
- `DomainEvalFramework`
- `DomainPromptLibrary`
- `DomainRecipe`
- `DomainInteractionPolicy`
- `DomainGovernancePolicy`
- `DomainOnboardingRecord`

## 3. `DomainDescriptor` 最小字段

- `domain_id`
- `display_name`
- `description`
- `owner_org_node_id`
- `lifecycle_state`: `draft | validating | certified | canary | active | deprecated | retired`
- `risk_profile_ref`
- `knowledge_schema_ref`
- `eval_framework_ref`
- `prompt_library_ref`
- `recipe_ids`
- `interaction_policy_ref`
- `governance_policy_ref`
- `default_tool_bundle_ids`
- `default_workflow_ids`
- `default_knowledge_namespaces`
- `version`

规则：

- 每个领域必须能独立解释自己的风险、知识、评估、Prompt、Recipe 和治理边界。
- 领域不得directlyreferences用未注册的 workflow、tool bundle、plugin 或 namespace。

## 4. 接入四阶段

`DomainOnboardingRecord.phase` 固定为：

1. `modeling`
2. `development_validation`
3. `security_certification`
4. `canary_launch`

每个阶段最少record：

- `phase`
- `status`
- `owner`
- `started_at`
- `completed_at?`
- `evidence_artifact_ids`
- `blocking_findings`
- `approver?`

## 5. `DomainRiskProfile` 最小字段

- `risk_profile_id`
- `risk_level`
- `advisory_only`
- `human_accountable`
- `deterministic_hot_path_only`
- `allowed_capability_overrides`
- `required_approval_policies`
- `evidence_requirements`

规则：

- `high` / `critical` 风险域必须显式声明 `advisory_only`、`human_accountable`、`deterministic_hot_path_only`，三者不得省略。
- `risk_profile_ref` 不is装饰字段；缺少 profile 的领域不得进入 onboarding `security_certification` 之后的阶段。

## 6. `DomainRecipe` 最小字段

- `recipe_id`
- `display_name`
- `risk_profile_ref`
- `guardrail_overlay`
- `recommended_workflow_ids`
- `recommended_tool_bundle_ids`
- `default_prompt_bundle_ref`
- `acceptance_checklist_ref`

规则：

- `risk_profile_ref` 必须指向已注册 `DomainRiskProfile`，不得以内联自由文本替代。
- `guardrail_overlay` 必须明确声明在平台基线之上附加或收紧的领域约束，不得为空对象。

## 7. 生命cycle约束

- `draft -> validating -> certified -> canary -> active -> deprecated -> retired`
- 跳级进入 `active` 被视为 contract 违规。
- 高风险领域defaults to必须在 `canary` 停留，且具备人工审批证据。

## 8. 运lines时规则

- runtime 只能激活 `active` 或受控 `canary` 的领域。
- 领域下沉到 prompt、tool、workflow 前，必须先via registry schema 校验。
- 领域变更必须携带版本vs兼容策略。

## 9. 测试要求

- unit：descriptor schema、lifecycle transition、runbook evidence 校验
- integration：领域注册、领域加载、领域升级 / 下线
- contract：未authentication领域禁止进入 runtime



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-11: recipe 结构缺少Architecture§38要求的 risk_profile_ref 和 guardrail_overlay references用。Root Cause：早期文档只把 recipe 当作 onboarding 便利模板，没有把风险绑定和 guardrail 叠加层视作一等 contract。修复：正文已defines `DomainRecipe` 最小字段，并将 `risk_profile_ref` vs `guardrail_overlay` 设为必填。
- T-28: DomainRiskProfile 被references用但未definesrequired字段，Architecture§3.2要求高危域声明 advisory_only/human_accountable/deterministic_hot_path_only。Root Cause：`DomainRiskProfile` 在历史版本里被当作外部references用名词uses，没有展开成可校验 schema。修复：正文已defines `DomainRiskProfile` 最小字段，并要求高危域显式声明三项硬约束。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
