# ADR-102 Domain Recipe As Onboarding Accelerator

---

## OAPEFLIR Association

- **Observe**: Gather domain patterns and onboarding requirements
- **Assess**: Choose the best fitting recipe archetype
- **Plan**: Initialize domain workflow and prompt baselines from recipe
- **Execute**: Bootstrap a domain baseline quickly
- **Feedback**: Measure recipe fit
- **Learn**: Evolve archetype templates
- **Improve**: Reduce onboarding time
- **Release**: Recipe is the onboarding baseline

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Blank-slate onboarding leads to repeated reinvention of workflows, prompts, and governance.

## Decision

- New domains must start from a standard `DomainRecipe`
- Recipe acts as the baseline generator for workflow, tools, prompts, and eval

## Consequences

- The 24 domain baselines can be created through a shared model
