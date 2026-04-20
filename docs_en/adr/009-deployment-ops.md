# ADR-009 Deployment and Operations

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform must support local CLI/TUI, but also server-side HTTP/Telegram/Web modes, and also meet crash recovery, observability, configuration hot reload, and subsequent multi-tenant expansion. Therefore, deployment and operations cannot only consider single-machine happy path.

## Decision

Adopt TypeScript full-stack + phased infrastructure evolution roadmap:

- Core service layer unified in `src/core/`.
- Access layer includes CLI, TUI, HTTP Server, Gateway, and Embedded Client.
- Early persistence uses SQLite + WAL.
- Support crash recovery through structured events, workflow state, artifact storage, and recovery algorithms.
- Use Feature Flag to control phased capability enablement, avoiding premature coupling of immature capabilities to main path.

## Project Structure Principles

Code structure should be organized around responsibility boundaries:

- `core/`: Runtime, tools, provider, session, storage, security, supervisor, memory.
- `divisions/`: Division definitions and role prompts.
- `tools/`: Built-in tools, collaboration tools, and specialized tools.
- `gateway/`: Multi-channel access.
- `server/`: HTTP API.
- `cli/`: CLI and TUI.
- `perception/`: Active perception module.

## Storage and Recovery

Phase 1-2 uses SQLite but must acknowledge its boundaries:

- Use WAL to improve read/write concurrency.
- Avoid letting high-frequency data like heartbeat directly write to database.
- Events and tool usage adopt batch or async write.
- Clearly define upper limit for concurrent active Agents.

To support recovery, at least need:

- Task table.
- workflow_state.
- workflow_step_outputs.
- sessions/messages.
- events.
- artifacts index.

## Access and API

Platform access layer includes at least:

- CLI and TUI.
- HTTP API.
- SSE streaming events.
- Embedded Client.
- Gateway bridging Telegram, subsequently expanding to Slack/Feishu.

These entry points should share the same service layer rather than duplicating business logic.

## Configuration and Feature Flags

Configuration system should support:

- YAML configuration.
- Environment variable interpolation.
- Configuration version migration.
- Configuration hot reload.
- Feature Flag controlling phased capabilities.

In production builds, Feature Flag can further be used for compile-time DCE to reduce unused feature bundle size.

## Testing and Observability

Operations design must include testing and observation:

- Testing pyramid and LLM mock.
- VCR/record-replay testing.
- Structured logging.
- Core KPI and debug logging infrastructure.
- Boundary testing to verify architecture and permission layers are not bypassed.

## Evolution Roadmap

- Phase 1-2: SQLite single-machine architecture, clearly define concurrency limits.
- Phase 3: Enhanced channels, authentication, Web, and commercialization infrastructure.
- Phase 4: Migrate to PostgreSQL, multi-tenant, queue system, and stronger enterprise capabilities.

## Results

Benefits:

- Fast development speed, suitable for early single-person + AI team advancement.
- Unified service layer reused across CLI, HTTP, Embedded Client.
- Migration path is clear, avoiding early over-engineering.

Costs:

- SQLite concurrency limits must be hard-documented and acknowledged at runtime.
- Phase migration requires strong testing and compatibility constraints, otherwise subsequent upgrade costs will be high.
- If Web, multi-tenant, and commercialization capabilities are added too early, it will significantly slow down infrastructure maturity.

## Cross-References

- [ADR-001 Three-Layer Distributed Architecture](./001-three-layer-architecture.md)
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
