# Automatic Agent Platform

Enterprise automatic-agent platform baseline built on Node.js 22 + TypeScript ESM. The documentation set retains historical seven-layer design material for traceability, while the live runtime implementation is organized around five execution planes under `src/platform/five-plane-*`.

Current release baseline: `0.2.0` (`2026-05-27`). Unreleased changes continue to accumulate in the root `CHANGELOG.md`.

## Quick Start

```bash
nvm use
npm ci
npm run build
npm test
```

`npm test` runs the repository baseline gate (`typecheck`, repo hygiene audits, `test:raw`, coverage gate, and stable validation). Use `npm run test:unit`, `npm run test:integration`, `npm run test:golden`, `npm run test:invariants`, `npm run test:leaks`, or `npm run test:raw` for narrower loops.

`npm run aa:dev` is a development-only shortcut that requires dev dependencies such as `tsx`; production or container environments should use the built CLI (`aa ...` or `npm run api`) after `npm run build`.

`npm run test:golden` is a targeted contract-snapshot suite. A single golden test file may validate multiple `.golden` fixtures, and the repository hygiene gate now audits that every referenced snapshot exists.

Common local commands:

```bash
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
npm run migrate:status
aa doctor
aa platform-operator
```

Validation and release helpers:

```bash
npm run lint
npm run typecheck
npm run coverage:gate
npm run changelog:check
npm run test:layers:smoke
npm run package:stable
```

Stable script overview:

- `npm run package:stable` — package assembly and release artifact checks
- `npm run validate:stable` — contract/config/runtime validation gate
- `npm run migration:stable` — migration and persistence readiness gate
- `npm run chaos:stable` — controlled chaos/recovery drill entry
- `npm run concurrency:stable` — concurrency and queue pressure validation
- `npm run db-queue-disconnect:stable` — DB/queue disconnect recovery validation

## Documentation

- `docs_zh/architecture/00-platform-architecture.md` — 中文架构源文档
- `docs_en/architecture/00-platform-architecture.md` — English architecture source
- `docs_zh/architecture/01-code-structure.md` — code structure design
- `docs_zh/migration/README.md` — migration rules and E2E workflow migration index
- `docs_zh/adr/` — architectural decisions
- `docs_zh/contracts/` — authoritative contracts
- `docs_zh/contracts/oapeflir_loop_contract.md` — OAPEFLIR loop contract and runtime-evidence boundary
- `docs_zh/governance/repository-guide-index.md` — root guide index for `README` / `CONTRIBUTING` / `AGENTS` / `CLAUDE` / `MEMORY`
- `docs_zh/governance/source_of_truth.md` — source-of-truth hierarchy
- `docs_zh/governance/naming_and_directory_conventions.md` — naming and directory constraints
- `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md` — unique v3.2 governance baseline release document
- `docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md` — v3.3 implementation baseline + P0 pilot launch readiness
- `docs_zh/quality/buglist.md` — canonical buglist
- `docs_zh/reference/docs-sync.md` — zh/en sync rules and delayed-translation policy
- `docs_zh/reference/division-catalog.md` — division family map, canonical surfaces, and legacy aliases
- `translate_docs.py` — maintenance-only translation helper that auto-discovers `docs_en/**/*.md` files still containing Chinese text
- `docs_zh/analysis/00-architecture-coverage-matrix.md` — chapter-to-code coverage matrix
- `docs_zh/analysis/01-codebase-vs-design-review.md` — current codebase review

## Project Structure

```text
src/
  apps/             # app entrypoints and launch surfaces
  benchmarks/       # performance and benchmark helpers
  platform/         # five planes plus shared contracts / gateway / prompt / stability modules
    five-plane-interface/
    five-plane-control-plane/
    five-plane-orchestration/
    five-plane-execution/
    five-plane-state-evidence/
  domains/          # domain descriptor, onboarding, prompt/eval/domain registry
  interaction/      # NL entry, goal decomposition, proactive agent, dashboard, UX
  org-governance/   # org model, approval routing, SSO/SCIM, compliance, knowledge boundary
  scale-ecosystem/  # multi-region, resource manager, SLA, marketplace, feedback, connectors
  ops-maturity/     # explainability, panic/resume, edge runtime, drift, cost, debugger, multimodal
  sdk/              # CLI and SDK-facing entry surfaces
  plugins/          # built-in plugin/runtime extension points
  testing/          # test-support utilities shipped with source
tests/
  unit/ integration/ golden/ e2e/ invariants/ performance/ leaks/ helpers/
  fixtures/packs/   # example pack fixtures for naming/validation coverage, not publishable packages
```

## Current Notes

- `src/core/runtime/` remains as a compatibility surface for legacy imports; primary runtime changes should land in the five-plane modules unless a compatibility export is intentionally required.
- `src/runtime/agent-runtime/` and `src/core/runtime/` are compatibility/runtime-boundary surfaces; document changes there alongside the governance source-of-truth notes.
- `src/plugins/` contains built-in runtime plugins, `tests/fixtures/packs/` contains pack fixtures only, `src/sdk/harness-sdk/` contains the harness-facing SDK surface, and `src/scale-ecosystem/marketplace/` contains marketplace/runtime registry services.
- Division families are intentionally scoped, not synonymous: `quality-assurance` is the canonical release-certification division, while `qa` is a lightweight smoke-validation alias; the operations family split is documented in `docs_zh/reference/division-catalog.md` and `config/quality/division-catalog.json`.
- Root docs, ADR, contracts, and review matrices are expected to stay consistent. If a boundary changes, update the matching contract and tests in the same change.
- Common operator commands are summarized here; contributor workflow details live in `CONTRIBUTING.md`.

## License

[LICENSE](./LICENSE) (`MIT`). See [SECURITY.md](./SECURITY.md) for disclosure workflow and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for dependency attribution notes.
