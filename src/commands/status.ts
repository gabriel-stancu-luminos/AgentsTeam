import { loadTeam, teamExists } from '../core/team.js';
import { getLocks, cleanExpiredLocks } from '../core/lock-manager.js';
import { loadRouting } from '../core/router.js';
import { getAgentMemory } from '../core/memory.js';
import { readActivityLog } from '../core/activity-log.js';
import {
  bold, dim, red, green, yellow, cyan, gray,
  clearScreen, sectionHeader, pad, shortTime, timeUntil,
} from '../core/display.js';
import type { ActivityEvent } from '../core/types.js';

interface StatusOptions {
  watch?: boolean;
}

// ── Event colour map ─────────────────────────────────────────────────────────

const EVENT_COLOR: Record<ActivityEvent, (s: string) => string> = {
  'team:initialized':  green,
  'agent:added':       green,
  'agent:removed':     red,
  'lock:acquired':     yellow,
  'lock:released':     dim,
  'memory:updated':    cyan,
  'task:created':      cyan,
  'task:assigned':     cyan,
  'task:status-changed': yellow,
};

// ── Render ───────────────────────────────────────────────────────────────────

async function render(): Promise<void> {
  const team    = await loadTeam();
  const routing = await loadRouting();
  const locks   = await getLocks();
  const expired = await cleanExpiredLocks();
  const activity = await readActivityLog(undefined, 10);

  const lines: string[] = [];

  // Header
  const strategy = team.coordinator.conflictStrategy;
  const stratColor = strategy === 'boundary' ? green : yellow;
  lines.push('');
  lines.push(
    `  ${bold(`🤖  ${team.name}`)}` +
    `  ·  ${bold(String(team.agents.length))} agent${team.agents.length !== 1 ? 's' : ''}` +
    `  ·  max ${bold(String(team.coordinator.maxParallelTasks))} parallel` +
    `  ·  ${stratColor(strategy)} strategy`,
  );

  // Agents
  lines.push(sectionHeader('AGENTS', team.agents.length));
  if (team.agents.length === 0) {
    lines.push(`    ${dim('No agents yet — run "ll-agents-team add" to get started.')}`);
  }
  for (const agent of team.agents) {
    const memory = await getAgentMemory(agent.name);
    const memCount = memory.split('\n').filter((l) => l.startsWith('### ')).length;
    const lastEvent = activity.filter((e) => e.agent === agent.name).at(-1);
    const lastStr = lastEvent
      ? `${gray(shortTime(lastEvent.timestamp))}  ${dim(lastEvent.detail.slice(0, 52))}`
      : dim('no activity recorded yet');

    lines.push(
      `\n    ${bold(pad(agent.name, 18))}${cyan(agent.role)}  ${gray(`[${memCount} memor${memCount !== 1 ? 'ies' : 'y'}]`)}`,
    );
    lines.push(`    ${dim('Expertise:')}   ${agent.expertise.join(', ')}`);
    if (agent.boundaries.length > 0) {
      const bStr = agent.boundaries
        .map((b) => `${b.pattern} ${gray(`(${b.access})`)}`)
        .join(', ');
      lines.push(`    ${dim('Boundaries:')}  ${bStr}`);
    }
    lines.push(`    ${dim('Last:')}        ${lastStr}`);
  }

  // Active locks
  lines.push(sectionHeader('ACTIVE LOCKS', locks.length));
  if (locks.length === 0) {
    lines.push(`    ${dim('No active locks.')}`);
  }
  for (const lock of locks) {
    lines.push(
      `    ${yellow('⚑')}  ${bold(lock.file)}  ${dim('→')}  ${lock.agent}` +
      `  ${gray(`(task: ${lock.taskId})`)}  ·  ${timeUntil(lock.expiresAt)}`,
    );
  }
  if (expired > 0) {
    lines.push(`    ${dim(`(${expired} expired lock${expired > 1 ? 's' : ''} cleaned up)`)}`);
  }

  // Recent activity
  lines.push(sectionHeader('RECENT ACTIVITY', activity.length));
  if (activity.length === 0) {
    lines.push(`    ${dim('No activity recorded yet.')}`);
  }
  for (const entry of [...activity].reverse()) {
    const colorFn = EVENT_COLOR[entry.event] ?? dim;
    const agentStr = pad(entry.agent ?? '—', 16);
    lines.push(
      `    ${gray(shortTime(entry.timestamp))}  ${colorFn(pad(entry.event, 24))}` +
      `  ${dim(agentStr)}  ${dim(entry.detail.slice(0, 48))}`,
    );
  }

  // Routing rules
  lines.push(sectionHeader('ROUTING RULES', routing.rules.length));
  if (routing.rules.length === 0) {
    lines.push(`    ${dim('No routing rules.')}`);
  }
  for (const rule of routing.rules.slice(0, 8)) {
    lines.push(
      `    ${cyan(`/${rule.pattern}/`)}  ${dim('→')}  ${bold(rule.agent)}  ${gray(`(priority: ${rule.priority})`)}`,
    );
  }
  if (routing.rules.length > 8) {
    lines.push(`    ${dim(`… and ${routing.rules.length - 8} more`)}`);
  }

  lines.push('');
  lines.push(`  ${gray(`Updated: ${shortTime(new Date().toISOString())}`)}`  );
  lines.push('');

  console.log(lines.join('\n'));
}

// ── Command ──────────────────────────────────────────────────────────────────

export async function statusCommand(options: StatusOptions): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  if (options.watch) {
    clearScreen();
    await render();
    process.stdout.write(`  ${dim('Watching — refreshes every 3s · Ctrl+C to exit')}\n`);

    const interval = setInterval(async () => {
      clearScreen();
      await render();
      process.stdout.write(`  ${dim('Watching — refreshes every 3s · Ctrl+C to exit')}\n`);
    }, 3000);

    process.on('SIGINT', () => {
      clearInterval(interval);
      process.stdout.write('\n');
      process.exit(0);
    });
  } else {
    await render();
  }
}
