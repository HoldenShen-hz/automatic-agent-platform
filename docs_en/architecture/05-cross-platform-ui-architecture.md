# Cross-platform UI Architecture

> **Documentation version**: v1.3
> **Document status**: Active (synced with code structure review)
> **Associated documents**: `00-platform-architecture.md` v2.7 §5 · `01-code-structure.md` · `03-module-diagrams.md`
> **Design date**: 2026-04-19
> **Last update**: 2026-05-26 (synced P1 public interface, federation governance, event reliability, and Electron/UI contract fixes)

---

## 1. Document Purpose

This document defines the complete cross-platform UI architecture, addressing five questions:

1. How does `ui/` Monorepo support Web / Electron / Tauri / Mobile four platforms simultaneously?
2. How does the frontend access backend capabilities securely?
3. What is the frontend module structure and dependency boundaries?
4. Where are the UI entry points for platform capabilities (dashboard, cockpit, HITL, marketplace)?
5. Where is the frontend test structure and what are the coverage targets?

### 1.1 This Round of UI Architecture Review Conclusion (2026-05-18)

This review is based on the current workspace directory structure, focusing on the consistency between `ui/` and the backend seven-layer architecture. Conclusions are as follows:

| Conclusion | Current Code Facts | Document Handling |
|---|---|---|
| UI entry exists | `ui/apps/web`, `ui/apps/electron-win`, `ui/apps/tauri-macos`, `ui/apps/tauri-linux`, `ui/apps/mobile` | Keep six-platform shell structure, update statistics |
| Frontend shared core | `ui/packages/shared/` exists, with api-client, auth, state, platform, i18n, telemetry | Keep shared structure, update detailed module descriptions |
| Feature packages | `ui/packages/features/` has 24 feature directories (dashboard, task-cockpit, workflow-cockpit, approval, hitl, etc.) | Update feature list and directory rules |
| Electron bridge | `ui/packages/shared/platform/src/desktop-platform-adapter.ts` + `ui/apps/electron-win/src/preload.ts` unified bridge | Add Electron bridge section, clarify naming compatibility |
| Platform capability boundary | PlatformAdapter injected via Provider, not directly called in feature | Clarify dependency boundary rules |
| Frontend tests | `ui/tests/` has unit/integration/features/apps/a11y/playwright | Update test structure description |

### 1.2 Recent Structure Sync (2026-05-26)

This round has no changes to the six-platform shell structure, but recent code closure has affected "how to understand the UI architecture":

| Sync Topic | Current Code Facts | Document口径 |
|---|---|---|
| P1 public query interface | `dashboard-routes.ts` has `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/dashboard/metrics`, `/v1/explanations`, `/v1/meta/contract-version` | UI/HTTP public queries default to Layer C `/v1/*` |
| Electron platform bridge | `ui/apps/electron-win/src/preload.ts` and `ui/packages/shared/platform/` unified bridge, compatible with `AA_ELECTRON` / `__AA_ELECTRON__` | Desktop shell has formal bridge compatibility contract |
| HITL UI | `ui/packages/features/hitl/` has web/mobile/hooks/route.ts/permissions.ts/mapper.ts | Human-in-the-loop UI already in feature package |

---

## 2. Design Principles

| # | Principle | Description |
|---|---|---|
| 1 | **API-First** | Frontend never directly imports backend internal implementation; all data exchange through public API / OpenAPI / generated schema / typed mock seam |
| 2 | **Platform Abstraction** | Platform-specific capabilities (Electron/Tauri/RN) injected via PlatformAdapter, not directly called in feature packages |
| 3 | **Monorepo Shared** | Shared capabilities (api-client, auth, state, platform adapter, i18n) unified in `ui/packages/shared/`, independently versioned |
| 4 | **Feature Package Isolation** | Each feature has its own web/mobile/hooks/route/permissions/mapper, feature-to-feature communication only through shared public API |
| 5 | **DTO → VM → Props** | Frontend never directly consumes backend DTO; must go through mapper转为 ViewModel |
| 6 | **Feature Gate** | Backend capabilities not yet available must use feature gate + typed mock + degradation banner |
| 7 | **Test Pyramid** | UI tests: unit/integration/features/apps/a11y/playwright, 100% feature coverage |
| 8 | **Accessibility by Default** | WCAG 2.1 AA as baseline, all new features must have a11y test cases |

---

## 3. `ui/` Monorepo Structure

