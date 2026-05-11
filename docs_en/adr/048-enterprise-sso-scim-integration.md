# ADR-048 Enterprise SSO/SCIM Integration Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Enterprises need to integrate with existing Identity Providers (IdP) to enable Single Sign-On (SSO) and automated user lifecycle management.

## Decision

### SSO Support

| Protocol | Description |
|----------|-------------|
| SAML 2.0 | Common for enterprise IdPs |
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

| Phase | Onboarding | Role Change | Offboarding |
|-------|------------|-------------|-------------|
| prepare | Validate IdP credentials, pre-allocate account, check quota | Fetch current permissions, generate change list | Backup data, generate permission revocation list |
| commit | Create account, join default group, send welcome notification | Update organization info, sync permission changes | Disable account, revoke permissions, export data |
| compensate | Rollback account creation, send error notification | Rollback organization info, rollback permission changes | Restore account, unfreeze permissions (in emergencies) |

Audit log records: operation type, operator, timestamp, state before/after change, compensation action execution result.

### Sync Strategy

- Real-time sync: SCIM webhook
- Periodic sync: Incremental sync job
- On-demand sync: Manual trigger

## Consequences

Benefits:

- SSO improves user experience and security
- SCIM automates user management
- Reduces manual operations

Costs:

- IdP integration complexity
- Sync delays may cause permission issues

## Cross References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Section

- `§48` Enterprise SSO/SCIM Integration Architecture
