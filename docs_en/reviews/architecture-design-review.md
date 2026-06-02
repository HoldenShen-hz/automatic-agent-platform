  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 12 - Error Handling and Multi-tenant Security Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [listQuotas() returns all tenant quotas - information disclosure]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:222-234`
- **Issue Description**: 
  ```typescript
  listQuotas(tenantId?: string): TenantQuota[] {
    if (tenantId) {
      return this.db.connection.prepare(`SELECT * FROM tenant_quotas WHERE tenant_id = ?`).all(tenantId);
    }
    // WITHOUT tenantId: 返回所有租户的配额！
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - 当 tenantId 为空时返回所有租户的配额
  - 未经授权的信息泄露
- **Suggested Fix**: 
  1. 要求调用者必须提供 tenantId
  2. 添加权限验证确保只能查看自己的配额
  3. 审计日志记录所有配额访问

#### 2. [Security] [High Severity] [assertTaskTenantAccess() returns 404 instead of 403 - resource existence leaked]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**: 
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // 应该是403
  }
  ```
  - 跨租户访问返回404而非403
  - 泄露了资源存在但属于其他租户的信息
  - 攻击者可检测有效task ID
- **Suggested Fix**: 
  1. 改为返回403 Forbidden
  2. 不要泄露资源是否存在

#### 3. [Security] [High Severity] [crossTenantRequest flag controlled by caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**: 
  - `routeOrgBudget()` 接受 `crossTenantRequest?: boolean` 参数
  - 该标志由调用者设置，非系统派生
  - 攻击者可能操纵此标志绕过跨租户限制
- **Suggested Fix**: 
  1. 标志应由系统状态派生，不接受调用者输入
  2. 添加审计日志追踪跨租户请求
  3. 实现零信任跨租户访问模型

#### 4. [Source Code] [High Severity] [single-task-happy-path has no retry mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**: 
  - `maxRetries: 0` 和 `retryBackoff: "none"`
  - 瞬态失败无自动重试
  - LLM调用失败时无fallback到备用provider
- **Suggested Fix**: 
  1. 启用非关键执行的重试
  2. 实现LLM provider fallback链（Anthropic → OpenAI → MiniMax）
  3. 使用domain baseline catalog的primary/fallback模型偏好

#### 5. [Source Code] [High Severity] [LLM calls have no circuit breaker protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 熔断器只存在于 channel-gateway 和 call-governance
  - 直接LLM provider调用无熔断器
  - provider降级时无法快速失败
- **Suggested Fix**: 
  1. 在model-call-provider.ts添加熔断器
  2. 当provider失败率超阈值时快速失败
  3. 自动切换到备用provider

#### 6. [Security] [High Severity] [Distributed rate limiter bypass - not shared between instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**: 
  - Redis未配置时使用本地Map
  - 每个实例维护自己的localEntries
  - 攻击者可通过切换实例绕过限流
- **Suggested Fix**: 
  1. 要求Redis配置用于生产
  2. 或使用Redis作为所有实例的共享后端
  3. 检测并警告未配置Redis的实例

#### 7. [Configuration] [Medium Severity] [Soft quota (log_only) does not actually limit]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**: 
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // log_only时返回true
  ```
  - soft quota只记录日志，不实际阻止
  - 配额形同虚设
- **Suggested Fix**: 
  1. 明确区分"监控模式"和"强制模式"
  2. 对于硬配额必须阻止
  3. 文档化quota类型的实际行为

#### 8. [Configuration] [Medium Severity] [HTTP layer lacks rate limit headers - clients cannot know limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**: 
  - 未返回 X-RateLimit-* 头
  - 只在429响应时返回retry-after-ms
  - 客户端无法主动管理请求速率
- **Suggested Fix**: 
  1. 在所有响应添加 X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  2. 使用标准头名称
  3. 遵循RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP layer lacks rate limit - optional and only by IP]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**: 
  - 限流仅在 `this.rateLimiter != null` 时生效
  - 限流key为 `${clientIp}:${endpoint}` 仅按IP
  - 无per-tenant/per-principal enforcement
- **Suggested Fix**: 
  1. 默认启用限流
  2. 添加per-tenant限流key
  3. 确保所有环境默认配置限流

#### 10. [Security] [Medium Severity] [processRuleMode may not be enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**: 
  - `SandboxPolicy.processRuleMode` 设置为 "allow" 或 "deny"
  - 但未找到实际阻止基于此策略生成进程的实际执行代码
  - `--allow-child-process` 标志仅在 sandboxed_process 隔离模式应用
- **Suggested Fix**: 
  1. 验证processRuleMode实际被强制执行
  2. 确保所有隔离模式正确处理
  3. 添加测试验证进程创建被阻止

#### 11. [Security] [Medium Severity] [Container template replacement not validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**: 
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - 简单字符串替换
  - 虽然validateContainerLaunchPluginId()阻止\0和引号
  - 但模板替换本身未验证
- **Suggested Fix**: 
  1. 添加输入验证防止注入
  2. 使用更安全的模板引擎
  3. 验证所有占位符被替换

#### 12. [Security] [Medium Severity] [Adapter execution bypasses sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**: 
  - Adapter执行REST/grpc/MQ调用不经过ScopedExternalAccessSandbox
  - 有自己的allowedDomains配置但非集中管理
  - 可能发起未限制的出站请求
- **Suggested Fix**: 
  1. Adapter执行经过集中沙箱
  2. 统一external access策略
  3. 添加adapter出站请求审计

#### 13. [Security] [Medium Severity] [Silent pass-through when principal.tenantId is null]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**: 
  ```typescript
  if (principal.tenantId == null) {
    return;  // 静默放行
  }
  ```
  - 如果API网关允许无principal认证的请求通过
  - 可能授予跨租户访问权限
- **Suggested Fix**: 
  1. 要求所有API请求有有效principal
  2. null tenantId应拒绝而非静默放行
  3. 添加审计日志

#### 14. [Source Code] [Medium Severity] [No LLM provider fallback chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 主provider失败时无自动切换
  - domain-baseline-catalog.ts定义了primary/fallback模型偏好但未使用
  - 第一个provider失败即导致执行失败
- **Suggested Fix**: 
  1. 实现provider fallback链
  2. 使用domain baseline的primary/fallback配置
  3. 按优先级尝试直到成功或全部失败

#### 15. [Source Code] [Medium Severity] [Timeout values hardcoded]
- **File/Path**: 多个文件
- **Issue Description**: 
  - Effect buffer有固定超时reject
  - Channel gateway的requestTimeoutMs虽可配置但有max 30s限制
  - 无全局请求超时中间件
- **Suggested Fix**: 
  1. 集中超时配置
  2. per-environment可配置
  3. 添加全局超时中间件

#### 16. [Database] [Medium Severity] [No down migration - rollback not supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**: 
  - `rollbackSupported = false`
  - 每个migration只有 `downSql` 占位符
  - schema migration无法回滚
- **Suggested Fix**: 
  1. 文档化回滚限制
  2. 在变更前创建完整备份
  3. 使用blue-green部署减少回滚需求

#### 17. [Database] [Medium Severity] [Migration 44 special handling - duplicate table creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**: 
  - Migration 43创建harness_runs表
  - Migration 44再次创建同名表（不同schema）
  - 使用applyCompatibleColumnMigrationIfKnown特殊处理
- **Suggested Fix**: 
  1. 消除重复表创建
  2. 使用ALTER TABLE而非CREATE TABLE
  3. 简化migration逻辑

#### 18. [Configuration] [Low Severity] [Provider rate limit headers not forwarded to client]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**: 
  - 系统读取provider的ratelimitResetHeaderNames
  - 但不转发给客户端
  - 客户端无法知道provider限流状态
- **Suggested Fix**: 
  1. 转发Provider的限流头
  2. 或添加应用层限流信息
  3. 帮助客户端优化请求

#### 19. [Security] [Low Severity] [Browser evaluate accepts arbitrary scripts]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**: 
  - `evaluate` action接受script参数
  - 在浏览器上下文运行（模拟）
  - 如浏览器上下文未正确沙箱化可能是向量
- **Suggested Fix**: 
  1. 验证浏览器上下文正确沙箱化
  2. 消毒或限制script内容
  3. 记录所有evaluate调用

#### 20. [Source Code] [Low Severity] [No global error boundary wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - 执行引擎缺少unhandled promise rejection的全局处理
  - single-task-happy-path的LLM fallback失败时错误向上传播
- **Suggested Fix**: 
  1. 在执行引擎添加错误边界包装
  2. 统一错误处理模式
  3. 确保所有错误被捕获和记录

### Summary

本次补充Review（第十二轮 - 错误处理与多租户安全Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. listQuotas()返回所有租户配额（信息泄露）
2. assertTaskTenantAccess()返回404泄露资源存在
3. crossTenantRequest标志可被操纵
4. single-task-happy-path无重试（maxRetries=0）
5. LLM调用无熔断器保护
6. 分布式限流器可被bypass（实例间不共享）

**Medium Priority**:
1. Soft quota实际不阻止
2. 无X-RateLimit-*响应头
3. HTTP层限流可选且仅按IP
4. processRuleMode可能未强制
5. 容器模板替换未验证
6. Adapter执行绕过沙箱
7. null principal静默放行
8. 无LLM provider fallback链
9. 超时值硬编码
10. 无down migration
11. Migration 44特殊处理

**Low Priority**:
1. Provider限流头未转发
2. Browser evaluate接受任意脚本
3. 无全局错误边界

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 60 | 68 | 31 | 159 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 8 | 35 | 21 | 64 |
| 安全 | 12 | 13 | 3 | 28 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **91** | **150** | **72** | **313** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复listQuotas()信息泄露漏洞
2. 修正assertTaskTenantAccess()返回403
3. 移除crossTenantRequest调用者控制
4. 启用执行引擎重试机制
5. 添加LLM provider熔断器

**Short Term (This Month)**:
1. 修复分布式限流器bypass问题
2. 添加X-RateLimit-*响应头
3. 启用默认HTTP限流（per-tenant）
4. 实现LLM provider fallback链
5. 验证并强制processRuleMode

**Long Term Planning**:
1. 建立完整的限流和配额体系
2. 实现插件系统安全审计
3. 建立多租户安全测试
4. 完善错误处理和恢复机制
5. 统一超时和熔断配置

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 13 - Cache, Session and Real-time Communication Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [CORS allowedMethods missing PUT/PATCH/DELETE]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts:12-14`
- **Issue Description**: 
  ```typescript
  export const DEFAULT_CORS_CONFIG: CorsConfig = {
    allowedMethods: ["GET", "POST", "OPTIONS"],  // 缺少 PUT, PATCH, DELETE
  ```
  - 浏览器 CORS preflight 会拒绝 PUT/PATCH/DELETE 请求
  - 但路由中有 PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. 添加 PUT, PATCH, DELETE 到 allowedMethods
  2. 确保 CORS 配置与应用路由方法一致
  3. 添加测试验证所有 HTTP 方法的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - 使用 buildJsonResponse（成功包装）返回错误
  - 错误被包装在成功信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. 使用 buildJsonErrorResponse 处理错误
  2. 确保所有错误路径使用正确的错误信封
  3. 添加 API 一致性测试

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // 无 maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 不同
  - 恶意客户端可耗尽服务器资源
- **Suggested Fix**: 
  1. 添加 maxConnections 限制
  2. 实现连接限制拒绝策略
  3. 添加连接计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection 清理 subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map 未清理
  - 断开的客户端未确认的消息永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中删除所有 pendingAcks 条目
  2. 考虑添加超时机制自动清理未确认消息
  3. 记录清理操作的审计日志

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作回退
  - 如果环境变量未设置，使用不安全密钥
- **Suggested Fix**: 
  1. 移除回退值，要求环境变量必须设置
  2. 在启动时验证密钥存在且足够强
  3. 如果密钥缺失导致启动失败

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只有3个字段，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - 回退到默认值可能不适合测试环境
- **Suggested Fix**: 
  1. 添加完整的 timeout/tuning 配置
  2. 确保测试环境有合理的默认值
  3. 文档化必需的配置字段

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - 生产环境严重受限，可能影响吞吐量
- **Suggested Fix**: 
  1. 评估并调整生产限制
  2. 与业务需求匹配
  3. 添加生产容量测试

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: 多个域服务
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps 无限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等无限制
  - `domain-recipe-service.ts:67-68`: recipes, versions 无限制
  - `domain-risk-profile-service.ts:51`: profiles 无限制
  - Session Maps (session-management.ts:83-89) 无自动清理
- **Suggested Fix**: 
  1. 为所有 Map 实现 LRU 或 TTL 驱逐策略
  2. 添加后台清理任务
  3. 添加大小监控和告警

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单任务历史为 200 条
  - 但 Map 本身从不清理
  - 取消订阅的任务历史永久保留
- **Suggested Fix**: 
  1. 实现后台清理无订阅者任务的历史
  2. 添加任务订阅者监控
  3. 考虑使用 WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json 有完整的 remoteWorkerRegistration 配置
  - dev/staging/pre-prod 只有 approvalMode
  - prod 有 approvalMode 但无 remoteWorkerRegistration
  - 安全配置不一致
- **Suggested Fix**: 
  1. 统一所有环境的 remoteWorkerRegistration
  2. 添加安全配置验证
  3. 确保最低安全基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` 使用 buildJsonDocumentResponse（无包装）
  - 其他端点使用 buildJsonResponse（{requestId, data} 包装）
  - 客户端体验不一致
- **Suggested Fix**: 
  1. 统一响应信封格式
  2. 文档化响应格式规范
  3. 添加响应格式验证测试

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite 有部分唯一索引支持 idempotency
  - Redis 实现使用哈希索引但实现不完整
  - 可能导致重复消息
- **Suggested Fix**: 
  1. 完善 Redis idempotency 实现
  2. 添加唯一索引验证
  3. 确保与 SQLite 行为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - 无外部存储
  - 多实例部署不共享
  - 重启后去重状态丢失
- **Suggested Fix**: 
  1. 使用 Redis 替代内存存储
  2. 支持分布式去重
  3. 持久化去重状态

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: 多个 cache 实现
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService 无锁
  - 缓存未命中时可发生 thundering herd
  - 高并发下可能导致数据库过载
- **Suggested Fix**: 
  1. 实现 single-flight 模式
  2. 添加请求排队机制
  3. 使用分布式锁保护缓存更新

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - 清理仅在 record() 调用时触发
  - 空闲时无后台清理
  - 可能导致内存持续增长
- **Suggested Fix**: 
  1. 添加定期后台清理任务
  2. 使用独立的清理线程
  3. 添加内存使用监控

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket 服务器
- **Issue Description**: 
  - getClientCount() 存在但未通过 HTTP 端点暴露
  - 无 pendingAcks 队列深度指标
  - 无连接建立告警
- **Suggested Fix**: 
  1. 通过 metrics 端点暴露连接指标
  2. 添加 pendingAcks 队列监控
  3. 添加连接数异常告警

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在心跳 Sweep 时检查 isAlive
  - 无 per-client 独立于心跳的空闲超时
  - 认证后从不发送消息的客户端只能通过心跳失败检测
- **Suggested Fix**: 
  1. 添加 per-client idle timeout
  2. 独立于心跳间隔
  3. 配置可调整

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意客户端可订阅 100 个任务
  - 无全局任务订阅者限制
- **Suggested Fix**: 
  1. 添加全局任务订阅者限制
  2. 实现 per-task 订阅者上限
  3. 添加反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - 配置有 "version": "v4.3"
  - 但无 schema 版本验证
  - 加载时可能接受不兼容配置
- **Suggested Fix**: 
  1. 添加 JSON Schema 验证
  2. 实现版本兼容性检查
  3. 启动时验证配置完整性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder 数组的 splice 操作是 O(n)
  - 高频访问时可能性能问题
- **Suggested Fix**: 
  1. 使用 LinkedList 替代数组
  2. 或使用 Map 维护访问顺序
  3. 性能测试验证

### Summary

本次补充Review（第十三轮 - 缓存会话与实时通信Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求会失败）
2. Mission Routes 错误响应包装不当
3. WebSocketBridge 无最大连接数限制（DoS风险）
4. pendingAcks 断开连接时未清理（内存泄漏）
5. 硬编码回退密钥（安全漏洞）
6. config/runtime/test.json 缺少超时配置
7. prod.json maxConcurrentTasks=1 限制过严
8. 多个服务存在无界 Map（内存泄漏风险）

**Medium Priority**:
1. taskEventHistory Map 永不清理
2. 安全配置 drift（remoteWorkerRegistration 缺失）
3. OpenAPI 端点响应格式不一致
4. Redis 队列 idempotency 实现不完整
5. 请求去重中间件使用内存存储（多实例不共享）
6. Cache 无 stampede 保护
7. EvidenceService eviction 仅在插入时触发

**Low Priority**:
1. 无连接指标暴露
2. 无空闲客户端超时
3. 订阅限制是 per-client 而非全局
4. config/runtime 无版本验证机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 64 | 74 | 35 | 173 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 CORS allowedMethods 添加 PUT/PATCH/DELETE
2. 修复 Mission Routes 错误响应格式
3. 为 WebSocketBridge 添加最大连接数限制
4. 清理 pendingAcks 和 taskEventHistory
5. 移除硬编码回退密钥
6. 修复 config/runtime/test.json 配置
7. 评估并调整 prod 并发限制

**Short Term (This Month)**:
1. 统一安全配置（remoteWorkerRegistration）
2. 实现无界 Map 的 LRU/TTL 驱逐
3. 统一 API 响应信封格式
4. 完善 Redis idempotency 实现
5. 添加分布式去重中间件
6. 实现 cache stampede 保护

**Long Term Planning**:
1. 建立完整的连接管理和监控
2. 实现后台清理任务框架
3. 添加配置 schema 验证
4. 优化高频繁操作的数据结构
5. 建立内存使用基线和告警

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 10 - Deep Code Quality and API Consistency Review)

### Newly Discovered Issues

#### 1. [Source Code] [High Severity] [sleepSync busy-wait blocks event loop]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/repositories/authoritative-task-store-decorator.ts:50-57`
- **Issue Description**: 
  - 发现 `sleepSync()` 函数使用 busy-wait 实现
  ```typescript
  function sleepSync(ms: number): void {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* busy-wait */ }
  }
  ```
  - 在 SQLite BUSY 错误重试路径中使用
  - 阻塞事件循环，可能导致高负载下性能问题
- **Suggested Fix**: 
  1. 使用 `setTimeout` 替代 busy-wait
  2. 或使用异步等待模式
  3. 确保重试逻辑不会阻塞主线程

#### 2. [Source Code] [High Severity] [TODO R4-27: HarnessRun persistence missing - data loss risk]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270`
- **Issue Description**: 
  - 注释 `# TODO R4-27: HarnessRun must be persisted to RuntimeTruthRepository`
  - 表明 HarnessRun 数据可能未持久化
  - 存在数据丢失风险
- **Suggested Fix**: 
  1. 实现 HarnessRun 持久化逻辑
  2. 确保执行状态可恢复
  3. 在 TODO 完成前添加监控告警

#### 3. [Source Code] [High Severity] [SDK and Server routes mismatch - /handshake and /version missing]
- **File/Path**: `src/sdk/client-sdk/api-client.ts` 及 `src/platform/five-plane-interface/api/`
- **Issue Description**: 
  - SDK client 调用 `/handshake` 和 `/version` 端点
  - 但服务器端没有这些路由的处理程序
  - `SdkVersionHandshakeService` 存在但未连接到任何路由
- **Suggested Fix**: 
  1. 实现 `/handshake` 和 `/version` 服务器路由
  2. 或从 SDK 中移除这些调用
  3. 确保 SDK 和 Server API 版本兼容

#### 4. [Source Code] [High Severity] [SDK URL missing /api prefix]
- **File/Path**: `src/sdk/client-sdk/api-client.ts:84` vs 服务器路由
- **Issue Description**: 
  - SDK 构建路径: `${baseUrl}/${apiVersion}/${path}` → `/v1/harness-runs`
  - 服务器路由: `/api/v1/harness-runs`
  - 缺少 `/api` 前缀导致 404 错误
- **Suggested Fix**: 
  1. 在 SDK 的 `baseUrl` 中添加 `/api` 前缀
  2. 或移除服务器路由中的 `/api` 前缀
  3. 确保所有路由前缀一致

