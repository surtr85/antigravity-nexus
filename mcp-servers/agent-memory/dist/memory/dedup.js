import { normalizeTitle } from "../graph/links.js";
export function wordSet(text) {
    const words = new Set();
    for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
        // Keep ≥2-char tokens and any all-digit tokens ("port 80" vs "port 81"
        // must not collapse into the same word set).
        if (w.length >= 2 || (w.length === 1 && /^\d$/.test(w)))
            words.add(w);
    }
    return words;
}
export function diceSimilarity(a, b) {
    const wa = wordSet(a);
    const wb = wordSet(b);
    if (wa.size === 0 || wb.size === 0)
        return 0;
    let intersection = 0;
    for (const w of wa)
        if (wb.has(w))
            intersection++;
    return (2 * intersection) / (wa.size + wb.size);
}
export function titleSimilarity(a, b) {
    if (normalizeTitle(a) === normalizeTitle(b))
        return 1;
    return diceSimilarity(a, b);
}
export function contentSimilarity(a, b) {
    if (a.trim() === "" || b.trim() === "")
        return 0;
    const na = a.trim().toLowerCase();
    const nb = b.trim().toLowerCase();
    if (na === nb)
        return 1;
    return diceSimilarity(a, b);
}
/**
 * Fraction of the smaller text's content words that also appear in the larger.
 * Detects "same information, reworded/shorter" even when word-set dice is low.
 */
export function wordContainment(a, b) {
    const wa = wordSet(a);
    const wb = wordSet(b);
    if (wa.size === 0 || wb.size === 0)
        return 0;
    const [smaller, larger] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
    let overlap = 0;
    for (const w of smaller)
        if (larger.has(w))
            overlap++;
    return overlap / smaller.size;
}
/**
 * Pick the strongest existing memory this new input overlaps with.
 * Deprecated/superseded memories are never revived: they are excluded so a
 * fresh memory can be created instead of silently resurrecting old ones.
 */
export function findBestCandidate(candidates, input) {
    let best = null;
    for (const memory of candidates) {
        if (memory.status === "deprecated" || memory.status === "superseded")
            continue;
        const titleSim = titleSimilarity(memory.title, input.title);
        const contentSim = contentSimilarity(memory.content, input.content);
        if (best === null ||
            titleSim > best.titleSim ||
            (titleSim === best.titleSim && contentSim > best.contentSim)) {
            best = { memory, titleSim, contentSim };
        }
    }
    return best;
}
export function decideDedup(candidate, input) {
    const { titleSim, contentSim, memory } = candidate;
    const containment = wordContainment(memory.content, input.content);
    if (titleSim >= 0.95) {
        if (contentSim >= 0.6 || containment >= 0.7) {
            if (contentSim >= 1.0) {
                return { action: "unchanged", reason: "Exact duplicate: identical title and content already stored" };
            }
            return {
                action: "updated",
                reason: `Duplicate found (title ${titleSim.toFixed(2)}, content similarity ${contentSim.toFixed(2)}). Updating existing memory with new information.`,
            };
        }
        return {
            action: "conflict",
            reason: `Same title but very different content (content similarity ${contentSim.toFixed(2)}). ` +
                `This may be a contradiction. Not writing automatically.`,
        };
    }
    if (titleSim >= 0.7) {
        if (contentSim >= 0.45 || containment >= 0.6) {
            return {
                action: "updated",
                reason: `Same concept (title similarity ${titleSim.toFixed(2)}). Merging new information into existing memory.`,
            };
        }
        if (input.project !== undefined && memory.project === input.project && memory.type === input.type) {
            return {
                action: "conflict",
                reason: `Same concept in same project/type but divergent content (title ${titleSim.toFixed(2)}, content ${contentSim.toFixed(2)}). ` +
                    `Possible contradiction. Review before storing.`,
            };
        }
        return { action: "created", reason: "Related concept but different context or claim; storing new memory." };
    }
    return { action: "created", reason: "No strong duplicate found." };
}
export function mergeContent(existing, fresh) {
    const ex = existing.trim();
    const fr = fresh.trim();
    if (fr === "")
        return ex;
    if (ex === "")
        return fr;
    const exWords = wordSet(ex);
    const frWords = wordSet(fr);
    let overlap = 0;
    for (const w of frWords)
        if (exWords.has(w))
            overlap++;
    const frRatio = frWords.size === 0 ? 0 : overlap / frWords.size;
    if (frRatio >= 0.8)
        return ex;
    if (fr.length > ex.length)
        return fr;
    return ex;
}
/**
 * Flags potential contradictions for review (never auto-resolved). Two
 * memories conflict when they share a strong title, live in the same project,
 * and carry notably different content. Shared framing words make raw dice
 * high, so the bar here is stricter on content divergence than on title.
 */
export function detectContradictions(memories) {
    const pairs = [];
    for (let i = 0; i < memories.length; i++) {
        const a = memories[i];
        if (!a || a.status === "deprecated" || a.status === "superseded")
            continue;
        for (let j = i + 1; j < memories.length; j++) {
            const b = memories[j];
            if (!b || b.status === "deprecated" || b.status === "superseded")
                continue;
            if (a.project !== b.project)
                continue;
            if (a.content.trim().length < 20 || b.content.trim().length < 20)
                continue;
            const titleSim = titleSimilarity(a.title, b.title);
            if (titleSim < 0.6)
                continue;
            const contentSim = contentSimilarity(a.content, b.content);
            if (contentSim >= 0.75)
                continue;
            if (a.id === b.id)
                continue;
            pairs.push({
                a,
                b,
                similarity: Math.round((titleSim + (1 - contentSim)) / 2 * 100) / 100,
            });
        }
    }
    return pairs;
}
//# sourceMappingURL=dedup.js.map