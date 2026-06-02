# Automatic Agent Platform — Mission Architecture Integration Plan Implementation Contract Version v1.4

> **Document Version**: v1.4
> **Baseline Document**: `mission_architecture_design_review_v1_3.md`
> **Review Goal**: On the basis of v1.3 Architecture Implementation Contract Version, merge the Step degradation rules, complete the naming boundary, interface constraints, test governance and migration requirements between Mission and Graph/Node-centric runtime, forming a complete merged version that can directly enter the implementation phase.
> **Final Conclusion**: Mission should be incorporated into the system, but must serve as the **long-term goal and governance context root object**; it cannot become a new execution object, cannot replace PlanGraph, cannot revive legacy WorkflowState, nor generate a fourth set of RequestEnvelope / ExecutionPlan / StateCommand; at the same time the Step concept must be weakened, and the system canonical runtime uniformly adopts `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt`.

---

## 0. Final Review Conclusion

The correct positioning of Mission is:

```text
Mission = Agent ecosystem-level long-term goal + governance boundary + budget boundary + knowledge boundary + learning attribution boundary + audit attribution boundary
```

It is not:

```text
Not an Agent Session
Not a WorkflowState
Not an ExecutionPlan
Not a PlanGraphBundle
Not a HarnessRun
Not a NodeRun
Not a UI Project Folder
Not a Domain
Not an Agent Team
```

After the system incorporates Mission, it is recommended to form the following canonical hierarchy:

```text
Tenant / Org
  └── Mission
        ├── Session              # Human-machine interaction context, can enter the same Mission multiple times
        ├── Task                 # A formal work request, must bind MissionContext
        ├── WorkflowTemplate     # Reusable process template, not part of execution state
        ├── PlanGraphBundle      # DAG execution plan for the current task
        ├── HarnessRun           # Current execution instance, binds only one MissionSnapshot
        ├── NodeRun              # Single graph node run
        ├── NodeAttempt          # Single model/tool/human attempt
        ├── EvidenceBundle       # Evidence and audit chain
        └── LearningObject       # Can choose to remain in Mission, or be promoted to Domain/Platform after approval
```

The most critical invariants:

| Invariant | Description |
|---|---|
| INV-MISSION-001 | Every executable Task must resolve a `missionRef` before dispatch, but does not necessarily create a new Mission each time. |
| INV-MISSION-002 | A HarnessRun can only bind to one MissionContextSnapshot; cross-Mission collaboration must split into child task or MissionHandoff. |
| INV-MISSION-003 | Mission only stores goals, boundaries, policies, budgets, members, knowledge/learning attribution; must not store running node state. |
| INV-MISSION-004 | RuntimeMode does not do linear ordering, must be converted into RuntimeConstraintSet and then take constraint intersection. |
| INV-MISSION-005 | MissionSnapshot ensures audit reproducibility; live revocation check ensures revocation/freeze/budget exhaustion take effect in time. |
| INV-MISSION-006 | All Mission state changes must go through PlatformFactEvent append, direct truth overwrite is not allowed. |
| INV-MISSION-007 | MissionId can enter log/trace/event, but by default cannot serve as metrics label, to avoid high cardinality explosion. |
| INV-MISSION-008 | Mission does not add a fourth set of core contracts, only extends existing canonical contracts. |
| INV-MISSION-009 | `Step` is not a canonical object; Mission, Task, Plan, Harness, Event, Budget, Evidence, API must not add Step-centric fields, can only be used as natural language labels in UI/document display layer. |

---

## 1. Overall Architecture Diagram: Mission Integrates into Five Planes

> Mission is not a sixth plane, but the governance context running through the Control Plane, Orchestration Plane, Execution Plane, and State & Evidence Plane.

```mermaid
flowchart TB
    User["User / Operator / Agent"]

    subgraph P1["P1 Interface Plane"]
        NL["NL Gateway\nRawInput -> Clarification -> ConfirmedTaskSpec"]
        API["HTTP / WS / Channel Gateway"]
        UI["Mission Console / Task Cockpit / Dashboard"]
    end

    subgraph P2["P2 Control Plane"]
        MissionGov["Mission Governance Service"]
        MissionResolver["Mission Resolver"]
        IAM["IAM / RBAC / ABAC"]
        Policy["Policy Engine"]
        Risk["Risk Engine"]
        Budget["Mission Budget Guard"]
        Config["Config Center"]
    end

    subgraph P3["P3 Orchestration Plane"]
        OAPEFLIR["OAPEFLIR Loop\nObserve Assess Plan Execute Feedback Learn Improve Release"]
        Planner["PlanGraph Builder / Validator"]
        Workflow["Workflow Template Registry"]
        HITL["HITL / Approval Orchestration"]
        Learn["Learning Promotion Gate"]
    end

    subgraph P4["P4 Execution Plane"]
        Harness["Harness Runtime"]
        Scheduler["Graph Scheduler"]
        NodeRun["NodeRun / NodeAttempt"]
        ToolExec["Tool Executor / Sandbox"]
        ModelGateway["Model Gateway"]
        SideEffect["SideEffect Manager"]
        Lease["Lease / Fencing / Recovery"]
    end

    subgraph P5["P5 State & Evidence Plane"]
        Truth[("Append-only Truth Store")]
        EventBus["Durable Event Bus"]
        Projection["Mission / Task / Run Projections"]
        Evidence["Evidence Bundle / Audit Chain"]
        Memory["Mission Memory / Knowledge Boundary"]
        Artifacts["Artifacts / Reports / Checkpoints"]
    end

    User --> UI
    User --> NL
    API --> NL
    NL --> MissionResolver
    MissionResolver --> MissionGov
    MissionGov --> IAM
    MissionGov --> Policy
    MissionGov --> Risk
    MissionGov --> Budget
    MissionResolver --> OAPEFLIR
    OAPEFLIR --> Planner
    Planner --> Harness
    Harness --> Scheduler
    Scheduler --> NodeRun
    NodeRun --> ToolExec
    NodeRun --> ModelGateway
    NodeRun --> SideEffect
    NodeRun --> Lease

    MissionGov --> Truth
    Harness --> EventBus
    NodeRun --> EventBus
    SideEffect --> EventBus
    EventBus --> Truth
    EventBus --> Projection
    EventBus --> Evidence
    Evidence --> UI
    Projection --> UI
    Memory --> MissionGov
    Learn --> Memory
    Learn --> Evidence
```

### 1.1 Architecture Diagram Interpretation

Mission runs through the chain, but does not take over execution:

1. **P1 Interface** receives user input, can only provide Mission hint, cannot directly authorize Mission.
2. **P2 Control** determines whether Mission exists, whether it is available, whether the user has permission, whether budget is available, whether risk is acceptable.
3. **P3 Orchestration** generates PlanGraphBundle under Mission constraints.
4. **P4 Execution** each NodeRun executes under MissionSnapshot + live guard.
5. **P5 State & Evidence** records fact events, evidence, projections and audit chain of Mission/Task/Run/Node/SideEffect.

---

## 2. Object Relationship Diagram: Mission and Task / Session / Plan / Run

```mermaid
erDiagram
    TENANT ||--o{ MISSION : owns
    ORG_NODE ||--o{ MISSION_MEMBERSHIP : grants
    PRINCIPAL ||--o{ MISSION_MEMBERSHIP : has
    MISSION ||--o{ MISSION_MEMBERSHIP : contains
    MISSION ||--o{ SESSION : contextualizes
    MISSION ||--o{ TASK : scopes
    SESSION ||--o{ TASK : creates
    TASK ||--|| CONFIRMED_TASK_SPEC : freezes
    TASK ||--o{ PLAN_GRAPH_BUNDLE : plans
    PLAN_GRAPH_BUNDLE ||--o{ HARNESS_RUN : executes
    HARNESS_RUN ||--o{ NODE_RUN : contains
    NODE_RUN ||--o{ NODE_ATTEMPT : retries
    NODE_ATTEMPT ||--o{ TOOL_CALL : invokes
    NODE_ATTEMPT ||--o{ MODEL_CALL : invokes
    NODE_ATTEMPT ||--o{ EVIDENCE_REF : produces
    MISSION ||--o{ MISSION_CONTEXT_SNAPSHOT : snapshots
    MISSION_CONTEXT_SNAPSHOT ||--o{ HARNESS_RUN : binds
    MISSION ||--o{ BUDGET_RESERVATION : reserves
    MISSION ||--o{ LEARNING_OBJECT : learns
    MISSION ||--o{ ARTIFACT_RECORD : publishes
```

### 2.1 Core Relationships

| Object | Lifecycle Length | Main Responsibility | Is Execution Object | Can Cross Session | Can Cross Task |
|---|---:|---|---:|---:|---:|
| Mission | long-term | goals, governance, budget, knowledge, learning, attribution | no | yes | yes |
| Session | short/medium | multi-turn dialog context, clarification, preferences, temporary state | no | no | can produce multiple Tasks |
| Task | medium | a formal work request and acceptance goal | no | can reference Session | no |
| WorkflowTemplate | long-term | reusable process template | no | yes | yes |
| PlanGraphBundle | single | DAG execution plan for the current Task | no | no | no |
| HarnessRun | single | execution instance of the current plan | yes | no | no |
| NodeRun | single | run of a single node in DAG | yes | no | no |
| NodeAttempt | very short | single attempt, model/tool call, error, evidence | yes | no | no |
| Agent | long-term/medium-term | capability provider or execution role | no | yes | yes |
| Runtime | system-level | scheduling, execution, recovery, isolation | yes | yes | yes |
| Step | non-authoritative display term | natural language name for NodeRun in UI/docs; must not serve as truth/contract/runtime field | no | no | no |

---

## 3. When Mission, Task, Session Are Created

### 3.1 When Session Is Created

Session is the interaction context, only created when the user or external channel starts a context.

Typical scenarios for creating Session:

| Scenario | Whether to Create Session | Description |
|---|---:|---|
| User opens Web Chat / NL panel | yes | save multi-turn context, clarification state, user preferences |
| Slack/Telegram webhook inbound | yes or reuse | reuse by channel thread / conversation id |
| Backend scheduled task | no | no human-machine dialog context, can be driven directly by Mission/Task |
| API directly submits Task | optional | if no multi-turn context, can not create Session |
| Proactive Agent triggers suggestion | optional | need to create operator session when interacting with user |

Session does not mean the task officially starts. Formal execution must enter Task.

### 3.2 When Task Is Created

Task is a formal work request. Only created after intake, clarification, confirmation or risk waiver.

Conditions for creating Task:

```text
RawInput
  -> parse intent
  -> resolve slots
  -> risk preview
  -> clarification / confirmation if required
  -> ConfirmedTaskSpec
  -> MissionResolve
  -> RequestEnvelope
  -> Task
```

Task must have:

| Field | Description |
|---|---|
| tenantId | tenant isolation |
| principal | initiator or agent |
| missionRef | bound Mission or AdHocMission |
| confirmedTaskSpecId | frozen requirement specification |
| idempotencyKey | prevent duplicate submission |
| riskProfile | risk preview |
| runtimeConstraints | initial runtime constraints |
| budgetIntent | budget requirement |
| traceId / correlationId | observability chain |

### 3.3 When Mission Is Created

Not every dialog creates a new Mission, nor does every Task create a new Mission.

Mission creation rules:

| Trigger Condition | Whether to Create New Mission | Example |
|---|---:|---|
| User explicitly creates long-term goal | yes | "Establish company-level Agent platform production specialization" |
| Multiple Tasks share long-term goal, budget, knowledge, approval | yes | R&D project, continuous operation, compliance audit, investment research topic |
| Proactive / Scheduled / Autonomous work | yes | daily monitoring, automatic fix, continuous evaluation |
| Cross-team / cross-Agent / cross-Domain collaboration | yes | legal + finance + engineering joint process |
| Single low-risk Q&A | no, bind AdHocMission | "Explain what DAG is" |
| Single high-risk operation | not necessarily new, but must explicitly select or create Mission | "Deploy production configuration" |
| API low-risk context-less request | bind system default Mission | read-only query API |

### 3.4 Whether Every Task Must Go Through Mission

**Must bind MissionContext before execution, but not necessarily user-visible, nor necessarily create a new Mission.**

Three types of Mission are recommended:

| Type | Visibility | Purpose | TTL |
|---|---|---|---|
| ExplicitMission | visible to user/team | long-term goal, project, automation ecosystem | long-term |
| SystemMission | system-visible | incident/recovery/maintenance/bootstrap | medium-long term |
| AdHocMission | default collapsed | governance context for single low-risk task | short-term auto archive |

Key principles:

```text
Every executable Task must bind to one MissionContext.
Not every user interaction creates a new Mission.
Not every Mission is user-visible.
```

---

## 4. Request Flow: From User Input to Mission Binding Then to Execution

