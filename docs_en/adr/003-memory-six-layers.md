# ADR-003 Six-Layer Memory Model

- Status: Superseded by ADR-020
- Decision Date: 2026-04-02
- Superseded by: ADR-020 (2026-04-17) redefined the six-layer plane model with different TTL and promotion rules

**Note**: This ADR defines the six-layer model (L1-L6). The filename follows the historical path identifier for consistency with ADR-020. The "six-layer" description in architecture documents aligns with this document's content.

## Background

Automatic Agent is a multi-headquarters, multi-division, multi-role collaborative system. Memory must both share organizational knowledge and isolate role contexts. Single-agent CLI-style memory models cannot directly adapt to this organizational structure.

With OAPEFLIR closed-loop implementation, the memory layer no longer just answers "what to save", but also:

- Which content enters the long-term layer, which only remains in runtime suffix.
- Which contexts can share KV cache across agents.
- How context compression and learning/improvement evidence chain collaborate rather than overwrite each other.

## Decision

Adopt six-layer memory scope, with KV cache fixed prefix treated as a prompt infrastructure component that collaborates with but is independent from memory:

1. L1 `runtime`: Current step / current call's transient context.
2. L2 `session`: Single-task-level context, plan progress, recent summary.
3. L3 `agent`: Reusable working memory and patterns within agent lifecycle.
4. L4 `project`: Project-level knowledge, directory structure, constraints, and conventions.
5. L5 `user`: User preferences, communication style, long-term correction information.
6. L6 `evolution`: LearningObjects, strategy experience, failure patterns, and other evolutionary assets.

Accompanying this, system prompt is additionally split into:

- `fixed_prefix`
- `domain_block`
- `variable_suffix`

The first two serve KV cache reuse, not directly equivalent to any single-layer memory scope.

## Scope Model

Memory is not globally flat, but layered by scope:

- Global: User preferences, global reference knowledge, platform-level history.
- Project: Project context, shared goals, execution status.
- Division: Division experience, terminology, proprietary processes.
- Role: Role-specific experience and best practices.

Core principles for multi-agent:

- Static prompts shared, dynamic injection isolated.
- More specific memory has narrower access scope.
- VP Orchestration has higher global visibility; division roles only see what they need.

## MVP Scope

Phased implementation:

- Ring 1: Prioritize L1/L2, with handoff, context compaction, plan progress management.
- Ring 2: Observe/Assess/Plan go through explicit DTOs, session/project-level references begin stabilizing.
- Ring 3: Feedback/Learn convert evidence chain into `LearningObject` entering L6; Improve/Release consume validated learning objects.
- M2+: Then expand more complete Knowledge Plane, Artifact Plane, and heavier long-term governance.

Reasons for this approach:

- Early stage most needed is stable prompt construction, persistent instructions, and session state.
- Automatic extraction, complex compression, and tool result management have higher engineering and call costs.

## Key Implementation Points

KV cache / prompt base:

- System prompt split into `fixed_prefix`, `domain_block`, `variable_suffix`.
- `fixed_prefix` can be cross-agent shared cache.
- `domain_block` can be reused within same domain.
- `variable_suffix` injects role, current task, plan, memory summary, and current execution state.

Layer 2:

- Supports four-level loading: global, project, division, role.
- Conditional rules activate via path or role matching.
- `@include` supports cross-file rule reuse.

Layer 5:

- Different roles should use different templates.
- CEO, VP Operations, VP Orchestration, and division roles have different memory segment focuses.

L1/L2 with compaction:

- Compaction must not break workflow state, OAPEFLIR stage timeline, or approval/feedback fact chain.
- `FeedbackSignal`/`LearningObject` summaries are high-priority protected parts.
- `fixed_prefix` does not participate in normal compaction.

## Storage Recommendations

At minimum, the following persistence structures are needed:

- `memories`: Current implementation already includes `session_id`, `agent_id`, `execution_id`, `memory_layer`, `embedding_ref`
- `memory_extract_cursors`
- `session_memories`
- `tool_result_files`
- `learning_objects` (corresponding to L6 evolution layer)

Write strategies:

- High-frequency updates use debouncing or batch writing.
- Atomic writes avoid corrupting memory files on crash.
- Memory injection must be controlled by token budget.

## Results

Benefits:

- Supports balance of sharing and isolation between headquarters and divisions.
- Reduces token waste from repeated context injection.
- Provides infrastructure for crash recovery, long sessions, and cross-task experience accumulation.
- Provides clear boundaries for KV cache reuse in multi-agent scenarios.

Costs:

- Requires additional storage structures, token budget, and background async processing.
- L4/L6 governance quality directly affects Learn/Improve quality.
- KV cache prefix boundary drift will cause cache hit rate and behavior consistency decline.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- Prompt partitioning already supports `fixed_prefix`/`domain_block`/`variable_suffix` layering and cache keys.
- Context compaction has clarified that prefix does not participate in normal trimming.
- Learn has introduced evidence-backed `LearningObject` with `promotionStatus` controlling entry into Improve boundary.
- OAPEFLIR main/secondary chain stage timelines provide trackable memory and evolution-related stage entry sequence.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- `OAPEFLIR §E.2`
- `OAPEFLIR §F`
- `OAPEFLIR §L.3.2`