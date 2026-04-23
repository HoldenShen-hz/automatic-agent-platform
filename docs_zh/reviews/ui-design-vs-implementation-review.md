# UI 架构设计 vs 实现差距评审

| 字段 | 值 |
| --- | --- |
| 版本 | v1.1 |
| 日期 | 2026-04-23 |
| 参考文档 | `docs_zh/architecture/05-cross-platform-ui-architecture.md` |
| 扫描目标 | `ui/` |
| 评审口径 | 以当前仓库实现与定向验证结果为准 |

---

## 1. 结论摘要

这份评审已按 `UIR0-UIR6` 完成一次基于仓库真相的全量重评，旧文档里大量“未实现 / 仅占位 / 路由冲突 / 只有 mock”的结论已经失真，不再可作为整改依据。

当前结论：

| 主线 | 结果 | 说明 |
| --- | --- | --- |
| `UIR0` | 已完成 | review 已重建为权威台账，不再沿用旧统计和旧深度矩阵 |
| `UIR1` | 已完成 | `shared/state` 已改为真正响应式绑定；`governance-compliance` 不再与 `compliance` 共享同一路由 |
| `UIR2` | 已完成 | 四层架构、feature 深度、shared core、测试能力已按当前代码重评 |
| `UIR3` | 已完成 | 真实 `REST/WS` runtime、主题令牌、ECharts、React Flow、关键 feature 深化已落地 |
| `UIR4` | 已完成 | Electron / Tauri / mobile 已具备仓内 smoke-ready 工程基线；平台适配层已拆分出正式实现入口 |
| `UIR5` | 已完成 | shared/core/features/apps/docs/tooling 的最小测试与工具链基线已补齐，Storybook 已有实际入口 |
| `UIR6` | 已完成 | review、todolist、架构文档口径已回写到当前真相 |

需要保持真实的边界：

- 这次完成的是**仓内可实现、可构建、可测试**的跨平台 UI 基线。
- 应用商店发布、代码签名、真实桌面自动更新、真实后端 Layer C 全量开放，不属于本仓单次整改闭环。

---

## 2. 当前代码库快照

> 统计口径：忽略 `node_modules/` 与 `dist/`。

| 指标 | 数值 |
| --- | --- |
| TS/TSX 文件总数 | `200` |
| `apps/` | `14` |
| `packages/shared/` | `39` |
| `packages/features/` | `112` |
| `packages/ui-core + ui-mobile` | `13` |
| `tests/` | `16` |
| `tools/` | `3` |
| feature 包数量 | `28` |
| 对外注册的 feature 路由 | `27` |

核心证据：

- Web 壳层：[App.tsx](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/web/src/App.tsx)
- Feature 注册表：[feature-registry.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/web/src/feature-registry.ts)
- Shared state：[shared/state](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/state/src/index.ts)
- Shared api：[shared/api-client](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/index.ts)
- Design tokens：[design-tokens](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/ui-core/src/design-tokens/index.ts)
- Storybook 入口：[.storybook/main.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/.storybook/main.ts)

---

## 3. 四层架构重评

### 3.1 L1 Platform Shell

| 平台 | 当前状态 | 证据 |
| --- | --- | --- |
| Web | 可构建、可运行 | [apps/web](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/web/src) |
| Windows | Electron smoke-ready baseline | [electron main](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/electron-win/src/main.ts), [preload](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/electron-win/src/preload.ts) |
| macOS | Tauri 2 smoke-ready baseline | [tauri-macos/src-tauri](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-macos/src-tauri) |
| Linux | Tauri 2 smoke-ready baseline | [tauri-linux/src-tauri](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-linux/src-tauri) |
| Android / iOS | React Native style smoke-ready baseline | [mobile/src/App.tsx](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/mobile/src/App.tsx), [navigation](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/mobile/src/navigation.ts) |

结论：

- Web 仍然是唯一的完整运行入口。
- 桌面与移动端已不再是“只有一个描述性 `index.ts`”，而是具备正式工程基线文件和 smoke 入口。
- 文档若继续把桌面/移动写成“完全未实现”，已经不准确。

### 3.2 L2 Feature Modules

当前 28 个 feature 包已经统一成 `src/web/ + src/mobile/ + src/hooks/ + src/index.tsx` 结构，不再是单文件 re-export 占位。

结构证据：

- [dashboard](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/dashboard/src)
- [task-cockpit](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/task-cockpit/src)
- [approval](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/approval/src)
- [workflow-builder](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/workflow-builder/src)
- [compliance](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/compliance/src)

路由语义结论：

- `compliance` 是权威治理合规 feature，保留对外路由。
- `governance-compliance` 保留为内部扩展模块，但不进入对外 feature registry。
- 旧 review 中“两个 feature 共用同一路由”的 P0 结论已经失效。

### 3.3 L3 Shared Core

