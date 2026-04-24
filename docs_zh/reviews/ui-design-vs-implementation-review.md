# UI 架构设计 vs 实现差距评审

| 字段     | 值                                                                          |
| -------- | --------------------------------------------------------------------------- |
| 版本     | v2.0                                                                        |
| 日期     | 2026-04-24                                                                  |
| 基线版本 | v1.1 (2026-04-23)                                                           |
| 参考文档 | `docs_zh/architecture/05-cross-platform-ui-architecture.md` v3.2 (4,439 行) |
| 扫描目标 | `ui/` (206 TS/TSX 文件, 7,084 行)                                           |
| 评审口径 | 逐节对照设计文档 §1-§7 + 附录，以仓库代码为事实依据                         |

---

## 1. 版本变更摘要

v1.1→v2.0 主要变化：

- 从"修复台账"升级为**设计-实现逐节对照**，覆盖设计文档全部 7 章 + 2 个附录
- 新增精确量化对照：REST 端点 21/35、WS 事件 7/30、PlatformAdapter 17/16 能力
- 新增 12 项缺口条目 (GAP-01 ~ GAP-12)，按 P0-P3 分级
- 保留 v1.1 已确认的 UIR0-UIR6 闭环结论作为历史基线

---

## 2. 代码库快照

> 统计口径：忽略 `node_modules/` 与 `dist/`。

| 指标                           | 数值  |
| ------------------------------ | ----- |
| TS/TSX 文件总数                | 206   |
| `apps/`                        | 14    |
| `packages/shared/`             | 39    |
| `packages/features/`           | 112   |
| `packages/ui-core + ui-mobile` | 13    |
| `tests/`                       | 17    |
| `tools/`                       | 3     |
| 总行数 (TS/TSX)                | 7,084 |
| 测试行数                       | 801   |
| feature 包数量                 | 28    |
| 对外注册的 feature 路由        | 27    |

---

## 3. 四层架构对照 (设计 §3)

### 3.1 L1 Platform Shell

设计要求六平台入口 (Web / Windows / macOS / Linux / Android / iOS)。

| 平台        | 设计技术选型      | 实现状态         | 证据路径                         |
| ----------- | ----------------- | ---------------- | -------------------------------- |
| Web         | React 19 + Vite 6 | 可构建可运行     | `ui/apps/web/src/`               |
| Windows     | Electron 34       | smoke-ready 基线 | `ui/apps/electron-win/src/`      |
| macOS       | Tauri 2           | smoke-ready 基线 | `ui/apps/tauri-macos/src-tauri/` |
| Linux       | Tauri 2           | smoke-ready 基线 | `ui/apps/tauri-linux/src-tauri/` |
| Android/iOS | React Native 0.79 | smoke-ready 基线 | `ui/apps/mobile/src/`            |

差距：Web 是唯一完整运行入口；桌面与移动端仅具备工程骨架，未达可发布状态。

### 3.2 L2 Feature Modules

设计要求 28 个 feature 模块，当前 28 个全部存在，结构统一为 `src/index.tsx + src/web/ + src/mobile/ + src/hooks/`。27 个注册到 `feature-registry.ts`（`governance-compliance` 作为内部扩展不注册）。

深度分布：

| 深度 | 数量 | 说明                                                             |
| ---- | ---- | ---------------------------------------------------------------- |
| L3   | 5    | task-cockpit, workflow-cockpit, approval, conversation, settings |
| L2   | 4    | dashboard, hitl, workflow-builder, analytics                     |
| L1   | 19   | 其余 feature，有结构化 VM 或 mock 数据展示                       |
| L0   | 0    | 无纯占位包                                                       |

差距：设计 §4 对 28 个 feature 均定义了完整页面蓝图与 5 级下钻 (L1-L5)，当前仅 5 个达到 L3 闭环，19 个仍处于 L1 脚手架级。

### 3.3 L3 Shared Core

设计要求 10 个共享包，当前全部存在：

