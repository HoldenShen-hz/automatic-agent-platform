# SDK Surface Contract

## 1. Scope

This contract defines the external surface and compatibility principles for CLI, Client SDK, Pack SDK, and Plugin SDK under `src/sdk/`.

Related documents:

- `api_surface_contract.md`
- `plugin_spi_contract.md`
- `marketplace_catalog_and_revenue_contract.md`

## 2. SDK Layering

| Subdomain | Directory | Purpose |
| --- | --- | --- |
| CLI | `src/sdk/cli/` | Operations, development, and verification entry point |
| Client SDK | `src/sdk/client-sdk/` | Typed API calls |
| Pack SDK | `src/sdk/pack-sdk/` | Pack scaffold / lifecycle / compatibility |
| Plugin SDK | `src/sdk/plugin-sdk/` | Plugin definition, context, and test harness |

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

- Each CLI entry must correspond to stable command semantics and help text.
- CLI output for script consumption must provide structured JSON mode or stable field format.
- CLI must not bypass API / contract to directly tamper with authoritative state.

## 5. Client SDK Surface

```typescript
interface ApiClient {
  get(path: string, params?: Record<string, string | number | boolean>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
}
```

Rules:

- Client SDK should be derived from the same API schema / contract, without maintaining private field forks.
- Network errors, authentication errors, and business rejections must preserve distinguishable error types.

## 6. Pack / Plugin SDK Surface

- Pack SDK must expose manifest, compatibility, local test, and scaffold capabilities.
- Plugin SDK must expose plugin definition, runtime context, and test harness.
- Pack/Plugin SDK version declarations must be cross-verifiable with the marketplace compatibility matrix.

## 7. Compatibility and Deprecation

- Breaking changes must be explicitly listed in the release descriptor.
- SDK may deprecate old surfaces, but must provide migration window or alternative commands/interfaces.
- CLI, Pack SDK, and Plugin SDK must not use different field naming for the same canonical object.

## 8. Testing Requirements

- unit: Schema, types, and error semantics for each SDK surface.
- integration: CLI/Client/Pack/Plugin integration with platform contracts.
- contract: Version, compatibility, and breaking change metadata must be stably parseable.
