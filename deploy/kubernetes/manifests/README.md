# Kubernetes Manifests

This directory is the plain-manifest companion to the Helm chart under
`deploy/helm/automatic-agent`. Helm remains the production deployment path; the
manifests here provide reviewable smoke templates for clusters that do not run
Helm during bootstrap or disaster recovery.

Use the Helm chart for real environment values and secrets. These manifests must
only reference non-secret defaults and should be overlaid by the deployment
pipeline before use.