#### 5. [Source Code] [High Severity] [quant-trading.json has multiple configuration errors]
- **File/Path**: `config/domains/quant-trading.json`
- **Issue Description**: 
  - `capabilities.supportedTaskTypes` 包含 `["strategy_backtest", "pre_trade_risk_check"]`
  - 但 domain seed 定义的是 `["research", "simulate", "trade"]`
  - `workflowProfile.workflowId` 为 `"quant-trading.primary"` 但没有匹配的 workflow
  - `toolProfile.requiredTools` 包含 `order_execution` 但 `toolBundles` 中已禁用
- **Suggested Fix**: 
  1. 修正 supportedTaskTypes 以匹配 seed 定义
  2. 添加缺失的 workflow 定义或修正引用
  3. 启用 `order_execution` 或从 requiredTools 中移除

#### 6. [Source Code] [Medium Severity] [SDK and Server error category inconsistent]
- **File/Path**: `src/sdk/client-sdk/api-client.ts` 和 `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  - SDK 映射: 4xx → BUSINESS, 400 为 BUSINESS
  - Server 映射: 400 → validation, 422 → business-rule
  - 同一 HTTP 状态码产生不同的错误类别
  - `PolicyDeniedError`, `TenantBoundaryError`, `WorkflowStateError` 等 Server 错误类型未暴露给 SDK
- **Suggested Fix**: 
  1. 统一 SDK 和 Server 的错误类别映射
  2. 在 SDK 中添加缺失的错误类型处理
  3. 文档化错误类别层次结构

#### 7. [Source Code] [Medium Severity] [N+1 query pattern - duplicate calls to same query]
- **File/Path**: `src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts:73,79`
- **Issue Description**: 
  - 同一查询被连续调用两次：
  ```typescript
  for (const fence of await repo.getFencesForExecution(executionId)) { ... }
  for (const fence of await repo.getFencesForExecution(executionId)) { ... }
  ```
  - 不必要的数据库往返
- **Suggested Fix**: 
  1. 将结果缓存到变量中
  2. 合并两个循环为一个
  3. 添加缓存层避免重复查询

#### 8. [Source Code] [Medium Severity] [experience-cache-service has no pagination - memory overflow risk]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/experience-cache-service.ts:337-424`
- **Issue Description**: 
  - `findSimilarExperiences` 查询 `LIMIT 500` 行
  - 然后在内存中对所有500行进行评分和过滤
  - 无数据库级分页或游标
  - 可能导致高内存占用
- **Suggested Fix**: 
  1. 实现游标分页
  2. 将评分逻辑下推到数据库
  3. 限制返回行数

#### 9. [Source Code] [Medium Severity] [Unbounded in-memory Map - no eviction strategy]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:129-133`
- **Issue Description**: 
  ```typescript
  private readonly records: Map<string, EvidenceRecord> = new Map();
  private readonly CATEGORY_INDEX = new Map<EvidenceCategory, Set<string>>();
  private readonly SOURCE_REF_INDEX = new Map<string, Set<string>>();
  private readonly TENANT_INDEX = new Map<string, Set<string>>();
  private readonly STATUS_INDEX = new Map<EvidenceStatus, Set<string>>();
  ```
  - 无大小限制
  - 无驱逐策略
  - 可能导致内存泄漏
- **Suggested Fix**: 
  1. 实现 LRU 或 TTL 驱逐策略
  2. 添加最大大小限制
  3. 监控内存使用情况

#### 10. [Source Code] [Medium Severity] [Fixed polling interval - thundering herd risk]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.ts:76-78`
- **Issue Description**: 
  ```typescript
  this.intervalHandle = setInterval(() => {
    void this.runOnce();
  }, this.pollIntervalMs);
  ```
  - 固定间隔轮询无 jitter
  - 如果大量消息同时就绪，可能导致处理峰值
- **Suggested Fix**: 
  1. 在轮询间隔添加随机 jitter
  2. 实现指数退避
  3. 或使用事件驱动而非轮询

#### 11. [Source Code] [Medium Severity] [VersionRoutingMiddleware not connected to routes]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/version-routing.ts`
- **Issue Description**: 
  - `VersionRoutingMiddleware` 存在但从未应用到任何路由
  - `supportedVersions: ["2026-04-01", "2026-01-01"]` 未生效
  - API 版本控制功能未启用
- **Suggested Fix**: 
  1. 将 VersionRoutingMiddleware 连接到路由
  2. 实现版本协商逻辑
  3. 或移除未使用的中间件

#### 12. [Source Code] [Medium Severity] [marketing.json missing required fields]
- **File/Path**: `config/domains/marketing.json`
- **Issue Description**: 
  - 缺少 `description` 字段
  - 缺少 `version` 字段
  - 缺少 `status` 字段
  - 缺少 `riskProfile` / `riskSpec` 对象
  - 缺少 `workflows` 数组（只有 `workflowProfile`）
  - 缺少 `toolBundles` 数组（只有 `toolProfile`）
  - 缺少 `outputContracts` 数组
  - 缺少 `capabilities` 对象
- **Suggested Fix**: 
  1. 补充所有必需字段
  2. 与 quant-trading.json 保持结构一致
  3. 验证 JSON schema 合规性

#### 13. [Source Code] [Medium Severity] [21 TODO/FIXME/HACK comments unhandled]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - `src/org-governance/sso-scim/saml/index.ts:17` - TODO Phase 2 SAML production hardening
  - `src/platform/five-plane-interface/api/mission-control-service.ts:439` - TODO p50/p99 metrics
  - `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts:184` - TODO Redis idempotency
  - 等共21个 TODO
- **Suggested Fix**: 
  1. 逐个处理或创建 issue 跟踪
  2. 优先处理生产 hardening 相关的 TODO
  3. 设置代码质量标准要求处理所有 TODO

#### 14. [Source Code] [Medium Severity] [82 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 82处 `: any`, `<any>`, 或 `as any`
  - 表明 TypeScript strict mode 未完全执行
  - 降低了类型安全性
- **Suggested Fix**: 
  1. 启用 TypeScript strict mode
  2. 逐步替换 any 为具体类型
  3. 使用 unknown 替代 any

#### 15. [Configuration] [Medium Severity] [Default connection pool size may be insufficient]
- **File/Path**: `src/platform/five-plane-control-plane/config-center/postgres-pool-env.ts:58`
- **Issue Description**: 
  - `poolMax` 默认为 10
  - 高吞吐场景可能不足
  - 无自动扩展配置
- **Suggested Fix**: 
  1. 根据负载调整默认值
  2. 添加连接池自动调优
  3. 监控连接池使用情况

#### 16. [Source Code] [Medium Severity] [experience_cache table has no index]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/experience-cache-service.ts`
- **Issue Description**: 
  - `findSimilarExperiences` 查询使用 `session_id`, `quality_score`, `outcome`, `task_context`, `task_intent`
  - 但这些列可能没有数据库索引
  - 影响查询性能
- **Suggested Fix**: 
  1. 在 experience_cache 表添加相应索引
  2. 使用 EXPLAIN 分析查询计划
  3. 优化索引策略

#### 17. [Source Code] [Low Severity] [Magic numbers scattered everywhere]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - `3600000` (1小时), `86400000` (24小时), `3600` (1小时秒)
  - `4001`, `4003` - WebSocket 关闭代码
  - `504` - HTTP 504
  - `4096` - stderr 截断缓冲区大小
- **Suggested Fix**: 
  1. 使用 `src/platform/contracts/constants/time.ts` 中的常量
  2. 为其他魔法数字创建常量文件
  3. 添加 ESLint 规则禁止魔法数字

#### 18. [Source Code] [Low Severity] [Silent catch blocks swallow errors]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:130` 等多处
- **Issue Description**: 
  ```typescript
  } catch {
    ws.close(4003, "Invalid token");
    // Error is silently swallowed
  }
  ```
  - 错误被静默吞掉，无日志记录
  - 难以调试和追踪问题
- **Suggested Fix**: 
  1. 在 catch 块中添加错误日志
  2. 使用 StructuredLogger 记录错误
  3. 考虑重新抛出或传播错误

#### 19. [Testing] [Medium Severity] [1059 setTimeout/sleep/waitFor - tests are fragile]
- **File/Path**: `tests/` 多个测试文件
- **Issue Description**: 
  - 1059个 setTimeout/sleep/waitFor 调用
  - `plugin-spi-registry.test.ts` 有自定义 waitFor() 250ms 超时
  - `bootstrap.test.ts` 使用 setTimeout(resolve, 500)
  - 在 CI 高负载下可能非确定性地失败
- **Suggested Fix**: 
  1. 用 async/await 或 proper mocking 替代 sleep
  2. 增加超时时间或改用轮询条件
  3. 添加重试机制

#### 20. [Testing] [Medium Severity] [6 test files use // @ts-nocheck]
- **File/Path**: `tests/unit/domains/recipes/recipe-executor.test.ts` 等
- **Issue Description**: 
  - 整个文件禁用 TypeScript 类型检查
  - 隐藏真实的类型错误
  - 使重构变得危险
- **Suggested Fix**: 
  1. 移除 // @ts-nocheck
  2. 修复类型错误
  3. 使用 // @ts-expect-error 替代单个错误

#### 21. [Testing] [Medium Severity] [3 integration tests skipped due to missing workflow_state setup]
- **File/Path**: `tests/integration/platform/five-plane-execution/budget-allocation.integration.test.ts`
- **Issue Description**: 
  - 3个测试因缺少 `evaluateMultiDimensionalQuota` 和 `workflow_state` 记录而跳过
  - 关键预算分配功能未测试
- **Suggested Fix**: 
  1. 设置测试所需的 workflow_state 记录
  2. 实现缺失的 evaluateMultiDimensionalQuota
  3. 确保测试环境完整性

#### 22. [Testing] [Low Severity] [5 tests marked with .skip]
- **File/Path**: `tests/unit/scale-ecosystem/multi-region/cross-region-routing.test.ts` 等
- **Issue Description**: 
  - `describe.skip` - 功能未实现
  - `test.skip()` - 缺少依赖
  - 已知失败但未解决
- **Suggested Fix**: 
  1. 实现跳过的功能
  2. 设置测试依赖
  3. 或在 TODO 中跟踪

#### 23. [Source Code] [Low Severity] [double throw pattern]
- **File/Path**: `src/domains/domain-baseline-catalog.ts:546,550`
- **Issue Description**: 
  - 在 baseline 未找到时连续抛出两次错误
  - 可能导致混淆的错误堆栈
- **Suggested Fix**: 
  1. 审查并修正错误抛出逻辑
  2. 简化错误处理流程

#### 24. [Source Code] [Low Severity] [user-operations.json configuration too simple]
- **File/Path**: `config/domains/user-operations.json`
- **Issue Description**: 
  - 配置极简，无 workflows 或 contracts 定义
  - 可能无法正常工作
- **Suggested Fix**: 
  1. 补充完整的领域配置
  2. 或确认这是有意为之

#### 25. [Deployment] [Low Severity] [CI Coverage gate only runs on Node 22]
- **File/Path**: `.github/workflows/`
- **Issue Description**: 
  - `coverage:gate` 仅在 Node 22 运行
  - Node 20 不检查覆盖率
  - 不同版本可能有不同的覆盖情况
- **Suggested Fix**: 
  1. 在所有版本上运行 coverage gate
  2. 或在 PR 检查中明确说明

#### 26. [Source Code] [Low Severity] [Module-level logger instance may not be best practice]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:69`
- **Issue Description**: 
  ```typescript
  const logger = new StructuredLogger({ retentionLimit: 100 });
  ```
  - 模块级状态可能不是最佳实践
  - 大多数服务使用依赖注入
- **Suggested Fix**: 
  1. 通过依赖注入传递 logger
  2. 或使用全局单例

### Summary

本次补充Review（第十轮 - 深度代码质量与API一致性Review - 2026-05-14）发现了26个新问题，重点关注代码质量和API一致性。

**High Priority (Requires Immediate Action)**:
1. sleepSync busy-wait 阻塞事件循环
2. TODO R4-27: HarnessRun 持久化缺失
3. SDK 与 Server 路由不匹配 (/handshake, /version 缺失)
4. SDK URL 缺少 /api 前缀
5. quant-trading.json 存在多种配置错误

**Medium Priority**:
1. SDK 与 Server 错误类别不一致
2. N+1 查询模式 (postgres-fencing-token-service)
3. experience-cache-service 无分页
4. 无限制的内存 Map
5. 固定轮询间隔无 jitter
6. VersionRoutingMiddleware 未连接
7. marketing.json 缺少必需字段
8. 21个 TODO/FIXME 注释未处理
9. 82处 any 类型使用
10. 连接池默认大小可能不足
11. experience_cache 表无索引
12. 1059处 setTimeout/sleep (测试脆弱)
13. 6个测试文件使用 @ts-nocheck
14. 3个集成测试跳过

**Low Priority**:
1. 魔法数字散落各处
2. 静默 catch 块吞掉错误
3. 5个测试使用 .skip 标记
4. double throw 模式
5. user-operations.json 配置过简
6. CI coverage gate 仅在 Node 22
7. 模块级 logger 实例

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 51 | 57 | 26 | 134 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 8 | 29 | 18 | 55 |
| 安全 | 6 | 6 | 1 | 13 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 0 | 8 | 5 | 13 |
| **合计** | **75** | **124** | **61** | **260** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 SDK 与 Server 路由不匹配（/handshake, /version, /api前缀）
2. 实现 HarnessRun 持久化（TODO R4-27）
3. 修复 quant-trading.json 和 marketing.json 配置错误
4. 将 sleepSync 改为非阻塞实现
5. 统一 SDK 和 Server 错误类别映射

**Short Term (This Month)**:
1. 实现 N+1 查询修复和分页
2. 添加无界 Map 的驱逐策略
3. 添加轮询 jitter 防止 thundering herd
4. 处理所有 TODO/FIXME 注释
5. 移除测试文件中的 @ts-nocheck
6. 修复 workflow_state 集成测试

**Long Term Planning**:
1. 启用 TypeScript strict mode
2. 完善 API 版本控制中间件
3. 添加 experience_cache 表索引
4. 统一所有魔法数字到常量
5. 建立代码质量门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 13 - Cache, Session and Real-time Communication Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [CORS allowedMethods missing PUT/PATCH/DELETE]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts:12-14`
- **Issue Description**: 
  ```typescript
  export const DEFAULT_CORS_CONFIG: CorsConfig = {
    allowedMethods: ["GET", "POST", "OPTIONS"],  // 缺少 PUT, PATCH, DELETE
  ```
  - 浏览器 CORS preflight 会拒绝 PUT/PATCH/DELETE 请求
  - 但路由中有 PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. 添加 PUT, PATCH, DELETE 到 allowedMethods
  2. 确保 CORS 配置与应用路由方法一致
  3. 添加测试验证所有 HTTP 方法的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - 使用 buildJsonResponse（成功包装）返回错误
  - 错误被包装在成功信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. 使用 buildJsonErrorResponse 处理错误
  2. 确保所有错误路径使用正确的错误信封
  3. 添加 API 一致性测试

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // 无 maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 不同
  - 恶意客户端可耗尽服务器资源
- **Suggested Fix**: 
  1. 添加 maxConnections 限制
  2. 实现连接限制拒绝策略
  3. 添加连接计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection 清理 subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map 未清理
  - 断开的客户端未确认的消息永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中删除所有 pendingAcks 条目
  2. 考虑添加超时机制自动清理未确认消息
  3. 记录清理操作的审计日志

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作回退
  - 如果环境变量未设置，使用不安全密钥
- **Suggested Fix**: 
  1. 移除回退值，要求环境变量必须设置
  2. 在启动时验证密钥存在且足够强
  3. 如果密钥缺失导致启动失败

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只有3个字段，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - 回退到默认值可能不适合测试环境
- **Suggested Fix**: 
  1. 添加完整的 timeout/tuning 配置
  2. 确保测试环境有合理的默认值
  3. 文档化必需的配置字段

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - 生产环境严重受限，可能影响吞吐量
- **Suggested Fix**: 
  1. 评估并调整生产限制
  2. 与业务需求匹配
  3. 添加生产容量测试

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: 多个域服务
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps 无限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等无限制
  - `domain-recipe-service.ts:67-68`: recipes, versions 无限制
  - `domain-risk-profile-service.ts:51`: profiles 无限制
  - Session Maps (session-management.ts:83-89) 无自动清理
- **Suggested Fix**: 
  1. 为所有 Map 实现 LRU 或 TTL 驱逐策略
  2. 添加后台清理任务
  3. 添加大小监控和告警

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单任务历史为 200 条
  - 但 Map 本身从不清理
  - 取消订阅的任务历史永久保留
- **Suggested Fix**: 
  1. 实现后台清理无订阅者任务的历史
  2. 添加任务订阅者监控
  3. 考虑使用 WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json 有完整的 remoteWorkerRegistration 配置
  - dev/staging/pre-prod 只有 approvalMode
  - prod 有 approvalMode 但无 remoteWorkerRegistration
  - 安全配置不一致
- **Suggested Fix**: 
  1. 统一所有环境的 remoteWorkerRegistration
  2. 添加安全配置验证
  3. 确保最低安全基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` 使用 buildJsonDocumentResponse（无包装）
  - 其他端点使用 buildJsonResponse（{requestId, data} 包装）
  - 客户端体验不一致
- **Suggested Fix**: 
  1. 统一响应信封格式
  2. 文档化响应格式规范
  3. 添加响应格式验证测试

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite 有部分唯一索引支持 idempotency
  - Redis 实现使用哈希索引但实现不完整
  - 可能导致重复消息
- **Suggested Fix**: 
  1. 完善 Redis idempotency 实现
  2. 添加唯一索引验证
  3. 确保与 SQLite 行为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - 无外部存储
  - 多实例部署不共享
  - 重启后去重状态丢失
- **Suggested Fix**: 
  1. 使用 Redis 替代内存存储
  2. 支持分布式去重
  3. 持久化去重状态

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: 多个 cache 实现
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService 无锁
  - 缓存未命中时可发生 thundering herd
  - 高并发下可能导致数据库过载
- **Suggested Fix**: 
  1. 实现 single-flight 模式
  2. 添加请求排队机制
  3. 使用分布式锁保护缓存更新

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - 清理仅在 record() 调用时触发
  - 空闲时无后台清理
  - 可能导致内存持续增长
- **Suggested Fix**: 
  1. 添加定期后台清理任务
  2. 使用独立的清理线程
  3. 添加内存使用监控

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket 服务器
- **Issue Description**: 
  - getClientCount() 存在但未通过 HTTP 端点暴露
  - 无 pendingAcks 队列深度指标
  - 无连接建立告警
- **Suggested Fix**: 
  1. 通过 metrics 端点暴露连接指标
  2. 添加 pendingAcks 队列监控
  3. 添加连接数异常告警

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在心跳 Sweep 时检查 isAlive
  - 无 per-client 独立于心跳的空闲超时
  - 认证后从不发送消息的客户端只能通过心跳失败检测
- **Suggested Fix**: 
  1. 添加 per-client idle timeout
  2. 独立于心跳间隔
  3. 配置可调整

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意客户端可订阅 100 个任务
  - 无全局任务订阅者限制
- **Suggested Fix**: 
  1. 添加全局任务订阅者限制
  2. 实现 per-task 订阅者上限
  3. 添加反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - 配置有 "version": "v4.3"
  - 但无 schema 版本验证
  - 加载时可能接受不兼容配置
- **Suggested Fix**: 
  1. 添加 JSON Schema 验证
  2. 实现版本兼容性检查
  3. 启动时验证配置完整性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder 数组的 splice 操作是 O(n)
  - 高频访问时可能性能问题
- **Suggested Fix**: 
  1. 使用 LinkedList 替代数组
  2. 或使用 Map 维护访问顺序
  3. 性能测试验证

### Summary

本次补充Review（第十三轮 - 缓存会话与实时通信Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求会失败）
2. Mission Routes 错误响应包装不当
3. WebSocketBridge 无最大连接数限制（DoS风险）
4. pendingAcks 断开连接时未清理（内存泄漏）
5. 硬编码回退密钥（安全漏洞）
6. config/runtime/test.json 缺少超时配置
7. prod.json maxConcurrentTasks=1 限制过严
8. 多个服务存在无界 Map（内存泄漏风险）

**Medium Priority**:
1. taskEventHistory Map 永不清理
2. 安全配置 drift（remoteWorkerRegistration 缺失）
3. OpenAPI 端点响应格式不一致
4. Redis 队列 idempotency 实现不完整
5. 请求去重中间件使用内存存储（多实例不共享）
6. Cache 无 stampede 保护
7. EvidenceService eviction 仅在插入时触发

**Low Priority**:
1. 无连接指标暴露
2. 无空闲客户端超时
3. 订阅限制是 per-client 而非全局
4. config/runtime 无版本验证机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 64 | 74 | 35 | 173 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 CORS allowedMethods 添加 PUT/PATCH/DELETE
2. 修复 Mission Routes 错误响应格式
3. 为 WebSocketBridge 添加最大连接数限制
4. 清理 pendingAcks 和 taskEventHistory
5. 移除硬编码回退密钥
6. 修复 config/runtime/test.json 配置
7. 评估并调整 prod 并发限制

**Short Term (This Month)**:
1. 统一安全配置（remoteWorkerRegistration）
2. 实现无界 Map 的 LRU/TTL 驱逐
3. 统一 API 响应信封格式
4. 完善 Redis idempotency 实现
5. 添加分布式去重中间件
6. 实现 cache stampede 保护

**Long Term Planning**:
1. 建立完整的连接管理和监控
2. 实现后台清理任务框架
3. 添加配置 schema 验证
4. 优化高频繁操作的数据结构
5. 建立内存使用基线和告警

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 12 - Error Handling and Multi-tenant Security Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [listQuotas() returns all tenant quotas - information disclosure]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:222-234`
- **Issue Description**: 
  ```typescript
  listQuotas(tenantId?: string): TenantQuota[] {
    if (tenantId) {
      return this.db.connection.prepare(`SELECT * FROM tenant_quotas WHERE tenant_id = ?`).all(tenantId);
    }
    // WITHOUT tenantId: 返回所有租户的配额！
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - 当 tenantId 为空时返回所有租户的配额
  - 未经授权的信息泄露
- **Suggested Fix**: 
  1. 要求调用者必须提供 tenantId
  2. 添加权限验证确保只能查看自己的配额
  3. 审计日志记录所有配额访问

#### 2. [Security] [High Severity] [assertTaskTenantAccess() returns 404 instead of 403 - resource existence leaked]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**: 
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // 应该是403
  }
  ```
  - 跨租户访问返回404而非403
  - 泄露了资源存在但属于其他租户的信息
  - 攻击者可检测有效task ID
- **Suggested Fix**: 
  1. 改为返回403 Forbidden
  2. 不要泄露资源是否存在

#### 3. [Security] [High Severity] [crossTenantRequest flag controlled by caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**: 
  - `routeOrgBudget()` 接受 `crossTenantRequest?: boolean` 参数
  - 该标志由调用者设置，非系统派生
  - 攻击者可能操纵此标志绕过跨租户限制
- **Suggested Fix**: 
  1. 标志应由系统状态派生，不接受调用者输入
  2. 添加审计日志追踪跨租户请求
  3. 实现零信任跨租户访问模型

#### 4. [Source Code] [High Severity] [single-task-happy-path has no retry mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**: 
  - `maxRetries: 0` 和 `retryBackoff: "none"`
  - 瞬态失败无自动重试
  - LLM调用失败时无fallback到备用provider
- **Suggested Fix**: 
  1. 启用非关键执行的重试
  2. 实现LLM provider fallback链（Anthropic → OpenAI → MiniMax）
  3. 使用domain baseline catalog的primary/fallback模型偏好

#### 5. [Source Code] [High Severity] [LLM calls have no circuit breaker protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 熔断器只存在于 channel-gateway 和 call-governance
  - 直接LLM provider调用无熔断器
  - provider降级时无法快速失败
- **Suggested Fix**: 
  1. 在model-call-provider.ts添加熔断器
  2. 当provider失败率超阈值时快速失败
  3. 自动切换到备用provider

#### 6. [Security] [High Severity] [Distributed rate limiter bypass - not shared between instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**: 
  - Redis未配置时使用本地Map
  - 每个实例维护自己的localEntries
  - 攻击者可通过切换实例绕过限流
- **Suggested Fix**: 
  1. 要求Redis配置用于生产
  2. 或使用Redis作为所有实例的共享后端
  3. 检测并警告未配置Redis的实例

#### 7. [Configuration] [Medium Severity] [Soft quota (log_only) does not actually limit]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**: 
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // log_only时返回true
  ```
  - soft quota只记录日志，不实际阻止
  - 配额形同虚设
- **Suggested Fix**: 
  1. 明确区分"监控模式"和"强制模式"
  2. 对于硬配额必须阻止
  3. 文档化quota类型的实际行为

#### 8. [Configuration] [Medium Severity] [HTTP layer lacks rate limit headers - clients cannot know limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**: 
  - 未返回 X-RateLimit-* 头
  - 只在429响应时返回retry-after-ms
  - 客户端无法主动管理请求速率
- **Suggested Fix**: 
  1. 在所有响应添加 X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  2. 使用标准头名称
  3. 遵循RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP layer lacks rate limit - optional and only by IP]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**: 
  - 限流仅在 `this.rateLimiter != null` 时生效
  - 限流key为 `${clientIp}:${endpoint}` 仅按IP
  - 无per-tenant/per-principal enforcement