```
ui/
├── apps/                      # Six platform shells
│   ├── web/                    # React + Vite Web SPA
│   ├── electron-win/           # Windows Electron shell
│   ├── tauri-macos/            # macOS Tauri shell
│   ├── tauri-linux/            # Linux Tauri shell
│   └── mobile/                 # React Native mobile shell
├── packages/
│   ├── shared/                 # Frontend core shared by all platforms
│   │   ├── api-client/        # REST/WS client, endpoint binding
│   │   ├── auth/              # Token/session/auth callback
│   │   ├── state/             # Query/store/offline persistence
│   │   ├── sync/              # Offline queue/conflict resolver
│   │   ├── domain/            # DomainUIConfig, permissions, field masking
│   │   ├── platform/           # PlatformAdapter contract + adapters
│   │   ├── telemetry/          # Frontend telemetry
│   │   ├── i18n/              # Locale/catalog
│   │   ├── nl-client/          # NL interaction client
│   │   └── types/             # Frontend public types
│   ├── ui-core/               # Web/desktop design system, business components
│   ├── ui-mobile/             # Mobile components, native module seam
│   └── features/              # Business feature packages
│       ├── dashboard/
│       ├── task-cockpit/
│       ├── workflow-cockpit/
│       ├── approval/
│       ├── hitl/
│       ├── settings/
│       ├── domain-wizard/
│       ├── stability/
│       ├── takeover/
│       ├── alerts/
│       ├── dispatch/
│       ├── inspect/
│       ├── health/
│       ├── incidents/
│       ├── conversation/
│       ├── feature-flags/
│       ├── agent-manager/
│       ├── workflow-builder/
│       ├── workflow-debugger/
│       ├── explainability/
│       ├── cost-center/
│       ├── marketplace/
│       ├── analytics/
│       └── governance-compliance/
├── tools/
│   ├── codegen/               # Generate frontend types and endpoint binding from backend contracts
│   ├── mock-server/           # Planned endpoint / WS event typed mock
│   └── e2e/                   # UI E2E tooling
└── tests/
    ├── unit/
    ├── integration/
    ├── features/
    ├── apps/
    ├── a11y/
    ├── playwright/
    └── docs/
```

### 3.1 Six-Platform Shell Responsibility Boundary

| Shell | Technology | Responsibilities | Entry File |
|---|---|---|---|
| `web/` | React + Vite SPA | Main web application entry, routing, layout | `src/main.tsx` |
| `electron-win/` | Electron + React | Windows desktop application, native capabilities | `src/main/index.ts` |
| `tauri-macos/` | Tauri + React | macOS desktop application | `src/main/index.ts` |
| `tauri-linux/` | Tauri + React | Linux desktop application | `src/main/index.ts` |
| `mobile/` | React Native | Mobile application | `src/main/index.tsx` |

Shell responsibilities:
- Initialize React application
- Inject Provider (PlatformAdapter, API client, auth state, router)
- Register global layout and navigation structure
- Not allowed to contain business logic, only composition and startup

### 3.2 `packages/shared/` Module Details

| Module | Responsibilities | Key Files |
|---|---|---|
| `api-client/` | REST/WS client, automatic retry, offline queue | `src/client.ts`, `src/endpoints.ts`, `src/ws-client.ts` |
| `auth/` | Token management, SSO callback, session state | `src/token-store.ts`, `src/auth-callback.tsx`, `src/session-context.tsx` |
| `state/` | Global state management, Query/ Mutation separation | `src/query-store.ts`, `src/offline-queue.ts` |
| `sync/` | Offline conflict resolution, optimistic update | `src/conflict-resolver.ts`, `src/sync-engine.ts` |
| `domain/` | DomainUIConfig, field masking, permission definitions | `src/domain-config.ts`, `src/permission-def.ts` |
| `platform/` | PlatformAdapter contract and platform-specific adapters | `src/platform-adapter.ts`, `src/electron-adapter.ts`, `src/tauri-adapter.ts`, `src/rn-adapter.ts` |
| `telemetry/` | Frontend telemetry, user behavior analysis | `src/telemetry-client.ts`, `src/page-view-tracker.ts` |
| `i18n/` | Internationalization, locale switching | `src/locale-provider.tsx`, `src/catalogs/` |
| `nl-client/` | Natural language interaction client | `src/nl-gateway-client.ts` |
| `types/` | Frontend shared types, generated from backend contracts | `src/api-types.ts`, `src/vm-types.ts` |

### 3.3 Feature Package Directory Structure

