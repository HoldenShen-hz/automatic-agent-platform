  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
    // WITHOUT tenantId: 返回所with租户的Quota！
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - 当 tenantId 为空时返回所with租户的Quota
  - not yet经Authorize的information disclosure
- **Suggested Fix**: 
  1. RequireCall者MustProvide tenantId
  2. Add权限ValidateEnsure只能查看自己的Quota
  3. AuditlogRecord所withQuotaaccess

#### 2. [Security] [High Severity] [assertTaskTenantAccess() returns 404 instead of 403 - resource existence leaked]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**: 
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // shouldis403
  }
  ```
  - cross-tenantaccess返回404而非403
  - 泄露了资源exists但属于其他租户的信息
  - attack者可检测with效task ID
- **Suggested Fix**: 
  1. Change to返回403 Forbidden
  2. not要泄露资源is否exists

#### 3. [Security] [High Severity] [crossTenantRequest flag controlled by caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**: 
  - `routeOrgBudget()` Accept `crossTenantRequest?: boolean` parameter
  - 该标志由Call者Set，非系统派生
  - attack者may操纵此标志bypasscross-tenant限制
- **Suggested Fix**: 
  1. 标志应由系统state派生，notAcceptCall者输入
  2. Add auditinglogTracecross-tenant请求
  3. Implement零信任cross-tenantaccess模型

#### 4. [Source Code] [High Severity] [single-task-happy-path has no retry mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**: 
  - `maxRetries: 0` 和 `retryBackoff: "none"`
  - 瞬态failurenoneautomaticretry
  - LLMCallfailure时nonefallback到备用provider
- **Suggested Fix**: 
  1. enable非关keyExecute的retry
  2. ImplementLLM provider fallback链（Anthropic → OpenAI → MiniMax）
  3. Usedomain baseline catalog的primary/fallback模型偏好

#### 5. [Source Code] [High Severity] [LLM calls have no circuit breaker protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - circuit break器只exists于 channel-gateway 和 call-governance
  - 直接LLM providerCallnonecircuit break器
  - providerDegrade时none法快速failure
- **Suggested Fix**: 
  1. 在model-call-provider.tsAdd circuit breaker
  2. 当providerfailure率超阈value时快速failure
  3. automatic切换到备用provider

#### 6. [Security] [High Severity] [Distributed rate limiter bypass - not shared between instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**: 
  - Redisnot yetConfigure时UselocalMap
  - 每个instance维护自己的localEntries
  - attack者可through切换instancebypassRate limit
- **Suggested Fix**: 
  1. RequireRedisConfigure用于production
  2. orUseRedis作为所withinstance的共享后端
  3. 检测andWarnnot yetConfigureRedis的instance

#### 7. [Configuration] [Medium Severity] [Soft quota (log_only) does not actually limit]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**: 
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // log_only时返回true
  ```
  - soft quota只Recordlog，not实际阻止
  - Quota形同虚设
- **Suggested Fix**: 
  1. Clarify区分"Monitor模式"和"强制模式"
  2. 对于硬QuotaMust阻止
  3. Documentquotaclass型的实际row为

#### 8. [Configuration] [Medium Severity] [HTTP layer lacks rate limit headers - clients cannot know limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**: 
  - not yet返回 X-RateLimit-* 头
  - 只在429response时返回retry-after-ms
  - clientnone法主动管理请求速率
- **Suggested Fix**: 
  1. 在所withresponseAdd X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  2. Use标准头名称
  3. 遵循RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP layer lacks rate limit - optional and only by IP]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**: 
  - Rate limit仅在 `this.rateLimiter != null` 时生效
  - Rate limitkey为 `${clientIp}:${endpoint}` 仅按IP
  - noneper-tenant/per-principal enforcement
- **Suggested Fix**: 
  1. by defaultenableRate limit
  2. Addper-tenantRate limitkey
  3. Ensure所with环境by defaultConfigureRate limit

#### 10. [Security] [Medium Severity] [processRuleMode may not be enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**: 
  - `SandboxPolicy.processRuleMode` Set为 "allow" or "deny"
  - 但not yetfound实际阻止based on此策略Generateprocess的实际Executecode
  - `--allow-child-process` 标志仅在 sandboxed_process Isolate模式Apply
- **Suggested Fix**: 
  1. ValidateprocessRuleMode实际被强制Execute
  2. Ensure所withIsolate模式正确Process
  3. Add testsValidateprocessCreate被阻止

#### 11. [Security] [Medium Severity] [Container template replacement not validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**: 
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - 简单字符串Replace
  - althoughvalidateContainerLaunchPluginId()阻止\0和引号
  - 但模板Replace本身not yetValidate
- **Suggested Fix**: 
  1. Add输入Validate防止injection
  2. Use更Secure的模板引擎
  3. Validate所with占位符被Replace

#### 12. [Security] [Medium Severity] [Adapter execution bypasses sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**: 
  - AdapterExecuteREST/grpc/MQCallnot经过ScopedExternalAccessSandbox
  - with自己的allowedDomainsConfigure但非Centralize管理
  - may发起not yet限制的出站请求
- **Suggested Fix**: 
  1. AdapterExecute经过Centralizesandbox
  2. Unifyexternal access策略
  3. Addadapter出站请求Audit

#### 13. [Security] [Medium Severity] [Silent pass-through when principal.tenantId is null]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**: 
  ```typescript
  if (principal.tenantId == null) {
    return;  // 静默放row
  }
  ```
  - IfAPI网关AllownoneprincipalAuthenticate的请求through
  - may授予cross-tenantaccess权限
- **Suggested Fix**: 
  1. Require所withAPI请求withwith效principal
  2. null tenantId应Reject而非静默放row
  3. Add auditinglog

#### 14. [Source Code] [Medium Severity] [No LLM provider fallback chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 主providerfailure时noneautomatic切换
  - domain-baseline-catalog.tsDefine了primary/fallback模型偏好但not yetUse
  - 第一个providerfailure即causesExecutefailure
- **Suggested Fix**: 
  1. Implementprovider fallback链
  2. Usedomain baseline的primary/fallbackConfigure
  3. 按优先级尝试直到successorallfailure

#### 15. [Source Code] [Medium Severity] [Timeout values hardcoded]
- **File/Path**: multiplefile
- **Issue Description**: 
  - Effect bufferwith固定timeoutreject
  - Channel gateway的requestTimeoutMs虽可Configure但withmax 30s限制
  - none全局请求timeout中间件
- **Suggested Fix**: 
  1. CentralizetimeoutConfigure
  2. per-environment可Configure
  3. Add全局timeout中间件

#### 16. [Database] [Medium Severity] [No down migration - rollback not supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**: 
  - `rollbackSupported = false`
  - 每个migration只with `downSql` 占位符
  - schema migrationnone法Rollback
- **Suggested Fix**: 
  1. DocumentRollback限制
  2. 在变更前Createcompletebackup
  3. Useblue-greenDeploy减少Rollback需求

#### 17. [Database] [Medium Severity] [Migration 44 special handling - duplicate table creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**: 
  - Migration 43Createharness_runstable
  - Migration 44再次Create同名table（not同schema）
  - UseapplyCompatibleColumnMigrationIfKnown特殊Process
- **Suggested Fix**: 
  1. eliminate重复tableCreate
  2. UseALTER TABLE而非CREATE TABLE
  3. Simplifymigration逻辑

#### 18. [Configuration] [Low Severity] [Provider rate limit headers not forwarded to client]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**: 
  - 系统Readprovider的ratelimitResetHeaderNames
  - 但not转发给client
  - clientnone法知道providerRate limitstate
- **Suggested Fix**: 
  1. 转发Provider的Rate limit头
  2. orAddApply层Rate limit信息
  3. 帮助clientOptimize请求

#### 19. [Security] [Low Severity] [Browser evaluate accepts arbitrary scripts]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**: 
  - `evaluate` actionAcceptscriptparameter
  - 在浏览器上下文Run（模拟）
  - 如浏览器上下文not yet正确sandbox化mayis向量
- **Suggested Fix**: 
  1. Validate浏览器上下文正确sandbox化
  2. 消毒or限制script内容
  3. Record所withevaluateCall

#### 20. [Source Code] [Low Severity] [No global error boundary wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - Execute引擎缺少unhandled promise rejection的全局Process
  - single-task-happy-path的LLM fallbackfailure时error向上传播
- **Suggested Fix**: 
  1. 在Execute引擎Add error boundariesWrap
  2. UnifyerrorProcess模式
  3. Ensure所witherror被Catch和Record

### Summary

本次补充Review（第十二轮 - errorProcess与多租户SecureReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. listQuotas()返回所with租户Quota（information disclosure）
2. assertTaskTenantAccess()返回404泄露资源exists
3. crossTenantRequest标志可被操纵
4. single-task-happy-pathnoneretry（maxRetries=0）
5. LLMCallnonecircuit break器Protect
6. 分布式Rate limit器可被bypass（instance间not共享）

**Medium Priority**:
1. Soft quota实际not阻止
2. noneX-RateLimit-*response头
3. HTTP层Rate limitoptional且仅按IP
4. processRuleModemaynot yet强制
5. 容器模板Replacenot yetValidate
6. AdapterExecutebypasssandbox
7. null principal静默放row
8. noneLLM provider fallback链
9. timeoutvalue硬Encode
10. nonedown migration
11. Migration 44特殊Process

**Low Priority**:
1. ProviderRate limit头not yet转发
2. Browser evaluateAccept任意脚本
3. none全局error边界

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 60 | 68 | 31 | 159 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 8 | 35 | 21 | 64 |
| Secure | 12 | 13 | 3 | 28 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **91** | **150** | **72** | **313** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fixlistQuotas()information disclosurevulnerability
2. correctassertTaskTenantAccess()返回403
3. RemovecrossTenantRequestCall者控制
4. enableExecute引擎retry机制
5. AddLLM providercircuit break器

**Short Term (This Month)**:
1. fix分布式Rate limit器bypassissue
2. AddX-RateLimit-*response头
3. enableby defaultHTTPRate limit（per-tenant）
4. ImplementLLM provider fallback链
5. Validateand强制processRuleMode

**Long Term Planning**:
1. establishcompleteRate limit和Quota体系
2. Implement插件系统SecureAudit
3. establish多租户SecureTest
4. 完善errorProcess和Recover机制
5. Unifytimeout和circuit breakConfigure

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
  - 浏览器 CORS preflight willReject PUT/PATCH/DELETE 请求
  - 但route中with PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. Add PUT, PATCH, DELETE 到 allowedMethods
  2. Ensure CORS Configure与Applyroutemethod一致
  3. Add testsValidate所with HTTP method的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - Use buildJsonResponse（successWrap）返回error
  - error被Wrap在success信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. Use buildJsonErrorResponse Processerror
  2. Ensure所witherrorpathUsecorrecterror信封
  3. Add API consistencyTest

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // none maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 not同
  - 恶意client可耗尽service器资源
- **Suggested Fix**: 
  1. Add maxConnections 限制
  2. ImplementConnect限制Reject策略
  3. AddConnect计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection Clean up subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map not yetClean up
  - Disconnect的clientnot yetConfirm的message永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中Delete所with pendingAcks 条目
  2. ConsiderAdd timeout机制automaticClean upnot yetConfirmmessage
  3. RecordClean up操作的Auditlog

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作fallback
  - If环境variablenot yetSet，UsenotSecure密钥
- **Suggested Fix**: 
  1. Removefallbackvalue，Require环境variableMustSet
  2. 在Start时Validate密钥exists且足够强
  3. If密钥missingcausesStartfailure

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只with3个field，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - fallback到by defaultvaluemaynot适合Test环境
- **Suggested Fix**: 
  1. Add complete timeout/tuning Configure
  2. EnsureTest环境with合理的by defaultvalue
  3. DocumentrequiredConfigurefield

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - production environment严重受限，mayimpact吞吐量
- **Suggested Fix**: 
  1. EvaluateandAdjustproduction限制
  2. 与业务需求匹配
  3. Addproduction容量Test

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: multiple域service
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps none限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等none限制
  - `domain-recipe-service.ts:67-68`: recipes, versions none限制
  - `domain-risk-profile-service.ts:51`: profiles none限制
  - Session Maps (session-management.ts:83-89) noneautomaticClean up
- **Suggested Fix**: 
  1. 为所with Map Implement LRU or TTL 驱逐策略
  2. Add后台Clean uptask
  3. Add大小Monitor和Alert

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单task历史为 200 条
  - 但 Map 本身从notClean up
  - CancelSubscribe的task历史永久Keep
- **Suggested Fix**: 
  1. Implement后台Clean upnoneSubscribe者task的历史
  2. AddtaskSubscribe者Monitor
  3. ConsiderUse WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json withcomplete remoteWorkerRegistration Configure
  - dev/staging/pre-prod 只with approvalMode
  - prod with approvalMode 但none remoteWorkerRegistration
  - SecureConfigurenot一致
- **Suggested Fix**: 
  1. Unify所with环境的 remoteWorkerRegistration
  2. AddSecureConfigureValidate
  3. Ensure最低Secure基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` Use buildJsonDocumentResponse（noneWrap）
  - 其他endpointUse buildJsonResponse（{requestId, data} Wrap）
  - client体验not一致
- **Suggested Fix**: 
  1. Unifyresponse信封format
  2. Documentresponseformat规范
  3. AddresponseformatValidateTest

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite withpartial唯一indexSupport idempotency
  - Redis ImplementUseHashindex但Implementnotcomplete
  - maycauses重复message
- **Suggested Fix**: 
  1. 完善 Redis idempotency Implement
  2. Add唯一indexValidate
  3. Ensure与 SQLite row为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - none外部Store
  - 多instanceDeploynot共享
  - Restart后去重state丢失
- **Suggested Fix**: 
  1. Use Redis 替代内存Store
  2. Support分布式去重
  3. 持久化去重state

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: multiple cache Implement
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService none锁
  - 缓存not yet命中时可occur thundering herd
  - 高and发下maycausesdatabase过载
- **Suggested Fix**: 
  1. Implement single-flight 模式
  2. Add请求排队机制
  3. Use分布式锁Protect缓存Update

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - Clean up仅在 record() Call时Trigger
  - 空闲时none后台Clean up
  - maycauses内存持续增长
- **Suggested Fix**: 
  1. Add定期后台Clean uptask
  2. Use独立的Clean upthread
  3. Add内存UseMonitor

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket service器
- **Issue Description**: 
  - getClientCount() exists但not yetthrough HTTP endpointExpose
  - none pendingAcks 队column深度指标
  - noneConnectestablishAlert
- **Suggested Fix**: 
  1. through metrics endpointExposeConnect指标
  2. Add pendingAcks 队columnMonitor
  3. AddConnect数exceptionAlert

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在Heartbeat Sweep 时Check isAlive
  - none per-client 独立于Heartbeat的空闲timeout
  - Authenticate后从not发送message的client只能throughHeartbeatfailure检测
- **Suggested Fix**: 
  1. Add per-client idle timeout
  2. 独立于Heartbeat间隔
  3. Configure可Adjust

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意client可Subscribe 100 个task
  - none全局taskSubscribe者限制
- **Suggested Fix**: 
  1. Add全局taskSubscribe者限制
  2. Implement per-task Subscribe者上限
  3. Add反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - Configurewith "version": "v4.3"
  - 但none schema 版本Validate
  - Load时mayAcceptnotCompatibilityConfigure
- **Suggested Fix**: 
  1. Add JSON Schema Validate
  2. Implement版本Compatibility性Check
  3. Start时ValidateConfigurecomplete性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder array的 splice 操作is O(n)
  - 高频access时may性能issue
- **Suggested Fix**: 
  1. Use LinkedList 替代array
  2. orUse Map 维护accessin order
  3. 性能TestValidate

### Summary

本次补充Review（第十三轮 - 缓存will话与实时通信Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求willfailure）
2. Mission Routes errorresponseWrapnot当
3. WebSocketBridge none最大Connect数限制（DoSrisk）
4. pendingAcks DisconnectConnect时not yetClean up（memory leak）
5. 硬Encodefallback密钥（Securevulnerability）
6. config/runtime/test.json 缺少timeoutConfigure
7. prod.json maxConcurrentTasks=1 限制too strict
8. multipleserviceexistsnone界 Map（memory leakrisk）

**Medium Priority**:
1. taskEventHistory Map 永notClean up
2. SecureConfigure drift（remoteWorkerRegistration missing）
3. OpenAPI endpointresponseformatnot一致
4. Redis 队column idempotency Implementnotcomplete
5. 请求去重中间件Use内存Store（多instancenot共享）
6. Cache none stampede Protect
7. EvidenceService eviction 仅在Insert时Trigger

**Low Priority**:
1. noneConnect指标Expose
2. none空闲clienttimeout
3. Subscribe限制is per-client 而非全局
4. config/runtime none版本Validate机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 64 | 74 | 35 | 173 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix CORS allowedMethods Add PUT/PATCH/DELETE
2. fix Mission Routes errorresponseformat
3. 为 WebSocketBridge Add最大Connect数限制
4. Clean up pendingAcks 和 taskEventHistory
5. Remove硬Encodefallback密钥
6. fix config/runtime/test.json Configure
7. EvaluateandAdjust prod and发限制

**Short Term (This Month)**:
1. UnifySecureConfigure（remoteWorkerRegistration）
2. Implementnone界 Map 的 LRU/TTL 驱逐
3. Unify API response信封format
4. 完善 Redis idempotency Implement
5. Add分布式去重中间件
6. Implement cache stampede Protect

**Long Term Planning**:
1. establishcompleteConnection management和Monitor
2. Implement后台Clean uptask框架
3. AddConfigure schema Validate
4. Optimize高频繁操作的数据structure
5. establish内存Use基线和Alert

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 10 - Deep Code Quality and API Consistency Review)

### Newly Discovered Issues

#### 1. [Source Code] [High Severity] [sleepSync busy-wait blocks event loop]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/repositories/authoritative-task-store-decorator.ts:50-57`
- **Issue Description**: 
  - found `sleepSync()` functionUse busy-wait Implement
  ```typescript
  function sleepSync(ms: number): void {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* busy-wait */ }
  }
  ```
  - 在 SQLite BUSY errorretrypath中Use
  - Blockevent循环，maycauses高负载下性能issue
- **Suggested Fix**: 
  1. Use `setTimeout` 替代 busy-wait
  2. orUseAsyncWait模式
  3. Ensureretry逻辑notwillBlock主thread

#### 2. [Source Code] [High Severity] [TODO R4-27: HarnessRun persistence missing - data loss risk]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270`
- **Issue Description**: 
  - 注释 `# TODO R4-27: HarnessRun must be persisted to RuntimeTruthRepository`
  - indicate HarnessRun 数据maynot yet持久化
  - existsdata lossrisk
- **Suggested Fix**: 
  1. Implement HarnessRun 持久化逻辑
  2. EnsureExecutestate可Recover
  3. 在 TODO 完成前Add monitoringAlert

#### 3. [Source Code] [High Severity] [SDK and Server routes mismatch - /handshake and /version missing]
- **File/Path**: `src/sdk/client-sdk/api-client.ts` 及 `src/platform/five-plane-interface/api/`
- **Issue Description**: 
  - SDK client Call `/handshake` 和 `/version` endpoint
  - 但service器端没with这些route的Process程序
  - `SdkVersionHandshakeService` exists但not yetConnect到任何route
- **Suggested Fix**: 
  1. Implement `/handshake` 和 `/version` service器route
  2. or从 SDK 中Remove这些Call
  3. Ensure SDK 和 Server API 版本Compatibility

#### 4. [Source Code] [High Severity] [SDK URL missing /api prefix]
- **File/Path**: `src/sdk/client-sdk/api-client.ts:84` vs service器route
- **Issue Description**: 
  - SDK Buildpath: `${baseUrl}/${apiVersion}/${path}` → `/v1/harness-runs`
  - service器route: `/api/v1/harness-runs`
  - 缺少 `/api` 前缀causes 404 error
- **Suggested Fix**: 
  1. 在 SDK 的 `baseUrl` 中Add `/api` 前缀
  2. orRemoveservice器route中的 `/api` 前缀
  3. Ensure所withroute前缀一致

#### 5. [Source Code] [High Severity] [quant-trading.json has multiple configuration errors]
- **File/Path**: `config/domains/quant-trading.json`
- **Issue Description**: 
  - `capabilities.supportedTaskTypes` 包含 `["strategy_backtest", "pre_trade_risk_check"]`
  - 但 domain seed Define的is `["research", "simulate", "trade"]`
  - `workflowProfile.workflowId` 为 `"quant-trading.primary"` 但没with匹配的 workflow
  - `toolProfile.requiredTools` 包含 `order_execution` 但 `toolBundles` 中alreadydisable
- **Suggested Fix**: 
  1. correct supportedTaskTypes 以匹配 seed Define
  2. Add missing workflow Defineorcorrect引用
  3. enable `order_execution` or从 requiredTools 中Remove

