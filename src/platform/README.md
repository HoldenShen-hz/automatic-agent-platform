# Platform Directory Contract

`src/platform/` contains the five-plane runtime implementation. The canonical implementation directories are:

- `five-plane-interface`
- `five-plane-control-plane`
- `five-plane-orchestration`
- `five-plane-execution`
- `five-plane-state-evidence`

## Compatibility Symlinks

The following compatibility symlinks exist for legacy imports and operator ergonomics:

- `interface -> five-plane-interface`
- `control-plane -> five-plane-control-plane`
- `orchestration -> five-plane-orchestration`
- `execution -> five-plane-execution`
- `state-evidence -> five-plane-state-evidence`

New source code should prefer canonical `five-plane-*` paths or package exports. Do not add new compatibility symlinks without updating this file and the related architecture review evidence.

## Boundary Rules

- Interface plane owns API/channel ingress.
- Control plane owns policy, rollout, IAM, and routing decisions.
- Orchestration plane owns planning, delegation, and workflow coordination.
- Execution plane owns dispatch, tools, recovery, budgets, side effects, and worker interaction.
- State/evidence plane owns truth stores, durable events, memory, audit evidence, and replayable records.

Cross-plane calls should go through explicit contracts or services rather than deep imports into another plane's internals.

## Bootstrap Files

- `platform-mainline-bootstrap.ts` is the mainline runtime assembly entry for platform wiring.
- `platform-module-catalog.ts` is an inventory/catalog helper and must not start runtime services.
- Plane-specific bootstrap files stay under their owning `five-plane-*` directory.

Do not add a new top-level bootstrap file unless it is listed here with a single owner and call path.
