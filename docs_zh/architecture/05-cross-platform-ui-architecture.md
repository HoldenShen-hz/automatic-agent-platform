# 12. 跨平台 UI 统一架构（改进版）

automatic_agent/automatic-agent-platform-main/docs_zh/architecture/12-cross-platform-ui-architecture-v2.md

> **文档版本**：v3.0
> **文档状态**：Accepted
> **基线文档**：`00-platform-architecture.md` v3.2 五平面架构 · `contracts/ui_console_and_cockpit_contract.md`
> **前序文档**：`10-cross-platform-ui-architecture.md`（v1 概览，已 Superseded）· `11-cross-platform-ui-implementation-design.md`（v1 实施，已 Superseded）
> **适用对象**：前端架构师、UI/UX 工程师、移动端/桌面端开发、QA、DevOps、平台 SRE
> **设计定位**：单一权威 UI 架构规格。完全合并 Doc-10 和 Doc-11 的全部内容，消除版本不一致，对齐后端实现

---

## 修订历史

| 版本 | 日期       | 作者 | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2.0 | 2026-04-22 | —    | 合并 Doc-10/Doc-11；统一框架版本；对齐 MissionControlService/WebSocketBridge 后端实现；重构信息架构映射                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v2.1 | 2026-04-23 | —    | Doc-11 第二次 Review 回补：扩展 PlatformAdapter 接口(clipboard/lifecycle/deepLink/haptics)；增加 Zustand Store 接口定义 + TanStack Query staleTime 策略；增加 SharedWorker WebSocket 架构图；增加离线存储容量规划表；增加键盘快捷键表 + ARIA 规范                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| v2.2 | 2026-04-23 | —    | 专家评审修订：引入四级状态标签(Implemented/Planned/Proposed/Deferred)；增加桌面混合壳层治理规则；扩展 PlatformAdapter 五组能力(windowing/shell/process/analyticsConsent/screenSecurity)；增加页面级权限矩阵；增加 DTO→VM→Props 反腐层规范；增加 WebSocket 订阅域模型；增加离线操作许可矩阵；扩展 DomainUIConfig 四组域治理接口；增加交付阶段依赖门禁；增加前端错误分级与降级策略；增加契约版本协商；文档卫生清理；状态 Draft→Accepted。Doc-11 高价值内容提取：§4.6 实施参考蓝图(NL 对话/HITL/Workflow 调试器/审批中心)；§5.4.1-5.4.5 API 通信层详情(RESTClient/WSClient/Endpoint 模式/认证流程/离线队列)；§6.3 设计令牌补充(primitive.ts) + 组件开发规范；§7.1.4-7.1.5 CI Stage 详情 + 自动更新策略；§7.2.4-7.2.5 测试工具链 + 覆盖率要求 |
| v2.3 | 2026-04-23 | —    | 基线强化修订：Implemented 状态拆分三级子标签(Contracted/Internal/Partial)；新增 §5.2.3 Public UI API Surface 分层（service method / route / public contract endpoint）；新增 §4.7 Planned 模块 mini-contract（AgentManager/WorkflowBuilder/WorkflowDebugger/Marketplace/Explainability/CostCenter）；新增 §4.5.4 字段级可见性与脱敏矩阵（FieldVisibilityPolicy/RedactionRule/PIIHandlingByRole）；新增 §5.6.4 Mutation 幂等与重试规范；文档卫生收尾（`[已实现]`/`[需新增]` 统一为 `[Implemented]`/`[Planned]` 标签；service/route/endpoint 术语统一；整改清单附录 E）                                                                                                                                                                     |
| v3.0 | 2026-04-23 | —    | 详见下方 v3.0 变更明细                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v3.1 | 2026-04-23 | —    | 仓内 `ui/` Monorepo 基线已落地：补齐 shared core、PlatformAdapter、design tokens、implemented-first feature registry、planned feature seam、Web 可构建 app shell、桌面/移动端 smoke-ready shell、UI 子工程测试基线与 `current_todo_list` 的 `UI0-UI7` 波次。 |
| v3.2 | 2026-04-23 | —    | 仓内 `Phase 1-4` 代码基线对齐：补齐 `policy / audit / workers / queues` 四个一级 feature，增强 Web 分组导航、桌面/移动平台能力测试与 `current_todo_list` 的 `Phase 1-4` 阶段计划；正文新增仓内对齐快照。 |

#### v3.0 变更明细

**Doc-11 完全合并**（Doc-11 正式标记为 Superseded by Doc-12 v3.0）：

- 从 Doc-11 吸收全部 27 项剩余独特内容 + 6 项页面线框图
- §3.7.3 各平台实现策略表；§3.7.4 适配器注入机制（Provider 链）
- §4.4.1 路由表增强（权限列 + Code Split 列）；§4.4.2 移动端导航增强（Screen 层级 + 导航特性表）；§4.4.3 权限路由守卫链（5 层 Guard）
- §4.6.5-4.6.10 页面线框图（NL 对话/任务三栏/审批/看板/WF 构建器/调试器数据流）
- §5.1 状态分类表 + QueryClient 全局配置 + 离线持久化 + 数据流模式图；§5.1.1-5.1.5 子章节编号
- §5.3.2.1-5.3.2.3 WSEventRouter 架构图/事件→Query 映射/紧急事件处理
- §5.4.6 分页与过滤标准化；§5.6.5 乐观更新模式；§5.6.6 HTTP 状态码→UI 行为映射
- §6.1.5 域扩展 Slot 模式与动态加载；§6.2.3 数据隔离策略；§6.3.3 暗色模式设计规则
- §6.4.2 翻译工作流；§6.5.4 CSP 策略配置；§6.5.5 敏感数据处理；§6.6.3 移动端适配特殊考量
- §7.3.3 各平台优化详表（Web 9 项/移动端 6 项/桌面端 5 项）；§7.4 团队配置建议；§7.5 风险补充
- 附录 A 扩充 20 行端点；附录 D 扩充 17 条术语

**治理增强**：

- §1.7 新增状态标签更新责任机制（责任人/更新时机/强制校验节点矩阵）
- §4.7 mini-contract 新增 authoritative source / derived source / projection owner 三列
- §5.2.4 新增 Internal → Contracted API Graduation Matrix（13 个数据源升级清单 + 升级流程）

**三大功能模块新增**：

- §4.2.7 Agent 实时监控中心（列表+详情+心跳时间线+负载曲线+实时 WS 策略+移动端适配）
- §4.2.8 数据统计与分析平台（多层级 KPI 看板+7 种图表类型+角色自适应指标体系+DashboardMetricsDTO）
- §4.2.9 配置管理中心（7 个子页面+完整 DTO+操作矩阵）
- §4.6.8 运营看板四层面板详细规格扩展（28 个面板+数据源+图表类型+刷新策略）
- §4.6.11-4.6.13 三个新技术方案（Agent 监控 Hook/统计图表渲染架构/配置子页面路由+权限矩阵编辑器）
- §4.7.7-4.7.8 新增 AnalyticsDashboard + ConfigurationCenter mini-contract
- §5.2.2 新增 15 个 Planned API 端点；路由表新增 8 条路由

**全文 Review 修复**：

- **P0-1**: `/shared/settings/org` 幽灵路由 → 添加组织架构子页面到 §4.2.9
- **P0-2**: settings `[Implemented/Contracted]` vs ConfigCenter `[Planned]` 矛盾 → 改为 `[Implemented/Partial]`
- **P0-3**: 附录 B 缺 13 个 WS 事件 → 已全部补充
- **P0-4**: `nl.clarification_needed` 状态不一致 → 统一为 `[Proposed]`
- **P1-1**: `runtime-decisions` Layer 2 图标注 `[Deferred]` + 脚注
- **P1-2**: 9 个未规格化模块 → 新增 §4.2.10 已实现模块摘要
- **P1-3**: feature-flags 路由归属 → 路由表标注为"配置管理子页面 §4.2.9"
- **P1-4**: §4.5.1 权限矩阵新增 AgentMonitor/Analytics/ConfigCenter 3 行
- **P1-5**: `compliance_officer` 重映射为 `domain_admin+`
- **P1-6**: §7.2.5 新增 v3.0 模块测试策略（ECharts + 权限矩阵编辑器）
- **P1-7**: §5.1 子章节重编号（5.1.1-5.1.6）
- **P1-8**: 目录前添加溯源引用说明
- **P2-1**: §7.3.4 图表密集页面性能预算
- **P2-2**: §4.2.7-4.2.9 新增错误处理与离线降级表
- **P2-3**: §6.4.3.1 复杂 UI 组件无障碍专项指南
- **P2-4**: §7.3.5 CI 构建影响评估
- **P2-5**: 移动端导航新增 AnalyticsScreen
- **P2-6**: 目录树新增 `analytics/` 目录
- **P2-7**: 审计日志子页面标注为链接至 Governance → Audit
- **P2-9**: §5.2.1 新增 `/api/v1/meta/contract-version` 端点
- **P2-10**: turbo.json `"pipeline"` → `"tasks"`（Turborepo 2.x）
- Layer 2 图新增 `analytics` 模块 |

---

## 0. Review 摘要与改进清单

> **仓内实现备注（2026-04-23）**：当前仓库已新增 `ui/` 子工程，作为本文档的实现基线。已落地内容优先覆盖 `UI0-UI7`：工程骨架、shared core、PlatformAdapter、design system、implemented-first feature registry、planned feature seam、Web 构建链路、桌面/移动 smoke shell、文档一致性测试，以及按 `§7.4` 回写的 `Phase 1-4` 仓内代码基线。

### 0.0 仓内 Phase 1-4 对齐快照（2026-04-23）

| Phase | 仓内对齐状态 | 当前仓内实现 |
| --- | --- | --- |
| Phase 1 — Web MVP | 基线已落地 | `apps/web` 可构建运行；`dashboard / task-cockpit / workflow-cockpit / approval / stability / alerts / dispatch / inspect / health / incidents / policy / audit / takeover / workers / queues / conversation / hitl / domain-wizard / settings` 已纳入 Web route registry 与 route guard |
| Phase 2 — 桌面端 | 基线已落地 | `apps/electron-win / apps/tauri-macos / apps/tauri-linux` 已提供 shell manifest、默认 adapter、shared runtime 复用与 smoke test；`windowing / shell / process / analyticsConsent` 已有 PlatformAdapter baseline / test double |
| Phase 3 — 移动端 | 基线已落地 | `apps/mobile` 已提供 Android/iOS shell manifest、默认 adapter、deepLink / haptics / secure storage / screen security baseline 与 smoke test |
| Phase 4 — 增强功能 | 基线已落地 | `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance` 已通过 typed seam + feature gate 进入仓内实现；增强模块仍按正文状态标签继续演进 |

补充说明：

- 针对 [ui-design-vs-implementation-review.md](/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/reviews/ui-design-vs-implementation-review.md) 的 `UIR1-UIR6` 仓内整改已完成。
- 当前 UI 子工程已提供 `npm install && npm run typecheck && npm test && npm run build` 闭环脚本。
- 桌面与移动端按“smoke-ready 工程基线”验收，不将商店发布、签名和真实原生桥接上线伪装为仓内已闭环。

本文档基于对 Doc-10（1229 行）和 Doc-11（2341 行）的全量审查，以及对后端 Interface Plane 实现的交叉验证，识别出以下 12 项改进并在本文档中逐一落地。

### 0.1 跨文档重复问题

| #   | 问题                                                                                                        | 影响                         | 本文档改进                                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| R-1 | 技术选型（React 19 / Zustand / TanStack Query / pnpm / Turborepo）在 Doc-10 §10.4 和 Doc-11 §3 几乎逐列重复 | 维护成本翻倍，改一处漏另一处 | 合并为单一 §2 技术选型，消除重复               |
| R-2 | Monorepo 目录结构在 Doc-10 §10.5 和 Doc-11 §5.1 各写一遍，Doc-11 更详细但包含 Doc-10 未覆盖的子目录         | 两份不同粒度的目录树造成混淆 | 合并为单一 §3 工程结构，以 Doc-11 详细版为基准 |
| R-3 | 认证流程在 Doc-10 §10.8 和 Doc-11 §20 均有完整描述，内容高度重叠                                            | 同上                         | 合并为 §6.5 认证与会话安全                     |
| R-4 | 功能模块列表在 Doc-10 §10.5 features/ 和 Doc-11 §8 核心页面蓝图中均有定义                                   | 模块命名和分组不完全一致     | 合并为 §4 功能模块蓝图                         |

### 0.2 版本不一致

| #   | 问题              | Doc-10 值    | Doc-11 值 | 本文档统一值 | 理由                                                   |
| --- | ----------------- | ------------ | --------- | ------------ | ------------------------------------------------------ |
| V-1 | Electron 版本     | 33           | 34        | **34.x**     | Doc-11 为后续文档，采用更新版本；Electron 34 已 stable |
| V-2 | React Native 版本 | 0.76         | 0.79      | **0.79**     | 同上；RN 0.79 New Architecture 默认启用，性能更优      |
| V-3 | Vite 版本         | 未标注 major | 6         | **6.x**      | 明确锁定                                               |
| V-4 | TypeScript 版本   | 5.x          | 5.8+      | **5.8+**     | 与后端 tsconfig 对齐                                   |

### 0.3 后端对齐间隙

| #   | 问题                                                  | 详情                                                                                                                                                                                   | 本文档改进                                                            |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A-1 | UI 功能模块与 UI 契约页面映射不清                     | 契约定义 5 页（TaskCockpit/WorkflowCockpit/ApprovalCenter/StabilityPanel/AdminTakeoverConsole）；Doc-10/11 定义 14 个 features 模块，无显式映射                                        | §4 新增显式映射表                                                     |
| A-2 | REST API 端点含假设性端点                             | Doc-10 §10.6.2 列出 `/api/v1/agents`、`/api/v1/dashboard/metrics`、`/api/v1/explanations` 等端点，后端 http-server 路由中不存在                                                        | §5.2 区分 [Implemented] 与 [Planned] 端点；§5.2.3 新增 API Layer 分级 |
| A-3 | WebSocket 事件类型不一致                              | 后端 `TaskWebSocketEvent` 定义 6 种事件（status_changed/progress/message_delta/artifact_ready/approval_requested/completed/failed）；Doc-10 §10.6.3 列出 15 种 UI 事件，多数无后端对应 | §5.3 按 [Implemented]/[Planned] 分层                                  |
| A-4 | MissionControlService 提供的视图未在 UI 文档中引用    | `getSnapshot()`/`getTaskCockpit()`/`getWorkflowCockpit()`/`getStabilityPanel()`/`getAdminTakeoverConsole()`/`listApprovalQueue()` 是现成后端入口                                       | §4 各页面蓝图直接引用 MCS 方法                                        |
| A-5 | Console 信息架构（契约 §3）与 features 模块分组不对齐 | 契约定义 4 组导航（Mission Control/Operations/Governance/Admin）；Doc-10/11 按 features 平铺                                                                                           | §4.1 采用契约信息架构作为一级导航                                     |

### 0.4 设计深度不足

| #   | 问题                                                                       | 本文档改进                                         |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| D-1 | 离线架构在 Web 端策略模糊（IndexedDB vs Service Worker cache 未分层）      | §5.5 明确 Web 离线三层策略                         |
| D-2 | 24 域差异化 UI 引擎与后端 DomainDescriptor/DomainUIConfig 的对齐方式未定义 | §6.1 定义 DomainUIConfig 消费协议                  |
| D-3 | 契约要求的 5 级下钻（L1-L5）在 UI 组件层无具体设计                         | §4.2 为 TaskCockpit/WorkflowCockpit 定义下钻组件树 |

---

## 目录

> **引用说明**：正文中形如"提取自 Doc-11 §24.1"的 `§` 引用指向已 Superseded 的 `11-cross-platform-ui-implementation-design.md` 原章节编号（§编号 > 8），仅作溯源标注；文档内部交叉引用使用本文档章节编号。

**Part I — 总体设计（§1-§2）**

