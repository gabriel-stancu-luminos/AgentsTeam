import { listTemplates } from '../core/agent.js';

export async function listTemplatesCommand(): Promise<void> {
  const templates = await listTemplates();

  if (templates.length === 0) {
    console.log('No templates found.');
    console.log('Add .md files under src/agent-templates/{category}/ in the ll-agents-team package.');
    return;
  }

  const categories = [...new Set(templates.map((t) => t.category))];

  console.log('\n📋 Available agent templates:\n');
  for (const cat of categories) {
    console.log(`  ${cat}/`);
    for (const t of templates.filter((t) => t.category === cat)) {
      console.log(`    ${t.name}`);
      console.log(`      ll-agents-team add --name "MyAgent" --template ${t.key}`);
    }
  }
  console.log('');
}
