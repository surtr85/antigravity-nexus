import { assertSafeContent, assertValidMemoryInput, detectSecrets } from "./validate.js";
import { markdownNote } from "../vault/frontmatter.js";
import { atomicWriteFile, createFileExclusive, generateId, memoryFilePath } from "../vault/writer.js";
import { memoryDirFor } from "../vault/reader.js";
import { memoryById, upsertMemoryIndex } from "../db/indexer.js";
import { decideDedup, findBestCandidate, mergeContent, titleSimilarity, contentSimilarity } from "./dedup.js";
import { logger } from "../config.js";
export function normalizeRelated(ctx, ids) {
    if (!ids)
        return [];
    const seen = new Set();
    const out = [];
    for (const id of ids) {
        if (seen.has(id))
            continue;
        const memory = memoryById(ctx.db, id);
        if (memory && memory.status !== "deprecated" && memory.status !== "superseded") {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}
export function relatedSection(ctx, relatedIds) {
    if (relatedIds.length === 0)
        return { text: "", wikilinks: [] };
    const titleStmt = ctx.db.raw.prepare("SELECT title FROM memories WHERE id = ?");
    const lines = ["## Related", ""];
    const wikilinks = [];
    for (const id of relatedIds) {
        const row = titleStmt.get(id);
        if (row) {
            lines.push(`- [[${row.title}]]`);
            wikilinks.push({ label: row.title });
        }
    }
    return { text: lines.join("\n"), wikilinks };
}
function stripRelatedSection(content) {
    return content.replace(/\n?^## Related\n?$/gm, "").trim();
}
export async function rememberMemory(ctx, input) {
    const title = input.title.trim();
    const content = input.content.trim();
    const type = input.type;
    const confidence = input.confidence ?? "medium";
    const tags = [...new Set((input.tags ?? []).map((t) => t.trim()).filter((t) => t !== ""))];
    assertValidMemoryInput({ type, title, content, confidence, status: undefined, tags });
    assertSafeContent(title, "title");
    assertSafeContent(content, "content");
    if (tags.some((t) => detectSecrets(t).length > 0)) {
        throw new Error("Tags must not contain secrets");
    }
    const project = input.project?.trim() || undefined;
    const now = new Date().toISOString();
    const candidates = await fetchFullCandidates(ctx, await ctx.search.search(title, { limit: 10 }));
    const candidate = findBestCandidate(candidates, { title, content, project, type, related: input.related ?? [] });
    let decision;
    if (candidate) {
        decision = decideDedup(candidate, { title, content, project, type, related: input.related ?? [] });
    }
    else {
        decision = { action: "created", reason: "No strong duplicate found." };
    }
    if (decision.action !== "created" && candidate) {
        const existing = memoryById(ctx.db, candidate.memory.id);
        if (!existing) {
            throw new Error(`Memory ${candidate.memory.id} exists in search index but not in database`);
        }
        const path = ctx.db.raw.prepare("SELECT path FROM memories WHERE id = ?").get(existing.id).path;
        if (decision.action === "unchanged") {
            return { action: "unchanged", memoryId: existing.id, path, reason: decision.reason };
        }
        if (decision.action === "conflict") {
            return { action: "conflict", memoryId: existing.id, path, reason: decision.reason };
        }
        const merged = {
            ...existing,
            content: mergeContent(existing.content, content),
            tags: [...new Set([...(existing.tags ?? []), ...tags])],
            updatedAt: now,
            source: existing.source ?? input.source,
            sourceSession: existing.sourceSession ?? input.sourceSession,
        };
        const relatedIds = normalizeRelated(ctx, [...existing.related, ...(input.related ?? [])]);
        const note = relatedSection(ctx, relatedIds);
        const body = stripRelatedSection(merged.content) + (note.text ? `\n\n${note.text}` : "");
        atomicWriteFile(path, markdownNote({ ...merged, content: body }));
        upsertMemoryIndex(ctx.db, { ...merged, content: body }, body, note.wikilinks, path);
        logger.info(`remember: updated ${merged.id} (${merged.title})`);
        return { action: "updated", memoryId: merged.id, path, reason: decision.reason };
    }
    let id = generateId();
    while (memoryById(ctx.db, id)) {
        id = generateId();
    }
    const related = normalizeRelated(ctx, input.related);
    const discovered = candidates
        .filter((c) => titleSimilarity(c.title, title) >= 0.3 &&
        contentSimilarity(c.content, content) >= 0.2 &&
        !related.includes(c.id))
        .map((c) => c.id);
    const allRelated = [...related, ...discovered];
    const note = relatedSection(ctx, allRelated);
    const memory = {
        id,
        type,
        title,
        content,
        project,
        confidence,
        status: "active",
        createdAt: now,
        updatedAt: now,
        source: input.source,
        sourceSession: input.sourceSession,
        tags,
        related: allRelated,
    };
    const filePath = memoryFilePath(ctx.root, type, title, id);
    const body = content + (note.text ? `\n\n${note.text}` : "");
    createFileExclusive(filePath, markdownNote({ ...memory, content: body }));
    upsertMemoryIndex(ctx.db, { ...memory, content: body }, body, note.wikilinks, filePath);
    logger.info(`remember: created ${id} (${title}) in ${memoryDirFor(ctx.root, type)}`);
    return { action: "created", memoryId: id, path: filePath, reason: decision.reason };
}
async function fetchFullCandidates(ctx, results) {
    const out = [];
    for (const r of results) {
        const m = memoryById(ctx.db, r.id);
        if (m)
            out.push(m);
    }
    return out;
}
//# sourceMappingURL=create.js.map