# Memory Pressure Runbook

## Symptoms

- `AutomaticAgentMemoryPressure` alert firing
- RSS remains above 512MiB
- runtime latency and GC pause time increase

## Diagnosis

1. Check memory growth over time to distinguish leak vs load spike.
2. Identify whether growth is in RSS, heap, or external memory.
3. Correlate memory growth with recent plugin activations, large artifact bundles, or replay jobs.
4. Inspect queue backlog and active execution counts to see if the system is overloaded rather than leaking.

## Mitigation

1. Pause non-critical or batch workloads first.
2. Disable the offending plugin, workflow, or ingestion path if memory growth is isolated.
3. Restart the service only after preserving enough evidence to diagnose the cause.
4. If capacity is legitimately too low, scale memory limits and replica count together.

## Verification

1. Confirm RSS drops below the alert threshold and remains stable.
2. Verify health status returns to `ok` or `degraded` without repeated oscillation.
3. Open follow-up work if a leak signature or unsafe workload pattern is confirmed.