import { randomUUID } from 'node:crypto';
import type { Task, TaskPlan } from './types.js';

// ── Task creation ────────────────────────────────────────────────────────────

export function createTask(
  description: string,
  assignee?: string,
  dependencies: string[] = [],
): Task {
  return {
    id: randomUUID().slice(0, 8),
    description,
    assignee,
    status: 'pending',
    dependencies,
    createdAt: new Date().toISOString(),
  };
}

// ── Dependency graph ─────────────────────────────────────────────────────────

/**
 * Build an adjacency list: taskId → list of IDs that depend on it
 */
export function buildDependencyGraph(
  tasks: Task[],
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const t of tasks) {
    if (!graph.has(t.id)) graph.set(t.id, []);
    for (const dep of t.dependencies) {
      const dependents = graph.get(dep) ?? [];
      dependents.push(t.id);
      graph.set(dep, dependents);
    }
  }

  return graph;
}

// ── Cycle detection (DFS) ────────────────────────────────────────────────────

export function detectCycles(tasks: Task[]): boolean {
  const graph = new Map<string, string[]>();
  for (const t of tasks) {
    graph.set(t.id, [...t.dependencies]);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    for (const dep of graph.get(id) ?? []) {
      if (dfs(dep)) return true;
    }
    inStack.delete(id);
    return false;
  }

  for (const t of tasks) {
    if (dfs(t.id)) return true;
  }
  return false;
}

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

export function topologicalSort(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, t.dependencies.length);
    if (!adjList.has(t.id)) adjList.set(t.id, []);
    for (const dep of t.dependencies) {
      const list = adjList.get(dep) ?? [];
      list.push(t.id);
      adjList.set(dep, list);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: Task[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const task = taskMap.get(id);
    if (task) sorted.push(task);

    for (const dependent of adjList.get(id) ?? []) {
      const deg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) queue.push(dependent);
    }
  }

  return sorted;
}

// ── Parallel groups ──────────────────────────────────────────────────────────

/**
 * Given tasks in topological order, compute groups of tasks that can execute
 * in parallel (same "level" in the DAG — all dependencies already resolved).
 */
export function computeParallelGroups(tasks: Task[]): string[][] {
  if (tasks.length === 0) return [];

  const taskIds = new Set(tasks.map((t) => t.id));
  const level = new Map<string, number>();

  for (const t of tasks) {
    // Level = 1 + max level of dependencies
    let maxDepLevel = -1;
    for (const dep of t.dependencies) {
      if (taskIds.has(dep)) {
        maxDepLevel = Math.max(maxDepLevel, level.get(dep) ?? 0);
      }
    }
    level.set(t.id, maxDepLevel + 1);
  }

  // Group by level
  const groups = new Map<number, string[]>();
  for (const [id, lvl] of level) {
    const group = groups.get(lvl) ?? [];
    group.push(id);
    groups.set(lvl, group);
  }

  const sortedLevels = [...groups.keys()].sort((a, b) => a - b);
  return sortedLevels.map((lvl) => groups.get(lvl)!);
}

// ── Create a task plan ───────────────────────────────────────────────────────

export function createTaskPlan(
  description: string,
  subtasks: Task[],
): TaskPlan {
  if (detectCycles(subtasks)) {
    throw new Error(
      'Task plan contains circular dependencies. Re-check task dependencies.',
    );
  }

  const sorted = topologicalSort(subtasks);
  const parallelGroups = computeParallelGroups(sorted);

  return {
    id: randomUUID().slice(0, 8),
    description,
    subtasks: sorted,
    parallelGroups,
    createdAt: new Date().toISOString(),
  };
}
