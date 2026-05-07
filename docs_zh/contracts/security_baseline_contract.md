# Security Baseline Contract

## 1. 范围

定义默认安全基线：身份、网络、密钥、日志脱敏与依赖约束。

## 2. 基线规则

- 所有写请求必须具备身份、幂等和审计上下文。
- secrets 只允许通过 secret provider/bridge 使用，不得明文落盘。
- 默认 deny 外部网络、外部命令和高危 side effect。
- 日志与指标必须区分用户面与内部面敏感字段。