#### 6. [Source Code] [Medium Severity] [SDK and Server error category inconsistent]
- **File/Path**: `src/sdk/client-sdk/api-client.ts` 和 `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  - SDK map: 4xx → BUSINESS, 400 为 BUSINESS
  - Server map: 400 → validation, 422 → business-rule
  - 同一 HTTP state码producenot同的errorclass别
  - `PolicyDeniedError`, `TenantBoundaryError`, `WorkflowStateError` 等 Server errorclass型not yetExpose给 SDK
- **Suggested Fix**: 
  1. Unify SDK 和 Server 的errorclass别map
  2. 在 SDK 中Add missingerrorclass型Process
  3. Documenterrorclass别层次structure

#### 7. [Source Code] [Medium Severity] [N+1 query pattern - duplicate calls to same query]
- **File/Path**: `src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts:73,79`
- **Issue Description**: 
  - 同一Query被连续Call两次：
  ```typescript
  for (const fence of await repo.getFencesForExecution(executionId)) { ... }
  for (const fence of await repo.getFencesForExecution(executionId)) { ... }
  ```
  - notnecessarydatabase往返
- **Suggested Fix**: 
  1. 将result缓存到variable中
  2. 合and两个循环为一个
  3. Add cache层avoid重复Query

#### 8. [Source Code] [Medium Severity] [experience-cache-service has no pagination - memory overflow risk]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/experience-cache-service.ts:337-424`
- **Issue Description**: 
  - `findSimilarExperiences` Query `LIMIT 500` row
  - then在内存中对所with500row进row评分和Filter
  - nonedatabase级分页orcursor
  - maycauses高内存占用
- **Suggested Fix**: 
  1. Implementcursor分页
  2. 将评分逻辑下推到database
  3. 限制返回row数

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
  - none大小限制
  - none驱逐策略
  - maycausesmemory leak
- **Suggested Fix**: 
  1. Implement LRU or TTL 驱逐策略
  2. Add最大大小限制
  3. Monitor内存Use情况

#### 10. [Source Code] [Medium Severity] [Fixed polling interval - thundering herd risk]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.ts:76-78`
- **Issue Description**: 
  ```typescript
  this.intervalHandle = setInterval(() => {
    void this.runOnce();
  }, this.pollIntervalMs);
  ```
  - 固定间隔轮询none jitter
  - If大量messagesimultaneously就绪，maycausesProcess峰value
- **Suggested Fix**: 
  1. 在轮询间隔Addrandomly jitter
  2. Implement指数Backoff
  3. orUseevent驱动而非轮询

#### 11. [Source Code] [Medium Severity] [VersionRoutingMiddleware not connected to routes]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/version-routing.ts`
- **Issue Description**: 
  - `VersionRoutingMiddleware` exists但从not yetApply到任何route
  - `supportedVersions: ["2026-04-01", "2026-01-01"]` not yet生效
  - API 版本控制功能not yetenable
- **Suggested Fix**: 
  1. 将 VersionRoutingMiddleware Connect到route
  2. Implement版本协商逻辑
  3. orRemovenot yetUse的中间件

#### 12. [Source Code] [Medium Severity] [marketing.json missing required fields]
- **File/Path**: `config/domains/marketing.json`
- **Issue Description**: 
  - 缺少 `description` field
  - 缺少 `version` field
  - 缺少 `status` field
  - 缺少 `riskProfile` / `riskSpec` object
  - 缺少 `workflows` array（只with `workflowProfile`）
  - 缺少 `toolBundles` array（只with `toolProfile`）
  - 缺少 `outputContracts` array
  - 缺少 `capabilities` object
- **Suggested Fix**: 
  1. 补充所with必需field
  2. 与 quant-trading.json 保持structure一致
  3. Validate JSON schema 合规性

#### 13. [Source Code] [Medium Severity] [21 TODO/FIXME/HACK comments unhandled]
- **File/Path**: multiple源file
- **Issue Description**: 
  - `src/org-governance/sso-scim/saml/index.ts:17` - TODO Phase 2 SAML production hardening
  - `src/platform/five-plane-interface/api/mission-control-service.ts:439` - TODO p50/p99 metrics
  - `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts:184` - TODO Redis idempotency
  - 等共21个 TODO
- **Suggested Fix**: 
  1. 逐个ProcessorCreate issue 跟踪
  2. Priority Actionproduction hardening 相关的 TODO
  3. Setcode quality标准RequireProcess所with TODO

#### 14. [Source Code] [Medium Severity] [82 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - 82处 `: any`, `<any>`, or `as any`
  - indicate TypeScript strict mode not yet完全Execute
  - 降低了class型Secure性
- **Suggested Fix**: 
  1. enable TypeScript strict mode
  2. 逐步Replace any 为具体class型
  3. Use unknown 替代 any

#### 15. [Configuration] [Medium Severity] [Default connection pool size may be insufficient]
- **File/Path**: `src/platform/five-plane-control-plane/config-center/postgres-pool-env.ts:58`
- **Issue Description**: 
  - `poolMax` by default为 10
  - 高吞吐场景maynot足
  - noneautomaticExtendConfigure
- **Suggested Fix**: 
  1. according to负载Adjustby defaultvalue
  2. AddConnect池automatic调优
  3. MonitorConnect池Use情况

#### 16. [Source Code] [Medium Severity] [experience_cache table has no index]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/experience-cache-service.ts`
- **Issue Description**: 
  - `findSimilarExperiences` QueryUse `session_id`, `quality_score`, `outcome`, `task_context`, `task_intent`
  - 但这些columnmay没withdatabaseindex
  - impactQuery性能
- **Suggested Fix**: 
  1. 在 experience_cache tableAdd相应index
  2. Use EXPLAIN AnalyzeQueryplanned
  3. Optimizeindex策略

#### 17. [Source Code] [Low Severity] [Magic numbers scattered everywhere]
- **File/Path**: multiple源file
- **Issue Description**: 
  - `3600000` (1小时), `86400000` (24小时), `3600` (1小时秒)
  - `4001`, `4003` - WebSocket Closecode
  - `504` - HTTP 504
  - `4096` - stderr Truncate缓冲区大小
- **Suggested Fix**: 
  1. Use `src/platform/contracts/constants/time.ts` 中的constant
  2. 为其他magic numbersCreateconstantfile
  3. Add ESLint 规则Forbidmagic numbers

#### 18. [Source Code] [Low Severity] [Silent catch blocks swallow errors]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:130` 等多处
- **Issue Description**: 
  ```typescript
  } catch {
    ws.close(4003, "Invalid token");
    // Error is silently swallowed
  }
  ```
  - error被静默吞掉，nonelogRecord
  - 难以调试和Traceissue
- **Suggested Fix**: 
  1. 在 catch 块中Add error logging
  2. Use StructuredLogger Recorderror
  3. Consider重新Throwor传播error

#### 19. [Testing] [Medium Severity] [1059 setTimeout/sleep/waitFor - tests are fragile]
- **File/Path**: `tests/` multipleTestfile
- **Issue Description**: 
  - 1059个 setTimeout/sleep/waitFor Call
  - `plugin-spi-registry.test.ts` with自Define waitFor() 250ms timeout
  - `bootstrap.test.ts` Use setTimeout(resolve, 500)
  - 在 CI 高负载下may非确定性地failure
- **Suggested Fix**: 
  1. 用 async/await or proper mocking 替代 sleep
  2. 增加timeout时间or改用轮询条件
  3. Add retry机制

#### 20. [Testing] [Medium Severity] [6 test files use // @ts-nocheck]
- **File/Path**: `tests/unit/domains/recipes/recipe-executor.test.ts` 等
- **Issue Description**: 
  - 整个filedisable TypeScript class型Check
  - Hide真实的class型error
  - 使Refactor变得危险
- **Suggested Fix**: 
  1. Remove // @ts-nocheck
  2. fixclass型error
  3. Use // @ts-expect-error 替代singleerror

#### 21. [Testing] [Medium Severity] [3 integration tests skipped due to missing workflow_state setup]
- **File/Path**: `tests/integration/platform/five-plane-execution/budget-allocation.integration.test.ts`
- **Issue Description**: 
  - 3个Test因缺少 `evaluateMultiDimensionalQuota` 和 `workflow_state` Record而Skip
  - 关key预算分配功能not yetTest
- **Suggested Fix**: 
  1. SetTest所需的 workflow_state Record
  2. Implementmissing的 evaluateMultiDimensionalQuota
  3. EnsureTest环境complete性

#### 22. [Testing] [Low Severity] [5 tests marked with .skip]
- **File/Path**: `tests/unit/scale-ecosystem/multi-region/cross-region-routing.test.ts` 等
- **Issue Description**: 
  - `describe.skip` - 功能not yetImplement
  - `test.skip()` - 缺少depends on
  - already知failure但not yetresolve
- **Suggested Fix**: 
  1. ImplementSkip的功能
  2. SetTestdepends on
  3. or在 TODO 中跟踪

#### 23. [Source Code] [Low Severity] [double throw pattern]
- **File/Path**: `src/domains/domain-baseline-catalog.ts:546,550`
- **Issue Description**: 
  - 在 baseline not yetfound时连续Throw两次error
  - maycauses混淆的error堆栈
- **Suggested Fix**: 
  1. ReviewandcorrecterrorThrow逻辑
  2. SimplifyerrorProcess流程

#### 24. [Source Code] [Low Severity] [user-operations.json configuration too simple]
- **File/Path**: `config/domains/user-operations.json`
- **Issue Description**: 
  - Configure极简，none workflows or contracts Define
  - maynone法正常工作
- **Suggested Fix**: 
  1. 补充complete领域Configure
  2. orConfirm这iswith意为之

#### 25. [Deployment] [Low Severity] [CI Coverage gate only runs on Node 22]
- **File/Path**: `.github/workflows/`
- **Issue Description**: 
  - `coverage:gate` 仅在 Node 22 Run
  - Node 20 notCheckcoverage
  - not同版本maywithnot同的覆盖情况
- **Suggested Fix**: 
  1. 在所with版本上Run coverage gate
  2. or在 PR Check中ClarifyExplain

#### 26. [Source Code] [Low Severity] [Module-level logger instance may not be best practice]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:69`
- **Issue Description**: 
  ```typescript
  const logger = new StructuredLogger({ retentionLimit: 100 });
  ```
  - module级statemaynotisBest Practice
  - 大多数serviceUsedepends oninjection
- **Suggested Fix**: 
  1. throughdepends oninjection传递 logger
  2. orUse全局单例

### Summary

本次补充Review（第十轮 - 深度code quality与API一致性Review - 2026-05-14）found了26个新issue，with focus oncode quality和API一致性。

**High Priority (Requires Immediate Action)**:
1. sleepSync busy-wait Blockevent循环
2. TODO R4-27: HarnessRun 持久化missing
3. SDK 与 Server routenot匹配 (/handshake, /version missing)
4. SDK URL 缺少 /api 前缀
5. quant-trading.json exists多种Configureerror

**Medium Priority**:
1. SDK 与 Server errorclass别not一致
2. N+1 Query模式 (postgres-fencing-token-service)
3. experience-cache-service none分页
4. none限制的内存 Map
5. 固定轮询间隔none jitter
6. VersionRoutingMiddleware not yetConnect
7. marketing.json 缺少必需field
8. 21个 TODO/FIXME 注释not yetProcess
9. 82处 any class型Use
10. Connect池by default大小maynot足
11. experience_cache tablenoneindex
12. 1059处 setTimeout/sleep (Test脆弱)
13. 6个TestfileUse @ts-nocheck
14. 3个集成TestSkip

**Low Priority**:
1. magic numbers散落各处
2. 静默 catch 块吞掉error
3. 5个TestUse .skip Mark
4. double throw 模式
5. user-operations.json Configure过简
6. CI coverage gate 仅在 Node 22
7. module级 logger instance

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 51 | 57 | 26 | 134 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 8 | 29 | 18 | 55 |
| Secure | 6 | 6 | 1 | 13 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 0 | 8 | 5 | 13 |
| **合计** | **75** | **124** | **61** | **260** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix SDK 与 Server routenot匹配（/handshake, /version, /api前缀）
2. Implement HarnessRun 持久化（TODO R4-27）
3. fix quant-trading.json 和 marketing.json Configureerror
4. 将 sleepSync Change to非BlockImplement
5. Unify SDK 和 Server errorclass别map

**Short Term (This Month)**:
1. Implement N+1 Queryfix和分页
2. Addnone界 Map 的驱逐策略
3. Add轮询 jitter 防止 thundering herd
4. Process所with TODO/FIXME 注释
5. RemoveTestfile中的 @ts-nocheck
6. fix workflow_state 集成Test

**Long Term Planning**:
1. enable TypeScript strict mode
2. 完善 API 版本控制中间件
3. Add experience_cache tableindex
4. Unify所withmagic numbers到constant
5. establishcode quality门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
  - 浏览器 CORS preflight willReject PUT/PATCH/DELETE 请求
  - 但route中with PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. Add PUT, PATCH, DELETE 到 allowedMethods
  2. Ensure CORS Configure与Applyroutemethod一致
  3. Add testsValidate所with HTTP method的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - Use buildJsonResponse（successWrap）返回error
  - error被Wrap在success信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. Use buildJsonErrorResponse Processerror
  2. Ensure所witherrorpathUsecorrecterror信封
  3. Add API consistencyTest

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // none maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 not同
  - 恶意client可耗尽service器资源
- **Suggested Fix**: 
  1. Add maxConnections 限制
  2. ImplementConnect限制Reject策略
  3. AddConnect计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection Clean up subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map not yetClean up
  - Disconnect的clientnot yetConfirm的message永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中Delete所with pendingAcks 条目
  2. ConsiderAdd timeout机制automaticClean upnot yetConfirmmessage
  3. RecordClean up操作的Auditlog

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作fallback
  - If环境variablenot yetSet，UsenotSecure密钥
- **Suggested Fix**: 
  1. Removefallbackvalue，Require环境variableMustSet
  2. 在Start时Validate密钥exists且足够强
  3. If密钥missingcausesStartfailure

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只with3个field，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - fallback到by defaultvaluemaynot适合Test环境
- **Suggested Fix**: 
  1. Add complete timeout/tuning Configure
  2. EnsureTest环境with合理的by defaultvalue
  3. DocumentrequiredConfigurefield

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - production environment严重受限，mayimpact吞吐量
- **Suggested Fix**: 
  1. EvaluateandAdjustproduction限制
  2. 与业务需求匹配
  3. Addproduction容量Test

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: multiple域service
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps none限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等none限制
  - `domain-recipe-service.ts:67-68`: recipes, versions none限制
  - `domain-risk-profile-service.ts:51`: profiles none限制
  - Session Maps (session-management.ts:83-89) noneautomaticClean up
- **Suggested Fix**: 
  1. 为所with Map Implement LRU or TTL 驱逐策略
  2. Add后台Clean uptask
  3. Add大小Monitor和Alert

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单task历史为 200 条
  - 但 Map 本身从notClean up
  - CancelSubscribe的task历史永久Keep
- **Suggested Fix**: 
  1. Implement后台Clean upnoneSubscribe者task的历史
  2. AddtaskSubscribe者Monitor
  3. ConsiderUse WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json withcomplete remoteWorkerRegistration Configure
  - dev/staging/pre-prod 只with approvalMode
  - prod with approvalMode 但none remoteWorkerRegistration
  - SecureConfigurenot一致
- **Suggested Fix**: 
  1. Unify所with环境的 remoteWorkerRegistration
  2. AddSecureConfigureValidate
  3. Ensure最低Secure基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` Use buildJsonDocumentResponse（noneWrap）
  - 其他endpointUse buildJsonResponse（{requestId, data} Wrap）
  - client体验not一致
- **Suggested Fix**: 
  1. Unifyresponse信封format
  2. Documentresponseformat规范
  3. AddresponseformatValidateTest

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite withpartial唯一indexSupport idempotency
  - Redis ImplementUseHashindex但Implementnotcomplete
  - maycauses重复message
- **Suggested Fix**: 
  1. 完善 Redis idempotency Implement
  2. Add唯一indexValidate
  3. Ensure与 SQLite row为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - none外部Store
  - 多instanceDeploynot共享
  - Restart后去重state丢失
- **Suggested Fix**: 
  1. Use Redis 替代内存Store
  2. Support分布式去重
  3. 持久化去重state

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: multiple cache Implement
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService none锁
  - 缓存not yet命中时可occur thundering herd
  - 高and发下maycausesdatabase过载
- **Suggested Fix**: 
  1. Implement single-flight 模式
  2. Add请求排队机制
  3. Use分布式锁Protect缓存Update

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - Clean up仅在 record() Call时Trigger
  - 空闲时none后台Clean up
  - maycauses内存持续增长
- **Suggested Fix**: 
  1. Add定期后台Clean uptask
  2. Use独立的Clean upthread
  3. Add内存UseMonitor

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket service器
- **Issue Description**: 
  - getClientCount() exists但not yetthrough HTTP endpointExpose
  - none pendingAcks 队column深度指标
  - noneConnectestablishAlert
- **Suggested Fix**: 
  1. through metrics endpointExposeConnect指标
  2. Add pendingAcks 队columnMonitor
  3. AddConnect数exceptionAlert

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在Heartbeat Sweep 时Check isAlive
  - none per-client 独立于Heartbeat的空闲timeout
  - Authenticate后从not发送message的client只能throughHeartbeatfailure检测
- **Suggested Fix**: 
  1. Add per-client idle timeout
  2. 独立于Heartbeat间隔
  3. Configure可Adjust

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意client可Subscribe 100 个task
  - none全局taskSubscribe者限制
- **Suggested Fix**: 
  1. Add全局taskSubscribe者限制
  2. Implement per-task Subscribe者上限
  3. Add反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - Configurewith "version": "v4.3"
  - 但none schema 版本Validate
  - Load时mayAcceptnotCompatibilityConfigure
- **Suggested Fix**: 
  1. Add JSON Schema Validate
  2. Implement版本Compatibility性Check
  3. Start时ValidateConfigurecomplete性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder array的 splice 操作is O(n)
  - 高频access时may性能issue
- **Suggested Fix**: 
  1. Use LinkedList 替代array
  2. orUse Map 维护accessin order
  3. 性能TestValidate

### Summary

本次补充Review（第十三轮 - 缓存will话与实时通信Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求willfailure）
2. Mission Routes errorresponseWrapnot当
3. WebSocketBridge none最大Connect数限制（DoSrisk）
4. pendingAcks DisconnectConnect时not yetClean up（memory leak）
5. 硬Encodefallback密钥（Securevulnerability）
6. config/runtime/test.json 缺少timeoutConfigure
7. prod.json maxConcurrentTasks=1 限制too strict
8. multipleserviceexistsnone界 Map（memory leakrisk）

**Medium Priority**:
1. taskEventHistory Map 永notClean up
2. SecureConfigure drift（remoteWorkerRegistration missing）
3. OpenAPI endpointresponseformatnot一致
4. Redis 队column idempotency Implementnotcomplete
5. 请求去重中间件Use内存Store（多instancenot共享）
6. Cache none stampede Protect
7. EvidenceService eviction 仅在Insert时Trigger

**Low Priority**:
1. noneConnect指标Expose
2. none空闲clienttimeout
3. Subscribe限制is per-client 而非全局
4. config/runtime none版本Validate机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 64 | 74 | 35 | 173 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix CORS allowedMethods Add PUT/PATCH/DELETE
2. fix Mission Routes errorresponseformat
3. 为 WebSocketBridge Add最大Connect数限制
4. Clean up pendingAcks 和 taskEventHistory
5. Remove硬Encodefallback密钥
6. fix config/runtime/test.json Configure
7. EvaluateandAdjust prod and发限制

**Short Term (This Month)**:
1. UnifySecureConfigure（remoteWorkerRegistration）
2. Implementnone界 Map 的 LRU/TTL 驱逐
3. Unify API response信封format
4. 完善 Redis idempotency Implement
5. Add分布式去重中间件
6. Implement cache stampede Protect

**Long Term Planning**:
1. establishcompleteConnection management和Monitor
2. Implement后台Clean uptask框架
3. AddConfigure schema Validate
4. Optimize高频繁操作的数据structure
5. establish内存Use基线和Alert

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
    // WITHOUT tenantId: 返回所with租户的Quota！
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - 当 tenantId 为空时返回所with租户的Quota
  - not yet经Authorize的information disclosure
- **Suggested Fix**: 
  1. RequireCall者MustProvide tenantId
  2. Add权限ValidateEnsure只能查看自己的Quota
  3. AuditlogRecord所withQuotaaccess

#### 2. [Security] [High Severity] [assertTaskTenantAccess() returns 404 instead of 403 - resource existence leaked]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**: 
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // shouldis403
  }
  ```
  - cross-tenantaccess返回404而非403
  - 泄露了资源exists但属于其他租户的信息
  - attack者可检测with效task ID
- **Suggested Fix**: 
  1. Change to返回403 Forbidden
  2. not要泄露资源is否exists

#### 3. [Security] [High Severity] [crossTenantRequest flag controlled by caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**: 
  - `routeOrgBudget()` Accept `crossTenantRequest?: boolean` parameter
  - 该标志由Call者Set，非系统派生
  - attack者may操纵此标志bypasscross-tenant限制
- **Suggested Fix**: 
  1. 标志应由系统state派生，notAcceptCall者输入
  2. Add auditinglogTracecross-tenant请求
  3. Implement零信任cross-tenantaccess模型

#### 4. [Source Code] [High Severity] [single-task-happy-path has no retry mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**: 
  - `maxRetries: 0` 和 `retryBackoff: "none"`
  - 瞬态failurenoneautomaticretry
  - LLMCallfailure时nonefallback到备用provider
- **Suggested Fix**: 
  1. enable非关keyExecute的retry
  2. ImplementLLM provider fallback链（Anthropic → OpenAI → MiniMax）
  3. Usedomain baseline catalog的primary/fallback模型偏好

#### 5. [Source Code] [High Severity] [LLM calls have no circuit breaker protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - circuit break器只exists于 channel-gateway 和 call-governance
  - 直接LLM providerCallnonecircuit break器
  - providerDegrade时none法快速failure
