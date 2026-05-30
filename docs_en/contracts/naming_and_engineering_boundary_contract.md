# Naming And Engineering Boundary Contract

## 1. Scope

This contract supplements the naming boundary between product narrative and engineering implementation, and closes the unified abstraction direction for audit subjects, channel capabilities, and runtime environment capabilities.

Related documents:

- `014-org-model-code-boundary.md`
- `gateway_message_contract.md`
- `execution_plane_contract.md`

## 2. Naming Boundary

- External product narrative may use CEO / VP / Lead
- Internal code prefers neutral engineering objects:
  - `Router`
  - `Planner`
  - `DivisionCoordinator`
  - `HarnessRuntime`
  - `DecisionManager`

### 2.1 Document Canonical Form

In main documents, contracts, ADRs, and guides, control layer objects are uniformly written as:

- `strategic_governor` (business alias: CEO)
- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)
- `division_lead` (business alias: Lead Agent)

Rules:

- Protocols, schemas, state machines, and event registries use canonical id.
- Narrative aliases are used only for product expression, diagrams, and external descriptions.
- `CEO / VP / Lead` must not be written directly as scheduling primary keys, schema enums, or permission object ids.

### 2.3 OAPEFLIR and Extension Objects Canonical Form

The following objects must use canonical engineering names in contract / schema / API / event:

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

Unified audit subjects must include at minimum:

- `user`
- `agent`
- `system`
- `scheduler`
- `webhook`
- `admin`

## 4. `ChannelCapabilityMatrix`

Minimum channel capability abstraction:

- `text`
- `button`
- `attachment`
- `stream`
- `notification`
- `command_input`

## 5. `RuntimeEnvironmentCapabilityProfile`

Minimum runtime environment capability abstraction:

- `local`
- `docker`
- `remote_worker`
- `serverless`
- `enterprise_sandbox`

## 6. `ResourceLease`

Future unified resource abstraction direction must include at minimum:

- token budget
- file lock
- worker slot
- network slot
- sandbox instance
- provider quota

## 7. Conclusion

After tightening the naming boundary, product narrative and engineering implementation will not entangle each other; the actor, channel, environment, and resource abstractions are the true shared foundation for future extensibility.