# ADR-009 Deployment and Operations

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Historical Context (see v4.3 runtime/operations baseline)
- Decision Date: 2026-04-02

## Background

The platform needs to support both local CLI/TUI and server-side HTTP/Telegram/Web modes, while also meeting crash recovery, observability, config hot reload, and subsequent multi-tenant expansion. Therefore, deployment and operations cannot only consider single-machine happy path.

## Decision

Adopt TypeScript full stack + phased infrastructure evolution path:

- Core service layer unified in `src/core/`.
- Access layer includes CLI, TUI, HTTP Server, Gateway, and Embedded Client.
- Early persistence uses SQLite + WAL.
- Supports crash recovery via structured events, workflow state, artifact storage, and recovery algorithms.
- Use Feature Flag to control phased feature enablement, avoiding immature capabilities prematurely coupling to main path.

## Project Structure Principles

Code structure should revolve around responsibility boundaries:

- `core/`: Runtime, tools, provider, session, storage, security, supervisor, memory.
- `divisions/`: Division definitions and role prompts.
- `tools/`: Built-in tools, collaboration tools, and specialized tools.
- `gateway/`: Multi-channel access.
- `server/`: HTTP API.
- `cli/`: CLI and TUI.
- `perception/`: Proactive perception module.

## Storage and Recovery

Phase 1-2 uses SQLite, but must acknowledge its boundaries:

- Use WAL to improve read/write concurrency.
- Avoid letting high-frequency data like heartbeat directly write to database.
- Events and tool usage use batch or async writes.
- Explicitly cap concurrent active Agents.

To support recovery, at minimum need:

- Tasks table.
- workflow_state.
- workflow_step_outputs.
- sessions/messages.
- events.
- artifacts index.

## Access and API

Platform access layer includes at minimum:

- CLI and TUI.
- HTTP API.
- SSE streaming events.
- Embedded Client.
- Gateway bridging Telegram, subsequent expansion to Slack/Feishu.

These entry points should share the same service layer, not copy business logic.

## Configuration and Feature Flags

Configuration system should support:

- YAML configuration.
- Environment variable interpolation.
- Configuration version migration.
- Config hot reload.
- Feature Flag controlling phased capabilities.

In production builds, Feature Flag can further be used for compile-time DCE to reduce unused feature size.

## Testing and Observability

Operations design must include testing and observability:

- Testing pyramid and LLM mock.
- VCR/record-replay testing.
- Structured logging.
- Core KPI and debugging log infrastructure.
- Boundary testing to verify architecture and permission layers are not bypassed.

## Evolution Path

- Phase 1-2: SQLite single-machine architecture, explicitly acknowledge concurrency cap.
- Phase 3: Enhanced channels, authentication, Web, and commercialization infrastructure.
- Phase 4: Migrate to PostgreSQL, multi-tenant, queue system, and stronger enterprise capabilities.

## Results

Benefits:

- Fast development speed, suitable for early single-person + AI team progression.
- Reuse CLI, HTTP, Embedded Client through unified service layer.
- Clear migration path, avoiding early over-engineering.

Costs:

- SQLite concurrency cap must be hard-acknowledged in documentation and runtime.
- Phase migration needs strong testing and compatibility constraints, otherwise subsequent upgrade cost will be high.
- Prematurely adding Web, multi-tenant, and commercialization capabilities will significantly drag infrastructure maturity speed.

## Cross-References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
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