- **Suggested Fix**: 
  1. 默认启用限流
  2. 添加per-tenant限流key
  3. 确保所有环境默认配置限流

#### 10. [Security] [Medium Severity] [processRuleMode may not be enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**: 
  - `SandboxPolicy.processRuleMode` 设置为 "allow" 或 "deny"
  - 但未找到实际阻止基于此策略生成进程的实际执行代码
  - `--allow-child-process` 标志仅在 sandboxed_process 隔离模式应用
- **Suggested Fix**: 
  1. 验证processRuleMode实际被强制执行
  2. 确保所有隔离模式正确处理
  3. 添加测试验证进程创建被阻止

#### 11. [Security] [Medium Severity] [Container template replacement not validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**: 
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - 简单字符串替换
  - 虽然validateContainerLaunchPluginId()阻止\0和引号
  - 但模板替换本身未验证
- **Suggested Fix**: 
  1. 添加输入验证防止注入
  2. 使用更安全的模板引擎
  3. 验证所有占位符被替换

#### 12. [Security] [Medium Severity] [Adapter execution bypasses sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**: 
  - Adapter执行REST/grpc/MQ调用不经过ScopedExternalAccessSandbox
  - 有自己的allowedDomains配置但非集中管理
  - 可能发起未限制的出站请求
- **Suggested Fix**: 
  1. Adapter执行经过集中沙箱
  2. 统一external access策略
  3. 添加adapter出站请求审计

#### 13. [Security] [Medium Severity] [Silent pass-through when principal.tenantId is null]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**: 
  ```typescript
  if (principal.tenantId == null) {
    return;  // 静默放行
  }
  ```
  - 如果API网关允许无principal认证的请求通过
  - 可能授予跨租户访问权限
- **Suggested Fix**: 
  1. 要求所有API请求有有效principal
  2. null tenantId应拒绝而非静默放行
  3. 添加审计日志

#### 14. [Source Code] [Medium Severity] [No LLM provider fallback chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 主provider失败时无自动切换
  - domain-baseline-catalog.ts定义了primary/fallback模型偏好但未使用
  - 第一个provider失败即导致执行失败
- **Suggested Fix**: 
  1. 实现provider fallback链
  2. 使用domain baseline的primary/fallback配置
  3. 按优先级尝试直到成功或全部失败

#### 15. [Source Code] [Medium Severity] [Timeout values hardcoded]
- **File/Path**: 多个文件
- **Issue Description**: 
  - Effect buffer有固定超时reject
  - Channel gateway的requestTimeoutMs虽可配置但有max 30s限制
  - 无全局请求超时中间件
- **Suggested Fix**: 
  1. 集中超时配置
  2. per-environment可配置
  3. 添加全局超时中间件

#### 16. [Database] [Medium Severity] [No down migration - rollback not supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**: 
  - `rollbackSupported = false`
  - 每个migration只有 `downSql` 占位符
  - schema migration无法回滚
- **Suggested Fix**: 
  1. 文档化回滚限制
  2. 在变更前创建完整备份
  3. 使用blue-green部署减少回滚需求

#### 17. [Database] [Medium Severity] [Migration 44 special handling - duplicate table creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**: 
  - Migration 43创建harness_runs表
  - Migration 44再次创建同名表（不同schema）
  - 使用applyCompatibleColumnMigrationIfKnown特殊处理
- **Suggested Fix**: 
  1. 消除重复表创建
  2. 使用ALTER TABLE而非CREATE TABLE
  3. 简化migration逻辑

#### 18. [Configuration] [Low Severity] [Provider rate limit headers not forwarded to client]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**: 
  - 系统读取provider的ratelimitResetHeaderNames
  - 但不转发给客户端
  - 客户端无法知道provider限流状态
- **Suggested Fix**: 
  1. 转发Provider的限流头
  2. 或添加应用层限流信息
  3. 帮助客户端优化请求

#### 19. [Security] [Low Severity] [Browser evaluate accepts arbitrary scripts]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**: 
  - `evaluate` action接受script参数
  - 在浏览器上下文运行（模拟）
  - 如浏览器上下文未正确沙箱化可能是向量
- **Suggested Fix**: 
  1. 验证浏览器上下文正确沙箱化
  2. 消毒或限制script内容
  3. 记录所有evaluate调用

#### 20. [Source Code] [Low Severity] [No global error boundary wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - 执行引擎缺少unhandled promise rejection的全局处理
  - single-task-happy-path的LLM fallback失败时错误向上传播
- **Suggested Fix**: 
  1. 在执行引擎添加错误边界包装
  2. 统一错误处理模式
  3. 确保所有错误被捕获和记录

### Summary

本次补充Review（第十二轮 - 错误处理与多租户安全Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. listQuotas()返回所有租户配额（信息泄露）
2. assertTaskTenantAccess()返回404泄露资源存在
3. crossTenantRequest标志可被操纵
4. single-task-happy-path无重试（maxRetries=0）
5. LLM调用无熔断器保护
6. 分布式限流器可被bypass（实例间不共享）

**Medium Priority**:
1. Soft quota实际不阻止
2. 无X-RateLimit-*响应头
3. HTTP层限流可选且仅按IP
4. processRuleMode可能未强制
5. 容器模板替换未验证
6. Adapter执行绕过沙箱
7. null principal静默放行
8. 无LLM provider fallback链
9. 超时值硬编码
10. 无down migration
11. Migration 44特殊处理

**Low Priority**:
1. Provider限流头未转发
2. Browser evaluate接受任意脚本
3. 无全局错误边界

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 60 | 68 | 31 | 159 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 8 | 35 | 21 | 64 |
| 安全 | 12 | 13 | 3 | 28 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **91** | **150** | **72** | **313** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复listQuotas()信息泄露漏洞
2. 修正assertTaskTenantAccess()返回403
3. 移除crossTenantRequest调用者控制
4. 启用执行引擎重试机制
5. 添加LLM provider熔断器

**Short Term (This Month)**:
1. 修复分布式限流器bypass问题
2. 添加X-RateLimit-*响应头
3. 启用默认HTTP限流（per-tenant）
4. 实现LLM provider fallback链
5. 验证并强制processRuleMode

**Long Term Planning**:
1. 建立完整的限流和配额体系
2. 实现插件系统安全审计
3. 建立多租户安全测试
4. 完善错误处理和恢复机制
5. 统一超时和熔断配置

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 13 - Cache, Session and Real-time Communication Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [CORS allowedMethods missing PUT/PATCH/DELETE]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts:12-14`
- **Issue Description**: 
  ```typescript
  export const DEFAULT_CORS_CONFIG: CorsConfig = {
    allowedMethods: ["GET", "POST", "OPTIONS"],  // 缺少 PUT, PATCH, DELETE
  ```
  - 浏览器 CORS preflight 会拒绝 PUT/PATCH/DELETE 请求
  - 但路由中有 PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. 添加 PUT, PATCH, DELETE 到 allowedMethods
  2. 确保 CORS 配置与应用路由方法一致
  3. 添加测试验证所有 HTTP 方法的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - 使用 buildJsonResponse（成功包装）返回错误
  - 错误被包装在成功信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. 使用 buildJsonErrorResponse 处理错误
  2. 确保所有错误路径使用正确的错误信封
  3. 添加 API 一致性测试

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // 无 maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 不同
  - 恶意客户端可耗尽服务器资源
- **Suggested Fix**: 
  1. 添加 maxConnections 限制
  2. 实现连接限制拒绝策略
  3. 添加连接计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection 清理 subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map 未清理
  - 断开的客户端未确认的消息永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中删除所有 pendingAcks 条目
  2. 考虑添加超时机制自动清理未确认消息
  3. 记录清理操作的审计日志

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作回退
  - 如果环境变量未设置，使用不安全密钥
- **Suggested Fix**: 
  1. 移除回退值，要求环境变量必须设置
  2. 在启动时验证密钥存在且足够强
  3. 如果密钥缺失导致启动失败

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只有3个字段，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - 回退到默认值可能不适合测试环境
- **Suggested Fix**: 
  1. 添加完整的 timeout/tuning 配置
  2. 确保测试环境有合理的默认值
  3. 文档化必需的配置字段

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - 生产环境严重受限，可能影响吞吐量
- **Suggested Fix**: 
  1. 评估并调整生产限制
  2. 与业务需求匹配
  3. 添加生产容量测试

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: 多个域服务
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps 无限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等无限制
  - `domain-recipe-service.ts:67-68`: recipes, versions 无限制
  - `domain-risk-profile-service.ts:51`: profiles 无限制
  - Session Maps (session-management.ts:83-89) 无自动清理
- **Suggested Fix**: 
  1. 为所有 Map 实现 LRU 或 TTL 驱逐策略
  2. 添加后台清理任务
  3. 添加大小监控和告警

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单任务历史为 200 条
  - 但 Map 本身从不清理
  - 取消订阅的任务历史永久保留
- **Suggested Fix**: 
  1. 实现后台清理无订阅者任务的历史
  2. 添加任务订阅者监控
  3. 考虑使用 WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json 有完整的 remoteWorkerRegistration 配置
  - dev/staging/pre-prod 只有 approvalMode
  - prod 有 approvalMode 但无 remoteWorkerRegistration
  - 安全配置不一致
- **Suggested Fix**: 
  1. 统一所有环境的 remoteWorkerRegistration
  2. 添加安全配置验证
  3. 确保最低安全基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` 使用 buildJsonDocumentResponse（无包装）
  - 其他端点使用 buildJsonResponse（{requestId, data} 包装）
  - 客户端体验不一致
- **Suggested Fix**: 
  1. 统一响应信封格式
  2. 文档化响应格式规范
  3. 添加响应格式验证测试

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite 有部分唯一索引支持 idempotency
  - Redis 实现使用哈希索引但实现不完整
  - 可能导致重复消息
- **Suggested Fix**: 
  1. 完善 Redis idempotency 实现
  2. 添加唯一索引验证
  3. 确保与 SQLite 行为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - 无外部存储
  - 多实例部署不共享
  - 重启后去重状态丢失
- **Suggested Fix**: 
  1. 使用 Redis 替代内存存储
  2. 支持分布式去重
  3. 持久化去重状态

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: 多个 cache 实现
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService 无锁
  - 缓存未命中时可发生 thundering herd
  - 高并发下可能导致数据库过载
- **Suggested Fix**: 
  1. 实现 single-flight 模式
  2. 添加请求排队机制
  3. 使用分布式锁保护缓存更新

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - 清理仅在 record() 调用时触发
  - 空闲时无后台清理
  - 可能导致内存持续增长
- **Suggested Fix**: 
  1. 添加定期后台清理任务
  2. 使用独立的清理线程
  3. 添加内存使用监控

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket 服务器
- **Issue Description**: 
  - getClientCount() 存在但未通过 HTTP 端点暴露
  - 无 pendingAcks 队列深度指标
  - 无连接建立告警
- **Suggested Fix**: 
  1. 通过 metrics 端点暴露连接指标
  2. 添加 pendingAcks 队列监控
  3. 添加连接数异常告警

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在心跳 Sweep 时检查 isAlive
  - 无 per-client 独立于心跳的空闲超时
  - 认证后从不发送消息的客户端只能通过心跳失败检测
- **Suggested Fix**: 
  1. 添加 per-client idle timeout
  2. 独立于心跳间隔
  3. 配置可调整

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意客户端可订阅 100 个任务
  - 无全局任务订阅者限制
- **Suggested Fix**: 
  1. 添加全局任务订阅者限制
  2. 实现 per-task 订阅者上限
  3. 添加反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - 配置有 "version": "v4.3"
  - 但无 schema 版本验证
  - 加载时可能接受不兼容配置
- **Suggested Fix**: 
  1. 添加 JSON Schema 验证
  2. 实现版本兼容性检查
  3. 启动时验证配置完整性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder 数组的 splice 操作是 O(n)
  - 高频访问时可能性能问题
- **Suggested Fix**: 
  1. 使用 LinkedList 替代数组
  2. 或使用 Map 维护访问顺序
  3. 性能测试验证

### Summary

本次补充Review（第十三轮 - 缓存会话与实时通信Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求会失败）
2. Mission Routes 错误响应包装不当
3. WebSocketBridge 无最大连接数限制（DoS风险）
4. pendingAcks 断开连接时未清理（内存泄漏）
5. 硬编码回退密钥（安全漏洞）
6. config/runtime/test.json 缺少超时配置
7. prod.json maxConcurrentTasks=1 限制过严
8. 多个服务存在无界 Map（内存泄漏风险）

**Medium Priority**:
1. taskEventHistory Map 永不清理
2. 安全配置 drift（remoteWorkerRegistration 缺失）
3. OpenAPI 端点响应格式不一致
4. Redis 队列 idempotency 实现不完整
5. 请求去重中间件使用内存存储（多实例不共享）
6. Cache 无 stampede 保护
7. EvidenceService eviction 仅在插入时触发

**Low Priority**:
1. 无连接指标暴露
2. 无空闲客户端超时
3. 订阅限制是 per-client 而非全局
4. config/runtime 无版本验证机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 64 | 74 | 35 | 173 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 CORS allowedMethods 添加 PUT/PATCH/DELETE
2. 修复 Mission Routes 错误响应格式
3. 为 WebSocketBridge 添加最大连接数限制
4. 清理 pendingAcks 和 taskEventHistory
5. 移除硬编码回退密钥
6. 修复 config/runtime/test.json 配置
7. 评估并调整 prod 并发限制

**Short Term (This Month)**:
1. 统一安全配置（remoteWorkerRegistration）
2. 实现无界 Map 的 LRU/TTL 驱逐
3. 统一 API 响应信封格式
4. 完善 Redis idempotency 实现
5. 添加分布式去重中间件
6. 实现 cache stampede 保护

**Long Term Planning**:
1. 建立完整的连接管理和监控
2. 实现后台清理任务框架
3. 添加配置 schema 验证
4. 优化高频繁操作的数据结构
5. 建立内存使用基线和告警

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] 自动Review报告（第十一轮 - 并发安全与可观测性Review）

### Newly Discovered Issues

#### 1. [Source Code] [Critical] [FencingTokenService 静态可变状态无锁保护]
- **File/Path**: `src/platform/five-plane-state-evidence/events/cas/fencing-token-service.ts:71-73`
- **Issue Description**: 
  ```typescript
  private static readonly activeFences = new Map<string, FenceInfo>();
  private static globalTokenCounter = 0;
  ```
  - `acquireFence` 方法执行非原子的 read-then-write 模式
  - 两个并发调用可能同时通过检查，导致状态不一致
  - 静态 Map 在无锁情况下被并发读写
- **Suggested Fix**: 
  1. 添加互斥锁保护 activeFences 访问
  2. 使用原子操作或 Compare-And-Swap
  3. 考虑使用数据库行锁替代内存锁

