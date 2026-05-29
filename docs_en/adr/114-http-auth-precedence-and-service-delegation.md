# ADR-114 HTTP Auth Precedence And Service Delegation

- Status：Accepted

## Background
HTTP 入口可能同时携带userauthentication头和服务authentication头，之前缺少优先级vs审计归因Description。

## Decision
- 对外 HTTP API defaults to以userauthentication链为主。
- service-to-service authenticationvia内部 service auth 通道handle，不vs普通user header 混用。
- 若同一request同时出现uservs服务authentication信息，defaults to拒绝或走显式代理/委托流程，不做隐式优先级猜测。
- 服务代tableuser执lines时，必须同时保留：
  - 原user主体
  - 代理服务主体
  - 审计归因链

## 结果
- 消除“同一request双authentication头到底谁生效”的歧义。
- 后续若增加 on-behalf-of 模式，必须在同一 ADR 族中扩展。

## 相关实现
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/service-auth.ts`
