# Plugin Failure Runbook

## Symptoms

- plugin runtime errors, timeouts, or crash loops
- repeated sandbox denials or protocol failures
- specific domain workflows fail while the rest of the system stays healthy

## Diagnosis

1. Identify the affected plugin ID, SPI type, and runtime isolation mode.
2. Confirm whether the plugin is a built-in domain plugin or an external package.
3. For built-ins, first compare against the current canonical IDs:
   - `plugin.operations.retriever`
   - `plugin.operations.presenter`
   - `plugin.gamedev.retriever`
   - `plugin.gamedev.engine_adapter`
   - `plugin.livestream.retriever`
   - `plugin.livestream.obs_adapter`
2. Review plugin runtime host logs for timeout, protocol, or sandbox errors.
3. Confirm whether the plugin is running in `forked_process`, `sandboxed_process`, or `containerized_process`.
4. Check recent plugin manifest, sandbox policy, or credential changes.

## Mitigation

1. Deactivate or quarantine the failing plugin binding to stop impact propagation.
2. If the issue is isolation-related, fall back to a safer runtime profile rather than widening permissions.
3. If the issue is a bad release, restore the previous plugin version and re-run health checks.
4. If the plugin depends on external credentials or APIs, rotate or repair them before re-enabling traffic.

## Verification

1. Confirm plugin health checks recover and no new runtime crashes appear.
2. Re-run the affected workflow path with a bounded smoke test.
3. Record whether the failure was code, config, credential, or sandbox related.
4. If the failing plugin is built-in, verify manifest metadata with `tests/unit/plugins/builtin-plugin-registry-full.test.ts`.
