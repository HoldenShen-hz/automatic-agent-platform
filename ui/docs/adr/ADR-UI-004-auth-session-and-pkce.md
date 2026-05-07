# ADR-UI-004 Auth / Session / PKCE 边界

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI SSO callback 只接受授权码流程，不接受 URL token 直入会话。

- callback 必须走 PKCE code flow。
- interceptor 每次请求动态读取 access token 与 CSRF token。
- refresh 后不得继续复用闭包里缓存的旧 token。

## 后果

- URL query token 泄漏面被关闭。
- auth shared package 与浏览器 session 生命周期保持一致。
