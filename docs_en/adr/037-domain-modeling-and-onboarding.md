# ADR-037 Business Domain Modeling and Onboarding Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Different business domains (finance, HR, customer service, code development, etc.) have huge differences in risk levels, knowledge structures, tool ecosystems, and evaluation standards. The platform needs a structured domain modeling framework.

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
| quant_trading | Quantitative Trading |
| ecommerce | E-commerce |
| ad_promotion | Advertising Promotion |
| financial_services | Financial Services |
| data_processing | Data Processing |
| code_development | Code Development |
| user_operations | User Operations |
| industry_research | Industry Research |
| academic_research | Academic Research |
| enterprise_knowledge | Enterprise Knowledge Base |
| finance | Finance |
| legal | Legal |
| live_streaming | Live Streaming |
| ad_creative_production | Ad Creative Production |
| game_development | Game Development |
| game_publishing | Game Publishing |
| human_resources | Human Resources |
| supply_chain_logistics | Supply Chain and Logistics |
| healthcare | Healthcare |
| education_training | Education and Training |
| customer_service | Customer Service |
| content_moderation_safety | Content Moderation and Safety |
| it_ops_sre_devops | IT Operations SRE/DevOps |
| marketing_brand | Marketing and Brand |

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

- `domain init` - Initialize
- `domain validate` - Validate

## Consequences

Benefits:

- Structured modeling enables platform to understand domain differences
- Override mechanism supports customization
- CLI tools simplify onboarding

Trade-offs:

- DomainDescriptor complexity is high
- Domain modeling requires domain expert involvement

## v4.3 ADR Remediation

- A-32: This ADR originally compressed `DomainClass` into 7 broad categories. The root cause was that when the domain modeling ADR was formed, it still leaned towards product-market groupings and did not expand as the main architecture took the 24 vertical domains as the unified metamodel instantiation entry. Fix: The main text now converges `DomainClass` to 24 vertical domain types and aligns with the domain directory in main architecture sections 71-94.

## Cross-References

- [ADR-030 Runtime Execution Plane](./030-runtime-execution-plane.md)
- [ADR-038 Business Domain Onboarding Runbook](./038-business-domain-onboarding-runbook.md)

## Source Sections

- Section 37
- Section 71-94