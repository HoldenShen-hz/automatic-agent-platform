# Reference Migration Matrix

> This document maps design content in `doc/reference/` to current system documentation landing points and future implementation modules, serving as the "full migration" execution ledger.
> Status explanation: `documented` = has formal documentation. Current matrix has no `doc_gap` items.

| Reference File | Topic | Documentation Landing | Future Implementation Landing | Current Status |
| --- | --- | --- | --- | --- |
| `01-overview-and-principles.md` | Overview, principles, tech choices | `doc/01`~`07`, `doc/adr/` | Later global adoption | documented |
| `02-organization-and-divisions.md` | HQ, division, org model | `division_definition_contract.md`, `01`, `02` | `src/divisions/` | documented |
| `03-perception-module.md` | Perception module | `perception_contract.md`, `03`, `04` | `src/perception/` | documented |
| `04-memory-system-detailed.md` | Seven-layer memory system | `adr/003-memory-seven-layers.md`, `03` | `src/core/memory/` | documented |
| `05-gateway-and-supervisor.md` | Gateway, Telegram, Supervisor | `gateway_message_contract.md`, `gateway_streaming_contract.md`, `supervisor_contract.md` | `src/gateway/`, `src/supervisor/` | documented |
| `06-typescript-platform-architecture.md` | TS platform arch, directory, API, REPL | `project_structure_contract.md`, `api_surface_contract.md`, `01`, `06` | `src/`, `src/server/`, `src/cli/` | documented |
| `07-core-execution-flows.md` | Task lifecycle, routing, self-healing, HITL, HR | `task_and_workflow_contract.md`, `approval_and_hitl_contract.md`, `agent_contract.md`, `04` | `src/core/runtime/`, `src/core/workflow/` | documented |
| `08-agent-communication.md` | Agent communication, event bus, result interface | `event_bus_contract.md` | `src/core/events/` | documented |
| `09-tools-skills-and-plugins.md` | tools, skills, MCP, plugins | `tool_skill_plugin_contract.md`, `tool_and_provider_execution_contract.md` | `src/tools/`, later `src/skills/` | documented |
| `10-llm-provider-strategy-detailed.md` | provider strategy, caching, circuit breaker | `adr/006-llm-provider-strategy.md`, `tool_and_provider_execution_contract.md`, `cost_and_budget_contract.md` | `src/providers/llm/`, `src/core/cost/` | documented |
| `11-security-and-permissions-detailed.md` | Sandbox, security, permissions | `adr/005-security-model.md`, `sandbox_and_auth_contract.md` | `src/core/security/` | documented |
| `12-storage-deployment-testing-observability.md` | SQLite, artifact, testing, observability | `storage_schema_contract.md`, `artifact_store_contract.md`, `observability_contract.md`, `06` | `src/core/storage/`, `tests/` | documented |
| `13-extension-mechanisms.md` | New division/tool/skill extension | `project_structure_contract.md`, `tool_skill_plugin_contract.md`, `guides/division-authoring.md` | `divisions/`, `src/tools/` | documented |
| `14-business-architecture-and-commercialization.md` | Commercialization, billing, compliance, enterprise | `04`, `adr/010-commercial-model.md`, `billing_and_tenant_contract.md` | later `src/billing/`, `src/server/api/` | documented |
| `15-implementation-plan-detailed.md` | Detailed implementation plan | `implementation_plan.md`, `operations/phases/` | later execute by phase | documented |
| `16-competitive-differentiation.md` | Differentiation and improvements | `adr/`, `reviews/current_status_and_gap_analysis.md` | later adopt item by item | documented |
| `17-glossary.md` | Glossary | `governance/naming_and_directory_conventions.md`, `governance/glossary_and_terminology.md` | Global unified naming | documented |

## Current Assessment

- Main topics in reference now have formal documentation.
- This does not equal functionality being implemented; it only means the "documentation first" prerequisite is met.
- This matrix answers "whether documentation is in place", not "whether code is implemented".

## Documentation Migration Principles

- Any reference design to formally enter implementation still needs to follow `contracts/` and `01` ~ `07` upper-level definitions.
- If reference still has deeper fields or processes not absorbed by formal documentation, prioritize supplementing contracts or main documents, not directly writing code.
- Each time a formal documentation absorption is completed, update this matrix status.
