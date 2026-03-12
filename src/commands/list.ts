import { loadTeam, teamExists } from '../core/team.js';
import { checkBoundaryConflict } from '../core/coordinator.js';

export async function listCommand(): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  const team = await loadTeam();

  console.log(`\n📋 Team: ${team.name}`);
  console.log(`   Coordinator: max ${team.coordinator.maxParallelTasks} parallel tasks, ${team.coordinator.conflictStrategy} conflict strategy`);
  console.log('');

  if (team.agents.length === 0) {
    console.log('   No agents yet. Use "ll-agents-team add" to add agents.');
    return;
  }

  for (const agent of team.agents) {
    console.log(`   🤖 ${agent.name} — ${agent.role}`);
    console.log(`      Expertise: ${agent.expertise.join(', ')}`);
    if (agent.boundaries.length > 0) {
      console.log(
        `      Boundaries: ${agent.boundaries.map((b) => `${b.pattern} (${b.access})`).join(', ')}`,
      );
    }
    console.log('');
  }

  // Show conflict summary
  const agents = team.agents;
  const conflicts: string[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const overlap = checkBoundaryConflict(agents[i], agents[j]);
      if (overlap.length > 0) {
        conflicts.push(
          `   ⚠  ${agents[i].name} ↔ ${agents[j].name}: ${overlap.join(', ')}`,
        );
      }
    }
  }

  if (conflicts.length > 0) {
    console.log('   Boundary Conflicts (agents that cannot run in parallel):');
    conflicts.forEach((c) => console.log(c));
  } else if (agents.length > 1) {
    console.log('   ✓ No boundary conflicts — all agents can run in parallel');
  }
}
