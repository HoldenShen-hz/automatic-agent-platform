# Quickstart

## Objective

This document helps you quickly find reading paths in the split document system, and focus attention on the current most important infrastructure scope to implement, rather than getting lost in super-long documents again.

## Recommended Reading Order

1. First read [Platform Skeleton](../architecture/00-platform-architecture.md) to build a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand core main chain.
3. If currently implementing memory, cost, or security, read [ADR-003](../adr/003-memory-six-layers.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md) additionally.
4. If currently adding business capabilities, read [Division Authoring](./division-authoring.md) last.

## Current Suggested Implementation Scope

Prioritize only Phase 1a and Phase 1b required capabilities:

- Single Agent infrastructure core.
- VP Operations access and routing.
- Basic workflow state management.
- Message and event persistence.
- Cost guard and basic approval.
- Crash recovery.
- Multi-Agent orchestration minimal happy path.

Content not to do ahead of time:

- Multi-tenancy.
- Marketplace.
- Full 8-dimensional evolution.
- All long-term memory/knowledge governance capabilities rolled out at once.
- Too many division expansions.
- Complex web experience and enterprise compliance capabilities.

## Phase 1a Implementation Order Suggestions

1. Establish project directory and configuration skeleton.
2. Implement minimum storage model for tasks, sessions, events, and workflow state.
3. Get through single task from reception, execution to return happy path.
4. Add cost guard, basic approval, and error system.

## Phase 1b Reinforcement Suggestions

1. Introduce VP Operations, VP Orchestration, and basic task dashboard.
2. Get through cross-division splitting and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Reserve embeddings for future memory and governance.

## Document Conventions

- Overview is responsible for explaining "what the platform is".
- ADR is responsible for explaining "why the design is this way".
- Guides are responsible for explaining "how to do it specifically".
- Deduplicated archive version is for historical reference only; no longer the preferred entry point.

## Troubleshooting

### Common Issues

#### 1. Build Failure (npm run build)

**Symptoms**: TypeScript compilation errors or module not found

**Troubleshooting Steps**:
1. Confirm Node.js version >= 22 (`node --version`)
2. Clear cache: `rm -rf dist node_modules && npm install`
3. Rebuild: `npm run build`

#### 2. Test Failure (npm test)

**Symptoms**: Unit test or integration test errors

**Troubleshooting Steps**:
1. Confirm build artifacts are latest: `npm run build:test`
2. Run quick layered regression first: `npm run test:layers:smoke`
3. Locate by layer: `npm run test:unit` / `npm run test:invariants` / `npm run test:integration` / `npm run test:e2e`
4. Check for uncommitted migration file conflicts
5. View specific test file location and error messages
6. Run single test file to locate problem: `node --import tsx --test tests/unit/xxx.test.ts`

#### 3. Type Check Failure (npm run typecheck)

**Symptoms**: `tsc --noEmit` reports type errors

**Troubleshooting Steps**:
1. Check if error file imports non-existent modules
2. Confirm all `.ts` imports use `.js` extension (ESM spec)
3. Check if `src/platform/` directory structure mirrors `tests/` structure

#### 4. Document Link Failure

**Symptoms**: Clicking links in documents jumps to 404 page

**Troubleshooting Steps**:
1. Confirm target file exists in `docs_zh/` directory tree
2. Check if relative paths are correct (use `../` for parent directory)
3. Confirm document numbers match actual filenames

### Debugging Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Type check | `npm run typecheck` | Validate TypeScript types |
| Layered smoke | `npm run test:layers:smoke` | Run unit + invariants first |
| Layered dev regression | `npm run test:layers:dev` | Run unit + invariants + golden |
| Single layer test | `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` | Locate problems by layer |
| Build diagnostics | `npm run build 2>&1 | grep error` | Filter build errors |
| Document validation | `npm run docs:lint` | Check document links and format |
