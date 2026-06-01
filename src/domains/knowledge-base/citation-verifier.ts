export interface CitationClaim {
  readonly claimId: string;
  readonly text: string;
  readonly citationId?: string | null;
  readonly sourceId?: string | null;
  readonly supported: boolean;
  readonly sourceDate?: string | null;
}

export interface CitationVerificationReport {
  readonly citationCoverage: number;
  readonly citationCorrectness: number;
  readonly staleSourceCount: number;
  readonly unsupportedClaimCount: number;
  readonly staleClaimIds: readonly string[];
  readonly unsupportedClaimIds: readonly string[];
}

export interface ClaimEvidenceGraph {
  readonly nodes: readonly { id: string; type: "claim" | "citation" | "source" }[];
  readonly edges: readonly { from: string; to: string; relation: string }[];
}

function isStale(sourceDate: string | null | undefined, now: Date): boolean {
  if (sourceDate == null) {
    return false;
  }
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) {
    return false;
  }
  const maxAgeDays = 365;
  return now.getTime() - parsed > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function verifyCitations(claims: readonly CitationClaim[], now: Date = new Date()): CitationVerificationReport {
  const withCitation = claims.filter((claim) => (claim.citationId?.trim() ?? "").length > 0);
  const supported = claims.filter((claim) => claim.supported);
  const staleClaimIds = claims.filter((claim) => isStale(claim.sourceDate, now)).map((claim) => claim.claimId);
  const unsupportedClaimIds = claims.filter((claim) => !claim.supported).map((claim) => claim.claimId);
  return {
    citationCoverage: claims.length === 0 ? 1 : withCitation.length / claims.length,
    citationCorrectness: withCitation.length === 0 ? 1 : supported.filter((claim) => (claim.citationId?.trim() ?? "").length > 0).length / withCitation.length,
    staleSourceCount: staleClaimIds.length,
    unsupportedClaimCount: unsupportedClaimIds.length,
    staleClaimIds,
    unsupportedClaimIds,
  };
}

export function buildClaimEvidenceGraph(claims: readonly CitationClaim[]): ClaimEvidenceGraph {
  const nodes: Array<{ id: string; type: "claim" | "citation" | "source" }> = [];
  const edges: Array<{ from: string; to: string; relation: string }> = [];
  for (const claim of claims) {
    nodes.push({ id: claim.claimId, type: "claim" });
    if ((claim.citationId?.trim() ?? "").length > 0) {
      nodes.push({ id: claim.citationId!, type: "citation" });
      edges.push({ from: claim.claimId, to: claim.citationId!, relation: "cites" });
    }
    if ((claim.sourceId?.trim() ?? "").length > 0) {
      nodes.push({ id: claim.sourceId!, type: "source" });
      edges.push({ from: claim.citationId ?? claim.claimId, to: claim.sourceId!, relation: "backed_by" });
    }
  }
  return { nodes, edges };
}
