import { regenerateCommand } from './regenerate.js';

export async function coachCommand(): Promise<void> {
  console.log('Refreshing Initiator and Team agents with latest team state...');
  await regenerateCommand({ coordinatorOnly: true });
  console.log('');
  console.log('Open Copilot Chat and select the Initiator agent.');
  console.log('Say "set up the team" — the Initiator will scan your workspace and design');
  console.log('specific agents for your project.');
  console.log('');
  console.log('Once agents are created, switch to the Team agent for development tasks.');
}