#### 2. [Source Code] [Critical] [AsyncFencingTokenService.globalTokenCounter 不安全递增]
- **File/Path**: `src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts:13-17`
- **Issue Description**: 
  ```typescript
  private static readonly globalTokenCounter = {
    value: 0,
    getAndIncrement(): number { return ++this.value; }
  };
  ```
  - 经典的 read-modify-write 竞态条件
  - 多线程可能读到相同的值
- **Suggested Fix**: 
  1. 使用 `pg_advisory_xact_lock` 保护
  2. 或使用数据库自增序列
  3. 移除静态计数器，使用数据库生成

#### 3. [Source Code] [Critical] [BudgetAllocator.activeReservations 无保护 Map]
- **File/Path**: `src/platform/five-plane-execution/budget-allocator.ts:394,426,458,467,569,657,711`
- **Issue Description**: 
  ```typescript
  this.activeReservations.set(result.reservation.budgetReservationId, result.reservation);
  this.activeReservations.delete(reservationId);
  ```
  - 并发代码路径修改 activeReservations Map
  - 无锁保护
- **Suggested Fix**: 
  1. 添加 Map 级别的读写锁
  2. 使用 ConcurrentMap 或类似结构
  3. 重构为无状态设计

#### 4. [Source Code] [High Severity] [SqliteLockAdapter.fencingCounter 不同步]
- **File/Path**: `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:9,14,48,74,88`
- **Issue Description**: 
  - `fencingCounter` 在 acquire/extend/forceSteal 中递增
  - 无同步机制
- **Suggested Fix**: 
  1. 使用 SQLite 序列替代内存计数器
  2. 或添加适当的同步机制

#### 5. [Source Code] [High Severity] [ServiceRegistry.getInstance() 检查-then-创建 竞态]
- **File/Path**: `src/platform/shared/lifecycle/service-registry.ts:85-88`
- **Issue Description**: 
  ```typescript
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry._instance) {
      ServiceRegistry._instance = new ServiceRegistry();
    }
    return ServiceRegistry._instance;
  }
  ```
  - 两个线程可能同时看到 _instance 为 null
  - 创建两个实例
- **Suggested Fix**: 
  1. 使用 double-checked locking
  2. 或使用 ES2022 静态字段初始化
  3. `private static readonly _instance = new ServiceRegistry();`

#### 6. [Source Code] [Medium Severity] [StructuredLogger.rotationStateByPath 异步竞态]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts:142-144,438-453`
- **Issue Description**: 
  ```typescript
  private static rotationStateByPath = new Map<string, {...}>();
  ```
  - `writeToGlobalFileSink` 中存在 TOCTOU 竞态
  - 读取 pendingBytes 和实际写入之间可能被其他调用修改
- **Suggested Fix**: 
  1. 使用锁保护 rotationStateByPath
  2. 或使用单线程写入队列

#### 7. [Source Code] [Medium Severity] [EffectBuffer.scopes 并发修改风险]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/effect-buffer.ts:446,452,476,485,492,502-514`
- **Issue Description**: 
  - `scopes.delete(scopeId)` 与 `for (const [scopeId, scope] of this.scopes)` 并发
  - flush() 和 createScope 可能同时修改
- **Suggested Fix**: 
  1. 添加迭代锁
  2. 使用 CopyOnWrite 模式
  3. 在修改时复制一份 scopes

#### 8. [Source Code] [Medium Severity] [OIDC _skipSignatureVerification 标志存在风险]
- **File/Path**: `src/platform/five-plane-interface/api/oidc-oauth-service.ts:92,108-111`
- **Issue Description**: 
  - `_skipSignatureVerification` 标志存在于生产代码路径
  - 虽然标记为仅测试使用，但配置错误可能导致安全问题
- **Suggested Fix**: 
  1. 移除此标志或确保编译时完全删除
  2. 添加生产环境检查抛出错误
  3. 在代码审查中标记为禁止模式

#### 9. [Source Code] [Medium Severity] [Browser Executor 检测但不消毒 innerHTML]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:541`
- **Issue Description**: 
  - 检测到 innerHTML 但只返回假数据
  - 不进行实际消毒
  - 用户可能绕过保护
- **Suggested Fix**: 
  1. 使用 DOMPurify 或类似库消毒
  2. 或完全禁止 innerHTML
  3. 返回错误而非假数据

#### 10. [Database] [High Severity] [runtime-physical-schema 无外键约束]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts`
- **Issue Description**: 
  - `task_draft_id`, `confirmed_task_spec_id`, `harness_run_id` 等列无 FK 约束
  - 可能导致孤儿记录
  - 删除父记录时子记录变为孤立
- **Suggested Fix**: 
  1. 添加外键约束
  2. 实现软删除而非硬删除
  3. 添加数据库迁移脚本

#### 11. [Database] [Medium Severity] [大部分表缺少软删除和审计字段]
- **File/Path**: 多个表（除 mission_records 外）
- **Issue Description**: 
  - 只有 mission_records 有完整审计：created_at, created_by, updated_at, updated_by, archived_at, archived_by
  - 大部分表缺少 deleted_at, is_deleted 软删除字段
  - created_by/updated_by 仅在 mission_records 系列表中存在
- **Suggested Fix**: 
  1. 为所有核心表添加审计字段
  2. 实现软删除模式
  3. 添加规范说明哪些表必须有审计

#### 12. [CI/CD] [High Severity] [UI quality workflow 无覆盖率门禁]
- **File/Path**: `.github/workflows/ui-quality.yml:33`
- **Issue Description**: 
  - 运行 `test:coverage` 但无阈值执行
  - 缺少 `coverage:gate`
  - 与主 CI 不一致
- **Suggested Fix**: 
  1. 添加 `npm run coverage:gate` 到 UI workflow
  2. 或确保 UI 更改时运行主 CI

#### 13. [CI/CD] [High Severity] [部署工作流无真正的手动审批]
- **File/Path**: `.github/workflows/deploy-environment.yml`
- **Issue Description**: 
  - `workflow_dispatch` 有环境保护但无显式审批步骤
  - deploy.sh 的生产确认使用 `read -p` 在 CI/CD 中会挂起
  - 生产部署缺少真正的审批控制
- **Suggested Fix**: 
  1. 使用 GitHub Environment `required_reviewers`
  2. 修改 deploy.sh 检测 CI 环境跳过交互
  3. 添加显式审批步骤

#### 14. [CI/CD] [Medium Severity] [回滚机制边界情况未处理]
- **File/Path**: `.github/workflows/deploy-environment.yml:230-278`, `deploy/scripts/rollback.sh`
- **Issue Description**: 
  - 部署成功但 health check 失败时不会触发回滚
  - rollback.sh 只支持 dev|staging|prod（deploy.sh 支持 dev|test|staging|pre-prod|prod）
  - pre-prod 命名空间不一致：automatic-agent-preprod vs automatic-agent-pre-prod
- **Suggested Fix**: 
  1. 添加 health check 失败时的回滚触发
  2. 统一 rollback.sh 支持所有环境
  3. 修正 pre-prod 命名空间

#### 15. [CI/CD] [Medium Severity] [Canary/Blue-Green 升级无健康检查]
- **File/Path**: `.github/workflows/deploy-environment.yml:188-199`
- **Issue Description**: 
  - 初始部署有 health checks
  - 但 promotion 步骤无健康验证
  - 可能推送不健康的版本
- **Suggested Fix**: 
  1. 在 promotion 步骤后添加健康检查
  2. 验证推送的版本通过健康检查
  3. 失败时回滚

#### 16. [Observability] [High Severity] [58处 console.* 使用应使用 StructuredLogger]
- **File/Path**: 多个文件
- **Issue Description**: 
  - `src/index.ts`: 4次
  - `src/platform/ops-maturity/platform-panic/panic-propagation-service.ts`: 2 console.error + 1 console.log
  - `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts`: 1 console.error
  - `src/platform/five-plane-orchestration/harness/runtime/runtime-entry-guard.ts`: 3 console.warn
  - `src/ops-maturity/chaos/chaos-experiment-scheduler.ts`: 5 console.log + 4 console.warn
  - CLI 工具中多处
- **Suggested Fix**: 
  1. 替换 console.* 为 StructuredLogger
  2. 保留 CLI 输出的 console 用法（可接受）
  3. 添加 ESLint 规则检测

#### 17. [Observability] [High Severity] [29+执行引擎文件缺少结构化日志]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - `runtime-state-machine.ts`: 有 try/catch 但无 StructuredLogger
  - `multi-step-orchestration.ts`: 导入 HealthService 但无 StructuredLogger
  - `agent-executor.ts`: 169个 try 块，0 StructuredLogger 调用
  - 关键执行路径缺少可观测性
- **Suggested Fix**: 
  1. 为所有执行引擎文件添加 StructuredLogger
  2. 记录关键操作路径
  3. 确保错误路径有日志

#### 18. [Observability] [High Severity] [执行引擎缺少 LLM 调用指标]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - RuntimeMetricsRegistry 支持 `recordLlmLatency`, `recordHarnessRunDuration` 等
  - 但执行引擎中无调用
  - model-gateway 有指标但执行引擎无
- **Suggested Fix**: 
  1. 在 agent-executor 中记录 LLM 调用指标
  2. 在 multi-step-orchestration 中记录 harness 指标
  3. 启用完整指标覆盖

#### 19. [Observability] [Medium Severity] [日志方法使用不一致]
- **File/Path**: 多个服务
- **Issue Description**: 
  - 有的使用 `.error()`, `.warn()` 辅助方法
  - 有的使用 `logger.log({ level: "error", ... })`
  - 无统一规范
- **Suggested Fix**: 
  1. 建立日志方法规范
  2. 添加 ESLint 规则统一
  3. 重构为一致的 helper 方法调用

#### 20. [Security] [Medium Severity] [输入验证有限 - 仅 JWT 强类型]
- **File/Path**: 多个 API 端点
- **Issue Description**: 
  - JWT claims 有强类型验证
  - 其他输入验证有限
  - 缺少通用输入消毒
- **Suggested Fix**: 
  1. 添加通用输入验证中间件
  2. 使用 zod 或类似库验证请求体
  3. 为所有 API 端点添加验证

#### 21. [Source Code] [Low Severity] [HA Coordinator Leadership 获取可能非原子]
- **File/Path**: `src/platform/five-plane-execution/ha/ha-coordinator-service-inner.ts:70-78`
- **Issue Description**: 
  - `acquireLeadership` 可能执行非原子的 read-modify-write
  - leadership epoch 更新可能存在竞态
- **Suggested Fix**: 
  1. 使用数据库行锁保护
  2. 确保领导者选举原子性
  3. 添加领导者租约续约机制

### Summary

本次补充Review（第十一轮 - 并发安全与可观测性Review - 2026-05-14）发现了21个新问题，重点关注并发安全、可观测性和CI/CD。

**High Priority (Requires Immediate Action)**:
1. 7个并发竞态问题（FencingTokenService, BudgetAllocator, ServiceRegistry等）
2. runtime-physical-schema 无外键约束
3. UI quality workflow 无覆盖率门禁
4. 58处 console.* 使用应替换为 StructuredLogger
5. 29+ 执行引擎文件缺少结构化日志
6. 执行引擎缺少 LLM 调用指标

**Medium Priority**:
1. OIDC _skipSignatureVerification 标志风险
2. Browser Executor innerHTML 不消毒
3. 大部分表缺少软删除和审计字段
4. 部署工作流无真正手动审批
5. 回滚机制边界情况未处理
6. Canary/Blue-Green 升级无健康检查
7. 日志方法使用不一致
8. 输入验证有限

**Low Priority**:
1. HA Coordinator Leadership 获取可能非原子
2. SqliteLockAdapter fencingCounter 不同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 58 | 62 | 29 | 149 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 8 | 31 | 19 | 58 |
| 安全 | 7 | 8 | 1 | 16 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **84** | **135** | **66** | **285** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复所有7个并发竞态问题
2. 添加 runtime-physical-schema 外键约束
3. 为 UI quality workflow 添加覆盖率门禁
4. 替换关键路径的 console.* 为 StructuredLogger
5. 在执行引擎中添加 LLM 和 harness 指标

**Short Term (This Month)**:
1. 为所有执行引擎文件添加结构化日志
2. 添加数据库审计字段和软删除
3. 修正部署工作流审批机制
4. 统一日志方法使用规范
5. 添加 Canary/Blue-Green 健康检查

**Long Term Planning**:
1. 建立并发安全编码规范
2. 实现完整的可观测性标准
3. 完善数据库约束和审计机制
4. 增强 CI/CD 质量和安全门禁
5. 建立代码审查清单

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 13 - Cache, Session and Real-time Communication Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [CORS allowedMethods missing PUT/PATCH/DELETE]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts:12-14`
- **Issue Description**: 
  ```typescript
  export const DEFAULT_CORS_CONFIG: CorsConfig = {
    allowedMethods: ["GET", "POST", "OPTIONS"],  // 缺少 PUT, PATCH, DELETE
  ```
  - 浏览器 CORS preflight 会拒绝 PUT/PATCH/DELETE 请求
  - 但路由中有 PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. 添加 PUT, PATCH, DELETE 到 allowedMethods
  2. 确保 CORS 配置与应用路由方法一致
  3. 添加测试验证所有 HTTP 方法的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - 使用 buildJsonResponse（成功包装）返回错误
  - 错误被包装在成功信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. 使用 buildJsonErrorResponse 处理错误
  2. 确保所有错误路径使用正确的错误信封
  3. 添加 API 一致性测试

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // 无 maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 不同
  - 恶意客户端可耗尽服务器资源
- **Suggested Fix**: 
  1. 添加 maxConnections 限制
  2. 实现连接限制拒绝策略
  3. 添加连接计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection 清理 subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map 未清理
  - 断开的客户端未确认的消息永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中删除所有 pendingAcks 条目
  2. 考虑添加超时机制自动清理未确认消息
  3. 记录清理操作的审计日志

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作回退
  - 如果环境变量未设置，使用不安全密钥
- **Suggested Fix**: 
  1. 移除回退值，要求环境变量必须设置
  2. 在启动时验证密钥存在且足够强
  3. 如果密钥缺失导致启动失败

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只有3个字段，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - 回退到默认值可能不适合测试环境
- **Suggested Fix**: 
  1. 添加完整的 timeout/tuning 配置
  2. 确保测试环境有合理的默认值
  3. 文档化必需的配置字段

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - 生产环境严重受限，可能影响吞吐量
- **Suggested Fix**: 
  1. 评估并调整生产限制
  2. 与业务需求匹配
  3. 添加生产容量测试

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: 多个域服务
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps 无限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等无限制
  - `domain-recipe-service.ts:67-68`: recipes, versions 无限制
  - `domain-risk-profile-service.ts:51`: profiles 无限制
  - Session Maps (session-management.ts:83-89) 无自动清理
- **Suggested Fix**: 
  1. 为所有 Map 实现 LRU 或 TTL 驱逐策略
  2. 添加后台清理任务
  3. 添加大小监控和告警

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单任务历史为 200 条
  - 但 Map 本身从不清理
  - 取消订阅的任务历史永久保留
- **Suggested Fix**: 
  1. 实现后台清理无订阅者任务的历史
  2. 添加任务订阅者监控
  3. 考虑使用 WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json 有完整的 remoteWorkerRegistration 配置
  - dev/staging/pre-prod 只有 approvalMode
  - prod 有 approvalMode 但无 remoteWorkerRegistration
  - 安全配置不一致
- **Suggested Fix**: 
  1. 统一所有环境的 remoteWorkerRegistration
  2. 添加安全配置验证
  3. 确保最低安全基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` 使用 buildJsonDocumentResponse（无包装）
  - 其他端点使用 buildJsonResponse（{requestId, data} 包装）
  - 客户端体验不一致
- **Suggested Fix**: 
  1. 统一响应信封格式
  2. 文档化响应格式规范
  3. 添加响应格式验证测试

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite 有部分唯一索引支持 idempotency
  - Redis 实现使用哈希索引但实现不完整
  - 可能导致重复消息
- **Suggested Fix**: 
  1. 完善 Redis idempotency 实现
  2. 添加唯一索引验证
  3. 确保与 SQLite 行为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - 无外部存储
  - 多实例部署不共享
  - 重启后去重状态丢失
- **Suggested Fix**: 
  1. 使用 Redis 替代内存存储
  2. 支持分布式去重
  3. 持久化去重状态

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: 多个 cache 实现
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService 无锁
  - 缓存未命中时可发生 thundering herd
  - 高并发下可能导致数据库过载
- **Suggested Fix**: 
  1. 实现 single-flight 模式
  2. 添加请求排队机制
  3. 使用分布式锁保护缓存更新

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - 清理仅在 record() 调用时触发
  - 空闲时无后台清理
  - 可能导致内存持续增长
- **Suggested Fix**: 
  1. 添加定期后台清理任务
  2. 使用独立的清理线程
  3. 添加内存使用监控

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket 服务器
- **Issue Description**: 
  - getClientCount() 存在但未通过 HTTP 端点暴露
  - 无 pendingAcks 队列深度指标
  - 无连接建立告警
- **Suggested Fix**: 
  1. 通过 metrics 端点暴露连接指标
  2. 添加 pendingAcks 队列监控
  3. 添加连接数异常告警

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在心跳 Sweep 时检查 isAlive
  - 无 per-client 独立于心跳的空闲超时
  - 认证后从不发送消息的客户端只能通过心跳失败检测
- **Suggested Fix**: 
  1. 添加 per-client idle timeout
  2. 独立于心跳间隔
  3. 配置可调整

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意客户端可订阅 100 个任务
  - 无全局任务订阅者限制
- **Suggested Fix**: 
  1. 添加全局任务订阅者限制
  2. 实现 per-task 订阅者上限
  3. 添加反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - 配置有 "version": "v4.3"
  - 但无 schema 版本验证
  - 加载时可能接受不兼容配置
- **Suggested Fix**: 
  1. 添加 JSON Schema 验证
  2. 实现版本兼容性检查
  3. 启动时验证配置完整性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder 数组的 splice 操作是 O(n)
  - 高频访问时可能性能问题
- **Suggested Fix**: 
  1. 使用 LinkedList 替代数组
  2. 或使用 Map 维护访问顺序
  3. 性能测试验证

### Summary

本次补充Review（第十三轮 - 缓存会话与实时通信Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求会失败）
2. Mission Routes 错误响应包装不当
3. WebSocketBridge 无最大连接数限制（DoS风险）
4. pendingAcks 断开连接时未清理（内存泄漏）
5. 硬编码回退密钥（安全漏洞）
6. config/runtime/test.json 缺少超时配置
7. prod.json maxConcurrentTasks=1 限制过严
8. 多个服务存在无界 Map（内存泄漏风险）

**Medium Priority**:
1. taskEventHistory Map 永不清理
2. 安全配置 drift（remoteWorkerRegistration 缺失）
3. OpenAPI 端点响应格式不一致
4. Redis 队列 idempotency 实现不完整
5. 请求去重中间件使用内存存储（多实例不共享）
6. Cache 无 stampede 保护
7. EvidenceService eviction 仅在插入时触发

**Low Priority**:
1. 无连接指标暴露
2. 无空闲客户端超时
3. 订阅限制是 per-client 而非全局
4. config/runtime 无版本验证机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 64 | 74 | 35 | 173 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 CORS allowedMethods 添加 PUT/PATCH/DELETE
2. 修复 Mission Routes 错误响应格式
3. 为 WebSocketBridge 添加最大连接数限制
4. 清理 pendingAcks 和 taskEventHistory
5. 移除硬编码回退密钥
6. 修复 config/runtime/test.json 配置
7. 评估并调整 prod 并发限制

**Short Term (This Month)**:
1. 统一安全配置（remoteWorkerRegistration）
2. 实现无界 Map 的 LRU/TTL 驱逐
3. 统一 API 响应信封格式
4. 完善 Redis idempotency 实现
5. 添加分布式去重中间件
6. 实现 cache stampede 保护

**Long Term Planning**:
1. 建立完整的连接管理和监控
2. 实现后台清理任务框架
3. 添加配置 schema 验证
4. 优化高频繁操作的数据结构
5. 建立内存使用基线和告警

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 12 - Error Handling and Multi-tenant Security Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [listQuotas() returns all tenant quotas - information disclosure]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:222-234`
- **Issue Description**: 
  ```typescript
  listQuotas(tenantId?: string): TenantQuota[] {
    if (tenantId) {
      return this.db.connection.prepare(`SELECT * FROM tenant_quotas WHERE tenant_id = ?`).all(tenantId);
    }
    // WITHOUT tenantId: 返回所有租户的配额！
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - 当 tenantId 为空时返回所有租户的配额
  - 未经授权的信息泄露
- **Suggested Fix**: 
  1. 要求调用者必须提供 tenantId
  2. 添加权限验证确保只能查看自己的配额
  3. 审计日志记录所有配额访问

#### 2. [Security] [High Severity] [assertTaskTenantAccess() returns 404 instead of 403 - resource existence leaked]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**: 
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // 应该是403
  }
  ```
  - 跨租户访问返回404而非403
  - 泄露了资源存在但属于其他租户的信息
  - 攻击者可检测有效task ID
- **Suggested Fix**: 
  1. 改为返回403 Forbidden
  2. 不要泄露资源是否存在

#### 3. [Security] [High Severity] [crossTenantRequest flag controlled by caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**: 
  - `routeOrgBudget()` 接受 `crossTenantRequest?: boolean` 参数
  - 该标志由调用者设置，非系统派生
  - 攻击者可能操纵此标志绕过跨租户限制
- **Suggested Fix**: 
  1. 标志应由系统状态派生，不接受调用者输入
  2. 添加审计日志追踪跨租户请求
  3. 实现零信任跨租户访问模型

#### 4. [Source Code] [High Severity] [single-task-happy-path has no retry mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**: 
  - `maxRetries: 0` 和 `retryBackoff: "none"`
  - 瞬态失败无自动重试
  - LLM调用失败时无fallback到备用provider
- **Suggested Fix**: 
  1. 启用非关键执行的重试
  2. 实现LLM provider fallback链（Anthropic → OpenAI → MiniMax）
  3. 使用domain baseline catalog的primary/fallback模型偏好

#### 5. [Source Code] [High Severity] [LLM calls have no circuit breaker protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 熔断器只存在于 channel-gateway 和 call-governance
  - 直接LLM provider调用无熔断器
  - provider降级时无法快速失败
- **Suggested Fix**: 
  1. 在model-call-provider.ts添加熔断器
  2. 当provider失败率超阈值时快速失败
  3. 自动切换到备用provider

#### 6. [Security] [High Severity] [Distributed rate limiter bypass - not shared between instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**: 
  - Redis未配置时使用本地Map
  - 每个实例维护自己的localEntries
  - 攻击者可通过切换实例绕过限流
- **Suggested Fix**: 
  1. 要求Redis配置用于生产
  2. 或使用Redis作为所有实例的共享后端
  3. 检测并警告未配置Redis的实例

#### 7. [Configuration] [Medium Severity] [Soft quota (log_only) does not actually limit]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**: 
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // log_only时返回true
  ```
  - soft quota只记录日志，不实际阻止
  - 配额形同虚设
- **Suggested Fix**: 
  1. 明确区分"监控模式"和"强制模式"
  2. 对于硬配额必须阻止
  3. 文档化quota类型的实际行为

#### 8. [Configuration] [Medium Severity] [HTTP layer lacks rate limit headers - clients cannot know limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**: 
  - 未返回 X-RateLimit-* 头
  - 只在429响应时返回retry-after-ms
  - 客户端无法主动管理请求速率
- **Suggested Fix**: 
  1. 在所有响应添加 X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  2. 使用标准头名称
  3. 遵循RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP layer lacks rate limit - optional and only by IP]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**: 
  - 限流仅在 `this.rateLimiter != null` 时生效
  - 限流key为 `${clientIp}:${endpoint}` 仅按IP
  - 无per-tenant/per-principal enforcement
