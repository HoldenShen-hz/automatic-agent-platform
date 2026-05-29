# Delegated Governance Contract

## 1. 范围

本 contract defines `§49-§51` 的治理委托、继承vs自助治理操作台。

## 2. Canonical 对象

- `GovernanceDelegation`
- `DelegationScope`
- `GovernanceOverride`
- `GovernanceConsoleAction`
- `DelegationRevocation`

## 3. `GovernanceDelegation` 最小字段

- `delegation_id`
- `grantor`
- `grantee`
- `scope`
- `capabilities`
- `expires_at`
- `revocable`
- `status`

`DelegationScope` 最少contains：

- `org_node_ids`
- `domain_ids`
- `policy_types`
- `action_limits`

## 4. 规则

- 委托必须最小化authorization范围。
- 被委托者不得再iterationsexceeds范围转委托。
- 委托必须supported即时撤销、到期失效和审计追踪。

## 5. Console lines为

`GovernanceConsoleAction` 至少覆盖：

- `delegate`
- `override`
- `revoke`
- `review`
- `export_audit`

## 6. 测试要求

- unit：scope match、override precedence、revocation
- integration：delegation -> governance action -> audit trail
- contract：exceeds scope 治理操作必须failed