- **Suggested Fix**: 
  1. 在model-call-provider.tsAdd circuit breaker
  2. 当providerfailure率超阈value时快速failure
  3. automatic切换到备用provider

#### 6. [Security] [High Severity] [Distributed rate limiter bypass - not shared between instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**: 
  - Redisnot yetConfigure时UselocalMap
  - 每个instance维护自己的localEntries
  - attack者可through切换instancebypassRate limit
- **Suggested Fix**: 
  1. RequireRedisConfigure用于production
  2. orUseRedis作为所withinstance的共享后端
  3. 检测andWarnnot yetConfigureRedis的instance

#### 7. [Configuration] [Medium Severity] [Soft quota (log_only) does not actually limit]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**: 
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // log_only时返回true
  ```
  - soft quota只Recordlog，not实际阻止
  - Quota形同虚设
- **Suggested Fix**: 
  1. Clarify区分"Monitor模式"和"强制模式"
  2. 对于硬QuotaMust阻止
  3. Documentquotaclass型的实际row为

#### 8. [Configuration] [Medium Severity] [HTTP layer lacks rate limit headers - clients cannot know limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**: 
  - not yet返回 X-RateLimit-* 头
  - 只在429response时返回retry-after-ms
  - clientnone法主动管理请求速率
- **Suggested Fix**: 
  1. 在所withresponseAdd X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  2. Use标准头名称
  3. 遵循RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP layer lacks rate limit - optional and only by IP]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**: 
  - Rate limit仅在 `this.rateLimiter != null` 时生效
  - Rate limitkey为 `${clientIp}:${endpoint}` 仅按IP
  - noneper-tenant/per-principal enforcement
- **Suggested Fix**: 
  1. by defaultenableRate limit
  2. Addper-tenantRate limitkey
  3. Ensure所with环境by defaultConfigureRate limit

#### 10. [Security] [Medium Severity] [processRuleMode may not be enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**: 
  - `SandboxPolicy.processRuleMode` Set为 "allow" or "deny"
  - 但not yetfound实际阻止based on此策略Generateprocess的实际Executecode
  - `--allow-child-process` 标志仅在 sandboxed_process Isolate模式Apply
- **Suggested Fix**: 
  1. ValidateprocessRuleMode实际被强制Execute
  2. Ensure所withIsolate模式正确Process
  3. Add testsValidateprocessCreate被阻止

#### 11. [Security] [Medium Severity] [Container template replacement not validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**: 
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - 简单字符串Replace
  - althoughvalidateContainerLaunchPluginId()阻止\0和引号
  - 但模板Replace本身not yetValidate
- **Suggested Fix**: 
  1. Add输入Validate防止injection
  2. Use更Secure的模板引擎
  3. Validate所with占位符被Replace

#### 12. [Security] [Medium Severity] [Adapter execution bypasses sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**: 
  - AdapterExecuteREST/grpc/MQCallnot经过ScopedExternalAccessSandbox
  - with自己的allowedDomainsConfigure但非Centralize管理
  - may发起not yet限制的出站请求
- **Suggested Fix**: 
  1. AdapterExecute经过Centralizesandbox
  2. Unifyexternal access策略
  3. Addadapter出站请求Audit

#### 13. [Security] [Medium Severity] [Silent pass-through when principal.tenantId is null]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**: 
  ```typescript
  if (principal.tenantId == null) {
    return;  // 静默放row
  }
  ```
  - IfAPI网关AllownoneprincipalAuthenticate的请求through
  - may授予cross-tenantaccess权限
- **Suggested Fix**: 
  1. Require所withAPI请求withwith效principal
  2. null tenantId应Reject而非静默放row
  3. Add auditinglog

#### 14. [Source Code] [Medium Severity] [No LLM provider fallback chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 主providerfailure时noneautomatic切换
  - domain-baseline-catalog.tsDefine了primary/fallback模型偏好但not yetUse
  - 第一个providerfailure即causesExecutefailure
- **Suggested Fix**: 
  1. Implementprovider fallback链
  2. Usedomain baseline的primary/fallbackConfigure
  3. 按优先级尝试直到successorallfailure

#### 15. [Source Code] [Medium Severity] [Timeout values hardcoded]
- **File/Path**: multiplefile
- **Issue Description**: 
  - Effect bufferwith固定timeoutreject
  - Channel gateway的requestTimeoutMs虽可Configure但withmax 30s限制
  - none全局请求timeout中间件
- **Suggested Fix**: 
  1. CentralizetimeoutConfigure
  2. per-environment可Configure
  3. Add全局timeout中间件

#### 16. [Database] [Medium Severity] [No down migration - rollback not supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**: 
  - `rollbackSupported = false`
  - 每个migration只with `downSql` 占位符
  - schema migrationnone法Rollback
- **Suggested Fix**: 
  1. DocumentRollback限制
  2. 在变更前Createcompletebackup
  3. Useblue-greenDeploy减少Rollback需求

#### 17. [Database] [Medium Severity] [Migration 44 special handling - duplicate table creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**: 
  - Migration 43Createharness_runstable
  - Migration 44再次Create同名table（not同schema）
  - UseapplyCompatibleColumnMigrationIfKnown特殊Process
- **Suggested Fix**: 
  1. eliminate重复tableCreate
  2. UseALTER TABLE而非CREATE TABLE
  3. Simplifymigration逻辑

#### 18. [Configuration] [Low Severity] [Provider rate limit headers not forwarded to client]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**: 
  - 系统Readprovider的ratelimitResetHeaderNames
  - 但not转发给client
  - clientnone法知道providerRate limitstate
- **Suggested Fix**: 
  1. 转发Provider的Rate limit头
  2. orAddApply层Rate limit信息
  3. 帮助clientOptimize请求

#### 19. [Security] [Low Severity] [Browser evaluate accepts arbitrary scripts]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**: 
  - `evaluate` actionAcceptscriptparameter
  - 在浏览器上下文Run（模拟）
  - 如浏览器上下文not yet正确sandbox化mayis向量
- **Suggested Fix**: 
  1. Validate浏览器上下文正确sandbox化
  2. 消毒or限制script内容
  3. Record所withevaluateCall

#### 20. [Source Code] [Low Severity] [No global error boundary wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - Execute引擎缺少unhandled promise rejection的全局Process
  - single-task-happy-path的LLM fallbackfailure时error向上传播
- **Suggested Fix**: 
  1. 在Execute引擎Add error boundariesWrap
  2. UnifyerrorProcess模式
  3. Ensure所witherror被Catch和Record

### Summary

本次补充Review（第十二轮 - errorProcess与多租户SecureReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. listQuotas()返回所with租户Quota（information disclosure）
2. assertTaskTenantAccess()返回404泄露资源exists
3. crossTenantRequest标志可被操纵
4. single-task-happy-pathnoneretry（maxRetries=0）
5. LLMCallnonecircuit break器Protect
6. 分布式Rate limit器可被bypass（instance间not共享）

**Medium Priority**:
1. Soft quota实际not阻止
2. noneX-RateLimit-*response头
3. HTTP层Rate limitoptional且仅按IP
4. processRuleModemaynot yet强制
5. 容器模板Replacenot yetValidate
6. AdapterExecutebypasssandbox
7. null principal静默放row
8. noneLLM provider fallback链
9. timeoutvalue硬Encode
10. nonedown migration
11. Migration 44特殊Process

**Low Priority**:
1. ProviderRate limit头not yet转发
2. Browser evaluateAccept任意脚本
3. none全局error边界

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 60 | 68 | 31 | 159 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 8 | 35 | 21 | 64 |
| Secure | 12 | 13 | 3 | 28 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **91** | **150** | **72** | **313** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fixlistQuotas()information disclosurevulnerability
2. correctassertTaskTenantAccess()返回403
3. RemovecrossTenantRequestCall者控制
4. enableExecute引擎retry机制
5. AddLLM providercircuit break器

**Short Term (This Month)**:
1. fix分布式Rate limit器bypassissue
2. AddX-RateLimit-*response头
3. enableby defaultHTTPRate limit（per-tenant）
4. ImplementLLM provider fallback链
5. Validateand强制processRuleMode

**Long Term Planning**:
1. establishcompleteRate limit和Quota体系
2. Implement插件系统SecureAudit
3. establish多租户SecureTest
4. 完善errorProcess和Recover机制
5. Unifytimeout和circuit breakConfigure

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
  - 浏览器 CORS preflight willReject PUT/PATCH/DELETE 请求
  - 但route中with PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. Add PUT, PATCH, DELETE 到 allowedMethods
  2. Ensure CORS Configure与Applyroutemethod一致
  3. Add testsValidate所with HTTP method的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - Use buildJsonResponse（successWrap）返回error
  - error被Wrap在success信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. Use buildJsonErrorResponse Processerror
  2. Ensure所witherrorpathUsecorrecterror信封
  3. Add API consistencyTest

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // none maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 not同
  - 恶意client可耗尽service器资源
- **Suggested Fix**: 
  1. Add maxConnections 限制
  2. ImplementConnect限制Reject策略
  3. AddConnect计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection Clean up subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map not yetClean up
  - Disconnect的clientnot yetConfirm的message永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中Delete所with pendingAcks 条目
  2. ConsiderAdd timeout机制automaticClean upnot yetConfirmmessage
  3. RecordClean up操作的Auditlog

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作fallback
  - If环境variablenot yetSet，UsenotSecure密钥
- **Suggested Fix**: 
  1. Removefallbackvalue，Require环境variableMustSet
  2. 在Start时Validate密钥exists且足够强
  3. If密钥missingcausesStartfailure

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只with3个field，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - fallback到by defaultvaluemaynot适合Test环境
- **Suggested Fix**: 
  1. Add complete timeout/tuning Configure
  2. EnsureTest环境with合理的by defaultvalue
  3. DocumentrequiredConfigurefield

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - production environment严重受限，mayimpact吞吐量
- **Suggested Fix**: 
  1. EvaluateandAdjustproduction限制
  2. 与业务需求匹配
  3. Addproduction容量Test

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: multiple域service
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps none限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等none限制
  - `domain-recipe-service.ts:67-68`: recipes, versions none限制
  - `domain-risk-profile-service.ts:51`: profiles none限制
  - Session Maps (session-management.ts:83-89) noneautomaticClean up
- **Suggested Fix**: 
  1. 为所with Map Implement LRU or TTL 驱逐策略
  2. Add后台Clean uptask
  3. Add大小Monitor和Alert

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单task历史为 200 条
  - 但 Map 本身从notClean up
  - CancelSubscribe的task历史永久Keep
- **Suggested Fix**: 
  1. Implement后台Clean upnoneSubscribe者task的历史
  2. AddtaskSubscribe者Monitor
  3. ConsiderUse WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json withcomplete remoteWorkerRegistration Configure
  - dev/staging/pre-prod 只with approvalMode
  - prod with approvalMode 但none remoteWorkerRegistration
  - SecureConfigurenot一致
- **Suggested Fix**: 
  1. Unify所with环境的 remoteWorkerRegistration
  2. AddSecureConfigureValidate
  3. Ensure最低Secure基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` Use buildJsonDocumentResponse（noneWrap）
  - 其他endpointUse buildJsonResponse（{requestId, data} Wrap）
  - client体验not一致
- **Suggested Fix**: 
  1. Unifyresponse信封format
  2. Documentresponseformat规范
  3. AddresponseformatValidateTest

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite withpartial唯一indexSupport idempotency
  - Redis ImplementUseHashindex但Implementnotcomplete
  - maycauses重复message
- **Suggested Fix**: 
  1. 完善 Redis idempotency Implement
  2. Add唯一indexValidate
  3. Ensure与 SQLite row为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - none外部Store
  - 多instanceDeploynot共享
  - Restart后去重state丢失
- **Suggested Fix**: 
  1. Use Redis 替代内存Store
  2. Support分布式去重
  3. 持久化去重state

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: multiple cache Implement
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService none锁
  - 缓存not yet命中时可occur thundering herd
  - 高and发下maycausesdatabase过载
- **Suggested Fix**: 
  1. Implement single-flight 模式
  2. Add请求排队机制
  3. Use分布式锁Protect缓存Update

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - Clean up仅在 record() Call时Trigger
  - 空闲时none后台Clean up
  - maycauses内存持续增长
- **Suggested Fix**: 
  1. Add定期后台Clean uptask
  2. Use独立的Clean upthread
  3. Add内存UseMonitor

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket service器
- **Issue Description**: 
  - getClientCount() exists但not yetthrough HTTP endpointExpose
  - none pendingAcks 队column深度指标
  - noneConnectestablishAlert
- **Suggested Fix**: 
  1. through metrics endpointExposeConnect指标
  2. Add pendingAcks 队columnMonitor
  3. AddConnect数exceptionAlert

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在Heartbeat Sweep 时Check isAlive
  - none per-client 独立于Heartbeat的空闲timeout
  - Authenticate后从not发送message的client只能throughHeartbeatfailure检测
- **Suggested Fix**: 
  1. Add per-client idle timeout
  2. 独立于Heartbeat间隔
  3. Configure可Adjust

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意client可Subscribe 100 个task
  - none全局taskSubscribe者限制
- **Suggested Fix**: 
  1. Add全局taskSubscribe者限制
  2. Implement per-task Subscribe者上限
  3. Add反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - Configurewith "version": "v4.3"
  - 但none schema 版本Validate
  - Load时mayAcceptnotCompatibilityConfigure
- **Suggested Fix**: 
  1. Add JSON Schema Validate
  2. Implement版本Compatibility性Check
  3. Start时ValidateConfigurecomplete性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder array的 splice 操作is O(n)
  - 高频access时may性能issue
- **Suggested Fix**: 
  1. Use LinkedList 替代array
  2. orUse Map 维护accessin order
  3. 性能TestValidate

### Summary

本次补充Review（第十三轮 - 缓存will话与实时通信Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求willfailure）
2. Mission Routes errorresponseWrapnot当
3. WebSocketBridge none最大Connect数限制（DoSrisk）
4. pendingAcks DisconnectConnect时not yetClean up（memory leak）
5. 硬Encodefallback密钥（Securevulnerability）
6. config/runtime/test.json 缺少timeoutConfigure
7. prod.json maxConcurrentTasks=1 限制too strict
8. multipleserviceexistsnone界 Map（memory leakrisk）

**Medium Priority**:
1. taskEventHistory Map 永notClean up
2. SecureConfigure drift（remoteWorkerRegistration missing）
3. OpenAPI endpointresponseformatnot一致
4. Redis 队column idempotency Implementnotcomplete
5. 请求去重中间件Use内存Store（多instancenot共享）
6. Cache none stampede Protect
7. EvidenceService eviction 仅在Insert时Trigger

**Low Priority**:
1. noneConnect指标Expose
2. none空闲clienttimeout
3. Subscribe限制is per-client 而非全局
4. config/runtime none版本Validate机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 64 | 74 | 35 | 173 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix CORS allowedMethods Add PUT/PATCH/DELETE
2. fix Mission Routes errorresponseformat
3. 为 WebSocketBridge Add最大Connect数限制
4. Clean up pendingAcks 和 taskEventHistory
5. Remove硬Encodefallback密钥
6. fix config/runtime/test.json Configure
7. EvaluateandAdjust prod and发限制

**Short Term (This Month)**:
1. UnifySecureConfigure（remoteWorkerRegistration）
2. Implementnone界 Map 的 LRU/TTL 驱逐
3. Unify API response信封format
4. 完善 Redis idempotency Implement
5. Add分布式去重中间件
6. Implement cache stampede Protect

**Long Term Planning**:
1. establishcompleteConnection management和Monitor
2. Implement后台Clean uptask框架
3. AddConfigure schema Validate
4. Optimize高频繁操作的数据structure
5. establish内存Use基线和Alert

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] automaticReviewReport（第十一轮 - and发Secure与可观测性Review）

### Newly Discovered Issues

#### 1. [Source Code] [Critical] [FencingTokenService 静态可变statenone锁Protect]
- **File/Path**: `src/platform/five-plane-state-evidence/events/cas/fencing-token-service.ts:71-73`
- **Issue Description**: 
  ```typescript
  private static readonly activeFences = new Map<string, FenceInfo>();
  private static globalTokenCounter = 0;
  ```
  - `acquireFence` methodExecute非atomic read-then-write 模式
  - 两个and发CallmaysimultaneouslythroughCheck，causesstatenot一致
  - 静态 Map 在none锁情况下被and发读写
- **Suggested Fix**: 
  1. AddMutual exclusion锁Protect activeFences access
  2. Use原子操作or Compare-And-Swap
  3. ConsiderUsedatabaserow锁替代内存锁

#### 2. [Source Code] [Critical] [AsyncFencingTokenService.globalTokenCounter notSecure递增]
- **File/Path**: `src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts:13-17`
- **Issue Description**: 
  ```typescript
  private static readonly globalTokenCounter = {
    value: 0,
    getAndIncrement(): number { return ++this.value; }
  };
  ```
  - 经典的 read-modify-write race condition条件
  - 多threadmay读到相同的value
- **Suggested Fix**: 
  1. Use `pg_advisory_xact_lock` Protect
  2. orUsedatabase自增序column
  3. Remove静态计数器，UsedatabaseGenerate

#### 3. [Source Code] [Critical] [BudgetAllocator.activeReservations noneProtect Map]
- **File/Path**: `src/platform/five-plane-execution/budget-allocator.ts:394,426,458,467,569,657,711`
- **Issue Description**: 
  ```typescript
  this.activeReservations.set(result.reservation.budgetReservationId, result.reservation);
  this.activeReservations.delete(reservationId);
  ```
  - and发codepath修改 activeReservations Map
  - none锁Protect
- **Suggested Fix**: 
  1. Add Map 级别的读写锁
  2. Use ConcurrentMap orclass似structure
  3. Refactor为nonestate设计

#### 4. [Source Code] [High Severity] [SqliteLockAdapter.fencingCounter notSync]
- **File/Path**: `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:9,14,48,74,88`
- **Issue Description**: 
  - `fencingCounter` 在 acquire/extend/forceSteal 中递增
  - noneSync机制
- **Suggested Fix**: 
  1. Use SQLite 序column替代内存计数器
  2. orAdd appropriateSync机制

#### 5. [Source Code] [High Severity] [ServiceRegistry.getInstance() Check-then-Create race condition]
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
  - 两个threadmaysimultaneouslysee _instance 为 null
  - Create两个instance
- **Suggested Fix**: 
  1. Use double-checked locking
  2. orUse ES2022 静态fieldInitialize
  3. `private static readonly _instance = new ServiceRegistry();`

#### 6. [Source Code] [Medium Severity] [StructuredLogger.rotationStateByPath Asyncrace condition]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts:142-144,438-453`
- **Issue Description**: 
  ```typescript
  private static rotationStateByPath = new Map<string, {...}>();
  ```
  - `writeToGlobalFileSink` 中exists TOCTOU race condition
  - Read pendingBytes 和实际Writebetweenmay被其他Call修改
- **Suggested Fix**: 
  1. Use锁Protect rotationStateByPath
  2. orUse单threadWrite队column

#### 7. [Source Code] [Medium Severity] [EffectBuffer.scopes and发修改risk]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/effect-buffer.ts:446,452,476,485,492,502-514`
- **Issue Description**: 
  - `scopes.delete(scopeId)` 与 `for (const [scopeId, scope] of this.scopes)` and发
  - flush() 和 createScope maysimultaneously修改
- **Suggested Fix**: 
  1. Add迭代锁
  2. Use CopyOnWrite 模式
  3. 在修改时Copy一份 scopes

#### 8. [Source Code] [Medium Severity] [OIDC _skipSignatureVerification 标志existsrisk]
- **File/Path**: `src/platform/five-plane-interface/api/oidc-oauth-service.ts:92,108-111`
- **Issue Description**: 
  - `_skipSignatureVerification` 标志exists于productioncodepath
  - althoughMark为仅TestUse，但ConfigureerrormaycausesSecureissue
- **Suggested Fix**: 
  1. Remove此标志orEnsureCompile时完全Delete
  2. Addproduction environmentCheckThrowerror
  3. 在codeReview中Mark为Forbid模式

#### 9. [Source Code] [Medium Severity] [Browser Executor 检测但not消毒 innerHTML]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:541`
- **Issue Description**: 
  - 检测到 innerHTML 但只返回假数据
  - not进row实际消毒
  - 用户maybypassProtect
- **Suggested Fix**: 
  1. Use DOMPurify orclass似库消毒
  2. or完全Forbid innerHTML
  3. 返回error而非假数据

#### 10. [Database] [High Severity] [runtime-physical-schema none外keyconstraint]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts`
- **Issue Description**: 
  - `task_draft_id`, `confirmed_task_spec_id`, `harness_run_id` 等columnnone FK constraint
  - maycauses孤儿Record
  - Delete父Record时子Record变为孤立
- **Suggested Fix**: 
  1. Add外keyconstraint
  2. Implement软Delete而非硬Delete
  3. Adddatabasemigrate脚本

#### 11. [Database] [Medium Severity] [大partialtable缺少软Delete和Auditfield]
- **File/Path**: multipletable（除 mission_records 外）
- **Issue Description**: 
  - 只with mission_records withcompleteAudit：created_at, created_by, updated_at, updated_by, archived_at, archived_by
  - 大partialtable缺少 deleted_at, is_deleted 软Deletefield
  - created_by/updated_by 仅在 mission_records 系list中exists