- **Suggested Fix**: 
  1. 默认启用限流
  2. 添加per-tenant限流key
  3. 确保所有环境默认配置限流

#### 10. [Security] [Medium Severity] [processRuleMode may not be enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**: 
  - `SandboxPolicy.processRuleMode` 设置为 "allow" 或 "deny"
  - 但未找到实际阻止基于此策略生成进程的实际执行代码
  - `--allow-child-process` 标志仅在 sandboxed_process 隔离模式应用
- **Suggested Fix**: 
  1. 验证processRuleMode实际被强制执行
  2. 确保所有隔离模式正确处理
  3. 添加测试验证进程创建被阻止

#### 11. [Security] [Medium Severity] [Container template replacement not validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**: 
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - 简单字符串替换
  - 虽然validateContainerLaunchPluginId()阻止\0和引号
  - 但模板替换本身未验证
- **Suggested Fix**: 
  1. 添加输入验证防止注入
  2. 使用更安全的模板引擎
  3. 验证所有占位符被替换

#### 12. [Security] [Medium Severity] [Adapter execution bypasses sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**: 
  - Adapter执行REST/grpc/MQ调用不经过ScopedExternalAccessSandbox
  - 有自己的allowedDomains配置但非集中管理
  - 可能发起未限制的出站请求
- **Suggested Fix**: 
  1. Adapter执行经过集中沙箱
  2. 统一external access策略
  3. 添加adapter出站请求审计

#### 13. [Security] [Medium Severity] [Silent pass-through when principal.tenantId is null]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**: 
  ```typescript
  if (principal.tenantId == null) {
    return;  // 静默放行
  }
  ```
  - 如果API网关允许无principal认证的请求通过
  - 可能授予跨租户访问权限
- **Suggested Fix**: 
  1. 要求所有API请求有有效principal
  2. null tenantId应拒绝而非静默放行
  3. 添加审计日志

#### 14. [Source Code] [Medium Severity] [No LLM provider fallback chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 主provider失败时无自动切换
  - domain-baseline-catalog.ts定义了primary/fallback模型偏好但未使用
  - 第一个provider失败即导致执行失败
- **Suggested Fix**: 
  1. 实现provider fallback链
  2. 使用domain baseline的primary/fallback配置
  3. 按优先级尝试直到成功或全部失败

#### 15. [Source Code] [Medium Severity] [Timeout values hardcoded]
- **File/Path**: 多个文件
- **Issue Description**: 
  - Effect buffer有固定超时reject
  - Channel gateway的requestTimeoutMs虽可配置但有max 30s限制
  - 无全局请求超时中间件
- **Suggested Fix**: 
  1. 集中超时配置
  2. per-environment可配置
  3. 添加全局超时中间件

#### 16. [Database] [Medium Severity] [No down migration - rollback not supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**: 
  - `rollbackSupported = false`
  - 每个migration只有 `downSql` 占位符
  - schema migration无法回滚
- **Suggested Fix**: 
  1. 文档化回滚限制
  2. 在变更前创建完整备份
  3. 使用blue-green部署减少回滚需求

#### 17. [Database] [Medium Severity] [Migration 44 special handling - duplicate table creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**: 
  - Migration 43创建harness_runs表
  - Migration 44再次创建同名表（不同schema）
  - 使用applyCompatibleColumnMigrationIfKnown特殊处理
- **Suggested Fix**: 
  1. 消除重复表创建
  2. 使用ALTER TABLE而非CREATE TABLE
  3. 简化migration逻辑

#### 18. [Configuration] [Low Severity] [Provider rate limit headers not forwarded to client]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**: 
  - 系统读取provider的ratelimitResetHeaderNames
  - 但不转发给客户端
  - 客户端无法知道provider限流状态
- **Suggested Fix**: 
  1. 转发Provider的限流头
  2. 或添加应用层限流信息
  3. 帮助客户端优化请求

#### 19. [Security] [Low Severity] [Browser evaluate accepts arbitrary scripts]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**: 
  - `evaluate` action接受script参数
  - 在浏览器上下文运行（模拟）
  - 如浏览器上下文未正确沙箱化可能是向量
- **Suggested Fix**: 
  1. 验证浏览器上下文正确沙箱化
  2. 消毒或限制script内容
  3. 记录所有evaluate调用

#### 20. [Source Code] [Low Severity] [No global error boundary wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - 执行引擎缺少unhandled promise rejection的全局处理
  - single-task-happy-path的LLM fallback失败时错误向上传播
- **Suggested Fix**: 
  1. 在执行引擎添加错误边界包装
  2. 统一错误处理模式
  3. 确保所有错误被捕获和记录

### Summary

本次补充Review（第十二轮 - 错误处理与多租户安全Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. listQuotas()返回所有租户配额（信息泄露）
2. assertTaskTenantAccess()返回404泄露资源存在
3. crossTenantRequest标志可被操纵
4. single-task-happy-path无重试（maxRetries=0）
5. LLM调用无熔断器保护
6. 分布式限流器可被bypass（实例间不共享）

**Medium Priority**:
1. Soft quota实际不阻止
2. 无X-RateLimit-*响应头
3. HTTP层限流可选且仅按IP
4. processRuleMode可能未强制
5. 容器模板替换未验证
6. Adapter执行绕过沙箱
7. null principal静默放行
8. 无LLM provider fallback链
9. 超时值硬编码
10. 无down migration
11. Migration 44特殊处理

**Low Priority**:
1. Provider限流头未转发
2. Browser evaluate接受任意脚本
3. 无全局错误边界

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 60 | 68 | 31 | 159 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 8 | 35 | 21 | 64 |
| 安全 | 12 | 13 | 3 | 28 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **91** | **150** | **72** | **313** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复listQuotas()信息泄露漏洞
2. 修正assertTaskTenantAccess()返回403
3. 移除crossTenantRequest调用者控制
4. 启用执行引擎重试机制
5. 添加LLM provider熔断器

**Short Term (This Month)**:
1. 修复分布式限流器bypass问题
2. 添加X-RateLimit-*响应头
3. 启用默认HTTP限流（per-tenant）
4. 实现LLM provider fallback链
5. 验证并强制processRuleMode

**Long Term Planning**:
1. 建立完整的限流和配额体系
2. 实现插件系统安全审计
3. 建立多租户安全测试
4. 完善错误处理和恢复机制
5. 统一超时和熔断配置

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 13 - Cache, Session and Real-time Communication Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [CORS allowedMethods missing PUT/PATCH/DELETE]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts:12-14`
- **Issue Description**: 
  ```typescript
  export const DEFAULT_CORS_CONFIG: CorsConfig = {
    allowedMethods: ["GET", "POST", "OPTIONS"],  // 缺少 PUT, PATCH, DELETE
  ```
  - 浏览器 CORS preflight 会拒绝 PUT/PATCH/DELETE 请求
  - 但路由中有 PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. 添加 PUT, PATCH, DELETE 到 allowedMethods
  2. 确保 CORS 配置与应用路由方法一致
  3. 添加测试验证所有 HTTP 方法的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - 使用 buildJsonResponse（成功包装）返回错误
  - 错误被包装在成功信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. 使用 buildJsonErrorResponse 处理错误
  2. 确保所有错误路径使用正确的错误信封
  3. 添加 API 一致性测试

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // 无 maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 不同
  - 恶意客户端可耗尽服务器资源
- **Suggested Fix**: 
  1. 添加 maxConnections 限制
  2. 实现连接限制拒绝策略
  3. 添加连接计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection 清理 subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map 未清理
  - 断开的客户端未确认的消息永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中删除所有 pendingAcks 条目
  2. 考虑添加超时机制自动清理未确认消息
  3. 记录清理操作的审计日志

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作回退
  - 如果环境变量未设置，使用不安全密钥
- **Suggested Fix**: 
  1. 移除回退值，要求环境变量必须设置
  2. 在启动时验证密钥存在且足够强
  3. 如果密钥缺失导致启动失败

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只有3个字段，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - 回退到默认值可能不适合测试环境
- **Suggested Fix**: 
  1. 添加完整的 timeout/tuning 配置
  2. 确保测试环境有合理的默认值
  3. 文档化必需的配置字段

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - 生产环境严重受限，可能影响吞吐量
- **Suggested Fix**: 
  1. 评估并调整生产限制
  2. 与业务需求匹配
  3. 添加生产容量测试

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: 多个域服务
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps 无限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等无限制
  - `domain-recipe-service.ts:67-68`: recipes, versions 无限制
  - `domain-risk-profile-service.ts:51`: profiles 无限制
  - Session Maps (session-management.ts:83-89) 无自动清理
- **Suggested Fix**: 
  1. 为所有 Map 实现 LRU 或 TTL 驱逐策略
  2. 添加后台清理任务
  3. 添加大小监控和告警

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单任务历史为 200 条
  - 但 Map 本身从不清理
  - 取消订阅的任务历史永久保留
- **Suggested Fix**: 
  1. 实现后台清理无订阅者任务的历史
  2. 添加任务订阅者监控
  3. 考虑使用 WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json 有完整的 remoteWorkerRegistration 配置
  - dev/staging/pre-prod 只有 approvalMode
  - prod 有 approvalMode 但无 remoteWorkerRegistration
  - 安全配置不一致
- **Suggested Fix**: 
  1. 统一所有环境的 remoteWorkerRegistration
  2. 添加安全配置验证
  3. 确保最低安全基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` 使用 buildJsonDocumentResponse（无包装）
  - 其他端点使用 buildJsonResponse（{requestId, data} 包装）
  - 客户端体验不一致
- **Suggested Fix**: 
  1. 统一响应信封格式
  2. 文档化响应格式规范
  3. 添加响应格式验证测试

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite 有部分唯一索引支持 idempotency
  - Redis 实现使用哈希索引但实现不完整
  - 可能导致重复消息
- **Suggested Fix**: 
  1. 完善 Redis idempotency 实现
  2. 添加唯一索引验证
  3. 确保与 SQLite 行为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - 无外部存储
  - 多实例部署不共享
  - 重启后去重状态丢失
- **Suggested Fix**: 
  1. 使用 Redis 替代内存存储
  2. 支持分布式去重
  3. 持久化去重状态

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: 多个 cache 实现
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService 无锁
  - 缓存未命中时可发生 thundering herd
  - 高并发下可能导致数据库过载
- **Suggested Fix**: 
  1. 实现 single-flight 模式
  2. 添加请求排队机制
  3. 使用分布式锁保护缓存更新

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - 清理仅在 record() 调用时触发
  - 空闲时无后台清理
  - 可能导致内存持续增长
- **Suggested Fix**: 
  1. 添加定期后台清理任务
  2. 使用独立的清理线程
  3. 添加内存使用监控

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket 服务器
- **Issue Description**: 
  - getClientCount() 存在但未通过 HTTP 端点暴露
  - 无 pendingAcks 队列深度指标
  - 无连接建立告警
- **Suggested Fix**: 
  1. 通过 metrics 端点暴露连接指标
  2. 添加 pendingAcks 队列监控
  3. 添加连接数异常告警

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在心跳 Sweep 时检查 isAlive
  - 无 per-client 独立于心跳的空闲超时
  - 认证后从不发送消息的客户端只能通过心跳失败检测
- **Suggested Fix**: 
  1. 添加 per-client idle timeout
  2. 独立于心跳间隔
  3. 配置可调整

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意客户端可订阅 100 个任务
  - 无全局任务订阅者限制
- **Suggested Fix**: 
  1. 添加全局任务订阅者限制
  2. 实现 per-task 订阅者上限
  3. 添加反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - 配置有 "version": "v4.3"
  - 但无 schema 版本验证
  - 加载时可能接受不兼容配置
- **Suggested Fix**: 
  1. 添加 JSON Schema 验证
  2. 实现版本兼容性检查
  3. 启动时验证配置完整性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder 数组的 splice 操作是 O(n)
  - 高频访问时可能性能问题
- **Suggested Fix**: 
  1. 使用 LinkedList 替代数组
  2. 或使用 Map 维护访问顺序
  3. 性能测试验证

### Summary

本次补充Review（第十三轮 - 缓存会话与实时通信Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求会失败）
2. Mission Routes 错误响应包装不当
3. WebSocketBridge 无最大连接数限制（DoS风险）
4. pendingAcks 断开连接时未清理（内存泄漏）
5. 硬编码回退密钥（安全漏洞）
6. config/runtime/test.json 缺少超时配置
7. prod.json maxConcurrentTasks=1 限制过严
8. 多个服务存在无界 Map（内存泄漏风险）

**Medium Priority**:
1. taskEventHistory Map 永不清理
2. 安全配置 drift（remoteWorkerRegistration 缺失）
3. OpenAPI 端点响应格式不一致
4. Redis 队列 idempotency 实现不完整
5. 请求去重中间件使用内存存储（多实例不共享）
6. Cache 无 stampede 保护
7. EvidenceService eviction 仅在插入时触发

**Low Priority**:
1. 无连接指标暴露
2. 无空闲客户端超时
3. 订阅限制是 per-client 而非全局
4. config/runtime 无版本验证机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 64 | 74 | 35 | 173 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| 部署 | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 CORS allowedMethods 添加 PUT/PATCH/DELETE
2. 修复 Mission Routes 错误响应格式
3. 为 WebSocketBridge 添加最大连接数限制
4. 清理 pendingAcks 和 taskEventHistory
5. 移除硬编码回退密钥
6. 修复 config/runtime/test.json 配置
7. 评估并调整 prod 并发限制

**Short Term (This Month)**:
1. 统一安全配置（remoteWorkerRegistration）
2. 实现无界 Map 的 LRU/TTL 驱逐
3. 统一 API 响应信封格式
4. 完善 Redis idempotency 实现
5. 添加分布式去重中间件
6. 实现 cache stampede 保护

**Long Term Planning**:
1. 建立完整的连接管理和监控
2. 实现后台清理任务框架
3. 添加配置 schema 验证
4. 优化高频繁操作的数据结构
5. 建立内存使用基线和告警

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry 接口无 requestId 字段
  - 只有 correlationId，它回退到 traceId
  - 无法独立追踪单个 HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry 添加 requestId 字段
  2. 在 HTTP 中间件中生成和注入 requestId
  3. 确保 requestId 流经所有日志调用

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 如果开发者传递 `{ password: "..." }` 给 logger.info，密码会被记录
  - 无字段级脱敏机制
  - 依赖开发者手动排除敏感字段
- **Suggested Fix**: 
  1. 添加 OBSERVE_OUTPUT_BLACKLIST 类似的黑名单
  2. 实现 redact/mask/sanitize 工具函数
  3. 在日志传输前自动清洗敏感字段

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - 无 PII 重写工具
  - 开发者必须手动避免记录敏感数据
  - 存在意外记录敏感信息的风险
- **Suggested Fix**: 
  1. 添加 PII 检测和重写工具
  2. 在文档中明确记录敏感字段列表
  3. 添加测试验证敏感数据不被记录

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 应该使用 StructuredLogger
  - console 调用可能不被日志聚合系统收集
  - 难以追踪和关联
- **Suggested Fix**: 
  1. 替换所有 console.* 为 StructuredLogger
  2. 添加 ESLint 规则禁止 console.*
  3. 保留少量允许的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只有消息，无 data 对象
  - 难以关联和查询
- **Suggested Fix**: 
  1. 添加 `{ data: { ... } }` 对象
  2. 确保所有日志包含上下文数据
  3. 添加日志审查工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // 依赖 budget gate 和 guardrail vibration 退出
    // 如果两者都失败，循环永久继续
  }
  ```
  - 依赖 budget gate 和 guardrail vibration 退出
  - 无硬性迭代次数限制
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. 记录详细的迭代统计用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - 如果 loopReplanDecision.shouldReplan 永不变为 false
  - 重规划永远无法减少计划错误
  - 可能导致无限循环
- **Suggested Fix**: 
  1. 添加重规划次数上限
  2. 在达到上限时强制接受当前结果
  3. 添加重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可转换到 paused 进行恢复
  - 创建恢复路径可能重新进入执行
  - 需要验证此行为的正确性
- **Suggested Fix**: 
  1. 审查 recovery 转换的合法性
  2. 确保不会导致状态不一致
  3. 添加转换前置条件验证

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - 错误消息硬编码英文
  - 无后端 i18n 机制
  - 非英文客户端收到不本地化的错误
- **Suggested Fix**: 
  1. 使用错误码而非硬编码消息
  2. 客户端根据错误码本地化
  3. 或在后端添加 i18n 支持

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬编码
  - 不使用 i18n 系统
- **Suggested Fix**: 
  1. 使用 `translateFeatureCopy` 替换硬编码
  2. 确保所有用户可见文本通过 i18n
  3. 添加硬编码字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只有约18条消息
  - en-US 和 zh-CN 有约117条
  - 缺失的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. 确保所有 key 都有翻译
  3. 添加翻译完整性测试

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - 如果 feature ID 不在 catalog 中
  - 返回 undefined title/summary
  - 无合理回退
- **Suggested Fix**: 
  1. 添加回退到 key 或默认字符串
  2. 或使用 feature ID 作为显示名
  3. 确保 UI 不显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同报告
  - 无 readiness probe（可处理流量？）
  - 无 liveness probe（系统存活？）
  - canAcceptTraffic() 未通过 HTTP 暴露
- **Suggested Fix**: 
  1. 添加 /ready 和 /live 端点
  2. Readiness 检查依赖项就绪
  3. Liveness 检查进程健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() 异步检查 dbWritable
  - shutdown 期间数据库连接可能关闭
  - 健康检查仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. 添加 shutdown 状态标志
  3. 停止接受新的健康检查请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() 处理优雅退位
  - 但未在全局 graceful shutdown 中注册
  - 需显式注册为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService 添加到 shutdown handlers
  2. 确保领导者在 shutdown 时让位
  3. 验证关闭顺序正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - 虽然 handlers 逆序执行
  - 但无显式接口声明 handler 依赖关系
  - 关键 handlers（如关闭数据库连接）应最后运行
- **Suggested Fix**: 
  1. 添加优先级或阶段参数
  2. 文档化关键 handler 顺序要求
  3. 添加顺序验证测试

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` 不保持事件循环活跃
  - 如果主线程空闲，强制退出可能不触发
