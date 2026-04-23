import { nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import { ArtifactPublishLedger } from "./artifact-publish-ledger.js";
export class ArtifactPublishService {
    ledger;
    constructor(ledger = new ArtifactPublishLedger()) {
        this.ledger = ledger;
    }
    publish(bundle) {
        return this.publishWithMetadata(bundle).bundle;
    }
    publishWithMetadata(bundle) {
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
    publishToGit(bundle, input) {
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
    publishToNotion(bundle, input) {
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
    publishToCdn(bundle, input) {
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
    listPublishHistory() {
        return this.ledger.list();
    }
    createPublishedBundle(bundle) {
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
        const published = {
            ...bundle,
            publishStatus: "published",
            publishedAt: nowIso(),
        };
        return published;
    }
}
//# sourceMappingURL=artifact-publish-service.js.map