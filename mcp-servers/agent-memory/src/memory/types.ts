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
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = [
  "active",
  "superseded",
  "deprecated",
  "unresolved",
  "verified",
  "uncertain",
] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const MEMORY_DIRS: Record<MemoryType, string> = {
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

export const EVOLUTION_CHAIN: MemoryType[] = [
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
] as const;

export interface Memory {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  project?: string;
  confidence: Confidence;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  source?: string;
  sourceSession?: string;
  tags: string[];
  related: string[];
}

export const ID_PATTERN = /^[0-9a-f]{8}$/;

export function isMemoryType(v: unknown): v is MemoryType {
  return typeof v === "string" && (MEMORY_TYPES as readonly string[]).includes(v);
}

export function isMemoryStatus(v: unknown): v is MemoryStatus {
  return typeof v === "string" && (MEMORY_STATUSES as readonly string[]).includes(v);
}

export function isConfidence(v: unknown): v is Confidence {
  return typeof v === "string" && (CONFIDENCE_LEVELS as readonly string[]).includes(v);
}
