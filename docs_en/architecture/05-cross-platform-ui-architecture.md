# 12. Cross-platform UI unified architecture (improved version)

automatic_agent/automatic-agent-platform-main/docs_en/architecture/12-cross-platform-ui-architecture-v2.md

> **Documentation version**: v3.0
> **Document Status**: Accepted
> **Baseline Document**: `00-platform-architecture.md` v3.2 Five-Plane Architecture · `contracts/ui_console_and_cockpit_contract.md`
> **Preface documentation**: `10-cross-platform-ui-architecture.md` (v1 overview, Superseded) · `11-cross-platform-ui-implementation-design.md` (v1 implementation, Superseded)
> **Applicable objects**: Front-end architects, UI/UX engineers, mobile/desktop development, QA, DevOps, platform SRE
> **Design Position**: A single authoritative UI architecture specification. Fully merge all content of Doc-10 and Doc-11, eliminate version inconsistencies, align backend implementation

---

## Revision History

| Version | Date | Author | Summary of Changes |
| ---- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2.0 | 2026-04-22 | — | Merge Doc-10/Doc-11; Unify framework version; Align MissionControlService/WebSocketBridge backend implementation; Restructure information architecture mapping |
| v2.1 | 2026-04-23 | — | Doc-11 Second Review Backfill: Extend the PlatformAdapter interface (clipboard/lifecycle/deepLink/haptics); add Zustand Store interface definition + TanStack Query staleTime strategy; add SharedWorker WebSocket architecture diagram; add offline storage capacity planning table; add keyboard shortcut table + ARIA specification |
| v2.2 | 2026-04-23 | — | Expert review revision: introduce four-level status labels (Implemented/Planned/Proposed/Deferred); add desktop mixed shell governance rules; expand PlatformAdapter five sets of capabilities (windowing/shell/process/analyticsConsent/screenSecurity); add page-level permission matrix; add DTO→VM→Props anti-corruption layer specifications; add WebSocket Subscription domain model; add offline operation permission matrix; expand DomainUIConfig four groups of domain management interfaces; add delivery phase dependency access control; add front-end error classification and downgrade strategy; add contract version negotiation; document hygiene cleaning; status Draft→Accepted. Doc-11 High-value content extraction: §4.6 Implementation Reference Blueprint (NL Dialog/HITL/Workflow Debugger/Approval Center); §5.4.1-5.4.5 API Communication Layer Details (RESTClient/WSClient/Endpoint Mode/Authentication Process/Offline Queue); §6.3 Design Token Supplement (primitive.ts) + Component Development Specification; §7.1.4-7.1.5 CI Stage Details + Automatic update strategy; §7.2.4-7.2.5 Test toolchain + coverage requirements |
| v2.3 | 2026-04-23 | — | Baseline enhancement revision: Implemented state split three-level sub-tags (Contracted/Internal/Partial); new §5.2.3 Public UI API Surface layering (service method / route / public contract endpoint); new §4.7 Planned module mini-contract (AgentManager/WorkflowBuilder/WorkflowDebugger/Marketplace/Explainability/CostCenter); Added §4.5.4 Field-level visibility and desensitization matrix (FieldVisibilityPolicy/RedactionRule/PIIHandlingByRole); Added §5.6.4 Mutation idempotent and retry specifications; Document hygiene closing (`[Implemented]`/`[Need to add]` unified to `[Implemented]`/`[Planned]` tags; service/route/endpoint terminology unification; rectification list appendix E) |
| v3.0 | 2026-04-23 | — | See v3.0 change details below |
| v3.1 | 2026-04-23 | — | The `ui/` Monorepo baseline has been implemented in the warehouse: the `UI0-UI7` wave of shared core, PlatformAdapter, design tokens, implemented-first feature registry, planned feature seam, Web buildable app shell, desktop/mobile smoke-ready shell, UI sub-project test baseline and `current_todo_list`. |
| v3.2 | 2026-04-23 | — | `Phase 1-4` code baseline alignment in the warehouse: Complete the four first-level features of `policy/audit/workers/queues`, enhance the `Phase 1-4` phase plan of Web group navigation, desktop/mobile platform capability testing and `current_todo_list`; add a snapshot of the internal warehouse alignment to the text. |

#### v3.0 change details

**Doc-11 Fully Merged** (Doc-11 is officially marked as Superseded by Doc-12 v3.0):

- Absorb all 27 remaining unique content from Doc-11 + 6 page wireframes
- §3.7.3 Implementation strategy table for each platform; §3.7.4 Adapter injection mechanism (Provider chain)
- §4.4.1 Routing table enhancement (permission column + Code Split column); §4.4.2 Mobile navigation enhancement (Screen level + navigation feature table); §4.4.3 Permission routing guard chain (5-layer Guard)
- §4.6.5-4.6.10 Page wireframe (NL dialogue/task three columns/approval/kanban/WF builder/debugger data flow)
- §5.1 Status classification table + QueryClient global configuration + Offline persistence + Data flow pattern diagram; §5.1.1-5.1.5 Subsection numbers
- §5.3.2.1-5.3.2.3 WSEventRouter architecture diagram/event→Query mapping/emergency event handling
- §5.4.6 Paging and filtering standardization; §5.6.5 Optimistic update mode; §5.6.6 HTTP status code → UI behavior mapping
- §6.1.5 Domain extension Slot mode and dynamic loading; §6.2.3 Data isolation strategy; §6.3.3 Dark mode design rules
- §6.4.2 Translation workflow; §6.5.4 CSP policy configuration; §6.5.5 Sensitive data processing; §6.6.3 Special considerations for mobile terminal adaptation
- §7.3.3 Detailed optimization list for each platform (9 items for Web/6 items for mobile/5 items for desktop); §7.4 Team configuration recommendations; §7.5 Risk supplement
- Appendix A is expanded to 20 lines of endpoints; Appendix D is expanded to 17 terms

**Governance Enhancements**:

- §1.7 New status label update responsibility mechanism (responsible person/update timing/mandatory verification node matrix)
- §4.7 mini-contract adds authoritative source / derived source / projection owner three columns
- §5.2.4 Added Internal → Contracted API Graduation Matrix (13 data source upgrade list + upgrade process)

**Three major functional modules have been added**:

- §4.2.7 Agent real-time monitoring center (list + details + heartbeat timeline + load curve + real-time WS policy + mobile terminal adaptation)
- §4.2.8 Data statistics and analysis platform (multi-level KPI dashboard + 7 chart types + role adaptive indicator system + DashboardMetricsDTO)
- §4.2.9 Configuration Management Center (7 sub-pages + complete DTO + operation matrix)
- §4.6.8 Operational Kanban four-layer panel detailed specification expansion (28 panels + data source + chart type + refresh strategy)
- §4.6.11-4.6.13 Three new technology solutions (Agent monitoring hook/statistical chart rendering architecture/configuration sub-page routing + permission matrix editor)
- §4.7.7-4.7.8 Added AnalyticsDashboard + ConfigurationCenter mini-contract
- §5.2.2 Added 15 new Planned API endpoints; added 8 new routes to the routing table

**Full Text Review Fix**:

- **P0-1**: `/shared/settings/org` ghost route → Add organization subpage to §4.2.9
- **P0-2**: Conflict between settings `[Implemented/Contracted]` vs ConfigCenter `[Planned]` → changed to `[Implemented/Partial]`
- **P0-3**: Appendix B is missing 13 WS events → all have been supplemented
- **P0-4**: `nl.clarification_needed` status is inconsistent → unified to `[Proposed]`
- **P1-1**: `runtime-decisions` Layer 2 diagram annotation `[Deferred]` + footnote
- **P1-2**: 9 unnormalized modules → Added §4.2.10 Summary of implemented modules
- **P1-3**: feature-flags route ownership → The routing table is marked as "Configuration Management Subpage §4.2.9"
- **P1-4**: §4.5.1 Added 3 new lines of AgentMonitor/Analytics/ConfigCenter to the permission matrix
- **P1-5**: `compliance_officer` remapped to `domain_admin+`
- **P1-6**: §7.2.5 Added v3.0 module testing strategy (ECharts + permission matrix editor)
- **P1-7**: §5.1 Renumbering of subsections (5.1.1-5.1.6)
- **P1-8**: Add traceability reference instructions before the table of contents
- **P2-1**: §7.3.4 Chart-intensive page performance budget
- **P2-2**: §4.2.7-4.2.9 Added error handling and offline degradation table
- **P2-3**: §6.4.3.1 Special Guidelines for Accessibility of Complex UI Components
- **P2-4**: §7.3.5 CI Build Impact Assessment
- **P2-5**: Added AnalyticsScreen to mobile navigation
- **P2-6**: Add `analytics/` directory to the directory tree
- **P2-7**: The audit log subpage is marked as linked to Governance → Audit
- **P2-9**: §5.2.1 Added `/api/v1/meta/contract-version` endpoint
- **P2-10**: turbo.json `"pipeline"` → `"tasks"` (Turborepo 2.x)
- Added `analytics` module to Layer 2 chart |

---

## 0. Review summary and improvement list

> **Remarks on implementation in the warehouse (2026-04-23)**: The current warehouse has added a `ui/` sub-project as the implementation baseline of this document. Implemented content is given priority to cover `UI0-UI7`: engineering skeleton, shared core, PlatformAdapter, design system, implemented-first feature registry, planned feature seam, Web construction link, desktop/mobile smoke shell, document consistency test, and `Phase 1-4` code baseline in the warehouse written back according to `§7.4`.

### 0.0 Phase 1-4 alignment snapshot in the warehouse (2026-04-23)

| Phase | Alignment status in the warehouse | Current implementation in the warehouse |
| --- | --- | --- |
| Phase 1 — Web MVP | Baseline implemented | `apps/web` can be built and run; `dashboard / task-cockpit / workflow-cockpit / approval / stability / alerts / dispatch / inspect / health / incidents / policy / audit / takeover / workers / queues / conversation / hitl / domain-wizard / settings` has been incorporated into Web route registry and route guard |
| Phase 2 — Desktop | The baseline has been implemented | `apps/electron-win / apps/tauri-macos / apps/tauri-linux` has provided shell manifest, default adapter, shared runtime reuse and smoke test; `windowing / shell / process / analyticsConsent` has PlatformAdapter baseline / test double |
| Phase 3 — Mobile | Baseline has been implemented | `apps/mobile` has provided Android/iOS shell manifest, default adapter, deepLink / haptics / secure storage / screen security baseline and smoke test |
| Phase 4 — Enhanced functions | Baseline has been implemented | `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance` has been implemented in the warehouse through typed seam + feature gate; the enhancement module continues to evolve according to the text status label |

Additional notes:

- In-repository rectification of `UIR1-UIR6` for [ui-design-vs-implementation-review.md](/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/reviews/ui-design-vs-implementation-review.md) has been completed.
- The current UI sub-project has provided `npm install && npm run typecheck && npm test && npm run build` closed-loop script.
- The desktop and mobile terminals are accepted according to the "smoke-ready engineering baseline", and the store release, signature and real native bridge online are not disguised as closed loops in the warehouse.

This document is based on a full review of Doc-10 (line 1229) and Doc-11 (line 2341), as well as cross-validation of the back-end Interface Plane implementation. The following 12 improvements have been identified and implemented one by one in this document.

### 0.1 Cross-document duplication problem

| # | Problem | Impact | Improvements to this documentation |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------- |
| R-1 | Technology selection (React 19 / Zustand / TanStack Query / pnpm / Turborepo) is almost repeated column-by-column in Doc-10 §10.4 and Doc-11 §3 | Maintenance costs are doubled, changing one place will miss another | Merged into a single §2 technology selection, eliminating duplication |
| R-2 | The Monorepo directory structure is written in Doc-10 §10.5 and Doc-11 §5.1 each. Doc-11 is more detailed but contains subdirectories not covered by Doc-10 | Two directory trees with different granularities cause confusion | Merged into a single §3 project structure, based on the detailed version of Doc-11 |
| R-3 | The authentication process is fully described in Doc-10 §10.8 and Doc-11 §20, and the content is highly overlapping | Same as above | Merged into §6.5 Authentication and Session Security |
| R-4 | The list of feature modules is defined in both Doc-10 §10.5 features/ and Doc-11 §8 core page blueprint | Module naming and grouping are not completely consistent | Merged into §4 feature module blueprint |

### 0.2 version inconsistent

| # | Question | Doc-10 Values | Doc-11 Values | Uniform Values for this Document | Justification |
| --- | ----------------- | ------------ | --------- | ------------ | ---------------------------------------------------------- |
| V-1 | Electron version | 33 | 34 | **34.x** | Doc-11 is a follow-up document and adopts an updated version; Electron 34 has been stable |
| V-2 | React Native version | 0.76 | 0.79 | **0.79** | Same as above; RN 0.79 New Architecture is enabled by default, with better performance |
| V-3 | Vite version | Unmarked major | 6 | **6.x** | Explicitly locked |
| V-4 | TypeScript version | 5.x | 5.8+ | **5.8+** | Aligned with backend tsconfig |

### 0.3 backend alignment gap

| # | Question | Details | Improvements to this documentation |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A-1 | The mapping between the UI function modules and the UI contract page is unclear | The contract definition is 5 pages (TaskCockpit/WorkflowCockpit/ApprovalCenter/StabilityPanel/AdminTakeoverConsole); Doc-10/11 defines 14 features modules without explicit mapping | §4 New explicit mapping table |
| A-2 | REST API endpoints include hypothetical endpoints | Doc-10 §10.6.2 List endpoints such as `/api/v1/agents`, `/api/v1/dashboard/metrics`, `/api/v1/explanations`, etc., which do not exist in the backend http-server route | §5.2 Distinguish between [Implemented] and [Planned] endpoints; §5.2.3 Added API Layer classification |
| A-3 | WebSocket event types are inconsistent | Backend `TaskWebSocketEvent` defines 6 events (status_changed/progress/message_delta/artifact_ready/approval_requested/completed/failed); Doc-10 §10.6.3 lists 15 UI events, most of which have no backend correspondence | §5.3 Press [Implemented]/[Planned] Layered |
| A-4 | The view provided by MissionControlService is not referenced in the UI document | `getSnapshot()`/`getTaskCockpit()`/`getWorkflowCockpit()`/`getStabilityPanel()`/`getAdminTakeoverConsole()`/`listApprovalQueue()` is a ready-made backend entry | §4 Each page blueprint directly references the MCS method |
| A-5 | The Console information architecture (Contract §3) is not aligned with the features module grouping | The contract defines 4 groups of navigation (Mission Control/Operations/Governance/Admin); Doc-10/11 is tiled by features | §4.1 Use the contract information architecture as the first-level navigation |

### 0.4 Insufficient design depth

| # | Issues | Improvements to this documentation |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| D-1 | The strategy of offline architecture on the Web side is ambiguous (IndexedDB vs Service Worker cache is not tiered) | §5.5 Clarify the three-tier Web offline strategy |
| D-2 | 24 Domain differentiation UI engine and backend DomainDescriptor/DomainUIConfig alignment is undefined | §6.1 Define DomainUIConfig consumption protocol |
| D-3 | The 5-level drill-down (L1-L5) required by the contract has no specific design at the UI component layer | §4.2 Define the drill-down component tree for TaskCockpit/WorkflowCockpit |

---

## Directory

> **Citation Note**: The `§` reference in the form of "Extracted from Doc-11 §24.1" in the text points to the original chapter number of `11-cross-platform-ui-implementation-design.md` that has been Superseded (§ number > 8), and is only for traceability annotation; cross-references within the document use the chapter number of this document.

