# Chaos Experiment Catalog

Chaos manifests in this directory are controlled rehearsal inputs. They must stay opt-in and approval-gated.

The authoritative scenario inventory is `deploy/chaos/catalog.json`. Scheduler-side fallback profiles are exported from `src/ops-maturity/chaos/chaos-experiment-types.ts` as `DEFAULT_CHAOS_SCENARIO_CATALOG` and `DEFAULT_CHAOS_FALLBACK_PROFILES`.

## Current Scenarios

- `pod-kill.yaml`: workload restart resilience.
- `network-delay.yaml`: latency and retry behavior.
- `postgres-disconnect.yaml`: database disconnect handling.
- `redis-disconnect.yaml`: queue/cache disconnect handling.
- `approval-policy.yaml`: required approval policy for chaos execution.
- `catalog.json`: contract-level scenario catalog and fallback-profile mapping.

## Safety Rules

- Run only in approved non-production or rehearsal environments unless an explicit production game day is approved.
- Attach the experiment, approval, start time, stop time, and rollback evidence to the release or rehearsal record.
- Stop immediately if blast radius exceeds the approved scope.
