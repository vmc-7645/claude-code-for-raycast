// Read Claude Code's own live session registry: ~/.claude/sessions/<pid>.json.
// Claude maintains one file per live session and removes it on exit, so this is
// the authoritative source of which agents are active (SPEC §6.1).

import { readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface ClaudeSession {
  sessionId: string;
  cwd: string;
  pid: number;
  status: "busy" | "idle";
  name?: string;
  updatedAt: number;
}

const SESSIONS_DIR = join(homedir(), ".claude", "sessions");

// Is the process still running? Claude removes its session file on a clean exit,
// but a crash / kill -9 leaves a stale file that would otherwise show forever as
// a live agent (and make Stop SIGINT a possibly-recycled PID). `kill(pid, 0)`
// signals nothing; it just probes existence. ESRCH = gone; EPERM = alive but not
// ours (still alive). pid 0 = unknown → keep (can't verify).
function pidAlive(pid: number): boolean {
  if (!pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readActiveSessions(): ClaudeSession[] {
  let files: string[];
  try {
    files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const out: ClaudeSession[] = [];
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(join(SESSIONS_DIR, f), "utf8"));
      const pid = typeof j.pid === "number" ? j.pid : 0;
      if (
        typeof j.sessionId === "string" &&
        typeof j.cwd === "string" &&
        pidAlive(pid)
      ) {
        out.push({
          sessionId: j.sessionId,
          cwd: j.cwd,
          pid,
          status: j.status === "busy" ? "busy" : "idle",
          name: typeof j.name === "string" ? j.name : undefined,
          updatedAt: typeof j.updatedAt === "number" ? j.updatedAt : 0,
        });
      }
    } catch {
      // skip unreadable/partial files
    }
  }
  return out;
}
