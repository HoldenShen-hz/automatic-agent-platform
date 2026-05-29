# ADR-048 Enterprise SSO/SCIM Integration Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Enterprises need to integrate with existing Identity Providers (IdP) to achieve single sign-on and automated user lifecycle management.

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

All user lifecycle operations use prepare/commit/compensate semantics and record audit logs:

| Phase | Onboarding | Transfer | Offboarding |
|-------|------------|----------|--------------|
| prepare | Validate IdP credentials, pre-allocate account, check quota | Get current permissions, generate change list | Backup data, generate permission recovery list |
| commit | Create account, join default group, send welcome notification | Update organization info, sync permission changes | Disable account, recover permissions, export data |
| compensate | Rollback account creation, send exception notification | Rollback organization info, rollback permission changes | Restore account, unfreeze permissions (emergency) |

Audit log records: operation type, operator, timestamp, before/after state, compensate action execution results.

### Sync Strategy

- Real-time sync: SCIM webhook
- Periodic sync: Incremental sync job
- On-demand sync: Manual trigger

## Consequences

Advantages:

- SSO improves user experience and security
- SCIM automates user management
- Reduces manual operations

Trade-offs:

- IdP integration complexity
- Sync delay may cause permission issues

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Section

- `§48` Enterprise SSO/SCIM Integration Architecture