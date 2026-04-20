# Repository Guidelines

## Project Structure & Module Organization
Core application code lives under `src/`. Keep domain services in `src/core/`, operator entrypoints in `src/cli/`, and gateway or streaming adapters in `src/gateway/`. Tests mirror the runtime layout in `tests/unit/`, `tests/integration/`, `tests/golden/`, and `tests/e2e/`. Versioned defaults live in `config/*/default.json`; division definitions live in `divisions/`; generated evidence and local runtime data land in `data/`; design and contract docs belong in `docs_zh/` and `docs_en/`.

## Build, Test, and Development Commands
Run `npm run build` to compile TypeScript into `dist/`. Use `npm test` for the full regression suite; it already runs with `--test-concurrency=12`. Targeted runs are `npm run test:unit`, `npm run test:integration`, and `npm run test:golden`. Common local operator checks are `npm run doctor`, `npm run inspect`, `npm run dispatch-execution`, `npm run worker-handshake`, and `npm run worker-writeback`. Use the `npm run *:stable` scripts when validating rehearsal or evidence flows.

## Coding Style & Naming Conventions
This repository uses TypeScript ESM with 2-space indentation, double quotes, and semicolons. Keep filenames in kebab-case, classes and exported types in PascalCase, and functions or methods in clear verb form such as `buildTaskSnapshot` or `recordHeartbeat`. Prefer small modules scoped to one runtime concern. No formatter is enforced, so match the surrounding file and keep imports grouped as Node, external, then local.

## Testing Guidelines
Put isolated logic in `tests/unit/<area>/` and cross-service, CLI, runtime, or sandbox coverage in `tests/integration/`. Name files `*.test.ts` and keep titles explicit about the observable behavior. Before committing, run the affected targeted suite plus `npm test`. Security-facing changes should add a denial-path regression, for example a sandbox escape, symlink traversal, or config-root rejection case.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects like `Add worker handshake lifecycle` and `Integrate dispatch reconciliation recovery`. Keep commits focused, avoid mixing unrelated docs and runtime work, and make sure `dist/` remains reproducible from source. Pull requests should summarize behavior changes, list validation commands, link the relevant issue or contract, and include terminal output when a CLI or operator path changes.

## Security & Configuration Tips
Treat `config/*/default.json` as versioned defaults, not scratch files. Never loosen sandbox, approval, or file-root checks without updating the matching contract in `docs_zh/contracts/` and adding regression coverage. When a change affects diagnostics or operator recovery, also update the relevant `docs_zh/operations/` tracker so runtime evidence and implementation state stay aligned.
