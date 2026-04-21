import { z } from "zod";
export declare const OidcProviderConfigSchema: z.ZodObject<{
    providerId: z.ZodString;
    issuer: z.ZodString;
    clientId: z.ZodString;
    redirectUri: z.ZodString;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    scopes: string[];
    clientId: string;
    providerId: string;
    issuer: string;
    redirectUri: string;
}, {
    clientId: string;
    providerId: string;
    issuer: string;
    redirectUri: string;
    scopes?: string[] | undefined;
}>;
export type OidcProviderConfig = z.infer<typeof OidcProviderConfigSchema>;
export declare function buildOidcAuthorizationUrl(config: OidcProviderConfig, state: string): string;
