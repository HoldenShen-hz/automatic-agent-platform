# Domain Descriptor And Onboarding Contract

## 1. Scope

This contract defines domain modeling and four-phase onboarding runbook for `§37-§38`, serving as the authoritative boundary for `src/domains/*`.

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

## 3. DomainDescriptor Minimum Fields

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

Rules:

- Each domain must be able to independently explain its own risk, knowledge, evaluation, Prompt, Recipe, and governance boundaries.
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

## 5. Lifecycle Constraints

- `draft -> validating -> certified -> canary -> active -> deprecated -> retired`
- Skipping into `active` is considered a contract violation.
- High-risk domains must default to staying in `canary` and have human approval evidence.

## 6. Runtime Rules

- Runtime can only activate `active` or controlled `canary` domains.
- Domains must first pass registry schema validation before sinking to prompts, tools, workflows.
- Domain changes must carry version and compatibility strategy.

## 7. Test Requirements

- unit: descriptor schema, lifecycle transition, runbook evidence validation
- integration: domain registration, domain loading, domain upgrade /下线
- contract: uncertified domains are prohibited from entering runtime
