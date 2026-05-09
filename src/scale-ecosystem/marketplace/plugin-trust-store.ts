import { z } from "zod";

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { TenantIsolationMode } from "../../platform/contracts/types/domain.js";

export const PluginTrustRootSchema = z.object({
  trustRootId: z.string().min(1),
  publisherId: z.string().min(1),
  rootFingerprint: z.string().min(16),
  trustLevel: z.enum(["internal", "verified", "community", "unknown"]).default("unknown"),
  source: z.string().min(1),
  supportedArtifactTypes: z.array(z.string()).default([]),
  requiredIsolationMode: z.custom<TenantIsolationMode>().default("shared_hard_scoped"),
  active: z.boolean().default(true),
  registeredAt: z.string().min(1),
});

export type PluginTrustRoot = z.infer<typeof PluginTrustRootSchema>;

export const PluginProvenanceAttestationSchema = z.object({
  provenanceId: z.string().min(1),
  artifactId: z.string().min(1),
  publisherId: z.string().min(1),
  sourceUri: z.string().min(1),
  manifestChecksum: z.string().min(1),
  sbomDigest: z.string().min(1),
  signatureDigest: z.string().min(1),
  observedAt: z.string().min(1),
});

export type PluginProvenanceAttestation = z.infer<typeof PluginProvenanceAttestationSchema>;

export const RevokedPluginArtifactSchema = z.object({
  artifactId: z.string().min(1),
  publisherId: z.string().min(1),
  reasonCode: z.string().min(1),
  revokedAt: z.string().min(1),
});

export type RevokedPluginArtifact = z.infer<typeof RevokedPluginArtifactSchema>;

export interface RegisterPluginTrustRootInput {
  readonly publisherId: string;
  readonly rootFingerprint: string;
  readonly source: string;
  readonly trustLevel?: PluginTrustRoot["trustLevel"];
  readonly supportedArtifactTypes?: readonly string[];
  readonly requiredIsolationMode?: TenantIsolationMode;
}

export interface RecordPluginProvenanceInput {
  readonly artifactId: string;
  readonly publisherId: string;
  readonly sourceUri: string;
  readonly manifestChecksum: string;
  readonly sbomDigest: string;
  readonly signatureDigest: string;
}

export interface RevokePluginArtifactInput {
  readonly artifactId: string;
  readonly publisherId: string;
  readonly reasonCode: string;
}

export interface PluginTrustEvaluationInput {
  readonly artifactId: string;
  readonly publisherId: string;
  readonly artifactType: string;
  readonly manifestChecksum: string;
  readonly sbomDigest: string;
  readonly signatureDigest: string;
  readonly signatureVerified: boolean;
  readonly sbomVerified: boolean;
  readonly sandboxVerified: boolean;
  readonly egressPolicyReviewed: boolean;
}

export interface PluginTrustDecision {
  readonly trusted: boolean;
  readonly blockedBy: readonly string[];
  readonly matchedTrustRootId: string | null;
  readonly provenanceId: string | null;
  readonly requiredIsolationMode: TenantIsolationMode | null;
}

export class PluginTrustStore {
  private readonly trustRoots = new Map<string, PluginTrustRoot>();
  private readonly provenanceByArtifact = new Map<string, PluginProvenanceAttestation>();
  private readonly revokedArtifacts = new Map<string, RevokedPluginArtifact>();

  public registerTrustRoot(input: RegisterPluginTrustRootInput): PluginTrustRoot {
    const record = PluginTrustRootSchema.parse({
      trustRootId: newId("plugin_trust_root"),
      publisherId: input.publisherId,
      rootFingerprint: input.rootFingerprint,
      trustLevel: input.trustLevel ?? "verified",
      source: input.source,
      supportedArtifactTypes: input.supportedArtifactTypes ?? [],
      requiredIsolationMode: input.requiredIsolationMode ?? "shared_hard_scoped",
      active: true,
      registeredAt: nowIso(),
    });
    this.trustRoots.set(record.publisherId, record);
    return record;
  }

  public recordProvenance(input: RecordPluginProvenanceInput): PluginProvenanceAttestation {
    const record = PluginProvenanceAttestationSchema.parse({
      provenanceId: newId("plugin_provenance"),
      artifactId: input.artifactId,
      publisherId: input.publisherId,
      sourceUri: input.sourceUri,
      manifestChecksum: input.manifestChecksum,
      sbomDigest: input.sbomDigest,
      signatureDigest: input.signatureDigest,
      observedAt: nowIso(),
    });
    this.provenanceByArtifact.set(record.artifactId, record);
    return record;
  }

  public revokeArtifact(input: RevokePluginArtifactInput): RevokedPluginArtifact {
    const record = RevokedPluginArtifactSchema.parse({
      artifactId: input.artifactId,
      publisherId: input.publisherId,
      reasonCode: input.reasonCode,
      revokedAt: nowIso(),
    });
    this.revokedArtifacts.set(record.artifactId, record);
    return record;
  }

  public getTrustRoot(publisherId: string): PluginTrustRoot | null {
    return this.trustRoots.get(publisherId) ?? null;
  }

  public getProvenance(artifactId: string): PluginProvenanceAttestation | null {
    return this.provenanceByArtifact.get(artifactId) ?? null;
  }

  public getRevocation(artifactId: string): RevokedPluginArtifact | null {
    return this.revokedArtifacts.get(artifactId) ?? null;
  }

  public evaluateArtifact(input: PluginTrustEvaluationInput): PluginTrustDecision {
    const blockedBy: string[] = [];
    const trustRoot = this.trustRoots.get(input.publisherId) ?? null;
    const provenance = this.provenanceByArtifact.get(input.artifactId) ?? null;
    const revocation = this.revokedArtifacts.get(input.artifactId) ?? null;

    if (trustRoot == null || !trustRoot.active) {
      blockedBy.push("plugin_trust_root_missing");
    } else if (trustRoot.supportedArtifactTypes.length > 0 && !trustRoot.supportedArtifactTypes.includes(input.artifactType)) {
      blockedBy.push("plugin_trust_root_artifact_type_mismatch");
    }

    if (revocation != null) {
      blockedBy.push("plugin_artifact_revoked");
    }
    if (provenance == null) {
      blockedBy.push("plugin_provenance_missing");
    } else {
      if (provenance.publisherId !== input.publisherId) {
        blockedBy.push("plugin_provenance_publisher_mismatch");
      }
      if (provenance.manifestChecksum !== input.manifestChecksum) {
        blockedBy.push("plugin_manifest_checksum_mismatch");
      }
      if (provenance.sbomDigest !== input.sbomDigest) {
        blockedBy.push("plugin_sbom_digest_mismatch");
      }
      if (provenance.signatureDigest !== input.signatureDigest) {
        blockedBy.push("plugin_signature_digest_mismatch");
      }
    }

    if (!input.signatureVerified) {
      blockedBy.push("plugin_signature_unverified");
    }
    if (!input.sbomVerified) {
      blockedBy.push("plugin_sbom_unverified");
    }
    if (!input.sandboxVerified) {
      blockedBy.push("plugin_sandbox_unverified");
    }
    if (!input.egressPolicyReviewed) {
      blockedBy.push("plugin_egress_policy_unreviewed");
    }

    return {
      trusted: blockedBy.length === 0,
      blockedBy,
      matchedTrustRootId: trustRoot?.trustRootId ?? null,
      provenanceId: provenance?.provenanceId ?? null,
      requiredIsolationMode: trustRoot?.requiredIsolationMode ?? null,
    };
  }
}
