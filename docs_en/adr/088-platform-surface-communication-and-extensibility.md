# ADR 088: Platform Surface, Communication, and Extensibility

## Status

Accepted

## Date

2026-04-20

## Context

[`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) `§6`, `§7`, `§8`, `§22`, `§30` define API, service communication, extensibility, SDK/DX, and Business Pack / Plugin governance. These chapters were previously scattered across API, event bus, plugin SPI, and tool/skill/plugin contracts, but lacked a unified ADR explaining why these boundaries must be governed as platform surface capabilities.

## Decision

Platform surface capabilities are uniformly governed by the following boundaries:

- External requests must first enter Interface Plane via API / Gateway / Webhook / Scheduler, not directly enter execution layer.
- Inter-plane communication must prioritize contract-based envelopes, typed events, and outbox/DLQ mechanisms; implicit shared state is not allowed.
- Extension capabilities must enter the platform via Plugin SPI, Tool / Skill / Plugin contracts, and Business Pack lifecycle.
- SDK / DX only provides controlled access capabilities, not shortcuts bypassing policy, approval, sandbox, or budget.
- Business Packs must declare domain, capability, risk, tool bundle, and API compatibility, and are constrained by the same extension governance.

## Trade-offs

- Do not create a separate ADR for each API or SDK action, avoiding architecture decision fragmentation.
- Do not write extension runtime implementation details into ADR; fields, states, and failure semantics go into contracts.
- Do not allow "internal SDK privileged paths"; all extensions must go through unified authorization, audit, and release boundaries.

## Impact

Corresponding authoritative contracts:

- `api_surface_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `event_bus_contract.md`
- `typed_event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `plugin_spi_contract.md`
- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
- `license_and_capability_boundary_contract.md`

Corresponding implementation boundaries:

- `src/gateway/*`
- `src/platform/state-evidence/events/*`
- `src/domains/registry/*`
- `src/plugins/*`
- `src/scale-ecosystem/marketplace/*`

## Testing Requirements

- Contract tests: API / event / gateway envelopes must not bypass contracts.
- Integration tests: Event bus, plugin lifecycle, and marketplace install/publish flows must be able to run across boundaries.
- Denial tests: Extensions without authentication, authorization, verification, or declared capability must not enter production execution chain.

## Alternatives

1. **Create a separate ADR for each API/SDK action**: Avoids architecture decision fragmentation but leads to ADR inflation and difficult consistency maintenance.
2. **Write extension runtime implementation details into ADR**: More comprehensive information but makes ADRs bloated, and implementation changes require ADR updates.
3. **Allow "internal SDK privileged paths"**: Lowers development threshold but breaks platform boundaries and increases security risk.
4. **Adopt this decision**: Unify governance of platform surface, balancing extensibility and security.

## Cross-References

- [ADR-066 Plugin SPI Framework](./066-plugin-spi-framework.md)
- [ADR-089 AI Operations Governance and Quality](./089-ai-operations-governance-and-quality.md)

## Source Sections

- `§6 Interface Plane`
- `§7 Platform Contracts`
- `§8 Extensibility`
- `§22 SDK/DX`
- `§30 Business Pack / Plugin`