```mermaid
sequenceDiagram
    participant U as User / Channel
    participant NL as NL Gateway
    participant C as Clarification Service
    participant MR as Mission Resolver
    participant CP as Control Plane
    participant OR as OAPEFLIR Orchestrator
    participant PL as PlanGraph Builder
    participant HR as Harness Runtime
    participant EB as Event Bus
    participant TS as Truth Store

    U->>NL: RawInput
    NL->>NL: Parse intent + risk preview
    alt ambiguous or high risk
        NL->>C: Create ClarificationSession
        C->>U: Ask clarification / confirmation
        U->>C: Confirm
    end
    C-->>NL: ConfirmedTaskSpec
    NL->>MR: Resolve mission candidates
    MR->>CP: Check membership + policy + budget + risk
    CP-->>MR: MissionContextSnapshot
    MR-->>NL: missionRef + constraints
    NL->>OR: RequestEnvelope with missionRef
    OR->>PL: Build PlanGraphBundle
    PL->>CP: Validate Mission constraints + domain/tool boundaries
    CP-->>PL: Allowed / requires HITL / denied
    PL->>HR: Start HarnessRun with MissionContextSnapshot
    HR->>EB: platform.harness_run.started
    HR->>TS: Append truth event
    HR->>EB: node_run / node_attempt events
```

### 4.1 MissionResolver Two-Stage Design

To avoid the circular dependency of "need Domain to select Mission, but Mission also limits Domain", adopt two stages:

```text
Stage 1: PreRouteClassifier
  Input RawInput / ConfirmedTaskSpec
  Output domainHints / riskHints / workflowHints / candidateMissionIds

Stage 2: MissionResolver
  Get MissionContextSnapshot according to hints + membership + recent missions + explicit selection

Stage 3: FinalRouteValidator
  Do final routing within the domain/tool/workflow/runtimeConstraints allowed by Mission
```

### 4.2 Mission Selection Priority

```text
explicit missionId from user/API
> active session mission binding
> recent explicit mission in same workspace
> resolver recommended mission requiring user confirmation
> ad_hoc mission for low-risk task
> reject and ask user to choose/create mission
```

High-risk write operations cannot silently use recent mission, must be explicitly confirmed.

---

## 5. Mission Contract Design

### 5.1 MissionRecord

```ts
export type MissionStatus =
  | "draft"
  | "reviewing"
  | "active"
  | "paused"
  | "completing"
  | "completed"
  | "cancelled"
  | "archived";

export type MissionKind =
  | "explicit"
  | "system"
  | "ad_hoc"
  | "incident"
  | "research"
  | "operations"
  | "product"
  | "compliance";

export interface MissionRecord {
  missionId: string;
  tenantId: string;
  orgId?: string;
  workspaceId?: string;
  parentMissionId?: string;

  kind: MissionKind;
  status: MissionStatus;
  title: string;
  objective: string;
  successCriteria: MissionSuccessCriterion[];

  ownerPrincipalId: string;
  accountableTeamId?: string;
  domainRefs: string[];
  allowedWorkflowTemplateRefs: string[];
  allowedToolRefs: string[];

  runtimeConstraintPolicyRef: string;
  riskPolicyRef: string;
  budgetEnvelopeRef: string;
  knowledgeBoundaryRef?: string;
  learningPolicyRef?: string;
  approvalPolicyRefs: string[];

  dataResidency?: string;
  retentionPolicyRef?: string;
  sloPolicyRef?: string;

  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;

  version: number;
  schemaVersion: string;
  auditRefs: string[];
}
```

### 5.2 MissionContextSnapshot

Snapshot is used for execution reproducibility, cannot be modified in place at runtime.

```ts
export interface MissionContextSnapshot {
  snapshotId: string;
  missionId: string;
  missionVersion: number;
  tenantId: string;
  createdAt: string;

  objectiveHash: string;
  policySnapshotHash: string;
  budgetSnapshotHash: string;
  membershipSnapshotHash: string;
  knowledgeBoundaryHash?: string;

  effectiveRuntimeConstraints: RuntimeConstraintSet;
  effectiveApprovalRequirements: ApprovalRequirement[];
  effectiveBudgetEnvelope: MissionBudgetEnvelope;
  effectiveDataPolicy: DataPolicySnapshot;
  effectiveLearningPolicy: LearningPolicySnapshot;

  sourceEventId: string;
  auditRefs: string[];
}
```

### 5.3 MissionMembership

```ts
export type MissionRole =
  | "viewer"
  | "contributor"
  | "operator"
  | "approver"
  | "owner"
  | "auditor";

export interface MissionMembership {
  missionId: string;
  tenantId: string;
  principalId: string;
  role: MissionRole;
  grantedBy: string;
  expiresAt?: string;
  constraints?: RuntimeConstraintSet;
  createdAt: string;
  revokedAt?: string;
  version: number;
}
```

Permission calculation must be intersection:

```text
EffectivePermission =
  IAMRoleCapabilities
∩ MissionMembershipCapabilities
∩ MissionPolicyCapabilities
∩ DomainPolicyCapabilities
∩ RiskPolicyCapabilities
∩ RuntimeConstraintSet
```

### 5.4 RuntimeConstraintSet

```ts
export interface RuntimeConstraintSet {
  allowRead: boolean;
  allowWrite: boolean;
  allowExternalCall: boolean;
  allowToolExecution: boolean;
  allowModelCall: boolean;
  allowRollout: boolean;
  allowSideEffectCommit: boolean;
  allowDelegation: boolean;
  allowLearningPromotion: boolean;

  requireHumanApprovalForWrite: boolean;
  requireHumanApprovalForExternalCall: boolean;
  requireHumanApprovalForRollout: boolean;
  requireHumanApprovalForLearningPromotion: boolean;

  maxAutoExecuteRisk: "none" | "low" | "medium" | "high" | "critical";
  maxDelegationDepth: number;
  maxAutonomousNodeRuns: number;
  maxExternalCallsPerRun: number;
  maxSideEffectsPerRun: number;
}
```

### 5.5 MissionBudgetEnvelope

```ts
export interface MissionBudgetEnvelope {
  missionId: string;
  currency: "USD" | "CNY";

  maxCostUsd?: number;
  maxModelTokens?: number;
  maxContextTokens?: number;
  maxOutputTokens?: number;
  maxNodeRuns?: number;
  maxHarnessRuns?: number;
  maxToolCalls?: number;
  maxExternalCalls?: number;
  maxDurationMs?: number;
  maxConcurrentRuns?: number;

  warnAtRatio: number;
  hardStopAtRatio: number;
  resetPolicy: "none" | "daily" | "weekly" | "monthly";
  approvalRequiredAboveRatio: number;

  version: number;
}
```

---

## 6. Mission Lifecycle and Execution Side Effects

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> reviewing: submit_for_review
    reviewing --> active: approve
    reviewing --> draft: request_changes
    active --> paused: pause
    paused --> active: resume
    active --> completing: start_completion
    completing --> completed: complete
    active --> cancelled: cancel
    paused --> cancelled: cancel
    completed --> archived: archive
    cancelled --> archived: archive
```

### 6.1 Status Semantics

| Status | Can Accept New Task | Can Continue Running HarnessRun | Can Create LearningObject | Can Promote | Can Archive |
|---|---:|---:|---:|---:|---:|
| draft | no | no | no | no | no |
| reviewing | no | no | no | no | no |
| active | yes | yes | yes | restricted by policy | no |
| paused | no | drain only | yes | no | no |
| completing | no | drain only | yes | requires owner approval | no |
| completed | no | no | read only | restricted promotion | yes |
| cancelled | no | no | read only | no | yes |
| archived | no | no | no | no | archived |

### 6.2 Side Effects of Mission State Changes

| Transition | Must-Do Side Effects |
|---|---|
| draft → reviewing | generate MissionReviewRequest; freeze review snapshot |
| reviewing → active | emit `platform.mission.activated`; enable budget and member permissions |
| active → paused | block new Task; queued Task marked blocked; running HarnessRun enters drain/cancel strategy |
| paused → active | redo policy/budget/member live check; do not reuse old snapshot |
| active → completing | prohibit new Task; allow completing existing runs; lock new budget |
| completing → completed | generate FinalMissionReport; freeze MissionSummaryEvidenceBundle |
| active/paused → cancelled | cancel queued task; running run terminates according to recovery policy; release budget reservation |
| completed/cancelled → archived | move to read-only archive; retain audit, evidence, learning object references |

---

## 7. Relationship Between Mission and OAPEFLIR / Harness

```mermaid
flowchart LR
    Mission["Mission Context"] --> O["Observe"]
    O --> A["Assess"]
    A --> P["Plan"]
    P --> E["Execute"]
    E --> F["Feedback"]
    F --> L["Learn"]
    L --> I["Improve"]
    I --> R["Release"]
    F -->|quality gate fail| P
    I -->|needs replan| A
    R -->|new task / next cycle| O

    Mission -.constraints.-> A
    Mission -.budget.-> P
    Mission -.policy.-> E
    Mission -.learning boundary.-> L
    Mission -.rollout gate.-> R
```

### 7.1 Mission Constraints at Each Stage

| OAPEFLIR Stage | Mission Participation Point |
|---|---|
| Observe | use Mission knowledge boundary and session context to filter input |
| Assess | calculate risk, budget feasibility, domain eligibility, mission fit |
| Plan | PlanGraphBuilder can only select workflow/tool/domain allowed by Mission |
| Execute | live check before NodeRun: Mission active, budget not exhausted, permission not revoked |
| Feedback | feedback attributed according to Mission, enters mission-level evidence |
| Learn | LearningObject stays in Mission scope by default, does not auto-promote |
| Improve | ImprovementCandidate must carry missionId and evidenceRefs |
| Release | publish/rollout must satisfy Mission rollout policy and owner/domain gate |

### 7.2 HarnessRun Binding Rules

```ts
export interface HarnessRunMissionBinding {
  harnessRunId: string;
  missionId: string;
  missionSnapshotId: string;
  bindingReason: "explicit" | "session_default" | "resolver" | "ad_hoc" | "system";
  boundAt: string;
  boundBy: string;
}
```

Not allowed:

```text
HarnessRun.missionIds: string[]
NodeRun changes Mission by itself
NodeAttempt changes Mission by itself
```

Allowed:

```text
Parent Mission creates child Task, child Task binds another Mission.
Parent Mission and child Mission establish audit relationship through MissionHandoffRequest.
```

---

## 8. Cross-Mission Collaboration and Handoff

```mermaid
flowchart TD
    M1["Mission A\nPlatform Production Hardening"] --> T1["Parent Task"]
    T1 --> H["MissionHandoffRequest"]
    H --> Check["Policy + Owner Approval + Budget Transfer"]
    Check --> M2["Mission B\nSecurity Audit"]
    M2 --> T2["Child Task"]
    T2 --> PGB["PlanGraphBundle"]
    PGB --> HR["HarnessRun bound to Mission B Snapshot"]
    HR --> Result["Evidence + Result"]
    Result --> M1
```

### 8.1 MissionHandoffRequest

```ts
export interface MissionHandoffRequest {
  handoffId: string;
  sourceMissionId: string;
  targetMissionId: string;
  sourceTaskId: string;
  requestedBy: string;
  reason: string;
  requestedCapabilities: string[];
  requestedBudgetEnvelope?: Partial<MissionBudgetEnvelope>;
  dataBoundaryRefs: string[];
  requiredApprovals: ApprovalRequirement[];
  status: "requested" | "approved" | "rejected" | "expired" | "completed";
  createdAt: string;
  expiresAt: string;
}
```

### 8.2 Implicit Behaviors Prohibited Across Missions

| Prohibited Behavior | Reason |
|---|---|
| One Task binds multiple Missions simultaneously | budget, approval, evidence attribution chaos |
| One HarnessRun switches Mission during execution | audit cannot be reproduced |
| ToolCall crosses Mission knowledge boundary by itself | data boundary violation |
| LearningObject auto-promotes from Mission to Platform | knowledge pollution risk |
| Proactive Agent executes automatically without Mission | no owner, no budget, no responsibility attribution |

---

## 9. Mission and Budget / Cost / Reservation

### 9.1 Layered Budget

```mermaid
flowchart TB
    TenantBudget["Tenant Budget"] --> MissionBudget["Mission Budget"]
    MissionBudget --> TaskBudget["Task Budget"]
    TaskBudget --> HarnessRunBudget["HarnessRun Budget"]
    HarnessRunBudget --> NodeRunBudget["NodeRun Budget"]
    NodeRunBudget --> ModelReservation["Model Token Reservation"]
    NodeRunBudget --> ToolReservation["Tool / External Call Reservation"]
    NodeRunBudget --> SideEffectReservation["SideEffect Commit Reservation"]
