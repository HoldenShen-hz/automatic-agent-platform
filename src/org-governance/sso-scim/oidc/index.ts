import { z } from "zod";

export const OidcProviderConfigSchema = z.object({
  providerId: z.string().min(1),
  issuer: z.string().min(1),
  clientId: z.string().min(1),
  redirectUri: z.string().min(1),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
});

export type OidcProviderConfig = z.infer<typeof OidcProviderConfigSchema>;

export function buildOidcAuthorizationUrl(config: OidcProviderConfig, state: string): string {
  const scopes = encodeURIComponent(config.scopes.join(" "));
  return `${config.issuer}/authorize?client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=${scopes}&state=${encodeURIComponent(state)}`;
}
