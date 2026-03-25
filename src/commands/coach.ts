import { regenerateCommand } from './regenerate.js';

export async function coachCommand(): Promise<void> {
  console.log('Refreshing Coach and Team agents with latest team state...');
  await regenerateCommand({ coordinatorOnly: true });
  console.log('');
  console.log('Open Copilot Chat and select the Coach agent.');
  console.log('Say "set up the team" — the Coach will scan your workspace, check build output,');
  console.log('decompile package declarations, review past agent memory, and design specific agents.');
  console.log('');
  console.log('Once agents are created, switch to the Team agent for development tasks.');
}