- **Suggested Fix**: 
  1. 为所with核心tableAdd auditingfield
  2. Implement软Delete模式
  3. Add规范Explain哪些tableMustwithAudit

#### 12. [CI/CD] [High Severity] [UI quality workflow nonecoverage门禁]
- **File/Path**: `.github/workflows/ui-quality.yml:33`
- **Issue Description**: 
  - Run `test:coverage` 但none阈valueExecute
  - 缺少 `coverage:gate`
  - 与主 CI not一致
- **Suggested Fix**: 
  1. Add `npm run coverage:gate` 到 UI workflow
  2. orEnsure UI 更改时Run主 CI

#### 13. [CI/CD] [High Severity] [Deployworkflownone真正的manual审批]
- **File/Path**: `.github/workflows/deploy-environment.yml`
- **Issue Description**: 
  - `workflow_dispatch` with环境Protect但noneexplicit审批步骤
  - deploy.sh 的productionConfirmUse `read -p` 在 CI/CD 中will挂起
  - productionDeploy缺少真正的审批控制
- **Suggested Fix**: 
  1. Use GitHub Environment `required_reviewers`
  2. 修改 deploy.sh 检测 CI 环境Skip交互
  3. Addexplicit审批步骤

#### 14. [CI/CD] [Medium Severity] [Rollback机制边界情况not yetProcess]
- **File/Path**: `.github/workflows/deploy-environment.yml:230-278`, `deploy/scripts/rollback.sh`
- **Issue Description**: 
  - Deploysuccess但 health check failure时notwillTriggerRollback
  - rollback.sh 只Support dev|staging|prod（deploy.sh Support dev|test|staging|pre-prod|prod）
  - pre-prod Name空间not一致：automatic-agent-preprod vs automatic-agent-pre-prod
- **Suggested Fix**: 
  1. Add health check failure时的RollbackTrigger
  2. Unify rollback.sh Support所with环境
  3. correct pre-prod Name空间

#### 15. [CI/CD] [Medium Severity] [Canary/Blue-Green Upgradenone健康Check]
- **File/Path**: `.github/workflows/deploy-environment.yml:188-199`
- **Issue Description**: 
  - 初始Deploywith health checks
  - 但 promotion 步骤none健康Validate
  - mayPushnot健康的版本
- **Suggested Fix**: 
  1. 在 promotion 步骤后Add health check
  2. ValidatePush的版本through健康Check
  3. failure时Rollback

#### 16. [Observability] [High Severity] [58处 console.* Use应Use StructuredLogger]
- **File/Path**: multiplefile
- **Issue Description**: 
  - `src/index.ts`: 4次
  - `src/platform/ops-maturity/platform-panic/panic-propagation-service.ts`: 2 console.error + 1 console.log
  - `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts`: 1 console.error
  - `src/platform/five-plane-orchestration/harness/runtime/runtime-entry-guard.ts`: 3 console.warn
  - `src/ops-maturity/chaos/chaos-experiment-scheduler.ts`: 5 console.log + 4 console.warn
  - CLI 工具中多处
- **Suggested Fix**: 
  1. Replace console.* 为 StructuredLogger
  2. Keep CLI 输出的 console 用法（可Accept）
  3. Add ESLint 规则检测

#### 17. [Observability] [High Severity] [29+Execute引擎file缺少structure化log]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - `runtime-state-machine.ts`: with try/catch 但none StructuredLogger
  - `multi-step-orchestration.ts`: 导入 HealthService 但none StructuredLogger
  - `agent-executor.ts`: 169个 try 块，0 StructuredLogger Call
  - 关keyExecutepath缺少可观测性
- **Suggested Fix**: 
  1. 为所withExecute引擎fileAdd StructuredLogger
  2. Record关key操作path
  3. Ensureerrorpathwithlog

#### 18. [Observability] [High Severity] [Execute引擎缺少 LLM Call指标]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - RuntimeMetricsRegistry Support `recordLlmLatency`, `recordHarnessRunDuration` 等
  - 但Execute引擎中noneCall
  - model-gateway with指标但Execute引擎none
- **Suggested Fix**: 
  1. 在 agent-executor 中Record LLM Call指标
  2. 在 multi-step-orchestration 中Record harness 指标
  3. enablecomplete指标覆盖

#### 19. [Observability] [Medium Severity] [logmethodUsenot一致]
- **File/Path**: multipleservice
- **Issue Description**: 
  - with的Use `.error()`, `.warn()` 辅助method
  - with的Use `logger.log({ level: "error", ... })`
  - noneUnify规范
- **Suggested Fix**: 
  1. establishlogmethod规范
  2. Add ESLint 规则Unify
  3. Refactor为一致的 helper methodCall

#### 20. [Security] [Medium Severity] [输入Validatewith限 - 仅 JWT 强class型]
- **File/Path**: multiple API endpoint
- **Issue Description**: 
  - JWT claims with强class型Validate
  - 其他输入Validatewith限
  - 缺少通用输入消毒
- **Suggested Fix**: 
  1. Add通用输入Validate中间件
  2. Use zod orclass似库Validate请求体
  3. 为所with API endpointAdd validation

#### 21. [Source Code] [Low Severity] [HA Coordinator Leadership 获取may非原子]
- **File/Path**: `src/platform/five-plane-execution/ha/ha-coordinator-service-inner.ts:70-78`
- **Issue Description**: 
  - `acquireLeadership` mayExecute非atomic read-modify-write
  - leadership epoch Updatemayexistsrace condition
- **Suggested Fix**: 
  1. Usedatabaserow锁Protect
  2. Ensure领导者选举原子性
  3. Add领导者租约续约机制

### Summary

本次补充Review（第十一轮 - and发Secure与可观测性Review - 2026-05-14）found了21个新issue，with focus onand发Secure、可观测性和CI/CD。

**High Priority (Requires Immediate Action)**:
1. 7个and发race conditionissue（FencingTokenService, BudgetAllocator, ServiceRegistry等）
2. runtime-physical-schema none外keyconstraint
3. UI quality workflow nonecoverage门禁
4. 58处 console.* Use应Replace with StructuredLogger
5. 29+ Execute引擎file缺少structure化log
6. Execute引擎缺少 LLM Call指标

**Medium Priority**:
1. OIDC _skipSignatureVerification 标志risk
2. Browser Executor innerHTML not消毒
3. 大partialtable缺少软Delete和Auditfield
4. Deployworkflownone真正manual审批
5. Rollback机制边界情况not yetProcess
6. Canary/Blue-Green Upgradenone健康Check
7. logmethodUsenot一致
8. 输入Validatewith限

**Low Priority**:
1. HA Coordinator Leadership 获取may非原子
2. SqliteLockAdapter fencingCounter notSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 58 | 62 | 29 | 149 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 8 | 31 | 19 | 58 |
| Secure | 7 | 8 | 1 | 16 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **84** | **135** | **66** | **285** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix所with7个and发race conditionissue
2. Add runtime-physical-schema 外keyconstraint
3. 为 UI quality workflow Addcoverage门禁
4. Replace关keypath的 console.* 为 StructuredLogger
5. 在Execute引擎中Add LLM 和 harness 指标

**Short Term (This Month)**:
1. 为所withExecute引擎fileAddstructure化log
2. AdddatabaseAuditfield和软Delete
3. correctDeployworkflow审批机制
4. UnifylogmethodUse规范
5. Add Canary/Blue-Green 健康Check

**Long Term Planning**:
1. establishand发SecureEncode规范
2. Implementcomplete可观测性标准
3. 完善databaseconstraint和Audit机制
4. Enhance CI/CD 质量和Secure门禁
5. establishcodeReview清单

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
  - 浏览器 CORS preflight willReject PUT/PATCH/DELETE 请求
  - 但route中with PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. Add PUT, PATCH, DELETE 到 allowedMethods
  2. Ensure CORS Configure与Applyroutemethod一致
  3. Add testsValidate所with HTTP method的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - Use buildJsonResponse（successWrap）返回error
  - error被Wrap在success信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. Use buildJsonErrorResponse Processerror
  2. Ensure所witherrorpathUsecorrecterror信封
  3. Add API consistencyTest

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // none maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 not同
  - 恶意client可耗尽service器资源
- **Suggested Fix**: 
  1. Add maxConnections 限制
  2. ImplementConnect限制Reject策略
  3. AddConnect计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection Clean up subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map not yetClean up
  - Disconnect的clientnot yetConfirm的message永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中Delete所with pendingAcks 条目
  2. ConsiderAdd timeout机制automaticClean upnot yetConfirmmessage
  3. RecordClean up操作的Auditlog

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作fallback
  - If环境variablenot yetSet，UsenotSecure密钥
- **Suggested Fix**: 
  1. Removefallbackvalue，Require环境variableMustSet
  2. 在Start时Validate密钥exists且足够强
  3. If密钥missingcausesStartfailure

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只with3个field，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - fallback到by defaultvaluemaynot适合Test环境
- **Suggested Fix**: 
  1. Add complete timeout/tuning Configure
  2. EnsureTest环境with合理的by defaultvalue
  3. DocumentrequiredConfigurefield

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - production environment严重受限，mayimpact吞吐量
- **Suggested Fix**: 
  1. EvaluateandAdjustproduction限制
  2. 与业务需求匹配
  3. Addproduction容量Test

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: multiple域service
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps none限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等none限制
  - `domain-recipe-service.ts:67-68`: recipes, versions none限制
  - `domain-risk-profile-service.ts:51`: profiles none限制
  - Session Maps (session-management.ts:83-89) noneautomaticClean up
- **Suggested Fix**: 
  1. 为所with Map Implement LRU or TTL 驱逐策略
  2. Add后台Clean uptask
  3. Add大小Monitor和Alert

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单task历史为 200 条
  - 但 Map 本身从notClean up
  - CancelSubscribe的task历史永久Keep
- **Suggested Fix**: 
  1. Implement后台Clean upnoneSubscribe者task的历史
  2. AddtaskSubscribe者Monitor
  3. ConsiderUse WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json withcomplete remoteWorkerRegistration Configure
  - dev/staging/pre-prod 只with approvalMode
  - prod with approvalMode 但none remoteWorkerRegistration
  - SecureConfigurenot一致
- **Suggested Fix**: 
  1. Unify所with环境的 remoteWorkerRegistration
  2. AddSecureConfigureValidate
  3. Ensure最低Secure基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` Use buildJsonDocumentResponse（noneWrap）
  - 其他endpointUse buildJsonResponse（{requestId, data} Wrap）
  - client体验not一致
- **Suggested Fix**: 
  1. Unifyresponse信封format
  2. Documentresponseformat规范
  3. AddresponseformatValidateTest

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite withpartial唯一indexSupport idempotency
  - Redis ImplementUseHashindex但Implementnotcomplete
  - maycauses重复message
- **Suggested Fix**: 
  1. 完善 Redis idempotency Implement
  2. Add唯一indexValidate
  3. Ensure与 SQLite row为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - none外部Store
  - 多instanceDeploynot共享
  - Restart后去重state丢失
- **Suggested Fix**: 
  1. Use Redis 替代内存Store
  2. Support分布式去重
  3. 持久化去重state

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: multiple cache Implement
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService none锁
  - 缓存not yet命中时可occur thundering herd
  - 高and发下maycausesdatabase过载
- **Suggested Fix**: 
  1. Implement single-flight 模式
  2. Add请求排队机制
  3. Use分布式锁Protect缓存Update

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - Clean up仅在 record() Call时Trigger
  - 空闲时none后台Clean up
  - maycauses内存持续增长
- **Suggested Fix**: 
  1. Add定期后台Clean uptask
  2. Use独立的Clean upthread
  3. Add内存UseMonitor

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket service器
- **Issue Description**: 
  - getClientCount() exists但not yetthrough HTTP endpointExpose
  - none pendingAcks 队column深度指标
  - noneConnectestablishAlert
- **Suggested Fix**: 
  1. through metrics endpointExposeConnect指标
  2. Add pendingAcks 队columnMonitor
  3. AddConnect数exceptionAlert

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在Heartbeat Sweep 时Check isAlive
  - none per-client 独立于Heartbeat的空闲timeout
  - Authenticate后从not发送message的client只能throughHeartbeatfailure检测
- **Suggested Fix**: 
  1. Add per-client idle timeout
  2. 独立于Heartbeat间隔
  3. Configure可Adjust

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意client可Subscribe 100 个task
  - none全局taskSubscribe者限制
- **Suggested Fix**: 
  1. Add全局taskSubscribe者限制
  2. Implement per-task Subscribe者上限
  3. Add反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - Configurewith "version": "v4.3"
  - 但none schema 版本Validate
  - Load时mayAcceptnotCompatibilityConfigure
- **Suggested Fix**: 
  1. Add JSON Schema Validate
  2. Implement版本Compatibility性Check
  3. Start时ValidateConfigurecomplete性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder array的 splice 操作is O(n)
  - 高频access时may性能issue
- **Suggested Fix**: 
  1. Use LinkedList 替代array
  2. orUse Map 维护accessin order
  3. 性能TestValidate

### Summary

本次补充Review（第十三轮 - 缓存will话与实时通信Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求willfailure）
2. Mission Routes errorresponseWrapnot当
3. WebSocketBridge none最大Connect数限制（DoSrisk）
4. pendingAcks DisconnectConnect时not yetClean up（memory leak）
5. 硬Encodefallback密钥（Securevulnerability）
6. config/runtime/test.json 缺少timeoutConfigure
7. prod.json maxConcurrentTasks=1 限制too strict
8. multipleserviceexistsnone界 Map（memory leakrisk）

**Medium Priority**:
1. taskEventHistory Map 永notClean up
2. SecureConfigure drift（remoteWorkerRegistration missing）
3. OpenAPI endpointresponseformatnot一致
4. Redis 队column idempotency Implementnotcomplete
5. 请求去重中间件Use内存Store（多instancenot共享）
6. Cache none stampede Protect
7. EvidenceService eviction 仅在Insert时Trigger

**Low Priority**:
1. noneConnect指标Expose
2. none空闲clienttimeout
3. Subscribe限制is per-client 而非全局
4. config/runtime none版本Validate机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 64 | 74 | 35 | 173 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix CORS allowedMethods Add PUT/PATCH/DELETE
2. fix Mission Routes errorresponseformat
3. 为 WebSocketBridge Add最大Connect数限制
4. Clean up pendingAcks 和 taskEventHistory
5. Remove硬Encodefallback密钥
6. fix config/runtime/test.json Configure
7. EvaluateandAdjust prod and发限制

**Short Term (This Month)**:
1. UnifySecureConfigure（remoteWorkerRegistration）
2. Implementnone界 Map 的 LRU/TTL 驱逐
3. Unify API response信封format
4. 完善 Redis idempotency Implement
5. Add分布式去重中间件
6. Implement cache stampede Protect

**Long Term Planning**:
1. establishcompleteConnection management和Monitor
2. Implement后台Clean uptask框架
3. AddConfigure schema Validate
4. Optimize高频繁操作的数据structure
5. establish内存Use基线和Alert

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
    // WITHOUT tenantId: 返回所with租户的Quota！
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - 当 tenantId 为空时返回所with租户的Quota
  - not yet经Authorize的information disclosure
- **Suggested Fix**: 
  1. RequireCall者MustProvide tenantId
  2. Add权限ValidateEnsure只能查看自己的Quota
  3. AuditlogRecord所withQuotaaccess

#### 2. [Security] [High Severity] [assertTaskTenantAccess() returns 404 instead of 403 - resource existence leaked]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**: 
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // shouldis403
  }
  ```
  - cross-tenantaccess返回404而非403
  - 泄露了资源exists但属于其他租户的信息
  - attack者可检测with效task ID
- **Suggested Fix**: 
  1. Change to返回403 Forbidden
  2. not要泄露资源is否exists

#### 3. [Security] [High Severity] [crossTenantRequest flag controlled by caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**: 
  - `routeOrgBudget()` Accept `crossTenantRequest?: boolean` parameter
  - 该标志由Call者Set，非系统派生
  - attack者may操纵此标志bypasscross-tenant限制
- **Suggested Fix**: 
  1. 标志应由系统state派生，notAcceptCall者输入
  2. Add auditinglogTracecross-tenant请求
  3. Implement零信任cross-tenantaccess模型

#### 4. [Source Code] [High Severity] [single-task-happy-path has no retry mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**: 
  - `maxRetries: 0` 和 `retryBackoff: "none"`
  - 瞬态failurenoneautomaticretry
  - LLMCallfailure时nonefallback到备用provider
- **Suggested Fix**: 
  1. enable非关keyExecute的retry
  2. ImplementLLM provider fallback链（Anthropic → OpenAI → MiniMax）
  3. Usedomain baseline catalog的primary/fallback模型偏好

#### 5. [Source Code] [High Severity] [LLM calls have no circuit breaker protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - circuit break器只exists于 channel-gateway 和 call-governance
  - 直接LLM providerCallnonecircuit break器
  - providerDegrade时none法快速failure
- **Suggested Fix**: 
  1. 在model-call-provider.tsAdd circuit breaker
  2. 当providerfailure率超阈value时快速failure
  3. automatic切换到备用provider

#### 6. [Security] [High Severity] [Distributed rate limiter bypass - not shared between instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**: 
  - Redisnot yetConfigure时UselocalMap
  - 每个instance维护自己的localEntries
  - attack者可through切换instancebypassRate limit
- **Suggested Fix**: 
  1. RequireRedisConfigure用于production
  2. orUseRedis作为所withinstance的共享后端
  3. 检测andWarnnot yetConfigureRedis的instance

