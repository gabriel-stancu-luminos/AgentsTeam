import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadTeam, teamExists, getGithubAgentsDir } from '../core/team.js';
import { generateCoachPrompt } from '../core/coach.js';

export async function coachCommand(): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  const team = await loadTeam();
  const agentsDir = getGithubAgentsDir();

  await mkdir(agentsDir, { recursive: true });

  const coachPath = join(agentsDir, 'team-coach.agent.md');
  const prompt = generateCoachPrompt(team);
  await writeFile(coachPath, prompt);

  console.log('✓ Team Setup Coach created at .github/agents/team-coach.agent.md');
  console.log('');
  console.log('To use it: open GitHub Copilot Chat and select "Team Setup Coach" from the agent picker.');
  console.log('The coach will scan your workspace and help you design specific, well-bounded agents.');
}
