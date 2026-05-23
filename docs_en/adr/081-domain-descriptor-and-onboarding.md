# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Domain signals, knowledge structure, and risk profile input
- **Assess**: Domain risk assessment and onboarding review
- **Plan**: Domain templates, domain workflows, and onboarding runbooks
- **Execute**: Expose tools/plugins/knowledge by domain boundary
- **Feedback**: Domain-level feedback, effectiveness metrics, and launch validation
- **Learn**: Domain pattern accumulation and domain template correction
- **Improve**: Domain bundle, prompt, recipe improvement candidates
- **Release**: Domain package rollout, certification, and launch

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§37-§38` requires the platform to no longer treat business domains as opaque business packages, but to use `DomainDescriptor` as a structured governance unit, unifying risk profile, knowledge structure, evaluation framework, Prompt library, Recipes, and cross-domain interaction strategy.

The current repository already has `src/domains/*` directory and initial implementation of `src/domains/registry/*`, but authoritative decisions are still missing, leading to:

- Inconsistent domain definition fields and lifecycle
- Onboarding runbooks can only rely on verbal agreements
- Most `src/domains/*` directories still停留在空壳 barrel

## Decisions

### 1. `DomainDescriptor` serves as the domain authoritative root object

Each domain must declare at minimum:

- `domainId`
- `displayName`
- `domainVersion`
- `riskProfile`
- `knowledgeSchema`
- `evalFramework`
- `promptLibrary`
- `recipes`
- `interactionPolicy`
- `governancePolicy`
- `lifecycleState`

### 2. Domain onboarding adopts a four-phase fixed runbook

The onboarding process is fixed as:

1. Domain Modeling
2. Development Verification
3. Security Certification
4. Rolling Launch

Any new domain must leave structured evidence, not just submit code directories.

### 3. Domain is the unified boundary for bundle, knowledge, evaluation, and governance

The following capabilities must all be挂靠到 domain:

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. Domain onboarding prioritizes constraints first, then allows extension

When adding new domains, first supplement:

- contract
- schema
- registry / validation
- smoke test

Then supplement business-specific implementation, to avoid "write code first, then fill boundaries".

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design of `§37-§38` will no longer be scattered across multiple parallel documents
- Domain onboarding upgraded from "convention-based integration" to "contract-based onboarding"