#### 7. [Configuration] [Medium Severity] [Soft quota (log_only) does not actually limit]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**: 
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // log_only时返回true
  ```
  - soft quota只Recordlog，not实际阻止
  - Quota形同虚设
- **Suggested Fix**: 
  1. Clarify区分"Monitor模式"和"强制模式"
  2. 对于硬QuotaMust阻止
  3. Documentquotaclass型的实际row为

#### 8. [Configuration] [Medium Severity] [HTTP layer lacks rate limit headers - clients cannot know limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**: 
  - not yet返回 X-RateLimit-* 头
  - 只在429response时返回retry-after-ms
  - clientnone法主动管理请求速率
- **Suggested Fix**: 
  1. 在所withresponseAdd X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  2. Use标准头名称
  3. 遵循RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP layer lacks rate limit - optional and only by IP]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**: 
  - Rate limit仅在 `this.rateLimiter != null` 时生效
  - Rate limitkey为 `${clientIp}:${endpoint}` 仅按IP
  - noneper-tenant/per-principal enforcement
- **Suggested Fix**: 
  1. by defaultenableRate limit
  2. Addper-tenantRate limitkey
  3. Ensure所with环境by defaultConfigureRate limit

#### 10. [Security] [Medium Severity] [processRuleMode may not be enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**: 
  - `SandboxPolicy.processRuleMode` Set为 "allow" or "deny"
  - 但not yetfound实际阻止based on此策略Generateprocess的实际Executecode
  - `--allow-child-process` 标志仅在 sandboxed_process Isolate模式Apply
- **Suggested Fix**: 
  1. ValidateprocessRuleMode实际被强制Execute
  2. Ensure所withIsolate模式正确Process
  3. Add testsValidateprocessCreate被阻止

#### 11. [Security] [Medium Severity] [Container template replacement not validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**: 
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - 简单字符串Replace
  - althoughvalidateContainerLaunchPluginId()阻止\0和引号
  - 但模板Replace本身not yetValidate
- **Suggested Fix**: 
  1. Add输入Validate防止injection
  2. Use更Secure的模板引擎
  3. Validate所with占位符被Replace

#### 12. [Security] [Medium Severity] [Adapter execution bypasses sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**: 
  - AdapterExecuteREST/grpc/MQCallnot经过ScopedExternalAccessSandbox
  - with自己的allowedDomainsConfigure但非Centralize管理
  - may发起not yet限制的出站请求
- **Suggested Fix**: 
  1. AdapterExecute经过Centralizesandbox
  2. Unifyexternal access策略
  3. Addadapter出站请求Audit

#### 13. [Security] [Medium Severity] [Silent pass-through when principal.tenantId is null]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**: 
  ```typescript
  if (principal.tenantId == null) {
    return;  // 静默放row
  }
  ```
  - IfAPI网关AllownoneprincipalAuthenticate的请求through
  - may授予cross-tenantaccess权限
- **Suggested Fix**: 
  1. Require所withAPI请求withwith效principal
  2. null tenantId应Reject而非静默放row
  3. Add auditinglog

#### 14. [Source Code] [Medium Severity] [No LLM provider fallback chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**: 
  - 主providerfailure时noneautomatic切换
  - domain-baseline-catalog.tsDefine了primary/fallback模型偏好但not yetUse
  - 第一个providerfailure即causesExecutefailure
- **Suggested Fix**: 
  1. Implementprovider fallback链
  2. Usedomain baseline的primary/fallbackConfigure
  3. 按优先级尝试直到successorallfailure

#### 15. [Source Code] [Medium Severity] [Timeout values hardcoded]
- **File/Path**: multiplefile
- **Issue Description**: 
  - Effect bufferwith固定timeoutreject
  - Channel gateway的requestTimeoutMs虽可Configure但withmax 30s限制
  - none全局请求timeout中间件
- **Suggested Fix**: 
  1. CentralizetimeoutConfigure
  2. per-environment可Configure
  3. Add全局timeout中间件

#### 16. [Database] [Medium Severity] [No down migration - rollback not supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**: 
  - `rollbackSupported = false`
  - 每个migration只with `downSql` 占位符
  - schema migrationnone法Rollback
- **Suggested Fix**: 
  1. DocumentRollback限制
  2. 在变更前Createcompletebackup
  3. Useblue-greenDeploy减少Rollback需求

#### 17. [Database] [Medium Severity] [Migration 44 special handling - duplicate table creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**: 
  - Migration 43Createharness_runstable
  - Migration 44再次Create同名table（not同schema）
  - UseapplyCompatibleColumnMigrationIfKnown特殊Process
- **Suggested Fix**: 
  1. eliminate重复tableCreate
  2. UseALTER TABLE而非CREATE TABLE
  3. Simplifymigration逻辑

#### 18. [Configuration] [Low Severity] [Provider rate limit headers not forwarded to client]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**: 
  - 系统Readprovider的ratelimitResetHeaderNames
  - 但not转发给client
  - clientnone法知道providerRate limitstate
- **Suggested Fix**: 
  1. 转发Provider的Rate limit头
  2. orAddApply层Rate limit信息
  3. 帮助clientOptimize请求

#### 19. [Security] [Low Severity] [Browser evaluate accepts arbitrary scripts]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**: 
  - `evaluate` actionAcceptscriptparameter
  - 在浏览器上下文Run（模拟）
  - 如浏览器上下文not yet正确sandbox化mayis向量
- **Suggested Fix**: 
  1. Validate浏览器上下文正确sandbox化
  2. 消毒or限制script内容
  3. Record所withevaluateCall

#### 20. [Source Code] [Low Severity] [No global error boundary wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - Execute引擎缺少unhandled promise rejection的全局Process
  - single-task-happy-path的LLM fallbackfailure时error向上传播
- **Suggested Fix**: 
  1. 在Execute引擎Add error boundariesWrap
  2. UnifyerrorProcess模式
  3. Ensure所witherror被Catch和Record

### Summary

本次补充Review（第十二轮 - errorProcess与多租户SecureReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. listQuotas()返回所with租户Quota（information disclosure）
2. assertTaskTenantAccess()返回404泄露资源exists
3. crossTenantRequest标志可被操纵
4. single-task-happy-pathnoneretry（maxRetries=0）
5. LLMCallnonecircuit break器Protect
6. 分布式Rate limit器可被bypass（instance间not共享）

**Medium Priority**:
1. Soft quota实际not阻止
2. noneX-RateLimit-*response头
3. HTTP层Rate limitoptional且仅按IP
4. processRuleModemaynot yet强制
5. 容器模板Replacenot yetValidate
6. AdapterExecutebypasssandbox
7. null principal静默放row
8. noneLLM provider fallback链
9. timeoutvalue硬Encode
10. nonedown migration
11. Migration 44特殊Process

**Low Priority**:
1. ProviderRate limit头not yet转发
2. Browser evaluateAccept任意脚本
3. none全局error边界

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 60 | 68 | 31 | 159 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 8 | 35 | 21 | 64 |
| Secure | 12 | 13 | 3 | 28 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **91** | **150** | **72** | **313** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fixlistQuotas()information disclosurevulnerability
2. correctassertTaskTenantAccess()返回403
3. RemovecrossTenantRequestCall者控制
4. enableExecute引擎retry机制
5. AddLLM providercircuit break器

**Short Term (This Month)**:
1. fix分布式Rate limit器bypassissue
2. AddX-RateLimit-*response头
3. enableby defaultHTTPRate limit（per-tenant）
4. ImplementLLM provider fallback链
5. Validateand强制processRuleMode

**Long Term Planning**:
1. establishcompleteRate limit和Quota体系
2. Implement插件系统SecureAudit
3. establish多租户SecureTest
4. 完善errorProcess和Recover机制
5. Unifytimeout和circuit breakConfigure

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
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
  - 浏览器 CORS preflight willReject PUT/PATCH/DELETE 请求
  - 但route中with PATCH /v1/tasks/:id, DELETE endpoints
- **Suggested Fix**: 
  1. Add PUT, PATCH, DELETE 到 allowedMethods
  2. Ensure CORS Configure与Applyroutemethod一致
  3. Add testsValidate所with HTTP method的 CORS preflight

#### 2. [Security] [Critical] [Mission Routes error response wrapping improper]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/mission-routes.ts:101,118-124`
- **Issue Description**: 
  ```typescript
  return buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } });
  ```
  - Use buildJsonResponse（successWrap）返回error
  - error被Wrap在success信封 `{requestId, data: {error: {...}}}` 中
  - 违反 REST 规范
- **Suggested Fix**: 
  1. Use buildJsonErrorResponse Processerror
  2. Ensure所witherrorpathUsecorrecterror信封
  3. Add API consistencyTest

#### 3. [Source Code] [High Severity] [WebSocketBridge has no max connection limit]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:103-107`
- **Issue Description**: 
  ```typescript
  this.wss = new WebSocketServer({
    server,
    path: WS_PATH,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    // none maxConnections 限制！
  });
  ```
  - 与 dashboard-websocket-server.ts 的 maxClients: 1000 not同
  - 恶意client可耗尽service器资源
- **Suggested Fix**: 
  1. Add maxConnections 限制
  2. ImplementConnect限制Reject策略
  3. AddConnect计数指标

#### 4. [Source Code] [High Severity] [pendingAcks not cleaned up on disconnect]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:268-282`
- **Issue Description**: 
  - handleDisconnection Clean up subscribedTasks, taskSubscribers, slowConsumers
  - 但 pendingAcks Map not yetClean up
  - Disconnect的clientnot yetConfirm的message永久留在内存
- **Suggested Fix**: 
  1. 在 handleDisconnection 中Delete所with pendingAcks 条目
  2. ConsiderAdd timeout机制automaticClean upnot yetConfirmmessage
  3. RecordClean up操作的Auditlog

#### 5. [Security] [High Severity] [Hardcoded fallback key]
- **File/Path**: `src/platform/five-plane-control-plane/iam/audit-event-integrity.ts:41`
- **Issue Description**: 
  ```typescript
  const AUDIT_INTEGRITY_HMAC_KEY = process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ?? "audit-integrity-secret-key-32-bytes!";
  ```
  - 占位符密钥用作fallback
  - If环境variablenot yetSet，UsenotSecure密钥
- **Suggested Fix**: 
  1. Removefallbackvalue，Require环境variableMustSet
  2. 在Start时Validate密钥exists且足够强
  3. If密钥missingcausesStartfailure

#### 6. [Configuration] [High Severity] [config/runtime/test.json missing timeout configuration]
- **File/Path**: `config/runtime/test.json`
- **Issue Description**: 
  - 只with3个field，缺少 maxConcurrentTasks, defaultTaskTimeoutMs, defaultStepTimeoutMs
  - fallback到by defaultvaluemaynot适合Test环境
- **Suggested Fix**: 
  1. Add complete timeout/tuning Configure
  2. EnsureTest环境with合理的by defaultvalue
  3. DocumentrequiredConfigurefield

#### 7. [Configuration] [High Severity] [prod.json limits too strict - maxConcurrentTasks=1]
- **File/Path**: `config/runtime/prod.json`
- **Issue Description**: 
  - maxConcurrentTasks: 1（vs dev:8, staging:4, pre-prod:6）
  - defaultTaskTimeoutMs: 120000（vs dev:600000）
  - defaultStepTimeoutMs: 60000（vs dev:180000）
  - production environment严重受限，mayimpact吞吐量
- **Suggested Fix**: 
  1. EvaluateandAdjustproduction限制
  2. 与业务需求匹配
  3. Addproduction容量Test

#### 8. [Source Code] [High Severity] [Multiple services have unbounded Maps without eviction strategy]
- **File/Path**: multiple域service
- **Issue Description**: 
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps none限制
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes 等none限制
  - `domain-recipe-service.ts:67-68`: recipes, versions none限制
  - `domain-risk-profile-service.ts:51`: profiles none限制
  - Session Maps (session-management.ts:83-89) noneautomaticClean up
- **Suggested Fix**: 
  1. 为所with Map Implement LRU or TTL 驱逐策略
  2. Add后台Clean uptask
  3. Add大小Monitor和Alert

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map never cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**: 
  - taskEventHistory 限制单task历史为 200 条
  - 但 Map 本身从notClean up
  - CancelSubscribe的task历史永久Keep
- **Suggested Fix**: 
  1. Implement后台Clean upnoneSubscribe者task的历史
  2. AddtaskSubscribe者Monitor
  3. ConsiderUse WeakMap 替代

#### 10. [Configuration] [Medium Severity] [Security configuration drift - remoteWorkerRegistration missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - default.json withcomplete remoteWorkerRegistration Configure
  - dev/staging/pre-prod 只with approvalMode
  - prod with approvalMode 但none remoteWorkerRegistration
  - SecureConfigurenot一致
- **Suggested Fix**: 
  1. Unify所with环境的 remoteWorkerRegistration
  2. AddSecureConfigureValidate
  3. Ensure最低Secure基线

#### 11. [API] [Medium Severity] [OpenAPI endpoint response format inconsistent]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**: 
  - `/v1/openapi.json` Use buildJsonDocumentResponse（noneWrap）
  - 其他endpointUse buildJsonResponse（{requestId, data} Wrap）
  - client体验not一致
- **Suggested Fix**: 
  1. Unifyresponse信封format
  2. Documentresponseformat规范
  3. AddresponseformatValidateTest

#### 12. [Source Code] [Medium Severity] [Redis queue lacks idempotency index support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**: 
  - SQLite withpartial唯一indexSupport idempotency
  - Redis ImplementUseHashindex但Implementnotcomplete
  - maycauses重复message
- **Suggested Fix**: 
  1. 完善 Redis idempotency Implement
  2. Add唯一indexValidate
  3. Ensure与 SQLite row为一致

#### 13. [Source Code] [Medium Severity] [Request deduplication middleware uses in-memory storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**: 
  - 纯内存滑动窗口（Map<DeduplicationKey, DeduplicationEntry[]>）
  - none外部Store
  - 多instanceDeploynot共享
  - Restart后去重state丢失
- **Suggested Fix**: 
  1. Use Redis 替代内存Store
  2. Support分布式去重
  3. 持久化去重state

#### 14. [Source Code] [Medium Severity] [Cache has no stampede protection]
- **File/Path**: multiple cache Implement
- **Issue Description**: 
  - MemoryCacheStore, ExperienceCacheService none锁
  - 缓存not yet命中时可occur thundering herd
  - 高and发下maycausesdatabase过载
- **Suggested Fix**: 
  1. Implement single-flight 模式
  2. Add请求排队机制
  3. Use分布式锁Protect缓存Update

#### 15. [Source Code] [Medium Severity] [EvidenceService eviction only triggered on insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**: 
  - Clean up仅在 record() Call时Trigger
  - 空闲时none后台Clean up
  - maycauses内存持续增长
- **Suggested Fix**: 
  1. Add定期后台Clean uptask
  2. Use独立的Clean upthread
  3. Add内存UseMonitor

#### 16. [Source Code] [Low Severity] [No connection metrics exposed]
- **File/Path**: WebSocket service器
- **Issue Description**: 
  - getClientCount() exists但not yetthrough HTTP endpointExpose
  - none pendingAcks 队column深度指标
  - noneConnectestablishAlert
- **Suggested Fix**: 
  1. through metrics endpointExposeConnect指标
  2. Add pendingAcks 队columnMonitor
  3. AddConnect数exceptionAlert

#### 17. [Source Code] [Low Severity] [No idle client timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**: 
  - 仅在Heartbeat Sweep 时Check isAlive
  - none per-client 独立于Heartbeat的空闲timeout
  - Authenticate后从not发送message的client只能throughHeartbeatfailure检测
- **Suggested Fix**: 
  1. Add per-client idle timeout
  2. 独立于Heartbeat间隔
  3. Configure可Adjust

#### 18. [Source Code] [Low Severity] [Subscription limit is per-client not global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**: 
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - 恶意client可Subscribe 100 个task
  - none全局taskSubscribe者限制
- **Suggested Fix**: 
  1. Add全局taskSubscribe者限制
  2. Implement per-task Subscribe者上限
  3. Add反滥用检测

#### 19. [Configuration] [Low Severity] [config/runtime has no version validation mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**: 
  - Configurewith "version": "v4.3"
  - 但none schema 版本Validate
  - Load时mayAcceptnotCompatibilityConfigure
- **Suggested Fix**: 
  1. Add JSON Schema Validate
  2. Implement版本Compatibility性Check
  3. Start时ValidateConfigurecomplete性

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**: 
  - accessOrder array的 splice 操作is O(n)
  - 高频access时may性能issue
- **Suggested Fix**: 
  1. Use LinkedList 替代array
  2. orUse Map 维护accessin order
  3. 性能TestValidate

### Summary

本次补充Review（第十三轮 - 缓存will话与实时通信Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods 缺少 PUT/PATCH/DELETE（浏览器请求willfailure）
2. Mission Routes errorresponseWrapnot当
3. WebSocketBridge none最大Connect数限制（DoSrisk）
4. pendingAcks DisconnectConnect时not yetClean up（memory leak）
5. 硬Encodefallback密钥（Securevulnerability）
6. config/runtime/test.json 缺少timeoutConfigure
7. prod.json maxConcurrentTasks=1 限制too strict
8. multipleserviceexistsnone界 Map（memory leakrisk）

**Medium Priority**:
1. taskEventHistory Map 永notClean up
2. SecureConfigure drift（remoteWorkerRegistration missing）
3. OpenAPI endpointresponseformatnot一致
4. Redis 队column idempotency Implementnotcomplete
5. 请求去重中间件Use内存Store（多instancenot共享）
6. Cache none stampede Protect
7. EvidenceService eviction 仅在Insert时Trigger

**Low Priority**:
1. noneConnect指标Expose
2. none空闲clienttimeout
3. Subscribe限制is per-client 而非全局
4. config/runtime none版本Validate机制
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 64 | 74 | 35 | 173 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deploy | 1 | 10 | 6 | 17 |
| **合计** | **99** | **161** | **79** | **339** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix CORS allowedMethods Add PUT/PATCH/DELETE
2. fix Mission Routes errorresponseformat
3. 为 WebSocketBridge Add最大Connect数限制
4. Clean up pendingAcks 和 taskEventHistory
5. Remove硬Encodefallback密钥
6. fix config/runtime/test.json Configure
7. EvaluateandAdjust prod and发限制

**Short Term (This Month)**:
1. UnifySecureConfigure（remoteWorkerRegistration）
2. Implementnone界 Map 的 LRU/TTL 驱逐
3. Unify API response信封format
4. 完善 Redis idempotency Implement
5. Add分布式去重中间件
6. Implement cache stampede Protect

**Long Term Planning**:
1. establishcompleteConnection management和Monitor
2. Implement后台Clean uptask框架
3. AddConfigure schema Validate
4. Optimize高频繁操作的数据structure
5. establish内存Use基线和Alert

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events and Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry lacks requestId field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - StructuredLogEntry interfacenone requestId field
  - 只with correlationId，它fallback到 traceId
  - none法独立Tracesingle HTTP 请求
- **Suggested Fix**: 
  1. 在 StructuredLogEntry Add requestId field
  2. 在 HTTP 中间件中Generate和injection requestId
  3. Ensure requestId 流经所withlogCall

#### 2. [Observability] [High Severity] [StructuredLogger data field has no automatic sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - Ifdevelopment者传递 `{ password: "..." }` 给 logger.info，passwordwill被Record
  - nonefield级脱敏机制
  - depends ondevelopment者manual排除敏感field
- **Suggested Fix**: 
  1. Add OBSERVE_OUTPUT_BLACKLIST class似的黑名单
  2. Implement redact/mask/sanitize 工具function
  3. 在log传输前automatic清洗敏感field

#### 3. [Observability] [Medium Severity] [No PII handling for sensitive data in logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**: 
  - none PII Rewrite工具
  - development者MustmanualavoidRecordsensitive data
  - exists意外Record敏感信息的risk
- **Suggested Fix**: 
  1. Add PII 检测和Rewrite工具
  2. 在文档中ClarifyRecord敏感fieldlist
  3. Add testsValidatesensitive datanot被Record

#### 4. [Observability] [Medium Severity] [59 direct console.* calls]
- **File/Path**: multiple源file
- **Issue Description**: 
  - shouldUse StructuredLogger
  - console Callmaynot被logAggregate系统收集
  - 难以Trace和关联
- **Suggested Fix**: 
  1. Replace所with console.* 为 StructuredLogger
  2. Add ESLint 规则Forbid console.*
  3. Keep少量Allow的 CLI 输出

#### 5. [Observability] [Medium Severity] [Some logger.warn calls lack structured data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**: 
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - 只withmessage，none data object
  - 难以关联和Query
- **Suggested Fix**: 
  1. Add `{ data: { ... } }` object
  2. Ensure所withlog包含上下文数据
  3. Add loggingReview工具

#### 6. [Source Code] [High Severity] [Harness while(true) loop has no hard iteration limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**: 
  ```typescript
  while (true) {
    // ...
    // depends on budget gate 和 guardrail vibration 退出
    // If两者都failure，循环永久继续
  }
  ```
  - depends on budget gate 和 guardrail vibration 退出
  - none硬性迭代次数限制
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add硬性 maxIterations 上限
  2. 在达到上限时强制退出
  3. Record详细的迭代Count用于调试

#### 7. [Source Code] [High Severity] [Oapeflir while(true) loop may re-plan indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**: 
  - If loopReplanDecision.shouldReplan 永not变为 false
  - 重规划永远none法减少plannederror
  - maycausesnone限循环
- **Suggested Fix**: 
  1. Add重规划次数上限
  2. 在达到上限时强制Acceptcurrentlyresult
  3. Add重规划质量衰减检测

#### 8. [Source Code] [Medium Severity] [Recovery flow allows terminal state transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**: 
  - completed, failed, cancelled, aborted 可Convert到 paused 进rowRecover
  - CreateRecoverpathmay重新进入Execute
  - Needs to be validated此row为的正确性
- **Suggested Fix**: 
  1. Review recovery Convert的合法性
  2. Ensurenotwillcausesstatenot一致
  3. AddConvert前置条件Validate

#### 9. [Internationalization] [High Severity] [API error messages hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**: 
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - errormessage硬Encode英文
  - none后端 i18n 机制
  - 非英文client收到notlocal化的error
- **Suggested Fix**: 
  1. Useerror码而非硬Encodemessage
  2. clientaccording toerror码local化
  3. or在后端Add i18n Support

#### 10. [Internationalization] [Medium Severity] [UI hardcoded strings not translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**: 
  - "Build Plan", "Execute", "Messages" 等按钮标签硬Encode
  - notUse i18n 系统
- **Suggested Fix**: 
  1. Use `translateFeatureCopy` Replace硬Encode
  2. Ensure所with用户可见文本through i18n
  3. Add硬Encode字符串检测

#### 11. [Internationalization] [Medium Severity] [Arabic catalog incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**: 
  - ar-SA 只with约18条message
  - en-US 和 zh-CN with约117条
  - missing的 key 返回 key 本身
- **Suggested Fix**: 
  1. 补充 Arabic 翻译
  2. Ensure所with key 都with翻译
  3. Add翻译complete性Test

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy has no fallback default value]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**: 
  - If feature ID not在 catalog 中
  - 返回 undefined title/summary
  - none合理fallback
- **Suggested Fix**: 
  1. Addfallback到 key orby default字符串
  2. orUse feature ID 作为显示名
  3. Ensure UI not显示 undefined

#### 13. [Operations] [High Severity] [Health check lacks readiness/liveness distinction]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - /healthz, /v1/healthz, /health 返回相同Report
  - none readiness probe（可Process流量？）
  - none liveness probe（系统存活？）
  - canAcceptTraffic() not yetthrough HTTP Expose
- **Suggested Fix**: 
  1. Add /ready 和 /live endpoint
  2. Readiness Checkdepends on项就绪
  3. Liveness Checkprocess健康

#### 14. [Operations] [High Severity] [Health check has race condition during shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**: 
  - getHealthReportAsync() AsyncCheck dbWritable
  - shutdown duringdatabaseConnectmayClose
  - 健康Check仍在传入
- **Suggested Fix**: 
  1. 在 shutdown 时返回 unhealthy
  2. Add shutdown state标志
  3. StopAcceptnew健康Check请求

#### 15. [Operations] [High Severity] [LeaderElectionService not integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**: 
  - LeaderElectionService.stop() Process优雅退位
  - 但not yet在全局 graceful shutdown 中Register
  - 需explicitRegister为 shutdown handler
- **Suggested Fix**: 
  1. 将 LeaderElectionService Add到 shutdown handlers
  2. Ensure领导者在 shutdown 时让位
  3. ValidateClosein order正确

#### 16. [Operations] [Medium Severity] [addHandler() lacks explicit ordering convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**: 
  - although handlers 逆序Execute
  - 但noneexplicitinterfaceDeclare handler depends on关系
  - 关key handlers（如ClosedatabaseConnect）应finallyRun
- **Suggested Fix**: 
  1. Add优先级or阶段parameter
  2. Document关key handler in orderRequire
  3. Addin orderValidateTest

#### 17. [Operations] [Medium Severity] [unref'd timers may not fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**: 
  - `setTimeout(...).unref()` not保持event循环active
  - If主thread空闲，强制退出maynotTrigger
- **Suggested Fix**: 
  1. Remove .unref() 除非indeedNeed
  2. orEnsurewith其他way保持event循环
  3. Add timeoutTriggerValidateTest

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker blocks traffic but does not expose status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**: 
  - canAcceptTraffic() 在 P0 issueexists时返回 false
  - 但 _trafficBlocked is内部state
  - load balancing器access /healthz 仍will得到 "ok"