| 模块 | 当前状态 | 结论 |
| --- | --- | --- |
| `shared-types` | DTO / 契约完整 | 已实现 |
| `shared-api-client` | Mock transport + runtime HTTP + runtime WS + endpoint catalog + event router | 已实现 |
| `shared-auth` | auth service / token manager / session guard | 已实现 |
| `shared-state` | 4 stores + query factories + runtime provider + reactive hooks | 已实现 |
| `shared-sync` | offline queue / conflict resolver / sync coordinator | 已实现 |
| `shared-domain` | feature guard / redaction / domain UI config | 已实现 |
| `shared-platform` | mock / web / desktop / mobile adapter 入口 | 已实现 |
| `shared-i18n` | locale / fallback / detection 基线 | 已实现 |
| `shared-telemetry` | sink / scoped telemetry 基线 | 已实现 |
| `shared-nl-client` | parse / plan / confirm / execute 基线 | 已实现 |

### 3.4 L4 Platform Adapters

适配层已形成 contract-first 结构：

- [platform index](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/platform/src/index.ts)
- [web-platform-adapter.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/platform/src/web-platform-adapter.ts)
- [desktop-platform-adapter.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/platform/src/desktop-platform-adapter.ts)
- [mobile-platform-adapter.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/platform/src/mobile-platform-adapter.ts)

当前结论应表述为：

- 已完成正式 adapter contract 与分平台实现入口；
- 当前默认实现仍以 in-memory / mock 能力为主；
- 当前仓内已经具备 Electron bridge、Tauri invoke、mobile native bridge 的正式接入点；后续演进重点是与真实宿主运行时联调，而不是继续补目录或 contract。

---

## 4. 关键 P0-P3 缺口回写

### 4.1 P0：状态响应式与重复路由

#### P0-1. Zustand 状态不触发 React 重渲染

状态：已修复

证据：

- [shared/state/src/index.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/state/src/index.ts)
- [auth-sync-state.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/shared/auth-sync-state.test.ts)

结论：

- 旧实现通过 `store.getState()` 读快照。
- 当前实现已切到 `useStore(...)` 响应式绑定。
- `UiRuntimeProvider` 的 store 变化现在会驱动组件重渲染。

#### P0-2. `compliance` / `governance-compliance` 路由冲突

状态：已修复

证据：

- [feature-registry.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/web/src/feature-registry.ts)
- [governance-compliance](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/governance-compliance/src/index.tsx)

结论：

- `governance-compliance` 已不再占用 `/governance/compliance`。
- 对外路由由 `compliance` 独占。

### 4.2 P1：runtime transport、主题、图表、关键 feature 深化

#### P1-1. 真实 HTTP transport 缺失

状态：已修复

证据：

- [rest-client.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts)
- [runtime.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/web/src/runtime.ts)

#### P1-2. 真实 WebSocket runtime 缺失

状态：已修复

证据：

- [ws-client.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/ws-client.ts)
- [api-client.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/shared/api-client.test.ts)

#### P1-3. light theme 与高级 design tokens 缺失

状态：已修复

证据：

- [design-tokens](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/ui-core/src/design-tokens/index.ts)
- [themes](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/ui-core/src/themes/index.ts)

已补齐：

- typography
- motion
- breakpoints
- shadows
- iconSizes
- light / dark / high-contrast theme 差异化值

#### P1-4. ECharts / React Flow 缺失

状态：已修复

证据：

- [ui/package.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/package.json)
- [echart-surface.tsx](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/ui-core/src/charts/echart-surface.tsx)
- [dashboard web](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/dashboard/src/web/index.tsx)
- [analytics web](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/analytics/src/web/index.tsx)
- [workflow-builder web](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/workflow-builder/src/web/index.tsx)

### 4.3 P2：桌面 / Tauri / 移动端工程基线与适配层

状态：已完成仓内基线

证据：

- [electron-win/package.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/electron-win/package.json)
- [electron main](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/electron-win/src/main.ts)
- [tauri-macos Cargo.toml](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-macos/src-tauri/Cargo.toml)
- [tauri-linux Cargo.toml](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-linux/src-tauri/Cargo.toml)
- [mobile App.tsx](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/mobile/src/App.tsx)
- [shells.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/apps/shells.test.ts)

口径修正：

- 应写成“已完成 smoke-ready 工程基线”。
- 不应再写成“完全没有 Electron / Tauri / mobile 工程文件”。

### 4.4 P3：测试、工具链、占位包、Storybook

状态：已修复

证据：

- [tooling.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/tools/tooling.test.ts)
- [codegen](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tools/codegen/src/index.ts)
- [mock-server](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tools/mock-server/src/index.ts)
- [e2e](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tools/e2e/src/index.ts)
- [shared-i18n](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/i18n/src/index.ts)
- [shared-telemetry](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/telemetry/src/index.ts)
- [shared-nl-client](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/nl-client/src/index.ts)
- [Storybook main](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/.storybook/main.ts)

---

## 5. Feature 深度矩阵（重评）

深度口径：

- `L0`：仅 manifest / 占位
- `L1`：结构化 VM 或 mock 数据展示
- `L2`：具备页面交互、局部业务流或专用 UI 组件
- `L3`：完整业务流程闭环

