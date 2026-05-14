# Multi-Region Environment

Use this directory for the primary/secondary Terraform overlay that validates the cross-region deployment service.

Implemented overlays:
- `primary.tfvars` provisions the preferred production region with a dedicated `10.40.0.0/16` VPC.
- `secondary.tfvars` provisions the warm standby region with a distinct `10.50.0.0/16` VPC.
- Both overlays keep the CIDR explicit in tfvars instead of relying on the root module default.

Validation evidence should be recorded alongside `doc/operations/cross-region-validation.md`.
