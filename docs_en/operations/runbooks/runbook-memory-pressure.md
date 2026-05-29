# Memory Pressure Runbook

## Symptoms

- `AutomaticAgentMemoryPressure` alert continuously triggered
- RSS continuously above current alert threshold `450MiB` (see Prometheus rule)
- Runtime latency and GC pause time rise synchronously

## Diagnosis

1. First check if memory curve is continuously monotonic increasing to distinguish leak vs short-term load spike.
2. Distinguish whether growth occurs in RSS, heap or external memory.
3. Correlate growth window with recent plugin activations, large artifact bundles, replay jobs, batch imports and other events.
4. Also check queue backlog and active execution count to determine if it's capacity insufficiency or unreleased objects.

## Resolution

1. First pause non-critical or batch workloads to reduce the surface area that continues amplifying pressure.
2. If growth has been localized to single plugin, workflow or ingestion path, first locally remove that path.
3. Only allow service restart after evidence has been preserved to avoid clearing leak clues along with it.
4. If confirmed as capacity baseline insufficiency rather than leak, simultaneously increase memory limit and replica count, do not just add single Pod memory.

## Verification

1. Confirm RSS dropped below `450MiB` threshold and remained stable within 10-minute alert window.
2. Verify health status returned to `ok` or stable `degraded`, must not oscillate repeatedly.
3. If leak characteristics or dangerous workload patterns have been confirmed, must add follow-up remediation items, not just do one restart.