| Feature | 当前深度 | 说明 |
| --- | --- | --- |
| dashboard | `L2` | 指标卡 + ECharts |
| task-cockpit | `L3` | 五级下钻、接管、恢复、升级闭环 |
| workflow-cockpit | `L3` | 选择、暂停、恢复、回放、发布闭环 |
| approval | `L3` | 审批、拒绝、委派、动作历史闭环 |
| stability | `L1` | 稳定性指标与恢复列表 |
| alerts | `L1` | 告警列表基线 |
| takeover | `L1` | takeover 操作基线 |
| dispatch | `L1` | 任务派发信息面板 |
| inspect | `L1` | inspect 信息面板 |
| health | `L1` | health 状态面板 |
| incidents | `L1` | incident 列表基线 |
| compliance | `L1` | 合规中心基线 |
| policy | `L1` | policy 配置面板 |
| audit | `L1` | audit 面板 |
| workers | `L1` | worker 运营面板 |
| queues | `L1` | queue 运营面板 |
| conversation | `L3` | 发送、追问、建计划、确认、执行闭环 |
| hitl | `L2` | HITL 面板基线 |
| domain-wizard | `L1` | onboarding / wizard 基线 |
| settings | `L3` | 偏好编辑、保存、活动历史闭环 |
| workflow-builder | `L2` | React Flow 画布基线 |
| workflow-debugger | `L1` | debugger 页面基线 |
| agent-manager | `L1` | agent 运营面板 |
| explainability | `L1` | 解释性列表基线 |
| cost-center | `L1` | cost 中心基线 |
| marketplace | `L1` | marketplace 基线 |
| analytics | `L2` | 指标趋势图表 |
| governance-compliance | `L1` | 内部扩展模块，不对外注册 |

结论：

- 旧 review 中“所有 feature 都只是模板化 JSON 面板”已经不准确。
- 当前已形成一批真正的 `L3` 主链 feature：`approval / task-cockpit / workflow-cockpit / conversation / settings`。
- 其余 feature 仍主要处于 `L1-L2`，这部分仍应继续深化。

---

## 6. 测试与验证现状

当前 UI 子工程的定向验证结果：

- `npm run typecheck`：通过
- `npm run test`：`36/36` 通过
- `npm run build`：通过

关键测试文件：

- [auth-sync-state.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/shared/auth-sync-state.test.ts)
- [api-client.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/shared/api-client.test.ts)
- [shells.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/apps/shells.test.ts)
- [tooling.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/tools/tooling.test.ts)
- [route-map.test.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/tests/docs/route-map.test.ts)

应当修正的旧结论：

- 不能再把 `tools/mock-server / codegen / e2e` 写成“只有空壳”。
- 不能再把 shared 状态层写成“无法响应式更新”。
- 不能再把桌面 / 移动端 shell 写成“只有描述性单文件”。

---

## 7. 仍然保留的真实边界

以下项不再计入 `UIR1-UIR6` 未完成缺口，但仍是后续演进方向：

1. 桌面与移动端尚未进入真实签名、发布、自动更新、商店分发阶段。
2. 平台桥接已在仓内完成 `Electron preload bridge / Tauri invoke bridge / mobile native bridge` 基线；剩余工作是和真实宿主运行时联调，而不是继续补接口。
3. 已形成 `approval / task-cockpit / workflow-cockpit / conversation / settings` 这批 `L3` 流程闭环；其余 feature 仍需继续深化。
4. Web 构建已经通过按需懒加载与 manual chunk 去除了大 chunk 警告，当前构建输出无超限提示。

---

## 8. 最终闭环表

| Review 条目 | 当前状态 | 证据 | 已整改 |
| --- | --- | --- | --- |
| 状态不响应式 | 已实现响应式 hook | [shared/state](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/state/src/index.ts) | ✅ |
| compliance 路由冲突 | 已消除对外冲突 | [feature-registry](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/web/src/feature-registry.ts) | ✅ |
| REST 只有 mock | 已补 runtime HTTP | [rest-client.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/rest-client.ts) | ✅ |
| WS 只有内存模拟 | 已补 browser runtime | [ws-client.ts](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/shared/api-client/src/ws-client.ts) | ✅ |
| light theme / 令牌缺失 | 已补全 | [design-tokens](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/ui-core/src/design-tokens/index.ts) | ✅ |
| 缺 ECharts / React Flow | 已补全 | [ui/package.json](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/package.json) | ✅ |
| Electron / Tauri / mobile 只是描述文件 | 已升级为 smoke-ready 基线 | [apps](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps) | ✅ |
| tools / Storybook 只有占位 | 已补最小可运行基线 | [ui/.storybook](/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/.storybook) | ✅ |
| review 统计与深度矩阵过期 | 已回写 | 本文件 | ✅ |

本文件现在是 UI review 的权威版本，后续如再整改，应在这个基线上继续更新，而不是回滚到旧结论。
