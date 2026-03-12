import { loadTeam, teamExists } from '../core/team.js';
import { getLocks, cleanExpiredLocks } from '../core/lock-manager.js';
import { loadRouting } from '../core/router.js';
import { getAgentMemory } from '../core/memory.js';

export async function statusCommand(): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  const team = await loadTeam();
  const routing = await loadRouting();
  const locks = await getLocks();
  const expired = await cleanExpiredLocks();

  console.log(`\n📊 Team Status: ${team.name}`);
  console.log('─'.repeat(50));

  // Team composition
  console.log(`\n👥 Agents: ${team.agents.length}`);
  for (const agent of team.agents) {
    const memory = await getAgentMemory(agent.name);
    const memoryLines = memory
      .split('\n')
      .filter((l) => l.startsWith('### '))
      .length;
    console.log(
      `   ${agent.name} (${agent.role}) — ${memoryLines} memory entries`,
    );
  }

  // Routing rules
  console.log(`\n🔀 Routing rules: ${routing.rules.length}`);
  for (const rule of routing.rules.slice(0, 5)) {
    console.log(`   /${rule.pattern}/ → ${rule.agent} (priority: ${rule.priority})`);
  }
  if (routing.rules.length > 5) {
    console.log(`   ... and ${routing.rules.length - 5} more`);
  }

  // Locks
  console.log(`\n🔒 Active locks: ${locks.length}`);
  for (const lock of locks) {
    console.log(`   ${lock.file} — held by ${lock.agent} (task: ${lock.taskId})`);
  }
  if (expired > 0) {
    console.log(`   (${expired} expired locks cleaned up)`);
  }

  // Config
  console.log(`\n⚙  Coordinator config:`);
  console.log(`   Max parallel tasks: ${team.coordinator.maxParallelTasks}`);
  console.log(`   Conflict strategy: ${team.coordinator.conflictStrategy}`);
  console.log('');
}
