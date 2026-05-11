# ADR-102 Domain Recipe As Onboarding Accelerator

---

## OAPEFLIR Association

- **Observe**: Collect domain patterns and onboarding requirements
- **Assess**: Select the most suitable recipe archetype
- **Plan**: Initialize domain workflow and prompts with recipe
- **Execute**: Quickly generate baseline implementation
- **Feedback**: Collect recipe adaptation results
- **Learn**: Iterate archetype templates
- **Improve**: Shorten new domain onboarding cycle
- **Release**: recipe becomes onboarding baseline

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Starting from scratch causes new domains to repeatedly invent workflows, prompts, and governance structures.

## Decision

- New domains must start from a standard `DomainRecipe` archetype
- recipe serves as a workflow/tool/prompt/eval baseline generator

## Consequences

- 24-domain baseline can be quickly landed using a unified model
