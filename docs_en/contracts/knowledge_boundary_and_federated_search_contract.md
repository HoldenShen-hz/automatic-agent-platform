# Knowledge Boundary And Federated Search Contract

## 1. Scope

This contract defines knowledge domain isolation, federated search, and Chinese Wall constraints for `§50`.

## 2. Canonical Objects

- `KnowledgeBoundary`
- `KnowledgeShareGrant`
- `FederatedSearchRequest`
- `FederatedSearchResult`
- `AccessLogRecord`
- `ChineseWallConstraint`

## 3. `KnowledgeBoundary` Minimum Fields

- `boundary_id`
- `owner_org_node_id`
- `namespace_ids`
- `default_visibility`
- `classification_rules`
- `share_policy`

## 4. Federated Search

`FederatedSearchRequest` minimum fields:

- `requester`
- `requester_tenant_id`
- `harness_run_id`
- `node_run_id?`
- `query`
- `allowed_boundaries`
- `purpose`
- `max_sources`

`FederatedSearchResult` must return:

- `matched_sources`
- `redacted_fields`
- `denied_boundaries`
- `audit_ref`

## 5. Security Rules

- Default deny cross-boundary access.
- Sharing must go through `KnowledgeShareGrant` or explicit policy.
- Requests hitting Chinese Wall must be blocked and audited.
- Federated search audit must simultaneously record boundary, tenant, and runtime lineage; must not record only org dimension.

## 6. Test Requirements

- unit: boundary resolution, share grant, Chinese Wall checks
- integration: federated search with mixed allow / deny boundaries
- contract: unauthorized cross-boundary retrieval must not return original content

## v4.3 Contract Remediation

- T-74: This document previously only required requester/query/boundary, without enforcing tenant and runtime chain audit. The root cause is the knowledge boundary contract was designed from organizational isolation perspective; subsequent multi-tenant runtime lineage was not added. Fix: The main text now requires `requester_tenant_id / harness_run_id / node_run_id` to enter federated search requests and audit chain.