| 共享包            | 设计要求                              | 实现状态                                                   | 差距                                                                          |
| ----------------- | ------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| shared-types      | DTO + 契约类型                        | 272 行，20+ DTO/接口                                       | 基本满足                                                                      |
| shared-api-client | REST 传输 + WS 连接 + 拦截器          | MockTransport + HttpTransport + BrowserWSClient + 拦截器链 | REST 端点目录 21 条 vs 设计 35 条 (60%)；WS 事件路由 7 条 vs 设计 30 条 (23%) |
| shared-auth       | 认证服务 + 令牌管理 + 会话守卫        | auth-service + token-manager + session-guard               | 守卫仅 1 层 vs 设计 5 层 Guard 链                                             |
| shared-state      | 4 Zustand stores + TanStack Query     | 4 stores + 4 query factories + provider                    | 基本满足；缺 devtools 集成                                                    |
| shared-sync       | 离线队列 + 冲突解决 + 协调器          | OfflineQueue + ConflictResolver + SyncCoordinator          | 仅内存队列；缺 IndexedDB 持久化 (设计三层策略)                                |
| shared-domain     | feature guard + 脱敏 + DomainUIConfig | 已实现                                                     | 基本满足                                                                      |
| shared-platform   | PlatformAdapter 16 组能力             | DefaultPlatformAdapter 17 方法全覆盖                       | 接口满足；默认实现为 in-memory mock                                           |
| shared-i18n       | ICU MessageFormat + locale 检测       | TranslationService 简单键值查找                            | 缺 ICU MessageFormat 插值、复数规则                                           |
| shared-telemetry  | OpenTelemetry sink                    | TelemetrySink 内存收集器                                   | 缺 OTLP 导出；仅内存 sink                                                     |
| shared-nl-client  | NL 解析 + 计划 + 确认 + 执行          | parse/plan/confirm/execute 基线                            | 基本满足接口骨架                                                              |

### 3.4 L4 Platform Adapters

设计要求每平台继承 `PlatformAdapter` 并接入真实宿主 API。

| 适配器             | 实现文件                      | 真实宿主绑定 | 说明                                        |
| ------------------ | ----------------------------- | ------------ | ------------------------------------------- |
| WebPlatformAdapter | `web-platform-adapter.ts`     | 部分         | fetch 委托 globalThis.fetch；其余 in-memory |
| DesktopAdapter     | `desktop-platform-adapter.ts` | 否           | 继承 DefaultPlatformAdapter                 |
| MobileAdapter      | `mobile-platform-adapter.ts`  | 否           | 继承 DefaultPlatformAdapter                 |

差距：三个适配器均继承 `DefaultPlatformAdapter`，SecureStore / 文件系统 / 剪贴板 / DeepLink / Haptics 等均为 in-memory mock，未接入 Electron IPC / Tauri invoke / RN native bridge。

---

## 4. Feature 模块对照 (设计 §4)

### 4.1 Feature 深度矩阵

深度口径：L0 = 纯占位；L1 = 结构化 VM/mock 展示；L2 = 页面交互/局部业务流/专用组件；L3 = 完整业务流程闭环；L4-L5 = 设计要求的高级下钻（当前均未达到）。

