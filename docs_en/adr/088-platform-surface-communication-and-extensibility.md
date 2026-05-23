# ADR 088: Platform Surface, Communication, and Extensibility

## Status

Accepted

## Date

2026-04-20

## Background

[`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) `§6`, `§7`, `§8`, `§22`, `§30` define API, service communication, extensibility, SDK/DX, Business Pack / Plugin governance. These chapters were previously scattered across API, event bus, plugin SPI, tool/skill/plugin contracts, but lacked a unified ADR explaining why these boundaries must be governed as platform surface capabilities.

## Decision

Platform surface capabilities are uniformly governed by the following boundaries:

- External requests must first enter Interface Plane such as API / Gateway / Webhook / Scheduler, and cannot directly enter the execution layer.
- Inter-plane communication must prioritize contract-based envelopes, typed events, outbox / DLQ mechanisms, and cannot allow implicit shared state.
- Extension capabilities must enter the platform through Plugin SPI, Tool / Skill / Plugin contracts, Business Pack lifecycle.
- SDK / DX only provides controlled access capabilities, and does not provide shortcuts that bypass policy, approval, sandbox, budget.
- Business Pack must declare domain, capability, risk, tool bundle, API compatibility, and is subject to the same extension governance constraints.

## Trade-offs

- Do not create separate ADRs for each API or SDK action to avoid fragmented architecture decisions.
- Do not write extension runtime implementation details into ADRs; fields, states, and failure semantics go into contracts.
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
- `src/platform/five-plane-state-evidence/events/*`
- `src/domains/registry/*`
- `src/plugins/*`
- `src/scale-ecosystem/marketplace/*`

## Testing Requirements

- contract tests: API / event / gateway envelope must not bypass contracts.
- integration tests: event bus, plugin lifecycle, marketplace install / publish flows must be able to run cross-boundary.
- denial tests: Extensions without authentication, authorization, verification, or declared capability must not enter production execution chain.

## Alternatives

1. **Create separate ADRs for each API/SDK action**: Avoids architecture decision fragmentation, but leads to ADR quantity inflation and difficult to maintain consistency.
2. **Write extension runtime implementation details into ADRs**: More comprehensive information, but ADRs become bloated, and implementation changes require updating ADRs.
3. **Allow "internal SDK privileged paths"**: Lowers development threshold, but breaks platform boundaries and increases security risk.
4. **Adopt this decision**: Unifies governance of platform surface, balancing extensibility and security.

## Cross References

- [ADR-071 Plugin SPI Framework](./071-plugin-spi-framework.md)
- [ADR-089 AI Operations Governance and Quality](./089-ai-operations-governance-and-quality.md)

## Source Sections

- `§6 Interface Plane`
- `§7 Platform Contracts`
- `§8 Extensibility`
- `§22 SDK/DX`
- `§30 Business Pack / Plugin`
