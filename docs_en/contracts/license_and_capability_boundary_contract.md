# License And Capability Boundary Contract

## 1. Scope

This contract defines the capability boundary engineering approach for future product forms such as community, professional, and enterprise editions.

Related documents:

- `billing_and_tenant_contract.md`
- `monetization_metering_plane_contract.md`
- `tenant_and_organization_contract.md`
- `feature` flags in `environment_and_configuration_governance_contract.md`

## 2. Goals

- Proactively make capabilities, quotas, concurrency, audit, and multi-tenancy controllable switches.
- Avoid hard-cutting code paths after commercialization.
- Let entitlement decisions enter formal policy / metering closed-loop.

## 3. Capability Boundaries

At minimum, the following dimensions should be controllable in the future:

- feature gate
- quota gate
- concurrency gate
- audit gate
- multitenancy gate
- remote worker gate
- enterprise security gate

## 4. Core Objects

- `LicenseTier`
- `CapabilityBundle`
- `EntitlementDecision`
- `QuotaProfile`
- `CommercialFeatureFlag`

## 5. Rules

- All commercialization capabilities should go through capability checks, not scattered in UI or routes.
- Capability check results must be auditable.
- Trial, downgrade, overdue, and freeze must all have explicit system behavior.
- Product tiering must not break the same contract truth.
- Capability checks must not only take effect at frontend or gateway layer; runtime, API, and admin console must reuse the same judgment results.
- Overdue, freeze, and downgrade must not silently relax existing isolation and audit boundaries.

## 6. Typical Tiers

| Tier | Typical Capabilities |
| --- | --- |
| `community` | Single tenant, local capabilities, basic tools |
| `professional` | More concurrency, more quota, basic audit |
| `enterprise` | Multi-tenant, SSO, audit export, private models, private network deployment |

## 7. Conclusion

Commercial capability boundaries must be engineered early.

Otherwise, the following will occur later:

- Code fork
- Permission drift
- Quota rules scattered
- Enterprise capabilities difficult to safely deploy
