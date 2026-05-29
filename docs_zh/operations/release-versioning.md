# 发布与版本策略

本文档定义当前仓库的最小发布版本口径。

## NPM / 源码版本

- `package.json` 中的 `version` 是源码包版本事实来源。
- 当前发布基线版本：`0.2.0`
- `CHANGELOG.md` 必须同时维护 `Unreleased` 和最近一次已发布版本，避免把未发布提交误写成已发版事实。
- 当前仓库仍处于 `0.x` 预 GA 阶段：频繁 contract/docs 变更不要求每次提交都滚 `package.json`，但一旦发布包或镜像，就必须回写 changelog。
- 版本变更必须配套 changelog gate。
- Node/npm 支持范围由 `package.json` 的 `engines` 字段声明。
- `deploy/helm/automatic-agent/Chart.yaml` 的 `version/appVersion` 必须与 `package.json version` 保持一致，`audit:ci-supply-chain` 负责阻止漂移。

## 镜像版本

- 发布工作流必须使用调用方传入的 `image_tag`。
- `Dockerfile` 基镜像必须使用显式版本 + digest（例如 `node:22.21.1-bookworm-slim@sha256:...`），避免 tag 漂移。
- 镜像发布同时生成 `sha-<commit>` 标签，便于回滚和追踪。
- 部署工作流只部署显式传入的镜像 tag，不使用 floating latest。
- 版本发布前的硬门禁检查见 [operations-checklist.md](./operations-checklist.md) 的 `Pre-Launch Top 20 Hard Checklist`。

## 分支策略

- `main` 是唯一可发布分支，发布、部署和回滚证据均以 `main` 上的提交为准。
- `codex/*`、`fix/*`、`feature/*` 分支只允许作为短期工作分支，合入前必须完成对应 issue/table 行的定向验证。
- 长期未合并分支不得作为事实来源；如需保留历史，应在 review 表或 operations 文档中记录对应证据，而不是依赖远端分支名。

## 提交信息

- 提交标题使用短祈使句，描述具体行为变化，例如 `Add worker handshake lifecycle`。
- 禁止使用无语义标题作为最终提交说明，例如 `chore: sync`、`update`、`fix`。
- 一次提交只覆盖一个问题簇；若同时修改运行时代码和文档，提交说明必须点名验证命令或证据文件。

## 关联文档

- 发布前检查清单：[operations-checklist.md](./operations-checklist.md)
- 权威版本记录：[../../CHANGELOG.md](../../CHANGELOG.md)
- 发布/回滚执行契约：[../contracts/release_rollout_and_rollback_contract.md](../contracts/release_rollout_and_rollback_contract.md)
