import { regenerateCommand } from './regenerate.js';

export async function coachCommand(): Promise<void> {
  console.log('Refreshing coordinator with latest team setup instructions...');
  await regenerateCommand({ coordinatorOnly: true });
  console.log('');
  console.log('Open Copilot Chat and select the Team agent.');
  console.log('Say "set up the team" to enter Team Setup Mode — the coordinator will scan');
  console.log('your workspace and design specific agents for your project.');
}
