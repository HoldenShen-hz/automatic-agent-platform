# ADR 088: Platform Surface, Communication, and Extensibility

- Status: Accepted
- Decision Date: 2026-04-20

## Background

`§6`, `§7`, `§8`, `§22`, `§30` of [`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) define API, service communication, extensibility, SDK/DX, Business Pack/Plugin governance. These sections previously mapped分散到 API, event bus, plugin SPI, tool/skill/plugin contract, but lacked a unified ADR explaining why these boundaries must be governed as unified platform surface capabilities.

## Decision

Platform surface capabilities are governed unified by the following boundaries:

- External requests must first enter Interface Plane such as API / Gateway / Webhook / Scheduler, not directly enter execution layer.
- Inter-plane communication must prioritize contractual envelope, typed event, outbox/DLQ mechanism, not allow implicit shared state.
- Extension capabilities must enter platform via Plugin SPI, Tool/Skill/Plugin contract, Business Pack lifecycle.
- SDK/DX only provides controlled access capability, does not provide shortcuts bypassing policy, approval, sandbox, budget.
- Business Pack must declare domain, capability, risk, tool bundle, API compatibility, and be constrained by same extension governance.

## Trade-offs

- Do not create separate ADR for each API or SDK action to avoid architecture decision fragmentation.
- Do not write extension runtime implementation details into ADR; fields, state, failure semantics go into contracts.
- Do not allow "internal SDK privileged path"; all extensions must pass through unified authorization, audit, and release boundary.

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

- contract tests: API / event / gateway envelope must not bypass contract.
- integration tests: event bus, plugin lifecycle, marketplace install / publish flow must run cross-boundary.
- denial tests: extensions without authentication, authorization, verification, declared capability must not enter production execution chain.

## Alternatives

1. **Create separate ADR for each API/SDK action**: Avoids architecture decision fragmentation, but causes ADR count bloat and is difficult to maintain consistency.
2. **Write extension runtime implementation details into ADR**: More comprehensive information, but ADR becomes bloated and implementation changes require updating ADR.
3. **Allow "internal SDK privileged path"**: Reduces development barrier, but breaks platform boundaries and increases security risk.
4. **Adopt this decision**: Unified platform surface governance, balancing extensibility and security.

## Cross References

- [ADR-071 Plugin SPI Framework](./071-plugin-spi-framework.md)
- [ADR-089 AI Operations Governance and Quality](./089-ai-operations-governance-and-quality.md)

## Source Sections

- `§6 Interface Plane`
- `§7 Platform Contracts`
- `§8 Extensibility`
- `§22 SDK/DX`
- `§30 Business Pack / Plugin`