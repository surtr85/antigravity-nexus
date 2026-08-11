import { allMemories, memoryById } from "../db/indexer.js";
import { titleSimilarity, contentSimilarity, wordContainment } from "./dedup.js";
import { detectContradictions } from "./dedup.js";
import { createFileExclusive, generateId, memoryFilePath } from "../vault/writer.js";
import { markdownNote } from "../vault/frontmatter.js";
import { upsertMemoryIndex } from "../db/indexer.js";
import { addLinks, replaceLinks } from "../graph/links.js";
import { logger } from "../config.js";
export async function consolidateMemory(ctx, options = {}) {
    const memories = await gatherCandidates(ctx, options);
    const duplicates = [];
    const mergeCandidates = [];
    const seen = new Set();
    for (let i = 0; i < memories.length; i++) {
        const a = memories[i];
        for (let j = i + 1; j < memories.length; j++) {
            const b = memories[j];
            if (a.id === b.id || a.project !== b.project)
                continue;
            const titleSim = titleSimilarity(a.title, b.title);
            const contentSim = contentSimilarityForConsolidate(a.content, b.content);
            if (titleSim >= 0.9 && (contentSim >= 0.55 || wordContainment(a.content, b.content) >= 0.7)) {
                const key = sortedKey(a.id, b.id);
                if (!seen.has(key)) {
                    seen.add(key);
                    duplicates.push({
                        ids: [a.id, b.id],
                        similarity: Math.round((titleSim + contentSim) / 2 * 100) / 100,
                        reason: "Duplicate: near-identical title and content",
                    });
                }
            }
            else if (titleSim >= 0.65 && (contentSim >= 0.35 || wordContainment(a.content, b.content) >= 0.6)) {
                const key = sortedKey(a.id, b.id);
                if (!seen.has(key)) {
                    seen.add(key);
                    mergeCandidates.push({
                        ids: [a.id, b.id],
                        similarity: Math.round((titleSim + contentSim) / 2 * 100) / 100,
                        reason: "Same concept; complementary details could be merged",
                    });
                }
            }
        }
    }
    const contradictions = detectContradictions(memories).map((c) => ({
        a: c.a.id,
        b: c.b.id,
        similarity: c.similarity,
    }));
    const repeatedExperiences = groupExperiences(memories, 3, 0.55, "Repeated experiences share the same theme");
    const patterns = groupExperiences(memories, 2, 0.65, "Experience cluster may generalize into a pattern");
    const skillCandidates = groupByType(memories, ["lesson", "pattern"], 3, 0.6, "Lessons/patterns cluster may become a skill");
    const stale = memories
        .filter((m) => m.status === "deprecated" || (m.status === "unresolved" && isStale(m.updatedAt)))
        .map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        updatedAt: m.updatedAt,
    }));
    const plan = {
        duplicates,
        mergeCandidates,
        contradictions,
        repeatedExperiences,
        patterns,
        skillCandidates,
        stale,
        candidatesAnalyzed: memories.length,
    };
    if (options.dryRun !== false) {
        return plan;
    }
    applyNonDestructive(ctx, plan);
    return plan;
}
function contentSimilarityForConsolidate(a, b) {
    if (a.trim() === "" || b.trim() === "")
        return 0;
    return contentSimilarity(a, b);
}
function isStale(iso) {
    const age = (Date.now() - Date.parse(iso)) / 86_400_000;
    return !Number.isNaN(age) && age > 30;
}
function sortedKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function unionFind(ids, minSim, simFn, memories) {
    const parent = new Map();
    const find = (x) => {
        const p = parent.get(x) ?? x;
        if (p !== x) {
            parent.set(x, find(p));
        }
        return parent.get(x) ?? x;
    };
    for (const id of ids)
        parent.set(id, id);
    for (let i = 0; i < ids.length; i++) {
        const idA = ids[i];
        if (idA === undefined)
            continue;
        for (let j = i + 1; j < ids.length; j++) {
            const idB = ids[j];
            if (idB === undefined)
                continue;
            const a = memories.get(idA);
            const b = memories.get(idB);
            if (a && b && simFn(a, b) >= minSim) {
                parent.set(find(idA), find(idB));
            }
        }
    }
    const groups = new Map();
    for (const id of ids) {
        const root = find(id);
        const list = groups.get(root) ?? [];
        list.push(id);
        groups.set(root, list);
    }
    return [...groups.values()].filter((g) => g.length > 1);
}
function groupExperiences(memories, minSize, minSim, reason) {
    const experiences = memories.filter((m) => m.type === "experience" || m.type === "session");
    const map = new Map(experiences.map((m) => [m.id, m]));
    const groups = unionFind(experiences.map((m) => m.id), minSim, (a, b) => Math.max(titleSimilarity(a.title, b.title), contentSimilarity(a.content, b.content)), map);
    return groups
        .filter((g) => g.length >= minSize)
        .map((ids) => ({ ids, suggestedTitle: suggestedTitleFrom(map, ids) }))
        .filter((g) => g.ids.length > 0);
}
function groupByType(memories, types, minSize, minSim, reason) {
    const subset = memories.filter((m) => types.includes(m.type));
    const map = new Map(subset.map((m) => [m.id, m]));
    const groups = unionFind(subset.map((m) => m.id), minSim, (a, b) => Math.max(titleSimilarity(a.title, b.title), contentSimilarity(a.content, b.content)), map);
    return groups
        .filter((g) => g.length >= minSize)
        .map((ids) => ({ ids, suggestedTitle: suggestedTitleFrom(map, ids) }));
}
function suggestedTitleFrom(map, ids) {
    const titles = ids.map((id) => map.get(id)?.title).filter((t) => Boolean(t));
    if (titles.length === 0)
        return "Untitled cluster";
    const common = commonWords(titles);
    if (common.length > 0)
        return common.slice(0, 4).join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
    return titles[0];
}
function commonWords(titles) {
    const counts = new Map();
    for (const t of titles) {
        const words = new Set();
        for (const w of t.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
            if (w.length >= 3 && !STOPWORDS.has(w))
                words.add(w);
        }
        for (const w of words)
            counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const result = [...counts.entries()]
        .filter(([, c]) => c >= Math.ceil(titles.length / 2))
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w);
    return result;
}
const STOPWORDS = new Set([
    "the", "and", "for", "with", "that", "this", "from", "was", "were", "have",
    "has", "had", "our", "you", "your", "how", "why", "what", "when", "where",
]);
async function gatherCandidates(ctx, options) {
    if (options.ids && options.ids.length > 0) {
        const out = [];
        for (const id of options.ids) {
            const m = memoryById(ctx.db, id);
            if (m)
                out.push(m);
        }
        return out;
    }
    if (options.query && options.query.trim() !== "") {
        const results = await ctx.search.search(options.query, { project: options.project, limit: 100 });
        const out = [];
        for (const r of results) {
            const m = memoryById(ctx.db, r.id);
            if (m)
                out.push(m);
        }
        return out;
    }
    if (options.project) {
        return allMemories(ctx.db).filter((m) => m.project === options.project);
    }
    return allMemories(ctx.db).slice(0, 200);
}
function applyNonDestructive(ctx, plan) {
    const linkPairs = [];
    for (const group of [...plan.duplicates, ...plan.mergeCandidates]) {
        for (const a of group.ids) {
            for (const b of group.ids) {
                if (a !== b)
                    linkPairs.push([a, b]);
            }
        }
    }
    for (const group of [...plan.patterns, ...plan.skillCandidates, ...plan.repeatedExperiences]) {
        createCandidateMemory(ctx, group.ids, group.suggestedTitle);
    }
    for (const [a, b] of linkPairs) {
        replaceLinks(ctx.db, a, [b], "related");
    }
}
function createCandidateMemory(ctx, sourceIds, suggestedTitle) {
    const sources = sourceIds.map((id) => memoryById(ctx.db, id)).filter((m) => m !== null);
    if (sources.length === 0)
        return;
    const type = "pattern";
    const now = new Date().toISOString();
    const id = generateId();
    const derived = sources
        .map((m) => `- [[${m.title}]]`)
        .join("\n");
    const memory = {
        id,
        type,
        title: suggestedTitle,
        content: `Candidate derived from ${sources.length} related memories. Review and refine before use.\n\n## Derived from\n\n${derived}`,
        confidence: "low",
        status: "uncertain",
        createdAt: now,
        updatedAt: now,
        source: "consolidate",
        tags: [...new Set(sources.flatMap((s) => s.tags ?? []))].slice(0, 10),
        related: sourceIds,
    };
    const filePath = memoryFilePath(ctx.root, type, suggestedTitle, id);
    createFileExclusive(filePath, markdownNote(memory));
    upsertMemoryIndex(ctx.db, memory, memory.content, [], filePath);
    addLinks(ctx.db, id, sourceIds, "derived_from");
    logger.info(`consolidate: candidate memory ${id} (${suggestedTitle})`);
}
//# sourceMappingURL=consolidate.js.map