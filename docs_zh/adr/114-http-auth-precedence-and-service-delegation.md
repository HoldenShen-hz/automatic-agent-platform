# ADR-114 HTTP Auth Precedence And Service Delegation

- 状态：Accepted

## 背景
HTTP 入口可能同时携带用户认证头和服务认证头，之前缺少优先级与审计归因说明。

## 决策
- 对外 HTTP API 默认以用户认证链为主。
- service-to-service 认证通过内部 service auth 通道处理，不与普通用户 header 混用。
- 若同一请求同时出现用户与服务认证信息，默认拒绝或走显式代理/委托流程，不做隐式优先级猜测。
- 服务代表用户执行时，必须同时保留：
  - 原用户主体
  - 代理服务主体
  - 审计归因链

## 结果
- 消除“同一请求双认证头到底谁生效”的歧义。
- 后续若增加 on-behalf-of 模式，必须在同一 ADR 族中扩展。

## 相关实现
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/service-auth.ts`
