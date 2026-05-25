# ADR-113 Session Tenant Resolution And Principal Scope

## 状态
Accepted

## 背景
HTTP 用户会话、service principal 和租户隔离在实现上已经收口到统一 scope 判断，但之前没有一份权威文档解释 tenant 是如何解析和传播的。

## 决策
- 用户会话对象必须直接携带 `tenantId`，作为下游 `TenantScopeFilter` 的输入。
- service principal 不默认继承任意 tenant 权限；缺少 tenant 上下文时按 fail-closed 处理，再结合 namespace / platform 权限做额外判定。
- 会话切租户必须显式创建或刷新新的认证上下文，不允许在同一 token 内隐式漂移。

## 结果
- 租户边界解析路径从“隐式猜测”变成“会话字段 + scope filter”。
- review 中关于 session tenant 解析缺少权威说明的问题归零。

## 相关实现
- `src/platform/five-plane-interface/api/session-management.ts`
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-control-plane/incident-control/tenant-scope-filter.ts`

