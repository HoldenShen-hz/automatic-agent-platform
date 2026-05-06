# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Domain signals, knowledge structure, and risk profile input
- **Assess**: Domain risk assessment and onboarding review
- **Plan**: Domain templates, domain workflows, and onboarding runbooks
- **Execute**: Expose tools/plugins/knowledge by domain boundary
- **Feedback**: Domain-level feedback, effectiveness metrics, and production validation
- **Learn**: Domain pattern accumulation and domain template correction
- **Improve**: Domain bundle, prompt, and recipe improvement candidates
- **Release**: Domain package canary, certification, and production launch

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v4.3 `§37-§38` requires the platform to no longer treat business domains as opaque business packages, but instead use `DomainDescriptor` as a structured governance unit, unifying risk profile, knowledge structure, evaluation framework, Prompt library, Recipe, and cross-domain interaction strategy.

The current repository already has `src/domains/*` directory and initial implementation of `src/domains/registry/*`, but authoritative decisions are still missing, leading to:

- Inconsistent domain definition fields and lifecycle
- Onboarding runbooks relying on verbal agreements
- Many `src/domains/*` directories still remain as empty shells barrel

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

The onboarding process is fixed as:

1. Domain Modeling
2. Development Validation
3. Security Certification
4. Canary Launch

Any new domain must leave structured evidence, not just submit code directories.

### 3. Domain is the Unified Boundary for Bundle, Knowledge, Evaluation, and Governance

The following capabilities must be anchored to a domain:

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. Domain Onboarding Prioritizes Constraints, Then Allows Extension

When adding new domains, first supplement:

- contract
- schema
- registry / validation
- smoke test

Then supplement business-specific implementation, avoiding "write code first, add boundaries later."

## Consequences

- Subsequent implementation of `src/domains/*` must converge around `DomainDescriptor`
- Design of `§37-§38` is no longer scattered across multiple parallel documents
- Domain onboarding upgraded from "agreement-based integration" to "contract-based onboarding"
