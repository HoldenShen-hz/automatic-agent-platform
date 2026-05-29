# Knowledge Boundary And Federated Search Contract

## 1. 范围

本 contract defines `§50` 的知识域隔离、联邦搜索和 Chinese Wall 约束。

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
- `requester_tenant_id`
- `harness_run_id`
- `node_run_id?`
- `query`
- `allowed_boundaries`
- `purpose`
- `max_sources`

`FederatedSearchResult` 必须返回：

- `matched_sources`
- `redacted_fields`
- `denied_boundaries`
- `audit_ref`

## 5. security规则

- defaults to deny cross-boundary 访问。
- 共享必须via `KnowledgeShareGrant` 或显式 policy。
- 命中 Chinese Wall 的request必须被阻断并审计。
- 联邦搜索审计必须同时record boundary、tenant vs运lines时 lineage，禁止只record org 维度。

## 6. 测试要求

- unit：boundary resolution、share grant、Chinese Wall checks
- integration：federated search with mixed allow / deny boundaries
- contract：未authorization的跨边界检索不得返回原始内容

## v4.3 Contract Remediation

- T-74: 本文原先只要求 requester/query/boundary，没有mandatory tenant vs运lines链审计，Root cause: 知识边界 contract 从组织隔离出发设计，后续多租户 runtime lineage 没有补进来。修复：正文现要求 `requester_tenant_id / harness_run_id / node_run_id` 进入联邦检索requestvs审计链。