1. [设计概述与定位](#1-设计概述与定位)
   - 1.7 状态标签约定 _(v2.2 新增)_ + 状态标签更新责任机制 _(v3.0 新增)_
   - 1.8 契约版本协商 _(v2.2 新增)_
2. [六平台技术选型](#2-六平台技术选型)
   - 2.6 桌面混合壳层治理规则 _(v2.2 新增)_

**Part II — 工程基座（§3）**

3. [Monorepo 工程结构与分层架构](#3-monorepo-工程结构与分层架构)
   - 3.7.1 PlatformAdapter 接口 _(v2.2 扩展：windowing/shell/process/analyticsConsent/screenSecurity)_
   - 3.7.3 各平台实现策略 _(v3.0 新增，提取自 Doc-11 §7.2)_
   - 3.7.4 适配器注入机制 _(v3.0 新增，提取自 Doc-11 §7.3)_

**Part III — 功能模块（§4）**

4. [功能模块蓝图与 UI 契约对齐](#4-功能模块蓝图与-ui-契约对齐)
   - 4.2.7 Agent 实时监控中心 _(v3.0 新增)_
   - 4.2.8 数据统计与分析平台 _(v3.0 新增)_
   - 4.2.9 配置管理中心（权限/功能开关/模型配置/域设置/租户/Webhook） _(v3.0 新增)_
   - 4.2.10 已实现模块摘要 _(v3.0 新增)_
   - 4.5 页面级权限矩阵 _(v2.2 新增)_
   - 4.4.1 Web/桌面端路由表（含权限列 + Code Split 列） _(v3.0 增强)_
   - 4.4.2 移动端导航结构（含 Screen 层级 + 特性表） _(v3.0 增强)_
   - 4.4.3 权限路由守卫链 _(v3.0 新增，提取自 Doc-11 §9.3)_
   - 4.6 实施参考蓝图 _(v2.2 新增，提取自 Doc-11)_
     - 4.6.1 NL 对话状态机 → UI 映射
     - 4.6.2 HITL 操作面板与恢复模式
     - 4.6.3 Workflow 调试器能力矩阵
     - 4.6.4 审批中心交互特性
     - 4.6.5-4.6.10 页面线框图 _(v3.0 新增，提取自 Doc-11 §8)_
     - 4.6.11-4.6.13 Agent 监控/统计平台/配置管理技术方案 _(v3.0 新增)_
   - 4.7 Planned 模块 mini-contract _(v2.3 新增)_ + authoritative/derived source 列 _(v3.0 新增)_
     - 4.7.7 AnalyticsDashboard _(v3.0 新增)_
     - 4.7.8 ConfigurationCenter _(v3.0 新增)_

**Part IV — 数据与通信（§5）**

5. [数据流、API 集成与实时层](#5-数据流api-集成与实时层)
   - 5.1.1 Zustand Store / 5.1.2 TanStack Query / 5.1.3 QueryClient / 5.1.4 离线持久化 / 5.1.5 数据流模式 _(v3.0 编号)_
   - 5.1.6 ViewModel 映射规范 _(v2.2 新增，原 §5.1.4 重编号)_
   - 5.2.3 Public UI API Surface 分层 _(v2.3 新增)_
   - 5.2.4 Internal → Contracted 升级清单（API Graduation Matrix） _(v3.0 新增)_
   - 5.3.6 WebSocket 订阅域模型 _(v2.2 新增)_
   - 5.4.1–5.4.5 API 通信层详情 _(v2.2 新增，提取自 Doc-11 §6.1-6.3)_
   - 5.5.6 离线操作许可矩阵 _(v2.2 新增)_
   - 5.3.2.1-5.3.2.3 WSEventRouter 架构/事件→Query 映射/紧急事件 _(v3.0 新增)_
   - 5.4.6 分页与过滤标准化 _(v3.0 新增，提取自 Doc-11 §12.2)_
   - 5.6 前端错误分级与降级策略 _(v2.2 新增)_
   - 5.6.4 Mutation 幂等与重试规范 _(v2.3 新增)_
   - 5.6.5 乐观更新模式 _(v3.0 新增，提取自 Doc-11 §12.3)_
   - 5.6.6 HTTP 状态码→UI 行为映射 _(v3.0 新增，提取自 Doc-11 §12.4)_

**Part IV-b — 权限与脱敏（§4 扩展）**

- 4.5.4 字段级可见性与脱敏矩阵 _(v2.3 新增)_

**Part V — 平台治理（§6）**

6. [域差异化、多租户、安全与设计系统](#6-域差异化多租户安全与设计系统)
   - 6.1.2 DomainUIConfig 类型定义 _(v2.2 扩展：featureVisibility/actionPolicy/defaultDrillDepth/glossaryOverrides)_
   - 6.1.5 域扩展 Slot 模式与动态加载 _(v3.0 新增，提取自 Doc-11 §10.3-10.4)_
   - 6.2.3 数据隔离策略 _(v3.0 新增，提取自 Doc-11 §22.3)_
   - 6.3.1 设计令牌 _(v2.2 补充 primitive.ts)_
   - 6.3.2 核心组件库 _(v2.2 新增，提取自 Doc-11 §15.2)_
   - 6.3.3 主题系统（含暗色模式设计规则） _(v3.0 新增，提取自 Doc-11 §16.3)_
   - 6.4.2 语言优先级（含翻译工作流） _(v3.0 新增，提取自 Doc-11 §17.3)_
   - 6.4.3.1 复杂 UI 组件无障碍专项指南 _(v3.0 新增)_
   - 6.5.4 前端安全基线（含 CSP 策略） + §6.5.5 敏感数据处理 _(v3.0 新增)_
   - 6.6.3 移动端适配特殊考量 _(v3.0 新增，提取自 Doc-11 §19.3)_

**Part VI — 工程化与交付（§7）**

7. [CI/CD、测试、性能与交付路线](#7-cicd测试性能与交付路线)
   - 7.1.4 CI Stage 详情 _(v2.2 新增，提取自 Doc-11 §24.1)_
   - 7.1.5 自动更新策略 _(v2.2 新增，提取自 Doc-11 §24.4)_
   - 7.2.4 测试工具链 _(v2.2 新增，提取自 Doc-11 §25.2)_
   - 7.2.5 v3.0 模块测试策略 _(v3.0 新增)_
   - 7.2.6 覆盖率要求 _(v2.2 新增，提取自 Doc-11 §25.3，原 §7.2.5 重编号)_
   - 7.3.3 性能优化策略（Web/移动端/桌面端详表） _(v3.0 新增，提取自 Doc-11 §23.2-23.4)_
   - 7.3.4 图表密集页面性能预算 _(v3.0 新增)_
   - 7.3.5 CI 构建影响评估 _(v3.0 新增)_
   - 7.4 分阶段交付计划 _(v2.2 增加 Gate 0-3 依赖门禁)_ + 团队配置建议 _(v3.0 新增)_
   - 7.5 风险与缓释 _(v3.0 新增 3 项补充风险)_

**附录**

- [附录 A：后端 API 端点 → UI 功能完整映射](#附录-a)
- [附录 B：WebSocket 事件完整映射](#附录-b)
- [附录 C：ADR 决策索引](#附录-c)
- [附录 D：术语表](#附录-d)
- [附录 E：v2.3 整改清单（P0/P1/P2）](#附录-e) _(v2.3 新增)_

---

# Part I — 总体设计

---

# 1. 设计概述与定位

## 1.1 背景

Automatic Agent Platform 后端已完成五平面架构（P1 Interface / P2 Control / P3 Orchestration / P4 Execution / P5 State-Evidence + X1 Reliability Fabric）的开发，拥有 79 个 CLI 入口作为当前唯一交互方式。后端为 Node.js 22 + TypeScript ESM 纯后端系统，零前端依赖。

本文档定义覆盖六大平台（Web / Windows / macOS / Linux / Android / iOS）的统一 UI 层，使所有角色（独立运营者 → 平台 SRE）均可通过图形界面完成日常操作。

## 1.2 与五平面架构的关系

```text
┌─────────────────────────────────────────────────────────────────┐
│              本文档覆盖范围：跨平台 UI 层                         │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ Web  │ │ Win  │ │macOS │ │Linux │ │Droid │ │ iOS  │       │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘       │
│     └────────┴────────┴────────┴────────┴────────┘             │
│                        │                                        │
│              共享核心层（TypeScript）                              │
│              API Client / State / Auth / Sync                    │
└────────────────────────┬────────────────────────────────────────┘
                         │  REST + WebSocket（§5.2/§5.3 API 与实时层）
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             P1 Interface Plane（后端已实现）                       │
│                                                                 │
│  ┌───────────────────┐ ┌────────────────────┐ ┌──────────────┐ │
│  │ HTTP API Server   │ │ WebSocket Server   │ │ Stream Bridge│ │
│  │ (task/admin/      │ │ (WebSocketBridge + │ │ (SSE)        │ │
│  │  console/dashboard│ │  DashboardWSServer │ │              │ │
│  │  routes)          │ │  + TaskWSRelay)    │ │              │ │
│  └───────────────────┘ └────────────────────┘ └──────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ MissionControlService — 所有 Cockpit 视图的数据聚合入口     │ │
│  │ getSnapshot() · getTaskCockpit() · getWorkflowCockpit()   │ │
│  │ getStabilityPanel() · getAdminTakeoverConsole()            │ │
│  │ listApprovalQueue()                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ OperatorConsoleBackendService — 运营者快照/审批/Worker/事件 │ │
│  └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│      P2 Control · P3 Orchestration · P4 Execution               │
│      P5 State-Evidence · X1 Reliability Fabric                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键约束**：UI 层是 P1 Interface Plane 的**纯消费者**，遵循 UP-1（API-First）原则：

- 所有数据通过 REST API（§5.2）和 `ws/v1/stream`（§5.3）获取
- 所有操作映射到标准 REST 端点
- 不引入旁路绕过 P2 Control Plane 的策略检查
- UI 展示状态不得反向定义 task/workflow/execution 的 authoritative 事实（契约 §2.5）

## 1.3 设计目标

| 编号 | 目标       | 量化指标                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| G-1  | 六平台覆盖 | Web（Chrome/Firefox/Safari/Edge）+ Windows 10+ + macOS 12+ + Linux(Ubuntu 22+/RHEL 9+) + Android 10+ + iOS 16+ |
| G-2  | 代码共享   | 跨平台共享率 ≥ 70%                                                                                             |
| G-3  | 性能       | Web FCP < 1.5s, LCP < 2.5s; 桌面启动 < 3s; 移动启动 < 2s                                                       |
| G-4  | 实时性     | WebSocket 事件 → UI 更新 < 200ms (P99)                                                                         |
| G-5  | 离线       | 移动端/Edge 场景支持离线操作 + 恢复同步                                                                        |
| G-6  | 无障碍     | WCAG 2.1 AA 合规                                                                                               |
| G-7  | 安全       | Token 安全存储；PII 不缓存；前端安全基线全覆盖                                                                 |
| G-8  | 多租户     | 租户级品牌定制 + 功能开关 + 合规模式                                                                           |
| G-9  | 角色全覆盖 | 独立运营者(L1) · 业务线负责人(L1) · 域管理员(L2) · Pack 开发者(L2/L3) · 平台 SRE(L3/L4)                        |
| G-10 | 一致体验   | 同一用户在不同平台上看到一致的数据、操作入口、审批流                                                           |

## 1.4 设计原则

### 1.4.1 架构原则

| 编号 | 原则               | 说明                                                                                                                                                  |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| UP-1 | API-First          | UI 层是 P1 Interface Plane Public API（§5.2/§5.3）的消费者，不引入旁路。所有操作映射到标准 REST/WebSocket 端点（ADR-No-Code-UX-Maps-To-Standard-API） |
| UP-2 | 共享内核、平台外壳 | 业务逻辑、状态管理、API 通信抽取为跨平台共享层；渲染层按平台独立实现                                                                                  |
| UP-3 | 渐进增强           | 核心功能在所有平台可用；高级功能（调试器时间旅行、Workflow 画布拖拽）在 Web/桌面端增强                                                                |
| UP-4 | 离线优先设计       | 移动端和 Edge 场景下，本地缓存 + 乐观更新 + 冲突解决为默认模式                                                                                        |
| UP-5 | 实时为默认         | 所有可变数据默认通过 WebSocket 实时推送，轮询仅作为 fallback                                                                                          |
| UP-6 | 安全不妥协         | Token 存储遵循平台安全最佳实践；PII 不缓存到本地                                                                                                      |
| UP-7 | 可插拔渲染         | 组件接口标准化，渲染实现可替换（React DOM / React Native / Electron / Tauri WebView）                                                                 |
| UP-8 | 契约驱动           | UI 信息架构、页面字段、下钻深度严格遵循 `ui_console_and_cockpit_contract.md`，不自行发明页面结构                                                      |

### 1.4.2 交互原则

| 编号 | 原则           | 说明                                                                                       |
| ---- | -------------- | ------------------------------------------------------------------------------------------ |
| UX-1 | 对话优先       | NL 对话框是所有平台的主入口（§4.1 NL Conversation 模块），任何时候用户都可以切换到对话模式 |
| UX-2 | 渐进式信息披露 | 默认展示 L1 摘要，按需展开 L2-L5 详情（契约 §7 五级下钻）                                  |
| UX-3 | 操作可撤销     | 所有非不可逆操作提供 Undo 缓冲（5s 内可撤销），不可逆操作需二次确认                        |
| UX-4 | 状态可感知     | 网络状态、同步状态、离线队列深度始终可见                                                   |
| UX-5 | 上下文保持     | 页面切换/App 切回时恢复到离开时的精确位置和状态                                            |
| UX-6 | 首页即健康     | Console 首页先回答"系统是否健康、当前在做什么、卡在哪里"（契约 §4）                        |

## 1.5 设计范围

| 范围内                                    | 范围外                              |
| ----------------------------------------- | ----------------------------------- |
| 六平台 UI 壳层工程                        | 后端 API 开发（已有）               |
| 共享核心层（状态/API/Auth/同步）          | P1-P5 平面内部实现变更              |
| 契约定义的 5 核心页面 + 扩展功能模块      | 单个业务域 Prompt 细节              |
| 设计系统（Token/组件/主题）               | 视觉稿（交由 UX 团队）              |
| 构建/测试/CI/CD 流水线                    | 基础设施物理部署（Kubernetes 配置） |
| 多语言框架                                | 具体翻译内容                        |
| 后端 API 增强需求清单（标注为 [Planned]） | 后端 API 的具体实现                 |

## 1.6 角色与视图映射

| 角色         | 级别  | 主要页面（按契约信息架构）                                               | 平台偏好     |
| ------------ | ----- | ------------------------------------------------------------------------ | ------------ |
| 独立运营者   | L1    | Dashboard · TaskCockpit · ApprovalCenter · 对话                          | Web / 移动端 |
| 业务线负责人 | L1    | Dashboard · TaskCockpit · ApprovalCenter · CostCenter                    | Web / 移动端 |
| 域管理员     | L2    | AgentManager · DomainWizard · Marketplace · Dashboard(L2)                | Web / 桌面端 |
| Pack 开发者  | L2/L3 | WorkflowBuilder · WorkflowDebugger · AgentManager · Marketplace          | Web / 桌面端 |
| 平台 SRE     | L3/L4 | StabilityPanel · AdminTakeoverConsole · Incidents · WorkerPanel · 调试器 | Web / 桌面端 |

## 1.7 状态标签约定

本文档对所有 API 端点、WebSocket 事件、Feature 模块、PlatformAdapter 能力、DomainUIConfig 字段采用四级状态标签，区分"已确认事实"和"设计目标"：

| 标签            | 含义                                                        | 颜色提示 |
| --------------- | ----------------------------------------------------------- | -------- |
| **Implemented** | 后端已实现且经过测试，UI 可直接集成                         | 🟢 绿    |
| **Planned**     | 已纳入交付路线图（§7.4），后端/前端即将实现，接口契约已稳定 | 🔵 蓝    |
| **Proposed**    | 架构设计已完成但尚未进入开发排期，接口可能变更              | 🟡 黄    |
| **Deferred**    | 已识别需求但明确推迟到后续版本，不阻塞当前交付              | ⚪ 灰    |

**Implemented 二级子标签** _(v2.3 新增)_：

`[Implemented]` 条目内部维护三个成熟度子标签，帮助前端团队评估集成风险：

| 子标签                     | 含义                                                                                                     | 前端集成指导                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Implemented-Contracted** | 后端 service + HTTP route + OpenAPI/JSON schema 均已发布且冻结，有公开契约保障                           | Phase 1 可直接集成，无额外对齐成本          |
| **Implemented-Internal**   | 后端 service method 存在且经过测试，但仅通过内部 route（如 `/console/*` HTML）暴露，无公开 JSON contract | 需后端团队额外暴露 JSON API 或提供临时 mock |
| **Implemented-Partial**    | 后端 service method 存在，部分字段/场景已实现，但 schema 尚未冻结或缺少边界场景覆盖                      | 可开始集成但需做好 schema 变更的防御性编码  |

**子标签行内格式**：`[Implemented/Contracted]` `[Implemented/Internal]` `[Implemented/Partial]`

**使用规则**：

- 表格中以 `[Implemented]` `[Planned]` `[Proposed]` `[Deferred]` 行内标注
- 本文档 §4.1 功能模块表、§5.2 API 端点表、§5.3 WebSocket 事件表、§3.7 PlatformAdapter 接口表、附录 A/B 均已标注状态
- 集成开发时，仅 `[Implemented/Contracted]` 条目可在 Phase 1 无条件直接对接；`[Implemented/Internal]` 和 `[Implemented/Partial]` 条目需在集成前与后端确认暴露方式和 schema 稳定性；`[Planned]` 条目须等待对应 Gate 通过（§7.4）
- 状态标签由架构评审委员会在每个 Phase Gate 时更新；子标签由后端 API owner 在每个 Sprint Review 时更新

**状态标签更新责任机制** _(v3.0 新增)_：

状态标签的价值取决于其时效性。以下矩阵定义了谁更新、更新什么、何时更新、以及哪个 Gate 强制校验：

| 标签类别                                             | 更新责任人         | 更新内容                            | 更新时机              | 强制校验节点                  |
| ---------------------------------------------------- | ------------------ | ----------------------------------- | --------------------- | ----------------------------- |
| 四级状态标签 (Implemented/Planned/Proposed/Deferred) | 架构评审委员会     | 模块/端点整体状态升降级             | 每个 Phase Gate       | Gate 0/1/2/3 准入审查         |
| Implemented 子标签 (Contracted/Internal/Partial)     | 后端 API owner     | API Layer 级别变更、schema 冻结状态 | 每个 Sprint Review    | Phase Gate + Sprint Demo      |
| API Graduation Matrix (§5.2.4)                       | 后端 API owner     | `Current Layer` / `Status` 列       | 每个 Sprint Review    | 对应 Target Milestone 的 Gate |
| Feature 模块状态                                     | 前端 Feature owner | UI 侧实现进度、集成状态             | 每个 Sprint Review    | Phase Gate + Sprint Demo      |
| mini-contract (§4.7) 维度更新                        | Projection Owner   | DTO schema 变更、Query Keys 调整    | schema 变更时即时更新 | Phase Gate                    |
| PlatformAdapter 能力状态                             | 平台适配层 owner   | 各平台适配器实现状态                | 每个 Sprint Review    | Phase Gate                    |
| 附录 A/B 端点/事件状态                               | 后端 API owner     | 端点新增/废弃、事件实现状态         | 后端发布时即时更新    | Phase Gate                    |

**强制刷新规则**：

- **Sprint Review**：后端 API owner 和前端 Feature owner 各自更新所属标签；未更新的标签在 Sprint Review 会议纪要中标记为 `[STALE]`
- **Phase Gate 准入**：Gate 审查前 48 小时，所有该 Gate 涉及的标签必须 refresh；`[STALE]` 标签阻塞 Gate 通过
- **紧急变更**：后端 breaking change 发布后 24 小时内，API owner 必须更新受影响的所有标签并通知前端 Feature owner
- **季度审计**：每季度末架构评审委员会对全文档标签做一次全量校验，清除过期标签

## 1.8 契约版本协商

UI 层作为 P1 Interface Plane 的消费者，必须与后端在多个契约维度保持版本兼容：

| 契约维度              | 当前版本 | UI 支持范围        | Mismatch 处理策略                                                        |
| --------------------- | -------- | ------------------ | ------------------------------------------------------------------------ |
| REST API 版本         | v1       | v1                 | 请求头 `Accept-Version: v1`；若后端返回 `406`，显示升级提示并禁用写操作  |
| WebSocket Schema 版本 | v1       | v1                 | 握手时发送 `schema_version: 1`；若协商失败，降级为 REST 轮询             |
| DomainDescriptor 版本 | 由域定义 | ≥ 当前已知最低版本 | 启动时拉取 descriptor，若 `version < minSupported`，标记域为"降级模式"   |
| UI Contract 版本      | 1.0      | 1.0                | 前端启动时校验 `/api/v1/meta/contract-version`；不匹配时显示 banner 警告 |
| DomainUIConfig Schema | 1.0      | 1.0                | 未知字段忽略（前向兼容）；缺失必需字段使用默认值并上报 telemetry         |

**降级行为**：

- **API 版本不匹配**：只读模式 + 顶部 banner "当前客户端版本与服务端不兼容，请升级"
- **WS 协商失败**：自动降级为 30s REST 轮询，状态栏显示"实时更新不可用"
- **Contract 版本不匹配**：功能正常但显示持久 banner，telemetry 上报 `contract_version_mismatch`
- **DomainDescriptor 过旧**：该域页面显示"域配置版本过低"警告，隐藏依赖新字段的 UI 控件

---

# 2. 六平台技术选型

> **改进点 V-1~V-4**：统一 Doc-10/Doc-11 版本分歧；以更新的稳定版本为准。

## 2.1 技术栈总览（权威版本）

| 平台        | 壳层技术          | 渲染引擎              | 原生桥接           | 安装包格式                     | 预估包体积 |
| ----------- | ----------------- | --------------------- | ------------------ | ------------------------------ | ---------- |
| **Web**     | React 19 + Vite 6 | React DOM             | PWA Service Worker | CDN / Docker nginx             | ~2MB gzip  |
| **Windows** | Electron 34       | Chromium (React DOM)  | Node.js + Win32    | MSIX / EXE (NSIS)              | ~120MB     |
| **macOS**   | Tauri 2.x         | WebKit (React DOM)    | Rust + AppKit      | DMG / Mac App Store            | ~15MB      |
| **Linux**   | Tauri 2.x         | WebKitGTK (React DOM) | Rust + GTK4        | AppImage / DEB / RPM / Flatpak | ~15MB      |
| **Android** | React Native 0.79 | Hermes + Fabric       | Kotlin/Java bridge | AAB (Play) / APK               | ~28MB      |
| **iOS**     | React Native 0.79 | JSI + Fabric          | Swift/ObjC bridge  | IPA (App Store / TestFlight)   | ~35MB      |

## 2.2 选型决策矩阵（ADR-UI-001）

| 决策点                  | 选项 A            | 选项 B           | 选项 C        | 决策            | 理由                                                                             |
| ----------------------- | ----------------- | ---------------- | ------------- | --------------- | -------------------------------------------------------------------------------- |
| UI 框架                 | React 19          | Vue 3            | Svelte 5      | **React 19**    | 与 RN 生态统一；社区/组件库最成熟；团队已有经验                                  |
| 移动端                  | React Native 0.79 | Flutter          | Capacitor     | **RN 0.79**     | 与 React 生态共享 hooks/state；New Arch 性能已接近原生；0.79 默认启用 New Arch   |
| Windows 桌面            | Electron 34       | Tauri 2          | .NET MAUI     | **Electron 34** | Windows 用户基数最大，Electron 生态最成熟，插件/调试工具完善                     |
| macOS/Linux 桌面        | Tauri 2           | Electron 34      | —             | **Tauri 2**     | 包体积小(15MB vs 120MB)；Rust 后端安全性高；macOS/Linux 市场份额较低，Tauri 足够 |
| 状态管理                | Zustand 5         | Redux Toolkit    | Jotai         | **Zustand 5**   | <1KB；TS 友好；middleware 生态(persist/immer)；RN 兼容                           |
| 服务端状态              | TanStack Query v5 | SWR 2            | Apollo Client | **TQ v5**       | 自动缓存/去重/后台刷新/乐观更新；离线支持；与 WebSocket 实时推送互补             |
| 图表库                  | ECharts           | Recharts         | Victory       | **ECharts**     | 大数据量性能优；图表类型丰富；RN 通过 WebView 嵌入                               |
| 画布（Workflow 构建器） | React Flow        | xyflow           | 自研          | **React Flow**  | 成熟的节点画布；TypeScript 原生；社区活跃                                        |
| 包管理                  | npm workspaces    | Yarn 4 workspace | pnpm workspace | **npm workspaces** | 与当前仓内 `package.json` 一致；零额外编排层                                      |
| 构建编排                | npm scripts       | Nx               | Turborepo     | **npm scripts** | 当前仓内由 workspace + app-level scripts 组成最小可用构建链路                    |

## 2.3 框架版本约束（权威版本锁定）

| 框架           | 锁定版本 | 升级策略                     |
| -------------- | -------- | ---------------------------- |
| React          | 19.x     | major 锁定，minor 随发布升级 |
| React Native   | 0.79.x   | minor 锁定，patch 随发布升级 |
| Electron       | 34.x     | major 锁定，minor 随安全更新 |
| Tauri          | 2.x      | major 锁定                   |
| TypeScript     | 5.8+     | 与后端 tsconfig 对齐         |
| Node.js        | 22 LTS   | 构建/CI 使用，与后端一致     |
| Vite           | 6.x      | major 锁定                   |
| Zustand        | 5.x      | major 锁定                   |
| TanStack Query | 5.x      | major 锁定                   |
| React Flow     | 11.x     | 当前仓内基线；升级到 12.x 需单列迁移 |
| ECharts        | 5.x      | major 锁定                   |

## 2.4 跨平台代码复用矩阵

| 代码层                        | Web | Win(Electron) | Mac(Tauri) | Linux(Tauri) | Android(RN) | iOS(RN)   |
| ----------------------------- | --- | ------------- | ---------- | ------------ | ----------- | --------- |
| L3 共享核心 (state/api/auth)  | ✓   | ✓             | ✓          | ✓            | ✓           | ✓         |
| L2 React Hooks (useTask etc.) | ✓   | ✓             | ✓          | ✓            | ✓           | ✓         |
| L2 React DOM 组件             | ✓   | ✓             | ✓          | ✓            | ✗           | ✗         |
| L2 React Native 组件          | ✗   | ✗             | ✗          | ✗            | ✓           | ✓         |
| L1 平台壳层                   | Web | Electron      | Tauri      | Tauri        | RN Entry    | RN Entry  |
| L4 平台适配                   | Web | Electron      | Tauri      | Tauri        | RN Module   | RN Module |

**综合共享率估算**：~72%

## 2.5 六平台适配策略

### 2.5.1 Web 平台

```text
React 19 SPA + Vite 6
    │
    ├── PWA Service Worker
    │   ├── 静态资源缓存（Cache-First）
    │   ├── API 响应缓存（Network-First + Stale-While-Revalidate）
    │   └── 离线 fallback 页面
    │
    ├── 响应式布局
    │   ├── ≥1440px：完整三栏（导航 + 内容 + 侧面板）
    │   ├── 1024-1439px：两栏（导航折叠 + 内容）
    │   ├── 768-1023px：单栏 + 汉堡菜单
    │   └── <768px：移动视图（建议使用原生 App）
    │
    └── 性能指标
        ├── FCP < 1.5s（CDN + Code Splitting）
        ├── LCP < 2.5s（关键路径预加载）
        ├── CLS < 0.1（骨架屏 + 固定布局）
        └── INP < 200ms（React concurrent features）
```

### 2.5.2 Windows（Electron 34）

| 特性     | 实现方式                                                            |
| -------- | ------------------------------------------------------------------- |
| 窗口管理 | 多窗口支持（主窗口 + 调试器窗口 + 对话浮窗）                        |
| 系统集成 | 系统托盘常驻、Jump List（最近任务/快速审批）、Windows Timeline 集成 |
| 通知     | Windows Notification Center（审批/告警/任务完成）                   |
| 快捷键   | Ctrl+K（命令面板）、Ctrl+N（新任务）、Ctrl+Shift+D（调试器）        |
| 自动更新 | electron-updater 增量更新（差分包 ~5MB）                            |
| 性能     | 启动时间 < 3s（预加载 + 持久化缓存）；内存 < 300MB（空闲态）        |
| 安装包   | MSIX（企业组策略分发）+ EXE（个人安装）                             |

### 2.5.3 macOS（Tauri 2）

| 特性      | 实现方式                                                     |
| --------- | ------------------------------------------------------------ |
| 原生感    | 遵循 HIG：Traffic Light 窗口按钮、原生菜单栏、Spotlight 集成 |
| 窗口管理  | 原生全屏 + Split View 支持；Stage Manager 兼容               |
| Menu Bar  | 常驻 Menu Bar 图标（未读审批计数 Badge）                     |
| Touch Bar | 上下文感知快捷操作（审批按钮、任务状态切换）                 |
| 通知      | macOS Notification Center + 关键告警 Critical Alert          |
| 安全      | App Sandbox + Hardened Runtime；Keychain 存储 Token          |
| 分发      | DMG（直接下载）+ Mac App Store（企业 MDM 分发）              |
| 安装包    | ~15MB（Tauri，无 Chromium 捆绑）                             |

### 2.5.4 Linux（Tauri 2）

| 特性     | 实现方式                                                   |
| -------- | ---------------------------------------------------------- |
| 桌面环境 | 支持 GNOME 45+（GTK4）和 KDE Plasma 6+（通过 XDG 标准）    |
| 窗口管理 | Wayland 优先、X11 fallback；支持 tiling WM（i3/Sway）      |
| 系统托盘 | StatusNotifierItem（SNI）协议；fallback 到 XEmbed          |
| 通知     | D-Bus org.freedesktop.Notifications；支持 dunst/mako       |
| 文件管理 | xdg-open 打开导出文件；遵循 XDG Base Directory 规范        |
| 主题     | 自动检测系统 Dark/Light 模式（GTK/KDE 主题跟随）           |
| 分发     | AppImage（通用）/ Flatpak（沙箱）/ DEB + RPM（系统包管理） |
| 安装包   | ~15MB（Tauri）                                             |

### 2.5.5 Android（React Native 0.79）

| 特性     | 实现方式                                                        |
| -------- | --------------------------------------------------------------- |
| 最低版本 | Android 10 (API 29)，目标 API 35                                |
| 架构     | React Native 0.79 + New Architecture (Fabric + TurboModules)    |
| 导航     | 底部标签栏（首页/任务/审批/看板/更多）+ Stack 导航              |
| 通知     | FCM 推送；前台通知通道分级（审批=高优、任务完成=默认、营销=低） |
| 离线     | SQLite (Room) 本地缓存 + WorkManager 后台同步                   |
| 生物识别 | BiometricPrompt API（指纹/面部解锁应用）                        |
| 手势     | 下拉刷新、左滑删除/操作、长按上下文菜单                         |
| 性能     | 启动 < 2s（Hermes 预编译 + App Startup Library）                |
| Widget   | Android Widget（待审批计数 + 最近任务状态）                     |
| 包体积   | < 30MB（AAB 按架构拆分）                                        |

### 2.5.6 iOS（React Native 0.79）

| 特性      | 实现方式                                                                 |
| --------- | ------------------------------------------------------------------------ |
| 最低版本  | iOS 16+，目标 iOS 18                                                     |
| 架构      | React Native 0.79 + New Architecture (JSI + Fabric)                      |
| 导航      | UITabBarController 风格底部栏 + UINavigationController 风格堆栈          |
| 通知      | APNs 推送；Notification Service Extension（富通知：审批预览 + 快捷操作） |
| 离线      | Core Data / SQLite (GRDB) + BackgroundTasks framework                    |
| 生物识别  | LocalAuthentication framework（Face ID / Touch ID）                      |
| Widget    | WidgetKit（Today Widget + Lock Screen Widget：待审批、任务状态）         |
| Shortcuts | Siri Shortcuts 集成（"嘿 Siri，帮我查看今天的审批"）                     |
| 手势      | iOS 标准手势（边缘返回、3D Touch peek）；Haptic Feedback                 |
| 性能      | 启动 < 1.5s（JSI 直调 + MetroBundle 预热）                               |
| 隐私      | App Tracking Transparency；Privacy Manifest 声明数据类型                 |
| 包体积    | < 40MB                                                                   |

### 2.5.7 平台特性矩阵

| 特性     | Web                    | Windows                     | macOS                     | Linux             | Android            | iOS                |
| -------- | ---------------------- | --------------------------- | ------------------------- | ----------------- | ------------------ | ------------------ |
| 通知     | Web Notification API   | Windows Notification Center | macOS Notification Center | libnotify / D-Bus | FCM Push           | APNs Push          |
| 生物识别 | WebAuthn               | Windows Hello               | Touch ID / Face ID        | —                 | Fingerprint / Face | Face ID / Touch ID |
| 安全存储 | —                      | Credential Manager          | Keychain                  | libsecret/kwallet | Android Keystore   | iOS Keychain       |
| 文件访问 | File System Access API | Win32 File API              | NSFileManager             | GIO/POSIX         | SAF/MediaStore     | UIDocumentPicker   |
| 深度链接 | URL routing            | Protocol handler            | Universal Links           | xdg-open          | App Links          | Universal Links    |
| 快捷键   | 标准 Web               | Ctrl+系列                   | Cmd+系列                  | Ctrl+系列         | —                  | —                  |
| 系统托盘 | —                      | System Tray                 | Menu Bar                  | System Tray       | —                  | —                  |
| 自动更新 | Service Worker         | electron-updater            | Sparkle (Tauri)           | AppImage delta    | Google Play        | App Store          |
| 离线存储 | IndexedDB              | SQLite (better-sqlite3)     | SQLite (rusqlite)         | SQLite (rusqlite) | SQLite (Room)      | SQLite (GRDB)      |
| 剪贴板   | Clipboard API          | Win32 Clipboard             | NSPasteboard              | GTK Clipboard     | ClipboardManager   | UIPasteboard       |

## 2.6 桌面混合壳层治理规则（ADR-UI-009）

### 2.6.1 为什么不统一桌面壳层

Windows 采用 Electron 34，macOS/Linux 采用 Tauri 2.x——双栈并行的决策基于以下收益-成本分析：

| 维度         | 统一 Electron            | 统一 Tauri                    | 双栈（当前选择） |
| ------------ | ------------------------ | ----------------------------- | ---------------- |
| Windows 体验 | ✅ 生态最成熟            | ⚠️ WebView2 依赖 Edge Runtime | ✅ Electron 最优 |
| macOS 包体积 | ❌ ~120MB                | ✅ ~15MB                      | ✅ Tauri 15MB    |
| Linux 兼容性 | ⚠️ Chromium sandbox 受限 | ✅ WebKitGTK 原生             | ✅ Tauri 原生    |
| 安全表面     | ❌ Node.js 全权限        | ✅ Rust 最小权限              | ✅ 各平台最优    |
| 维护成本     | ✅ 单一栈                | ✅ 单一栈                     | ⚠️ 两套原生桥接  |
| 插件生态     | ✅ npm 生态丰富          | ⚠️ Tauri 插件尚在成长         | ✅ 各取所长      |

**结论**：双栈的额外维护成本（约 15% 的桌面特定代码）被更优的平台体验和安全性所抵消。

### 2.6.2 PlatformAdapter 边界规则

| 能力类别          | 必须通过 PlatformAdapter | 允许分叉实现 | 说明                                                         |
| ----------------- | ------------------------ | ------------ | ------------------------------------------------------------ |
| 窗口管理          | ✅                       | ❌           | `windowing` 接口统一抽象（§3.7.1）                           |
| 文件系统访问      | ✅                       | ❌           | 通过 `fileAccess` 接口，禁止直接调用 Node.js fs / Rust fs    |
| 安全存储          | ✅                       | ❌           | Token/密钥存储必须走 `secureStorage` 接口                    |
| 剪贴板            | ✅                       | ❌           | 已在 v2.1 定义                                               |
| 深度链接          | ✅                       | ❌           | 已在 v2.1 定义                                               |
| 通知              | ✅                       | ❌           | 跨平台通知接口                                               |
| 系统托盘/Menu Bar | ❌                       | ✅           | Electron Tray vs Tauri SystemTray API 差异过大，允许各自实现 |
| 自动更新          | ❌                       | ✅           | electron-updater vs Tauri updater 机制不同                   |
| 原生菜单          | ❌                       | ✅           | 平台菜单规范差异大（Windows Menu Bar vs macOS App Menu）     |

### 2.6.3 桌面端测试矩阵拆分

| 测试层级     | Electron (Windows)              | Tauri (macOS/Linux)                 | 共享                          |
| ------------ | ------------------------------- | ----------------------------------- | ----------------------------- |
| 单元测试     | Vitest + jsdom                  | Vitest + jsdom                      | 100% 共享（shared/ 层）       |
| 集成测试     | Playwright + Electron launch    | Playwright + Tauri WebDriver        | 测试用例共享，driver 层分叉   |
| E2E 测试     | Spectron / Playwright Electron  | tauri-driver + WebDriver            | 页面级场景脚本共享            |
| 平台特定测试 | Win32 API mock · MSIX 安装/卸载 | AppKit/GTK mock · DMG/AppImage 验证 | 不共享                        |
| CI 矩阵      | windows-latest runner           | macos-latest + ubuntu-latest runner | 共享 lint/typecheck/unit 阶段 |

---

# Part II — 工程基座

---

# 3. Monorepo 工程结构与分层架构

> **改进点 R-2**：合并 Doc-10 §10.5 和 Doc-11 §5.1 的目录结构为单一权威版本。

## 3.1 四层分层模型

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1 — 平台壳层（Platform Shell）                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌─────┐│
│  │ Web SPA  │ │ Electron │ │ Tauri  │ │ Tauri  │ │ RN    │ │ RN  ││
│  │ (Vite 6) │ │ 34 (Win) │ │ 2(Mac) │ │2(Linux)│ │(Droid)│ │(iOS)││
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬────┘ └──┬──┘│
├───────┴────────────┴───────────┴──────────┴─────────┴─────────┴────┤
│  Layer 2 — 功能模块层（Feature Modules）                              │
│  按契约信息架构（§3）四组导航分组：                                     │
│  ┌─────────────────┐┌──────────────────┐┌──────────────────────────┐│
│  │ Mission Control ││   Operations     ││    Governance            ││
│  │ ─ dashboard     ││   ─ dispatch     ││    ─ policy              ││
│  │ ─ task-cockpit  ││   ─ inspect      ││    ─ audit               ││
│  │ ─ wf-cockpit    ││   ─ health       ││    ─ compliance          ││
│  │ ─ approval      ││   ─ incidents    ││    ─ runtime-decisions*  ││
│  │ ─ stability     ││                  ││                          ││
│  │ ─ alerts        ││                  ││                          ││
│  ├─────────────────┤├──────────────────┤├──────────────────────────┤│
│  │     Admin       ││   Extended       ││    Shared Features       ││
│  │ ─ takeover      ││ ─ conversation   ││ ─ explainability         ││
│  │ ─ workers       ││ ─ wf-builder     ││ ─ cost-center            ││
│  │ ─ queues        ││ ─ wf-debugger    ││ ─ marketplace            ││
│  │ ─ feature-flags ││ ─ agent-manager  ││ ─ domain-wizard          ││
│  │ ─ capability    ││ ─ hitl           ││ ─ settings               ││
│  │                 ││                  ││ ─ analytics              ││
│  └─────────────────┘└──────────────────┘└──────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Layer 3 — 共享核心层（Shared Core）— 100% 跨平台                    │
│  ┌───────────┐┌──────────┐┌────────┐┌────────┐┌───────┐┌────────┐│
│  │api-client ││  state   ││  auth  ││  sync  ││  i18n ││telemetry││
│  ├───────────┤├──────────┤├────────┤├────────┤├───────┤├────────┤│
│  │ domain    ││permission││nl-client││ws-mgr ││ types ││error-hdl││
│  └───────────┘└──────────┘└────────┘└────────┘└───────┘└────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Layer 4 — 平台适配层（Platform Adapters）— 0% 共享                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Web API  │ │ Node.js  │ │ Rust     │ │ Android  │ │ iOS      ││
│  │ (fetch)  │ │(Electron)│ │ (Tauri)  │ │ (Bridge) │ │ (Bridge) ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
└────────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌────────────────────────────────────────────────────────────────────┐
│          Platform Backend（P1 Interface Plane, §6 API）             │
└────────────────────────────────────────────────────────────────────┘
```

> \* `runtime-decisions` 标记为 `[Deferred]`，待 v2.5 评审后确定是否独立为功能模块。

## 3.2 各层职责与约束

| 层次          | 职责                                           | 共享率 | 技术约束                            |
| ------------- | ---------------------------------------------- | ------ | ----------------------------------- |
| L1 平台壳层   | 平台入口、窗口管理、系统集成、原生通知         | 0%     | 每平台独立实现                      |
| L2 功能模块层 | 页面组件、路由、业务交互逻辑                   | ~60%   | Web/桌面共享 React DOM；RN 独立组件 |
| L3 共享核心层 | 状态、API、Auth、同步、领域逻辑、类型、遥测    | 100%   | 纯 TypeScript，零平台依赖           |
| L4 平台适配层 | 网络、存储、通知、生物识别、文件系统的平台封装 | 0%     | 统一接口，平台独立实现              |

## 3.3 依赖规则

```text
L1 → L2 → L3 ← L4
              ↑
         L4 实现 L3 定义的接口
```

- L3 不可依赖 L1/L2（纯逻辑层）
- L2 可依赖 L3，不可直接依赖 L4（通过 L3 的接口间接使用 L4 能力）
- L1 可依赖 L2/L3/L4
- L4 不可依赖 L1/L2/L3（仅实现 L3 定义的 `PlatformAdapter` 接口）
- 功能模块间通过 L3 共享核心通信，不直接互相导入

## 3.4 目录全景（权威版本）

```text
ui/                                    # UI Monorepo 子工程（npm workspaces）
├── package.json                       # 根 workspace 与脚本入口
├── package-lock.json                  # 锁定依赖版本
├── tsconfig.json                      # 共享 TypeScript 基线
├── eslint.config.js                   # ESLint 9 配置
├── vitest.config.ts                   # Vitest 测试配置
├── .storybook/                        # Storybook 配置
├── .env.example                       # UI 环境变量模板
├── apps/                              # L1 平台壳层入口
│   ├── web/                           # React 19 + Vite 6 SPA
│   ├── electron-win/                  # Electron Windows smoke shell
│   ├── tauri-macos/                   # Tauri macOS smoke shell
│   ├── tauri-linux/                   # Tauri Linux smoke shell
│   └── mobile/                        # React Native smoke shell
├── packages/
│   ├── shared/                        # L3 共享核心层
│   │   ├── api-client/                # RESTClient / WSClient / endpoint catalog
│   │   ├── auth/                      # auth-service / token-manager / session-guard
│   │   ├── state/                     # stores + query factories
│   │   ├── sync/                      # offline queue / conflict resolver / coordinator
│   │   ├── i18n/                      # TranslationService + ICU MessageFormat
│   │   ├── domain/                    # route guard / redaction / DomainUIConfig
│   │   ├── nl-client/                 # ConversationClient 基线
│   │   ├── telemetry/                 # TelemetrySink + OTLP exporter
│   │   ├── platform/                  # PlatformAdapter 工厂与默认实现
│   │   └── types/                     # DTO 与共享类型
│   ├── ui-core/                       # Web/桌面共享 UI 组件
│   ├── ui-mobile/                     # React Native 共享 UI 组件
│   └── features/                      # 功能模块
│       ├── dashboard/ ... analytics/
│       └── governance-compliance/     # 内部扩展模块（不注册到公开 route catalog）
├── tests/                             # Vitest 文档/共享层/应用壳测试
└── docs/
    ├── storybook/
    └── adr/
```

## 3.5 包管理与构建配置

### package.json workspaces

```json
{
  "workspaces": [
    "packages/shared/*",
    "packages/ui-core",
    "packages/ui-mobile",
    "packages/features/*",
    "apps/*",
    "tools/*"
  ]
}
```

### 工具链总览

| 工具                     | 用途                                      |
| ------------------------ | ----------------------------------------- |
| npm workspace            | Monorepo 包管理                           |
| Vite 6                   | Web 构建（dev server + production build） |
| Metro                    | React Native 构建                         |
| electron-builder         | Windows 打包（MSIX / EXE）                |
| tauri-cli                | macOS/Linux 打包                          |
| TypeScript 5.8+ (strict) | 类型检查，与后端 tsconfig 对齐            |
| Vitest                   | 单元测试（共享层 + 组件）                 |
| Storybook                | 组件隔离开发与视觉基线                    |
| Playwright / Detox       | 目标态 E2E 工具链（当前仍为 Planned）     |

### 常用命令

| 命令                                 | 说明                  |
| ------------------------------------ | --------------------- |
| `npm install`                        | 安装所有依赖          |
| `npm run typecheck`                  | 全量类型检查          |
| `npm test`                           | 全量 Vitest 测试      |
| `npm run test:e2e`                   | 仓内 smoke E2E 基线   |
| `npm run build`                      | 先 typecheck 再构建 Web |
| `npm run dev:web`                    | 启动 Web 开发服务器   |

## 3.6 包依赖关系图

```text
apps/web ──────────┐
apps/electron-win ─┤
apps/tauri-macos ──┤──→ features/* ──→ ui-core ──→ shared/*
apps/tauri-linux ──┤                       │
apps/mobile ───────┘──→ features/* ──→ ui-mobile ──→ shared/*
                                            │
                                            └──→ shared/*
tools/codegen ──→ (reads backend src/platform/contracts/)
tools/mock-server ──→ shared/types
tools/e2e ──→ (运行时依赖，不构建依赖)
```

## 3.7 共享核心层关键接口

### 3.7.1 PlatformAdapter 接口（L3 定义，L4 实现）

```typescript
interface PlatformAdapter {
  readonly platform: "web" | "windows" | "macos" | "linux" | "android" | "ios";
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readSecureValue(key: string): Promise<string | null>;
  writeSecureValue(key: string, value: string): Promise<void>;
  deleteSecureValue(key: string): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  openDeepLink(url: string): Promise<void>;
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
  vibrate(pattern: readonly number[]): Promise<void>;
  openWindow(path: string): Promise<void>;
  runShell(command: string): Promise<{ code: number; stdout: string; stderr: string }>;
  spawnProcess(
    command: string,
    args: readonly string[],
  ): Promise<{ pid: number; kill(): Promise<void> }>;
  getAnalyticsConsent(): Promise<boolean>;
  setAnalyticsConsent(enabled: boolean): Promise<void>;
  enableScreenSecurity(enabled: boolean): Promise<void>;
}
```

当前仓内同时提供 `createPlatformAdapterCapabilityView(adapter)`，把上述扁平方法投影为 `secureStorage / offlineStore / clipboard / deeplink / lifecycle / haptics / windowing / shell / process / analyticsConsent / screenSecurity` 等嵌套能力视图，便于 UI 层按能力组消费。

**PlatformAdapter 能力状态总览（按当前代码口径）**：

| 能力组           | 方法数 | 状态          | 平台适用                   | 说明                      |
| ---------------- | ------ | ------------- | -------------------------- | ------------------------- |
| `platform`       | 1      | [Implemented] | 全平台                     | 平台 ID 标识              |
| `fetch`          | 1      | [Implemented] | 全平台                     | 网络请求抽象              |
| secureStorage    | 3      | [Implemented] | 全平台                     | `read/write/deleteSecureValue` |
| offlineStore     | 2      | [Implemented] | 全平台                     | `readFile/writeFile`      |
| clipboard        | 1      | [Implemented] | 全平台                     | `copyToClipboard`         |
| deeplink         | 1      | [Implemented] | 全平台                     | `openDeepLink`            |
| lifecycle        | 2      | [Implemented] | 全平台                     | foreground/background 监听 |
| haptics          | 1      | [Implemented] | 全平台                     | `vibrate`，非移动端可 no-op |
| windowing        | 1      | [Implemented] | 桌面端优先                 | `openWindow` smoke baseline |
| shell            | 1      | [Implemented] | 桌面端优先                 | `runShell` smoke baseline |
| process          | 1      | [Implemented] | 全平台                     | `spawnProcess`            |
| analyticsConsent | 2      | [Implemented] | 全平台                     | `get/setAnalyticsConsent` |
| screenSecurity   | 1      | [Implemented] | 桌面端 + 移动端            | `enableScreenSecurity`    |

未纳入当前共享契约的通知、生物识别和文件选择等能力，按平台壳层专用能力管理，不在 `@aa/shared-types` 的统一 `PlatformAdapter` 中定义。

### 3.7.2 WebSocket Manager 接口

```typescript
interface WSManager {
  connect(url: string, token: string): void;
  disconnect(): void;
  subscribe(channel: string, handler: (event: WSEvent) => void): () => void;
  getState(): "connecting" | "connected" | "disconnected" | "reconnecting";
  onStateChange(cb: (state: WSState) => void): () => void;
}
```

### 3.7.3 各平台实现策略

| 能力组          | Web                         | Electron (Win)           | Tauri (Mac/Linux)     | RN (Android)        | RN (iOS)            |
| --------------- | --------------------------- | ------------------------ | --------------------- | ------------------- | ------------------- |
| `fetch`         | `window.fetch`              | `globalThis.fetch` bridge | `globalThis.fetch` bridge | RN `fetch`       | RN `fetch`          |
| secureStorage   | in-memory / cookie seam     | 默认 adapter test double | 默认 adapter test double | 默认 adapter test double | 默认 adapter test double |
| offlineStore    | in-memory file map          | in-memory file map       | in-memory file map    | in-memory file map | in-memory file map |
| clipboard       | browser API seam            | shell bridge seam        | Tauri bridge seam     | RN bridge seam      | RN bridge seam      |
| lifecycle       | foreground/background 事件  | shell 生命周期事件       | shell 生命周期事件    | AppState seam       | AppState seam       |
| deeplink        | router / URL scheme seam    | protocol handler seam    | universal link seam   | app links seam      | universal link seam |
| windowing       | new tab / modal seam        | BrowserWindow seam       | Tauri window seam     | 不适用              | 不适用              |
| shell/process   | no-op / mock                | shell + child process seam | shell + process seam | 不适用              | 不适用              |

### 3.7.4 适配器注入机制

应用启动时，L1 壳层创建平台适配器实例并注入到 L3 共享核心层：

```text
L1 App 启动
  │
  ├─ 创建 PlatformAdapter 实例（平台特定实现）
  │
  ├─ 初始化 L3 共享核心层
  │   ├─ RESTClient(adapter.fetch)
  │   ├─ AuthService(adapter 或 adapter.capabilities.secureStorage)
  │   ├─ SyncEngine(adapter.capabilities.offlineStore, adapter.capabilities.lifecycle)
  │   └─ Platform services(adapter.capabilities.*)
  │
  └─ 渲染 L2 功能模块 UI
```

React 层通过 Context Provider 注入：

```text
<PlatformAdapterProvider adapter={platformAdapter}>
  <AuthProvider>
    <QueryClientProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </QueryClientProvider>
  </AuthProvider>
</PlatformAdapterProvider>
```

---

# Part III — 功能模块

---

# 4. 功能模块蓝图与 UI 契约对齐

> **改进点 A-1、A-4、A-5、D-3**：显式映射 UI 功能模块 → 契约页面 → 后端服务方法；按契约信息架构（§3）组织导航；定义五级下钻组件树。

## 4.1 信息架构与导航映射

按 `ui_console_and_cockpit_contract.md` §3 定义的四组导航，每个前端功能模块显式对应后端数据源：

| 导航组          | 功能模块            | 契约页面                   | 后端数据源                                                    | 状态                     | 平台可用性    |
| --------------- | ------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------ | ------------- |
| Mission Control | `dashboard`         | Dashboard (§4 首页)        | `MissionControlService.getSnapshot()`                         | [Implemented/Internal]   | 全平台        |
| Mission Control | `task-cockpit`      | TaskCockpit (§5.1)         | `MissionControlService.getTaskCockpit()` + task-routes        | [Implemented/Contracted] | 全平台        |
| Mission Control | `workflow-cockpit`  | WorkflowCockpit (§5.2)     | `MissionControlService.getWorkflowCockpit()`                  | [Implemented/Internal]   | Web/桌面      |
| Mission Control | `approval`          | ApprovalCenter (§5.3)      | `MissionControlService.listApprovalQueue()` + approval-routes | [Implemented/Contracted] | 全平台        |
| Mission Control | `stability`         | StabilityPanel (§5.4)      | `MissionControlService.getStabilityPanel()`                   | [Implemented/Internal]   | Web/桌面      |
| Mission Control | `alerts`            | Alerts                     | `OperatorConsoleBackendService.getIncidentTimeline()`         | [Implemented/Internal]   | 全平台        |
| Operations      | `dispatch`          | Dispatch                   | dispatch-routes / dispatch CLI                                | [Implemented/Contracted] | Web/桌面      |
| Operations      | `inspect`           | Inspect                    | `OperatorConsoleBackendService.getSnapshot()` + inspect CLI   | [Implemented/Internal]   | Web/桌面      |
| Operations      | `health`            | Health                     | dashboard-routes health endpoint                              | [Implemented/Contracted] | Web/桌面      |
| Operations      | `incidents`         | Incidents                  | `OperatorConsoleBackendService.getIncidentTimeline()`         | [Implemented/Internal]   | Web/桌面      |
| Governance      | `policy`            | Policy                     | admin-routes policy endpoint                                  | [Implemented/Contracted] | Web/桌面      |
| Governance      | `audit`             | Audit                      | admin-routes audit endpoint                                   | [Implemented/Contracted] | Web/桌面      |
| Governance      | `compliance`        | Compliance                 | [Planned] `/api/v1/compliance`                                | [Planned]                | Web/桌面      |
| Admin           | `takeover`          | AdminTakeoverConsole(§5.5) | `MissionControlService.getAdminTakeoverConsole()`             | [Implemented/Internal]   | Web/桌面      |
| Admin           | `workers`           | Workers                    | `OperatorConsoleBackendService.getWorkerPanel()`              | [Implemented/Internal]   | Web/桌面      |
| Admin           | `queues`            | Queues                     | `OperatorConsoleBackendService` queue API                     | [Implemented/Internal]   | Web/桌面      |
| Extended        | `conversation`      | NL 对话                    | NLEntryService + IntentParser + ConversationHistoryService    | [Implemented/Partial]    | 全平台        |
| Extended        | `workflow-builder`  | —                          | WorkflowBuilderService (interaction/ux/)                      | [Planned]                | Web/桌面      |
| Extended        | `workflow-debugger` | —                          | DebuggerService + inspect CLI                                 | [Planned]                | Web/桌面      |
| Extended        | `agent-manager`     | Agent 监控中心 (§4.2.7)    | `AgentRegistryService` → `/api/v1/agents` [Planned]           | [Planned]                | 全平台        |
| Extended        | `hitl`              | —                          | HITL notification module + approval-routes                    | [Implemented/Partial]    | 全平台        |
| Shared          | `explainability`    | —                          | [Planned] `/api/v1/explanations`                              | [Planned]                | Web/桌面      |
| Shared          | `cost-center`       | —                          | [Planned] `/api/v1/costs`                                     | [Planned]                | Web/桌面      |
| Shared          | `marketplace`       | —                          | [Planned] `/api/v1/marketplace`                               | [Planned]                | Web/桌面/移动 |
| Shared          | `domain-wizard`     | —                          | DomainOnboardingService (interaction/ux/onboarding/)          | [Implemented/Internal]   | Web/桌面      |
| Shared          | `settings`          | 配置管理中心 (§4.2.9)      | admin-routes + user preference API + DomainUIConfig           | [Implemented/Partial]    | 全平台        |
| Shared          | `analytics`         | 数据统计平台 (§4.2.8)      | `GET /api/v1/dashboard/metrics` + MissionControlService       | [Planned]                | 全平台        |

## 4.2 契约核心页面蓝图

### 4.2.1 Dashboard（首页）

> 契约 §4：首页先回答"系统是否健康、当前在做什么、卡在哪里"。

**数据源**：`MissionControlService.getSnapshot()` → `shared_snapshot`（契约 §6.1）

```text
┌─────────────────────────────────────────────────────────────┐
│ System Status Bar                                           │
│ [overall_health] [queue_depth] [active_executions]          │
│ [approval_backlog] [alert_summary]                          │
├─────────────────────────────────────────────────────────────┤
│ Current Focus（第一屏）                                      │
│ ┌─────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Active Tasks    │ │ Active Workflows │ │ Approval Queue│ │
│ │ (card list)     │ │ (card list)      │ │ (card list)   │ │
│ └────────┬────────┘ └────────┬─────────┘ └──────┬────────┘ │
│          │ → TaskCockpit     │ → WfCockpit      │ → Approval│
├─────────────────────────────────────────────────────────────┤
│ Attention Required（第二屏）                                  │
│ ┌─────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Blocked Reasons │ │ Stale/Recovery   │ │ High-Risk     │ │
│ │                 │ │ Summary          │ │ Decisions     │ │
│ └─────────────────┘ └──────────────────┘ └───────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ NL Conversation Dock（常驻底部/侧边，UX-1 对话优先）          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2.2 TaskCockpit（五级下钻）

> 契约 §5.1 + §7：五级下钻（L1-L5）。

**数据源**：`MissionControlService.getTaskCockpit()` + `task-routes`

| 下钻级别 | 展示内容                             | UI 组件                 | 数据端点                          |
| -------- | ------------------------------------ | ----------------------- | --------------------------------- |
| L1       | task list + status                   | `<TaskListView>`        | `GET /api/v1/tasks`               |
| L2       | task details + workflow state        | `<TaskDetailPanel>`     | `GET /api/v1/tasks/{id}`          |
| L3       | step outputs + tool calls            | `<StepOutputViewer>`    | task detail 嵌套数据              |
| L4       | approval / decision / evidence chain | `<EvidenceChainViewer>` | `GET /api/v1/tasks/{id}/evidence` |
| L5       | trace / replay / recovery timeline   | `<TimelineViewer>`      | `GET /api/v1/tasks/{id}/timeline` |

**契约约束落地**：

- `completed` 状态：L2 面板显示 "View Evidence" 按钮，直达 L4
- `blocked` 状态：L2 面板强制显示 `blocked_reason` + `source`，不允许仅显示"等待中"
- `failed` 状态：L2 面板显示 `error_code` + `last_step` + "Recovery History" 入口，直达 L5

**最小字段**（契约 §5.1）：

```typescript
interface TaskCockpitView {
  task_id: string;
  task_status: TaskStatus;
  current_step: string;
  current_execution: string;
  blocked_reason?: string;
  latest_tool_call?: ToolCallSummary;
  latest_decision?: DecisionSummary;
  artifact_refs: ArtifactRef[];
}
```

**最小动作**：打开 inspect · 查看 timeline · 查看 artifacts · 取消任务 · 进入人工接管

### 4.2.3 WorkflowCockpit（五级下钻）

**数据源**：`MissionControlService.getWorkflowCockpit()`

| 下钻级别 | 展示内容                         | UI 组件                                 |
| -------- | -------------------------------- | --------------------------------------- |
| L1       | workflow list + status           | `<WorkflowListView>`                    |
| L2       | workflow details + step DAG      | `<WorkflowDetailPanel>` + `<DAGViewer>` |
| L3       | step outputs + tool calls        | `<StepOutputViewer>`                    |
| L4       | approval nodes + evidence refs   | `<EvidenceChainViewer>`                 |
| L5       | compensation / replay / recovery | `<RecoveryTimeline>`                    |

**最小字段**（契约 §5.2）：

```typescript
interface WorkflowCockpitView {
  workflow_id: string;
  workflow_status: WorkflowStatus;
  steps: WorkflowStep[];
  current_step_index: number;
  dependency_state: DependencyState;
  approval_nodes: ApprovalNode[];
  evidence_refs: EvidenceRef[];
}
```

### 4.2.4 ApprovalCenter

**数据源**：`MissionControlService.listApprovalQueue()` + approval-routes

**最小字段**（契约 §5.3）：

```typescript
interface ApprovalView {
  approval_id: string;
  task_id: string;
  risk_level: "low" | "medium" | "high" | "critical";
  reason_summary: string;
  options: ApprovalOption[];
  recommended_option?: string;
  deadline?: string;
  policy_source: string;
}
```

**最小动作**：approve · reject · request_more_context · open_explanation

**UI 约束**：

- 高风险审批（risk_level = "high" | "critical"）必须展示风险等级、策略来源、审批链和接管入口（契约 §2.4）
- 移动端支持推送通知 + 快捷操作（approve/reject 不进入 App）

### 4.2.5 StabilityPanel

**数据源**：`MissionControlService.getStabilityPanel()`

**最小字段**（契约 §5.4）：

```typescript
interface StabilityPanelView {
  active_tasks: number;
  queued_tasks: number;
  stale_executions: number;
  recovered_executions: number;
  failed_recoveries: number;
  approval_backlog: number;
  event_backlog: number;
  worker_health: WorkerHealthSummary;
}
```

**最小动作**：drill into stuck task · inspect backlog · open recovery evidence · trigger incident workflow

### 4.2.6 AdminTakeoverConsole

**数据源**：`MissionControlService.getAdminTakeoverConsole()`

**最小字段**（契约 §5.5）：

```typescript
interface AdminTakeoverView {
  task_scope: TaskScope;
  tenant_workspace_scope: TenantScope;
  execution_owner: string;
  lease_worker_state: LeaseWorkerState;
  recent_events: RecentEvent[];
  current_model_prompt_policy_version: VersionInfo;
  current_capability_entitlement_limit: EntitlementInfo;
}
```

**最小动作**：retry_step · skip_step · override_step_output · switch_worker · manual_cancel · mark_unrecoverable

### 4.2.7 Agent 实时监控中心 _(v3.0 新增)_

> 实时监控所有 Agent 的健康状态、心跳、能力、负载，并提供管理操作。

**数据源**：`AgentRegistryService` (authoritative) → `GET /api/v1/agents` [Planned Layer C] + `agent.health_changed` WS 事件

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Agent 监控中心                                              [⟳ 10s] │
├──────────┬───────────────────────────────────────────────────────────┤
│ 筛选栏   │ [域▼] [状态▼] [健康▼] [能力▼] [搜索...]                 │
├──────────┴───────────────────────────────────────────────────────────┤
│ 概览卡片                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ 总数 47  │ │🟢正常 38 │ │🟡降级 5  │ │🔴离线 3  │ │⚪未注册 1│  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ Agent 列表（实时更新）                                               │
│ ┌─────┬────────┬──────┬────────┬─────────┬──────────┬────────────┐ │
│ │ 名称│ 域     │ 状态 │ 健康度 │ 心跳    │ 版本     │ 操作       │ │
│ ├─────┼────────┼──────┼────────┼─────────┼──────────┼────────────┤ │
│ │ ... │ ...    │ 🟢   │ 98%    │ 3s ago  │ v1.2.0   │ [详情][重启]│ │
│ └─────┴────────┴──────┴────────┴─────────┴──────────┴────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ Agent 详情面板（右侧抽屉 / 点击展开）                                │
│ ┌─────────────────────────────────────┐                             │
│ │ [基本信息] [能力列表] [心跳历史]    │                             │
│ │ [负载曲线] [最近任务] [错误日志]    │                             │
│ │                                     │                             │
│ │ 心跳时间线 ────────●────●────●──── │                             │
│ │ 负载折线图 ──╱╲──╱╲──╱╲────────── │                             │
│ │                                     │                             │
│ │ [重启] [注销] [更新配置] [查看日志] │                             │
│ └─────────────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

**最小字段**：

```typescript
interface AgentMonitorView {
  agent_id: string;
  name: string;
  domain_id: string;
  status: "active" | "degraded" | "offline" | "unregistered";
  health_score: number;
  version: string;
  capabilities: string[];
  last_heartbeat: string;
  uptime_seconds: number;
  current_load: { active_tasks: number; queue_depth: number };
  recent_errors: AgentError[];
  heartbeat_history: HeartbeatPoint[];
  load_history: LoadPoint[];
}
```

**最小动作**：list · filter · get(id) · restart · deregister · update_config · view_logs · export_report

**实时策略**：

| 数据项     | 刷新方式                                     | 策略                                     |
| ---------- | -------------------------------------------- | ---------------------------------------- |
| Agent 列表 | WS `agent.health_changed` + polling fallback | WS 优先，10s polling 兜底；staleTime: 5s |
| 概览卡片   | 从列表数据聚合                               | 客户端聚合，无额外请求                   |
| 心跳历史   | `GET /api/v1/agents/{id}/heartbeats`         | 进入详情时加载，60s staleTime            |
| 负载曲线   | `GET /api/v1/agents/{id}/metrics`            | 进入详情时加载，30s staleTime + WS delta |
| Agent 详情 | `GET /api/v1/agents/{id}`                    | 5s staleTime，WS 触发 invalidate         |

**移动端适配**：列表视图简化为卡片流（名称 + 状态 + 健康度 + 心跳），详情面板全屏展开，隐藏重启/注销等危险操作（需进入 Web/桌面端操作）。

**错误处理与离线降级**：

| 场景                  | 行为                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| WS 断开               | 自动降级为 10s polling；顶部黄色 Banner "实时连接已断开，数据可能延迟"；WS 恢复后自动切回     |
| API 请求失败（≤3 次） | 自动重试（指数退避 1s/2s/4s）；重试期间 skeleton 保持，不闪烁                                 |
| API 请求失败（>3 次） | 显示内联错误卡片（含"重试"按钮）；已缓存数据继续展示并标注"数据截至 {timestamp}"              |
| 离线模式              | 展示最后一次缓存的 Agent 列表（只读）；禁用 restart/deregister 等写操作按钮，tooltip 提示离线 |
| Agent 详情 404        | 显示 "Agent 已注销或不可达" 空状态；提供"返回列表"链接                                        |

### 4.2.8 数据统计与分析平台 _(v3.0 新增)_

> 多层级运营指标看板，覆盖任务、Agent、Workflow、成本、SLO 等全维度统计。

**数据源**：`GET /api/v1/dashboard/metrics` [Planned Layer C] + `MissionControlService.getSnapshot()` + `CostTrackingService` + `dashboard.metric_updated` WS 事件

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 数据统计与分析          [时间范围▼] [域▼] [导出▼]          [⟳ Auto] │
├──────────────────────────────────────────────────────────────────────┤
│ KPI 概览（角色自适应）                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │任务总量  │ │成功率    │ │平均耗时  │ │活跃Agent │ │SLO达标率 │  │
│ │ 1,247    │ │ 94.2%    │ │ 3m 24s   │ │ 38/47    │ │ 99.1%    │  │
│ │ ↑12%     │ │ ↑2.1%    │ │ ↓15%     │ │ —        │ │ ↑0.3%    │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ 任务趋势折线图             │ │ 状态分布饼图               │      │
│ │ (ECharts Line)             │ │ (ECharts Pie)              │      │
│ │ 维度: 成功/失败/取消       │ │ 维度: running/blocked/done │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Agent 利用率热力图          │ │ 成本趋势+预算水位         │      │
│ │ (ECharts Heatmap)          │ │ (ECharts Line+Area)        │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Top 10 失败原因 (Bar)      │ │ Workflow 执行耗时 (Box)    │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
├──────────────────────────────────────────────────────────────────────┤
│ 明细表格（可下钻）                                                   │
│ [任务明细] [Agent明细] [Workflow明细] [审批明细] [成本明细]           │
└──────────────────────────────────────────────────────────────────────┘
```

**指标体系（按角色层级）**：

| 指标分类 | L1 操作者                 | L2 域管理                        | L3 SRE                                | L4 舰队管理                    |
| -------- | ------------------------- | -------------------------------- | ------------------------------------- | ------------------------------ |
| 任务     | 我的任务数/成功率         | 域任务吞吐量/平均耗时/失败 Top 5 | 全平台任务趋势/积压队列深度           | 跨区域任务分布/延迟对比        |
| Agent    | 我常用 Agent 健康         | 域 Agent 利用率/健康分布         | 全平台 Agent 负载热力图/心跳异常率    | 舰队 Agent 容量规划/利用率趋势 |
| Workflow | —                         | 域 Workflow 执行耗时/成功率      | Workflow 步骤瓶颈分析/重试率          | 跨域 Workflow 对比             |
| 审批     | 我的待审批数/平均响应时间 | 域审批积压/超时率                | 全平台审批 SLA                        | 审批链路效率对比               |
| 成本     | 我的任务成本              | 域成本/预算使用率/模型成本分布   | 全平台成本趋势/预算预警               | 舰队成本对比/容量-成本效率     |
| SLO      | —                         | 域 SLO 达标率                    | 全平台 SLO 仪表盘/错误预算燃尽        | 跨区域 SLO 对比                |
| 系统健康 | —                         | —                                | 五平面健康/P99 延迟/错误率/资源利用率 | 跨区域健康对比/容量预测        |

**最小字段**：

```typescript
interface DashboardMetricsDTO {
  time_range: { start: string; end: string };
  scope: { domain_id?: string; tenant_id?: string; region?: string };
  kpis: {
    total_tasks: number;
    success_rate: number;
    avg_duration_ms: number;
    active_agents: number;
    total_agents: number;
    slo_compliance: number;
    total_cost: number;
    budget_utilization: number;
  };
  task_trend: TimeSeriesPoint[];
  status_distribution: { status: string; count: number }[];
  agent_utilization: {
    agent_id: string;
    utilization: number;
    health: number;
  }[];
  cost_trend: TimeSeriesPoint[];
  top_failures: { reason: string; count: number }[];
  workflow_durations: {
    workflow_id: string;
    p50: number;
    p95: number;
    p99: number;
  }[];
}

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}
```

**图表组件映射**：

| 指标          | 图表类型      | ECharts 组件 | 刷新策略                          |
| ------------- | ------------- | ------------ | --------------------------------- |
| 任务趋势      | 折线图        | LineChart    | 1min polling + WS delta           |
| 状态分布      | 饼图/环形图   | PieChart     | 30s staleTime                     |
| Agent 利用率  | 热力图        | Heatmap      | 30s polling                       |
| 成本趋势      | 面积图+折线图 | LineChart    | 5min staleTime                    |
| Top 失败原因  | 水平柱状图    | BarChart     | 1min staleTime                    |
| Workflow 耗时 | 箱线图        | BoxPlot      | 5min staleTime                    |
| SLO 达标率    | 仪表盘        | Gauge        | 1min polling                      |
| 系统健康      | 多轴折线      | LineChart    | 10s polling (SRE) / 1min (others) |

**移动端适配**：KPI 卡片横向滚动，图表单列堆叠，支持下拉刷新。明细表格改为卡片列表，下钻通过全屏弹层实现。

**错误处理与离线降级**：

| 场景                  | 行为                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| metrics API 超时/失败 | KPI 卡片显示 "--" 占位 + "加载失败" 标注；已缓存数据展示并标注时间戳                                |
| 单图表加载失败        | 该图表区域显示内联错误 + "重试"按钮；其他图表不受影响（独立 QueryKey）                              |
| ECharts 渲染异常      | catch 渲染错误，fallback 为数据表格视图；上报 Sentry 错误                                           |
| WS 事件丢失           | 依赖 polling 兜底；polling 与 WS 数据不一致时以 polling 为准（WS 仅做增量提示）                     |
| 离线模式              | 展示最后一次缓存的图表快照（静态图片/SVG 导出）；隐藏时间范围选择器；顶部提示"离线模式，数据已冻结" |
| 导出失败              | Toast 提示失败原因 + 重试按钮；大数据量导出改为后端异步生成 + 下载链接推送                          |

### 4.2.9 配置管理中心 _(v3.0 新增)_

> 统一管理平台权限、功能开关、模型配置、域设置、租户管理等全局配置。

**数据源**：`admin-routes` + `user preference API` + `DomainUIConfig` (§6.1.2) + 后端 admin/config 端点

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 配置管理中心                                                         │
├──────────┬───────────────────────────────────────────────────────────┤
│          │                                                           │
│ 侧边导航 │  内容区                                                   │
│          │                                                           │
│ ┌──────┐ │  ┌─────────────────────────────────────────────────────┐ │
│ │👤用户│ │  │ [当前: 权限管理]                                    │ │
│ │ 偏好 │ │  │                                                     │ │
│ ├──────┤ │  │ ┌─────────────────────────────────────────────────┐ │ │
│ │🔑权限│ │  │ │ 角色列表                                        │ │ │
│ │ 管理 │ │  │ │ ┌──────┬────────┬──────────┬────────┬────────┐ │ │ │
│ ├──────┤ │  │ │ │角色  │ 权限数 │ 用户数   │ 范围   │ 操作   │ │ │ │
│ │🎛功能│ │  │ │ ├──────┼────────┼──────────┼────────┼────────┤ │ │ │
│ │ 开关 │ │  │ │ │L1    │ 12     │ 150      │ 个人   │ [编辑] │ │ │ │
│ ├──────┤ │  │ │ │L2    │ 28     │ 25       │ 域     │ [编辑] │ │ │ │
│ │🤖模型│ │  │ │ │L3    │ 45     │ 8        │ 平台   │ [编辑] │ │ │ │
│ │ 配置 │ │  │ │ │L4    │ 52     │ 3        │ 全局   │ [编辑] │ │ │ │
│ ├──────┤ │  │ │ └──────┴────────┴──────────┴────────┴────────┘ │ │ │
│ │🏢域  │ │  │ │                                                 │ │ │
│ │ 设置 │ │  │ │ 权限详情（展开角色后）                           │ │ │
│ ├──────┤ │  │ │ ┌───────────┬──────┬──────┬──────┬──────────┐  │ │ │
│ │🏠租户│ │  │ │ │ 功能页面  │ 查看 │ 编辑 │ 删除 │ 管理     │  │ │ │
│ │ 管理 │ │  │ │ ├───────────┼──────┼──────┼──────┼──────────┤  │ │ │
│ ├──────┤ │  │ │ │ Dashboard │ ✅   │ —    │ —    │ —        │  │ │ │
│ │🔗Web │ │  │ │ │ Tasks     │ ✅   │ ✅   │ ❌   │ ❌       │  │ │ │
│ │ hook │ │  │ │ │ Agents    │ ✅   │ ✅   │ ✅   │ ✅       │  │ │ │
│ ├──────┤ │  │ │ └───────────┴──────┴──────┴──────┴──────────┘  │ │ │
│ │📋审计│ │  │ └─────────────────────────────────────────────────┘ │ │
│ │ 日志 │ │  └─────────────────────────────────────────────────────┘ │
│ └──────┘ │                                                           │
├──────────┴───────────────────────────────────────────────────────────┤
│ 变更审计栏: "最近更改: L2 权限更新 by admin@co — 2h ago" [查看全部] │
└──────────────────────────────────────────────────────────────────────┘
```

**子页面规格**：

| 子页面       | 路由                           | 权限          | 功能说明                                                                                          |
| ------------ | ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------- |
| 用户偏好     | `/shared/settings/preferences` | authenticated | 语言/时区/主题(亮/暗/跟随系统)/通知偏好/默认看板布局                                              |
| 权限管理     | `/shared/settings/permissions` | org_admin+    | RBAC 角色 CRUD/角色-权限矩阵编辑/用户-角色分配/权限继承可视化                                     |
| 功能开关     | `/admin/feature-flags`         | platform_sre  | 功能开关列表/开关状态切换/灰度百分比/目标域-租户-用户/变更历史                                    |
| 模型配置     | `/shared/settings/models`      | domain_admin+ | LLM 模型列表/模型-域绑定/Prompt Policy 版本管理/Token 预算/Fallback 链配置                        |
| 域设置       | `/shared/settings/domains/:id` | domain_admin+ | 域基本信息/DomainUIConfig 编辑(featureVisibility/actionPolicy/glossary)/Agent 绑定/SLO 目标       |
| 租户管理     | `/shared/settings/tenants`     | org_admin+    | 租户列表/租户 CRUD/租户-域映射/租户级配额/SSO 配置                                                |
| Webhook 管理 | `/shared/settings/webhooks`    | domain_admin+ | Webhook 端点 CRUD/事件订阅选择/投递历史/重试配置/Secret 管理                                      |
| 组织架构     | `/shared/settings/org`         | org_admin+    | 组织树可视化/部门-域映射/SSO/SCIM 同步配置/角色继承规则                                           |
| 审计日志     | `/governance/audit`            | domain_admin+ | 操作日志搜索/筛选(时间/用户/操作类型)/导出/合规标记（链接至 Governance → Audit 模块，非独立页面） |

**最小字段**：

```typescript
interface SettingsOverview {
  user_preferences: UserPreferences;
  roles: RoleSummary[];
  feature_flags: FeatureFlagSummary[];
  model_configs: ModelConfigSummary[];
  domains: DomainSummary[];
  tenants: TenantSummary[];
  webhooks: WebhookSummary[];
  recent_changes: AuditEntry[];
}

interface UserPreferences {
  locale: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  notification_channels: ("push" | "email" | "in_app")[];
  default_dashboard_layout: string;
}

interface ModelConfig {
  model_id: string;
  provider: string;
  model_name: string;
  domain_bindings: string[];
  prompt_policy_version: string;
  token_budget: { daily: number; monthly: number };
  fallback_chain: string[];
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

interface FeatureFlag {
  flag_id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  target_domains: string[];
  target_tenants: string[];
  target_users: string[];
  created_by: string;
  updated_at: string;
}

interface TenantConfig {
  tenant_id: string;
  name: string;
  domain_mappings: string[];
  quota: { max_agents: number; max_tasks_per_day: number; storage_gb: number };
  sso_provider?: string;
  status: "active" | "suspended" | "pending";
}
```

**最小动作**：

| 子页面   | 动作                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| 用户偏好 | get_preferences · update_preferences                                                                |
| 权限管理 | list_roles · get_role · create_role · update_role · delete_role · assign_user                       |
| 功能开关 | list_flags · get_flag · create_flag · toggle_flag · update_rollout                                  |
| 模型配置 | list_models · get_model · bind_domain · update_policy · set_budget · set_fallback                   |
| 域设置   | get_domain · update_domain · update_ui_config · bind_agents · set_slo                               |
| 租户管理 | list_tenants · create_tenant · update_tenant · suspend_tenant · map_domain                          |
| Webhook  | list_webhooks · create_webhook · update_webhook · delete_webhook · test_webhook · view_delivery_log |

**移动端适配**：侧边导航改为底部 Tab 或汉堡菜单。权限矩阵表格改为卡片 + 展开模式。模型配置和租户管理仅支持只读查看，编辑需进入 Web/桌面端。

**错误处理与离线降级**：

| 场景                      | 行为                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| 配置保存失败              | 保留表单状态不清空；显示内联错误 + 重试按钮；超过 3 次失败后提示"请联系管理员"                     |
| 配置保存冲突（409）       | 显示 diff 对比弹窗（当前值 vs 服务端最新值），用户选择覆盖或合并                                   |
| 权限不足（403）           | 字段/按钮灰化 + tooltip "需要 {required_role} 权限"；不显示无权限的子页面导航项                    |
| 功能开关 toggle 失败      | 自动回滚 toggle 状态（乐观更新回退）；Toast 提示具体错误                                           |
| 离线模式                  | 所有配置页面只读；编辑按钮禁用 + tooltip "离线不可编辑"；缓存最后一次配置快照供查看                |
| Webhook test_webhook 超时 | 30s 超时后显示"测试超时，请检查目标端点可达性"；展示上次成功的 delivery log 供参考                 |
| Monaco 编辑器加载失败     | fallback 为 `<textarea>` + JSON 语法高亮（轻量方案）；提示"高级编辑器加载失败，已切换到基础编辑器" |

### 4.2.10 已实现模块摘要 _(v3.0 新增)_

以下 9 个模块已在 §4.1 中列出且后端数据源已实现，但尚未达到核心页面蓝图（§4.2.1-4.2.9）的规格深度。本节提供最小规格摘要，供前端快速对接。

| 模块       | 数据源                                                | 最小 DTO / 关键字段                                                        | 主要动作                                      | API Layer |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| Dispatch   | dispatch-routes / dispatch CLI                        | `{ execution_id, worker_id, dispatch_status, created_at, retries }`        | list · dispatch · cancel · retry              | Layer C   |
| Inspect    | `OperatorConsoleBackendService.getSnapshot()`         | `{ snapshot_id, plane, status, metrics{}, timestamp }`                     | get_snapshot · refresh · export               | Layer A→C |
| Health     | dashboard-routes health endpoint                      | `{ overall_status, planes[]{name, status, latency}, uptime }`              | get_health · drill_plane                      | Layer C   |
| Incidents  | `OperatorConsoleBackendService.getIncidentTimeline()` | `{ incident_id, severity, source, message, created_at, resolved_at? }`     | list · acknowledge · resolve · escalate       | Layer A→C |
| Policy     | admin-routes policy endpoint                          | `{ policy_id, type, rules[], enabled, version, updated_by }`               | list · get · update · toggle                  | Layer C   |
| Audit      | admin-routes audit endpoint                           | `{ audit_id, user_id, action, resource, timestamp, details }`              | search · filter · export · mark_compliance    | Layer C   |
| Compliance | [Planned] `/api/v1/compliance`                        | `{ compliance_id, standard, checks[], status, last_audit, score }`         | list · run_check · export_report              | Layer C   |
| Workers    | `OperatorConsoleBackendService.getWorkerPanel()`      | `{ worker_id, status, current_execution, heartbeat, load, region }`        | list · drain · restart · view_logs            | Layer A→C |
| Queues     | `OperatorConsoleBackendService` queue API             | `{ queue_name, depth, processing, dead_letter_count, oldest_message_age }` | list · purge_dlq · retry_dlq · pause · resume | Layer A→C |

## 4.3 页面数据 truth source 分层（契约 §6 落地）

> **改进点**：将契约 §6 的三层数据源映射到前端 TanStack Query 策略。

| 数据层            | 适用页面                                                            | 前端策略                                    | 刷新模式                                        |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| `shared_snapshot` | System Status Bar · Dashboard 首页 · Stability 头部                 | 单一 `useSnapshot()` query，全局共享        | WebSocket push + 30s 轮询 fallback              |
| `shared_query`    | Dashboard · Stability · ApprovalCenter · Admin 概览                 | 共享 query key，跨页面自动去重              | WebSocket invalidation + stale-while-revalidate |
| `page_local_api`  | Task inspect · Workflow inspect · Approval inspect · Worker details | 页面级 query，进入页面时 fetch，离开时可 GC | 手动 refetch + WebSocket push                   |

## 4.4 路由架构

### 4.4.1 Web/桌面端路由表

基于 React Router v7，支持 lazy loading：

| 路由                                       | 页面                                  | 权限要求        | Code Split |
| ------------------------------------------ | ------------------------------------- | --------------- | ---------- |
| `/`                                        | Dashboard (redirect)                  | authenticated   | 否（入口） |
| `/mission-control/dashboard`               | Dashboard                             | authenticated   | 是         |
| `/mission-control/tasks`                   | TaskCockpit L1                        | authenticated   | 是         |
| `/mission-control/tasks/:id`               | TaskCockpit L2                        | authenticated   | 是         |
| `/mission-control/tasks/:id/steps/:stepId` | TaskCockpit L3                        | authenticated   | 是         |
| `/mission-control/tasks/:id/evidence`      | TaskCockpit L4                        | authenticated   | 是         |
| `/mission-control/tasks/:id/timeline`      | TaskCockpit L5                        | authenticated   | 是         |
| `/mission-control/workflows`               | WorkflowCockpit L1                    | pack_developer+ | 是         |
| `/mission-control/workflows/:id`           | WorkflowCockpit L2                    | pack_developer+ | 是         |
| `/mission-control/approvals`               | ApprovalCenter                        | authenticated   | 是         |
| `/mission-control/approvals/:id`           | Approval Detail                       | authenticated   | 是         |
| `/mission-control/stability`               | StabilityPanel                        | platform_sre    | 是         |
| `/mission-control/alerts`                  | Alerts                                | authenticated   | 是         |
| `/operations/dispatch`                     | Dispatch                              | platform_sre    | 是         |
| `/operations/inspect`                      | Inspect                               | platform_sre    | 是         |
| `/operations/health`                       | Health                                | platform_sre    | 是         |
| `/operations/incidents`                    | Incidents                             | platform_sre    | 是         |
| `/governance/policy`                       | Policy                                | domain_admin+   | 是         |
| `/governance/audit`                        | Audit                                 | domain_admin+   | 是         |
| `/governance/compliance`                   | Compliance                            | domain_admin+   | 是         |
| `/admin/takeover`                          | AdminTakeoverConsole                  | platform_sre    | 是         |
| `/admin/workers`                           | Worker Panel                          | platform_sre    | 是         |
| `/admin/queues`                            | Queue Panel                           | platform_sre    | 是         |
| `/admin/feature-flags`                     | Feature Flags (配置管理子页面 §4.2.9) | platform_sre    | 是         |
| `/extended/conversation`                   | NL Conversation                       | authenticated   | 是         |
| `/extended/workflow-builder`               | Workflow Builder                      | pack_developer+ | 是         |
| `/extended/workflow-builder/:id`           | 编辑 Workflow                         | pack_developer+ | 是         |
| `/extended/debugger/:id`                   | Workflow Debugger                     | pack_developer+ | 是         |
| `/extended/agents`                         | Agent 监控中心                        | domain_admin+   | 是         |
| `/extended/agents/:id`                     | Agent 详情                            | domain_admin+   | 是         |
| `/extended/hitl/:runId`                    | HITL Interface                        | authenticated   | 是         |
| `/shared/explainability/:taskId`           | Explainability Viewer                 | authenticated   | 是         |
| `/shared/costs`                            | Cost Center                           | domain_admin+   | 是         |
| `/shared/marketplace`                      | Marketplace                           | authenticated   | 是         |
| `/shared/marketplace/:id`                  | Marketplace Detail                    | authenticated   | 是         |
| `/shared/domain-wizard`                    | Domain Wizard                         | domain_admin+   | 是         |
| `/shared/analytics`                        | 数据统计平台                          | authenticated   | 是         |
| `/shared/settings`                         | 配置管理中心                          | authenticated   | 是         |
| `/shared/settings/preferences`             | 用户偏好                              | authenticated   | 是         |
| `/shared/settings/permissions`             | 权限管理                              | org_admin+      | 是         |
| `/shared/settings/models`                  | 模型配置                              | domain_admin+   | 是         |
| `/shared/settings/domains/:id`             | 域设置                                | domain_admin+   | 是         |
| `/shared/settings/tenants`                 | 租户管理                              | org_admin+      | 是         |
| `/shared/settings/webhooks`                | Webhook 管理                          | domain_admin+   | 是         |
| `/shared/settings/org`                     | 组织架构                              | org_admin+      | 是         |
| `/login`                                   | 登录页                                | public          | 否（入口） |
| `/login/callback`                          | SSO 回调                              | public          | 否         |

### 4.4.2 移动端导航结构

基于 React Navigation v7：

```text
AuthStack（未登录）
  ├── LoginScreen
  └── SSOCallbackScreen

MainTabs（已登录）
  ├── HomeTab (Stack)
  │   ├── DashboardScreen (L1)
  │   └── NLConversationScreen
  │
  ├── TasksTab (Stack)
  │   ├── TaskListScreen
  │   ├── TaskDetailScreen → Steps → Evidence → Timeline
  │   └── ExplainabilityScreen
  │
  ├── ApprovalsTab (Stack)
  │   ├── ApprovalListScreen
  │   └── ApprovalDetailScreen
  │
  ├── MarketplaceTab (Stack)
  │   ├── MarketplaceListScreen
  │   └── MarketplaceDetailScreen
  │
  └── MoreTab (Stack)
      ├── AnalyticsScreen (L1 个人维度)
      ├── AgentListScreen
      ├── CostCenterScreen
      ├── SettingsScreen
      └── HITLScreen
```

**导航特性**：

| 特性       | 实现方式                                   |
| ---------- | ------------------------------------------ |
| 底部标签   | 5 个主标签（首页/任务/审批/市场/更多）     |
| Badge 计数 | 审批标签显示待处理数（WebSocket 实时推送） |
| 深度链接   | `aa://tasks/123` → 跳转到任务详情          |
| 手势导航   | iOS 边缘返回；Android Back 键              |
| 状态保持   | 切换标签时保留列表滚动位置和筛选条件       |

### 4.4.3 权限路由守卫链

```text
路由守卫链：
  1. AuthGuard       → 检查是否已登录（否则跳转 /login）
  2. TenantGuard     → 检查 tenant 是否有效
  3. PermissionGuard → 检查角色/权限是否满足路由要求
  4. FeatureGuard    → 检查功能开关是否启用
  5. ModeGuard       → 企业模式/单人模式功能可见性
```

## 4.5 页面级权限矩阵

### 4.5.1 页面可见性矩阵

| 页面/模块             | 独立运营者(L1) | 业务线负责人(L1) | 域管理员(L2)   | Pack 开发者(L2/L3) | 平台 SRE(L3/L4)  |
| --------------------- | -------------- | ---------------- | -------------- | ------------------ | ---------------- |
| Dashboard             | ✅ 自有域      | ✅ 业务线域      | ✅ 管辖域      | ✅ 开发域          | ✅ 全局          |
| TaskCockpit           | ✅ 自有任务    | ✅ 业务线任务    | ✅ 域内任务    | ✅ 开发相关任务    | ✅ 全部任务      |
| WorkflowCockpit       | ❌             | ✅ 只读          | ✅             | ✅                 | ✅               |
| ApprovalCenter        | ✅ 自有审批    | ✅ 业务线审批    | ✅ 域内审批    | ❌                 | ✅ 全部审批      |
| StabilityPanel        | ❌             | ❌               | ⚠️ 域健康      | ❌                 | ✅               |
| AdminTakeoverConsole  | ❌             | ❌               | ❌             | ❌                 | ✅               |
| NL Conversation       | ✅             | ✅               | ✅             | ✅                 | ✅               |
| WorkflowBuilder       | ❌             | ❌               | ❌             | ✅                 | ✅               |
| WorkflowDebugger      | ❌             | ❌               | ❌             | ✅                 | ✅               |
| AgentManager          | ❌             | ❌               | ✅             | ✅                 | ✅               |
| Marketplace           | ✅ 浏览        | ✅ 浏览          | ✅ 安装        | ✅ 发布+安装       | ✅ 全部          |
| CostCenter            | ✅ 自有域      | ✅ 业务线        | ✅ 域级        | ❌                 | ✅ 全局          |
| DomainWizard          | ❌             | ❌               | ✅             | ❌                 | ✅               |
| Settings              | ✅ 个人        | ✅ 个人          | ✅ 域+个人     | ✅ 个人            | ✅ 全局+个人     |
| AgentMonitor (§4.2.7) | ❌             | ❌               | ✅ 域 Agent    | ✅ 开发 Agent      | ✅ 全局          |
| Analytics (§4.2.8)    | ✅ 个人维度    | ✅ 业务线维度    | ✅ 域维度      | ✅ 开发维度        | ✅ 全平台+跨区域 |
| ConfigCenter (§4.2.9) | ✅ 偏好only    | ✅ 偏好only      | ✅ 域设置+模型 | ❌                 | ✅ 全部          |

### 4.5.2 关键动作权限矩阵

| 动作                     | 独立运营者(L1) | 业务线负责人(L1) | 域管理员(L2) | Pack 开发者(L2/L3) | 平台 SRE(L3/L4) | 二次确认  |
| ------------------------ | -------------- | ---------------- | ------------ | ------------------ | --------------- | --------- |
| 创建任务                 | ✅             | ✅               | ✅           | ✅                 | ✅              | ❌        |
| 取消任务                 | ✅ 自有        | ✅ 业务线        | ✅ 域内      | ❌                 | ✅ 任意         | ✅        |
| 审批 approve/reject      | ✅ 被分配      | ✅ 业务线        | ✅ 域内      | ❌                 | ✅ 任意         | ✅        |
| Admin Takeover           | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅✅ 双人 |
| Panic 紧急制动           | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅✅ 双人 |
| 发布 Pack 到 Marketplace | ❌             | ❌               | ❌           | ✅                 | ✅              | ✅ 审批流 |
| 安装 Marketplace Pack    | ❌             | ❌               | ✅           | ✅ 开发环境        | ✅              | ✅        |
| 修改域配置               | ❌             | ❌               | ✅           | ❌                 | ✅              | ✅        |
| Worker 管理              | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅        |
| 查看 Explainability      | ✅ 自有任务    | ✅ 业务线        | ✅ 域内      | ✅                 | ✅              | ❌        |

### 4.5.3 下钻级别权限

| 下钻级别 | 内容                        | 独立运营者 | 业务线负责人 | 域管理员 | Pack 开发者 | 平台 SRE |
| -------- | --------------------------- | ---------- | ------------ | -------- | ----------- | -------- |
| L1       | 概览/摘要                   | ✅         | ✅           | ✅       | ✅          | ✅       |
| L2       | 详情/步骤列表               | ✅         | ✅           | ✅       | ✅          | ✅       |
| L3       | 执行日志/Evidence           | ❌         | ⚠️ 脱敏      | ✅       | ✅          | ✅       |
| L4       | 原始 JSON/调试信息          | ❌         | ❌           | ⚠️ 只读  | ✅          | ✅       |
| L5       | 内部状态/Reliability Fabric | ❌         | ❌           | ❌       | ❌          | ✅       |

**实现方式**：

- 前端在路由守卫中检查 `auth-store.permissions` 数组
- 页面级隐藏：不满足权限的导航项不渲染（非 disabled）
- 动作级控制：通过 `usePermission(action, resource)` hook 返回 `{ allowed, reason }`
- 下钻级别：组件接收 `maxDrillDepth` prop，由 `usePermission` 计算当前用户可达的最大级别

### 4.5.4 字段级可见性与脱敏矩阵 _(v2.3 新增)_

页面/动作/下钻级别权限之外，平台 UI 还需要第四层控制——**字段级可见性与脱敏**。以下矩阵定义各角色在不同数据字段上的可见性和脱敏规则。

#### FieldVisibilityPolicy

| 字段类别                         | 独立运营者(L1) | 业务线负责人(L1) | 域管理员(L2) | Pack 开发者(L2/L3) | 平台 SRE(L3/L4) |
| -------------------------------- | -------------- | ---------------- | ------------ | ------------------ | --------------- |
| 任务标题/摘要                    | ✅ 明文        | ✅ 明文          | ✅ 明文      | ✅ 明文            | ✅ 明文         |
| 任务参数/输入 JSON               | ⚠️ 摘要        | ⚠️ 摘要          | ✅ 明文      | ✅ 明文            | ✅ 明文         |
| Tool Call payload（参数+返回值） | ❌ 隐藏        | ⚠️ 脱敏          | ✅ 明文      | ✅ 明文            | ✅ 明文         |
| Prompt / Policy 版本号           | ❌ 隐藏        | ❌ 隐藏          | ⚠️ 仅版本号  | ✅ 明文            | ✅ 明文         |
| Prompt 原文 / Policy 原文        | ❌ 隐藏        | ❌ 隐藏          | ❌ 隐藏      | ✅ 明文            | ✅ 明文         |
| Evidence 原始 JSON               | ❌ 隐藏        | ⚠️ 摘要          | ⚠️ 脱敏      | ✅ 明文            | ✅ 明文         |
| Assignee / Owner 姓名            | ✅ 明文        | ✅ 明文          | ✅ 明文      | ⚠️ 仅 ID           | ✅ 明文         |
| Tenant / Workspace ID            | ⚠️ 仅当前租户  | ⚠️ 仅当前租户    | ⚠️ 仅管辖域  | ⚠️ 仅开发域        | ✅ 全部         |
| Worker 节点 IP / 主机名          | ❌ 隐藏        | ❌ 隐藏          | ❌ 隐藏      | ❌ 隐藏            | ✅ 明文         |
| Error stacktrace                 | ❌ 隐藏        | ❌ 隐藏          | ⚠️ 首行      | ✅ 明文            | ✅ 明文         |
| Cost 金额明细                    | ✅ 自有域      | ✅ 业务线        | ✅ 域级      | ❌ 隐藏            | ✅ 全局         |
| Model / LLM provider 标识        | ❌ 隐藏        | ❌ 隐藏          | ⚠️ 仅模型名  | ✅ 明文            | ✅ 明文         |

**图例**：✅ 明文 = 原值展示；⚠️ 脱敏/摘要 = 部分隐藏或仅展示摘要；❌ 隐藏 = 不渲染该字段。

#### RedactionRule 类型定义

```typescript
type RedactionLevel = "visible" | "summary" | "redacted" | "hidden";

interface RedactionRule {
  fieldPattern: string;
  roleLevel: RoleLevel;
  redactionLevel: RedactionLevel;
  summaryTemplate?: string;
  redactionMask?: string;
}

interface FieldVisibilityPolicy {
  rules: RedactionRule[];
  defaultLevel: RedactionLevel;
  piiFields: string[];
  auditOnAccess: boolean;
}
```

#### PIIHandlingByRole

| PII 类别         | 存储层行为                     | L1 展示       | L2 展示  | L3/L4 展示   |
| ---------------- | ------------------------------ | ------------- | -------- | ------------ |
| 用户真名         | 缓存中存储 hash                | 仅显示名      | 仅显示名 | 完整姓名     |
| 邮箱地址         | 不写入 offlineStore            | `j***@co.com` | 完整     | 完整         |
| IP 地址          | 不写入 IndexedDB / SQLite 缓存 | 隐藏          | 隐藏     | 明文         |
| 生物特征绑定信息 | 仅 L4 SecureStorage            | 隐藏          | 隐藏     | "已绑定"标识 |
| 组织架构路径     | 缓存中仅存当前用户可见子树     | 自有节点      | 管辖子树 | 全树         |

**实现方式**：

- `shared/domain/field-visibility.ts` 导出 `applyRedaction(field, value, role): RedactedValue`
- ViewModel mapper 中调用 `applyRedaction`，在 DTO → VM 转换阶段完成脱敏，组件层无需感知
- `auditOnAccess: true` 的字段在 L3/L4 级展示时自动上报 telemetry `field_access` 事件
- PII 字段列表由 `FieldVisibilityPolicy.piiFields` 声明，与后端 `data-classification` 策略对齐

## 4.6 关键模块实施蓝图

> 以下实施细节提取自 Doc-11 历史实施底稿中经评审确认的高价值内容。

### 4.6.1 NL 对话状态机 → UI 映射

| 状态         | UI 表现                                  | 后端事件                   | 状态          |
| ------------ | ---------------------------------------- | -------------------------- | ------------- |
| `idle`       | 输入框 placeholder + 推荐操作卡片        | —                          | [Implemented] |
| `parsing`    | 输入禁用 + "理解中..." 骨架动画          | —                          | [Implemented] |
| `clarifying` | Agent 追问气泡 + 选项按钮/输入框         | `nl.clarification_needed`  | [Proposed]    |
| `building`   | "正在构建任务..." 进度指示               | —                          | [Implemented] |
| `confirming` | 风险预览卡片 + 确认/修改/取消按钮        | `goal.decomposition_ready` | [Planned]     |
| `executing`  | 实时步骤进度条 + 当前步骤描述            | `progress`                 | [Implemented] |
| `reporting`  | 结果摘要卡片 + 详情链接 + "为什么？"按钮 | `completed` / `failed`     | [Implemented] |

### 4.6.2 HITL 人机协作操作面板

| 操作     | 说明                        | UI 组件                     | 状态          |
| -------- | --------------------------- | --------------------------- | ------------- |
| Inspect  | 查看当前 PlanBundle/Context | JSON Tree + 可折叠面板      | [Implemented] |
| Patch    | 修改当前计划参数            | 表单编辑器 + diff 预览      | [Planned]     |
| Override | 覆盖 Agent 决策             | 下拉选择替代方案 + 理由输入 | [Planned]     |
| Takeover | 完全接管人工执行            | 全功能操作面板 + 操作记录   | [Implemented] |
| Resume   | 恢复执行（4 种模式选择）    | 单选 + 确认按钮             | [Implemented] |

**恢复模式**：

| 模式                 | 说明                       | 状态          |
| -------------------- | -------------------------- | ------------- |
| `resume_same_state`  | 原样恢复，继续执行         | [Implemented] |
| `resume_with_replan` | 触发 P3 重新规划           | [Implemented] |
| `resume_supervised`  | 监督模式恢复（每步需确认） | [Planned]     |
| `abort_on_resume`    | 安全终止                   | [Implemented] |

### 4.6.3 Workflow 调试器能力矩阵

| 能力          | 运行中 | 已完成 | UI 实现                               | 状态       |
| ------------- | ------ | ------ | ------------------------------------- | ---------- |
| 执行时间线    | 实时   | 回放   | 水平时间轴 + 步骤卡片（颜色编码状态） | [Planned]  |
| OAPEFLIR 步入 | ✓      | ✓      | 展开步骤 → O/A/P/E/F/L/I/R 各阶段面板 | [Planned]  |
| 数据流视图    | ✓      | ✓      | 步骤间 JSON diff（输入→输出）         | [Planned]  |
| 副作用 Diff   | ✗      | ✓      | 预期 vs 实际 side effect 并排对比     | [Proposed] |
| 断点调试      | ✓      | ✗      | 点击步骤设断点；条件断点对话框        | [Proposed] |
| 时间旅行      | ✗      | ✓      | 时间轴滑块 + ContextSnapshot 预览     | [Deferred] |
| 运行对比      | ✗      | ✓      | 双栏并排 + 差异高亮                   | [Deferred] |

**后端依赖说明**：断点调试和时间旅行依赖后端 DebuggerService 提供 `ws/v1/debug/{workflow_id}` 端点（当前 [Proposed]），在该端点稳定前，调试器仅支持执行时间线和数据流视图的只读回放。

### 4.6.4 审批中心交互特性

| 特性       | Web/桌面                                    | 移动端             | 状态      |
| ---------- | ------------------------------------------- | ------------------ | --------- |
| 快捷操作   | 键盘快捷键 A(approve)/R(reject)/D(delegate) | 通知栏快捷操作按钮 | [Planned] |
| 批量操作   | 全选 + 批量批准（仅 Low 风险）              | 滑动手势批量操作   | [Planned] |
| 上下文预览 | 右侧面板展开 ApprovalContext                | 详情页全屏展示     | [Planned] |
| 委托       | 组织架构树弹窗选择                          | 搜索 + 最近联系人  | [Planned] |
| 超时提醒   | 倒计时标签 + 最后30min 高亮                 | 推送通知 + 震动    | [Planned] |

### 4.6.5 NL 对话模块页面线框图

```text
Web/桌面端：
┌─────────────────────────────────────────────────────────┐
│  NL Conversation Panel（可驻右侧或独立全屏）              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  消息流 (Message Stream)                          │    │
│  │                                                 │    │
│  │  [User] 帮我发起春季营销活动                      │    │
│  │                                                 │    │
│  │  [Agent] 好的，我需要确认几个信息：               │    │
│  │  • 哪个产品的营销活动？                          │    │
│  │  • 预算范围？                                   │    │
│  │  • 截止日期？                                   │    │
│  │                                                 │    │
│  │  [System] 风险预览卡片                           │    │
│  │  ┌─────────────────────────────────────┐        │    │
│  │  │ 将创建 3 个子任务 · 预估 ¥2,500     │        │    │
│  │  │ 需广告合规审批                       │        │    │
│  │  │ [确认] [修改] [取消]                 │        │    │
│  │  └─────────────────────────────────────┘        │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [输入框] │ 语音 │ 附件 │ Cmd+K 命令面板          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

移动端：
┌────────────────────────┐
│ ← NL 对话         ···  │
│                        │
│ 消息流（全屏）          │
│                        │
│ [输入框] [语音] [附件]  │
└────────────────────────┘
```

**共享 Hooks**：

```typescript
interface UseConversation {
  messages: Message[];
  status: ConversationStatus;
  sendMessage(text: string): Promise<void>;
  sendVoice(audio: Blob): Promise<void>;
  attachFile(file: FileRef): Promise<void>;
  confirmAction(actionId: string): Promise<void>;
  cancelAction(actionId: string): Promise<void>;
}
```

### 4.6.6 任务管理三栏布局线框图

```text
Web/桌面端（xl 断点）：
┌───────────┬──────────────────────────┬─────────────────┐
│ 过滤侧栏   │ 任务列表                  │ 任务详情面板      │
│           │                          │                 │
│ 状态 ▾    │ ● 春季营销  executing ▶  │ 目标：...        │
│ □ 全部    │   广告域  2h前            │ 状态：executing  │
│ ■ 执行中  │                          │ 进度：2/4        │
│ □ 已完成  │ ● 月度报表  completed ✓  │                 │
│ □ 待审批  │   数据域  5h前            │ [DAG 依赖图]     │
│ □ 失败    │                          │                 │
│           │ ● 客户清洗  awaiting ⏳  │ 步骤列表：        │
│ 域 ▾      │   数据域  1d前            │ ▶ Step 1 ✓      │
│ □ 全部    │                          │ ▶ Step 2 ✓      │
│ ■ 广告    │                          │ ▼ Step 3 ▶      │
│ □ 数据    │                          │   OAPEFLIR: E   │
│           │                          │ ○ Step 4 ...    │
│ 日期 ▾    │                          │                 │
│ 最近7天   │                          │ [解释] [成本]    │
└───────────┴──────────────────────────┴─────────────────┘
```

**信息层级**：

| 层级 | 内容                                            | 展示条件       |
| ---- | ----------------------------------------------- | -------------- |
| L0   | 标题、状态徽标、域标签、时间                    | 列表项始终显示 |
| L1   | 进度百分比、子任务数、当前步骤、耗时            | 选中详情面板   |
| L2   | DAG 依赖图、步骤列表（OAPEFLIR 阶段）、工具记录 | 展开详情       |
| L3   | HarnessRun 全量、ContextSnapshot、Evidence 链接 | "完整记录"跳转 |

### 4.6.7 审批中心页面线框图

```text
┌────────────────────────────────────────────────────┐
│  审批中心                                            │
│  待处理 (3) │ 已处理 (28) │ 已委托 (5)              │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 紧急 │ 量化策略部署   Critical │ 剩余2h       │  │
│  │ 域：quant-trading                            │  │
│  │ 摘要：Agent 请求部署新交易策略                 │  │
│  │ 风险评估：[展开]                              │  │
│  │ [批准] [拒绝] [委托] [补充]                   │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 普通 │ 价格调整       High │ 剩余24h          │  │
│  │ ...                                          │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 4.6.8 运营看板四层架构

| 看板层级 | 角色     | 核心面板                                           | 刷新策略    |
| -------- | -------- | -------------------------------------------------- | ----------- |
| L1       | 操作者   | 我的任务、审批、Agent 健康、预算、NL 简报          | 实时 + 5min |
| L2       | 域管理   | 域吞吐量、Agent 利用率、SLO、Top 失败、成本分布    | 1min + 5min |
| L3       | 平台 SRE | 五平面健康、资源利用率、错误率、延迟、Incident     | 10s + 30s   |
| L4       | 舰队管理 | 跨区域状态、舰队成本、租户对比、容量预测、合规态势 | 1min + 1h   |

**各层级面板详细规格** _(v3.0 扩展)_：

| 层级 | 面板名称        | 数据源                                                | 图表类型        | 刷新间隔 |
| ---- | --------------- | ----------------------------------------------------- | --------------- | -------- |
| L1   | 我的任务概览    | `GET /api/v1/tasks?owner=me`                          | KPI 卡片        | 实时 WS  |
| L1   | 待审批队列      | `MissionControlService.listApprovalQueue()`           | 列表 + Badge    | 实时 WS  |
| L1   | 我的 Agent 健康 | `GET /api/v1/agents?scope=my_domain`                  | 状态指示灯      | 10s      |
| L1   | 预算使用率      | `GET /api/v1/costs?scope=my_domain`                   | Gauge           | 5min     |
| L2   | 域任务吞吐量    | `GET /api/v1/dashboard/metrics?scope=domain`          | 折线图          | 1min     |
| L2   | Agent 利用率    | `GET /api/v1/dashboard/metrics?metric=agent`          | 热力图          | 1min     |
| L2   | SLO 达标率      | `GET /api/v1/dashboard/metrics?metric=slo`            | Gauge           | 5min     |
| L2   | Top 5 失败原因  | `GET /api/v1/dashboard/metrics?metric=failures`       | 水平柱状图      | 5min     |
| L2   | 域成本分布      | `GET /api/v1/costs?scope=domain&breakdown=model`      | 饼图            | 5min     |
| L3   | 五平面健康      | `GET /api/v1/dashboard/metrics?metric=health`         | 多轴折线        | 10s      |
| L3   | P99 延迟        | `GET /api/v1/dashboard/metrics?metric=latency`        | 折线图 + 阈值线 | 10s      |
| L3   | 错误率          | `GET /api/v1/dashboard/metrics?metric=errors`         | 面积图          | 10s      |
| L3   | 资源利用率      | `GET /api/v1/dashboard/metrics?metric=resources`      | 仪表盘集群      | 30s      |
| L3   | Incident 时间线 | `OperatorConsoleBackendService.getIncidentTimeline()` | 时间线          | 实时 WS  |
| L4   | 跨区域状态      | `GET /api/v1/dashboard/metrics?scope=fleet`           | 地理热力图      | 1min     |
| L4   | 舰队成本对比    | `GET /api/v1/costs?scope=fleet`                       | 分组柱状图      | 1h       |
| L4   | 租户对比        | `GET /api/v1/dashboard/metrics?scope=tenants`         | 雷达图          | 1h       |
| L4   | 容量预测        | `GET /api/v1/dashboard/metrics?metric=capacity`       | 预测折线图      | 1h       |

**自适应规则**：

- 单人模式：仅 L1 看板，隐藏多租户/组织面板
- 企业模式：按用户角色自动切换 L1-L4
- 所有看板面板支持拖拽排序 + 可见性配置
- 看板布局持久化到 `UserPreferences.default_dashboard_layout`（配置管理中心 §4.2.9）

### 4.6.9 Workflow 构建器技术方案

| 组件     | 技术         | 说明                                 |
| -------- | ------------ | ------------------------------------ |
| 画布     | React Flow   | 节点画布，支持缩放/平移/框选/吸附    |
| 节点类型 | 自定义 Node  | 触发器/操作/条件/循环/并行/等待/审批 |
| 连线     | 有向边       | 条件分支标注 + 数据流类型标注        |
| 校验     | DAG 拓扑校验 | 实时检测环路、缺失连接、未填参数     |
| 预览     | Dry-run      | 沙箱执行，不产生真实 side effect     |
| 属性面板 | 右侧抽屉     | 选中节点后显示配置表单               |
| 组件面板 | 左侧面板     | 可搜索/可拖拽组件列表                |

**移动端策略**：移动端仅支持只读查看 Workflow 图（缩放 + 节点详情弹窗），不支持编辑。原因：画布拖拽编辑在小屏体验差，且 React Flow 不支持 React Native。

### 4.6.10 调试器实时数据流

```text
WebSocket /ws/v1/debug/{workflow_id}
  │
  ▼
DebugEventStream
  ├── step_started     → 时间轴新增步骤卡片
  ├── step_progress    → 步骤卡片内进度更新
  ├── oapeflir_phase   → OAPEFLIR 面板实时切换
  ├── tool_call        → 工具调用日志追加
  ├── evaluator_report → 评估结果面板刷新
  ├── breakpoint_hit   → 暂停指示 + 断点面板弹出
  ├── step_completed   → 步骤卡片变色（绿/红）
  └── run_completed    → 时间轴锁定 + 启用时间旅行
```

### 4.6.11 Agent 监控中心技术方案 _(v3.0 新增)_

**核心组件**：

| 组件           | 技术                   | 说明                                             |
| -------------- | ---------------------- | ------------------------------------------------ |
| Agent 列表     | 虚拟滚动 + WS 实时更新 | 支持 500+ Agent 列表不卡顿，WS 推送增量更新      |
| 健康度指示器   | `AgentHealthIndicator` | 复用 `ui-core/business/` 已有组件，支持 4 色状态 |
| 心跳时间线     | ECharts Scatter        | X 轴时间，Y 轴心跳间隔，异常点标红               |
| 负载曲线       | ECharts Line           | 双 Y 轴：active_tasks + queue_depth              |
| Agent 详情抽屉 | 右侧 Drawer 640px      | Tab 切换：基本信息/能力/心跳/负载/任务/错误      |

**useAgentMonitor Hook**：

```typescript
function useAgentMonitor(filters: AgentFilters) {
  const agents = useQuery({
    queryKey: ["agents", "list", filters],
    queryFn: () => agentApi.list(filters),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  useWSSubscription("agent.*", (event) => {
    queryClient.invalidateQueries({ queryKey: ["agents"] });
  });

  const summary = useMemo(
    () => ({
      total: agents.data?.length ?? 0,
      healthy: agents.data?.filter((a) => a.status === "active").length ?? 0,
      degraded: agents.data?.filter((a) => a.status === "degraded").length ?? 0,
      offline: agents.data?.filter((a) => a.status === "offline").length ?? 0,
    }),
    [agents.data],
  );

  return { agents, summary };
}
```

### 4.6.12 数据统计平台技术方案 _(v3.0 新增)_

**图表渲染架构**：

```text
DashboardMetricsDTO (API)
  │
  ▼
useMetricsQuery(scope, timeRange)
  │
  ├── KPI 聚合 ──────────→ <KPICardGrid>
  ├── task_trend ─────────→ <TaskTrendChart type="line">
  ├── status_distribution → <StatusPieChart type="pie">
  ├── agent_utilization ──→ <AgentHeatmap type="heatmap">
  ├── cost_trend ─────────→ <CostAreaChart type="area">
  ├── top_failures ───────→ <FailureBarChart type="bar">
  └── workflow_durations ─→ <WorkflowBoxPlot type="boxplot">
```

**角色自适应规则**：

| 用户角色 | 可见图表                                    | 默认时间范围 |
| -------- | ------------------------------------------- | ------------ |
| L1       | KPI 卡片（个人维度）+ 我的任务趋势          | 7 天         |
| L2       | 全部图表（域维度）                          | 30 天        |
| L3       | 全部图表（全平台）+ 系统健康面板 + P99 延迟 | 24 小时      |
| L4       | 全部图表（跨区域）+ 容量预测 + 租户对比     | 30 天        |

**useMetricsQuery Hook**：

```typescript
function useMetricsQuery(scope: MetricsScope, timeRange: TimeRange) {
  return useQuery({
    queryKey: ["dashboard", "metrics", scope, timeRange],
    queryFn: () => dashboardApi.getMetrics(scope, timeRange),
    staleTime: scope.role === "sre" ? 10_000 : 60_000,
    refetchInterval: scope.role === "sre" ? 10_000 : 60_000,
  });
}
```

### 4.6.13 配置管理中心技术方案 _(v3.0 新增)_

**子页面路由与懒加载**：

```typescript
const settingsRoutes = [
  { path: "preferences", component: lazy(() => import("./UserPreferences")) },
  { path: "permissions", component: lazy(() => import("./PermissionManager")) },
  { path: "models", component: lazy(() => import("./ModelConfig")) },
  { path: "domains/:id", component: lazy(() => import("./DomainSettings")) },
  { path: "tenants", component: lazy(() => import("./TenantManager")) },
  { path: "webhooks", component: lazy(() => import("./WebhookManager")) },
];
```

**权限矩阵编辑器**：

| 组件           | 技术                | 说明                                           |
| -------------- | ------------------- | ---------------------------------------------- |
| 角色-权限矩阵  | `<PermissionGrid>`  | 行=功能页面，列=操作(CRUD+manage)，单元格=开关 |
| 权限继承可视化 | 树形图 + 高亮继承链 | 显示角色继承关系，高亮当前权限来源             |
| 用户-角色分配  | 穿梭框(Transfer)    | 左=可分配用户，右=已分配用户，支持批量操作     |
| 变更 Diff 预览 | 变更前后对比表      | 保存前显示变更摘要，需二次确认                 |

**模型配置管理**：

| 组件               | 技术               | 说明                                          |
| ------------------ | ------------------ | --------------------------------------------- |
| 模型列表           | 数据表格           | 显示 provider/model/域绑定数/Token 预算使用率 |
| Prompt Policy 编辑 | Monaco Editor 嵌入 | 支持 JSON/YAML 编辑 + 语法校验 + diff 预览    |
| Token 预算仪表盘   | ECharts Gauge      | 日/月预算使用率，超限预警                     |
| Fallback 链编辑    | 拖拽排序列表       | 拖拽调整 fallback 优先级                      |
| 域绑定管理         | 穿梭框             | 左=可用域，右=已绑定域                        |

**功能开关管理**：

| 组件       | 技术                   | 说明                                   |
| ---------- | ---------------------- | -------------------------------------- |
| 开关列表   | 数据表格               | 名称/状态/灰度百分比/目标范围/最后更新 |
| 灰度滑块   | Slider + 数字输入      | 0-100% 灰度百分比控制                  |
| 目标选择器 | 多级选择(域→租户→用户) | 逐级缩小灰度范围                       |
| 变更历史   | 时间线组件             | 谁在什么时候改了什么，支持回滚         |

## 4.7 Planned 模块 mini-contract _(v2.3 新增)_

以下 6 个 `[Planned]` 模块已纳入信息架构（§4.1），但尚缺闭环契约。本节为每个模块定义最小契约块（minimal DTO / actions / query keys / permission / WS needs / offline rule），作为后端 API 设计和前端 mock-server 的对齐基准。

> **数据权威性约定** _(v3.0 新增)_：每个 mini-contract 新增三个维度（Authoritative Source / Derived Source / Projection Owner），防止前端将 UI projection 误认为 authoritative fact。
>
> - **Authoritative Source**：该模块数据的唯一真值来源（后端 service / 外部系统）
> - **Derived Source**：基于 authoritative source 聚合或投影而来的派生数据源
> - **Projection Owner**：负责维护 DTO → ViewModel 投影逻辑的团队/模块，schema 变更时由此 owner 负责更新

### 4.7.1 AgentManager

| 维度                 | 定义                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ agent_id, name, domain_id, status, health, version, capabilities[], last_heartbeat, created_at }` |
| Actions              | `list` · `get(id)` · `register` · `deregister` · `update_config` · `restart`                         |
| Query Keys           | `["agents"]` · `["agents", "list", filters]` · `["agents", "detail", id]`                            |
| Permission           | 域管理员(L2): list+get; Pack 开发者(L2/L3): full CRUD; SRE(L3/L4): full + restart                    |
| WS Needs             | `agent.health_changed` · `agent.registered` · `agent.deregistered`                                   |
| Offline Rule         | 只读浏览允许 stale cache；注册/注销/重启必须在线                                                     |
| API Endpoint         | `CRUD /api/v1/agents` · `POST /api/v1/agents/{id}/restart`                                           |
| Authoritative Source | `AgentRegistryService` (src/domains/registry/)                                                       |
| Derived Source       | `MissionControlService.getSnapshot()` → agents 摘要（非权威，仅投影）                                |
| Projection Owner     | 前端 `feature-agent-manager` 模块                                                                    |

### 4.7.2 WorkflowBuilder

| 维度                 | 定义                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ workflow_id, name, domain_id, steps[], edges[], version, status, created_by, updated_at }`             |
| Actions              | `list` · `get(id)` · `create` · `update` · `delete` · `validate` · `publish` · `clone`                    |
| Query Keys           | `["workflows"]` · `["workflows", "list", filters]` · `["workflows", "detail", id]`                        |
| Permission           | Pack 开发者(L2/L3): full CRUD; SRE(L3/L4): full + publish                                                 |
| WS Needs             | `workflow.updated` · `workflow.published` · `workflow.validation_result`                                  |
| Offline Rule         | 画布编辑允许离线排队（本地草稿）；发布/验证必须在线                                                       |
| API Endpoint         | `CRUD /api/v1/workflows` · `POST /api/v1/workflows/{id}/validate` · `POST /api/v1/workflows/{id}/publish` |
| Authoritative Source | `WorkflowDefinitionService` (src/platform/orchestration/)                                                 |
| Derived Source       | `MissionControlService.getWorkflowCockpit()` → workflow 摘要（非权威，仅投影）                            |
| Projection Owner     | 前端 `feature-workflow-builder` 模块                                                                      |

### 4.7.3 WorkflowDebugger

| 维度                 | 定义                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ debug_session_id, workflow_id, execution_id, timeline_events[], breakpoints[], current_step, state_snapshot }`         |
| Actions              | `start_session` · `set_breakpoint` · `remove_breakpoint` · `step_over` · `resume` · `inspect_state` · `replay_from(step)` |
| Query Keys           | `["debug", workflowId]` · `["debug", "session", sessionId]` · `["debug", "timeline", executionId]`                        |
| Permission           | Pack 开发者(L2/L3): full; SRE(L3/L4): full                                                                                |
| WS Needs             | `ws/v1/debug/{workflow_id}` — `debug.step_entered` · `debug.breakpoint_hit` · `debug.state_snapshot`                      |
| Offline Rule         | 全部必须在线（实时调试依赖 WS 连接）                                                                                      |
| API Endpoint         | `POST /api/v1/debug/sessions` · `GET /api/v1/debug/sessions/{id}` · `DELETE /api/v1/debug/sessions/{id}`                  |
| Authoritative Source | `DebuggerService` (src/ops-maturity/debugger/) + `ExecutionEngine` 运行时状态                                             |
| Derived Source       | WS 实时推送的 `state_snapshot` 为运行时投影，非持久化真值                                                                 |
| Projection Owner     | 前端 `feature-workflow-debugger` 模块                                                                                     |

### 4.7.4 Marketplace

| 维度                 | 定义                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ pack_id, name, description, author, version, domain_tags[], rating, download_count, compatibility, status }`                           |
| Actions              | `list` · `search` · `get(id)` · `install` · `uninstall` · `publish` · `review` · `rate`                                                   |
| Query Keys           | `["marketplace"]` · `["marketplace", "list", filters]` · `["marketplace", "detail", id]` · `["marketplace", "installed"]`                 |
| Permission           | L1: browse+rate; 域管理员(L2): install+uninstall; Pack 开发者: publish; SRE: full                                                         |
| WS Needs             | `marketplace.pack_published` · `marketplace.pack_updated` · `marketplace.install_completed`                                               |
| Offline Rule         | 浏览允许 stale cache；安装/卸载/发布必须在线                                                                                              |
| API Endpoint         | `GET /api/v1/marketplace` · `GET /api/v1/marketplace/{id}` · `POST /api/v1/marketplace/{id}/install` · `POST /api/v1/marketplace/publish` |
| Authoritative Source | `MarketplaceService` (src/scale-ecosystem/marketplace/)                                                                                   |
| Derived Source       | 无（Marketplace 为自身真值源）                                                                                                            |
| Projection Owner     | 前端 `feature-marketplace` 模块                                                                                                           |

### 4.7.5 Explainability

| 维度                 | 定义                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ explanation_id, task_id, step_id, explanation_type, reasoning_chain[], confidence, sources[], generated_at }` |
| Actions              | `query(task_id, step_id?)` · `get(explanation_id)` · `rate_helpfulness` · `export`                               |
| Query Keys           | `["explanations", taskId]` · `["explanations", "detail", explanationId]`                                         |
| Permission           | L1: 自有任务 summary; 域管理员(L2): 域内 full; Pack 开发者: full; SRE: full                                      |
| WS Needs             | 无实时需求（按需查询）                                                                                           |
| Offline Rule         | 已查询过的 explanation 可缓存展示；新查询必须在线                                                                |
| API Endpoint         | `POST /api/v1/explanations` (query) · `GET /api/v1/explanations/{id}`                                            |
| Authoritative Source | `ExplainabilityService` (src/ops-maturity/explainability/)                                                       |
| Derived Source       | explanation 基于 `ExecutionEngine` 运行日志 + LLM 推理链生成，非原始事实                                         |
| Projection Owner     | 前端 `feature-explainability` 模块                                                                               |

### 4.7.6 CostCenter

| 维度                 | 定义                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ cost_record_id, domain_id, tenant_id, period, total_cost, breakdown_by_model[], breakdown_by_task_type[], budget, budget_utilization_pct }` |
| Actions              | `get_summary(domain_id, period)` · `get_detail(cost_record_id)` · `set_budget` · `set_alert_threshold` · `export_report`                       |
| Query Keys           | `["costs", domainId, period]` · `["costs", "detail", recordId]` · `["costs", "budget", domainId]`                                              |
| Permission           | L1: 自有域只读; 业务线负责人: 业务线聚合; 域管理员: 域级+set_budget; SRE: 全局+all actions                                                     |
| WS Needs             | `cost.budget_alert` · `cost.period_closed`                                                                                                     |
| Offline Rule         | 只读浏览允许 stale cache；set_budget / set_alert 必须在线                                                                                      |
| API Endpoint         | `GET /api/v1/costs` · `GET /api/v1/costs/{id}` · `PUT /api/v1/costs/budget` · `POST /api/v1/costs/export`                                      |
| Authoritative Source | `CostTrackingService` (src/ops-maturity/cost/)                                                                                                 |
| Derived Source       | cost breakdown 由 `ResourceManagerService` 使用量数据聚合而来                                                                                  |
| Projection Owner     | 前端 `feature-cost-center` 模块                                                                                                                |

### 4.7.7 AnalyticsDashboard _(v3.0 新增)_

| 维度                 | 定义                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ time_range, scope, kpis{total_tasks,success_rate,avg_duration_ms,active_agents,slo_compliance,total_cost}, task_trend[], status_distribution[], agent_utilization[], cost_trend[], top_failures[], workflow_durations[] }` |
| Actions              | `get_metrics(scope, time_range)` · `get_kpis(scope)` · `get_trend(metric, time_range)` · `export_report(format)`                                                                                                              |
| Query Keys           | `["dashboard", "metrics", scope, timeRange]` · `["dashboard", "kpis", scope]` · `["dashboard", "trend", metric, timeRange]`                                                                                                   |
| Permission           | L1: 个人维度只读; L2: 域维度; L3: 全平台; L4: 跨区域+容量预测                                                                                                                                                                 |
| WS Needs             | `dashboard.metric_updated` (delta push，避免全量轮询)                                                                                                                                                                         |
| Offline Rule         | 已加载的图表数据允许 stale 展示（带 "数据截至 HH:mm" 标记）；导出必须在线                                                                                                                                                     |
| API Endpoint         | `GET /api/v1/dashboard/metrics` · `GET /api/v1/dashboard/kpis` · `GET /api/v1/dashboard/trend/{metric}` · `POST /api/v1/dashboard/export`                                                                                     |
| Authoritative Source | `MissionControlService` (聚合层) + `CostTrackingService` + `AgentRegistryService`                                                                                                                                             |
| Derived Source       | 所有指标均为聚合投影，非原始事实；原始事实分布在各 P2-P5 平面 service 中                                                                                                                                                      |
| Projection Owner     | 前端 `feature-analytics` 模块                                                                                                                                                                                                 |

### 4.7.8 ConfigurationCenter _(v3.0 新增)_

| 维度                 | 定义                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimal DTO          | `{ user_preferences{locale,timezone,theme,notifications}, roles[], feature_flags[], model_configs[], domains[], tenants[], webhooks[], recent_changes[] }`                                                                                                                                             |
| Actions              | **偏好**: get/update_preferences · **权限**: CRUD roles + assign_user · **功能**: CRUD flags + toggle + rollout · **模型**: CRUD models + bind_domain + set_budget · **域**: get/update domain + update_ui_config · **租户**: CRUD tenants + map_domain · **Webhook**: CRUD webhooks + test + view_log |
| Query Keys           | `["settings", "preferences"]` · `["settings", "roles"]` · `["settings", "flags"]` · `["settings", "models"]` · `["settings", "domains", id]` · `["settings", "tenants"]` · `["settings", "webhooks"]`                                                                                                  |
| Permission           | authenticated: 偏好; org_admin: 权限+租户; domain_admin: 模型+域+Webhook; platform_sre: 功能开关+全部                                                                                                                                                                                                  |
| WS Needs             | `config.updated` (通知其他在线用户配置已变更)                                                                                                                                                                                                                                                          |
| Offline Rule         | 偏好允许离线缓存读取；所有写操作必须在线；配置变更需乐观锁（`If-Match` ETag）                                                                                                                                                                                                                          |
| API Endpoint         | `GET/PUT /api/v1/user/preferences` · `CRUD /api/v1/admin/roles` · `CRUD /api/v1/admin/feature-flags` · `CRUD /api/v1/admin/models` · `GET/PUT /api/v1/admin/domains/{id}` · `CRUD /api/v1/admin/tenants` · `CRUD /api/v1/admin/webhooks`                                                               |
| Authoritative Source | `admin-routes` (src/sdk/cli/admin/) + `UserPreferenceService` + `DomainConfigService`                                                                                                                                                                                                                  |
| Derived Source       | `DomainUIConfig` (§6.1.2) 为域设置的前端投影                                                                                                                                                                                                                                                           |
| Projection Owner     | 前端 `feature-settings` 模块                                                                                                                                                                                                                                                                           |

---

# Part IV — 数据与通信

---

# 5. 数据流、API 集成与实时层

> **改进点 A-2、A-3、D-1**：区分 Implemented/Planned API 端点；按后端实际 WebSocket 事件分层；明确 Web 离线三层策略。v2.3 新增 API Layer 分级（§5.2.3）和 Mutation 幂等规范（§5.6.4）。

## 5.1 状态管理架构

**状态分类**：

| 状态类别   | 管理工具        | 生命周期       | 持久化 | 示例                                 |
| ---------- | --------------- | -------------- | ------ | ------------------------------------ |
| 应用状态   | Zustand         | App 生命周期   | 是     | user, token, theme, locale, sidebar  |
| 服务端状态 | TanStack Query  | 按 staleTime   | 可选   | tasks, approvals, agents, dashboard  |
| 实时状态   | Zustand + WS    | WebSocket 连接 | 否     | wsStatus, eventBuffer, subscriptions |
| 表单状态   | React Hook Form | 页面生命周期   | 否     | 创建任务、审批决策、域配置等表单     |
| URL 状态   | React Router    | 路由生命周期   | URL    | 过滤条件、分页 cursor、当前标签      |

```text
┌───────────────────────────────────────────────────────────────┐
│                     UI 状态管理分层                             │
│                                                               │
│  ┌──────────────────┐  ┌───────────────────────────────────┐ │
│  │  Client State    │  │  Server State                     │ │
│  │  (Zustand 5)     │  │  (TanStack Query v5)              │ │
│  │                  │  │                                   │ │
│  │  • UI 状态       │  │  • 任务/审批/看板数据              │ │
│  │  • 主题偏好      │  │  • 自动缓存 + 去重                │ │
│  │  • 侧边栏折叠    │  │  • 后台刷新 + 乐观更新            │ │
│  │  • 对话上下文    │  │  • 离线 persister                 │ │
│  └────────┬─────────┘  └────────────┬──────────────────────┘ │
│           │                         │                         │
│  ┌────────┴─────────────────────────┴──────────────────────┐ │
│  │            Realtime Layer（WebSocket → Store sync）       │ │
│  │  WS 事件 → invalidateQueries() / 直接更新 Zustand store  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Offline Layer（sync-store + offline-queue）     │ │
│  │  离线操作排队 → 连接恢复 → 按序重放 → 冲突解决            │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Zustand Store 划分**：

| Store            | 职责                                   | 持久化           |
| ---------------- | -------------------------------------- | ---------------- |
| `auth-store`     | 认证状态、当前用户、权限缓存           | 安全存储(L4)     |
| `ui-store`       | 主题、侧边栏、当前路由状态、布局偏好   | localStorage     |
| `sync-store`     | 离线队列状态、同步进度、冲突列表       | offlineStore(L4) |
| `realtime-store` | WebSocket 连接状态、订阅列表、事件缓冲 | 内存             |

### 5.1.1 Zustand Store 接口定义

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  permissions: Permission[];
  tenantId: string | null;
  tenantConfig: TenantConfig | null;
  isAuthenticated: boolean;
  login(credentials: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  refreshToken(): Promise<void>;
  switchTenant(tenantId: string): Promise<void>;
}

interface UIState {
  theme: "light" | "dark" | "high-contrast" | "system";
  locale: string;
  sidebarCollapsed: boolean;
  activeView: string;
  nlPanelOpen: boolean;
  commandPaletteOpen: boolean;
  setTheme(theme: UIState["theme"]): void;
  setLocale(locale: string): void;
  toggleSidebar(): void;
  toggleNLPanel(): void;
}

interface SyncState {
  online: boolean;
  queueDepth: number;
  lastSyncAt: string | null;
  conflicts: ConflictItem[];
  syncStatus: "idle" | "syncing" | "error";
  resolveConflict(id: string, resolution: "local" | "remote"): Promise<void>;
  retrySync(): Promise<void>;
}

interface RealtimeState {
  wsStatus: "disconnected" | "connecting" | "connected" | "reconnecting";
  activeSubscriptions: Set<string>;
  pendingApprovalCount: number;
  activeIncidents: Incident[];
  panicActivated: boolean;
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
}
```

### 5.1.2 TanStack Query staleTime 策略

| 数据类型   | staleTime | gcTime | 理由                     |
| ---------- | --------- | ------ | ------------------------ |
| 看板指标   | 30s       | 5min   | 频繁变化，需近实时       |
| 任务列表   | 2min      | 30min  | 中等频率变化             |
| 任务详情   | 1min      | 30min  | 用户关注的当前任务需较新 |
| 审批列表   | 30s       | 10min  | 时效性要求高             |
| Agent 列表 | 5min      | 30min  | 变化不频繁               |
| 配置数据   | 1h        | 24h    | 极少变化                 |
| 市场列表   | 10min     | 1h     | 变化不频繁               |
| 成本数据   | 5min      | 30min  | 有一定时效性             |

### 5.1.3 QueryClient 全局默认配置

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5min 默认
      gcTime: 30 * 60 * 1000, // 30min GC
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 5.1.4 离线持久化

移动端和桌面端使用 TanStack Query 的 `persistQueryClient`，将查询缓存持久化到 L4 存储：

```text
TanStack Query Cache
  │
  └─ persistQueryClient(
       persister: createSyncStoragePersister({
         storage: L4.secureStorage  // Web: IndexedDB, 桌面: SQLite, RN: AsyncStorage
       }),
       maxAge: 24 * 60 * 60 * 1000  // 24h
     )
```

### 5.1.5 数据流模式

```text
用户操作
  │
  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ UI 组件     │────▶│ Mutation   │────▶│ REST API   │
│ (触发)     │     │ (乐观更新) │     │ (实际请求) │
└────────────┘     └─────┬──────┘     └─────┬──────┘
                         │                  │
                  即时更新│                  │ 服务端响应
                         ▼                  ▼
                  ┌────────────┐     ┌────────────┐
                  │ 本地缓存   │     │ 缓存更新    │
                  │ (即时反馈) │     │ 或 回滚     │
                  └────────────┘     └────────────┘

WebSocket 事件（服务端推送）
  │
  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ WS Client  │────▶│ 事件路由   │────▶│ Query 缓存 │
│ (接收)     │     │ (分发)     │     │ 失效/更新  │
└────────────┘     └────────────┘     └─────┬──────┘
                                            │
                                            ▼
                                     UI 自动刷新
```

### 5.1.6 ViewModel 映射规范（DTO → VM → Props 反腐层）

UI 层在 `shared/api-client` 中引入三层数据转换，隔离后端 DTO 变更对 UI 组件的冲击：

```text
后端 REST/WS ──→ DTO (api-client/types/) ──→ ViewModel (shared/viewmodels/) ──→ Props (features/*/components/)
                  │                            │                                   │
                  │ 原样映射后端 JSON           │ 业务语义转换 + 字段重命名          │ 纯展示型，无可选字段
                  │ 字段名/类型与后端一致       │ 添加派生字段(如 isOverdue)          │ 所有字段 required
                  │ 由 openapi-ts 自动生成      │ 手写 + 单元测试覆盖                 │ 由组件定义
```

**层级职责**：

| 层级      | 位置                         | 生成方式         | 允许的转换                                           | 禁止的行为                       |
| --------- | ---------------------------- | ---------------- | ---------------------------------------------------- | -------------------------------- |
| DTO       | `shared/api-client/types/`   | openapi-ts 生成  | 无（与后端 OpenAPI schema 1:1）                      | 手动修改生成文件                 |
| ViewModel | `shared/viewmodels/`         | 手写 mapper 函数 | 字段重命名、类型转换、派生字段、空值默认值、枚举映射 | 调用 API、副作用、引用 UI 框架   |
| Props     | `features/*/components/*.ts` | 组件定义         | 展示格式化（日期/数字/状态文案）                     | 引用 DTO 类型、直接持有 API 响应 |

**Mapper 函数规范**：

```typescript
// shared/viewmodels/task.vm.ts
import type { TaskDTO } from "../api-client/types/task.js";

export interface TaskVM {
  id: string;
  title: string;
  statusLabel: string;
  statusColor: "green" | "blue" | "yellow" | "red" | "gray";
  isOverdue: boolean;
  createdAtFormatted: string;
  assigneeName: string;
  domainLabel: string;
  drillDepth: 1 | 2 | 3 | 4 | 5;
}

export function toTaskVM(dto: TaskDTO): TaskVM {
  return {
    id: dto.id,
    title: dto.name,
    statusLabel: STATUS_LABEL_MAP[dto.status] ?? dto.status,
    statusColor: STATUS_COLOR_MAP[dto.status] ?? "gray",
    isOverdue: dto.deadline != null && new Date(dto.deadline) < new Date(),
    createdAtFormatted: formatRelativeTime(dto.created_at),
    assigneeName: dto.assignee?.display_name ?? "Unassigned",
    domainLabel: dto.domain_id,
    drillDepth: 1,
  };
}
```

**规则**：

- DTO 层禁止手动编辑——仅通过 `openapi-ts` 从后端 OpenAPI spec 重新生成
- ViewModel mapper 必须有对应单元测试，覆盖空值、边界枚举、时区转换
- 组件 Props 不得出现 `| undefined`——所有可选性在 VM mapper 中消解
- Feature 模块中的 hooks（如 `useTaskList`）返回 VM 数组，不返回 DTO

## 5.2 REST API 端点映射（Implemented vs Planned）

> **改进点 A-2**：后端 http-server 路由交叉验证结果；v2.3 增加 API Layer 标注和 Public UI API Surface 分层。

### 5.2.1 已实现端点 [Implemented]（含 API Layer 标注）

| UI 功能          | 后端路由文件              | 端点示例                             | 方法       | 状态                     | API Layer |
| ---------------- | ------------------------- | ------------------------------------ | ---------- | ------------------------ | --------- |
| 任务 CRUD        | `task-routes.ts`          | `/api/v1/tasks`, `/api/v1/tasks/:id` | GET/POST   | [Implemented/Contracted] | Layer C   |
| 审批操作         | `admin-routes.ts`         | `/api/v1/approvals/:id`              | POST       | [Implemented/Contracted] | Layer C   |
| Dashboard 数据   | `dashboard-routes.ts`     | `/api/v1/dashboard/*`                | GET        | [Implemented/Contracted] | Layer C   |
| Console 页面     | `console-routes.ts`       | `/console/*`                         | GET (HTML) | [Implemented/Internal]   | Layer B   |
| Admin 管理       | `admin-routes.ts`         | `/admin/v1/*`                        | CRUD       | [Implemented/Contracted] | Layer B/C |
| 契约版本校验     | `meta-routes`             | `/api/v1/meta/contract-version`      | GET        | [Implemented/Contracted] | Layer C   |
| Mission Control  | `mission-control-service` | 通过 console-routes 暴露             | GET        | [Implemented/Internal]   | Layer A→C |
| Operator Console | `console-backend/`        | 快照/审批队列/Worker 面板/Incident   | GET        | [Implemented/Internal]   | Layer A→C |

### 5.2.2 规划端点 [Planned]（API 增强需求）

| UI 功能        | 建议端点                         | 方法    | 数据源建议                            | 状态      | 优先级 |
| -------------- | -------------------------------- | ------- | ------------------------------------- | --------- | ------ |
| Agent 管理     | `/api/v1/agents`                 | CRUD    | AgentRegistry + AgentLifecycleService | [Planned] | P1     |
| Workflow CRUD  | `/api/v1/workflows`              | CRUD    | OrchestrationPlane workflow 存储      | [Planned] | P1     |
| Marketplace    | `/api/v1/marketplace`            | GET     | MarketplaceService (scale-ecosystem/) | [Planned] | P2     |
| 解释查询       | `/api/v1/explanations`           | POST    | ExplainabilityService (ops-maturity/) | [Planned] | P2     |
| 成本数据       | `/api/v1/costs`                  | GET     | CostService (ops-maturity/)           | [Planned] | P2     |
| Dashboard 指标 | `/api/v1/dashboard/metrics`      | GET     | DashboardProjectionService            | [Planned] | P1     |
| Dashboard KPI  | `/api/v1/dashboard/kpis`         | GET     | MissionControlService 聚合            | [Planned] | P1     |
| Dashboard 趋势 | `/api/v1/dashboard/trend/{m}`    | GET     | DashboardProjectionService            | [Planned] | P2     |
| Dashboard 导出 | `/api/v1/dashboard/export`       | POST    | DashboardProjectionService            | [Planned] | P2     |
| Task Evidence  | `/api/v1/tasks/:id/evidence`     | GET     | StateEvidencePlane                    | [Planned] | P1     |
| Task Timeline  | `/api/v1/tasks/:id/timeline`     | GET     | StateEvidencePlane event log          | [Planned] | P1     |
| Agent 心跳     | `/api/v1/agents/{id}/heartbeats` | GET     | AgentRegistryService                  | [Planned] | P2     |
| Agent 指标     | `/api/v1/agents/{id}/metrics`    | GET     | AgentRegistryService                  | [Planned] | P2     |
| 用户偏好       | `/api/v1/user/preferences`       | GET/PUT | UserPreferenceService                 | [Planned] | P1     |
| 角色管理       | `/api/v1/admin/roles`            | CRUD    | admin-routes                          | [Planned] | P1     |
| 功能开关       | `/api/v1/admin/feature-flags`    | CRUD    | admin-routes                          | [Planned] | P1     |
| 模型配置       | `/api/v1/admin/models`           | CRUD    | admin-routes + ModelConfigService     | [Planned] | P1     |
| 域配置         | `/api/v1/admin/domains/{id}`     | GET/PUT | DomainConfigService                   | [Planned] | P1     |
| 租户管理       | `/api/v1/admin/tenants`          | CRUD    | admin-routes                          | [Planned] | P2     |
| Webhook 管理   | `/api/v1/admin/webhooks`         | CRUD    | admin-routes                          | [Planned] | P2     |

### 5.2.3 Public UI API Surface 分层 _(v2.3 新增)_

为消除"后端存在某服务/某 route"等同于"前端已可稳定集成"的歧义，本节将后端 API 分为三个严格层次。前端仅可消费 **Layer C（Public Contract Endpoint）**；对 Layer A/B 的消费需后端团队显式升级为 Layer C。

| 层次                             | 定义                                                                             | 前端可消费 | 示例                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| **Layer A — Service Method**     | 后端 TypeScript service 类的方法，仅在进程内可调用，无 HTTP 暴露                 | ❌         | `MissionControlService.getSnapshot()` (service method)                 |
| **Layer B — Internal Route**     | 通过 HTTP route 暴露但面向内部控制台/HTML 页面，无公开 JSON schema，无版本化保障 | ⚠️ 需确认  | `GET /console/*` (HTML 页面) · `/admin/v1/*` (部分 HTML)               |
| **Layer C — Public Contract EP** | 面向外部消费者的 JSON API，有 OpenAPI spec、版本化路径、稳定的请求/响应 schema   | ✅         | `GET /api/v1/tasks` · `POST /api/v1/tasks` · `GET /api/v1/dashboard/*` |

**当前各数据源的层次归属**：

| 数据源                                     | 当前层次  | 目标层次 | 升级动作                                                    |
| ------------------------------------------ | --------- | -------- | ----------------------------------------------------------- |
| `GET /api/v1/tasks` · `POST /api/v1/tasks` | Layer C   | Layer C  | 无需变更，已有 OpenAPI spec                                 |
| `POST /api/v1/approvals/:id`               | Layer C   | Layer C  | 无需变更                                                    |
| `GET /api/v1/dashboard/*`                  | Layer C   | Layer C  | 无需变更                                                    |
| `MissionControlService.*`                  | Layer A   | Layer C  | 需新增 `GET /api/v1/mission-control/*` JSON route + OpenAPI |
| `OperatorConsoleBackendService.*`          | Layer A   | Layer C  | 需新增 `GET /api/v1/operator/*` JSON route + OpenAPI        |
| `GET /console/*`                           | Layer B   | Layer B  | 保持为内部 HTML 入口，前端不直接消费                        |
| `GET /admin/v1/*`                          | Layer B/C | Layer C  | 部分已有 JSON 响应(Contracted)；HTML 部分标注 Internal      |
| `CRUD /api/v1/agents` (Planned)            | —         | Layer C  | 直接按 Layer C 标准设计                                     |
| `CRUD /api/v1/workflows` (Planned)         | —         | Layer C  | 直接按 Layer C 标准设计                                     |
| `GET /api/v1/marketplace` (Planned)        | —         | Layer C  | 直接按 Layer C 标准设计                                     |
| `POST /api/v1/explanations` (Planned)      | —         | Layer C  | 直接按 Layer C 标准设计                                     |
| `GET /api/v1/costs` (Planned)              | —         | Layer C  | 直接按 Layer C 标准设计                                     |

**前端消费规则**：

- 前端 `api-client/endpoints/*.ts` 中每个函数必须声明其目标端点的 Layer 级别
- Layer A/B 端点在代码中标注 `@internal`，禁止在 feature 模块中直接引用
- 若 feature 模块需要 Layer A/B 数据，必须通过 `mock-server` 提供临时 mock，并在 backlog 中创建"升级到 Layer C"的 story
- Phase 1 Gate 0 前置条件增加：所有 Phase 1 消费的端点必须达到 Layer C

### 5.2.4 Internal → Contracted 升级清单（API Graduation Matrix） _(v3.0 新增)_

前端不应长期停留在 Internal surface 上。下表跟踪每个 Layer A/B 数据源的升级状态，明确升级到 Layer C 所需的前置条件和目标里程碑。

| Source Service                    | Route / Method                    | Current Layer | Target Layer | Required Schema                               | Required Auth Model          | Required Versioning | Required Tests                      | Target Milestone | Status    |
| --------------------------------- | --------------------------------- | ------------- | ------------ | --------------------------------------------- | ---------------------------- | ------------------- | ----------------------------------- | ---------------- | --------- |
| `MissionControlService`           | `.getSnapshot()`                  | A             | C            | `MissionControlSnapshotDTO` (JSON Schema)     | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 1   | Pending   |
| `MissionControlService`           | `.getTaskCockpit()`               | A → C (done)  | C            | —                                             | —                            | —                   | —                                   | —                | Graduated |
| `MissionControlService`           | `.getWorkflowCockpit()`           | A             | C            | `WorkflowCockpitDTO` (JSON Schema)            | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 2   | Pending   |
| `MissionControlService`           | `.getStabilityPanel()`            | A             | C            | `StabilityPanelDTO` (JSON Schema)             | Bearer JWT + RBAC L3+ (SRE)  | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `MissionControlService`           | `.getAdminTakeoverConsole()`      | A             | C            | `AdminTakeoverDTO` (JSON Schema)              | Bearer JWT + RBAC L4 (admin) | `/api/v1/`          | unit + integration + security       | Phase 2 Gate 1   | Pending   |
| `OperatorConsoleBackendService`   | `.getSnapshot()`                  | A             | C            | `OperatorSnapshotDTO` (JSON Schema)           | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `OperatorConsoleBackendService`   | `.getIncidentTimeline()`          | A             | C            | `IncidentTimelineDTO` (JSON Schema)           | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 2   | Pending   |
| `OperatorConsoleBackendService`   | `.getWorkerPanel()`               | A             | C            | `WorkerPanelDTO` (JSON Schema)                | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration                  | Phase 2 Gate 2   | Pending   |
| `OperatorConsoleBackendService`   | queue API                         | A             | C            | `QueueStatusDTO` (JSON Schema)                | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration                  | Phase 2 Gate 2   | Pending   |
| Console routes                    | `GET /console/*`                  | B             | B            | —（保持内部 HTML 入口）                       | —                            | —                   | —                                   | —                | N/A       |
| Admin routes                      | `GET /admin/v1/*` (HTML portions) | B             | B/C          | 已有 JSON 部分保持 C；HTML 部分标注 Internal  | —                            | —                   | —                                   | —                | Partial   |
| `DomainOnboardingService`         | interaction/ux/onboarding/        | A             | C            | `DomainOnboardingDTO` (JSON Schema)           | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `NLEntryService` + `IntentParser` | conversation API                  | A (Partial)   | C            | `ConversationDTO` + `IntentDTO` (JSON Schema) | Bearer JWT + RBAC L1+        | `/api/v1/`          | unit + integration + NLU regression | Phase 1 Gate 2   | Pending   |

**升级流程**：

1. **后端 API owner** 创建升级 story → 添加 JSON route + OpenAPI spec + 请求/响应 schema
2. **后端 QA** 补充 contract test + integration test
3. **架构评审** 在 Sprint Review 确认 schema 冻结 → 子标签从 `Internal` / `Partial` 更新为 `Contracted`
4. **前端团队** 从 mock-server 切换到真实端点，移除 `@internal` 标注
5. **Gate 检查** 在对应 Phase Gate 前，所有该 Gate 要求的端点必须达到 `Graduated` 状态

## 5.3 WebSocket 实时事件映射

> **改进点 A-3**：按后端实际实现分层。

### 5.3.1 已实现事件 [Implemented]（WebSocketBridge + TaskWebSocketStatusRelay）

后端 `TaskWebSocketEvent` 和 `WebSocketBridge` 已支持的事件类型：

| 后端事件类型         | 触发时机         | UI 响应                   | TanStack Query 策略                | 状态          |
| -------------------- | ---------------- | ------------------------- | ---------------------------------- | ------------- |
| `status_changed`     | 任务状态变更     | 任务卡片状态徽标更新      | `invalidateQueries(['tasks'])`     | [Implemented] |
| `progress`           | 步骤进度更新     | 步骤进度条推进            | 直接更新 cache                     | [Implemented] |
| `message_delta`      | LLM 流式输出增量 | 对话气泡实时追加文字      | 直接更新 Zustand                   | [Implemented] |
| `artifact_ready`     | 制品生成完成     | 制品卡片出现              | `invalidateQueries(['tasks', id])` | [Implemented] |
| `approval_requested` | 需要人工审批     | 审批通知弹窗 + Badge 计数 | `invalidateQueries(['approvals'])` | [Implemented] |
| `completed`          | 任务完成         | 任务卡片标记完成          | `invalidateQueries(['tasks'])`     | [Implemented] |
| `failed`             | 任务失败         | 任务卡片标记失败 + 告警   | `invalidateQueries(['tasks'])`     | [Implemented] |

### 5.3.2 需扩展事件 [Planned]（UI 需求 → 后端增强）

| UI 事件类型                  | UI 响应              | 后端扩展建议                          | 状态       | 优先级 |
| ---------------------------- | -------------------- | ------------------------------------- | ---------- | ------ |
| `approval.resolved`          | 审批卡片状态更新     | WebSocketBridge 增加审批结果广播      | [Planned]  | P1     |
| `agent.health_changed`       | Agent 健康指示灯变色 | AgentRegistry 健康变更事件            | [Planned]  | P2     |
| `incident.created`           | 全局告警横幅         | IncidentService 事件广播              | [Planned]  | P1     |
| `dashboard.metric_updated`   | 看板数值/图表刷新    | DashboardProjectionService delta push | [Planned]  | P2     |
| `panic.activated`            | 全局紧急制动蒙层     | PanicService 事件广播                 | [Planned]  | P1     |
| `hitl.intervention_required` | HITL 全屏介入面板    | HITL notification module 事件扩展     | [Planned]  | P1     |
| `nl.clarification_needed`    | NL 对话追问气泡      | NLEntryService 追问事件               | [Proposed] | P2     |
| `cost.budget_alert`          | 预算告警 Toast       | CostService 预算事件                  | [Proposed] | P3     |
| `drift.alert`                | 漂移告警通知         | DriftDetector 事件广播                | [Proposed] | P3     |

### 5.3.2.1 WSEventRouter 完整架构

```text
┌──────────────────────────────────────────────────────┐
│                 WSEventRouter                         │
│                                                      │
│  WebSocket /ws/v1/stream                             │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────┐                              │
│  │ 心跳管理器          │ 每30s ping, 45s无pong=断线   │
│  └────────────────────┘                              │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────┐                              │
│  │ 事件解析器          │ JSON → typed Event           │
│  └────────────────────┘                              │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────────────────────────────┐      │
│  │ 事件分发器                                  │      │
│  │                                            │      │
│  │  task.status_changed      → 任务缓存失效   │      │
│  │  task.step_completed      → 步骤进度更新   │      │
│  │  approval.requested       → 审批 Badge +1  │      │
│  │  approval.resolved        → 审批缓存失效   │      │
│  │  agent.health_changed     → Agent 健康更新 │      │
│  │  incident.created         → 全局告警横幅   │      │
│  │  dashboard.metric_updated → 看板数据刷新   │      │
│  │  hitl.intervention_required → HITL 弹窗    │      │
│  │  panic.activated          → 紧急制动蒙层   │      │
│  │  drift.alert              → 漂移告警通知   │      │
│  │  cost.budget_alert        → 预算告警 Toast │      │
│  │  debug.breakpoint_hit     → 调试器暂停     │      │
│  └────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

### 5.3.2.2 事件 → Query 缓存映射

| 事件类型                   | Query 缓存操作                     | UI 更新方式      |
| -------------------------- | ---------------------------------- | ---------------- |
| `task.status_changed`      | invalidate `taskKeys.list`         | 列表自动刷新     |
| `task.step_completed`      | 直接更新 `taskKeys.detail(id)`     | 进度条推进       |
| `approval.requested`       | invalidate `approvalKeys.list`     | 列表刷新 + Badge |
| `approval.resolved`        | invalidate `approvalKeys.list`     | 列表刷新         |
| `agent.health_changed`     | 直接更新 agent health field        | 健康指示灯变色   |
| `dashboard.metric_updated` | 直接更新 dashboard query data      | 图表/数值刷新    |
| `incident.created`         | 写入 RealtimeStore.activeIncidents | 全局横幅展示     |
| `panic.activated`          | 写入 RealtimeStore.panicActivated  | 全屏蒙层         |

### 5.3.2.3 紧急事件处理

以下事件优先级最高，无论当前页面状态如何都立即响应：

| 事件                            | UI 响应                                  | 优先级 |
| ------------------------------- | ---------------------------------------- | ------ |
| `panic.activated`               | 全屏红色蒙层 + 紧急制动提示              | SEV1   |
| `incident.created` (SEV1)       | 全局置顶告警横幅 + 推送通知              | SEV1   |
| `hitl.intervention_required`    | 全屏 HITL 介入面板（桌面）/ 推送（移动） | SEV2   |
| `approval.requested` (Critical) | 审批弹窗 + 声音提示 + 震动               | SEV2   |

### 5.3.3 WebSocket 连接管理

```text
连接策略：
1. 认证：JWT token 作为 ws 握手 auth 参数（与 WebSocketBridge 现有实现一致）
2. 断线重连：指数退避（1s → 2s → 4s → 8s → 16s → 30s max）+ 随机 jitter
3. 心跳保活：每 30s 发送 ping，45s 无 pong 视为断线（与 DashboardWebSocketServer 一致）
4. 多标签页：SharedWorker（Web）/ 单例连接（桌面/移动）避免重复连接
5. 离线缓冲：断线期间事件缓冲到 L4 offlineStore，重连后按序回放
6. 订阅管理：按当前页面/视图动态订阅/取消订阅事件通道，减少带宽
7. 与 gateway_streaming_contract.md 对齐：
   - chunk commit、catch-up、backlog drain 按队列压力和消息年龄自适应
   - catch-up 不打乱消息顺序
   - 不通过单帧暴力 flush 破坏可读性
```

### 5.3.4 SharedWorker WebSocket 架构（Web 端）

Web 端使用 SharedWorker 在多标签页间共享单一 WebSocket 连接，避免重复连接和带宽浪费：

```text
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Tab 1   │  │  Tab 2   │  │  Tab 3   │
│  (Tasks) │  │(Approval)│  │(Dashboard│
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │  MessagePort │  MessagePort │
     └──────────────┼──────────────┘
                    │
         ┌──────────┴──────────┐
         │    SharedWorker     │
         │                     │
         │  ┌───────────────┐  │
         │  │ WSClient      │  │  单一 WebSocket 连接
         │  │ (ws/v1/stream)│──┼──→ Platform Backend
         │  └───────┬───────┘  │
         │          │          │
         │  ┌───────┴───────┐  │
         │  │ PortRouter    │  │  按订阅分发事件到各 Tab
         │  │ Tab1→[tasks]  │  │
         │  │ Tab2→[approvals]│ │
         │  │ Tab3→[dashboard]│ │
         │  └───────────────┘  │
         └─────────────────────┘
```

| 策略          | Web (SharedWorker)                           | 桌面端              | 移动端                 |
| ------------- | -------------------------------------------- | ------------------- | ---------------------- |
| 多标签/多窗口 | SharedWorker 共享单一连接                    | 主进程单例连接      | 单例连接               |
| 后台策略      | visibilitychange → 降低推送频率              | 最小化 → 仅保留心跳 | 后台 → 断开 + FCM/APNs |
| 断线重连      | 指数退避(1s→30s) + jitter                    | 同 Web              | 同 Web                 |
| 离线缓冲      | IndexedDB 缓冲                               | SQLite 缓冲         | SQLite 缓冲            |
| Fallback      | 不支持 SharedWorker → 降级为主线程 WebSocket | N/A                 | N/A                    |

### 5.3.5 SSE Fallback

后端 `StreamBridge` 提供 SSE 端点，作为 WebSocket 不可用时的降级方案：

```text
WebSocket 不可用判断：
  - 企业代理/防火墙拦截 ws 升级
  - 3 次连接尝试均失败
  ↓
降级到 SSE（Server-Sent Events）：
  - GET /api/v1/stream (Accept: text/event-stream)
  - 事件格式与 WebSocket payload 一致
  - 丧失双向通信（操作仍通过 REST）
  ↓
SSE 也不可用：
  - 降级到 30s 轮询
  - UI 显示 "实时更新不可用" 提示
```

### 5.3.6 WebSocket 订阅域模型

UI 采用频道化订阅模型，页面进入时订阅相关频道，退出时自动取消，降低带宽与后端广播开销：

**频道分类**：

| 频道类别   | 频道格式                | 生命周期          | 事件示例                                  | 状态          |
| ---------- | ----------------------- | ----------------- | ----------------------------------------- | ------------- |
| 全局频道   | `global`                | 登录→登出         | `panic.activated`, `incident.created`     | [Implemented] |
| 任务频道   | `task:{taskId}`         | 进入详情→离开     | `status_changed`, `progress`, `completed` | [Implemented] |
| 工作流频道 | `workflow:{workflowId}` | 进入详情→离开     | `step_completed`, `workflow_finished`     | [Planned]     |
| 审批频道   | `approvals`             | 进入审批中心→离开 | `approval_requested`, `approval.resolved` | [Implemented] |
| 管理频道   | `admin:{scope}`         | 进入管理面板→离开 | `agent.health_changed`, `worker.status`   | [Planned]     |
| 看板频道   | `dashboard`             | 进入看板→离开     | `dashboard.metric_updated`                | [Planned]     |

**订阅生命周期规则**：

```text
页面进入 (useEffect mount)
  │
  ├─→ subscribe(channels[])     // 向 SharedWorker/WSManager 注册频道
  │
  ├─→ 接收事件 → 更新 TanStack Query cache / Zustand store
  │
  └─→ 页面离开 (useEffect cleanup)
        │
        └─→ unsubscribe(channels[])  // 取消频道订阅
```

**降级策略**：

| 场景                    | 行为                                                            |
| ----------------------- | --------------------------------------------------------------- |
| 后台标签页（Web）       | `visibilitychange` hidden → 保留 `global` 频道，取消页面级频道  |
| 后台标签页（桌面）      | 最小化 → 同 Web 逻辑                                            |
| 移动端进入后台          | `lifecycle.onBackground` → 断开 WS，切换为 FCM/APNs 推送        |
| 移动端恢复前台          | `lifecycle.onForeground` → 重建 WS 连接 + catch-up 拉取缺失事件 |
| 标签页超过 5 分钟未活跃 | 断开页面级频道，仅保留全局频道 + 60s 心跳                       |

## 5.4 API 通信层架构

```text
┌──────────────────────────────────────────────────┐
│              RESTClient                           │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │          Interceptor Chain                   │ │
│  │  AuthInterceptor     → JWT 自动刷新          │ │
│  │  TenantInterceptor   → tenant_id/domain 注入 │ │
│  │  RetryInterceptor    → 指数退避 + jitter     │ │
│  │  DedupeInterceptor   → 请求去重              │ │
│  │  OfflineInterceptor  → 离线排队（移动端）    │ │
│  │  TraceInterceptor    → X-Request-Id/Trace-Id │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Transport: L4 PlatformAdapter.fetch()           │
│  (Web=fetch / Electron=net / Tauri=reqwest /     │
│   RN=fetch)                                      │
└──────────────────────────────────────────────────┘
```

### 5.4.1 RESTClient 核心接口 `[Planned]`

> _提取自 Doc-11 §6.1.1 — RESTClient 设计_

```typescript
interface RESTClient {
  get<T>(path: string, params?: QueryParams): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}
```

Transport 层通过依赖注入，由 L4 `PlatformAdapter.fetch()` 提供具体实现。RESTClient 本身不直接调用 `fetch`。

### 5.4.2 WebSocket Client 接口 `[Planned]`

> _提取自 Doc-11 §6.1.2 — WebSocket Client 设计。与 §5.3 WebSocket 层形成互补：§5.3 定义频道模型与订阅域，本节定义客户端编程接口。_

```text
连接生命周期：
  DISCONNECTED → CONNECTING → CONNECTED → SUBSCRIBED
       ↑              │            │           │
       └──────────────┴── 断线 ────┘           │
                              ↑                │
                              └── 心跳超时 ────┘
重连策略：
  delay = min(baseDelay × 2^attempt + jitter, maxDelay)
  baseDelay = 1000ms, maxDelay = 30000ms, jitter = random(0, 1000)
```

```typescript
interface WSClient {
  connect(url: string, token: string): void;
  disconnect(): void;
  subscribe(channel: string, handler: EventHandler): Unsubscribe;
  onStatusChange(handler: (status: WSStatus) => void): Unsubscribe;
}

type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting";
```

### 5.4.3 Endpoint 函数模式 `[Planned]`

> _提取自 Doc-11 §6.1.3 — 每个 API 端点封装为独立函数，返回 TanStack Query 兼容配置。_

```typescript
// endpoints/tasks.ts
export const taskKeys = {
  all: ["tasks"] as const,
  list: (filters: TaskFilters) => ["tasks", "list", filters] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
};

export function fetchTasks(client: RESTClient, filters: TaskFilters) {
  return client.get<PaginatedResponse<Task>>("/api/v1/tasks", filters);
}

export function createTask(client: RESTClient, spec: TaskSpec) {
  return client.post<Task>("/api/v1/tasks", spec);
}
```

**规则**：

- 一个端点 = 一个函数 + 对应的 query key factory
- 函数接收 `RESTClient` 实例（便于测试 mock）
- 返回类型与后端 OpenAPI spec 对齐（参见 附录 A）

### 5.4.4 认证流程与 Token 管理 `[Planned]`

> _提取自 Doc-11 §6.2 — Auth Module。与 §6.5 安全架构互补：§6.5 定义安全策略，本节定义客户端认证实现流程。_

```text
App 启动
  │
  ├─ 检查 SecureStorage 中是否有 refresh_token
  │    ├─ 有 → 尝试静默刷新 access_token
  │    │    ├─ 成功 → 进入 Authenticated 状态
  │    │    └─ 失败 → 跳转登录页
  │    └─ 无 → 跳转登录页
  │
  登录页
  ├─ SSO (OIDC) → 系统浏览器 OAuth2 PKCE 流程 → 回调获取 tokens
  ├─ SSO (SAML) → 系统浏览器 SAML 流程 → 回调获取 tokens
  └─ API Key → 直接输入（仅开发模式/CLI 模式）
  │
  tokens 存入 L4 SecureStorage → 进入 Authenticated 状态
```

| 策略     | 说明                                                                  |
| -------- | --------------------------------------------------------------------- |
| 自动刷新 | access_token 过期前 60s 触发静默刷新，无感知                          |
| 刷新锁   | 并发请求发现 token 过期时，仅第一个触发刷新，其余排队等待             |
| 刷新失败 | 返回 401 → 清除本地 token → 重定向登录页 → 保存当前路由以便登录后恢复 |
| 多设备   | 支持查看活跃会话列表 → 选择性撤销                                     |
| 二次认证 | 高风险操作（审批 Critical、修改安全设置）触发生物识别/密码二次验证    |

### 5.4.5 离线队列与同步协调器 `[Planned]`

> _提取自 Doc-11 §6.3 — Sync Engine。与 §5.5 离线架构互补：§5.5 定义离线分层策略，本节定义队列记录结构与冲突解决。_

**队列记录结构**：

| 字段             | 类型        | 说明                                                     |
| ---------------- | ----------- | -------------------------------------------------------- |
| `id`             | ULID        | 全局唯一标识                                             |
| `method`         | HTTP Method | POST / PUT / PATCH / DELETE                              |
| `path`           | string      | API 路径，如 `/api/v1/tasks`                             |
| `body`           | JSON        | 请求体                                                   |
| `idempotencyKey` | string      | 幂等键，防止重复提交                                     |
| `createdAt`      | ISO-8601    | 创建时间                                                 |
| `retryCount`     | number      | 当前重试次数                                             |
| `status`         | enum        | `pending` / `syncing` / `synced` / `conflict` / `failed` |

**SyncCoordinator 恢复流程**：成功 → `synced` → 通知 UI ｜ 409 → `conflict` → 冲突解决 UI ｜ 500 → 重试（max 3）→ `failed` → 通知用户。

**冲突解决策略**：

| 数据类型       | 策略                                                     |
| -------------- | -------------------------------------------------------- |
| 任务创建       | 无冲突（幂等键保护）                                     |
| 审批决策       | 服务端优先（先到先得），冲突时通知用户"审批已被他人处理" |
| 配置变更       | 服务端优先 + CAS 版本号检查，冲突时展示双栏 diff         |
| Agent 状态变更 | 服务端优先，冲突时通知用户刷新后重试                     |

### 5.4.6 分页与过滤标准化

所有列表接口统一使用后端的 cursor-based 分页：

```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  totalCount?: number;
}

interface QueryParams {
  cursor?: string;
  limit?: number; // 默认 20，最大 100
  status?: string;
  tenantId?: string;
  domainId?: string;
  sort?: string; // "created_at:desc"
  createdAfter?: string;
  createdBefore?: string;
}
```

TanStack Query 的 `useInfiniteQuery` 映射 cursor 分页：

```text
useInfiniteQuery({
  queryKey: taskKeys.list(filters),
  queryFn: ({ pageParam }) => fetchTasks(client, { ...filters, cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

## 5.5 离线与同步架构

> **改进点 D-1**：明确 Web 端离线三层策略。

### 5.5.1 Web 端离线三层策略

| 层次            | 技术                               | 缓存内容                          | 策略                                   |
| --------------- | ---------------------------------- | --------------------------------- | -------------------------------------- |
| L1 静态资源缓存 | Service Worker Cache               | JS/CSS/图片/字体                  | Cache-First，版本化 hash               |
| L2 API 响应缓存 | TanStack Query persist + IndexedDB | 任务列表/审批列表/看板快照        | Network-First + Stale-While-Revalidate |
| L3 操作队列     | IndexedDB (offline-queue)          | 待发送的操作（approve/cancel 等） | FIFO 队列，连接恢复后按序重放          |

**关键约束**：

- L2 缓存数据不含 PII（参见 `00-platform-architecture.md` 数据分类策略）
- L3 队列中的操作带 idempotency key，防止重复提交
- Service Worker 与 TanStack Query 职责分离：SW 管静态资源，TQ 管 API 数据

### 5.5.2 桌面端离线策略

| 平台    | 离线存储                             | 同步机制                          |
| ------- | ------------------------------------ | --------------------------------- |
| Windows | SQLite (better-sqlite3) via Electron | Electron 主进程定时同步 + WS push |
| macOS   | SQLite (rusqlite) via Tauri          | Tauri Rust 后端定时同步 + WS push |
| Linux   | SQLite (rusqlite) via Tauri          | 同 macOS                          |

### 5.5.3 移动端离线策略

| 平台    | 离线存储      | 后台同步                              | 冲突解决                   |
| ------- | ------------- | ------------------------------------- | -------------------------- |
| Android | SQLite (Room) | WorkManager 后台任务 + FCM 唤醒       | Last-Write-Wins + 用户选择 |
| iOS     | SQLite (GRDB) | BackgroundTasks framework + APNs 唤醒 | 同 Android                 |

### 5.5.4 冲突解决策略

```text
冲突检测：
  - 操作携带 version_vector（基于 MissionControlService 快照版本）
  - 服务端返回 409 Conflict 时触发冲突解决流程

冲突解决优先级：
  1. 自动合并：非冲突字段各自保留（如同时修改不同 task 的不同字段）
  2. Last-Write-Wins：低风险操作（查看、标记已读）
  3. 用户选择：高风险操作（审批、取消、接管）弹出冲突面板
  4. 服务端权威：涉及 authoritative 状态的操作始终以服务端为准
```

### 5.5.5 离线存储容量规划

| 数据类型     | 存储方式                        | 容量限制 | 过期策略        |
| ------------ | ------------------------------- | -------- | --------------- |
| 用户配置     | SecureStorage / AsyncStorage    | 1MB      | 永久            |
| 任务列表缓存 | SQLite / IndexedDB              | 50MB     | 30 天未访问清理 |
| 看板快照     | SQLite / IndexedDB              | 10MB     | 24h             |
| 操作队列     | SQLite / IndexedDB              | 20MB     | 同步后清理      |
| 翻译文件     | 文件系统                        | 5MB      | 版本更新时替换  |
| 离线 NL 模型 | 文件系统（仅 Edge-Mobile 场景） | 500MB    | 手动更新        |

**容量监控**：L3 sync-store 跟踪各类存储使用量，超过阈值时自动触发 LRU 淘汰并通过 Toast 通知用户。

### 5.5.6 离线操作许可矩阵

并非所有操作都允许离线排队。以下矩阵定义每类操作的离线行为：

| 操作类别                   | 离线排队 | 乐观更新 | 恢复后自动重放 | 冲突策略                  | 说明                                  |
| -------------------------- | -------- | -------- | -------------- | ------------------------- | ------------------------------------- |
| 标记已读                   | ✅       | ✅       | ✅             | Last-Write-Wins           | 幂等操作，无冲突风险                  |
| 任务备注/评论              | ✅       | ✅       | ✅             | 追加合并                  | 离线评论追加到时间线末尾              |
| 审批操作（approve/reject） | ❌       | ❌       | N/A            | N/A                       | 审批有时效性，离线时显示"需联网操作"  |
| 任务取消                   | ⚠️       | ❌       | ⚠️ 需确认      | 用户选择                  | 排队但不乐观更新，恢复后弹窗确认      |
| Admin Takeover             | ❌       | ❌       | N/A            | N/A                       | 紧急操作必须在线执行                  |
| Panic 紧急制动             | ❌       | ❌       | N/A            | N/A                       | 必须在线，离线时提示无法执行          |
| 创建新任务                 | ✅       | ✅       | ✅             | 服务端分配 ID 替换临时 ID | 乐观生成临时 ID，同步后替换           |
| 修改任务配置               | ⚠️       | ✅       | ⚠️ 版本检查    | 版本冲突 → 用户选择       | 携带 version_vector，409 时弹冲突面板 |
| 查看/浏览（只读）          | ✅       | N/A      | N/A            | 使用 stale cache          | 显示缓存数据 + "离线数据，可能过期"   |
| Marketplace 安装           | ❌       | ❌       | N/A            | N/A                       | 需要下载资源，必须在线                |
| 导出报表                   | ⚠️       | ❌       | ✅             | 排队，恢复后执行并通知    | 生成可能耗时，排队到在线后执行        |

**UI 提示规范**：

- 禁止离线的操作：按钮显示为 disabled + tooltip "需要网络连接"
- 允许排队的操作：按钮正常可用，点击后显示 "已加入离线队列（第 N 位）"
- 需确认的操作：恢复在线时弹出确认对话框 "以下操作在离线期间排队，是否继续执行？"

## 5.6 前端错误分级与降级策略

### 5.6.1 错误分级

| 级别   | 错误类型                            | 影响范围       | UI 表现                                              | 自动恢复    |
| ------ | ----------------------------------- | -------------- | ---------------------------------------------------- | ----------- |
| **P0** | 认证失败 / Token 无法刷新           | 全局           | 强制跳转登录页 + 清除本地状态                        | ❌          |
| **P1** | API 服务不可达（全部端点 5xx/超时） | 全局           | 全局 banner "服务暂时不可用" + 只读 stale cache 模式 | ✅ 30s 重试 |
| **P2** | WebSocket 连接断开                  | 实时更新       | 状态栏 "实时更新不可用" + 自动降级 SSE/轮询          | ✅ 指数退避 |
| **P3** | 单个 API 端点失败（4xx/5xx）        | 单页面/模块    | 模块级错误卡片 "加载失败，点击重试" + telemetry 上报 | ✅ 用户触发 |
| **P4** | DomainUIConfig 加载失败             | 域相关页面     | 使用默认配置 + Toast "域配置加载失败，使用默认设置"  | ✅ 后台重试 |
| **P5** | Feature flag 不一致                 | 单功能         | 隐藏不确定状态的功能 + 日志上报                      | ✅ 下次刷新 |
| **P6** | Contract version mismatch           | 潜在兼容性问题 | 持久 banner 警告 + telemetry 上报 + 功能不阻断       | ❌ 需升级   |
| **P7** | Stale cache 展示                    | 数据时效性     | 数据卡片角标 "缓存数据" + 上次更新时间               | ✅ 自动     |

### 5.6.2 降级行为矩阵

| 故障场景                    | 即时降级行为                  | 持续降级行为（>60s）               | 恢复行为                          |
| --------------------------- | ----------------------------- | ---------------------------------- | --------------------------------- |
| REST API 全部不可达         | stale cache 只读 + 禁用写操作 | 全局 Error Boundary + 离线模式提示 | 自动 revalidate 全部 active query |
| REST API 部分端点异常       | 受影响模块显示 ErrorCard      | ErrorCard + 后台 30s 重试          | 成功后自动刷新该模块              |
| WebSocket 断开              | 降级为 SSE                    | SSE 也失败 → 降级为 30s 轮询       | WS 恢复后自动切回 + catch-up      |
| DomainUIConfig 缺失         | 默认 config fallback          | 不变                               | 后台周期性重试，成功后热替换      |
| Feature flag 服务不可达     | 使用上次缓存的 flag 值        | 不变                               | 恢复后静默更新                    |
| Contract version 不匹配     | 持久 banner + 正常功能        | 不变                               | 检测到版本修复后移除 banner       |
| IndexedDB / SQLite 写入失败 | 降级为内存缓存 + Toast 警告   | 尝试清理过期数据后重试             | 恢复后回写内存数据到持久层        |

### 5.6.3 Error Boundary 策略

```text
App ErrorBoundary（P0/P1 级 → 全局错误页）
  └─ Layout ErrorBoundary（导航仍可用）
       └─ Page ErrorBoundary（P3 级 → 页面级 ErrorCard）
            └─ Widget ErrorBoundary（P4-P7 级 → 组件级 fallback）
```

### 5.6.4 Mutation 幂等与重试规范 _(v2.3 新增)_

写操作（Mutation）的幂等性和重试语义直接影响数据一致性和用户体验。以下规范定义每类关键写操作的行为。

#### Mutation 行为矩阵

| 操作                     | 幂等性         | Idempotency Key  | 前端防重复提交          | 失败后可重试 | 重试方式      | 失败后 UI 状态   |
| ------------------------ | -------------- | ---------------- | ----------------------- | ------------ | ------------- | ---------------- |
| 创建任务                 | ✅ 幂等（key） | `ULID`           | 点击后 disable 5s       | ✅           | 自动重试 ×3   | 恢复为未提交     |
| 取消任务                 | ✅ 幂等        | `task_id`        | 点击后 disable 直到响应 | ✅           | 手动重试按钮  | 恢复为取消前状态 |
| 审批 approve             | ✅ 幂等        | `approval_id`    | 点击后 disable 直到响应 | ⚠️ 条件      | 仅 5xx 可重试 | 恢复为待审批     |
| 审批 reject              | ✅ 幂等        | `approval_id`    | 点击后 disable 直到响应 | ⚠️ 条件      | 仅 5xx 可重试 | 恢复为待审批     |
| 审批 delegate            | ✅ 幂等        | `approval_id+to` | 点击后 disable 直到响应 | ✅           | 手动重试      | 恢复为待审批     |
| Admin Takeover           | ❌ 非幂等      | N/A              | 双人确认 + disable      | ❌           | 禁止自动重试  | 显示失败原因     |
| Panic 紧急制动           | ✅ 幂等        | singleton        | 双人确认 + disable      | ✅           | 手动重试      | 显示制动失败告警 |
| Marketplace 安装         | ✅ 幂等（key） | `pack_id+ver`    | 进度条 + disable        | ✅           | 自动重试 ×2   | 恢复为未安装     |
| 域配置修改               | ⚠️ CAS         | `domain_id+ver`  | 点击后 disable 直到响应 | ⚠️ 条件      | 409→用户选择  | 显示冲突 diff    |
| Worker 管理（切换/停止） | ❌ 非幂等      | N/A              | 确认弹窗 + disable      | ❌           | 禁止自动重试  | 显示失败原因     |
| 任务备注/评论            | ✅ 幂等（key） | `ULID`           | 乐观追加 + disable      | ✅           | 自动重试 ×3   | 标记为"发送失败" |
| 导出报表                 | ✅ 幂等        | `export_id`      | 进度条                  | ✅           | 自动重试 ×2   | 通知用户导出失败 |

#### Idempotency Key 规范

```typescript
interface MutationOptions {
  idempotencyKey: string;
  retryPolicy: RetryPolicy;
  optimisticUpdate?: (cache: QueryCache) => void;
  rollback?: (cache: QueryCache) => void;
  disableUntilSettled: boolean;
}

interface RetryPolicy {
  maxRetries: number;
  retryOn: number[];
  backoff: "none" | "linear" | "exponential";
  baseDelay: number;
}
```

**规则**：

- 所有 POST/PUT/PATCH/DELETE 请求必须携带 `X-Idempotency-Key` 请求头
- Key 生成策略：`ULID`（创建类操作）或 `资源ID+版本号`（更新类操作）或 `singleton`（全局唯一操作）
- 前端 `RESTClient` interceptor 自动注入 idempotency key
- 后端返回 `409 Conflict` 时，前端禁止自动重试，必须进入冲突解决流程
- 后端返回 `429 Too Many Requests` 时，前端按 `Retry-After` header 延迟重试
- 防重复提交：mutation 触发后，对应按钮立即 `disabled`，直到请求 settled（成功或最终失败）

### 5.6.5 乐观更新模式

关键写操作使用乐观更新提升体验：

| 操作       | 乐观更新策略                         | 回滚策略                     |
| ---------- | ------------------------------------ | ---------------------------- |
| 创建任务   | 立即在列表头部插入 optimistic item   | 移除 optimistic item + Toast |
| 审批决策   | 立即移出待审批列表 + 更新 Badge 计数 | 恢复到待审批 + 错误提示      |
| Agent 状态 | 立即更新状态标签                     | 恢复原状态 + 错误提示        |
| 配置变更   | 立即更新配置展示                     | 恢复原配置 + 错误提示        |

### 5.6.6 HTTP 状态码 → UI 行为映射

```text
API 响应错误
  │
  ├─ 401 Unauthorized → 触发 Token 刷新 → 重试 → 仍 401 → 重定向登录
  ├─ 403 Forbidden → Toast "权限不足" + 禁用相关按钮
  ├─ 404 Not Found → 跳转 404 页面或 Toast "资源不存在"
  ├─ 409 Conflict → 展示冲突解决 UI（CAS 版本冲突）
  ├─ 422 Validation → 表单字段级错误提示
  ├─ 429 Too Many Requests → Toast "操作过于频繁" + 自动退避重试
  └─ 5xx Server Error → Toast "服务器错误" + 自动重试（最多 2 次）
```

---

# Part V — 平台治理

---

# 6. 域差异化、多租户、安全与设计系统

> **改进点 D-2、R-3**：定义 DomainUIConfig 消费协议与后端对齐；合并认证/安全章节。

## 6.1 24 域差异化 UI 引擎

> **改进点 D-2**：明确 DomainUIConfig 如何从后端 DomainDescriptor 派生。

### 6.1.1 DomainUIConfig 消费协议

```text
后端 DomainDescriptor（参见 00-platform-architecture.md 域描述符）
    │
    │  GET /admin/v1/domains/{id}
    ▼
前端 DomainUIConfigResolver
    │
    ├── 读取 DomainDescriptor.risk_level → 映射 riskDisplayMode
    ├── 读取 DomainDescriptor.domain_type → 映射 dashboardPanels 模板
    ├── 读取 DomainDescriptor.hitl_policy → 映射 hitlEnhanced
    ├── 读取 DomainDescriptor.compliance_flags → 映射 complianceExtensions
    └── 合并 domainId → icon/color（从 design-tokens/domain.ts 查找）
    │
    ▼
DomainUIConfig（前端运行时配置对象）
```

### 6.1.2 DomainUIConfig 类型定义

```typescript
interface DomainUIConfig {
  domainId: string;
  icon: string;
  color: string;
  riskDisplayMode: "standard" | "enhanced";
  hitlEnhanced: boolean;
  dashboardPanels: PanelConfig[];
  taskCardExtensions: ExtensionSlot[];
  approvalTemplate: string;
  realtimeIndicators: IndicatorConfig[];
  complianceExtensions: ComplianceExtConfig[];

  // [Planned] v2.2 新增：域级功能可见性
  featureVisibility: Record<string, boolean>;

  // [Planned] v2.2 新增：动作级策略
  actionPolicy: Record<string, ActionPolicyEntry>;

  // [Planned] v2.2 新增：默认下钻深度
  defaultDrillDepth: 1 | 2 | 3 | 4 | 5;

  // [Planned] v2.2 新增：域术语替换
  glossaryOverrides: Record<string, string>;
}

interface PanelConfig {
  id: string;
  title: string;
  component: string;
  gridSpan: 1 | 2 | 3 | 4;
  dataSource: string;
  refreshInterval: number;
}

interface ExtensionSlot {
  position: "header" | "body" | "footer";
  component: string;
  visibleWhen?: string;
}

interface ActionPolicyEntry {
  action: "allow" | "confirm" | "approval_required" | "hidden";
  confirmMessage?: string;
  approvalWorkflow?: string;
}
```

### 6.1.2.1 DomainUIConfig 扩展字段说明

| 字段                | 类型                           | 状态      | 说明                                                                                          |
| ------------------- | ------------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| `featureVisibility` | `Record<string, boolean>`      | [Planned] | 域级功能隐藏开关。键为 feature 路由名（如 `"workflow-builder"`），值为是否可见                |
| `actionPolicy`      | `Record<string, ActionPolicy>` | [Planned] | 动作级二次确认/审批策略。键为动作标识（如 `"task.cancel"`），值定义是否需确认、审批或隐藏     |
| `defaultDrillDepth` | `1 \| 2 \| 3 \| 4 \| 5`        | [Planned] | 该域下页面默认展开的下钻深度，用户可手动展开至权限允许的最大深度                              |
| `glossaryOverrides` | `Record<string, string>`       | [Planned] | 域术语替换映射。键为平台通用术语（如 `"Task"`），值为域专属术语（如量化交易域的 `"Strategy"`) |

**featureVisibility 示例**：

```json
{
  "workflow-builder": false,
  "workflow-debugger": false,
  "marketplace": true,
  "cost-center": true,
  "explainability": true
}
```

**actionPolicy 示例**（金融服务域）：

```json
{
  "task.cancel": {
    "action": "approval_required",
    "approvalWorkflow": "finance-cancel-review"
  },
  "task.create": {
    "action": "confirm",
    "confirmMessage": "此操作将触发实盘交易流程，确认继续？"
  },
  "admin.takeover": { "action": "hidden" }
}
```

**glossaryOverrides 示例**（量化交易域）：

```json
{
  "Task": "Strategy",
  "Workflow": "Pipeline",
  "Agent": "Trading Bot",
  "Approval": "Risk Review",
  "Domain": "Trading Desk"
}
```

### 6.1.3 域分级 UI 差异

| 域风险等级 | UI 差异                                                                          | 示例域                           |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------- |
| Critical   | 所有操作需二次确认；风险面板默认展开；审批卡片含完整风险评估；紧急联系人始终可见 | 量化交易、金融服务、医疗健康     |
| High       | 写操作需确认；风险徽标突出；审批含风险摘要；成本预警阈值降低                     | 法务、财务、电商定价、IT 运维    |
| Medium     | 标准 UI；风险徽标常规展示；审批流程标准                                          | 广告推广、客服、内容审核、供应链 |
| Low        | 简化 UI；可隐藏风险面板；审批可选批量处理                                        | 数据分析、企业知识库、用户运营   |

### 6.1.4 域专属 UI 扩展点（示例）

| 域       | 扩展组件                                                    | 说明                                   |
| -------- | ----------------------------------------------------------- | -------------------------------------- |
| 量化交易 | PositionPanel, PnLChart, RiskGauge                          | 持仓面板、盈亏曲线、VaR/CVaR 仪表盘    |
| 电商     | OrderTimeline, PriceCompare, InventoryHeatmap               | 订单时间线、价格对比、库存热力图       |
| 广告推广 | CampaignDashboard, BudgetBurndown, CreativePreview          | 投放看板、预算消耗、素材预览           |
| 金融服务 | ComplianceChecklist, AuditTrail, RegulatoryReport           | 合规清单、审计轨迹、监管报表           |
| 客服     | ConversationView, CSATChart, EscalationQueue                | 对话视图、满意度图、升级队列           |
| 医疗健康 | PatientTimeline, PhysicianReviewPanel, DrugInteractionAlert | 患者时间线、医师审核面板、药物交互告警 |

### 6.1.5 域扩展 Slot 模式与动态加载

功能模块预留插槽（Slot），域配置决定填充内容：

```text
TaskDetailPage
  ├── [固定区域] 任务基本信息
  ├── [Slot: domain-task-header] ← 域专属头部扩展
  ├── [固定区域] 步骤列表
  ├── [Slot: domain-task-detail] ← 域专属详情扩展
  └── [固定区域] 操作按钮栏

扩展组件注册：
  quant-trading → PositionPanel, PnLChart, RiskGauge
  ecommerce     → OrderTimeline, PriceCompare
  advertising   → CampaignDashboard, BudgetBurndown
  healthcare    → PatientTimeline, DrugInteractionAlert
  coding        → CodeDiffViewer, PRTimeline, CIStatus
```

域扩展组件通过动态 import 按需加载，不增加初始包体积：

```text
DomainExtensionLoader
  │
  ├─ 获取当前 domainId
  ├─ 查询 DomainUIConfig
  ├─ 动态 import(`@aa/domain-extensions/${domainId}/${slot}`)
  └─ 渲染到 Slot 位置（Suspense + Skeleton fallback）
```

## 6.2 多租户 UI 架构

### 6.2.1 租户上下文

```text
用户登录
    │
    ▼
TenantContextProvider
    ├── tenantId（从 JWT 解析）
    ├── tenantConfig（主题色、Logo、功能开关）
    ├── orgTree（组织架构树，参见 `00-platform-architecture.md` 组织模型）
    ├── featureFlags（租户级功能开关）
    └── complianceMode（GDPR/SOX/HIPAA 影响 UI 展示）
```

### 6.2.2 租户级 UI 定制

| 定制维度 | 定制能力                                                 | 配置方式                                |
| -------- | -------------------------------------------------------- | --------------------------------------- |
| 品牌     | Logo、主色调、登录页背景、浏览器标签图标                 | Admin API → 租户配置                    |
| 功能     | 功能模块开关（如隐藏 Marketplace、禁用 NL 入口）         | 租户 featureFlags                       |
| 看板     | 自定义 L1/L2 看板面板排列和可见性                        | 用户级 + 租户级配置合并                 |
| 合规     | GDPR 模式下隐藏/脱敏特定字段；SOX 模式下强制审计轨迹可见 | complianceMode 自动驱动                 |
| 语言     | 默认语言、可用语言列表                                   | 租户配置                                |
| 模式     | 单人模式 vs 企业模式（参见 §6.2 多租户 UI 架构）         | 自动检测（用户数 ≤ 1 → 单人）+ 手动覆盖 |

### 6.2.3 数据隔离策略

| 维度     | 实现                                      |
| -------- | ----------------------------------------- |
| API 隔离 | 所有请求自动注入 `X-Tenant-Id` header     |
| 缓存隔离 | TanStack Query key 前缀包含 tenantId      |
| 存储隔离 | 离线存储 key 前缀包含 tenantId            |
| 租户切换 | 切换时清空所有缓存和离线数据 → 重新初始化 |

## 6.3 设计系统

### 6.3.1 设计令牌

> _v2.2 补充：增加 `primitive.ts` 原始色板（提取自 Doc-11 §15.1）_

```text
tokens/
  color/
    primitive.ts       # 原始色板：slate-50..slate-950, blue, green, amber, red 等
    semantic.ts        # 语义色：success/warning/error/info/neutral
    risk-level.ts      # 风险色：low(green-500)/medium(amber-500)/high(orange-500)/critical(red-600)
    autonomy-level.ts  # 自主权色：suggestion(blue)/supervised(teal)/semi-auto(purple)/full-auto(green)
    status.ts          # 状态色：pending/running/paused/completed/failed/aborted
    domain.ts          # 24 域识别色（每域一个主色调 + 浅色背景色）
  spacing.ts           # 4px 基准网格：xs(4)/sm(8)/md(16)/lg(24)/xl(32)/xxl(48)
  typography.ts        # 字体阶梯：caption(12)/body(14)/subtitle(16)/title(20)/headline(24)/display(32)
  elevation.ts         # 层叠：0(flat)/1(card)/2(dropdown)/3(modal)/4(toast)/5(overlay)
  animation.ts         # 动画时长：fast(100ms)/normal(200ms)/slow(300ms)/easing: ease-in-out
  breakpoint.ts        # 响应式：sm(640)/md(768)/lg(1024)/xl(1280)/2xl(1440)
  border-radius.ts     # 圆角：none/sm(4)/md(8)/lg(12)/xl(16)/full(9999)
```

### 6.3.2 核心组件库

| 组件类别 | 组件列表                                                                                    | 平台支持                         |
| -------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| 基础     | Button, IconButton, Link, Badge, Tag, Avatar, Tooltip                                       | 全平台                           |
| 输入     | TextField, TextArea, Select, Checkbox, Radio, Switch, Slider, DatePicker, FileUpload        | 全平台                           |
| 数据展示 | Table, List, Card, Tree, Timeline, Stat, Progress, Skeleton                                 | 全平台                           |
| 反馈     | Toast, Alert, Modal, Drawer, Popover, Spinner, EmptyState                                   | 全平台                           |
| 导航     | Sidebar, TopBar, Tabs, Breadcrumb, Pagination, CommandPalette                               | 全平台（移动端适配）             |
| 图表     | LineChart, BarChart, PieChart, Heatmap, Gauge, Sparkline                                    | 全平台（ECharts/Victory Native） |
| 业务     | TaskCard, ApprovalCard, AgentHealthIndicator, RiskBadge, AutonomyBadge, CostMeter, NLBubble | 全平台                           |
| 复合     | WorkflowCanvas, DebugTimeline, OapeflirPanel, DagViewer, DiffViewer                         | Web + 桌面                       |

**组件开发规范** _(v2.2 新增，提取自 Doc-11 §15.2)_ `[Planned]`：

| 维度   | 规范                                                            |
| ------ | --------------------------------------------------------------- |
| 命名   | PascalCase 组件名；kebab-case 文件名                            |
| Props  | TypeScript interface 定义；必填/可选标注清晰                    |
| 文档   | 每个组件配 Storybook story（至少：Default / Variants / States） |
| 测试   | 每个组件配 Vitest 单元测试（渲染 + 交互 + 快照）                |
| 无障碍 | 必须包含 aria-label / role；键盘导航；焦点管理                  |
| 主题   | 通过 CSS 变量 / RN StyleSheet 动态响应主题切换                  |

### 6.3.3 主题系统

| 主题          | 说明                                                   | 切换方式            |
| ------------- | ------------------------------------------------------ | ------------------- |
| Light         | 默认浅色主题                                           | 用户设置 / 跟随系统 |
| Dark          | 深色主题（OLED 友好）                                  | 用户设置 / 跟随系统 |
| High Contrast | 高对比度主题（WCAG AAA）                               | 无障碍设置          |
| 企业自定义    | 支持覆盖主色调、Logo、字体（参见 §6.2 多租户 UI 架构） | 租户级配置          |

实现方式：

- Web/桌面：CSS Custom Properties + `prefers-color-scheme` 媒体查询
- React Native：`useColorScheme` hook + StyleSheet 动态切换
- 所有图表颜色不作为唯一信息载体（WCAG：搭配形状/标签）

**暗色模式设计规则**：

| 规则       | 说明                                    |
| ---------- | --------------------------------------- |
| 背景色层级 | 暗色用 elevation 而非投影区分层级       |
| 文字对比度 | 正文 ≥ 7:1 (AAA)；辅助文字 ≥ 4.5:1 (AA) |
| 图表颜色   | 不仅靠颜色区分数据系列，搭配形状/标签   |
| 状态色     | 暗色下调高饱和度，保证可辨识            |
| 图片/截图  | 加 1px 深色边框防止与背景融合           |

### 6.3.4 图标系统

| 层级     | 说明                                             |
| -------- | ------------------------------------------------ |
| 系统图标 | Lucide Icons（MIT，1000+ 图标，React/RN 兼容）   |
| 域图标   | 24 个业务域各有专属图标（SVG，尺寸 16/20/24/32） |
| 状态图标 | 任务/Agent/审批状态统一图标集                    |
| 风险图标 | 风险等级图标（shield 系列，颜色编码）            |

## 6.4 国际化与无障碍

### 6.4.1 i18n 实现

| 层级      | 实现方式                                                                |
| --------- | ----------------------------------------------------------------------- |
| UI 文案   | ICU MessageFormat（react-intl / react-native-intl）；Key-Value 翻译文件 |
| 日期/时间 | Intl.DateTimeFormat（按 locale 自动格式化）                             |
| 数字/货币 | Intl.NumberFormat（ICU 格式）                                           |
| 相对时间  | Intl.RelativeTimeFormat                                                 |
| NL 对话   | 用户输入语言自动检测 → 响应语言跟随                                     |
| RTL 支持  | CSS logical properties（阿拉伯语/希伯来语方向自适应）                   |

### 6.4.2 语言优先级

| 优先级 | 语言             | Phase   |
| ------ | ---------------- | ------- |
| P0     | 中文简体 (zh-CN) | Phase 1 |
| P0     | 英语 (en-US)     | Phase 1 |
| P1     | 中文繁体 (zh-TW) | Phase 2 |
| P1     | 日语 (ja-JP)     | Phase 2 |
| P2     | 韩/德/法         | Phase 3 |

**翻译工作流**：

```text
开发者写 defaultMessage (en-US)
  → CI 自动提取 message keys
  → 上传翻译平台 (Crowdin/Phrase)
  → 翻译团队翻译 + Review
  → CI 自动拉取翻译文件
  → 构建时打包（按 locale 拆分，lazy load）
  → 运行时按 locale 加载对应翻译包
```

### 6.4.3 无障碍（WCAG 2.1 AA）

| 维度     | 要求                                                 |
| -------- | ---------------------------------------------------- |
| 键盘导航 | 所有功能可通过键盘完成；焦点顺序符合逻辑；焦点环可见 |
| 屏幕阅读 | 所有交互元素有 aria-label；动态内容用 aria-live      |
| 色彩对比 | 文字对比度 ≥ 4.5:1；大字 ≥ 3:1；非文字 ≥ 3:1         |
| 图表替代 | 所有图表提供表格替代视图；颜色不作为唯一信息载体     |
| 动画安全 | 尊重 prefers-reduced-motion；闪烁频率 < 3Hz          |
| 触摸目标 | 移动端触摸目标 ≥ 44x44 dp                            |

#### 6.4.3.1 复杂 UI 组件无障碍专项指南 _(v3.0 新增)_

| 组件                        | 键盘交互                                                                                          | 屏幕阅读器                                                                                                                      | 降级方案                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 权限矩阵编辑器 (§4.6.13)    | 方向键移动单元格焦点；Space 切换 checkbox；Enter 编辑下拉；Tab 跳至下一行首列；Esc 取消编辑       | 每个单元格 `aria-label="{角色} 对 {页面} 的 {权限类型}：{当前值}"`；变更后 `aria-live="polite"` 播报                            | 超过 10 列时提供"列表视图"替代（每行一个角色-权限卡片） |
| ECharts 图表仪表盘 (§4.2.8) | Tab 聚焦图表区域；Enter 展开数据表格替代视图；方向键在数据点间导航（折线图/柱状图）               | `role="img"` + `aria-label="{图表标题}：{摘要描述}"`；聚焦数据点时播报具体数值                                                  | 每个图表下方提供可展开的 `<table>` 数据表格             |
| Workflow 画布 (§4.6.9)      | Tab 在节点间按拓扑序移动；Enter 打开节点详情；方向键微调节点位置（编辑模式）；Delete 删除选中节点 | 每个节点 `aria-label="{节点名称}，类型：{step/condition/parallel}，状态：{status}"`；连线关系通过 `aria-describedby` 描述上下游 | 提供"列表视图"替代（按执行顺序线性展示所有步骤）        |
| NL 对话消息流 (§4.6.5)      | 消息列表 `role="log"`；新消息自动滚动可通过 Esc 暂停；Tab 聚焦可交互元素（代码块复制/审批按钮）   | `aria-live="polite"` 仅播报新消息摘要（避免 token 流逐字播报）；完成后播报完整回复                                              | —                                                       |
| 运营看板多面板 (§4.6.8)     | Tab 在面板间导航；Enter 展开/折叠面板；面板内 Tab 导航子控件                                      | 每个面板 `role="region"` + `aria-label="{面板标题}"`；折叠态播报"已折叠，按 Enter 展开"                                         | 提供"摘要视图"替代（纯文本 KPI 列表）                   |

### 6.4.4 键盘快捷键

| 快捷键                 | 功能                     | 平台       |
| ---------------------- | ------------------------ | ---------- |
| `Ctrl/Cmd + K`         | 打开命令面板             | Web + 桌面 |
| `Ctrl/Cmd + N`         | 新建任务（打开 NL 对话） | Web + 桌面 |
| `Ctrl/Cmd + /`         | 切换侧栏                 | Web + 桌面 |
| `Ctrl/Cmd + Shift + D` | 打开调试器               | Web + 桌面 |
| `Tab`                  | 焦点前移                 | 全平台     |
| `Shift + Tab`          | 焦点后移                 | 全平台     |
| `Escape`               | 关闭弹窗/面板            | 全平台     |
| `A`                    | 批准审批（审批页聚焦时） | Web + 桌面 |
| `R`                    | 拒绝审批（审批页聚焦时） | Web + 桌面 |
| `D`                    | 委托审批（审批页聚焦时） | Web + 桌面 |
| `?`                    | 显示快捷键帮助           | Web + 桌面 |

### 6.4.5 屏幕阅读器 ARIA 规范

| 组件     | aria 属性                                              |
| -------- | ------------------------------------------------------ |
| 任务状态 | `role="status"` + `aria-live="polite"`                 |
| 审批计数 | `aria-label="{n} 个待处理审批"`                        |
| 进度条   | `role="progressbar"` + `aria-valuenow/min/max`         |
| 风险等级 | `aria-label="风险等级：{level}"` + 颜色 + 文字双重标识 |
| 告警横幅 | `role="alert"` + `aria-live="assertive"`               |
| 对话消息 | `role="log"` + `aria-live="polite"`                    |

## 6.5 认证与会话安全

> **改进点 R-3**：合并 Doc-10 §10.8 和 Doc-11 §20。

### 6.5.1 认证流程

```text
┌────────────┐                    ┌──────────────┐
│  UI Client │                    │ Platform API │
└─────┬──────┘                    └──────┬───────┘
      │  1. SSO 登录（OIDC/SAML）         │
      │─────────────────────────────────▶│
      │  2. 返回 access_token + refresh  │
      │◀─────────────────────────────────│
      │  3. 存储到平台安全存储             │
      │  4. API 请求携带 Bearer token     │
      │─────────────────────────────────▶│
      │  5. Token 过期 → 自动 refresh     │
      │─────────────────────────────────▶│
      │  6. Refresh 失败 → 重新登录       │
      │◀─────────────────────────────────│
```

### 6.5.2 安全存储策略

| 平台    | 存储方式                                               | Token 类型    |
| ------- | ------------------------------------------------------ | ------------- |
| Web     | HttpOnly Secure Cookie（access_token）；内存中（短期） | JWT           |
| Windows | Windows Credential Manager（DPAPI 加密）               | JWT + refresh |
| macOS   | Keychain Services（Secure Enclave 保护）               | JWT + refresh |
| Linux   | libsecret (GNOME Keyring) / KWallet                    | JWT + refresh |
| Android | Android Keystore（TEE/StrongBox 支持）                 | JWT + refresh |
| iOS     | iOS Keychain（Secure Enclave 保护）                    | JWT + refresh |

### 6.5.3 会话安全策略

| 策略         | 说明                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Token 刷新   | access_token TTL=15min；refresh_token TTL=7d；静默刷新无感知                                           |
| 多设备管理   | 用户可查看和撤销活跃会话列表                                                                           |
| 设备绑定     | 可选：refresh_token 绑定设备指纹，换设备需重新认证                                                     |
| 生物识别解锁 | 移动端/桌面端支持生物识别快速解锁（不替代首次登录）                                                    |
| SSO 退出     | 平台退出触发 SSO 全局退出（SCIM deprovisioning 即时生效，参见 `00-platform-architecture.md` SSO/SCIM） |
| 敏感操作     | 高风险操作（修改安全设置、审批高额请求）需二次认证                                                     |

### 6.5.4 前端安全基线

| 威胁     | 防御措施                                                                |
| -------- | ----------------------------------------------------------------------- |
| XSS      | React 默认 JSX 转义；CSP strict-dynamic；DOMPurify 清理用户输入         |
| CSRF     | SameSite=Strict Cookie + CSRF Token（双重提交）                         |
| 点击劫持 | X-Frame-Options: DENY + CSP frame-ancestors 'none'                      |
| 中间人   | 全链路 HTTPS；移动端 Certificate Pinning                                |
| 数据泄露 | PII 不写入本地缓存；截屏保护（移动端 FLAG_SECURE / UIApplication 遮罩） |
| 逆向工程 | 移动端 ProGuard/R8 混淆；JS bundle 压缩混淆；无硬编码密钥               |
| 供应链   | 依赖锁定（package-lock.json）；CI 自动 npm audit / Snyk 扫描            |

**CSP 策略配置**：

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'strict-dynamic' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';        // CSS-in-JS 需要
  img-src 'self' data: https:;
  connect-src 'self' wss://{api-host};     // WebSocket
  font-src 'self';
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
```

### 6.5.5 敏感数据处理

| 数据类别     | 前端处理规则                                            |
| ------------ | ------------------------------------------------------- |
| PII          | 不缓存到 IndexedDB/SQLite；列表中脱敏显示（仅详情展示） |
| Secret       | 前端不可见；后端返回 `***masked***`                     |
| 审计日志     | 只读展示；不支持前端修改/删除                           |
| Token        | 仅存于平台安全存储；不写入 localStorage/SessionStorage  |
| 离线操作队列 | 加密存储（L4 SecureStorage 实现加密）                   |

## 6.6 响应式与自适应设计

### 6.6.1 断点系统

| 断点 | 宽度范围    | 设备                           | 布局模式                     |
| ---- | ----------- | ------------------------------ | ---------------------------- |
| xs   | < 640px     | 小屏手机（竖屏）               | 单栏堆叠                     |
| sm   | 640-767px   | 大屏手机 / 小屏手机（横屏）    | 单栏 + 底部导航              |
| md   | 768-1023px  | 平板（竖屏）/ 大屏手机（横屏） | 可折叠侧栏 + 内容            |
| lg   | 1024-1279px | 平板（横屏）/ 小屏笔记本       | 侧栏 + 内容                  |
| xl   | 1280-1439px | 笔记本 / 桌面                  | 侧栏 + 内容 + 右侧面板       |
| 2xl  | ≥ 1440px    | 大屏桌面 / 多屏                | 三栏（侧栏 + 内容 + 侧面板） |

### 6.6.2 功能分层（按断点）

| 功能            | xs/sm           | md/lg           | xl/2xl                   |
| --------------- | --------------- | --------------- | ------------------------ |
| NL 对话         | 全屏对话        | 侧栏对话        | 常驻右侧面板             |
| 任务列表        | 列表视图        | 列表 + 预览     | 列表 + 详情 + 侧面板     |
| 看板            | 卡片纵向堆叠    | 2 列网格        | 4 列网格                 |
| Workflow 构建器 | 只读查看        | 有限编辑        | 完整编辑 + 属性面板      |
| 调试器          | 不可用          | 基础时间线      | 完整调试 + OAPEFLIR 展开 |
| 审批            | 卡片列表 + 操作 | 列表 + 详情面板 | 完整三栏                 |

### 6.6.3 移动端适配特殊考量

| 考量       | 处理方式                                         |
| ---------- | ------------------------------------------------ |
| 触摸目标   | 最小 44x44pt (iOS) / 48x48dp (Android)           |
| 手势       | 下拉刷新、左滑操作（审批快捷处理）、边缘返回     |
| 安全区域   | 适配 notch/Dynamic Island/导航条                 |
| 输入法适配 | 键盘弹出时自动调整布局，输入框不被遮挡           |
| 横竖屏     | 竖屏为默认；横屏时充分利用宽度（看板 2 列→4 列） |

---

# Part VI — 工程化与交付

---

# 7. CI/CD、测试、性能与交付路线

## 7.1 构建与 CI/CD 流水线

> 当前仓内已落地的命令基线为 `npm run typecheck`、`npm test`、`npm run test:e2e`（Vitest smoke）与 `npm run build`。下述 Playwright / Detox / 打包矩阵描述的是目标态 CI 设计，不表示仓内已经具备完整原生 E2E 发布流水线。

### 7.1.1 CI 流水线

```text
PR Trigger
    │
    ├── lint（ESLint + Prettier）
    ├── typecheck（tsc --noEmit）
    ├── test:unit（Vitest，shared/ + ui-core/ + features/）
    ├── test:component（Storybook interaction tests）
    ├── security:audit（npm audit + Snyk）
    ├── build（Turborepo 全量构建）
    └── test:e2e（Playwright Web + Detox Mobile）[仅 main 分支]

Merge to main
    │
    ├── 上述全部
    ├── coverage:gate（Vitest coverage + ratchet baseline）
    ├── bundle:analysis（webpack-bundle-analyzer / vite-bundle-visualizer）
    ├── lighthouse:ci（FCP/LCP/CLS/INP 预算检查）
    └── deploy:staging（Web → staging CDN；桌面/移动 → 内测分发）
```

### 7.1.2 CD 发布矩阵

| 平台    | 构建产物        | 发布通道                          | 更新机制                         |
| ------- | --------------- | --------------------------------- | -------------------------------- |
| Web     | 静态 SPA bundle | CDN / Docker nginx                | 即时部署，Service Worker 更新    |
| Windows | MSIX / EXE      | 企业 MDM / 直接下载               | electron-updater 增量更新        |
| macOS   | DMG             | Mac App Store / 直接下载          | Sparkle (Tauri) 增量更新         |
| Linux   | AppImage / DEB  | 直接下载 / 包仓库                 | AppImage delta 更新              |
| Android | AAB / APK       | Google Play / 企业 MDM / APK 直发 | Play Store 自动更新 / 应用内更新 |
| iOS     | IPA             | App Store / TestFlight            | App Store 自动更新               |

### 7.1.3 环境策略

| 环境       | 用途           | 后端连接               | 数据源       |
| ---------- | -------------- | ---------------------- | ------------ |
| local      | 开发者本地开发 | mock-server 或本地后端 | 模拟数据     |
| dev        | 功能联调       | 共享开发后端           | 测试数据     |
| staging    | 预发布验证     | staging 后端           | 脱敏生产数据 |
| production | 正式环境       | 生产后端               | 真实数据     |

### 7.1.4 CI Stage 详情 `[Planned]`

> _v2.2 新增，提取自 Doc-11 §24.1 — 6 阶段流水线细节_

```text
Push / PR
  │
  ├─ Stage 1: Lint + Typecheck（并行）
  │   ├── npm run lint
  │   └── npm run typecheck
  │
  ├─ Stage 2: Unit + Component Test（按包并行）
  │   ├── npm test
  │   ├── npm run test:e2e
  │   └── Storybook / doc alignment suites
  │
  ├─ Stage 3: Build All（依赖链构建）
  │   └── npm run build
  │
  ├─ Stage 4: E2E Test（按平台并行）
  │   ├── Web: Playwright (Chrome + Firefox + Safari)
  │   ├── Mobile: Detox (Android emulator + iOS simulator)
  │   └── Desktop: Spectron (Electron) / Tauri test driver
  │
  ├─ Stage 5: Security Scan
  │   ├── npm audit
  │   ├── Snyk / Trivy 依赖漏洞扫描
  │   └── ESLint security plugin
  │
  └─ Stage 6: Package（仅 main/release 分支）
      ├── Web: Docker image (nginx + SPA)
      ├── Windows: MSIX / EXE (Code Signing)
      ├── macOS: DMG (Apple 签名 + 公证)
      ├── Linux: AppImage / DEB / RPM (GPG)
      ├── Android: AAB (Keystore 签名)
      └── iOS: IPA (Apple 签名)
```

执行顺序：`lint → typecheck → test:unit → build → test:e2e → security:scan → package`

### 7.1.5 自动更新策略 `[Planned]`

> _v2.2 新增，提取自 Doc-11 §24.4_

| 平台    | 更新机制                                | 用户体验                      |
| ------- | --------------------------------------- | ----------------------------- |
| Web     | Service Worker + Cache API              | 后台下载 → 刷新提示           |
| Windows | electron-updater (GitHub Releases / S3) | 后台下载 → 重启提示（差分包） |
| macOS   | Tauri updater (Sparkle 协议)            | 后台下载 → 重启提示           |
| Linux   | AppImage: appimagetool delta            | 手动/脚本更新                 |
| Android | Google Play 自动更新                    | Play 管理                     |
| iOS     | App Store 自动更新                      | App Store 管理                |

## 7.2 测试策略

> 当前仓内 UI 测试以 Vitest + Testing Library + 文档一致性测试为主；`npm run test:e2e` 目前承载的是仓内 smoke E2E 基线。Playwright / Detox / Spectron 仍按目标态规划保留。

### 7.2.1 测试金字塔

| 层级     | 工具                 | 覆盖目标                            | 数量比例 |
| -------- | -------------------- | ----------------------------------- | -------- |
| 单元测试 | Vitest               | shared/ 纯逻辑、hooks、utils        | 70%      |
| 组件测试 | Vitest + Testing Lib | ui-core/ 和 features/ 组件渲染+交互 | 20%      |
| 集成测试 | Vitest + MSW         | API 集成、WebSocket 流程、离线同步  | 7%       |
| E2E 测试 | Playwright / Detox   | 关键用户旅程                        | 3%       |

### 7.2.2 关键测试场景

| 场景                    | 验证内容                                        | 工具         |
| ----------------------- | ----------------------------------------------- | ------------ |
| 任务创建→执行→完成      | NL 输入 → API 调用 → WS 状态更新 → 卡片状态变化 | Playwright   |
| 审批流                  | 收到通知 → 查看详情 → 批准/拒绝 → 状态反馈      | Playwright   |
| 离线→恢复               | 断网 → 操作排队 → 恢复 → 同步 → 冲突解决        | Vitest + MSW |
| 多标签页 WebSocket      | 多 tab 共享连接 → 事件广播 → 状态一致           | Playwright   |
| 移动端审批快捷操作      | 推送通知 → 通知栏操作 → API 调用                | Detox        |
| 五级下钻（TaskCockpit） | L1→L2→L3→L4→L5 逐级下钻 → 数据正确加载          | Playwright   |
| SSO 登录                | OIDC 跳转 → Token 存储 → API 鉴权 → 静默刷新    | Playwright   |

### 7.2.3 视觉回归测试

| 工具      | 用途                                      |
| --------- | ----------------------------------------- |
| Storybook | 组件文档 + 视觉隔离开发                   |
| Chromatic | Storybook 截图对比 + 视觉回归检测         |
| Percy     | 跨浏览器视觉回归（Chrome/Firefox/Safari） |

### 7.2.4 测试工具链 `[Planned]`

> _v2.2 新增，提取自 Doc-11 §25.2 — 完整 9 类测试工具矩阵_

| 测试类别     | 工具                                   | 范围                             |
| ------------ | -------------------------------------- | -------------------------------- |
| 单元测试     | Vitest                                 | shared/\* 纯逻辑                 |
| 组件测试     | Vitest + React Testing Library         | ui-core, ui-mobile 组件          |
| API 集成测试 | Vitest + MSW (Mock Service Worker)     | api-client, queries              |
| 视觉回归     | Storybook + Chromatic                  | ui-core 组件                     |
| Web E2E      | Playwright                             | 主要用户流程（Chrome/FF/Safari） |
| 移动端 E2E   | Detox (iOS/Android)                    | 核心流程                         |
| 桌面端 E2E   | Spectron / Tauri test driver           | 基本冒烟测试                     |
| 性能测试     | Lighthouse CI + Web Vitals             | Web 性能指标                     |
| 无障碍测试   | axe-core (Playwright) + VoiceOver 手工 | WCAG 合规                        |

### 7.2.5 v3.0 新增模块测试策略 _(v3.0 新增)_

| 模块                | 测试重点                                                                           | 专项工具/技术                                    |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Agent 监控 (§4.2.7) | WS 实时推送 → 列表更新一致性；500+ Agent 虚拟滚动性能；健康状态聚合准确性          | Vitest + MSW (WS mock) · Playwright 性能断言     |
| 统计平台 (§4.2.8)   | ECharts 图表渲染正确性；角色自适应可见性；时间范围切换数据刷新；空数据 fallback    | Storybook + Chromatic 视觉快照 · Vitest 数据转换 |
| 配置管理 (§4.2.9)   | 权限矩阵编辑器 CRUD + 回滚；功能开关灰度百分比生效；模型配置乐观锁冲突；多角色隔离 | Playwright 角色切换 E2E · Vitest 乐观锁 mock     |

**ECharts 测试策略**：

- **单元测试**：验证 DTO → ECharts option 转换逻辑（纯函数，不依赖 DOM）
- **视觉快照**：Storybook story 为每种图表类型（Line/Pie/Heatmap/Bar/Gauge/BoxPlot）定义 fixture data，通过 Chromatic 做视觉回归
- **性能断言**：Playwright 验证图表页面 LCP < 3s（含 ECharts 动态加载）、并发渲染 ≤ 4 图表时帧率 ≥ 30fps

**权限矩阵编辑器测试策略**：

- 键盘导航测试（Tab/方向键/Enter 切换开关）— axe-core + Playwright
- 权限继承正确性（修改父角色 → 子角色同步变更）— Vitest 单元测试
- 大矩阵渲染（50 页面 × 5 角色 × 4 操作 = 1000 单元格）— 虚拟渲染性能验证

### 7.2.6 覆盖率要求 `[Planned]`

> _v2.2 新增，提取自 Doc-11 §25.3_

| 代码层      | 行覆盖率目标 | 分支覆盖率目标 |
| ----------- | ------------ | -------------- |
| shared/\*   | ≥ 90%        | ≥ 80%          |
| ui-core     | ≥ 80%        | ≥ 70%          |
| features/\* | ≥ 70%        | ≥ 60%          |
| apps/\*     | ≥ 50%        | ≥ 40%          |

## 7.3 性能预算

### 7.3.1 Web 性能预算

| 指标       | 目标值          | 测量工具   | 强制措施                  |
| ---------- | --------------- | ---------- | ------------------------- |
| FCP        | < 1.5s          | Lighthouse | CI 门禁，超标 PR 不可合并 |
| LCP        | < 2.5s          | Lighthouse | CI 门禁                   |
| CLS        | < 0.1           | Lighthouse | CI 门禁                   |
| INP        | < 200ms         | Lighthouse | CI 门禁                   |
| JS 主包    | < 200KB gz      | bundlesize | CI 门禁                   |
| 路由懒加载 | 首屏 < 100KB gz | bundlesize | Code Splitting 强制       |

### 7.3.2 桌面/移动端性能预算

| 指标               | 目标值                              | 平台   |
| ------------------ | ----------------------------------- | ------ |
| 启动时间           | < 3s（桌面）< 2s（移动）            | 全平台 |
| 内存占用（空闲态） | < 300MB（Electron）< 150MB（Tauri） | 桌面   |
| 帧率               | ≥ 60fps（动画/滚动）                | 全平台 |
| WebSocket 延迟     | 事件→UI < 200ms P99                 | 全平台 |

### 7.3.3 性能优化策略

| 策略           | 实现方式                                                              |
| -------------- | --------------------------------------------------------------------- |
| Code Splitting | React.lazy + Suspense 按路由拆分；重型组件(ECharts/ReactFlow)动态导入 |
| 虚拟滚动       | TanStack Virtual 处理长列表（任务列表/审批列表/日志）                 |
| 预加载         | prefetchQuery() 预加载下一级下钻数据                                  |
| Web Worker     | JSON 解析、diff 计算等 CPU 密集操作移至 Web Worker                    |
| 图片优化       | WebP/AVIF 格式 + srcset 响应式 + lazy loading                         |
| 服务端聚合     | 使用 MissionControlService 聚合视图减少 API roundtrip                 |

**Web 端优化详表**：

| 策略           | 实现                                          |
| -------------- | --------------------------------------------- |
| 代码拆分       | React.lazy + Suspense，按路由拆分功能模块     |
| Tree Shaking   | Vite 默认 + ESM 模块确保 dead code 消除       |
| 资源预加载     | `<link rel="modulepreload">` 关键路径模块     |
| 图片优化       | WebP + responsive srcSet + lazy loading       |
| 字体优化       | 系统字体栈为主；图标字体改用 SVG sprite       |
| 骨架屏         | 所有列表/看板使用 Skeleton 组件避免 CLS       |
| 虚拟列表       | 任务列表/审批列表超过 50 条使用 VirtualList   |
| Service Worker | 静态资源 Cache-First；API Network-First + SWR |
| CDN            | 静态资源 CDN 分发；API 保持直连               |

**移动端优化详表**：

| 策略         | 实现                                           |
| ------------ | ---------------------------------------------- |
| Hermes 引擎  | 预编译 JS bytecode，启动速度提升 2-3x          |
| 列表虚拟化   | FlashList (Shopify) 替代 FlatList              |
| 图片缓存     | FastImage 组件 + 内存/磁盘双级缓存             |
| 动画         | Reanimated 3 + 原生驱动动画，避免 JS 线程阻塞  |
| 后台数据刷新 | 利用 iOS BackgroundTasks / Android WorkManager |
| 包体积       | Metro bundle 按架构拆分（arm64/x86_64）        |

**桌面端优化详表**：

| 策略       | 实现                                              |
| ---------- | ------------------------------------------------- |
| 启动加速   | Electron: v8 snapshot + 预加载关键模块            |
| 内存管理   | 非活跃窗口卸载 WebView；定期 GC                   |
| 多窗口     | Electron: BrowserWindow 池化复用                  |
| 增量更新   | electron-updater 差分包（~5MB vs 全量 ~120MB）    |
| Tauri 优势 | 无 Chromium 捆绑；Rust 后端内存安全；包体积 ~15MB |

### 7.3.4 图表密集页面性能预算 _(v3.0 新增)_

数据统计平台（§4.2.8）和运营看板（§4.6.8）包含多图表并发渲染，需额外性能约束：

| 指标                       | 目标值                | 强制措施                                               |
| -------------------------- | --------------------- | ------------------------------------------------------ |
| ECharts 包体积（按需引入） | < 150KB gz            | 仅引入使用的 chart type + renderer；CI bundlesize 门禁 |
| Monaco Editor（模型配置）  | < 200KB gz            | 动态 import；仅在 `/shared/settings/models` 路由加载   |
| 图表页面 LCP               | < 3s                  | ECharts 延迟初始化 + 骨架屏占位                        |
| 最大并发图表渲染           | ≤ 4 个可视区域内      | 非可视区域图表使用 IntersectionObserver 延迟初始化     |
| 图表动画帧率               | ≥ 30fps               | 数据量 > 1000 点时禁用动画                             |
| 单图表数据点上限           | ≤ 2000 点（聚合显示） | 超限时后端做 downsample，前端显示"已聚合"提示          |

**ECharts Tree-Shaking 策略**：

```typescript
import { use } from "echarts/core";
import { LineChart, PieChart, BarChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([
  LineChart,
  PieChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);
```

### 7.3.5 CI 构建影响评估 _(v3.0 新增)_

v3.0 新增 3 个功能模块对 CI 的影响：

| 影响项                 | 预估影响            | 缓解措施                                                |
| ---------------------- | ------------------- | ------------------------------------------------------- |
| ECharts 包体积增长     | +120-150KB gz       | 按需引入 + 路由级懒加载；不影响主包 < 200KB 门禁        |
| Monaco Editor 包体积   | +180-200KB gz       | 仅 `/settings/models` 路由动态加载；bundlesize 单独限额 |
| 新增 3 个 feature 模块 | +30-50KB gz/模块    | Code Split 已强制；CI 每路由 < 100KB gz 门禁覆盖        |
| 组件测试增量           | +200-300 个测试用例 | CI 并行度从 4 → 6；预计增加 ~30s 测试时间               |
| Storybook story 增量   | +40-60 个 story     | Chromatic 按变更增量对比；不影响 CI 总时长              |

## 7.4 分阶段交付计划

### Phase 1 — Web MVP（12 周）

**Gate 0（Phase 1 启动前置条件）**：

| #    | 门禁条件                                                   | 验证方式                        | 负责方     |
| ---- | ---------------------------------------------------------- | ------------------------------- | ---------- |
| G0-1 | 后端 REST API v1 OpenAPI spec 已发布且冻结                 | `GET /api/v1/openapi.json` 可用 | 后端团队   |
| G0-2 | WebSocket 握手协议文档化（JWT auth + schema_version 协商） | WebSocketBridge 集成测试通过    | 后端团队   |
| G0-3 | MissionControlService 6 个方法均可通过 HTTP 调用           | console-routes 集成测试通过     | 后端团队   |
| G0-4 | `ui_console_and_cockpit_contract.md` 已标记为 Accepted     | 文档状态检查                    | 架构评审   |
| G0-5 | DomainDescriptor + DomainUIConfig JSON Schema 已发布       | Schema 校验测试通过             | 域平台团队 |
| G0-6 | `analyticsConsent` PlatformAdapter 接口规范已评审          | ADR 评审记录                    | 前端架构   |

| 周次   | 交付物                                                   |
| ------ | -------------------------------------------------------- |
| W1-2   | Monorepo 脚手架 + shared/ 基座 + Storybook + mock-server |
| W3-4   | 认证流程 + Dashboard + SystemStatusBar                   |
| W5-6   | TaskCockpit（L1-L3 下钻）+ ApprovalCenter                |
| W7-8   | StabilityPanel + NL Conversation                         |
| W9-10  | WebSocket 实时层 + 离线基础 + WorkflowCockpit            |
| W11-12 | AdminTakeoverConsole + E2E 测试 + 性能优化 + 发布        |

### Phase 2 — 桌面端（8 周）

**Gate 1（Phase 2 启动前置条件）**：

| #    | 门禁条件                                                         | 验证方式               | 负责方     |
| ---- | ---------------------------------------------------------------- | ---------------------- | ---------- |
| G1-1 | Phase 1 Web MVP 已通过 UAT 验收                                  | UAT 签署报告           | QA + 产品  |
| G1-2 | `windowing` / `shell` / `process` PlatformAdapter 接口规范已冻结 | ADR-UI-009 评审通过    | 前端架构   |
| G1-3 | Electron 34 + Tauri 2.x 壳层 PoC 通过（含自动更新验证）          | PoC demo + 测试报告    | 桌面端团队 |
| G1-4 | 后端 §5.2.2 P1 优先级新增端点中 ≥ 80% 已实现                     | API 集成测试覆盖率报告 | 后端团队   |
| G1-5 | 桌面端 CI 矩阵（§2.6.3）已配置完成                               | CI pipeline 运行记录   | DevOps     |

| 周次 | 交付物                                               |
| ---- | ---------------------------------------------------- |
| W1-2 | Electron Windows 壳层 + 系统集成（托盘/快捷键/通知） |
| W3-4 | Tauri macOS/Linux 壳层 + 原生集成                    |
| W5-6 | Workflow Builder（React Flow 画布）+ Debugger 基础   |
| W7-8 | 桌面端 E2E + 自动更新 + 打包发布                     |

### Phase 3 — 移动端（8 周）

**Gate 2（Phase 3 启动前置条件）**：

| #    | 门禁条件                                        | 验证方式                  | 负责方        |
| ---- | ----------------------------------------------- | ------------------------- | ------------- |
| G2-1 | Phase 2 桌面端已通过 UAT 验收                   | UAT 签署报告              | QA + 产品     |
| G2-2 | RN 0.79 + Hermes + Fabric 技术验证通过          | PoC 性能报告（启动 < 2s） | 移动端团队    |
| G2-3 | FCM/APNs 推送通道已配置且经过集成测试           | 推送端到端测试报告        | 后端 + 移动端 |
| G2-4 | `screenSecurity` PlatformAdapter 接口规范已冻结 | ADR 评审记录              | 前端架构      |
| G2-5 | 离线操作许可矩阵（§5.5.6）已与产品确认          | 产品签署确认              | 产品          |

| 周次 | 交付物                                             |
| ---- | -------------------------------------------------- |
| W1-2 | RN 0.79 脚手架 + ui-mobile 组件 + 导航结构         |
| W3-4 | Dashboard + TaskCockpit + ApprovalCenter 移动端    |
| W5-6 | 推送通知 + 离线同步 + 生物识别                     |
| W7-8 | Detox E2E + 性能优化 + App Store / Play Store 发布 |

### Phase 4 — 增强功能（持续）

**Gate 3（Phase 4 启动前置条件）**：

| #    | 门禁条件                                                   | 验证方式              | 负责方     |
| ---- | ---------------------------------------------------------- | --------------------- | ---------- |
| G3-1 | Phase 3 移动端已通过 UAT 验收                              | UAT 签署报告          | QA + 产品  |
| G3-2 | 后端 §5.2.2 P2/P3 优先级端点 ≥ 60% 已实现                  | API 覆盖率报告        | 后端团队   |
| G3-3 | DomainUIConfig 扩展字段（§6.1.2.1）Schema 已稳定           | Schema 兼容性测试通过 | 域平台团队 |
| G3-4 | 至少 3 个域的 glossaryOverrides + featureVisibility 已配置 | 域配置验证脚本通过    | 域管理员   |

- Workflow Debugger 时间旅行
- 24 域专属扩展组件
- 多语言 P1/P2 覆盖
- Edge-Mobile 离线模式
- Cost Center + Marketplace + Explainability

### 团队配置建议

| 角色          | Phase 1 | Phase 2 | Phase 3 | 说明             |
| ------------- | ------- | ------- | ------- | ---------------- |
| 前端架构师    | 1       | 1       | 1       | 全程参与         |
| Web 开发      | 3       | 2       | 1       | Phase 1 为主力   |
| 桌面端开发    | 0       | 2       | 1       | Electron + Tauri |
| RN 移动端开发 | 0       | 0       | 3       | Phase 3 为主力   |
| UX 设计师     | 1       | 1       | 1       | 全程参与         |
| QA            | 1       | 2       | 2       | 随平台增加       |
| **合计**      | **6**   | **8**   | **9**   |                  |

## 7.5 风险与缓释

| 风险                                    | 影响 | 概率 | 缓释措施                                                  |
| --------------------------------------- | ---- | ---- | --------------------------------------------------------- |
| 后端缺少 UI 所需 API 端点               | 高   | 高   | Phase 1 同步提出 API 增强需求（§5.2.2）；mock-server 解耦 |
| RN 0.79 New Arch 生态库兼容性问题       | 中   | 中   | 社区库预研；关键原生模块备选方案                          |
| Tauri WebKitGTK 在 Linux 发行版的兼容性 | 低   | 中   | CI 多发行版测试（Ubuntu/Fedora/Arch）；AppImage 兜底      |
| WebSocket 在企业防火墙/代理后被拦截     | 中   | 中   | SSE fallback + 轮询降级（§5.3.4）                         |
| 24 域扩展组件开发量大                   | 中   | 高   | Phase 4 渐进交付；模板化组件框架减少重复开发              |
| 离线冲突解决用户体验差                  | 低   | 中   | 最小化离线写操作范围；优先 LWW 自动解决                   |
| 前后端 Schema 不同步                    | 高   | 高   | codegen 工具自动从后端 Zod 生成前端类型；CI 校验          |
| App Store 审核被拒                      | 中   | 中   | 提前研究审核指南；预留 2 周审核缓冲                       |
| 安装包体积超标 (Electron)               | 低   | 中   | 增量更新；懒加载非核心模块                                |

---

# 附录

## 附录 A：后端 API 端点 → UI 功能完整映射 {#附录-a}

| 端点                                   | 状态                     | API Layer | UI 消费模块                                                        |
| -------------------------------------- | ------------------------ | --------- | ------------------------------------------------------------------ |
| `GET /api/v1/tasks`                    | [Implemented/Contracted] | Layer C   | task-cockpit, dashboard                                            |
| `POST /api/v1/tasks`                   | [Implemented/Contracted] | Layer C   | conversation (NL → task)                                           |
| `GET /api/v1/tasks/:id`                | [Implemented/Contracted] | Layer C   | task-cockpit (L2-L3)                                               |
| `POST /api/v1/approvals/:id`           | [Implemented/Contracted] | Layer C   | approval                                                           |
| `GET /api/v1/dashboard/*`              | [Implemented/Contracted] | Layer C   | dashboard, stability                                               |
| `GET /console/*`                       | [Implemented/Internal]   | Layer B   | dashboard (SSR fallback)                                           |
| `GET /admin/v1/*`                      | [Implemented/Contracted] | Layer B/C | takeover, workers, policy, settings                                |
| MissionControlService.\*               | [Implemented/Internal]   | Layer A   | dashboard, task-cockpit, wf-cockpit, stability, takeover, approval |
| OperatorConsoleBackendService.\*       | [Implemented/Internal]   | Layer A   | inspect, incidents, workers                                        |
| `CRUD /api/v1/agents`                  | [Planned]                | Layer C   | agent-manager                                                      |
| `CRUD /api/v1/workflows`               | [Planned]                | Layer C   | workflow-cockpit, workflow-builder                                 |
| `GET /api/v1/marketplace`              | [Planned]                | Layer C   | marketplace                                                        |
| `POST /api/v1/explanations`            | [Planned]                | Layer C   | explainability                                                     |
| `GET /api/v1/costs`                    | [Planned]                | Layer C   | cost-center                                                        |
| `GET /api/v1/dashboard/metrics`        | [Planned]                | Layer C   | dashboard (L2-L4)                                                  |
| `GET /api/v1/tasks/:id/evidence`       | [Planned]                | Layer C   | task-cockpit (L4)                                                  |
| `GET /api/v1/tasks/:id/timeline`       | [Planned]                | Layer C   | task-cockpit (L5)                                                  |
| `DELETE /api/v1/tasks/:id`             | [Implemented/Contracted] | Layer C   | task-cockpit (取消任务)                                            |
| `GET /api/v1/workflow-runs`            | [Implemented/Contracted] | Layer C   | task-cockpit (运行列表)                                            |
| `GET /api/v1/workflow-runs/{id}/steps` | [Implemented/Contracted] | Layer C   | task-cockpit (步骤详情)                                            |
| `GET /api/v1/approvals`                | [Implemented/Contracted] | Layer C   | approval (审批列表)                                                |
| `GET /api/v1/incidents`                | [Implemented/Contracted] | Layer C   | alerts, stability (Incident 面板)                                  |
| `GET /api/v1/knowledge`                | [Implemented/Contracted] | Layer C   | explainability (知识引用查看)                                      |
| `GET /api/v1/packs`                    | [Implemented/Contracted] | Layer C   | agent-manager (Agent 列表)                                         |
| `POST /api/v1/packs`                   | [Implemented/Contracted] | Layer C   | domain-wizard (Pack 注册)                                          |
| `GET /api/v1/packs/{id}/versions`      | [Implemented/Contracted] | Layer C   | agent-manager (版本管理)                                           |
| `GET /api/v1/plugins`                  | [Implemented/Contracted] | Layer C   | marketplace (市场列表)                                             |
| `GET /api/v1/prompts`                  | [Implemented/Contracted] | Layer C   | agent-manager (Prompt 版本)                                        |
| `GET /api/v1/cost-reports`             | [Planned]                | Layer C   | cost-center (成本数据)                                             |
| `GET/POST /api/v1/webhooks`            | [Implemented/Contracted] | Layer C   | settings (Webhook 管理)                                            |
| `GET /api/v1/admin/workers`            | [Implemented/Internal]   | Layer B   | dashboard L3 (Worker 状态)                                         |
| `GET/PUT /api/v1/admin/config`         | [Implemented/Contracted] | Layer B/C | settings (配置管理)                                                |
| `GET/POST /api/v1/admin/rollouts`      | [Planned]                | Layer C   | agent-manager (灰度发布)                                           |
| `GET/POST/PUT /api/v1/admin/tenants`   | [Planned]                | Layer C   | settings (租户管理)                                                |
| `GET/PUT /api/v1/admin/budgets`        | [Planned]                | Layer C   | cost-center (预算配置)                                             |
| `ws/v1/stream`                         | [Implemented]            | Layer C   | 全局 (实时事件推送)                                                |

## 附录 B：WebSocket 事件完整映射 {#附录-b}

| 事件                            | 状态          | 来源                       | UI 模块                      |
| ------------------------------- | ------------- | -------------------------- | ---------------------------- |
| `status_changed`                | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit, dashboard      |
| `progress`                      | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit                 |
| `message_delta`                 | [Implemented] | WebSocketBridge            | conversation                 |
| `artifact_ready`                | [Implemented] | WebSocketBridge            | task-cockpit                 |
| `approval_requested`            | [Implemented] | WebSocketBridge            | approval, dashboard          |
| `completed`                     | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit, dashboard      |
| `failed`                        | [Implemented] | TaskWebSocketStatusRelay   | task-cockpit, dashboard      |
| `approval.resolved`             | [Planned]     | WebSocketBridge            | approval                     |
| `incident.created`              | [Planned]     | IncidentService            | alerts, stability            |
| `panic.activated`               | [Planned]     | PanicService               | 全局蒙层                     |
| `hitl.intervention_required`    | [Planned]     | HITL module                | hitl, approval               |
| `agent.health_changed`          | [Planned]     | AgentRegistry              | agent-manager, dashboard     |
| `dashboard.metric_updated`      | [Planned]     | DashboardProjectionService | dashboard                    |
| `nl.clarification_needed`       | [Proposed]    | NLEntryService             | conversation                 |
| `cost.budget_alert`             | [Proposed]    | CostService                | cost-center, dashboard       |
| `drift.alert`                   | [Proposed]    | DriftDetector              | stability, alerts            |
| `agent.registered`              | [Planned]     | AgentRegistryService       | agent-manager                |
| `agent.deregistered`            | [Planned]     | AgentRegistryService       | agent-manager                |
| `workflow.updated`              | [Planned]     | WorkflowDefinitionService  | workflow-builder             |
| `workflow.published`            | [Planned]     | WorkflowDefinitionService  | workflow-builder, wf-cockpit |
| `workflow.validation_result`    | [Planned]     | WorkflowDefinitionService  | workflow-builder             |
| `marketplace.pack_published`    | [Planned]     | MarketplaceService         | marketplace                  |
| `marketplace.pack_updated`      | [Planned]     | MarketplaceService         | marketplace                  |
| `marketplace.install_completed` | [Planned]     | MarketplaceService         | marketplace                  |
| `cost.period_closed`            | [Proposed]    | CostService                | cost-center                  |
| `debug.step_entered`            | [Planned]     | DebuggerService            | workflow-debugger            |
| `debug.breakpoint_hit`          | [Planned]     | DebuggerService            | workflow-debugger            |
| `debug.state_snapshot`          | [Planned]     | DebuggerService            | workflow-debugger            |
| `goal.decomposition_ready`      | [Proposed]    | GoalDecompositionService   | conversation                 |
| `config.updated`                | [Planned]     | admin-routes               | settings                     |

## 附录 C：ADR 决策索引 {#附录-c}

| ADR 编号   | 决策                                            | 状态   |
| ---------- | ----------------------------------------------- | ------ |
| ADR-UI-001 | React 19 为统一 UI 框架                         | 已批准 |
| ADR-UI-002 | Electron(Win) + Tauri(Mac/Linux) 混合策略       | 已批准 |
| ADR-UI-003 | Zustand 5 + TanStack Query v5 状态管理          | 已批准 |
| ADR-UI-004 | pnpm + Turborepo Monorepo                       | 已批准 |
| ADR-UI-005 | 契约信息架构作为一级导航结构                    | 本文档 |
| ADR-UI-006 | WebSocket 优先 + SSE fallback + 轮询降级        | 本文档 |
| ADR-UI-007 | Web 离线三层策略                                | 本文档 |
| ADR-UI-008 | DomainUIConfig 从 DomainDescriptor 派生         | 本文档 |
| ADR-UI-009 | Electron(Win)+Tauri(Mac/Linux) 桌面混合壳层治理 | 本文档 |

## 附录 D：术语表 {#附录-d}

| 术语                  | 含义                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| MissionControlService | 后端核心服务，聚合所有 Cockpit 视图数据                               |
| WebSocketBridge       | 后端生产级 WebSocket 服务，支持 JWT 认证和事件广播                    |
| DomainDescriptor      | 后端业务域描述符，包含域配置、风险等级、策略等                        |
| DomainUIConfig        | 前端域 UI 配置对象，从 DomainDescriptor 派生                          |
| OAPEFLIR              | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release 八阶段循环 |
| HITL                  | Human-In-The-Loop 人机协作                                            |
| L1-L5                 | UI 信息下钻层级（契约 §7 定义的五级下钻）                             |
| shared_snapshot       | 契约定义的全局共享快照数据源                                          |
| shared_query          | 契约定义的跨页面共享查询数据源                                        |
| page_local_api        | 契约定义的页面级专用 API 数据源                                       |
| Layer A/B/C           | API 暴露层次：Service Method / Internal Route / Public Contract EP    |
| Idempotency Key       | 写操作幂等标识，防止因重试导致的重复执行                              |
| RedactionRule         | 字段级脱敏规则，定义各角色在各字段上的可见性策略                      |
| SPA                   | Single Page Application，单页应用                                     |
| SSO                   | Single Sign-On，单点登录                                              |
| OIDC                  | OpenID Connect，基于 OAuth2 的身份认证协议                            |
| PKCE                  | Proof Key for Code Exchange，OAuth2 安全扩展                          |
| RN                    | React Native                                                          |
| DAG                   | Directed Acyclic Graph，有向无环图                                    |
| CAS                   | Compare-And-Swap，乐观锁                                              |
| FCP                   | First Contentful Paint，首次内容绘制                                  |
| LCP                   | Largest Contentful Paint，最大内容绘制                                |
| CLS                   | Cumulative Layout Shift，累积布局偏移                                 |
| INP                   | Interaction to Next Paint，交互到下一次绘制                           |
| WCAG                  | Web Content Accessibility Guidelines                                  |
| PWA                   | Progressive Web App                                                   |
| MSW                   | Mock Service Worker                                                   |
| BFF                   | Backend For Frontend                                                  |
| CDN                   | Content Delivery Network                                              |

## 附录 E：v2.3 整改清单（P0/P1/P2） {#附录-e}

> 本附录记录 v2.2 专家评审后识别的遗留改进项及其在 v2.3 中的处理状态。

### P0 — 阻塞性问题（v2.3 已修复）

| #    | 问题                                                                  | 风险                                                  | v2.3 处理                                                   |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| P0-1 | `[Implemented]` 标签未区分"有 service method"与"有公开 JSON contract" | 前端误把 Layer A service method 当可直接消费 endpoint | §1.7 新增 Implemented 三级子标签；§4.1/§5.2/附录 A 全量标注 |
| P0-2 | `/console/*` 和 `/admin/v1/*` 的语义层次不清                          | 前端不确定该消费 HTML fallback 还是 JSON API          | §5.2.3 新增 Public UI API Surface 三层分级                  |
| P0-3 | `[已实现]`/`[需新增]` 与 `[Implemented]`/`[Planned]` 标记混用         | 文档可信度降低                                        | 全文统一为英文标签格式                                      |

### P1 — 高优先级改进（v2.3 已修复）

| #    | 问题                                                                        | 风险                                               | v2.3 处理                                         |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| P1-1 | 6 个 Planned 模块缺闭环契约（DTO/actions/query keys/permission/WS/offline） | 后端 API 设计无对齐基准，mock-server 无法准确 mock | §4.7 新增 6 个模块 mini-contract                  |
| P1-2 | 缺字段级可见性/脱敏矩阵                                                     | 企业级部署场景下 PII 泄露风险                      | §4.5.4 新增 FieldVisibilityPolicy + RedactionRule |
| P1-3 | 写操作缺幂等/重试语义                                                       | 重复提交、数据不一致                               | §5.6.4 新增 Mutation 幂等与重试规范               |
| P1-4 | service / route / endpoint 术语混用                                         | 读者误解 API 暴露层次                              | §5.2.3 定义 Layer A/B/C；附录 D 补充术语          |

### P2 — 中等优先级改进（部分已修复，部分后续版本跟进）

| #    | 问题                                                                             | 风险                    | v2.3 处理                                                | 后续版本 |
| ---- | -------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- | -------- |
| P2-1 | PlatformAdapter 部分能力边界模糊（screenSecurity/analyticsConsent/windowing）    | 跨平台 no-op 行为未定义 | 已在 §3.7.1 表格标注平台适用范围；详细 no-op 规范        | v2.4     |
| P2-2 | PlatformAdapter `process.getAppVersion()`/`getBuildChannel()` 是否属于全平台能力 | 职责边界不清            | 保持 [Planned] 状态，标注为"Phase 2 评审确认"            | v2.4     |
| P2-3 | Web 端 `screenSecurity` 实际能力很弱                                             | 给用户虚假安全感        | §3.7.1 表格注明"桌面端 + 移动端"，Web 端为 no-op         | —        |
| P2-4 | `windowing` 与多窗口状态同步协议未定义                                           | 多窗口间数据不一致      | 保持 [Planned]；Phase 2 Gate 1 前置条件中已覆盖          | v2.4     |
| P2-5 | §4.1 信息架构表"后端数据源"列混合了 service method 和 route 引用                 | 模糊 API 暴露层次       | 已更新 §4.1 表格标注 Implemented 子标签；§5.2.3 明确分层 | —        |
| P2-6 | 部分内部引用编号（如"参见 §6 API"）与当前文档结构不匹配                          | 读者导航混乱            | 全文引用复核，修正为当前编号                             | —        |

### 后续版本 Backlog

| #   | 问题                                                                         | 计划版本 |
| --- | ---------------------------------------------------------------------------- | -------- |
| B-1 | 每个 PlatformAdapter 能力组补充 no-op / degraded behavior 规范               | v2.4     |
| B-2 | Workflow/Agent/Marketplace WS 订阅协议详细设计                               | v2.4     |
| B-3 | DomainUIConfig 扩展字段（featureVisibility/actionPolicy 等）JSON Schema 发布 | v2.4     |
| B-4 | 24 域专属扩展组件 mini-contract（§6.1.4 展开）                               | v2.5     |
| B-5 | 端到端 contract test 自动化（OpenAPI spec → 前端 type → mock → E2E）         | v2.5     |
