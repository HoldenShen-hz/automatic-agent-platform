# Terraform Deployment Notes

The root module expects backend settings to be injected with `terraform init -backend-config=...` rather than hardcoding a shared S3 bucket, region, or state key in source control.

Minimum backend controls:
- Use a distinct `key` per environment and region, for example `env/dev.tfstate`, `env/prod.tfstate`, and `multi-region/primary.tfstate`.
- Keep the backend bucket, lock table, and region in operator-managed backend config files.
- Supply sensitive values such as `redis_auth_token` and KMS ARNs through secure tfvars or the CI secret manager.
- Keep the root AWS provider on an exact version pin and review upgrades explicitly instead of relying on a floating `~>` range.

Environment overlays under `deploy/terraform/environments/` now carry region, CIDR, and AZ values explicitly so the root module has no hidden regional defaults.

Environment profile differences:

- `dev.tfvars`: single-node cost floor, smaller RDS/Redis classes, relaxed capacity.
- `staging.tfvars`: production-like topology rehearsal without production-only Multi-AZ RDS.
- `prod.tfvars`: larger node pool, larger stateful tiers, production retention/protection defaults.
- `multi-region/{primary,secondary}.tfvars`: warm-standby regional split with distinct CIDRs and backend keys.
- `eks_node_taints`: optional list of `{ key, value, effect }` objects passed straight into the managed node group contract when workloads need dedicated scheduling lanes.

Validation gates:

- CI must run `terraform fmt -check -recursive`, `terraform init -backend=false`, and `terraform validate` against this directory.
- The root module intentionally keeps backend coordinates out of source control; operators must supply them through `terraform init -backend-config=...`.
