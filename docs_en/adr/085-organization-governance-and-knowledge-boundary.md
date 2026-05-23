# ADR-085 Organization Governance And Knowledge Boundary

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Organization structure, identity, knowledge boundary, and compliance signal collection
- **Assess**: Approval chain, knowledge sharing, governance delegation, and compliance matching
- **Plan**: Organization routing, inheritance / override, controlled sharing strategy
- **Execute**: SSO, SCIM, approval routing, knowledge isolation, governance console
- **Feedback**: Approval timeout, access denial, sharing review
- **Learn**: Organization governance rules and boundary strategy optimization
- **Improve**: Department-level compliance and governance configuration continuous evolution
- **Release**: Organization governance changes phased rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative source corresponds to the organization governance and knowledge boundary chapters in `docs_zh/architecture/00-platform-architecture.md`. The current repository already has:

- `src/org-governance/org-model`
- `src/org-governance/approval-routing`
- `src/org-governance/sso-scim`
- `src/org-governance/knowledge-boundary`
- `src/org-governance/delegated-governance`

But most directories are still empty shell barrels, lacking unified decisions.

## Decisions

### 1. Organization node is the common root object for governance, approval, knowledge, and compliance

Organization model supports at minimum:

- enterprise
- business_unit
- department
- team
- seat / user

### 2. Approval, compliance, and knowledge boundary all follow "inheritance first, explicit override"

Default rules inherit from parent node;
Child nodes can only override within authorized scope.

### 3. SSO / SCIM only handles identity sync, does not directly grant business permissions

Identity access and governance authorization are separated to avoid directory system having direct越权.

### 4. Knowledge sharing must explicitly declare boundary and audit

Cross-department knowledge access must include:

- sharing policy
- purpose
- approver / policy source
- access log

### 5. Governance delegation must be revocable, auditable, and scope-limited

Governance delegation is not a permanent transfer, but a controlled authorization with scope, TTL, and revoke.

## Consequences

- Organization governance layer will become unified upper boundary for `tenant / division / policy / knowledge`
- Subsequent implementation prioritizes organization model, approval routing, and knowledge boundary contracts and state machine testing
