// ── ANSI helpers — zero external dependencies ─────────────────────────────────

const E = '\x1b[';

export const reset  = `${E}0m`;
const _bold   = `${E}1m`;
const _dim    = `${E}2m`;
const _red    = `${E}31m`;
const _green  = `${E}32m`;
const _yellow = `${E}33m`;
const _cyan   = `${E}36m`;
const _gray   = `${E}90m`;

export const bold   = (s: string) => `${_bold}${s}${reset}`;
export const dim    = (s: string) => `${_dim}${s}${reset}`;
export const red    = (s: string) => `${_red}${s}${reset}`;
export const green  = (s: string) => `${_green}${s}${reset}`;
export const yellow = (s: string) => `${_yellow}${s}${reset}`;
export const cyan   = (s: string) => `${_cyan}${s}${reset}`;
export const gray   = (s: string) => `${_gray}${s}${reset}`;

// ── Screen control ────────────────────────────────────────────────────────────

export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

// ── Layout helpers ────────────────────────────────────────────────────────────

/** Section header: blank line, bold-cyan label with optional count, then a rule. */
export function sectionHeader(label: string, count?: number): string {
  const countStr = count !== undefined ? `  ${gray(`(${count})`)}` : '';
  return `\n  ${bold(cyan(label))}${countStr}\n  ${'─'.repeat(62)}`;
}

/** Pad a plain string (no ANSI codes) to exactly `width` characters. */
export function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/** HH:MM:SS from an ISO timestamp. */
export function shortTime(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 8);
}

/** Human-readable "Xm remaining" or "expired" until a future ISO timestamp. */
export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return red('expired');
  const m = Math.floor(diff / 60_000);
  if (m < 60) return yellow(`${m}m remaining`);
  return yellow(`${Math.floor(m / 60)}h ${m % 60}m remaining`);
}
