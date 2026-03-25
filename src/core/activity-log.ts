import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ActivityEntry } from './types.js';
import { getTeamDir } from './team.js';
import { LOG_DIR, ACTIVITY_LOG_FILE } from './types.js';

// ── Path ──────────────────────────────────────────────────────────────────────

function activityLogPath(root?: string): string {
  return join(getTeamDir(root), LOG_DIR, ACTIVITY_LOG_FILE);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function appendActivity(
  entry: Omit<ActivityEntry, 'timestamp'>,
  root?: string,
): Promise<void> {
  const full: ActivityEntry = { timestamp: new Date().toISOString(), ...entry };
  const line = JSON.stringify(full) + '\n';
  const path = activityLogPath(root);
  try {
    await appendFile(path, line, 'utf-8');
  } catch {
    // Log directory may not exist yet (e.g. during init before scaffold)
    await mkdir(join(getTeamDir(root), LOG_DIR), { recursive: true });
    await appendFile(path, line, 'utf-8');
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns the last `limit` entries from the activity log (default 100).
 * Pass limit = 0 to read all entries.
 */
export async function readActivityLog(
  root?: string,
  limit = 100,
): Promise<ActivityEntry[]> {
  const path = activityLogPath(root);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf-8');
  const entries = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ActivityEntry);
  return limit > 0 ? entries.slice(-limit) : entries;
}
