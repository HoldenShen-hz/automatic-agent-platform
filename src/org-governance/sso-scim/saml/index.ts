import { z } from "zod";

export const SamlProviderConfigSchema = z.object({
  providerId: z.string().min(1),
  entryPoint: z.string().min(1),
  issuer: z.string().min(1),
  certificateFingerprint: z.string().min(1),
});

export type SamlProviderConfig = z.infer<typeof SamlProviderConfigSchema>;

export function buildSamlAudience(config: SamlProviderConfig): string {
  return `${config.issuer}:${config.providerId}`;
}
