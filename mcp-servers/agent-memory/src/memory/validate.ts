import { z } from "zod";
import { CONFIDENCE_LEVELS, MEMORY_STATUSES, MEMORY_TYPES } from "./types.js";

export const memoryTypeSchema = z.enum(MEMORY_TYPES);
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export const statusSchema = z.enum(MEMORY_STATUSES);

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 50_000;
export const MAX_TAGS = 50;

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Tavily API key", re: /\btvly-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Firecrawl API key", re: /\bfc-[0-9a-f]{32}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { name: "Stripe API key", re: /\b(?:sk|rk)_(?:test|live)_[0-9a-zA-Z]{10,}\b/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "Bearer token", re: /\bBearer\s+[A-Za-z0-9_\-\.]{20,}\b/i },
  { name: "API key assignment", re: /\b(?:api_key|apikey|access_token|auth_token|secret_key)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?\b/i },
  { name: "Database connection secret", re: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s:@/]+@[^\s/]+/i },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "password assignment", re: /\b(?:password|passwd|pwd|secret)\s*[=:]\s*[^\s"']{6,}\b/i },
];

export interface SecretHit {
  kind: string;
  index: number;
}

export function detectSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const { name, re } of SECRET_PATTERNS) {
    const match = re.exec(text);
    if (match && match.index !== undefined) {
      hits.push({ kind: name, index: match.index });
    }
  }
  return hits;
}

export class ContentSafetyError extends Error {}

export function assertSafeContent(text: string, field: string): void {
  const hits = detectSecrets(text);
  if (hits.length > 0) {
    const kinds = [...new Set(hits.map((h) => h.kind))].join(", ");
    throw new ContentSafetyError(
      `${field} appears to contain a secret (${kinds}). ` +
        `agent-memory refuses to store credentials or keys. ` +
        `Store a redacted description instead.`,
    );
  }
}

export function assertValidMemoryInput(input: {
  type: string;
  title: string;
  content: string;
  confidence?: string;
  status?: string;
  tags?: string[];
}): void {
  if (!z.enum(MEMORY_TYPES).safeParse(input.type).success) {
    throw new ContentSafetyError(
      `Invalid memory type '${input.type}'. Valid types: ${MEMORY_TYPES.join(", ")}`,
    );
  }
  const title = input.title.trim();
  if (title === "") throw new ContentSafetyError("Title must not be empty");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ContentSafetyError(`Title too long (max ${MAX_TITLE_LENGTH} chars)`);
  }
  if (input.content.length > MAX_CONTENT_LENGTH) {
    throw new ContentSafetyError(`Content too long (max ${MAX_CONTENT_LENGTH} chars)`);
  }
  if (input.confidence !== undefined && !z.enum(CONFIDENCE_LEVELS).safeParse(input.confidence).success) {
    throw new ContentSafetyError(
      `Invalid confidence '${input.confidence}'. Valid: ${CONFIDENCE_LEVELS.join(", ")}`,
    );
  }
  if (input.status !== undefined && !z.enum(MEMORY_STATUSES).safeParse(input.status).success) {
    throw new ContentSafetyError(
      `Invalid status '${input.status}'. Valid: ${MEMORY_STATUSES.join(", ")}`,
    );
  }
  if (input.tags !== undefined) {
    if (input.tags.length > MAX_TAGS) {
      throw new ContentSafetyError(`Too many tags (max ${MAX_TAGS})`);
    }
    for (const tag of input.tags) {
      if (typeof tag !== "string" || tag.trim() === "") {
        throw new ContentSafetyError("Tags must be non-empty strings");
      }
    }
  }
}

/**
 * Memory content is DATA, never instructions. This scanner exists so we can
 * report (and later warn) when untrusted material tries to issue instructions;
 * it never changes server behavior and never filters content out.
 */
export function detectInstructionText(text: string): boolean {
  return /(ignore (all )?(previous|prior) (instructions|rules)|system message|you are now)/i.test(text);
}
