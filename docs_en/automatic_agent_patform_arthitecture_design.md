# Enterprise-Grade Agent Platform Overall Technical Architecture Design Document

> **Document Version**: v2.7
> **Document Status**: Release
> **Previous Version**: v2.6 Release Candidate
> **Document Positioning**: Enterprise-grade / Platform-level Agent System Overall Technical Architecture Design Document (Stability-First · AI Operations Complete · Business Domain Onboarding Complete · Intelligent Interaction Complete · Organizational Governance Complete · Scaled Ecosystem Complete · Operational Maturity Complete · Production-Oriented Edition)
> **Target Audience**: Architecture Committee, Platform R&D Team, Runtime Team, SRE, Security Team, Governance Team, Business Domain Onboarding Team, AI/ML Engineering Team, Business Line Owners, Non-Technical Business Operators, Organizational Management, Compliance/Audit Team, Ecosystem Partners, Edge/On-Site Operations Team
> **Design Objective**: Build an enterprise-grade Agent platform with stability, risk control, security and reliability, and exception handling as its first principles, enabling Agents as high-risk automation units to run in enterprise environments in a controllable, recoverable, and auditable manner over the long term; meanwhile possess complete AI operations capabilities (LLM abstraction, Prompt governance, model quality, cost management) to ensure the platform is equally controllable and evolvable at the AI layer; provide structured business domain modeling and onboarding frameworks; build an intelligent interaction layer for non-technical users; establish a complete organizational governance system and scaled operational ecosystem layer; **and fill in the operational maturity layer—Agent explainability, emergency braking, unified lifecycle management, offline/edge deployment, behavior drift detection, cost attribution optimization, visual debugging, automated compliance report generation, capacity planning, multimodal capabilities, platform self-ops Agent—elevating the platform from architectural design to a truly production-ready enterprise operating system**

## v2.1 Upgrade Notes

### v2.0 Review

v2.0 addressed 14 design deficiencies on top of v1.2: added inter-plane communication contracts (§5), API contracts (§6), service communication (§7), scalability (§8), configuration governance (§24), performance SLOs (§27), disaster recovery (§31); improved risk scoring (§10), OAPEFLIR interfaces (§13), storage abstraction (§26), deployment (§32), roadmap (§33).

### v2.1 Improvement Focus

v2.0 already far exceeded the industry average at the infrastructure layer (stability, risk, state, recovery). However, as an **enterprise-grade AI Agent platform**, critical gaps existed in the AI operations layer and developer experience:

| Deficiency | Impact | v2.1 Improvement |
|------|------|----------|
| No LLM Provider abstraction | Single provider failure = entire platform unavailable, no failover | Added §15 LLM Provider Abstraction and Failover |
| No Prompt management and versioning | Agent core "source code" uncontrollable, non-rollbackable, no A/B | Added §16 Prompt Management and Versioning |
| No model evaluation and quality gates | Bad prompt/model pushed to production without safeguards | Added §17 Model Evaluation and Quality Gates |
| No cost management and Token metering | LLM costs dominate OPEX but no per-tenant metering or budget enforcement | Added §18 Cost Management and Token Metering |
| No inter-Agent delegation protocol | Complex tasks require multi-Agent collaboration but no delegation semantics | Added §19 Inter-Agent Delegation and Collaboration |
| No long-running task architecture | Hour/day-level workflows have no sleep/wake/durable timers | Added §20 Long-Running Tasks and Workflow Hibernation |
| HITL only has basic approval gates | Lacking multi-party approval, delegation, iterative feedback, timeout policies | Added §21 Human-in-the-Loop Collaboration Patterns |
| No SDK / developer experience | Business teams have no Pack development toolchain, cannot onboard | Added §22 SDK and Developer Experience |
| No compliance architecture | GDPR right-to-erasure conflicts with append-only, no data residency | Added §23 Compliance and Data Governance |
| §6 API design incomplete | Missing OAuth flows, pagination, Pack management endpoints, Webhook delivery guarantees | Improved §6 with full coverage |
| §11 security lacks threat model | No STRIDE analysis, encryption at rest, Sandbox technical specs | Improved §11 with threat model |
| §12 lacks alert routing | Incidents generated but no architecture for routing to humans | Improved §12 with alert routing and distributed Tracing |
| §27 SLO lacks Error Budget | No burn-rate alerting, no LLM latency breakdown | Improved §27 with Error Budget |
| §30 Pack lacks lifecycle | Only Manifest, missing full pipeline from development→certification→release→deprecation | Improved §30 with lifecycle and Plugin governance |

## v2.2 Upgrade Notes

### v2.1 Review

v2.1 formed a complete closed loop at the infrastructure and AI operations layers: LLM Provider abstraction (§15), Prompt management (§16), model evaluation (§17), cost management (§18), Agent delegation (§19), long-running tasks (§20), human-in-the-loop collaboration (§21), SDK/DX (§22), compliance (§23).

### v2.2 Improvement Focus

v2.1 addressed "how to build the platform" and "how to operate AI," but **did not answer the core question: once the platform is built, how does it serve the diverse business needs within the enterprise?**

Internally, 12+ vertical business lines (code development, creative asset production, ad placement, user operations, game development, live-stream commerce, enterprise knowledge base, finance, HR, customer service, security operations, data analytics) differ vastly in risk levels, knowledge structures, tool ecosystems, evaluation criteria, and Prompt strategies. The current Business Pack (§30) only defines a flat Manifest, treating business domains as opaque "packages"—**lacking a structured domain modeling framework, making it impossible for the platform to truly understand, constrain, and optimize Agent behavior across different business domains**.

| Deficiency | Impact | v2.2 Improvement |
|------|------|----------|
| No business domain abstraction model | Platform cannot distinguish domain characteristics of "financial approval" vs. "creative asset generation" | Added §37 DomainDescriptor Structured Domain Modeling |
| No domain risk profile | All businesses share the same risk_matrix, no differentiated risk control | §37.3 DomainRiskProfile Domain-Level Risk Override |
| No domain knowledge schema | Different businesses' knowledge retrieval strategies, timeliness, conflict resolution cannot be expressed | §37.4 DomainKnowledgeSchema |
| No domain evaluation framework | Code correctness vs. ad ROI vs. content compliance—cannot be unified yet differentiated | §37.5 DomainEvalFramework |
| No domain Prompt library | Business Prompts scattered everywhere, no reuse, no governance | §37.6 DomainPromptLibrary |
| No domain templates/Recipes | Similar businesses (HR/customer service) reinvent the wheel | §37.7 DomainRecipe Four Archetype Templates |
| No cross-domain interaction policy | Multi-domain Agent collaboration has no boundaries, no compensation | §37.8 DomainInteractionPolicy |
| No domain governance model | Business domain ownership, SLO, budget have no attribution | §37.9 DomainGovernancePolicy |
| No standardized onboarding process | New business onboarding relies on verbal communication, no checklist | Added §38 Four-Phase Onboarding Runbook |
| §30 only Manifest without domain semantics | Pack does not understand which business domain it belongs to | Improved §30 to associate with DomainDescriptor |

## v2.3 Upgrade Notes

### v2.2 Review

v2.2 filled in the business domain onboarding layer: DomainDescriptor structured domain modeling (§37), four-phase onboarding Runbook (§38), domain risk profile / knowledge structure / evaluation framework / Prompt library / template archetypes / cross-domain policies / governance model.

### v2.3 Improvement Focus

v2.0-v2.2 addressed **"how to build the platform" (infrastructure) → "how to operate AI" (AI operations) → "how to onboard businesses" (business domain modeling)** across three layers. But all three layers were designed for **platform engineers and technical teams**—the actual business users (non-technical operators, business line owners, even solo operators of one-person companies) **cannot directly use the platform**.

v2.2 gap analysis identified 42 gaps, of which the 6 most critical are concentrated in the **intelligent interaction layer**:

| Deficiency | Impact | v2.3 Improvement |
|------|------|----------|
| No natural language task entry | Users must hand-write JSON/API to create tasks | Added §39 Natural Language Task Entry Architecture |
| No goal decomposition engine | Users must manually decompose business goals into single-domain tasks | Added §40 Goal Decomposition Engine Architecture |
| No proactive Agents | Agents can only passively wait for API calls, cannot run autonomously | Added §41 Proactive Agent Framework |
| No progressive autonomy | automation_level is statically configured, Agents can never "earn trust" | Added §42 Progressive Autonomy Model |
| No unified operations dashboard | Only infrastructure-level metrics, no "is everything OK" business view | Added §43 Unified Operations Dashboard Architecture |
| No non-technical user UX | Only SDK+CLI, non-developers cannot use the platform | Added §44 Non-Technical User Experience Architecture |

**v2.3 Core Positioning**: On top of the three-layer foundation built in v2.0-v2.2, add an **intelligent interaction layer for end users**, upgrading the platform from "Agent infrastructure" to "Agent operating system."

```text
v2.3  ┌─────────────────────────────────────────────┐
      │  Intelligent Interaction Layer (User-Side OS)  │  ← v2.3 Added
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Onboarding Layer              │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                           │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                          │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit      │
      └─────────────────────────────────────────────┘
```

## v2.4 Upgrade Notes

### v2.3 Review

v2.3 filled in the intelligent interaction layer: natural language task entry (§39), goal decomposition engine (§40), proactive Agent framework (§41), progressive autonomy model (§42), unified operations dashboard (§43), non-technical user experience (§44).

### v2.4 Improvement Focus

v2.0-v2.3 built up layer by layer from infrastructure to intelligent interaction, but **all assumed "the organization is flat and governance is unified"**—this works for a one-person company, but is completely invalid in a 10,000-person enterprise. Large enterprises have deep organizational hierarchies from business groups → departments → teams, with different levels having different approval chains, compliance requirements, knowledge visibility, and governance autonomy.

| Deficiency | Impact | v2.4 Improvement |
|------|------|----------|
| No organizational hierarchy model | Platform only has tenant concept, cannot express department/team levels | Added §46 Organizational Hierarchy Model |
| No org-structure approval routing | Approval chains are hardcoded, cannot dynamically route based on org structure | Added §47 Organizational Structure Approval Routing |
| No SSO/SCIM integration | Every user created manually, cannot sync with enterprise directories | Added §48 Enterprise SSO/SCIM Integration |
| No per-department compliance policies | All departments share the same compliance rules, no differentiation between finance and creative departments | Added §49 Per-Department Compliance Policy Engine |
| No knowledge domain isolation | Different departments' knowledge has no boundaries, data leakage risk | Added §50 Knowledge Domain Isolation and Controlled Sharing |
| No tiered governance delegation | Platform administrators centrally control everything, cannot delegate governance to departments | Added §51 Tiered Governance Delegation |

**v2.4 Core Positioning**: On top of v2.3's intelligent interaction layer, add an **organizational governance layer**, enabling the platform to adapt to organizational complexity from one-person companies to 10,000-person enterprises.

```text
v2.4  ┌─────────────────────────────────────────────┐
      │  Organizational Governance Layer               │  ← v2.4 Added
      │  Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation│
      ├─────────────────────────────────────────────┤
v2.3  │  Intelligent Interaction Layer (User-Side OS)  │
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Onboarding Layer              │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                           │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                          │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit      │
      └─────────────────────────────────────────────┘
```

## v2.5 Upgrade Notes

### v2.4 Review

v2.4 filled in the organizational governance layer: organizational hierarchy model (§46), organizational structure approval routing (§47), enterprise SSO/SCIM integration (§48), per-department compliance policy engine (§49), knowledge domain isolation and controlled sharing (§50), tiered governance delegation (§51).

### v2.5 Improvement Focus

v2.0-v2.4 built a **complete five-layer architecture from infrastructure → AI operations → business domain onboarding → intelligent interaction → organizational governance**, but all five layers assumed "running in a single data center with limited concurrency." When enterprises deploy across Regions, run thousands of concurrent workflows, and have multiple business lines competing for resources, **scaled operational guarantees** are needed. Meanwhile, as the platform evolves from a closed system to an open ecosystem, it needs an Agent marketplace, feedback-driven improvement, and an external system integration framework.

| Deficiency | Impact | v2.5 Improvement |
|------|------|----------|
| No multi-Region deployment | Single data center failure = entire platform unavailable | Added §52 Multi-Region Deployment Architecture |
| No resource contention management | High-priority tasks blocked by low-priority tasks | Added §53 Scaled Resource Contention Management |
| No SLA tiered guarantees | All tasks treated equally, no differentiated service commitments | Added §54 SLA Tiered Guarantees |
| No Agent marketplace | All Agents/Packs developed internally, cannot leverage ecosystem | Added §55 Agent Marketplace and Ecosystem |
| No feedback-driven improvement | User feedback has no closed loop, platform cannot self-optimize | Added §56 Feedback-Driven Continuous Improvement Pipeline |
| No external system integration framework | Each external system integration is ad-hoc, no unified pattern | Added §57 External System Integration Framework |

**v2.5 Core Positioning**: Fill in the **scaled operations layer and ecosystem layer**, giving the platform cross-Region high availability, fair resource scheduling, differentiated SLA guarantees, an open ecosystem, and continuous self-improvement capabilities.

```text
v2.5  ┌─────────────────────────────────────────────┐
      │  Scaled Operations Layer + Ecosystem Layer     │  ← v2.5 Added
      │  Multi-Region · Resource Contention · SLA · Marketplace · Feedback · Integration  │
      ├─────────────────────────────────────────────┤
v2.4  │  Organizational Governance Layer               │
      │  Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation│
      ├─────────────────────────────────────────────┤
v2.3  │  Intelligent Interaction Layer (User-Side OS)  │
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Onboarding Layer              │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                           │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                          │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit      │
      └─────────────────────────────────────────────┘
```

## v2.6 Upgrade Notes

### v2.5 Review

v2.5 filled in the scaled operations and ecosystem layer: multi-Region deployment (§52), resource contention management (§53), SLA tiered guarantees (§54), Agent marketplace (§55), feedback-driven improvement (§56), external system integration (§57).

### v2.6 Improvement Focus

v2.0-v2.5 built a **complete six-layer architecture** from infrastructure to ecosystem, but all focused on the "construction layer"—solving the "how to build" problem. Benchmarked against truly production-ready enterprise platforms, the "operational maturity layer" is missing—solving the "how to use well" and "how to run safely" problems.

v2.5 gap analysis identified 20 gaps, of which the 11 most critical are concentrated in the **operational maturity layer**:

| Deficiency | Impact | v2.6 Improvement |
|------|------|----------|
| No decision explainability | Users cannot understand Agent decision reasons, EU AI Act compliance gap | Added §59 Agent Explainability and Decision Transparency |
| No emergency braking | No way to instantly stop all platform Agents during security incidents | Added §60 Emergency Braking and Global Circuit Breaking |
| No Agent unified entity | Agent is a loose component combination, no composite versioning or lifecycle management | Added §61 Agent Unified Lifecycle Management |
| No offline/edge deployment | Factory/store/mobile scenarios cannot use the platform, excluding entire industry verticals | Added §62 Offline and Edge Deployment Architecture |
| No behavior drift detection | Agent gradual behavior escapes quality thresholds but has fundamentally changed | Added §63 Agent Behavior Drift Detection |
| No cost attribution and optimization | Cost data is viewable but not actionable, cannot guide optimization | Added §64 Cost Attribution and Optimization Engine |
| No visual debugging | Workflow failures require reading raw logs, no debugging experience | Added §65 Workflow Visual Debugger |
| No automated compliance report generation | Evidence exists but cannot be automatically assembled into audit reports | Added §66 Compliance Report Auto-Generation Engine |
| No capacity planning prediction | No predictive scaling recommendations, scaling timing relies on guesswork | Added §67 Capacity Planning and Cost Prediction |
| No multimodal capabilities | ModelGateway is text-only, cannot process images/voice/documents | Added §68 Multimodal Capabilities Architecture |
| No platform self-ops | All operations depend on human SRE, one-person companies have no SRE team | Added §69 Platform Self-Operations Agent |

**v2.6 Core Positioning**: Fill in the **operational maturity layer**, upgrading the platform from "architecturally design-complete" to "production-operations-ready."

```text
v2.6  ┌─────────────────────────────────────────────┐
      │  Operational Maturity Layer                    │  ← v2.6 Added
      │  Explainability · Emergency Braking · Lifecycle · Edge · Drift Detection  │
      │  Cost Optimization · Debugger · Compliance Reports · Capacity · Multimodal    │
      ├─────────────────────────────────────────────┤
v2.5  │  Scaled Operations Layer + Ecosystem Layer     │
      │  Multi-Region · Resource Contention · SLA · Marketplace · Feedback · Integration  │
      ├─────────────────────────────────────────────┤
v2.4  │  Organizational Governance Layer               │
      │  Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation│
      ├─────────────────────────────────────────────┤
v2.3  │  Intelligent Interaction Layer (User-Side OS)  │
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Onboarding Layer              │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                           │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                          │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit      │
      └─────────────────────────────────────────────┘
```

---

# Table of Contents

