# Operations Checklist

> This file consolidates all checklist documents under `docs_zh/operations/`.
> Generated from task 9A of `research/reference-alignment/reference_cross_analysis_and_todolist.md`.

## 1. Pre-Launch Top 20 Hard Checklist

Source: `pre_launch_top20_hard_checklist.md`

### P0 — Production Blockers (Must all be completed)

| # | Check Item | Verification Method |
| --- | --- | --- |
| 1 | `npm run build` succeeds without errors | Local build |
| 2 | `npm run typecheck` with zero errors | Local typecheck |
| 3 | `npm run test` passes fully | Local test (actual test count see latest value in `project_progress_tracker.md`) |
| 4 | All webhooks use signature verification | Code review |
| 5 | `authService` refuses to start when empty, does not default-trust request headers | Code review |
| 6 | All key comparisons use `timingSafeEqual` | `grep` search |
| 7 | All POST routes have Zod schema validation | Code review |
| 8 | HTTP body size limited (≤1MB for public API) | Code review |
| 9 | No SQL injection risk (parameterized queries) | Code review |
| 10 | Fork bomb / shell injection protection activated | Security testing |
| 11 | SSRF guard applies to all outbound URLs | Code review |
| 12 | Multi-tenant isolation — all queries include `tenant_id` | Code review |
| 13 | WAL mode SQLite has backup process | Script verification |
| 14 | Graceful shutdown can complete subprocess cleanup within 15s | Practical testing |
| 15 | Timer leak issues reduced to zero | Test verification |
| 16 | `global setup/teardown` can detect zombie processes | Test verification |
| 17 | Docker uses tini as PID 1 | Dockerfile review |
| 18 | CI includes lint / test / coverage / audit | CI configuration review |
| 19 | `.env` not committed to git | `git status` check |
| 20 | `/healthz` endpoint returns DB + Provider status | curl test |

### P1 — Production Quality Items (Goals, but not blocking release)

| # | Check Item |
| --- | --- |
| 21 | ESLint no critical/warning (core paths) |
| 22 | All CLIs unify bootstrap/teardown pattern |
| 23 | Structured logger supports JSONL file output |
| 24 | AsyncLocalStorage traceId context injection |
| 25 | Node 22 CI pipeline all green |

---

## 2. Pre-Coding Checklist

Source: `pre_coding_checklist.md`

Before starting new features or refactoring, must confirm:

### Scope and Design

- [ ] Has corresponding issue or ADR
- [ ] ADR reviewed and accepted (if involves core contract changes)
- [ ] Impact scope evaluated (which modules, which tests affected)
- [ ] Has backward compatibility strategy, or clearly marked incompatible as breaking change
- [ ] If involves schema changes, has migration script

### Code Quality

- [ ] TypeScript strict mode compliant
- [ ] No new `as unknown as` (type safety rule)
- [ ] No bare `console.log` (use StructuredLogger)
- [ ] No direct `process.env` (use through config loader)
- [ ] Public API has type signatures
- [ ] Error codes comply with `error_code_registry_contract.md` specification

### Testing

- [ ] Has corresponding unit test file
- [ ] Has corresponding integration test (if involves cross-module)
- [ ] Tests verified through `npm run test`

---

## 3. Documentation Completion Gate

Source: `documentation_completion_gate.md`

Documents required before core module completion:

| Module | Required Document |
| --- | --- |
| New API route | Update `docs_zh/contracts/api_surface_contract.md` or related API contract |
| New Schema changes | Update `docs_zh/contracts/storage_schema_contract.md` |
| New event type | Update `docs_zh/contracts/event_bus_contract.md` or corresponding event contract |
| New security mechanism | Update `docs_zh/contracts/sandbox_and_auth_contract.md` |
| New provider | Update `docs_zh/contracts/tool_and_provider_execution_contract.md` |
| New workflow type | Update `docs_zh/contracts/task_and_workflow_contract.md` |
| New contract | Must create `docs_zh/contracts/<name>_contract.md` |

---

## 4. Release Readiness Checklist

Source: `../quality/01-release-checklist.md`

Must pass before complete version release, see [../quality/01-release-checklist.md](../quality/01-release-checklist.md).

Current release status (2026-05-27):

- `canary / tenant_gray`: Has smoke evidence, can pass stable gate.
- `production_ready`: All gate items passed except `24h` / `72h` long-stability evidence; current remaining blocker is only long-stability evidence missing.

---

## 5. Document Maintenance Rules

- After all checklist updates, synchronously update corresponding chapters in this file
- Must complete "Pre-Launch Top 20 Hard Checklist" before major version release
- Pre-coding checklist should be referenced in each PR's reviewer checklist
- Documentation completion gate as necessary condition for module merge