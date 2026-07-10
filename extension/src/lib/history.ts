// Read Claude session transcripts from ~/.claude/projects/<enc-cwd>/<id>.jsonl.
// We extract a title (the Claude-generated `aiTitle`), the cwd (read from inside
// the transcript — never reverse the dir name), last-active (file mtime) and
// turn count. Parsed metadata is cached by file mtime so unchanged transcripts
// aren't re-read (SPEC §6.2, §9).

import { readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface TranscriptMeta {
  sessionId: string;
  cwd: string;
  title: string;
  updatedAt: number; // mtime ms
  turns: number;
  lastMessage: string; // last assistant text (the "pending question")
}

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

const cache = new Map<string, { mtimeMs: number; meta: TranscriptMeta }>();

// Assistant message content is either a string or an array of blocks; pull the
// text blocks.
function assistantText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && (b as { type?: string }).type === "text" && typeof (b as { text?: string }).text === "string")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
  }
  return "";
}

function parseTranscript(path: string, sessionId: string): TranscriptMeta {
  let cwd = "";
  let title = "";
  let turns = 0;
  let lastMessage = "";
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return { sessionId, cwd, title, updatedAt: 0, turns: 0, lastMessage: "" };
  }
  for (const line of content.split("\n")) {
    if (!line) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!cwd && typeof row.cwd === "string") cwd = row.cwd;
    if (row.type === "user") turns++;
    if (row.type === "ai-title" && typeof row.aiTitle === "string") {
      if (row.sessionId === sessionId || !title) title = row.aiTitle;
    }
    if (row.type === "assistant") {
      const msg = row.message as { content?: unknown } | undefined;
      const t = msg ? assistantText(msg.content) : "";
      if (t) lastMessage = t.slice(0, 1200);
    }
  }
  return { sessionId, cwd, title, updatedAt: 0, turns, lastMessage };
}

export function readTranscripts(): Map<string, TranscriptMeta> {
  const out = new Map<string, TranscriptMeta>();
  let projectDirs: string[];
  try {
    projectDirs = readdirSync(PROJECTS_DIR);
  } catch {
    return out;
  }

  for (const pd of projectDirs) {
    const dir = join(PROJECTS_DIR, pd);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const full = join(dir, f);
      const sessionId = f.replace(/\.jsonl$/, "");
      let mtimeMs: number;
      try {
        mtimeMs = statSync(full).mtimeMs;
      } catch {
        continue;
      }
      const cached = cache.get(full);
      let meta: TranscriptMeta;
      if (cached && cached.mtimeMs === mtimeMs) {
        meta = cached.meta;
      } else {
        meta = parseTranscript(full, sessionId);
        meta.updatedAt = mtimeMs;
        cache.set(full, { mtimeMs, meta });
      }
      out.set(sessionId, { ...meta, updatedAt: mtimeMs });
    }
  }
  return out;
}
