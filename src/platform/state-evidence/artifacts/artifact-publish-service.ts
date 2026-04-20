import { nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import type { ArtifactBundleExtended } from "./artifact-model.js";
import { ArtifactPublishLedger, type ArtifactPublishLedgerEntry } from "./artifact-publish-ledger.js";

export type ArtifactPublishTarget = "git" | "notion" | "cdn";

export interface ArtifactPublishResult {
  bundle: ArtifactBundleExtended;
  target: ArtifactPublishTarget;
  destination: string;
  publishedArtifactIds: string[];
  metadata: Record<string, unknown>;
}

export class ArtifactPublishService {
  public constructor(
    private readonly ledger: ArtifactPublishLedger = new ArtifactPublishLedger(),
  ) {}

  public publish(bundle: ArtifactBundleExtended): ArtifactBundleExtended {
    return this.publishWithMetadata(bundle).bundle;
  }

  public publishWithMetadata(bundle: ArtifactBundleExtended): ArtifactPublishResult {
    const published = this.createPublishedBundle(bundle);
    const destination = `bundle://${published.domainId}/${published.bundleId}`;
    this.ledger.record(published, { target: "git", destination });
    return {
      bundle: published,
      target: "git",
      destination,
      publishedArtifactIds: published.artifacts.map((artifact) => artifact.artifactId),
      metadata: {},
    };
  }

  public publishToGit(
    bundle: ArtifactBundleExtended,
    input: {
      repository: string;
      branch?: string;
      commitMessage?: string;
    },
  ): ArtifactPublishResult {
    const published = this.createPublishedBundle(bundle);
    const destination = `${input.repository}#${input.branch ?? "main"}`;
    this.ledger.record(published, { target: "git", destination });
    return {
      bundle: published,
      target: "git",
      destination,
      publishedArtifactIds: published.artifacts.map((artifact) => artifact.artifactId),
      metadata: {
        commitMessage: input.commitMessage ?? `Publish artifact bundle ${bundle.bundleId}`,
        files: published.artifacts.map((artifact) => artifact.path),
      },
    };
  }

  public publishToNotion(
    bundle: ArtifactBundleExtended,
    input: {
      parentPageId: string;
      pageTitle?: string;
    },
  ): ArtifactPublishResult {
    const published = this.createPublishedBundle(bundle);
    const destination = `notion://${input.parentPageId}/${bundle.bundleId}`;
    this.ledger.record(published, { target: "notion", destination });
    return {
      bundle: published,
      target: "notion",
      destination,
      publishedArtifactIds: published.artifacts.map((artifact) => artifact.artifactId),
      metadata: {
        pageTitle: input.pageTitle ?? `Artifact Bundle ${bundle.bundleId}`,
        sections: published.finalDeliverables,
      },
    };
  }

  public publishToCdn(
    bundle: ArtifactBundleExtended,
    input: {
      baseUrl: string;
      pathPrefix?: string;
    },
  ): ArtifactPublishResult {
    const published = this.createPublishedBundle(bundle);
    const normalizedBaseUrl = input.baseUrl.replace(/\/+$/, "");
    const normalizedPathPrefix = input.pathPrefix?.replace(/^\/+|\/+$/g, "") ?? "artifacts";
    const destination = `${normalizedBaseUrl}/${normalizedPathPrefix}/${bundle.bundleId}`;
    this.ledger.record(published, { target: "cdn", destination });
    return {
      bundle: published,
      target: "cdn",
      destination,
      publishedArtifactIds: published.artifacts.map((artifact) => artifact.artifactId),
      metadata: {
        urls: published.artifacts.map((artifact) => `${destination}/${artifact.path}`),
      },
    };
  }

  public listPublishHistory(): ArtifactPublishLedgerEntry[] {
    return this.ledger.list();
  }

  private createPublishedBundle(bundle: ArtifactBundleExtended): ArtifactBundleExtended {
    if (bundle.publishStatus === "published") {
      throw new ValidationError("artifact.publish_already_published", "Artifact bundle is already published.", {
        category: "validation",
        source: "internal",
        details: { bundleId: bundle.bundleId },
      });
    }
    if (bundle.publishStatus === "recalled") {
      throw new ValidationError("artifact.publish_recalled_bundle", "Recalled artifact bundles cannot be republished directly.", {
        category: "validation",
        source: "internal",
        details: { bundleId: bundle.bundleId },
      });
    }
    const published: ArtifactBundleExtended = {
      ...bundle,
      publishStatus: "published",
      publishedAt: nowIso(),
    };
    return published;
  }
}
