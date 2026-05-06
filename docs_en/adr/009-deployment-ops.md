# ADR-009 Deployment and Operations

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Release state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Background

The platform must support local CLI / TUI, but also server-side HTTP / Telegram / Web modes, and also meet crash recovery, observability, hot config reload, and future multi-tenant expansion. Therefore, deployment and operations cannot only consider single-machine happy path.

## Decision

Adopt TypeScript full stack + phased infrastructure evolution roadmap:

- Core service layer uniformly placed in `src/platform/` (v4.3 §35 canonical).
- Access layer includes CLI, TUI, HTTP Server, Gateway, and Embedded Client.
- Early persistence uses SQLite + WAL.
- Support crash recovery through structured events, workflow state, artifact storage, and recovery algorithms.
- Use Feature Flag to control phased capability enablement, avoiding premature coupling of immature capabilities to main path.

## Project Structure Principles

Code structure should be organized around responsibility boundaries:

- `platform/`: Runtime, tools, provider, session, storage, security, supervisor, memory (v4.3 §35 canonical).
- `divisions/`: Division definitions and role prompts.
- `tools/`: Built-in tools, collaboration tools, and specialized tools.
- `gateway/`: Multi-channel access.
- `server/`: HTTP API.
- `cli/`: CLI and TUI.
- `perception/`: Proactive perception module.

## Storage and Recovery

Phase 1-2 uses SQLite, but must acknowledge its boundaries:

- Improve read-write concurrency through WAL.
- Avoid having heartbeat and other high-frequency data directly write to database.
- Events and tool usage adopt batch or asynchronous writing.
- Explicitly cap concurrent active agents.

To support recovery, at least need:

- Tasks table.
- harness_runs (v4.3 §35 canonical).
- workflow_step_outputs.
- sessions / messages.
- events.
- artifacts index.

## Access and API

Platform access layer at least includes:

- CLI and TUI.
- HTTP API.
- SSE streaming events.
- Embedded Client.
- Gateway bridging Telegram, later extending to Slack / Feishu.

These entry points should share the same service layer instead of duplicating business logic.

## Configuration and Feature Flags

Configuration system should support:

- YAML configuration.
- Environment variable interpolation.
- Configuration version migration.
- Hot config reload.
- Feature Flag controlling phased capabilities.

In production builds, Feature Flag can further be used for compile-time DCE to reduce unused feature footprint.

## Testing and Observability

Operations design must include testing and observability:

- Testing pyramid and LLM mock.
- VCR / record-replay testing.
- Structured logs.
- Core KPI and debugging log infrastructure.
- Boundary testing to verify architecture and permission layers are not bypassed.

## Evolution Roadmap

- Phase 1-2: SQLite single-machine architecture, explicit concurrency cap.
- Phase 3: Enhanced channels, authentication, Web, and commercialization infrastructure.
- Phase 4: Migrate to PostgreSQL, multi-tenant, queue system, and stronger enterprise capabilities.

## Results

Advantages:

- Fast development speed, suitable for early single-person + AI team advancement.
- Unified service layer reuse across CLI, HTTP, Embedded Client.
- Clear migration path, avoiding early over-design.

Constraints:

- SQLite concurrency cap must be hard-coded in documentation and runtime.
- Phase migration requires strong testing and compatibility constraints, otherwise subsequent upgrade cost will be high.
- If Web, multi-tenant, and commercialization capabilities are added too early, it will significantly slow down infrastructure maturity.

## Cross References

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

## v4.3 ADR Remediation

- R6-50: Fix directory structure reference. ADR-009 originally described core service layer placed in `src/core/`, which does not match v4.3 §35 canonical directory structure `src/platform/`. Fix: Changed text to `src/platform/` (v4.3 §35 canonical).
