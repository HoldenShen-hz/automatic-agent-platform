# Multi-Region Environment

Use this directory for the primary/secondary Terraform overlay that validates the cross-region deployment service.

Recommended shape:
- `primary` cluster in the preferred production region.
- `secondary` cluster in a warm standby region.
- shared PostgreSQL replication and region-aware traffic management.

Validation evidence should be recorded alongside `doc/operations/cross-region-validation.md`.
