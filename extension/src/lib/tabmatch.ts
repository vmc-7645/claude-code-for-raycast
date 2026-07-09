// Match a Claude agent to its Ghostty tab by title. The tab-status hook sets tab
// titles to "<emoji> <repo>:<branch> \u2014 <task>". Pure (no Raycast) so it's
// unit-testable. SPEC §8.

import { Agent } from "./types";

export function agentMatchesTab(agent: Agent, tabTitle: string): boolean {
  // Separator: space + dash + space (em dash U+2014 normally; en dash / hyphen
  // tolerated). Branch hyphens have no surrounding spaces, so won't match here.
  const m = tabTitle.match(/ [\u2014\u2013-] /);
  if (!m || m.index === undefined) return false;

  const head = tabTitle.slice(0, m.index); // "<emoji> <repo>:<branch>"
  if (!head.includes(`${agent.repo}:`)) return false;

  // The tab task is truncated (40 + \u2026) and the agent title to 60, but both
  // derive from the same normalized prompt, so the shorter is a prefix of the
  // longer.
  const tabTask = tabTitle
    .slice(m.index + m[0].length)
    .replace(/\u2026\s*$/, "")
    .trim();
  const agentTask = agent.title.replace(/\u2026\s*$/, "").trim();
  if (!tabTask || !agentTask) return false;

  const [short, long] = agentTask.length <= tabTask.length ? [agentTask, tabTask] : [tabTask, agentTask];
  return short.length >= 6 && long.startsWith(short);
}