Each `ui/packages/features/<feature>/src/` must maintain the same structure:

```
src/
├── web/                    # Web/desktop rendering entry
├── mobile/                 # Mobile rendering entry
├── hooks/                  # Query/VM hooks, only returns ViewModel
├── route.ts                # Route registration
├── permissions.ts          # Feature guard / visibility
├── mapper.ts               # DTO → VM
└── index.ts                # Public exports
```

Rules:
- Components never directly consume backend DTO, must go through mapper转为 VM
- Planned backend capabilities must use feature gate + typed mock + degradation banner
- Platform-specific capabilities only via PlatformAdapter injection, feature内部禁止直接调用 Electron/Tauri/RN API
- UI tests belong to `ui/tests/*` or `tests/unit/ui` / `tests/integration/ui`

---

## 4. Frontend-Backend Dependency Boundary

### 4.1 Allowed Dependencies (Frontend → Backend)

```text
ui/ ──allowed──▶ public API / OpenAPI / generated schemas / typed mock seam
ui/ ──allowed──▶ ui/packages/shared/api-client (endpoint binding)
ui/ ──allowed──▶ ui/packages/shared/types (generated from backend contracts)
ui/ ──allowed──▶ ui/packages/shared/platform (PlatformAdapter interface)
ui/ ──allowed──▶ ui/packages/shared/auth (token/session interfaces)
ui/ ──allowed──▶ tests/ (test support only)
```

### 4.2 Prohibited Dependencies (Frontend → Backend)

```text
ui/ ──prohibited──▶ src/platform/* 内部实现 (truth store, worker runtime, private services)
ui/ ──prohibited──▶ src/interaction/* 内部实现
ui/ ──prohibited──▶ src/org-governance/* 内部实现
ui/ ──prohibited──▶ src/scale-ecosystem/* 内部实现
ui/ ──prohibited──▶ src/ops-maturity/* 内部实现
ui/ ──prohibited──▶ Backend DTO (bypass mapper)
ui/ ──prohibited──▶ Electron/Tauri/RN API (bypass PlatformAdapter)
ui/ ──prohibited──▶ tests/ (production code)
```

### 4.3 Feature → Feature Communication

Feature packages communicate only through shared public API:
```text
Feature A ◀──shared/api-client──▶ Feature B
        (via VM hook, not direct import)
```

### 4.4 Backend API Path Specification

| Category | Path | Description |
|---|---|---|
| Public query | `/v1/workers`, `/v1/queues`, `/v1/agents` | Layer C public interface, read-only |
| Dashboard | `/v1/dashboard/metrics`, `/v1/explanations` | Metrics and explanation query |
| Task | `/v1/tasks`, `/v1/tasks/:taskId` | Task CRUD |
| Workflow | `/v1/workflows`, `/v1/workflows/:workflowId` | Workflow CRUD |
| Pack | `/v1/marketplace`, `/v1/packs/:packId/versions` | Marketplace and pack version |
| Knowledge | `/v1/knowledge` | Knowledge base query |
| Meta | `/v1/meta/contract-version` | Contract version info |
| Admin | `/v1/admin/*` | Admin management interface |
| HITL | `/v1/hitl/*` | Human-in-the-loop interface |

Frontend usage:
```typescript
// ui/packages/shared/api-client/src/endpoints.ts
export const runtimeBaseUrl = '/api';
export const apiVersion = 'v1';
export const endpoints = {
  workers: `${runtimeBaseUrl}/${apiVersion}/workers`,
  queues: `${runtimeBaseUrl}/${apiVersion}/queues`,
  dashboardMetrics: `${runtimeBaseUrl}/${apiVersion}/dashboard/metrics`,
  // ...
};
```

---

## 5. PlatformAdapter Contract

### 5.1 Capability Categories

| Category | Capabilities | Injection Method |
|---|---|---|
| Network | HTTP request, WebSocket connection | `networkAdapter` |
| SecureStorage | Token storage, credential caching | `secureStorageAdapter` |
| Filesystem | File read/write, path resolution | `filesystemAdapter` |
| Clipboard | Copy/paste text and images | `clipboardAdapter` |
| Lifecycle | App startup, background, termination | `lifecycleAdapter` |
| Shell | Open URL, open file, external app invocation | `shellAdapter` |
| DeepLink | URL scheme handling | `deepLinkAdapter` |
| Windowing | Window size, position, fullscreen | `windowAdapter` |
| ScreenSecurity | Screenshot protection, screen lock | `screenSecurityAdapter` |
| Haptics | Vibration feedback | `hapticsAdapter` |

