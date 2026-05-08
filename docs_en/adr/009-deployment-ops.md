# ADR-009 Deployment and Operations

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-phase cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform must support both local CLI/TUI and server-side HTTP/Telegram/Web modes, and also meet crash recovery, observability, config hot-reload, and future multi-tenant scaling. Therefore, deployment and operations cannot consider only single-machine happy path.

## Decision

Adopt TypeScript full-stack with phased infrastructure evolution:

- Core service layer uniformly placed in `src/core/`.
- Access layer includes CLI, TUI, HTTP Server, Gateway, and Embedded Client.
- Early persistence uses SQLite + WAL.
- Support crash recovery via structured events, workflow state, artifact storage, and recovery algorithms.
- Use Feature Flags to control phased capability enablement, avoiding premature coupling of immature capabilities to main path.

## Project Structure Principles

Code structure should be organized around responsibility boundaries:

- `core/`: Runtime, tools, provider, session, storage, security, supervisor, memory.
- `divisions/`: Division definitions and role prompts.
- `tools/`: Built-in tools, collaboration tools, and specialized tools.
- `gateway/`: Multi-channel access.
- `server/`: HTTP API.
- `cli/`: CLI and TUI.
- `perception/`: Proactive perception module.

## Storage and Recovery

Phase 1-2 uses SQLite but must acknowledge its boundaries:

- Use WAL to improve read/write concurrency.
- Avoid having heartbeat and other high-frequency data directly write to DB.
- Events and tool usage adopt batch or async writes.
- Explicitly state concurrent active Agent upper limit.

To support recovery, at minimum need:

- Task table.
- workflow_state.
- workflow_step_outputs.
- sessions/messages.
- events.
- Artifacts index.

## Access and API

Platform access layer includes at minimum:

- CLI and TUI.
- HTTP API.
- SSE streaming events.
- Embedded Client.
- Gateway bridging Telegram; Slack/Feishu expansion later.

These entry points should share the same service layer, not duplicate business logic.

## Configuration and Feature Flags

Configuration system should support:

- YAML configuration.
- Environment variable interpolation.
- Configuration version migration.
- Config hot-reload.
- Feature Flag controlling phased capabilities.

In production builds, Feature Flags can further enable compile-time DCE to reduce unused capability size.

## Testing and Observability

Operations design must include testing and observability:

- Testing pyramid and LLM mock.
- VCR/record-replay testing.
- Structured logging.
- Core KPI and debug logging infrastructure.
- Boundary testing, verifying architecture and permission layers are not bypassed.

## Evolution Roadmap

- Phase 1-2: SQLite single-machine architecture; explicit concurrency limits.
- Phase 3: Enhanced channels, authentication, Web, and commercialization infrastructure.
- Phase 4: Migrate to PostgreSQL, multi-tenant, queue system, and stronger enterprise capabilities.

## Consequences

Advantages:

- Fast development speed; suitable for early solo + AI team progress.
- Unified service layer reuses CLI, HTTP, Embedded Client.
- Migration path is explicit; avoids early over-engineering.

Costs:

- SQLite concurrency upper limit must be hard-acknowledged in documentation and runtime.
- Phase migration needs strong testing and compatibility constraints; otherwise subsequent upgrade costs will be high.
- Premature addition of Web, multi-tenant, and commercialization capabilities significantly slows infrastructure maturity.

## Cross-References

- [ADR-001 Three-Layer Separation of Authority](./001-three-layer-architecture.md)
- [ADR-005 Security Model](./005-security-model.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

- `§3`
- `§3.2`
- `§3.3`
- `§3.4`
- `§3.5`
- `§3.6`
- `§3.7`
- `§3.8`
- `§9`
- `§12`
