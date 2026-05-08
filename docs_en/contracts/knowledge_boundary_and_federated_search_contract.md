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

## 6. Test Requirements

- unit: boundary resolution, share grant, Chinese Wall checks
- integration: federated search with mixed allow / deny boundaries
- contract: unauthorized cross-boundary retrieval must not return original content
