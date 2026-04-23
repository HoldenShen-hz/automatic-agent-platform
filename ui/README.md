# Cross-Platform UI Workspace

This workspace implements the UI baseline described in `docs_zh/architecture/05-cross-platform-ui-architecture.md`.

## Layout

- `packages/shared/*`: shared core
- `packages/ui-core`: shared web/desktop UI primitives
- `packages/ui-mobile`: mobile-aligned primitives and navigation contracts
- `packages/features/*`: feature modules
- `apps/*`: platform shells
- `tools/*`: codegen, mock server, e2e helpers

## Commands

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run dev:web`
