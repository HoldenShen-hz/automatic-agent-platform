# SDK Surface Contract

## 1. Scope

This contract defines external surface and compatibility principles for CLI, Client SDK, Pack SDK, and Plugin SDK under `src/sdk/`.

Related documents:

- `api_surface_contract.md`
- `plugin_spi_contract.md`
- `marketplace_catalog_and_revenue_contract.md`
- `docs_zh/reference/api-versioning.md`

## 2. SDK Layering

| Subdomain | Directory | Purpose |
| --- | --- | --- |
| CLI | `src/sdk/cli/` | Operations, development, and verification entry point |
| Client SDK | `src/sdk/client-sdk/` | Typed API calls |
| Pack SDK | `src/sdk/pack-sdk/` | Pack scaffold / lifecycle / compatibility |
| Plugin SDK | `src/sdk/plugin-sdk/` | Plugin definitions, context, test harness |

## 2.1 Package Export and Stability Boundaries

Root `package.json` currently additionally exports `./apps`, `./domains`, `./interaction`, `./ops-maturity`, `./org-governance`, `./platform`, `./platform/*`, `./plugins`, `./scale-ecosystem/*` and other entry points.

Stability rules:

- `./sdk`, `./sdk/cli`, `./cli`, `./operator` belong to **versioned stable surface** and must comply with this contract.
- `./apps`, `./domains`, `./interaction`, `./platform*`, `./plugins`, `./scale-ecosystem*` belong to **code-level compatible exports**, used for monorepo/integration testing/progressive migration; they do not individually promise semver stability; if opened externally, must first supplement corresponding contract and type surface documentation.
- If external documentation does not separately list an export family, it defaults to "internal compatible export" handling and must not be treated as stable public API by marketplace/third-party SDKs.

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
- If CLI output is used for script consumption, must provide structured JSON mode or stable field format.
- CLI must not bypass API/contract to directly tamper with authoritative state.

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

- Client SDK should be derived from the same API schema/contract and must not maintain private field forks.
- Network errors, authentication errors, and business rejections must preserve distinguishable error types.

## 6. Pack / Plugin SDK Surface

- Pack SDK must expose manifest, compatibility, local test, and scaffold capabilities.
- Plugin SDK must expose plugin definition, runtime context, and test harness.
- Pack/Plugin SDK version declarations must be cross-verifiable with marketplace compatibility matrix.

## 7. Compatibility and Deprecation

- Breaking changes must be explicitly listed in release descriptor.
- `SdkReleaseDescriptor` takes Pack manifest's `sdk_semver/platform_min_version/platform_max_version/deprecation_policy` as canonical form.
- Current SDK release baseline is `0.1.0`, recorded synchronously in root `CHANGELOG.md` and `docs_zh/CHANGELOG.md`.
- `ApiClient` basic read/write interface must return unified `ApiResponse<T>` envelope.
- SDK may deprecate old surface but must provide migration window or alternative command/interface.
- CLI, Pack SDK, and Plugin SDK must not use different field naming for the same canonical object.

## 8. Testing Requirements

- Unit: schema, types, and error semantics for each SDK surface.
- Integration: CLI/Client/Pack/Plugin with platform contract linkage.
- Contract: version, compatibility, and breaking change metadata are stably parseable.