# UI Design vs Implementation Consistency Review

> Maintenance date: 2026-05-27
> Scope: `ui/apps/web`, shared state layer, feature registry, multi-terminal shell.

## Current Conclusion

| GAP | Conclusion | Evidence |
|---|-------|--------|
| GAP-01 Route vs feature registry alignment | Closed | `ui/apps/web/src/feature-registry.ts`, `ui/tsconfig.json`, `tests/features/registry.test.ts` |
| GAP-02 State layer vs feature VM alignment | Closed | `ui/packages/shared/state/src/index.ts`, `ui/packages/features/task-cockpit/src/hooks/index.ts`, `ui/packages/features/workflow-builder/src/hooks/index.ts` |
| GAP-03 UI contract entry vs versioned source alignment | Closed | `ui/packages/shared/api-client/src/endpoints.ts`, `ui/apps/web/src/app-shell.tsx`, `docs_zh/contracts/ui_console_and_cockpit_contract.md` |

## Regression Commands

```bash
npm --prefix ui run typecheck
npm --prefix ui run test -- tests/features/registry.test.ts tests/features/flows.test.tsx
```

## Maintenance Rules

- New UI GAPs must state source entry, test command, and unclosed risks.
- No longer accept "completed" rewrites without file and command evidence.