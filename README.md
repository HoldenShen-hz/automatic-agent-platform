# Automatic Agent Platform

Enterprise automatic-agent platform baseline built on Node.js 22 + TypeScript ESM. The repository now follows the v2.7 seven-layer architecture defined in `docs_zh/automatic_agent_patform_arthitecture_design.md`, with ADR, contract, source, and test coverage tracked in `docs_zh/reviews/architecture_v2_7_coverage_matrix.md`.

## Quick Start

```bash
npm ci
npm run build
npm test
```

Common local commands:

```bash
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
```

## Documentation

- `docs_zh/automatic_agent_patform_arthitecture_design.md` — v2.7 architecture source
- `docs_zh/code_struct_design.md` — code structure design
- `docs_zh/migrate_guideline.md` — migration rules
- `docs_zh/adr/` — architectural decisions
- `docs_zh/contracts/` — authoritative contracts
- `docs_zh/reviews/architecture_v2_7_coverage_matrix.md` — chapter-to-code coverage matrix
- `docs_zh/reviews/codebase_vs_design_review.md` — current codebase review

## Project Structure

```text
src/
  platform/         # five planes: interface / control-plane / orchestration / execution / state-evidence
  domains/          # domain descriptor, onboarding, prompt/eval/domain registry
  interaction/      # NL entry, goal decomposition, proactive agent, dashboard, UX
  org-governance/   # org model, approval routing, SSO/SCIM, compliance, knowledge boundary
  scale-ecosystem/  # multi-region, resource manager, SLA, marketplace, feedback, connectors
  ops-maturity/     # explainability, panic/resume, edge runtime, drift, cost, debugger, multimodal
  sdk/              # CLI and SDK-facing entry surfaces
  plugins/          # built-in plugin/runtime extension points
tests/
  unit/ integration/ golden/ e2e/
```

## Current Notes

- `src/core/runtime/` is retained only as a compatibility shim layer; canonical orchestration/runtime code lives under `src/platform/execution/` and `src/platform/orchestration/`.
- Root docs, ADR, contracts, and review matrices are expected to stay consistent. If a boundary changes, update the matching contract and tests in the same change.

## License

MIT