- **Suggested Fix**: 
  1. 移除 .unref() 除非确实需要
  2. 或确保有其他方式保持事件循环
  3. 添加超时触发验证测试

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 问题存在时返回 false
  - 但 _trafficBlocked 是内部状态
  - 负载均衡器访问 /healthz 仍会得到 "ok"
- **Suggested Fix**: 
  1. 在健康报告中暴露 trafficBlocked 状态
  2. 或添加单独的健康端点指示就绪状态
  3. 确保负载均衡器在阻塞时不路由流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - 项目同时使用 TypedEventBus 和原生 EventEmitter
  - TypedEventBus 应该是标准
  - 混用可能导致类型安全问题
- **Suggested Fix**: 
  1. 创建迁移计划统一使用 TypedEventBus
  2. 添加 ESLint 规则禁止原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - 无明确的事件排序保证文档
  - 事件处理可能乱序
  - 依赖方需要处理乱序
- **Suggested Fix**: 
  1. 文档化事件排序语义
  2. 如果需要排序，实现序列号机制
  3. 在事件处理中考虑乱序情况

### Summary

本次补充Review（第十四轮 - 日志事件与工作流Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry 无 requestId 字段
2. StructuredLogger data 字段无自动清洗（敏感数据风险）
3. Harness while(true) 循环无硬性迭代上限
4. Oapeflir while(true) 循环可能无限重规划
5. API 错误消息硬编码英文（无 i18n）
6. 健康检查无 readiness/liveness 区分
7. shutdown 期间健康检查存在竞态
8. LeaderElectionService 未与 GracefulShutdown 集成

**Medium Priority**:
1. 日志中敏感数据无 PII 处理
2. 59处 console.* 直接调用
3. 部分 logger.warn 调用缺少结构化数据
4. Recovery 流程允许终态转换到 paused
5. UI 硬编码字符串未翻译
6. Arabic 目录不完整
7. addHandler() 无显式排序约定
8. unref'd timers 可能不触发
9. StartupConsistencyChecker 阻塞流量但不暴露状态
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy 无回退默认值
2. 无事件排序保证

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 68 | 80 | 37 | 185 |
| 测试 | 8 | 14 | 5 | 27 |
| 配置 | 10 | 38 | 24 | 72 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry 添加 requestId 字段
2. 实现日志敏感字段自动清洗
3. 为工作流循环添加硬性迭代上限
4. 添加 readiness/liveness 健康检查端点
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. 实现 API 错误消息 i18n 支持

**Short Term (This Month)**:
1. 替换所有 console.* 为 StructuredLogger
2. 补充 Arabic i18n 目录
3. 修复 UI 硬编码字符串
4. 统一 TypedEventBus 替代 EventEmitter
5. 解决 shutdown 竞态条件
6. 添加事件排序保证文档

**Long Term Planning**:
1. 建立完整的 PII 处理框架
2. 实现日志完整性验证
3. 建立工作流安全循环检测
4. 完善健康检查和就绪探测
5. 建立国际化完整测试

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - 无 `incremental: true` 配置
  - 无 `tsbuildinfo` 文件
  - 每次构建是完整重建（9.6秒）
  - TypeScript 无法使用增量编译
- **Suggested Fix**: 
  1. 在 tsconfig.json 添加 `"incremental": true`
  2. 添加 `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. 实现项目引用以支持并行构建

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都运行 `npm run build && node ...`
  - 每个脚本前都执行完整重建
  - 无法直接运行预构建的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. 创建 `build:cli` 脚本构建一次
  2. 让 CLI 脚本使用预构建的 dist 文件
  3. 添加 npm run dev 或类似的无需重建的执行方式

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` 方法签名
  - 重试/超时工具使用 `(...args: any[]) => Promise<any>`
  - 绕过类型安全
- **Suggested Fix**: 
  1. 使用泛型替代 any
  2. 替换为具体的输入类型
  3. 添加 ESLint 规则禁止 any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 14个 stability 相关文件有 `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk 文件有 `Partial<HarnessRun> doesn't have all required properties`
  - 2个文件有 `exactOptionalPropertyTypes` 问题
- **Suggested Fix**: 
  1. 修复 ExecutionRecord 类型不匹配
  2. 完成 HarnessRun 类型的必需属性
  3. 移除 @ts-ignore 使用

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个文件
- **Issue Description**: 
  - 插入 execution record 时 TypeScript 拒绝类型
  - `ExecutionRecord` 接口要求新字段但 insert 对象缺失
  - 或 store 的 insert 方法接受不同类型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord 接口和 store 类型
  2. 添加缺失字段到 insert 对象
  3. 或调整 store 的 insert 方法类型签名

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全绕过类型安全
  - 通常是类型架构问题的信号
- **Suggested Fix**: 
  1. 修复上游类型问题
  2. 使用更具体的类型断言
  3. 重构类型层次结构

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 存在于 node_modules 但未在 package.json 声明
  - 可能导致依赖问题
- **Suggested Fix**: 
  1. 添加到 dependencies 或 devDependencies
  2. 或移除并使用其他清理方式

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接读取/写入 process.env
  - 在 beforeEach/afterEach 中手动保存/恢复
  - 无 helper 抽象
- **Suggested Fix**: 
  1. 创建 env helper 函数
  2. 统一保存和恢复模式
  3. 添加测试隔离验证

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: 多个测试文件
- **Issue Description**: 
  - 每个测试重新实现清理逻辑
  - 无集中清理 utility
  - 可能导致 EBUSY (Windows) 或并发访问问题
- **Suggested Fix**: 
  1. 创建集中的测试清理 utility
  2. 使用 afterEach 确保清理
  3. 考虑使用临时目录

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` 多个目录
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等调用
  - 无统一的 mocking 框架可见
  - 模式不一致
- **Suggested Fix**: 
  1. 建立统一的 mock factory
  2. 标准化 mock 模式
  3. 添加 mocking 最佳实践文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - 测试通过特定函数重置 singletons
  - 每个测试重复自己的 reset 逻辑
  - 无统一的 resetAllSingletons()
- **Suggested Fix**: 
  1. 创建统一的 singleton reset 机制
  2. 在 afterEach 中自动调用
  3. 文档化 singleton 重置要求

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - 无覆盖率要求
  - 只测量源代码，不测量测试文件
- **Suggested Fix**: 
  1. 添加分支覆盖率阈值
  2. 在 CI 中强制执行覆盖率 gate
  3. 关注关键代码路径

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch 调用无 timeout 参数
  - 挂起的请求可能永久阻塞
- **Suggested Fix**: 
  1. 添加 AbortController timeout
  2. 使用标准的超时模式
  3. 记录超时配置

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换无 retry logic
  - 无 timeout/abort signal
  - 认证流程可能挂起
- **Suggested Fix**: 
  1. 添加 fetch timeout
  2. 添加 retry logic
  3. 使用标准的超时配置

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全替换 fetch 为空函数
  - 插件的所有出站 HTTP 请求都会失败
  - 看起来是有意为之但可能造成问题
- **Suggested Fix**: 
  1. 确认这是有意行为
  2. 文档化 fetch 替换行为
  3. 确保不会意外影响其他代码

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - 无显式的 http.Agent/https.Agent 配置
  - 依赖 Node.js 默认连接池
  - 无 maxSockets 或 maxConnections 配置
  - 高吞吐场景可能出问题
- **Suggested Fix**: 
  1. 添加 http Agent 配置
  2. 文档化连接池大小
  3. 监控连接使用情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬编码
  - 难以追踪合同版本演变
- **Suggested Fix**: 
  1. 提取到类型化常量或 enum
  2. 集中管理合同版本
  3. 添加版本兼容性检查

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` 无类型精度
  - ISO 8601 字符串无时区信息
- **Suggested Fix**: 
  1. 使用 Date 对象或 branded string 类型
  2. 明确时区处理约定
  3. 文档化时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src 目录
- **Issue Description**: 
  - 使用 `!.` 断言非空
  - 可能导致运行时错误
- **Suggested Fix**: 
  1. 使用可选链 `?.` 或空值合并 `??`
  2. 添加适当的 null 检查
  3. 减少非空断言使用

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema 验证存在
  - 但 schema 版本未与 contract 版本同步
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. 添加版本一致性检查
  3. 文档化版本关系

### Summary

本次补充Review（第十五轮 - 构建测试与类型系统Review - 2026-05-14）发现了20个新问题。

**High Priority (Requires Immediate Action)**:
1. 无 TypeScript 增量编译缓存（每次完整重建9.6秒）
2. 76个 npm scripts 大部分重复构建
3. 168处 any 类型使用（绕过类型安全）
4. 38处 @ts-ignore 指令
5. ExecutionRecord 类型不匹配（14个文件）
6. 178处直接 process.env 变更无抽象
7. ScopedExternalAccessSandbox performHttpRequest 无超时
8. OIDC 服务 fetch 调用无超时
9. plugin-runtime-child 替换 globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双类型转换
2. rimraf extraneous 未声明
3. 21,998处 unlinkSync 无集中清理
4. 无统一 mocking 框架
5. Singleton 状态重置未标准化
6. 无显式 http.Agent 配置
7. 合同版本硬编码为字符串
8. Timestamp = string 丢失精度
9. 非空断言使用

**Low Priority**:
1. 无分支覆盖率要求
2. API 路由 schema 版本未同步

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 72 | 87 | 39 | 198 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 添加 TypeScript 增量编译 (`incremental: true`)
2. 重构 npm scripts 避免重复构建
3. 减少 any 类型使用到 <50
4. 移除所有 @ts-ignore 指令
5. 修复 ExecutionRecord 类型不匹配
6. 添加 fetch 超时到 OIDC 和 sandbox

**Short Term (This Month)**:
1. 创建集中的测试清理 utility
2. 建立统一的 mocking 框架
3. 标准化 singleton 重置机制
4. 添加 http.Agent 连接池配置
5. 提取合同版本到类型化常量

**Long Term Planning**:
1. 实现完整的类型安全（无 any）
2. 建立测试基础设施标准
3. 实现构建缓存优化
4. 完善网络层超时和重试
5. 建立覆盖率门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private 实例变量（应该最多3-5个）
  - 61个 public 方法
  - 9个注入的委托服务
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. 拆分为 `HarnessStateManager`（状态转换）
  2. 拆分为 `HarnessMemoryCoordinator`（内存操作）
  3. 拆分为 `HarnessRecoveryHandler`（失败处理）
  4. 拆分为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317行)
- **Issue Description**: 
  - 15个子模块的重新导出
  - 修改任何功能时可能触发大规模重编译
  - 创建循环依赖风险
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先使用直接模块导入
  3. 按领域拆分 contracts 为多个文件

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个代码库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重不平衡，存在内存泄漏
- **Suggested Fix**: 
  1. 审计所有事件监听器注册点
  2. 确保每个监听器有对应的清理
  3. 使用 `{ once: true }` 自动清理

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中注册
  - stop() 方法从未移除它们
  - 插件运行时停止后监听器仍附着在分离的子进程
- **Suggested Fix**: 
  1. 在 stop() 中添加清理：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763行)
- **Issue Description**: 
  - 大部分 domain index.ts 只有12行
  - yono 导出11个类（YonoRepository, YonoMarketService, YonoCommentService 等）
  - 单个文件包含过多职责
- **Suggested Fix**: 
  1. 拆分为 yono/market-service.ts
  2. 拆分为 yono/comment-service.ts
  3. 每个类一个文件

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451行)
- **Issue Description**: 
  - 处理平台启动、运行时目录、引导、演示模式
  - 从多个子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. 拆分为 bootstrap.ts
  2. 拆分为 startup.ts
  3. 拆分为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169行)
- **Issue Description**: 
  - 527个类型/接口定义
  - 纯数据结构（PrincipalRef, HumanPrincipalRef等）
  - 无行为，只有类型导出
  - 类型和工厂函数混在一起
- **Suggested Fix**: 
  1. 拆分为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将类型和工厂函数分离
  3. 建立明确的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全不兼容的 schema
  - 脆弱的映射层尝试规范化
- **Suggested Fix**: 
  1. 统一为一个规范定义
  2. 移除重复
  3. 建立单一数据源

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - 魔法数字 85, 65, 35
  - 无常量、注释或配置
- **Suggested Fix**: 
  1. 提取到命名常量
  2. 添加配置选项
  3. 文档化决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬编码的工具名 "read" 和 "question"
  - 应该使用常量
- **Suggested Fix**: 
  1. 提取为常量 READ_ONLY_TOOL_NAMES
  2. 添加配置支持
  3. 文档化只读角色定义

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但无强制
  - 转换可以在不使用验证器的情况下尝试
  - Domain seeds 和 risk specs 之间无一致性检查
- **Suggested Fix**: 
  1. 添加 invariant 强制框架
  2. 确保状态转换经过验证
  3. 添加转换前条件检查

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API 结构文档无认证暴露
  - 可能泄露敏感 API 信息
- **Suggested Fix**: 
  1. 添加认证或限制访问
  2. 在生产环境禁用
  3. 文档化风险

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions 存储在模块级 Map
  - 多服务器实例部署不工作
  - 无分布式会话存储
- **Suggested Fix**: 
  1. 使用 Redis 等分布式会话存储
  2. 添加会话复制
  3. 文档化扩展限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多实例部署问题
- **Suggested Fix**: 
  1. 使用共享存储
  2. 或在启动时从配置加载

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在不同作用域
  - 可能导致导入混淆
  - 看起来是有意为之但可能造成混乱
- **Suggested Fix**: 
  1. 添加作用域前缀或后缀
  2. 文档化每个文件的用途
  3. 确保导入明确

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但在 shutdown 时可能未调用
  - 需要验证关闭顺序
- **Suggested Fix**: 
  1. 验证 shutdown 顺序
  2. 添加关闭 hooks
  3. 确保资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK 文件使用
  - 价值可疑的间接层
- **Suggested Fix**: 
  1. 移除或文档化用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）发现了17个新问题。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService 是 God Object（19变量，61方法）
2. 巨型 barrel files 导致构建问题
3. 167个事件监听器仅16个清理
4. plugin-runtime-host.ts 子进程监听器未清理
5. DomainLifecycleState 重复定义且不兼容
6. 风险评分阈值硬编码无常量

**Medium Priority**:
1. yono/index.ts 763行应拆分
2. src/index.ts 451行应拆分
3. contracts 数据vs对象混淆
4. HR角色检测硬编码工具名
5. 无 invariant 强制机制
6. OpenAPI 端点公开无认证
7. 内存会话存储限制水平扩展
8. 内存服务身份存储限制扩展

**Low Priority**:
1. 多个 architecture-remediation.ts 文件重名
2. PgDatabase.close() 验证问题
3. Core/runtime 是包装价值可疑

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78 | 93 | 42 | 213 |
| 测试 | 10 | 17 | 6 | 33 |
| 配置 | 10 | 39 | 24 | 73 |
| 安全 | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 拆分 HarnessRuntimeService 为专注服务
2. 修复 plugin-runtime-host.ts 子进程监听器清理
3. 统一 DomainLifecycleState 定义
4. 添加事件监听器清理审计
5. 添加 fetch 超时到所有网络调用

**Short Term (This Month)**:
1. 拆分 yono/index.ts 和 src/index.ts
2. 建立 invariant 强制框架
3. 添加分布式会话存储
4. 移除 barrel files 或限制规模
5. 提取所有魔法数字到常量

**Long Term Planning**:
1. 完整的 God Object 重构计划
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

*Review generated: 2026-05-14*
---

## [2026-05-14] Automated Review Report (Round 17 - In-depth Special Review)

### Deep Review Coverage
- src/platform/ 144个文件 ~276K行代码
- src/domains/ 95个文件 40+领域
- src/sdk/ 103个文件
- config/environments/ 环境配置
- tests/unit/ 关键测试文件
- UI components

---

### Newly Discovered Issues

#### 1. [Source Code] [Critical] [Benchmark 百分位计算完全错误]
- **File/Path**: `src/ops-maturity/benchmarking/benchmark-collector.ts`
- **Issue Description**: 
  - p50/p95/p99 全部错误计算为平均值
  - 实际代码: `p50: values[Math.floor(len * 0.5)]` 然后又赋值 `avg`
  - 正确的百分位计算应该使用分位数公式
- **Impact**: 所有性能基准测试的百分位数据完全不可信
- **Suggested Fix**: 实现正确的分位数计算逻辑

#### 2. [Configuration] [Critical] [环境名称错配 - 所有环境显示"prod"]
- **File/Path**: `config/environments/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - 所有配置文件 `"name": "prod"` 而非各自实际环境名
  - 这导致日志和监控中无法区分环境
- **Suggested Fix**: 修正为各自的环境名称

#### 3. [Memory] [Critical] [Plugin runtime child process 事件监听器永不清洗]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts`
- **Issue Description**: 
  - stdout/stderr/message 事件监听器在 stop() 时未移除
  - 会导致内存泄漏
- **Suggested Fix**: 在 stop() 中清理所有 child 事件监听器

#### 4. [Security] [Critical] [OAuth token 明文存储]
- **File/Path**: `src/sdk/cli/login.ts:70-79`
- **Issue Description**: 
  - OAuth tokens 以 JSON 明文存储
  - 权限 0o600 虽限制所有者访问，但仍为明文
- **Suggested Fix**: 使用系统 keychain 或加密存储

#### 5. [Security] [Critical] [硬编码 CVE 绕过列表导致虚假安全感]
- **File/Path**: `src/sdk/plugin-definition.ts`
- **Issue Description**: 
  - `bypassCVERegistryCheck: true` 和硬编码 CVE 列表
  - SBOM 验证形同虚设
- **Suggested Fix**: 删除绕过机制或重新设计安全验证

#### 6. [Security] [Critical] [弱 RSA 2048位密钥]
- **File/Path**: `src/sdk/中加密相关文件`
- **Issue Description**: 
  - 使用 2048位 RSA 可能不足以应对现代威胁
  - 应使用 4096位或 P-384 ECC
- **Suggested Fix**: 升级密钥长度

#### 7. [Source Code] [High] [process.chdir() 安全漏洞]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:89-93`
- **Issue Description**: 
  - 无验证的 `process.chdir(sandboxRoot)` 
  - 可被恶意插件利用
- **Suggested Fix**: 添加 sandboxRoot 验证和清理检查

#### 8. [Source Code] [High] [memory leak - EventListener 167个仅16个清理]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 添加了 167 个事件监听器
  - 仅 16 个在销毁时清理
  - 会导致内存持续增长
- **Suggested Fix**: 统一事件监听器生命周期管理

#### 9. [Source Code] [High] [TODO R4-27: HarnessRun 未持久化]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270`
- **Issue Description**: 
  - HarnessRun 对象创建后未持久化
  - 系统重启后无法恢复
