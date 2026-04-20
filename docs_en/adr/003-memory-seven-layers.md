# ADR-003 Six-Layer Memory and KV Cache Fixed Prefix

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Automatic Agent is a multi-headquarters, multi-division, multi-role collaborative system. Memory must both share organizational knowledge and isolate role contexts. Single-agent CLI-style memory models cannot directly adapt to this organizational structure.

As the OAPEFLIR loop is implemented, the memory layer no longer just answers "what to save," but also:

- Which content enters the long-term layer and which only stays in the runtime suffix.
- Which context can share KV cache across agents.
- How context compaction and learning/improvement evidence chains collaborate rather than overwrite each other.

## Decision

Adopt six-layer memory scope, treating KV cache fixed prefix as a prompt infrastructure independent of but coordinated with memory:

1. L1 `runtime`: Instant context of current step/current call.
2. L2 `session`: Single-task-level context, plan progress, recent summary.
3. L3 `agent`: Work memory and patterns reused within agent lifecycle.
4. L4 `project`: Project-level knowledge, directory structure, constraints, and conventions.
5. L5 `user`: User preferences, communication style, long-term correction information.
6. L6 `evolution`: LearningObjects, policy experiences, failure patterns, and other evolutionary assets.

Alongside this, system prompt is additionally split into:

- `fixed_prefix`
- `domain_block`
- `variable_suffix`

The first two serve KV cache reuse and are not directly equivalent to any single memory layer scope.

## Scope Model

Memory is not globally flat but layered by scope:

- Global: User preferences, global reference knowledge, platform-level history.
- Project: Project context, shared goals, execution state.
- Division: Division experience, terminology, proprietary processes.
- Role: Role-specific experience and best practices.

Core principles for multi-agent:

- Static prompts are shared; dynamic injections are isolated.
- The more specific the memory, the narrower the access range.
- VP Orchestration has higher global visibility; division roles only see what they need.

## MVP Scope

Phased implementation:

- Phase 1: Prioritize L1/L2, with handoff, context compaction, plan progress management.
- Phase 2: Observe/Assess/Plan go through explicit DTO; session/project-level references begin stabilizing.
- Phase 3: Feedback/Learn convert evidence chains into `LearningObject`, entering L6.
- Phase 4: Improve/Release consume validated/promoted learning objects from L6, with only `off/suggest/shadow` three-tier release.
- M2+: Then extend more complete Knowledge Plane, Artifact Plane, and heavier long-term governance.

Rationale:

- Early stages most need stable prompt construction, persistent instructions, and session state.
- Auto-extraction, complex compression, and tool result management have higher engineering and invocation costs.

## Key Implementation Points

KV cache / prompt base:

- System prompt split into `fixed_prefix`, `domain_block`, `variable_suffix`.
- `fixed_prefix` can be shared across agents for cache.
- `domain_block` can be reused within the same domain.
- `variable_suffix` injects role, current task, plan, memory summary, and current execution state.

Layer 2:

- Supports global, project, division, role four-level loading.
- Conditional rules activate via path or role matching.
- `@include` supports cross-file rule reuse.

Layer 5:

- Different roles should use different templates.
- Memory paragraph focus differs between CEO, VP Operations, VP Orchestration, and division roles.

L1/L2 with compaction:

- Compaction must not break workflow state, OAPEFLIR phase timeline, or approval/feedback fact chains.
- `FeedbackSignal` / `LearningObject` summaries are high-priority protected parts.
- `fixed_prefix` does not participate in normal compaction.

## Storage Recommendations

At minimum, these persistent structures are needed:

- `memories`: Current implementation already includes `session_id`, `agent_id`, `execution_id`, `memory_layer`, `embedding_ref`
- `memory_extract_cursors`
- `session_memories`
- `tool_result_files`
- `learning_objects` (corresponding to L6 evolution layer)

Write strategy:

- High-frequency updates use debouncing or batch writes.
- Use atomic writes to avoid corrupting memory files on crash.
- Memory injection must be controlled by token budget.

## Consequences

Advantages:

- Supports shared and isolated balance between headquarters and divisions.
- Reduces token waste from repeated context injection.
- Provides infrastructure for crash recovery, long sessions, and cross-task experience accumulation.
- Provides clear boundaries for KV cache reuse in multi-agent scenarios.

Costs:

- Additional storage structures, token budgets, and background async processing are needed.
- L4/L6 governance quality directly affects Learn/Improve quality.
- KV cache prefix boundary drift will cause cache hit rate and behavior consistency degradation.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- Prompt partition already supports `fixed_prefix` / `domain_block` / `variable_suffix` layering and cache keys.
- Context compaction has clarified prefix does not participate in normal trimming.
- Learn has introduced evidence-backed `LearningObject`, with `promotionStatus` controlling the boundary for entering Improve.
- OAPEFLIR main/secondary chains' phase timelines allow tracking memory and evolution-related phase entry order.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- `OAPEFLIR §E.2`
- `OAPEFLIR §F`
- `OAPEFLIR §L.3.2`
