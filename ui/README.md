# Cross-Platform UI Workspace

This workspace implements the UI baseline described in
`../docs_zh/architecture/05-cross-platform-ui-architecture.md`.

API client details are documented in `../docs_zh/reference/api-client.md`.

## Layout

- `packages/shared/*`: shared core
- `packages/ui-core`: shared web/desktop UI primitives
- `packages/ui-mobile`: mobile-aligned primitives and navigation contracts
- `packages/features/*`: feature modules, documented in `packages/features/README.md`
- `apps/*`: platform shells
- `tools/*`: codegen, mock server, e2e helpers

## Documentation

- Platform UI architecture: `../docs_zh/architecture/05-cross-platform-ui-architecture.md`
- API client: `../docs_zh/reference/api-client.md`
- Feature modules: `packages/features/README.md`

## Commands

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run dev:web`