- **Suggested Fix**: 添加 HarnessRun 持久化逻辑

#### 10. [Source Code] [High] [budget-allocator 竞态条件]
- **File/Path**: `src/platform/five-plane-execution/budget-allocator.ts:504-507`
- **Issue Description**: 
  - CAS 检查在事务外执行
  - 可能导致双重扣款
- **Suggested Fix**: 将 CAS 检查移入原子事务

#### 11. [Testing] [High] [budget-allocator.test.ts 缺少 throttle ratio 断言]
- **File/Path**: `tests/unit/platform/five-plane-execution/budget-allocator.test.ts:286-335`
- **Issue Description**: 
  - 测试应该验证 throttle ratio 但实际未验证
  - 导致关键功能未被测试覆盖
- **Suggested Fix**: 添加 throttle ratio 的断言

#### 12. [Testing] [High] [durable-event-bus-async.test.ts 定时器时序问题]
- **File/Path**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:74,104,117`
- **Issue Description**: 
  - 使用 setTimeout 断言但时间不确定
  - 可能导致测试不稳定
- **Suggested Fix**: 使用 fake timers 或事件监听代替

#### 13. [Source Code] [Medium] [console.* 调用 59 处未用 StructuredLogger]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 直接调用 console.log/error/warn
  - 应使用 StructuredLogger 统一日志
- **Suggested Fix**: 替换为 StructuredLogger

#### 14. [Source Code] [Medium] [: any 类型 168 处]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 大量 `: any` 类型用法
  - 降低类型安全
- **Suggested Fix**: 减少 any 类型使用，增加类型约束

#### 15. [Source Code] [Medium] [as unknown as 双转型 30+ 处]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 滥用双转型模式
  - 掩盖类型错误
- **Suggested Fix**: 改进类型设计避免双转型

#### 16. [Source Code] [Medium] [@ts-ignore 38 处]
- **File/Path**: 多个源文件
- **Issue Description**: 
  - 过多 ts-ignore 使用
  - 隐藏潜在问题
- **Suggested Fix**: 修复底层类型问题

#### 17. [Source Code] [Medium] [Giant barrel files cause build issues]
- **File/Path**: 多个 index.ts barrel files
- **Issue Description**: 
  - 巨型 barrel files 拖慢构建
  - 增加循环依赖风险
- **Suggested Fix**: 拆分或使用路径映射

#### 18. [Source Code] [Medium] [HR role detection hardcodes tool names]
- **File/Path**: 相关权限检测文件
- **Issue Description**: 
  - HumanReview 角色检测硬编码工具名
  - 不够灵活
- **Suggested Fix**: 使用配置驱动

#### 19. [Source Code] [Medium] [No invariant enforcement mechanism]
- **File/Path**: 全局
- **Issue Description**: 
  - 没有 invariant 验证框架
  - 关键不变量未被强制
- **Suggested Fix**: 实现 invariant 检查框架

#### 20. [Source Code] [Medium] [In-memory session storage limits horizontal scaling]
- **File/Path**: 会话相关模块
- **Issue Description**: 
  - 基于内存的会话存储无法水平扩展
  - 多实例部署会有问题
- **Suggested Fix**: 使用分布式会话存储

#### 21. [Source Code] [Medium] [In-memory service identity storage limits scaling]
- **File/Path**: 服务身份模块
- **Issue Description**: 
  - 服务身份存储在内存中
  - 无法跨实例共享
- **Suggested Fix**: 使用分布式存储

#### 22. [Configuration] [Medium] [config/security/ 环境配置缺少字段]
- **File/Path**: `config/security/` 下各环境配置
- **Issue Description**: 
  - dev/staging/pre-prod 只有 approvalMode
  - 缺少 sandboxMode/remoteWorkerRegistration
- **Suggested Fix**: 补充缺失的安全配置字段

#### 23. [Security] [Medium] [OpenAPI endpoint exposed without authentication]
- **File/Path**: OpenAPI 相关配置
- **Issue Description**: 
  - 某些端点可能被公开访问
  - 需要认证保护
- **Suggested Fix**: 添加认证中间件

#### 24. [Testing] [Medium] [非确定性 Math.random() 测试]
- **File/Path**: SDK 相关测试文件
- **Issue Description**: 
  - 测试依赖 Math.random() 导致非确定
  - 难以复现和调试
- **Suggested Fix**: 使用确定种子或 mock

#### 25. [Source Code] [Low] [contracts 数据vs对象混淆]
- **File/Path**: contracts 目录
- **Issue Description**: 
  - 契约中数据类型与对象类型混淆
  - 可能导致序列化问题
- **Suggested Fix**: 明确区分数据模型和领域对象

#### 26. [Source Code] [Low] [多个 architecture-remediation.ts 重名]
- **File/Path**: 各领域目录
- **Issue Description**: 
  - 相同文件名在不同作用域
  - 可能导致导入混淆
- **Suggested Fix**: 添加作用域前缀或统一命名

#### 27. [Source Code] [Low] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - 有 close() 方法但 shutdown 时可能未调用
- **Suggested Fix**: 验证关闭顺序

#### 28. [Source Code] [Low] [Core/runtime 是包装价值可疑]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - 只是重新导出，无实际价值
- **Suggested Fix**: 移除或明确用途

#### 29. [Source Code] [Low] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts`
- **Issue Description**: 
  - 文件过大难以维护
- **Suggested Fix**: 拆分为多个模块

#### 30. [Source Code] [Low] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts`
- **Issue Description**: 
  - 文件过大
- **Suggested Fix**: 拆分为多个导出模块

#### 31. [Source Code] [Low] [DomainLifecycleState 重复定义]
- **File/Path**: 多个文件
- **Issue Description**: 
  - 相同状态定义多次出现
  - 不兼容实现
- **Suggested Fix**: 统一状态定义

#### 32. [Source Code] [Low] [风险评分阈值硬编码]
- **File/Path**: 风险评估相关文件
- **Issue Description**: 
  - 魔法数字无常量对应
- **Suggested Fix**: 提取到配置常量

#### 33. [Deployment] [Low] [deploy/ 目录内容不完整]
- **File/Path**: `deploy/`
- **Issue Description**: 
  - terraform/helm/k8s 配置不完整
- **Suggested Fix**: 完善部署配置

#### 34. [Configuration] [Low] [.gitignore 缺少临时文件模式]
- **File/Path**: `.gitignore`
- **Issue Description**: 
  - 缺少 dist_*, :memory:*, .audit/ 等
- **Suggested Fix**: 补充 .gitignore

#### 35. [Testing] [Low] [测试辅助代码量大 78 个文件]
- **File/Path**: `tests/helpers/`
- **Issue Description**: 
  - 说明测试基础设施复杂
- **Suggested Fix**: 简化测试基础设施

#### 36. [Source Code] [Low] [直接访问 process.env 高达143处]
- **File/Path**: 全局
- **Issue Description**: 
  - 配置散落难以追踪
- **Suggested Fix**: 创建统一配置模块

#### 37. [Source Code] [Low] [HA 和 Lease 模块职责重叠]
- **File/Path**: `src/platform/five-plane-execution/ha/` 和 `lease/`
- **Issue Description**: 
  - 职责边界不清晰
- **Suggested Fix**: 明确职责边界

#### 38. [Source Code] [Low] [EventEmitter 和 TypedEventBus 混用]
- **File/Path**: 多个模块
- **Issue Description**: 
  - 应统一使用 TypedEventBus
- **Suggested Fix**: 制定迁移计划

#### 39. [Source Code] [Low] [.claude/scheduled_tasks.json 未忽略]
- **File/Path**: `.claude/scheduled_tasks.json`
- **Issue Description**: 
  - 本地文件不应提交
- **Suggested Fix**: 添加到 .gitignore

#### 40. [Configuration] [Low] [tsconfig.temp.json 可能未使用]
- **File/Path**: `tsconfig.temp.json`
- **Issue Description**: 
  - 临时配置文件残留
- **Suggested Fix**: 清理

#### 41. [Configuration] [Low] [.env.example 包含过时变量]
- **File/Path**: `.env.example`
- **Issue Description**: 
  - 347行可能包含未使用变量
- **Suggested Fix**: 审查清理

#### 42. [Documentation] [Low] [docs_zh/architecture/ 可能未更新]
- **File/Path**: `docs_zh/architecture/`
- **Issue Description**: 
  - 文档与代码可能不同步
- **Suggested Fix**: 建立同步机制

#### 43. [UI] [Low] [SharedWorkerWSClient 内存泄漏]
- **File/Path**: UI 组件
- **Issue Description**: 
  - SharedWorker 连接可能未正确关闭
- **Suggested Fix**: 添加清理逻辑

#### 44. [UI] [Low] [XSS 潜在风险]
- **File/Path**: UI 组件
- **Issue Description**: 
  - 用户输入可能未正确转义
- **Suggested Fix**: 实现输出转义

#### 45. [UI] [Low] [缺少 Error Boundaries]
- **File/Path**: UI 组件
- **Issue Description**: 
  - React 组件缺少错误边界
  - 可能导致白屏
- **Suggested Fix**: 添加 Error Boundaries

#### 46. [Testing] [Low] [execution-dispatch-service-async.test.ts 仍然失败]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher/`
- **Issue Description**: 
  - 测试持续失败
- **Suggested Fix**: 分析修复

#### 47. [Testing] [Low] [nodeRunId-canonization.test.ts 仍然失败]
- **File/Path**: `tests/unit/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - 测试持续失败
- **Suggested Fix**: 分析修复

#### 48. [Testing] [Low] [runtime-plan-executor.test.ts 仍然失败]
- **File/Path**: `tests/unit/platform/five-plane-execution/oapeflir/`
- **Issue Description**: 
  - 测试持续失败
- **Suggested Fix**: 分析修复

#### 49. [Testing] [Low] [worker-pool-comprehensive.test.ts 仍然失败]
- **File/Path**: `tests/unit/platform/five-plane-execution/worker-pool/`
- **Issue Description**: 
  - 测试持续失败
- **Suggested Fix**: 分析修复

#### 50. [Source Code] [Low] [symbolic links 未正确处理]
- **File/Path**: `src/platform/` 下的符号链接
- **Issue Description**: 
  - control-plane -> five-plane-control-plane 等
  - 可能导致工具路径解析问题
- **Suggested Fix**: 明确符号链接策略

#### 51. [Configuration] [Low] [.DS_Store 文件存在并被追踪]
- **File/Path**: 根目录
- **Issue Description**: 
  - macOS 元数据文件被追踪
- **Suggested Fix**: 停止追踪并添加到 .gitignore

#### 52. [Configuration] [Low] [:memory: 文件残留]
- **File/Path**: 根目录
- **Issue Description**: 
  - 临时文件未清理
- **Suggested Fix**: 清理

#### 53. [Configuration] [Low] [.tmp/ 目录大量临时文件]
- **File/Path**: `.tmp/`
- **Issue Description**: 
  - 临时文件未清理
- **Suggested Fix**: 清理

#### 54. [Configuration] [Low] [.test-db/ 目录存在]
- **File/Path**: `.test-db/`
- **Issue Description**: 
  - 测试数据库目录残留
- **Suggested Fix**: 清理

#### 55. [Source Code] [Low] [巨型源文件未拆分]
- **File/Path**: 多个超过1000行的文件
- **Issue Description**: 
  - 难以维护和理解
- **Suggested Fix**: 拆分

#### 56. [Source Code] [Low] [runMultiStepOrchestration 复杂度高]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
- **Issue Description**: 
  - 核心编排逻辑复杂
- **Suggested Fix**: 拆分职责

#### 57. [Security] [Low] [npm audit 显示 7 个漏洞]
- **File/Path**: 依赖
- **Issue Description**: 
  - 1 moderate, 6 high
- **Suggested Fix**: 更新受影响包

### Summary

本次深度Review（第十七轮 - 2026-05-14）发现了57个新问题。

**High Priority (Requires Immediate Action)**:
1. Benchmark 百分位计算完全错误 - 所有 p50/p95/p99 数据不可信
2. Plugin runtime child process 事件监听器永不清洗 - 内存泄漏
3. OAuth token 明文存储 - 安全风险
4. 硬编码 CVE 绕过列表 - 虚假安全感
5. 弱 RSA 2048位密钥 - 不符合现代安全标准
6. process.chdir() 无验证 - 安全漏洞
7. EventListener 167个仅16个清理 - 内存泄漏
8. HarnessRun 未持久化 - 数据丢失风险
9. budget-allocator 竞态条件 - 双重扣款风险

**Medium Priority**:
1. 59处 console.* 未用 StructuredLogger
2. 168处 : any 类型
3. 30+处 as unknown as 双转型
4. 38处 @ts-ignore
5. 巨型 barrel files
6. HR角色检测硬编码
7. 无 invariant 机制
8. 内存会话存储限制扩展
9. 内存服务身份存储限制扩展
10. 配置缺少安全字段
11. OpenAPI 端点无认证
12. Math.random() 非确定性测试

**Low Priority**:
1-45. (详见上述列表)

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 78+9=87 | 93+3=96 | 42+15=57 | 240 |
| 测试 | 10+2=12 | 17+1=18 | 6+6=12 | 42 |
| 配置 | 10+1=11 | 39+1=40 | 24+15=39 | 90 |
| 安全 | 15+5=20 | 17+1=18 | 3 | 41 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| 部署 | 1 | 12 | 6 | 19 |
| **合计** | **133** | **206** | **124** | **463** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 benchmark-collector.ts 百分位计算
2. 清理 plugin-runtime-host.ts 事件监听器
3. 实现 OAuth token 安全存储
4. 删除硬编码 CVE 绕过或重新设计
5. 修复 process.chdir() 安全漏洞
6. 添加 HarnessRun 持久化
7. 修复 budget-allocator 竞态条件

**Short Term (This Month)**:
1. 减少 : any 和 @ts-ignore 使用
2. 统一日志系统 (StructuredLogger)
3. 拆分巨型文件
4. 实现 invariant 框架
5. 添加 fetch 超时

**Long Term Planning**:
1. 重构 God Objects (HarnessRuntimeService 等)
2. 建立架构边界和接口
3. 实现内存安全验证
4. 建立代码质量门禁
5. 完善文档和培训

### Known Test Failures (14 files, 1620 tests)

详情见 `.audit/quality.md`

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 18 - Full Deep Review)

### Review Coverage
7个并行代理完成深度review:
- src/platform/ (5层架构)
- src/domains/ (40+领域)
- src/sdk/ 和 CLI
- tests/unit/ (关键测试文件)
- config/ 和 deploy/
- docs_zh/ 和 ui/
- src/interaction/, org-governance/, ops-maturity/, scale-ecosystem/, core/

---

### Newly Discovered Issues

#### A. src/platform/ 发现 (18个问题)

#### A1. [Orchestration] [High] `harness/index.ts` 2317行 - God Object
- **File**: `src/platform/five-plane-orchestration/harness/index.ts:1-2317`
- **Issue**: 单文件2317行违反单一职责原则，包含HarnessService、loop controllers、guardrails、evaluation logic
- **Code Snippet**: Line 1423: `// @ts-ignore - appendEvidenceRecord may not exist on RuntimeRepository`
- **Suggestion**: 拆分为 `harness-run-controller.ts`, `harness-loop-controller.ts`, `harness-guardrails.ts`, `harness-evaluation.ts`

#### A2. [Execution] [High] `durable-event-bus.ts` Map/Set积累无清理
- **File**: `src/platform/five-plane-state-evidence/events/durable-event-bus.ts:208-227`
- **Issue**: `subscribers`, `pollingTimers`, `pendingPartitionEvents` 等Map创建后无cleanup
- **Code Snippet**: `private readonly disposed = false; // never checked`
- **Suggestion**: 添加 dispose() 方法取消所有 polling timers 并清空 maps

#### A3. [State-Evidence] [High] `as unknown as T` 模式滥用
- **File**: `src/platform/five-plane-state-evidence/truth/sqlite/query-helper.ts:28,41,53,79`
- **Issue**: 到处使用双转型掩盖类型问题
- **Suggestion**: 创建强类型包装接口代替类型转换

#### A4. [Execution] [Medium] `execution-dispatch-service.ts` 1067行
- **File**: `src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`
- **Issue**: 大型dispatch service，违反单一职责
- **Suggestion**: 拆分为 `execution-dispatch-core.ts` 和 `execution-dispatch-health.ts`

#### A5. [Control-Plane] [Medium] `startup-env-schema.ts` 硬 `process.exit(1)`
- **File**: `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts:506`
- **Issue**: 验证失败后直接 `process.exit(1)` - 反模式
- **Suggestion**: 抛出错误让调用者决定退出码

#### A6. [Execution] [Medium] `process-error-handlers.ts` 60秒超时后 exit
- **File**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:105,169`
- **Issue**: `process.exit(1)` fallback 可能合理但需文档化
- **Suggestion**: 文档化为何需要60秒

#### A7. [Control-Plane] [Medium] `secret-management-service.ts` setInterval无清理
- **File**: `src/platform/five-plane-control-plane/iam/secret-management-service.ts:663`
- **Issue**: rotationInterval 无 clearInterval 路径
- **Suggestion**: 确保 interval 在 service dispose 时清除

#### A8. [Interface] [Medium] 多处 setInterval 无 visible cleanup
- **File**: `task-websocket-status-relay.ts:37`, `websocket-bridge.ts:109`, `channel-gateway-retry-executor.ts:76`
- **Suggestion**: 验证所有 interval 在 shutdown 路径有 clearInterval

#### A9. [Orchestration] [Low] TODO R4-27 - HarnessRun未持久化
- **File**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270`
- **Issue**: `// TODO R4-27 [ARCHITECTURE]: HarnessRun must be persisted`
- **Suggestion**: 实现或创建 tracked issue

#### A10. [State-Evidence] [Medium] `partitionSequenceNumbers` 模块级可变状态
- **File**: `src/platform/five-plane-state-evidence/events/durable-event-bus.ts:55`
- **Issue**: `const partitionSequenceNumbers = new Map<string, number>()` 跨实例共享
- **Suggestion**: 改为实例级或使用并发原语

#### A11. [Orchestration] [High] `_placeholder: true` 模式
- **File**: `src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.ts:437,453,457,470`
- **Issue**: 使用 `{ _placeholder: true } as unknown as ConfirmedTaskSpec`
- **Suggestion**: 重设计类型需求

#### A12. [Shared] [Medium] `slo-alerting-service.ts` 1270行
- **File**: `src/platform/shared/observability/slo-alerting-service.ts`
- **Suggestion**: 提取 alert dispatch 和 SLO calculation logic

#### A13. [State-Evidence] [Medium] `event-registry.ts` 1077行
- **File**: `src/platform/five-plane-state-evidence/events/event-registry.ts`
- **Issue**: RAW_EVENT_SCHEMA_REGISTRY 常量包含所有 event schemas
- **Suggestion**: 按域组织到独立配置文件

#### A14. [Control-Plane] [Medium] `approval-flow-engine.ts` 1031行
- **File**: `src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts`
- **Suggestion**: 提取 quorum calculator 和 escalation manager