| Feature               | 当前深度 | 设计期望深度 | 说明                                     |
| --------------------- | -------- | ------------ | ---------------------------------------- |
| dashboard             | L2       | L4           | 指标卡 + ECharts；缺布局编辑器与实时刷新 |
| task-cockpit          | L3       | L5           | 五级下钻、接管、恢复、升级闭环           |
| workflow-cockpit      | L3       | L4           | 选择、暂停、恢复、回放、发布闭环         |
| approval              | L3       | L4           | 审批/拒绝/委派/历史闭环                  |
| stability             | L1       | L3           | 稳定性指标与恢复列表                     |
| alerts                | L1       | L3           | 告警列表基线                             |
| takeover              | L1       | L3           | takeover 操作基线                        |
| dispatch              | L1       | L3           | 任务派发信息面板                         |
| inspect               | L1       | L3           | inspect 信息面板                         |
| health                | L1       | L3           | health 状态面板                          |
| incidents             | L1       | L3           | incident 列表基线                        |
| compliance            | L1       | L3           | 合规中心基线                             |
| policy                | L1       | L3           | policy 配置面板                          |
| audit                 | L1       | L3           | audit 面板                               |
| workers               | L1       | L3           | worker 运营面板                          |
| queues                | L1       | L3           | queue 运营面板                           |
| conversation          | L3       | L4           | 发送/追问/建计划/确认/执行闭环           |
| hitl                  | L2       | L3           | HITL 面板基线                            |
| domain-wizard         | L1       | L3           | onboarding/wizard 基线                   |
| settings              | L3       | L3           | 偏好编辑/保存/活动历史闭环               |
| workflow-builder      | L2       | L4           | React Flow 画布基线                      |
| workflow-debugger     | L1       | L3           | debugger 页面基线                        |
| agent-manager         | L1       | L3           | agent 运营面板 (设计 §4 Planned 模块)    |
| explainability        | L1       | L3           | 解释性列表基线 (设计 §4 Planned 模块)    |
| cost-center           | L1       | L3           | cost 中心基线 (设计 §4 Planned 模块)     |
| marketplace           | L1       | L3           | marketplace 基线 (设计 §4 Planned 模块)  |
| analytics             | L2       | L4           | 指标趋势图表 (设计 §4 Planned 模块)      |
| governance-compliance | L1       | L2           | 内部扩展模块，不对外注册                 |

### 4.2 路由表对照

设计 §4 定义 47+ 路由，当前 feature-registry 注册 27 条顶级路由。差距原因：

- 设计定义的二级/三级下钻路由（如 `/tasks/:id/timeline`、`/workflows/:id/steps/:stepId`）在 feature 内部硬编码为组件导航，未在顶级路由表体现
- 部分 Planned 模块的子路由尚未实现

### 4.3 页面权限矩阵

设计 §4 定义了 5 角色 × 28 feature 的权限矩阵。当前实现：

- `FeatureGuardContext` 类型已定义（含 permissions / featureFlags / mode）
- `RouteGuardChain` 接口已定义
- 实际路由级鉴权未接入；`session-guard.ts` 仅做登录态校验，无角色/权限/feature-flag 联合判定

---

## 5. 数据与通信对照 (设计 §5 + 附录)

### 5.1 REST API 映射 (设计附录 A: 35 端点)

`endpoints.ts` 定义了 21 个端点目录条目：

| 端点类别         | 设计要求 | 已实现 | planned 标记 | 说明                                                                                                                                                                                       |
| ---------------- | -------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layer C 业务端点 | 28       | 17     | 10 planned   | dashboardSnapshot, tasks, workflows, approvals, incidents, agents, analytics, costs, marketplace, explanations, roles, featureFlags, models, domainConfigs, tenants, webhooks, preferences |
| Layer B 管理端点 | 7        | 2      | 0            | workers, queues                                                                                                                                                                            |
| 合计             | 35       | 21     | —            | 覆盖率 60%                                                                                                                                                                                 |

未覆盖的设计端点（约 14 条）：包括任务 CRUD 变体 (POST/PUT/DELETE)、工作流生命周期端点、审批动作端点、用户管理端点、系统配置端点等。当前 `endpointCatalog` 全部为 GET 语义的列表/查询端点，缺少写操作端点。

### 5.2 WebSocket 事件映射 (设计附录 B: 30 事件)

`ws-event-router.ts` 的 `mapEventToQuery` 函数处理 7 种事件类型：

| 已路由事件               | 目标 queryKey | 说明         |
| ------------------------ | ------------- | ------------ |
| status_changed           | tasks         | 任务状态变化 |
| completed                | tasks         | 任务完成     |
| failed                   | tasks         | 任务失败     |
| approval_requested       | approvals     | 审批请求     |
| approval.resolved        | approvals     | 审批解决     |
| incident.created         | incidents     | 事件创建     |
| dashboard.metric_updated | analytics     | 指标更新     |
| agent.health_changed     | agents        | Agent 健康   |
| panic.activated          | (panic)       | 紧急停止     |

