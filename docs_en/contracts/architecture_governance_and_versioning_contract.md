# Architecture Governance And Versioning Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage loop:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the architecture decision process, module boundary governance, and version compatibility strategy required for mature industrial platforms.

Related Documents:

- `project_structure_contract.md`
- `api_surface_contract.md`
- `control_vs_intelligence_boundary_contract.md`
- `workflow_static_analysis_and_compensation_contract.md`

## 2. Goals

- Ensure new architectural decisions enter formal ADR process, rather than staying in chat or code comments.
- Tighten call boundaries between domain layer, orchestration layer, runtime layer, and infrastructure layer.
- Establish unified version governance for workflow DSL, role contract, tool schema, event schema, and memory schema.

## 3. ADR Governance Requirements

The following changes must add new ADR or update existing ADR:

- Add authoritative store, queue, broker, or cache.
- Add cross-boundary security model, execution model, or tenant isolation model.
- Change model selection strategy, fallback strategy, or control/intelligence boundary.
- Change workflow DSL, event schema, or tool schema compatibility strategy.
- Introduce new production-level dependency, plugin distribution mechanism, or cross-region disaster recovery scheme.

Each ADR must contain at least:

- context
- decision
- alternatives considered
- trade-offs
- adoption trigger
- rollback / exit criteria
- migration impact

Supplementary Requirements:

- If a design explicitly references an external system or external framework, "borrowing points" and "points not directly adopted" should be recorded.
- If a decision is made not to adopt an apparently reasonable external solution, a minimal rejection reason should be retained to avoid the same proposal being re-proposed repeatedly.
- For long-term stable boundaries, architecture smell inventory or guard scripts are allowed to continuously discover facade pollution, cross-layer dependencies, and runtime service locator bloat.
- For core modules with high-frequency long-term changes, module bloat risk should be continuously reviewed; if central modules absorb unrelated responsibilities for a long time, boundary splitting should be prioritized rather than continuing to pile logic onto a "universal core".

## 4. Module Boundaries

Recommended layers:

| Layer | Responsible For | Forbidden Direct Dependencies |
| --- | --- | --- |
| `domain` | task, workflow, decision, result, policy objects | infra details, SDK clients |
| `orchestration` | planner, orchestrator, transition service, recovery manager | underlying DB driver, specific web framework |
| `runtime` | execution, lease, worker, queue, sandbox, gateway | product narrative objects, UI components |
| `infrastructure` | PostgreSQL, Redis, object store, provider adapter, observability adapter | business orchestration rules |

Boundary Rules:

- Cross-layer capabilities must be exposed through interface / port.
- "Upper layer directly stealing lower layer implementation details" is not allowed.
- Domain objects must not hold infrastructure clients.
- Prompt, workflow, and policy files must not replace mandatory system code boundaries.
- Public facade must not reverse re-export private implementation, avoiding freezing accidental paths into de facto public contracts.
- Type layer / contract layer must not directly bind implementation shim; if lazy load is necessary, it should be received through explicit runtime boundary.

## 5. Version Governance Objects

Objects that must be explicitly versioned:

- `workflow_dsl_version`
- `role_contract_version`
- `tool_schema_version`
- `event_schema_version`
- `message_parts_version`
- `memory_schema_version`
- `policy_bundle_version`
- `prompt_bundle_version`

## 6. Compatibility Strategy

| Object | Default Compatibility Strategy |
| --- | --- |
| workflow DSL | minor backward compatible, major allows breaking change |
| role contract | minor adds optional fields, major changes required fields or semantics |
| tool schema | must be compatible with two adjacent minor versions in production |
| event schema | producer and consumer must be compatible with current and previous version at least |
| memory schema | must provide migration or lazy upgrade rules when upgrading |

## 7. Version Upgrade Process

```mermaid
flowchart TD
    A["Draft Schema / Boundary Change"] --> B["ADR / Contract Update"]
    B --> C["Compatibility Tests"]
    C --> D["Canary Rollout"]
    D --> E{"Metrics Healthy?"}
    E -- "Yes" --> F["Promote New Version"]
    E -- "No" --> G["Rollback / Dual-Read Continue"]
```

## 7.1 Protocol and Recovery Hints

External protocols or control plane handshakes should at least clarify:

- protocol version negotiation
- role / scope boundary
- device / client identity shape
- structured recovery hint on auth or compatibility failure

Rules:

- Protocol changes belong to contract changes, and should not drift quietly through implementation details alone.
- On compatibility failure, structured recovery suggestions should be returned as much as possible, not just exposing bare error strings.
- External methods, payloads, and notification naming should follow unified conventions, such as `*Params / *Response / *Notification` or equivalent style, and should not mix multiple naming systems within the same protocol layer.
- experimental / unstable surface must be explicitly marked, and define promotion or deletion path to avoid temporary fields lingering as implicit formal interfaces for long.

## 8. Conclusion

Mature industrial platforms cannot maintain stability by just "current implementation runs".

Formal architecture governance must simultaneously cover:

- Decision records
- Layer boundaries
- Schema versions
- Compatibility windows
- Upgrade and rollback conditions
