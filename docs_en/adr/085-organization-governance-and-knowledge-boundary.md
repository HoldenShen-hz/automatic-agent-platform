# ADR-085 Organization Governance And Knowledge Boundary

---

## OAPEFLIR Relationship

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Organization structure, identity, knowledge boundary, and compliance signal collection
- **Assess**: Approval chain, knowledge sharing, governance delegation, and compliance matching
- **Plan**: Organization routing, inheritance/override, controlled sharing strategy
- **Execute**: SSO, SCIM, approval routing, knowledge isolation, governance console
- **Feedback**: Approval timeout, access denial, sharing review
- **Learn**: Organization governance rules and boundary strategy optimization
- **Improve**: Department-level compliance and governance configuration continuous evolution
- **Release**: Organization governance change staged rollout

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

But most directories are still empty barrel stubs, lacking unified decisions.

## Decisions

### 1. Organization Node is the Common Root Object for Governance, Approval, Knowledge, and Compliance

Organization model must support at minimum:

- enterprise
- business_unit
- department
- team
- seat / user

### 2. Approval, Compliance, and Knowledge Boundary All Follow "Inheritance First, Explicit Override"

Default rules are inherited from parent nodes;
Child nodes can only override within authorized scope.

### 3. SSO / SCIM is Only Responsible for Identity Sync, Does Not Directly Grant Business Permissions

Identity access and governance authorization are separated to avoid directory systems directly bypassing permissions.

### 4. Knowledge Sharing Must Explicitly Declare Boundaries and Audit

Cross-department knowledge access must include:

- sharing policy
- purpose
- approver / policy source
- access log

### 5. Governance Delegation Must Be Revocable, Auditable, and Scope-Limited

Governance delegation is not a permanent transfer, but a controlled authorization with scope, TTL, and revoke.

## Consequences

- Organization governance layer will become the unified upper boundary for `tenant / division / policy / knowledge`
- Subsequent implementation prioritizes organization model, approval routing, and knowledge boundary contract and state machine testing
