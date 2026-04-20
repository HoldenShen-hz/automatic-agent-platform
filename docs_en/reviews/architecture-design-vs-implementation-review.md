# Architecture Design vs Implementation Status Full Review Report
automatic_agent/automatic-agent-platform-main/docs_zh/reviews/architecture-design-vs-implementation-review.md

> **Version**: v1.0
> **Review Target**: `docs_zh/architecture/00-platform-architecture.md` v2.7 (6,689 lines, 70 sections §1-§70)
> **Review Date**: 2026-04-20
> **Review Scope**: All 70 sections compared against actual codebase implementation, identifying unimplemented modules, problematic modules, and providing detailed solutions

---

## Table of Contents

- [I. Platform Infrastructure Layer §1-§9](#i-platform-infrastructure-layer-19)
- [II. Core Functionality Layer §10-§23](#ii-core-functionality-layer-1023)
- [III. Infrastructure and Domain Layer §24-§38](#iii-infrastructure-and-domain-layer-2438)
- [IV. Upper Interaction and Ecosystem Layer §39-§69](#iv-upper-interaction-and-ecosystem-layer-3969)
- [V. Summary and Priority Matrix](#v-summary-and-priority-matrix)

---

## I. Platform Infrastructure Layer §1-§9

### §1-§3 Overview and Vision

**Implementation Status**: Fully Aligned

These three sections are document-based (vision, terminology, design principles) and do not involve direct code implementation. The codebase module organization and naming conventions are consistent with the document description.

---

### §4 Five Planes Architecture (Five Planes + X1 Fabric)

**Implementation Status**: 92% Implemented

#### P1 Interface Plane — 6/6 Components Implemented

| Component          | File Location                              | Status    |
| ------------------ | ------------------------------------------ | --------- |
| API Gateway        | `src/platform/interface/api-gateway/`      | Fully Complete |
| Webhook Receiver   | `src/platform/interface/webhook-receiver/` | Fully Complete |
| Scheduler          | `src/platform/interface/scheduler/`        | Fully Complete |
| Console BFF       | `src/platform/interface/console-bff/`      | Fully Complete |
| Ingress Controller | `src/platform/interface/ingress-controller/` | Fully Complete |
| Channel Gateway    | `src/platform/interface/channel-gateway/` | Fully Complete |

#### P2 Control Plane — 8/8 Components Implemented

| Component          | File Location                                | Status    |
| ------------------ | -------------------------------------------- | --------- |
| Policy Engine      | `src/platform/control-plane/policy-engine/`   | Fully Complete |
| Approval Manager   | `src/platform/control-plane/approval-manager/` | Fully Complete |
| Rollout Controller | `src/platform/control-plane/rollout-controller/` | Fully Complete |
| Incident Manager   | `src/platform/control-plane/incident-manager/` | Fully Complete |
| Config Manager     | `src/platform/control-plane/config-manager/` | Fully Complete |
| Audit Logger       | `src/platform/control-plane/audit-logger/`   | Fully Complete |
| Tenant Manager     | `src/platform/control-plane/tenant-manager/` | Fully Complete |
| IAM Service       | `src/platform/control-plane/iam-service/`   | Fully Complete |

#### P3 Orchestration Plane — 5/5 Components Implemented

| Component           | File Location                                  | Status              |
| ------------------ | ---------------------------------------------- | ------------------- |
| OAPEFLIR Engine    | `src/platform/orchestration/oapeflir-engine/` | Fully Complete (68+ files) |
| Planner            | `src/platform/orchestration/planner/`         | Fully Complete |
| Routing Service   | `src/platform/orchestration/routing-service/` | Fully Complete |
| Escalation Manager | `src/platform/orchestration/escalation-manager/` | Fully Complete |
| HITL Coordinator   | `src/platform/orchestration/hitl-coordinator/` | Fully Complete |

#### P4 Execution Plane — 5/5 Components Implemented

| Component         | File Location                            | Status    |
| ---------------- | ---------------------------------------- | --------- |
| Dispatch Engine  | `src/platform/execution/dispatch-engine/` | Fully Complete |
| Worker Pool      | `src/platform/execution/worker-pool/`    | Fully Complete |
| Plugin Executor  | `src/platform/execution/plugin-executor/` | Fully Complete |
| Sandbox Runtime  | `src/platform/execution/sandbox-runtime/` | Fully Complete |
| Lease Manager    | `src/platform/execution/lease-manager/`   | Fully Complete |

#### Completed Fixes

**Fix 1: Plugin Executor Complete Implementation**

Created `src/platform/execution/plugin-executor/plugin-executor.service.ts` implementing the following:

1. **Plugin Lifecycle Management** — Complete state machine: registered → loaded → active → inactive → degraded → disabled
2. **Sandbox Isolation Mechanism** — Integrated `SandboxPolicy` with different isolation levels per sandboxTier configuration
3. **Resource Limits** — Timeout read from `PluginManifest.sandbox.timeoutMs`
4. **Lifecycle Hooks** — Implemented `onLoad`/`onActivate`/`onDeactivate`/`onUnload`
5. **Result Collection** — Execution results written to `ArtifactStore` as evidence

Backward compatible: Original `PluginExecutionService` (legacy) and type definitions preserved.

```typescript
// Lifecycle: register → load → activate → execute → deactivate → unload
export class PluginExecutorService {
  register(manifest, hooks)
  load(pluginId)
  activate(pluginId)
  execute(pluginId, action, context, params): Promise<ExecutionResult>
  deactivate(pluginId)
  unregister(pluginId)
  healthCheck(pluginId): Promise<boolean>
}
```

#### P5 State & Evidence Plane — 8/8 Components Implemented

All 8 components implemented: Truth Store, Events, Projections, Artifacts, Memory, Knowledge, Audit Trail, DLQ.

#### X1 Foundation Fabric — 5/5 Components Implemented

AuthN/AuthZ, Sandbox, Circuit Breaker, DLQ, Backpressure all implemented.

#### §4 P4 Execution Plane Fix Status

**Completed** — Plugin Executor Complete Implementation (2026-04-20)

`src/platform/execution/plugin-executor/plugin-executor.service.ts` created, functionality corresponds to architecture document §4 requirements:

| Function | Status |
| -------- | ------ |
| Plugin lifecycle management (registered→loaded→active→inactive→degraded→disabled) | ✅ |
| Sandbox isolation mechanism (SandboxPolicy integration) | ✅ |
| Resource limits (timeout read from PluginManifest) | ✅ |
| Lifecycle hooks (onLoad/onActivate/onDeactivate/onUnload) | ✅ |
| Result collection writing to ArtifactStore | ✅ |
| Backward compatible PluginExecutionService | ✅ |

---

### §5 Platform Contracts

**Implementation Status**: 100% (7/7 contracts implemented)

| Contract          | Location                                    | Status    |
| ---------------- | ------------------------------------------ | --------- |
| TaskEnvelope     | `src/platform/contracts/task-envelope/`     | ✅ Implemented |
| ExecutionResult  | `src/platform/contracts/execution-result/` | ✅ Implemented |
| PolicyDecision   | `src/platform/contracts/policy-decision/`  | ✅ Implemented |
| ApprovalRequest  | `src/platform/contracts/approval-request/` | ✅ Implemented |
| AuditEntry       | `src/platform/contracts/audit-entry/`      | ✅ Implemented |
| EvidenceRecord   | `src/platform/contracts/evidence-record/` | ✅ Implemented |
| ProjectionUpdate | `src/platform/contracts/projection-update/` | ✅ Implemented |

#### Completed Fixes

**Fix 1: EvidenceRecord and ProjectionUpdate Implementation**

Added complete type definitions and factory functions in `src/platform/contracts/types/platform-contracts.ts`:

- `EvidenceRecord` interface — Decision evidence record containing recordId/traceId/principal/category/targetRef/content/metadata
- `createEvidenceRecord()` factory function
- `ProjectionUpdate` interface — Projection update contract containing projectionId/projectionType/version/sourceEvents/patch/metadata
- `createProjectionUpdate()` factory function

New export directories:
- `src/platform/contracts/evidence-record/index.ts` — re-export EvidenceRecord related types
- `src/platform/contracts/projection-update/index.ts` — re-export ProjectionUpdate related types

**Fix 2: Contract Unified Export**

All contract types are managed through `contracts/types/platform-contracts.ts`, subdirectory `index.ts` only does re-export, avoiding duplicate definitions.

---

### §6 API Endpoints (REST Endpoints)

**Implementation Status**: 60% (12/20 endpoints fully implemented)

This is the **weakest area** of the entire platform.

| Endpoint           | Status | Description      |
| ------------------ | ------ | ---------------- |
| GET /tasks         | ✅    | Fully implemented |
| GET /tasks/{id}    | ✅    | Fully implemented |
| POST /tasks        | ✅    | **Implemented** |
| DELETE /tasks/{id} | ✅    | **Implemented** |
| PATCH /tasks/{id}  | ✅    | **Implemented** |
| GET /executions    | ✅    | Fully implemented |
| GET /incidents     | ⚠️   | Partially implemented |
| POST /incidents    | ❌   | Not implemented |
| GET /packs         | ⚠️   | Partially implemented |
| POST /packs        | ❌   | Not implemented |
| GET /prompts       | ⚠️   | Partially implemented |
| POST /cost-reports | ❌   | Not implemented |
| GET /webhooks      | ✅    | Fully implemented |
| POST /webhooks     | ✅    | **Implemented** |
| DELETE /webhooks/{id} | ✅ | **Implemented** |
| GET /admin/workers | ⚠️   | Partially implemented |
| POST /admin/config | ❌   | Not implemented |
| GET /admin/rollouts | ⚠️  | Partially implemented |
| GET /admin/tenants | ❌   | Not implemented |
| GET /admin/budgets | ❌   | Not implemented |

#### Implemented Updates (2026-04-20)

The following endpoints have been implemented in `src/platform/interface/api/http-server/task-routes.ts`:

| Endpoint           | Method | Status | Implementation Location       |
| ------------------ | ------ | ------ | ----------------------------- |
| POST /tasks        | CREATE | ✅    | task-routes.ts:286-319       |
| POST /v1/tasks     | CREATE | ✅    | task-routes.ts:321-354       |
| PATCH /tasks/{id}  | UPDATE | ✅    | task-routes.ts:356-397       |
| PATCH /v1/tasks/{id} | UPDATE | ✅   | task-routes.ts:399-440       |
| DELETE /tasks/{id} | DELETE | ✅    | task-routes.ts:442-473       |
| DELETE /v1/tasks/{id} | DELETE | ✅   | task-routes.ts:475-506       |

**Implementation Details**:
- `POST /tasks` — Create new task, default status is `queued`, default source is `user`
- `PATCH /tasks/{id}` — Supports updating `title`, `status`, `priority`, `outputJson` fields
- `DELETE /tasks/{id}` — Soft delete (status changed to `cancelled`), preserving audit trail
- Authorization levels: `POST`/`PATCH` require `operator` role, `DELETE` requires `admin` role
- Input validation uses Zod schemas (`parseCreateTaskPayload`/`parseUpdateTaskPayload`)

The following endpoints have been implemented in `src/platform/interface/api/http-server/webhook-routes.ts`:

| Endpoint              | Method | Status | Implementation Location       |
| --------------------- | ------ | ------ | ----------------------------- |
| GET /webhooks        | READ   | ✅    | webhook-routes.ts:43-51      |
| POST /webhooks       | CREATE | ✅    | webhook-routes.ts:52-74      |
| DELETE /webhooks/{id} | DELETE | ✅    | webhook-routes.ts:76-96      |
| GET /v1/webhooks     | READ   | ✅    | webhook-routes.ts:98-106     |
| POST /v1/webhooks    | CREATE | ✅    | webhook-routes.ts:107-130    |
| DELETE /v1/webhooks/{id} | DELETE | ✅  | webhook-routes.ts:131-151    |

**Implementation Details**:
- `POST /webhooks` — Register new webhook endpoint, supporting `algorithm` (none/sha256_hmac), `signingSecret`, `signatureHeader` and other configurations
- `DELETE /webhooks/{id}` — Delete specified endpoint, requires `admin` role
- `GET /webhooks` — List all registered webhook endpoints
- Authorization levels: `GET` requires `viewer` role, `POST` requires `operator` role, `DELETE` requires `admin` role
- Test coverage: `tests/unit/platform/interface/api/http-server/webhook-routes.test.ts` (13 test cases)

#### Detailed Solution

All REST routes need to be supplemented in `src/platform/interface/api-gateway/`. Recommended batch implementation by priority:

**P0 (Core CRUD)**: ~~POST /tasks, DELETE /tasks/{id}~~ ✅ Implemented — Task creation and deletion are the most basic operations
**P1 (Operations Observability)**: POST /incidents, GET /admin/workers, POST /admin/config — Event response and operations management
**P2 (Ecosystem Support)**: POST /packs, POST /webhooks, DELETE /webhooks/{id} — Business pack and webhook management
**P3 (Governance & Compliance)**: GET /admin/tenants, GET /admin/budgets, POST /cost-reports — Multi-tenant and cost management

Each endpoint should follow a unified pattern:

1. Route registration → 2. Input validation (using existing contracts types) → 3. Policy check (delegated to policy-engine) → 4. Business logic → 5. Audit logging → 6. Standard response format

---

### §7 Communication Mechanisms

**Implementation Status**: 75% (3/4 mechanisms implemented)

| Mechanism           | Status              |
| ------------------ | ------------------- |
| Event Bus (in-process) | ✅ Implemented    |
| Message Queue (cross-service) | ✅ Implemented |
| Request/Reply      | ✅ Implemented      |
| Outbox Pattern      | ⚠️ **Concept exists but not implemented** |

#### Discovered Issues

**Outbox Pattern Not Implemented as Independent Component**

- Architecture document requirement: Transactional outbox table + async poller to ensure reliable event delivery
- Actual state: Events sent directly to Event Bus, no outbox table to guarantee transactional consistency

#### Detailed Solution

```typescript
// src/platform/shared/outbox/outbox-poller.service.ts
// 1. Create outbox table in database (event_id, aggregate_type, payload, created_at, published_at)
// 2. Business write writes outbox row in same transaction
// 3. Poller service polls rows with published_at IS NULL, marks as published after sending to Event Bus
// 4. Configure polling interval, batch size, retry strategy
```

---

### §8 Scalability

**Implementation Status**: 67% (4/6 mechanisms implemented)

| Mechanism                 | Status      |
| ------------------------- | ----------- |
| Horizontal Scaling (Worker Pool) | ✅ |
| Partition Strategy (aggregate_type) | ⚠️ Partial |
| Backpressure              | ✅          |
| Cache Layer               | ✅          |
| Queue Partitioning        | ⚠️ Partial  |
| Auto-scaling Strategy     | ❌ Not Implemented |

#### Detailed Solution

Queue partitioning requires configuring independent consumer groups by `aggregate_type` in dispatch-engine. Auto-scaling strategy requires triggering HPA events based on queue depth and Worker utilization.

---

### §9 Seven Layers of Stability Protection

**Implementation Status**: 100% — All 7 layers implemented

| Layer       | Component           | Status |
| ----------- | ------------------- | ------ |
| L1 Input Validation | Schema Validation | ✅   |
| L2 Rate Limiting   | Rate Limiter      | ✅   |
| L3 Circuit Break   | Circuit Breaker   | ✅   |
| L4 Isolation       | Bulkhead Isolation | ✅   |
| L5 Timeout        | Timeout Manager   | ✅   |
| L6 Retry         | Retry with Backoff | ✅   |
| L7 Degradation   | Graceful Degradation | ✅ |

This is the most complete implementation area of the entire platform, no improvements needed.

---

## II. Core Functionality Layer §10-§23

### §10 Risk Control

**Implementation Status**: 80%

Core risk control logic implemented, including risk assessment engine, policy execution, and approval flow triggering.

#### Discovered Issues

- Naming inconsistency with architecture document: Code uses `RiskAssessor` while document defines `RiskEvaluationEngine`
- Risk level enum missing `CRITICAL` level (document defines 4 levels: LOW/MEDIUM/HIGH/CRITICAL, code only has 3 levels)
- Risk matrix configuration hardcoded, not dynamically loaded from config-manager

#### Detailed Solution

1. Unify naming: Rename `RiskAssessor` to `RiskEvaluationEngine`, update all references
2. Add `CRITICAL` risk level, corresponding to automatically triggering incident + full execution suspension
3. Migrate risk matrix to `config/risk/default.json`, load through config-manager with hot-update support

---

### §11 Security System

**Implementation Status**: 85%

AuthN/AuthZ, sandbox isolation, key management, audit trail all implemented.

#### Discovered Issues

**Issue: Sandbox Tier Missing Level 4**

- Architecture document defines 4 sandbox layers: `none` / `process` / `container` / `scoped_external_access`
- Code only implements 3 layers: `none` / `process` / `container`
- `scoped_external_access` layer (allowing controlled external API calls) completely missing

#### Detailed Solution

```typescript
// src/platform/execution/sandbox-runtime/tiers/scoped-external-access.ts
// Based on container sandbox, add:
// 1. External API whitelist — Read allowed domain list from pack manifest
// 2. Outbound traffic proxy — All external requests go through egress proxy, audit logged
// 3. Response filtering — Strip sensitive headers, limit response body size
// 4. Rate limiting — Independent rate limit for each external API

export class ScopedExternalAccessSandbox extends ContainerSandbox {
  private allowedDomains: string[];
  private egressProxy: EgressProxy;

  async validateOutboundRequest(url: string): Promise<boolean> {
    const domain = new URL(url).hostname;
    return this.allowedDomains.includes(domain);
  }
}
```

---

### §12 Exception Handling

**Implementation Status**: 85%

Exception recovery, retry strategy, DLQ delivery, observability alerting chain all implemented.

#### Discovered Issues

- Exception classification system basically complete, but missing distinction between `TransientExternalError` and `PermanentExternalError`
- Exception recovery strategy table hardcoded in code, not made into configurable rules engine

#### Detailed Solution

1. Add `TRANSIENT_EXTERNAL` / `PERMANENT_EXTERNAL` classification to exception type enum
2. Migrate recovery strategy table to `config/exception-recovery/default.json`, supporting matrix configuration by exception type × risk level

---

### §13 OAPEFLIR Orchestration Engine

**Implementation Status**: 98% — Strongest implementation area

68+ files covering all 8 orchestration stages: Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release.

#### Discovered Issues

- ~~Only `Improve` stage auto-optimization suggestions generated as placeholder (returns fixed template)~~ ✅ Fixed
- ~~Cross-stage state transitions missing explicit state machine definition~~ ✅ Fixed

#### Completed Fixes

**Fix 1: LLM-powered Improve Stage Implementation**

Created `src/platform/orchestration/oapeflir/learn/llm-improvement-generation-service.ts` implementing:

1. **LLM Generated Optimization Suggestions** — Using `UnifiedChatProvider` to call Claude model for context-aware optimization suggestions
2. **Prompt Engineering** — Building specialized system prompt and user prompt guiding LLM to generate `LearningObject` compliant with platform context
3. **Response Parsing** — Parsing and validating `LearningObject` structure from LLM's JSON response
4. **Fallback Mechanism** — Auto-degrade to template generation when LLM call fails, ensuring service availability

```typescript
// src/platform/orchestration/oapeflir/learn/llm-improvement-generation-service.ts
export class LLMImprovementGenerationService {
  async generateImprovements(signals: readonly LearningSignal[]): Promise<LearningObject[]>
  // Use LLM to analyze signals, generate context-aware recommendations
  // Fallback to template suggestions on failure
}
```

Integrated into `StrategyLearningService`:
- `learnAsync()` — Async method, using LLM to generate optimization suggestions for non-failure_pattern signals
- `learnSync()` — Sync method, only processes failure_pattern (maintains backward compatibility)

**Fix 2: Explicit Stage Transition FSM**

Created `src/platform/orchestration/oapeflir/stage-transition-fsm.ts` implementing:

1. **8-Stage State Machine** — Complete O→A→P→E→F→L→I→R stage transition definition
2. **Legal Predecessors/Successors** — Allowed predecessor and successor stages for each stage
3. **Transition Guard** — `canTransitionTo()` checks transition legality (no skipping or rolling back)
4. **Entry Condition Validation** — Check predecessor stage status (completed/skipped) and validation requirements
5. **Execution Summary** — `getExecutionSummary()` returns execution status and timestamps for all stages

```typescript
// src/platform/orchestration/oapeflir/stage-transition-fsm.ts
export const OAPEFLIR_STAGES = [
  "observe", "assess", "plan", "execute",
  "feedback", "learn", "improve", "release",
] as const;

export class StageTransitionFSM {
  canTransitionTo(targetStage): StageTransitionResult
  recordStageEntry(stage, status)
  recordStageCompletion(stage)
  recordStageSkipped(stage, reasonCode)
  recordStageError(stage)
  getNextStage(): OapeflirStage | null
  isComplete(): boolean
}
```

---

### §14 Runtime Execution

**Implementation Status**: 90%

Dispatch Engine, Worker Pool, Lease Manager, heartbeat mechanism, task scheduling all implemented.

#### Discovered Issues

- In Worker's graceful shutdown logic, there's a race window for checkpoint saving of current task
- Task reassignment delay can reach 30s when lease renewal fails (document requires < 10s)

#### Detailed Solution

1. In SIGTERM handler, first pause accepting new tasks, release lease only after current task checkpoint completes
2. Shorten lease TTL from 30s to 10s, renewal interval from 10s to 3s

---

### §15 LLM Provider Management

**Implementation Status**: Fully Implemented

Model Gateway implemented, including multi-provider routing, model selection, and call abstraction layer.

#### Completed Fixes

**Fix 1: D0-D4 Five-Level Degradation Model Complete Implementation**

Created `src/platform/model-gateway/degradation/degradation-controller.ts` implementing:

1. **DegradationLevel Enum** — D0/D1/D2/D3/D4 five-level degradation strategy
2. **DegradationController Routing Logic**:
   - D0: Primary model normal call, response auto-cached for D2
   - D1: Backup model degradation call
   - D2: Cache hit directly returns cached response
   - D3: Uses predefined template response (categorized by taskType)
   - D4: Throws `ProviderError` indicating service unavailable
3. **Health Evaluation and Auto Escalation/De-escalation**:
   - Based on error rate (>50% triggers escalation, <5% triggers de-escalation)
   - Based on latency P99 (>5000ms triggers escalation)
   - Auto-deescalation after 3 consecutive health checks pass
4. **Configurable Templates** — `DEFAULT_TEMPLATE_RESPONSES` provides degradation copy by taskType
5. **Manual Level Control** — `setLevel()` supports manual intervention, `reset()` restores D0

```typescript
// Lifecycle: D0 → D1 → D2 → D3 → D4 (escalation only)
//          D4 ← D3 ← D2 ← D1 ← D0 (deescalation on health)
export class DegradationController {
  async route(request: LLMDegradationRequest): Promise<LLMDegradationResponse>
  evaluateHealth(metrics: ProviderMetrics): { action, newLevel, reason }
  escalate(): void
  deescalate(): void
  setLevel(level: DegradationLevel): void
  reset(): void
}
```

Backward compatible: Existing `ModelGatewayFallbackService` and `ModelGatewayCacheService` remain unchanged, new `DegradationController` serves as upper-level orchestration.

---

### §16 Prompt Management

**Implementation Status**: 70%

Prompt Engine directory exists, basic prompt template loading and variable substitution implemented.

#### Discovered Issues

- Missing `PromptBundle` type (document defines as combination of system prompt + user prompt + few-shot examples + constraints)
- Prompt version management only at file level, not implementing semantic version numbers + A/B testing traffic split
- Prompt Registry is simple Map structure, not supporting hierarchical lookup by domain/task-type

#### Detailed Solution

1. Define `PromptBundle` interface and register in `src/platform/contracts/`
2. Implement prompt version management: `v{major}.{minor}` semantic versioning + traffic split configuration
3. Change Registry to hierarchical structure: `global → domain → pack → task-type`, supporting inheritance and override

---

### §17 Model Evaluation

**Implementation Status**: 80%

Evaluation Service implemented, supporting custom evaluation metrics and batch evaluation.

#### Discovered Issues

- Quality Gate is stub implementation, `evaluate()` method directly returns `{ passed: true }`
- Missing evaluation result persistence to evidence store

#### Detailed Solution

1. Quality Gate should make actual judgment based on evaluation metric thresholds (loaded from config)
2. Evaluation results written to `src/platform/state-evidence/artifacts/` as evidence records

---

### §18 Cost Management

**Implementation Status**: 70%

Billing module exists but in wrong location.

#### Discovered Issues

- Billing code located in `src/scale-ecosystem/` rather than location specified in architecture document `src/platform/control-plane/`
- Missing real-time cost alerting (only post-hoc statistics)
- Token usage tracking granularity to task level, document requires to step level

#### Detailed Solution

1. Migrate billing core logic to `src/platform/control-plane/billing-service/`, `scale-ecosystem` retains multi-region billing aggregation
2. Add real-time cost alerting: Accumulate cost after each LLM call, trigger `cost.threshold.exceeded` event when exceeding threshold
3. Reduce token tracking granularity from task to step/execution level

---

### §19 Agent Delegation

**Implementation Status**: 25% — Weakest area

#### Discovered Issues

**Severe Deficiency**: Only one ~50-line type definition file, no runtime logic whatsoever.

Missing content:

- Agent topology constraints (max depth, fanout limits, cycle detection)
- Agent collaboration protocol (message passing, context sharing, result aggregation)
- Delegation context security (permission inheritance and narrowing, sandbox passing)
- Delegation chain tracking (parent-child relationship, call stack visualization)

#### Detailed Solution

```typescript
// src/platform/orchestration/agent-delegation/delegation-manager.service.ts
export class DelegationManagerService {
  private readonly MAX_DEPTH = 5;
  private readonly MAX_FANOUT = 10;

  async delegate(
    parent: AgentContext,
    childSpec: DelegationSpec,
  ): Promise<DelegationHandle> {
    // 1. Topology check
    if (parent.delegationDepth >= this.MAX_DEPTH) {
      throw new DelegationDepthExceededError(parent.delegationDepth);
    }
    if (parent.activeDelegations.length >= this.MAX_FANOUT) {
      throw new DelegationFanoutExceededError(parent.activeDelegations.length);
    }
    this.detectCycle(parent, childSpec.targetAgentId);

    // 2. Permission narrowing
    const childPermissions = this.narrowPermissions(
      parent.permissions,
      childSpec.requiredPermissions,
    );

    // 3. Context isolation
    const childContext = this.createIsolatedContext(
      parent,
      childPermissions,
      childSpec,
    );

    // 4. Create delegation record
    const handle = await this.truthStore.createDelegation({
      parentId: parent.agentId,
      childId: childSpec.targetAgentId,
      depth: parent.delegationDepth + 1,
      permissions: childPermissions,
      timeout: childSpec.timeout,
    });

    // 5. Dispatch execution
    await this.dispatchEngine.enqueue(childContext);
    return handle;
  }
}
```

New files needed:

- `delegation-manager.service.ts` — Delegation manager main logic
- `topology-validator.ts` — Topology constraints (depth/fanout/cycle detection)
- `context-isolator.ts` — Context security isolation
- `delegation-tracker.ts` — Delegation chain tracking and visualization data structures

---

### §20 Long-Running Tasks

**Implementation Status**: 90%

Hibernation and Checkpoint mechanisms are solid.

#### Discovered Issues

- Checkpoint storage format not standardized, different worker implementations may be incompatible
- Missing checkpoint size limit and compression strategy

#### Detailed Solution

1. Define standard `CheckpointEnvelope` format (version + schema + compressed payload + metadata)
2. Add zstd compression, checkpoint upper limit configured as 10MB

---

### §21 Human-in-the-Loop (HITL)

**Implementation Status**: 85%

Core approval workflow implemented, supporting single-person approval and timeout escalation.

#### Discovered Issues

- Missing multi-party approval: Document requires supporting N-of-M approval mode
- Approval UI data missing context summary generation (approver needs to manually review all execution logs)

#### Detailed Solution

1. Extend ApprovalRequest to support `requiredApprovals: number` and `approverGroups: string[]`
2. When approval request is created, call LLM to generate execution summary, attach to approval payload

---

### §22 SDK System

**Implementation Status**: 75%

| SDK Component | Status | Description         |
| ------------ | ------ | ------------------ |
| CLI         | ✅    | 79 entry points, complete functionality |
| Pack SDK    | ⚠️   | Minimal stub implementation |
| Plugin SDK  | ⚠️   | Minimal stub implementation |
| Client SDK  | ⚠️   | Minimal stub implementation |

#### Discovered Issues

CLI is the only complete component in the entire SDK system. Pack SDK / Plugin SDK / Client SDK only have type exports and basic scaffolding.

#### Detailed Solution

Prioritize supplementing **Pack SDK** (most commonly used by business pack developers):

1. `createPack()` — Scaffold generation
2. `validateManifest()` — Manifest validation
3. `testLocal()` — Local sandbox testing
4. `publish()` — Publish to registry

Then supplement **Plugin SDK**:

1. `definePlugin()` — Plugin definition DSL
2. `PluginContext` — Runtime context injection
3. `PluginTestHarness` — Testing tool

---

### §23 Compliance System

**Implementation Status**: 70%

Basic compliance checks, data erasure, audit trail implemented.

#### Discovered Issues

**Key Missing: Crypto-shredding**

- Architecture document requirement: Use DEK (Data Encryption Key) to encrypt personal data, destruction only requires deleting DEK
- Actual implementation: Directly erase data records (DELETE operation), no encryption layer

This means:
- Cannot guarantee complete destruction of backed-up/copied data
- Does not comply with GDPR "right to be forgotten" best practices

#### Detailed Solution

```typescript
// src/platform/compliance/crypto-shredding/
// 1. DEK Manager — Generate independent DEK for each data subject
// 2. Encryption Interceptor — Encrypt PII fields before writing to truth store using DEK
// 3. Destruction Service — Deleting DEK equals destroying all data encrypted with that DEK
// 4. Key Rotation — Periodically rotate DEK, re-encrypt active data

export class CryptoShreddingService {
  async shred(subjectId: string): Promise<ShredResult> {
    const dekId = await this.dekStore.findBySubject(subjectId);
    await this.dekStore.destroy(dekId); // DEK destroyed = data irrecoverable
    await this.auditTrail.record({
      action: "crypto_shred",
      subjectId,
      dekId,
      timestamp: new Date().toISOString(),
    });
    return { status: "shredded", dekId };
  }
}
```

---

## III. Infrastructure and Domain Layer §24-§38

### §24 Configuration Governance

**Implementation Status**: 60%

Config Manager exists, supporting JSON config loading and environment overrides.

#### Discovered Issues

1. **Missing Multi-layer Configuration System**: Document defines 4 layers: `platform → tenant → pack → task-type`, code only has `platform` layer
2. **Missing Configuration Change Events**: No `config.changed` event sent after config update, downstream services cannot respond dynamically
3. **Missing Configuration Canary Release**: Document requires configuration change support for canary release (first 5% → 25% → 100%), code is full immediate effect

#### Detailed Solution

1. Extend config loading logic to support 4-layer merge: `deepMerge(platform, tenant, pack, taskType)`
2. After config-manager write operation, publish `config.changed` event to Event Bus
3. Reuse rollout-controller's canary capability, add `ConfigRolloutStrategy` for configuration changes

---

### §25 Data Consistency

**Implementation Status**: 80%

Event sourcing foundation and projection mechanism established.

#### Discovered Issues

- Projection rebuild only has method signature, no complete implementation
- Transaction guarantees not explicitly declared (document requires event append + outbox write in same transaction)

#### Detailed Solution

1. Implement complete projection rebuild: Full replay from event store, rebuild state by projection handler
2. Use database transaction to wrap event write + outbox write in event append method

---

### §26 Storage Layer

**Implementation Status**: 70%

#### Discovered Issues

**Key Missing: 30/71 Tables Not Implemented**

41 tables implemented, 30 missing. Main missing areas:

- Multi-tenant related: `tenants`, `tenant_quotas`, `tenant_billing`
- Cost management: `cost_reports`, `budget_alerts`, `token_usage_daily`
- Marketplace: `marketplace_listings`, `pack_reviews`, `pack_downloads`
- Agent delegation: `delegations`, `delegation_events`
- Prompt management: `prompt_bundles`, `prompt_versions`, `prompt_ab_tests`

**PostgreSQL Migration Lag**

- Code declares PostgreSQL support, but migration files only cover 3 tables (tasks, executions, events)
- Remaining 38 implemented tables only have SQLite schema

#### Detailed Solution

1. Create missing table schemas by priority in batches:
   - P0: `delegations`, `prompt_bundles` (blocking §19 and §16 completion)
   - P1: `tenants`, `tenant_quotas` (blocking multi-tenant functionality)
   - P2: Remaining Marketplace and statistics tables
2. Use migration tool to generate PG migration scripts for all 41 implemented tables
3. Add migration CI check: Each schema change must submit SQLite + PG migration together

---

### §27 SLO Framework

**Implementation Status**: 70%

SLO definition and metrics collection framework established, integrated with Prometheus.

#### Discovered Issues

- Missing P99 latency enforcement per stage (OAPEFLIR 8 stages)
- Missing LLM call latency breakdown (network latency vs inference latency vs token generation latency)
- Error budget calculation exists but no auto-degradation trigger

#### Detailed Solution

1. Add `stage_duration_seconds` histogram at OAPEFLIR each stage entry/exit
2. In model-gateway call chain, record `llm_ttfb_seconds` (time to first byte) and `llm_total_seconds`
3. When error budget exhausted, auto-trigger rollout freeze + notify on-call

---

### §28 Events and Projections

**Implementation Status**: 55%

#### Discovered Issues

**Event Namespace Missing 9/25**

16 namespaces implemented:
`task.*`, `execution.*`, `approval.*`, `policy.*`, `incident.*`, `config.*`, `audit.*`, `worker.*`, `dispatch.*`, `plugin.*`, `rollout.*`, `circuit.*`, `dlq.*`, `backpressure.*`, `lease.*`, `heartbeat.*`

9 missing:
`delegation.*`, `prompt.*`, `cost.*`, `tenant.*`, `pack.*`, `marketplace.*`, `slo.*`, `compliance.*`, `knowledge.*`

**Projection Missing 2/9**

- 7 projections implemented: TaskSummary, ExecutionTimeline, WorkerStatus, IncidentBoard, PolicyAudit, RolloutProgress, SystemHealth
- Missing: `CostDashboard`, `DelegationTree`

**DLQ Event Fields Incomplete**

- Missing `original_timestamp`, `failure_category`, `retry_exhausted_at` fields

#### Detailed Solution

1. Define event schema for 9 missing namespaces (in `src/platform/state-evidence/events/namespaces/`)
2. Implement `CostDashboard` and `DelegationTree` projection handlers
3. Extend DLQ event structure, add 3 missing fields

---

### §29 Knowledge and Memory

**Implementation Status**: 75%

Knowledge Store and Memory management implemented, supporting vector retrieval and context injection.

#### Discovered Issues

- Trust level naming inconsistent: Document `verified/unverified/deprecated`, code `high/medium/low`
- Memory layer naming inconsistent: Document `working/episodic/semantic`, code `short_term/long_term/persistent`

#### Detailed Solution

Unify to document-defined naming, add mapping layer for backward compatibility with existing data:

```typescript
const TRUST_LEVEL_MAP = {
  high: "verified",
  medium: "unverified",
  low: "deprecated",
};
const MEMORY_LAYER_MAP = {
  short_term: "working",
  long_term: "episodic",
  persistent: "semantic",
};
```

---

### §30 Business Pack

**Implementation Status**: 50%

#### Discovered Issues

1. **Model Mismatch**: Code uses `DomainDefinition` while document defines `BusinessPackManifest`, fields significantly different
2. **Lifecycle Simplified**: Document defines 6 stages (draft → review → approved → published → deprecated → archived), code only has 4 stages (draft → active → deprecated → archived), missing `review` and `approved`
3. **Manifest Validation Insufficient**: Manifest validation only checks required fields, doesn't check dependency declarations, permission declarations, sandbox requirements

#### Detailed Solution

1. Define `BusinessPackManifest` interface and migrate from `DomainDefinition`
2. Add `review` and `approved` lifecycle stages, connect to approval-manager
3. Enhance manifest validation: Check dependency existence, permission minimization, sandbox tier reasonableness

---

### §31 Disaster Recovery

**Implementation Status**: 70%

HA configuration and backup scripts already exist in `deploy/` directory.

#### Discovered Issues

- Missing DR drill automation (document requires monthly automated disaster recovery drill)
- Backup recovery RTO/RPO not verified (no automated recovery test)

#### Detailed Solution

1. Add `dr-drill.sh` automation script in `deploy/scripts/`
2. Add CI job to execute backup recovery verification monthly, record actual RTO/RPO

---

### §32 Deployment Strategy

**Implementation Status**: 80%

| Tier     | Status       | Description                    |
| -------- | ------------ | ------------------------------ |
| D1 Single Node | ✅ Active | Docker Compose config complete |
| D2 Cluster | ✅ Ready  | Helm chart + K8s manifests    |
| D3 Multi-Region | ⚠️ Design Phase | Terraform templates exist but not verified |
| 5 Environments | ✅    | dev/staging/preprod/prod/dr   |

#### Discovered Issues

- D3 multi-region deployment data sync strategy not implemented (only Terraform infrastructure template exists)
- Environment config difference management relies on manual JSON overlay

#### Detailed Solution

1. Implement cross-region event replication (CDC stream based on event store)
2. Use Kustomize overlay or Helm values files to manage environment differences

---

### §33 Roadmap

**Implementation Status**: Informational section

Phase 1-3 correspond to actual implemented features, Phase 4 partially implemented, Phase 5-7 are scaffold code. Consistent with current codebase state.

---

### §34 Glossary / §36 Version Log

**Implementation Status**: ✅ Document-based section, no code implementation required

---

### §35 Directory Structure

**Implementation Status**: 95%

#### Discovered Issues

- 5 directories defined in document but missing in code:
  - `src/platform/cost-management/` — Cost management (actually in `scale-ecosystem/`)
  - `src/platform/agent-delegation/` — Agent delegation (only type files exist)
  - `src/platform/prompt-registry/` — Prompt registry (in `prompt-engine/`)
  - `src/testing/` — Testing utilities
  - `src/benchmarks/` — Performance benchmarks

- 15+ directories exist in code but not defined in document (all reasonable extensions)

#### Detailed Solution

Create missing directories per document and migrate related code, or update document to reflect actual structure choices.

---

### §37 Domain Modeling

**Implementation Status**: 65%

All 8 core domain concepts exist, but implementation significantly simplified.

#### Discovered Issues

| Domain Concept | Document Fields | Implemented Fields | Missing    |
| -------------- | ---------------- | ------------------ | ---------- |
| Task      | 22         | 14         | 8 fields  |
| Execution | 18         | 12         | 6 fields  |
| Agent     | 15         | 8          | 7 fields  |
| Pack      | 20         | 10         | 10 fields |
| Policy    | 12         | 9          | 3 fields  |
| Incident  | 16         | 10         | 6 fields  |
| Approval  | 14         | 8          | 6 fields  |
| Tenant    | 18         | 6          | 12 fields |

**Tenant Model Most Simplified** (only 6/18 fields), missing quotas, billing, SLA and other critical attributes.

#### Detailed Solution

Supplement fields by priority:

1. **Tenant**: Supplement `quotas`, `billingPlan`, `slaLevel`, `allowedRegions` and other 12 fields
2. **Pack**: Supplement `dependencies`, `sandboxRequirements`, `requiredPermissions` and other 10 fields
3. **Agent**: Supplement `delegationConstraints`, `autonomyLevel`, `trustScore` and other 7 fields
4. Gradually complete remaining models

---

### §38 Domain Onboarding

**Implementation Status**: 80%

4-stage onboarding model (Define → Validate → Deploy → Monitor) implemented.

#### Discovered Issues

- Gate check (stage gate check) too simple: Only checks required fields, doesn't check runtime compatibility
- Missing onboarding rollback mechanism (once Deploy stage fails, manual cleanup needed)

#### Detailed Solution

1. Gate check additions: Dependency resolution validation, sandbox compatibility test, resource quota pre-check
2. Record rollback point at each stage, auto-rollback to previous stage on failure

---

## IV. Upper Interaction and Ecosystem Layer §39-§69

> This section covers upper-layer modules such as natural language interaction, organization governance, ecosystem marketplace, and operations maturity.
> Common pattern: Most modules adopt "thin sub-component index.ts (3-20 lines) + thick orchestration service (100-600+ lines)" structure.

### §39 Natural Language Gateway (NL Gateway)

**Implementation Status**: 80% (553 lines)

Intent parsing, entity extraction, conversation state management implemented.

#### Discovered Issues

- Multi-turn conversation context window management hardcoded to 10 turns, not loaded from config
- Missing intent disambiguation interaction (when confidence < threshold, should proactively confirm with user)

#### Detailed Solution

1. Migrate conversation window size to config, support per task-type configuration
2. Add `DisambiguationHandler`: When confidence < 0.7, generate clarification question to return to user

---

### §40 Goal Decomposer

**Implementation Status**: 80% (427 lines)

Goal-to-subtask decomposition logic implemented, supporting tree decomposition.

#### Discovered Issues

- Decomposition depth unlimited, theoretically can recurse infinitely
- Subtask dependency relationships only support sequential execution, not DAG parallel

#### Detailed Solution

1. Add max decomposition depth config (recommended default 5 layers)
2. Extend subtask relationship model to support `depends_on: string[]`, execute independent subtasks in parallel via DAG topological sort during scheduling

---

### §41 Proactive Agent

**Implementation Status**: 75% (379 lines)

Trigger condition evaluation and proactive suggestion generation implemented.

#### Discovered Issues

- Proactive trigger frequency unlimited, may cause notification fatigue
- Missing user preference learning (which proactive suggestions are adopted/ignored)

#### Detailed Solution

1. Add trigger frequency limit: Same type of suggestion at most N times per hour
2. Record user responses to proactive suggestions, feedback to Feedback Loop (§56) to adjust trigger strategy

---

### §42 Autonomy Level

**Implementation Status**: 75% (328 lines)

L0-L4 five-level autonomy level definition and switching logic implemented.

#### Discovered Issues

- Autonomy level escalation/de-escalation conditions are static rules, missing dynamic adjustment based on historical performance
- Missing autonomy level change audit record

#### Detailed Solution

1. Integrate agent historical success rate and risk event count, dynamically calculate recommended autonomy level
2. Write to audit trail when autonomy level changes

---

### §43 Dashboard

**Implementation Status**: 75% (372 lines)

Dashboard data aggregation and API implemented.

#### Discovered Issues

- Data refresh is full query, no incremental update mechanism
- Missing real-time WebSocket push

#### Detailed Solution

1. Use projection as dashboard data source, naturally supports incremental updates
2. Add WebSocket channel, push deltas to frontend when projection updates

---

### §44 UX Flow

**Implementation Status**: 75% (538 lines)

User interaction flow definition and state management implemented.

#### Discovered Issues

- No A/B testing framework support
- Missing user operation tracking

#### Detailed Solution

1. Reuse rollout-controller's traffic split capability to implement UX A/B testing
2. Add event tracking at key interaction nodes, send to event bus

---

### §45 Conversation Experience

**Implementation Status**: 70% (~200 lines)

Basic conversation management implemented, but thin functionality.

#### Discovered Issues

- Missing conversation history persistence (lost after restart)
- Missing conversation template system

#### Detailed Solution

1. Write conversation history to memory store (§29)
2. Conversation templates managed by prompt-engine

---

### §46 Organization Model

**Implementation Status**: 80% (639 lines)

Organization hierarchy, roles, permission model implemented.

#### Discovered Issues

- Organization hierarchy only supports 3 layers (org → team → member), document defines 5 layers (org → division → department → team → member)
- Missing cross-organization collaboration model

#### Detailed Solution

1. Extend organization hierarchy to support 5 layers, middle 2 layers optional
2. Add guest role for cross-organization collaboration (guest role with scoped permissions)

---

### §47 Approval Policy

**Implementation Status**: 70% (~150 lines)

Basic approval rules engine implemented.

#### Discovered Issues

- Approval policy hardcoded if-else, not rules engine driven
- Missing approval policy version management

#### Detailed Solution

1. Migrate approval rules to declarative JSON configuration, executed by policy-engine
2. Approval policies under version control, changes require approval flow

---

### §48 SSO/SCIM

**Implementation Status**: 30% (86 lines) — Severely insufficient

#### Discovered Issues

**Only schema definition, no actual protocol processing logic**

- No SAML/OIDC protocol implementation
- No SCIM user/group sync endpoints
- No token validation and session management

#### Detailed Solution

Recommended two-phase implementation:

1. **P0 — OIDC Integration**: Use `openid-client` library to implement authorization code flow, connect to enterprise IdP
2. **P1 — SCIM Endpoints**: Implement `/scim/v2/Users` and `/scim/v2/Groups` CRUD, support incremental sync

---

### §49 Permission Delegation

**Implementation Status**: 65% (~130 lines)

Basic permission delegation logic exists.

#### Discovered Issues

- Delegation depth unlimited
- Missing permission revocation mechanism (auto-revoke after delegation expires)

#### Detailed Solution

1. Add delegation depth limit (default 3 layers)
2. Add `expiresAt` field to delegation records, scheduled task scans expired delegations and revokes

---

### §50 Compliance Audit

**Implementation Status**: 70% (~140 lines)

Audit log recording and querying implemented.

#### Discovered Issues

- Audit log has no tamper-proof protection (can be directly modified)
- Missing automated audit report generation

#### Detailed Solution

1. Add hash chain to audit logs (each record contains hash of previous record), prevent tampering
2. Generate compliance audit reports on schedule, output as PDF/CSV

---

### §51 Delegation Governance

**Implementation Status**: 40% (78 lines)

Only basic type definitions.

#### Discovered Issues

- Governance rules engine missing
- No delegation audit tracking

#### Detailed Solution

Reuse policy-engine's rules engine, define dedicated rule set for delegation governance.

---

### §52-§54 Multi-Region, Ecosystem Cooperation, Cross-Platform

**Implementation Status**: 65% (each 100-180 lines)

#### Discovered Issues (Common)

- Multi-region data sync strategy only has design, no implementation
- Ecosystem cooperation API gateway federation not yet built
- Cross-platform adaptation layer only supports REST, missing gRPC and GraphQL

#### Detailed Solution

1. Multi-region: Implement async replication based on event store CDC
2. Ecosystem cooperation: Add federation routing layer in API Gateway
3. Cross-platform: Add gRPC adapter (using `@grpc/grpc-js`)

---

### §55 Marketplace

**Implementation Status**: 90% (~7,000 lines) — Most complete upper-layer module

Pack publishing, search, rating, download full flow implemented.

#### Discovered Issues

- Missing Pack security review automation (relies on manual review)
- Missing Pack dependency conflict detection

#### Detailed Solution

1. Add automated security scanning: Run sandboxed testing + static analysis at publish time
2. Implement dependency resolver: Detect version conflicts and suggest solutions

---

### §56 Feedback Loop

**Implementation Status**: 80% (739 lines)

Feedback collection, classification, analysis pipeline implemented.

#### Discovered Issues

- Feedback to model fine-tuning closed loop not connected (feedback collected but not used for improvement)
- Missing feedback quality evaluation

#### Detailed Solution

1. Export high-quality feedback as fine-tuning dataset format (JSONL), for model evaluation use
2. Add feedback denoising: Filter duplicate, contradictory, low-information feedback

---

### §57 Version Management

**Implementation Status**: 70% (~120 lines)

Basic version number management exists.

#### Discovered Issues

- Semver enforcement not implemented (arbitrary version numbers allowed)
- Missing version compatibility matrix

#### Detailed Solution

1. Enforce semver format validation
2. Maintain pack version compatibility matrix, check during installation

---

### §58 Authentication System

**Implementation Status**: 70% (~130 lines)

Overlaps with §48 SSO, token management basic implementation.

#### Discovered Issues

- Token refresh mechanism incomplete (need re-login after access token expires)
- Missing API Key management UI

#### Detailed Solution

1. Implement refresh token rotation mechanism
2. Add API Key CRUD endpoints

---

### §59 Multi-Region Expansion

**Implementation Status**: 65% (~140 lines)

Region definition and routing rules implemented.

#### Discovered Issues

- Functional overlap with §52
- Region failover strategy not implemented

#### Detailed Solution

1. Merge §52 and §59 implementations, eliminate duplication
2. Implement region health check + automatic failover

---

### §60 Emergency Response

**Implementation Status**: 75% (225 lines)

Emergency event creation, escalation, notification chain implemented.

#### Discovered Issues

- Missing runbook automation (document references but no execution engine)
- Missing emergency drill functionality

#### Detailed Solution

1. Implement runbook executor: Parse markdown runbook, execute step by step and record results
2. Add emergency drill mode: Simulate event trigger, verify response process

---

### §61 Agent Lifecycle

**Implementation Status**: 75% (216 lines)

Agent registration, start, stop, health check implemented.

#### Discovered Issues

- Missing Agent version management (multiple versions of same Agent coexisting)
- Missing Agent performance profile (which task types this Agent performs best)

#### Detailed Solution

1. Agent version bound at registration, support blue-green deployment
2. Build Agent capability profile based on historical execution data, for intelligent routing

---

### §62 Explainability

**Implementation Status**: 70% (~150 lines)

Decision logging and reasoning chain recording implemented.

#### Discovered Issues

- Explainability output is plain text, missing structured format
- Missing simplified explanations for non-technical users

#### Detailed Solution

1. Define structured explanation format (decision tree JSON)
2. Add explanation simplifier: Convert technical explanations to natural language summary

---

### §63 Drift Detection

**Implementation Status**: 90% (~2,400 lines) — Second most complete upper-layer module

Configuration drift, behavior drift, model drift detection comprehensively implemented.

#### Discovered Issues

- Drift repair only sends alerts, no automatic repair option
- Drift baseline update requires manual operation

#### Detailed Solution

1. Add automatic repair for configuration drift (rollback to baseline config)
2. Provide one-click baseline update command

---

### §64-§68 Debugger, Edge Computing, Monitoring Enhancement, Capacity Planning, Chaos Engineering

**Implementation Status**: 65% (each 100-180 lines)

#### Discovered Issues (Common)

These modules are all in "core framework built, detailed functionality to be added" state:

| Module          | Existing         | Missing                       |
| --------------- | ---------------- | ----------------------------- |
| §64 Debugger   | Breakpoints, variable inspection | Time-travel debugging, remote debugging |
| §65 Edge Computing | Edge node registration   | Offline mode, edge-cloud sync      |
| §66 Monitoring Enhancement | Metrics collection | Anomaly detection ML model, root cause analysis |
| §67 Capacity Planning | Resource statistics | Prediction model, auto-scaling suggestions |
| §68 Chaos Engineering | Fault injection framework | Experiment scheduling, automated steady-state verification |

#### Detailed Solution

Supplement by priority:

1. **P1**: §64 Time-travel debugging (replay event store implementation)
2. **P1**: §66 Anomaly detection (statistical methods based on SLO thresholds, avoid introducing ML dependency)
3. **P2**: §68 Experiment scheduler (reuse scheduler component)
4. **P2**: §65 Offline mode
5. **P3**: §67 Prediction model

---

### §69 Platform Operations Agent

**Implementation Status**: 75% (285 lines)

Automated operations task execution (health check, log analysis, alert response) implemented.

#### Discovered Issues

- Operations Agent autonomy scope not bounded (theoretically can execute any operations)
- Missing operations approval flow (high-risk operations like service restart should require approval)

#### Detailed Solution

1. Define operations whitelist, high-risk operations require approval-manager approval
2. Operations Agent bound to L2 autonomy level (§42), high-risk operations auto-escalate to HITL

---

## V. Summary and Priority Matrix

### 5.1 Global Implementation Status Overview

| Section Range           | Sections | ✅ Fully Complete | ⚠️ Partial | 🔴 Severely Incomplete | Average Alignment |
| ---------------------- | -------- | -------- | ------- | ------------ | ---------- |
| §1-§3 Overview         | 3        | 3        | 0       | 0            | 100%       |
| §4-§9 Platform Infrastructure | 6   | 2        | 4       | 0            | 82%        |
| §10-§23 Core Functionality | 14   | 2        | 11      | 1            | 76%        |
| §24-§38 Infrastructure and Domain | 12 | 2     | 10      | 0            | 71%        |
| §39-§69 Upper Interaction and Ecosystem | 31 | 2    | 27      | 2            | 71%        |
| **Total**              | **66**   | **11**   | **52**  | **3**        | **74%**    |

> §34/§36/§70 are document-based sections, not included in statistics.

### 5.2 Top 5 Strongest Implementation Areas

| Rank | Module              | Alignment | Code Size    | Description                           |
| ---- | ------------------- | --------- | ------------ | -------------------------------------- |
| 1    | §9 Seven Layers of Stability | 100%   | —         | All 7 protection layers fully implemented |
| 2    | §13 OAPEFLIR        | 95%      | 68+ files | 8-stage orchestration engine, core module |
| 3    | §55 Marketplace     | 90%      | ~7,000 lines | Most complete upper-layer module       |
| 4    | §63 Drift Detection | 90%      | ~2,400 lines | Three types of drift detection fully covered |
| 5    | §14 Runtime Execution | 90%   | —         | Dispatch + Worker lifecycle complete  |

### 5.3 Top 5 Weakest Areas

| Rank | Module             | Alignment | Code Size | Impact                         |
| ---- | ------------------ | --------- | --------- | ------------------------------ |
| 1    | §6 API Endpoints   | 60%       | —         | 8/20 endpoints missing, blocking external integration |
| 2    | §19 Agent Delegation | 25%     | ~50 lines | Core orchestration capability missing |
| 3    | §48 SSO/SCIM       | 30%       | 86 lines  | Enterprise integration blocked |
| 4    | §51 Delegation Governance | 40% | 78 lines | Governance compliance risk     |
| 5    | §30 Business Pack   | 50%       | —         | Domain onboarding model mismatch |

### 5.4 Key Missing Items List

| #   | Missing Item                    | Affected Section | Severity      | Estimated Effort |
| --- | ------------------------------- | ---------------- | ------------- | ---------------- |
| 1   | REST API endpoints (10/20 missing) | §6          | P0-Critical   | 5-8 person-days |
| 2   | Agent Delegation Runtime        | §19             | P0-Critical   | 8-12 person-days |
| 3   | LLM D0-D4 Five-Level Degradation | §15           | P0-Critical   | 3-5 person-days |
| 4   | Crypto-shredding                | §23             | P0-Critical   | 5-8 person-days |
| 5   | SSO/SCIM Protocol Implementation | §48          | P1-High       | 8-12 person-days |
| 6   | ProjectionUpdate Contract      | §5              | P1-High       | 1-2 person-days |
| 7   | Storage Layer 30 Tables        | §26             | P1-High       | 5-8 person-days |
| 8   | 9 Event Namespaces             | §28             | P1-High       | 3-5 person-days |
| 9   | BusinessPackManifest           | §30             | P1-High       | 3-5 person-days |
| 10  | Sandbox Tier 4                 | §11             | P1-High       | 3-5 person-days |
| 11  | Pack/Plugin/Client SDK         | §22             | P2-Medium     | 12-20 person-days |
| 12  | Domain Model Field Completion  | §37             | P2-Medium     | 5-8 person-days |
| 13  | Multi-layer Configuration System | §24           | P2-Medium     | 3-5 person-days |
| 14  | Outbox Pattern                 | §7              | P2-Medium     | 3-5 person-days |
| 15  | Prompt Bundle System           | §16             | P2-Medium     | 3-5 person-days |

### 5.5 Implementation Roadmap Recommendations

#### Phase 1 — Core Completion (4-6 weeks)

**Goal**: Eliminate all P0-Critical missing items

| Week   | Task                     | Corresponding Missing Item |
| ------ | ------------------------ | ------------------------- |
| W1-W2  | REST API Endpoint Completion | #1                    |
| W1-W3  | Agent Delegation Complete Implementation | #2          |
| W2-W3  | LLM Five-Level Degradation | #3                     |
| W3-W4  | Crypto-shredding Implementation | #4                |
| W4-W6  | Integration Testing + Regression | —              |

#### Phase 2 — High Priority Completion (4-6 weeks)

**Goal**: Eliminate all P1-High missing items

| Week   | Task                               | Corresponding Missing Item |
| ------ | ---------------------------------- | ------------------------- |
| W1-W3  | SSO/SCIM Protocol Implementation    | #5                        |
| W1-W2  | Storage Layer 30 Tables + PG Migration | #7                   |
| W2-W3  | Event Namespaces + BusinessPackManifest | #8, #9              |
| W3-W4  | ProjectionUpdate + Sandbox Tier 4  | #6, #10                   |
| W4-W6  | Integration Testing + Security Audit | —                    |

#### Phase 3 — Experience Completion (6-8 weeks)

**Goal**: Eliminate P2-Medium missing items + naming unification

| Week   | Task                                  | Corresponding Missing Item    |
| ------ | ------------------------------------- | ----------------------------- |
| W1-W4  | SDK System Completion (Pack → Plugin → Client) | #11                |
| W2-W4  | Domain Model Field Completion          | #12                          |
| W3-W5  | Configuration Governance + Outbox + Prompt Bundle | #13, #14, #15    |
| W5-W6  | Naming Unification (Risk/Memory/Trust etc.) | §10, §29             |
| W6-W8  | Full Regression + Documentation Sync  | —                            |

### 5.6 Common Pattern Observations

1. **Thin Sub-components + Thick Orchestration**: Most modules' sub-components (3-20 line `index.ts`) only do type export, real logic concentrated in one orchestration service. This makes sub-components untestable independently. **Recommendation**: Move business logic down from orchestration service to sub-components.

2. **Contract Dual Definitions**: `contracts/{name}/index.ts` and `contracts/types/platform-contracts.ts` have duplicate definitions. **Recommendation**: Unify to one place, the other does re-export.

3. **Naming Drift**: Multiple places in code have inconsistent naming with architecture document (e.g., `RiskAssessor` vs `RiskEvaluationEngine`). **Recommendation**: Create naming mapping table, unify in batches.

4. **Hardcoded Configuration**: Multiple strategy parameters (risk matrix, autonomy thresholds, retry strategy, etc.) hardcoded in code. **Recommendation**: Unified migration to `config/` directory, loaded through config-manager.

5. **Quality Gate Stub Implementation**: Multiple modules' quality gate checks directly return `true`. **Recommendation**: P1 priority to complete real quality gate logic.

---

> **Review Conclusion**: Platform overall architecture alignment is **74%**. Core orchestration engine (OAPEFLIR) and stability protection are the strongest areas. The 4 most urgent P0 missing items (API endpoints, Agent Delegation, LLM Degradation, Crypto-shredding) should be prioritized in Phase 1. Most upper-layer modules have frameworks but thin functionality, can be gradually improved in Phase 3.

---

## VI. Documentation Quality Review

> The following reviews all 165 files (~39,001 lines) under `docs_zh/`, covering architecture documents, contract documents, ADRs, operations documents, quality documents, migration documents, governance documents, and guides.

### 6.1 Architecture Documents (`docs_zh/architecture/`, 6 files, ~11,187 lines)

#### 6.1.1 `00-platform-architecture.md`

| #   | Type     | Location         | Issue Description                                                                                                                                                       | Fix Solution                                                                            |
| --- | -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Internal Conflict | Line 6648     | Glossary OAPEFLIR expansion is `Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Recover`, but main text §13.1 (line 1242) and §13.2 (line 1354) use `Release` as R stage | Change line 6648 glossary from `Recover` to `Release`                                   |
| 2   | Internal Conflict | Line 5819     | `StageRationale` type contains undefined `"review"` stage                                                                                                              | Change `"review"` to `"release"`, consistent with OAPEFLIR 8 stages                     |
| 3   | Structure Issue   | Lines 286-298 | TOC numbering jumps: §44 directly to §46 (missing §45), §57 directly to §59 (missing §58), no corresponding content in main text either                              | Add §45 and §58 content, or renumber to eliminate gaps                                  |
| 4   | Outdated Path     | §35 (line 3149+) | Recommended directory lists `compliance/erasure/`, `compliance/encryption/`, `compliance/data-residency/`, `compliance/lineage/` subdirectories                    | These subdirectories don't exist in actual `src/platform/compliance/` (only 6 files). Mark as "planned" or delete |
| 5   | Outdated Path     | §35             | Lists `state-evidence/incident/`, `state-evidence/checkpoints/`, `state-evidence/dlq/`                                                                                 | These subdirectories don't exist in actual code. Mark as "planned" or delete          |
| 6   | Outdated Path     | §35 (line 3149)  | Lists `execution/scheduler/`                                                                                                                                             | This directory doesn't exist, Scheduler is under `interface/scheduler/`. Fix path      |
| 7   | Structure Issue   | Line 1491        | Missing `---` separator between §14 and §15, breaking consistent separator pattern throughout                                                            | Add `---` separator                                                                    |

#### 6.1.2 `01-code-structure.md`

| #   | Type     | Location       | Issue Description                                                                                                                                                                    | Fix Solution                      |
| --- | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | Outdated Content | Lines 421-460 | `execution/execution-engine/` file list incomplete, missing `multi-step-supervisor.ts`, `multi-step-tool-definitions.ts`, `orphan-cleanup-service.ts`, `kv-cache-prefix-config.ts` and 9 other files | Regenerate file list, add missing files |
| 2   | Outdated Content | Lines 337-350 | `interface/api/` only lists `index.ts`, actual contains `http-server/` (16+ files), `middleware/` (2 files), `oidc-oauth/` (3 files) and other subdirectories                | Add complete subdirectory structure |
| 3   | Factual Error    | Line 352     | Lists `interface/webhook/webhook-receiver.ts`, actual only has `webhook/index.ts`                                                                                                  | Fix filename                     |
| 4   | Factual Error    | Lines 477-499 | Repository files listed under `truth/repositories/`, actual mainly under `truth/sqlite/repositories/` (22 files)                                                               | Fix path hierarchy                |
| 5   | Path Reference   | Line 54       | References `doc/` directory, should be `docs_zh/` or `docs_en/`                                                                                                                   | Fix to correct documentation directory name |

#### 6.1.3 `02-code-architecture-reference.md`

| #   | Type     | Location                  | Issue Description                                                                                                                                            | Fix Solution                                               |
| --- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Internal Conflict | Line 38 vs 699 vs 806 | Test count inconsistent in three places: Line 38 says `~9,141`, line 699 says `~9,255`, line 806 says `test() 9,116 + it() 139`                           | Re-count and unify to one authoritative number           |
| 2   | Factual Error    | Line 667           | `admission-controller.ts` path labeled as `execution/execution-engine/`, actual under `execution/dispatcher/`                                              | Fix path to `execution/dispatcher/admission-controller.ts` |
| 3   | Outdated Content | Lines 293-301            | Describes 5 compliance services (DataResidencyPolicyService, FieldEncryptionService, ErasurePlanningService, DataLineageService), actual only `ComplianceCaseOrchestrationService` exists | Mark other 4 as "planned" or delete                        |

#### 6.1.4 `03-module-diagrams.md` (Most Problematic)

| #   | Type          | Location        | Issue Description                                                                                                                                    | Fix Solution                                                                                                              |
| --- | ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Entirely Outdated** | Full text    | Uses old file names and non-existent `ai-ops` path prefix, entire file appears to be an early draft                                                  | **Needs complete rewrite** to match current code structure                                                               |
| 2   | Wrong Reference     | Line 5         | References `agent_platform_design_architecture.md`, `code_file_structure.md`, `migration_assessment.md`                                               | Fix to `00-platform-architecture.md`, `01-code-structure.md`, `02-code-architecture-reference.md`                        |
| 3   | Factual Error       | Line 330       | OAPEFLIR expansion is `Observe Analyze Plan Execute...`, "Analyze" should be "Assess"                                                               | Change `Analyze` to `Assess`                                                                                             |
| 4   | Wrong Path           | Line 1364      | References `platform/ai-ops/compliance/`                                                                                                             | Fix to `platform/compliance/`                                                                                            |
| 5   | Wrong Path           | Lines 1397-1398 | References `platform/ai-ops/model-gateway`, `platform/ai-ops/tool-executor`, `platform/ai-ops/workflow`                                              | Fix to `platform/model-gateway/`, `platform/execution/tool-executor/`, `platform/orchestration/oapeflir/workflow/`     |
| 6   | Wrong Mapping        | Lines 1402-1428 | Migration target paths multiple errors: `evaluation → ops-maturity/compliance-reporter`, `memory → interaction/memory`, `security → org-governance/sso-scim` | Fix to: `evaluation → platform/prompt-engine/eval/`, `memory → platform/state-evidence/memory/`, `security → platform/control-plane/iam/` |

#### 6.1.5 `04-runtime-sequence.md`

| #   | Type     | Location   | Issue Description                                                    | Fix Solution                                                            |
| --- | -------- | ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Factual Error | Line 3  | Claims "four core runtime execution paths", document actually describes 7 | Fix to "seven core runtime execution paths"                             |
| 2   | Wrong Path   | Line 287 | References `execution-worker-handshake/writeback-service.ts`          | Fix to `execution/worker-pool/execution-worker-writeback-service.ts`   |

---

### 6.2 Contract Documents (`docs_zh/contracts/`, 113 files, ~14,200 lines)

#### 6.2.1 Stub/Placeholder Contracts (Lacking Substantive Content)

The following 16 contract files only have template framework, no TypeScript interface definitions, no schema constraints, no cross-contract relationships. Need to supplement complete specifications.

**Severe Stubs (≤ 35 lines)**:

| #   | File                                              | Lines | Fix Solution                                                           |
| --- | ------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| 1   | `workflow_debugger_contract.md`                   | 33    | Supplement: breakpoint type definitions, variable observation interface, time-travel API, remote debugging protocol |
| 2   | `behavior_drift_detection_contract.md`             | 34    | Supplement: drift metric definitions, baseline model, detection algorithm interface, alert threshold configuration |
| 3   | `capacity_planning_contract.md`                  | 34    | Supplement: resource model, prediction algorithm interface, scaling trigger conditions, capacity report format |
| 4   | `compliance_report_generation_contract.md`        | 34    | Supplement: report template definition, data source declaration, generation cycle configuration, output format (PDF/CSV) |
| 5   | `edge_runtime_and_sync_contract.md`               | 34    | Supplement: edge node registration protocol, offline mode state machine, cloud-edge sync mechanism, conflict resolution strategy |
| 6   | `cost_attribution_and_optimization_contract.md`  | 35    | Supplement: cost attribution model, optimization suggestion interface, simulation scenario definition |
| 7   | `platform_panic_and_resume_contract.md`          | 35    | Supplement: panic trigger conditions, state snapshot format, recovery checklist, manual confirmation process |
| 8   | `quota_preemption_and_fair_scheduling_contract.md`| 35    | Supplement: complete quota policy fields, preemption priority algorithm, fair scheduler interface |
| 9   | `sla_tier_contract.md`                           | 35    | Supplement: SLA tier definitions (P0-P3), response time commitments, availability targets, breach handling |

**Light Stubs (36-48 lines)**:

| #   | File                                                 | Lines | Fix Solution                                    |
| --- | ---------------------------------------------------- | ----- | ---------------------------------------------- |
| 10  | `multimodal_gateway_contract.md`                     | 41    | Supplement multi-modal input/output format, modal routing rules |
| 11  | `explainability_and_stage_rationale_contract.md`      | 43    | Supplement structured explanation format, simplified explanation generation rules |
| 12  | `cross_region_routing_and_data_residency_contract.md` | 43    | Supplement regional routing strategy, data residency compliance rules |
| 13  | `platform_ops_agent_contract.md`                     | 43    | Supplement operations whitelist, autonomy level binding rules |
| 14  | `connector_framework_contract.md`                    | 45    | Supplement connector SPI, lifecycle, configuration format |
| 15  | `feedback_improvement_pipeline_contract.md`           | 47    | Supplement complete feedback collection→classification→analysis→improvement interface |
| 16  | `agent_definition_lifecycle_contract.md`             | 48    | Supplement Agent lifecycle complete state machine, version management rules |

#### 6.2.2 Cross-Contract Contradictions

| #   | Contradiction Object         | Contract A                                                                                                    | Contract B                                                                                              | Issue                                                      | Fix Solution                                                                                             |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `AgentDefinition` Fields     | `agent_contract.md`: `id`, `name`, `model_tier`, `tools`, `scope` etc.                                         | `agent_definition_lifecycle_contract.md`: `agent_id`, `display_name`, `domain_id`, `capabilities` etc. | Same type with completely different fields, ID naming inconsistent (`id` vs `agent_id`) | Unify to one authoritative `AgentDefinition`, other references it. Use `agent_contract.md` as main, lifecycle contract references and extends |
| 2   | Event Naming Format          | `event_bus_contract.md`: dot-separated `feedback.signal_received`                                             | `typed_event_bus_contract.md`: colon-separated `feedback:collected`                                       | Two contracts define different naming conventions for the same event              | Unify to dot-separated format (consistent with EventEmitter in code), fix in `typed_event_bus_contract.md` |
| 3   | Cost Tracking Object         | `cost_and_budget_contract.md`: `CostEvent`                                                                    | `cost_attribution_and_optimization_contract.md`: `CostAttributionRecord`                                  | Two contracts define overlapping cost tracking objects with different field structures    | Merge into unified `CostEvent` type, `CostAttributionRecord` as extended subtype                       |
| 4   | `workflow_state` Fields      | `task_and_workflow_contract.md`: contains `current_stage`, `loop_iteration`, `feedback_signals` and other OAPEFLIR fields | `storage_schema_contract.md`: DDL missing these columns                                                 | Business contract declared fields missing in storage schema                      | Add missing columns to `workflow_state` DDL in `storage_schema_contract.md`                               |
| 5   | `QuotaPolicy`                | `billing_and_tenant_contract.md`: only name, no fields                                                        | `quota_preemption_and_fair_scheduling_contract.md`: defines `scope`, `hard_limit` and other fields        | Same object defined to different extents in two places                              | Supplement field definitions in `billing_and_tenant_contract.md` or reference other contract              |

#### 6.2.3 Code Path Reference Errors

| #   | File                               | Issue                                                                                                          | Fix Solution                                                                                                                |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | `project_structure_contract.md` §3 | Declares `src/core/` as authoritative structure (contains `api/`, `artifacts/`, `config/`, `events/`, `memory/` and 25+ subdirectories) | **Severe mismatch**: Actual `src/core/` only has `runtime/` (few files), real code is in `src/platform/`. This contract's project structure section needs complete rewrite |
| 2   | `project_structure_contract.md`    | `config/` structure missing `domains/`, `environments/`, `knowledge/`, `plugins/`, `product/` subdirectories     | Add 5 actually existing subdirectories                                                                                     |

#### 6.2.4 Overlapping/Duplicate Contracts

The following contract pairs have significant functional overlap, recommend merging or clearly dividing responsibilities:

| #   | Overlapping Contract Groups                                                                                                                                                          | Issue                                                    | Fix Solution                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `event_bus_contract.md` + `event_reliability_matrix_contract.md` + `event_registry_and_ops_threshold_contract.md` + `typed_event_bus_contract.md`                                   | 4 contracts all partially redefining event types, levels, and naming | Merge into 2: `event_bus_contract.md` (core definition) + `event_ops_contract.md` (reliability+thresholds+registry) |
| 2   | `cost_and_budget_contract.md` + `cost_attribution_and_optimization_contract.md` + `token_budget_allocation_contract.md` + `monetization_metering_plane_contract.md`              | 4 cost-related contract object definitions overlap         | Merge into 2: `cost_model_contract.md` (core model) + `monetization_contract.md` (commercial metering) |
| 3   | `approval_and_hitl_contract.md` + `hitl_experience_and_explainability_contract.md`                                                                                               | HITL object and approval experience duplicate definitions | Merge into one `hitl_contract.md`                                                                |
| 4   | `runtime_state_machine_contract.md` + `state_transition_matrix_contract.md`                                                                                                      | Both define the same state machine (TaskStatus, WorkflowStatus, ExecutionStatus) | Merge into one `state_machine_contract.md`                                                        |
| 5   | `agent_contract.md` + `agent_definition_lifecycle_contract.md`                                                                                                                     | `AgentDefinition` fields incompatible                     | Merge into one `agent_contract.md`, lifecycle as section                                          |
| 6   | `perception_contract.md` + `perception_intelligence_plane_contract.md`                                                                                                             | Both define Observe/Assess objects                       | Merge into one `perception_plane_contract.md`                                                     |

#### 6.2.5 Naming and Format Issues

| #   | Issue                   | Involved Files                                                                                                  | Fix Solution                                                             |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Filename inconsistency  | `adr-unified-resource-model.md` uses hyphen and no `_contract` suffix                                           | Rename to `unified_resource_model_contract.md`, or move to `docs_zh/adr/` |
| 2   | Missing `_contract` suffix | `error_code_registry.md`                                                                                      | Rename to `error_code_registry_contract.md`                              |
| 3   | ADR mixed into contract directory | `adr-unified-resource-model.md` is an ADR, not a contract                                                    | Move to `docs_zh/adr/`                                                  |
| 4   | Language inconsistency | `result_envelope_contract.md` mainly written in English, other contracts in Chinese                             | Translate to Chinese, maintain full directory language uniformity      |
| 5   | Unrelated OAPEFLIR labels | `billing_and_tenant_contract.md`, `tenant_and_organization_contract.md`, `gateway_streaming_contract.md` etc. | Remove OAPEFLIR stage association labels not related to that contract, only keep truly relevant stages |

#### 6.2.6 Missing Contracts

| #   | Missing Topic              | Corresponding Code                              | Fix Solution                                  |
| --- | -------------------------- | ----------------------------------------------- | -------------------------------------------- |
| 1   | Cache System               | `src/platform/shared/cache/` (strategy, storage, invalidation) | New `cache_contract.md`                  |
| 2   | Model Gateway Routing      | `src/platform/model-gateway/`                    | New `model_gateway_routing_contract.md`      |
| 3   | Prompt Engine SPI         | `src/platform/prompt-engine/`                    | New `prompt_engine_spi_contract.md`          |
| 4   | SDK Surface Contract       | `src/sdk/` (CLI, Pack SDK, Plugin SDK, Client SDK) | New `sdk_surface_contract.md`            |
| 5   | `src/platform/` Top-level Architecture | Actual main code directory                 | Supplement in `project_structure_contract.md` |

---

### 6.3 ADR Documents (`docs_zh/adr/`, 38 files, ~4,252 lines)

#### 6.3.1 Numbering Gaps

ADR numbering has the following gaps:

| Gap Range | Missing Count | Description                                           |
| --------- | ------------- | ----------------------------------------------------- |
| 021-059   | 39            | 060+ series are OAPEFLIR era decisions, gap is intentional |
| 061-065   | 5             | Unknown reason                                        |
| 067-071   | 5             | Unknown reason                                        |
| 073-074   | 2             | Unknown reason                                        |
| 076-077   | 2             | Unknown reason                                        |

**Fix Solution**: Explain in README that numbering strategy is "allocate number blocks by time period" rather than "sequential increment", and list which number blocks correspond to which decision batches. Or, delete "sequential increment" statement in `adr/README.md`.

#### 6.3.2 Inconsistent Format (Three Template Sets)

38 ADRs use three different template formats:

| Era     | ADR Range | Format Characteristics                                                           | Fix Solution                      |
| ------- | --------- | -------------------------------------------------------------------------------- | --------------------------------- |
| Early   | 001-015   | `Result` + `Pros`/`Costs`/`Constraints` + `Cross-References` + `Source Section` | Keep as standard format           |
| Middle  | 016-080   | `Consequences` (short) + `Alternatives` + `Cross-References` + `Source Section` | Unify `Consequences` to `Result` |
| Late-A  | 081-087   | Minimal format: only `Decision` + `Consequences` (1-3), no `Alternatives`, `Cross-References`, `Source Section` | Supplement missing sections      |
| Late-B  | 088-090   | Completely different template: `Tradeoffs` + `Impact` + `Test Requirements`, no `Context`/`Decision` | Change to standard format         |

**Fix Solution**: Unify all ADRs to standard format: `Title → Status → Date → Context → Decision → Result (Pros/Costs/Constraints) → Alternatives → Cross-References → Source Section`.

#### 6.3.3 Superseded but Not Labeled ADRs

| ADR    | Current Status | Should Be                  | Reason                                                                              |
| ------ | -------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| ADR-003 | Accepted       | **Superseded by ADR-020** | ADR-020 redefines six-layer memory model, uses different TTL and promotion rules   |
| ADR-018 | Accepted       | **Superseded by ADR-075** | ADR-075 redefines release state machine, Level and state set incompatible          |
| ADR-007 | Accepted       | **Partially Superseded**  | Among them, "Release only allows off/suggest/shadow three levels" has already been replaced by ADR-075's six-level model |

**Fix Solution**: Add `Status: Superseded by ADR-0XX` to superseded ADR header, and add `Supersedes: ADR-0XX` reverse link in new ADR.

#### 6.3.4 Content Contradictions

| #   | Contradiction                   | Involved ADRs                                                                                                                                                                               | Fix Solution                                                                                         |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | **Memory Layer Naming Three Schemes** | ADR-003: `runtime/session/agent/project/user/evolution`; ADR-020: `RuntimeCache/Session/Agent/Project/User/Evolution`; Architecture doc §29.2: `working/session/episodic/semantic/procedural/meta` | Select one authoritative naming (recommend architecture doc §29.2), others mark as historical versions |
| 2   | **Release Levels Incompatible**       | ADR-018: Five levels L0-L5 (off/suggest/shadow/canary/staged/stable); ADR-075: Six levels L0-L5 (off/shadow/canary_5/partial_25/stable_75/stable_100)                                       | ADR-018's `suggest` level removed in ADR-075, `shadow` changed from L2 to L1. Mark ADR-018 as Superseded |
| 3   | **Release State Machine Incompatible** | ADR-018: 11 states (draft→pending_approval→shadow→...); ADR-075: 12 states (candidate_created→under_review→approved→...)                                                               | Unify to ADR-075 as authoritative                                                                   |

#### 6.3.5 Filename and Content Mismatch

| ADR    | Filename                       | Actual Title                       | Fix Solution                            |
| ------ | ------------------------------ | ---------------------------------- | --------------------------------------- |
| ADR-003 | `003-memory-seven-layers.md`   | "Six-Layer Memory and KV Cache Fixed Prefix" | Rename to `003-memory-six-layers.md` |

#### 6.3.6 Inconsistent with Architecture Document

| #   | ADR         | ADR Content                    | Architecture Doc §29.2                                                                       | Fix Solution                                                                    |
| --- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | ADR-003/020 | Memory layers use ops naming  | Uses cognitive science naming (working/episodic/semantic etc.)                             | Mark "superseded by architecture doc §29.2" in ADR, or update architecture doc to reflect ADR choice |
| 2   | No corresponding ADR | —              | §34 lists 65+ suggested ADR topics (like `ADR-Platform-Layering`, `ADR-Delegation-Depth-Limit`) | Mark which suggested ADRs are implemented and which are merged into other ADRs in README |

#### 6.3.7 Stub ADRs

| ADR    | Lines | Missing Content                    | Fix Solution                   |
| ------ | ----- | ----------------------------------- | ------------------------------ |
| ADR-017 | 48    | No "Alternatives", "Cross-References", "Source Section" | Supplement missing sections    |
| ADR-019 | 55    | No "Alternatives", consequences minimal | Supplement alternatives and detailed consequence analysis |
| ADR-088 | 58    | No "Context" detailed description, "Alternatives" | Change to standard format and supplement |
| ADR-089 | 58    | Same as 088                         | Same as above                  |

#### 6.3.8 Cross-Reference Issues

| ADR         | Reference                                 | Issue                                          | Fix Solution                             |
| ----------- | ----------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| ADR-072 line 141 | `doc/reviews/design_gap_analysis_v9.md` | Path uses `doc/` prefix instead of `docs_zh/`, may be broken link | Fix to corresponding file under `docs_zh/reviews/` |

---

### 6.4 Operations Documents (`docs_zh/operations/`, 16 files, ~2,544 lines)

#### 6.4.1 Severely Outdated Files

| #   | File                                       | Issue                                                                                                                       | Fix Solution                                                                                           |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **`src_module_test_matrix.md`** (1,455 lines) | **Entire text references old paths** `src/core/tools/`, `src/core/types/`, `src/gateway/` etc., migrated code now in `src/platform/` | Run `npm run test:matrix` to regenerate, or manually update all `src/core/` paths to `src/platform/` corresponding paths |
| 2   | **`implementation_plan.md`**               | Entire text references old structure `src/core/`, `src/cli/`, `src/gateway/`, contradicts `02-code-architecture-reference.md` | Update all path references to new structure                                                            |
| 3   | `operations-checklist.md` line 16           | Test count reported as `2383+/2383`, actual is ~10,606 (`project_progress_tracker.md` line 33)                             | Update to current actual test count                                                                    |

#### 6.4.2 Stub/Placeholder Files

| #   | File                        | Lines | Issue                                                      | Fix Solution                           |
| --- | --------------------------- | ----- | --------------------------------------------------------- | -------------------------------------- |
| 1   | `operations-tracker.md`     | 18    | Only redirect stub, functionality replaced by `project_progress_tracker.md` | Delete this file, or mark "migrated" in content |
| 2   | `cross-region-validation.md` | 16    | Only title and outline, no actual validation steps         | Supplement validation steps, acceptance criteria, rollback process |
| 3   | `capacity-planning.md`       | 24    | Very minimal content                                       | Supplement capacity model, baseline data, scaling rules |

#### 6.4.3 Broken Links

| #   | File                  | Location | Issue                                                          | Fix Solution                                                           |
| --- | --------------------- | -------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `capacity-planning.md` | line 22  | References `tests/performance/capacity-limits.test.ts`, file doesn't exist | Fix to actual performance test path (e.g., `tests/integration/plugin-perf/` etc.) |

#### 6.4.4 Runbook Issues

| #   | File                              | Issue                                                                         | Fix Solution                                                                                  |
| --- | --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | All 5 runbooks                    | Only general guidance, no platform-specific commands, log query statements, Dashboard links | For each runbook supplement: (1) specific CLI commands (2) log query templates (3) Grafana Dashboard URL |
| 2   | `incident-response-playbook.md`   | Only 15 lines, missing escalation matrix, communication template, post-mortem template | Supplement complete incident response process                                               |
| 3   | `operations/README.md`             | Doesn't index 5 files in `runbooks/` subdirectory                            | Add runbook entries to README table                                                          |

#### 6.4.5 Test Count Inconsistency (Cross-Document)

| File                                | Test Count | Date        |
| ----------------------------------- | --------- | ------------ |
| `operations-checklist.md`           | 2,383     | Not labeled  |
| `project_progress_tracker.md`        | 10,606    | 2026-04-18   |
| `02-code-architecture-reference.md`  | ~9,141    | 2026-04-20   |

**Fix Solution**: Designate one authoritative data source (recommend `npm test` output), other files reference this data source rather than hardcoding numbers.

---

### 6.5 Quality Documents (`docs_zh/quality/`, 3 files, ~2,243 lines)

| #   | File                                | Issue                                                                                      | Fix Solution                                                  |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | `00-full-coverage-test-manual.md`   | Entire text references old `src/core/` paths                                               | Update to `src/platform/` corresponding paths                 |
| 2   | `01-release-checklist.md` line 25   | Coverage threshold `lines ≥ 60%, branches ≥ 50%`, actual baseline recorded as 82%/78.3% in `00-full-coverage-test-manual.md` | Raise threshold to `lines ≥ 75%, branches ≥ 70%`, maintaining reasonable distance from actual baseline |

---

### 6.6 Migration Documents (`docs_zh/migration/`, 3 files, ~1,532 lines)

| #   | File                   | Issue                                                                                      | Fix Solution                                                           |
| --- | ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | `00-migration-guideline.md` | Entire text references old `doc/contracts/`, `doc/adr/`, `doc/operations/` paths         | Update to `docs_zh/contracts/`, `docs_zh/adr/`, `docs_zh/operations/` |
| 2   | `01-migration-scope.md`    | Treats migration as future work (references `src/core/` 42-module structure as "current"), but migration is complete | Mark migration complete, add migration completion date and verification results. Or mark file as historical document |

---

### 6.7 Governance Documents (`docs_zh/governance/`, 7 files, ~964 lines)

| #   | File                            | Issue                                                    | Fix Solution                                                    |
| --- | ------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | `source_of_truth.md` line 10     | References "based on `01` ~ `07`" old numbering scheme  | Update to current `docs_zh/architecture/00-*.md` ~ `04-*.md` numbering |
| 2   | `source_of_truth.md` line 12     | References non-existent `automatic_agent_platform/` directory | Delete or fix to actual project root directory                  |
| 3   | `glossary_and_terminology.md` lines 302-355 | Section 15 uses wrong section numbers (marked as 13.1, 13.2 etc.) | Fix numbering to 15.1, 15.2 etc.                                |
| 4   | `change_control.md`             | Only 43 lines, no change request template, approval flow diagram, toolchain references | Supplement change request template and approval process          |

---

### 6.8 Guides (`docs_zh/guides/`, 4 files, ~281 lines)

| #   | File                 | Issue                                                         | Fix Solution                                                   |
| --- | -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `contributing.md` line 9 | References `docs_zh/automatic-agent-architecture.md`, file doesn't exist | Fix to `docs_zh/architecture/00-platform-architecture.md`      |
| 2   | Missing `README.md`  | Directory has no index file                                   | Create new `guides/README.md`, listing 4 guides' titles and descriptions |
| 3   | `quickstart.md`      | Only 54 lines, no troubleshooting chapter                    | Supplement common issues and troubleshooting steps             |

---

### 6.9 Analysis Documents (`docs_zh/analysis/`, 3 files, ~231 lines)

| #   | File                              | Issue                                                       | Fix Solution                              |
| --- | --------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| 1   | `01-codebase-vs-design-review.md` | Doesn't reference latest `02-code-architecture-reference.md` as authoritative source | Add cross-reference                      |
| 2   | `00-architecture-coverage-matrix.md` | Coverage percentages may be outdated                       | Mark data cutoff date, or set up automated update mechanism |

---

### 6.10 Documentation Issues Summary and Fix Priority

#### Issue Statistics

| Directory           | Files | Issues Found | Severe | Medium | Minor |
| ------------------- | ----- | ------------ | ------ | ------ | ------ |
| `architecture/`     | 6     | 22           | 4      | 12     | 6      |
| `contracts/`        | 113   | 38           | 7      | 19     | 12     |
| `adr/`              | 38    | 18           | 3      | 10     | 5      |
| `operations/`       | 16    | 15           | 3      | 8      | 4      |
| `quality/`          | 3     | 2            | 0      | 2      | 0      |
| `migration/`        | 3     | 2            | 0      | 2      | 0      |
| `governance/`       | 7     | 4            | 1      | 2      | 1      |
| `guides/`           | 4     | 3            | 1      | 1      | 1      |
| `analysis/`         | 3     | 2            | 0      | 1      | 1      |
| **Total**           | **165**| **106**     | **19** | **57** | **30** |

#### P0 — Must Fix Immediately (Misleading content, affects development decisions)

| #   | Fix Item                                                                                                              | Involved Files                                      | Estimated Hours |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------- |
| 1   | `03-module-diagrams.md` complete rewrite — old paths, wrong OAPEFLIR expansion, `ai-ops` prefix doesn't exist          | `architecture/03-module-diagrams.md`                 | 4h              |
| 2   | `project_structure_contract.md` §3 rewrite — declared authoritative structure completely doesn't match actual code     | `contracts/project_structure_contract.md`            | 2h              |
| 3   | `src_module_test_matrix.md` regenerate — 1,455 lines all reference old paths                                        | `operations/src_module_test_matrix.md`               | 1h              |
| 4   | OAPEFLIR "R" unified to "Release" — glossary, StageRationale type, "Recover"/"Analyze" in `03-module-diagrams.md`   | `architecture/00-platform-architecture.md` line 6648 + 5819 | 0.5h          |
| 5   | ADR-018/ADR-075 contradiction resolution — release state machine incompatible                                         | `adr/018-*`, `adr/075-*`                            | 1h              |
| 6   | `AgentDefinition` dual definition resolution — two contract definitions have incompatible field sets                  | `contracts/agent_contract.md`, `contracts/agent_definition_lifecycle_contract.md` | 1h          |
| 7   | Event naming format unification — dot vs colon                                                                     | `contracts/event_bus_contract.md`, `contracts/typed_event_bus_contract.md` | 0.5h        |

#### P1 — Should Fix Soon (Outdated content, may cause confusion)

| #   | Fix Item                                              | Involved Files                                           | Estimated Hours |
| --- | ----------------------------------------------------- | -------------------------------------------------------- | --------------- |
| 8   | `01-code-structure.md` file list update                | `architecture/01-code-structure.md`                      | 2h              |
| 9   | `02-code-architecture-reference.md` test count unify + path fix | `architecture/02-code-architecture-reference.md`     | 1h              |
| 10  | `implementation_plan.md` path update                  | `operations/implementation_plan.md`                      | 2h              |
| 11  | `contributing.md` broken link fix                      | `guides/contributing.md` line 9                          | 0.1h            |
| 12  | ADR superseded status labeling (003→Superseded, 018→Superseded) | `adr/003-*`, `adr/018-*`, `adr/007-*`          | 0.5h            |
| 13  | Memory layer naming three schemes unified            | `adr/003-*`, `adr/020-*`, `architecture/00-*` §29.2     | 1h              |
| 14  | 16 stub contracts supplement content                  | `contracts/` 16 files                                   | 8h              |
| 15  | 6 pairs overlapping contracts merged                  | `contracts/` 12 files                                   | 6h              |
| 16  | `source_of_truth.md` update                           | `governance/source_of_truth.md`                          | 0.5h            |
| 17  | `00-full-coverage-test-manual.md` path update         | `quality/00-full-coverage-test-manual.md`                | 2h              |

#### P2 — Recommended Fix (Improve documentation quality)

| #   | Fix Item                                                    | Involved Files                                           | Estimated Hours |
| --- | ----------------------------------------------------------- | -------------------------------------------------------- | --------------- |
| 18  | `00-platform-architecture.md` §35 mark "planned" directories | `architecture/00-platform-architecture.md`                | 0.5h            |
| 19  | `04-runtime-sequence.md` count fix + path fix               | `architecture/04-runtime-sequence.md`                    | 0.3h            |
| 20  | ADR format unified (38 files)                              | `adr/` all                                               | 4h              |
| 21  | Runbook supplement platform-specific content                | `operations/runbooks/` 5 files                           | 4h              |
| 22  | Migration docs mark as historical documents                 | `migration/` 2 files                                     | 0.5h            |
| 23  | `glossary_and_terminology.md` numbering fix                 | `governance/glossary_and_terminology.md`                  | 0.3h            |
| 24  | Create `guides/README.md`                                   | `guides/`                                                | 0.2h            |
| 25  | Missing contracts created (cache, model-gateway, prompt-engine, SDK) | `contracts/` 4-5 new files                     | 6h              |
| 26  | Test counts unified to dynamic reference                    | 3 files                                                  | 1h              |
| 27  | `operations-tracker.md` delete or merge                     | `operations/`                                            | 0.1h            |
| 28  | Contract naming and language unified                       | `contracts/` 3 files                                     | 1h              |
| 29  | `00-platform-architecture.md` §44→§46, §57→§59 numbering gap handling | `architecture/00-platform-architecture.md`            | 1h              |
| 30  | `operations-checklist.md` test count update                 | `operations/operations-checklist.md`                      | 0.1h            |
| 31  | ADR-003 filename fix                                        | `adr/003-memory-seven-layers.md` → `003-memory-six-layers.md` | 0.1h        |

#### Fix Roadmap

| Phase            | Time        | Goal                                    | Files    |
| ---------------- | ----------- | --------------------------------------- | -------- |
| Sprint 1 (3 days) | First half of W1 | All 7 P0 fixes                          | ~10 files |
| Sprint 2 (5 days) | Second half of W1 - W2 | First 7 P1 items (#8-#14)           | ~25 files |
| Sprint 3 (5 days) | W2-W3       | Last 3 P1 items (#15-#17) + first 5 P2 items | ~20 files |
| Sprint 4 (5 days) | W3-W4       | Remaining P2 items                     | ~15 files |

**Total Estimated Hours**: ~46 hours (~6 working days)

---

> **Documentation Review Conclusion**: 106 issues found in 165 documents, of which 19 are severe. The core issues are `03-module-diagrams.md` entirely outdated (uses non-existent `ai-ops` path prefix), `project_structure_contract.md` declares project structure that completely doesn't match actual code, and `src_module_test_matrix.md` all 1,455 lines reference old paths. Recommend completing P0+P1 fixes within 2 Sprints (~8 working days) to eliminate all misleading documentation content.
