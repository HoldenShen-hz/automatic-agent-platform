# "Enterprise-level Agent Platform Overall Technical Architecture Design Document" 

> **Documentation version**: v2.7 
> **Document Status**: Release 
> **Preamble version**: v2.6 Release Candidate 
> **Document positioning**: Enterprise-level/platform-level Agent System overall technical architecture design document (stability first · Complete AI operation · Complete business domain access · Complete intelligent interaction · Complete organizational governance · Complete large-scale ecology · Complete operational maturity · Implementation-oriented version) 
> **Applicable objects**: Architecture committee, platform R&D team, Runtime team, SRE, security team, governance team, business domain access team, AI/ML engineering team, business line leaders, non-technical business operators, organizational management, compliance/audit team, ecological partners, edge/field operation and maintenance team 
> **Design Goal**: Build an enterprise-level Agent platform with stability, risk control, safety and reliability, and exception handling as the first principles, so that the Agent can be controlled, recoverable, and auditable for long-term operation in the enterprise environment as a high-risk automation unit; at the same time, it has complete AI operation capabilities (LLM abstraction, Prompt governance, model quality, and cost control) to ensure that the platform is in AI The layers are also controllable and evolvable; provide a structured business domain modeling and access framework; build an intelligent interaction layer for non-technical users; establish a complete organizational governance system and large-scale operation ecological layer; ** and complete the operational maturity layer - Agent explainability, emergency braking, unified life cycle management, offline/edge deployment, behavior drift detection, cost attribution optimization, visual debugging, automatic generation of compliance reports, capacity planning, multi-modal capabilities, platform self-operation and maintenance Agent - enables the platform to move from architectural design to a truly production-ready enterprise-level operating system** 

## v2.1 upgrade instructions 

### v2.0 Review 

v2.0 solves 14 design flaws based on v1.2: new inter-plane communication contract (§5), API contract (§6), service communication (§7), scalability (§8), configuration governance (§24), performance SLO (§27), disaster recovery (§31); improved risk score (§10), OAPEFLIR Interface (§13), storage abstraction (§26), deployment (§32), roadmap (§33). 

### v2.1 Improvement Focus 

v2.0 has far exceeded the industry average at the infrastructure layer (stability, risk, status, recovery). However, as an **enterprise-level AI Agent platform**, there are key gaps in the AI ​​operation layer and developer experience:
| Bugs | Impact | v2.1 Improvements |
|------|------|----------|
| No LLM Provider abstraction | Single provider failure = full platform unavailable, no failover | New §15 LLM Provider abstraction and failover |
| No Prompt management and versioning | Agent core "source code" cannot be controlled, rolled back, or A/B | New §16 Prompt management and versioning |
| No model evaluation and quality access control | Bad prompt/model is pushed online without protection | Added §17 Model evaluation and quality access control |
| No cost management and Token measurement | LLM cost-led OPEX but no per-tenant measurement and budget enforcement | New §18 Cost management and Token measurement |
| No inter-Agent delegation agreement | Complex tasks require multi-Agent collaboration but no delegation semantics | New §19 Inter-Agent delegation and collaboration |
| No long-term task architecture | Hour/day level workflow without sleep/wake/persistent timer | Added §20 long-term task and Workflow sleep |
| HITL only has basic approval gate | Lacks multi-party approval, delegation, iterative feedback, and timeout strategy | New §21 human-machine collaboration mode |
| No SDK / Developer Experience | The business team has no Pack development tool chain and cannot access | Added §22 SDK and Developer Experience |
| No compliance architecture | GDPR right-to-erasure conflicts with append-only, no data residency | New §23 Compliance and Data Governance |
| §6 API design is incomplete | Missing OAuth process, paging, Pack management endpoint, Webhook delivery guarantee | Improvement §6 Complete addition |
| §11 Security Missing Threat Model | No STRIDE Analysis, Encryption at Rest, Sandbox Technical Specifications | Improvements §11 Supplementary Threat Model |
| §12 Lack of alarm routing | Incident generated but no routing to human architecture | Improvement §12 Supplementary alarm routing and distributed Tracing |
| §27 SLO lacks Error Budget | No burn-rate warning, no LLM delayed teardown | Improvement §27 Supplementary Error Budget |
| §30 Pack lacks life cycle | Only Manifest, lacks development → certification → release → abandonment of the entire link | Improvement §30 Supplementary life cycle and Plugin governance |
## v2.2 upgrade instructions 

### v2.1 Review 

v2.1 has formed a complete closed loop at the infrastructure layer and AI operation layer: LLM Provider abstraction (§15), Prompt management (§16), model evaluation (§17), cost management (§18), Agent delegation (§19), long-term tasks (§20), human-machine collaboration (§21), SDK/DX (§22), and compliance (§23). 

### v2.2 Improvement Focus 

v2.1 solved "how to build the platform" and "how to operate AI", but it did not answer the core question: how to undertake the diverse business within the enterprise after the platform is set up? ** 

The 12+ vertical business lines within the company (code development, material production, advertising, user operations, game development, live streaming, corporate knowledge base, finance, HR, customer service, security operation and maintenance, data analysis) have huge differences in risk levels, knowledge structures, tool ecology, evaluation standards, and prompt strategies. The current Business Pack (§30) only defines a flat manifest and treats business domains as opaque "packages" - **The lack of a structured domain modeling framework prevents the platform from truly understanding, constraining, and optimizing Agent behavior in different business domains**.
| Bugs | Impact | v2.2 Improvements |
|------|------|----------|
| No business domain abstract model | The platform cannot distinguish the domain characteristics of "financial approval" and "material generation" | New §37 DomainDescriptor structured domain modeling |
| No domain risk profile | All businesses share the same risk_matrix and cannot differentiate risk control | §37.3 DomainRiskProfile domain-level risk override |
| No domain knowledge Schema | Knowledge retrieval strategies, timeliness, and conflict resolution of different businesses cannot be expressed | §37.4 DomainKnowledgeSchema |
| Domain-free evaluation framework | Code correctness vs. advertising ROI vs. content compliance - cannot be unified yet differentiated | §37.5 DomainEvalFramework |
| No domain Prompt library | Business prompts are scattered everywhere, no reuse and no management | §37.6 DomainPromptLibrary |
| Domainless template/Recipe | Similar business (HR/customer service) reinventing the wheel | §37.7 DomainRecipe four prototype templates |
| No cross-domain interaction policy | Multi-business domain Agent collaboration without boundaries and no compensation | §37.8 DomainInteractionPolicy |
| Domain-free governance model | Business domain ownership, SLO, and budget are not vested | §37.9 DomainGovernancePolicy |
| No standardized access process | New business access relies on oral communication, no checklist | Added §38 four-stage access runbook |
| §30 Manifest only, no domain semantics | Pack does not understand what business domain it belongs to | Improvement §30 Association DomainDescriptor |
## v2.3 upgrade instructions 

### v2.2 Review 

v2.2 completes the business domain access layer: DomainDescriptor structured domain modeling (§37), four-stage access runbook (§38), domain risk portrait/knowledge structure/assessment framework/Prompt library/template prototype/cross-domain strategy/governance model. 

### v2.3 Improvement Focus 

v2.0-v2.2 solves the three-layer problems of "how to build the platform" (infrastructure) → "how to operate AI" (AI operation) → "how to connect business" (business domain modeling). But these three layers are all designed for platform engineers and technical teams - real business users (non-technical operators, business line leaders, and even independent operators of one-person companies) cannot directly use the platform. 

The v2.2 gap analysis identified 42 gaps, of which the most critical 6 were concentrated in the **Intelligent Interaction Layer**:
| Bugs | Impact | v2.3 Improvements |
|------|------|----------|
| No natural language task entry | Users must handwrite JSON/API to create tasks | Added §39 natural language task entry structure |
| No goal decomposition engine | Users must manually decompose business goals into single-domain tasks | New §40 goal decomposition engine architecture |
| No active Agent | Agent can only passively wait for API calls and cannot run autonomously | New §41 Active Agent Framework |
| No progressive autonomy | automation_level static configuration, Agent can never "earn trust" | New §42 Progressive Autonomy Model |
| No unified operation dashboard | Only infrastructure-level metrics, no "everything is normal" business view | Added §43 unified operation dashboard architecture |
| No non-technical user UX | Only SDK+CLI, non-developers cannot use it | New §44 Non-technical user experience architecture |

**v2.3 Core Positioning**: Building on the three-layer foundation constructed in v2.0-v2.2, adding the **intelligent interaction layer for end users**, elevating the platform from "Agent infrastructure" to "Agent operating system".

```text
v2.3  ┌─────────────────────────────────────────────┐
      │  Intelligent Interaction Layer (User-side OS) │  ← v2.3 New
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Access Layer                │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                          │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                         │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit  │
      └─────────────────────────────────────────────┘
```
## v2.4 upgrade instructions 

### v2.3 Review 

v2.3 completes the intelligent interaction layer: natural language task entry (§39), goal decomposition engine (§40), proactive Agent framework (§41), progressive autonomy model (§42), unified operation dashboard (§43), and non-technical user experience (§44). 

### v2.4 Improvement Focus 

v2.0-v2.3 has been built layer by layer from infrastructure to intelligent interaction layer, but **all assume that "the organization is flat and governance is unified"** - this is applicable to a one-person company, but completely untrue in a company with 10,000 people. Enterprises with 10,000 people have deep organizational levels of business groups → departments → teams. Different levels have different approval links, compliance requirements, knowledge visibility and governance autonomy.
| Bugs | Impact | v2.4 Improvements |
|------|------|----------|
| No organizational hierarchy model | The platform only has the concept of tenant and cannot express the department/team hierarchy | Newly added §46 Organizational hierarchy model |
| No organizational structure approval routing | The approval link is hard-coded and cannot be dynamically routed based on the organizational structure | New §47 Organizational Structure Approval Routing |
| No SSO/SCIM integration | Manual creation per user, no synchronization with enterprise directory | New §48 Enterprise SSO/SCIM integration |
| No sub-department compliance policy | All departments share the same compliance rules, there is no difference between the financial department and the creative department | Newly added §49 sub-department compliance policy engine |
| No knowledge domain isolation | The knowledge of different departments has no boundaries and there is a risk of data leakage | New §50 Knowledge domain isolation and controlled sharing |
| No hierarchical governance delegation | Platform administrators have centralized control and cannot delegate governance rights to departments | New §51 hierarchical governance delegation |

**v2.4 Core Positioning**: Building on the intelligent interaction layer of v2.3, adding the **organizational governance layer**, enabling the platform to adapt to organizational complexity from one-person companies to companies with 10,000 employees.

```text
v2.4  ┌─────────────────────────────────────────────┐
      │  Organizational Governance Layer             │  ← v2.4 New
      │  Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation │
      ├─────────────────────────────────────────────┤
v2.3  │  Intelligent Interaction Layer (User-side OS) │
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Access Layer                │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                          │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                         │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit  │
      └─────────────────────────────────────────────┘
```
## v2.5 upgrade instructions 

### v2.4 Review 

v2.4 completes the organizational governance layer: organizational hierarchy model (§46), organizational structure approval routing (§47), enterprise SSO/SCIM integration (§48), departmental compliance policy engine (§49), knowledge domain isolation and controlled sharing (§50), hierarchical governance delegation (§51). 

### v2.5 Improvement Focus 

v2.0-v2.4 has built a five-layer complete architecture of **Infrastructure→AI Operation→Business Domain Access→Intelligent Interaction→Organizational Governance**, but these five layers assume "running in a single data center with limited concurrency." When enterprises deploy across Regions, have thousands of concurrent workflows, and have multiple business lines competing for resources, they need to ensure large-scale operation. At the same time, the platform is moving from a closed system to an open ecosystem, which requires an Agent market, feedback-driven improvements, and an external system integration framework.
| Bugs | Impact | v2.5 Improvements |
|------|------|----------|
| No multi-region deployment | Single data center failure = the entire platform is unavailable | New §52 multi-region deployment architecture |
| No resource competition management | High-priority tasks are blocked by low-priority tasks | New §53 Large-scale resource competition management |
| No SLA hierarchical guarantee | All tasks are treated equally, and service commitments cannot be differentiated | New §54 SLA hierarchical guarantee |
| No Agent Market | All Agents/Packs are developed internally and cannot be reused | Added §55 Agent Market and Ecosystem |
| No feedback-driven improvement | No closed loop of user feedback, the platform cannot optimize itself | New §56 Feedback-driven continuous improvement pipeline |
| No external system integration framework | Each external system integration is independent and there is no unified model | New §57 External system integration framework |

**v2.5 Core Positioning**: Completing the **scaled operation and ecosystem layer**, enabling the platform to have cross-region high availability, fair resource scheduling, differentiated SLA guarantees, open ecosystem, and continuous self-improvement capabilities.

```text
v2.5  ┌─────────────────────────────────────────────┐
      │  Scaled Operations + Ecosystem Layer          │  ← v2.5 New
      │  Multi-Region · Resource Competition · SLA · Market · Feedback · Integration  │
      ├─────────────────────────────────────────────┤
v2.4  │  Organizational Governance Layer             │
      │  Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation │
      ├─────────────────────────────────────────────┤
v2.3  │  Intelligent Interaction Layer (User-side OS) │
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Access Layer                │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                          │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                         │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit  │
      └─────────────────────────────────────────────┘
```
## v2.6 upgrade instructions 

### v2.5 Review 

v2.5 completes the scaled operation and ecological layer: multi-region deployment (§52), resource competition management (§53), SLA hierarchical guarantee (§54), Agent market (§55), feedback-driven improvement (§56), and external system integration (§57). 

### v2.6 Improvement Focus 

v2.0-v2.5 built a **six-layer complete architecture** from infrastructure to ecology, but all focused on the "construction layer" - solving the problem of "how to build it". Compared with enterprise-level platforms that are truly ready for production, there is a lack of an "operational maturity layer" that solves the problems of "how to use it well" and "how to operate it safely". 

The v2.5 gap analysis identified 20 gaps, with the 11 most critical ones concentrated in the **Operations Maturity Layer**:
| Bugs | Impact | v2.6 Improvements |
|------|------|----------|
| No decision explainability | Users cannot understand the reasons for Agent’s decisions, EU AI Act compliance gap | New §59 Agent explainability and decision transparency |
| No emergency braking | Unable to stop the entire platform Agent instantly in the event of a security incident | Added §60 emergency braking and global fuse |
| Agent-less unified entity | Agent is a loose combination of components, without composite version and life cycle management | New §61 Agent unified life cycle management |
| No offline/edge deployment | Factory/store/mobile scenarios cannot be used, excluding the entire industry vertical | Added §62 Offline and edge deployment architecture |
| No behavior drift detection | Agent gradient behavior escapes the quality threshold but its essence has changed | New §63 Agent behavior drift detection |
| No cost attribution and optimization | Cost data can be seen but not actionable, and cannot guide optimization | New §64 cost attribution and optimization engine |
| No visual debugging | If Workflow fails, you can only check the original log, no debugging experience | Added §65 Workflow visual debugger |
| No compliance report automatically generated | Evidence exists but cannot be automatically assembled into an audit report | New §66 compliance report automatic generation engine |
| No capacity planning and forecast | No predictive expansion suggestions, expansion timing depends on guesswork | New §67 Capacity planning and cost forecast |
| No multi-modal capability | ModelGateway is plain text and cannot process images/voices/documents | New §68 multi-modal capability architecture |
| No platform self-operation and maintenance | All operations and maintenance rely on manual SRE, and a one-person company does not have an SRE team | Added §69 Platform self-operation and maintenance Agent |

**v2.6 Core Positioning**: Completing the **operational maturity layer**, elevating the platform from "complete architectural design" to "production-ready operation".

```text
v2.6  ┌─────────────────────────────────────────────┐
      │  Operational Maturity Layer                  │  ← v2.6 New
      │  Explainability · Emergency Brake · Lifecycle · Edge · Drift Detection  │
      │  Cost Optimization · Debugger · Compliance Report · Capacity · Multimodal    │
      ├─────────────────────────────────────────────┤
v2.5  │  Scaled Operations + Ecosystem Layer         │
      │  Multi-Region · Resource Competition · SLA · Market · Feedback · Integration  │
      ├─────────────────────────────────────────────┤
v2.4  │  Organizational Governance Layer             │
      │  Org Hierarchy · Approval Routing · SSO · Compliance · Knowledge Isolation · Delegation │
      ├─────────────────────────────────────────────┤
v2.3  │  Intelligent Interaction Layer (User-side OS) │
      │  NL Entry · Goal Decomposition · Proactive Agent · Autonomy · Dashboard  │
      ├─────────────────────────────────────────────┤
v2.2  │  Business Domain Access Layer                │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI Operations Layer                          │
      │  LLM Abstraction · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  Infrastructure Layer                         │
      │  Five Planes · Stability · Risk · Security · Recovery · Audit  │
      └─────────────────────────────────────────────┘
```
--- 

# Directory 

