# Domains Directory Contract

`src/domains/` contains domain onboarding, descriptors, registries, and domain-specific remediation logic.

## Rules

- Domain descriptors are the public contract for domain onboarding.
- Shared domain lifecycle state must come from `src/domains/domain-specs.ts`.
- Do not create new incompatible `DomainLifecycleState` definitions.
- Keep domain-specific remediation code scoped to the domain; shared remediation belongs in common domain services.
- Cross-domain dependencies should be explicit in descriptors or registry wiring, not hidden deep imports.

## Governance

The number of domains is expected to grow. Directory size alone is not a defect if each domain remains isolated and registry contracts stay canonical.
