# 依赖升级计划

## 目标

针对 review 中指出的依赖滞后问题，建立可以持续执行的升级节奏，而不是一次性手工 bump 版本后失去验证闭环。

## 当前治理范围

本计划覆盖 review 明确点名、且对平台安全性和构建稳定性影响最大的依赖：

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

## 升级波次

### Wave 0: 安全与门禁基线

- 保持 `npm audit`、lockfile、CI coverage/typecheck 门禁持续有效。
- 安全相关依赖先看是否已达到 review 指出的安全版本下限；当前 `xml-crypto` 已与该 review 基线对齐，后续以安全公告为准继续跟踪。
- 每次升级前先记录当前测试矩阵与回滚命令，避免把“升级验证”变成无证据的人工试错。

### Wave 1: 同 major 内的安全/兼容升级

- `typescript`：先推进到当前 5.x 最新可兼容版本，再评估 6.x。
- `eslint`：先保持 9.x 线内最新兼容版本，并同步验证 `typescript-eslint`、`@eslint/js`。
- `@types/node`：优先与仓库声明的 `node >=20 <23` 支持范围对齐，避免类型定义先于运行时支持过度前跳。

验证门槛：

- `npm run build:test`
- 受影响定向测试
- 相关 CI 审计脚本

### Wave 2: major 版本评估

- `zod`：单独建立从 3.x 到 4.x 的 breaking-change 清单，重点检查 schema transform、error shape、推断类型和生态兼容性。
- `eslint`：等待周边插件和配置链路支持后，再评估 10.x。
- `@types/node`：只有当 Node 支持区间提升到 24/25 系列时，才同步推进更高 major。

验证门槛：

- 升级分支中保留迁移说明
- 关键使用点具备定向回归
- 如涉及配置格式变化，补文档和审计

### Wave 3: 工具链大版本升级

- `typescript` 6.x 进入单独波次处理，不与业务依赖升级混跑。
- 升级前必须确认 `tsx`、`typescript-eslint`、`@stryker-mutator/typescript-checker` 与编译输出无阻塞兼容问题。
- 若出现类型系统大面积回归，按“先锁定版本、后拆迁移清单”的方式回退，不把大版本迁移塞进普通缺陷修复。

## 节奏与责任

- 节奏：每月一次依赖复核；每季度至少完成一轮升级波次。
- 触发器：出现高危漏洞、Node LTS 变化、CI 工具链不兼容、review 再次点名时立即提前处理。
- 责任面：平台维护者负责升级实施，CI 审计负责阻止无计划的漂移或降级。

## 提交要求

- 升级 PR 需列出本次波次、受影响依赖、兼容性结论、回滚方式。
- major bump 必须附 breaking-change 摘要，不得只给版本号。
- 若决定暂缓升级，必须记录阻塞项和下次复核时间，不能简单标记为“稍后处理”。
