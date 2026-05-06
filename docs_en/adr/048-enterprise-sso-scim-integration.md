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

### User Lifecycle (§2.4 Saga Semantics)

SCIM user lifecycle management follows four-phase Saga semantics:

| Phase | Onboarding | Transfer | Offboarding |
|-------|------------|----------|-------------|
| prepare | Validate IdP user attributes complete, prepare account template | Collect transfer target organization info, prepare permission change list | Freeze account, generate permission recovery list |
| commit | Create account, assign initial roles and default groups | Update organization info, apply new permission configuration | Disable account, recover all permissions |
| compensate | If creation fails, clean up allocated resources | If update fails, rollback to original organization info | If disable fails, retry and log compensation |
| audit | Record account creation event, send welcome notification | Record transfer change, notify old/new managers | Record offboarding handling, trigger security audit |

Note: Saga ensures all user lifecycle operations have idempotency and compensation capabilities, preventing permission inconsistencies from intermediate states.

### Sync Strategy

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

## Cross-references

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Section

- `§48` Enterprise SSO/SCIM Integration Architecture