```

### 9.2 Budget Execution Order

Before each model/tool/external call must:

```text
1. live Mission status check
2. permission check
3. policy check
4. risk check
5. budget reserve
6. execute model/tool
7. settle actual cost
8. emit cost event
9. release unused reservation
```

### 9.3 BudgetReservation Key Fields

```ts
export interface BudgetReservation {
  reservationId: string;
  tenantId: string;
  missionId: string;
  taskId: string;
  harnessRunId: string;
  nodeRunId?: string;
  nodeAttemptId?: string;
  kind: "model" | "tool" | "external_call" | "side_effect" | "human_review";
  reservedCostUsd?: number;
  reservedTokens?: number;
  reservedDurationMs?: number;
  status: "reserved" | "settled" | "released" | "expired" | "cancelled";
  expectedVersion: number;
  fencingToken: string;
  expiresAt: string;
  createdAt: string;
}
```

---

## 10. Mission and IAM / Policy / Risk

### 10.1 Permission Calculation Diagram

```mermaid
flowchart LR
    Principal["Principal"] --> IAM["IAM Role Capabilities"]
    MissionRole["Mission Membership Role"] --> Intersect["Capability Intersection"]
    MissionPolicy["Mission Policy"] --> Intersect
    DomainPolicy["Domain Policy"] --> Intersect
    RiskPolicy["Risk Policy"] --> Intersect
    RuntimeConstraint["RuntimeConstraintSet"] --> Intersect
    Intersect --> Decision["Allow / Deny / Require Approval / Degrade"]
```

### 10.2 Mission Role Permission Matrix

| Action | viewer | contributor | operator | approver | owner | auditor |
|---|---:|---:|---:|---:|---:|---:|
| View Mission | yes | yes | yes | yes | yes | yes |
| Create low-risk Task | no | yes | yes | no | yes | no |
| Start HarnessRun | no | restricted | yes | no | yes | no |
| Approve high-risk operation | no | no | no | yes | yes | no |
| Modify Mission Policy | no | no | no | no | yes | no |
| View audit chain | restricted | restricted | restricted | yes | yes | yes |
| Archive Mission | no | no | no | no | yes | no |

### 10.3 Risk Gating

| Risk Level | Mission Default Behavior |
|---|---|
| low | can automatically execute according to RuntimeConstraintSet |
| medium | default suggestion or semi_auto + approval |
| high | must HITL approval, automatic side-effect commit not allowed |
| critical | only proposal, automatic execution not allowed; requires owner + domain owner + platform policy gate |

---

## 11. Mission and Knowledge / Memory / Learning

### 11.1 Mission Knowledge Boundary

Mission can limit knowledge retrieval scope:

```ts
export interface MissionKnowledgeBoundary {
  boundaryId: string;
  missionId: string;
  allowedKnowledgeScopes: string[];
  deniedKnowledgeScopes: string[];
  trustLevelFloor: "private_unverified" | "team_reviewed" | "official" | "authoritative";
  allowContestedKnowledge: boolean;
  dataClassCeiling: "public" | "internal" | "confidential" | "restricted";
}
```

### 11.2 LearningObject Stays in Mission by Default

```text
NodeAttempt evidence
  -> FeedbackSignal
  -> LearningObject(scope=mission)
  -> quarantine / validation
  -> optional promotion to domain/platform
```

### 11.3 Learning Promotion Gating

| Promotion Path | Requirement |
|---|---|
| Mission → Mission official | Mission owner approval + evidence threshold |
| Mission → Domain | Domain owner approval + no taint + regression eval |
| Domain → Platform | Platform team approval + cross-domain eval + rollout gate |

Prohibited:

```text
Single successful NodeAttempt auto-promotes to Platform knowledge.
Polluted data within Mission enters global prompt/policy/knowledge.
```

---

## 12. Mission and Event / Truth / Evidence

### 12.1 Mission Event Naming

Recommended canonical events:

```text
platform.mission.created
platform.mission.review_requested
platform.mission.activated
platform.mission.paused
platform.mission.resumed
platform.mission.completing
platform.mission.completed
platform.mission.cancelled
platform.mission.archived
platform.mission.member_added
platform.mission.member_revoked
platform.mission.policy_changed
platform.mission.budget_reserved
platform.mission.budget_settled
platform.mission.snapshot_created
platform.mission.handoff_requested
platform.mission.handoff_completed
```

### 12.2 EventEnvelope Required Fields

```ts
export interface PlatformFactEvent<TPayload> {
  eventId: string;
  eventType: string;
  tenantId: string;
  aggregateType: "mission" | "task" | "harness_run" | "node_run" | "side_effect";
  aggregateId: string;
  sequence: number;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  schemaVersion: string;
  payloadHash: string;
  payload: TPayload;
  emittedAt: string;
  emittedBy: string;
}
```

### 12.3 Truth and Projection

| Layer | What Is Stored | Authoritative |
|---|---|---:|
| Truth Store | append-only Mission/Task/Run fact events | yes |
| Projection | Mission dashboard, Task list, budget summary | no |
| Evidence Bundle | audit evidence, references, hash chain, signature | yes, as evidence |
| Cache | UI query cache, temporary state | no |

---

## 13. UI Product Form

### 13.1 Mission Console

Must provide:

| Area | Content |
|---|---|
| Mission Overview | goal, owner, status, risk, budget, water level |
| Task Board | all Task statuses under this Mission |
| Run Timeline | HarnessRun / NodeRun / NodeAttempt timeline |
| Budget Panel | cost/token/tool/external-call/duration/concurrency |
| Evidence Panel | evidence refs, audit chain, final report |
| Knowledge Panel | Mission memory, LearningObject, promotion requests |
| Approval Panel | pending HITL / approval requests |
| Incident Panel | blocked, degraded, panic, policy violation |
| Settings | membership, policy, runtime constraints, data boundary |

### 13.2 What UI Cannot Do

| Prohibited | Reason |
|---|---|
| Frontend directly determines Mission permissions | must be determined by backend IAM/Policy |
| Recent Mission auto-used for high-risk write operations | over-authorization and misoperation risk |
| localStorage stores Mission token/secret | XSS leakage |
| UI local simulate execute | bypass P1→P2→P3→P4 chain |
| MissionId as all frontend metrics label | high cardinality risk |

---

## 14. Observability Design

### 14.1 Trace / Log / Event

Trace and log should carry:

```text
tenantId
missionId
missionSnapshotId
taskId
harnessRunId
nodeRunId
nodeAttemptId
correlationId
causationId
riskLevel
runtimeConstraintHash
```

### 14.2 Metrics Label Restrictions

Allowed as metrics labels:

```text
mission_kind
domain
risk_level
tenant_tier
runtime_mode_preset
status
```

Default prohibited as metrics labels:

```text
missionId
taskId
harnessRunId
nodeRunId
userId
promptBundleId
```

These can only appear in exemplars, trace, logs or sampled diagnostic events.

---

## 15. Multi-Region / Tenant / Federation Considerations

### 15.1 Mission home region

```ts
export interface MissionRegionPolicy {
  missionId: string;
  homeRegion: string;
  allowedReadRegions: string[];
  allowedExecutionRegions: string[];
  dataResidency: string;
  readAfterWriteConsistency: "strong" | "bounded_staleness" | "eventual";
  failoverPolicyRef: string;
}
```

### 15.2 Multi-Region Principles

| Rule | Description |
|---|---|
| Mission truth home region is unique | prevent split-brain |
| Projection can be replicated across regions | read-only/near real-time display |
| Budget reservation atomized in home region | prevent over-spend |
| Failover must generate new fencing epoch | prevent stale leader writes |
| MissionSnapshot needs region/epoch | ensure audit and recovery |

### 15.3 Federation

Cross-organization Mission collaboration cannot share raw data, must go through:

```text
FederatedMissionLink
+ DataSharingPolicy
+ CapabilityDelegation
+ EvidenceRedactionPolicy
+ CrossOrgAuditTrail
```

---

## 16. Migration Plan

### Phase 0: Contract Freeze First

Must complete first:

1. Confirm unique RequestEnvelope definition.
2. Confirm PlanGraphBundle is the unique execution plan contract.
3. Confirm HarnessRun / NodeRun / NodeAttempt are the unique runtime objects.
4. Deprecate legacy ExecutionPlan / WorkflowState / ControlDirective as first-class contracts.

### Phase 1: Introduce Mission Tables and Events, Without Changing Execution Path

Add:

```text
mission_records
mission_memberships
mission_context_snapshots
mission_budget_envelopes
mission_events
mission_projections
```

All old Tasks auto-bind:

```text
system.ad_hoc.default_mission
```

### Phase 2: MissionResolver Integrates into Intake

```text
ConfirmedTaskSpec -> MissionResolver -> RequestEnvelope.missionRef
```

Low-risk tasks can automatically bind AdHocMission; high-risk must be explicitly confirmed.

### Phase 3: HarnessRun Binds MissionSnapshot

When HarnessRun is created, must have:

```text
missionId
missionSnapshotId
effectiveRuntimeConstraints
budgetEnvelopeRef
```

### Phase 4: NodeRun Live Guard

Check before each NodeRun:

```text
Mission active?
Membership still valid?
Budget still available?
Runtime constraints still allow?
Incident/Panic state?
```

### Phase 5: UI Mission Console + Observability

Launch Mission Console, Mission Task Board, Budget Panel, Evidence Panel, Learning Panel.

### Phase 6: Learning / Knowledge Promotion

Finally integrate Mission-scoped learning, to avoid early pollution of platform-level knowledge.

---

## 17. Regression Testing and Acceptance Criteria

### 17.1 Must-Add Tests

| Test | Acceptance Point |
|---|---|
| MissionResolver E2E | explicit missionId, session default, ad hoc, reject choice all correct |
| High-risk Task Mission confirmation | high-risk cannot silently bind recent mission |
| HarnessRun single mission invariant | one run cannot have multiple missions |
| Mission paused side effect | after paused, do not accept new task, running run handled according to drain strategy |
| Budget reservation | must reserve before NodeRun, settle failure cannot silently pass |
| Live revocation | after member revoked, subsequent NodeRun blocked |
| Snapshot reproducibility | replay same snapshot gets same policy view |
| Cross-mission handoff | must have approval/audit/budget transfer |
| Learning quarantine | Mission learning does not auto-promote to Domain/Platform |
| Metrics high-cardinality guard | missionId does not enter default metric labels |
| Multi-region fencing | after failover, old epoch writes rejected |
| UI no local execute | UI action must go through API / Control Plane |

### 17.2 Test Patterns That Must Not Pass

From existing audits, the following invalid tests must be prohibited:

```text
assert.ok(true) in catch
allowed === true || allowed === false
keys.length >= 0
Only test mock shape, do not import production service
E2E bypasses HarnessRun / PlanGraphBundle / RSM
```

---

## 18. Points That Still Need to Be Supplemented

### 18.1 Relationship Between Mission and Agent Team

Agent Team is the execution collaboration structure, not the governance boundary. Mission can define which Agent/AgentTeam are allowed to participate, but AgentTeam cannot replace Mission.

```text
Mission owns governance.
AgentTeam owns collaboration topology.
PlanGraph owns execution topology.
```

### 18.2 Relationship Between Mission and Domain

Domain is the capability/policy template, Mission is the goal instance.

Example:

```text
Domain = coding / legal / ops / quant
Mission = Automatic Agent Platform Production Hardening
```

One Mission can use multiple Domains; one Domain can serve multiple Missions.

### 18.3 Relationship Between Mission and WorkflowTemplate

WorkflowTemplate is a reusable process; Mission can restrict which workflows are allowed, but workflow does not own Mission.

### 18.4 Relationship Between Mission and Release / Rollout

Mission can initiate rollout, but rollout must still go through release gate:

```text
Mission owner approval
+ Domain owner approval
+ Eval pass
+ Regression guard
+ Rollback plan
+ Budget / risk / incident check
```

### 18.5 Relationship Between Mission and Proactive Agent

Proactive Agent must bind Mission to act.

```text
No Mission -> suggestion only
Mission active + low risk -> may auto propose
Mission active + allowed constraints + approval -> may execute
medium/high/critical -> never silent auto execute
```

### 18.6 Relationship Between Mission and Incident/Panic

Incident and Panic can create SystemMission:

```text
incident.mission.<incidentId>
panic.mission.<scopeId>
recovery.mission.<runId>
```

Used for centralized recovery actions, budget, audit and runbook evidence.

---

## 19. Final Recommended Directory Structure

```text
src/platform/five-plane-control-plane/mission/
  mission-record.ts
  mission-membership.ts
  mission-policy.ts
  mission-budget-envelope.ts
  mission-context-snapshot.ts
  mission-resolver.ts
  mission-governance-service.ts
  mission-lifecycle-service.ts
  mission-permission-service.ts
  mission-budget-service.ts
  mission-handoff-service.ts
  mission-events.ts
  mission-errors.ts

src/platform/five-plane-state-evidence/events/projections/mission/
  mission-dashboard-projection.ts
  mission-task-board-projection.ts
  mission-budget-projection.ts
  mission-evidence-projection.ts

src/platform/five-plane-orchestration/mission/
  mission-aware-plan-validator.ts
  mission-oapeflir-guard.ts
  mission-learning-gate.ts

src/platform/five-plane-execution/mission/
  mission-runtime-guard.ts
  mission-budget-reservation-adapter.ts
  mission-live-revocation-checker.ts

