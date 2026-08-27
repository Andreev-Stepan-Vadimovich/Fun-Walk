import { WeightedGraph, DijkstraResult } from './graph.types';

/**
 * Алгоритм Дijkstra для поиска кратчайшего пути во взвешенном графе.
 *
 * Сложность: O((V + E) log V) при использовании бинарной кучи (здесь — sorted array).
 *
 * Инвариант: dist[v] — минимальный суммарный вес пути от source до v.
 * Релаксация ребра (u, v): dist[v] = min(dist[v], dist[u] + w(u,v))
 */
export function dijkstra(
  graph: WeightedGraph,
  sourceId: string,
  targetId: string,
): DijkstraResult | null {
  const { nodes, adjacency } = graph;

  if (!nodes.has(sourceId) || !nodes.has(targetId)) {
    return null;
  }

  const dist = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const id of nodes.keys()) {
    dist.set(id, Infinity);
    previous.set(id, null);
  }
  dist.set(sourceId, 0);

  const queue: string[] = [sourceId];

  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const u = queue.shift()!;

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetId) break;

    const edges = adjacency.get(u) ?? [];
    for (const { targetId: v, weight } of edges) {
      if (visited.has(v)) continue;

      const alt = (dist.get(u) ?? Infinity) + weight;
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt);
        previous.set(v, u);
        if (!queue.includes(v)) queue.push(v);
      }
    }
  }

  if ((dist.get(targetId) ?? Infinity) === Infinity) {
    return null;
  }

  const path: string[] = [];
  let current: string | null = targetId;
  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }

  return {
    path,
    totalWeight: dist.get(targetId) ?? 0,
    distances: dist,
    previous,
  };
}

/** Подсчёт рёбер в неориентированном графе (adjacency list) */
export function countEdges(adjacency: Map<string, { targetId: string; weight: number }[]>): number {
  let count = 0;
  for (const edges of adjacency.values()) {
    count += edges.length;
  }
  return count / 2;
}
