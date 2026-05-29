# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Domain signals, knowledge structure, and risk profile inputs
- **Assess**: Domain risk assessment and onboarding review
- **Plan**: Domain templates, domain workflows, and onboarding runbook
- **Execute**: Expose tools/plugins/knowledge by domain boundary
- **Feedback**: Domain-level feedback, effectiveness metrics, and release validation
- **Learn**: Domain pattern沉淀 and domain template refinement
- **Improve**: Domain bundle, prompt, recipe improvement candidates
- **Release**: Domain package canary, authentication, and release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§37-§38` requires the platform to no longer treat business domains as opaque packages, but rather to use `DomainDescriptor` as a structured governance unit, unifying risk profiles, knowledge structures, evaluation frameworks, Prompt libraries, Recipes, and cross-domain interaction policies.

The current repository already has `src/domains/*` directories and initial implementation of `src/domains/registry/*`, but the authoritative decision is still missing, leading to:

- Inconsistent domain definition fields and lifecycle
- Onboarding runbook relying on verbal agreements
- Many directories under `src/domains/*` still停留在空壳barrel

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

The onboarding process is fixed as:

1. Domain Modeling
2. Development & Validation
3. Security Authentication
4. Canary Release

Any new domain must leave structured evidence, not just submit code directories.

### 3. Domain Is the Unified Boundary for Bundle, Knowledge, Evaluation, and Governance

The following capabilities must all be挂靠到domain:

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. Domain Onboarding Prioritizes Constraints, Then Allows Extensions

When adding a new domain, first supplement:

- contract
- schema
- registry / validation
- smoke test

Then supplement business-specific implementation, avoid "write code first, add boundaries later".

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design of `§37-§38` is no longer scattered across multiple parallel documents
- Domain onboarding upgraded from "conventional integration" to "contract-based onboarding"