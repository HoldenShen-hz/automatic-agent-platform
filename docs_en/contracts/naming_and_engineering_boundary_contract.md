# Naming And Engineering Boundary Contract

## 1. Scope

This contract supplements naming boundaries between product narrative and engineering implementation, and closes the unified abstraction direction for audit subjects, channel capabilities, and runtime environment capabilities.

Related documents:

- `014-org-model-code-boundary.md`
- `gateway_message_contract.md`
- `execution_plane_contract.md`

## 2. Naming Boundaries

- External product narrative can use CEO / VP / Lead
- Internal code prioritizes neutral engineering objects:
  - `Router`
  - `Planner`
  - `DivisionCoordinator`
  - `WorkflowExecutor`
  - `DecisionManager`

### 2.1 Document Canonical Writing

In main documents, contracts, ADRs, and guides, control layer objects are uniformly written as:

- `strategic_governor` (business alias: CEO)
- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)
- `division_lead` (business alias: Lead Agent)

Rules:

- Protocols, schemas, state machines, and event registries use canonical id.
- Narrative aliases are only used for product expression, diagrams, and external explanations.
- `CEO / VP / Lead` are not allowed to be written directly as scheduling primary keys, schema enums, or permission object ids.

### 2.3 OAPEFLIR and Extended Object Canonical Writing

The following objects should use canonical engineering naming in contracts / schemas / APIs / events:

- `observe_hub`
- `assess_hub`
- `plan_hub`
- `feedback_hub`
- `learn_hub`
- `improve_hub`
- `release_hub`
- `knowledge_plane`
- `memory_plane`
- `plugin_spi_registry`
- `domain_registry`

### 2.2 Naming Format

- role / agent id: `snake_case`
- event type: `<domain>.<action>`
- DB table: plural `snake_case`
- config key: namespaced stable key
- env var: `UPPER_SNAKE_CASE`
- stage id: `snake_case`
- memory layer: `L1` ~ `L6`
- typed ref: `PascalCaseRef`

## 3. `ActorModel`

Unified audit subjects include at least:

- `user`
- `agent`
- `system`
- `scheduler`
- `webhook`
- `admin`

## 4. `ChannelCapabilityMatrix`

Minimum abstraction for channel capabilities:

- `text`
- `button`
- `attachment`
- `stream`
- `notification`
- `command_input`

## 5. `RuntimeEnvironmentCapabilityProfile`

Minimum abstraction for runtime environment capabilities:

- `local`
- `docker`
- `remote_worker`
- `serverless`
- `enterprise_sandbox`

## 6. `ResourceLease`

Direction for future unified resource abstraction includes at least:

- token budget
- file lock
- worker slot
- network slot
- sandbox instance
- provider quota

## 7. Closure Conclusion

After tightening naming boundaries, product narrative and engineering implementation will not hijack each other; and actor, channel, environment, and resource these several groups of abstractions are the real common foundation for subsequent extensibility.
