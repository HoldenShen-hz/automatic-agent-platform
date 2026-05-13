# ADR-081: Domain Descriptor And Onboarding

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Domain signals, knowledge structure, and risk profile inputs
- **Assess**: Domain risk assessment and onboarding review
- **Plan**: Domain templates, domain workflows, and onboarding runbooks
- **Execute**: Expose tools/plugins/knowledge by domain boundary
- **Feedback**: Domain-level feedback, metrics, and production validation
- **Learn**: Domain pattern accumulation and domain template refinement
- **Improve**: Domain bundle, prompt, and recipe improvement candidates
- **Release**: Domain package staged rollout, certification, and go-live

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§37-§38` requires the platform to no longer treat business domains as opaque business packages, but to use `DomainDescriptor` as a structured governance unit, unifying risk profiles, knowledge structures, evaluation frameworks, Prompt libraries, Recipes, and cross-domain interaction strategies.

The current repository has `src/domains/*` directories and initial implementation of `src/domains/registry/*`, but authoritative decisions are still missing, causing:

- Domain definition fields and lifecycle are not unified
- Onboarding runbooks can only rely on verbal agreements
- Many directories under `src/domains/*` are still empty shells

## Decision

### 1. `DomainDescriptor` is the domain authoritative root object

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

The onboarding flow is fixed as:

1. Domain modeling
2. Development and verification
3. Security certification
4. Staged rollout

Any new domain must leave structured evidence, not just submit code directories.

### 3. Domain is the unified boundary for bundle, knowledge, evaluation, and governance

The following capabilities must all be attached to the domain:

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. Domain onboarding prioritizes constraints first, then allows extension

When adding a new domain, first supplement:

- contract
- schema
- registry / validation
- smoke test

Then supplement business-specific implementations, avoiding "write code first, add boundaries later".

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design of `§37-§38` is no longer scattered across multiple parallel documents
- Domain onboarding upgrades from "convention-based integration" to "contract-based onboarding"