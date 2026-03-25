// ── Team config ──────────────────────────────────────────────────────────────

export interface TeamConfig {
  name: string;
  version: string;
  createdAt: string;
  coordinator: CoordinatorConfig;
  agents: AgentEntry[];
}

export interface CoordinatorConfig {
  maxParallelTasks: number;
  conflictStrategy: 'lock' | 'boundary' | 'queue';
}

export interface AgentEntry {
  name: string;
  role: string;
  expertise: string[];
  boundaries: FileBoundary[];
  createdAt: string;
}

export interface FileBoundary {
  pattern: string;
  access: 'read' | 'write' | 'exclusive';
}

// ── Routing ──────────────────────────────────────────────────────────────────

export interface RoutingRule {
  pattern: string;
  agent: string;
  priority: number;
}

export interface RoutingConfig {
  rules: RoutingRule[];
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  description: string;
  assignee?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';
  dependencies: string[];
  result?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TaskPlan {
  id: string;
  description: string;
  subtasks: Task[];
  parallelGroups: string[][];
  createdAt: string;
}

// ── Locking ──────────────────────────────────────────────────────────────────

export interface FileLock {
  file: string;
  agent: string;
  taskId: string;
  acquiredAt: string;
  expiresAt: string;
}

// ── Memory ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  timestamp: string;
  agent: string;
  type: 'learning' | 'decision' | 'observation';
  content: string;
  context?: string;
  tags?: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

export const TEAM_DIR = '.agents-team';
export const TEAM_FILE = 'team.json';
export const ROUTING_FILE = 'routing.json';
export const AGENTS_DIR = 'agents';
export const ALUMNI_DIR = 'agents/_alumni';
export const MEMORY_DIR = 'memory';
export const SHARED_DIR = 'shared';
export const LOCKS_DIR = 'locks';
export const LOG_DIR = 'log';
export const ACTIVITY_LOG_FILE = 'activity.jsonl';

// ── Activity log ──────────────────────────────────────────────────────────────

export type ActivityEvent =
  | 'team:initialized'
  | 'agent:added'
  | 'agent:removed'
  | 'task:created'
  | 'task:assigned'
  | 'task:status-changed'
  | 'memory:updated'
  | 'lock:acquired'
  | 'lock:released';

export interface ActivityEntry {
  timestamp: string;
  event: ActivityEvent;
  agent?: string;
  taskId?: string;
  detail: string;
  meta?: Record<string, unknown>;
}
