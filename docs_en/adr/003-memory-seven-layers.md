# ADR-003 Six-Layer Memory and KV Cache Fixed Prefix

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Automatic Agent is a multi-headquarters role, multi-division, multi-role collaboration system; memory must both share organizational knowledge and isolate role contexts. Single Agent CLI-style memory model cannot directly adapt to this organizational structure.

As OAPEFLIR闭环 lands, memory layer no longer just answers "what to save" but also:

- Which content enters long-term layer, which only remains in runtime suffix.
- Which contexts can share KV cache across agents.
- How context compaction and learning/improvement evidence chain collaborate rather than overwrite each other.

## Decision

Adopt six-layer memory scope, and treat KV cache fixed prefix as prompt infrastructure that collaborates with but is independent from memory:

1. L1 `runtime`: Current step/current invocation transient context.
2. L2 `session`: Single task-level context, plan progress, recent summary.
3. L3 `agent`: Work memory and patterns reused within agent lifecycle.
4. L4 `project`: Project-level knowledge, directory structure, constraints, and conventions.
5. L5 `user`: User preferences, communication style, long-term correction information.
6. L6 `evolution`: LearningObject, policy experience, failure patterns, and other evolution assets.

Along with this, system prompt is additionally split into:

- `fixed_prefix`
- `domain_block`
- `variable_suffix`

Where the first two serve KV cache reuse and are not directly equivalent to any one memory layer scope.

## Scope Model

Memory is not globally flat but layered by scope:

- Global: User preferences, global reference knowledge, platform-level history.
- Project: Project context, shared goals, runtime state.
- Division: Division experience, terminology, proprietary processes.
- Role: Role-specific experience and best practices.

Core principles for multi-Agent:

- Static prompts shared, dynamic injection isolated.
- More specific memory has narrower access scope.
- VP Orchestration has higher global visibility, division roles only see what they need.

## MVP Scope

Phased implementation:

- Phase 1: Prioritize L1/L2, with handoff, context compaction, plan progress management.
- Phase 2: Observe/Assess/Plan go through explicit DTO, session/project-level references begin stabilizing.
- Phase 3: Feedback/Learn convert evidence chain into `LearningObject`, entering L6.
- Phase 4: Improve/Release consume L6 validated/promoted learning objects, and only allow `off/suggest/shadow` three tiers for release.
- M2+: Then expand more complete Knowledge Plane, Artifact Plane, and heavier long-term governance.

Reason for doing this:

- Early most needed is stable prompt construction, persistent instructions, and session state.
- Automatic extraction, complex compression, and tool result management have higher engineering and invocation costs.

## Key Implementation Points

KV cache / prompt base:

- System prompt split into `fixed_prefix`, `domain_block`, `variable_suffix`.
- `fixed_prefix` can be cached across agents.
- `domain_block` can be reused within same domain.
- `variable_suffix` injects role, current task, plan, memory summary, and current execution state.

Layer 2:

- Support global, project, division, role four-level loading.
- Conditional rules activate through path or role matching.
- `@include` supports cross-file rule reuse.

Layer 5:

- Different roles should use different templates.
- Memory paragraph focus differs for CEO, VP Operations, VP Orchestration, and division roles.

L1/L2 with compaction:

- Compaction must not destroy workflow state, OAPEFLIR stage timeline, or approval/feedback fact chain.
- `FeedbackSignal`/`LearningObject` summary belongs to high-priority protected parts.
- `fixed_prefix` does not participate in normal compaction.

## Storage Recommendations

At least the following persistent structures are needed:

- `memories`: Current implementation already includes `session_id`, `agent_id`, `execution_id`, `memory_layer`, `embedding_ref`
- `memory_extract_cursors`
- `session_memories`
- `tool_result_files`
- `learning_objects` (corresponding to L6 evolution layer)

Write strategy:

- High-frequency updates use debounce or batch write.
- Use atomic writes to avoid corrupting memory files on crash.
- Memory injection must be controlled by token budget.

## Results

Benefits:

- Supports shared and isolated balance between headquarters and divisions.
- Reduces token waste from repeated context injection.
- Provides infrastructure for crash recovery, long sessions, and cross-task experience accumulation.
- Provides clear boundaries for KV cache reuse in multi-agent scenarios.

Costs:

- Additional storage structure, token budget, and background async processing needed.
- L4/L6 governance quality directly affects Learn/Improve quality.
- If KV cache prefix boundary drifts, cache hit and behavior consistency will degrade.

## Current Implementation Alignment

As of current phase1-4 delivery, parts already aligned with this ADR include:

- Prompt partition already supports `fixed_prefix`/`domain_block`/`variable_suffix` layering and cache keys.
- Context compaction has clarified prefix does not participate in normal trimming.
- Learn has introduced evidence-backed `LearningObject`, with `promotionStatus` controlling entry boundary into Improve.
- OAPEFLIR main/secondary chain can track memory and evolution-related stage entry order through stage timeline.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- `OAPEFLIR §E.2`
- `OAPEFLIR §F`
- `OAPEFLIR §L.3.2`
