# ADR-085 Organization Governance And Knowledge Boundary

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Organizational structure, identity, knowledge boundary, and compliance signal collection
- **Assess**: Approval chain, knowledge sharing, governance delegation, and compliance matching
- **Plan**: Organizational routing, inheritance/override, controlled sharing policy
- **Execute**: SSO, SCIM, approval routing, knowledge isolation, governance console
- **Feedback**: Approval timeout, access denial, sharing review
- **Learn**: Organizational governance rules and boundary policy optimization
- **Improve**: Department-level compliance and governance configuration continuous evolution
- **Release**: Organization governance change staged release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§46-§51` introduces the organizational governance layer. The current repository already has:

- `src/org-governance/org-model`
- `src/org-governance/approval-routing`
- `src/org-governance/sso-scim`
- `src/org-governance/knowledge-boundary`
- `src/org-governance/delegated-governance`

However, most directories are still empty shell barrels lacking unified decisions.

## Decision

### 1. Organization nodes are the common root object for governance, approval, knowledge, and compliance

The organization model must support at minimum:

- enterprise
- business_unit
- department
- team
- seat / user

### 2. Approval, compliance, and knowledge boundaries all follow "inheritance first, explicit override"

Default rules are inherited from parent nodes;
child nodes can only override within authorized scope.

### 3. SSO / SCIM is responsible only for identity synchronization, not directly granting business permissions

Identity access and governance authorization are separated to prevent directory systems from directly bypassing permissions.

### 4. Knowledge sharing must explicitly declare boundaries and audit

Cross-department knowledge access must include:

- sharing policy
- purpose
- approver / policy source
- access log

### 5. Governance delegation must be revocable, auditable, and scope-limited

Governance delegation is not a permanent transfer, but a controlled authorization with scope, TTL, and revoke.

## Consequences

- The organizational governance layer will become the unified upper boundary for `tenant / division / policy / knowledge`
- Subsequent implementation prioritizes supplementing contracts and state machine tests for organization model, approval routing, and knowledge boundary