1. [Document Overview](#1-Document Overview) 
2. [Platform root assumptions and design goals](#2-Platform root assumptions and design goals) 
3. [Platform Definition and Non-Goals](#3-Platform Definition and Non-Goals) 
4. [Overall structure: five planes + one cross-cutting control mesh] (#4-overall structure five planes--one cross-cutting control mesh) 
5. [Inter-plane communication contract](#5-Inter-plane communication contract) 
6. [API contract and versioned architecture](#6-api-Contract and versioned architecture) 
7. [Service Communication Architecture](#7-Service Communication Architecture) 
8. [Scalability Architecture](#8-Scalability Architecture) 
9. [Stable Architecture](#9-Stable Architecture) 
10. [Risk Control Structure](#10-Risk Control Structure) 
11. [Safe and reliable architecture](#11-Safe and reliable architecture) 
12. [Exception event processing architecture](#12-Exception event processing architecture) 
13. [OAPEFLIR controlled cognitive kernel](#13-oapeflir-controlled cognitive kernel) 
14. [Runtime Execution Plane](#14-runtime-execution-plane) 
15. [LLM Provider abstraction and failover architecture](#15-llm-provider-Abstraction and failover architecture) 
16. [Prompt Management and Versioning Architecture](#16-prompt-Management and Versioning Architecture) 
17. [Model Evaluation and Quality Access Control Architecture](#17-Model Evaluation and Quality Access Control Architecture) 
18. [Cost Management and Token Measuring Structure](#18-Cost Management and -token-Measuring Structure) 
19. [Inter-Agent Delegation and Collaboration Architecture](#19-Inter-agent-Inter-Agent Delegation and Collaboration Architecture) 
20. [Long-term tasks and Workflow dormant architecture](#20-Long-term tasks and-workflow-dormant architecture)
 21. [Human-machine collaboration model architecture](#21-Human-machine collaboration model architecture) 
22. [SDK and developer experience architecture](#22-sdk-and developer experience architecture) 
23. [Compliance and Data Governance Structure](#23-Compliance and Data Governance Structure) 
24. [Configure governance structure](#24-Configure governance structure) 
25. [Data and state consistency architecture](#25-Data and state consistency architecture) 
26. [Storage Architecture](#26-Storage Architecture) 
27. [Performance Architecture and SLO](#27-Performance Architecture and-slo) 
28. [Event / Projection / Incident / DLQ Model](#28-event--projection--incident--dlq-model) 
29. [Knowledge / Memory / Artifact / Learning Boundary](#29-knowledge--memory--artifact--learning-boundary) 
30. [Business access constraints and Business Pack model](#30-Business access constraints and-business-pack-model) 
31. [Disaster Tolerance and High Availability Architecture](#31-Disaster Tolerance and High Availability Architecture) 
32. [Deployment Architecture](#32-Deployment Architecture) 
33. [Phase-by-stage landing route](#33-Phase-by-stage landing route) 
34. [ADR Freeze Recommendation](#34-adr-Freeze Recommendation) 
35. [Recommended code directory](#35-Recommended code directory) 
36. [Risk, Constraints and Success Criteria](#36-Risk Constraints and Success Criteria) 
37. [Business Domain Modeling and Access Architecture](#37-Business Domain Modeling and Access Architecture) 
38. [Business Domain Access Runbook](#38-Business Domain Access-runbook) 
39. [Natural language task entry structure](#39-Natural language task entry structure) 
40. [Goal decomposition engine architecture](#40-Goal decomposition engine architecture) 
41. [Active Agent Framework](#41-Active-agent-Framework) 
42. [Progressive Autonomy Model](#42-Progressive Autonomy Model) 
43. [Unified Operation Kanban Architecture](#43-Unified Operation Kanban Architecture) 
44. [Non-technical user experience architecture](#44-Non-technical user experience architecture) 
46. [Organizational Hierarchy Model](#46-Organizational Hierarchy Model)
47. [Organizational Structure Approval Routing](#47-Organizational Structure Approval Routing) 
48. [Enterprise SSO/SCIM Integrated Architecture](#48-enterprise-ssoscim-integrated architecture) 
49. [Sub-department compliance policy engine](#49-Sub-department compliance policy engine) 
50. [Knowledge Domain Isolation and Controlled Sharing](#50-Knowledge Domain Isolation and Controlled Sharing) 
51. [Grade Governance Entrustment](#51-Grade Governance Entrustment) 
52. [Multi-region deployment architecture](#52-multi-region-deployment architecture) 
53. [Management of large-scale resource competition](#53-Management of large-scale resource competition) 
54. [SLA Hierarchical Guarantee](#54-sla-Grade Guarantee) 
55. [Agent Market and Ecology](#55-agent-Market and Ecology) 
56. [Feedback-driven continuous improvement pipeline](#56-Feedback-driven continuous improvement pipeline) 
57. [External system integration framework](#57-External system integration framework) 
59. [Agent Interpretability and Decision Transparency Architecture](#59-agent-Explainability and Decision Transparency Architecture) 
60. [Emergency braking and global fuse architecture](#60-Emergency braking and global fuse architecture) 
61. [Agent unified life cycle management architecture] (#61-agent-unified life cycle management architecture) 
62. [Offline and edge deployment architecture](#62-Offline and edge deployment architecture) 
63. [Agent Behavior Drift Detection Architecture](#63-agent-Behavior Drift Detection Architecture) 
64. [Cost Attribution and Optimization Engine](#64-Cost Attribution and Optimization Engine) 
65. [Workflow visual debugger architecture](#65-Workflow visual debugger architecture) 
66. [Compliance report automatic generation engine](#66-Compliance report automatic generation engine) 
67. [Capacity Planning and Cost Forecasting Engine](#67-Capacity Planning and Cost Forecasting Engine) 
68. [Multimodal Capability Architecture](#68-Multimodal Capability Architecture) 
69. [Platform self-operation and maintenance Agent architecture] (#69-Platform self-operation and maintenance-agent-architecture) 
70. [Conclusion](#70-Conclusion) 
[Appendix A: Version Change History](#Appendix-aVersion Change History) 

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

# 12. Exception Event Processing Architecture

> Retain v1.2's E1-E6 classification and SEV1-4 grading. v2.0 adds **observability data model** and **automatic detection rules**.

## 12.1 Exception Event Classification

* **E1 Business Exception**: validation fail · wrong output · no result · low confidence
* **E2 Execution Exception**: timeout · worker crash · lease expired · retry exhausted
* **E3 External Dependency Exception**: adapter failure · provider timeout · rate limit · circuit open
* **E4 Security Exception**: unauthorized access · secret leak risk · egress deny · policy violation
* **E5 Data Exception**: stale projection · event append failure · invariant break · replay inconsistency
* **E6 Governance Exception**: rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 Exception Levels

* SEV4: Local minor, can be automatically recovered
* SEV3: Single workflow / single worker impact
* SEV2: Single business domain / single tenant significantly affected
* SEV1: Platform-level impact / security incident / production serious risk

## 12.3 Exception Detection Rules Engine

> New in v2.0: Upgrade exception detection from "hardcoded" to "rules engine".

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
**Example of built-in rules**:
| Rule | Condition | Severity | Action |
|------|------|------|------|
| worker_heartbeat_missing | heartbeat_gap > 30s | SEV3 | create_incident + lease_reclaim |
| execution_timeout_spike | timeout_rate > 20% in 5min | SEV3 | notify + mode_switch(supervised) |
| projection_lag_high | lag > 30s | SEV3 | notify + rebuild_trigger |
| security_policy_violation | any violation | SEV2 | create_incident + quarantine |
| platform_wide_failure | error_rate > 50% in 1min | SEV1 | create_incident + mode_switch(incident-mode) |
## 12.4 Observability data model 

> v1.2 only says "must have metrics". v2.0 defines specific indicators. 

### Core Metrics
| Indicator name | Type | Label | Description |
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
## 12.5 DLQ and Incident 

**DLQ must have**: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQs are not trash cans and must be operational. 

**Incident must be related**: affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution.

 ## 12.6 Alarm routing architecture 

> New in v2.1. Incidents must be routed to the correct person after they are generated.
| SEV Level | Notification Channels | Response SLA | Escalation Rules |
|---------|---------|---------|---------|
| SEV4 | Platform Console + Log | Next Business Day | None |
| SEV3 | IM notification (Slack/Feishu) | 4h | 4h No response → SEV2 |
| SEV2 | IM + Email + on-call | 1h | 1h no response → SEV1 |
| SEV1 | IM + phone + all-person broadcast | 15min | 15min no response → Management |

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

**External Integration**: Connect to PagerDuty / OpsGenie / Enterprise IM via Webhook. The platform does not implement built-in alarm channels, only defining routing rules and delivery interfaces.

## 12.7 Distributed Tracing Architecture

> v2.1 new. Defines trace → span → log → metric correlation model.

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

* All StructuredLog must contain trace_id + span_id (already exists)
* Metrics correlate to trace_id via exemplar (high-cardinality metric sampling)
* Incident correlates to trigger trace_id, supporting tracing from incident to complete call chain
* Sampling strategy: error trace 100% collection, normal trace by tenant config (default 10%)

---

# 13. OAPEFLIR Controlled Cognitive Kernel

> Retain v1.2's dual-chain model. v2.0 adds **TypeScript interface contracts for each stage** and **inter-stage data flow definitions**.

## 13.1 Dual-Chain Topology

**Main chain (synchronous)**: Observe → Assess → Plan → Execute → Feedback

**Secondary chain (asynchronous)**: Feedback → Learn → Improve → Release

## 13.2 Stage Interface Contracts

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

Execute phase is not implemented within OAPEFLIR, but delegated to P4 Execution Plane (see §14). OAPEFLIR only submits `ExecutionPlan` and receives `ExecutionReceipt`.

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

Release is not an automatic step but a release process governed by P2 Control Plane. ImprovementCandidate must go through validation → approval → canary → staged → stable's complete rollout process.

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

* OAPEFLIR is not equal to Runtime - it only makes decisions, not execution 
*Learn/Improve is not allowed to go online directly - it must go through P2's rollout management 
* Risk / policy / approval checks must be inserted before high-risk actions 
* The input and output of each stage must pass Zod schema runtime verification 

--- 

# 14. Runtime Execution Plane 

> Retain core responsibility definitions from v1.2. v2.0 adds **execution strategy mode** and **Executor registration mechanism**. 

## 14.1 Core Responsibilities 

session / task / workflow_run / execution life cycle · dispatch / queue / worker scheduling · lease / fencing · executor call · side effect controlled submission · retry / timeout / recovery · mode-aware execution · event emission 

## 14.2 Dispatcher Intelligent Scheduling 

Dispatcher is also a risk isolation point and dispatch decision matrix:
| Factor | Impact |
|------|------|
| worker capability | capability required to match step |
| worker health | exclude unhealthy workers |
| queue class | priority / standard / background |
| risk class | High-risk steps are assigned to the isolation pool |
| tenant quota | A single tenant does not exceed the quota |
| sandbox requirement | Match sandbox tier |

## 14.3 Execution Strategy Mode

> New in v2.0. Upgrade execution strategy from hardcoded to configurable mode.

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

Each Business Pack can declare its own ExecutionStrategy to override the default.

## 14.4 Executor Registration Mechanism

> New in v2.0. Upgrade executor from hardcoded to pluggable registration.

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

**Built-in Executor types**: ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect Two-Phase

1. Executor returns proposed side effect
2. Policy / approval decides whether to allow submission
3. Side effect repository records
4. Compensation when necessary

> Tool execution success does not equal side effects being formally effective.

## 14.6 HumanWait Is a Formal Executor

Approval waiting is not a bypass. HumanWait is responsible for: creates decision → blocks execution → waits resolution → resumes flow.

## 14.7 Recovery Worker Family

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

**v2.0 Improvement**: Each Recovery Worker must declare its own `RecoveryCadence` (check interval, max concurrent recovery count, timeout), and report results through `RecoveryReport`.

## 14.8 Runtime Mode Switching

**Standard mode set** (consistent with §9.5): full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

Where `full_auto` corresponds to the old name `normal`, and `supervised_auto` corresponds to the old names `degraded`/`supervised`. All runtime modes must use this standard enumeration.

Mode switching authority belongs to P2 Control Plane, issued through `ControlDirective(type: "mode_switch")`.

# 15. LLM Provider Abstraction and Failover Architecture

> v2.0 does not involve LLM layer architecture. v2.1 regards LLM as the most critical external dependency of the platform, defining provider abstraction, routing strategy, and degradation mode when unavailable.

## 15.1 Design Principles

* Platform does not bind to any single LLM provider
* All LLM calls are issued through unified ModelGateway, upper layer does not directly call provider SDK
* ModelGateway is part of X1 Fabric, crossing P3 Orchestration and P4 Execution
* LLM calls are treated as **high-risk external dependency**, must have timeout, circuit breaker, fallback, cost tracking

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
**Routing Policy**:
| Strategy | Applicable Scenarios | Description |
|------|---------|------|
| priority | Default | Sort by priority, highest priority preferred |
| cost_optimized | Batch/low priority tasks | Select the available provider with the lowest unit price |
| latency_optimized | Real-time interaction | Select the provider with the lowest P99 latency |
| data_residency | Compliance requirements | Select only providers that meet data residency |
| capability_match | special capabilities | match required_capabilities |

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
**Switching Rules**: 

* Single request timeout (default 30s) → automatically switch to the next provider and try again 
* Continuous failures > 5 times (60s window) → trigger circuit breaker, provider marked as unhealthy 
* All providers unhealthy → Enter LLM Degradation Mode 
* After the provider recovers, it automatically recovers through half-open detection. 

## 15.5 LLM not available in downgrade mode 

When all LLM providers are unavailable, the platform must have a clear downgrade strategy instead of simply reporting an error:
| Downgrade level | Trigger conditions | Platform behavior |
|---------|---------|---------|
| D0 normal | at least one provider healthy | normal routing |
| D1 restricted | primary down, secondary available | automatic switch + alarm + limit new workflow startup rate |
| D2 cache | All provider unhealthy, cache available | Return cached results for similar requests (read-only scenario only) |
| D3 static | Cache not available | Use pre-built static fallback plan (low risk tasks only) |
| D4 pause | All downgrades are unavailable | Pause all new workflows, protect workflow checkpoints in transit, and transfer to manual |
**Cache Design**: 

* Semantic caching based on prompt_ref + parameter hash 
* TTL is classified according to data_classification: public=1h, internal=15min, confidential=no cache 
* Cache hits must be marked with `cached: true` and are not counted in model quality evaluation 

## 15.6 Streaming response and error handling 

Additional constraints for `ModelGateway.stream()`:
| Points of concern | Treatment strategies |
|--------|---------|
| Stream interruption | The received token is cached as partial response; if partial is available (≥ 80% expected length), mark `partial: true` for use; otherwise switch provider and try again |
| Token over-limit pre-check | Estimate the number of input tokens based on `ModelRequest.messages` before sending. If > provider's `context_window - max_tokens`, reject and return `TOKEN_LIMIT_EXCEEDED` |
| Response format verification | Zod schema verification is performed on the complete output after the stream is completed; a verification failure triggers a retry (with a format reminder); the second failure is recorded as `llm.response.validation_failed` |
| Timeout | The first streaming token timeout (TTFT > 10s) triggers provider switching; the total duration timeout is executed according to `ModelConstraints.max_latency_ms` |
| Backpressure | When consumer processing speed < production speed, stream reading (backpressure) is paused and token is not discarded |
## 15.7 Observability
| Indicator | Type | Description |
|------|------|------|
| `llm.request.total` | counter | by provider/model/tenant |
| `llm.request.latency_ms` | histogram | by provider/model |
| `llm.request.error_rate` | gauge | by provider/error_type |
| `llm.token.usage` | counter | by provider/model/tenant |
| `llm.cost.total` | counter | by provider/tenant |
| `llm.cache.hit_rate` | gauge | cache hit rate |
| `llm.fallback.triggered` | counter | Number of fallback triggers |

---

# 16. Prompt Management and Versioning Architecture

> Prompt is the "source code" of Agent. v2.1 regards Prompt as a first-level architectural concern, defining storage, versioning, grayscale release, and rollback mechanisms.

## 16.1 Design Principles

* Prompt is not inlined in code but managed independently as a **versioned resource**
* Each Prompt has a complete life cycle: draft → review → staging → canary → stable → deprecated
* Prompt changes are equivalent to code changes and must pass quality gates (see §17)
* The combination of Prompt and model constitutes the core of Agent behavior, and both changes need to be managed collaboratively

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

## 16.3 Release and Grayscale

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

**Release process**:

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (Quality not met)
                                               rolled_back
```

* staging phase must pass eval gate (see §17)
* canary phase runs in parallel with stable version, split by percentage
* During canary, continuously compare quality metrics of old and new versions
* At any time, you can manually or automatically rollback to the previous stable version

## 16.4 Prompt Bundle Management

An OAPEFLIR cycle involves Prompts of multiple stages, and they must be managed as an **atomic bundle**:

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

**Constraint**: All stages within the same workflow run use the same PromptBundle version, no switching mid-way.

## 16.5 Prompt Security and Injection Defense

### 16.5.1 Prompt Injection Defense Architecture

```text
User input / External data
    │
    ▼
┌──────────────────┐
│ Input Sanitizer  │  Regex + blacklist + Unicode normalization
├──────────────────┤
│ Injection        │  Classifier-based injection pattern detection
│ Detector (ML)    │  (system/user boundary confusion, instruction override, role playing)
├──────────────────┤
│ Prompt Assembler │  Strict separation of system/user/assistant segments
│                  │  User content only injected into user segment, never into system segment
├──────────────────┤
│ Output Validator │  Detect exfiltration attempts in LLM output
│                  │  (URL injection, Markdown link leakage, covert instruction return)
└──────────────────┘
```
### 16.5.2 Defense Strategy
| Hierarchy | Strategy | Description |
|------|------|------|
| Input layer | Variable Escaping | All user input variables are escaped in XML/Markdown before injection and control characters are eliminated |
| Input layer | Boundary Markers | The system and user segments are separated by the LLM provider's native role and do not rely on text markers |
| Detection Layer | Injection Classifier | Lightweight classification model scores injection probability for each user input, > 0.7 rejection |
| Detection layer | Canary Token | Embed the canary token in the system prompt. If the LLM output contains the token, it is determined to be injection |
| Output layer | Output Sanitizer | LLM output undergoes URL/link filtering, PII detection, command pattern detection |
| Audit layer | Full Prompt Logging | The complete prompt of each rendering is saved as artifact (optional to turn off above confidential level) |
### 16.5.3 Basic principles 

* Prompt content is not exposed to end users (to prevent information leakage) 
* Prompt variables must be sanitized before injection 
* Variables containing secret/PII are redactioned in the artifact 
* Historical assistant messages in multi-round conversations cannot be tampered with by the user 
* Return values from external tools are considered untrusted input and are also sanitized before injection. 

--- 

# 17. Model evaluation and quality access control architecture 

> An Agent platform without evaluation capabilities is equivalent to "streaking online". v2.1 Defines a quality gating framework for model/prompt changes. 

## 17.1 Evaluation levels
| Level | Trigger timing | Assessment content | Blocking ability |
|------|---------|---------|---------|
| Offline evaluation | Prompt/Model change submission | Standard eval dataset regression testing | Block release |
| Grayscale evaluation | canary period | real-time quality comparison of old and new versions | automatic rollback |
| Online monitoring | Continuous operation | Quality index drift detection | Trigger alarm/downgrade |

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
**Built-in access control rules**:
| Rules | Conditions | Description |
|------|------|------|
| regression_pass_rate | >= 95% | eval dataset pass rate is not lower than baseline |
| critical_case_pass | == 100% | All cases marked critical must pass |
| latency_regression | <= 120% of baseline | Latency does not exceed 120% of baseline |
| cost_regression | <= 150% of baseline | Cost does not exceed 150% of baseline |
| quality_score_delta | >= -0.05 | Quality score is no less than 5 percentage points below baseline |

## 17.4 Online Quality Monitoring

```typescript
interface QualitySignal {
  signal_type: "output_parseable" | "output_relevant" | "output_safe" | "user_feedback" | "downstream_success";
  value: number;
  timestamp: string;
}
```

**Drift Detection**:

* Sliding window (1h/24h) statistics quality distribution
* When 24h window quality average drops > 10%, trigger SEV3 alarm
* When 1h window quality average drops > 20%, trigger automatic downgrade to supervised mode
* All quality signals are written to P5 Evidence Plane to support pattern extraction in the Learn stage

## 17.5 LLM-as-Judge

For quality scenarios that cannot be judged by rules (such as "whether the answer is reasonable"), use LLM-as-Judge:

* Judge LLM and the evaluated LLM must come from different providers (to avoid bias)
* Judge results are cached (same input+output not re-evaluated)
* Judge calls themselves have cost budget limits (see §18)
* Judge evaluation results are included in quality gates but have lower weight than deterministic rules

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
**Metering point**: ModelGateway writes UsageRecord synchronously after each LLM call is completed as the only data source for billing. 

## 18.2 Budget Hierarchy
| Hierarchy | Budget subject | Control granularity | Over-budget behavior |
|------|---------|---------|-----------|
| Platform level | Entire platform | Monthly total | SEV1 alerts + new workflow pauses |
| Tenant level | Single tenant | Monthly quota | Alarms + queuing slowdown of this tenant workflow |
| Pack level | Single Business Pack | Single workflow limit | This workflow is downgraded to supervised |
| Step level | Single step | Single step token/cost upper limit | step abort + replan |

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
  → ModelGateway budget check
    → Query current period usage
    → Estimate this call cost (based on prompt_tokens + estimated completion)
    → If used + estimated > limit × warning_threshold → Send alarm
    → If used + estimated > limit → Reject request / degradation strategy
  → Execute LLM call
  → Update usage
```
## 18.4 Chargeback Report 

* Aggregated by tenant / pack / model / provider dimensions 
* Daily + monthly reports automatically generated 
* Support export to CSV/JSON 
* Integrated with Admin API: `/api/v1/admin/cost-reports` 

## 18.5 Cost Optimization Strategy
| Strategy | Description | Applicable Scenarios |
|------|------|---------|
| Prompt cache | Semantically similar request reuse (see §15.5) | read-only / low change scenarios |
| Token budget clipping | Automatic compression of memory/knowledge input when context is too long | Large context tasks |
| Model downgrade | Automatically select low-cost model for low-risk tasks | background queue |
| Batch merge | Merge multiple similar steps into one LLM call | Batch analysis scenario |

---

# 19. Inter-Agent Delegation and Collaboration Architecture

> Complex enterprise tasks require multiple Agent collaboration. v2.1 defines inter-Agent delegation protocol, context transfer, and authorization model.

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

* **Depth limit**: Maximum delegation chain depth = 3 (prevent infinite recursion)
* **Loop detection**: The same pack_id cannot appear twice in the same delegation chain
* **Isolation**: Child workflow has independent lease, independent checkpoint, does not share state with parent workflow
* **Budget inheritance**: Child workflow budget is deducted from parent workflow's remaining budget
* **Permission contraction**: Child workflow permissions ≤ parent workflow permissions (principle of least privilege)

## 19.3 Context Transfer Security

* Parent → Child: Only pass references declared in DelegationContext, not raw data
* Child → Parent: Only return through DelegationResult, containing summary + artifact_refs
* Cross-tenant delegation: prohibited by default, requires P2 explicit authorization
* Data classification upward compatibility: child workflow output data classification ≥ input data classification

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
## 19.4 Collaboration mode
| Mode | Description | Applicable Scenarios |
|------|------|---------|
| Serial delegation | A delegates to B and continues after B completes | Simple subtask |
| Parallel fan-out | A simultaneously delegates B1/B2/B3, aggregated results | Parallel analysis |
| Pipeline | A → B → C, chain transfer | Multi-stage processing |
| Negotiation | Alternate execution of A and B, shared context | Code review + fix |
--- 

# 20. Long-term tasks and Workflow dormant architecture 

> In enterprise scenarios, workflow may last for hours or even days (waiting for approval and callbacks from external systems). v2.1 defines sleep/wake mechanism. 

## 20.1 Classification of long-term tasks
| Type | Duration | Reason | Example |
|------|---------|------|------|
| Approval waiting | Minutes → Days | HumanWait executor blocking | High-risk operation approval |
| External callback | Minute → hour | Wait for the third-party system to complete | CI/CD build completion callback |
| Schedule scheduling | Determine time | Wait for a specific time window | Execute during non-working hours |
| Multi-stage | Day → Week | Multi-stage approval of business process | Release approval chain |

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

1. step enters waiting state → create complete checkpoint
2. release worker lease (worker no longer occupied)
3. create HibernationRecord, register wake_conditions
4. set workflow_run status to `hibernated`
5. persist all memory context to P5

**Wake-up Flow**:

1. wake_condition satisfied → WakeEngine triggers
2. restore workflow context from checkpoint
3. reapply for worker lease
4. continue execution from breakpoint

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
* The timer is persisted to the database and does not rely on process memory 
* TimerPoller (similar to outbox poller) periodically scans expiration timers 
* The timer is not lost after the process is restarted 
* timer accuracy: ± 30s (non-real-time system, does not pursue millisecond level) 

## 20.4 TTL and timeout protection 

* Each hibernation must have a TTL (default 7 days, maximum 30 days) 
* Execute timeout_action after TTL expires 
* Super long workflow sends `workflow.still_hibernated` health event every 24h 
* hibernation exceeding 50% of TTL triggers reminder notification 

## 20.5 Cross-deployment security 

* checkpoint format is backward compatible (versioned schema) 
* When the platform is upgraded and deployed, hibernated workflow will not be affected 
* If the checkpoint schema is incompatible, the workflow enters the `recovery_needed` state and is processed by Recovery Worker 

--- 

# 21. Human-machine collaboration model architecture 

> v2.0 only has HumanWait executor and basic approval gate. v2.1 defines the complete HITL mode directory. 

## 21.1 HITL mode directory
| Mode | Description | Trigger Conditions | Timeout Behavior |
|------|------|---------|---------|
| Single person approval | One approver decision | risk_level ≥ high | Timeout → Upgrade |
| Multi-party approval | Multiple people independent approval, voting decisions | critical operations / cross-domain impact | timeout → automatic rejection |
| Delegate approval | The approver can be transferred to others | The original approver is not online | TTL reset after delegation |
| Iteration feedback | People give modification opinions, Agent redo | The output is not satisfactory | Terminate after the maximum number of iterations |
| Collaborative editing | People and Agents alternately modify the same artifact | Code/document collaboration | No timeout, manual end |
| Informed confirmation | Notification only, no approval required | Low risk side effect | Automatically passed |
| Circuit break manual | Switch to manual decision-making when LLM is unavailable | D4 degraded mode (see §15.5) | Manual timeout → abort |

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
**Process**: Agent output → Human review → Give guidance → Agent replan + redo → Loop until approve or max_iterations is reached. 

## 21.4 Notifications and Channels
| Channel | Purpose | Integration method |
|------|------|---------|
| Platform console | Default approval interface | Built-in |
| Webhooks | External system integration | Outbound HTTP |
| Email | Asynchronous notification | SMTP adapter |
| IM (Slack/Feishu/Qiwei) | Instant notification + quick approval | Webhook + callback API |
--- 

# 22. SDK and developer experience architecture 

> A platform without SDK cannot be adopted by business teams. v2.1 defines the Pack development toolchain and local development experience. 

## 22.1 SDK layering
| SDK Layer | Role Oriented | Features |
|--------|---------|------|
| Pack SDK | Business Developer | Create/Test/Publish Business Pack |
| Plugin SDK | Plug-in developer | Development tool / adapter / retriever / evaluator |
| Client SDK | External integrator | Calling platform Public API |
| Admin SDK | Operation and maintenance team | Call Admin API, scripted operation and maintenance |

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
## 22.3 Local development environment 

* `agent-platform dev` — launch the local platform (SQLite + in-process workers) 
* `agent-platform pack create` — Create Pack scaffolding 
* `agent-platform pack test` — run Pack test (mock LLM + mock tools) 
* `agent-platform pack validate` — Verify Manifest compliance 
* `agent-platform pack publish --target staging` — publish to staging environment 

**Local emulator**: 

* Built-in MockModelGateway: returns preconfigured LLM responses for deterministic testing 
* Built-in MockToolExecutor: simulate tool execution results 
* Test recording/playback: record real LLM calls as fixtures and playback subsequent tests (no token consumption) 

## 22.4 Plugin life cycle
| Phase | Description | Requirements |
|------|------|------|
| Development | Local development + Plugin SDK | Must declare PluginManifest |
| Test | Unit test + sandbox integration test | Coverage ≥ 80% |
| Certification | Security Scan + Competency Review | Pass Plugin Security Checklist |
| Publish | Register to Plugin Registry | Version semantics (semver) |
| Run | Execute subject to sandbox constraints | Resource limits + capability whitelist |
| Deprecated | Mark deprecated + Migration Guidelines | Maintenance for at least 3 months |

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
## 22.5 Documentation and Examples 

* Each SDK must have an API reference (automatically generated from TypeScript types) 
* Provide 3 standard example Packs: simple-qa / coding-fix / operations-resolve 
* Provide Playground environment: online trial Pack development (optional, Phase 4) 

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

# 25. Data and state consistency architecture 

## 25.1 Consistency Principle 

We do not pursue global strong consistency, but pursue: truth state transaction consistency · event append same transaction · projection final consistency · replay rebuildable · side effect auditable. 

## 25.2 Truth Table + Event Log dual model 

* The truth table saves the current state (read optimization) 
* Event log saves historical changes (audit/playback optimization) 
* Both are updated in the same transaction, ensuring consistency 

## 25.3 CAS + Lease + Fencing 

All critical updates must be based on: expected status CAS · active lease · fencing token. This is a hard constraint on execution layer consistency. 

## 25.4 Projection must be rebuildable 

All projections must be: idempotent · replay-safe · event_id deduplication · support rebuild · not reflect the truth. 

## 25.5 State & Evidence Layering
| Layers | Content | Purpose |
|----|------|------|
| Truth | Current control truth | Status judgment, concurrency control, scheduling promotion |
| Event | Historical change track | Timeline reconstruction, playback, fault explanation |
| Projection | Query model | Console, report, approval queue |
| Audit | Audit records | Who did what to what |
| Artifact | Large object content | observation/plan/log/evidence/screenshot |
| Checkpoint | Execute recovery point | Breakpoint recovery, repair, replay starting point |

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

> v1.2 directly gave 18 microservices. v2.0 adopts **monolith-first, gradual splitting** strategy.

## 32.1 Deployment Evolution

### Phase D1: Modular Monolith

```text
┌─────────────────────────────────────────┐
│            Agent Platform (single process)        │
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

Applicable: Development, testing, small-scale production (≤10 concurrency).

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

Applicable: Medium-scale production (≤50 concurrency), worker can scale horizontally.

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
Applicable to: large-scale production (≤500 concurrency), each plane can be expanded independently. 

## 32.2 Environment Division 

dev · test · staging · prod 

## 32.3 Resource Pool 

read-only worker pool · write-enabled worker pool · high-risk isolated pool · browser worker pool · plugin isolated pool 

--- 

# 33. Phased implementation route 

> v1.2 only has "do first/do later". v2.0 adds **acceptance gate**, **dependencies** and **specific deliverables**. 

## Phase 1: Steady State Skeleton (8 weeks) 

### Deliverables 

* truth tables + event log + UoW (Group 1 table) 
*lease/fencing/CAS 
* idempotency 
* artifact ref 
* policy outcome + decision model (Group 2 table) 
* Minimal operation and maintenance CLI (doctor/inspect) 
* Unit test ≥ 80% coverage 

### Acceptance door 

* [ ] workflow_run can be created and promoted stably (no downgrade) 
* [ ] Automatically reclaim after lease timeout 
* [ ] CAS conflicts are correctly rejected 
* [ ] Event append and truth table in the same transaction 

### Dependencies 

No external dependencies. SQLite + Node.js to start. 

## Phase 2: Controlled Automation (8 weeks) 

### Deliverables 

* OAPEFLIR main chain O→A→P→E→F 
* risk assessment engine 
* approval gates (basic) 
* side effect tracking 
* recovery workers (LeaseReclaimer + StuckRunSweeper) 
* 2 Business Packs: coding.fix_bug + operations.resolve_incident
### Acceptance door 

* [ ] Main chain end-to-end running (task creation → execution → completion) 
* [ ] High-risk step triggers approval blocking 
* [ ] Resume execution within 30s after worker crashes 
* [ ] side effect can be queried and audited 

### Dependencies 

Phase 1 was all accepted. 

## Phase 3: Enterprise Reliability (12 weeks) 

### Deliverables 

* OAPEFLIR secondary chain F→L→I→R 
* circuit breaker + degradation mode switching 
* backpressure (4 modes) 
* incident management + DLQ operations 
* projection rebuild 
*replay/repair 
* Configuration management (versioning + grayscale) 
* Enhanced multi-tenant isolation 
* PostgreSQL migration (optional) 

### Acceptance door 

* [ ] Automatically downgrade after external dependency circuit breaker, and automatically rebound after recovery. 
* [ ] DLQ can be queried, retried and closed 
* [ ] Incident closed-loop disposal chain opened up 
* [ ] Data is consistent after Projection rebuild 
* [ ] Configuration changes can be rolled back 

### Dependencies 

All Phase 2 acceptances passed. 

## Phase 4: Scaling (ongoing) 

### Deliverables 

* Worker separated deployment (Phase D2) 
* More Business Pack 
* Browser execution deepening 
* Plug-in ecology 
* SLO automated monitoring 
* Compliance export 
* Disaster recovery drill
### Acceptance door 

* [ ] 50 concurrent workflow for stable operation 
* [ ] Multi-tenant isolation verification passed 
* [ ] Load test complies with §27 SLO 
* [ ] Disaster recovery drill RTO < 10min 

## Phase 5: Intelligent Interaction and Organizational Governance (12 weeks) 

> Corresponds to v2.3-v2.4 architecture layer. 

### Deliverables 

* Natural language task entrance (§39) + Goal decomposition engine (§40) 
* Active Agent Framework (§41) + Progressive Autonomy Model (§42) 
* Unified operation dashboard (§43) + non-technical user experience (§44) 
* Organizational Hierarchy Model (§46) + Approval Routing (§47) + SSO/SCIM (§48) 
* Compliance policy engine (§49) + Knowledge domain isolation (§50) + Governance delegation (§51) 

### Acceptance door 

* [ ] Non-technical users can create and manage tasks through natural language 
* [ ] The goal decomposition engine automatically decomposes business goals into executable task graphs 
* [ ] Progressive autonomy L0→L3 upgrade path end-to-end verification 
* [ ] The three-level organizational structure correctly drives approval routing 
* [ ] SSO/SCIM automatically synchronizes users and deactivates accounts < 5min to take effect 
* [ ] Zero leakage of knowledge domain isolation, complete controlled sharing audit 

### Dependencies 

All Phase 4 acceptances passed. 

## Phase 6: Scaling and Ecology (12 weeks) 

> Corresponds to v2.5 architecture layer. 

### Deliverables 

* Multi-Region deployment (§52) + Resource competition management (§53) + SLA classification (§54) 
* Agent Market (§55) + Feedback Improvement Pipeline (§56) + External Integration Framework (§57) 

### Acceptance door 

* [ ] Dual Region Active-Active deployment, single Region failure RTO < 5min 
* [ ] High-priority tasks are not starved under 1000 concurrent workflows 
* [ ] SLA Tier P0 tasks 99.9% completed within promised time
 * [ ] At least 20 certified Packs listed on Marketplace 
* [ ] User feedback → Improvement closed loop < 7 days 

### Dependencies

Phase 5 all acceptance passed.

## Phase 7: Operational Maturity (Continuous)

> Corresponds to v2.6 architecture layer.

### Deliverables

* Explainability (§59) + Emergency braking (§60) + Lifecycle management (§61)
* Offline/edge deployment (§62) + Behavior drift detection (§63) + Cost optimization (§64)
* Visual debugger (§65) + Compliance report (§66) + Capacity planning (§67)
* Multi-modal capabilities (§68) + Platform self-operation and maintenance Agent (§69)

### Acceptance Gate

* [ ] Users can query explanation for any step, L1 delay < 2s
* [ ] Emergency braking drill: full platform stop < 5s, recovery < 30min
* [ ] EdgeRuntime data sync zero loss after 24h network disconnection recovery
* [ ] 100% trigger alarm when behavior drift > 2σ
* [ ] Compliance report SOC2 Type II control point coverage ≥ 95%
* [ ] PlatformOps Agent L1 maturity verification passed

### Dependencies

Phase 6 all acceptance passed.

## 33.1 Phase Dependency Diagram

```text
Phase 1 (Steady State Skeleton)
    │
    ▼
Phase 2 (Controlled Automation)
    │
    ▼
Phase 3 (Enterprise Reliability)
    │
    ▼
Phase 4 (Scaling)
    │
    ▼
Phase 5 (Intelligent Interaction and Organizational Governance)
    │
    ▼
Phase 6 (Scaling and Ecology)
    │
    ▼
Phase 7 (Operational Maturity)
```
Each Phase cannot be skipped and must be accepted in order. 

--- 

# 34. ADR Freeze Recommendation 

The 19 ADRs from v1.2 are recommended to be retained. v2.0 adds 4 new ones, v2.1 adds 9 new ones, v2.2 adds 4 new ones, v2.3 adds 6 new ones, v2.4 adds 6 new ones, v2.5 adds 6 new ones, and v2.6 adds 11 new ones: 

**v1.2 original (19)**: 
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries 

**v2.0 new (4)**: 
* **ADR-Plane-Communication-Contracts** — Communication between the five planes must be through formal contract objects 
* **ADR-Repository-Abstraction-Layer** — All storage access is through the Repository interface 
* **ADR-Single-Process-First** — Deployment starts from a single entity, then splits after verification 
* **ADR-API-Versioning-Strategy** — API versioning and backward compatibility strategy 

**v2.1 new (9 items)**: 
* **ADR-ModelGateway-As-Single-LLM-Entry** — All LLM calls must go through the ModelGateway, direct calls to the provider SDK are prohibited 
* **ADR-Prompt-As-Versioned-Resource** — Prompt is not inlined in the code and is managed independently as a versioned resource 
* **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model changes must pass the quality gate 
* **ADR-Per-Tenant-Cost-Metering** — All LLM costs must be metered per tenant 
* **ADR-Delegation-Depth-Limit** — Maximum inter-Agent delegation depth = 3 
* **ADR-Workflow-Hibernation-Model** — Long-waiting workflows must release workers and persist state 
* **ADR-Crypto-Shredding-For-Erasure** — GDPR erasure via crypto-shredding 
* **ADR-Pack-Semver-Compatibility** — Pack Manifest API adheres to the semver compatibility contract 
* **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM latency is monitored independently and does not count towards the platform's own SLO 

**v2.2 new (4)**: 
* **ADR-Domain-Descriptor-As-Semantic-Layer** — Each Business Pack must be associated with a DomainDescriptor, domain semantics are not embedded in the Pack code 
* **ADR-Domain-Risk-Override-Over-Platform-Default** — Domain risk profile override takes precedence over the platform default risk matrix, and the override requires audit reasons 
* **ADR-Domain-Recipe-As-Onboarding-Accelerator** — New business domains must start from one of four prototype templates, blank access is prohibited 
* **ADR-Four-Phase-Domain-Onboarding** — Business domain access must pass four-stage access control (Modeling→Development→Authentication→Grayscale), and skipping is not allowed 

**v2.3 new (6)**: 
* **ADR-NL-Intent-Must-Resolve-To-RequestEnvelope** — Natural language input must be parsed by Intent to generate a structured RequestEnvelope (§5.3). It is prohibited to pass the original text directly to the Agent. 
* **ADR-Goal-Decomposition-Max-Depth** — The upper limit of the recursion depth of the target decomposition engine = 5. If it exceeds the limit, manual confirmation of the decomposition plan is required. 
* **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — Proactive Agent must be bound to TriggerPolicy and unconditional polling is prohibited 
* **ADR-Autonomy-Level-Guarded-Progression** — The progressive autonomy level increases monotonically by default (promotion requires meeting the points threshold + approval); downgrade only occurs under the safety trigger conditions defined in §42.2 (P0 Incident/continuous failure/cost overrun). After the downgrade is executed, manual approval must be confirmed and the reason is recorded. The recovery path follows the promotion rules 
* **ADR-Dashboard-Metric-Source-Of-Truth** — Unified operation dashboard data must come from State & Evidence Plane, and direct reading of Runtime internal state is prohibited 
* **ADR-No-Code-UX-Maps-To-Standard-API** — Non-technical UI operations must be mapped to the Standard Public API, bypassing is prohibited 

**v2.4 new (6 items)**: 
* **ADR-Org-Hierarchy-As-First-Class-Model** — Organizational hierarchy (Enterprise→Business Group→Department→Team) as a first-class model, all resource ownership must be associated with OrgNode 
* **ADR-Approval-Route-From-Org-Chart** — Approval routes must be dynamically derived from the organizational structure, and hard-coded approver lists are prohibited. 
* **ADR-SSO-As-Single-Identity-Source** — Enterprise SSO is the only source of identity and the platform does not maintain independent user passwords 
* **ADR-Compliance-Policy-Inherits-Down** — Compliance policies are inherited downward along the organization tree, and child nodes can only tighten but not relax 
* **ADR-Knowledge-Boundary-Default-Deny** — The knowledge domain is isolated by default. Cross-department sharing requires explicit authorization and audit log recording. 
* **ADR-Governance-Delegation-Requires-Scope** — Governance delegation must be limited to scope (resource type + OrgNode scope), global delegation is prohibited

**v2.5 new (6 items)**:
* **ADR-Multi-Region-Active-Active-With-Home-Region** — Multi-Region uses Active-Active architecture, each tenant has a Home Region, cross-Region data is asynchronously replicated
* **ADR-Resource-Contention-Fair-Queue** — Large-scale deployment must use weighted fair queue, simple FIFO causing high-priority task starvation is prohibited
* **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA tier determines resource quota, queue priority, and fault recovery order
* **ADR-Marketplace-Pack-Must-Pass-Certification** — Pack listed on Agent Marketplace must pass platform certification (security scan + sandbox test + performance baseline)
* **ADR-Feedback-Loop-Closed-Within-SLA** — User feedback must be closed within SLA-defined time window (collection → analysis → improvement → verification)
* **ADR-Integration-Through-Unified-Connector** — External system integration must use unified Connector framework, business code is prohibited from directly calling external API

**v2.6 new (11 items)**:
* **ADR-Every-Decision-Must-Have-Rationale** — OAPEFLIR each stage must generate StageRationale, decision explanation rendered on-demand
* **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective must atomically stop the entire platform within 5 seconds, recovery requires dual-person approval
* **ADR-Agent-As-Composite-Entity** — Agent as a composite entity of Pack+Prompt+Model+Trust+Trigger, with AgentVersion as the release and rollback unit
* **ADR-Edge-Runtime-Risk-Ceiling** — Offline EdgeRuntime only allows executing risk_level ≤ medium actions, high-risk actions wait for connection recovery
* **ADR-Behavior-Fingerprint-Mandatory** — Each Agent must maintain BehaviorFingerprint, drift detection covers 1h/7d/30d/90d four windows
* **ADR-Cost-Attribution-Per-Decision** — Cost attribution must be accurate to decision level (single LLM call), optimization suggestions must include quality_risk evaluation
* **ADR-Workflow-Debug-Session-Isolated** — Debug session runs in isolated sandbox, breakpoint pause does not affect other workflows
* **ADR-Compliance-Report-Template-Versioned** — Compliance report templates must be versioned, template version is locked when report is generated
* **ADR-Capacity-Forecast-Drives-Scaling** — Capacity forecast results must be linked to scaling recommendations, scaling recommendations must include cost impact estimation
* **ADR-Multimodal-Safety-Check-Before-Output** — Multi-modal output (image/audio) must pass content security check before being delivered to user
* **ADR-PlatformOps-Agent-Read-Only-Default** — Platform self-operation Agent defaults to read-only, production write operations require human approval

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
    recipes/              # DomainRecipe archetype template
    interaction-policy/   # DomainInteractionPolicy cross-domain policy
    governance/           # DomainGovernancePolicy domain governance
    coding/               # Coding domain instance
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
    autonomy/             # Gradual autonomy
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

  org-governance/         # Organization governance layer (v2.4)
    org-model/            # Organization hierarchy model
      hierarchy/
      org-node/
      sync/
    approval-routing/     # Organization structure approval routing
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

  scale-ecosystem/        # Scale operation layer + ecosystem layer (v2.5)
    multi-region/         # Multi-Region deployment
      region-router/
      data-replicator/
      failover-controller/
    resource-manager/     # Resource competition management
      fair-queue/
      quota-enforcer/
      preemption/
    sla-engine/           # SLA tier guarantee
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

  ops-maturity/           # Operations maturity layer (v2.6)
    explainability/       # Agent explainability
      evidence-collector/
      causal-chain-builder/
      explanation-renderer/
      explanation-cache/
    emergency/            # Emergency braking
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
    multimodal/           # Multi-modal capabilities
      image-processor/
      speech-processor/
      document-parser/
      modality-router/
    platform-ops-agent/   # Platform self-operation Agent
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

  sdk/                  # SDK（v2.1）
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

# 36. Risks, Constraints and Success Criteria 

## 36.1 Main risks 

* Model output is unstable 
* Side effects of tools are uncontrollable 
* Insufficient recovery links lead to unsustainable automation 
* projection deviation is mistaken for truth 
* Mislearning leads to behavioral drift 
* Multi-tenant isolation is not complete 
* The Pack model does not converge, causing the platform to be invaded by business anti-intrusion 
* Budget out of control 
* replay/rebuild error operation amplification problem 
* **(v2.1) LLM provider is completely unavailable, causing platform paralysis** 
* **(v2.1) Prompt changes introduce behavioral regression** 
* **(v2.1) LLM cost out of control (token overspending)** 
* **(v2.1) Agent delegation chain recursion is out of control** 
* **(v2.3) NL Intent parsing ambiguity leads to incorrect task creation** 
* **(v2.3) Target decomposition recursion is too deep, causing task explosion** 
* **(v2.3) Active Agent triggers infinitely to form a storm** 
* **(v2.3) Progressive autonomy error upgrade leads to high-risk actions out of control** 
* **(v2.4) Delay in synchronization of organizational structure changes leads to approval routing errors** 
* **(v2.4) Knowledge isolation configuration error leads to cross-department data leakage** 
* **(v2.4) Excessive scope of governance rights delegation leads to security degradation** 
* **(v2.5) Cross-Region data replication delay causes consistency issues** 
* **(v2.5) Resource competition management failure leads to starvation of high-priority tasks** 
* **(v2.5) Marketplace malicious Pack causes security incidents after passing certification** 
* **(v2.6) Interpretation pipeline LLM call cost out of control (frequent forensic-level interpretation)** 
* **(v2.6) Emergency brake accidentally triggered, causing the entire platform to shut down for no reason** 
* **(v2.6) Insufficient grayscale test coverage of the Agent composite version leads to the escape of combined defects** 
* **(v2.6) EdgeRuntime accumulates a large number of side effects in the offline state, and conflicts explode when the connection is restored** 
* ** (v2.6) False positives in behavioral drift detection lead to frequent Agent degradation, affecting business** 
* **(v2.6) Missing judgments in multi-modal content security checks lead to the output of illegal content** 

## 36.2 Hard constraints 

* Runtime only consumes published state definitions 
* Projection does not reflect the truth 
* Learn does not directly drive online changes 
* Secret does not enter Memory / Knowledge / External Artifact 
* All outbound calls go through egress control 
* All side effects must be recorded as objects 
* High-risk actions must be approved or explicitly denied 
* CAS + Lease + Fencing to write back hard constraints 
* Inter-plane communication must pass formal contract objects 
* **(v2.1) All LLM calls must go through ModelGateway** 
* **(v2.1) Prompt changes must pass quality gate**
* **(v2.1) LLM costs must be metered per tenant** 
* **(v2.1) Agent delegation depth ≤ 3** 
* **(v2.1) PII data deletion via crypto-shredding** 
* **(v2.3) NL input must be parsed by Intent to generate RequestEnvelope(§5.3), direct transmission of original text is prohibited** 
* **(v2.3) Target decomposition recursion depth ≤ 5** 
* **(v2.3) Active Agent must be bound to TriggerPolicy** 
* **(v2.3) The autonomy level increases monotonically by default; downgrade is limited to §42.2 security trigger conditions and requires manual approval and confirmation after execution** 
* **(v2.4) All resource ownership must be associated with OrgNode** 
* **(v2.4) Compliance policies are inherited downward along the organization tree, and child nodes can only be tightened** 
* **(v2.4) Knowledge domain is isolated by default, cross-department sharing requires explicit authorization** 
* **(v2.4) SSO as the only source of identity** 
* **(v2.5) Each tenant must specify Home Region** 
* **(v2.5) Marketplace Pack must pass certification before it can be put on the shelves** 
* **(v2.5) External system integration must be through the Unified Connector Framework** 
* **(v2.6) OAPEFLIR Each stage must generate StageRationale** 
* **(v2.6) PlatformPanicDirective same as Region < 5s, cross-Region < 15s, stops all platforms** 
* **(v2.6) Agent releases and rollbacks are in AgentVersion (composite snapshot)** 
* **(v2.6) EdgeRuntime offline mode risk_level ≤ medium** 
* **(v2.6) Each Agent must maintain BehaviorFingerprint** 
* **(v2.6) Multimodal output must pass content security checks** 
* **(v2.6) PlatformOps Agent is read-only by default, and production write operations require manual approval** 

## 36.3 Success Criteria 

### Phase 1 Success Criteria 

* workflow_run can be stably created and promoted 
* Automatic reclaim when lease times out 
* CAS conflicts are correctly rejected 

### Phase 2 Success Criteria 

* OAPEFLIR main chain runs end-to-end 
*Recover within 30s after worker crash 
* High-risk actions can be blocked by approval 

### Phase 3 Success Criteria 

* incident / replay / repair / DLQ operational 
* External dependency circuit breaker→downgrade→restore automation 
* projection can be reconstructed and data is consistent 

### Phase 4 Success Criteria 

* 50 concurrent workflows run stably 
* Load test meets SLO 
* Disaster recovery drill RTO < 10min 

### Phase 5 Success Criteria (v2.3-v2.4)
* Non-technical users can create and manage tasks through natural language 
* Goal decomposition engine automatically breaks down business goals into executable task graphs 
* Active Agent is automatically triggered according to TriggerPolicy and there is no storm 
* Progressive autonomy Level 0→3 upgrade path end-to-end verification 
* The three-level organizational structure (company→department→team) correctly drives approval routing 
* SSO/SCIM automatically synchronizes users and deactivates accounts < 5min to take effect 
* Zero leakage of knowledge domain isolation, complete controlled sharing audit 

### Phase 6 Success Criteria (v2.5) 

*Dual Region Active-Active deployment, single Region failure RTO < 5min 
* High-priority tasks will not be starved under 1000 concurrent workflows 
* SLA Tier P0 tasks 99.9% completed within committed time 
* At least 20 certified packs listed on Marketplace 
* User feedback → Improvement closed loop < 7 days 
* Pre-built Connector covers all systems in the P0 category 

### Phase 7 Success Criteria (v2.6) 

* Users can query the explanation for any workflow step, L1 delay < 2s, L3 delay < 10s 
* Emergency braking drill: same Region, all platforms stop < 5s, recovery < 30min 
* AgentVersion composite grayscale release end-to-end verification (canary→active automatic promotion) 
* EdgeRuntime restores the connection after being disconnected for 24 hours, with zero loss of data synchronization 
* Behavior drift detection 100% triggers an alarm when the Agent behavior distribution shifts > 2σ 
* Cost optimization recommended savings rate ≥ 20% (compared to unoptimized baseline) 
* Compliance report SOC2 Type II is fully automatically generated, with control point coverage ≥ 95% 
* Capacity forecast 30-day accuracy ≥ 85% 
* Multi-modal: image analysis + speech-to-text available end-to-end 
* PlatformOps Agent L1 maturity verification: automatic diagnostic report generation < 5min 

--- 

# 37. Business domain modeling and access architecture 

> New in v2.2. Solve the core problem of "how to undertake the diversified business within the enterprise once the platform is set up". 
> Related: §30 Business Pack Model · §22 SDK/DX · §10 Risk Control · §16 Prompt Management · §17 Model Evaluation · §29 Knowledge/Memory 

## 37.1 Problem Statement 

There are fundamental differences among the 12+ vertical business lines within the enterprise in the following dimensions:
| Dimensions | Code development | Material production | Finance | Live streaming | Customer service |
|------|---------|---------|------|---------|------|
| Risk level | High (production changes) | Medium (brand compliance) | Critical (funding) | High (real-time decision-making) | Low (information query) |
| Time sensitivity | Minute level | Hour level | Day level (approval chain) | Second level | Second level |
| Knowledge timeliness | Code base real-time | Brand guide monthly level | Regulations quarterly level | Inventory level in seconds | FAQ weekly level |
| Evaluation Dimensions | Compile Pass + Test Coverage | Aesthetics + Brand Consistency | Accuracy + Compliance | GMV Conversion Rate | Resolution Rate + Satisfaction |
| Approval requirements | Code Review | Design review | Four-eye principle + hierarchical approval | Automatic (within rules) | None |
| Reversibility | Git revert | Version rollback | Reversal/reconciliation | Irreversible (broadcast) | Can be reissued |

**Currently §30 Business Pack compresses the above differences into a flat `BusinessPackManifest`**, which cannot express domain semantics, cannot drive differentiated risk control, and cannot guide domain Prompt strategy.

## 37.2 DomainDescriptor — Domain Descriptor

Each business domain must provide a structured domain descriptor when connecting to the platform, serving as the foundation for the platform to understand, constrain, and optimize that domain's Agent behavior:

```typescript
interface DomainDescriptor {
  domain_id: string;                          // e.g. "finance", "content-production"
  domain_name: string;                        // human-readable name
  domain_class: DomainClass;                  // domain classification
  version: string;                            // descriptor version

  entities: DomainEntity[];                   // domain core entities
  capabilities: DomainCapability[];           // domain capability declarations
  workflows: DomainWorkflowTemplate[];        // typical workflow templates
  vocabulary: DomainVocabulary;               // domain glossary
  constraints: DomainConstraint[];            // domain hard constraints

  risk_profile: DomainRiskProfile;            // → §37.3
  knowledge_schema: DomainKnowledgeSchema;    // → §37.4
  eval_framework: DomainEvalFramework;        // → §37.5
  prompt_library: DomainPromptLibrary;        // → §37.6
  governance: DomainGovernancePolicy;         // → §37.9
}

type DomainClass =
  | "crud_heavy"       // HR, customer service, enterprise knowledge base
  | "analytics"        // data analysis, advertising reports
  | "creative"         // material production, game assets
  | "realtime"         // live streaming sales, security operations
  | "transactional"    // finance, orders
  | "engineering"      // code development, CI/CD
  | "hybrid";          // multi-archetype mix

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
  tool_bindings: string[];                    // associated tool bundle IDs
}

interface DomainConstraint {
  constraint_id: string;
  type: "regulatory" | "business_rule" | "sla" | "data_boundary";
  description: string;
  enforcement: "hard_block" | "soft_warn" | "audit_only";
}
```

**Design Decision**: DomainDescriptor does not replace BusinessPackManifest (§30), but serves as the **domain semantic layer** for Pack. One Pack associates with one DomainDescriptor, and multiple Packs can share the same DomainDescriptor (for example, "HR Onboarding Pack" and "HR Compensation Pack" share `domain_id: "hr"`).

## 37.3 DomainRiskProfile — Domain Risk Portrait

The general risk matrix (§10) provides platform-level defaults, and DomainRiskProfile provides **domain-level overrides**, so the same action triggers different risk control strategies in different business domains:

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
  base_risk: number;                // platform default risk score
  domain_risk: number;              // domain override risk score
  reason: string;                   // override reason (for audit)
  requires_justification: boolean;  // whether Agent is required to provide execution reason
}

interface EscalationLevel {
  level: number;
  trigger: string;                  // e.g. "risk_score > 80"
  target: "domain_owner" | "platform_sre" | "security_team" | "executive";
  response_sla: string;             // e.g. "5m", "1h", "24h"
}
```
**Example of application of domain risk profiling**:
| Scenario | Platform default risk | Domain override risk | Result |
|------|-------------|-------------|------|
| `tool.http.post` | 60 | Financial domain → 90 | Forced four-eyes approval |
| `tool.http.post` | 60 | Customer service domain → 40 | Automatic execution |
| `tool.file.write` | 50 | Code R&D domain → 70 (production branch) | Code Review access control |
| `tool.file.write` | 50 | Material production domain → 30 | Automatically save draft |

## 37.4 DomainKnowledgeSchema — Domain Knowledge Structure

Defines knowledge retrieval strategy, timeliness requirements, and conflict resolution rules for each business domain, connecting to §29 Knowledge/Memory layer:

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
  priority: number;                         // retrieval priority
  refresh_interval: string;                 // e.g. "5m", "1d", "on_demand"
  auth_scope: string;                       // access permission scope
}

interface RetrievalStrategy {
  mode: "semantic_search" | "keyword" | "hybrid" | "structured_query" | "graph_traverse";
  top_k: number;
  rerank: boolean;
  domain_specific_filters: Record<string, string>;  // domain-level filter conditions
}

interface FreshnessPolicy {
  max_staleness: string;                    // maximum acceptable staleness
  on_stale: "warn_and_use" | "block_and_refresh" | "fallback_to_cached";
  critical_sources: string[];               // must-be-realtime data source IDs
}

interface ConflictResolution {
  strategy: "source_priority" | "timestamp_latest" | "human_review" | "domain_rule";
  domain_rules?: Record<string, string>;    // domain-level conflict resolution rules
}
```
**Example of Domain Knowledge Difference**:
| Business domain | Search mode | Timeliness requirements | Conflict strategy |
|--------|---------|---------|---------|
| Code development | structured_query (AST/Git) | Real-time (HEAD commit) | timestamp_latest |
| Finance | structured_query (ERP API) | Day level (T+1 reconciliation) | human_review |
| Live delivery | api_realtime (inventory/price) | Second level | source_priority (inventory system priority) |
| Enterprise knowledge base | hybrid (semantics + keywords) | Weekly level | domain_rule (highest version number first) |

## 37.5 DomainEvalFramework — Domain Evaluation Framework

The general model evaluation (§17) provides platform-level quality gates, and DomainEvalFramework defines **domain-specific quality axes and evaluation criteria**:

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
  weight: number;                           // normalized weight
  evaluator: "llm_judge" | "rule_engine" | "human" | "automated_test" | "metric_api";
  description: string;
}

interface AutomatedCheck {
  check_id: string;
  type: "regex" | "ast_lint" | "policy_rule" | "external_api" | "llm_classifier";
  config: Record<string, unknown>;
  blocking: boolean;                        // whether it is a release blocking item
}

interface RegressionDataset {
  dataset_id: string;
  size: number;
  refresh_cadence: string;
  golden_answer_source: "human_labeled" | "production_approved" | "expert_curated";
}
```
**Differences in domain assessment dimensions**:
| Business domain | Core quality axis | Automatic inspection | Regression data source |
|--------|-----------|---------|------------|
| Code development | Compilation passed, test coverage, security scan | AST lint + single test run | PR review passed code |
| Material production | Brand consistency, aesthetic scoring, size compliance | Size/format verification + LLM aesthetic scoring | Design team annotation |
| Finance | Numerical accuracy, compliance, audit traceability | Amount verification + regulatory rule engine | Expert audit samples |
| Advertising | CTR estimation accuracy, budget compliance, creative compliance | Budget cap check + advertising regulation check | A/B testing historical data |

## 37.6 DomainPromptLibrary — Domain Prompt Library

Connecting to §16 Prompt management system, providing **domain-level Prompt assets** for each business domain, avoiding scattered Prompt fragments:

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
  template: string;                         // prompt template with variable placeholders
  variables: PromptVariable[];
  version: string;
  eval_dataset_id: string;                  // associated evaluation dataset
}

interface FewShotExample {
  example_id: string;
  scenario: string;
  input: string;
  expected_output: string;
  quality_score: number;                    // annotation quality score
  source: "production_approved" | "expert_crafted" | "synthetic";
}

interface DomainInstruction {
  instruction_id: string;
  type: "always" | "conditional" | "fallback";
  condition?: string;                       // trigger condition expression
  content: string;                          // instruction injected into system prompt
}

interface ForbiddenPattern {
  pattern_id: string;
  regex: string;
  description: string;                      // why it is forbidden
  action: "block_response" | "redact" | "escalate";
}
```
**Relationship between Prompt library and Prompt management system (§16)**: DomainPromptLibrary is a domain-level Prompt asset, registered in PromptRegistry in §16. Prompt's versioning, grayscale, and rollback capabilities are provided by §16. The domain Prompt library is only responsible for **content definition and domain adaptation**. 

## 37.7 DomainRecipe — Domain templates and prototypes 

Summarize common business domains into four types of **Prototype Templates**. When new services are connected, select the closest prototype and quickly generate the DomainDescriptor skeleton based on the template:
| Prototype | Core pattern | Applicable business domain | Typical Workflow |
|------|---------|-----------|-------------|
| **CRUD-heavy** | Read → Check → Modify → Confirm | HR, customer service, corporate knowledge base | Problem acceptance → Inquiry → Processing → Feedback |
| **Analytics** | Collection → Analysis → Visualization → Decision | Data analysis, advertising reports | Data query → Analysis → Report generation → Recommended actions |
| **Creative** | Generate → Review → Iterate → Release | Material production, game assets | Requirements understanding → Generate → Manual review → Iterate → Release |
| **Realtime** | Monitoring → Detection → Response → Recording | Live delivery, safe operation and maintenance | Event stream monitoring → Anomaly detection → Automatic response → Post-event review |

```typescript
interface DomainRecipe {
  recipe_id: string;
  archetype: "crud_heavy" | "analytics" | "creative" | "realtime";
  name: string;
  description: string;

  scaffold: {
    entities: DomainEntity[];               // preset entity templates
    capabilities: DomainCapability[];       // preset capability declarations
    workflows: DomainWorkflowTemplate[];    // preset workflows
    risk_profile_template: Partial<DomainRiskProfile>;
    knowledge_schema_template: Partial<DomainKnowledgeSchema>;
    eval_axes_template: QualityAxis[];
    prompt_templates: DomainSystemPrompt[];
  };

  customization_points: CustomizationPoint[];  // customization points that must be filled by the business party
  validation_rules: ValidationRule[];          // validation rules after customization
}

interface CustomizationPoint {
  path: string;                             // JSON path, e.g. "entities[0].operations"
  required: boolean;
  description: string;
  default_value?: unknown;
}
```

**Usage Process**:

1. Business party selects archetype via CLI: `agent-platform domain init --archetype=crud_heavy --name=hr`
2. System generates DomainDescriptor skeleton, marks all `customization_points`
3. Business party fills in required items (entities, tool bindings, approval rules, etc.)
4. CLI runs `agent-platform domain validate` to verify completeness
5. After passing, proceed to §38 Runbook onboarding process

## 37.8 DomainInteractionPolicy — Cross-Domain Interaction Policy

When Agents from multiple business domains need to collaborate (for example, advertising domain Agent calls data analysis domain Agent to generate reports), explicit **boundary policies and compensation mechanisms** are required:

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
  max_depth: number;                        // maximum cross-domain delegation depth
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
**Cross-domain interaction matrix example**:
| Source domain → Target domain | Data flow direction | Delegation | Failure strategy |
|-------------|---------|------|---------|
| Advertising → Data Analysis | Aggregate data, prohibit PII | Allow (depth=1) | retry(3) → human_review |
| HR → Finance | Payroll data, encrypted transmission | Allow (depth=1, intersect) | rollback_source |
| Live → Inventory | Real-time inventory query | Prohibited (read-only API) | fallback cache |
| Code development → Security operation and maintenance | Code scan results | Allow (depth=1) | log_and_continue |

## 37.9 DomainGovernancePolicy — Domain Governance Model

Each business domain must have clear **governance ownership**, including ownership, SLO, budget, and change management:

```typescript
interface DomainGovernancePolicy {
  domain_id: string;

  ownership: {
    domain_owner: string;                   // business domain owner (person/team)
    platform_liaison: string;               // platform-side liaison
    escalation_contact: string;             // emergency contact
  };

  slo: {
    availability: string;                   // e.g. "99.9%"
    p95_latency: string;                    // e.g. "5s" (including LLM)
    error_rate: string;                     // e.g. "< 1%"
    eval_quality_floor: number;             // domain evaluation minimum score
  };

  budget: {
    monthly_token_quota: number;            // monthly token budget
    monthly_cost_cap: string;               // monthly cost cap
    burst_allowance: number;                // burst traffic allowance multiplier
    chargeback_cost_center: string;         // cost attribution center
  };

  change_management: {
    prompt_change_approval: "domain_owner" | "platform_team" | "both";
    tool_addition_approval: "domain_owner" | "security_team" | "both";
    risk_profile_change_approval: "platform_team";
    rollout_strategy: "canary_10_50_100" | "blue_green" | "immediate";
  };
}
```
**Mapping of governance model and platform capabilities**:
| Governance dimension | Platform capability docking | Degree of automation |
|---------|------------|----------|
| Ownership | §6 API Permissions + §11 IAM | Fully Automated (RBAC) |
| SLO | §27 SLO Monitoring + Error Budget | Fully Automatic (Alarm + Downgrade) |
| Budget | §18 Token metering + budget enforcement | Fully automatic (quota + circuit breaker) |
| Change Mgmt | §16 Prompt Grayscale + §30 Pack Release | Semi-automatic (Approval + Grayscale) |

## 37.10 DomainDescriptor Registration and Lifecycle

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Draft      │────▶│  Validated   │────▶│  Registered  │────▶│   Active     │
│ (written by   │     │ (CLI check)  │     │ (platform    │     │ (production  │
│  business)    │     │              │     │  registered) │     │  running)    │
└─────────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                     │
                         ┌──────────────┐     ┌──────────────┐      │
                         │  Deprecated   │◀────│  Updating    │◀─────┘
                         │ (migrating)   │     │ (version      │
                         └──────┬───────┘     └──────────────┘
                                │
                         ┌──────▼───────┐
                         │   Archived   │
                         │ (archived     │
│  read-only)  │
                         └──────────────┘
```
**Status transfer rules**:
| Current status | Transferable to | Conditions |
|---------|---------|------|
| Draft | Validated | `agent-platform domain validate` all passed |
| Validated | Registered | Security review + platform compatibility check passed |
| Registered | Active | At least one associated Pack was released successfully |
| Active | Updating | The business party submits a new version of descriptor |
| Updating | Active | New version verification + registration passed |
| Active | Deprecated | domain_owner initiated deprecation and approved |
| Deprecated | Archived | All associated Packs migrated or offline completed |

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

# 39. Natural Language Task Entry Architecture

> New in v2.3. Enable non-technical users to interact with the platform directly through natural language, replacing hand-written JSON/API calls.
> Related: §6 API Contract · §13 OAPEFLIR · §37 Business Domain Modeling · §40 Goal Decomposition · §44 Non-Technical User Experience

## 39.1 Design Principles

- Natural language is a **first-class interaction method**, equal to REST API, not a syntax sugar on top of API
- All NL interactions are ultimately converted to standard `RequestEnvelope` (§5.3), reusing existing control plane and execution plane
- Ambiguity must be explicitly resolved, not guessing user intent — rather ask one more question than mistakenly executing high-risk actions
- Conversation context is persisted to Memory (§29.2), recoverable across sessions

## 39.2 NL Interaction Pipeline

```text
User input (Natural Language)
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Intent Parser │────▶│ Domain Router│────▶│ Task Builder │
│ (Intent recognition)    │ (Domain routing)     │ (Task building)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
    ┌──────────────┐     ┌──────────────┐        │
    │ Clarification│◀────│ Ambiguity    │◀───────┘
    │ Dialog       │     │ Detector     │   Loop when ambiguous
    └──────┬───────┘     └──────────────┘
           │ User confirmation
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Risk Preview │────▶│ RequestEnvelope│──▶ P1 Interface Plane
    │ (Risk preview)   │     │ (Standard contract)     │
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
  normalized: unknown;        // normalized value
  source_span: [number, number];  // original text position
}

interface TaskBuildResult {
  request_envelope: RequestEnvelope;   // §5.3 standard contract
  risk_preview: RiskPreview;           // pre-execution risk preview
  cost_estimate: CostEstimate;         // estimated cost
  confirmation_required: boolean;      // whether user confirmation is needed
  human_summary: string;               // "I will do X for you, estimated cost ¥Y, risk level Z"
}

interface RiskPreview {
  overall_risk: "low" | "medium" | "high" | "critical";
  risk_factors: string[];              // human-readable risk factors
  reversible: boolean;
  side_effects: string[];              // expected side effects description
  approval_needed: boolean;
}
```
## 39.4 Ambiguity resolution strategy
| Ambiguity type | Example | Resolution method |
|---------|------|---------|
| Domain ambiguity | "Make a report" | Ask "Is it a financial report or an advertising report?" |
| Scope ambiguity | "Cleaning expired data" | Asking "Which domain data should be cleaned? Time range?" |
| Risk ambiguity | "Update product price" | Show risk preview + confirmation "This will affect X items online" |
| Time ambiguity | "Complete as soon as possible" | Maps to urgency=high, informing the estimated completion time |
| Permission ambiguity | "Help me approve these requests" | Check the permissions. If you don't have permission, it will prompt "You don't have approval permission and need to forward it to X" |

## 39.5 Multi-turn Conversation State Machine

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
│(asking)   │  │(building  │                  │
│           │  │ task)    │                  │
└────┬─────┘  └────┬─────┘                  │
     │ User answer   │                       │
     └──────┬──────┘                        │
            ▼                               │
    ┌───────────────┐                       │
    │ Confirming    │                       │
    │ (risk preview│                       │
    │  + confirm) │                       │
    └───────┬───────┘                       │
            │ User confirmed                │
            ▼                               │
    ┌───────────────┐     ┌────────────┐    │
    │ Executing     │────▶│ Reporting  │────┘
    │ (executing)  │     │ (results)  │
    └───────────────┘     └────────────┘
```
## 39.6 Security Constraints 

- All outputs from the NL entrance must pass the Prompt Injection guard (§16.5) 
- High-risk intentions (risk ≥ high) **must** be explicitly confirmed and NL is not allowed to be triggered directly 
- Conversation history is subject to data classification (§11.6), confidential/restricted content will not be echoed 
- The permissions of the NL entry are equal to the API permissions of the caller, and there is no additional privilege escalation. 

## 39.7 Multilingualism and Internationalization (i18n)
| Level | Internationalization Strategy |
|------|-----------|
| Intent Parser | Multi-language intent recognition: Call the LLM that supports multiple languages ​​through ModelGateway (§15); after language detection, route to the Prompt template of the corresponding locale |
| Clarification Dialog | The response language follows the user input language (auto-detect), or follows the `preferred_locale` setting in the user profile |
| Risk Preview | Risk descriptions and cost estimates use the currency/date format of the user's locale |
| NL status summary (§43) | Kanban summary generated per user locale; amounts/dates/numbers follow ICU format |
| Error messages | Platform standard error codes map to multilingual message catalog; fallback language is en-US |

```typescript
interface LocaleConfig {
  supported_locales: string[];         // e.g. ["zh-CN", "en-US", "ja-JP", "de-DE"]
  default_locale: string;              // fallback
  locale_resolution_order: ("user_profile" | "accept_language" | "input_detect" | "default")[];
}
```

---

# 40. Goal Decomposition Engine Architecture

> v2.3 New. Adds a Goal → Task decomposition layer above OAPEFLIR(§13), enabling users to describe business goals rather than individual tasks.
> Related: §13 OAPEFLIR · §19 Agent Delegation · §37 Business Domain Modeling · §39 NL Entry · §41 Proactive Agent

## 40.1 Three-Layer Decomposition Model

```text
Goal (Business Goal)
  "Launch X product Spring marketing campaign"
    │
    ▼  GoalDecomposer
Task (Domain Task)                          ← New Layer
  ├── [content-production] Create 3 sets of advertising materials
  ├── [advertising] Configure and deploy advertising plan
  ├── [data-analysis] Set up ROI tracking dashboard
  └── [legal] Review advertising compliance
    │
    ▼  OAPEFLIR Planner (§13)
Step (Execution Step)                        ← Existing Layer
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
## 40.3 Decomposition strategy
| Strategy | Applicable Scenarios | Mechanism |
|------|---------|------|
| **Template matching** | The target matches an existing DomainRecipe(§37.7) or cross-domain template | Directly instantiate the template and fill in the parameters |
| **LLM Planning** | New scenario with no matching template | Call ModelGateway(§15) for decomposition, subject to DomainDescriptor constraints |
| **Hybrid** | Partial matching | Template skeleton + LLM to fill in missing links |
| **Manual assistance** | Confidence < 0.7 or involving critical risk | Generate preliminary decomposition plan, request manual review and adjustment |

## 40.4 Cross-Domain Dependency Graph Management

```text
[content-production]──▶[legal]──▶[advertising]──▶[data-analysis]
     Material             Compliance        Launch             Effect
     Production           Review            Rollout            Tracking
         │                                  │
         └──────────parallel────────────────┘
                 (Material production and ad configuration can run in parallel)
```
- Automatic topological sorting of dependency graphs to identify tasks that can be parallelized 
- **Cyclic dependency detection**: After the decomposition is completed, DAG verification is performed on the dependency_graph. If a loop is detected, execution will be refused and the loop path will be returned to the user/GoalDecomposer to try again. 
- Critical path calculation, estimated total construction period 
- When a single Task fails, it is determined based on the dependency type: `blocks` → blocks the downstream, `soft_dependency` → warns but continues 
- Cross-domain data transfer follows DomainInteractionPolicy(§37.8) 

## 40.5 Goal life cycle
| Status | Description | Transferable to |
|------|------|---------|
| draft | Target created, not yet decomposed | decomposing, canceled |
| decomposing | Decomposing into Task | decomposed, failed |
| decomposed | Decomposition completed, waiting for confirmation | executing, canceled |
| executing | Task is being executed | completed, partially_completed, failed |
| completed | All Task + success criteria met | archived |
| partially_completed | Partial Task completed, partially failed | executing(retry), completed, canceled |
| failed | Decomposition or execution failed | decomposing(retry), canceled |
| canceled | canceled by user | archived |

---

# 41. Proactive Agent Framework

> v2.3 New. Enables Agents to proactively initiate tasks based on event triggers and scheduled timing, rather than only responding to API calls.
> Related: §4.2 P1 Interface Plane · §20 Long-running Tasks · §37 Business Domain Modeling · §40 Goal Decomposition

## 41.1 Design Principles

- Proactive Agents are **controlled automation**, not unconstrained autonomous behavior
- All triggers must be declared in DomainDescriptor(§37), undeclared triggers are not allowed to register
- Tasks created by triggers go through the **exact same risk control pipeline** (§10) as API-created tasks
- Costs generated by proactive behavior are charged to the corresponding domain's budget (§18)

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
  max_fire_rate: string;           // e.g. "10/hour" — Prevent trigger storms
  cooldown: string;                // Minimum interval between two triggers
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
  filter: Record<string, string>;  // Event field filtering
  batch_window?: string;           // Batch window, merge multiple events in a short time into one trigger
}

interface ThresholdTriggerConfig {
  metric_source: string;           // Metric source
  metric_name: string;
  condition: "gt" | "lt" | "eq" | "change_rate_gt";
  threshold: number;
  evaluation_window: string;       // Evaluation window
  consecutive_breaches: number;    // Number of consecutive violations before triggering
}

interface TriggerAction {
  action_type: "create_task" | "create_goal" | "suggest_to_user" | "update_dashboard";
  template: Partial<RequestEnvelope> | Partial<Goal>;
  require_confirmation: boolean;   // true = suggestion mode, false = auto execute
}
```
## 41.3 Trigger mode
| Pattern | Behavior | Applicable scenarios | Risk control |
|------|------|---------|---------|
| **Automatic execution** | Create tasks directly after triggering | Low-risk scheduled tasks (daily report generation, data synchronization) | require_confirmation=false + risk_level=low |
| **Recommendation mode** | Push suggestions to users after triggering, and execute after user confirmation | Medium and high risk event response (CTR decrease → recommended bid adjustment) | require_confirmation=true |
| **Silent recording** | Only records events and analysis results after triggering, without proactive notification | Data accumulation (user behavior pattern recognition) | action_type=update_dashboard |

## 41.4 Trigger Storm Protection

- **max_fire_rate**: Each trigger has a maximum fire rate, exceeding which automatically degrades to silent logging
- **cooldown**: Mandatory cooldown between two triggers to prevent duplicate execution
- **batch_window**: Event triggers can configure a batch window to merge multiple events in a short time into one trigger
- **circuit_breaker**: After N consecutive trigger task failures, automatically disable the trigger and alert
- **Global trigger budget**: Each domain has a maximum number of daily auto-triggers to prevent runaway execution

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
                       │ Queue        │──▶ User Dashboard(§43) / Push Notification
                       └──────┬───────┘
                              │ User confirms
                       ┌──────▼───────┐
                       │ Task/Goal    │──▶ Standard Execution Pipeline
                       │ Creator      │
                       └──────────────┘
```

---

# 42. Progressive Autonomy Model

> v2.3 New. Dynamic promotion/demotion of Agent autonomy driven by historical performance data, reducing manual supervision burden.
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
**Default promotion ladder**:
| Current level | Promotion to | Conditions | Approval |
|---------|-------|------|------|
| suggestion | supervised | ≥ 50 executions + success rate ≥ 95% + 0 incident(30d) | domain_owner |
| supervised | semi_auto | ≥ 200 executions + success rate ≥ 98% + manual override rate < 5% + 0 incident(60d) | domain_owner |
| semi_auto | full_auto | ≥ 500 executions + success rate ≥ 99% + manual override rate < 1% + 0 incident(90d) | platform_team |
**Instant Downgrade Trigger**:
| Events | Downgrade Actions | Recovery Conditions |
|------|---------|---------|
| Cause P0 Incident | Drop directly to suggestion | Manual investigation + platform_team approval |
| Cause P1 Incident | Downgrade one level | 30d No incident |
| 3 consecutive failures | Downgraded level | 10 consecutive successes |
| Cost over budget by 200% | Downgraded to supervised | Budget adjustment + domain_owner confirmation |

## 42.3 Autonomy Change Audit

All autonomy changes are recorded to event_log(§28)：

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
## 42.4 Integration with existing architecture
| Existing components | Integration methods |
|---------|---------|
| §10 Risk Control | trust_score as an adjustment factor of risk_score - the same action of a high-trust Agent has a lower risk |
| §17 Model Evaluation | eval quality degradation automatically triggers trust degradation |
| §21 HITL | Autonomy determines HITL mode - suggestion level must be manually confirmed, full_auto level is executed silently |
| §37.2 DomainCapability | `max_automation_level` as a ceiling - no matter how high the trust is, it cannot exceed the upper limit set by the domain |
| §41 Active Agent | Only semi_auto and above are allowed to automatically execute triggers, otherwise the suggestion mode will be used |

---

# 43. Unified Operations Dashboard Architecture

> v2.3 New. Provides layered operational views for one-person companies to enterprises with tens of thousands of people, replacing SRE-oriented infrastructure-level metrics.
> Related: §12 Exceptional Events · §18 Cost Management · §27 SLO · §37.9 Governance · §42 Autonomy

## 43.1 Dashboard Layering

```text
┌─────────────────────────────────────────┐
│  L1 Operator View (One-person company / │  "Is everything normal? What needs my attention?"
│  Business Owner)                         │
├─────────────────────────────────────────┤
│  L2 Domain Admin View (Dept Agent Admin) │  "What Agents do I have in my domain? How are they performing?"
├─────────────────────────────────────────┤
│  L3 Platform Ops View (Platform SRE)    │  "Is infrastructure healthy? Resource utilization?"
├─────────────────────────────────────────┤
│  L4 Fleet Management View (Enterprise    │  "Which department has problems? Global capacity?"
│  Platform Team)                          │
└─────────────────────────────────────────┘
```

## 43.2 L1 Operator View

Business-oriented view for non-technical users：

```typescript
interface OperatorDashboard {
  attention_queue: AttentionItem[];        // "Items needing your attention" queue
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
  action_options: ActionOption[];          // Executable actions (one-click operations)
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

## 43.3 L2 Domain Administration View

Domain operational view for department Agent administrators：

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

## 43.4 L3 Platform Operations View

Infrastructure operations view for SRE teams：

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

Global operations view for enterprise platform teams：

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
## 43.6 NL status summary generation 

Kanban supports natural language summaries, generated by ModelGateway(§15): 

- **Daily Briefing**: "Today, 5 Agents completed 23 tasks (success rate 96%), costing ¥45. The advertising domain Agent performed well (ROI 2.8x). There are 2 approvals waiting for you to process, and 1 budget alarm needs attention." 
- **Exception Brief**: "In the past 1 hour, the customer service domain Agent success rate dropped from 95% to 78%, mainly due to the slow response of the knowledge base API. It has been automatically downgraded to cache mode. It is recommended that you check the knowledge base service status." 
- **Leave Back Briefing**: "During the 8 hours you were away: 12 tasks completed, costing ¥80. 1 P1 Incident in Finance domain (auto-recovered). 3 approvals have timed out for automatic processing. No immediate action required." 

--- 

# 44. Non-technical user experience architecture 

> New in v2.3. Enable non-developers (business leaders, independent operators) to use all capabilities of the platform through a visual interface. 
> Related: §22 SDK/DX · §38 Access Runbook · §39 NL Entry · §43 Kanban 

## 44.1 User role layering
| Role | Technical level | Main interaction method | Kanban board level |
|------|---------|------------|---------|
| Independent operator | Non-technical | NL Dialogue (§39) + L1 Kanban (§43) | L1 |
| Business Line Leader | Non-Technical | L1 Kanban + Visual Configuration | L1 |
| Domain Admin | Low Code | Visual Configuration + Occasionally CLI | L2 |
| Pack Developer | Technology | SDK + CLI(§22) | L2/L3 |
| Platform SRE | Technology | CLI + Admin API + L3/L4 Kanban | L3/L4 |

## 44.2 Visual Domain Access Wizard

Replaces §38's CLI + YAML process for technical users:

```text
Step 1               Step 2               Step 3               Step 4
Select Business       Configure Core       Set Risk Control     Activate & Launch
Type                  Capabilities         Rules
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ "What    │        │ Drag &   │        │ Risk     │        │ One-click│
│  type of │───────▶│ Drop     │───────▶│ Slider   │───────▶│ Activate │
│  business│        │ Select   │        │ Approvals│        │ Gray-scale│
│  is it?" │        │ Needed   │        │ Templates│        │ Start    │
│ [Card    │        │ Capabilities│    │ [Preset  │        │ [Progress │
│ Select]  │        │ [Tool     │        │ Template]│        │ Bar]     │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| Traditional method (§38) | Visual method (§44) |
|--------------|---------------|
| `agent-platform domain init --archetype=crud_heavy` | Select the card "Customer Service Class" |
| Manually edit DomainDescriptor YAML | Form filling + smart recommendations |
| `agent-platform domain validate` | Real-time verification + traffic light prompts |
| Multi-team collaboration 5-9 weeks | Wizard-led 1-3 days (low risk domain) |

## 44.3 Visual Workflow Builder

Workflow orchestration interface for non-technical users：

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

## 44.4 Intelligent Guided Onboarding

```text
First Login
    │
    ▼
┌──────────────────┐
│ "Hello! I'm your │
│  AI Business     │
│  Assistant.       │
│  What would you   │
│  like me to do?" │
└───────┬──────────┘
        │ User describes business
        ▼
┌──────────────────┐
│ Auto Recommend   │
│ • Suitable       │
│   domain templates│
│ • Required       │
│   integrations   │
│ • Estimated cost │
└───────┬──────────┘
        │ User confirms
        ▼
┌──────────────────┐
│ One-click        │
│ Configuration    │
│ • Create Domain  │
│ • Install Base   │
│   Pack          │
│ • Set default   │
│   risk control  │
│ • Activate first│
│   Agent         │
└───────┬──────────┘
        │ After 3 minutes
        ▼
┌──────────────────┐
│ "Your first      │
│  Agent is ready! │
│  Try saying:     │
│  'Help me...'   │
└──────────────────┘
```
## 44.5 Single player mode vs Enterprise mode 

The platform automatically adjusts UX complexity based on the number of users:
| Dimensions | Single player mode | Enterprise mode |
|------|---------|---------|
| Tenant | Automatically create a single tenant and hide the concept of tenant | Complete multi-tenant management |
| Approval | Self-approval (low/medium risk automatically passes, high risk pop-up window confirmation) | Complete approval flow engine (§21) |
| Security Review | Built-in security checks run automatically, eliminating the need for a human security team | Review by an independent security team |
| Access process | Wizard-guided 3 minutes | Four-stage runbook(§38) |
| Kanban | L1 operator view only | L1-L4 all levels |
| Costs | Personal budget view + money-saving suggestions | Department-level chargeback |
| Governance | Simplified (you are domain_owner) | Complete organizational governance |

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
  upgrade_path: string;           // Guide to upgrading to the next mode
}
```
## 44.6 Accessibility (WCAG 2.1 AA)
| WCAG Principles | Platform Implementation |
|-----------|---------|
| Perceptible | All charts provide alt text / data table alternative view; color is not used as the only information carrier (with shapes / labels) |
| Operable | All functions can be operated through the keyboard (Tab sequence, Enter to confirm, Esc to cancel); NL entrance supports voice input (§68) |
| Understandable | Error messages clearly identify the problem and suggested fixes; form labels are explicitly associated with inputs |
| Robustness | Semantic HTML; ARIA annotation of key interactive controls (kanban cards, approval buttons, workflow canvas nodes) |

**Audit & Testing**: axe-core scan runs automatically before each frontend release; WCAG AA violations are treated as release blockers.

---

# 46. Organizational Hierarchy Model

> v2.4 New. Adds company/division/department/team organizational hierarchy layer above tenant/domain/pack, driving layered governance of approvals, budgets, isolation, and compliance.
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
}

interface OrgChart {
  root: OrganizationNode;                  // company
  nodes: OrganizationNode[];
  reporting_chains: ReportingChain[];      // Reporting chain
  sync_source: "scim" | "manual" | "hr_api";
  last_synced: string;
}

interface ReportingChain {
  employee_id: string;
  chain: string[];                         // [direct_manager, skip_level, ..., CEO]
}
```

## 46.2 Mapping Between Organizational Hierarchy and Platform Hierarchy

```text
Organizational                Platform
Hierarchy                     Architecture
company ──────────────────── platform (single instance)
  ├── division ────────────── tenant_group (budget aggregation)
  │   ├── department ──────── tenant (isolation unit)
  │   │   ├── team ────────── domain + pack_group
  │   │   └── team ────────── domain + pack_group
  │   └── department ──────── tenant
  └── division ────────────── tenant_group
```

| Organizational Hierarchy | Platform Mapping | Governance Permissions |
|---------|---------|---------|
| company | platform config | global strategy, platform-level SLO, compliance overview |
| division | tenant_group | Division budget, cross-department workflow strategy |
| department | tenant | Department budget, department SLO, domain management, approval chain |
| team | domain/pack | Domain configuration, Pack development, daily operations |
## 46.3 Automatic adaptation to organizational changes
| Organizational change events | Platform automatic response |
|------------|------------|
| Employee onboarding | SCIM synchronization → Create principal → Assign to team → Inherit team permissions |
| Employee transfer | Update reporting_chain → Adjust tenant/domain permissions → Migrate approval delegation |
| Employee resignation | SCIM deprovisioning → Revoke all permissions → Transfer domain_owner → Audit records |
| Department Merger | Merge Tenants → Consolidate Budget → Recalculate SLO → Migrate Pack Attribution |
| Organizational reorganization | Rebuild reporting_chain → Refresh approval routes → Notify affected domain_owners |

---

# 47. Organizational Structure Approval Routing

> v2.4 New. Dynamic approval routing based on org-chart, replacing static approver lists.
> Related: §21 HITL · §46 Organizational Hierarchy · §10 Risk Control

## 47.1 Dynamic Approval Routing Engine

```typescript
interface ApprovalRoutingRule {
  rule_id: string;
  domain_id: string;
  trigger_condition: string;               // Trigger condition expression
  routing_strategy: RoutingStrategy;
}

type RoutingStrategy =
  | OrgChartRouting
  | AmountBasedRouting
  | SodRouting;                            // Segregation of Duties

interface OrgChartRouting {
  type: "org_chart";
  start_from: "initiator_manager" | "domain_owner" | "cost_center_owner";
  escalation_levels: number;               // How many levels to escalate upward
  skip_conditions?: string[];              // Skip conditions (e.g., skip to skip-level when "manager = initiator")
}

interface AmountBasedRouting {
  type: "amount_based";
  thresholds: AmountThreshold[];
}

interface AmountThreshold {
  max_amount: number;
  currency: string;
  approver_level: "auto" | "manager" | "director" | "vp" | "cxo";
  requires_sod: boolean;                   // Whether segregation of duties is required
}

interface SodRouting {
  type: "segregation_of_duties";
  initiator_cannot_approve: boolean;
  same_team_cannot_approve: boolean;
  minimum_approvers: number;
  from_different_departments: boolean;
}
```
## 47.2 Approval Quota Matrix
| Risk Amount | Automatic | Manager | Director | VP | CFO/CTO |
|---------|------|---------|----------|----|---------| 
| < ¥1,000 | ✓ | | | | |
| ¥1K-10K | | ✓ | | | |
| ¥10K-100K | | | ✓ | | |
| ¥100K-1M | | | | ✓ | |
| > ¥1M | | | | | ✓ |

## 47.3 Automatic Delegation When Approver Unavailable

```typescript
interface DelegationOfAuthority {
  delegator: string;                       // Delegator
  delegate: string;                        // Delegate
  scope: "all" | "domain_specific" | "amount_limited";
  max_amount?: number;
  valid_from: string;
  valid_until: string;
  auto_activated_by: "calendar_ooo" | "manual" | "scim_status";
  audit_trail: boolean;
}
```
When the approver is not available, the system looks for an agent according to the following priorities: 
1. Explicit delegation of authority (DelegationOfAuthority) 
2. org-chart goes up one level (skip-level manager) 
3. Peer at the same level and in the same department (if the configuration allows) 
4. Execute ApprovalTimeoutPolicy(§21) after timeout 

--- 

# 48. Enterprise SSO/SCIM Integrated Architecture 

> New in v2.4. Integrate with enterprise identity providers for automated user lifecycle management. 
> Relevance: §6.5 Authentication · §11 Security · §46 Organizational Hierarchy 

## 48.1 Identity Integration Protocol
| Protocol | Purpose | Priority |
|------|------|--------|
| **OIDC** | SSO login (already §6.5) | Supported |
| **SAML 2.0** | SSO Login (Legacy Enterprise IdP) | New in v2.4 |
| **SCIM 2.0** | User/group automatic synchronization | New in v2.4 |
| **HR API** | Organization structure synchronization (optional) | New in v2.4 |

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
    group_to_org_node: GroupOrgMapping[];  // IdP group → organizational hierarchy node (§46)
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
  tenant_scope: string;                    // Maps to which tenant
  auto_create_tenant: boolean;
}
```

## 48.3 User Lifecycle Automation

```text
IdP Event                  Platform Response
─────────                   ────────
User Created ──────────▶ Create principal + assign role + add to org_node + welcome guide
User Updated ──────────▶ Sync attributes + update reporting_chain + adjust permissions
User Deactivated ──────▶ Immediately revoke all active sessions + pause all owned Agents
User Deleted ──────────▶ Transfer domain_owner + archive audit records + trigger data_retention
Group Changed ─────────▶ Batch update role mapping + refresh approval routes (§47)
```

---

# 49. Sub-Department Compliance Policy Engine

> v2.4 New. Enables different departments to execute different compliance frameworks (SOX + HIPAA + PCI-DSS + GDPR coexistence).
> Related: §23 Compliance · §37.3 DomainRiskProfile · §46 Organizational Hierarchy

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
  platform_mapping: string[];              // Maps to platform capabilities, e.g. ["§11.2 RBAC", "§21 Approval"]
}

interface DepartmentComplianceBinding {
  department_id: string;                   // §46 org_node
  frameworks: string[];                    // Bound compliance framework IDs
  additional_controls: ComplianceControl[];// Department-level additional controls
  compliance_officer: string;              // Compliance officer
  evidence_retention: string;              // Evidence retention period
}
```

## 49.2 Compliance Policy Inheritance

```text
company:  [Basic Security Policy] + [Data Classification Policy]
    │
    ├── finance_division:  Inherits + [SOX]
    │   ├── accounting_dept: Inherits + [SOX-404 Enhanced]
    │   └── payment_dept:   Inherits + [PCI-DSS]
    │
    ├── healthcare_division: Inherits + [HIPAA]
    │
    └── eu_operations:      Inherits + [GDPR]
```
Rules: Child nodes **inherit** all compliance constraints from the parent node and can be **added** but not **relaxed**. 

## 49.3 Automated compliance evidence collection
| Compliance Controls | Sources of Evidence | Collection Methods |
|---------|---------|---------|
| SOX access audit | §11.2 RBAC + §28 audit log | Quarterly automatic export of access rights snapshots |
| SOX Separation of Duties | §47 SodRouting | Automatically verify that the approval chain is free of violations |
| HIPAA Data Encryption | §23.5 Encryption Architecture | Continuous Monitoring of Encryption Status |
| PCI-DSS Scope Restrictions | §46 tenant isolation | Automatic verification of CDE boundaries |
| GDPR Right to Erasure | §23.2 crypto-shredding | Automatic recording of evidence of deletion execution |

---

# 50. Knowledge Domain Isolation and Controlled Sharing

> v2.4 New. Mandatory isolation of knowledge assets between departments, providing approval-based cross-domain sharing.
> Related: §29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 Organizational Hierarchy · §11 Security

## 50.1 Knowledge Isolation Model

```typescript
interface KnowledgeBoundary {
  boundary_id: string;
  org_scope: string;                       // Corresponds to §46 org_node_id
  isolation_level: "strict" | "controlled" | "open";
  knowledge_namespaces: string[];          // Knowledge namespaces within this boundary
  access_policy: KnowledgeAccessPolicy;
}

type IsolationLevel =
  | "strict"       // Information barrier — prohibit any cross-boundary access (M&A, insider information)
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
  ttl?: string;                            // Shared authorization validity period
}
```

## 50.2 Knowledge Federation Search

When Agents search for knowledge, KnowledgeFederator filters results by permissions:

```text
Agent Search Request
    │
    ▼
┌────────────────┐
│ Knowledge      │
│ Federator      │
└───┬────────────┘
    │
    ├──▶ [Knowledge within this boundary] → Return directly
    ├──▶ [Controlled boundary knowledge] → Check CrossBoundaryRule → Return if authorized (may be transformed)
    └──▶ [Strict boundary knowledge] → Completely invisible (not even "existence" is exposed)
```

## 50.3 Information Isolation Wall (Chinese Wall)

Financial services scenario requirements:

- M&A team's knowledge is **completely invisible** to other departments
- The same person cannot simultaneously access knowledge of conflicting parties
- Once accessing Party A's knowledge, automatically prohibited from accessing Party B's knowledge (dynamic isolation wall)

```typescript
interface ChineseWallPolicy {
  conflict_groups: ConflictGroup[];
}

interface ConflictGroup {
  group_id: string;
  boundaries: string[];                    // Mutually exclusive knowledge boundaries
  rule: "access_one_blocks_others";        // Automatically block others after accessing one
}
```

---

# 51. Hierarchical Governance Delegation

> v2.4 New. Enables department administrators to self-serve governance within guardrails set by the platform team, so the platform team is no longer the bottleneck for all governance changes.
> Related: §24 Configuration Governance · §37.9 DomainGovernancePolicy · §46 Organizational Hierarchy

## 51.1 Governance Permission Layering

```typescript
interface GovernanceDelegation {
  org_node_id: string;                     // §46
  delegated_to: string;                    // principal or role
  permissions: GovernancePermission[];
  guardrails: Guardrail[];                 // Guardrails set by platform team
}

type GovernancePermission =
  | "manage_domains"           // Create/modify this department's DomainDescriptor
  | "manage_packs"             // Publish/rollback this department's Pack
  | "manage_prompts"           // Modify this department's PromptLibrary
  | "manage_triggers"          // Configure this department's triggers (§41)
  | "manage_approvals"         // Configure this department's approval rules (within quota limits)
  | "manage_budgets"           // Allocate this department's budget (within upper-level allocation)
  | "manage_knowledge"         // Manage this department's knowledge boundaries
  | "view_audit"               // View this department's audit records
  | "manage_agents"            // Enable/disable this department's Agents
  | "manage_eval";             // Manage this department's evaluation datasets

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
    ▼ Inherit (cannot relax)
division_admin sets division strategy
    │
    ▼ Inherit (cannot relax) + can add
department_admin sets department strategy
    │
    ▼ Inherit (cannot relax) + can add
team_lead daily operational config
```

| Operation | Superiors can | Subordinates can |
|------|-------|-------|
| Tighten strategy (reduce max_risk) | ✓ | ✓ |
| Relaxation strategy (increase max_risk) | ✓ | ✗ |
| Add constraints | ✓ | ✓ |
| Delete superior constraints | ✓ (set by yourself) | ✗ |
| Allocate budget | ✓ (within your own quota) | ✓ (within your own quota) |
## 51.3 Self-service management console
| Functions | Available to department administrators | Available to platform teams |
|------|-------------|------------|
| Domain Access Wizard (§44.2) | ✓ (Low/Medium Risk Domains) | ✓ (All Domains) |
| Modify approval rules | ✓ (within the quota limit) | ✓ (no limit) |
| Publish Pack | ✓ (After automatic security scan) | ✓ |
| Adjust Agent Autonomy (§42) | ✓ (Do not exceed domain upper limit) | ✓ |
| Creating Triggers (§41) | ✓ (Low/Medium Risk) | ✓ |
| Modify global guardrails | ✗ | ✓ |
| Cross-department strategy | ✗ | ✓ |

---

# 52. Multi-Region Deployment Architecture

> v2.5 New. Supports cross-Region compliant operations for globalized enterprises, with data sovereignty, traffic routing, and fault isolation.
> Related: §31 Disaster Recovery · §32 Deployment · §23 Compliance · §46 Organizational Hierarchy

## 52.1 Region Model

```typescript
interface RegionDefinition {
  region_id: string;                       // e.g. "cn-east", "eu-west", "us-east"
  jurisdiction: string;                    // Jurisdiction, e.g. "CN", "EU", "US"
  data_residency_class: string;            // Data residency classification
  available_providers: string[];           // LLM providers available in this Region
  compliance_frameworks: string[];         // Mandatory compliance frameworks for this Region
}

interface RegionTopology {
  regions: RegionDefinition[];
  primary_region: string;                  // Control plane primary Region
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
                    │  Global Control Plane │ (Metadata Federation)
                    │  Region Routing · Policy Sync │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ CN Region     │ │ EU Region     │ │ US Region     │
    │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │
    │ │ P1-P5     │ │ │ │ P1-P5     │ │ │ │ P1-P5     │ │
    │ │ Full Five │ │ │ │ Full Five │ │ │ │ Full Five │ │
    │ │ Planes    │ │ │ │ Planes    │ │ │ │ Planes    │ │
    │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
    │ Data: CN      │ │ Data: EU      │ │ Data: US      │
    │ Compliance:   │ │ Compliance:   │ │ Compliance:   │
    │ PIPL          │ │ GDPR          │ │ SOX           │
    └───────────────┘ └───────────────┘ └───────────────┘
```
## 52.3 Cross-Region Workflow routing
| Scenario | Routing strategy | Data processing |
|------|---------|---------|
| The user is in EU, the task only involves EU data | Region affinity, stay in EU | Local processing |
| The user is in CN and needs to call the LLM of US | CN execution, LLM request is routed to US | Cross-border is allowed when input/output does not contain PII |
| Cross-Region collaboration (EU market + US project) | Execution in respective Regions, metadata synchronization | Only exchange anonymized/aggregated data |
| Region failure failover | Manual/semi-automatic switch to standby Region | Metadata pre-replication, business data does not cross borders |
## 52.4 Cross-border data transfer compliance
| Jurisdiction | Compliance Framework | Platform Mechanism |
|------|---------|---------|
| EU → Non-EU | GDPR Chapter V — SCCs (Standard Contractual Clauses) | Cross-Region LLM calls automatically attach SCC data processing agreement references; automatic DPIA (Data Protection Impact Assessment) assessment before transfer |
| EU → US | EU-US Data Privacy Framework | Verify whether the provider is in the DPF list; if not included, fall back to SCC |
| CN → Overseas | PIPL Article 38 - Security Assessment/Standard Contract | Automatically trigger data volume assessment before cross-border; security assessment records are required if the threshold is exceeded |
| Cross-border within the group | BCRs (Binding Corporate Rules) | Enterprise-level BCR template, the platform automatically quotes and records the BCR number in cross-border transmission |

**Cross-border Transfer Control Chain**：

```text
Cross-Region Data Request
    │
    ▼
┌──────────────────┐
│ Jurisdiction      │  Identify source/target jurisdiction
│ Classifier        │
├──────────────────┤
│ Transfer Impact   │  Automatic DPIA scoring; high impact → manual approval
│ Assessor          │
├──────────────────┤
│ Mechanism         │  Select compliance mechanism: SCC / BCR / DPF / Security Assessment
│ Selector          │
├──────────────────┤
│ Data Minimizer    │  Only transfer necessary fields; PII anonymization/pseudonymization
├──────────────────┤
│ Transfer Logger   │  Complete transfer log (source, target, legal basis, data volume, time)
└──────────────────┘
```

---

# 53. Large-Scale Resource Competition Management

> v2.5 New. Fair scheduling, priority preemption, and capacity guarantees for 5000+ concurrent workflow scenarios.
> Related: §8 Scalability · §9 Stability · §14 Runtime · §46 Organizational Hierarchy · §54 SLA

## 53.1 Scheduling Hierarchy

```text
┌─────────────────────────────────┐
│  Admission Controller           │  Global admission control
│  (Reject requests exceeding      │
│   platform capacity)            │
├─────────────────────────────────┤
│  Quota Manager                  │  Department-level quota management
│  (Guarantee/limit each          │
│   department's resource share)  │
├─────────────────────────────────┤
│  Priority Scheduler             │  Priority scheduling
│  (SLA-aware + preemption)       │
├─────────────────────────────────┤
│  Worker Pool                    │  Execution layer
└─────────────────────────────────┘
```

## 53.2 Resource Quota Model

```typescript
interface ResourceQuota {
  org_node_id: string;                     // §46 Department
  guaranteed: ResourceAllocation;          // Guaranteed resources (always available)
  burstable: ResourceAllocation;           // Burstable resources (available when idle)
  max_limit: ResourceAllocation;           // Hard limit
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
|--------|------|---------|---------|
| critical(1000) | Online accident repair | Can preempt all non-critical | < 10s |
| high(800) | E-commerce order processing | Can be preempted below standard | < 30s |
| standard(500) | Daily business workflow | No preemption | < 5min |
| background(200) | Batch analysis/report | No preemption, run when idle | Best effort |
| best_effort(0) | Experimental tasks | No preemption, can be preempted at any time | No guarantee |

## 53.4 Fair Scheduling

- **Weighted Fair Queuing**: Each department receives weight based on its guaranteed quota
- **Borrowing**: When a department hasn't used its full guaranteed quota, idle resources can be burst-used by other departments
- **Reclaim**: When the original department needs it, borrowed resources are returned after the current step completes (graceful reclaim)
- **Starvation Prevention**: Any department's standard priority task that queues for more than 30min is automatically upgraded to high

---

# 54. SLA Tiered Guarantee

> v2.5 New. Provides differentiated SLA guarantees for different business importance levels, including resource reservation and violation responses.
> Related: §27 SLO · §37.9 DomainGovernancePolicy · §53 Resource Competition

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

| Tier | Availability | P95 delay | Queuing limit | Recovery priority | Applicable scenarios |
|------|--------|---------|---------|---------|---------|
| **Platinum** | 99.99% | < 2s | < 5s | Highest | Online trading, real-time risk control |
| **Gold** | 99.95% | < 5s | < 30s | High | Core business workflow |
| **Silver** | 99.9% | < 15s | < 5min | Medium | Daily Operations |
| **Bronze** | 99.5% | < 60s | < 30min | Low | Internal tools, experiments |

## 54.3 SLA-Aware Scheduling

Dispatcher(§14.2) considers SLA Tier when scheduling:

1. **Queue Check**: Automatically upgrade priority when workflow queue time approaches `max_queue_time`
2. **Latency Prediction**: Predict whether workflow will violate SLA based on historical data, proactively scale or preempt
3. **Resource Reservation**: Platinum/Gold tier's `resource_reservation` is always reserved for them and cannot be occupied by burst
4. **Violation Response**: When SLA is violated, automatically execute according to `ViolationResponse` (alert/scale/preempt/upgrade)

---

# 55. Agent Market and Ecology

> v2.5 New. Builds an internal/external ecosystem marketplace for Packs, Plugins, templates, and connectors.
> Related: §30 Business Pack · §37.7 DomainRecipe · §22 SDK/DX

## 55.1 Market Architecture

```text
┌───────────────────────────────────────────┐
│  Marketplace Registry                     │
│  ├── Pack Store      (Business Domain Pack)│
│  ├── Plugin Store    (Functional Plugins)  │
│  ├── Connector Store (External System      │
│  │                     Connectors)         │
│  ├── Template Store  (Workflow Templates)  │
│  ├── Prompt Store    (Domain Prompt       │
│  │                     Library)           │
│  └── Eval Store      (Evaluation Datasets)│
├───────────────────────────────────────────┤
│  Quality & Security Gate                  │
│  Auto Scan · Compatibility Test ·         │
│  Sandbox Verification                     │
├───────────────────────────────────────────┤
│  Discovery & Recommendation               │
│  Search · Classification · Rating ·       │
│  Smart Recommendation                     │
└───────────────────────────────────────────┘
```

## 55.2 Market Entry Model

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
## 55.3 Installation and Management
| Publisher Type | Installation Approval | Security Requirements | Update Policy |
|-----------|---------|---------|---------|
| platform_official | Automatic installation | Reviewed by the platform team | Automatic updates |
| enterprise_internal | Department administrator approval | Automatic security scan | Automatically after notification |
| verified_third_party | Department Administrator + Security Team | Auto Scan + Manual Review | Manual Confirmation |
| community | platform team approval | complete security review + sandbox testing | manual confirmation |
## 55.4 Revenue Sharing Model
| Pricing type | Sharing rules | Billing cycle |
|---------|---------|---------|
| free | No share | — |
| enterprise_included | Included in the platform license, the publisher will receive credit points based on the number of installations | Quarterly |
| paid (third_party) | publisher 70% / platform 30% | Monthly |
| paid (community) | publisher 80% / platform 20% (community contributions are encouraged) | monthly |
## 55.5 Entry obsolescence life cycle
| Stage | Trigger condition | Platform action |
|------|---------|---------|
| active | normal operation | — |
| deprecated | publisher marked deprecated or no maintenance updates for 90 days + known security vulnerabilities | The installation page displays a deprecation warning; new installations require confirmation; recommended alternatives |
| sunset | 180 days after deprecated | Block new installations; already installed ones send migration notification (30-day countdown) |
| removed | sunset countdown ends | Removed from Registry; installed instance frozen (no new tasks performed), data retained for 90 days |

## 55.6 Dependency Management

- Each MarketplaceItem declares `dependencies: { item_id: string; version_range: string }[]`
- Automatically resolve dependency tree during installation, detect version conflicts (similar to npm/cargo resolution)
- Check reverse dependencies during uninstallation; if other items depend on it, block uninstallation and prompt
- When a dependency is deprecated, automatically notify all dependent publishers and install users

---

# 56. Feedback-Driven Continuous Improvement Pipeline

> v2.5 New. Materializes §13 Learn/Improve black-box interface into a runnable automatic improvement pipeline.
> Related: §13 OAPEFLIR L-I-R · §17 Model Evaluation · §37.5 DomainEvalFramework · §42 Progressive Autonomy

## 56.1 Improvement Pipeline Overview

```text
Production Execution Data
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Signal       │────▶│ Analysis     │────▶│ Improvement  │
│ Collector    │     │ Engine       │     │ Generator    │
│ (Signal      │     │ (Pattern     │     │ (Improvement │
│  Collection) │     │  Analysis)   │     │  Generation) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Quality Gate │──▶ §17 Eval
                                           └──────┬───────┘
                                                  │ Pass
                                           ┌──────▼───────┐
                                           │ Gradual      │
                                           │ Rollout      │──▶ §16 Prompt Gray-scale
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
  | "quality_drift"            // eval quality degraded
  | "cost_anomaly"             // Cost anomaly
  | "latency_anomaly";         // Latency anomaly
```
## 56.3 Automatic improvement types
| Type of improvement | Trigger conditions | Degree of automation | Output |
|---------|---------|----------|------|
| **Few-shot harvest** | User approval accumulation > 10 | Fully automatic | Add few-shot example to PromptLibrary |
| **Prompt fine-tuning** | Similar user_correction > 5 items | Semi-automatic (generate candidates → manual review) | Prompt modification suggestions |
| **Model routing optimization** | cost_anomaly or latency_anomaly | Fully automatic | ModelGateway routing rule update |
| **Risk control rule adjustment** | Continuous false positive approval > 10 times | Semi-automatic (recommended → domain_owner confirmation) | Risk threshold adjustment suggestions |
| **Knowledge base update** | quality_drift + knowledge source expiration | Fully automatic | Trigger knowledge source refresh |
| **Autonomy Adjustment** | Cumulative performance data meets promotion conditions | As per §42 rules | Autonomy promotion/demotion |

## 56.4 Security Guardrails

- 自动改进**永远不能**放松安全策略或合规控制
- 全自动改进仅限**非风险变更**（few-shot 增加、路由优化、知识刷新）
- 涉及 Prompt 核心逻辑或风控规则的变更必须经人工审核
- 所有自动改进记录到 event_log，可审计可回滚

---

# 57. External System Integration Framework

> v2.5 新增。提供标准化连接器框架和预构建连接器目录，使 Agent 能对接真实业务系统。
> 关联：§14.4 Executor · §11.5 出站控制 · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 Connector Abstraction

```typescript
interface Connector {
  connector_id: string;
  name: string;
  category: ConnectorCategory;
  auth_method: "oauth2" | "api_key" | "basic" | "certificate" | "custom";
  capabilities: ConnectorCapability[];
  rate_limits: RateLimitSpec;
  data_classification: string;             // 该连接器涉及的数据分级
  health_check: HealthCheckConfig;
}

type ConnectorCategory =
  | "payment"          // 支付: Stripe, 支付宝, 微信支付
  | "ecommerce"        // 电商: Shopify, 有赞, 拼多多
  | "crm"              // CRM: Salesforce, 飞书 CRM
  | "communication"    // 通信: 邮件, 短信, 企微, 飞书, 钉钉
  | "social_media"     // 社交: 微信, 抖音, 微博, 小红书
  | "finance"          // 财务: 用友, 金蝶, SAP
  | "storage"          // 存储: OSS, S3, Google Drive
  | "devtools"         // 开发: GitHub, GitLab, Jira
  | "analytics"        // 分析: Google Analytics, 神策
  | "ai_service"       // AI: OpenAI, Anthropic, 百度文心
  | "database"         // 数据库: MySQL, PostgreSQL, MongoDB
  | "custom";          // 自定义 API

interface ConnectorCapability {
  capability_id: string;
  operations: ("read" | "write" | "subscribe" | "webhook")[];
  schema: Record<string, unknown>;         // 输入输出 schema
}
```

## 57.2 Connector Lifecycle

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Install  │────▶│ Configure│────▶│ Authorize│────▶│ Active   │
│ (安装)    │     │ (配置)    │     │ (授权)    │     │ (运行中)  │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                 ┌──────▼─────┐
                                                 │ Monitor    │
                                                 │ (健康监控)  │
                                                 └──────┬─────┘
                                                        │ 异常
                                                 ┌──────▼─────┐
                                                 │ Degrade/   │
                                                 │ Reconnect  │
                                                 └────────────┘
```
## 57.3 Pre-built connector directory (Phase 1)
| Category | Connector | Priority | Capabilities |
|------|-------|--------|------|
| Communication | Feishu/Qiwei/DingTalk | P0 | Message sending, approval push, calendar reading |
| Communication | Email (SMTP/IMAP) | P0 | Send, receive, search |
| Storage | Alibaba Cloud OSS / S3 | P0 | Upload, download, list |
| Development | GitHub/GitLab | P0 | PR, Issue, Code Search |
| Database | MySQL/PostgreSQL | P0 | Query, write |
| Social | WeChat public account | P1 | Message push, menu management |
| E-commerce | Youzan | P1 | Order inquiry, product management |
| Finance | UFIDA | P1 | Voucher query, report export |
| Analysis | Shence | P1 | Event query, user portrait |
| Payment | Alipay/WeChat Pay | P2 | Order, refund, inquiry |

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

社区和企业内部团队可通过 Connector SDK 开发自定义连接器，发布到 Marketplace(§55)。

---

# 59. Agent Explainability and Decision Transparency Architecture

> v2.6 新增。为每个 Agent 决策构建面向用户的因果解释能力，满足 EU AI Act / GDPR Article 22 合规要求，并为渐进式自主权(§42)提供信任基础。
> 关联：§12.7 Tracing · §13 OAPEFLIR · §17 质量门禁 · §23.6 数据血缘 · §39 NL 入口 · §42 渐进式自主权

## 59.1 Design Principles

* 每个 OAPEFLIR 循环的每个阶段**必须**生成 `StageRationale` 记录
* 解释按需生成（lazy），不增加正常执行路径开销
* 解释深度按领域配置：金融需要 forensic-level，客服需要 summary-level
* 解释缓存避免重复 LLM 调用
* 解释不可篡改，纳入 Evidence Plane

## 59.2 Explanation Pipeline

```text
用户问"为什么？"
    │
    ▼
ExplanationRequest { workflow_id, step_id?, depth }
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← 从 P5 收集 StageRationale + ToolCallLog + KnowledgeCitation
└────────┬────────┘
         ▼
┌─────────────────┐
│ CausalChainBuilder│  ← 构建 Observe→Assess→Plan→Execute 的因果链
└────────┬────────┘
         ▼
┌─────────────────┐
│ ExplanationRenderer│  ← 按 depth 和 locale 渲染为 NL 文本
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
## 59.4 Depth Grading Explained
| Depth | Applicable scenarios | Content |
|------|---------|------|
| L1 Summary | Daily review by non-technical users | One-sentence summary: "Because abnormal traffic was detected, 2 instances were automatically expanded" |
| L2 Reasoning | Business Owner Review | Cause and Effect Chain + Key Data Points + Alternatives |
| L3 Forensic | Compliance audit / Incident investigation | Complete evidence chain + all input and output + knowledge reference + model call details |

## 59.5 Integration with NL Entry

§39 NL 交互管线增加 `why` Intent 类型：

```typescript
interface WhyQuery {
  target: { workflow_id: string; step_id?: string };
  depth: "summary" | "reasoning" | "forensic";
  locale: string;
}
```

用户可通过自然语言问"上次发布为什么回滚了？"，系统解析为 WhyQuery 并调用解释管线。

## 59.6 Explanation Cache and Security

* L1/L2 解释缓存 TTL = 24h，L3 不缓存（确保最新证据）
* 解释内容受 §50 知识域隔离约束——只能看到自己有权限的证据
* 解释日志本身纳入审计(§23)，记录谁在什么时候查看了什么解释

---

# 60. Emergency Braking and Global Circuit Breaker Architecture

> v2.6 新增。提供单一原子操作在 < 5 秒内停止全平台所有 Agent 执行，用于安全事件、Prompt injection 攻击、Agent 逃逸等紧急场景。
> 关联：§9 稳定性 · §10 风险控制 · §11 安全 · §12 异常事件 · §52 多 Region

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
    ├──▶ P1 Interface Plane: 拒绝所有新请求(503), 关闭 WebSocket
    │
    ├──▶ P2 Control Plane: 撤销所有 active Agent token
    │
    ├──▶ P3 Orchestration Plane: 挂起所有 in-flight OAPEFLIR 循环
    │
    ├──▶ P4 Execution Plane: 中止所有 worker, 回滚未提交 side effect
    │
    ├──▶ P5 State Plane: 生成 ForensicSnapshot, 设置 read-only 模式
    │
    └──▶ X1 Fabric: 阻断所有 egress, 触发告警到所有渠道
```
**SLA**: From the time the Directive is issued to the confirmation stop on all planes < 5 seconds (same region), < 15 seconds (cross-region). 

## 60.3 Safe Recovery Protocol
| Steps | Actions | Requirements |
|------|------|------|
| 1 | ForensicSnapshot Review | Security Team Confirms Threat Neutralized |
| 2 | PlatformResumeDirective release | Requires ≥ 2 platform_admin double approval |
| 3 | Gradual recovery | Recover read-only queries first → low-risk workflow → full recovery |
| 4 | Post-Incident Report | Post-Incident Report issued within 72h |

## 60.4 Regular Drills

* 每季度至少一次紧急制动演练（选定 tenant 范围）
* 演练结果纳入 §36 成功标准
* 演练期间产生的 ForensicSnapshot 用于验证取证完整性

---

# 61. Agent Unified Lifecycle Management Architecture

> v2.6 新增。将 Agent 建模为一等实体——Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config 的复合体，管理从创建到退役的完整生命周期。
> 关联：§16 Prompt · §30 Pack · §42 渐进式自主权 · §41 主动式 Agent · §55 Marketplace

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

| Conversion | Trigger Condition | Access Control |
|------|---------|------|
| draft→testing | Developer submission | All component versions locked |
| testing→staging | Test passed | §17 Quality access control + security scan |
| staging→canary | pre-release approval | domain administrator approval |
| canary→active | Grayscale indicator meets standard | Automatic promotion (error rate < threshold + performance standard) |
| active→paused | Manual/automatic pause | Behavior drift detection (§63) trigger or manual operation |
| active→deprecated | Version replacement/business change | Responsibility transfer to new version completed |
| deprecated→archived | TTL expired | All historical references marked as archived |

## 61.4 Composite Grayscale Release

Agent 灰度以 AgentVersion 为单位（非单组件）：

* **流量分割**：canary 版本接收 5%→20%→50%→100% 流量
* **复合回滚**：一键回退到上一个 AgentVersion（所有组件原子回退）
* **比较测试**：对同一输入同时运行两个 AgentVersion，比较输出差异

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

> v2.6 新增。支持工厂车间、零售门店、移动设备等间歇连接场景下的 Agent 执行，以本地优先+最终同步模式运行。
> 关联：§15 ModelGateway · §32 部署 · §52 多 Region · §10 风险控制

## 62.1 EdgeRuntime Minimal Runtime

```text
┌─────────────────────────────────────────┐
│  EdgeRuntime（本地设备/门店服务器）          │
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
         ▲ 连接恢复时 ▼
┌─────────────────────────────────────────┐
│  Central Platform (Cloud)               │
│  P1 + P2 + P3 + P4 + P5 + X1           │
└─────────────────────────────────────────┘
```
## 62.2 Offline execution constraints
| Constraints | Description |
|------|------|
| Risk upper limit | Offline mode only allows actions with risk_level ≤ medium |
| Model downgrade | Use local sLLM (such as Qwen-7B/Llama-3-8B), do not call the cloud ModelGateway |
| Side effects queuing | All side effects are written to the local SyncQueue and submitted in batches after the connection is restored |
| Approval pending | Steps that require approval enter the pending state, waiting for the connection to be restored |
| Cache plan | EdgeRuntime periodically pre-pulls the ExecutionPlan template from Central |

## 62.3 同步协议

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
**Conflict Resolution Principle**: Central status is the authoritative source; if a side effect during offline conflicts with Central, by default Central wins + generate Incident for manual review. 

## 62.4 Deployment Mode
| Mode | Hardware Requirements | Applicable Scenarios |
|------|---------|---------|
| Edge-Micro | ARM/x86 single board computer, 4GB RAM | Retail store POS, IoT gateway |
| Edge-Standard | 8C/32GB server | Factory workshop, warehouse |
| Edge-Mobile | iOS/Android App | Mobile field service, on-site service |
| Hybrid | Local GPU Server | High-throughput scenarios requiring local inference |

---

# 63. Agent Behavior Drift Detection Architecture

> v2.6 新增。超越单维度质量指标，建立多维行为画像和长周期变点检测，在 Agent 行为渐变导致业务风险前发出预警。
> 关联：§17 质量门禁 · §42 渐进式自主权 · §43 看板 · §56 反馈改进

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
## 63.2 Change point detection engine
| Window | Detection Algorithm | Sensitivity | Usage |
|------|---------|--------|------|
| 1h sliding window | Z-Score anomaly detection | High | Mutation (after model update, Prompt change) |
| 7d sliding window | CUSUM | Medium | Short-term trend (impact of knowledge base changes) |
| 30d Sliding Window | Bayesian Online Changepoint | Medium | Monthly Drift (Changes in Business Environment) |
| 90d sliding window | Drift Distance (KL/JS divergence) | Low | Long term baseline drift |

## 63.3 Drift Response Strategy

```text
BehaviorDriftAlert { agent_id, dimension, severity, drift_score }
    │
    ├── severity=low  → 记录到 §43 看板，标记 "drift_warning"
    │
    ├── severity=medium → 通知域管理员 + 自动降低 autonomy_level 一级(§42)
    │
    └── severity=high → 暂停 Agent(§61 paused) + 触发 Incident(§12) + 要求人工审查
```

## 63.4 Cross-Agent Anomaly Detection

同一 DomainDescriptor 下的多个 Agent 形成对照组。当一个 Agent 的行为指纹与对照组显著偏离时，即使该 Agent 自身没有触发单 Agent 阈值，也应发出 `CrossAgentDriftAlert`。

---

# 64. Cost Attribution and Optimization Engine

> v2.6 新增。在 §18 成本计量的基础上，增加决策级成本归因、自动优化建议、What-if 仿真，使成本数据从"可看"变为"可行动"。
> 关联：§18 成本管理 · §15 ModelGateway · §43 看板 · §54 SLA

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
## 64.2 Automatic optimization suggestions
| Recommendation type | Test conditions | Recommendation content | Expected savings |
|---------|---------|---------|---------|
| ModelDowngrade | Low-risk step using high-end models | Switch to cost_optimized routing | 30-60% |
| CacheHit | Repeated calls to the same query | Enable semantic cache | 40-80% |
| TokenTrim | 平均 input_tokens > 4x output_tokens | 优化 Prompt 或启用 context compression | 20-40% |
| BatchMerge | Multiple independent steps can be merged | Merged into a single LLM call | 50-70% |
| ScheduleShift | Non-urgent tasks are executed during peak hours | Scheduled to low-cost times | 10-30% |

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
## 64.4 Cost Kanban Integration 

§43 The "Cost Intelligence" panel is added to the unified operation dashboard: 

* Top 10 high-cost Agent/Domain/Workflow this month 
* Actionable savings opportunities (sorted by expected savings) 
* Cost trends versus budget 
* What-if simulation entrance 

--- 

# 65. Workflow visual debugger architecture 

> New in v2.6. Provides visual debugging and inspection capabilities for running/completed workflows, and supports real-time execution tracking, OAPEFLIR step-in debugging, and time travel playback. 
> Related: §12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow Builder · §59 Interpretability 

## 65.1 Debugger capability matrix
| Capabilities | Running Workflow | Completed Workflow | Description |
|------|---------------|----------------|------|
| Execution timeline | ✓ (real-time) | ✓ | Start/end/status visualization of each step |
| OAPEFLIR Step into | ✓ | ✓ | Expand a single step to view details of each stage of O/A/P/E/F/L/I/R |
| Data flow view | ✓ | ✓ | Input/output data flow between steps |
| Side Effects Diff | ✗ | ✓ | Expected Side Effects vs Actual Side Effects |
| Breakpoint debugging | ✓ | ✗ | Pause execution at the specified step and continue after manual inspection |
| Time travel | ✗ | ✓ | Replay execution from any checkpoint |
| Run comparison | ✗ | ✓ | Side-by-side comparison of two runs |

## 65.2 Real-Time Execution Flow

```text
WebSocket /ws/v1/debug/{workflow_id}
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Timeline View                                           │
│  ┌────┐  ┌────┐  ┌────┐  ┌─────┐  ┌────┐               │
│  │ S1 │─▶│ S2 │─▶│ S3 │─▶│ S4  │─▶│ S5 │  ← 当前执行位置│
│  │ ✓  │  │ ✓  │  │ ▶  │  │ ... │  │ ...│               │
│  └────┘  └────┘  └────┘  └─────┘  └────┘               │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ OAPEFLIR 展开│                             │
│              │ O: 收集到 3 个信号                          │
│              │ A: 风险评分 0.4 (medium)                    │
│              │ P: 选择方案 B (理由:...)                     │
│              │ E: ▶ 执行中...                              │
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

# 66. Compliance Report Automatic Generation Engine

> v2.6 新增。将平台收集的证据自动组装为审计就绪的合规报告，支持 SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS 等多框架。
> 关联：§23 合规 · §49 分部门合规 · §12 异常事件 · §50 知识隔离

## 66.1 Report Template Registry

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
│ EvidenceCollector│  ← 从 P5、审计日志、配置快照、metrics 收集证据
└────────┬────────┘
         ▼
┌─────────────────┐
│ ControlMapper   │  ← 将证据映射到控制点，标记 pass/fail/partial
└────────┬────────┘
         ▼
┌─────────────────┐
│ GapAnalyzer     │  ← 识别证据不足的控制点，生成补救建议
└────────┬────────┘
         ▼
┌─────────────────┐
│ ReportRenderer  │  ← 按框架模板生成 PDF + CSV + JSON
└────────┬────────┘
         ▼
ComplianceReport { framework, period, controls_passed, controls_failed, gaps[], export_urls }
```
## 66.3 Report Type and Frequency
| Framework | Frequency | Scope | Typical Consumer |
|------|------|------|-----------|
| SOC2 Type II | Quarterly | All Platforms | Auditor/Client |
| SOX 302/404 | Quarterly | Financial Domain | CFO/External Audit |
| HIPAA | Monthly | Healthcare Domain | HIPAA Officer |
| GDPR | Monthly | All Platforms | DPO |
| PCI-DSS | Quarterly | Payment Domain | QSA |
| ISO 27001 | Half a Year | Full Platform | CISO |

## 66.4 审计员只读访问

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

> New in v2.6. Predictive capacity modeling based on historical trends supports expansion timing recommendations, cost trend forecasts, and what-if capacity simulations. 
> Relevance: §18 Cost · §27 SLO · §43 Kanban · §54 SLA · §64 Cost Optimization 

## 67.1 Resource dimension tracking
| Dimension | Collection source | Warning threshold |
|------|---------|---------|
| Number of concurrent workers | P4 Execution Plane | Current capacity 80% |
| Storage usage | P5 State Plane | Current capacity 85% |
| LLM Token consumption/day | §18 CostTracker | Monthly budget 70% |
| API QPS | P1 Interface Plane | 当前容量 75% |
| Event Log Growth Rate | P5 Event Store | Storage Capacity 80% |
| Queue Depth | P4 Fair Queue | Average Waiting Time > SLA 50% |

## 67.2 预测模型

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

## 67.3 What-if 容量仿真

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

## 67.4 财务预算支持

* 月度成本趋势报告（实际 vs 预算 vs 预测）
* 季度容量规划建议（面向财务团队审批预算）
* 年度 TCO 预测（含硬件 + LLM API + 人力成本）

---

# 68. 多模态能力架构

> v2.6 新增。扩展 ModelGateway 支持图像、语音、文档等多模态输入/输出，使平台能承接素材制作、客服图片处理、语音交互等场景。
> 关联：§15 ModelGateway · §26 存储 · §37 业务域 · §39 NL 入口

## 68.1 多模态 ModelGateway 扩展

```typescript
interface MultimodalModelGateway extends ModelGateway {
  analyzeImage(req: ImageAnalysisRequest): Promise<ImageAnalysisResponse>;
  generateImage(req: ImageGenerationRequest): Promise<ImageArtifact>;
  speechToText(req: SpeechToTextRequest): Promise<TranscriptionResponse>;
  textToSpeech(req: TextToSpeechRequest): Promise<AudioArtifact>;
  parseDocument(req: DocumentParseRequest): Promise<StructuredDocument>;
}
```

## 68.2 多模态 ModelRequest 扩展

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

| Modal | Default Provider | Fallback | Cost Model |
|------|-------------|----------|---------|
| Text LLM | GPT-4o / Claude | Qwen / DeepSeek | per-token |
| Image Analysis | GPT-4o Vision / Claude Vision | Qwen-VL | per-image |
| Image Generation | DALL-E 3 / Midjourney API | Stable Diffusion (self-hosted) | per-image |
| Speech-to-Text | Whisper API | Paraformer (self-hosted) | per-minute |
| Text-to-Speech | Azure TTS / ElevenLabs | CosyVoice (self-hosted) | per-character |
| Document Parse | Document Intelligence | Marker / Docling (self-hosted) | per-page |

## 68.4 多模态安全

* 图像输入经过 content moderation（色情/暴力/敏感信息检测）
* 生成图像附带 C2PA 元数据水印
* 语音输入 PII 检测（电话号码、身份证号自动脱敏）
* 文档解析结果受 §50 知识域隔离约束

## 68.5 多模态成本追踪

§18 CostTracker 扩展 `modality` 维度：

```typescript
interface MultimodalCostRecord extends CostRecord {
  modality: "text" | "image_analysis" | "image_generation" | "stt" | "tts" | "document_parse";
  modality_units: number;
  modality_unit_type: "token" | "image" | "minute" | "character" | "page";
}
```

---

# 69. 平台自运维 Agent 架构

> v2.6 新增。平台使用自身 Agent 能力进行自我运维（dog-fooding），覆盖 Incident 自动诊断、常见故障自修复、配置优化建议、开发者问答。
> 关联：§12 异常事件 · §14 Execution · §37 业务域 · §41 主动 Agent · §43 看板

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
## 69.2 Self-operation and maintenance Agent directory
| Agent | Trigger conditions | Ability | Upper limit of autonomy |
|-------|---------|------|-----------|
| IncidentDiagnoser | Incident creates events | Collect logs, analyze root causes, and generate diagnostic reports | semi_auto |
| ConfigOptimizer | Weekly timing + performance deviation | Analyze configuration, recommend optimization, estimate impact | supervised |
| CapacityPredictor | Daily timing | Analyze trends, predict bottlenecks, and recommend capacity expansion | supervised |
| DevAssistant | Developer questions | Query documentation, search code, generate examples | semi_auto |
| HealthMonitor | Continuous operation | Inspect platform health and generate daily reports | auto (read-only) |
## 69.3 Safety guardrail 

* All production environment write operations **must** be manually approved 
* The ModelGateway call of PlatformOps Agent has independent cost budget and rate limit 
* PlatformOps Agent cannot access business domain data, but can only access platform operation and maintenance data. 
* All operations of PlatformOps Agent are included in the independent audit flow (§23) and are isolated from business audit 

## 69.4 Self-operation and maintenance maturity level
| Level | Description | Human Engagement |
|------|------|-----------|
| L0 | Pure manual operation and maintenance, Agent only assists document query | 100% |
| L1 | Agent generates diagnostic reports, manual decision-making and execution | 80% |
| L2 | Agent generates a repair plan and pre-executes verification, and manually confirms it with one click | 40% |
| L3 | Agent automatically handles P3/P4 level problems, P1/P2 still requires manual labor | 15% |
Initial deployment starts at L0, with progression through §42 progressive autonomy. 

--- 

# 70. Conclusion 

This is not "an Agent platform that does things automatically", but: 

> **An enterprise operating system that treats Agents as high-risk automation units for strict control, isolation, recovery, auditing and governance - from a one-person company to an enterprise with 10,000 people, a seven-layer architecture covering infrastructure, AI operations, business domain access, intelligent interaction, organizational governance, large-scale ecology, and operational maturity with full-stack capabilities. ** 

Its core is not "multi-intelligence", but: 

* Conservative by default 
* High risks must be controlled 
*Exceptions must be classified and handled 
* Execution must be resumable 
* The state must be replayable 
* Behavior must be auditable 
* Platform must be downgradeable 
* The service must be pluggable but cannot bypass the base 
* **The business domain must be understood in a structured manner rather than as an opaque black box** 
* **Non-technical users must be able to use it directly without understanding the underlying architecture** 
* **Organizational governance must adapt to the corporate hierarchy rather than assuming a flat structure** 
* **Large-scale operation must have fair resource scheduling and SLA differentiation guarantee** 
* **Agent decisions must be explainable and behavioral drift must be detectable** 
* **The platform must be able to brake in an emergency, and the Agent must have a unified life cycle** 
* **Offline/edge scenarios must be operable, disconnection does not mean shutdown** 
* **Multi-modal input and output must be included in unified security control, and content review cannot be bypassed** 

### Overview of seven-layer architecture evolution
| Layers | Versions | Problem Solving | Core Chapters |
|------|------|---------|---------|
| Infrastructure layer | v2.0 | How to build the platform | §4-§14, §24-§32 |
| AI operation layer | v2.1 | How AI operates | §15-§23 |
| Business domain access layer | v2.2 | How to connect the business | §37-§38 |
| Intelligent interaction layer | v2.3 | How users use it | §39-§44 |
| Organizational governance layer | v2.4 | How the organization is managed | §46-§51 |
| Scaled operation layer + ecological layer | v2.5 | How to achieve scale + how to build an ecosystem | §52-§57 |
| Operational Maturity Layer | v2.6 | How to use it well + How to run it safely | §59-§69 |
### v2.6 Operational Maturity Layer Capability Summary
| Issues | v2.5 | v2.6 |
|------|------|------|
| How do users understand Agent decisions? | Audit logs only | §59 Explainability and Decision Transparency |
| How to stop a security incident urgently? | Kill one by one | §60 Emergency braking and global fuse |
| How to manage Agent as a whole? | Components are managed individually | §61 Unified life cycle management |
| How to run offline/edge scenarios? | Not supported | §62 Offline and edge deployment |
| How to detect agent behavior gradient? | Quality threshold only | §63 Behavioral drift detection |
| How to optimize costs? | Measurement only | §64 Cost Attribution and Optimization Engine |
| How to debug Workflow failure? | See original log | §65 Visual debugger |
| How to issue a compliance report? | Manual sorting | §66 Compliance report automatically generated |
| When should we expand? | Just guessing | §67 Capacity planning and cost forecasting |
| How to process pictures/voices/documents? | Not supported | §68 Multi-modal capabilities |
| How to operate and maintain without an SRE team? | Purely manual | §69 Platform self-operation and maintenance Agent |
Only by having the stability of the infrastructure layer, the controllability of the AI ​​operation layer, the structuring of the business domain access layer, the ease of use of the intelligent interaction layer, the adaptability of the organizational governance layer, the scalability of the large-scale operation layer, and the launchability of the operational maturity layer can enterprises upgrade the Agent platform from architectural design to an enterprise-level productivity operating system that truly covers companies with one person to companies with ten thousand people, and 12+ vertical business lines. 

--- 

#Appendix G: Glossary and abbreviation index
| Abbreviation/term | Full name | Description |
|-----------|------|------|
| OAPEFLIR | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Recover | Eight stages of the Agent core loop (§13) |
| HITL | Human-In-The-Loop | Human-machine collaboration mode, human participation in the Agent decision-making chain (§21) |
| DLQ | Dead Letter Queue | Dead letter queue, temporary storage area for messages/events that cannot be processed (§28.6) |
| CAS | Compare-And-Swap | Optimistic concurrency control primitive for StateCommand idempotent writes (§5.4) |
| SLO / SLA | Service Level Objective / Agreement | Service Level Objective / Agreement (§27, §54) |
| SEV1-4 | Severity 1-4 | Event Severity Rating (1 is the highest) (§12) |
| TTFT | Time To First Token | LLM streaming response first token arrival delay (§27.7) |
| SCC | Standard Contractual Clauses | GDPR Standard Contractual Clauses, legal mechanism for cross-border data transfers (§52.4) |
| BCR | Binding Corporate Rules | Binding Corporate Rules, intra-group cross-border data transfer mechanism (§52.4) |
| DPIA | Data Protection Impact Assessment | Data Protection Impact Assessment (§52.4) |
| PIPL | Personal Information Protection Law | China Personal Information Protection Law (§52) |
| WCAG | Web Content Accessibility Guidelines | Accessibility Guidelines (§44.6) |
| SCIM | System for Cross-domain Identity Management | Cross-domain Identity Management Protocol (§48) |
| SSO | Single Sign-On | Single Sign-On (§48) |
| RBAC | Role-Based Access Control | Role-Based Access Control (§11) |
| DAG | Directed Acyclic Graph | Directed acyclic graph for goal decomposition and task dependency (§40) |
| Pack | Business Pack | Business domain function package, the deployable unit of Agent (§30) |
| UoW | Unit of Work | Unit of work, atomic boundary of transactional operations |
| WAL | Write-Ahead Log | Write-ahead log, a persistence mechanism to ensure crash recovery (§31) |
| P1-P5 | Plane 1-5 | Five-plane architecture (Interface·Control·Orchestration·Execution·State & Evidence) (§4) |
| X1 | Cross-cutting Fabric | Cross-cutting concerns (Reliability·Governance·Intelligence) (§4) |
| NL | Natural Language | Natural Language (§39) |
| sLLM | Small LLM | Small localized language model for edge/offline scenarios (§62) |
| RTO / RPO | Recovery Time / Point Objective | Recovery Time / Point Objective (§31) |
--- 

#Appendix A: Version change history
| Version | Date | Changes |
|------|------|---------|
| v1.0 | 2026-04 | Initial five-plane architecture + seven-layer stability + OAPEFLIR concept design |
| v1.1 | 2026-04 | Added risk matrix, DLQ model, deployment recommendations |
| v1.2 | 2026-04 | Added data model 44 tables, event namespace, ADR suggestions, recommended directory |
| v2.0 | 2026-04-18 | **Infrastructure Improved Version**: Added inter-plane communication contract (§5), API contract (§6), service communication (§7), scalability (§8), configuration governance (§24), performance SLO (§27), disaster recovery and high availability (§31); improved risk score (§10), OAPEFLIR Interface (§13), Storage Abstraction (§26), Deployment (§32), Roadmap (§33); Addressing 14 design flaws in v1.2 |
| v2.1 | 2026-04-19 | **AI Operation Complete Version**: Added LLM Provider abstraction and failover (§15), Prompt management and versioning (§16), model evaluation and quality access control (§17), cost management and Token measurement (§18), inter-Agent delegation and collaboration (§19), long-term tasks and Workflow Hibernation (§20), human-machine collaboration mode (§21), SDK and developer experience (§22), compliance and data governance (§23); improve API authentication and Webhook (§6), security threat model (§11), alert routing and distributed Tracing (§12), Error Budget and LLM delay (§27), Pack life cycle and Plugin governance (§30); add 9 ADRs; resolve 14 AI operations layer flaws in v2.0 |
| v2.2 | 2026-04-19 | **Business domain access complete version**: New business domain modeling and access architecture (§37) - DomainDescriptor structured domain modeling, DomainRiskProfile domain risk portrait, DomainKnowledgeSchema domain knowledge structure, DomainEvalFramework domain assessment framework, DomainPromptLibrary domain Prompt library, DomainRecipe Domain template prototype, DomainInteractionPolicy cross-domain interaction strategy, DomainGovernancePolicy domain governance model; new business domain access runbook (§38) - four-stage access control process (modeling → development → certification → grayscale); improve the Business Pack model (§30) associated DomainDescriptor; add 4 ADRs; solve 10 business domain access layer defects in v2.1 |
| v2.3 | 2026-04-19 | **Intelligent Interaction Complete Version**: Added natural language task entry architecture (§39), goal decomposition engine architecture (§40), active Agent framework (§41), progressive autonomy model (§42), unified operation dashboard architecture (§43), non-technical user experience architecture (§44); added 6 ADRs; making the platform from "Agent" Infrastructure" upgrade to "Agent Operating System" for non-technical users |
| v2.4 | 2026-04-19 | **Complete version of organizational governance**: New organizational hierarchy model (§46), organizational structure approval routing (§47), enterprise SSO/SCIM integration (§48), sub-department compliance policy engine (§49), knowledge domain isolation and controlled sharing (§50), hierarchical governance delegation (§51); 6 new ADRs; enable the platform to adapt to the organizational complexity from a one-person company to an enterprise with ten thousand people |
| v2.5 | 2026-04-19 | **Scale Ecosystem Complete Version**: Added multi-region deployment architecture (§52), large-scale resource competition management (§53), SLA hierarchical guarantee (§54), Agent market and ecology (§55), feedback-driven continuous improvement pipeline (§56), external system integration framework (§57); added 6 ADRs; completed cross-Region high availability, fair resource scheduling, SLA Differentiated guarantees, open ecology and continuous self-improvement capabilities |
| v2.6 | 2026-04-19 | **Operation Maturity Complete Version**: Added Agent explainability and decision transparency (§59), emergency braking and global circuit breaker (§60), Agent unified life cycle management (§61), offline and edge deployment (§62), Agent Behavioral drift detection (§63), cost attribution and optimization engine (§64), workflow visual debugger (§65), automatic compliance report generation engine (§66), capacity planning and cost prediction (§67), multi-modal capabilities (§68), platform self-operation and maintenance Agent (§69); 11 new ADRs; complete the operational maturity layer from "complete architectural design" to "ready for production operation" |
| v2.7 | 2026-04-19 | **Quality revision**: Fix ADR autonomy level contradiction (monotonic→guarded progression); unify §9.5/§14.8 mode enumeration to 8 mode specification set; complete the missing principal/trace_id field of ExecutionPlan/StateCommand; extend Prompt injection defense architecture (§16.5); fix ADR-NL TaskSpec→RequestEnvelope reference; completes §26 Data Model (44→71 tables) and §28 Event Namespace (17→25); completes §33 Roadmap Phase 5-7; completes §43 L2/L3 Kanban view definition; new §39.7 i18n, §44.6 WCAG, §52.4 GDPR Cross-border transmission, §55.4-55.6 Market revenue/obsolescence/dependency management, §15.6 Streaming error handling; add §40 circular dependency detection, §5.2 P2→P4 communication path; fix §62 typo and §70 conclusion omission; add Appendix G Glossary |
