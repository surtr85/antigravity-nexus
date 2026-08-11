import YAML from "yaml";
import { isConfidence, isMemoryStatus, isMemoryType, } from "../memory/types.js";
export function splitFrontmatter(raw) {
    const text = raw.replace(/^\uFEFF/, "");
    if (!text.startsWith("---")) {
        return { hasFrontmatter: false, dataRaw: "", body: text };
    }
    const end = text.indexOf("\n---", 3);
    if (end === -1) {
        return { hasFrontmatter: true, dataRaw: text.slice(3), body: "" };
    }
    const dataRaw = text.slice(3, end);
    const body = text.slice(end + 4);
    return { hasFrontmatter: true, dataRaw, body };
}
export function parseFrontmatter(raw) {
    const split = splitFrontmatter(raw);
    if (!split.hasFrontmatter) {
        return { data: {}, body: split.body, ok: false, error: "No YAML frontmatter block" };
    }
    try {
        const parsed = YAML.parse(split.dataRaw);
        if (parsed === null || parsed === undefined) {
            return { data: {}, body: split.body, ok: false, error: "Empty frontmatter" };
        }
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
            return { data: {}, body: split.body, ok: false, error: "Frontmatter is not a YAML mapping" };
        }
        return { data: parsed, body: split.body, ok: true };
    }
    catch (err) {
        return {
            data: {},
            body: split.body,
            ok: false,
            error: `Malformed frontmatter: ${err.message}`,
        };
    }
}
export function toDateString(iso) {
    return iso.slice(0, 10);
}
export function today() {
    return new Date().toISOString().slice(0, 10);
}
export function memoryFromNote(data, filePath, body) {
    const id = typeof data.id === "string" ? data.id.trim() : "";
    const type = data.type;
    const status = data.status;
    const confidence = data.confidence;
    const errors = [];
    if (!/^[0-9a-f]{8}$/.test(id))
        errors.push(`invalid or missing id`);
    if (!isMemoryType(type))
        errors.push(`invalid type '${String(type)}'`);
    if (!isMemoryStatus(status))
        errors.push(`invalid status '${String(status)}'`);
    if (!isConfidence(confidence))
        errors.push(`invalid confidence '${String(confidence)}'`);
    const title = typeof data.title === "string" && data.title.trim() !== ""
        ? data.title.trim()
        : (rawTitleFromBody(body ?? "") ?? "");
    if (title === "")
        errors.push("missing title");
    const content = typeof data.content === "string" ? data.content : "";
    const project = typeof data.project === "string" && data.project.trim() !== ""
        ? data.project.trim()
        : undefined;
    const tags = Array.isArray(data.tags)
        ? data.tags.filter((t) => typeof t === "string" && t.trim() !== "")
        : [];
    const createdAt = typeof data.created === "string" && data.created !== ""
        ? data.created
        : "";
    const updatedAt = typeof data.updated === "string" && data.updated !== ""
        ? data.updated
        : createdAt;
    const source = typeof data.source === "string" && data.source !== ""
        ? data.source
        : undefined;
    const sourceSession = typeof data.source_session === "string" && data.source_session !== ""
        ? data.source_session
        : undefined;
    if (createdAt === "")
        errors.push("missing created date");
    if (errors.length > 0) {
        throw new Error(`${filePath}: frontmatter not a valid memory note (${errors.join(", ")})`);
    }
    return {
        id,
        type: type,
        title,
        content,
        project,
        confidence: confidence,
        status: status,
        createdAt,
        updatedAt,
        source,
        sourceSession,
        tags,
        related: [],
    };
}
export function serializeMemoryFile(memory, body) {
    const data = {
        id: memory.id,
        type: memory.type,
        status: memory.status,
        confidence: memory.confidence,
    };
    if (memory.project)
        data.project = memory.project;
    data.created = toDateString(memory.createdAt);
    data.updated = toDateString(memory.updatedAt);
    if (memory.source)
        data.source = memory.source;
    if (memory.sourceSession)
        data.source_session = memory.sourceSession;
    if (memory.tags.length > 0)
        data.tags = memory.tags;
    const frontmatter = YAML.stringify(data, { lineWidth: 0 }).trimEnd();
    const cleanBody = body.trim();
    return `---\n${frontmatter}\n---\n${cleanBody !== "" ? `\n${cleanBody}\n` : ""}`;
}
export function markdownNote(memory) {
    const h1 = `# ${memory.title}`;
    const body = memory.content.trim() === "" ? h1 : `${h1}\n\n${memory.content.trim()}`;
    return serializeMemoryFile(memory, body);
}
export function rawTitleFromBody(body) {
    const firstLine = body.trim().split("\n", 1)[0];
    if (firstLine && firstLine.startsWith("# ")) {
        return firstLine.slice(2).trim();
    }
    return undefined;
}
//# sourceMappingURL=frontmatter.js.map