# ADR-037 Business Domain Modeling and Onboarding Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different business domains (finance, HR, customer service, code development, etc.) vary greatly in risk level, knowledge structure, tool ecosystem, and evaluation criteria. The platform needs a structured domain modeling framework.

## Decision

### DomainDescriptor Interface (14 fields)

```typescript
interface DomainDescriptor {
  domain_id: string;
  name: string;
  description: string;
  domain_class: DomainClass;      // 24 vertical domain types
  risk_profile: DomainRiskProfile;
  knowledge_schema: DomainKnowledgeSchema;
  eval_framework: DomainEvalFramework;
  prompt_library: DomainPromptLibrary;
  recipes: DomainRecipe[];
  interaction_policy: DomainInteractionPolicy;
  governance_policy: DomainGovernancePolicy;
  lifecycle_state: LifecycleState;
  created_at: string;
  updated_at: string;
}
```

### DomainClass 24 Types

| Type | Description |
|------|-------------|
| quant_trading | Quantitative trading |
| ecommerce | E-commerce |
| ad_promotion | Advertising promotion |
| financial_services | Financial services |
| data_processing | Data processing |
| code_development | Code development |
| user_operations | User operations |
| industry_research | Industry research |
| academic_research | Academic research |
| enterprise_knowledge | Enterprise knowledge base |
| finance | Finance |
| legal | Legal |
| live_streaming | Live streaming |
| ad_creative_production | Ad creative production |
| game_development | Game development |
| game_publishing | Game publishing |
| human_resources | Human resources |
| supply_chain_logistics | Supply chain and logistics |
| healthcare | Healthcare |
| education_training | Education and training |
| customer_service | Customer service |
| content_moderation_safety | Content moderation and safety |
| it_ops_sre_devops | IT Ops SRE/DevOps |
| marketing_brand | Marketing and brand |

### Domain Risk Profile

- `domains/risk-profile/`
- Can override platform-level risk_matrix

### Domain Knowledge Schema

- `domains/knowledge-schema/`
- Defines domain knowledge retrieval strategy and timeliness

### Domain Evaluation Framework

- `domains/eval-framework/`
- Defines domain-specific evaluation metrics

### DomainRecipe Template

- `domain-recipe-service.ts` (271 lines)
- 4 archetypes: prototype_analysis/prototype_implementation/prototype_review/prototype_release

### CLI Commands

- `domain init` - initialize
- `domain validate` - validate

## Consequences

Pros:

- Structured modeling enables the platform to understand domain differences
- Override mechanism supports customization
- CLI tools simplify onboarding

Cons:

- DomainDescriptor has high complexity
- Domain modeling requires domain expert participation

## v4.3 ADR Remediation

- A-32: This ADR originally compressed `DomainClass` into 7 broad categories. Root cause: when the domain modeling ADR was formed, it still leaned towards product market segmentation, and did not expand as the main architecture took 24 vertical domains as the unified metamodel instantiation entry point. Fix: The text now converges `DomainClass` to 24 vertical domain types, aligned with the main architecture `§71-§94` domain directory.

## Cross-references

- [ADR-030 Runtime Execution Plane](./030-runtime-execution-plane.md)
- [ADR-038 Business Domain Onboarding Runbook](./038-business-domain-onboarding-runbook.md)

## Source Section

- `§37` Business Domain Modeling and Onboarding Architecture