- **Suggested Fix**: 
  1. 在健康Report中Expose trafficBlocked state
  2. orAdd单独的健康endpoint指示就绪state
  3. Ensureload balancing器在Block时notroute流量

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter mixed usage]
- **File/Path**: 整个code库
- **Issue Description**: 
  - 项目simultaneouslyUse TypedEventBus 和原生 EventEmitter
  - TypedEventBus shouldis标准
  - 混用maycausesclass型Secureissue
- **Suggested Fix**: 
  1. CreatemigrateplannedUnifyUse TypedEventBus
  2. Add ESLint 规则Forbid原生 EventEmitter
  3. 在 CI 中检测混用情况

#### 20. [Source Code] [Low Severity] [No event ordering guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**: 
  - noneClarify的eventSortGuarantee文档
  - eventProcessmay乱序
  - depends on方NeedProcess乱序
- **Suggested Fix**: 
  1. DocumenteventSort语义
  2. IfNeedSort，Implement序column号机制
  3. 在eventProcess中Consider乱序情况

### Summary

本次补充Review（第十四轮 - logevent与workflowReview - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry none requestId field
2. StructuredLogger data fieldnoneautomatic清洗（sensitive datarisk）
3. Harness while(true) 循环none硬性迭代上限
4. Oapeflir while(true) 循环maynone限重规划
5. API errormessage硬Encode英文（none i18n）
6. 健康Checknone readiness/liveness 区分
7. shutdown during健康Checkexistsrace condition
8. LeaderElectionService not yet与 GracefulShutdown 集成

**Medium Priority**:
1. log中sensitive datanone PII Process
2. 59处 console.* 直接Call
3. partial logger.warn Call缺少structure化数据
4. Recovery 流程Allowterminal stateConvert到 paused
5. UI 硬Encode字符串not yet翻译
6. Arabic directorynotcomplete
7. addHandler() noneexplicitSort约定
8. unref'd timers maynotTrigger
9. StartupConsistencyChecker Block流量但notExposestate
10. TypedEventBus vs EventEmitter 混用

**Low Priority**:
1. translateFeatureCopy nonefallbackby defaultvalue
2. noneeventSortGuarantee

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configure | 10 | 38 | 24 | 72 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **103** | **171** | **82** | **356** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. 在 StructuredLogEntry Add requestId field
2. Implementlog敏感fieldautomatic清洗
3. 为workflow循环Add硬性迭代上限
4. Add readiness/liveness 健康Checkendpoint
5. 将 LeaderElectionService 集成到 GracefulShutdown
6. Implement API errormessage i18n Support

**Short Term (This Month)**:
1. Replace所with console.* 为 StructuredLogger
2. 补充 Arabic i18n directory
3. fix UI 硬Encode字符串
4. Unify TypedEventBus 替代 EventEmitter
5. resolve shutdown race condition条件
6. AddeventSortGuarantee文档

**Long Term Planning**:
1. establishcomplete PII Process框架
2. Implementlogcomplete性Validate
3. establishworkflowSecure循环检测
4. 完善健康Check和就绪探测
5. establish国际化completeTest

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing and Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript incremental compilation cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**: 
  - none `incremental: true` Configure
  - none `tsbuildinfo` file
  - 每次Buildiscomplete重建（9.6秒）
  - TypeScript none法Use增量Compile
- **Suggested Fix**: 
  1. 在 tsconfig.json Add `"incremental": true`
  2. Add `"tsbuildinfo": ".tsbuildinfo"` 到 .gitignore
  3. Implement项目引用以SupportandrowBuild

#### 2. [Build] [High Severity] [76 npm scripts mostly duplicate build]
- **File/Path**: `package.json`
- **Issue Description**: 
  - 40+ CLI scripts 都Run `npm run build && node ...`
  - 每个脚本前都Executecomplete重建
  - none法直接Run预Build的 CLI
  - 20+ stable:* 脚本遵循相同模式
- **Suggested Fix**: 
  1. Create `build:cli` 脚本Build一次
  2. 让 CLI 脚本Use预Build的 dist file
  3. Add npm run dev orclass似的none需重建的Executeway

#### 3. [Source Code] [High Severity] [168 occurrences of any type usage]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` methodSign
  - retry/timeout工具Use `(...args: any[]) => Promise<any>`
  - bypassclass型Secure
- **Suggested Fix**: 
  1. Use泛型替代 any
  2. Replace withconcrete输入class型
  3. Add ESLint 规则Forbid any

#### 4. [Source Code] [High Severity] [38 @ts-ignore directives]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 14个 stability 相关filewith `@ts-ignore ExecutionRecord type mismatch`
  - 5个 harness-sdk filewith `Partial<HarnessRun> doesn't have all required properties`
  - 2个filewith `exactOptionalPropertyTypes` issue
- **Suggested Fix**: 
  1. fix ExecutionRecord class型not匹配
  2. 完成 HarnessRun class型的必需property
  3. Remove @ts-ignore Use

#### 5. [Source Code] [High Severity] [ExecutionRecord type mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` 等14个file
- **Issue Description**: 
  - Insert execution record 时 TypeScript Rejectclass型
  - `ExecutionRecord` interfaceRequire新field但 insert objectmissing
  - or store 的 insert methodAcceptnot同class型
- **Suggested Fix**: 
  1. 对齐 ExecutionRecord interface和 store class型
  2. Addmissingfield到 insert object
  3. orAdjust store 的 insert methodclass型Sign

#### 6. [Source Code] [Medium Severity] [30+ as unknown as double type conversions]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**: 
  - 完全bypassclass型Secure
  - Usuallyisclass型架构issue的信号
- **Suggested Fix**: 
  1. fix上游class型issue
  2. Use更concreteclass型Assert
  3. Refactorclass型层次structure

#### 7. [Build] [Medium Severity] [rimraf extraneous - not declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**: 
  - rimraf@6.1.3 exists于 node_modules 但not yet在 package.json Declare
  - maycausesdepends onissue
- **Suggested Fix**: 
  1. Add到 dependencies or devDependencies
  2. orRemoveandUse其他Clean upway

#### 8. [Testing] [High Severity] [178 direct process.env changes without abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**: 
  - 直接Read/Write process.env
  - 在 beforeEach/afterEach 中manualSave/Recover
  - none helper Abstract
- **Suggested Fix**: 
  1. Create env helper function
  2. UnifySave和Recover模式
  3. Add testsIsolateValidate

#### 9. [Testing] [High Severity] [21,998 unlinkSync calls without centralized cleanup]
- **File/Path**: multipleTestfile
- **Issue Description**: 
  - 每个Test重新ImplementClean up逻辑
  - noneCentralizeClean up utility
  - maycauses EBUSY (Windows) orand发accessissue
- **Suggested Fix**: 
  1. CreateCentralize的TestClean up utility
  2. Use afterEach EnsureClean up
  3. ConsiderUsestagingdirectory

#### 10. [Testing] [Medium Severity] [No unified mocking framework]
- **File/Path**: `tests/` multipledirectory
- **Issue Description**: 
  - 10,579 处 vi.fn, jest.mock, sinon 等Call
  - noneUnify的 mocking 框架可见
  - 模式not一致
- **Suggested Fix**: 
  1. establishUnify的 mock factory
  2. Standardize mock 模式
  3. Add mocking Best Practice文档

#### 11. [Testing] [Medium Severity] [Singleton state reset not standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**: 
  - Testthrough特定functionReset singletons
  - 每个Test重复自己的 reset 逻辑
  - noneUnify的 resetAllSingletons()
- **Suggested Fix**: 
  1. CreateUnify的 singleton reset 机制
  2. 在 afterEach 中automaticCall
  3. Document singleton ResetRequire

#### 12. [Testing] [Low Severity] [No branch coverage requirement]
- **File/Path**: `.c8rc.json`
- **Issue Description**: 
  - `"100": false` - nonecoverageRequire
  - 只测量源code，not测量Testfile
- **Suggested Fix**: 
  1. Add分支coverage阈value
  2. 在 CI 中强制Executecoverage gate
  3. 关注关keycodepath

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest has no timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**: 
  - fetch Callnone timeout parameter
  - 挂起的请求may永久Block
- **Suggested Fix**: 
  1. Add AbortController timeout
  2. Usestandardtimeout模式
  3. RecordtimeoutConfigure

#### 14. [Network] [High Severity] [OIDC service fetch call has no timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**: 
  - OIDC token 交换none retry logic
  - none timeout/abort signal
  - Authenticate流程may挂起
- **Suggested Fix**: 
  1. Add fetch timeout
  2. Add retry logic
  3. UsestandardtimeoutConfigure

#### 15. [Network] [High Severity] [plugin-runtime-child replaces globalThis.fetch with no-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**: 
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - 插件上下文中完全Replace fetch 为空function
  - 插件的所with出站 HTTP 请求都willfailure
  - looks likeiswith意为之但mayresult inissue
- **Suggested Fix**: 
  1. Confirm这iswith意row为
  2. Document fetch Replacerow为
  3. Ensurenotwill意外impact其他code

#### 16. [Network] [Medium Severity] [No explicit http.Agent configuration]
- **File/Path**: 全局
- **Issue Description**: 
  - noneexplicit的 http.Agent/https.Agent Configure
  - depends on Node.js by defaultConnect池
  - none maxSockets or maxConnections Configure
  - 高吞吐场景may出issue
- **Suggested Fix**: 
  1. Add http Agent Configure
  2. DocumentConnect池大小
  3. MonitorConnectUse情况

#### 17. [Serialization] [Medium Severity] [Contract version hardcoded as string literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**: 
  - `schemaVersion: "v4.3"` 硬Encode
  - 难以Trace合同版本演变
- **Suggested Fix**: 
  1. 提取到class型化constantor enum
  2. Centralize管理合同版本
  3. Add版本Compatibility性Check

#### 18. [Serialization] [Low Severity] [Timestamp = string loses precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**: 
  - `type Timestamp = string` noneclass型精度
  - ISO 8601 字符串none时区信息
- **Suggested Fix**: 
  1. Use Date objector branded string class型
  2. Clarify时区Process约定
  3. Document时间戳语义

#### 19. [Source Code] [Medium Severity] [29 non-null assertions !.]
- **File/Path**: 整个 src directory
- **Issue Description**: 
  - Use `!.` Assert非空
  - maycausesRun时error
- **Suggested Fix**: 
  1. Useoptional链 `?.` or空value合and `??`
  2. Add appropriate null Check
  3. 减少非空AssertUse

#### 20. [API] [Medium Severity] [API route schema version hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**: 
  - Zod schema Validateexists
  - 但 schema 版本not yet与 contract 版本Sync
- **Suggested Fix**: 
  1. 从 contract 版本派生 schema 版本
  2. Add版本一致性Check
  3. Document版本关系

### Summary

本次补充Review（第十五轮 - BuildTest与class型系统Review - 2026-05-14）found了20个新issue。

**High Priority (Requires Immediate Action)**:
1. none TypeScript 增量Compile缓存（每次complete重建9.6秒）
2. 76个 npm scripts 大partial重复Build
3. 168处 any class型Use（bypassclass型Secure）
4. 38处 @ts-ignore 指令
5. ExecutionRecord class型not匹配（14个file）
6. 178处直接 process.env 变更noneAbstract
7. ScopedExternalAccessSandbox performHttpRequest nonetimeout
8. OIDC service fetch Callnonetimeout
9. plugin-runtime-child Replace globalThis.fetch 为 no-op

**Medium Priority**:
1. 30+处 as unknown as 双class型Convert
2. rimraf extraneous not yetDeclare
3. 21,998处 unlinkSync noneCentralizeClean up
4. noneUnify mocking 框架
5. Singleton stateResetnot yetStandardize
6. noneexplicit http.Agent Configure
7. 合同版本硬Encode为字符串
8. Timestamp = string 丢失精度
9. 非空AssertUse

**Low Priority**:
1. none分支coverageRequire
2. API route schema 版本not yetSync

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 14 | 15 | 3 | 32 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **109** | **182** | **85** | **376** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript 增量Compile (`incremental: true`)
2. Refactor npm scripts avoid重复Build
3. 减少 any class型Use到 <50
4. Remove所with @ts-ignore 指令
5. fix ExecutionRecord class型not匹配
6. Add fetch timeout到 OIDC 和 sandbox

**Short Term (This Month)**:
1. CreateCentralize的TestClean up utility
2. establishUnify的 mocking 框架
3. Standardize singleton Reset机制
4. Add http.Agent Connect池Configure
5. 提取合同版本到class型化constant

**Long Term Planning**:
1. Implementcompleteclass型Secure（none any）
2. establishTest基础设施标准
3. ImplementBuild缓存Optimize
4. 完善网络层timeout和retry
5. establishcoverage门禁标准

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns and Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**: 
  - 19个 private instancevariable（should最多3-5个）
  - 61个 public method
  - 9个injection的委托service
  - 违反单一职责原则
  - 协调太多子系统
- **Suggested Fix**: 
  1. Split为 `HarnessStateManager`（stateConvert）
  2. Split为 `HarnessMemoryCoordinator`（内存操作）
  3. Split为 `HarnessRecoveryHandler`（failureProcess）
  4. Split为 `HarnessHitlCoordinator`（人机协作）

#### 2. [Architecture] [High Severity] [Giant barrel files cause build issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317row)
- **Issue Description**: 
  - 15个子module的重新导出
  - 修改任何功能时mayTrigger大规模重Compile
  - Create循环depends onrisk
- **Suggested Fix**: 
  1. 每个 index.ts 最多重新导出5-7项
  2. 优先Use直接module导入
  3. 按领域Split contracts 为multiplefile

#### 3. [Memory] [High Severity] [167 event listeners with only 16 cleanups]
- **File/Path**: 整个code库
- **Issue Description**: 
  - `.on`/`addEventListener`: 167次
  - `.off`/`removeListener`/`removeAllListeners`: 仅16次
  - 严重not平衡，existsmemory leak
- **Suggested Fix**: 
  1. Audit所withevent监听器Register点
  2. Ensure每个监听器with对应的Clean up
  3. Use `{ once: true }` automaticClean up

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts child process listeners not cleaned up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**: 
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - 在 attachChild()/spawnChild() 中Register
  - stop() method从not yetRemove它们
  - 插件Run时Stop后监听器仍附着在separate的子process
- **Suggested Fix**: 
  1. 在 stop() 中AddClean up：
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts` (763row)
- **Issue Description**: 
  - 大partial domain index.ts 只with12row
  - yono 导出11个class（YonoRepository, YonoMarketService, YonoCommentService 等）
  - singlefile包含too many职责
- **Suggested Fix**: 
  1. Split为 yono/market-service.ts
  2. Split为 yono/comment-service.ts
  3. 每个class一个file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts` (451row)
- **Issue Description**: 
  - Process平台Start、Run时directory、引导、演示模式
  - 从multiple子系统导出
  - 违反单一职责
- **Suggested Fix**: 
  1. Split为 bootstrap.ts
  2. Split为 startup.ts
  3. Split为 exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts data vs object confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169row)
- **Issue Description**: 
  - 527个class型/interfaceDefine
  - 纯数据structure（PrincipalRef, HumanPrincipalRef等）
  - nonerow为，只withclass型导出
  - class型和工厂function混在一起
- **Suggested Fix**: 
  1. Split为 runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. 将class型和工厂functionseparate
  3. establishClarify的边界

#### 8. [Domain] [High Severity] [DomainLifecycleState duplicate definitions and incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**: 
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - 两个完全notCompatibility的 schema
  - fragilemap层尝试Normalize
- **Suggested Fix**: 
  1. Unify为一个规范Define
  2. Remove重复
  3. establish单一data source

#### 9. [Domain] [Medium Severity] [Risk score thresholds hardcoded without constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**: 
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - magic numbers 85, 65, 35
  - noneconstant、注释orConfigure
- **Suggested Fix**: 
  1. 提取到Nameconstant
  2. AddConfigure选项
  3. Document决策边界

#### 10. [Domain] [Medium Severity] [HR role detection hardcodes tool names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**: 
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - 硬Encode的工具名 "read" 和 "question"
  - shouldUseconstant
- **Suggested Fix**: 
  1. 提取为constant READ_ONLY_TOOL_NAMES
  2. AddConfigureSupport
  3. Document只读角色Define

#### 11. [Domain] [Medium Severity] [No invariant enforcement mechanism]
- **File/Path**: 整体架构
- **Issue Description**: 
  - `canTransitionDomain` 返回 boolean 但none强制
  - Convertcan在notUseValidate器的情况下尝试
  - Domain seeds 和 risk specs betweennone一致性Check
- **Suggested Fix**: 
  1. Add invariant 强制框架
  2. EnsurestateConvert经过Validate
  3. AddConvert前条件Check

#### 12. [Security] [Medium Severity] [OpenAPI endpoint exposed without authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**: 
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure文档noneAuthenticateExpose
  - may泄露敏感 API 信息
- **Suggested Fix**: 
  1. AddAuthenticateor限制access
  2. 在production environmentdisable
  3. Documentrisk

#### 13. [Security] [Medium Severity] [In-memory session storage limits horizontal scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**: 
  - Sessions Store在module级 Map
  - 多service器instanceDeploynot工作
  - none分布式will话Store
- **Suggested Fix**: 
  1. Use Redis 等分布式will话Store
  2. Addwill话Copy
  3. DocumentExtend限制

#### 14. [Security] [Medium Severity] [In-memory service identity storage limits scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**: 
  - `serviceIdentities` Map 在内存中
  - 多instanceDeployissue
- **Suggested Fix**: 
  1. Use共享Store
  2. or在Start时从ConfigureLoad

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts files with same name]
- **File/Path**: 
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**: 
  - 相同名称在not同作用域
  - maycauses导入混淆
  - looks likeiswith意为之但mayresult in混乱
- **Suggested Fix**: 
  1. Add作用域前缀or后缀
  2. Document每个file的用途
  3. Ensure导入Clarify

#### 16. [Memory] [Low Severity] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但在 shutdown 时maynot yetCall
  - Needs to be validatedClosein order
- **Suggested Fix**: 
  1. Validate shutdown in order
  2. AddClose hooks
  3. Ensure资源释放

#### 17. [Architecture] [Low Severity] [Core/runtime is a wrapper around platform execution files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts 都重新导出
  - 只被一个 SDK fileUse
  - 价value可疑的间接层
- **Suggested Fix**: 
  1. RemoveorDocument用途
  2. 直接从 platform 导入

### Summary

本次补充Review（第十六轮 - 架构模式与内存管理Review - 2026-05-14）found了17个新issue。

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is God Object（19variable，61method）
2. 巨型 barrel files causesBuildissue
3. 167个event监听器仅16个Clean up
4. plugin-runtime-host.ts 子process监听器not yetClean up
5. DomainLifecycleState 重复Define且notCompatibility
6. risk评分阈value硬Encodenoneconstant

**Medium Priority**:
1. yono/index.ts 763row应Split
2. src/index.ts 451row应Split
3. contracts 数据vsobject混淆
4. HR角色检测硬Encode工具名
5. none invariant 强制机制
6. OpenAPI endpointPublicnoneAuthenticate
7. 内存will话Store限制水平Extend
8. 内存service身份Store限制Extend

**Low Priority**:
1. multiple architecture-remediation.ts file重名
2. PgDatabase.close() Validateissue
3. Core/runtime isWrap价value可疑

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configure | 10 | 39 | 24 | 73 |
| Secure | 15 | 17 | 3 | 35 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **116** | **190** | **88** | **394** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService 为专注service
2. fix plugin-runtime-host.ts 子process监听器Clean up
3. Unify DomainLifecycleState Define
4. Addevent监听器Clean upAudit
5. Add fetch timeout到所with网络Call

**Short Term (This Month)**:
1. Split yono/index.ts 和 src/index.ts
2. establish invariant 强制框架
3. Add分布式will话Store
4. Remove barrel files or限制规模
5. 提取所withmagic numbers到constant

**Long Term Planning**:
1. complete God Object Refactorplanned
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

*Review generated: 2026-05-14*
---

## [2026-05-14] Automated Review Report (Round 17 - In-depth Special Review)

### Deep Review Coverage
- src/platform/ 144个file ~276Krowcode
- src/domains/ 95个file 40+领域
- src/sdk/ 103个file
- config/environments/ 环境Configure
- tests/unit/ 关keyTestfile
- UI components

---

### Newly Discovered Issues

#### 1. [Source Code] [Critical] [Benchmark 百分位Calculate完全error]
- **File/Path**: `src/ops-maturity/benchmarking/benchmark-collector.ts`
- **Issue Description**: 
  - p50/p95/p99 allerrorCalculate为平均value
  - 实际code: `p50: values[Math.floor(len * 0.5)]` then又赋value `avg`
  - correct百分位CalculateshouldUse分位数公式
- **Impact**: 所with性能基准Test的百分位数据完全not可信
- **Suggested Fix**: Implementcorrect分位数Calculate逻辑

#### 2. [Configuration] [Critical] [环境名称错配 - 所with环境显示"prod"]
- **File/Path**: `config/environments/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**: 
  - 所withConfigurefile `"name": "prod"` 而非各自实际环境名
  - 这causeslog和Monitor中none法区分环境
- **Suggested Fix**: correct为各自的环境名称

#### 3. [Memory] [Critical] [Plugin runtime child process event监听器永not清洗]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts`
- **Issue Description**: 
  - stdout/stderr/message event监听器在 stop() 时not yetRemove
  - willcausesmemory leak
