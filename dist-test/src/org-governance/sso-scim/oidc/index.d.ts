import { z } from "zod";
export declare const OidcProviderConfigSchema: z.ZodObject<{
    providerId: z.ZodString;
    issuer: z.ZodString;
    clientId: z.ZodString;
    clientSecret: z.ZodOptional<z.ZodString>;
    redirectUri: z.ZodString;
    authorizationEndpoint: z.ZodOptional<z.ZodString>;
    tokenEndpoint: z.ZodOptional<z.ZodString>;
    userInfoEndpoint: z.ZodOptional<z.ZodString>;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    scopes: string[];
    providerId: string;
    issuer: string;
    clientId: string;
    redirectUri: string;
    clientSecret?: string | undefined;
    authorizationEndpoint?: string | undefined;
    tokenEndpoint?: string | undefined;
    userInfoEndpoint?: string | undefined;
}, {
    providerId: string;
    issuer: string;
    clientId: string;
    redirectUri: string;
    scopes?: string[] | undefined;
    clientSecret?: string | undefined;
    authorizationEndpoint?: string | undefined;
    tokenEndpoint?: string | undefined;
    userInfoEndpoint?: string | undefined;
}>;
export type OidcProviderConfig = z.infer<typeof OidcProviderConfigSchema>;
export declare function buildOidcAuthorizationUrl(config: OidcProviderConfig, state: string): string;
