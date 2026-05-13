# Quickstart

## Goal

This document helps you quickly find your reading path within the split documentation system and focus your attention on the infrastructure scope that should be implemented first, rather than getting lost in super-long documents again.

## Recommended Reading Order

1. First read [Platform Skeleton](../architecture/00-platform-architecture.md) to establish a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand the core main path.
3. If currently implementing memory, cost, or security, additionally read [ADR-003](../adr/003-memory-six-layers.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md).
4. If adding new business capabilities, read [Division Authoring](./division-authoring.md) last.

## Current Recommended Implementation Scope

Prioritize only Phase 1a and Phase 1b required capabilities:

- Single Agent infrastructure core.
- VP operations access and routing.
- Basic workflow state management.
- Message and event persistence.
- Cost guard and basic approval.
- Crash recovery.
- Multi-Agent orchestration minimal happy path.

Content to NOT implement prematurely:

- Multi-tenancy.
- Marketplace.
- Full 8-dimensional evolution.
- All long-term memory/knowledge governance capabilities at once.
- Too many division deployments.
- Complex web experience and enterprise compliance capabilities.

## Phase 1a Implementation Order Suggestions

1. Establish project directory and configuration skeleton.
2. Implement minimum storage models for tasks, sessions, events, and workflow states.
3. Connect the single-task happy path from reception, execution, to return.
4. Add cost guard, basic approval, and error system.

## Phase 1b Enhancement Suggestions

1. Introduce VP operations, VP orchestration, and basic task dashboard.
2. Connect cross-division splitting and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Reserve hooks for future memory and governance.

## Documentation Conventions

- Architecture Overview is responsible for explaining "what the platform is".
- ADR is responsible for explaining "why this design was chosen".
- Guides are responsible for explaining "how to do it specifically".
- Deduplicated archive versions are only for historical reference and are no longer the preferred entry point.

## Troubleshooting

### Common Problems

#### 1. Build Failure (npm run build)

**Symptoms**: TypeScript compilation errors or module not found

**Troubleshooting Steps**:
1. Confirm Node.js version >= 22 (`node --version`)
2. Clear cache: `rm -rf dist node_modules && npm install`
3. Rebuild: `npm run build`

#### 2. Test Failure (npm test)

**Symptoms**: Unit tests or integration tests error

**Troubleshooting Steps**:
1. Confirm build artifacts are latest: `npm run build:test`
2. Start with the fast layered regression: `npm run test:layers:smoke`
3. Narrow by layer: `npm run test:unit` / `npm run test:invariants` / `npm run test:integration` / `npm run test:e2e`
4. Check for uncommitted migration file conflicts
5. View specific test file location and error messages
6. Run a single test file to locate the problem: `node --import tsx --test tests/unit/xxx.test.ts`

#### 3. Type Check Failure (npm run typecheck)

**Symptoms**: `tsc --noEmit` reports type errors

**Troubleshooting Steps**:
1. Check if the error file imports a non-existent module
2. Confirm all `.ts` imports use `.js` extension (ESM specification)
3. Check if `src/platform/` directory structure mirrors `tests/` structure

#### 4. Documentation Link Invalid

**Symptoms**: Clicking links in documentation leads to 404 page

**Troubleshooting Steps**:
1. Confirm target file exists in `docs_zh/` directory tree
2. Check if relative path is correct (use `../` for parent directory)
3. Confirm documentation numbering matches actual filenames

### Debugging Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Type Check | `npm run typecheck` | Validate TypeScript types |
| Layered Smoke | `npm run test:layers:smoke` | Run unit + invariants first |
| Layered Dev Regression | `npm run test:layers:dev` | Run unit + invariants + golden |
| Single Layer | `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` | Narrow the failing layer |
| Build Diagnosis | `npm run build 2>&1 | grep error` | Filter build errors |
| Documentation Validation | `npm run docs:lint` | Check documentation links and formatting |