ui/packages/features/mission-console/
  src/hooks/
  src/web/
  src/mobile/
```

---

## 20. Final Implementation Principles

### 20.1 Should Do

1. Make Mission the **goal governance root object**.
2. All executable Tasks bind MissionContext before dispatch.
3. HarnessRun is fixed-bound to MissionSnapshot.
4. Do live guard before NodeRun.
5. Budget / IAM / Risk / Policy uniformly do constraint intersection.
6. Learning stays in Mission scope by default.
7. All Mission state changes are event-ized.
8. UI only displays and submits requests, does not execute locally.
9. Observability carries Mission context, but metrics control high cardinality.
10. When migrating, first be compatible with legacy, then gradually enforce missionRef.

### 20.2 Should Not Do

1. Do not add `steps[] / currentStep / currentNode / toolCalls` to Mission; Mission progress can only come from Task/HarnessRun/NodeRun/NodeAttempt projection.
2. Do not let a HarnessRun bind multiple Missions simultaneously.
3. Do not use RuntimeMode enum ordering for permission judgment.
4. Do not let UI mission hint become authorization basis.
5. Do not auto-promote Mission memory to platform knowledge.
6. Do not add a fourth set of RequestEnvelope / ExecutionPlan / WorkflowState.
7. Do not let Proactive Agent execute automatically without Mission.
8. Do not put missionId into all metrics labels.

---

## 21. Final Judgment

Mission should be incorporated into the Automatic Agent Platform as the core governance object. After incorporation, the system upgrades from a "single Agent Session / single Task execution platform" to a "long-term goal-driven Agent ecosystem".

But the implementation of Mission must strictly follow three bottom lines:

```text
1. Mission governs, PlanGraph executes.
2. Mission snapshots for reproducibility, live checks for safety.
3. Mission extends canonical contracts, never forks them.
```

This way the system can gain:

| Capability | Improvement |
|---|---|
| Long-term goal management | multiple Tasks, multiple Agents, multiple Workflows belong to the same goal |
| Governance consistency | budget, permission, knowledge, approval, learning unified boundary |
| Automation safety | high-risk tasks will not detach from Mission owner and Mission policy |
| Observability | all runs, nodes, events, evidence can be aggregated by Mission |
| Learning closed loop | Mission experience can accumulate, but will not pollute platform knowledge |
| Product experience | users see goal progress, not scattered task/run/session |

**Final Recommendation: Can enter design freeze and implementation phase, but the implementation order must be Contract Freeze → Mission Truth/Event → Resolver → Harness Binding → Runtime Guard → UI Console → Learning Promotion.**

---

## 40. Implementation Status and Evidence Supplement Record

> Update Time: 2026-05-21. The following status only adds implementation evidence, does not delete the original contract of this document. Mission still maintains its "long-term goal and governance context root object" positioning; the execution surface continues to use `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt` as the canonical runtime.

| Task | Status | Implementation Evidence | Test Evidence |
|---|---|---|---|
| T-MIS-001 Mission schemas/types | ✅ Implemented | `src/platform/contracts/mission/index.ts`; exported in `src/platform/contracts/index.ts` | `tests/unit/platform/contracts/mission-contracts.test.ts` |
| T-MIS-002 Mission truth tables/repository | ✅ Implemented | `src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts`; `src/platform/five-plane-state-evidence/truth/mission-repository.ts` | `tests/unit/platform/control-plane/mission-services.test.ts` |
| T-MIS-003 `platform.mission.*` event schemas | ✅ Implemented | `MissionEventTypeSchema`, `MissionEventEnvelopeSchema`, repository sequence allocator | `mission-contracts.test.ts`, `mission-services.test.ts` |
| T-MIS-004 MissionLifecycleService + CAS | ✅ Implemented | `src/platform/five-plane-control-plane/mission/index.ts` | `mission-services.test.ts` |
| T-MIS-005 MissionResolver + Governance | ✅ Implemented | `MissionResolver`, `MissionGovernanceService` | `mission-services.test.ts` |
| T-MIS-006 Mission API + ErrorEnvelope | ✅ Implemented | `src/platform/five-plane-interface/api/http-server/mission-routes.ts`; OpenAPI route list; covers create/list/read/patch, status transition, members, tasks/runs/evidence/budget, dry-run resolution | `tests/integration/platform/interface/api/mission-routes.test.ts`, `tests/integration/platform/contracts/api-openapi-contract.test.ts` |
| T-MIS-007 PlanGraphBundle missionSnapshotRef | ✅ Implemented | `PlanGraphBundle` contract/schema/factory extension; `MissionRuntimeBindingService`; `POST /v1/tasks` integrates Mission resolution/snapshot binding | `mission-services.test.ts`, `mission-task-binding.test.ts` |
| T-MIS-008 HarnessRun missionBinding | ✅ Implemented | `HarnessRun` contract/schema/factory extension; single-binding guard | `mission-services.test.ts` |
| T-MIS-009 NodeRun MissionLiveGuard | ✅ Implemented | `MissionLiveGuard` and `NodeRun.missionSnapshotRef` | `mission-services.test.ts` |
| T-MIS-010 canonical Mission E2E baseline | ✅ Implemented | API create/activate + task create mission binding + Mission snapshot + freeze live guard + high-risk missionless reject | `tests/e2e/mission-canonical-flow.test.ts`, `mission-routes.test.ts`, `mission-task-binding.test.ts` |
| T-MIS-011 Mission Console data baseline | ✅ Implemented | Mission API exposes Overview / Members / Tasks / Runs / Budget / Evidence; UI adds Mission Console feature, Mission DTO→VM→View wiring and web/mobile seam | `mission-routes.test.ts`; `npm run typecheck` covers `ui/packages/features/mission-console/` |
| T-MIS-012 Trace/log correlation + metrics cardinality guard | ✅ Implemented | `MissionObservabilityPolicy` allows trace attributes and strips Mission IDs from metric labels | `mission-services.test.ts` |
| T-MIS-013 Mission scoped LearningObject promotion gate | ✅ Implemented | `MissionLearningPromotionGate` keeps default learning local and requires approval/evidence for promotion | `mission-services.test.ts` |
| T-MIS-014 legacy Task/Session missionRef backfill | ✅ Implemented | `LegacyMissionBackfillService.backfillTask/backfillSession/backfillBatch`, including unresolved report | `mission-services.test.ts` |
| T-MIS-015 ADR/superseded marker | ✅ Written back to this document state | This section as v1.4 implementation evidence index | Document consistency verified by this round of targeted tests and build |
| T-MIS-016 Mission handoff | ✅ Implemented | `MissionHandoffService.requestFederated()` provides cross-tenant trust-pair guard, approval/audit handoff request | `mission-services.test.ts` |
| T-MIS-017 home region/fencing | ✅ Implemented | `MissionHomeRegionService` epoch guard, read replica registration and strong/eventual read routing | `mission-services.test.ts` |
| T-MIS-018 outcome analytics | ✅ Implemented as in-repo baseline | `MissionOutcomeAnalyticsService` | `mission-services.test.ts` |
| T-MIS-019 template/package integration | ✅ Implemented as in-repo baseline | `MissionTemplateIntegrationService` | `mission-services.test.ts` |

### 40.1 Residual Risk

The following content belongs to external deployment or cross-system wiring evolution items, not faked as a single-repo code closed loop: real multi-region database replication, external cross-enterprise federation trust provisioning, real UI publishing and permission operation processes. The current repository has provided testable contracts, Mission Console UI/API seams, federated handoff trust-pair guards, home-region read routing, API routes and runtime binding guards, and subsequent external system integration must reuse these public interfaces.

### 40.2 This Round of Verification

| Verification Item | Result |
|---|---|
| Mission E2E + contract/unit/integration/invariant tests | ✅ `node --import tsx --test tests/e2e/mission-canonical-flow.test.ts tests/integration/platform/interface/api/mission-routes.test.ts tests/integration/platform/interface/api/mission-task-binding.test.ts tests/unit/platform/contracts/mission-contracts.test.ts tests/unit/platform/control-plane/mission-services.test.ts tests/invariants/mission-step-governance.test.ts tests/integration/platform/contracts/api-openapi-contract.test.ts` |
| TypeScript build test | ✅ `npm run build:test` |
| OpenAPI contract targeted test | ✅ `node --import tsx --test tests/integration/platform/contracts/api-openapi-contract.test.ts` |


---

# Part II — v1.3 Implementation Contract Reinforcement

> This part is the new content added in v1.3 compared to v1.2. The goal is not to redefine the Mission architecture, but to solidify Mission from an "architectural concept" into a codable, testable, migratable, auditable implementation contract.

## 22. v1.3 Change Summary

| Change Domain | v1.2 Status | v1.3 Reinforcement |
|---|---|---|
| Canonical Types | Object boundary defined | Complete TypeScript/Zod schema, ID rules, field requiredness |
| State Machine | Status semantics given | Complete legal transition table, guard, side effects |
| Event Contract | Event naming listed | Complete PlatformFactEvent envelope, payload schema, sequence rules |
| API Contract | Only design description | Complete REST API, header, error codes, idempotency rules, ETag/If-Match |
| Storage | Only directory suggestions | Complete Mission truth tables, membership, snapshot, event sequence tables |
| Runtime Binding | HarnessRun binding clarified | Complete strict flow of Task→MissionContextSnapshot→HarnessRun→NodeRun |
| Migration | Phases listed | Complete data backfill, compatibility flag, acceptance gate, rollback strategy |
| Tests | Test directions listed | Complete contract/unit/integration/e2e/chaos/golden level test matrix |

v1.3's freeze goal:

```text
The addition of Mission only extends the canonical runtime graph, does not introduce new execution paths, does not revive legacy WorkflowState, does not generate a fourth set of core objects.
```

---

## 23. Naming and Encoding Specification Freeze

### 23.1 TypeScript and JSON Field Naming

System internal TypeScript/Zod/JSON API uses **lowerCamelCase**:

```ts
tenantId
missionId
traceId
idempotencyKey
createdAt
updatedAt
```

Database fields use **snake_case**:

```sql
tenant_id
mission_id
trace_id
idempotency_key
created_at
updated_at
```

Mixing snake_case and camelCase within the same runtime contract is prohibited. Cross-language export must explicitly convert through a mapper.

### 23.2 ID Rules

| ID | Format | Example | Description |
|---|---|---|---|
| MissionId | `mis_[a-zA-Z0-9_-]{16,64}` | `mis_product_launch_2026` | human-readable but cannot contain `/`, `.`, spaces |
| MissionSnapshotId | `msnap_[a-zA-Z0-9_-]{16,80}` | `msnap_01H...` | generated before each HarnessRun binding |
| MissionEventId | `evt_[a-zA-Z0-9_-]{16,80}` | `evt_01H...` | globally unique |
| MembershipId | `mmbr_[a-zA-Z0-9_-]{16,80}` | `mmbr_01H...` | principal and mission binding |
| MissionHandoffId | `mho_[a-zA-Z0-9_-]{16,80}` | `mho_01H...` | cross-Mission handoff |

Prohibited to use `Date.now()+Math.random()` to generate IDs. Recommended ULID/UUIDv7 or platform unified `IdGenerator`.

### 23.3 Time Rules

All contract time fields use UTC ISO-8601 strings:

```ts
2026-05-13T02:40:00.000Z
```

Must parse to epoch milliseconds before comparing time, prohibited to directly compare ISO strings.

---

## 24. Mission Canonical Object Schema

### 24.1 MissionRecord

```ts
import { z } from "zod";

export const MissionIdSchema = z.string().regex(/^mis_[a-zA-Z0-9_-]{16,64}$/);
export const MissionSnapshotIdSchema = z.string().regex(/^msnap_[a-zA-Z0-9_-]{16,80}$/);
export const TenantIdSchema = z.string().min(1).max(128);
export const OrgIdSchema = z.string().min(1).max(128);
export const PrincipalIdSchema = z.string().min(1).max(128);

export const MissionTypeSchema = z.enum([
  "ad_hoc",
  "user_goal",
  "domain_program",
  "team_program",
  "system_incident",
  "system_recovery",
  "evaluation_campaign",
  "release_campaign"
]);

export const MissionStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "frozen",
  "completed",
  "archived"
]);

export const MissionPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "critical"
]);

