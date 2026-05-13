# ADR-003 Six-Layer Memory Model

- Status: Superseded by ADR-020
- Decision Date: 2026-04-02
- Superseded by: ADR-020 (2026-04-17) which redefined the six-layer plane model with different TTL and promotion rules

**Note**: This ADR defines the six-layer model (L1-L6), and the filename follows the historical path identifier, consistent with ADR-020. The architecture documents six-layer description is aligned with this content.

## Background

Automatic Agent is a multi-headquarters, multi-division, multi-role collaborative system where memory must both share organizational knowledge and isolate role contexts. A single-agent CLI-style memory model cannot directly adapt to this organizational structure.

With the OAPEFLIR closed-loop implementation, the memory layer no longer just answers what to save, but also:

- Which content enters the long-term layer and which only remains in the runtime suffix.
- Which contexts can share KV cache across agents.
- How context compaction and learning/improvement evidence chains collaborate rather than override each other.

## Decision

Adopt a six-layer memory scope, treating KV cache fixed prefix as prompt infrastructure that collaborates with but is independent of memory:

1. L1 runtime: Instant context of current step and current call.
2. L2 session: Single task-level context, plan progress, recent summary.
3. L3 agent: Work memory and patterns reused within agent lifecycle.
4. L4 project: Project-level knowledge, directory structure, constraints and conventions.
5. L5 user: User preferences, communication style, long-term correction information.
6. L6 evolution: LearningObject, strategy experience, failure patterns and other evolution assets.

Accompanying this, system prompt is additionally split into:

- fixed_prefix
- domain_block
- variable_suffix

The first two serve KV cache reuse and are not directly equivalent to any single memory scope layer.

## Scope Model

Memory is not globally flat but layered by scope:

- Global: User preferences, global reference knowledge, platform-level history.
- Project: Project context, shared goals, running state.
- Division: Division experience, terminology, proprietary processes.
- Role: Role-specific experience and best practices.

Multi-Agent core principles:

- Static prompts are shared, dynamic injection is isolated.
- The more specific the memory, the narrower the access scope.
- VP Orchestration has higher global visibility, division roles only see what they need.

## MVP Scope

Phased implementation:

- Ring 1: Prioritize L1/L2, with handoff, context compaction, plan progress management.
- Ring 2: Observe, Assess, Plan go through explicit DTOs, session/project level references begin to stabilize.
- Ring 3: Feedback, Learn convert evidence chains into LearningObject, entering L6; Improve, Release consume validated learning objects.
- M2+: Then expand more complete Knowledge Plane, Artifact Plane and heavier long-term governance.

The reason for this approach:

- Early stage most needs stable prompt construction, persistent instructions, and session state.
- Automatic extraction, complex compression, and tool result management have higher engineering costs and invocation costs.

## Key Implementation Points

KV cache / prompt base:

- System prompt split into fixed_prefix, domain_block, variable_suffix.
- fixed_prefix can be cached across agents.
- domain_block can be reused within same domain.
- variable_suffix injects role, current task, plan, memory summary, and current execution state.

Layer 2:

- Support global, project, division, role four-level loading.
- Conditional rules activated through path or role matching.
- @include supports cross-file rule reuse.

Layer 5:

- Different roles should use different templates.
- CEO, VP Operations, VP Orchestration, and division roles have different memory paragraph focuses.

L1/L2 and compaction:

- Compaction must not break workflow state, OAPEFLIR stage timeline, or approval/feedback fact chain.
- FeedbackSignal, LearningObject summaries are high-priority protected parts.
- fixed_prefix does not participate in normal compaction.

## Storage Recommendations

At minimum, the following persistent structures are needed:

- memories: Current implementation already includes session_id, agent_id, execution_id, memory_layer, embedding_ref.
- memory_extract_cursors.
- session_memories.
- tool_result_files.
- learning_objects (corresponding to L6 evolution layer).

Write strategy:

- Use debounce or batch writes for high-frequency updates.
- Use atomic writes to avoid memory file corruption on crashes.
- Memory injection must be controlled by token budget.

## Results

Benefits:

- Supports balance between sharing and isolation across headquarters and divisions.
- Reduces token waste from repeated context injection.
- Provides infrastructure for crash recovery, long sessions, and cross-task experience accumulation.
- Provides clear boundaries for KV cache reuse in multi-agent scenarios.

Costs:

- Requires additional storage structures, token budget, and background async processing.
- Governance quality of L4/L6 directly affects Learn, Improve quality.
- If KV cache prefix boundaries drift, cache hit rate and behavioral consistency will decrease.

## Current Implementation Alignment

As of current phase1-4 delivery, parts aligned with this ADR include:

- Prompt partition already supports fixed_prefix, domain_block, variable_suffix layering and cache keys.
- Context compaction has clarified that prefix does not participate in normal trimming.
- Learn has introduced evidence-backed LearningObject and uses promotionStatus to control boundaries for entering Improve.
- OAPEFLIR main/secondary chains can track memory and evolution-related stage entry order through stage timeline.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- OAPEFLIR Section E.2
- OAPEFLIR Section F
- OAPEFLIR Section L.3.2
