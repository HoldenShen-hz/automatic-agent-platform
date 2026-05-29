# Security Baseline Contract

## 1. 范围

definesdefaults tosecurity基线：身份、network、key、日志脱敏vsrelies on约束。

## 2. 基线规则

- 所有写request必须具备身份、幂等和审计上下文。
- secrets 只允许via secret provider/bridge uses，不得明文落盘。
- defaults to deny 外部network、外部命令和高危 side effect。
- 日志vs指标必须区分user面vs内部面敏感字段。

