# ADR-085 Organization Governance And Knowledge Boundary

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Organization structure, identity, knowledge boundary, and compliance signal collection
- **Assess**: Approval chain, knowledge sharing, governance delegation, and compliance matching
- **Plan**: Organization routing, inheritance / override, controlled sharing strategy
- **Execute**: SSO, SCIM, approval routing, knowledge isolation, governance console
- **Feedback**: Approval timeout, access denial, sharing retrospective
- **Learn**: Organization governance rules and boundary strategy optimization
- **Improve**: Department-level compliance and governance configuration continuous evolution
- **Release**: Organization governance changes phased release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§46-§51` introduces the organization governance layer. The current repository already has:

- `src/org-governance/org-model`
- `src/org-governance/approval-routing`
- `src/org-governance/sso-scim`
- `src/org-governance/knowledge-boundary`
- `src/org-governance/delegated-governance`

However, most of these directories are still empty barrel files, lacking unified decisions.

## Decisions

### 1. Organization nodes are the common root object for governance, approval, knowledge, and compliance

The organization model must support at minimum:

- enterprise
- business_unit
- department
- team
- seat / user

### 2. Approval, compliance, and knowledge boundaries all follow "inheritance first, explicit override"

Default rules are inherited from the parent node;
child nodes can only override within authorized scope.

### 3. SSO / SCIM is only responsible for identity synchronization, not directly granting business permissions

Identity access and governance authorization are separated to prevent directory systems from directly bypassing permissions.

### 4. Knowledge sharing must explicitly declare boundaries and audits

Cross-department knowledge access must include:

- sharing policy
- purpose
- approver / policy source
- access log

### 5. Governance delegation must be revocable, auditable, and scope-limited

Governance delegation is not a permanent transfer, but a controlled authorization with scope, TTL, and revoke.

## Consequences

- The organization governance layer will become the unified upper boundary for `tenant / division / policy / knowledge`
- Subsequent implementation will prioritize adding contracts and state machine tests for organization model, approval routing, and knowledge boundary
