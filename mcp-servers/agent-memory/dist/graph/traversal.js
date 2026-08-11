import { inboundIds, outboundIds } from "./links.js";
export function traverseGraph(db, rootId, depth = 2, limit = 30, direction = "both") {
    const nodes = [];
    const edges = [];
    const edgeKeys = new Set();
    const visited = new Set([rootId]);
    const nodeStmt = db.raw.prepare("SELECT id, title, type, status FROM memories WHERE id = ?");
    const root = nodeStmt.get(rootId);
    if (root === undefined) {
        throw new Error(`Memory not found: ${rootId}`);
    }
    nodes.push(root);
    let frontier = [rootId];
    let currentDepth = 0;
    const safeDepth = Math.max(0, Math.min(depth, 6));
    const safeLimit = Math.max(1, Math.min(limit, 100));
    while (currentDepth < safeDepth && frontier.length > 0 && nodes.length < safeLimit) {
        const nextFrontier = [];
        for (const currId of frontier) {
            const neighbors = [];
            if (direction === "outbound" || direction === "both") {
                for (const out of outboundIds(db, currId)) {
                    neighbors.push({ id: out.id, source: currId, target: out.id, relation: out.relation });
                }
            }
            if (direction === "inbound" || direction === "both") {
                for (const inb of inboundIds(db, currId)) {
                    neighbors.push({ id: inb.id, source: inb.id, target: currId, relation: inb.relation });
                }
            }
            for (const { id: neighborId, source, target, relation } of neighbors) {
                if (nodes.length >= safeLimit && visited.has(neighborId)) {
                    const edgeKey = `${source}->${target}:${relation}`;
                    if (!edgeKeys.has(edgeKey)) {
                        edgeKeys.add(edgeKey);
                        edges.push({ source, target, relation });
                    }
                    continue;
                }
                const edgeKey = `${source}->${target}:${relation}`;
                if (!edgeKeys.has(edgeKey)) {
                    edgeKeys.add(edgeKey);
                    edges.push({ source, target, relation });
                }
                if (visited.has(neighborId))
                    continue;
                if (nodes.length >= safeLimit)
                    break;
                visited.add(neighborId);
                const row = nodeStmt.get(neighborId);
                if (row) {
                    nodes.push(row);
                    nextFrontier.push(neighborId);
                }
            }
        }
        frontier = nextFrontier;
        currentDepth++;
    }
    return { nodes, edges };
}
//# sourceMappingURL=traversal.js.map