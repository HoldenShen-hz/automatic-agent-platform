# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Domain signals, knowledge structure, and risk profile inputs
- **Assess**: Domain risk assessment and access review
- **Plan**: Domain templates, domain workflows, and onboarding runbooks
- **Execute**: Expose tools/plugins/knowledge by domain boundary
- **Feedback**: Domain-level feedback, metrics, and production validation
- **Learn**: Domain pattern accumulation and domain template refinement
- **Improve**: Domain bundle, prompt, and recipe improvement candidates
- **Release**: Domain package canary, certification, and production release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§37-§38` requires the platform to no longer treat business domains as opaque business packages, but instead use `DomainDescriptor` as a structured governance unit, unifying risk profiles, knowledge structures, evaluation frameworks, prompt libraries, recipes, and cross-domain interaction policies.

The current repository already has the `src/domains/*` directory and initial implementation of `src/domains/registry/*`, but authoritative decisions are still missing, leading to:

- Domain definition fields and lifecycle are not unified
- Onboarding runbooks can only rely on verbal agreements
- Many directories in `src/domains/*` remain as empty shell barrels

## Decision

### 1. `DomainDescriptor` as the Domain's Authoritative Root Object

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

The onboarding process is fixed as:

1. Domain Modeling
2. Development Verification
3. Security Certification
4. Canary Release

Any new domain must leave structured evidence, not just submit code directories.

### 3. Domain is the Unified Boundary for Bundle, Knowledge, Evaluation, and Governance

The following capabilities must all be attached to a domain:

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

Then supplement business-specific implementations, avoiding "write code first, add boundaries later".

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design from `§37-§38` will no longer be scattered across multiple parallel documents
- Domain onboarding upgrades from "convention-based integration" to "contract-based onboarding"
