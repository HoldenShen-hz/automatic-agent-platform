# Architecture Governance And Versioning Contract

## 1. Scope

This contract defines architecture decision processes, module boundary governance, and version compatibility strategies for mature industrial platforms.

Related documents:

- `project_structure_contract.md`
- `api_surface_contract.md`
- `control_vs_intelligence_boundary_contract.md`
- `workflow_static_analysis_and_compensation_contract.md`

## 2. Goals

- Let new architectural decisions enter formal ADR process rather than staying in chat or code comments.
- Tighten call boundaries between domain layer, orchestration layer, runtime layer, and infrastructure layer.
- Establish unified version governance for workflow DSL, role contract, tool schema, event schema, and memory schema.

## 3. ADR Governance Requirements

The following changes must add new ADR or update existing ADR:

- Adding authoritative store, queue, broker, or cache.
- Adding cross-boundary security model, execution model, or tenant isolation model.
- Changing model selection strategy, fallback strategy, or control/intelligence boundary.
- Changing workflow DSL, event schema, or tool schema compatibility strategy.
- Introducing new production-grade dependencies, plugin distribution mechanisms, or cross-region disaster recovery.

Each ADR must at least contain:

- context
- decision
- alternatives considered
- trade-offs
- adoption trigger
- rollback / exit criteria
- migration impact

Supplementary requirements:

- If a design explicitly references an external system or framework, should record "borrowed points" and "points not directly adopted".
- If deciding not to adopt a seemingly reasonable external approach, should retain minimum rejection reasons to avoid the same proposal being resubmitted repeatedly.
- For long-term stable boundaries, architecture smell inventory or guard scripts may be introduced to continuously discover facade pollution, cross-layer dependencies, and runtime service locator expansion.
- For long-term high-frequency changing core modules, should continuously review module expansion risks; if a central module continuously absorbs unrelated responsibilities, should prioritize splitting boundaries rather than continuing to pile logic into a "universal core".

## 4. Module Boundaries

Recommended layers:

| Layer | Responsible For | Must Not Directly Depend On |
| --- | --- | --- |
| `domain` | task, workflow, decision, result, policy objects | infra details, SDK clients |
| `orchestration` | planner, orchestrator, transition service, recovery manager | underlying DB driver, specific web framework |
| `runtime` | execution, lease, worker, queue, sandbox, gateway | product narrative objects, UI components |
| `infrastructure` | PostgreSQL, Redis, object store, provider adapter, observability adapter | business orchestration rules |

Boundary rules:

- Cross-layer capabilities must be exposed through interface / port.
- "Upper layer directly stealing lower layer implementation details" is not allowed.
- Domain objects must not hold infrastructure clients.
- prompt, workflow, policy files must not replace mandatory system code boundaries.
- public facade must not reverse re-export private implementations to avoid freezing accidental paths into de facto public contracts.
- Type layer / contract layer must not directly bind implementation shim; if lazy/load is necessary, should be handled through explicit runtime boundary.

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
| event schema | producer and consumer at minimum compatible with current and previous versions |
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

External protocols or control plane handshakes should at minimum clarify:

- protocol version negotiation
- role / scope boundary
- device / client identity shape
- structured recovery hint on auth or compatibility failure

Rules:

- Protocol changes belong to contract changes and should not silently drift through implementation details alone.
- Compatibility failures should try to return structured recovery suggestions rather than just exposing bare error strings.
- External methods, payload, notification naming should follow unified conventions, such as `*Params / *Response / *Notification` or equivalent style, and should not mix multiple naming systems in the same protocol layer.
- experimental / unstable surface must be explicitly marked with defined promotion or deletion paths to avoid temporary fields lingering as implicit formal interfaces.

## 8. Conclusion

Mature industrial platforms cannot maintain stability by just "current implementation works".

Formal architecture governance must simultaneously cover:

- Decision records
- Layer boundaries
- schema versions
- Compatibility windows
- Upgrade and rollback conditions
