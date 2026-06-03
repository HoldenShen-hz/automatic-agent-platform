# 12. Cross-Platform UI Unified Architecture (Improved Version)

automatic_agent/automatic-agent-platform-main/docs_zh/architecture/12-cross-platform-ui-architecture-v2.md

> **Document Version**: v4.4
> **Document Status**: Accepted
> **Baseline Documents**: `00-platform-architecture.md` v4.3 five-plane architecture · `contracts/ui_console_and_cockpit_contract.md`
> **Predecessor Documents**: `10-cross-platform-ui-architecture.md` (v1 overview, Superseded) · `11-cross-platform-ui-implementation-design.md` (v1 implementation, Superseded)
> **Audience**: Frontend architects, UI/UX engineers, mobile/desktop developers, QA, DevOps, platform SREs
> **Design Positioning**: The single authoritative UI architecture specification. It fully merges the entire contents of Doc-10 and Doc-11, eliminating version inconsistencies and aligning with backend implementation.

---

## Revision History

| Version | Date       | Author | Change Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2.0 | 2026-04-22 | —    | Merged Doc-10/Doc-11; unified framework versions; aligned with MissionControlService/WebSocketBridge backend implementation; restructured information architecture mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v2.1 | 2026-04-23 | —    | Doc-11 second review backfill: expanded PlatformAdapter interface (clipboard/lifecycle/deepLink/haptics); added Zustand Store interface definition + TanStack Query staleTime strategy; added SharedWorker WebSocket architecture diagram; added offline storage capacity planning table; added keyboard shortcut table + ARIA specification                                                                                                                                                                                                                                                                                                                                                         |
| v2.2 | 2026-04-23 | —    | Expert review revision: introduced four-level status labels (Implemented/Planned/Proposed/Deferred); added desktop hybrid shell governance rules; expanded PlatformAdapter with five capability groups (windowing/shell/process/analyticsConsent/screenSecurity); added page-level permission matrix; added DTO→VM→Props anti-corruption layer specification; added WebSocket subscription domain model; added offline operation permission matrix; expanded DomainUIConfig with four domain governance interface groups; added delivery stage dependency gates; added frontend error classification and degradation strategy; added contract version negotiation; document hygiene cleanup; status Draft→Accepted. Doc-11 high-value content extraction: §4.6 implementation reference blueprint (NL conversation/HITL/Workflow debugger/approval center); §5.4.1-5.4.5 API communication layer details (RESTClient/WSClient/Endpoint pattern/auth flow/offline queue); §6.3 design tokens supplement (primitive.ts) + component development specification; §7.1.4-7.1.5 CI stage details + auto-update strategy; §7.2.4-7.2.5 testing toolchain + coverage requirements |
| v2.3 | 2026-04-23 | —    | Baseline hardening revision: Implemented status split into three sub-labels (Contracted/Internal/Partial); added §5.2.3 Public UI API Surface layering (service method / route / public contract endpoint); added §4.7 Planned module mini-contracts (AgentManager/WorkflowBuilder/WorkflowDebugger/Marketplace/Explainability/CostCenter); added §4.5.4 field-level visibility and redaction matrix (FieldVisibilityPolicy/RedactionRule/PIIHandlingByRole); added §5.6.4 Mutation idempotency and retry specification; document hygiene wrap-up (`[Implemented]`/`[Planned]` unified to replace `[已实现]`/`[需新增]`; service/route/endpoint terminology unified; remediation list appendix E)                                                                                                                                                                     |
| v3.0 | 2026-04-23 | —    | See v3.0 change details below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v3.1 | 2026-04-23 | —    | In-repo `ui/` Monorepo baseline landed: filled in shared core, PlatformAdapter, design tokens, implemented-first feature registry, planned feature seam, Web-buildable app shell, desktop/mobile smoke-ready shell, UI sub-project testing baseline, and `current_todo_list` `UI0-UI7` waves. |
| v3.2 | 2026-04-23 | —    | In-repo `Phase 1-4` code baseline alignment: filled in four first-level features `policy / audit / workers / queues`, enhanced Web grouped navigation, desktop/mobile platform capability tests, and `current_todo_list` `Phase 1-4` stage plan; main text added in-repo alignment snapshot. |
| v4.3 | 2026-05-10 | —    | Current architecture baseline upgrade: body and testing baseline unified and rewritten back to five-plane v4.3, supplemented the canonical handoff of `PlanGraphBundle -> NodeRun -> NodeAttemptReceipt`, and converged the UI's description of the runtime chain from legacy task/workflow narrative to HarnessRun/runtime truth. |
| v4.4 | 2026-05-26 | —    | Alignment with recent code wrap-up: public query interfaces filled in `/api/v1/agents`, `/api/v1/dashboard/metrics`, `/api/v1/explanations`, `/api/v1/marketplace`, `/api/v1/knowledge`, `/api/v1/packs/:packId/versions`, `/api/v1/workflows/builder` and `/api/v1/meta/contract-version`; frontend endpoint catalog unified to `/v1/*` + runtime `baseUrl=/api`; Electron bridge compatible with `AA_ELECTRON` / `__AA_ELECTRON__`. |

#### v3.0 Change Details

**Doc-11 Fully Merged** (Doc-11 officially marked as Superseded by Doc-12 v3.0):

- Absorbed all 27 remaining unique items + 6 page wireframes from Doc-11
- §3.7.3 per-platform implementation strategy table; §3.7.4 adapter injection mechanism (Provider chain)
- §4.4.1 routing table enhancements (permission column + Code Split column); §4.4.2 mobile navigation enhancements (Screen hierarchy + navigation feature table); §4.4.3 permission routing guard chain (5-layer Guard)
- §4.6.5-4.6.10 page wireframes (NL conversation/three-column task/approval/kanban/WF builder/debugger data flow)
- §5.1 status classification table + QueryClient global configuration + offline persistence + data flow pattern diagram; §5.1.1-5.1.5 sub-section numbering
- §5.3.2.1-5.3.2.3 WSEventRouter architecture diagram / event→Query mapping / urgent event handling
- §5.4.6 pagination and filtering standardization; §5.6.5 optimistic update pattern; §5.6.6 HTTP status code→UI behavior mapping
- §6.1.5 domain extension Slot pattern and dynamic loading; §6.2.3 data isolation strategy; §6.3.3 dark mode design rules
- §6.4.2 translation workflow; §6.5.4 CSP policy configuration; §6.5.5 sensitive data handling; §6.6.3 mobile adaptation special considerations
- §7.3.3 per-platform optimization details (Web 9 items / mobile 6 items / desktop 5 items); §7.4 team configuration suggestions; §7.5 risk supplements
- Appendix A expanded 20 endpoints; Appendix D expanded 17 terms

**Governance Enhancements**:

- §1.7 added status label update responsibility mechanism (responsible person / update timing / mandatory validation node matrix)
- §4.7 mini-contract added authoritative source / derived source / projection owner columns
- §5.2.4 added Internal → Contracted API Graduation Matrix (13 data source upgrade checklist + upgrade process)

**Three Major Feature Modules Added**:

- §4.2.7 Agent real-time monitoring center (list + details + heartbeat timeline + load curve + real-time WS strategy + mobile adaptation)
- §4.2.8 Data statistics and analysis platform (multi-level KPI dashboard + 7 chart types + role-adaptive indicator system + DashboardMetricsDTO)
- §4.2.9 Configuration management center (7 sub-pages + complete DTO + operation matrix)
- §4.6.8 Operations dashboard four-layer panel detailed specification expansion (28 panels + data source + chart type + refresh strategy)
- §4.6.11-4.6.13 three new technical solutions (Agent monitoring Hook / statistics chart rendering architecture / configuration sub-page routing + permission matrix editor)
- §4.7.7-4.7.8 added AnalyticsDashboard + ConfigurationCenter mini-contract
- §5.2.2 added 15 Planned API endpoints; routing table added 8 routes

**Full-text Review Fixes**:

- **P0-1**: `/shared/settings/org` ghost route → added organizational structure sub-page to §4.2.9
- **P0-2**: settings `[Implemented/Contracted]` vs ConfigCenter `[Planned]` contradiction → changed to `[Implemented/Partial]`
- **P0-3**: Appendix B missing 13 WS events → all supplemented
- **P0-4**: `nl.clarification_needed` status inconsistency → unified to `[Proposed]`
- **P1-1**: `runtime-decisions` Layer 2 diagram marked `[Deferred]` + footnote
- **P1-2**: 9 unspecced modules → added §4.2.10 implemented module summary
- **P1-3**: feature-flags route ownership → routing table annotated as "configuration management sub-page §4.2.9"
- **P1-4**: §4.5.1 permission matrix added AgentMonitor/Analytics/ConfigCenter 3 rows
- **P1-5**: `compliance_officer` remapped to `domain_admin+`
- **P1-6**: §7.2.5 added v3.0 module testing strategy (ECharts + permission matrix editor)
- **P1-7**: §5.1 sub-section renumbering (5.1.1-5.1.6)
- **P1-8**: added provenance reference note before the table of contents
- **P2-1**: §7.3.4 chart-dense page performance budget
- **P2-2**: §4.2.7-4.2.9 added error handling and offline degradation table
- **P2-3**: §6.4.3.1 complex UI component accessibility special guide
- **P2-4**: §7.3.5 CI build impact assessment
- **P2-5**: mobile navigation added AnalyticsScreen
- **P2-6**: directory tree added `analytics/` directory
- **P2-7**: audit log sub-page annotated as linking to Governance → Audit
- **P2-9**: §5.2.1 added `/api/v1/meta/contract-version` endpoint
- **P2-10**: turbo.json `"pipeline"` → `"tasks"` (Turborepo 2.x)
- Layer 2 diagram added `analytics` module |

---

## 0. Review Summary and Improvement Checklist

> **In-Repo Implementation Notes (2026-04-23)**: The repository has added the `ui/` sub-project as the implementation baseline for this document. The landed content prioritizes `UI0-UI7`: project skeleton, shared core, PlatformAdapter, design system, implemented-first feature registry, planned feature seam, Web build chain, desktop/mobile smoke shell, documentation consistency tests, and the `Phase 1-4` in-repo code baseline written back per `§7.4`.

### 0.0 In-Repo Phase 1-4 Alignment Snapshot (2026-04-23)

| Phase | In-Repo Alignment Status | Current In-Repo Implementation |
| --- | --- | --- |
| Phase 1 — Web MVP | Baseline landed | `apps/web` is buildable and runnable; `dashboard / task-cockpit / workflow-cockpit / approval / stability / alerts / dispatch / inspect / health / incidents / policy / audit / takeover / workers / queues / conversation / hitl / domain-wizard / settings` are in the Web route registry and route guard, and aligned with the read-only presentation surface of `HarnessRun / PlanGraphBundle / NodeAttemptReceipt` |
| Phase 2 — Desktop | Baseline landed | `apps/electron-win / apps/tauri-macos / apps/tauri-linux` provide shell manifest, default adapter, shared runtime reuse, and smoke test; `windowing / shell / process / analyticsConsent` have PlatformAdapter baseline / test double |
| Phase 3 — Mobile | Baseline landed | `apps/mobile` provides Android/iOS shell manifest, default adapter, deepLink / haptics / secure storage / screen security baseline, and smoke test |
| Phase 4 — Enhanced Features | Baseline landed | `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance` have entered in-repo implementation through typed seam + feature gate; enhanced modules continue to evolve per the main text status labels, with the constraint that execution handoff must use `PlanGraphBundle` and execution receipts must chain back to `NodeAttemptReceipt` |

Supplementary notes:

- The `UIR1-UIR6` in-repo remediation for [architecture-design-vs-implementation-review.md](../reviews/architecture-design-vs-implementation-review.md) is complete.
- The current UI sub-project provides the `npm install && npm run typecheck && npm test && npm run build` closed-loop scripts.
- Desktop and mobile are accepted on a "smoke-ready project baseline"; store release, signing, and real native bridge are not disguised as in-repo closed loops.

This document is based on a full review of Doc-10 (1229 lines) and Doc-11 (2341 lines), as well as cross-validation against the backend Interface Plane implementation, identifying the following 12 improvements, each of which is landed in this document.

### 0.1 Cross-Document Duplication Issues

| #   | Issue                                                                                                        | Impact                         | Document Improvement                                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| R-1 | Tech selection (React 19 / Zustand / TanStack Query / pnpm / Turborepo) is nearly column-for-column duplicated in Doc-10 §10.4 and Doc-11 §3 | Maintenance cost doubled; changes to one place miss the other | Merged into a single §2 tech selection, eliminating duplication               |
| R-2 | Monorepo directory structure is written in Doc-10 §10.5 and Doc-11 §5.1, with Doc-11 more detailed but containing subdirectories not covered by Doc-10         | Two directory trees of different granularity cause confusion | Merged into a single §3 project structure, using Doc-11 detailed version as the baseline |
| R-3 | Authentication flow is fully described in both Doc-10 §10.8 and Doc-11 §20, with highly overlapping content                                            | Same as above                         | Merged into §6.5 Authentication and Session Security                     |
| R-4 | Feature module list is defined in both Doc-10 §10.5 features/ and Doc-11 §8 core page blueprint                                   | Module naming and grouping not fully consistent     | Merged into §4 Feature Module Blueprint                         |

### 0.2 Version Inconsistencies

| #   | Issue              | Doc-10 Value    | Doc-11 Value | Document Unified Value | Reason                                                   |
| --- | ----------------- | ------------ | --------- | ------------ | ------------------------------------------------------ |
| V-1 | Electron version     | 33           | 34        | **34.x**     | Doc-11 is a later document, adopting the newer version; Electron 34 is stable |
| V-2 | React Native version | 0.76         | 0.79      | **0.79**     | Same as above; RN 0.79 enables New Architecture by default with better performance      |
| V-3 | Vite version         | Major not specified | 6         | **6.x**      | Explicitly locked                                               |
| V-4 | TypeScript version   | 5.x          | 5.8+      | **5.8+**     | Aligned with backend tsconfig                                   |

### 0.3 Backend Alignment Gaps

| #   | Issue                                                  | Detail                                                                                                                                                                                   | Document Improvement                                                            |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A-1 | Unclear mapping between UI feature modules and UI contract pages                     | Contract defines 5 pages (TaskCockpit/WorkflowCockpit/ApprovalCenter/StabilityPanel/AdminTakeoverConsole); Doc-10/11 defines 14 features modules, with no explicit mapping                                        | §4 added explicit mapping table                                                     |
| A-2 | REST API endpoints include hypothetical ones                             | This gap was closed on 2026-05-26; `/api/v1/agents`, `/api/v1/dashboard/metrics`, `/api/v1/explanations`, `/api/v1/marketplace`, `/api/v1/knowledge`, `/api/v1/packs/:packId/versions`, `/api/v1/workflows/builder`, `/api/v1/meta/contract-version` now have backend exports | §5.2, §5.2.3, §5.2.4 unified back to the current real state |
| A-3 | WebSocket event type inconsistency                              | Backend `TaskWebSocketEvent` defines 6 event types (status_changed/progress/message_delta/artifact_ready/approval_requested/completed/failed); Doc-10 §10.6.3 lists 15 UI events, most with no backend correspondence | §5.3 layered by [Implemented]/[Planned]                                  |
| A-4 | MissionControlService provided views not referenced in UI documents    | `getSnapshot()`/`getTaskCockpit()`/`getWorkflowCockpit()`/`getStabilityPanel()`/`getAdminTakeoverConsole()`/`listApprovalQueue()` are ready-made backend entry points                                       | §4 each page blueprint directly references MCS methods                                        |
| A-5 | Console information architecture (contract §3) does not align with features module grouping | Contract defines 4 navigation groups (Mission Control/Operations/Governance/Admin); Doc-10/11 lays out by features                                                                                           | §4.1 adopts the contract information architecture as the first-level navigation                                     |

### 0.4 Insufficient Design Depth

| #   | Issue                                                                       | Document Improvement                                         |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| D-1 | Offline architecture strategy is vague on the Web side (IndexedDB vs Service Worker cache not layered)      | §5.5 defines Web offline three-layer strategy                         |
| D-2 | The 24-domain differentiated UI engine and backend DomainDescriptor/DomainUIConfig alignment is not defined | §6.1 defines DomainUIConfig consumption protocol                  |
| D-3 | The 5-level drilldown (L1-L5) required by the contract has no specific design at the UI component layer                         | §4.2 defines drilldown component trees for TaskCockpit/WorkflowCockpit |

---

## Table of Contents

> **Reference Note**: References of the form "extracted from Doc-11 §24.1" in the body, with `§` references pointing to the original section numbers in the now-Superseded `11-cross-platform-ui-implementation-design.md` (section numbers > 8), are used only for provenance annotation; cross-references within the document use the section numbers of this document.

**Part I — Overall Design (§1-§2)**

