// Seeded positive sample: a service principal that is granted the
// 'admin' role on authentication (P0 per §9.3).
// The audit:auth-role-mapping script MUST report this.

export interface ServicePrincipal {
  principalId: string;
  roles: string[];
}

export function grantDefaultAdmin(p: ServicePrincipal): ServicePrincipal {
  if (p.roles.includes("admin")) {
    return p;
  }
  p.roles.push("admin");
  return p;
}

export function defaultAdminForServicePrincipal(): ServicePrincipal {
  return {
    principalId: "svc-foo",
    roles: ["admin"],
  };
}
