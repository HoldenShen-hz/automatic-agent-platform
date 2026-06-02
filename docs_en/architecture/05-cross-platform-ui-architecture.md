# 12. 跨平台 UI 统一架构 (改进版) 

Source baseline: `docs_en/architecture/05-cross-platform-ui-architecture.md`

> **文档版本**: v4.4
> **文档state**: Accepted
> **基线文档**: `00-platform-architecture.md` v4.3 五平面架构 · `contracts/ui_console_and_cockpit_contract.md`
> **前序文档**: `10-cross-platform-ui-architecture.md` (v1 概览, 已 Superseded) · `11-cross-platform-ui-implementation-design.md` (v1 实施, 已 Superseded) 
> **适用对象**: 前端架构师, UI/UX 工程师, 移动端/桌面端开发, QA, DevOps, 平台 SRE
> **设计定位**: 单一权威 UI 架构规格. 完全合并 Doc-10 和 Doc-11 的全部content, 消除版本inconsistent, 对齐后端implementation

---

## 修订历史

| 版本 | 日期       | 作者 | 变更摘要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2.0 | 2026-04-22 | —    | 合并 Doc-10/Doc-11; 统一框架版本; 对齐 MissionControlService/WebSocketBridge 后端implementation; 重构信息架构映射                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v2.1 | 2026-04-23 | —    | Doc-11 第二次 Review 回补: 扩展 PlatformAdapter interface(clipboard/lifecycle/deepLink/haptics); 增加 Zustand Store interface定义 + TanStack Query staleTime strategy; 增加 SharedWorker WebSocket 架构graph; 增加离线存储容量规划表; 增加键盘快捷键表 + ARIA 规范                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| v2.2 | 2026-04-23 | —    | 专家评审修订: 引入四级state标签(Implemented/Planned/Proposed/Deferred); 增加桌面混合壳层治理规则; 扩展 PlatformAdapter 五组能力(windowing/shell/process/analyticsConsent/screenSecurity); 增加页面级permissions矩阵; 增加 DTO→VM→Props 反腐层规范; 增加 WebSocket 订阅域模型; 增加离线操作许可矩阵; 扩展 DomainUIConfig 四组域治理interface; 增加交付阶段dependency门禁; 增加前端error分级与降级strategy; 增加contract版本协商; 文档卫生cleanup; state Draft→Accepted. Doc-11 高价值content提取: §4.6 实施参考蓝graph(NL 对话/HITL/Workflow 调试器/审批中心); §5.4.1-5.4.5 API 通信层详情(RESTClient/WSClient/Endpoint 模式/认证流程/离线队列); §6.3 设计令牌补充(primitive.ts) + 组件开发规范; §7.1.4-7.1.5 CI Stage 详情 + auto更新strategy; §7.2.4-7.2.5 testing工具链 + coverage率要求 |
| v2.3 | 2026-04-23 | —    | 基线强化修订: Implemented statesplit三级子标签(Contracted/Internal/Partial); 新增 §5.2.3 Public UI API Surface 分层 (service method / route / public contract endpoint) ; 新增 §4.7 Planned module mini-contract (AgentManager/WorkflowBuilder/WorkflowDebugger/Marketplace/Explainability/CostCenter) ; 新增 §4.5.4 field级可见性与sanitized矩阵 (FieldVisibilityPolicy/RedactionRule/PIIHandlingByRole) ; 新增 §5.6.4 Mutation 幂等与重试规范; 文档卫生收尾 (`[已implementation]`/`[需新增]` 统一为 `[Implemented]`/`[Planned]` 标签; service/route/endpoint 术语统一; 整改清单附录 E)                                                                                                                                                                      |
| v3.0 | 2026-04-23 | —    | 详见下方 v3.0 变更明细                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v3.1 | 2026-04-23 | —    | 仓内 `ui/` Monorepo 基线已落地: 补齐 shared core, PlatformAdapter, design tokens, implemented-first feature registry, planned feature seam, Web 可构建 app shell, 桌面/移动端 smoke-ready shell, UI 子工程testing基线与 `current_todo_list` 的 `UI0-UI7` 波次.  |
| v3.2 | 2026-04-23 | —    | 仓内 `Phase 1-4` 代码基线对齐: 补齐 `policy / audit / workers / queues` 四个一级 feature, augmentation Web 分组导航, 桌面/移动平台能力testing与 `current_todo_list` 的 `Phase 1-4` 阶段plan; 正文新增仓内对齐快照.  |
| v4.3 | 2026-05-10 | —    | 现行架构口径升级: 正文与testing基线统一回写到五平面 v4.3, 补充 `PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` 的 canonical handoff, 并把 UI 对运行链的说明从 legacy task/workflow 叙事收敛到 HarnessRun/runtime truth.  |
| v4.4 | 2026-05-26 | —    | 对齐最近代码收口: 公共queryinterface补齐 `/api/v1/agents`, `/api/v1/dashboard/metrics`, `/api/v1/explanations`, `/api/v1/marketplace`, `/api/v1/knowledge`, `/api/v1/packs/:packId/versions`, `/api/v1/workflows/builder` 与 `/api/v1/meta/contract-version`; 前端 endpoint catalog 已统一为 `/v1/*` + runtime `baseUrl=/api`; Electron bridge compatibility `AA_ELECTRON` / `__AA_ELECTRON__`.  |

#### v3.0 变更明细

**Doc-11 完全合并** (Doc-11 正式标记为 Superseded by Doc-12 v3.0) : 

- 从 Doc-11 吸收全部 27 项剩余独特content + 6 项页面线框graph
- §3.7.3 各平台implementationstrategy表; §3.7.4 适配器injection机制 (Provider 链) 
- §4.4.1 路由表augmentation (permissions列 + Code Split 列) ; §4.4.2 移动端导航augmentation (Screen 层级 + 导航特性表) ; §4.4.3 permissions路由guard链 (5 层 Guard) 
- §4.6.5-4.6.10 页面线框graph (NL 对话/task三栏/审批/看板/WF 构建器/调试器data流) 
- §5.1 state分类表 + QueryClient globallyconfigure + 离线persistence + data流模式graph; §5.1.1-5.1.5 子章节编号
- §5.3.2.1-5.3.2.3 WSEventRouter 架构graph/事件→Query 映射/紧急事件handle
- §5.4.6 pagination与filter标准化; §5.6.5 optimistic更新模式; §5.6.6 HTTP state码→UI 行为映射
- §6.1.5 域扩展 Slot 模式与dynamic加载; §6.2.3 data隔离strategy; §6.3.3 暗色模式设计规则
- §6.4.2 翻译工作流; §6.5.4 CSP strategyconfigure; §6.5.5 敏感datahandle; §6.6.3 移动端适配特殊考量
- §7.3.3 各平台优化详表 (Web 9 项/移动端 6 项/桌面端 5 项) ; §7.4 团队configure建议; §7.5 risk补充
- 附录 A 扩充 20 行端点; 附录 D 扩充 17 条术语

**治理augmentation**: 

- §1.7 新增state标签更新责任机制 (责任人/更新时机/forcevalidation节点矩阵) 
- §4.7 mini-contract 新增 authoritative source / derived source / projection owner 三列
- §5.2.4 新增 Internal → Contracted API Graduation Matrix (13 个data源升级清单 + 升级流程) 

**三大功能module新增**: 

- §4.2.7 Agent 实时监控中心 (列表+详情+心跳时间线+负载曲线+实时 WS strategy+移动端适配) 
- §4.2.8 data统计与analysis平台 (多层级 KPI 看板+7 种graph表type+角色自适应指标体系+DashboardMetricsDTO) 
- §4.2.9 configuremanage中心 (7 个子页面+完整 DTO+操作矩阵) 
- §4.6.8 运营看板四层面板详细规格扩展 (28 个面板+data源+graph表type+刷新strategy) 
- §4.6.11-4.6.13 三个新技术方案 (Agent 监控 Hook/统计graph表渲染架构/configure子页面路由+permissions矩阵编辑器) 
- §4.7.7-4.7.8 新增 AnalyticsDashboard + ConfigurationCenter mini-contract
- §5.2.2 新增 15 个 Planned API 端点; 路由表新增 8 条路由

**全文 Review 修复**: 

- **P0-1**: `/shared/settings/org` 幽灵路由 → 添加组织架构子页面到 §4.2.9
- **P0-2**: settings `[Implemented/Contracted]` vs ConfigCenter `[Planned]` 矛盾 → 改为 `[Implemented/Partial]`
- **P0-3**: 附录 B missing 13 个 WS 事件 → 已全部补充
- **P0-4**: `nl.clarification_needed` stateinconsistent → 统一为 `[Proposed]`
- **P1-1**: `runtime-decisions` Layer 2 graph标注 `[Deferred]` + 脚注
- **P1-2**: 9 个未规格化module → 新增 §4.2.10 已implementationmodule摘要
- **P1-3**: feature-flags 路由归属 → 路由表标注为"configuremanage子页面 §4.2.9"
- **P1-4**: §4.5.1 permissions矩阵新增 AgentMonitor/Analytics/ConfigCenter 3 行
- **P1-5**: `compliance_officer` 重映射为 `domain_admin+`
- **P1-6**: §7.2.5 新增 v3.0 moduletestingstrategy (ECharts + permissions矩阵编辑器) 
- **P1-7**: §5.1 子章节重编号 (5.1.1-5.1.6) 
- **P1-8**: 目录前添加溯源references说明
- **P2-1**: §7.3.4 graph表密集页面性能预算
- **P2-2**: §4.2.7-4.2.9 新增errorhandle与离线降级表
- **P2-3**: §6.4.3.1 复杂 UI 组件无障碍专项指南
- **P2-4**: §7.3.5 CI 构建影响评估
- **P2-5**: 移动端导航新增 AnalyticsScreen
- **P2-6**: 目录树新增 `analytics/` 目录
- **P2-7**: 审计log子页面标注为链接至 Governance → Audit
- **P2-9**: §5.2.1 新增 `/api/v1/meta/contract-version` 端点
- **P2-10**: turbo.json `"pipeline"` → `"tasks"` (Turborepo 2.x) 
- Layer 2 graph新增 `analytics` module |

---

## 0. Review 摘要与改进清单

> **仓内implementation备注 (2026-04-23) **: 当前仓库已新增 `ui/` 子工程, 作为本文档的implementation基线. 已落地content优先coverage `UI0-UI7`: 工程骨架, shared core, PlatformAdapter, design system, implemented-first feature registry, planned feature seam, Web 构建链路, 桌面/移动 smoke shell, 文档一致性testing, 以及按 `§7.4` 回写的 `Phase 1-4` 仓内代码基线. 

### 0.0 仓内 Phase 1-4 对齐快照 (2026-04-23) 

| Phase | 仓内对齐state | 当前仓内implementation |
| --- | --- | --- |
| Phase 1 — Web MVP | 基线已落地 | `apps/web` 可构建运行; `dashboard / task-cockpit / workflow-cockpit / approval / stability / alerts / dispatch / inspect / health / incidents / policy / audit / takeover / workers / queues / conversation / hitl / domain-wizard / settings` 已纳入 Web route registry 与 route guard, 并对齐 `HarnessRun / PlanGraphBundle / NodeAttemptReceipt` 的只读 presentation surface |
| Phase 2 — 桌面端 | 基线已落地 | `apps/electron-win / apps/tauri-macos / apps/tauri-linux` 已提供 shell manifest, default adapter, shared runtime 复用与 smoke test; `windowing / shell / process / analyticsConsent` 已有 PlatformAdapter baseline / test double |
| Phase 3 — 移动端 | 基线已落地 | `apps/mobile` 已提供 Android/iOS shell manifest, default adapter, deepLink / haptics / secure storage / screen security baseline 与 smoke test |
| Phase 4 — augmentation功能 | 基线已落地 | `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance` 已via typed seam + feature gate 进入仓内implementation; augmentationmodule仍按正文state标签继续演进, 并约束execute handoff 必须uses `PlanGraphBundle`, execute回执必须回链到 `NodeAttemptReceipt` |

补充说明: 

- 针对 [architecture-design-vs-implementation-review.md](../reviews/architecture-design-vs-implementation-review.md) 的 `UIR1-UIR6` 仓内整改已完成. 
- 当前 UI 子工程已提供 `npm install && npm run typecheck && npm test && npm run build` 闭环脚本. 
- 桌面与移动端按“smoke-ready 工程基线”验收, 不将商店发布, signature和真实原生桥接上线masks为仓内已闭环. 

本文档based on对 Doc-10 (1229 行) 和 Doc-11 (2341 行) 的full审查, 以及对后端 Interface Plane implementation的交叉验证, 识别出以下 12 项改进并在本文档中逐一落地. 

### 0.1 跨文档duplicate问题

| #   | 问题                                                                                                        | 影响                         | 本文档改进                                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| R-1 | 技术选型 (React 19 / Zustand / TanStack Query / pnpm / Turborepo) 在 Doc-10 §10.4 和 Doc-11 §3 几乎逐列duplicate | maintained成本翻倍, 改一处漏另一处 | 合并为单一 §2 技术选型, 消除duplicate               |
| R-2 | Monorepo 目录结构在 Doc-10 §10.5 和 Doc-11 §5.1 各写一遍, Doc-11 更详细但contains Doc-10 未coverage的子目录         | 两份不同粒度的目录树造成混淆 | 合并为单一 §3 工程结构, 以 Doc-11 详细版为基准 |
| R-3 | 认证流程在 Doc-10 §10.8 和 Doc-11 §20 均有完整描述, content高度overlap                                            | 同上                         | 合并为 §6.5 认证与会话安全                     |
| R-4 | 功能module列表在 Doc-10 §10.5 features/ 和 Doc-11 §8 核心页面蓝graph中均有定义                                   | modulenaming和分组不完全一致     | 合并为 §4 功能module蓝graph                         |

### 0.2 版本inconsistent

| #   | 问题              | Doc-10 值    | Doc-11 值 | 本文档统一值 | 理由                                                   |
| --- | ----------------- | ------------ | --------- | ------------ | ------------------------------------------------------ |
| V-1 | Electron 版本     | 33           | 34        | **34.x**     | Doc-11 为subsequent文档, 采用更新版本; Electron 34 已 stable |
| V-2 | React Native 版本 | 0.76         | 0.79      | **0.79**     | 同上; RN 0.79 New Architecture default启用, 性能更优      |
| V-3 | Vite 版本         | 未标注 major | 6         | **6.x**      | 明确lock定                                               |
| V-4 | TypeScript 版本   | 5.x          | 5.8+      | **5.8+**     | 与后端 tsconfig 对齐                                   |

### 0.3 后端对齐间隙

| #   | 问题                                                  | 详情                                                                                                                                                                                   | 本文档改进                                                            |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A-1 | UI 功能module与 UI contract页面映射不清                     | contract定义 5 页 (TaskCockpit/WorkflowCockpit/ApprovalCenter/StabilityPanel/AdminTakeoverConsole) ; Doc-10/11 定义 14 个 features module, 无explicitly映射                                        | §4 新增explicitly映射表                                                     |
| A-2 | REST API 端点含假设性端点                             | 该差距已在 2026-05-26 收口; `/api/v1/agents`, `/api/v1/dashboard/metrics`, `/api/v1/explanations`, `/api/v1/marketplace`, `/api/v1/knowledge`, `/api/v1/packs/:packId/versions`, `/api/v1/workflows/builder`, `/api/v1/meta/contract-version` 已有后端导出面 | §5.2, §5.2.3, §5.2.4 统一回写为当前真实state |
| A-3 | WebSocket 事件typeinconsistent                              | 后端 `TaskWebSocketEvent` 定义 6 种事件 (status_changed/progress/message_delta/artifact_ready/approval_requested/completed/failed) ; Doc-10 §10.6.3 列出 15 种 UI 事件, 多数无后端对应 | §5.3 按 [Implemented]/[Planned] 分层                                  |
| A-4 | MissionControlService 提供的视graph未在 UI 文档中references    | `getSnapshot()`/`getTaskCockpit()`/`getWorkflowCockpit()`/`getStabilityPanel()`/`getAdminTakeoverConsole()`/`listApprovalQueue()` 是现成后端entry                                       | §4 各页面蓝graphdirectlyreferences MCS 方法                                        |
| A-5 | Console 信息架构 (contract §3) 与 features module分组不对齐 | contract定义 4 组导航 (Mission Control/Operations/Governance/Admin) ; Doc-10/11 按 features 平铺                                                                                           | §4.1 采用contract信息架构作为一级导航                                     |

### 0.4 设计深度不足

| #   | 问题                                                                       | 本文档改进                                         |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| D-1 | 离线架构在 Web 端strategy模糊 (IndexedDB vs Service Worker cache 未分层)       | §5.5 明确 Web 离线三层strategy                         |
| D-2 | 24 域差异化 UI 引擎与后端 DomainDescriptor/DomainUIConfig 的对齐方式未定义 | §6.1 定义 DomainUIConfig 消费协议                  |
| D-3 | contract要求的 5 级下钻 (L1-L5) 在 UI 组件层无具体设计                         | §4.2 为 TaskCockpit/WorkflowCockpit 定义下钻组件树 |

---

## 目录

> **references说明**: 正文中形如"提取自 Doc-11 §24.1"的 `§` references指向已 Superseded 的 `11-cross-platform-ui-implementation-design.md` 原章节编号 (§编号 > 8) , only作溯源标注; 文档内部交叉referencesuses本文档章节编号. 

**Part I — 总体设计 (§1-§2) **

