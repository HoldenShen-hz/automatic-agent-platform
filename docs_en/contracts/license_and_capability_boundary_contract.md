# License And Capability Boundary Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines how capability boundary engineering works under future product forms such as Community, Professional, and Enterprise editions.

Related documents:

- `billing_and_tenant_contract.md`
- `monetization_metering_plane_contract.md`
- `tenant_and_organization_contract.md`
- `feature` flags in `environment_and_configuration_governance_contract.md`

## 2. Goals

- Make features, quotas, concurrency, audit, and multi-tenant capabilities controllable switches in advance.
- Avoid hard-cutting code paths after commercialization.
- Bring entitlement judgment into the formal policy / metering closed loop.

## 3. Capability Boundaries

In the future, switches can be controlled at least by the following dimensions:

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

- All commercial capabilities should go through capability checks, not scattered in UI or routes.
- Capability check results must be auditable.
- Trial, downgrade, arrears, and freeze must all have clear system behaviors.
- Product tiering must not break the unified contract truth.
- Capability checks must not take effect only at the frontend or gateway layer; runtime, API, and admin console must also reuse the same judgment results.
- Arrears, freeze, and downgrade should not silently relax existing isolation and audit boundaries.

## 6. Typical Tiers

| Tier | Typical Capabilities |
| --- | --- |
| `community` | Single tenant, local capabilities, basic tools |
| `professional` | More concurrency, more quotas, basic audit |
| `enterprise` | Multi-tenant, SSO, audit export, private models, private network deployment |

## 7. Conclusion

Commercial capability boundaries must be engineered as early as possible.

Otherwise, the following will appear later:

- Code forking
- Permission drift
- Scattered quota rules
- Enterprise capabilities difficult to deploy securely