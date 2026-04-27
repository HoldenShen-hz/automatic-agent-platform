# Quickstart

## Goal

This document helps you quickly find your reading path in the split documentation system and focus your attention on the infrastructure scope you should currently implement, rather than getting lost again in extremely long documents.

## Recommended Reading Order

1. First read [Platform Skeleton](../architecture/00-platform-architecture.md) to build a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand the core main flow.
3. If you currently need to implement memory, cost, or security, additionally read [ADR-003](../adr/003-memory-seven-layers.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md).
4. If you currently need to add business capabilities, read [Division Authoring](./division-authoring.md) last.

## Current Recommended Implementation Scope

Prioritize only Phase 1a and Phase 1b required capabilities:

- Single Agent infrastructure core.
- VP operations access and routing.
- Basic workflow state management.
- Message and event persistence.
- Cost guard and basic approval.
- Crash recovery.
- Multi-Agent orchestration minimal happy path.

What to NOT do prematurely:

- Multi-tenancy.
- Marketplace.
- Full 8-dimensional evolution.
- Full long-term memory/knowledge governance capabilities rolled out at once.
- Too many division deployments.
- Complex web experience and enterprise-level compliance capabilities.

## Phase 1a Implementation Order Recommendations

1. Establish project directory and configuration skeleton.
2. Implement minimal storage models for tasks, sessions, events, and workflow states.
3. Connect the single-task happy path from receiving, executing to returning.
4. Add cost guard, basic approval, and error system.

## Phase 1b Enhancement Recommendations

1. Introduce VP operations, VP orchestration, and basic task board.
2. Connect cross-division splitting and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Reserve hooks for future memory and governance.

## Documentation Conventions

- The master document is responsible for explaining "what the platform is".
- ADRs are responsible for explaining "why this design".
- Guides are responsible for explaining "how to do it specifically".
- Deduplicated archived versions are for historical reference only and no longer serve as the primary entry point.

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
2. Check for uncommitted migration file conflicts
3. Check specific test file location and error messages
4. Run single test file to locate the problem: `node --test dist/tests/unit/xxx.test.js`

#### 3. Type Check Failure (npm run typecheck)

**Symptoms**: `tsc --noEmit` reports type errors

**Troubleshooting Steps**:
1. Check if the error file imports non-existent modules
2. Confirm all `.ts` imports use `.js` extension (ESM specification)
3. Check if `src/platform/` directory structure mirrors `tests/` structure

#### 4. Documentation Link Broken

**Symptoms**: Clicking links in documentation leads to 404 page

**Troubleshooting Steps**:
1. Confirm target file exists in `docs_zh/` directory tree
2. Check if relative path is correct (use `../` for parent directory)
3. Confirm document numbering matches actual file names

### Debugging Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Type Check | `npm run typecheck` | Validate TypeScript types |
| Test Coverage | `npm run test:unit -- --test-name-pattern="xxx"` | Run single test |
| Build Diagnostic | `npm run build 2>&1 | grep error` | Filter build errors |
| Documentation Validation | `npm run docs:lint` | Check documentation links and formatting |