**Part I — Overall Design (§1-§2)**
1. [Design Overview and Positioning](#1-Design Overview and Positioning)
   - 1.7 Status label convention _(v2.2 new)_ + Status label update responsibility mechanism _(v3.0 new)_
   - 1.8 Contract version negotiation _(new in v2.2)_
2. [Six-platform technology selection] (#2-Six-platform technology selection)
   - 2.6 Desktop Mixed Shell Governance Rules _(New in v2.2)_

**Part II — Engineering Base (§3)**

3. [Monorepo Engineering Structure and Layered Architecture](#3-monorepo-Engineering Structure and Layered Architecture)
   - 3.7.1 PlatformAdapter interface _(v2.2 extension: windowing/shell/process/analyticsConsent/screenSecurity)_
   - 3.7.3 Implementation strategies for each platform _(new in v3.0, extracted from Doc-11 §7.2)_
   - 3.7.4 Adapter injection mechanism _(new in v3.0, extracted from Doc-11 §7.3)_

**Part III — Functional modules (§4)**

4. [Alignment of function module blueprint and UI contract] (#4-Alignment of function module blueprint and -ui-contract)
   - 4.2.7 Agent real-time monitoring center _(new in v3.0)_
   - 4.2.8 Data statistics and analysis platform _(new in v3.0)_
   - 4.2.9 Configuration Management Center (Permissions/Function Switches/Model Configuration/Domain Settings/Tenants/Webhook) _(new in v3.0)_
   - 4.2.10 Implemented module summary _(new in v3.0)_
   - 4.5 Page-level permission matrix _(new in v2.2)_
   - 4.4.1 Web/Desktop routing table (including permission column + Code Split column) _(v3.0 enhancement)_
   - 4.4.2 Mobile navigation structure (including Screen level + feature table) _(v3.0 enhanced)_
   - 4.4.3 Permission routing guard chain _(new in v3.0, extracted from Doc-11 §9.3)_
   - 4.6 Implementation Reference Blueprint _(new in v2.2, extracted from Doc-11)_
     - 4.6.1 NL Dialog State Machine → UI Mapping
     - 4.6.2 HITL operation panel and recovery mode
     - 4.6.3 Workflow debugger capability matrix
     - 4.6.4 Approval center interactive features
     - 4.6.5-4.6.10 page wireframe _(new in v3.0, extracted from Doc-11 §8)_
     - 4.6.11-4.6.13 Agent monitoring/statistics platform/configuration management technology solution _(new in v3.0)_
   - 4.7 Planned module mini-contract _(new in v2.3)_ + authoritative/derived source column _(new in v3.0)_
     - 4.7.7 AnalyticsDashboard _(new in v3.0)_
     - 4.7.8 ConfigurationCenter _(new in v3.0)_

**Part IV — Data and Communications (§5)**

5. [Data flow, API integration and real-time layer] (#5-Data flow api-integration and real-time layer)
   - 5.1.1 Zustand Store / 5.1.2 TanStack Query / 5.1.3 QueryClient / 5.1.4 Offline persistence / 5.1.5 Data flow mode _(v3.0 number)_
   - 5.1.6 ViewModel mapping specification _(new in v2.2, original §5.1.4 renumbered)_
   - 5.2.3 Public UI API Surface layering _(v2.3 new)_
   - 5.2.4 Internal → Contracted upgrade list (API Graduation Matrix) _(new in v3.0)_
   - 5.3.6 WebSocket subscription domain model _(new in v2.2)_
   - 5.4.1–5.4.5 API communication layer details _(new in v2.2, extracted from Doc-11 §6.1-6.3)_
   - 5.5.6 Offline operation permission matrix _(new in v2.2)_
   - 5.3.2.1-5.3.2.3 WSEventRouter Schema/Event→Query Mapping/Emergency Event _(new in v3.0)_
   - 5.4.6 Paging and filtering standardization _(new in v3.0, extracted from Doc-11 §12.2)_
   - 5.6 Front-end error classification and downgrade strategy _(new in v2.2)_
   - 5.6.4 Mutation idempotent and retry specifications _(new in v2.3)_
   - 5.6.5 Optimistic update mode _(new in v3.0, extracted from Doc-11 §12.3)_
   - 5.6.6 HTTP status code → UI behavior mapping _(new in v3.0, extracted from Doc-11 §12.4)_

**Part IV-b — Permissions and Desensitization (§4 Extension)**

- 4.5.4 Field-level visibility and desensitization matrix _(new in v2.3)_

**Part V — Platform Governance (§6)**

6. [Domain differentiation, multi-tenancy, security and design system] (#6-Domain differentiation multi-tenant security and design system)
   - 6.1.2 DomainUIConfig type definition _(v2.2 extension: featureVisibility/actionPolicy/defaultDrillDepth/glossaryOverrides)_
   - 6.1.5 Domain extension Slot mode and dynamic loading _(new in v3.0, extracted from Doc-11 §10.3-10.4)_
   - 6.2.3 Data isolation strategy _(new in v3.0, extracted from Doc-11 §22.3)_
   - 6.3.1 Design token _(v2.2 supplement primitive.ts)_
   - 6.3.2 Core Component Library _(new in v2.2, extracted from Doc-11 §15.2)_
   - 6.3.3 Theme system (including dark mode design rules) _(new in v3.0, extracted from Doc-11 §16.3)_
   - 6.4.2 Language priority (including translation workflow) _(new in v3.0, extracted from Doc-11 §17.3)_
   - 6.4.3.1 Special Guidelines for Accessibility of Complex UI Components _(New in v3.0)_
   - 6.5.4 Front-end security baseline (including CSP policy) + §6.5.5 Sensitive data processing _(new in v3.0)_
   - 6.6.3 Special considerations for mobile terminal adaptation _(new in v3.0, extracted from Doc-11 §19.3)_

**Part VI — Engineering and Delivery (§7)**

7. [CI/CD, testing, performance and delivery route] (#7-cicd test performance and delivery route)
   - 7.1.4 CI Stage details _(new in v2.2, extracted from Doc-11 §24.1)_
   - 7.1.5 Automatic update policy _(new in v2.2, extracted from Doc-11 §24.4)_
   - 7.2.4 Test Toolchain _(New in v2.2, extracted from Doc-11 §25.2)_
   - 7.2.5 v3.0 module testing strategy _(new in v3.0)_
   - 7.2.6 Coverage requirements _(new in v2.2, extracted from Doc-11 §25.3, original §7.2.5 renumbered)_
- 7.3.3 Performance Optimization Strategy (Web/Mobile/Desktop Detailed Table) _(New in v3.0, extracted from Doc-11 §23.2-23.4)_
   - 7.3.4 Chart-intensive page performance budget _(new in v3.0)_
   - 7.3.5 CI Build Impact Assessment _(New in v3.0)_
   - 7.4 Phased Delivery Plan _(v2.2 adds Gate 0-3 dependency gate control)_ + Team configuration suggestions _(v3.0 adds)_
   - 7.5 Risks and Mitigation _(v3.0 adds 3 supplementary risks)_

**Appendix**

- [Appendix A: Backend API endpoint → UI function complete mapping](#Appendix-a)
- [Appendix B: Complete mapping of WebSocket events](#Appendix-b)
- [Appendix C: ADR Decision Index](#Appendix-c)
- [Appendix D: Glossary](#Appendix-d)
- [Appendix E: v2.3 rectification list (P0/P1/P2)](#Appendix-e) _(v2.3 new)_

---

# Part I — Overall Design

---

# 1. Design overview and positioning

## 1.1 Background

The Automatic Agent Platform backend has completed the development of the five-plane architecture (P1 Interface / P2 Control / P3 Orchestration / P4 Execution / P5 State-Evidence + X1 Reliability Fabric), with 79 CLI entries as the current only interaction method. The backend is Node.js 22 + TypeScript ESM, a pure backend system with zero front-end dependencies.

This document defines a unified UI layer covering six major platforms (Web / Windows / macOS / Linux / Android / iOS), so that all roles (independent operators → platform SRE) can complete daily operations through the graphical interface.

## 1.2 Relationship with five-plane architecture

```text
┌────────────────────────────────────────────────────────────┐
│ Coverage of this document: Cross-platform UI layer │
│ │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ │
│ │ Web │ │ Win │ │ macOS │ │Linux │ │Droid │ │ iOS │ │
│ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ │
│ └────────┴────────┴───────┴────────┴─────────┘ │
│ │ │
│ Shared core layer (TypeScript) │
│ API Client / State / Auth / Sync │
└───────────────────────┬───────────────────────────────────────┘
                         │ REST + WebSocket (§5.2/§5.3 API and real-time layer)
                         ▼
┌────────────────────────────────────────────────────────────┐
│ P1 Interface Plane (backend implemented) │
│ │
│ ┌──────────────────┐ ┌───────────────────────┐ ┌───────────────┐ │
│ │ HTTP API Server │ │ WebSocket Server │ │ Stream Bridge│ │
│ │ (task/admin/ │ │ (WebSocketBridge + │ │ (SSE) │ │
│ │ console/dashboard│ │ DashboardWSServer │ │ │ │
│ │ routes) │ │ + TaskWSRelay) │ │ │ │
│ └───────────────────┘ └────────────────────────┘ └────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ MissionControlService — Data aggregation entry for all Cockpit views │ │
│ │ getSnapshot() · getTaskCockpit() · getWorkflowCockpit() │ │
│ │ getStabilityPanel() · getAdminTakeoverConsole() │ │
│ │ listApprovalQueue() │ │
│ └────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ OperatorConsoleBackendService — Operator Snapshot/Approval/Worker/Event │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ P2 Control · P3 Orchestration · P4 Execution │
│ P5 State-Evidence · X1 Reliability Fabric │
└────────────────────────────────────────────────────────────┘
```

**Key constraints**: The UI layer is a **pure consumer** of the P1 Interface Plane and follows the UP-1 (API-First) principle:

- All data available via REST API (§5.2) and `ws/v1/stream` (§5.3)
- All operations map to standard REST endpoints
- Do not introduce a bypass to bypass the policy check of P2 Control Plane
- UI presentation state must not inversely define the authoritative fact of task/workflow/execution (Contract §2.5)

## 1.3 Design goals

| Number | Target | Quantitative indicators |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| G-1 | Six platform coverage | Web (Chrome/Firefox/Safari/Edge) + Windows 10+ + macOS 12+ + Linux (Ubuntu 22+/RHEL 9+) + Android 10+ + iOS 16+ |
| G-2 | Code sharing | Cross-platform sharing rate ≥ 70% |
| G-3 | Performance | Web FCP < 1.5s, LCP < 2.5s; Desktop startup < 3s; Mobile startup < 2s |
| G-4 | Real-time | WebSocket events → UI update < 200ms (P99) |
| G-5 | Offline | Mobile/Edge scenes support offline operation + resume synchronization |
| G-6 | Accessibility | WCAG 2.1 AA Compliant |
| G-7 | Security | Token secure storage; PII not cached; front-end security baseline full coverage |
| G-8 | Multi-tenant | Tenant-level brand customization + function switch + compliance mode |
| G-9 | Full coverage of roles | Independent Operator (L1) · Business Line Leader (L1) · Domain Administrator (L2) · Pack Developer (L2/L3) · Platform SRE (L3/L4) |
| G-10 | Consistent experience | The same user can see consistent data, operation portals, and approval flows on different platforms |

## 1.4 Design principles

### 1.4.1 Architecture principles

| Number | Principle | Description |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UP-1 | API-First | The UI layer is a consumer of the P1 Interface Plane Public API (§5.2/§5.3) and does not introduce bypasses. All operations map to standard REST/WebSocket endpoints (ADR-No-Code-UX-Maps-To-Standard-API) |
| UP-2 | Shared kernel, platform shell | Business logic, state management, and API communication are extracted into a cross-platform shared layer; the rendering layer is implemented independently according to the platform |
| UP-3 | Progressive enhancement | Core features are available on all platforms; advanced features (debugger time travel, Workflow canvas drag and drop) are enhanced on web/desktop |
| UP-4 | Offline-first design | In mobile and Edge scenarios, local cache + optimistic update + conflict resolution are the default modes |
| UP-5 | Real-time is the default | All variable data is pushed in real-time through WebSocket by default, polling is only used as fallback |
| UP-6 | No compromise on security | Token storage follows platform security best practices; PII is not cached locally |
| UP-7 | Pluggable rendering | Standardized component interfaces, replaceable rendering implementation (React DOM / React Native / Electron / Tauri WebView) |
| UP-8 | Contract-driven | UI information architecture, page fields, and drill-down depth strictly follow `ui_console_and_cockpit_contract.md` and do not invent the page structure by yourself |

### 1.4.2 Interaction Principle

| Number | Principle | Description |
| ---- | -------------- | ----------------------------------------------------------------------------------------------- |
| UX-1 | Conversation first | The NL dialog box is the main entrance to all platforms (§4.1 NL Conversation module), and users can switch to conversation mode at any time |
| UX-2 | Progressive information disclosure | Display L1 summary by default, expand L2-L5 details on demand (Contract §7 five-level drill-down) |
| UX-3 | Operations can be undone | All non-irreversible operations provide Undo buffering (can be undone within 5s), irreversible operations require a second confirmation |
| UX-4 | Status aware | Network status, synchronization status, and offline queue depth are always visible |
| UX-5 | Context persistence | Page switching/App switching back to the exact location and state when you left |
| UX-6 | Home page is health | Console home page first answers "whether the system is healthy, what it is currently doing, and where it is stuck" (Contract §4) |

## 1.5 Design Scope

| Within range | Outside range |
|----------------------------------------- | ----------------------------------- |
| Six-platform UI shell project | Back-end API development (existing) |
| Shared core layer (status/API/Auth/synchronization) | P1-P5 plane internal implementation changes |
| 5 core pages + extended function modules defined by the contract | Single business domain Prompt details |
| Design system (Token/component/theme) | Rendering (hand over to UX team) |
| Build/test/CI/CD pipeline | Infrastructure physical deployment (Kubernetes configuration) |
| Multilingual framework | Specific translation content |
| Backend API enhancement requirement list (marked [Planned]) | Specific implementation of backend API |

## 1.6 Role and view mapping

| Roles | Levels | Main Pages (by Contract Information Architecture) | Platform Preferences |
| ------------ | ----- | --------------------------------------------------------------------- | ------------ |
| Independent Operator | L1 | Dashboard · TaskCockpit · ApprovalCenter · Chat | Web / Mobile |
| Business Line Leader | L1 | Dashboard · TaskCockpit · ApprovalCenter · CostCenter | Web / Mobile |
| Domain Administrator | L2 | AgentManager · DomainWizard · Marketplace · Dashboard(L2) | Web / Desktop |
| Pack Developer | L2/L3 | WorkflowBuilder · WorkflowDebugger · AgentManager · Marketplace | Web / Desktop |
| Platform SRE | L3/L4 | StabilityPanel · AdminTakeoverConsole · Incidents · WorkerPanel · Debugger | Web / Desktop |

## 1.7 Status label convention

This document uses four-level status labels for all API endpoints, WebSocket events, Feature modules, PlatformAdapter capabilities, and DomainUIConfig fields to distinguish between "confirmed facts" and "design goals":

| Label | Meaning | Color Tips |
| --------------- | --------------------------------------------------------------- | -------- |
| **Implemented** | The backend has been implemented and tested, and the UI can be directly integrated | 🟢 Green |
| **Planned** | Has been included in the delivery roadmap (§7.4), backend/frontend is about to be implemented, and the interface contract has been stabilized | 🔵 Blue |
| **Proposed** | The architectural design has been completed but has not yet entered the development schedule, and the interface may change | 🟡 Huang |
| **Deferred** | Requirements identified but explicitly deferred to subsequent releases, without blocking current delivery | ⚪ Gray |

**Implemented secondary sub-tag** _(v2.3 new)_:

The `[Implemented]` entry maintains three maturity sub-tags to help the front-end team assess integration risks:

| Subtags | Meaning | Front-end integration guidance |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Implemented-Contracted** | Backend service + HTTP route + OpenAPI/JSON schema have been released and frozen, guaranteed by public contracts | Phase 1 can be directly integrated without additional alignment costs |
| **Implemented-Internal** | The backend service method exists and has been tested, but is only exposed through internal routes (such as `/console/*` HTML), without a public JSON contract | The backend team needs to additionally expose the JSON API or provide temporary mocks |
| **Implemented-Partial** | The backend service method exists and some fields/scenarios have been implemented, but the schema has not been frozen or lacks boundary scenario coverage | Integration can be started but defensive coding for schema changes is required |

**Sub tag inline format**: `[Implemented/Contracted]` `[Implemented/Internal]` `[Implemented/Partial]`

**Usage Rules**:

- The tables are marked with `[Implemented]` `[Planned]` `[Proposed]` `[Deferred]` inline
- This document's §4.1 Function Module Table, §5.2 API Endpoint Table, §5.3 WebSocket Event Table, §3.7 PlatformAdapter Interface Table, and Appendix A/B have all been marked with status
- During integrated development, only `[Implemented/Contracted]` entries can be directly connected unconditionally in Phase 1; `[Implemented/Internal]` and `[Implemented/Partial]` entries must confirm the exposure method and schema stability with the backend before integration; `[Planned]` entries must wait for the corresponding Gate to pass (§7.4)
- Status tags are updated by the Architecture Review Committee at each Phase Gate; sub-tags are updated by the backend API owner at each Sprint Review

**Status label update responsibility mechanism** _(new in v3.0)_:

The value of a status label depends on its timeliness. The following matrix defines who updates, what updates, when, and which Gate forces verification:

| Tag Category | Update Responsible Person | Update Content | Update Timing | Mandatory Verification Node |
| -------------------------------------------------- | ------------------ | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| Four-level status labels (Implemented/Planned/Proposed/Deferred) | Architecture Review Committee | Overall module/endpoint status upgrade or downgrade | Each Phase Gate | Gate 0/1/2/3 admission review |
| Implemented sub-tab (Contracted/Internal/Partial) | Backend API owner | API Layer level changes, schema frozen status | Each Sprint Review | Phase Gate + Sprint Demo |
| API Graduation Matrix (§5.2.4) | Backend API owner | `Current Layer` / `Status` column | Each Sprint Review | Gate corresponding to Target Milestone |
| Feature module status | Front-end Feature owner | UI side implementation progress, integration status | Each Sprint Review | Phase Gate + Sprint Demo |
| mini-contract (§4.7) dimension update | Projection Owner | DTO schema change, Query Keys adjustment | Immediate update when schema changes | Phase Gate |
| PlatformAdapter capability status | Platform adaptation layer owner | Each platform adapter implementation status | Each Sprint Review | Phase Gate |
| Appendix A/B Endpoint/Event Status | Backend API owner | Endpoint new/deprecated, event implementation status | Instantly updated when the backend is released | Phase Gate |

**Force refresh rules**:

- **Sprint Review**: The back-end API owner and the front-end Feature owner update their tags respectively; unupdated tags are marked as `[STALE]` in the Sprint Review meeting minutes
- **Phase Gate Admission**: 48 hours before Gate review, all tags involved in the Gate must be refreshed; `[STALE]` tag blocks the Gate from passing
- **Emergency Change**: Within 24 hours after the backend breaking change is released, the API owner must update all affected tags and notify the frontend Feature owner
- **Quarterly audit**: At the end of each quarter, the architecture review committee conducts a full verification of all document tags and removes expired tags

## 1.8 Contract version negotiation

As a consumer of the P1 Interface Plane, the UI layer must maintain version compatibility with the backend in multiple contract dimensions:

| Contract dimensions | Current version | UI support scope | Mismatch processing strategy |
| -------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------- |
| REST API version | v1 | v1 | Request header `Accept-Version: v1`; if the backend returns `406`, display the upgrade prompt and disable write operations |
| WebSocket Schema version | v1 | v1 | Send `schema_version: 1` during handshake; if negotiation fails, downgrade to REST polling |
| DomainDescriptor version | Defined by the domain | ≥ the currently lowest known version | Pull the descriptor at startup, if `version < minSupported`, mark the domain as "downgraded mode" |
| UI Contract version | 1.0 | 1.0 | Verify `/api/v1/meta/contract-version` when the front end starts; display a banner warning if it does not match |
| DomainUIConfig Schema | 1.0 | 1.0 | Unknown fields are ignored (forward compatibility); missing required fields use default values and report telemetry |

**Downgraded Behavior**:

- **API version mismatch**: read-only mode + top banner "The current client version is incompatible with the server, please upgrade"
- **WS negotiation failed**: automatically downgraded to 30s REST polling, status bar displays "Real-time update not available"
- **Contract version mismatch**: The function is normal but a persistent banner is displayed, and telemetry reports `contract_version_mismatch`
- **DomainDescriptor is out of date**: The domain page displays a "Domain configuration version is too low" warning and hides UI controls that rely on new fields.

---

# 2. Six platform technology selection

> **Improvement points V-1~V-4**: Unify Doc-10/Doc-11 version differences; the latest stable version shall prevail.

## 2.1 Technology stack overview (authoritative version)

| Platform | Shell technology | Rendering engine | Native bridging | Installation package format | Estimated package size |
| ----------- | ------------------ | ----------------------- | ------------------ | ------------------------------- | ---------- |
| **Web** | React 19 + Vite 6 | React DOM | PWA Service Worker | CDN/Docker nginx | ~2MB gzip |
| **Windows** | Electron 34 | Chromium (React DOM) | Node.js + Win32 | MSIX/EXE (NSIS) | ~120MB |
| **macOS** | Tauri 2.x | WebKit (React DOM) | Rust + AppKit | DMG / Mac App Store | ~15MB |
| **Linux** | Tauri 2.x | WebKitGTK (React DOM) | Rust + GTK4 | AppImage / DEB / RPM / Flatpak | ~15MB |
| **Android** | React Native 0.79 | Hermes + Fabric | Kotlin/Java bridge | AAB (Play) / APK | ~28MB |
| **iOS** | React Native 0.79 | JSI + Fabric | Swift/ObjC bridge | IPA (App Store / TestFlight) | ~35MB |

## 2.2 Selection decision matrix (ADR-UI-001)

| Decision Point | Option A | Option B | Option C | Decision | Justification |
| ----------------------- | ------------------ | ---------------- | ------------- | --------------- | ------------------------------------------------------------------------------- |
| UI framework | React 19 | Vue 3 | Svelte 5 | **React 19** | Unified with the RN ecosystem; the community/component library is the most mature; the team has experience |
| Mobile | React Native 0.79 | Flutter | Capacitor | **RN 0.79** | Share hooks/state with the React ecosystem; New Arch performance is close to native; 0.79 enabled by default New Arch |
| Windows Desktop | Electron 34 | Tauri 2 | .NET MAUI | **Electron 34** | Windows has the largest user base, the Electron ecosystem is the most mature, and plug-ins/debugging tools are complete |
| macOS/Linux desktop | Tauri 2 | Electron 34 | — | **Tauri 2** | Small package size (15MB vs 120MB); Rust backend has high security; macOS/Linux market share is low, Tauri is enough |
| State Management | Zustand 5 | Redux Toolkit | Jotai | **Zustand 5** | <1KB; TS friendly; middleware ecology (persist/immer); RN compatible |
| Server status | TanStack Query v5 | SWR 2 | Apollo Client | **TQ v5** | Automatic caching/deduplication/background refresh/optimistic update; offline support; complementary to WebSocket real-time push |
| Chart library | ECharts | Recharts | Victory | **ECharts** | Excellent performance on large data volumes; rich chart types; RN embedded through WebView |
| Canvas (Workflow builder) | React Flow | xyflow | Self-developed | **React Flow** | Mature node canvas; TypeScript native; active community |
| Package management | npm workspaces | Yarn 4 workspace | pnpm workspace | **npm workspaces** | Consistent with `package.json` in the current repository; zero additional orchestration layer |
| Build orchestration | npm scripts | Nx | Turborepo | **npm scripts** | The minimum available build link in the current warehouse is composed of workspace + app-level scripts |

## 2.3 Framework version constraints (authoritative version locking)

| Framework | Locked version | Upgrade strategy |
| -------------- | -------- | ---------------------------- |
| React | 19.x | Major locked, minor upgraded with release |
| React Native | 0.79.x | minor locked, patch upgraded with release |
| Electron | 34.x | major locked, minor with security updates |
| Tauri | 2.x | major lock |
| TypeScript | 5.8+ | Aligned with backend tsconfig |
| Node.js | 22 LTS | Build/CI usage, consistent with backend |
| Vite | 6.x | major lock |
| Zustand | 5.x | major lock |
| TanStack Query | 5.x | major lock |
| React Flow | 11.x | Current warehouse baseline; upgrading to 12.x requires single-column migration |
| ECharts | 5.x | major lock |

## 2.4 Cross-platform code reuse matrix

| Code layer | Web | Win(Electron) | Mac(Tauri) | Linux(Tauri) | Android(RN) | iOS(RN) |
| -------------------------- | --- | ------------- | ---------- | ------------ | ----------- | ----------- |
| L3 shared core (state/api/auth) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| L2 React Hooks (useTask etc.) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| L2 React DOM Components | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| L2 React Native Components | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| L1 Platform Shell | Web | Electron | Tauri | Tauri | RN Entry | RN Entry |
| L4 platform adaptation | Web | Electron | Tauri | Tauri | RN Module | RN Module |

**Comprehensive sharing rate estimate**: ~72%

## 2.5 Six-platform adaptation strategy

### 2.5.1 Web platform

```text
React 19 SPA + Vite 6
    │
    ├── PWA Service Worker
    │ ├── Static resource caching (Cache-First)
    │ ├── API response caching (Network-First + Stale-While-Revalidate)
    │ └── Offline fallback page
    │
    ├── Responsive layout
    │ ├── ≥1440px: full three columns (navigation + content + side panel)
    │ ├── 1024-1439px: two columns (navigation collapse + content)
    │ ├── 768-1023px: single column + hamburger menu
    │ └── <768px: mobile view (native app recommended)
    │
    └── Performance indicators
        ├── FCP < 1.5s (CDN + Code Splitting)
        ├── LCP < 2.5s (critical path preloading)
        ├── CLS < 0.1 (skeleton screen + fixed layout)
        └── INP < 200ms (React concurrent features)
```

### 2.5.2 Windows (Electron 34)

| Features | Implementation |
| -------- | ------------------------------------------------------------------------------- |
| Window management | Multi-window support (main window + debugger window + dialog floating window) |
| System integration | System tray resident, Jump List (recent tasks/quick approval), Windows Timeline integration |
| Notification | Windows Notification Center (Approval/Alarm/Task Completion) |
| Shortcut keys | Ctrl+K (Command Panel), Ctrl+N (New Task), Ctrl+Shift+D (Debugger) |
| Automatic update | electron-updater incremental update (difference package ~5MB) |
| Performance | Startup time < 3s (preloading + persistent cache); Memory < 300MB (idle) |
| Installation Package | MSIX (Enterprise Group Policy Distribution) + EXE (Personal Installation) |

### 2.5.3 macOS (Tauri 2)

| Features | Implementation |
| --------- | --------------------------------------------------------------- |
| Native feel | Follow HIG: Traffic Light window buttons, native menu bar, Spotlight integration |
| Window management | Native full screen + Split View support; Stage Manager compatible |
| Menu Bar | Permanent Menu Bar icon (unread approval count Badge) |
| Touch Bar | Context-aware shortcut operations (approval buttons, task status switching) |
| Notification | macOS Notification Center + Critical Alert |
| Security | App Sandbox + Hardened Runtime; Keychain storage Token |
| Distribution | DMG (Direct Download) + Mac App Store (Enterprise MDM Distribution) |
| Installation package | ~15MB (Tauri, no Chromium bundle) |

### 2.5.4 Linux (Tauri 2)

| Features | Implementation |
| -------- | -------------------------------------------------------- |
| Desktop environment | Supports GNOME 45+ (GTK4) and KDE Plasma 6+ (via XDG standard) |
| Window management | Wayland priority, X11 fallback; support tiling WM (i3/Sway) |
| System Tray | StatusNotifierItem (SNI) protocol; fallback to XEmbed |
| Notifications | D-Bus org.freedesktop.Notifications; support dunst/mako |
| File management | xdg-open opens the export file; follows the XDG Base Directory specification |
| Theme | Automatically detect system Dark/Light mode (GTK/KDE theme follows) |
| Distribution | AppImage (Universal) / Flatpak (Sandbox) / DEB + RPM (System Package Management) |
| Installation package | ~15MB (Tauri) |

### 2.5.5 Android (React Native 0.79)
| Features | Implementation |
| -------- | --------------------------------------------------------------- |
| Minimum version | Android 10 (API 29), targeting API 35 |
| Architecture | React Native 0.79 + New Architecture (Fabric + TurboModules) |
| Navigation | Bottom tab bar (Home/Task/Approval/Kanban/More) + Stack Navigation |
| Notifications | FCM push; front-end notification channel grading (approval = high, task completion = default, marketing = low) |
| Offline | SQLite (Room) local cache + WorkManager background synchronization |
| Biometrics | BiometricPrompt API (Fingerprint/Face Unlock Application) |
| Gestures | Pull down to refresh, left swipe to delete/operate, long press context menu |
| Performance | Startup < 2s (Hermes precompilation + App Startup Library) |
| Widget | Android Widget (pending approval count + recent task status) |
| Package size | < 30MB (AAB split by architecture) |

### 2.5.6 iOS (React Native 0.79)

| Features | Implementation |
| --------- | ------------------------------------------------------------------------------- |
| Minimum version | iOS 16+, target iOS 18 |
| Architecture | React Native 0.79 + New Architecture (JSI + Fabric) |
| Navigation | UITabBarController style bottom bar + UINavigationController style stack |
| Notification | APNs push; Notification Service Extension (rich notification: approval preview + quick operation) |
| Offline | Core Data / SQLite (GRDB) + BackgroundTasks framework |
| Biometrics | LocalAuthentication framework (Face ID/Touch ID) |
| Widget | WidgetKit (Today Widget + Lock Screen Widget: pending approval, task status) |
| Shortcuts | Siri Shortcuts integration ("Hey Siri, check my approvals for today") |
| Gestures | iOS standard gestures (edge return, 3D Touch peek); Haptic Feedback |
| Performance | Startup < 1.5s (JSI direct tuning + MetroBundle preheating) |
| Privacy | App Tracking Transparency; Privacy Manifest declaration data type |
| Package size | < 40MB |

### 2.5.7 Platform Feature Matrix

| Features | Web | Windows | macOS | Linux | Android | iOS |
| -------- | ---------------------- | --------------------------- | ------------------------- | ----------------- | ------------------ | ------------------ |
| Notifications | Web Notification API | Windows Notification Center | macOS Notification Center | libnotify/D-Bus | FCM Push | APNs Push |
| Biometrics | WebAuthn | Windows Hello | Touch ID / Face ID | — | Fingerprint / Face | Face ID / Touch ID |
| Secure Storage | — | Credential Manager | Keychain | libsecret/kwallet | Android Keystore | iOS Keychain |
| File Access | File System Access API | Win32 File API | NSFileManager | GIO/POSIX | SAF/MediaStore | UIDocumentPicker |
| Deep Links | URL routing | Protocol handler | Universal Links | xdg-open | App Links | Universal Links |
| Shortcut keys | Standard Web | Ctrl+ series | Cmd+ series | Ctrl+ series | — | — |
| System Tray | — | System Tray | Menu Bar | System Tray | — | — |
| Automatic updates | Service Worker | electron-updater | Sparkle (Tauri) | AppImage delta | Google Play | App Store |
| Offline storage | IndexedDB | SQLite (better-sqlite3) | SQLite (rusqlite) | SQLite (rusqlite) | SQLite (Room) | SQLite (GRDB) |
| Clipboard | Clipboard API | Win32 Clipboard | NSPasteboard | GTK Clipboard | ClipboardManager | UIPasteboard |

## 2.6 Desktop Hybrid Shell Governance Rules (ADR-UI-009)

### 2.6.1 Why not unify the desktop shell?

Windows adopts Electron 34, macOS/Linux adopts Tauri 2.x - the decision of dual-stack parallelization is based on the following benefit-cost analysis:

| Dimensions | Unified Electron | Unified Tauri | Dual Stack (currently selected) |
| -------------------------- | -------------------------- | ----------------------------- | ------------- |
| Windows experience | ✅ The most mature ecosystem | ⚠️ WebView2 relies on Edge Runtime | ✅ Electron is the best |
| macOS package size | ❌ ~120MB | ✅ ~15MB | ✅ Tauri 15MB |
| Linux compatibility | ⚠️ Chromium sandbox limited | ✅ WebKitGTK native | ✅ Tauri native |
| Safe surface | ❌ Node.js full permissions | ✅ Rust minimum permissions | ✅ Optimal for each platform |
| Maintenance cost | ✅ Single stack | ✅ Single stack | ⚠️ Two sets of native bridges |
| Plug-in ecology | ✅ npm has a rich ecology | ⚠️ Tauri plug-ins are still growing | ✅ Each can draw on their own strengths |

**Conclusion**: The additional maintenance cost of dual stack (~15% of desktop-specific code) is offset by a better platform experience and security.

### 2.6.2 PlatformAdapter Boundary Rules

| Capability Category | Must pass PlatformAdapter | Forked implementation allowed | Description |
| ------------------ | ---------------------------------- | ---------- | --------------------------------------------------------------- |
| Window management | ✅ | ❌ | `windowing` interface unified abstraction (§3.7.1) |
| File system access | ✅ | ❌ | Direct calls to Node.js fs / Rust fs through the `fileAccess` interface are prohibited |
| Secure Storage | ✅ | ❌ | Token/key storage must use the `secureStorage` interface |
| Clipboard | ✅ | ❌ | Defined in v2.1 |
| Deep Links | ✅ | ❌ | Defined in v2.1 |
| Notifications | ✅ | ❌ | Cross-platform notification interface |
| System Tray/Menu Bar | ❌ | ✅ | Electron Tray vs Tauri SystemTray API is too different, each can be implemented |
| Automatic update | ❌ | ✅ | electron-updater vs Tauri updater have different mechanisms |
| Native menu | ❌ | ✅ | Platform menu specifications are very different (Windows Menu Bar vs macOS App Menu) |

### 2.6.3 Desktop test matrix splitting

| Testing Levels | Electron (Windows) | Tauri (macOS/Linux) | Sharing |
| -------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| Unit testing | Vitest + jsdom | Vitest + jsdom | 100% shared (shared/layer) |
| Integration testing | Playwright + Electron launch | Playwright + Tauri WebDriver | Test case sharing, driver layer forking |
| E2E testing | Spectron / Playwright Electron | tauri-driver + WebDriver | Page-level scenario script sharing |
| Platform specific testing | Win32 API mock · MSIX install/uninstall | AppKit/GTK mock · DMG/AppImage verification | Do not share |
| CI matrix | windows-latest runner | macos-latest + ubuntu-latest runner | shared lint/typecheck/unit stage |

---

# Part II — Engineering Base

---

# 3. Monorepo project structure and layered architecture

> **Improvement point R-2**: Merge the directory structure of Doc-10 §10.5 and Doc-11 §5.1 into a single authoritative version.

## 3.1 Four-layer hierarchical model

```text
┌──────────────────────────────────────────────────────────────────┐
│ Layer 1 — Platform Shell │
│ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐│
│ │ Web SPA │ │ Electron │ │ Tauri │ │ Tauri │ │ RN │ │ RN ││
│ │ (Vite 6) │ │ 34 (Win) │ │ 2(Mac) │ │2(Linux)│ │(Droid)│ │(iOS)││
│ └────┬─────┘ └────┬────┘ └───┬────┘ └───┬────┘ └──┬────┘ └──┬──┘│
├───────┴────────────┴───────────┴──────────┴─────────┴─────────┴─────┤
│ Layer 2 — Feature Modules │
│ According to the four navigation groups of contract information architecture (§3): │
│ ┌────────────────┐┌────────────────┐┌─────────────────────────┐│
│ │ Mission Control ││ Operations ││ Governance ││
│ │ ─ dashboard ││ ─ dispatch ││ ─ policy ││
│ │ ─ task-cockpit ││ ─ inspect ││ ─ audit ││
│ │ ─ wf-cockpit ││ ─ health ││ ─ compliance ││
│ │ ─ approval ││ ─ incidents ││ ─ runtime-decisions* ││
│ │ ─ stability ││ ││ ││
│ │ ─ alerts ││ ││ ││
│ ├─────────────────┤├─────────────────┤├──────────────────────────┤│
│ │ Admin ││ Extended ││ Shared Features ││
│ │ ─ takeover ││ ─ conversation ││ ─ explainability ││
│ │ ─ workers ││ ─ wf-builder ││ ─ cost-center ││
│ │ ─ queues ││ ─ wf-debugger ││ ─ marketplace ││
│ │ ─ feature-flags ││ ─ agent-manager ││ ─ domain-wizard ││
│ │ ─ capability ││ ─ hitl ││ ─ settings ││
│ │ ││ ││ ─ analytics ││
│ └─────────────────┘└─────────────────┘└─────────────────────────┘│
├────────────────────────────────────────────────────────────────┤
│ Layer 3 — Shared Core — 100% cross-platform │
│ ┌───────────┐┌──────────┐┌───────┐┌───────┐┌───────┐┌────────┐│
│ │api-client ││ state ││ auth ││ sync ││ i18n ││telemetry││
│ ├───────────┤├──────────┤├───────┤├────────┤├───────┤├─────────┤│
│ │ domain ││permission││nl-client││ws-mgr ││ types ││error-hdl││
│ └───────────┘└──────────┘└───────┘└───────┘└───────┘└─────────┘│
├────────────────────────────────────────────────────────────────┤
│ Layer 4 — Platform Adapters — 0% Sharing │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐│
│ │ Web API │ │ Node.js │ │ Rust │ │ Android │ │ iOS ││
│ │ (fetch) │ │(Electron)│ │ (Tauri) │ │ (Bridge) │ │ (Bridge) ││
│ └──────────┘ └──────────┘ └──────────┘ └───────────┘ └────────────┘│
└────────────────────────────────────────────────────────────────┘
          │ │ │ │
          ▼ ▼ ▼ ▼
┌────────────────────────────────────────────────────────────────┐
│ Platform Backend (P1 Interface Plane, §6 API) │
└────────────────────────────────────────────────────────────────┘
```

> \* `runtime-decisions` is marked as `[Deferred]` and will be determined as an independent functional module after v2.5 review.

## 3.2 Responsibilities and constraints of each layer

| Hierarchy | Responsibilities | Sharing rate | Technical constraints |
| ------------- | -------------------------------------------------- | ------ | -------------------------------------------------- |
| L1 platform shell | Platform entrance, window management, system integration, native notification | 0% | Independent implementation for each platform |
| L2 functional module layer | Page components, routing, business interaction logic | ~60% | Web/desktop sharing React DOM; RN independent component |
| L3 shared core layer | State, API, Auth, synchronization, domain logic, types, telemetry | 100% | Pure TypeScript, zero platform dependencies |
| L4 platform adaptation layer | Platform encapsulation of network, storage, notification, biometrics, and file system | 0% | Unified interface, platform independent implementation |

## 3.3 Dependency rules

```text
L1 → L2 → L3 ← L4
              ↑
         L4 implements the interface defined by L3
```

- L3 cannot depend on L1/L2 (pure logical layer)
- L2 can rely on L3, but cannot directly rely on L4 (indirectly using L4 capabilities through the L3 interface)
- L1 can depend on L2/L3/L4
- L4 cannot rely on L1/L2/L3 (only implements the `PlatformAdapter` interface defined by L3)
- Functional modules share core communication through L3 and do not directly import each other.

## 3.4 Directory Panorama (authoritative version)

```text
ui/ # UI Monorepo subproject (npm workspaces)
├── package.json # Root workspace and script entry
├── package-lock.json # Lock dependency version
├── tsconfig.json # Shared TypeScript baseline
├── eslint.config.js # ESLint 9 configuration
├── vitest.config.ts # Vitest test configuration
├── .storybook/ # Storybook configuration
├── .env.example # UI environment variable template
├── apps/ # L1 platform shell entrance
│ ├── web/ # React 19 + Vite 6 SPA
│ ├── electron-win/ # Electron Windows smoke shell
│ ├── tauri-macos/ # Tauri macOS smoke shell
│ ├── tauri-linux/ # Tauri Linux smoke shell
│ └── mobile/ # React Native smoke shell
├── packages/
│ ├── shared/ # L3 shared core layer
│ │ ├── api-client/ # RESTClient / WSClient / endpoint catalog
│ │ ├── auth/ # auth-service / token-manager / session-guard
│ │ ├── state/ # stores + query factories
│ │ ├── sync/ # offline queue / conflict resolver / coordinator
│ │ ├── i18n/ # TranslationService + ICU MessageFormat
│ │ ├── domain/ # route guard / redaction / DomainUIConfig
│ │ ├── nl-client/ # ConversationClient baseline
│ │ ├── telemetry/ # TelemetrySink + OTLP exporter
│ │ ├── platform/ # PlatformAdapter factory and default implementation
│ │ └── types/ # DTO and shared types
│ ├── ui-core/ # Web/desktop sharing UI component
│ ├── ui-mobile/ # React Native shared UI components
│ └── features/ # Function module
│ ├── dashboard/ ... analytics/
│ └── governance-compliance/ # Internal extension module (not registered to the public route catalog)
├── tests/ # Vitest document/shared layer/application shell test
└── docs/
    ├── storybook/
    └── adr/
```

## 3.5 Package management and build configuration

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

| Tools | Purpose |
|------------------------|-----------------------------------------|
| npm workspace | Monorepo package management |
| Vite 6 | Web build (dev server + production build) |
| Metro | React Native build |
| electron-builder | Windows packaging (MSIX/EXE) |
| tauri-cli | macOS/Linux packaging |
| TypeScript 5.8+ (strict) | Type checking, aligned with backend tsconfig |
| Vitest | Unit testing (shared layer + components) |
| Storybook | Component Isolation Development and Visual Baseline |
| Playwright / Detox | Target E2E toolchain (currently still Planned) |

### Common commands

| Command | Description |
| ------------------------------------ | ------------------------ |
| `npm install` | Install all dependencies |
| `npm run typecheck` | Full type checking |
| `npm test` | Full Vitest test |
| `npm run test:e2e` | Smoke E2E baseline in the warehouse |
| `npm run build` | Typecheck first and then build Web |
| `npm run dev:web` | Start the web development server |

## 3.6 Package dependency graph

```text
apps/web ──────────┐
apps/electron-win─┤
apps/tauri-macos ──┤──→ features/* ──→ ui-core ──→ shared/*
apps/tauri-linux ──┤ │
apps/mobile ───────┘──→ features/* ──→ ui-mobile ──→ shared/*
                                            │
                                            └──→ shared/*
tools/codegen ──→ (reads backend src/platform/contracts/)
tools/mock-server ──→ shared/types
tools/e2e ──→ (runtime dependency, no build dependency)
```

## 3.7 Sharing core layer key interfaces

### 3.7.1 PlatformAdapter interface (L3 definition, L4 implementation)

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

The current warehouse also provides `createPlatformAdapterCapabilityView(adapter)`, which projects the above flat method into nested capability views such as `secureStorage / offlineStore / clipboard / deeplink / lifecycle / haptics / windowing / shell / process / analyticsConsent / screenSecurity` to facilitate consumption by capability group in the UI layer.

**PlatformAdapter capability status overview (according to current code caliber)**:

| Capability group | Number of methods | Status | Platform applicable | Description |
| ------------- | ------ | ------------- | -------------------------- | ----------------------- |
| `platform` | 1 | [Implemented] | All platforms | Platform ID |
| `fetch` | 1 | [Implemented] | Full platform | Network request abstraction |
| secureStorage | 3 | [Implemented] | All platforms | `read/write/deleteSecureValue` |
| offlineStore | 2 | [Implemented] | All platforms | `readFile/writeFile` |
| clipboard | 1 | [Implemented] | All platforms | `copyToClipboard` |
| deeplink | 1 | [Implemented] | All platforms | `openDeepLink` |
| lifecycle | 2 | [Implemented] | All platforms | foreground/background monitoring |
| haptics | 1 | [Implemented] | All platforms | `vibrate`, non-mobile version no-op |
| windowing | 1 | [Implemented] | Desktop priority | `openWindow` smoke baseline |
| shell | 1 | [Implemented] | Desktop preferred | `runShell` smoke baseline |
| process | 1 | [Implemented] | All platforms | `spawnProcess` |
| analyticsConsent | 2 | [Implemented] | All platforms | `get/setAnalyticsConsent` |
| screenSecurity | 1 | [Implemented] | Desktop + Mobile | `enableScreenSecurity` |

Capabilities such as notification, biometrics, and file selection that are not included in the current shared contract are managed as platform shell-specific capabilities and are not defined in the unified `PlatformAdapter` of `@aa/shared-types`.

### 3.7.2 WebSocket Manager interface

```typescript
interface WSManager {
  connect(url: string, token: string): void;
disconnect(): void;
  subscribe(channel: string, handler: (event: WSEvent) => void): () => void;
  getState(): "connecting" | "connected" | "disconnected" | "reconnecting";
  onStateChange(cb: (state: WSState) => void): () => void;
}
```

### 3.7.3 Implementation strategies for each platform

| Capability Group | Web | Electron (Win) | Tauri (Mac/Linux) | RN (Android) | RN (iOS) |
| --------------- | ---------------------------- | ---------------------------- | ---------------------------- | ------------------- | ------------------- |
| `fetch` | `window.fetch` | `globalThis.fetch` bridge | `globalThis.fetch` bridge | RN `fetch` | RN `fetch` |
| secureStorage | in-memory / cookie seam | default adapter test double | default adapter test double | default adapter test double | default adapter test double |
| offlineStore | in-memory file map | in-memory file map | in-memory file map | in-memory file map | in-memory file map |
| clipboard | browser API seam | shell bridge seam | Tauri bridge seam | RN bridge seam | RN bridge seam |
| lifecycle | foreground/background events | shell life cycle events | shell life cycle events | AppState seam | AppState seam |
| deeplink | router / URL scheme seam | protocol handler seam | universal link seam | app links seam | universal link seam |
| windowing | new tab / modal seam | BrowserWindow seam | Tauri window seam | Not applicable | Not applicable |
| shell/process | no-op/mock | shell + child process seam | shell + process seam | not applicable | not applicable |

### 3.7.4 Adapter injection mechanism

When the application starts, the L1 shell creates a platform adapter instance and injects it into the L3 shared core layer:

```text
L1 App starts
  │
  ├─ Create a PlatformAdapter instance (platform-specific implementation)
  │
  ├─ Initialize L3 shared core layer
  │ ├─ RESTClient(adapter.fetch)
  │ ├─ AuthService(adapter or adapter.capabilities.secureStorage)
  │ ├─ SyncEngine(adapter.capabilities.offlineStore, adapter.capabilities.lifecycle)
  │ └─ Platform services(adapter.capabilities.*)
  │
  └─Rendering L2 function module UI
```

The React layer is injected through the Context Provider:

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

# Part III — Function module

---

# 4. Align the functional module blueprint with the UI contract

> **Improvement points A-1, A-4, A-5, D-3**: Explicitly map UI function modules → contract page → back-end service method; organize navigation according to the contract information architecture (§3); define a five-level drill-down component tree.

## 4.1 Information Architecture and Navigation Mapping

According to the four groups of navigation defined in `ui_console_and_cockpit_contract.md` §3, each front-end function module explicitly corresponds to the back-end data source:

| Navigation Group | Functional Modules | Contract Page | Backend Data Source | Status | Platform Availability |
| --------------- | ------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------ | ------------- |
| Mission Control | `dashboard` | Dashboard (§4 Home) | `MissionControlService.getSnapshot()` | [Implemented/Internal] | All platforms |
| Mission Control | `task-cockpit` | TaskCockpit (§5.1) | `MissionControlService.getTaskCockpit()` + task-routes | [Implemented/Contracted] | All platforms |
| Mission Control | `workflow-cockpit` | WorkflowCockpit (§5.2) | `MissionControlService.getWorkflowCockpit()` | [Implemented/Internal] | Web/Desktop |
| Mission Control | `approval` | ApprovalCenter (§5.3) | `MissionControlService.listApprovalQueue()` + approval-routes | [Implemented/Contracted] | All platforms |
| Mission Control | `stability` | StabilityPanel (§5.4) | `MissionControlService.getStabilityPanel()` | [Implemented/Internal] | Web/Desktop |
| Mission Control | `alerts` | Alerts | `OperatorConsoleBackendService.getIncidentTimeline()` | [Implemented/Internal] | All platforms |
| Operations | `dispatch` | Dispatch | dispatch-routes / dispatch CLI | [Implemented/Contracted] | Web/Desktop |
| Operations | `inspect` | Inspect | `OperatorConsoleBackendService.getSnapshot()` + inspect CLI | [Implemented/Internal] | Web/Desktop |
| Operations | `health` | Health | dashboard-routes health endpoint | [Implemented/Contracted] | Web/Desktop |
| Operations | `incidents` | Incidents | `OperatorConsoleBackendService.getIncidentTimeline()` | [Implemented/Internal] | Web/Desktop |
| Governance | `policy` | Policy | admin-routes policy endpoint | [Implemented/Contracted] | Web/Desktop |
| Governance | `audit` | Audit | admin-routes audit endpoint | [Implemented/Contracted] | Web/Desktop |
| Governance | `compliance` | Compliance | [Planned] `/api/v1/compliance` | [Planned] | Web/Desktop |
| Admin | `takeover` | AdminTakeoverConsole(§5.5) | `MissionControlService.getAdminTakeoverConsole()` | [Implemented/Internal] | Web/Desktop |
| Admin | `workers` | Workers | `OperatorConsoleBackendService.getWorkerPanel()` | [Implemented/Internal] | Web/Desktop |
| Admin | `queues` | Queues | `OperatorConsoleBackendService` queue API | [Implemented/Internal] | Web/Desktop |
| Extended | `conversation` | NL conversation | NLEntryService + IntentParser + ConversationHistoryService | [Implemented/Partial] | Full platform |
| Extended | `workflow-builder` | — | WorkflowBuilderService (interaction/ux/) | [Planned] | Web/Desktop |
| Extended | `workflow-debugger` | — | DebuggerService + inspect CLI | [Planned] | Web/Desktop |
| Extended | `agent-manager` | Agent Monitoring Center (§4.2.7) | `AgentRegistryService` → `/api/v1/agents` [Planned] | [Planned] | Full platform |
| Extended | `hitl` | — | HITL notification module + approval-routes | [Implemented/Partial] | Full platform |
| Shared | `explainability` | — | [Planned] `/api/v1/explanations` | [Planned] | Web/Desktop |
| Shared | `cost-center` | — | [Planned] `/api/v1/costs` | [Planned] | Web/Desktop |
| Shared | `marketplace` | — | [Planned] `/api/v1/marketplace` | [Planned] | Web/Desktop/Mobile |
| Shared | `domain-wizard` | — | DomainOnboardingService (interaction/ux/onboarding/) | [Implemented/Internal] | Web/Desktop |
| Shared | `settings` | Configuration Management Center (§4.2.9) | admin-routes + user preference API + DomainUIConfig | [Implemented/Partial] | Full platform |
| Shared | `analytics` | Data statistics platform (§4.2.8) | `GET /api/v1/dashboard/metrics` + MissionControlService | [Planned] | Full platform |

## 4.2 Contract Core Page Blueprint

### 4.2.1 Dashboard (Homepage)

> Contract §4: The homepage first answers "whether the system is healthy, what it is currently doing, and where it is stuck."

**Data source**: `MissionControlService.getSnapshot()` → `shared_snapshot` (Contract §6.1)

```text
┌─────────────────────────────────────────────────────────┐
│ System Status Bar │
│ [overall_health] [queue_depth] [active_executions] │
│ [approval_backlog] [alert_summary] │
├──────────────────────────────────────────────────────────┤
│ Current Focus (first screen) │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ │ Active Tasks │ │ Active Workflows │ │ Approval Queue│ │
│ │ (card list) │ │ (card list) │ │ (card list) │ │
│ └────────┬────────┘ └────────┬─────────┘ └───────┬────────┘ │
│ │ → TaskCockpit │ → WfCockpit │ → Approval│
├──────────────────────────────────────────────────────────┤
│ Attention Required (second screen) │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ │ Blocked Reasons │ │ Stale/Recovery │ │ High-Risk │ │
│ │ │ │ Summary │ │ Decisions │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ NL Conversation Dock (resident bottom/side, UX-1 conversation priority) │
└─────────────────────────────────────────────────────────┘
```

### 4.2.2 TaskCockpit (five levels of drill-down)

> Contract §5.1 + §7: Five levels of drill-down (L1-L5).

**Data source**: `MissionControlService.getTaskCockpit()` + `task-routes`

| Drill-down levels | Display content | UI components | Data endpoints |
| -------- | ---------------------------------- | ----------------------- | ---------------------------------- |
| L1 | task list + status | `<TaskListView>` | `GET /api/v1/tasks` |
| L2 | task details + workflow state | `<TaskDetailPanel>` | `GET /api/v1/tasks/{id}` |
| L3 | step outputs + tool calls | `<StepOutputViewer>` | task detail nested data |
| L4 | approval / decision / evidence chain | `<EvidenceChainViewer>` | `GET /api/v1/tasks/{id}/evidence` |
| L5 | trace / replay / recovery timeline | `<TimelineViewer>` | `GET /api/v1/tasks/{id}/timeline` |

**Contract constraints implemented**:

- `completed` status: L2 panel displays "View Evidence" button, leading directly to L4
- `blocked` status: L2 panel is forced to display `blocked_reason` + `source`, and only "waiting" is not allowed to be displayed
- `failed` status: L2 panel displays `error_code` + `last_step` + "Recovery History" entrance, directly to L5

**MINIMUM FIELD** (Contract §5.1):

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

**Minimal actions**: Open inspect · View timeline · View artifacts · Cancel task · Enter manual takeover

### 4.2.3 WorkflowCockpit (five-level drill-down)

**Data source**: `MissionControlService.getWorkflowCockpit()`

| Drill down level | Display content | UI components |
| -------- | -------------------------------- | --------------------------------------------- |
| L1 | workflow list + status | `<WorkflowListView>` |
| L2 | workflow details + step DAG | `<WorkflowDetailPanel>` + `<DAGViewer>` |
| L3 | step outputs + tool calls | `<StepOutputViewer>` |
| L4 | approval nodes + evidence refs | `<EvidenceChainViewer>` |
| L5 | compensation / replay / recovery | `<RecoveryTimeline>` |

**MINIMUM FIELD** (Contract §5.2):

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

**Data source**: `MissionControlService.listApprovalQueue()` + approval-routes

**MINIMUM FIELD** (Contract §5.3):

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

**Minimum action**: approve · reject · request_more_context · open_explanation

**UI Constraints**:
- High risk approval (risk_level = "high" | "critical") must show the risk level, policy source, approval chain and takeover entry (Contract §2.4)
- The mobile terminal supports push notifications + quick operations (approve/reject does not enter the App)

### 4.2.5 StabilityPanel

**Data source**: `MissionControlService.getStabilityPanel()`

**MINIMUM FIELD** (Contract §5.4):

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

**Minimal action**: drill into stuck task · inspect backlog · open recovery evidence · trigger incident workflow

### 4.2.6 AdminTakeoverConsole

**Data source**: `MissionControlService.getAdminTakeoverConsole()`

**MINIMUM FIELD** (Contract §5.5):

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

**Minimum action**: retry_step · skip_step · override_step_output · switch_worker · manual_cancel · mark_unrecoverable

### 4.2.7 Agent real-time monitoring center _(new in v3.0)_

> Monitor the health status, heartbeat, capabilities, and load of all Agents in real time, and provide management operations.

**Data source**: `AgentRegistryService` (authoritative) → `GET /api/v1/agents` [Planned Layer C] + `agent.health_changed` WS event

```text
┌──────────────────────────────────────────────────────────────────┐
│Agent Monitoring Center [⟳ 10s] │
├──────────┬──────────────────────────────────────────────────────────────
│ Filter bar │ [Domain▼] [Status▼] [Health▼] [Ability▼] [Search...] │
├───────────┴─────────────────────────────────────────────────────────┤
│ Overview Card │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│ │ Total 47 │ │🟢Normal 38 │ │🟡Downgrade 5 │ │🔴Offline 3 │ │⚪Not registered 1│ │
│ └──────────┘ └───────────┘ └──────────┘ └───────────┘ └────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│Agent list (updated in real time) │
│ ┌─────┬───────┬──────┬────────┬─────────┬──────────┬────────────┐ │
│ │ Name │ Domain │ Status │ Health │ Heartbeat │ Version │ Operation │ │
│ ├─────┼───────┼──────┼────────┼─────────┼──────────┼─────────────┤ │
│ │ ... │ ... │ 🟢 │ 98% │ 3s ago │ v1.2.0 │ [Details][Restart]│ │
│ └─────┴───────┴──────┴────────┴─────────┴──────────┴────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ Agent details panel (right drawer / click to expand) │
│ ┌────────────────────────────────────┐ │
│ │ [Basic information] [Capability list] [Heartbeat history] │ │
│ │ [Load Curve] [Recent Tasks] [Error Log] │ │
│ │ │ │
│ │ Heartbeat Timeline ────────●────●────●──── │ │
│ │ Load line chart ──╱╲──╱╲──╱╲────────── │ │
│ │ │ │
│ │ [Restart] [Logout] [Update configuration] [View log] │ │
│ └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**MINIMUM FIELD**:

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

**Minimum action**: list · filter · get(id) · restart · deregister · update_config · view_logs · export_report

**Real Time Strategy**:

| Data items | Refresh method | Strategy |
| ---------- | ----------------------------------------------- | ----------------------------------------------- |
| Agent list | WS `agent.health_changed` + polling fallback | WS priority, 10s polling fallback; staleTime: 5s |
| Overview card | Aggregation from list data | Client-side aggregation, no additional requests |
| Heartbeat history | `GET /api/v1/agents/{id}/heartbeats` | Loaded when entering details, 60s staleTime |
| Load curve | `GET /api/v1/agents/{id}/metrics` | Load when entering details, 30s staleTime + WS delta |
| Agent details | `GET /api/v1/agents/{id}` | 5s staleTime, WS triggers invalidate |

**Mobile Adaptation**: The list view is simplified to a card flow (name + status + health + heartbeat), the details panel is expanded to full screen, and dangerous operations such as restart/logout are hidden (need to enter the Web/desktop operation).

**Error handling and offline downgrade**:

| Scene | Behavior |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| WS disconnected | Automatically downgraded to 10s polling; top yellow Banner "Real-time connection has been disconnected, data may be delayed"; WS automatically switches back after recovery |
| API request failed (≤3 times) | Automatic retry (exponential backoff 1s/2s/4s); skeleton remains during retry without flashing |
| API request failed (>3 times) | Display inline error card (with "Retry" button); cached data continues to be displayed and marked "Data as of {timestamp}" |
| Offline mode | Display the last cached Agent list (read-only); disable write operation buttons such as restart/deregister, and the tooltip prompts offline |
| Agent details 404 | Display "Agent has logged out or is unreachable" empty status; provide "Return to list" link |

### 4.2.8 Data statistics and analysis platform _(v3.0 new)_

> Multi-level operational indicator dashboard, covering full-dimensional statistics on tasks, agents, workflows, costs, SLOs, etc.

**Data source**: `GET /api/v1/dashboard/metrics` [Planned Layer C] + `MissionControlService.getSnapshot()` + `CostTrackingService` + `dashboard.metric_updated` WS event

```text
┌──────────────────────────────────────────────────────────────────┐
│ Data Statistics and Analysis [Time Range▼] [Domain▼] [Export▼] [⟳ Auto] │
├───────────────────────────────────────────────────────────────────┤
│ KPI Overview (Role Adaptation) │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│ │Total number of tasks │ │Success rate │ │Average time consuming │ │Active Agent │ │SLO compliance rate │ │
│ │ 1,247 │ │ 94.2% │ │ 3m 24s │ │ 38/47 │ │ 99.1% │ │
│ │ ↑12% │ │ ↑2.1% │ │ ↓15% │ │ — │ │ ↑0.3% │ │
│ └──────────┘ └───────────┘ └──────────┘ └───────────┘ └────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌───────────────────────────┐ │
│ │ Task trend line chart │ │ Status distribution pie chart │ │
│ │ (ECharts Line) │ │ (ECharts Pie) │ │
│ │ Dimension: success/failure/cancellation │ │ Dimension: running/blocked/done │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
│ ┌──────────────────────────┐ ┌───────────────────────────┐ │
│ │ Agent utilization heat map │ │ Cost trend + budget level │ │
│ │ (ECharts Heatmap) │ │ (ECharts Line+Area) │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
│ ┌──────────────────────────┐ ┌───────────────────────────┐ │
│ │ Top 10 Failure Reasons (Bar) │ │ Workflow Execution Time (Box) │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ Detailed table (can drill down) │
│ [Task details] [Agent details] [Workflow details] [Approval details] [Cost details] │
└──────────────────────────────────────────────────────────────────┘
```

**Indicator system (by role level)**:

| Metric Classification | L1 Operator | L2 Domain Management | L3 SRE | L4 Fleet Management |
| -------- | ------------------------ | -------------------------------- | ---------------------------------------- | -------------------------------- |
| Tasks | My number of tasks/success rate | Domain task throughput/average time taken/failure Top 5 | Platform-wide task trends/backlog queue depth | Cross-region task distribution/latency comparison |
| Agent | My commonly used Agent health | Domain Agent utilization/health distribution | Full platform Agent load heat map/heartbeat abnormality rate | Fleet Agent capacity planning/utilization trend |
| Workflow | — | Domain Workflow execution time/success rate | Workflow step bottleneck analysis/retry rate | Cross-domain Workflow comparison |
| Approval | My number of pending approvals/average response time | Domain approval backlog/timeout rate | All-platform approval SLA | Approval link efficiency comparison |
| Cost | My task cost | Domain cost/budget utilization/model cost distribution | Full platform cost trend/budget warning | Fleet cost comparison/capacity-cost efficiency |
| SLO | — | Domain SLO compliance rate | Full-platform SLO dashboard/error budget burndown | Cross-region SLO comparison |
| System health | — | — | Five-plane health/P99 latency/error rate/resource utilization | Cross-region health comparison/capacity prediction |

**MINIMUM FIELD**:

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

**Chart component mapping**:

| Indicators | Chart Types | ECharts Components | Refresh Strategy |
| ------------- | ------------- | ------------ | ---------------------------------- |
| Task Trend | Line Chart | LineChart | 1min polling + WS delta |
| Status Distribution | Pie Chart/Donut Chart | PieChart | 30s staleTime |
| Agent Utilization | Heatmap | Heatmap | 30s polling |
| Cost Trend | Area Chart + Line Chart | LineChart | 5min staleTime |
| Top Reasons for Failure | Horizontal Bar Chart | BarChart | 1min staleTime |
| Workflow time-consuming | Boxplot | BoxPlot | 5min staleTime |
| SLO compliance rate | Dashboard | Gauge | 1min polling |
| System Health | Multi-Axis Polyline | LineChart | 10s polling (SRE) / 1min (others) |

**Mobile Adaptation**: KPI cards scroll horizontally, charts are stacked in a single column, and pull-down refresh is supported. The detail table is changed to a card list, and drill-down is implemented through a full-screen pop-up layer.

**Error handling and offline downgrade**:

| Scene | Behavior |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Metrics API timeout/failure | KPI card displays "--" placeholder + "Loading failed" annotation; cached data is displayed and marked with timestamp |
| Single chart loading failed | The chart area displays inline errors + "Retry" button; other charts are not affected (independent QueryKey) |
| ECharts rendering exception | catch rendering error, fallback is data table view; report Sentry error |
| WS event loss | Rely on polling for full coverage; when polling and WS data are inconsistent, polling shall prevail (WS only provides incremental prompts) |
| Offline mode | Displays the last cached chart snapshot (static image/SVG export); hides the time range selector; prompts "Offline mode, data frozen" at the top |
| Export failed | Toast prompts the reason for the failure + retry button; export of large amounts of data is changed to back-end asynchronous generation + download link push |

### 4.2.9 Configuration Management Center _(new in v3.0)_

> Unified management of platform permissions, function switches, model configuration, domain settings, tenant management and other global configurations.

**Data source**: `admin-routes` + `user preference API` + `DomainUIConfig` (§6.1.2) + backend admin/config endpoint

```text
┌──────────────────────────────────────────────────────────────────┐
│ Configuration Management Center │
├──────────┬──────────────────────────────────────────────────────────────
│ │ │
│Side navigation │Content area │
│ │ │
│ ┌──────┐ │ ┌──────────────────────────────────────────────────┐ │
│ │👤User│ │ │ [Current: Permission Management] │ │
│ │ Preferences │ │ │ │ │
│ ├──────┤ │ │ ┌──────────────────────────────────────────────┐ │ │
│ │🔑Permissions│ │ │ │ Role List │ │ │
│ │ Management │ │ │ │ ┌──────┬───────┬─────────┬────────┬─────────┐ │ │ │
│ ├──────┤ │ │ │ │Role │ Number of permissions │ Number of users │ Scope │ Operations │ │ │ │
│ │🎛Function│ │ │ │ ├──────┼────────┼──────────┼────────┼─────────┤ │ │ │
│ │ Switch │ │ │ │ │L1 │ 12 │ 150 │ Personal │ [Edit] │ │ │ │
│ ├──────┤ │ │ │ │L2 │ 28 │ 25 │ Domain │ [edit] │ │ │ │
│ │🤖Model│ │ │ │ │L3 │ 45 │ 8 │ Platform │ [edit] │ │ │ │
│ │ Configuration │ │ │ │ │L4 │ 52 │ 3 │ Global │ [Edit] │ │ │ │
│ ├──────┤ │ │ └──────┴───────┴─────────┴────────┴─────────┘ │ │ │
│ │🏢Domain │ │ │ │ │ │ │
│ │ Settings │ │ │ │ Permission details (after expanding the role) │ │ │
│ ├──────┤ │ │ │ ┌────────────┬──────┬─────┬──────┬──────────┐ │ │ │
│ │🏠Tenant│ │ │ │ │ Function page │ View │ Edit │ Delete │ Manage │ │ │ │
│ │ Management │ │ │ │ ├────────────┼─────┼──────┼──────┼───────────┤ │ │ │
│ ├──────┤ │ │ │ │ Dashboard │ ✅ │ — │ — │ — │ │ │ │
│ │🔗Web │ │ │ │ │ Tasks │ ✅ │ ✅ │ ❌ │ ❌ │ │ │ │
│ │ hook │ │ │ │ │ Agents │ ✅ │ ✅ │ ✅ │ ✅ │ │ │ │
│ ├──────┤ │ │ │ └────────────┴──────┴─────┴──────┴───────────┘ │ │ │
│ │📋Audit│ │ │ └─────────────────────────────────────────────────────┘ │ │
│ │ Log │ │ └──────────────────────────────────────────────────────┘ │
│ └──────┘ │ │
├───────────┴─────────────────────────────────────────────────────────┤
│ Change audit column: "Latest changes: L2 permissions update by admin@co — 2h ago" [View All] │
└──────────────────────────────────────────────────────────────────┘
```

**Sub page specifications**:

| Subpage | Routing | Permissions | Function Description |
| ------------ | ---------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| User Preferences | `/shared/settings/preferences` | authenticated | Language/Time Zone/Theme (Light/Dark/Follow System)/Notification Preferences/Default Board Layout |
| Permission management | `/shared/settings/permissions` | org_admin+ | RBAC role CRUD/role-permission matrix editing/user-role assignment/permission inheritance visualization |
| Feature switches | `/admin/feature-flags` | platform_sre | Function switch list/switch status switching/grayscale percentage/target domain-tenant-user/change history |
| Model configuration | `/shared/settings/models` | domain_admin+ | LLM model list/model-domain binding/Prompt Policy version management/Token budget/Fallback chain configuration |
| Domain settings | `/shared/settings/domains/:id` | domain_admin+ | Domain basic information/DomainUIConfig editor (featureVisibility/actionPolicy/glossary)/Agent binding/SLO target |
| Tenant Management | `/shared/settings/tenants` | org_admin+ | Tenant List/Tenant CRUD/Tenant-Domain Mapping/Tenant-Level Quotas/SSO Configuration |
| Webhook Management | `/shared/settings/webhooks` | domain_admin+ | Webhook Endpoint CRUD/Event Subscription Selection/Delivery History/Retry Configuration/Secret Management |
| Organizational structure | `/shared/settings/org` | org_admin+ | Organization tree visualization/department-domain mapping/SSO/SCIM synchronization configuration/role inheritance rules |
| Audit log | `/governance/audit` | domain_admin+ | Operation log search/filter (time/user/operation type)/export/compliance mark (link to Governance → Audit module, non-independent page) |

**MINIMUM FIELD**:

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

**MINIMAL ACTION**:

| Subpages | Actions |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| User Preferences | get_preferences · update_preferences |
| Permission management | list_roles · get_role · create_role · update_role · delete_role · assign_user |
| Function switch | list_flags · get_flag · create_flag · toggle_flag · update_rollout |
| Model configuration | list_models · get_model · bind_domain · update_policy · set_budget · set_fallback |
| Domain settings | get_domain · update_domain · update_ui_config · bind_agents · set_slo |
| Tenant management | list_tenants · create_tenant · update_tenant · suspend_tenant · map_domain |
| Webhook | list_webhooks · create_webhook · update_webhook · delete_webhook · test_webhook · view_delivery_log |

**Mobile Adaptation**: Side navigation changed to bottom Tab or hamburger menu. The permission matrix table is changed to card + expansion mode. Model configuration and tenant management only support read-only viewing, and editing requires entering the web/desktop side.

**Error handling and offline downgrade**:

| Scene | Behavior |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Failed to save configuration | Keep form status is not cleared; display inline error + retry button; prompt "Please contact administrator" after more than 3 failures |
| Configuration save conflict (409) | Display a diff comparison pop-up window (current value vs. latest value on the server), and the user chooses to overwrite or merge |
| Insufficient permissions (403) | Field/button grayed out + tooltip "{required_role} permissions required"; sub-page navigation items without permissions will not be displayed |
| Function switch toggle fails | Automatic rollback of toggle status (optimistic update rollback); Toast prompts specific errors |
| Offline mode | All configuration pages are read-only; the edit button is disabled + tooltip "Not editable offline"; the last configuration snapshot is cached for viewing |
| Webhook test_webhook timeout | After 30s timeout, "Test timeout, please check the target endpoint reachability" is displayed; the last successful delivery log is displayed for reference |
| Monaco editor failed to load | fallback is `<textarea>` + JSON syntax highlighting (lightweight solution); prompts "Advanced editor failed to load, has been switched to the basic editor" |

### 4.2.10 Implemented module summary _(new in v3.0)_

The following 9 modules are listed in §4.1 and have backend data sources implemented, but have not yet reached the depth of specifications of the Core Page Blueprint (§4.2.1-4.2.9). This section provides a summary of the minimum specifications for quick connection by the front end.

| Module | Data Source | Minimal DTO / Key Field | Main Action | API Layer |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| Dispatch | dispatch-routes / dispatch CLI | `{ execution_id, worker_id, dispatch_status, created_at, retries }` | list · dispatch · cancel · retry | Layer C |
| Inspect | `OperatorConsoleBackendService.getSnapshot()` | `{ snapshot_id, plane, status, metrics{}, timestamp }` | get_snapshot · refresh · export | Layer A→C |
| Health | dashboard-routes health endpoint | `{ overall_status, planes[]{name, status, latency}, uptime }` | get_health · drill_plane | Layer C |
| Incidents | `OperatorConsoleBackendService.getIncidentTimeline()` | `{ incident_id, severity, source, message, created_at, resolved_at? }` | list · acknowledge · resolve · escalate | Layer A→C |
| Policy | admin-routes policy endpoint | `{ policy_id, type, rules[], enabled, version, updated_by }` | list · get · update · toggle | Layer C |
| Audit | admin-routes audit endpoint | `{ audit_id, user_id, action, resource, timestamp, details }` | search · filter · export · mark_compliance | Layer C |
| Compliance | [Planned] `/api/v1/compliance` | `{ compliance_id, standard, checks[], status, last_audit, score }` | list · run_check · export_report | Layer C |
| Workers | `OperatorConsoleBackendService.getWorkerPanel()` | `{ worker_id, status, current_execution, heartbeat, load, region }` | list · drain · restart · view_logs | Layer A→C |
| Queues | `OperatorConsoleBackendService` queue API | `{ queue_name, depth, processing, dead_letter_count, oldest_message_age }` | list · purge_dlq · retry_dlq · pause · resume | Layer A→C |

## 4.3 Page data truth source layering (contract §6 implemented)

> **Improvement**: Map the three-tier data source of contract §6 to the front-end TanStack Query strategy.

| Data layer | Applicable pages | Front-end strategy | Refresh mode |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| `shared_snapshot` | System Status Bar · Dashboard homepage · Stability header | Single `useSnapshot()` query, global sharing | WebSocket push + 30s polling fallback |
| `shared_query` | Dashboard · Stability · ApprovalCenter · Admin Overview | Shared query key, automatic deduplication across pages | WebSocket invalidation + stale-while-revalidate |
| `page_local_api` | Task inspect · Workflow inspect · Approval inspect · Worker details | Page-level query, fetch when entering the page, GC when leaving the page | Manual refetch + WebSocket push |

## 4.4 Routing architecture

### 4.4.1 Web/Desktop routing table

Based on React Router v7, supports lazy loading:

| Routing | Pages | Permission Requirements | Code Split |
| ------------------------------------------------ | ---------------------------------------- | --------------- | ---------- |
| `/` | Dashboard (redirect) | authenticated | No (entrance) |
| `/mission-control/dashboard` | Dashboard | authenticated | Yes |
| `/mission-control/tasks` | TaskCockpit L1 | authenticated | yes |
| `/mission-control/tasks/:id` | TaskCockpit L2 | authenticated | yes |
| `/mission-control/tasks/:id/steps/:stepId` | TaskCockpit L3 | authenticated | yes |
| `/mission-control/tasks/:id/evidence` | TaskCockpit L4 | authenticated | yes |
| `/mission-control/tasks/:id/timeline` | TaskCockpit L5 | authenticated | Yes |
| `/mission-control/workflows` | WorkflowCockpit L1 | pack_developer+ | Yes |
| `/mission-control/workflows/:id` | WorkflowCockpit L2 | pack_developer+ | Yes |
| `/mission-control/approvals` | ApprovalCenter | authenticated | Yes |
| `/mission-control/approvals/:id` | Approval Detail | authenticated | Yes |
| `/mission-control/stability` | StabilityPanel | platform_sre | Yes |
| `/mission-control/alerts` | Alerts | authenticated | Yes |
| `/operations/dispatch` | Dispatch | platform_sre | Yes |
| `/operations/inspect` | Inspect | platform_sre | Yes |
| `/operations/health` | Health | platform_sre | Yes |
| `/operations/incidents` | Incidents | platform_sre | Yes |
| `/governance/policy` | Policy | domain_admin+ | Yes |
| `/governance/audit` | Audit | domain_admin+ | Yes |
| `/governance/compliance` | Compliance | domain_admin+ | Yes |
| `/admin/takeover` | AdminTakeoverConsole | platform_sre | Yes |
| `/admin/workers` | Worker Panel | platform_sre | Yes |
| `/admin/queues` | Queue Panel | platform_sre | Yes |
| `/admin/feature-flags` | Feature Flags (Configuration Management Subpage §4.2.9) | platform_sre | Yes |
| `/extended/conversation` | NL Conversation | authenticated | yes |
| `/extended/workflow-builder` | Workflow Builder | pack_developer+ | Yes |
| `/extended/workflow-builder/:id` | Edit Workflow | pack_developer+ | Yes |
| `/extended/debugger/:id` | Workflow Debugger | pack_developer+ | Yes |
| `/extended/agents` | Agent Monitoring Center | domain_admin+ | Yes |
| `/extended/agents/:id` | Agent details | domain_admin+ | Yes |
| `/extended/hitl/:runId` | HITL Interface | authenticated | Yes |
| `/shared/explainability/:taskId` | Explainability Viewer | authenticated | Yes |
| `/shared/costs` | Cost Center | domain_admin+ | Yes |
| `/shared/marketplace` | Marketplace | authenticated | Yes |
| `/shared/marketplace/:id` | Marketplace Detail | authenticated | Yes |
| `/shared/domain-wizard` | Domain Wizard | domain_admin+ | Yes |
| `/shared/analytics` | Data statistics platform | authenticated | Yes |
| `/shared/settings` | Configuration Management Center | authenticated | Yes |
| `/shared/settings/preferences` | User preferences | authenticated | Yes |
| `/shared/settings/permissions` | Permission management | org_admin+ | Yes |
| `/shared/settings/models` | Model configuration | domain_admin+ | Yes |
| `/shared/settings/domains/:id` | Domain Settings | domain_admin+ | Yes |
| `/shared/settings/tenants` | Tenant Management | org_admin+ | Yes |
| `/shared/settings/webhooks` | Webhook Administration | domain_admin+ | Yes |
| `/shared/settings/org` | Organizational Structure | org_admin+ | Yes |
| `/login` | Login page | public | No (entry) |
| `/login/callback` | SSO callback | public | no |

### 4.4.2 Mobile navigation structure

Based on React Navigation v7:

```text
AuthStack (not logged in)
  ├── LoginScreen
  └── SSOCallbackScreen

MainTabs (logged in)
  ├── HomeTab (Stack)
  │ ├── DashboardScreen (L1)
  │ └── NLConversationScreen
  │
  ├── TasksTab (Stack)
  │ ├── TaskListScreen
  │ ├── TaskDetailScreen → Steps → Evidence → Timeline
  │ └── ExplainabilityScreen
  │
  ├── ApprovalsTab (Stack)
  │ ├── ApprovalListScreen
  │ └── ApprovalDetailScreen
  │
  ├── MarketplaceTab (Stack)
  │ ├── MarketplaceListScreen
  │ └── MarketplaceDetailScreen
  │
  └── MoreTab (Stack)
      ├── AnalyticsScreen (L1 personal dimension)
      ├──AgentListScreen
      ├── CostCenterScreen
      ├── SettingsScreen
      └── HITLScreen
```

**Navigation Features**:

| Features | Implementation |
| ---------- | --------------------------------------------- |
| Bottom tabs | 5 main tabs (Home/Tasks/Approve/Market/More) |
| Badge count | Approval labels display the number to be processed (WebSocket real-time push) |
| Deep link | `aa://tasks/123` → Jump to task details |
| Gesture Navigation | iOS Edge Back; Android Back Key |
| State preservation | Preserve list scroll position and filter conditions when switching tabs |

### 4.4.3 Permission routing guard chain

```text
Routing guard chain:
  1. AuthGuard → Check if you are logged in (otherwise jump to /login)
  2. TenantGuard → Check whether tenant is valid
  3. PermissionGuard → Check whether roles/permissions meet routing requirements
  4. FeatureGuard → Check whether the feature switch is enabled
  5. ModeGuard → Enterprise Mode/Single Player Mode Functional Visibility
```

## 4.5 Page-level permission matrix

### 4.5.1 Page Visibility Matrix

| Page/Module | Independent Operator (L1) | Line of Business Leader (L1) | Domain Administrator (L2) | Pack Developer (L2/L3) | Platform SRE (L3/L4) |
| -------------------------- | -------------- | ---------------- | ---------------- | ------------------ | ---------------- |
| Dashboard | ✅ Own domain | ✅ Business line domain | ✅ Jurisdiction domain | ✅ Development domain | ✅ Global |
| TaskCockpit | ✅ Own tasks | ✅ Business line tasks | ✅ In-domain tasks | ✅ Development related tasks | ✅ All tasks |
| WorkflowCockpit | ❌ | ✅ Read only | ✅ | ✅ | ✅ |
| ApprovalCenter | ✅ Own approval | ✅ Business line approval | ✅ In-domain approval | ❌ | ✅ All approvals |
| StabilityPanel | ❌ | ❌ | ⚠️ Domain Health | ❌ | ✅ |
| AdminTakeoverConsole | ❌ | ❌ | ❌ | ❌ | ✅ |
| NL Conversation | ✅ | ✅ | ✅ | ✅ | ✅ |
| WorkflowBuilder | ❌ | ❌ | ❌ | ✅ | ✅ |
| WorkflowDebugger | ❌ | ❌ | ❌ | ✅ | ✅ |
| AgentManager | ❌ | ❌ | ✅ | ✅ | ✅ |
| Marketplace | ✅ Browse | ✅ Browse | ✅ Install | ✅ Publish+Install | ✅ All |
| CostCenter | ✅ Own domain | ✅ Business line | ✅ Domain level | ❌ | ✅ Global |
| DomainWizard | ❌ | ❌ | ✅ | ❌ | ✅ |
| Settings | ✅ Personal | ✅ Personal | ✅ Domain+Personal | ✅ Personal | ✅ Global+Personal |
| AgentMonitor (§4.2.7) | ❌ | ❌ | ✅ Domain Agent | ✅ Development Agent | ✅ Global |
| Analytics (§4.2.8) | ✅ Personal dimension | ✅ Business line dimension | ✅ Domain dimension | ✅ Development dimension | ✅ Full platform + cross-region |
| ConfigCenter (§4.2.9) | ✅ Preferences only | ✅ Preferences only | ✅ Domain Settings + Models | ❌ | ✅ All |

### 4.5.2 Key action authority matrix

| Action | Independent Operator (L1) | Business Line Leader (L1) | Domain Administrator (L2) | Pack Developer (L2/L3) | Platform SRE (L3/L4) | Secondary Confirmation |
| ------------------------ | -------------- | ---------------- | ------------ | ------------------ | --------------- | ---------- |
| Create a task | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cancel task | ✅ Owned | ✅ Business line | ✅ Within domain | ❌ | ✅ Any | ✅ |
| Approval approve/reject | ✅ Assigned | ✅ Business line | ✅ Within domain | ❌ | ✅ Any | ✅ |
| Admin Takeover | ❌ | ❌ | ❌ | ❌ | ✅ | ✅✅ Double |
| Panic emergency brake | ❌ | ❌ | ❌ | ❌ | ✅ | ✅✅ Double |
| Publish Pack to Marketplace | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ Approval Flow |
| Install Marketplace Pack | ❌ | ❌ | ✅ | ✅ Development Environment | ✅ | ✅ |
| Modify domain configuration | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Worker Management | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View Explainability | ✅ Own tasks | ✅ Business lines | ✅ In-domain | ✅ | ✅ | ❌ |

### 4.5.3 Drill-down level permissions

| Drill Down Levels | Content | Independent Operators | Line of Business Owners | Domain Administrators | Pack Developers | Platform SREs |
| -------- | --------------------------- | ---------- | ------------ | -------- | ----------- | -------- |
| L1 | Overview/Summary | ✅ | ✅ | ✅ | ✅ | ✅ |
| L2 | Details/Step List | ✅ | ✅ | ✅ | ✅ | ✅ |
| L3 | Execution Log/Evidence | ❌ | ⚠️ Desensitization | ✅ | ✅ | ✅ |
| L4 | Raw JSON/Debug Information | ❌ | ❌ | ⚠️ Read only | ✅ | ✅ |
| L5 | Internal State/Reliability Fabric | ❌ | ❌ | ❌ | ❌ | ✅ |

**Implementation**:

- The frontend checks the `auth-store.permissions` array in the route guard
- Page-level hiding: Navigation items that do not meet the permissions are not rendered (non-disabled)
- Action level control: return `{ allowed, reason }` through `usePermission(action, resource)` hook
- Drill-down level: The component receives the `maxDrillDepth` prop and uses `usePermission` to calculate the maximum level that the current user can reach.

### 4.5.4 Field-level visibility and desensitization matrix _(new in v2.3)_

In addition to page/action/drill-down level permissions, the platform UI also requires a fourth layer of control - **Field-level visibility and desensitization**. The following matrix defines the visibility and desensitization rules for each role on different data fields.

#### FieldVisibilityPolicy

| Field Category | Independent Operator (L1) | Line of Business Leader (L1) | Domain Administrator (L2) | Pack Developer (L2/L3) | Platform SRE (L3/L4) |
| -------------------------------- | -------------- | ---------------- | ------------ | ------------------ | --------------- |
| Task title/summary | ✅ plain text | ✅ plain text | ✅ plain text | ✅ plain text | ✅ plain text |
| Task parameters/input JSON | ⚠️ summary | ⚠️ summary | ✅ clear text | ✅ clear text | ✅ clear text |
| Tool Call payload (parameters + return value) | ❌ Hide | ⚠️ Desensitization | ✅ Clear text | ✅ Clear text | ✅ Clear text |
| Prompt / Policy version number | ❌ Hide | ❌ Hide | ⚠️ Version number only | ✅ Clear text | ✅ Clear text |
| Prompt original text / Policy original text | ❌ Hide | ❌ Hide | ❌ Hide | ✅ Clear text | ✅ Clear text |
| Evidence raw JSON | ❌ Hide | ⚠️ Summary | ⚠️ Desensitize | ✅ Clear text | ✅ Clear text |
| Assignee / Owner Name | ✅ Clear text | ✅ Clear text | ✅ Clear text | ⚠️ ID only | ✅ Clear text |
| Tenant / Workspace ID | ⚠️ Current tenant only | ⚠️ Current tenant only | ⚠️ Jurisdiction domain only | ⚠️ Development domain only | ✅ All |
| Worker node IP / hostname | ❌ hidden | ❌ hidden | ❌ hidden | ❌ hidden | ✅ clear text |
| Error stacktrace | ❌ hidden | ❌ hidden | ⚠️ first line | ✅ clear text | ✅ clear text |
| Cost amount details | ✅ Own domain | ✅ Business line | ✅ Domain level | ❌ Hide | ✅ Global |
| Model / LLM provider identifier | ❌ Hide | ❌ Hide | ⚠️ Model name only | ✅ Clear text | ✅ Clear text |

**Legend**:✅ Plain text = original value displayed; ⚠️ Desensitized/summary = partially hidden or only summary displayed; ❌ Hidden = do not render this field.

#### RedactionRule type definition

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

| PII categories | Storage layer behavior | L1 presentation | L2 presentation | L3/L4 presentation |
| ---------------- | ----------------------------- | ------------- | -------- | ------------ |
| User's real name | Hash stored in cache | Only display name | Only display name | Full name |
| Email address | Do not write to offlineStore | `j***@co.com` | Complete | Complete |
| IP address | Do not write to IndexedDB / SQLite cache | Hidden | Hidden | Clear text |
| Biometric binding information | L4 SecureStorage only | Hidden | Hidden | "Bound" flag |
| Organizational structure path | Only the subtree visible to the current user is stored in the cache | Own node | Jurisdictional subtree | Full tree |

**Implementation**:

- `shared/domain/field-visibility.ts` exports `applyRedaction(field, value, role): RedactedValue`
- `applyRedaction` is called in ViewModel mapper, desensitization is completed in the DTO → VM conversion phase, and the component layer does not need to be aware
- Fields with `auditOnAccess: true` automatically report the telemetry `field_access` event when displayed at L3/L4 level
- The PII field list is declared by `FieldVisibilityPolicy.piiFields`, aligned with the backend `data-classification` policy

## 4.6 Key module implementation blueprint

> The following implementation details are extracted from the Doc-11 historical implementation papers as high-value content that has been reviewed and confirmed.

### 4.6.1 NL Dialog State Machine → UI Mapping

| Status | UI Performance | Backend Events | Status |
| -------------------------- | ---------------------------------------- | -------------------------- | ------------- |
| `idle` | Input box placeholder + recommended action card | — | [Implemented] |
| `parsing` | Input disabled + "Understanding..." skeleton animation | — | [Implemented] |
| `clarifying` | Agent question bubble + option button/input box | `nl.clarification_needed` | [Proposed] |
| `building` | "Building task..." progress indicator | — | [Implemented] |
| `confirming` | Risk preview card + confirm/modify/cancel buttons | `goal.decomposition_ready` | [Planned] |
| `executing` | Real-time step progress bar + current step description | `progress` | [Implemented] |
| `reporting` | Results summary card + details link + "Why?" button | `completed` / `failed` | [Implemented] |

### 4.6.2 HITL human-machine collaboration operation panel

| Action | Description | UI Components | Status |
| -------- | -------------------------- | -------------------------- | ------------- |
| Inspect | View the current PlanBundle/Context | JSON Tree + Collapsible Panel | [Implemented] |
| Patch | Modify current plan parameters | Form editor + diff preview | [Planned] |
| Override | Override Agent decision | Drop-down selection of alternatives + reason input | [Planned] |
| Takeover | Completely take over manual execution | Full-featured operation panel + operation record | [Implemented] |
| Resume | Resume execution (4 modes to choose from) | Radio + Confirm button | [Implemented] |

**Recovery Mode**:

| Mode | Description | Status |
| -------------------------- | -------------------------- | ------------- |
| `resume_same_state` | Resume as is and continue execution | [Implemented] |
| `resume_with_replan` | Trigger P3 replan | [Implemented] |
| `resume_supervised` | Resume supervised mode (confirmation is required for each step) | [Planned] |
| `abort_on_resume` | Safe termination | [Implemented] |

### 4.6.3 Workflow debugger capability matrix

| Capabilities | Running | Completed | UI Implementation | Status |
| ------------- | ------ | ------ | ------------------------------------- | ---------- |
| Execution Timeline | Real-Time | Playback | Horizontal Timeline + Step Cards (color-coded states) | [Planned] |
| OAPEFLIR Step into | ✓ | ✓ | Expand steps → O/A/P/E/F/L/I/R each stage panel | [Planned] |
| Data flow view | ✓ | ✓ | JSON diff between steps (input → output) | [Planned] |
| Side effects Diff | ✗ | ✓ | Expected vs actual side effects side-by-side comparison | [Proposed] |
| Breakpoint debugging | ✓ | ✗ | Click the step to set a breakpoint; conditional breakpoint dialog box | [Proposed] |
| Time Travel | ✗ | ✓ | Timeline Slider + ContextSnapshot Preview | [Deferred] |
| Run comparison | ✗ | ✓ | Double columns side by side + difference highlighting | [Deferred] |

**Backend Dependency Note**: Breakpoint debugging and time travel depend on the backend DebuggerService to provide the `ws/v1/debug/{workflow_id}` endpoint (currently [Proposed]). Until this endpoint is stable, the debugger only supports read-only playback of the execution timeline and data flow view.

### 4.6.4 Approval Center Interaction Features

| Features | Web/Desktop | Mobile | Status |
| ---------- | ----------------------------------------------- | ------------------ | ---------- |
| Shortcut operation | Keyboard shortcut A(approve)/R(reject)/D(delegate) | Notification bar shortcut button | [Planned] |
| Batch Actions | Select All + Batch Approval (Low Risk Only) | Swipe Gesture Batch Actions | [Planned] |
| Context preview | Expand right panel ApprovalContext | Full screen display of details page | [Planned] |
| Delegation | Organization tree pop-up window selection | Search + recent contacts | [Planned] |
| Timeout reminder | Countdown label + last 30min highlight | Push notification + vibration | [Planned] |

### 4.6.5 NL dialogue module page wireframe

```text
Web/Desktop:
┌───────────────────────────────────────────────────────┐
│ NL Conversation Panel (can be positioned on the right side or independent in full screen) │
│ │
│ ┌───────────────────────────────────────────────┐ │
│ │ Message Stream │ │
│ │ │ │
│ │ [User] Help me launch a spring marketing campaign │ │
│ │ │ │
│ │ [Agent] OK, I need to confirm some information: │ │
│ │ • Which product’s marketing campaign?                          │ │
│ │ • Budget range?                                   │ │
│ │ • Deadline?                                   │ │
│ │ │ │
│ │ [System] Risk Preview Card │ │
│ │ ┌───────────────────────────────────┐ │ │
│ │ │ 3 subtasks will be created · Estimated ¥2,500 │ │ │
│ │ │ Advertising compliance approval required │ │ │
│ │ │ [Confirm] [Modify] [Cancel] │ │ │
│ │ └────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────┐ │
│ │ [Input box] │ Voice │ Attachments │ Cmd+K Command Panel │ │
│ └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

Mobile version:
┌────────────────────────┐
│ ← NL Dialogue ··· │
│ │
│ Message flow (full screen) │
│ │
│ [Input box] [Voice] [Attachment] │
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

### 4.6.6 Task management three-column layout wireframe

```text
Web/Desktop (xl breakpoint):
┌───────────┬─────────────────────────┬─────────────────┐
│ Filter sidebar │ Task list │ Task details panel │
│ │ │ │
│ Status ▾ │ ● Spring Marketing executing ▶ │ Goal:... │
│ □ All │ Advertising domain 2h ago │ Status: executing │
│ ■ Executing │ │ Progress: 2/4 │
│ □ Completed │ ● Monthly report completed ✓ │ │
│ □ Pending approval │ Data domain 5h ago │ [DAG dependency graph] │
│ □ Failure │ │ │
│ │ ● Customer cleaning awaiting ⏳ │ Step list: │
│ Domain ▾ │ Data Domain 1d ago │ ▶ Step 1 ✓ │
│ □ All │ │ ▶ Step 2 ✓ │
│ ■ Advertising │ │ ▼ Step 3 ▶ │
│ □ Data │ │ OAPEFLIR: E │
│ │ │ ○ Step 4 ... │
│ Date ▾ │ │ │
│ Last 7 days │ │ [Explanation] [Cost] │
└───────────┴─────────────────────────┴──────────────────┘
```

**Information level**:

| Level | Content | Display conditions |
| ---- | ----------------------------------------------- | -------------- |
| L0 | Title, status logo, field label, time | List items always shown |
| L1 | Progress percentage, number of subtasks, current step, time consumption | Select details panel |
| L2 | DAG dependency graph, step list (OAPEFLIR stage), tool record | Expand details |
| L3 | HarnessRun full, ContextSnapshot, Evidence links | "Full record" jump |

### 4.6.7 Approval Center Page Wireframe

```text
┌──────────────────────────────────────────────────┐
│ Approval Center │
│ Pending (3) │ Processed (28) │ Delegated (5) │
│ │
│ ┌────────────────────────────────────────────────┐ │
│ │ Emergency │ Quantitative strategy deployment Critical │ 2h remaining │ │
│ │ Domain: quant-trading │ │
│ │ Summary: Agent requested to deploy a new trading strategy │ │
│ │ Risk Assessment: [Expand] │ │
│ │ [Approval] [Reject] [Entrust] [Supplement] │ │
│ └────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────┐ │
│ │ Normal │ Price adjustment High │ 24h remaining │ │
│ │ ... │ │
│ └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 4.6.8 Four-layer architecture of operational dashboard

| Kanban Hierarchy | Roles | Core Panels | Refresh Strategy |
| -------- | -------- | -------------------------------------------------- | ----------- |
| L1 | Operator | My Tasks, Approvals, Agent Health, Budget, NL Briefing | Live + 5min |
| L2 | Domain Management | Domain throughput, Agent utilization, SLO, Top failures, cost distribution | 1min + 5min |
| L3 | Platform SRE | Five-plane health, resource utilization, error rate, delay, Incident | 10s + 30s |
| L4 | Fleet Management | Cross-region status, fleet costs, tenant comparison, capacity forecast, compliance posture | 1min + 1h |

**Detailed specifications of panels at each level** _(v3.0 extension)_:

| Hierarchy | Panel name | Data source | Chart type | Refresh interval |
| ---- | --------------- | ----------------------------------------------------- | --------------- | -------- |
| L1 | My tasks overview | `GET /api/v1/tasks?owner=me` | KPI card | Live WS |
| L1 | Pending approval queue | `MissionControlService.listApprovalQueue()` | List + Badge | Real-time WS |
| L1 | My Agent Health | `GET /api/v1/agents?scope=my_domain` | Status Indicator | 10s |
| L1 | Budget usage | `GET /api/v1/costs?scope=my_domain` | Gauge | 5min |
| L2 | Domain task throughput | `GET /api/v1/dashboard/metrics?scope=domain` | Line chart | 1min |
| L2 | Agent utilization | `GET /api/v1/dashboard/metrics?metric=agent` | Heat map | 1min |
| L2 | SLO compliance rate | `GET /api/v1/dashboard/metrics?metric=slo` | Gauge | 5min |
| L2 | Top 5 Failure Reasons | `GET /api/v1/dashboard/metrics?metric=failures` | Horizontal Bar Chart | 5min |
| L2 | Domain cost distribution | `GET /api/v1/costs?scope=domain&breakdown=model` | Pie chart | 5min |
| L3 | Five-plane health | `GET /api/v1/dashboard/metrics?metric=health` | Multi-axis polyline | 10s |
| L3 | P99 latency | `GET /api/v1/dashboard/metrics?metric=latency` | Line chart + threshold line | 10s |
| L3 | Error rate | `GET /api/v1/dashboard/metrics?metric=errors` | Area chart | 10s |
| L3 | Resource Utilization | `GET /api/v1/dashboard/metrics?metric=resources` | Dashboard Cluster | 30s |
| L3 | Incident Timeline | `OperatorConsoleBackendService.getIncidentTimeline()` | Timeline | Live WS |
| L4 | Cross-region status | `GET /api/v1/dashboard/metrics?scope=fleet` | Geographical heat map | 1min |
| L4 | Fleet cost comparison | `GET /api/v1/costs?scope=fleet` | Grouped histogram | 1h |
| L4 | Tenants comparison | `GET /api/v1/dashboard/metrics?scope=tenants` | Radar chart | 1h |
| L4 | Capacity forecast | `GET /api/v1/dashboard/metrics?metric=capacity` | Forecast line chart | 1h |

**Adaptive Rules**:

- Single player mode: L1 board only, multi-tenant/organization panel hidden
- Enterprise mode: automatically switch L1-L4 according to user role
- All Kanban panels support drag-and-drop sorting + visibility configuration
- Kanban layout is persisted to `UserPreferences.default_dashboard_layout` (Configuration Management Center §4.2.9)

### 4.6.9 Workflow builder technical solution

| Components | Technology | Description |
| -------- | ------------ | ------------------------------------ |
| Canvas | React Flow | Node canvas, supports zoom/pan/frame selection/adsorption |
| Node Type | Custom Node | Trigger/Action/Condition/Loop/Parallel/Waiting/Approval |
| Connections | Directed edges | Conditional branch annotation + data flow type annotation |
| Verification | DAG topology verification | Real-time detection of loops, missing connections, and unfilled parameters |
| Preview | Dry-run | Sandbox execution, no real side effects |
| Property panel | Right drawer | Display configuration form after selecting node |
| Component Panel | Left Panel | Searchable/Dragable Component List |

**Mobile terminal policy**: The mobile terminal only supports read-only viewing of the Workflow diagram (zoom + node details pop-up window), and does not support editing. Reason: The drag-and-drop editing experience on the canvas is poor on small screens, and React Flow does not support React Native.

### 4.6.10 Debugger real-time data stream

```text
WebSocket /ws/v1/debug/{workflow_id}
  │
  ▼
DebugEventStream
  ├── step_started → Add a new step card to the timeline
  ├── step_progress → Progress update in step card
  ├── oapeflir_phase → OAPEFLIR panel real-time switching
  ├── tool_call → Tool call log append
  ├── evaluator_report → Refresh the evaluation results panel
  ├── breakpoint_hit → pause instruction + breakpoint panel pop-up
  ├── step_completed → Step card changes color (green/red)
  └── run_completed → timeline lock + enable time travel
```

### 4.6.11 Agent monitoring center technical solution _(v3.0 new)_

**Core Components**:

| Components | Technology | Description |
| -------------- | ---------------------- | -------------------------------------------------- |
| Agent list | Virtual scrolling + WS real-time update | Supports 500+ Agent list without lag, WS pushes incremental updates |
| Health indicator | `AgentHealthIndicator` | Reuse existing components of `ui-core/business/`, support 4-color status |
| Heartbeat Timeline | ECharts Scatter | X-axis time, Y-axis heartbeat interval, abnormal points marked in red |
| Load Curve | ECharts Line | Dual Y-axis: active_tasks + queue_depth |
| Agent details drawer | Right Drawer 640px | Tab switching: basic information/capabilities/heartbeat/load/task/error |

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

### 4.6.12 Data statistics platform technology solution _(v3.0 new)_

**Chart Rendering Architecture**:

```text
DashboardMetricsDTO (API)
  │
  ▼
useMetricsQuery(scope, timeRange)
  │
  ├── KPI aggregation ──────────→ <KPICardGrid>
  ├── task_trend ─────────→ <TaskTrendChart type="line">
  ├── status_distribution → <StatusPieChart type="pie">
  ├── agent_utilization ──→ <AgentHeatmap type="heatmap">
  ├── cost_trend ─────────→ <CostAreaChart type="area">
  ├── top_failures ───────→ <FailureBarChart type="bar">
  └── workflow_durations ─→ <WorkflowBoxPlot type="boxplot">
```

**Role Adaptation Rules**:

| User roles | Visible charts | Default time range |
| -------- | ---------------------------------------------- | ------------ |
| L1 | KPI card (personal dimension) + my task trend | 7 days |
| L2 | All Charts (Domain Dimension) | 30 Days |
| L3 | All charts (all platforms) + System Health Panel + P99 Latency | 24 hours |
| L4 | All charts (across regions) + capacity forecast + tenant comparison | 30 days |

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

### 4.6.13 Configuration management center technical solution _(v3.0 new)_

**Sub-page routing and lazy loading**:

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

| Components | Technology | Description |
| -------------- | ------------------- | ----------------------------------------------- |
| Role-Permission Matrix | `<PermissionGrid>` | Row = function page, column = operation (CRUD+manage), cell = switch |
| Visualization of permission inheritance | Tree diagram + highlight inheritance chain | Display role inheritance relationship and highlight current permission source |
| User-role assignment | Shuttle box (Transfer) | Left = assignable users, right = assigned users, supports batch operations |
| Change Diff preview | Comparison table before and after the change | Display a summary of the changes before saving, requiring a second confirmation |

**Model configuration management**:

| Components | Technology | Description |
| ------------------ | ------------------ | ----------------------------------------------- |
| Model list | Data table | Display provider/model/number of domain bindings/Token budget usage rate |
| Prompt Policy editing | Monaco Editor embedding | Supports JSON/YAML editing + syntax verification + diff preview |
| Token budget dashboard | ECharts Gauge | Daily/monthly budget usage rate, over-limit warning |
| Fallback chain editing | Drag and drop sorting list | Drag and drop to adjust fallback priority |
| Domain binding management | Shuttle box | Left = available domain, right = bound domain |

**Function switch management**:

| Components | Technology | Description |
| ---------- | ----------------------- | --------------------------------------- |
| Switch List | Data Table | Name/Status/Grayscale Percentage/Target Range/Last Update |
| Grayscale slider | Slider + digital input | 0-100% grayscale percentage control |
| Target selector | Multi-level selection (domain → tenant → user) | Reduce the grayscale range step by step |
| Change history | Timeline component | Who changed what when, support rollback |

## 4.7 Planned module mini-contract _(v2.3 new)_

The following 6 `[Planned]` modules have been incorporated into the information architecture (§4.1), but the closed-loop contract is not yet available. This section defines the minimum contract block (minimal DTO/actions/query keys/permission/WS needs/offline rule) for each module as an alignment baseline for back-end API design and front-end mock-server.

> **Data authoritative convention** _(new in v3.0)_: Each mini-contract adds three new dimensions (Authoritative Source / Derived Source / Projection Owner) to prevent the front end from mistaking UI projection for authoritative fact.
>
> - **Authoritative Source**: The only source of truth for this module’s data (backend service/external system)
> - **Derived Source**: Derived data source based on aggregation or projection of authoritative source
> - **Projection Owner**: The team/module responsible for maintaining DTO → ViewModel projection logic. This owner is responsible for updating when the schema changes.

### 4.7.1 AgentManager

| Dimensions | Definition |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Minimal DTO | `{ agent_id, name, domain_id, status, health, version, capabilities[], last_heartbeat, created_at }` |
| Actions | `list` · `get(id)` · `register` · `deregister` · `update_config` · `restart` |
| Query Keys | `["agents"]` · `["agents", "list", filters]` · `["agents", "detail", id]` |
| Permission | Domain Admin(L2): list+get; Pack Developer(L2/L3): full CRUD; SRE(L3/L4): full + restart |
| WS Needs | `agent.health_changed` · `agent.registered` · `agent.deregistered` |
| Offline Rule | Read-only browsing allows stale cache; registration/logout/restart must be online |
| API Endpoint | `CRUD /api/v1/agents` · `POST /api/v1/agents/{id}/restart` |
| Authoritative Source | `AgentRegistryService` (src/domains/registry/) |
| Derived Source | `MissionControlService.getSnapshot()` → agents summary (non-authoritative, projected only) |
| Projection Owner | Front-end `feature-agent-manager` module |

### 4.7.2 WorkflowBuilder

| Dimensions | Definition |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Minimal DTO | `{ workflow_id, name, domain_id, steps[], edges[], version, status, created_by, updated_at }` |
| Actions | `list` · `get(id)` · `create` · `update` · `delete` · `validate` · `publish` · `clone` |
| Query Keys | `["workflows"]` · `["workflows", "list", filters]` · `["workflows", "detail", id]` |
| Permission | Pack Developer(L2/L3): full CRUD; SRE(L3/L4): full + publish |
| WS Needs | `workflow.updated` · `workflow.published` · `workflow.validation_result` |
| Offline Rule | Canvas editing allows offline queuing (local draft); publishing/verification must be online |
| API Endpoint | `CRUD /api/v1/workflows` · `POST /api/v1/workflows/{id}/validate` · `POST /api/v1/workflows/{id}/publish` |
| Authoritative Source | `WorkflowDefinitionService` (src/platform/five-plane-orchestration/) |
| Derived Source | `MissionControlService.getWorkflowCockpit()` → workflow summary (non-authoritative, projected only) |
| Projection Owner | Front-end `feature-workflow-builder` module |

### 4.7.3 WorkflowDebugger

| Dimensions | Definition |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO | `{ debug_session_id, workflow_id, execution_id, timeline_events[], breakpoints[], current_step, state_snapshot }` |
| Actions | `start_session` · `set_breakpoint` · `remove_breakpoint` · `step_over` · `resume` · `inspect_state` · `replay_from(step)` |
| Query Keys | `["debug", workflowId]` · `["debug", "session", sessionId]` · `["debug", "timeline", executionId]` |
| Permission | Pack Developer(L2/L3): full; SRE(L3/L4): full |
| WS Needs | `ws/v1/debug/{workflow_id}` — `debug.step_entered` · `debug.breakpoint_hit` · `debug.state_snapshot` |
| Offline Rule | All must be online (real-time debugging relies on WS connection) |
| API Endpoint | `POST /api/v1/debug/sessions` · `GET /api/v1/debug/sessions/{id}` · `DELETE /api/v1/debug/sessions/{id}` |
| Authoritative Source | `DebuggerService` (src/ops-maturity/debugger/) + `ExecutionEngine` runtime status |
| Derived Source | `state_snapshot` pushed in real time by WS is runtime projection, non-persistent true value |
| Projection Owner | Front-end `feature-workflow-debugger` module |

### 4.7.4 Marketplace

| Dimensions | Definition |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimal DTO | `{ pack_id, name, description, author, version, domain_tags[], rating, download_count, compatibility, status }` |
| Actions | `list` · `search` · `get(id)` · `install` · `uninstall` · `publish` · `review` · `rate` |
| Query Keys | `["marketplace"]` · `["marketplace", "list", filters]` · `["marketplace", "detail", id]` · `["marketplace", "installed"]` |
| Permission | L1: browse+rate; Domain Administrator (L2): install+uninstall; Pack Developer: publish; SRE: full |
| WS Needs | `marketplace.pack_published` · `marketplace.pack_updated` · `marketplace.install_completed` |
| Offline Rule | Browsing allows stale cache; installation/uninstallation/release must be online |
| API Endpoint | `GET /api/v1/marketplace` · `GET /api/v1/marketplace/{id}` · `POST /api/v1/marketplace/{id}/install` · `POST /api/v1/marketplace/publish` |
| Authoritative Source | `MarketplaceService` (src/scale-ecosystem/marketplace/) |
| Derived Source | None (Marketplace is its own truth source) |
| Projection Owner | Front-end `feature-marketplace` module |

### 4.7.5 Explainability

| Dimensions | Definition |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO | `{ explanation_id, task_id, step_id, explanation_type, reasoning_chain[], confidence, sources[], generated_at }` |
| Actions | `query(task_id, step_id?)` · `get(explanation_id)` · `rate_helpfulness` · `export` |
| Query Keys | `["explanations", taskId]` · `["explanations", "detail", explanationId]` |
| Permission | L1: Own task summary; Domain Administrator (L2): In-domain full; Pack Developer: full; SRE: full |
| WS Needs | No real-time needs (query on demand) |
| Offline Rule | Explanations that have been queried can be cached; new queries must be online |
| API Endpoint | `POST /api/v1/explanations` (query) · `GET /api/v1/explanations/{id}` |
| Authoritative Source | `ExplainabilityService` (src/ops-maturity/explainability/) |
| Derived Source | explanation is generated based on `ExecutionEngine` running log + LLM inference chain, not original facts |
| Projection Owner | Front-end `feature-explainability` module |

### 4.7.6 CostCenter

| Dimensions | Definition |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimal DTO | `{ cost_record_id, domain_id, tenant_id, period, total_cost, breakdown_by_model[], breakdown_by_task_type[], budget, budget_utilization_pct }` |
| Actions | `get_summary(domain_id, period)` · `get_detail(cost_record_id)` · `set_budget` · `set_alert_threshold` · `export_report` |
| Query Keys | `["costs", domainId, period]` · `["costs", "detail", recordId]` · `["costs", "budget", domainId]` |
| Permission | L1: Own domain read-only; Business line leader: Business line aggregation; Domain administrator: domain level + set_budget; SRE: global + all actions |
| WS Needs | `cost.budget_alert` · `cost.period_closed` |
| Offline Rule | Read-only browsing allows stale cache; set_budget / set_alert must be online |
| API Endpoint | `GET /api/v1/costs` · `GET /api/v1/costs/{id}` · `PUT /api/v1/costs/budget` · `POST /api/v1/costs/export` |
| Authoritative Source | `CostTrackingService` (src/ops-maturity/cost/) |
| Derived Source | cost breakdown aggregated from `ResourceManagerService` usage data |
| Projection Owner | Front-end `feature-cost-center` module |

### 4.7.7 AnalyticsDashboard _(new in v3.0)_
| Dimensions | Definition |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimal DTO | `{ time_range, scope, kpis{total_tasks,success_rate,avg_duration_ms,active_agents,slo_compliance,total_cost}, task_trend[], status_distribution[], agent_utilization[], cost_trend[], top_failures[], workflow_durations[] }` |
| Actions | `get_metrics(scope, time_range)` · `get_kpis(scope)` · `get_trend(metric, time_range)` · `export_report(format)` |
| Query Keys | `["dashboard", "metrics", scope, timeRange]` · `["dashboard", "kpis", scope]` · `["dashboard", "trend", metric, timeRange]` |
| Permission | L1: Personal dimension read-only; L2: Domain dimension; L3: Full platform; L4: Cross-region + capacity prediction |
| WS Needs | `dashboard.metric_updated` (delta push, avoid full polling) |
| Offline Rule | The loaded chart data allows stale display (with "data as of HH:mm" mark); the export must be online |
| API Endpoint | `GET /api/v1/dashboard/metrics` · `GET /api/v1/dashboard/kpis` · `GET /api/v1/dashboard/trend/{metric}` · `POST /api/v1/dashboard/export` |
| Authoritative Source | `MissionControlService` (aggregation layer) + `CostTrackingService` + `AgentRegistryService` |
| Derived Source | All indicators are aggregated projections, not original facts; original facts are distributed in each P2-P5 plane service |
| Projection Owner | Front-end `feature-analytics` module |

### 4.7.8 ConfigurationCenter _(v3.0 new)_
| Dimensions | Definition |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO | `{ user_preferences{locale,timezone,theme,notifications}, roles[], feature_flags[], model_configs[], domains[], tenants[], webhooks[], recent_changes[] }` |
actions + test + view_log |
| Query Keys | `["settings", "preferences"]` · `["settings", "roles"]` · `["settings", "flags"]` · `["settings", "models"]` · `["settings", "domains", id]` · `["settings", "tenants"]` · `["settings", "webhooks"]` |
| Permission | authenticated: preference; org_admin: permission+tenant; domain_admin: model+domain+Webhook; platform_sre: function switch+all |
| WS Needs | `config.updated` (notify other online users that the configuration has changed) |
| Offline Rule | Preference allows offline cache reads; all write operations must be online; configuration changes require optimistic locking (`If-Match` ETag) |
| API Endpoint | `GET/PUT /api/v1/user/preferences` · `CRUD /api/v1/admin/roles` · `CRUD /api/v1/admin/feature-flags` · `CRUD /api/v1/admin/models` · `GET/PUT /api/v1/admin/domains/{id}` · `CRUD /api/v1/admin/tenants` · `CRUD /api/v1/admin/webhooks` |
| Authoritative Source | `admin-routes` (src/sdk/cli/admin/) + `UserPreferenceService` + `DomainConfigService` |
| Derived Source | `DomainUIConfig` (§6.1.2) The front-end projection set for the domain |
| Projection Owner | Front-end `feature-settings` module |

---

# Part IV — Data and Communications

---

# 5. Data flow, API integration and real-time layer

> **Improvement points A-2, A-3, D-1**: Distinguish between Implemented/Planned API endpoints; layer by actual back-end WebSocket events; clarify the three-tier Web offline strategy. v2.3 adds API Layer classification (§5.2.3) and Mutation idempotence specification (§5.6.4).

## 5.1 State management architecture

**Status Classification**:

| Status Categories | Management Tools | Lifecycle | Persistence | Examples |
| ---------- | --------------- | --------------- | ------ | ---------------------------------- |
| App Status | Zustand | App Lifecycle | Yes | user, token, theme, locale, sidebar |
| Server status | TanStack Query | By staleTime | Optional | tasks, approvals, agents, dashboard |
| Live status | Zustand + WS | WebSocket connection | No | wsStatus, eventBuffer, subscriptions |
| Form status | React Hook Form | Page life cycle | No | Create tasks, approval decisions, domain configuration and other forms |
| URL status | React Router | Route life cycle | URL | Filter conditions, paging cursor, current label |

```text
┌───────────────────────────────────────────────────────────┐
│ UI state management layering │
│ │
│ ┌──────────────────┐ ┌─────────────────────────────────┐ │
│ │ Client State │ │ Server State │ │
│ │ (Zustand 5) │ │ (TanStack Query v5) │ │
│ │ │ │ │ │
│ │ • UI Status │ │ • Task/Approval/Kanban Data │ │
│ │ • Theme Preferences │ │ • Auto Caching + Deduplication │ │
│ │ • Sidebar collapse │ │ • Background refresh + optimistic update │ │
│ │ • Conversation context │ │ • Offline persister │ │
│ └────────┬─────────┘ └────────────┬───────────────────────┘ │
│ │ │ │
│ ┌────────┴────────────────────────┴──────────────────────┐ │
│ │ Realtime Layer (WebSocket → Store sync) │ │
│ │ WS event → invalidateQueries() / directly update Zustand store │ │
│ └───────────────────────────────────────────────────────┘ │
│ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Offline Layer (sync-store + offline-queue) │ │
│ │ Queuing of offline operations → Connection recovery → Sequential replay → Conflict resolution │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**Zustand Store Division**:

| Store | Responsibilities | Persistence |
| ---------------- | ---------------------------------------- | ---------------- |
| `auth-store` | Authentication status, current user, permission cache | Secure storage (L4) |
| `ui-store` | Theme, sidebar, current routing state, layout preferences | localStorage |
| `sync-store` | Offline queue status, synchronization progress, conflict list | offlineStore(L4) |
| `realtime-store` | WebSocket connection status, subscription list, event buffer | Memory |

### 5.1.1 Zustand Store interface definition

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

interfaceUIState {
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

### 5.1.2 TanStack Query staleTime strategy

| Data type | staleTime | gcTime | Reason |
| ---------- | ---------- | ------ | ----------------------- |
| Kanban indicator | 30s | 5min | Frequent changes, near real-time required |
| Task list | 2min | 30min | Medium frequency changes |
| Task details | 1min | 30min | The current task that the user is paying attention to must be newer |
| Approval list | 30s | 10min | High timeliness requirements |
| Agent list | 5min | 30min | Changes infrequently |
| Configuration data | 1h | 24h | Very few changes |
| Market List | 10min | 1h | Changes infrequently |
| Cost data | 5min | 30min | Certain timeliness |

### 5.1.3 QueryClient global default configuration

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

### 5.1.4 Offline persistence

Mobile and desktop use TanStack Query's `persistQueryClient` to persist the query cache to L4 storage:

```text
TanStack Query Cache
  │
  └─ persistQueryClient(
persister: createSyncStoragePersister({
         storage: L4.secureStorage // Web: IndexedDB, desktop: SQLite, RN: AsyncStorage
       }),
       maxAge: 24 * 60 * 60 * 1000 // 24h
     )
```

### 5.1.5 Data flow mode

```text
User action
  │
  ▼
┌────────────┐ ┌────────────┐ ┌─────────────┐
│ UI Components │────▶│ Mutation │────▶│ REST API │
│ (trigger) │ │ (optimistic update) │ │ (actual request) │
└────────────┘ └─────┬─────┘ └─────┬──────┘
                         │ │
                  Instant updates │ │ Server response
                         ▼ ▼
                  ┌────────────┐ ┌────────────┐
                  │ Local Cache │ │ Cache Update │
                  │ (immediate feedback) │ │ or rollback │
                  └────────────┘ └─────────────┘

WebSocket events (server push)
  │
  ▼
┌────────────┐ ┌────────────┐ ┌─────────────┐
│ WS Client │────▶│ Event Routing │────▶│ Query Cache │
│ (Receive) │ │ (Distribute) │ │ Expire/Update │
└────────────┘ └───────────┘ └─────┬───────┘
                                            │
                                            ▼
                                     UI auto-refresh
```

### 5.1.6 ViewModel mapping specification (DTO → VM → Props anti-corruption layer)

The UI layer introduces three layers of data conversion in `shared/api-client` to isolate the impact of back-end DTO changes on UI components:

```text
Backend REST/WS ──→ DTO (api-client/types/) ──→ ViewModel (shared/viewmodels/) ──→ Props (features/*/components/)
                  │ │ │
                  │ Mapping back-end JSON as is │ Business semantic conversion + field renaming │ Pure display type, no optional fields
                  │ Field name/type consistent with backend │ Add derived fields (such as isOverdue) │ All fields required
                  │ Automatically generated by openapi-ts │ Handwritten + unit test coverage │ Defined by components
```

**Level Responsibilities**:

| Hierarchy | Location | Generation method | Allowed transformations | Prohibited behaviors |
| ---------- | ---------------------------------- | ---------------- | --------------------------------------------------------------- | ---------------------------------- |
| DTO | `shared/api-client/types/` | openapi-ts build | None (with backend OpenAPI schema 1:1) | Manually modify the build file |
| ViewModel | `shared/viewmodels/` | Handwritten mapper function | Field renaming, type conversion, derived fields, null default values, enumeration mapping | Calling API, side effects, referencing UI framework |
| Props | `features/*/components/*.ts` | Component definition | Display formatting (date/number/status copy) | Reference DTO type, directly hold API response |

**Mapper function specification**:

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

- DTO layer disallows manual editing - only regenerated from backend OpenAPI spec via `openapi-ts`
- ViewModel mapper must have corresponding unit tests to cover null values, boundary enumeration, and time zone conversion
- Component Props must not appear `| undefined` - all optionality is eliminated in VM mapper
- Hooks in Feature module (such as `useTaskList`) return VM array and do not return DTO

## 5.2 REST API endpoint mapping (Implemented vs Planned)

> **Improvement point A-2**: Backend http-server routing cross-validation results; v2.3 adds API Layer annotation and Public UI API Surface layering.

### 5.2.1 Implemented endpoint [Implemented] (including API Layer annotation)

| UI Features | Backend Route Files | Endpoint Examples | Methods | State | API Layer |
| ---------------- | ------------------------ | ------------------------------------ | ---------- | ------------------------ | ---------- |
| Task CRUD | `task-routes.ts` | `/api/v1/tasks`, `/api/v1/tasks/:id` | GET/POST | [Implemented/Contracted] | Layer C |
| Approval operations | `admin-routes.ts` | `/api/v1/approvals/:id` | POST | [Implemented/Contracted] | Layer C |
| Dashboard data | `dashboard-routes.ts` | `/api/v1/dashboard/*` | GET | [Implemented/Contracted] | Layer C |
| Console page | `console-routes.ts` | `/console/*` | GET (HTML) | [Implemented/Internal] | Layer B |
| Admin Management | `admin-routes.ts` | `/admin/v1/*` | CRUD | [Implemented/Contracted] | Layer B/C |
| Contract version verification | `meta-routes` | `/api/v1/meta/contract-version` | GET | [Implemented/Contracted] | Layer C |
| Mission Control | `mission-control-service` | Exposed via console-routes | GET | [Implemented/Internal] | Layer A→C |
| Operator Console | `console-backend/` | Snapshot/Approval Queue/Worker Panel/Incident | GET | [Implemented/Internal] | Layer A→C |

### 5.2.2 Planned endpoint [Planned] (API enhancement requirements)

| UI Features | Suggestion Endpoints | Methods | Data Source Suggestions | Status | Priority |
| -------------- | -------------------------------- | ------- | --------------------------------------------- | --------- | ------ |
| Agent Management | `/api/v1/agents` | CRUD | AgentRegistry + AgentLifecycleService | [Planned] | P1 |
| Workflow CRUD | `/api/v1/workflows` | CRUD | OrchestrationPlane workflow storage | [Planned] | P1 |
| Marketplace | `/api/v1/marketplace` | GET | MarketplaceService (scale-ecosystem/) | [Planned] | P2 |
| Explainability Query | `/api/v1/explanations` | POST | ExplainabilityService (ops-maturity/) | [Planned] | P2 |
| Cost data | `/api/v1/costs` | GET | CostService (ops-maturity/) | [Planned] | P2 |
| Dashboard Metrics | `/api/v1/dashboard/metrics` | GET | DashboardProjectionService | [Planned] | P1 |
| Dashboard KPI | `/api/v1/dashboard/kpis` | GET | MissionControlService aggregate | [Planned] | P1 |
| Dashboard Trends | `/api/v1/dashboard/trend/{m}` | GET | DashboardProjectionService | [Planned] | P2 |
| Dashboard export | `/api/v1/dashboard/export` | POST | DashboardProjectionService | [Planned] | P2 |
| Task Evidence | `/api/v1/tasks/:id/evidence` | GET | StateEvidencePlane | [Planned] | P1 |
| Task Timeline | `/api/v1/tasks/:id/timeline` | GET | StateEvidencePlane event log | [Planned] | P1 |
| Agent heartbeat | `/api/v1/agents/{id}/heartbeats` | GET | AgentRegistryService | [Planned] | P2 |
| Agent Metrics | `/api/v1/agents/{id}/metrics` | GET | AgentRegistryService | [Planned] | P2 |
| User Preferences | `/api/v1/user/preferences` | GET/PUT | UserPreferenceService | [Planned] | P1 |
| Role management | `/api/v1/admin/roles` | CRUD | admin-routes | [Planned] | P1 |
| Feature switch | `/api/v1/admin/feature-flags` | CRUD | admin-routes | [Planned] | P1 |
| Model configuration | `/api/v1/admin/models` | CRUD | admin-routes + ModelConfigService | [Planned] | P1 |
| Domain Configuration | `/api/v1/admin/domains/{id}` | GET/PUT | DomainConfigService | [Planned] | P1 |
| Tenant management | `/api/v1/admin/tenants` | CRUD | admin-routes | [Planned] | P2 |
| Webhook Management | `/api/v1/admin/webhooks` | CRUD | admin-routes | [Planned] | P2 |

### 5.2.3 Public UI API Surface layering _(new in v2.3)_

In order to eliminate the ambiguity that "a certain service/route exists in the backend" is equivalent to "the frontend can be stably integrated", this section divides the backend API into three strict levels. The front-end can only consume **Layer C (Public Contract Endpoint)**; consumption of Layer A/B requires the back-end team to explicitly upgrade to Layer C.

| Hierarchy | Definition | Front-end consumable | Example |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| **Layer A — Service Method** | Method of the backend TypeScript service class, only callable within the process, no HTTP exposure | ❌ | `MissionControlService.getSnapshot()` (service method) |
| **Layer B — Internal Route** | Exposed through HTTP route but facing internal console/HTML page, no public JSON schema, no versioning guarantee | ⚠️ Confirmation required | `GET /console/*` (HTML page) · `/admin/v1/*` (partial HTML) |
| **Layer C — Public Contract EP** | JSON API for external consumers, with OpenAPI spec, versioned paths, stable request/response schema | ✅ | `GET /api/v1/tasks` · `POST /api/v1/tasks` · `GET /api/v1/dashboard/*` |

**Current hierarchical ownership of each data source**:

| Data source | Current level | Target level | Upgrade action |
|------------------------------------------------ | --------- | -------- | --------------------------------------------------------------- |
| `GET /api/v1/tasks` · `POST /api/v1/tasks` | Layer C | Layer C | No need to change, already OpenAPI spec |
| `POST /api/v1/approvals/:id` | Layer C | Layer C | No changes required |
| `GET /api/v1/dashboard/*` | Layer C | Layer C | No changes required |
| `MissionControlService.*` | Layer A | Layer C | Need to add `GET /api/v1/mission-control/*` JSON route + OpenAPI |
| `OperatorConsoleBackendService.*` | Layer A | Layer C | Need to add `GET /api/v1/operator/*` JSON route + OpenAPI |
| `GET /console/*` | Layer B | Layer B | remains an internal HTML entry and is not consumed directly by the front end |
| `GET /admin/v1/*` | Layer B/C | Layer C | Part of the JSON response (Contracted); the HTML part is marked Internal |
| `CRUD /api/v1/agents` (Planned) | — | Layer C | Designed directly according to Layer C standards |
| `CRUD /api/v1/workflows` (Planned) | — | Layer C | Directly designed according to Layer C standards |
| `GET /api/v1/marketplace` (Planned) | — | Layer C | Designed directly according to Layer C standards |
| `POST /api/v1/explanations` (Planned) | — | Layer C | Designed directly according to Layer C standards |
| `GET /api/v1/costs` (Planned) | — | Layer C | Designed directly according to Layer C standards |

**Front-end consumption rules**:

- Each function in the front-end `api-client/endpoints/*.ts` must declare the Layer level of its target endpoint
- Layer A/B endpoints are marked with `@internal` in the code and are prohibited from being directly referenced in the feature module.
- If the feature module requires Layer A/B data, it must provide a temporary mock through `mock-server` and create an "upgrade to Layer C" story in the backlog
- Phase 1 Gate 0 preconditions are added: all Phase 1 consumer endpoints must reach Layer C

### 5.2.4 Internal → Contracted upgrade list (API Graduation Matrix) _(new in v3.0)_

The front end should not stay on the Internal surface for long periods of time. The following table tracks the upgrade status of each Layer A/B data source, identifying the prerequisites and target milestones required to upgrade to Layer C.

| Source Service | Route / Method | Current Layer | Target Layer | Required Schema | Required Auth Model | Required Versioning | Required Tests | Target Milestone | Status |
| ---------------------------------- | ---------------------------------- | ------------- | ---------- | -------------------------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- | --------------- | ---------- |
| `MissionControlService` | `.getSnapshot()` | A | C | `MissionControlSnapshotDTO` (JSON Schema) | Bearer JWT + RBAC L2+ | `/api/v1/` | unit + integration + contract | Phase 1 Gate 1 | Pending |
| `MissionControlService` | `.getTaskCockpit()` | A → C (done) | C | — | — | — | — | — | Graduated |
| `MissionControlService` | `.getWorkflowCockpit()` | A | C | `WorkflowCockpitDTO` (JSON Schema) | Bearer JWT + RBAC L2+ | `/api/v1/` | unit + integration + contract | Phase 1 Gate 2 | Pending |
| `MissionControlService` | `.getStabilityPanel()` | A | C | `StabilityPanelDTO` (JSON Schema) | Bearer JWT + RBAC L3+ (SRE) | `/api/v1/` | unit + integration + contract | Phase 2 Gate 1 | Pending |
| `MissionControlService` | `.getAdminTakeoverConsole()` | A | C | `AdminTakeoverDTO` (JSON Schema) | Bearer JWT + RBAC L4 (admin) | `/api/v1/` | unit + integration + security | Phase 2 Gate 1 | Pending |
| `OperatorConsoleBackendService` | `.getSnapshot()` | A | C | `OperatorSnapshotDTO` (JSON Schema) | Bearer JWT + RBAC L3+ | `/api/v1/` | unit + integration + contract | Phase 2 Gate 1 | Pending |
| `OperatorConsoleBackendService` | `.getIncidentTimeline()` | A | C | `IncidentTimelineDTO` (JSON Schema) | Bearer JWT + RBAC L2+ | `/api/v1/` | unit + integration + contract | Phase 1 Gate 2 | Pending |
| `OperatorConsoleBackendService` | `.getWorkerPanel()` | A | C | `WorkerPanelDTO` (JSON Schema) | Bearer JWT + RBAC L3+ | `/api/v1/` | unit + integration | Phase 2 Gate 2 | Pending |
| `OperatorConsoleBackendService` | queue API | A | C | `QueueStatusDTO` (JSON Schema) | Bearer JWT + RBAC L3+ | `/api/v1/` | unit + integration | Phase 2 Gate 2 | Pending |
| Console routes | `GET /console/*` | B | B | — (keep internal HTML entry) | — | — | — | — | N/A |
| Admin routes | `GET /admin/v1/*` (HTML portions) | B | B/C | The existing JSON portion remains C; the HTML portion is marked Internal | — | — | — | — | Partial |
| `DomainOnboardingService` | interaction/ux/onboarding/ | A | C | `DomainOnboardingDTO` (JSON Schema) | Bearer JWT + RBAC L2+ | `/api/v1/` | unit + integration + contract | Phase 2 Gate 1 | Pending |
| `NLEntryService` + `IntentParser` | conversation API | A (Partial) | C | `ConversationDTO` + `IntentDTO` (JSON Schema) | Bearer JWT + RBAC L1+ | `/api/v1/` | unit + integration + NLU regression | Phase 1 Gate 2 | Pending |

**Upgrade process**:

1. **Backend API owner** creates upgrade story → add JSON route + OpenAPI spec + request/response schema
2. **Backend QA** supplements contract test + integration test
3. **Architecture Review** Confirm schema freeze in Sprint Review → Subtag updated from `Internal` / `Partial` to `Contracted`
4. **Front-end team** switch from mock-server to real endpoint and remove `@internal` annotation
5. **Gate Check** Before corresponding to the Phase Gate, all endpoints required by the Gate must reach the `Graduated` state

## 5.3 WebSocket real-time event mapping

> **Improvement point A-3**: Stratification based on actual backend implementation.

### 5.3.1 Implemented event [Implemented] (WebSocketBridge + TaskWebSocketStatusRelay)

Event types supported by the backends `TaskWebSocketEvent` and `WebSocketBridge`:

| Backend event type | Trigger timing | UI response | TanStack Query strategy | Status |
| -------------------- | ---------------- | -------------------------------- | ---------------------------------- | ---------------- |
| `status_changed` | Task status change | Task card status logo update | `invalidateQueries(['tasks'])` | [Implemented] |
| `progress` | Step progress update | Step progress bar advancement | Direct update cache | [Implemented] |
| `message_delta` | LLM streaming output delta | Speech bubble append text in real time | Direct update Zustand | [Implemented] |
| `artifact_ready` | Artifact generation completed | Artifact card appears | `invalidateQueries(['tasks', id])` | [Implemented] |
| `approval_requested` | Manual approval required | Approval notification pop-up window + Badge count | `invalidateQueries(['approvals'])` | [Implemented] |
| `completed` | Task completed | Task card marked completed | `invalidateQueries(['tasks'])` | [Implemented] |
| `failed` | Task failed | Task card marking failed + warning | `invalidateQueries(['tasks'])` | [Implemented] |

### 5.3.2 Need to expand events [Planned] (UI requirements → Backend enhancement)

| UI event types | UI responses | Backend extension recommendations | Status | Priority |
| ---------------------------- | ---------------------------- | ---------------------------- | ---------- | ------ |
| `approval.resolved` | Approval card status update | WebSocketBridge adds approval result broadcast | [Planned] | P1 |
| `agent.health_changed` | Agent health indicator changes color | AgentRegistry health change event | [Planned] | P2 |
| `incident.created` | Global alert banner | IncidentService event broadcast | [Planned] | P1 |
| `dashboard.metric_updated` | Kanban value/chart refresh | DashboardProjectionService delta push | [Planned] | P2 |
| `panic.activated` | Global emergency braking mask | PanicService event broadcast | [Planned] | P1 |
| `hitl.intervention_required` | HITL full-screen intervention panel | HITL notification module event expansion | [Planned] | P1 |
| `nl.clarification_needed` | NL dialogue question bubble | NLEntryService question event | [Proposed] | P2 |
| `cost.budget_alert` | Budget Alert Toast | CostService Budget Event | [Proposed] | P3 |
| `drift.alert` | Drift alarm notification | DriftDetector event broadcast | [Proposed] | P3 |
### 5.3.2.1 WSEventRouter complete architecture

```text
┌────────────────────────────────────────────────────┐
│ WSEventRouter │
│ │
│ WebSocket /ws/v1/stream │
│ │ │
│ ▼ │
│ ┌────────────────────┐ │
│ │ Heartbeat Manager │ Ping every 30s, no pong for 45s=disconnected │
│ └─────────────────────┘ │
│ │ │
│ ▼ │
│ ┌────────────────────┐ │
│ │ Event parser │ JSON → typed Event │
│ └─────────────────────┘ │
│ │ │
│ ▼ │
│ ┌────────────────────────────────────────────┐ │
│ │ Event Dispatcher │ │
│ │ │ │
│ │ task.status_changed → Task cache invalidation │ │
│ │ task.step_completed → step progress update │ │
│ │ approval.requested → Approval Badge +1 │ │
│ │ approval.resolved → Approval cache invalidated │ │
│ │ agent.health_changed → Agent health update │ │
│ │ incident.created → Global Alert Banner │ │
│ │ dashboard.metric_updated → Dashboard data refresh │ │
│ │ hitl.intervention_required → HITL pop-up │ │
│ │ panic.activated → emergency braking mask │ │
│ │ drift.alert → Drift alarm notification │ │
│ │ cost.budget_alert → Budget Alert Toast │ │
│ │ debug.breakpoint_hit → debugger pauses │ │
│ └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5.3.2.2 Event → Query cache mapping

| Event type | Query cache operation | UI update method |
| -------------------------- | ---------------------------------- | ------------- |
| `task.status_changed` | invalidate `taskKeys.list` | List automatically refreshed |
| `task.step_completed` | Directly update `taskKeys.detail(id)` | Progress bar advancement |
| `approval.requested` | invalidate `approvalKeys.list` | List refresh + Badge |
| `approval.resolved` | invalidate `approvalKeys.list` | List refresh |
| `agent.health_changed` | Directly update agent health field | Health indicator light changes color |
| `dashboard.metric_updated` | Directly update dashboard query data | Chart/numeric refresh |
| `incident.created` | Write to RealtimeStore.activeIncidents | Global banner display |
| `panic.activated` | Write to RealtimeStore.panicActivated | Full screen mask |

### 5.3.2.3 Emergency incident handling

The following events have the highest priority and are responded to immediately regardless of the current page status:

| Events | UI Response | Priority |
| ---------------------------------- | ---------------------------------- | ------ |
| `panic.activated` | Full screen red mask + emergency braking prompt | SEV1 |
| `incident.created` (SEV1) | Global top warning banner + push notification | SEV1 |
| `hitl.intervention_required` | Full screen HITL intervention panel (desktop) / push (mobile) | SEV2 |
| `approval.requested` (Critical) | Approval pop-up window + sound prompt + vibration | SEV2 |

### 5.3.3 WebSocket connection management

```text
Connection strategy:
1. Authentication: JWT token as ws handshake auth parameter (consistent with the existing implementation of WebSocketBridge)
2. Disconnection and reconnection: exponential backoff (1s → 2s → 4s → 8s → 16s → 30s max) + random jitter
3. Heartbeat keep-alive: send ping every 30s, no pong for 45s is considered disconnected (consistent with DashboardWebSocketServer)
4. Multi-tab page: SharedWorker (Web)/single case connection (desktop/mobile) to avoid repeated connections
5. Offline buffering: Events are buffered to L4 offlineStore during disconnection and played back in sequence after reconnection.
6. Subscription management: dynamically subscribe/unsubscribe event channels according to the current page/view to reduce bandwidth
7. Align with gateway_streaming_contract.md:
   - Chunk commit, catch-up, and backlog drain are adaptive according to queue pressure and message age.
   - catch-up does not disrupt the order of messages
   - Do not destroy readability through single-frame brute force flushing
```

### 5.3.4 SharedWorker WebSocket architecture (Web side)

The web side uses SharedWorker to share a single WebSocket connection between multiple tabs to avoid repeated connections and bandwidth waste:

```text
┌──────────┐ ┌──────────┐ ┌───────────┐
│ Tab 1 │ │ Tab 2 │ │ Tab 3 │
│ (Tasks) │ │(Approval)│ │(Dashboard│
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │ MessagePort │ MessagePort │
     └──────────────┼───────────────┘
                    │
         ┌──────────┴──────────┐
         │ SharedWorker │
         │ │
         │ ┌───────────────┐ │
         │ │ WSClient │ │ Single WebSocket connection
         │ │ (ws/v1/stream)│──┼──→ Platform Backend
         │ └───────┬───────┘ │
         │ │ │
         │ ┌───────┴───────┐ │
         │ │ PortRouter │ │ Distribute events to each Tab by subscription
         │ │ Tab1→[tasks] │ │
         │ │ Tab2→[approvals]│ │
         │ │ Tab3→[dashboard]│ │
         │ └───────────────┘ │
         └─────────────────────┘
```

| Strategy | Web (SharedWorker) | Desktop | Mobile |
| ------------- | ----------------------------------------------- | ------------------ | ----------------------- |
| Multi-tab/multi-window | SharedWorker shares a single connection | Main process singleton connection | Singleton connection |
| Background policy | visibilitychange → reduce push frequency | minimize → keep only heartbeats | background → disconnect + FCM/APNs |
| Disconnection and reconnection | Exponential backoff (1s→30s) + jitter | Same as Web | Same as Web |
| Offline buffering | IndexedDB buffering | SQLite buffering | SQLite buffering |
| Fallback | SharedWorker is not supported → downgrade to main thread WebSocket | N/A | N/A |

### 5.3.5 SSE Fallback

The backend `StreamBridge` provides an SSE endpoint as a fallback solution when WebSocket is unavailable:

```text
WebSocket unavailable judgment:
  - Enterprise proxy/firewall blocking ws upgrade
  - 3 failed connection attempts
  ↓
Downgrade to SSE (Server-Sent Events):
  - GET /api/v1/stream (Accept: text/event-stream)
  - The event format is consistent with WebSocket payload
  - Loss of two-way communication (operations still via REST)
  ↓
SSE is also not available:
  - Downgrade to 30s polling
  - UI displays "Real-time updates are not available" prompt
```

### 5.3.6 WebSocket subscription domain model

The UI adopts a channelized subscription model. The relevant channels are subscribed when the page is entered and automatically canceled when exiting, reducing bandwidth and back-end broadcast overhead:

**Channel Category**:

| Channel Category | Channel Format | Life Cycle | Event Example | Status |
| ---------- | ----------------------- | ------------------ | ------------------------------------------ | ------------- |
| Global channel | `global` | Login→Logout | `panic.activated`, `incident.created` | [Implemented] |
| Task channel | `task:{taskId}` | Enter details→Leave | `status_changed`, `progress`, `completed` | [Implemented] |
| Workflow channel | `workflow:{workflowId}` | Enter details→Leave | `step_completed`, `workflow_finished` | [Planned] |
| Approval channel | `approvals` | Enter the approval center → leave | `approval_requested`, `approval.resolved` | [Implemented] |
| Management channel | `admin:{scope}` | Enter the management panel→Exit | `agent.health_changed`, `worker.status` | [Planned] |
| Dashboard channel | `dashboard` | Enter the dashboard→Leave | `dashboard.metric_updated` | [Planned] |

**Subscription Lifecycle Rules**:

```text
Page entry (useEffect mount)
  │
  ├─→ subscribe(channels[]) // Register the channel with SharedWorker/WSManager
  │
  ├─→ Receive events → Update TanStack Query cache / Zustand store
  │
  └─→ Page exit (useEffect cleanup)
        │
        └─→ unsubscribe(channels[]) // Cancel channel subscription
```

**Downgrade Strategy**:

| Scene | Behavior |
| ----------------------- | --------------------------------------------------------------- |
| Backend tab (Web) | `visibilitychange` hidden → keep `global` channel, cancel page-level channel |
| Backend tab (desktop) | Minimize → Same as Web logic |
| Mobile terminal enters the background | `lifecycle.onBackground` → Disconnect WS and switch to FCM/APNs push |
| Mobile client restores the foreground | `lifecycle.onForeground` → Rebuild WS connection + catch-up to pull missing events |
| The tab has been inactive for more than 5 minutes | Disconnect page-level channels and only keep global channels + 60s heartbeat |

## 5.4 API communication layer architecture

```text
┌────────────────────────────────────────────────┐
│ RESTClient │
│ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Interceptor Chain │ │
│ │ AuthInterceptor → JWT automatic refresh │ │
│ │ TenantInterceptor → tenant_id/domain injection │ │
│ │ RetryInterceptor → exponential backoff + jitter │ │
│ │ DedupeInterceptor → Request deduplication │ │
│ │ OfflineInterceptor → Offline queuing (mobile) │ │
│ │ TraceInterceptor → X-Request-Id/Trace-Id │ │
│ └───────────────────────────────────────────────┘ │
│ │
│ Transport: L4 PlatformAdapter.fetch() │
│ (Web=fetch / Electron=net / Tauri=reqwest / │
│ RN=fetch) │
└────────────────────────────────────────────────┘
```

### 5.4.1 RESTClient core interface `[Planned]`

> _Extracted from Doc-11 §6.1.1 — RESTClient Design_

```typescript
interface RESTClient {
  get<T>(path: string, params?: QueryParams): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}
```

The Transport layer provides specific implementation by L4 `PlatformAdapter.fetch()` through dependency injection. RESTClient itself does not call `fetch` directly.

### 5.4.2 WebSocket Client interface `[Planned]`

> _Extracted from Doc-11 §6.1.2 — WebSocket Client Design. Complementing the §5.3 WebSocket layer: §5.3 Defines the channel model and subscription fields, this section defines the client programming interface. _

```text
Connection life cycle:
  DISCONNECTED → CONNECTING → CONNECTED → SUBSCRIBED
       ↑ │ │ │
       └───────────────┴── Disconnected ────┘ │
↑ │
                              └── Heartbeat timeout ────┘
Reconnection strategy:
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

### 5.4.3 Endpoint function mode `[Planned]`

> _Extracted from Doc-11 §6.1.3 — Each API endpoint is encapsulated as an independent function, returning TanStack Query compatible configuration. _

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

- An endpoint = a function + corresponding query key factory
- Function receives `RESTClient` instance (convenient for testing mocks)
- Return type aligned with backend OpenAPI spec (see Appendix A)

### 5.4.4 Authentication process and Token management `[Planned]`

> _Extracted from Doc-11 §6.2 — Auth Module. Complementary to §6.5 security architecture: §6.5 defines security policies, and this section defines the client authentication implementation process. _

```text
App start
  │
  ├─ Check if there is refresh_token in SecureStorage
  │ ├─ Yes → Try to refresh access_token silently
  │ │ ├─ Success → Enter Authenticated state
  │ │ └─ Failure → Jump to login page
  │ └─ None → Jump to login page
  │
  Login page
  ├─ SSO (OIDC) → System browser OAuth2 PKCE process → Callback to obtain tokens
  ├─ SSO (SAML) → System browser SAML process → Callback to obtain tokens
  └─ API Key → Direct input (development mode/CLI mode only)
  │
  Tokens are stored in L4 SecureStorage → enter Authenticated state
```

| Strategy | Description |
| -------- | --------------------------------------------------------------------- |
| Automatic refresh | Access_token triggers silent refresh 60s before expiration, no perception |
| Refresh lock | When concurrent requests find that the token has expired, only the first one triggers the refresh, and the rest are queued to wait |
| Refresh failed | Return 401 → Clear local token → Redirect login page → Save current route for recovery after login |
| Multi-device | Support viewing active session list → Selective revocation |
| Two-step authentication | High-risk operations (approval Critical, modifying security settings) trigger biometric/password two-step verification |

### 5.4.5 Offline queue and synchronization coordinator `[Planned]`

> _Extracted from Doc-11 §6.3 — Sync Engine. Complementary to §5.5 offline architecture: §5.5 defines the offline layering strategy, this section defines the queue record structure and conflict resolution. _

**Queue record structure**:

| Field | Type | Description |
|---------------- | ----------- | ------------------------------------------------------------------ |
| `id` | ULID | Globally unique identifier |
| `method` | HTTP Method | POST / PUT / PATCH / DELETE |
| `path` | string | API path, such as `/api/v1/tasks` |
| `body` | JSON | Request body |
| `idempotencyKey` | string | Idempotent key to prevent repeated submissions |
| `createdAt` | ISO-8601 | Creation time |
| `retryCount` | number | Current number of retries |
| `status` | enum | `pending` / `syncing` / `synced` / `conflict` / `failed` |

**SyncCoordinator recovery process**: Success → `synced` → Notify UI | 409 → `conflict` → Conflict resolution UI | 500 → Retry (max 3) → `failed` → Notify user.

**Conflict Resolution Strategies**:

| Data Type | Strategy |
| -------------- | ------------------------------------------------------------------ |
| Task creation | No conflicts (idempotent key protection) |
| Approval decision | The server takes priority (first come, first served). In case of conflict, the user is notified that "the approval has been processed by others" |
| Configuration changes | Server priority + CAS version number check, double column diff displayed in case of conflict |
| Agent status change | The server takes priority. In case of conflict, the user is notified to refresh and try again |

### 5.4.6 Paging and filtering standardization

All list interfaces uniformly use the backend's cursor-based paging:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  totalCount?: number;
}

interface QueryParams {
  cursor?: string;
  limit?: number; //Default 20, maximum 100
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

## 5.5 Offline and synchronization architecture

> **Improvement point D-1**: Clarify the three-tier offline strategy for the Web side.

### 5.5.1 Web side offline three-layer strategy

| Hierarchy | Technology | Caching Content | Strategy |
| --------------- | ---------------------------------- | ---------------------------------- | ----------------------------------------------- |
| L1 static resource cache | Service Worker Cache | JS/CSS/images/fonts | Cache-First, versioned hash |
| L2 API response cache | TanStack Query persist + IndexedDB | Task list/approval list/kanban snapshot | Network-First + Stale-While-Revalidate |
| L3 operation queue | IndexedDB (offline-queue) | Operations to be sent (approve/cancel, etc.) | FIFO queue, replayed in order after connection is restored |

**Key Constraints**:

- L2 cache data does not contain PII (see `00-platform-architecture.md` data classification policy)
- Operations in the L3 queue have idempotency keys to prevent repeated submissions
- Separation of responsibilities between Service Worker and TanStack Query: SW manages static resources, TQ manages API data

### 5.5.2 Desktop offline strategy

| Platform | Offline storage | Synchronization mechanism |
| ------- | ---------------------------------- | ---------------------------------- |
| Windows | SQLite (better-sqlite3) via Electron | Electron main process scheduled synchronization + WS push |
| macOS | SQLite (rusqlite) via Tauri | Tauri Rust backend scheduled synchronization + WS push |
| Linux | SQLite (rusqlite) via Tauri | Same as macOS |

### 5.5.3 Mobile offline strategy

| Platform | Offline Storage | Background Synchronization | Conflict Resolution |
| ------- | ------------- | --------------------------------------- | -------------------------- |
| Android | SQLite (Room) | WorkManager background task + FCM wakeup | Last-Write-Wins + user selection |
| iOS | SQLite (GRDB) | BackgroundTasks framework + APNs wakeup | Same as Android |

### 5.5.4 Conflict Resolution Strategy

```text
Conflict detection:
- Operation carries version_vector (based on MissionControlService snapshot version)
  - The conflict resolution process is triggered when the server returns 409 Conflict

Conflict resolution priority:
  1. Automatic merge: non-conflicting fields are retained separately (such as modifying different fields in different tasks at the same time)
  2. Last-Write-Wins: low-risk operations (view, mark as read)
  3. User selection: high-risk operations (approval, cancellation, takeover) pop-up conflict panel
  4. Server authority: Operations involving authoritative status are always subject to the server
```

### 5.5.5 Offline storage capacity planning

| Data type | Storage method | Capacity limit | Expiration policy |
| ------------ | ------------------------------- | -------- | --------------- |
| User Configuration | SecureStorage / AsyncStorage | 1MB | Permanent |
| Task List Cache | SQLite/IndexedDB | 50MB | Cleanup after 30 days of no access |
| Kanban Snapshot | SQLite/IndexedDB | 10MB | 24h |
| Operation queue | SQLite/IndexedDB | 20MB | Post-sync cleanup |
| Translation file | File system | 5MB | Replace when version is updated |
| Offline NL model | File system (Edge-Mobile scenario only) | 500MB | Manual update |

**Capacity Monitoring**: L3 sync-store tracks various types of storage usage. When it exceeds the threshold, it automatically triggers LRU elimination and notifies users through Toast.

### 5.5.6 Offline operation permission matrix

Not all operations allow offline queuing. The following matrix defines the offline behavior of each type of operation:

| Operation category | Offline queuing | Optimistic update | Automatic replay after recovery | Conflict policy | Description |
| -------------------------- | -------- | -------- | ------------- | ------------------------ | ------------------------------------- |
| Mark as read | ✅ | ✅ | ✅ | Last-Write-Wins | Idempotent operations, no risk of conflicts |
| Task notes/comments | ✅ | ✅ | ✅ | Append merge | Append offline comments to the end of the timeline |
| Approval operation (approve/reject) | ❌ | ❌ | N/A | N/A | Approval is subject to timeliness, and "Internet operation required" is displayed when offline |
| Task canceled | ⚠️ | ❌ | ⚠️ Confirmation required | User selection | Queued but not optimistic about update, pop-up window confirmation after recovery |
| Admin Takeover | ❌ | ❌ | N/A | N/A | Emergency operations must be performed online |
| Panic emergency braking | ❌ | ❌ | N/A | N/A | Must be online, if offline it will prompt that it cannot be executed |
| Create a new task | ✅ | ✅ | ✅ | The server assigns the ID to replace the temporary ID | Optimistically generates the temporary ID and replaces it after synchronization |
| Modify task configuration | ⚠️ | ✅ | ⚠️ Version check | Version conflict → User selection | Bring version_vector, 409 time bomb conflict panel |
| View/Browse (read only) | ✅ | N/A | N/A | Use stale cache | Show cached data + "Offline data, may expire" |
| Marketplace installation | ❌ | ❌ | N/A | N/A | Need to download resources, must be online |
| Export report | ⚠️ | ❌ | ✅ | Queue, execute and notify after recovery | Generation may take time, queue until online and execute |

**UI prompt specifications**:

- Disable offline operations: the button is displayed as disabled + tooltip "requires network connection"
- Allow queuing operations: the button is available normally, and "Joined offline queue (No. N)" is displayed after clicking
- Operations that require confirmation: A confirmation dialog box will pop up when returning online. "The following operations are queued while offline. Do you want to continue executing?"

## 5.6 Front-end error classification and downgrade strategy

### 5.6.1 Error classification

| Level | Error type | Scope of impact | UI performance | Automatic recovery |
| ------ | ----------------------------------- | --------------- | --------------------------------------------------- | ----------- |
| **P0** | Authentication failed / Token cannot be refreshed | Global | Forced jump to login page + clear local status | ❌ |
| **P1** | API service unreachable (all endpoints 5xx/timeout) | Global | Global banner "Service is temporarily unavailable" + read-only stale cache mode | ✅ 30s retry |
| **P2** | WebSocket connection disconnected | Live updates | Status bar "Live updates not available" + Auto-downgrade SSE/Polling | ✅ Exponential backoff |
| **P3** | Single API endpoint failure (4xx/5xx) | Single page/module | Module-level error card "Loading failed, click to try again" + telemetry reporting | ✅ User trigger |
| **P4** | DomainUIConfig failed to load | Domain related pages | Use default configuration + Toast "Domain configuration failed to load, use default settings" | ✅ Background retry |
| **P5** | Feature flag is inconsistent | Single function | Hide the function of uncertain status + log reporting | ✅ Next refresh |
| **P6** | Contract version mismatch | Potential compatibility issues | Persistent banner warning + telemetry reporting + function not blocked | ❌ Upgrade required |
| **P7** | Stale cache display | Data timeliness | Data card corner mark "Cache data" + last update time | ✅ Automatic |

### 5.6.2 Degradation Behavior Matrix

| Failure scenarios | Immediate degradation behavior | Continuous degradation behavior (>60s) | Recovery behavior |
| --------------------------------- | -------------------------------- | ---------------------------------- | ---------------------------------- |
| REST API all unreachable | stale cache read-only + write operations disabled | Global Error Boundary + offline mode prompt | automatic revalidate all active query |
| Some endpoints of REST API are abnormal | The affected module displays ErrorCard | ErrorCard + background 30s retry | Automatically refresh the module after success |
| WebSocket disconnected | Downgrade to SSE | SSE also failed → Downgrade to 30s polling | Automatically switch back after WS recovery + catch-up |
| DomainUIConfig is missing | Default config fallback | Unchanged | Periodic retries in the background, hot replacement after success |
| Feature flag The service is unreachable | Use the last cached flag value | Unchanged | Silently update after recovery |
| Contract version mismatch | Persistent banner + normal functionality | Unchanged | Remove banner after version fix detected |
| IndexedDB / SQLite write failure | Downgrade to memory cache + Toast warning | Try to clean up expired data and try again | Write back memory data to the persistence layer after recovery |

### 5.6.3 Error Boundary Strategy

```text
App ErrorBoundary (P0/P1 level → global error page)
  └─ Layout ErrorBoundary (navigation still available)
       └─ Page ErrorBoundary (P3 level → page level ErrorCard)
            └─ Widget ErrorBoundary (P4-P7 level → component level fallback)
```

### 5.6.4 Mutation idempotent and retry specifications _(new in v2.3)_

The idempotence and retry semantics of write operations (Mutation) directly affect data consistency and user experience. The following specifications define the behavior of each type of critical write operation.

#### Mutation behavior matrix

| Operation | Idempotency | Idempotency Key | Front-end anti-repetition submission | Retry after failure | Retry method | UI status after failure |
| -------------------------- | ------------- | ---------------- | -------------------------- | -------------------------- | ------------- | ---------------- |
| Create task | ✅ Idempotent (key) | `ULID` | disable 5s after click | ✅ | Automatically retry ×3 | Revert to unsubmitted |
| Cancel task | ✅ Idempotent | `task_id` | Disable until response after click | ✅ | Manual retry button | Restore to pre-cancellation state |
| Approval approve | ✅ Idempotent | `approval_id` | Disable after click until response | ⚠️ Conditions | Only 5xx can be retried | Revert to pending approval |
| Approval reject | ✅ Idempotent | `approval_id` | Disable after click until response | ⚠️ Conditions | Only 5xx can be retried | Revert to pending approval |
| Approval delegate | ✅ Idempotent | `approval_id+to` | Disable after click until response | ✅ | Manual retry | Revert to pending approval |
| Admin Takeover | ❌ Non-idempotent | N/A | Double confirmation + disable | ❌ | Disable automatic retry | Show failure reason |
| Panic emergency braking | ✅ Idempotent | singleton | Double confirmation + disable | ✅ | Manual retry | Display braking failure alarm |
| Marketplace installation | ✅ Idempotent (key) | `pack_id+ver` | Progress bar + disable | ✅ | Automatic retry ×2 | Revert to not installed |
| Domain configuration modification | ⚠️ CAS | `domain_id+ver` | After clicking, disable until response | ⚠️ Conditions | 409→User selection | Show conflict diff |
| Worker management (switch/stop) | ❌ Non-idempotent | N/A | Confirmation popup + disable | ❌ | Disable automatic retry | Show failure reason |
| Task notes/comments | ✅ Idempotent (key) | `ULID` | Optimistic append + disable | ✅ | Automatic retry ×3 | Mark as "Send failed" |
| Export report | ✅ Idempotent | `export_id` | Progress bar | ✅ | Automatic retry ×2 | Notify user of export failure |

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
- Key generation strategy: `ULID` (create class operation) or `resource ID+version number` (update class operation) or `singleton` (global unique operation)
- Front-end `RESTClient` interceptor automatically injects idempotency key
- When the backend returns `409 Conflict`, the frontend prohibits automatic retry and must enter the conflict resolution process
- When the backend returns `429 Too Many Requests`, the frontend presses the `Retry-After` header to delay retry.
- Anti-repeated submission: After the mutation is triggered, the corresponding button is immediately `disabled` until the request is settled (success or final failure)

### 5.6.5 Optimistic update mode

Critical write operations use optimistic updates to improve experience:

| Operations | Optimistic update strategy | Rollback strategy |
| ---------- | ---------------------------------- | ---------------------------- |
| Create task | Immediately insert optimistic item at the head of the list | Remove optimistic item + Toast |
| Approval decision | Immediately move out of the pending approval list + update Badge count | Revert to pending approval + error prompt |
| Agent status | Update status label immediately | Restore original status + error message |
| Configuration changes | Update configuration display immediately | Restore original configuration + error message |

### 5.6.6 HTTP status code → UI behavior mapping

```text
API response error
  │
  ├─ 401 Unauthorized → Trigger Token refresh → Retry → Still 401 → Redirect login
  ├─ 403 Forbidden → Toast "Insufficient Permissions" + Disable related buttons
  ├─ 404 Not Found → Jump to 404 page or Toast "Resource does not exist"
  ├─ 409 Conflict → Show conflict resolution UI (CAS version conflict)
  ├─ 422 Validation → Form field level error message
  ├─ 429 Too Many Requests → Toast "Operation too frequent" + automatic backoff and retry
  └─ 5xx Server Error → Toast "Server Error" + automatic retry (up to 2 times)
```

---

# Part V — Platform Governance

---

# 6. Domain differentiation, multi-tenancy, security and design system

> **Improvement points D-2, R-3**: Define the DomainUIConfig consumption protocol and align it with the backend; merge the authentication/security chapters.

## 6.1 24 Domain Differentiation UI Engine

> **Improvement point D-2**: Clarify how DomainUIConfig is derived from the backend DomainDescriptor.

### 6.1.1 DomainUIConfig consumption protocol

```text
Backend DomainDescriptor (see 00-platform-architecture.md Domain Descriptor)
    │
    │ GET /admin/v1/domains/{id}
    ▼
Frontend DomainUIConfigResolver
    │
    ├── Read DomainDescriptor.risk_level → map riskDisplayMode
    ├── Read DomainDescriptor.domain_type → map dashboardPanels template
    ├── Read DomainDescriptor.hitl_policy → map hitlEnhanced
    ├── Read DomainDescriptor.compliance_flags → map complianceExtensions
    └── Merge domainId → icon/color (find from design-tokens/domain.ts)
    │
    ▼
DomainUIConfig (front-end runtime configuration object)
```

### 6.1.2 DomainUIConfig type definition

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

  // [Planned] New in v2.2: Domain-level feature visibility
  featureVisibility: Record<string, boolean>;

  // [Planned] New in v2.2: action-level strategy
  actionPolicy: Record<string, ActionPolicyEntry>;

  // [Planned] New in v2.2: Default drill-down depth
  defaultDrillDepth: 1 | 2 | 3 | 4 | 5;

  // [Planned] New in v2.2: Domain term replacement
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

### 6.1.2.1 DomainUIConfig extended field description

| Field | Type | Status | Description |
| ------------------- | ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `featureVisibility` | `Record<string, boolean>` | [Planned] | Domain-level feature hiding switch. The key is the feature route name (such as `"workflow-builder"`), and the value is whether it is visible |
| `actionPolicy` | `Record<string, ActionPolicy>` | [Planned] | Action-level secondary confirmation/approval policy. The key is the action identifier (such as `"task.cancel"`), and the value defines whether confirmation, approval or hiding is required |
| `defaultDrillDepth` | `1 \| 2 \| 3 \| 4 \| 5` | [Planned] | The default drill-down depth for pages under this domain. Users can manually expand to the maximum depth allowed by permissions |
| `glossaryOverrides` | `Record<string, string>` | [Planned] | Domain term replacement mapping. The key is a common platform term (such as `"Task"`), and the value is a domain-specific term (such as `"Strategy"` in the quantitative trading domain) |

**featureVisibility example**:

```json
{
  "workflow-builder": false,
  "workflow-debugger": false,
  "marketplace": true,
  "cost-center": true,
  "explainability": true
}
```

**actionPolicy example** (Financial Services domain):

```json
{
  "task.cancel": {
    "action": "approval_required",
    "approvalWorkflow": "finance-cancel-review"
  },
  "task.create": {
    "action": "confirm",
    "confirmMessage": "This operation will trigger the real transaction process. Are you sure to continue?"
  },
  "admin.takeover": { "action": "hidden" }
}
```

**glossaryOverrides example** (quantitative trading domain):

```json
{
  "Task": "Strategy",
  "Workflow": "Pipeline",
  "Agent": "Trading Bot",
  "Approval": "Risk Review",
  "Domain": "Trading Desk"
}
```

### 6.1.3 Domain Classification UI Differences

| Domain risk level | UI differences | Sample domains |
| ---------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| Critical | All operations require secondary confirmation; the risk panel is expanded by default; the approval card contains a complete risk assessment; the emergency contact is always visible | Quantitative trading, financial services, medical health |
| High | Confirmation is required for write operations; the risk logo is highlighted; the approval includes a risk summary; the cost warning threshold is lowered | Legal affairs, finance, e-commerce pricing, IT operation and maintenance |
| Medium | Standard UI; regular display of risk logos; standard approval process | Advertising promotion, customer service, content review, supply chain |
| Low | Simplified UI; risk panel can be hidden; optional batch processing for approval | Data analysis, enterprise knowledge base, user operations |

### 6.1.4 Domain-specific UI extension points (example)

| Domain | Extension | Description |
| -------- | --------------------------------------------------------------- | ------------------------------------------ |
| Quantitative trading | PositionPanel, PnLChart, RiskGauge | Position panel, profit and loss curve, VaR/CVaR dashboard |
| E-commerce | OrderTimeline, PriceCompare, InventoryHeatmap | Order Timeline, Price Compare, Inventory Heatmap |
| Advertising promotion | CampaignDashboard, BudgetBurndown, CreativePreview | Posting board, budget consumption, creative preview |
| Financial Services | ComplianceChecklist, AuditTrail, RegulatoryReport | Compliance Checklist, Audit Trail, Regulatory Report |
| Customer Service | ConversationView, CSATChart, EscalationQueue | Conversation View, Satisfaction Graph, Escalation Queue |
| Healthcare | PatientTimeline, PhysicianReviewPanel, DrugInteractionAlert | Patient Timeline, Physician Review Panel, Drug Interaction Alert |

### 6.1.5 Domain expansion slot mode and dynamic loading

Function modules reserve slots (Slots), and the domain configuration determines the filling content:

```text
TaskDetailPage
  ├── [Fixed area] Basic mission information
  ├── [Slot: domain-task-header] ← Domain-specific header extension
  ├── [Fixed Area] Step List
  ├── [Slot: domain-task-detail] ← Domain-specific details extension
  └── [Fixed area] Operation button bar

Extension component registration:
  quant-trading → PositionPanel, PnLChart, RiskGauge
  ecommerce → OrderTimeline, PriceCompare
  advertising → CampaignDashboard, BudgetBurndown
  healthcare → PatientTimeline, DrugInteractionAlert
  coding → CodeDiffViewer, PRTimeline, CIStatus
```

Domain extension components are loaded on demand through dynamic import, without increasing the initial package size:

```text
DomainExtensionLoader
  │
  ├─ Get current domainId
  ├─ Query DomainUIConfig
  ├─ Dynamic import(`@aa/domain-extensions/${domainId}/${slot}`)
  └─ Render to Slot position (Suspense + Skeleton fallback)
```

## 6.2 Multi-tenant UI architecture

### 6.2.1 Tenant context

```text
User login
    │
    ▼
TenantContextProvider
    ├── tenantId (parsed from JWT)
    ├── tenantConfig (theme color, logo, function switch)
    ├── orgTree (organizational architecture tree, see `00-platform-architecture.md` organization model)
    ├── featureFlags (tenant-level feature switch)
    └── complianceMode (GDPR/SOX/HIPAA affects UI display)
```

### 6.2.2 Tenant-level UI customization

| Customization dimensions | Customization capabilities | Configuration methods |
| -------- | -------------------------------------------------------- | --------------------------------------------- |
| Brand | Logo, main color, login page background, browser tab icon | Admin API → Tenant configuration |
| Function | Function module switch (such as hiding Marketplace, disabling NL entrance) | Tenant featureFlags |
| Kanban Board | Customize L1/L2 Kanban panel arrangement and visibility | User-level + tenant-level configuration merge |
| Compliance | Hide/desensitize specific fields in GDPR mode; make mandatory audit trails visible in SOX mode | complianceMode automatic driver |
| Languages | Default language, list of available languages | Tenant configuration |
| Mode | Single player mode vs Enterprise mode (see §6.2 Multi-tenant UI architecture) | Automatic detection (number of users ≤ 1 → single player) + manual override |

### 6.2.3 Data isolation strategy

| Dimensions | Implementation |
|--------|-----------------------------------------|
| API isolation | All requests automatically inject `X-Tenant-Id` header |
| Cache Isolation | TanStack Query key prefix contains tenantId |
| Storage isolation | Offline storage key prefix contains tenantId |
| Tenant switching | Clear all cache and offline data when switching → Reinitialize |

## 6.3 Design system

### 6.3.1 Design Token

> _v2.2 Supplement: Added `primitive.ts` primitive color palette (extracted from Doc-11 §15.1)_

```text
tokens/
  color/
    primitive.ts # Original color palette: slate-50..slate-950, blue, green, amber, red, etc.
    semantic.ts # Semantic color: success/warning/error/info/neutral
    risk-level.ts # Risk color: low(green-500)/medium(amber-500)/high(orange-500)/critical(red-600)
    autonomy-level.ts # Autonomy color: suggestion(blue)/supervised(teal)/semi-auto(purple)/full-auto(green)
    status.ts # Status color: pending/running/paused/completed/failed/aborted
    domain.ts # 24 domain identification color (one main color per domain + light background color)
  spacing.ts # 4px base grid: xs(4)/sm(8)/md(16)/lg(24)/xl(32)/xxl(48)
  typography.ts # Font ladder: caption(12)/body(14)/subtitle(16)/title(20)/headline(24)/display(32)
  elevation.ts # Overlay: 0(flat)/1(card)/2(dropdown)/3(modal)/4(toast)/5(overlay)
  animation.ts #Animation duration: fast(100ms)/normal(200ms)/slow(300ms)/easing: ease-in-out
  breakpoint.ts # Responsive: sm(640)/md(768)/lg(1024)/xl(1280)/2xl(1440)
  border-radius.ts # Rounded corners: none/sm(4)/md(8)/lg(12)/xl(16)/full(9999)
```

### 6.3.2 Core component library

| Component Category | Component List | Platform Support |
| -------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| Basics | Button, IconButton, Link, Badge, Tag, Avatar, Tooltip | All platforms |
| Input | TextField, TextArea, Select, Checkbox, Radio, Switch, Slider, DatePicker, FileUpload | All platforms |
| Data display | Table, List, Card, Tree, Timeline, Stat, Progress, Skeleton | Full platform |
| Feedback | Toast, Alert, Modal, Drawer, Popover, Spinner, EmptyState | All platforms |
| Navigation | Sidebar, TopBar, Tabs, Breadcrumb, Pagination, CommandPalette | Full platform (mobile adaptation) |
| Charts | LineChart, BarChart, PieChart, Heatmap, Gauge, Sparkline | Full platform (ECharts/Victory Native) |
| Business | TaskCard, ApprovalCard, AgentHealthIndicator, RiskBadge, AutonomyBadge, CostMeter, NLBubble | Full Platform |
| Composite | WorkflowCanvas, DebugTimeline, OapeflirPanel, DagViewer, DiffViewer | Web + Desktop |

**Component Development Specification** _(New in v2.2, extracted from Doc-11 §15.2)_ `[Planned]`:

| Dimensions | Specifications |
| ------ | --------------------------------------------------------------- |
| Naming | PascalCase component name; kebab-case file name |
| Props | TypeScript interface definition; required/optional clearly marked |
| Documentation | Storybook story for each component (at least: Default / Variants / States) |
| Test | Vitest unit test for each component (rendering + interaction + snapshot) |
| Accessibility | Must contain aria-label/role; keyboard navigation; focus management |
| Themes | Dynamically respond to theme switches via CSS variables/RN StyleSheet |

### 6.3.3 Theme system

| Topic | Description | Switching method |
| ------------- | --------------------------------------------------------------- | ------------------ |
| Light | Default light theme | User settings / Follow the system |
| Dark | Dark theme (OLED friendly) | User settings / Follow the system |
| High Contrast | High Contrast Theme (WCAG AAA) | Accessibility Settings |
| Enterprise customization | Supports covering main colors, logos, and fonts (see §6.2 Multi-tenant UI architecture) | Tenant-level configuration |

Implementation method:

- Web/Desktop: CSS Custom Properties + `prefers-color-scheme` media queries
- React Native: `useColorScheme` hook + StyleSheet dynamic switching
- All chart colors are not used as the only information carrier (WCAG: with shapes/labels)

**Dark Mode Design Rules**:

| Rules | Description |
| ---------- | --------------------------------------- |
| Background color level | Dark colors use elevation instead of shadow to distinguish levels |
| Text contrast | Main text ≥ 7:1 (AAA); auxiliary text ≥ 4.5:1 (AA) |
| Chart color | Not only distinguish data series by color, but also match shapes/labels |
| Status color | Dark color with lower saturation to ensure legibility |
| Image/Screenshot | Add 1px dark border to prevent blending with the background |

### 6.3.4 Icon system

| Level | Description |
|--------|------------------------------------------------|
| System Icons | Lucide Icons (MIT, 1000+ icons, React/RN compatible) |
| Domain icons | Each of the 24 business domains has its own icon (SVG, size 16/20/24/32) |
| Status Icons | Task/Agent/Approval Status Unified Icon Set |
| Risk Icons | Risk Level Icons (shield series, color-coded) |

## 6.4 Internationalization and Accessibility

### 6.4.1 i18n implementation

| Level | Implementation |
| ---------- | ------------------------------------------------------------------------------- |
| UI copywriting | ICU MessageFormat (react-intl / react-native-intl); Key-Value translation file |
| Date/Time | Intl.DateTimeFormat (automatically formatted by locale) |
| Number/Currency | Intl.NumberFormat (ICU format) |
| Relative time | Intl.RelativeTimeFormat |
| NL Dialogue | User input language automatic detection → response language following |
| RTL support | CSS logical properties (Arabic/Hebrew direction adaptive) |

### 6.4.2 Language priority

| Priority | Language | Phase |
| ------ | ---------------- | ------- |
| P0 | Simplified Chinese (zh-CN) | Phase 1 |
| P0 | English (en-US) | Phase 1 |
| P1 | Traditional Chinese (zh-TW) | Phase 2 |
| P1 | Japanese (ja-JP) | Phase 2 |
| P2 | Korea/Germany/France | Phase 3 |

**Translation Workflow**:

```text
Developer writes defaultMessage (en-US)
  → CI automatically extracts message keys
  → Upload translation platform (Crowdin/Phrase)
  → Translation team translation + Review
  → CI automatically pulls translation files
  → Packaging when building (split by locale, lazy load)
  → Load the corresponding translation package according to locale when running
```

### 6.4.3 Accessibility (WCAG 2.1 AA)

| Dimensions | Requirements |
| -------- | ---------------------------------------------------- |
| Keyboard Navigation | All functions are accessible from the keyboard; focus order is logical; focus ring is visible |
| Screen reading | All interactive elements have aria-label; dynamic content uses aria-live |
| Color contrast | Text contrast ≥ 4.5:1; large characters ≥ 3:1; non-text ≥ 3:1 |
| Chart alternative | All charts provide a table alternative view; color is not used as the only information carrier |
| Animation safety | Respect prefers-reduced-motion; flicker frequency < 3Hz |
| Touch target | Mobile touch target ≥ 44x44 dp |

#### 6.4.3.1 Special Guidelines for Accessibility of Complex UI Components _(New in v3.0)_

| Components | Keyboard Interaction | Screen Readers | Downgrade Solutions |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Permission Matrix Editor (§4.6.13) | Arrow keys move the cell focus; Space switches checkbox; Enter edit drop-down; Tab jumps to the first column of the next row; Esc cancels editing | Each cell `aria-label="{role} {permission type} for {page}: {current value}"`; after change `aria-live="polite"` broadcast | More than 10 Provides a "list view" alternative when columns (one role-permission card per row) |
| ECharts chart dashboard (§4.2.8) | Tab focuses on the chart area; Enter expands the data table alternative view; arrow keys navigate between data points (line chart/bar chart) | `role="img"` + `aria-label="{chart title}: {summary description}"`; broadcast specific values when focusing on data points | An expandable `<table>` data table is provided below each chart |
| Workflow canvas (§4.6.9) | Tab moves between nodes in topological order; Enter opens node details; arrow keys fine-tune the point position (edit mode); Delete deletes the selected node | Each node `aria-label="{node name}, type: {step/condition/parallel}, status: {status}"`; the connection relationship is described through `aria-describedby` upstream and downstream | Provide "list view" alternative (all steps are displayed linearly in the order of execution) |
| NL conversation message flow (§4.6.5) | Message list `role="log"`; automatic scrolling of new messages can be paused by Esc; Tab focuses on interactive elements (code block copy/approval button) | `aria-live="polite"` only broadcasts the summary of new messages (avoiding the token stream broadcasting verbatim); broadcasts the full reply when completed | — |
| Operation Kanban multi-panel (§4.6.8) | Tab navigates between panels; Enter expands/collapses the panel; Tab navigation sub-control within the panel | Each panel `role="region"` + `aria-label="{Panel title}"`; folded state broadcast "Collapsed, press Enter to expand" | Provide "Summary View" alternative (plain text KPI list) |

### 6.4.4 Keyboard shortcuts

| Shortcut keys | Function | Platform |
| ----------------------- | ----------------------- | ---------- |
| `Ctrl/Cmd + K` | Open command panel | Web + Desktop |
| `Ctrl/Cmd + N` | New task (opens NL dialog) | Web + Desktop |
| `Ctrl/Cmd + /` | Switch sidebar | Web + Desktop |
| `Ctrl/Cmd + Shift + D` | Open debugger | Web + Desktop |
| `Tab` | Move focus forward | All platforms |
| `Shift + Tab` | Move focus back | All platforms |
| `Escape` | Close pop-up window/panel | All platforms |
| `A` | Approval (when the approval page is focused) | Web + Desktop |
| `R` | Reject approval (when the approval page is focused) | Web + Desktop |
| `D` | Delegate approval (when the approval page is focused) | Web + Desktop |
| `?` | Show shortcut help | Web + Desktop |

### 6.4.5 Screen Reader ARIA Specification

| component | aria attribute |
| -------- | --------------------------------------------------------------- |
| Task status | `role="status"` + `aria-live="polite"` |
| Approval count | `aria-label="{n} pending approvals"` |
| Progress bar | `role="progressbar"` + `aria-valuenow/min/max` |
| Risk level | `aria-label="Risk level: {level}"` + color + text double identification |
| Alert banner | `role="alert"` + `aria-live="assertive"` |
| Conversation messages | `role="log"` + `aria-live="polite"` |

## 6.5 Authentication and session security

> **Improvement R-3**: Merge Doc-10 §10.8 and Doc-11 §20.

### 6.5.1 Certification process

```text
┌────────────┐ ┌──────────────┐
│ UI Client │ │ Platform API │
└─────┬──────┘ └──────┬────────┘
      │ 1. SSO login (OIDC/SAML) │
      │───────────────────────────────▶│
      │ 2. Return access_token + refresh │
      │◀────────────────────────────────│
      │ 3. Store to platform secure storage │
      │ 4. API requests carry Bearer token │
      │───────────────────────────────▶│
      │ 5. Token expiration → automatic refresh │
      │───────────────────────────────▶│
      │ 6. Refresh failed → Log in again │
      │◀────────────────────────────────│
```

### 6.5.2 Security storage strategy

| Platform | Storage method | Token type |
| ------- | ------------------------------------------------------- | ------------- |
| Web | HttpOnly Secure Cookie (access_token); In-memory (short-term) | JWT |
| Windows | Windows Credential Manager (DPAPI encryption) | JWT + refresh |
| macOS | Keychain Services (Secure Enclave protection) | JWT + refresh |
| Linux | libsecret (GNOME Keyring) / KWallet | JWT + refresh |
| Android | Android Keystore (TEE/StrongBox supported) | JWT + refresh |
| iOS | iOS Keychain (Secure Enclave protection) | JWT + refresh |

### 6.5.3 Session Security Policy

| Strategy | Description |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Token refresh | access_token TTL=15min; refresh_token TTL=7d; silent refresh without awareness |
| Multi-device management | Users can view and revoke active session lists |
| Device binding | Optional: refresh_token is bound to the device fingerprint, and re-authentication is required when changing devices |
| Biometric unlocking | Mobile/desktop supports biometric quick unlocking (does not replace first login) |
| SSO exit | Platform exit triggers SSO global exit (SCIM deprovisioning takes effect immediately, see `00-platform-architecture.md` SSO/SCIM) |
| Sensitive operations | High-risk operations (modifying security settings, approving high-value requests) require secondary authentication |

### 6.5.4 Front-end security baseline

| Threats | Defensive Measures |
| -------- | --------------------------------------------------------------------- |
| XSS | React default JSX escape; CSP strict-dynamic; DOMPurify cleans user input |
| CSRF | SameSite=Strict Cookie + CSRF Token (double submission) |
| Clickjacking | X-Frame-Options: DENY + CSP frame-ancestors 'none' |
| Middleman | Full-link HTTPS; Mobile Certificate Pinning |
| Data leakage | PII is not written to local cache; screenshot protection (mobile FLAG_SECURE / UIApplication mask) |
| Reverse engineering | ProGuard/R8 obfuscation for mobile; JS bundle compression obfuscation; no hardcoded keys |
| Supply chain | Dependency lock (package-lock.json); CI automatic npm audit / Snyk scan |

**CSP Policy Configuration**:

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'strict-dynamic' 'nonce-{random}';
  style-src 'self' 'unsafe-inline'; // CSS-in-JS required
  img-src 'self' data: https:;
  connect-src 'self' wss://{api-host}; // WebSocket
  font-src 'self';
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
```

### 6.5.5 Sensitive data processing

| Data categories | Front-end processing rules |
|---------------------|-------------------------------------------------------------|
| PII | Not cached in IndexedDB/SQLite; desensitized display in the list (only detailed display) |
| Secret | The front end is invisible; the back end returns `***masked***` |
| Audit log | Read-only display; front-end modification/deletion not supported |
| Token | Only stored in platform secure storage; not written to localStorage/SessionStorage |
| Offline operation queue | Encrypted storage (L4 SecureStorage implements encryption) |

## 6.6 Responsive and adaptive design

### 6.6.1 Breakpoint system

| breakpoint | width range | device | layout mode |
| ---- | ----------- | ------------------------------- | ---------------------------- |
| xs | < 640px | Small screen mobile phone (vertical screen) | Single column stacking |
| sm | 640-767px | Large screen mobile phone / small screen mobile phone (horizontal screen) | Single column + bottom navigation |
| md | 768-1023px | Tablet (vertical screen) / Large screen mobile phone (horizontal screen) | Foldable sidebar + content |
| lg | 1024-1279px | Tablet (horizontal screen) / small screen notebook | Sidebar + content |
| xl | 1280-1439px | Laptop/Desktop | Sidebar + Content + Right Panel |
| 2xl | ≥ 1440px | Large screen desktop / multi-screen | Three columns (sidebar + content + side panel) |

### 6.6.2 Functional layering (by breakpoints)

| Function | xs/sm | md/lg | xl/2xl |
| --------------- | --------------- | --------------- | ---------------------------- |
| NL conversation | full screen conversation | sidebar conversation | permanent right panel |
| Task List | List View | List + Preview | List + Details + Side Panel |
| Kanban board | Cards stacked vertically | 2-column grid | 4-column grid |
| Workflow Builder | Read-Only View | Limited Editing | Full Editing + Properties Panel |
| Debugger | Not Available | Base Timeline | Full Debugging + OAPEFLIR Expand |
| Approval | Card List + Action | List + Details Panel | Complete Three Columns |

### 6.6.3 Special considerations for mobile terminal adaptation

| Consideration | Processing |
| ---------- | ---------------------------------------- |
| Touch target | Minimum 44x44pt (iOS) / 48x48dp (Android) |
| Gestures | Pull down to refresh, left swipe operation (quick approval processing), edge return |
| Safe area | Adapt notch/Dynamic Island/Navigation bar |
| Input method adaptation | Automatically adjust the layout when the keyboard pops up, and the input box is not blocked |
| Horizontal and vertical screen | Vertical screen is the default; make full use of the width in horizontal screen (board 2 columns → 4 columns) |

---

# Part VI — Engineering and Delivery

---

# 7. CI/CD, testing, performance and delivery routes

## 7.1 Build and CI/CD pipeline

> The currently implemented command baselines in the warehouse are `npm run typecheck`, `npm test`, `npm run test:e2e` (Vitest smoke) and `npm run build`. The following Playwright / Detox / Packaging Matrix describes the target CI design and does not mean that the warehouse already has a complete native E2E release pipeline.

### 7.1.1 CI pipeline

```text
PR Trigger
    │
    ├── lint (ESLint + Prettier)
    ├── typecheck (tsc --noEmit)
    ├── test:unit (Vitest, shared/ + ui-core/ + features/)
    ├── test:component（Storybook interaction tests）
    ├── security:audit (npm audit + Snyk)
    ├── build (Turborepo full build)
└── test:e2e (Playwright Web + Detox Mobile) [main branch only]

Merge to main
    │
    ├── All of the above
    ├── coverage:gate (Vitest coverage + ratchet baseline)
    ├── bundle:analysis (webpack-bundle-analyzer / vite-bundle-visualizer)
    ├── lighthouse:ci (FCP/LCP/CLS/INP budget check)
    └── deploy:staging (Web → staging CDN; desktop/mobile → internal testing distribution)
```

### 7.1.2 CD Release Matrix

| Platform | Build product | Release channel | Update mechanism |
| ------- | --------------- | ---------------------------------- | ---------------------------------- |
| Web | Static SPA bundle | CDN / Docker nginx | Instant deployment, Service Worker updates |
| Windows | MSIX / EXE | Enterprise MDM / direct download | electron-updater incremental update |
| macOS | DMG | Mac App Store / Direct Download | Sparkle (Tauri) Incremental Update |
| Linux | AppImage / DEB | Direct download / package repository | AppImage delta update |
| Android | AAB / APK | Google Play / Enterprise MDM / APK Direct | Play Store Automatic Updates / In-App Updates |
| iOS | IPA | App Store / TestFlight | App Store Automatic Updates |

### 7.1.3 Environmental Strategy

| Environment | Usage | Backend Connections | Data Sources |
| ---------- | -------------- | ----------------------- | ---------- |
| local | Developer local development | mock-server or local backend | mock data |
| dev | Function joint debugging | Shared development backend | Test data |
| staging | pre-release verification | staging backend | masked production data |
| production | formal environment | production backend | real data |

### 7.1.4 CI Stage details `[Planned]`

> _New in v2.2, extracted from Doc-11 §24.1 — 6-stage pipeline details_

```text
Push/PR
  │
  ├─ Stage 1: Lint + Typecheck (parallel)
  │ ├── npm run lint
  │ └── npm run typecheck
  │
  ├─ Stage 2: Unit + Component Test (parallel by package)
  │ ├── npm test
  │ ├── npm run test:e2e
  │ └── Storybook / doc alignment suites
  │
  ├─ Stage 3: Build All (dependency chain building)
  │ └── npm run build
  │
  ├─ Stage 4: E2E Test (parallel by platform)
  │ ├── Web: Playwright (Chrome + Firefox + Safari)
  │ ├── Mobile: Detox (Android emulator + iOS simulator)
  │ └── Desktop: Spectron (Electron) / Tauri test driver
  │
  ├─ Stage 5: Security Scan
  │ ├── npm audit
  │ ├── Snyk / Trivy dependency vulnerability scanning
  │ └── ESLint security plugin
  │
  └─ Stage 6: Package (main/release branch only)
      ├── Web: Docker image (nginx + SPA)
      ├── Windows: MSIX / EXE (Code Signing)
      ├── macOS: DMG (Apple Signed + Notarized)
      ├── Linux: AppImage / DEB / RPM (GPG)
      ├── Android: AAB (Keystore signature)
      └── iOS: IPA (Apple Signature)
```

Execution order: `lint → typecheck → test:unit → build → test:e2e → security:scan → package`

### 7.1.5 Automatic update strategy `[Planned]`

> _New in v2.2, extracted from Doc-11 §24.4_

| Platform | Update mechanism | User experience |
| ------- | --------------------------------------- | -------------------------- |
| Web | Service Worker + Cache API | Background download → Refresh prompt |
| Windows | electron-updater (GitHub Releases / S3) | Background download → Restart prompt (difference package) |
| macOS | Tauri updater (Sparkle protocol) | Background download → Restart prompt |
| Linux | AppImage: appimagetool delta | Manual/scripted updates |
| Android | Google Play Automatic Updates | Play Management |
| iOS | App Store Automatic Updates | App Store Management |

## 7.2 Test strategy

> The current UI testing in the warehouse is mainly Vitest + Testing Library + document consistency test; `npm run test:e2e` currently carries the smoke E2E baseline in the warehouse. Playwright / Detox / Spectron are still retained according to the target state planning.

### 7.2.1 Test Pyramid

| Hierarchy | Tools | Coverage Target | Quantity Ratio |
| -------- | -------------------- | ----------------------------------- | -------- |
| Unit testing | Vitest | shared/pure logic, hooks, utils | 70% |
| Component testing | Vitest + Testing Lib | ui-core/ and features/ component rendering + interaction | 20% |
| Integration testing | Vitest + MSW | API integration, WebSocket process, offline synchronization | 7% |
| E2E Testing | Playwright / Detox | Key User Journeys | 3% |

### 7.2.2 Key test scenarios

| Scenarios | Verify content | Tools |
| ----------------------- | ----------------------------------------------- | ---------- |
| Task creation → execution → completion | NL input → API call → WS status update → card status change | Playwright |
| Approval Flow | Receive Notification → View Details → Approval/Reject → Status Feedback | Playwright |
| Offline → Recovery | Disconnected → Operation Queuing → Recovery → Synchronization → Conflict Resolution | Vitest + MSW |
| Multi-tab WebSocket | Multi-tab shared connection → event broadcast → consistent state | Playwright |
| Quick Approval Operations on Mobile | Push Notification → Notification Bar Operation → API Call | Detox |
| Five-level drill-down (TaskCockpit) | L1→L2→L3→L4→L5 drill-down level by level → data is loaded correctly | Playwright |
| SSO login | OIDC jump → Token storage → API authentication → Silent refresh | Playwright |

### 7.2.3 Visual regression testing

| Tools | Purpose |
| --------- | ------------------------------------------ |
| Storybook | Component documentation + visual isolation development |
| Chromatic | Storybook screenshot comparison + visual regression detection |
| Percy | Cross-browser visual regression (Chrome/Firefox/Safari) |

### 7.2.4 Test tool chain `[Planned]`

> _New in v2.2, extracted from Doc-11 §25.2 — Complete 9-category testing tool matrix_

| Test Categories | Tools | Scope |
| -------------------------- | ---------------------------------------- | -------------------------------- |
| Unit test | Vitest | shared/\* pure logic |
| Component testing | Vitest + React Testing Library | ui-core, ui-mobile components |
| API integration testing | Vitest + MSW (Mock Service Worker) | api-client, queries |
| Visual Return | Storybook + Chromatic | ui-core components |
| Web E2E | Playwright | Main user flow (Chrome/FF/Safari) |
| Mobile E2E | Detox (iOS/Android) | Core process |
| Desktop E2E | Spectron / Tauri test driver | Basic smoke test |
| Performance Testing | Lighthouse CI + Web Vitals | Web Performance Metrics |
| Accessibility Testing | axe-core (Playwright) + VoiceOver Manual | WCAG Compliance |

### 7.2.5 v3.0 new module testing strategy _(v3.0 new)_

| Module | Test focus | Special tools/techniques |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| Agent Monitoring (§4.2.7) | WS Live Push → List update consistency; 500+ Agent virtual scrolling performance; health state aggregation accuracy | Vitest + MSW (WS mock) · Playwright Performance Assertions |
| Statistics platform (§4.2.8) | ECharts chart rendering correctness; role adaptive visibility; time range switching data refresh; empty data fallback | Storybook + Chromatic visual snapshot · Vitest data conversion |
| Configuration management (§4.2.9) | Permission matrix editor CRUD + rollback; function switch grayscale percentage takes effect; model configuration optimistic lock conflict; multi-role isolation | Playwright role switching E2E · Vitest optimistic lock mock |

**ECharts Testing Strategy**:

- **Unit Test**: Verify DTO → ECharts option conversion logic (pure function, does not rely on DOM)
- **Visual snapshot**: Storybook story defines fixture data for each chart type (Line/Pie/Heatmap/Bar/Gauge/BoxPlot) and performs visual regression through Chromatic
- **Performance Assertion**: Playwright verifies chart page LCP < 3s (including ECharts dynamic loading), frame rate ≥ 30fps when rendering ≤ 4 charts concurrently

**Permission Matrix Editor Testing Strategy**:

- Keyboard navigation test (Tab/arrow keys/Enter toggle switch) - axe-core + Playwright
- Correctness of permission inheritance (modify parent role → synchronize changes to child roles) - Vitest unit test
- Large matrix rendering (50 pages × 5 characters × 4 operations = 1000 cells) - Virtual rendering performance verification

### 7.2.6 Coverage requirements `[Planned]`

> _New in v2.2, extracted from Doc-11 §25.3_

| Code Layer | Line Coverage Goal | Branch Coverage Goal |
| ---------- | ---------- | --------------- |
| shared/\* | ≥ 90% | ≥ 80% |
| ui-core | ≥ 80% | ≥ 70% |
| features/\* | ≥ 70% | ≥ 60% |
| apps/\* | ≥ 50% | ≥ 40% |

## 7.3 Performance Budget

### 7.3.1 Web Performance Budget

| Indicators | Target values | Measurement tools | Enforcement measures |
| ---------- | --------------- | ---------- | -------------------------- |
| FCP | < 1.5s | Lighthouse | CI access control, PR exceeding the standard cannot be merged |
| LCP | < 2.5s | Lighthouse | CI Access Control |
| CLS | < 0.1 | Lighthouse | CI Access Control |
| INP | < 200ms | Lighthouse | CI Access Control |
| JS main package | < 200KB gz | bundlesize | CI access control |
| Routing lazy loading | First screen < 100KB gz | bundlesize | Code Splitting mandatory |

### 7.3.2 Desktop/mobile performance budget

| Indicators | Target Values | Platform |
| ------------------ | ---------------------------------- | ------ |
| Startup time | < 3s (desktop) < 2s (mobile) | All platforms |
| Memory usage (idle state) | < 300MB (Electron) < 150MB (Tauri) | Desktop |
| Frame rate | ≥ 60fps (animation/scrolling) | All platforms |
| WebSocket latency | Event → UI < 200ms P99 | All platforms |

### 7.3.3 Performance optimization strategy

| Strategy | Implementation |
| -------------- | ------------------------------------------------------------------------------- |
| Code Splitting | React.lazy + Suspense split by route; dynamic import of heavy components (ECharts/ReactFlow) |
| Virtual Scroll | TanStack Virtual Processing Long Lists (Task List/Approval List/Log) |
| Preloading | prefetchQuery() preloads the next level of drill-down data |
| Web Worker | CPU-intensive operations such as JSON parsing and diff calculation are moved to Web Worker |
| Image optimization | WebP/AVIF format + srcset responsiveness + lazy loading |
| Server-side aggregation | Use MissionControlService aggregation view to reduce API roundtrip |

**Detailed table of web-side optimization**:

| Strategy | Implementation |
| -------------- | --------------------------------------------- |
| Code splitting | React.lazy + Suspense, split function modules by route |
| Tree Shaking | Vite Default + ESM module ensures dead code elimination |
| Resource preloading | `<link rel="modulepreload">` critical path module |
| Image optimization | WebP + responsive srcSet + lazy loading |
| Font optimization | System font stack is the main one; icon fonts are changed to SVG sprite |
| Skeleton screen | All lists/boards use Skeleton components to avoid CLS |
| Virtual List | Task list/approval list with more than 50 items use VirtualList |
| Service Worker | Static resources Cache-First; API Network-First + SWR |
| CDN | CDN distribution of static resources; API remains directly connected |

**Mobile terminal optimization detailed list**:

| Strategy | Implementation |
|---------------------|-------------------------------------------------|
| Hermes engine | Pre-compiled JS bytecode, startup speed increased by 2-3x |
| List virtualization | FlashList (Shopify) replacement for FlatList |
| Image cache | FastImage component + memory/disk double-level cache |
| Animation | Reanimated 3 + natively driven animation to avoid JS thread blocking |
| Background data refresh | Utilizing iOS BackgroundTasks / Android WorkManager |
| Package size | Metro bundle split by architecture (arm64/x86_64) |

**Detailed table of desktop optimization**:

| Strategy | Implementation |
| ---------- | -------------------------------------------------- |
| Startup acceleration | Electron: v8 snapshot + preload key modules |
| Memory management | Inactive window unloading WebView; periodic GC |
| Multi-window | Electron: BrowserWindow pooling and reuse |
| Incremental update | electron-updater differential package (~5MB vs full ~120MB) |
| Tauri advantages | No Chromium bundling; Rust backend memory safety; package size ~15MB |

### 7.3.4 Chart-intensive page performance budget _(new in v3.0)_

The data statistics platform (§4.2.8) and operation dashboard (§4.6.8) include concurrent rendering of multiple charts, which require additional performance constraints:

| Indicators | Target values | Enforcement measures |
| -------------------------- | -------------------------- | ----------------------------------------------------- |
| ECharts package size (introduced on demand) | < 150KB gz | Only the used chart type + renderer is introduced; CI bundlesize access control |
| Monaco Editor (model configuration) | < 200KB gz | Dynamic import; only loaded in `/shared/settings/models` route |
| Chart page LCP | < 3s | ECharts delayed initialization + skeleton screen placeholder |
| Maximum concurrent chart rendering | ≤ 4 visible areas | Non-visual area charts use IntersectionObserver lazy initialization |
| Chart animation frame rate | ≥ 30fps | Disable animation when data volume > 1000 points |
| The upper limit of single chart data points | ≤ 2000 points (aggregated display) | When the limit is exceeded, the backend will downsample, and the frontend will display the "Aggregation" prompt |

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

### 7.3.5 CI Build Impact Assessment _(New in v3.0)_

v3.0 adds 3 new functional modules and their impact on CI:

| Impact Item | Estimated Impact | Mitigation Measures |
| ----------------------- | ------------------ | --------------------------------------------------------------- |
| ECharts package size growth | +120-150KB gz | On-demand introduction + routing-level lazy loading; does not affect the main package < 200KB access control |
| Monaco Editor package size | +180-200KB gz | Only `/settings/models` routes are dynamically loaded; bundlesize individual limit |
| Added 3 new feature modules | +30-50KB gz/module | Code Split has been forced; CI per route < 100KB gz access control coverage |
| Component test increment | +200-300 test cases | CI parallelism from 4 → 6; expected to increase ~30s test time |
| Storybook story increment | +40-60 stories | Chromatic Compare by change increment; does not affect the total CI duration |

## 7.4 Phased delivery plan

### Phase 1 — Web MVP (12 weeks)

**Gate 0 (Phase 1 startup prerequisite)**:

| # | Access control conditions | Verification method | Responsible party |
| ---- | ---------------------------------------------------------------- | ---------------------------------- | ---------- |
| G0-1 | Backend REST API v1 OpenAPI spec released and frozen | `GET /api/v1/openapi.json` available | Backend Team |
| G0-2 | Documentation of WebSocket handshake protocol (JWT auth + schema_version negotiation) | WebSocketBridge integration test passed | Backend team |
| G0-3 | MissionControlService 6 methods can be called through HTTP | console-routes integration test passed | Backend team |
| G0-4 | `ui_console_and_cockpit_contract.md` marked as Accepted | Document Status Check | Architecture Review |
| G0-5 | DomainDescriptor + DomainUIConfig JSON Schema has been released | Schema verification test passed | Domain Platform Team |
| G0-6 | `analyticsConsent` PlatformAdapter interface specification reviewed | ADR review record | Front-end architecture |

| Weeks | Deliverables |
| ------ | -------------------------------------------------------- |
| W1-2 | Monorepo scaffolding + shared/ base + Storybook + mock-server |
| W3-4 | Certification Process + Dashboard + SystemStatusBar |
| W5-6 | TaskCockpit (L1-L3 drill down) + ApprovalCenter |
| W7-8 | StabilityPanel + NL Conversation |
| W9-10 | WebSocket real-time layer + offline basics + WorkflowCockpit |
| W11-12 | AdminTakeoverConsole + E2E testing + performance optimization + release |

### Phase 2 — Desktop (8 weeks)

**Gate 1 (Phase 2 startup prerequisites)**:

| # | Access control conditions | Verification method | Responsible party |
| ---- | -------------------------------------------------------- | ----------------------- | ---------- |
| G1-1 | Phase 1 Web MVP passed UAT acceptance | UAT sign-off report | QA + Product |
| G1-2 | `windowing` / `shell` / `process` PlatformAdapter interface specification has been frozen | ADR-UI-009 review passed | Front-end architecture |
| G1-3 | Electron 34 + Tauri 2.x shell PoC passed (including automatic update verification) | PoC demo + test report | Desktop team |
| G1-4 | Backend §5.2.2 P1 Priority ≥ 80% of new endpoints implemented | API Integration Test Coverage Report | Backend Team |
| G1-5 | Desktop CI matrix (§2.6.3) has been configured | CI pipeline running record | DevOps |

| Weeks | Deliverables |
| ---- | --------------------------------------------------------------- |
| W1-2 | Electron Windows Shell + System Integration (Tray/Shortcut Keys/Notifications) |
| W3-4 | Tauri macOS/Linux shell + native integration |
| W5-6 | Workflow Builder (React Flow Canvas) + Debugger Basics |
| W7-8 | Desktop E2E + automatic update + package release |

### Phase 3 — Mobile (8 weeks)

**Gate 2 (Phase 3 startup prerequisites)**:

| # | Access control conditions | Verification method | Responsible party |
| ---- | -------------------------------------------------- | ---------------------------------- | ------------- |
| G2-1 | Phase 2 desktop has passed UAT acceptance | UAT signing report | QA + product |
| G2-2 | RN 0.79 + Hermes + Fabric technology verification passed | PoC performance report (start < 2s) | Mobile team |
| G2-3 | FCM/APNs push channel configured and integration tested | Push end-to-end test report | Backend + mobile |
| G2-4 | `screenSecurity` PlatformAdapter interface specification has been frozen | ADR review record | Front-end architecture |
| G2-5 | Offline Operation License Matrix (§5.5.6) Confirmed with Product | Product Signature Confirmation | Product |

| Weeks | Deliverables |
| ---- | -------------------------------------------------- |
| W1-2 | RN 0.79 scaffolding + ui-mobile component + navigation structure |
| W3-4 | Dashboard + TaskCockpit + ApprovalCenter Mobile |
| W5-6 | Push Notification + Offline Sync + Biometrics |
| W7-8 | Detox E2E + Performance Optimization + App Store / Play Store Release |

### Phase 4 — Enhancements (ongoing)

**Gate 3 (Phase 4 startup prerequisites)**:

| # | Access control conditions | Verification method | Responsible party |
| ---- | ------------------------------------------------------------- | -------------------------- | ---------- |
| G3-1 | Phase 3 mobile terminal has passed UAT acceptance | UAT signing report | QA + product |
| G3-2 | Backend §5.2.2 P2/P3 Priority Endpoints ≥ 60% Implemented | API Coverage Report | Backend Team |
| G3-3 | DomainUIConfig extension fields (§6.1.2.1) Schema has been stabilized | Schema compatibility test passed | Domain Platform Team |
| G3-4 | glossaryOverrides + featureVisibility configured for at least 3 domains | Domain configuration verification script passed | Domain Administrator |

- Workflow Debugger Time Travel
- 24 domain-specific extensions
- Multi-language P1/P2 coverage
- Edge-Mobile offline mode
- Cost Center + Marketplace + Explainability

### Team configuration suggestions

| Roles | Phase 1 | Phase 2 | Phase 3 | Description |
| ------------- | ------- | ------- | ------- | ------------- |
| Front-end architect | 1 | 1 | 1 | Full participation |
| Web Development | 3 | 2 | 1 | Phase 1 is the main force |
| Desktop Development | 0 | 2 | 1 | Electron + Tauri |
| RN mobile terminal development | 0 | 0 | 3 | Phase 3 is the main force |
| UX Designer | 1 | 1 | 1 | Full participation |
| QA | 1 | 2 | 2 | Increased with platform |
| **Total** | **6** | **8** | **9** | |

## 7.5 Risks and Mitigations

| Risk | Impact | Probability | Mitigation measures |
| ------------------------------------------------ | ---- | ---- | ------------------------------------------------------------------ |
| The backend lacks the API endpoints required for the UI | High | High | Phase 1 simultaneously proposes API enhancement requirements (§5.2.2); mock-server decoupling |
| RN 0.79 New Arch ecological library compatibility issues | Medium | Medium | Community library pre-research; key native module alternatives |
| Tauri WebKitGTK compatibility in Linux distributions | Low | Medium | CI multi-distribution test (Ubuntu/Fedora/Arch); AppImage back-up |
| WebSocket blocked behind corporate firewall/proxy | Medium | Medium | SSE fallback + polling downgrade (§5.3.4) |
| 24 Domain extension components have a large development volume | Medium | High | Phase 4 progressive delivery; templated component framework reduces repeated development |
| Poor user experience in offline conflict resolution | Low | Medium | Minimize the scope of offline write operations; prioritize LWW automatic resolution |
| Front-end and back-end Schemas are out of sync | High | High | The codegen tool automatically generates front-end types from the back-end Zod; CI verification |
| App Store Review Rejected | Medium | Medium | Study the review guidelines in advance; allow a 2-week review buffer |
| Installation package size exceeds standard (Electron) | Low | Medium | Incremental update; lazy loading of non-core modules |

---

#Appendix

## Appendix A: Backend API endpoint → UI function complete mapping {#Appendix-a}

| Endpoint | Status | API Layer | UI Consumption Module |
| ----------------------------------------- | ------------------------- | --------- | ------------------------------------------------------------------------- |
| `GET /api/v1/tasks` | [Implemented/Contracted] | Layer C | task-cockpit, dashboard |
| `POST /api/v1/tasks` | [Implemented/Contracted] | Layer C | conversation (NL → task) |
| `GET /api/v1/tasks/:id` | [Implemented/Contracted] | Layer C | task-cockpit (L2-L3) |
| `POST /api/v1/approvals/:id` | [Implemented/Contracted] | Layer C | approval |
| `GET /api/v1/dashboard/*` | [Implemented/Contracted] | Layer C | dashboard, stability |
| `GET /console/*` | [Implemented/Internal] | Layer B | dashboard (SSR fallback) |
| `GET /admin/v1/*` | [Implemented/Contracted] | Layer B/C | takeover, workers, policy, settings |
| MissionControlService.\* | [Implemented/Internal] | Layer A | dashboard, task-cockpit, wf-cockpit, stability, takeover, approval |
| OperatorConsoleBackendService.\* | [Implemented/Internal] | Layer A | inspect, incidents, workers |
| `CRUD /api/v1/agents` | [Planned] | Layer C | agent-manager |
| `CRUD /api/v1/workflows` | [Planned] | Layer C | workflow-cockpit, workflow-builder |
| `GET /api/v1/marketplace` | [Planned] | Layer C | marketplace |
| `POST /api/v1/explanations` | [Planned] | Layer C | explainability |
| `GET /api/v1/costs` | [Planned] | Layer C | cost-center |
| `GET /api/v1/dashboard/metrics` | [Planned] | Layer C | dashboard (L2-L4) |
| `GET /api/v1/tasks/:id/evidence` | [Planned] | Layer C | task-cockpit (L4) |
| `GET /api/v1/tasks/:id/timeline` | [Planned] | Layer C | task-cockpit (L5) |
| `DELETE /api/v1/tasks/:id` | [Implemented/Contracted] | Layer C | task-cockpit (cancel task) |
| `GET /api/v1/workflow-runs` | [Implemented/Contracted] | Layer C | task-cockpit (run list) |
| `GET /api/v1/workflow-runs/{id}/steps` | [Implemented/Contracted] | Layer C | task-cockpit (step details) |
| `GET /api/v1/approvals` | [Implemented/Contracted] | Layer C | approval (approval list) |
| `GET /api/v1/incidents` | [Implemented/Contracted] | Layer C | alerts, stability (Incident panel) |
| `GET /api/v1/knowledge` | [Implemented/Contracted] | Layer C | explainability (knowledge reference view) |
| `GET /api/v1/packs` | [Implemented/Contracted] | Layer C | agent-manager (Agent list) |
| `POST /api/v1/packs` | [Implemented/Contracted] | Layer C | domain-wizard (Pack registration) |
| `GET /api/v1/packs/{id}/versions` | [Implemented/Contracted] | Layer C | agent-manager (version management) |
| `GET /api/v1/plugins` | [Implemented/Contracted] | Layer C | marketplace (Market list) |
| `GET /api/v1/prompts` | [Implemented/Contracted] | Layer C | agent-manager (Prompt version) |
| `GET /api/v1/cost-reports` | [Planned] | Layer C | cost-center (cost data) |
| `GET/POST /api/v1/webhooks` | [Implemented/Contracted] | Layer C | settings (Webhook management) |
| `GET /api/v1/admin/workers` | [Implemented/Internal] | Layer B | dashboard L3 (Worker status) |
| `GET/PUT /api/v1/admin/config` | [Implemented/Contracted] | Layer B/C | settings (configuration management) |
| `GET/POST /api/v1/admin/rollouts` | [Planned] | Layer C | agent-manager (Grayscale release) |
| `GET/POST/PUT /api/v1/admin/tenants` | [Planned] | Layer C | settings (tenant management) |
| `GET/PUT /api/v1/admin/budgets` | [Planned] | Layer C | cost-center (budget configuration) |
| `ws/v1/stream` | [Implemented] | Layer C | Global (real-time event push) |

## Appendix B: Complete mapping of WebSocket events {#Appendix-b}
| Events | Status | Sources | UI Modules |
| ------------------------------- | ------------- | -------------------------- | ---------------------------- |
| `status_changed` | [Implemented] | TaskWebSocketStatusRelay | task-cockpit, dashboard |
| `progress` | [Implemented] | TaskWebSocketStatusRelay | task-cockpit |
| `message_delta` | [Implemented] | WebSocketBridge | conversation |
| `artifact_ready` | [Implemented] | WebSocketBridge | task-cockpit |
| `approval_requested` | [Implemented] | WebSocketBridge | approval, dashboard |
| `completed` | [Implemented] | TaskWebSocketStatusRelay | task-cockpit, dashboard |
| `failed` | [Implemented] | TaskWebSocketStatusRelay | task-cockpit, dashboard |
| `approval.resolved` | [Planned] | WebSocketBridge | approval |
| `incident.created` | [Planned] | IncidentService | alerts, stability |
| `panic.activated` | [Planned] | PanicService | Global mask |
| `hitl.intervention_required` | [Planned] | HITL module | hitl, approval |
| `agent.health_changed` | [Planned] | AgentRegistry | agent-manager, dashboard |
| `dashboard.metric_updated` | [Planned] | DashboardProjectionService | dashboard |
| `nl.clarification_needed` | [Proposed] | NLEntryService | conversation |
| `cost.budget_alert` | [Proposed] | CostService | cost-center, dashboard |
| `drift.alert` | [Proposed] | DriftDetector | stability, alerts |
| `agent.registered` | [Planned] | AgentRegistryService | agent-manager |
| `agent.deregistered` | [Planned] | AgentRegistryService | agent-manager |
| `workflow.updated` | [Planned] | WorkflowDefinitionService | workflow-builder |
| `workflow.published` | [Planned] | WorkflowDefinitionService | workflow-builder, wf-cockpit |
| `workflow.validation_result` | [Planned] | WorkflowDefinitionService | workflow-builder |
| `marketplace.pack_published` | [Planned] | MarketplaceService | marketplace |
| `marketplace.pack_updated` | [Planned] | MarketplaceService | marketplace |
| `marketplace.install_completed` | [Planned] | MarketplaceService | marketplace |
| `cost.period_closed` | [Proposed] | CostService | cost-center |
| `debug.step_entered` | [Planned] | DebuggerService | workflow-debugger |
| `debug.breakpoint_hit` | [Planned] | DebuggerService | workflow-debugger |
| `debug.state_snapshot` | [Planned] | DebuggerService | workflow-debugger |
| `goal.decomposition_ready` | [Proposed] | GoalDecompositionService | conversation |
| `config.updated` | [Planned] | admin-routes | settings |

## Appendix C: ADR Decision Index {#Appendix-c}

| ADR Number | Decision | Status |
| ---------- | ----------------------------------------------- | ------ |
| ADR-UI-001 | React 19 as a unified UI framework | Approved |
| ADR-UI-002 | Electron(Win) + Tauri(Mac/Linux) hybrid strategy | Approved |
| ADR-UI-003 | Zustand 5 + TanStack Query v5 State Management | Approved |
| ADR-UI-004 | pnpm + Turborepo Monorepo | Approved |
| ADR-UI-005 | Contract Information Architecture as a First-Level Navigation Structure | This Document |
| ADR-UI-006 | WebSocket priority + SSE fallback + polling fallback | This document |
| ADR-UI-007 | Web offline three-tier policy | This document |
| ADR-UI-008 | DomainUIConfig derives from DomainDescriptor | This document |
| ADR-UI-009 | Electron(Win)+Tauri(Mac/Linux) desktop mixed shell management | This document |

## Appendix D: Glossary {#Appendix-d}

| Terminology | Meaning |
| -------------------------- | -------------------------------------------------------------------------- |
| MissionControlService | Backend core service that aggregates all Cockpit view data |
| WebSocketBridge | Backend production-grade WebSocket service, supporting JWT authentication and event broadcasting |
| DomainDescriptor | Backend business domain descriptor, including domain configuration, risk level, policy, etc. |
| DomainUIConfig | Front-end domain UI configuration object, derived from DomainDescriptor |
| OAPEFLIR | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release eight-stage cycle |
| HITL | Human-In-The-Loop Human-machine collaboration |
| L1-L5 | UI information drill-down levels (five levels of drill-down as defined in Contract §7) |
| shared_snapshot | Global shared snapshot data source defined by contract |
| shared_query | Cross-page shared query data source defined by contract |
| page_local_api | Contract-defined page-level private API data source |
| Layer A/B/C | API exposure level: Service Method / Internal Route / Public Contract EP |
| Idempotency Key | Idempotent identification of write operations to prevent repeated execution due to retries |
| RedactionRule | Field-level masking rules, defining the visibility policy of each role on each field |
| SPA | Single Page Application, single page application |
| SSO | Single Sign-On, single sign-on |
| OIDC | OpenID Connect, an identity authentication protocol based on OAuth2 |
| PKCE | Proof Key for Code Exchange, OAuth2 security extension |
| RN | React Native |
| DAG | Directed Acyclic Graph, directed acyclic graph |
| CAS | Compare-And-Swap, optimistic locking |
| FCP | First Contentful Paint, the first content painting |
| LCP | Largest Contentful Paint, maximum content painting |
| CLS | Cumulative Layout Shift, cumulative layout offset |
| INP | Interaction to Next Paint, interact to the next draw |
| WCAG | Web Content Accessibility Guidelines |
| PWA | Progressive Web App |
| MSW | Mock Service Worker |
| BFF | Backend For Frontend |
| CDN | Content Delivery Network |

## Appendix E: v2.3 rectification list (P0/P1/P2) {#Appendix-e}

> This appendix records the legacy improvements identified after the v2.2 expert review and their processing status in v2.3.

### P0 — Blocking issue (fixed in v2.3)

| # | Issues | Risks | v2.3 Handling |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| P0-1 | `[Implemented]` tag does not distinguish between "has a service method" and "has a public JSON contract" | The front-end mistakenly regards the Layer A service method as a directly consumable endpoint | §1.7 Added the Implemented third-level sub-tag; §4.1/§5.2/Appendix A Full Annotation |
| P0-2 | The semantic levels of `/console/*` and `/admin/v1/*` are unclear | The front end is not sure whether to consume HTML fallback or JSON API | §5.2.3 Added Public UI API Surface three-tier hierarchy |
| P0-3 | `[Implemented]`/`[Need to add]` and `[Implemented]`/`[Planned]` tags are mixed together | The credibility of the document is reduced | The full text is unified into English tag format |

### P1 — High priority improvements (fixed in v2.3)

| # | Issues | Risks | v2.3 Handling |
| ---- | ---------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| P1-1 | 6 Planned modules lack closed-loop contracts (DTO/actions/query keys/permission/WS/offline) | The back-end API design has no alignment benchmark, and mock-server cannot mock accurately | §4.7 6 new modules mini-contract |
| P1-2 | Missing field-level visibility/masking matrix | PII leakage risk in enterprise-level deployment scenarios | §4.5.4 New FieldVisibilityPolicy + RedactionRule |
| P1-3 | Lack of idempotent/retry semantics for write operations | Repeated submissions, inconsistent data | §5.6.4 New Mutation idempotence and retry specifications |
| P1-4 | service / route / endpoint terminology confusion | Readers misunderstand API exposure levels | §5.2.3 Definition Layer A/B/C; Appendix D Supplementary terminology |

### P2 — Medium priority improvements (some fixed, some followed in subsequent versions)

| # | Issues | Risks | v2.3 processing | Subsequent versions |
| ---- | ---------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ | -------- |
| P2-1 | The boundaries of some PlatformAdapter capabilities are blurred (screenSecurity/analyticsConsent/windowing) | Cross-platform no-op behavior is undefined | The scope of platform application has been marked in the §3.7.1 table; detailed no-op specifications | v2.4 |
| P2-2 | Is PlatformAdapter `process.getAppVersion()`/`getBuildChannel()` a full-platform capability | Unclear responsibility boundaries | Maintain [Planned] status, marked as "Phase 2 Review Confirmation" | v2.4 |
| P2-3 | The actual capability of `screenSecurity` on the Web side is very weak | Giving users a false sense of security | §3.7.1 The table indicates "Desktop + Mobile", and the Web side is no-op | — |
| P2-4 | `windowing` and multi-window state synchronization protocol are not defined | Data inconsistency between multiple windows | Keep [Planned]; covered in Phase 2 Gate 1 preconditions | v2.4 |
| P2-5 | §4.1 Information architecture table "Backend Data Source" column mixes service method and route references | Fuzzy API exposure level | Updated §4.1 Table annotation Implemented subtag; §5.2.3 Explicit layering | — |
| P2-6 | Some internal reference numbers (such as "See §6 API") do not match the current document structure | Reader navigation is confusing | Full-text citation review, corrected to the current number | — |

### Subsequent versions Backlog

| # | Question | Planned Version |
| --- | ------------------------------------------------------------------------------- | -------- |
| B-1 | Each PlatformAdapter capability group supplements the no-op / degraded behavior specification | v2.4 |
| B-2 | Workflow/Agent/Marketplace WS Subscription Agreement Detailed Design | v2.4 |
| B-3 | DomainUIConfig extended fields (featureVisibility/actionPolicy, etc.) JSON Schema released | v2.4 |
| B-4 | 24 domain-specific extension components mini-contract (§6.1.4 expanded) | v2.5 |
| B-5 | End-to-end contract test automation (OpenAPI spec → front-end type → mock → E2E) | v2.5 |