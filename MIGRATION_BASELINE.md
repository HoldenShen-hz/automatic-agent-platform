# Migration Baseline

This repository was bootstrapped by migrating the full code, test, config, deploy, and documentation baseline from `automatic_agent_system` into `automatic_agent_platform` on 2026-04-19.

Included in the migration:

- `src/`, `tests/`, `config/`, `divisions/`, `deploy/`, `scripts/`, and root toolchain files
- migrated documentation was later re-homed into `docs_zh/` and `docs_en/`
- the new platform architecture and migration guidance remain under the repository root and the new docs roots

Platform-only additions created during migration:

- `src/core/nl-entry/`
- `src/core/goal-decomposition/`
- `src/core/proactive-agent/`
- `src/core/autonomy/`
- `src/core/dashboard/`
- `src/gateway/user-portal/`

The migrated codebase is the platform implementation baseline. Modules listed above are intentionally skeletal because the source repository did not yet contain their concrete implementations.