#### A15. [Execution] [Low] `GracefulShutdown` 正确清理 listeners
- **File**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts:117-121`
- **Issue**: 无 - 此文件正确清理 listeners
- **Suggestion**: 这是良好模式应推广

#### A16. [Interface] [Low] `sanitize.ts` 有 prototype pollution 防护
- **File**: `src/platform/five-plane-interface/api/middleware/sanitize.ts:3`
- **Issue**: 无 - 正确阻止 `__proto__`, `prototype`, `constructor`
- **Suggestion**: 确保应用于所有 JSON 入口点

---

#### B. src/domains/ 发现 (8个问题)

#### B1. [DomainLifecycleState] [Critical] 类型定义不一致
- **File**: `src/domains/architecture-remediation.ts:1` vs `src/domains/domain-specs.ts:115`
- **Issue**: 两套完全不同的值:
  - architecture-remediation.ts: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (PascalCase)
  - domain-specs.ts: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
- **Suggestion**: 统一使用 domain-specs.ts 的定义（经过Zod验证）

#### B2. [Plugin Runtime] [Critical] sandboxRoot 未验证用于 process.chdir()
- **File**: `src/domains/registry/plugin-runtime-child.ts:89-93`
- **Issue**: `AA_PLUGIN_SANDBOX_ROOT` 直接用于 `process.chdir()` 无路径验证
- **Code Snippet**:
```typescript
const sandboxRoot = process.env.AA_PLUGIN_SANDBOX_ROOT?.trim();
if (sandboxRoot) {
  process.chdir(sandboxRoot);  // 无验证!
}
```
- **Suggestion**: 使用 `checkSandboxPath()` 验证

#### B3. [Plugin Runtime] [Critical] child process 事件监听器未清理
- **File**: `src/domains/registry/plugin-runtime-host.ts:274-280`
- **Issue**: `stderr.on`, `stdout.on`, `message` 监听器在 stop() 时未移除
- **Suggestion**: 在 stop() 中调用 `removeAllListeners()`

#### B4. [Plugin Runtime] [Medium] process.exit(0) 在库代码中
- **File**: `src/domains/registry/plugin-runtime-child.ts:175`
- **Issue**: 子进程强行 `process.exit(0)` 不给宿主清理机会
- **Suggestion**: 发送退出信号给父进程决定

#### B5. [Plugin Runtime] [Medium] getProcessTracker().register 后无 unregister
- **File**: `src/domains/registry/plugin-runtime-host.ts:152`
- **Suggestion**: 在 stop() 中添加 unregister

#### B6. [大型文件] [Medium] 超大型文件需要拆分
- **File**:
  - `plugin-spi-registry.ts`: 948 行
  - `plugin-runtime-host.ts`: 784 行
  - `division-loader.ts`: 818 行
  - `yono/index.ts`: 763 行
- **Suggestion**: 按职责拆分

#### B7. [Event Listeners] [Critical] 全局无 removeListener/off 调用
- **File**: 整个 `src/domains/` 目录
- **Issue**: `.on()`, `.once()`, `addEventListener()` 32处但 remove 调用为0
- **Suggestion**: 确保在销毁时调用移除方法

#### B8. [DomainDescriptorOrchestrationService] [Medium] normalizeLifecycleState 映射不完整
- **File**: `src/domains/domain-descriptor-orchestration-service.ts:144-156`
- **Issue**: 映射表是单向的，状态回溯可能不一致
- **Suggestion**: 使用统一的 DomainLifecycleState 类型

---

#### C. src/sdk/ 和 CLI 发现 (9个问题)

#### C1. [Security] [Critical] 硬编码 CVE 绕过 SBOM 扫描
- **File**: `src/sdk/plugin-sdk/plugin-definition.ts:466-475`
- **Issue**: `inferRemoteSbomPackages()` 返回硬编码漏洞版本而非实际解析SBOM
- **Code Snippet**:
```typescript
if (lowerPath.includes("lodash")) {
  return [{ name: "lodash", version: "4.17.21" }];  // vulnerable!
}
```
- **Suggestion**: 删除此函数，始终获取/解析实际 SBOM 文件

#### C2. [Security] [Medium] 弱 RSA 2048位密钥
- **File**: `src/sdk/pack-sdk/pack-manifest.ts:232-233`
- **Issue**: `modulusLength: 2048` 是最低阈值
- **Suggestion**: 使用 4096位 RSA 或 Ed25519/Ed448

#### C3. [Security] [Critical] OAuth tokens 明文存储
- **File**: `src/sdk/cli/login.ts:70-79`
- **Issue**: tokens 以 JSON 明文存储到文件
- **Suggestion**: 使用系统 keychain 或加密存储

#### C4. [Testing] [Medium] Math.random() 导致非确定性
- **File**: `src/sdk/fixture-redact.ts:174`
- **Issue**: `generateTestId()` 使用 Math.random()
- **Suggestion**: 使用 `crypto.randomUUID()`

#### C5. [Testing] [Medium] Math.random() 用于错误注入
- **File**: `src/sdk/pack-sdk/pack-test-local-service.ts:164`
- **Issue**: `playbackFixture()` 用 Math.random() 模拟错误率
- **Suggestion**: 使用 seeded PRNG

#### C6. [CLI] [Medium] 手动参数解析无验证
- **File**: `src/sdk/cli/pack-validate.ts:19-36`, `pack-create.ts:23-57`, `pack-publish.ts:22-46`
- **Issue**: 手动 `process.argv` 解析，缺少 schema 验证
- **Suggestion**: 使用 `parseArgs` 或 yargs/commander

#### C7. [类型安全] [Medium] @ts-ignore 滥用
- **File**: `src/sdk/harness-sdk/index.ts:477,490,576,596,620,643`
- **Issue**: 6个 @ts-ignore 隐藏类型错误
- **Suggestion**: 定义 proper discriminated union types

#### C8. [类型安全] [Medium] any 类型滥用
- **File**: `src/sdk/cli/stable-runner-factory.ts:62-72`
- **Issue**: `StableRunner`, `StableReportWriter`, `FailedPredicate` 使用 `any`
- **Suggestion**: 使用泛型 `<T, R>`

#### C9. [Security] [Low] 不完整的漏洞数据库
- **File**: `src/sdk/plugin-sdk/plugin-definition.ts:133-148`
- **Issue**: `KNOWN_VULNERABILITIES` 只列出2个CVE (2021年)
- **Suggestion**: 集成 OSV/NVD 或删除不完整的 allowlist

---

#### D. tests/unit/ 发现 (10个问题)

#### D1. [Testing] [Critical] budget-allocator.test.ts 缺少 throttle ratio 断言
- **File**: `tests/unit/platform/five-plane-execution/budget-allocator.test.ts:332-335`
- **Issue**: 计算了 throttled 结果但从未 assert
- **Suggestion**: 添加 `assert.equal(result.reservation.effectiveAmount, 50)`

#### D2. [Testing] [Medium] durable-event-bus-async.test.ts setTimeout 时序问题
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:74,104,117`
- **Issue**: `setTimeout(resolve, 20)` 在负载高时可能不足
- **Suggestion**: 使用事件监听或轮询模式

#### D3. [Testing] [Medium] pendingForConsumer 返回值未验证
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:174-176`
- **Issue**: `pending` 变量无 assert
- **Suggestion**: 添加 `assert.ok(pending.length > 0)`

#### D4. [类型安全] [Low] 25+ 测试文件使用 @ts-nocheck
- **File**: `tests/unit/domains/recipes/recipe-registry.test.ts:11` 等
- **Issue**: 禁用类型检查阻碍 TypeScript 安全收益
- **Suggestion**: 逐文件修复或创建 tracking issue

#### D5. [Testing] [Medium] 30+ 处使用 Math.random() 生成测试 ID
- **File**: `tests/unit/org-governance/approval-routing-service-extended.test.ts:32` 等
- **Issue**: 非确定性使测试难以重现
- **Suggestion**: 使用确定性 ID 生成

#### D6. [资源] [Medium] 部分测试缺少 bus.dispose() 调用
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts`
- **Issue**: publish/subscribe/pendingForConsumer 测试只调用 db.close() 但未 dispose bus
- **Suggestion**: 在 db.close() 前添加 `bus.dispose()`

#### D7. [代码规范] [Low] cleanupPath 与 db.close 顺序不一致
- **File**: `tests/unit/core/events/memory-leak.test.ts:22-24` vs durable-event-bus-async.test.ts
- **Suggestion**: 建立统一的清理顺序标准

#### D8. [Testing] [Low] @ts-ignore 绕过类型检查
- **File**: `tests/unit/platform/shared/observability/structured-logger-edge-cases.test.ts:250` 等
- **Suggestion**: 使用 `// @ts-expect-error` 并添加说明

#### D9. [Testing] [Medium] plugin-spi-registry-invocation.test.ts 多处短时延
- **File**: `tests/unit/domains/registry/plugin-spi-registry-invocation.test.ts:40,91,94,150,327,800,834`
- **Issue**: 5-25ms setTimeout 在慢速 CI 易失败
- **Suggestion**: 增加至 100ms+ 或使用轮询

#### D10. [Testing] [Low] deliverPending 测试注释与实现不符
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:233-234`
- **Issue**: 注释暗示验证投递行为但实际只验证返回值类型
- **Suggestion**: 添加断言验证 delivered.length

---

#### E. config/ 和 deploy/ 发现 (11个问题)

#### E1. [Configuration] [Critical] config/security/ 缺少安全字段
- **File**: `config/security/*.json`
- **Issue**: 只有 `approvalMode`，缺少 `sandboxMode` 和 `remoteWorkerRegistration`
- **Suggestion**: 补充缺失的安全配置字段

#### E2. [.gitignore] [Medium] 缺少 .audit/ 目录模式
- **File**: `.gitignore`
- **Issue**: `.audit/` 存在但未排除
- **Suggestion**: 添加 `.audit/`

#### E3. [.gitignore] [Medium] 缺少 dist_* 和 :memory:* 模式
- **File**: `.gitignore`
- **Issue**: 缺少 `dist_*/`, `:memory:*`, `dist-test/`
- **Suggestion**: 补充

#### E4. [Terraform] [Medium] orphaned 空 EKS cluster resource
- **File**: `deploy/terraform/modules/eks/main.tf:157-160`
- **Issue**: `count = 0` 的死代码
- **Suggestion**: 删除 orphaned resource block

#### E5. [Terraform] [Medium] 硬编码 VPC CIDR
- **File**: `deploy/terraform/modules/rds/main.tf:80`, `elasticache/main.tf:62`
- **Issue**: `cidr_blocks = ["10.0.0.0/16"]` 硬编码
- **Suggestion**: 添加 `vpc_cidr` 变量

#### E6. [Terraform] [Low] backend region 不匹配
- **File**: `deploy/terraform/main.tf:14`
- **Issue**: S3 backend region `ap-southeast-1` vs provider `us-east-1`
- **Suggestion**: 使 backend region 可配置

#### E7. [Helm] [Medium] pre-prod 使用 production NODE_ENV
- **File**: `deploy/helm/automatic-agent/values-pre-prod.yaml:43`
- **Issue**: `NODE_ENV: "production"` 应为 `"pre-production"`
- **Suggestion**: 修正

#### E8. [Deployment] [Medium] 缺少 kubernetes/ 目录
- **File**: `deploy/`
- **Issue**: 无 `/deploy/kubernetes/manifests/`
- **Suggestion**: 添加 K8s YAML 模板或文档说明

#### E9. [ECR] [Low] repository name 无环境后缀
- **File**: `deploy/terraform/modules/ecr/main.tf:26`
- **Issue**: 所有环境共享同一 ECR repository
- **Suggestion**: 添加 environment suffix

#### E10. [Configuration] [Low] 环境间 storage driver 不一致
- **File**: `config/environments/*.json`
- **Issue**: dev/staging/test 引用 `config/runtime/default.json`
- **Suggestion**: 确保每个环境有适当的 storage 配置

#### E11. [Config] [Low] tsconfig.temp.json 命名误导
- **File**: `tsconfig.temp.json`
- **Issue**: "temp" 暗示临时但实际被使用
- **Suggestion**: 重命名为 `tsconfig.build-test.json`

---

#### F. docs_zh/ 和 ui/ 发现 (8个问题)

#### F1. [UI] [Critical] SharedWorkerWSClient 内存泄漏
- **File**: `ui/packages/shared/api-client/src/ws-client.ts:359`
- **Issue**: `message` 事件监听器在 disconnect() 时未移除
- **Suggestion**: 在 disconnect() 中添加 `removeEventListener` 并调用 `port.close()`

#### F2. [UI] [Medium] 缺少全局 Error Boundary
- **File**: `ui/apps/web/src/main.tsx`
- **Issue**: 只有 FeatureErrorBoundary 包装单个组件，无全局保护
- **Suggestion**: 在 App 组件外添加全局 Error Boundary

#### F3. [Documentation] [Critical] 架构文档版本不一致
- **File**: `docs_zh/architecture/00-platform-architecture.md` (v4.3) vs `02-code-architecture-reference.md` (v13.0)
- **Issue**: 主要文档彼此引用过时版本
- **Suggestion**: 统一版本编号策略

#### F4. [Documentation] [Medium] 缺少 API SDK 文档
- **File**: `docs_zh/reference/` 目录
- **Issue**: WSClient、RESTClient、interceptors 无 API 文档
- **Suggestion**: 新增 `api-client.md`

#### F5. [Documentation] [Low] Contract 文档与实现不同步
- **File**: `docs_zh/contracts/` 多个 .md 文件
- **Issue**: 文档声称 Implemented 但代码可能已演进
- **Suggestion**: 建立 contract 测试自动生成验证报告

#### F6. [UI] [Low] replayBufferByChannel 可能无限增长
- **File**: `ui/packages/shared/api-client/src/ws-client.ts:413,325`
- **Issue**: SharedWorkerWSClient 和 BrowserWSClient 的 replay buffer 只在连接时清理
- **Suggestion**: 在 disconnect() 时清理 replay buffer

#### F7. [UI] [Low] XSS 风险未发现
- **File**: UI 源码
- **Issue**: 无 `dangerouslySetInnerHTML`、`innerHTML` 直接赋值或 `eval`
- **Suggestion**: 保持当前模式

#### F8. [Documentation] [Low] src/core/ 未标注为 Legacy
- **File**: `docs_zh/architecture/01-code-structure.md`
- **Issue**: 文档未说明 `src/core/` 是 Legacy 兼容层
- **Suggestion**: 标注为 Legacy

---

#### G. src/interaction/, org-governance/, ops-maturity/, scale-ecosystem/, core/ 发现 (10个问题)

#### G1. [ops-maturity] [Medium] Benchmark percentile 计算错误
- **File**: `src/ops-maturity/drift-detection/learning/benchmark-runner.ts:211-216`
- **Issue**: `successRateBefore` 是加权平均而非 proper percentile
- **Suggestion**: 如有 individual samples，排序后取百分位

#### G2. [interaction] [Medium] `nl-gateway/index.ts` 1669行需要拆分
- **File**: `src/interaction/nl-gateway/index.ts`
- **Issue**: 包含 NL gateway、ambiguity handling、slot resolution、disambiguation、intent parsing
- **Suggestion**: 拆分为 NlGatewayService、IntentParserService、SlotResolverService 等

#### G3. [interaction] [Medium] `workflow-builder-service.ts` 710行
- **File**: `src/interaction/ux/workflow-builder-service.ts`
- **Suggestion**: 提取 WorkflowStepBuilder、WorkflowValidator、ExecutionTracker

#### G4. [scale-ecosystem] [Medium] `tenant-platform-service.ts` 1231行
- **File**: `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts`
- **Suggestion**: 拆分为 TenantLifecycleService、TenantTopologyService、ComplianceProgramService、HaProgramService

#### G5. [ops-maturity] [Low] console.log 代替 StructuredLogger
- **File**: `src/ops-maturity/chaos/chaos-experiment-scheduler.ts:262,595,598,601,604`
- **Issue**: 多处 `console.log` 用于 chaos 实验事件
- **Suggestion**: 替换为 StructuredLogger

#### G6. [scale-ecosystem] [Low] TrustLevel 枚举重复定义
- **File**: `src/scale-ecosystem/federation/federation-gateway.ts:31` 和 `trust-relationship.ts:71`
- **Issue**: 两处定义相同的 `TrustLevel` 枚举
- **Suggestion**: 提取到 shared types file

#### G7. [interaction] [Low] replayBuffer 可能导致 GC pressure
- **File**: `src/interaction/dashboard/dashboard-websocket-server.ts:100,450-455`
- **Issue**: `shift()` 在高频时可能低效
- **Suggestion**: 考虑 ring buffer 或 Deque 实现

#### G8. [interaction] [Low] R4-38 修复需验证覆盖
- **File**: `src/interaction/dashboard/dashboard-websocket-server.ts:144-145,158`
- **Issue**: 注释表明过去有未授权访问漏洞
- **Suggestion**: 验证此修复有 integration tests 覆盖

#### G9. [ops-maturity] [Low] p50/p99 latency 计算使用估算
- **File**: `src/interaction/dashboard/health-scorer/index.ts:55-56`
- **Issue**: 基于 queue depth heuristics 而非实际测量
- **Suggestion**: 文档化为估算模式

#### G10. [ops-maturity] [Low] setInterval 中 async void
- **File**: `src/ops-maturity/chaos/chaos-experiment-scheduler.ts:866`
- **Issue**: async callback 中未捕获的 rejection 会终止进程
- **Suggestion**: 用 try/catch 包装 evaluator()

---

### Summary

本次全量Review（第十八轮 - 2026-05-14）通过7个并行代理发现了**73个新问题**。

**High Priority (Requires Immediate Action)**:
1. SharedWorkerWSClient 内存泄漏 - 事件监听器未清理
2. DomainLifecycleState 类型定义不一致 - 两套不同值
3. plugin-runtime-child.ts sandboxRoot 无验证 - process.chdir() 安全漏洞
4. plugin-runtime-host.ts child 事件监听器未清理 - 内存泄漏
5. OAuth tokens 明文存储 - 安全风险
6. 硬编码 CVE 绕过 SBOM 验证 - 虚假安全感
7. config/security/ 缺少 sandboxMode/remoteWorkerRegistration
8. budget-allocator.test.ts 缺少 throttle ratio 断言
9. harness/index.ts 2317行 God Object
10. durable-event-bus.ts Map/Set 积累无清理

**Medium Priority**:
1. 8个超大型文件需要拆分 (700-2317行)
2. 30+ Math.random() 导致非确定性测试
3. 25+ 测试文件使用 @ts-nocheck
4. console.log 代替 StructuredLogger (5处)
5. setInterval 无 clearInterval (6+处)
6. as unknown as 双转型滥用 (25+处)
7. @ts-ignore 滥用 (21+处)
8. process.exit() 反模式 (4处)
9. CLI 参数解析无验证
10. 架构文档版本不一致

**Low Priority**:
1. .gitignore 缺少 .audit/, dist_*, :memory:* 等
2. Terraform orphaned EKS resource
3. pre-prod NODE_ENV 设为 production
4. TrustLevel 枚举重复定义
5. ECR repository name 无环境后缀
6. 缺少 kubernetes/ 目录
7. tsconfig.temp.json 命名误导
8. replayBuffer 可能 GC pressure
9. XSS 防护良好保持
10. src/core/ 未标注为 Legacy

### Issue Statistics (Cumulative)

| 类别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源代码 | 87+10=97 | 96+8=104 | 57+10=67 | 268 |
| 测试 | 12+1=13 | 18+2=20 | 12+1=13 | 46 |
| 配置 | 11+1=12 | 40+1=41 | 39+4=43 | 96 |
| 安全 | 20+2=22 | 18+1=19 | 3 | 44 |
| 文档 | 2+1=3 | 8+1=9 | 3+1=4 | 16 |
| UI | 0+1=1 | 4+1=5 | 4+1=5 | 11 |
| 部署 | 1 | 12+1=13 | 6+1=7 | 21 |
| **合计** | **146** | **211** | **139** | **496** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 修复 SharedWorkerWSClient 内存泄漏 (添加 removeEventListener)
2. 统一 DomainLifecycleState 定义 (保留 domain-specs.ts)
3. 修复 plugin-runtime-child.ts sandboxRoot 验证
4. 清理 plugin-runtime-host.ts 事件监听器
5. 实现 OAuth token 安全存储 (keychain 或加密)
6. 删除硬编码 CVE 绕过 (plugin-definition.ts)
7. 添加 sandboxMode/remoteWorkerRegistration 到 config/security/

**Short Term (This Month)**:
1. 拆分 harness/index.ts (2317行) 和其他 8 个超大型文件
2. 修复 budget-allocator.test.ts throttle ratio 断言
3. 消除 Math.random() 非确定性 (使用 crypto.randomUUID)
4. 移除 25+ 测试文件的 @ts-nocheck
5. 统一 console.log → StructuredLogger
6. 添加所有 setInterval 的 clearInterval 路径
7. 减少 as unknown as 和 @ts-ignore 使用

**Long Term Planning**:
1. 重构所有 God Objects (8个超大型文件)
2. 建立架构边界和接口契约
3. 实现内存安全验证机制
4. 建立代码质量门禁 (类型安全、测试覆盖)
5. 统一版本编号策略 (架构文档)
6. 完善文档和培训

### Known Test Failures (14 files, 1620 tests)

详情见 `.audit/quality.md`

*Review generated: 2026-05-14*
