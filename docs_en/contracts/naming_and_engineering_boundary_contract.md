# Naming And Engineering Boundary Contract

## 1. Scope

This contract supplements the naming boundary between product narrative and engineering implementation and closes the unified abstraction direction for audit subject, channel capability, and runtime environment capability.

Related documents:

- `014-org-model-code-boundary.md`
- `gateway_message_contract.md`
- `execution_plane_contract.md`

## 2. Naming Boundary

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
- Narrative alias only used for product expression, diagrams, and external explanation.
- Not allowed to directly write `CEO / VP / Lead` as dispatch key, schema enum, or permission object id.

### 2.2 Naming Format

- role / agent id: `snake_case`
- event type: `<domain>.<action>`
- DB table: plural `snake_case`
- config key: namespaced stable key
- env var: `UPPER_SNAKE_CASE`

## 3. `ActorModel`

Unified audit subjects at minimum include:

- `user`
- `agent`
- `system`
- `scheduler`
- `webhook`
- `admin`

## 4. `ChannelCapabilityMatrix`

Channel capabilities at minimum abstract:

- `text`
- `button`
- `attachment`
- `stream`
- `notification`
- `command_input`

## 5. `RuntimeEnvironmentCapabilityProfile`

Runtime environment capabilities at minimum abstract:

- `local`
- `docker`
- `remote_worker`
- `serverless`
- `enterprise_sandbox`

## 6. `ResourceLease`

Future unified resource abstraction direction at minimum includes:

- token budget
- file lock
- worker slot
- network slot
- sandbox instance