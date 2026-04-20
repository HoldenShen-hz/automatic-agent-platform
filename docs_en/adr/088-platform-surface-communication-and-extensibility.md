# ADR 088: Platform Surface, Communication, and Extensibility

## Status

Accepted

## Date

2026-04-20

## Context

[`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) `§6`, `§7`, `§8`, `§22`, and `§30` define API, service communication, extensibility, SDK/DX, and Business Pack / Plugin governance. These sections were previously scattered across API, event bus, plugin SPI, and tool/skill/plugin contracts, but lacked a unified ADR explaining why these boundaries must be governed as platform surface capabilities.

## Decision

Platform surface capabilities are governed by the following unified boundaries:

- External requests must first enter Interface Plane such as API / Gateway / Webhook / Scheduler, and must not directly enter the execution layer.
- Inter-plane communication must prioritize contractual envelope, typed event, and outbox / DLQ mechanisms; implicit shared state is not allowed.
- Extension capabilities must enter the platform through Plugin SPI, Tool / Skill / Plugin contracts, and Business Pack lifecycle.
- SDK / DX only provides controlled access capabilities, and does not provide shortcuts that bypass policy, approval, sandbox, or budget.
- Business Pack must declare domain, capability, risk, tool bundle, and API compatibility, and is subject to the same extension governance constraints.

## Trade-offs

- Do not create a separate ADR for each API or SDK action to avoid architecture decision fragmentation.
- Do not write extension runtime implementation details into ADRs; fields, state, and failure semantics go into contracts.
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

- contract tests: API / event / gateway envelope must not bypass contracts.
- integration tests: event bus, plugin lifecycle, and marketplace install / publish flows must be able to run across boundaries.
- denial tests: Unauthenticated, unauthorized, unverified, and undeclared capability extensions must not enter the production execution chain.
