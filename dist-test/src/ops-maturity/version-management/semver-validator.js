/**
 * Semantic Version Validator
 *
 * Enforces semantic versioning (semver) format and provides
 * version comparison utilities.
 *
 * Architecture: §57 Version Management - Semver Enforcement
 * @see docs_en/architecture/00-platform-architecture.md §57
 */
import { z } from "zod";
// ─────────────────────────────────────────────────────────────────────────────
// Semver Types
// ─────────────────────────────────────────────────────────────────────────────
export const SemverSchema = z.object({
    major: z.number().int().nonnegative(),
    minor: z.number().int().nonnegative(),
    patch: z.number().int().nonnegative(),
    prerelease: z.array(z.string()).default([]),
    buildMetadata: z.array(z.string()).default([]),
});
// ─────────────────────────────────────────────────────────────────────────────
// Semver Regex Pattern
// ─────────────────────────────────────────────────────────────────────────────
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
// ─────────────────────────────────────────────────────────────────────────────
// Semver Validator
// ─────────────────────────────────────────────────────────────────────────────
export class SemverValidator {
    /**
     * Validates if a version string is valid semver.
     */
    isValid(version) {
        return SEMVER_REGEX.test(version);
    }
    /**
     * Validates and parses a semver string.
     */
    parse(version) {
        if (!version || typeof version !== "string") {
            return {
                version: null,
                raw: String(version),
                isValid: false,
                error: "Version must be a non-empty string",
            };
        }
        if (!SEMVER_REGEX.test(version)) {
            return {
                version: null,
                raw: version,
                isValid: false,
                error: `Invalid semver format: "${version}". Expected format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`,
            };
        }
        const mainAndPrerelease = version.split("+")[0];
        const mainParts = mainAndPrerelease.split("-")[0].split(".");
        const prerelease = mainAndPrerelease.includes("-") ? mainAndPrerelease.split("-")[1].split(".").filter(Boolean) ?? [] : [];
        const buildMetadata = version.includes("+") ? version.split("+")[1].split(".").filter(Boolean) ?? [] : [];
        return {
            version: {
                major: parseInt(mainParts[0], 10),
                minor: parseInt(mainParts[1], 10),
                patch: parseInt(mainParts[2], 10),
                prerelease,
                buildMetadata,
            },
            raw: version,
            isValid: true,
        };
    }
    /**
     * Compares two versions.
     */
    compare(left, right) {
        const leftParsed = this.parse(left);
        const rightParsed = this.parse(right);
        if (!leftParsed.isValid || !rightParsed.isValid) {
            throw new Error("Cannot compare invalid versions");
        }
        const { version: v1 } = leftParsed;
        const { version: v2 } = rightParsed;
        if (v1.major !== v2.major)
            return v1.major < v2.major ? -1 : 1;
        if (v1.minor !== v2.minor)
            return v1.minor < v2.minor ? -1 : 1;
        if (v1.patch !== v2.patch)
            return v1.patch < v2.patch ? -1 : 1;
        if (v1.prerelease.length === 0 && v2.prerelease.length > 0)
            return 1;
        if (v1.prerelease.length > 0 && v2.prerelease.length === 0)
            return -1;
        if (v1.prerelease.length > 0 && v2.prerelease.length > 0) {
            const prereleaseCompare = this.comparePrerelease(v1.prerelease, v2.prerelease);
            if (prereleaseCompare !== 0)
                return prereleaseCompare;
        }
        return 0;
    }
    /**
     * Checks if version satisfies a range.
     */
    satisfies(version, range) {
        const parsedVersion = this.parse(version);
        if (!parsedVersion.isValid)
            return false;
        // Handle caret (^) ranges
        if (range.startsWith("^")) {
            const rangeVersion = this.parse(range.slice(1));
            if (!rangeVersion.isValid)
                return false;
            return this.satisfiesCaret(parsedVersion.version, rangeVersion.version);
        }
        // Handle tilde (~) ranges
        if (range.startsWith("~")) {
            const rangeVersion = this.parse(range.slice(1));
            if (!rangeVersion.isValid)
                return false;
            return this.satisfiesTilde(parsedVersion.version, rangeVersion.version);
        }
        // Handle compound ranges
        if (range.includes(" ")) {
            return range.split(/\s+/).every((part) => this.satisfies(version, part));
        }
        const constraints = this.parseRange(range);
        return constraints.every((constraint) => this.satisfiesConstraint(parsedVersion.version, constraint));
    }
    /**
     * Increments a version component.
     */
    increment(version, releaseType) {
        const parsed = this.parse(version);
        if (!parsed.isValid) {
            throw new Error(`Invalid version: ${version}`);
        }
        const { major, minor, patch } = parsed.version;
        let newVersion;
        switch (releaseType) {
            case "major":
                newVersion = `${major + 1}.0.0`;
                break;
            case "minor":
                newVersion = `${major}.${minor + 1}.0`;
                break;
            case "patch":
                newVersion = `${major}.${minor}.${patch + 1}`;
                break;
        }
        return newVersion;
    }
    /**
     * Creates a prerelease version.
     */
    makePrerelease(version, prereleaseId) {
        const parsed = this.parse(version);
        if (!parsed.isValid) {
            throw new Error(`Invalid version: ${version}`);
        }
        const { major, minor, patch } = parsed.version;
        return `${major}.${minor}.${patch}-${prereleaseId}`;
    }
    /**
     * Validates a list of versions for ordering.
     */
    validateOrdering(versions) {
        const errors = [];
        for (let i = 0; i < versions.length; i++) {
            const version = versions[i];
            if (!this.isValid(version)) {
                errors.push(`Invalid semver at index ${i}: "${version}"`);
            }
        }
        if (errors.length > 0) {
            return { valid: false, errors };
        }
        for (let i = 0; i < versions.length - 1; i++) {
            const compareResult = this.compare(versions[i], versions[i + 1]);
            if (compareResult < 0) {
                errors.push(`Versions not in valid order: ${versions[i]} should not be less than ${versions[i + 1]}`);
            }
        }
        return { valid: errors.length === 0, errors };
    }
    // ─── Private Methods ─────────────────────────────────────────────────────
    comparePrerelease(left, right) {
        const minLength = Math.min(left.length, right.length);
        for (let i = 0; i < minLength; i++) {
            const l = left[i];
            const r = right[i];
            const lIsNum = /^\d+$/.test(l);
            const rIsNum = /^\d+$/.test(r);
            if (lIsNum && rIsNum) {
                const lNum = parseInt(l, 10);
                const rNum = parseInt(r, 10);
                if (lNum !== rNum)
                    return lNum < rNum ? -1 : 1;
            }
            else if (lIsNum) {
                return -1;
            }
            else if (rIsNum) {
                return 1;
            }
            else {
                const cmp = l.localeCompare(r);
                if (cmp !== 0)
                    return cmp < 0 ? -1 : 1;
            }
        }
        return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
    }
    satisfiesCaret(version, constraint) {
        // ^1.2.3 means >=1.2.3 <2.0.0
        // ^0.2.3 means >=0.2.3 <0.3.0
        // ^0.0.3 means >=0.0.3 <0.0.4
        if (constraint.major === 0) {
            if (constraint.minor === 0) {
                return version.major === 0 && version.minor === 0 && version.patch >= constraint.patch;
            }
            // ^0.2.3: major must be 0, minor must be >= 2
            return version.major === 0 && version.minor >= constraint.minor && version.patch >= constraint.patch;
        }
        // ^1.0.0: major must be 1, then either minor > 0 OR (minor == 0 AND patch >= 0)
        return version.major === constraint.major && (version.minor > constraint.minor || (version.minor === constraint.minor && version.patch >= constraint.patch));
    }
    satisfiesTilde(version, constraint) {
        // ~1.2.3 means >=1.2.3 <1.3.0
        // ~1.2 means >=1.2.0 <1.3.0
        if (version.major !== constraint.major)
            return false;
        if (version.minor < constraint.minor)
            return false;
        if (version.minor === constraint.minor && version.patch < constraint.patch)
            return false;
        return true;
    }
    parseRange(range) {
        const constraints = [];
        const parts = range.split(/\s+/);
        for (const part of parts) {
            const match = part.match(/^([~^>=<]+)?(.+)$/);
            if (!match)
                continue;
            const [, operator, versionStr] = match;
            const version = versionStr ?? "";
            const parsed = this.parse(version);
            if (parsed.isValid) {
                constraints.push({ operator: operator ?? "=", version: parsed.version });
            }
        }
        return constraints;
    }
    satisfiesConstraint(version, constraint) {
        const { operator, version: constraintVersion } = constraint;
        const cmp = this.compareSemver(version, constraintVersion);
        const { major, minor, patch } = constraintVersion;
        switch (operator) {
            case ">=":
            case ">":
                return cmp >= (operator === ">" ? 1 : 0);
            case "<=":
            case "<":
                return cmp <= (operator === "<" ? -1 : 0);
            case "=":
            case "":
                return cmp === 0;
        }
        return false;
    }
    compareSemver(left, right) {
        if (left.major !== right.major)
            return left.major < right.major ? -1 : 1;
        if (left.minor !== right.minor)
            return left.minor < right.minor ? -1 : 1;
        if (left.patch !== right.patch)
            return left.patch < right.patch ? -1 : 1;
        return 0;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createSemverValidator() {
    return new SemverValidator();
}
//# sourceMappingURL=semver-validator.js.map