export const MissionRecordSchema = z.object({
  missionId: MissionIdSchema,
  tenantId: TenantIdSchema,
  orgId: OrgIdSchema.optional(),
  type: MissionTypeSchema,
  status: MissionStatusSchema,
  priority: MissionPrioritySchema.default("normal"),

  title: z.string().min(1).max(256),
  description: z.string().max(8000).optional(),
  objective: z.string().min(1).max(8000),
  successCriteria: z.array(z.object({
    criterionId: z.string().min(1).max(128),
    description: z.string().min(1).max(2000),
    operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains", "manual_review"]),
    targetValue: z.unknown().optional(),
    weight: z.number().min(0).max(1).default(1),
    required: z.boolean().default(true)
  })).min(1),

  ownerPrincipalId: PrincipalIdSchema,
  accountablePrincipalId: PrincipalIdSchema.optional(),
  domainId: z.string().min(1).max(128).optional(),

  policyRefs: z.array(z.string().min(1).max(256)).default([]),
  riskProfileRef: z.string().min(1).max(256).optional(),
  budgetEnvelopeRef: z.string().min(1).max(256).optional(),
  knowledgeBoundaryRef: z.string().min(1).max(256).optional(),
  defaultWorkflowTemplateRefs: z.array(z.string().min(1).max(256)).default([]),

  createdAt: z.string().datetime(),
  createdBy: PrincipalIdSchema,
  updatedAt: z.string().datetime(),
  updatedBy: PrincipalIdSchema,
  version: z.number().int().nonnegative(),
  etag: z.string().min(1),

  archivedAt: z.string().datetime().optional(),
  archivedBy: PrincipalIdSchema.optional(),
  freezeReason: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict();

export type MissionRecord = z.infer<typeof MissionRecordSchema>;
```

#### Field Constraints

| Field | Constraint |
|---|---|
| `status` | Can only be changed by Mission RSM, cannot be directly patched |
| `version` | Must +1 for each truth mutation |
| `etag` | Generated from `missionId + version + payloadHash` |
| `metadata` | Not allowed to store token, secret, PII in plain text |
| `successCriteria` | At least 1; otherwise Mission cannot be active |

### 24.2 MissionMembership

```ts
export const PrincipalTypeSchema = z.enum([
  "user",
  "agent",
  "service",
  "worker",
  "plugin",
  "system"
]);

export const MissionRoleSchema = z.enum([
  "owner",
  "admin",
  "operator",
  "contributor",
  "viewer",
  "auditor",
  "service_agent"
]);

export const MissionPermissionSchema = z.enum([
  "mission:read",
  "mission:update",
  "mission:archive",
  "mission:manage_members",
  "mission:create_task",
  "mission:dispatch_task",
  "mission:approve_high_risk",
  "mission:manage_budget",
  "mission:view_budget",
  "mission:view_evidence",
  "mission:promote_learning",
  "mission:handoff"
]);

export const MissionMembershipSchema = z.object({
  membershipId: z.string().regex(/^mmbr_[a-zA-Z0-9_-]{16,80}$/),
  missionId: MissionIdSchema,
  tenantId: TenantIdSchema,
  principal: z.object({
    principalType: PrincipalTypeSchema,
    principalId: PrincipalIdSchema
  }).strict(),
  role: MissionRoleSchema,
  permissions: z.array(MissionPermissionSchema).default([]),
  deniedPermissions: z.array(MissionPermissionSchema).default([]),
  grantedBy: PrincipalIdSchema,
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  status: z.enum(["active", "suspended", "revoked", "expired"]),
  version: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict();
```

Permission calculation rules:

```text
effectivePermissions =
  rolePermissions(role)
  ∩ missionPolicy.allowedPermissions
  ∩ principalCurrentPermissions
  - deniedPermissions
  - missionPolicy.deniedPermissions
```

Prohibited to directly use caller-provided `permissions` or `capabilities` as effective permissions. All permissions must be obtained from the intersection of IAM, MissionMembership, PolicyDecision.

### 24.3 RuntimeConstraintSet

Mission does not directly use `RuntimeMode` enum ordering, but normalizes runtime mode, risk, policy, domain, budget into constraint sets.

```ts
export const RuntimeConstraintSetSchema = z.object({
  allowModelCall: z.boolean(),
  allowToolCall: z.boolean(),
  allowExternalNetwork: z.boolean(),
  allowFileWrite: z.boolean(),
  allowDestructiveAction: z.boolean(),
  allowSideEffectCommit: z.boolean(),
  allowAutoExecute: z.boolean(),
  requireHITL: z.boolean(),
  requireDomainOwnerApproval: z.boolean(),
  requireBudgetReservation: z.boolean(),
  requireEvidenceRefs: z.boolean(),
  sandboxProfileRef: z.string().min(1).optional(),
  maxDelegationDepth: z.number().int().min(0).max(8),
  maxParallelNodeRuns: z.number().int().min(1).max(1024),
  deniedToolNames: z.array(z.string()).default([]),
  deniedDomains: z.array(z.string()).default([]),
  dataResidency: z.array(z.string()).default([]),
  modelTrainingOptOut: z.boolean().default(true)
}).strict();
```

Constraint merging rules:

```text
boolean allow type fields: AND
boolean require type fields: OR
max type fields: MIN
denied type fields: UNION
allowed list type fields: INTERSECTION
```

### 24.4 MissionBudgetEnvelope

```ts
export const OapeflirStageSchema = z.enum([
  "observe",
  "assess",
  "plan",
  "execute",
  "feedback",
  "learn",
  "improve",
  "release"
]);

export const BudgetLimitSchema = z.object({
  maxCostUsd: z.number().nonnegative().optional(),
  maxModelTokens: z.number().int().nonnegative().optional(),
  maxContextTokens: z.number().int().nonnegative().optional(),
  maxOutputTokens: z.number().int().nonnegative().optional(),
  maxToolCalls: z.number().int().nonnegative().optional(),
  maxNodeRuns: z.number().int().nonnegative().optional(),
  maxDurationMs: z.number().int().nonnegative().optional(),
  maxWallClockMs: z.number().int().nonnegative().optional()
}).strict();

export const MissionBudgetEnvelopeSchema = z.object({
  budgetEnvelopeId: z.string().min(1).max(128),
  missionId: MissionIdSchema,
  tenantId: TenantIdSchema,
  limits: BudgetLimitSchema,
  warnAtRatio: z.number().min(0).max(1).default(0.8),
  hardStopAtRatio: z.number().min(0).max(1).default(1.0),
  stageBudgets: z.record(OapeflirStageSchema, BudgetLimitSchema.partial()).default({}),
  resetPolicy: z.enum(["none", "daily", "weekly", "monthly", "mission_lifetime"]).default("mission_lifetime"),
  currency: z.literal("USD").default("USD"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().nonnegative()
}).strict();
```

Budget invariants:

| Invariant | Description |
|---|---|
| INV-BUDGET-MISSION-001 | LLM/tool/side-effect execution must have BudgetReservation beforehand. |
| INV-BUDGET-MISSION-002 | reserve / settle / release must be CAS + transaction. |
| INV-BUDGET-MISSION-003 | Mission budget does not replace tenant/domain budget, must do hierarchical deduction. |
| INV-BUDGET-MISSION-004 | `maxCostUsd` must not be the only limit, token/node/tool/duration must be independently configurable. |

### 24.5 MissionContextSnapshot

MissionSnapshot is the key to audit reproducibility. HarnessRun binds to snapshot, not live MissionRecord.

```ts
export const MissionContextSnapshotSchema = z.object({
  missionSnapshotId: MissionSnapshotIdSchema,
  missionId: MissionIdSchema,
  missionVersion: z.number().int().nonnegative(),
  tenantId: TenantIdSchema,
  orgId: OrgIdSchema.optional(),
  taskId: z.string().min(1).max(128),
  confirmedTaskSpecId: z.string().min(1).max(128),

  missionStatusAtSnapshot: MissionStatusSchema,
  objective: z.string().min(1).max(8000),
  successCriteria: MissionRecordSchema.shape.successCriteria,

  effectivePermissions: z.array(MissionPermissionSchema),
  runtimeConstraints: RuntimeConstraintSetSchema,
  budgetEnvelope: MissionBudgetEnvelopeSchema.optional(),
  policyDecisionRefs: z.array(z.string()).default([]),
  riskDecisionRef: z.string().optional(),
  knowledgeBoundaryRef: z.string().optional(),

  createdAt: z.string().datetime(),
  createdBy: PrincipalIdSchema,
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z.string().optional()
}).strict();
```

Snapshot rules:

```text
1. Generate MissionContextSnapshot before Task dispatch.
2. HarnessRun can only reference one MissionContextSnapshot.
3. Snapshot does not change with subsequent Mission changes.
4. Before NodeRun execution, live guard check is still needed to check whether Mission is frozen/archived, whether permission is revoked, whether budget is exhausted.
```

---

## 25. Mission State Machine

### 25.1 Status Definition

| Status | Meaning | Executable Task | Can Create Task | Can Update Configuration | Can Learn/Promote |
|---|---|---:|---:|---:|---:|
| draft | draft, not yet passed activation gate | no | no | yes | no |
| active | running normally | yes | yes | yes | yes |
| paused | pause new execution, can resume | no, new dispatch prohibited; running handled by drain strategy | can create but not dispatch | yes | no |
| frozen | safety freeze, usually triggered by incident/panic | no, must stop/drain | no | only allow owner/admin unfreeze related operations | no |
| completed | goal completed, read-only accumulation | no | no | no | readable, cannot add new |
| archived | archived, read-only | no | no | no | no |

### 25.2 Legal Transition Table

| From | To | Trigger Command | Must Guard | Event |
|---|---|---|---|---|
| draft | active | ActivateMission | owner/admin + successCriteria + budget/policy valid | `platform.mission.activated` |
| active | paused | PauseMission | owner/admin or policy | `platform.mission.paused` |
| paused | active | ResumeMission | owner/admin + policy still valid | `platform.mission.resumed` |
| active | frozen | FreezeMission | security/panic/owner/admin | `platform.mission.frozen` |
| paused | frozen | FreezeMission | security/panic/owner/admin | `platform.mission.frozen` |
| frozen | paused | UnfreezeMission | owner/admin + incident resolved + approval | `platform.mission.unfrozen` |
| active | completed | CompleteMission | success criteria satisfied or manual approval | `platform.mission.completed` |
| paused | completed | CompleteMission | manual approval | `platform.mission.completed` |
| completed | archived | ArchiveMission | retention guard | `platform.mission.archived` |
| paused | archived | ArchiveMission | no active runs + retention guard | `platform.mission.archived` |
| frozen | archived | ArchiveMission | incident closure + no active runs | `platform.mission.archived` |

Prohibited transitions:

```text
completed -> active
archived -> any
frozen -> active
active -> archived when active HarnessRun exists
```

### 25.3 State Transition Command

```ts
export const MissionTransitionCommandSchema = z.object({
  commandId: z.string().min(1),
  missionId: MissionIdSchema,
  tenantId: TenantIdSchema,
  expectedVersion: z.number().int().nonnegative(),
  fromStatus: MissionStatusSchema,
  toStatus: MissionStatusSchema,
  principal: z.object({
    principalType: PrincipalTypeSchema,
    principalId: PrincipalIdSchema
  }),
  reasonCode: z.string().min(1).max(128),
  reason: z.string().max(2000).optional(),
  approvalRefs: z.array(z.string()).default([]),
  auditRef: z.string().min(1),
  traceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime()
}).strict();
```

Mission state transitions must:

```text
CAS(expectedVersion)
+ append PlatformFactEvent
+ update truth table
+ emit projection event
+ write audit evidence
```

Prohibited to directly `UPDATE missions SET status = ...`.

---

## 26. Mission Event Contract

### 26.1 PlatformFactEvent Envelope

```ts
export const PlatformFactEventEnvelopeSchema = z.object({
  eventId: z.string().regex(/^evt_[a-zA-Z0-9_-]{16,80}$/),
  eventType: z.string().min(1).max(160),
  schemaVersion: z.string().regex(/^v\d+$/),
  tenantId: TenantIdSchema,
  aggregateType: z.enum(["mission", "task", "harness_run", "node_run", "side_effect", "budget", "membership"]),
  aggregateId: z.string().min(1).max(160),
  sequence: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: z.string().min(1),
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  traceId: z.string().min(1),
  source: z.object({
    plane: z.enum(["interface", "control", "orchestration", "execution", "state_evidence"]),
    service: z.string().min(1),
    version: z.string().min(1)
  }).strict(),
  occurredAt: z.string().datetime(),
  producedBy: z.object({
    principalType: PrincipalTypeSchema,
    principalId: PrincipalIdSchema
  }).strict()
}).strict();
```

### 26.2 Mission Event List

| Event Type | Tier | Aggregate | Payload Schema | Description |
|---|---:|---|---|---|
| `platform.mission.created` | 1 | mission | MissionCreatedPayload | Mission created |
| `platform.mission.updated` | 1 | mission | MissionUpdatedPayload | non-status field update |
| `platform.mission.activated` | 1 | mission | MissionStatusChangedPayload | draft→active |
| `platform.mission.paused` | 1 | mission | MissionStatusChangedPayload | active→paused |
| `platform.mission.resumed` | 1 | mission | MissionStatusChangedPayload | paused→active |
| `platform.mission.frozen` | 1 | mission | MissionStatusChangedPayload | active/paused→frozen |
| `platform.mission.unfrozen` | 1 | mission | MissionStatusChangedPayload | frozen→paused |
| `platform.mission.completed` | 1 | mission | MissionStatusChangedPayload | active/paused→completed |
| `platform.mission.archived` | 1 | mission | MissionStatusChangedPayload | completed/paused/frozen→archived |
| `platform.mission.member_added` | 1 | membership | MissionMemberChangedPayload | member joined |
| `platform.mission.member_removed` | 1 | membership | MissionMemberChangedPayload | member removed |
| `platform.mission.member_role_changed` | 1 | membership | MissionMemberChangedPayload | role changed |
| `platform.mission.bound_to_task` | 1 | task | MissionTaskBoundPayload | Task bound Mission |
| `platform.mission.snapshot_created` | 1 | mission | MissionSnapshotCreatedPayload | Snapshot generated |
| `platform.mission.budget_reserved` | 1 | budget | MissionBudgetReservedPayload | budget reserved |
| `platform.mission.budget_settled` | 1 | budget | MissionBudgetSettledPayload | budget settled |
| `platform.mission.budget_released` | 1 | budget | MissionBudgetReleasedPayload | budget released |
| `platform.mission.budget_exhausted` | 1 | budget | MissionBudgetExhaustedPayload | budget exhausted |
| `platform.mission.handoff_requested` | 2 | mission | MissionHandoffRequestedPayload | cross-Mission handoff |
| `platform.mission.handoff_accepted` | 2 | mission | MissionHandoffDecisionPayload | accept handoff |
| `platform.mission.handoff_rejected` | 2 | mission | MissionHandoffDecisionPayload | reject handoff |
| `platform.mission.learning_attached` | 2 | mission | MissionLearningAttachedPayload | learning object attached |
| `platform.mission.learning_promoted` | 2 | mission | MissionLearningPromotedPayload | learning promoted |

### 26.3 MissionStatusChangedPayload

```ts
export const MissionStatusChangedPayloadSchema = z.object({
  missionId: MissionIdSchema,
  tenantId: TenantIdSchema,
  previousStatus: MissionStatusSchema,
  nextStatus: MissionStatusSchema,
  previousVersion: z.number().int().nonnegative(),
  nextVersion: z.number().int().positive(),
  reasonCode: z.string().min(1).max(128),
  reason: z.string().max(2000).optional(),
  approvalRefs: z.array(z.string()).default([]),
  auditRef: z.string().min(1)
}).strict();
```

### 26.4 Sequence Rules

```text
sequence scope = tenantId + aggregateType + aggregateId
sequence starts at 1
sequence increments by 1 in the same transaction as truth update
missing sequence = startup consistency P0
duplicate sequence = startup consistency P0
out-of-order projection input = buffer or replay, never silently apply
```

---

## 27. API Contract

### 27.1 Common Headers

All write requests must carry:

```http
X-Request-Id: req_xxx
X-Trace-Id: trace_xxx
X-Correlation-Id: corr_xxx
X-Idempotency-Key: idem_xxx
Accept-Version: v1
Content-Type: application/json
Authorization: Bearer <token>
```

PATCH/status transitions must additionally carry:

```http
If-Match: <etag>
```

Response must return:

```http
X-Request-Id: req_xxx
X-Trace-Id: trace_xxx
X-Correlation-Id: corr_xxx
X-Contract-Version: v1
```

### 27.2 Mission API

| Method | Path | Description | Permission | Idempotent |
|---|---|---|---|---|
| POST | `/api/v1/missions` | Create Mission | `mission:update` or tenant create permission | required |
| GET | `/api/v1/missions/{missionId}` | Read Mission | `mission:read` | not required |
| PATCH | `/api/v1/missions/{missionId}` | Update non-status fields | `mission:update` | required + If-Match |
| POST | `/api/v1/missions/{missionId}:activate` | Activate | owner/admin | required + If-Match |
| POST | `/api/v1/missions/{missionId}:pause` | Pause | owner/admin | required + If-Match |
| POST | `/api/v1/missions/{missionId}:resume` | Resume | owner/admin | required + If-Match |
| POST | `/api/v1/missions/{missionId}:freeze` | Freeze | owner/admin/security/panic | required + If-Match |
| POST | `/api/v1/missions/{missionId}:unfreeze` | Unfreeze to paused | owner/admin + approval | required + If-Match |
| POST | `/api/v1/missions/{missionId}:complete` | Complete | owner/admin | required + If-Match |
| POST | `/api/v1/missions/{missionId}:archive` | Archive | owner/admin | required + If-Match |
| GET | `/api/v1/missions/{missionId}/tasks` | Tasks under Mission | `mission:read` | not required |
| GET | `/api/v1/missions/{missionId}/runs` | HarnessRuns under Mission | `mission:read` | not required |
| GET | `/api/v1/missions/{missionId}/evidence` | Evidence | `mission:view_evidence` | not required |
| GET | `/api/v1/missions/{missionId}/budget` | Budget | `mission:view_budget` | not required |
| POST | `/api/v1/missions/{missionId}/members` | Add member | `mission:manage_members` | required |
| DELETE | `/api/v1/missions/{missionId}/members/{membershipId}` | Remove member | `mission:manage_members` | required |

### 27.3 Mission Resolution API

```http
POST /api/v1/mission-resolutions:dry-run
```

Request:

```json
{
  "tenantId": "tenant_001",
  "sessionId": "sess_001",
  "confirmedTaskSpecId": "cts_001",
  "missionHint": "mis_product_launch_2026",
  "createIfMissing": false
}
```

Response:

```json
{
  "resolution": "matched_existing",
  "missionId": "mis_product_launch_2026",
  "confidence": 0.93,
  "requiresUserChoice": false,
  "candidateMissionIds": [],
  "effectiveConstraintsPreview": {
    "allowAutoExecute": false,
    "requireHITL": true,
    "allowExternalNetwork": true,
    "allowSideEffectCommit": false,
    "maxDelegationDepth": 3,
    "maxParallelNodeRuns": 8,
    "requireBudgetReservation": true,
    "requireEvidenceRefs": true,
    "allowModelCall": true,
    "allowToolCall": true,
    "allowFileWrite": false,
    "allowDestructiveAction": false,
    "requireDomainOwnerApproval": true,
    "deniedToolNames": [],
    "deniedDomains": [],
    "dataResidency": ["us"],
    "modelTrainingOptOut": true
  }
}
```

### 27.4 How Task Creation Binds Mission

```http
POST /api/v1/tasks
```

Request must contain one of the following two:

```json
{
  "missionRef": {
    "mode": "use_existing",
    "missionId": "mis_product_launch_2026"
  }
}
```

Or:

```json
{
  "missionRef": {
    "mode": "auto_resolve",
    "allowAdHoc": true,
    "createFormalMissionWhen": "multi_task_or_high_risk"
  }
}
```

High-risk, write operations, cross-system side effects, long-term goals, multi-Agent collaborative tasks prohibit missionless dispatch.

### 27.5 ErrorEnvelope

```ts
export const MissionErrorCodeSchema = z.enum([
  "MISSION_NOT_FOUND",
  "MISSION_REQUIRED",
  "MISSION_INACTIVE",
  "MISSION_FROZEN",
  "MISSION_ARCHIVED",
  "MISSION_PERMISSION_DENIED",
  "MISSION_BUDGET_EXHAUSTED",
  "MISSION_POLICY_DENIED",
  "MISSION_RISK_REQUIRES_APPROVAL",
  "MISSION_SNAPSHOT_REQUIRED",
  "MISSION_VERSION_CONFLICT",
  "MISSION_INVALID_TRANSITION",
  "MISSION_IDEMPOTENCY_CONFLICT"
]);
```

Error response:

```json
{
  "error": {
    "code": "MISSION_FROZEN",
    "message": "Mission is frozen and cannot dispatch new work.",
    "details": {
      "missionId": "mis_product_launch_2026",
      "currentStatus": "frozen"
    },
    "requestId": "req_001",
    "traceId": "trace_001",
    "correlationId": "corr_001"
  }
}
```

---

## 28. Storage Contract

### 28.1 mission_records

```sql
CREATE TABLE mission_records (
  mission_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  objective TEXT NOT NULL,
  success_criteria_json TEXT NOT NULL,
  owner_principal_id TEXT NOT NULL,
  accountable_principal_id TEXT,
  domain_id TEXT,
  policy_refs_json TEXT NOT NULL,
  risk_profile_ref TEXT,
  budget_envelope_ref TEXT,
  knowledge_boundary_ref TEXT,
  default_workflow_template_refs_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  freeze_reason TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  archived_at TEXT,
  archived_by TEXT,
  version INTEGER NOT NULL,
  etag TEXT NOT NULL,
  CHECK (version >= 0)
);

CREATE INDEX idx_mission_records_tenant_status
  ON mission_records(tenant_id, status);

CREATE INDEX idx_mission_records_owner
  ON mission_records(tenant_id, owner_principal_id);
```

### 28.2 mission_memberships

```sql
CREATE TABLE mission_memberships (
  membership_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  denied_permissions_json TEXT NOT NULL,
  status TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  expires_at TEXT,
  metadata_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  UNIQUE (mission_id, principal_type, principal_id),
  FOREIGN KEY (mission_id) REFERENCES mission_records(mission_id)
);

CREATE INDEX idx_mission_memberships_principal
  ON mission_memberships(tenant_id, principal_type, principal_id, status);
```

### 28.3 mission_context_snapshots

```sql
CREATE TABLE mission_context_snapshots (
  mission_snapshot_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  mission_version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  org_id TEXT,
  task_id TEXT NOT NULL,
  confirmed_task_spec_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  signature TEXT,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (mission_id) REFERENCES mission_records(mission_id)
);

CREATE INDEX idx_mission_snapshots_task
  ON mission_context_snapshots(tenant_id, task_id);
```

### 28.4 mission_event_sequences

```sql
CREATE TABLE mission_event_sequences (
  tenant_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  next_sequence INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, aggregate_type, aggregate_id)
);
```

### 28.5 Transaction Boundary

Mission truth update and event append must be in the same transaction:

```text
BEGIN
  read mission by id FOR UPDATE / sqlite immediate transaction
  validate expectedVersion
  apply state mutation
  increment version
  allocate aggregate sequence
  append PlatformFactEvent
  update projection outbox
COMMIT
```

Prohibited:

```text
update mission table first, then publish event asynchronously
publish event first, then update mission table asynchronously
```

---

## 29. Runtime Binding Flow

### 29.1 Mandatory Chain from Task to HarnessRun

```mermaid
sequenceDiagram
    participant U as User/API
    participant NL as NL Gateway
    participant MR as MissionResolver
    participant MG as MissionGovernance
    participant TS as TaskService
    participant OR as OAPEFLIR/Planner
    participant HR as HarnessRuntime
    participant EB as EventBus/Truth

    U->>NL: RawInput / ConfirmedTaskSpec
    NL->>MR: resolveMission(taskSpec, session)
    MR->>MG: authorize + policy + risk + budget preview
    MG-->>MR: MissionDecision + constraints
    MR->>EB: append mission.bound_to_task
    MR->>MG: create MissionContextSnapshot
    MG->>EB: append mission.snapshot_created
    MR-->>TS: task + missionSnapshotId
    TS->>OR: plan under MissionSnapshot
    OR->>HR: start HarnessRun(planGraphBundle, missionSnapshotId)
    HR->>EB: append harness_run.created
    HR->>HR: NodeRun live guard before each node
```

### 29.2 NodeRun Live Guard

Must check before each NodeRun execution:

```text
Mission status not frozen/archived/completed
Mission membership still valid
Principal still has effective permission
Runtime constraints still allow requested action
Budget reservation still valid
Knowledge boundary still valid
Panic directive not active for scope
```

Failure handling:

| Failure Reason | NodeRun Behavior | Mission Behavior |
|---|---|---|
| Mission frozen | block + emit blocker | unchanged |
| Mission archived/completed | safe terminate | unchanged |
| Permission revoked | await HITL or fail closed | unchanged |
| Budget exhausted | safe terminate | emit budget_exhausted |
| Policy denied | block | can trigger incident |
| Panic active | abort/drain | Mission can transition to frozen |

### 29.3 MissionResolver Priority

```text
1. explicit missionRef from API/user selection
2. active session boundMissionId
3. taskSpec domain/project affinity
4. open mission candidate search by objective similarity
5. ad_hoc mission creation only for low-risk single-task work
6. formal mission creation for long-lived/high-risk/multi-agent/multi-task work
7. fail closed when mission required but cannot resolve
```

---

## 30. Integration Points of Contract with Existing Objects

### 30.1 RequestEnvelope Extension

Do not create a fourth RequestEnvelope. Only add to the canonical RequestEnvelope:

```ts
missionRef?: {
  missionId: string;
  missionSnapshotId?: string;
  resolutionMode: "explicit" | "session_bound" | "auto_resolved" | "ad_hoc_created";
};
```

### 30.2 ConfirmedTaskSpec Extension

```ts
missionIntent?: {
  preferredMissionId?: string;
  allowAdHocMission: boolean;
  requiresFormalMission: boolean;
  reason: string;
};
```

### 30.3 PlanGraphBundle Extension

```ts
missionContextSnapshotRef: {
  missionId: string;
  missionSnapshotId: string;
  missionVersion: number;
};
```

PlanGraphBundle is still the unique plan object. Mission cannot add `steps[] / currentStep / stepOutputs`, nor can it repackage PlanNode/NodeRun as MissionStep.

### 30.4 HarnessRun Extension

```ts
missionBinding: {
  missionId: string;
  missionSnapshotId: string;
  missionVersion: number;
  bindingMode: "required" | "ad_hoc" | "system";
};
```

### 30.5 NodeRun Extension

```ts
missionRuntimeGuard: {
  checkedAt: string;
  decision: "allowed" | "blocked" | "requires_hitl" | "terminated";
  reasonCode?: string;
  policyDecisionRefs: string[];
  budgetReservationId?: string;
};
```

---

## 31. UI Mission Console Implementation Specification

### 31.1 Page Structure

```text
Mission Console
  ├── Overview
  │     ├── Objective
  │     ├── Success Criteria
  │     ├── Current Status
  │     ├── Risk / Policy / Budget Summary
  │     └── Recent Timeline
  ├── Tasks
  │     ├── Task list
  │     ├── Status / Owner / Risk / Budget
  │     └── Create Task under Mission
  ├── Runs
  │     ├── HarnessRun list
  │     ├── PlanGraph view
  │     └── NodeRun / NodeAttempt drilldown
  ├── Budget
  │     ├── Reservations
  │     ├── Settlements
  │     ├── Watermark alerts
  │     └── Cost attribution
  ├── Evidence
  │     ├── Evidence bundles
  │     ├── Audit timeline
  │     └── Export package
  ├── Knowledge & Learning
  │     ├── Mission memory
  │     ├── Learning objects
  │     ├── Promotion candidates
  │     └── Trust level
  ├── Members & Permissions
  │     ├── Memberships
  │     ├── Role assignments
  │     └── Expiry / revocation
  └── Settings
        ├── Policy refs
        ├── Workflow templates
        ├── Data residency
        └── Archive / freeze / complete actions
```

### 31.2 UI Prohibitions

| Prohibited Item | Reason |
|---|---|
| UI locally generates effective permissions | permissions must come from server-side MissionGovernance |
| UI locally executes task/run | violates P1→P2→P3→P4 control chain |
| UI treats mission hint as authorization | hint is only candidate, not decision |
| UI stores token in localStorage | XSS readable |
| UI does not confirm for freeze/complete/archive | high-risk operations require secondary confirmation and audit |
| UI uses missionId as high-cardinality metrics label | cardinality explosion |

---

## 32. Migration Plan v1.3

### Phase 0 — Contract Freeze Gate

Goal: freeze Mission types, events, API, no parallel definitions allowed.

Must complete:

```text
- Delete/deprecate duplicate RequestEnvelope / ExecutionPlan / StateCommand active exports
- canonical types/index.ts re-export Mission schemas
- golden tests lock MissionRecord/MissionSnapshot/EventEnvelope shape
```

Acceptance:

```bash
npm run test:contracts -- mission
npm run test:golden -- mission
```

### Phase 1 — Storage + Event Foundation

Goal: create Mission truth tables and event projections, not integrate into execution path.

Must complete:

```text
- mission_records
- mission_memberships
- mission_context_snapshots
- mission_event_sequences
- mission projections
- platform.mission.* event schema registry
```

Acceptance:

```text
create/update/status transition can write truth + event in the same transaction
replay event can rebuild Mission projection
sequence missing/duplicate -> startup checker P0 fail-closed
```

### Phase 2 — MissionResolver Integrates into Intake

Goal: force Mission resolution before Task creation, but allow compatibility flag.

Feature flags:

```json
{
  "mission.enabled": true,
  "mission.requireForHighRisk": true,
  "mission.allowAdHocForLowRisk": true,
  "mission.requireForAllDispatch": false
}
```

Acceptance:

```text
high-risk task without missionRef -> 409 MISSION_REQUIRED
low-risk task without missionRef -> automatic ad_hoc mission
explicit missionRef without permission -> 403 MISSION_PERMISSION_DENIED
```

### Phase 3 — HarnessRun Binds MissionSnapshot

Goal: all new HarnessRun must have missionSnapshotId.

Acceptance:

```text
HarnessRuntime.start(planGraphBundle) without missionSnapshotId directly rejected
MissionSnapshot payloadHash can be recalculated
Task / PlanGraph / HarnessRun traceId/correlationId are consistent
```

### Phase 4 — NodeRun Live Guard

Goal: force check live Mission status before each NodeRun execution.

Acceptance:

```text
Mission active -> node allowed
Mission frozen before node -> node blocked
Membership revoked before node -> node blocked or HITL
Budget exhausted before model call -> no provider call issued
```

### Phase 5 — Full Enforcement

Goal: all dispatch must bind Mission.

Feature flags:

```json
{
  "mission.requireForAllDispatch": true,
  "mission.legacyTaskWithoutMission": "reject"
}
```

Acceptance:

```text
legacy task direct dispatch path all fail
/api/v1/tasks creation all generate mission.bound_to_task event
HarnessRun without missionSnapshot cannot enter running
```

### Phase 6 — UI Console + Observability

Goal: Mission Console online, dashboard can aggregate by Mission.

Acceptance:

```text
Mission overview data comes from projection, does not directly scan truth
Budget/evidence/runs/tasks all support cursor pagination
Trace/log can search missionId, but metrics do not use missionId as default label
```

### Phase 7 — Learning Promotion

Goal: LearningObject defaults to mission scoped, promoted to domain/platform after approval.

Acceptance:

```text
LearningObject without evidenceRefs -> quarantine
mission scoped learning does not enter platform knowledge search
promotion requires trust gate + approval + rollout evidence
```

---

## 33. Test Matrix

### 33.1 Contract Tests

| Test | Must Cover |
|---|---|
| MissionRecord strict schema | extra fields rejected, required fields missing rejected |
| MissionStatus transition | illegal transition rejected |
| MissionSnapshot hash | payloadHash can be recalculated |
| EventEnvelope sequence | sequence monotonically increasing |
| ErrorEnvelope | traceId/correlationId required |

### 33.2 Unit Tests

| Module | Use Cases |
|---|---|
| MissionResolver | explicit/session/auto/ad_hoc/fail-closed |
| MissionGovernance | permission intersection, policy deny, risk approval |
| MissionBudgetService | reserve/settle/release CAS and concurrent over-spend protection |
| MissionLifecycleService | version conflict, If-Match, idempotency replay |
| RuntimeConstraintSet | AND/OR/MIN/UNION/INTERSECTION merge rules |

### 33.3 Integration Tests

| Link | Use Cases |
|---|---|
| Create Mission | API → service → truth → event → projection |
| Bind Task | Task create → mission resolution → snapshot |
| Dispatch | PlanGraphBundle → HarnessRun with missionSnapshot |
| Live Guard | freeze/revoke/budget-exhausted block NodeRun |
| Replay | mission events replay and projection completely consistent |

### 33.4 E2E Tests

| Scenario | Acceptance |
|---|---|
| Low-risk one-shot | automatically create ad_hoc Mission and complete Task |
| High-risk write action | reject without Mission; with Mission but no approval enter HITL |
| Mission freeze mid-run | subsequent NodeRun blocked, existing side-effect enters reconciliation |
| Membership revoked mid-run | next node rejected |
| Budget exhausted | provider/tool call not issued, run safe terminate |
| Mission complete | subsequent new task dispatch rejected |

### 33.5 Chaos / Concurrency Tests

| Scenario | Acceptance |
|---|---|
| Concurrent activate/pause | only one CAS succeeds |
| Concurrent budget reserve | does not exceed hard cap |
| crash between truth/event | not allowed; same transaction verification |
| projection rebuild | shadow rebuild + compare + cutover |
| event duplicate delivery | projection idempotent |

### 33.6 Prohibited Test Writing

```text
assert.ok(true) in catch
assert.ok(x === true || x === false)
Directly operate legacy WorkflowState to prove canonical path correct
Only mock service without importing production code but named integration
Test illegal shape but production code does not schema parse
```

---

## 34. Implementation Task Breakdown

### 34.1 P0 Implementation Tasks

| Task | Owner Module | Description | Current Conclusion |
|---|---|---|---|
| T-MIS-001 | contracts | Add Mission Zod schemas and type exports | ✅ Implemented |
| T-MIS-002 | state-evidence | mission_records/memberships/snapshots/event_sequences migration | ✅ Implemented |
| T-MIS-003 | events | Register platform.mission.* event schemas | ✅ Implemented |
| T-MIS-004 | control-plane | MissionLifecycleService + CAS transition | ✅ Implemented |
| T-MIS-005 | control-plane | MissionResolver + MissionGovernanceService | ✅ Implemented |
| T-MIS-006 | interface | /api/v1/missions API + ErrorEnvelope | ✅ Implemented, including Mission Console backend subresource API |
| T-MIS-007 | orchestration | PlanGraphBundle missionSnapshotRef required | ✅ Implemented as compatible contract extension, binding guard and Task create Mission snapshot binding |
| T-MIS-008 | execution | HarnessRun missionBinding required | ✅ Implemented as compatible contract extension and single-binding guard |
| T-MIS-009 | execution | NodeRun MissionLiveGuard | ✅ Implemented as testable guard service |
| T-MIS-010 | tests | canonical Mission E2E coverage | ✅ Implemented, including API/task binding/live guard freeze/high-risk reject E2E |

### 34.2 P1 Implementation Tasks

| Task | Owner Module | Description | Current Conclusion |
|---|---|---|---|
| T-MIS-011 | ui | Mission Console Overview/Tasks/Runs/Budget/Evidence | ✅ Mission Console UI feature and backend data surface implemented; real independent frontend release belongs to external integration evolution |
| T-MIS-012 | observability | Mission trace/log correlation + metrics cardinality guard | ✅ Implemented as policy/service baseline |
| T-MIS-013 | learning | Mission scoped LearningObject promotion gate | ✅ Implemented as promotion gate baseline |
| T-MIS-014 | migration | legacy Task/Session missionRef backfill | ✅ Batch backfill and unresolved report implemented |
| T-MIS-015 | docs | ADR update and superseded marker | ✅ Written back to this document state and evidence |

### 34.3 P2 Implementation Tasks

| Task | Owner Module | Description | Current Conclusion |
|---|---|---|---|
| T-MIS-016 | federation | Mission handoff across org/tenant | ✅ Federated handoff trust-pair guard, approval/audit request implemented; real external trust provisioning is external evolution |
| T-MIS-017 | multi-region | Mission home region + read replica routing | ✅ Home-region/fencing/read-routing decision implemented; real multi-region replication is deployment evolution |
| T-MIS-018 | analytics | Mission outcome analytics | ✅ In-repo outcome analytics service baseline implemented |
| T-MIS-019 | marketplace | Mission template/package integration | ✅ In-repo template/package integration baseline implemented |

---

## 35. Backward Compatibility and Deprecation

### 35.1 Legacy Object Handling

| Legacy Object | Processing Method |
|---|---|
| WorkflowState | Only as projection/compat view, cannot serve as execution truth |
| TaskRecord | Can be retained, but must add missionRef projection field |
| ExecutionPlan | deprecated alias, prohibit new call sites |
| ControlDirective | deprecated alias, migrate to OperationalDirective/DecisionDirective |
| StateCommand | deprecated alias, migrate to RuntimeTransitionCommand |

### 35.2 Compatibility Flags

```json
{
  "mission.enabled": true,
  "mission.requireForAllDispatch": false,
  "mission.allowLegacyReadProjection": true,
  "mission.rejectLegacyWritePath": false,
  "mission.createAdHocForLegacyTask": true
}
```

Final production state:

```json
{
  "mission.enabled": true,
  "mission.requireForAllDispatch": true,
  "mission.allowLegacyReadProjection": true,
  "mission.rejectLegacyWritePath": true,
  "mission.createAdHocForLegacyTask": false
}
```

---

## 36. Risk Review After v1.3

| Risk | v1.3 Mitigation |
|---|---|
| Mission becomes another Workflow | Explicitly prohibit `steps[] / currentStep / currentNode / toolCalls`; Mission only stores goals, boundaries, budgets, policies, members, evidence and projection |
| Mission and Session redundant | Session is only responsible for interaction context, Mission is responsible for long-term governance goals |
| Mission and Domain redundant | Domain is capability/policy classification, Mission is specific goal instance |
| Mission and Project Folder confused | Folder is UI organization, Mission is governance truth |
| Mission permission bypass | effectivePermissions can only be calculated by server-side intersection |
| MissionSnapshot outdated causes revocation to be ineffective | Snapshot ensures reproducibility, NodeRun live guard ensures safety |
| Event and truth inconsistent | append truth + event in the same transaction |
| metrics cardinality explosion | missionId does not serve as default label |
| Low-risk task cost too high | ad_hoc Mission auto-created, user imperceptible |

---

## 37. v1.4 Final Freeze Conclusion

Mission can officially enter the implementation phase, but must be landed in the following order:

```text
1. Contract + Schema Freeze
2. Storage + Event Foundation
3. MissionResolver integrates into Task Intake
4. HarnessRun forces MissionSnapshot binding
5. NodeRun Live Guard
6. API/UI/Observability complete integration
7. Learning Promotion and Federation extension
```

Final architectural principles remain unchanged:

```text
Mission governs.
PlanGraph plans.
HarnessRun executes.
NodeRun attempts.
Event/Truth proves.
Projection/UI observes.
```

This design can upgrade the system from a "single Agent Task execution platform" to a "long-term goal-driven, governable, auditable, recoverable, learnable Agent ecosystem", without breaking the existing five-plane architecture and canonical runtime object model.


## 38. v1.4 Change Summary

Core changes of v1.4 compared to v1.3:

| Change Item | Content |
|---|---|
| Step Degradation | Demote Step from potentially misused execution concept to UI/document display term |
| Graph/Node Unification | Clarify `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt` as the unique canonical execution chain |
| Mission Boundary Reinforcement | Mission prohibits storing `steps[] / currentStep / stepOutputs / toolCalls / nodeRuntimeState` |
| API Constraints | API response prohibits adding Step-centric shape, uniformly returns graph/node/run/attempt refs |
| Event Constraints | Prohibit adding `step.started / step.completed` etc. events, use `node_run.* / node_attempt.*` instead |
| Budget Constraints | Prohibit `max_steps / stepCost`, use `maxNodeRuns / maxNodeAttempts / nodeBudget / attemptCost` instead |
| Test Governance | Contract/E2E/Golden add Step-centric field scan and canonical runtime path coverage |
| Migration Path | Clarify that legacy `PlanStep / WorkflowStep / HarnessStep` can only be used for migration adapter, cannot serve as new implementation dependency |

## 39. v1.4 Merged Supplement: Step Degradation and Graph/Node-centric Unification Rules

> **Applicable Scope**: Automatic Agent Platform / Mission Architecture Integration Plan
> **Update Goal**: Demote `Step` from platform-level canonical object to UI/document display term, to avoid Mission introduction reactivating the legacy `WorkflowState / PlanStep / HarnessStep` system.
> **Core Conclusion**: After Mission is introduced, the system must further migrate from Step-centric to Graph/Node-centric. `Step` can only serve as a user-readable display term or legacy migration terminology; all canonical contracts, runtime state, events, budgets, evidence, and APIs must use `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt`.

---

### 1. Why Step Must Be Weakened

In the past, the system simultaneously had `WorkflowStep`, `PlanStep`, `HarnessStep`, `stepId`, `currentStep`, `max_steps` and other concepts, leading to three structural problems:

1. **Execution Model Degrades to Linear Process**
   `steps[]` naturally implies sequential execution, making it difficult to express DAG, parallel branches, conditional jumps, retries, compensation and replan.

2. **Evidence Chain Cannot Be Precisely Bound**
   Step granularity is too coarse to distinguish multiple attempts of a single Node, failure retry, partial side effect, HITL modification, and final receipt.

3. **Mission / Task / Workflow / Harness Boundaries Are Easily Confused**
   If Mission also stores steps, the system will return to the legacy WorkflowState mode, breaking the principle of PlanGraphBundle as the unique execution plan contract.

Therefore, `Step` is no longer a platform-level authoritative object, can only serve as a non-authoritative display term.

---

### 2. Canonical Hierarchical Relationship

The execution hierarchy in the system is uniformly:

```text
Mission
  └── Task
        └── PlanGraphBundle
              └── PlanNode
                    └── NodeRun
                          └── NodeAttempt
                                └── NodeAttemptReceipt / EvidenceRef / SideEffectRecord
```

| Object | Is Canonical | Function | Whether Step Is Allowed |
|---|---:|---|---:|
| Mission | yes | long-cycle goal, task combination, policy context, cross-task governance | no |
| Task | yes | a single executable request after user confirmation | no |
| PlanGraphBundle | yes | unique plan contract, carrying DAG, budget, risk, constraints, version lock | no |
| PlanNode | yes | planned node in DAG, does not represent actual execution attempt | no |
| HarnessRun | yes | a controlled execution run, binding Task and PlanGraphBundle | no |
| NodeRun | yes | running instance of a single PlanNode | no |
| NodeAttempt | yes | single execution attempt, carrying retry, tool call, latency, cost, error | no |
| Step | no | only natural language display term in UI/docs | only available in display layer |

---

### 3. Where Step Is Allowed

| Scenario | Whether Allowed | Constraint |
|---|---:|---|
| UI copy | cautiously allowed | can display "step", but the bottom layer must map to `PlanNode / NodeRun / NodeAttempt` |
| User help documentation | allowed | can only serve as natural language explanation, cannot define interface fields |
| Legacy migration | temporarily allowed | only used for old `WorkflowState / PlanStep / HarnessStep` migration |
| Test fixtures | temporarily allowed | can only be used for legacy tests, cannot enter canonical E2E |
| Operations report display | cautiously allowed | display field can be called step, but data source must be NodeRun aggregation |

---

### 4. Where Step Is Prohibited

| Position | Prohibited Item | Alternative |
|---|---|---|
| Contract | `steps[]`, `currentStep`, `stepId` | `PlanGraphBundle.nodes/edges`, `nodeId` |
| Runtime | Step as execution scheduling unit | `NodeRun` |
| Retry | `stepRetry` | `NodeAttempt` |
| Budget | `max_steps`, `stepCost` | `maxNodeRuns`, `maxNodeAttempts`, `nodeBudget` |
| Evidence | `stepEvidence`, `stepOutput` | `evidenceRefs`, `NodeAttemptReceipt` |
| Event | `step_started`, `step_completed` | `node_run.started`, `node_attempt.completed` |
| API | Step-centric response shape | Graph/Node-centric response shape |
| State Machine | `StepStatus` | `NodeRunStatus / NodeAttemptStatus` |
| Mission | `mission.steps`, `mission.currentStep` | `mission.taskRefs`, `mission.progressSummary` |
| Task | `task.steps` | `task.planGraphBundleRef` |

---

### 5. Recommended Terminology Replacement Table

| Legacy Term | Canonical Term |
|---|---|
| Step | Node / NodeRun; display layer can be translated as "step" |
| PlanStep | PlanNode |
| WorkflowStep | PlanNode / NodeRun |
| HarnessStep | NodeRun / NodeAttempt |
| CurrentStep | currentNodeRunId / activeNodeRunRefs |
| StepOutput | NodeAttemptReceipt / EvidenceRef |
| StepRetry | NodeAttempt |
| max_steps | maxNodeRuns / maxNodeAttempts |
| stepId | nodeId / nodeRunId / nodeAttemptId |
| stepStatus | nodeRunStatus / nodeAttemptStatus |
| stepEvidence | evidenceRefs |
| stepCost | nodeRunCost / attemptCost |
| stepTimeout | nodeRunTimeoutMs / attemptTimeoutMs |

---

### 6. Boundary Rules After Mission Introduction

Mission is an Agent ecosystem-level object, not an Agent Session, nor a large Workflow.

#### 6.1 What Mission Is Allowed to Save

- `missionId`
- `tenantId / orgId / ownerRef`
- `objective`
- `missionType`
- `status`
- `taskRefs`
- `policyRefs`
- `budgetEnvelope`
- `riskProfile`
- `progressSummary`
- `evidenceBundleRefs`
- `versionLockRefs`
- `auditRefs`

#### 6.2 What Mission Is Prohibited from Saving

- `steps[]`
- `currentStep`
- `stepOutputs`
- `toolCalls`
- `nodeRuntimeState`
- `workerLease`
- `sideEffectState`
- `checkpointPayload`

#### 6.3 Source of Mission Progress

Mission progress can only be aggregated from lower-layer facts:

```text
Mission progress = aggregate(
  Task status,
  HarnessRun status,
  NodeRun status,
  Evidence refs,
  Budget usage,
  Risk state
)
```

Mission does not directly drive tool calls, does not directly hold worker lease, does not directly write side effect.

---

### 7. API Design Rules

External APIs should avoid returning Step-centric structures.

#### 7.1 Wrong Example

```json
{
  "missionId": "mis_123",
  "currentStep": "collect_data",
  "steps": [
    { "stepId": "s1", "status": "running" }
  ]
}
```

#### 7.2 Recommended Example

```json
{
  "missionId": "mis_123",
  "activeTaskRefs": ["task_001"],
  "activeNodeRunRefs": ["nr_001"],
  "progressSummary": {
    "totalNodeRuns": 12,
    "completedNodeRuns": 8,
    "blockedNodeRuns": 1,
    "activeNodeRuns": 3
  }
}
```

UI can display `NodeRun` as "step", but API field names must remain canonical.

---

### 8. Event Naming Rules

#### 8.1 Prohibited to Add

```text
step.started
step.completed
workflow.step.failed
mission.step.updated
```

#### 8.2 Recommended to Use

```text
platform.plan_graph.created
platform.harness_run.started
platform.node_run.started
platform.node_attempt.started
platform.node_attempt.completed
platform.node_run.completed
platform.harness_run.completed
platform.mission.progress_projected
```

Mission events must be facts or projections, must not carry alternative state of underlying execution details.

---

### 9. Test Governance Rules

| Test Type | Requirement |
|---|---|
| Contract tests | prohibit `steps[]` as canonical field |
| E2E tests | must cover `Task → PlanGraphBundle → HarnessRun → NodeRun → NodeAttempt` |
| Golden tests | response snapshot must not contain `currentStep / stepId / steps` |
| Migration tests | can have Step, but must be marked as legacy |
| UI tests | can assert display copy "step", but data source must be NodeRun fixture |

Recommend adding static scan rules:

```text
Prohibit adding stepId / currentStep / steps[] in src/platform/contracts/**
Prohibit adding StepStatus / WorkflowStep in src/platform/five-plane-execution/**
Prohibit outputting PlanStep[] as plan contract in src/platform/five-plane-orchestration/**
Prohibit exposing Step-centric response in src/platform/five-plane-interface/api/**
```

---

### 10. Migration Path

#### Phase 1: Freeze Step Addition

- Prohibit adding `Step` as contract/runtime/event field.
- Mark old `PlanStep / WorkflowStep / HarnessStep` as deprecated.
- Add Step-centric field scan in lint or contract test.

#### Phase 2: Adapt Legacy to Node

- `PlanStep` migrates to `PlanNode`.
- `HarnessStep` splits into `NodeRun + NodeAttempt`.
- `WorkflowState.currentStep` changes to projection field, no longer serves as truth.

#### Phase 3: API Output Switch

- API returns `planGraphBundleRef / activeNodeRunRefs / evidenceRefs`.
- UI aggregates and displays NodeRun as "step" through adapter.
- Old `steps[]` response enters compatibility endpoint.

#### Phase 4: Delete Legacy Step Truth

- Delete or isolate legacy `WorkflowState / PlanStep / HarnessStep` write path.
- All E2E change to canonical runtime path.
- Step only remains in UI label, user documentation and legacy migration adapter.

---

### 11. Acceptance Criteria

After completing Step degradation, the following conditions should be met:

- `PlanGraphBundle` is the unique plan contract.
- `NodeRun / NodeAttempt` is the unique execution granularity.
- `Step` no longer appears in canonical contract, runtime state, budget, event, evidence, API response.
- Mission does not contain `steps[] / currentStep / stepOutputs`.
- UI can display "step", but must be aggregated from `NodeRun`.
- All new E2E no longer goes through `WorkflowState / PlanStep / HarnessStep` legacy path.
- All budget limits use `maxNodeRuns / maxNodeAttempts / maxToolCalls / maxDurationMs / maxModelTokens`.
- All evidence, audit, side effects are bound to `nodeRunId / nodeAttemptId / evidenceRefs`.

---

### 12. Final Consistency Constraint with Mission Plan

After Mission is introduced, no new execution hierarchy bloat can be formed.

The correct relationship is:

```text
Mission = Long-term goal and task combination governance layer
Task = A single executable request after user confirmation
Session = Interaction context and continuous dialog context
PlanGraphBundle = Unique plan graph
HarnessRun = A controlled run
NodeRun = Graph node running instance
NodeAttempt = Single execution attempt
Runtime = Execution environment and scheduling system
Agent = Capability body, not state container
Workflow = Reusable process template or UI projection, not truth
Step = Non-authoritative display term
```

Therefore, Mission should not introduce `MissionStep`, Task should not save `TaskStep`, Workflow should not become execution truth again. The system's authoritative running chain must remain:

```text
ConfirmedTaskSpec
  → RequestEnvelope
  → PlanGraphBundle
  → HarnessRun
  → NodeRun
  → NodeAttempt
  → Evidence / Event / SideEffect / Budget Settlement
  → Mission Projection
