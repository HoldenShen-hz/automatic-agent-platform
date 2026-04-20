# Knowledge Boundary And Federated Search Contract

## 1. 范围

本 contract 定义 `§50` 的知识域隔离、联邦搜索和 Chinese Wall 约束。

## 2. Canonical 对象

- `KnowledgeBoundary`
- `KnowledgeShareGrant`
- `FederatedSearchRequest`
- `FederatedSearchResult`
- `AccessLogRecord`
- `ChineseWallConstraint`

## 3. `KnowledgeBoundary` 最小字段

- `boundary_id`
- `owner_org_node_id`
- `namespace_ids`
- `default_visibility`
- `classification_rules`
- `share_policy`

## 4. 联邦搜索

`FederatedSearchRequest` 最小字段：

- `requester`
- `query`
- `allowed_boundaries`
- `purpose`
- `max_sources`

`FederatedSearchResult` 必须返回：

- `matched_sources`
- `redacted_fields`
- `denied_boundaries`
- `audit_ref`

## 5. 安全规则

- 默认 deny cross-boundary 访问。
- 共享必须通过 `KnowledgeShareGrant` 或显式 policy。
- 命中 Chinese Wall 的请求必须被阻断并审计。

## 6. 测试要求

- unit：boundary resolution、share grant、Chinese Wall checks
- integration：federated search with mixed allow / deny boundaries
- contract：未授权的跨边界检索不得返回原始内容

