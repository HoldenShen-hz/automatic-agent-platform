# Domain Descriptor And Onboarding Contract

## 1. 范围

本 contract 定义 `§37-§38` 的领域建模与四阶段接入 runbook，作为 `src/domains/*` 的 authoritative 边界。

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
- 领域不得直接引用未注册的 workflow、tool bundle、plugin 或 namespace。

## 4. 接入四阶段

`DomainOnboardingRecord.phase` 固定为：

1. `modeling`
2. `development_validation`
3. `security_certification`
4. `canary_launch`

每个阶段最少记录：

- `phase`
- `status`
- `owner`
- `started_at`
- `completed_at?`
- `evidence_artifact_ids`
- `blocking_findings`
- `approver?`

## 5. 生命周期约束

- `draft -> validating -> certified -> canary -> active -> deprecated -> retired`
- 跳级进入 `active` 被视为 contract 违规。
- 高风险领域默认必须在 `canary` 停留，且具备人工审批证据。

## 6. 运行时规则

- runtime 只能激活 `active` 或受控 `canary` 的领域。
- 领域下沉到 prompt、tool、workflow 前，必须先通过 registry schema 校验。
- 领域变更必须携带版本与兼容策略。

## 7. 测试要求

- unit：descriptor schema、lifecycle transition、runbook evidence 校验
- integration：领域注册、领域加载、领域升级 / 下线
- contract：未认证领域禁止进入 runtime

