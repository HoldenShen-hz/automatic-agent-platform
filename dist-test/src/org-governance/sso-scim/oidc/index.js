import { z } from "zod";
export const OidcProviderConfigSchema = z.object({
    providerId: z.string().min(1),
    issuer: z.string().min(1),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1).optional(),
    redirectUri: z.string().min(1),
    authorizationEndpoint: z.string().min(1).optional(),
    tokenEndpoint: z.string().min(1).optional(),
    userInfoEndpoint: z.string().min(1).optional(),
    scopes: z.array(z.string()).default(["openid", "profile", "email"]),
});
export function buildOidcAuthorizationUrl(config, state) {
    const scopes = encodeURIComponent(config.scopes.join(" "));
    const authorizationEndpoint = config.authorizationEndpoint ?? `${config.issuer}/authorize`;
    return `${authorizationEndpoint}?client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=${scopes}&state=${encodeURIComponent(state)}`;
}
//# sourceMappingURL=index.js.map