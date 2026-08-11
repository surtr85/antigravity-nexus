export const MEMORY_TYPES = [
    "fact",
    "preference",
    "decision",
    "experience",
    "lesson",
    "pattern",
    "skill",
    "problem",
    "project",
    "session",
];
export const MEMORY_STATUSES = [
    "active",
    "superseded",
    "deprecated",
    "unresolved",
    "verified",
    "uncertain",
];
export const CONFIDENCE_LEVELS = ["high", "medium", "low"];
export const MEMORY_DIRS = {
    fact: "Facts",
    preference: "Preferences",
    decision: "Decisions",
    experience: "Experiences",
    lesson: "Lessons",
    pattern: "Patterns",
    skill: "Skills",
    problem: "Problems",
    project: "Projects",
    session: "Sessions",
};
export const MEMORY_DIR_NAMES = Object.values(MEMORY_DIRS);
export const EVOLUTION_CHAIN = [
    "experience",
    "lesson",
    "pattern",
    "skill",
];
export const RELATIONS = [
    "related",
    "derived_from",
    "contradicts",
    "supersedes",
    "caused_by",
    "solves",
    "part_of",
];
export const ID_PATTERN = /^[0-9a-f]{8}$/;
export function isMemoryType(v) {
    return typeof v === "string" && MEMORY_TYPES.includes(v);
}
export function isMemoryStatus(v) {
    return typeof v === "string" && MEMORY_STATUSES.includes(v);
}
export function isConfidence(v) {
    return typeof v === "string" && CONFIDENCE_LEVELS.includes(v);
}
//# sourceMappingURL=types.js.map