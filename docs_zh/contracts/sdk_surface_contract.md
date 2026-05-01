# SDK Surface Contract

## 1. 范围

本 contract 定义 `src/sdk/` 下 CLI、Client SDK、Pack SDK、Plugin SDK 的对外表面与兼容原则。

相关文档：

- `api_surface_contract.md`
- `plugin_spi_contract.md`
- `marketplace_catalog_and_revenue_contract.md`

## 2. SDK 分层

| 子域 | 目录 | 目标 |
| --- | --- | --- |
| CLI | `src/sdk/cli/` | 运维、开发、验证入口 |
| Client SDK | `src/sdk/client-sdk/` | 类型化 API 调用 |
| Pack SDK | `src/sdk/pack-sdk/` | pack scaffold / lifecycle / compatibility |
| Plugin SDK | `src/sdk/plugin-sdk/` | plugin 定义、上下文、测试 harness |

## 3. 核心对象

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

- 每个 CLI 入口必须对应一个稳定命令语义与帮助文本。
- CLI 输出若用于脚本消费，必须提供结构化 JSON 模式或稳定字段格式。
- CLI 不得绕过 API / contract 直接篡改 authoritative 状态。

## 5. Client SDK Surface

```typescript
interface ApiClient {
  get(path: string, params?: Record<string, string | number | boolean>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
}
```

规则：

- Client SDK 应从同一 API schema / contract 派生，不维护私有字段分叉。
- 网络错误、鉴权错误、业务拒绝必须保留可区分错误类型。

## 6. Pack / Plugin SDK Surface

- Pack SDK 必须暴露 manifest、compatibility、local test、scaffold 能力。
- Plugin SDK 必须暴露 plugin definition、runtime context、test harness。
- Pack/Plugin SDK 的版本声明必须与 marketplace 兼容矩阵可交叉验证。

## 7. 兼容性与弃用

- 破坏性变更必须在 release descriptor 中显式列出。
- SDK 可弃用旧表面，但必须提供迁移窗口或替代命令/接口。
- CLI、Pack SDK、Plugin SDK 不得对同一 canonical 对象使用不同字段命名。

## 8. 测试要求

- unit：每个 SDK 表面的 schema、类型与错误语义。
- integration：CLI/Client/Pack/Plugin 与平台 contract 的联动。
- contract：version、compatibility 与 breaking change 元数据稳定可解析。

## 9. MissionControlService Typed Endpoints (R7-40 fix)

`MissionControlService` 是 UI 层调用 platform API 的主入口，以下是 canonical 端点签名：

```typescript
// 获取 Dashboard 快照（包含 UI spec §4.7.7 要求的 10+ 字段）
getSnapshot(tenantId?: string | null): MissionControlSnapshot;

// 获取 Task Cockpit 视图
getTaskCockpit(taskId: string, tenantId?: string | null): {
  snapshot: TaskSnapshot;
  inspect: TaskInspectView;
  timeline: Timeline;
};

// 获取 Workflow Cockpit 视图（含 PlanGraph DAG 结构）
getWorkflowCockpit(taskId: string, tenantId?: string | null): WorkflowCockpitView;

// 获取 Stability Panel 视图
getStabilityPanel(limit?: number, tenantId?: string | null): StabilityPanelView;

// 获取 Admin Takeover Console 视图（含 harness_run_id/node_run_id）
getAdminTakeoverConsole(taskId: string, tenantId?: string | null): AdminTakeoverConsoleView;

// 列出 Workflow Cockpit 摘要
listWorkflowCockpits(limit?: number, tenantId?: string | null): WorkflowInspectSummary[];

// 列出 Approval Queue
listApprovalQueue(limit?: number, tenantId?: string | null): ApprovalRecord[];

// 异步获取 Health 报告
getHealthReportAsync(): Promise<HealthStatusReport>;
```

规则：

- `MissionControlService` 必须使用 canonical 命名（`harness_run_id`、`node_run_id`、`plan_graph`）而非 legacy 命名（`task_id`、`workflow_id`、`steps`）。
- 所有端点必须返回 UI spec 规定的完整字段集，不得截断。
- 端点错误必须携带结构化的 `code` / `statusCode` / `retryable` 元数据。
