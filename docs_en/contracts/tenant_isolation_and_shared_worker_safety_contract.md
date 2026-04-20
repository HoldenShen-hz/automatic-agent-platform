# Tenant Isolation And Shared Worker Safety Contract

## 1. Scope

This contract defines security boundaries for shared workers, shared cache, and shared queues in multi-tenant environments.

Related documents:

- `tenant_and_organization_contract.md`
- `enterprise_secret_management_contract.md`
- `data_classification_and_prompt_handling_contract.md`

## 2. Goals

- Prevent cross-tenant data pollution.
- Prevent context leakage during shared worker reuse.
- Clarify the boundary between shared infrastructure and tenant boundaries.

## 3. Key Isolation Surfaces

- identity
- storage
- artifacts
- cache
- execution workspace
- secret scope

## 4. Rules

- Shared workers must rebuild or sanitize tenant-scoped runtime context before each execution.
- Cache keys must explicitly carry tenant / workspace boundaries.
- Artifact download, debug snapshot, and inspect API must all have tenant-aware authorization.
- Workers must not bring previous tenant's secrets, prompt context, or artifact refs into the next task.
- Worker leases, temporary directories, sandbox, repo cache, and memory snapshots must all carry tenant / workspace scope markers.
- Any execution with missing, conflicting, or undecidable tenant scope should fail-closed.

## 5. Shared vs. Dedicated Boundaries

Allowed to share: worker binary, base image, model connection pool, public read-only schema
Not allowed to share: tenant secrets, tenant runtime context, tenant file workspace, tenant-scoped memory

Additional rules:

- Shared queues can be shared, but queue messages must explicitly carry tenant / workspace ownership.
- Shared cache hits must not be reused across tenants, even if payloads appear identical.
- Before shared worker reclamation or tenant switch, context erasure and secret reclamation must be completed.

## 6. Conclusion

Multi-tenant security is not finished by adding `tenant_id` to tables; isolation of shared worker execution state must also be formally modeled.
