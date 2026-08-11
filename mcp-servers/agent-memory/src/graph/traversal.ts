import type { MemoryDatabase } from "../db/database.js";
import { inboundIds, outboundIds } from "./links.js";

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type TraversalDirection = "both" | "outbound" | "inbound";

export function traverseGraph(
  db: MemoryDatabase,
  rootId: string,
  depth = 2,
  limit = 30,
  direction: TraversalDirection = "both",
): GraphResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const visited = new Set<string>([rootId]);
  const nodeStmt = db.raw.prepare(
    "SELECT id, title, type, status FROM memories WHERE id = ?",
  );

  const root = nodeStmt.get(rootId) as
    | { id: string; title: string; type: string; status: string }
    | undefined;
  if (root === undefined) {
    throw new Error(`Memory not found: ${rootId}`);
  }
  nodes.push(root);

  let frontier: string[] = [rootId];
  let currentDepth = 0;
  const safeDepth = Math.max(0, Math.min(depth, 6));
  const safeLimit = Math.max(1, Math.min(limit, 100));

  while (currentDepth < safeDepth && frontier.length > 0 && nodes.length < safeLimit) {
    const nextFrontier: string[] = [];
    for (const currId of frontier) {
      const neighbors: Array<{ id: string; source: string; target: string; relation: string }> = [];

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

        if (visited.has(neighborId)) continue;
        if (nodes.length >= safeLimit) break;

        visited.add(neighborId);
        const row = nodeStmt.get(neighborId) as
          | { id: string; title: string; type: string; status: string }
          | undefined;
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