覆盖率：9 种事件 / 30 种设计要求 = 30%。未覆盖的包括：workflow 生命周期事件、worker 心跳事件、queue 深度变化、NL 会话事件、域配置变更、成本告警等。

### 5.3 状态管理 (设计 §5.1)

设计要求 4 个 Zustand stores + TanStack Query 缓存层。

| Store          | 实现文件          | 职责                | 状态   |
| -------------- | ----------------- | ------------------- | ------ |
| auth-store     | auth-store.ts     | 认证状态            | 已实现 |
| ui-store       | ui-store.ts       | UI 偏好/布局        | 已实现 |
| sync-store     | sync-store.ts     | 离线同步状态        | 已实现 |
| realtime-store | realtime-store.ts | WS 连接状态 + panic | 已实现 |

TanStack Query factories: dashboard-queries, task-queries, approval-queries, mission-control-queries — 已实现 4 组。

差距：缺少 devtools 集成（设计要求 React Query Devtools + Zustand devtools middleware）。

### 5.4 离线策略 (设计 §5.3)

设计要求三层离线策略：L1 内存队列 → L2 IndexedDB 持久化 → L3 Service Worker 后台同步。

| 层级 | 设计要求         | 实现状态            |
| ---- | ---------------- | ------------------- |
| L1   | 内存队列         | OfflineQueue 已实现 |
| L2   | IndexedDB 持久化 | 未实现              |
| L3   | Service Worker   | 未实现              |

ConflictResolver 仅支持 `server_wins` / `local_wins` 两种策略，缺少设计要求的 `merge` 策略和版本向量。

---

## 6. 平台治理对照 (设计 §6)

### 6.1 设计令牌体系

设计 §6 要求完整设计令牌体系包含 8 组令牌：color / spacing / radius / typography / motion / breakpoints / shadows / iconSizes。

当前 `CoreDesignTokens` 接口定义了全部 8 组，实现了 dark / light / high-contrast 三套主题。

| 令牌组      | 设计要求 | 实现状态 | 差距                                             |
| ----------- | -------- | -------- | ------------------------------------------------ |
| color       | 完整色板 | 9 色值   | 缺 semantic color aliases (success/warning/info) |
| spacing     | 8pt 网格 | 4 级     | xs/sm/md/lg 满足基线；缺 xl/2xl                  |
| radius      | 分级     | 3 级     | 基本满足                                         |
| typography  | 完整体系 | 4 属性   | 缺 lineHeight / fontWeight 分级                  |
| motion      | 分级     | 3 属性   | 基本满足                                         |
| breakpoints | 分级     | 3 级     | 基本满足                                         |
| shadows     | 分级     | 2 级     | 缺 focus-ring / inset 等                         |
| iconSizes   | 分级     | 3 级     | 基本满足                                         |

### 6.2 多租户 (设计 §6.2)

设计要求 DomainUIConfig 驱动的多租户配置：feature 可见性、动作策略、下钻深度、术语覆盖、插槽注册。

当前 `DomainUIConfig` 类型已定义全部 6 个字段 (`domainId` / `featureVisibility` / `actionPolicy` / `defaultDrillDepth` / `glossaryOverrides` / `slotRegistry`)。`shared/domain` 包已实现 feature guard 和脱敏。

差距：DomainUIConfig 的运行时加载、热更新、多域切换逻辑未见完整实现。

### 6.3 i18n (设计 §6.3)

设计要求 ICU MessageFormat 支持，包含复数规则、性别变量、嵌套选择。

当前 `TranslationService`：

- 支持 locale 注册、fallback chain、locale 检测
- **不支持** ICU MessageFormat 插值（当前为纯键值查找）
- 仅注册 2 个 locale (zh-CN / en-US)，各 3 条消息

### 6.4 安全基线 (设计 §6.5)

设计要求 CSP / CSRF / XSS 防护 + WCAG 2.1 AA。

