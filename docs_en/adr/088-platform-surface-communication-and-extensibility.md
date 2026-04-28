# ADR 088: Platform Surface, Communication, and Extensibility

## Status

Accepted

## Date

2026-04-20

## Background

[`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) `§6`, `§7`, `§8`, `§22`, `§30` define API, service communication, extensibility, SDK/DX, Business Pack / Plugin governance. These chapters were previously scattered across API, event bus, plugin SPI, tool/skill/plugin contracts, but lacked a unified ADR explaining why these boundaries must be governed as platform surface capabilities.

## Decisions

Platform surface capabilities are uniformly governed by the following boundaries:

- External requests must first enter the Interface Plane via API / Gateway / Webhook / Scheduler, and must not directly enter the execution layer.
- Inter-plane communication must preferentially use contracted envelopes, typed events, outbox/DLQ mechanisms, and must not allow implicit shared state.
- Extension capabilities must enter the platform via Plugin SPI, Tool / Skill / Plugin contracts, and Business Pack lifecycle.
- SDK / DX only provides controlled access capabilities, and does not provide shortcuts that bypass policy, approval, sandbox, and budget.
- Business Pack must declare domain, capability, risk, tool bundle, API compatibility, and is subject to the same extension governance constraints.

## Trade-offs

- Do not create a separate ADR for each type of API or SDK action, to avoid ADR fragmentation.
- Do not write extension runtime implementation details into ADR; fields, states, and failure semantics go into contracts.
- No "internal SDK privileged path" is allowed; all extensions must go through unified authorization, audit, and release boundaries.

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

## Test Requirements

- Contract tests: API / event / gateway envelope must not bypass contract.
- Integration tests: Event bus, plugin lifecycle, marketplace install / publish flow must be able to run across boundaries.
- Denial tests: Extensions that are unauthenticated, unauthorized, unvalidated, or undeclared capability must not enter production execution chain.

## Alternative Options

1. **Create a separate ADR for each API/SDK action**: Avoids architecture decision fragmentation, but leads to ADR count inflation and makes consistency difficult to maintain.
2. **Write extension runtime implementation details into ADR**: More comprehensive information, but ADR becomes bloated, and implementation changes require ADR updates.
3. **Allow "internal SDK privileged path"**: Lowers development barrier, but breaks platform boundaries and increases security risk.
4. **Adopt this decision**: Unified governance of platform surface, balancing extensibility and security.

## Cross-References

- [ADR-066 Plugin SPI Framework](./066-plugin-spi-framework.md)
- [ADR-089 AI Operations Governance and Quality](./089-ai-operations-governance-and-quality.md)

## Source Sections

- `§6 Interface Plane`
- `§7 Platform Contracts`
- `§8 Extensibility`
- `§22 SDK/DX`
- `§30 Business Pack / Plugin`
