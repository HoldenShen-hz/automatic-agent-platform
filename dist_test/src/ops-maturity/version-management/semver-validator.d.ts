/**
 * Semantic Version Validator
 *
 * Enforces semantic versioning (semver) format and provides
 * version comparison utilities.
 *
 * Architecture: §57 版本管理 - Semver Enforcement
 * @see docs_zh/architecture/00-platform-architecture.md §57
 */
import { z } from "zod";
export declare const SemverSchema: z.ZodObject<{
    major: z.ZodNumber;
    minor: z.ZodNumber;
    patch: z.ZodNumber;
    prerelease: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    buildMetadata: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    patch: number;
    major: number;
    minor: number;
    prerelease: string[];
    buildMetadata: string[];
}, {
    patch: number;
    major: number;
    minor: number;
    prerelease?: string[] | undefined;
    buildMetadata?: string[] | undefined;
}>;
export type Semver = z.infer<typeof SemverSchema>;
export interface ParsedVersion {
    version: Semver;
    raw: string;
    isValid: true;
}
export interface InvalidVersion {
    version: null;
    raw: string;
    isValid: false;
    error: string;
}
export type VersionParseResult = ParsedVersion | InvalidVersion;
export type ComparisonResult = -1 | 0 | 1;
export declare class SemverValidator {
    /**
     * Validates if a version string is valid semver.
     */
    isValid(version: string): boolean;
    /**
     * Validates and parses a semver string.
     */
    parse(version: string): VersionParseResult;
    /**
     * Compares two versions.
     */
    compare(left: string, right: string): ComparisonResult;
    /**
     * Checks if version satisfies a range.
     */
    satisfies(version: string, range: string): boolean;
    /**
     * Increments a version component.
     */
    increment(version: string, releaseType: "major" | "minor" | "patch"): string;
    /**
     * Creates a prerelease version.
     */
    makePrerelease(version: string, prereleaseId: string): string;
    /**
     * Validates a list of versions for ordering.
     */
    validateOrdering(versions: readonly string[]): {
        valid: boolean;
        errors: string[];
    };
    private comparePrerelease;
    private satisfiesCaret;
    private satisfiesTilde;
    private parseRange;
    private satisfiesConstraint;
    private compareSemver;
}
export declare function createSemverValidator(): SemverValidator;
