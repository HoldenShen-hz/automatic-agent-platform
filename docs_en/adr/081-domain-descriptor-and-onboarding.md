# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Domain signals, knowledge structure, and risk profile input
- **Assess**: Domain risk assessment and onboarding review
- **Plan**: Domain templates, domain workflow, and onboarding runbook
- **Execute**: Expose tools/plugins/knowledge according to domain boundaries
- **Feedback**: Domain-level feedback, effectiveness metrics, and production validation
- **Learn**: Domain pattern precipitation and domain template refinement
- **Improve**: Domain bundle, prompt, and recipe improvement candidates
- **Release**: Domain package rollout, certification, and launch

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§37-§38` requires the platform to no longer treat business domains as opaque business packages, but instead to use `DomainDescriptor` as a structured governance unit, unifying risk profiles, knowledge structures, evaluation frameworks, Prompt libraries, Recipes, and cross-domain interaction strategies.

The current repository already has the `src/domains/*` directory and initial implementation of `src/domains/registry/*`, but the authoritative decision is still missing, leading to:

- Inconsistent domain definition fields and lifecycle
- Onboarding runbook relying on oral agreements
- `src/domains/*` directories still remain as empty shells

## Decision

### 1. `DomainDescriptor` As Domain Authoritative Root Object

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

### 2. Domain Onboarding Uses Four-Phase Fixed Runbook

Onboarding process is fixed as:

1. Domain Modeling
2. Development Verification
3. Security Certification
4. Gray Rollout

Any new domain must leave structured evidence, not just submit code directories.

### 3. Domain Is the Unified Boundary for Bundle, Knowledge, Evaluation, and Governance

The following capabilities must all attach to the domain:

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. Domain Onboarding Priority: Constraints First, Then Extensions

When adding a new domain, first supplement:

- contract
- schema
- registry / validation
- smoke test

Then supplement business-specific implementation, avoid "write code first, fix boundaries later".

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design of `§37-§38` is no longer scattered across multiple parallel documents
- Domain onboarding upgraded from "conventional integration" to "contract-based onboarding"