### 5.2 Electron Bridge Naming Convention

```typescript
// ui/apps/electron-win/src/preload.ts
contextBridge.exposeInMainWorld('AA_ELECTRON', electronAPI);
contextBridge.exposeInMainWorld('__AA_ELECTRON__', electronAPI);

// ui/packages/shared/platform/src/desktop-platform-adapter.ts
// Priority reading __AA_ELECTRON__, compatible with AA_ELECTRON
const bridge = (window as any).__AA_ELECTRON__ || (window as any).AA_ELECTRON;
if (!bridge) throw new Error('Desktop platform bridge not found');
```

### 5.3 PlatformAdapter Initialization

```typescript
// ui/apps/web/src/main.tsx
import { PlatformProvider } from '@automatic-agent/platform';
import { ApiClientProvider } from '@automatic-agent/api-client';
import { AuthProvider } from '@automatic-agent/auth';

const App = () => (
  <PlatformProvider adapter={webPlatformAdapter}>
    <ApiClientProvider baseUrl='/api'>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </ApiClientProvider>
  </PlatformProvider>
);
```

---

## 6. UI Entry Points for Platform Capabilities

### 6.1 Dashboard / Task Cockpit

| Entry | Route | Component | Description |
|---|---|---|---|
| Dashboard | `/dashboard` | `DashboardView` | L1-L4 metric aggregation |
| Task Detail | `/tasks/:taskId` | `TaskCockpitView` | Task detail and execution status |
| Workflow Detail | `/workflows/:workflowId` | `WorkflowCockpitView` | Workflow step status |

### 6.2 HITL / Approval

| Entry | Route | Component | Description |
|---|---|---|---|
| HITL Inbox | `/hitl/inbox` | `HitlInboxView` | Pending human review queue |
| Approval Detail | `/hitl/:taskId` | `HitlApprovalView` | Approval context and action |
| Takeover | `/hitl/:taskId/takeover` | `HitlTakeoverView` | Operator takeover interface |

### 6.3 Marketplace / Pack Management

| Entry | Route | Component | Description |
|---|---|---|---|
| Marketplace | `/marketplace` | `MarketplaceView` | Agent and pack catalog |
| Pack Detail | `/packs/:packId` | `PackDetailView` | Pack version and configuration |
| My Packs | `/my-packs` | `MyPacksView` | User's published packs |

### 6.4 Observability / Debugging

| Entry | Route | Component | Description |
|---|---|---|---|
| Explainability | `/explain/:runId` | `ExplainabilityView` | Decision rationale and evidence chain |
| Workflow Debugger | `/debug/workflow/:runId` | `WorkflowDebuggerView` | Timeline and breakpoint debugging |
| Agent Health | `/health` | `HealthView` | Agent and system health status |

---

## 7. Frontend Test Structure

### 7.1 Test Pyramid

```
        ┌─────────────────────────────────────┐
        │           Playwright E2E             │  ~50 scenarios
        │   (Full browser, real backend)     │
        ├─────────────────────────────────────┤
        │         Integration Tests          │  ~200 test files
        │   (Component + Mock API + Router)  │
        ├─────────────────────────────────────┤
        │            Unit Tests              │  ~500 test files
        │        (Pure component/logic)        │
        ├─────────────────────────────────────┤
        │          Accessibility              │  100% a11y coverage
        │          (a11y tests)                │
        └─────────────────────────────────────┘
```

### 7.2 Test Directory Structure

```
ui/tests/
├── unit/
│   ├── components/          # Component unit tests
│   ├── hooks/               # Hook unit tests
│   ├── mapper/              # DTO→VM mapper tests
│   └── platform-adapter/    # PlatformAdapter tests
├── integration/
│   ├── feature/            # Feature integration tests
│   ├── route/               # Route integration tests
│   └── api-client/          # API client integration tests
├── e2e/
│   ├── auth-flow.spec.ts    # Authentication flow
│   ├── task-lifecycle.spec.ts # Task lifecycle
│   ├── hitl-approval.spec.ts  # HITL approval
│   └── marketplace.spec.ts    # Marketplace flow
├── a11y/
│   ├── dashboard.spec.ts   # Dashboard accessibility
│   ├── task-cockpit.spec.ts # Task cockpit accessibility
│   └── hitl.spec.ts         # HITL accessibility
└── playwright/
    ├── config.ts            # Playwright configuration
    └── fixtures/            # Test fixtures
```

