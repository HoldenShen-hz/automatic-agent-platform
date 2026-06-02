// Seeded negative sample: a service principal that is given
// narrowly-scoped, non-admin roles. The audit:auth-role-mapping
// script MUST NOT report this.

export interface ServicePrincipal {
  principalId: string;
  roles: string[];
}

const READ_ONLY: readonly string[] = ["reader", "observer"];

export function grantReadOnly(p: ServicePrincipal): ServicePrincipal {
  for (const r of READ_ONLY) {
    if (!p.roles.includes(r)) p.roles.push(r);
  }
  return p;
}

export function defaultRolesForServicePrincipal(): ServicePrincipal {
  return {
    principalId: "svc-foo",
    roles: ["reader"],
  };
}
