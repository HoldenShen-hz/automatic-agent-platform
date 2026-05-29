# relies on升级计划

## 目标

针对 review 中指出的relies on滞后Issue，建立可以持续执lines的升级节奏，而不is一iterations性手工 bump 版本后失去验证闭环。

## 当前治理范围

本计划覆盖 review 明确点名、且对平台security性和构建稳定性Impact最大的relies on：

- `xml-crypto`
- `zod`
- `typescript`
- `@types/node`
- `eslint`

当前仓库基线以 `package.json` 为准：

- `xml-crypto`: `^6.1.2`
- `zod`: `^3.25.76`
- `typescript`: `^5.8.3`
- `@types/node`: `^22.19.15`
- `eslint`: `^9.25.1`

## 升级波iterations

### Wave 0: securityvs门禁基线

- 保持 `npm audit`、lockfile、CI coverage/typecheck 门禁持续有效。
- security相关relies on先看isno已达到 review 指出的security版本lower limit；当前 `xml-crypto` 已vs该 review 基线对齐，后续以security公告为准继续跟踪。
- 每iterations升级前先record当前test matrixvs回滚命令，避免把“升级验证”变成no证据的人工试错。

### Wave 1: 同 major 内的security/兼容升级

- `typescript`：先推进到当前 5.x 最新可兼容版本，再评估 6.x。
- `eslint`：先保持 9.x 线内最新兼容版本，并synchronous验证 `typescript-eslint`、`@eslint/js`。
- `@types/node`：优先vs仓库声明的 `node >=22 <23` supported范围对齐，避免class型defines先于运lines时supported过度前跳。

验证门槛：

- `npm run build:test`
- 受Impact定向测试
- 相关 CI 审计脚本

### Wave 2: major 版本评估

- `zod`：单独建立从 3.x 到 4.x 的 breaking-change 清单，重点检查 schema transform、error shape、推断class型和生态兼容性。
- `eslint`：等待周边插件和configure链路supported后，再评估 10.x。
- `@types/node`：只有当 Node supported区间提升到 24/25 系列时，才synchronous推进更高 major。

验证门槛：

- 升级分支中保留迁移Description
- 关键uses点具备定向回归
- 如涉及configure格式变化，补文档和审计

### Wave 3: 工具链大版本升级

- `typescript` 6.x 进入单独波iterationshandle，不vs业务relies on升级混跑。
- 升级前必须确认 `tsx`、`typescript-eslint`、`@stryker-mutator/typescript-checker` vs编译输出no阻塞兼容Issue。
- 若出现class型系统大面积回归，按“先锁定版本、后拆迁移清单”的方式回退，不把大版本迁移塞进普通缺陷修复。

## 节奏vs责任

- 节奏：每月一iterationsrelies on复核；每季度至少完成一轮升级波iterations。
- 触发器：出现高危漏洞、Node LTS 变化、CI 工具链不兼容、review 再iterations点名时立即提前handle。
- 责任面：平台维护者负责升级实施，CI 审计负责阻止no计划的漂移或降级。

## 提交要求

- 升级 PR 需列出本iterations波iterations、受Impactrelies on、兼容性Conclusion、回滚方式。
- major bump 必须附 breaking-change 摘要，不得只给版本号。
- 若决定暂缓升级，必须record阻塞项和下iterations复核time，不能简单标记为“稍后handle”。