1. [Design Overview and Positioning](#1-design-overview-and-positioning)
   - 1.7 Status Label Convention _(added v2.2)_ + Status Label Update Responsibility Mechanism _(added v3.0)_
   - 1.8 Contract Version Negotiation _(added v2.2)_
2. [Six-Platform Tech Selection](#2-six-platform-tech-selection)
   - 2.6 Desktop Hybrid Shell Governance Rules _(added v2.2)_

**Part II — Project Foundation (§3)**

3. [Monorepo Project Structure and Layered Architecture](#3-monorepo-project-structure-and-layered-architecture)
   - 3.7.1 PlatformAdapter Interface _(expanded v2.2: windowing/shell/process/analyticsConsent/screenSecurity)_
   - 3.7.3 Per-Platform Implementation Strategy _(added v3.0, extracted from Doc-11 §7.2)_
   - 3.7.4 Adapter Injection Mechanism _(added v3.0, extracted from Doc-11 §7.3)_

**Part III — Feature Modules (§4)**

4. [Feature Module Blueprint and UI Contract Alignment](#4-feature-module-blueprint-and-ui-contract-alignment)
   - 4.2.7 Agent Real-Time Monitoring Center _(added v3.0)_
   - 4.2.8 Data Statistics and Analysis Platform _(added v3.0)_
   - 4.2.9 Configuration Management Center (Permissions/Feature Flags/Model Configuration/Domain Settings/Tenant/Webhook) _(added v3.0)_
   - 4.2.10 Implemented Module Summary _(added v3.0)_
   - 4.5 Page-Level Permission Matrix _(added v2.2)_
   - 4.4.1 Web/Desktop Routing Table (with permission column + Code Split column) _(enhanced v3.0)_
   - 4.4.2 Mobile Navigation Structure (with Screen hierarchy + feature table) _(enhanced v3.0)_
   - 4.4.3 Permission Routing Guard Chain _(added v3.0, extracted from Doc-11 §9.3)_
   - 4.6 Implementation Reference Blueprint _(added v2.2, extracted from Doc-11)_
     - 4.6.1 NL Conversation State Machine → UI Mapping
     - 4.6.2 HITL Operation Panel and Recovery Modes
     - 4.6.3 Workflow Debugger Capability Matrix
     - 4.6.4 Approval Center Interaction Features
     - 4.6.5-4.6.10 Page Wireframes _(added v3.0, extracted from Doc-11 §8)_
     - 4.6.11-4.6.13 Agent Monitoring/Statistics Platform/Configuration Management Technical Solution _(added v3.0)_
   - 4.7 Planned Module Mini-Contract _(added v2.3)_ + authoritative/derived source columns _(added v3.0)_
     - 4.7.7 AnalyticsDashboard _(added v3.0)_
     - 4.7.8 ConfigurationCenter _(added v3.0)_

**Part IV — Data and Communication (§5)**

5. [Data Flow, API Integration and Real-Time Layer](#5-data-flow-api-integration-and-real-time-layer)
   - 5.1.1 Zustand Store / 5.1.2 TanStack Query / 5.1.3 QueryClient / 5.1.4 Offline Persistence / 5.1.5 Data Flow Pattern _(renumbered v3.0)_
   - 5.1.6 ViewModel Mapping Specification _(added v2.2, original §5.1.4 renumbered)_
   - 5.2.3 Public UI API Surface Layering _(added v2.3)_
   - 5.2.4 Internal → Contracted Upgrade Checklist (API Graduation Matrix) _(added v3.0)_
   - 5.3.6 WebSocket Subscription Domain Model _(added v2.2)_
   - 5.4.1–5.4.5 API Communication Layer Details _(added v2.2, extracted from Doc-11 §6.1-6.3)_
   - 5.5.6 Offline Operation Permission Matrix _(added v2.2)_
   - 5.3.2.1-5.3.2.3 WSEventRouter Architecture/Event→Query Mapping/Urgent Events _(added v3.0)_
   - 5.4.6 Pagination and Filtering Standardization _(added v3.0, extracted from Doc-11 §12.2)_
   - 5.6 Frontend Error Classification and Degradation Strategy _(added v2.2)_
   - 5.6.4 Mutation Idempotency and Retry Specification _(added v2.3)_
   - 5.6.5 Optimistic Update Pattern _(added v3.0, extracted from Doc-11 §12.3)_
   - 5.6.6 HTTP Status Code→UI Behavior Mapping _(added v3.0, extracted from Doc-11 §12.4)_

**Part IV-b — Permissions and Redaction (§4 Extensions)**

- 4.5.4 Field-Level Visibility and Redaction Matrix _(added v2.3)_

**Part V — Platform Governance (§6)**

6. [Domain Differentiation, Multi-Tenancy, Security and Design System](#6-domain-differentiation-multi-tenancy-security-and-design-system)
   - 6.1.2 DomainUIConfig Type Definition _(expanded v2.2: featureVisibility/actionPolicy/defaultDrillDepth/glossaryOverrides)_
   - 6.1.5 Domain Extension Slot Pattern and Dynamic Loading _(added v3.0, extracted from Doc-11 §10.3-10.4)_
   - 6.2.3 Data Isolation Strategy _(added v3.0, extracted from Doc-11 §22.3)_
   - 6.3.1 Design Tokens _(supplemented v2.2 primitive.ts)_
   - 6.3.2 Core Component Library _(added v2.2, extracted from Doc-11 §15.2)_
   - 6.3.3 Theme System (with Dark Mode Design Rules) _(added v3.0, extracted from Doc-11 §16.3)_
   - 6.4.2 Language Priority (with Translation Workflow) _(added v3.0, extracted from Doc-11 §17.3)_
   - 6.4.3.1 Complex UI Component Accessibility Special Guide _(added v3.0)_
   - 6.5.4 Frontend Security Baseline (with CSP Policy) + §6.5.5 Sensitive Data Handling _(added v3.0)_
   - 6.6.3 Mobile Adaptation Special Considerations _(added v3.0, extracted from Doc-11 §19.3)_

**Part VI — Engineering and Delivery (§7)**

7. [CI/CD, Testing, Performance and Delivery Roadmap](#7-cicd-testing-performance-and-delivery-roadmap)
   - 7.1.4 CI Stage Details _(added v2.2, extracted from Doc-11 §24.1)_
   - 7.1.5 Auto-Update Strategy _(added v2.2, extracted from Doc-11 §24.4)_
   - 7.2.4 Testing Toolchain _(added v2.2, extracted from Doc-11 §25.2)_
   - 7.2.5 v3.0 Module Testing Strategy _(added v3.0)_
   - 7.2.6 Coverage Requirements _(added v2.2, extracted from Doc-11 §25.3, original §7.2.5 renumbered)_
   - 7.3.3 Performance Optimization Strategy (Web/Mobile/Desktop Details) _(added v3.0, extracted from Doc-11 §23.2-23.4)_
   - 7.3.4 Chart-Dense Page Performance Budget _(added v3.0)_
   - 7.3.5 CI Build Impact Assessment _(added v3.0)_
   - 7.4 Phased Delivery Plan _(added Gate 0-3 dependency gates in v2.2)_ + Team Configuration Suggestions _(added v3.0)_
   - 7.5 Risks and Mitigations _(added 3 supplementary risks in v3.0)_

**Appendices**

- [Appendix A: Backend API Endpoints → UI Features Complete Mapping](#appendix-a)
- [Appendix B: WebSocket Event Complete Mapping](#appendix-b)
- [Appendix C: ADR Decision Index](#appendix-c)
- [Appendix D: Glossary](#appendix-d)
- [Appendix E: v2.3 Remediation Checklist (P0/P1/P2)](#appendix-e) _(added v2.3)_

---

# Part I — Overall Design

---

# 1. Design Overview and Positioning

## 1.1 Background

The Automatic Agent Platform backend has completed development of the five-plane architecture (P1 Interface / P2 Control / P3 Orchestration / P4 Execution / P5 State-Evidence + X1 Reliability Fabric), with 79 CLI entries as the only current interaction mode. The backend is a Node.js 22 + TypeScript ESM pure backend system with zero frontend dependencies.

This document defines a unified UI layer covering six major platforms (Web / Windows / macOS / Linux / Android / iOS), enabling all roles (independent operators → platform SREs) to complete daily operations through a graphical interface.

## 1.2 Relationship with the Five-Plane Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│              This document's coverage: Cross-Platform UI Layer                         │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ Web  │ │ Win  │ │macOS │ │Linux │ │Droid │ │ iOS  │       │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘       │
│     └────────┴────────┴────────┴────────┴────────┘             │
│                        │                                        │
│              Shared Core Layer (TypeScript)                              │
│              API Client / State / Auth / Sync                    │
└────────────────────────┬────────────────────────────────────────┘
                         │  REST + WebSocket (§5.2/§5.3 API and Real-Time Layer)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             P1 Interface Plane (Backend Implemented)                       │
│                                                                 │
│  ┌───────────────────┐ ┌────────────────────┐ ┌──────────────┐ │
│  │ HTTP API Server   │ │ WebSocket Server   │ │ Stream Bridge│ │
│  │ (task/admin/      │ │ (WebSocketBridge + │ │ (SSE)        │ │
│  │  console/dashboard│ │  DashboardWSServer │ │              │ │
│  │  routes)          │ │  + TaskWSRelay)    │ │              │ │
│  └───────────────────┘ └────────────────────┘ └──────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ MissionControlService — Data aggregation entry point for all Cockpit views     │
│  │ getSnapshot() · getTaskCockpit() · getWorkflowCockpit()   │
│  │ getStabilityPanel() · getAdminTakeoverConsole()            │
│  │ listApprovalQueue()                                        │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ OperatorConsoleBackendService — Operator snapshot / approval / worker / events │ │
│  └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│      P2 Control · P3 Orchestration · P4 Execution               │
│      P5 State-Evidence · X1 Reliability Fabric                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Constraint**: The UI layer is a **pure consumer** of the P1 Interface Plane, following the UP-1 (API-First) principle:

- All data is obtained through the REST API (§5.2) and `ws/v1/stream` (§5.3)
- All operations map to standard REST endpoints
- No bypass is introduced to bypass the P2 Control Plane's policy checks
- UI displayed state must not retroactively define the authoritative facts of task/workflow/execution (contract §2.5)

## 1.3 Design Goals

| # | Goal       | Quantitative Indicator                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| G-1  | Six-Platform Coverage | Web (Chrome/Firefox/Safari/Edge) + Windows 10+ + macOS 12+ + Linux (Ubuntu 22+/RHEL 9+) + Android 10+ + iOS 16+ |
| G-2  | Code Sharing   | Cross-platform sharing rate ≥ 70%                                                                                             |
| G-3  | Performance       | Web FCP < 1.5s, LCP < 2.5s; desktop startup < 3s; mobile startup < 2s                                                       |
| G-4  | Real-Time     | WebSocket event → UI update < 200ms (P99)                                                                         |
| G-5  | Offline       | Mobile / Edge scenarios support offline operation + recovery sync                                                                        |
| G-6  | Accessibility     | WCAG 2.1 AA compliant                                                                                               |
| G-7  | Security       | Token secure storage; PII not cached; frontend security baseline fully covered                                                                 |
| G-8  | Multi-Tenancy     | Tenant-level branding customization + feature flags + compliance mode                                                                           |
| G-9  | Full Role Coverage | Independent operator (L1) · Business line owner (L1) · Domain admin (L2) · Pack developer (L2/L3) · Platform SRE (L3/L4)                        |
| G-10 | Consistent Experience   | The same user sees consistent data, operation entries, and approval flows on different platforms                                                           |

## 1.4 Design Principles

### 1.4.1 Architectural Principles

| # | Principle               | Description                                                                                                                                                  |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| UP-1 | API-First          | The UI layer is a consumer of the P1 Interface Plane Public API (§5.2/§5.3), with no bypass introduced. All operations map to standard REST/WebSocket endpoints (ADR-No-Code-UX-Maps-To-Standard-API) |
| UP-2 | Shared Kernel, Platform Shell | Business logic, state management, and API communication are extracted into a cross-platform shared layer; the rendering layer is implemented independently per platform                                                                                  |
| UP-3 | Progressive Enhancement           | Core features are available on all platforms; advanced features (debugger time travel, Workflow canvas drag-and-drop) are enhanced on Web/Desktop                                                                |
| UP-4 | Offline-First Design       | In mobile and Edge scenarios, local cache + optimistic update + conflict resolution are the default modes                                                                                        |
| UP-5 | Real-Time by Default         | All mutable data is pushed via WebSocket by default, with polling only as a fallback                                                                                          |
| UP-6 | No Compromise on Security         | Token storage follows platform security best practices; PII is not cached locally                                                                                                      |
| UP-7 | Pluggable Rendering         | Component interfaces are standardized, and rendering implementations are replaceable (React DOM / React Native / Electron / Tauri WebView)                                                                 |
| UP-8 | Contract-Driven           | UI information architecture, page fields, and drilldown depth strictly follow `ui_console_and_cockpit_contract.md`, without inventing page structures on its own                                                      |

### 1.4.2 Interaction Principles

| # | Principle           | Description                                                                                       |
| ---- | -------------- | ------------------------------------------------------------------------------------------ |
| UX-1 | Conversation First       | The NL conversation box is the main entry on all platforms (§4.1 NL Conversation module), and users can switch to conversation mode at any time |
| UX-2 | Progressive Disclosure | Default displays L1 summary, expand L2-L5 details on demand (contract §7 five-level drilldown)                                  |
| UX-3 | Reversible Operations     | All non-irreversible operations provide an Undo buffer (reversible within 5s), irreversible operations require secondary confirmation                        |
| UX-4 | Status Awareness     | Network status, sync status, and offline queue depth are always visible                                                   |
| UX-5 | Context Preservation     | When switching pages / switching back to the App, restore to the precise position and state when leaving                                            |
| UX-6 | Home = Health     | The Console home page first answers "is the system healthy, what is it doing, where is it stuck" (contract §4)                        |

## 1.5 Design Scope

| In Scope                                    | Out of Scope                              |
| ----------------------------------------- | ----------------------------------- |
| Six-platform UI shell project                        | Backend API development (already done)               |
| Shared core layer (state/API/auth/sync)          | P1-P5 plane internal implementation changes              |
| 5 core pages defined by the contract + extended feature modules      | Single business domain Prompt details              |
| Design system (tokens/components/themes)               | Visual mockups (handed over to UX team)              |
| Build/test/CI/CD pipeline                    | Infrastructure physical deployment (Kubernetes configuration) |
| Multi-language framework                                | Specific translation content                        |
| Backend API enhancement requirements list (marked as [Planned]) | Specific implementation of the backend API                 |

## 1.6 Role and View Mapping

| Role         | Level  | Main Pages (per contract information architecture)                                               | Platform Preference     |
| ------------ | ----- | ------------------------------------------------------------------------ | ------------ |
| Independent Operator   | L1    | Dashboard · TaskCockpit · ApprovalCenter · Conversation                          | Web / Mobile |
| Business Line Owner | L1    | Dashboard · TaskCockpit · ApprovalCenter · CostCenter                    | Web / Mobile |
| Domain Admin     | L2    | AgentManager · DomainWizard · Marketplace · Dashboard (L2)                | Web / Desktop |
| Pack Developer  | L2/L3 | WorkflowBuilder · WorkflowDebugger · AgentManager · Marketplace          | Web / Desktop |
| Platform SRE     | L3/L4 | StabilityPanel · AdminTakeoverConsole · Incidents · WorkerPanel · Debugger | Web / Desktop |

## 1.7 Status Label Convention

This document applies a four-level status label to all API endpoints, WebSocket events, feature modules, PlatformAdapter capabilities, and DomainUIConfig fields, distinguishing between "confirmed fact" and "design goal":

| Label            | Meaning                                                        | Color Hint |
| --------------- | ----------------------------------------------------------- | -------- |
| **Implemented** | Backend implemented and tested, UI can integrate directly                         | Green 🟢    |
| **Planned**     | Included in the delivery roadmap (§7.4), backend/frontend to be implemented soon, interface contract is stable | Blue 🔵    |
| **Proposed**    | Architecture design completed but not yet scheduled for development, interface may change              | Yellow 🟡    |
| **Deferred**    | Identified requirements but explicitly deferred to a later version, does not block current delivery              | Gray ⚪    |

**Implemented Sub-Labels** _(added v2.3)_:

Three maturity sub-labels are maintained within `[Implemented]` entries to help frontend teams assess integration risk:

| Sub-Label                     | Meaning                                                                                                     | Frontend Integration Guidance                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Implemented-Contracted** | Backend service + HTTP route + OpenAPI/JSON schema are all published and frozen, with a public contract guarantee                           | Phase 1 can integrate directly, no additional alignment cost          |
| **Implemented-Internal**   | Backend service method exists and is tested, but only exposed through internal routes (e.g. `/console/*` HTML), with no public JSON contract | Requires the backend team to additionally expose a JSON API or provide a temporary mock |
| **Implemented-Partial**    | Backend service method exists, some fields/scenarios are implemented, but the schema is not yet frozen or lacks edge case coverage                      | Can start integration but need defensive coding for schema changes  |

**Inline Format of Sub-Labels**: `[Implemented/Contracted]` `[Implemented/Internal]` `[Implemented/Partial]`

**Usage Rules**:

- Inline annotate `[Implemented]` `[Planned]` `[Proposed]` `[Deferred]` in tables
- The status has been annotated in §4.1 feature module table, §5.2 API endpoint table, §5.3 WebSocket event table, §3.7 PlatformAdapter interface table, appendices A/B of this document
- During integration development, only `[Implemented/Contracted]` entries can be integrated unconditionally in Phase 1; `[Implemented/Internal]` and `[Implemented/Partial]` entries need to confirm the exposure method and schema stability with the backend before integration; `[Planned]` entries must wait for the corresponding Gate to pass (§7.4)
- Status labels are updated by the architecture review committee at each Phase Gate; sub-labels are updated by the backend API owner at each Sprint Review

**Status Label Update Responsibility Mechanism** _(added v3.0)_:

The value of status labels depends on their timeliness. The following matrix defines who updates, what is updated, when to update, and which Gate is mandatory for validation:

| Label Category                                             | Update Owner         | Update Content                            | Update Timing              | Mandatory Validation Node                  |
| ---------------------------------------------------- | ------------------ | ----------------------------------- | --------------------- | ----------------------------- |
| Four-Level Status Labels (Implemented/Planned/Proposed/Deferred) | Architecture Review Committee     | Module/endpoint overall status upgrade/downgrade             | Each Phase Gate       | Gate 0/1/2/3 admission review         |
| Implemented Sub-Labels (Contracted/Internal/Partial)     | Backend API Owner     | API layer-level changes, schema freeze status | Each Sprint Review    | Phase Gate + Sprint Demo      |
| API Graduation Matrix (§5.2.4)                       | Backend API Owner     | `Current Layer` / `Status` columns       | Each Sprint Review    | Gate for the corresponding Target Milestone |
| Feature Module Status                                     | Frontend Feature Owner | UI-side implementation progress, integration status             | Each Sprint Review    | Phase Gate + Sprint Demo      |
| mini-contract (§4.7) Dimension Update                        | Projection Owner   | DTO schema changes, Query Keys adjustments    | Update immediately on schema change | Phase Gate                    |
| PlatformAdapter Capability Status                             | Platform Adapter Owner   | Implementation status of each platform adapter                | Each Sprint Review    | Phase Gate                    |
| Appendix A/B Endpoint/Event Status                               | Backend API Owner     | Endpoint addition/deprecation, event implementation status         | Update immediately on backend release    | Phase Gate                    |

**Mandatory Refresh Rules**:

- **Sprint Review**: The backend API owner and frontend Feature owner each update their own labels; labels that are not updated are marked as `[STALE]` in the Sprint Review meeting minutes
- **Phase Gate Admission**: 48 hours before the Gate review, all labels involved in the Gate must be refreshed; `[STALE]` labels block the Gate from passing
- **Emergency Changes**: Within 24 hours after a backend breaking change is released, the API owner must update all affected labels and notify the frontend Feature owner
- **Quarterly Audit**: At the end of each quarter, the architecture review committee performs a full review of all document labels to clean up expired labels

## 1.8 Contract Version Negotiation

As a consumer of the P1 Interface Plane, the UI layer must maintain version compatibility with the backend across multiple contract dimensions:

| Contract Dimension              | Current Version | UI Support Range        | Mismatch Handling Strategy                                                        |
| --------------------- | -------- | ------------------ | ------------------------------------------------------------------------ |
| REST API Version         | v1       | v1                 | Request header `Accept-Version: v1`; if the backend returns `406`, show an upgrade prompt and disable write operations  |
| WebSocket Schema Version | v1       | v1                 | Send `schema_version: 1` during handshake; if negotiation fails, fall back to REST polling             |
| DomainDescriptor Version | Defined by domain | ≥ Current known minimum version | Pull the descriptor on startup; if `version < minSupported`, mark the domain as "degraded mode"   |
| UI Contract Version      | 1.0      | 1.0                | Frontend validates `/api/v1/meta/contract-version` on startup; shows a banner warning if mismatched |
| DomainUIConfig Schema | 1.0      | 1.0                | Unknown fields are ignored (forward compatible); missing required fields use default values and report to telemetry         |

**Degradation Behavior**:

- **API version mismatch**: Read-only mode + top banner "Current client version is incompatible with the server, please upgrade"
- **WS negotiation failure**: Automatically degrade to 30s REST polling, status bar shows "Real-time updates unavailable"
- **Contract version mismatch**: Functions are normal but a persistent banner is displayed, telemetry reports `contract_version_mismatch`
- **DomainDescriptor too old**: The domain page shows a "Domain configuration version is too low" warning, hiding UI controls that depend on new fields

---

# 2. Six-Platform Tech Selection

> **Improvement V-1~V-4**: Unify Doc-10/Doc-11 version differences; the newer stable version takes precedence.

## 2.1 Tech Stack Overview (Authoritative Versions)

| Platform        | Shell Technology          | Rendering Engine              | Native Bridge           | Installation Package Format                     | Estimated Size |
| ----------- | ----------------- | --------------------- | ------------------ | ------------------------------ | ---------- |
| **Web**     | React 19 + Vite 6 | React DOM             | PWA Service Worker | CDN / Docker nginx             | ~2MB gzip  |
| **Windows** | Electron 34       | Chromium (React DOM)  | Node.js + Win32    | MSIX / EXE (NSIS)              | ~120MB     |
| **macOS**   | Tauri 2.x         | WebKit (React DOM)    | Rust + AppKit      | DMG / Mac App Store            | ~15MB      |
| **Linux**   | Tauri 2.x         | WebKitGTK (React DOM) | Rust + GTK4        | AppImage / DEB / RPM / Flatpak | ~15MB      |
| **Android** | React Native 0.79 | Hermes + Fabric       | Kotlin/Java bridge | AAB (Play) / APK               | ~28MB      |
| **iOS**     | React Native 0.79 | JSI + Fabric          | Swift/ObjC bridge  | IPA (App Store / TestFlight)   | ~35MB      |

## 2.2 Selection Decision Matrix (ADR-UI-001)

| Decision Point                  | Option A            | Option B           | Option C        | Decision            | Reason                                                                             |
| ----------------------- | ----------------- | ---------------- | ------------- | --------------- | -------------------------------------------------------------------------------- |
| UI Framework                 | React 19          | Vue 3            | Svelte 5      | **React 19**    | Unify with the RN ecosystem; the most mature community/component library; the team already has experience                                  |
| Mobile                  | React Native 0.79 | Flutter          | Capacitor     | **RN 0.79**     | Share hooks/state with the React ecosystem; New Arch performance is close to native; 0.79 enables New Arch by default   |
| Windows Desktop            | Electron 34       | Tauri 2          | .NET MAUI     | **Electron 34** | The largest Windows user base, the most mature Electron ecosystem, and complete plugins/debugging tools                     |
| macOS/Linux Desktop        | Tauri 2           | Electron 34      | —             | **Tauri 2**     | Small package size (15MB vs 120MB); Rust backend is more secure; macOS/Linux market share is lower, Tauri is sufficient |
| State Management                | Zustand 5         | Redux Toolkit    | Jotai         | **Zustand 5**   | <1KB; TS friendly; middleware ecosystem (persist/immer); RN compatible                           |
| Server State              | TanStack Query v5 | SWR 2            | Apollo Client | **TQ v5**       | Auto cache / dedup / background refresh / optimistic update; offline support; complement WebSocket real-time push             |
| Chart Library                  | ECharts           | Recharts         | Victory       | **ECharts**     | Excellent performance with large data; rich chart types; RN embedded via WebView                               |
| Canvas (Workflow Builder) | React Flow        | xyflow           | Self-built          | **React Flow**  | Mature node canvas; TypeScript native; active community                                        |
| Package Manager                  | npm workspaces    | Yarn 4 workspace | pnpm workspace | **npm workspaces** | Consistent with the in-repo `package.json`; zero additional orchestration layer                                      |
| Build Orchestration                | npm scripts       | Nx               | Turborepo     | **npm scripts** | The current in-repo is composed of workspace + app-level scripts forming a minimum viable build chain                    |

## 2.3 Framework Version Constraints (Authoritative Version Lock)

| Framework           | Locked Version | Upgrade Strategy                     |
| -------------- | -------- | ---------------------------- |
| React          | 19.x     | Major locked, minor upgrades with release |
| React Native   | 0.79.x   | Minor locked, patch upgrades with release |
| Electron       | 34.x     | Major locked, minor with security updates |
| Tauri          | 2.x      | Major locked                   |
| TypeScript     | 5.8+     | Aligned with backend tsconfig         |
| Node.js        | 22 LTS   | Used by build/CI, consistent with backend     |
| Vite           | 6.x      | Major locked                   |
| Zustand        | 5.x      | Major locked                   |
| TanStack Query | 5.x      | Major locked                   |
| React Flow     | 11.x     | Current in-repo baseline; upgrading to 12.x requires a separate migration |
| ECharts        | 5.x      | Major locked                   |

## 2.4 Cross-Platform Code Reuse Matrix

| Code Layer                        | Web | Win (Electron) | Mac (Tauri) | Linux (Tauri) | Android (RN) | iOS (RN)   |
| ----------------------------- | --- | ------------- | ---------- | ------------ | ----------- | --------- |
| L3 Shared Core (state/api/auth)  | ✓   | ✓             | ✓          | ✓            | ✓           | ✓         |
| L2 React Hooks (useTask etc.) | ✓   | ✓             | ✓          | ✓            | ✓           | ✓         |
| L2 React DOM Components             | ✓   | ✓             | ✓          | ✓            | ✗           | ✗         |
| L2 React Native Components          | ✗   | ✗             | ✗          | ✗            | ✓           | ✓         |
| L1 Platform Shell                   | Web | Electron      | Tauri      | Tauri        | RN Entry    | RN Entry  |
| L4 Platform Adaptation                   | Web | Electron      | Tauri      | Tauri        | RN Module   | RN Module |

**Comprehensive Sharing Rate Estimate**: ~72%

## 2.5 Six-Platform Adaptation Strategy

### 2.5.1 Web Platform

```text
React 19 SPA + Vite 6
    │
    ├── PWA Service Worker
    │   ├── Static asset cache (Cache-First)
    │   ├── API response cache (Network-First + Stale-While-Revalidate)
    │   └── Offline fallback page
    │
    ├── Responsive layout
    │   ├── ≥1440px: Full three columns (navigation + content + side panel)
    │   ├── 1024-1439px: Two columns (collapsed navigation + content)
    │   ├── 768-1023px: Single column + hamburger menu
    │   └── <768px: Mobile view (native App recommended)
    │
    └── Performance metrics
        ├── FCP < 1.5s (CDN + Code Splitting)
        ├── LCP < 2.5s (critical path preloading)
        ├── CLS < 0.1 (skeleton screen + fixed layout)
        └── INP < 200ms (React concurrent features)
```

### 2.5.2 Windows (Electron 34)

| Feature     | Implementation                                                            |
| -------- | ------------------------------------------------------------------- |
| Window Management | Multi-window support (main window + debugger window + conversation popup)                        |
| System Integration | Persistent system tray, Jump List (recent tasks/quick approval), Windows Timeline integration |
| Notifications     | Windows Notification Center (approval/alert/task completion)                   |
| Shortcuts   | Ctrl+K (command palette), Ctrl+N (new task), Ctrl+Shift+D (debugger)        |
| Auto-Update | electron-updater incremental update (delta package ~5MB)                            |
| Performance     | Startup time < 3s (preload + persistent cache); memory < 300MB (idle state)        |
| Installer   | MSIX (enterprise group policy distribution) + EXE (individual install)                             |

### 2.5.3 macOS (Tauri 2)

| Feature      | Implementation                                                     |
| --------- | ------------------------------------------------------------ |
| Native Feel    | Follows HIG: Traffic Light window buttons, native menu bar, Spotlight integration |
| Window Management  | Native full screen + Split View support; Stage Manager compatible               |
| Menu Bar  | Persistent Menu Bar icon (unread approval count Badge)                     |
| Touch Bar | Context-aware quick actions (approval button, task status toggle)                 |
| Notifications      | macOS Notification Center + critical alert Critical Alert          |
| Security      | App Sandbox + Hardened Runtime; Keychain stores Token          |
| Distribution      | DMG (direct download) + Mac App Store (enterprise MDM distribution)              |
| Installer    | ~15MB (Tauri, without Chromium bundled)                             |

### 2.5.4 Linux (Tauri 2)

| Feature     | Implementation                                                   |
| -------- | ---------------------------------------------------------- |
| Desktop Environment | Supports GNOME 45+ (GTK4) and KDE Plasma 6+ (via XDG standard)    |
| Window Management | Wayland preferred, X11 fallback; supports tiling WM (i3/Sway)      |
| System Tray | StatusNotifierItem (SNI) protocol; fallback to XEmbed          |
| Notifications     | D-Bus org.freedesktop.Notifications; supports dunst/mako       |
| File Management | xdg-open opens exported files; follows XDG Base Directory specification        |
| Themes     | Auto-detect system Dark/Light mode (GTK/KDE theme follows)           |
| Distribution     | AppImage (universal) / Flatpak (sandbox) / DEB + RPM (system package management) |
| Installer   | ~15MB (Tauri)                                             |

### 2.5.5 Android (React Native 0.79)

| Feature     | Implementation                                                        |
| -------- | --------------------------------------------------------------- |
| Minimum Version | Android 10 (API 29), target API 35                                |
| Architecture     | React Native 0.79 + New Architecture (Fabric + TurboModules)    |
| Navigation     | Bottom tab bar (Home/Task/Approval/Dashboard/More) + Stack navigation              |
| Notifications     | FCM push; foreground notification channel grading (approval=high, task complete=default, marketing=low) |
| Offline     | SQLite (Room) local cache + WorkManager background sync                   |
| Biometrics | BiometricPrompt API (fingerprint/face unlock app)                        |
| Gestures     | Pull to refresh, left swipe to delete/operate, long press context menu                         |
| Performance     | Startup < 2s (Hermes precompiled + App Startup Library)                |
| Widget   | Android Widget (pending approval count + recent task status)                     |
| Package Size   | < 30MB (AAB split by architecture)                                        |

### 2.5.6 iOS (React Native 0.79)

| Feature      | Implementation                                                                 |
| --------- | ------------------------------------------------------------------------ |
| Minimum Version  | iOS 16+, target iOS 18                                                     |
| Architecture      | React Native 0.79 + New Architecture (JSI + Fabric)                      |
| Navigation      | UITabBarController style bottom bar + UINavigationController style stack          |
| Notifications      | APNs push; Notification Service Extension (rich notification: approval preview + quick actions) |
| Offline      | Core Data / SQLite (GRDB) + BackgroundTasks framework                    |
| Biometrics  | LocalAuthentication framework (Face ID / Touch ID)                      |
| Widget    | WidgetKit (Today Widget + Lock Screen Widget: pending approval, task status)         |
| Shortcuts | Siri Shortcuts integration ("Hey Siri, help me check today's approvals")                     |
| Gestures      | iOS standard gestures (edge back, 3D Touch peek); Haptic Feedback                 |
| Performance      | Startup < 1.5s (JSI direct call + MetroBundle preheat)                               |
| Privacy      | App Tracking Transparency; Privacy Manifest declares data types                 |
| Package Size    | < 40MB                                                                   |

### 2.5.7 Platform Feature Matrix

| Feature     | Web                    | Windows                     | macOS                     | Linux             | Android            | iOS                |
| -------- | ---------------------- | --------------------------- | ------------------------- | ----------------- | ------------------ | ------------------ |
| Notifications     | Web Notification API   | Windows Notification Center | macOS Notification Center | libnotify / D-Bus | FCM Push           | APNs Push          |
| Biometrics | WebAuthn               | Windows Hello               | Touch ID / Face ID        | —                 | Fingerprint / Face | Face ID / Touch ID |
| Secure Storage | —                      | Credential Manager          | Keychain                  | libsecret/kwallet | Android Keystore   | iOS Keychain       |
| File Access | File System Access API | Win32 File API              | NSFileManager             | GIO/POSIX         | SAF/MediaStore     | UIDocumentPicker   |
| Deep Linking | URL routing            | Protocol handler            | Universal Links           | xdg-open          | App Links          | Universal Links    |
| Shortcuts   | Standard Web               | Ctrl+ series                   | Cmd+ series                  | Ctrl+ series         | —                  | —                  |
| System Tray | —                      | System Tray                 | Menu Bar                  | System Tray       | —                  | —                  |
| Auto-Update | Service Worker         | electron-updater            | Sparkle (Tauri)           | AppImage delta    | Google Play        | App Store          |
| Offline Storage | IndexedDB              | SQLite (better-sqlite3)     | SQLite (rusqlite)         | SQLite (rusqlite) | SQLite (Room)      | SQLite (GRDB)      |
| Clipboard   | Clipboard API          | Win32 Clipboard             | NSPasteboard              | GTK Clipboard     | ClipboardManager   | UIPasteboard       |

## 2.6 Desktop Hybrid Shell Governance Rules (ADR-UI-009)

### 2.6.1 Why Not Unify the Desktop Shell

Windows uses Electron 34, macOS/Linux use Tauri 2.x — the dual-stack parallel decision is based on the following cost-benefit analysis:

| Dimension         | Unified Electron            | Unified Tauri                    | Dual Stack (Current Choice) |
| ------------ | ------------------------ | ----------------------------- | ---------------- |
| Windows Experience | ✅ Most mature ecosystem            | ⚠️ WebView2 depends on Edge Runtime | ✅ Electron optimal |
| macOS Package Size | ❌ ~120MB                | ✅ ~15MB                      | ✅ Tauri 15MB    |
| Linux Compatibility | ⚠️ Chromium sandbox limited | ✅ WebKitGTK native             | ✅ Tauri native    |
| Security Surface     | ❌ Node.js full permissions        | ✅ Rust minimal permissions              | ✅ Optimal for each platform    |
| Maintenance Cost     | ✅ Single stack                | ✅ Single stack                     | ⚠️ Two sets of native bridges  |
| Plugin Ecosystem     | ✅ Rich npm ecosystem          | ⚠️ Tauri plugins still growing         | ✅ Best of both worlds      |

**Conclusion**: The additional maintenance cost of the dual stack (about 15% of desktop-specific code) is offset by a better platform experience and security.

### 2.6.2 PlatformAdapter Boundary Rules

| Capability Category          | Must Go Through PlatformAdapter | Allow Forked Implementation | Description                                                         |
| ----------------- | ------------------------ | ------------ | ------------------------------------------------------------ |
| Window Management          | ✅                       | ❌           | `windowing` interface unified abstraction (§3.7.1)                           |
| File System Access      | ✅                       | ❌           | Through the `fileAccess` interface, direct calls to Node.js fs / Rust fs are prohibited    |
| Secure Storage          | ✅                       | ❌           | Token/key storage must go through the `secureStorage` interface                    |
| Clipboard            | ✅                       | ❌           | Defined in v2.1                                               |
| Deep Linking          | ✅                       | ❌           | Defined in v2.1                                               |
| Notifications              | ✅                       | ❌           | Cross-platform notification interface                                               |
| System Tray / Menu Bar | ❌                       | ✅           | The difference between Electron Tray and Tauri SystemTray API is too large, each is allowed to implement its own |
| Auto-Update          | ❌                       | ✅           | electron-updater and Tauri updater have different mechanisms                   |
| Native Menu          | ❌                       | ✅           | Platform menu specifications vary greatly (Windows Menu Bar vs macOS App Menu)     |

### 2.6.3 Desktop Test Matrix Split

| Test Layer     | Electron (Windows)              | Tauri (macOS/Linux)                 | Sharing                          |
| ------------ | ------------------------------- | ----------------------------------- | ----------------------------- |
| Unit Tests     | Vitest + jsdom                  | Vitest + jsdom                      | 100% sharing (shared/ layer)       |
| Integration Tests     | Playwright + Electron launch    | Playwright + Tauri WebDriver        | Test cases share, driver layer forks   |
| E2E Tests     | Spectron / Playwright Electron  | tauri-driver + WebDriver            | Page-level scenario scripts share            |
| Platform-Specific Tests | Win32 API mock · MSIX install/uninstall | AppKit/GTK mock · DMG/AppImage validation | Do not share                        |
| CI Matrix      | windows-latest runner           | macos-latest + ubuntu-latest runner | Share lint/typecheck/unit stages |

---

# Part II — Project Foundation

---

# 3. Monorepo Project Structure and Layered Architecture

> **Improvement R-2**: Merge the directory structure of Doc-10 §10.5 and Doc-11 §5.1 into a single authoritative version.

## 3.1 Four-Layer Hierarchical Model

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Platform Shell                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌─────┐│
│  │ Web SPA  │ │ Electron │ │ Tauri  │ │ Tauri  │ │ RN    │ │ RN  ││
│  │ (Vite 6) │ │ 34 (Win) │ │ 2(Mac) │ │2(Linux)│ │(Droid)│ │(iOS)││
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬────┘ └──┬──┘│
├───────┴────────────┴───────────┴──────────┴─────────┴─────────┴────┤
│  Layer 2 — Feature Modules                              │
│  Grouped by contract information architecture (§3) four navigation groups:                                     │
│  ┌─────────────────┐┌──────────────────┐┌──────────────────────────┐│
│  │ Mission Control ││   Operations     ││    Governance            ││
│  │ ─ dashboard     ││   ─ dispatch     ││    ─ policy              ││
│  │ ─ task-cockpit  ││   ─ inspect      ││    ─ audit               ││
│  │ ─ wf-cockpit    ││   ─ health       ││    ─ compliance          ││
│  │ ─ approval      ││   ─ incidents    ││    ─ runtime-decisions*  ││
│  │ ─ stability     ││                  ││                          ││
│  │ ─ alerts        ││                  ││                          ││
│  ├─────────────────┤├──────────────────┤├──────────────────────────┤│
│  │     Admin       ││   Extended       ││    Shared Features       ││
│  │ ─ takeover      ││ ─ conversation   ││ ─ explainability         ││
│  │ ─ workers       ││ ─ wf-builder     ││ ─ cost-center            ││
│  │ ─ queues        ││ ─ wf-debugger    ││ ─ marketplace            ││
│  │ ─ feature-flags ││ ─ agent-manager  ││ ─ domain-wizard          ││
│  │ ─ capability    ││ ─ hitl           ││ ─ settings               ││
│  │                 ││                  ││ ─ analytics              ││
│  └─────────────────┘└──────────────────┘└──────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Layer 3 — Shared Core — 100% Cross-Platform                    │
│  ┌───────────┐┌──────────┐┌────────┐┌────────┐┌───────┐┌────────┐│
│  │api-client ││  state   ││  auth  ││  sync  ││  i18n ││telemetry││
│  ├───────────┤├──────────┤├────────┤├────────┤├───────┤├────────┤│
│  │ domain    ││permission││nl-client││ws-mgr ││ types ││error-hdl││
│  └───────────┘└──────────┘└────────┘└────────┘└───────┘└────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Layer 4 — Platform Adapters — 0% Sharing                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Web API  │ │ Node.js  │ │ Rust     │ │ Android  │ │ iOS      ││
│  │ (fetch)  │ │(Electron)│ │ (Tauri)  │ │ (Bridge) │ │ (Bridge) ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
└────────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌────────────────────────────────────────────────────────────────────┐
│          Platform Backend (P1 Interface Plane, §6 API)             │
└────────────────────────────────────────────────────────────────────┘
```

> \* `runtime-decisions` is marked as `[Deferred]`, to be determined whether to be an independent feature module after the v2.5 review.

## 3.2 Layer Responsibilities and Constraints

| Layer          | Responsibility                                           | Sharing Rate | Technical Constraints                            |
| ------------- | ---------------------------------------------- | ------ | ----------------------------------- |
| L1 Platform Shell   | Platform entry, window management, system integration, native notifications         | 0%     | Each platform implemented independently                      |
| L2 Feature Module Layer | Page components, routing, business interaction logic                   | ~60%   | Web/Desktop share React DOM; RN independent components |
| L3 Shared Core Layer | State, API, Auth, sync, domain logic, types, telemetry    | 100%   | Pure TypeScript, zero platform dependencies           |
| L4 Platform Adapter Layer | Platform encapsulation of network, storage, notifications, biometrics, file system | 0%     | Unified interface, platform independent implementation              |

## 3.3 Dependency Rules

```text
L1 → L2 → L3 ← L4
              ↑
         L4 implements the interface defined by L3
```

- L3 cannot depend on L1/L2 (pure logic layer)
- L2 can depend on L3, but cannot directly depend on L4 (use L4 capabilities indirectly through the interface defined by L3)
- L1 can depend on L2/L3/L4
- L4 cannot depend on L1/L2/L3 (only implements the `PlatformAdapter` interface defined by L3)
- Feature modules communicate through the L3 shared core, not directly imported from each other

## 3.4 Directory Panorama (Authoritative Version)

```text
ui/                                    # UI Monorepo sub-project (npm workspaces)
├── package.json                       # Root workspace and script entry
├── package-lock.json                  # Locked dependency versions
├── tsconfig.json                      # Shared TypeScript baseline
├── eslint.config.js                   # ESLint 9 configuration
├── vitest.config.ts                   # Vitest test configuration
├── .storybook/                        # Storybook configuration
├── .env.example                       # UI environment variable template
├── apps/                              # L1 platform shell entries
│   ├── web/                           # React 19 + Vite 6 SPA
│   ├── electron-win/                  # Electron Windows smoke shell
│   ├── tauri-macos/                   # Tauri macOS smoke shell
│   ├── tauri-linux/                   # Tauri Linux smoke shell
│   └── mobile/                        # React Native smoke shell
├── packages/
│   ├── shared/                        # L3 shared core layer
│   │   ├── api-client/                # RESTClient / WSClient / endpoint catalog
│   │   ├── auth/                      # auth-service / token-manager / session-guard
│   │   ├── state/                     # stores + query factories
│   │   ├── sync/                      # offline queue / conflict resolver / coordinator
│   │   ├── i18n/                      # TranslationService + ICU MessageFormat
│   │   ├── domain/                    # route guard / redaction / DomainUIConfig
│   │   ├── nl-client/                 # ConversationClient baseline
│   │   ├── telemetry/                 # TelemetrySink + OTLP exporter
│   │   ├── platform/                  # PlatformAdapter factory and default implementation
│   │   └── types/                     # DTOs and shared types
│   ├── ui-core/                       # Web/Desktop shared UI components
│   ├── ui-mobile/                     # React Native shared UI components
│   └── features/                      # Feature modules
│       ├── dashboard/ ... analytics/
│       └── governance-compliance/     # Internal extension module (not registered to public route catalog)
├── tests/                             # Vitest documentation/shared layer/app shell tests
└── docs/
    ├── storybook/
    └── adr/
```

## 3.5 Package Management and Build Configuration

### package.json workspaces

```json
{
  "workspaces": [
    "packages/shared/*",
    "packages/ui-core",
    "packages/ui-mobile",
    "packages/features/*",
    "apps/*",
    "tools/*"
  ]
}
```

### Toolchain Overview

| Tool                     | Purpose                                      |
| ------------------------ | ----------------------------------------- |
| npm workspace            | Monorepo package management                           |
| Vite 6                   | Web build (dev server + production build) |
| Metro                    | React Native build                         |
| electron-builder         | Windows packaging (MSIX / EXE)                |
| tauri-cli                | macOS/Linux packaging                          |
| TypeScript 5.8+ (strict) | Type checking, aligned with backend tsconfig            |
| Vitest                   | Unit tests (shared layer + components)                 |
| Storybook                | Component isolated development and visual baseline                    |
| Playwright / Detox       | Target-state E2E toolchain (currently still Planned)     |

### Common Commands

| Command                                 | Description                  |
| ------------------------------------ | --------------------- |
| `npm install`                        | Install all dependencies          |
| `npm run typecheck`                  | Full type checking          |
| `npm test`                           | Full Vitest tests      |
| `npm run test:e2e`                   | In-repo smoke E2E baseline   |
| `npm run build`                      | Typecheck first, then build Web |
| `npm run dev:web`                    | Start Web dev server   |

## 3.6 Package Dependency Graph

```text
apps/web ──────────┐
apps/electron-win ─┤
apps/tauri-macos ──┤──→ features/* ──→ ui-core ──→ shared/*
apps/tauri-linux ──┤                       │
apps/mobile ───────┘──→ features/* ──→ ui-mobile ──→ shared/*
                                            │
                                            └──→ shared/*
tools/codegen ──→ (reads backend src/platform/contracts/)
tools/mock-server ──→ shared/types
tools/e2e ──→ (runtime dependencies, no build dependencies)
```

## 3.7 Shared Core Layer Key Interfaces

### 3.7.1 PlatformAdapter Interface (defined by L3, implemented by L4)

```typescript
interface PlatformAdapter {
  readonly platform: "web" | "windows" | "macos" | "linux" | "android" | "ios";
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readSecureValue(key: string): Promise<string | null>;
  writeSecureValue(key: string, value: string): Promise<void>;
  deleteSecureValue(key: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  openDeepLink(url: string): Promise<void>;
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
  vibrate(pattern: readonly number[]): Promise<void>;
  openWindow(path: string): Promise<void>;
  runShell(command: string): Promise<{ code: number; stdout: string; stderr: string }>;
  spawnProcess(
    command: string,
    args: readonly string[],
  ): Promise<{ pid: number; kill(): Promise<void> }>;
  getAnalyticsConsent(): Promise<boolean>;
  setAnalyticsConsent(enabled: boolean): Promise<void>;
  enableScreenSecurity(enabled: boolean): Promise<void>;
}
```

The current in-repo also provides `createPlatformAdapterCapabilityView(adapter)`, which projects the above flat methods into nested capability views such as `secureStorage / offlineStore / clipboard / deeplink / lifecycle / haptics / windowing / shell / process / analyticsConsent / screenSecurity`, making it easier for the UI layer to consume by capability group.

**PlatformAdapter Capability Status Overview (per current code baseline)**:

| Capability Group           | Method Count | Status          | Platform Applicable                   | Description                      |
| ---------------- | ------ | ------------- | -------------------------- | ------------------------- |
| `platform`       | 1      | [Implemented] | All platforms                     | Platform ID identifier              |
| `fetch`          | 1      | [Implemented] | All platforms                     | Network request abstraction              |
| secureStorage    | 3      | [Implemented] | All platforms                     | `read/write/deleteSecureValue` |
| offlineStore     | 2      | [Implemented] | All platforms                     | `readFile/writeFile`      |
| clipboard        | 1      | [Implemented] | All platforms                     | `copyToClipboard`         |
| deeplink         | 1      | [Implemented] | All platforms                     | `openDeepLink`            |
| lifecycle        | 2      | [Implemented] | All platforms                     | foreground/background listener |
| haptics          | 1      | [Implemented] | All platforms                     | `vibrate`, no-op on non-mobile         |
| windowing        | 1      | [Implemented] | Desktop preferred                 | `openWindow` smoke baseline |
| shell            | 1      | [Implemented] | Desktop preferred                 | `runShell` smoke baseline |
| process          | 1      | [Implemented] | All platforms                     | `spawnProcess`            |
| analyticsConsent | 2      | [Implemented] | All platforms                     | `get/setAnalyticsConsent` |
| screenSecurity   | 1      | [Implemented] | Desktop + Mobile            | `enableScreenSecurity`    |

Capabilities such as notifications, biometrics, and file selection that are not included in the current shared contract are managed as platform shell-specific capabilities and are not defined in the unified `PlatformAdapter` of `@aa/shared-types`.

### 3.7.2 WebSocket Manager Interface

```typescript
interface WSManager {
  connect(url: string, token: string): void;
  disconnect(): void;
  subscribe(channel: string, handler: (event: WSEvent) => void): () => void;
  getState(): "connecting" | "connected" | "disconnected" | "reconnecting";
  onStateChange(cb: (state: WSState) => void): () => void;
}
```

### 3.7.3 Per-Platform Implementation Strategy

| Capability Group          | Web                         | Electron (Win)           | Tauri (Mac/Linux)     | RN (Android)        | RN (iOS)            |
| --------------- | --------------------------- | ------------------------ | --------------------- | ------------------- | ------------------- |
| `fetch`         | `window.fetch`              | `globalThis.fetch` bridge | `globalThis.fetch` bridge | RN `fetch`       | RN `fetch`          |
| secureStorage   | in-memory / cookie seam     | default adapter test double | default adapter test double | default adapter test double | default adapter test double |
| offlineStore    | in-memory file map          | in-memory file map       | in-memory file map    | in-memory file map | in-memory file map |
| clipboard       | browser API seam            | shell bridge seam        | Tauri bridge seam     | RN bridge seam      | RN bridge seam      |
| lifecycle       | foreground/background events  | shell lifecycle events       | shell lifecycle events    | AppState seam       | AppState seam       |
| deeplink        | router / URL scheme seam    | protocol handler seam    | universal link seam   | app links seam      | universal link seam |
| windowing       | new tab / modal seam        | BrowserWindow seam       | Tauri window seam     | N/A              | N/A              |
| shell/process   | no-op / mock                | shell + child process seam | shell + process seam | N/A              | N/A              |

### 3.7.4 Adapter Injection Mechanism

When the application starts, the L1 shell creates a platform adapter instance and injects it into the L3 shared core layer:

```text
L1 App Startup
  │
  ├─ Create PlatformAdapter instance (platform-specific implementation)
  │
  ├─ Initialize L3 shared core layer
  │   ├─ RESTClient(adapter.fetch)
  │   ├─ AuthService(adapter or adapter.capabilities.secureStorage)
  │   ├─ SyncEngine(adapter.capabilities.offlineStore, adapter.capabilities.lifecycle)
  │   └─ Platform services(adapter.capabilities.*)
  │
  └─ Render L2 feature module UI
```

The React layer injects through Context Provider:

```text
<PlatformAdapterProvider adapter={platformAdapter}>
  <AuthProvider>
    <QueryClientProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </QueryClientProvider>
  </AuthProvider>
</PlatformAdapterProvider>
```

---

# Part III — Feature Modules

---

# 4. Feature Module Blueprint and UI Contract Alignment

> **Improvements A-1, A-4, A-5, D-3**: Explicitly map UI feature modules → contract pages → backend service methods; organize navigation by contract information architecture (§3); define the five-level drilldown component tree.

## 4.1 Information Architecture and Navigation Mapping

According to the four navigation groups defined in `ui_console_and_cockpit_contract.md` §3, each frontend feature module explicitly corresponds to a backend data source:

| Navigation Group          | Feature Module            | Contract Page                   | Backend Data Source                                                    | Status                     | Platform Availability    |
| --------------- | ------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------ | ------------- |
| Mission Control | `dashboard`         | Dashboard (§4 Home)        | `MissionControlService.getSnapshot()`                         | [Implemented/Internal]   | All platforms        |
| Mission Control | `task-cockpit`      | TaskCockpit (§5.1)         | `MissionControlService.getTaskCockpit()` + task-routes        | [Implemented/Contracted] | All platforms        |
| Mission Control | `workflow-cockpit`  | WorkflowCockpit (§5.2)     | `MissionControlService.getWorkflowCockpit()`                  | [Implemented/Internal]   | Web/Desktop      |
| Mission Control | `approval`          | ApprovalCenter (§5.3)      | `MissionControlService.listApprovalQueue()` + approval-routes | [Implemented/Contracted] | All platforms        |
| Mission Control | `stability`         | StabilityPanel (§5.4)      | `MissionControlService.getStabilityPanel()`                   | [Implemented/Internal]   | Web/Desktop      |
| Mission Control | `alerts`            | Alerts                     | `OperatorConsoleBackendService.getIncidentTimeline()`         | [Implemented/Internal]   | All platforms        |
| Operations      | `dispatch`          | Dispatch                   | dispatch-routes / dispatch CLI                                | [Implemented/Contracted] | Web/Desktop      |
| Operations      | `inspect`           | Inspect                    | `OperatorConsoleBackendService.getSnapshot()` + inspect CLI   | [Implemented/Internal]   | Web/Desktop      |
| Operations      | `health`            | Health                     | dashboard-routes health endpoint                              | [Implemented/Contracted] | Web/Desktop      |
| Operations      | `incidents`         | Incidents                  | `OperatorConsoleBackendService.getIncidentTimeline()`         | [Implemented/Internal]   | Web/Desktop      |
| Governance      | `policy`            | Policy                     | admin-routes policy endpoint                                  | [Implemented/Contracted] | Web/Desktop      |
| Governance      | `audit`             | Audit                      | admin-routes audit endpoint                                   | [Implemented/Contracted] | Web/Desktop      |
| Governance      | `compliance`        | Compliance                 | [Planned] `/api/v1/compliance`                                | [Planned]                | Web/Desktop      |
| Admin           | `takeover`          | AdminTakeoverConsole (§5.5) | `MissionControlService.getAdminTakeoverConsole()`             | [Implemented/Internal]   | Web/Desktop      |
| Admin           | `workers`           | Workers                    | `GET /api/v1/workers` + MissionControlService.getStabilityPanel() | [Implemented/Contracted] | Web/Desktop      |
| Admin           | `queues`            | Queues                     | `GET /api/v1/queues` + MissionControlService.getStabilityPanel()  | [Implemented/Contracted] | Web/Desktop      |
| Extended        | `conversation`      | NL Conversation            | NLEntryService + IntentParser + ConversationHistoryService    | [Implemented/Partial]    | All platforms        |
| Extended        | `workflow-builder`  | —                          | WorkflowBuilderService (interaction/ux/)                      | [Planned]                | Web/Desktop      |
| Extended        | `workflow-debugger` | —                          | DebuggerService + inspect CLI                                 | [Planned]                | Web/Desktop      |
| Extended        | `agent-manager`     | Agent Monitoring Center (§4.2.7)    | `GET /api/v1/agents` + MissionControlService stable worker projection | [Implemented/Contracted] | All platforms        |
| Extended        | `hitl`              | —                          | HITL notification module + approval-routes                    | [Implemented/Partial]    | All platforms        |
| Shared          | `explainability`    | —                          | `GET /api/v1/explanations`                                    | [Implemented/Contracted] | Web/Desktop      |
| Shared          | `cost-center`       | —                          | [Planned] `/api/v1/costs`                                     | [Planned]                | Web/Desktop      |
| Shared          | `marketplace`       | —                          | `GET /api/v1/marketplace` + `GET /api/v1/packs/:packId/versions` | [Implemented/Contracted] | Web/Desktop/Mobile |
| Shared          | `domain-wizard`     | —                          | DomainOnboardingService (interaction/ux/onboarding/)          | [Implemented/Internal]   | Web/Desktop      |
| Shared          | `settings`          | Configuration Management Center (§4.2.9)      | admin-routes + user preference API + DomainUIConfig           | [Implemented/Partial]    | All platforms        |
| Shared          | `analytics`         | Data Statistics Platform (§4.2.8)      | `GET /api/v1/dashboard/metrics` + MissionControlService       | [Implemented/Contracted] | All platforms        |

## 4.2 Core Contract Page Blueprints

### 4.2.1 Dashboard (Home)

> Contract §4: The home page first answers "is the system healthy, what is it doing now, where is it stuck".

**Data Source**: `MissionControlService.getSnapshot()` → `shared_snapshot` (contract §6.1)

```text
┌─────────────────────────────────────────────────────────────┐
│ System Status Bar                                           │
│ [overall_health] [queue_depth] [active_executions]          │
│ [approval_backlog] [alert_summary]                          │
├─────────────────────────────────────────────────────────────┤
│ Current Focus (First Screen)                                      │
│ ┌─────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Active Tasks    │ │ Active Workflows │ │ Approval Queue│ │
│ │ (card list)     │ │ (card list)      │ │ (card list)   │ │
│ └────────┬────────┘ └────────┬─────────┘ └──────┬────────┘ │
│          │ → TaskCockpit     │ → WfCockpit      │ → Approval│
├─────────────────────────────────────────────────────────────┤
│ Attention Required (Second Screen)                                  │
│ ┌─────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Blocked Reasons │ │ Stale/Recovery   │ │ High-Risk     │ │
│ │                 │ │ Summary          │ │ Decisions     │ │
│ └─────────────────┘ └──────────────────┘ └───────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ NL Conversation Dock (Persistent bottom/side, UX-1 Conversation First)          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2.2 TaskCockpit (Five-Level Drilldown)

> Contract §5.1 + §7: Five-level drilldown (L1-L5).

**Data Source**: `MissionControlService.getTaskCockpit()` + `task-routes`

| Drilldown Level | Display Content                             | UI Component                 | Data Endpoint                          |
| -------- | ------------------------------------ | ----------------------- | --------------------------------- |
| L1       | task list + status                   | `<TaskListView>`        | `GET /api/v1/tasks`               |
| L2       | task details + workflow state        | `<TaskDetailPanel>`     | `GET /api/v1/tasks/{id}`          |
| L3       | step outputs + tool calls            | `<StepOutputViewer>`    | task detail nested data              |
| L4       | approval / decision / evidence chain | `<EvidenceChainViewer>` | `GET /api/v1/tasks/{id}/evidence` |
| L5       | trace / replay / recovery timeline   | `<TimelineViewer>`      | `GET /api/v1/tasks/{id}/timeline` |

**Contract Constraint Implementation**:

- `completed` status: L2 panel shows "View Evidence" button, direct to L4
- `blocked` status: L2 panel forced to display `blocked_reason` + `source`, not allowed to only display "Waiting"
- `failed` status: L2 panel shows `error_code` + `last_step` + "Recovery History" entry, direct to L5

**Minimum Fields** (contract §5.1):

```typescript
interface TaskCockpitView {
  task_id: string;
  task_status: TaskStatus;
  current_step: string;
  current_execution: string;
  blocked_reason?: string;
  latest_tool_call?: ToolCallSummary;
  latest_decision?: DecisionSummary;
  artifact_refs: ArtifactRef[];
}
```

**Minimum Actions**: Open inspect · View timeline · View artifacts · Cancel task · Enter manual takeover

### 4.2.3 WorkflowCockpit (Five-Level Drilldown)

**Data Source**: `MissionControlService.getWorkflowCockpit()`

| Drilldown Level | Display Content                         | UI Component                                 |
| -------- | -------------------------------- | --------------------------------------- |
| L1       | workflow list + status           | `<WorkflowListView>`                    |
| L2       | workflow details + step DAG      | `<WorkflowDetailPanel>` + `<DAGViewer>` |
| L3       | step outputs + tool calls        | `<StepOutputViewer>`                    |
| L4       | approval nodes + evidence refs   | `<EvidenceChainViewer>`                 |
| L5       | compensation / replay / recovery | `<RecoveryTimeline>`                    |

**Minimum Fields** (contract §5.2):

```typescript
interface WorkflowCockpitView {
  workflow_id: string;
  workflow_status: WorkflowStatus;
  steps: WorkflowStep[];
  current_step_index: number;
  dependency_state: DependencyState;
  approval_nodes: ApprovalNode[];
  evidence_refs: EvidenceRef[];
}
```

### 4.2.4 ApprovalCenter

**Data Source**: `MissionControlService.listApprovalQueue()` + approval-routes

**Minimum Fields** (contract §5.3):

```typescript
interface ApprovalView {
  approval_id: string;
  task_id: string;
  risk_level: "low" | "medium" | "high" | "critical";
  reason_summary: string;
  options: ApprovalOption[];
  recommended_option?: string;
  deadline?: string;
  policy_source: string;
}
```

**Minimum Actions**: approve · reject · request_more_context · open_explanation

**UI Constraints**:

- High-risk approvals (risk_level = "high" | "critical") must display the risk level, policy source, approval chain, and takeover entry (contract §2.4)
- Mobile supports push notifications + quick actions (approve/reject without entering the App)

### 4.2.5 StabilityPanel

**Data Source**: `MissionControlService.getStabilityPanel()`

**Minimum Fields** (contract §5.4):

```typescript
interface StabilityPanelView {
  active_tasks: number;
  queued_tasks: number;
  stale_executions: number;
  recovered_executions: number;
  failed_recoveries: number;
  approval_backlog: number;
  event_backlog: number;
  worker_health: WorkerHealthSummary;
}
```

**Minimum Actions**: drill into stuck task · inspect backlog · open recovery evidence · trigger incident workflow

### 4.2.6 AdminTakeoverConsole

**Data Source**: `MissionControlService.getAdminTakeoverConsole()`

**Minimum Fields** (contract §5.5):

```typescript
interface AdminTakeoverView {
  task_scope: TaskScope;
  tenant_workspace_scope: TenantScope;
  execution_owner: string;
  lease_worker_state: LeaseWorkerState;
  recent_events: RecentEvent[];
  current_model_prompt_policy_version: VersionInfo;
  current_capability_entitlement_limit: EntitlementInfo;
}
```

**Minimum Actions**: retry_step · skip_step · override_step_output · switch_worker · manual_cancel · mark_unrecoverable

### 4.2.7 Agent Real-Time Monitoring Center _(added v3.0)_

> Real-time monitoring of all Agent health status, heartbeats, capabilities, and load, with management operations.

**Data Source**: `GET /api/v1/agents` [Implemented/Contracted Layer C] + `MissionControlService.getStabilityPanel()` derived worker/agent projection + `agent.health_changed` WS event

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Agent Monitoring Center                                              [⟳ 10s] │
├──────────┬───────────────────────────────────────────────────────────┤
│ Filter bar   │ [Domain▼] [Status▼] [Health▼] [Capability▼] [Search...]                 │
├──────────┴───────────────────────────────────────────────────────────┤
│ Overview cards                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Total 47  │ │🟢Normal 38 │ │🟡Degraded 5  │ │🔴Offline 3  │ │⚪Unregistered 1│  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ Agent list (real-time update)                                               │
│ ┌─────┬────────┬──────┬────────┬─────────┬──────────┬────────────┐ │
│ │ Name│ Domain │ Status │ Health │ Heartbeat    │ Version     │ Action       │ │
│ ├─────┼────────┼──────┼────────┼─────────┼──────────┼────────────┤ │
│ │ ... │ ...    │ 🟢   │ 98%    │ 3s ago  │ v1.2.0   │ [Details][Restart]│ │
│ └─────┴────────┴──────┴────────┴─────────┴──────────┴────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ Agent detail panel (right drawer / expand on click)                                │
│ ┌─────────────────────────────────────┐                             │
│ │ [Basic Info] [Capability List] [Heartbeat History]    │                             │
│ │ [Load Curve] [Recent Tasks] [Error Log]    │                             │
│ │                                     │                             │
│ │ Heartbeat Timeline ────────●────●────●──── │                             │
│ │ Load Line Chart ──╱╲──╱╲──╱╲────────── │                             │
│ │                                     │                             │
│ │ [Restart] [Deregister] [Update Config] [View Logs] │                             │
│ └─────────────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

**Minimum Fields**:

```typescript
interface AgentMonitorView {
  agent_id: string;
  name: string;
  domain_id: string;
  status: "active" | "degraded" | "offline" | "unregistered";
  health_score: number;
  version: string;
  capabilities: string[];
  last_heartbeat: string;
  uptime_seconds: number;
  current_load: { active_tasks: number; queue_depth: number };
  recent_errors: AgentError[];
  heartbeat_history: HeartbeatPoint[];
  load_history: LoadPoint[];
}
```

**Minimum Actions**: list · filter · get(id) · restart · deregister · update_config · view_logs · export_report

**Real-Time Strategy**:

| Data Item     | Refresh Method                                     | Strategy                                     |
| ---------- | -------------------------------------------- | ---------------------------------------- |
| Agent List | WS `agent.health_changed` + polling fallback | WS preferred, 10s polling fallback; staleTime: 5s |
| Overview cards   | Aggregated from list data                               | Client-side aggregation, no extra requests                   |
| Heartbeat History   | `GET /api/v1/agents/{id}/heartbeats`         | Load on entering detail, 60s staleTime            |
| Load Curve   | `GET /api/v1/agents/{id}/metrics`            | Load on entering detail, 30s staleTime + WS delta |
| Agent Details | `GET /api/v1/agents/{id}`                    | 5s staleTime, WS triggers invalidate         |

**Mobile Adaptation**: List view simplified as a card flow (name + status + health + heartbeat), detail panel expands full screen, hiding dangerous actions like restart/deregister (need to go to Web/Desktop to operate).

**Error Handling and Offline Degradation**:

| Scenario                  | Behavior                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| WS disconnected               | Automatically degrade to 10s polling; top yellow banner "Real-time connection disconnected, data may be delayed"; automatically switch back after WS recovery     |
| API request failure (≤3 times) | Automatic retry (exponential backoff 1s/2s/4s); skeleton remains during retry, no flickering                                 |
| API request failure (>3 times) | Show inline error card (with "Retry" button); cached data continues to display with "Data as of {timestamp}" annotation              |
| Offline mode              | Display the last cached Agent list (read-only); disable write action buttons like restart/deregister, with tooltip indicating offline |
| Agent detail 404        | Show "Agent has been deregistered or is unreachable" empty state; provide "Back to list" link                                        |

### 4.2.8 Data Statistics and Analysis Platform _(added v3.0)_

> Multi-level operational metrics dashboard, covering all dimensions of statistics: tasks, Agents, Workflow, cost, SLO, etc.

**Data Source**: `GET /api/v1/dashboard/metrics` [Implemented/Contracted Layer C] + `MissionControlService.getSnapshot()` + `CostTrackingService` + `dashboard.metric_updated` WS event

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Data Statistics and Analysis          [Time range▼] [Domain▼] [Export▼]          [⟳ Auto] │
├──────────────────────────────────────────────────────────────────────┤
│ KPI overview (role-adaptive)                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │Total Tasks  │ │Success Rate    │ │Avg Duration  │ │Active Agents │ │SLO Compliance │  │
│ │ 1,247    │ │ 94.2%    │ │ 3m 24s   │ │ 38/47    │ │ 99.1%    │  │
│ │ ↑12%     │ │ ↑2.1%    │ │ ↓15%     │ │ —        │ │ ↑0.3%    │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Task Trend Line Chart             │ │ Status Distribution Pie Chart               │      │
│ │ (ECharts Line)             │ │ (ECharts Pie)              │      │
│ │ Dimension: Success/Failed/Cancel       │ │ Dimension: running/blocked/done │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Agent Utilization Heatmap          │ │ Cost Trend + Budget Water Level         │      │
│ │ (ECharts Heatmap)          │ │ (ECharts Line+Area)        │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Top 10 Failure Reasons (Bar)      │ │ Workflow Execution Duration (Box)    │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
├──────────────────────────────────────────────────────────────────────┤
│ Detail table (drillable)                                                   │
│ [Task Details] [Agent Details] [Workflow Details] [Approval Details] [Cost Details]           │
└──────────────────────────────────────────────────────────────────────┘
```

**Indicator System (by Role Level)**:

| Indicator Category | L1 Operator                 | L2 Domain Admin                        | L3 SRE                                | L4 Fleet Management                    |
| -------- | ------------------------- | -------------------------------- | ------------------------------------- | ------------------------------ |
| Tasks     | My task count / success rate         | Domain task throughput / avg duration / top 5 failures | Platform-wide task trend / backlog depth           | Cross-region task distribution / latency comparison        |
| Agent    | My commonly used Agents' health         | Domain Agent utilization / health distribution         | Platform-wide Agent load heatmap / heartbeat anomaly rate    | Fleet Agent capacity planning / utilization trend |
| Workflow | —                         | Domain Workflow execution duration / success rate      | Workflow step bottleneck analysis / retry rate          | Cross-domain Workflow comparison             |
| Approval     | My pending approvals / avg response time | Domain approval backlog / timeout rate                | Platform-wide approval SLA                        | Approval link efficiency comparison               |
| Cost     | My task cost              | Domain cost / budget usage rate / model cost distribution   | Platform-wide cost trend / budget warning               | Fleet cost comparison / capacity-cost efficiency     |
| SLO      | —                         | Domain SLO compliance rate                    | Platform-wide SLO dashboard / error budget burn-down        | Cross-region SLO comparison                |
| System Health | —                         | —                                | Five-plane health / P99 latency / error rate / resource utilization | Cross-region health comparison / capacity prediction        |

**Minimum Fields**:

```typescript
interface DashboardMetricsDTO {
  time_range: { start: string; end: string };
  scope: { domain_id?: string; tenant_id?: string; region?: string };
  kpis: {
    total_tasks: number;
    success_rate: number;
    avg_duration_ms: number;
    active_agents: number;
    total_agents: number;
    slo_compliance: number;
    total_cost: number;
    budget_utilization: number;
  };
  task_trend: TimeSeriesPoint[];
  status_distribution: { status: string; count: number }[];
  agent_utilization: {
    agent_id: string;
    utilization: number;
    health: number;
  }[];
  cost_trend: TimeSeriesPoint[];
  top_failures: { reason: string; count: number }[];
  workflow_durations: {
    workflow_id: string;
    p50: number;
    p95: number;
    p99: number;
  }[];
}

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}
```

**Chart Component Mapping**:

| Indicator          | Chart Type      | ECharts Component | Refresh Strategy                          |
| ------------- | ------------- | ------------ | --------------------------------- |
| Task Trend      | Line Chart        | LineChart    | 1min polling + WS delta           |
| Status Distribution      | Pie Chart / Donut   | PieChart     | 30s staleTime                     |
| Agent Utilization  | Heatmap        | Heatmap      | 30s polling                       |
| Cost Trend      | Area Chart + Line Chart | LineChart    | 5min staleTime                    |
| Top Failure Reasons  | Horizontal Bar    | BarChart     | 1min staleTime                    |
| Workflow Duration | Box Plot        | BoxPlot      | 5min staleTime                    |
| SLO Compliance    | Gauge        | Gauge        | 1min polling                      |
| System Health      | Multi-Axis Line      | LineChart    | 10s polling (SRE) / 1min (others) |

**Mobile Adaptation**: KPI cards scroll horizontally, charts stack in a single column, pull-to-refresh is supported. Detail tables are changed to card lists, with drilldown implemented through a full-screen popup.

**Error Handling and Offline Degradation**:

| Scenario                  | Behavior                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| metrics API timeout/failure | KPI cards display "--" placeholder + "Loading failed" annotation; cached data is displayed with timestamp annotation                                |
| Single chart load failure        | The chart area shows inline error + "Retry" button; other charts are not affected (independent QueryKey)                              |
| ECharts rendering exception      | catch rendering error, fallback to data table view; report to Sentry                                           |
| WS event loss           | Rely on polling fallback; when polling and WS data are inconsistent, polling takes precedence (WS only provides incremental hint)                     |
| Offline mode              | Display the last cached chart snapshot (static image/SVG export); hide time range selector; top prompts "Offline mode, data is frozen" |
| Export failure              | Toast shows failure reason + retry button; large data export is changed to backend asynchronous generation + download link push                          |

### 4.2.9 Configuration Management Center _(added v3.0)_

> Unify management of platform permissions, feature flags, model configuration, domain settings, tenant management, and other global configurations.

**Data Source**: `admin-routes` + `user preference API` + `DomainUIConfig` (§6.1.2) + backend admin/config endpoints

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Configuration Management Center                                                         │
├──────────┬───────────────────────────────────────────────────────────┤
│          │                                                           │
│ Sidebar │  Content Area                                                   │
│          │                                                           │
│ ┌──────┐ │  ┌─────────────────────────────────────────────────────┐ │
│ │👤 User│ │  │ [Current: Permissions]                                    │ │
│ │ Preferences │ │  │                                                     │ │
│ ├──────┤ │  │ ┌─────────────────────────────────────────────────┐ │ │
│ │🔑 Perms│ │  │ │ Role list                                        │ │
│ │ Mgmt │ │  │ │ ┌──────┬────────┬──────────┬────────┬────────┐ │ │ │
│ ├──────┤ │  │ │ │Role  │ Perm Count │ User Count   │ Scope   │ Action   │ │ │
│ │🎛 Feat│ │  │ │ ├──────┼────────┼──────────┼────────┼────────┤ │ │ │
│ │ Flags │ │  │ │ │L1    │ 12     │ 150      │ Personal   │ [Edit] │ │ │
│ ├──────┤ │  │ │ │L2    │ 28     │ 25       │ Domain     │ [Edit] │ │ │
│ │🤖 Modl│ │  │ │ │L3    │ 45     │ 8        │ Platform   │ [Edit] │ │ │
│ │ Config │ │  │ │ │L4    │ 52     │ 3        │ Global   │ [Edit] │ │ │
│ ├──────┤ │  │ │ └──────┴────────┴──────────┴────────┴────────┘ │ │ │
│ │🏢Domain│ │  │ │                                                 │ │ │
│ │ Settings │ │  │ │ Permission details (after expanding role)                           │ │ │
│ ├──────┤ │  │ │ ┌───────────┬──────┬──────┬──────┬──────────┐  │ │ │
│ │🏠Tenant│ │  │ │ │ Feature Page  │ View │ Edit │ Delete │ Manage     │  │ │ │
│ │ Mgmt │ │  │ │ ├───────────┼──────┼──────┼──────┼──────────┤  │ │ │
│ ├──────┤ │  │ │ │ Dashboard │ ✅   │ —    │ —    │ —        │  │ │ │
│ │🔗 Web │ │  │ │ │ Tasks     │ ✅   │ ✅   │ ❌   │ ❌       │  │ │ │
│ │ hook │ │  │ │ │ Agents    │ ✅   │ ✅   │ ✅   │ ✅       │  │ │ │
│ ├──────┤ │  │ │ └───────────┴──────┴──────┴──────┴──────────┘  │ │ │
│ │📋Audit│ │  │ └─────────────────────────────────────────────────┘ │ │
│ │ Logs │ │  └─────────────────────────────────────────────────────┘ │
│ └──────┘ │                                                           │
├──────────┴───────────────────────────────────────────────────────────┤
│ Change audit bar: "Recent changes: L2 permission update by admin@co — 2h ago" [View all] │
└──────────────────────────────────────────────────────────────────────┘
```

**Sub-Page Specifications**:

| Sub-Page       | Route                           | Permission          | Feature Description                                                                                          |
| ------------ | ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------- |
| User Preferences     | `/shared/settings/preferences` | authenticated | Language/Time zone/Theme (light/dark/follow system)/Notification preferences/Default dashboard layout                                              |
| Permissions     | `/shared/settings/permissions` | org_admin+    | RBAC role CRUD / role-permission matrix editing / user-role assignment / permission inheritance visualization                                     |
| Feature Flags     | `/admin/feature-flags`         | platform_sre  | Feature flag list / flag status toggle / grayscale percentage / target domain-tenant-user / change history                                    |
| Model Configuration     | `/shared/settings/models`      | domain_admin+ | LLM model list / model-domain binding / Prompt Policy version management / Token budget / Fallback chain configuration                        |
| Domain Settings       | `/shared/settings/domains/:id` | domain_admin+ | Domain basic info / DomainUIConfig editing (featureVisibility/actionPolicy/glossary) / Agent binding / SLO target       |
| Tenant Management     | `/shared/settings/tenants`     | org_admin+    | Tenant list / tenant CRUD / tenant-domain mapping / tenant-level quota / SSO configuration                                                |
| Webhook Management | `/shared/settings/webhooks`    | domain_admin+ | Webhook endpoint CRUD / event subscription selection / delivery history / retry configuration / Secret management                                      |
| Org Structure     | `/shared/settings/org`         | org_admin+    | Organization tree visualization / department-domain mapping / SSO/SCIM sync configuration / role inheritance rules                                           |
| Audit Logs     | `/governance/audit`            | domain_admin+ | Operation log search / filter (time/user/action type) / export / compliance marking (linked to Governance → Audit module, not an independent page) |

**Minimum Fields**:

```typescript
interface SettingsOverview {
  user_preferences: UserPreferences;
  roles: RoleSummary[];
  feature_flags: FeatureFlagSummary[];
  model_configs: ModelConfigSummary[];
  domains: DomainSummary[];
  tenants: TenantSummary[];
  webhooks: WebhookSummary[];
  recent_changes: AuditEntry[];
}

interface UserPreferences {
  locale: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  notification_channels: ("push" | "email" | "in_app")[];
  default_dashboard_layout: string;
}

interface ModelConfig {
  model_id: string;
  provider: string;
  model_name: string;
  domain_bindings: string[];
  prompt_policy_version: string;
  token_budget: { daily: number; monthly: number };
  fallback_chain: string[];
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

interface FeatureFlag {
  flag_id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  target_domains: string[];
  target_tenants: string[];
  target_users: string[];
  created_by: string;
  updated_at: string;
}

interface TenantConfig {
  tenant_id: string;
  name: string;
  domain_mappings: string[];
  quota: { max_agents: number; max_tasks_per_day: number; storage_gb: number };
  sso_provider?: string;
  status: "active" | "suspended" | "pending";
}
```

**Minimum Actions**:

| Sub-Page   | Action                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| User Preferences | get_preferences · update_preferences                                                                |
| Permissions | list_roles · get_role · create_role · update_role · delete_role · assign_user                       |
| Feature Flags | list_flags · get_flag · create_flag · toggle_flag · update_rollout                                  |
| Model Configuration | list_models · get_model · bind_domain · update_policy · set_budget · set_fallback                   |
| Domain Settings   | get_domain · update_domain · update_ui_config · bind_agents · set_slo                               |
| Tenant Management | list_tenants · create_tenant · update_tenant · suspend_tenant · map_domain                          |
| Webhook  | list_webhooks · create_webhook · update_webhook · delete_webhook · test_webhook · view_delivery_log |

**Mobile Adaptation**: Sidebar navigation is changed to a bottom tab or hamburger menu. Permission matrix tables are changed to cards + expand mode. Model configuration and tenant management only support read-only viewing; editing requires entering Web/Desktop.

**Error Handling and Offline Degradation**:

| Scenario                      | Behavior                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Configuration save failure              | Keep form state, do not clear; show inline error + retry button; after more than 3 failures, prompt "Please contact the administrator"                     |
| Configuration save conflict (409)       | Show diff comparison popup (current value vs latest server value), user chooses to overwrite or merge                                   |
| Insufficient permissions (403)           | Field/button greyed out + tooltip "Requires {required_role} permission"; do not show sub-page navigation items without permission                    |
| Feature flag toggle failure      | Automatically roll back toggle state (optimistic update fallback); Toast shows specific error                                           |
| Offline mode                  | All configuration pages are read-only; edit buttons disabled + tooltip "Cannot edit offline"; cache the last configuration snapshot for viewing                |
| Webhook test_webhook timeout | After 30s timeout, show "Test timeout, please check the reachability of the target endpoint"; show the last successful delivery log for reference                 |
| Monaco editor load failure     | Fallback to `<textarea>` + JSON syntax highlighting (lightweight solution); prompt "Advanced editor failed to load, switched to basic editor" |

### 4.2.10 Implemented Module Summary _(added v3.0)_

The following 9 modules have been listed in §4.1 and their backend data sources are implemented, but have not yet reached the specification depth of the core page blueprints (§4.2.1-4.2.9). This section provides a minimum specification summary for quick frontend integration.

| Module       | Data Source                                                | Minimum DTO / Key Fields                                                        | Main Actions                                      | API Layer |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| Dispatch   | dispatch-routes / dispatch CLI                        | `{ execution_id, worker_id, dispatch_status, created_at, retries }`        | list · dispatch · cancel · retry              | Layer C   |
| Inspect    | `OperatorConsoleBackendService.getSnapshot()`         | `{ snapshot_id, plane, status, metrics{}, timestamp }`                     | get_snapshot · refresh · export               | Layer A→C |
| Health     | dashboard-routes health endpoint                      | `{ overall_status, planes[]{name, status, latency}, uptime }`              | get_health · drill_plane                      | Layer C   |
| Incidents  | `OperatorConsoleBackendService.getIncidentTimeline()` | `{ incident_id, severity, source, message, created_at, resolved_at? }`     | list · acknowledge · resolve · escalate       | Layer A→C |
| Policy     | admin-routes policy endpoint                          | `{ policy_id, type, rules[], enabled, version, updated_by }`               | list · get · update · toggle                  | Layer C   |
| Audit      | admin-routes audit endpoint                           | `{ audit_id, user_id, action, resource, timestamp, details }`              | search · filter · export · mark_compliance    | Layer C   |
| Compliance | [Planned] `/api/v1/compliance`                        | `{ compliance_id, standard, checks[], status, last_audit, score }`         | list · run_check · export_report              | Layer C   |
| Workers    | `GET /api/v1/workers` + `MissionControlService.getStabilityPanel()` | `{ worker_id, status, current_execution, heartbeat, load, region }`        | list · drain · restart · view_logs            | Layer C   |
| Queues     | `GET /api/v1/queues` + `MissionControlService.getStabilityPanel()`  | `{ queue_name, depth, processing, dead_letter_count, oldest_message_age }` | list · purge_dlq · retry_dlq · pause · resume | Layer C   |

## 4.3 Page Data Truth Source Layering (Contract §6 Implementation)

> **Improvement**: Map the three-layer data source of contract §6 to the frontend TanStack Query strategy.

| Data Layer            | Applicable Pages                                                            | Frontend Strategy                                    | Refresh Mode                                        |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| `shared_snapshot` | System Status Bar · Dashboard Home · Stability Header                 | Single `useSnapshot()` query, shared globally        | WebSocket push + 30s polling fallback              |
| `shared_query`    | Dashboard · Stability · ApprovalCenter · Admin Overview                 | Shared query key, automatic deduplication across pages              | WebSocket invalidation + stale-while-revalidate |
| `page_local_api`  | Task inspect · Workflow inspect · Approval inspect · Worker details | Page-level query, fetch when entering the page, GC on leave | Manual refetch + WebSocket push                   |

## 4.4 Routing Architecture

### 4.4.1 Web/Desktop Routing Table

Based on React Router v7, supports lazy loading:

| Route                                       | Page                                  | Permission Requirement        | Code Split |
| ------------------------------------------ | ------------------------------------- | --------------- | ---------- |
| `/`                                        | Dashboard (redirect)                  | authenticated   | No (entry) |
| `/mission-control/dashboard`               | Dashboard                             | authenticated   | Yes         |
| `/mission-control/tasks`                   | TaskCockpit L1                        | authenticated   | Yes         |
| `/mission-control/tasks/:id`               | TaskCockpit L2                        | authenticated   | Yes         |
| `/mission-control/tasks/:id/steps/:stepId` | TaskCockpit L3                        | authenticated   | Yes         |
| `/mission-control/tasks/:id/evidence`      | TaskCockpit L4                        | authenticated   | Yes         |
| `/mission-control/tasks/:id/timeline`      | TaskCockpit L5                        | authenticated   | Yes         |
| `/mission-control/workflows`               | WorkflowCockpit L1                    | pack_developer+ | Yes         |
| `/mission-control/workflows/:id`           | WorkflowCockpit L2                    | pack_developer+ | Yes         |
| `/mission-control/approvals`               | ApprovalCenter                        | authenticated   | Yes         |
| `/mission-control/approvals/:id`           | Approval Detail                       | authenticated   | Yes         |
| `/mission-control/stability`               | StabilityPanel                        | platform_sre    | Yes         |
| `/mission-control/alerts`                  | Alerts                                | authenticated   | Yes         |
| `/operations/dispatch`                     | Dispatch                              | platform_sre    | Yes         |
| `/operations/inspect`                      | Inspect                               | platform_sre    | Yes         |
| `/operations/health`                       | Health                                | platform_sre    | Yes         |
| `/operations/incidents`                    | Incidents                             | platform_sre    | Yes         |
| `/governance/policy`                       | Policy                                | domain_admin+   | Yes         |
| `/governance/audit`                        | Audit                                 | domain_admin+   | Yes         |
| `/governance/compliance`                   | Compliance                            | domain_admin+   | Yes         |
| `/admin/takeover`                          | AdminTakeoverConsole                  | platform_sre    | Yes         |
| `/admin/workers`                           | Worker Panel                          | platform_sre    | Yes         |
| `/admin/queues`                            | Queue Panel                           | platform_sre    | Yes         |
| `/admin/feature-flags`                     | Feature Flags (Configuration Management sub-page §4.2.9) | platform_sre    | Yes         |
| `/extended/conversation`                   | NL Conversation                       | authenticated   | Yes         |
| `/extended/workflow-builder`               | Workflow Builder                      | pack_developer+ | Yes         |
| `/extended/workflow-builder/:id`           | Edit Workflow                         | pack_developer+ | Yes         |
| `/extended/debugger/:id`                   | Workflow Debugger                     | pack_developer+ | Yes         |
| `/extended/agents`                         | Agent Monitoring Center                        | domain_admin+   | Yes         |
| `/extended/agents/:id`                     | Agent Details                            | domain_admin+   | Yes         |
| `/extended/hitl/:runId`                    | HITL Interface                        | authenticated   | Yes         |
| `/shared/explainability/:taskId`           | Explainability Viewer                 | authenticated   | Yes         |
| `/shared/costs`                            | Cost Center                           | domain_admin+   | Yes         |
| `/shared/marketplace`                      | Marketplace                           | authenticated   | Yes         |
| `/shared/marketplace/:id`                  | Marketplace Detail                    | authenticated   | Yes         |
| `/shared/domain-wizard`                    | Domain Wizard                         | domain_admin+   | Yes         |
| `/shared/analytics`                        | Data Statistics Platform                          | authenticated   | Yes         |
| `/shared/settings`                         | Configuration Management Center                          | authenticated   | Yes         |
| `/shared/settings/preferences`             | User Preferences                              | authenticated   | Yes         |
| `/shared/settings/permissions`             | Permissions                              | org_admin+      | Yes         |
| `/shared/settings/models`                  | Model Configuration                              | domain_admin+   | Yes         |
| `/shared/settings/domains/:id`             | Domain Settings                                | domain_admin+   | Yes         |
| `/shared/settings/tenants`                 | Tenant Management                              | org_admin+      | Yes         |
| `/shared/settings/webhooks`                | Webhook Management                          | domain_admin+   | Yes         |
| `/shared/settings/org`                     | Org Structure                              | org_admin+      | Yes         |
| `/login`                                   | Login Page                                | public          | No (entry) |
| `/login/callback`                          | SSO Callback                              | public          | No         |

### 4.4.2 Mobile Navigation Structure

Based on React Navigation v7:

```text
AuthStack (not logged in)
  ├── LoginScreen
  └── SSOCallbackScreen

MainTabs (logged in)
  ├── HomeTab (Stack)
  │   ├── DashboardScreen (L1)
  │   └── NLConversationScreen
  │
  ├── TasksTab (Stack)
  │   ├── TaskListScreen
  │   ├── TaskDetailScreen → Steps → Evidence → Timeline
  │   └── ExplainabilityScreen
  │
  ├── ApprovalsTab (Stack)
  │   ├── ApprovalListScreen
  │   └── ApprovalDetailScreen
  │
  ├── MarketplaceTab (Stack)
  │   ├── MarketplaceListScreen
  │   └── MarketplaceDetailScreen
  │
  └── MoreTab (Stack)
      ├── AnalyticsScreen (L1 personal dimension)
      ├── AgentListScreen
      ├── CostCenterScreen
      ├── SettingsScreen
      └── HITLScreen
```

**Navigation Features**:

| Feature       | Implementation Method                                   |
| ---------- | ------------------------------------------ |
| Bottom Tabs   | 5 main tabs (Home/Tasks/Approvals/Marketplace/More)     |
| Badge Counter | Approval tab shows pending count (pushed in real-time via WebSocket) |
| Deep Linking   | `aa://tasks/123` → jump to task details          |
| Gesture Navigation   | iOS edge back; Android Back button              |
| State Preservation   | Preserve list scroll position and filter conditions when switching tabs       |

### 4.4.3 Permission Routing Guard Chain

```text
Routing guard chain:
  1. AuthGuard       → Check whether logged in (otherwise redirect to /login)
  2. TenantGuard     → Check whether tenant is valid
  3. PermissionGuard → Check whether role/permission satisfies route requirement
  4. FeatureGuard    → Check whether feature flag is enabled
  5. ModeGuard       → Enterprise mode / single-user mode feature visibility
```

## 4.5 Page-Level Permission Matrix

### 4.5.1 Page Visibility Matrix

| Page/Module             | Independent Operator (L1) | Business Line Owner (L1) | Domain Admin (L2)   | Pack Developer (L2/L3) | Platform SRE (L3/L4)  |
| --------------------- | -------------- | ---------------- | -------------- | ------------------ | ---------------- |
| Dashboard             | ✅ Own domain      | ✅ Business line domain      | ✅ Jurisdiction domain      | ✅ Development domain          | ✅ Global          |
| TaskCockpit           | ✅ Own tasks    | ✅ Business line tasks    | ✅ Intra-domain tasks    | ✅ Development-related tasks    | ✅ All tasks      |
| WorkflowCockpit       | ❌             | ✅ Read-only          | ✅             | ✅                 | ✅               |
| ApprovalCenter        | ✅ Own approvals    | ✅ Business line approvals    | ✅ Intra-domain approvals    | ❌                 | ✅ All approvals      |
| StabilityPanel        | ❌             | ❌               | ⚠️ Domain health      | ❌                 | ✅               |
| AdminTakeoverConsole  | ❌             | ❌               | ❌             | ❌                 | ✅               |
| NL Conversation       | ✅             | ✅               | ✅             | ✅                 | ✅               |
| WorkflowBuilder       | ❌             | ❌               | ❌             | ✅                 | ✅               |
| WorkflowDebugger      | ❌             | ❌               | ❌             | ✅                 | ✅               |
| AgentManager          | ❌             | ❌               | ✅             | ✅                 | ✅               |
| Marketplace           | ✅ Browse        | ✅ Browse          | ✅ Install        | ✅ Publish + Install       | ✅ All          |
| CostCenter            | ✅ Own domain      | ✅ Business line        | ✅ Domain level        | ❌                 | ✅ Global          |
| DomainWizard          | ❌             | ❌               | ✅             | ❌                 | ✅               |
| Settings              | ✅ Personal        | ✅ Personal          | ✅ Domain + Personal     | ✅ Personal            | ✅ Global + Personal     |
| AgentMonitor (§4.2.7) | ❌             | ❌               | ✅ Domain Agent    | ✅ Development Agent      | ✅ Global          |
| Analytics (§4.2.8)    | ✅ Personal dimension    | ✅ Business line dimension    | ✅ Domain dimension      | ✅ Development dimension        | ✅ Platform-wide + Cross-region |
| ConfigCenter (§4.2.9) | ✅ Preferences only    | ✅ Preferences only      | ✅ Domain settings + Models | ❌                 | ✅ All          |

### 4.5.2 Key Action Permission Matrix

| Action                     | Independent Operator (L1) | Business Line Owner (L1) | Domain Admin (L2) | Pack Developer (L2/L3) | Platform SRE (L3/L4) | Secondary Confirmation  |
| ------------------------ | -------------- | ---------------- | ------------ | ------------------ | --------------- | --------- |
| Create task                 | ✅             | ✅               | ✅           | ✅                 | ✅              | ❌        |
| Cancel task                 | ✅ Own        | ✅ Business line        | ✅ Intra-domain      | ❌                 | ✅ Any         | ✅        |
| Approve approve/reject      | ✅ Assigned      | ✅ Business line        | ✅ Intra-domain      | ❌                 | ✅ Any         | ✅        |
| Admin Takeover           | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅✅ Two-person |
| Panic emergency stop           | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅✅ Two-person |
| Publish Pack to Marketplace | ❌             | ❌               | ❌           | ✅                 | ✅              | ✅ Approval flow |
| Install Marketplace Pack    | ❌             | ❌               | ✅           | ✅ Dev environment        | ✅              | ✅        |
| Modify domain configuration               | ❌             | ❌               | ✅           | ❌                 | ✅              | ✅        |
| Worker management              | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅        |
| View Explainability      | ✅ Own task    | ✅ Business line        | ✅ Intra-domain      | ✅                 | ✅              | ❌        |

### 4.5.3 Drilldown Level Permission

| Drilldown Level | Content                        | Independent Operator | Business Line Owner | Domain Admin | Pack Developer | Platform SRE |
| -------- | --------------------------- | ---------- | ------------ | -------- | ----------- | -------- |
| L1       | Overview/Summary                   | ✅         | ✅           | ✅       | ✅          | ✅       |
| L2       | Details/Step List               | ✅         | ✅           | ✅       | ✅          | ✅       |
| L3       | Execution Log/Evidence           | ❌         | ⚠️ Redacted      | ✅       | ✅          | ✅       |
| L4       | Raw JSON/Debug Info          | ❌         | ❌           | ⚠️ Read-only  | ✅          | ✅       |
| L5       | Internal State/Reliability Fabric | ❌         | ❌           | ❌       | ❌          | ✅       |

**Implementation Method**:

- The frontend checks the `auth-store.permissions` array in the route guard
- Page-level hiding: navigation items that do not satisfy permissions are not rendered (not disabled)
- Action-level control: returns `{ allowed, reason }` through the `usePermission(action, resource)` hook
- Drilldown level: the component receives the `maxDrillDepth` prop, computed by `usePermission` as the maximum level accessible to the current user

### 4.5.4 Field-Level Visibility and Redaction Matrix _(added v2.3)_

Beyond page/action/drilldown level permissions, the platform UI also needs a fourth layer of control—**field-level visibility and redaction**. The following matrix defines the visibility and redaction rules for each role on different data fields.

#### FieldVisibilityPolicy

| Field Category                         | Independent Operator (L1) | Business Line Owner (L1) | Domain Admin (L2) | Pack Developer (L2/L3) | Platform SRE (L3/L4) |
| -------------------------------- | -------------- | ---------------- | ------------ | ------------------ | --------------- |
| Task title/summary                    | ✅ Plaintext        | ✅ Plaintext          | ✅ Plaintext      | ✅ Plaintext            | ✅ Plaintext         |
| Task parameters/input JSON               | ⚠️ Summary        | ⚠️ Summary          | ✅ Plaintext      | ✅ Plaintext            | ✅ Plaintext         |
| Tool Call payload (parameters + return value) | ❌ Hidden        | ⚠️ Redacted          | ✅ Plaintext      | ✅ Plaintext            | ✅ Plaintext         |
| Prompt / Policy version number           | ❌ Hidden        | ❌ Hidden          | ⚠️ Version number only  | ✅ Plaintext            | ✅ Plaintext         |
| Prompt original / Policy original        | ❌ Hidden        | ❌ Hidden          | ❌ Hidden      | ✅ Plaintext            | ✅ Plaintext         |
| Evidence raw JSON               | ❌ Hidden        | ⚠️ Summary          | ⚠️ Redacted      | ✅ Plaintext            | ✅ Plaintext         |
| Assignee / Owner name            | ✅ Plaintext        | ✅ Plaintext          | ✅ Plaintext      | ⚠️ ID only           | ✅ Plaintext         |
| Tenant / Workspace ID            | ⚠️ Current tenant only  | ⚠️ Current tenant only    | ⚠️ Jurisdiction domain only  | ⚠️ Development domain only        | ✅ All         |
| Worker node IP / hostname          | ❌ Hidden        | ❌ Hidden          | ❌ Hidden      | ❌ Hidden            | ✅ Plaintext         |
| Error stacktrace                 | ❌ Hidden        | ❌ Hidden          | ⚠️ First line      | ✅ Plaintext            | ✅ Plaintext         |
| Cost amount details                    | ✅ Own domain      | ✅ Business line        | ✅ Domain level      | ❌ Hidden            | ✅ Global         |
| Model / LLM provider identifier        | ❌ Hidden        | ❌ Hidden          | ⚠️ Model name only  | ✅ Plaintext            | ✅ Plaintext         |

**Legend**: ✅ Plaintext = display original value; ⚠️ Redacted/Summary = partially hidden or only summary displayed; ❌ Hidden = the field is not rendered.

#### RedactionRule Type Definition

```typescript
type RedactionLevel = "visible" | "summary" | "redacted" | "hidden";

interface RedactionRule {
  fieldPattern: string;
  roleLevel: RoleLevel;
  redactionLevel: RedactionLevel;
  summaryTemplate?: string;
  redactionMask?: string;
}

interface FieldVisibilityPolicy {
  rules: RedactionRule[];
  defaultLevel: RedactionLevel;
  piiFields: string[];
  auditOnAccess: boolean;
}
```

#### PIIHandlingByRole

| PII Category         | Storage Layer Behavior                     | L1 Display       | L2 Display  | L3/L4 Display   |
| ---------------- | ------------------------------ | ------------- | -------- | ------------ |
| User real name         | Store hash in cache                | First name only      | First name only | Full name     |
| Email address         | Do not write to offlineStore            | `j***@co.com` | Full     | Full         |
| IP address          | Do not write to IndexedDB / SQLite cache | Hidden          | Hidden     | Plaintext         |
| Biometric binding info | L4 SecureStorage only            | Hidden          | Hidden     | "Bound" indicator |
| Organization path     | Cache only stores subtree visible to current user     | Own node      | Jurisdiction subtree | Full tree         |

**Implementation Method**:

- `shared/domain/field-visibility.ts` exports `applyRedaction(field, value, role): RedactedValue`
- Call `applyRedaction` in the ViewModel mapper, complete redaction during the DTO → VM conversion phase, no need for the component layer to be aware
- Fields with `auditOnAccess: true` automatically report telemetry `field_access` events when displayed at L3/L4 level
- The PII field list is declared by `FieldVisibilityPolicy.piiFields`, aligned with the backend `data-classification` policy

## 4.6 Key Module Implementation Blueprint

> The following implementation details are extracted from the high-value content confirmed by review in the Doc-11 historical implementation draft.

### 4.6.1 NL Conversation State Machine → UI Mapping

| State         | UI Performance                                  | Backend Event                   | Status          |
| ------------ | ---------------------------------------- | -------------------------- | ------------- |
| `idle`       | Input box placeholder + recommended action card        | —                          | [Implemented] |
| `parsing`    | Input disabled + "Understanding..." skeleton animation          | —                          | [Implemented] |
| `clarifying` | Agent follow-up bubble + option button/input box         | `nl.clarification_needed`  | [Proposed]    |
| `building`   | "Building task..." progress indicator               | —                          | [Implemented] |
| `confirming` | Risk preview card + confirm/modify/cancel button        | `goal.decomposition_ready` | [Planned]     |
| `executing`  | Real-time step progress bar + current step description            | `progress`                 | [Implemented] |
| `reporting`  | Result summary card + details link + "Why?" button | `completed` / `failed`     | [Implemented] |

### 4.6.2 HITL Human-Machine Collaboration Operation Panel

| Operation     | Description                        | UI Component                     | Status          |
| -------- | --------------------------- | --------------------------- | ------------- |
| Inspect  | View current PlanBundle/Context | JSON Tree + collapsible panel      | [Implemented] |
| Patch    | Modify current plan parameters            | Form editor + diff preview      | [Planned]     |
| Override | Override Agent decision             | Dropdown to select alternative + reason input | [Planned]     |
| Takeover | Fully take over manual execution            | Full-featured operation panel + operation record   | [Implemented] |
| Resume   | Resume execution (4 mode options)    | Radio + confirm button             | [Implemented] |

**Resume Modes**:

| Mode                 | Description                       | Status          |
| -------------------- | -------------------------- | ------------- |
| `resume_same_state`  | Resume as-is, continue execution         | [Implemented] |
| `resume_with_replan` | Trigger P3 replanning           | [Implemented] |
| `resume_supervised`  | Supervised mode resume (each step requires confirmation) | [Planned]     |
| `abort_on_resume`    | Safe termination                   | [Implemented] |

### 4.6.3 Workflow Debugger Capability Matrix

| Capability          | Running | Completed | UI Implementation                               | Status       |
| ------------- | ------ | ------ | ------------------------------------- | ---------- |
| Execution Timeline    | Real-time   | Replay   | Horizontal timeline + step card (color-coded status) | [Planned]  |
| OAPEFLIR Step Into | ✓      | ✓      | Expand step → O/A/P/E/F/L/I/R phase panels | [Planned]  |
| Data Flow View    | ✓      | ✓      | JSON diff between steps (input→output)         | [Planned]  |
| Side Effect Diff   | ✗      | ✓      | Expected vs actual side effect side-by-side comparison     | [Proposed] |
| Breakpoint Debugging      | ✓      | ✗      | Click step to set breakpoint; conditional breakpoint dialog        | [Proposed] |
| Time Travel      | ✗      | ✓      | Timeline slider + ContextSnapshot preview     | [Deferred] |
| Run Comparison      | ✗      | ✓      | Double column side-by-side + difference highlight                   | [Deferred] |

**Backend Dependency Note**: Breakpoint debugging and time travel rely on the backend DebuggerService providing the `ws/v1/debug/{workflow_id}` endpoint (currently [Proposed]). Before this endpoint is stable, the debugger only supports read-only playback of the execution timeline and data flow view.

### 4.6.4 Approval Center Interaction Features

| Feature       | Web/Desktop                                    | Mobile             | Status      |
| ---------- | ------------------------------------------- | ------------------ | --------- |
| Quick Actions   | Keyboard shortcuts A(approve)/R(reject)/D(delegate) | Notification bar quick action button | [Planned] |
| Batch Operations   | Select all + batch approve (Low risk only)              | Swipe gesture batch operation   | [Planned] |
| Context Preview | Right panel expand ApprovalContext                | Detail page full-screen display     | [Planned] |
| Delegate       | Organization tree popup selection                          | Search + recent contacts  | [Planned] |
| Timeout Reminder   | Countdown tag + last 30min highlighted                 | Push notification + vibration    | [Planned] |

### 4.6.5 NL Conversation Module Page Wireframe

```text
Web/Desktop:
┌─────────────────────────────────────────────────────────┐
│  NL Conversation Panel (can be docked to the right or independent full screen)              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Message Stream                          │    │
│  │                                                 │    │
│  │  [User] Help me launch the spring marketing campaign                      │    │
│  │                                                 │    │
│  │  [Agent] OK, I need to confirm a few pieces of information:               │    │
│  │  • Which product's marketing campaign?                          │    │
│  │  • Budget range?                                   │    │
│  │  • Deadline?                                   │    │
│  │                                                 │    │
│  │  [System] Risk preview card                           │    │
│  │  ┌─────────────────────────────────────┐        │    │
│  │  │ Will create 3 subtasks · Estimated ¥2,500     │        │    │
│  │  │ Requires ad compliance approval                       │        │    │
│  │  │ [Confirm] [Modify] [Cancel]                 │        │    │
│  │  └─────────────────────────────────────┘        │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Input box] │ Voice │ Attachment │ Cmd+K command palette          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

Mobile:
┌────────────────────────┐
│ ← NL Conversation         ···  │
│                        │
│ Message stream (full screen)          │
│                        │
│ [Input box] [Voice] [Attachment]  │
└────────────────────────┘
```

**Shared Hooks**:

```typescript
interface UseConversation {
  messages: Message[];
  status: ConversationStatus;
  sendMessage(text: string): Promise<void>;
  sendVoice(audio: Blob): Promise<void>;
  attachFile(file: FileRef): Promise<void>;
  confirmAction(actionId: string): Promise<void>;
  cancelAction(actionId: string): Promise<void>;
}
```

### 4.6.6 Task Management Three-Column Layout Wireframe

```text
Web/Desktop (xl breakpoint):
┌───────────┬──────────────────────────┬─────────────────┐
│ Filter sidebar   │ Task list                  │ Task detail panel      │
│           │                          │                 │
│ Status ▾    │ ● Spring marketing  executing ▶  │ Goal:...        │
│ □ All    │   Ad domain  2h ago            │ Status: executing  │
│ ■ In progress  │                          │ Progress: 2/4        │
│ □ Completed  │ ● Monthly report  completed ✓  │                 │
│ □ Pending approval  │   Data domain  5h ago            │ [DAG dependency graph]     │
│ □ Failed    │                          │                 │
│           │ ● Customer cleaning  awaiting ⏳  │ Step list:        │
│ Domain ▾      │   Data domain  1d ago            │ ▶ Step 1 ✓      │
│ □ All    │                          │ ▶ Step 2 ✓      │
│ ■ Ad    │                          │ ▼ Step 3 ▶      │
│ □ Data    │                          │   OAPEFLIR: E   │
│           │                          │ ○ Step 4 ...    │
│ Date ▾    │                          │                 │
│ Recent 7 days   │                          │ [Explain] [Cost]    │
└───────────┴──────────────────────────┴─────────────────┘
```

**Information Hierarchy**:

| Level | Content                                            | Display Condition       |
| ---- | ----------------------------------------------- | -------------- |
| L0   | Title, status badge, domain label, time                    | List item always displays |
| L1   | Progress percentage, subtask count, current step, duration            | Detail panel selected   |
| L2   | DAG dependency graph, step list (OAPEFLIR phase), tool records | Expand details       |
| L3   | Full HarnessRun, ContextSnapshot, Evidence link | "Full Record" jump |

### 4.6.7 Approval Center Page Wireframe

```text
┌────────────────────────────────────────────────────┐
│  Approval Center                                            │
│  Pending (3) │ Processed (28) │ Delegated (5)              │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Urgent │ Quantitative strategy deployment   Critical │ Remaining 2h       │  │
│  │ Domain: quant-trading                            │  │
│  │ Summary: Agent requests deployment of new trading strategy                 │  │
│  │ Risk assessment: [Expand]                              │  │
│  │ [Approve] [Reject] [Delegate] [Supplement]                   │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Normal │ Price adjustment       High │ Remaining 24h          │  │
│  │ ...                                          │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 4.6.8 Operations Dashboard Four-Layer Architecture

| Dashboard Level | Role     | Core Panel                                           | Refresh Strategy    |
| -------- | -------- | -------------------------------------------------- | ----------- |
| L1       | Operator   | My tasks, approvals, Agent health, budget, NL briefing          | Real-time + 5min |
| L2       | Domain Mgmt   | Domain throughput, Agent utilization, SLO, Top failures, cost distribution    | 1min + 5min |
| L3       | Platform SRE | Five-plane health, resource utilization, error rate, latency, Incident     | 10s + 30s   |
| L4       | Fleet Mgmt | Cross-region status, fleet cost, tenant comparison, capacity forecast, compliance posture | 1min + 1h   |

**Detailed Specifications for Each Level Panel** _(extended v3.0)_:

| Level | Panel Name        | Data Source                                                | Chart Type        | Refresh Interval |
| ---- | --------------- | ----------------------------------------------------- | --------------- | -------- |
| L1   | My Task Overview    | `GET /api/v1/tasks?owner=me`                          | KPI Card        | Real-time WS  |
| L1   | Pending Approval Queue      | `MissionControlService.listApprovalQueue()`           | List + Badge    | Real-time WS  |
| L1   | My Agent Health | `GET /api/v1/agents?scope=my_domain`                  | Status Indicator      | 10s      |
| L1   | Budget Utilization      | `GET /api/v1/costs?scope=my_domain`                   | Gauge           | 5min     |
| L2   | Domain Task Throughput    | `GET /api/v1/dashboard/metrics?scope=domain`          | Line Chart          | 1min     |
| L2   | Agent Utilization    | `GET /api/v1/dashboard/metrics?metric=agent`          | Heatmap          | 1min     |
| L2   | SLO Compliance      | `GET /api/v1/dashboard/metrics?metric=slo`            | Gauge           | 5min     |
| L2   | Top 5 Failure Reasons  | `GET /api/v1/dashboard/metrics?metric=failures`       | Horizontal Bar      | 5min     |
| L2   | Domain Cost Distribution      | `GET /api/v1/costs?scope=domain&breakdown=model`      | Pie Chart            | 5min     |
| L3   | Five-Plane Health      | `GET /api/v1/dashboard/metrics?metric=health`         | Multi-Axis Line        | 10s      |
| L3   | P99 Latency        | `GET /api/v1/dashboard/metrics?metric=latency`        | Line Chart + Threshold | 10s      |
| L3   | Error Rate          | `GET /api/v1/dashboard/metrics?metric=errors`         | Area Chart          | 10s      |
| L3   | Resource Utilization      | `GET /api/v1/dashboard/metrics?metric=resources`      | Gauge Cluster      | 30s      |
| L3   | Incident Timeline | `OperatorConsoleBackendService.getIncidentTimeline()` | Timeline          | Real-time WS  |
| L4   | Cross-Region Status      | `GET /api/v1/dashboard/metrics?scope=fleet`           | Geo Heatmap      | 1min     |
| L4   | Fleet Cost Comparison    | `GET /api/v1/costs?scope=fleet`                       | Grouped Bar Chart      | 1h       |
| L4   | Tenant Comparison        | `GET /api/v1/dashboard/metrics?scope=tenants`         | Radar Chart          | 1h       |
| L4   | Capacity Forecast        | `GET /api/v1/dashboard/metrics?metric=capacity`       | Forecast Line Chart      | 1h       |

**Adaptive Rules**:

- Single-user mode: only L1 dashboard, hide multi-tenant/organization panels
- Enterprise mode: auto-switch L1-L4 according to user role
- All dashboard panels support drag-and-drop sorting + visibility configuration
- Dashboard layout is persisted to `UserPreferences.default_dashboard_layout` (Configuration Management Center §4.2.9)

### 4.6.9 Workflow Builder Technical Solution

| Component     | Technology         | Description                                 |
| -------- | ------------ | ------------------------------------ |
| Canvas     | React Flow   | Node canvas, supports zoom/pan/box select/snap    |
| Node Types | Custom Node  | Trigger/Action/Condition/Loop/Parallel/Wait/Approval |
| Connection     | Directed Edge       | Conditional branch annotation + data flow type annotation        |
| Validation     | DAG Topological Validation | Real-time detection of loops, missing connections, unfilled parameters     |
| Preview     | Dry-run      | Sandbox execution, no real side effects      |
| Property Panel | Right Drawer     | Configuration form displayed after node selection               |
| Component Panel | Left Panel     | Searchable/draggable component list                |

**Mobile Strategy**: Mobile only supports read-only viewing of the Workflow diagram (zoom + node detail popup), editing is not supported. Reason: canvas drag-and-drop editing has a poor experience on small screens, and React Flow does not support React Native.

### 4.6.10 Debugger Real-Time Data Flow

```text
WebSocket /ws/v1/debug/{workflow_id}
  │
  ▼
DebugEventStream
  ├── step_started     → Timeline adds new step card
  ├── step_progress    → Step card progress update
  ├── oapeflir_phase   → OAPEFLIR panel switches in real-time
  ├── tool_call        → Tool call log appended
  ├── evaluator_report → Evaluator result panel refresh
  ├── breakpoint_hit   → Pause indicator + breakpoint panel popup
  ├── step_completed   → Step card color change (green/red)
  └── run_completed    → Timeline locked + enable time travel
```

### 4.6.11 Agent Monitoring Center Technical Solution _(added v3.0)_

**Core Components**:

| Component           | Technology                   | Description                                             |
| -------------- | ---------------------- | ------------------------------------------------ |
| Agent List     | Virtual Scroll + WS Real-Time Update | Supports 500+ Agent list without lag, WS push incremental update      |
| Health Indicator   | `AgentHealthIndicator` | Reuse `ui-core/business/` existing component, supports 4-color status |
| Heartbeat Timeline     | ECharts Scatter        | X-axis time, Y-axis heartbeat interval, abnormal points marked in red               |
| Load Curve       | ECharts Line           | Dual Y-axis: active_tasks + queue_depth              |
| Agent Detail Drawer | Right Drawer 640px      | Tab switch: Basic Info/Capability/Heartbeat/Load/Tasks/Errors      |

**useAgentMonitor Hook**:

```typescript
function useAgentMonitor(filters: AgentFilters) {
  const agents = useQuery({
    queryKey: ["agents", "list", filters],
    queryFn: () => agentApi.list(filters),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  useWSSubscription("agent.*", (event) => {
    queryClient.invalidateQueries({ queryKey: ["agents"] });
  });

  const summary = useMemo(
    () => ({
      total: agents.data?.length ?? 0,
      healthy: agents.data?.filter((a) => a.status === "active").length ?? 0,
      degraded: agents.data?.filter((a) => a.status === "degraded").length ?? 0,
      offline: agents.data?.filter((a) => a.status === "offline").length ?? 0,
    }),
    [agents.data],
  );

  return { agents, summary };
}
```

### 4.6.12 Data Statistics Platform Technical Solution _(added v3.0)_

**Chart Rendering Architecture**:

```text
DashboardMetricsDTO (API)
  │
  ▼
useMetricsQuery(scope, timeRange)
  │
  ├── KPI Aggregation ──────────→ <KPICardGrid>
  ├── task_trend ─────────→ <TaskTrendChart type="line">
  ├── status_distribution → <StatusPieChart type="pie">
  ├── agent_utilization ──→ <AgentHeatmap type="heatmap">
  ├── cost_trend ─────────→ <CostAreaChart type="area">
  ├── top_failures ───────→ <FailureBarChart type="bar">
  └── workflow_durations ─→ <WorkflowBoxPlot type="boxplot">
```

**Role-Adaptive Rules**:

| User Role | Visible Charts                                    | Default Time Range |
| -------- | ------------------------------------------- | ------------ |
| L1       | KPI Card (personal dimension) + My Task Trend          | 7 days         |
| L2       | All charts (domain dimension)                          | 30 days        |
| L3       | All charts (platform-wide) + System Health Panel + P99 Latency | 24 hours      |
| L4       | All charts (cross-region) + Capacity Forecast + Tenant Comparison     | 30 days        |

**useMetricsQuery Hook**:

```typescript
function useMetricsQuery(scope: MetricsScope, timeRange: TimeRange) {
  return useQuery({
    queryKey: ["dashboard", "metrics", scope, timeRange],
    queryFn: () => dashboardApi.getMetrics(scope, timeRange),
    staleTime: scope.role === "sre" ? 10_000 : 60_000,
    refetchInterval: scope.role === "sre" ? 10_000 : 60_000,
  });
}
```

### 4.6.13 Configuration Management Center Technical Solution _(added v3.0)_

**Sub-Page Routing and Lazy Loading**:

```typescript
const settingsRoutes = [
  { path: "preferences", component: lazy(() => import("./UserPreferences")) },
  { path: "permissions", component: lazy(() => import("./PermissionManager")) },
  { path: "models", component: lazy(() => import("./ModelConfig")) },
  { path: "domains/:id", component: lazy(() => import("./DomainSettings")) },
  { path: "tenants", component: lazy(() => import("./TenantManager")) },
  { path: "webhooks", component: lazy(() => import("./WebhookManager")) },
];
```

**Permission Matrix Editor**:

| Component           | Technology                | Description                                           |
| -------------- | ------------------- | ---------------------------------------------- |
| Role-Permission Matrix  | `<PermissionGrid>`  | Row=feature page, column=action (CRUD+manage), cell=switch |
| Permission Inheritance Visualization | Tree Diagram + Highlight Inheritance Chain | Display role inheritance relationships, highlight the source of current permissions             |
| User-Role Assignment  | Transfer(穿梭框)    | Left=assignable users, right=assigned users, supports batch operations     |
| Change Diff Preview | Change Before/After Comparison Table      | Display change summary before saving, requires secondary confirmation                 |

**Model Configuration Management**:

| Component               | Technology               | Description                                          |
| ------------------ | ------------------ | --------------------------------------------- |
| Model List           | Data Table           | Display provider/model/domain binding count/Token budget usage rate |
| Prompt Policy Editor | Monaco Editor Embed | Supports JSON/YAML editing + syntax check + diff preview    |
| Token Budget Dashboard   | ECharts Gauge      | Daily/Monthly budget usage rate, over-limit alert                     |
| Fallback Chain Editor    | Drag-and-Drop Sortable List       | Drag-and-drop to adjust fallback priority                      |
| Domain Binding Management         | Transfer             | Left=available domains, right=bound domains                        |

**Feature Flag Management**:

| Component       | Technology                   | Description                                   |
| ---------- | ---------------------- | -------------------------------------- |
| Flag List   | Data Table               | Name/Status/Rollout percentage/Target scope/Last updated |
| Rollout Slider   | Slider + Number Input      | 0-100% rollout percentage control                  |
| Target Selector | Multi-Level Selection (Domain → Tenant → User) | Gradually narrow the rollout scope                       |
| Change History   | Timeline Component             | Who changed what when, supports rollback         |

## 4.7 Planned Module Mini-Contract _(added v2.3)_

The following 6 `[Planned]` modules have been incorporated into the information architecture (§4.1), but lack closed-loop contracts. This section defines the minimum contract blocks (minimal DTO / actions / query keys / permission / WS needs / offline rule) for each module, as the alignment baseline for backend API design and frontend mock-server.

> **Data Authority Convention** _(added v3.0)_: Each mini-contract adds three dimensions (Authoritative Source / Derived Source / Projection Owner) to prevent the frontend from mistaking UI projections for authoritative facts.
>
> - **Authoritative Source**: The single source of truth for the module's data (backend service / external system)
> - **Derived Source**: Derived data sources aggregated or projected from the authoritative source
> - **Projection Owner**: The team/module responsible for maintaining the DTO → ViewModel projection logic, and the owner is responsible for updating when the schema changes

### 4.7.1 AgentManager

| Dimension                 | Definition                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ agent_id, name, domain_id, status, health, version, capabilities[], last_heartbeat, created_at }` |
| Actions              | `list` · `get(id)` · `register` · `deregister` · `update_config` · `restart`                         |
| Query Keys           | `["agents"]` · `["agents", "list", filters]` · `["agents", "detail", id]`                            |
| Permission           | Domain Admin (L2): list+get; Pack Developer (L2/L3): full CRUD; SRE (L3/L4): full + restart                    |
| WS Needs             | `agent.health_changed` · `agent.registered` · `agent.deregistered`                                   |
| Offline Rule         | Read-only browsing allows stale cache; register/deregister/restart must be online                                                     |
| API Endpoint         | `CRUD /api/v1/agents` · `POST /api/v1/agents/{id}/restart`                                           |
| Authoritative Source | `AgentRegistryService` (src/domains/registry/)                                                       |
| Derived Source       | `MissionControlService.getSnapshot()` → agents summary (non-authoritative, projection only)                                |
| Projection Owner     | Frontend `feature-agent-manager` module                                                                    |

### 4.7.2 WorkflowBuilder

| Dimension                 | Definition                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ workflow_id, name, domain_id, steps[], edges[], version, status, created_by, updated_at }`             |
| Actions              | `list` · `get(id)` · `create` · `update` · `delete` · `validate` · `publish` · `clone`                    |
| Query Keys           | `["workflows"]` · `["workflows", "list", filters]` · `["workflows", "detail", id]`                        |
| Permission           | Pack Developer (L2/L3): full CRUD; SRE (L3/L4): full + publish                                                 |
| WS Needs             | `workflow.updated` · `workflow.published` · `workflow.validation_result`                                  |
| Offline Rule         | Canvas editing allows offline queuing (local draft); publish/validate must be online                                                       |
| API Endpoint         | `CRUD /api/v1/workflows` · `POST /api/v1/workflows/{id}/validate` · `POST /api/v1/workflows/{id}/publish` |
| Authoritative Source | `WorkflowDefinitionService` (src/platform/five-plane-orchestration/)                                                 |
| Derived Source       | `MissionControlService.getWorkflowCockpit()` → workflow summary (non-authoritative, projection only)                            |
| Projection Owner     | Frontend `feature-workflow-builder` module                                                                      |

### 4.7.3 WorkflowDebugger

| Dimension                 | Definition                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ debug_session_id, workflow_id, execution_id, timeline_events[], breakpoints[], current_step, state_snapshot }`         |
| Actions              | `start_session` · `set_breakpoint` · `remove_breakpoint` · `step_over` · `resume` · `inspect_state` · `replay_from(step)` |
| Query Keys           | `["debug", workflowId]` · `["debug", "session", sessionId]` · `["debug", "timeline", executionId]`                        |
| Permission           | Pack Developer (L2/L3): full; SRE (L3/L4): full                                                                                |
| WS Needs             | `ws/v1/debug/{workflow_id}` — `debug.step_entered` · `debug.breakpoint_hit` · `debug.state_snapshot`                      |
| Offline Rule         | All must be online (real-time debugging depends on WS connection)                                                                                      |
| API Endpoint         | `POST /api/v1/debug/sessions` · `GET /api/v1/debug/sessions/{id}` · `DELETE /api/v1/debug/sessions/{id}`                  |
| Authoritative Source | `DebuggerService` (src/ops-maturity/debugger/) + `ExecutionEngine` runtime state                                             |
| Derived Source       | The `state_snapshot` pushed by WS in real time is a runtime projection, not a persistent truth                                                                 |
| Projection Owner     | Frontend `feature-workflow-debugger` module                                                                                     |

### 4.7.4 Marketplace

| Dimension                 | Definition                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ pack_id, name, description, author, version, domain_tags[], rating, download_count, compatibility, status }`                           |
| Actions              | `list` · `search` · `get(id)` · `install` · `uninstall` · `publish` · `review` · `rate`                                                   |
| Query Keys           | `["marketplace"]` · `["marketplace", "list", filters]` · `["marketplace", "detail", id]` · `["marketplace", "installed"]`                 |
| Permission           | L1: browse+rate; Domain Admin (L2): install+uninstall; Pack Developer: publish; SRE: full                                                         |
| WS Needs             | `marketplace.pack_published` · `marketplace.pack_updated` · `marketplace.install_completed`                                               |
| Offline Rule         | Browsing allows stale cache; install/uninstall/publish must be online                                                                                              |
| API Endpoint         | `GET /api/v1/marketplace` · `GET /api/v1/marketplace/{id}` · `POST /api/v1/marketplace/{id}/install` · `POST /api/v1/marketplace/publish` |
| Authoritative Source | `MarketplaceService` (src/scale-ecosystem/marketplace/)                                                                                   |
| Derived Source       | None (Marketplace is its own source of truth)                                                                                                            |
| Projection Owner     | Frontend `feature-marketplace` module                                                                                                           |

### 4.7.5 Explainability

| Dimension                 | Definition                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ explanation_id, task_id, step_id, explanation_type, reasoning_chain[], confidence, sources[], generated_at }` |
| Actions              | `query(task_id, step_id?)` · `get(explanation_id)` · `rate_helpfulness` · `export`                               |
| Query Keys           | `["explanations", taskId]` · `["explanations", "detail", explanationId]`                                         |
| Permission           | L1: own task summary; Domain Admin (L2): intra-domain full; Pack Developer: full; SRE: full                                      |
| WS Needs             | No real-time requirement (query on demand)                                                                                           |
| Offline Rule         | Already queried explanations can be cached and displayed; new queries must be online                                                                |
| API Endpoint         | `POST /api/v1/explanations` (query) · `GET /api/v1/explanations/{id}`                                            |
| Authoritative Source | `ExplainabilityService` (src/ops-maturity/explainability/)                                                       |
| Derived Source       | Explanation is generated based on `ExecutionEngine` runtime logs + LLM reasoning chain, not original facts                                         |
| Projection Owner     | Frontend `feature-explainability` module                                                                               |

### 4.7.6 CostCenter

| Dimension                 | Definition                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ cost_record_id, domain_id, tenant_id, period, total_cost, breakdown_by_model[], breakdown_by_task_type[], budget, budget_utilization_pct }` |
| Actions              | `get_summary(domain_id, period)` · `get_detail(cost_record_id)` · `set_budget` · `set_alert_threshold` · `export_report`                       |
| Query Keys           | `["costs", domainId, period]` · `["costs", "detail", recordId]` · `["costs", "budget", domainId]`                                              |
| Permission           | L1: own domain read-only; Business Line Owner: business line aggregation; Domain Admin: domain level + set_budget; SRE: global + all actions                                                     |
| WS Needs             | `cost.budget_alert` · `cost.period_closed`                                                                                                     |
| Offline Rule         | Read-only browsing allows stale cache; set_budget / set_alert must be online                                                                                      |
| API Endpoint         | `GET /api/v1/costs` · `GET /api/v1/costs/{id}` · `PUT /api/v1/costs/budget` · `POST /api/v1/costs/export`                                      |
| Authoritative Source | `CostTrackingService` (src/ops-maturity/cost/)                                                                                                 |
| Derived Source       | cost breakdown is aggregated from `ResourceManagerService` usage data                                                                                  |
| Projection Owner     | Frontend `feature-cost-center` module                                                                                                                |

### 4.7.7 AnalyticsDashboard _(added v3.0)_

| Dimension                 | Definition                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ time_range, scope, kpis{total_tasks,success_rate,avg_duration_ms,active_agents,slo_compliance,total_cost}, task_trend[], status_distribution[], agent_utilization[], cost_trend[], top_failures[], workflow_durations[] }` |
| Actions              | `get_metrics(scope, time_range)` · `get_kpis(scope)` · `get_trend(metric, time_range)` · `export_report(format)`                                                                                                              |
| Query Keys           | `["dashboard", "metrics", scope, timeRange]` · `["dashboard", "kpis", scope]` · `["dashboard", "trend", metric, timeRange]`                                                                                                   |
| Permission           | L1: personal dimension read-only; L2: domain dimension; L3: platform-wide; L4: cross-region + capacity forecast                                                                                                                                                                 |
| WS Needs             | `dashboard.metric_updated` (delta push, avoiding full polling)                                                                                                                                                                         |
| Offline Rule         | Loaded chart data allows stale display (with "Data as of HH:mm" marker); export must be online                                                                                                                                                     |
| API Endpoint         | `GET /api/v1/dashboard/metrics` · `GET /api/v1/dashboard/kpis` · `GET /api/v1/dashboard/trend/{metric}` · `POST /api/v1/dashboard/export`                                                                                     |
| Authoritative Source | `MissionControlService` (aggregation layer) + `CostTrackingService` + `AgentRegistryService`                                                                                                                                             |
| Derived Source       | All metrics are aggregate projections, not original facts; original facts are distributed in each P2-P5 plane service                                                                                                                                                      |
| Projection Owner     | Frontend `feature-analytics` module                                                                                                                                                                                                 |

### 4.7.8 ConfigurationCenter _(added v3.0)_

| Dimension                 | Definition                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimal DTO          | `{ user_preferences{locale,timezone,theme,notifications}, roles[], feature_flags[], model_configs[], domains[], tenants[], webhooks[], recent_changes[] }`                                                                                                                                             |
| Actions              | **Preferences**: get/update_preferences · **Permissions**: CRUD roles + assign_user · **Features**: CRUD flags + toggle + rollout · **Models**: CRUD models + bind_domain + set_budget · **Domains**: get/update domain + update_ui_config · **Tenants**: CRUD tenants + map_domain · **Webhooks**: CRUD webhooks + test + view_log |
| Query Keys           | `["settings", "preferences"]` · `["settings", "roles"]` · `["settings", "flags"]` · `["settings", "models"]` · `["settings", "domains", id]` · `["settings", "tenants"]` · `["settings", "webhooks"]`                                                                                                  |
| Permission           | authenticated: preferences; org_admin: permissions + tenants; domain_admin: models + domains + Webhook; platform_sre: feature flags + all                                                                                                                                                                                                  |
| WS Needs             | `config.updated` (notify other online users that configuration has changed)                                                                                                                                                                                                                                                          |
| Offline Rule         | Preferences allow offline cache read; all write operations must be online; configuration changes require optimistic locking (`If-Match` ETag)                                                                                                                                                                                                                          |
| API Endpoint         | `GET/PUT /api/v1/user/preferences` · `CRUD /api/v1/admin/roles` · `CRUD /api/v1/admin/feature-flags` · `CRUD /api/v1/admin/models` · `GET/PUT /api/v1/admin/domains/{id}` · `CRUD /api/v1/admin/tenants` · `CRUD /api/v1/admin/webhooks`                                                               |
| Authoritative Source | `admin-routes` (src/sdk/cli/admin/) + `UserPreferenceService` + `DomainConfigService`                                                                                                                                                                                                                  |
| Derived Source       | `DomainUIConfig` (§6.1.2) is the frontend projection of domain settings                                                                                                                                                                                                                                                           |
| Projection Owner     | Frontend `feature-settings` module                                                                                                                                                                                                                                                                           |

---

# Part IV — Data and Communication

---

# 5. Data Flow, API Integration and Real-Time Layer

> **Improvements A-2, A-3, D-1**: Distinguish Implemented/Planned API endpoints; layer according to actual backend WebSocket events; clarify Web offline three-layer strategy. v2.3 adds API Layer classification (§5.2.3) and Mutation idempotency specification (§5.6.4).

## 5.1 State Management Architecture

**State Classification**:

| State Category   | Management Tool        | Lifecycle       | Persistence | Example                                 |
| ---------- | --------------- | -------------- | ------ | ------------------------------------ |
| Application State   | Zustand         | App Lifecycle   | Yes     | user, token, theme, locale, sidebar  |
| Server State | TanStack Query  | By staleTime   | Optional   | tasks, approvals, agents, dashboard  |
| Real-time State   | Zustand + WS    | WebSocket Connection | No     | wsStatus, eventBuffer, subscriptions |
| Form State   | React Hook Form | Page Lifecycle   | No     | Create task, approval decision, domain config forms     |
| URL State   | React Router    | Route Lifecycle   | URL    | Filter conditions, pagination cursor, current tab      |

```text
┌───────────────────────────────────────────────────────────────┐
│                     UI State Management Layer                             │
│                                                               │
│  ┌──────────────────┐  ┌───────────────────────────────────┐ │
│  │  Client State    │  │  Server State                     │ │
│  │  (Zustand 5)     │  │  (TanStack Query v5)              │ │
│  │                  │  │                                   │ │
│  │  • UI state       │  │  • Task/Approval/Dashboard data              │ │
│  │  • Theme preference      │  │  • Auto cache + dedup                │ │
│  │  • Sidebar collapse    │  │  • Background refresh + optimistic update            │ │
│  │  • Conversation context    │  │  • Offline persister                 │ │
│  └────────┬─────────┘  └────────────┬──────────────────────┘ │
│           │                         │                         │
│  ┌────────┴─────────────────────────┴──────────────────────┐ │
│  │            Realtime Layer (WebSocket → Store sync)       │ │
│  │  WS event → invalidateQueries() / directly update Zustand store  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Offline Layer (sync-store + offline-queue)     │ │
│  │  Offline operation queue → connection recovery → replay in order → conflict resolution            │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Zustand Store Division**:

| Store            | Responsibility                                   | Persistence           |
| ---------------- | -------------------------------------- | ---------------- |
| `auth-store`     | Authentication state, current user, permission cache           | Secure Storage (L4)     |
| `ui-store`       | Theme, sidebar, current route state, layout preference   | localStorage     |
| `sync-store`     | Offline queue state, sync progress, conflict list       | offlineStore (L4) |
| `realtime-store` | WebSocket connection state, subscription list, event buffer | Memory             |

### 5.1.1 Zustand Store Interface Definition

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  permissions: Permission[];
  tenantId: string | null;
  tenantConfig: TenantConfig | null;
  isAuthenticated: boolean;
  login(credentials: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  refreshToken(): Promise<void>;
  switchTenant(tenantId: string): Promise<void>;
}

interface UIState {
  theme: "light" | "dark" | "high-contrast" | "system";
  locale: string;
  sidebarCollapsed: boolean;
  activeView: string;
  nlPanelOpen: boolean;
  commandPaletteOpen: boolean;
  setTheme(theme: UIState["theme"]): void;
  setLocale(locale: string): void;
  toggleSidebar(): void;
  toggleNLPanel(): void;
}

interface SyncState {
  online: boolean;
  queueDepth: number;
  lastSyncAt: string | null;
  conflicts: ConflictItem[];
  syncStatus: "idle" | "syncing" | "error";
  resolveConflict(id: string, resolution: "local" | "remote"): Promise<void>;
  retrySync(): Promise<void>;
}

interface RealtimeState {
  wsStatus: "disconnected" | "connecting" | "connected" | "reconnecting";
  activeSubscriptions: Set<string>;
  pendingApprovalCount: number;
  activeIncidents: Incident[];
  panicActivated: boolean;
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
}
```

### 5.1.2 TanStack Query staleTime Strategy

| Data Type   | staleTime | gcTime | Reason                     |
| ---------- | --------- | ------ | ------------------------ |
| Dashboard Metrics   | 30s       | 5min   | Frequent changes, needs near real-time       |
| Task List   | 2min      | 30min  | Medium frequency changes             |
| Task Details   | 1min      | 30min  | User-focused current tasks need to be relatively new |
| Approval List   | 30s       | 10min  | High timeliness requirements             |
| Agent List | 5min      | 30min  | Infrequent changes               |
| Config Data   | 1h        | 24h    | Rarely changes                 |
| Market List   | 10min     | 1h     | Infrequent changes               |
| Cost Data   | 5min      | 30min  | Has a certain timeliness             |

### 5.1.3 QueryClient Global Default Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5min default
      gcTime: 30 * 60 * 1000, // 30min GC
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 5.1.4 Offline Persistence

Mobile and desktop use TanStack Query's `persistQueryClient` to persist the query cache to L4 storage:

```text
TanStack Query Cache
  │
  └─ persistQueryClient(
       persister: createSyncStoragePersister({
         storage: L4.secureStorage  // Web: IndexedDB, Desktop: SQLite, RN: AsyncStorage
       }),
       maxAge: 24 * 60 * 60 * 1000  // 24h
     )
```

### 5.1.5 Data Flow Pattern

```text
User Action
  │
  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ UI Component     │────▶│ Mutation   │────▶│ REST API   │
│ (Trigger)     │     │ (Optimistic Update) │     │ (Actual Request) │
└────────────┘     └─────┬──────┘     └─────┬──────┘
                         │                  │
                  Instant Update│                  │ Server Response
                         ▼                  ▼
                  ┌────────────┐     ┌────────────┐
                  │ Local Cache   │     │ Cache Update    │
                  │ (Instant Feedback) │     │ Or Rollback     │
                  └────────────┘     └────────────┘

WebSocket event (server push)
  │
  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ WS Client  │────▶│ Event Router   │────▶│ Query Cache │
│ (Receive)     │     │ (Dispatch)     │     │ Invalidate/Update  │
└────────────┘     └────────────┘     └─────┬──────┘
                                            │
                                            ▼
                                     UI Auto Refresh
```

### 5.1.6 ViewModel Mapping Specification (DTO → VM → Props Anti-Corruption Layer)

The UI layer introduces a three-layer data conversion in `shared/api-client`, isolating the impact of backend DTO changes on UI components:

```text
Backend REST/WS ──→ DTO (api-client/types/) ──→ ViewModel (shared/viewmodels/) ──→ Props (features/*/components/)
                  │                            │                                   │
                  │ Map backend JSON as-is           │ Business semantic conversion + field renaming          │ Pure display, no optional fields
                  │ Field names/types consistent with backend       │ Add derived fields (e.g. isOverdue)          │ All fields required
                  │ Generated automatically by openapi-ts      │ Hand-written + unit test coverage                 │ Defined by component
```

**Layer Responsibilities**:

| Layer      | Location                         | Generation Method         | Allowed Transformations                                           | Forbidden Behavior                       |
| --------- | ---------------------------- | ---------------- | ---------------------------------------------------- | -------------------------------- |
| DTO       | `shared/api-client/types/`   | openapi-ts generated  | None (1:1 with backend OpenAPI schema)                      | Manually modifying generated files                 |
| ViewModel | `shared/viewmodels/`         | Hand-written mapper functions | Field renaming, type conversion, derived fields, null default values, enum mapping | Calling APIs, side effects, referencing UI frameworks   |
| Props     | `features/*/components/*.ts` | Component definition         | Display formatting (date/number/status text)                     | Referencing DTO types, directly holding API responses |

**Mapper Function Specification**:

```typescript
// shared/viewmodels/task.vm.ts
import type { TaskDTO } from "../api-client/types/task.js";

export interface TaskVM {
  id: string;
  title: string;
  statusLabel: string;
  statusColor: "green" | "blue" | "yellow" | "red" | "gray";
  isOverdue: boolean;
  createdAtFormatted: string;
  assigneeName: string;
  domainLabel: string;
  drillDepth: 1 | 2 | 3 | 4 | 5;
}

export function toTaskVM(dto: TaskDTO): TaskVM {
  return {
    id: dto.id,
    title: dto.name,
    statusLabel: STATUS_LABEL_MAP[dto.status] ?? dto.status,
    statusColor: STATUS_COLOR_MAP[dto.status] ?? "gray",
    isOverdue: dto.deadline != null && new Date(dto.deadline) < new Date(),
    createdAtFormatted: formatRelativeTime(dto.created_at),
    assigneeName: dto.assignee?.display_name ?? "Unassigned",
    domainLabel: dto.domain_id,
    drillDepth: 1,
  };
}
```

**Rules**:

- DTO layer prohibits manual editing—only regenerate from backend OpenAPI spec via `openapi-ts`
- ViewModel mapper must have corresponding unit tests, covering null, boundary enums, timezone conversion
- Component Props must not contain `| undefined`—all optionality is resolved in the VM mapper
- Hooks in feature modules (e.g. `useTaskList`) return VM arrays, not DTOs

## 5.2 REST API Endpoint Mapping (Implemented vs Planned)

> **Improvement A-2**: Backend http-server route cross-validation results; v2.3 adds API Layer annotation and Public UI API Surface layering.

### 5.2.1 Implemented Endpoints [Implemented] (with API Layer Annotation)

| UI Feature          | Backend Route File              | Endpoint Example                             | Method       | Status                     | API Layer |
| ---------------- | ------------------------- | ------------------------------------ | ---------- | ------------------------ | --------- |
| Task CRUD        | `task-routes.ts`          | `/api/v1/tasks`, `/api/v1/tasks/:id` | GET/POST   | [Implemented/Contracted] | Layer C   |
| Approval Operations         | `admin-routes.ts`         | `/api/v1/approvals/:id`              | POST       | [Implemented/Contracted] | Layer C   |
| Dashboard Data   | `dashboard-routes.ts`     | `/api/v1/dashboard/*`                | GET        | [Implemented/Contracted] | Layer C   |
| Console Page     | `console-routes.ts`       | `/console/*`                         | GET (HTML) | [Implemented/Internal]   | Layer B   |
| Admin Management       | `admin-routes.ts`         | `/admin/v1/*`                        | CRUD       | [Implemented/Contracted] | Layer B/C |
| Contract Version Validation     | `meta-routes`             | `/api/v1/meta/contract-version`      | GET        | [Implemented/Contracted] | Layer C   |
| Mission Control  | `mission-control-service` | Exposed via console-routes             | GET        | [Implemented/Internal]   | Layer A→C |
| Operator Console | `console-backend/`        | Snapshot/Approval Queue/Worker Panel/Incident   | GET        | [Implemented/Internal]   | Layer A→C |

### 5.2.2 Planned Endpoints [Planned] (API Enhancement Requirements)

| UI Feature        | Suggested Endpoint                         | Method    | Suggested Data Source                            | Status      | Priority |
| -------------- | -------------------------------- | ------- | ------------------------------------- | --------- | ------ |
| Agent List     | `/api/v1/agents`                 | GET     | dashboard-routes + MissionControlService projection | [Implemented/Contracted] | P1     |
| Workflow CRUD  | `/api/v1/workflows`              | CRUD    | OrchestrationPlane workflow storage      | [Planned] | P1     |
| Marketplace    | `/api/v1/marketplace`            | GET     | pack-routes + PackCatalogService      | [Implemented/Contracted] | P1     |
| Explanation Query       | `/api/v1/explanations`           | GET     | dashboard-routes summary projection   | [Implemented/Contracted] | P1     |
| Cost Data       | `/api/v1/costs`                  | GET     | CostService (ops-maturity/)           | [Planned] | P2     |
| Dashboard Metrics | `/api/v1/dashboard/metrics`      | GET     | dashboard-routes + MissionControlService snapshot | [Implemented/Contracted] | P1     |
| Dashboard KPI  | `/api/v1/dashboard/kpis`         | GET     | MissionControlService aggregation            | [Planned] | P1     |
| Dashboard Trend | `/api/v1/dashboard/trend/{m}`    | GET     | DashboardProjectionService            | [Planned] | P2     |
| Dashboard Export | `/api/v1/dashboard/export`       | POST    | DashboardProjectionService            | [Planned] | P2     |
| Task Evidence  | `/api/v1/tasks/:id/evidence`     | GET     | StateEvidencePlane                    | [Planned] | P1     |
| Task Timeline  | `/api/v1/tasks/:id/timeline`     | GET     | StateEvidencePlane event log          | [Planned] | P1     |
| Agent Heartbeat     | `/api/v1/agents/{id}/heartbeats` | GET     | AgentRegistryService                  | [Planned] | P2     |
| Agent Metrics     | `/api/v1/agents/{id}/metrics`    | GET     | AgentRegistryService                  | [Planned] | P2     |
| User Preferences       | `/api/v1/user/preferences`       | GET/PUT | UserPreferenceService                 | [Planned] | P1     |
| Role Management       | `/api/v1/admin/roles`            | CRUD    | admin-routes                          | [Planned] | P1     |
| Feature Flags       | `/api/v1/admin/feature-flags`    | CRUD    | admin-routes                          | [Planned] | P1     |
| Model Configuration       | `/api/v1/admin/models`           | CRUD    | admin-routes + ModelConfigService     | [Planned] | P1     |
| Domain Configuration         | `/api/v1/admin/domains/{id}`     | GET/PUT | DomainConfigService                   | [Planned] | P1     |
| Tenant Management       | `/api/v1/admin/tenants`          | CRUD    | admin-routes                          | [Planned] | P2     |
| Webhook Management   | `/api/v1/admin/webhooks`         | CRUD    | admin-routes                          | [Planned] | P2     |

### 5.2.3 Public UI API Surface Layering _(added v2.3)_

To eliminate the ambiguity that "a backend service/route exists" is equivalent to "the frontend can stably integrate", this section divides the backend API into three strict layers. The frontend can only consume **Layer C (Public Contract Endpoint)**; consumption of Layer A/B requires the backend team to explicitly upgrade to Layer C.

| Layer                             | Definition                                                                             | Frontend Consumable | Example                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| **Layer A — Service Method**     | Methods of the backend TypeScript service class, only callable within the process, no HTTP exposure                 | ❌         | `MissionControlService.getSnapshot()` (service method)                 |
| **Layer B — Internal Route**     | Exposed through HTTP routes but for internal console/HTML pages, no public JSON schema, no version guarantee | ⚠️ Confirm required  | `GET /console/*` (HTML page) · `/admin/v1/*` (partial HTML)               |
| **Layer C — Public Contract EP** | JSON API for external consumers, with OpenAPI spec, versioned path, stable request/response schema   | ✅         | `GET /api/v1/tasks` · `POST /api/v1/tasks` · `GET /api/v1/dashboard/*` |

**Current Layer Attribution of Each Data Source**:

| Data Source                                     | Current Layer  | Target Layer | Upgrade Action                                                    |
| ------------------------------------------ | --------- | -------- | ----------------------------------------------------------- |
| `GET /api/v1/tasks` · `POST /api/v1/tasks` | Layer C   | Layer C  | No change needed, OpenAPI spec already exists                                 |
| `POST /api/v1/approvals/:id`               | Layer C   | Layer C  | No change needed                                                    |
| `GET /api/v1/dashboard/*`                  | Layer C   | Layer C  | No change needed                                                    |
| `MissionControlService.*`                  | Layer A   | Layer C  | Need to add `GET /api/v1/mission-control/*` JSON route + OpenAPI |
| `OperatorConsoleBackendService.*`          | Layer A   | Layer C  | Need to add `GET /api/v1/operator/*` JSON route + OpenAPI        |
| `GET /console/*`                           | Layer B   | Layer B  | Keep as internal HTML entry, frontend does not consume directly                        |
| `GET /admin/v1/*`                          | Layer B/C | Layer C  | Some already have JSON responses (Contracted); HTML portions marked Internal      |
| `CRUD /api/v1/agents` (Planned)            | —         | Layer C  | Design directly per Layer C standard                                     |
| `CRUD /api/v1/workflows` (Planned)         | —         | Layer C  | Design directly per Layer C standard                                     |
| `GET /api/v1/marketplace`                  | C (done)  | Layer C  | Already has public query endpoint, can be consumed directly per Layer C                     |
| `GET /api/v1/explanations`                 | C (done)  | Layer C  | Already has public query endpoint, can be consumed directly per Layer C                     |
| `GET /api/v1/costs` (Planned)              | —         | Layer C  | Design directly per Layer C standard                                     |

**Frontend Consumption Rules**:

- Each function in frontend `api-client/endpoints/*.ts` must declare the Layer level of its target endpoint
- Layer A/B endpoints are marked `@internal` in the code, prohibited from direct reference in feature modules
- If a feature module needs Layer A/B data, it must provide a temporary mock via `mock-server`, and create a "upgrade to Layer C" story in the backlog
- Phase 1 Gate 0 prerequisite adds: all endpoints consumed by Phase 1 must reach Layer C

### 5.2.4 Internal → Contracted Upgrade Checklist (API Graduation Matrix) _(added v3.0)_

The frontend should not stay on the Internal surface for long. The following table tracks the upgrade status of each Layer A/B data source, clarifying the prerequisites and target milestones required for upgrading to Layer C.

| Source Service                    | Route / Method                    | Current Layer | Target Layer | Required Schema                               | Required Auth Model          | Required Versioning | Required Tests                      | Target Milestone | Status    |
| --------------------------------- | --------------------------------- | ------------- | ------------ | --------------------------------------------- | ---------------------------- | ------------------- | ----------------------------------- | ---------------- | --------- |
| `MissionControlService`           | `.getSnapshot()`                  | A             | C            | `MissionControlSnapshotDTO` (JSON Schema)     | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 1   | Pending   |
| `MissionControlService`           | `.getTaskCockpit()`               | A → C (done)  | C            | —                                             | —                            | —                   | —                                   | —                | Graduated |
| `MissionControlService`           | `.getWorkflowCockpit()`           | A             | C            | `WorkflowCockpitDTO` (JSON Schema)            | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 2   | Graduated |
| `MissionControlService`           | `.getStabilityPanel()`            | A             | C            | `StabilityPanelDTO` (JSON Schema)             | Bearer JWT + RBAC L3+ (SRE)  | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Graduated |
| `MissionControlService`           | `.getAdminTakeoverConsole()`      | A             | C            | `AdminTakeoverDTO` (JSON Schema)              | Bearer JWT + RBAC L4 (admin) | `/api/v1/`          | unit + integration + security       | Phase 2 Gate 1   | Pending   |
| `OperatorConsoleBackendService`   | `.getSnapshot()`                  | A             | C            | `OperatorSnapshotDTO` (JSON Schema)           | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `OperatorConsoleBackendService`   | `.getIncidentTimeline()`          | A             | C            | `IncidentTimelineDTO` (JSON Schema)           | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 2   | Pending   |
| `MissionControlService`           | worker projection via `/v1/workers` | A → C (done)  | C            | `WorkerPanelDTO` (JSON Schema)                | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 2   | Graduated |
| `MissionControlService`           | queue projection via `/v1/queues`   | A → C (done)  | C            | `QueueStatusDTO` (JSON Schema)                | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 2   | Graduated |
| Console routes                    | `GET /console/*`                  | B             | B            | — (Keep internal HTML entry)                       | —                            | —                   | —                                   | —                | N/A       |
| Admin routes                      | `GET /admin/v1/*` (HTML portions) | B             | B/C          | Existing JSON parts keep C; HTML parts marked Internal  | —                            | —                   | —                                   | —                | Partial   |
| `DomainOnboardingService`         | interaction/ux/onboarding/        | A             | C            | `DomainOnboardingDTO` (JSON Schema)           | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `NLEntryService` + `IntentParser` | conversation API                  | A (Partial)   | C            | `ConversationDTO` + `IntentDTO` (JSON Schema) | Bearer JWT + RBAC L1+        | `/api/v1/`          | unit + integration + NLU regression | Phase 1 Gate 2   | Pending   |

**Upgrade Process**:

1. **Backend API owner** creates an upgrade story → add JSON route + OpenAPI spec + request/response schema
2. **Backend QA** supplements contract test + integration test
3. **Architecture review** confirms schema freeze at Sprint Review → sub-label updated from `Internal` / `Partial` to `Contracted`
4. **Frontend team** switches from mock-server to real endpoint, removes `@internal` annotation
5. **Gate check** Before the corresponding Phase Gate, all endpoints required by that Gate must reach `Graduated` status

## 5.3 WebSocket Real-Time Event Mapping

> **Improvement A-3**: Layer according to actual backend implementation.

### 5.3.1 Implemented Events [Implemented] (WebSocketBridge + TaskWebSocketStatusRelay)

Event types already supported by the backend `TaskWebSocketEvent` and `WebSocketBridge`:

| Backend Event Type         | Trigger Timing         | UI Response                   | TanStack Query Strategy                | Status          |
| -------------------- | ---------------- | ------------------------- | ---------------------------------- | ------------- |
| `status_changed`     | Task status change     | Task card status badge update      | `invalidateQueries(['tasks'])`     | [Implemented] |
| `progress`           | Step progress update     | Step progress bar advance            | Directly update cache                     | [Implemented] |
| `message_delta`      | LLM streaming output delta | Conversation bubble real-time text append      | Directly update Zustand                   | [Implemented] |
| `artifact_ready`     | Artifact generation complete     | Artifact card appears              | `invalidateQueries(['tasks', id])` | [Implemented] |
| `approval_requested` | Manual approval required     | Approval notification popup + Badge count | `invalidateQueries(['approvals'])` | [Implemented] |
| `completed`          | Task completed         | Task card marked completed          | `invalidateQueries(['tasks'])`     | [Implemented] |
| `failed`             | Task failed         | Task card marked failed + alert   | `invalidateQueries(['tasks'])`     | [Implemented] |

### 5.3.2 Events to be Extended [Planned] (UI Requirements → Backend Enhancement)

| UI Event Type                  | UI Response              | Backend Extension Suggestion                          | Status       | Priority |
| ---------------------------- | -------------------- | ------------------------------------- | ---------- | ------ |
| `approval.resolved`          | Approval card status update     | WebSocketBridge adds approval result broadcast      | [Planned]  | P1     |
| `agent.health_changed`       | Agent health indicator color change | AgentRegistry health change event            | [Planned]  | P2     |
| `incident.created`           | Global alert banner         | IncidentService event broadcast              | [Planned]  | P1     |
| `dashboard.metric_updated`   | Dashboard values/charts refresh    | DashboardProjectionService delta push | [Planned]  | P2     |
| `panic.activated`            | Global emergency stop overlay     | PanicService event broadcast                 | [Planned]  | P1     |
| `hitl.intervention_required` | HITL full-screen intervention panel    | HITL notification module event extension     | [Planned]  | P1     |
| `nl.clarification_needed`    | NL conversation follow-up bubble      | NLEntryService follow-up event               | [Proposed] | P2     |
| `cost.budget_alert`          | Budget alert Toast       | CostService budget event                  | [Proposed] | P3     |
| `drift.alert`                | Drift alert notification         | DriftDetector event broadcast                | [Proposed] | P3     |

### 5.3.2.1 WSEventRouter Complete Architecture

```text
┌──────────────────────────────────────────────────────┐
│                 WSEventRouter                         │
│                                                      │
│  WebSocket /ws/v1/stream                             │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────┐                              │
│  │ Heartbeat Manager          │ Every 30s ping, 45s no pong = disconnect   │
│  └────────────────────┘                              │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────┐                              │
│  │ Event Parser          │ JSON → typed Event           │
│  └────────────────────┘                              │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────────────────────────────┐      │
│  │ Event Dispatcher                                  │      │
│  │                                            │      │
│  │  task.status_changed      → Task cache invalidate   │      │
│  │  task.step_completed      → Step progress update   │      │
│  │  approval.requested       → Approval Badge +1  │      │
│  │  approval.resolved        → Approval cache invalidate   │      │
│  │  agent.health_changed     → Agent health update │      │
│  │  incident.created         → Global alert banner   │      │
│  │  dashboard.metric_updated → Dashboard data refresh   │      │
│  │  hitl.intervention_required → HITL popup    │      │
│  │  panic.activated          → Emergency stop overlay   │      │
│  │  drift.alert              → Drift alert notification   │      │
│  │  cost.budget_alert        → Budget alert Toast │      │
│  │  debug.breakpoint_hit     → Debugger pause     │      │
│  └────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

### 5.3.2.2 Event → Query Cache Mapping

| Event Type                   | Query Cache Operation                     | UI Update Method      |
| -------------------------- | ---------------------------------- | ---------------- |
| `task.status_changed`      | invalidate `taskKeys.list`         | List auto refresh     |
| `task.step_completed`      | Directly update `taskKeys.detail(id)`     | Progress bar advance       |
| `approval.requested`       | invalidate `approvalKeys.list`     | List refresh + Badge |
| `approval.resolved`        | invalidate `approvalKeys.list`     | List refresh         |
| `agent.health_changed`     | Directly update agent health field        | Health indicator color change   |
| `dashboard.metric_updated` | Directly update dashboard query data      | Chart/values refresh    |
| `incident.created`         | Write to RealtimeStore.activeIncidents | Global banner display     |
| `panic.activated`          | Write to RealtimeStore.panicActivated  | Full screen overlay         |

### 5.3.2.3 Urgent Event Handling

The following events have the highest priority and respond immediately regardless of current page state:

| Event                            | UI Response                                  | Priority |
| ------------------------------- | ---------------------------------------- | ------ |
| `panic.activated`               | Full-screen red overlay + emergency stop tip              | SEV1   |
| `incident.created` (SEV1)       | Global top alert banner + push notification              | SEV1   |
| `hitl.intervention_required`    | Full-screen HITL intervention panel (Desktop) / Push (Mobile) | SEV2   |
| `approval.requested` (Critical) | Approval popup + sound alert + vibration               | SEV2   |

### 5.3.3 WebSocket Connection Management

```text
Connection strategy:
1. Authentication: JWT token as ws handshake auth parameter (consistent with WebSocketBridge existing implementation)
2. Disconnect reconnect: exponential backoff (1s → 2s → 4s → 8s → 16s → 30s max) + random jitter
3. Heartbeat keep-alive: send ping every 30s, 45s no pong is considered disconnect (consistent with DashboardWebSocketServer)
4. Multiple tabs: SharedWorker (Web) / singleton connection (Desktop/Mobile) to avoid duplicate connections
5. Offline buffer: events buffered to L4 offlineStore during disconnect, replayed in order after reconnect
6. Subscription management: dynamically subscribe/unsubscribe event channels based on current page/view to reduce bandwidth
7. Align with gateway_streaming_contract.md:
   - chunk commit, catch-up, backlog drain adapt to queue pressure and message age
   - catch-up does not disrupt message order
   - Do not destroy readability by brute-forcing flush in a single frame
```

### 5.3.4 SharedWorker WebSocket Architecture (Web)

The Web side uses SharedWorker to share a single WebSocket connection across multiple tabs, avoiding duplicate connections and bandwidth waste:

```text
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Tab 1   │  │  Tab 2   │  │  Tab 3   │
│  (Tasks) │  │(Approval)│  │(Dashboard│
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │  MessagePort │  MessagePort │
     └──────────────┼──────────────┘
                    │
         ┌──────────┴──────────┐
         │    SharedWorker     │
         │                     │
         │  ┌───────────────┐  │
         │  │ WSClient      │  │  Single WebSocket connection
         │  │ (ws/v1/stream)│──┼──→ Platform Backend
         │  └───────┬───────┘  │
         │          │          │
         │  ┌───────┴───────┐  │
         │  │ PortRouter    │  │  Dispatch events to each Tab by subscription
         │  │ Tab1→[tasks]  │  │
         │  │ Tab2→[approvals]│ │
         │  │ Tab3→[dashboard]│ │
         │  └───────────────┘  │
         └─────────────────────┘
```

| Strategy          | Web (SharedWorker)                           | Desktop              | Mobile                 |
| ------------- | -------------------------------------------- | ------------------- | ---------------------- |
| Multiple tabs/windows | SharedWorker shares single connection                    | Main process singleton connection      | Singleton connection               |
| Background Strategy      | visibilitychange → reduce push frequency              | Minimize → keep heartbeat only | Background → disconnect + FCM/APNs |
| Disconnect Reconnect      | Exponential backoff (1s→30s) + jitter                    | Same as Web              | Same as Web                 |
| Offline Buffer      | IndexedDB buffer                               | SQLite buffer         | SQLite buffer            |
| Fallback      | SharedWorker not supported → degrade to main thread WebSocket | N/A                 | N/A                    |

### 5.3.5 SSE Fallback

The backend `StreamBridge` provides an SSE endpoint as a degradation when WebSocket is unavailable:

```text
WebSocket unavailable judgment:
  - Enterprise proxy/firewall intercepts ws upgrade
  - 3 connection attempts all fail
  ↓
Degrade to SSE (Server-Sent Events):
  - GET /api/v1/stream (Accept: text/event-stream)
  - Event format consistent with WebSocket payload
  - Lose bidirectional communication (operations still through REST)
  ↓
SSE also unavailable:
  - Degrade to 30s polling
  - UI shows "Real-time updates unavailable" prompt
```

### 5.3.6 WebSocket Subscription Domain Model

The UI adopts a channel-based subscription model, subscribing to relevant channels when entering a page, and automatically unsubscribing when exiting, to reduce bandwidth and backend broadcast overhead:

**Channel Classification**:

| Channel Category   | Channel Format                | Lifecycle          | Event Example                                  | Status          |
| ---------- | ----------------------- | ----------------- | ----------------------------------------- | ------------- |
| Global Channel   | `global`                | Login → Logout         | `panic.activated`, `incident.created`     | [Implemented] |
| Task Channel   | `task:{taskId}`         | Enter detail → Leave     | `status_changed`, `progress`, `completed` | [Implemented] |
| Workflow Channel | `workflow:{workflowId}` | Enter detail → Leave     | `step_completed`, `workflow_finished`     | [Planned]     |
| Approval Channel   | `approvals`             | Enter approval center → Leave | `approval_requested`, `approval.resolved` | [Implemented] |
| Admin Channel   | `admin:{scope}`         | Enter admin panel → Leave | `agent.health_changed`, `worker.status`   | [Planned]     |
| Dashboard Channel   | `dashboard`             | Enter dashboard → Leave     | `dashboard.metric_updated`                | [Planned]     |

**Subscription Lifecycle Rules**:

```text
Page Enter (useEffect mount)
  │
  ├─→ subscribe(channels[])     // Register channel to SharedWorker/WSManager
  │
  ├─→ Receive event → update TanStack Query cache / Zustand store
  │
  └─→ Page Leave (useEffect cleanup)
        │
        └─→ unsubscribe(channels[])  // Cancel channel subscription
```

**Degradation Strategy**:

| Scenario                    | Behavior                                                            |
| ----------------------- | --------------------------------------------------------------- |
| Background tab (Web)       | `visibilitychange` hidden → keep `global` channel, cancel page-level channels  |
| Background tab (Desktop)      | Minimize → same as Web logic                                            |
| Mobile enters background          | `lifecycle.onBackground` → disconnect WS, switch to FCM/APNs push        |
| Mobile resumes foreground          | `lifecycle.onForeground` → rebuild WS connection + catch-up pull missing events |
| Tab inactive for more than 5 minutes | Disconnect page-level channels, keep only global channel + 60s heartbeat                       |

## 5.4 API Communication Layer Architecture

```text
┌──────────────────────────────────────────────────┐
│              RESTClient                           │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │          Interceptor Chain                   │ │
│  │  AuthInterceptor     → JWT auto refresh          │ │
│  │  TenantInterceptor   → tenant_id/domain inject │ │
│  │  RetryInterceptor    → Exponential backoff + jitter     │ │
│  │  DedupeInterceptor   → Request dedup              │ │
│  │  OfflineInterceptor  → Offline queue (mobile)    │ │
│  │  TraceInterceptor    → X-Request-Id/Trace-Id │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Transport: L4 PlatformAdapter.fetch()           │
│  (Web=fetch / Electron=net / Tauri=reqwest /     │
│   RN=fetch)                                      │
└──────────────────────────────────────────────────┘
```

### 5.4.1 RESTClient Core Interface `[Planned]`

> _Extracted from Doc-11 §6.1.1 — RESTClient design_

```typescript
interface RESTClient {
  get<T>(path: string, params?: QueryParams): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}
```

The Transport layer is provided by L4 `PlatformAdapter.fetch()` through dependency injection. RESTClient itself does not directly call `fetch`.

### 5.4.2 WebSocket Client Interface `[Planned]`

> _Extracted from Doc-11 §6.1.2 — WebSocket Client design. Complements §5.3 WebSocket layer: §5.3 defines channel model and subscription domain, this section defines client programming interface._

```text
Connection lifecycle:
  DISCONNECTED → CONNECTING → CONNECTED → SUBSCRIBED
       ↑              │            │           │
       └──────────────┴── Disconnect ────┘           │
                              ↑                │
                              └── Heartbeat timeout ────┘
Reconnect strategy:
  delay = min(baseDelay × 2^attempt + jitter, maxDelay)
  baseDelay = 1000ms, maxDelay = 30000ms, jitter = random(0, 1000)
```

```typescript
interface WSClient {
  connect(url: string, token: string): void;
  disconnect(): void;
  subscribe(channel: string, handler: EventHandler): Unsubscribe;
  onStatusChange(handler: (status: WSStatus) => void): Unsubscribe;
}

type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting";
```

### 5.4.3 Endpoint Function Pattern `[Planned]`

> _Extracted from Doc-11 §6.1.3 — Each API endpoint is encapsulated as an independent function, returning TanStack Query compatible configuration._

```typescript
// endpoints/tasks.ts
export const taskKeys = {
  all: ["tasks"] as const,
  list: (filters: TaskFilters) => ["tasks", "list", filters] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
};

export function fetchTasks(client: RESTClient, filters: TaskFilters) {
  return client.get<PaginatedResponse<Task>>("/api/v1/tasks", filters);
}

export function createTask(client: RESTClient, spec: TaskSpec) {
  return client.post<Task>("/api/v1/tasks", spec);
}
```

**Rules**:

- One endpoint = one function + corresponding query key factory
- Function receives `RESTClient` instance (easy for testing mock)
- Return type aligned with backend OpenAPI spec (see Appendix A)

### 5.4.4 Authentication Flow and Token Management `[Planned]`

> _Extracted from Doc-11 §6.2 — Auth Module. Complements §6.5 security architecture: §6.5 defines security strategy, this section defines client authentication implementation flow._

```text
App startup
  │
  ├─ Check if there is a refresh_token in SecureStorage
  │    ├─ Yes → Try to silently refresh access_token
  │    │    ├─ Success → Enter Authenticated state
  │    │    └─ Failure → Redirect to login page
  │    └─ No → Redirect to login page
  │
  Login page
  ├─ SSO (OIDC) → System browser OAuth2 PKCE flow → Callback to get tokens
  ├─ SSO (SAML) → System browser SAML flow → Callback to get tokens
  └─ API Key → Direct input (dev mode / CLI mode only)
  │
  Tokens stored in L4 SecureStorage → Enter Authenticated state
```

| Strategy     | Description                                                                  |
| -------- | --------------------------------------------------------------------- |
| Auto refresh | Silent refresh triggered 60s before access_token expires, no perception                          |
| Refresh lock   | When concurrent requests find token expired, only the first triggers refresh, others queue                          |
| Refresh failure | Return 401 → Clear local token → Redirect to login page → Save current route for restoration after login |
| Multi-device   | Support viewing active session list → Selectively revoke                                     |
| Two-factor authentication | High-risk operations (approval Critical, modifying security settings) trigger biometric/password secondary verification    |

### 5.4.5 Offline Queue and Sync Coordinator `[Planned]`

> _Extracted from Doc-11 §6.3 — Sync Engine. Complements §5.5 offline architecture: §5.5 defines offline layered strategy, this section defines queue record structure and conflict resolution._

**Queue Record Structure**:

| Field             | Type        | Description                                                     |
| ---------------- | ----------- | -------------------------------------------------------- |
| `id`             | ULID        | Globally unique identifier                                             |
| `method`         | HTTP Method | POST / PUT / PATCH / DELETE                              |
| `path`           | string      | API path, e.g. `/api/v1/tasks`                             |
| `body`           | JSON        | Request body                                                   |
| `idempotencyKey` | string      | Idempotency key to prevent duplicate submissions                                     |
| `createdAt`      | ISO-8601    | Creation time                                                 |
| `retryCount`     | number      | Current retry count                                             |
| `status`         | enum        | `pending` / `syncing` / `synced` / `conflict` / `failed` |

**SyncCoordinator Recovery Flow**: Success → `synced` → Notify UI ｜ 409 → `conflict` → Conflict resolution UI ｜ 500 → Retry (max 3) → `failed` → Notify user.

**Conflict Resolution Strategy**:

| Data Type       | Strategy                                                     |
| -------------- | -------------------------------------------------------- |
| Task Creation       | No conflict (idempotency key protection)                                     |
| Approval Decision       | Server priority (first come, first served), notify user "Approval has been processed by someone else" on conflict |
| Configuration Change       | Server priority + CAS version check, show double-column diff on conflict         |
| Agent State Change | Server priority, notify user to refresh and retry on conflict                     |

### 5.4.6 Pagination and Filtering Standardization

All list interfaces uniformly use the backend's cursor-based pagination:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  totalCount?: number;
}

interface QueryParams {
  cursor?: string;
  limit?: number; // default 20, max 100
  status?: string;
  tenantId?: string;
  domainId?: string;
  sort?: string; // "created_at:desc"
  createdAfter?: string;
  createdBefore?: string;
}
```

TanStack Query's `useInfiniteQuery` maps cursor pagination:

```text
useInfiniteQuery({
  queryKey: taskKeys.list(filters),
  queryFn: ({ pageParam }) => fetchTasks(client, { ...filters, cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

## 5.5 Offline and Sync Architecture

> **Improvement D-1**: Clarify the Web offline three-layer strategy.

### 5.5.1 Web Offline Three-Layer Strategy

| Layer            | Technology                               | Cache Content                          | Strategy                                   |
| --------------- | ---------------------------------- | --------------------------------- | -------------------------------------- |
| L1 Static Asset Cache | Service Worker Cache               | JS/CSS/Images/Fonts                  | Cache-First, versioned hash               |
| L2 API Response Cache | TanStack Query persist + IndexedDB | Task list/Approval list/Dashboard snapshot        | Network-First + Stale-While-Revalidate |
| L3 Operation Queue     | IndexedDB (offline-queue)          | Pending operations (approve/cancel etc.) | FIFO queue, replayed in order after connection recovery          |

**Key Constraints**:

- L2 cached data does not contain PII (see `00-platform-architecture.md` data classification strategy)
- Operations in the L3 queue carry idempotency keys to prevent duplicate submissions
- Service Worker and TanStack Query have separate responsibilities: SW manages static assets, TQ manages API data

### 5.5.2 Desktop Offline Strategy

| Platform    | Offline Storage                             | Sync Mechanism                          |
| ------- | ------------------------------------ | --------------------------------- |
| Windows | SQLite (better-sqlite3) via Electron | Electron main process periodic sync + WS push |
| macOS   | SQLite (rusqlite) via Tauri          | Tauri Rust backend periodic sync + WS push |
| Linux   | SQLite (rusqlite) via Tauri          | Same as macOS                          |

### 5.5.3 Mobile Offline Strategy

| Platform    | Offline Storage      | Background Sync                              | Conflict Resolution                   |
| ------- | ------------- | ------------------------------------- | -------------------------- |
| Android | SQLite (Room) | WorkManager background task + FCM wake-up       | Last-Write-Wins + User Choice |
| iOS     | SQLite (GRDB) | BackgroundTasks framework + APNs wake-up | Same as Android                 |

### 5.5.4 Conflict Resolution Strategy

```text
Conflict detection:
  - Operation carries version_vector (based on MissionControlService snapshot version)
  - Server returns 409 Conflict triggers conflict resolution flow

Conflict resolution priority:
  1. Auto merge: non-conflicting fields are kept separately (e.g. simultaneously modifying different fields of different tasks)
  2. Last-Write-Wins: low-risk operations (view, mark as read)
  3. User choice: high-risk operations (approval, cancel, takeover) pop up conflict panel
  4. Server authority: operations involving authoritative state always follow the server
```

### 5.5.5 Offline Storage Capacity Planning

| Data Type     | Storage Method                        | Capacity Limit | Expiration Policy        |
| ------------ | ------------------------------- | -------- | --------------- |
| User Configuration     | SecureStorage / AsyncStorage    | 1MB      | Permanent            |
| Task List Cache | SQLite / IndexedDB              | 50MB     | Clean up if not visited for 30 days |
| Dashboard Snapshot     | SQLite / IndexedDB              | 10MB     | 24h             |
| Operation Queue     | SQLite / IndexedDB              | 20MB     | Clean up after sync      |
| Translation Files     | File System                        | 5MB      | Replace on version update  |
| Offline NL Model | File System (Edge-Mobile scenarios only) | 500MB    | Manual update        |

**Capacity Monitoring**: L3 sync-store tracks the usage of various storage types, automatically triggers LRU eviction when the threshold is exceeded and notifies the user via Toast.

### 5.5.6 Offline Operation Permission Matrix

Not all operations allow offline queuing. The following matrix defines the offline behavior of each operation type:

| Operation Category                   | Offline Queue | Optimistic Update | Auto Replay After Recovery | Conflict Strategy                  | Description                                  |
| -------------------------- | -------- | -------- | -------------- | ------------------------- | ------------------------------------- |
| Mark as Read                   | ✅       | ✅       | ✅             | Last-Write-Wins           | Idempotent operation, no conflict risk                  |
| Task Notes/Comments              | ✅       | ✅       | ✅             | Append merge                  | Offline comments appended to end of timeline              |
| Approval Operation (approve/reject) | ❌       | ❌       | N/A            | N/A                       | Approval has time sensitivity, "Requires network connection" is shown when offline  |
| Task Cancel                   | ⚠️       | ❌       | ⚠️ Requires confirmation      | User choice                  | Queue but no optimistic update, popup confirmation after recovery      |
| Admin Takeover             | ❌       | ❌       | N/A            | N/A                       | Emergency operation must be performed online                  |
| Panic Emergency Stop             | ❌       | ❌       | N/A            | N/A                       | Must be online, prompt that it cannot be performed offline          |
| Create New Task                 | ✅       | ✅       | ✅             | Server assigns ID to replace temporary ID | Optimistically generate temporary ID, replace after sync           |
| Modify Task Configuration               | ⚠️       | ✅       | ⚠️ Version check    | Version conflict → User choice       | Carries version_vector, popup conflict panel on 409 |
| View/Browse (Read-only)          | ✅       | N/A      | N/A            | Use stale cache          | Display cached data + "Offline data, may be expired"   |
| Marketplace Install           | ❌       | ❌       | N/A            | N/A                       | Requires downloading resources, must be online                |
| Export Report                   | ⚠️       | ❌       | ✅             | Queue, execute after recovery and notify    | Generation may be time-consuming, queue to execute online        |

**UI Prompt Specification**:

- Operations prohibited offline: button displays as disabled + tooltip "Requires network connection"
- Operations allowed to queue: button is normally available, after clicking it shows "Added to offline queue (position N)"
- Operations requiring confirmation: a confirmation dialog pops up when back online "The following operations were queued during offline, do you want to continue?"

## 5.6 Frontend Error Classification and Degradation Strategy

### 5.6.1 Error Classification

| Level   | Error Type                            | Impact Scope       | UI Performance                                              | Auto Recover    |
| ------ | ----------------------------------- | -------------- | ---------------------------------------------------- | ----------- |
| **P0** | Authentication failure / Token cannot refresh           | Global           | Force redirect to login page + clear local state                        | ❌          |
| **P1** | API service unreachable (all endpoints 5xx/timeout) | Global           | Global banner "Service temporarily unavailable" + read-only stale cache mode | ✅ 30s retry |
| **P2** | WebSocket connection disconnected                  | Real-time update       | Status bar "Real-time update unavailable" + auto degrade to SSE/polling          | ✅ Exponential backoff |
| **P3** | Single API endpoint failure (4xx/5xx)        | Single page/module    | Module-level error card "Loading failed, click to retry" + telemetry report | ✅ User triggered |
| **P4** | DomainUIConfig load failure             | Domain-related page     | Use default config + Toast "Domain config load failed, using default settings"  | ✅ Background retry |
| **P5** | Feature flag inconsistency                 | Single feature         | Hide features with uncertain state + log report                      | ✅ Next refresh |
| **P6** | Contract version mismatch           | Potential compatibility issues | Persistent banner warning + telemetry report + features not blocked       | ❌ Requires upgrade   |
| **P7** | Stale cache display                    | Data timeliness     | Data card corner mark "Cached data" + last update time               | ✅ Auto     |

### 5.6.2 Degradation Behavior Matrix

| Failure Scenario                    | Immediate Degradation Behavior                  | Sustained Degradation Behavior (>60s)               | Recovery Behavior                          |
| --------------------------- | ----------------------------- | ---------------------------------- | --------------------------------- |
| REST API all unreachable         | stale cache read-only + disable write operations | Global Error Boundary + offline mode prompt | Auto revalidate all active query |
| REST API partial endpoint exception       | Affected module shows ErrorCard      | ErrorCard + background 30s retry          | Auto refresh that module on success              |
| WebSocket disconnected              | Degrade to SSE                    | SSE also fails → degrade to 30s polling       | Auto switch back after WS recovery + catch-up      |
| DomainUIConfig missing         | Default config fallback          | Unchanged                               | Background periodic retry, hot replace on success      |
| Feature flag service unavailable     | Use last cached flag value        | Unchanged                               | Silent update after recovery                    |
| Contract version mismatch     | Persistent banner + normal function        | Unchanged                               | Remove banner after detecting version fix       |
| IndexedDB / SQLite write failure | Degrade to in-memory cache + Toast warning   | Try to clean up expired data and retry             | Write back in-memory data to persistent layer after recovery        |

### 5.6.3 Error Boundary Strategy

```text
App ErrorBoundary (P0/P1 level → Global error page)
  └─ Layout ErrorBoundary (Navigation still available)
       └─ Page ErrorBoundary (P3 level → page-level ErrorCard)
            └─ Widget ErrorBoundary (P4-P7 level → component-level fallback)
```

### 5.6.4 Mutation Idempotency and Retry Specification _(added v2.3)_

The idempotency and retry semantics of write operations (Mutation) directly affect data consistency and user experience. The following specifications define the behavior of each type of critical write operation.

#### Mutation Behavior Matrix

| Operation                     | Idempotency         | Idempotency Key  | Frontend Anti-Duplicate Submission          | Retryable After Failure | Retry Method      | UI State After Failure   |
| ------------------------ | -------------- | ---------------- | ----------------------- | ------------ | ------------- | ---------------- |
| Create Task                 | ✅ Idempotent (key) | `ULID`           | Disable 5s after click       | ✅           | Auto retry ×3   | Restore to unsubmitted     |
| Cancel Task                 | ✅ Idempotent        | `task_id`        | Disable after click until response | ✅           | Manual retry button  | Restore to pre-cancel state |
| Approval approve             | ✅ Idempotent        | `approval_id`    | Disable after click until response | ⚠️ Conditional      | Only 5xx retryable | Restore to pending approval     |
| Approval reject              | ✅ Idempotent        | `approval_id`    | Disable after click until response | ⚠️ Conditional      | Only 5xx retryable | Restore to pending approval     |
| Approval delegate            | ✅ Idempotent        | `approval_id+to` | Disable after click until response | ✅           | Manual retry      | Restore to pending approval     |
| Admin Takeover           | ❌ Non-idempotent      | N/A              | Two-person confirmation + disable      | ❌           | Auto retry prohibited  | Show failure reason     |
| Panic Emergency Stop           | ✅ Idempotent        | singleton        | Two-person confirmation + disable      | ✅           | Manual retry      | Show stop failure alert |
| Marketplace Install         | ✅ Idempotent (key) | `pack_id+ver`    | Progress bar + disable        | ✅           | Auto retry ×2   | Restore to not installed     |
| Domain Configuration Modification               | ⚠️ CAS         | `domain_id+ver`  | Disable after click until response | ⚠️ Conditional      | 409 → User choice  | Show conflict diff    |
| Worker Management (switch/stop) | ❌ Non-idempotent      | N/A              | Confirmation dialog + disable      | ❌           | Auto retry prohibited  | Show failure reason     |
| Task Notes/Comments            | ✅ Idempotent (key) | `ULID`           | Optimistic append + disable      | ✅           | Auto retry ×3   | Mark as "Send failed" |
| Export Report                 | ✅ Idempotent        | `export_id`      | Progress bar                  | ✅           | Auto retry ×2   | Notify user of export failure |

#### Idempotency Key Specification

```typescript
interface MutationOptions {
  idempotencyKey: string;
  retryPolicy: RetryPolicy;
  optimisticUpdate?: (cache: QueryCache) => void;
  rollback?: (cache: QueryCache) => void;
  disableUntilSettled: boolean;
}

interface RetryPolicy {
  maxRetries: number;
  retryOn: number[];
  backoff: "none" | "linear" | "exponential";
  baseDelay: number;
}
```

**Rules**:

- All POST/PUT/PATCH/DELETE requests must carry the `X-Idempotency-Key` request header
- Key generation strategy: `ULID` (create operations) or `resource ID + version number` (update operations) or `singleton` (globally unique operations)
- Frontend `RESTClient` interceptor automatically injects idempotency key
- When the backend returns `409 Conflict`, the frontend prohibits auto retry and must enter the conflict resolution flow
- When the backend returns `429 Too Many Requests`, the frontend delays retry according to the `Retry-After` header
- Anti-duplicate submission: after the mutation is triggered, the corresponding button is immediately `disabled` until the request is settled (success or final failure)

### 5.6.5 Optimistic Update Pattern

Critical write operations use optimistic update to enhance the experience:

| Operation       | Optimistic Update Strategy                         | Rollback Strategy                     |
| ---------- | ------------------------------------ | ---------------------------- |
| Create Task   | Immediately insert optimistic item at the head of the list   | Remove optimistic item + Toast |
| Approval Decision   | Immediately remove from pending approval list + update Badge count | Restore to pending approval + error prompt      |
| Agent Status | Immediately update status label                     | Restore original status + error prompt        |
| Configuration Change   | Immediately update configuration display                     | Restore original configuration + error prompt        |

### 5.6.6 HTTP Status Code → UI Behavior Mapping

```text
API response error
  │
  ├─ 401 Unauthorized → Trigger Token refresh → Retry → Still 401 → Redirect to login
  ├─ 403 Forbidden → Toast "Insufficient permissions" + Disable related buttons
  ├─ 404 Not Found → Jump to 404 page or Toast "Resource does not exist"
  ├─ 409 Conflict → Show conflict resolution UI (CAS version conflict)
  ├─ 422 Validation → Form field-level error prompt
  ├─ 429 Too Many Requests → Toast "Operation too frequent" + auto backoff retry
  └─ 5xx Server Error → Toast "Server error" + auto retry (max 2 times)
```

---

# Part V — Platform Governance

---

# 6. Domain Differentiation, Multi-Tenancy, Security and Design System

> **Improvements D-2, R-3**: Define DomainUIConfig consumption protocol aligned with backend; merge authentication/security chapters.

## 6.1 24-Domain Differentiated UI Engine

> **Improvement D-2**: Clarify how DomainUIConfig is derived from the backend DomainDescriptor.

### 6.1.1 DomainUIConfig Consumption Protocol

```text
Backend DomainDescriptor (see 00-platform-architecture.md domain descriptor)
    │
    │  GET /admin/v1/domains/{id}
    ▼
Frontend DomainUIConfigResolver
    │
    ├── Read DomainDescriptor.risk_level → map riskDisplayMode
    ├── Read DomainDescriptor.domain_type → map dashboardPanels template
    ├── Read DomainDescriptor.hitl_policy → map hitlEnhanced
    ├── Read DomainDescriptor.compliance_flags → map complianceExtensions
    └── Merge domainId → icon/color (look up from design-tokens/domain.ts)
    │
    ▼
DomainUIConfig (frontend runtime configuration object)
```

### 6.1.2 DomainUIConfig Type Definition

```typescript
interface DomainUIConfig {
  domainId: string;
  icon: string;
  color: string;
  riskDisplayMode: "standard" | "enhanced";
  hitlEnhanced: boolean;
  dashboardPanels: PanelConfig[];
  taskCardExtensions: ExtensionSlot[];
  approvalTemplate: string;
  realtimeIndicators: IndicatorConfig[];
  complianceExtensions: ComplianceExtConfig[];

  // [Planned] Added v2.2: Domain-level feature visibility
  featureVisibility: Record<string, boolean>;

  // [Planned] Added v2.2: Action-level policy
  actionPolicy: Record<string, ActionPolicyEntry>;

  // [Planned] Added v2.2: Default drilldown depth
  defaultDrillDepth: 1 | 2 | 3 | 4 | 5;

  // [Planned] Added v2.2: Domain terminology overrides
  glossaryOverrides: Record<string, string>;
}

interface PanelConfig {
  id: string;
  title: string;
  component: string;
  gridSpan: 1 | 2 | 3 | 4;
  dataSource: string;
  refreshInterval: number;
}

interface ExtensionSlot {
  position: "header" | "body" | "footer";
  component: string;
  visibleWhen?: string;
}

interface ActionPolicyEntry {
  action: "allow" | "confirm" | "approval_required" | "hidden";
  confirmMessage?: string;
  approvalWorkflow?: string;
}
```

### 6.1.2.1 DomainUIConfig Extension Field Description

| Field                | Type                           | Status      | Description                                                                                          |
| ------------------- | ------------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| `featureVisibility` | `Record<string, boolean>`      | [Planned] | Domain-level feature hiding switch. Key is the feature route name (e.g. `"workflow-builder"`), value is whether it is visible                |
| `actionPolicy`      | `Record<string, ActionPolicy>` | [Planned] | Action-level secondary confirmation / approval policy. Key is the action identifier (e.g. `"task.cancel"`), value defines whether confirmation, approval, or hiding is required     |
| `defaultDrillDepth` | `1 \| 2 \| 3 \| 4 \| 5`        | [Planned] | The default drilldown depth for pages under this domain, users can manually expand to the maximum depth allowed by permissions                              |
| `glossaryOverrides` | `Record<string, string>`       | [Planned] | Domain terminology replacement mapping. Key is the platform generic term (e.g. `"Task"`), value is the domain-specific term (e.g. `"Strategy"` for the quantitative trading domain) |

**featureVisibility Example**:

```json
{
  "workflow-builder": false,
  "workflow-debugger": false,
  "marketplace": true,
  "cost-center": true,
  "explainability": true
}
```

**actionPolicy Example** (Financial Services Domain):

```json
{
  "task.cancel": {
    "action": "approval_required",
    "approvalWorkflow": "finance-cancel-review"
  },
  "task.create": {
    "action": "confirm",
    "confirmMessage": "This operation will trigger the live trading process, confirm to continue?"
  },
  "admin.takeover": { "action": "hidden" }
}
```

**glossaryOverrides Example** (Quantitative Trading Domain):

```json
{
  "Task": "Strategy",
  "Workflow": "Pipeline",
  "Agent": "Trading Bot",
  "Approval": "Risk Review",
  "Domain": "Trading Desk"
}
```

### 6.1.3 Domain-Tiered UI Differences

| Domain Risk Level | UI Differences                                                                          | Example Domains                           |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------- |
| Critical   | All operations require secondary confirmation; risk panel expands by default; approval card includes complete risk assessment; emergency contact is always visible | Quantitative Trading, Financial Services, Healthcare     |
| High       | Write operations require confirmation; risk badges prominent; approval includes risk summary; cost warning threshold lowered                     | Legal, Finance, E-commerce Pricing, IT Operations    |
| Medium     | Standard UI; risk badges displayed normally; standard approval process                                          | Advertising, Customer Service, Content Moderation, Supply Chain |
| Low        | Simplified UI; risk panel can be hidden; approvals can be batch processed                                        | Data Analysis, Enterprise Knowledge Base, User Operations   |

### 6.1.4 Domain-Specific UI Extension Points (Examples)

| Domain       | Extension Components                                                    | Description                                   |
| -------- | ----------------------------------------------------------- | -------------------------------------- |
| Quantitative Trading | PositionPanel, PnLChart, RiskGauge                          | Position panel, P&L curve, VaR/CVaR dashboard    |
| E-commerce     | OrderTimeline, PriceCompare, InventoryHeatmap               | Order timeline, price comparison, inventory heatmap       |
| Advertising | CampaignDashboard, BudgetBurndown, CreativePreview          | Campaign dashboard, budget consumption, creative preview           |
| Financial Services | ComplianceChecklist, AuditTrail, RegulatoryReport           | Compliance checklist, audit trail, regulatory report           |
| Customer Service     | ConversationView, CSATChart, EscalationQueue                | Conversation view, satisfaction chart, escalation queue           |
| Healthcare | PatientTimeline, PhysicianReviewPanel, DrugInteractionAlert | Patient timeline, physician review panel, drug interaction alert |

### 6.1.5 Domain Extension Slot Pattern and Dynamic Loading

Functional modules reserve slots, and domain configuration determines the filling content:

```text
TaskDetailPage
  ├── [Fixed Area] Task Basic Info
  ├── [Slot: domain-task-header] ← Domain-specific header extension
  ├── [Fixed Area] Step List
  ├── [Slot: domain-task-detail] ← Domain-specific detail extension
  └── [Fixed Area] Action Button Bar

Extension component registration:
  quant-trading → PositionPanel, PnLChart, RiskGauge
  ecommerce     → OrderTimeline, PriceCompare
  advertising   → CampaignDashboard, BudgetBurndown
  healthcare    → PatientTimeline, DrugInteractionAlert
  coding        → CodeDiffViewer, PRTimeline, CIStatus
```

Domain extension components are loaded on demand via dynamic import, without increasing the initial bundle size:

```text
DomainExtensionLoader
  │
  ├─ Get current domainId
  ├─ Query DomainUIConfig
  ├─ Dynamic import(`@aa/domain-extensions/${domainId}/${slot}`)
  └─ Render to Slot position (Suspense + Skeleton fallback)
```

## 6.2 Multi-Tenant UI Architecture

### 6.2.1 Tenant Context

```text
User Login
    │
    ▼
TenantContextProvider
    ├── tenantId (parsed from JWT)
    ├── tenantConfig (theme color, Logo, feature flags)
    ├── orgTree (organization tree, see `00-platform-architecture.md` organization model)
    ├── featureFlags (tenant-level feature flags)
    └── complianceMode (GDPR/SOX/HIPAA affect UI display)
```

### 6.2.2 Tenant-Level UI Customization

| Customization Dimension | Customization Capability                                                 | Configuration Method                                |
| -------- | -------------------------------------------------------- | --------------------------------------- |
| Branding     | Logo, primary color, login page background, browser tab icon                 | Admin API → Tenant config                    |
| Features     | Feature module switches (e.g. hide Marketplace, disable NL entry)         | Tenant featureFlags                       |
| Dashboard     | Custom L1/L2 dashboard panel arrangement and visibility                        | User-level + Tenant-level config merge                 |
| Compliance     | GDPR mode hides/redacts specific fields; SOX mode forces audit trail visible | complianceMode auto-driven                 |
| Language     | Default language, available language list                                   | Tenant config                                |
| Mode     | Single-user mode vs Enterprise mode (see §6.2 Multi-Tenant UI Architecture)         | Auto-detect (user count ≤ 1 → single) + manual override |

### 6.2.3 Data Isolation Strategy

| Dimension     | Implementation                                      |
| -------- | ----------------------------------------- |
| API Isolation | All requests automatically inject `X-Tenant-Id` header     |
| Cache Isolation | TanStack Query key prefix includes tenantId      |
| Storage Isolation | Offline storage key prefix includes tenantId            |
| Tenant Switching | Clear all cache and offline data when switching → re-initialize |

## 6.3 Design System

### 6.3.1 Design Tokens

> _v2.2 Supplement: Add `primitive.ts` raw color palette (extracted from Doc-11 §15.1)_

```text
tokens/
  color/
    primitive.ts       # Raw color palette: slate-50..slate-950, blue, green, amber, red, etc.
    semantic.ts        # Semantic color: success/warning/error/info/neutral
    risk-level.ts      # Risk color: low(green-500)/medium(amber-500)/high(orange-500)/critical(red-600)
    autonomy-level.ts  # Autonomy color: suggestion(blue)/supervised(teal)/semi-auto(purple)/full-auto(green)
    status.ts          # Status color: pending/running/paused/completed/failed/aborted
    domain.ts          # 24 domain identification colors (each domain has a primary color + light background)
  spacing.ts           # 4px base grid: xs(4)/sm(8)/md(16)/lg(24)/xl(32)/xxl(48)
  typography.ts        # Font scale: caption(12)/body(14)/subtitle(16)/title(20)/headline(24)/display(32)
  elevation.ts         # Stacking: 0(flat)/1(card)/2(dropdown)/3(modal)/4(toast)/5(overlay)
  animation.ts         # Animation duration: fast(100ms)/normal(200ms)/slow(300ms)/easing: ease-in-out
  breakpoint.ts        # Responsive: sm(640)/md(768)/lg(1024)/xl(1280)/2xl(1440)
  border-radius.ts     # Border radius: none/sm(4)/md(8)/lg(12)/xl(16)/full(9999)
```

### 6.3.2 Core Component Library

| Component Category | Component List                                                                                    | Platform Support                         |
| -------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| Basic     | Button, IconButton, Link, Badge, Tag, Avatar, Tooltip                                       | All platforms                           |
| Input     | TextField, TextArea, Select, Checkbox, Radio, Switch, Slider, DatePicker, FileUpload        | All platforms                           |
| Data Display | Table, List, Card, Tree, Timeline, Stat, Progress, Skeleton                                 | All platforms                           |
| Feedback     | Toast, Alert, Modal, Drawer, Popover, Spinner, EmptyState                                   | All platforms                           |
| Navigation     | Sidebar, TopBar, Tabs, Breadcrumb, Pagination, CommandPalette                               | All platforms (mobile adaptation)             |
| Chart     | LineChart, BarChart, PieChart, Heatmap, Gauge, Sparkline                                    | All platforms (ECharts/Victory Native) |
| Business     | TaskCard, ApprovalCard, AgentHealthIndicator, RiskBadge, AutonomyBadge, CostMeter, NLBubble | All platforms                           |
| Composite     | WorkflowCanvas, DebugTimeline, OapeflirPanel, DagViewer, DiffViewer                         | Web + Desktop                       |

**Component Development Specification** _(added v2.2, extracted from Doc-11 §15.2)_ `[Planned]`:

| Dimension   | Specification                                                            |
| ------ | --------------------------------------------------------------- |
| Naming   | PascalCase component name; kebab-case file name                            |
| Props  | TypeScript interface definition; required/optional clearly marked                    |
| Documentation   | Each component comes with a Storybook story (at least: Default / Variants / States) |
| Testing   | Each component comes with a Vitest unit test (rendering + interaction + snapshot)                |
| Accessibility | Must include aria-label / role; keyboard navigation; focus management                  |
| Theme   | Dynamically respond to theme switching through CSS variables / RN StyleSheet                  |

### 6.3.3 Theme System

| Theme          | Description                                                   | Switching Method            |
| ------------- | ------------------------------------------------------ | ------------------- |
| Light         | Default light theme                                           | User settings / Follow system |
| Dark          | Dark theme (OLED friendly)                                  | User settings / Follow system |
| High Contrast | High contrast theme (WCAG AAA)                               | Accessibility settings          |
| Enterprise Custom | Support overriding primary color, Logo, font (see §6.2 Multi-Tenant UI Architecture) | Tenant-level configuration          |

Implementation Method:

- Web/Desktop: CSS Custom Properties + `prefers-color-scheme` media query
- React Native: `useColorScheme` hook + StyleSheet dynamic switching
- All chart colors are not used as the sole information carrier (WCAG: paired with shapes/labels)

**Dark Mode Design Rules**:

| Rule       | Description                                    |
| ---------- | --------------------------------------- |
| Background Color Hierarchy | Dark uses elevation instead of shadow to distinguish levels       |
| Text Contrast | Body text ≥ 7:1 (AAA); auxiliary text ≥ 4.5:1 (AA) |
| Chart Color   | Don't rely on color alone to distinguish data series, pair with shapes/labels   |
| Status Color     | Increase saturation in dark mode to ensure recognizability            |
| Images/Screenshots  | Add 1px dark border to prevent merging with background           |

### 6.3.4 Icon System

| Level     | Description                                             |
| -------- | ------------------------------------------------ |
| System Icons | Lucide Icons (MIT, 1000+ icons, React/RN compatible)   |
| Domain Icons   | 24 business domains each have a dedicated icon (SVG, sizes 16/20/24/32) |
| Status Icons | Task/Agent/Approval status unified icon set                    |
| Risk Icons | Risk level icons (shield series, color-coded)            |

## 6.4 Internationalization and Accessibility

### 6.4.1 i18n Implementation

| Level      | Implementation Method                                                                |
| --------- | ----------------------------------------------------------------------- |
| UI Text   | ICU MessageFormat (react-intl / react-native-intl); Key-Value translation files |
| Date/Time | Intl.DateTimeFormat (auto-format by locale)                             |
| Number/Currency | Intl.NumberFormat (ICU format)                                           |
| Relative Time  | Intl.RelativeTimeFormat                                                 |
| NL Conversation   | Auto-detect user input language → response language follows                                     |
| RTL Support  | CSS logical properties (Arabic/Hebrew direction adaptive)                   |

### 6.4.2 Language Priority

| Priority | Language             | Phase   |
| ------ | ---------------- | ------- |
| P0     | Simplified Chinese (zh-CN) | Phase 1 |
| P0     | English (en-US)     | Phase 1 |
| P1     | Traditional Chinese (zh-TW) | Phase 2 |
| P1     | Japanese (ja-JP)     | Phase 2 |
| P2     | Korean/German/French         | Phase 3 |

**Translation Workflow**:

```text
Developer writes defaultMessage (en-US)
  → CI automatically extracts message keys
  → Upload to translation platform (Crowdin/Phrase)
  → Translation team translates + Review
  → CI automatically pulls translation files
  → Build-time packaging (split by locale, lazy load)
  → Load the corresponding translation package by locale at runtime
```

### 6.4.3 Accessibility (WCAG 2.1 AA)

| Dimension     | Requirement                                                 |
| -------- | ---------------------------------------------------- |
| Keyboard Navigation | All functions can be completed through keyboard; focus order is logical; focus ring is visible |
| Screen Reading | All interactive elements have aria-label; dynamic content uses aria-live      |
| Color Contrast | Text contrast ≥ 4.5:1; large text ≥ 3:1; non-text ≥ 3:1         |
| Chart Alternative | All charts provide table alternative view; color is not the only information carrier     |
| Animation Safety | Respect prefers-reduced-motion; flash frequency < 3Hz          |
| Touch Target | Mobile touch target ≥ 44x44 dp                            |

#### 6.4.3.1 Complex UI Component Accessibility Special Guide _(added v3.0)_

| Component                        | Keyboard Interaction                                                                                          | Screen Reader                                                                                                                      | Fallback                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Permission Matrix Editor (§4.6.13)    | Arrow keys move cell focus; Space toggles checkbox; Enter edits dropdown; Tab jumps to first column of next row; Esc cancels edit       | Each cell `aria-label="{role} on {page} {permission type}: {current value}"`; announce change with `aria-live="polite"`                            | Provide "List View" alternative when more than 10 columns (one role-permission card per row) |
| ECharts Chart Dashboard (§4.2.8) | Tab focuses chart area; Enter expands data table alternative view; arrow keys navigate between data points (line/bar charts)               | `role="img"` + `aria-label="{chart title}: {summary description}"`; announce specific values when focusing on data points                                                  | Provide expandable `<table>` data table below each chart             |
| Workflow Canvas (§4.6.9)      | Tab moves between nodes in topological order; Enter opens node details; arrow keys fine-tune node position (edit mode); Delete deletes selected node | Each node `aria-label="{node name}, type: {step/condition/parallel}, status: {status}"`; connection relationship described through `aria-describedby` upstream and downstream | Provide "List View" alternative (linear display of all steps in execution order)        |
| NL Conversation Message Stream (§4.6.5)      | Message list `role="log"`; auto-scroll on new message can be paused through Esc; Tab focuses interactive elements (code block copy/approval button)   | `aria-live="polite"` only announces new message summary (avoid token stream verbatim announcement); announce complete reply after completion                                              | —                                                       |
| Operations Dashboard Multi-Panel (§4.6.8)     | Tab navigates between panels; Enter expand/collapse panel; panel internal Tab navigates sub-controls                                      | Each panel `role="region"` + `aria-label="{panel title}"`; folded state announces "Folded, press Enter to expand"                                         | Provide "Summary View" alternative (plain text KPI list)                   |

### 6.4.4 Keyboard Shortcuts

| Shortcut                 | Function                     | Platform       |
| ---------------------- | ------------------------ | ---------- |
| `Ctrl/Cmd + K`         | Open command palette             | Web + Desktop |
| `Ctrl/Cmd + N`         | New task (open NL conversation) | Web + Desktop |
| `Ctrl/Cmd + /`         | Toggle sidebar                 | Web + Desktop |
| `Ctrl/Cmd + Shift + D` | Open debugger               | Web + Desktop |
| `Tab`                  | Move focus forward                 | All platforms     |
| `Shift + Tab`          | Move focus backward                 | All platforms     |
| `Escape`               | Close popup/panel            | All platforms     |
| `A`                    | Approve (when approval page is focused) | Web + Desktop |
| `R`                    | Reject (when approval page is focused) | Web + Desktop |
| `D`                    | Delegate (when approval page is focused) | Web + Desktop |
| `?`                    | Show shortcut help           | Web + Desktop |

### 6.4.5 Screen Reader ARIA Specification

| Component     | ARIA Attribute                                              |
| -------- | ------------------------------------------------------ |
| Task Status | `role="status"` + `aria-live="polite"`                 |
| Approval Count | `aria-label="{n} pending approvals"`                        |
| Progress Bar   | `role="progressbar"` + `aria-valuenow/min/max`         |
| Risk Level | `aria-label="Risk level: {level}"` + color + text double indicator |
| Alert Banner | `role="alert"` + `aria-live="assertive"`               |
| Conversation Message | `role="log"` + `aria-live="polite"`                    |

## 6.5 Authentication and Session Security

> **Improvement R-3**: Merge Doc-10 §10.8 and Doc-11 §20.

### 6.5.1 Authentication Flow

```text
┌────────────┐                    ┌──────────────┐
│  UI Client │                    │ Platform API │
└─────┬──────┘                    └──────┬───────┘
      │  1. SSO Login (OIDC/SAML)         │
      │─────────────────────────────────▶│
      │  2. Return access_token + refresh  │
      │◀─────────────────────────────────│
      │  3. Store in platform secure storage             │
      │  4. API request carries Bearer token     │
      │─────────────────────────────────▶│
      │  5. Token expired → auto refresh     │
      │─────────────────────────────────▶│
      │  6. Refresh failed → re-login       │
      │◀─────────────────────────────────│
```

### 6.5.2 Secure Storage Strategy

| Platform    | Storage Method                                               | Token Type    |
| ------- | ------------------------------------------------------ | ------------- |
| Web     | HttpOnly Secure Cookie (access_token); in-memory (short term) | JWT           |
| Windows | Windows Credential Manager (DPAPI encryption)               | JWT + refresh |
| macOS   | Keychain Services (Secure Enclave protection)               | JWT + refresh |
| Linux   | libsecret (GNOME Keyring) / KWallet                    | JWT + refresh |
| Android | Android Keystore (TEE/StrongBox support)                 | JWT + refresh |
| iOS     | iOS Keychain (Secure Enclave protection)                    | JWT + refresh |

### 6.5.3 Session Security Strategy

| Strategy         | Description                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Token Refresh   | access_token TTL=15min; refresh_token TTL=7d; silent refresh is imperceptible                                           |
| Multi-Device Management   | Users can view and revoke active session list                                                                           |
| Device Binding     | Optional: refresh_token bound to device fingerprint, re-authentication required for new device                                                     |
| Biometric Unlock | Mobile/Desktop supports biometric quick unlock (does not replace first login)                                                    |
| SSO Logout     | Platform logout triggers SSO global logout (SCIM deprovisioning takes effect immediately, see `00-platform-architecture.md` SSO/SCIM) |
| Sensitive Operation     | High-risk operations (modifying security settings, approving high-value requests) require secondary authentication                                                     |

### 6.5.4 Frontend Security Baseline

| Threat     | Defense Measure                                                                |
| -------- | ----------------------------------------------------------------------- |
| XSS      | React default JSX escaping; CSP strict-dynamic; DOMPurify cleaning user input         |
| CSRF     | SameSite=Strict Cookie + CSRF Token (double submission)                         |
| Clickjacking | X-Frame-Options: DENY + CSP frame-ancestors 'none'                      |
| Man-in-the-Middle   | Full-link HTTPS; mobile Certificate Pinning                                |
| Data Leakage | PII not written to local cache; screenshot protection (mobile FLAG_SECURE / UIApplication mask) |
| Reverse Engineering | Mobile ProGuard/R8 obfuscation; JS bundle compression and obfuscation; no hardcoded keys               |
| Supply Chain   | Dependency locking (package-lock.json); CI auto npm audit / Snyk scan            |

**CSP Policy Configuration**:

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'strict-dynamic' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';        // CSS-in-JS required
  img-src 'self' data: https:;
  connect-src 'self' wss://{api-host};     // WebSocket
  font-src 'self';
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
```

### 6.5.5 Sensitive Data Handling

| Data Category     | Frontend Processing Rule                                            |
| ------------ | ------------------------------------------------------- |
| PII          | Not cached to IndexedDB/SQLite; redacted display in list (only shown in details) |
| Secret       | Not visible on frontend; backend returns `***masked***`                     |
| Audit Log     | Read-only display; does not support frontend modification/deletion                           |
| Token        | Only stored in platform secure storage; not written to localStorage/SessionStorage  |
| Offline Operation Queue | Encrypted storage (L4 SecureStorage implements encryption)                   |

## 6.6 Responsive and Adaptive Design

### 6.6.1 Breakpoint System

| Breakpoint | Width Range    | Device                           | Layout Mode                     |
| ---- | ----------- | ------------------------------ | ---------------------------- |
| xs   | < 640px     | Small phone (portrait)               | Single column stack                     |
| sm   | 640-767px   | Large phone / small phone (landscape)    | Single column + bottom navigation              |
| md   | 768-1023px  | Tablet (portrait) / large phone (landscape) | Collapsible sidebar + content            |
| lg   | 1024-1279px | Tablet (landscape) / small laptop       | Sidebar + content                  |
| xl   | 1280-1439px | Laptop / desktop                  | Sidebar + content + right panel       |
| 2xl  | ≥ 1440px    | Large desktop / multi-screen                | Three columns (sidebar + content + side panel) |

### 6.6.2 Function Layering (by Breakpoint)

| Function            | xs/sm           | md/lg           | xl/2xl                   |
| --------------- | --------------- | --------------- | ------------------------ |
| NL Conversation         | Full screen conversation        | Sidebar conversation        | Persistent right panel             |
| Task List        | List view        | List + preview     | List + details + side panel     |
| Dashboard            | Cards stacked vertically    | 2 column grid        | 4 column grid                 |
| Workflow Builder | Read-only view        | Limited editing        | Full editing + property panel      |
| Debugger          | Unavailable          | Basic timeline      | Full debugging + OAPEFLIR unfold |
| Approval            | Card list + operations | List + detail panel | Complete three columns                 |

### 6.6.3 Mobile Adaptation Special Considerations

| Consideration       | Handling Method                                         |
| ---------- | ------------------------------------------------ |
| Touch Target   | Minimum 44x44pt (iOS) / 48x48dp (Android)           |
| Gestures       | Pull to refresh, swipe left (approval quick processing), edge back     |
| Safe Area   | Adapt to notch/Dynamic Island/navigation bar                 |
| Input Method Adaptation | Auto-adjust layout when keyboard pops up, input field not blocked           |
| Landscape/Portrait     | Portrait is default; fully utilize width in landscape (dashboard 2 columns → 4 columns) |

---

# Part VI — Engineering and Delivery

---

# 7. CI/CD, Testing, Performance and Delivery Roadmap

## 7.1 Build and CI/CD Pipeline

> The currently landed command baseline in the repo is `npm run typecheck`, `npm test`, `npm run test:e2e` (Vitest smoke) and `npm run build`. The Playwright / Detox / packaging matrix described below is the target CI design and does not mean the repo has a complete native E2E release pipeline.

### 7.1.1 CI Pipeline

```text
PR Trigger
    │
    ├── lint (ESLint + Prettier)
    ├── typecheck (tsc --noEmit)
    ├── test:unit (Vitest, shared/ + ui-core/ + features/)
    ├── test:component (Storybook interaction tests)
    ├── security:audit (npm audit + Snyk)
    ├── build (Turborepo full build)
    └── test:e2e (Playwright Web + Detox Mobile) [main branch only]

Merge to main
    │
    ├── All of the above
    ├── coverage:gate (Vitest coverage + ratchet baseline)
    ├── bundle:analysis (webpack-bundle-analyzer / vite-bundle-visualizer)
    ├── lighthouse:ci (FCP/LCP/CLS/INP budget check)
    └── deploy:staging (Web → staging CDN; desktop/mobile → internal distribution)
```

### 7.1.2 CD Release Matrix

| Platform    | Build Output        | Release Channel                          | Update Mechanism                         |
| ------- | --------------- | --------------------------------- | -------------------------------- |
| Web     | Static SPA bundle | CDN / Docker nginx                | Instant deploy, Service Worker update    |
| Windows | MSIX / EXE      | Enterprise MDM / direct download               | electron-updater incremental update        |
| macOS   | DMG             | Mac App Store / direct download          | Sparkle (Tauri) incremental update         |
| Linux   | AppImage / DEB  | Direct download / package repository                 | AppImage delta update              |
| Android | AAB / APK       | Google Play / Enterprise MDM / APK direct | Play Store auto update / in-app update |
| iOS     | IPA             | App Store / TestFlight            | App Store auto update               |

### 7.1.3 Environment Strategy

| Environment       | Purpose           | Backend Connection               | Data Source       |
| ---------- | -------------- | ---------------------- | ------------ |
| local      | Developer local development | mock-server or local backend | Mock data     |
| dev        | Feature integration       | Shared dev backend           | Test data     |
| staging    | Pre-release validation     | staging backend           | Desensitized production data |
| production | Production environment       | Production backend               | Real data     |

### 7.1.4 CI Stage Details `[Planned]`

> _Added v2.2, extracted from Doc-11 §24.1 — 6-stage pipeline details_

```text
Push / PR
  │
  ├─ Stage 1: Lint + Typecheck (parallel)
  │   ├── npm run lint
  │   └── npm run typecheck
  │
  ├─ Stage 2: Unit + Component Test (parallel by package)
  │   ├── npm test
  │   ├── npm run test:e2e
  │   └── Storybook / doc alignment suites
  │
  ├─ Stage 3: Build All (dependency chain build)
  │   └── npm run build
  │
  ├─ Stage 4: E2E Test (parallel by platform)
  │   ├── Web: Playwright (Chrome + Firefox + Safari)
  │   ├── Mobile: Detox (Android emulator + iOS simulator)
  │   └── Desktop: Spectron (Electron) / Tauri test driver
  │
  ├─ Stage 5: Security Scan
  │   ├── npm audit
  │   ├── Snyk / Trivy dependency vulnerability scan
  │   └── ESLint security plugin
  │
  └─ Stage 6: Package (main/release branch only)
      ├── Web: Docker image (nginx + SPA)
      ├── Windows: MSIX / EXE (Code Signing)
      ├── macOS: DMG (Apple signing + notarization)
      ├── Linux: AppImage / DEB / RPM (GPG)
      ├── Android: AAB (Keystore signing)
      └── iOS: IPA (Apple signing)
```

Execution order: `lint → typecheck → test:unit → build → test:e2e → security:scan → package`

### 7.1.5 Auto-Update Strategy `[Planned]`

> _Added v2.2, extracted from Doc-11 §24.4_

| Platform    | Update Mechanism                                | User Experience                      |
| ------- | --------------------------------------- | ----------------------------- |
| Web     | Service Worker + Cache API              | Background download → refresh prompt           |
| Windows | electron-updater (GitHub Releases / S3) | Background download → restart prompt (delta package) |
| macOS   | Tauri updater (Sparkle protocol)            | Background download → restart prompt           |
| Linux   | AppImage: appimagetool delta            | Manual/script update                 |
| Android | Google Play auto update                    | Play managed                     |
| iOS     | App Store auto update                      | App Store managed                |

## 7.2 Testing Strategy

> The current in-repo UI testing is mainly Vitest + Testing Library + documentation consistency tests; `npm run test:e2e` currently carries the in-repo smoke E2E baseline. Playwright / Detox / Spectron are still retained according to the target state plan.

### 7.2.1 Test Pyramid

| Level     | Tool                 | Coverage Target                            | Quantity Ratio |
| -------- | -------------------- | ----------------------------------- | -------- |
| Unit Testing | Vitest               | shared/ pure logic, hooks, utils        | 70%      |
| Component Testing | Vitest + Testing Lib | ui-core/ and features/ component rendering + interaction | 20%      |
| Integration Testing | Vitest + MSW         | API integration, WebSocket flow, offline sync  | 7%       |
| E2E Testing | Playwright / Detox   | Critical user journeys                        | 3%       |

### 7.2.2 Critical Test Scenarios

| Scenario                    | Validation Content                                        | Tool         |
| ----------------------- | ----------------------------------------------- | ------------ |
| Task Create → Execute → Complete      | NL input → API call → WS status update → card status change | Playwright   |
| Approval Flow                  | Receive notification → view details → approve/reject → status feedback      | Playwright   |
| Offline → Recovery               | Disconnect → operation queue → recovery → sync → conflict resolution        | Vitest + MSW |
| Multi-Tab WebSocket      | Multiple tabs share connection → event broadcast → state consistency           | Playwright   |
| Mobile Approval Quick Action      | Push notification → notification bar action → API call                | Detox        |
| Five-Level Drilldown (TaskCockpit) | L1→L2→L3→L4→L5 progressive drilldown → data correctly loaded          | Playwright   |
| SSO Login                | OIDC redirect → Token storage → API authentication → silent refresh    | Playwright   |

### 7.2.3 Visual Regression Testing

| Tool      | Purpose                                      |
| --------- | ----------------------------------------- |
| Storybook | Component documentation + visual isolated development                   |
| Chromatic | Storybook screenshot comparison + visual regression detection         |
| Percy     | Cross-browser visual regression (Chrome/Firefox/Safari) |

### 7.2.4 Testing Toolchain `[Planned]`

> _Added v2.2, extracted from Doc-11 §25.2 — Complete 9-category testing tool matrix_

| Test Category     | Tool                                   | Scope                             |
| ------------ | -------------------------------------- | -------------------------------- |
| Unit Testing     | Vitest                                 | shared/\* pure logic                 |
| Component Testing     | Vitest + React Testing Library         | ui-core, ui-mobile components          |
| API Integration Testing | Vitest + MSW (Mock Service Worker)     | api-client, queries              |
| Visual Regression     | Storybook + Chromatic                  | ui-core components                     |
| Web E2E      | Playwright                             | Main user flows (Chrome/FF/Safari) |
| Mobile E2E   | Detox (iOS/Android)                    | Core flows                         |
| Desktop E2E   | Spectron / Tauri test driver           | Basic smoke test                     |
| Performance Testing     | Lighthouse CI + Web Vitals             | Web performance metrics                     |
| Accessibility Testing   | axe-core (Playwright) + VoiceOver manual | WCAG compliance                        |

### 7.2.5 v3.0 New Module Testing Strategy _(added v3.0)_

| Module                | Test Focus                                                                           | Special Tools/Technology                                    |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Agent Monitoring (§4.2.7) | WS real-time push → list update consistency; 500+ Agent virtual scroll performance; health state aggregation accuracy          | Vitest + MSW (WS mock) · Playwright performance assertions     |
| Statistics Platform (§4.2.8)   | ECharts chart rendering correctness; role-adaptive visibility; time range switching data refresh; empty data fallback    | Storybook + Chromatic visual snapshot · Vitest data conversion |
| Configuration Management (§4.2.9)   | Permission matrix editor CRUD + rollback; feature flag rollout percentage effect; model configuration optimistic lock conflict; multi-role isolation | Playwright role switch E2E · Vitest optimistic lock mock     |

**ECharts Testing Strategy**:

- **Unit Testing**: Validate DTO → ECharts option conversion logic (pure function, does not depend on DOM)
- **Visual Snapshot**: Storybook story defines fixture data for each chart type (Line/Pie/Heatmap/Bar/Gauge/BoxPlot), visual regression through Chromatic
- **Performance Assertion**: Playwright validates chart page LCP < 3s (including ECharts dynamic loading), concurrent rendering ≤ 4 charts with frame rate ≥ 30fps

**Permission Matrix Editor Testing Strategy**:

- Keyboard navigation testing (Tab/arrow keys/Enter toggle switch) — axe-core + Playwright
- Permission inheritance correctness (modify parent role → child role synchronous change) — Vitest unit test
- Large matrix rendering (50 pages × 5 roles × 4 operations = 1000 cells) — virtual rendering performance verification

### 7.2.6 Coverage Requirements `[Planned]`

> _Added v2.2, extracted from Doc-11 §25.3_

| Code Layer      | Line Coverage Target | Branch Coverage Target |
| ----------- | ------------ | -------------- |
| shared/\*   | ≥ 90%        | ≥ 80%          |
| ui-core     | ≥ 80%        | ≥ 70%          |
| features/\* | ≥ 70%        | ≥ 60%          |
| apps/\*     | ≥ 50%        | ≥ 40%          |

## 7.3 Performance Budget

### 7.3.1 Web Performance Budget

| Metric       | Target Value          | Measurement Tool   | Enforcement Measure                  |
| ---------- | --------------- | ---------- | ------------------------- |
| FCP        | < 1.5s          | Lighthouse | CI gate, exceeding standard PR cannot merge |
| LCP        | < 2.5s          | Lighthouse | CI gate                   |
| CLS        | < 0.1           | Lighthouse | CI gate                   |
| INP        | < 200ms         | Lighthouse | CI gate                   |
| JS Main Bundle    | < 200KB gz      | bundlesize | CI gate                   |
| Route Lazy Loading | First screen < 100KB gz | bundlesize | Code Splitting enforcement       |

### 7.3.2 Desktop/Mobile Performance Budget

| Metric               | Target Value                              | Platform   |
| ------------------ | ----------------------------------- | ------ |
| Startup Time           | < 3s (desktop) < 2s (mobile)            | All platforms |
| Memory Footprint (idle) | < 300MB (Electron) < 150MB (Tauri) | Desktop   |
| Frame Rate               | ≥ 60fps (animation/scroll)                | All platforms |
| WebSocket Latency     | Event→UI < 200ms P99                 | All platforms |

### 7.3.3 Performance Optimization Strategy

| Strategy           | Implementation Method                                                              |
| -------------- | --------------------------------------------------------------------- |
| Code Splitting | React.lazy + Suspense split by route; heavy components (ECharts/ReactFlow) dynamic import |
| Virtual Scroll       | TanStack Virtual handles long lists (task list/approval list/log)                 |
| Preload         | prefetchQuery() preload next level drilldown data                                  |
| Web Worker     | JSON parsing, diff calculation and other CPU intensive operations moved to Web Worker                    |
| Image Optimization       | WebP/AVIF format + srcset responsive + lazy loading                         |
| Server-Side Aggregation     | Use MissionControlService aggregated view to reduce API roundtrip                 |

**Web Optimization Details**:

| Strategy           | Implementation                                          |
| -------------- | --------------------------------------------- |
| Code Splitting       | React.lazy + Suspense, split feature modules by route     |
| Tree Shaking   | Vite default + ESM module ensures dead code elimination       |
| Resource Preload     | `<link rel="modulepreload">` critical path module     |
| Image Optimization       | WebP + responsive srcSet + lazy loading       |
| Font Optimization       | System font stack primary; icon font changes to SVG sprite       |
| Skeleton Screen         | All lists/dashboards use Skeleton component to avoid CLS       |
| Virtual List       | Task list/approval list exceeds 50 entries use VirtualList   |
| Service Worker | Static asset Cache-First; API Network-First + SWR |
| CDN            | Static asset CDN distribution; API keep direct connection               |

**Mobile Optimization Details**:

| Strategy         | Implementation                                           |
| ------------ | ---------------------------------------------- |
| Hermes Engine  | Pre-compile JS bytecode, startup speed up 2-3x          |
| List Virtualization   | FlashList (Shopify) replaces FlatList              |
| Image Cache     | FastImage component + memory/disk dual-level cache             |
| Animation         | Reanimated 3 + native driven animation, avoid JS thread blocking  |
| Background Data Refresh | Utilize iOS BackgroundTasks / Android WorkManager |
| Package Size       | Metro bundle split by architecture (arm64/x86_64)        |

**Desktop Optimization Details**:

| Strategy       | Implementation                                              |
| ---------- | ------------------------------------------------- |
| Startup Acceleration   | Electron: v8 snapshot + preload key modules            |
| Memory Management   | Inactive windows unload WebView; periodic GC                   |
| Multi-Window     | Electron: BrowserWindow pool reuse                  |
| Incremental Update   | electron-updater delta package (~5MB vs full ~120MB)    |
| Tauri Advantages | No Chromium bundle; Rust backend memory safety; package size ~15MB |

### 7.3.4 Chart-Dense Page Performance Budget _(added v3.0)_

The data statistics platform (§4.2.8) and operations dashboard (§4.6.8) contain multi-chart concurrent rendering and need additional performance constraints:

| Metric                       | Target Value                | Enforcement Measure                                               |
| -------------------------- | --------------------- | ------------------------------------------------------ |
| ECharts package size (on-demand) | < 150KB gz            | Only introduce used chart type + renderer; CI bundlesize gate |
| Monaco Editor (model configuration)  | < 200KB gz            | Dynamic import; only loaded in `/shared/settings/models` route   |
| Chart page LCP               | < 3s                  | ECharts delayed initialization + skeleton screen placeholder                        |
| Maximum concurrent chart rendering           | ≤ 4 in visible area      | Charts in non-visible areas use IntersectionObserver delayed initialization     |
| Chart animation frame rate               | ≥ 30fps               | Disable animation when data volume > 1000 points                             |
| Single chart data point upper limit           | ≤ 2000 points (aggregated display) | Backend does downsample when exceeded, frontend shows "Aggregated" prompt          |

**ECharts Tree-Shaking Strategy**:

```typescript
import { use } from "echarts/core";
import { LineChart, PieChart, BarChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([
  LineChart,
  PieChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);
```

### 7.3.5 CI Build Impact Assessment _(added v3.0)_

The impact of the 3 new feature modules in v3.0 on CI:

| Impact Item                 | Estimated Impact            | Mitigation Measure                                                |
| ---------------------- | ------------------- | ------------------------------------------------------- |
| ECharts package size growth     | +120-150KB gz       | On-demand introduction + route-level lazy loading; does not affect main bundle < 200KB gate        |
| Monaco Editor package size   | +180-200KB gz       | Only `/settings/models` route dynamic loading; bundlesize separate limit |
| New 3 feature modules | +30-50KB gz/module    | Code Split enforced; CI each route < 100KB gz gate coverage        |
| Component test increment           | +200-300 test cases | CI parallelism from 4 → 6; estimated increase ~30s test time               |
| Storybook story increment   | +40-60 stories     | Chromatic incremental comparison by change; does not affect total CI time              |

## 7.4 Phased Delivery Plan

### Phase 1 — Web MVP (12 weeks)

**Gate 0 (Phase 1 startup prerequisite)**:

| #    | Gate Condition                                                   | Validation Method                        | Responsible Party     |
| ---- | ---------------------------------------------------------- | ------------------------------- | ---------- |
| G0-1 | Backend REST API v1 OpenAPI spec published and frozen                 | `GET /api/v1/openapi.json` available | Backend Team   |
| G0-2 | WebSocket handshake protocol documented (JWT auth + schema_version negotiation) | WebSocketBridge integration test passed    | Backend Team   |
| G0-3 | MissionControlService 6 methods can be called through HTTP           | console-routes integration test passed     | Backend Team   |
| G0-4 | `ui_console_and_cockpit_contract.md` marked as Accepted     | Documentation status check                    | Architecture Review   |
| G0-5 | DomainDescriptor + DomainUIConfig JSON Schema published       | Schema validation test passed             | Domain Platform Team |
| G0-6 | `analyticsConsent` PlatformAdapter interface specification reviewed          | ADR review record                    | Frontend Architecture   |

| Week   | Deliverable                                                   |
| ------ | -------------------------------------------------------- |
| W1-2   | Monorepo scaffold + shared/ foundation + Storybook + mock-server |
| W3-4   | Authentication flow + Dashboard + SystemStatusBar                   |
| W5-6   | TaskCockpit (L1-L3 drilldown) + ApprovalCenter                |
| W7-8   | StabilityPanel + NL Conversation                         |
| W9-10  | WebSocket real-time layer + offline foundation + WorkflowCockpit            |
| W11-12 | AdminTakeoverConsole + E2E testing + performance optimization + release        |

### Phase 2 — Desktop (8 weeks)

**Gate 1 (Phase 2 startup prerequisite)**:

| #    | Gate Condition                                                         | Validation Method               | Responsible Party     |
| ---- | ---------------------------------------------------------------- | ---------------------- | ---------- |
| G1-1 | Phase 1 Web MVP passed UAT acceptance                                  | UAT signed report           | QA + Product  |
| G1-2 | `windowing` / `shell` / `process` PlatformAdapter interface specification frozen | ADR-UI-009 review passed    | Frontend Architecture   |
| G1-3 | Electron 34 + Tauri 2.x shell PoC passed (including auto-update verification)          | PoC demo + test report    | Desktop Team |
| G1-4 | Backend §5.2.2 P1 priority new endpoints ≥ 80% implemented                     | API integration test coverage report | Backend Team   |
| G1-5 | Desktop CI matrix (§2.6.3) configured                               | CI pipeline running record   | DevOps     |

| Week | Deliverable                                               |
| ---- | ---------------------------------------------------- |
| W1-2 | Electron Windows shell + system integration (tray/shortcuts/notifications) |
| W3-4 | Tauri macOS/Linux shell + native integration                    |
| W5-6 | Workflow Builder (React Flow canvas) + Debugger foundation   |
| W7-8 | Desktop E2E + auto update + packaged release                     |

### Phase 3 — Mobile (8 weeks)

**Gate 2 (Phase 3 startup prerequisite)**:

| #    | Gate Condition                                        | Validation Method                  | Responsible Party        |
| ---- | ----------------------------------------------- | ------------------------- | ------------- |
| G2-1 | Phase 2 Desktop passed UAT acceptance                   | UAT signed report              | QA + Product     |
| G2-2 | RN 0.79 + Hermes + Fabric technology verification passed          | PoC performance report (startup < 2s) | Mobile Team    |
| G2-3 | FCM/APNs push channel configured and integration tested           | Push end-to-end test report        | Backend + Mobile |
| G2-4 | `screenSecurity` PlatformAdapter interface specification frozen | ADR review record              | Frontend Architecture      |
| G2-5 | Offline operation permission matrix (§5.5.6) confirmed with product          | Product signed confirmation              | Product          |

| Week | Deliverable                                             |
| ---- | -------------------------------------------------- |
| W1-2 | RN 0.79 scaffold + ui-mobile components + navigation structure         |
| W3-4 | Dashboard + TaskCockpit + ApprovalCenter mobile    |
| W5-6 | Push notification + offline sync + biometric                     |
| W7-8 | Detox E2E + performance optimization + App Store / Play Store release |

### Phase 4 — Enhanced Features (Ongoing)

**Gate 3 (Phase 4 startup prerequisite)**:

| #    | Gate Condition                                                   | Validation Method              | Responsible Party     |
| ---- | ---------------------------------------------------------- | --------------------- | ---------- |
| G3-1 | Phase 3 Mobile passed UAT acceptance                              | UAT signed report          | QA + Product  |
| G3-2 | Backend §5.2.2 P2/P3 priority endpoints ≥ 60% implemented                  | API coverage report        | Backend Team   |
| G3-3 | DomainUIConfig extension fields (§6.1.2.1) Schema stabilized           | Schema compatibility test passed | Domain Platform Team |
| G3-4 | At least 3 domains have glossaryOverrides + featureVisibility configured | Domain config validation script passed    | Domain Admin   |

- Workflow Debugger time travel
- 24 domain-specific extension components
- Multi-language P1/P2 coverage
- Edge-Mobile offline mode
- Cost Center + Marketplace + Explainability

### Team Configuration Suggestions

| Role          | Phase 1 | Phase 2 | Phase 3 | Description             |
| ------------- | ------- | ------- | ------- | ---------------- |
| Frontend Architect    | 1       | 1       | 1       | Full participation         |
| Web Development      | 3       | 2       | 1       | Phase 1 as the main force   |
| Desktop Development    | 0       | 2       | 1       | Electron + Tauri |
| RN Mobile Development | 0       | 0       | 3       | Phase 3 as the main force   |
| UX Designer     | 1       | 1       | 1       | Full participation         |
| QA            | 1       | 2       | 2       | Increases with platforms       |
| **Total**      | **6**   | **8**   | **9**   |                  |

## 7.5 Risks and Mitigations

| Risk                                    | Impact | Probability | Mitigation Measure                                                  |
| --------------------------------------- | ---- | ---- | --------------------------------------------------------- |
| Backend missing UI-required API endpoints               | High   | High   | Phase 1 simultaneously raises API enhancement requirements (§5.2.2); mock-server decoupling |
| RN 0.79 New Arch ecosystem library compatibility issues       | Medium   | Medium   | Community library pre-research; backup plans for key native modules                          |
| Tauri WebKitGTK compatibility on Linux distributions | Low   | Medium   | CI multi-distribution testing (Ubuntu/Fedora/Arch); AppImage fallback      |
| WebSocket blocked behind enterprise firewall/proxy     | Medium   | Medium   | SSE fallback + polling degradation (§5.3.4)                         |
| 24 domain extension component development volume                   | Medium   | High   | Phase 4 progressive delivery; templated component framework to reduce duplicate development              |
| Offline conflict resolution user experience poor                  | Low   | Medium   | Minimize offline write operation scope; prioritize LWW automatic resolution                   |
| Frontend and backend schema out of sync                    | High   | High   | codegen tool automatically generates frontend types from backend Zod; CI validation          |
| App Store review rejected                      | Medium   | Medium   | Research review guidelines in advance; reserve 2 weeks of review buffer                       |
| Installer size exceeding standard (Electron)               | Low   | Medium   | Incremental update; lazy load non-core modules                                |

---

# Appendices

## Appendix A: Backend API Endpoints → UI Features Complete Mapping {#appendix-a}

| Endpoint                                   | Status                     | API Layer | UI Consumer Module                                                        |
| -------------------------------------- | ------------------------ | --------- | ------------------------------------------------------------------ |
| `GET /api/v1/tasks`                    | [Implemented/Contracted] | Layer C   | task-cockpit, dashboard                                            |
| `POST /api/v1/tasks`                   | [Implemented/Contracted] | Layer C   | conversation (NL → task)                                           |
| `GET /api/v1/tasks/:id`                | [Implemented/Contracted] | Layer C   | task-cockpit (L2-L3)                                               |
| `POST /api/v1/approvals/:id`           | [Implemented/Contracted] | Layer C   | approval                                                           |
| `GET /api/v1/dashboard/*`              | [Implemented/Contracted] | Layer C   | dashboard, stability                                               |
| `GET /console/*`                       | [Implemented/Internal]   | Layer B   | dashboard (SSR fallback)                                           |
| `GET /admin/v1/*`                      | [Implemented/Contracted] | Layer B/C | takeover, workers, policy, settings                                |
| MissionControlService.\*               | [Implemented/Internal]   | Layer A   | dashboard, task-cockpit, wf-cockpit, stability, takeover, approval |
| OperatorConsoleBackendService.\*       | [Implemented/Internal]   | Layer A   | inspect, incidents, workers                                        |
| `GET /api/v1/agents`                   | [Implemented/Contracted] | Layer C   | agent-manager                                                      |
| `CRUD /api/v1/workflows`               | [Planned]                | Layer C   | workflow-cockpit, workflow-builder                                 |
| `GET /api/v1/marketplace`              | [Implemented/Contracted] | Layer C   | marketplace                                                        |
| `GET /api/v1/explanations`             | [Implemented/Contracted] | Layer C   | explainability                                                     |
| `GET /api/v1/costs`                    | [Planned]                | Layer C   | cost-center                                                        |
| `GET /api/v1/dashboard/metrics`        | [Implemented/Contracted] | Layer C   | dashboard (L2-L4)                                                  |
| `GET /api/v1/tasks/:id/evidence`       | [Planned]                | Layer C   | task-cockpit (L4)                                                  |
| `GET /api/v1/tasks/:id/timeline`       | [Planned]                | Layer C   | task-cockpit (L5)                                                  |
| `DELETE /api/v1/tasks/:id`             | [Implemented/Contracted] | Layer C   | task-cockpit (Cancel Task)                                            |
| `GET /api/v1/workflow-runs`            | [Implemented/Contracted] | Layer C   | task-cockpit (Run List)                                            |
| `GET /api/v1/workflow-runs/{id}/steps` | [Implemented/Contracted] | Layer C   | task-cockpit (Step Details)                                            |
| `GET /api/v1/approvals`                | [Implemented/Contracted] | Layer C   | approval (Approval List)                                                |
| `GET /api/v1/incidents`                | [Implemented/Contracted] | Layer C   | alerts, stability (Incident Panel)                                  |
| `GET /api/v1/knowledge`                | [Implemented/Contracted] | Layer C   | explainability (Knowledge Reference View)                                      |
| `GET /api/v1/packs`                    | [Implemented/Contracted] | Layer C   | agent-manager (Agent List)                                         |
| `POST /api/v1/packs`                   | [Implemented/Contracted] | Layer C   | domain-wizard (Pack Registration)                                          |
| `GET /api/v1/packs/{id}/versions`      | [Implemented/Contracted] | Layer C   | agent-manager (Version Management)                                           |
| `GET /api/v1/plugins`                  | [Implemented/Contracted] | Layer C   | marketplace (Market List)                                             |
| `GET /api/v1/prompts`                  | [Implemented/Contracted] | Layer C   | agent-manager (Prompt Version)                                        |
| `GET /api/v1/cost-reports`             | [Planned]                | Layer C   | cost-center (Cost Data)                                             |
| `GET/POST /api/v1/webhooks`            | [Implemented/Contracted] | Layer C   | settings (Webhook Management)                                            |
| `GET /api/v1/admin/workers`            | [Implemented/Internal]   | Layer B   | dashboard L3 (Worker Status)                                         |
| `GET/PUT /api/v1/admin/config`         | [Implemented/Contracted] | Layer B/C | settings (Configuration Management)                                                |
| `GET/POST /api/v1/admin/rollouts`      | [Planned]                | Layer C   | agent-manager (Grayscale Release)                                           |
| `GET/POST/PUT /api/v1/admin/tenants`   | [Planned]                | Layer C   | settings (Tenant Management)                                                |
| `GET/PUT /api/v1/admin/budgets`        | [Planned]                | Layer C   | cost-center (Budget Configuration)                                             |
| `ws/v1/stream`                         | [Implemented]            | Layer C   | Global (Real-time Event Push)                                                |

## Appendix B: WebSocket Event Complete Mapping {#appendix-b}

| Event                            | Status          | Source                       | UI Module                      |
| ------------------------------- | ------------- | -------------------------- | ---------------------------- |
| `status_changed`                | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit, dashboard      |
| `progress`                      | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit                 |
| `message_delta`                 | [Implemented] | WebSocketBridge            | conversation                 |
| `artifact_ready`                | [Implemented] | WebSocketBridge            | task-cockpit                 |
| `approval_requested`            | [Implemented] | WebSocketBridge            | approval, dashboard          |
| `completed`                     | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit, dashboard      |
| `failed`                        | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit, dashboard      |
| `approval.resolved`             | [Planned]     | WebSocketBridge            | approval                     |
| `incident.created`              | [Planned]     | IncidentService            | alerts, stability            |
| `panic.activated`               | [Planned]     | PanicService               | Global overlay                     |
| `hitl.intervention_required`    | [Planned]     | HITL module                | hitl, approval               |
| `agent.health_changed`          | [Planned]     | AgentRegistry              | agent-manager, dashboard     |
| `dashboard.metric_updated`      | [Planned]     | DashboardProjectionService | dashboard                    |
| `nl.clarification_needed`       | [Proposed]    | NLEntryService             | conversation                 |
| `cost.budget_alert`             | [Proposed]    | CostService                | cost-center, dashboard       |
| `drift.alert`                   | [Proposed]    | DriftDetector              | stability, alerts            |
| `agent.registered`              | [Planned]     | AgentRegistryService       | agent-manager                |
| `agent.deregistered`            | [Planned]     | AgentRegistryService       | agent-manager                |
| `workflow.updated`              | [Planned]     | WorkflowDefinitionService  | workflow-builder             |
| `workflow.published`            | [Planned]     | WorkflowDefinitionService  | workflow-builder, wf-cockpit |
| `workflow.validation_result`    | [Planned]     | WorkflowDefinitionService  | workflow-builder             |
| `marketplace.pack_published`    | [Planned]     | MarketplaceService         | marketplace                  |
| `marketplace.pack_updated`      | [Planned]     | MarketplaceService         | marketplace                  |
| `marketplace.install_completed` | [Planned]     | MarketplaceService         | marketplace                  |
| `cost.period_closed`            | [Proposed]    | CostService                | cost-center                  |
| `debug.step_entered`            | [Planned]     | DebuggerService            | workflow-debugger            |
| `debug.breakpoint_hit`          | [Planned]     | DebuggerService            | workflow-debugger            |
| `debug.state_snapshot`          | [Planned]     | DebuggerService            | workflow-debugger            |
| `goal.decomposition_ready`      | [Proposed]    | GoalDecompositionService   | conversation                 |
| `config.updated`                | [Planned]     | admin-routes               | settings                     |

## Appendix C: ADR Decision Index {#appendix-c}

| ADR Number   | Decision                                            | Status   |
| ---------- | ----------------------------------------------- | ------ |
| ADR-UI-001 | React 19 as the unified UI framework                         | Approved |
| ADR-UI-002 | Electron (Win) + Tauri (Mac/Linux) hybrid strategy       | Approved |
| ADR-UI-003 | Zustand 5 + TanStack Query v5 state management          | Approved |
| ADR-UI-004 | pnpm + Turborepo Monorepo                       | Approved |
| ADR-UI-005 | Contract information architecture as the first-level navigation structure                    | This document |
| ADR-UI-006 | WebSocket priority + SSE fallback + polling degradation        | This document |
| ADR-UI-007 | Web offline three-layer strategy                                | This document |
| ADR-UI-008 | DomainUIConfig derived from DomainDescriptor         | This document |
| ADR-UI-009 | Electron (Win) + Tauri (Mac/Linux) desktop hybrid shell governance | This document |

## Appendix D: Glossary {#appendix-d}

| Term                  | Meaning                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| MissionControlService | Backend core service that aggregates all Cockpit view data                               |
| WebSocketBridge       | Backend production-grade WebSocket service that supports JWT authentication and event broadcast                    |
| DomainDescriptor      | Backend business domain descriptor, contains domain configuration, risk level, policies, etc.                        |
| DomainUIConfig        | Frontend domain UI configuration object, derived from DomainDescriptor                          |
| OAPEFLIR              | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release eight-stage loop |
| HITL                  | Human-In-The-Loop                                            |
| L1-L5                 | UI information drilldown levels (five-level drilldown defined in contract §7)                             |
| shared_snapshot       | Globally shared snapshot data source defined in the contract                                          |
| shared_query          | Cross-page shared query data source defined in the contract                                        |
| page_local_api        | Page-level dedicated API data source defined in the contract                                       |
| Layer A/B/C           | API exposure level: Service Method / Internal Route / Public Contract EP    |
| Idempotency Key       | Write operation idempotency identifier, preventing repeated execution caused by retries                              |
| RedactionRule         | Field-level redaction rule, defines the visibility policy for each role on each field                      |
| SPA                   | Single Page Application                                     |
| SSO                   | Single Sign-On                                              |
| OIDC                  | OpenID Connect, identity authentication protocol based on OAuth2                            |
| PKCE                  | Proof Key for Code Exchange, OAuth2 security extension                          |
| RN                    | React Native                                                          |
| DAG                   | Directed Acyclic Graph                                    |
| CAS                   | Compare-And-Swap, optimistic lock                                              |
| FCP                   | First Contentful Paint                                  |
| LCP                   | Largest Contentful Paint                                |
| CLS                   | Cumulative Layout Shift                                 |
| INP                   | Interaction to Next Paint                           |
| WCAG                  | Web Content Accessibility Guidelines                                  |
| PWA                   | Progressive Web App                                                   |
| MSW                   | Mock Service Worker                                                   |
| BFF                   | Backend For Frontend                                                  |
| CDN                   | Content Delivery Network                                              |

## Appendix E: v2.3 Remediation Checklist (P0/P1/P2) {#appendix-e}

> This appendix records the remaining improvement items identified after the v2.2 expert review and their handling status in v2.3.

### P0 — Blocking Issues (Fixed in v2.3)

| #    | Issue                                                                  | Risk                                                  | v2.3 Handling                                                   |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| P0-1 | `[Implemented]` label does not distinguish between "has service method" and "has public JSON contract" | Frontend mistakenly treats Layer A service method as a directly consumable endpoint | §1.7 adds Implemented three-level sub-labels; §4.1/§5.2/Appendix A fully annotated |
| P0-2 | Unclear semantic layer of `/console/*` and `/admin/v1/*`                          | Frontend is unsure whether to consume HTML fallback or JSON API          | §5.2.3 adds Public UI API Surface three-layer classification                  |
| P0-3 | `[Implemented]`/`[Planned]` mixed with `[已实现]`/`[需新增]` markers         | Reduced document credibility                                        | Unified to English label format throughout                                      |

### P1 — High Priority Improvements (Fixed in v2.3)

| #    | Issue                                                                        | Risk                                               | v2.3 Handling                                         |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| P1-1 | 6 Planned modules lack closed-loop contracts (DTO/actions/query keys/permission/WS/offline) | Backend API design has no alignment baseline, mock-server cannot accurately mock | §4.7 adds 6 module mini-contracts                  |
| P1-2 | Lack of field-level visibility/redaction matrix                                                     | PII leakage risk in enterprise deployment scenarios                      | §4.5.4 adds FieldVisibilityPolicy + RedactionRule |
| P1-3 | Write operations lack idempotency/retry semantics                                                       | Duplicate submission, data inconsistency                               | §5.6.4 adds Mutation Idempotency and Retry Specification               |
| P1-4 | service / route / endpoint terminology mixed use                                         | Readers misunderstand API exposure levels                              | §5.2.3 defines Layer A/B/C; Appendix D supplements terms          |

### P2 — Medium Priority Improvements (Partially Fixed, Some Followed Up in Subsequent Versions)

| #    | Issue                                                                             | Risk                    | v2.3 Handling                                                | Follow-up Version |
| ---- | -------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- | -------- |
| P2-1 | PlatformAdapter partial capability boundary is vague (screenSecurity/analyticsConsent/windowing)    | Cross-platform no-op behavior is not defined | Platform scope annotated in §3.7.1 table; detailed no-op specification        | v2.4     |
| P2-2 | Whether PlatformAdapter `process.getAppVersion()`/`getBuildChannel()` belongs to all-platform capabilities | Unclear responsibility boundary            | Keep [Planned] status, marked as "Phase 2 review confirmation"            | v2.4     |
| P2-3 | Web `screenSecurity` actual capability is very weak                                             | Gives users a false sense of security        | §3.7.1 table notes "Desktop + Mobile", Web is no-op         | —        |
| P2-4 | `windowing` and multi-window state synchronization protocol is not defined                                           | Data inconsistency between multiple windows      | Keep [Planned]; covered in Phase 2 Gate 1 prerequisites          | v2.4     |
| P2-5 | §4.1 information architecture table "Backend data source" column mixes service method and route references                 | Ambiguous API exposure levels       | §4.1 table updated with Implemented sub-label; §5.2.3 explicit layering | —        |
| P2-6 | Some internal reference numbers (e.g. "see §6 API") do not match the current document structure                          | Reader navigation confusion            | Full text reference review, corrected to current numbers                             | —        |

### Subsequent Version Backlog

| #   | Issue                                                                         | Planned Version |
| --- | ---------------------------------------------------------------------------- | -------- |
| B-1 | Each PlatformAdapter capability group supplements no-op / degraded behavior specification               | v2.4     |
| B-2 | Workflow/Agent/Marketplace WS subscription protocol detailed design                               | v2.4     |
| B-3 | DomainUIConfig extension fields (featureVisibility/actionPolicy etc.) JSON Schema published | v2.4     |
| B-4 | 24 domain-specific extension components mini-contracts (expanded from §6.1.4)                               | v2.5     |
| B-5 | End-to-end contract test automation (OpenAPI spec → frontend type → mock → E2E)         | v2.5     |
