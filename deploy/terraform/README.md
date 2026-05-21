# Terraform Deployment Notes

The root module expects backend settings to be injected with `terraform init -backend-config=...` rather than hardcoding a shared S3 bucket, region, or state key in source control.

Minimum backend controls:
- Use a distinct `key` per environment and region, for example `env/dev.tfstate`, `env/prod.tfstate`, and `multi-region/primary.tfstate`.
- Keep the backend bucket, lock table, and region in operator-managed backend config files.
- Supply sensitive values such as `redis_auth_token` and KMS ARNs through secure tfvars or the CI secret manager.

Environment overlays under `deploy/terraform/environments/` now carry region, CIDR, and AZ values explicitly so the root module has no hidden regional defaults.
