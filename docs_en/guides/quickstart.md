# Quickstart

## Goal

This document helps you quickly find your reading path in the split document system, and focus your attention on the infrastructure scope that should currently be implemented, rather than getting lost in overly long documents again.

## Recommended Reading Order

1. First read [Platform Skeleton](../architecture/00-platform-architecture.md) to build a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand the core main path.
3. If currently implementing memory, cost, or security, additionally read [ADR-020](../adr/020-memory-six-plane-model.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md).
4. If adding new business capabilities, read [Division Authoring](./division-authoring.md) last.

## Current Recommended Implementation Scope

Prioritize only Phase 1a and Phase 1b required capabilities:

- Single Agent infrastructure core.
- VP operations access and routing.
- Basic workflow state management.
- Message and event persistence.
- Cost guard and basic approval.
- Crash recovery.
- Multi-Agent orchestration minimum happy path.

Content to not do prematurely:

- Multi-tenancy.
- Marketplace.
- Complete 8-dimensional evolution.
- Full long-term memory/knowledge governance capabilities all at once.
- Too many division deployments.
- Complex web experience and enterprise compliance capabilities.

## Phase 1a Implementation Sequence Recommendation

1. Establish project directory and configuration skeleton.
2. Implement minimum storage model for tasks, sessions, events, and workflow state.
3. Complete single task happy path from reception, execution to return.
4. Add cost guard, basic approval, and error system.

## Phase 1b Enhancement Recommendations

1. Introduce VP operations, VP orchestration, and basic task dashboard.
2. Complete cross-division splitting and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Reserve hooks for future memory and governance.

## Document Conventions

- Overview is responsible for explaining "what the platform is".
- ADR is responsible for explaining "why the design is this way".
- Guides are responsible for explaining "how to do specific things".
- Deduplicated archive versions serve only as historical reference, no longer the preferred entry point.

## Troubleshooting

### Common Issues

#### 1. Build Failed (npm run build)

**Symptoms**: TypeScript compilation errors or module not found

**Troubleshooting Steps**:
1. Confirm Node.js version >= 22 (`node --version`)
2. Clear cache: `rm -rf dist node_modules && npm install`
3. Rebuild: `npm run build`

#### 2. Test Failed (npm test)

**Symptoms**: Unit tests or integration tests error

**Troubleshooting Steps**:
1. Confirm build artifacts are latest: `npm run build:test`
2. Run quick layered regression first: `npm run test:layers:smoke`
3. Locate by layer: `npm run test:unit` / `npm run test:invariants` / `npm run test:integration` / `npm run test:e2e`
4. Check for uncommitted migration file conflicts
5. Check specific test file location and error messages
6. Run single test file to locate issue: `node --import tsx --test tests/unit/xxx.test.ts`

#### 3. Type Check Failed (npm run typecheck)

**Symptoms**: `tsc --noEmit` reports type errors

**Troubleshooting Steps**:
1. Check if error file imports non-existent modules
2. Confirm all `.ts` imports use `.js` extension (ESM spec)
3. Check if `src/platform/` directory structure mirrors `tests/` structure

#### 4. Document Links Invalid

**Symptoms**: Clicking links in documents jump to 404 pages

**Troubleshooting Steps**:
1. Confirm target file exists in current language directory tree (Chinese docs in `docs_zh/`, English docs in `docs_en/`)
2. Check if relative paths are correct (use `../` for parent directory)
3. Confirm document numbers match actual filenames

### Debugging Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Type check | `npm run typecheck` | Validate TypeScript types |
| Layered smoke | `npm run test:layers:smoke` | Run unit + invariants first |
| Layered dev regression | `npm run test:layers:dev` | Run unit + invariants + golden |
| Single layer test | `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` | Locate issues by layer |
| Build diagnostics | `npm run build 2>&1 | grep error` | Filter build errors |
| Document validation | `npm run docs:markdown-render` | Check document rendering and Markdown structure |