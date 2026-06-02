# Third-Party Notices

This repository redistributes third-party open-source dependencies through the Node.js package graph declared in `package.json` and pinned in `package-lock.json`.

## Authoritative Inventory

- Declared runtime and development dependencies: `package.json`
- Resolved dependency graph and integrity metadata: `package-lock.json`
- Container and CI supply-chain verification: `npm run audit:ci-supply-chain`
- Vulnerability baseline and disclosure workflow: [SECURITY.md](./SECURITY.md)
- Repository supply-chain governance baseline: [docs_zh/quality/supply-chain-security.md](./docs_zh/quality/supply-chain-security.md)

## Attribution Scope

- This file is the repository-level notice entry point, not a replacement for upstream license texts.
- License obligations for each dependency remain governed by the package's own published license files, metadata, and copyright notices.
- The lockfile and installed package metadata are the authoritative source for exact transitive versions included in a given build.

## Maintenance Rules

- New third-party runtime dependencies must be justified in the change that introduces them.
- Release artifacts must remain reproducible from the committed lockfile.
- If a dependency requires additional notice text beyond the standard package metadata, add that notice here in the same change that introduces the dependency.
