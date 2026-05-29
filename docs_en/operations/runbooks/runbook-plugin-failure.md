# Plugin Failure Runbook

## Symptoms

- Plugin runtime error, timeout or crash loop
- Sandbox denial or protocol failure repeats
- A certain domain workflow fails, but other parts of the system remain healthy

## Diagnosis

1. Confirm affected plugin ID, SPI type and runtime isolation mode.
2. Determine if the plugin is a built-in domain plugin or external package.
3. For built-in plugins, first check against current canonical IDs:
   - `plugin.operations.retriever`
   - `plugin.operations.presenter`
   - `plugin.gamedev.retriever`
   - `plugin.gamedev.engine_adapter`
   - `plugin.livestream.retriever`
   - `plugin.livestream.obs_adapter`
4. Check plugin runtime host logs to confirm if it's timeout, protocol or sandbox error.
5. Confirm plugin currently running in `forked_process`, `sandboxed_process` or `containerized_process`.
6. Check recent plugin manifest, sandbox policy or credential changes.

## Resolution

1. First disable or isolate the faulty plugin binding to prevent impact from spreading.
2. If the issue is related to isolation level, roll back to a safer runtime profile rather than directly relaxing permissions.
3. If it's a bad version release, restore to previous plugin version and re-do health check.
4. If plugin depends on external credentials or APIs, first fix or rotate them, then restore traffic.

## Verification

1. Confirm plugin health check recovered and no new runtime crashes appear.
2. Add a scoped smoke test for affected workflow paths.
3. Record root cause belonging to code, configuration, credentials or sandbox.
4. If the faulty plugin is built-in, use `tests/unit/plugins/builtin-plugin-registry-full.test.ts` to verify manifest metadata.