1. [Document Overview](#1-document-overview)
2. [Platform Root Assumptions and Design Objectives](#2-platform-root-assumptions-and-design-objectives)
3. [Platform Definition and Non-Goals](#3-platform-definition-and-non-goals)
4. [Overall Architecture: Five Planes + One Cross-Cutting Control Fabric](#4-overall-architecture-five-planes--one-cross-cutting-control-fabric)
5. [Inter-Plane Communication Contracts](#5-inter-plane-communication-contracts)
6. [API Contracts and Versioning Architecture](#6-api-contracts-and-versioning-architecture)
7. [Service Communication Architecture](#7-service-communication-architecture)
8. [Scalability Architecture](#8-scalability-architecture)
9. [Stability Architecture](#9-stability-architecture)
10. [Risk Control Architecture](#10-risk-control-architecture)
11. [Security and Reliability Architecture](#11-security-and-reliability-architecture)
12. [Exception Event Handling Architecture](#12-exception-event-handling-architecture)
13. [OAPEFLIR Controlled Cognitive Kernel](#13-oapeflir-controlled-cognitive-kernel)
14. [Runtime Execution Plane](#14-runtime-execution-plane)
15. [LLM Provider Abstraction and Failover Architecture](#15-llm-provider-abstraction-and-failover-architecture)
16. [Prompt Management and Versioning Architecture](#16-prompt-management-and-versioning-architecture)
17. [Model Evaluation and Quality Gate Architecture](#17-model-evaluation-and-quality-gate-architecture)
18. [Cost Management and Token Metering Architecture](#18-cost-management-and-token-metering-architecture)
19. [Inter-Agent Delegation and Collaboration Architecture](#19-inter-agent-delegation-and-collaboration-architecture)
20. [Long-Running Tasks and Workflow Hibernation Architecture](#20-long-running-tasks-and-workflow-hibernation-architecture)
21. [Human-in-the-Loop Collaboration Pattern Architecture](#21-human-in-the-loop-collaboration-pattern-architecture)
22. [SDK and Developer Experience Architecture](#22-sdk-and-developer-experience-architecture)
23. [Compliance and Data Governance Architecture](#23-compliance-and-data-governance-architecture)
24. [Configuration Governance Architecture](#24-configuration-governance-architecture)
25. [Data and State Consistency Architecture](#25-data-and-state-consistency-architecture)
26. [Storage Architecture](#26-storage-architecture)
27. [Performance Architecture and SLOs](#27-performance-architecture-and-slos)
28. [Event / Projection / Incident / DLQ Model](#28-event--projection--incident--dlq-model)
29. [Knowledge / Memory / Artifact / Learning Boundaries](#29-knowledge--memory--artifact--learning-boundaries)
30. [Business Onboarding Constraints and Business Pack Model](#30-business-onboarding-constraints-and-business-pack-model)
31. [Disaster Recovery and High Availability Architecture](#31-disaster-recovery-and-high-availability-architecture)
32. [Deployment Architecture](#32-deployment-architecture)
33. [Phased Implementation Roadmap](#33-phased-implementation-roadmap)
34. [ADR Freeze Recommendations](#34-adr-freeze-recommendations)
35. [Recommended Code Directory](#35-recommended-code-directory)
36. [Risks, Constraints, and Success Criteria](#36-risks-constraints-and-success-criteria)
37. [Business Domain Modeling and Onboarding Architecture](#37-business-domain-modeling-and-onboarding-architecture)
38. [Business Domain Onboarding Runbook](#38-business-domain-onboarding-runbook)
39. [Natural Language Task Entry Architecture](#39-natural-language-task-entry-architecture)
40. [Goal Decomposition Engine Architecture](#40-goal-decomposition-engine-architecture)
41. [Proactive Agent Framework](#41-proactive-agent-framework)
42. [Progressive Autonomy Model](#42-progressive-autonomy-model)
43. [Unified Operations Dashboard Architecture](#43-unified-operations-dashboard-architecture)
44. [Non-Technical User Experience Architecture](#44-non-technical-user-experience-architecture)
46. [Organizational Hierarchy Model](#46-organizational-hierarchy-model)
47. [Organizational Structure Approval Routing](#47-organizational-structure-approval-routing)
48. [Enterprise SSO/SCIM Integration Architecture](#48-enterprise-ssoscim-integration-architecture)
49. [Per-Department Compliance Policy Engine](#49-per-department-compliance-policy-engine)
50. [Knowledge Domain Isolation and Controlled Sharing](#50-knowledge-domain-isolation-and-controlled-sharing)
51. [Tiered Governance Delegation](#51-tiered-governance-delegation)
52. [Multi-Region Deployment Architecture](#52-multi-region-deployment-architecture)
53. [Scaled Resource Contention Management](#53-scaled-resource-contention-management)
54. [SLA Tiered Guarantees](#54-sla-tiered-guarantees)
55. [Agent Marketplace and Ecosystem](#55-agent-marketplace-and-ecosystem)
56. [Feedback-Driven Continuous Improvement Pipeline](#56-feedback-driven-continuous-improvement-pipeline)
57. [External System Integration Framework](#57-external-system-integration-framework)
59. [Agent Explainability and Decision Transparency Architecture](#59-agent-explainability-and-decision-transparency-architecture)
60. [Emergency Braking and Global Circuit Breaking Architecture](#60-emergency-braking-and-global-circuit-breaking-architecture)
61. [Agent Unified Lifecycle Management Architecture](#61-agent-unified-lifecycle-management-architecture)
62. [Offline and Edge Deployment Architecture](#62-offline-and-edge-deployment-architecture)
63. [Agent Behavior Drift Detection Architecture](#63-agent-behavior-drift-detection-architecture)
64. [Cost Attribution and Optimization Engine](#64-cost-attribution-and-optimization-engine)
65. [Workflow Visual Debugger Architecture](#65-workflow-visual-debugger-architecture)
66. [Compliance Report Auto-Generation Engine](#66-compliance-report-auto-generation-engine)
67. [Capacity Planning and Cost Prediction Engine](#67-capacity-planning-and-cost-prediction-engine)
68. [Multimodal Capabilities Architecture](#68-multimodal-capabilities-architecture)
69. [Platform Self-Operations Agent Architecture](#69-platform-self-operations-agent-architecture)
70. [Conclusion](#70-conclusion)
[Appendix G: Glossary and Acronym Index](#appendix-g-glossary-and-acronym-index)
[Appendix A: Version Change History](#appendix-a-version-change-history)

---

# 1. Document Overview

## 1.1 Background

Enterprise expectations of Agents have evolved from "Q&A systems" to intelligent automation platforms that "can integrate with systems, run processes, execute actions, be governed, be audited, and continuously evolve."

However, most Agent systems still have obvious engineering shortcomings:

* Default to trusting model outputs
* Default to assuming tool calls will succeed
* Default to assuming external systems are available
* Default to assuming workflows just run once orchestrated
* Default to assuming exceptions only need logging
* Default to assuming post-deployment behavior is acceptable

None of these assumptions hold in enterprise production environments.

The first challenge for enterprise-grade Agent platforms is not "insufficient capability" but "excessive risk of loss of control."
Therefore, this architecture version foregrounds the following problems as primary design targets:

* How the system avoids losing control during failures
* How high-risk actions are identified and constrained
* How to degrade when external dependencies fail
* How to recover after worker crashes
* How side effects are controlled and attributed
* How to roll back failed releases
* How to rebuild divergent projections
* How the system safely pauses when approvals are delayed

## 1.2 Document Objectives

* Define an overall architecture for a stability-first enterprise-grade Agent platform
* Establish design principles premised on "default untrusted, default will fail"
* Elevate stability, risk, security, and exception handling to first-class platform architecture concerns
* Define the five-plane + cross-cutting fabric system structure, **with formal inter-plane interface protocols**
* Restructure Runtime as a controllable, recoverable, degradable, auditable execution system
* **Provide an actionable, incremental evolution path** rather than an all-at-once ideal state
* Provide a baseline for subsequent detailed design, schemas, ADRs, and phased implementation

## 1.3 Non-Goals

* Prompt details for individual business Agents
* Interface implementation specifics for individual plugins or adapters
* UI interaction visual mockups
* Integration implementation for specific model providers
* Complete domain model for a specific business domain
* Infrastructure physical topology and procurement plans

---

# 2. Platform Root Assumptions and Design Objectives

## 2.1 Platform Root Assumptions

This platform assumes by default that all of the following will occur:

* Agents will make mistakes
* Tools will fail
* External systems will timeout
* Workers will crash
* Models will produce incorrect outputs
* Configurations will be misconfigured
* Approvals will be delayed
* Events will be duplicated
* Projections will lag
* Releases will be rolled back

Therefore, the platform must be designed around a single principle:

> **Default untrusted, default will fail, default must be controllable, recoverable, and auditable.**

## 2.2 Platform Design Constitution

### Default Untrusted

* Model outputs are untrusted
* Plugins are untrusted
* External dependencies are untrusted
* Inputs are untrusted
* Knowledge may be stale
* Learning results may be noisy

### Default Will Fail

* Remote calls will timeout
* Workers will miss heartbeats
* Event fanout will fail
* Projections will lag
* Rollouts will fail
* Repair / replay may also fail

### Default Conservative

Actions not explicitly allowed default to the conservative path: deny / degrade / require approval / supervised / no-write / no-external / manual-only.

### Recoverable First, Then Automate

Automation without replay / repair / rebuild / rollback capabilities should not enter critical flows.

### State and Evidence Are Equally Important

The platform must not only "get things done" but also record: who triggered it, why it was executed, what context was used, which systems were called, what side effects were produced, and how recovery was handled after failure.

## 2.3 Eight Hard Objectives

1. **Stable Operation**: Even if some components fail, the platform must not lose control as a whole
2. **Risk Isolation**: High-risk actions must be identified, classified, isolated, approved, and rollbackable
3. **Secure Default Convergence**: Capabilities not explicitly allowed are forbidden by default, no fail-open
4. **Exception Recovery**: When critical paths are interrupted, either resume recovery, safely terminate, or hand off to humans
5. **Data Traceability**: Every critical action can be traced to its trigger, rationale, context, result, and side effects
6. **Controlled Releases**: Changes to workflows, agents, packs, plugins, and policies must support canary deployment and rollback
7. **Multi-Tenant Security**: No data, permission, or execution environment leakage between different tenants, teams, projects, and business domains
8. **Business Extensibility Without Core Intrusion**: New business onboarding must not compromise the platform's stability and security model

---

# 3. Platform Definition and Non-Goals

## 3.1 Platform Definition

> A controlled automation platform for enterprise environments with stability-first as its core principle.
> It treats Agents as high-risk automation units and applies strict control, isolation, recovery, auditing, and governance through five architectural planes and one cross-cutting control fabric.

## 3.2 What It Is Not

* **Not a single chatbot** — Chat is just one of many entry points
* **Not a pure Workflow Engine** — Workflows alone do not address governance, recovery, approval, or auditing
* **Not a pure Tool Calling shell** — Tools are merely execution means
* **Not a thin application of "Prompt + model + a few tools"** — Lacks isolation, governance, and recovery
* **Not a "more automation is always better" system** — The platform pursues **controlled automation**

---

# 4. Overall Architecture: Five Planes + One Cross-Cutting Control Fabric

## 4.1 Architecture Overview Diagram

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
│         X1 Reliability & Security Fabric (Cross-Cutting)     │
│     AuthN/Z · Sandbox · Circuit Breaker · DLQ · Backpressure │
└──────────────────────────────────────────────────────────────┘
```

## 4.2 P1 Interface Plane

External access layer.

**Includes**: API Gateway / Webhook / Scheduler trigger / Admin Console backend / External event ingress

**Responsibilities**: Input validation · Authentication · Rate limiting · Request deduplication · Basic routing · Attachment referencing · Idempotency key handling

**Not responsible for**: Executing business logic · Modifying core state · Bypassing the control plane to directly call executors

**v2.0 Improvement**: P1 must expose standardized API contracts (see §6). All requests entering the platform must be encapsulated in a unified RequestEnvelope containing trace_id, idempotency_key, principal, and tenant_id.

## 4.3 P2 Control Plane

Control and governance layer; the governance shell of the platform.

**Includes**: policy engine / approval engine / rollout control / replay & repair control / incident control / tenant admin / audit export / config center / exception management

**Responsibilities**: Definition and version governance · Approval and autonomy boundary control · Risk and budget guardrails · Release, canary, rollback · Incident escalation and disposition · Operational control for repair / replay / rebuild

**v2.0 Improvement**: P2 sends instructions to P3/P4 via ControlDirective rather than directly manipulating underlying state. Directive types include: ModeSwitchDirective / PauseDirective / RollbackDirective / QuotaAdjustDirective.

## 4.4 P3 Orchestration Plane

Orchestration and decision layer.

**Includes**: OAPEFLIR loop / workflow orchestration / planning & replanning / step scheduler / routing & escalation

**Responsibilities**: Decide what to do · Decide who executes next · Decide when to pause · Decide when to escalate to humans · Decide when to replan, degrade, or terminate

**v2.0 Improvement**: P3 outputs a standardized ExecutionPlan (see §13 interface contracts). All decisions must be serializable, auditable, and replayable.

## 4.5 P4 Execution Plane

Unified execution layer.

**Includes**: scheduler / dispatcher / execution engine / worker pool / tool executor / plugin executor / adapter executor / browser executor / human wait executor / recovery workers

**Responsibilities**: Actually execute actions · Acquire and maintain leases · Write back execution results · Propose and commit side effects · Trigger recovery actions upon failure

**v2.0 Improvement**: P4 must report execution results to P3/P5 via ExecutionReceipt. Receipt includes status / duration / side_effects / evidence_refs / error_detail.

## 4.6 P5 State & Evidence Plane

State and evidence plane.

**Includes**: truth tables / event log / artifact store / memory / knowledge / audit / projections / checkpoints / evidence bundles / incident records / DLQ records

**Responsibilities**: Preserve current control truth · Retain historical change trajectories · Support recovery and replay · Retain audit evidence · Support console queries

**v2.0 Improvement**: P5 is exposed through a unified Repository interface. Upper layers do not directly manipulate storage implementations. The Repository interface supports multi-backend switching (see §26).

## 4.7 X1 Reliability & Security Fabric

Life support system spanning all planes.

**Includes**: authn/authz / sandbox / secrets / egress control / quotas / circuit breakers / timeouts / retries / rate limits / health checks / anomaly detection / backpressure / DLQ / incident hooks

**Positioning**: This is not an auxiliary capability but the platform's foundational life support system. Each X1 capability is injected into each plane via middleware / interceptor / decorator patterns, not deployed as an independent service.

---

# 5. Inter-Plane Communication Contracts

> v1.2 defined five planes but did not define inter-plane interface protocols. v2.0 formalizes inter-plane communication.

## 5.1 Design Principles

* Planes may only communicate through **formal contract objects**; direct calls to another plane's internal implementation are forbidden
* Every contract object is **serializable, auditable, and replayable**
* Synchronous calls use typed interfaces; asynchronous notifications use domain events

## 5.2 Inter-Plane Contract Matrix

| Caller → Callee | Contract Object | Communication Method | Description |
|----------------|---------|---------|------|
| P1 → P2 | `RequestEnvelope` | Sync | All requests go through P2 for policy/admission checks first |
| P2 → P3 | `ControlDirective` | Sync/Event | Mode switching, pause, quota adjustment |
| P3 → P4 | `ExecutionPlan` | Sync | Standard execution plan from orchestration to execution layer |
| P4 → P3 | `ExecutionReceipt` | Sync | Execution results reported back to orchestration layer |
| P4 → P5 | `StateCommand` | Sync | Write truth tables, append events |
| P3 → P5 | `EvidenceRecord` | Async | Decision evidence write |
| P2 → P4 | `ControlDirective` | Sync | Emergency braking/mode switch direct to execution layer (§4.3 mentioned, §60 emergency braking scenario) |
| P5 → P2 | `ProjectionUpdate` | Event | Projection change notifications to control plane |
| Any → X1 | middleware injection | AOP | Not through explicit calls, via decorators/interceptors |

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

## 5.4 Contract Compliance Rules

1. **No Bypass**: P1 cannot skip P2 to directly call P4
2. **No Reverse**: P5 cannot send directives to P4 (can only be read/written)
3. **Must Be Signed**: Every contract object must contain principal and trace_id
4. **Must Be Idempotent**: All StateCommands must use CAS based on expected_version
5. **Must Be Replayable**: All contract objects must be serializable to JSON

---

# 6. API Contract and Versioned Architecture

> v1.2 did not define platform-facing APIs. v2.0 elevates API as a first-class architectural concern.

## 6.1 API Layering

| API Layer | Target Audience | Protocol | Authentication |
|--------|------|------|---------|
| Public API | Business systems, CI/CD | REST + WebSocket | API Key + JWT |
| Admin API | Operations staff, console | REST | JWT + RBAC |
| Internal API | Inter-plane calls | typed interface (in-process) or gRPC (cross-process) | mTLS / service token |
| Plugin API | Plugins / adapters | IPC / sandbox boundary | capability token |

## 6.2 Public API Design Conventions

* Resource naming uses kebab-case plural form: `/api/v1/workflow-runs`
* All write operations must carry an `Idempotency-Key` header
* All responses include `X-Request-Id` and `X-Trace-Id`
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

## 6.3 API Resource Overview

| Resource | Methods | Description |
|------|------|------|
| `/api/v1/tasks` | POST / GET | Create task, query task list |
| `/api/v1/tasks/{id}` | GET / DELETE | Query/cancel a single task |
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
| `/ws/v1/stream` | WebSocket | Real-time event stream |

## 6.4 Version Compatibility Strategy

* API versions are distinguished via URL path (`/api/v1/`, `/api/v2/`)
* Within the same major version, only **backward-compatible** changes are allowed (adding fields, adding endpoints)
* Breaking changes must bump the major version; the old version must be maintained for at least 6 months
* Event schema uses a `schema_version` field; consumers dispatch by version
* Internal TypeScript interface changes are validated at runtime via Zod schema

## 6.5 Authentication Flow

**API Key + JWT Dual Mode**:

| Scenario | Authentication Method | Description |
|------|---------|------|
| Service-to-service calls | API Key (Header: `X-API-Key`) | Long-lived, issued per tenant |
| User operations | JWT (Header: `Authorization: Bearer`) | Issued via OAuth2 / OIDC, short-lived |
| Console | JWT + CSRF token | Browser security protection |
| Webhook callbacks | HMAC signature verification | `X-Signature-256` header |

**Token Lifecycle**: access_token TTL = 15min, refresh_token TTL = 24h, API key supports manual rotation.

## 6.6 Pagination and Filtering

* List endpoints uniformly use cursor-based pagination: `?cursor=xxx&limit=20`
* Response includes `next_cursor`; when null it indicates the last page
* Filtering uses query parameters: `?status=running&tenant_id=xxx&created_after=2026-01-01`
* Sorting: `?sort=created_at:desc`
* Maximum 100 items per page

## 6.7 Webhook Delivery Guarantees

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
* Each delivery includes `X-Webhook-Id` (idempotency key) and `X-Signature-256` (HMAC signature)
* A 2xx response from the target is considered success; otherwise retries follow retry_policy
* After > 50 consecutive failures, the subscription is automatically disabled and the tenant admin is notified

---

# 7. Service Communication Architecture

> v1.2 did not define inter-service communication. v2.0 specifies three communication modes and their applicable scenarios.

## 7.1 Three Communication Modes

### Synchronous Request/Response

Applicable: P1→P2 admission check, P3→P4 dispatch, P4→P5 truth write

Requirements:
* Must set timeout (default 5s, max 30s)
* Must have fallback (degradation / reject / queue)
* Must have circuit breaker protection

### Asynchronous Event Notification

Applicable: P4→P5 event append, P5→P2 projection update, P4→X1 incident hook

Requirements:
* Use outbox pattern to guarantee at-least-once
* Consumer must be idempotent (deduplicate based on event_id)
* Failed events go to DLQ

### Streaming Push

Applicable: P5→P1 real-time event stream (WebSocket), worker heartbeat

Requirements:
* Auto-reconnect on disconnect + resume from last_event_id
* Server-side backpressure (drop low-priority events when buffer is full)

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

1. Business operation and event write are completed in the **same database transaction**
2. An independent outbox poller asynchronously reads unsent events
3. Marks as sent after successful delivery
4. Transfers to DLQ after exceeding the failure threshold
5. The poller itself runs as a single instance via lease mechanism

## 7.4 In-Process vs Cross-Process

| Phase | Communication Method | Description |
|------|---------|------|
| Phase 1 (Monolith) | In-process typed interface calls | All planes in the same process |
| Phase 2 (Initial Split) | In-process + Redis pub/sub | Event channel made asynchronous |
| Phase 3 (Microservices) | gRPC + event bus | Planes deployed independently |

This ensures a smooth evolution from monolith to microservices, rather than requiring 18 services from the start.

---

# 8. Scalability Architecture

> v1.2 did not cover horizontal scaling. v2.0 defines scaling strategies from single node to cluster.

## 8.1 Scaling Dimensions

| Dimension | Scaling Strategy | Trigger Condition |
|------|---------|---------|
| Worker concurrency | Add worker processes/containers | Queue backlog > threshold |
| Storage capacity | SQLite → PostgreSQL → sharding/archiving | Data volume > threshold |
| Event throughput | Partition by tenant_id | Event rate > single poller capacity |
| API throughput | API Gateway horizontal scaling | QPS > single instance limit |
| Projection latency | Add projector instances | Projection lag > SLO |

## 8.2 Statelessness Principle

* P1 / P3 / P4 are designed as stateless; all persistent state is stored in P5
* Workers avoid state binding via lease mechanism
* Session state is persisted via checkpoints, not held in memory
* Any process can be killed and recovered on another node

## 8.3 Sharding Strategy

When a single node is insufficient, shard along these dimensions:

* **dispatch queue**: shard by tenant_id hash
* **event outbox**: partition by aggregate_type
* **projection rebuild**: parallelize by projection_name
* **worker pool**: partition by capability_class (coding / operations / browser)

## 8.4 Scaling Stages

| Stage | Architecture | Supported Scale |
|------|------|---------|
| S1 Monolith | Single process + SQLite | 10 concurrent workflows, 5 workers |
| S2 Multi-process | Main process + worker processes + Redis | 50 concurrent, 20 workers |
| S3 Distributed | Microservices + PostgreSQL + event bus | 500 concurrent, 100 workers |
| S4 Cluster | Kubernetes + PG sharding + multi-AZ | 5000+ concurrent |

---

# 9. Stability Architecture

> Retains the seven-layer model from v1.2. v2.0 adds **automation mechanisms** and **trigger rules** for each layer.

## 9.1 Stability Layer 1: Isolation

**Isolation Dimensions**: tenant · project · domain · worker pool · executor · adapter · browser session · plugin process

**Design Requirements**: coding and operations in separate pools · high-risk adapters in dedicated pools · browser executor must not share a pool with regular tool executors · high-risk tenants can have dedicated resource pools

**v2.0 Automation**: When a tenant's failure rate > 30%, automatically isolate that tenant to a dedicated worker pool without affecting other tenants.

## 9.2 Stability Layer 2: Rate Limiting and Backpressure

**Rate Limiting Points**: API ingress rate limit · per-tenant concurrency · per-workflow active · per-worker max concurrency · per-adapter QPS · per-tool burst · approval queue inflow

**Backpressure Strategy**: queue delay → reject low priority → degrade to supervised → stop non-critical workflows → freeze rollout → restrict external calls

**v2.0 Automation**: Backpressure strategy **auto-escalates by gradient**:

```text
Level 0 (Normal)     → queue_lag < 10s
Level 1 (Warning)    → queue_lag 10-30s → delay low priority
Level 2 (Throttle)   → queue_lag 30-60s → reject low priority + supervised mode
Level 3 (Protection) → queue_lag > 60s  → only allow critical workflow + manual_only
```

## 9.3 Stability Layer 3: Timeout and Retry

**Three-tier Timeout**: step timeout · attempt timeout · tool/adapter timeout

**Retry Rules**:
* Only retryable failures are automatically retried
* Only idempotent operations are eligible for automatic retry
* Backoff strategy: exponential backoff with jitter, base=1s, max=60s
* After retries are exhausted, enters explicit `retry_exhausted` state, triggering escalation

## 9.4 Stability Layer 4: Circuit Breaker

**Circuit Breaker Targets**: third-party APIs · external adapters · model providers · high-failure-rate tools · plugin runtime

**State Machine**: closed → open (failure_rate > 50% in 60s window) → half-open (small traffic probe after 30s) → closed

**v2.0 Improvement**: Circuit breaker state changes must emit a `circuit_breaker.state_changed` event, triggering alerts and mode switching evaluation.

## 9.5 Stability Layer 5: Degradation Modes

**Official Modes**: full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

**v2.0 Automation**: Mode switching is issued via `ControlDirective`, with support for auto-trigger rules:

| Trigger Condition | Auto-Switch To |
|---------|-----------|
| worker pool unhealthy > 50% | supervised_auto |
| external adapter circuit open | no-external-call |
| security incident detected | incident-mode |
| rollout guardrail breach | no-rollout |
| approval backlog > 100 | manual_only (pause new workflows) |

## 9.6 Stability Layer 6: Recovery Capability

**Recovery Components**: lease reclaim · execution recovery · workflow recovery · replay · repair · projection rebuild · stuck-run sweeper

**v2.0 Improvement**: Each recovery component must have an independent health check and report recovery success rate to the Control Plane via `RecoveryReport`.

## 9.7 Stability Layer 7: Observability

**Minimum Capabilities**: metrics · structured logs · traces · audit · event timeline · health snapshot

**v2.0 Improvement**: Defines core observability metrics (see §27 Performance and SLO).

---

# 10. Risk Control Architecture

> Retains the quadrant model from v1.2. v2.0 adds a **risk scoring algorithm** and an **automated risk control engine**.

## 10.1 Risk Model Quadrant

* **R1 Execution Risk**: incorrect execution · duplicate execution · concurrency conflicts · stale write
* **R2 Business Risk**: incorrect code changes · incorrect traffic shifting · incorrect notifications · incorrect releases
* **R3 Security Risk**: unauthorized access · data leakage · secret exposure · unauthorized outbound connections
* **R4 Platform Risk**: rollout out of control · projection drift · replay misoperation · worker pool avalanche

## 10.2 Risk Scoring Algorithm

> v1.2 only provided four levels "low/medium/high/critical" without explaining how to calculate them. v2.0 defines the scoring formula.

```text
risk_score = Σ(factor_weight × factor_value) / max_possible_score

Factor weights:
  step_type_risk:      weight=3  (read=1, write=3, delete=5, external_call=4)
```
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

## 10.3 Risk Automatic Control Engine

```text
RiskAssessmentRequest
  → Calculate risk_score
  → Query tenant risk policy overrides
  → Determine risk_level
  → Match risk_action_rule
  → Output RiskDecision { level, actions[], requires_approval, evidence_level }
```

**Risk Control Action Matrix**:

| risk_level | Auto Execute | Log Level | Approval | side effect | evidence |
|-----------|---------|---------|------|------------|---------|
| low | ✅ | info | No | Normal | Basic |
| medium | ✅ | warn | No | Normal + Validation | Enhanced |
| high | ❌ | error | Required | Restricted | Full |
| critical | ❌ | critical | break-glass | Prohibited | Legal-grade |

## 10.4 Risk Mitigation Mechanisms

sandbox mode · read_only mode · write_limited mode · approval gate · dry_run · shadow mode · canary · rollback plan mandatory · evidence bundle mandatory

---

# 11. Security & Reliability Architecture

## 11.1 Unified Identity Model

All actions must have a principal.

**Principal types**: user · service · agent · worker · plugin · system

**Requirements**: All event / audit / decision / incident are associated with a principal. All incidents can be traced back through the principal chain.

## 11.2 Unified Authorization Model

Three layers:

* **RBAC**: Role-level permissions
* **Capability**: Capability-level permissions (can_run_browser / can_use_prod_adapter / can_approve_release / can_replay_events)
* **Context-aware policy**: Dynamic decisions combining tenant / project / workflow / environment / risk level / data class

**v2.0 Improvement**: Authorization decisions are recorded as `PolicyOutcome`, containing decision / matched_rules / evaluation_duration, supporting audit and policy tuning.

## 11.3 Secret Security

* Secrets are only allowed by reference, never passed in plaintext
* Secret injection is short-lived (TTL ≤ 300s)
* Secrets must not enter memory / knowledge
* Artifact output undergoes secret scan before release
* logs / traces / audit all undergo unified secret redaction

## 11.4 Sandbox Security

Four tiers: read_only · workspace_write · scoped_external_access · restricted_exec

Any high-risk action should not have direct full access.

**Technical Implementation Specification**:

| Sandbox Tier | Isolation Technology | File System | Network | Process | Resource Limits |
|-------------|---------|---------|------|------|---------|
| read_only | Subprocess + seccomp | Read-only mount | Prohibited | Single process | 256MB / 10s |
| workspace_write | Subprocess + seccomp | tmpfs write + workspace write | Prohibited | Single process | 512MB / 30s |
| scoped_external_access | Container (optional) | tmpfs write | egress allowlist only | Multi-process | 1GB / 60s |
| restricted_exec | Container | overlay fs | egress allowlist | Multi-process | 2GB / 300s |

## 11.5 Network Egress Security

All external calls go through egress control. Control dimensions: destination allowlist · adapter binding · credential binding · data class · environment · operation type. Egress deny must be recorded as a formal security event.

## 11.6 Data Classification

Base classification: public · internal · confidential · restricted

Extended labels: pii · regulated · secret-bearing

Classification impact: Whether it can enter the model · Whether it can be sent externally · Whether it can enter knowledge · Whether approval is required

## 11.7 Plugin Security

Plugins are treated as untrusted extensions. Requirements: independent process · resource limits · IPC boundary · capability whitelist · output validation · crash isolation · can be quarantined · can be hot-disabled.

## 11.8 Threat Model (STRIDE)

| Threat | Attack Surface | Mitigation Measures |
|------|--------|---------|
| **S**poofing | API calls, Agent identity | JWT/API Key authentication + Principal chain tracing |
| **T**ampering | event log, artifact, prompt | append-only event + CAS + content hash verification |
| **R**epudiation | Operations not traceable | Full-chain audit + evidence bundle + immutable audit log |
| **I**nformation Disclosure | Prompt leakage, Secret leakage, PII | Secret redaction + data classification + Prompt not exposed to end users |
| **D**enial of Service | API overload, Worker exhaustion | Rate limiting + backpressure + per-tenant quota + circuit breaker |
| **E**levation of Privilege | Plugin privilege escalation, Agent privilege escalation | Sandbox tier + capability whitelist + context-aware policy |

**v2.1 New Threats**:

| Threat | Attack Surface | Mitigation Measures |
|------|--------|---------|
| Prompt Injection | User input injecting malicious instructions | Input sanitization + output validation + Sandbox restrictions |
| Model Manipulation | Malicious fine-tune / jailbreak | Quality gate (§17) + output security checks |
| Data Exfiltration via LLM | Model memorizing sensitive data | data_classification routing (§15.3) + PII not entering model |

## 11.9 Encryption Strategy

Transport encryption, storage encryption, and Key management are detailed in §23.5 Encryption Architecture. This section emphasizes security layer constraints:

* All inter-plane communication must use TLS 1.3 (except intra-process)
* PII fields stored in P5 must have application-level encryption (not relying on database TDE)
* Secret storage integrates with Vault (or equivalent KMS); the application layer only holds references
* Audit logs must include integrity signatures (HMAC) to prevent post-hoc tampering

---

# 12. Exception Event Handling Architecture

> Retains v1.2's E1-E6 classification and SEV1-4 severity levels. v2.0 adds **observability data model** and **automatic detection rules**.

## 12.1 Exception Event Classification

* **E1 Business Exceptions**: validation fail · wrong output · no result · low confidence
* **E2 Execution Exceptions**: timeout · worker crash · lease expired · retry exhausted
* **E3 External Dependency Exceptions**: adapter failure · provider timeout · rate limit · circuit open
* **E4 Security Exceptions**: unauthorized access · secret leak risk · egress deny · policy violation
* **E5 Data Exceptions**: stale projection · event append failure · invariant break · replay inconsistency
* **E6 Governance Exceptions**: rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 Exception Severity Levels

* SEV4: Localized and minor, can auto-recover
* SEV3: Impacts a single workflow / single worker
* SEV2: Noticeably impacts a single business domain / single tenant
* SEV1: Platform-level impact / security incident / serious production risk

## 12.3 Exception Detection Rule Engine

> v2.0 addition: Upgrades exception detection from "hardcoded" to "rule engine".

```typescript
interface DetectionRule {
  rule_id: string;
  name: string;
  condition: {
    metric: string;           // "execution.failure_rate" | "projection.lag_seconds" | ...
    operator: ">" | "<" | "==" | "rate_of_change>";
    threshold: number;
    window_seconds: number;
  };
  severity: "SEV4" | "SEV3" | "SEV2" | "SEV1";
  actions: ("create_incident" | "notify" | "mode_switch" | "circuit_open")[];
  cooldown_seconds: number;
}
```

**Built-in Rule Examples**:

| Rule | Condition | Severity | Action |
|------|------|------|------|
| worker_heartbeat_missing | heartbeat_gap > 30s | SEV3 | create_incident + lease_reclaim |
| execution_timeout_spike | timeout_rate > 20% in 5min | SEV3 | notify + mode_switch(supervised) |
| projection_lag_high | lag > 30s | SEV3 | notify + rebuild_trigger |
| security_policy_violation | any violation | SEV2 | create_incident + quarantine |
| platform_wide_failure | error_rate > 50% in 1min | SEV1 | create_incident + mode_switch(incident-mode) |

## 12.4 Observability Data Model

> v1.2 only stated "need metrics". v2.0 defines specific metrics.

### Core Metrics

| Metric Name | Type | Labels | Description |
|--------|------|------|------|
| `agent.task.total` | counter | tenant, status | Total task count |
| `agent.execution.duration_ms` | histogram | tenant, step_type | Execution duration |
| `agent.execution.failure_rate` | gauge | tenant, error_type | Failure rate |
| `agent.dispatch.queue_depth` | gauge | queue_class | Queue depth |
| `agent.dispatch.latency_ms` | histogram | queue_class | Dispatch latency |
| `agent.worker.active` | gauge | pool, capability | Active worker count |
| `agent.projection.lag_seconds` | gauge | projection_name | Projection lag |
| `agent.approval.pending_count` | gauge | severity | Pending approval count |
| `agent.circuit_breaker.state` | gauge | target | Circuit breaker state |
| `agent.dlq.depth` | gauge | category | DLQ depth |

### Structured Log Specification

```typescript
interface StructuredLog {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "critical";
  trace_id: string;
  span_id: string;
  principal: string;
  tenant_id: string;
  component: string;      // "dispatcher" | "executor" | "projector" | ...
  event_type: string;     // "execution.started" | "tool_call.failed" | ...
  message: string;
  data?: Record<string, unknown>;
}
```

## 12.5 DLQ & Incident

**DLQ must have**: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQ is not a trash bin; it must be operationally manageable.

**Incident must be associated with**: affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution.

## 12.6 Alert Routing Architecture

> v2.1 addition. After an Incident is created, it must be routed to the correct person.

| SEV Level | Notification Channel | Response SLA | Escalation Rule |
|---------|---------|---------|---------|
| SEV4 | Platform console + logs | Next business day | None |
| SEV3 | IM notification (Slack/Feishu) | 4h | No response in 4h → SEV2 |
| SEV2 | IM + Email + on-call | 1h | No response in 1h → SEV1 |
| SEV1 | IM + Phone + all-hands broadcast | 15min | No response in 15min → Management |

```typescript
interface AlertRoute {
  severity: "SEV4" | "SEV3" | "SEV2" | "SEV1";
  channels: AlertChannel[];
  on_call_schedule_ref?: string;
  escalation_timeout_ms: number;
  escalation_target: AlertRoute;
}

interface AlertChannel {
  type: "console" | "webhook" | "email" | "im" | "phone";
  target: string;
  template_ref: string;
}
```

**External Integration**: Connects to PagerDuty / OpsGenie / Enterprise IM via Webhook. The platform does not implement alert channels internally; it only defines routing rules and delivery interfaces.

## 12.7 Distributed Tracing Architecture

> v2.1 addition. Defines the correlation model of trace → span → log → metric.

**Span Hierarchy**:

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

**Correlation Rules**:

* All StructuredLog must include trace_id + span_id (already present)
* Metrics are correlated to trace_id via exemplar (sampled for high-cardinality metrics)
* Incidents are correlated to the trigger trace_id, enabling tracing from an incident back to the full call chain
* Sampling strategy: error traces are 100% collected; normal traces are sampled per tenant configuration (default 10%)

---

# 13. OAPEFLIR Controlled Cognitive Kernel

> Retains v1.2's dual-chain model. v2.0 adds **TypeScript interface contracts for each phase** and **inter-phase data flow definitions**.

## 13.1 Dual-Chain Topology

**Main Chain (Synchronous)**: Observe → Assess → Plan → Execute → Feedback

**Side Chain (Asynchronous)**: Feedback → Learn → Improve → Release

## 13.2 Phase Interface Contracts

### Observe

```typescript
interface ObserveHub {
  collect(context: ObserveContext): Promise<UnifiedObservation>;
}

interface UnifiedObservation {
  task_situation: TaskSituation;
  system_situation: SystemSituation;
  knowledge_refs: KnowledgeRef[];
  memory_refs: MemoryRef[];
  risk_signals: RiskSignal[];
  collected_at: string;
}
```

### Assess

```typescript
interface AssessHub {
  evaluate(observation: UnifiedObservation): Promise<UnifiedAssessment>;
}

interface UnifiedAssessment {
  complexity: "trivial" | "simple" | "moderate" | "complex" | "expert";
  confidence: number;              // 0.0 - 1.0
  risk_level: RiskLevel;
  budget_pressure: "normal" | "warning" | "critical";
  requires_approval: boolean;
  route_decision: "execute" | "escalate" | "reject" | "defer";
  sub_assessments: SubAssessment[];
}
```

### Plan

```typescript
interface PlanHub {
  plan(assessment: UnifiedAssessment, observation: UnifiedObservation): Promise<ExecutionPlan>;
  replan(feedback: StepFeedback, original_plan: ExecutionPlan): Promise<ExecutionPlan>;
}

interface PlannedStep {
  step_id: string;
  type: "tool_call" | "llm_call" | "human_wait" | "sub_workflow" | "checkpoint";
  tool_name?: string;
  inputs: Record<string, unknown>;
  timeout_ms: number;
  retry_policy: RetryPolicy;
  requires_approval: boolean;
  expected_side_effects: SideEffectExpectation[];
}
```

### Execute

The Execute phase is not implemented within OAPEFLIR; instead, it delegates to the P4 Execution Plane (see §14). OAPEFLIR only submits an `ExecutionPlan` and receives an `ExecutionReceipt`.

### Feedback

```typescript
interface FeedbackHub {
  process(receipt: ExecutionReceipt): Promise<StepFeedback>;
}

interface StepFeedback {
  feedback_id: string;
  type: "success" | "failure" | "correction" | "timeout" | "policy_block" | "approval_block";
  step_id: string;
  signals: FeedbackSignal[];
  should_replan: boolean;
  should_escalate: boolean;
}
```

### Learn (Asynchronous)

```typescript
interface LearnHub {
  extract(feedbacks: StepFeedback[]): Promise<LearningObject[]>;
}

interface LearningObject {
  pattern_type: "failure_pattern" | "correction_pattern" | "recovery_playbook" | "routing_pattern";
  source_feedback_ids: string[];
  confidence: number;
  suggested_action: string;
  evidence: string;
}
```

### Improve (Asynchronous)

```typescript
interface ImproveHub {
  propose(learnings: LearningObject[]): Promise<ImprovementCandidate[]>;
}

interface ImprovementCandidate {
  candidate_id: string;
  type: "prompt_update" | "tool_config" | "routing_rule" | "risk_threshold";
  current_value: unknown;
  proposed_value: unknown;
  expected_impact: string;
  rollout_strategy: "shadow" | "canary" | "staged" | "direct";
}
```

### Release (Controlled)

Release is not an automatic phase; it is a release process governed by the P2 Control Plane. An ImprovementCandidate must go through the complete rollout process of validation → approval → canary → staged → stable.

## 13.3 Inter-Phase Data Flow

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

* OAPEFLIR is not equivalent to Runtime — it only makes decisions, it does not execute
* Learn / Improve must not go live directly — they must go through P2's rollout governance
* Risk / policy / approval checks must be inserted before any high-risk action
* Input and output of each phase must undergo Zod schema runtime validation

---

# 14. Runtime Execution Plane

> Retains the core responsibility definitions from v1.2. v2.0 adds **Execution Strategy Mode** and **Executor Registration Mechanism**.

## 14.1 Core Responsibilities

session / task / workflow_run / execution lifecycle · dispatch / queue / worker scheduling · lease / fencing · executor invocation · side effect controlled commit · retry / timeout / recovery · mode-aware execution · event emission

## 14.2 Dispatcher Intelligent Scheduling

Dispatcher also serves as a risk isolation point. Scheduling decision matrix:

| Factor | Impact |
|------|------|
| worker capability | Match capabilities required by the step |
| worker health | Exclude unhealthy workers |
| queue class | priority / standard / background |
| risk class | Assign high-risk steps to an isolated pool |
| tenant quota | Single tenant does not exceed quota |
| sandbox requirement | Match sandbox tier |

## 14.3 Execution Strategy Mode

> New in v2.0. Upgrades execution strategy from hard-coded to configurable mode.

```typescript
interface ExecutionStrategy {
  retry_policy: {
    max_retries: number;
    backoff: "fixed" | "exponential" | "exponential_with_jitter";
    base_delay_ms: number;
    max_delay_ms: number;
  };
  timeout_policy: {
    step_timeout_ms: number;
    attempt_timeout_ms: number;
    tool_timeout_ms: number;
  };
  failure_policy: "retry" | "skip" | "abort" | "escalate" | "replan";
  checkpoint_policy: "every_step" | "on_side_effect" | "on_approval_gate" | "never";
}
```

Each Business Pack can declare its own ExecutionStrategy to override the defaults.

## 14.4 Executor Registration Mechanism

> New in v2.0. Upgrades executor from hard-coded to pluggable registration.

```typescript
interface ExecutorRegistry {
  register(type: string, executor: Executor): void;
  resolve(step: PlannedStep): Executor;
}

interface Executor {
  readonly type: string;
  readonly capabilities: string[];
  execute(step: PlannedStep, context: ExecutionContext): Promise<ExecutionReceipt>;
  canHandle(step: PlannedStep): boolean;
}
```

**Built-in Executor Types**: ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect Two-Phase

1. Executor returns proposed side effect
2. Policy / approval decides whether to allow commit
3. Side effect repository records
4. Compensation is performed when necessary

> A successful tool execution does not mean the side effect has officially taken effect.

## 14.6 HumanWait Is a Formal Executor

Approval waiting is not a bypass. HumanWait is responsible for: creates decision → blocks execution → waits resolution → resumes flow.

## 14.7 Recovery Worker Family

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

**v2.0 Improvement**: Each Recovery Worker must declare its own `RecoveryCadence` (check interval, maximum concurrent recovery count, timeout) and report results through `RecoveryReport`.

## 14.8 Runtime Mode Switching

**Canonical Mode Set** (consistent with §9.5): full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

Where `full_auto` corresponds to the old name `normal`, and `supervised_auto` corresponds to the old name `degraded`/`supervised`. All runtime modes must use this canonical enum.

Mode switching authority belongs to P2 Control Plane, issued via `ControlDirective(type: "mode_switch")`.

# 15. LLM Provider Abstraction and Failover Architecture

> v2.0 did not cover LLM layer architecture. v2.1 treats LLM as the platform's most critical external dependency, defining provider abstraction, routing strategies, and degradation modes when unavailable.

## 15.1 Design Principles

* The platform does not bind to any single LLM provider
* All LLM calls are issued through a unified ModelGateway; upper layers do not directly call provider SDKs
* ModelGateway is part of X1 Fabric, cross-cutting P3 Orchestration and P4 Execution
* LLM calls are treated as **high-risk external dependencies** and must have timeout, circuit breaker, fallback, and cost tracking

## 15.2 ModelGateway Interface

```typescript
interface ModelGateway {
  complete(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelChunk>;
  embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

interface ModelRequest {
  request_id: string;
  trace_id: string;
  tenant_id: string;
  model_ref: string;
  prompt_ref: string;
  messages: Message[];
  parameters: ModelParameters;
  constraints: ModelConstraints;
}

interface ModelConstraints {
  max_tokens: number;
  max_cost: number;
  max_latency_ms: number;
  required_capabilities: string[];
  data_classification: "public" | "internal" | "confidential" | "restricted";
}

interface ModelResponse {
  response_id: string;
  provider: string;
  model: string;
  content: string;
  usage: TokenUsage;
  latency_ms: number;
  cached: boolean;
  quality_signals: QualitySignal[];
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}
```

## 15.3 Provider Registration and Routing

```typescript
interface ProviderRegistry {
  register(provider: ProviderConfig): void;
  resolve(request: ModelRequest): ProviderConfig[];
}

interface ProviderConfig {
  provider_id: string;
  display_name: string;
  endpoint: string;
  models: ModelCapability[];
  auth: ProviderAuth;
  rate_limits: { rpm: number; tpm: number };
  cost_per_1k_tokens: { input: number; output: number };
  data_residency: string[];
  health: ProviderHealth;
  priority: number;
}
```

**Routing Strategies**:

| Strategy | Applicable Scenario | Description |
|------|---------|------|
| priority | Default | Sort by priority, prefer the highest priority |
| cost_optimized | Batch / low-priority tasks | Select the available provider with the lowest unit price |
| latency_optimized | Real-time interaction | Select the provider with the lowest P99 latency |
| data_residency | Compliance requirements | Only select providers that satisfy data residency |
| capability_match | Special capabilities | Match required_capabilities |

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

**Failover Rules**:

* Single request timeout (default 30s) → automatically switch to next provider and retry
* Consecutive failures > 5 (60s window) → trigger circuit breaker, provider marked as unhealthy
* All providers unhealthy → enter LLM Degradation Mode
* After provider recovery, automatically recover through half-open probing

## 15.5 LLM Unavailability Degradation Mode

When all LLM providers are unavailable, the platform must have a clear degradation strategy rather than simply reporting errors:

| Degradation Level | Trigger Condition | Platform Behavior |
|---------|---------|---------|
| D0 Normal | At least one provider healthy | Normal routing |
| D1 Restricted | Primary down, secondary available | Auto switch + alert + limit new workflow launch rate |
| D2 Cached | All providers unhealthy, cache available | Return cached results for similar requests (read-only scenarios only) |
| D3 Static | Cache unavailable | Use pre-configured static fallback plan (low-risk tasks only) |
| D4 Paused | All degradation options unavailable | Pause all new workflows, protect in-flight workflow checkpoints, escalate to humans |

**Cache Design**:

* Semantic cache based on prompt_ref + parameter hash
* TTL tiered by data_classification: public=1h, internal=15min, confidential=no caching
* Cache hits must be marked `cached: true` and excluded from model quality evaluation

## 15.6 Streaming Response and Error Handling

Additional constraints for `ModelGateway.stream()`:

| Concern | Handling Strategy |
|--------|---------|
| Stream interruption | Already received tokens cached as partial response; if partial is usable (≥ 80% expected length) then mark `partial: true` and use; otherwise switch provider and retry |
| Token limit pre-check | Before sending, estimate input token count based on `ModelRequest.messages`; if > provider's `context_window - max_tokens` then reject and return `TOKEN_LIMIT_EXCEEDED` |
| Response format validation | After stream completes, perform Zod schema validation on the full output; validation failure triggers one retry (with format reminder appended); second failure logged as `llm.response.validation_failed` |
| Timeout | Streaming first-token timeout (TTFT > 10s) triggers provider switch; total duration timeout enforced per `ModelConstraints.max_latency_ms` |
| Backpressure | When consumer processing speed < production speed, pause stream reading (backpressure), do not discard tokens |

## 15.7 Observability

| Metric | Type | Description |
|------|------|------|
| `llm.request.total` | counter | By provider/model/tenant |
| `llm.request.latency_ms` | histogram | By provider/model |
| `llm.request.error_rate` | gauge | By provider/error_type |
| `llm.token.usage` | counter | By provider/model/tenant |
| `llm.cost.total` | counter | By provider/tenant |
| `llm.cache.hit_rate` | gauge | Cache hit rate |
| `llm.fallback.triggered` | counter | Degradation trigger count |

---

# 16. Prompt Management and Versioning Architecture

> Prompts are the Agent's "source code." v2.1 treats Prompts as a first-class architectural concern, defining storage, versioning, canary release, and rollback mechanisms.

## 16.1 Design Principles

* Prompts are not inlined in code but managed independently as **versioned resources**
* Each Prompt has a complete lifecycle: draft → review → staging → canary → stable → deprecated
* Prompt changes are equivalent to code changes and must pass quality gates (see §17)
* The combination of Prompt and model forms the core of Agent behavior; changes to both must be coordinated

## 16.2 Prompt Data Model

```typescript
interface PromptDefinition {
  prompt_id: string;
  name: string;
  version: string;
  stage: "observe" | "assess" | "plan" | "feedback" | "learn" | "improve";
  template: string;
  variables: PromptVariable[];
  model_constraints: {
    compatible_models: string[];
    min_context_window: number;
    required_capabilities: string[];
  };
  metadata: {
    author: string;
    created_at: string;
    description: string;
    tags: string[];
  };
}

interface PromptVariable {
  name: string;
  type: "string" | "number" | "json" | "context_ref";
  required: boolean;
  default?: unknown;
  max_tokens?: number;
}

interface PromptVersion {
  version_id: string;
  prompt_id: string;
  version: string;
  status: "draft" | "review" | "staging" | "canary" | "stable" | "deprecated" | "rolled_back";
  content_hash: string;
  parent_version?: string;
  eval_results?: EvalResult[];
  rollout_config?: PromptRolloutConfig;
}
```

## 16.3 Release and Canary

```typescript
interface PromptRolloutConfig {
  strategy: "direct" | "canary" | "staged" | "shadow";
  canary_percentage: number;
  promotion_criteria: {
    min_requests: number;
    max_error_rate: number;
    min_quality_score: number;
    observation_window_minutes: number;
  };
  auto_rollback_on: string[];
}
```

**Release Flow**:

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (quality below threshold)
                                               rolled_back
```

* Staging phase must pass eval gate (see §17)
* Canary phase runs in parallel with the stable version, splitting traffic proportionally
* During canary, quality metrics of old and new versions are continuously compared
* Manual or automatic rollback to the previous stable version is possible at any time

## 16.4 Prompt Composition Management

An OAPEFLIR cycle involves Prompts from multiple stages, which must be managed as an **atomic composition**:

```typescript
interface PromptBundle {
  bundle_id: string;
  version: string;
  prompts: Record<string, string>;
  compatibility_matrix: {
    model_refs: string[];
    pack_ids: string[];
  };
}
```

**Constraint**: All stages within the same workflow run use the same PromptBundle version; no mid-run switching.

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
│ Prompt Assembler │  Strict separation of system/user/assistant segments
│                  │  User content injected only into user segment, never into system segment
├──────────────────┤
│ Output Validator │  Detect exfiltration attempts in LLM output
│                  │  (URL injection, Markdown link leaks, covert instruction return)
└──────────────────┘
```

### 16.5.2 Defense Strategies

| Layer | Strategy | Description |
|------|------|------|
| Input Layer | Variable Escaping | All user input variables are XML/Markdown escaped before injection, eliminating control characters |
| Input Layer | Boundary Markers | system and user segments use LLM provider native role separation, not relying on text markers |
| Detection Layer | Injection Classifier | Lightweight classification model scores each user input for injection probability; > 0.7 is rejected |
| Detection Layer | Canary Token | Embed canary token in system prompt; if LLM output contains that token, injection is determined |
| Output Layer | Output Sanitizer | LLM output undergoes URL/link filtering, PII detection, instruction pattern detection |
| Audit Layer | Full Prompt Logging | Each rendered complete prompt is saved as an artifact (optionally disabled for confidential level and above) |

### 16.5.3 Fundamental Principles

* Prompt content is not exposed to end users (prevent information leakage)
* Prompt variables must be sanitized before injection
* Variables containing secrets / PII are redacted in artifacts
* In multi-turn conversations, historical assistant messages cannot be tampered with by users
* External tool return values are treated as untrusted input and undergo sanitization before injection

---

# 17. Model Evaluation and Quality Gate Architecture

> An Agent platform without evaluation capability is equivalent to "going live unprotected." v2.1 defines the quality gate framework for model/Prompt changes.

## 17.1 Evaluation Levels

| Level | Trigger Timing | Evaluation Content | Blocking Capability |
|------|---------|---------|---------|
| Offline Evaluation | When Prompt/Model change is submitted | Standard eval dataset regression test | Block release |
| Canary Evaluation | During canary phase | Real-time quality comparison of old and new versions | Auto rollback |
| Online Monitoring | Continuously running | Quality metric drift detection | Trigger alert/degradation |

## 17.2 Eval Dataset Management

```typescript
interface EvalDataset {
  dataset_id: string;
  name: string;
  version: string;
  stage: "observe" | "assess" | "plan" | "feedback";
  cases: EvalCase[];
  created_by: string;
  pack_id?: string;
}

interface EvalCase {
  case_id: string;
  input: Record<string, unknown>;
  expected_output?: unknown;
  quality_criteria: QualityCriterion[];
  tags: string[];
  priority: "critical" | "standard";
}

interface QualityCriterion {
  type: "exact_match" | "contains" | "json_schema" | "semantic_similarity" | "llm_judge" | "custom_function";
  config: Record<string, unknown>;
  weight: number;
  threshold: number;
}
```

## 17.3 Quality Gate Rules

```typescript
interface QualityGate {
  gate_id: string;
  name: string;
  applies_to: "prompt_change" | "model_change" | "pack_change";
  rules: QualityGateRule[];
  enforcement: "blocking" | "warning";
}

interface QualityGateRule {
  metric: string;
  operator: ">=" | "<=" | "within";
  threshold: number;
  comparison: "absolute" | "relative_to_baseline";
}
```

**Built-in Gate Rules**:

| Rule | Condition | Description |
|------|------|------|
| regression_pass_rate | >= 95% | Eval dataset pass rate must not be lower than baseline |
| critical_case_pass | == 100% | Cases marked as critical must all pass |
| latency_regression | <= 120% of baseline | Latency must not exceed 120% of baseline |
| cost_regression | <= 150% of baseline | Cost must not exceed 150% of baseline |
| quality_score_delta | >= -0.05 | Quality score must not drop more than 5 percentage points below baseline |

## 17.4 Online Quality Monitoring

```typescript
interface QualitySignal {
  signal_type: "output_parseable" | "output_relevant" | "output_safe" | "user_feedback" | "downstream_success";
  value: number;
  timestamp: string;
}
```

**Drift Detection**:

* Sliding window (1h/24h) for quality distribution statistics
* When 24h window quality mean drops > 10%, trigger SEV3 alert
* When 1h window quality mean drops > 20%, trigger automatic degradation to supervised mode
* All quality signals are written to P5 Evidence Plane, supporting pattern extraction in the Learn stage

## 17.5 LLM-as-Judge

For quality scenarios that cannot be judged by rules (e.g., "is the answer reasonable"), use LLM-as-Judge:

* Judge LLM and the evaluated LLM must come from different providers (to avoid bias)
* Judge results are cached (same input+output is not re-evaluated)
* Judge invocations themselves have cost budget limits (see §18)
* Judge evaluation results are included in quality gates but with lower weight than deterministic rules

---

# 18. Cost Management and Token Metering Architecture

> LLM call costs dominate platform OPEX. v2.1 defines per-tenant metering, budget enforcement, and chargeback mechanisms.

## 18.1 Metering Model

```typescript
interface UsageRecord {
  record_id: string;
  timestamp: string;
  tenant_id: string;
  workflow_run_id: string;
  step_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  currency: string;
  cached: boolean;
}
```

**Metering Point**: ModelGateway synchronously writes a UsageRecord after each LLM call completes, serving as the sole data source for billing.

## 18.2 Budget Levels

| Level | Budget Subject | Control Granularity | Over-Budget Behavior |
|------|---------|---------|-----------|
| Platform Level | Entire platform | Monthly total | SEV1 alert + pause new workflows |
| Tenant Level | Single tenant | Monthly quota | Alert + throttle that tenant's workflow queue |
| Pack Level | Single Business Pack | Per-workflow limit | Degrade that workflow to supervised |
| Step Level | Single step | Per-step token/cost limit | Abort step + replan |

```typescript
interface BudgetPolicy {
  scope: "platform" | "tenant" | "pack" | "step";
  scope_id: string;
  period: "monthly" | "weekly" | "per_run";
  limit_tokens?: number;
  limit_cost?: number;
  warning_threshold: number;
  actions_on_warning: string[];
  actions_on_breach: string[];
}
```

## 18.3 Budget Enforcement

```text
ModelRequest
  → ModelGateway.budget check
    → Query current period usage
    → Estimate this call's cost (based on prompt_tokens + estimated completion)
    → If used + estimated > limit × warning_threshold → issue alert
    → If used + estimated > limit → reject request / degradation strategy
  → Execute LLM call
  → Update usage
```

## 18.4 Chargeback Reports

* Aggregated by tenant / pack / model / provider dimensions
* Daily + monthly reports auto-generated
* Exportable as CSV / JSON
* Integrated with Admin API: `/api/v1/admin/cost-reports`

## 18.5 Cost Optimization Strategies

| Strategy | Description | Applicable Scenario |
|----------|-------------|---------------------|
| Prompt Cache | Reuse semantically similar requests (see §15.5) | read-only / low-change scenarios |
| Token Budget Trimming | Automatically compress memory/knowledge input when context is too long | Large context tasks |
| Model Downgrade | Automatically select lower-cost model for low-risk tasks | background queue |
| Batch Merging | Merge multiple similar steps into a single LLM call | Batch analysis scenarios |

---

# 19. Inter-Agent Delegation & Collaboration Architecture

> Complex enterprise tasks require multiple Agents to collaborate. v2.1 defines the inter-Agent delegation protocol, context passing, and authorization model.

## 19.1 Delegation Model

```typescript
interface DelegationRequest {
  delegation_id: string;
  parent_workflow_run_id: string;
  parent_step_id: string;
  target_pack_id: string;
  task_description: string;
  context: DelegationContext;
  constraints: DelegationConstraints;
  callback: DelegationCallback;
}

interface DelegationContext {
  shared_knowledge_refs: string[];
  shared_artifact_refs: string[];
  parent_observation_summary: string;
  data_classification: string;
  max_context_tokens: number;
}

interface DelegationConstraints {
  max_steps: number;
  max_duration_ms: number;
  max_cost: number;
  allowed_tools: string[];
  risk_ceiling: "low" | "medium" | "high";
  requires_parent_approval_for_high_risk: boolean;
}

interface DelegationCallback {
  on_complete: "resume_parent" | "notify_parent";
  on_failure: "escalate_to_parent" | "abort_parent" | "retry";
  timeout_action: "abort" | "escalate";
}
```

## 19.2 Delegation Topology Constraints

* **Depth Limit**: Maximum delegation chain depth = 3 (prevents infinite recursion)
* **Cycle Detection**: The same pack_id cannot appear twice in the same delegation chain
* **Isolation**: Child workflow has independent lease, independent checkpoint, does not share state with parent workflow
* **Budget Inheritance**: Child workflow budget is deducted from the parent workflow's remaining budget
* **Permission Contraction**: Child workflow permissions ≤ parent workflow permissions (principle of least privilege)

## 19.3 Context Passing Security

* Parent → Child: Only pass references declared in DelegationContext, do not pass raw data
* Child → Parent: Only return via DelegationResult, containing summary + artifact_refs
* Cross-tenant delegation: Disabled by default, requires explicit P2 authorization
* Data classification upward compatibility: Child workflow output data classification ≥ input data classification

```typescript
interface DelegationResult {
  delegation_id: string;
  status: "completed" | "failed" | "timeout" | "cancelled";
  summary: string;
  artifact_refs: string[];
  usage: TokenUsage;
  duration_ms: number;
}
```

## 19.4 Collaboration Patterns

| Pattern | Description | Applicable Scenario |
|---------|-------------|---------------------|
| Serial Delegation | A delegates to B, waits for B to complete then continues | Simple subtasks |
| Parallel Fan-out | A delegates to B1/B2/B3 simultaneously, aggregates results | Parallel analysis |
| Pipeline | A → B → C, chained passing | Multi-stage processing |
| Negotiation | A and B execute alternately, sharing context | Code review + fix |

---

# 20. Long-Running Tasks & Workflow Hibernation Architecture

> In enterprise scenarios, workflows may last hours or even days (waiting for approvals, waiting for external system callbacks). v2.1 defines the hibernation/wake mechanism.

## 20.1 Long-Running Task Classification

| Type | Duration | Reason | Example |
|------|----------|--------|---------|
| Approval Waiting | Minutes → Days | HumanWait executor blocks | High-risk operation approval |
| External Callback | Minutes → Hours | Waiting for third-party system to complete | CI/CD build completion callback |
| Scheduled | Determined time | Waiting for a specific time window | Execution during off-hours |
| Multi-stage | Days → Weeks | Business process multi-stage approval | Release approval chain |

## 20.2 Workflow Hibernation Mechanism

```typescript
interface WorkflowHibernation {
  workflow_run_id: string;
  hibernated_at: string;
  reason: "awaiting_approval" | "awaiting_callback" | "scheduled_wake" | "budget_exhausted" | "manual_pause";
  wake_conditions: WakeCondition[];
  checkpoint_ref: string;
  ttl: string;
  timeout_action: "abort" | "escalate" | "retry";
}

interface WakeCondition {
  type: "approval_received" | "callback_received" | "timer_expired" | "event_matched" | "manual_resume";
  config: Record<string, unknown>;
}
```

**Hibernation Flow**:

1. Step enters waiting state → create full checkpoint
2. Release worker lease (worker is no longer occupied)
3. Create HibernationRecord, register wake_conditions
4. Set workflow_run status to `hibernated`
5. Persist all in-memory context to P5

**Wake Flow**:

1. wake_condition is met → WakeEngine triggers
2. Restore workflow context from checkpoint
3. Re-acquire worker lease
4. Resume execution from the breakpoint

## 20.3 Durable Timer

```typescript
interface DurableTimer {
  timer_id: string;
  workflow_run_id: string;
  step_id: string;
  fire_at: string;
  fired: boolean;
  created_at: string;
}
```

* Timers are persisted to the database, not dependent on process memory
* TimerPoller (similar to outbox poller) periodically scans for expired timers
* Timers are not lost after process restart
* Timer precision: ± 30s (non-real-time system, millisecond precision not pursued)

## 20.4 TTL & Timeout Protection

* Every hibernation must have a TTL (default 7 days, maximum 30 days)
* Execute timeout_action when TTL expires
* Long-running workflows emit a `workflow.still_hibernated` health event every 24h
* Hibernations exceeding 50% of TTL trigger reminder notifications

## 20.5 Cross-Deployment Safety

* Checkpoint format is backward compatible (versioned schema)
* Hibernated workflows are not affected during platform upgrade deployments
* If checkpoint schema is incompatible, workflow enters `recovery_needed` state, handled by Recovery Worker

---

# 21. Human-in-the-Loop Collaboration Architecture

> v2.0 only had HumanWait executor and basic approval gates. v2.1 defines a complete HITL pattern catalog.

## 21.1 HITL Pattern Catalog

| Pattern | Description | Trigger Condition | Timeout Behavior |
|---------|-------------|-------------------|------------------|
| Single Approval | One approver makes the decision | risk_level ≥ high | Timeout → Escalate |
| Multi-party Approval | Multiple independent approvers, voting decision | Critical operation / cross-domain impact | Timeout → Auto-deny |
| Delegated Approval | Approver can delegate to another person | Original approver is offline | TTL resets after delegation |
| Iterative Feedback | Human provides revision comments, Agent redoes | Output is unsatisfactory | Terminate after max iterations |
| Collaborative Editing | Human and Agent alternately modify the same artifact | Code/document collaboration | No timeout, manually ended |
| Informed Confirmation | Notification only, no approval required | Low-risk side effect | Auto-approve |
| Circuit-break to Human | Transfer to human decision when LLM is unavailable | D4 degradation mode (see §15.5) | Human timeout → abort |

## 21.2 Approval Flow Engine

```typescript
interface ApprovalFlow {
  flow_id: string;
  type: "single" | "multi_party" | "delegated" | "sequential_chain";
  approvers: ApproverRule[];
  quorum?: { min_approvals: number; min_rejections_to_deny: number };
  timeout: ApprovalTimeout;
  escalation: EscalationRule;
}

interface ApproverRule {
  type: "user" | "role" | "team" | "on_call";
  identifier: string;
  can_delegate: boolean;
}

interface ApprovalTimeout {
  warn_after_ms: number;
  escalate_after_ms: number;
  auto_action_after_ms: number;
  auto_action: "approve" | "deny" | "escalate";
}

interface EscalationRule {
  escalate_to: ApproverRule;
  max_escalation_depth: number;
  notification_channels: string[];
}
```

## 21.3 Iterative Feedback Loop

```typescript
interface FeedbackLoop {
  loop_id: string;
  workflow_run_id: string;
  step_id: string;
  max_iterations: number;
  current_iteration: number;
  human_feedback: HumanFeedback[];
}

interface HumanFeedback {
  iteration: number;
  feedback_type: "approve" | "reject_with_guidance" | "modify_directly";
  guidance?: string;
  modified_artifact_ref?: string;
  timestamp: string;
  principal: string;
}
```

**Flow**: Agent produces output → Human reviews → Provides guidance → Agent replans + redoes → Loop until approve or max_iterations reached.

## 21.4 Notifications & Channels

| Channel | Purpose | Integration Method |
|---------|---------|--------------------|
| Platform Console | Default approval interface | Built-in |
| Webhook | External system integration | Outbound HTTP |
| Email | Asynchronous notification | SMTP adapter |
| IM (Slack/Feishu/WeCom) | Instant notification + quick approval | Webhook + Callback API |

---

# 22. SDK & Developer Experience Architecture

> A platform without an SDK cannot be adopted by business teams. v2.1 defines the Pack development toolchain and local development experience.

## 22.1 SDK Layers

| SDK Layer | Target Role | Functionality |
|-----------|-------------|---------------|
| Pack SDK | Business developers | Create/test/publish Business Packs |
| Plugin SDK | Plugin developers | Develop tools / adapters / retrievers / evaluators |
| Client SDK | External integrators | Call platform Public API |
| Admin SDK | Operations team | Call Admin API, scripted operations |

## 22.2 Pack SDK Core Capabilities

```typescript
interface PackSDK {
  scaffold(config: ScaffoldConfig): Promise<void>;
  validate(manifest: BusinessPackManifest): ValidationResult;
  test(options: TestOptions): Promise<TestReport>;
  publish(options: PublishOptions): Promise<PublishResult>;
}

interface ScaffoldConfig {
  pack_id: string;
  name: string;
  template: "minimal" | "standard" | "full";
  tools: string[];
  risk_level: "low" | "medium" | "high";
}

interface TestOptions {
  mode: "unit" | "integration" | "simulation";
  mock_llm: boolean;
  eval_dataset?: string;
  record_artifacts: boolean;
}
```

## 22.3 Local Development Environment

* `agent-platform dev` — Start local platform (SQLite + in-process workers)
* `agent-platform pack create` — Create Pack scaffold
* `agent-platform pack test` — Run Pack tests (mock LLM + mock tools)
* `agent-platform pack validate` — Validate Manifest compliance
* `agent-platform pack publish --target staging` — Publish to staging environment

**Local Simulator**:

* Built-in MockModelGateway: Returns pre-configured LLM responses for deterministic testing
* Built-in MockToolExecutor: Simulates tool execution results
* Test record/replay: Record real LLM calls as fixtures, replay in subsequent tests (no token consumption)

## 22.4 Plugin Lifecycle

| Stage | Description | Requirements |
|-------|-------------|--------------|
| Development | Local development + Plugin SDK | Must declare PluginManifest |
| Testing | Unit tests + sandbox integration tests | Coverage ≥ 80% |
| Certification | Security scan + capability review | Pass Plugin security checklist |
| Publishing | Register to Plugin Registry | Semantic versioning (semver) |
| Runtime | Execute under sandbox constraints | Resource limits + capability allowlist |
| Deprecation | Mark deprecated + migration guide | Maintain for at least 3 months |

```typescript
interface PluginManifest {
  plugin_id: string;
  name: string;
  version: string;
  type: "tool" | "adapter" | "retriever" | "evaluator" | "presenter";
  capabilities_required: string[];
  resource_limits: { max_memory_mb: number; max_cpu_ms: number; max_duration_ms: number };
  dependencies: string[];
  security: { sandbox_tier: string; egress_domains: string[] };
}
```

## 22.5 Documentation & Examples

* Every SDK must have an API reference (auto-generated from TypeScript types)
* Provide 3 standard example Packs: simple-qa / coding-fix / operations-resolve
* Provide a Playground environment: online Pack development trial (optional, Phase 4)

---

# 23. Compliance & Data Governance Architecture

> An enterprise-grade platform must meet compliance requirements. v2.1 defines the GDPR/SOC2-related data governance architecture.

## 23.1 Data Lifecycle Management

| Data Type | Retention Policy | Deletion Method | Description |
|-----------|-----------------|-----------------|-------------|
| Truth table | Per business needs | Logical delete + periodic physical cleanup | Control truth |
| Event log | Default 365 days | Delete after archival | append-only, archive to cold storage |
| Audit record | Default 3 years | Cannot be deleted (compliance requirement) | Legal retention period |
| Artifact | Default 90 days | Physical deletion | Large objects |
| Memory | Auto-cleanup by TTL | Physical deletion | Runtime short-term data |
| Knowledge | Differentiated by trust level | Logical deletion | Long-term shared data |
| LLM call record | Default 90 days | Physical deletion | Contains prompt/completion |
| Cost record | Default 3 years | Archive | Financial audit |

## 23.2 Right-to-Erasure (GDPR Art.17)

There is an architectural conflict between append-only event logs and right-to-erasure. Solution:

**Crypto-shredding**:

1. Each tenant's PII data is encrypted with an independent data encryption key (DEK) before storage
2. DEK is managed by the key management service, associated with tenant_id
3. When a deletion request arrives, destroy that tenant's DEK
4. Encrypted data in the event log becomes undecryptable (logically equivalent to deletion)
5. Audit records retain the record of the deletion operation itself

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

## 23.3 Data Residency

* Each tenant can configure data_residency constraints (e.g., "CN" / "EU" / "US")
* LLM calls must be routed to providers satisfying data residency requirements (see §15.3 data_residency routing)
* Storage engine is sharded by region (Phase S3+ support)
* Cross-region data transfer is disabled by default, requires explicit authorization

## 23.4 SOC2 Control Mapping

| SOC2 Control Domain | Corresponding Platform Capability | Evidence Source |
|---------------------|-----------------------------------|-----------------|
| CC6.1 Logical Access | §11 Unified Identity & Authorization | PolicyOutcome + audit record |
| CC6.3 Encryption | §23.5 Encryption Architecture | key rotation log |
| CC7.2 Monitoring | §12 Anomaly Event Detection | incident + metrics |
| CC8.1 Change Management | §24 Configuration Governance + §16 Prompt Versioning | config_version + prompt_version |
| CC9.1 Risk Mitigation | §10 Risk Scoring Engine | RiskDecision + evidence bundle |
| A1.2 Disaster Recovery | §31 Disaster Recovery Architecture | DR drill report |

## 23.5 Encryption Architecture

| Layer | Strategy | Implementation |
|-------|----------|----------------|
| Transport Encryption | TLS 1.3 mandatory | All HTTP/gRPC/WebSocket connections |
| Storage Encryption | AES-256 | Database-level TDE or application-level field encryption |
| PII Field Encryption | Per-tenant DEK | Supports crypto-shredding |
| Secret Storage | Vault integration | Reference-based access, TTL ≤ 300s |
| Key Rotation | Automatic every 90 days | DEK rotation does not affect historical data decryption (envelope encryption) |

## 23.6 Data Lineage

Every decision and output can be traced back to its data source:

```text
Knowledge chunk → Observe (UnifiedObservation)
  → Assess (UnifiedAssessment) → Plan (ExecutionPlan)
    → Execute (ExecutionReceipt) → Side Effect
```

* Build lineage chain through trace_id + evidence_refs
* Supports forward queries (which decisions were influenced by a given knowledge) and reverse queries (which inputs a given side effect depends on)
* Lineage data is written to P5 Evidence Plane, no separate storage is created

---

# 24. Configuration Governance Architecture

> v1.2 only mentioned the name "config center". v2.0 defines a complete configuration governance model.

## 24.1 Configuration Layering

| Layer | Example | Change Frequency | Approval Required |
|-------|---------|------------------|-------------------|
| Platform Default | retry_max=3, timeout=5000ms | Very low | ADR level |
| Environment Override | prod.timeout=10000ms | Low | P2 approval |
| Tenant Override | tenant_A.max_concurrent=50 | Medium | Tenant admin |
| Business Pack Override | coding.retry_max=5 | Medium | Pack owner |
| Runtime Dynamic | circuit_breaker.threshold=0.3 | High | Automatic rules |

## 24.2 Configuration Versioning

* Each configuration change generates a new version, retaining complete history
* Supports diff: display differences between two versions
* Supports rollback: one-click rollback to any historical version
* Configuration changes emit a `config.changed` event, triggering hot-reload of related components

## 24.3 Configuration Canary Release

High-risk configuration changes (e.g., timeout, rate-limiting thresholds) support canary release:

1. Apply to canary environment first
2. Observe for 30 minutes with no anomalies
3. Expand to 10% of traffic
4. Full release

## 24.4 Configuration Security

* Sensitive configurations (secrets, credentials) store only references, not plaintext
* Configuration change audit records who / when / what / why
* Critical configuration changes (sandbox tier, egress allowlist) require P2 approval

---

# 25. Data & State Consistency Architecture

## 25.1 Consistency Principles

Does not pursue global strong consistency; instead pursues: truth state transactional consistency · event append in same transaction · projection eventual consistency · replay can rebuild · side effects are auditable.

## 25.2 Truth Table + Event Log Dual Model

* Truth table stores current state (read-optimized)
* Event log stores historical changes (audit/replay-optimized)
* Both are updated in the same transaction, ensuring consistency

## 25.3 CAS + Lease + Fencing

All critical updates must be based on: expected status CAS · active lease · fencing token. This is a hard constraint for execution layer consistency.

## 25.4 Projections Must Be Rebuildable

All projections must be: idempotent · replay-safe · event_id deduplicated · support rebuild · not write back to truth.

## 25.5 State & Evidence Layering

| Layer | Content | Purpose |
|-------|---------|---------|
| Truth | Current control truth | State judgment, concurrency control, scheduling progression |
| Event | Historical change trajectory | Timeline reconstruction, replay, fault explanation |
| Projection | Query model | Console, reports, approval queues |
| Audit | Audit records | Who did what to what |
| Artifact | Large object content | observation/plan/log/evidence/screenshot |
| Checkpoint | Execution recovery point | Breakpoint recovery, repair, replay starting point |

---

# 26. Storage Architecture

> v1.2 directly provided 44 PostgreSQL tables. v2.0 first defines the **storage abstraction layer**, then provides a **progressive evolution path**.

## 26.1 Repository Abstraction Layer

All upper-layer code accesses storage through the Repository interface, without directly operating the database.

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

The significance of this layer:
* Upper layers don't care whether the underlying storage is SQLite / PostgreSQL / other
* Can use in-memory implementation for unit testing
* Can progressively migrate from SQLite to PostgreSQL

## 26.2 Storage Evolution Path

| Stage | Storage Engine | Applicable Scenario | Switch Method |
|-------|---------------|---------------------|---------------|
| E1 Development/Prototype | SQLite (WAL mode) | Single node, 10 concurrency | Default |
| E2 Small-scale Production | SQLite + Redis cache | Single node, 50 concurrency | Configuration switch |
| E3 Medium-scale Production | PostgreSQL | Multi-node, 500 concurrency | Repository implementation replacement |
| E4 Large-scale Production | PostgreSQL + table partitioning & archival | Cluster, 5000+ concurrency | Schema evolution |

**Switch Principle**: Repository interface remains unchanged, only the implementation is replaced. Migrate read-heavy/write-light tables first (projection, audit), then migrate core write paths (truth, event).

## 26.3 Core Table Design (Logical Model)

> Only logical groupings are provided here, not bound to a specific database. Physical schema is defined during detailed design phase.

### Group 1: Workflow & Execution (12 tables)

workflow_definition · workflow_run · loop_cycle · step_run · step_attempt · execution · execution_lease · dispatch_ticket · task · worker · checkpoint · recovery_job

### Group 2: Decision & Policy (9 tables)

tool_definition · tool_call · side_effect · side_effect_reconciliation · decision_record · decision_comment · approval_sla · exception_record · policy_outcome

### Group 3: Knowledge & Artifact (8 tables)

artifact_record · artifact_bundle · memory_entry · knowledge_namespace · knowledge_document · knowledge_chunk · knowledge_promotion · knowledge_conflict

### Group 4: Ops & Governance (15 tables)

improvement_candidate · rollout_record · rollout_guardrail_result · event_log · event_outbox · audit_record · incident · incident_link · dlq_record · replay_job · repair_job · projection_rebuild_job · idempotency_record · health_snapshot · config_version

### Group 5: AI Operations (v2.1 new, 8 tables)

prompt_version · prompt_bundle · eval_dataset · eval_run · usage_record · model_provider · delegation_request · hibernation_snapshot

### Group 6: Domain & Organization (v2.2-v2.4 new, 10 tables)

domain_descriptor · domain_risk_profile · domain_recipe · org_node · approval_route · compliance_policy · knowledge_boundary · governance_delegation · sso_identity · scim_sync_log

### Group 7: Maturity & Lifecycle (v2.5-v2.6 new, 9 tables)

agent_version · behavior_fingerprint · cost_attribution · stage_rationale · marketplace_item · connector_instance · edge_sync_state · capacity_forecast · compliance_report

**Total**: 71 tables (v1.2 baseline 44 tables + v2.1-v2.6 new 27 tables). During implementation, **tables are created by Group in phases**, not required to be all in place at once.

---

# 27. Performance Architecture & SLO

## 27.1 OAPEFLIR Phase Performance Targets

| Phase | P99 Target | Description |
|-------|------------|-------------|
| Observe | < 50ms | Signal collection and aggregation (excluding external calls) |
| Assess | < 30ms | Assessment decisions (excluding LLM calls) |
| Plan | < 100ms | DAG construction and strategy selection (excluding LLM calls) |
| Execute | Depends on tool | Constrained by external dependencies, no unified target |
| Feedback | < 10ms | Signal preprocessing and deduplication |
| Learn | < 500ms | Pattern detection (asynchronous, does not block main chain) |
| Improve | < 1s | Candidate generation (asynchronous) |

## 27.2 Runtime SLO

| Metric | P99 Target | Degradation Threshold |
|--------|------------|----------------------|
| Dispatch latency | < 200ms | > 1s triggers alert |
| Lease acquisition | < 50ms | > 200ms triggers alert |
| Heartbeat round-trip | < 100ms | > 500ms marks unhealthy |
| Recovery detection | < 30s | > 60s triggers SEV3 incident |
| Projection lag | < 5s | > 30s triggers rebuild |
| Checkpoint write | < 20ms | > 100ms triggers alert |
| Event append | < 10ms | > 50ms triggers alert |

## 27.3 Availability Targets

| Component | Availability | Degradation Strategy |
|-----------|--------------|----------------------|
|------|--------|---------|
| API Gateway | 99.95% | Static error page |
| Control Plane | 99.9% | Read-only degradation |
| Execution Plane | 99.9% | Worker pool failover |
| State Plane | 99.99% | WAL + checkpoint recovery |
| Observability | 99.5% | Metrics can be dropped, audit cannot |

## 27.4 Capacity Planning

| Dimension | S1 Monolith | S2 Multi-Process | S3 Distributed |
|------|---------|----------|----------|
| Concurrent workflows | 10 | 50 | 500 |
| Active workers | 5 | 20 | 100 |
| Event/s | 100 | 500 | 5,000 |
| Storage | 1GB SQLite | 10GB SQLite | 100GB+ PG |

## 27.5 Performance Testing Requirements

* A load test must be run before every major change
* Load test scenarios: normal load / peak load / degradation / recovery
* Results are recorded as evidence and associated with the rollout

## 27.6 Error Budget Strategy

> Added in v2.1. Defines organizational response when SLO is violated.

**Error Budget Definition**: Availability SLO 99.9% → Monthly Error Budget = 43.2 minutes of downtime.

| Budget Consumed | Status | Response |
|------------|------|------|
| 0-50% | Normal | Normal release cadence |
| 50-80% | Warning | Slow down non-urgent change releases |
| 80-100% | Freeze | Only allow fix releases, pause feature rollout |
| > 100% | Exceeded | Full freeze + dedicated reliability fixes + management review |

**Burn Rate Alerts**:

* 1h burn rate > 14.4x (2% budget consumed in 1h) → SEV2 alert
* 6h burn rate > 6x (5% budget consumed in 6h) → SEV3 alert
* Use multi-window strategy to reduce false positives

## 27.7 LLM Latency Breakdown

LLM calls typically dominate end-to-end latency. Must be modeled separately:

| Latency Component | P99 Target | Description |
|---------|---------|------|
| Prompt rendering | < 5ms | Template filling + variable injection |
| ModelGateway routing | < 10ms | Provider selection + budget check |
| LLM TTFT (Time to First Token) | < 2s | Provider SLA, not controllable |
| LLM full generation | < 30s | Depends on output length, set max_tokens limit |
| Response parsing + validation | < 20ms | JSON parse + Zod validation |
| Total LLM call | < 35s | Timeout if exceeded |

**LLM latency is not counted toward the platform's own SLO**, but requires independent monitoring and alerting. When LLM P99 latency > 200% of baseline, trigger ModelGateway degradation strategy (see §15.4).

---

# 28. Event / Projection / Incident / DLQ Model

## 28.1 Event Namespaces (25)

workflow_run.* · loop_cycle.* · step_run.* · step_attempt.* · task.* · execution.* · execution_lease.* · worker.* · tool_call.* · side_effect.* · decision.* · artifact.* · memory.* · knowledge.* · rollout.* · incident.* · dlq.* · delegation.* · hibernation.* · prompt.* · eval.* · cost.* · approval_flow.* · agent_lifecycle.* · circuit_breaker.*

## 28.2 Core Events

workflow_run.created · workflow_run.failed · step_run.awaiting_decision · execution.leased · execution.failed · execution_lease.expired · tool_call.succeeded · side_effect.proposed · side_effect.committed · decision.requested · decision.approved · rollout.paused · rollout.rolled_back · incident.created · dlq.recorded · circuit_breaker.state_changed · config.changed

## 28.3 Projections (9)

workflow_run_projection · workflow_timeline_projection · approval_queue_projection · tool_usage_projection · worker_status_projection · incident_projection · artifact_catalog_projection · risk_action_projection · governance_projection

## 28.4 Projection Constraints

idempotent · replay-safe · event_id dedupe · rebuildable · must not write back to truth

## 28.5 Incident Constraints

An incident must link to: affected workflows / executions / workers / rollout / repair jobs / replay jobs / evidence bundles / resolution record

## 28.6 DLQ Constraints

DLQ must have: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status

---

# 29. Knowledge / Memory / Artifact / Learning Boundaries

## 29.1 Knowledge

Shared facts, rules, processes, and stable patterns.

**Hierarchy**: Personal → Team → Company

**Trust Level**: private_unverified → team_reviewed → official → authoritative

**Promotion**: personal → team → company. Preserve lineage / reviewer decision / trust change / audit event.

## 29.2 Memory

Runtime short-to-medium-term context. Decays · compresses · can be overwritten · used for context assembly.

**v2.0 Improvement**: Memory layering is explicitly defined as 6 layers: working → session → episodic → semantic → procedural → meta. Each layer has independent TTL and eviction strategies.

## 29.3 Artifact

Execution outputs and large objects; not responsible for control truth. Associated with workflow_run / step via reference (artifact_ref), not inlined into events.

## 29.4 Learning

Extracts candidate patterns from feedback. Learning does not directly change online behavior. A LearningObject must go through Improve → Validation → Approval → Rollout before taking effect.

---

# 30. Business Onboarding Constraints and Business Pack Model

> v2.2 Improvement: Business Pack must now be associated with a DomainDescriptor (§37). The Pack's risk control, knowledge retrieval, and evaluation strategies are driven by the domain descriptor.

## 30.1 Platform Capabilities That Business Packs Cannot Bypass

policy engine · approval engine · lease / fencing · artifact ref · audit · event log · projection contract · **domain descriptor(§37)**

## 30.2 Each Business Pack Must Declare

```typescript
interface BusinessPackManifest {
  pack_id: string;
  name: string;
  version: string;
  domain_id: string;                        // v2.2: Associated with DomainDescriptor(§37)
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

> **v2.2 Constraint**: `domain_id` is a required field and must point to a registered DomainDescriptor with Active status. During Pack registration, the platform automatically validates `domain_id` validity and applies the DomainRiskProfile risk overrides on top of the Pack's risk_matrix.

## 30.3 High-Risk Business Defaults to Supervised

operations · growth write actions · production release · finance-like actions → defaults to supervised in the first phase, full_auto is not allowed.

## 30.4 Pack Lifecycle

> Added in v2.1. Defines the complete flow from Pack development to deprecation.

| Phase | Description | Requirements | Output |
|------|------|------|------|
| Development | Local development using Pack SDK | Follow Manifest schema | Code + Manifest + eval dataset |
| Testing | Local mock testing + staging integration testing | Coverage ≥ 80% + eval passed | TestReport |
| Certification | Security review + risk assessment + platform compatibility check | Pass Pack checklist | CertificationRecord |
| Release | Register to Pack Registry + rollout | semver versioning | RolloutRecord |
| Operation | Execute under platform governance constraints | Continuous quality monitoring | metrics + incidents |
| Deprecation | Mark as deprecated + migration guide | Maintain for at least 6 months | DeprecationNotice |

## 30.5 Pack API Compatibility Contract

* Pack Manifest schema follows semver: minor versions only add fields, major versions allow breaking changes
* Platform upgrades must run the Pack compatibility test suite
* Breaking changes issue a deprecation warning 2 minor versions in advance
* Provide `agent-platform pack migrate` command to assist Pack upgrades

## 30.6 Plugin Governance

| Governance Dimension | Strategy |
|---------|------|
| Version management | semver + Plugin Registry |
| Dependency management | Declarative dependencies + conflict detection |
| Security certification | Automated security scanning + manual review (for high-privilege plugins) |
| Deprecation strategy | deprecated tag → 3-month migration period → archived |
| Compatibility | Each plugin declares min_platform_version |

---

# 31. Disaster Recovery and High Availability Architecture

> v1.2 did not cover disaster recovery. v2.0 defines high availability strategies from single node to multi-AZ.

## 31.1 Single Point of Failure Elimination

| Component | Single Point Risk | Elimination Strategy |
|------|---------|---------|
| API Gateway | Process crash | Multiple instances + load balancing |
| Dispatcher | Scheduling interruption | Leader election (lease-based) |
| Worker | Execution interruption | Lease timeout → automatic reclaim |
| Event Poller | Event backlog | Lease-based single instance + health check |
| Database | Data loss | WAL + scheduled backup / PG streaming replication |

## 31.2 High Availability Tiers

| Tier | Architecture | RTO | RPO |
|------|------|-----|-----|
| HA-1 Basic | Single node + scheduled backup | < 1h | < 15min |
| HA-2 Standard | Dual-node active-passive + WAL shipping | < 10min | < 1min |
| HA-3 Enterprise | Multi-AZ active-active + PG streaming | < 1min | 0 (synchronous replication) |

## 31.3 Backup and Recovery

* **Data backup**: Use `.backup()` API during SQLite phase, use pg_basebackup during PG phase
* **Event replay**: Rebuild all projections and artifact catalog from event_log
* **Configuration backup**: config_version table has built-in history, can roll back to any point
* **Disaster recovery drill**: At least once per quarter, record actual RTO/RPO values

## 31.4 Data Integrity Protection

* All write operations are protected by CAS + Lease + Fencing
* Event log uses append-only mode, modification of historical events is not allowed
* Checkpoints are protected by WAL, recoverable after process crash
* Truth table and event log are updated within the same transaction

---

# 32. Deployment Architecture

> v1.2 directly specified 18 microservices. v2.0 adopts a **monolith-first, progressive decomposition** strategy.

## 32.1 Deployment Evolution

### Phase D1: Modular Monolith

```text
┌─────────────────────────────────────────┐
│            Agent Platform (single process) │
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

Applicable: development, testing, small-scale production (≤10 concurrency).

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

Applicable: medium-scale production (≤50 concurrency), workers can scale horizontally.

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

Applicable: large-scale production (≤500 concurrency), each plane scales independently.

## 32.2 Environment Partitioning

dev · test · staging · prod

## 32.3 Resource Pools

read-only worker pool · write-enabled worker pool · high-risk isolated pool · browser worker pool · plugin isolated pool

---

# 33. Phased Implementation Roadmap

> v1.2 only had "do first / do next". v2.0 adds **acceptance gates**, **dependency relationships**, and **specific deliverables**.

## Phase 1: Steady-State Skeleton (8 weeks)

### Deliverables

* truth tables + event log + UoW (Group 1 tables)
* lease / fencing / CAS
* idempotency
* artifact ref
* policy outcome + decision model (Group 2 tables)
* Minimal ops CLI (doctor / inspect)
* Unit test ≥ 80% coverage

### Acceptance Gates

* [ ] workflow_run can be stably created and advanced (no degradation)
* [ ] Lease automatically reclaims after timeout
* [ ] CAS conflicts are correctly rejected
* [ ] Events are appended and truth tables updated within the same transaction

### Dependencies

No external dependencies. SQLite + Node.js is sufficient to start.

## Phase 2: Controlled Automation (8 weeks)

### Deliverables

* OAPEFLIR main chain O→A→P→E→F
* risk assessment engine
* approval gates (basic)
* side effect tracking
* recovery workers (LeaseReclaimer + StuckRunSweeper)
* 2 Business Packs: coding.fix_bug + operations.resolve_incident

### Acceptance Gates

* [ ] Main chain runs end-to-end (task creation → execution → completion)
* [ ] High-risk steps trigger approval blocking
* [ ] Execution resumes within 30s after worker crash
* [ ] Side effects are queryable and auditable

### Dependencies

Phase 1 fully accepted.

## Phase 3: Enterprise Reliability (12 weeks)

### Deliverables

* OAPEFLIR secondary chain F→L→I→R
* circuit breaker + degradation mode switching
* backpressure (4 modes)
* incident management + DLQ operations
* projection rebuild
* replay / repair
* Configuration governance (versioned + canary)
* Multi-tenant isolation hardening
* PostgreSQL migration (optional)

### Acceptance Gates

* [ ] Automatic degradation when external dependency circuit breaks, automatic recovery when restored
* [ ] DLQ is queryable, retriable, and closable
* [ ] Incident closed-loop handling chain is connected
* [ ] Data is consistent after projection rebuild
* [ ] Configuration changes are rollbackable

### Dependencies

Phase 2 fully accepted.

## Phase 4: Scalable Expansion (Ongoing)

### Deliverables

* Worker separated deployment (Phase D2)
* More Business Packs
* Browser execution deepening
* Plugin ecosystem
* SLO automated monitoring
* Compliance export
* Disaster recovery drills

### Acceptance Gates

* [ ] 50 concurrent workflows running stably
* [ ] Multi-tenant isolation verification passed
* [ ] Load test meets §27 SLO
* [ ] Disaster recovery drill RTO < 10min

## Phase 5: Intelligent Interaction and Organizational Governance (12 weeks)

> Corresponds to v2.3-v2.4 architecture layers.

### Deliverables

* Natural language task entry (§39) + goal decomposition engine (§40)
* Proactive Agent framework (§41) + progressive autonomy model (§42)
* Unified operations dashboard (§43) + non-technical user experience (§44)
* Organizational hierarchy model (§46) + approval routing (§47) + SSO/SCIM (§48)
* Compliance policy engine (§49) + knowledge domain isolation (§50) + governance delegation (§51)

### Acceptance Gates

* [ ] Non-technical users can create and manage tasks via natural language
* [ ] Goal decomposition engine automatically breaks down business goals into executable task graphs
* [ ] Progressive autonomy L0→L3 upgrade path verified end-to-end
* [ ] Three-level organizational hierarchy correctly drives approval routing
* [ ] SSO/SCIM auto-syncs users and deactivated accounts take effect in < 5min
* [ ] Knowledge domain isolation has zero leakage, controlled sharing audit is complete

### Dependencies

Phase 4 fully accepted.

## Phase 6: Scale and Ecosystem (12 weeks)

> Corresponds to v2.5 architecture layer.

### Deliverables

* Multi-Region deployment (§52) + resource contention management (§53) + SLA tiering (§54)
* Agent marketplace (§55) + feedback improvement pipeline (§56) + external integration framework (§57)

### Acceptance Gates

* [ ] Dual-Region Active-Active deployment, single Region failure RTO < 5min
* [ ] Under 1000 concurrent workflows, high-priority tasks do not starve
* [ ] SLA Tier P0 tasks complete within committed time 99.9% of the time
* [ ] Marketplace has at least 20 certified Packs listed
* [ ] User feedback → improvement closed loop < 7 days

### Dependencies

Phase 5 fully accepted.

## Phase 7: Operational Maturity (Ongoing)

> Corresponds to v2.6 architecture layer.

### Deliverables

* Explainability (§59) + emergency brake (§60) + lifecycle management (§61)
* Offline/edge deployment (§62) + behavior drift detection (§63) + cost optimization (§64)
* Visual debugger (§65) + compliance reporting (§66) + capacity planning (§67)
* Multimodal capabilities (§68) + platform self-ops Agent (§69)

### Acceptance Gates

* [ ] Users can query explanations for any step, L1 latency < 2s
* [ ] Emergency brake drill: full platform stop < 5s, recovery < 30min
* [ ] EdgeRuntime recovers after 24h offline with zero data loss on sync
* [ ] Behavior drift > 2σ triggers alerts 100% of the time
* [ ] Compliance report SOC2 Type II control point coverage ≥ 95%
* [ ] PlatformOps Agent L1 maturity verification passed

### Dependencies

Phase 6 fully accepted.

## 33.1 Phase Dependency Graph

```text
Phase 1 (Steady-State Skeleton)
    │
    ▼
Phase 2 (Controlled Automation)
    │
    ▼
Phase 3 (Enterprise Reliability)
    │
    ▼
Phase 4 (Scalable Expansion)
    │
    ▼
Phase 5 (Intelligent Interaction & Organizational Governance)
    │
    ▼
Phase 6 (Scale & Ecosystem)
    │
    ▼
Phase 7 (Operational Maturity)
```

Each Phase cannot be skipped and must be accepted in order.

---

# 34. ADR Freeze Recommendations

v1.2's 19 ADRs are recommended to be retained. v2.0 adds 4, v2.1 adds 9, v2.2 adds 4, v2.3 adds 6, v2.4 adds 6, v2.5 adds 6, v2.6 adds 11:

**v1.2 Original (19)**:
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries

**v2.0 Added (4)**:
* **ADR-Plane-Communication-Contracts** — The five planes must communicate through formal contract objects
* **ADR-Repository-Abstraction-Layer** — All storage access goes through Repository interface
* **ADR-Single-Process-First** — Deployment starts as monolith, decompose after validation
* **ADR-API-Versioning-Strategy** — API versioning and backward compatibility strategy

**v2.1 Added (9)**:
* **ADR-ModelGateway-As-Single-LLM-Entry** — All LLM calls must go through ModelGateway, direct provider SDK calls are prohibited
* **ADR-Prompt-As-Versioned-Resource** — Prompts are not inlined in code, managed independently as versioned resources
* **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model changes must pass quality gates
* **ADR-Per-Tenant-Cost-Metering** — All LLM costs must be metered per tenant
* **ADR-Delegation-Depth-Limit** — Maximum delegation depth between Agents = 3
* **ADR-Workflow-Hibernation-Model** — Long-waiting workflows must release workers and persist state
* **ADR-Crypto-Shredding-For-Erasure** — GDPR deletion implemented via crypto-shredding
* **ADR-Pack-Semver-Compatibility** — Pack Manifest API follows semver compatibility contract
* **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM latency is monitored independently, not counted toward the platform's own SLO

**v2.2 Added (4)**:
* **ADR-Domain-Descriptor-As-Semantic-Layer** — Each Business Pack must be associated with a DomainDescriptor; domain semantics are not embedded in Pack code
* **ADR-Domain-Risk-Override-Over-Platform-Default** — Domain risk profile overrides take priority over platform default risk matrix; overrides require audited justification
* **ADR-Domain-Recipe-As-Onboarding-Accelerator** — New business domains must start from one of four archetype templates; blank onboarding is prohibited
* **ADR-Four-Phase-Domain-Onboarding** — Business domain onboarding must pass four-phase gates (modeling → development → certification → canary); skipping is not allowed

**v2.3 Added (6)**:
* **ADR-NL-Intent-Must-Resolve-To-RequestEnvelope** — Natural language input must go through Intent resolution to generate a structured RequestEnvelope (§5.3); passing raw text directly to Agents is prohibited
* **ADR-Goal-Decomposition-Max-Depth** — Goal decomposition engine recursion depth limit = 5; exceeding requires manual confirmation of the decomposition plan
* **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — Proactive Agents must be bound to a TriggerPolicy; unconditional polling is prohibited
* **ADR-Autonomy-Level-Guarded-Progression** — Progressive autonomy levels default to monotonically increasing (promotion requires meeting score threshold + approval); demotion only occurs under safety trigger conditions defined in §42.2 (P0 Incident / consecutive failures / cost overrun); after demotion, manual approval confirmation and reason recording are required, and recovery follows the promotion rules
* **ADR-Dashboard-Metric-Source-Of-Truth** — Unified operations dashboard data must come from the State & Evidence Plane; reading Runtime internal state directly is prohibited
* **ADR-No-Code-UX-Maps-To-Standard-API** — Non-technical user interface operations must map to standard Public API; bypass is prohibited

**v2.4 Added (6)**:
* **ADR-Org-Hierarchy-As-First-Class-Model** — Organizational hierarchy (Enterprise → Business Group → Department → Team) as a first-class model; all resource ownership must be associated with an OrgNode
* **ADR-Approval-Route-From-Org-Chart** — Approval routing must be dynamically derived from the organizational structure; hardcoding approver lists is prohibited
* **ADR-SSO-As-Single-Identity-Source** — Enterprise SSO is the sole identity source; the platform does not maintain independent user passwords
* **ADR-Compliance-Policy-Inherits-Down** — Compliance policies inherit down the organizational tree; child nodes can only tighten, not loosen
* **ADR-Knowledge-Boundary-Default-Deny** — Knowledge domains are isolated by default; cross-department sharing requires explicit authorization and audit logging
* **ADR-Governance-Delegation-Requires-Scope** — Governance delegation must specify scope (resource type + OrgNode range); global delegation is prohibited

**v2.5 Added (6)**:
* **ADR-Multi-Region-Active-Active-With-Home-Region** — Multi-Region uses Active-Active architecture; each tenant has a Home Region; cross-Region data is asynchronously replicated
* **ADR-Resource-Contention-Fair-Queue** — Scaled deployments must use weighted fair queues; simple FIFO causing high-priority task starvation is prohibited
* **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA tier determines resource quota, queue priority, and failure recovery order
* **ADR-Marketplace-Pack-Must-Pass-Certification** — Packs listed on the Agent marketplace must pass platform certification (security scan + sandbox testing + performance baseline)
* **ADR-Feedback-Loop-Closed-Within-SLA** — User feedback must form a closed loop within the SLA-defined time window (collection → analysis → improvement → verification)
* **ADR-Integration-Through-Unified-Connector** — External system integration must go through the unified Connector framework; business code directly calling external APIs is prohibited

**v2.6 Added (11)**:
* **ADR-Every-Decision-Must-Have-Rationale** — Each OAPEFLIR stage must generate a StageRationale; decision explanations are rendered on demand
* **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective must atomically halt the entire platform within 5 seconds; recovery requires dual-person approval
* **ADR-Agent-As-Composite-Entity** — Agent as a composite entity of Pack+Prompt+Model+Trust+Trigger, with AgentVersion as the unit for release and rollback
* **ADR-Edge-Runtime-Risk-Ceiling** — Offline EdgeRuntime only allows execution of actions with risk_level ≤ medium; high-risk actions wait for connection recovery
* **ADR-Behavior-Fingerprint-Mandatory** — Each Agent must maintain a BehaviorFingerprint; drift detection covers four windows: 1h/7d/30d/90d
* **ADR-Cost-Attribution-Per-Decision** — Cost attribution must be precise to the decision level (individual LLM call); optimization recommendations must include quality_risk assessment
* **ADR-Workflow-Debug-Session-Isolated** — Debug sessions run in isolated sandboxes; breakpoint pauses do not affect other workflows
* **ADR-Compliance-Report-Template-Versioned** — Compliance report templates must be versioned; report generation locks the template version
* **ADR-Capacity-Forecast-Drives-Scaling** — Capacity forecast results must be linked to scaling recommendations; scaling recommendations must include cost impact estimates
* **ADR-Multimodal-Safety-Check-Before-Output** — Multimodal outputs (images/audio) must pass content safety checks before being delivered to users
* **ADR-PlatformOps-Agent-Read-Only-Default** — Platform self-ops Agent defaults to read-only; production write operations must go through manual approval

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
      scheduler/
      dispatcher/
      execution-engine/
      worker-pool/
      tool-executor/
      plugin-executor/
      adapter-executor/
      browser-executor/
      human-wait-executor/
      recovery/

    state-evidence/     # P5
      truth/
      events/
      projections/
      artifacts/
      memory/
      knowledge/
      audit/
      incident/
      checkpoints/
      dlq/

    model-gateway/      # LLM abstraction layer (v2.1)
      provider-registry/
      router/
      cache/
      cost-tracker/
      fallback/

    prompt-engine/      # Prompt management (v2.1)
      registry/
      renderer/
      rollout/
      eval/

    compliance/         # Compliance and data governance (v2.1)
      erasure/
      encryption/
      data-residency/
      lineage/

    contracts/          # Inter-plane contracts
      request-envelope/
      control-directive/
      execution-plan/
      execution-receipt/
      state-command/
      delegation-request/
      model-request/

  domains/                # Business domain modeling (v2.2)
    registry/             # DomainDescriptor registration and lifecycle
    risk-profile/         # DomainRiskProfile domain risk profile
    knowledge-schema/     # DomainKnowledgeSchema domain knowledge structure
    eval-framework/       # DomainEvalFramework domain evaluation
    prompt-library/       # DomainPromptLibrary domain Prompt library
    recipes/              # DomainRecipe archetype templates
    interaction-policy/   # DomainInteractionPolicy cross-domain policies
    governance/           # DomainGovernancePolicy domain governance
    coding/               # Code development domain instance
    operations/           # Operations domain instance

  interaction/            # Intelligent interaction layer (v2.3)
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

  org-governance/         # Organizational governance layer (v2.4)
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
    compliance-engine/    # Per-department compliance policy engine
      policy-resolver/
      inheritance/
      audit-enforcer/
    knowledge-boundary/   # Knowledge domain isolation and controlled sharing
      boundary-manager/
      sharing-gate/
      access-log/
    delegated-governance/ # Tiered governance delegation
      scope-manager/
      delegation-registry/

  scale-ecosystem/        # Scale runtime layer + ecosystem layer (v2.5)
    multi-region/         # Multi-Region deployment
      region-router/
      data-replicator/
      failover-controller/
    resource-manager/     # Resource contention management
      fair-queue/
      quota-enforcer/
      preemption/
    sla-engine/           # SLA tiered guarantee
      tier-resolver/
      resource-allocator/
      breach-detector/
    marketplace/          # Agent marketplace and ecosystem
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

  ops-maturity/           # Operational maturity layer (v2.6)
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
    edge-runtime/         # Offline and edge deployment
      edge-orchestrator/
      edge-executor/
      local-model/
      sync-queue/
    drift-detection/      # Behavior drift detection
      fingerprint-builder/
      changepoint-detector/
      cross-agent-analyzer/
    cost-optimizer/       # Cost attribution and optimization
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

  sdk/                  # SDK (v2.1)
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
---

# 36. Risks, Constraints, and Success Criteria

## 36.1 Major Risks

* Unstable model output
* Uncontrollable tool side effects
* Insufficient recovery chain making automation unreliable as a fallback
* Projection bias mistaken for ground truth
* Mis-learning causing behavioral drift
* Incomplete multi-tenant isolation
* Pack model non-convergence causing the platform to be inversely invaded by business logic
* Budget overrun
* replay / rebuild mis-operations amplifying problems
* **(v2.1) Complete unavailability of LLM providers causing platform paralysis**
* **(v2.1) Prompt changes introducing behavioral regression**
* **(v2.1) LLM cost overrun (token overspend)**
* **(v2.1) Agent delegation chain recursive runaway**
* **(v2.3) NL Intent parsing ambiguity causing incorrect task creation**
* **(v2.3) Goal decomposition recursion too deep causing task explosion**
* **(v2.3) Proactive Agent infinite triggering forming a storm**
* **(v2.3) Progressive autonomy mis-escalation causing loss of control over high-risk actions**
* **(v2.4) Organization structure change synchronization delay causing approval routing errors**
* **(v2.4) Knowledge isolation misconfiguration causing cross-department data leakage**
* **(v2.4) Governance delegation scope too broad causing security degradation**
* **(v2.5) Cross-Region data replication delay causing consistency issues**
* **(v2.5) Resource competition management failure causing high-priority task starvation**
* **(v2.5) Marketplace malicious Pack passing certification and causing security incidents**
* **(v2.6) Explainability pipeline LLM call cost overrun (frequent forensic-level explanations)**
* **(v2.6) Emergency brake false trigger causing platform-wide unwarranted downtime**
* **(v2.6) Agent composite version canary test insufficient coverage causing combinatorial defect escape**
* **(v2.6) EdgeRuntime accumulating large amounts of side effects during offline state, conflict explosion upon connection recovery**
* **(v2.6) Behavioral drift detection false positives causing frequent Agent demotion impacting business**
* **(v2.6) Multimodal content safety check missed judgment causing non-compliant content output**

## 36.2 Hard Constraints

* Runtime only consumes published-state definitions
* Projection does not write back to ground truth
* Learn does not directly drive online changes
* Secrets do not enter Memory / Knowledge / external Artifacts
* All outbound calls go through egress control
* All side effects must be recorded as objects
* High-risk actions must be approved or explicitly denied
* CAS + Lease + Fencing are hard constraints for write-back
* Cross-plane communication must go through formal contract objects
* **(v2.1) All LLM calls must go through ModelGateway**
* **(v2.1) Prompt changes must pass quality gates**
* **(v2.1) LLM costs must be metered per tenant**
* **(v2.1) Agent delegation depth ≤ 3**
* **(v2.1) PII data deletion implemented via crypto-shredding**
* **(v2.3) NL input must go through Intent parsing to generate RequestEnvelope(§5.3); raw text pass-through is prohibited**
* **(v2.3) Goal decomposition recursion depth ≤ 5**
* **(v2.3) Proactive Agents must be bound to a TriggerPolicy**
* **(v2.3) Autonomy level defaults to monotonically increasing; demotion is limited to §42.2 safety trigger conditions, and human approval confirmation is required after execution**
* **(v2.4) All resources must be associated with an OrgNode**
* **(v2.4) Compliance policies inherit downward along the organization tree; child nodes can only tighten**
* **(v2.4) Knowledge domains are isolated by default; cross-department sharing requires explicit authorization**
* **(v2.4) SSO is the sole identity source**
* **(v2.5) Each tenant must specify a Home Region**
* **(v2.5) Marketplace Packs must pass certification before listing**
* **(v2.5) External system integration must go through the unified Connector framework**
* **(v2.6) OAPEFLIR must generate a StageRationale for each stage**
* **(v2.6) PlatformPanicDirective: same Region < 5s, cross Region < 15s to halt the entire platform**
* **(v2.6) Agent publishing and rollback use AgentVersion (composite snapshot) as the unit**
* **(v2.6) EdgeRuntime offline mode risk_level ≤ medium**
* **(v2.6) Each Agent must maintain a BehaviorFingerprint**
* **(v2.6) Multimodal output must pass content safety checks**
* **(v2.6) PlatformOps Agent is read-only by default; production write operations require human approval**

## 36.3 Success Criteria

### Phase 1 Success Criteria

* workflow_run can be stably created and advanced
* lease timeout triggers automatic reclaim
* CAS conflicts are correctly rejected

### Phase 2 Success Criteria

* OAPEFLIR main chain runs end-to-end
* worker recovers within 30s after crash
* High-risk actions can be blocked by approval

### Phase 3 Success Criteria

* incident / replay / repair / DLQ are operationally viable
* External dependency circuit-break → degradation → recovery is automated
* projection can be rebuilt with data consistency

### Phase 4 Success Criteria

* 50 concurrent workflows running stably
* Load test meets SLO
* Disaster recovery drill RTO < 10min

### Phase 5 Success Criteria (v2.3-v2.4)

* Non-technical users can create and manage tasks via natural language
* Goal decomposition engine automatically breaks down business goals into executable task graphs
* Proactive Agents auto-trigger per TriggerPolicy with no storms
* Progressive autonomy Level 0→3 upgrade path verified end-to-end
* Three-level organization hierarchy (Company→Department→Team) correctly drives approval routing
* SSO/SCIM automatically syncs users and disabled accounts take effect < 5min
* Knowledge domain isolation with zero leakage, controlled sharing with complete audit

### Phase 6 Success Criteria (v2.5)

* Dual-Region Active-Active deployment, single Region failure RTO < 5min
* Under 1000 concurrent workflows, high-priority tasks do not starve
* SLA Tier P0 tasks 99.9% completed within committed time
* Marketplace has at least 20 certified Packs listed
* User feedback → improvement closed loop < 7 days
* Pre-built Connectors cover all systems in P0 categories

### Phase 7 Success Criteria (v2.6)

* Users can query explanations for any workflow step, L1 latency < 2s, L3 latency < 10s
* Emergency brake drill: same Region full platform halt < 5s, recovery < 30min
* AgentVersion composite canary release verified end-to-end (canary→active auto-promotion)
* EdgeRuntime reconnects after 24h offline with zero data loss during sync
* Behavioral drift detection triggers alert 100% when Agent behavior distribution deviates > 2σ
* Cost optimization recommendations achieve savings rate ≥ 20% (compared to unoptimized baseline)
* Compliance report SOC2 Type II fully auto-generated, control point coverage ≥ 95%
* Capacity forecasting 30-day accuracy ≥ 85%
* Multimodal: image analysis + speech-to-text end-to-end available
* PlatformOps Agent L1 maturity verification: auto-diagnostic report generation < 5min

---

# 37. Business Domain Modeling and Onboarding Architecture

> v2.2 new addition. Addresses the core question of "how does the platform serve diverse internal enterprise businesses once built."
> Related: §30 Business Pack Model · §22 SDK/DX · §10 Risk Control · §16 Prompt Management · §17 Model Evaluation · §29 Knowledge/Memory

## 37.1 Problem Statement

12+ vertical business lines within the enterprise have fundamental differences across the following dimensions:

| Dimension | Code Development | Content Production | Finance | Live Commerce | Customer Service |
|-----------|-----------------|-------------------|---------|---------------|------------------|
| Risk Level | High (production changes) | Medium (brand compliance) | Critical (funds) | High (real-time decisions) | Low (information queries) |
| Time Sensitivity | Minute-level | Hour-level | Day-level (approval chains) | Second-level | Second-level |
| Knowledge Freshness | Codebase real-time | Brand guidelines monthly | Regulations quarterly | Inventory second-level | FAQ weekly |
| Evaluation Dimensions | Compilation pass + test coverage | Aesthetics + brand consistency | Accuracy + compliance | GMV conversion rate | Resolution rate + satisfaction |
| Approval Requirements | Code Review | Design review | Four-eyes principle + tiered approval | Automatic (within rules) | None |
| Reversibility | Git revert | Version rollback | Reversal/reconciliation | Irreversible (already broadcast) | Can resend |

**The current §30 Business Pack compresses the above differences into a flat `BusinessPackManifest`**, unable to express domain semantics, unable to drive differentiated risk control, and unable to guide domain Prompt strategies.

## 37.2 DomainDescriptor — Domain Descriptor

Each business domain must provide a structured domain descriptor when onboarding to the platform, serving as the foundation for the platform to understand, constrain, and optimize Agent behavior in that domain:

```typescript
interface DomainDescriptor {
  domain_id: string;                          // e.g. "finance", "content-production"
  domain_name: string;                        // Human-readable name
  domain_class: DomainClass;                  // Domain classification
  version: string;                            // descriptor version

  entities: DomainEntity[];                   // Domain core entities
  capabilities: DomainCapability[];           // Domain capability declarations
  workflows: DomainWorkflowTemplate[];        // Typical workflow templates
  vocabulary: DomainVocabulary;               // Domain glossary
  constraints: DomainConstraint[];            // Domain hard constraints

  risk_profile: DomainRiskProfile;            // → §37.3
  knowledge_schema: DomainKnowledgeSchema;    // → §37.4
  eval_framework: DomainEvalFramework;        // → §37.5
  prompt_library: DomainPromptLibrary;        // → §37.6
  governance: DomainGovernancePolicy;         // → §37.9
}

type DomainClass =
  | "crud_heavy"       // HR, Customer Service, Enterprise Knowledge Base
  | "analytics"        // Data Analytics, Ad Reporting
  | "creative"         // Content Production, Game Assets
  | "realtime"         // Live Commerce, Security Operations
  | "transactional"    // Finance, Orders
  | "engineering"      // Code Development, CI/CD
  | "hybrid";          // Multi-archetype hybrid

interface DomainEntity {
  entity_name: string;                        // e.g. "Invoice", "Creative Asset"
  operations: ("create" | "read" | "update" | "delete" | "approve" | "archive")[];
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  audit_level: "none" | "basic" | "full" | "forensic";
}

interface DomainCapability {
  capability_id: string;                      // e.g. "generate-ad-copy"
  risk_level: "low" | "medium" | "high" | "critical";
  requires_approval: boolean;
  max_automation_level: "suggestion" | "supervised" | "semi_auto" | "full_auto";
  tool_bindings: string[];                    // Associated tool bundle IDs
}

interface DomainConstraint {
  constraint_id: string;
  type: "regulatory" | "business_rule" | "sla" | "data_boundary";
  description: string;
  enforcement: "hard_block" | "soft_warn" | "audit_only";
}
```

**Design Decision**: DomainDescriptor does not replace BusinessPackManifest (§30), but rather serves as the **domain semantic layer** for Packs. A Pack is associated with one DomainDescriptor, and multiple Packs can share the same DomainDescriptor (e.g., "HR Onboarding Pack" and "HR Payroll Pack" share `domain_id: "hr"`).

## 37.3 DomainRiskProfile — Domain Risk Profile

The generic risk matrix (§10) provides platform-level defaults; DomainRiskProfile provides **domain-level overrides**, allowing the same action to trigger different risk control strategies in different business domains:

```typescript
interface DomainRiskProfile {
  domain_id: string;
  regulatory_class: "unregulated" | "lightly_regulated" | "regulated" | "heavily_regulated";
  time_sensitivity: "batch" | "near_realtime" | "realtime" | "ultra_realtime";
  reversibility: "fully_reversible" | "partially_reversible" | "irreversible";
  blast_radius: "single_user" | "team" | "department" | "company" | "external";

  risk_overrides: RiskOverride[];
  escalation_chain: EscalationLevel[];
  mandatory_approvals: ApprovalRule[];
}

interface RiskOverride {
  action_pattern: string;           // glob pattern, e.g. "finance.payment.*"
  base_risk: number;                // Platform default risk score
  domain_risk: number;              // Domain override risk score
  reason: string;                   // Override reason (for audit)
  requires_justification: boolean;  // Whether Agent must provide execution justification
}

interface EscalationLevel {
  level: number;
  trigger: string;                  // e.g. "risk_score > 80"
  target: "domain_owner" | "platform_sre" | "security_team" | "executive";
  response_sla: string;             // e.g. "5m", "1h", "24h"
}
```

**Domain Risk Profile Application Examples**:

| Scenario | Platform Default Risk | Domain Override Risk | Result |
|----------|----------------------|---------------------|--------|
| `tool.http.post` | 60 | Finance domain → 90 | Mandatory four-eyes approval |
| `tool.http.post` | 60 | Customer Service domain → 40 | Automatic execution |
| `tool.file.write` | 50 | Code Development domain → 70 (production branch) | Code Review gate |
| `tool.file.write` | 50 | Content Production domain → 30 | Auto-save draft |

## 37.4 DomainKnowledgeSchema — Domain Knowledge Structure

Defines the knowledge retrieval strategy, freshness requirements, and conflict resolution rules for each business domain, interfacing with §29 Knowledge/Memory layer:

```typescript
interface DomainKnowledgeSchema {
  domain_id: string;
  knowledge_sources: KnowledgeSource[];
  retrieval_strategy: RetrievalStrategy;
  freshness_policy: FreshnessPolicy;
  conflict_resolution: ConflictResolution;
}

interface KnowledgeSource {
  source_id: string;
  type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
  priority: number;                         // Retrieval priority
  refresh_interval: string;                 // e.g. "5m", "1d", "on_demand"
  auth_scope: string;                       // Access permission scope
}

interface RetrievalStrategy {
  mode: "semantic_search" | "keyword" | "hybrid" | "structured_query" | "graph_traverse";
  top_k: number;
  rerank: boolean;
  domain_specific_filters: Record<string, string>;  // Domain-level filter conditions
}

interface FreshnessPolicy {
  max_staleness: string;                    // Maximum acceptable staleness
  on_stale: "warn_and_use" | "block_and_refresh" | "fallback_to_cached";
  critical_sources: string[];               // Data source IDs that must be real-time
}

interface ConflictResolution {
  strategy: "source_priority" | "timestamp_latest" | "human_review" | "domain_rule";
  domain_rules?: Record<string, string>;    // Domain-level conflict resolution rules
}
```

**Domain Knowledge Difference Examples**:

| Business Domain | Retrieval Mode | Freshness Requirement | Conflict Strategy |
|----------------|----------------|----------------------|-------------------|
| Code Development | structured_query (AST/Git) | Real-time (HEAD commit) | timestamp_latest |
| Finance | structured_query (ERP API) | Day-level (T+1 reconciliation) | human_review |
| Live Commerce | api_realtime (inventory/pricing) | Second-level | source_priority (inventory system takes precedence) |
| Enterprise Knowledge Base | hybrid (semantic + keyword) | Weekly | domain_rule (highest version number takes precedence) |

## 37.5 DomainEvalFramework — Domain Evaluation Framework

The generic model evaluation (§17) provides platform-level quality gates; DomainEvalFramework defines **domain-specific quality axes and evaluation criteria**:

```typescript
interface DomainEvalFramework {
  domain_id: string;
  quality_axes: QualityAxis[];
  automated_checks: AutomatedCheck[];
  human_eval_rubric: EvalRubric[];
  regression_dataset: RegressionDataset;
  acceptance_threshold: Record<string, number>;  // axis_id → minimum score
}

interface QualityAxis {
  axis_id: string;                          // e.g. "code_correctness", "brand_consistency"
  weight: number;                           // Normalized weight
  evaluator: "llm_judge" | "rule_engine" | "human" | "automated_test" | "metric_api";
  description: string;
}

interface AutomatedCheck {
  check_id: string;
  type: "regex" | "ast_lint" | "policy_rule" | "external_api" | "llm_classifier";
  config: Record<string, unknown>;
  blocking: boolean;                        // Whether this is a release-blocking item
}

interface RegressionDataset {
  dataset_id: string;
  size: number;
  refresh_cadence: string;
  golden_answer_source: "human_labeled" | "production_approved" | "expert_curated";
}
```

**Domain Evaluation Dimension Differences**:

| Business Domain | Core Quality Axes | Automated Checks | Regression Data Source |
|----------------|-------------------|------------------|----------------------|
| Code Development | Compilation pass, test coverage, security scan | AST lint + unit test execution | Code from approved PRs |
| Content Production | Brand consistency, aesthetic score, dimension compliance | Dimension/format validation + LLM aesthetic scoring | Design team annotations |
| Finance | Numerical accuracy, compliance, audit traceability | Amount validation + regulatory rule engine | Expert audit samples |
| Ad Delivery | CTR prediction accuracy, budget compliance, creative compliance | Budget cap check + advertising regulation check | A/B test historical data |

## 37.6 DomainPromptLibrary — Domain Prompt Library

Interfaces with §16 Prompt Management System, providing **domain-level Prompt assets** for each business domain, avoiding scattered Prompt fragments:

```typescript
interface DomainPromptLibrary {
  domain_id: string;
  system_prompts: DomainSystemPrompt[];
  few_shot_examples: FewShotExample[];
  domain_instructions: DomainInstruction[];
  forbidden_patterns: ForbiddenPattern[];
}

interface DomainSystemPrompt {
  prompt_id: string;
  scenario: string;                         // e.g. "code_review", "invoice_processing"
  template: string;                         // Prompt template with variable placeholders
  variables: PromptVariable[];
  version: string;
  eval_dataset_id: string;                  // Associated evaluation dataset
}

interface FewShotExample {
  example_id: string;
  scenario: string;
  input: string;
  expected_output: string;
  quality_score: number;                    // Annotation quality score
  source: "production_approved" | "expert_crafted" | "synthetic";
}

interface DomainInstruction {
  instruction_id: string;
  type: "always" | "conditional" | "fallback";
  condition?: string;                       // Trigger condition expression
  content: string;                          // Instruction injected into system prompt
}

interface ForbiddenPattern {
  pattern_id: string;
  regex: string;
  description: string;                      // Why it is forbidden
  action: "block_response" | "redact" | "escalate";
}
```

**Relationship between Prompt Library and Prompt Management System (§16)**: DomainPromptLibrary is a domain-level Prompt asset registered in §16's PromptRegistry. Prompt versioning, canary release, and rollback capabilities are provided by §16; the domain Prompt library is only responsible for **content definition and domain adaptation**.

## 37.7 DomainRecipe — Domain Templates and Archetypes

Common business domains are categorized into four **archetype templates**. When a new business onboards, it selects the closest archetype and rapidly generates a DomainDescriptor skeleton based on the template:

| Archetype | Core Pattern | Applicable Business Domains | Typical Workflow |
|-----------|-------------|---------------------------|-----------------|
| **CRUD-heavy** | Read→Query→Modify→Confirm | HR, Customer Service, Enterprise Knowledge Base | Issue received→Query→Process→Feedback |
| **Analytics** | Collect→Analyze→Visualize→Decide | Data Analytics, Ad Reporting | Data query→Analysis→Generate report→Recommend actions |
| **Creative** | Generate→Review→Iterate→Publish | Content Production, Game Assets | Requirement understanding→Generation→Human review→Iteration→Publish |
| **Realtime** | Monitor→Detect→Respond→Record | Live Commerce, Security Operations | Event stream listening→Anomaly detection→Automatic response→Post-mortem review |

```typescript
interface DomainRecipe {
  recipe_id: string;
  archetype: "crud_heavy" | "analytics" | "creative" | "realtime";
  name: string;
  description: string;

  scaffold: {
    entities: DomainEntity[];               // Pre-set entity templates
    capabilities: DomainCapability[];       // Pre-set capability declarations
    workflows: DomainWorkflowTemplate[];    // Pre-set workflows
    risk_profile_template: Partial<DomainRiskProfile>;
    knowledge_schema_template: Partial<DomainKnowledgeSchema>;
    eval_axes_template: QualityAxis[];
    prompt_templates: DomainSystemPrompt[];
  };

  customization_points: CustomizationPoint[];  // Customization points that must be filled by the business team
  validation_rules: ValidationRule[];          // Validation rules after customization
}

interface CustomizationPoint {
  path: string;                             // JSON path, e.g. "entities[0].operations"
  required: boolean;
  description: string;
  default_value?: unknown;
}
```

**Usage Flow**:

1. Business team selects archetype via CLI: `agent-platform domain init --archetype=crud_heavy --name=hr`
2. System generates DomainDescriptor skeleton, marking all `customization_points`
3. Business team fills in required items (entities, tool bindings, approval rules, etc.)
4. CLI runs `agent-platform domain validate` to verify completeness
5. Upon passing, proceed to §38 Onboarding Runbook flow

## 37.8 DomainInteractionPolicy — Cross-Domain Interaction Policy

When Agents from multiple business domains need to collaborate (e.g., an Ad domain Agent calls a Data Analytics domain Agent to generate reports), explicit **boundary policies and compensation mechanisms** are needed:

```typescript
interface DomainInteractionPolicy {
  source_domain: string;
  target_domain: string;

  data_flow: DataFlowRule[];
  delegation_rules: CrossDomainDelegation;
  compensation: CompensationStrategy;
}

interface DataFlowRule {
  data_class: string;                       // e.g. "user_pii", "financial_data"
  direction: "source_to_target" | "target_to_source" | "bidirectional";
  allowed: boolean;
  transform?: "anonymize" | "aggregate" | "redact_fields";
  requires_consent: boolean;
}

interface CrossDomainDelegation {
  allowed: boolean;
  max_depth: number;                        // Maximum depth for cross-domain delegation
  permission_model: "inherit" | "intersect" | "explicit_grant";
  timeout: string;
  audit_level: "basic" | "full";
}

interface CompensationStrategy {
  on_target_failure: "retry" | "rollback_source" | "human_review" | "log_and_continue";
  on_timeout: "cancel_both" | "cancel_target_only" | "escalate";
  max_retries: number;
}
```

**Cross-Domain Interaction Matrix Example**:

| Source → Target Domain | Data Flow | Delegation | Failure Strategy |
|----------------------|-----------|------------|-----------------|
| Ads → Data Analytics | Aggregated data, PII prohibited | Allowed (depth=1) | retry(3) → human_review |
| HR → Finance | Payroll data, encrypted transmission | Allowed (depth=1, intersect) | rollback_source |
| Live Commerce → Inventory | Real-time inventory query | Prohibited (read-only API) | fallback cache |
| Code Dev → Security Ops | Code scan results | Allowed (depth=1) | log_and_continue |

## 37.9 DomainGovernancePolicy — Domain Governance Model

Each business domain must have clear **governance ownership**, including ownership, SLO, budget, and change management:

```typescript
interface DomainGovernancePolicy {
  domain_id: string;

  ownership: {
    domain_owner: string;                   // Business domain owner (person/team)
    platform_liaison: string;               // Platform-side liaison
    escalation_contact: string;             // Emergency contact
  };

  slo: {
    availability: string;                   // e.g. "99.9%"
    p95_latency: string;                    // e.g. "5s" (including LLM)
    error_rate: string;                     // e.g. "< 1%"
    eval_quality_floor: number;             // Domain evaluation minimum score
  };

  budget: {
    monthly_token_quota: number;            // Monthly token budget
    monthly_cost_cap: string;               // Monthly cost cap
    burst_allowance: number;                // Burst traffic allowed multiplier
    chargeback_cost_center: string;         // Cost attribution center
  };

  change_management: {
    prompt_change_approval: "domain_owner" | "platform_team" | "both";
    tool_addition_approval: "domain_owner" | "security_team" | "both";
    risk_profile_change_approval: "platform_team";
    rollout_strategy: "canary_10_50_100" | "blue_green" | "immediate";
  };
}
```

**Governance Model to Platform Capability Mapping**:

| Governance Dimension | Platform Capability Integration | Automation Level |
|---------------------|-------------------------------|-----------------|
| Ownership | §6 API Permissions + §11 IAM | Fully automated (RBAC) |
| SLO | §27 SLO Monitoring + Error Budget | Fully automated (alerting + degradation) |
| Budget | §18 Token Metering + Budget Enforcement | Fully automated (quota + circuit-break) |
| Change Mgmt | §16 Prompt Canary + §30 Pack Publishing | Semi-automated (approval + canary) |

## 37.10 DomainDescriptor Registration and Lifecycle

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Draft      │────▶│  Validated   │────▶│  Registered  │────▶│   Active     │
│ (Business    │     │ (CLI         │     │ (Platform    │     │ (Production  │
│  authored)   │     │  validated)  │     │  registered) │     │  running)    │
└─────────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                     │
                         ┌──────────────┐     ┌──────────────┐      │
                         │  Deprecated   │◀────│  Updating    │◀─────┘
                         │ (Deprecating, │     │ (Version     │
                         │  migrating)   │     │  upgrading)  │
                         └──────┬───────┘     └──────────────┘
                                │
                         ┌──────▼───────┐
                         │   Archived   │
                         │ (Archived,   │
                         │  read-only)  │
                         └──────────────┘
```

**State Transition Rules**:

| Current State | Can Transition To | Condition |
|--------------|------------------|-----------|
| Draft | Validated | `agent-platform domain validate` all checks passed |
| Validated | Registered | Security review + platform compatibility check passed |
| Registered | Active | At least one associated Pack published successfully |
| Active | Updating | Business team submits a new version descriptor |
| Updating | Active | New version validation + registration passed |
| Active | Deprecated | domain_owner initiates deprecation, approval passed |
| Deprecated | Archived | All associated Packs migrated or decommissioned |

---

# 38. Business Domain Onboarding Runbook

> v2.2 new addition. Defines the standardized onboarding process for a new business domain from zero to production.
> Related: §37 Business Domain Modeling · §30 Business Pack · §22 SDK/DX · §34 ADR

## 38.1 Four-Phase Onboarding Overview

```text
Phase 1              Phase 2              Phase 3              Phase 4
Domain Modeling      Dev Verification     Security Cert        Canary Rollout
(1-2 weeks)          (2-4 weeks)          (1 week)             (1-2 weeks)
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ Domain    │───────▶│ Pack     │───────▶│ Security │───────▶│ Rollout  │
│ Modeling  │  Gate1 │ Dev+Test │  Gate2 │ Cert     │  Gate3 │ Canary   │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Phase | Responsible Party | Deliverables | Gate Conditions |
|-------|------------------|-------------|-----------------|
| Phase 1 | Business team + Platform Liaison | DomainDescriptor + RiskProfile + GovernancePolicy | Platform architecture review passed |
| Phase 2 | Business team | Pack code + unit tests + integration tests + eval dataset | Test coverage ≥ 80% + eval passed |
| Phase 3 | Security team + Platform team | CertificationRecord + risk review records | Security scan no Critical/High + risk review passed |
| Phase 4 | Platform SRE + Business team | RolloutRecord + Monitoring Dashboard | Canary 7 days no P0/P1 + eval quality not degraded |

## 38.2 Phase 1: Domain Modeling

**Objective**: Business team collaborates with the platform team to produce a structured DomainDescriptor.

**Steps**:

| # | Activity | Executor | Output | Tool |
|---|----------|----------|--------|------|
| 1 | Select domain archetype (§37.7) | Business team | Recipe selection | `agent-platform domain init` |
| 2 | Fill in domain entities and capabilities | Business team | entities + capabilities | YAML/JSON editing |
| 3 | Define domain risk profile | Business team + Security | DomainRiskProfile | Risk assessment template |
| 4 | Define knowledge sources and retrieval strategy | Business team + Data | DomainKnowledgeSchema | Knowledge source inventory template |
| 5 | Define evaluation dimensions and criteria | Business team + AI | DomainEvalFramework | eval template |
| 6 | Build domain Prompt library | Business team + AI | DomainPromptLibrary | Prompt engineering template |
| 7 | Determine governance ownership | Business owner | DomainGovernancePolicy | Governance contract template |
| 8 | Validate completeness | Business team | Validation report | `agent-platform domain validate` |

**Gate 1 Checklist**:

- [ ] All required fields in DomainDescriptor are filled
- [ ] At least 5 few-shot examples are annotated
- [ ] Risk profile has passed initial review by the security team
- [ ] Knowledge sources confirmed reachable and authorized
- [ ] eval dataset ≥ 20 entries (with golden answers)
- [ ] Governance contract signed by domain_owner
- [ ] Cross-domain interaction strategy confirmed with related domains (if applicable)
- [ ] Platform architecture review meeting passed

## 38.3 Phase 2: Development Verification

**Objective**: Develop Business Pack based on DomainDescriptor, verify through local and staging environments.

**Steps**:

| # | Activity | Executor | Output | Tool |
|---|----------|----------|--------|------|
| 1 | Initialize Pack project | Business team | Pack code skeleton | `agent-platform pack create --domain=<id>` |
| 2 | Implement Tool adapters | Business team | Tool bundle code | Pack SDK (§22) |
| 3 | Write unit tests | Business team | Test cases | Standard test framework |
| 4 | Local mock testing | Business team | Local test report | `agent-platform pack test --local` |
| 5 | Build eval dataset | Business team + AI | Evaluation dataset | eval toolchain |
| 6 | Staging integration test | Business team + SRE | Integration test report | staging environment |
| 7 | Run domain evaluation | Business team | eval quality report | `agent-platform eval run --domain=<id>` |

**Gate 2 Checklist**:

- [ ] Unit test coverage ≥ 80%
- [ ] All integration tests passed
- [ ] Domain eval all quality axes meet acceptance_threshold
- [ ] No known P0/P1 bugs
- [ ] Pack Manifest consistency check with DomainDescriptor passed
- [ ] Tool permission declarations match risk profile

## 38.4 Phase 3: Security Certification

**Objective**: Security team and platform team conduct security review and risk assessment on the Pack.

| # | Check Item | Executor | Standard |
|---|-----------|----------|----------|
| 1 | Static code scan | Automated | No Critical/High vulnerabilities |
| 2 | Dependency vulnerability scan | Automated | No known CVEs (Critical) |
| 3 | Sandbox escape test | Security team | No escape paths |
| 4 | Prompt Injection test | Security team | Injection protection effective |
| 5 | Data leakage test | Security team | No PII/credential leakage |
| 6 | Risk profile consistency | Platform team | RiskProfile matches actual behavior |
| 7 | Cross-domain policy compliance | Security team | DataFlowRule executed correctly |
| 8 | Compliance review (§23) | Compliance team | Meets industry regulatory requirements |

**Gate 3 Checklist**:

- [ ] All security scans passed
- [ ] Prompt Injection protection coverage 100%
- [ ] Risk profile review records archived
- [ ] CertificationRecord issued
- [ ] No blocking opinions from compliance team

## 38.5 Phase 4: Canary Rollout

**Objective**: Ensure production environment stability through progressive canary release.

**Canary Strategy**:

```text
Day 1-2     Day 3-5     Day 6-7     Day 8+
Canary 1%   Canary 10%  Canary 50%  GA 100%
┌─────┐    ┌──────┐    ┌──────┐    ┌──────┐
│Internal──▶│Small │───▶│Half  │───▶│Full  │
│ Test │    │ Real │    │ Real │    │Release│
└─────┘    └──────┘    └──────┘    └──────┘
   ▲           ▲           ▲           ▲
   │           │           │           │
  Manual     Auto        Auto       SLO met
  verify     metrics     metrics    confirmed
  + eval     + eval      + eval
```

**Auto-checks Per Phase**:

| Metric | Threshold | Action If Not Met |
|--------|-----------|-------------------|
| Error rate | < 1% | Auto rollback |
| P95 latency | < domain SLO | Alert + manual decision |
| Eval quality | ≥ acceptance_threshold | Auto rollback |
| Token cost | < budget × (canary%) | Alert + manual decision |
| User feedback negative | < 5% | Pause canary + manual review |

**Gate 4 (GA Admission) Checklist**:

- [ ] Canary 7 days no P0/P1 Incidents
- [ ] All SLO metrics met
- [ ] Eval quality not lower than Gate 2 baseline
- [ ] Token cost within budget
- [ ] Monitoring Dashboard configured and alerts routed
- [ ] Runbook (incident handling manual) written and delivered to SRE
- [ ] Domain Owner signs GA confirmation

## 38.6 Post-Onboarding Continuous Operations

After the business domain goes live, it enters **continuous operations mode**, where the platform automatically performs the following periodic activities:

| Activity | Frequency | Responsible Party | Trigger Condition |
|----------|-----------|-------------------|-------------------|
| Eval regression test | Daily | Automated | Scheduled + after Prompt changes |
| Cost report | Weekly | Automated → domain_owner | Scheduled |
| SLO report | Monthly | Automated → domain_owner + SRE | Scheduled |
| Security scan | Monthly | Automated | Scheduled + on dependency updates |
| DomainDescriptor review | Quarterly | Business team + Platform | Scheduled |
| Knowledge source freshness check | Per freshness_policy | Automated | Continuous |
| Cross-domain policy review | Quarterly | Security team | Scheduled + on new domain onboarding |

---

# 39. Natural Language Task Entry Architecture

> Added in v2.3. Enables non-technical users to interact with the platform directly via natural language, replacing hand-written JSON/API calls.
> Related: §6 API Contract · §13 OAPEFLIR · §37 Business Domain Modeling · §40 Goal Decomposition · §44 Non-Technical User Experience

## 39.1 Design Principles

- Natural language is a **first-class interaction method**, on par with the REST API — not syntactic sugar on top of the API
- All NL interactions are ultimately converted into standard `RequestEnvelope` (§5.3), reusing existing control plane and execution plane
- Ambiguity must be explicitly resolved; do not guess user intent — better to ask one more question than to mistakenly execute a high-risk action
- Conversation context is persisted to Memory (§29.2) and can be resumed across sessions

## 39.2 NL Interaction Pipeline

```text
User Input (Natural Language)
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Intent Parser │────▶│ Domain Router│────▶│ Task Builder │
│ (Intent       │     │ (Domain      │     │ (Task        │
│  Recognition) │     │  Routing)    │     │  Building)   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
    ┌──────────────┐     ┌──────────────┐        │
    │ Clarification│◀────│ Ambiguity    │◀───────┘
    │ Dialog       │     │ Detector     │   Loop back on ambiguity
    └──────┬───────┘     └──────────────┘
           │ User confirms
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Risk Preview │────▶│ RequestEnvelope│──▶ P1 Interface Plane
    │ (Risk        │     │ (Standard     │
    │  Preview)    │     │  Contract)    │
    └──────────────┘     └──────────────┘
```

## 39.3 Core Components

```typescript
interface IntentParseResult {
  raw_input: string;
  detected_intents: DetectedIntent[];
  confidence: number;
  requires_clarification: boolean;
  clarification_questions?: string[];
}

interface DetectedIntent {
  intent_type: "task_create" | "task_query" | "task_modify" | "system_config" | "status_inquiry" | "approval_action";
  domain_hint: string | null;
  entities: ExtractedEntity[];
  urgency: "low" | "normal" | "high" | "critical";
  confidence: number;
}

interface ExtractedEntity {
  entity_type: string;        // e.g. "date_range", "department", "metric_name"
  value: string;
  normalized: unknown;        // Normalized value
  source_span: [number, number];  // Position in original text
}

interface TaskBuildResult {
  request_envelope: RequestEnvelope;   // §5.3 Standard contract
  risk_preview: RiskPreview;           // Pre-execution risk preview
  cost_estimate: CostEstimate;         // Estimated cost
  confirmation_required: boolean;      // Whether user confirmation is needed
  human_summary: string;               // "I will do X for you, estimated cost ¥Y, risk level Z"
}

interface RiskPreview {
  overall_risk: "low" | "medium" | "high" | "critical";
  risk_factors: string[];              // Human-readable risk factors
  reversible: boolean;
  side_effects: string[];              // Expected side effect descriptions
  approval_needed: boolean;
}
```

## 39.4 Ambiguity Resolution Strategies

| Ambiguity Type | Example | Resolution Method |
|---------|------|---------|
| Domain ambiguity | "Generate a report" | Ask "Is this a financial report or an advertising report?" |
| Scope ambiguity | "Clean up expired data" | Ask "Which domain's data? What time range?" |
| Risk ambiguity | "Update product prices" | Show risk preview + confirm "This will affect X products online" |
| Time ambiguity | "Complete ASAP" | Map to urgency=high, inform estimated completion time |
| Permission ambiguity | "Help me approve these requests" | Check permissions; if unauthorized, prompt "You do not have approval permission, need to forward to X" |

## 39.5 Multi-Turn Dialog State Machine

```text
         ┌─────┐
         │ Idle │◀──────────────────────────┐
         └──┬──┘                            │
            │ User input                    │ Task completed/cancelled
            ▼                               │
    ┌───────────────┐                       │
    │ Intent Parsing │                      │
    └───────┬───────┘                       │
            │                               │
     ┌──────┴──────┐                        │
     │Ambiguous?    │                        │
     ▼ Yes         ▼ No                     │
┌──────────┐  ┌──────────┐                  │
│Clarifying│  │ Building │                  │
│(Asking)  │  │(Building │                  │
│          │  │ task)    │                  │
└────┬─────┘  └────┬─────┘                  │
     │ User answers     │                   │
     └──────┬──────┘                        │
            ▼                               │
    ┌───────────────┐                       │
    │ Confirming    │                       │
    │ (Risk preview │                       │
    │  + confirm)   │                       │
    └───────┬───────┘                       │
            │ User confirms                 │
            ▼                               │
    ┌───────────────┐     ┌────────────┐    │
    │ Executing     │────▶│ Reporting  │────┘
    │ (Executing)   │     │ (Result    │
    │               │     │  report)   │
    └───────────────┘     └────────────┘
```

## 39.6 Security Constraints

- All outputs from the NL entry must pass through Prompt Injection protection (§16.5)
- High-risk intents (risk ≥ high) **must** be explicitly confirmed; NL is not allowed to trigger them directly
- Conversation history is subject to data classification (§11.6) constraints; confidential/restricted content is not echoed back
- NL entry permissions are equivalent to the caller's API permissions, with no additional privilege escalation

## 39.7 Multilingual & Internationalization (i18n)

| Layer | Internationalization Strategy |
|------|-----------|
| Intent Parser | Multilingual intent recognition: invoke multilingual LLMs via ModelGateway (§15); route to locale-specific Prompt templates after language detection |
| Clarification Dialog | Response language follows the user's input language (auto-detect), or respects the `preferred_locale` setting in the user profile |
| Risk Preview | Risk descriptions and cost estimates use the user locale's currency/date format |
| NL Status Summary (§43) | Dashboard summaries are generated per user locale; amounts/dates/numbers follow ICU formatting |
| Error Messages | Platform standard error codes are mapped to a multilingual message catalog; fallback language is en-US |

```typescript
interface LocaleConfig {
  supported_locales: string[];         // e.g. ["zh-CN", "en-US", "ja-JP", "de-DE"]
  default_locale: string;              // fallback
  locale_resolution_order: ("user_profile" | "accept_language" | "input_detect" | "default")[];
}
```

---

# 40. Goal Decomposition Engine Architecture

> Added in v2.3. Adds a Goal → Task decomposition layer on top of OAPEFLIR (§13), allowing users to describe business goals rather than individual tasks.
> Related: §13 OAPEFLIR · §19 Agent Delegation · §37 Business Domain Modeling · §39 NL Entry · §41 Proactive Agent

## 40.1 Three-Layer Decomposition Model

```text
Goal (Business Goal)
  "Launch a spring marketing campaign for product X"
    │
    ▼  GoalDecomposer
Task (Domain Task)                              ← New layer
  ├── [content-production] Create 3 sets of ad creatives
  ├── [advertising] Configure and launch ad campaign
  ├── [data-analysis] Set up ROI tracking dashboard
  └── [legal] Review ad compliance
    │
    ▼  OAPEFLIR Planner (§13)
Step (Execution Step)                           ← Existing layer
  ├── tool.design.generate_creative
  ├── tool.ad_platform.create_campaign
  └── ...
```

## 40.2 GoalDecomposer Interface

```typescript
interface Goal {
  goal_id: string;
  description: string;                     // NL description or structured description
  owner: string;                           // Goal initiator
  deadline?: string;                       // Expected completion time
  success_criteria: SuccessCriterion[];    // Success criteria
  constraints: string[];                   // Constraints
  priority: "low" | "normal" | "high" | "critical";
}

interface SuccessCriterion {
  metric: string;                          // e.g. "ad_roi", "completion_rate"
  target: string;                          // e.g. "> 2.0", "100%"
  evaluation_method: "metric_api" | "human_review" | "automated_test";
}

interface GoalDecomposition {
  goal_id: string;
  tasks: PlannedTask[];
  dependency_graph: TaskDependency[];
  estimated_duration: string;
  estimated_cost: CostEstimate;
  risk_summary: RiskPreview;
  decomposition_confidence: number;        // Decomposition confidence
  requires_human_review: boolean;          // Request human review when confidence is low
}

interface PlannedTask {
  task_id: string;
  domain_id: string;                       // Target domain
  description: string;
  inputs: Record<string, unknown>;
  expected_outputs: string[];
  delegation_mode: "auto" | "supervised" | "manual";
  estimated_duration: string;
  estimated_cost: CostEstimate;
}

interface TaskDependency {
  from_task: string;
  to_task: string;
  type: "blocks" | "provides_input" | "soft_dependency";
  data_contract?: string;                  // Cross-task data contract
}
```

## 40.3 Decomposition Strategies

| Strategy | Applicable Scenario | Mechanism |
|------|---------|------|
| **Template Matching** | Goal matches an existing DomainRecipe (§37.7) or cross-domain template | Directly instantiate the template and fill in parameters |
| **LLM Planning** | New scenario with no matching template | Invoke ModelGateway (§15) for decomposition, constrained by DomainDescriptor |
| **Hybrid** | Partial match | Template skeleton + LLM fills in missing segments |
| **Human-Assisted** | Confidence < 0.7 or involves critical risk | Generate preliminary decomposition plan, request human review and adjustment |

## 40.4 Cross-Domain Dependency Graph Management

```text
[content-production]──▶[legal]──▶[advertising]──▶[data-analysis]
     Creative production    Compliance review   Launch            Performance tracking
         │                                  │
         └──────────parallel────────────────┘
                  (Creative production and launch configuration can run in parallel)
```

- Dependency graph is automatically topologically sorted to identify parallelizable tasks
- **Circular dependency detection**: After decomposition, perform DAG validation on the dependency_graph; if a cycle is detected, reject execution and return the cycle path to the user/GoalDecomposer for retry
- Critical path calculation to estimate total duration
- When a single Task fails, the action depends on the dependency type: `blocks` → block downstream, `soft_dependency` → warn but continue
- Cross-domain data transfer follows DomainInteractionPolicy (§37.8)

## 40.5 Goal Lifecycle

| State | Description | Can Transition To |
|------|------|---------|
| draft | Goal created, not yet decomposed | decomposing, cancelled |
| decomposing | Being decomposed into Tasks | decomposed, failed |
| decomposed | Decomposition complete, awaiting confirmation | executing, cancelled |
| executing | Tasks are being executed | completed, partially_completed, failed |
| completed | All Tasks + success criteria met | archived |
| partially_completed | Some Tasks completed, some failed | executing(retry), completed, cancelled |
| failed | Decomposition or execution failed | decomposing(retry), cancelled |
| cancelled | Cancelled by user | archived |

---

# 41. Proactive Agent Framework

> Added in v2.3. Enables Agents to proactively initiate tasks based on event triggers and scheduled schedules, rather than only responding to API calls.
> Related: §4.2 P1 Interface Plane · §20 Long-Running Tasks · §37 Business Domain Modeling · §40 Goal Decomposition

## 41.1 Design Principles

- Proactive Agents are **controlled automation**, not unconstrained autonomous behavior
- All triggers must be declared in DomainDescriptor (§37); undeclared triggers are not allowed to register
- Tasks produced by triggers go through the **exact same risk control pipeline** (§10) as API-created tasks
- Costs incurred by proactive behavior are charged to the corresponding domain's budget (§18)

## 41.2 Trigger Model

```typescript
interface TriggerDefinition {
  trigger_id: string;
  domain_id: string;
  name: string;
  type: TriggerType;
  config: ScheduleTriggerConfig | EventTriggerConfig | ThresholdTriggerConfig;
  action: TriggerAction;
  enabled: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  max_fire_rate: string;           // e.g. "10/hour" — prevent trigger storms
  cooldown: string;                // Minimum interval between two firings
}

type TriggerType = "schedule" | "event" | "threshold" | "webhook_inbound";

interface ScheduleTriggerConfig {
  cron: string;                    // cron expression
  timezone: string;
  skip_if_previous_running: boolean;
}

interface EventTriggerConfig {
  event_source: string;            // Event source identifier
  event_pattern: string;           // Event matching pattern
  filter: Record<string, string>;  // Event field filter
  batch_window?: string;           // Batch window, merging multiple events within a short time
}

interface ThresholdTriggerConfig {
  metric_source: string;           // Metric source
  metric_name: string;
  condition: "gt" | "lt" | "eq" | "change_rate_gt";
  threshold: number;
  evaluation_window: string;       // Evaluation window
  consecutive_breaches: number;    // Number of consecutive breaches before triggering
}

interface TriggerAction {
  action_type: "create_task" | "create_goal" | "suggest_to_user" | "update_dashboard";
  template: Partial<RequestEnvelope> | Partial<Goal>;
  require_confirmation: boolean;   // true = suggestion mode, false = auto-execute
}
```

## 41.3 Trigger Modes

| Mode | Behavior | Applicable Scenario | Risk Control |
|------|------|---------|---------|
| **Auto-Execute** | Directly create task upon trigger | Low-risk scheduled tasks (daily report generation, data sync) | require_confirmation=false + risk_level=low |
| **Suggestion Mode** | Push suggestion to user upon trigger; execute after user confirms | Medium/high-risk event response (CTR drop → suggest adjusting bids) | require_confirmation=true |
| **Silent Recording** | Only record event and analysis results upon trigger; no proactive notification | Data accumulation (user behavior pattern recognition) | action_type=update_dashboard |

## 41.4 Trigger Storm Protection

- **max_fire_rate**: Each trigger has a maximum firing frequency; exceeding it automatically downgrades to silent recording
- **cooldown**: Enforced cooldown between two firings to prevent duplicate execution
- **batch_window**: Event triggers can configure a batch window to merge multiple events within a short time into a single trigger
- **circuit_breaker**: After N consecutive triggered task failures, automatically disable the trigger and alert
- **Global trigger budget**: Each domain has a daily maximum auto-trigger count to prevent runaway behavior

## 41.5 Proactive Suggestion Pipeline

```text
Trigger fires
    │
    ▼
┌────────────────┐     ┌──────────────┐
│ Context Builder │────▶│ Suggestion   │
│ (Context        │     │ Generator    │
│  Building)      │     │              │
└────────────────┘     └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │ Suggestion   │
                       │ Queue        │──▶ User Dashboard (§43) / Push Notification
                       └──────┬───────┘
                              │ User confirms
                       ┌──────▼───────┐
                       │ Task/Goal    │──▶ Standard Execution Pipeline
                       │ Creator      │
                       └──────────────┘
```

---

# 42. Progressive Autonomy Model

> Added in v2.3. Drives dynamic promotion/demotion of Agent autonomy based on historical performance data, reducing the burden of manual oversight.
> Related: §10 Risk Control · §17 Model Evaluation · §21 Human-in-the-Loop · §37.2 DomainCapability · §41 Proactive Agent

## 42.1 Trust Score Model

```typescript
interface AgentTrustProfile {
  agent_id: string;
  domain_id: string;
  capability_scores: CapabilityTrustScore[];
  overall_trust_level: TrustLevel;
  history: TrustEvent[];
  last_evaluation: string;        // ISO timestamp
}

type TrustLevel = "untrusted" | "probation" | "supervised" | "semi_trusted" | "trusted" | "fully_trusted";

interface CapabilityTrustScore {
  capability_id: string;
  current_autonomy: AutonomyLevel;
  trust_score: number;            // 0-100
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  human_overrides: number;        // Number of human overrides
  incidents: number;              // Number of incidents caused
  last_incident_age: string;      // Time since last incident
  promotion_eligible: boolean;
  demotion_risk: boolean;
}

type AutonomyLevel = "suggestion" | "supervised" | "semi_auto" | "full_auto";
```

## 42.2 Autonomy Promotion/Demotion Rules

```typescript
interface AutonomyRule {
  from_level: AutonomyLevel;
  to_level: AutonomyLevel;
  direction: "promotion" | "demotion";
  conditions: AutonomyCondition[];
  approval_required: "none" | "domain_owner" | "platform_team";
  cooldown_after_change: string;   // Cooldown period after change to prevent frequent fluctuations
}

interface AutonomyCondition {
  metric: "success_rate" | "incident_count" | "human_override_rate" | "consecutive_successes" | "time_since_last_incident";
  operator: "gte" | "lte" | "eq";
  value: number;
  window: string;                  // Evaluation window, e.g. "30d"
}
```

**Default Promotion Ladder**:

| Current Level | Promote To | Conditions | Approval |
|---------|-------|------|------|
| suggestion | supervised | ≥ 50 executions + success rate ≥ 95% + 0 incidents (30d) | domain_owner |
| supervised | semi_auto | ≥ 200 executions + success rate ≥ 98% + human override rate < 5% + 0 incidents (60d) | domain_owner |
| semi_auto | full_auto | ≥ 500 executions + success rate ≥ 99% + human override rate < 1% + 0 incidents (90d) | platform_team |

**Instant Demotion Triggers**:

| Event | Demotion Action | Recovery Condition |
|------|---------|---------|
| Caused P0 Incident | Demote directly to suggestion | Manual investigation + platform_team approval |
| Caused P1 Incident | Demote one level | 30d with no incidents |
| 3 consecutive failures | Demote one level | 10 consecutive successes |
| Cost exceeds budget by 200% | Demote to supervised | Budget adjustment + domain_owner confirmation |

## 42.3 Autonomy Change Audit

All autonomy changes are recorded to event_log (§28):

```typescript
interface AutonomyChangeEvent {
  event_type: "agent.autonomy.promoted" | "agent.autonomy.demoted" | "agent.autonomy.frozen";
  agent_id: string;
  capability_id: string;
  from_level: AutonomyLevel;
  to_level: AutonomyLevel;
  trigger: "rule_engine" | "manual" | "incident_response";
  evidence: {
    success_rate: number;
    total_executions: number;
    incident_count: number;
    evaluation_window: string;
  };
  approved_by: string | "auto";
}
```

## 42.4 Integration with Existing Architecture

| Existing Component | Integration Method |
|---------|---------|
| §10 Risk Control | trust_score serves as an adjustment factor for risk_score — the same action from a high-trust Agent has lower risk |
| §17 Model Evaluation | Eval quality degradation automatically triggers trust demotion |
| §21 HITL | Autonomy level determines HITL mode — suggestion level requires human confirmation, full_auto level executes silently |
| §37.2 DomainCapability | `max_automation_level` acts as a ceiling — trust can never exceed the upper limit set by the domain |
| §41 Proactive Agent | Only semi_auto and above are allowed to auto-execute triggers; otherwise use suggestion mode |

---

# 43. Unified Operations Dashboard Architecture

> Added in v2.3. Provides layered operational views from one-person companies to enterprises with tens of thousands of employees, replacing infrastructure-level metrics aimed at SREs.
> Related: §12 Anomaly Events · §18 Cost Management · §27 SLO · §37.9 Governance · §42 Autonomy

## 43.1 Dashboard Layers

```text
┌─────────────────────────────────────────┐
│  L1 Operator View (One-person company / │  "Is everything OK? What needs my attention?"
│  Business owner)                        │
├─────────────────────────────────────────┤
│  L2 Domain Admin View (Department Agent │  "What Agents does my domain have? How are they performing?"
│  administrators)                        │
├─────────────────────────────────────────┤
│  L3 Platform Ops View (Platform SRE     │  "Infrastructure healthy? Resource utilization?"
│  team)                                  │
├─────────────────────────────────────────┤
│  L4 Fleet Management View (Large        │  "Which department has issues? Global capacity?"
│  enterprise platform team)              │
└─────────────────────────────────────────┘
```

## 43.2 L1 Operator View

Business-oriented view for non-technical users:

```typescript
interface OperatorDashboard {
  attention_queue: AttentionItem[];        // "Needs your attention" queue
  daily_summary: DailySummary;             // Today's summary
  agent_health_cards: AgentHealthCard[];   // Agent health cards
  cost_burn: CostBurnRate;                 // Cost burn rate
  active_goals: GoalProgress[];            // Active goal progress
  recent_completions: CompletionRecord[];  // Recently completed tasks
  proactive_suggestions: Suggestion[];     // Proactive suggestions (§41)
}

interface AttentionItem {
  item_type: "approval_needed" | "incident" | "budget_warning" | "quality_alert" | "suggestion";
  priority: "low" | "normal" | "high" | "critical";
  title: string;                           // Human-readable title
  description: string;                     // One-sentence description
  action_options: ActionOption[];          // Available actions (one-click operations)
  created_at: string;
  domain_id: string;
}

interface DailySummary {
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_failed: number;
  total_cost_today: string;
  agent_uptime_percent: number;
  highlights: string[];                    // NL-generated today's highlights
  concerns: string[];                      // NL-generated concerns
}

interface AgentHealthCard {
  agent_id: string;
  domain_id: string;
  name: string;
  status: "healthy" | "degraded" | "failing" | "paused";
  trust_level: TrustLevel;                // §42
  tasks_today: number;
  success_rate_7d: number;
  cost_7d: string;
  trend: "improving" | "stable" | "declining";
}
```

## 43.3 L2 Domain Admin View

Domain operations view for department Agent administrators:

```typescript
interface DomainAdminDashboard {
  domain_id: string;
  agent_inventory: AgentInventoryItem[];
  performance_matrix: {
    agent_id: string;
    success_rate_7d: number;
    avg_latency_ms: number;
    cost_7d: string;
    autonomy_level: AutonomyLevel;
    trend: "improving" | "stable" | "declining";
  }[];
  active_workflows: WorkflowSummary[];
  pending_approvals: ApprovalItem[];
  domain_budget: { allocated: string; consumed: string; forecast: string };
  knowledge_health: { total_docs: number; stale_docs: number; last_refresh: string };
  eval_quality_trend: { date: string; pass_rate: number }[];
}

interface AgentInventoryItem {
  agent_id: string;
  name: string;
  version: string;
  status: "active" | "paused" | "deprecated" | "draft";
  autonomy_level: AutonomyLevel;
  capabilities: string[];
  last_execution: string;
}
```

## 43.4 L3 Platform Ops View

Infrastructure operations view for SRE teams:

```typescript
interface PlatformOpsDashboard {
  infrastructure_health: {
    component: string;
    status: "healthy" | "degraded" | "down";
    uptime_30d: number;
    error_budget_remaining: number;
  }[];
  worker_pool_status: {
    total: number; idle: number; busy: number; unhealthy: number;
  };
  queue_metrics: {
    queue_name: string; depth: number; avg_wait_ms: number; dlq_count: number;
  }[];
  circuit_breaker_states: {
    target: string; state: "closed" | "open" | "half_open"; since: string;
  }[];
  storage_metrics: {
    event_log_size: string; growth_rate: string; retention_compliance: boolean;
  };
  active_incidents: IncidentSummary[];
  recovery_jobs: { type: string; status: string; last_run: string }[];
  model_gateway_health: {
    provider: string; status: string; p99_latency_ms: number; error_rate: number;
  }[];
}
```

## 43.5 L4 Fleet Management View

Global operations view for large enterprise platform teams:

```typescript
interface FleetDashboard {
  platform_health: PlatformHealthScore;
  department_overview: DepartmentStatus[];
  resource_utilization: ResourceUtilization;
  global_incident_map: IncidentHeatmap;
  version_drift: VersionDriftReport;
  capacity_forecast: CapacityForecast;
  top_cost_consumers: CostRanking[];
  cross_department_workflows: CrossDeptWorkflowStatus[];
}

interface DepartmentStatus {
  department_id: string;
  agent_count: number;
  active_workflows: number;
  health_score: number;                    // 0-100 composite score
  sla_compliance: number;                  // SLA compliance rate
  cost_budget_usage: number;               // Budget usage ratio
  incidents_open: number;
  attention_items: number;
}

interface PlatformHealthScore {
  overall: number;                         // 0-100
  components: {
    api_gateway: number;
    dispatcher: number;
    worker_pool: number;
    model_gateway: number;
    event_bus: number;
    storage: number;
  };
  degraded_components: string[];
}
```

## 43.6 NL Status Summary Generation

The dashboard supports natural language summaries, generated by ModelGateway (§15):

- **Daily briefing**: "Today 5 Agents completed 23 tasks (96% success rate), costing ¥45. The advertising domain Agent performed excellently (ROI 2.8x). There are 2 approvals waiting for you and 1 budget alert that needs attention."
- **Anomaly briefing**: "In the past hour, the customer service domain Agent's success rate dropped from 95% to 78%, mainly due to slow knowledge base API responses. It has automatically degraded to cache mode. We recommend you check the knowledge base service status."
- **Away-and-back briefing**: "During the 8 hours you were away: 12 tasks completed, costing ¥80. The finance domain had 1 P1 Incident (auto-recovered). 3 approvals were auto-processed after timeout. No immediate action required."

---

# 44. Non-Technical User Experience Architecture

> Added in v2.3. Enables non-developers (business owners, independent operators) to use all platform capabilities through a visual interface.
> Related: §22 SDK/DX · §38 Onboarding Runbook · §39 NL Entry · §43 Dashboard

## 44.1 User Role Layers

| Role | Technical Level | Primary Interaction Method | Dashboard Level |
|------|---------|------------|---------|
| Independent operator | Non-technical | NL dialog (§39) + L1 dashboard (§43) | L1 |
| Business line owner | Non-technical | L1 dashboard + visual configuration | L1 |
| Domain administrator | Low-code | Visual configuration + occasional CLI | L2 |
| Pack developer | Technical | SDK + CLI (§22) | L2/L3 |
| Platform SRE | Technical | CLI + Admin API + L3/L4 dashboard | L3/L4 |

## 44.2 Visual Domain Onboarding Wizard

Replaces the CLI + YAML workflow for technical users in §38:

```text
Step 1               Step 2               Step 3               Step 4
Select business type  Configure core       Set risk control     Activate & go live
                      capabilities         rules
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ "What type│        │ Drag and  │        │ Risk     │        │ One-click │
│  is your  │───────▶│ select    │───────▶│ sliders  │───────▶│ activate  │
│  business?"│       │ needed    │        │ Approval │        │ Canary    │
│ [Card     │        │ capabili- │        │ rules    │        │ start     │
│  select]  │        │ ties      │        │ [Preset  │        │ [Progress │
│           │        │ [Tool     │        │  templates│       │  bar]     │
│           │        │  panel]   │        │  ]       │        │           │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Traditional Method (§38) | Visual Method (§44) |
|--------------|---------------|
| `agent-platform domain init --archetype=crud_heavy` | Card select "Customer Service" |
| Manually edit DomainDescriptor YAML | Form filling + smart recommendations |
| `agent-platform domain validate` | Real-time validation + red/green light indicators |
| Multi-team collaboration 5-9 weeks | Wizard-guided 1-3 days (low-risk domains) |

## 44.3 Visual Workflow Builder

Workflow orchestration interface for non-technical users:

```typescript
interface VisualWorkflowBuilder {
  canvas: WorkflowCanvas;
  component_palette: ComponentCategory[];
  live_preview: WorkflowPreview;
  validation: RealTimeValidation;
}

interface ComponentCategory {
  category: "trigger" | "action" | "condition" | "approval" | "output";
  components: DraggableComponent[];
}

interface DraggableComponent {
  component_id: string;
  name: string;                            // e.g. "Send Email", "Query Data", "Generate Report"
  icon: string;
  domain_id: string;
  risk_level: "low" | "medium" | "high";
  config_schema: Record<string, unknown>;  // Visual configuration schema
  preview_description: string;             // "This component will..."
}

interface WorkflowPreview {
  estimated_duration: string;
  estimated_cost: string;
  risk_assessment: string;
  step_by_step_description: string[];      // NL description of what each step does
}
```

## 44.4 Smart Guided Onboarding

```text
First login
    │
    ▼
┌──────────────────┐
│ "Hello! I'm your │
│  AI business     │
│  assistant.      │
│  What would you  │
│  like me to do?" │
└───────┬──────────┘
        │ User describes business
        ▼
┌──────────────────┐
│ Auto-recommend   │
│ • Suitable domain│
│   templates      │
│ • Required       │
│   integrations   │
│ • Estimated cost │
└───────┬──────────┘
        │ User confirms
        ▼
┌──────────────────┐
│ One-click setup  │
│ • Create Domain  │
│ • Install base   │
│   Packs          │
│ • Set default    │
│   risk controls  │
│ • Activate first │
│   Agent          │
└───────┬──────────┘
        │ 3 minutes later
        ▼
┌──────────────────┐
│ "Your first Agent│
│  is ready! Try   │
│  saying:         │
│  'Help me...'"   │
└──────────────────┘
```

## 44.5 Solo Mode vs Enterprise Mode

The platform automatically adjusts UX complexity based on the number of users:

| Dimension | Solo Mode | Enterprise Mode |
|------|---------|---------|
| Tenancy | Auto-create single tenant, hide the tenant concept | Full multi-tenancy management |
| Approval | Self-approval (low/medium risk auto-approved, high risk popup confirmation) | Full approval workflow engine (§21) |
| Security review | Built-in security checks run automatically, no manual security team needed | Independent security team review |
| Onboarding | Wizard-guided 3 minutes | Four-stage Runbook (§38) |
| Dashboard | L1 operator view only | L1-L4 all levels |
| Cost | Personal budget view + cost-saving tips | Department-level chargeback |
| Governance | Simplified (you are the domain_owner) | Full organizational governance |

```typescript
interface PlatformMode {
  mode: "solo" | "team" | "department" | "enterprise";
  auto_detected: boolean;
  features: {
    multi_tenancy: boolean;
    approval_engine: "self_approve" | "simple" | "full";
    security_review: "auto_only" | "auto_plus_manual" | "full_team";
    onboarding: "wizard_3min" | "guided_1week" | "runbook_full";
    dashboard_levels: ("L1" | "L2" | "L3" | "L4")[];
    governance: "self" | "delegated" | "hierarchical";
  };
  upgrade_path: string;           // Guide for upgrading to the next mode
}
```

## 44.6 Accessibility (WCAG 2.1 AA)

| WCAG Principle | Platform Implementation |
|-----------|---------|
| Perceivable | All charts provide alt text / data table alternative views; color is not used as the sole information carrier (paired with shapes/labels) |
| Operable | All functionality is keyboard-operable (Tab order, Enter to confirm, Esc to cancel); NL entry supports voice input (§68) |
| Understandable | Error messages clearly state the problem and suggest fixes; form labels are explicitly associated with inputs |
| Robust | Semantic HTML; ARIA annotations on key interactive controls (dashboard cards, approval buttons, workflow canvas nodes) |

**Audit & Testing**: axe-core scans are automatically run before every frontend release; WCAG AA violations are treated as release blockers.

---

# 46. Organization Hierarchy Model

> Added in v2.4. Overlays a company/division/department/team organizational hierarchy on top of tenant/domain/pack, driving layered governance for approvals, budgets, isolation, and compliance.
> Related: §11 Security · §18 Cost · §21 HITL · §37 Business Domain · §47 Approval Routing · §48 SSO/SCIM

## 46.1 Organization Model

```typescript
interface OrganizationNode {
  node_id: string;
  node_type: "company" | "division" | "department" | "team";
  name: string;
  parent_id: string | null;
  manager: string;                         // principal ID
  cost_center: string;
  metadata: Record<string, string>;
```
  metadata: Record<string, string>;
}

interface OrgChart {
  root: OrganizationNode;                  // company
  nodes: OrganizationNode[];
  reporting_chains: ReportingChain[];      // reporting chain
  sync_source: "scim" | "manual" | "hr_api";
  last_synced: string;
}

interface ReportingChain {
  employee_id: string;
  chain: string[];                         // [direct_manager, skip_level, ..., CEO]
}
```

## 46.2 Mapping Between Organization Hierarchy and Platform Hierarchy

```text
Organization Structure              Platform Architecture
company ──────────────────── platform (single instance)
  ├── division ────────────── tenant_group (budget aggregation)
  │   ├── department ──────── tenant (isolation unit)
  │   │   ├── team ────────── domain + pack_group
  │   │   └── team ────────── domain + pack_group
  │   └── department ──────── tenant
  └── division ────────────── tenant_group
```

| Organization Level | Platform Mapping | Governance Permissions |
|---------|---------|---------|
| company | platform config | Global policies, platform-level SLO, compliance master framework |
| division | tenant_group | Division budget, cross-department workflow policies |
| department | tenant | Department budget, department SLO, domain management, approval chains |
| team | domain/pack | Domain configuration, Pack development, daily operations |

## 46.3 Automatic Adaptation to Organization Changes

| Organization Change Event | Platform Automatic Response |
|------------|------------|
| Employee onboarding | SCIM sync → create principal → assign to team → inherit team permissions |
| Employee transfer | Update reporting_chain → adjust tenant/domain permissions → migrate approval delegation |
| Employee offboarding | SCIM deprovisioning → revoke all permissions → transfer domain_owner → audit record |
| Department merger | Merge tenants → merge budgets → recalculate SLO → migrate Pack ownership |
| Organization restructuring | Rebuild reporting_chain → refresh approval routing → notify affected domain_owners |

---

# 47. Organization-Based Approval Routing

> Added in v2.4. Dynamic approval routing based on org-chart, replacing static approver lists.
> Related: §21 HITL · §46 Organization Hierarchy · §10 Risk Control

## 47.1 Dynamic Approval Routing Engine

```typescript
interface ApprovalRoutingRule {
  rule_id: string;
  domain_id: string;
  trigger_condition: string;               // trigger condition expression
  routing_strategy: RoutingStrategy;
}

type RoutingStrategy =
  | OrgChartRouting
  | AmountBasedRouting
  | SodRouting;                            // Segregation of Duties

interface OrgChartRouting {
  type: "org_chart";
  start_from: "initiator_manager" | "domain_owner" | "cost_center_owner";
  escalation_levels: number;               // number of levels to escalate upward
  skip_conditions?: string[];              // skip conditions (e.g., skip to skip-level when "manager = initiator")
}

interface AmountBasedRouting {
  type: "amount_based";
  thresholds: AmountThreshold[];
}

interface AmountThreshold {
  max_amount: number;
  currency: string;
  approver_level: "auto" | "manager" | "director" | "vp" | "cxo";
  requires_sod: boolean;                   // whether segregation of duties is required
}

interface SodRouting {
  type: "segregation_of_duties";
  initiator_cannot_approve: boolean;
  same_team_cannot_approve: boolean;
  minimum_approvers: number;
  from_different_departments: boolean;
}
```

## 47.2 Approval Amount Matrix

| Risk Amount | Auto | Manager | Director | VP | CFO/CTO |
|---------|------|---------|----------|----|---------| 
| < ¥1,000 | ✓ | | | | |
| ¥1K-10K | | ✓ | | | |
| ¥10K-100K | | | ✓ | | |
| ¥100K-1M | | | | ✓ | |
| > ¥1M | | | | | ✓ |

## 47.3 Automatic Delegation When Absent

```typescript
interface DelegationOfAuthority {
  delegator: string;                       // person granting authority
  delegate: string;                        // person receiving authority
  scope: "all" | "domain_specific" | "amount_limited";
  max_amount?: number;
  valid_from: string;
  valid_until: string;
  auto_activated_by: "calendar_ooo" | "manual" | "scim_status";
  audit_trail: boolean;
}
```

When the approver is absent, the system looks for a delegate in the following priority order:
1. Explicitly designated delegate (DelegationOfAuthority)
2. One level up in the org-chart (skip-level manager)
3. Same-level peer in the same department (if configured to allow)
4. Execute ApprovalTimeoutPolicy(§21) after timeout

---

# 48. Enterprise SSO/SCIM Integration Architecture

> Added in v2.4. Integration with enterprise identity providers for automated user lifecycle management.
> Related: §6.5 Authentication · §11 Security · §46 Organization Hierarchy

## 48.1 Identity Integration Protocols

| Protocol | Purpose | Priority |
|------|------|--------|
| **OIDC** | SSO login (existing §6.5) | Already supported |
| **SAML 2.0** | SSO login (legacy enterprise IdP) | Added in v2.4 |
| **SCIM 2.0** | Automatic user/group synchronization | Added in v2.4 |
| **HR API** | Organization structure synchronization (optional) | Added in v2.4 |

## 48.2 SCIM Integration Model

```typescript
interface ScimIntegration {
  idp_type: "azure_ad" | "okta" | "ping" | "onelogin" | "custom";
  scim_endpoint: string;
  sync_mode: "push" | "pull" | "bidirectional";
  sync_interval: string;

  mapping: {
    user_to_principal: FieldMapping[];     // IdP user → platform principal
    group_to_role: GroupRoleMapping[];     // IdP group → platform role
    group_to_org_node: GroupOrgMapping[];  // IdP group → organization structure node (§46)
  };

  lifecycle: {
    on_create: "auto_provision" | "pending_approval";
    on_update: "auto_sync" | "manual_review";
    on_deactivate: "immediate_revoke" | "grace_period_7d";
    on_delete: "soft_delete" | "hard_delete_after_90d";
  };
}

interface GroupRoleMapping {
  idp_group_pattern: string;               // glob pattern
  platform_roles: string[];
  tenant_scope: string;                    // which tenant to map to
  auto_create_tenant: boolean;
}
```

## 48.3 User Lifecycle Automation

```text
IdP Event                       Platform Response
─────────                       ────────
User Created ──────────▶ Create principal + assign role + join org_node + welcome onboarding
User Updated ──────────▶ Sync attributes + update reporting_chain + adjust permissions
User Deactivated ──────▶ Immediately revoke all active sessions + suspend all owned Agents
User Deleted ──────────▶ Transfer domain_owner + archive audit records + trigger data_retention
Group Changed ─────────▶ Batch update role mapping + refresh approval routing (§47)
```

---

# 49. Per-Department Compliance Policy Engine

> Added in v2.4. Enables different departments to enforce different compliance frameworks (SOX + HIPAA + PCI-DSS + GDPR coexistence).
> Related: §23 Compliance · §37.3 DomainRiskProfile · §46 Organization Hierarchy

## 49.1 Compliance Framework Registry

```typescript
interface ComplianceFramework {
  framework_id: string;                    // e.g. "sox", "hipaa", "pci_dss", "gdpr"
  name: string;
  version: string;
  controls: ComplianceControl[];
  evidence_requirements: EvidenceRequirement[];
  audit_cadence: string;                   // e.g. "quarterly", "annual"
}

interface ComplianceControl {
  control_id: string;                      // e.g. "SOX-404", "HIPAA-164.312"
  description: string;
  category: "access_control" | "data_protection" | "audit" | "change_management" | "segregation";
  enforcement: "automated" | "manual_review" | "hybrid";
  platform_mapping: string[];              // mapped to platform capabilities, e.g. ["§11.2 RBAC", "§21 Approval"]
}

interface DepartmentComplianceBinding {
  department_id: string;                   // §46 org_node
  frameworks: string[];                    // bound compliance framework IDs
  additional_controls: ComplianceControl[];// department-level additional controls
  compliance_officer: string;              // compliance officer
  evidence_retention: string;              // evidence retention period
}
```

## 49.2 Compliance Policy Inheritance

```text
company:  [Base security policy] + [Data classification policy]
    │
    ├── finance_division:  Inherited + [SOX]
    │   ├── accounting_dept: Inherited + [SOX-404 enhanced]
    │   └── payment_dept:   Inherited + [PCI-DSS]
    │
    ├── healthcare_division: Inherited + [HIPAA]
    │
    └── eu_operations:      Inherited + [GDPR]
```

Rule: Child nodes **inherit** all compliance constraints from parent nodes; they can **add** but cannot **relax** them.

## 49.3 Automated Compliance Evidence Collection

| Compliance Control | Evidence Source | Collection Method |
|---------|---------|---------|
| SOX access review | §11.2 RBAC + §28 audit log | Quarterly automatic export of access permission snapshots |
| SOX segregation of duties | §47 SodRouting | Automatic verification that approval chains have no violations |
| HIPAA data encryption | §23.5 Encryption architecture | Continuous monitoring of encryption status |
| PCI-DSS scope restriction | §46 tenant isolation | Automatic verification of CDE boundaries |
| GDPR right to erasure | §23.2 crypto-shredding | Automatic recording of deletion execution evidence |

---

# 50. Knowledge Domain Isolation and Controlled Sharing

> Added in v2.4. Enforces isolation of knowledge assets across departments, with approval-based cross-domain sharing.
> Related: §29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 Organization Hierarchy · §11 Security

## 50.1 Knowledge Isolation Model

```typescript
interface KnowledgeBoundary {
  boundary_id: string;
  org_scope: string;                       // corresponds to §46 org_node_id
  isolation_level: "strict" | "controlled" | "open";
  knowledge_namespaces: string[];          // knowledge namespaces within this boundary
  access_policy: KnowledgeAccessPolicy;
}

type IsolationLevel =
  | "strict"       // Information barrier — no cross-boundary access allowed (M&A, insider information)
  | "controlled"   // Controlled sharing requiring approval (default)
  | "open";        // Free access within boundary (same team)

interface KnowledgeAccessPolicy {
  default_action: "deny" | "allow";
  cross_boundary_rules: CrossBoundaryRule[];
}

interface CrossBoundaryRule {
  source_boundary: string;
  target_boundary: string;
  allowed_operations: ("read" | "search" | "reference")[];
  requires_approval: boolean;
  approver: "source_owner" | "target_owner" | "both" | "compliance_officer";
  data_transform?: "anonymize" | "aggregate" | "redact_pii";
  audit_level: "basic" | "full" | "forensic";
  ttl?: string;                            // sharing authorization validity period
}
```

## 50.2 Knowledge Federated Search

When an Agent searches knowledge, the KnowledgeFederator filters results by permissions:

```text
Agent Search Request
    │
    ▼
┌────────────────┐
│ Knowledge      │
│ Federator      │
└───┬────────────┘
    │
    ├──▶ [Knowledge within own boundary] → Return directly
    ├──▶ [Knowledge in controlled boundary] → Check CrossBoundaryRule → Return if authorized (possibly transformed)
    └──▶ [Knowledge in strict boundary] → Completely invisible (even its "existence" is not exposed)
```

## 50.3 Information Barrier (Chinese Wall)

Financial services scenario requirements:

- M&A team's knowledge is **completely invisible** to other departments
- The same person cannot access knowledge of conflicting parties simultaneously
- Once a person accesses Party A's knowledge, access to Party B's knowledge is automatically blocked (dynamic information barrier)

```typescript
interface ChineseWallPolicy {
  conflict_groups: ConflictGroup[];
}

interface ConflictGroup {
  group_id: string;
  boundaries: string[];                    // mutually exclusive knowledge boundaries
  rule: "access_one_blocks_others";        // accessing one automatically blocks the others
}
```

---

# 51. Tiered Governance Delegation

> Added in v2.4. Enables department administrators to self-govern within guardrails set by the platform team, so the platform team is no longer the bottleneck for all governance changes.
> Related: §24 Configuration Governance · §37.9 DomainGovernancePolicy · §46 Organization Hierarchy

## 51.1 Governance Permission Layers

```typescript
interface GovernanceDelegation {
  org_node_id: string;                     // §46
  delegated_to: string;                    // principal or role
  permissions: GovernancePermission[];
  guardrails: Guardrail[];                 // guardrails set by the platform team
}

type GovernancePermission =
  | "manage_domains"           // create/modify DomainDescriptors for this department
  | "manage_packs"             // publish/rollback Packs for this department
  | "manage_prompts"           // modify PromptLibrary for this department
  | "manage_triggers"          // configure triggers for this department (§41)
  | "manage_approvals"         // configure approval rules for this department (within amount limits)
  | "manage_budgets"           // allocate budget for this department (within parent allocation)
  | "manage_knowledge"         // manage knowledge boundaries for this department
  | "view_audit"               // view audit records for this department
  | "manage_agents"            // start/stop Agents for this department
  | "manage_eval";             // manage evaluation datasets for this department

interface Guardrail {
  guardrail_id: string;
  type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
  value: unknown;
  set_by: "platform_team";
  overridable: false;
}
```

## 51.2 Governance Inheritance and Override Rules

```text
platform_team sets global guardrails
    │
    ▼ Inherited (cannot be relaxed)
division_admin sets division policies
    │
    ▼ Inherited (cannot be relaxed) + can append
department_admin sets department policies
    │
    ▼ Inherited (cannot be relaxed) + can append
team_lead daily operational configuration
```

| Operation | Parent can | Child can |
|------|-------|-------|
| Tighten policy (lower max_risk) | ✓ | ✓ |
| Relax policy (raise max_risk) | ✓ | ✗ |
| Append constraints | ✓ | ✓ |
| Remove parent's constraints | ✓ (own constraints only) | ✗ |
| Allocate budget | ✓ (within own quota) | ✓ (within own quota) |

## 51.3 Self-Service Governance Console

| Feature | Available to Dept Admin | Available to Platform Team |
|------|-------------|------------|
| Domain onboarding wizard (§44.2) | ✓ (low/medium risk domains) | ✓ (all domains) |
| Modify approval rules | ✓ (within amount limits) | ✓ (unrestricted) |
| Publish Pack | ✓ (after automatic security scan) | ✓ |
| Adjust Agent autonomy (§42) | ✓ (not exceeding domain cap) | ✓ |
| Create triggers (§41) | ✓ (low/medium risk) | ✓ |
| Modify global guardrails | ✗ | ✓ |
| Cross-department policies | ✗ | ✓ |

---

# 52. Multi-Region Deployment Architecture

> Added in v2.5. Supports global enterprises running across Regions with compliance, data sovereignty, traffic routing, and fault isolation.
> Related: §31 Disaster Recovery · §32 Deployment · §23 Compliance · §46 Organization Hierarchy

## 52.1 Region Model

```typescript
interface RegionDefinition {
  region_id: string;                       // e.g. "cn-east", "eu-west", "us-east"
  jurisdiction: string;                    // legal jurisdiction, e.g. "CN", "EU", "US"
  data_residency_class: string;            // data residency classification
  available_providers: string[];           // LLM providers available in this Region
  compliance_frameworks: string[];         // compliance frameworks mandated in this Region
}

interface RegionTopology {
  regions: RegionDefinition[];
  primary_region: string;                  // control plane primary Region
  federation_mode: "hub_spoke" | "mesh";
  cross_region_policy: CrossRegionPolicy;
}

interface CrossRegionPolicy {
  data_replication: "none" | "metadata_only" | "anonymized" | "full_encrypted";
  workflow_routing: "region_affinity" | "nearest" | "cost_optimized";
  failover: "manual" | "semi_auto" | "auto";
  max_cross_region_latency: string;
}
```

## 52.2 Region-Aware Architecture

```text
                    ┌──────────────────────┐
                    │  Global Control Plane │ (metadata federation)
                    │  Region routing · Policy sync │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ CN Region     │ │ EU Region     │ │ US Region     │
    │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │
    │ │ P1-P5     │ │ │ │ P1-P5     │ │ │ │ P1-P5     │ │
    │ │ Full 5 planes │ │ │ Full 5 planes │ │ │ Full 5 planes │
    │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
    │ Data residency: CN  │ │ Data residency: EU  │ │ Data residency: US  │
    │ Compliance: PIPL    │ │ Compliance: GDPR    │ │ Compliance: SOX     │
    └───────────────┘ └───────────────┘ └───────────────┘
```

## 52.3 Cross-Region Workflow Routing

| Scenario | Routing Strategy | Data Handling |
|------|---------|---------|
| User in EU, task only involves EU data | Region affinity, stays in EU | Local processing |
| User in CN, needs to call US LLM | Execute in CN, LLM request routed to US | Allowed cross-border when input/output contains no PII |
| Cross-Region collaboration (EU marketing + US engineering) | Execute in respective Regions, metadata sync | Only exchange anonymized/aggregated data |
| Region failure failover | Manual/semi-auto switch to backup Region | Metadata pre-replicated, business data does not cross borders |

## 52.4 Cross-Border Data Transfer Compliance

| Jurisdiction | Compliance Framework | Platform Mechanism |
|------|---------|---------|
| EU → non-EU | GDPR Chapter V — SCCs (Standard Contractual Clauses) | Cross-Region LLM calls automatically attach SCC data processing agreement references; automatic DPIA (Data Protection Impact Assessment) before transfer |
| EU → US | EU-US Data Privacy Framework | Verify whether provider is on DPF list; fall back to SCC if not listed |
| CN → overseas | PIPL Article 38 — Security assessment / Standard contract | Automatic data volume assessment before cross-border transfer; security assessment records required when threshold exceeded |
| Intra-group cross-border | BCRs (Binding Corporate Rules) | Enterprise-level BCR template; platform automatically references BCR number in cross-border transfers and logs it |

**Cross-border transfer control chain**:

```text
Cross-Region data request
    │
    ▼
┌──────────────────┐
│ Jurisdiction      │  Identify source/target jurisdictions
│ Classifier        │
├──────────────────┤
│ Transfer Impact   │  Automatic DPIA scoring; high impact → manual approval
│ Assessor          │
├──────────────────┤
│ Mechanism         │  Select compliance mechanism: SCC / BCR / DPF / Security assessment
│ Selector          │
├──────────────────┤
│ Data Minimizer    │  Transfer only necessary fields; PII de-identification/pseudonymization
├──────────────────┤
│ Transfer Logger   │  Complete transfer log (source, target, legal basis, data volume, timestamp)
└──────────────────┘
```

---

# 53. Scaled Resource Contention Management

> Added in v2.5. Fair scheduling, priority preemption, and capacity guarantees for 5000+ concurrent workflow scenarios.
> Related: §8 Scalability · §9 Stability · §14 Runtime · §46 Organization Hierarchy · §54 SLA

## 53.1 Scheduling Layers

```text
┌─────────────────────────────────┐
│  Admission Controller           │  Global admission control
│  (reject requests exceeding platform capacity) │
├─────────────────────────────────┤
│  Quota Manager                  │  Department-level quota management
│  (guarantee/limit each department's resource share) │
├─────────────────────────────────┤
│  Priority Scheduler             │  Priority scheduling
│  (SLA-aware + preemption)       │
├─────────────────────────────────┤
│  Worker Pool                    │  Execution layer
└─────────────────────────────────┘
```

## 53.2 Resource Quota Model

```typescript
```typescript
interface ResourceQuota {
  org_node_id: string;                     // §46 Department
  guaranteed: ResourceAllocation;          // Guaranteed resources (always available)
  burstable: ResourceAllocation;           // Burstable resources (available when idle)
  max_limit: ResourceAllocation;           // Hard upper limit
}

interface ResourceAllocation {
  max_concurrent_workflows: number;
  max_concurrent_workers: number;
  llm_tokens_per_minute: number;
  llm_requests_per_minute: number;
}
```

## 53.3 Priority Preemption

```typescript
interface PriorityClass {
  class_name: "critical" | "high" | "standard" | "background" | "best_effort";
  priority_value: number;                  // 0-1000
  preemption_policy: "never" | "lower_priority" | "any_non_critical";
  queue_timeout: string;                   // Queue timeout
  guaranteed_start_sla?: string;           // Guaranteed start SLA
}
```

| Priority | Scenario | Preemption Policy | Start SLA |
|----------|----------|-------------------|-----------|
| critical(1000) | Production incident remediation | Can preempt all non-critical | < 10s |
| high(800) | E-commerce order processing | Can preempt standard and below | < 30s |
| standard(500) | Daily business workflow | No preemption | < 5min |
| background(200) | Batch analysis / reports | No preemption, runs when idle | Best effort |
| best_effort(0) | Experimental tasks | No preemption, can be preempted at any time | No guarantee |

## 53.4 Fair Scheduling

- **Weighted Fair Queuing**: Each department receives weight based on its guaranteed quota
- **Borrowing**: When a department has not used up its guaranteed quota, idle resources can be burst-used by other departments
- **Reclaim**: When the original department needs resources, borrowed resources are returned after the current step completes (graceful reclaim)
- **Starvation Prevention**: Any department's standard-priority tasks queued for more than 30min are automatically escalated to high

---

# 54. SLA Tiered Guarantees

> Added in v2.5. Provides differentiated SLA guarantees for different business importance levels, including resource reservation and violation response.
> Related: §27 SLO · §37.9 DomainGovernancePolicy · §53 Resource Contention

## 54.1 SLA Tier Model

```typescript
interface SlaTier {
  tier_id: string;
  tier_name: "platinum" | "gold" | "silver" | "bronze";
  guarantees: SlaGuarantees;
  resource_reservation: ResourceAllocation;
  violation_response: ViolationResponse;
  cost_multiplier: number;                 // Cost multiplier relative to bronze
}

interface SlaGuarantees {
  availability: string;                    // e.g. "99.99%"
  p50_latency: string;
  p95_latency: string;
  p99_latency: string;
  max_queue_time: string;
  recovery_priority: number;               // Recovery priority
  data_durability: string;                 // e.g. "99.999999%"
}

interface ViolationResponse {
  on_latency_breach: "alert" | "auto_scale" | "preempt_lower_tier";
  on_availability_breach: "alert" | "failover" | "escalate_to_platform_team";
  error_budget_policy: "standard" | "strict";  // strict = SLO violation immediately freezes changes
  internal_penalty?: string;               // Internal penalty mechanism description
}
```

## 54.2 SLA Tier Matrix

| Tier | Availability | P95 Latency | Queue Limit | Recovery Priority | Applicable Scenarios |
|------|-------------|-------------|-------------|-------------------|---------------------|
| **Platinum** | 99.99% | < 2s | < 5s | Highest | Online transactions, real-time risk control |
| **Gold** | 99.95% | < 5s | < 30s | High | Core business workflow |
| **Silver** | 99.9% | < 15s | < 5min | Medium | Daily operations |
| **Bronze** | 99.5% | < 60s | < 30min | Low | Internal tools, experiments |

## 54.3 SLA-Aware Scheduling

Dispatcher (§14.2) considers SLA Tier during scheduling:

1. **Queue Check**: When a workflow's queue time approaches `max_queue_time`, its priority is automatically escalated
2. **Latency Prediction**: Predicts whether a workflow will violate SLA based on historical data, proactively scales up or preempts
3. **Resource Reservation**: `resource_reservation` for Platinum/Gold tiers is always reserved and cannot be occupied by burst usage
4. **Violation Response**: When SLA is violated, automatically executes per `ViolationResponse` (alert/scale/preempt/escalate)

---

# 55. Agent Marketplace and Ecosystem

> Added in v2.5. Builds an internal/external ecosystem marketplace for Packs, Plugins, templates, and connectors.
> Related: §30 Business Pack · §37.7 DomainRecipe · §22 SDK/DX

## 55.1 Marketplace Architecture

```text
┌───────────────────────────────────────────┐
│  Marketplace Registry                     │
│  ├── Pack Store      (Business Domain Pack)│
│  ├── Plugin Store    (Feature Plugins)     │
│  ├── Connector Store (External System Connectors)│
│  ├── Template Store  (Workflow Templates)  │
│  ├── Prompt Store    (Domain Prompt Library)│
│  └── Eval Store      (Evaluation Datasets) │
├───────────────────────────────────────────┤
│  Quality & Security Gate                  │
│  Auto Scan · Compatibility Test · Sandbox Verification│
├───────────────────────────────────────────┤
│  Discovery & Recommendation               │
│  Search · Categories · Ratings · Smart Recommendations│
└───────────────────────────────────────────┘
```

## 55.2 Marketplace Item Model

```typescript
interface MarketplaceItem {
  item_id: string;
  item_type: "pack" | "plugin" | "connector" | "template" | "prompt_library" | "eval_dataset";
  name: string;
  description: string;
  publisher: Publisher;
  version: string;
  compatibility: CompatibilitySpec;
  pricing: "free" | "enterprise_included" | PricingPlan;
  quality: QualityMetrics;
  security: SecurityScanResult;
  install_count: number;
  rating: number;
  domain_tags: string[];
}

interface Publisher {
  publisher_id: string;
  type: "platform_official" | "enterprise_internal" | "third_party" | "community";
  verified: boolean;
  trust_level: "official" | "verified" | "community";
}

interface QualityMetrics {
  test_coverage: number;
  eval_pass_rate: number;
  incident_rate_30d: number;
  avg_rating: number;
  active_installs: number;
}
```

## 55.3 Installation and Governance

| Publisher Type | Installation Approval | Security Requirements | Update Policy |
|---------------|----------------------|----------------------|---------------|
| platform_official | Auto-install | Reviewed by platform team | Auto-update |
| enterprise_internal | Department admin approval | Automated security scan | Auto after notification |
| verified_third_party | Department admin + security team | Auto scan + manual review | Manual confirmation |
| community | Platform team approval | Full security review + sandbox testing | Manual confirmation |

## 55.4 Revenue Sharing Model

| Pricing Type | Sharing Rule | Settlement Cycle |
|-------------|-------------|-----------------|
| free | No sharing | — |
| enterprise_included | Included in platform license, publisher earns credit points by install count | Quarterly |
| paid (third_party) | Publisher 70% / Platform 30% | Monthly |
| paid (community) | Publisher 80% / Platform 20% (to encourage community contributions) | Monthly |

## 55.5 Item Deprecation Lifecycle

| Phase | Trigger Condition | Platform Action |
|-------|-------------------|-----------------|
| active | Running normally | — |
| deprecated | Publisher marks as deprecated, or 90 days without maintenance update + known security vulnerabilities exist | Install page shows deprecation warning; new installations require confirmation; recommend alternatives |
| sunset | 180 days after deprecated | Block new installations; send migration notification to existing installs (30-day countdown) |
| removed | Sunset countdown ends | Remove from Registry; freeze installed instances (no new task execution), data retained for 90 days |

## 55.6 Dependency Management

- Each MarketplaceItem declares `dependencies: { item_id: string; version_range: string }[]`
- Dependencies are automatically resolved during installation, detecting version conflicts (similar to npm/cargo resolution)
- Uninstallation checks reverse dependencies; if other items depend on it, uninstallation is blocked with a prompt
- When a dependency is deprecated, all dependent publishers and installed users are automatically notified

---

# 56. Feedback-Driven Continuous Improvement Pipeline

> Added in v2.5. Materializes the §13 Learn/Improve black-box interface into a runnable automated improvement pipeline.
> Related: §13 OAPEFLIR L-I-R · §17 Model Evaluation · §37.5 DomainEvalFramework · §42 Progressive Autonomy

## 56.1 Improvement Pipeline Overview

```text
Production Execution Data
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Signal       │────▶│ Analysis     │────▶│ Improvement  │
│ Collector    │     │ Engine       │     │ Generator    │
│ (Signal Collection)│ │ (Pattern Analysis)│ │ (Improvement Generation)│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Quality Gate │
                                           │ (Quality Gate)│──▶ §17 Eval
                                           └──────┬───────┘
                                                  │ Pass
                                           ┌──────▼───────┐
                                           │ Gradual      │
                                           │ Rollout      │──▶ §16 Prompt Canary Release
                                           └──────────────┘
```

## 56.2 Signal Collection

```typescript
interface FeedbackSignal {
  signal_type: FeedbackSignalType;
  source: "user_explicit" | "user_implicit" | "system_metric" | "eval_regression";
  domain_id: string;
  capability_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type FeedbackSignalType =
  | "user_correction"          // User modified Agent output
  | "user_approval"            // User accepted Agent output (positive sample)
  | "user_rejection"           // User rejected Agent output
  | "human_override"           // Human overrode Agent decision
  | "task_success"             // Task completed successfully
  | "task_failure"             // Task failed
  | "quality_drift"            // Eval quality degradation
  | "cost_anomaly"             // Cost anomaly
  | "latency_anomaly";         // Latency anomaly
```

## 56.3 Automatic Improvement Types

| Improvement Type | Trigger Condition | Automation Level | Output |
|-----------------|-------------------|-----------------|--------|
| **Few-shot Harvesting** | User approval accumulated > 10 | Fully automated | New few-shot examples added to PromptLibrary |
| **Prompt Fine-tuning** | Same-type user_correction > 5 | Semi-automated (generate candidates → manual review) | Prompt modification suggestions |
| **Model Routing Optimization** | cost_anomaly or latency_anomaly | Fully automated | ModelGateway routing rule updates |
| **Risk Control Rule Adjustment** | Consecutive false positive approvals > 10 | Semi-automated (suggestion → domain_owner confirmation) | Risk threshold adjustment suggestions |
| **Knowledge Base Update** | quality_drift + knowledge source expired | Fully automated | Triggers knowledge source refresh |
| **Autonomy Adjustment** | Accumulated performance data meets promotion criteria | Per §42 rules | Autonomy promotion/demotion |

## 56.4 Safety Guardrails

- Automatic improvements **must never** relax security policies or compliance controls
- Fully automated improvements are limited to **non-risk changes** (few-shot additions, routing optimization, knowledge refresh)
- Changes involving core Prompt logic or risk control rules must undergo manual review
- All automatic improvements are logged to event_log, auditable and rollbackable

---

# 57. External System Integration Framework

> Added in v2.5. Provides a standardized connector framework and pre-built connector catalog, enabling Agents to interface with real business systems.
> Related: §14.4 Executor · §11.5 Outbound Control · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 Connector Abstraction

```typescript
interface Connector {
  connector_id: string;
  name: string;
  category: ConnectorCategory;
  auth_method: "oauth2" | "api_key" | "basic" | "certificate" | "custom";
  capabilities: ConnectorCapability[];
  rate_limits: RateLimitSpec;
  data_classification: string;             // Data classification level for this connector
  health_check: HealthCheckConfig;
}

type ConnectorCategory =
  | "payment"          // Payment: Stripe, Alipay, WeChat Pay
  | "ecommerce"        // E-commerce: Shopify, Youzan, Pinduoduo
  | "crm"              // CRM: Salesforce, Feishu CRM
  | "communication"    // Communication: Email, SMS, WeCom, Feishu, DingTalk
  | "social_media"     // Social: WeChat, Douyin, Weibo, Xiaohongshu
  | "finance"          // Finance: Yonyou, Kingdee, SAP
  | "storage"          // Storage: OSS, S3, Google Drive
  | "devtools"         // Development: GitHub, GitLab, Jira
  | "analytics"        // Analytics: Google Analytics, Sensors Data
  | "ai_service"       // AI: OpenAI, Anthropic, Baidu ERNIE
  | "database"         // Database: MySQL, PostgreSQL, MongoDB
  | "custom";          // Custom API

interface ConnectorCapability {
  capability_id: string;
  operations: ("read" | "write" | "subscribe" | "webhook")[];
  schema: Record<string, unknown>;         // Input/output schema
}
```

## 57.2 Connector Lifecycle

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Install  │────▶│ Configure│────▶│ Authorize│────▶│ Active   │
│ (Install) │     │ (Configure)│   │ (Authorize)│   │ (Running) │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                 ┌──────▼─────┐
                                                 │ Monitor    │
                                                 │ (Health Monitor)│
                                                 └──────┬─────┘
                                                        │ Anomaly
                                                 ┌──────▼─────┐
                                                 │ Degrade/   │
                                                 │ Reconnect  │
                                                 └────────────┘
```

## 57.3 Pre-built Connector Catalog (Phase 1)

| Category | Connector | Priority | Capabilities |
|----------|-----------|----------|-------------|
| Communication | Feishu/WeCom/DingTalk | P0 | Message sending, approval push, calendar reading |
| Communication | Email (SMTP/IMAP) | P0 | Send, receive, search |
| Storage | Alibaba Cloud OSS / S3 | P0 | Upload, download, list |
| Development | GitHub/GitLab | P0 | PR, Issue, code search |
| Database | MySQL/PostgreSQL | P0 | Query, write |
| Social | WeChat Official Account | P1 | Message push, menu management |
| E-commerce | Youzan | P1 | Order query, product management |
| Finance | Yonyou | P1 | Voucher query, report export |
| Analytics | Sensors Data | P1 | Event query, user profiling |
| Payment | Alipay/WeChat Pay | P2 | Place order, refund, query |

## 57.4 Connector SDK

```typescript
interface ConnectorSDK {
  create(config: ConnectorConfig): Connector;
  registerCapability(cap: ConnectorCapability): void;
  handleAuth(flow: AuthFlow): Promise<AuthResult>;
  healthCheck(): Promise<HealthStatus>;
  execute(operation: string, params: Record<string, unknown>): Promise<ConnectorResponse>;
}
```

Community and enterprise internal teams can develop custom connectors through the Connector SDK and publish them to the Marketplace (§55).

---

# 59. Agent Explainability and Decision Transparency Architecture

> Added in v2.6. Builds user-facing causal explanation capabilities for every Agent decision, meeting EU AI Act / GDPR Article 22 compliance requirements, and providing the trust foundation for Progressive Autonomy (§42).
> Related: §12.7 Tracing · §13 OAPEFLIR · §17 Quality Gate · §23.6 Data Lineage · §39 NL Entry · §42 Progressive Autonomy

## 59.1 Design Principles

* Every stage of each OAPEFLIR cycle **must** generate a `StageRationale` record
* Explanations are generated on demand (lazy), adding no overhead to the normal execution path
* Explanation depth is configured per domain: finance requires forensic-level, customer service requires summary-level
* Explanation caching avoids redundant LLM calls
* Explanations are tamper-proof and incorporated into the Evidence Plane

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

```typescript
interface StageRationale {
  stage: "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "review";
  inputs_summary: string;
  reasoning: string;
  alternatives_considered: { option: string; rejected_reason: string }[];
  knowledge_citations: KnowledgeRef[];
  confidence: number;
  timestamp: string;
}
```

## 59.4 Explanation Depth Levels

| Depth | Applicable Scenario | Content |
|-------|--------------------|---------|
| L1 Summary | Non-technical users daily viewing | One-sentence overview: "Detected abnormal traffic, automatically scaled up 2 instances" |
| L2 Reasoning | Business owner review | Causal chain + key data points + alternative options |
| L3 Forensic | Compliance audit / Incident investigation | Complete evidence chain + all inputs/outputs + knowledge citations + model call details |

## 59.5 Integration with NL Entry

§39 NL interaction pipeline adds a `why` Intent type:

```typescript
interface WhyQuery {
  target: { workflow_id: string; step_id?: string };
  depth: "summary" | "reasoning" | "forensic";
  locale: string;
}
```

Users can ask in natural language "Why was the last release rolled back?", and the system parses it into a WhyQuery and invokes the explanation pipeline.

## 59.6 Explanation Caching and Security

* L1/L2 explanation cache TTL = 24h, L3 is not cached (to ensure latest evidence)
* Explanation content is subject to §50 knowledge domain isolation constraints — only evidence the user has permission to view is accessible
* Explanation logs themselves are included in the audit (§23), recording who viewed what explanation and when

---

# 60. Emergency Brake and Global Circuit Breaker Architecture

> Added in v2.6. Provides a single atomic operation to halt all Agent execution across the entire platform within < 5 seconds, for emergency scenarios such as security incidents, Prompt injection attacks, Agent escape, etc.
> Related: §9 Stability · §10 Risk Control · §11 Security · §12 Anomaly Events · §52 Multi-Region

## 60.1 PlatformPanicDirective

```typescript
interface PlatformPanicDirective {
  directive_id: string;
  triggered_by: { user_id: string; role: "platform_admin" | "security_team" };
  reason: string;
  scope: "global" | "region" | "tenant";
  target?: { region_id?: string; tenant_id?: string };
  actions: PanicAction[];
  timestamp: string;
}

type PanicAction =
  | "halt_all_workflows"
  | "block_new_creation"
  | "revoke_agent_permissions"
  | "block_all_egress"
  | "notify_all_stakeholders"
  | "generate_forensic_snapshot";
```

## 60.2 Circuit Breaker Propagation Mechanism

```text
PlatformPanicDirective
    │
    ├──▶ P1 Interface Plane: Reject all new requests (503), close WebSocket
    │
    ├──▶ P2 Control Plane: Revoke all active Agent tokens
    │
    ├──▶ P3 Orchestration Plane: Suspend all in-flight OAPEFLIR cycles
    │
    ├──▶ P4 Execution Plane: Abort all workers, rollback uncommitted side effects
    │
    ├──▶ P5 State Plane: Generate ForensicSnapshot, set read-only mode
    │
    │
    └──▶ X1 Fabric: Block all egress, trigger alerts to all channels
```

**SLA**: From Directive issuance to all planes confirming stop < 5 seconds (same Region), < 15 seconds (cross-Region).

## 60.3 Secure Recovery Protocol

| Step | Action | Requirement |
|------|--------|-------------|
| 1 | ForensicSnapshot review | Security team confirms threat has been eliminated |
| 2 | PlatformResumeDirective issuance | Requires ≥ 2 platform_admin dual-person approval |
| 3 | Gradual recovery | First restore read-only queries → low-risk workflows → full recovery |
| 4 | Post-incident report | Publish Post-Incident Report within 72h |

## 60.4 Regular Drills

* At least one emergency brake drill per quarter (within a selected tenant scope)
* Drill results are incorporated into §36 success criteria
* ForensicSnapshots generated during drills are used to verify forensic integrity

---

# 61. Agent Unified Lifecycle Management Architecture

> Added in v2.6. Models the Agent as a first-class entity — a composite of Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config, managing the complete lifecycle from creation to retirement.
> Related: §16 Prompt · §30 Pack · §42 Progressive Autonomy · §41 Proactive Agent · §55 Marketplace

## 61.1 AgentDefinition Composite Entity

```typescript
interface AgentDefinition {
  agent_id: string;
  name: string;
  domain_id: string;
  owner: OrgNodeRef;

  components: {
    pack: { pack_id: string; version: string };
    prompt_bundle: { bundle_id: string; version: string };
    model_binding: { provider: string; model: string; fallback_chain: string[] };
    trust_profile: { initial_level: AutonomyLevel; scoring_config: TrustScoringConfig };
    trigger_set: TriggerPolicy[];
    autonomy_config: AutonomyConfig;
  };

  lifecycle_state: AgentLifecycleState;
  created_at: string;
  updated_at: string;
}

type AgentLifecycleState =
  | "draft"
  | "testing"
  | "staging"
  | "canary"
  | "active"
  | "paused"
  | "deprecated"
  | "archived";
```

## 61.2 AgentVersion Snapshot

```typescript
interface AgentVersion {
  version_id: string;
  agent_id: string;
  semver: string;
  component_snapshot: {
    pack_version: string;
    prompt_bundle_version: string;
    model_binding_hash: string;
    trust_profile_hash: string;
    trigger_set_hash: string;
    autonomy_config_hash: string;
  };
  created_at: string;
  created_by: string;
  release_note: string;
}
```

## 61.3 Lifecycle State Machine

```text
draft ──▶ testing ──▶ staging ──▶ canary ──▶ active
                                              │
                          paused ◀────────────┘
                            │
                        deprecated ──▶ archived
```

| Transition | Trigger Condition | Gate |
|------------|-------------------|------|
| draft→testing | Developer submits | All component versions locked |
| testing→staging | Tests passed | §17 quality gate + security scan |
| staging→canary | Pre-release approval | Domain admin approval |
| canary→active | Canary metrics meet targets | Auto-promotion (error rate < threshold + performance meets targets) |
| active→paused | Manual/automatic pause | Behavior drift detection (§63) triggered or manual action |
| active→deprecated | Version replacement / business change | Responsibility transfer to new version completed |
| deprecated→archived | TTL expired | All historical references marked as archived |

## 61.4 Composite Canary Release

Agent canary releases operate at the AgentVersion level (not individual components):

* **Traffic splitting**: Canary version receives 5%→20%→50%→100% traffic
* **Composite rollback**: One-click rollback to the previous AgentVersion (all components roll back atomically)
* **Comparison testing**: Run two AgentVersions simultaneously on the same input, compare output differences

## 61.5 Agent Retirement and Responsibility Transfer

```typescript
interface AgentRetirement {
  retiring_agent_id: string;
  successor_agent_id?: string;
  transfer_items: ("triggers" | "subscriptions" | "scheduled_tasks" | "ownership")[];
  grace_period_days: number;
  notification_targets: string[];
}
```

---

# 62. Offline and Edge Deployment Architecture

> Added in v2.6. Supports Agent execution in intermittent connectivity scenarios such as factory floors, retail stores, and mobile devices, operating in a local-first + eventual sync mode.
> Related: §15 ModelGateway · §32 Deployment · §52 Multi-Region · §10 Risk Control

## 62.1 EdgeRuntime Minimal Runtime

```text
┌─────────────────────────────────────────┐
│  EdgeRuntime (Local device / Store server)│
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
         ▲ When connectivity resumes ▼
┌─────────────────────────────────────────┐
│  Central Platform (Cloud)               │
│  P1 + P2 + P3 + P4 + P5 + X1           │
└─────────────────────────────────────────┘
```

## 62.2 Offline Execution Constraints

| Constraint | Description |
|------------|-------------|
| Risk ceiling | Offline mode only allows execution of actions with risk_level ≤ medium |
| Model degradation | Uses local sLLM (e.g., Qwen-7B/Llama-3-8B), does not call cloud ModelGateway |
| Side effect queuing | All side effects are written to the local SyncQueue and batch-submitted when connectivity resumes |
| Approval suspension | Steps requiring approval enter pending state, waiting for connectivity to resume |
| Plan caching | EdgeRuntime periodically pre-fetches ExecutionPlan templates from Central |

## 62.3 Sync Protocol

```typescript
interface SyncProtocol {
  pullFromCentral(): Promise<SyncPacket>;
  pushToCentral(localChanges: LocalChangeSet): Promise<ConflictReport>;
  resolveConflicts(report: ConflictReport): Promise<Resolution[]>;
}

interface ConflictReport {
  conflicts: {
    entity_type: string;
    entity_id: string;
    local_version: number;
    central_version: number;
    resolution_strategy: "local_wins" | "central_wins" | "manual";
  }[];
}
```

**Conflict resolution principle**: Central state is the authoritative source; if side effects during the offline period conflict with Central, the default is Central wins + an Incident is generated for manual review.

## 62.4 Deployment Modes

| Mode | Hardware Requirements | Applicable Scenarios |
|------|----------------------|---------------------|
| Edge-Micro | ARM/x86 single-board computer, 4GB RAM | Retail store POS, IoT gateways |
| Edge-Standard | 8C/32GB server | Factory floors, warehouses |
| Edge-Mobile | iOS/Android App | Mobile field service, on-site service |
| Hybrid | Local GPU server | High-throughput scenarios requiring local inference |

---

# 63. Agent Behavior Drift Detection Architecture

> Added in v2.6. Goes beyond single-dimensional quality metrics to establish multi-dimensional behavior profiling and long-cycle changepoint detection, issuing early warnings before gradual Agent behavior changes lead to business risk.
> Related: §17 Quality Gate · §42 Progressive Autonomy · §43 Dashboard · §56 Feedback Improvement

## 63.1 Behavior Fingerprint Model

```typescript
interface BehaviorFingerprint {
  agent_id: string;
  window: { start: string; end: string };
  dimensions: {
    tool_call_distribution: Record<string, number>;
    action_sequence_patterns: { pattern: string; frequency: number }[];
    risk_score_distribution: { mean: number; stddev: number; p95: number };
    response_time_distribution: { mean: number; stddev: number; p95: number };
    approval_rate: number;
    error_rate: number;
    token_usage_per_task: { mean: number; stddev: number };
    knowledge_source_distribution: Record<string, number>;
  };
}
```

## 63.2 Changepoint Detection Engine

| Window | Detection Algorithm | Sensitivity | Purpose |
|--------|-------------------|-------------|---------|
| 1h sliding | Z-Score anomaly detection | High | Sudden changes (after model updates, Prompt changes) |
| 7d sliding | CUSUM | Medium | Short-term trends (knowledge base change impact) |
| 30d sliding | Bayesian Online Changepoint | Medium | Monthly drift (business environment changes) |
| 90d sliding | Drift Distance (KL/JS divergence) | Low | Long-term baseline shift |

## 63.3 Drift Response Strategy

```text
BehaviorDriftAlert { agent_id, dimension, severity, drift_score }
    │
    ├── severity=low  → Log to §43 dashboard, mark "drift_warning"
    │
    ├── severity=medium → Notify domain admin + automatically lower autonomy_level by one tier (§42)
    │
    └── severity=high → Pause Agent (§61 paused) + trigger Incident (§12) + require manual review
```

## 63.4 Cross-Agent Anomaly Detection

Multiple Agents under the same DomainDescriptor form a control group. When one Agent's behavior fingerprint significantly deviates from the control group, a `CrossAgentDriftAlert` should be issued even if that Agent has not triggered any single-Agent threshold.

---

# 64. Cost Attribution and Optimization Engine

> Added in v2.6. Building on §18 cost metering, adds decision-level cost attribution, automatic optimization recommendations, and What-if simulation, transforming cost data from "viewable" to "actionable".
> Related: §18 Cost Management · §15 ModelGateway · §43 Dashboard · §54 SLA

## 64.1 Decision-Level Cost Attribution

```typescript
interface CostAttribution {
  workflow_id: string;
  total_cost: Money;
  breakdown: {
    step_id: string;
    step_name: string;
    model_used: string;
    tokens: { input: number; output: number };
    cost: Money;
    was_optimal: boolean;
    optimal_alternative?: { model: string; estimated_cost: Money; quality_impact: string };
  }[];
  optimization_potential: Money;
}
```

## 64.2 Automatic Optimization Recommendations

| Recommendation Type | Detection Condition | Recommendation Content | Expected Savings |
|--------------------|--------------------|-----------------------|-----------------|
| ModelDowngrade | Low-risk step using high-end model | Switch to cost_optimized routing | 30-60% |
| CacheHit | Same query called repeatedly | Enable semantic cache | 40-80% |
| TokenTrim | Average input_tokens > 4x output_tokens | Optimize Prompt or enable context compression | 20-40% |
| BatchMerge | Multiple independent steps can be merged | Merge into a single LLM call | 50-70% |
| ScheduleShift | Non-urgent tasks executed during peak hours | Schedule to low-cost time slots | 10-30% |

```typescript
interface CostRecommendation {
  recommendation_id: string;
  type: "model_downgrade" | "cache_hit" | "token_trim" | "batch_merge" | "schedule_shift";
  target: { agent_id?: string; domain_id?: string; pack_id?: string };
  current_monthly_cost: Money;
  projected_monthly_cost: Money;
  savings: Money;
  quality_risk: "none" | "low" | "medium";
  auto_applicable: boolean;
}
```

## 64.3 What-if Cost Simulation

```typescript
interface CostSimulation {
  simulate(scenario: CostScenario): Promise<CostProjection>;
}

interface CostScenario {
  changes: (
    | { type: "model_change"; from: string; to: string }
    | { type: "volume_change"; multiplier: number }
    | { type: "autonomy_change"; new_level: AutonomyLevel }
    | { type: "new_domain_onboard"; estimated_daily_tasks: number }
  )[];
  projection_period_days: number;
}
```

## 64.4 Cost Dashboard Integration

§43 Unified Operations Dashboard adds a "Cost Intelligence" panel:

* Top 10 highest-cost Agent / Domain / Workflow this month
* Actionable savings opportunities (sorted by expected savings amount)
* Cost trends vs. budget comparison
* What-if simulation entry point

---

# 65. Workflow Visual Debugger Architecture

> Added in v2.6. Provides visual debugging and inspection capabilities for running/completed workflows, supporting real-time execution tracking, OAPEFLIR step-into debugging, and time-travel replay.
> Related: §12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow Builder · §59 Explainability

## 65.1 Debugger Capability Matrix

| Capability | Running Workflow | Completed Workflow | Description |
|------------|-----------------|-------------------|-------------|
| Execution timeline | ✓ (real-time) | ✓ | Visualization of start/end/status for each step |
| OAPEFLIR step-into | ✓ | ✓ | Expand a single step to view O/A/P/E/F/L/I/R stage details |
| Data flow view | ✓ | ✓ | Input/output data flow between steps |
| Side effect Diff | ✗ | ✓ | Expected side effects vs. actual side effects comparison |
| Breakpoint debugging | ✓ | ✗ | Pause execution at a specified step, continue after manual inspection |
| Time travel | ✗ | ✓ | Replay execution from any checkpoint |
| Run comparison | ✗ | ✓ | Side-by-side comparison of two runs |

## 65.2 Real-Time Execution Stream

```text
WebSocket /ws/v1/debug/{workflow_id}
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Timeline View                                           │
│  ┌────┐  ┌────┐  ┌────┐  ┌─────┐  ┌────┐               │
│  │ S1 │─▶│ S2 │─▶│ S3 │─▶│ S4  │─▶│ S5 │  ← Current execution position│
│  │ ✓  │  │ ✓  │  │ ▶  │  │ ... │  │ ...│               │
│  └────┘  └────┘  └────┘  └─────┘  └────┘               │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ OAPEFLIR Expand│                           │
│              │ O: Collected 3 signals                    │
│              │ A: Risk score 0.4 (medium)                │
│              │ P: Selected plan B (reason:...)           │
│              │ E: ▶ Executing...                         │
│              └─────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## 65.3 Breakpoint API

```typescript
interface DebugBreakpoint {
  workflow_id: string;
  breakpoint_type: "before_step" | "after_step" | "before_stage" | "on_risk_threshold";
  target: { step_id?: string; stage?: string; risk_threshold?: number };
  action: "pause" | "log_snapshot";
}

interface DebugSession {
  setBreakpoint(bp: DebugBreakpoint): Promise<void>;
  resume(workflow_id: string): Promise<void>;
  inspect(workflow_id: string, step_id: string): Promise<StepSnapshot>;
}
```

## 65.4 Run Comparison

```typescript
interface RunComparison {
  compare(run_a: string, run_b: string): Promise<ComparisonResult>;
}

interface ComparisonResult {
  steps_added: string[];
  steps_removed: string[];
  steps_changed: {
    step_id: string;
    diff: { field: string; value_a: unknown; value_b: unknown }[];
  }[];
  cost_diff: Money;
  duration_diff_ms: number;
}
```

---

# 66. Compliance Report Auto-Generation Engine

> Added in v2.6. Automatically assembles evidence collected by the platform into audit-ready compliance reports, supporting multiple frameworks including SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS.
> Related: §23 Compliance · §49 Departmental Compliance · §12 Incidents · §50 Knowledge Isolation

## 66.1 Report Template Registration

```typescript
interface ComplianceReportTemplate {
  framework: "SOC2_TYPE_II" | "SOX_302" | "SOX_404" | "HIPAA" | "GDPR" | "PCI_DSS" | "ISO27001";
  version: string;
  controls: {
    control_id: string;
    control_name: string;
    evidence_sources: EvidenceSource[];
    pass_criteria: string;
  }[];
}

type EvidenceSource =
  | { type: "audit_log"; query: string }
  | { type: "config_snapshot"; path: string }
  | { type: "metric"; metric_name: string; threshold: number }
  | { type: "policy_check"; policy_id: string };
```

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
│ ReportRenderer  │  ← Generates PDF + CSV + JSON according to framework template
└────────┬────────┘
         ▼
ComplianceReport { framework, period, controls_passed, controls_failed, gaps[], export_urls }
```

## 66.3 Report Types and Frequency

| Framework | Frequency | Scope | Typical Consumers |
|-----------|-----------|-------|-------------------|
| SOC2 Type II | Quarterly | Platform-wide | Auditors / Customers |
| SOX 302/404 | Quarterly | Finance domain | CFO / External Auditors |
| HIPAA | Monthly | Healthcare domain | HIPAA Officer |
| GDPR | Monthly | Platform-wide | DPO |
| PCI-DSS | Quarterly | Payments domain | QSA |
| ISO 27001 | Semi-annually | Platform-wide | CISO |

## 66.4 Auditor Read-Only Access

```typescript
interface AuditorRole {
  permissions: [
    "read:compliance_reports",
    "read:audit_logs",
    "read:config_snapshots",
    "read:evidence_bundles"
  ];
  restrictions: [
    "deny:write:*",
    "deny:read:knowledge_content",
    "deny:read:pii_data"
  ];
  session_ttl: "7d";
  mfa_required: true;
}
```

---

# 67. Capacity Planning and Cost Forecasting Engine

> Added in v2.6. Predictive capacity modeling based on historical trends, supporting scaling timing recommendations, cost trend forecasting, and What-if capacity simulation.
> Related: §18 Cost · §27 SLO · §43 Dashboard · §54 SLA · §64 Cost Optimization

## 67.1 Resource Dimension Tracking

| Dimension | Collection Source | Alert Threshold |
|-----------|------------------|-----------------|
| Worker concurrency | P4 Execution Plane | 80% of current capacity |
| Storage usage | P5 State Plane | 85% of current capacity |
| LLM Token consumption/day | §18 CostTracker | 70% of monthly budget |
| API QPS | P1 Interface Plane | 75% of current capacity |
| Event Log growth rate | P5 Event Store | 80% of storage capacity |
| Queue depth | P4 Fair Queue | Average wait time > 50% of SLA |

## 67.2 Forecasting Model

```typescript
interface CapacityForecast {
  dimension: string;
  current_usage: number;
  current_capacity: number;
  utilization_pct: number;
  trend: "growing" | "stable" | "declining";
  forecast: {
    days_30: { predicted_usage: number; confidence_interval: [number, number] };
    days_90: { predicted_usage: number; confidence_interval: [number, number] };
    days_180: { predicted_usage: number; confidence_interval: [number, number] };
  };
  breach_date?: string;
  scaling_recommendation?: {
    action: "scale_up" | "optimize" | "no_action";
    from_tier: string;
    to_tier: string;
    estimated_cost_delta: Money;
    recommended_date: string;
  };
}
```

## 67.3 What-if Capacity Simulation

```typescript
interface CapacitySimulation {
  simulate(scenario: CapacityScenario): Promise<CapacityImpact>;
}

interface CapacityScenario {
  changes: (
    | { type: "new_domain"; estimated_agents: number; estimated_daily_tasks: number }
    | { type: "traffic_spike"; multiplier: number; duration_hours: number }
    | { type: "new_region"; initial_capacity_pct: number }
    | { type: "model_migration"; from: string; to: string }
  )[];
}

interface CapacityImpact {
  dimensions_impacted: {
    dimension: string;
    current_headroom_pct: number;
    post_change_headroom_pct: number;
    action_required: boolean;
  }[];
  estimated_cost_delta: Money;
  risk_assessment: "safe" | "needs_scaling" | "critical";
}
```

## 67.4 Financial Budget Support

* Monthly cost trend reports (actual vs. budget vs. forecast)
* Quarterly capacity planning recommendations (for finance team budget approval)
* Annual TCO forecast (including hardware + LLM API + personnel costs)

---

# 68. Multimodal Capability Architecture

> Added in v2.6. Extends ModelGateway to support multimodal input/output including images, speech, and documents, enabling the platform to handle scenarios such as content creation, customer service image processing, and voice interaction.
> Related: §15 ModelGateway · §26 Storage · §37 Business Domain · §39 NL Entry

## 68.1 Multimodal ModelGateway Extension

```typescript
interface MultimodalModelGateway extends ModelGateway {
  analyzeImage(req: ImageAnalysisRequest): Promise<ImageAnalysisResponse>;
  generateImage(req: ImageGenerationRequest): Promise<ImageArtifact>;
  speechToText(req: SpeechToTextRequest): Promise<TranscriptionResponse>;
  textToSpeech(req: TextToSpeechRequest): Promise<AudioArtifact>;
  parseDocument(req: DocumentParseRequest): Promise<StructuredDocument>;
}
```

## 68.2 Multimodal ModelRequest Extension

```typescript
interface MultimodalModelRequest extends ModelRequest {
  content: MultimodalContent[];
}

type MultimodalContent =
  | { type: "text"; text: string }
  | { type: "image"; image_url: string; detail: "low" | "high" }
  | { type: "audio"; audio_url: string; format: "wav" | "mp3" | "opus" }
  | { type: "document"; document_url: string; format: "pdf" | "xlsx" | "docx" }
  | { type: "video"; video_url: string; sample_rate_fps: number };
```

## 68.3 ModalityRouter

| Modality | Default Provider | Fallback | Cost Model |
|----------|-----------------|----------|------------|
| Text LLM | GPT-4o / Claude | Qwen / DeepSeek | per-token |
| Image Analysis | GPT-4o Vision / Claude Vision | Qwen-VL | per-image |
| Image Generation | DALL-E 3 / Midjourney API | Stable Diffusion (self-hosted) | per-image |
| Speech-to-Text | Whisper API | Paraformer (self-hosted) | per-minute |
| Text-to-Speech | Azure TTS / ElevenLabs | CosyVoice (self-hosted) | per-character |
| Document Parse | Document Intelligence | Marker / Docling (self-hosted) | per-page |

## 68.4 Multimodal Security

* Image inputs undergo content moderation (pornography/violence/sensitive information detection)
* Generated images carry C2PA metadata watermarks
* Speech input PII detection (phone numbers, ID numbers automatically redacted)
* Document parsing results are subject to §50 knowledge domain isolation constraints

## 68.5 Multimodal Cost Tracking

§18 CostTracker extended with a `modality` dimension:

```typescript
interface MultimodalCostRecord extends CostRecord {
  modality: "text" | "image_analysis" | "image_generation" | "stt" | "tts" | "document_parse";
  modality_units: number;
  modality_unit_type: "token" | "image" | "minute" | "character" | "page";
}
```

---

# 69. Platform Self-Operations Agent Architecture

> Added in v2.6. The platform uses its own Agent capabilities for self-operations (dog-fooding), covering automated Incident diagnosis, common fault self-repair, configuration optimization recommendations, and developer Q&A.
> Related: §12 Incidents · §14 Execution · §37 Business Domain · §41 Proactive Agent · §43 Dashboard

## 69.1 PlatformOps DomainDescriptor

```typescript
const platformOpsDomain: DomainDescriptor = {
  domain_id: "platform-ops",
  domain_class: "operations",
  risk_profile: {
    base_risk: "medium",
    override: { "write:production_config": "critical", "restart:service": "high" },
  },
  capabilities: [
    "diagnose_incident",
    "analyze_root_cause",
    "recommend_config_optimization",
    "predict_capacity_issue",
    "answer_developer_question",
    "generate_runbook_suggestion",
  ],
  constraints: {
    default_autonomy: "supervised",
    max_autonomy: "semi_auto",
    production_write: "requires_approval",
    read_only_by_default: true,
  },
};
```

## 69.2 Self-Operations Agent Directory

| Agent | Trigger Condition | Capabilities | Autonomy Ceiling |
|-------|-------------------|--------------|-----------------|
| IncidentDiagnoser | Incident creation event | Collect logs, analyze root cause, generate diagnostic report | semi_auto |
| ConfigOptimizer | Weekly schedule + performance deviation | Analyze configuration, suggest optimization, estimate impact | supervised |
| CapacityPredictor | Daily schedule | Analyze trends, predict bottlenecks, suggest scaling | supervised |
| DevAssistant | Developer question | Query docs, search code, generate examples | semi_auto |
| HealthMonitor | Continuous running | Patrol platform health, generate daily report | auto (read-only) |

## 69.3 Security Guardrails

* All production environment write operations **must** go through manual approval
* PlatformOps Agent's ModelGateway calls have independent cost budget and rate limit
* PlatformOps Agent cannot access business domain data, only platform operations data
* All PlatformOps Agent operations are included in an independent audit stream (§23), isolated from business audits

## 69.4 Self-Operations Maturity Levels

| Level | Description | Human Involvement |
|-------|-------------|-------------------|
| L0 | Fully manual operations, Agent only assists with documentation queries | 100% |
| L1 | Agent generates diagnostic reports, humans make decisions and execute | 80% |
| L2 | Agent generates fix plans and pre-execution validation, humans confirm with one click | 40% |
| L3 | Agent automatically handles P3/P4 level issues, P1/P2 still require humans | 15% |

Initial deployment starts at L0, progressing gradually according to §42 progressive autonomy.

---

# 70. Conclusion

This is not "an Agent platform that automatically does things", but rather:

> **An enterprise operating system that treats Agents as high-risk automation units with strict control, isolation, recovery, auditing, and governance — from one-person companies to 10,000-person enterprises, covering the full stack of infrastructure, AI operations, business domain onboarding, intelligent interaction, organizational governance, scaled ecosystem, and operational maturity through a seven-layer architecture.**

Its core is not about "how smart it is", but rather:

* Conservative by default
* High risk must be controlled
* Anomalies must be classified and handled
* Execution must be recoverable
* State must be replayable
* Behavior must be auditable
* The platform must be degradable
* Business must be pluggable but cannot bypass the foundation
* **Business domains must be structurally understood, not treated as opaque black boxes**
* **Non-technical users must be able to use it directly, without understanding the underlying architecture**
* **Organizational governance must adapt to enterprise hierarchies, not assume flat structures**
* **Scaled operation must have fair resource scheduling and differentiated SLA guarantees**
* **Agent decisions must be explainable, and behavior drift must be detectable**
* **The platform must have emergency braking capability, and Agents must have a unified lifecycle**
* **Offline/edge scenarios must be operable — disconnection does not mean shutdown**
* **Multimodal input and output must be under unified security controls and cannot bypass content review**

### Seven-Layer Architecture Evolution Overview

| Layer | Version | Problem Solved | Core Sections |
|-------|---------|---------------|---------------|
| Infrastructure Layer | v2.0 | How to build the platform | §4-§14, §24-§32 |
| AI Operations Layer | v2.1 | How to operate AI | §15-§23 |
| Business Domain Onboarding Layer | v2.2 | How to onboard business | §37-§38 |
| Intelligent Interaction Layer | v2.3 | How users use it | §39-§44 |
| Organizational Governance Layer | v2.4 | How to manage the organization | §46-§51 |
| Scaled Operation Layer + Ecosystem Layer | v2.5 | How to handle scale + How to build the ecosystem | §52-§57 |
| Operational Maturity Layer | v2.6 | How to use it well + How to operate safely | §59-§69 |

### v2.6 Operational Maturity Layer Capability Summary

| Problem | v2.5 | v2.6 |
|---------|------|------|
| How do users understand Agent decisions? | Audit logs only | §59 Explainability and Decision Transparency |
| How to emergency-stop security incidents? | Kill one by one | §60 Emergency Brake and Global Circuit Breaker |
| How to manage Agents as a whole? | Components managed separately | §61 Unified Lifecycle Management |
| How to run in offline/edge scenarios? | Not supported | §62 Offline and Edge Deployment |
| How to detect gradual Agent behavior changes? | Quality thresholds only | §63 Behavior Drift Detection |
| How to optimize costs? | Metering only | §64 Cost Attribution and Optimization Engine |
| How to debug Workflow failures? | Read raw logs | §65 Visual Debugger |
| How to produce compliance reports? | Manual compilation | §66 Compliance Report Auto-Generation |
| When should we scale up? | Guesswork | §67 Capacity Planning and Cost Forecasting |
| How to handle images/speech/documents? | Not supported | §68 Multimodal Capabilities |
| How to operate without an SRE team? | Fully manual | §69 Platform Self-Operations Agent |

Only by simultaneously possessing the **stability of the infrastructure layer**, the **controllability of the AI operations layer**, the **structure of the business domain onboarding layer**, the **usability of the intelligent interaction layer**, the **adaptability of the organizational governance layer**, the **scalability of the scaled operation layer**, and the **production-readiness of the operational maturity layer**, can an enterprise upgrade an Agent platform from architectural design to a truly enterprise-grade productivity operating system covering one-person companies to 10,000-person enterprises across 12+ vertical business lines.

---

# Appendix G: Glossary and Abbreviation Index

| Abbreviation/Term | Full Name | Description |
|-------------------|-----------|-------------|
| OAPEFLIR | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Recover | The eight stages of the Agent core loop (§13) |
| HITL | Human-In-The-Loop | Human-machine collaboration mode, humans participate in Agent decision chain (§21) |
| DLQ | Dead Letter Queue | Dead letter queue, staging area for unprocessable messages/events (§28.6) |
| CAS | Compare-And-Swap | Optimistic concurrency control primitive, used for StateCommand idempotent writes (§5.4) |
| SLO / SLA | Service Level Objective / Agreement | Service level objective/agreement (§27, §54) |
| SEV1-4 | Severity 1-4 | Incident severity levels (1 is highest) (§12) |
| TTFT | Time To First Token | Latency of the first token arrival in LLM streaming response (§27.7) |
| SCC | Standard Contractual Clauses | GDPR standard contractual clauses, legal mechanism for cross-border data transfer (§52.4) |
| BCR | Binding Corporate Rules | Binding corporate rules, intra-group cross-border data transfer mechanism (§52.4) |
| DPIA | Data Protection Impact Assessment | Data protection impact assessment (§52.4) |
| PIPL | Personal Information Protection Law | China's Personal Information Protection Law (§52) |
| WCAG | Web Content Accessibility Guidelines | Accessibility guidelines (§44.6) |
| SCIM | System for Cross-domain Identity Management | Cross-domain identity management protocol (§48) |
| SSO | Single Sign-On | Single sign-on (§48) |
| RBAC | Role-Based Access Control | Role-based access control (§11) |
| DAG | Directed Acyclic Graph | Directed acyclic graph, used for goal decomposition and task dependencies (§40) |
| Pack | Business Pack | Business domain capability pack, the deployable unit of an Agent (§30) |
| UoW | Unit of Work | Unit of work, atomic boundary of transactional operations |
| WAL | Write-Ahead Log | Write-ahead log, persistence mechanism ensuring crash recovery (§31) |
| P1-P5 | Plane 1-5 | Five-plane architecture (Interface · Control · Orchestration · Execution · State & Evidence) (§4) |
| X1 | Cross-cutting Fabric | Cross-cutting concerns (Reliability · Governance · Intelligence) (§4) |
| NL | Natural Language | Natural language (§39) |
| sLLM | Small LLM | Small localized language model, used for edge/offline scenarios (§62) |
| RTO / RPO | Recovery Time / Point Objective | Recovery time/point objective (§31) |

---

# Appendix A: Version Change History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04 | Initial five-plane architecture + stability seven layers + OAPEFLIR conceptual design |
| v1.1 | 2026-04 | Added risk matrix, DLQ model, deployment recommendations |
| v1.2 | 2026-04 | Added data model 44 tables, event namespace, ADR recommendations, recommended directory |
| v2.0 | 2026-04-18 | **Infrastructure improvement release**: Added inter-plane communication contracts (§5), API contracts (§6), service communication (§7), scalability (§8), configuration governance (§24), performance SLO (§27), disaster recovery and high availability (§31); Improved risk scoring (§10), OAPEFLIR interfaces (§13), storage abstraction (§26), deployment (§32), roadmap (§33); Resolved 14 design deficiencies from v1.2 |
| v2.1 | 2026-04-19 | **AI operations complete release**: Added LLM Provider abstraction and failover (§15), Prompt management and versioning (§16), model evaluation and quality gates (§17), cost management and token metering (§18), inter-Agent delegation and collaboration (§19), long-running tasks and Workflow hibernation (§20), human-machine collaboration modes (§21), SDK and developer experience (§22), compliance and data governance (§23); Improved API authentication and Webhooks (§6), security threat model (§11), alert routing and distributed Tracing (§12), Error Budget and LLM latency (§27), Pack lifecycle and Plugin governance (§30); Added 9 ADRs; Resolved 14 AI operations layer deficiencies from v2.0 |
| v2.2 | 2026-04-19 | **Business domain onboarding complete release**: Added business domain modeling and onboarding architecture (§37) — DomainDescriptor structured domain modeling, DomainRiskProfile domain risk profiling, DomainKnowledgeSchema domain knowledge structure, DomainEvalFramework domain evaluation framework, DomainPromptLibrary domain Prompt library, DomainRecipe domain template prototype, DomainInteractionPolicy cross-domain interaction strategy, DomainGovernancePolicy domain governance model; Added business domain onboarding Runbook (§38) — four-stage gate process (Modeling → Development → Certification → Canary); Improved Business Pack model (§30) to associate with DomainDescriptor; Added 4 ADRs; Resolved 10 business domain onboarding layer deficiencies from v2.1 |
| v2.3 | 2026-04-19 | **Intelligent interaction complete release**: Added natural language task entry architecture (§39), goal decomposition engine architecture (§40), proactive Agent framework (§41), progressive autonomy model (§42), unified operations dashboard architecture (§43), non-technical user experience architecture (§44); Added 6 ADRs; Upgraded the platform from "Agent infrastructure" to an "Agent operating system" for non-technical users |
| v2.4 | 2026-04-19 | **Organizational governance complete release**: Added organizational hierarchy model (§46), organizational structure approval routing (§47), enterprise SSO/SCIM integration (§48), departmental compliance policy engine (§49), knowledge domain isolation and controlled sharing (§50), tiered governance delegation (§51); Added 6 ADRs; Enabled the platform to adapt to organizational complexity from one-person companies to 10,000-person enterprises |
| v2.5 | 2026-04-19 | **Scaled ecosystem complete release**: Added multi-Region deployment architecture (§52), scaled resource contention management (§53), SLA tiered guarantees (§54), Agent marketplace and ecosystem (§55), feedback-driven continuous improvement pipeline (§56), external system integration framework (§57); Added 6 ADRs; Completed cross-Region high availability, fair resource scheduling, differentiated SLA guarantees, open ecosystem, and continuous self-improvement capabilities |
| v2.6 | 2026-04-19 | **Operational maturity complete release**: Added Agent explainability and decision transparency (§59), emergency brake and global circuit breaker (§60), Agent unified lifecycle management (§61), offline and edge deployment (§62), Agent behavior drift detection (§63), cost attribution and optimization engine (§64), workflow visual debugger (§65), compliance report auto-generation engine (§66), capacity planning and cost forecasting (§67), multimodal capabilities (§68), platform self-operations Agent (§69); Added 11 ADRs; Completed the operational maturity layer bridging from "architecturally complete design" to "production-ready operations" |
| v2.7 | 2026-04-19 | **Quality correction release**: Fixed ADR autonomy level contradiction (monotonic → guarded progression); Unified §9.5/§14.8 pattern enumeration to 8-pattern canonical set; Completed missing principal/trace_id fields in ExecutionPlan/StateCommand; Extended Prompt injection defense architecture (§16.5); Fixed ADR-NL TaskSpec → RequestEnvelope reference; Completed §26 data model (44 → 71 tables) and §28 event namespace (17 → 25); Completed §33 roadmap Phase 5-7; Completed §43 L2/L3 dashboard view definitions; Added §39.7 i18n, §44.6 WCAG, §52.4 GDPR cross-border transfer, §55.4-55.6 marketplace revenue/deprecation/dependency management, §15.6 streaming error handling; Added §40 circular dependency detection, §5.2 P2→P4 communication path; Fixed §62 typo and §70 conclusion omission; Added Appendix G glossary |
