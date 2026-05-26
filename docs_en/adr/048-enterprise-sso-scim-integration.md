# ADR-048 Enterprise SSO/SCIM Integration Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises need to integrate with existing identity providers (IdP) to achieve single sign-on and automated user lifecycle management.

## Decision

### SSO Support

| Protocol | Description |
|----------|-------------|
| SAML 2.0 | Common for enterprise IdP |
| OIDC | Recommended for modern applications |
| OAuth 2.0 | Third-party authorization |

### SCIM Support

```typescript
interface SCIMUser {
  user_id: string;
  emails: string[];
  name: Name;
  active: boolean;
  groups: string[];
}

interface SCIMGroup {
  group_id: string;
  name: string;
  members: string[];
}
```

### User Lifecycle (Saga Pattern)

All user lifecycle operations use prepare/commit/compensate semantics with audit logging:

| Phase | Onboarding | Transfer | Offboarding |
|-------|------------|----------|-------------|
| prepare | Verify IdP credentials, pre-allocate account, check quota | Get current permissions, generate change list | Backup data, generate permission recovery list |
| commit | Create account, join default group, send welcome notification | Update organization info, sync permission changes | Disable account, recover permissions, export data |
| compensate | Rollback account creation, send exception notification | Rollback organization info, rollback permission changes | Restore account, unfreeze permissions (emergency only) |

Audit logging records: operation type, operator, timestamp, pre/post state changes, compensation action execution results.

### Sync Strategies

- Real-time sync: SCIM webhook
- Periodic sync: Incremental sync job
- On-demand sync: Manual trigger

## Consequences

Pros:

- SSO improves user experience and security
- SCIM automates user management
- Reduces manual operations

Cons:

- IdP integration complexity
- Sync delay may cause permission issues

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security and Reliability Architecture](./027-security-architecture.md)

## Source Sections

- `§48` Enterprise SSO/SCIM Integration Architecture