# Delegated Governance Contract

## 1. Scope

This contract defines `§49-§51` governance delegation, inheritance, and self-service governance console.

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

`DelegationScope` must include at minimum:

- `org_node_ids`
- `domain_ids`
- `policy_types`
- `action_limits`

## 4. Rules

- Delegation must follow least-privilege authorization scope.
- Delegatee must not re-delegate beyond scope.
- Delegation must support immediate revocation, expiration, and audit tracking.

## 5. Console Behavior

`GovernanceConsoleAction` must cover at minimum:

- `delegate`
- `override`
- `revoke`
- `review`
- `export_audit`

## 6. Test Requirements

- unit: scope match, override precedence, revocation
- integration: delegation -> governance action -> audit trail
- contract: out-of-scope governance operations must fail

