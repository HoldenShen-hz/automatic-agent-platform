# Knowledge Boundary And Federated Search Contract

## 1. Scope

This contract defines knowledge domain isolation for `§50`, federated search, and Chinese Wall constraints.

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
- Federated search audit must simultaneously record boundary, tenant, and runtime lineage, must not only record org dimension.

## 6. Test Requirements

- unit: boundary resolution, share grant, Chinese Wall checks
- integration: federated search with mixed allow / deny boundaries
- contract: unauthorized cross-boundary retrieval must not return original content

## v4.3 Contract Remediation

- T-74: This document originally only required requester/query/boundary without enforcing tenant and runtime chain audit. Root cause: knowledge boundary contract was designed from organizational isolation perspective; subsequent multi-tenant runtime lineage was not supplemented. Fix: The text now requires `requester_tenant_id / harness_run_id / node_run_id` to enter federated search request and audit chain.
