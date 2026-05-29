# ADR-116 Interface Rate Limit Key Design

- Status：Accepted

## Background
不同入口曾uses不同 rate-limit key，导致运营侧no法预测限流isno共享桶。

## Decision
- rate-limit key 设计必须明确维度：
  - entryPoint
  - tenantId（如可得）
  - clientIp 或 service identity
  - endpoint / route id
- 不同入口isno共享桶必须显式defines，不能依靠实现偶然一致。
- 任何 fallback key 都必须文档化，避免“一个入口按 IP，另一个入口按 inject 前缀”的隐式差异。

## 结果
- 限流策略成为显式运维接口，而不isimplementation details。

## 相关实现
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/http-server/*`
