# GitHub Actions Allowlist

This list defines the repository's approved third-party GitHub Actions supply-chain allowlist.

Requirements:

- Every action must be pinned to a 40-character commit SHA. Floating tags are not allowed.
- Any new or upgraded third-party action must update both this list and the validation in `scripts/ci/audit-ci-supply-chain.mjs`.
- If an official `actions/*` or cloud-vendor official action can be used, do not introduce an additional third-party action.

| Action | Pin | Purpose | Risk Control |
| --- | --- | --- | --- |
| `treosh/lighthouse-ci-action` | `512cc908a55bfb0ad231facca52adf3d3a651df4` | Lighthouse quality gate for UI preview sites | Runs only in `ui-quality.yml`, pinned to a fixed SHA, and upgrades require owner / repository / release-note review. |
| `aquasecurity/trivy-action` | `ed142fd0673e97e23eac54620cfb913e5ce36c25` | Container image vulnerability scan | Scans only images that CI already built and archived as tar artifacts, avoiding arbitrary PR-provided image input. |
| `docker/build-push-action` | `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` | Controlled image build / push | Publish workflows use a dedicated `scope=publish-image` cache instead of sharing layer cache with PR CI. |
| `docker/setup-buildx-action` | `8d2750c68a42422c14e847fe6c8ac0403b4cbd6f` | Initialize the Buildx builder | Enabled only in publish workflows and paired with minimum-permission jobs. |
| `docker/login-action` | `c94ce9fb468520275223c153574b00df6fe4bcc9` | Log in to the container registry | Uses action inputs for token delivery instead of shell piping. |
| `docker/metadata-action` | `c299e40c65443455700f0fdfc63efafe5b349051` | Generate image tags / labels | Consumes only repository names and tags already validated by preflight checks. |
| `sigstore/cosign-installer` | `f713795cb21599bc4e5c4b58cbad1da852d7eeb9` | Install cosign for keyless signing | Enabled only in publish jobs and relies on job-level `id-token: write`. |
