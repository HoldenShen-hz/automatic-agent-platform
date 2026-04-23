export const STRIDE_CATEGORIES = [
    "SPOOFING",
    "TAMPERING",
    "REPUDIATION",
    "INFORMATION_DISCLOSURE",
    "DENIAL_OF_SERVICE",
    "ELEVATION_OF_PRIVILEGE",
];
export function validateThreatMatrix(matrix) {
    const present = new Set(matrix.entries.map((entry) => entry.category));
    const missingCategories = STRIDE_CATEGORIES.filter((category) => !present.has(category));
    return {
        valid: missingCategories.length === 0,
        missingCategories,
    };
}
export function listThreatsByCategory(matrix, category) {
    return matrix.entries.filter((entry) => entry.category === category);
}
//# sourceMappingURL=stride-framework.js.map