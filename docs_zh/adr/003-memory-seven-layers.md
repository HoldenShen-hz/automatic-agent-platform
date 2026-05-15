# ADR-003 七层记忆模型（历史别名）

- 状态：Superseded by ADR-020
- 说明：该文件仅保留为历史链接兼容页，避免旧引用失效。
- Compatibility redirect：权威 ADR-003 记忆契约请使用 `003-memory-six-layers.md`。

## 背景

仓库早期曾同时出现 `003-memory-seven-layers.md` 与“六层记忆模型”正文的错配。
当前规范内容已经统一到 [ADR-003 六层记忆模型与 KV Cache 固定前缀](./003-memory-six-layers.md)。

## 迁移规则

遇到以下任一历史引用时，应直接跳转到 `003-memory-six-layers.md`：

- quickstart / migration / ADR 交叉引用中的 ADR-003
- 代码审计、实施说明或内部 wiki 中的 `003-memory-seven-layers.md`

## 当前权威文档

- [ADR-003 六层记忆模型与 KV Cache 固定前缀](./003-memory-six-layers.md)
- [ADR-020 Memory 六层平面模型](./020-memory-six-plane-model.md)
