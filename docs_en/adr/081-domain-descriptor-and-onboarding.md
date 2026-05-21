# ADR-081: Domain Descriptor And Onboarding

---

## OAPEFLIR Relationship

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Domain signals, knowledge structure, and risk profile inputs
- **Assess**: Domain risk assessment and onboarding review
- **Plan**: Domain templates, domain workflows, and onboarding runbooks
- **Execute**: Expose tools/plugins/knowledge by domain boundary
- **Feedback**: Domain-level feedback, effectiveness metrics, and production validation
- **Learn**: Domain pattern accumulation and domain template correction
- **Improve**: Domain bundle, prompt, and recipe improvement candidates
- **Release**: Domain package rollout, certification, and go-live

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§37-§38` requires the platform to no longer treat business domains as opaque business packages, but instead use `DomainDescriptor` as a structured governance unit that unifies risk profiles, knowledge structures, evaluation frameworks, Prompt libraries, Recipes, and cross-domain interaction strategies.

The current repository already has `src/domains/*` directory and initial implementation of `src/domains/registry/*`, but the authoritative decision is still missing, leading to:

- Domain definition fields and lifecycle not unified
- Onboarding runbooks can only rely on verbal agreements
- Many directories under `src/domains/*` still remain as empty barrel stubs

## Decision

### 1. `DomainDescriptor` as the Domain Authoritative Root Object

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

### 2. Domain Onboarding Uses a Four-Stage Fixed Runbook

The onboarding flow is fixed as:

1. Domain Modeling
2. Development Validation
3. Security Certification
4. Staged Rollout

Any new domain must leave structured evidence, not just submit a code directory.

### 3. Domain is the Unified Boundary for Bundle, Knowledge, Evaluation, and Governance

The following capabilities must all be attached to domains:

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. Domain Onboarding Prioritizes Constraints, Then Allows Extensions

When adding a new domain, first complete:

- contract
- schema
- registry / validation
- smoke test

Then complete business-specific implementation, avoiding "write code first, add boundaries later".

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design in `§37-§38` will no longer be scattered across multiple parallel documents
- Domain onboarding upgraded from "convention-based integration" to "contract-based onboarding"