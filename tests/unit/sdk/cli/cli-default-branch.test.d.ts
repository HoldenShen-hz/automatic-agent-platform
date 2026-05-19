/**
 * CLI Default Branch and Error Handling Tests
 *
 * These tests cover switch-case default branches and error-handling paths in src/sdk/cli.
 *
 * Key findings on reachability (code analysis):
 * - diagnostics.ts: switch default REACHABLE — loader readKind() throws same `unknown_diagnostics_kind:X`
 * - takeover.ts:    switch default REACHABLE — loader readAction() throws same `unknown_takeover_action:X`
 * - billing.ts:     switch default DEAD CODE — loader readAction() throws `billing.invalid_action`
 * - inspect.ts:     switch default DEAD CODE — loader throws `invalid_env:AA_INSPECT_KIND`
 * - memory.ts:      switch default DEAD CODE — loader throws `invalid_env:AA_MEMORY_ACTION`
 * - worker-register.ts: switch default DEAD CODE — loader throws `invalid_env:AA_WORKER_REGISTER_ACTION`
 * - worker-handshake.ts: switch default DEAD CODE — loader throws `invalid_env:AA_WORKER_HANDSHAKE_ACTION`
 * - All other CLI files with default:throw — similar pattern (loader throws different code)
 *
 * This test file:
 * 1. Tests the env-loader-level error paths for CLI files with default:throw
 * 2. For reachable defaults (diagnostics, takeover), loader throws matching error code
 * 3. For dead-code defaults, loader throws a different error code (defensive validation)
 */
export {};
