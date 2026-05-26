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

## 2.1 Package Exports and Stability Boundaries

Root `package.json` currently additionally exports `./apps`, `./domains`, `./interaction`, `./ops-maturity`, `./org-governance`, `./platform`, `./platform/*`, `./plugins`, `./scale-ecosystem/*` and other entry points.

Stability rules:

- `./sdk`, `./sdk/cli`, `./cli`, `./operator` belong to **versioned stable surface** and must comply with this contract.
- `./apps`, `./domains`, `./interaction`, `./platform*`, `./plugins`, `./scale-ecosystem*` belong to **code-level compatibility exports**, used for monorepo / integration testing / gradual migration; do not individually promise semver stability; if opened externally, must first supplement corresponding contract and type surface documentation.
- If external documentation does not separately list an export family, default to "internal compatibility export" handling, must not be treated as stable public API by marketplace / third-party SDKs.

## 3. Core Objects

```typescript
interface SdkReleaseDescriptor {
  sdk_semver: string;
  platform_min_version: string;
  platform_max_version: string;
  deprecation_policy: "notify_only" | "block" | "migration_required" | "hard_cutoff";
}
```

## 4. CLI Surface

- Each CLI entry must correspond to a stable command semantics and help text.
- If CLI output is consumed by scripts, must provide structured JSON mode or stable field format.
- CLI must not bypass API / contract to directly tamper authoritative state.

## 5. Client SDK Surface

```typescript
interface ApiClient {
  get<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<ApiResponse<T>>;
  post<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
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
- `SdkReleaseDescriptor` takes `sdk_semver / platform_min_version / platform_max_version / deprecation_policy` from Pack manifest as canonical form.
- Current SDK release baseline is `0.1.0`, recorded synchronously in root `CHANGELOG.md` and `docs_zh/CHANGELOG.md`.
- `ApiClient` base read/write interface must return unified `ApiResponse<T>` envelope.
- SDK may deprecate old surface but must provide migration window or alternative command/interface.
- CLI, Pack SDK, Plugin SDK must not use different field naming for the same canonical object.

## 8. Testing Requirements

- unit: schema, types, and error semantics for each SDK surface.
- integration: CLI/Client/Pack/Plugin with platform contract integration.
- contract: version, compatibility, and breaking change metadata stable and parseable.