- **Suggested Fix**: 在 stop() 中Clean up所with child event监听器

#### 4. [Security] [Critical] [OAuth token 明文Store]
- **File/Path**: `src/sdk/cli/login.ts:70-79`
- **Issue Description**: 
  - OAuth tokens 以 JSON 明文Store
  - 权限 0o600 虽限制所with者access，但仍为明文
- **Suggested Fix**: Use系统 keychain orEncryptStore

#### 5. [Security] [Critical] [硬Encode CVE bypasslistcauses虚假Secure感]
- **File/Path**: `src/sdk/plugin-definition.ts`
- **Issue Description**: 
  - `bypassCVERegistryCheck: true` 和硬Encode CVE list
  - SBOM Validate形同虚设
- **Suggested Fix**: Deletebypass机制orRedesignSecureValidate

#### 6. [Security] [Critical] [弱 RSA 2048位密钥]
- **File/Path**: `src/sdk/中Encrypt相关file`
- **Issue Description**: 
  - Use 2048位 RSA maynot足以应对现代threat
  - 应Use 4096位or P-384 ECC
- **Suggested Fix**: Upgrade密钥长度

#### 7. [Source Code] [High] [process.chdir() Securevulnerability]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:89-93`
- **Issue Description**: 
  - noneValidate的 `process.chdir(sandboxRoot)` 
  - 可被恶意插件利用
- **Suggested Fix**: Add sandboxRoot Validate和Clean upCheck

#### 8. [Source Code] [High] [memory leak - EventListener 167个仅16个Clean up]
- **File/Path**: multiplefile
- **Issue Description**: 
  - Add了 167 个event监听器
  - 仅 16 个在销毁时Clean up
  - willcauses内存持续增长
- **Suggested Fix**: Unifyevent监听器生命周期管理

#### 9. [Source Code] [High] [TODO R4-27: HarnessRun not yet持久化]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270`
- **Issue Description**: 
  - HarnessRun objectCreate后not yet持久化
  - 系统Restart后none法Recover
- **Suggested Fix**: Add HarnessRun 持久化逻辑

#### 10. [Source Code] [High] [budget-allocator race condition条件]
- **File/Path**: `src/platform/five-plane-execution/budget-allocator.ts:504-507`
- **Issue Description**: 
  - CAS Check在transaction外Execute
  - maycauses双重扣款
- **Suggested Fix**: 将 CAS Check移入原子transaction

#### 11. [Testing] [High] [budget-allocator.test.ts 缺少 throttle ratio Assert]
- **File/Path**: `tests/unit/platform/five-plane-execution/budget-allocator.test.ts:286-335`
- **Issue Description**: 
  - TestshouldValidate throttle ratio 但实际not yetValidate
  - causes关key功能not yet被Test覆盖
- **Suggested Fix**: Add throttle ratio 的Assert

#### 12. [Testing] [High] [durable-event-bus-async.test.ts 定时器时序issue]
- **File/Path**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:74,104,117`
- **Issue Description**: 
  - Use setTimeout Assert但时间not确定
  - maycausesTestnot稳定
- **Suggested Fix**: Use fake timers orevent监听代替

#### 13. [Source Code] [Medium] [console.* Call 59 处not yet用 StructuredLogger]
- **File/Path**: multiple源file
- **Issue Description**: 
  - 直接Call console.log/error/warn
  - 应Use StructuredLogger Unifylog
- **Suggested Fix**: Replace with StructuredLogger

#### 14. [Source Code] [Medium] [: any class型 168 处]
- **File/Path**: multiple源file
- **Issue Description**: 
  - 大量 `: any` class型用法
  - 降低class型Secure
- **Suggested Fix**: 减少 any class型Use，增加class型constraint

#### 15. [Source Code] [Medium] [as unknown as 双转型 30+ 处]
- **File/Path**: multiple源file
- **Issue Description**: 
  - 滥用双转型模式
  - 掩盖class型error
- **Suggested Fix**: Improveclass型设计avoid双转型

#### 16. [Source Code] [Medium] [@ts-ignore 38 处]
- **File/Path**: multiple源file
- **Issue Description**: 
  - too many ts-ignore Use
  - Hide潜在issue
- **Suggested Fix**: fix底层class型issue

#### 17. [Source Code] [Medium] [Giant barrel files cause build issues]
- **File/Path**: multiple index.ts barrel files
- **Issue Description**: 
  - 巨型 barrel files 拖慢Build
  - 增加循环depends onrisk
- **Suggested Fix**: SplitorUsepathmap

#### 18. [Source Code] [Medium] [HR role detection hardcodes tool names]
- **File/Path**: 相关权限检测file
- **Issue Description**: 
  - HumanReview 角色检测硬Encode工具名
  - not够灵活
- **Suggested Fix**: UseConfigure驱动

#### 19. [Source Code] [Medium] [No invariant enforcement mechanism]
- **File/Path**: 全局
- **Issue Description**: 
  - 没with invariant Validate框架
  - 关keynotvariablenot yet被强制
- **Suggested Fix**: Implement invariant Check框架

#### 20. [Source Code] [Medium] [In-memory session storage limits horizontal scaling]
- **File/Path**: will话相关module
- **Issue Description**: 
  - based on内存的will话Storenone法水平Extend
  - 多instanceDeploywillwithissue
- **Suggested Fix**: Use分布式will话Store

#### 21. [Source Code] [Medium] [In-memory service identity storage limits scaling]
- **File/Path**: service身份module
- **Issue Description**: 
  - service身份Store在内存中
  - none法跨instance共享
- **Suggested Fix**: Use分布式Store

#### 22. [Configuration] [Medium] [config/security/ 环境Configure缺少field]
- **File/Path**: `config/security/` 下各环境Configure
- **Issue Description**: 
  - dev/staging/pre-prod 只with approvalMode
  - 缺少 sandboxMode/remoteWorkerRegistration
- **Suggested Fix**: Supplement missingSecureConfigurefield

#### 23. [Security] [Medium] [OpenAPI endpoint exposed without authentication]
- **File/Path**: OpenAPI 相关Configure
- **Issue Description**: 
  - 某些endpointmay被Publicaccess
  - NeedAuthenticateProtect
- **Suggested Fix**: AddAuthenticate中间件

#### 24. [Testing] [Medium] [非确定性 Math.random() Test]
- **File/Path**: SDK 相关Testfile
- **Issue Description**: 
  - Testdepends on Math.random() causes非确定
  - 难以复现和调试
- **Suggested Fix**: Use确定种子or mock

#### 25. [Source Code] [Low] [contracts 数据vsobject混淆]
- **File/Path**: contracts directory
- **Issue Description**: 
  - contract中数据class型与objectclass型混淆
  - maycausesSerializeissue
- **Suggested Fix**: Clarify区分数据模型和领域object

#### 26. [Source Code] [Low] [multiple architecture-remediation.ts 重名]
- **File/Path**: 各领域directory
- **Issue Description**: 
  - 相同file名在not同作用域
  - maycauses导入混淆
- **Suggested Fix**: Add作用域前缀orUnifyName

#### 27. [Source Code] [Low] [PgDatabase.close() validation issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**: 
  - with close() method但 shutdown 时maynot yetCall
- **Suggested Fix**: ValidateClosein order

#### 28. [Source Code] [Low] [Core/runtime isWrap价value可疑]
- **File/Path**: `src/core/runtime/`
- **Issue Description**: 
  - 只is重新导出，none实际价value
- **Suggested Fix**: RemoveorClarify用途

#### 29. [Source Code] [Low] [yono/index.ts 763 lines should be split]
- **File/Path**: `src/domains/yono/index.ts`
- **Issue Description**: 
  - filetoo large难以维护
- **Suggested Fix**: Split为multiplemodule

#### 30. [Source Code] [Low] [src/index.ts 451 lines should be split]
- **File/Path**: `src/index.ts`
- **Issue Description**: 
  - filetoo large
- **Suggested Fix**: Split为multiple导出module

#### 31. [Source Code] [Low] [DomainLifecycleState 重复Define]
- **File/Path**: multiplefile
- **Issue Description**: 
  - 相同stateDefine多次appear
  - notCompatibilityImplement
- **Suggested Fix**: UnifystateDefine

#### 32. [Source Code] [Low] [risk评分阈value硬Encode]
- **File/Path**: riskEvaluate相关file
- **Issue Description**: 
  - magic numbersnoneconstant对应
- **Suggested Fix**: 提取到Configureconstant

#### 33. [Deployment] [Low] [deploy/ directory内容notcomplete]
- **File/Path**: `deploy/`
- **Issue Description**: 
  - terraform/helm/k8s Configurenotcomplete
- **Suggested Fix**: 完善DeployConfigure

#### 34. [Configuration] [Low] [.gitignore 缺少stagingfile模式]
- **File/Path**: `.gitignore`
- **Issue Description**: 
  - 缺少 dist_*, :memory:*, .audit/ 等
- **Suggested Fix**: 补充 .gitignore

#### 35. [Testing] [Low] [Test辅助code量大 78 个file]
- **File/Path**: `tests/helpers/`
- **Issue Description**: 
  - ExplainTest基础设施复杂
- **Suggested Fix**: SimplifyTest基础设施

#### 36. [Source Code] [Low] [直接access process.env 高达143处]
- **File/Path**: 全局
- **Issue Description**: 
  - Configure散落难以Trace
- **Suggested Fix**: CreateUnifyConfiguremodule

#### 37. [Source Code] [Low] [HA 和 Lease module职责重叠]
- **File/Path**: `src/platform/five-plane-execution/ha/` 和 `lease/`
- **Issue Description**: 
  - 职责边界not清晰
- **Suggested Fix**: Clarify职责边界

#### 38. [Source Code] [Low] [EventEmitter 和 TypedEventBus 混用]
- **File/Path**: multiplemodule
- **Issue Description**: 
  - 应UnifyUse TypedEventBus
- **Suggested Fix**: 制定migrateplanned

#### 39. [Source Code] [Low] [.claude/scheduled_tasks.json not yetIgnore]
- **File/Path**: `.claude/scheduled_tasks.json`
- **Issue Description**: 
  - localfilenot应Commit
- **Suggested Fix**: Add到 .gitignore

#### 40. [Configuration] [Low] [tsconfig.temp.json maynot yetUse]
- **File/Path**: `tsconfig.temp.json`
- **Issue Description**: 
  - stagingConfigurefile残留
- **Suggested Fix**: Clean up

#### 41. [Configuration] [Low] [.env.example 包含过时variable]
- **File/Path**: `.env.example`
- **Issue Description**: 
  - 347rowmay包含not yetUsevariable
- **Suggested Fix**: ReviewClean up

#### 42. [Documentation] [Low] [docs_zh/architecture/ maynot yetUpdate]
- **File/Path**: `docs_zh/architecture/`
- **Issue Description**: 
  - 文档与codemaynotSync
- **Suggested Fix**: establishSync机制

#### 43. [UI] [Low] [SharedWorkerWSClient memory leak]
- **File/Path**: UI 组件
- **Issue Description**: 
  - SharedWorker Connectmaynot yet正确Close
- **Suggested Fix**: Add cleanup logic

#### 44. [UI] [Low] [XSS 潜在risk]
- **File/Path**: UI 组件
- **Issue Description**: 
  - 用户输入maynot yet正确转义
- **Suggested Fix**: Implement输出转义

#### 45. [UI] [Low] [缺少 Error Boundaries]
- **File/Path**: UI 组件
- **Issue Description**: 
  - React 组件缺少error边界
  - maycauses白屏
- **Suggested Fix**: Add Error Boundaries

#### 46. [Testing] [Low] [execution-dispatch-service-async.test.ts 仍然failure]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher/`
- **Issue Description**: 
  - Test持续failure
- **Suggested Fix**: Analyzefix

#### 47. [Testing] [Low] [nodeRunId-canonization.test.ts 仍然failure]
- **File/Path**: `tests/unit/platform/five-plane-execution/execution-engine/`
- **Issue Description**: 
  - Test持续failure
- **Suggested Fix**: Analyzefix

#### 48. [Testing] [Low] [runtime-plan-executor.test.ts 仍然failure]
- **File/Path**: `tests/unit/platform/five-plane-execution/oapeflir/`
- **Issue Description**: 
  - Test持续failure
- **Suggested Fix**: Analyzefix

#### 49. [Testing] [Low] [worker-pool-comprehensive.test.ts 仍然failure]
- **File/Path**: `tests/unit/platform/five-plane-execution/worker-pool/`
- **Issue Description**: 
  - Test持续failure
- **Suggested Fix**: Analyzefix

#### 50. [Source Code] [Low] [symbolic links not yet正确Process]
- **File/Path**: `src/platform/` 下的符号链接
- **Issue Description**: 
  - control-plane -> five-plane-control-plane 等
  - maycauses工具pathParseissue
- **Suggested Fix**: Clarify符号链接策略

#### 51. [Configuration] [Low] [.DS_Store fileexistsand被Trace]
- **File/Path**: 根directory
- **Issue Description**: 
  - macOS 元数据file被Trace
- **Suggested Fix**: StopTraceandAdd到 .gitignore

#### 52. [Configuration] [Low] [:memory: file残留]
- **File/Path**: 根directory
- **Issue Description**: 
  - stagingfilenot yetClean up
- **Suggested Fix**: Clean up

#### 53. [Configuration] [Low] [.tmp/ directory大量stagingfile]
- **File/Path**: `.tmp/`
- **Issue Description**: 
  - stagingfilenot yetClean up
- **Suggested Fix**: Clean up

#### 54. [Configuration] [Low] [.test-db/ directoryexists]
- **File/Path**: `.test-db/`
- **Issue Description**: 
  - Testdatabasedirectory残留
- **Suggested Fix**: Clean up

#### 55. [Source Code] [Low] [巨型源filenot yetSplit]
- **File/Path**: multiple超过1000row的file
- **Issue Description**: 
  - 难以维护和理解
- **Suggested Fix**: Split

#### 56. [Source Code] [Low] [runMultiStepOrchestration 复杂度高]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
- **Issue Description**: 
  - 核心编排逻辑复杂
- **Suggested Fix**: Split职责

#### 57. [Security] [Low] [npm audit 显示 7 个vulnerability]
- **File/Path**: depends on
- **Issue Description**: 
  - 1 moderate, 6 high
- **Suggested Fix**: Update受impact包

### Summary

本次深度Review（第十七轮 - 2026-05-14）found了57个新issue。

**High Priority (Requires Immediate Action)**:
1. Benchmark 百分位Calculate完全error - 所with p50/p95/p99 数据not可信
2. Plugin runtime child process event监听器永not清洗 - memory leak
3. OAuth token 明文Store - Securerisk
4. 硬Encode CVE bypasslist - 虚假Secure感
5. 弱 RSA 2048位密钥 - not符合现代Secure标准
6. process.chdir() noneValidate - Securevulnerability
7. EventListener 167个仅16个Clean up - memory leak
8. HarnessRun not yet持久化 - data lossrisk
9. budget-allocator race condition条件 - 双重扣款risk

**Medium Priority**:
1. 59处 console.* not yet用 StructuredLogger
2. 168处 : any class型
3. 30+处 as unknown as 双转型
4. 38处 @ts-ignore
5. 巨型 barrel files
6. HR角色检测硬Encode
7. none invariant 机制
8. 内存will话Store限制Extend
9. 内存service身份Store限制Extend
10. Configure缺少Securefield
11. OpenAPI endpointnoneAuthenticate
12. Math.random() 非确定性Test

**Low Priority**:
1-45. (详见the abovelist)

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 78+9=87 | 93+3=96 | 42+15=57 | 240 |
| Test | 10+2=12 | 17+1=18 | 6+6=12 | 42 |
| Configure | 10+1=11 | 39+1=40 | 24+15=39 | 90 |
| Secure | 15+5=20 | 17+1=18 | 3 | 41 |
| 文档 | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deploy | 1 | 12 | 6 | 19 |
| **合计** | **133** | **206** | **124** | **463** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix benchmark-collector.ts 百分位Calculate
2. Clean up plugin-runtime-host.ts event监听器
3. Implement OAuth token SecureStore
4. Delete硬Encode CVE bypassorRedesign
5. fix process.chdir() Securevulnerability
6. Add HarnessRun 持久化
7. fix budget-allocator race condition条件

**Short Term (This Month)**:
1. 减少 : any 和 @ts-ignore Use
2. Unifylog系统 (StructuredLogger)
3. Split巨型file
4. Implement invariant 框架
5. Add fetch timeout

**Long Term Planning**:
1. Refactor God Objects (HarnessRuntimeService 等)
2. establish架构边界和interface
3. Implement内存SecureValidate
4. establishcode quality门禁
5. 完善文档和培训

### Known Test Failures (14 files, 1620 tests)

详情见 `.audit/quality.md`

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 18 - Full Deep Review)

### Review Coverage
7个androwproxy完成深度review:
- src/platform/ (5层架构)
- src/domains/ (40+领域)
- src/sdk/ 和 CLI
- tests/unit/ (关keyTestfile)
- config/ 和 deploy/
- docs_zh/ 和 ui/
- src/interaction/, org-governance/, ops-maturity/, scale-ecosystem/, core/

---

### Newly Discovered Issues

#### A. src/platform/ found (18个issue)

#### A1. [Orchestration] [High] `harness/index.ts` 2317row - God Object
- **File**: `src/platform/five-plane-orchestration/harness/index.ts:1-2317`
- **Issue**: 单file2317row违反单一职责原则，包含HarnessService、loop controllers、guardrails、evaluation logic
- **Code Snippet**: Line 1423: `// @ts-ignore - appendEvidenceRecord may not exist on RuntimeRepository`
- **Suggestion**: Split为 `harness-run-controller.ts`, `harness-loop-controller.ts`, `harness-guardrails.ts`, `harness-evaluation.ts`

#### A2. [Execution] [High] `durable-event-bus.ts` Map/Set积累noneClean up
- **File**: `src/platform/five-plane-state-evidence/events/durable-event-bus.ts:208-227`
- **Issue**: `subscribers`, `pollingTimers`, `pendingPartitionEvents` 等MapCreate后nonecleanup
- **Code Snippet**: `private readonly disposed = false; // never checked`
- **Suggestion**: Add dispose() methodCancel所with polling timers andEmpty maps

#### A3. [State-Evidence] [High] `as unknown as T` 模式滥用
- **File**: `src/platform/five-plane-state-evidence/truth/sqlite/query-helper.ts:28,41,53,79`
- **Issue**: 到处Use双转型掩盖class型issue
- **Suggestion**: Create强class型Wrapinterface代替class型Convert

#### A4. [Execution] [Medium] `execution-dispatch-service.ts` 1067row
- **File**: `src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts`
- **Issue**: 大型dispatch service，违反单一职责
- **Suggestion**: Split为 `execution-dispatch-core.ts` 和 `execution-dispatch-health.ts`

#### A5. [Control-Plane] [Medium] `startup-env-schema.ts` 硬 `process.exit(1)`
- **File**: `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts:506`
- **Issue**: Validatefailure后直接 `process.exit(1)` - Anti-pattern
- **Suggestion**: Throwerror让Call者决定退出码

#### A6. [Execution] [Medium] `process-error-handlers.ts` 60秒timeout后 exit
- **File**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:105,169`
- **Issue**: `process.exit(1)` fallback may合理但需Document
- **Suggestion**: DocumentwhyNeed60秒

#### A7. [Control-Plane] [Medium] `secret-management-service.ts` setIntervalnoneClean up
- **File**: `src/platform/five-plane-control-plane/iam/secret-management-service.ts:663`
- **Issue**: rotationInterval none clearInterval path
- **Suggestion**: Ensure interval 在 service dispose 时Clear

#### A8. [Interface] [Medium] 多处 setInterval none visible cleanup
- **File**: `task-websocket-status-relay.ts:37`, `websocket-bridge.ts:109`, `channel-gateway-retry-executor.ts:76`
- **Suggestion**: Validate所with interval 在 shutdown pathwith clearInterval

#### A9. [Orchestration] [Low] TODO R4-27 - HarnessRunnot yet持久化
- **File**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:270`
- **Issue**: `// TODO R4-27 [ARCHITECTURE]: HarnessRun must be persisted`
- **Suggestion**: ImplementorCreate tracked issue

#### A10. [State-Evidence] [Medium] `partitionSequenceNumbers` module级可变state
- **File**: `src/platform/five-plane-state-evidence/events/durable-event-bus.ts:55`
- **Issue**: `const partitionSequenceNumbers = new Map<string, number>()` 跨instance共享
- **Suggestion**: Change toinstance级orUseand发原语

#### A11. [Orchestration] [High] `_placeholder: true` 模式
- **File**: `src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.ts:437,453,457,470`
- **Issue**: Use `{ _placeholder: true } as unknown as ConfirmedTaskSpec`
- **Suggestion**: 重设计class型需求

#### A12. [Shared] [Medium] `slo-alerting-service.ts` 1270row
- **File**: `src/platform/shared/observability/slo-alerting-service.ts`
- **Suggestion**: 提取 alert dispatch 和 SLO calculation logic

#### A13. [State-Evidence] [Medium] `event-registry.ts` 1077row
- **File**: `src/platform/five-plane-state-evidence/events/event-registry.ts`
- **Issue**: RAW_EVENT_SCHEMA_REGISTRY constant包含所with event schemas
- **Suggestion**: 按域组织到独立Configurefile