| 要求        | 实现状态 | 说明                                     |
| ----------- | -------- | ---------------------------------------- |
| CSP header  | 未实现   | 无 meta 标签或服务端 header 配置         |
| CSRF token  | 未实现   | REST 拦截器链中无 CSRF 拦截器            |
| XSS 防护    | 部分     | React 默认 escape；无额外 sanitize       |
| WCAG 2.1 AA | 未验证   | 无 axe / lighthouse a11y 测试            |
| 屏幕安全    | 接口存在 | enableScreenSecurity 已定义；实现为 noop |

---

## 7. 工程化对照 (设计 §7)

### 7.1 测试金字塔

设计 §7 要求测试比例 70% 单元 / 20% 集成 / 7% E2E / 3% 视觉回归。

| 层级     | 设计比例 | 当前文件数 | 当前行数 | 状态                           |
| -------- | -------- | ---------- | -------- | ------------------------------ |
| 单元测试 | 70%      | 12         | ~550     | shared 核心有覆盖              |
| 集成测试 | 20%      | 3          | ~150     | shells / tooling / route-map   |
| E2E      | 7%       | 1          | ~50      | tools/e2e 骨架                 |
| 视觉回归 | 3%       | 0          | 0        | Storybook 入口存在但无快照测试 |

设计要求覆盖率门限：shared ≥ 90%、features ≥ 70%。当前 17 个测试文件 / 801 行，无 coverage 报告配置。

### 7.2 CI/CD 六阶段

设计 §7 定义六阶段 CI：lint → typecheck → test → build → bundle-analysis → deploy-preview。

| 阶段            | 实现状态 | 说明                                   |
| --------------- | -------- | -------------------------------------- |
| lint            | 未配置   | 无 ESLint 配置文件                     |
| typecheck       | 已实现   | `npm run typecheck` 通过               |
| test            | 已实现   | `npm test` 通过                        |
| build           | 已实现   | `npm run build` 通过                   |
| bundle-analysis | 未实现   | 无 rollup-plugin-visualizer 或等价工具 |
| deploy-preview  | 未实现   | 无 preview URL 生成                    |

### 7.3 性能预算

设计 §2 定义性能指标：FCP < 1.5s、LCP < 2.5s、TTI < 3.5s、CLS < 0.1。

当前无性能预算 CI 门控，无 Lighthouse CI 配置，无 bundle size 限制。Web 构建已通过按需懒加载消除大 chunk 警告。

### 7.4 四阶段交付计划

设计 §7.4 定义 Phase 1-4 交付：

| Phase   | 设计范围                           | 当前达成                           |
| ------- | ---------------------------------- | ---------------------------------- |
| Phase 1 | Web 壳层 + 核心 shared + 5 feature | 已超额达成 (27 feature 注册)       |
| Phase 2 | 桌面/移动端基线 + 离线             | 桌面/移动端 smoke-ready；离线仅 L1 |
| Phase 3 | 全 feature L3 + 性能优化           | 5/28 达 L3                         |
| Phase 4 | 多区域部署 + 生态集成              | 未启动                             |

---

## 8. 缺口汇总表

| ID     | 缺口描述                                      | 设计章节 | 优先级 | 当前状态                  |
| ------ | --------------------------------------------- | -------- | ------ | ------------------------- |
| GAP-01 | 19 个 feature 停留在 L1 脚手架级              | §4       | P1     | 需逐步深化至 L3           |
| GAP-02 | REST 端点仅 GET 语义，缺写操作端点 (14条)     | §5/附录A | P1     | 需补 POST/PUT/DELETE      |
| GAP-03 | WS 事件路由覆盖率 30% (9/30)                  | §5/附录B | P1     | 需补 21 种事件            |
| GAP-04 | 路由守卫仅 1 层登录态，缺角色/权限/FF联合判定 | §4/§6    | P1     | 需实现 5 层 Guard         |
| GAP-05 | 离线策略仅内存队列，缺 IndexedDB + SW         | §5.3     | P2     | 需实现 L2/L3              |
| GAP-06 | i18n 缺 ICU MessageFormat 插值                | §6.3     | P2     | 需接入 intl-messageformat |
| GAP-07 | 平台适配器全部 in-memory mock                 | §3/§6    | P2     | 需接入真实宿主 API        |
| GAP-08 | 安全基线缺 CSP/CSRF 配置                      | §6.5     | P2     | 需配置 header             |
| GAP-09 | 测试覆盖率无门控，距设计目标差距大            | §7       | P2     | 需配置 coverage           |
| GAP-10 | 设计令牌缺 semantic aliases + 高级分级        | §6.1     | P3     | 需扩展令牌体系            |
| GAP-11 | 无 ESLint / bundle-analysis / perf-budget CI  | §7       | P3     | 需补充 CI 阶段            |
| GAP-12 | Telemetry 仅内存 sink，缺 OTLP 导出           | §6       | P3     | 需接入导出后端            |

