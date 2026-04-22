# "Enterprise-level Agent Platform Overall Technical Architecture Design Document"

> **Document Version**: v3.3
> **Document Status**: Release
> **Document Positioning**: Enterprise-level / platform-level Agent System overall technical architecture design document (stability first, complete AI operations, complete business domain access, complete vertical business domain deepening (24 domains), unified domain meta-model, multi-Agent collaboration protocol, complete intelligent interaction, complete organizational governance, complete scaled ecosystem, complete operational maturity, complete Harness engineering, complete Harness eight-pillar deepening, three-ring implementation priority, implementation-oriented version)
> **Applicable Audience**: Architecture committee, platform R&D team, Runtime team, SRE, security team, governance team, business domain access team, AI/ML engineering team, business line leaders, non-technical business operators, organizational management, compliance/audit team, ecosystem partners, edge/field operations team, **vertical business domain architects (Quant Trading, E-commerce, Advertising, Financial Services, Data Engineering, Coding, User Operations, Industry Research, Academic Research, Knowledge Base, Finance/Accounting, Legal, Live Streaming, Creative Production, Game Dev, Game Publishing, HR, Supply Chain, Healthcare, Education, Customer Service, Content Moderation, IT Operations, Marketing)**
> **Design Goal**: Build an enterprise-level Agent platform with stability, risk control, safety and reliability, and exception handling as first principles, enabling Agents to run in enterprise environments in a controlled, recoverable, and auditable manner as high-risk automation units; with complete AI operations capabilities (LLM abstraction, Prompt governance, model quality, cost control); providing structured business domain modeling and access framework; building an intelligent interaction layer for non-technical users; establishing complete organizational governance and scaled ecosystem layers; completing the operational maturity layer; **and introducing the Harness Runtime unified abstraction -- converging distributed constraints, tools, context, and feedback capabilities into a standardized Planner->Generator->Evaluator->Loop closed-loop runtime, upgrading Agents from one-shot model calls to constrained, executable, memorable, feedback-capable, recoverable engineered closed-loop systems**

---


# Table of Contents

> This document is organized into 11 Parts following a **ten-layer architecture**. Section numbers remain stable for historical reference compatibility.

**Preamble (S1-S3)**

1. [Document Overview](#1-document-overview)
2. [Platform Root Assumptions and Design Goals](#2-platform-root-assumptions)
3. [Platform Definition and Non-Goals](#3-platform-definition)

**Part I -- Infrastructure Layer (S4-S14, S24-S32)** 4. Overall Architecture: Five Planes + One Cross-Cutting Control Mesh 5. Inter-Plane Communication Contract 6. API Contract and Versioned Architecture 7. Service Communication Architecture 8. Scalability Architecture 9. Stability Architecture 10. Risk Control Architecture 11. Security and Reliability Architecture 12. Exception Event Processing Architecture 13. OAPEFLIR Controlled Cognitive Kernel 14. Runtime Execution Plane 24. Configuration Governance Architecture 25. Data and State Consistency Architecture 26. Storage Architecture 27. Performance Architecture and SLO 28. Event / Projection / Incident / DLQ Model 29. Knowledge / Memory / Artifact / Learning Boundary 30. Business Access Constraints and Business Pack Model 31. Disaster Recovery and High Availability Architecture 32. Deployment Architecture

**Part II -- AI Operations Layer (S15-S23)** 15. LLM Provider Abstraction and Failover Architecture 16. Prompt Management and Versioning Architecture 17. Model Evaluation and Quality Gate Architecture 18. Cost Management and Token Metering Architecture 19. Inter-Agent Delegation and Collaboration Architecture 20. Long-term Tasks and Workflow Hibernation Architecture 21. Human-Machine Collaboration Model Architecture 22. SDK and Developer Experience Architecture 23. Compliance and Data Governance Architecture

**Part III -- Business Domain Access Layer (S37-S38)** 37. Business Domain Modeling and Access Architecture 38. Business Domain Access Runbook

**Part IV -- Vertical Business Domain Deepening Layer (S71-S94)** 71. Quantitative Trading Domain 72. E-commerce Domain 73. Advertising Domain 74. Financial Services Domain 75. Data Engineering Domain 76. Coding Domain 77. User Operations Domain 78. Industry Research Domain 79. Academic Research Domain 80. Enterprise Knowledge Base Domain 81. Finance/Accounting Domain 82. Legal Domain 83. Live Streaming Domain 84. Creative Production Domain 85. Game Development Domain 86. Game Publishing Domain 87. Human Resources Domain 88. Supply Chain and Logistics Domain 89. Healthcare Domain 90. Education and Training Domain 91. Customer Service Domain 92. Content Moderation and Safety Domain 93. IT Operations SRE/DevOps Domain 94. Marketing and Branding Domain

**Part V -- Intelligent Interaction Layer (S39-S44)** 39. Natural Language Task Entry Architecture 40. Goal Decomposition Engine Architecture 41. Proactive Agent Framework 42. Progressive Autonomy Model 43. Unified Operations Dashboard Architecture 44. Non-Technical User Experience Architecture

**Part VI -- Harness Engineering and Eight-Pillar Deepening Layer (S45, S58)** 45. Harness Runtime Architecture 58. Harness Cross-Cutting Concerns

**Part VII -- Organizational Governance Layer (S46-S51)** 46. Organizational Hierarchy Model 47. Organizational Structure Approval Routing 48. Enterprise SSO/SCIM Integration Architecture 49. Sub-Department Compliance Policy Engine 50. Knowledge Domain Isolation and Controlled Sharing 51. Hierarchical Governance Delegation

**Part VIII -- Scaled Operations and Ecosystem Layer (S52-S57)** 52. Multi-Region Deployment Architecture 53. Large-Scale Resource Competition Management 54. SLA Tiered Guarantee 55. Agent Marketplace and Ecosystem 56. Feedback-Driven Continuous Improvement Pipeline 57. External System Integration Framework

**Part IX -- Operational Maturity Layer (S59-S69)** 59. Agent Explainability and Decision Transparency Architecture 60. Emergency Braking and Global Circuit Breaker Architecture 61. Agent Unified Lifecycle Management Architecture 62. Offline and Edge Deployment Architecture 63. Agent Behavior Drift Detection Architecture 64. Cost Attribution and Optimization Engine 65. Workflow Visual Debugger Architecture 66. Compliance Report Automatic Generation Engine 67. Capacity Planning and Cost Forecasting Engine 68. Multimodal Capability Architecture 69. Platform Self-Operation Agent Architecture

**Part X -- Implementation Roadmap and Summary (S33-S36)** 33. Phased Implementation Roadmap 34. ADR Freeze Recommendation 35. Recommended Code Directory 36. Risks, Constraints and Success Criteria

**Part XI -- Conclusion and Appendices** 70. Conclusion
Appendix G: Glossary and Abbreviation Index
Appendix A: Version Change History

---

# Book Architecture Overview

This section provides four diagrams summarizing the core structure of this architecture document. Readers can build a global picture before diving into details.

### Diagram 1 -- Static Architecture (Five Planes + Cross-Cutting Fabric)

```text
+-----------------------------------------------------------+
|                   P1  Interface Plane                      |  S5-S10
+-----------------------------------------------------------+
|                   P2  Control Plane                        |  S11-S13
+-----------------------------------------------------------+
|         P3  Orchestration Plane (Harness Runtime)         |  S14-S22, S45
+-----------------------------------------------------------+
|                   P4  Execution Plane                      |  S23-S24
+-----------------------------------------------------------+
|                   P5  Evidence Plane                       |  S25-S29
+-----------------------------------------------------------+
| X1 Reliability Fabric (across 5 planes)                   |  S56-S60
+-----------------------------------------------------------+
```

### Diagram 2 -- Runtime Main Chain (Typical Path for One Task)

```text
Request --> ConstraintPack --> Planner --> Generator --> Evaluator
                                  ^          |             |
                                  +----------+  loop on fail |
                                                           v
                              Decision --> Durable/HITL --> Result + Evidence
```

### Diagram 3 -- Governance Closed Loop (Continuous Improvement Cycle)

```text
Run --> Evidence --> Feedback --> Learn/Drift-Detect
 ^                                        |
 +-- Release <- Improve <- Evaluation <---+
```

### Diagram 4 -- Evolution Roadmap (Phase Overview, see S33)

```text
Phase 1 --> Phase 2 --+-> Phase 3 --> Phase 4 --> Phase 5 --> Phase 6 --> Phase 7
                       +-> Phase 8a -> Phase 8b -> Phase 8c --+(8c before Phase 5)
Phase 5+8c --> Phase 9a -> 9b -> 9c -> 9d -> 9e -> 9f  (24 domains, 48 weeks)
```

---

# 1. Document overview 

## 1.1 Background 

Enterprises' expectations for Agents have evolved from a "question and answer system" to an intelligent automation platform that can connect to systems, run processes, execute, be governed, audited, and continue to evolve. 

However, most Agent systems still have obvious shortcomings in engineering: 

* Trust model output by default 
* The default tool call will be successful 
* External systems available by default 
* The default workflow can be run as long as it is arranged 
* Default exceptions only need to be logged 
* Default behavior is acceptable after going online 

None of these assumptions hold true in an enterprise production environment. 

The first thing that enterprise-level Agent platforms face is not "not strong enough", but "too high a risk of losing control". 
Therefore, this version of the architecture puts the following issues as the main design objects: 

* How to prevent the system from losing control when it fails 
* How to identify and restrain high-risk actions 
* How to downgrade when external dependencies are abnormal
* How to recover after a worker crashes 
* How to control and hold side effects accountable 
* How to roll back if publishing fails 
* How to reconstruct projection deviation 
* How to safely stop the system when approval is delayed 

## 1.2 Documentation goals 

* Define the overall architecture of the enterprise-level Agent platform that prioritizes stability 
* Establish design principles based on the premise of "untrustworthy by default and failure by default" 
* Upgrade stability, risk, security, and exception handling to the main platform-level architecture 
* Clarify the system structure of the five planes + cross-cutting network, ** and define the formal interface protocol between the planes ** 
* Reconstruct Runtime into a recoverable, downgradeable, and auditable controlled execution system 
* **Gives a progressive evolution path that can be implemented**, rather than an ideal state that can be achieved in one step 
* Provide a baseline for subsequent detailed design, Schema, ADR, and phased implementation 

## 1.3 Non-Goals

 * Prompt details of a single business agent 
* Interface implementation description of a single plug-in or adapter 
* UI interactive mockup 
* Implementation of special access for a certain model supplier 
* Complete domain model of a certain business domain 
* Infrastructure physical topology and procurement options 

---

# 2. Platform root assumptions and design goals 

## 2.1 Platform root hypothesis 

This platform assumes by default that the following situations will occur: 

* agents make mistakes 
* Tool will fail 
* External systems will time out 
* worker will crash 
* The model will produce error output 
* The configuration will be mismatched 
* Approval will be delayed 
* Event will be repeated 
* Projection will lag behind 
* Press conference rollback 

Therefore the platform must be designed around one sentence: 

> **Untrustworthy by default, failure by default, controllable, recoverable, and auditable by default. ** 

## 2.2 Platform Design Constitution
### Untrusted by default 

* Model output is not trustworthy 
* The plug-in is not trustworthy 
* External dependencies are not trustworthy 
* Input is not trustworthy 
*Knowledge may be out of date 
* Learning results may be noisy 

### Will fail by default 

* Remote calls will time out 
* Workers will lose heartbeats 
* event fanout will fail 
* projection will be delayed 
* rollout will fail 
* repair / replay may also fail 

### Default convergence 

Actions that are not explicitly allowed default to the conservative path: deny / degrade / require approval / supervised / no-write / no-external / manual-only. 

### Recoverable first, then automated 

Automation without replay/repair/rebuild/rollback capabilities should not enter critical processes. 

### Status is equally important as evidence 

The platform must not only be "made", but also record: who triggered it, why it was executed, what context was used, what system was called, what side effects were generated, and how to recover after failure. 

## 2.3 Eight hard goals 

1. **Stable operation**: Even if some components fail, the platform as a whole cannot lose control. 
2. **Risk Isolation**: High-risk actions must be identified, classified, isolated, approved, and rollable 
3. **Secure Default Convergence**: Capabilities that are not explicitly allowed are disabled by default and do not fail-open. 
4. **Exception recovery**: After an important link is interrupted, it can either resume and continue, terminate safely, or switch to manual 
5. **Data traceability**: Each key action can be traced to its trigger, basis, context, results and side effects 
6. **Release Controlled**: Changes to workflow, agent, pack, plugin, and policy must be grayscale and rollable 
7. **Multi-tenant security**: Data, permissions, and execution environments are not allowed to be exchanged between different tenants, teams, projects, and business domains. 
8. **Business can be expanded but does not invade the core**: New business access cannot destroy the stability and security model of the platform 

---

# 3. Platform definition and non-target 

## 3.1 Platform definition 

> A controlled automation platform for enterprise environments with stability first as its core principle. 
> It treats the Agent as a high-risk automation unit, and strictly controls, isolates, recovers, audits and governs it through five architectural planes and a layer of cross-cutting control network.
## 3.2 What It Is Not

* **Not a single chatbot** — Chat is just one of the entry points
* **Not a pure Workflow Engine** — Workflow does not solve governance, recovery, approval, or audit
* **Not a pure Tool Calling shell** — Tools are only the execution means
* **Not a thin application of "Prompt + Model + a few tools"** — Lacks isolation, governance, recovery
* **Not a system of "the more automation the better"** — The platform pursues **controlled automation**

---


# Part I -- Infrastructure Layer (S4-S14, S24-S32)

---

# 4. Overall Architecture: Five Planes + One Cross-Cutting Control Mesh

## 4.1 Architecture Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                    P1 Interface Plane                         │
│     API Gateway · Webhook · Scheduler · Console · Ingress    │
├──────────────────────────────────────────────────────────────┤
│                    P2 Control Plane                           │
│     Policy · Approval · Rollout · Incident · Config          │
├──────────────────────────────────────────────────────────────┤
│                P3 Orchestration Plane                         │
│     OAPEFLIR Loop · Planner · Routing · Escalation           │
├──────────────────────────────────────────────────────────────┤
│                 P4 Execution Plane                            │
│     Dispatcher · Workers · Tools · Plugins · Recovery        │
├──────────────────────────────────────────────────────────────┤
│             P5 State & Evidence Plane                         │
│     Truth · Events · Projections · Artifacts · Audit         │
├──────────────────────────────────────────────────────────────┤
│         X1 Reliability & Security Fabric (Cross-cutting all planes)           │
│     AuthN/Z · Sandbox · Circuit Breaker · DLQ · Backpressure │
└──────────────────────────────────────────────────────────────┘
```
## 4.2 P1 Interface Plane 

External access layer. 

**Includes**: API Gateway / Webhook / Scheduler trigger / Admin Console backend / External event ingress 

**Responsibilities**: Input verification · Identity authentication · Current limiting · Request deduplication · Basic routing · Attachment citation · Idempotent key processing 

**Not responsible**: Execute business logic · Modify core state · Directly adjust the executor, bypassing the control plane 

**v2.0 Improvement**: P1 must expose a standardized API contract (see §6), and all requests entering the platform must be encapsulated through a unified RequestEnvelope, including trace_id, idempotency_key, principal, and tenant_id. 

## 4.3 P2 Control Plane 

The control and governance layer is the governance shell of the platform. 

**Includes**: policy engine / approval engine / rollout control / replay & repair control / incident control / tenant admin / audit export / config center / exception management 

**Responsibilities**: Definition and version governance · Approval and autonomous boundary control · Risk and budget guarding · Release, grayscale, rollback · Incident upgrade and disposal · Operation and maintenance control of repair / replay / rebuild 

**v2.0 Improvement**: P2 sends instructions to P3/P4 through ControlDirective instead of directly operating the underlying state. Directive types include: ModeSwitchDirective / PauseDirective / RollbackDirective / QuotaAdjustDirective. 

## 4.4 P3 Orchestration Plane 

Orchestration and decision-making level. 

**Includes**: OAPEFLIR loop / workflow orchestration / planning & replanning / step scheduler / routing & escalation 

**Responsibilities**: Decide what to do · Decide who will perform the next step · Decide when to pause · Decide when to switch to manual · Decide when to re-plan, downgrade, and terminate 

**v2.0 Improvement**: P3 outputs a standardized ExecutionPlan (see §13 interface contract), and all decisions must be serializable, auditable, and replayable. 

## 4.5 P4 Execution Plane 

Unify the execution layer. 

**Includes**: scheduler/dispatcher/execution engine/worker pool/tool executor/plugin executor/adapter executor/browser executor/human wait executor/recovery workers 

**Responsibilities**: Actual execution of actions · Acquire and maintain leases · Write back execution results · Propose and submit side effects · Trigger recovery actions in case of failure 

**v2.0 Improvement**: P4 must report execution results to P3/P5 through ExecutionReceipt, which contains status / duration / side_effects / evidence_refs / error_detail. 

## 4.6 P5 State & Evidence Plane 

Status and evidence plane. 

**Includes**: truth tables/event log/artifact store/memory/knowledge/audit/projections/checkpoints/evidence bundles/incident records/DLQ records 

**Responsibilities**: Save the current control truth · Preserve historical change tracks · Support recovery and playback · Preserve audit evidence · Support console query
**v2.0 Improvement**: P5 is exposed to the outside through the unified Repository interface, and the upper layer does not directly operate the storage implementation. The Repository interface supports multi-backend switching (see §26). 

## 4.7 X1 Reliability & Security Fabric 

Life support systems across all planes. 

**Includes**: authn/authz/sandbox/secrets/egress control/quotas/circuit breakers/timeouts/retries/rate limits/health checks/anomaly detection/backpressure/DLQ/incident hooks 

**Positioning**: This is not an auxiliary ability, but the basic life support system of the platform. Each capability of X1 is injected into each plane in the form of middleware / interceptor / decorator and is not deployed as an independent service.

 ---

# 5. Inter-plane communication contract 

> v1.2 defines five planes, but does not define the interface protocol between the planes. v2.0 formalizes inter-plane communication. 

## 5.1 Design principles 

* The planes can only communicate through **formal contract object** and cannot directly call each other's internal implementation. 
* Each contract object is **serializable, auditable, and replayable** 
* Use typed interface for synchronous calls and domain event for asynchronous notifications 

## 5.2 Inter-plane contract matrix
| Caller → Callee | Contract object | Communication method | Description |
|----------------|---------|---------|------|
| P1 → P2 | `RequestEnvelope` | Synchronization | All requests first go through P2 for policy/admission check |
| P2 → P3 | `ControlDirective` | Synchronization/Events | Mode switching, pause, quota adjustment |
| P3 → P4 | `ExecutionPlan` | Synchronization | The standard execution plan output by the orchestration layer to the execution layer |
| P4 → P3 | `ExecutionReceipt` | Synchronization | The execution results are reported to the orchestration layer |
| P4 → P5 | `StateCommand` | Synchronization | Photo truth table, additional events |
| P3 → P5 | `EvidenceRecord` | Asynchronous | Writing decision evidence |
| P2 → P4 | `ControlDirective` | Synchronization | Emergency braking/mode switching directly to the execution layer (mentioned in §4.3, §60 emergency braking scenario) |
| P5 → P2 | `ProjectionUpdate` | Events | Projection change notification control surface |
| Arbitrary → X1 | middleware injection | aspects | not through explicit calls, through decorators/interceptors |

## 5.3 Core Contract Object Definitions

### RequestEnvelope

```typescript
interface RequestEnvelope {
  request_id: string;
  idempotency_key: string;
  trace_id: string;
  principal: Principal;
  tenant_id: string;
  timestamp: string;
  payload: unknown;
  metadata: Record<string, string>;
}
```

### ControlDirective

```typescript
interface ControlDirective {
  directive_id: string;
  type: "mode_switch" | "pause" | "resume" | "rollback" | "quota_adjust" | "kill";
  target_scope: { tenant_id?: string; workflow_id?: string; worker_id?: string };
  issued_by: Principal;
  reason: string;
  params: Record<string, unknown>;
  expires_at?: string;
}
```

### ExecutionPlan

```typescript
interface ExecutionPlan {
  plan_id: string;
  trace_id: string;
  principal: Principal;
  workflow_run_id: string;
  steps: PlannedStep[];
  fallback_strategy: "retry" | "replan" | "escalate" | "abort";
  approval_gates: string[];
  side_effect_expectations: SideEffectExpectation[];
  budget: { max_steps: number; max_duration_ms: number; max_cost: number };
  created_at: string;
}
```

### ExecutionReceipt

```typescript
interface ExecutionReceipt {
  receipt_id: string;
  plan_id: string;
  step_id: string;
  status: "succeeded" | "failed" | "timeout" | "cancelled" | "awaiting_approval";
  duration_ms: number;
  side_effects: SideEffectRecord[];
  evidence_refs: string[];
  error?: { code: string; message: string; retryable: boolean };
}
```

### StateCommand

```typescript
interface StateCommand {
  command_id: string;
  trace_id: string;
  principal: Principal;
  type: "update_truth" | "append_event" | "write_checkpoint" | "store_artifact";
  aggregate_id: string;
  expected_version: number;    // CAS
  fencing_token: string;
  payload: unknown;
}
```
## 5.4 Contract compliance rules 

1. **Cannot be bypassed**: P1 cannot skip P2 and adjust P4 directly. 
2. **Not reversible**: P5 cannot send instructions to P4 (can only be read/written) 
3. **Must be signed**: Each contract object must contain principal and trace_id 
4. **Must be idempotent**: All StateCommands must do CAS based on expected_version 
5. **Must be replayable**: All contract objects must be serializable to JSON 

---

# 6. API contract and versioned architecture 

> v1.2 does not define platform external API. v2.0 treats APIs as a first-level architectural concern. 

## 6.1 API layering
| API layer | Oriented | Protocol | Authentication method |
|--------|------|------|---------|
| Public API | Business systems, CI/CD | REST + WebSocket | API Key + JWT |
| Admin API | Operation and maintenance personnel, console | REST | JWT + RBAC |
| Internal API | Inter-plane calls | typed interface (in-process) or gRPC (cross-process) | mTLS/service token |
| Plugin API | Plugin / adapter | IPC / sandbox boundary | capability token |

## 6.2 Public API Design Guidelines

* Resource naming uses kebab-case plural form: `/api/v1/workflow-runs`
* All write operations must carry `Idempotency-Key` header
* All responses contain `X-Request-Id` and `X-Trace-Id`
* Error responses use a unified structure:

```typescript
interface ApiError {
  code: string;          // "APPROVAL_REQUIRED" | "LEASE_EXPIRED" | ...
  message: string;
  details?: unknown;
  retry_after_ms?: number;
  trace_id: string;
}
```
## 6.3 API resource overview
| Resources | Methods | Description |
|------|------|------|
| `/api/v1/tasks` | POST / GET | Create tasks, query task list |
| `/api/v1/tasks/{id}` | GET / DELETE | Query/Cancel a single task |
| `/api/v1/workflow-runs` | GET | Query workflow run list |
| `/api/v1/workflow-runs/{id}` | GET | Query single run details |
| `/api/v1/workflow-runs/{id}/steps` | GET | Query step list |
| `/api/v1/approvals` | GET | Pending approval list |
| `/api/v1/approvals/{id}` | POST | Submit approval decision |
| `/api/v1/incidents` | GET | Incident list |
| `/api/v1/knowledge` | GET / POST | Knowledge query/write |
| `/api/v1/packs` | GET / POST | Pack registration and query |
| `/api/v1/packs/{id}/versions` | GET / POST | Pack version management |
| `/api/v1/plugins` | GET / POST | Plugin registration and query |
| `/api/v1/prompts` | GET | Prompt version query |
| `/api/v1/cost-reports` | GET | Cost report query |
| `/api/v1/webhooks` | GET / POST / DELETE | Webhook subscription management |
| `/api/v1/admin/workers` | GET | Worker status |
| `/api/v1/admin/config` | GET / PUT | Configuration management |
| `/api/v1/admin/rollouts` | GET / POST | Rollout management |
| `/api/v1/admin/tenants` | GET / POST / PUT | Tenant management |
| `/api/v1/admin/budgets` | GET / PUT | Budget configuration |
| `/ws/v1/stream` | WebSocket | Real-time event streaming |
## 6.4 version compatibility policy 

* API versions are distinguished by URL path (`/api/v1/`, `/api/v2/`) 
* Only **backwards compatible** changes (new fields, new endpoints) are made within the same major version 
* Destructive changes must be upgraded to a larger version, and the old version must be maintained for at least 6 months 
* Event schema uses the `schema_version` field, and consumers are dispatched by version 
* Internal TypeScript interface changes are verified at runtime through Zod schema 

## 6.5 Certification Process

 **API Key + JWT dual mode**:
| Scenario | Authentication method | Description |
|------|---------|------|
| Call between services | API Key (Header: `X-API-Key`) | Long-term valid, issued by tenant |
| User operation | JWT (Header: `Authorization: Bearer`) | OAuth2 / OIDC issued, short-term valid |
| Console | JWT + CSRF token | Browser security protection |
| Webhook callback | HMAC signature verification | `X-Signature-256` header |

**Token lifecycle**: access_token TTL = 15min, refresh_token TTL = 24h, API key supports manual rotation.

## 6.6 Pagination and Filtering

* List endpoints use cursor-based pagination uniformly: `?cursor=xxx&limit=20`
* Response contains `next_cursor`, which is null when it is the last page
* Filtering uses query parameters: `?status=running&tenant_id=xxx&created_after=2026-01-01`
* Sorting: `?sort=created_at:desc`
* Maximum 100 items per page

## 6.7 Webhook Delivery Guarantee

```typescript
interface WebhookSubscription {
  subscription_id: string;
  tenant_id: string;
  target_url: string;
  events: string[];
  secret: string;
  active: boolean;
  retry_policy: { max_retries: number; backoff_ms: number };
}
```

* Delivery uses at-least-once semantics (outbox pattern)
* Each delivery contains `X-Webhook-Id` (idempotency key) and `X-Signature-256` (HMAC signature)
* Target returns 2xx as success, otherwise retry according to retry_policy
* After > 50 consecutive failures, the subscription is automatically disabled, and the tenant administrator is notified

---

# 7. Service Communication Architecture

> v1.2 does not define inter-service communication. v2.0 specifies three communication modes and their applicable scenarios.

## 7.1 Three Communication Modes

### Synchronous Request/Response

Applicable: P1→P2 admission check, P3→P4 dispatch, P4→P5 truth write

Requirements:
* Must set timeout (default 5s, max 30s)
* Must have fallback (degrade / reject / queue)
* Must have circuit breaker protection

### Asynchronous Event Notification

Applicable: P4→P5 event append, P5→P2 projection update, P4→X1 incident hook

Requirements:
* Use outbox pattern to ensure at-least-once
* Consumer must be idempotent (deduplication based on event_id)
* Failed events enter DLQ

### Streaming Push

Applicable: P5→P1 real-time event stream (WebSocket), worker heartbeat

Requirements:
* Automatic reconnection on connection disconnect + recovery from last_event_id
* Server backpressure (buffer full discards low-priority events)

## 7.2 Communication Topology

```text
P1 ──sync──> P2 ──sync/event──> P3 ──sync──> P4
                                              │
P5 <──sync── P4 ──event──> P5                 │
│                                              │
P5 ──event──> P2 (projection updates)          │
P5 ──stream──> P1 (WebSocket)                  │
                                              │
X1 ──middleware──> ALL PLANES                  │
```
## 7.3 Outbox Pattern Design 

All events that require guaranteed delivery use the outbox pattern: 

1. Business operations and event writing are completed in the same database transaction 
2. Independent outbox poller reads unsent events asynchronously 
3. Mark sent after successful sending 
4. Transfer to DLQ after the sending failure exceeds the threshold. 
5. Poller itself guarantees single-instance operation through lease 

## 7.4 In-process vs cross-process
| Stage | Communication Method | Description |
|------|---------|------|
| Phase 1 (single) | In-process typed interface call | All planes in the same process |
| Phase 2 (preliminary split) | In-process + Redis pub/sub | Event channel asynchronousization |
| Phase 3 (microservices) | gRPC + event bus | Independent deployment between planes |
This ensures a smooth evolution from monolith to microservices, rather than requiring 18 services from the start. 

---

# 8. Scalability architecture 

> v1.2 does not involve horizontal scaling. v2.0 defines the scaling strategy from single node to cluster.

 ## 8.1 Extended dimensions
| Dimensions | Scaling strategies | Trigger conditions |
|------|---------|---------|
| Worker concurrency | Add worker processes/containers | Queue backlog > Threshold |
| Storage capacity | SQLite → PostgreSQL → Table/Archive | Data volume > Threshold |
| Event throughput | Partition by tenant_id | Event rate > Single poller processing capacity |
| API throughput | API Gateway horizontal scaling | QPS > Single instance upper limit |
| Projection lag | Add projector instance | Projection lag > SLO |
## 8.2 Stateless principle 

* P1/P3/P4 are designed to be stateless, and all persistent states are stored in P5 
* Worker avoids state binding through lease mechanism 
* Session state is persisted through checkpoint instead of memory retention 
* Any process can be killed and resumed on another node 

## 8.3 Sharding strategy 

When a single node is not enough, shard according to the following dimensions: 

* **dispatch queue**: Shard by tenant_id hash 
* **event outbox**: partition by aggregate_type 
* **projection rebuild**: parallel by projection_name 
* **worker pool**: pool divided by capability_class (coding/operations/browser) 

## 8.4 Expansion phase
| Stage | Architecture | Support scale |
|------|------|---------|
| S1 singleton | single process + SQLite | 10 concurrent workflow, 5 workers |
| S2 multi-process | Main process + worker process + Redis | 50 concurrency, 20 workers |
| S3 distributed | Microservices + PostgreSQL + event bus | 500 concurrency, 100 workers |
| S4 Cluster | Kubernetes + PG Sharding + Multi-AZ | 5000+ Concurrency |

> **TODO (Phase 3 Infrastructure)**: S4 Kubernetes cluster sharding requires:
> - Multi-tenant scheduler with tenant-aware Pod placement
> - Cross-Pod coordination for distributed lease management
> - PG sharding strategy (e.g., Citus, CockroachDB, or manual sharding)
> - Multi-AZ failover and data locality
> - Service mesh (Istio/Linkerd) for cross-Pod communication
> This is not yet implemented; tracked for Phase 3.

---

# 9. Stability Architecture

> Retain v1.2's seven-layer model. v2.0 adds **automation mechanisms** and **trigger rules** for each layer.

## 9.1 Stability Layer 1: Isolation

**Isolation dimensions**: tenant · project · domain · worker pool · executor · adapter · browser session · plugin process

**Design requirements**: coding and operations are in separate pools · high-risk adapters have independent pools · browser executor does not share pool with ordinary tool executors · high-risk tenants can have dedicated resource pools

**v2.0 Automation**: When a tenant's failure rate > 30%, automatically isolate that tenant to an independent worker pool without affecting other tenants.

## 9.2 Stability Layer 2: Rate Limiting and Backpressure

**Rate limiting points**: API ingress rate limit · per-tenant concurrency · per-workflow active · per-worker max concurrency · per-adapter QPS · per-tool burst · approval queue inflow

**Backpressure strategy**: queue delay → reject low priority → degrade to supervised → stop non-critical workflows → freeze rollout → restrict external calls

**v2.0 Automation**: Backpressure strategy **escalates automatically by gradient**:

```text
Level 0 (Normal)     → queue_lag < 10s
Level 1 (Warning)     → queue_lag 10-30s → Delay low priority
Level 2 (Throttling)     → queue_lag 30-60s → Reject low priority + supervised mode
Level 3 (Protection)     → queue_lag > 60s  → Only allow critical workflow + manual_only
```
## 9.3 Stability Layer 3: Timeouts and Retries 

**Level 3 timeout**: step timeout · attempt timeout · tool/adapter timeout 

**Retry Rules**: 
* Only retryable failure automatically retries 
* Only idempotent operations allow automatic retries 
* Backoff strategy: exponential backoff with jitter, base=1s, max=60s 
* Enter explicit `retry_exhausted` state after retrying, triggering escalation 

## 9.4 Stability Layer 4: Circuit Breaker 

**Circuit breaker object**: Third-party API · External adapter · Model provider · High failure rate tool · Plugin runtime 

**State machine**: closed → open (failure_rate > 50% in 60s window) → half-open (low traffic detection after 30s) → closed 

**v2.0 Improvement**: Circuit breaker state changes must emit the `circuit_breaker.state_changed` event to trigger alarms and mode switching evaluation. 

## 9.5 Stability Layer 5: Degraded Mode

 **Official modes**: full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode 

**v2.0 Automation**: Mode switching is issued through `ControlDirective`, supporting automatic triggering rules:
| Trigger condition | Automatically switch to |
|---------|-----------|
| worker pool unhealthy > 50% | supervised_auto |
| external adapter circuit open | no-external-call |
| security incident detected | incident-mode |
| rollout guardrail breach | no-rollout |
| approval backlog > 100 | manual_only (pause new workflow) |

## 9.6 Stability Layer 6: Recovery Capability

**Recovery components**: lease reclaim · execution recovery · workflow recovery · replay · repair · projection rebuild · stuck-run sweeper

**v2.0 Improvement**: Each recovery component must have an independent health check and report recovery success rate to the Control Plane through `RecoveryReport`.

## 9.7 Stability Layer 7: Observability

**Minimum capabilities**: metrics · structured logs · traces · audit · event timeline · health snapshot

**v2.0 Improvement**: Define core observability indicators (see §27 Performance and SLO).

---

# 10. Risk Control Architecture

> Retain v1.2's four-quadrant model. v2.0 adds **risk scoring algorithm** and **automated risk control engine**.

## 10.1 Risk Model Four-Quadrant Approach

* **R1 Execution Risk**: Wrong execution · Duplicate execution · Concurrent conflict · stale write
* **R2 Business Risk**: Wrong code change · Wrong traffic switch · Wrong notification sent · Wrong release
* **R3 Security Risk**: Unauthorized access · Data leakage · Secret exposure · Unauthorized external connection
* **R4 Platform Risk**: Rollout out of control · Projection distortion · Replay misoperation · Worker pool avalanche

## 10.2 Risk Scoring Algorithm

> v1.2 only gave "low/medium/high/critical" four levels but did not specify how to calculate. v2.0 defines the scoring formula.

```text
risk_score = Σ(factor_weight × factor_value) / max_possible_score

Factor weights:
  step_type_risk:      weight=3  (read=1, write=3, delete=5, external_call=4)
  target_system_risk:  weight=4  (internal=1, staging=2, production=5)
  data_class_risk:     weight=3  (public=1, internal=2, confidential=4, restricted=5)
  blast_radius:        weight=2  (single_task=1, workflow=2, tenant=3, platform=5)
  prior_failure_rate:  weight=2  (0-10%=1, 10-30%=2, 30-50%=3, >50%=5)
  confidence:          weight=1  (high=1, medium=3, low=5)

Mapping:
  0.0 - 0.25  →  low
  0.25 - 0.50 →  medium
  0.50 - 0.75 →  high
  0.75 - 1.00 →  critical
```

## 10.3 Automated Risk Control Engine

```text
RiskAssessmentRequest
  → Calculate risk_score
  → Query tenant risk policy coverage
  → Determine risk_level
  → Match risk_action_rule
  → Output RiskDecision { level, actions[], requires_approval, evidence_level }
```
**Risk Control Action Matrix**:
| risk_level | automatic execution | log level | approval | side effect | evidence |
|-----------|---------|---------|------|------------|---------|
| low | ✅ | info | no | normal | basic |
| medium | ✅ | warn | no | normal + check | enhanced |
| high | ❌ | error | required | restricted | complete |
| critical | ❌ | critical | break-glass | prohibited | legal grade |
## 10.4 Risk Mitigation Mechanism 

sandbox mode · read_only mode · write_limited mode · approval gate · dry_run · shadow mode · canary · rollback plan mandatory · evidence bundle mandatory 

---

# 11. Security and Reliability Architecture

 ## 11.1 Unified Identity Model 

All actions must have a principal. 

**principal type**: user · service · agent · worker · plugin · system 

**Requirements**: All event / audit / decision / incident associated principals. All incidents can be traced to the principal chain. 

## 11.2 Unified authorization model 

Third floor: 

* **RBAC**: role-level permissions 
* **Capability**: Capability level permissions (can_run_browser / can_use_prod_adapter / can_approve_release / can_replay_events)
 * **Context-aware policy**: Combined with tenant / project / workflow / environment / risk level / data class dynamic decision-making 

**v2.0 Improvement**: Authorization decisions are recorded as `PolicyOutcome`, including decision / matched_rules / evaluation_duration, supporting auditing and policy tuning. 

## 11.3 Secret Security

 * secret is only allowed to be quoted, not passed textually 
* Secret injection is effective for a short period of time (TTL ≤ 300s) 
* secret does not enter memory / knowledge 
* Do secret scan before artifact output
 * Logs / traces / audit perform secret redaction uniformly 

## 11.4 Sandbox Security 

Fourth gear: read_only · workspace_write · scoped_external_access · restricted_exec 

Any high-risk actions should not have direct full access. 

**Technical Implementation Specifications**:
| Sandbox Tier | Isolation Technology | File System | Network | Process | Resource Limitation |
|-------------|---------|---------|------|------|---------|
| read_only | child process + seccomp | read-only mount | disabled | single process | 256MB / 10s |
| workspace_write | child process + seccomp | tmpfs write + workspace write | disabled | single process | 512MB / 30s |
| scoped_external_access | container (optional) | tmpfs write | egress allowlist only | multi-process | 1GB/60s |
| restricted_exec | container | overlay fs | egress allowlist | multi-process | 2GB / 300s |
## 11.5 Network outbound security 

All external calls go through egress control. Control dimensions: destination allowlist · adapter binding · credential binding · data class · environment · operation type. egress deny must be logged as a formal security event. 

## 11.6 Data classification 

Basic classification: public · internal · confidential · restricted 

Extension tags: pii · regulated · secret-bearing 

Grading impact: whether it can be included in the model · whether it can be exported · whether it can be included in the knowledge · whether it must be approved 

## 11.7 Plug-in security 

Plugins are considered untrusted extensions. Requirements: Independent process · Resource limits · IPC boundaries · Capability whitelist · Output validation · Crash isolation · Quarantineable · Hotdisableable. 

## 11.8 Threat Model (STRIDE)
| Threats | Attack Surface | Mitigation Measures |
|------|--------|---------|
| **S**poofing (disguise) | API call, Agent identity | JWT/API Key authentication + Principal chain traceability |
| **T**ampering | event log, artifact, prompt | append-only event + CAS + content hash verification |
| **R**epudiation (denial) | Operations cannot be traced | Full-link audit + evidence bundle + immutable audit log |
| **I**nformation Disclosure | Prompt leakage, Secret leakage, PII | Secret redaction + data classification + Prompt is not exposed to the terminal |
| **D**enial of Service | API overload, Worker exhaustion | Current limiting + back pressure + tenant quota + circuit breaker |
| **E**levation of Privilege | Plugin privilege escalation, Agent privilege escalation | Sandbox tier + capability whitelist + context-aware policy |
**v2.1 new threats**:
| Threats | Attack Surface | Mitigation Measures |
|------|--------|---------|
| Prompt Injection | User input to inject malicious instructions | Input sanitization + output verification + Sandbox restrictions |
| Model Manipulation | Malicious fine-tune/jailbreak | Quality Gating (§17) + Output Security Checks |
| Data Exfiltration via LLM | Model remembers sensitive data | data_classification routing (§15.3) + PII does not enter the model |

## 11.9 Encryption Strategy

Transport encryption, storage encryption, and key management are detailed in §23.5 Encryption Architecture. This section emphasizes security layer constraints:

* All inter-plane communication must use TLS 1.3 (except in-process)
* PII fields stored in P5 must use application-level encryption (not relying on database TDE)
* Secret storage integrates Vault (or equivalent KMS), application layer only holds references
* Audit logs must contain integrity signatures (HMAC) to prevent post-hoc tampering

---

# 12. Exception Event Handling Architecture

> E1-E6 classification and SEV1-4 severity grading, with **observability data model** and **automated detection rules**.

## 12.1 Exception Event Classification

- **E1 Business Exception**: validation fail · wrong output · no result · low confidence
- **E2 Execution Exception**: timeout · worker crash · lease expired · retry exhausted
- **E3 External Dependency Exception**: adapter failure · provider timeout · rate limit · circuit open
- **E4 Security Exception**: unauthorized access · secret leak risk · egress deny · policy violation
- **E5 Data Exception**: stale projection · event append failure · invariant break · replay inconsistency
- **E6 Governance Exception**: rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 Severity Levels

- SEV4: localized and minor, auto-recoverable
- SEV3: single workflow / single worker impact
- SEV2: single domain / single tenant noticeably affected
- SEV1: platform-wide impact / security incident / severe production risk

## 12.3 Exception Detection Rule Engine

> Upgrade exception detection from hard-coded to a rule engine.

**Built-in rule examples**:

| Rule                      | Condition                  | Level | Action                                       |
| ------------------------- | -------------------------- | ----- | -------------------------------------------- |
| worker_heartbeat_missing  | heartbeat_gap > 30s        | SEV3  | create_incident + lease_reclaim              |
| execution_timeout_spike   | timeout_rate > 20% in 5min | SEV3  | notify + mode_switch(supervised)             |
| projection_lag_high       | lag > 30s                  | SEV3  | notify + rebuild_trigger                     |
| security_policy_violation | any violation              | SEV2  | create_incident + quarantine                 |
| platform_wide_failure     | error_rate > 50% in 1min   | SEV1  | create_incident + mode_switch(incident-mode) |

## 12.4 Observability Data Model

> Define concrete observability metrics.

### Core Metrics

| Metric                         | Type      | Labels             | Description              |
| ------------------------------ | --------- | ------------------ | ------------------------ |
| `agent.task.total`             | counter   | tenant, status     | Total task count         |
| `agent.execution.duration_ms`  | histogram | tenant, step_type  | Execution duration       |
| `agent.execution.failure_rate` | gauge     | tenant, error_type | Failure rate             |
| `agent.dispatch.queue_depth`   | gauge     | queue_class        | Queue depth              |
| `agent.dispatch.latency_ms`    | histogram | queue_class        | Dispatch latency         |
| `agent.worker.active`          | gauge     | pool, capability   | Active worker count      |
| `agent.projection.lag_seconds` | gauge     | projection_name    | Projection lag           |
| `agent.approval.pending_count` | gauge     | severity           | Pending approval count   |
| `agent.circuit_breaker.state`  | gauge     | target             | Circuit breaker state    |
| `agent.dlq.depth`              | gauge     | category           | DLQ depth                |

### Structured Log Specification

Every log entry must be in JSON format with the following required fields:

| Field               | Type    | Description                                                       |
| ------------------- | ------- | ----------------------------------------------------------------- |
| `timestamp`         | ISO8601 | Millisecond precision, UTC timezone                               |
| `traceId`           | string  | Correlates to distributed Trace (§12.7)                           |
| `spanId`            | string  | Current Span identifier                                           |
| `level`             | enum    | DEBUG / INFO / WARN / ERROR / FATAL                               |
| `service`           | string  | Name of the service emitting the log                              |
| `plane`             | enum    | P1-P5 / X1-X2, identifies the owning plane                       |
| `message`           | string  | Short human-readable description                                  |
| `structuredPayload` | object  | Business context key-value pairs (tenantId, domainId, taskId etc) |

**Log level guidelines**: DEBUG for local development only; INFO for normal business flow; WARN for auto-recoverable exceptions; ERROR for faults requiring human intervention; FATAL for severe errors causing process exit. Default production level is INFO.

## 12.5 DLQ and Incident

**DLQ must have**: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQ is not a trash bin — it must be operationally manageable.

**Incident must associate**: affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution.

## 12.6 Alert Routing Architecture

> Incidents must be routed to the right person after creation.

| SEV Level | Notification Channel          | Response SLA    | Escalation Rule                    |
| --------- | ----------------------------- | --------------- | ---------------------------------- |
| SEV4      | Platform console + logs       | Next business day | None                              |
| SEV3      | IM notification (Slack/Lark)  | 4h              | No response in 4h → SEV2          |
| SEV2      | IM + Email + on-call          | 1h              | No response in 1h → SEV1          |
| SEV1      | IM + phone + all-hands broadcast | 15min        | No response in 15min → management |

**External integration**: Connect to PagerDuty / OpsGenie / enterprise IM via Webhook. The platform does not implement alert channels internally — it only defines routing rules and delivery interfaces.

## 12.7 Distributed Tracing Architecture

> Define the correlation model of trace → span → log → metric.

**Span hierarchy**:

```text
Trace (task_id)
  └─ Span: workflow_run
       ├─ Span: oapeflir_cycle
       │    ├─ Span: observe
       │    ├─ Span: assess
       │    ├─ Span: plan
       │    │    └─ Span: llm_call (model_gateway)
       │    └─ Span: feedback
       ├─ Span: dispatch
       ├─ Span: execution (step)
       │    └─ Span: tool_call / llm_call / human_wait
       └─ Span: state_write
```

**Correlation rules**:

- All StructuredLog entries must include trace_id + span_id (already present)
- Metrics correlate to trace_id via exemplars (sampled for high-cardinality metrics)
- Incidents correlate to trigger trace_id, enabling full call-chain tracing from an incident
- Sampling strategy: error traces 100% collected, normal traces per tenant config (default 10%)

---

# 13. OAPEFLIR Controlled Cognitive Kernel

> Dual-chain model, with **per-stage interface contracts** and **inter-stage data flow definitions**.

## 13.1 Dual-Chain Topology

**Primary chain (synchronous)**: Observe → Assess → Plan → Execute → Feedback

**Secondary chain (asynchronous)**: Feedback → Learn → Improve → Release

## 13.2 Stage Interface Contracts

### Observe

Input: raw request or event (RequestEnvelope / WebhookEvent). Output: StructuredObservation.
Responsibility: extract intent, context, and urgency from unstructured input to produce a standardized observation object for downstream stages.

### Assess

Input: StructuredObservation. Output: RiskAssessment + FeasibilityReport.
Responsibility: evaluate risk level, check policy compliance, determine execution mode (autonomous / human-in-the-loop / reject), and provide constraint boundaries for the Plan stage.

### Plan

Input: RiskAssessment + FeasibilityReport. Output: ExecutionPlan + PlanBundle.
Responsibility: decompose goals into ordered steps, allocate budgets and tools, generate rollback strategies, and output a standard plan directly executable by P4.

### Execute

The Execute stage is not implemented within OAPEFLIR — it delegates to P4 Execution Plane (see §14). OAPEFLIR only submits `ExecutionPlan` and receives `ExecutionReceipt`.

### Feedback

Input: ExecutionReceipt. Output: FeedbackEnvelope.
Responsibility: evaluate execution result quality, detect goal drift, compare expected vs actual output, and generate feedback signals for the Learn stage.

### Learn (async)

Input: FeedbackEnvelope batches. Output: LearningInsight.
Responsibility: asynchronously extract failure and success patterns, classify fault root causes, aggregate cross-task statistics, and produce actionable learning insights.

### Improve (async)

Input: LearningInsight. Output: ImprovementCandidate.
Responsibility: generate prompt optimization patches, policy rule adjustments, or tool configuration changes based on learning insights, and submit to the Release stage for governance approval.

### Release (controlled)

Release is not an automatic step — it is a publication process governed by P2 Control Plane. ImprovementCandidate must go through the full rollout flow of validation → approval → canary → staged → stable.

## 13.3 Inter-Stage Data Flow

```text
ObserveContext ──→ [Observe] ──→ UnifiedObservation
                                      │
                                      ▼
                               [Assess] ──→ UnifiedAssessment
                                      │            │
                                      ▼            ▼
                    UnifiedObservation + UnifiedAssessment
                                      │
                                      ▼
                                [Plan] ──→ ExecutionPlan
                                      │
                                      ▼
                           [P4 Execution Plane]
                                      │
                                      ▼
                          ExecutionReceipt ──→ [Feedback] ──→ StepFeedback
                                                                  │
                                              ┌──── replan ◄─────┤
                                              │                   │
                                              ▼                   ▼ (async)
                                         [Plan]             [Learn] ──→ LearningObject
                                                                            │
                                                                            ▼
                                                                   [Improve] ──→ ImprovementCandidate
                                                                            │
                                                                            ▼
                                                                  [P2 Release Control]
```

## 13.4 Constraints

- OAPEFLIR is not the Runtime — it only makes decisions, not executions
- Learn / Improve must not go live directly — they must pass P2 rollout governance
- Risk / policy / approval checks must be inserted before high-risk actions
- Input and output of every stage must pass Zod schema runtime validation

## 13.5 Harness External Semantic Mapping

The OAPEFLIR eight stages are the platform's internal cognitive kernel. For product teams, business stakeholders, and multi-Agent collaboration scenarios, a simplified **Harness role mapping** layer is provided:

| Harness Role        | OAPEFLIR Stage Mapping                  | Responsibility Boundary                                                                          |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Planner**         | Observe + Assess + Plan                 | Understand goals, decompose tasks, identify risks, generate execution plans, select tools & budgets, produce acceptance criteria |
| **Generator**       | Execute (delegated to P4)               | Invoke tools, execute steps, write-back evidence, produce interim results, request help rather than forcing through when blocked |
| **Evaluator**       | Feedback + local evaluation + quality gate | Judge result quality, check goal deviation, check risk escalation, decide pass/redo/degrade/escalate to HITL |
| **Loop Controller** | Learn + Improve + Replan + Release gate | Control loop count, decide when to replan, when to approve, when to terminate, when to release improvements |

```text
            ┌─────────────────────────────────┐
            │       Harness Runtime (§45)      │
            │                                  │
            │  ┌─────────┐    ┌───────────┐   │
 Request ──>│  │ Planner │───>│ Generator │   │
            │  │(O+A+P)  │    │(Execute)  │   │
            │  └────┬────┘    └─────┬─────┘   │
            │       │               │          │
            │       │    ┌──────────▼────────┐ │
            │       │    │    Evaluator      │ │
            │       │    │(Feedback+Quality) │ │
            │       │    └──────────┬────────┘ │
            │       │               │          │
            │  ┌────▼───────────────▼────────┐ │
            │  │     Loop Controller         │ │
            │  │  (Learn+Improve+Replan+     │ │
            │  │   Release gate)             │ │──> Result
            │  └─────────────────────────────┘ │
            └─────────────────────────────────┘
```

Significance of the two-layer mapping:

- **Internal**: OAPEFLIR maintains fine-grained stage control, each stage with independent interface contracts and Zod validation
- **External**: Harness four-role semantics are easier to understand, facilitating multi-Agent collaboration protocol standardization
- **Debugging**: observe the full chain at Harness granularity, or drill down to individual OAPEFLIR stages

**Dual-model hard rule**: external protocols must use Harness role semantics (Planner/Generator/Evaluator/Decision); internal implementation may continue to subdivide by OAPEFLIR eight stages.

| Audience Perspective | Model Used             | Typical Scenarios                                   |
| -------------------- | ---------------------- | --------------------------------------------------- |
| Product/Business     | Harness four roles     | Requirement communication, capability intro, API docs |
| Runtime/Dispatch     | OAPEFLIR eight stages  | Execution engine, LoopController, state machine advancement |
| Audit/Compliance     | HarnessRun/HarnessStep | Execution evidence chain, compliance reports, approval records |
| ML/Algorithm         | OAPEFLIR eight stages  | Model evaluation, prompt tuning, per-stage performance analysis |

---

# 14. Runtime Execution Plane

> Core responsibility definition, with **execution strategy patterns** and **Executor registration mechanism**.

## 14.1 Core Responsibilities

session / task / workflow_run / execution lifecycle · dispatch / queue / worker scheduling · lease / fencing · executor invocation · side effect controlled commit · retry / timeout / recovery · mode-aware execution · event emission

## 14.2 Dispatcher Intelligent Scheduling

Dispatcher also serves as a risk isolation point. Scheduling decision matrix:

| Factor              | Impact                                    |
| ------------------- | ----------------------------------------- |
| worker capability   | Match capabilities required by the step   |
| worker health       | Exclude unhealthy workers                 |
| queue class         | priority / standard / background          |
| risk class          | High-risk steps assigned to isolated pool |
| tenant quota        | Single tenant must not exceed quota       |
| sandbox requirement | Match sandbox tier                        |

## 14.3 Execution Strategy Patterns

> Upgrade execution strategies from hard-coded to configurable patterns.

Each Business Pack can declare its own ExecutionStrategy to override defaults.

## 14.4 Executor Registration Mechanism

> Upgrade executors from hard-coded to pluggable registration.

**Built-in Executor types**: ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect Two-Phase

1. Executor returns proposed side effect
2. Policy / approval decides whether to allow commit
3. Side effect repository records
4. Compensation performed when necessary

> Tool execution success does not mean the side effect is officially committed.

## 14.6 HumanWait Is a First-Class Executor

Approval waiting is not a bypass. HumanWait is responsible for: creates decision → blocks execution → waits resolution → resumes flow.

## 14.7 Recovery Worker Family

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

Each Recovery Worker must declare its own `RecoveryCadence` (check interval, max concurrent recoveries, timeout) and report results via `RecoveryReport`.

## 14.8 Runtime Mode Switching

**Canonical mode set** (consistent with §9.5): full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

Where `full_auto` corresponds to the former `normal`, and `supervised_auto` corresponds to the former `degraded`/`supervised`. All runtime modes must use this canonical enum.

Mode switching authority belongs to P2 Control Plane, issued via `ControlDirective(type: "mode_switch")`.

---

# 24. Configure governance structure 

> v1.2 only mentions the name "config center". v2.0 defines a complete configuration governance model. 

## 24.1 Configuration layering
| Layers | Examples | Change frequency | Approval requirements |
|----|------|---------|---------|
| Platform default | retry_max=3, timeout=5000ms | Extremely low | ADR level |
| Environment Coverage | prod.timeout=10000ms | Low | P2 Approval |
| Tenant Overrides | tenant_A.max_concurrent=50 | Medium | Tenant Admin |
| Business package coverage | coding.retry_max=5 | Medium | Pack person in charge |
| runtime dynamics | circuit_breaker.threshold=0.3 | high | automatic rules |
## 24.2 Configuration versioning 

* Generate a new version for each configuration change, keeping the complete history 
* Support diff: display the differences between two versions 
* Support rollback: roll back to any historical version with one click 
* Configuration changes emit the `config.changed` event, triggering hot reloading of related components 

## 24.3 Configure grayscale 

High-risk configuration changes (such as timeout, current limiting threshold) support grayscale: 

1. First apply to canary environment 
2. Observe for 30 minutes and see if there is no abnormality. 
3. Expand to 10% traffic 
4. Full release 

## 24.4 Configuring security 

* Sensitive configurations (secret, credential) only store references, not clear text 
* Configuration change audit, record who / when / what / why 
* Changes to key configurations (sandbox tier, egress allowlist) must be approved by P2 

---

# 25. Data and State Consistency Architecture

The platform's state is divided into five layers, serving control, execution, context, knowledge, and evidence from top to bottom. Each layer differs in isolation, lifecycle, and consistency requirements:

```text
┌─────────────────────────────────────────────────────┐
│  L1  Control State    (Policy/Approval/Budget)       │  §11-§13, §45.20
│      Lifecycle: cross-run · strong consistency ·     │
│      changes require approval                        │
├─────────────────────────────────────────────────────┤
│  L2  Execution State  (TaskRun/Step/Checkpoint)      │  §14-§16, §45.15
│      Lifecycle: single run · transactional           │
│      consistency · checkpoint-recoverable            │
├─────────────────────────────────────────────────────┤
│  L3  Context State    (Session/Turn/Variables)       │  §45.5 ContextManager
│      Lifecycle: single session · eventually          │
│      consistent · snapshotable                       │
├─────────────────────────────────────────────────────┤
│  L4  Knowledge State  (Working/Long-term/Shared)     │  §45.16 Memory Namespace
│      Lifecycle: cross-run/cross-agent · async        │
│      sync · promotable                               │
├─────────────────────────────────────────────────────┤
│  L5  Evidence State   (Event/Trace/Metric/Audit)     │  §25-§29, §58-§59
│      Lifecycle: permanently append-only · immutable  │
│      · replayable and rebuildable                    │
└─────────────────────────────────────────────────────┘
```

Key invariants across the five layers: every L2 state change must synchronously append an L5 event; L3→L4 promotion is adjudicated by the Evaluator (§45.16); L1 changes must be approved through P2 before they can affect L2/L3.

## 25.1 Consistency Principles

No pursuit of global strong consistency. Instead, the goals are: truth state transactional consistency · event append in the same transaction · projection eventual consistency · replay rebuildability · side effect auditability.

## 25.2 Truth Table + Event Log Dual Model

- The truth table stores current state (read-optimized)
- The event log stores historical changes (audit/replay-optimized)
- Both are updated in the same transaction to guarantee consistency

## 25.3 CAS + Lease + Fencing

All critical updates must be based on: expected status CAS · active lease · fencing token. This is the hard constraint for execution-layer consistency.

## 25.4 Projections Must Be Rebuildable

All projections must be: idempotent · replay-safe · event_id deduplicated · support rebuild · never write back to truth.

## 25.5 State & Evidence Layering

| Layer      | Content                   | Purpose                                                     |
| ---------- | ------------------------- | ----------------------------------------------------------- |
| Truth      | Current control truth     | State judgment, concurrency control, scheduling advancement |
| Event      | Historical change trail   | Timeline reconstruction, replay, fault explanation          |
| Projection | Query model               | Console, reports, approval queues                           |
| Audit      | Audit records             | Who did what to what                                        |
| Artifact   | Large object content      | observation/plan/log/evidence/screenshot                    |
| Checkpoint | Execution recovery points | Breakpoint recovery, repair, replay starting point          |

## 25.6 Consistency Model and Guarantee Levels

| Operation                | Consistency Guarantee                  | Implementation Mechanism                            |
| ------------------------ | -------------------------------------- | --------------------------------------------------- |
| Truth table write        | Strong (single-partition linearizable) | CAS + fencing token + same-transaction event append |
| Event append             | Strong (same transaction as truth)     | outbox pattern (§7.3)                               |
| Projection read          | Eventual (lag ≤ 5s SLO, §27)           | Async projector + event_id dedup                    |
| Cross-tenant query       | Eventual                               | Projection aggregation, no cross-truth transactions |
| Cross-region replication | Eventual (lag ≤ 30s, §52)              | Async replication + conflict resolution             |

**Read-your-own-writes guarantee**: After writing to the truth table, subsequent read requests from the same principal read directly from the truth table via a read-after-write token, without depending on projections. The projection path does not guarantee read-your-own-writes.

**Projection eventual consistency window**: Normal operation lag ≤ 5s; under event bus backpressure, lag can reach 60s (triggers Level 2 alert, §9.2); during projection rebuild, specific projections are temporarily unavailable, and the Console displays a stale marker.

## 25.7 Schema Migration Strategy

71 logical tables (§26.3) require versioned schema evolution:

- **Backward-compatible changes** (new columns, new indexes): online migration, zero downtime
- **Breaking changes** (column renames, type changes, table splits): dual-write window (old schema + new schema written simultaneously → switch read path → stop writing old schema → cleanup)
- **Migration version tracking**: each migration script has a monotonic version, tracked via the `schema_migrations` table for executed versions
- **Rollback capability**: each migration must have a corresponding rollback script
- **Storage evolution alignment**: schema migration strategy aligns with the storage evolution path (§26.2 E1→E4) — E1/E2 use SQLite migrations, E3/E4 use PostgreSQL migrations

---
# 26. Storage Architecture

> v1.2 directly gave 44 PostgreSQL tables. v2.0 first defines the **storage abstraction layer**, then gives the **gradual evolution path**.

## 26.1 Repository Abstraction Layer

All upper-layer code accesses storage through Repository interface, not directly operating the database.

```typescript
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

interface EventStore {
  append(aggregate_id: string, events: DomainEvent[], expected_version: number): Promise<void>;
  load(aggregate_id: string, from_version?: number): Promise<DomainEvent[]>;
}

interface ProjectionStore {
  update(projection_name: string, event: DomainEvent): Promise<void>;
  rebuild(projection_name: string): Promise<void>;
  query(projection_name: string, filter: Record<string, unknown>): Promise<unknown[]>;
}
```
The meaning of this level: 
* The upper layer does not care whether the lower layer is SQLite/PostgreSQL/other 
* Can be implemented using in-memory during unit testing 
* Can incrementally migrate from SQLite to PostgreSQL 

## 26.2 Storage evolution path
| Stage | Storage engine | Applicable scenarios | Switching method |
|------|---------|---------|---------|
| E1 Development/Prototyping | SQLite (WAL mode) | Single node, 10 concurrency | Default |
| E2 small-scale production | SQLite + Redis cache | Single node, 50 concurrency | Configuration switching |
| E3 medium-scale production | PostgreSQL | Multi-node, 500 concurrency | Repository implementation replacement |
| E4 large-scale production | PostgreSQL + split-table archiving | Cluster, 5000+ concurrency | Schema evolution |
**Switching principle**: The Repository interface remains unchanged, only the implementation is replaced. Migrate tables with more reads and less writes first (projection, audit), and then migrate the core write paths (truth, event). 

## 26.3 Core table design (logical model) 

> Only logical groupings are given here, and no specific database is bound. The physical schema is defined during the detailed design phase. 

### Group 1: Workflow & Execution (12 tables) 

workflow_definition · workflow_run · loop_cycle · step_run · step_attempt · execution · execution_lease · dispatch_ticket · task · worker · checkpoint · recovery_job 

### Group 2: Decision & Policy (9 forms) 

tool_definition · tool_call · side_effect · side_effect_reconciliation · decision_record · decision_comment · approval_sla · exception_record · policy_outcome 

### Group 3: Knowledge & Artifact (8 tables) 

artifact_record · artifact_bundle · memory_entry · knowledge_namespace · knowledge_document · knowledge_chunk · knowledge_promotion · knowledge_conflict 

### Group 4: Ops & Governance (15 tables) 

improvement_candidate · rollout_record · rollout_guardrail_result · event_log · event_outbox · audit_record · incident · incident_link · dlq_record · replay_job · repair_job · projection_rebuild_job · idempotency_record · health_snapshot · config_version 

### Group 5: AI Operations (new in v2.1, 8 tables) 

prompt_version · prompt_bundle · eval_dataset · eval_run · usage_record · model_provider · delegation_request · hibernation_snapshot 

### Group 6: Domain & Organization (new in v2.2-v2.4, 10 tables) 

domain_descriptor · domain_risk_profile · domain_recipe · org_node · approval_route · compliance_policy · knowledge_boundary · governance_delegation · sso_identity · scim_sync_log 

### Group 7: Maturity & Lifecycle (new in v2.5-v2.6, 9 tables) 

agent_version · behavior_fingerprint · cost_attribution · stage_rationale · marketplace_item · connector_instance · edge_sync_state · capacity_forecast · compliance_report 

**Total**: 71 tables (v1.2 baseline 44 tables + v2.1-v2.6 added 27 tables), when implemented **tables are built in stages according to Group**, and it is not required to have them all in place at once. 

---

# 27. Performance architecture and SLO 

## 27.1 OAPEFLIR stage performance goals
| Stage | P99 Goal | Description |
|------|---------|------|
| Observe | < 50ms | Signal collection and aggregation (excluding external calls) |
| Assess | < 30ms | Evaluate decisions (without LLM calls) |
| Plan | < 100ms | DAG construction and strategy selection (without LLM calls) |
| Execute | Depends on the tool | Constrained by external dependencies, no unified goal |
| Feedback | < 10ms | Signal preprocessing and deduplication |
| Learn | < 500ms | Pattern detection (asynchronous, does not block the main chain) |
| Improve | < 1s | Candidate generation (asynchronous) |

## 27.2 Runtime SLO

| Metrics | P99 Target | Downgrade Threshold |
|------|---------|---------|
| Dispatch latency | < 200ms | > 1s trigger alarm |
| Lease acquisition | < 50ms | > 200ms trigger alarm |
| Heartbeat round-trip | < 100ms | > 500ms mark unhealthy |
| Recovery detection | < 30s | > 60s trigger SEV3 incident |
| Projection lag | < 5s | > 30s trigger rebuild |
| Checkpoint write | < 20ms | > 100ms trigger alarm |
| Event append | < 10ms | > 50ms trigger alarm |
## 27.3 Availability Goals
| Components | Availability | Downgrade Strategy |
|------|--------|---------|
| API Gateway | 99.95% | Static Error Page |
| Control Plane | 99.9% | Read-only degradation |
| Execution Plane | 99.9% | Worker pool failover |
| State Plane | 99.99% | WAL + checkpoint recovery |
| Observability | 99.5% | Indicators can be lost, but audits cannot be lost |
## 27.4 Capacity Planning
| Dimensions | S1 single | S2 multi-process | S3 distributed |
|------|---------|----------|----------|
| Concurrent workflow | 10 | 50 | 500 |
| Active worker | 5 | 20 | 100 |
| Event/s | 100 | 500 | 5,000 |
| Storage | 1GB SQLite | 10GB SQLite | 100GB+ PG |
## 27.5 Performance testing requirements 

* Load test must be run before every major change 
* Load test scenario: normal load / peak load / degradation / recovery 
* The results are recorded as evidence, associated with rollout 

## 27.6 Error Budget Strategy 

> New in v2.1. Define the organizational response when an SLO is breached. 

**Error Budget Definition**: Availability SLO 99.9% → Monthly Error Budget = 43.2 minutes of unavailability.
| Budget Consumption | Status | Response |
|------------|------|------|
| 0-50% | Normal | Normal release rhythm |
| 50-80% | Early warning | Slow release of non-urgent changes |
| 80-100% | Freeze | Allow only fix releases, pause feature rollout |
| > 100% | Excess | Full freeze + special reliability fixes + management review |
**Burn Rate Alarm**: 

* 1h burn rate > 14.4x (2% budget consumed in 1h) → SEV2 alarm 
* 6h burn rate > 6x (5% budget consumed in 6h) → SEV3 alarm 
* Use multi-window strategy to reduce false positives 

## 27.7 LLM Delayed Teardown 

LLM calls typically dominate end-to-end latency. Must be modeled separately:
| Delay Components | P99 Target | Description |
|---------|---------|------|
| Prompt rendering | < 5ms | Template filling + variable injection |
| ModelGateway routing | < 10ms | Provider selection + budget check |
| LLM TTFT (Time to First Token) | < 2s | Provider SLA, uncontrollable |
| LLM complete generation | < 30s | Depends on output length, set max_tokens limit |
| Response parsing + verification | < 20ms | JSON parse + Zod verification |
| Total LLM calls | < 35s | timeout if exceeded |
**LLM latency is not included in the platform's own SLO**, but requires independent monitoring and alerting. The ModelGateway degradation policy is triggered when LLM P99 latency > 200% of baseline (see §15.4). 

---

# 28. Event / Projection / Incident / DLQ model 

## 28.1 Event namespace (25) 

workflow_run.* · loop_cycle.* · step_run.* · step_attempt.* · task.* · execution.* · execution_lease.* · worker.* · tool_call.* · side_effect.* · decision.* · artifact.* · memory.* · knowledge.* · rollout.* · incident.* · dlq.* · delegation.* · hibernation.* · prompt.* · eval.* · cost.* · approval_flow.* · agent_lifecycle.* · circuit_breaker.* 

## 28.2 Core events 

workflow_run.created · workflow_run.failed · step_run.awaiting_decision · execution.leased · execution.failed · execution_lease.expired · tool_call.succeeded · side_effect.proposed · side_effect.committed · decision.requested · decision.approved · rollout.paused · rollout.rolled_back · incident.created · dlq.recorded · circuit_breaker.state_changed · config.changed 

## 28.3 Projection (9 items) 

workflow_run_projection · workflow_timeline_projection · approval_queue_projection · tool_usage_projection · worker_status_projection · incident_projection · artifact_catalog_projection · risk_action_projection · governance_projection 

## 28.4 Projection constraints 

idempotent · replay-safe · event_id dedupe · rebuildable · does not reflect the truth 

## 28.5 Incident Constraints 

Incidents must be linked to: affected workflows / executions / workers / rollout / repair jobs / replay jobs / evidence bundles / resolution record 

## 28.6 DLQ Constraints 

DLQ must have: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status 

---

# 29. Knowledge / Memory / Artifact / Learning Boundary 

## 29.1 Knowledge 

Share facts, rules, processes, stable patterns. 

**Level**: Personal → Team → Company 

**Trust Level**: private_unverified → team_reviewed → official → authoritative 

**Promotion**: personal → team → company. Reserve lineage / reviewer decision / trust change / audit event. 

## 29.2 Memory 

Runtime short- and medium-term context. Will be attenuated · Will be compressed · Will be overwritten · Used for contextual assembly. 

**v2.0 Improvement**: Memory layering is clearly divided into 6 layers: working → session → episodic → semantic → procedural → meta. Each layer has independent TTL and elimination policies.

## 29.3 Artifact

Execution products and large objects, do not bear the responsibility of controlling truth. Associated with workflow_run/step through references (artifact_ref), not inlined into events.

## 29.4 Learning

Extract candidate patterns from feedback. Learn does not directly change online behavior. LearningObject must go through Improve → Validation → Approval → Rollout to take effect.

---

# 30. Business Access Constraints and Business Pack Model

> v2.2 improvement: Business Pack must now be associated with DomainDescriptor (§37), and Pack's risk control, knowledge retrieval, and evaluation strategy are driven by the domain descriptor.

## 30.1 Platform Capabilities That Business Packs Cannot Bypass

policy engine · approval engine · lease / fencing · artifact ref · audit · event log · projection contract · **domain descriptor(§37)**

## 30.2 Each Business Pack Must Declare

```typescript
interface BusinessPackManifest {
  pack_id: string;
  name: string;
  version: string;
  domain_id: string;                        // v2.2: associated DomainDescriptor (§37)
  risk_matrix: RiskMatrixEntry[];
  tool_bundles: string[];
  approval_points: ApprovalPointDef[];
  artifact_types: string[];
  knowledge_namespaces: string[];
  failure_strategy: ExecutionStrategy;
  rollback_capability: boolean;
  domain_metrics: MetricDef[];
}
```
> **v2.2 Constraint**: `domain_id` is a required field and must point to a registered DomainDescriptor with Active status. When a Pack is registered, the platform automatically verifies the validity of `domain_id` and applies the risk override of DomainRiskProfile to the Pack's risk_matrix. 

## 30.3 High-risk business default supervised 

operations · growth write actions · production release · finance-like actions → The first stage defaults to supervised, and full_auto is not allowed. 

## 30.4 Pack Life Cycle 

> New in v2.1. Define the complete process of Pack from development to discard.
| Stages | Description | Requirements | Outputs |
|------|------|------|------|
| Development | Local development using Pack SDK | Follow Manifest schema | Code + Manifest + eval dataset |
| Test | Local mock test + staging integration test | Coverage ≥ 80% + eval passed | TestReport |
| Certification | Security Review + Risk Assessment + Platform Compatibility Check | Pass Pack Checklist | CertificationRecord |
| Release | Register to Pack Registry + rollout | semver versioning | RolloutRecord |
| Operation | Execution subject to platform governance | Continuous quality monitoring | metrics + incidents |
| Deprecated | Mark deprecated + Migration Guidelines | Maintenance for at least 6 months | DeprecationNotice |
## 30.5 Pack API Compatibility Contract 

* Pack Manifest schema follows semver: minor version only adds new fields, major version allows destructive changes 
* Pack compatibility test suite must be run when upgrading the platform 
* Issue deprecation warning for breaking changes 2 minor versions in advance 
* Provide `agent-platform pack migrate` command to assist Pack upgrade 

## 30.6 Plugin Governance
| Governance Dimensions | Strategy |
|---------|------|
| Version Management | semver + Plugin Registry |
| Dependency management | Declarative dependency + conflict detection |
| Security certification | Automatic security scan + manual review (high authority plugin) |
| Deprecation policy | deprecated tag → 3 month migration period → archived |
| Compatibility | Each plugin declares min_platform_version |
---

# 31. Disaster recovery and high availability architecture 

> v1.2 does not involve disaster recovery. v2.0 defines high availability strategies from single node to multi-AZ. 

## 31.1 Single point of failure elimination
| Components | Single Points of Risk | Elimination Strategies |
|------|---------|---------|
| API Gateway | Process crash | Multiple instances + load balancing |
| Dispatcher | Scheduling interruption | Leader election (lease-based) |
| Worker | Execution interruption | Lease timeout → automatic reclaim |
| Event Poller | Event accumulation | Lease-based single instance + health check |
| Database | Data loss | WAL + scheduled backup / PG streaming replication |
## 31.2 High availability classification
| Level | Architecture | RTO | RPO |
|------|------|-----|-----|
| HA-1 Basics | Single node + scheduled backup | < 1h | < 15min |
| HA-2 Standard | Dual-node active-passive + WAL shipping | < 10min | < 1min |
| HA-3 Enterprise | Multiple AZ active-active + PG streaming | < 1min | 0 (synchronous replication) |

## 31.3 Backup and Recovery

* **Data backup**: SQLite stage uses `.backup()` API, PG stage uses pg_basebackup
* **Event replay**: Rebuild all projections and artifact catalog from event_log
* **Configuration backup**: config_version table has its own history, can rollback arbitrarily
* **Disaster recovery drill**: At least once per quarter, record actual RTO/RPO values

## 31.4 Data Integrity Protection

* All write operations are protected through CAS + Lease + Fencing
* Event log uses append-only mode, does not allow modifying historical events
* Checkpoint uses WAL protection, can be recovered after process crash
* Truth table and event log are updated in the same transaction

---

# 32. Deployment Architecture

> Adopts a **monolith-first, progressive decomposition** strategy.

## 32.1 Deployment Evolution

### Phase D1: Modular Monolith

```text
┌─────────────────────────────────────────┐
│          Agent Platform (single process)  │
│                                          │
│  P1 Interface  ──→  P2 Control           │
│       │               │                  │
│       ▼               ▼                  │
│  P3 Orchestration ──→ P4 Execution       │
│       │               │                  │
│       ▼               ▼                  │
│          P5 State & Evidence             │
│                                          │
│        X1 Fabric (middleware)            │
│                                          │
│  [SQLite]  [Redis (optional)]            │
└─────────────────────────────────────────┘
```

Suitable for: development, testing, small-scale production (≤10 concurrency).

### Phase D2: Worker Separation

```text
┌─────────────────────┐     ┌──────────────────┐
│   Main Process       │     │  Worker Process   │
│   P1 + P2 + P3 + P5 │────→│  P4 Execution     │
│   + X1               │     │  + tool executors  │
└─────────────────────┘     └──────────────────┘
        │
   [SQLite / PG]  [Redis]
```

Suitable for: medium-scale production (≤50 concurrency), workers can scale horizontally.

### Phase D3: Plane Separation

```text
┌──────────┐  ┌─────────────┐  ┌──────────────┐
│ API GW   │→│ Control +     │→│ Execution    │
│ (P1)     │  │ Orchestration │  │ Workers (P4) │
└──────────┘  │ (P2 + P3)    │  └──────────────┘
              └─────────────┘
                    │
              ┌─────────────┐
              │ State (P5)   │
              │ [PostgreSQL] │
              └─────────────┘
```

Suitable for: large-scale production (≤500 concurrency), each plane scales independently.

## 32.2 Environment Partitioning

| Environment | Purpose                | Deployment Form             | Data Isolation                        |
| ----------- | ---------------------- | --------------------------- | ------------------------------------- |
| dev         | Development & debug    | Local process / Docker      | No isolation, shared dev DB           |
| test        | Unit/integration test  | CI environment, single node | Test tenant data isolation            |
| staging     | Pre-release validation | K8s single cluster          | Partitioned by tenant                 |
| pre-prod    | Pre-release canary     | K8s multi-cluster           | Production-grade isolation            |
| prod        | Production             | Multi-Region K8s clusters   | Strong tenant isolation + cross-AZ DR |

**Environment Promotion Strategy**:

```
dev → test → staging → pre-prod → prod
```

- Code merged to main is auto-deployed to dev
- After PR approval, deployed to test
- Release tag triggers staging deployment
- After pre-release validation, manually promote to pre-prod, then confirm prod

## 32.3 Resource Pool Isolation

Worker Pools implement multi-level isolation to ensure that workloads of different risk levels and tenants do not affect each other:

| Pool Name                 | Purpose                                                     | Isolation Level | Resource Quota                    |
| ------------------------- | ----------------------------------------------------------- | --------------- | --------------------------------- |
| read-only worker pool     | Read-only tasks (data queries, report generation)           | Low risk        | Shared with rate limiting         |
| write-enabled worker pool | Write tasks (state changes, data modifications)             | Medium risk     | Dedicated resource pool           |
| high-risk isolated pool   | High-risk ops (deletion, bulk modification, external calls) | High risk       | Dedicated cluster + rate limiting |
| browser worker pool       | Browser automation tasks (web scraping, UI testing)         | Independent     | Dedicated worker process          |
| plugin isolated pool      | Third-party plugin execution                                | Strongest       | Dedicated Pod/Sandbox             |

**Isolation Principles**:

- Different pools are **network-isolated**; cross-pool communication requires going through the API Gateway
- High-risk tenants can request a **dedicated worker pool** with exclusive physical resources
- Inter-pool scheduling is managed via **priority queues** to prevent low-priority starvation
- All pools support **horizontal scaling**, auto-scaling based on queue depth

---
# Part II -- AI Operations Layer (S15-S23)

---

# 15. LLM Provider Abstraction and Failover Architecture

> Treat LLM as the platform's most critical external dependency. Define provider abstraction, routing strategies, and degradation modes when unavailable.

## 15.1 Design Principles

- The platform does not bind to any single LLM provider
- All LLM calls go through a unified ModelGateway; upper layers must not call provider SDKs directly
- ModelGateway is part of X1 Fabric, cross-cutting P3 Orchestration and P4 Execution
- LLM calls are treated as **high-risk external dependencies** and must have timeout, circuit breaker, fallback, and cost tracking

## 15.2 ModelGateway Interface

ModelGateway is the sole egress for all LLM calls; upper-layer services are prohibited from calling provider SDKs directly.

| Method       | Parameters                                           | Return Value                        | Description                        |
| ------------ | ---------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| `chat()`     | modelId, messages[], temperature, maxTokens, timeout | ModelResponse (choices + usage)     | Multi-turn conversation, most common entry |
| `complete()` | modelId, prompt, temperature, maxTokens, timeout     | ModelResponse (text + usage)        | Single completion, suited for generation |
| `embed()`    | modelId, input (string \| string[]), timeout         | EmbeddingResponse (vectors + usage) | Vectorization for retrieval/similarity |

ModelResponse uniformly contains: `requestId`, `model`, `choices`, `usage { promptTokens, completionTokens, totalTokens, estimatedCost }`, and `latencyMs`. All calls automatically attach traceId, tenantId, costTag and are included in §18 cost metering.

## 15.3 Provider Registration and Routing

**Routing strategies**:

| Strategy          | Applicable Scenario   | Description                                      |
| ----------------- | --------------------- | ------------------------------------------------ |
| priority          | Default               | Sort by priority, prefer highest priority        |
| cost_optimized    | Batch/low-priority tasks | Select lowest unit-cost available provider     |
| latency_optimized | Real-time interaction | Select provider with lowest P99 latency          |
| data_residency    | Compliance requirement | Select only providers meeting data residency    |
| capability_match  | Special capabilities  | Match required_capabilities                      |

## 15.4 Failover Chain

```text
Primary Provider
  │ timeout / error / circuit_open
  ▼
Secondary Provider (fallback)
  │ timeout / error / circuit_open
  ▼
Tertiary Provider (emergency)
  │ timeout / error / circuit_open
  ▼
Degradation Mode (see §15.5)
```

**Switching rules**:

- Single request timeout (default 30s) → auto switch to next provider and retry
- Consecutive failures > 5 (60s window) → trigger circuit breaker, provider marked unhealthy
- All providers unhealthy → enter LLM Degradation Mode
- Provider recovery through half-open probe, auto-promoted

## 15.5 LLM Unavailability Degradation Mode

When all LLM providers are unavailable, the platform must have explicit degradation strategies instead of simply returning errors:

| Degradation Level | Trigger Condition                         | Platform Behavior                                                         |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| D0 Normal         | At least one provider healthy             | Normal routing                                                            |
| D1 Restricted     | Primary down, secondary available         | Auto switch + alert + throttle new workflow launch rate                    |
| D2 Cached         | All providers unhealthy, cache available  | Return cached results for similar requests (read-only scenarios only)     |
| D3 Static         | Cache unavailable                         | Use pre-built static fallback plans (low-risk tasks only)                |
| D4 Suspended      | All degradation unavailable               | Suspend all new workflows, protect in-flight workflow checkpoints, hand off to human |

**Cache design**:

- Semantic cache based on prompt_ref + parameter hash
- TTL by data_classification: public=1h, internal=15min, confidential=no caching
- Cache hits must be marked `cached: true` and excluded from model quality evaluation

## 15.6 Streaming Response and Error Handling

Additional constraints for `ModelGateway.stream()`:

| Concern              | Handling Strategy                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stream interruption  | Buffer received tokens as partial response; if partial is usable (≥ 80% expected length) mark `partial: true` and use; otherwise switch provider and retry |
| Token limit pre-check | Estimate input token count from `ModelRequest.messages` before sending; if > provider's `context_window - max_tokens`, reject with `TOKEN_LIMIT_EXCEEDED` |
| Response format validation | After stream completes, run Zod schema validation on full output; on failure trigger one retry (with format reminder); second failure logged as `llm.response.validation_failed` |
| Timeout              | Streaming first-token timeout (TTFT > 10s) triggers provider switch; total duration timeout per `ModelConstraints.max_latency_ms`                      |
| Backpressure         | When consumer processing speed < producer speed, pause stream reading (backpressure), do not discard tokens                                            |

## 15.7 Observability

| Metric                   | Type      | Description                |
| ------------------------ | --------- | -------------------------- |
| `llm.request.total`      | counter   | By provider/model/tenant   |
| `llm.request.latency_ms` | histogram | By provider/model          |
| `llm.request.error_rate` | gauge     | By provider/error_type     |
| `llm.token.usage`        | counter   | By provider/model/tenant   |
| `llm.cost.total`         | counter   | By provider/tenant         |
| `llm.cache.hit_rate`     | gauge     | Cache hit rate             |
| `llm.fallback.triggered` | counter   | Fallback trigger count     |

---

# 16. Prompt Management and Versioning Architecture

> Prompts are the Agent's "source code" — treated as a first-class architectural concern. Define storage, versioning, canary release, and rollback mechanisms.

## 16.1 Design Principles

- Prompts are not inlined in code; they are independently managed as **versioned resources**
- Each Prompt has a full lifecycle: draft → review → staging → canary → stable → deprecated
- Prompt changes are equivalent to code changes and must pass quality gates (see §17)
- The combination of Prompt and model constitutes the core of Agent behavior; changes to both must be co-managed

## 16.2 Prompt Data Model

Each Prompt uses PromptTemplate as the storage unit, supporting multi-version management:

| Field       | Type                                                          | Description                               |
| ----------- | ------------------------------------------------------------- | ----------------------------------------- |
| `promptId`  | string (ULID)                                                 | Globally unique identifier                |
| `version`   | number                                                        | Incrementing version number, +1 per change |
| `role`      | enum: planner / generator / evaluator / system                | Identifies usage within Harness           |
| `content`   | string                                                        | Template body, using `{{variable}}` placeholders |
| `variables` | VariableDef[]                                                 | Variable name, type, required flag, default value |
| `metadata`  | object                                                        | Author, description, tags, expected token range |
| `domainId`  | string                                                        | Owning domain, controls visibility and permissions |
| `status`    | enum: draft / review / staging / canary / stable / deprecated | Lifecycle state                           |

A single `promptId` can have multiple versions, but only one version may be `stable` at any given time.

## 16.3 Release and Canary

**Release flow**:

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (quality not met)
                                               rolled_back
```

- staging must pass eval gate (see §17)
- canary runs in parallel with the stable version, traffic split by ratio
- Quality metrics of new vs old versions are continuously compared during canary
- Manual or automatic rollback to the previous stable version is possible at any time

## 16.4 Prompt Composition Management

A single OAPEFLIR cycle involves Prompts from multiple stages; they must be managed as an **atomic composition**:

**Constraint**: all stages within the same workflow run use the same PromptBundle version — no mid-run switching.

## 16.5 Prompt Security and Injection Defense

### 16.5.1 Prompt Injection Defense Architecture

```text
User Input / External Data
    │
    ▼
┌──────────────────┐
│ Input Sanitizer  │  Regex + blocklist + Unicode normalization
├──────────────────┤
│ Injection        │  Classifier-based injection pattern detection
│ Detector (ML)    │  (system/user boundary confusion, instruction override, role impersonation)
├──────────────────┤
│ Prompt Assembler │  Strict system/user/assistant segment separation
│                  │  User content injected only into user segment, never into system segment
├──────────────────┤
│ Output Validator │  Detect exfiltration attempts in LLM output
│                  │  (URL injection, Markdown link leakage, covert instruction relay)
└──────────────────┘
```

### 16.5.2 Defense Strategies

| Layer     | Strategy             | Description                                                                                |
| --------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Input     | Variable Escaping    | All user input variables are XML/Markdown escaped before injection, eliminating control chars |
| Input     | Boundary Markers     | system and user segments use LLM provider native role separation, not text markers          |
| Detection | Injection Classifier | Lightweight classifier scores each user input for injection probability; > 0.7 is rejected |
| Detection | Canary Token         | Embed canary token in system prompt; if LLM output contains it, injection is confirmed      |
| Output    | Output Sanitizer     | LLM output passes through URL/link filtering, PII detection, instruction pattern detection  |
| Audit     | Full Prompt Logging  | Full rendered prompt saved as artifact (optionally disabled for confidential level and above) |

### 16.5.3 Fundamental Principles

- Prompt content is not exposed to end users (prevent information leakage)
- Prompt variables must be sanitized before injection
- Variables containing secrets / PII are redacted in artifacts
- In multi-turn conversations, historical assistant messages must not be tampered by users
- External tool return values are treated as untrusted input and sanitized before injection

---

# 17. Model Evaluation and Quality Gate Architecture

> An Agent platform without evaluation capability is "going live naked". Define the quality gate framework for model/Prompt changes.

## 17.1 Evaluation Tiers

| Tier              | Trigger                        | Evaluation Content                    | Blocking Capability    |
| ----------------- | ------------------------------ | ------------------------------------- | ---------------------- |
| Offline evaluation | Prompt/Model change submission | Standard eval dataset regression test | Block release          |
| Canary evaluation  | During canary                  | Real-time quality comparison new vs old | Auto rollback        |
| Online monitoring  | Continuous                     | Quality metric drift detection        | Trigger alert/degrade  |

## 17.2 Eval Dataset Management

EvalDataset is the core input for quality gates (§17.3), maintained independently per domain:

| Field       | Type                         | Description                                          |
| ----------- | ---------------------------- | ---------------------------------------------------- |
| `datasetId` | string (ULID)                | Globally unique identifier                           |
| `taskType`  | string                       | Associated task type (e.g. summarization, routing)   |
| `samples`   | Sample[]                     | Each contains input, expectedOutput, evalCriteria    |
| `version`   | number                       | Dataset version, incremented on change               |
| `domainId`  | string                       | Owning domain                                        |
| `split`     | enum: train / eval / holdout | Dataset split; holdout used only for final release gate |

**Management requirements**: eval set must have ≥ 50 samples; holdout set is called only by quality gates automatically — prohibited during development/debugging; dataset changes require domain_owner approval.

## 17.3 Quality Gate Rules

**Built-in gate rules**:

| Rule                 | Condition           | Description                                    |
| -------------------- | ------------------- | ---------------------------------------------- |
| regression_pass_rate | >= 95%              | Eval dataset pass rate must not fall below baseline |
| critical_case_pass   | == 100%             | Cases marked critical must all pass            |
| latency_regression   | <= 120% of baseline | Latency must not exceed 120% of baseline       |
| cost_regression      | <= 150% of baseline | Cost must not exceed 150% of baseline          |
| quality_score_delta  | >= -0.05            | Quality score must not drop more than 5 percentage points below baseline |

## 17.4 Online Quality Monitoring

**Drift detection**:

- Sliding window (1h/24h) quality distribution statistics
- When 24h window quality mean drops > 10%, trigger SEV3 alert
- When 1h window quality mean drops > 20%, trigger auto degradation to supervised mode
- All quality signals written to P5 Evidence Plane, supporting pattern extraction in the Learn stage

## 17.5 LLM-as-Judge

For quality scenarios that cannot be judged by rules (e.g. "is the answer reasonable"), use LLM-as-Judge:

- Judge LLM and evaluated LLM must come from different providers (avoid bias)
- Judge results are cached (same input+output not re-evaluated)
- Judge calls themselves have cost budget limits (see §18)
- Judge evaluation results feed into quality gates, but weighted lower than deterministic rules

---

# 18. Cost Management and Token Metering Architecture

> LLM call costs dominate platform OPEX. Define per-tenant metering, budget enforcement, and chargeback mechanisms.

## 18.1 Metering Model

**Metering point**: ModelGateway synchronously writes a UsageRecord after every LLM call completes, serving as the sole billing data source.

## 18.2 Budget Hierarchy

| Level     | Budget Subject     | Control Granularity       | Over-Budget Behavior                          |
| --------- | ------------------ | ------------------------- | --------------------------------------------- |
| Platform  | Entire platform    | Monthly total             | SEV1 alert + new workflow suspension           |
| Tenant    | Single tenant      | Monthly quota             | Alert + throttle that tenant's workflow queue   |
| Pack      | Single Business Pack | Per-workflow upper limit | That workflow degrades to supervised            |
| Step      | Single step        | Per-step token/cost limit | Step aborted + replan                          |

## 18.3 Budget Enforcement

```text
ModelRequest
  → ModelGateway.budget_check
    → Query current-period usage
    → Estimate this call's cost (based on prompt_tokens + estimated completion)
    → If used + estimated > limit × warning_threshold → send alert
    → If used + estimated > limit → reject request / degradation strategy
  → Execute LLM call
  → Update usage
```

## 18.4 Chargeback Reports

- Aggregated by tenant / pack / model / provider dimensions
- Daily + monthly reports auto-generated
- Exportable as CSV / JSON
- Integrated with Admin API: `/api/v1/admin/cost-reports`

## 18.5 Cost Optimization Strategies

| Strategy            | Description                                          | Applicable Scenario       |
| ------------------- | ---------------------------------------------------- | ------------------------- |
| Prompt caching      | Reuse semantically similar requests (see §15.5)      | read-only / low-change scenarios |
| Token budget trimming | Auto-compress memory/knowledge input when context too long | Large context tasks  |
| Model downgrade     | Auto-select lower-cost model for low-risk tasks      | background queue          |
| Batch merge         | Merge multiple similar steps into one LLM call       | Batch analysis scenarios  |

---

# 19. Inter-Agent Delegation and Collaboration Architecture

> Complex enterprise tasks require multiple Agents to collaborate. Define inter-Agent delegation protocol, context passing, and authorization model.

## 19.1 Delegation Model

Agents delegate tasks via a standard delegation protocol, supporting three modes:

| Mode                | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| Synchronous delegation | Delegator blocks waiting for delegatee result; suited for short sub-tasks |
| Asynchronous delegation | Delegator submits and continues; obtains result via callback or polling |
| Broadcast delegation   | Delegator sends requests to multiple Agents simultaneously, aggregates best result |

DelegationRequest contains: delegator (delegator ID), delegate (delegatee ID), taskScope (task scope), constraints (constraint conditions), timeout (timeout limit). DelegationReceipt contains: result (execution result), telemetry (telemetry data), artifacts (output artifact list). All delegation chains must obey the topology constraints in §19.2.

## 19.2 Delegation Topology Constraints

- **Depth limit**: max delegation chain depth = 3 (prevent infinite recursion)
- **Interaction with goal decomposition**: the goal decomposition engine (§40) has a recursion depth limit of 5; each decomposition level may trigger delegation. Worst case total call depth = decomposition depth × delegation depth = 5 × 3 = 15 levels. To prevent cascading explosion, the platform enforces a **global call depth limit = 10** (`global_call_depth` field propagated with trace); exceeding the limit rejects new delegation and triggers escalation
- **Cycle detection**: the same pack_id must not appear twice in the same delegation chain
- **Isolation**: child workflow has independent lease, independent checkpoint — does not share state with parent workflow
- **Budget inheritance**: child workflow budget deducted from parent workflow remaining budget
- **Permission narrowing**: child workflow permissions ≤ parent workflow permissions (principle of least privilege)

## 19.3 Context Passing Security

- Parent → child: only pass references declared in DelegationContext, not raw data
- Child → parent: return only via DelegationResult, containing summary + artifact_refs
- Cross-tenant delegation: prohibited by default, requires explicit P2 authorization
- Data classification upward compatibility: child workflow output data classification ≥ input data classification

## 19.4 Collaboration Patterns

| Pattern             | Description                                     | Applicable Scenario   |
| ------------------- | ----------------------------------------------- | --------------------- |
| Sequential delegation | A delegates to B, waits for B to finish       | Simple sub-tasks      |
| Parallel fan-out      | A delegates to B1/B2/B3 simultaneously, aggregates results | Parallel analysis |
| Pipeline              | A → B → C, chained passing                    | Multi-stage processing |
| Negotiation           | A and B alternate execution, sharing context   | Code review + fix     |

## 19.5 Multi-Agent Collaboration Protocol (Agent Collaboration Protocol)

When the platform evolves from single-Agent Runtime to multi-Agent Runtime, a standardized collaboration protocol is required to prevent permission leakage, budget overrun, and audit chain breakage. This protocol defines message types, mandatory fields, and inviolable rules, enforced in coordination with §45 Harness Runtime and §19.2 delegation topology constraints.

### Message Types

| Message Type         | Direction      | Semantics           | Trigger Condition                                  |
| -------------------- | -------------- | ------------------- | -------------------------------------------------- |
| `task_request`       | parent → child | Initiate task delegation | Planner decomposes into sub-task                |
| `task_offer`         | child → parent | Declare availability | Child evaluates capability and responds            |
| `task_accept`        | parent → child | Confirm delegation  | Parent selects child                               |
| `task_reject`        | child → parent | Reject delegation   | Child lacks capability/budget/permission           |
| `partial_result`     | child → parent | Interim result report | Child completes interim output                   |
| `escalation_request` | child → parent | Request escalation  | Child encounters decision beyond autonomous authority |
| `completion_report`  | child → parent | Task completion report | Child completes all work                        |
| `takeover_notice`    | parent → child | Takeover notification | Parent takes over due to timeout/exception/human intervention |

### Mandatory Fields

Every collaboration message must carry the following fields; missing any field causes the message to be rejected:

| Field               | Type         | Source                               | Purpose                                       |
| ------------------- | ------------ | ------------------------------------ | --------------------------------------------- |
| `correlation_id`    | UUID         | Generated by first task_request      | Correlate all messages in the same collaboration session |
| `parent_run_id`     | HarnessRunId | §45.13 HarnessRun                    | Correlate parent execution context            |
| `depth`             | uint8        | Inherited from §19.2 global call depth | Prevent recursive explosion (≤ global_call_depth) |
| `sender_agent_id`   | AgentId      | Sender                               | Identity and audit                            |
| `receiver_agent_id` | AgentId      | Receiver                             | Routing and permission verification           |
| `domain_id`         | DomainId     | §37 DomainDescriptor                 | Domain-level policy matching                  |
| `risk_level`        | RiskScore    | Highest risk operation in payload    | Trigger approval/HITL                         |
| `budget_remaining`  | TokenBudget  | Inherited from parent budget         | Prevent child Agent overspend                 |
| `trace_id`          | TraceId      | §12 Distributed Tracing              | Full-chain observability                      |

### Collaboration Invariants

The following rules are enforced by Harness Runtime during message send/receive; violating any rule causes the message to be rejected and triggers an Incident:

| #   | Rule                                                                                  | Verification Timing      | Violation Consequence          |
| --- | ------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ |
| C1  | Child Agent must not expand permissions — child.permissions ⊆ parent.permissions      | At task_accept           | Reject delegation + alert      |
| C2  | Child Agent must not escalate risk mode — child.risk_mode ≤ parent.risk_mode          | At task_accept           | Reject delegation + alert      |
| C3  | Child Agent must not bypass parent ConstraintPack — child.constraints ⊇ parent.constraints | At task_request construction | Message rejected          |
| C4  | Child Agent output must be reviewable by parent Evaluator — completion_report must include evidence field | At completion_report | Result not accepted       |
| C5  | Any takeover must be audited — takeover_notice triggers tamper-proof audit record      | At takeover_notice       | Platform force-writes (unskippable) |
| C6  | budget_remaining must not exceed parent remaining budget                               | At task_request          | Message rejected               |
| C7  | depth must not exceed global_call_depth (defined in §19.2, default 10)                | At task_request          | Message rejected + escalation  |

### Relationship with Existing Architecture

- **§19.1-19.4**: This protocol upgrades the existing delegation model from "convention" to "enforced protocol"; all delegation messages must follow this section's format
- **§45 Harness Runtime**: HarnessLoopController automatically constructs task_request conforming to this protocol when initiating sub-tasks
- **§58.6 HarnessDecision**: Child Agent's Evaluator verdict is returned via completion_report; parent Evaluator may perform secondary adjudication
- **§12 Exception Event Handling**: Collaboration message timeout/rejection/violation all map to Incidents, routed via unified alert routing

---

# 20. Long-Running Task and Workflow Hibernation Architecture

> In enterprise scenarios, workflows may last hours or even days (waiting for approval, waiting for external system callback). Define hibernation/wake mechanisms.

## 20.1 Long-Running Task Classification

| Type              | Duration       | Reason                          | Example                    |
| ----------------- | -------------- | ------------------------------- | -------------------------- |
| Approval waiting  | Minutes → days | HumanWait executor blocking     | High-risk operation approval |
| External callback | Minutes → hours | Waiting for third-party system | CI/CD build completion callback |
| Scheduled         | Fixed time     | Waiting for specific time window | Off-hours execution       |
| Multi-stage       | Days → weeks   | Multi-stage business approval   | Release approval chain     |

## 20.2 Workflow Hibernation Mechanism

**Hibernation flow**:

1. Step enters wait state → create full checkpoint
2. Release worker lease (worker no longer occupied)
3. Create HibernationRecord, register wake_conditions
4. Set workflow_run status to `hibernated`
5. Persist all in-memory context to P5

**Wake flow**:

1. wake_condition satisfied → WakeEngine triggers
2. Restore workflow context from checkpoint
3. Re-acquire worker lease
4. Resume execution from the breakpoint

## 20.3 Persistent Timers

- Timers are persisted to database, not reliant on process memory
- TimerPoller (similar to outbox poller) periodically scans for expired timers
- Timers survive process restarts
- Timer precision: ± 30s (not a real-time system, millisecond precision not pursued)

## 20.4 TTL and Timeout Protection

- Every hibernation must have a TTL (default 7 days, max 30 days)
- TTL expiry triggers timeout_action
- Long-running workflows emit a `workflow.still_hibernated` health event every 24h
- Hibernations exceeding 50% of TTL trigger reminder notifications
- **Extended approval scenarios**: regulatory approval chains may take months; extended via `renewal` mechanism — 24h before TTL expiry, auto-request domain_owner confirmation for renewal (max 30 days per renewal); total renewal count capped by DomainGovernancePolicy(§37.9) `max_hibernation_renewals` (default 6, i.e. max ~210 days); exceeding the cap forces termination and notifies the initiator

## 20.5 Cross-Deployment Safety

- Checkpoint format is backward-compatible (versioned schema)
- Hibernated workflows are not affected by platform upgrade deployments
- If checkpoint schema is incompatible, workflow enters `recovery_needed` state, handled by Recovery Worker

---

# 21. Human-Agent Collaboration Mode Architecture

> Define the complete HITL mode catalog.

## 21.1 HITL Mode Catalog

| Mode                 | Description                                   | Trigger Condition               | Timeout Behavior              |
| -------------------- | --------------------------------------------- | ------------------------------- | ----------------------------- |
| Single approval      | One approver decides                          | risk_level ≥ high               | Timeout → escalate            |
| Multi-party approval | Multiple independent approvers, voting        | Critical operation / cross-domain impact | Timeout → auto reject  |
| Delegated approval   | Approver can delegate to another              | Original approver not online    | TTL resets after delegation   |
| Iterative feedback   | Human gives revision guidance, Agent re-does  | Unsatisfactory output           | Terminate after max iterations |
| Collaborative editing | Human and Agent alternate on same artifact   | Code/document collaboration     | No timeout, manual end        |
| Informed confirmation | Notification only, no approval needed        | Low-risk side effect            | Auto pass                     |
| Circuit-break manual | Transfer to human decision when LLM unavailable | D4 degradation mode (see §15.5) | Human timeout → abort       |

## 21.2 Approval Flow Engine

ApprovalFlow defines the complete execution structure for one approval:

| Field               | Type                                 | Description                                                      |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `flowId`            | string (ULID)                        | Approval flow unique identifier                                  |
| `steps`             | ApprovalStep[]                       | Ordered step list, supports sequential and parallel modes        |
| `approvers`         | Dynamically resolved                 | Computed in real-time by §47 approval routing engine based on org structure |
| `timeout_per_step`  | Duration                             | Per-step timeout (default 24h), timeout triggers escalation      |
| `escalation_policy` | enum: upgrade_sev / delegate / abort | Escalation strategy after timeout                                |
| `delegation_rules`  | DelegationRule[]                     | Delegation rules when unavailable (see §47.3)                    |

The approval flow engine supports inter-step conditional branching (e.g. risk amount determines whether to add executive approval), parallel co-sign (all must approve to proceed), and any-one-pass (one approval suffices) decision modes.

## 21.3 Iterative Feedback Loop

**Flow**: Agent produces output → human reviews → provides guidance → Agent replans + re-does → loop until approve or max_iterations reached.

## 21.4 Notification and Channels

| Channel                    | Purpose                  | Integration Method      |
| -------------------------- | ------------------------ | ----------------------- |
| Platform console           | Default approval UI      | Built-in                |
| Webhook                    | External system integration | Outbound HTTP        |
| Email                      | Async notification       | SMTP adapter            |
| IM (Slack/Lark/WeCom)     | Instant notification + quick approval | Webhook + callback API |

---

# 22. SDK and Developer Experience Architecture

> A platform without an SDK cannot be adopted by business teams. Define the Pack development toolchain and local development experience.

## 22.1 SDK Layers

| SDK Layer  | Target Role     | Functionality                                       |
| ---------- | --------------- | --------------------------------------------------- |
| Pack SDK   | Business developers | Create/test/publish Business Pack                |
| Plugin SDK | Plugin developers   | Develop tool / adapter / retriever / evaluator   |
| Client SDK | External integrators | Call platform Public API                        |
| Admin SDK  | Operations team     | Call Admin API, scripted operations              |

## 22.2 Pack SDK Core Capabilities

Pack SDK provides business developers with a complete toolchain from creation to publishing:

| Capability       | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| Scaffold CLI     | `pack create` generates standard directory structure, Manifest template, and sample code |
| Local Dev Server | Built-in lightweight runtime with hot reload, simulating P3/P4 execution flow |
| Type-safe API    | Provides type-safe definition interfaces for Tool, Prompt, Eval with compile-time contract validation |
| Test Harness     | Integrates MockModelGateway and MockToolExecutor, supports record/replay testing |
| Publish CLI      | `pack publish` one-click packaging, Manifest compliance validation, and push to target environment |
| Versioning       | Automatic version management based on semver, changelog enforced on publish |

## 22.3 Local Development Environment

- `agent-platform dev` — start local platform (SQLite + in-process workers)
- `agent-platform pack create` — create Pack scaffold
- `agent-platform pack test` — run Pack tests (mock LLM + mock tools)
- `agent-platform pack validate` — validate Manifest compliance
- `agent-platform pack publish --target staging` — publish to staging environment

**Local simulator**:

- Built-in MockModelGateway: returns preconfigured LLM responses for deterministic testing
- Built-in MockToolExecutor: simulates tool execution results
- Test record/replay: record real LLM calls as fixtures, replay in subsequent tests (no token consumption)

## 22.4 Plugin Lifecycle

| Phase         | Description                        | Requirements                    |
| ------------- | ---------------------------------- | ------------------------------- |
| Development   | Local development + Plugin SDK     | Must declare PluginManifest     |
| Testing       | Unit tests + sandbox integration tests | Coverage ≥ 80%             |
| Certification | Security scan + capability review  | Pass Plugin security checklist  |
| Publishing    | Register to Plugin Registry        | Semantic versioning (semver)    |
| Runtime       | Execute under sandbox constraints  | Resource limits + capability allowlist |
| Deprecation   | Mark deprecated + migration guide  | Maintain for at least 3 months  |

## 22.5 Documentation and Examples

- Every SDK must have API reference (auto-generated from TypeScript types)
- Provide 3 standard example Packs: simple-qa / coding-fix / operations-resolve
- Provide Playground environment: online Pack development trial (optional, Phase 4)

---

# 23. Compliance and Data Governance Structure 

> Enterprise-grade platforms must meet compliance requirements. v2.1 defines GDPR/SOC2 related data governance architecture. 

## 23.1 Data life cycle management
| Data type | Retention policy | Deletion method | Description |
|---------|---------|---------|------|
| Truth table | According to business needs | Logical deletion + regular physical cleanup | Control the truth |
| Event log | Default 365 days | Delete after archiving | append-only, archive to cold storage |
| Audit record | Default 3 years | Cannot be deleted (compliance requirements) | Legal retention period |
| Artifact | Default 90 days | Physical deletion | Large objects |
| Memory | Automatic cleaning according to TTL | Physical deletion | Running short-term data |
| Knowledge | Differentiation by trust level | Tombstone | Long-term sharing of data |
| LLM call record | Default 90 days | Physical deletion | Contains prompt/completion |
| Cost record | Default 3 years | Archive | Financial audit |

## 23.2 Right-to-Erasure（GDPR Art.17）

append-only event log has an architectural conflict with right-to-erasure. Solution:

**Crypto-shredding**:

1. Each tenant's PII data is stored encrypted with an independent Data Encryption Key (DEK)
2. DEK is managed by the key management service, associated with tenant_id
3. When a deletion request arrives, destroy the tenant's DEK
4. Encrypted data in the event log becomes indecipherable (logically equivalent to deletion)
5. Audit records retain the deletion operation itself

```typescript
interface ErasureRequest {
  request_id: string;
  tenant_id: string;
  subject_id: string;
  reason: "gdpr_request" | "account_deletion" | "legal_requirement";
  scope: "all_data" | "pii_only";
  requested_by: Principal;
  deadline: string;
}

interface ErasureReport {
  request_id: string;
  status: "completed" | "partial" | "failed";
  affected_records: number;
  dek_destroyed: boolean;
  retained_audit_records: number;
  completed_at: string;
}
```
## 23.3 Data residency 

* Each tenant can configure data_residency constraints (such as "CN" / "EU" / "US") 
* LLM calls must be routed to a provider that satisfies data residency (see §15.3 data_residency routing) 
* Storage engine is sharded by region (supported by Phase S3+) 
* Cross-region data transmission is prohibited by default and requires explicit authorization. 

## 23.4 SOC2 control mapping
| SOC2 control domain | Platform corresponding capabilities | Source of evidence |
|------------|-------------|---------|
| CC6.1 Logical Access | §11 Unified Identity and Authorization | PolicyOutcome + audit record |
| CC6.3 Encryption | §23.5 Encryption Architecture | key rotation log |
| CC7.2 Monitoring | §12 Abnormal event detection | incident + metrics |
| CC8.1 Change Management | §24 Configuration Governance + §16 Prompt Versioning | config_version + prompt_version |
| CC9.1 Risk Mitigation | §10 Risk Scoring Engine | RiskDecision + evidence bundle |
| A1.2 Disaster Tolerance | §31 Disaster Tolerance Architecture | DR Drill Report |
## 23.5 Encryption Architecture
| Level | Strategy | Implementation |
|------|------|------|
| Transport encryption | TLS 1.3 mandatory | All HTTP/gRPC/WebSocket connections |
| Storage encryption | AES-256 | Database-level TDE or application-level field encryption |
| PII field encryption | Per-tenant DEK | Support crypto-shredding |
| Secret storage | Vault integration | Reference access, TTL ≤ 300s |
| Key rotation | Automatic 90 days | DEK rotation does not affect historical data decryption (envelope encryption) |

## 23.6 Data Lineage

Every decision and output can be traced to its data source:

```text
Knowledge chunk → Observe (UnifiedObservation)
  → Assess (UnifiedAssessment) → Plan (ExecutionPlan)
    → Execute (ExecutionReceipt) → Side Effect
```
* Build a bloodline chain through trace_id + evidence_refs 
* Supports forward query (which decisions a certain knowledge affects) and reverse query (which inputs a certain side effect relies on) 
* Bloodline data is written into P5 Evidence Plane, no separate storage is created 

---


# Part III -- Business Domain Access Layer (S37-S38)

---

# 37. Business Domain Modeling and Access Architecture

> Solves the core question of "how to onboard diverse internal business lines after the platform is built."
> Related: §30 Business Pack Model · §22 SDK/DX · §10 Risk Control · §16 Prompt Management · §17 Model Evaluation · §29 Knowledge/Memory

## 37.1 Problem Statement

The 24 internal vertical business lines exhibit fundamental differences across the following dimensions:

| Dimension | Quant Trading | E-commerce | Advertising | Financial Services | Data Engineering | Coding |
| --- | --- | --- | --- | --- | --- | --- |
| Risk Level | Critical (capital) | High (oversell/pricing) | Medium (budget) | Critical (compliance) | Medium (data) | High (prod changes) |
| Time Sensitivity | Microsecond–millisecond | Second-level (search/risk) | Hour-level (bidding) | Second–day level | SLA-driven | Minute-level |
| Knowledge Freshness | Market tick real-time | Inventory/price minute-level | Ad data hour-level | Credit/regulation quarterly | Schema on-demand | Codebase real-time |
| Evaluation Dimensions | Sharpe/drawdown/slippage | GMV/conversion/CSAT | ROAS/CPA/CTR | Gini/KS/loss ratio | SLA achievement/quality | Compile+test+security |
| Approval Requirements | Strategy launch mandatory | Large price change approval | Launch+creative approval | Over-threshold loan/SAR mandatory | Schema migration approval | Code Review |
| Reversibility | Close position (costly) | Refund/compensation | Pause campaign | Reversal (limited) | Rollback to good data | Git revert |
| HITL Intensity | High | Medium | Medium | Very High | Medium | High |
| Latency Tier | Ultra-low (<10ms) | Real-time (<1s) | Near-real-time (<5min) | Real-time–batch | SLA-driven | Real-time (<1s) |

| Dimension | User Ops | Industry Research | Academic Research | Enterprise KB | Finance/Accounting | Legal |
| --- | --- | --- | --- | --- | --- | --- |
| Risk Level | Medium (privacy) | Low (info) | Low (academic reputation) | Medium (leakage) | Critical (capital) | Critical (legal) |
| Time Sensitivity | Minute-level (trigger) | Hour–day level | Day–week level | Second-level (search) | Day-level (month-end) | Hour–day level |
| Knowledge Freshness | User behavior real-time | Reports quarterly | Papers monthly | Documents weekly | Regulations quarterly | Regulations/cases monthly |
| Evaluation Dimensions | Retention/LTV/NPS | Fact accuracy/coverage | Citation accuracy/reproducibility | MRR/faithfulness/coverage | Accuracy/compliance/timeliness | Recall/accuracy/timeliness |
| Approval Requirements | Campaign content approval | Pre-publish human review | Full human review | Access control/correction | Four-eyes+segregation of duties | **Full attorney review** |
| Reversibility | Stop campaign | Correction statement | Erratum/retraction | Version rollback | Reversal/reconciliation | Irreversible (once effective) |
| HITL Intensity | Medium | High | High | Medium | Very High | **Highest** |
| Latency Tier | Near-real-time (<5min) | Batch | Batch | Real-time (<1s) | Batch | Batch |

| Dimension | Live Streaming | Creative Production | Game Dev | Game Publishing | Human Resources | Supply Chain & Logistics |
| --- | --- | --- | --- | --- | --- | --- |
| Risk Level | High (regulatory/PR) | Medium (brand/copyright) | Medium (quality) | High (compliance/rating) | High (privacy/discrimination) | High (capital/operations) |
| Time Sensitivity | Millisecond–second (live stream) | Hour–day level | Minute–hour level | Day-level (review cycle) | Day-level (hiring process) | Hour-level (dispatch) |
| Knowledge Freshness | Real-time (danmaku/video) | Asset library weekly | Codebase/engine real-time | Platform policy monthly | Regulations/policy quarterly | Inventory/logistics real-time |
| Evaluation Dimensions | Violation detection rate/latency | Creative quality/compliance rate | Compile/test/perf | First-pass rate/time-to-market | Hiring cycle/AIR | Forecast accuracy/cost |
| Approval Requirements | Violation disposition approval | Creative publish approval | Version release approval | Per-platform compliance approval | Hire/promotion approval | Large procurement approval |
| Reversibility | Stream cutoff (broadcast irreversible) | Version rollback | Git revert | Delist (time window) | Rescind offer (limited) | Return/transfer |
| HITL Intensity | High | Medium | Medium | High | High | Medium |
| Latency Tier | Real-time (<2s) | Batch | Real-time (<1s) | Batch | Batch | Near-real-time (<5min) |

| Dimension | Healthcare | Education & Training | Customer Service | Content Moderation | IT Ops SRE | Marketing |
| --- | --- | --- | --- | --- | --- | --- |
| Risk Level | **Critical (life)** | Medium (privacy/education) | Medium (reputation) | High (legal/safety) | High (availability) | Medium (brand/legal) |
| Time Sensitivity | Minute-level (ER)–day level | Day–week level (curriculum) | Second-level (conversation) | Millisecond–second (real-time review) | Second-level (alert response) | Hour-level (PR crisis) |
| Knowledge Freshness | Guidelines/drugs monthly | Textbooks semester-level | FAQ/KB weekly | Policy/regulations monthly | Config/topology real-time | Market data daily |
| Evaluation Dimensions | Diagnostic accuracy/safety | Learning outcomes/completion | CSAT/FCR/AHT | Recall/precision/latency | MTTR/MTTD/availability | ROAS/SOV/engagement |
| Approval Requirements | **Full physician review** | Course content review | Over-authority commitment approval | Disposition appeal approval | Change window approval | Brand content approval |
| Reversibility | Irreversible (executed orders) | Course adjustment | Compensation/refund | Unblock/restore | Rollback change | Retract/correct |
| HITL Intensity | **Highest** | Medium | Medium | High | High | Medium |
| Latency Tier | Real-time–batch | Batch | Real-time (<1s) | Real-time (<2s) | Real-time (<1s) | Near-real-time (<15min) |

**Currently §30 Business Pack compresses the above differences into a flat `BusinessPackManifest`**, unable to express domain semantics, drive differentiated risk control, or guide domain Prompt strategies. v3.0 deepened the original 12 vertical domains via §71-§82, and v3.1 extended to full 24-domain coverage via §83-§94.

## 37.2 DomainDescriptor — Domain Descriptor

Each business domain must provide a structured domain descriptor when onboarding, serving as the foundation for the platform to understand, constrain, and optimize Agent behavior in that domain:

**Design Decision**: DomainDescriptor does not replace BusinessPackManifest(§30), but serves as the **domain semantic layer** for Packs. One Pack associates with one DomainDescriptor; multiple Packs can share the same DomainDescriptor (e.g., "HR Onboarding Pack" and "HR Payroll Pack" share `domain_id: "hr"`).

## 37.3 DomainRiskProfile — Domain Risk Profile

The generic risk matrix(§10) provides platform-level defaults; DomainRiskProfile provides **domain-level overrides**, so the same action triggers different risk control strategies in different business domains:

**Domain Risk Profile Application Examples**:

| Scenario | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.http.post` | 60 | Finance → 90 | Mandatory four-eyes approval |
| `tool.http.post` | 60 | Customer Service → 40 | Auto-execute |
| `tool.file.write` | 50 | Coding → 70 (prod branch) | Code Review gate |
| `tool.file.write` | 50 | Creative Production → 30 | Auto-save draft |

## 37.4 DomainKnowledgeSchema — Domain Knowledge Schema

Defines each domain's knowledge retrieval strategy, freshness requirements, and conflict resolution rules, interfacing with §29 Knowledge/Memory layer:

**Domain Knowledge Difference Examples**:

| Domain | Retrieval Mode | Freshness Requirement | Conflict Strategy |
| --- | --- | --- | --- |
| Quant Trading | api_realtime (market tick) | Microsecond–millisecond | source_priority (exchange first) |
| E-commerce | api_realtime (inventory/price) | Minute-level | source_priority (inventory system first) |
| Financial Services | structured_query (credit API) | Day–quarterly | human_review |
| Coding | structured_query (AST/Git) | Real-time (HEAD commit) | timestamp_latest |
| Academic Research | semantic_search (paper DB) | Monthly | citation_count_priority |
| Enterprise KB | hybrid (semantic+keyword) | Weekly | domain_rule (highest version number first) |
| Finance/Accounting | structured_query (ERP API) | Day-level (T+1 reconciliation) | human_review |
| Legal | structured_query (legal DB) | Monthly | jurisdiction_priority |

## 37.5 DomainEvalFramework — Domain Evaluation Framework

The generic model evaluation(§17) provides platform-level quality gates; DomainEvalFramework defines **domain-specific quality axes and evaluation criteria**:

**Domain Evaluation Dimension Differences**:

| Domain | Core Quality Axes | Automated Checks | Regression Data Source |
| --- | --- | --- | --- |
| Quant Trading | Sharpe/drawdown/slippage, execution quality | Pre-trade sanity check + risk limit verification | Backtest performance baseline |
| E-commerce | GMV/conversion/CSAT, inventory accuracy | Price sanity + inventory sync verification | A/B test historical data |
| Advertising | ROAS/CPA/CTR, budget compliance, creative compliance | Budget cap check + ad regulation check | A/B test historical data |
| Financial Services | Gini/KS/loss ratio, AML detection rate | Fairness test + PSI monitoring | Expert annotation+regulatory feedback |
| Coding | Compile pass, test coverage, security scan | AST lint + unit test execution | PR review approved code |
| Academic Research | Citation accuracy, statistical correctness, reproducibility | DOI verification + plagiarism check | Published papers |
| Enterprise KB | MRR/faithfulness/coverage, access control compliance | Citation verification + permission check | Human-annotated QA pairs |
| Finance/Accounting | Numerical accuracy, compliance, audit traceability | Amount verification + regulatory rule engine | Expert audit samples |
| Legal | Risk clause recall, case law accuracy | Legal database cross-validation | Attorney review annotations |

## 37.6 DomainPromptLibrary — Domain Prompt Library

Interfaces with §16 Prompt management system, providing **domain-level Prompt assets** for each domain, avoiding scattered Prompt fragments:

**Relationship between Prompt Library and Prompt Management System(§16)**: DomainPromptLibrary contains domain-level Prompt assets registered in §16's PromptRegistry. Prompt versioning, canary release, and rollback capabilities are provided by §16; the domain Prompt library is only responsible for **content definition and domain adaptation**.

## 37.7 DomainRecipe — Domain Template and Archetype

Categorizes common business domains into twelve **archetype templates**; new domains select the closest archetype and rapidly generate a DomainDescriptor skeleton based on the template:

| Archetype | Core Pattern | Applicable Domains | Typical Workflow |
| --- | --- | --- | --- |
| **CRUD-heavy** | Read→Query→Modify→Confirm | Enterprise KB, User Ops, HR | Issue received→Query→Process→Feedback |
| **Analytics** | Collect→Analyze→Visualize→Decide | Industry Research, User Ops, Ad Reporting, Marketing | Data query→Analysis→Generate report→Recommend action |
| **Creative** | Generate→Review→Iterate→Publish | Advertising, E-commerce (product descriptions), Creative Production, Game Dev | Requirement understanding→Generate→Human review→Iterate→Publish |
| **Realtime** | Monitor→Detect→Respond→Record | Quant Trading, E-commerce (risk), Live Streaming | Event stream listen→Anomaly detect→Auto respond→Post-mortem |
| **Trading** | Signal→Risk→Execute→Settle | Quant Trading, Financial Services | Signal generation→Pre-trade risk→Order execution→Position settlement |
| **Compliance** | Monitor→Detect→Assess→Report | Financial Services, Finance/Accounting, Legal, Game Publishing | Rule monitoring→Anomaly detection→Compliance assessment→Regulatory report |
| **Research** | Collect→Analyze→Synthesize→Publish | Industry Research, Academic Research | Multi-source collection→Structured analysis→Synthesis→Review publish |
| **Adversarial** | Attack surface→Defend→Audit→Fix | Coding (security), Legal (litigation) | Threat/risk identification→Defense measures→Audit verification→Fix |
| **Moderation** (v3.1 new) | Ingest→Multimodal detect→Dispose→Appeal | Content Moderation, Live Streaming (review pipeline) | Content ingest→AI detection→Tiered disposition→Human appeal review |
| **Logistics** (v3.1 new) | Forecast→Optimize→Dispatch→Track→Exception | Supply Chain & Logistics, Game Publishing (distribution scheduling) | Demand forecast→Route optimization→Dispatch execution→Real-time tracking |
| **Conversational** (v3.1 new) | Intent→Knowledge retrieval→Answer→Feedback | Customer Service, Education (tutoring), Healthcare (triage) | User intent→KB retrieval→Generate answer→Satisfaction feedback |
| **IncidentOps** (v3.1 new) | Alert→Diagnose→Fix→Review→Prevent | IT Ops SRE/DevOps | Alert received→Root cause diagnosis→Auto fix→Post-mortem |

**Usage Flow**:

1. Business owner selects archetype via CLI (12 options): `agent-platform domain init --archetype=crud_heavy --name=hr`
2. System generates DomainDescriptor skeleton, marking all `customization_points`
3. Business owner fills required fields (entities, tool bindings, approval rules, etc.)
4. CLI runs `agent-platform domain validate` to verify completeness
5. After passing, enters §38 onboarding Runbook flow
## 37.8 DomainInteractionPolicy — Cross-Domain Interaction Policy

When Agents from multiple domains need to collaborate (e.g., an Advertising domain Agent calls a Data Analysis domain Agent to generate reports), explicit **boundary policies and compensation mechanisms** are required:

**Cross-Domain Interaction Matrix Example**:

| Source → Target Domain | Data Flow | Delegation | Failure Strategy |
| --- | --- | --- | --- |
| Advertising → Data Analysis | Aggregated data, PII prohibited | Allowed (depth=1) | retry(3) → human_review |
| HR → Finance | Payroll data, encrypted transmission | Allowed (depth=1, intersect) | rollback_source |
| Live Streaming → Inventory | Real-time inventory query | Prohibited (read-only API) | fallback cache |
| Coding → Security Ops | Code scan results | Allowed (depth=1) | log_and_continue |

## 37.9 DomainGovernancePolicy — Domain Governance Model

Each business domain must have explicit **governance ownership**, including ownership, SLO, budget, and change management:

**Governance Model to Platform Capability Mapping**:

| Governance Dimension | Platform Capability | Automation Level |
| --- | --- | --- |
| Ownership | §6 API permissions + §11 IAM | Fully automated (RBAC) |
| SLO | §27 SLO monitoring + Error Budget | Fully automated (alert+degrade) |
| Budget | §18 Token metering + budget enforcement | Fully automated (quota+circuit breaker) |
| Change Mgmt | §16 Prompt canary + §30 Pack release | Semi-automated (approval+canary) |

## 37.10 DomainDescriptor Registration and Lifecycle

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Draft      │────▶│  Validated   │────▶│  Registered  │────▶│   Active     │
│ (biz writes) │     │ (CLI verify) │     │ (platform reg)│     │ (production) │
└─────────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                     │
                         ┌──────────────┐     ┌──────────────┐      │
                         │  Deprecated   │◀────│  Updating    │◀─────┘
                         │ (deprecating)  │     │ (version up)  │
                         └──────┬───────┘     └──────────────┘
                                │
                         ┌──────▼───────┐
                         │   Archived   │
                         │ (read-only)   │
                         └──────────────┘
```

**State Transition Rules**:

| Current State | Can Transition To | Condition |
| --- | --- | --- |
| Draft | Validated | `agent-platform domain validate` all passed |
| Validated | Registered | Security review + platform compatibility check passed |
| Registered | Active | At least one associated Pack published successfully |
| Active | Updating | Business owner submits new version descriptor |
| Updating | Active | New version validation+registration passed |
| Active | Deprecated | domain_owner initiates deprecation, approval passed |
| Deprecated | Archived | All associated Packs migrated or decommissioned |

## 37.11 Canonical Domain Meta-Model

Each vertical business domain must use a unified meta-model to answer the following **12 standard questions** when onboarding. This meta-model is the foundation for the platform's "per-domain configuration-driven" approach, and serves as the data source for unified dashboard, approval, risk, and evaluation generation. When adding a 25th domain, simply filling in the same template completes the onboarding definition.

### Meta-Model 12 Questions

| # | Meta-Model Question | Corresponding Platform Concept | Filling Specification |
| --- | --- | --- | --- |
| Q1 | What are the domain's primary entities | DomainDescriptor.primary_entities | List 3-5 core business entities |
| Q2 | What are the high-risk actions | DomainRiskProfile (operations with risk ≥ 70) | Extract from DomainRiskProfile table |
| Q3 | What is the default autonomy level | DomainDescriptor.default_autonomy | L0-L4 (reference §42) |
| Q4 | What are the default HITL checkpoints | DomainInteractionPolicy.hitl_points | List mandatory human decision points |
| Q5 | What are the key external systems | DomainDescriptor.external_dependencies | List core upstream/downstream systems |
| Q6 | What are the key read-only tools | DomainRiskProfile (risk < 40 and no side effects) | Extract from DomainRiskProfile table |
| Q7 | What are the key write tools | DomainRiskProfile (risk ≥ 40 or has side effects) | Extract from DomainRiskProfile table |
| Q8 | What are the irreversible actions | DomainDescriptor.irreversible_actions | List all non-rollbackable operations |
| Q9 | What are the core quality metrics | DomainEvalFramework.primary_metrics | List 3-5 core KPIs |
| Q10 | What are the core compliance constraints | DomainGovernancePolicy.compliance_rules | List applicable regulations and mandatory rules |
| Q11 | What is the minimum go-live capability set | DomainDescriptor.mvp_capabilities | List minimum capabilities for canary launch |
| Q12 | What certifications must be completed before canary | §38 Gate3 SecurityCert + domain-specific checks | List required certifications/reviews |

### 24-Domain Meta-Model Matrix (Q1-Q6)

| Domain | Q1 Primary Entities | Q2 High-Risk Actions | Q3 Default Autonomy | Q4 Default HITL Checkpoints | Q5 Key External Systems | Q6 Read-Only Tools |
| --- | --- | --- | --- | --- | --- | --- |
| Quant Trading | Strategy·Order·Position·Market data·Risk limits | order.submit · strategy.deploy · risk_limit.modify | L1 | Strategy launch·Risk limit change·Capital allocation | Exchange·Market feed·Risk system | market_data.read |
| E-commerce | Product·Order·Inventory·Price·Refund | price.update · refund.issue · listing.publish | L2 | Over-threshold price change·Excess refund·Restricted category listing | ERP·WMS·Payment gateway·Search engine | inventory.sync |
| Advertising | Campaign·Creative·Audience·Bid·Budget | campaign.launch · creative.publish · audience.create | L2 | Campaign launch·Creative go-live·Sensitive category audience targeting | Ad platform API·DMP·Creative tools | — |
| Financial Services | Credit application·KYC record·Insurance policy·Claim·SAR | credit.approve · sar.submit · claim.adjudicate · model.deploy | L0 | Over-threshold loan·SAR report·Model deployment·Adverse credit decision | Credit bureau·Core banking·Regulatory reporting | — |
| Data Engineering | Pipeline·Schema·Dataset·Lineage·Quality rules | schema.migrate · pipeline.deploy_prod · data.delete | L2 | Schema migration·Prod deployment·Data deletion·Sensitive data access | Data warehouse·Compute engine·Scheduler | pipeline.retry |
| Coding | Codebase·PR·CI pipeline·Vulnerability·Dependency | code.merge · deploy.production · security.fix | L1 | Code merge·Prod deployment·Security vulnerability fix·Architecture decisions | Git·CI/CD·SAST/DAST·Artifact registry | — |
| User Ops | User segment·Campaign·Notification·A/B test·LTV | campaign.send · segment.create | L2 | Campaign content·Sensitive attribute segments·Notification frequency·Incentive budget | CDP·Push platform·Analytics system | — |
| Industry Research | Report·Data source·Trend·Competitor·Regulatory policy | report.publish · data.scrape | L1 | Research publication·Forward-looking statements·Copyright compliance | Industry DB·News API·Regulatory websites | alert.send |
| Academic Research | Literature·Hypothesis·Experiment·Manuscript·Citation | manuscript.submit · citation.insert · analysis.run | L1 | Publication review·Hypothesis selection·Experiment design·Statistical methods | Academic DB·DOI registry·Plagiarism checker | literature.search |
| Enterprise KB | Document·Knowledge graph·FAQ·Permission·Search index | document.ingest · answer.synthesize · content.retire | L2 | New document source onboarding·Low-confidence answers·Content retirement | Document system·SSO·Search engine | search.query |
| Finance/Accounting | Invoice·Voucher·GL·Tax·Budget | journal.post · financial.signoff · tax.file | L0 | Over-threshold voucher·Financial signoff·Tax filing·Bad debt write-off | ERP·Tax system·Bank interface·Audit system | — |
| Legal | Contract·Case law·Litigation·IP·Compliance record | legal_opinion.draft · contract.review · ediscovery.classify | L0 | **All outputs** (attorney review) | Legal DB·eDiscovery·Contract management | ip.search |
| Live Streaming | Live stream·Danmaku·Product·Host·Moderation record | moderation.realtime · commerce.shelf · stream.publish | L1 | Political/terrorism stream cutoff·Commerce violation disposition·Major event launch | Streaming CDN·E-commerce system·Moderation platform | danmaku.filter |
| Creative Production | Creative·Brand asset·Template·Performance data | brand.compliance · creative.generate | L2 | Brand-class creative·Heavily regulated industry creative·Celebrity likeness | DAM·Ad platform·Brand management | asset.adapt |
| Game Dev | Design doc·Art asset·Code·Numeric config·Bug | game.asset_generate · game.balance_sim | L2 | Core gameplay·Art style·Version release·P0/P1 Bug fix | Game engine·Art tools·CI/CD | game.qa_run |
| Game Publishing | Build package·Submission materials·Localization·Event config | store.submit · compliance.check · liveops.config | L1 | License submission·Major version·Large event·Sensitive localization | Store API·Payment channel·Rating agency | localization.translate |
| Human Resources | Resume·Offer·Compensation·Performance·Contract | offer_generate · payroll_calc · resume_screen | L0 | Offer issuance·Termination·Performance rating·Compensation adjustment·Org change | HCM·Recruiting platform·Payroll system·Background check | — |
| Supply Chain | Purchase order·Inventory·Transport route·Customs·Supplier | customs_declare · route_plan · inventory_optimize | L1 | Large procurement·New supplier qualification·Customs exception·Hazmat transport | ERP·WMS·TMS·Customs system | scm.forecast |
| Healthcare | Medical record·Prescription·Imaging·Triage·Drug interaction | clinical.diagnose · drug.interaction_check · imaging.analyze | L0 | **All clinical decisions** (physician confirmation) | HIS·PACS·Drug DB·Insurance system | — |
| Education | Course·Question bank·Learning path·Learning analytics·Assessment | content_generate · assess · tutor | L2 | Content go-live·Subjective grading·Sensitive topics·Minor data | LMS·Question bank·Learning analytics·Parent platform | learning_path |
| Customer Service | Ticket·Conversation·KB·Routing·QA record | cs.respond · cs.quality_score | L2 | Over-authority refund·Complaint escalation·Legal questions·VIP exceptions | CRM·KB·Ticket system·CTI | cs.route · cs.knowledge_search |
| Content Moderation | Content item·Moderation record·Policy rule·Appeal·Report | moderation.classify · moderation.appeal · compliance.report | L1 | CSAM immediate disposition·Appeal adjudication·Policy change·Edge cases | Moderation platform·Legal compliance·Reporting system | — |
| IT Ops | Alert·Incident·Deployment·Change·Vulnerability | ops.deploy · ops.incident_respond · security_scan | L1 | High-risk change CAB·Security incident·New fix strategy·Budget procurement | Monitoring·CMDB·CI/CD·SIEM | ops.capacity_plan |
| Marketing | Campaign·Brand asset·SEO·Social content·PR crisis | social.publish · marketing.campaign | L2 | External content review·Brand crisis takeover·Marketing budget·Brand partnership | Ad platform·Social API·PR monitoring system | brand.monitor · seo.optimize |
### 24-Domain Meta-Model Matrix (Q7-Q12)

| Domain | Q7 Write Tools | Q8 Irreversible Actions | Q9 Core Quality Metrics | Q10 Core Compliance Constraints | Q11 Minimum Go-Live Capabilities | Q12 Pre-Canary Certification |
| --- | --- | --- | --- | --- | --- | --- |
| Quant Trading | order.submit · strategy.deploy · risk_limit.modify | Order submission (costly to close) · Strategy deployment | Sharpe · Max drawdown · Risk compliance rate | SEC/CSRC/MiFID II | Signal generation+Risk control+Execution pipeline | Risk system integration · Exchange sandbox verification |
| E-commerce | price.update · refund.issue · listing.publish | Price publication (floor price constraint) · Refund payment | GMV · Conversion rate · CSAT | E-commerce law/Consumer protection/PCI-DSS | Product listing+Pricing+Basic customer service | Payment security scan · Load test |
| Advertising | campaign.launch · bid.adjust · creative.publish · audience.create | Campaign budget spend (spent is unrecoverable) | ROAS · CPA · CTR | Ad law/Platform policy/GDPR | Campaign creation+Bidding+Basic reporting | Ad law compliance check · Budget control verification |
| Financial Services | credit.approve · sar.submit · claim.adjudicate · model.deploy | Loan disbursement · SAR submission · Claim payment | Gini/KS · Loss ratio · PSI | Basel III/AML law/EU AI Act | Credit assessment+KYC+Risk control | Fairness test · Regulatory report integration |
| Data Engineering | schema.migrate · pipeline.deploy_prod · data.delete | Data deletion (unrecoverable) · Destructive schema change | SLA achievement rate · Data quality pass rate | GDPR right to deletion/Data residency | Pipeline orchestration+Quality check+Lineage | Data security classification · Access control verification |
| Coding | code.merge · deploy.production · code.generate · security.fix | Prod deployment (needs rollback) · Dependency version lock | Test pass rate · Bug detection rate · Adoption rate | License/SOC2 | Code generation+Review+CI integration | Security scan · License compliance |
| User Ops | campaign.send · segment.create · notification.push · ab_test.launch | Batch notification push (sent is irrecoverable) | Retention · LTV/CAC · NPS | PIPL/GDPR/CAN-SPAM | Segmentation+Campaign push+Basic analytics | Privacy compliance · Opt-out mechanism verification |
| Industry Research | report.publish · data.scrape · forecast.generate | Report publication (influences decisions) | Fact accuracy rate · Source citation rate | Securities law/Data licensing/Copyright | Data collection+Report generation+Review flow | Data source licensing · Copyright compliance |
| Academic Research | manuscript.submit · citation.insert · analysis.run | Paper submission (reputation impact) | Citation accuracy 100% · Reproducibility | Research ethics/Publication ethics | Literature review+Writing assistance+Citation verification | DOI verification · Plagiarism system integration |
| Enterprise KB | document.ingest · answer.synthesize · content.retire | Content retirement (knowledge loss risk) | MRR/NDCG · Answer faithfulness | Data retention/Access control | Document processing+Semantic search+Permissions | Access control verification · Search quality baseline |
| Finance/Accounting | journal.post · financial.signoff · tax.file | Tax filing submission · GL posting (needs reversal) | Straight-through processing rate · GL accuracy · Audit finding count | CAS/SOX/Golden Tax Phase IV | Invoice processing+Voucher+Reconciliation | Audit compliance · Segregation of duties verification |
| Legal | legal_opinion.draft · contract.review · ediscovery.classify | Legal opinion issuance (legal consequences) | Risk clause recall · Case law accuracy | Civil code/Professional ethics/GDPR | Contract review+Case law search+Compliance | Legal DB integration · Privilege detection verification |
| Live Streaming | moderation.realtime · commerce.shelf · stream.publish | Stream cutoff (affects user experience) · Violation disposition | Violation detection rate · Disposition latency <3s · GPM | Live streaming regulations/Minor protection law | Streaming+Real-time moderation+Danmaku filtering | Multimodal moderation model · Stream cutoff recovery drill |
| Creative Production | creative.generate · brand.compliance | Creative publication (brand impact) | Brand compliance pass rate · Platform review first-pass rate | Ad law/Copyright law/Likeness rights | Copywriting+Image generation+Compliance check | Ad law lexicon · Brand asset library integration |
| Game Dev | game.asset_generate · game.balance_sim · game.design_assist | Version release (player experience impact) | Style consistency (FID) · Bug discovery rate | License/Anti-addiction/Content review | QA automation+Art generation+Numeric simulation | Content review pre-screening · Anti-addiction verification |
| Game Publishing | store.submit · compliance.check · liveops.config | License submission (zero tolerance) · Version launch | Submission first-pass rate >90% · DAU/Retention | License/Rating/Anti-addiction/PIPL | Submission automation+Compliance check+Canary | Rating compliance matrix · Anti-addiction pipeline |
| Human Resources | resume_screen · offer_generate · payroll_calc · compliance_check | Offer issuance · Termination execution · Payroll disbursement | Hiring cycle · Pay equity · Bias audit | Labor law/PIPL/EU AI Act | Resume screening+Offer generation+Compliance check | Bias detection · Fairness test · Explainability |
| Supply Chain | inventory_optimize · route_plan · customs_declare | Purchase order submission · Customs declaration · Hazmat transport | MAPE · OTIF · HS classification accuracy | Customs law/Export control/Hazmat/ESG | Demand forecast+Inventory optimization+Route planning | Export control list integration · Hazmat compliance |
| Healthcare | clinical.diagnose · drug.interaction_check · imaging.analyze · triage.assess | Diagnosis recommendation issuance (patient safety) · Prescription | Diagnostic sensitivity · Lesion recall · Drug interaction recall | Medical device regulations/HIPAA/FDA SaMD | Triage+Drug interaction check+Assisted diagnosis | SaMD certification · Clinical validation · Data encryption |
| Education | content_generate · assess · tutor | Grade publication (affects academics) · Inappropriate content exposure | Knowledge mastery rate · Grading consistency (κ≥0.8) | Minor protection law/FERPA/COPPA | Content generation+Intelligent assessment+Tutoring | Content safety filtering · Minor protection verification |
| Customer Service | cs.respond · cs.quality_score | Refund payment · False commitment (hallucination) | CSAT · FCR · AI independent resolution rate · Hallucination rate | Consumer protection/TCPA/GDPR | Multi-channel conversation+Routing+KB retrieval | Hallucination rate baseline · Emotion detection verification |
| Content Moderation | moderation.classify · moderation.appeal · adversarial.detect · compliance.report | CSAM report submission · Content deletion | Precision/Recall · Violation online duration | Cybersecurity law/DSA/CSAM mandatory reporting | Text moderation+Image moderation+Policy engine | Multi-model cross-validation · Red team testing |
| IT Ops | ops.incident_respond · ops.deploy · security_scan | Prod change (needs rollback) · Security fix | MTTR · MTTD · SLO achievement rate | MLPS 2.0/ISO 27001/SOC 2 | Incident response+Deployment automation+Monitoring | Change management process · Blast radius verification |
| Marketing | social.publish · marketing.campaign | External content publication (brand impact) · Budget spend | ROAS · SOV · Engagement rate · Crisis alert accuracy | Ad law/FTC/GDPR/CAN-SPAM | Campaign orchestration+Brand monitoring+SEO | Ad law compliance · Brand tone baseline |

### Platform Value of the Meta-Model

- **Templatized domain onboarding**: When adding a 25th domain, filling the 12-question meta-model completes 80% of the onboarding definition
- **Configuration-driven core**: The platform core reads meta-model fields to auto-configure ConstraintPack · Toolbelt · EvalFramework · ApprovalRoute
- **Unified dashboard generation**: §43 operations dashboard auto-aggregates domain-level views based on meta-model fields (risk heatmap, quality trends, compliance status)
- **Approval routing automation**: §47 approval routing auto-generates domain-level approval chains based on Q2/Q4
- **Evaluation automation**: §17 model evaluation auto-generates domain-level evaluation suites based on Q9
- **Documentation consistency**: All 24 domains have unified description structure, preventing divergence as domain count grows

---

# 38. Business Domain Access Runbook

> New in v2.2. Define the standardized access process for new business domains from scratch to production.
> Related: §37 Business domain modeling · §30 Business Pack · §22 SDK/DX · §34 ADR

## 38.1 Four-Phase Access Overview

```text
Phase 1              Phase 2              Phase 3              Phase 4
Domain Modeling       Development          Security             Grayscale
                      Verification         Certification        Launch
(1-2 weeks)           (2-4 weeks)          (1 week)             (1-2 weeks)
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ Domain    │───────▶│ Pack     │───────▶│ Security │───────▶│ Rollout  │
│ Modeling  │  Gate1 │ Dev+Test │  Gate2 │ Cert     │  Gate3 │ Canary   │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Stage | Responsible Party | Output | Access Conditions |
|------|--------|-------|---------|
| Phase 1 | Business side + Platform Liaison | DomainDescriptor + RiskProfile + GovernancePolicy | Platform architecture review passed |
| Phase 2 | Business side | Pack code + unit test + integration test + eval dataset | Test coverage ≥ 80% + eval passed |
| Phase 3 | Security Team + Platform Team | CertificationRecord + Risk Review Record | Security Scan None Critical/High + Risk Review Passed |
| Phase 4 | Platform SRE + business side | RolloutRecord + monitoring Dashboard | canary 7 days without P0/P1 + eval quality will not degrade |
## 38.2 Phase 1: Domain Modeling 

**Goal**: The business side collaborates with the platform team to produce a structured DomainDescriptor. 

**step**:
| # | Activities | Performers | Outputs | Tools |
|---|------|-------|------|------|
| 1 | Select domain prototype (§37.7) | Business side | Recipe selection | `agent-platform domain init` |
| 2 | Populating Domain Entities and Capabilities | Business Side | entities + capabilities | YAML/JSON Edit |
| 3 | Define Domain Risk Profile | Business + Security | DomainRiskProfile | Risk Assessment Template |
| 4 | Define knowledge sources and retrieval strategies | Business side + data | DomainKnowledgeSchema | Knowledge source inventory template |
| 5 | Define evaluation dimensions and criteria | Business side + AI | DomainEvalFramework | eval template |
| 6 | Build domain Prompt library | Business side + AI | DomainPromptLibrary | Prompt project template |
| 7 | Determine governance ownership | Business leader | DomainGovernancePolicy | Governance contract template |
| 8 | Verification integrity | Business side | Verification report | `agent-platform domain validate` |
**Gate 1 Checklist**: 

- [ ] DomainDescriptor All required fields populated 
- [ ] At least 5 few-shot examples are annotated 
- [ ] The risk profile has been initially reviewed by the security team 
- [ ] The knowledge source has been confirmed to be reachable and authorized 
- [ ] eval dataset ≥ 20 items (including golden answer) 
- [ ] Governance contract signed by domain_owner 
- [ ] The cross-domain interaction policy has been confirmed with the relevant domain (if any) 
- [ ] Platform architecture review meeting passed 

## 38.3 Phase 2: Development Verification 

**Goal**: Develop Business Pack based on DomainDescriptor and verify it through local and staging environments. 

**step**:
| # | Activities | Performers | Outputs | Tools |
|---|------|-------|------|------|
| 1 | Initialize Pack project | Business side | Pack code skeleton | `agent-platform pack create --domain=<id>` |
| 2 | Implement Tool adapter | Business side | Tool bundle code | Pack SDK(§22) |
| 3 | Writing unit tests | Business side | Test cases | Standard testing framework |
| 4 | Local Mock test | Business side | Local test report | `agent-platform pack test --local` |
| 5 | Build eval dataset | Business side + AI | Evaluate dataset | eval tool chain |
| 6 | Staging integration testing | Business + SRE | Integration testing report | staging environment |
| 7 | Run domain assessment | Business side | eval quality report | `agent-platform eval run --domain=<id>` |
**Gate 2 Checklist**: 

- [ ] Unit test coverage ≥ 80% 
- [ ] All integration tests passed 
- [ ] field eval for all quality axes up to acceptance_threshold 
- [ ] No known P0/P1 bugs 
- [ ] Pack Manifest and DomainDescriptor consistency check passed 
- [ ] Tool permission statement matches risk profile 

## 38.4 Phase 3: Security Certification 

**Goal**: The security team and platform team conduct a security review and risk assessment of Pack.
| # | Check Item | Performer | Standard |
|---|--------|-------|------|
| 1 | Static code scanning | Automated | No Critical/High vulnerabilities |
| 2 | Dependency vulnerability scanning | Automated | No known CVEs (Critical) |
| 3 | Sandbox Escape Testing | Security Team | No Escape Path |
| 4 | Prompt Injection Test | Security Team | Injection Protection Effective |
| 5 | Data Breach Testing | Security Team | No PII/Credentials Exposed |
| 6 | Risk profile consistency | Platform team | RiskProfile matches actual behavior |
| 7 | Cross-Domain Policy Compliance | Security Team | DataFlowRule Execution Correct |
| 8 | Compliance Review (§23) | Compliance Team | Meeting Industry Regulatory Requirements |

**Gate 3 Checklist**:

- [ ] All security scans passed
- [ ] Prompt Injection protection coverage 100%
- [ ] Risk profile review records archived
- [ ] CertificationRecord issued
- [ ] Compliance team has no blocking comments

## 38.5 Phase 4: Grayscale Launch

**Goal**: Ensure production environment stability through progressive grayscale release.

**Grayscale Strategy**:

```text
Day 1-2     Day 3-5     Day 6-7     Day 8+
Canary 1%   Canary 10%  Canary 50%  GA 100%
┌─────┐    ┌──────┐    ┌──────┐    ┌──────┐
│Internal│───▶│Small  │───▶│Half  │───▶│Full  │
│Test    │    │Scale  │    │Scale │    │Release│
└─────┘    └──────┘    └──────┘    └──────┘
   ▲           ▲           ▲           ▲
   │           │           │           │
  Manual      Auto        Auto        SLO
  validation  metrics     metrics     confirmed
  + eval      + eval      + eval
```
**Automatic check at each stage**:
| Indicators | Thresholds | Non-compliance actions |
|------|------|----------|
| Error rate | < 1% | Automatic rollback |
| P95 latency | < domain SLO | Alarm + human decision-making |
| Eval quality | ≥ acceptance_threshold | Automatic rollback |
| Token cost | < budget × (canary%) | Alarm + human decision |
| User feedback negative | < 5% | Pause grayscale + manual review |
**Gate 4 (GA Admission) Checklist**: 

- [ ] Canary 7 days without P0/P1 Incident 
- [ ] All SLO indicators are up to standard 
- [ ] Eval quality is not lower than Gate 2 baseline 
- [ ] Token cost is within budget 
- [ ] Monitoring Dashboard configured and alarms routed 
- [ ] Runbook (troubleshooting manual) written and delivered to SRE 
- [ ] Domain Owner signs GA confirmation 

## 38.6 Continuous operation after access 

After the business domain goes online, it enters **continuous operation mode** and the platform automatically performs the following periodic activities:
| Activity | Frequency | Responsible Party | Trigger Conditions |
|------|------|--------|---------|
| Eval regression testing | Daily | Automatic | Scheduled + Prompt after change |
| Cost report | Weekly | Automatic → domain_owner | Scheduled |
| SLO Report | Monthly | Automatic → domain_owner + SRE | Scheduled |
| Security scan | Monthly | Automatic | Scheduled + when dependencies are updated |
| DomainDescriptor Review | Quarterly | Business Side + Platform | Scheduled |
| Knowledge source freshness check | By freshness_policy | Automatic | Continuous |
| Cross-domain policy review | Quarterly | Security team | Scheduled + when new domains are connected |

---


# Part IV -- Vertical Business Domain Deepening Layer (S71-S94)

---

# 71. Quantitative Trading Domain Architecture

> Related: §37 Business Domain Modeling · §30 Business Pack · §10 Risk Control · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §1

**DomainDescriptor Mapping**:

- `domain_id`: `quant-trading` · `recipe_archetype`: Trading + Realtime
- `risk_level`: Critical · `latency_tier`: ultra_low (execution path <10ms)
- `hitl_intensity`: High · `regulatory_density`: Critical (CSRC/SEC/MiFID II)

**Core Agent Roles**: Signal Generation · Backtesting · Execution · Risk Management · Portfolio Optimization

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | ------------- | ----------- | ------------------------ |
| `tool.order.submit` | 60 | 95 | Mandatory pre-market risk control + position limit check |
| `tool.strategy.deploy` | 50 | 90 | Manual approval + backtest verification |
| `tool.risk_limit.modify` | 50 | 95 | domain_owner + risk manager dual approval |
| `tool.market_data.read` | 20 | 20 | Auto-execute |

**DomainEvalFramework**: Sharpe Ratio ≥ threshold · Max Drawdown ≤ limit · Implementation Shortfall · Risk limit compliance rate · System availability 99.99%

**DomainKnowledgeSchema**: Market data real-time API · Risk parameter structured query · Strategy configuration versioned · Conflict strategy source_priority (exchange > fallback source)

**HITL Strategy**: Strategy deployment / risk limit changes / capital allocation changes require mandatory manual approval; real-time P&L dashboard + one-click kill-switch; post-market compliance review with daily sign-off

**Key Guardrails**: Pre-market sanity checks (max order size / max notional / rate limits) · Hard position limits cannot be overridden by Agent · Data source stale >N seconds triggers automatic liquidation · Circuit breaker

**Agent Workflows (Detailed)**:

- Signal Generation Agent: Data ingestion → Feature engineering → Model inference → Signal ranking → Risk filtering → Order generation
- Backtesting Agent: Strategy definition → Historical replay → Simulated fills (including slippage/commissions) → Performance report
- Execution Agent: Target portfolio → Execution plan (TWAP/VWAP/IS) → Cross-exchange routing → Fill monitoring → Real-time algorithm parameter adjustment
- Risk Management Agent: Continuous exposure monitoring (sector/factor/Greeks) → Position limits → Circuit breaker → VaR/CVaR → Margin call notification
- Portfolio Optimization Agent: Mean-variance / Black-Litterman / Risk Parity → Constraints (turnover / sector caps / ESG)

**Key Tools/Integrations**:
| Category | Specific Tools |
| -------- | ---- |
| Market Data | Bloomberg B-PIPE, Refinitiv Elektron, Wind, CTP/FEMAS, IEX Cloud, Polygon.io |
| Trade Execution | FIX 4.2/4.4 Gateway, Broker OMS/EMS API (IB/CITIC/Huatai PB), DMA Direct Connect |
| Backtesting Engine | Zipline, Backtrader, QuantConnect, In-house event-driven engine |
| Risk | RiskMetrics, Axioma, Barra Factor Model, Internal VaR engine |
| Infrastructure | KDB+/q Time-series DB, Redis, Kafka, FPGA/Kernel Bypass |

**Data Sensitivity Classification**:

- Top Secret: Trading strategies, alpha signals, positions, P&L (core IP)
- Confidential: Backtest results, risk parameters, client portfolio configuration
- Internal: Market data (license-restricted redistribution), execution analytics

**Performance/Latency Budget**:

- Market data processing: HFT <1ms tick-to-signal; medium-frequency <100ms
- Order submission: Single-digit microseconds (FPGA) to low milliseconds
- Risk checks: Pre-trade checks <50μs additional latency
- Backtesting: Multi-year tick data replayed in minutes (parallelized)
- Availability: 99.99% during trading sessions

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Data source corruption/delay | Switch to fallback source, stale data detection, gap >N seconds triggers automatic liquidation |
| Strategy produces extreme signals | Pre-market sanity checks, circuit breaker |
| Execution venue disconnection | Auto-route to backup venue, order queuing, notify human |
| Risk limit breach | Immediate liquidation, disable strategy, notify risk manager |
| Model overfitting | Online monitoring of signal decay, automatic weight reduction, regime detection |

---

# 72. E-commerce Domain Architecture

> Related: §37 Business Domain Modeling · §30 Business Pack · §21 HITL · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §2

**DomainDescriptor Mapping**:

- `domain_id`: `ecommerce` · `recipe_archetype`: CRUD-heavy + Realtime
- `risk_level`: High · `latency_tier`: realtime (search/recommendation <200ms, risk control <500ms)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (E-commerce Law / Consumer Protection Law / PCI-DSS)

**Core Agent Roles**: Product Listing · Pricing · Inventory Fulfillment · Customer Service · Recommendation · Transaction Risk Control

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ----------------------- | ------------- | ----------- | --------------------- |
| `tool.price.update` | 40 | 80 | Manual approval for changes exceeding threshold |
| `tool.refund.issue` | 50 | 70 | Manual approval for amounts exceeding threshold |
| `tool.listing.publish` | 30 | 60 | Manual review for regulated categories |
| `tool.inventory.sync` | 30 | 30 | Auto-execute |

**DomainEvalFramework**: GMV · Conversion Rate · CSAT/NPS · Inventory Turnover · Risk Control Precision/Recall · Recommendation CTR

**HITL Strategy**: Price changes >X% require manual approval · Refunds exceeding threshold require manual approval · Regulated category listing review · Customer service first N replies reviewed during training period

**Key Guardrails**: Floor price constraint (prevent pricing at ¥0.01) · Inventory safety buffer · Customer service replies grounded in policy retrieval (prevent hallucinated commitments) · Multi-PSP payment failover

**Agent Workflows (Detailed)**:

- Product Listing Agent: Generate description → Title SEO → Categorization → Image attribute extraction → Multi-platform listing (Tmall/JD.com/Amazon)
- Pricing Agent: Competitor monitoring → Dynamic pricing model (elasticity/inventory/margin) → Markdown/promotion execution
- Inventory Fulfillment Agent: Demand forecasting → Replenishment trigger → Warehouse allocation → 3PL coordination → Split shipment
- Customer Service Agent: Pre-sale inquiry → After-sale handling → Complex case escalation → Reply template generation
- Recommendation Agent: User profiling → Collaborative filtering/hybrid model → Personalization → A/B testing
- Risk Control Agent: Real-time scoring (velocity/device/address) → Suspicious order flagging → Chargeback dispute

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Platform | Shopify API, Tmall/Taobao Open Platform, JD.com Kepler, Amazon SP-API, Pinduoduo |
| Payment | Alipay, WeChat Pay, Stripe, PayPal, Adyen |
| Logistics | SF Express API, Cainiao, FedEx/UPS/DHL, WMS (Manhattan, Blue Yonder) |
| Search/Recommendation | Elasticsearch, Algolia, Pinecone, TensorFlow Recommenders |
| CRM | Salesforce, HubSpot, Youzan, Weimob |

**Data Sensitivity Classification**:

- PII (High): Customer name, address, phone number, payment information (PCI-DSS scope)
- Confidential: Pricing strategy, supplier costs, margin data, inventory levels
- Internal: Product catalog, aggregated sales data, A/B test results

**Performance/Latency Budget**:

- Search/Recommendation: p99 <200ms
- Price updates: Competitive response <5 minutes, planned promotions batch
- Risk scoring: <500ms per transaction (synchronous checkout)
- Customer service: Chat first response <3s, ticket <2h
- Inventory sync: Multi-channel <1 minute

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Price bot war | Floor price constraint, margin guardrails, threshold-based manual alert |
| Inventory sync delay causing oversell | Reserved inventory management, safety stock buffer, automatic compensation |
| Customer service Agent hallucinating policy | Policy-retrieval grounded generation, mandatory policy document citation |
| Recommendation cold start | Popular items fallback, demographic defaults, preference collection |
| Payment gateway failure | Multi-PSP failover, queued retry, customer notification |

---

# 73. Advertising Domain Architecture

> Related: §37 Business Domain Modeling · §18 Cost Management · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §3

**DomainDescriptor Mapping**:

- `domain_id`: `advertising` · `recipe_archetype`: Creative + Analytics
- `risk_level`: Medium · `latency_tier`: near_realtime (bidding <100ms, reporting 15min delay acceptable)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (Advertising Law / Platform Policies / GDPR Tracking Consent)

**Core Agent Roles**: Campaign Planning · Creative Generation · Bid Optimization · Audience Management · Attribution Reporting

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.launch` | 40 | 75 | Budget commitment + creative approval |
| `tool.bid.adjust` | 30 | 50 | Manual approval when exceeding budget threshold |
| `tool.creative.publish` | 30 | 70 | Brand/legal review required before go-live |
| `tool.audience.create` | 20 | 50 | Sensitive attribute targeting requires privacy review |

**DomainEvalFramework**: ROAS · CPA · CTR · Brand Lift · Budget Pacing Accuracy · Creative Quality Score · Attribution Accuracy

**HITL Strategy**: Campaign launch approval (budget commitment) · Brand/legal review before creative go-live · Sensitive category audience targeting review · Budget increase >X% requires approval

**Key Guardrails**: Hard daily/hourly budget caps · Pre-submission compliance check (advertising law absolute-claim detection) · Automatic audience expansion fallback · Frequency cap enforcement

**Agent Workflows (Detailed)**:

- Campaign Planning Agent: Business objective analysis → Media plan (channel/budget/schedule/targeting)
- Creative Generation Agent: Platform spec adaptation (Douyin vertical / WeChat Moments card / Google responsive) → A/B variants
- Bid Optimization Agent: Cross-DSP real-time bidding → Conversion probability / budget pacing / competitive adjustment → Target CPA/ROAS
- Audience Management Agent: 1P/2P/3P data segment building → Lookalike → Frequency cap → Cross-device identity resolution
- Attribution & Reporting Agent: Cross-touchpoint conversion collection → Multi-touch attribution (Shapley/Markov) → Performance dashboard

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Ad Platform | Google Ads, Meta Marketing, Ocean Engine, Tencent Ads, Baidu Marketing, Kuaishou Magnetic Engine |
| DSP | The Trade Desk, DV360, MediaMath |
| Creative | Canva API, Figma API, Midjourney/DALL-E, RunwayML |
| Analytics | Google Analytics, Adobe Analytics, AppsFlyer/Adjust |
| Brand Safety | IAS, DoubleVerify, MOAT |

**Data Sensitivity Classification**:

- PII (High): Customer email lists, CRM data, device IDs
- Confidential: Campaign performance, bidding strategy, customer acquisition cost, creative test results
- Internal: Aggregated reach/frequency data, market benchmarks

**Performance/Latency Budget**:

- Bid decision: RTB <100ms
- Campaign adjustment: Hourly budget pacing, daily bid optimization
- Creative generation: Copywriting in minutes, image/video in hours (async)
- Reporting: Near-real-time dashboard with 15-minute delay

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Bid error causing budget overspend | Hard daily/hourly budget caps, real-time spend monitoring with auto-pause |
| Creative rejected by platform | Pre-submission compliance check Agent, pre-approved template library |
| Audience too narrow to deliver | Automatic audience expansion trigger, Lookalike fallback |
| Attribution data loss | Modeled conversions, MMM backup |
| Ad fatigue | Automatic creative rotation, frequency cap enforcement, refresh trigger |

---

# 74. Financial Services Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §49 Compliance Policy Engine · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §4

**DomainDescriptor Mapping**:

- `domain_id`: `financial-services` · `recipe_archetype`: Compliance + Trading
- `risk_level`: Critical · `latency_tier`: realtime~batch (fraud <200ms, KYC <30s, regulatory reporting batch)
- `hitl_intensity`: Critical · `regulatory_density`: Critical (Basel III / AML laws / C-ROSS / EU AI Act)

**Core Agent Roles**: Credit Assessment · KYC/AML · Insurance Underwriting · Claims Processing · Regulatory Reporting

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | --------------------- | -------------------- | ------------------------------------------- |
| `tool.credit.approve` | 50 | 95 | Exceeds threshold: mandatory manual review + explainability |
| `tool.sar.submit` | 50 | 95 | Legally required manual review |
| `tool.claim.adjudicate` | 50 | 80 | Manual review when exceeding auto-adjudication limit |
| `tool.model.deploy` | 50 | 90 | Fairness testing + manual approval |

**DomainEvalFramework**: Gini coefficient / KS statistic · SAR quality (regulatory feedback) · Loss ratio / Combined ratio · Model stability (PSI) · Regulatory inspection finding count

**HITL Strategy**: Mandatory for above-threshold loan approvals · Legally required manual review for SAR/STR reports · Mandatory approval for model deployment/retraining · Adverse credit decisions must be reviewable · Many jurisdictions require "meaningful human involvement"

**Key Guardrails**: Fairness testing (disparate impact analysis) · PSI monitoring with automatic rollback · Reconciliation checks + data lineage tracking · Multi-factor KYC verification

**Agent Workflows (Detailed)**:

- Credit Assessment Agent: Applicant data collection → Scorecard/ML scoring → Approval recommendation + explanation → Loan term structuring
- KYC/AML Agent: Document OCR + liveness detection → Sanctions list screening (OFAC/UN/EU) → Suspicious transaction monitoring → SAR/STR reporting
- Insurance Underwriting Agent: Risk factor analysis → Policy pricing → Exclusions → Policy document generation
- Claims Processing Agent: Claim intake → Coverage verification → Fraud detection → Payout estimation → Route to review or auto-approve
- Regulatory Reporting Agent: Cross-system aggregation → Report generation (Basel III/CCAR) → Completeness validation → Submission

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Credit Bureau | PBOC Credit, Experian, Equifax, TransUnion, Baihang Credit |
| Sanctions/AML | World-Check, Dow Jones, OFAC SDN, Chainalysis |
| Document Processing | ABBYY, Tesseract OCR, AWS Textract |
| Core Banking | Temenos, FIS, Changliang Tech, DCITS |
| Insurance Platform | Guidewire, Duck Creek, Sinosoft |

**Data Sensitivity Classification**:

- Extremely Sensitive (PII + Financial): ID number/SSN, bank account numbers, credit reports, medical records (insurance), tax filings
- Confidential: Risk models, pricing algorithms, position information, customer lists
- Regulated: All transaction data retained for 5–7 years

**Performance/Latency Budget**:

- Fraud scoring: <200ms · Credit pre-approval: <5s
- KYC verification: Automated <30s, Enhanced due diligence <24h
- Claims processing: Simple auto-adjudication <1min, Complex with human review <48h
- Regulatory reporting: Batch processing, strict deadlines (T+1 or monthly)

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Model drift causing bad credit decisions | PSI monitoring, champion-challenger testing, automatic rollback |
| AML false positive overload | Risk-based prioritization, feedback loop optimization, tiered review |
| Regulatory report data inconsistency | Reconciliation checks, data lineage tracking, pre-submission validation |
| Deploying biased model | Pre-deployment fairness testing, continuous monitoring by protected group |
| KYC document forgery | Multi-factor verification, liveness detection, government database cross-check |

---

# 75. Data Engineering Domain Architecture

> Related: §37 Business Domain Modeling · §29 Knowledge/Memory · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §5

**DomainDescriptor Mapping**:

- `domain_id`: `data-engineering` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: sla_driven (batch SLA-driven, streaming sub-second)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (data governance / GDPR right to erasure / data residency)

**Core Agent Roles**: Pipeline Orchestration · Data Quality · Schema Management · Data Lineage · Anomaly Detection

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --------------------------- | --------------------- | -------------------- | ----------------------------------------- |
| `tool.schema.migrate` | 50 | 85 | Breaking changes require mandatory manual approval |
| `tool.pipeline.deploy_prod` | 50 | 75 | Code review required before first production run |
| `tool.data.delete` | 60 | 90 | Data deletion requests require mandatory approval |
| `tool.pipeline.retry` | 20 | 20 | Auto-execute (idempotency guaranteed) |

**DomainEvalFramework**: SLA achievement rate · Data quality check pass rate · Pipeline generation accuracy · Compute cost trend · Lineage coverage rate

**HITL Strategy**: Schema migration approval (breaking changes) · Production pipeline deployment · Data deletion requests · Sensitive dataset access authorization

**Key Guardrails**: Schema drift detection · Idempotent write patterns · Budget alerts + pre-execution query cost estimation · Least-privilege access to sensitive data

**Agent Workflows (Detailed)**:

- Pipeline Orchestration Agent: Natural language requirements → DAG generation (Airflow/Dagster) → Scheduling/retry/dependency management
- Data Quality Agent: Inbound profiling → Validation rules (schema/range/uniqueness/referential integrity) → Bad record quarantine → Quality report
- Schema Management Agent: Source system change detection → Migration script → Downstream impact assessment → Schema registry
- Data Lineage Agent: Source-to-consumption tracking → Lineage graph → Impact analysis → Audit trail
- Anomaly Detection Agent: Data volume/freshness/distribution drift/pipeline latency monitoring → Root cause alerting

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Orchestration | Apache Airflow, Dagster, Prefect, dbt, Luigi |
| Stream Processing | Kafka, Flink, Spark Structured Streaming, Pulsar |
| Storage | Snowflake, Databricks, BigQuery, Delta Lake, Iceberg |
| Quality | Great Expectations, dbt tests, Monte Carlo, Soda |
| Catalog/Lineage | Apache Atlas, DataHub, Amundsen, OpenLineage |

**Data Sensitivity Classification**:

- High: PII columns (must be masked/tokenized), financial data, health data
- Medium: Business metrics, operational data
- Low: Public datasets, reference data
- Agents need metadata access; actual sensitive data access should be minimized

**Performance/Latency Budget**:

- Batch pipelines: SLA-driven (e.g., daily aggregation ready by 6 AM)
- Stream processing: Real-time sub-second, near-real-time seconds
- Data quality checks: Must not add >10% to pipeline runtime
- Lineage queries: Impact analysis <5s
- Agent response: Pipeline generation in seconds, complex optimization in minutes

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Pipeline failure mid-run | Checkpointing, idempotent operations, automatic backoff retry |
| Source schema change breakage | Drift detection, auto-adapt for additive changes, manual review for breaking changes |
| Data quality regression | Auto-quarantine bad batches, rollback to last known good data, SLA violation alert |
| Cost runaway | Budget alerts, scaling limits, query cost estimation |
| Retries causing duplicates | Idempotent writes (upsert/dedup keys), exactly-once semantics |

---

# 76. Coding Domain Architecture

> Related: §37 Business Domain Modeling · §30 Business Pack · §11 Security · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §6
> Existing implementation: `src/domains/coding/`

**DomainDescriptor Mapping**:

- `domain_id`: `coding` · `recipe_archetype`: Creative + Adversarial
- `risk_level`: High · `latency_tier`: realtime (completion <500ms, review <5min)
- `hitl_intensity`: High · `regulatory_density`: Low-Medium (licensing / SOC2 / industry-specific)

**Core Agent Roles**: Code Generation · Code Review · Testing · CI/CD · Security Scanning · Debugging

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ------------------------- | --------------------- | -------------------- | --------------------------------- |
| `tool.code.merge` | 50 | 80 | Mandatory human developer review |
| `tool.deploy.production` | 60 | 90 | Manual approval + security scan pass |
| `tool.code.generate` | 30 | 40 | Must have human review before merge |
| `tool.security.fix` | 40 | 60 | Security team approval |

**DomainEvalFramework**: Generated code test pass rate · Bug detection true positive rate · Suggestion acceptance rate · Vulnerability detection rate · License compliance rate

**HITL Strategy**: All generated code must have human review before merge · Production deployment requires manual approval · Security vulnerability fix decisions · Architecture decisions

**Key Guardrails**: Pre-commit security scan hooks · License compliance checks · Pinned dependency version verification · Scope-limited context window

**Agent Workflows (Detailed)**:

- Code Generation Agent: Natural language requirements → Codebase context understanding → Generate implementation + tests
- Code Review Agent: PR analysis → Bug/security vulnerability/style/performance/architecture issues → Line-level comments + fix suggestions
- Testing Agent: Unit/integration/E2E test generation → Untested path identification → Fixtures and mocks → Coverage targets
- CI/CD Agent: Build pipeline management → Failure interpretation → Deployment orchestration → Feature flags → Canary analysis
- Security Scanning Agent: SAST/DAST/SCA → Triage → False positive reduction → Fix suggestions → Vulnerability lifecycle
- Debugging Agent: Error log/stack trace analysis → Root cause hypotheses → Fix suggestions → Test environment reproduction

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Version Control | GitHub, GitLab, Bitbucket API |
| CI/CD | GitHub Actions, Jenkins, GitLab CI, CircleCI, ArgoCD |
| Security | Snyk, SonarQube, Semgrep, Trivy, Dependabot, CodeQL |
| Testing | Jest, Pytest, JUnit, Playwright, Cypress, k6 |
| Code Analysis | Tree-sitter, Language Servers (LSP), ESLint, Ruff |
| Monitoring | Sentry, Datadog, PagerDuty, Grafana |

**Data Sensitivity Classification**:

- Extremely Sensitive: Source code (core IP), secrets/credentials, deployment configurations
- Confidential: Build logs, security scan results, architecture diagrams
- Internal: Public dependency information, general coding standards

**Performance/Latency Budget**:

- Code completion: Inline suggestions <500ms (IDE experience)
- Code review: Typical PR <5 minutes (async acceptable)
- Test generation: Single function in seconds, module in minutes
- Security scanning: Incremental in minutes, full codebase in hours
- CI/CD: Build/test should not be bottlenecked by the agent

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Generated code fails to compile | Iterative fix loop: compile → parse errors → fix → retry (up to N times) |
| Agent suggests deprecated API | Pinned dependency versions, validate against actually installed package APIs |
| Introducing security vulnerabilities | Pre-commit security scan hooks, mandatory security review for sensitive files |
| Flaky tests | Deterministic test patterns, explicit mocks, retry detection tagging |
| Incorrect modification scope | Scope-limited context window, multi-file change confirmation prompts |

---

# 77. User Operations Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance (PIPL/GDPR) · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §7

**DomainDescriptor Mapping**:

- `domain_id`: `user-operations` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: near_realtime (triggered campaigns <5min, batch segmentation daily)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (PIPL/GDPR/CAN-SPAM/TCPA)

**Core Agent Roles**: Segmentation · Lifecycle Management · Churn Prediction · Marketing Automation · Cohort Analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.send` | 30 | 60 | Campaign content approval |
| `tool.segment.create` | 20 | 50 | Segments using sensitive attributes require privacy review |
| `tool.notification.push` | 20 | 40 | Frequency cap enforcement |
| `tool.ab_test.launch` | 30 | 40 | A/B test launch review |

**DomainEvalFramework**: Retention rate (D1/D7/D30) · Churn rate · LTV/CAC ratio · Campaign open rate/CTR · NPS/CSAT

**HITL Strategy**: Campaign content approval · New segment review for sensitive attributes · Notification frequency policy changes · Incentive campaign budget allocation

**Key Guardrails**: Frequency cap enforcement · Engagement score gating · Pre-send segment size validation · Real-time preference center sync · Opt-out list hard enforcement

**Agent Workflows (Detailed)**:

- Segmentation Agent: Behavioral data analysis (events/transactions/interactions) → RFM/behavioral clustering/predictive attributes → Dynamic segmentation
- Lifecycle Management Agent: Acquire → Activate → Retain → Monetize → Refer → Stage interventions → Personalized touchpoints
- Churn Prediction Agent: Behavioral signals (engagement decline/tickets/feature abandonment) → Churn model → High-risk list + intervention recommendations
- Marketing Automation Agent: Multi-touch campaigns (Push/Email/In-app/SMS) → Send-time optimization → Frequency capping
- Cohort Analysis Agent: Acquisition channel/time/behavior → Retention curves → High-value cohort identification → Insight reports

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| CDP/Analytics | Segment, Amplitude, Mixpanel, Sensors Data, GrowingIO, Umeng |
| Marketing Automation | Braze, CleverTap, JPush, Getui, Iterable |
| Communication | Twilio (SMS), SendGrid (Email), APNs/FCM, WeChat/WeCom API |
| A/B Testing | Optimizely, LaunchDarkly, Firebase Remote Config |
| Data Warehouse | Snowflake, BigQuery, ClickHouse |

**Data Sensitivity Classification**:

- PII (High): User profiles, contact information, behavioral data linked to identifiable users
- Sensitive Behavior: Location, health/fitness, financial behavior, browsing history
- Aggregated (Low): Cohort-level metrics, anonymized funnel data

**Performance/Latency Budget**:

- Segment updates: Triggered <5 min latency, batch daily
- Campaign triggers: Real-time event to message delivery <1 min
- Churn prediction: Daily scoring, real-time for high-value users
- A/B test results: Statistical significance monitoring, daily reporting

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Notification fatigue (unsubscribe spike) | Frequency capping, engagement score gating, automatic cool-down period |
| Incorrect personalization | Content safety review, fallback to generic message, sensitive topic detection |
| Churn model false positives | Tiered intervention (low-cost first), A/B test interventions, feed back to model |
| Sent to wrong segment | Pre-send segment size validation, sandbox testing, progressive rollout |
| Opt-out preferences not respected | Real-time preference center sync, hard opt-out enforcement at send layer |

---

# 78. Industry Research Domain Architecture

> Related: §37 Business Domain Modeling · §29 Knowledge/Memory · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §8

**DomainDescriptor Mapping**:

- `domain_id`: `industry-research` · `recipe_archetype`: Research + Analytics
- `risk_level`: Low · `latency_tier`: batch (reports hours to days, breaking alerts <15min)
- `hitl_intensity`: High · `regulatory_density`: Low (securities law/data licensing/copyright)

**Core Agent Roles**: Market Analysis · Competitive Intelligence · Trend Forecasting · Report Generation · Regulatory Tracking

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.report.publish` | 30 | 80 | Human analyst review required before publishing |
| `tool.data.scrape` | 40 | 60 | Copyright/licensing compliance check |
| `tool.forecast.generate` | 30 | 50 | Forward-looking statements must include disclaimer |
| `tool.alert.send` | 20 | 30 | Auto-execute (low-risk information push) |

**DomainEvalFramework**: Factual accuracy · Source citation rate · Time to insight · Relevant source coverage · Analyst satisfaction

**HITL Strategy**: All published research requires human analyst review · Quantitative claims must cite sources · Forward-looking statements must include disclaimers

**Key Guardrails**: Mandatory source citation for all quantitative claims · Data timestamps + freshness checks · Paraphrase ratio monitoring (prevent copyright infringement) · Counter-evidence section requirement

**Agent Workflows (Detailed)**:

- Market Analysis Agent: Multi-source data collection (financial databases/news/statistics/reports) → Market size/growth/competitive landscape → Structured report
- Competitive Intelligence Agent: Competitor activity monitoring (product/pricing/hiring/patents/regulatory) → Competitor profiles → Change alerts
- Trend Forecasting Agent: Patent/paper/funding/social/policy signals → Emerging trend identification → Confidence-rated forecasts
- Report Generation Agent: Findings → Structured report (executive summary/methodology/recommendations) → Multi-format → Rigorous citations
- Regulatory Tracking Agent: Cross-jurisdiction regulatory changes → Business impact assessment → Compliance gap analysis → Change calendar

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Data Sources | Wind, Bloomberg, Statista, IBISWorld, National Bureau of Statistics, Euromonitor |
| News/Media | NewsAPI, GDELT, Caixin/36kr API, Social Listening |
| Patents | WIPO, USPTO, CNIPA, Google Patents |
| Financial Filings | SEC EDGAR, CNINFO, ExFact |
| NLP | Sentiment analysis, NER, Summarization |

**Data Sensitivity Classification**:

- Confidential: Proprietary research findings, client-specific analysis, competitive strategy recommendations
- Licensed: Third-party data (Bloomberg/Wind) license restrictions on redistribution
- Public: Government statistics, published reports, public news

**Performance/Latency Budget**:

- Alert generation: Breaking news/regulatory changes <15 min
- Report generation: Hours to days (async), comprehensive reports may take several hours
- Data refresh: Market daily, competitive weekly, deep-dive quarterly

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Hallucinated statistics | Mandatory source citation for all quantitative claims, validation Agent cross-check |
| Stale data presented as current | Timestamp all data points, freshness checks, flag when exceeding threshold |
| Copyright infringement | Attribution summaries, fair use guidelines, paraphrase ratio monitoring |
| Missing key competitors | Multi-source cross-referencing, gap detection checklist, human scope review |
| Trend identification bias | Counter-evidence requirement, multi-perspective prompting, uncertainty quantification |

---

# 79. Academic Research Domain Architecture

> Related: §37 Business Domain Modeling · §29 Knowledge/Memory · §23 Compliance · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §9

**DomainDescriptor Mapping**:

- `domain_id`: `academic-research` · `recipe_archetype`: Research
- `risk_level`: Low · `latency_tier`: batch (literature review hours to days, writing assistance real-time)
- `hitl_intensity`: High · `regulatory_density`: Medium (research ethics/publication ethics/data regulations)

**Core Agent Roles**: Literature Review · Hypothesis Generation · Experiment Design · Data Analysis · Writing and Publication

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.manuscript.submit` | 30 | 90 | Full human researcher review |
| `tool.citation.insert` | 10 | 70 | Every citation must be DOI-verified |
| `tool.analysis.run` | 20 | 50 | Assumption check + human statistician review |
| `tool.literature.search` | 10 | 10 | Auto-execute |

**DomainEvalFramework**: Citation accuracy 100% (zero fabrication) · Statistical correctness · Reproducibility · Literature coverage · Writing quality

**HITL Strategy**: All published content requires human researcher review · Hypothesis selection/experiment design approval · Statistical method selection · Researcher must assume intellectual property ownership

**Key Guardrails**: Automatic DOI/database verification for every citation · Plagiarism detection tool integration · Assumption-checking Agent layer · Isolated processing environment (prevent data leakage)

**Agent Workflows (Detailed)**:

- Literature Review Agent: Academic database search (Semantic Scholar/PubMed/CNKI/arXiv) → Ranking → Key finding extraction → Research gaps → Standardized citation management
- Hypothesis Generation Agent: Cross-paper finding analysis → Contradictions/unexplored intersections → Testable hypotheses + experimental method suggestions
- Experiment Design Agent: Sample size calculation → Control groups → Statistical tests → Confounding variables → Pre-registration documents
- Data Analysis Agent: Statistical analysis (regression/ANOVA/survival analysis) → Visualization → Common error checks (p-hacking/multiple comparisons)
- Writing and Publication Agent: Journal formatting → Abstract generation → References (BibTeX/EndNote) → Submission package

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Academic Databases | Semantic Scholar, PubMed/MEDLINE, arXiv, CNKI, Web of Science, Scopus |
| Citation Management | Zotero, Mendeley, EndNote |
| Data Analysis | R, Python (scipy/statsmodels/pandas), SPSS, Stata |
| LaTeX | Overleaf API, LaTeX compilation toolchain |
| Reproducibility | Jupyter, R Markdown, Docker, DVC, MLflow |
| Pre-registration | OSF, AsPredicted |

**Data Sensitivity Classification**:

- High: Human subject data (IRB), patient data (HIPAA), unpublished results, grant proposals
- Medium: Pre-publication manuscripts, preliminary results, peer review comments
- Low: Published papers, public datasets

**Performance/Latency Budget**:

- Literature search: Initial <30s, comprehensive retrieval minutes
- Statistical analysis: Seconds to minutes
- Writing assistance: Real-time or near real-time
- Full literature review: Hours to days (async)

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Citation fabrication | Automatic DOI/database verification for every citation |
| Statistical method misuse | Assumption-checking layer, diagnostic tests, human statistician review |
| Generated text plagiarism | Integrated plagiarism detection (Turnitin/iThenticate), originality scoring |
| Missing relevant literature | Multi-database search, citation chain tracing, expert coverage review |
| Unpublished results leakage | Strict access controls, isolated processing environment |

---

# 80. Enterprise Knowledge Base Domain Architecture

> Related: §37 Business Domain Modeling · §50 Knowledge Domain Isolation · §11 Security · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §10

**DomainDescriptor Mapping**:

- `domain_id`: `knowledge-base` · `recipe_archetype`: CRUD-heavy
- `risk_level`: Medium · `latency_tier`: realtime (search <2s, synthesized answers <5s)
- `hitl_intensity`: Medium · `regulatory_density`: Medium (data retention/access control/privacy)

**Core Agent Roles**: Document Processing · Knowledge Graph · Semantic Search · FAQ Generation · Knowledge Gap Analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| ---------------------------- | ------------- | ----------- | -------------------------- |
| `tool.search.query` | 10 | 40 | Real-time access permission check at query time |
| `tool.document.ingest` | 20 | 50 | New document source onboarding requires approval |
| `tool.answer.synthesize` | 20 | 60 | Low-confidence answers respond with "I don't know" |
| `tool.content.retire` | 30 | 70 | Content retirement requires domain_owner decision |

**DomainEvalFramework**: MRR/NDCG/precision@k · Answer faithfulness · Citation accuracy · Coverage · Zero unauthorized access incidents

**HITL Strategy**: Access control policy definition · Sensitive document classification · Error correction when Agent answers incorrectly · Content retirement decisions

**Key Guardrails**: Source system permission mirroring + query-time access checks · Mandatory verifiable citation links · Document freshness tracking + staleness alerts · Hierarchical chunking

**Agent Workflows (Detailed)**:

- Document Processing Agent: Multi-format ingestion (PDF/Word/PPT/Confluence/Email/Meeting notes) → Structured extraction → Chunking → Metadata maintenance
- Knowledge Graph Agent: NLP entity/relationship extraction → Graph construction (people/projects/technologies/processes) → Disambiguation → Cross-domain linking
- Semantic Search Agent: Natural language query → Hybrid search (keyword + vector) → Re-ranking → Synthesized answer with citations
- FAQ Generation Agent: High-frequency question identification (tickets/chats/searches) → FAQ generation and maintenance → Staleness detection
- Knowledge Gap Analysis Agent: Undocumented processes → Stale content → Contradictions → Persistently unmatched queries

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Document Sources | Confluence, SharePoint, Google Drive, Notion, Feishu, DingTalk |
| Vector Databases | Pinecone, Weaviate, Milvus, Qdrant, pgvector |
| Knowledge Graph | Neo4j, Amazon Neptune, TigerGraph |
| Embedding Models | OpenAI Embeddings, BGE, Cohere Embed, Jina |
| Document Parsing | Unstructured.io, LlamaParse, Adobe PDF Services |
| Search Engines | Elasticsearch, OpenSearch, Typesense |

**Data Sensitivity Classification**:

- Top Secret: Executive strategy documents, M&A materials, personnel files, legal opinions
- Confidential: Internal policies, technical architecture, project documentation, financial data
- Internal: General processes, training materials, product documentation
- Document-level access control consistent with source system permissions must be implemented

**Performance/Latency Budget**:

- Search/Query: Results <2s, LLM synthesized answer <5s
- Document ingestion: Minutes to hours (batch processing acceptable)
- Knowledge graph updates: Near real-time for critical documents, daily batch for general
- Availability: 99.9% during business hours

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Search leaking confidential data | Source system permission mirroring, query-time access checks, audit logs |
| Hallucinated answers | Mandatory citation links, faithfulness scoring, low-confidence answers respond with "I don't know" |
| Returning stale content | Freshness tracking, automatic staleness alerts, deprecation workflow |
| Poor chunking quality | Hierarchical chunking with overlap, parent-child retrieval, metadata enrichment |
| Knowledge graph inconsistencies | Conflict detection, provenance tracking, human arbitration workflow |

---

# 81. Finance/Accounting Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §49 Compliance Policy Engine · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §11

**DomainDescriptor Mapping**:

- `domain_id`: `finance-accounting` · `recipe_archetype`: Compliance + CRUD-heavy
- `risk_level`: Critical · `latency_tier`: batch (month-end close window driven, ad-hoc queries <30s)
- `hitl_intensity`: Critical · `regulatory_density`: Critical (CAS/US GAAP/SOX/Golden Tax Phase IV/IFRS)

**Core Agent Roles**: Invoice Processing · Expense Control · Financial Reporting · Tax Compliance · Reconciliation · Budget Forecasting

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.journal.post` | 50 | 85 | Mandatory approval for journal entries exceeding threshold |
| `tool.financial.signoff` | 50 | 95 | CFO/Controller sign-off |
| `tool.tax.file` | 50 | 95 | Tax filing submission requires mandatory human approval |
| `tool.invoice.process` | 30 | 50 | Auto-post after three-way match passes |

**DomainEvalFramework**: Straight-through processing rate · GL posting accuracy · Reconciliation match rate · Days to close · Audit findings count · Segregation of duties violations count

**HITL Strategy**: Above-threshold journal entry approval · Financial statement sign-off (CFO/Controller) · Tax filing submission · Bad debt write-off · SOX-required documented review · Segregation of duties enforcement

**Key Guardrails**: OCR confidence score + human review below threshold · Three-way match validation · Duplicate payment detection · Exchange rate source verification (central bank/ECB) · Period-end cutoff rules

**Agent Workflows (Detailed)**:

- Invoice Processing Agent: Receipt (email/scan/e-invoice) → OCR → Three-way match → Approval routing → ERP posting
- Expense Control Agent: Expense report policy compliance review → Anomaly flagging → Auto-approve within policy → Route anomalies to human
- Financial Reporting Agent: Sub-ledger summarization → Consolidation (multi-entity/multi-currency) → Three-statement generation → Variance analysis
- Tax Compliance Agent: Tax liability calculation (VAT/income tax/withholding) → Tax filing → Transfer pricing documentation
- Reconciliation Agent: Cross-system matching (bank vs. GL/intercompany/sub-ledger) → Discrepancy identification → Resolution suggestions
- Budget and Forecasting Agent: Historical + driver factors → Forecasting → Scenario analysis → Budget vs. actual → Rolling forecast

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| ERP | SAP S/4HANA, Oracle ERP Cloud, Yonyou U8/NC, Kingdee K/3/Cloud |
| Expense Management | SAP Concur, Expensify, Ramp |
| Tax | Thomson Reuters ONESOURCE, Avalara, Aisino (Golden Tax System) |
| Banking | Bank APIs (PSD2/Open Banking), SWIFT, Direct Bank Connection |
| OCR | ABBYY, Kofax, Baidu AI/Tencent AI OCR |
| BI | Tableau, Power BI, FineReport |

**Data Sensitivity Classification**:

- Top Secret: Unreleased financial results, executive compensation, M&A valuations, tax positions
- Confidential: General ledger data, vendor contracts, employee expenses, bank accounts
- Regulated: All financial records SOX/audit retention (7-10 years)

**Performance/Latency Budget**:

- Invoice processing: OCR + matching <1 min, same-day posting
- Month-end close: Target 3-5 days (reduced from 10+ days), batch processing within close window
- Tax filing: Strict regulatory deadlines (China VAT by the 15th of each month)
- Reconciliation: Bank daily, others monthly
- Reporting: Ad-hoc <30s, scheduled reports within batch processing window

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| OCR misreading invoice amounts | Confidence scoring + human review below threshold, three-way match validation |
| Incorrect accounting period attribution | Period-end cutoff rules, validation against purchase/delivery dates, reversing entries |
| Consolidation exchange rate errors | Exchange rate source verification (central bank/ECB), translation vs. remeasurement reconciliation |
| Tax calculation errors | Multi-method verification, prior period comparison, tax rate table validation |
| Duplicate payments | Duplicate detection (vendor + amount + date + invoice number), approval workflow |

---

# 82. Legal Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §12

**DomainDescriptor Mapping**:

- `domain_id`: `legal` · `recipe_archetype`: Compliance + Adversarial
- `risk_level`: Critical · `latency_tier`: batch (contract review <1h, e-discovery throughput-priority)
- `hitl_intensity`: **Highest** (all outputs must be reviewed by a licensed attorney) · `regulatory_density`: Critical (Civil Code/Antitrust Law/GDPR/Professional Ethics)

**Core Agent Roles**: Contract Review · Regulatory Compliance · Litigation Support · Intellectual Property Management · Due Diligence · Policy Drafting

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| -------------------------- | ------------- | ----------- | ------------------------------ |
| `tool.contract.review` | 30 | 80 | All results require attorney review |
| `tool.legal_opinion.draft` | 50 | 99 | Never auto-send externally, mandatory attorney review |
| `tool.ediscovery.classify` | 40 | 85 | Privilege determination requires mandatory human review |
| `tool.ip.search` | 20 | 30 | Auto-execute (auxiliary information gathering) |

**DomainEvalFramework**: Risk clause detection recall (must catch all) · Case citation accuracy · E-discovery recall · Review time reduction · Deadline compliance

**HITL Strategy**: **All legal outputs must be reviewed by a licensed attorney before action is taken** — this domain has the highest HITL requirement among all 24 domains (tied with Healthcare). Contract negotiation · Litigation strategy · Regulatory filings · Legal opinions · Privilege determination all require mandatory human review. Agents provide only "legal information," never "legal advice."

**Key Guardrails**: Conservative strategy (flag all anomalous content) · Case citations must be verified against legal databases · Multi-factor privilege detection · Explicit jurisdiction labeling · Regulatory calendar + multi-source redundant alerts

**Agent Workflows (Detailed)**:

- Contract Review Agent: Clause-by-clause vs. standard playbook → Deviation identification → Risk flagging (unlimited liability/unfavorable indemnification/auto-renewal) → Negotiation suggestions → Redline markup
- Regulatory Compliance Agent: Cross-jurisdiction regulatory change monitoring → Regulation-to-business-process mapping → Gap analysis → Remediation tracking
- Litigation Support Agent: E-discovery document review → Relevance/privilege classification → Case timeline → Legal research
- IP Management Agent: Trademark/patent monitoring → Renewal tracking → FTO search → Infringement identification → Portfolio management
- Due Diligence Agent: Target company document review → Key term extraction → Liabilities/contingencies → Red flags
- Policy Drafting Agent: Jurisdiction requirements → Privacy policy/ToS/compliance policies → Version management

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Contract Management | DocuSign CLM, Ironclad, Fadada, BestSign, Icertis |
| Legal Research | Westlaw, LexisNexis, PKULaw, WoltersKluwer China |
| E-Discovery | Relativity, Nuix, Logikcull, DISCO |
| Intellectual Property | Thomson Reuters IP, MaxVal, CNIPA |
| Compliance | OneTrust, LogicGate, SAI360 |

**Data Sensitivity Classification**:

- Attorney-Client Privilege: Legal opinions, litigation strategy, settlement discussions — highest protection
- Top Secret: M&A documents, regulatory investigations, IP trade secrets, labor disputes
- Confidential: Standard contracts, policies, compliance records
- Regulated: Court filings (partially public), regulatory submissions

**Performance/Latency Budget**:

- Contract review: Standard <1h, complex multi-party <24h
- Regulatory monitoring: Daily scans, real-time alerts for critical changes
- E-discovery: Thousands of documents per hour (throughput > latency)
- Legal research: Initial case law <30s, full memo minutes

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Missing critical contract clauses | Flag all anomalies, comprehensive playbook, human review of all contracts |
| Fabricated case citations | Mandatory legal database verification, never present unverified citations |
| Privilege classification errors | Multi-factor detection, human review of all privilege determinations |
| Jurisdiction mismatch | Explicit jurisdiction labeling, jurisdiction-specific playbooks, conflict flagging |
| Missed regulatory changes | Multi-source monitoring, redundant alerts, regulatory calendar with human accountability |

---

# 83. Live Streaming Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §13

**DomainDescriptor Mapping**:

- `domain_id`: `live-streaming` · `recipe_archetype`: Realtime + Moderation
- `risk_level`: High · `latency_tier`: realtime (streaming <1s, danmaku moderation <200ms)
- `hitl_intensity`: **High** (political/terrorism-related review, live commerce violation handling) · `regulatory_density`: High (Internet Live Streaming Service Management Regulations / Minors Protection Law / Advertising Law)

**Core Agent Roles**: Stream Orchestration · Interactive Operations · Real-time Content Moderation · E-commerce Conversion · Data Analytics

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.stream.publish` | 25 | 60 | Streamer qualification and content labels must be verified before going live |
| `tool.moderation.realtime` | 40 | 95 | Political/terrorism/minor-related content triggers immediate stream cutoff with mandatory human review |
| `tool.commerce.shelf` | 30 | 70 | Product listing requires compliance verification; prohibited items are automatically blocked |
| `tool.danmaku.filter` | 20 | 50 | Sensitive words filtered in real time; edge cases subject to manual spot checks |

**DomainEvalFramework**: Violation detection rate (zero missed detections for political/pornographic/minor-related content) · False positive rate (<2% to avoid impacting legitimate content) · Handling latency (stream cutoff <3s) · GPM (gross merchandise value per thousand views) · Stream publish success rate

**HITL Strategy**: Political/terrorism/minor-related content requires mandatory human review before the live stream can be restored. Live commerce violation handling requires operations team confirmation. Pre-broadcast review for major events requires mandatory human sign-off. Agents handle real-time initial screening and orchestration; final handling decisions belong to the moderation operations team.

**Key Guardrails**: Multi-modal real-time moderation pipeline (audio + video + text in parallel) · Hard time-slot restrictions for minor protection · Automatic escalation of moderation levels during sensitive periods · Stream cutoff circuit breaker (quick recovery from false positives) · E-commerce dual compliance verification (platform rules + Advertising Law)

**Agent Workflows (Detailed)**:

- Stream Orchestration Agent: Stream initialization → Multi-platform distribution (Douyin/Kuaishou/Bilibili/Channels/etc.) → Transcoding configuration → CDN scheduling → Quality monitoring → Replay generation
- Interactive Operations Agent: Danmaku sentiment analysis → Interactive features (red packets/quizzes/polls/co-streaming) → Popularity curve adjustment → Fan tier system
- Real-time Moderation Agent: Multi-modal stream sampling (video/audio/danmaku) → AI classification → Risk scoring → Action (warning/mute/stream cutoff)
- Live Commerce Agent: Product listing/delisting cadence → Coupon timing → Inventory locking → Real-time sales dashboard → Dynamic promotion adjustment
- Data Analytics Agent: Real-time metric tracking (viewers/interactions/conversions/gifts/GPM) → Post-stream report → Historical comparison → Optimization recommendations

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Live Platforms | Douyin/Kuaishou/Bilibili/Channels/Taobao Live/YouTube Live/Twitch API |
| Streaming/Transcoding | OBS SDK, FFmpeg, SRS, Alibaba Cloud Live, Tencent Cloud Live, Agora |
| Content Moderation | Alibaba Cloud Green, Tencent Tianyu, Baidu Content Security, Amazon Rekognition |
| E-commerce | Douyin Store, Kuaishou Store, Taobao Alliance, Youzan |
| Data | Chanmama, Feigua Data, ClickHouse, Apache Flink |

**Data Sensitivity Classification**:

- High (PII + Financial): User real-name information, payment accounts, tipping/transaction records, streamer income
- Confidential: Operations strategy, product selection data, MCN contracts, revenue share ratios, recommendation parameters
- Internal: Aggregated viewership data, interaction statistics, public replays
- Real-time stream data contains streamer likeness/environment information and must be classified by scenario

**Performance/Latency Budget**:

- Streaming: Low latency <1s, ultra-low latency (co-streaming) <400ms, standard <3s
- Moderation: Video frame <500ms, danmaku <200ms (synchronous filtering)
- Interaction: Red packets/polls/co-streaming <1s
- E-commerce: Product listing/delisting <2s, inventory locking <500ms
- Availability: 99.99% during live broadcast

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Stream interruption / CDN failure | Auto-switch to backup addresses and CDN, reconnect stream, seamless viewer-side failover |
| Moderation miss of violating content | Multi-model cascade, manual patrol as fallback, post-hoc tracing, real-time reporting channel |
| Live commerce inventory oversell | Inventory pre-locking, safety stock buffer, automatic oversell compensation |
| Tipping system anomaly | Idempotent design, real-time reconciliation, anomaly freeze + manual review |
| Large-scale concurrency overload | Elastic auto-scaling, rate limiting and degradation, core path protection (streaming priority) |

---

# 84. Creative Production Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §14

**DomainDescriptor Mapping**:

- `domain_id`: `creative-production` · `recipe_archetype`: Creative
- `risk_level`: Medium · `latency_tier`: near-realtime (copywriting <10s, image <30s, compliance check <5s)
- `hitl_intensity`: **Medium** (brand creatives require pre-publish approval; medical/financial creatives require legal review) · `regulatory_density`: Medium (Advertising Law / Copyright Law / Portrait Rights)

**Core Agent Roles**: Creative Generation · Brand Compliance Check · Asset Adaptation · Performance Prediction · Workflow Management

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.creative.generate` | 25 | 55 | Generated assets automatically watermarked as AI-generated; brand creatives require human approval |
| `tool.brand.compliance` | 30 | 75 | Medical/financial/education industry creatives require mandatory legal review |
| `tool.asset.adapt` | 15 | 25 | Size/format adaptation executes automatically |
| `tool.creative.predict` | 20 | 35 | Performance prediction results are advisory only and do not automatically trigger ad placement decisions |

**DomainEvalFramework**: Brand compliance pass rate (brand tone consistency) · Platform review first-pass approval rate (>95%) · CTR/CVR prediction accuracy · Creative output speed (efficiency multiplier vs. manual production)

**HITL Strategy**: Performance-oriented creatives in batch generation can flow automatically to the ad placement system. Brand creatives and creatives for heavily regulated industries (medical/financial/education) require mandatory human approval before publishing. Creatives involving celebrity likenesses or third-party copyrighted materials require legal confirmation of a complete authorization chain.

**Key Guardrails**: Copyright asset traceability chain (all referenced assets traceable to authorization) · Absolute-claim wording auto-detection (Advertising Law prohibited term database updated in real time) · Portrait rights usage authorization verification · Industry-sensitive term filtering (tiered dictionaries for medical/financial/education) · Mandatory AI watermark injection for generated content

**Agent Workflows (Detailed)**:

- Creative Generation Agent: Brief parsing → Creative strategy → Multi-format assets (copy/image/video script/landing page) → Brand verification → A/B variants
- Brand Compliance Check Agent: Asset ingestion → Brand guideline matching (logo/color/font/tone) → Advertising Law verification → Risk annotation → Revision suggestions
- Asset Adaptation Agent: Source asset parsing → Platform spec matching (9:16/1:1/16:9/3:4) → Smart cropping/re-layout → Batch output
- Performance Prediction Agent: Historical + asset features (color tone/sentiment/CTA/person ratio) → CTR/CVR prediction → Ranking → Optimization direction
- Workflow Management Agent: Request pool → Task assignment → Approval routing → Version management → Asset library → End-to-end status

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Image Generation | Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly, Jimeng AI |
| Video Production | RunwayML, Pika, Sora, Jianying API, Adobe Premiere SDK |
| Design | Figma API, Canva API, Adobe CC SDK, Lanhu |
| Copywriting | GPT-4, Claude, ERNIE Bot, Tongyi Qianwen |
| DAM | Bynder, Brandfolder, Adobe AEM Assets |
| Performance Analytics | Ocean Engine Creative, Tencent Ads Creative Center, Google Ads Creative Studio |

**Data Sensitivity Classification**:

- Confidential: Unpublished creative strategy, brand guideline manuals, competitive analysis, prediction model parameters
- Internal: Published creatives, ad performance data, A/B test results, asset library
- Low: Public ad creatives, industry creative references

**Performance/Latency Budget**:

- Copywriting: Single piece <10s, batch (100 variants) <5min
- Image generation: Single image <30s, batch adaptation (10 sizes) <3min
- Video generation: 15-second short video <10min, long video hour-level (async)
- Brand compliance check: Single asset <5s
- Performance prediction: Batch scoring <1min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Generated asset infringes copyright | Similarity detection (against copyright image libraries), provenance watermark, automatic takedown on infringement |
| Brand guideline deviation | Guidelines embedded in prompt, style reference image constraints, multi-round verification |
| Advertising Law violating copy | Prohibited term database real-time filtering, compliance Agent pre-review, automatic violation replacement |
| Batch quality loss of control | Quality score threshold filtering, sampled manual review, automatic rejection of low-scoring assets |
| Performance prediction inaccuracy | Continuous A/B calibration, periodic model retraining, deviation monitoring |

---

# 85. Game Development Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §15

**DomainDescriptor Mapping**:

- `domain_id`: `game-dev` · `recipe_archetype`: Creative + Research
- `risk_level`: Medium · `latency_tier`: batch (QA <2h, numerical simulation <10min)
- `hitl_intensity`: **High** (core gameplay design / art style direction / release approval) · `regulatory_density`: High (ISBN license / anti-addiction / content review / ESRB / PEGI)

**Core Agent Roles**: Design Assist · Art Asset Generation · QA Automation · Numerical Balancing · Code Generation

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.game.design_assist` | 20 | 40 | Design suggestions are advisory only; core gameplay decisions require mandatory human input |
| `tool.game.asset_generate` | 25 | 65 | Art assets require Art Director confirmation of style consistency before being committed to the repository |
| `tool.game.qa_run` | 15 | 20 | Automated tests run autonomously; bug reports are automatically archived |
| `tool.game.balance_sim` | 30 | 55 | Numerical adjustment suggestions require designer review and are not automatically written to config tables |

**DomainEvalFramework**: Art style consistency (FID/CLIP-Score) · Bug detection rate (automated vs. manual comparison) · Code generation adoption rate · Gini coefficient (economy/numerical balance)

**HITL Strategy**: Core gameplay design, art style direction, and release approval are mandatory human decision points. Numerical balancing simulation results must be confirmed by the design team before being applied. QA automation can run independently, but P0/P1 bug fix plans require sign-off from the development lead.

**Key Guardrails**: Generated asset copyright compliance check (similarity detection against known IPs) · Content review pre-screening (ISBN filing compliance pre-validation) · Anti-addiction mechanism pre-integration verification · Code generation security scan (injection/vulnerability auto-detection) · Numerical simulation outlier circuit breaker

**Agent Workflows (Detailed)**:

- Design Assist Agent: Design intent → Reference analysis → System design (gameplay loop/levels/economy/narrative) → Numerical framework → GDD
- Art Generation Agent: Style reference → Asset requirements parsing → Generation (concept art/2D/3D/UI/scene) → Style consistency verification → Format export
- QA Agent: Functional testing (quests/UI/saves) → Performance testing (frame rate/memory/loading) → Compatibility testing → Crash analysis → Bug report
- Numerical Balancing Agent: Economy system/attributes/difficulty curve → Monte Carlo simulation → Balance assessment → Exploit strategy detection
- Code Generation Agent: Gameplay/Shader/AI behavior tree/network sync → Engine adaptation (Unity/Unreal) → Code standards

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Engines | Unity (C#), Unreal (C++/Blueprint), Godot, Cocos Creator |
| Art | Midjourney, Stable Diffusion (ControlNet/LoRA), Substance 3D, Meshy |
| Version Control | Perforce Helix Core, Git LFS, PlasticSCM |
| Testing | Unity Test Framework, Unreal Automation, Appium, GameBench |
| Numerical | Python (NumPy/SciPy), MATLAB, In-house simulator |

**Data Sensitivity Classification**:

- Top Secret: Unpublished GDD, core gameplay patents, source code, unreleased art assets
- Confidential: Internal test data, performance benchmarks, numerical models, project schedules
- Internal: Published trailer assets, developer blogs, shipped assets

**Performance/Latency Budget**:

- Art generation: Concept art <30s, 2D batch <5min, 3D prompt <1min
- QA testing: Single regression pass <2h (parallel), crash analysis <5min
- Numerical simulation: Single run <10min (10,000 Monte Carlo iterations), parameter sweep hour-level
- Code generation: Single function <10s, module <2min
- Build: Incremental <5min, full <1h

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Art style deviation | ControlNet/LoRA constraints, Art Director review gate |
| Numerical simulation divergence | Live A/B validation, player data feedback loop, hotfix adjustment |
| Automated test miss | Multi-strategy combination (random + directed + exploratory), manual supplementation, player feedback |
| Generated code performance issues | Profiling auto-integration, performance budget gate |
| Procedural content repetition | Mutation seed diversification, manual + generated mix ratio, freshness monitoring |

---

# 86. Game Publishing Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §16

**DomainDescriptor Mapping**:

- `domain_id`: `game-publishing` · `recipe_archetype`: Compliance + Logistics
- `risk_level`: High · `latency_tier`: near-realtime (Live Ops <5min, submission review <1h)
- `hitl_intensity`: **High** (license number submission materials / major version releases / large-scale event configuration / sensitive localization) · `regulatory_density`: Critical (license number / age rating / anti-addiction / PIPL / GDPR / payment compliance)

**Core Agent Roles**: Store Submission Automation · Compliance Review · Localization · Live Ops · Data Analytics

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.store.submit` | 35 | 85 | Submission materials require mandatory manual final review; zero tolerance for license-number-related content |
| `tool.compliance.check` | 40 | 90 | Anti-addiction / payment compliance / privacy policy auto-validation + manual re-review |
| `tool.localization.translate` | 20 | 45 | Routine text auto-executed; culturally sensitive / legal text requires mandatory manual review |
| `tool.liveops.config` | 25 | 65 | Large-scale event configuration requires dual approval from product + operations |

**DomainEvalFramework**: Submission first-pass approval rate (>90% target) · DAU/retention rate (version health) · Event participation rate · ASO ranking (store optimization effectiveness) · LQA bug density (localization quality)

**HITL Strategy**: License number submission materials, major version releases, and large-scale event configuration are mandatory manual approval checkpoints. Sensitive-region localization content requires dual sign-off from local legal + cultural consultants. Payment-related configuration changes require financial compliance confirmation. Routine Live Ops events can go live automatically; anomalous metrics trigger manual intervention.

**Key Guardrails**: Multi-region age-rating compliance matrix (auto-matches target market regulations) · Anti-addiction real-name authentication chain validation · Payment compliance multi-currency audit · Localization culturally sensitive word library (religion / politics / history) · Version rollback hot-standby mechanism (auto-triggered by anomalous metrics)

**Agent Workflows (Detailed)**:

- Submission Automation Agent: Material preparation → Platform spec adaptation (App Store / Google Play / Steam / TapTap) → Auto-submit → Status tracking → Rejection analysis & resubmission
- Compliance Review Agent: License number material preparation → Age rating assessment (ESRB / PEGI / CERO) → Content sensitivity check → Compliance gap report
- Localization Agent: UI translation → Voice-over coordination → Cultural adaptation (festivals / naming / visuals) → Terminology consistency → LQA testing
- Live Ops Agent: Version update planning → Event configuration (time-limited / seasonal / festival) → Announcements → Server management → Hotfix updates
- Data Analytics Agent: Downloads / DAU / MAU / retention / monetization / LTV → Review trends → Competitive benchmarking → Operational recommendations

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| App Stores | App Store Connect, Google Play Console, Steamworks, TapTap, Huawei AppGallery |
| Data | data.ai, Sensor Tower, GameAnalytics, Firebase, ThinkingData |
| Localization | Crowdin, Lokalise, Transifex, memoQ |
| Operations | Firebase Remote Config, LaunchDarkly, Apollo Config Center |
| CI/CD | Jenkins, Fastlane, Unity Cloud Build |

**Data Sensitivity Classification**:

- Top Secret: License number application materials, unannounced publishing plans, contracts / revenue-sharing, user payment data
- Confidential: Operational data, event configuration, A/B test results, competitive analysis
- Internal: Published store pages, public reviews, industry benchmarks

**Performance/Latency Budget**:

- Submission processing: Material preparation <1h, auto-submit <5min, status polling hourly
- Localization: UI text <24h (auto-translation + manual proofreading)
- Live Ops: Event go-live / take-down <5min (hotfix update), emergency take-down <1min
- Data analytics: Real-time dashboard <5min latency, daily report auto-generated

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Platform review rejection | Auto-classify rejection reason + solution recommendation, historical case library, rapid resubmission |
| Live Ops configuration error | Dual-person review, canary release (1% validation), emergency rollback, compensation plan |
| Localization error causing negative reviews | Feedback categorization, hotfix repair, strengthened LQA, rapid community response |
| License number approval delay | Front-load compliance risk, fallback plan (overseas-first launch), pre-review service |
| Major version causing player churn | A/B pre-validation, canary monitoring of retention, rapid rollback, communication plan |

---

# 87. Human Resources Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §17

**DomainDescriptor Mapping**:

- `domain_id`: `human-resources` · `recipe_archetype`: CRUD-heavy + Compliance
- `risk_level`: High · `latency_tier`: near-realtime (resume screening <5s) + batch (payroll calculation <2h)
- `hitl_intensity`: **Very High** (Offer / termination / performance rating / compensation adjustment / org structure changes) · `regulatory_density`: Critical (Labor Law / Labor Contract Law / PIPL / GDPR / EU AI Act)

**Core Agent Roles**: Recruitment · Onboarding · Performance Analytics · Compensation Modeling · Compliance Monitoring

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.hr.resume_screen` | 35 | 80 | Screening results serve as recommendation ranking only; auto-rejection prohibited; HR review required |
| `tool.hr.offer_generate` | 40 | 95 | Offer content requires mandatory HRBP + legal dual approval before issuance |
| `tool.hr.payroll_calc` | 45 | 90 | Payroll calculation results require Finance + HR dual sign-off; anomalous deviations auto-blocked |
| `tool.hr.compliance_check` | 30 | 70 | Contract clause compliance auto-validated; risk clauses require manual review |

**DomainEvalFramework**: Time-to-Hire · Offer acceptance rate · Compensation fairness index (gender / age / ethnicity dimensions) · Labor arbitration case count (trend monitoring) · Bias audit pass rate (EU AI Act compliance)

**HITL Strategy**: Offer issuance, termination decisions, performance ratings, compensation adjustments, and org structure changes all require mandatory manual decision-making. The resume screening Agent provides ranking suggestions only; final interview invitations are confirmed by HR. EU AI Act requires high-risk AI system transparency; all algorithmic decisions must be explainable.

**Key Guardrails**: Bias detection pipeline (protected attribute anonymization for gender / age / education + fairness metric monitoring) · Compensation data encrypted isolation (least-privilege access) · Employee data PIPL/GDPR-compliant storage and deletion · Termination decision audit logs tamper-proof · Algorithmic decision explainability reports auto-generated

**Agent Workflows (Detailed)**:

- Recruitment Agent: Requirements gathering → JD generation → Resume screening & scoring → Interview coordination → Question generation → Evaluation summary → Offer approval
- Onboarding Agent: Document collection → IT account provisioning → Training plan → Mentor matching → Probation goals → Experience tracking
- Performance Analytics Agent: OKR/KPI assistance → Data collection → 360-degree summary → Performance calibration recommendations → Improvement plan
- Compensation Modeling Agent: Market benchmarking → Salary band model → Raise / bonus simulation (budget + fairness) → Report
- Compliance Monitoring Agent: Labor contract expiration tracking → Social insurance & housing fund → Working hours management → Leave balance → Risk alerts

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| HCM/HRIS | Workday, SAP SuccessFactors, Oracle HCM, Beisen, Yonyou HR Cloud, DingTalk |
| Recruitment | LinkedIn Recruiter, Boss Zhipin, Liepin, Greenhouse, Lever |
| Compensation Data | Mercer, Aon/Radford, CIIC Compensation, LinkedIn Salary |
| Learning | Cornerstone, Yunxuetang, Kuxueyuan, LinkedIn Learning |
| E-Signature | DocuSign, Fadada, e-Sign |

**Data Sensitivity Classification**:

- Extremely Sensitive (PII+): National ID number, bank account, compensation, medical examination, background check, disciplinary action
- Confidential: Performance evaluation, promotion candidates, org restructuring, labor arbitration
- Internal: Org chart, job descriptions, training catalog, attendance summary

**Performance/Latency Budget**:

- Resume screening: Single resume <5s, batch (1,000 resumes) <30min
- Payroll calculation: Monthly calculation <2h (batch), individual query <3s
- Compliance check: Contract expiration alert 30 days in advance, overtime limit real-time alert
- Onboarding: IT account <1h, training plan <5min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Resume screening bias | Periodic bias audit, multi-dimensional evaluation, manual review of low-score samples |
| Payroll calculation error | Dual-track verification, outlier flagging, pre-disbursement spot check |
| Labor contract expired without renewal | 90/60/30-day three-tier alert, auto-renewal trigger, legal escalation |
| Employee data breach | Field-level encryption, access audit, anomaly alert, incident response plan |
| Performance evaluation dispute | Appeal process trigger, full data retrospective, independent review committee |

---

# 88. Supply Chain and Logistics Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data in `v3.0-domain-research.md` §18

**DomainDescriptor Mapping**:

- `domain_id`: `supply-chain` · `recipe_archetype`: Logistics + Analytics
- `risk_level`: High · `latency_tier`: near-realtime (route rerouting <30s) + batch (demand forecast daily)
- `hitl_intensity`: **High** (large-value procurement / new supplier onboarding / customs anomalies / hazardous goods transport / supply chain disruption response) · `regulatory_density`: High (Customs Law / Export Control / Hazardous Goods Transport / ESG)

**Core Agent Roles**: Demand Forecasting · Inventory Optimization · Route Planning · Supplier Evaluation · Customs Compliance

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.scm.forecast` | 20 | 35 | Forecast results auto-feed into inventory system; anomalous fluctuations trigger alert for manual review |
| `tool.scm.inventory_optimize` | 30 | 60 | Routine replenishment auto-executed; large-value purchase orders require mandatory approval |
| `tool.scm.route_plan` | 25 | 70 | Hazardous goods transport routes require mandatory manual review; routine routes auto-executed |
| `tool.scm.customs_declare` | 40 | 90 | HS code classification requires customs specialist confirmation; export-controlled goods require mandatory compliance review |

**DomainEvalFramework**: MAPE/WMAPE (demand forecast accuracy) · Inventory turnover rate · On-Time In-Full delivery rate (OTIF) · HS classification accuracy · Tariff optimization savings (tax optimization under compliance)

**HITL Strategy**: Large-value procurement decisions, new supplier onboarding evaluations, customs anomaly handling, hazardous goods transport approvals, and supply chain disruption emergency response are mandatory manual decision checkpoints. Routine replenishment and route planning auto-execute within thresholds; exceeding thresholds auto-escalates to supply chain manager. Export control list matching results have zero tolerance; mandatory compliance officer sign-off.

**Key Guardrails**: Export control entity list real-time sync (BIS / OFAC / EU) · Hazardous goods transport compliance matrix (UN number + transport mode cross-validation) · Supplier ESG score continuous monitoring · Demand forecast anomalous fluctuation circuit breaker (prevents bullwhip effect amplification) · Customs declaration data tamper-proof audit chain

**Agent Workflows (Detailed)**:

- Demand Forecasting Agent: Historical + trend + promotions + weather/holidays → Forecast models (ARIMA / Prophet / DeepAR) → Multi-level forecast → Safety stock recommendations
- Inventory Optimization Agent: Forecast + supply constraints → Reorder point / EOQ / safety stock → Multi-warehouse transfers → Turnover vs. service level balancing
- Route Planning Agent: Order pool → Constraint modeling (vehicles / time windows / traffic / cost) → VRP solver → Dispatch → Real-time rerouting
- Supplier Evaluation Agent: Multi-dimensional evaluation (quality / delivery / price / responsiveness / ESG) → Risk analysis (financial / geopolitical / single-source) → Procurement support
- Customs Compliance Agent: HS code classification → Tariff calculation → Origin verification → Sanctions screening → Customs declaration → Trade agreement optimization

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| ERP/SCM | SAP SCM/IBP, Oracle SCM Cloud, Blue Yonder, Kingdee/Yonyou Supply Chain |
| WMS | Manhattan, Blue Yonder WMS, SAP EWM, FLUX WMS |
| TMS | Oracle TMS, SAP TM, G7, YMM/Huochebang |
| Forecasting | Amazon Forecast, Vertex AI, Prophet, In-house ML |
| Customs | Descartes, Thomson Reuters, Single Window (China Customs) |
| IoT | GPS / Temperature-Humidity Sensors, RFID, Alibaba Cloud / AWS IoT |

**Data Sensitivity Classification**:

- Confidential: Supplier contracts / pricing, procurement costs, inventory strategy, forecast models
- Business Sensitive: Inventory levels, logistics routes, warehouse layouts, supplier evaluations
- Regulated: Customs declarations, certificates of origin, hazardous goods transport records (5–10 year retention)
- IoT: GPS trajectories, temperature-humidity — may involve location privacy

**Performance/Latency Budget**:

- Demand forecasting: Daily batch; sudden-event-triggered instant recalculation <30min
- Inventory optimization: Daily replenishment recommendations; emergency replenishment <1h
- Route planning: Initial plan <5min (hundreds of orders); real-time rerouting <30s
- Customs declaration: Single entry <10min; batch at hourly scale
- IoT monitoring: Anomaly alert <1min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Severe demand forecast deviation | Forecast vs. actual monitoring, deviation alert, manual correction, safety stock buffer |
| Supply chain disruption | Multi-source supply, pre-positioned safety stock, alternate supplier activation, emergency logistics |
| Route anomaly causing delay | Real-time GPS, dynamic rerouting, preset contingency routes, customer notification |
| HS code classification error | Multi-model cross-validation, historical comparison, customs advance ruling, customs broker review |
| Warehouse physical inventory mismatch | Cycle / perpetual counting, RFID auto-counting, discrepancy alert, freeze & investigate |

---

# 89. Healthcare Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §19

**DomainDescriptor Mapping**:

- `domain_id`: `healthcare` · `recipe_archetype`: Compliance + Conversational
- `risk_level`: Critical · `latency_tier`: realtime (triage <5s, drug check <2s) + batch (imaging analysis <5min)
- `hitl_intensity`: **Highest** (all diagnostic recommendations/prescriptions/imaging reports must be confirmed by a licensed physician) · `regulatory_density`: Critical (Medical Device Supervision Regulations/HIPAA/FDA SaMD/EU MDR/NMPA)

**Core Agent Roles**: Clinical Decision Support · Intelligent Triage · Medical Record Analysis · Drug Interaction Check · Medical Imaging Analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.clinical.diagnose` | 50 | 99 | Never automatically output diagnostic conclusions; mandatory licensed physician review |
| `tool.triage.assess` | 40 | 85 | High-risk triage levels require mandatory manual review; low-risk may use assisted automation |
| `tool.drug.interaction_check` | 35 | 90 | All contraindications/severe interactions require mandatory pharmacist confirmation |
| `tool.imaging.analyze` | 45 | 95 | Imaging reports serve only as auxiliary reference; must be issued by a radiologist |

**DomainEvalFramework**: Diagnostic sensitivity/specificity · Lesion detection recall (zero tolerance for missed detections) · Drug interaction recall · Triage concordance rate (compared with senior physicians) · Imaging analysis false-negative rate

**HITL Strategy**: **All clinical decision outputs must be confirmed by a licensed physician before being used for patient diagnosis and treatment** — this domain shares the highest HITL requirements alongside the Legal domain. Diagnostic recommendations · Prescription issuance · Imaging reports · Triage classification · Drug regimens all require mandatory human review. The Agent provides only "clinical decision support information," not "medical diagnoses."

**Key Guardrails**: High-sensitivity-first strategy (prefer false positives over missed detections) · Drug interaction multi-source database cross-validation · End-to-end encryption and minimal access for patient data · Imaging analysis confidence threshold below 95% forces manual review · Emergency scenario circuit breaker fallback to human channel

**Agent Workflows (Detailed)**:

- Clinical Decision Support Agent: Medical record ingestion → Structured extraction → Clinical reasoning → Guideline matching (UpToDate/clinical pathways) → Differential diagnosis ranking → Physician review
- Intelligent Triage Agent: Symptom self-report → Standardized inquiry → ESI/Manchester assessment → Triage level → Department routing
- Medical Record Analysis Agent: Unstructured medical record NLP extraction (diagnosis/medications/surgery/allergies) → Timeline → Missing/contradictory information → Structured summary
- Drug Interaction Agent: Medication list + new prescription → DrugBank/MCDEX → Interaction severity → Hepatic/renal contraindications → Dosage reasonableness
- Imaging Analysis Agent: DICOM reception → Pre-trained model (lung nodules/fractures/fundus) → Suspicious region annotation → Draft report

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| EMR | Epic, Cerner, Winning Health, DHC Software, B-Soft, OpenMRS |
| Clinical Knowledge Base | UpToDate, DXplain, China Clinical Pathways, NICE, Cochrane |
| Drug Database | DrugBank, MCDEX, Lexicomp, PASS |
| Imaging | DICOM, PACS (GE/Philips/Siemens), MONAI, 3D Slicer |
| Interoperability | HL7 FHIR R4, ICD-10/11, SNOMED CT, LOINC, DRG/DIP |

**Data Sensitivity Classification**:

- Extremely Sensitive (PHI): Patient identity, diagnoses, genomics, psychiatry/HIV/reproductive (special protection)
- Confidential: Clinical model parameters, hospital operations, interim research data, physician performance
- Internal: De-identified aggregate statistics, public guidelines, drug package inserts

**Performance/Latency Budget**:

- Emergency triage: Danger signals <5s (zero latency tolerance), full assessment <30s
- Drug interaction: Prescription verification <2s (embedded in order synchronization workflow)
- Imaging analysis: X-ray <30s, CT series <5min (GPU-accelerated)
- Clinical decision: Recommendation <10s (limited outpatient waiting time)
- Availability: 99.99% (emergency 7×24)

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Systematic missed detections in imaging | Multi-model ensemble voting, new annotated data regression, missed-detection feedback loop |
| Drug database update delay | Multi-source cross-validation, market announcement-triggered refresh |
| EMR integration interruption | Local cache of critical data, degraded manual input, automatic reconnect with catch-up sync |
| Triage inadequacy for rare emergencies | Hard-coded danger signal fallback, low-confidence mandatory manual review |
| PHI data exposure | Real-time PHI detection and de-identification, access audit, 72h regulatory notification |

---

# 90. Education and Training Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §20

**DomainDescriptor Mapping**:

- `domain_id`: `education` · `recipe_archetype`: Conversational + Creative
- `risk_level`: Medium · `latency_tier`: realtime (tutoring <3s, testing <1s) + batch (content generation)
- `hitl_intensity`: **High** (teacher review before course content goes live / subjective grading spot-checks / parental consent required for minor data usage) · `regulatory_density`: High (Minor Protection Law/FERPA/COPPA/EU AI Act)

**Core Agent Roles**: Learning Path Optimization · Content Generation · Intelligent Assessment · Intelligent Tutoring · Learning Analytics

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.edu.learning_path` | 20 | 45 | Path recommendations can auto-execute with periodic teacher review |
| `tool.edu.content_generate` | 30 | 70 | All generated content must be reviewed by a teacher before going live |
| `tool.edu.assess` | 35 | 75 | Subjective grading requires mandatory spot-checks; objective grading may be automatic |
| `tool.edu.tutor` | 25 | 60 | Real-time tutoring allowed automatically; sensitive topics trigger human intervention |

**DomainEvalFramework**: Knowledge mastery rate improvement · Grading consistency (Cohen's Kappa ≥ 0.8) · Course completion rate · Socratic guidance ratio (guiding rather than giving direct answers) · Content accuracy rate

**HITL Strategy**: Course content must be reviewed by a subject teacher before publication; strictest data protection applies to minor scenarios. Content generation · Subjective grading · Major learning path adjustments · Sensitive topic tutoring all require mandatory human intervention. Collection of personal data from minors requires explicit parental consent. The Agent is positioned as a "learning support tool," not a "teacher replacement."

**Key Guardrails**: Minor content safety filtering (zero tolerance for violence/pornography/inappropriate values) · Answer leakage prevention (guidance prioritized over direct answers) · Age-graded content strategy · Minimal data collection with parental informed consent · Academic integrity detection integration

**Agent Workflows (Detailed)**:

- Learning Path Agent: Pre-test/historical assessment → Knowledge graph → Personalized path (knowledge point sequence/difficulty/resources) → Dynamic adjustment
- Content Generation Agent: Syllabus + knowledge points → Lecture notes/exercises/cases/courseware → Multiple difficulty levels/languages → Bloom's taxonomy levels
- Assessment Agent: Question generation (multiple-choice/fill-in/subjective/programming) → Auto-grading → Personalized feedback → Weak areas → CAT
- Tutoring Agent: One-on-one dialogue → Socratic questioning → Confusion point identification → Step-by-step explanation and analogies
- Learning Analytics Agent: Learning behavior aggregation (duration/completion/errors/engagement) → Learner profile → Risk prediction → Intervention recommendations

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| LMS | Moodle, Canvas, Blackboard, XuetangX, icourse163, Coursera |
| Knowledge Graph | Neo4j, Custom subject knowledge graph, ConceptNet |
| Assessment | Gradescope, Turnitin, CodeGrader, OJ systems |
| Video/Live Streaming | Zoom SDK, Tencent Meeting, DingTalk Classroom, OBS |
| Data Analytics | xAPI/LRS, Amplitude, Custom learning analytics dashboard |

**Data Sensitivity Classification**:

- High (Minor Data): Student identity, learning behavior, grades, psychological assessments
- Confidential: Question banks (unpublished), grading criteria, teaching algorithm parameters
- Internal: Course syllabi, published materials, aggregate statistics

**Performance/Latency Budget**:

- Tutoring dialogue: Response <3s (timeout causes attention loss)
- Adaptive testing: Question recommendation <1s
- Content generation: Single knowledge point <1min, full course hour-level (async)
- Assessment grading: Objective questions instant, subjective questions <30s/essay

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Content contains factual errors | Subject knowledge base validation, teacher review workflow, learner error-reporting feedback |
| Subjective grading bias | Calibration (benchmark sample papers), low-confidence transfer to human, multi-dimensional rubrics |
| Learning path infinite loop | Mastery threshold tuning, path diversity constraints, manual skip |
| Tutoring gives direct answers | Pedagogical strategy guardrails (enforce guidance), homework scenario detection, answer filtering |
| High-concurrency exam overload | Elastic scaling, local question caching, degraded offline exam mode |

---

# 91. Customer Service Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §21

**DomainDescriptor Mapping**:

- `domain_id`: `customer-service` · `recipe_archetype`: Conversational
- `risk_level`: Medium · `latency_tier`: realtime (chat <3s, routing <1s)
- `hitl_intensity`: **Medium** (over-authority refund approval / complaint escalation / legal issues / VIP exception tickets / low-confidence transfer to human) · `regulatory_density`: Medium (Consumer Rights Protection Law/TCPA/GDPR)

**Core Agent Roles**: Multi-channel Dialogue · Intelligent Routing · Knowledge Retrieval · Quality Scoring · Escalation Management

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.cs.respond` | 20 | 40 | Routine inquiries auto-reply; low-confidence transfers to human |
| `tool.cs.route` | 15 | 25 | Auto-execute intelligent routing; VIP tickets in priority queue |
| `tool.cs.knowledge_search` | 10 | 15 | Auto-execute (auxiliary information retrieval) |
| `tool.cs.quality_score` | 25 | 55 | Quality scores for reference; appeals/disputes require human review |

**DomainEvalFramework**: CSAT (Customer Satisfaction) · FCR (First Contact Resolution) · AI independent resolution rate · Hallucination rate (strictly trending to zero) · AHT (Average Handle Time) · Escalation rate

**HITL Strategy**: Over-authority operations and high-risk scenarios require mandatory human intervention; routine inquiries allow fully automated closed-loop handling. Refunds above threshold · Legal/regulatory issues · Complaint escalation · VIP exception tickets · Confidence below threshold automatically transfer to human agents. The Agent must disclose its AI identity at the start of the conversation; users may request human service at any time.

**Key Guardrails**: Emotion detection and escalation circuit breaker (immediately transfer to human upon detecting anger/threats) · Commitment consistency verification (never promise beyond policy scope) · Multi-channel context synchronization · Sensitive information de-identification display · Refund/compensation amount tiered approval

**Agent Workflows (Detailed)**:

- Multi-channel Dialogue Agent: Channel intake (chat/phone ASR/email/social) → Intent recognition → Knowledge retrieval → Answer generation → Satisfaction confirmation → Ticket archival
- Intelligent Routing Agent: Ticket content (intent/sentiment/urgency) + Customer attributes (VIP/history/LTV) + Agent status → Optimal routing → Queuing/overflow
- Knowledge Retrieval Agent: Semantic search + exact match hybrid → Product/service knowledge base → Cited answers → Knowledge gap identification
- Quality Scoring Agent: Full-volume automated QA (compliance language/attitude/resolution/process) → Scorecard → Low-score flagging for human re-inspection
- Escalation Management Agent: Scenario detection (emotional agitation/over-authority/technical issues/complaints) → Auto-escalate to supervisor/specialist/cross-department → SLA assurance

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Omnichannel | Zendesk, Salesforce Service Cloud, Freshdesk, NetEase Qiyu, Zhichi, Udesk |
| Voice/CTI | Genesys Cloud, Avaya, Amazon Connect, Twilio Voice, Hollycrm |
| Knowledge Base | Confluence, Guru, Custom RAG (Pinecone/Milvus + LLM) |
| NLP | Intent classification, Sentiment analysis (BERT fine-tuned), ASR (iFlytek/Google) |
| CRM | Salesforce, HubSpot, Fxiaoke |

**Data Sensitivity Classification**:

- PII (High): Customer name/phone/address/account, payment/order data in conversations
- Confidential: Pricing strategy, compensation authority matrix, unreleased product plans, complaint details
- Internal: Aggregate service metrics, FAQ content, training materials

**Performance/Latency Budget**:

- Live chat: First response <3s, subsequent turns <5s
- Phone IVR: Intent recognition <2s, routing <1s
- Email: Auto-reply <30min, with human <4h
- Quality scoring: Real-time lag <5min, daily report next morning
- Knowledge retrieval: Including LLM answer <3s

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Promising a non-existent refund policy | RAG-grounded generation, policy compliance validation, commitment-type mandatory human confirmation |
| Peak system overload | Elastic scaling, queue callback, overflow to outsourced agents |
| Sentiment misjudgment causing complaint escalation | Multi-dimensional detection (text + tone), lowered negative threshold trigger |
| Knowledge base outdated | Freshness tracking, product/policy change-triggered updates, version tagging |
| Cross-channel context loss | Unified session management, omnichannel history sync, identity unification |

---

# 92. Content Moderation and Safety Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §22

**DomainDescriptor Mapping**:

- `domain_id`: `content-moderation` · `recipe_archetype`: Moderation + Adversarial
- `risk_level`: High · `latency_tier`: realtime (text <500ms, image <1s, video <30s)
- `hitl_intensity`: **High** (appeal adjudication / CSAM cases / borderline cases / policy changes), reviewer mental health protection · `regulatory_density`: Critical (Cybersecurity Law / Section 230 / DSA / CSAM mandatory reporting)

**Core Agent Roles**: Multimodal Moderation · Policy Engine · Appeal Handling · Adversarial Detection · Compliance Reporting

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.moderation.classify` | 30 | 65 | Clear violations auto-actioned; borderline cases require mandatory human review |
| `tool.moderation.appeal` | 40 | 85 | All appeal adjudications require final review by a human reviewer |
| `tool.adversarial.detect` | 35 | 75 | Adversarial sample detection results require security team confirmation before storage |
| `tool.compliance.report` | 25 | 90 | Mandatory reporting scenarios (e.g. CSAM) escalated immediately with evidence chain locked |

**DomainEvalFramework**: Precision / Recall / F1 · Average time violating content remains online (trending to zero) · Adversarial sample detection rate · Appeal processing SLA · False positive rate (over-moderation monitoring)

**HITL Strategy**: CSAM and extreme violent content require immediate mandatory human action and legally required reporting; borderline cases enter the human review queue. Appeal adjudication · policy rule changes · new violation pattern definitions · cross-cultural sensitive content all require mandatory human review. Reviewer exposure protection mechanisms: content blurring preview · rotation policy · regular mental health assessments · exposure time limits for extreme content.

**Key Guardrails**: Multi-model cross-validation to reduce single-model bias · Continuous red-team testing against adversarial attacks · Evidence chain integrity (tamper-proof audit logs) · Jurisdiction-aware differentiated policy engine · Mandatory enforcement of reviewer mental health protections · Automatic appeal channel for false positives

**Agent Workflows (Detailed)**:

- Multimodal Moderation Agent: Content ingestion → format parsing → multi-model parallel processing (text/image/video/audio) → rule engine overlay → confidence grading → action
- Policy Engine Agent: Moderation policy management (platform/regulatory/advertiser) → version control → canary/A/B → regulation-to-rule auto-conversion
- Appeal Handling Agent: Appeal received → original content re-review → supplementary information → review recommendation (uphold/revoke/amend)
- Adversarial Detection Agent: Evasion technique identification (homophones/pinyin/text-in-image/semantic disguise) → continuous learning → automatic rule updates
- Compliance Reporting Agent: Generate reports per regulatory requirements (moderation volume/violation distribution/SLA/appeals) → regulatory liaison → evidence retention

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Text | In-house NLP (BERT fine-tuned), Alibaba Green Net, Tencent Tianyu, Perspective API |
| Image/Video | In-house CV, PhotoDNA (CSAM), AWS Rekognition, CLIP |
| Audio | ASR (iFlytek/Google/Whisper), Audio Classification |
| Policy Engine | In-house rule engine (Drools/DSL), Feature Platform, Real-time Decision |
| Regulatory Liaison | CAC Reporting Center, NCMEC CyberTipline, DSA Transparency Report |

**Data Sensitivity Classification**:

- Extremely Sensitive: CSAM — legally mandated reporting, dedicated process, strict access control
- High: Raw user content (including PII), moderation decisions, reporter information
- Confidential: Moderation policy rules (exploitable for evasion if leaked), adversarial model parameters
- Internal: Aggregated statistics, model performance, public community guidelines

**Performance/Latency Budget**:

- Pre-publish moderation: text <500ms, image <1s, short video <30s
- Throughput: hundreds of millions of items daily, elastic scaling at peak
- Adversarial response: new pattern discovery to rule deployment <4h (emergency) / <24h (routine)
- Appeals: automated re-review <1h, with human involvement <24h
- CSAM: zero latency — block on detection + immediate reporting

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| New adversarial technique causes mass bypass | Real-time sample collection, emergency hot rule update, temporarily increase strictness |
| Model update causes spike in false positives | Canary release (1%→100%), automatic rollback, A/B validation |
| Moderation system outage | Graceful degradation (queue high-risk / pass-through low-risk), multi-AZ disaster recovery |
| Human review queue backlog | Dynamic prioritization, temporary staffing expansion, AI pre-sorting acceleration |
| CSAM miss | PhotoDNA + multi-model redundancy, hash database updates, regular red-team testing |

---

# 93. IT Operations SRE/DevOps Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §23

**DomainDescriptor Mapping**:

- `domain_id`: `it-operations` · `recipe_archetype`: IncidentOps
- `risk_level`: High · `latency_tier`: realtime (alert analysis <30s, auto-remediation <2min)
- `hitl_intensity`: **High** (high-risk change CAB approval / security incident forensics / auto-remediation policy rollout / budget procurement) · `regulatory_density`: High (MLPS 2.0 / ISO 27001 / SOC 2 / PCI-DSS / NIST)

**Core Agent Roles**: Incident Response · Monitoring Analysis · Deployment Automation · Capacity Planning · Security Operations

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.ops.incident_respond` | 35 | 70 | Known Runbook auto-executed; unknown patterns require mandatory human intervention |
| `tool.ops.deploy` | 40 | 80 | Production deployments require CAB approval + canary verification |
| `tool.ops.capacity_plan` | 20 | 35 | Auto-generate planning recommendations; procurement decisions require management approval |
| `tool.ops.security_scan` | 25 | 60 | Scans auto-executed; high-severity vulnerability remediation plans require security team confirmation |

**DomainEvalFramework**: MTTR (Mean Time to Repair) · MTTD (Mean Time to Detect) · SLO achievement rate · Auto-remediation success rate · Deployment failure rate · Alert noise ratio (signal-to-noise optimization)

**HITL Strategy**: High-risk production changes require mandatory CAB approval; security incidents require mandatory security team involvement. Known faults covered by Runbooks may be auto-remediated but require post-hoc audit. Deployment rollback · security incident forensics · capacity procurement · new auto-remediation policy rollout all require mandatory human approval. Agent operational scope is strictly limited to pre-authorized resources.

**Key Guardrails**: Blast radius control (auto-remediation limited to single node/service; cross-domain operations require human approval) · Change window enforcement · Full-chain tamper-proof operation audit · Security scan results tiered response · Auto-remediation circuit breaker (consecutive failures auto-stop and alert)

**Agent Workflows (Detailed)**:

- Incident Response Agent: Alert received (Prometheus/PagerDuty) → aggregation → topology correlation → root cause hypothesis → auto-remediation (Runbook) → escalation/closure
- Monitoring Analysis Agent: Continuous metrics/logs/trace analysis → dynamic baselines → anomaly detection → alert noise reduction
- Deployment Automation Agent: CI/CD pipeline → canary release (progressive traffic + metrics monitoring) → rollback → feature flags → dependency orchestration
- Capacity Planning Agent: Historical load + growth forecasting → resource modeling → scaling recommendations → budget forecasting → waste identification
- Security Operations Agent: IDS/IPS/WAF/vulnerability scanning → threat intelligence matching → automated response (IP blocking/account lockout) → vulnerability remediation prioritization

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Monitoring | Prometheus, Grafana, Datadog, New Relic, Splunk, Zabbix |
| Logging | ELK, Loki, Splunk, Fluentd/Fluent Bit |
| Tracing | Jaeger, Zipkin, SkyWalking, Datadog APM |
| Incident Management | PagerDuty, OpsGenie, VictorOps |
| Deployment/IaC | Kubernetes, ArgoCD, Terraform, Ansible, Helm |
| Security | CrowdStrike, Snort/Suricata, Cloudflare WAF, Nessus/Qualys |

**Data Sensitivity Classification**:

- Extremely Sensitive: Production credentials (SSH/API Key/database passwords), vulnerability details, penetration test results
- Confidential: System architecture topology, IP ranges, capacity data, incident post-mortems, security policies
- Internal: Aggregated performance metrics, deployment history, public monitoring dashboards
- Logs: May contain PII (requires anonymization), subject to retention/audit constraints

**Performance/Latency Budget**:

- Alert response: trigger to Agent analysis <30s, auto-remediation <2min
- Monitoring collection: metrics at 15–60s intervals, logs <10s latency
- Deployment: CI build + test <15min, canary observation window configurable
- Security detection: real-time intrusion <1s, vulnerability scans daily/weekly
- Monitoring system availability: 99.99%

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Auto-remediation triggers cascading failure | Blast radius limiting, reversible operations, only N% of instances per action, circuit breaker |
| Alert storm overwhelms response | Aggregation and deduplication, topology-aware suppression, dynamic suppression rules |
| Canary fails to detect slow-burn defect | Multi-dimensional metrics monitoring, extended observation window, Sticky Canary |
| Monitoring system itself fails | Independent meta-monitoring, multi-path alerting (SMS/phone/IM) |
| Security incident credential leak | Automatic credential rotation, Vault/KMS, immediate revocation and re-issue on leak |

---

# 94. Marketing and Branding Domain Architecture

> Related: §37 Business Domain Modeling · §23 Compliance · §11 Security · §45 Harness Runtime
> Detailed research data available in `v3.0-domain-research.md` §24

**DomainDescriptor Mapping**:

- `domain_id`: `marketing` · `recipe_archetype`: Analytics + Creative
- `risk_level`: Medium · `latency_tier`: near-realtime (sentiment <15min) + batch (Campaign reports)
- `hitl_intensity`: **Medium** (brand communication content approval / marketing budget approval / brand crisis PR takeover / legal risk content legal review) · `regulatory_density`: Medium (Advertising Law / Internet Advertising Administrative Measures / FTC / GDPR / CAN-SPAM)

**Core Agent Roles**: Campaign Orchestration · Brand Monitoring · SEO/SEM Optimization · Social Media Management · Customer Segmentation Analysis

**DomainRiskProfile Override**:
| Operation | Platform Default Risk | Domain Override Risk | Result |
| --- | --- | --- | --- |
| `tool.marketing.campaign` | 25 | 55 | Ad placement strategy auto-optimized; budget exceeding threshold requires approval |
| `tool.brand.monitor` | 15 | 30 | Sentiment monitoring auto-executed; crisis signals trigger immediate alert |
| `tool.seo.optimize` | 20 | 35 | Keyword and content optimization suggestions auto-executed |
| `tool.social.publish` | 30 | 70 | All outbound content must be reviewed by brand team before publishing |

**DomainEvalFramework**: ROAS (Return on Ad Spend) · CPA/CPL · Brand SOV (Share of Voice) · Engagement rate · Crisis early-warning accuracy · Content compliance pass rate

**HITL Strategy**: All externally published content requires mandatory brand team review; brand crisis events trigger immediate PR team takeover. Marketing budget changes · brand partnership approvals · legal risk content legal review · crisis PR statements all require mandatory human approval. Data analysis · sentiment monitoring · SEO recommendations may auto-execute. Agent-generated content serves only as drafts for human refinement.

**Key Guardrails**: Advertising law compliance auto-detection (superlative claims / false advertising / comparative advertising) · Brand tone consistency checks · Competitive data collection compliance boundaries · User profile data anonymization · Tiered crisis sentiment response playbooks · Marketing email unsubscribe compliance (CAN-SPAM/GDPR)

**Agent Workflows (Detailed)**:

- Campaign Orchestration Agent: Marketing objectives → cross-channel plan (timeline/channels/budget/audience) → content coordination → performance monitoring → dynamic adjustment
- Brand Monitoring Agent: Full-web brand mention monitoring (social/news/forums/short video) → sentiment analysis / topic clustering → crisis detection → brand health report
- SEO/SEM Agent: Ranking + traffic analysis → keyword research → content optimization + technical SEO → SEM bidding → ranking monitoring
- Social Media Agent: Multi-platform publishing (WeChat Official Account / Weibo / Douyin / Xiaohongshu / LinkedIn) → content adaptation → publish timing → engagement management
- Customer Segmentation Agent: Multi-source data (CRM/behavioral/transactional/social) → clustering + RFM → high-value audiences → targeted recommendations

**Key Tools/Integrations**:
| Category | Specific Tools |
| ---- | ---- |
| Marketing Automation | HubSpot, Marketo, Pardot, JINGdigital, JINGsocial |
| Social Media | WeChat Official Account Platform, Weibo, Douyin/Ocean Engine, Xiaohongshu, Hootsuite |
| SEO/SEM | Google Search Console, SEMrush, Ahrefs, Baidu Search, 5118 |
| Sentiment Monitoring | Qingbo Big Data, Newrank, Brandwatch, Meltwater |
| Data/Analytics | GA4, Adobe Analytics, Sensors Data, GrowingIO |

**Data Sensitivity Classification**:

- PII (High): Customer contact information, behavioral profiles, CRM transaction records and preferences
- Confidential: Brand strategy, unreleased launch plans, marketing budgets, competitive analysis
- Internal: Content calendar, A/B test plans, aggregated marketing metrics

**Performance/Latency Budget**:

- Sentiment monitoring: negative detection <15min (golden response window), routine hourly
- Social publishing: content generation <5min per post, image/video on the order of hours
- SEO: ranking tracking daily, technical audit weekly
- Campaign reporting: near-realtime <15min latency
- Customer segmentation: batch daily, trigger-based <5min

**Common Failures and Recovery**:
| Failure Mode | Recovery Strategy |
| ---- | ---- |
| Auto-publish during sentiment crisis | Crisis detection pauses all channels, notify PR team, activate response playbook |
| Content violates advertising law | Pre-publish compliance scan (superlatives/false claims), legal review flow |
| SEO strategy triggers search penalty | White-hat SEO guardrails, ranking anomaly monitoring, penalty recovery process |
| Attribution model distortion | Multi-attribution model comparison, incremental testing calibration |
| Cross-platform publish failure | Queue retry, format auto-adaptation, multi-platform status monitoring |

---


# Part V -- Intelligent Interaction Layer (S39-S44)

---

# 39. Natural Language Task Entry Architecture

> Enables non-technical users to interact with the platform directly through natural language, replacing handwritten JSON/API calls.
> Related: §6 API Contract · §13 OAPEFLIR · §37 Business Domain Modeling · §40 Goal Decomposition · §44 Non-Technical User Experience

## 39.1 Design Principles

- Natural language is a **first-class interaction method**, on par with REST API, not syntactic sugar on top of API
- All NL interactions ultimately convert to standard `RequestEnvelope`(§5.3), reusing existing control plane and execution plane
- Ambiguity must be explicitly resolved; do not guess user intent — better to ask one more question than to mistakenly execute a high-risk action
- Conversation context persisted to Memory(§29.2), recoverable across sessions

## 39.2 NL Interaction Pipeline

```text
User input (natural language)
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Intent Parser │────▶│ Domain Router│────▶│ Task Builder │
│ (intent recog)│     │ (domain route)│     │ (task build)  │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
    ┌──────────────┐     ┌──────────────┐        │
    │ Clarification│◀────│ Ambiguity    │◀───────┘
    │ Dialog       │     │ Detector     │   loop on ambiguity
    └──────┬───────┘     └──────────────┘
           │ user confirms
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Risk Preview │────▶│ RequestEnvelope│──▶ P1 Interface Plane
    │ (risk preview)│     │ (standard contract)│
    └──────────────┘     └──────────────┘
```

## 39.3 Core Components

| Component | Responsibility |
| --- | --- |
| IntentParser | Parses user natural language input, extracts intent labels and confidence |
| TaskSpecBuilder | Maps structured intent to TaskSpec(§6), filling domain, parameters, and constraints |
| AmbiguityResolver | Generates clarification questions when confidence is below threshold, strategy in §39.4 |
| ContextEnricher | Injects user role, conversation history, domain context, and other environmental info |
| ResponseFormatter | Converts execution results into user-friendly natural language replies or structured cards |

## 39.4 Ambiguity Resolution Strategy

| Ambiguity Type | Example | Resolution Method |
| --- | --- | --- |
| Domain ambiguity | "Generate a report" | Ask "Financial report or advertising report?" |
| Scope ambiguity | "Clean up expired data" | Ask "Which domain's data? Time range?" |
| Risk ambiguity | "Update product prices" | Show risk preview + confirm "This will affect X products online" |
| Time ambiguity | "ASAP" | Map to urgency=high, inform estimated completion time |
| Permission ambiguity | "Approve these requests for me" | Check permissions, if unauthorized prompt "You don't have approval permission, need to forward to X" |

## 39.5 Multi-Turn Dialogue State Machine

```text
         ┌─────┐
         │ Idle │◀──────────────────────────┐
         └──┬──┘                            │
            │ user input                    │ task complete/cancel
            ▼                               │
    ┌───────────────┐                       │
    │ Intent Parsing │                      │
    └───────┬───────┘                       │
            │                               │
     ┌──────┴──────┐                        │
     │ambiguous?    │                        │
     ▼ Yes         ▼ No                     │
┌──────────┐  ┌──────────┐                  │
│Clarifying│  │ Building │                  │
│(asking)   │  │(build task)│                  │
└────┬─────┘  └────┬─────┘                  │
     │ user answers   │                       │
     └──────┬──────┘                        │
            ▼                               │
    ┌───────────────┐                       │
    │ Confirming    │                       │
    │(risk preview+confirm)│                       │
    └───────┬───────┘                       │
            │ user confirms                  │
            ▼                               │
    ┌───────────────┐     ┌────────────┐    │
    │ Executing     │────▶│ Reporting  │────┘
    │ (executing)   │     │ (results)   │
    └───────────────┘     └────────────┘
```

## 39.6 Security Constraints

- All NL entry outputs must pass Prompt Injection protection(§16.5)
- High-risk intents (risk ≥ high) **must** be explicitly confirmed; NL cannot directly trigger them
- Conversation history is subject to data classification(§11.6) constraints; confidential/restricted content is not echoed back
- NL entry permissions are equivalent to the caller's API permissions; no privilege escalation

## 39.7 Multilingual and Internationalization (i18n)

| Layer | i18n Strategy |
| --- | --- |
| Intent Parser | Multilingual intent recognition: invoke multilingual LLM via ModelGateway(§15); route to corresponding locale Prompt template after language detection |
| Clarification Dialog | Response language follows user input language (auto-detect), or follows `preferred_locale` setting in user profile |
| Risk Preview | Risk descriptions, cost estimates use user locale currency/date format |
| NL Status Summary(§43) | Dashboard summaries generated per user locale; amounts/dates/numbers follow ICU format |
| Error Messages | Platform standard error codes mapped to multilingual message catalog; fallback language is en-US |

---

# 40. Goal Decomposition Engine Architecture

> Adds a Goal → Task decomposition layer on top of OAPEFLIR(§13), enabling users to describe business goals rather than individual tasks.
> Related: §13 OAPEFLIR · §19 Agent Delegation · §37 Business Domain Modeling · §39 NL Entry · §41 Proactive Agent

## 40.1 Three-Layer Decomposition Model

```text
Goal (business objective)
  "Launch spring marketing campaign for product X"
    │
    ▼  GoalDecomposer
Task (domain task)                              ← new layer
  ├── [content-production] Create 3 sets of ad creatives
  ├── [advertising] Configure and launch ad campaign
  ├── [data-analysis] Set up ROI tracking dashboard
  └── [legal] Review ad compliance
    │
    ▼  OAPEFLIR Planner (§13)
Step (execution step)                           ← existing layer
  ├── tool.design.generate_creative
  ├── tool.ad_platform.create_campaign
  └── ...
```

## 40.2 GoalDecomposer Interface

Core method `decompose(goal, constraints) → TaskGraph`, decomposes high-level goals into an executable task dependency graph.

| Parameter/Feature | Description |
| --- | --- |
| goal | Structured goal description, containing goal text, owning domain, and priority |
| constraints | Decomposition constraints: max depth (default 5), budget cap (§18), deadline |
| Return value | TaskGraph — nodes are TaskSpec(§6), edges are dependency relationships |
| Cycle detection | Automatic topological sort during TaskGraph construction; reject and report error if cycle detected |
| Budget allocation | Allocate total budget to nodes proportionally by estimated sub-task cost |

## 40.3 Decomposition Strategies

| Strategy | Applicable Scenario | Mechanism |
| --- | --- | --- |
| **Template matching** | Goal matches existing DomainRecipe(§37.7) or cross-domain template | Directly instantiate template, fill parameters |
| **LLM planning** | No matching template for new scenario | Invoke ModelGateway(§15) for decomposition, constrained by DomainDescriptor |
| **Hybrid** | Partial match | Template skeleton + LLM fills missing parts |
| **Human-assisted** | Confidence < 0.7 or involves critical risk | Generate preliminary decomposition, request human review and adjustment |

## 40.4 Cross-Domain Dependency Graph Management

```text
[content-production]──▶[legal]──▶[advertising]──▶[data-analysis]
     creative production    compliance review   campaign launch       performance tracking
         │                                  │
         └──────────parallel────────────────┘
                 (creative production and campaign config can run in parallel)
```

- Dependency graph auto-topologically sorted, identifying parallelizable tasks
- **Cycle dependency detection**: After decomposition, perform DAG validation on dependency_graph; if cycle detected, reject execution and return cycle path to user/GoalDecomposer for retry
- Critical path calculation, estimate total duration
- When a single Task fails, decide based on dependency type: `blocks` → block downstream, `soft_dependency` → alert but continue
- Cross-domain data transfer follows DomainInteractionPolicy(§37.8)

## 40.5 Goal Lifecycle

| State | Description | Can Transition To |
| --- | --- | --- |
| draft | Goal created, not yet decomposed | decomposing, cancelled |
| decomposing | Being decomposed into Tasks | decomposed, failed |
| decomposed | Decomposition complete, awaiting confirmation | executing, cancelled |
| executing | Tasks being executed | completed, partially_completed, failed |
| completed | All Tasks + success criteria met | archived |
| partially_completed | Some Tasks completed, some failed | executing(retry), completed, cancelled |
| failed | Decomposition or execution failed | decomposing(retry), cancelled |
| cancelled | User cancelled | archived |

---

# 41. Proactive Agent Framework

> Enables Agents to proactively initiate tasks based on event triggers and scheduled jobs, rather than only responding to API calls.
> Related: §4.2 P1 Interface Plane · §20 Long-term Tasks · §37 Business Domain Modeling · §40 Goal Decomposition

## 41.1 Design Principles

- Proactive Agents are **controlled automation**, not unconstrained autonomous behavior
- All triggers must be declared in DomainDescriptor(§37); undeclared triggers cannot be registered
- Tasks generated by triggers go through the **exact same risk control pipeline**(§10) as API-created tasks
- Costs from proactive behavior are charged to the corresponding domain's budget(§18)

## 41.2 Trigger Model

Each trigger is described by `TriggerDefinition`, which must be declared in DomainDescriptor(§37) when registered:

| Field | Type | Description |
| --- | --- | --- |
| triggerId | string | Globally unique identifier |
| type | schedule / event / condition / webhook | Trigger method: scheduled, event-driven, condition expression, external callback |
| filter | object | Event filter condition or cron expression |
| cooldown | duration | Minimum trigger interval, prevents high-frequency repeated triggers |
| maxFireCount | number \| null | Maximum trigger count, null means unlimited |
| boundAgentId | string | Bound execution Agent, processes task after trigger fires |

## 41.3 Trigger Modes

| Mode | Behavior | Applicable Scenario | Risk Control |
| --- | --- | --- | --- |
| **Auto-execute** | Directly create task after trigger | Low-risk scheduled tasks (daily report, data sync) | require_confirmation=false + risk_level=low |
| **Suggestion mode** | Push suggestion to user after trigger, execute after user confirms | Medium-high risk event response (CTR drop → suggest bid adjustment) | require_confirmation=true |
| **Silent recording** | Only record event and analysis results after trigger, no proactive notification | Data accumulation (user behavior pattern identification) | action_type=update_dashboard |

## 41.4 Trigger Storm Protection

- **max_fire_rate**: Each trigger has maximum fire frequency; exceeding auto-degrades to silent recording
- **cooldown**: Forced cooldown between two fires, prevents repeated execution
- **batch_window**: Event triggers can configure batch window, merging multiple events within short timeframe into one trigger
- **circuit_breaker**: After N consecutive trigger task failures, auto-disable trigger and alert
- **Global trigger budget**: Each domain has daily maximum auto-trigger count, prevents runaway

## 41.5 Proactive Suggestion Pipeline

```text
Trigger fires
    │
    ▼
┌────────────────┐     ┌──────────────┐
│ Context Builder │────▶│ Suggestion   │
│ (context build) │     │ Generator    │
└────────────────┘     └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │ Suggestion   │
                       │ Queue        │──▶ User dashboard(§43) / Push notification
                       └──────┬───────┘
                              │ user confirms
                       ┌──────▼───────┐
                       │ Task/Goal    │──▶ Standard execution pipeline
                       │ Creator      │
                       └──────────────┘
```

---
# 42. Progressive Autonomy Model

> Drives dynamic promotion/demotion of Agent autonomy based on historical performance data, reducing human supervision burden.
> Related: §10 Risk Control · §17 Model Evaluation · §21 Human-Machine Collaboration · §37.2 DomainCapability · §41 Proactive Agent

## 42.1 Trust Score Model

Each Agent maintains a `TrustScore` record that drives autonomy level(§42.2) promotion and demotion:

| Field | Type | Description |
| --- | --- | --- |
| agentId | string | Associated Agent's unique identifier |
| currentScore | number (0-1000) | Current trust score, accumulated from execution success/failure/override events |
| level | suggestion / supervised / semi_auto / full_auto | Current autonomy level, mapped from score range |
| historyWindow | duration (default 90d) | Sliding window length for score calculation |
| decayRate | number (default 0.05) | Per-period decay coefficient during inactivity, see §42.3 |

## 42.2 Autonomy Promotion/Demotion Rules

**Default Promotion Ladder**:

| Current Level | Promote To | Conditions | Approval |
| --- | --- | --- | --- |
| suggestion | supervised | ≥ 50 executions + success rate ≥ 95% + 0 incidents (30d) | domain_owner |
| supervised | semi_auto | ≥ 200 executions + success rate ≥ 98% + human override rate < 5% + 0 incidents (60d) | domain_owner |
| semi_auto | full_auto | ≥ 500 executions + success rate ≥ 99% + human override rate < 1% + 0 incidents (90d) | platform_team |

**Instant Demotion Triggers**:

| Event | Demotion Action | Recovery Condition |
| --- | --- | --- |
| Caused P0 Incident | Directly demote to suggestion | Human investigation + platform_team approval |
| Caused P1 Incident | Demote one level | 30d with no incidents |
| 3 consecutive failures | Demote one level | 10 consecutive successes |
| Cost exceeds budget 200% | Demote to supervised | Budget adjustment + domain_owner confirmation |

## 42.3 Trust Score Decay Mechanism

Long-idle Agents' trust scores should gradually decay, preventing historically high-trust Agents from retaining excessive autonomy after behavioral environment changes:

| Inactivity Duration | Decay Behavior | Description |
| --- | --- | --- |
| 30d no execution | trust_score × 0.95 | Light decay, trigger reminder |
| 60d no execution | trust_score × 0.80 | Moderate decay, autonomy frozen at current level (cannot promote) |
| 90d no execution | Demote one level + trust_score reset to target level floor | Must re-accumulate execution records to recover |
| 180d no execution | Demote to suggestion | Agent treated as "dormant", requires domain_owner re-activation |

Decay evaluation runs daily by `TrustDecayWorker`, changes recorded as `agent.autonomy.decayed` event to event_log(§28). domain_owner can adjust decay parameters or exempt specific Agents via DomainGovernancePolicy(§37.9).

## 42.4 Autonomy Change Audit

All autonomy changes are recorded to event_log(§28):

## 42.5 Integration with Existing Architecture

| Existing Component | Integration Method |
| --- | --- |
| §10 Risk Control | trust_score serves as a modulating factor for risk_score — same action has lower risk for high-trust Agents |
| §17 Model Evaluation | eval quality degradation auto-triggers trust demotion |
| §21 HITL | Autonomy determines HITL mode — suggestion level must have human confirmation, full_auto level executes silently |
| §37.2 DomainCapability | `max_automation_level` serves as ceiling — trust cannot exceed domain-set upper limit |
| §41 Proactive Agent | Only semi_auto and above allows auto-executing triggers; otherwise uses suggestion mode |

---

# 43. Unified Operations Dashboard Architecture

> Provides layered operations views from solo operators to enterprise-scale organizations, replacing infrastructure-level metrics aimed at SREs.
> Related: §12 Exception Events · §18 Cost Management · §27 SLO · §37.9 Governance · §42 Autonomy

## 43.1 Dashboard Layering

```text
┌─────────────────────────────────────────┐
│  L1 Operator View (solo operator / biz lead)    │  "Is everything OK? What needs my attention?"
├─────────────────────────────────────────┤
│  L2 Domain Admin View (dept Agent admin)        │  "What Agents does my domain have? How are they performing?"
├─────────────────────────────────────────┤
│  L3 Platform Ops View (platform SRE team)       │  "Infrastructure healthy? Resource utilization?"
├─────────────────────────────────────────┤
│  L4 Fleet Management View (enterprise platform team)│  "Which department has issues? Global capacity?"
└─────────────────────────────────────────┘
```

## 43.2 L1 Operator View

Business-oriented view for non-technical users:

| Panel | Content | Refresh Rate |
| --- | --- | --- |
| My Task Status | In-progress / completed / failed task list with progress percentage | Real-time |
| Recent Results | Summary and output links for tasks completed in last 24h | 5min |
| Pending Approvals | Approval requests requiring current user confirmation, sorted by urgency | Real-time |
| Agent Health | Availability and current autonomy level(§42) of domain Agents | 1min |
| Budget Overview | Current month usage / remaining quota(§18) | 1h |

## 43.3 L2 Domain Admin View

Domain operations view for department Agent administrators:

| Panel | Content | Refresh Rate |
| --- | --- | --- |
| Domain Task Throughput | Hourly/daily task submission and completion count trend chart | 5min |
| Agent Utilization | Execution share, queue depth, idle rate per Agent in domain | 1min |
| Domain SLO Achievement | P50/P95 latency, success rate vs DomainDescriptor(§37) SLO | 5min |
| Top Failed Tasks | Task types sorted by failure count, with root cause classification and linked Incidents | 5min |
| Cost Distribution | Domain budget consumption breakdown: model calls / tool calls / storage(§18) | 1h |

## 43.4 L3 Platform Ops View

Infrastructure operations view for the SRE team:

| Panel | Content | Refresh Rate |
| --- | --- | --- |
| Five-Plane Health | P1-P5 Plane(§4) liveness status and component Ready ratio | 10s |
| Resource Utilization | Cluster-level heatmap of CPU / memory / GPU / queue depth | 30s |
| Error Rate Trends | 4xx/5xx error rates by service dimension with week-over-week change | 1min |
| Latency Distribution | P50/P95/P99 latency, split by Interface→Execution→Model | 1min |
| Incident Timeline | Active Incident list with auto-remediation progress(§26) | Real-time |

## 43.5 L4 Fleet Management View

Global operations view for enterprise platform teams:

| Panel | Content | Refresh Rate |
| --- | --- | --- |
| Cross-Region Status | Availability, sync latency, and failover readiness per Region cluster | 1min |
| Fleet Cost Overview | Org-wide cost distribution by domain/region/tenant with YoY trends(§18) | 1h |
| Tenant Comparison | Tenant-level QPS, success rate, resource consumption horizontal ranking | 5min |
| Capacity Forecast | 7d/30d resource demand forecast and scale-up recommendations based on historical trends | 6h |
| Compliance Posture | Audit policy coverage, sensitive operation approval rate, compliance deviation count(§10) | 1h |

## 43.6 NL Status Summary Generation

Dashboard supports natural language summaries, generated by ModelGateway(§15):

- **Daily briefing**: "Today 5 Agents completed 23 tasks (96% success rate), spending ¥45. Advertising domain Agent performed well (ROI 2.8x). 2 approvals awaiting your action, 1 budget alert needs attention."
- **Anomaly briefing**: "In the past hour, Customer Service domain Agent success rate dropped from 95% to 78%, primarily due to slow KB API response. Auto-degraded to cache mode. Recommend checking KB service status."
- **Away-and-back briefing**: "During the 8 hours you were away: completed 12 tasks, spent ¥80. Finance domain had 1 P1 Incident (auto-recovered). 3 approvals were auto-processed due to timeout. No immediate action needed."

---

# 44. Non-Technical User Experience Architecture

> Enables non-developers (business leads, solo operators) to use all platform capabilities through visual interfaces.
> Related: §22 SDK/DX · §38 Onboarding Runbook · §39 NL Entry · §43 Dashboard

## 44.1 User Role Layering

| Role | Technical Level | Primary Interaction Method | Dashboard Level |
| --- | --- | --- | --- |
| Solo Operator | Non-technical | NL conversation(§39) + L1 dashboard(§43) | L1 |
| Business Line Lead | Non-technical | L1 dashboard + visual configuration | L1 |
| Domain Admin | Low-code | Visual configuration + occasional CLI | L2 |
| Pack Developer | Technical | SDK + CLI(§22) | L2/L3 |
| Platform SRE | Technical | CLI + Admin API + L3/L4 dashboard | L3/L4 |

## 44.2 Visual Domain Onboarding Wizard

Replaces the CLI + YAML flow in §38 designed for technical personnel:

```text
Step 1               Step 2               Step 3               Step 4
Select business type  Configure core       Set risk control     Activate go-live
                      capabilities         rules
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ "What type│        │ Drag to   │        │ Risk slider│        │ One-click │
│ is your   │───────▶│ select    │───────▶│ Approval   │───────▶│ activate  │
│ business?"│        │ capabilities│        │ rules      │        │ Canary    │
│ [card pick]│        │ [tool panel]│        │ [presets]  │        │ [progress]│
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Traditional Method(§38) | Visual Method(§44) |
| --- | --- |
| `agent-platform domain init --archetype=crud_heavy` | Card selection "Customer Service type" |
| Manually edit DomainDescriptor YAML | Form filling + intelligent recommendations |
| `agent-platform domain validate` | Real-time validation + traffic light indicators |
| Multi-team collaboration 5-9 weeks | Wizard-guided 1-3 days (low-risk domains) |

## 44.3 Visual Workflow Builder

Workflow orchestration interface for non-technical users:

## 44.4 Intelligent Guided Onboarding

```text
First login
    │
    ▼
┌──────────────────┐
│ "Hello! I'm your │
│  AI business      │
│  assistant.       │
│  What would you   │
│  like me to do?"  │
└───────┬──────────┘
        │ user describes business
        ▼
┌──────────────────┐
│ Auto-recommend   │
│ • Suitable domain│
│   template       │
│ • Needed         │
│   integrations   │
│ • Estimated cost │
└───────┬──────────┘
        │ user confirms
        ▼
┌──────────────────┐
│ One-click setup  │
│ • Create Domain  │
│ • Install base   │
│   Pack           │
│ • Set default    │
│   risk control   │
│ • Activate first │
│   Agent          │
└───────┬──────────┘
        │ 3 minutes later
        ▼
┌──────────────────┐
│ "Your first Agent│
│  is ready! Try   │
│  saying:          │
│ 'Help me...'     │
└──────────────────┘
```

## 44.5 Solo Mode vs Enterprise Mode

Platform auto-adjusts UX complexity based on user count:

| Dimension | Solo Mode | Enterprise Mode |
| --- | --- | --- |
| Tenant | Auto-create single tenant, hide tenant concept | Full multi-tenant management |
| Approval | Self-approval (low/medium risk auto-pass, high risk popup confirm) | Full approval flow engine(§21) |
| Security Review | Built-in security checks run automatically, no manual security team needed | Dedicated security team review |
| Onboarding Flow | Wizard-guided 3 minutes | Four-phase Runbook(§38) |
| Dashboard | L1 Operator View only | L1-L4 all levels |
| Cost | Personal budget view + cost-saving tips | Department-level chargeback |
| Governance | Simplified (user is domain_owner) | Full organizational governance |

## 44.6 Accessibility (WCAG 2.1 AA)

| WCAG Principle | Platform Implementation |
| --- | --- |
| Perceivable | All charts provide alt text / data table alternative views; color is not the sole information carrier (paired with shapes/labels) |
| Operable | All functions keyboard accessible (Tab order, Enter confirm, Esc cancel); NL entry supports voice input(§68) |
| Understandable | Error messages clearly state the problem and fix suggestions; form labels explicitly associated with inputs |
| Robust | Semantic HTML; ARIA annotations on key interactive controls (dashboard cards, approval buttons, workflow canvas nodes) |

**Audit and Testing**: Auto-run axe-core scan before every frontend release; WCAG AA violations are treated as release blockers.

**Frontend Implementation Requirement**: WCAG 2.1 AA compliance requires actual frontend UI implementation (React/Vue/Angular etc.). The platform TypeScript code provides data models, color contrast tokens (`getSeverityColorTokens()`), and accessibility label builder functions (`buildAccessibleLabel()`), but actual UI components must be implemented in the specific frontend framework. §21 HITL notification component (`src/platform/interface/console/hitl/notification.ts`) provides TypeScript logic with color values meeting WCAG AA contrast requirements (≥4.5:1), but rendering and interaction implementation is handled by the frontend.

---

# Part VI -- Harness Engineering and Eight-Pillar Deepening Layer (S45, S58)

---

# 45. Harness Runtime Architecture

> Converge the platform's scattered constraint, tool, context, and feedback capabilities into a unified Harness Runtime — a standardized Agent execution foundation. This fuses the eight-pillar model drawn from three major industry schools: Anthropic's role-based closed-loop, LangGraph's durable runtime, and OpenAI's governance and Guardrails primitives. Harness does not replace existing modules; instead, it orchestrates them into a closed-loop runtime.
> Related: §13 OAPEFLIR · §5 Inter-Plane Communication Contracts · §10 Risk Control · §14 Execution Plane · §19.5 Multi-Agent Collaboration Protocol · §21 HITL · §29 Memory/Knowledge · §37 Business Domain Modeling · §42 Progressive Autonomy

## 45.1 Harness Core Axioms

> **Eight Pillars**: Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay

Harness upgrades one-shot model invocations into a closed-loop system that is "constrained, executable, memorizable, feedback-driven, recoverable, evaluable, human-intervenable, and observable." The eight pillars extend a unified abstraction from three major industry schools: Anthropic's harness/eval harness (role-based closed-loop + evaluation runtime), LangGraph's durable runtime (durable execution + memory layering + HITL interrupt/resume), and OpenAI's agents primitives/guardrails (tool governance + layered guardrails + orchestration).

| Pillar               | Responsibility                                                                | Core Modules                                        |
| -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Constraints          | Unified constraints (Policy/Approval/Risk/Sandbox/Budget/Org)                 | §45.3 ConstraintPack · §45.20 Guardrails            |
| Tools                | Unified tools (Executor/Plugin/Connector/MCP)                                 | §45.4 ToolbeltAssembler · §45.17 Tool Harness       |
| State/Memory         | Unified state (Truth/Event/Checkpoint/Memory/Knowledge)                       | §45.5 HarnessContext · §45.16 Memory Namespace      |
| Feedback             | Unified feedback (Step/Task/Workflow/System level)                            | §45.6 FeedbackEnvelope                              |
| Durability           | Unified durable execution (checkpoint/pause/resume/replay)                    | §45.11 Recovery Controller · §45.15 Durable Harness |
| Evaluation Harness   | Unified evaluation (runtime adjudication + offline eval + version comparison) | §45.10 Evaluator Agent · §45.14 Evaluation Harness  |
| HITL Runtime         | Unified human-machine collaboration (inspect/patch/override/takeover/resume)  | §21 HITL Approval · §45.18 HITL Runtime             |
| Observability/Replay | Unified observability and replay (run trace + replay + audit)                 | §58.1/§58.4 · §45.19 Async Harness                  |

Every task run enters through the unified HarnessRuntime entry point, which assembles constraints, tools, and context, drives the Planner→Generator→Evaluator multi-turn closed loop, and produces the final result along with an evidence chain.

**Harness's Position within the Five Planes**: Harness is the unified runtime kernel of P3 Orchestration Plane. It sinks into P4 via protocols, consolidates state upward into P5, and is governed by P2.

| Plane            | Harness Interaction                        | Key Protocols/Data                                             |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------- |
| P1 Interface     | Receives request envelopes                 | RequestEnvelope, SessionContext                                |
| P2 Control       | Consumes governance directives             | ControlDirective, Policy, Approval, Budget, Guardrails(§45.20) |
| P3 Orchestration | **Harness is the unified P3 orchestrator** | HarnessRuntime, Planner/Generator/Evaluator closed loop        |
| P4 Execution     | Dispatches execution plans                 | ExecutionPlan, ToolCall, HITLWait, AsyncDispatch               |
| P5 Evidence      | Writes run evidence                        | HarnessRun, HarnessStep, ContextSnapshot, Evidence             |

## 45.2 HarnessRuntime Overall Architecture

```text
User / API / Webhook / Scheduler
        ↓
  P1 Interface Plane
        ↓
┌───────────────────────────────────────────────────────────┐
│                    Harness Runtime                         │
│                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │  Constraint   │ │  Tool        │ │  Context          │ │
│  │  Engine +     │ │  Harness +   │ │  Assembler +      │ │
│  │  Guardrails   │ │  Toolbelt    │ │  Memory Namespace │ │
│  └──────┬───────┘ └──────┬───────┘ └─────────┬─────────┘ │
│         │                │                    │           │
│         ▼                ▼                    ▼           │
│  ┌───────────────────────────────────────────────────┐   │
│  │            HarnessLoopController                  │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────────┐ │   │
│  │  │ Planner  │─>│ Generator │─>│   Evaluator    │ │   │
│  │  │ Agent    │  │ Agent     │  │ Agent + Eval   │ │   │
│  │  └────┬─────┘  └───────────┘  │ Harness        │ │   │
│  │       │                        └───────┬────────┘ │   │
│  │       │         ┌──────────┐           │          │   │
│  │       │         │ HITL     │◄──escalate┘          │   │
│  │       │         │ Runtime  │                      │   │
│  │       │         └────┬─────┘                      │   │
│  │       └── replan ◄───┴── resume ──────────────────┘   │
│  └───────────────────────────────────────────────────┘   │
│         │                    │                            │
│  ┌──────▼──────┐     ┌──────▼──────┐                     │
│  │  Durable     │     │  Recovery    │                     │
│  │  Harness     │     │  Controller  │                     │
│  └─────────────┘     └─────────────┘                     │
└───────────────────────────────────────────────────────────┘
        ↓                    ↓                 ↓
  P4 Execution        P5 State &         P2 Control
  Plane               Evidence           Plane
```

## 45.3 ConstraintPack — Task-Level Constraint Envelope

Each task run carries an explicit constraint pack, turning constraints from implicit logic into a first-class input:

| Constraint Dimension | Description                                                  | Source                                                    |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| autonomy_mode        | suggestion / supervised / semi_auto / full_auto              | §42 Progressive Autonomy + §37.2 DomainCapability ceiling |
| budget               | max_cost / max_steps / max_duration_ms                       | §18 Cost Management + §37.9 DomainGovernancePolicy        |
| tool_policy          | allowed/denied tools + network/filesystem policy             | §11 Security + §30 Pack Manifest + DomainDescriptor       |
| risk_policy          | max_risk_level + approval_required_at                        | §10 Risk Control + §37.3 DomainRiskProfile                |
| output_policy        | require_evidence / require_evaluation / require_human_review | §21 HITL + §59 Explainability                             |

ConstraintPack is assembled by ConstraintEngine at the HarnessRuntime entry point, merging platform defaults, tenant overrides, domain overrides, and task-level overrides (in increasing priority order).

**Existing Module Mapping**: PolicyCenterService · ApprovalService · RiskEvaluationEngine · CostAlertService

## 45.4 ToolbeltAssembler — Task-Level Tool Assembly

Assembles the minimum viable toolset based on task type, business domain, risk level, tenant policy, and current context:

**Assembly Flow**:

1. Retrieve the domain-allowed tool list from DomainDescriptor(§37)
2. Filter by ConstraintPack.tool_policy
3. Exclude high-risk tools based on risk level (exclude all write tools in read_only mode)
4. Exclude over-budget tools based on tenant budget
5. Attach safety guards (input schema validation, output secret scanning, sandbox tier binding)
6. Attach tool reliability profiles (success rate, average latency, circuit-breaker state) for Planner reference

**Tool Evidence Standard**: Each tool execution automatically produces input summary, output summary, telemetry, artifact_ref, error_class, and retryability, feeding into Evidence Plane(§P5).

**Existing Module Mapping**: ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor

## 45.5 HarnessContext — Unified Runtime Context

Unifies scattered state/memory/knowledge/artifacts into a runtime context object, assembled by ContextAssembler at the start of each loop iteration:

**Four Context Categories**:

| Context              | Content                                                                        | Lifecycle           |
| -------------------- | ------------------------------------------------------------------------------ | ------------------- |
| Conversation Context | User dialogue, instructions, preferences, raw NL input(§39)                    | Session-level       |
| Task Context         | Current task goal, step states, ExecutionPlan, completed step Receipts         | Task-level          |
| Memory Context       | Historical experience, long-term memory, Agent behavior patterns(§29)          | Persistent          |
| Knowledge Context    | External knowledge, documents, retrieval results, DomainKnowledgeSchema(§37.4) | On-demand retrieval |

**Context Budget**: Not all content can be fed to the model. ContextAssembler applies the following to each loop iteration's context:

- Token budget trimming (total token budget = converted from ConstraintPack.budget.max_cost)
- Relevance score ranking (relevance to current step goal)
- Freshness score ranking (most recent context prioritized)
- Trust score filtering (mark confidence for knowledge from untrusted sources)

**Context Snapshot**: Each loop iteration saves a `ContextSnapshot` to P5 Checkpoint, used for crash recovery, replay, diff analysis, and debugger time-travel(§65).

**Existing Module Mapping**: MemoryPlaneService · KnowledgePlaneService · AuthoritativeTaskStore · ArtifactStore

## 45.6 FeedbackEnvelope — Unified Feedback Protocol

Consolidates scattered feedback signals into a standardized envelope, establishing a four-stage feedback closed loop:

**Four-Stage Closed Loop**:

| Feedback Level | Trigger                                                | Evaluation Content                                     | Output                                        |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------- |
| Step-level     | After a single tool/model call completes               | Output quality, latency, cost, deviation from expected | Immediate judgment: continue / retry / replan |
| Task-level     | After all steps of a Task complete                     | Whether Task goal is met, acceptance criteria          | Aggregated score + improvement suggestions    |
| Workflow-level | After all steps of multi-step flow complete            | Whether business goal is met, end-to-end quality       | Final evaluation report                       |
| System-level   | After accumulating sufficient feedback signals (async) | Whether prompt/policy/tool_config needs updating       | ImprovementCandidate → P2 Release             |

Step-level feedback is produced in real time by the Evaluator Agent; Task/Workflow-level is aggregated by the Evaluator; System-level is processed asynchronously by Learn/Improve(§13.2).

**Existing Module Mapping**: FeedbackCollector · PostExecutionQualityGate · StrategyLearningService · ApprovalContextSummaryService

## 45.7 HarnessLoopController — Unified Closed-Loop Control

Consolidates loop control logic from multiple scattered services into a single controller:

**Control Decision Matrix**:

| Evaluator Output | Loop Behavior                      | Condition                              |
| ---------------- | ---------------------------------- | -------------------------------------- |
| accept           | Advance to next step (or complete) | score ≥ quality_threshold              |
| retry            | Retry current step (same plan)     | retry_count < max_retries              |
| replan           | Trigger Planner to re-plan         | replan_count < max_replans             |
| escalate         | Escalate to human(§21 HITL)        | risk increased / confidence too low    |
| abort            | Safe termination + record evidence | Budget exhausted / unrecoverable error |

**Loop Guards**:

- Maximum loop iterations (default 10, constrained by ConstraintPack.budget.max_steps)
- Maximum replan count (default 3)
- Total time limit (constrained by ConstraintPack.budget.max_duration_ms)
- Total cost limit (constrained by ConstraintPack.budget.max_cost)
- Any guard triggered → forced termination + escalate

**Existing Module Mapping**: OapeflirLoopService · RolloutStateMachine · TransitionService

## 45.8 Planner Agent — Planning Responsibility

Planner Agent is responsible for understanding goals, decomposing tasks, identifying risks, and generating execution plans.

**Standardized Output PlanBundle**:

| Field            | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| goal             | Original goal + structured GoalSpec                            |
| task_graph       | Task dependency DAG (reuses §40 GoalDecomposer)                |
| execution_budget | Step/time/cost budget allocation                               |
| risk_profile     | Risk assessment snapshot (reuses §10 RiskAssessment)           |
| success_criteria | List of quantifiable acceptance criteria                       |
| evaluator_hints  | Evaluation hints for the Evaluator (which metrics to focus on) |

**Prompt Separation**: Planner uses a dedicated Planner Prompt (obtained from DomainPromptLibrary §37.6) and does not share templates with Generator/Evaluator.

**Existing Reusable Modules**: IntakeRouter · AssessmentService · PlanBuilder · GoalDecomposer · PolicyCenterService

## 45.9 Generator Agent — Execution Responsibility

Generator Agent is responsible for invoking tools, executing steps, writing back evidence, and producing intermediate results.

**Standardized Output WorkProduct**:

| Field          | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| step_id        | Current execution step ID                                          |
| artifacts      | List of produced artifact references                               |
| observations   | Observation records during execution                               |
| result_summary | Result summary (for Evaluator assessment)                          |
| telemetry      | Step-level telemetry (latency, token consumption, tool call count) |

**Key Behavioral Constraints**:

- When encountering a blockage (tool unavailable, insufficient permissions, external timeout), request help (trigger escalate) instead of forcing through
- All tool calls go through the Toolbelt filter; unconfigured tools cannot be called directly
- Each step automatically produces evidence (input/output/side_effect), written to P5

**Existing Reusable Modules**: ExecutionDispatchService · MultiStepSupervisor · ToolExecutor · PluginExecutor · UnifiedChatProvider

## 45.10 Evaluator Agent — Evaluation Responsibility

Evaluator Agent is responsible for judging result quality, checking goal deviation, and deciding the next action.

**Standardized Output EvaluationReport**:

| Field          | Description                                            |
| -------------- | ------------------------------------------------------ |
| passed         | Whether it passed                                      |
| score          | Quality score 0-100                                    |
| issues         | List of discovered issues (type + severity + location) |
| recommendation | accept / retry / replan / escalate / abort             |
| confidence     | Evaluation confidence 0.0-1.0                          |

**Evaluation Dimensions**:

- **Goal Deviation**: Distance between current result and PlanBundle.success_criteria
- **Quality Gate**: Reuses §17 Model Evaluation + DomainEvalFramework(§37.5)
- **Risk Change**: Whether risk increased after execution (compared to PlanBundle.risk_profile)
- **Cost Reasonableness**: Whether actual token/time consumption is within budget

**Prompt Separation**: Evaluator uses a dedicated Evaluator Prompt and does not share with Planner/Generator.

**Existing Reusable Modules**: FeedbackCollector · StrategyLearningService · PostExecutionQualityGate · ApprovalContextSummaryService · SloAlertingService

## 45.11 Recovery Controller

When a fault occurs during Harness execution (worker crash, external timeout, model unavailable), Recovery Controller performs recovery based on ContextSnapshot(§45.5):

| Fault Type               | Recovery Strategy                                                                 |
| ------------------------ | --------------------------------------------------------------------------------- |
| Worker crash             | Recover from latest ContextSnapshot, re-acquire lease, continue from breakpoint   |
| LLM Provider unavailable | Trigger ModelGateway(§15) fallback chain, switch provider and continue            |
| Tool timeout             | LoopController decides retry (same tool) or replan (substitute tool)              |
| Budget exhausted         | Safe termination + save current state + notify user                               |
| PlatformPanic(§60)       | Immediately serialize full state to checkpoint, await platform recovery to resume |

Reuses existing Recovery Workers (LeaseReclaimer · StuckRunSweeper) and Checkpoint mechanism(§14).

## 45.12 Integration with Existing Architecture

| Existing Component           | Harness Integration                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| §5 Inter-Plane Contracts     | HarnessRuntime serves as the unified P3 Orchestration entry, receiving RequestEnvelope and outputting ExecutionPlan |
| §10 Risk Control             | ConstraintPack.risk_policy is assembled by RiskAssessmentEngine                                                     |
| §13 OAPEFLIR                 | Planner/Generator/Evaluator/Loop is the simplified external mapping of the OAPEFLIR eight stages(§13.5)             |
| §14 Execution Plane          | Generator Agent executes via the standard ExecutionPlan → P4 dispatch → ExecutionReceipt path                       |
| §21 HITL                     | LoopController's escalate path directly invokes the HITL approval flow                                              |
| §37 Business Domain Modeling | DomainDescriptor drives domain-level configuration of ConstraintPack/Toolbelt/Context                               |
| §42 Progressive Autonomy     | ConstraintPack.autonomy_mode is determined by AgentTrustProfile                                                     |
| §59 Explainability           | Each loop iteration's PlanBundle/WorkProduct/EvaluationReport is automatically fed into the explainability pipeline |
| §65 Debugger                 | ContextSnapshot sequence supports time-travel debugging                                                             |

## 45.13 HarnessRun / HarnessStep — Unified Run Contract

> Defines run entities and step entities as first-class contracts.

**HarnessRun** represents a complete Harness task run:

| Field            | Description                                               |
| ---------------- | --------------------------------------------------------- |
| runId            | Globally unique run identifier                            |
| tenantId         | Tenant                                                    |
| goal             | Original goal + structured GoalSpec                       |
| mode             | sync / async (§45.19)                                     |
| riskLevel        | Runtime risk level (determined by ConstraintPack)         |
| budget           | max_cost / max_steps / max_duration_ms                    |
| constraintPack   | Constraint snapshot for this run (§45.3)                  |
| plannerOutput    | PlanBundle (§45.8)                                        |
| steps            | HarnessStep sequence                                      |
| currentIteration | Current loop iteration                                    |
| maxIterations    | Constrained by ConstraintPack                             |
| finalDecision    | accept / abort / escalate / timeout                       |
| status           | pending / running / paused / completed / failed / aborted |
| traceId          | Distributed trace correlation                             |
| ownership        | Belonging agent / tenant / domain                         |
| auditRefs        | List of audit evidence references                         |

**HarnessStep** represents a single execution step:

| Field        | Description                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| stepId       | Step identifier                                                              |
| phase        | plan / execute / evaluate / hitl / decision                                  |
| role         | planner / generator / evaluator / hitl_operator / loop_controller            |
| inputs       | Step inputs (context snapshot references)                                    |
| outputs      | Step outputs (PlanBundle / WorkProduct / EvaluationReport / HarnessDecision) |
| rationale    | Decision rationale (fed into §59 Explainability)                             |
| evidenceRefs | P5 evidence references                                                       |
| toolCalls    | List of tool call records                                                    |
| latency      | Step latency                                                                 |
| cost         | Token/API cost                                                               |
| error        | Error information (if any)                                                   |
| nextAction   | Next action (determined by HarnessDecision)                                  |

**HarnessDecision** has six fixed adjudications (see §58.6 for details): accept · retry_same_plan · replan · escalate_to_human · downgrade_mode · abort.

**Existing Module Mapping**: AuthoritativeTaskStore · ExecutionReceipt · OapeflirLoopService · AuditService

## 45.14 Evaluation Harness — Unified Evaluation Runtime

> §45.10 Evaluator Agent handles runtime adjudication. This section completes the **offline evaluation, pre-release evaluation, and version comparison** capabilities to form a complete Evaluation Harness.
> Industry reference: Anthropic's "the final outcome matters more than the transcript"; an evaluation harness should run tasks in a controlled environment, observe environment state, and aggregate results.

**Three Evaluation Modes**:

| Evaluation Mode        | Trigger                                                  | Evaluation Content                              | Output                                                   |
| ---------------------- | -------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Runtime Evaluation     | After each step / each task completes                    | Evaluator Agent real-time adjudication (§45.10) | EvaluationReport                                         |
| Pre-release Evaluation | Before new Prompt/Planner/Evaluator/ToolBundle goes live | Run standard task set in isolated sandbox       | Pass rate / regression comparison / quality distribution |

## 45.15 Durable Harness — Durable Execution Pillar

> §45.11 Recovery Controller handles fault recovery. This section elevates durable execution from a recovery strategy to a first-class pillar — checkpoint/pause/resume is a foundational capability of the Harness, not an add-on.
> Industry reference: LangGraph "durable execution = a process saves progress at key points and can later pause and resume from the exact position."

**Pause Reason Registry**:

| pauseReason                  | Description                              | Typical Scenario                           |
| ---------------------------- | ---------------------------------------- | ------------------------------------------ |
| waiting_for_human            | Waiting for human approval/intervention  | HITL Runtime (§45.18) escalate             |
| waiting_for_external_event   | Waiting for external system callback     | Webhook / third-party approval / CI result |
| waiting_for_budget_reset     | Budget exhausted, waiting for next cycle | Token/cost budget ceiling reached          |
| waiting_for_policy_clearance | Waiting for policy review approval       | High-risk action requires P2 approval      |
| waiting_for_dependency       | Waiting for upstream task/data readiness | DAG dependency not satisfied               |

**Resume Strategies**:

| resumeStrategy     | Description                                                        | Applicable Scenario                               |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| resume_same_state  | Resume from exact breakpoint, state unchanged                      | Human approval granted, external callback arrived |
| resume_with_replan | Trigger Planner re-planning upon resume                            | Context has changed, policy has been updated      |
| resume_supervised  | Enter supervised mode after resume                                 | High-risk recovery, trust downgrade               |
| abort_on_resume    | Determine continuation is infeasible upon resume, safely terminate | Timeout exceeded, environment is irreversible     |

**Key Mechanisms**:

- The ContextSnapshot (§45.5) of each loop iteration is the persistence foundation of Durable Harness
- §20 long-running task hibernation mechanism serves as the underlying implementation of Durable Harness
- On pause, the complete HarnessRun state is serialized to P5 Checkpoint
- On resume, ResumeStrategyService selects a strategy based on pauseReason + current environment

**Existing Module Mapping**: HibernationService · RecoveryWorker · LeaseReclaimer · StuckRunSweeper · CheckpointService

## 45.16 Memory Namespace and Strategy

> §45.5 HarnessContext treats memory as a context type. This section completes the three-layer memory namespace and promotion strategy.
> Industry reference: LangGraph explicitly distinguishes thread-scoped short-term memory from cross-thread long-term memory; OpenAI treats state/memory as core primitives.

**Three-Layer Memory Namespace**:

| Layer                   | Scope                                              | Content                                                                                                                                         | Lifecycle                               |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Working Memory          | Current run / current iteration                    | Current goal summary, plan summary, issue checklist, budget remainder, risks and patterns, selected tools, recent failure reasons, key evidence | Archived after run ends                 |
| Long-term Memory        | Cross-run / cross-project                          | Historical experience, agent behavior patterns, task success/failure patterns, common tool combinations                                         | Persisted, expires per retention policy |
| Shared Knowledge Memory | Knowledge layer promotable to universal experience | Cross-agent / cross-domain best practices, common failure recovery solutions, evaluation rule suggestions                                       | Requires human review before promotion  |

**Memory Promotion Strategy**:

- Working → Long-term: After run completion, observations marked as "valuable" by Evaluator are automatically nominated for promotion, reviewed by MemoryPromotionPolicy
- Long-term → Shared Knowledge: After accumulating N cross-agent validations, nominated for promotion; requires human review
- Reverse demotion: Long-term entries with M consecutive non-references are automatically marked as stale, cleaned up after expiration

**Namespace Isolation**:

- Tenant isolation: Long-term Memory of different tenants is physically isolated
- Domain isolation: Working Memory of different domains within the same tenant is logically isolated
- Cross-domain sharing: Must go through §50 Knowledge Domain Isolation and Controlled Sharing access controls

**Existing Module Mapping**: MemoryPlaneService · KnowledgePlaneService · §29 Memory/Knowledge Boundary · §50 Knowledge Domain Isolation

## 45.17 Tool Harness — Tool Governance

> §45.4 ToolbeltAssembler is responsible for assembling tool subsets per task. This section elevates tools from "callable is good enough" to "a governed first-class resource."
> Industry reference: OpenAI/Anthropic both point out that tool schema, applicability boundaries, trustworthiness, invocation cost, and failure semantics should all be governed.

**Tool Capability Profile**:
Every registered tool must include:

| Profile Field       | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| toolId              | Globally unique identifier                                   |
| capabilityType      | read / write / compute / network / filesystem / browser / db |
| riskLevel           | low / medium / high / critical                               |
| expectedLatency     | P50/P99 expected duration                                    |
| expectedCost        | Estimated token/API cost per invocation                      |
| reliabilityScore    | Historical success rate (dynamically updated)                |
| requiredPermissions | Required permissions list                                    |
| allowedDataClasses  | Permitted data classifications (PII/confidential/public)     |
| allowedTenants      | Tenant whitelist (empty = all)                               |
| allowedDomains      | Domain whitelist (empty = all)                               |
| outputTrustLevel    | Output trust level (verified / unverified / untrusted)       |

**Tool Invocation Governance Record**:
Every tool invocation is automatically recorded:

- Selection rationale (which reasoning step of the Planner/Generator selected it)
- Invocation result (success / partial success / failure)
- Whether the output is trustworthy
- Whether it entered Long-term Memory
- Whether it triggered a fallback
- Whether it triggered Guardrails (§45.20)

**Tool Lifecycle**: registered → active → deprecated → retired, aligned with §30 Pack lifecycle.

**Existing Module Mapping**: ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor · §30 Pack Manifest

**Tool Selection Governance**:

Tool invocation is not a free choice but a governed three-stage process:

| Stage               | Object                 | Description                                                                  |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Candidate Filtering | ToolSelectionCandidate | Available tool set filtered by ConstraintPack + domain + risk-tier           |
| Selection Decision  | ToolSelectionDecision  | Records the Planner/Generator reasoning basis and alternatives for selection |
| Fallback Policy     | ToolFallbackPolicy     | Fallback chain on tool invocation failure (downgrade tool → human → abort)   |

Four hard rules:

1. Planner may only select tools from the ToolSelectionCandidate set; bypassing constraint boundaries is prohibited
2. Generator must not bypass the Planner's selection result to directly invoke unselected tools
3. Evaluator assesses tool selection reasonableness post-hoc; may require Planner to re-select if unreasonable
4. Tools with risk-tier ≥ high must have a configured ToolFallbackPolicy; otherwise ConstraintPack validation fails

## 45.18 HITL Runtime — Human-Machine Collaboration Runtime

> §21 defines the HITL approval mode; §45.7 LoopController provides the escalate path. This section elevates HITL from an approval flow to a Harness-native runtime — humans are not merely approving at the process boundary, but can view state, modify state, and continue execution during a run.
> Industry reference: LangGraph "the checkpointer lets humans inspect, interrupt, approve, modify state, and then resume during a run"; OpenAI "guardrails and human review jointly determine when a run continues, pauses, or stops."

**Five HITL Capabilities**:

| Capability | Description                                                                         | Trigger Method                                   |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| Inspect    | View current run state, plan, context, evaluator findings                           | Active viewing / Dashboard (§43) entry           |
| Patch      | Modify planner output / working context / constraints / success criteria            | Human modifies in HITL interface and writes back |
| Override   | Override evaluator recommendation / mode / budget / selected tools                  | Human override ruling                            |
| Takeover   | Human directly takes over execution; Generator pauses                               | High-risk / insufficient trust / emergency       |
| Resume     | Resume automatic execution after human processing (linked to §45.15 resumeStrategy) | Triggered after Patch/Override/Takeover          |

**Relationship between HITL and Durable Harness**:

- HITL trigger → Durable Harness pause (pauseReason = waiting_for_human)
- Human completion → Durable Harness resume (resumeStrategy chosen by human or auto-recommended)
- All HITL operations are written to audit log (§12 Audit + §59 Explainability)

**HITL Timeout Policy**:

- Default wait duration configured by §21 HITL mode
- On timeout, escalate to a higher approval tier or abort per ConstraintPack's escalation_policy

**Existing Module Mapping**: ApprovalService · TakeoverController · §21 HITL Mode · §47 Approval Routing

**HITL State Machine**:

```text
                      ┌──────────────────────────────────────────┐
                      │                                          │
  ┌─────────┐  HITL trigger ┌──────────────────┐                │
  │ Running │──────────→│ Paused_for_Human │                     │
  └─────────┘           └────────┬─────────┘                     │
                                 │                               │
              ┌──────────┬───────┼────────┬──────────┐          │
              ↓          ↓       ↓        ↓          ↓          │
         Inspecting  Patched  Overridden  Manual   Timeout      │
              │          │       │      Takeover     │          │
              │          │       │        │          │          │
              └──────────┴───────┴────────┘          │          │
                         │                           ↓          │
                    resume/approve              Escalate/Abort  │
                         │                           │          │
                         ↓                           ↓          │
                    ┌─────────┐              ┌───────────┐      │
                    │ Resumed │              │  Aborted  │      │
                    └────┬────┘              └───────────┘      │
                         │                                      │
                         └──────────────────────────────────────┘
                                  Back to Running
```

**State Transition Rules**:

| Operation | Pre-state                          | Post-state                        | Impact Scope                                             |
| --------- | ---------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Inspect   | Paused_for_Human                   | Inspecting → Paused_for_Human     | Read-only, does not change run state                     |
| Patch     | Paused_for_Human                   | Patched → awaiting resume         | Modifies context/variables, does not change plan         |
| Override  | Paused_for_Human                   | Overridden → awaiting resume      | Replaces current plan or step result                     |
| Takeover  | Paused_for_Human                   | Manual_Takeover → awaiting resume | Human takes full control, agent pauses reasoning         |
| Resume    | Patched/Overridden/Manual_Takeover | Resumed → Running                 | Resumes automatic execution, carries human modifications |
| Abort     | Any Paused sub-state               | Aborted                           | Terminates run, records termination reason               |

## 45.19 Async Harness — Async Execution Mode

> Completes the async execution mode, adapting to enterprise multi-hour / multi-round / multi-approval async work scenarios.
> Industry reference: Anthropic "pre-built, configurable agent harness running on managed infrastructure, suitable for long-running tasks and async work."

**Two Execution Modes**:

| Mode          | Applicable Scenario                                                                                                     | Interaction Pattern                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Sync Harness  | Second-level tasks, in-session responses, simple tool chains                                                            | Request-response, blocking wait for result                     |
| Async Harness | Multi-hour tasks, multi-round collaboration, multiple approvals, long analyses, automation pipelines, batch task groups | Create run → poll/subscribe → intervene mid-run → final result |

**Async Harness Capabilities**:

- create_run: Create an async HarnessRun, return runId
- poll_status: Query current state and progress by runId
- subscribe_events: Subscribe to run event stream via Webhook/SSE
- inspect_step: View detailed information of any step
- intervene_mid_run: Trigger any HITL Runtime (§45.18) operation mid-run
- replay_after_completion: Post-completion replay analysis (§58.4)

**Relationship between Async and Durable**: Async Harness relies on the checkpoint/pause/resume mechanism of Durable Harness (§45.15). Every async run natively supports interruption and resumption.

**Existing Module Mapping**: §20 Long-running Tasks · WebhookDeliveryService · §43 Dashboard · EventBus

## 45.20 Guardrails Layered Architecture

> §45.3 ConstraintPack consolidates constraints into a task-level envelope. This section establishes five Guardrails layers on top of ConstraintPack, ensuring guardrails permeate the entire Harness workflow.
> Industry reference: OpenAI "guardrails should not only perform unified risk assessment at the entry point but should be layered throughout the entire workflow."

**Five Guardrails Layers**:

| Layer               | Check Timing                     | Check Content                                                                                                  | Interception Action                                      |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Input Guardrails    | Before request enters Harness    | Prompt injection · sensitive request classification · unsupported goal detection · input format validation     | Reject / rewrite / downgrade                             |
| Planning Guardrails | After Planner output             | Prohibited plan patterns · unauthorized delegation · overly broad tool scope · unsafe goal decomposition       | Require replan / escalate                                |
| Tool Guardrails     | Before and after tool invocation | Untrusted tool output · unsafe API targets · overly broad file/DB access · high-risk action escalation         | Intercept / downgrade permissions / require confirmation |
| Memory Guardrails   | During memory read/write         | Prohibited retention content · unsafe Long-term promotion · cross-tenant leakage · boundary violations         | Reject write / desensitize                               |
| Output Guardrails   | Before result return             | Policy violations · unsafe execution suggestions · regulated content · high-confidence claims without evidence | Filter / rewrite / annotate                              |

**Relationship between Guardrails and ConstraintPack**: ConstraintPack defines "what the constraints are"; Guardrails define "where constraints are enforced and how interception works." They are complementary: ConstraintPack is the static constraint envelope; Guardrails are the dynamic execution checkpoints.

**Existing Module Mapping**: §10 Risk Control · §11 Security · §16.5 Prompt Injection Defense · §23 Compliance · §68 Multimodal Safety

## 45.21 Harness Ten Invariants

> Baseline rules for enterprise-grade Harness operation. No implementation or configuration may bypass these.

1. Any complex task must have a PlannerOutput first; executing without a plan is prohibited
2. Any GeneratorOutput must have a corresponding EvaluatorReport; skipping evaluation is prohibited
3. Any retry / replan / escalate / abort must record a HarnessDecision with rationale
4. Any long task (duration > 60s or steps > 3) must have an iteration checkpoint
5. Any tool output must pass trust/promotion rules (§45.16/§45.17) before entering Long-term Memory
6. Any human override must be written to the audit log, linked with traceId and operator identity
7. Any multi-agent run must clearly designate planner/generator/evaluator/controller responsible parties
8. Any async run must support state query (poll_status) and mid-run intervention (intervene_mid_run)
9. Any high-risk run (risk_level ≥ high) must support downgrade_mode or HITL escalate
10. Any harness run must be traceable (§58.1), replayable (§58.4), and auditable (§12)

# 58. Harness Cross-Cutting Concerns

> Cross-cutting engineering requirements arising from the introduction of Harness Runtime (§45) — Harness-level observability, Prompt layered governance, Failure-to-Learning pipeline, Replay/Simulation, architecture legacy issue resolution, and unified adjudication protocol.
> Related: §45 Harness Runtime · §12 Exception Events · §16 Prompt Management · §27 SLO · §65 Debugger

## 58.1 Harness-Level Observability

Existing observability (§9.7, §12, §27) targets infrastructure and plane granularity. Harness requires **per-run granularity** end-to-end observation:

| Metric                            | Description                                         | SLO                                                                             |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| harness.run.duration              | End-to-end duration of a single HarnessRun          | P99 < business domain SLO definition                                            |
| harness.loop.count                | Number of loops per run                             | mean < 3, max ≤ ConstraintPack.max_steps                                        |
| harness.replan.count              | Number of re-plans                                  | mean < 1                                                                        |
| harness.evaluator.score           | Evaluator score distribution                        | P50 ≥ 80                                                                        |
| harness.constraint.rejection_rate | ConstraintPack rejection rate                       | < 5% (too high indicates overly strict constraints or unclear task description) |
| harness.context.token_utilization | Context token budget utilization                    | 60%-90% (too low = waste, too high = risk truncating critical context)          |
| harness.tool.reliability          | Real-time reliability profile of each Toolbelt tool | Success rate ≥ 95%                                                              |

All metrics are automatically collected via Harness Telemetry Middleware, written to the P5 Evidence Plane, and consumed by the §43 dashboard and §65 debugger.

## 58.2 Prompt Layered Governance

The three types of Harness Agents each require independent Prompt strategies and must not be mixed:

| Prompt Type      | Responsibility                                                               | Governance Requirement                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Planner Prompt   | Goal understanding, task decomposition, risk identification, plan generation | Can only be released after passing §17 quality gate; linked to DomainPromptLibrary (§37.6) |
| Generator Prompt | Tool selection, step execution, result generation                            | Independently versioned; full rollout only after A/B test passes                           |
| Evaluator Prompt | Quality judgment, goal deviation detection, improvement suggestions          | Independent of the evaluated object; must not share version with Generator Prompt          |

Prompt layering is incorporated into the §16 Prompt management system; each Prompt type has an independent rollout channel.

## 58.3 Failure-to-Learning Pipeline

Automatically distills failure cases into platform knowledge assets:

```text
Step 失败
  → FeedbackEnvelope(outcome=failed)
    → 失败模式分类（error_class + root_cause_category）
      → 自动生成 candidate:
         ├── Recovery Playbook（恢复操作手册）
         ├── Prompt Patch Candidate（Prompt 修补建议）
         ├── Risk Rule Candidate（风险规则建议）
         └── Evaluator Rule Candidate（评估规则建议）
      → 人工审核 → P2 Release 治理 → 灰度上线
```

Key constraint: All candidates are suggestions only and must go through §34 ADR-Quality-Gate-Before-Prompt-Release and P2 approval before taking effect.

## 58.4 Harness Replay and Simulation

Based on ContextSnapshot sequences (§45.5), the following capabilities are supported:

| Capability           | Description                                                          | Use Case                           |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| Offline Replay       | Full replay of a completed HarnessRun                                | Fault localization, audit evidence |
| Strategy Comparison  | Run the same task with different ConstraintPacks                     | Constraint tuning                  |
| Prompt A/B           | Run the same task with different Planner/Generator/Evaluator Prompts | Prompt optimization                |
| Tool Swap Simulation | Replay after replacing a tool in the Toolbelt                        | Tool migration assessment          |
| What-if Analysis     | Modify a value in ContextSnapshot and continue execution             | Root cause analysis                |

Replay runs in an isolated sandbox (§34 ADR-Workflow-Debug-Session-Isolated) and does not affect the production environment.

## 58.5 Architecture Legacy Issue Resolution

Resolves the following cross-section legacy issues:

| Issue                                                                                                | Source Sections | Resolution                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §21 HITL approval vs §47 org approval routing responsibility overlap                                 | §21, §47        | §21 defines HITL modes and approval semantics; §47 defines approval routing resolution — §21 decides "whether approval is needed and in what mode", §47 decides "who the approver is and where to route"                                                                           |
| §23 compliance architecture vs §49 departmental compliance engine responsibility overlap             | §23, §49        | §23 defines the platform-level compliance framework (GDPR/SOC2/encryption/lineage); §49 defines org-level compliance policy distribution — §23 is "compliance capabilities", §49 is "compliance policy inheritance and differentiation on the org tree"                            |
| §31 HA architecture vs §52 multi-Region architecture scope overlap                                   | §31, §52        | §31 defines HA-1/HA-2/HA-3 tiers within a single Region; §52 defines cross-Region deployment. Mapping: HA-1 = single node single Region, HA-2 = dual node single Region, HA-3 = multi-AZ single Region, §52 = multi-Region Active-Active (prerequisite: each Region at least HA-3) |
| §32 deployment stages D1-D3 vs §8.4 scaling stages S1-S4 vs §33 landing Phase 1-7 no cross-reference | §8, §32, §33    | Mapping: D1+S1 = Phase 1-2, D2+S2 = Phase 3-4, D3+S3 = Phase 5-6, S4 = Phase 6-7. The three classification systems have different perspectives — D looks at deployment form, S looks at scaling capability, Phase looks at delivery cadence                                        |
| No unified error classification system                                                               | §6.2            | Error codes organized by hierarchy: `PLATFORM.{plane}.{category}.{specific}`, e.g. `PLATFORM.P4.TOOL.TIMEOUT`, `PLATFORM.P2.POLICY.DENIED`. Each error code is associated with a retryable/severity/user_message triple                                                            |
| §61 AgentDefinition.autonomy_config vs §42 progressive autonomy no explicit linkage                  | §42, §61        | autonomy_config is generated driven by §42 AgentTrustProfile; the autonomy_config in AgentDefinition is a snapshot — initial value obtained from TrustProfile at creation time, dynamically updated by §42 TrustScorer at runtime                                                  |

## 58.6 HarnessDecision — Unified Adjudication Protocol

> LoopController (§45.7) adjudication is elevated to a first-class protocol (six decisions: accept/retry/replan/escalate/downgrade_mode/abort), each with standardized fields.

**Six Decisions**:

| Decision          | Semantics                         | Trigger Condition                                           | Subsequent Action                                              |
| ----------------- | --------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| accept            | Current step/task passes          | score ≥ threshold, no critical issues                       | Advance to next step or complete run                           |
| retry_same_plan   | Retry current step with same plan | Transient failure, tool timeout, retry_count < max          | Generator re-executes the same step                            |
| replan            | Trigger Planner re-planning       | Goal deviation, rising risk, replan_count < max             | Planner generates new PlanBundle                               |
| escalate_to_human | Hand off to HITL Runtime (§45.18) | Rising risk / low confidence / policy requirement           | Durable Harness pause + HITL intervention                      |
| downgrade_mode    | Downgrade operating mode          | Insufficient trust / tight budget / risk near threshold     | autonomy_mode downgrades one level (e.g. semi_auto→supervised) |
| abort             | Safe termination                  | Budget exhausted / unrecoverable error / policy prohibition | Save state + record evidence + notify user                     |

**HarnessDecision Standardized Fields**:

- decision: one of the six decisions
- reason: structured reason (error_class + root_cause_category)
- evaluatorReport: reference to the EvaluationReport that triggered the decision
- confidence: decision confidence 0.0-1.0
- suggestedNextAction: suggestion for next step (for LoopController reference)
- auditRef: audit evidence reference

---


# Part VII -- Organizational Governance Layer (S46-S51)

---

# 46. Organization Hierarchy Model

> Layers a company/division/department/team org-chart on top of tenant/domain/pack, driving layered governance for approval, budget, isolation, and compliance.
> Related: §11 Security · §18 Cost · §21 HITL · §37 Business Domain · §47 Approval Routing · §48 SSO/SCIM

## 46.1 Organization Model

OrgNode is the basic unit of the organization hierarchy, forming a tree structure (OrgTree):

| Field      | Type                                         | Description                            |
| ---------- | -------------------------------------------- | -------------------------------------- |
| `nodeId`   | string (ULID)                                | Globally unique identifier             |
| `type`     | enum: company / division / department / team | Organization level type                |
| `parentId` | string \| null                               | Parent node ID; null for company nodes |
| `name`     | string                                       | Organization unit name                 |
| `metadata` | object                                       | Extended attributes (cost center, region, owner, etc.) |

OrgTree supports dynamic reorganization — node additions, deletions, and modifications automatically trigger downstream permission refresh, approval route recalculation (§47), and budget redistribution. All changes are recorded in the audit log.

## 46.2 Mapping Between Organization and Platform Hierarchies

```text
Organization Hierarchy              Platform Hierarchy
company ──────────────────── platform (single instance)
  ├── division ────────────── tenant_group (budget aggregation)
  │   ├── department ──────── tenant (isolation unit)
  │   │   ├── team ────────── domain + pack_group
  │   │   └── team ────────── domain + pack_group
  │   └── department ──────── tenant
  └── division ────────────── tenant_group
```

| Org Level  | Platform Mapping | Governance Authority                         |
| ---------- | ---------------- | -------------------------------------------- |
| company    | platform config  | Global policies, platform-level SLO, compliance master plan |
| division   | tenant_group     | Division budget, cross-department workflow policies |
| department | tenant           | Department budget, department SLO, domain management, approval chain |
| team       | domain/pack      | Domain config, Pack development, daily operations |

## 46.3 Automatic Adaptation to Org Changes

| Org Change Event    | Automatic Platform Response                                                |
| ------------------- | -------------------------------------------------------------------------- |
| Employee onboarding | SCIM sync → create principal → assign to team → inherit team permissions   |
| Employee transfer   | Update reporting_chain → adjust tenant/domain permissions → migrate approval delegation |
| Employee offboarding| SCIM deprovisioning → revoke all permissions → transfer domain_owner → audit record |
| Department merger   | Merge tenants → merge budgets → recalculate SLO → migrate Pack ownership  |
| Org restructuring   | Rebuild reporting_chain → refresh approval routes → notify affected domain_owners |

---

# 47. Organization-Based Approval Routing

> Dynamic approval routing based on the org-chart, replacing static approver lists.
> Related: §21 HITL · §46 Organization Hierarchy · §10 Risk Control

## 47.1 Dynamic Approval Routing Engine

The approval routing engine dynamically computes the approval chain based on request context, replacing static approver lists:

| Routing Factor  | Description                                         |
| --------------- | --------------------------------------------------- |
| Risk level      | Higher risk_level (§10) requires higher approval level |
| Cost threshold  | Match against approval amount matrix (§47.2) per §18 cost estimate |
| Org level       | Walk up OrgTree (§46) to find approver at the corresponding level |
| Delegation rule | Auto-route to delegate when approver is absent (§47.3) |

The engine supports parallel co-signing and sequential step-by-step approval. Each step has an independent timeout; on timeout, the request auto-escalates to a higher org level per escalation_policy. Separation of Duties (SoD) checks ensure the requester and approver are not the same person.

## 47.2 Approval Amount Matrix

| Risk Amount | Auto | Manager | Director | VP  | CFO/CTO |
| ----------- | ---- | ------- | -------- | --- | ------- |
| < ¥1,000    | ✓    |         |          |     |         |
| ¥1K-10K     |      | ✓       |          |     |         |
| ¥10K-100K   |      |         | ✓        |     |         |
| ¥100K-1M    |      |         |          | ✓   |         |
| > ¥1M       |      |         |          |     | ✓       |

## 47.3 Absence Auto-Delegation

When the approver is absent, the system finds a delegate in this priority order:

1. Explicit DelegationOfAuthority
2. Skip-level manager (one level up on the org-chart)
3. Same-level peer in the same department (if configured)
4. On timeout, execute ApprovalTimeoutPolicy (§21)

---

# 48. Enterprise SSO/SCIM Integration Architecture

> Integrate with enterprise identity providers for automatic user lifecycle management.
> Related: §6.5 Authentication · §11 Security · §46 Organization Hierarchy

## 48.1 Identity Integration Protocols

| Protocol     | Purpose                      | Priority  |
| ------------ | ---------------------------- | --------- |
| **OIDC**     | SSO login (existing §6.5)    | Supported |
| **SAML 2.0** | SSO login (legacy enterprise IdP) | Required |
| **SCIM 2.0** | Automatic user/group sync    | Required  |
| **HR API**   | Org-chart sync (optional)    | Optional  |

## 48.2 SCIM Integration Model

The platform implements a SCIM 2.0 Server endpoint to receive user and group changes pushed by the enterprise IdP:

| Endpoint  | Supported Operations                  | Description                                       |
| --------- | ------------------------------------- | ------------------------------------------------- |
| `/Users`  | GET / POST / PUT / PATCH / DELETE     | User CRUD, mapped to platform principal            |
| `/Groups` | GET / POST / PUT / PATCH / DELETE     | Group CRUD, mapped to OrgNode (§46) team           |

SCIM sync automatically maintains the principal ↔ OrgNode association. On user deprovisioning, active sessions are revoked immediately and owned Agents are suspended, ensuring zero residual access. All sync operations are audit-logged; conflicts defer to the IdP as the authoritative source.

## 48.3 User Lifecycle Automation

```text
IdP Event                   Platform Response
─────────                   ─────────────────
User Created ──────────▶ Create principal + assign role + join org_node + welcome onboarding
User Updated ──────────▶ Sync attributes + update reporting_chain + adjust permissions
User Deactivated ──────▶ Immediately revoke all active sessions + suspend all owned Agents
User Deleted ──────────▶ Transfer domain_owner + archive audit records + trigger data_retention
Group Changed ─────────▶ Batch update role mapping + refresh approval routes (§47)
```

---

# 49. Per-Department Compliance Policy Engine

> Enable different departments to enforce different compliance frameworks (SOX + HIPAA + PCI-DSS + GDPR coexisting).
> Related: §23 Compliance · §37.3 DomainRiskProfile · §46 Organization Hierarchy

## 49.1 Compliance Framework Registry

ComplianceFramework defines activatable compliance frameworks, supporting multi-framework coexistence:

| Field               | Type                                             | Description                        |
| ------------------- | ------------------------------------------------ | ---------------------------------- |
| `frameworkId`       | string (ULID)                                    | Globally unique identifier         |
| `type`              | enum: GDPR / SOC2 / PIPL / HIPAA / SOX / PCI_DSS | Compliance framework type          |
| `rules`             | ComplianceRule[]                                 | List of specific control items     |
| `auditRequirements` | AuditSpec[]                                      | Audit frequency, evidence types, retention period |
| `reportTemplate`    | string                                           | Compliance report template ID      |

Frameworks are activated at tenant granularity — different departments within the same platform can enforce different compliance combinations (§49.2 inheritance). Framework changes require platform_admin approval; once activated, corresponding ConstraintPack constraints are automatically injected.

## 49.2 Compliance Policy Inheritance

```text
company:  [Base Security Policy] + [Data Classification Policy]
    │
    ├── finance_division:  inherit + [SOX]
    │   ├── accounting_dept: inherit + [SOX-404 Enhanced]
    │   └── payment_dept:   inherit + [PCI-DSS]
    │
    ├── healthcare_division: inherit + [HIPAA]
    │
    └── eu_operations:      inherit + [GDPR]
```

Rule: child nodes **inherit** all parent compliance constraints, may **add** but cannot **relax** them.

## 49.3 Automatic Compliance Evidence Collection

| Compliance Control    | Evidence Source                 | Collection Method                         |
| --------------------- | ------------------------------ | ----------------------------------------- |
| SOX access review     | §11.2 RBAC + §28 audit log    | Quarterly auto-export of access permission snapshots |
| SOX separation of duties | §47 SodRouting              | Auto-verify no approval chain violations  |
| HIPAA data encryption | §23.5 encryption architecture  | Continuous monitoring of encryption status |
| PCI-DSS scope restriction | §46 tenant isolation        | Auto-verify CDE boundary                 |
| GDPR right to erasure | §23.2 crypto-shredding        | Auto-record deletion execution evidence   |

---

# 50. Knowledge Domain Isolation and Controlled Sharing

> Enforce isolation of knowledge assets across departments with approval-based cross-domain sharing.
> Related: §29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 Organization Hierarchy · §11 Security

## 50.1 Knowledge Isolation Model

KnowledgeBoundary defines isolation boundaries for knowledge assets, denying cross-domain access by default:

| Field              | Type                      | Description                                            |
| ------------------ | ------------------------- | ------------------------------------------------------ |
| `boundaryId`       | string (ULID)             | Unique boundary identifier                             |
| `ownerOrgNode`     | string                    | Owning org node (§46), determines ownership            |
| `accessPolicy`     | enum: strict / controlled | strict = full isolation; controlled = shareable after approval |
| `allowedConsumers` | OrgNodeRef[]              | Authorized consumer list (effective only in controlled mode) |
| `auditOnAccess`    | boolean (default true)    | Whether each access is written to audit log            |

All knowledge queries are enforced against boundaries by KnowledgeFederator (§50.2) at execution time. Unauthorized cross-boundary requests are rejected and do not reveal the existence of the target knowledge.

## 50.2 Knowledge Federated Search

When an Agent searches knowledge, KnowledgeFederator filters results by permission:

```text
Agent search request
    │
    ▼
┌────────────────┐
│ Knowledge      │
│ Federator      │
└───┬────────────┘
    │
    ├──▶ [Knowledge within own boundary] → return directly
    ├──▶ [Controlled boundary knowledge] → check CrossBoundaryRule → return if authorized (possibly transformed)
    └──▶ [Strict boundary knowledge] → completely invisible (existence not revealed)
```

## 50.3 Chinese Wall (Information Barrier)

Financial services scenarios require:

- M&A team knowledge is **completely invisible** to other departments
- The same person cannot access knowledge of conflicting parties simultaneously
- Once party A's knowledge is accessed, access to party B's knowledge is automatically blocked (dynamic information barrier)

---

# 51. Tiered Governance Delegation

> Enable department admins to self-govern within guardrails set by the platform team, so the platform team is no longer the bottleneck for all governance changes.
> Related: §24 Configuration Governance · §37.9 DomainGovernancePolicy · §46 Organization Hierarchy

## 51.1 Governance Permission Tiers

GovernancePermission defines governance operation permissions for each org level:

| Field          | Type                                       | Description                             |
| -------------- | ------------------------------------------ | --------------------------------------- |
| `permissionId` | string (ULID)                              | Unique permission identifier            |
| `scope`        | { orgNode: string, resourceType: string }  | Scope: org node + resource type         |
| `level`        | enum: view / operate / admin / super_admin | Permission level, increasing            |
| `delegatable`  | boolean                                    | Whether downward delegation is allowed  |
| `expiresAt`    | ISO8601 \| null                            | Expiration time; null means permanent   |

Permissions follow the principle of least privilege: view = read-only; operate = daily operations; admin = modify domain-level policies; super_admin = modify global guardrails. Delegated permissions cannot exceed the delegator's own level.

## 51.2 Governance Inheritance and Override Rules

```text
platform_team sets global guardrails
    │
    ▼ inherit (cannot relax)
division_admin sets division policies
    │
    ▼ inherit (cannot relax) + may add
department_admin sets department policies
    │
    ▼ inherit (cannot relax) + may add
team_lead daily operational config
```

| Operation                        | Parent Can        | Child Can         |
| -------------------------------- | ----------------- | ----------------- |
| Tighten policy (lower max_risk)  | ✓                 | ✓                 |
| Relax policy (raise max_risk)    | ✓                 | ✗                 |
| Add constraints                  | ✓                 | ✓                 |
| Remove parent's constraints      | ✓ (own only)      | ✗                 |
| Allocate budget                  | ✓ (within quota)  | ✓ (within quota)  |

## 51.3 Self-Service Governance Console

| Feature                       | Dept Admin Available     | Platform Team Available |
| ----------------------------- | ------------------------ | ----------------------- |
| Domain onboarding wizard (§44.2) | ✓ (low/medium risk domains) | ✓ (all domains)      |
| Modify approval rules        | ✓ (within amount cap)    | ✓ (unrestricted)       |
| Publish Pack                  | ✓ (with auto security scan) | ✓                    |
| Adjust Agent autonomy (§42)  | ✓ (not exceeding domain cap) | ✓                   |
| Create triggers (§41)        | ✓ (low/medium risk)      | ✓                      |
| Modify global guardrails     | ✗                         | ✓                      |
| Cross-department policies    | ✗                         | ✓                      |

---

# Part VIII — Scale & Ecosystem Layer (§52-§57)

---
# 52. Multi-Region Deployment Architecture

> Support global enterprises running across Regions with compliance, data sovereignty, traffic routing, and fault isolation.
> Related: §31 Disaster Recovery · §32 Deployment · §23 Compliance · §46 Organization Hierarchy

## 52.1 Region Model

| Field               | Type                        | Description                                                |
| ------------------- | --------------------------- | ---------------------------------------------------------- |
| regionId            | string                      | Globally unique, e.g. `cn-east-1`, `eu-west-1`            |
| provider            | AWS / GCP / Azure / private | Underlying infrastructure provider                         |
| status              | active / standby / draining | active = primary; standby = warm spare; draining = migrating out |
| endpoints           | `{ api, ws, internal }[]`   | Entry addresses for each plane                             |
| dataResidencyPolicy | string                      | Permitted data jurisdiction, e.g. `EU-only`, `CN-only`     |

Multi-Region deployment requires each Region to reach at least §31 HA-3 level (multi-AZ deployment), ensuring a single Region failure does not affect global availability.

## 52.2 Region-Aware Architecture

```text
                    ┌──────────────────────┐
                    │  Global Control Plane │ (metadata federation)
                    │  Region routing · policy sync │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ CN Region     │ │ EU Region     │ │ US Region     │
    │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │
    │ │ P1-P5     │ │ │ │ P1-P5     │ │ │ │ P1-P5     │ │
    │ │ Full 5-Plane│ │ │ │ Full 5-Plane│ │ │ │ Full 5-Plane│ │
    │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
    │ Data: CN      │ │ Data: EU      │ │ Data: US      │
    │ Compliance: PIPL│ │ Compliance: GDPR│ │ Compliance: SOX │
    └───────────────┘ └───────────────┘ └───────────────┘
```

## 52.3 Cross-Region Workflow Routing

| Scenario                                 | Routing Strategy                        | Data Handling                       |
| ---------------------------------------- | --------------------------------------- | ----------------------------------- |
| User in EU, task involves EU data only   | Region affinity, stay in EU             | Local processing                    |
| User in CN, needs US-based LLM           | Execute in CN, route LLM request to US  | Allowed cross-border if no PII in I/O |
| Cross-Region collaboration (EU mkt + US eng) | Execute in respective Regions, sync metadata | Exchange only anonymized/aggregated data |
| Region failure failover                  | Manual/semi-auto switch to standby Region | Metadata pre-replicated; business data stays local |

## 52.4 Cross-Border Data Transfer Compliance

| Jurisdiction | Compliance Framework                                         | Platform Mechanism                                                                                          |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| EU → non-EU  | GDPR Chapter V — SCCs (Standard Contractual Clauses)         | Cross-Region LLM calls auto-attach SCC DPA reference; auto DPIA (Data Protection Impact Assessment) before transfer |
| EU → US      | EU-US Data Privacy Framework                                 | Verify provider is on DPF list; fall back to SCC if not listed                                              |
| CN → overseas| PIPL Article 38 — security assessment / standard contract    | Auto data volume assessment before cross-border; security assessment record required if threshold exceeded   |
| Intra-group  | BCRs (Binding Corporate Rules)                               | Enterprise BCR template; platform auto-references BCR ID in cross-border transfers and logs                 |

**Cross-Border Transfer Control Chain**:

```text
Cross-Region data request
    │
    ▼
┌──────────────────┐
│ Jurisdiction      │  Identify source/target jurisdiction
│ Classifier        │
├──────────────────┤
│ Transfer Impact   │  Auto DPIA scoring; high impact → manual approval
│ Assessor          │
├──────────────────┤
│ Mechanism         │  Select compliance mechanism: SCC / BCR / DPF / security assessment
│ Selector          │
├──────────────────┤
│ Data Minimizer    │  Transfer only necessary fields; PII de-identification/pseudonymization
├──────────────────┤
│ Transfer Logger   │  Full transfer log (source, target, legal basis, data volume, timestamp)
└──────────────────┘
```

---

# 53. Resource Contention Management at Scale

> Fair scheduling, priority preemption, and capacity guarantees for 5000+ concurrent workflow scenarios.
> Related: §8 Scalability · §9 Stability · §14 Runtime · §46 Organization Hierarchy · §54 SLA

## 53.1 Scheduling Layers

```text
┌─────────────────────────────────┐
│  Admission Controller           │  Global admission control
│  (reject requests exceeding     │
│   platform capacity)            │
├─────────────────────────────────┤
│  Quota Manager                  │  Department-level quota management
│  (guarantee/limit each dept's   │
│   resource share)               │
├─────────────────────────────────┤
│  Priority Scheduler             │  Priority-aware scheduling
│  (SLA-aware + preemption)       │
├─────────────────────────────────┤
│  Worker Pool                    │  Execution layer
└─────────────────────────────────┘
```

## 53.2 Resource Quota Model

| Field          | Type                                    | Description                                    |
| -------------- | --------------------------------------- | ---------------------------------------------- |
| quotaId        | string                                  | Unique quota identifier                        |
| tenantId       | string                                  | Owning department/tenant                       |
| resource       | cpu / memory / tokens / concurrent_runs | Controlled resource type                       |
| limit          | number                                  | Quota upper limit                              |
| used           | number                                  | Current usage (updated in real time)           |
| period         | hourly / daily / monthly                | Quota period; used resets automatically at end |
| overflowPolicy | queue / reject / burst                  | Overflow strategy: queue, reject, or allow short burst |

## 53.3 Priority Preemption

| Priority        | Scenario               | Preemption Strategy         | Start SLA |
| --------------- | ---------------------- | --------------------------- | --------- |
| critical(1000)  | Production incident fix| Can preempt all non-critical| < 10s     |
| high(800)       | E-commerce order processing | Can preempt standard and below | < 30s |
| standard(500)   | Daily business workflow| No preemption               | < 5min    |
| background(200) | Batch analysis / reports | No preemption, runs on idle | Best effort |
| best_effort(0)  | Experimental tasks     | No preemption, preemptable anytime | None  |

## 53.4 Fair Scheduling

- **Weighted Fair Queuing**: each department gets a weight based on its guaranteed quota
- **Borrowing**: when a department has not used its guaranteed quota, idle resources can be burst-used by other departments
- **Reclaim**: when the original department needs resources, borrowed resources are returned after the current step completes (graceful reclaim)
- **Starvation Prevention**: any department's standard-priority task queued for over 30min is auto-promoted to high

---

# 54. SLA Tiered Guarantees

> Provide differentiated SLA guarantees for different business criticality levels, including resource reservation and violation response.
> Related: §27 SLO · §37.9 DomainGovernancePolicy · §53 Resource Contention

## 54.1 SLA Tier Model

| Field          | Type                                    | Description                                     |
| -------------- | --------------------------------------- | ----------------------------------------------- |
| tierId         | string                                  | Unique Tier identifier                          |
| name           | platinum / gold / silver / bronze       | Tier name, corresponding to §54.2 matrix        |
| availability   | number (%)                              | Committed availability, e.g. 99.99%             |
| maxLatencyP99  | number (ms)                             | P99 latency ceiling                             |
| priorityWeight | number (1-100)                          | Scheduling priority weight, Platinum=100, Bronze=10 |
| costMultiplier | number                                  | Resource cost multiplier relative to Bronze      |
| supportLevel   | 24x7_dedicated / 24x7 / 8x5 / community | Corresponding support level                     |

## 54.2 SLA Tier Matrix

| Tier         | Availability | P95 Latency | Queue Limit | Recovery Priority | Use Case                    |
| ------------ | ------------ | ----------- | ----------- | ----------------- | --------------------------- |
| **Platinum** | 99.99%       | < 2s        | < 5s        | Highest           | Online transactions, real-time risk control |
| **Gold**     | 99.95%       | < 5s        | < 30s       | High              | Core business workflow      |
| **Silver**   | 99.9%        | < 15s       | < 5min      | Medium            | Daily operations            |
| **Bronze**   | 99.5%        | < 60s       | < 30min     | Low               | Internal tools, experiments |

## 54.3 SLA-Aware Scheduling

Dispatcher (§14.2) considers SLA Tier during scheduling:

1. **Queue check**: auto-promote priority when workflow queue time approaches `max_queue_time`
2. **Latency prediction**: predict whether workflow will violate SLA based on historical data, scale out or preempt proactively
3. **Resource reservation**: `resource_reservation` for Platinum/Gold tiers is always reserved and cannot be consumed by burst
4. **Violation response**: on SLA violation, auto-execute per `ViolationResponse` (alert / scale-out / preempt / escalate)

---

# 55. Agent Marketplace and Ecosystem

> Build an internal/external ecosystem marketplace for Packs, Plugins, templates, and connectors.
> Related: §30 Business Pack · §37.7 DomainRecipe · §22 SDK/DX

## 55.1 Marketplace Architecture

```text
┌───────────────────────────────────────────┐
│  Marketplace Registry                     │
│  ├── Pack Store      (Business domain Packs) │
│  ├── Plugin Store    (Feature plugins)    │
│  ├── Connector Store (External connectors) │
│  ├── Template Store  (Workflow templates) │
│  ├── Prompt Store    (Domain prompt library) │
│  └── Eval Store      (Evaluation datasets) │
├───────────────────────────────────────────┤
│  Quality & Security Gate                  │
│  Auto scan · compatibility test · sandbox verification │
├───────────────────────────────────────────┤
│  Discovery & Recommendation               │
│  Search · categorization · rating · smart recommendation │
└───────────────────────────────────────────┘
```

## 55.2 Marketplace Entry Model

| Field               | Type                               | Description                          |
| ------------------- | ---------------------------------- | ------------------------------------ |
| entryId             | string                             | Unique entry identifier              |
| packId              | string                             | Associated Pack/Plugin/Connector ID  |
| publisher           | string                             | Publisher (org or individual)        |
| version             | semver                             | Current published version            |
| pricing             | free / enterprise_included / paid  | Pricing model, see §55.4            |
| rating              | number (0-5)                       | User aggregate rating                |
| installCount        | number                             | Cumulative install count             |
| certificationStatus | uncertified / verified / certified | Platform certification status        |
| dependencies        | `{ item_id, version_range }[]`     | Dependency list, see §55.6          |

## 55.3 Installation and Governance

| Publisher Type       | Install Approval           | Security Requirements            | Update Policy     |
| -------------------- | -------------------------- | -------------------------------- | ----------------- |
| platform_official    | Auto-install               | Reviewed by platform team        | Auto-update       |
| enterprise_internal  | Dept admin approval        | Automated security scan          | Auto after notice |
| verified_third_party | Dept admin + security team | Auto scan + manual review        | Manual confirm    |
| community            | Platform team approval     | Full security review + sandbox test | Manual confirm |

## 55.4 Revenue Sharing Model

| Pricing Type        | Sharing Rule                                            | Settlement Cycle |
| ------------------- | ------------------------------------------------------- | ---------------- |
| free                | No sharing                                              | —                |
| enterprise_included | Included in platform license; publisher earns credits by install count | Quarterly |
| paid (third_party)  | Publisher 70% / platform 30%                            | Monthly          |
| paid (community)    | Publisher 80% / platform 20% (encourage community contributions) | Monthly   |

## 55.5 Entry Deprecation Lifecycle

| Phase      | Trigger Condition                                                | Platform Action                                                               |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| active     | Normal operation                                                 | —                                                                             |
| deprecated | Publisher marks deprecated, or 90 days no update + known vulnerability | Show deprecation warning on install page; new installs require confirmation; recommend alternatives |
| sunset     | 180 days after deprecated                                        | Block new installs; send migration notice to existing installs (30-day countdown) |
| removed    | Sunset countdown ends                                            | Remove from Registry; installed instances frozen (no new tasks); data retained 90 days |

## 55.6 Dependency Management

- Each MarketplaceItem declares `dependencies: { item_id: string; version_range: string }[]`
- On install, dependency tree is auto-resolved with version conflict detection (similar to npm/cargo resolution)
- On uninstall, reverse dependencies are checked; blocked if other items depend on it
- When a dependency is deprecated, all dependent publishers and install users are auto-notified

---

# 56. Feedback-Driven Continuous Improvement Pipeline

> Materialize the §13 Learn/Improve black-box interface into a runnable automatic improvement pipeline.
> Related: §13 OAPEFLIR L-I-R · §17 Model Evaluation · §37.5 DomainEvalFramework · §42 Progressive Autonomy

## 56.1 Improvement Pipeline Overview

```text
Production execution data
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Signal       │────▶│ Analysis     │────▶│ Improvement  │
│ Collector    │     │ Engine       │     │ Generator    │
│ (signal collection)│ │ (pattern analysis)│ │ (improvement gen) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Quality Gate │
                                           │              │──▶ §17 Eval
                                           └──────┬───────┘
                                                  │ pass
                                           ┌──────▼───────┐
                                           │ Gradual      │
                                           │ Rollout      │──▶ §16 Prompt canary
                                           └──────────────┘
```

## 56.2 Signal Collection

**Design Decision: 3D FeedbackSignal Structure vs Flat Enum**

The `FeedbackSignalType` in the architecture doc uses a flat 9-type enum. The actual implementation (`src/platform/orchestration/oapeflir/types/feedback-signal.ts`) adopts a 3D orthogonal structure:

**Why 3D instead of flat 9-type enum:**

| Design Concern | Flat Enum                      | 3D Orthogonal Structure                        |
| -------------- | ------------------------------ | ---------------------------------------------- |
| Composability  | 9 fixed combinations           | 5×5×4=100 potential combinations               |
| Extensibility  | New types require enum changes | Extend any dimension independently             |
| Filter/Query   | Requires N OR conditions       | Filter independently by source/category/severity |
| Void combos    | May have meaningless "valid" combos | Business logic determines valid combinations |

This design allows FeedbackSignal to express finer-grained feedback while maintaining orthogonality between dimensions for easier analysis and routing. The flat enum in the architecture doc is for conceptual illustration; the actual implementation follows the 3D structure.

## 56.3 Automatic Improvement Types

| Improvement Type       | Trigger Condition                       | Automation Level                           | Output                                       |
| ---------------------- | --------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| **Few-shot harvesting** | User approvals accumulated > 10        | Fully automatic                            | New few-shot examples added to PromptLibrary |
| **Prompt tuning**      | Same-type user_correction > 5           | Semi-auto (generate candidates → human review) | Prompt modification suggestions           |
| **Model routing optimization** | cost_anomaly or latency_anomaly  | Fully automatic                            | ModelGateway routing rule update             |
| **Risk rule adjustment** | Consecutive false positive approvals > 10 | Semi-auto (suggest → domain_owner confirms) | Risk threshold adjustment suggestions     |
| **Knowledge base update** | quality_drift + knowledge source expired | Fully automatic                          | Trigger knowledge source refresh             |
| **Autonomy adjustment** | Cumulative performance data meets promotion criteria | Per §42 rules                  | Autonomy promotion/demotion                  |

## 56.4 Safety Guardrails

- Automatic improvements **must never** relax security policies or compliance controls
- Fully automatic improvements are limited to **non-risk changes** (few-shot additions, routing optimization, knowledge refresh)
- Changes to core Prompt logic or risk rules must undergo human review
- All automatic improvements are logged to event_log, auditable and rollbackable

---

# 57. External System Integration Framework

> Provide a standardized connector framework and pre-built connector catalog, enabling Agents to interface with real business systems.
> Related: §14.4 Executor · §11.5 Outbound Control · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 Connector Abstraction

| Interface Method            | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `connect(config)`           | Establish connection with credentials and endpoint config    |
| `execute(action, params)`   | Execute specified operation (CRUD/query/call), return standardized result |
| `healthCheck()`             | Liveness probe, return connection status and latency         |
| `disconnect()`              | Graceful shutdown, release resources                         |

Supported protocols: REST / gRPC / MCP / Database (JDBC/ODBC) / File (S3/NFS) / Browser (Headless). Each connector includes a `ConnectorManifest` declaring supported actions, auth methods, rate limits, and required permissions for dynamic discovery by Toolbelt (§14.4).

## 57.2 Connector Lifecycle

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Install  │────▶│ Configure│────▶│ Authorize│────▶│ Active   │
│          │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                 ┌──────▼─────┐
                                                 │ Monitor    │
                                                 │            │
                                                 └──────┬─────┘
                                                        │ anomaly
                                                 ┌──────▼─────┐
                                                 │ Degrade/   │
                                                 │ Reconnect  │
                                                 └────────────┘
```

## 57.3 Pre-Built Connector Catalog (Phase 1)

| Category | Connector               | Priority | Capabilities                        |
| -------- | ----------------------- | -------- | ----------------------------------- |
| Messaging| Feishu/WeCom/DingTalk   | P0       | Send messages, push approvals, read calendar |
| Messaging| Email (SMTP/IMAP)       | P0       | Send, receive, search               |
| Storage  | Alibaba Cloud OSS / S3  | P0       | Upload, download, list              |
| Dev      | GitHub/GitLab           | P0       | PR, Issue, code search              |
| Database | MySQL/PostgreSQL        | P0       | Query, write                        |
| Social   | WeChat Official Account | P1       | Message push, menu management       |
| E-commerce| Youzan                 | P1       | Order query, product management     |
| Finance  | Yonyou                  | P1       | Voucher query, report export        |
| Analytics| Sensors Data            | P1       | Event query, user profiling         |
| Payment  | Alipay/WeChat Pay       | P2       | Place order, refund, query          |

## 57.4 Connector SDK

Community and enterprise internal teams can develop custom connectors via the Connector SDK and publish them to Marketplace (§55).

---
# Part IX -- Operational Maturity Layer (S59-S69)

---

# 59. Agent Explainability and Decision Transparency Architecture

> Build user-facing causal explanation capabilities for every Agent decision, meeting EU AI Act / GDPR Article 22 compliance requirements and providing a trust foundation for progressive autonomy (§42).
> Related: §12.7 Tracing · §13 OAPEFLIR · §17 Quality Gates · §23.6 Data Lineage · §39 NL Entry · §42 Progressive Autonomy

## 59.1 Design Principles

- Every stage of each OAPEFLIR cycle **must** generate a `StageRationale` record
- Explanations are generated lazily (on-demand), adding no overhead to the normal execution path
- Explanation depth is configured per domain: finance requires forensic-level, customer service requires summary-level
- Explanation caching avoids repeated LLM calls
- Explanations are tamper-proof and ingested into the Evidence Plane

## 59.2 Explanation Pipeline

```text
User asks "Why?"
    │
    ▼
ExplanationRequest { workflow_id, step_id?, depth }
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← Collects StageRationale + ToolCallLog + KnowledgeCitation from P5
└────────┬────────┘
         ▼
┌─────────────────┐
│ CausalChainBuilder│  ← Builds causal chain of Observe→Assess→Plan→Execute
└────────┬────────┘
         ▼
┌─────────────────┐
│ ExplanationRenderer│  ← Renders to NL text based on depth and locale
└────────┬────────┘
         ▼
ExplanationResponse { summary, causal_chain[], evidence_refs[], confidence }
```

## 59.3 StageRationale Data Model

| Field               | Type            | Description                                                          |
| ------------------- | --------------- | -------------------------------------------------------------------- |
| rationaleId         | string          | Unique identifier                                                    |
| stageId             | string          | Associated OAPEFLIR stage ID                                         |
| decision            | string          | Decision made at this stage (e.g. selected tool, generated plan)     |
| reason              | string          | Structured description of decision rationale                         |
| alternatives        | `Alternative[]` | Rejected alternatives with reasons for rejection                     |
| confidence          | number (0-1)    | Decision confidence score                                            |
| evidenceRefs        | `string[]`      | Evidence references supporting the decision (ToolCallLog, KnowledgeCitation, etc.) |
| renderedExplanation | string (lazy)   | User-facing NL explanation, rendered on demand and cached            |

## 59.4 Explanation Depth Levels

| Depth        | Use Case                     | Content                                                           |
| ------------ | ---------------------------- | ----------------------------------------------------------------- |
| L1 Summary   | Non-technical users, daily   | One-sentence overview: "Auto-scaled 2 instances due to anomalous traffic" |
| L2 Reasoning | Business owner review        | Causal chain + key data points + alternatives                     |
| L3 Forensic  | Compliance audit / Incident  | Full evidence chain + all I/O + knowledge citations + model call details |

## 59.5 Integration with NL Entry

§39 NL interaction pipeline adds a `why` Intent type:

Users can ask "Why was the last release rolled back?" in natural language; the system parses it as a WhyQuery and invokes the explanation pipeline.

## 59.6 Explanation Caching and Security

- L1/L2 explanation cache TTL = 24h; L3 is not cached (ensures latest evidence)
- Explanation content is subject to §50 knowledge domain isolation — only evidence within the user's permissions is visible
- Explanation logs themselves are included in the audit trail (§23), recording who viewed what explanation and when

---

# 60. Emergency Brake and Global Circuit Breaker Architecture

> Provides a single atomic operation to halt all Agent execution across the platform within < 5 seconds, for emergencies such as security incidents, Prompt injection attacks, and Agent escapes.
> Related: §9 Stability · §10 Risk Control · §11 Security · §12 Incident Events · §52 Multi-Region

## 60.1 PlatformPanicDirective

| Field             | Type                     | Description                                                    |
| ----------------- | ------------------------ | -------------------------------------------------------------- |
| directiveId       | string                   | Unique directive identifier                                    |
| severity          | full / partial           | full = platform-wide halt; partial = scoped halt               |
| scope             | global / tenant / domain | Circuit breaker scope                                          |
| reason            | string                   | Trigger reason (security incident description)                 |
| issuedBy          | string                   | Issuer identity                                                |
| requiredApprovers | string[] (min 2)         | Dual-approval requirement to prevent single-point misoperation |
| ttlSeconds        | number                   | Auto-expiry time; explicit renewal or release required after   |
| rollbackStrategy  | freeze / graceful_drain  | freeze = immediate freeze; graceful_drain = wait for in-flight steps |

## 60.2 Circuit Breaker Propagation

```text
PlatformPanicDirective
    │
    ├──▶ P1 Interface Plane: Reject all new requests (503), close WebSocket
    │
    ├──▶ P2 Control Plane: Revoke all active Agent tokens
    │
    ├──▶ P3 Orchestration Plane: Suspend all in-flight OAPEFLIR cycles
    │
    ├──▶ P4 Execution Plane: Abort all workers, roll back uncommitted side effects
    │
    ├──▶ P5 State Plane: Generate ForensicSnapshot, set read-only mode
    │
    └──▶ X1 Fabric: Block all egress, trigger alerts to all channels
```

**SLA**: From Directive issuance to all-plane confirmed halt < 5 seconds (same Region), < 15 seconds (cross-Region).

## 60.3 Safe Recovery Protocol

| Step | Action                          | Requirement                                                 |
| ---- | ------------------------------- | ----------------------------------------------------------- |
| 1    | ForensicSnapshot review         | Security team confirms threat is eliminated                 |
| 2    | PlatformResumeDirective issued  | Requires ≥ 2 platform_admin dual approval                   |
| 3    | Progressive recovery            | Restore read-only queries → low-risk workflows → full recovery |
| 4    | Post-incident report            | Publish Post-Incident Report within 72h                     |

**Admin unavailability fallback**: If fewer than 2 platform_admins are online for over 4 hours, the following degraded recovery path activates:

1. System sends multi-channel emergency notifications to all platform_admins (SMS + phone + WeCom/Feishu/DingTalk)
2. After 4h with no response, `break_glass` mechanism is authorized — 1 platform_admin + 1 security_team member can substitute for dual admin approval
3. After 8h with still no response, auto-restore to read-only mode (queries and monitoring allowed, writes and new workflows prohibited); full recovery still requires dual approval
4. All `break_glass` recovery operations are logged as P0 audit events; platform_admin review must be completed within 72h

## 60.4 Regular Drills

- At least one emergency brake drill per quarter (scoped to a selected tenant)
- Drill results are included in §36 success criteria
- ForensicSnapshots generated during drills are used to verify forensic completeness

---

# 61. Agent Unified Lifecycle Management Architecture

> Models the Agent as a first-class entity — a composite of Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config — managing the complete lifecycle from creation to retirement.
> Related: §16 Prompt · §30 Pack · §42 Progressive Autonomy · §41 Proactive Agent · §55 Marketplace

## 61.1 AgentDefinition Composite Entity

AgentDefinition is the complete definition of an Agent, composed of the following components:

| Component         | Source             | Description                               |
| ----------------- | ------------------ | ----------------------------------------- |
| Pack              | §30 Business Pack  | Business domain capability pack           |
| PromptSet         | §16 Prompt Library | Planner/Generator/Evaluator Prompt set    |
| ModelBinding      | §15 ModelGateway   | Model routing config (primary + fallback) |
| TrustProfile      | §42 Progressive Autonomy | Trust level and autonomy config     |
| TriggerPolicy     | §41 Proactive Agent | Trigger conditions and scheduling policy |
| ConnectorBindings | §57 Connector Framework | Bound external system connectors    |

AgentDefinition is immutable per version — any component change produces a new AgentVersion.

## 61.2 AgentVersion Snapshot

| Field          | Type                                           | Description                                        |
| -------------- | ---------------------------------------------- | -------------------------------------------------- |
| versionId      | string                                         | Unique version identifier                          |
| agentId        | string                                         | Parent Agent ID                                    |
| definition     | AgentDefinition (snapshot)                     | Complete definition snapshot for this version, immutable |
| status         | draft / canary / active / deprecated / retired | Version status, see §61.3 state machine            |
| publishedAt    | timestamp                                      | Publish time                                       |
| publishedBy    | string                                         | Publisher identity                                 |
| rollbackTarget | versionId?                                     | Rollback target version for one-click composite rollback (§61.4) |

## 61.3 Lifecycle State Machine

```text
draft ──▶ testing ──▶ staging ──▶ canary ──▶ active
                                              │
                          paused ◀────────────┘
                            │
                        deprecated ──▶ archived
```

| Transition          | Trigger               | Gate                                          |
| ------------------- | --------------------- | --------------------------------------------- |
| draft→testing       | Developer submission  | All component versions locked                 |
| testing→staging     | Tests passed          | §17 Quality Gates + security scan             |
| staging→canary      | Pre-release approval  | Domain admin approval                         |
| canary→active       | Canary metrics pass   | Auto-promotion (error rate < threshold + perf met) |
| active→paused       | Manual/auto pause     | Behavior drift detection (§63) or manual      |
| active→deprecated   | Version replaced      | Responsibility transfer to new version done   |
| deprecated→archived | TTL expired           | All historical references marked as archived  |

## 61.4 Composite Canary Release

Agent canary releases operate at the AgentVersion level (not per-component):

- **Traffic splitting**: Canary version receives 5%→20%→50%→100% traffic
- **Composite rollback**: One-click rollback to previous AgentVersion (all components atomically reverted)
- **Comparison testing**: Run two AgentVersions on the same input simultaneously, compare output differences

## 61.5 Agent Retirement and Responsibility Transfer

| Phase     | Action                                              | Timeline      |
| --------- | --------------------------------------------------- | ------------- |
| deprecate | Mark version as deprecated, publish deprecation notice | T+0        |
| notify    | Notify all downstream consumers and dependents      | T+0 ~ T+7d   |
| migrate   | Migrate in-flight tasks to replacement Agent/version | T+7d ~ T+25d |
| transfer  | Transfer knowledge assets, historical context to successor | T+25d ~ T+28d |
| archive   | Freeze execution capability, retain read-only history | T+30d       |
| delete    | Clear runtime resources, retain history per retention policy | T+30d+  |

A mandatory **30-day deprecation window** is enforced, during which the old version can still process existing tasks to ensure business continuity.

---

# 62. Offline and Edge Deployment Architecture

> Supports Agent execution in intermittently connected scenarios such as factory floors, retail stores, and mobile devices, operating in a local-first + eventual-sync mode.
> Related: §15 ModelGateway · §32 Deployment · §52 Multi-Region · §10 Risk Control

## 62.1 EdgeRuntime Minimal Runtime

```text
┌─────────────────────────────────────────┐
│  EdgeRuntime (local device / store server)  │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │P3-Lite   │  │P4-Lite   │  │P5-Local││
│  │Orchestr. │  │Execution │  │State   ││
│  └──────────┘  └──────────┘  └────────┘│
│  ┌──────────┐  ┌──────────┐            │
│  │LocalModel│  │SyncQueue │            │
│  │(sLLM)   │  │(offline) │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
         ▲ On reconnect ▼
┌─────────────────────────────────────────┐
│  Central Platform (Cloud)               │
│  P1 + P2 + P3 + P4 + P5 + X1           │
└─────────────────────────────────────────┘
```

## 62.2 Offline Execution Constraints

| Constraint      | Description                                                               |
| --------------- | ------------------------------------------------------------------------- |
| Risk ceiling    | Offline mode only allows actions with risk_level ≤ medium                 |
| Model downgrade | Uses local sLLM (e.g. Qwen-7B/Llama-3-8B), no cloud ModelGateway calls  |
| Side effect queue | All side effects written to local SyncQueue, batch-submitted on reconnect |
| Approval pending | Steps requiring approval enter pending state, awaiting reconnect         |
| Plan caching    | EdgeRuntime periodically pre-fetches ExecutionPlan templates from Central |

## 62.3 Sync Protocol

**Conflict resolution principle**: Central state is the authoritative source; side effects generated offline that conflict with Central default to Central-wins + generate an Incident for manual review.

## 62.4 Deployment Modes

| Mode          | Hardware Requirements         | Use Case                          |
| ------------- | ----------------------------- | --------------------------------- |
| Edge-Micro    | ARM/x86 SBC, 4GB RAM         | Retail POS, IoT gateway           |
| Edge-Standard | 8C/32GB server                | Factory floor, warehouse          |
| Edge-Mobile   | iOS/Android App               | Mobile field service              |
| Hybrid        | Local GPU server              | High-throughput local inference    |

---

# 63. Agent Behavior Drift Detection Architecture

> Goes beyond single-dimension quality metrics to establish multi-dimensional behavioral profiles and long-cycle changepoint detection, issuing early warnings before gradual Agent behavior changes lead to business risk.
> Related: §17 Quality Gates · §42 Progressive Autonomy · §43 Dashboard · §56 Feedback Improvement

## 63.1 Behavioral Fingerprint Model

| Field                   | Type                 | Description                                           |
| ----------------------- | -------------------- | ----------------------------------------------------- |
| agentId                 | string               | Target Agent                                          |
| window                  | 1h / 7d / 30d / 90d  | Fingerprint statistics window                        |
| tool_usage_distribution | `Map<toolId, ratio>` | Tool invocation distribution, detects tool preference drift |
| avg_step_count          | number               | Average step count, detects complexity changes        |
| avg_cost                | number               | Average cost, detects cost anomalies                  |
| success_rate            | number (0-1)         | Success rate                                          |
| risk_distribution       | `Map<level, ratio>`  | Risk level distribution                               |
| driftScore              | number (0-1)         | Composite drift score vs baseline, >0.7 triggers alert |

## 63.2 Changepoint Detection Engine

| Window    | Detection Algorithm             | Sensitivity | Purpose                                  |
| --------- | ------------------------------- | ----------- | ---------------------------------------- |
| 1h slide  | Z-Score anomaly detection       | High        | Sudden changes (after model/Prompt updates) |
| 7d slide  | CUSUM                           | Medium      | Short-term trends (knowledge base changes) |
| 30d slide | Bayesian Online Changepoint     | Medium      | Monthly drift (business environment shifts) |
| 90d slide | Drift Distance (KL/JS divergence) | Low       | Long-term baseline deviation             |

## 63.3 Drift Response Strategy

```text
BehaviorDriftAlert { agent_id, dimension, severity, drift_score }
    │
    ├── severity=low  → Log to §43 dashboard, tag "drift_warning"
    │
    ├── severity=medium → Notify domain admin + auto-lower autonomy_level by one tier (§42)
    │
    └── severity=high → Pause Agent (§61 paused) + trigger Incident (§12) + require manual review
```

## 63.4 Cross-Agent Anomaly Detection

Multiple Agents under the same DomainDescriptor form a control group. When one Agent's behavioral fingerprint significantly deviates from the control group, a `CrossAgentDriftAlert` should be issued even if that Agent has not triggered single-Agent thresholds.

---

# 64. Cost Attribution and Optimization Engine

> Building on §18 cost metering, adds decision-level cost attribution, automated optimization recommendations, and What-if simulation, transforming cost data from "viewable" to "actionable".
> Related: §18 Cost Management · §15 ModelGateway · §43 Dashboard · §54 SLA

## 64.1 Decision-Level Cost Attribution

| Field        | Type                           | Description                                             |
| ------------ | ------------------------------ | ------------------------------------------------------- |
| decisionId   | string                         | Associated HarnessDecision ID                           |
| llmCost      | number                         | LLM call cost for this decision                         |
| toolCost     | number                         | External tool/API call cost                             |
| computeCost  | number                         | Compute resource (Worker time) cost                     |
| totalCost    | number                         | Sum of the three                                        |
| attributedTo | agent / tenant / domain / task | Cost attribution dimension, supports multi-level drill-down |
| qualityRisk  | low / medium / high            | Quality risk tag for cost-quality tradeoff analysis     |

## 64.2 Automated Optimization Recommendations

| Recommendation | Detection Condition                        | Suggestion                              | Expected Savings |
| -------------- | ------------------------------------------ | --------------------------------------- | ---------------- |
| ModelDowngrade | Low-risk step uses premium model           | Switch to cost_optimized route          | 30-60%           |
| CacheHit       | Same query called repeatedly               | Enable semantic cache                   | 40-80%           |
| TokenTrim      | Avg input_tokens > 4x output_tokens        | Optimize Prompt or enable context compression | 20-40%     |
| BatchMerge     | Multiple independent steps can be merged   | Merge into single LLM call              | 50-70%           |
| ScheduleShift  | Non-urgent tasks executed during peak hours | Schedule to off-peak time slots         | 10-30%           |

## 64.3 What-if Cost Simulation

Supports cost impact simulation for the following change scenarios:

| Scenario       | Input Parameters                    | Output                                    |
| -------------- | ----------------------------------- | ----------------------------------------- |
| Model switch   | Target model, applicable step range | projectedCost, quality impact estimate    |
| Prompt change  | Token length delta of new Prompt    | Token cost delta, call count impact       |
| Tool replace   | Replacement tool and its unit price | Tool cost difference, latency impact      |
| Concurrency adj| Target concurrency                  | Compute cost, queue time changes          |

Each simulation outputs `projectedCost`, `qualityImpact`, `recommendation` (recommended / not recommended / needs further validation).

## 64.4 Cost Dashboard Integration

§43 Unified Operations Dashboard adds a "Cost Intelligence" panel:

- Top 10 highest-cost Agents / Domains / Workflows this month
- Actionable savings opportunities (sorted by expected savings)
- Cost trends vs budget comparison
- What-if simulation entry point

---

# 65. Workflow Visual Debugger Architecture

> Provides visual debugging and inspection capabilities for running/completed workflows, supporting real-time execution tracing, OAPEFLIR step-into debugging, and time-travel replay.
> Related: §12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow Builder · §59 Explainability

## 65.1 Debugger Capability Matrix

| Capability        | Running Workflow | Completed Workflow | Description                                          |
| ----------------- | --------------- | ------------------ | ---------------------------------------------------- |
| Execution timeline| ✓ (real-time)   | ✓                  | Start/end/status visualization per step              |
| OAPEFLIR step-in  | ✓               | ✓                  | Expand a step to view O/A/P/E/F/L/I/R stage details  |
| Data flow view    | ✓               | ✓                  | Input/output data flow between steps                 |
| Side effect diff  | ✗               | ✓                  | Expected vs actual side effect comparison            |
| Breakpoint debug  | ✓               | ✗                  | Pause execution at a specified step for manual inspection |
| Time travel       | ✗               | ✓                  | Replay execution from any checkpoint                 |
| Run comparison    | ✗               | ✓                  | Side-by-side comparison of two runs                  |

## 65.2 Real-time Execution Stream

```text
WebSocket /ws/v1/debug/{workflow_id}
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Timeline View                                           │
│  ┌────┐  ┌────┐  ┌────┐  ┌─────┐  ┌────┐               │
│  │ S1 │─▶│ S2 │─▶│ S3 │─▶│ S4  │─▶│ S5 │  ← current pos│
│  │ ✓  │  │ ✓  │  │ ▶  │  │ ... │  │ ...│               │
│  └────┘  └────┘  └────┘  └─────┘  └────┘               │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ OAPEFLIR expand│                           │
│              │ O: Collected 3 signals                     │
│              │ A: Risk score 0.4 (medium)                 │
│              │ P: Selected plan B (reason:...)            │
│              │ E: ▶ Executing...                          │
│              └─────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## 65.3 Breakpoint API

| Breakpoint Type | Description                                                    | Operations              |
| --------------- | -------------------------------------------------------------- | ----------------------- |
| step-level      | Pause at specified step number                                 | set / remove / list     |
| condition-based | Pause when condition is met (on error / risk ≥ threshold / cost ≥ threshold) | set(condition) / remove |
| watchpoint      | Pause when a monitored variable changes                        | set(variable) / remove  |

When a breakpoint is hit the Workflow enters paused state, and a `breakpoint_hit` event is pushed via WebSocket. The debugger can inspect the ContextSnapshot then execute `resume` / `step_over` / `abort`.

## 65.4 Run Comparison

Supports side-by-side comparison of two HarnessRuns:

| Comparison Dimension | Description                               |
| -------------------- | ----------------------------------------- |
| step diff            | Step count, order, added/missing steps    |
| decision diff        | HarnessDecision differences per step      |
| cost diff            | Per-stage and total cost comparison        |
| duration diff        | End-to-end and per-step duration comparison|
| outcome diff         | Final result and quality score differences |

Supports regression detection: automatically tags `regression_detected` when a new version's key metrics are worse than the previous version.

---

# 66. Compliance Report Auto-Generation Engine

> Automatically assembles evidence collected by the platform into audit-ready compliance reports, supporting SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS and other frameworks.
> Related: §23 Compliance · §49 Divisional Compliance · §12 Incident Events · §50 Knowledge Isolation

## 66.1 Report Template Registration

| Field               | Type                             | Description                                           |
| ------------------- | -------------------------------- | ----------------------------------------------------- |
| templateId          | string                           | Unique template identifier                            |
| framework           | GDPR / SOC2 / SOX / HIPAA / PIPL | Corresponding compliance framework                   |
| version             | semver                           | Template version, iterated when framework updates     |
| sections            | `Section[]`                      | Report section definitions (control point mapping + evidence requirements) |
| requiredDataSources | `string[]`                       | Required data sources (audit_log / metrics / config, etc.) |
| outputFormat        | PDF / HTML / JSON                | Supported output formats                              |
| lockedOnGeneration  | boolean                          | Template snapshot locked on generation for audit traceability |

## 66.2 Report Generation Pipeline

```text
ScheduledTrigger / OnDemandRequest
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← Collects evidence from P5, audit logs, config snapshots, metrics
└────────┬────────┘
         ▼
┌─────────────────┐
│ ControlMapper   │  ← Maps evidence to control points, marks pass/fail/partial
└────────┬────────┘
         ▼
┌─────────────────┐
│ GapAnalyzer     │  ← Identifies control points with insufficient evidence, generates remediation suggestions
└────────┬────────┘
         ▼
┌─────────────────┐
│ ReportRenderer  │  ← Generates PDF + CSV + JSON per framework template
└────────┬────────┘
         ▼
ComplianceReport { framework, period, controls_passed, controls_failed, gaps[], export_urls }
```

## 66.3 Report Types and Frequency

| Framework    | Frequency  | Scope      | Typical Consumer     |
| ------------ | ---------- | ---------- | -------------------- |
| SOC2 Type II | Quarterly  | Platform   | Auditor / Customer   |
| SOX 302/404  | Quarterly  | Finance    | CFO / External Audit |
| HIPAA        | Monthly    | Healthcare | HIPAA Officer        |
| GDPR         | Monthly    | Platform   | DPO                  |
| PCI-DSS      | Quarterly  | Payments   | QSA                  |
| ISO 27001    | Semi-annual| Platform   | CISO                 |

## 66.4 Auditor Read-Only Access

Auditors obtain a restricted read-only view via `AuditorAccess`:

- **Visible scope**: runs / decisions / evidence / compliance reports, filtered by tenant + timeRange + framework
- **Permission control**: Read-only operations; cannot modify, delete, or export raw data
- **PII protection**: Returned data undergoes §23 data classification checks; fields that fail classification review are automatically masked
- **Audit trail**: Every auditor query operation is itself included in the audit log (§23), recording the querier, time, and scope

---

# 67. Capacity Planning and Cost Forecasting Engine

> Predictive capacity modeling based on historical trends, supporting scale-up timing recommendations, cost trend forecasting, and What-if capacity simulation.
> Related: §18 Cost · §27 SLO · §43 Dashboard · §54 SLA · §64 Cost Optimization

## 67.1 Resource Dimension Tracking

| Dimension           | Collection Source    | Alert Threshold            |
| ------------------- | -------------------- | -------------------------- |
| Worker concurrency  | P4 Execution Plane   | 80% of current capacity    |
| Storage usage       | P5 State Plane       | 85% of current capacity    |
| LLM Token consumption/day | §18 CostTracker | 70% of monthly budget     |
| API QPS             | P1 Interface Plane   | 75% of current capacity    |
| Event Log growth rate | P5 Event Store     | 80% of storage capacity    |
| Queue depth         | P4 Fair Queue        | Avg wait time > 50% of SLA |

## 67.2 Forecasting Models

| Forecast Target    | Algorithm                              | Forecast Horizon   |
| ------------------ | -------------------------------------- | ------------------ |
| Token consumption  | Linear regression + seasonal decomposition | 7d / 30d / 90d |
| Compute usage      | Linear regression + seasonal decomposition | 7d / 30d / 90d |
| Storage growth     | Exponential smoothing + capacity extrapolation | 30d / 90d    |
| Concurrent run demand | Peak regression + weekday/holiday adjustment | 7d / 30d    |

Forecast results are automatically fed into §67.1 alert threshold evaluation; a `CapacityAlert` is generated when the predicted value will breach a capacity threshold within the forecast horizon.

## 67.3 What-if Capacity Simulation

Supports capacity impact simulation for the following scenarios:

| Scenario            | Input Parameters                       | Output                                          |
| ------------------- | -------------------------------------- | ----------------------------------------------- |
| New tenant onboard  | Estimated usage, SLA Tier              | Additional capacity needed, cost increment      |
| Traffic spike       | Peak multiplier, duration              | Bottleneck resources, scale-up recommendations  |
| Region failover     | Failed Region, traffic migration ratio | Target Region remaining capacity, pre-scale needed |
| Model migration     | New model token efficiency, latency delta | Token consumption delta, Worker concurrency impact |

Each simulation outputs `requiredCapacity`, `estimatedCost`, `bottleneckWarnings`.

## 67.4 Financial Budget Support

- Monthly cost trend report (actual vs budget vs forecast)
- Quarterly capacity planning recommendations (for finance team budget approval)
- Annual TCO forecast (including hardware + LLM API + headcount costs)

---

# 68. Multimodal Capability Architecture

> Extends ModelGateway to support image, speech, document and other multimodal inputs/outputs, enabling the platform to handle content creation, customer service image processing, voice interaction and similar scenarios.
> Related: §15 ModelGateway · §26 Storage · §37 Business Domain · §39 NL Entry

## 68.1 Multimodal ModelGateway Extension

Extends multimodal capabilities on top of §15 ModelGateway:

- **Modality detection**: Automatically identifies input modalities in the request (text / image / audio / video / document)
- **Capability routing**: Automatically selects a Provider supporting the required modality (see §68.3 ModalityRouter)
- **Format conversion**: Auto-converts when input/output formats differ between Providers (e.g. base64 ↔ URL ↔ binary)
- **Fallback chain**: Falls back per §68.3 configuration when a multimodal Provider is unavailable

## 68.2 Multimodal ModelRequest Extension

Adds multimodal fields on top of the standard ModelRequest:

| Field            | Type            | Description                                                 |
| ---------------- | --------------- | ----------------------------------------------------------- |
| inputModalities  | `string[]`      | List of input modalities in the request                     |
| outputModalities | `string[]`      | List of expected output modalities                          |
| contentParts     | `ContentPart[]` | Mixed content blocks (text + image + audio can interleave)  |

Each modality undergoes independent security checks (§68.4); the entire request is rejected if any modality fails.

## 68.3 ModalityRouter

| Modality         | Default Provider                | Fallback                       | Cost Model    |
| ---------------- | ------------------------------- | ------------------------------ | ------------- |
| Text LLM         | GPT-4o / Claude                 | Qwen / DeepSeek                | per-token     |
| Image Analysis   | GPT-4o Vision / Claude Vision   | Qwen-VL                        | per-image     |
| Image Generation | DALL-E 3 / Midjourney API       | Stable Diffusion (self-hosted) | per-image     |
| Speech-to-Text   | Whisper API                     | Paraformer (self-hosted)       | per-minute    |
| Text-to-Speech   | Azure TTS / ElevenLabs          | CosyVoice (self-hosted)        | per-character |
| Document Parse   | Document Intelligence           | Marker / Docling (self-hosted) | per-page      |

## 68.4 Multimodal Security

- Image inputs undergo content moderation (pornography / violence / sensitive information detection)
- Generated images carry C2PA metadata watermarks
- Speech input PII detection (phone numbers, ID numbers auto-masked)
- Document parsing results are subject to §50 knowledge domain isolation

## 68.5 Multimodal Cost Tracking

§18 CostTracker is extended with a `modality` dimension:

---

# 69. Platform Self-Operations Agent Architecture

> The platform uses its own Agent capabilities for self-operations (dog-fooding), covering automated Incident diagnosis, common fault self-repair, configuration optimization recommendations, and developer Q&A.
> Related: §12 Incident Events · §14 Execution · §37 Business Domain · §41 Proactive Agent · §43 Dashboard

## 69.1 PlatformOps DomainDescriptor

Platform self-operations is registered as a special business domain in the §37 domain framework:

| Field         | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| domain        | `platform_ops`                                                          |
| riskProfile   | high (involves production write operations)                             |
| tools         | `metrics_query`, `config_patch`, `restart_service`, `scale_replica`     |
| evalFramework | SLO-based (uses §27 SLO attainment rate as Agent performance metric)   |
| autonomy_cap  | Read-only operations up to auto; write operations up to supervised (§42)|

## 69.2 Self-Operations Agent Directory

| Agent             | Trigger                  | Capabilities                                   | Max Autonomy |
| ----------------- | ------------------------ | ---------------------------------------------- | ------------ |
| IncidentDiagnoser | Incident creation event  | Collect logs, analyze root cause, generate report | semi_auto |
| ConfigOptimizer   | Weekly + perf deviation  | Analyze config, suggest optimizations, estimate impact | supervised |
| CapacityPredictor | Daily scheduled          | Analyze trends, predict bottlenecks, recommend scaling | supervised |
| DevAssistant      | Developer question       | Query docs, search code, generate examples     | semi_auto    |
| HealthMonitor     | Continuous               | Patrol platform health, generate daily report  | auto (read-only) |

## 69.3 Safety Guardrails

- All production write operations **must** go through manual approval
- PlatformOps Agent ModelGateway calls have independent cost budget and rate limit
- PlatformOps Agent cannot access business domain data, only platform operations data
- All PlatformOps Agent operations are included in an independent audit stream (§23), isolated from business audit

## 69.4 Self-Operations Maturity Levels

| Level | Description                                               | Manual Involvement |
| ----- | --------------------------------------------------------- | ------------------ |
| L0    | Fully manual operations, Agent only assists doc queries   | 100%               |
| L1    | Agent generates diagnostic reports, humans decide and act | 80%                |
| L2    | Agent generates fix plans with pre-validation, human one-click confirm | 40%  |
| L3    | Agent auto-handles P3/P4 issues, P1/P2 still require humans | 15%             |

Initial deployment starts at L0 and progressively advances per §42 progressive autonomy.

---

# Part X — Rollout Roadmap & Summary (§33-§36)

---

## Three-Ring Implementation Priority

v3.1 covers an extremely broad scope (94 sections · 24 domains · 11 Parts). To avoid spreading implementation too thin, this section defines the Three-Ring approach, clarifying "what to do first → what to do next → what to do last." The three rings correspond to the phased roadmap in §33, but prioritize from a **capability dimension** rather than a **time dimension**.

### First Ring: Platform Survival Ring

> **Without the First Ring, large-scale onboarding is off the table.** Corresponds to §33 Phase 1-2 + Phase 8a (Harness core can be parallelized; see §33 dependency graph).

The minimal closed-loop capability set that must be delivered first; the platform cannot go into production if any item is missing:

| Capability                                 | Section(s)       | Delivery Criteria                                           |
| ------------------------------------------ | ---------------- | ----------------------------------------------------------- |
| P1-P5 Core Path                            | §4-§7, §14       | End-to-end communication across all five planes is reachable |
| ConstraintPack                             | §45.3            | Task-level constraint envelope can be loaded and validated   |
| HarnessRun / HarnessStep / HarnessDecision | §45.13, §58.6    | Planner→Generator→Evaluator closed loop is runnable          |
| Risk / Approval / Audit                    | §10, §47, §23    | Risk scoring→approval routing→audit writing full chain       |
| Lease / CAS / Checkpoint / Recovery        | §14, §25, §45.15 | State persistence and failure recovery are demonstrable      |
| Panic / Incident / Replay                  | §9, §12, §60     | Emergency brake can trigger; events can be replayed          |
| ModelGateway / Prompt / Eval Gate          | §15, §16, §17    | LLM calls go through gateway; Prompts are versioned; quality gating is enforced |

**First Ring acceptance gate**: An Agent task can be run end-to-end in a controlled environment (from NL input to result output), and the task can be interrupted, recovered, and audited.

### Second Ring: Platform Usability Ring

> **Reaching the Second Ring enables the platform to support real business pilots.** Corresponds to §33 Phase 3-5 + Phase 8b-8c.

Building on the First Ring, complete the closed loops facing users and enterprises:

| Capability                                            | Section(s)         | Delivery Criteria                                                                         |
| ----------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| NL Entry                                              | §39                | Natural-language task submission is available                                               |
| Goal Decomposition                                    | §40                | Goal decomposition engine can break down composite tasks                                   |
| HITL Runtime                                          | §45.18             | Five human intervention modes available: inspect / patch / override / takeover / resume     |
| Async Harness                                         | §45.19             | Long-running tasks can be suspended/awakened                                               |
| Dashboard                                             | §43                | L0/L1 dashboard views are available                                                        |
| Org / SSO / Approval Routing                          | §46-§48            | Org hierarchy→approval routing→SSO integration                                             |
| DomainDescriptor / DomainRecipe / DomainEvalFramework | §37, §37.7, §37.5  | Domain modeling framework is available; at least 2 domains have completed onboarding        |
| Canonical Domain Meta-Model                           | §37.11             | Meta-model 12-question template can be filled in and validated                              |
| Agent Collaboration Protocol                          | §19.5              | Multi-Agent collaboration messages can be sent/received; invariant rules can be validated   |

**Second Ring acceptance gate**: At least 2 vertical domains (recommended: 1 Critical + 1 Medium risk domain) have completed pilot launch; non-technical users can submit tasks via the NL entry; approval and HITL workflows are functional.

### Third Ring: Platform Expansion Ring

> **Reaching the Third Ring is the prerequisite for talking about 24-domain scale-out.** Corresponds to §33 Phase 6-9.

Building on the first two rings, complete the capabilities for scale-out and continuous optimization:

| Capability               | Section(s) | Delivery Criteria                                                                  |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------- |
| Marketplace              | §55        | Agent marketplace supports publish/subscribe/deprecate                             |
| Multi-Region             | §52        | Deployable in at least 2 Regions                                                   |
| Edge Runtime             | §62        | Offline/edge scenarios are runnable                                                |
| Cost Optimizer           | §64        | Cost attribution down to domain/Agent/task level                                   |
| Behavior Drift Detection | §63        | Drift detection baseline established; alerts can trigger                           |
| Compliance Reporter      | §66        | Compliance reports can be auto-generated                                           |
| 24 Domain Packs          | §71-§94    | All 24 domains complete meta-model filling and pass §38 four-stage quality gates   |

**Third Ring acceptance gate**: ≥ 12 domains running in production; cross-Region failover drill passed; platform self-ops Agent (§69) can handle P3/P4 level issues.

### Three-Ring to §33 Phase Mapping

```text
First Ring (Survival)  Second Ring (Usability)    Third Ring (Expansion)
 Phase 1-2+8a           Phase 3-5+8b/8c            Phase 6-9
 ┌─────────┐           ┌───────────────┐           ┌────────────────────────┐
 │ Skeleton+│──────────▶│ NL Entry+HITL+│──────────▶│ Marketplace+Multi-     │
 │ Harness  │           │ Org+Domain    │           │ Region+Edge+Cost+      │
 │ Core+Risk│           │ Pilot+Collab  │           │ Drift+24 Domain Full   │
 └─────────┘           └───────────────┘           └────────────────────────┘
 ~16 weeks              ~24 weeks                   ~40+ weeks
```

### Implementation Decision Recommendations

- **When resources are limited**: Deliver only the First Ring + DomainDescriptor/HITL from the Second Ring — sufficient to support a POC
- **When time pressure is high**: The Second Ring's NL entry can be replaced with a simplified version (structured form); Dashboard can be deferred
- **Domain count is elastic**: The Third Ring's 24 domains can be rolled out in 6 batches per §33 Phase 9 cadence — no need to deliver all at once

---

# 33. Phased Rollout Roadmap

> Includes **acceptance gates**, **dependencies**, and **concrete deliverables**.

## Phase 1: Steady-State Skeleton (8 weeks)

### Deliverables

- truth tables + event log + UoW (Group 1 tables)
- lease / fencing / CAS
- idempotency
- artifact ref
- policy outcome + decision model (Group 2 tables)
- Minimal ops CLI (doctor / inspect)
- Unit test ≥ 80% coverage

### Acceptance Gates

- [ ] workflow_run can be stably created and advanced (no degradation)
- [ ] lease automatically reclaimed after timeout
- [ ] CAS conflicts correctly rejected
- [ ] Event append and truth table in the same transaction

### Dependencies

No external dependencies. Can start with SQLite + Node.js alone.

## Phase 2: Controlled Automation (8 weeks)

### Deliverables

- OAPEFLIR main chain O→A→P→E→F
- risk assessment engine
- approval gates (basic)
- side effect tracking
- recovery workers (LeaseReclaimer + StuckRunSweeper)
- 2 Business Packs: coding.fix_bug + operations.resolve_incident

### Acceptance Gates

- [ ] Main chain runs end-to-end (task creation → execution → completion)
- [ ] High-risk step triggers approval blocking
- [ ] Execution resumes within 30s after worker crash
- [ ] Side effects are queryable and auditable

### Dependencies

All Phase 1 acceptance gates passed.

## Phase 3: Enterprise Reliability (12 weeks)

### Deliverables

- OAPEFLIR secondary chain F→L→I→R
- circuit breaker + degradation mode switching
- backpressure (4 modes)
- incident management + DLQ operations
- projection rebuild
- replay / repair
- Configuration governance (versioned + canary)
- Multi-tenant isolation hardening
- PostgreSQL migration (optional)

### Acceptance Gates

- [ ] Auto-degrades on external dependency circuit break, auto-recovers when restored
- [ ] DLQ is queryable, retryable, and closable
- [ ] Incident closed-loop handling chain connected
- [ ] Data consistent after projection rebuild
- [ ] Configuration changes are rollbackable

### Dependencies

All Phase 2 acceptance gates passed.

## Phase 4: Scale-Out (Continuous)

### Deliverables

- Worker separated deployment (Phase D2)
- More Business Packs
- Browser execution deepening
- Plugin ecosystem
- SLO automated monitoring
- Compliance export
- Disaster recovery drills

### Acceptance Gates

- [ ] 50 concurrent workflows running stably
- [ ] Multi-tenant isolation verification passed
- [ ] Load test meets §27 SLO
- [ ] Disaster recovery drill RTO < 10min

## Phase 5: Intelligent Interaction + Org Governance + Domain Onboarding Framework (12 weeks)

> Intelligent interaction layer + org governance layer + unified domain meta-model + multi-Agent collaboration protocol.

### Deliverables

- Natural language task entry (§39) + goal decomposition engine (§40)
- Proactive Agent framework (§41) + progressive autonomy model (§42)
- Unified operations dashboard (§43) + non-technical user experience (§44)
- Org hierarchy model (§46) + approval routing (§47) + SSO/SCIM (§48)
- Compliance policy engine (§49) + knowledge domain isolation (§50) + governance delegation (§51)
- Unified domain meta-model 12-question template and validation tooling (§37.11)
- Multi-Agent collaboration protocol message format and inviolable rule validation (§19.5)

### Acceptance Gates

- [ ] Non-technical users can create and manage tasks via natural language
- [ ] Goal decomposition engine auto-decomposes business goals into executable task graphs
- [ ] Progressive autonomy L0→L3 upgrade path verified end-to-end
- [ ] Three-level org hierarchy correctly drives approval routing
- [ ] SSO/SCIM auto-syncs users and deactivated accounts take effect < 5min
- [ ] Knowledge domain isolation zero-leakage, controlled sharing audit complete
- [ ] 12-question meta-model template fillable and validatable, at least 2 domains populated
- [ ] Multi-Agent collaboration messages deliverable end-to-end, 7 inviolable rules auto-validated

### Dependencies

All Phase 4 acceptance gates passed.

## Phase 6: Scale and Ecosystem (12 weeks)

> Scale-out layer + ecosystem layer.

### Deliverables

- Multi-Region deployment (§52) + resource contention management (§53) + SLA tiering (§54)
- Agent marketplace (§55) + feedback improvement pipeline (§56) + external integration framework (§57)

### Acceptance Gates

- [ ] Dual-Region Active-Active deployment, single Region failure RTO < 5min
- [ ] High-priority tasks not starved under 1000 concurrent workflows
- [ ] SLA Tier P0 tasks 99.9% completed within committed time
- [ ] Marketplace has at least 20 certified Packs listed
- [ ] User feedback → improvement closed loop < 7 days

### Dependencies

All Phase 5 acceptance gates passed.

## Phase 7: Ops Maturity (Continuous)

> Ops maturity layer.

### Deliverables

- Explainability (§59) + emergency brake (§60) + lifecycle management (§61)
- Offline/edge deployment (§62) + behavior drift detection (§63) + cost optimization (§64)
- Visual debugger (§65) + compliance reports (§66) + capacity planning (§67)
- Multi-modal capabilities (§68) + platform self-ops Agent (§69)

### Acceptance Gates

- [ ] Users can query explanations for any step, L1 latency < 2s
- [ ] Emergency brake drill: full platform stop < 5s, recovery < 30min
- [ ] EdgeRuntime recovers with zero data loss after 24h offline
- [ ] 100% alert triggered when behavior drift > 2σ
- [ ] Compliance report SOC2 Type II control point coverage ≥ 95%
- [ ] PlatformOps Agent L1 maturity verification passed

### Dependencies

All Phase 6 acceptance gates passed.

## Phase 8a: Harness Unified Execution Protocol (8 weeks)

> Harness engineering layer. Can start in parallel with Phase 3.

### Deliverables

- HarnessRun/HarnessStep unified contract (§45.13) + HarnessDecision (§58.6)
- Harness Runtime main entry + HarnessLoopController (§45.7)
- ConstraintPack assembly engine (§45.3) + ToolbeltAssembler (§45.4)
- ContextAssembler + ContextSnapshot (§45.5) + minimal Working Memory (§45.16)
- Planner/Generator/Evaluator Agent role separation (§45.8-45.10)
- FeedbackEnvelope four-stage closed loop (§45.6)
- Basic Evaluator (runtime adjudication)

### Acceptance Gates

- [ ] All task execution goes through HarnessRuntime.run() entry, no bypass
- [ ] ConstraintPack correctly merges platform→tenant→domain→task four-level constraints
- [ ] Planner/Generator/Evaluator use independent Prompts, no sharing
- [ ] Evaluator pass rate ≥ 95% after each step execution
- [ ] HarnessRun/HarnessStep contract fully covers all runs and steps
- [ ] All six HarnessDecision verdicts have test coverage

## Phase 8b: Harness Long-Running and Human-in-the-Loop (6 weeks)

> Eight-pillar deepening. Depends on Phase 8a completion.

### Deliverables

- Durable Harness persistent execution (§45.15): pauseReason registry + resumeStrategy
- HITL Runtime (§45.18): inspect/patch/override/takeover/resume five capabilities
- Async Harness (§45.19): create_run/poll_status/subscribe_events/intervene_mid_run
- Memory Namespace (§45.16): Working/Long-term/Shared Knowledge three layers + promotion strategy
- Harness Prompt layered governance (§58.2)
- Failure-to-Learning pipeline (§58.3)
- Online feedback closed loop

### Acceptance Gates

- [ ] ContextSnapshot supports crash recovery, state consistent after recovery
- [ ] Durable Harness supports 5 pauseReasons and 4 resumeStrategies
- [ ] HITL Runtime inspect/patch/override operable from §43 dashboard
- [ ] Async run supports poll_status and intervene_mid_run
- [ ] Memory three-layer namespace isolation passes tenant/domain isolation tests

## Phase 8c: Harness Governance and Evaluation (6 weeks)

> Eight-pillar deepening. Depends on Phase 8b completion.

### Deliverables

- Evaluation Harness (§45.14): pre-release evaluation + version comparison evaluation
- Tool Harness (§45.17): tool capability profile + tool invocation governance records
- Guardrails layering (§45.20): input/planning/tool/memory/output five layers
- Harness Replay/Simulation (§58.4)
- Harness ten invariants (§45.21) enforced checks
- Harness-level metrics visible on §43 dashboard (§58.1)

### Acceptance Gates

- [ ] Evaluation Harness can run standard task sets in sandbox and output comparison reports
- [ ] Tool Harness Capability Profile covers all registered tools
- [ ] All five Guardrails layers have interception test coverage
- [ ] Harness Replay can fully replay completed runs
- [ ] Ten invariants have corresponding automated checks (violation fails CI)

### Dependencies

Phase 8a → Phase 8b → Phase 8c. Phase 8a can proceed in parallel with Phases 3-7. Phase 8c must be completed before Phase 5.

## Phase 9: Vertical Business Domain Deep Landing (48 weeks, 6 batches)

> Instantiation of DomainDescriptors for 24 vertical business domains, domain tool integration, domain evaluation baseline establishment, and canary go-live. Depends on Phase 5 + Phase 8c completion. First 3 batches cover original 12 domains (v3.0), last 3 batches cover 12 new domains (v3.1).

### Phase 9a: High-Priority Domains (8 weeks) — Code Development · Data Processing · Enterprise Knowledge Base · User Operations

Selection criteria: Platform already has coding/operations instances, controllable risk, can quickly validate domain framework.

#### Deliverables

- 4 domain DomainDescriptor instances (including RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy)
- 4 domain Business Packs (at least 2 core Workflows each)
- 4 domains pass §38 four-stage gates (modeling→development→certification→canary)
- Domain-level evaluation baselines and regression datasets

#### Acceptance Gates

- [ ] All 4 domains reach GA status
- [ ] Each domain eval meets acceptance_threshold on all quality axes
- [ ] Domain-level SLO compliance rate ≥ 95%
- [ ] Cross-domain interaction policy verified (Code Development↔Data Processing)

### Phase 9b: Medium-Priority Domains (8 weeks) — Quantitative Trading · Financial Services · E-commerce · Advertising

Selection criteria: High business value, Critical-risk domains require stricter certification.

#### Deliverables

- 4 domain DomainDescriptor instances (including domain-specific risk control rules and compliance mappings)
- Trading/Compliance prototype template verification
- Quantitative Trading domain ultra-low-latency path verification
- Financial Services domain regulatory report Agent end-to-end verification

#### Acceptance Gates

- [ ] All 4 domains reach GA status
- [ ] Critical-risk domains (Quantitative Trading/Financial Services) HITL coverage 100%
- [ ] Quantitative Trading domain execution path latency < 10ms (excluding LLM)
- [ ] Financial Services domain AML/KYC compliance check passed

### Phase 9c: Completion Domains (8 weeks) — Industry Research · Academic Research · Finance · Legal

Selection criteria: High HITL requirements, regulation-intensive, requires lawyer/auditor participation in verification.

#### Deliverables

- 4 domain DomainDescriptor instances
- Research/Adversarial prototype template verification
- Legal domain lawyer review workflow end-to-end verification
- Finance domain SOX compliance audit trail verification

#### Acceptance Gates

- [ ] All 4 domains reach GA status
- [ ] Legal domain all outputs 100% reviewed by lawyers
- [ ] Finance domain audit trail integrity check passed
- [ ] Academic Research domain citation accuracy 100% (zero fabrication)
- [ ] All first 12 domains running online, cross-domain interaction matrix verified

### Phase 9d: High-Priority New Domains (8 weeks) — Customer Service · IT Ops SRE/DevOps · Content Moderation & Safety · Live Streaming

Selection criteria: Operational necessity, high real-time requirements, mature tool ecosystem available for integration.

#### Deliverables

- 4 domain DomainDescriptor instances (including RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy)
- Customer Service domain multi-turn dialogue closed-loop end-to-end verification
- IT Ops domain alert→diagnosis→remediation automation chain verification
- Content Moderation domain CSAM instant reporting compliance workflow verification
- Live Streaming domain real-time stream moderation latency < 2s verification

#### Acceptance Gates

- [ ] All 4 domains reach GA status
- [ ] Customer Service domain first-contact resolution rate ≥ 70%, CSAT ≥ 4.0
- [ ] IT Ops domain MTTR reduced ≥ 30% (vs. manual baseline)
- [ ] Content Moderation domain violation recall rate ≥ 99.5%, CSAM 100% instant reporting
- [ ] Live Streaming domain real-time stream moderation end-to-end latency < 2s

### Phase 9e: Medium-Priority New Domains (8 weeks) — Healthcare · Human Resources · Supply Chain & Logistics · Education & Training

Selection criteria: High compliance requirements, strong HITL domains, requires deep domain expert participation in certification.

#### Deliverables

- 4 domain DomainDescriptor instances (including domain-specific compliance mappings and approval workflows)
- Healthcare domain licensed physician review workflow end-to-end verification
- Human Resources domain recruitment bias audit passed
- Supply Chain domain demand forecasting→scheduling→exception handling chain verification
- Education & Training domain personalized learning path recommendation verification

#### Acceptance Gates

- [ ] All 4 domains reach GA status
- [ ] Healthcare domain all treatment recommendations 100% reviewed by licensed physicians
- [ ] Human Resources domain recruitment process bias audit passed (Adverse Impact Ratio ≥ 0.8)
- [ ] Supply Chain domain demand forecasting accuracy ≥ 85% (MAPE ≤ 15%)
- [ ] Education & Training domain learning outcome improvement ≥ 15% (vs. baseline)

### Phase 9f: Completion New Domains (8 weeks) — Ad Creative Production · Game Development · Game Publishing · Marketing & Branding

Selection criteria: Creativity-intensive, complex publishing workflows, requires multi-party collaboration verification.

#### Deliverables

- 4 domain DomainDescriptor instances
- Ad Creative domain multi-modal generation→compliance review→iteration chain verification
- Game Development domain code generation→testing→performance verification chain verification
- Game Publishing domain multi-platform compliance check→submission→monitoring chain verification
- Marketing domain campaign orchestration→delivery→performance analysis closed-loop verification

#### Acceptance Gates

- [ ] All 4 domains reach GA status
- [ ] Ad Creative domain creative compliance pass rate ≥ 95% (first submission)
- [ ] Game Development domain code generation compilation pass rate ≥ 90%
- [ ] Game Publishing domain multi-platform compliance first-pass rate ≥ 85%
- [ ] All 24 domains running online, cross-domain interaction matrix 24×24 verified

### Dependencies

Phase 9a depends on Phase 5 + Phase 8c completion. Phase 9a→9b→9c→9d→9e→9f proceeds linearly, 48 weeks total. Phase 9d can start immediately after Phase 9c completion.

## 33.1 Phase Dependency Graph

```text
Phase 1 (Steady-State Skeleton)
    │
    ▼
Phase 2 (Controlled Automation)
    ├──────────────────────────────┐
    │                              │
    ▼                              ▼
Phase 3 (Enterprise Reliability)  Phase 8a (Unified Execution Protocol)
    │                              │
    ▼                              ▼
Phase 4 (Scale-Out)              Phase 8b (Long-Running & Human-in-the-Loop)
    │                              │
    ▼                              ▼
Phase 5 (Intelligent Interaction  Phase 8c (Governance & Evaluation)
         & Org Governance)    ◄────┘
    │
    ├──────────────────────────────┘
    │
    ▼
Phase 6 (Scale & Ecosystem)
    │
    ▼
Phase 7 (Ops Maturity)
    │
    ▼
Phase 9a (High-Priority: Code·Data·Knowledge Base·Ops)
    │
    ▼
Phase 9b (Medium-Priority: Quant·Finance·E-commerce·Ads)
    │
    ▼
Phase 9c (Completion: Research·Academic·Finance·Legal)
    │
    ▼
Phase 9d (High-Priority New: CS·IT Ops·Content Moderation·Streaming)
    │
    ▼
Phase 9e (Medium-Priority New: Healthcare·HR·Supply Chain·Education)
    │
    ▼
Phase 9f (Completion New: Creatives·Game Dev·Game Publishing·Marketing)
```

Phase 9a can start after Phase 5 + Phase 8c completion (early preparation can proceed in parallel with Phases 6-7). Phase 9a→9b→9c→9d→9e→9f proceeds linearly, 48 weeks total.

## 33.2 Production Minimum Closure

To ensure the platform can be delivered incrementally and enter production validation as early as possible, features are divided into three delivery batches:

**Batch A — Controlled Execution Closure** (Phase 1-2 delivery):
P1-P5 plane skeleton · OAPEFLIR/Harness main chain · ConstraintPack · Toolbelt · Evaluator basic adjudication · Checkpoint/Recovery · Approval/Policy/Audit basic flows. After delivery, end-to-end tasks can run in a controlled environment.

**Batch B — Enterprise Execution Closure** (Phase 3-4 delivery):
Async Harness · HITL Runtime · Memory Namespace · Tool Harness governance · Guardrails five layers · Multi-tenant/Org/Compliance · Drift Detection basics. After delivery, supports enterprise multi-team, multi-approval, long-running task scenarios.

**Batch C — Platform Optimization Closure** (Phase 5-8c delivery):
Evaluation Harness (offline evaluation + version comparison) · Replay/Simulation · Cost optimization · Drift auto-repair · PlatformOps Agent · Marketplace. After delivery, the platform has self-ops and continuous improvement capabilities.

Delivery criteria for each batch: full-chain smoke test passed · critical path E2E test coverage · security scan no P0/P1 · operations manual ready.

---
# 34. ADR Freeze Recommendations

105 ADRs in total:

**Platform Fundamentals (19)**:
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries

**Plane Communication & Deployment (4)**:

- **ADR-Plane-Communication-Contracts** — The five planes must communicate through formal contract objects
- **ADR-Repository-Abstraction-Layer** — All storage access goes through the Repository interface
- **ADR-Single-Process-First** — Deployment starts as a monolith; split only after validation
- **ADR-API-Versioning-Strategy** — API versioning and backward compatibility strategy

**AI Operations (9)**:

- **ADR-ModelGateway-As-Single-LLM-Entry** — All LLM calls must go through ModelGateway; direct provider SDK calls are prohibited
- **ADR-Prompt-As-Versioned-Resource** — Prompts are not inlined in code; they are managed independently as versioned resources
- **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model changes must pass a quality gate
- **ADR-Per-Tenant-Cost-Metering** — All LLM costs must be metered per tenant
- **ADR-Delegation-Depth-Limit** — Maximum delegation depth between Agents = 3
- **ADR-Workflow-Hibernation-Model** — Long-waiting workflows must release workers and persist state
- **ADR-Crypto-Shredding-For-Erasure** — GDPR erasure is implemented via crypto-shredding
- **ADR-Pack-Semver-Compatibility** — Pack Manifest API follows the semver compatibility contract
- **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM latency is monitored independently and excluded from the platform's own SLO

**Business Domain Onboarding (4)**:

- **ADR-Domain-Descriptor-As-Semantic-Layer** — Every Business Pack must be associated with a DomainDescriptor; domain semantics must not be embedded in Pack code
- **ADR-Domain-Risk-Override-Over-Platform-Default** — Domain risk profile overrides take precedence over the platform default risk matrix; overrides require an audited justification
- **ADR-Domain-Recipe-As-Onboarding-Accelerator** — New business domains must start from one of twelve archetype templates; blank onboarding is prohibited
- **ADR-Four-Phase-Domain-Onboarding** — Business domain onboarding must pass four phase gates (Modeling → Development → Certification → Canary); skipping is not allowed

**Intelligent Interaction (6)**:

- **ADR-NL-Intent-Must-Resolve-To-RequestEnvelope** — Natural language input must go through Intent resolution to produce a structured RequestEnvelope (§5.3); passing raw text directly to an Agent is prohibited
- **ADR-Goal-Decomposition-Max-Depth** — Goal decomposition engine recursion depth limit = 5; exceeding it requires human confirmation of the decomposition plan
- **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — Proactive Agents must be bound to a TriggerPolicy; unconditional polling is prohibited
- **ADR-Autonomy-Level-Guarded-Progression** — Progressive autonomy levels default to monotonically increasing (promotion requires meeting a score threshold + approval); demotion occurs only under the safety trigger conditions defined in §42.2 (P0 Incident / consecutive failures / cost overrun); after demotion, human approval confirmation with a recorded reason is required, and the recovery path follows the promotion rules
- **ADR-Dashboard-Metric-Source-Of-Truth** — Unified operations dashboard data must come from the State & Evidence Plane; directly reading Runtime internal state is prohibited
- **ADR-No-Code-UX-Maps-To-Standard-API** — Non-technical user interface operations must map to standard Public APIs; bypass is prohibited

**Organizational Governance (6)**:

- **ADR-Org-Hierarchy-As-First-Class-Model** — Organizational hierarchy (Enterprise → Business Group → Department → Team) is a first-class model; all resource ownership must be associated with an OrgNode
- **ADR-Approval-Route-From-Org-Chart** — Approval routes must be dynamically derived from the org chart; hardcoded approver lists are prohibited
- **ADR-SSO-As-Single-Identity-Source** — Enterprise SSO is the sole identity source; the platform does not maintain independent user passwords
- **ADR-Compliance-Policy-Inherits-Down** — Compliance policies inherit downward along the org tree; child nodes can only tighten, never relax
- **ADR-Knowledge-Boundary-Default-Deny** — Knowledge domains are isolated by default; cross-department sharing requires explicit authorization with an audit log
- **ADR-Governance-Delegation-Requires-Scope** — Governance delegation must be scoped (resource type + OrgNode range); global delegation is prohibited

**Scale & Ecosystem (6)**:

- **ADR-Multi-Region-Active-Active-With-Home-Region** — Multi-Region uses an Active-Active architecture; each tenant has a Home Region; cross-region data is replicated asynchronously
- **ADR-Resource-Contention-Fair-Queue** — Scaled deployments must use weighted fair queues; simple FIFO that causes high-priority task starvation is prohibited
- **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA tier determines resource quota, queue priority, and failure recovery order
- **ADR-Marketplace-Pack-Must-Pass-Certification** — Packs listed on the Agent Marketplace must pass platform certification (security scan + sandbox test + performance baseline)
- **ADR-Feedback-Loop-Closed-Within-SLA** — User feedback must form a closed loop within the SLA-defined time window (collection → analysis → improvement → verification)
- **ADR-Integration-Through-Unified-Connector** — External system integration must go through the unified Connector framework; business code directly calling external APIs is prohibited

**Operations Maturity (11)**:

- **ADR-Every-Decision-Must-Have-Rationale** — Every stage of OAPEFLIR must generate a StageRationale; decision explanations are rendered on demand
- **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective must atomically halt the entire platform within 5 seconds; recovery requires dual-person approval
- **ADR-Agent-As-Composite-Entity** — An Agent is a composite entity of Pack + Prompt + Model + Trust + Trigger, with AgentVersion as the unit of release and rollback
- **ADR-Edge-Runtime-Risk-Ceiling** — Offline EdgeRuntime may only execute actions with risk_level ≤ medium; high-risk actions wait for connectivity to be restored
- **ADR-Behavior-Fingerprint-Mandatory** — Every Agent must maintain a BehaviorFingerprint; drift detection covers four windows: 1h / 7d / 30d / 90d
- **ADR-Cost-Attribution-Per-Decision** — Cost attribution must be precise to the decision level (individual LLM call); optimization recommendations must include a quality_risk assessment
- **ADR-Workflow-Debug-Session-Isolated** — Debug sessions run in an isolated sandbox; breakpoint pauses do not affect other workflows
- **ADR-Compliance-Report-Template-Versioned** — Compliance report templates must be versioned; the template version is locked at report generation time
- **ADR-Capacity-Forecast-Drives-Scaling** — Capacity forecast results must be linked to scaling recommendations; scaling recommendations must include a cost impact estimate
- **ADR-Multimodal-Safety-Check-Before-Output** — Multimodal output (images / speech) must pass a content safety check before being delivered to the user
- **ADR-PlatformOps-Agent-Read-Only-Default** — The platform self-ops Agent is read-only by default; production write operations require human approval

**Harness Engineering (7)**:

- **ADR-Harness-As-First-Class-Runtime** — Harness Runtime is a first-class architectural object; all task execution must go through the HarnessRuntime.run() entry point; bypassing Harness to call P4 directly is prohibited
- **ADR-ConstraintPack-Per-Run** — Every HarnessRun must carry an explicit ConstraintPack; constraint sources are merged by priority: platform → tenant → domain → task
- **ADR-Planner-Generator-Evaluator-Prompt-Isolation** — Prompts for the three Agent types (Planner / Generator / Evaluator) must be independently versioned and independently rolled out; sharing Prompt templates is prohibited
- **ADR-Step-Level-Evaluation-Mandatory** — After each step completes, an Evaluator assessment is mandatory; skipping evaluation to proceed to the next step is prohibited
- **ADR-Toolbelt-Minimum-Privilege** — Toolbelt is assembled with minimum privilege, including only the tool subset allowed by the current task + domain + risk level
- **ADR-ContextSnapshot-Per-Loop** — Every Harness loop iteration must save a ContextSnapshot to a P5 Checkpoint, supporting crash recovery and Replay
- **ADR-Global-Call-Depth-Limit** — The global call depth limit for goal decomposition (depth ≤ 5) × delegation chain (depth ≤ 3) = 10, enforced via the global_call_depth field propagated through traces

**Harness Eight Pillars (9)**:

- **ADR-Harness-Eight-Pillar-Model** — Harness upgrades from a five-tuple to eight pillars (Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay); all pillars must have an independent acceptance gate
- **ADR-HarnessRun-As-First-Class-Entity** — HarnessRun is a first-class entity with a complete lifecycle (pending → running → paused → completed/failed/aborted); all state transitions must be written to the audit log
- **ADR-HarnessDecision-Six-Way** — HarnessDecision has a fixed set of six verdicts (accept / retry_same_plan / replan / escalate_to_human / downgrade_mode / abort); custom verdict types are prohibited
- **ADR-Evaluation-Harness-Outcome-Over-Transcript** — Evaluation uses the final outcome (whether the environment state reached the goal state) as the primary metric; transcript is supplementary only
- **ADR-Durable-Harness-Pause-Resume** — All async runs must support explicit pause/resume; on pause, full serialization to a P5 Checkpoint is required
- **ADR-Memory-Three-Namespace-Isolation** — The three memory layers (Working / Long-term / Shared Knowledge) must have namespace isolation; cross-layer promotion requires policy review
- **ADR-Tool-Capability-Profile-Mandatory** — Every registered tool must have a Capability Profile; tools without a profile are prohibited from being assembled by the ToolbeltAssembler
- **ADR-HITL-As-Runtime-Primitive** — HITL is a native Harness runtime step type (phase=hitl), not merely an escalation path
- **ADR-Guardrails-Five-Layer** — Guardrails are divided into five layers (input / planning / tool / memory / output); each layer is independently configured, independently intercepted, and independently audited

**Vertical Business Domain Deep Dives (24)**:

- **ADR-Domain-Recipe-Twelve-Archetypes** — DomainRecipe expands from eight to twelve archetypes (CRUD-heavy / Analytics / Creative / Realtime / Trading / Compliance / Research / Adversarial / Moderation / Logistics / Conversational / IncidentOps), covering 24 vertical domain workflow patterns
- **ADR-Quant-Trading-Pre-Trade-Risk-Mandatory** — All orders in the quantitative trading domain must pass pre-trade risk checks; risk check latency must not exceed 50μs; hard position/loss limits cannot be overridden by Agents
- **ADR-Financial-Services-Explainable-Decisions** — All adverse credit decisions in the financial services domain must include explainable rejection reasons, in compliance with fair lending regulations
- **ADR-Legal-Output-Attorney-Review-Mandatory** — All Agent outputs in the legal domain must be reviewed by a licensed attorney before being sent out or acted upon; Agents provide "legal information" only, not "legal advice"
- **ADR-Finance-Accounting-Segregation-Of-Duties** — The finance domain must enforce segregation of duties (creator ≠ approver), in compliance with SOX internal control requirements
- **ADR-Ecommerce-Price-Change-Guardrail** — Price changes in the e-commerce domain exceeding X% of the current price must trigger human approval to prevent pricing errors
- **ADR-Academic-Research-Zero-Citation-Fabrication** — Every citation in the academic research domain must resolve to a real paper (DOI / database verification); zero fabrication tolerance
- **ADR-Knowledge-Base-Source-Permission-Mirroring** — The enterprise knowledge base domain must mirror source system document-level permissions; real-time access checks are enforced at query time
- **ADR-Advertising-Budget-Hard-Cap** — The advertising domain must have platform-level hard daily/hourly budget caps; bidding errors must not breach the cap
- **ADR-Data-Engineering-Schema-Migration-Approval** — Destructive schema changes in the data engineering domain must be approved by a human; downstream impact is assessed automatically
- **ADR-User-Operations-Frequency-Cap-Mandatory** — All message delivery in the user operations domain must enforce frequency caps to prevent notification fatigue
- **ADR-Domain-Latency-Tier-Classification** — Every domain must declare a latency tier (ultra-low-latency / realtime / near-realtime / batch); the platform allocates resources and scheduling strategy accordingly
- **ADR-Healthcare-Physician-Review-Mandatory** — All medical recommendations in the healthcare domain must be reviewed by a licensed physician before being presented to the patient; Agents provide "medical information" only, not "medical advice"
- **ADR-Content-Moderation-CSAM-Immediate-Report** — Detection of CSAM content in the content moderation domain must be reported to the designated authority within 1 minute; zero tolerance, zero delay
- **ADR-HR-Bias-Audit-Mandatory** — Recruitment/promotion decisions in the human resources domain must pass a bias audit (Adverse Impact Ratio ≥ 0.8); automated decisions without an audit are prohibited
- **ADR-Supply-Chain-Forecast-Approval-Before-Procurement** — Large procurement orders in the supply chain domain must be based on an approved demand forecast; Agents are prohibited from independently triggering procurement above the threshold
- **ADR-Live-Streaming-Realtime-Moderation-SLA** — Real-time stream moderation latency in the live streaming domain must be < 2s; violating content must be taken down / stream cut within 5s of detection
- **ADR-Game-Publishing-Multi-Platform-Compliance** — Every target platform in the game publishing domain must independently pass compliance checks (age rating / content review / payment compliance); reusing review results across platforms is prohibited
- **ADR-Customer-Service-Escalation-Timeout** — If the Agent in the customer service domain cannot resolve an issue within 3 conversation turns, it must automatically escalate to a human agent; infinite loops are prohibited
- **ADR-IT-Operations-Blast-Radius-Limit** — Automated remediation blast radius in the IT operations domain is limited to a single node / single service; cross-domain operations require human approval
- **ADR-Education-Minor-Data-Protection** — Data involving minors in the education domain must comply with COPPA / minor protection laws; data collection is minimized and requires guardian consent
- **ADR-Creative-Production-IP-Verification** — All AI-generated content in the creative production domain must pass copyright / trademark infringement checks; use of unauthorized materials is prohibited
- **ADR-Game-Dev-IP-Similarity-Check** — AI-generated art assets in the game development domain must pass known IP similarity detection to prevent copyright infringement
- **ADR-Marketing-Brand-Consistency-Check** — All externally published content in the marketing domain must pass brand tone consistency checks and advertising law compliance checks

---
# 35. Recommended Code Directory

```text
src/
  platform/
    interface/          # P1
      api/
      webhook/
      scheduler/
      console-backend/
      ingress/

    control-plane/      # P2
      tenant/
      iam/
      policy-center/
      approval-center/
      rollout-controller/
      incident-control/
      replay-repair-control/
      config-center/
      audit-export/

    orchestration/      # P3
      oapeflir/
      planner/
      replan/
      routing/
      escalation/
      hitl/

    execution/          # P4
      dispatcher/
      execution-engine/
      worker-pool/
      tool-executor/
      plugin-executor/
      adapter-executor/
      browser-executor/
      human-wait-executor/
      recovery/
      # Note: scheduler is under interface/scheduler/

    state-evidence/     # P5
      truth/
      events/
      projections/
      artifacts/
      memory/
      knowledge/
      audit/
      incident/        # (planned)
      checkpoints/     # (planned)
      dlq/             # (planned)

    model-gateway/      # LLM abstraction layer
      provider-registry/
      router/
      cache/
      cost-tracker/
      fallback/

    prompt-engine/      # Prompt management
      registry/
      renderer/
      rollout/
      eval/

    compliance/         # Compliance & data governance
      crypto-shredding/
      data-residency/  # (planned)
      erasure/          # (planned)
      encryption/       # (planned)
      lineage/          # (planned)

    harness/            # Harness Runtime
      runtime/            # HarnessRuntime main entry point
      protocol/           # Harness contracts (HarnessRun/HarnessStep/HarnessDecision/PlanBundle/WorkProduct/EvaluationReport/FeedbackEnvelope)
      planner/            # Planner Agent implementation
      generator/          # Generator Agent implementation
      evaluator/          # Evaluator Agent implementation
      eval-harness/       # Evaluation Harness (pre-release evaluation / version comparison / TaskOutcomeGrader)
      loop/               # HarnessLoopController
      context/            # ContextAssembler + ContextSnapshot
      memory-namespace/   # Working/Long-term/Shared Knowledge three-layer memory + MemoryPromotionPolicy
      constraints/        # ConstraintEngine + ConstraintPack assembly
      guardrails/         # Five-layer Guardrails (input/planning/tool/memory/output)
      toolbelt/           # ToolbeltAssembler + tool reliability profile
      tool-harness/       # Tool Capability Profile + tool lifecycle governance
      hitl-runtime/       # HITL Runtime (inspect/patch/override/takeover/resume)
      durable/            # Durable Harness (pause/resume/checkpoint strategy)
      async/              # Async Harness (create_run/poll/subscribe/intervene)
      recovery/           # Harness Recovery Controller

    contracts/          # Inter-plane contracts
      request-envelope/
      control-directive/
      execution-plan/
      execution-receipt/
      state-command/
      delegation-request/
      model-request/

  domains/                # Business domain modeling
    registry/             # DomainDescriptor registry & lifecycle
    risk-profile/         # DomainRiskProfile domain risk profile
    knowledge-schema/     # DomainKnowledgeSchema domain knowledge structure
    eval-framework/       # DomainEvalFramework domain evaluation
    prompt-library/       # DomainPromptLibrary domain Prompt library
    recipes/              # DomainRecipe archetype templates
    interaction-policy/   # DomainInteractionPolicy cross-domain policy
    governance/           # DomainGovernancePolicy domain governance
    coding/               # Code development domain instance
    operations/           # Operations domain instance
    quant-trading/        # Quantitative trading domain instance (§71)
    ecommerce/            # E-commerce domain instance (§72)
    advertising/          # Advertising domain instance (§73)
    financial-services/   # Financial services domain instance (§74)
    data-engineering/     # Data engineering domain instance (§75)
    user-operations/      # User operations domain instance (§77)
    industry-research/    # Industry research domain instance (§78)
    academic-research/    # Academic research domain instance (§79)
    knowledge-base/       # Enterprise knowledge base domain instance (§80)
    finance-accounting/   # Finance & accounting domain instance (§81)
    legal/                # Legal domain instance (§82)
    live-streaming/       # Live streaming domain instance (§83)
    creative-production/  # Creative production domain instance (§84)
    game-dev/             # Game development domain instance (§85)
    game-publishing/      # Game publishing domain instance (§86)
    human-resources/      # Human resources domain instance (§87)
    supply-chain/         # Supply chain & logistics domain instance (§88)
    healthcare/           # Healthcare domain instance (§89)
    education/            # Education & training domain instance (§90)
    customer-service/     # Customer service domain instance (§91)
    content-moderation/   # Content moderation & safety domain instance (§92)
    it-operations/        # IT operations SRE/DevOps domain instance (§93)
    marketing/            # Marketing & brand domain instance (§94)

  interaction/            # Intelligent interaction layer
    nl-gateway/           # Natural language task entry
      intent-parser/
      slot-resolver/
      ambiguity-handler/
    goal-decomposer/      # Goal decomposition engine
      planner/
      dependency-graph/
      validator/
    proactive-agent/      # Proactive Agent framework
      trigger-engine/
      schedule-manager/
      event-watcher/
    autonomy/             # Progressive autonomy
      trust-scorer/
      level-manager/
      promotion-engine/
    dashboard/            # Unified operations dashboard
      metric-aggregator/
      health-scorer/
      alert-router/
    ux/                   # Non-technical user experience
      wizard/
      template-engine/
      onboarding/

  org-governance/         # Organizational governance layer
    org-model/            # Organizational hierarchy model
      hierarchy/
      org-node/
      sync/
    approval-routing/     # Org-chart-based approval routing
      route-engine/
      escalation/
      delegation/
    sso-scim/             # SSO/SCIM integration
      saml/
      oidc/
      scim-sync/
    compliance-engine/    # Departmental compliance policy engine
      policy-resolver/
      inheritance/
      audit-enforcer/
    knowledge-boundary/   # Knowledge domain isolation & controlled sharing
      boundary-manager/
      sharing-gate/
      access-log/
    delegated-governance/ # Tiered governance delegation
      scope-manager/
      delegation-registry/

  scale-ecosystem/        # Scale runtime layer + ecosystem layer
    multi-region/         # Multi-region deployment
      region-router/
      data-replicator/
      failover-controller/
    resource-manager/     # Resource contention management
      fair-queue/
      quota-enforcer/
      preemption/
    sla-engine/           # SLA tiered assurance
      tier-resolver/
      resource-allocator/
      breach-detector/
    marketplace/          # Agent marketplace & ecosystem
      catalog/
      certification/
      publisher/
    feedback-loop/        # Feedback-driven continuous improvement
      collector/
      analyzer/
      improvement-tracker/
    integration/          # External system integration framework
      connector-registry/
      connector-runtime/
      health-monitor/

  ops-maturity/           # Operations maturity layer
    explainability/       # Agent explainability
      evidence-collector/
      causal-chain-builder/
      explanation-renderer/
      explanation-cache/
    emergency/            # Emergency brake
      panic-controller/
      forensic-snapshot/
      resume-protocol/
    agent-lifecycle/      # Agent unified lifecycle
      agent-registry/
      version-manager/
      canary-controller/
      retirement/
    edge-runtime/         # Offline & edge deployment
      edge-orchestrator/
      edge-executor/
      local-model/
      sync-queue/
    drift-detection/      # Behavior drift detection
      fingerprint-builder/
      changepoint-detector/
      cross-agent-analyzer/
    cost-optimizer/       # Cost attribution & optimization
      attribution-engine/
      recommendation-engine/
      simulator/
    workflow-debugger/    # Visual debugger
      timeline-renderer/
      breakpoint-manager/
      run-comparator/
    compliance-reporter/  # Compliance reporting engine
      template-registry/
      evidence-mapper/
      report-renderer/
    capacity-planner/     # Capacity planning
      trend-analyzer/
      forecaster/
      simulator/
    multimodal/           # Multimodal capabilities
      image-processor/
      speech-processor/
      document-parser/
      modality-router/
    platform-ops-agent/   # Platform self-ops Agent
      incident-diagnoser/
      config-optimizer/
      capacity-predictor/
      dev-assistant/
      health-monitor/

  plugins/
    adapters/
    retrievers/
    planners/
    evaluators/
    presenters/

  sdk/                  # SDK
    pack-sdk/
    plugin-sdk/
    client-sdk/
    cli/

  apps/
    api/
    console/
    workers/
```

---
# 36. Risks, Constraints, and Success Criteria

## 36.1 Major Risks

- Unstable model outputs
- Uncontrollable tool side effects
- Insufficient recovery chains making automation unrecoverable
- Projection bias mistaken for ground truth
- Mis-learning causing behavior drift
- Incomplete multi-tenant isolation
- Pack model non-convergence causing business to reverse-invade the platform
- Budget overrun
- replay / rebuild misoperation amplifying issues
- **LLM provider total unavailability causing platform paralysis**
- **Prompt changes introducing behavioral regression**
- **LLM cost overrun (token overspend)**
- **Agent delegation chain recursive runaway**
- **NL Intent parsing ambiguity causing incorrect task creation**
- **Goal decomposition recursion too deep causing task explosion**
- **Proactive Agent infinite triggering forming storms**
- **Progressive autonomy mis-escalation causing high-risk action runaway**
- **Org structure change sync delay causing approval routing errors**
- **Knowledge isolation misconfiguration causing cross-department data leakage**
- **Governance delegation scope too broad causing security downgrade**
- **Cross-Region data replication delay causing consistency issues**
- **Resource contention management failure causing high-priority task starvation**
- **Marketplace malicious Pack passing certification and causing security incidents**
- **Explainability pipeline LLM call cost overrun (frequent forensic-level explanations)**
- **Emergency brake false trigger causing platform-wide unwarranted downtime**
- **Agent composite version canary test insufficient coverage causing combinatorial defect escape**
- **EdgeRuntime offline state accumulating large amounts of side effects, conflict explosion on reconnection**
- **Behavior drift detection false positives causing frequent Agent downgrades affecting business**
- **Multimodal content safety check miss causing prohibited content output**
- **Quantitative trading domain Agent placing wrong orders causing catastrophic financial loss (fat-finger error)**
- **Financial services domain AML miss causing massive regulatory fines**
- **Legal domain Agent output used as legal advice (unauthorized practice risk)**
- **E-commerce domain pricing Agent setting extreme low prices constituting legally binding offers**
- **Academic research domain citation fabrication constituting academic fraud**
- **Finance domain incorrect bookkeeping causing financial misstatement and audit failure**
- **Enterprise knowledge base domain permission leakage causing confidential documents retrieved by unauthorized users**
- **Advertising domain bid errors causing budget exhausted on low-quality traffic**
- **Healthcare domain Agent output used as medical advice causing misdiagnosis/delayed treatment (life safety risk)**
- **Content moderation domain CSAM miss causing criminal liability and platform shutdown**
- **HR domain recruitment Agent algorithmic bias causing systemic discrimination and lawsuits**
- **Live streaming domain prohibited content not taken down promptly causing regulatory penalties and public opinion incidents**
- **Supply chain domain severe demand forecast deviation causing massive inventory surplus or stockout**
- **IT operations domain auto-remediation propagation causing cascading failures (blast radius runaway)**
- **Customer service domain Agent providing incorrect information or commitments causing legal and financial risk**
- **Education domain minor data leakage causing COPPA/minor protection law violations**
- **Game development domain AI-generated assets infringing existing IP copyrights causing legal disputes**
- **Game publishing domain age rating errors causing minors' exposure to inappropriate content**
- **Marketing domain brand crisis mishandling causing irreversible reputational damage**

## 36.2 Hard Constraints

- Runtime only consumes published-state definitions
- Projection does not write back to truth
- Learn does not directly drive production changes
- Secrets must not enter Memory / Knowledge / external Artifacts
- All outbound calls go through egress control
- All side effects must be recorded as first-class objects
- High-risk actions must be approved or explicitly denied
- CAS + Lease + Fencing are hard constraints for write-back
- Inter-plane communication must go through formal contract objects
- **All LLM calls must go through ModelGateway**
- **Prompt changes must pass quality gates**
- **LLM costs must be metered per tenant**
- **Agent delegation depth ≤ 3**
- **PII data deletion via crypto-shredding**
- **NL input must go through Intent parsing to generate RequestEnvelope (§5.3); raw text pass-through is prohibited**
- **Goal decomposition recursion depth ≤ 5**
- **Proactive Agents must be bound to a TriggerPolicy**
- **Autonomy level defaults to monotonically increasing; downgrade is limited to §42.2 safety trigger conditions, and requires manual approval confirmation after execution**
- **All resources must be associated with an OrgNode**
- **Compliance policies inherit downward along the org tree; child nodes can only tighten**
- **Knowledge domains are isolated by default; cross-department sharing requires explicit authorization**
- **SSO is the sole identity source**
- **Each tenant must designate a Home Region**
- **Marketplace Packs must pass certification before listing**
- **External system integration must go through the unified Connector framework**
- **OAPEFLIR must generate a StageRationale at each stage**
- **PlatformPanicDirective: same Region < 5s, cross Region < 15s to halt the entire platform**
- **Agent publishing and rollback are performed in units of AgentVersion (composite snapshot)**
- **EdgeRuntime offline mode risk_level ≤ medium**
- **Each Agent must maintain a BehaviorFingerprint**
- **Multimodal output must pass content safety checks**
- **PlatformOps Agent is read-only by default; production write operations require manual approval**
- **Quantitative trading domain must have pre-market risk checks and hard position/loss limits**
- **Financial services domain: all adverse credit decisions must be explainable and subject to manual review**
- **Legal domain: all Agent output must be reviewed by a licensed attorney before external release**
- **Finance domain must enforce separation of duties (creator ≠ approver)**
- **E-commerce domain: price changes exceeding threshold must be manually approved**
- **Academic research domain: citations must resolve to real papers (zero fabrication tolerance)**
- **Enterprise knowledge base domain must mirror source system document-level permissions**
- **Healthcare domain: all diagnostic/treatment suggestions must be reviewed by a licensed physician; Agent must not replace medical orders**
- **Content moderation domain: CSAM must be reported within 1 minute of detection, zero tolerance zero delay**
- **HR domain: recruitment/promotion decisions must pass bias audit (AIR ≥ 0.8)**
- **Live streaming domain: prohibited content must be taken down/stream cut within 5s of detection**
- **Supply chain domain: purchase orders exceeding threshold must be based on approved demand forecasts**
- **IT operations domain: auto-remediation blast radius limited to single node/single service**
- **Customer service domain: must escalate to human agent after 3 rounds unresolved**
- **Education domain: minor data requires guardian consent and minimal collection**
- **Game publishing domain: each target platform must independently pass compliance checks**
- **Advertising creative domain: AI-generated content must pass copyright/trademark infringement checks**
- **Marketing domain: all external content must pass brand tone consistency checks and advertising law compliance detection**

## 36.3 Success Criteria

### Phase 1 Success Criteria

- workflow_run can be stably created and advanced
- Lease timeout triggers automatic reclaim
- CAS conflicts are correctly rejected

### Phase 2 Success Criteria

- OAPEFLIR main chain runs end-to-end
- Worker recovers within 30s after crash
- High-risk actions can be blocked by approval

### Phase 3 Success Criteria

- incident / replay / repair / DLQ are operationally usable
- External dependency circuit break → degradation → recovery is automated
- Projection is rebuildable and data-consistent

### Phase 4 Success Criteria

- 50 concurrent workflows run stably
- Load test meets SLO
- Disaster recovery drill RTO < 10min

### Phase 5 Success Criteria

- Non-technical users can create and manage tasks via natural language
- Goal decomposition engine automatically breaks down business goals into executable task graphs
- Proactive Agents trigger automatically per TriggerPolicy without storms
- Progressive autonomy Level 0→3 upgrade path validated end-to-end
- Three-level org hierarchy (Company→Department→Team) correctly drives approval routing
- SSO/SCIM auto-syncs users and deactivated accounts take effect < 5min
- Knowledge domain isolation has zero leakage, controlled sharing audit is complete

### Phase 6 Success Criteria

- Dual-Region Active-Active deployment, single Region failure RTO < 5min
- Under 1000 concurrent workflows, high-priority tasks are not starved
- SLA Tier P0 tasks complete within committed time at 99.9%
- Marketplace has at least 20 certified Packs listed
- User feedback → improvement closed loop < 7 days
- Pre-built Connectors cover all systems in P0 categories

### Phase 7 Success Criteria

- Users can query explanations for any workflow step; L1 latency < 2s, L3 latency < 10s
- Emergency brake drill: same Region full platform halt < 5s, recovery < 30min
- AgentVersion composite canary release validated end-to-end (canary→active auto-promotion)
- EdgeRuntime recovers connection after 24h offline with zero data loss during sync
- Behavior drift detection triggers alert 100% of the time when Agent behavior distribution shift > 2σ
- Cost optimization recommendations achieve savings rate ≥ 20% (compared to unoptimized baseline)
- Compliance report SOC2 Type II fully auto-generated, control point coverage ≥ 95%
- Capacity forecast 30-day accuracy ≥ 85%
- Multimodal: image analysis + speech-to-text available end-to-end
- PlatformOps Agent L1 maturity validated: auto-diagnostic report generation < 5min

### Phase 8 Success Criteria

- Harness Runtime runs end-to-end: ConstraintPack loading + Planner→Generator→Evaluator closed loop + HarnessDecision adjudication
- HarnessRun / HarnessStep all fields persisted and queryable
- Durable Harness 5 pauseReason types all have test coverage
- HITL Runtime 5 intervention modes (inspect/patch/override/takeover/resume) are usable
- Async Harness sleep/wake validated end-to-end
- Evaluation Harness sandbox evaluation + version comparison report can be generated
- Guardrails all five layers have interception test coverage
- Harness Replay can fully replay completed runs
- Ten invariants pass automated checks (violation fails CI)
- Tool Harness Capability Profile covers all registered tools

### Phase 9 Success Criteria

- All 24 vertical business domains reach GA status (passing §38 four-stage gates)
- All 12 DomainRecipe archetype templates have at least one domain instance validated
- Critical risk domains (Quantitative Trading/Financial Services/Finance/Legal/Healthcare) have 100% HITL coverage
- Cross-domain interaction matrix 24×24 validated with no unauthorized data flows
- Each domain's eval meets acceptance_threshold on all quality axes
- Quantitative trading domain ultra-low-latency path < 10ms (excluding LLM calls)
- Legal domain: 100% of all output reviewed by a licensed attorney before external release
- Academic research domain: citation accuracy 100% (zero fabrication)
- Healthcare domain: 100% of all diagnostic/treatment suggestions reviewed by a licensed physician
- Content moderation domain: CSAM reporting 100% completed within 1 minute
- HR domain: recruitment process bias audit all passed (AIR ≥ 0.8)
- IT operations domain: auto-remediation MTTR reduced ≥ 30%
- Customer service domain: first contact resolution rate ≥ 70%

---
# Part XI -- Conclusion and Appendices

---

# 70. Conclusion

This is not "an Agent platform that automatically does things", but rather:

> **An enterprise operating system that treats Agents as high-risk automation units subject to strict control, isolation, recovery, auditing, and governance — from one-person companies to ten-thousand-person enterprises, with a ten-layer architecture covering infrastructure, AI operations, business domain onboarding, vertical business domain deepening, intelligent interaction, Harness engineering, Harness eight-pillar deepening, organizational governance, scaled ecosystem, and operational maturity as a full-stack capability.**

Its core is not "how intelligent" but rather:

- Conservative by default
- High risk must be controlled
- Exceptions must be classified and handled
- Execution must be recoverable
- State must be replayable
- Behavior must be auditable
- Platform must be degradable
- Business must be pluggable but cannot bypass the foundation
- **Business domains must be structurally understood, not treated as opaque black boxes**
- **Non-technical users must be able to use it directly without understanding the underlying architecture**
- **Organizational governance must adapt to enterprise hierarchies, not assume flat structures**
- **Scaled operation must have fair resource scheduling and differentiated SLA guarantees**
- **Agent decisions must be explainable, and behavior drift must be detectable**
- **The platform must support emergency braking, and Agents must have a unified lifecycle**
- **Offline/edge scenarios must be operational — disconnected does not mean halted**
- **Multimodal I/O must be under unified security controls and cannot bypass content moderation**
- **Agent capabilities must be engineered — one-off model calls must be upgraded to a constrained, executable, memorable, feedback-capable, recoverable, evaluable, intervenable, observable Harness eight-pillar closed-loop system**
- **Business domains must be described with a unified meta-model (§37.11) — the 12-question template ensures structural consistency across 24 domains, configuration-driven, with templated onboarding for new domains**
- **Multi-Agent collaboration must follow mandatory protocols (§19.5) — permissions do not escalate, risk does not increase, constraints are not bypassed, audit chains are not broken**
- **Implementation must advance in rings — survival ring for baseline, availability ring for pilots, expansion ring for scale, avoiding breadth-over-depth that leads to nothing landing**

### Ten-Layer Architecture Overview

| Layer                          | Problem Solved                           | Core Sections           | Doc Part  |
| ------------------------------ | ---------------------------------------- | ----------------------- | --------- |
| Infrastructure Layer           | How to build the platform                | §4-§14, §24-§32        | Part I    |
| AI Operations Layer            | How to operate AI                        | §15-§23                 | Part II   |
| Business Domain Onboarding     | How to onboard business                  | §37-§38                 | Part III  |
| **Vertical Domain Deepening**  | **How to deepen 24 vertical domains**    | **§71-§94**             | Part IV   |
| Intelligent Interaction Layer  | How users interact                       | §39-§44                 | Part V    |
| Harness Engineering Layer      | How to consolidate capabilities          | §45.1-45.12, §58.1-58.5| Part VI   |
| Harness Eight-Pillar Layer     | How to deepen capabilities               | §45.13-45.21, §58.6    | Part VI   |
| Organizational Governance      | How to govern the org                    | §46-§51                 | Part VII  |
| Scale + Ecosystem Layer        | How to handle scale + build ecosystem    | §52-§57                 | Part VIII |
| Operational Maturity Layer     | How to run well + run safely             | §59-§69                 | Part IX   |

### Harness Eight-Pillar Capability Summary

| Question                          | Before                                                        | Current                                                                     |
| --------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Harness definition model?         | Five-tuple (Constraints+Tools+Context+Feedback+Recovery)      | Eight pillars (+Durability+Evaluation Harness+HITL Runtime+Observability)    |
| First-class run/step contract?    | Only HarnessRunRequest                                        | §45.13 HarnessRun/HarnessStep full lifecycle                                |
| Unified decision protocol?        | LoopController five outputs                                   | §58.6 HarnessDecision six standardized verdicts                             |
| Offline evaluation?               | Runtime Evaluator only                                        | §45.14 Evaluation Harness (pre-release + version comparison + outcome assertions) |
| Long-running task pause/resume?   | Recovery Controller fault recovery                            | §45.15 Durable Harness (5 pauseReasons + 4 resumeStrategies)               |
| Memory layered governance?        | HarnessContext four context types                             | §45.16 Memory Namespace (Working/Long-term/Shared + promotion strategy)     |
| Tool governance?                  | ToolbeltAssembler assembly                                    | §45.17 Tool Harness (Capability Profile + lifecycle + trust score)          |
| HITL level?                       | escalate to §21 HITL                                          | §45.18 HITL Runtime (inspect/patch/override/takeover/resume)                |
| Async task management?            | No explicit async pattern                                     | §45.19 Async Harness (create/poll/subscribe/intervene)                      |
| Where are guardrails enforced?    | Implicit in ConstraintPack                                    | §45.20 Guardrails five layers (input/planning/tool/memory/output)           |
| Baseline invariant rules?         | Scattered across ADRs                                         | §45.21 Ten invariants                                                       |

Only when combining **Infrastructure Layer stability**, **AI Operations Layer controllability**, **Business Domain Onboarding structuring**, **Vertical Domain Deepening domain expertise**, **Intelligent Interaction Layer usability**, **Harness Engineering Layer standardization**, **Harness Eight-Pillar deepening**, **Organizational Governance adaptability**, **Scale Layer scalability**, and **Operational Maturity Layer production-readiness** can an enterprise elevate its Agent platform from architectural design to a true enterprise-grade productivity operating system covering one-person companies to ten-thousand-person enterprises across 24 vertical business lines.

---
# Appendix G: Glossary and Abbreviation Index

| Abbreviation/Term         | Full Name                                                  | Description                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAPEFLIR                  | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release | Eight stages of the Agent core loop (§13)                                                                                                                  |
| HITL                      | Human-In-The-Loop                                          | Human-machine collaboration mode where humans participate in the Agent decision chain (§21)                                                                |
| DLQ                       | Dead Letter Queue                                          | Dead letter queue, a staging area for unprocessable messages/events (§28.6)                                                                                |
| CAS                       | Compare-And-Swap                                           | Optimistic concurrency control primitive, used for idempotent StateCommand writes (§5.4)                                                                   |
| SLO / SLA                 | Service Level Objective / Agreement                        | Service level objective / agreement (§27, §54)                                                                                                             |
| SEV1-4                    | Severity 1-4                                               | Incident severity levels (1 is highest) (§12)                                                                                                              |
| TTFT                      | Time To First Token                                        | Latency until the first token arrives in LLM streaming responses (§27.7)                                                                                   |
| SCC                       | Standard Contractual Clauses                               | GDPR standard contractual clauses, a legal mechanism for cross-border data transfers (§52.4)                                                               |
| BCR                       | Binding Corporate Rules                                    | Binding corporate rules, a mechanism for intra-group cross-border data transfers (§52.4)                                                                   |
| DPIA                      | Data Protection Impact Assessment                          | Data protection impact assessment (§52.4)                                                                                                                  |
| PIPL                      | Personal Information Protection Law                        | China's Personal Information Protection Law (§52)                                                                                                          |
| WCAG                      | Web Content Accessibility Guidelines                       | Web content accessibility guidelines (§44.6)                                                                                                               |
| SCIM                      | System for Cross-domain Identity Management                | Cross-domain identity management protocol (§48)                                                                                                            |
| SSO                       | Single Sign-On                                             | Single sign-on (§48)                                                                                                                                       |
| RBAC                      | Role-Based Access Control                                  | Role-based access control (§11)                                                                                                                            |
| DAG                       | Directed Acyclic Graph                                     | Directed acyclic graph, used for goal decomposition and task dependencies (§40)                                                                            |
| Pack                      | Business Pack                                              | Business domain capability pack, the deployable unit of an Agent (§30)                                                                                     |
| UoW                       | Unit of Work                                               | Unit of work, the atomic boundary of transactional operations                                                                                              |
| WAL                       | Write-Ahead Log                                            | Write-ahead log, a persistence mechanism for crash recovery (§31)                                                                                          |
| P1-P5                     | Plane 1-5                                                  | Five-plane architecture (Interface·Control·Orchestration·Execution·State & Evidence) (§4)                                                                  |
| X1                        | Cross-cutting Fabric                                       | Cross-cutting concerns (Reliability·Governance·Intelligence) (§4)                                                                                          |
| NL                        | Natural Language                                           | Natural language (§39)                                                                                                                                     |
| sLLM                      | Small LLM                                                  | Small localized language model, used for edge/offline scenarios (§62)                                                                                      |
| RTO / RPO                 | Recovery Time / Point Objective                            | Recovery time / point objective (§31)                                                                                                                      |
| Harness                   | Agent Harness Runtime                                      | Eight-pillar runtime (Constraint·Tool·State/Memory·Feedback·Durable Execution·Evaluation·HITL·Observability) (§45)                                         |
| PlanBundle                | Planner Agent standardized output                          | Contains goal/taskGraph/budget/riskProfile/successCriteria (§45.8)                                                                                         |
| WorkProduct               | Generator Agent standardized output                        | Contains stepId/artifacts/observations/telemetry (§45.9)                                                                                                   |
| EvaluationReport          | Evaluator Agent standardized output                        | Contains passed/score/issues/recommendation/confidence (§45.10)                                                                                            |
| FeedbackEnvelope          | Unified feedback envelope                                  | Standardized output for four-tier feedback closed loop (Step/Task/Workflow/System level) (§45.6)                                                           |
| ConstraintPack            | Task-level constraint pack                                 | Explicit constraint envelope carried by each HarnessRun (§45.3)                                                                                            |
| Toolbelt                  | Task-level tool set                                        | Tool subset assembled per the principle of least privilege (§45.4)                                                                                         |
| HarnessRun                | Harness run entity                                         | First-class entity of a complete Harness task run, with lifecycle and audit (§45.13)                                                                       |
| HarnessStep               | Harness step entity                                        | Single execution step contract, with phase/role/inputs/outputs/rationale (§45.13)                                                                          |
| HarnessDecision           | Harness unified adjudication                               | Six adjudications: accept/retry/replan/escalate/downgrade/abort (§58.6)                                                                                    |
| Evaluation Harness        | Unified evaluation runtime                                 | Runtime adjudication + pre-release evaluation + version comparison evaluation system (§45.14)                                                              |
| Durable Harness           | Durable execution pillar                                   | checkpoint/pause/resume as foundational Harness capabilities (§45.15)                                                                                      |
| Memory Namespace          | Memory namespace                                           | Working/Long-term/Shared Knowledge three-layer isolation and promotion (§45.16)                                                                            |
| Tool Harness              | Tool governance layer                                      | Tool Capability Profile + lifecycle + trust level governance (§45.17)                                                                                      |
| HITL Runtime              | Human-in-the-loop runtime                                  | inspect/patch/override/takeover/resume five capability types (§45.18)                                                                                      |
| Async Harness             | Async execution mode                                       | Multi-hour/multi-turn/multi-approval async Harness execution mode (§45.19)                                                                                 |
| Guardrails                | Layered guardrails                                         | input/planning/tool/memory/output five-layer dynamic checkpoints (§45.20)                                                                                  |
| DomainRecipe              | Domain template archetype                                  | Twelve archetypes (CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps) (§37.7) |
| Trading Archetype         | Trading archetype                                          | Signal→Risk Control→Execution→Settlement workflow pattern (§37.7, §71, §74)                                                                                |
| Compliance Archetype      | Compliance archetype                                       | Monitor→Detect→Assess→Report workflow pattern (§37.7, §74, §81, §82)                                                                                       |
| Research Archetype        | Research archetype                                         | Collect→Analyze→Synthesize→Publish workflow pattern (§37.7, §78, §79)                                                                                      |
| Adversarial Archetype     | Adversarial archetype                                      | Attack Surface→Defense→Audit→Remediation workflow pattern (§37.7, §76, §82)                                                                                |
| FTO                       | Freedom-to-Operate                                         | Freedom-to-operate search, an intellectual property term (§82)                                                                                             |
| SAR/STR                   | Suspicious Activity/Transaction Report                     | Suspicious activity/transaction report, required by AML regulations (§74)                                                                                  |
| PSI                       | Population Stability Index                                 | Model stability index, a financial services model monitoring metric (§74)                                                                                  |
| VaR/CVaR                  | Value at Risk / Conditional VaR                            | Value at risk / conditional value at risk, quantitative trading risk metrics (§71)                                                                         |
| ROAS                      | Return on Ad Spend                                         | Return on ad spend (§73)                                                                                                                                   |
| MRR                       | Mean Reciprocal Rank                                       | Mean reciprocal rank, a search quality metric (§80)                                                                                                        |
| NDCG                      | Normalized Discounted Cumulative Gain                      | Normalized discounted cumulative gain, a search ranking metric (§80)                                                                                       |
| Moderation Archetype      | Moderation archetype                                       | Content Ingest→Multimodal Detection→Disposition→Appeal workflow pattern (§37.7, §83, §92)                                                                  |
| Logistics Archetype       | Logistics archetype                                        | Forecast→Optimize→Dispatch→Track→Exception Handling workflow pattern (§37.7, §86, §88)                                                                     |
| Conversational Archetype  | Conversational archetype                                   | Intent Recognition→Knowledge Retrieval→Answer→Feedback workflow pattern (§37.7, §89, §90, §91)                                                             |
| IncidentOps Archetype     | IncidentOps archetype                                      | Alert→Diagnose→Remediate→Postmortem→Prevent workflow pattern (§37.7, §93)                                                                                  |
| CSAM                      | Child Sexual Abuse Material                                | Child sexual abuse material, legally mandated reportable content in content moderation (§92)                                                               |
| AIR                       | Adverse Impact Ratio                                       | Adverse impact ratio, an HR recruitment fairness metric, compliance requires ≥ 0.8 (§87)                                                                   |
| MTTR                      | Mean Time To Repair/Resolve                                | Mean time to repair/resolve, a core IT operations efficiency metric (§93)                                                                                  |
| MTTD                      | Mean Time To Detect                                        | Mean time to detect, an IT operations alerting efficiency metric (§93)                                                                                     |
| FCR                       | First Contact Resolution                                   | First contact resolution rate, a core customer service quality metric (§91)                                                                                |
| AHT                       | Average Handle Time                                        | Average handle time, a customer service efficiency metric (§91)                                                                                            |
| COPPA                     | Children's Online Privacy Protection Act                   | U.S. Children's Online Privacy Protection Act (§90)                                                                                                        |
| SOV                       | Share of Voice                                             | Brand share of voice, a marketing effectiveness metric (§94)                                                                                               |
| CDM                       | Canonical Domain Meta-Model                                | Canonical domain meta-model, all 24 domains described using the same 12-question template (§37.11)                                                         |
| ACP                       | Agent Collaboration Protocol                               | Multi-Agent collaboration protocol, defining 8 message types + 7 inviolable rules (§19.5)                                                                  |
| Three-Ring Implementation | Three-Ring Implementation Priority                         | Survival Ring→Usability Ring→Expansion Ring layered implementation priority (Part X Preface)                                                               |

---
# Appendix A: Version Change History

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 2026-04    | Initial five-plane architecture + seven stability layers + OAPEFLIR concept design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v1.1    | 2026-04    | Added risk matrix, DLQ model, deployment recommendations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v1.2    | 2026-04    | Added data model with 44 tables, event namespace, ADR recommendations, recommended directory structure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| v2.0    | 2026-04-18 | **Infrastructure Improvement Version**: Added inter-plane communication contracts (§5), API contracts (§6), service communication (§7), scalability (§8), configuration governance (§24), performance SLO (§27), disaster recovery & high availability (§31); improved risk scoring (§10), OAPEFLIR interfaces (§13), storage abstraction (§26), deployment (§32), roadmap (§33); resolved 14 design deficiencies from v1.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.1    | 2026-04-19 | **AI Operations Completeness Version**: Added LLM Provider abstraction & failover (§15), Prompt management & versioning (§16), model evaluation & quality gate (§17), cost management & token metering (§18), inter-Agent delegation & collaboration (§19), long-running tasks & workflow hibernation (§20), human-machine collaboration modes (§21), SDK & developer experience (§22), compliance & data governance (§23); improved API authentication & Webhook (§6), security threat model (§11), alert routing & distributed tracing (§12), Error Budget & LLM latency (§27), Pack lifecycle & plugin governance (§30); added 9 ADRs; resolved 14 AI operations layer deficiencies from v2.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| v2.2    | 2026-04-19 | **Business Domain Onboarding Completeness Version**: Added business domain modeling & onboarding architecture (§37) — DomainDescriptor structured domain modeling, DomainRiskProfile domain risk profiling, DomainKnowledgeSchema domain knowledge structure, DomainEvalFramework domain evaluation framework, DomainPromptLibrary domain Prompt library, DomainRecipe domain template prototypes, DomainInteractionPolicy cross-domain interaction strategy, DomainGovernancePolicy domain governance model; added business domain onboarding Runbook (§38) — four-stage gate process (Modeling→Development→Certification→Canary); improved Business Pack model (§30) to link DomainDescriptor; added 4 ADRs; resolved 10 business domain onboarding layer deficiencies from v2.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v2.3    | 2026-04-19 | **Intelligent Interaction Completeness Version**: Added natural language task entry architecture (§39), goal decomposition engine architecture (§40), proactive Agent framework (§41), progressive autonomy model (§42), unified operations dashboard architecture (§43), non-technical user experience architecture (§44); added 6 ADRs; upgraded platform from "Agent infrastructure" to a "Agent operating system" for non-technical users                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v2.4    | 2026-04-19 | **Organizational Governance Completeness Version**: Added organizational hierarchy model (§46), org-chart approval routing (§47), enterprise SSO/SCIM integration (§48), departmental compliance policy engine (§49), knowledge domain isolation & controlled sharing (§50), tiered governance delegation (§51); added 6 ADRs; enabled platform to adapt to organizational complexity ranging from one-person companies to 10,000-employee enterprises                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| v2.5    | 2026-04-19 | **Scale Ecosystem Completeness Version**: Added multi-Region deployment architecture (§52), large-scale resource contention management (§53), SLA tiered guarantees (§54), Agent marketplace & ecosystem (§55), feedback-driven continuous improvement pipeline (§56), external system integration framework (§57); added 6 ADRs; completed cross-Region high availability, fair resource scheduling, differentiated SLA guarantees, open ecosystem, and continuous self-improvement capabilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.6    | 2026-04-19 | **Operational Maturity Completeness Version**: Added Agent explainability & decision transparency (§59), emergency brake & global circuit breaker (§60), Agent unified lifecycle management (§61), offline & edge deployment (§62), Agent behavior drift detection (§63), cost attribution & optimization engine (§64), workflow visual debugger (§65), compliance report auto-generation engine (§66), capacity planning & cost forecasting (§67), multimodal capabilities (§68), platform self-ops Agent (§69); added 11 ADRs; completed the operational maturity layer bridging from "architecturally complete design" to "production-ready operations"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.7    | 2026-04-19 | **Quality Correction Version**: Fixed ADR autonomy level contradiction (monotonic→guarded progression); unified §9.5/§14.8 pattern enumeration to 8-pattern canonical set; completed missing principal/trace_id fields in ExecutionPlan/StateCommand; expanded Prompt injection defense architecture (§16.5); fixed ADR-NL TaskSpec→RequestEnvelope reference; completed §26 data model (44→71 tables) and §28 event namespace (17→25); completed §33 roadmap Phase 5-7; completed §43 L2/L3 dashboard view definitions; added §39.7 i18n, §44.6 WCAG, §52.4 GDPR cross-border transfer, §55.4-55.6 marketplace revenue/deprecation/dependency management, §15.6 streaming error handling; added §40 circular dependency detection, §5.2 P2→P4 communication paths; fixed §62 typo and §70 conclusion omission; added Appendix G Glossary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v2.8    | 2026-04-21 | **Harness Engineering Version**: Added Harness Runtime architecture (§45) — HarnessRuntime unified entry, ConstraintPack task-level constraint envelope, ToolbeltAssembler dynamic tool assembly, HarnessContext unified context & token budget, FeedbackEnvelope four-stage feedback closed loop, HarnessLoopController unified loop control, Planner/Generator/Evaluator three Agent role standardization, Recovery Controller failure recovery; added Harness cross-cutting concerns (§58) — Harness-level observability, Prompt layered governance, Failure-to-Learning pipeline, Replay/Simulation capabilities, architecture legacy issue consolidation (§21/§47 approval boundaries, §23/§49 compliance boundaries, §31/§52 HA mapping, §32/§8/§33 phase alignment, unified error classification, §42/§61 autonomy linkage); added §13.5 OAPEFLIR→Harness external semantic mapping; added 7 ADRs; completed §25.6 consistency model & guarantee levels, §25.7 schema migration strategy; fixed §5.4 P5 communication integrity rules, §7.2 communication topology diagram, §8.4 S4 stage TODO, §19.2 global call depth limit, §20.4 extended approval renewal mechanism, §42.3 trust score decay mechanism, §60.3 Admin unavailability fallback plan; updated §33 roadmap with Phase 8 + parallel dependency graph; updated §35 code directory with harness/; updated Appendix G Glossary with 9 Harness terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| v2.9    | 2026-04-21 | **Harness Eight-Pillar Deepening Version**: Harness upgraded from five-tuple to eight-pillar model (Constraints·Tools·State/Memory·Feedback·Durability·Evaluation Harness·HITL Runtime·Observability/Replay), fusing three major industry paradigms: Anthropic role-based closed loop, LangGraph durable runtime, and OpenAI governance & Guardrails primitives; added §45.13 HarnessRun/HarnessStep unified execution contract, §45.14 Evaluation Harness unified evaluation runtime (pre-release evaluation+version comparison+outcome assertions), §45.15 Durable Harness persistent execution pillar (5 pauseReason types+4 resumeStrategy types), §45.16 Memory Namespace three-tier memory namespace (Working/Long-term/Shared Knowledge+promotion strategy), §45.17 Tool Harness tool governance (Capability Profile+lifecycle+trust score), §45.18 HITL Runtime human-machine collaboration runtime (inspect/patch/override/takeover/resume), §45.19 Async Harness asynchronous execution mode, §45.20 Guardrails five-layer architecture (input/planning/tool/memory/output), §45.21 ten invariants; added §58.6 HarnessDecision unified adjudication protocol (six adjudication types standardized); updated §45.1 core axioms to eight pillars+industry mapping table, §45.2 overall architecture diagram with new components; updated §33 roadmap Phase 8 split into 8a/8b/8c three stages (20 weeks); added 9 ADRs (81 total); updated §35 code directory with 7 new harness subdirectories; updated §70 conclusion to nine-layer architecture; updated Appendix G Glossary with 11 Harness terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| v3.0    | 2026-04-22 | **Vertical Business Domain Deepening Version**: Added 12 vertical business domain architecture chapters (§71-§82) — Quantitative Trading · E-commerce · Advertising & Promotion · Financial Services · Data Processing · Code Development · User Operations · Industry Research · Academic Research · Enterprise Knowledge Base · Finance · Legal; DomainRecipe expanded from 4 archetypes to 8 (added Trading/Compliance/Research/Adversarial); §37.1 problem statement table expanded to 12 domains×8 dimensions panoramic comparison; §37.4/§37.5 knowledge and evaluation tables expanded to cover 12-domain representative scenarios; §33 roadmap added Phase 9 (vertical business domain deepening rollout, 3 batches×8 weeks=24 weeks) with Phase dependency graph update; §34 added 12 domain-specific ADRs (93 total); §35 code directory added 11 domain instance directories; §36 added 8 domain-specific risks and 7 domain-specific hard constraints; §38 onboarding Runbook three Gates added vertical domain-specific checklists; §70 conclusion upgraded from nine-layer to ten-layer architecture (added vertical business domain deepening layer); Appendix G added 13 domain-specific terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| v3.1    | 2026-04-22 | **24-Domain Full Coverage Version**: Added 12 vertical business domain architecture chapters (§83-§94) — Live Streaming · Ad Creative Production · Game Development · Game Publishing · Human Resources · Supply Chain & Logistics · Healthcare · Education & Training · Customer Service · Content Moderation & Safety · IT Ops SRE/DevOps · Marketing & Branding; DomainRecipe expanded from 8 archetypes to 12 (added Moderation/Logistics/Conversational/IncidentOps); §37.1 problem statement table expanded to 24 domains×8 dimensions panoramic comparison (4 tables); §33 roadmap Phase 9 expanded from 3 batches to 6 (9a-9f, total 48 weeks) with dependency graph update; §34 added 12 domain-specific ADRs (105 total); §35 code directory added 12 domain instance directories; §36 added 11 domain-specific risks and 11 domain-specific hard constraints; §36.3 Phase 9 success criteria expanded to 24 domains; §38 onboarding Runbook three Gates expanded Critical/High risk domain checklists; §70 conclusion 12→24 vertical domains; Appendix G added 13 domain-specific terms (4 new archetypes + CSAM/AIR/MTTR/MTTD/FCR/AHT/COPPA/SOV/SOV); **Part restructuring**: Full document reorganized into Part I-XI structure following ten-layer architecture — Infrastructure layer (§4-§14, §24-§32) consolidated into Part I, §58 Harness cross-cutting merged after §45 (Part VI), §71-§94 vertical domains moved after §38 (Part IV), §33-§36 implementation summary moved to Part X, §70 conclusion moved to end of document (Part XI); section numbers remain stable for backward compatibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| v3.2    | 2026-04-22 | **Architecture Deepening Version**: Added Canonical Domain Meta-Model (§37.11) — 12-question standard template, 24-domain population matrix (Q1-Q6 + Q7-Q12 two tables), enabling new domain onboarding to be template-driven, platform kernel configuration-driven, and dashboard/approval/evaluation uniformly generated; added Agent Collaboration Protocol (§19.5) — 8 message types (task_request/task_offer/task_accept/task_reject/partial_result/escalation_request/completion_report/takeover_notice), 9 mandatory fields, 7 invariant rules (no privilege escalation/no risk elevation/no constraint bypass/output must be reviewable/takeover must be audited/budget must not be exceeded/depth must not exceed limit), upgrading the §19.1-19.4 delegation model from convention to mandatory protocol; added Three-Ring Implementation Priority (Part X preamble) — Ring 1 Platform Survival Ring (P1-P5+ConstraintPack+HarnessRun+Risk/Audit+Lease/Recovery+Panic/Incident+ModelGateway, corresponding to Phase 1-2+8a, ~16 weeks), Ring 2 Platform Usability Ring (NL Entry+GoalDecomposition+HITL+AsyncHarness+Dashboard+Org/SSO+DomainDescriptor+Meta-Model+Collaboration Protocol, corresponding to Phase 3-5+8b/8c, ~24 weeks), Ring 3 Platform Expansion Ring (Marketplace+MultiRegion+Edge+CostOptimizer+BehaviorDrift+ComplianceReporter+24 DomainPacks, corresponding to Phase 6-9, ~40+ weeks); updated §70 conclusion with 3 new core principles (meta-model unification · collaboration protocol enforcement · ring-based implementation); **Review corrections**: §38 onboarding Runbook added meta-model steps and gate items (§37.11), §45 Harness Runtime added collaboration protocol linkage (§19.5), §33 Phase 5 deliverables added meta-model+collaboration protocol, §33 dependency Phase 8b→8c corrected, §36.3 Phase 8 success criteria completed, §34 domain ADR tags 12→24+completed Game Development domain ADR (105 total), §36.1 completed Game Development domain risks (11 total), §82 Legal domain 12→24 domains corrected, Three-Ring Phase mapping corrected |