#### A14. [Control-Plane] [Medium] `approval-flow-engine.ts` 1031row
- **File**: `src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts`
- **Suggestion**: 提取 quorum calculator 和 escalation manager

#### A15. [Execution] [Low] `GracefulShutdown` 正确Clean up listeners
- **File**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts:117-121`
- **Issue**: none - 此file正确Clean up listeners
- **Suggestion**: 这is良好模式应推广

#### A16. [Interface] [Low] `sanitize.ts` with prototype pollution 防护
- **File**: `src/platform/five-plane-interface/api/middleware/sanitize.ts:3`
- **Issue**: none - 正确阻止 `__proto__`, `prototype`, `constructor`
- **Suggestion**: EnsureApply于所with JSON 入口点

---

#### B. src/domains/ found (8个issue)

#### B1. [DomainLifecycleState] [Critical] class型Definenot一致
- **File**: `src/domains/architecture-remediation.ts:1` vs `src/domains/domain-specs.ts:115`
- **Issue**: 两套完全not同的value:
  - architecture-remediation.ts: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (PascalCase)
  - domain-specs.ts: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
- **Suggestion**: UnifyUse domain-specs.ts 的Define（经过ZodValidate）

#### B2. [Plugin Runtime] [Critical] sandboxRoot not yetValidate用于 process.chdir()
- **File**: `src/domains/registry/plugin-runtime-child.ts:89-93`
- **Issue**: `AA_PLUGIN_SANDBOX_ROOT` 直接用于 `process.chdir()` nonepathValidate
- **Code Snippet**:
```typescript
const sandboxRoot = process.env.AA_PLUGIN_SANDBOX_ROOT?.trim();
if (sandboxRoot) {
  process.chdir(sandboxRoot);  // noneValidate!
}
```
- **Suggestion**: Use `checkSandboxPath()` Validate

#### B3. [Plugin Runtime] [Critical] child process event监听器not yetClean up
- **File**: `src/domains/registry/plugin-runtime-host.ts:274-280`
- **Issue**: `stderr.on`, `stdout.on`, `message` 监听器在 stop() 时not yetRemove
- **Suggestion**: 在 stop() 中Call `removeAllListeners()`

#### B4. [Plugin Runtime] [Medium] process.exit(0) 在库code中
- **File**: `src/domains/registry/plugin-runtime-child.ts:175`
- **Issue**: 子process强row `process.exit(0)` not给宿主Clean up机will
- **Suggestion**: 发送退出信号给父process决定

#### B5. [Plugin Runtime] [Medium] getProcessTracker().register 后none unregister
- **File**: `src/domains/registry/plugin-runtime-host.ts:152`
- **Suggestion**: 在 stop() 中Add unregister

#### B6. [大型file] [Medium] 超大型fileNeeds to be split
- **File**:
  - `plugin-spi-registry.ts`: 948 row
  - `plugin-runtime-host.ts`: 784 row
  - `division-loader.ts`: 818 row
  - `yono/index.ts`: 763 row
- **Suggestion**: 按职责Split

#### B7. [Event Listeners] [Critical] 全局none removeListener/off Call
- **File**: 整个 `src/domains/` directory
- **Issue**: `.on()`, `.once()`, `addEventListener()` 32处但 remove Call为0
- **Suggestion**: Ensure在销毁时CallRemovemethod

#### B8. [DomainDescriptorOrchestrationService] [Medium] normalizeLifecycleState mapnotcomplete
- **File**: `src/domains/domain-descriptor-orchestration-service.ts:144-156`
- **Issue**: maptableis单向的，state回溯maynot一致
- **Suggestion**: UseUnify的 DomainLifecycleState class型

---

#### C. src/sdk/ 和 CLI found (9个issue)

#### C1. [Security] [Critical] 硬Encode CVE bypass SBOM 扫描
- **File**: `src/sdk/plugin-sdk/plugin-definition.ts:466-475`
- **Issue**: `inferRemoteSbomPackages()` 返回硬Encodevulnerability版本而非实际ParseSBOM
- **Code Snippet**:
```typescript
if (lowerPath.includes("lodash")) {
  return [{ name: "lodash", version: "4.17.21" }];  // vulnerable!
}
```
- **Suggestion**: Delete此function，始终获取/Parse实际 SBOM file

#### C2. [Security] [Medium] 弱 RSA 2048位密钥
- **File**: `src/sdk/pack-sdk/pack-manifest.ts:232-233`
- **Issue**: `modulusLength: 2048` is最低阈value
- **Suggestion**: Use 4096位 RSA or Ed25519/Ed448

#### C3. [Security] [Critical] OAuth tokens 明文Store
- **File**: `src/sdk/cli/login.ts:70-79`
- **Issue**: tokens 以 JSON 明文Store到file
- **Suggestion**: Use系统 keychain orEncryptStore

#### C4. [Testing] [Medium] Math.random() causes非确定性
- **File**: `src/sdk/fixture-redact.ts:174`
- **Issue**: `generateTestId()` Use Math.random()
- **Suggestion**: Use `crypto.randomUUID()`

#### C5. [Testing] [Medium] Math.random() 用于errorinjection
- **File**: `src/sdk/pack-sdk/pack-test-local-service.ts:164`
- **Issue**: `playbackFixture()` 用 Math.random() 模拟error率
- **Suggestion**: Use seeded PRNG

#### C6. [CLI] [Medium] manualparameterParsenoneValidate
- **File**: `src/sdk/cli/pack-validate.ts:19-36`, `pack-create.ts:23-57`, `pack-publish.ts:22-46`
- **Issue**: manual `process.argv` Parse，缺少 schema Validate
- **Suggestion**: Use `parseArgs` or yargs/commander

#### C7. [class型Secure] [Medium] @ts-ignore 滥用
- **File**: `src/sdk/harness-sdk/index.ts:477,490,576,596,620,643`
- **Issue**: 6个 @ts-ignore Hideclass型error
- **Suggestion**: Define proper discriminated union types

#### C8. [class型Secure] [Medium] any class型滥用
- **File**: `src/sdk/cli/stable-runner-factory.ts:62-72`
- **Issue**: `StableRunner`, `StableReportWriter`, `FailedPredicate` Use `any`
- **Suggestion**: Use泛型 `<T, R>`

#### C9. [Security] [Low] notcompletevulnerabilitydatabase
- **File**: `src/sdk/plugin-sdk/plugin-definition.ts:133-148`
- **Issue**: `KNOWN_VULNERABILITIES` 只column出2个CVE (2021年)
- **Suggestion**: 集成 OSV/NVD orDeletenotcomplete allowlist

---

#### D. tests/unit/ found (10个issue)

#### D1. [Testing] [Critical] budget-allocator.test.ts 缺少 throttle ratio Assert
- **File**: `tests/unit/platform/five-plane-execution/budget-allocator.test.ts:332-335`
- **Issue**: Calculate了 throttled result但从not yet assert
- **Suggestion**: Add `assert.equal(result.reservation.effectiveAmount, 50)`

#### D2. [Testing] [Medium] durable-event-bus-async.test.ts setTimeout 时序issue
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:74,104,117`
- **Issue**: `setTimeout(resolve, 20)` 在负载高时maynot足
- **Suggestion**: Useevent监听or轮询模式

#### D3. [Testing] [Medium] pendingForConsumer 返回valuenot yetValidate
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:174-176`
- **Issue**: `pending` variablenone assert
- **Suggestion**: Add `assert.ok(pending.length > 0)`

#### D4. [class型Secure] [Low] 25+ TestfileUse @ts-nocheck
- **File**: `tests/unit/domains/recipes/recipe-registry.test.ts:11` 等
- **Issue**: disableclass型Check阻碍 TypeScript Secure收益
- **Suggestion**: 逐filefixorCreate tracking issue

#### D5. [Testing] [Medium] 30+ 处Use Math.random() GenerateTest ID
- **File**: `tests/unit/org-governance/approval-routing-service-extended.test.ts:32` 等
- **Issue**: 非确定性使Test难以重现
- **Suggestion**: Use确定性 ID Generate

#### D6. [资源] [Medium] partialTest缺少 bus.dispose() Call
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts`
- **Issue**: publish/subscribe/pendingForConsumer Test只Call db.close() 但not yet dispose bus
- **Suggestion**: 在 db.close() 前Add `bus.dispose()`

#### D7. [code规范] [Low] cleanupPath 与 db.close in ordernot一致
- **File**: `tests/unit/core/events/memory-leak.test.ts:22-24` vs durable-event-bus-async.test.ts
- **Suggestion**: establishUnify的Clean upin order标准

#### D8. [Testing] [Low] @ts-ignore bypassclass型Check
- **File**: `tests/unit/platform/shared/observability/structured-logger-edge-cases.test.ts:250` 等
- **Suggestion**: Use `// @ts-expect-error` andAdd explanations

#### D9. [Testing] [Medium] plugin-spi-registry-invocation.test.ts 多处短时延
- **File**: `tests/unit/domains/registry/plugin-spi-registry-invocation.test.ts:40,91,94,150,327,800,834`
- **Issue**: 5-25ms setTimeout 在慢速 CI 易failure
- **Suggestion**: 增加至 100ms+ orUse轮询

#### D10. [Testing] [Low] deliverPending Test注释与Implementnot符
- **File**: `tests/unit/platform/five-plane-state-evidence/events/durable-event-bus-async.test.ts:233-234`
- **Issue**: 注释suggestValidate投递row为但实际只Validate返回valueclass型
- **Suggestion**: AddAssertValidate delivered.length

---

#### E. config/ 和 deploy/ found (11个issue)

#### E1. [Configuration] [Critical] config/security/ 缺少Securefield
- **File**: `config/security/*.json`
- **Issue**: 只with `approvalMode`，缺少 `sandboxMode` 和 `remoteWorkerRegistration`
- **Suggestion**: Supplement missingSecureConfigurefield

#### E2. [.gitignore] [Medium] 缺少 .audit/ directory模式
- **File**: `.gitignore`
- **Issue**: `.audit/` exists但not yet排除
- **Suggestion**: Add `.audit/`

#### E3. [.gitignore] [Medium] 缺少 dist_* 和 :memory:* 模式
- **File**: `.gitignore`
- **Issue**: 缺少 `dist_*/`, `:memory:*`, `dist-test/`
- **Suggestion**: 补充

#### E4. [Terraform] [Medium] orphaned 空 EKS cluster resource
- **File**: `deploy/terraform/modules/eks/main.tf:157-160`
- **Issue**: `count = 0` 的死code
- **Suggestion**: Delete orphaned resource block

#### E5. [Terraform] [Medium] 硬Encode VPC CIDR
- **File**: `deploy/terraform/modules/rds/main.tf:80`, `elasticache/main.tf:62`
- **Issue**: `cidr_blocks = ["10.0.0.0/16"]` 硬Encode
- **Suggestion**: Add `vpc_cidr` variable

#### E6. [Terraform] [Low] backend region not匹配
- **File**: `deploy/terraform/main.tf:14`
- **Issue**: S3 backend region `ap-southeast-1` vs provider `us-east-1`
- **Suggestion**: 使 backend region 可Configure

#### E7. [Helm] [Medium] pre-prod Use production NODE_ENV
- **File**: `deploy/helm/automatic-agent/values-pre-prod.yaml:43`
- **Issue**: `NODE_ENV: "production"` 应为 `"pre-production"`
- **Suggestion**: correct

#### E8. [Deployment] [Medium] 缺少 kubernetes/ directory
- **File**: `deploy/`
- **Issue**: none `/deploy/kubernetes/manifests/`
- **Suggestion**: Add K8s YAML 模板or文档Explain

#### E9. [ECR] [Low] repository name none环境后缀
- **File**: `deploy/terraform/modules/ecr/main.tf:26`
- **Issue**: 所with环境共享同一 ECR repository
- **Suggestion**: Add environment suffix

#### E10. [Configuration] [Low] 环境间 storage driver not一致
- **File**: `config/environments/*.json`
- **Issue**: dev/staging/test 引用 `config/runtime/default.json`
- **Suggestion**: Ensure每个环境with适当的 storage Configure

#### E11. [Config] [Low] tsconfig.temp.json Name误导
- **File**: `tsconfig.temp.json`
- **Issue**: "temp" suggeststaging但实际被Use
- **Suggestion**: 重Name为 `tsconfig.build-test.json`

---

#### F. docs_zh/ 和 ui/ found (8个issue)

#### F1. [UI] [Critical] SharedWorkerWSClient memory leak
- **File**: `ui/packages/shared/api-client/src/ws-client.ts:359`
- **Issue**: `message` event监听器在 disconnect() 时not yetRemove
- **Suggestion**: 在 disconnect() 中Add `removeEventListener` andCall `port.close()`

#### F2. [UI] [Medium] 缺少全局 Error Boundary
- **File**: `ui/apps/web/src/main.tsx`
- **Issue**: 只with FeatureErrorBoundary Wrapsingle组件，none全局Protect
- **Suggestion**: 在 App 组件外Add全局 Error Boundary

#### F3. [Documentation] [Critical] 架构文档版本not一致
- **File**: `docs_zh/architecture/00-platform-architecture.md` (v4.3) vs `02-code-architecture-reference.md` (v13.0)
- **Issue**: 主要文档彼此引用过时版本
- **Suggestion**: Unify版本编号策略

#### F4. [Documentation] [Medium] 缺少 API SDK 文档
- **File**: `docs_zh/reference/` directory
- **Issue**: WSClient、RESTClient、interceptors none API 文档
- **Suggestion**: 新增 `api-client.md`

#### F5. [Documentation] [Low] Contract 文档与ImplementnotSync
- **File**: `docs_zh/contracts/` multiple .md file
- **Issue**: 文档声称 Implemented 但codemayalready演进
- **Suggestion**: establish contract TestautomaticGenerateValidateReport

#### F6. [UI] [Low] replayBufferByChannel maynone限增长
- **File**: `ui/packages/shared/api-client/src/ws-client.ts:413,325`
- **Issue**: SharedWorkerWSClient 和 BrowserWSClient 的 replay buffer 只在Connect时Clean up
- **Suggestion**: 在 disconnect() 时Clean up replay buffer

#### F7. [UI] [Low] XSS risknot yetfound
- **File**: UI 源码
- **Issue**: none `dangerouslySetInnerHTML`、`innerHTML` 直接赋valueor `eval`
- **Suggestion**: 保持currently模式

#### F8. [Documentation] [Low] src/core/ not yet标注为 Legacy
- **File**: `docs_zh/architecture/01-code-structure.md`
- **Issue**: 文档not yetExplain `src/core/` is Legacy Compatibility层
- **Suggestion**: 标注为 Legacy

---

#### G. src/interaction/, org-governance/, ops-maturity/, scale-ecosystem/, core/ found (10个issue)

#### G1. [ops-maturity] [Medium] Benchmark percentile Calculateerror
- **File**: `src/ops-maturity/drift-detection/learning/benchmark-runner.ts:211-216`
- **Issue**: `successRateBefore` is加权平均而非 proper percentile
- **Suggestion**: 如with individual samples，Sort后取百分位

#### G2. [interaction] [Medium] `nl-gateway/index.ts` 1669rowNeeds to be split
- **File**: `src/interaction/nl-gateway/index.ts`
- **Issue**: 包含 NL gateway、ambiguity handling、slot resolution、disambiguation、intent parsing
- **Suggestion**: Split为 NlGatewayService、IntentParserService、SlotResolverService 等

#### G3. [interaction] [Medium] `workflow-builder-service.ts` 710row
- **File**: `src/interaction/ux/workflow-builder-service.ts`
- **Suggestion**: 提取 WorkflowStepBuilder、WorkflowValidator、ExecutionTracker

#### G4. [scale-ecosystem] [Medium] `tenant-platform-service.ts` 1231row
- **File**: `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts`
- **Suggestion**: Split为 TenantLifecycleService、TenantTopologyService、ComplianceProgramService、HaProgramService

#### G5. [ops-maturity] [Low] console.log 代替 StructuredLogger
- **File**: `src/ops-maturity/chaos/chaos-experiment-scheduler.ts:262,595,598,601,604`
- **Issue**: 多处 `console.log` 用于 chaos 实验event
- **Suggestion**: Replace with StructuredLogger

#### G6. [scale-ecosystem] [Low] TrustLevel enum重复Define
- **File**: `src/scale-ecosystem/federation/federation-gateway.ts:31` 和 `trust-relationship.ts:71`
- **Issue**: 两处Define相同的 `TrustLevel` enum
- **Suggestion**: 提取到 shared types file

#### G7. [interaction] [Low] replayBuffer maycauses GC pressure
- **File**: `src/interaction/dashboard/dashboard-websocket-server.ts:100,450-455`
- **Issue**: `shift()` 在高频时may低效
- **Suggestion**: Consider ring buffer or Deque Implement

#### G8. [interaction] [Low] R4-38 fix需Validate覆盖
- **File**: `src/interaction/dashboard/dashboard-websocket-server.ts:144-145,158`
- **Issue**: 注释indicatein the pastwithnot yetAuthorizeaccessvulnerability
- **Suggestion**: Validate此fixwith integration tests 覆盖

#### G9. [ops-maturity] [Low] p50/p99 latency CalculateUse估算
- **File**: `src/interaction/dashboard/health-scorer/index.ts:55-56`
- **Issue**: based on queue depth heuristics 而非实际测量
- **Suggestion**: Document为估算模式

#### G10. [ops-maturity] [Low] setInterval 中 async void
- **File**: `src/ops-maturity/chaos/chaos-experiment-scheduler.ts:866`
- **Issue**: async callback 中not yetCatch的 rejection willTerminateprocess
- **Suggestion**: 用 try/catch Wrap evaluator()

---

### Summary

本次全量Review（第十八轮 - 2026-05-14）through7个androwproxyfound了**73个新issue**。

**High Priority (Requires Immediate Action)**:
1. SharedWorkerWSClient memory leak - event监听器not yetClean up
2. DomainLifecycleState class型Definenot一致 - 两套not同value
3. plugin-runtime-child.ts sandboxRoot noneValidate - process.chdir() Securevulnerability
4. plugin-runtime-host.ts child event监听器not yetClean up - memory leak
5. OAuth tokens 明文Store - Securerisk
6. 硬Encode CVE bypass SBOM Validate - 虚假Secure感
7. config/security/ 缺少 sandboxMode/remoteWorkerRegistration
8. budget-allocator.test.ts 缺少 throttle ratio Assert
9. harness/index.ts 2317row God Object
10. durable-event-bus.ts Map/Set 积累noneClean up

**Medium Priority**:
1. 8个超大型fileNeeds to be split (700-2317row)
2. 30+ Math.random() causes非确定性Test
3. 25+ TestfileUse @ts-nocheck
4. console.log 代替 StructuredLogger (5处)
5. setInterval none clearInterval (6+处)
6. as unknown as 双转型滥用 (25+处)
7. @ts-ignore 滥用 (21+处)
8. process.exit() Anti-pattern (4处)
9. CLI parameterParsenoneValidate
10. 架构文档版本not一致

**Low Priority**:
1. .gitignore 缺少 .audit/, dist_*, :memory:* 等
2. Terraform orphaned EKS resource
3. pre-prod NODE_ENV 设为 production
4. TrustLevel enum重复Define
5. ECR repository name none环境后缀
6. 缺少 kubernetes/ directory
7. tsconfig.temp.json Name误导
8. replayBuffer may GC pressure
9. XSS 防护良好保持
10. src/core/ not yet标注为 Legacy

### Issue Statistics (Cumulative)

| class别 | 高严重 | 中严重 | 低严重 | 合计 |
|------|--------|--------|--------|------|
| 源code | 87+10=97 | 96+8=104 | 57+10=67 | 268 |
| Test | 12+1=13 | 18+2=20 | 12+1=13 | 46 |
| Configure | 11+1=12 | 40+1=41 | 39+4=43 | 96 |
| Secure | 20+2=22 | 18+1=19 | 3 | 44 |
| 文档 | 2+1=3 | 8+1=9 | 3+1=4 | 16 |
| UI | 0+1=1 | 4+1=5 | 4+1=5 | 11 |
| Deploy | 1 | 12+1=13 | 6+1=7 | 21 |
| **合计** | **146** | **211** | **139** | **496** |

### Priority Fix Recommendations

**Immediate Action (This Week)**:
1. fix SharedWorkerWSClient memory leak (Add removeEventListener)
2. Unify DomainLifecycleState Define (Keep domain-specs.ts)
3. fix plugin-runtime-child.ts sandboxRoot Validate
4. Clean up plugin-runtime-host.ts event监听器
5. Implement OAuth token SecureStore (keychain orEncrypt)
6. Delete硬Encode CVE bypass (plugin-definition.ts)
7. Add sandboxMode/remoteWorkerRegistration 到 config/security/

**Short Term (This Month)**:
1. Split harness/index.ts (2317row) 和其他 8 个超大型file
2. fix budget-allocator.test.ts throttle ratio Assert
3. eliminate Math.random() 非确定性 (Use crypto.randomUUID)
4. Remove 25+ Testfile的 @ts-nocheck
5. Unify console.log → StructuredLogger
6. Add所with setInterval 的 clearInterval path
7. 减少 as unknown as 和 @ts-ignore Use

**Long Term Planning**:
1. Refactor所with God Objects (8个超大型file)
2. establish架构边界和interfacecontract
3. Implement内存SecureValidate机制
4. establishcode quality门禁 (class型Secure、Test覆盖)
5. Unify版本编号策略 (架构文档)
6. 完善文档和培训

### Known Test Failures (14 files, 1620 tests)

详情见 `.audit/quality.md`

*Review generated: 2026-05-14*
