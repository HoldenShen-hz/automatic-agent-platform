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

### User Lifecycle

| Event | Auto Action |
|-------|-------------|
| Onboarding | Create account + join default group |
| Transfer | Update organization info |
| Offboarding | Disable account + revoke permissions |

### Sync Strategy

- Real-time sync: SCIM webhook
- Periodic sync: Incremental sync job
- On-demand sync: Manual trigger

## Consequences

Positive:
- SSO improves user experience and security
- SCIM automates user management
- Reduces manual operations

Negative:
- IdP integration complexity
- Sync delay may cause permission issues

Trade-offs:
- Convenience vs. complexity
- Automation vs. control

## Cross-References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-027 Security Architecture](./027-security-architecture.md)

## Source Sections

- `§48` Enterprise SSO/SCIM Integration