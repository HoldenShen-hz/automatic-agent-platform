# ADR-037 Domain Modeling and Onboarding Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different business domains (finance, HR, customer service, code development, etc.) have huge differences in risk levels, knowledge structures, tool ecosystems, and evaluation standards. The platform needs a structured domain modeling framework.

## Decision

### DomainDescriptor Interface (14 fields)

```typescript
interface DomainDescriptor {
  domain_id: string;
  name: string;
  description: string;
  domain_class: DomainClass;      // 7 types
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

### DomainClass 7 Types

| Type | Description |
|------|-------------|
| code_development | Code development |
| content_creation | Content creation |
| data_analytics | Data analytics |
| customer_service | Customer service |
| finance | Finance |
| hr | Human resources |
| operations | Operations |

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

Positive:
- Structured modeling enables platform to understand domain differences
- Override mechanism supports customization
- CLI tools simplify onboarding

Negative:
- DomainDescriptor complexity is high
- Domain modeling requires domain expert involvement

Trade-offs:
- Structure vs. flexibility
- Standardization vs. customization

## Cross-References

- [ADR-038 Business Domain Onboarding Runbook](./038-business-domain-onboarding-runbook.md)
- [ADR-081 Domain Descriptor and Onboarding](./081-domain-descriptor-and-onboarding.md)

## Source Sections

- `§37` DomainDescriptor Structured Domain Modeling