---

## 9. 建议解决路径

### Phase A：核心数据层补全 (GAP-02, GAP-03, GAP-04)

1. **REST 写操作端点**：在 `endpoints.ts` 补充 POST/PUT/DELETE 变体，对齐设计附录 A 的 35 端点
2. **WS 事件路由**：在 `ws-event-router.ts` 的 `mapEventToQuery` 中补充 workflow / worker / queue / NL / config 等事件类型
3. **路由守卫链**：基于 `RouteGuardChain` 接口实现 AuthGuard → RoleGuard → PermissionGuard → FeatureFlagGuard → DomainGuard 五层链

### Phase B：Feature 深化 (GAP-01)

按业务优先级分批将 L1 feature 提升至 L3：

- 批次 1：stability / alerts / incidents / health（运维核心）
- 批次 2：workers / queues / dispatch / inspect（运营核心）
- 批次 3：compliance / policy / audit / domain-wizard（治理核心）
- 批次 4：agent-manager / explainability / cost-center / marketplace（扩展生态）

### Phase C：平台与治理增强 (GAP-05 ~ GAP-08)

1. 离线：接入 `idb-keyval` 实现 IndexedDB 持久化；注册 Service Worker
2. i18n：接入 `@formatjs/intl-messageformat`，迁移消息格式为 ICU
3. 平台适配器：Web 适配器接入 navigator.clipboard / localStorage；Desktop 适配器接入 Electron IPC / Tauri invoke
4. 安全：配置 CSP meta 标签；在拦截器链中加入 CSRF token 注入

### Phase D：工程化补全 (GAP-09 ~ GAP-12)

1. 配置 Vitest coverage 报告 + 门控阈值
2. 添加 ESLint + Prettier 配置
3. 集成 rollup-plugin-visualizer 或 source-map-explorer
4. Telemetry 接入 OTLP HTTP exporter

---

## 10. 历史基线保留 (v1.1 UIR0-UIR6)

以下为 v1.1 已确认闭环的条目，本版保留作为历史参考：

| 条目 | 结论   | 说明                                                  |
| ---- | ------ | ----------------------------------------------------- |
| UIR0 | 已完成 | review 已重建为权威台账                               |
| UIR1 | 已完成 | shared/state 响应式绑定；路由冲突已消除               |
| UIR2 | 已完成 | 四层架构、feature 深度、shared core、测试已重评       |
| UIR3 | 已完成 | REST/WS runtime、主题令牌、ECharts、React Flow 已落地 |
| UIR4 | 已完成 | Electron/Tauri/mobile smoke-ready 基线                |
| UIR5 | 已完成 | 测试与工具链基线已补齐；Storybook 入口                |
| UIR6 | 已完成 | review/todolist/架构文档口径已回写                    |

---

## 11. 结论

v2.0 从逐节对照的角度系统性量化了设计文档 v3.2 与当前实现之间的差距。核心发现：

1. **架构骨架完整**：四层模型、28 feature、10 shared 包、三平台适配器、三套主题均已就位
2. **深度不足**：多数模块停留在 L1-L2，数据层覆盖率 60%/30% (REST/WS)，安全与 i18n 为基线级
3. **Phase 1 已超额**：设计 Phase 1 目标（5 feature + Web 壳层）已显著超越
4. **Phase 2-4 需持续推进**：离线、桌面/移动端真实运行时、feature L3 深化、CI 门控是下一阶段重点

本文件为 UI review 权威版本，后续整改应在此基线上继续更新。
