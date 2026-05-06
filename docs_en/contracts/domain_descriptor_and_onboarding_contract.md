# Domain Descriptor And Onboarding Contract

## 1. Scope

This contract defines domain modeling for `§37-§38` and the four-phase onboarding runbook, serving as the authoritative boundary for `src/domains/*`.

## 2. Canonical Objects

- `DomainDescriptor`
- `DomainRiskProfile`
- `DomainKnowledgeSchema`
- `DomainEvalFramework`
- `DomainPromptLibrary`
- `DomainRecipe`
- `DomainInteractionPolicy`
- `DomainGovernancePolicy`
- `DomainOnboardingRecord`

## 3. `DomainDescriptor` Minimum Fields

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
- `latency_tier`: `low | medium | high | latency_insensitive`

Rules:

- Each domain must be able to independently explain its risk, knowledge, evaluation, Prompt, Recipe, and governance boundaries.
- Domains must not directly reference unregistered workflows, tool bundles, plugins, or namespaces.

## 4. Onboarding Four Phases

`DomainOnboardingRecord.phase` is fixed as:

1. `modeling`
2. `development_validation`
3. `security_certification`
4. `canary_launch`

Each phase records at minimum:

- `phase`
- `status`
- `owner`
- `started_at`
- `completed_at?`
- `evidence_artifact_ids`
- `blocking_findings`
- `approver?`

## 5. `DomainRiskProfile` Minimum Fields

- `risk_profile_id`
- `risk_level`
- `advisory_only`
- `human_accountable`
- `deterministic_hot_path_only`
- `allowed_capability_overrides`
- `required_approval_policies`
- `evidence_requirements`

Rules:

- High / `critical` risk domains must explicitly declare `advisory_only`, `human_accountable`, `deterministic_hot_path_only`; these three must not be omitted.
- `risk_profile_ref` is not a decorative field; domains without a profile must not enter phases after onboarding `security_certification`.

## 6. `DomainRecipe` Minimum Fields

- `recipe_id`
- `display_name`
- `risk_profile_ref`
- `guardrail_overlay`
- `recommended_workflow_ids`
- `recommended_tool_bundle_ids`
- `default_prompt_bundle_ref`
- `acceptance_checklist_ref`

Rules:

- `risk_profile_ref` must point to a registered `DomainRiskProfile` and cannot be replaced with inline free text.
- `guardrail_overlay` must explicitly declare domain constraints added or tightened on top of the platform baseline, and cannot be an empty object.

## 7. Lifecycle Constraints

- `draft -> validating -> certified -> canary -> active -> deprecated -> retired`
- Skipping levels to enter `active` is considered a contract violation.
- High-risk domains must by default stay in `canary` and have human approval evidence.

## 8. Runtime Rules

- Runtime can only activate `active` or controlled `canary` domains.
- Before domain sinks to prompt, tool, workflow, it must first pass registry schema validation.
- Domain changes must carry version and compatibility strategy.

## 9. Test Requirements

- unit: descriptor schema, lifecycle transition, runbook evidence validation
- integration: domain registration, domain loading, domain upgrade / offline
- contract: Uncertified domains are prohibited from entering runtime



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-11: Recipe structure lacks risk_profile_ref and guardrail_overlay references required by architecture §38. Root cause: early documents only treated recipe as an onboarding convenience template, without treating risk binding and guardrail overlay as first-class contracts. Fix: The text now defines `DomainRecipe` minimum fields, and sets `risk_profile_ref` and `guardrail_overlay` as required.
- T-28: DomainRiskProfile is referenced but required fields are not defined; architecture §3.2 requires high-risk domains to declare advisory_only/human_accountable/deterministic_hot_path_only. Root cause: `DomainRiskProfile` was used as an external reference noun in historical versions without being expanded into a validatable schema. Fix: The text now defines `DomainRiskProfile` minimum fields and requires high-risk domains to explicitly declare three hard constraints.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
