# Delegated Governance Contract

## 1. Scope

This contract defines governance delegation, inheritance, and self-service governance console for `§49-§51`.

## 2. Canonical Objects

- `GovernanceDelegation`
- `DelegationScope`
- `GovernanceOverride`
- `GovernanceConsoleAction`
- `DelegationRevocation`

## 3. `GovernanceDelegation` Minimum Fields

- `delegation_id`
- `grantor`
- `grantee`
- `scope`
- `capabilities`
- `expires_at`
- `revocable`
- `status`

`DelegationScope` minimum contains:

- `org_node_ids`
- `domain_ids`
- `policy_types`
- `action_limits`

## 4. Rules

- Delegation must minimize authorization scope.
- The delegatee must not further delegate beyond scope.
- Delegation must support immediate revocation, expiration, and audit tracking.

## 5. Console Actions

`GovernanceConsoleAction` covers at minimum:

- `delegate`
- `override`
- `revoke`
- `review`
- `export_audit`

## 6. Test Requirements

- unit: scope match, override precedence, revocation
- integration: delegation -> governance action -> audit trail
- contract: governance operations exceeding scope must fail