# SDK Surface Contract

## 1. Scope

This contract defines the external surface and compatibility principles for CLI, Client SDK, Pack SDK, and Plugin SDK under `src/sdk/`.

Related documents:

- `api_surface_contract.md`
- `plugin_spi_contract.md`
- `marketplace_catalog_and_revenue_contract.md`

## 2. SDK Layers

| Subdomain | Directory | Target |
| --- | --- | --- |
| CLI | `src/sdk/cli/` | Operations, development, verification entry |
| Client SDK | `src/sdk/client-sdk/` | Typed API calls |
| Pack SDK | `src/sdk/pack-sdk/` | Pack scaffold / lifecycle / compatibility |
| Plugin SDK | `src/sdk/plugin-sdk/` | Plugin definition, context, test harness |

## 3. Core Objects

```typescript
interface SdkReleaseDescriptor {
  sdkName: "cli" | "client" | "pack" | "plugin";
  version: string;
  apiContractVersion: string | null;
  runtimeCompatibility: string[];
  breakingChanges: string[];
}
```

## 4. CLI Surface

- Each CLI entry must correspond to a stable command semantics and help text.
- If CLI output is consumed by scripts, must provide structured JSON mode or stable field format.
- CLI must not bypass API / contract to directly tamper authoritative state.

## 5. Client SDK Surface

```typescript
interface ApiClient {
  get(path: string, params?: Record<string, string | number | boolean>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  getTaskCockpitByHarnessRunId(harnessRunId: string): Promise<unknown>;
  getWorkflowCockpitByHarnessRunId(harnessRunId: string): Promise<unknown>;
  getAdminTakeoverConsoleByHarnessRunId(harnessRunId: string): Promise<unknown>;
  getTaskCockpitByTaskId(taskId: string): Promise<unknown>;
}
```

Rules:

- Client SDK should be derived from the same API schema / contract, not maintain private field forks.
- Network errors, auth errors, business rejections must retain distinguishable error types.

## 6. Pack / Plugin SDK Surface

- Pack SDK must expose manifest, compatibility, local test, scaffold capabilities.
- Plugin SDK must expose plugin definition, runtime context, test harness.
- Pack/Plugin SDK version declarations must be cross-verifiable with marketplace compatibility matrix.

## 7. Compatibility and Deprecation

- Breaking changes must be explicitly listed in release descriptor.
- SDK may deprecate old surface but must provide migration window or alternative command/interface.
- CLI, Pack SDK, Plugin SDK must not use different field naming for the same canonical object.

## 8. Testing Requirements

- unit: schema, types, and error semantics for each SDK surface.
- integration: CLI/Client/Pack/Plugin with platform contract integration.
- contract: version, compatibility, and breaking change metadata stable and parseable.
