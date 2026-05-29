# SDK Surface Contract

## 1. 范围

本 contract defines `src/sdk/` 下 CLI、Client SDK、Pack SDK、Plugin SDK 的对外table面vs兼容principle。

相关文档：

- `api_surface_contract.md`
- `plugin_spi_contract.md`
- `marketplace_catalog_and_revenue_contract.md`
- `docs_zh/reference/api-versioning.md`

## 2. SDK 分层

| 子域 | 目录 | 目标 |
|---|-------|--------|
| CLI | `src/sdk/cli/` | 运维、开发、验证入口 |
| Client SDK | `src/sdk/client-sdk/` | class型化 API call |
| Pack SDK | `src/sdk/pack-sdk/` | pack scaffold / lifecycle / compatibility |
| Plugin SDK | `src/sdk/plugin-sdk/` | plugin defines、上下文、测试 harness |

## 2.1 包exportvs稳定性边界

根 `package.json` 当前额外export `./apps`、`./domains`、`./interaction`、`./ops-maturity`、`./org-governance`、`./platform`、`./platform/*`、`./plugins`、`./scale-ecosystem/*` 等入口。

稳定性规则：

- `./sdk`、`./sdk/cli`、`./cli`、`./operator` belongs to**版本化稳定table面**，必须遵守本 contract。
- `./apps`、`./domains`、`./interaction`、`./platform*`、`./plugins`、`./scale-ecosystem*` belongs to**code级兼容export**，used for monorepo / 集成测试 / 渐进迁移，不单独承诺 semver 稳定；若对外开放，必须先补充对应 contract vsclass型面文档。
- 对外文档若未单列某个 export family，defaults to按“内部兼容export”handle，不得被 marketplace / 第三方 SDK 当作稳定公共 API。

## 3. 核心对象

```typescript
interface SdkReleaseDescriptor {
  sdk_semver: string;
  platform_min_version: string;
  platform_max_version: string;
  deprecation_policy: "notify_only" | "block" | "migration_required" | "hard_cutoff";
}
```

## 4. CLI Surface

- 每个 CLI 入口必须对应一个稳定命令语义vs帮助文本。
- CLI 输出若used for脚本消费，必须提供结构化 JSON 模式或稳定字段格式。
- CLI 不得bypassing API / contract directly篡改 authoritative Status。

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

规则：

- Client SDK 应从同一 API schema / contract 派生，不维护私有字段分叉。
- network错误、鉴权错误、业务拒绝必须保留可区分错误class型。

## 6. Pack / Plugin SDK Surface

- Pack SDK 必须暴露 manifest、compatibility、local test、scaffold 能力。
- Plugin SDK 必须暴露 plugin definition、runtime context、test harness。
- Pack/Plugin SDK 的版本声明必须vs marketplace 兼容矩阵可交叉验证。

## 7. 兼容性vs弃用

- 破坏性变更必须在 release descriptor 中显式列出。
- `SdkReleaseDescriptor` 以 Pack manifest 的 `sdk_semver / platform_min_version / platform_max_version / deprecation_policy` 为 canonical 形态。
- 当前 SDK 发布基线为 `0.1.0`，并在根 `CHANGELOG.md` vs `docs_zh/CHANGELOG.md` 中synchronousrecord。
- `ApiClient` 的基础读写接口必须返回统一 `ApiResponse<T>` envelope。
- SDK 可弃用旧table面，但必须提供迁移窗口或替代命令/接口。
- CLI、Pack SDK、Plugin SDK 不得对同一 canonical 对象uses不同字段命名。

## 8. 测试要求

- unit：每个 SDK table面的 schema、class型vs错误语义。
- integration：CLI/Client/Pack/Plugin vs平台 contract 的联动。
- contract：version、compatibility vs breaking change 元data稳定可解析。
