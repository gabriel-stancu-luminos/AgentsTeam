// ── Public API ────────────────────────────────────────────────────────────────

// Types
export type {
  TeamConfig,
  CoordinatorConfig,
  AgentEntry,
  FileBoundary,
  RoutingRule,
  RoutingConfig,
  Task,
  TaskPlan,
  FileLock,
  MemoryEntry,
} from './core/types.js';

export { TEAM_DIR, TEAM_FILE, ROUTING_FILE } from './core/types.js';

// Team management
export {
  loadTeam,
  saveTeam,
  teamExists,
  scaffoldTeamDir,
  createDefaultTeam,
  findAgent,
  addAgentToTeam,
  removeAgentFromTeam,
  getTeamDir,
  getGithubAgentsDir,
  getCoordinatorPath,
  getInitiatorPath,
} from './core/team.js';

// Agent management
export {
  createAgentEntry,
  generateCharter,
  generateAgentPrompt,
  getCharterPath,
  writeAgentFiles,
  archiveAgent,
  readCharter,
} from './core/agent.js';

// Coordinator
export {
  checkBoundaryConflict,
  canRunParallel,
  computeConflictPairs,
  generateCoordinatorPrompt,
  generateInitiatorPrompt,
  generateCopilotInstructions,
} from './core/coordinator.js';

// Router
export {
  loadRouting,
  saveRouting,
  addRoutingRule,
  removeRoutingRules,
  matchAgent,
  generateDefaultRules,
} from './core/router.js';

// Tasks
export {
  createTask,
  buildDependencyGraph,
  detectCycles,
  topologicalSort,
  computeParallelGroups,
  createTaskPlan,
} from './core/task.js';

// Memory
export {
  getAgentMemory,
  appendAgentMemory,
  getSharedLearnings,
  appendSharedLearning,
  getDecisions,
  appendDecision,
  initSharedMemory,
} from './core/memory.js';

// Lock manager
export {
  acquireLock,
  releaseLock,
  releaseAllLocks,
  getLocks,
  isLocked,
  cleanExpiredLocks,
} from './core/lock-manager.js';

// Activity log
export type { ActivityEntry, ActivityEvent } from './core/types.js';
export { ACTIVITY_LOG_FILE } from './core/types.js';
export { appendActivity, readActivityLog } from './core/activity-log.js';
