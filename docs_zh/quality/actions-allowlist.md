# GitHub Actions Allowlist

本清单是仓库当前允许使用的第三方 GitHub Actions 供应链白名单。要求如下：

- 所有 action 必须使用 40 位 commit SHA pin，不允许浮动 tag。
- 新增或升级第三方 action 前，必须同步更新本清单与 `scripts/ci/audit-ci-supply-chain.mjs` 校验。
- 能用官方 `actions/*` 或云厂商官方 action 的场景，不引入新的第三方 action。

| Action | Pin | 用途 | 风险控制 |
| --- | --- | --- | --- |
| `treosh/lighthouse-ci-action` | `512cc908a55bfb0ad231facca52adf3d3a651df4` | UI 预览站点 Lighthouse 质量门 | 仅运行在 `ui-quality.yml`，固定 SHA，升级需复审 owner/仓库归属与 release note。 |
| `aquasecurity/trivy-action` | `ed142fd0673e97e23eac54620cfb913e5ce36c25` | 容器镜像漏洞扫描 | 只扫描 CI 已构建并保存的镜像 tar，避免 PR 任意镜像输入。 |
| `docker/build-push-action` | `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` | 受控镜像 build/push | 发布工作流使用独立 `scope=publish-image` cache，避免与 PR CI 共享层缓存。 |
| `docker/setup-buildx-action` | `8d2750c68a42422c14e847fe6c8ac0403b4cbd6f` | Buildx builder 初始化 | 仅在发布工作流中启用，配合最小权限 job。 |
| `docker/login-action` | `c94ce9fb468520275223c153574b00df6fe4bcc9` | 容器仓库登录 | 统一通过 action 输入传 token，不再走 shell pipe。 |
| `docker/metadata-action` | `c299e40c65443455700f0fdfc63efafe5b349051` | 镜像 tag / label 生成 | 只消费 preflight 已验证的仓库名和 tag。 |
| `sigstore/cosign-installer` | `f713795cb21599bc4e5c4b58cbad1da852d7eeb9` | 安装 cosign 用于 keyless 签名 | 只在 publish job 中启用，依赖 job 级 `id-token: write`。 |