### 7.3 Feature Package Test Requirements

Each feature package must have:
- Unit tests for mapper (DTO → VM transformation)
- Unit tests for permissions (feature guard logic)
- Integration tests for hooks (VM hook return value)
- E2E tests for critical user flows
- a11y tests for all interactive components

---

## 8. Build and Deployment

### 8.1 Build Configuration

```yaml
# ui/apps/web/vite.config.ts
export default defineConfig({
  plugins: [react(), plan请可参(), typedoc()],
  resolve: {
    alias: {
      '@': '/src',
      '@shared': '/packages/shared/src',
      '@features': '/packages/features/src',
    },
  },
  build: {
    outDir: 'dist/web',
    sourcemap: true,
  },
});
```

### 8.2 Deployment Targets

| Shell | Deployment | Build Command |
|---|---|---|
| `web/` | CDN / Static hosting | `npm run build:web` |
| `electron-win/` | Windows installer (NSIS) | `npm run build:electron:win` |
| `tauri-macos/` | macOS app bundle | `npm run build:tauri:macos` |
| `tauri-linux/` | Linux AppImage | `npm run build:tauri:linux` |
| `mobile/` | iOS/Android stores | `npm run build:mobile` |

### 8.3 Feature Flag Configuration

```typescript
// ui/packages/shared/feature-flags/src/index.ts
export const featureFlags = {
  newDashboard: { enabled: true, rollout: 100 },
  hitlV2: { enabled: true, rollout: 50 },
  workflowDebugger: { enabled: false, rollout: 0 },
  marketplaceV2: { enabled: false, rollout: 0 },
};
```

---

## 9. Security Considerations

### 9.1 Frontend Security Baseline

| Requirement | Implementation |
|---|---|
| No backend credential storage | Tokens only in memory or PlatformAdapter secure storage |
| No direct backend access | All access via api-client with auth headers |
| XSS protection | Content Security Policy + sanitized rendering |
| CSRF protection | SameSite cookies + CORS validation |
| Sensitive field masking | DomainConfig field masking rules |

### 9.2 Electron Security

| Requirement | Implementation |
|---|---|
| Context isolation | `contextIsolation: true`, `nodeIntegration: false` |
| Preload script sandbox | Minimal API exposure via contextBridge |
| Remote module disabled | `webSecurity: true` |
| Native module validation | Signature verification for native modules |

---

## 10. UI Component Library

### 10.1 Design System (`ui-core/`)

| Category | Components |
|---|---|
| Layout | Container, Grid, Stack, Spacing |
| Navigation | Tabs, Breadcrumb, Pagination |
| Data Display | Table, Cards, Charts, Timeline |
| Form | Input, Select, DatePicker, Upload |
| Feedback | Toast, Modal, Alert, Progress |
| Actions | Button, Dropdown, ActionMenu |

### 10.2 Mobile Components (`ui-mobile/`)

| Category | Components |
|---|---|
| Navigation | StackNavigator, TabNavigator, Drawer |
| Form | MobileInput, MobileSelect, DatePickerMobile |
| Feedback | ToastMobile, BottomSheet, ActionSheet |
| Gestures | SwipeRefresh, PullToLoad, LongPress |

---

## Appendix A: UI Metrics

| Metric | Target | Current |
|---|---|---|
| Core Web Vitals (LCP) | < 2.5s | - |
| Core Web Vitals (FID) | < 100ms | - |
| Core Web Vitals (CLS) | < 0.1 | - |
| Test coverage | > 80% | - |
| a11y compliance | WCAG 2.1 AA | - |
| Playwright E2E scenarios | > 50 | - |

## Appendix B: Migration Notes

### 4.1 Six-Platform Shell from Old System

| Old System | New System | Notes |
|---|---|---|
| `src/gateway/` | `ui/apps/web/` | Web SPA replaces old gateway |
| No equivalent | `ui/apps/electron-win/` | New Windows desktop application |
| No equivalent | `ui/apps/tauri-macos/` | New macOS desktop application |
| No equivalent | `ui/apps/tauri-linux/` | New Linux desktop application |
| No equivalent | `ui/apps/mobile/` | New mobile application |
| `src/cli/` (78 scripts) | `src/sdk/cli/` | CLI moved to SDK layer |

### 4.2 Frontend Directory Cleanup

Old frontend files (pre-Monorepo):
- Directly migrate valid pages and components to feature packages
- Archive old shared utilities not meeting current architecture
- Clean up duplicate implementations
