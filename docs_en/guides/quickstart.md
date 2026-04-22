# Quickstart

## Objective

This document helps you quickly find your reading path in the split documentation system, and focus on the current infrastructure scope that should be implemented, rather than getting lost in super-long documents again.

## Recommended Reading Order

1. First read [Platform Skeleton](../architecture/00-platform-architecture.md) to build a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand the core main path.
3. If currently implementing memory, cost, or security, read [ADR-003](../adr/003-memory-seven-layers.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md) respectively.
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
- Full long-term memory/knowledge governance capabilities at once.
- Too many division deployments.
- Complex web experience and enterprise compliance capabilities.

## Phase 1a Rollout Order Suggestions

1. Establish project directory and configuration skeleton.
2. Implement minimum storage model for tasks, sessions, events, and workflow states.
3. Connect single task from reception, execution to return happy path.
4. Add cost guard, basic approval, and error system.

## Phase 1b Enhancement Suggestions

1. Introduce VP operations, VP orchestration, and basic task dashboard.
2. Connect cross-division splitting and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Reserve touchpoints for future memory and governance.

## Documentation Conventions

- Overview is responsible for explaining "what the platform is".
- ADR is responsible for explaining "why this design".
- Guide is responsible for explaining "how to do it specifically".
- Deduplicated archive version is only for historical reference, no longer the preferred entry.

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
1. Confirm build output is latest: `npm run build:test`
2. Check for uncommitted migration file conflicts
3. View specific test file location and error message
4. Run single test file to locate problem: `node --test dist/tests/unit/xxx.test.js`

#### 3. Type Check Failure (npm run typecheck)

**Symptoms**: `tsc --noEmit` reports type errors

**Troubleshooting Steps**:
1. Check if the error file imports non-existent modules
2. Confirm all `.ts` imports use `.js` extension (ESM specification)
3. Check if `src/platform/` directory structure matches `tests/` mirror structure

#### 4. Documentation Link Failure

**Symptoms**: Clicking links in documentation jumps to 404 page

**Troubleshooting Steps**:
1. Confirm target file exists in `docs_en/` directory tree
2. Check if relative path is correct (use `../` for parent directory)
3. Confirm document number matches actual filename

### Debugging Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Type Check | `npm run typecheck` | Validate TypeScript types |
| Test Coverage | `npm run test:unit -- --test-name-pattern="xxx"` | Run single test |
| Build Diagnostics | `npm run build 2>&1 | grep error` | Filter build errors |
| Documentation Validation | `npm run docs:lint` | Check documentation links and format |