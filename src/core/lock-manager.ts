import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FileLock } from './types.js';
import { getTeamDir } from './team.js';
import { LOCKS_DIR } from './types.js';

const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes default

// ── Paths ────────────────────────────────────────────────────────────────────

function locksDir(root?: string): string {
  return join(getTeamDir(root), LOCKS_DIR);
}

function lockFilePath(file: string, root?: string): string {
  // Encode the file path into a safe filename
  const safeName = file.replace(/[/\\:*?"<>|]/g, '_');
  return join(locksDir(root), `${safeName}.lock.json`);
}

// ── Acquire / Release ────────────────────────────────────────────────────────

export async function acquireLock(
  file: string,
  agent: string,
  taskId: string,
  root?: string,
): Promise<boolean> {
  const existing = await isLocked(file, root);
  if (existing && existing.agent !== agent) {
    return false; // Another agent holds the lock
  }

  const lock: FileLock = {
    file,
    agent,
    taskId,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
  };

  await writeFile(lockFilePath(file, root), JSON.stringify(lock, null, 2));
  return true;
}

export async function releaseLock(
  file: string,
  agent: string,
  root?: string,
): Promise<boolean> {
  const existing = await isLocked(file, root);
  if (!existing) return true; // Already unlocked
  if (existing.agent !== agent) return false; // Not your lock

  const path = lockFilePath(file, root);
  if (existsSync(path)) {
    await unlink(path);
  }
  return true;
}

export async function releaseAllLocks(
  agent: string,
  root?: string,
): Promise<number> {
  const locks = await getLocks(root);
  let released = 0;

  for (const lock of locks) {
    if (lock.agent === agent) {
      const path = lockFilePath(lock.file, root);
      if (existsSync(path)) {
        await unlink(path);
        released++;
      }
    }
  }

  return released;
}

// ── Query ────────────────────────────────────────────────────────────────────

export async function isLocked(
  file: string,
  root?: string,
): Promise<FileLock | null> {
  const path = lockFilePath(file, root);
  if (!existsSync(path)) return null;

  const raw = await readFile(path, 'utf-8');
  const lock = JSON.parse(raw) as FileLock;

  // Check expiry
  if (new Date(lock.expiresAt) < new Date()) {
    await unlink(path);
    return null;
  }

  return lock;
}

export async function getLocks(root?: string): Promise<FileLock[]> {
  const dir = locksDir(root);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const locks: FileLock[] = [];

  for (const f of files) {
    if (!f.endsWith('.lock.json')) continue;
    const raw = await readFile(join(dir, f), 'utf-8');
    const lock = JSON.parse(raw) as FileLock;

    // Skip expired locks
    if (new Date(lock.expiresAt) < new Date()) {
      await unlink(join(dir, f));
      continue;
    }

    locks.push(lock);
  }

  return locks;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export async function cleanExpiredLocks(root?: string): Promise<number> {
  const dir = locksDir(root);
  if (!existsSync(dir)) return 0;

  const files = await readdir(dir);
  let cleaned = 0;

  for (const f of files) {
    if (!f.endsWith('.lock.json')) continue;
    const path = join(dir, f);
    const raw = await readFile(path, 'utf-8');
    const lock = JSON.parse(raw) as FileLock;

    if (new Date(lock.expiresAt) < new Date()) {
      await unlink(path);
      cleaned++;
    }
  }

  return cleaned;
}