1. [设计概述与定位](#1-设计概述与定位)
   - 1.7 state标签约定 _(v2.2 新增)_ + state标签更新责任机制 _(v3.0 新增)_
   - 1.8 contract版本协商 _(v2.2 新增)_
2. [六平台技术选型](#2-六平台技术选型)
   - 2.6 桌面混合壳层治理规则 _(v2.2 新增)_

**Part II — 工程基座 (§3) **

3. [Monorepo 工程结构与分层架构](#3-monorepo-工程结构与分层架构)
   - 3.7.1 PlatformAdapter interface _(v2.2 扩展: windowing/shell/process/analyticsConsent/screenSecurity)_
   - 3.7.3 各平台implementationstrategy _(v3.0 新增, 提取自 Doc-11 §7.2)_
   - 3.7.4 适配器injection机制 _(v3.0 新增, 提取自 Doc-11 §7.3)_

**Part III — 功能module (§4) **

4. [功能module蓝graph与 UI contract对齐](#4-功能module蓝graph与-ui-contract对齐)
   - 4.2.7 Agent 实时监控中心 _(v3.0 新增)_
   - 4.2.8 data统计与analysis平台 _(v3.0 新增)_
   - 4.2.9 configuremanage中心 (permissions/功能开关/模型configure/域设置/tenant/Webhook)  _(v3.0 新增)_
   - 4.2.10 已implementationmodule摘要 _(v3.0 新增)_
   - 4.5 页面级permissions矩阵 _(v2.2 新增)_
   - 4.4.1 Web/桌面端路由表 (含permissions列 + Code Split 列)  _(v3.0 augmentation)_
   - 4.4.2 移动端导航结构 (含 Screen 层级 + 特性表)  _(v3.0 augmentation)_
   - 4.4.3 permissions路由guard链 _(v3.0 新增, 提取自 Doc-11 §9.3)_
   - 4.6 实施参考蓝graph _(v2.2 新增, 提取自 Doc-11)_
     - 4.6.1 NL 对话state机 → UI 映射
     - 4.6.2 HITL 操作面板与恢复模式
     - 4.6.3 Workflow 调试器能力矩阵
     - 4.6.4 审批中心交互特性
     - 4.6.5-4.6.10 页面线框graph _(v3.0 新增, 提取自 Doc-11 §8)_
     - 4.6.11-4.6.13 Agent 监控/统计平台/configuremanage技术方案 _(v3.0 新增)_
   - 4.7 Planned module mini-contract _(v2.3 新增)_ + authoritative/derived source 列 _(v3.0 新增)_
     - 4.7.7 AnalyticsDashboard _(v3.0 新增)_
     - 4.7.8 ConfigurationCenter _(v3.0 新增)_

**Part IV — data与通信 (§5) **

5. [data流, API 集成与实时层](#5-data流api-集成与实时层)
   - 5.1.1 Zustand Store / 5.1.2 TanStack Query / 5.1.3 QueryClient / 5.1.4 离线persistence / 5.1.5 data流模式 _(v3.0 编号)_
   - 5.1.6 ViewModel 映射规范 _(v2.2 新增, 原 §5.1.4 重编号)_
   - 5.2.3 Public UI API Surface 分层 _(v2.3 新增)_
   - 5.2.4 Internal → Contracted 升级清单 (API Graduation Matrix)  _(v3.0 新增)_
   - 5.3.6 WebSocket 订阅域模型 _(v2.2 新增)_
   - 5.4.1–5.4.5 API 通信层详情 _(v2.2 新增, 提取自 Doc-11 §6.1-6.3)_
   - 5.5.6 离线操作许可矩阵 _(v2.2 新增)_
   - 5.3.2.1-5.3.2.3 WSEventRouter 架构/事件→Query 映射/紧急事件 _(v3.0 新增)_
   - 5.4.6 pagination与filter标准化 _(v3.0 新增, 提取自 Doc-11 §12.2)_
   - 5.6 前端error分级与降级strategy _(v2.2 新增)_
   - 5.6.4 Mutation 幂等与重试规范 _(v2.3 新增)_
   - 5.6.5 optimistic更新模式 _(v3.0 新增, 提取自 Doc-11 §12.3)_
   - 5.6.6 HTTP state码→UI 行为映射 _(v3.0 新增, 提取自 Doc-11 §12.4)_

**Part IV-b — permissions与sanitized (§4 扩展) **

- 4.5.4 field级可见性与sanitized矩阵 _(v2.3 新增)_

**Part V — 平台治理 (§6) **

6. [域差异化, 多tenant, 安全与设计system](#6-域差异化多tenant安全与设计system)
   - 6.1.2 DomainUIConfig type定义 _(v2.2 扩展: featureVisibility/actionPolicy/defaultDrillDepth/glossaryOverrides)_
   - 6.1.5 域扩展 Slot 模式与dynamic加载 _(v3.0 新增, 提取自 Doc-11 §10.3-10.4)_
   - 6.2.3 data隔离strategy _(v3.0 新增, 提取自 Doc-11 §22.3)_
   - 6.3.1 设计令牌 _(v2.2 补充 primitive.ts)_
   - 6.3.2 核心组件库 _(v2.2 新增, 提取自 Doc-11 §15.2)_
   - 6.3.3 主题system (含暗色模式设计规则)  _(v3.0 新增, 提取自 Doc-11 §16.3)_
   - 6.4.2 语言优先级 (含翻译工作流)  _(v3.0 新增, 提取自 Doc-11 §17.3)_
   - 6.4.3.1 复杂 UI 组件无障碍专项指南 _(v3.0 新增)_
   - 6.5.4 前端安全基线 (含 CSP strategy)  + §6.5.5 敏感datahandle _(v3.0 新增)_
   - 6.6.3 移动端适配特殊考量 _(v3.0 新增, 提取自 Doc-11 §19.3)_

**Part VI — 工程化与交付 (§7) **

7. [CI/CD, testing, 性能与交付路线](#7-cicdtesting性能与交付路线)
   - 7.1.4 CI Stage 详情 _(v2.2 新增, 提取自 Doc-11 §24.1)_
   - 7.1.5 auto更新strategy _(v2.2 新增, 提取自 Doc-11 §24.4)_
   - 7.2.4 testing工具链 _(v2.2 新增, 提取自 Doc-11 §25.2)_
   - 7.2.5 v3.0 moduletestingstrategy _(v3.0 新增)_
   - 7.2.6 coverage率要求 _(v2.2 新增, 提取自 Doc-11 §25.3, 原 §7.2.5 重编号)_
   - 7.3.3 性能优化strategy (Web/移动端/桌面端详表)  _(v3.0 新增, 提取自 Doc-11 §23.2-23.4)_
   - 7.3.4 graph表密集页面性能预算 _(v3.0 新增)_
   - 7.3.5 CI 构建影响评估 _(v3.0 新增)_
   - 7.4 分阶段交付plan _(v2.2 增加 Gate 0-3 dependency门禁)_ + 团队configure建议 _(v3.0 新增)_
   - 7.5 risk与缓释 _(v3.0 新增 3 项补充risk)_

**附录**

- [附录 A: 后端 API 端点 → UI 功能完整映射](#附录-a)
- [附录 B: WebSocket 事件完整映射](#附录-b)
- [附录 C: ADR 决策index](#附录-c)
- [附录 D: 术语表](#附录-d)
- [附录 E: v2.3 整改清单 (P0/P1/P2) ](#附录-e) _(v2.3 新增)_

---

# Part I — 总体设计

---

# 1. 设计概述与定位

## 1.1 背景

Automatic Agent Platform 后端已完成五平面架构 (P1 Interface / P2 Control / P3 Orchestration / P4 Execution / P5 State-Evidence + X1 Reliability Fabric) 的开发, 拥有 79 个 CLI entry作为当前唯一交互方式. 后端为 Node.js 22 + TypeScript ESM 纯后端system, 零前端dependency. 

本文档定义coverage六大平台 (Web / Windows / macOS / Linux / Android / iOS) 的统一 UI 层, 使所有角色 (independent运营者 → 平台 SRE) 均可viagraph形界面完成日常操作. 

## 1.2 与五平面架构的关系

```text
┌─────────────────────────────────────────────────────────────────┐
│              本文档coveragerange: 跨平台 UI 层                         │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ Web  │ │ Win  │ │macOS │ │Linux │ │Droid │ │ iOS  │       │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘       │
│     └────────┴────────┴────────┴────────┴────────┘             │
│                        │                                        │
│              shared核心层 (TypeScript)                               │
│              API Client / State / Auth / Sync                    │
└────────────────────────┬────────────────────────────────────────┘
                         │  REST + WebSocket (§5.2/§5.3 API 与实时层) 
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             P1 Interface Plane (后端已implementation)                        │
│                                                                 │
│  ┌───────────────────┐ ┌────────────────────┐ ┌──────────────┐ │
│  │ HTTP API Server   │ │ WebSocket Server   │ │ Stream Bridge│ │
│  │ (task/admin/      │ │ (WebSocketBridge + │ │ (SSE)        │ │
│  │  console/dashboard│ │  DashboardWSServer │ │              │ │
│  │  routes)          │ │  + TaskWSRelay)    │ │              │ │
│  └───────────────────┘ └────────────────────┘ └──────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ MissionControlService — 所有 Cockpit 视graph的data聚合entry     │ │
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

**关键约束**: UI 层是 P1 Interface Plane 的**纯消费者**, 遵循 UP-1 (API-First) principle: 

- 所有datavia REST API (§5.2) 和 `ws/v1/stream` (§5.3) 获取
- 所有操作映射到标准 REST 端点
- 不引入旁路bypass P2 Control Plane 的strategycheck
- UI 展示state不得反向定义 task/workflow/execution 的 authoritative 事实 (contract §2.5) 

## 1.3 设计目标

| # | 目标       | 量化指标                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| G-1  | 六平台coverage | Web (Chrome/Firefox/Safari/Edge) + Windows 10+ + macOS 12+ + Linux(Ubuntu 22+/RHEL 9+) + Android 10+ + iOS 16+ |
| G-2  | 代码shared   | 跨平台shared率 ≥ 70%                                                                                             |
| G-3  | 性能       | Web FCP < 1.5s, LCP < 2.5s; 桌面启动 < 3s; 移动启动 < 2s                                                       |
| G-4  | 实时性     | WebSocket 事件 → UI 更新 < 200ms (P99)                                                                         |
| G-5  | 离线       | 移动端/Edge 场景支持离线操作 + 恢复synchronous                                                                        |
| G-6  | 无障碍     | WCAG 2.1 AA 合规                                                                                               |
| G-7  | 安全       | Token 安全存储; PII 不cached; 前端安全基线全coverage                                                                 |
| G-8  | 多tenant     | tenant级品牌定制 + 功能开关 + 合规模式                                                                           |
| G-9  | 角色全coverage | independent运营者(L1) · 业务线负责人(L1) · 域manage员(L2) · Pack 开发者(L2/L3) · 平台 SRE(L3/L4)                        |
| G-10 | 一致体验   | 同一user在不同平台上看到一致的data, 操作entry, 审批流                                                           |

## 1.4 设计principle

### 1.4.1 架构principle

| # | principle               | 说明                                                                                                                                                  |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| UP-1 | API-First          | UI 层是 P1 Interface Plane Public API (§5.2/§5.3) 的消费者, 不引入旁路. 所有操作映射到标准 REST/WebSocket 端点 (ADR-No-Code-UX-Maps-To-Standard-API)  |
| UP-2 | shared内核, 平台外壳 | 业务逻辑, statemanage, API 通信抽取为跨平台shared层; 渲染层按平台independentimplementation                                                                                  |
| UP-3 | 渐进augmentation           | 核心功能在所有平台可用; 高级功能 (调试器时间旅行, Workflow 画布拖拽) 在 Web/桌面端augmentation                                                                |
| UP-4 | 离线优先设计       | 移动端和 Edge 场景下, localcached + optimistic更新 + conflict解决为default模式                                                                                        |
| UP-5 | 实时为default         | 所有可变datadefaultvia WebSocket 实时推送, 轮询only作为 fallback                                                                                          |
| UP-6 | 安全不妥协         | Token 存储遵循平台安全最佳实践; PII 不cached到local                                                                                                      |
| UP-7 | 可插拔渲染         | 组件interface标准化, 渲染implementation可替换 (React DOM / React Native / Electron / Tauri WebView)                                                                  |
| UP-8 | contract驱动           | UI 信息架构, 页面field, 下钻深度严格遵循 `ui_console_and_cockpit_contract.md`, 不自行发明页面结构                                                      |

### 1.4.2 交互principle

| # | principle           | 说明                                                                                       |
| ---- | -------------- | ------------------------------------------------------------------------------------------ |
| UX-1 | 对话优先       | NL 对话框是所有平台的主entry (§4.1 NL Conversation module) , 任何时候user都可以切换到对话模式 |
| UX-2 | 渐进式信息披露 | default展示 L1 摘要, 按需展开 L2-L5 详情 (contract §7 五级下钻)                                   |
| UX-3 | 操作可撤销     | 所有非不可逆操作提供 Undo 缓冲 (5s 内可撤销) , 不可逆操作需二次confirmation                        |
| UX-4 | state可感知     | 网络state, synchronousstate, 离线队列深度始终可见                                                   |
| UX-5 | 上下文保持     | 页面切换/App 切回时恢复到离开时的精确位置和state                                            |
| UX-6 | 首页即健康     | Console 首页先回答"system是否健康, 当前在做什么, 卡在哪里" (contract §4)                         |

## 1.5 设计range

| range内                                    | range外                              |
| ----------------------------------------- | ----------------------------------- |
| 六平台 UI 壳层工程                        | 后端 API 开发 (已有)                |
| shared核心层 (state/API/Auth/synchronous)           | P1-P5 平面内部implementation变更              |
| contract定义的 5 核心页面 + 扩展功能module      | 单个业务域 Prompt details              |
| 设计system (Token/组件/主题)                | 视觉稿 (交由 UX 团队)               |
| 构建/testing/CI/CD 流水线                    | 基础设施物理部署 (Kubernetes configure)  |
| 多语言框架                                | 具体翻译content                        |
| 后端 API augmentation需求清单 (标注为 [Planned])  | 后端 API 的具体implementation                 |

## 1.6 角色与视graph映射

| 角色         | 级别  | 主要页面 (按contract信息架构)                                                | 平台偏好     |
| ------------ | ----- | ------------------------------------------------------------------------ | ------------ |
| independent运营者   | L1    | Dashboard · TaskCockpit · ApprovalCenter · 对话                          | Web / 移动端 |
| 业务线负责人 | L1    | Dashboard · TaskCockpit · ApprovalCenter · CostCenter                    | Web / 移动端 |
| 域manage员     | L2    | AgentManager · DomainWizard · Marketplace · Dashboard(L2)                | Web / 桌面端 |
| Pack 开发者  | L2/L3 | WorkflowBuilder · WorkflowDebugger · AgentManager · Marketplace          | Web / 桌面端 |
| 平台 SRE     | L3/L4 | StabilityPanel · AdminTakeoverConsole · Incidents · WorkerPanel · 调试器 | Web / 桌面端 |

## 1.7 state标签约定

本文档对所有 API 端点, WebSocket 事件, Feature module, PlatformAdapter 能力, DomainUIConfig field采用四级state标签, distinguish"已confirmation事实"和"设计目标": 

| 标签            | 含义                                                        | 颜色提示 |
| --------------- | ----------------------------------------------------------- | -------- |
| **Implemented** | 后端已implementation且经过testing, UI 可directly集成                         | 🟢 绿    |
| **Planned**     | 已纳入交付路线graph (§7.4) , 后端/前端即将implementation, interfacecontract已稳定 | 🔵 蓝    |
| **Proposed**    | 架构设计已完成但尚未进入开发排期, interface可能变更              | 🟡 黄    |
| **Deferred**    | 已识别需求但明确推迟到subsequent版本, 不blocks当前交付              | ⚪ 灰    |

**Implemented 二级子标签** _(v2.3 新增)_: 

`[Implemented]` 条目内部maintained三个成熟度子标签, 帮助前端团队评估集成risk: 

| 子标签                     | 含义                                                                                                     | 前端集成指导                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Implemented-Contracted** | 后端 service + HTTP route + OpenAPI/JSON schema 均已发布且冻结, 有publiccontract保障                           | Phase 1 可directly集成, 无额外对齐成本          |
| **Implemented-Internal**   | 后端 service method exists且经过testing, 但onlyvia内部 route (如 `/console/*` HTML) 暴露, 无public JSON contract | 需后端团队额外暴露 JSON API 或提供临时 mock |
| **Implemented-Partial**    | 后端 service method exists, partialfield/场景已implementation, 但 schema 尚未冻结或missing少边界场景coverage                      | 可开始集成但需做好 schema 变更的防御性编码  |

**子标签行内格式**: `[Implemented/Contracted]` `[Implemented/Internal]` `[Implemented/Partial]`

**uses规则**: 

- 表格中以 `[Implemented]` `[Planned]` `[Proposed]` `[Deferred]` 行内标注
- 本文档 §4.1 功能module表, §5.2 API 端点表, §5.3 WebSocket 事件表, §3.7 PlatformAdapter interface表, 附录 A/B 均已标注state
- 集成开发时, only `[Implemented/Contracted]` 条目可在 Phase 1 无条件directly对接; `[Implemented/Internal]` 和 `[Implemented/Partial]` 条目需在集成前与后端confirmation暴露方式和 schema 稳定性; `[Planned]` 条目须等待对应 Gate via (§7.4) 
- state标签由架构评审委员会在每个 Phase Gate 时更新; 子标签由后端 API owner 在每个 Sprint Review 时更新

**state标签更新责任机制** _(v3.0 新增)_: 

state标签的价值取决于其时效性. 以下矩阵定义了谁更新, 更新什么, 何时更新, 以及哪个 Gate forcevalidation: 

| 标签类别                                             | 更新责任人         | 更新content                            | 更新时机              | forcevalidation节点                  |
| ---------------------------------------------------- | ------------------ | ----------------------------------- | --------------------- | ----------------------------- |
| 四级state标签 (Implemented/Planned/Proposed/Deferred) | 架构评审委员会     | module/端点整体state升降级             | 每个 Phase Gate       | Gate 0/1/2/3 准入审查         |
| Implemented 子标签 (Contracted/Internal/Partial)     | 后端 API owner     | API Layer 级别变更, schema 冻结state | 每个 Sprint Review    | Phase Gate + Sprint Demo      |
| API Graduation Matrix (§5.2.4)                       | 后端 API owner     | `Current Layer` / `Status` 列       | 每个 Sprint Review    | 对应 Target Milestone 的 Gate |
| Feature modulestate                                     | 前端 Feature owner | UI 侧implementation进度, 集成state             | 每个 Sprint Review    | Phase Gate + Sprint Demo      |
| mini-contract (§4.7) 维度更新                        | Projection Owner   | DTO schema 变更, Query Keys 调整    | schema 变更时即时更新 | Phase Gate                    |
| PlatformAdapter 能力state                             | 平台适配层 owner   | 各平台适配器implementationstate                | 每个 Sprint Review    | Phase Gate                    |
| 附录 A/B 端点/事件state                               | 后端 API owner     | 端点新增/废弃, 事件implementationstate         | 后端发布时即时更新    | Phase Gate                    |

**force刷新规则**: 

- **Sprint Review**: 后端 API owner 和前端 Feature owner 各自更新所属标签; 未更新的标签在 Sprint Review 会议纪要中标记为 `[STALE]`
- **Phase Gate 准入**: Gate 审查前 48 小时, 所有该 Gate 涉及的标签必须 refresh; `[STALE]` 标签blocks Gate via
- **紧急变更**: 后端 breaking change 发布后 24 小时内, API owner 必须更新受影响的所有标签并notification前端 Feature owner
- **季度审计**: 每季度末架构评审委员会对全文档标签做一次fullvalidation, clearexpiry标签

## 1.8 contract版本协商

UI 层作为 P1 Interface Plane 的消费者, 必须与后端在多个contract维度保持版本compatibility: 

| contract维度              | 当前版本 | UI 支持range        | Mismatch handlestrategy                                                        |
| --------------------- | -------- | ------------------ | ------------------------------------------------------------------------ |
| REST API 版本         | v1       | v1                 | request头 `Accept-Version: v1`; 若后端return `406`, 显示升级提示并禁用写操作  |
| WebSocket Schema 版本 | v1       | v1                 | 握手时发送 `schema_version: 1`; 若协商failure, 降级为 REST 轮询             |
| DomainDescriptor 版本 | 由域定义 | ≥ 当前已知最低版本 | 启动时拉取 descriptor, 若 `version < minSupported`, 标记域为"降级模式"   |
| UI Contract 版本      | 1.0      | 1.0                | 前端启动时validation `/api/v1/meta/contract-version`; 不匹配时显示 banner 警告 |
| DomainUIConfig Schema | 1.0      | 1.0                | 未知field忽略 (前向compatibility) ; missing必需fieldusesdefault值并上报 telemetry         |

**降级行为**: 

- **API 版本不匹配**: 只读模式 + 顶部 banner "当前客户端版本与服务端不compatibility, 请升级"
- **WS 协商failure**: auto降级为 30s REST 轮询, state栏显示"实时更新不可用"
- **Contract 版本不匹配**: 功能正常但显示持久 banner, telemetry 上报 `contract_version_mismatch`
- **DomainDescriptor 过旧**: 该域页面显示"域configure版本过低"警告, 隐藏dependency新field的 UI 控件

---

# 2. 六平台技术选型

> **改进点 V-1~V-4**: 统一 Doc-10/Doc-11 版本divergence; 以更新的稳定版本为准. 

## 2.1 技术栈总览 (权威版本) 

| 平台        | 壳层技术          | 渲染引擎              | 原生桥接           | 安装包格式                     | 预估包体积 |
| ----------- | ----------------- | --------------------- | ------------------ | ------------------------------ | ---------- |
| **Web**     | React 19 + Vite 6 | React DOM             | PWA Service Worker | CDN / Docker nginx             | ~2MB gzip  |
| **Windows** | Electron 34       | Chromium (React DOM)  | Node.js + Win32    | MSIX / EXE (NSIS)              | ~120MB     |
| **macOS**   | Tauri 2.x         | WebKit (React DOM)    | Rust + AppKit      | DMG / Mac App Store            | ~15MB      |
| **Linux**   | Tauri 2.x         | WebKitGTK (React DOM) | Rust + GTK4        | AppImage / DEB / RPM / Flatpak | ~15MB      |
| **Android** | React Native 0.79 | Hermes + Fabric       | Kotlin/Java bridge | AAB (Play) / APK               | ~28MB      |
| **iOS**     | React Native 0.79 | JSI + Fabric          | Swift/ObjC bridge  | IPA (App Store / TestFlight)   | ~35MB      |

## 2.2 选型决策矩阵 (ADR-UI-001) 

| 决策点                  | 选项 A            | 选项 B           | 选项 C        | 决策            | 理由                                                                             |
| ----------------------- | ----------------- | ---------------- | ------------- | --------------- | -------------------------------------------------------------------------------- |
| UI 框架                 | React 19          | Vue 3            | Svelte 5      | **React 19**    | 与 RN 生态统一; 社区/组件库最成熟; 团队已有经验                                  |
| 移动端                  | React Native 0.79 | Flutter          | Capacitor     | **RN 0.79**     | 与 React 生态shared hooks/state; New Arch 性能已接近原生; 0.79 default启用 New Arch   |
| Windows 桌面            | Electron 34       | Tauri 2          | .NET MAUI     | **Electron 34** | Windows user基数最大, Electron 生态最成熟, 插件/调试工具完善                     |
| macOS/Linux 桌面        | Tauri 2           | Electron 34      | —             | **Tauri 2**     | 包体积小(15MB vs 120MB); Rust 后端安全性高; macOS/Linux 市场份额较低, Tauri 足够 |
| statemanage                | Zustand 5         | Redux Toolkit    | Jotai         | **Zustand 5**   | <1KB; TS 友好; middleware 生态(persist/immer); RN compatibility                           |
| 服务端state              | TanStack Query v5 | SWR 2            | Apollo Client | **TQ v5**       | autocached/deduplication/后台刷新/optimistic更新; 离线支持; 与 WebSocket 实时推送互补             |
| graph表库                  | ECharts           | Recharts         | Victory       | **ECharts**     | 大data量性能优; graph表type丰富; RN via WebView 嵌入                               |
| 画布 (Workflow 构建器)  | React Flow        | xyflow           | 自研          | **React Flow**  | 成熟的节点画布; TypeScript 原生; 社区活跃                                        |
| 包manage                  | npm workspaces    | Yarn 4 workspace | pnpm workspace | **npm workspaces** | 与当前仓内 `package.json` 一致; 零额外编排层                                      |
| 构建编排                | npm scripts       | Nx               | Turborepo     | **npm scripts** | 当前仓内由 workspace + app-level scripts 组成最小可用构建链路                    |

## 2.3 框架版本约束 (权威版本lock定) 

| 框架           | lock定版本 | 升级strategy                     |
| -------------- | -------- | ---------------------------- |
| React          | 19.x     | major lock定, minor 随发布升级 |
| React Native   | 0.79.x   | minor lock定, patch 随发布升级 |
| Electron       | 34.x     | major lock定, minor 随安全更新 |
| Tauri          | 2.x      | major lock定                   |
| TypeScript     | 5.8+     | 与后端 tsconfig 对齐         |
| Node.js        | 22 LTS   | 构建/CI uses, 与后端一致     |
| Vite           | 6.x      | major lock定                   |
| Zustand        | 5.x      | major lock定                   |
| TanStack Query | 5.x      | major lock定                   |
| React Flow     | 11.x     | 当前仓内基线; 升级到 12.x 需单列迁移 |
| ECharts        | 5.x      | major lock定                   |

## 2.4 跨平台代码复用矩阵

| 代码层                        | Web | Win(Electron) | Mac(Tauri) | Linux(Tauri) | Android(RN) | iOS(RN)   |
| ----------------------------- | --- | ------------- | ---------- | ------------ | ----------- | --------- |
| L3 shared核心 (state/api/auth)  | ✓   | ✓             | ✓          | ✓            | ✓           | ✓         |
| L2 React Hooks (useTask etc.) | ✓   | ✓             | ✓          | ✓            | ✓           | ✓         |
| L2 React DOM 组件             | ✓   | ✓             | ✓          | ✓            | ✗           | ✗         |
| L2 React Native 组件          | ✗   | ✗             | ✗          | ✗            | ✓           | ✓         |
| L1 平台壳层                   | Web | Electron      | Tauri      | Tauri        | RN Entry    | RN Entry  |
| L4 平台适配                   | Web | Electron      | Tauri      | Tauri        | RN Module   | RN Module |

**综合shared率估算**: ~72%

## 2.5 六平台适配strategy

### 2.5.1 Web 平台

```text
React 19 SPA + Vite 6
    │
    ├── PWA Service Worker
    │   ├── static资源cached (Cache-First) 
    │   ├── API responsecached (Network-First + Stale-While-Revalidate) 
    │   └── 离线 fallback 页面
    │
    ├── response式布局
    │   ├── ≥1440px: 完整三栏 (导航 + content + 侧面板) 
    │   ├── 1024-1439px: 两栏 (导航折叠 + content) 
    │   ├── 768-1023px: 单栏 + 汉堡菜单
    │   └── <768px: 移动视graph (建议uses原生 App) 
    │
    └── 性能指标
        ├── FCP < 1.5s (CDN + Code Splitting) 
        ├── LCP < 2.5s (关键path预加载) 
        ├── CLS < 0.1 (骨架屏 + fixed布局) 
        └── INP < 200ms (React concurrent features) 
```

### 2.5.2 Windows (Electron 34) 

| 特性     | implementation方式                                                            |
| -------- | ------------------------------------------------------------------- |
| windowmanage | 多window支持 (主window + 调试器window + 对话浮窗)                         |
| system集成 | system托盘常驻, Jump List (最近task/快速审批) , Windows Timeline 集成 |
| notification     | Windows Notification Center (审批/告警/task完成)                    |
| 快捷键   | Ctrl+K (命令面板) , Ctrl+N (新task) , Ctrl+Shift+D (调试器)         |
| auto更新 | electron-updater 增量更新 (差分包 ~5MB)                             |
| 性能     | 启动时间 < 3s (预加载 + persistencecached) ; in-memory < 300MB (空闲态)         |
| 安装包   | MSIX (企业组strategy分发) + EXE (个人安装)                              |

### 2.5.3 macOS (Tauri 2) 

| 特性      | implementation方式                                                     |
| --------- | ------------------------------------------------------------ |
| 原生感    | 遵循 HIG: Traffic Light window按钮, 原生菜单栏, Spotlight 集成 |
| windowmanage  | 原生全屏 + Split View 支持; Stage Manager compatibility               |
| Menu Bar  | 常驻 Menu Bar graph标 (未读审批计数 Badge)                      |
| Touch Bar | 上下文感知快捷操作 (审批按钮, taskstate切换)                  |
| notification      | macOS Notification Center + 关键告警 Critical Alert          |
| 安全      | App Sandbox + Hardened Runtime; Keychain 存储 Token          |
| 分发      | DMG (directly下载) + Mac App Store (企业 MDM 分发)               |
| 安装包    | ~15MB (Tauri, 无 Chromium 捆绑)                              |

### 2.5.4 Linux (Tauri 2) 

| 特性     | implementation方式                                                   |
| -------- | ---------------------------------------------------------- |
| 桌面环境 | 支持 GNOME 45+ (GTK4) 和 KDE Plasma 6+ (via XDG 标准)     |
| windowmanage | Wayland 优先, X11 fallback; 支持 tiling WM (i3/Sway)       |
| system托盘 | StatusNotifierItem (SNI) 协议; fallback 到 XEmbed          |
| notification     | D-Bus org.freedesktop.Notifications; 支持 dunst/mako       |
| filemanage | xdg-open 打开导出file; 遵循 XDG Base Directory 规范        |
| 主题     | auto检测system Dark/Light 模式 (GTK/KDE 主题跟随)            |
| 分发     | AppImage (通用) / Flatpak (沙箱) / DEB + RPM (system包manage)  |
| 安装包   | ~15MB (Tauri)                                              |

### 2.5.5 Android (React Native 0.79) 

| 特性     | implementation方式                                                        |
| -------- | --------------------------------------------------------------- |
| 最低版本 | Android 10 (API 29), 目标 API 35                                |
| 架构     | React Native 0.79 + New Architecture (Fabric + TurboModules)    |
| 导航     | 底部标签栏 (首页/task/审批/看板/更多) + Stack 导航              |
| notification     | FCM 推送; 前台notification通道分级 (审批=高优, task完成=default, 营销=低)  |
| 离线     | SQLite (Room) localcached + WorkManager 后台synchronous                   |
| 生物识别 | BiometricPrompt API (fingerprinting/面部解lock应用)                         |
| 手势     | 下拉刷新, 左滑删除/操作, 长按上下文菜单                         |
| 性能     | 启动 < 2s (Hermes 预编译 + App Startup Library)                 |
| Widget   | Android Widget (待审批计数 + 最近taskstate)                      |
| 包体积   | < 30MB (AAB 按架构split)                                         |

### 2.5.6 iOS (React Native 0.79) 

| 特性      | implementation方式                                                                 |
| --------- | ------------------------------------------------------------------------ |
| 最低版本  | iOS 16+, 目标 iOS 18                                                     |
| 架构      | React Native 0.79 + New Architecture (JSI + Fabric)                      |
| 导航      | UITabBarController 风格底部栏 + UINavigationController 风格堆栈          |
| notification      | APNs 推送; Notification Service Extension (富notification: 审批预览 + 快捷操作)  |
| 离线      | Core Data / SQLite (GRDB) + BackgroundTasks framework                    |
| 生物识别  | LocalAuthentication framework (Face ID / Touch ID)                       |
| Widget    | WidgetKit (Today Widget + Lock Screen Widget: 待审批, taskstate)          |
| Shortcuts | Siri Shortcuts 集成 ("嘿 Siri, 帮我查看今天的审批")                      |
| 手势      | iOS 标准手势 (边缘return, 3D Touch peek) ; Haptic Feedback                 |
| 性能      | 启动 < 1.5s (JSI 直调 + MetroBundle 预热)                                |
| 隐私      | App Tracking Transparency; Privacy Manifest 声明datatype                 |
| 包体积    | < 40MB                                                                   |

### 2.5.7 平台特性矩阵

| 特性     | Web                    | Windows                     | macOS                     | Linux             | Android            | iOS                |
| -------- | ---------------------- | --------------------------- | ------------------------- | ----------------- | ------------------ | ------------------ |
| notification     | Web Notification API   | Windows Notification Center | macOS Notification Center | libnotify / D-Bus | FCM Push           | APNs Push          |
| 生物识别 | WebAuthn               | Windows Hello               | Touch ID / Face ID        | —                 | Fingerprint / Face | Face ID / Touch ID |
| 安全存储 | —                      | Credential Manager          | Keychain                  | libsecret/kwallet | Android Keystore   | iOS Keychain       |
| file访问 | File System Access API | Win32 File API              | NSFileManager             | GIO/POSIX         | SAF/MediaStore     | UIDocumentPicker   |
| 深度链接 | URL routing            | Protocol handler            | Universal Links           | xdg-open          | App Links          | Universal Links    |
| 快捷键   | 标准 Web               | Ctrl+系列                   | Cmd+系列                  | Ctrl+系列         | —                  | —                  |
| system托盘 | —                      | System Tray                 | Menu Bar                  | System Tray       | —                  | —                  |
| auto更新 | Service Worker         | electron-updater            | Sparkle (Tauri)           | AppImage delta    | Google Play        | App Store          |
| 离线存储 | IndexedDB              | SQLite (better-sqlite3)     | SQLite (rusqlite)         | SQLite (rusqlite) | SQLite (Room)      | SQLite (GRDB)      |
| 剪贴板   | Clipboard API          | Win32 Clipboard             | NSPasteboard              | GTK Clipboard     | ClipboardManager   | UIPasteboard       |

## 2.6 桌面混合壳层治理规则 (ADR-UI-009) 

### 2.6.1 为什么不统一桌面壳层

Windows 采用 Electron 34, macOS/Linux 采用 Tauri 2.x -- 双栈parallel的决策based on以下收益-成本analysis: 

| 维度         | 统一 Electron            | 统一 Tauri                    | 双栈 (当前选择)  |
| ------------ | ------------------------ | ----------------------------- | ---------------- |
| Windows 体验 | ✅ 生态最成熟            | ⚠️ WebView2 dependency Edge Runtime | ✅ Electron 最优 |
| macOS 包体积 | ❌ ~120MB                | ✅ ~15MB                      | ✅ Tauri 15MB    |
| Linux compatibility性 | ⚠️ Chromium sandbox 受限 | ✅ WebKitGTK 原生             | ✅ Tauri 原生    |
| 安全表面     | ❌ Node.js 全permissions        | ✅ Rust 最小permissions              | ✅ 各平台最优    |
| maintained成本     | ✅ 单一栈                | ✅ 单一栈                     | ⚠️ 两套原生桥接  |
| 插件生态     | ✅ npm 生态丰富          | ⚠️ Tauri 插件尚在成长         | ✅ 各取所长      |

**结论**: 双栈的额外maintained成本 (约 15% 的桌面特定代码) 被更优的平台体验和安全性所抵消. 

### 2.6.2 PlatformAdapter 边界规则

| 能力类别          | 必须via PlatformAdapter | allows分叉implementation | 说明                                                         |
| ----------------- | ------------------------ | ------------ | ------------------------------------------------------------ |
| windowmanage          | ✅                       | ❌           | `windowing` interface统一抽象 (§3.7.1)                            |
| filesystem访问      | ✅                       | ❌           | via `fileAccess` interface, 禁止directlycall Node.js fs / Rust fs    |
| 安全存储          | ✅                       | ❌           | Token/密钥存储必须走 `secureStorage` interface                    |
| 剪贴板            | ✅                       | ❌           | 已在 v2.1 定义                                               |
| 深度链接          | ✅                       | ❌           | 已在 v2.1 定义                                               |
| notification              | ✅                       | ❌           | 跨平台notificationinterface                                               |
| system托盘/Menu Bar | ❌                       | ✅           | Electron Tray vs Tauri SystemTray API 差异too large, allows各自implementation |
| auto更新          | ❌                       | ✅           | electron-updater vs Tauri updater 机制不同                   |
| 原生菜单          | ❌                       | ✅           | 平台菜单规范差异大 (Windows Menu Bar vs macOS App Menu)      |

### 2.6.3 桌面端testing矩阵split

| testing层级     | Electron (Windows)              | Tauri (macOS/Linux)                 | shared                          |
| ------------ | ------------------------------- | ----------------------------------- | ----------------------------- |
| 单元testing     | Vitest + jsdom                  | Vitest + jsdom                      | 100% shared (shared/ 层)        |
| 集成testing     | Playwright + Electron launch    | Playwright + Tauri WebDriver        | testing用例shared, driver 层分叉   |
| E2E testing     | Spectron / Playwright Electron  | tauri-driver + WebDriver            | 页面级场景脚本shared            |
| 平台特定testing | Win32 API mock · MSIX 安装/卸载 | AppKit/GTK mock · DMG/AppImage 验证 | 不shared                        |
| CI 矩阵      | windows-latest runner           | macos-latest + ubuntu-latest runner | shared lint/typecheck/unit 阶段 |

---

# Part II — 工程基座

---

# 3. Monorepo 工程结构与分层架构

> **改进点 R-2**: 合并 Doc-10 §10.5 和 Doc-11 §5.1 的目录结构为单一权威版本. 

## 3.1 四层分层模型

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1 — 平台壳层 (Platform Shell)                                   │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌─────┐│
│  │ Web SPA  │ │ Electron │ │ Tauri  │ │ Tauri  │ │ RN    │ │ RN  ││
│  │ (Vite 6) │ │ 34 (Win) │ │ 2(Mac) │ │2(Linux)│ │(Droid)│ │(iOS)││
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬────┘ └──┬──┘│
├───────┴────────────┴───────────┴──────────┴─────────┴─────────┴────┤
│  Layer 2 — 功能module层 (Feature Modules)                               │
│  按contract信息架构 (§3) 四组导航分组:                                      │
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
│  Layer 3 — shared核心层 (Shared Core) — 100% 跨平台                    │
│  ┌───────────┐┌──────────┐┌────────┐┌────────┐┌───────┐┌────────┐│
│  │api-client ││  state   ││  auth  ││  sync  ││  i18n ││telemetry││
│  ├───────────┤├──────────┤├────────┤├────────┤├───────┤├────────┤│
│  │ domain    ││permission││nl-client││ws-mgr ││ types ││error-hdl││
│  └───────────┘└──────────┘└────────┘└────────┘└───────┘└────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Layer 4 — 平台适配层 (Platform Adapters) — 0% shared                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Web API  │ │ Node.js  │ │ Rust     │ │ Android  │ │ iOS      ││
│  │ (fetch)  │ │(Electron)│ │ (Tauri)  │ │ (Bridge) │ │ (Bridge) ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
└────────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌────────────────────────────────────────────────────────────────────┐
│          Platform Backend (P1 Interface Plane, §6 API)              │
└────────────────────────────────────────────────────────────────────┘
```

> \* `runtime-decisions` 标记为 `[Deferred]`, 待 v2.5 评审后确定是否independent为功能module. 

## 3.2 各层职责与约束

| 层次          | 职责                                           | shared率 | 技术约束                            |
| ------------- | ---------------------------------------------- | ------ | ----------------------------------- |
| L1 平台壳层   | 平台entry, windowmanage, system集成, 原生notification         | 0%     | 每平台independentimplementation                      |
| L2 功能module层 | 页面组件, 路由, 业务交互逻辑                   | ~60%   | Web/桌面shared React DOM; RN independent组件 |
| L3 shared核心层 | state, API, Auth, synchronous, 领域逻辑, type, 遥测    | 100%   | 纯 TypeScript, 零平台dependency           |
| L4 平台适配层 | 网络, 存储, notification, 生物识别, filesystem的平台封装 | 0%     | 统一interface, 平台independentimplementation              |

## 3.3 dependency规则

```text
L1 → L2 → L3 ← L4
              ↑
         L4 implementation L3 定义的interface
```

- L3 不可dependency L1/L2 (纯逻辑层) 
- L2 可dependency L3, 不可directlydependency L4 (via L3 的interfaceindirectlyuses L4 能力) 
- L1 可dependency L2/L3/L4
- L4 不可dependency L1/L2/L3 (onlyimplementation L3 定义的 `PlatformAdapter` interface) 
- 功能module间via L3 shared核心通信, 不directly互相导入

## 3.4 目录全景 (权威版本) 

```text
ui/                                    # UI Monorepo 子工程 (npm workspaces) 
├── package.json                       # 根 workspace 与脚本entry
├── package-lock.json                  # lock定dependency版本
├── tsconfig.json                      # shared TypeScript 基线
├── eslint.config.js                   # ESLint 9 configure
├── vitest.config.ts                   # Vitest testingconfigure
├── .storybook/                        # Storybook configure
├── .env.example                       # UI 环境变量模板
├── apps/                              # L1 平台壳层entry
│   ├── web/                           # React 19 + Vite 6 SPA
│   ├── electron-win/                  # Electron Windows smoke shell
│   ├── tauri-macos/                   # Tauri macOS smoke shell
│   ├── tauri-linux/                   # Tauri Linux smoke shell
│   └── mobile/                        # React Native smoke shell
├── packages/
│   ├── shared/                        # L3 shared核心层
│   │   ├── api-client/                # RESTClient / WSClient / endpoint catalog
│   │   ├── auth/                      # auth-service / token-manager / session-guard
│   │   ├── state/                     # stores + query factories
│   │   ├── sync/                      # offline queue / conflict resolver / coordinator
│   │   ├── i18n/                      # TranslationService + ICU MessageFormat
│   │   ├── domain/                    # route guard / redaction / DomainUIConfig
│   │   ├── nl-client/                 # ConversationClient 基线
│   │   ├── telemetry/                 # TelemetrySink + OTLP exporter
│   │   ├── platform/                  # PlatformAdapter 工厂与defaultimplementation
│   │   └── types/                     # DTO 与sharedtype
│   ├── ui-core/                       # Web/桌面shared UI 组件
│   ├── ui-mobile/                     # React Native shared UI 组件
│   └── features/                      # 功能module
│       ├── dashboard/ ... analytics/
│       └── governance-compliance/     # 内部扩展module (不注册到public route catalog) 
├── tests/                             # Vitest 文档/shared层/应用壳testing
└── docs/
    ├── storybook/
    └── adr/
```

## 3.5 包manage与构建configure

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
| npm workspace            | Monorepo 包manage                           |
| Vite 6                   | Web 构建 (dev server + production build)  |
| Metro                    | React Native 构建                         |
| electron-builder         | Windows 打包 (MSIX / EXE)                 |
| tauri-cli                | macOS/Linux 打包                          |
| TypeScript 5.8+ (strict) | typecheck, 与后端 tsconfig 对齐            |
| Vitest                   | 单元testing (shared层 + 组件)                  |
| Storybook                | 组件隔离开发与视觉基线                    |
| Playwright / Detox       | 目标态 E2E 工具链 (当前仍为 Planned)      |

### 常用命令

| 命令                                 | 说明                  |
| ------------------------------------ | --------------------- |
| `npm install`                        | 安装所有dependency          |
| `npm run typecheck`                  | fulltypecheck          |
| `npm test`                           | full Vitest testing      |
| `npm run test:e2e`                   | 仓内 smoke E2E 基线   |
| `npm run build`                      | 先 typecheck 再构建 Web |
| `npm run dev:web`                    | 启动 Web 开发服务器   |

## 3.6 包dependency关系graph

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
tools/e2e ──→ (runtimedependency, 不构建dependency)
```

## 3.7 shared核心层关键interface

### 3.7.1 PlatformAdapter interface (L3 定义, L4 implementation) 

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

当前仓内同时提供 `createPlatformAdapterCapabilityView(adapter)`, 把上述扁平方法投影为 `secureStorage / offlineStore / clipboard / deeplink / lifecycle / haptics / windowing / shell / process / analyticsConsent / screenSecurity` 等嵌套能力视graph, 便于 UI 层按能力组消费. 

**PlatformAdapter 能力state总览 (按当前代码口径) **: 

| 能力组           | 方法数 | state          | 平台适用                   | 说明                      |
| ---------------- | ------ | ------------- | -------------------------- | ------------------------- |
| `platform`       | 1      | [Implemented] | 全平台                     | 平台 ID 标识              |
| `fetch`          | 1      | [Implemented] | 全平台                     | 网络request抽象              |
| secureStorage    | 3      | [Implemented] | 全平台                     | `read/write/deleteSecureValue` |
| offlineStore     | 2      | [Implemented] | 全平台                     | `readFile/writeFile`      |
| clipboard        | 1      | [Implemented] | 全平台                     | `copyToClipboard`         |
| deeplink         | 1      | [Implemented] | 全平台                     | `openDeepLink`            |
| lifecycle        | 2      | [Implemented] | 全平台                     | foreground/background 监听 |
| haptics          | 1      | [Implemented] | 全平台                     | `vibrate`, 非移动端可 no-op |
| windowing        | 1      | [Implemented] | 桌面端优先                 | `openWindow` smoke baseline |
| shell            | 1      | [Implemented] | 桌面端优先                 | `runShell` smoke baseline |
| process          | 1      | [Implemented] | 全平台                     | `spawnProcess`            |
| analyticsConsent | 2      | [Implemented] | 全平台                     | `get/setAnalyticsConsent` |
| screenSecurity   | 1      | [Implemented] | 桌面端 + 移动端            | `enableScreenSecurity`    |

未纳入当前sharedcontract的notification, 生物识别和file选择等能力, 按平台壳层专用能力manage, 不在 `@aa/shared-types` 的统一 `PlatformAdapter` 中定义. 

### 3.7.2 WebSocket Manager interface

```typescript
interface WSManager {
  connect(url: string, token: string): void;
  disconnect(): void;
  subscribe(channel: string, handler: (event: WSEvent) => void): () => void;
  getState(): "connecting" | "connected" | "disconnected" | "reconnecting";
  onStateChange(cb: (state: WSState) => void): () => void;
}
```

### 3.7.3 各平台implementationstrategy

| 能力组          | Web                         | Electron (Win)           | Tauri (Mac/Linux)     | RN (Android)        | RN (iOS)            |
| --------------- | --------------------------- | ------------------------ | --------------------- | ------------------- | ------------------- |
| `fetch`         | `window.fetch`              | `globalThis.fetch` bridge | `globalThis.fetch` bridge | RN `fetch`       | RN `fetch`          |
| secureStorage   | in-memory / cookie seam     | default adapter test double | default adapter test double | default adapter test double | default adapter test double |
| offlineStore    | in-memory file map          | in-memory file map       | in-memory file map    | in-memory file map | in-memory file map |
| clipboard       | browser API seam            | shell bridge seam        | Tauri bridge seam     | RN bridge seam      | RN bridge seam      |
| lifecycle       | foreground/background 事件  | shell 生命周期事件       | shell 生命周期事件    | AppState seam       | AppState seam       |
| deeplink        | router / URL scheme seam    | protocol handler seam    | universal link seam   | app links seam      | universal link seam |
| windowing       | new tab / modal seam        | BrowserWindow seam       | Tauri window seam     | 不适用              | 不适用              |
| shell/process   | no-op / mock                | shell + child process seam | shell + process seam | 不适用              | 不适用              |

### 3.7.4 适配器injection机制

应用启动时, L1 壳层创建平台适配器实例并injection到 L3 shared核心层: 

```text
L1 App 启动
  │
  ├─ 创建 PlatformAdapter 实例 (平台特定implementation) 
  │
  ├─ 初始化 L3 shared核心层
  │   ├─ RESTClient(adapter.fetch)
  │   ├─ AuthService(adapter 或 adapter.capabilities.secureStorage)
  │   ├─ SyncEngine(adapter.capabilities.offlineStore, adapter.capabilities.lifecycle)
  │   └─ Platform services(adapter.capabilities.*)
  │
  └─ 渲染 L2 功能module UI
```

React 层via Context Provider injection: 

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

# Part III — 功能module

---

# 4. 功能module蓝graph与 UI contract对齐

> **改进点 A-1, A-4, A-5, D-3**: explicitly映射 UI 功能module → contract页面 → 后端服务方法; 按contract信息架构 (§3) 组织导航; 定义五级下钻组件树. 

## 4.1 信息架构与导航映射

按 `ui_console_and_cockpit_contract.md` §3 定义的四组导航, 每个前端功能moduleexplicitly对应后端data源: 

| 导航组          | 功能module            | contract页面                   | 后端data源                                                    | state                     | 平台可用性    |
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
| Admin           | `workers`           | Workers                    | `GET /api/v1/workers` + MissionControlService.getStabilityPanel() | [Implemented/Contracted] | Web/桌面      |
| Admin           | `queues`            | Queues                     | `GET /api/v1/queues` + MissionControlService.getStabilityPanel()  | [Implemented/Contracted] | Web/桌面      |
| Extended        | `conversation`      | NL 对话                    | NLEntryService + IntentParser + ConversationHistoryService    | [Implemented/Partial]    | 全平台        |
| Extended        | `workflow-builder`  | —                          | WorkflowBuilderService (interaction/ux/)                      | [Planned]                | Web/桌面      |
| Extended        | `workflow-debugger` | —                          | DebuggerService + inspect CLI                                 | [Planned]                | Web/桌面      |
| Extended        | `agent-manager`     | Agent 监控中心 (§4.2.7)    | `GET /api/v1/agents` + MissionControlService stable worker projection | [Implemented/Contracted] | 全平台        |
| Extended        | `hitl`              | —                          | HITL notification module + approval-routes                    | [Implemented/Partial]    | 全平台        |
| Shared          | `explainability`    | —                          | `GET /api/v1/explanations`                                    | [Implemented/Contracted] | Web/桌面      |
| Shared          | `cost-center`       | —                          | [Planned] `/api/v1/costs`                                     | [Planned]                | Web/桌面      |
| Shared          | `marketplace`       | —                          | `GET /api/v1/marketplace` + `GET /api/v1/packs/:packId/versions` | [Implemented/Contracted] | Web/桌面/移动 |
| Shared          | `domain-wizard`     | —                          | DomainOnboardingService (interaction/ux/onboarding/)          | [Implemented/Internal]   | Web/桌面      |
| Shared          | `settings`          | configuremanage中心 (§4.2.9)      | admin-routes + user preference API + DomainUIConfig           | [Implemented/Partial]    | 全平台        |
| Shared          | `analytics`         | data统计平台 (§4.2.8)      | `GET /api/v1/dashboard/metrics` + MissionControlService       | [Implemented/Contracted] | 全平台        |

## 4.2 contract核心页面蓝graph

### 4.2.1 Dashboard (首页) 

> contract §4: 首页先回答"system是否健康, 当前在做什么, 卡在哪里". 

**data源**: `MissionControlService.getSnapshot()` → `shared_snapshot` (contract §6.1) 

```text
┌─────────────────────────────────────────────────────────────┐
│ System Status Bar                                           │
│ [overall_health] [queue_depth] [active_executions]          │
│ [approval_backlog] [alert_summary]                          │
├─────────────────────────────────────────────────────────────┤
│ Current Focus (第一屏)                                       │
│ ┌─────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Active Tasks    │ │ Active Workflows │ │ Approval Queue│ │
│ │ (card list)     │ │ (card list)      │ │ (card list)   │ │
│ └────────┬────────┘ └────────┬─────────┘ └──────┬────────┘ │
│          │ → TaskCockpit     │ → WfCockpit      │ → Approval│
├─────────────────────────────────────────────────────────────┤
│ Attention Required (第二屏)                                   │
│ ┌─────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Blocked Reasons │ │ Stale/Recovery   │ │ High-Risk     │ │
│ │                 │ │ Summary          │ │ Decisions     │ │
│ └─────────────────┘ └──────────────────┘ └───────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ NL Conversation Dock (常驻底部/侧边, UX-1 对话优先)           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2.2 TaskCockpit (五级下钻) 

> contract §5.1 + §7: 五级下钻 (L1-L5) . 

**data源**: `MissionControlService.getTaskCockpit()` + `task-routes`

| 下钻级别 | 展示content                             | UI 组件                 | data端点                          |
| -------- | ------------------------------------ | ----------------------- | --------------------------------- |
| L1       | task list + status                   | `<TaskListView>`        | `GET /api/v1/tasks`               |
| L2       | task details + workflow state        | `<TaskDetailPanel>`     | `GET /api/v1/tasks/{id}`          |
| L3       | step outputs + tool calls            | `<StepOutputViewer>`    | task detail 嵌套data              |
| L4       | approval / decision / evidence chain | `<EvidenceChainViewer>` | `GET /api/v1/tasks/{id}/evidence` |
| L5       | trace / replay / recovery timeline   | `<TimelineViewer>`      | `GET /api/v1/tasks/{id}/timeline` |

**contract约束落地**: 

- `completed` state: L2 面板显示 "View Evidence" 按钮, 直达 L4
- `blocked` state: L2 面板force显示 `blocked_reason` + `source`, 不allowsonly显示"等待中"
- `failed` state: L2 面板显示 `error_code` + `last_step` + "Recovery History" entry, 直达 L5

**最小field** (contract §5.1) : 

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

**最小动作**: 打开 inspect · 查看 timeline · 查看 artifacts · canceltask · 进入人工接管

### 4.2.3 WorkflowCockpit (五级下钻) 

**data源**: `MissionControlService.getWorkflowCockpit()`

| 下钻级别 | 展示content                         | UI 组件                                 |
| -------- | -------------------------------- | --------------------------------------- |
| L1       | workflow list + status           | `<WorkflowListView>`                    |
| L2       | workflow details + step DAG      | `<WorkflowDetailPanel>` + `<DAGViewer>` |
| L3       | step outputs + tool calls        | `<StepOutputViewer>`                    |
| L4       | approval nodes + evidence refs   | `<EvidenceChainViewer>`                 |
| L5       | compensation / replay / recovery | `<RecoveryTimeline>`                    |

**最小field** (contract §5.2) : 

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

**data源**: `MissionControlService.listApprovalQueue()` + approval-routes

**最小field** (contract §5.3) : 

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

**最小动作**: approve · reject · request_more_context · open_explanation

**UI 约束**: 

- 高risk审批 (risk_level = "high" | "critical") 必须展示risk等级, strategy来源, 审批链和接管entry (contract §2.4) 
- 移动端支持推送notification + 快捷操作 (approve/reject 不进入 App) 

### 4.2.5 StabilityPanel

**data源**: `MissionControlService.getStabilityPanel()`

**最小field** (contract §5.4) : 

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

**最小动作**: drill into stuck task · inspect backlog · open recovery evidence · trigger incident workflow

### 4.2.6 AdminTakeoverConsole

**data源**: `MissionControlService.getAdminTakeoverConsole()`

**最小field** (contract §5.5) : 

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

**最小动作**: retry_step · skip_step · override_step_output · switch_worker · manual_cancel · mark_unrecoverable

### 4.2.7 Agent 实时监控中心 _(v3.0 新增)_

> 实时监控所有 Agent 的健康state, 心跳, 能力, 负载, 并提供manage操作. 

**data源**: `GET /api/v1/agents` [Implemented/Contracted Layer C] + `MissionControlService.getStabilityPanel()` 派生 worker/agent 投影 + `agent.health_changed` WS 事件

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Agent 监控中心                                              [⟳ 10s] │
├──────────┬───────────────────────────────────────────────────────────┤
│ 筛选栏   │ [域▼] [state▼] [健康▼] [能力▼] [search...]                 │
├──────────┴───────────────────────────────────────────────────────────┤
│ 概览卡片                                                            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ 总数 47  │ │🟢正常 38 │ │🟡降级 5  │ │🔴离线 3  │ │⚪not registered 1│  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ Agent 列表 (实时更新)                                                │
│ ┌─────┬────────┬──────┬────────┬─────────┬──────────┬────────────┐ │
│ │ 名称│ 域     │ state │ 健康度 │ 心跳    │ 版本     │ 操作       │ │
│ ├─────┼────────┼──────┼────────┼─────────┼──────────┼────────────┤ │
│ │ ... │ ...    │ 🟢   │ 98%    │ 3s ago  │ v1.2.0   │ [详情][重启]│ │
│ └─────┴────────┴──────┴────────┴─────────┴──────────┴────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ Agent 详情面板 (右侧抽屉 / 点击展开)                                 │
│ ┌─────────────────────────────────────┐                             │
│ │ [基本信息] [能力列表] [心跳历史]    │                             │
│ │ [负载曲线] [最近task] [errorlog]    │                             │
│ │                                     │                             │
│ │ 心跳时间线 ────────●────●────●──── │                             │
│ │ 负载折线graph ──╱╲──╱╲──╱╲────────── │                             │
│ │                                     │                             │
│ │ [重启] [注销] [更新configure] [查看log] │                             │
│ └─────────────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
```

**最小field**: 

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

**最小动作**: list · filter · get(id) · restart · deregister · update_config · view_logs · export_report

**实时strategy**: 

| data项     | 刷新方式                                     | strategy                                     |
| ---------- | -------------------------------------------- | ---------------------------------------- |
| Agent 列表 | WS `agent.health_changed` + polling fallback | WS 优先, 10s polling 兜底; staleTime: 5s |
| 概览卡片   | 从列表data聚合                               | 客户端聚合, 无额外request                   |
| 心跳历史   | `GET /api/v1/agents/{id}/heartbeats`         | 进入详情时加载, 60s staleTime            |
| 负载曲线   | `GET /api/v1/agents/{id}/metrics`            | 进入详情时加载, 30s staleTime + WS delta |
| Agent 详情 | `GET /api/v1/agents/{id}`                    | 5s staleTime, WS 触发 invalidate         |

**移动端适配**: 列表视graph简化为卡片流 (名称 + state + 健康度 + 心跳) , 详情面板全屏展开, 隐藏重启/注销等危险操作 (需进入 Web/桌面端操作) . 

**errorhandle与离线降级**: 

| 场景                  | 行为                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| WS 断开               | auto降级为 10s polling; 顶部黄色 Banner "实时连接已断开, data可能延迟"; WS 恢复后auto切回     |
| API requestfailure (≤3 次)  | auto重试 (指数backoff 1s/2s/4s) ; 重试期间 skeleton 保持, 不闪烁                                 |
| API requestfailure (>3 次)  | 显示内联error卡片 (含"重试"按钮) ; 已cacheddata继续展示并标注"data截至 {timestamp}"              |
| 离线模式              | 展示最后一次cached的 Agent 列表 (只读) ; 禁用 restart/deregister 等写操作按钮, tooltip 提示离线 |
| Agent 详情 404        | 显示 "Agent 已注销或不可达" 空state; 提供"return列表"链接                                        |

### 4.2.8 data统计与analysis平台 _(v3.0 新增)_

> 多层级运营指标看板, coveragetask, Agent, Workflow, 成本, SLO 等全维度统计. 

**data源**: `GET /api/v1/dashboard/metrics` [Implemented/Contracted Layer C] + `MissionControlService.getSnapshot()` + `CostTrackingService` + `dashboard.metric_updated` WS 事件

```text
┌──────────────────────────────────────────────────────────────────────┐
│ data统计与analysis          [时间range▼] [域▼] [导出▼]          [⟳ Auto] │
├──────────────────────────────────────────────────────────────────────┤
│ KPI 概览 (角色自适应)                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │task总量  │ │success率    │ │平均耗时  │ │活跃Agent │ │SLO达标率 │  │
│ │ 1,247    │ │ 94.2%    │ │ 3m 24s   │ │ 38/47    │ │ 99.1%    │  │
│ │ ↑12%     │ │ ↑2.1%    │ │ ↓15%     │ │ —        │ │ ↑0.3%    │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ task趋势折线graph             │ │ state分布饼graph               │      │
│ │ (ECharts Line)             │ │ (ECharts Pie)              │      │
│ │ 维度: success/failure/cancel       │ │ 维度: running/blocked/done │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Agent 利用率热力graph          │ │ 成本趋势+预算水位         │      │
│ │ (ECharts Heatmap)          │ │ (ECharts Line+Area)        │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
│ ┌────────────────────────────┐ ┌────────────────────────────┐      │
│ │ Top 10 failure原因 (Bar)      │ │ Workflow execute耗时 (Box)    │      │
│ └────────────────────────────┘ └────────────────────────────┘      │
├──────────────────────────────────────────────────────────────────────┤
│ 明细表格 (可下钻)                                                    │
│ [task明细] [Agent明细] [Workflow明细] [审批明细] [成本明细]           │
└──────────────────────────────────────────────────────────────────────┘
```

**指标体系 (按角色层级) **: 

| 指标分类 | L1 操作者                 | L2 域manage                        | L3 SRE                                | L4 舰队manage                    |
| -------- | ------------------------- | -------------------------------- | ------------------------------------- | ------------------------------ |
| task     | 我的task数/success率         | 域task吞吐量/平均耗时/failure Top 5 | 全平台task趋势/积压队列深度           | 跨区域task分布/延迟对比        |
| Agent    | 我常用 Agent 健康         | 域 Agent 利用率/健康分布         | 全平台 Agent 负载热力graph/心跳异常率    | 舰队 Agent 容量规划/利用率趋势 |
| Workflow | —                         | 域 Workflow execute耗时/success率      | Workflow stepbottleneckanalysis/重试率          | 跨域 Workflow 对比             |
| 审批     | 我的待审批数/平均response时间 | 域审批积压/timeout率                | 全平台审批 SLA                        | 审批链路效率对比               |
| 成本     | 我的task成本              | 域成本/预算uses率/模型成本分布   | 全平台成本趋势/预算预警               | 舰队成本对比/容量-成本效率     |
| SLO      | —                         | 域 SLO 达标率                    | 全平台 SLO 仪表盘/error预算燃尽        | 跨区域 SLO 对比                |
| system健康 | —                         | —                                | 五平面健康/P99 延迟/error率/资源利用率 | 跨区域健康对比/容量预测        |

**最小field**: 

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

**graph表组件映射**: 

| 指标          | graph表type      | ECharts 组件 | 刷新strategy                          |
| ------------- | ------------- | ------------ | --------------------------------- |
| task趋势      | 折线graph        | LineChart    | 1min polling + WS delta           |
| state分布      | 饼graph/环形graph   | PieChart     | 30s staleTime                     |
| Agent 利用率  | 热力graph        | Heatmap      | 30s polling                       |
| 成本趋势      | 面积graph+折线graph | LineChart    | 5min staleTime                    |
| Top failure原因  | 水平柱状graph    | BarChart     | 1min staleTime                    |
| Workflow 耗时 | 箱线graph        | BoxPlot      | 5min staleTime                    |
| SLO 达标率    | 仪表盘        | Gauge        | 1min polling                      |
| system健康      | 多轴折线      | LineChart    | 10s polling (SRE) / 1min (others) |

**移动端适配**: KPI 卡片横向滚动, graph表单列堆叠, 支持下拉刷新. 明细表格改为卡片列表, 下钻via全屏弹层implementation. 

**errorhandle与离线降级**: 

| 场景                  | 行为                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| metrics API timeout/failure | KPI 卡片显示 "--" placeholder + "加载failure" 标注; 已cacheddata展示并标注时间戳                                |
| 单graph表加载failure        | 该graph表区域显示内联error + "重试"按钮; 其他graph表不受影响 (independent QueryKey)                               |
| ECharts 渲染异常      | catch 渲染error, fallback 为data表格视graph; 上报 Sentry error                                           |
| WS 事件loss           | dependency polling 兜底; polling 与 WS datainconsistent时以 polling 为准 (WS only做增量提示)                      |
| 离线模式              | 展示最后一次cached的graph表快照 (staticgraph片/SVG 导出) ; 隐藏时间range选择器; 顶部提示"离线模式, data已冻结" |
| 导出failure              | Toast 提示failure原因 + 重试按钮; 大data量导出改为后端异步生成 + 下载链接推送                          |

### 4.2.9 configuremanage中心 _(v3.0 新增)_

> 统一manage平台permissions, 功能开关, 模型configure, 域设置, tenantmanage等globallyconfigure. 

**data源**: `admin-routes` + `user preference API` + `DomainUIConfig` (§6.1.2) + 后端 admin/config 端点

```text
┌──────────────────────────────────────────────────────────────────────┐
│ configuremanage中心                                                         │
├──────────┬───────────────────────────────────────────────────────────┤
│          │                                                           │
│ 侧边导航 │  content区                                                   │
│          │                                                           │
│ ┌──────┐ │  ┌─────────────────────────────────────────────────────┐ │
│ │👤user│ │  │ [当前: permissionsmanage]                                    │ │
│ │ 偏好 │ │  │                                                     │ │
│ ├──────┤ │  │ ┌─────────────────────────────────────────────────┐ │ │
│ │🔑permissions│ │  │ │ 角色列表                                        │ │ │
│ │ manage │ │  │ │ ┌──────┬────────┬──────────┬────────┬────────┐ │ │ │
│ ├──────┤ │  │ │ │角色  │ permissions数 │ user数   │ range   │ 操作   │ │ │ │
│ │🎛功能│ │  │ │ ├──────┼────────┼──────────┼────────┼────────┤ │ │ │
│ │ 开关 │ │  │ │ │L1    │ 12     │ 150      │ 个人   │ [编辑] │ │ │ │
│ ├──────┤ │  │ │ │L2    │ 28     │ 25       │ 域     │ [编辑] │ │ │ │
│ │🤖模型│ │  │ │ │L3    │ 45     │ 8        │ 平台   │ [编辑] │ │ │ │
│ │ configure │ │  │ │ │L4    │ 52     │ 3        │ globally   │ [编辑] │ │ │ │
│ ├──────┤ │  │ │ └──────┴────────┴──────────┴────────┴────────┘ │ │ │
│ │🏢域  │ │  │ │                                                 │ │ │
│ │ 设置 │ │  │ │ permissions详情 (展开角色后)                            │ │ │
│ ├──────┤ │  │ │ ┌───────────┬──────┬──────┬──────┬──────────┐  │ │ │
│ │🏠tenant│ │  │ │ │ 功能页面  │ 查看 │ 编辑 │ 删除 │ manage     │  │ │ │
│ │ manage │ │  │ │ ├───────────┼──────┼──────┼──────┼──────────┤  │ │ │
│ ├──────┤ │  │ │ │ Dashboard │ ✅   │ —    │ —    │ —        │  │ │ │
│ │🔗Web │ │  │ │ │ Tasks     │ ✅   │ ✅   │ ❌   │ ❌       │  │ │ │
│ │ hook │ │  │ │ │ Agents    │ ✅   │ ✅   │ ✅   │ ✅       │  │ │ │
│ ├──────┤ │  │ │ └───────────┴──────┴──────┴──────┴──────────┘  │ │ │
│ │📋审计│ │  │ └─────────────────────────────────────────────────┘ │ │
│ │ log │ │  └─────────────────────────────────────────────────────┘ │
│ └──────┘ │                                                           │
├──────────┴───────────────────────────────────────────────────────────┤
│ 变更审计栏: "最近更改: L2 permissions更新 by admin@co — 2h ago" [查看全部] │
└──────────────────────────────────────────────────────────────────────┘
```

**子页面规格**: 

| 子页面       | 路由                           | permissions          | 功能说明                                                                                          |
| ------------ | ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------- |
| user偏好     | `/shared/settings/preferences` | authenticated | 语言/时区/主题(亮/暗/跟随system)/notification偏好/default看板布局                                              |
| permissionsmanage     | `/shared/settings/permissions` | org_admin+    | RBAC 角色 CRUD/角色-permissions矩阵编辑/user-角色分配/permissions继承可视化                                     |
| 功能开关     | `/admin/feature-flags`         | platform_sre  | 功能开关列表/开关state切换/灰度百分比/目标域-tenant-user/变更历史                                    |
| 模型configure     | `/shared/settings/models`      | domain_admin+ | LLM 模型列表/模型-域绑定/Prompt Policy 版本manage/Token 预算/Fallback 链configure                        |
| 域设置       | `/shared/settings/domains/:id` | domain_admin+ | 域基本信息/DomainUIConfig 编辑(featureVisibility/actionPolicy/glossary)/Agent 绑定/SLO 目标       |
| tenantmanage     | `/shared/settings/tenants`     | org_admin+    | tenant列表/tenant CRUD/tenant-域映射/tenant级配额/SSO configure                                                |
| Webhook manage | `/shared/settings/webhooks`    | domain_admin+ | Webhook 端点 CRUD/事件订阅选择/投递历史/重试configure/Secret manage                                      |
| 组织架构     | `/shared/settings/org`         | org_admin+    | 组织树可视化/部门-域映射/SSO/SCIM synchronousconfigure/角色继承规则                                           |
| 审计log     | `/governance/audit`            | domain_admin+ | 操作logsearch/筛选(时间/user/操作type)/导出/合规标记 (链接至 Governance → Audit module, 非independent页面)  |

**最小field**: 

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

**最小动作**: 

| 子页面   | 动作                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| user偏好 | get_preferences · update_preferences                                                                |
| permissionsmanage | list_roles · get_role · create_role · update_role · delete_role · assign_user                       |
| 功能开关 | list_flags · get_flag · create_flag · toggle_flag · update_rollout                                  |
| 模型configure | list_models · get_model · bind_domain · update_policy · set_budget · set_fallback                   |
| 域设置   | get_domain · update_domain · update_ui_config · bind_agents · set_slo                               |
| tenantmanage | list_tenants · create_tenant · update_tenant · suspend_tenant · map_domain                          |
| Webhook  | list_webhooks · create_webhook · update_webhook · delete_webhook · test_webhook · view_delivery_log |

**移动端适配**: 侧边导航改为底部 Tab 或汉堡菜单. permissions矩阵表格改为卡片 + 展开模式. 模型configure和tenantmanageonly支持只读查看, 编辑需进入 Web/桌面端. 

**errorhandle与离线降级**: 

| 场景                      | 行为                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| configure保存failure              | 保留表单state不清空; 显示内联error + 重试按钮; 超过 3 次failure后提示"请联系manage员"                     |
| configure保存conflict (409)        | 显示 diff 对比弹窗 (当前值 vs 服务端最新值) , user选择coverage或合并                                   |
| permissions不足 (403)            | field/按钮灰化 + tooltip "需要 {required_role} permissions"; 不显示无permissions的子页面导航项                    |
| 功能开关 toggle failure      | autorollback toggle state (optimistic更新fallback) ; Toast 提示具体error                                           |
| 离线模式                  | 所有configure页面只读; 编辑按钮禁用 + tooltip "离线不可编辑"; cached最后一次configure快照供查看                |
| Webhook test_webhook timeout | 30s timeout后显示"testingtimeout, 请check目标端点可达性"; 展示上次success的 delivery log 供参考                 |
| Monaco 编辑器加载failure     | fallback 为 `<textarea>` + JSON 语法高亮 (轻量方案) ; 提示"高级编辑器加载failure, 已切换到基础编辑器" |

### 4.2.10 已implementationmodule摘要 _(v3.0 新增)_

以下 9 个module已在 §4.1 中列出且后端data源已implementation, 但尚未达到核心页面蓝graph (§4.2.1-4.2.9) 的规格深度. 本节提供最小规格摘要, 供前端快速对接. 

| module       | data源                                                | 最小 DTO / 关键field                                                        | 主要动作                                      | API Layer |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- | --------- |
| Dispatch   | dispatch-routes / dispatch CLI                        | `{ execution_id, worker_id, dispatch_status, created_at, retries }`        | list · dispatch · cancel · retry              | Layer C   |
| Inspect    | `OperatorConsoleBackendService.getSnapshot()`         | `{ snapshot_id, plane, status, metrics{}, timestamp }`                     | get_snapshot · refresh · export               | Layer A→C |
| Health     | dashboard-routes health endpoint                      | `{ overall_status, planes[]{name, status, latency}, uptime }`              | get_health · drill_plane                      | Layer C   |
| Incidents  | `OperatorConsoleBackendService.getIncidentTimeline()` | `{ incident_id, severity, source, message, created_at, resolved_at? }`     | list · acknowledge · resolve · escalate       | Layer A→C |
| Policy     | admin-routes policy endpoint                          | `{ policy_id, type, rules[], enabled, version, updated_by }`               | list · get · update · toggle                  | Layer C   |
| Audit      | admin-routes audit endpoint                           | `{ audit_id, user_id, action, resource, timestamp, details }`              | search · filter · export · mark_compliance    | Layer C   |
| Compliance | [Planned] `/api/v1/compliance`                        | `{ compliance_id, standard, checks[], status, last_audit, score }`         | list · run_check · export_report              | Layer C   |
| Workers    | `GET /api/v1/workers` + `MissionControlService.getStabilityPanel()` | `{ worker_id, status, current_execution, heartbeat, load, region }`        | list · drain · restart · view_logs            | Layer C   |
| Queues     | `GET /api/v1/queues` + `MissionControlService.getStabilityPanel()`  | `{ queue_name, depth, processing, dead_letter_count, oldest_message_age }` | list · purge_dlq · retry_dlq · pause · resume | Layer C   |

## 4.3 页面data truth source 分层 (contract §6 落地) 

> **改进点**: 将contract §6 的三层data源映射到前端 TanStack Query strategy. 

| data层            | 适用页面                                                            | 前端strategy                                    | 刷新模式                                        |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| `shared_snapshot` | System Status Bar · Dashboard 首页 · Stability 头部                 | 单一 `useSnapshot()` query, globallyshared        | WebSocket push + 30s 轮询 fallback              |
| `shared_query`    | Dashboard · Stability · ApprovalCenter · Admin 概览                 | shared query key, 跨页面autodeduplication              | WebSocket invalidation + stale-while-revalidate |
| `page_local_api`  | Task inspect · Workflow inspect · Approval inspect · Worker details | 页面级 query, 进入页面时 fetch, 离开时可 GC | 手动 refetch + WebSocket push                   |

## 4.4 路由架构

### 4.4.1 Web/桌面端路由表

based on React Router v7, 支持 lazy loading: 

| 路由                                       | 页面                                  | permissions要求        | Code Split |
| ------------------------------------------ | ------------------------------------- | --------------- | ---------- |
| `/`                                        | Dashboard (redirect)                  | authenticated   | 否 (entry)  |
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
| `/admin/feature-flags`                     | Feature Flags (configuremanage子页面 §4.2.9) | platform_sre    | 是         |
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
| `/shared/analytics`                        | data统计平台                          | authenticated   | 是         |
| `/shared/settings`                         | configuremanage中心                          | authenticated   | 是         |
| `/shared/settings/preferences`             | user偏好                              | authenticated   | 是         |
| `/shared/settings/permissions`             | permissionsmanage                              | org_admin+      | 是         |
| `/shared/settings/models`                  | 模型configure                              | domain_admin+   | 是         |
| `/shared/settings/domains/:id`             | 域设置                                | domain_admin+   | 是         |
| `/shared/settings/tenants`                 | tenantmanage                              | org_admin+      | 是         |
| `/shared/settings/webhooks`                | Webhook manage                          | domain_admin+   | 是         |
| `/shared/settings/org`                     | 组织架构                              | org_admin+      | 是         |
| `/login`                                   | 登录页                                | public          | 否 (entry)  |
| `/login/callback`                          | SSO 回调                              | public          | 否         |

### 4.4.2 移动端导航结构

based on React Navigation v7: 

```text
AuthStack (未登录) 
  ├── LoginScreen
  └── SSOCallbackScreen

MainTabs (已登录) 
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

**导航特性**: 

| 特性       | implementation方式                                   |
| ---------- | ------------------------------------------ |
| 底部标签   | 5 个主标签 (首页/task/审批/市场/更多)      |
| Badge 计数 | 审批标签显示待handle数 (WebSocket 实时推送)  |
| 深度链接   | `aa://tasks/123` → 跳转到task详情          |
| 手势导航   | iOS 边缘return; Android Back 键              |
| state保持   | 切换标签时保留列表滚动位置和筛选条件       |

### 4.4.3 permissions路由guard链

```text
路由guard链: 
  1. AuthGuard       → check是否已登录 (否则跳转 /login) 
  2. TenantGuard     → check tenant 是否有效
  3. PermissionGuard → check角色/permissions是否满足路由要求
  4. FeatureGuard    → check功能开关是否启用
  5. ModeGuard       → 企业模式/单人模式功能可见性
```

## 4.5 页面级permissions矩阵

### 4.5.1 页面可见性矩阵

| 页面/module             | independent运营者(L1) | 业务线负责人(L1) | 域manage员(L2)   | Pack 开发者(L2/L3) | 平台 SRE(L3/L4)  |
| --------------------- | -------------- | ---------------- | -------------- | ------------------ | ---------------- |
| Dashboard             | ✅ 自有域      | ✅ 业务线域      | ✅ 管辖域      | ✅ 开发域          | ✅ globally          |
| TaskCockpit           | ✅ 自有task    | ✅ 业务线task    | ✅ 域内task    | ✅ 开发相关task    | ✅ 全部task      |
| WorkflowCockpit       | ❌             | ✅ 只读          | ✅             | ✅                 | ✅               |
| ApprovalCenter        | ✅ 自有审批    | ✅ 业务线审批    | ✅ 域内审批    | ❌                 | ✅ 全部审批      |
| StabilityPanel        | ❌             | ❌               | ⚠️ 域健康      | ❌                 | ✅               |
| AdminTakeoverConsole  | ❌             | ❌               | ❌             | ❌                 | ✅               |
| NL Conversation       | ✅             | ✅               | ✅             | ✅                 | ✅               |
| WorkflowBuilder       | ❌             | ❌               | ❌             | ✅                 | ✅               |
| WorkflowDebugger      | ❌             | ❌               | ❌             | ✅                 | ✅               |
| AgentManager          | ❌             | ❌               | ✅             | ✅                 | ✅               |
| Marketplace           | ✅ 浏览        | ✅ 浏览          | ✅ 安装        | ✅ 发布+安装       | ✅ 全部          |
| CostCenter            | ✅ 自有域      | ✅ 业务线        | ✅ 域级        | ❌                 | ✅ globally          |
| DomainWizard          | ❌             | ❌               | ✅             | ❌                 | ✅               |
| Settings              | ✅ 个人        | ✅ 个人          | ✅ 域+个人     | ✅ 个人            | ✅ globally+个人     |
| AgentMonitor (§4.2.7) | ❌             | ❌               | ✅ 域 Agent    | ✅ 开发 Agent      | ✅ globally          |
| Analytics (§4.2.8)    | ✅ 个人维度    | ✅ 业务线维度    | ✅ 域维度      | ✅ 开发维度        | ✅ 全平台+跨区域 |
| ConfigCenter (§4.2.9) | ✅ 偏好only    | ✅ 偏好only      | ✅ 域设置+模型 | ❌                 | ✅ 全部          |

### 4.5.2 关键动作permissions矩阵

| 动作                     | independent运营者(L1) | 业务线负责人(L1) | 域manage员(L2) | Pack 开发者(L2/L3) | 平台 SRE(L3/L4) | 二次confirmation  |
| ------------------------ | -------------- | ---------------- | ------------ | ------------------ | --------------- | --------- |
| 创建task                 | ✅             | ✅               | ✅           | ✅                 | ✅              | ❌        |
| canceltask                 | ✅ 自有        | ✅ 业务线        | ✅ 域内      | ❌                 | ✅ arbitrary         | ✅        |
| 审批 approve/reject      | ✅ 被分配      | ✅ 业务线        | ✅ 域内      | ❌                 | ✅ arbitrary         | ✅        |
| Admin Takeover           | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅✅ 双人 |
| Panic 紧急制动           | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅✅ 双人 |
| 发布 Pack 到 Marketplace | ❌             | ❌               | ❌           | ✅                 | ✅              | ✅ 审批流 |
| 安装 Marketplace Pack    | ❌             | ❌               | ✅           | ✅ 开发环境        | ✅              | ✅        |
| 修改域configure               | ❌             | ❌               | ✅           | ❌                 | ✅              | ✅        |
| Worker manage              | ❌             | ❌               | ❌           | ❌                 | ✅              | ✅        |
| 查看 Explainability      | ✅ 自有task    | ✅ 业务线        | ✅ 域内      | ✅                 | ✅              | ❌        |

### 4.5.3 下钻级别permissions

| 下钻级别 | content                        | independent运营者 | 业务线负责人 | 域manage员 | Pack 开发者 | 平台 SRE |
| -------- | --------------------------- | ---------- | ------------ | -------- | ----------- | -------- |
| L1       | 概览/摘要                   | ✅         | ✅           | ✅       | ✅          | ✅       |
| L2       | 详情/step列表               | ✅         | ✅           | ✅       | ✅          | ✅       |
| L3       | executelog/Evidence           | ❌         | ⚠️ sanitized      | ✅       | ✅          | ✅       |
| L4       | 原始 JSON/调试信息          | ❌         | ❌           | ⚠️ 只读  | ✅          | ✅       |
| L5       | 内部state/Reliability Fabric | ❌         | ❌           | ❌       | ❌          | ✅       |

**implementation方式**: 

- 前端在路由guard中check `auth-store.permissions` array
- 页面级隐藏: 不满足permissions的导航项不渲染 (非 disabled) 
- 动作级控制: via `usePermission(action, resource)` hook return `{ allowed, reason }`
- 下钻级别: 组件接收 `maxDrillDepth` prop, 由 `usePermission` 计算当前user可达的最大级别

### 4.5.4 field级可见性与sanitized矩阵 _(v2.3 新增)_

页面/动作/下钻级别permissions之外, 平台 UI 还需要第四层控制 -- **field级可见性与sanitized**. 以下矩阵定义各角色在不同datafield上的可见性和sanitized规则. 

#### FieldVisibilityPolicy

| field类别                         | independent运营者(L1) | 业务线负责人(L1) | 域manage员(L2) | Pack 开发者(L2/L3) | 平台 SRE(L3/L4) |
| -------------------------------- | -------------- | ---------------- | ------------ | ------------------ | --------------- |
| task标题/摘要                    | ✅ 明文        | ✅ 明文          | ✅ 明文      | ✅ 明文            | ✅ 明文         |
| task参数/输入 JSON               | ⚠️ 摘要        | ⚠️ 摘要          | ✅ 明文      | ✅ 明文            | ✅ 明文         |
| Tool Call payload (参数+return值)  | ❌ 隐藏        | ⚠️ sanitized          | ✅ 明文      | ✅ 明文            | ✅ 明文         |
| Prompt / Policy 版本号           | ❌ 隐藏        | ❌ 隐藏          | ⚠️ only版本号  | ✅ 明文            | ✅ 明文         |
| Prompt 原文 / Policy 原文        | ❌ 隐藏        | ❌ 隐藏          | ❌ 隐藏      | ✅ 明文            | ✅ 明文         |
| Evidence 原始 JSON               | ❌ 隐藏        | ⚠️ 摘要          | ⚠️ sanitized      | ✅ 明文            | ✅ 明文         |
| Assignee / Owner 姓名            | ✅ 明文        | ✅ 明文          | ✅ 明文      | ⚠️ only ID           | ✅ 明文         |
| Tenant / Workspace ID            | ⚠️ only当前tenant  | ⚠️ only当前tenant    | ⚠️ only管辖域  | ⚠️ only开发域        | ✅ 全部         |
| Worker 节点 IP / 主机名          | ❌ 隐藏        | ❌ 隐藏          | ❌ 隐藏      | ❌ 隐藏            | ✅ 明文         |
| Error stacktrace                 | ❌ 隐藏        | ❌ 隐藏          | ⚠️ 首行      | ✅ 明文            | ✅ 明文         |
| Cost 金额明细                    | ✅ 自有域      | ✅ 业务线        | ✅ 域级      | ❌ 隐藏            | ✅ globally         |
| Model / LLM provider 标识        | ❌ 隐藏        | ❌ 隐藏          | ⚠️ only模型名  | ✅ 明文            | ✅ 明文         |

**graph例**: ✅ 明文 = 原值展示; ⚠️ sanitized/摘要 = partial隐藏或only展示摘要; ❌ 隐藏 = 不渲染该field. 

#### RedactionRule type定义

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
| user真名         | cached中存储 hash                | only显示名      | only显示名 | 完整姓名     |
| 邮箱地址         | 不写入 offlineStore            | `j***@co.com` | 完整     | 完整         |
| IP 地址          | 不写入 IndexedDB / SQLite cached | 隐藏          | 隐藏     | 明文         |
| 生物特征绑定信息 | only L4 SecureStorage            | 隐藏          | 隐藏     | "已绑定"标识 |
| 组织架构path     | cached中only存当前user可见子树     | 自有节点      | 管辖子树 | 全树         |

**implementation方式**: 

- `shared/domain/field-visibility.ts` 导出 `applyRedaction(field, value, role): RedactedValue`
- ViewModel mapper 中call `applyRedaction`, 在 DTO → VM 转换阶段完成sanitized, 组件层无需感知
- `auditOnAccess: true` 的field在 L3/L4 级展示时auto上报 telemetry `field_access` 事件
- PII field列表由 `FieldVisibilityPolicy.piiFields` 声明, 与后端 `data-classification` strategy对齐

## 4.6 关键module实施蓝graph

> 以下实施details提取自 Doc-11 历史实施底稿中经评审confirmation的高价值content. 

### 4.6.1 NL 对话state机 → UI 映射

| state         | UI 表现                                  | 后端事件                   | state          |
| ------------ | ---------------------------------------- | -------------------------- | ------------- |
| `idle`       | 输入框 placeholder + 推荐操作卡片        | —                          | [Implemented] |
| `parsing`    | 输入禁用 + "理解中..." 骨架动画          | —                          | [Implemented] |
| `clarifying` | Agent 追问气泡 + 选项按钮/输入框         | `nl.clarification_needed`  | [Proposed]    |
| `building`   | "正在构建task..." 进度指示               | —                          | [Implemented] |
| `confirming` | risk预览卡片 + confirmation/修改/cancel按钮        | `goal.decomposition_ready` | [Planned]     |
| `executing`  | 实时step进度条 + 当前step描述            | `progress`                 | [Implemented] |
| `reporting`  | 结果摘要卡片 + 详情链接 + "为什么? "按钮 | `completed` / `failed`     | [Implemented] |

### 4.6.2 HITL 人机协作操作面板

| 操作     | 说明                        | UI 组件                     | state          |
| -------- | --------------------------- | --------------------------- | ------------- |
| Inspect  | 查看当前 PlanBundle/Context | JSON Tree + 可折叠面板      | [Implemented] |
| Patch    | 修改当前plan参数            | 表单编辑器 + diff 预览      | [Planned]     |
| Override | coverage Agent 决策             | 下拉选择替代方案 + 理由输入 | [Planned]     |
| Takeover | 完全接管人工execute            | 全功能操作面板 + 操作record   | [Implemented] |
| Resume   | 恢复execute (4 种模式选择)     | 单选 + confirmation按钮             | [Implemented] |

**恢复模式**: 

| 模式                 | 说明                       | state          |
| -------------------- | -------------------------- | ------------- |
| `resume_same_state`  | 原样恢复, 继续execute         | [Implemented] |
| `resume_with_replan` | 触发 P3 重新规划           | [Implemented] |
| `resume_supervised`  | 监督模式恢复 (每步需confirmation)  | [Planned]     |
| `abort_on_resume`    | 安全终止                   | [Implemented] |

### 4.6.3 Workflow 调试器能力矩阵

| 能力          | 运行中 | 已完成 | UI implementation                               | state       |
| ------------- | ------ | ------ | ------------------------------------- | ---------- |
| execute时间线    | 实时   | 回放   | 水平时间轴 + step卡片 (颜色编码state)  | [Planned]  |
| OAPEFLIR 步入 | ✓      | ✓      | 展开step → O/A/P/E/F/L/I/R 各阶段面板 | [Planned]  |
| data流视graph    | ✓      | ✓      | step间 JSON diff (输入→output)          | [Planned]  |
| 副作用 Diff   | ✗      | ✓      | 预期 vs 实际 side effect 并排对比     | [Proposed] |
| 断点调试      | ✓      | ✗      | 点击step设断点; 条件断点对话框        | [Proposed] |
| 时间旅行      | ✗      | ✓      | 时间轴滑块 + ContextSnapshot 预览     | [Deferred] |
| 运行对比      | ✗      | ✓      | 双栏并排 + 差异高亮                   | [Deferred] |

**后端dependency说明**: 断点调试和时间旅行dependency后端 DebuggerService 提供 `ws/v1/debug/{workflow_id}` 端点 (当前 [Proposed]) , 在该端点稳定前, 调试器only支持execute时间线和data流视graph的只读回放. 

### 4.6.4 审批中心交互特性

| 特性       | Web/桌面                                    | 移动端             | state      |
| ---------- | ------------------------------------------- | ------------------ | --------- |
| 快捷操作   | 键盘快捷键 A(approve)/R(reject)/D(delegate) | notification栏快捷操作按钮 | [Planned] |
| batch操作   | 全选 + batch批准 (only Low risk)               | 滑动手势batch操作   | [Planned] |
| 上下文预览 | 右侧面板展开 ApprovalContext                | 详情页全屏展示     | [Planned] |
| 委托       | 组织架构树弹窗选择                          | search + 最近联系人  | [Planned] |
| timeout提醒   | 倒计时标签 + 最后30min 高亮                 | 推送notification + 震动    | [Planned] |

### 4.6.5 NL 对话module页面线框graph

```text
Web/桌面端: 
┌─────────────────────────────────────────────────────────┐
│  NL Conversation Panel (可驻右侧或independent全屏)               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  消息流 (Message Stream)                          │    │
│  │                                                 │    │
│  │  [User] 帮我发起春季营销活动                      │    │
│  │                                                 │    │
│  │  [Agent] 好的, 我需要confirmation几个信息:                │    │
│  │  • 哪个产品的营销活动?                           │    │
│  │  • 预算range?                                    │    │
│  │  • 截止日期?                                    │    │
│  │                                                 │    │
│  │  [System] risk预览卡片                           │    │
│  │  ┌─────────────────────────────────────┐        │    │
│  │  │ 将创建 3 个子task · 预估 ¥2,500     │        │    │
│  │  │ 需广告合规审批                       │        │    │
│  │  │ [confirmation] [修改] [cancel]                 │        │    │
│  │  └─────────────────────────────────────┘        │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [输入框] │ 语音 │ 附件 │ Cmd+K 命令面板          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

移动端: 
┌────────────────────────┐
│ ← NL 对话         ···  │
│                        │
│ 消息流 (全屏)           │
│                        │
│ [输入框] [语音] [附件]  │
└────────────────────────┘
```

**shared Hooks**: 

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

### 4.6.6 taskmanage三栏布局线框graph

```text
Web/桌面端 (xl 断点) : 
┌───────────┬──────────────────────────┬─────────────────┐
│ filter侧栏   │ task列表                  │ task详情面板      │
│           │                          │                 │
│ state ▾    │ ● 春季营销  executing ▶  │ 目标: ...        │
│ □ 全部    │   广告域  2h前            │ state: executing  │
│ ■ execute中  │                          │ 进度: 2/4        │
│ □ 已完成  │ ● 月度报表  completed ✓  │                 │
│ □ 待审批  │   data域  5h前            │ [DAG dependencygraph]     │
│ □ failure    │                          │                 │
│           │ ● 客户清洗  awaiting ⏳  │ step列表:         │
│ 域 ▾      │   data域  1d前            │ ▶ Step 1 ✓      │
│ □ 全部    │                          │ ▶ Step 2 ✓      │
│ ■ 广告    │                          │ ▼ Step 3 ▶      │
│ □ data    │                          │   OAPEFLIR: E   │
│           │                          │ ○ Step 4 ...    │
│ 日期 ▾    │                          │                 │
│ 最近7天   │                          │ [解释] [成本]    │
└───────────┴──────────────────────────┴─────────────────┘
```

**信息层级**: 

| 层级 | content                                            | 展示条件       |
| ---- | ----------------------------------------------- | -------------- |
| L0   | 标题, state徽标, 域标签, 时间                    | 列表项始终显示 |
| L1   | 进度百分比, 子task数, 当前step, 耗时            | 选中详情面板   |
| L2   | DAG dependencygraph, step列表 (OAPEFLIR 阶段) , 工具record | 展开详情       |
| L3   | HarnessRun full, ContextSnapshot, Evidence 链接 | "完整record"跳转 |

### 4.6.7 审批中心页面线框graph

```text
┌────────────────────────────────────────────────────┐
│  审批中心                                            │
│  待handle (3) │ 已handle (28) │ 已委托 (5)              │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 紧急 │ 量化strategy部署   Critical │ 剩余2h       │  │
│  │ 域: quant-trading                            │  │
│  │ 摘要: Agent request部署新交易strategy                 │  │
│  │ risk评估: [展开]                              │  │
│  │ [批准] [reject] [委托] [补充]                   │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 普通 │ 价格调整       High │ 剩余24h          │  │
│  │ ...                                          │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 4.6.8 运营看板四层架构

| 看板层级 | 角色     | 核心面板                                           | 刷新strategy    |
| -------- | -------- | -------------------------------------------------- | ----------- |
| L1       | 操作者   | 我的task, 审批, Agent 健康, 预算, NL 简报          | 实时 + 5min |
| L2       | 域manage   | 域吞吐量, Agent 利用率, SLO, Top failure, 成本分布    | 1min + 5min |
| L3       | 平台 SRE | 五平面健康, 资源利用率, error率, 延迟, Incident     | 10s + 30s   |
| L4       | 舰队manage | 跨区域state, 舰队成本, tenant对比, 容量预测, 合规态势 | 1min + 1h   |

**各层级面板详细规格** _(v3.0 扩展)_: 

| 层级 | 面板名称        | data源                                                | graph表type        | 刷新间隔 |
| ---- | --------------- | ----------------------------------------------------- | --------------- | -------- |
| L1   | 我的task概览    | `GET /api/v1/tasks?owner=me`                          | KPI 卡片        | 实时 WS  |
| L1   | 待审批队列      | `MissionControlService.listApprovalQueue()`           | 列表 + Badge    | 实时 WS  |
| L1   | 我的 Agent 健康 | `GET /api/v1/agents?scope=my_domain`                  | state指示灯      | 10s      |
| L1   | 预算uses率      | `GET /api/v1/costs?scope=my_domain`                   | Gauge           | 5min     |
| L2   | 域task吞吐量    | `GET /api/v1/dashboard/metrics?scope=domain`          | 折线graph          | 1min     |
| L2   | Agent 利用率    | `GET /api/v1/dashboard/metrics?metric=agent`          | 热力graph          | 1min     |
| L2   | SLO 达标率      | `GET /api/v1/dashboard/metrics?metric=slo`            | Gauge           | 5min     |
| L2   | Top 5 failure原因  | `GET /api/v1/dashboard/metrics?metric=failures`       | 水平柱状graph      | 5min     |
| L2   | 域成本分布      | `GET /api/v1/costs?scope=domain&breakdown=model`      | 饼graph            | 5min     |
| L3   | 五平面健康      | `GET /api/v1/dashboard/metrics?metric=health`         | 多轴折线        | 10s      |
| L3   | P99 延迟        | `GET /api/v1/dashboard/metrics?metric=latency`        | 折线graph + 阈值线 | 10s      |
| L3   | error率          | `GET /api/v1/dashboard/metrics?metric=errors`         | 面积graph          | 10s      |
| L3   | 资源利用率      | `GET /api/v1/dashboard/metrics?metric=resources`      | 仪表盘集群      | 30s      |
| L3   | Incident 时间线 | `OperatorConsoleBackendService.getIncidentTimeline()` | 时间线          | 实时 WS  |
| L4   | 跨区域state      | `GET /api/v1/dashboard/metrics?scope=fleet`           | 地理热力graph      | 1min     |
| L4   | 舰队成本对比    | `GET /api/v1/costs?scope=fleet`                       | 分组柱状graph      | 1h       |
| L4   | tenant对比        | `GET /api/v1/dashboard/metrics?scope=tenants`         | 雷达graph          | 1h       |
| L4   | 容量预测        | `GET /api/v1/dashboard/metrics?metric=capacity`       | 预测折线graph      | 1h       |

**自适应规则**: 

- 单人模式: only L1 看板, 隐藏多tenant/组织面板
- 企业模式: 按user角色auto切换 L1-L4
- 所有看板面板支持拖拽sort + 可见性configure
- 看板布局persistence到 `UserPreferences.default_dashboard_layout` (configuremanage中心 §4.2.9) 

### 4.6.9 Workflow 构建器技术方案

| 组件     | 技术         | 说明                                 |
| -------- | ------------ | ------------------------------------ |
| 画布     | React Flow   | 节点画布, 支持缩放/平移/框选/吸附    |
| 节点type | 自定义 Node  | 触发器/操作/条件/循环/parallel/等待/审批 |
| 连线     | 有向边       | 条件branch标注 + data流type标注        |
| validation     | DAG 拓扑validation | 实时检测环路, missing连接, 未填参数     |
| 预览     | Dry-run      | 沙箱execute, 不产生真实 side effect     |
| 属性面板 | 右侧抽屉     | 选中节点后显示configure表单               |
| 组件面板 | 左侧面板     | 可search/可拖拽组件列表                |

**移动端strategy**: 移动端only支持只读查看 Workflow graph (缩放 + 节点详情弹窗) , 不支持编辑. 原因: 画布拖拽编辑在小屏体验差, 且 React Flow 不支持 React Native. 

### 4.6.10 调试器实时data流

```text
WebSocket /ws/v1/debug/{workflow_id}
  │
  ▼
DebugEventStream
  ├── step_started     → 时间轴新增step卡片
  ├── step_progress    → step卡片内进度更新
  ├── oapeflir_phase   → OAPEFLIR 面板实时切换
  ├── tool_call        → 工具calllog追加
  ├── evaluator_report → 评估结果面板刷新
  ├── breakpoint_hit   → 暂停指示 + 断点面板弹出
  ├── step_completed   → step卡片变色 (绿/红) 
  └── run_completed    → 时间轴lock定 + 启用时间旅行
```

### 4.6.11 Agent 监控中心技术方案 _(v3.0 新增)_

**核心组件**: 

| 组件           | 技术                   | 说明                                             |
| -------------- | ---------------------- | ------------------------------------------------ |
| Agent 列表     | 虚拟滚动 + WS 实时更新 | 支持 500+ Agent 列表不卡顿, WS 推送增量更新      |
| 健康度指示器   | `AgentHealthIndicator` | 复用 `ui-core/business/` 已有组件, 支持 4 色state |
| 心跳时间线     | ECharts Scatter        | X 轴时间, Y 轴心跳间隔, 异常点标红               |
| 负载曲线       | ECharts Line           | 双 Y 轴: active_tasks + queue_depth              |
| Agent 详情抽屉 | 右侧 Drawer 640px      | Tab 切换: 基本信息/能力/心跳/负载/task/error      |

**useAgentMonitor Hook**: 

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

### 4.6.12 data统计平台技术方案 _(v3.0 新增)_

**graph表渲染架构**: 

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

**角色自适应规则**: 

| user角色 | 可见graph表                                    | default时间range |
| -------- | ------------------------------------------- | ------------ |
| L1       | KPI 卡片 (个人维度) + 我的task趋势          | 7 天         |
| L2       | 全部graph表 (域维度)                           | 30 天        |
| L3       | 全部graph表 (全平台) + system健康面板 + P99 延迟 | 24 小时      |
| L4       | 全部graph表 (跨区域) + 容量预测 + tenant对比     | 30 天        |

**useMetricsQuery Hook**: 

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

### 4.6.13 configuremanage中心技术方案 _(v3.0 新增)_

**子页面路由与懒加载**: 

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

**permissions矩阵编辑器**: 

| 组件           | 技术                | 说明                                           |
| -------------- | ------------------- | ---------------------------------------------- |
| 角色-permissions矩阵  | `<PermissionGrid>`  | 行=功能页面, 列=操作(CRUD+manage), 单元格=开关 |
| permissions继承可视化 | 树形graph + 高亮继承链 | 显示角色继承关系, 高亮当前permissions来源             |
| user-角色分配  | 穿梭框(Transfer)    | 左=可分配user, 右=已分配user, 支持batch操作     |
| 变更 Diff 预览 | 变更前后对比表      | 保存前显示变更摘要, 需二次confirmation                 |

**模型configuremanage**: 

| 组件               | 技术               | 说明                                          |
| ------------------ | ------------------ | --------------------------------------------- |
| 模型列表           | data表格           | 显示 provider/model/域绑定数/Token 预算uses率 |
| Prompt Policy 编辑 | Monaco Editor 嵌入 | 支持 JSON/YAML 编辑 + 语法validation + diff 预览    |
| Token 预算仪表盘   | ECharts Gauge      | 日/月预算uses率, 超限预警                     |
| Fallback 链编辑    | 拖拽sort列表       | 拖拽调整 fallback 优先级                      |
| 域绑定manage         | 穿梭框             | 左=可用域, 右=已绑定域                        |

**功能开关manage**: 

| 组件       | 技术                   | 说明                                   |
| ---------- | ---------------------- | -------------------------------------- |
| 开关列表   | data表格               | 名称/state/灰度百分比/目标range/最后更新 |
| 灰度滑块   | Slider + 数字输入      | 0-100% 灰度百分比控制                  |
| 目标选择器 | 多级选择(域→tenant→user) | 逐级缩小灰度range                       |
| 变更历史   | 时间线组件             | 谁在什么时候改了什么, 支持rollback         |

## 4.7 Planned module mini-contract _(v2.3 新增)_

以下 6 个 `[Planned]` module已纳入信息架构 (§4.1) , 但尚missing闭环contract. 本节为每个module定义最小contract块 (minimal DTO / actions / query keys / permission / WS needs / offline rule) , 作为后端 API 设计和前端 mock-server 的对齐基准. 

> **data权威性约定** _(v3.0 新增)_: 每个 mini-contract 新增三个维度 (Authoritative Source / Derived Source / Projection Owner) , 防止前端将 UI projection 误认为 authoritative fact. 
>
> - **Authoritative Source**: 该moduledata的唯一真值来源 (后端 service / 外部system) 
> - **Derived Source**: based on authoritative source 聚合或投影而来的派生data源
> - **Projection Owner**: 负责maintained DTO → ViewModel 投影逻辑的团队/module, schema 变更时由此 owner 负责更新

### 4.7.1 AgentManager

| 维度                 | 定义                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ agent_id, name, domain_id, status, health, version, capabilities[], last_heartbeat, created_at }` |
| Actions              | `list` · `get(id)` · `register` · `deregister` · `update_config` · `restart`                         |
| Query Keys           | `["agents"]` · `["agents", "list", filters]` · `["agents", "detail", id]`                            |
| Permission           | 域manage员(L2): list+get; Pack 开发者(L2/L3): full CRUD; SRE(L3/L4): full + restart                    |
| WS Needs             | `agent.health_changed` · `agent.registered` · `agent.deregistered`                                   |
| Offline Rule         | 只读浏览allows stale cache; 注册/注销/重启必须在线                                                     |
| API Endpoint         | `CRUD /api/v1/agents` · `POST /api/v1/agents/{id}/restart`                                           |
| Authoritative Source | `AgentRegistryService` (src/domains/registry/)                                                       |
| Derived Source       | `MissionControlService.getSnapshot()` → agents 摘要 (非权威, only投影)                                 |
| Projection Owner     | 前端 `feature-agent-manager` module                                                                    |

### 4.7.2 WorkflowBuilder

| 维度                 | 定义                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ workflow_id, name, domain_id, steps[], edges[], version, status, created_by, updated_at }`             |
| Actions              | `list` · `get(id)` · `create` · `update` · `delete` · `validate` · `publish` · `clone`                    |
| Query Keys           | `["workflows"]` · `["workflows", "list", filters]` · `["workflows", "detail", id]`                        |
| Permission           | Pack 开发者(L2/L3): full CRUD; SRE(L3/L4): full + publish                                                 |
| WS Needs             | `workflow.updated` · `workflow.published` · `workflow.validation_result`                                  |
| Offline Rule         | 画布编辑allows离线排队 (local草稿) ; 发布/验证必须在线                                                       |
| API Endpoint         | `CRUD /api/v1/workflows` · `POST /api/v1/workflows/{id}/validate` · `POST /api/v1/workflows/{id}/publish` |
| Authoritative Source | `WorkflowDefinitionService` (src/platform/five-plane-orchestration/)                                                 |
| Derived Source       | `MissionControlService.getWorkflowCockpit()` → workflow 摘要 (非权威, only投影)                             |
| Projection Owner     | 前端 `feature-workflow-builder` module                                                                      |

### 4.7.3 WorkflowDebugger

| 维度                 | 定义                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ debug_session_id, workflow_id, execution_id, timeline_events[], breakpoints[], current_step, state_snapshot }`         |
| Actions              | `start_session` · `set_breakpoint` · `remove_breakpoint` · `step_over` · `resume` · `inspect_state` · `replay_from(step)` |
| Query Keys           | `["debug", workflowId]` · `["debug", "session", sessionId]` · `["debug", "timeline", executionId]`                        |
| Permission           | Pack 开发者(L2/L3): full; SRE(L3/L4): full                                                                                |
| WS Needs             | `ws/v1/debug/{workflow_id}` — `debug.step_entered` · `debug.breakpoint_hit` · `debug.state_snapshot`                      |
| Offline Rule         | 全部必须在线 (实时调试dependency WS 连接)                                                                                       |
| API Endpoint         | `POST /api/v1/debug/sessions` · `GET /api/v1/debug/sessions/{id}` · `DELETE /api/v1/debug/sessions/{id}`                  |
| Authoritative Source | `DebuggerService` (src/ops-maturity/debugger/) + `ExecutionEngine` runtimestate                                             |
| Derived Source       | WS 实时推送的 `state_snapshot` 为runtime投影, 非persistence真值                                                                 |
| Projection Owner     | 前端 `feature-workflow-debugger` module                                                                                     |

### 4.7.4 Marketplace

| 维度                 | 定义                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ pack_id, name, description, author, version, domain_tags[], rating, download_count, compatibility, status }`                           |
| Actions              | `list` · `search` · `get(id)` · `install` · `uninstall` · `publish` · `review` · `rate`                                                   |
| Query Keys           | `["marketplace"]` · `["marketplace", "list", filters]` · `["marketplace", "detail", id]` · `["marketplace", "installed"]`                 |
| Permission           | L1: browse+rate; 域manage员(L2): install+uninstall; Pack 开发者: publish; SRE: full                                                         |
| WS Needs             | `marketplace.pack_published` · `marketplace.pack_updated` · `marketplace.install_completed`                                               |
| Offline Rule         | 浏览allows stale cache; 安装/卸载/发布必须在线                                                                                              |
| API Endpoint         | `GET /api/v1/marketplace` · `GET /api/v1/marketplace/{id}` · `POST /api/v1/marketplace/{id}/install` · `POST /api/v1/marketplace/publish` |
| Authoritative Source | `MarketplaceService` (src/scale-ecosystem/marketplace/)                                                                                   |
| Derived Source       | 无 (Marketplace 为自身真值源)                                                                                                             |
| Projection Owner     | 前端 `feature-marketplace` module                                                                                                           |

### 4.7.5 Explainability

| 维度                 | 定义                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ explanation_id, task_id, step_id, explanation_type, reasoning_chain[], confidence, sources[], generated_at }` |
| Actions              | `query(task_id, step_id?)` · `get(explanation_id)` · `rate_helpfulness` · `export`                               |
| Query Keys           | `["explanations", taskId]` · `["explanations", "detail", explanationId]`                                         |
| Permission           | L1: 自有task summary; 域manage员(L2): 域内 full; Pack 开发者: full; SRE: full                                      |
| WS Needs             | 无实时需求 (按需query)                                                                                            |
| Offline Rule         | 已query过的 explanation 可cached展示; 新query必须在线                                                                |
| API Endpoint         | `POST /api/v1/explanations` (query) · `GET /api/v1/explanations/{id}`                                            |
| Authoritative Source | `ExplainabilityService` (src/ops-maturity/explainability/)                                                       |
| Derived Source       | explanation based on `ExecutionEngine` 运行log + LLM 推理链生成, 非原始事实                                         |
| Projection Owner     | 前端 `feature-explainability` module                                                                               |

### 4.7.6 CostCenter

| 维度                 | 定义                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ cost_record_id, domain_id, tenant_id, period, total_cost, breakdown_by_model[], breakdown_by_task_type[], budget, budget_utilization_pct }` |
| Actions              | `get_summary(domain_id, period)` · `get_detail(cost_record_id)` · `set_budget` · `set_alert_threshold` · `export_report`                       |
| Query Keys           | `["costs", domainId, period]` · `["costs", "detail", recordId]` · `["costs", "budget", domainId]`                                              |
| Permission           | L1: 自有域只读; 业务线负责人: 业务线聚合; 域manage员: 域级+set_budget; SRE: globally+all actions                                                     |
| WS Needs             | `cost.budget_alert` · `cost.period_closed`                                                                                                     |
| Offline Rule         | 只读浏览allows stale cache; set_budget / set_alert 必须在线                                                                                      |
| API Endpoint         | `GET /api/v1/costs` · `GET /api/v1/costs/{id}` · `PUT /api/v1/costs/budget` · `POST /api/v1/costs/export`                                      |
| Authoritative Source | `CostTrackingService` (src/ops-maturity/cost/)                                                                                                 |
| Derived Source       | cost breakdown 由 `ResourceManagerService` uses量data聚合而来                                                                                  |
| Projection Owner     | 前端 `feature-cost-center` module                                                                                                                |

### 4.7.7 AnalyticsDashboard _(v3.0 新增)_

| 维度                 | 定义                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal DTO          | `{ time_range, scope, kpis{total_tasks,success_rate,avg_duration_ms,active_agents,slo_compliance,total_cost}, task_trend[], status_distribution[], agent_utilization[], cost_trend[], top_failures[], workflow_durations[] }` |
| Actions              | `get_metrics(scope, time_range)` · `get_kpis(scope)` · `get_trend(metric, time_range)` · `export_report(format)`                                                                                                              |
| Query Keys           | `["dashboard", "metrics", scope, timeRange]` · `["dashboard", "kpis", scope]` · `["dashboard", "trend", metric, timeRange]`                                                                                                   |
| Permission           | L1: 个人维度只读; L2: 域维度; L3: 全平台; L4: 跨区域+容量预测                                                                                                                                                                 |
| WS Needs             | `dashboard.metric_updated` (delta push, 避免full轮询)                                                                                                                                                                         |
| Offline Rule         | 已加载的graph表dataallows stale 展示 (带 "data截至 HH:mm" 标记) ; 导出必须在线                                                                                                                                                     |
| API Endpoint         | `GET /api/v1/dashboard/metrics` · `GET /api/v1/dashboard/kpis` · `GET /api/v1/dashboard/trend/{metric}` · `POST /api/v1/dashboard/export`                                                                                     |
| Authoritative Source | `MissionControlService` (聚合层) + `CostTrackingService` + `AgentRegistryService`                                                                                                                                             |
| Derived Source       | 所有指标均为聚合投影, 非原始事实; 原始事实分布在各 P2-P5 平面 service 中                                                                                                                                                      |
| Projection Owner     | 前端 `feature-analytics` module                                                                                                                                                                                                 |

### 4.7.8 ConfigurationCenter _(v3.0 新增)_

| 维度                 | 定义                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimal DTO          | `{ user_preferences{locale,timezone,theme,notifications}, roles[], feature_flags[], model_configs[], domains[], tenants[], webhooks[], recent_changes[] }`                                                                                                                                             |
| Actions              | **偏好**: get/update_preferences · **permissions**: CRUD roles + assign_user · **功能**: CRUD flags + toggle + rollout · **模型**: CRUD models + bind_domain + set_budget · **域**: get/update domain + update_ui_config · **tenant**: CRUD tenants + map_domain · **Webhook**: CRUD webhooks + test + view_log |
| Query Keys           | `["settings", "preferences"]` · `["settings", "roles"]` · `["settings", "flags"]` · `["settings", "models"]` · `["settings", "domains", id]` · `["settings", "tenants"]` · `["settings", "webhooks"]`                                                                                                  |
| Permission           | authenticated: 偏好; org_admin: permissions+tenant; domain_admin: 模型+域+Webhook; platform_sre: 功能开关+全部                                                                                                                                                                                                  |
| WS Needs             | `config.updated` (notification其他在线userconfigure已变更)                                                                                                                                                                                                                                                          |
| Offline Rule         | 偏好allows离线cached读取; 所有写操作必须在线; configure变更需optimisticlock (`If-Match` ETag)                                                                                                                                                                                                                           |
| API Endpoint         | `GET/PUT /api/v1/user/preferences` · `CRUD /api/v1/admin/roles` · `CRUD /api/v1/admin/feature-flags` · `CRUD /api/v1/admin/models` · `GET/PUT /api/v1/admin/domains/{id}` · `CRUD /api/v1/admin/tenants` · `CRUD /api/v1/admin/webhooks`                                                               |
| Authoritative Source | `admin-routes` (src/sdk/cli/admin/) + `UserPreferenceService` + `DomainConfigService`                                                                                                                                                                                                                  |
| Derived Source       | `DomainUIConfig` (§6.1.2) 为域设置的前端投影                                                                                                                                                                                                                                                           |
| Projection Owner     | 前端 `feature-settings` module                                                                                                                                                                                                                                                                           |

---

# Part IV — data与通信

---

# 5. data流, API 集成与实时层

> **改进点 A-2, A-3, D-1**: distinguish Implemented/Planned API 端点; 按后端实际 WebSocket 事件分层; 明确 Web 离线三层strategy. v2.3 新增 API Layer 分级 (§5.2.3) 和 Mutation 幂等规范 (§5.6.4) . 

## 5.1 statemanage架构

**state分类**: 

| state类别   | manage工具        | 生命周期       | persistence | 示例                                 |
| ---------- | --------------- | -------------- | ------ | ------------------------------------ |
| 应用state   | Zustand         | App 生命周期   | 是     | user, token, theme, locale, sidebar  |
| 服务端state | TanStack Query  | 按 staleTime   | 可选   | tasks, approvals, agents, dashboard  |
| 实时state   | Zustand + WS    | WebSocket 连接 | 否     | wsStatus, eventBuffer, subscriptions |
| 表单state   | React Hook Form | 页面生命周期   | 否     | 创建task, 审批决策, 域configure等表单     |
| URL state   | React Router    | 路由生命周期   | URL    | filter条件, pagination cursor, 当前标签      |

```text
┌───────────────────────────────────────────────────────────────┐
│                     UI statemanage分层                             │
│                                                               │
│  ┌──────────────────┐  ┌───────────────────────────────────┐ │
│  │  Client State    │  │  Server State                     │ │
│  │  (Zustand 5)     │  │  (TanStack Query v5)              │ │
│  │                  │  │                                   │ │
│  │  • UI state       │  │  • task/审批/看板data              │ │
│  │  • 主题偏好      │  │  • autocached + deduplication                │ │
│  │  • 侧边栏折叠    │  │  • 后台刷新 + optimistic更新            │ │
│  │  • 对话上下文    │  │  • 离线 persister                 │ │
│  └────────┬─────────┘  └────────────┬──────────────────────┘ │
│           │                         │                         │
│  ┌────────┴─────────────────────────┴──────────────────────┐ │
│  │            Realtime Layer (WebSocket → Store sync)        │ │
│  │  WS 事件 → invalidateQueries() / directly更新 Zustand store  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Offline Layer (sync-store + offline-queue)      │ │
│  │  离线操作排队 → 连接恢复 → 按序replay → conflict解决            │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Zustand Store 划分**: 

| Store            | 职责                                   | persistence           |
| ---------------- | -------------------------------------- | ---------------- |
| `auth-store`     | 认证state, 当前user, permissionscached           | 安全存储(L4)     |
| `ui-store`       | 主题, 侧边栏, 当前路由state, 布局偏好   | localStorage     |
| `sync-store`     | 离线队列state, synchronous进度, conflict列表       | offlineStore(L4) |
| `realtime-store` | WebSocket 连接state, 订阅列表, 事件缓冲 | in-memory             |

### 5.1.1 Zustand Store interface定义

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

### 5.1.2 TanStack Query staleTime strategy

| datatype   | staleTime | gcTime | 理由                     |
| ---------- | --------- | ------ | ------------------------ |
| 看板指标   | 30s       | 5min   | 频繁changes, 需近实时       |
| task列表   | 2min      | 30min  | 中等频率changes             |
| task详情   | 1min      | 30min  | user关注的当前task需较新 |
| 审批列表   | 30s       | 10min  | 时效性要求高             |
| Agent 列表 | 5min      | 30min  | changes不频繁               |
| configuredata   | 1h        | 24h    | 极少changes                 |
| 市场列表   | 10min     | 1h     | changes不频繁               |
| 成本data   | 5min      | 30min  | 有一定时效性             |

### 5.1.3 QueryClient globallydefaultconfigure

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5min default
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

### 5.1.4 离线persistence

移动端和桌面端uses TanStack Query 的 `persistQueryClient`, 将querycachedpersistence到 L4 存储: 

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

### 5.1.5 data流模式

```text
user操作
  │
  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ UI 组件     │────▶│ Mutation   │────▶│ REST API   │
│ (触发)     │     │ (optimistic更新) │     │ (实际request) │
└────────────┘     └─────┬──────┘     └─────┬──────┘
                         │                  │
                  即时更新│                  │ 服务端response
                         ▼                  ▼
                  ┌────────────┐     ┌────────────┐
                  │ localcached   │     │ cached更新    │
                  │ (即时反馈) │     │ 或 rollback     │
                  └────────────┘     └────────────┘

WebSocket 事件 (服务端推送) 
  │
  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ WS Client  │────▶│ 事件路由   │────▶│ Query cached │
│ (接收)     │     │ (分发)     │     │ 失效/更新  │
└────────────┘     └────────────┘     └─────┬──────┘
                                            │
                                            ▼
                                     UI auto刷新
```

### 5.1.6 ViewModel 映射规范 (DTO → VM → Props 反腐层) 

UI 层在 `shared/api-client` 中引入三层data转换, 隔离后端 DTO 变更对 UI 组件的冲击: 

```text
后端 REST/WS ──→ DTO (api-client/types/) ──→ ViewModel (shared/viewmodels/) ──→ Props (features/*/components/)
                  │                            │                                   │
                  │ 原样映射后端 JSON           │ 业务语义转换 + fieldrename          │ 纯展示型, 无可选field
                  │ field名/type与后端一致       │ 添加派生field(如 isOverdue)          │ 所有field required
                  │ 由 openapi-ts auto生成      │ 手写 + 单元testingcoverage                 │ 由组件定义
```

**层级职责**: 

| 层级      | 位置                         | 生成方式         | allows的转换                                           | 禁止的行为                       |
| --------- | ---------------------------- | ---------------- | ---------------------------------------------------- | -------------------------------- |
| DTO       | `shared/api-client/types/`   | openapi-ts 生成  | 无 (与后端 OpenAPI schema 1:1)                       | 手动修改生成file                 |
| ViewModel | `shared/viewmodels/`         | 手写 mapper 函数 | fieldrename, type转换, 派生field, 空值default值, 枚举映射 | call API, 副作用, references UI 框架   |
| Props     | `features/*/components/*.ts` | 组件定义         | 展示格式化 (日期/数字/state文案)                      | references DTO type, directly持有 API response |

**Mapper 函数规范**: 

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

**规则**: 

- DTO 层禁止手动编辑 -- onlyvia `openapi-ts` 从后端 OpenAPI spec 重新生成
- ViewModel mapper 必须有对应单元testing, coverage空值, 边界枚举, 时区转换
- 组件 Props 不得出现 `| undefined` -- 所有可选性在 VM mapper 中消解
- Feature module中的 hooks (如 `useTaskList`) return VM array, 不return DTO

## 5.2 REST API 端点映射 (Implemented vs Planned) 

> **改进点 A-2**: 后端 http-server 路由交叉验证结果; v2.3 增加 API Layer 标注和 Public UI API Surface 分层. 

### 5.2.1 已implementation端点 [Implemented] (含 API Layer 标注) 

| UI 功能          | 后端路由file              | 端点示例                             | 方法       | state                     | API Layer |
| ---------------- | ------------------------- | ------------------------------------ | ---------- | ------------------------ | --------- |
| task CRUD        | `task-routes.ts`          | `/api/v1/tasks`, `/api/v1/tasks/:id` | GET/POST   | [Implemented/Contracted] | Layer C   |
| 审批操作         | `admin-routes.ts`         | `/api/v1/approvals/:id`              | POST       | [Implemented/Contracted] | Layer C   |
| Dashboard data   | `dashboard-routes.ts`     | `/api/v1/dashboard/*`                | GET        | [Implemented/Contracted] | Layer C   |
| Console 页面     | `console-routes.ts`       | `/console/*`                         | GET (HTML) | [Implemented/Internal]   | Layer B   |
| Admin manage       | `admin-routes.ts`         | `/admin/v1/*`                        | CRUD       | [Implemented/Contracted] | Layer B/C |
| contract版本validation     | `meta-routes`             | `/api/v1/meta/contract-version`      | GET        | [Implemented/Contracted] | Layer C   |
| Mission Control  | `mission-control-service` | via console-routes 暴露             | GET        | [Implemented/Internal]   | Layer A→C |
| Operator Console | `console-backend/`        | 快照/审批队列/Worker 面板/Incident   | GET        | [Implemented/Internal]   | Layer A→C |

### 5.2.2 规划端点 [Planned] (API augmentation需求) 

| UI 功能        | 建议端点                         | 方法    | data源建议                            | state      | 优先级 |
| -------------- | -------------------------------- | ------- | ------------------------------------- | --------- | ------ |
| Agent 列表     | `/api/v1/agents`                 | GET     | dashboard-routes + MissionControlService projection | [Implemented/Contracted] | P1     |
| Workflow CRUD  | `/api/v1/workflows`              | CRUD    | OrchestrationPlane workflow 存储      | [Planned] | P1     |
| Marketplace    | `/api/v1/marketplace`            | GET     | pack-routes + PackCatalogService      | [Implemented/Contracted] | P1     |
| 解释query       | `/api/v1/explanations`           | GET     | dashboard-routes summary projection   | [Implemented/Contracted] | P1     |
| 成本data       | `/api/v1/costs`                  | GET     | CostService (ops-maturity/)           | [Planned] | P2     |
| Dashboard 指标 | `/api/v1/dashboard/metrics`      | GET     | dashboard-routes + MissionControlService snapshot | [Implemented/Contracted] | P1     |
| Dashboard KPI  | `/api/v1/dashboard/kpis`         | GET     | MissionControlService 聚合            | [Planned] | P1     |
| Dashboard 趋势 | `/api/v1/dashboard/trend/{m}`    | GET     | DashboardProjectionService            | [Planned] | P2     |
| Dashboard 导出 | `/api/v1/dashboard/export`       | POST    | DashboardProjectionService            | [Planned] | P2     |
| Task Evidence  | `/api/v1/tasks/:id/evidence`     | GET     | StateEvidencePlane                    | [Planned] | P1     |
| Task Timeline  | `/api/v1/tasks/:id/timeline`     | GET     | StateEvidencePlane event log          | [Planned] | P1     |
| Agent 心跳     | `/api/v1/agents/{id}/heartbeats` | GET     | AgentRegistryService                  | [Planned] | P2     |
| Agent 指标     | `/api/v1/agents/{id}/metrics`    | GET     | AgentRegistryService                  | [Planned] | P2     |
| user偏好       | `/api/v1/user/preferences`       | GET/PUT | UserPreferenceService                 | [Planned] | P1     |
| 角色manage       | `/api/v1/admin/roles`            | CRUD    | admin-routes                          | [Planned] | P1     |
| 功能开关       | `/api/v1/admin/feature-flags`    | CRUD    | admin-routes                          | [Planned] | P1     |
| 模型configure       | `/api/v1/admin/models`           | CRUD    | admin-routes + ModelConfigService     | [Planned] | P1     |
| 域configure         | `/api/v1/admin/domains/{id}`     | GET/PUT | DomainConfigService                   | [Planned] | P1     |
| tenantmanage       | `/api/v1/admin/tenants`          | CRUD    | admin-routes                          | [Planned] | P2     |
| Webhook manage   | `/api/v1/admin/webhooks`         | CRUD    | admin-routes                          | [Planned] | P2     |

### 5.2.3 Public UI API Surface 分层 _(v2.3 新增)_

为消除"后端exists某服务/某 route"等同于"前端已可稳定集成"的歧义, 本节将后端 API 分为三个严格层次. 前端only可消费 **Layer C (Public Contract Endpoint) **; 对 Layer A/B 的消费需后端团队explicitly升级为 Layer C. 

| 层次                             | 定义                                                                             | 前端可消费 | 示例                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| **Layer A — Service Method**     | 后端 TypeScript service 类的方法, only在process内可call, 无 HTTP 暴露                 | ❌         | `MissionControlService.getSnapshot()` (service method)                 |
| **Layer B — Internal Route**     | via HTTP route 暴露但面向内部控制台/HTML 页面, 无public JSON schema, 无版本化保障 | ⚠️ 需confirmation  | `GET /console/*` (HTML 页面) · `/admin/v1/*` (partial HTML)               |
| **Layer C — Public Contract EP** | 面向外部消费者的 JSON API, 有 OpenAPI spec, 版本化path, 稳定的request/response schema   | ✅         | `GET /api/v1/tasks` · `POST /api/v1/tasks` · `GET /api/v1/dashboard/*` |

**当前各data源的层次归属**: 

| data源                                     | 当前层次  | 目标层次 | 升级动作                                                    |
| ------------------------------------------ | --------- | -------- | ----------------------------------------------------------- |
| `GET /api/v1/tasks` · `POST /api/v1/tasks` | Layer C   | Layer C  | 无需变更, 已有 OpenAPI spec                                 |
| `POST /api/v1/approvals/:id`               | Layer C   | Layer C  | 无需变更                                                    |
| `GET /api/v1/dashboard/*`                  | Layer C   | Layer C  | 无需变更                                                    |
| `MissionControlService.*`                  | Layer A   | Layer C  | 需新增 `GET /api/v1/mission-control/*` JSON route + OpenAPI |
| `OperatorConsoleBackendService.*`          | Layer A   | Layer C  | 需新增 `GET /api/v1/operator/*` JSON route + OpenAPI        |
| `GET /console/*`                           | Layer B   | Layer B  | 保持为内部 HTML entry, 前端不directly消费                        |
| `GET /admin/v1/*`                          | Layer B/C | Layer C  | partial已有 JSON response(Contracted); HTML partial标注 Internal      |
| `CRUD /api/v1/agents` (Planned)            | —         | Layer C  | directly按 Layer C 标准设计                                     |
| `CRUD /api/v1/workflows` (Planned)         | —         | Layer C  | directly按 Layer C 标准设计                                     |
| `GET /api/v1/marketplace`                  | C (done)  | Layer C  | 已有publicquery端点, 可directly按 Layer C 消费                     |
| `GET /api/v1/explanations`                 | C (done)  | Layer C  | 已有publicquery端点, 可directly按 Layer C 消费                     |
| `GET /api/v1/costs` (Planned)              | —         | Layer C  | directly按 Layer C 标准设计                                     |

**前端消费规则**: 

- 前端 `api-client/endpoints/*.ts` 中每个函数必须声明其目标端点的 Layer 级别
- Layer A/B 端点在代码中标注 `@internal`, 禁止在 feature module中directlyreferences
- 若 feature module需要 Layer A/B data, 必须via `mock-server` 提供临时 mock, 并在 backlog 中创建"升级到 Layer C"的 story
- Phase 1 Gate 0 前置条件增加: 所有 Phase 1 消费的端点必须达到 Layer C

### 5.2.4 Internal → Contracted 升级清单 (API Graduation Matrix)  _(v3.0 新增)_

前端不应长期停留在 Internal surface 上. 下表跟踪每个 Layer A/B data源的升级state, 明确升级到 Layer C 所需的前置条件和目标里程碑. 

| Source Service                    | Route / Method                    | Current Layer | Target Layer | Required Schema                               | Required Auth Model          | Required Versioning | Required Tests                      | Target Milestone | Status    |
| --------------------------------- | --------------------------------- | ------------- | ------------ | --------------------------------------------- | ---------------------------- | ------------------- | ----------------------------------- | ---------------- | --------- |
| `MissionControlService`           | `.getSnapshot()`                  | A             | C            | `MissionControlSnapshotDTO` (JSON Schema)     | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 1   | Pending   |
| `MissionControlService`           | `.getTaskCockpit()`               | A → C (done)  | C            | —                                             | —                            | —                   | —                                   | —                | Graduated |
| `MissionControlService`           | `.getWorkflowCockpit()`           | A             | C            | `WorkflowCockpitDTO` (JSON Schema)            | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 2   | Graduated |
| `MissionControlService`           | `.getStabilityPanel()`            | A             | C            | `StabilityPanelDTO` (JSON Schema)             | Bearer JWT + RBAC L3+ (SRE)  | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Graduated |
| `MissionControlService`           | `.getAdminTakeoverConsole()`      | A             | C            | `AdminTakeoverDTO` (JSON Schema)              | Bearer JWT + RBAC L4 (admin) | `/api/v1/`          | unit + integration + security       | Phase 2 Gate 1   | Pending   |
| `OperatorConsoleBackendService`   | `.getSnapshot()`                  | A             | C            | `OperatorSnapshotDTO` (JSON Schema)           | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `OperatorConsoleBackendService`   | `.getIncidentTimeline()`          | A             | C            | `IncidentTimelineDTO` (JSON Schema)           | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 1 Gate 2   | Pending   |
| `MissionControlService`           | worker projection via `/v1/workers` | A → C (done)  | C            | `WorkerPanelDTO` (JSON Schema)                | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 2   | Graduated |
| `MissionControlService`           | queue projection via `/v1/queues`   | A → C (done)  | C            | `QueueStatusDTO` (JSON Schema)                | Bearer JWT + RBAC L3+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 2   | Graduated |
| Console routes                    | `GET /console/*`                  | B             | B            | — (保持内部 HTML entry)                        | —                            | —                   | —                                   | —                | N/A       |
| Admin routes                      | `GET /admin/v1/*` (HTML portions) | B             | B/C          | 已有 JSON partial保持 C; HTML partial标注 Internal  | —                            | —                   | —                                   | —                | Partial   |
| `DomainOnboardingService`         | interaction/ux/onboarding/        | A             | C            | `DomainOnboardingDTO` (JSON Schema)           | Bearer JWT + RBAC L2+        | `/api/v1/`          | unit + integration + contract       | Phase 2 Gate 1   | Pending   |
| `NLEntryService` + `IntentParser` | conversation API                  | A (Partial)   | C            | `ConversationDTO` + `IntentDTO` (JSON Schema) | Bearer JWT + RBAC L1+        | `/api/v1/`          | unit + integration + NLU regression | Phase 1 Gate 2   | Pending   |

**升级流程**: 

1. **后端 API owner** 创建升级 story → 添加 JSON route + OpenAPI spec + request/response schema
2. **后端 QA** 补充 contract test + integration test
3. **架构评审** 在 Sprint Review confirmation schema 冻结 → 子标签从 `Internal` / `Partial` 更新为 `Contracted`
4. **前端团队** 从 mock-server 切换到真实端点, removal `@internal` 标注
5. **Gate check** 在对应 Phase Gate 前, 所有该 Gate 要求的端点必须达到 `Graduated` state

## 5.3 WebSocket 实时事件映射

> **改进点 A-3**: 按后端实际implementation分层. 

### 5.3.1 已implementation事件 [Implemented] (WebSocketBridge + TaskWebSocketStatusRelay) 

后端 `TaskWebSocketEvent` 和 `WebSocketBridge` 已支持的事件type: 

| 后端事件type         | 触发时机         | UI response                   | TanStack Query strategy                | state          |
| -------------------- | ---------------- | ------------------------- | ---------------------------------- | ------------- |
| `status_changed`     | taskstate变更     | task卡片state徽标更新      | `invalidateQueries(['tasks'])`     | [Implemented] |
| `progress`           | step进度更新     | step进度条推进            | directly更新 cache                     | [Implemented] |
| `message_delta`      | LLM 流式output增量 | 对话气泡实时追加文字      | directly更新 Zustand                   | [Implemented] |
| `artifact_ready`     | 制品生成完成     | 制品卡片出现              | `invalidateQueries(['tasks', id])` | [Implemented] |
| `approval_requested` | 需要人工审批     | 审批notification弹窗 + Badge 计数 | `invalidateQueries(['approvals'])` | [Implemented] |
| `completed`          | task完成         | task卡片标记完成          | `invalidateQueries(['tasks'])`     | [Implemented] |
| `failed`             | taskfailure         | task卡片标记failure + 告警   | `invalidateQueries(['tasks'])`     | [Implemented] |

### 5.3.2 需扩展事件 [Planned] (UI 需求 → 后端augmentation) 

| UI 事件type                  | UI response              | 后端扩展建议                          | state       | 优先级 |
| ---------------------------- | -------------------- | ------------------------------------- | ---------- | ------ |
| `approval.resolved`          | 审批卡片state更新     | WebSocketBridge 增加审批结果广播      | [Planned]  | P1     |
| `agent.health_changed`       | Agent 健康指示灯变色 | AgentRegistry 健康变更事件            | [Planned]  | P2     |
| `incident.created`           | globally告警横幅         | IncidentService 事件广播              | [Planned]  | P1     |
| `dashboard.metric_updated`   | 看板数值/graph表刷新    | DashboardProjectionService delta push | [Planned]  | P2     |
| `panic.activated`            | globally紧急制动蒙层     | PanicService 事件广播                 | [Planned]  | P1     |
| `hitl.intervention_required` | HITL 全屏介入面板    | HITL notification module 事件扩展     | [Planned]  | P1     |
| `nl.clarification_needed`    | NL 对话追问气泡      | NLEntryService 追问事件               | [Proposed] | P2     |
| `cost.budget_alert`          | 预算告警 Toast       | CostService 预算事件                  | [Proposed] | P3     |
| `drift.alert`                | drift告警notification         | DriftDetector 事件广播                | [Proposed] | P3     |

### 5.3.2.1 WSEventRouter 完整架构

```text
┌──────────────────────────────────────────────────────┐
│                 WSEventRouter                         │
│                                                      │
│  WebSocket /ws/v1/stream                             │
│       │                                              │
│       ▼                                              │
│  ┌────────────────────┐                              │
│  │ 心跳manage器          │ 每30s ping, 45s无pong=断线   │
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
│  │  task.status_changed      → taskcached失效   │      │
│  │  task.step_completed      → step进度更新   │      │
│  │  approval.requested       → 审批 Badge +1  │      │
│  │  approval.resolved        → 审批cached失效   │      │
│  │  agent.health_changed     → Agent 健康更新 │      │
│  │  incident.created         → globally告警横幅   │      │
│  │  dashboard.metric_updated → 看板data刷新   │      │
│  │  hitl.intervention_required → HITL 弹窗    │      │
│  │  panic.activated          → 紧急制动蒙层   │      │
│  │  drift.alert              → drift告警notification   │      │
│  │  cost.budget_alert        → 预算告警 Toast │      │
│  │  debug.breakpoint_hit     → 调试器暂停     │      │
│  └────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

### 5.3.2.2 事件 → Query cached映射

| 事件type                   | Query cached操作                     | UI 更新方式      |
| -------------------------- | ---------------------------------- | ---------------- |
| `task.status_changed`      | invalidate `taskKeys.list`         | 列表auto刷新     |
| `task.step_completed`      | directly更新 `taskKeys.detail(id)`     | 进度条推进       |
| `approval.requested`       | invalidate `approvalKeys.list`     | 列表刷新 + Badge |
| `approval.resolved`        | invalidate `approvalKeys.list`     | 列表刷新         |
| `agent.health_changed`     | directly更新 agent health field        | 健康指示灯变色   |
| `dashboard.metric_updated` | directly更新 dashboard query data      | graph表/数值刷新    |
| `incident.created`         | 写入 RealtimeStore.activeIncidents | globally横幅展示     |
| `panic.activated`          | 写入 RealtimeStore.panicActivated  | 全屏蒙层         |

### 5.3.2.3 紧急事件handle

以下事件优先级最高, 无论当前页面state如何都立即response: 

| 事件                            | UI response                                  | 优先级 |
| ------------------------------- | ---------------------------------------- | ------ |
| `panic.activated`               | 全屏红色蒙层 + 紧急制动提示              | SEV1   |
| `incident.created` (SEV1)       | globally置顶告警横幅 + 推送notification              | SEV1   |
| `hitl.intervention_required`    | 全屏 HITL 介入面板 (桌面) / 推送 (移动)  | SEV2   |
| `approval.requested` (Critical) | 审批弹窗 + 声音提示 + 震动               | SEV2   |

### 5.3.3 WebSocket 连接manage

```text
连接strategy: 
1. 认证: JWT token 作为 ws 握手 auth 参数 (与 WebSocketBridge 现有implementation一致) 
2. 断线重连: 指数backoff (1s → 2s → 4s → 8s → 16s → 30s max) + 随机 jitter
3. 心跳保活: 每 30s 发送 ping, 45s 无 pong 视为断线 (与 DashboardWebSocketServer 一致) 
4. 多标签页: SharedWorker (Web) / singleton连接 (桌面/移动) 避免duplicate连接
5. 离线缓冲: 断线期间事件缓冲到 L4 offlineStore, 重连后按序回放
6. 订阅manage: 按当前页面/视graphdynamic订阅/cancel订阅事件通道, 减少带宽
7. 与 gateway_streaming_contract.md 对齐: 
   - chunk commit, catch-up, backlog drain 按队列压力和消息年龄自适应
   - catch-up 不打乱消息order
   - 不via单帧暴力 flush 破坏can read性
```

### 5.3.4 SharedWorker WebSocket 架构 (Web 端) 

Web 端uses SharedWorker 在多标签页间shared单一 WebSocket 连接, 避免duplicate连接和带宽浪费: 

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

| strategy          | Web (SharedWorker)                           | 桌面端              | 移动端                 |
| ------------- | -------------------------------------------- | ------------------- | ---------------------- |
| 多标签/多window | SharedWorker shared单一连接                    | 主processsingleton连接      | singleton连接               |
| 后台strategy      | visibilitychange → 降低推送频率              | 最小化 → only保留心跳 | 后台 → 断开 + FCM/APNs |
| 断线重连      | 指数backoff(1s→30s) + jitter                    | 同 Web              | 同 Web                 |
| 离线缓冲      | IndexedDB 缓冲                               | SQLite 缓冲         | SQLite 缓冲            |
| Fallback      | 不支持 SharedWorker → 降级为主线程 WebSocket | N/A                 | N/A                    |

### 5.3.5 SSE Fallback

后端 `StreamBridge` 提供 SSE 端点, 作为 WebSocket 不可用时的降级方案: 

```text
WebSocket 不可用判断: 
  - 企业代理/防火墙拦截 ws 升级
  - 3 次连接尝试均failure
  ↓
降级到 SSE (Server-Sent Events) : 
  - GET /api/v1/stream (Accept: text/event-stream)
  - 事件格式与 WebSocket payload 一致
  - 丧失双向通信 (操作仍via REST) 
  ↓
SSE 也不可用: 
  - 降级到 30s 轮询
  - UI 显示 "实时更新不可用" 提示
```

### 5.3.6 WebSocket 订阅域模型

UI 采用频道化订阅模型, 页面进入时订阅相关频道, 退出时autocancel, 降低带宽与后端广播开销: 

**频道分类**: 

| 频道类别   | 频道格式                | 生命周期          | 事件示例                                  | state          |
| ---------- | ----------------------- | ----------------- | ----------------------------------------- | ------------- |
| globally频道   | `global`                | 登录→登出         | `panic.activated`, `incident.created`     | [Implemented] |
| task频道   | `task:{taskId}`         | 进入详情→离开     | `status_changed`, `progress`, `completed` | [Implemented] |
| 工作流频道 | `workflow:{workflowId}` | 进入详情→离开     | `step_completed`, `workflow_finished`     | [Planned]     |
| 审批频道   | `approvals`             | 进入审批中心→离开 | `approval_requested`, `approval.resolved` | [Implemented] |
| manage频道   | `admin:{scope}`         | 进入manage面板→离开 | `agent.health_changed`, `worker.status`   | [Planned]     |
| 看板频道   | `dashboard`             | 进入看板→离开     | `dashboard.metric_updated`                | [Planned]     |

**订阅生命周期规则**: 

```text
页面进入 (useEffect mount)
  │
  ├─→ subscribe(channels[])     // 向 SharedWorker/WSManager 注册频道
  │
  ├─→ 接收事件 → 更新 TanStack Query cache / Zustand store
  │
  └─→ 页面离开 (useEffect cleanup)
        │
        └─→ unsubscribe(channels[])  // cancel频道订阅
```

**降级strategy**: 

| 场景                    | 行为                                                            |
| ----------------------- | --------------------------------------------------------------- |
| 后台标签页 (Web)        | `visibilitychange` hidden → 保留 `global` 频道, cancel页面级频道  |
| 后台标签页 (桌面)       | 最小化 → 同 Web 逻辑                                            |
| 移动端进入后台          | `lifecycle.onBackground` → 断开 WS, 切换为 FCM/APNs 推送        |
| 移动端恢复前台          | `lifecycle.onForeground` → 重建 WS 连接 + catch-up 拉取missing事件 |
| 标签页超过 5 分钟未活跃 | 断开页面级频道, only保留globally频道 + 60s 心跳                       |

## 5.4 API 通信层架构

```text
┌──────────────────────────────────────────────────┐
│              RESTClient                           │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │          Interceptor Chain                   │ │
│  │  AuthInterceptor     → JWT auto刷新          │ │
│  │  TenantInterceptor   → tenant_id/domain injection │ │
│  │  RetryInterceptor    → 指数backoff + jitter     │ │
│  │  DedupeInterceptor   → requestdeduplication              │ │
│  │  OfflineInterceptor  → 离线排队 (移动端)     │ │
│  │  TraceInterceptor    → X-Request-Id/Trace-Id │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Transport: L4 PlatformAdapter.fetch()           │
│  (Web=fetch / Electron=net / Tauri=reqwest /     │
│   RN=fetch)                                      │
└──────────────────────────────────────────────────┘
```

### 5.4.1 RESTClient 核心interface `[Planned]`

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

Transport 层viadependencyinjection, 由 L4 `PlatformAdapter.fetch()` 提供具体implementation. RESTClient 本身不directlycall `fetch`. 

### 5.4.2 WebSocket Client interface `[Planned]`

> _提取自 Doc-11 §6.1.2 — WebSocket Client 设计. 与 §5.3 WebSocket 层形成互补: §5.3 定义频道模型与订阅域, 本节定义客户端编程interface. _

```text
连接生命周期: 
  DISCONNECTED → CONNECTING → CONNECTED → SUBSCRIBED
       ↑              │            │           │
       └──────────────┴── 断线 ────┘           │
                              ↑                │
                              └── 心跳timeout ────┘
重连strategy: 
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

> _提取自 Doc-11 §6.1.3 — 每个 API 端点封装为independent函数, return TanStack Query compatibilityconfigure. _

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

**规则**: 

- 一个端点 = 一个函数 + 对应的 query key factory
- 函数接收 `RESTClient` 实例 (便于testing mock) 
- returntype与后端 OpenAPI spec 对齐 (参见 附录 A) 

### 5.4.4 认证流程与 Token manage `[Planned]`

> _提取自 Doc-11 §6.2 — Auth Module. 与 §6.5 安全架构互补: §6.5 定义安全strategy, 本节定义客户端认证implementation流程. _

```text
App 启动
  │
  ├─ check SecureStorage 中是否有 refresh_token
  │    ├─ 有 → 尝试silently刷新 access_token
  │    │    ├─ success → 进入 Authenticated state
  │    │    └─ failure → 跳转登录页
  │    └─ 无 → 跳转登录页
  │
  登录页
  ├─ SSO (OIDC) → system浏览器 OAuth2 PKCE 流程 → 回调获取 tokens
  ├─ SSO (SAML) → system浏览器 SAML 流程 → 回调获取 tokens
  └─ API Key → directly输入 (only开发模式/CLI 模式) 
  │
  tokens 存入 L4 SecureStorage → 进入 Authenticated state
```

| strategy     | 说明                                                                  |
| -------- | --------------------------------------------------------------------- |
| auto刷新 | access_token expiry前 60s 触发silently刷新, 无感知                          |
| 刷新lock   | concurrentrequest发现 token expiry时, only第一个触发刷新, 其余排队等待             |
| 刷新failure | return 401 → clearlocal token → 重定向登录页 → 保存当前路由以便登录后恢复 |
| 多设备   | 支持查看活跃会话列表 → 选择性撤销                                     |
| 二次认证 | 高risk操作 (审批 Critical, 修改安全设置) 触发生物识别/密码二次验证    |

### 5.4.5 离线队列与synchronous协调器 `[Planned]`

> _提取自 Doc-11 §6.3 — Sync Engine. 与 §5.5 离线架构互补: §5.5 定义离线分层strategy, 本节定义队列record结构与conflict解决. _

**队列record结构**: 

| field             | type        | 说明                                                     |
| ---------------- | ----------- | -------------------------------------------------------- |
| `id`             | ULID        | globally唯一标识                                             |
| `method`         | HTTP Method | POST / PUT / PATCH / DELETE                              |
| `path`           | string      | API path, 如 `/api/v1/tasks`                             |
| `body`           | JSON        | request体                                                   |
| `idempotencyKey` | string      | 幂等键, 防止duplicate提交                                     |
| `createdAt`      | ISO-8601    | 创建时间                                                 |
| `retryCount`     | number      | 当前重试次数                                             |
| `status`         | enum        | `pending` / `syncing` / `synced` / `conflict` / `failed` |

**SyncCoordinator 恢复流程**: success → `synced` → notification UI ｜ 409 → `conflict` → conflict解决 UI ｜ 500 → 重试 (max 3) → `failed` → notificationuser. 

**conflict解决strategy**: 

| datatype       | strategy                                                     |
| -------------- | -------------------------------------------------------- |
| task创建       | 无conflict (幂等键保护)                                      |
| 审批决策       | 服务端优先 (先到先得) , conflict时notificationuser"审批已被他人handle" |
| configure变更       | 服务端优先 + CAS 版本号check, conflict时展示双栏 diff         |
| Agent state变更 | 服务端优先, conflict时notificationuser刷新后重试                     |

### 5.4.6 pagination与filter标准化

所有列表interface统一uses后端的 cursor-based pagination: 

```typescript
interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  totalCount?: number;
}

interface QueryParams {
  cursor?: string;
  limit?: number; // default 20, 最大 100
  status?: string;
  tenantId?: string;
  domainId?: string;
  sort?: string; // "created_at:desc"
  createdAfter?: string;
  createdBefore?: string;
}
```

TanStack Query 的 `useInfiniteQuery` 映射 cursor pagination: 

```text
useInfiniteQuery({
  queryKey: taskKeys.list(filters),
  queryFn: ({ pageParam }) => fetchTasks(client, { ...filters, cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

## 5.5 离线与synchronous架构

> **改进点 D-1**: 明确 Web 端离线三层strategy. 

### 5.5.1 Web 端离线三层strategy

| 层次            | 技术                               | cachedcontent                          | strategy                                   |
| --------------- | ---------------------------------- | --------------------------------- | -------------------------------------- |
| L1 static资源cached | Service Worker Cache               | JS/CSS/graph片/字体                  | Cache-First, 版本化 hash               |
| L2 API responsecached | TanStack Query persist + IndexedDB | task列表/审批列表/看板快照        | Network-First + Stale-While-Revalidate |
| L3 操作队列     | IndexedDB (offline-queue)          | 待发送的操作 (approve/cancel 等)  | FIFO 队列, 连接恢复后按序replay          |

**关键约束**: 

- L2 cacheddata不含 PII (参见 `00-platform-architecture.md` data分类strategy) 
- L3 队列中的操作带 idempotency key, 防止duplicate提交
- Service Worker 与 TanStack Query 职责分离: SW 管static资源, TQ 管 API data

### 5.5.2 桌面端离线strategy

| 平台    | 离线存储                             | synchronous机制                          |
| ------- | ------------------------------------ | --------------------------------- |
| Windows | SQLite (better-sqlite3) via Electron | Electron 主process定时synchronous + WS push |
| macOS   | SQLite (rusqlite) via Tauri          | Tauri Rust 后端定时synchronous + WS push |
| Linux   | SQLite (rusqlite) via Tauri          | 同 macOS                          |

### 5.5.3 移动端离线strategy

| 平台    | 离线存储      | 后台synchronous                              | conflict解决                   |
| ------- | ------------- | ------------------------------------- | -------------------------- |
| Android | SQLite (Room) | WorkManager 后台task + FCM 唤醒       | Last-Write-Wins + user选择 |
| iOS     | SQLite (GRDB) | BackgroundTasks framework + APNs 唤醒 | 同 Android                 |

### 5.5.4 conflict解决strategy

```text
conflict检测: 
  - 操作携带 version_vector (based on MissionControlService 快照版本) 
  - 服务端return 409 Conflict 时触发conflict解决流程

conflict解决优先级: 
  1. auto合并: 非conflictfield各自保留 (如同时修改不同 task 的不同field) 
  2. Last-Write-Wins: 低risk操作 (查看, 标记已读) 
  3. user选择: 高risk操作 (审批, cancel, 接管) 弹出conflict面板
  4. 服务端权威: 涉及 authoritative state的操作始终以服务端为准
```

### 5.5.5 离线存储容量规划

| datatype     | 存储方式                        | 容量limit | expirystrategy        |
| ------------ | ------------------------------- | -------- | --------------- |
| userconfigure     | SecureStorage / AsyncStorage    | 1MB      | 永久            |
| task列表cached | SQLite / IndexedDB              | 50MB     | 30 天未访问cleanup |
| 看板快照     | SQLite / IndexedDB              | 10MB     | 24h             |
| 操作队列     | SQLite / IndexedDB              | 20MB     | synchronous后cleanup      |
| 翻译file     | filesystem                        | 5MB      | 版本更新时替换  |
| 离线 NL 模型 | filesystem (only Edge-Mobile 场景)  | 500MB    | 手动更新        |

**容量监控**: L3 sync-store 跟踪各类存储uses量, 超过阈值时auto触发 LRU 淘汰并via Toast notificationuser. 

### 5.5.6 离线操作许可矩阵

并非所有操作都allows离线排队. 以下矩阵定义每类操作的离线行为: 

| 操作类别                   | 离线排队 | optimistic更新 | 恢复后autoreplay | conflictstrategy                  | 说明                                  |
| -------------------------- | -------- | -------- | -------------- | ------------------------- | ------------------------------------- |
| 标记已读                   | ✅       | ✅       | ✅             | Last-Write-Wins           | 幂等操作, 无conflictrisk                  |
| task备注/评论              | ✅       | ✅       | ✅             | 追加合并                  | 离线评论追加到时间线末尾              |
| 审批操作 (approve/reject)  | ❌       | ❌       | N/A            | N/A                       | 审批有时效性, 离线时显示"需联网操作"  |
| taskcancel                   | ⚠️       | ❌       | ⚠️ 需confirmation      | user选择                  | 排队但不optimistic更新, 恢复后弹窗confirmation      |
| Admin Takeover             | ❌       | ❌       | N/A            | N/A                       | 紧急操作必须在线execute                  |
| Panic 紧急制动             | ❌       | ❌       | N/A            | N/A                       | 必须在线, 离线时提示无法execute          |
| 创建新task                 | ✅       | ✅       | ✅             | 服务端分配 ID 替换临时 ID | optimistic生成临时 ID, synchronous后替换           |
| 修改taskconfigure               | ⚠️       | ✅       | ⚠️ 版本check    | 版本conflict → user选择       | 携带 version_vector, 409 时弹conflict面板 |
| 查看/浏览 (只读)           | ✅       | N/A      | N/A            | uses stale cache          | 显示cacheddata + "离线data, 可能expiry"   |
| Marketplace 安装           | ❌       | ❌       | N/A            | N/A                       | 需要下载资源, 必须在线                |
| 导出报表                   | ⚠️       | ❌       | ✅             | 排队, 恢复后execute并notification    | 生成可能耗时, 排队到在线后execute        |

**UI 提示规范**: 

- 禁止离线的操作: 按钮显示为 disabled + tooltip "需要网络连接"
- allows排队的操作: 按钮正常可用, 点击后显示 "已加入离线队列 (第 N 位) "
- 需confirmation的操作: 恢复在线时弹出confirmation对话框 "以下操作在离线期间排队, 是否继续execute? "

## 5.6 前端error分级与降级strategy

### 5.6.1 error分级

| 级别   | errortype                            | 影响range       | UI 表现                                              | auto恢复    |
| ------ | ----------------------------------- | -------------- | ---------------------------------------------------- | ----------- |
| **P0** | 认证failure / Token 无法刷新           | globally           | force跳转登录页 + clearlocalstate                        | ❌          |
| **P1** | API 服务不可达 (全部端点 5xx/timeout)  | globally           | globally banner "服务暂时不可用" + 只读 stale cache 模式 | ✅ 30s 重试 |
| **P2** | WebSocket 连接断开                  | 实时更新       | state栏 "实时更新不可用" + auto降级 SSE/轮询          | ✅ 指数backoff |
| **P3** | 单个 API 端点failure (4xx/5xx)         | 单页面/module    | module-levelerror卡片 "加载failure, 点击重试" + telemetry 上报 | ✅ user触发 |
| **P4** | DomainUIConfig 加载failure             | 域相关页面     | usesdefaultconfigure + Toast "域configure加载failure, usesdefault设置"  | ✅ 后台重试 |
| **P5** | Feature flag inconsistent                 | 单功能         | 隐藏不确定state的功能 + log上报                      | ✅ 下次刷新 |
| **P6** | Contract version mismatch           | potentialcompatibility性问题 | 持久 banner 警告 + telemetry 上报 + 功能不阻断       | ❌ 需升级   |
| **P7** | Stale cache 展示                    | data时效性     | data卡片角标 "cacheddata" + 上次更新时间               | ✅ auto     |

### 5.6.2 降级行为矩阵

| 故障场景                    | 即时降级行为                  | 持续降级行为 (>60s)                | 恢复行为                          |
| --------------------------- | ----------------------------- | ---------------------------------- | --------------------------------- |
| REST API 全部不可达         | stale cache 只读 + 禁用写操作 | globally Error Boundary + 离线模式提示 | auto revalidate 全部 active query |
| REST API partial端点异常       | 受影响module显示 ErrorCard      | ErrorCard + 后台 30s 重试          | success后auto刷新该module              |
| WebSocket 断开              | 降级为 SSE                    | SSE 也failure → 降级为 30s 轮询       | WS 恢复后auto切回 + catch-up      |
| DomainUIConfig missing         | default config fallback          | 不变                               | 后台周期性重试, success后热替换      |
| Feature flag 服务不可达     | uses上次cached的 flag 值        | 不变                               | 恢复后silently更新                    |
| Contract version 不匹配     | 持久 banner + 正常功能        | 不变                               | 检测到版本修复后removal banner       |
| IndexedDB / SQLite 写入failure | 降级为in-memorycached + Toast 警告   | 尝试cleanupexpirydata后重试             | 恢复后回写in-memorydata到持久层        |

### 5.6.3 Error Boundary strategy

```text
App ErrorBoundary (P0/P1 级 → globallyerror页) 
  └─ Layout ErrorBoundary (导航仍可用) 
       └─ Page ErrorBoundary (P3 级 → 页面级 ErrorCard) 
            └─ Widget ErrorBoundary (P4-P7 级 → 组件级 fallback) 
```

### 5.6.4 Mutation 幂等与重试规范 _(v2.3 新增)_

写操作 (Mutation) 的幂等性和重试语义directly影响data一致性和user体验. 以下规范定义每类关键写操作的行为. 

#### Mutation 行为矩阵

| 操作                     | 幂等性         | Idempotency Key  | 前端防duplicate提交          | failure后可重试 | 重试方式      | failure后 UI state   |
| ------------------------ | -------------- | ---------------- | ----------------------- | ------------ | ------------- | ---------------- |
| 创建task                 | ✅ 幂等 (key)  | `ULID`           | 点击后 disable 5s       | ✅           | auto重试 ×3   | 恢复为未提交     |
| canceltask                 | ✅ 幂等        | `task_id`        | 点击后 disable 直到response | ✅           | 手动重试按钮  | 恢复为cancel前state |
| 审批 approve             | ✅ 幂等        | `approval_id`    | 点击后 disable 直到response | ⚠️ 条件      | only 5xx 可重试 | 恢复为待审批     |
| 审批 reject              | ✅ 幂等        | `approval_id`    | 点击后 disable 直到response | ⚠️ 条件      | only 5xx 可重试 | 恢复为待审批     |
| 审批 delegate            | ✅ 幂等        | `approval_id+to` | 点击后 disable 直到response | ✅           | 手动重试      | 恢复为待审批     |
| Admin Takeover           | ❌ 非幂等      | N/A              | 双人confirmation + disable      | ❌           | 禁止auto重试  | 显示failure原因     |
| Panic 紧急制动           | ✅ 幂等        | singleton        | 双人confirmation + disable      | ✅           | 手动重试      | 显示制动failure告警 |
| Marketplace 安装         | ✅ 幂等 (key)  | `pack_id+ver`    | 进度条 + disable        | ✅           | auto重试 ×2   | 恢复为未安装     |
| 域configure修改               | ⚠️ CAS         | `domain_id+ver`  | 点击后 disable 直到response | ⚠️ 条件      | 409→user选择  | 显示conflict diff    |
| Worker manage (切换/停止)  | ❌ 非幂等      | N/A              | confirmation弹窗 + disable      | ❌           | 禁止auto重试  | 显示failure原因     |
| task备注/评论            | ✅ 幂等 (key)  | `ULID`           | optimistic追加 + disable      | ✅           | auto重试 ×3   | 标记为"发送failure" |
| 导出报表                 | ✅ 幂等        | `export_id`      | 进度条                  | ✅           | auto重试 ×2   | notificationuser导出failure |

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

**规则**: 

- 所有 POST/PUT/PATCH/DELETE request必须携带 `X-Idempotency-Key` request头
- Key 生成strategy: `ULID` (创建类操作) 或 `资源ID+版本号` (更新类操作) 或 `singleton` (globally唯一操作) 
- 前端 `RESTClient` interceptor autoinjection idempotency key
- 后端return `409 Conflict` 时, 前端禁止auto重试, 必须进入conflict解决流程
- 后端return `429 Too Many Requests` 时, 前端按 `Retry-After` header 延迟重试
- 防duplicate提交: mutation 触发后, 对应按钮立即 `disabled`, 直到request settled (success或最终failure) 

### 5.6.5 optimistic更新模式

关键写操作usesoptimistic更新提升体验: 

| 操作       | optimistic更新strategy                         | rollbackstrategy                     |
| ---------- | ------------------------------------ | ---------------------------- |
| 创建task   | 立即在列表头部insert optimistic item   | removal optimistic item + Toast |
| 审批决策   | 立即移出待审批列表 + 更新 Badge 计数 | 恢复到待审批 + error提示      |
| Agent state | 立即更新state标签                     | 恢复原state + error提示        |
| configure变更   | 立即更新configure展示                     | 恢复原configure + error提示        |

### 5.6.6 HTTP state码 → UI 行为映射

```text
API responseerror
  │
  ├─ 401 Unauthorized → 触发 Token 刷新 → 重试 → 仍 401 → 重定向登录
  ├─ 403 Forbidden → Toast "permissions不足" + 禁用相关按钮
  ├─ 404 Not Found → 跳转 404 页面或 Toast "资源不exists"
  ├─ 409 Conflict → 展示conflict解决 UI (CAS 版本conflict) 
  ├─ 422 Validation → 表单field级error提示
  ├─ 429 Too Many Requests → Toast "操作过于频繁" + autobackoff重试
  └─ 5xx Server Error → Toast "服务器error" + auto重试 (最多 2 次) 
```

---

# Part V — 平台治理

---

# 6. 域差异化, 多tenant, 安全与设计system

> **改进点 D-2, R-3**: 定义 DomainUIConfig 消费协议与后端对齐; 合并认证/安全章节. 

## 6.1 24 域差异化 UI 引擎

> **改进点 D-2**: 明确 DomainUIConfig 如何从后端 DomainDescriptor 派生. 

### 6.1.1 DomainUIConfig 消费协议

```text
后端 DomainDescriptor (参见 00-platform-architecture.md 域描述符) 
    │
    │  GET /admin/v1/domains/{id}
    ▼
前端 DomainUIConfigResolver
    │
    ├── 读取 DomainDescriptor.risk_level → 映射 riskDisplayMode
    ├── 读取 DomainDescriptor.domain_type → 映射 dashboardPanels 模板
    ├── 读取 DomainDescriptor.hitl_policy → 映射 hitlEnhanced
    ├── 读取 DomainDescriptor.compliance_flags → 映射 complianceExtensions
    └── 合并 domainId → icon/color (从 design-tokens/domain.ts 查找) 
    │
    ▼
DomainUIConfig (前端runtimeconfigure对象) 
```

### 6.1.2 DomainUIConfig type定义

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

  // [Planned] v2.2 新增: 域级功能可见性
  featureVisibility: Record<string, boolean>;

  // [Planned] v2.2 新增: 动作级strategy
  actionPolicy: Record<string, ActionPolicyEntry>;

  // [Planned] v2.2 新增: default下钻深度
  defaultDrillDepth: 1 | 2 | 3 | 4 | 5;

  // [Planned] v2.2 新增: 域术语替换
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

### 6.1.2.1 DomainUIConfig 扩展field说明

| field                | type                           | state      | 说明                                                                                          |
| ------------------- | ------------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| `featureVisibility` | `Record<string, boolean>`      | [Planned] | 域级功能隐藏开关. 键为 feature 路由名 (如 `"workflow-builder"`) , 值为是否可见                |
| `actionPolicy`      | `Record<string, ActionPolicy>` | [Planned] | 动作级二次confirmation/审批strategy. 键为动作标识 (如 `"task.cancel"`) , 值定义是否需confirmation, 审批或隐藏     |
| `defaultDrillDepth` | `1 \| 2 \| 3 \| 4 \| 5`        | [Planned] | 该域下页面default展开的下钻深度, user可手动展开至permissionsallows的最大深度                              |
| `glossaryOverrides` | `Record<string, string>`       | [Planned] | 域术语替换映射. 键为平台通用术语 (如 `"Task"`) , 值为域专属术语 (如量化交易域的 `"Strategy"`) |

**featureVisibility 示例**: 

```json
{
  "workflow-builder": false,
  "workflow-debugger": false,
  "marketplace": true,
  "cost-center": true,
  "explainability": true
}
```

**actionPolicy 示例** (金融服务域) : 

```json
{
  "task.cancel": {
    "action": "approval_required",
    "approvalWorkflow": "finance-cancel-review"
  },
  "task.create": {
    "action": "confirm",
    "confirmMessage": "此操作将触发实盘交易流程, confirmation继续? "
  },
  "admin.takeover": { "action": "hidden" }
}
```

**glossaryOverrides 示例** (量化交易域) : 

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

| 域risk等级 | UI 差异                                                                          | 示例域                           |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------- |
| Critical   | 所有操作需二次confirmation; risk面板default展开; 审批卡片含完整risk评估; 紧急联系人始终可见 | 量化交易, 金融服务, 医疗健康     |
| High       | 写操作需confirmation; risk徽标突出; 审批含risk摘要; 成本预警阈值降低                     | 法务, 财务, 电商定价, IT ops    |
| Medium     | 标准 UI; risk徽标常规展示; 审批流程标准                                          | 广告推广, 客服, content审核, 供应链 |
| Low        | 简化 UI; 可隐藏risk面板; 审批可选batchhandle                                        | dataanalysis, 企业知识库, user运营   |

### 6.1.4 域专属 UI 扩展点 (示例) 

| 域       | 扩展组件                                                    | 说明                                   |
| -------- | ----------------------------------------------------------- | -------------------------------------- |
| 量化交易 | PositionPanel, PnLChart, RiskGauge                          | 持仓面板, 盈亏曲线, VaR/CVaR 仪表盘    |
| 电商     | OrderTimeline, PriceCompare, InventoryHeatmap               | 订单时间线, 价格对比, 库存热力graph       |
| 广告推广 | CampaignDashboard, BudgetBurndown, CreativePreview          | 投放看板, 预算消耗, 素材预览           |
| 金融服务 | ComplianceChecklist, AuditTrail, RegulatoryReport           | 合规清单, 审计轨迹, 监管报表           |
| 客服     | ConversationView, CSATChart, EscalationQueue                | 对话视graph, 满意度graph, 升级队列           |
| 医疗健康 | PatientTimeline, PhysicianReviewPanel, DrugInteractionAlert | 患者时间线, 医师审核面板, 药物交互告警 |

### 6.1.5 域扩展 Slot 模式与dynamic加载

功能module预留插槽 (Slot) , 域configure决定填充content: 

```text
TaskDetailPage
  ├── [fixed区域] task基本信息
  ├── [Slot: domain-task-header] ← 域专属头部扩展
  ├── [fixed区域] step列表
  ├── [Slot: domain-task-detail] ← 域专属详情扩展
  └── [fixed区域] 操作按钮栏

扩展组件注册: 
  quant-trading → PositionPanel, PnLChart, RiskGauge
  ecommerce     → OrderTimeline, PriceCompare
  advertising   → CampaignDashboard, BudgetBurndown
  healthcare    → PatientTimeline, DrugInteractionAlert
  coding        → CodeDiffViewer, PRTimeline, CIStatus
```

域扩展组件viadynamic import 按需加载, 不增加初始包体积: 

```text
DomainExtensionLoader
  │
  ├─ 获取当前 domainId
  ├─ query DomainUIConfig
  ├─ dynamic import(`@aa/domain-extensions/${domainId}/${slot}`)
  └─ 渲染到 Slot 位置 (Suspense + Skeleton fallback) 
```

## 6.2 多tenant UI 架构

### 6.2.1 tenant上下文

```text
user登录
    │
    ▼
TenantContextProvider
    ├── tenantId (从 JWT 解析) 
    ├── tenantConfig (主题色, Logo, 功能开关) 
    ├── orgTree (组织架构树, 参见 `00-platform-architecture.md` 组织模型) 
    ├── featureFlags (tenant级功能开关) 
    └── complianceMode (GDPR/SOX/HIPAA 影响 UI 展示) 
```

### 6.2.2 tenant级 UI 定制

| 定制维度 | 定制能力                                                 | configure方式                                |
| -------- | -------------------------------------------------------- | --------------------------------------- |
| 品牌     | Logo, 主色调, 登录页背景, 浏览器标签graph标                 | Admin API → tenantconfigure                    |
| 功能     | 功能module开关 (如隐藏 Marketplace, 禁用 NL entry)          | tenant featureFlags                       |
| 看板     | 自定义 L1/L2 看板面板排列和可见性                        | user级 + tenant级configure合并                 |
| 合规     | GDPR 模式下隐藏/sanitized特定field; SOX 模式下force审计轨迹可见 | complianceMode auto驱动                 |
| 语言     | default语言, 可用语言列表                                   | tenantconfigure                                |
| 模式     | 单人模式 vs 企业模式 (参见 §6.2 多tenant UI 架构)          | auto检测 (user数 ≤ 1 → 单人) + 手动coverage |

### 6.2.3 data隔离strategy

| 维度     | implementation                                      |
| -------- | ----------------------------------------- |
| API 隔离 | 所有requestautoinjection `X-Tenant-Id` header     |
| cached隔离 | TanStack Query key 前缀contains tenantId      |
| 存储隔离 | 离线存储 key 前缀contains tenantId            |
| tenant切换 | 切换时清空所有cached和离线data → 重新初始化 |

## 6.3 设计system

### 6.3.1 设计令牌

> _v2.2 补充: 增加 `primitive.ts` 原始色板 (提取自 Doc-11 §15.1) _

```text
tokens/
  color/
    primitive.ts       # 原始色板: slate-50..slate-950, blue, green, amber, red 等
    semantic.ts        # 语义色: success/warning/error/info/neutral
    risk-level.ts      # risk色: low(green-500)/medium(amber-500)/high(orange-500)/critical(red-600)
    autonomy-level.ts  # 自主权色: suggestion(blue)/supervised(teal)/semi-auto(purple)/full-auto(green)
    status.ts          # state色: pending/running/paused/completed/failed/aborted
    domain.ts          # 24 域识别色 (每域一个主色调 + 浅色背景色) 
  spacing.ts           # 4px 基准网格: xs(4)/sm(8)/md(16)/lg(24)/xl(32)/xxl(48)
  typography.ts        # 字体阶梯: caption(12)/body(14)/subtitle(16)/title(20)/headline(24)/display(32)
  elevation.ts         # 层叠: 0(flat)/1(card)/2(dropdown)/3(modal)/4(toast)/5(overlay)
  animation.ts         # 动画时长: fast(100ms)/normal(200ms)/slow(300ms)/easing: ease-in-out
  breakpoint.ts        # response式: sm(640)/md(768)/lg(1024)/xl(1280)/2xl(1440)
  border-radius.ts     # 圆角: none/sm(4)/md(8)/lg(12)/xl(16)/full(9999)
```

### 6.3.2 核心组件库

| 组件类别 | 组件列表                                                                                    | 平台支持                         |
| -------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| 基础     | Button, IconButton, Link, Badge, Tag, Avatar, Tooltip                                       | 全平台                           |
| 输入     | TextField, TextArea, Select, Checkbox, Radio, Switch, Slider, DatePicker, FileUpload        | 全平台                           |
| data展示 | Table, List, Card, Tree, Timeline, Stat, Progress, Skeleton                                 | 全平台                           |
| 反馈     | Toast, Alert, Modal, Drawer, Popover, Spinner, EmptyState                                   | 全平台                           |
| 导航     | Sidebar, TopBar, Tabs, Breadcrumb, Pagination, CommandPalette                               | 全平台 (移动端适配)              |
| graph表     | LineChart, BarChart, PieChart, Heatmap, Gauge, Sparkline                                    | 全平台 (ECharts/Victory Native)  |
| 业务     | TaskCard, ApprovalCard, AgentHealthIndicator, RiskBadge, AutonomyBadge, CostMeter, NLBubble | 全平台                           |
| 复合     | WorkflowCanvas, DebugTimeline, OapeflirPanel, DagViewer, DiffViewer                         | Web + 桌面                       |

**组件开发规范** _(v2.2 新增, 提取自 Doc-11 §15.2)_ `[Planned]`: 

| 维度   | 规范                                                            |
| ------ | --------------------------------------------------------------- |
| naming   | PascalCase 组件名; kebab-case file名                            |
| Props  | TypeScript interface 定义; 必填/可选标注清晰                    |
| 文档   | 每个组件配 Storybook story (至少: Default / Variants / States)  |
| testing   | 每个组件配 Vitest 单元testing (渲染 + 交互 + 快照)                 |
| 无障碍 | 必须contains aria-label / role; 键盘导航; 焦点manage                  |
| 主题   | via CSS 变量 / RN StyleSheet dynamicresponse主题切换                  |

### 6.3.3 主题system

| 主题          | 说明                                                   | 切换方式            |
| ------------- | ------------------------------------------------------ | ------------------- |
| Light         | default浅色主题                                           | user设置 / 跟随system |
| Dark          | 深色主题 (OLED 友好)                                   | user设置 / 跟随system |
| High Contrast | 高对比度主题 (WCAG AAA)                                | 无障碍设置          |
| 企业自定义    | 支持coverage主色调, Logo, 字体 (参见 §6.2 多tenant UI 架构)  | tenant级configure          |

implementation方式: 

- Web/桌面: CSS Custom Properties + `prefers-color-scheme` 媒体query
- React Native: `useColorScheme` hook + StyleSheet dynamic切换
- 所有graph表颜色不作为唯一信息载体 (WCAG: 搭配形状/标签) 

**暗色模式设计规则**: 

| 规则       | 说明                                    |
| ---------- | --------------------------------------- |
| 背景色层级 | 暗色用 elevation 而非投影distinguish层级       |
| 文字对比度 | 正文 ≥ 7:1 (AAA); 辅助文字 ≥ 4.5:1 (AA) |
| graph表颜色   | 不only靠颜色distinguishdata系列, 搭配形状/标签   |
| state色     | 暗色downgrade高饱和度, 保证可辨识            |
| graph片/截graph  | 加 1px 深色边框防止与背景融合           |

### 6.3.4 graph标system

| 层级     | 说明                                             |
| -------- | ------------------------------------------------ |
| systemgraph标 | Lucide Icons (MIT, 1000+ graph标, React/RN compatibility)    |
| 域graph标   | 24 个业务域各有专属graph标 (SVG, 尺寸 16/20/24/32)  |
| stategraph标 | task/Agent/审批state统一graph标集                    |
| riskgraph标 | risk等级graph标 (shield 系列, 颜色编码)             |

## 6.4 国际化与无障碍

### 6.4.1 i18n implementation

| 层级      | implementation方式                                                                |
| --------- | ----------------------------------------------------------------------- |
| UI 文案   | ICU MessageFormat (react-intl / react-native-intl) ; Key-Value 翻译file |
| 日期/时间 | Intl.DateTimeFormat (按 locale auto格式化)                              |
| 数字/货币 | Intl.NumberFormat (ICU 格式)                                            |
| 相对时间  | Intl.RelativeTimeFormat                                                 |
| NL 对话   | user输入语言auto检测 → response语言跟随                                     |
| RTL 支持  | CSS logical properties (阿拉伯语/希伯来语方向自适应)                    |

### 6.4.2 语言优先级

| 优先级 | 语言             | Phase   |
| ------ | ---------------- | ------- |
| P0     | 中文简体 (zh-CN) | Phase 1 |
| P0     | 英语 (en-US)     | Phase 1 |
| P1     | 中文繁体 (zh-TW) | Phase 2 |
| P1     | 日语 (ja-JP)     | Phase 2 |
| P2     | 韩/德/法         | Phase 3 |

**翻译工作流**: 

```text
开发者写 defaultMessage (en-US)
  → CI auto提取 message keys
  → 上传翻译平台 (Crowdin/Phrase)
  → 翻译团队翻译 + Review
  → CI auto拉取翻译file
  → 构建时打包 (按 locale split, lazy load) 
  → runtime按 locale 加载对应翻译包
```

### 6.4.3 无障碍 (WCAG 2.1 AA) 

| 维度     | 要求                                                 |
| -------- | ---------------------------------------------------- |
| 键盘导航 | 所有功能可via键盘完成; 焦点order符合逻辑; 焦点环可见 |
| 屏幕阅读 | 所有交互元素有 aria-label; dynamiccontent用 aria-live      |
| 色彩对比 | 文字对比度 ≥ 4.5:1; 大字 ≥ 3:1; 非文字 ≥ 3:1         |
| graph表替代 | 所有graph表提供表格替代视graph; 颜色不作为唯一信息载体     |
| 动画安全 | 尊重 prefers-reduced-motion; 闪烁频率 < 3Hz          |
| 触摸目标 | 移动端触摸目标 ≥ 44x44 dp                            |

#### 6.4.3.1 复杂 UI 组件无障碍专项指南 _(v3.0 新增)_

| 组件                        | 键盘交互                                                                                          | 屏幕阅读器                                                                                                                      | 降级方案                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| permissions矩阵编辑器 (§4.6.13)    | 方向键移动单元格焦点; Space 切换 checkbox; Enter 编辑下拉; Tab 跳至下一行首列; Esc cancel编辑       | 每个单元格 `aria-label="{角色} 对 {页面} 的 {permissionstype}: {当前值}"`; 变更后 `aria-live="polite"` 播报                            | 超过 10 列时提供"列表视graph"替代 (每行一个角色-permissions卡片)  |
| ECharts graph表仪表盘 (§4.2.8) | Tab 聚焦graph表区域; Enter 展开data表格替代视graph; 方向键在data点间导航 (折线graph/柱状graph)                | `role="img"` + `aria-label="{graph表标题}: {摘要描述}"`; 聚焦data点时播报具体数值                                                  | 每个graph表下方提供可展开的 `<table>` data表格             |
| Workflow 画布 (§4.6.9)      | Tab 在节点间按拓扑序移动; Enter 打开节点详情; 方向键微调节点位置 (编辑模式) ; Delete 删除选中节点 | 每个节点 `aria-label="{节点名称}, type: {step/condition/parallel}, state: {status}"`; 连线关系via `aria-describedby` 描述上下游 | 提供"列表视graph"替代 (按executeorder线性展示所有step)         |
| NL 对话消息流 (§4.6.5)      | 消息列表 `role="log"`; 新消息auto滚动可via Esc 暂停; Tab 聚焦可交互元素 (代码块复制/审批按钮)    | `aria-live="polite"` only播报新消息摘要 (避免 token 流逐字播报) ; 完成后播报完整回复                                              | —                                                       |
| 运营看板多面板 (§4.6.8)     | Tab 在面板间导航; Enter 展开/折叠面板; 面板内 Tab 导航子控件                                      | 每个面板 `role="region"` + `aria-label="{面板标题}"`; 折叠态播报"已折叠, 按 Enter 展开"                                         | 提供"摘要视graph"替代 (纯text KPI 列表)                    |

### 6.4.4 键盘快捷键

| 快捷键                 | 功能                     | 平台       |
| ---------------------- | ------------------------ | ---------- |
| `Ctrl/Cmd + K`         | 打开命令面板             | Web + 桌面 |
| `Ctrl/Cmd + N`         | 新建task (打开 NL 对话)  | Web + 桌面 |
| `Ctrl/Cmd + /`         | 切换侧栏                 | Web + 桌面 |
| `Ctrl/Cmd + Shift + D` | 打开调试器               | Web + 桌面 |
| `Tab`                  | 焦点前移                 | 全平台     |
| `Shift + Tab`          | 焦点后移                 | 全平台     |
| `Escape`               | 关闭弹窗/面板            | 全平台     |
| `A`                    | 批准审批 (审批页聚焦时)  | Web + 桌面 |
| `R`                    | reject审批 (审批页聚焦时)  | Web + 桌面 |
| `D`                    | 委托审批 (审批页聚焦时)  | Web + 桌面 |
| `?`                    | 显示快捷键帮助           | Web + 桌面 |

### 6.4.5 屏幕阅读器 ARIA 规范

| 组件     | aria 属性                                              |
| -------- | ------------------------------------------------------ |
| taskstate | `role="status"` + `aria-live="polite"`                 |
| 审批计数 | `aria-label="{n} 个待handle审批"`                        |
| 进度条   | `role="progressbar"` + `aria-valuenow/min/max`         |
| risk等级 | `aria-label="risk等级: {level}"` + 颜色 + 文字双重标识 |
| 告警横幅 | `role="alert"` + `aria-live="assertive"`               |
| 对话消息 | `role="log"` + `aria-live="polite"`                    |

## 6.5 认证与会话安全

> **改进点 R-3**: 合并 Doc-10 §10.8 和 Doc-11 §20. 

### 6.5.1 认证流程

```text
┌────────────┐                    ┌──────────────┐
│  UI Client │                    │ Platform API │
└─────┬──────┘                    └──────┬───────┘
      │  1. SSO 登录 (OIDC/SAML)          │
      │─────────────────────────────────▶│
      │  2. return access_token + refresh  │
      │◀─────────────────────────────────│
      │  3. 存储到平台安全存储             │
      │  4. API request携带 Bearer token     │
      │─────────────────────────────────▶│
      │  5. Token expiry → auto refresh     │
      │─────────────────────────────────▶│
      │  6. Refresh failure → 重新登录       │
      │◀─────────────────────────────────│
```

### 6.5.2 安全存储strategy

| 平台    | 存储方式                                               | Token type    |
| ------- | ------------------------------------------------------ | ------------- |
| Web     | HttpOnly Secure Cookie (access_token) ; in-memory中 (短期)  | JWT           |
| Windows | Windows Credential Manager (DPAPI 加密)                | JWT + refresh |
| macOS   | Keychain Services (Secure Enclave 保护)                | JWT + refresh |
| Linux   | libsecret (GNOME Keyring) / KWallet                    | JWT + refresh |
| Android | Android Keystore (TEE/StrongBox 支持)                  | JWT + refresh |
| iOS     | iOS Keychain (Secure Enclave 保护)                     | JWT + refresh |

### 6.5.3 会话安全strategy

| strategy         | 说明                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Token 刷新   | access_token TTL=15min; refresh_token TTL=7d; silently刷新无感知                                           |
| 多设备manage   | user可查看和撤销活跃会话列表                                                                           |
| 设备绑定     | 可选: refresh_token 绑定设备fingerprinting, 换设备需重新认证                                                     |
| 生物识别解lock | 移动端/桌面端支持生物识别快速解lock (不替代首次登录)                                                     |
| SSO 退出     | 平台退出触发 SSO globally退出 (SCIM deprovisioning 即时生效, 参见 `00-platform-architecture.md` SSO/SCIM)  |
| 敏感操作     | 高risk操作 (修改安全设置, 审批高额request) 需二次认证                                                     |

### 6.5.4 前端安全基线

| 威胁     | 防御措施                                                                |
| -------- | ----------------------------------------------------------------------- |
| XSS      | React default JSX 转义; CSP strict-dynamic; DOMPurify cleanupuser输入         |
| CSRF     | SameSite=Strict Cookie + CSRF Token (双重提交)                          |
| 点击劫持 | X-Frame-Options: DENY + CSP frame-ancestors 'none'                      |
| 中间人   | 全链路 HTTPS; 移动端 Certificate Pinning                                |
| data泄露 | PII 不写入localcached; 截屏保护 (移动端 FLAG_SECURE / UIApplication 遮罩)  |
| 逆向工程 | 移动端 ProGuard/R8 混淆; JS bundle 压缩混淆; 无hardcoded密钥               |
| 供应链   | dependencylock定 (package-lock.json) ; CI auto npm audit / Snyk 扫描            |

**CSP strategyconfigure**: 

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

### 6.5.5 敏感datahandle

| data类别     | 前端handle规则                                            |
| ------------ | ------------------------------------------------------- |
| PII          | 不cached到 IndexedDB/SQLite; 列表中sanitized显示 (only详情展示)  |
| Secret       | 前端不可见; 后端return `***masked***`                     |
| 审计log     | 只读展示; 不支持前端修改/删除                           |
| Token        | only存于平台安全存储; 不写入 localStorage/SessionStorage  |
| 离线操作队列 | 加密存储 (L4 SecureStorage implementation加密)                    |

## 6.6 response式与自适应设计

### 6.6.1 断点system

| 断点 | 宽度range    | 设备                           | 布局模式                     |
| ---- | ----------- | ------------------------------ | ---------------------------- |
| xs   | < 640px     | 小屏手机 (竖屏)                | 单栏堆叠                     |
| sm   | 640-767px   | 大屏手机 / 小屏手机 (横屏)     | 单栏 + 底部导航              |
| md   | 768-1023px  | 平板 (竖屏) / 大屏手机 (横屏)  | 可折叠侧栏 + content            |
| lg   | 1024-1279px | 平板 (横屏) / 小屏笔记本       | 侧栏 + content                  |
| xl   | 1280-1439px | 笔记本 / 桌面                  | 侧栏 + content + 右侧面板       |
| 2xl  | ≥ 1440px    | 大屏桌面 / 多屏                | 三栏 (侧栏 + content + 侧面板)  |

### 6.6.2 功能分层 (按断点) 

| 功能            | xs/sm           | md/lg           | xl/2xl                   |
| --------------- | --------------- | --------------- | ------------------------ |
| NL 对话         | 全屏对话        | 侧栏对话        | 常驻右侧面板             |
| task列表        | 列表视graph        | 列表 + 预览     | 列表 + 详情 + 侧面板     |
| 看板            | 卡片纵向堆叠    | 2 列网格        | 4 列网格                 |
| Workflow 构建器 | 只读查看        | 有限编辑        | 完整编辑 + 属性面板      |
| 调试器          | 不可用          | 基础时间线      | 完整调试 + OAPEFLIR 展开 |
| 审批            | 卡片列表 + 操作 | 列表 + 详情面板 | 完整三栏                 |

### 6.6.3 移动端适配特殊考量

| 考量       | handle方式                                         |
| ---------- | ------------------------------------------------ |
| 触摸目标   | 最小 44x44pt (iOS) / 48x48dp (Android)           |
| 手势       | 下拉刷新, 左滑操作 (审批快捷handle) , 边缘return     |
| 安全区域   | 适配 notch/Dynamic Island/导航条                 |
| 输入法适配 | 键盘弹出时auto调整布局, 输入框不被遮挡           |
| 横竖屏     | 竖屏为default; 横屏时充分利用宽度 (看板 2 列→4 列)  |

---

# Part VI — 工程化与交付

---

# 7. CI/CD, testing, 性能与交付路线

## 7.1 构建与 CI/CD 流水线

> 当前仓内已落地的命令基线为 `npm run typecheck`, `npm test`, `npm run test:e2e` (Vitest smoke) 与 `npm run build`. 下述 Playwright / Detox / 打包矩阵描述的是目标态 CI 设计, 不表示仓内已经具备完整原生 E2E 发布流水线. 

### 7.1.1 CI 流水线

```text
PR Trigger
    │
    ├── lint (ESLint + Prettier) 
    ├── typecheck (tsc --noEmit) 
    ├── test:unit (Vitest, shared/ + ui-core/ + features/) 
    ├── test:component (Storybook interaction tests) 
    ├── security:audit (npm audit + Snyk) 
    ├── build (Turborepo full构建) 
    └── test:e2e (Playwright Web + Detox Mobile) [only main branch]

Merge to main
    │
    ├── 上述全部
    ├── coverage:gate (Vitest coverage + ratchet baseline) 
    ├── bundle:analysis (webpack-bundle-analyzer / vite-bundle-visualizer) 
    ├── lighthouse:ci (FCP/LCP/CLS/INP 预算check) 
    └── deploy:staging (Web → staging CDN; 桌面/移动 → 内测分发) 
```

### 7.1.2 CD 发布矩阵

| 平台    | 构建产物        | 发布通道                          | 更新机制                         |
| ------- | --------------- | --------------------------------- | -------------------------------- |
| Web     | static SPA bundle | CDN / Docker nginx                | 即时部署, Service Worker 更新    |
| Windows | MSIX / EXE      | 企业 MDM / directly下载               | electron-updater 增量更新        |
| macOS   | DMG             | Mac App Store / directly下载          | Sparkle (Tauri) 增量更新         |
| Linux   | AppImage / DEB  | directly下载 / 包仓库                 | AppImage delta 更新              |
| Android | AAB / APK       | Google Play / 企业 MDM / APK 直发 | Play Store auto更新 / 应用内更新 |
| iOS     | IPA             | App Store / TestFlight            | App Store auto更新               |

### 7.1.3 环境strategy

| 环境       | 用途           | 后端连接               | data源       |
| ---------- | -------------- | ---------------------- | ------------ |
| local      | 开发者local开发 | mock-server 或local后端 | 模拟data     |
| dev        | 功能联调       | shared开发后端           | testingdata     |
| staging    | 预发布验证     | staging 后端           | sanitized生产data |
| production | 正式环境       | 生产后端               | 真实data     |

### 7.1.4 CI Stage 详情 `[Planned]`

> _v2.2 新增, 提取自 Doc-11 §24.1 — 6 阶段流水线details_

```text
Push / PR
  │
  ├─ Stage 1: Lint + Typecheck (parallel) 
  │   ├── npm run lint
  │   └── npm run typecheck
  │
  ├─ Stage 2: Unit + Component Test (按包parallel) 
  │   ├── npm test
  │   ├── npm run test:e2e
  │   └── Storybook / doc alignment suites
  │
  ├─ Stage 3: Build All (dependency链构建) 
  │   └── npm run build
  │
  ├─ Stage 4: E2E Test (按平台parallel) 
  │   ├── Web: Playwright (Chrome + Firefox + Safari)
  │   ├── Mobile: Detox (Android emulator + iOS simulator)
  │   └── Desktop: Spectron (Electron) / Tauri test driver
  │
  ├─ Stage 5: Security Scan
  │   ├── npm audit
  │   ├── Snyk / Trivy dependency漏洞扫描
  │   └── ESLint security plugin
  │
  └─ Stage 6: Package (only main/release branch) 
      ├── Web: Docker image (nginx + SPA)
      ├── Windows: MSIX / EXE (Code Signing)
      ├── macOS: DMG (Apple signature + 公证)
      ├── Linux: AppImage / DEB / RPM (GPG)
      ├── Android: AAB (Keystore signature)
      └── iOS: IPA (Apple signature)
```

executeorder: `lint → typecheck → test:unit → build → test:e2e → security:scan → package`

### 7.1.5 auto更新strategy `[Planned]`

> _v2.2 新增, 提取自 Doc-11 §24.4_

| 平台    | 更新机制                                | user体验                      |
| ------- | --------------------------------------- | ----------------------------- |
| Web     | Service Worker + Cache API              | 后台下载 → 刷新提示           |
| Windows | electron-updater (GitHub Releases / S3) | 后台下载 → 重启提示 (差分包)  |
| macOS   | Tauri updater (Sparkle 协议)            | 后台下载 → 重启提示           |
| Linux   | AppImage: appimagetool delta            | 手动/脚本更新                 |
| Android | Google Play auto更新                    | Play manage                     |
| iOS     | App Store auto更新                      | App Store manage                |

## 7.2 testingstrategy

> 当前仓内 UI testing以 Vitest + Testing Library + 文档一致性testing为主; `npm run test:e2e` 目前承载的是仓内 smoke E2E 基线. Playwright / Detox / Spectron 仍按目标态规划保留. 

### 7.2.1 testing金字塔

| 层级     | 工具                 | coverage目标                            | 数量比例 |
| -------- | -------------------- | ----------------------------------- | -------- |
| 单元testing | Vitest               | shared/ 纯逻辑, hooks, utils        | 70%      |
| 组件testing | Vitest + Testing Lib | ui-core/ 和 features/ 组件渲染+交互 | 20%      |
| 集成testing | Vitest + MSW         | API 集成, WebSocket 流程, 离线synchronous  | 7%       |
| E2E testing | Playwright / Detox   | 关键user旅程                        | 3%       |

### 7.2.2 关键testing场景

| 场景                    | 验证content                                        | 工具         |
| ----------------------- | ----------------------------------------------- | ------------ |
| task创建→execute→完成      | NL 输入 → API call → WS state更新 → 卡片statechanges | Playwright   |
| 审批流                  | 收到notification → 查看详情 → 批准/reject → state反馈      | Playwright   |
| 离线→恢复               | 断网 → 操作排队 → 恢复 → synchronous → conflict解决        | Vitest + MSW |
| 多标签页 WebSocket      | 多 tab shared连接 → 事件广播 → state一致           | Playwright   |
| 移动端审批快捷操作      | 推送notification → notification栏操作 → API call                | Detox        |
| 五级下钻 (TaskCockpit)  | L1→L2→L3→L4→L5 逐级下钻 → data正确加载          | Playwright   |
| SSO 登录                | OIDC 跳转 → Token 存储 → API 鉴权 → silently刷新    | Playwright   |

### 7.2.3 视觉回归testing

| 工具      | 用途                                      |
| --------- | ----------------------------------------- |
| Storybook | 组件文档 + 视觉隔离开发                   |
| Chromatic | Storybook 截graph对比 + 视觉回归检测         |
| Percy     | 跨浏览器视觉回归 (Chrome/Firefox/Safari)  |

### 7.2.4 testing工具链 `[Planned]`

> _v2.2 新增, 提取自 Doc-11 §25.2 — 完整 9 类testing工具矩阵_

| testing类别     | 工具                                   | range                             |
| ------------ | -------------------------------------- | -------------------------------- |
| 单元testing     | Vitest                                 | shared/\* 纯逻辑                 |
| 组件testing     | Vitest + React Testing Library         | ui-core, ui-mobile 组件          |
| API 集成testing | Vitest + MSW (Mock Service Worker)     | api-client, queries              |
| 视觉回归     | Storybook + Chromatic                  | ui-core 组件                     |
| Web E2E      | Playwright                             | 主要user流程 (Chrome/FF/Safari)  |
| 移动端 E2E   | Detox (iOS/Android)                    | 核心流程                         |
| 桌面端 E2E   | Spectron / Tauri test driver           | 基本冒烟testing                     |
| 性能testing     | Lighthouse CI + Web Vitals             | Web 性能指标                     |
| 无障碍testing   | axe-core (Playwright) + VoiceOver 手工 | WCAG 合规                        |

### 7.2.5 v3.0 新增moduletestingstrategy _(v3.0 新增)_

| module                | testing重点                                                                           | 专项工具/技术                                    |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Agent 监控 (§4.2.7) | WS 实时推送 → 列表更新一致性; 500+ Agent 虚拟滚动性能; 健康state聚合准确性          | Vitest + MSW (WS mock) · Playwright 性能assertion     |
| 统计平台 (§4.2.8)   | ECharts graph表渲染正确性; 角色自适应可见性; 时间range切换data刷新; 空data fallback    | Storybook + Chromatic 视觉快照 · Vitest data转换 |
| configuremanage (§4.2.9)   | permissions矩阵编辑器 CRUD + rollback; 功能开关灰度百分比生效; 模型configureoptimisticlockconflict; 多角色隔离 | Playwright 角色切换 E2E · Vitest optimisticlock mock     |

**ECharts testingstrategy**: 

- **单元testing**: 验证 DTO → ECharts option 转换逻辑 (纯函数, 不dependency DOM) 
- **视觉快照**: Storybook story 为每种graph表type (Line/Pie/Heatmap/Bar/Gauge/BoxPlot) 定义 fixture data, via Chromatic 做视觉回归
- **性能assertion**: Playwright 验证graph表页面 LCP < 3s (含 ECharts dynamic加载) , concurrent渲染 ≤ 4 graph表时帧率 ≥ 30fps

**permissions矩阵编辑器testingstrategy**: 

- 键盘导航testing (Tab/方向键/Enter 切换开关) — axe-core + Playwright
- permissions继承正确性 (修改父角色 → 子角色synchronous变更) — Vitest 单元testing
- 大矩阵渲染 (50 页面 × 5 角色 × 4 操作 = 1000 单元格) — 虚拟渲染性能验证

### 7.2.6 coverage率要求 `[Planned]`

> _v2.2 新增, 提取自 Doc-11 §25.3_

| 代码层      | 行coverage率目标 | branchcoverage率目标 |
| ----------- | ------------ | -------------- |
| shared/\*   | ≥ 90%        | ≥ 80%          |
| ui-core     | ≥ 80%        | ≥ 70%          |
| features/\* | ≥ 70%        | ≥ 60%          |
| apps/\*     | ≥ 50%        | ≥ 40%          |

## 7.3 性能预算

### 7.3.1 Web 性能预算

| 指标       | 目标值          | 测量工具   | force措施                  |
| ---------- | --------------- | ---------- | ------------------------- |
| FCP        | < 1.5s          | Lighthouse | CI 门禁, 超标 PR 不可合并 |
| LCP        | < 2.5s          | Lighthouse | CI 门禁                   |
| CLS        | < 0.1           | Lighthouse | CI 门禁                   |
| INP        | < 200ms         | Lighthouse | CI 门禁                   |
| JS 主包    | < 200KB gz      | bundlesize | CI 门禁                   |
| 路由懒加载 | 首屏 < 100KB gz | bundlesize | Code Splitting force       |

### 7.3.2 桌面/移动端性能预算

| 指标               | 目标值                              | 平台   |
| ------------------ | ----------------------------------- | ------ |
| 启动时间           | < 3s (桌面) < 2s (移动)             | 全平台 |
| in-memory占用 (空闲态)  | < 300MB (Electron) < 150MB (Tauri)  | 桌面   |
| 帧率               | ≥ 60fps (动画/滚动)                 | 全平台 |
| WebSocket 延迟     | 事件→UI < 200ms P99                 | 全平台 |

### 7.3.3 性能优化strategy

| strategy           | implementation方式                                                              |
| -------------- | --------------------------------------------------------------------- |
| Code Splitting | React.lazy + Suspense 按路由split; 重型组件(ECharts/ReactFlow)dynamic导入 |
| 虚拟滚动       | TanStack Virtual handle长列表 (task列表/审批列表/log)                  |
| 预加载         | prefetchQuery() 预加载下一级下钻data                                  |
| Web Worker     | JSON 解析, diff 计算等 CPU 密集操作移至 Web Worker                    |
| graph片优化       | WebP/AVIF 格式 + srcset response式 + lazy loading                         |
| 服务端聚合     | uses MissionControlService 聚合视graph减少 API roundtrip                 |

**Web 端优化详表**: 

| strategy           | implementation                                          |
| -------------- | --------------------------------------------- |
| 代码split       | React.lazy + Suspense, 按路由split功能module     |
| Tree Shaking   | Vite default + ESM module确保 dead code 消除       |
| 资源预加载     | `<link rel="modulepreload">` 关键pathmodule     |
| graph片优化       | WebP + responsive srcSet + lazy loading       |
| 字体优化       | system字体栈为主; graph标字体改用 SVG sprite       |
| 骨架屏         | 所有列表/看板uses Skeleton 组件避免 CLS       |
| 虚拟列表       | task列表/审批列表超过 50 条uses VirtualList   |
| Service Worker | static资源 Cache-First; API Network-First + SWR |
| CDN            | static资源 CDN 分发; API 保持直连               |

**移动端优化详表**: 

| strategy         | implementation                                           |
| ------------ | ---------------------------------------------- |
| Hermes 引擎  | 预编译 JS bytecode, 启动速度提升 2-3x          |
| 列表虚拟化   | FlashList (Shopify) 替代 FlatList              |
| graph片cached     | FastImage 组件 + in-memory/磁盘双级cached             |
| 动画         | Reanimated 3 + 原生驱动动画, 避免 JS 线程blocks  |
| 后台data刷新 | 利用 iOS BackgroundTasks / Android WorkManager |
| 包体积       | Metro bundle 按架构split (arm64/x86_64)         |

**桌面端优化详表**: 

| strategy       | implementation                                              |
| ---------- | ------------------------------------------------- |
| 启动加速   | Electron: v8 snapshot + 预加载关键module            |
| in-memorymanage   | 非活跃window卸载 WebView; 定期 GC                   |
| 多window     | Electron: BrowserWindow 池化复用                  |
| 增量更新   | electron-updater 差分包 (~5MB vs full ~120MB)     |
| Tauri 优势 | 无 Chromium 捆绑; Rust 后端in-memory安全; 包体积 ~15MB |

### 7.3.4 graph表密集页面性能预算 _(v3.0 新增)_

data统计平台 (§4.2.8) 和运营看板 (§4.6.8) contains多graph表concurrent渲染, 需额外性能约束: 

| 指标                       | 目标值                | force措施                                               |
| -------------------------- | --------------------- | ------------------------------------------------------ |
| ECharts 包体积 (按需引入)  | < 150KB gz            | only引入uses的 chart type + renderer; CI bundlesize 门禁 |
| Monaco Editor (模型configure)   | < 200KB gz            | dynamic import; only在 `/shared/settings/models` 路由加载   |
| graph表页面 LCP               | < 3s                  | ECharts 延迟初始化 + 骨架屏placeholder                        |
| 最大concurrentgraph表渲染           | ≤ 4 个可视区域内      | 非可视区域graph表uses IntersectionObserver 延迟初始化     |
| graph表动画帧率               | ≥ 30fps               | data量 > 1000 点时禁用动画                             |
| 单graph表data点upper limit           | ≤ 2000 点 (聚合显示)  | 超限时后端做 downsample, 前端显示"已聚合"提示          |

**ECharts Tree-Shaking strategy**: 

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

v3.0 新增 3 个功能module对 CI 的影响: 

| 影响项                 | 预估影响            | 缓解措施                                                |
| ---------------------- | ------------------- | ------------------------------------------------------- |
| ECharts 包体积增长     | +120-150KB gz       | 按需引入 + 路由级懒加载; 不影响主包 < 200KB 门禁        |
| Monaco Editor 包体积   | +180-200KB gz       | only `/settings/models` 路由dynamic加载; bundlesize 单独限额 |
| 新增 3 个 feature module | +30-50KB gz/module    | Code Split 已force; CI 每路由 < 100KB gz 门禁coverage        |
| 组件testing增量           | +200-300 个testing用例 | CI parallel度从 4 → 6; 预计增加 ~30s testing时间               |
| Storybook story 增量   | +40-60 个 story     | Chromatic 按变更增量对比; 不影响 CI 总时长              |

## 7.4 分阶段交付plan

### Phase 1 — Web MVP (12 周) 

**Gate 0 (Phase 1 启动前置条件) **: 

| #    | 门禁条件                                                   | 验证方式                        | 负责方     |
| ---- | ---------------------------------------------------------- | ------------------------------- | ---------- |
| G0-1 | 后端 REST API v1 OpenAPI spec 已发布且冻结                 | `GET /api/v1/openapi.json` 可用 | 后端团队   |
| G0-2 | WebSocket 握手协议文档化 (JWT auth + schema_version 协商)  | WebSocketBridge 集成testingvia    | 后端团队   |
| G0-3 | MissionControlService 6 个方法均可via HTTP call           | console-routes 集成testingvia     | 后端团队   |
| G0-4 | `ui_console_and_cockpit_contract.md` 已标记为 Accepted     | 文档statecheck                    | 架构评审   |
| G0-5 | DomainDescriptor + DomainUIConfig JSON Schema 已发布       | Schema validationtestingvia             | 域平台团队 |
| G0-6 | `analyticsConsent` PlatformAdapter interface规范已评审          | ADR 评审record                    | 前端架构   |

| 周次   | 交付物                                                   |
| ------ | -------------------------------------------------------- |
| W1-2   | Monorepo 脚手架 + shared/ 基座 + Storybook + mock-server |
| W3-4   | 认证流程 + Dashboard + SystemStatusBar                   |
| W5-6   | TaskCockpit (L1-L3 下钻) + ApprovalCenter                |
| W7-8   | StabilityPanel + NL Conversation                         |
| W9-10  | WebSocket 实时层 + 离线基础 + WorkflowCockpit            |
| W11-12 | AdminTakeoverConsole + E2E testing + 性能优化 + 发布        |

### Phase 2 — 桌面端 (8 周) 

**Gate 1 (Phase 2 启动前置条件) **: 

| #    | 门禁条件                                                         | 验证方式               | 负责方     |
| ---- | ---------------------------------------------------------------- | ---------------------- | ---------- |
| G1-1 | Phase 1 Web MVP 已via UAT 验收                                  | UAT 签署报告           | QA + 产品  |
| G1-2 | `windowing` / `shell` / `process` PlatformAdapter interface规范已冻结 | ADR-UI-009 评审via    | 前端架构   |
| G1-3 | Electron 34 + Tauri 2.x 壳层 PoC via (含auto更新验证)           | PoC demo + testing报告    | 桌面端团队 |
| G1-4 | 后端 §5.2.2 P1 优先级新增端点中 ≥ 80% 已implementation                     | API 集成testingcoverage率报告 | 后端团队   |
| G1-5 | 桌面端 CI 矩阵 (§2.6.3) 已configure完成                               | CI pipeline 运行record   | DevOps     |

| 周次 | 交付物                                               |
| ---- | ---------------------------------------------------- |
| W1-2 | Electron Windows 壳层 + system集成 (托盘/快捷键/notification)  |
| W3-4 | Tauri macOS/Linux 壳层 + 原生集成                    |
| W5-6 | Workflow Builder (React Flow 画布) + Debugger 基础   |
| W7-8 | 桌面端 E2E + auto更新 + 打包发布                     |

### Phase 3 — 移动端 (8 周) 

**Gate 2 (Phase 3 启动前置条件) **: 

| #    | 门禁条件                                        | 验证方式                  | 负责方        |
| ---- | ----------------------------------------------- | ------------------------- | ------------- |
| G2-1 | Phase 2 桌面端已via UAT 验收                   | UAT 签署报告              | QA + 产品     |
| G2-2 | RN 0.79 + Hermes + Fabric 技术验证via          | PoC 性能报告 (启动 < 2s)  | 移动端团队    |
| G2-3 | FCM/APNs 推送通道已configure且经过集成testing           | 推送端到端testing报告        | 后端 + 移动端 |
| G2-4 | `screenSecurity` PlatformAdapter interface规范已冻结 | ADR 评审record              | 前端架构      |
| G2-5 | 离线操作许可矩阵 (§5.5.6) 已与产品confirmation          | 产品签署confirmation              | 产品          |

| 周次 | 交付物                                             |
| ---- | -------------------------------------------------- |
| W1-2 | RN 0.79 脚手架 + ui-mobile 组件 + 导航结构         |
| W3-4 | Dashboard + TaskCockpit + ApprovalCenter 移动端    |
| W5-6 | 推送notification + 离线synchronous + 生物识别                     |
| W7-8 | Detox E2E + 性能优化 + App Store / Play Store 发布 |

### Phase 4 — augmentation功能 (持续) 

**Gate 3 (Phase 4 启动前置条件) **: 

| #    | 门禁条件                                                   | 验证方式              | 负责方     |
| ---- | ---------------------------------------------------------- | --------------------- | ---------- |
| G3-1 | Phase 3 移动端已via UAT 验收                              | UAT 签署报告          | QA + 产品  |
| G3-2 | 后端 §5.2.2 P2/P3 优先级端点 ≥ 60% 已implementation                  | API coverage率报告        | 后端团队   |
| G3-3 | DomainUIConfig 扩展field (§6.1.2.1) Schema 已稳定           | Schema compatibility性testingvia | 域平台团队 |
| G3-4 | 至少 3 个域的 glossaryOverrides + featureVisibility 已configure | 域configure验证脚本via    | 域manage员   |

- Workflow Debugger 时间旅行
- 24 域专属扩展组件
- 多语言 P1/P2 coverage
- Edge-Mobile 离线模式
- Cost Center + Marketplace + Explainability

### 团队configure建议

| 角色          | Phase 1 | Phase 2 | Phase 3 | 说明             |
| ------------- | ------- | ------- | ------- | ---------------- |
| 前端架构师    | 1       | 1       | 1       | 全程参与         |
| Web 开发      | 3       | 2       | 1       | Phase 1 为主力   |
| 桌面端开发    | 0       | 2       | 1       | Electron + Tauri |
| RN 移动端开发 | 0       | 0       | 3       | Phase 3 为主力   |
| UX 设计师     | 1       | 1       | 1       | 全程参与         |
| QA            | 1       | 2       | 2       | 随平台增加       |
| **合计**      | **6**   | **8**   | **9**   |                  |

## 7.5 risk与缓释

| risk                                    | 影响 | 概率 | 缓释措施                                                  |
| --------------------------------------- | ---- | ---- | --------------------------------------------------------- |
| 后端missing少 UI 所需 API 端点               | 高   | 高   | Phase 1 synchronous提出 API augmentation需求 (§5.2.2) ; mock-server 解耦 |
| RN 0.79 New Arch 生态库compatibility性问题       | 中   | 中   | 社区库预研; 关键原生module备选方案                          |
| Tauri WebKitGTK 在 Linux 发行版的compatibility性 | 低   | 中   | CI 多发行版testing (Ubuntu/Fedora/Arch) ; AppImage 兜底      |
| WebSocket 在企业防火墙/代理后被拦截     | 中   | 中   | SSE fallback + 轮询降级 (§5.3.4)                          |
| 24 域扩展组件开发量大                   | 中   | 高   | Phase 4 渐进交付; 模板化组件框架减少duplicate开发              |
| 离线conflict解决user体验差                  | 低   | 中   | 最小化离线写操作range; 优先 LWW auto解决                   |
| 前后端 Schema 不synchronous                    | 高   | 高   | codegen 工具auto从后端 Zod 生成前端type; CI validation          |
| App Store 审核被拒                      | 中   | 中   | 提前研究审核指南; 预留 2 周审核缓冲                       |
| 安装包体积超标 (Electron)               | 低   | 中   | 增量更新; 懒加载非核心module                                |

---

# 附录

## 附录 A: 后端 API 端点 → UI 功能完整映射 {#附录-a}

| 端点                                   | state                     | API Layer | UI 消费module                                                        |
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
| `GET /api/v1/agents`                   | [Implemented/Contracted] | Layer C   | agent-manager                                                      |
| `CRUD /api/v1/workflows`               | [Planned]                | Layer C   | workflow-cockpit, workflow-builder                                 |
| `GET /api/v1/marketplace`              | [Implemented/Contracted] | Layer C   | marketplace                                                        |
| `GET /api/v1/explanations`             | [Implemented/Contracted] | Layer C   | explainability                                                     |
| `GET /api/v1/costs`                    | [Planned]                | Layer C   | cost-center                                                        |
| `GET /api/v1/dashboard/metrics`        | [Implemented/Contracted] | Layer C   | dashboard (L2-L4)                                                  |
| `GET /api/v1/tasks/:id/evidence`       | [Planned]                | Layer C   | task-cockpit (L4)                                                  |
| `GET /api/v1/tasks/:id/timeline`       | [Planned]                | Layer C   | task-cockpit (L5)                                                  |
| `DELETE /api/v1/tasks/:id`             | [Implemented/Contracted] | Layer C   | task-cockpit (canceltask)                                            |
| `GET /api/v1/workflow-runs`            | [Implemented/Contracted] | Layer C   | task-cockpit (运行列表)                                            |
| `GET /api/v1/workflow-runs/{id}/steps` | [Implemented/Contracted] | Layer C   | task-cockpit (step详情)                                            |
| `GET /api/v1/approvals`                | [Implemented/Contracted] | Layer C   | approval (审批列表)                                                |
| `GET /api/v1/incidents`                | [Implemented/Contracted] | Layer C   | alerts, stability (Incident 面板)                                  |
| `GET /api/v1/knowledge`                | [Implemented/Contracted] | Layer C   | explainability (知识references查看)                                      |
| `GET /api/v1/packs`                    | [Implemented/Contracted] | Layer C   | agent-manager (Agent 列表)                                         |
| `POST /api/v1/packs`                   | [Implemented/Contracted] | Layer C   | domain-wizard (Pack 注册)                                          |
| `GET /api/v1/packs/{id}/versions`      | [Implemented/Contracted] | Layer C   | agent-manager (版本manage)                                           |
| `GET /api/v1/plugins`                  | [Implemented/Contracted] | Layer C   | marketplace (市场列表)                                             |
| `GET /api/v1/prompts`                  | [Implemented/Contracted] | Layer C   | agent-manager (Prompt 版本)                                        |
| `GET /api/v1/cost-reports`             | [Planned]                | Layer C   | cost-center (成本data)                                             |
| `GET/POST /api/v1/webhooks`            | [Implemented/Contracted] | Layer C   | settings (Webhook manage)                                            |
| `GET /api/v1/admin/workers`            | [Implemented/Internal]   | Layer B   | dashboard L3 (Worker state)                                         |
| `GET/PUT /api/v1/admin/config`         | [Implemented/Contracted] | Layer B/C | settings (configuremanage)                                                |
| `GET/POST /api/v1/admin/rollouts`      | [Planned]                | Layer C   | agent-manager (灰度发布)                                           |
| `GET/POST/PUT /api/v1/admin/tenants`   | [Planned]                | Layer C   | settings (tenantmanage)                                                |
| `GET/PUT /api/v1/admin/budgets`        | [Planned]                | Layer C   | cost-center (预算configure)                                             |
| `ws/v1/stream`                         | [Implemented]            | Layer C   | globally (实时事件推送)                                                |

## 附录 B: WebSocket 事件完整映射 {#附录-b}

| 事件                            | state          | 来源                       | UI module                      |
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
| `panic.activated`               | [Planned]     | PanicService               | globally蒙层                     |
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

## 附录 C: ADR 决策index {#附录-c}

| ADR 编号   | 决策                                            | state   |
| ---------- | ----------------------------------------------- | ------ |
| ADR-UI-001 | React 19 为统一 UI 框架                         | 已批准 |
| ADR-UI-002 | Electron(Win) + Tauri(Mac/Linux) 混合strategy       | 已批准 |
| ADR-UI-003 | Zustand 5 + TanStack Query v5 statemanage          | 已批准 |
| ADR-UI-004 | pnpm + Turborepo Monorepo                       | 已批准 |
| ADR-UI-005 | contract信息架构作为一级导航结构                    | 本文档 |
| ADR-UI-006 | WebSocket 优先 + SSE fallback + 轮询降级        | 本文档 |
| ADR-UI-007 | Web 离线三层strategy                                | 本文档 |
| ADR-UI-008 | DomainUIConfig 从 DomainDescriptor 派生         | 本文档 |
| ADR-UI-009 | Electron(Win)+Tauri(Mac/Linux) 桌面混合壳层治理 | 本文档 |

## 附录 D: 术语表 {#附录-d}

| 术语                  | 含义                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| MissionControlService | 后端核心服务, 聚合所有 Cockpit 视graphdata                               |
| WebSocketBridge       | 后端生产级 WebSocket 服务, 支持 JWT 认证和事件广播                    |
| DomainDescriptor      | 后端业务域描述符, contains域configure, risk等级, strategy等                        |
| DomainUIConfig        | 前端域 UI configure对象, 从 DomainDescriptor 派生                          |
| OAPEFLIR              | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release 八阶段循环 |
| HITL                  | Human-In-The-Loop 人机协作                                            |
| L1-L5                 | UI 信息下钻层级 (contract §7 定义的五级下钻)                              |
| shared_snapshot       | contract定义的globallyshared快照data源                                          |
| shared_query          | contract定义的跨页面sharedquerydata源                                        |
| page_local_api        | contract定义的页面级专用 API data源                                       |
| Layer A/B/C           | API 暴露层次: Service Method / Internal Route / Public Contract EP    |
| Idempotency Key       | 写操作幂等标识, 防止因重试导致的duplicateexecute                              |
| RedactionRule         | field级sanitized规则, 定义各角色在各field上的可见性strategy                      |
| SPA                   | Single Page Application, 单页应用                                     |
| SSO                   | Single Sign-On, 单点登录                                              |
| OIDC                  | OpenID Connect, based on OAuth2 的identity认证协议                            |
| PKCE                  | Proof Key for Code Exchange, OAuth2 安全扩展                          |
| RN                    | React Native                                                          |
| DAG                   | Directed Acyclic Graph, 有向无环graph                                    |
| CAS                   | Compare-And-Swap, optimisticlock                                              |
| FCP                   | First Contentful Paint, 首次content绘制                                  |
| LCP                   | Largest Contentful Paint, 最大content绘制                                |
| CLS                   | Cumulative Layout Shift, 累积布局偏移                                 |
| INP                   | Interaction to Next Paint, 交互到下一次绘制                           |
| WCAG                  | Web Content Accessibility Guidelines                                  |
| PWA                   | Progressive Web App                                                   |
| MSW                   | Mock Service Worker                                                   |
| BFF                   | Backend For Frontend                                                  |
| CDN                   | Content Delivery Network                                              |

## 附录 E: v2.3 整改清单 (P0/P1/P2)  {#附录-e}

> 本附录record v2.2 专家评审后识别的remaining改进项及其在 v2.3 中的handlestate. 

### P0 — blocks性问题 (v2.3 已修复) 

| #    | 问题                                                                  | risk                                                  | v2.3 handle                                                   |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| P0-1 | `[Implemented]` 标签未distinguish"有 service method"与"有public JSON contract" | 前端误把 Layer A service method 当可directly消费 endpoint | §1.7 新增 Implemented 三级子标签; §4.1/§5.2/附录 A full标注 |
| P0-2 | `/console/*` 和 `/admin/v1/*` 的语义层次不清                          | 前端不确定该消费 HTML fallback 还是 JSON API          | §5.2.3 新增 Public UI API Surface 三层分级                  |
| P0-3 | `[已implementation]`/`[需新增]` 与 `[Implemented]`/`[Planned]` 标记混用         | 文档可信度降低                                        | 全文统一为英文标签格式                                      |

### P1 — 高优先级改进 (v2.3 已修复) 

| #    | 问题                                                                        | risk                                               | v2.3 handle                                         |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| P1-1 | 6 个 Planned modulemissing闭环contract (DTO/actions/query keys/permission/WS/offline)  | 后端 API 设计无对齐基准, mock-server 无法准确 mock | §4.7 新增 6 个module mini-contract                  |
| P1-2 | missingfield级可见性/sanitized矩阵                                                     | 企业级部署场景下 PII 泄露risk                      | §4.5.4 新增 FieldVisibilityPolicy + RedactionRule |
| P1-3 | 写操作missing幂等/重试语义                                                       | duplicate提交, datainconsistent                               | §5.6.4 新增 Mutation 幂等与重试规范               |
| P1-4 | service / route / endpoint 术语混用                                         | 读者误解 API 暴露层次                              | §5.2.3 定义 Layer A/B/C; 附录 D 补充术语          |

### P2 — 中等优先级改进 (partial已修复, partialsubsequent版本跟进) 

| #    | 问题                                                                             | risk                    | v2.3 handle                                                | subsequent版本 |
| ---- | -------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- | -------- |
| P2-1 | PlatformAdapter partial能力边界模糊 (screenSecurity/analyticsConsent/windowing)     | 跨平台 no-op 行为未定义 | 已在 §3.7.1 表格标注平台适用range; 详细 no-op 规范        | v2.4     |
| P2-2 | PlatformAdapter `process.getAppVersion()`/`getBuildChannel()` 是否属于全平台能力 | 职责边界不清            | 保持 [Planned] state, 标注为"Phase 2 评审confirmation"            | v2.4     |
| P2-3 | Web 端 `screenSecurity` 实际能力很弱                                             | 给user虚假安全感        | §3.7.1 表格注明"桌面端 + 移动端", Web 端为 no-op         | —        |
| P2-4 | `windowing` 与多windowstatesynchronous协议未定义                                           | 多window间datainconsistent      | 保持 [Planned]; Phase 2 Gate 1 前置条件中已coverage          | v2.4     |
| P2-5 | §4.1 信息架构表"后端data源"列混合了 service method 和 route references                 | 模糊 API 暴露层次       | 已更新 §4.1 表格标注 Implemented 子标签; §5.2.3 明确分层 | —        |
| P2-6 | partial内部references编号 (如"参见 §6 API") 与当前文档结构不匹配                          | 读者导航混乱            | 全文references复核, 修正为当前编号                             | —        |

### subsequent版本 Backlog

| #   | 问题                                                                         | plan版本 |
| --- | ---------------------------------------------------------------------------- | -------- |
| B-1 | 每个 PlatformAdapter 能力组补充 no-op / degraded behavior 规范               | v2.4     |
| B-2 | Workflow/Agent/Marketplace WS 订阅协议详细设计                               | v2.4     |
| B-3 | DomainUIConfig 扩展field (featureVisibility/actionPolicy 等) JSON Schema 发布 | v2.4     |
| B-4 | 24 域专属扩展组件 mini-contract (§6.1.4 展开)                                | v2.5     |
| B-5 | 端到端 contract test auto化 (OpenAPI spec → 前端 type → mock → E2E)          | v2.5     |
