# SSO SCIM And Identity Sync Contract

## 1. Scope

This contract defines enterprise identity access, SCIM synchronization, and user lifecycle automation for `§48`.

## 2. Canonical Objects

- `IdentityProviderConfig`
- `SsoSession`
- `ScimProvisioningEvent`
- `IdentityLink`
- `UserLifecycleEvent`

## 3. `IdentityProviderConfig` Minimum Fields

- `provider_id`
- `protocol`: `oidc | saml | scim`
- `tenant_id`
- `issuer`
- `client_id`
- `attribute_mapping`
- `enabled`

## 4. SCIM / Lifecycle Events

`ScimProvisioningEvent.action` is fixed to:

- `user_created`
- `user_updated`
- `user_disabled`
- `user_deleted`
- `group_updated`

`UserLifecycleEvent.status` is fixed to:

- `pending`
- `active`
- `suspended`
- `disabled`
- `deleted`

## 5. Boundary Rules

- SSO / SCIM only synchronizes identity, groups, and affiliations, and does not directly grant business governance permissions.
- Identity synchronization must be idempotent; duplicate events must not create duplicate principals.
- Disabled identities must trigger session invalidation and automatic revocation of access capabilities.

## 6. Test Requirements

- unit: attribute mapping, identity link, lifecycle transitions
- integration: IdP -> SCIM -> platform identity synchronization
- contract: no active authorization sessions retained after deletion / disable events
