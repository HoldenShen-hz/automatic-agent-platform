# ADR-085: Organization Governance And Knowledge Boundary

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Organization structure, identity, knowledge boundary, and compliance signal collection
- **Assess**: Approval chain, knowledge sharing, governance delegation, and compliance matching
- **Plan**: Organization routing, inheritance / override, controlled sharing strategy
- **Execute**: SSO, SCIM, approval routing, knowledge isolation, governance console
- **Feedback**: Approval timeout, access denial, sharing post-mortem
- **Learn**: Organization governance rules and boundary strategy optimization
- **Improve**: Department-level compliance and governance configuration continuous evolution
- **Release**: Organization governance changes staged rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§46-§51` introduces the organization governance layer. The current repository has:

- `src/org-governance/org-model`
- `src/org-governance/approval-routing`
- `src/org-governance/sso-scim`
- `src/org-governance/knowledge-boundary`
- `src/org-governance/delegated-governance`

But most directories are still empty shells with missing unified decisions.

## Decision

### 1. Organization node is the common root object for governance, approval, knowledge, and compliance

Organization model must support at minimum:

- enterprise
- business_unit
- department
- team
- seat / user

### 2. Approval, compliance, and knowledge boundary all follow "inheritance first, explicit override"

Default rules are inherited from upper-level nodes;
Lower-level nodes can only override within authorized scope.

### 3. SSO / SCIM is only responsible for identity sync, not directly granting business permissions

Identity access and governance authorization are separated to avoid directory system privilege escalation.

### 4. Knowledge sharing must explicitly declare boundaries and audit

Cross-department knowledge access must carry:

- sharing policy
- purpose
- approver / policy source
- access log

### 5. Governance delegation must be revocable, auditable, and scope-limited

Governance delegation is not a permanent transfer, but a controlled authorization with scope, TTL, and revoke.

## Consequences

- Organization governance layer will become the unified upper boundary for `tenant / division / policy / knowledge`
- Subsequent implementation prioritizes supplementing contracts and state machine tests for organization model, approval routing, and knowledge boundary