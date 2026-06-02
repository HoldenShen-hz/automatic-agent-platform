# 供应链安全基线

本文档记录仓库内可审计的供应链安全入口。

## 必须保留

- `package-lock.json` 必须提交，CI 使用 `npm ci`。
- CI 必须运行 `npm audit --audit-level=high`。
- 供应链审计证据以 CI 产出的 SARIF / 审计日志为准，不要求在 `package-lock.json` 内嵌额外签名文本。
- CI 必须运行 CodeQL TypeScript 分析。
- 容器镜像必须经过 Trivy CRITICAL/HIGH 扫描。
- 发布镜像必须使用显式 tag，并附带 commit sha tag。

## 变更规则

- 新增依赖必须说明用途、运行面和替代方案。
- 依赖升级如果包含 breaking change，必须配套最小定向测试。
- 安全漏洞不得用静态白名单长期绕过；例外必须有到期时间和 owner。

## 对外入口

- 仓库对外的安全披露入口见根 [SECURITY.md](../../SECURITY.md)。
- 第三方依赖归因入口见根 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。
