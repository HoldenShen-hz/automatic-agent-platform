# Legacy Runtime Compatibility Directory

`src/core/runtime/` is a compatibility layer for historical imports. It is not the canonical home for new runtime logic.

## Rules

- New runtime features belong under the relevant `src/platform/five-plane-*` directory.
- Files here should be wrappers, adapters, or re-exports that preserve existing imports.
- If a wrapper grows behavior, move the behavior to the five-plane implementation and keep only the compatibility surface here.
- Any new file in this directory must include a migration reason in the review or PR description.

## Canonical Homes

- Queue, dispatch, budget, recovery, side effects: `src/platform/five-plane-execution/`
- Planner, workflow, delegation: `src/platform/five-plane-orchestration/`
- API/channel ingress: `src/platform/five-plane-interface/`
- Evidence, durable events, truth store: `src/platform/five-plane-state-evidence/`
- IAM, rollout, config, policy: `src/platform/five-plane-control-plane/`
