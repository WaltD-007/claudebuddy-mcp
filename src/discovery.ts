/**
 * Session discovery + transcript recall.
 *
 * Productionised from the spike (docs/mcp-spike-findings.md Q1, validated
 * 2026-05-16). Sessions live at:
 *   <projectsDir>/<cwd-with-slashes-as-dashes>/<sessionId>.jsonl
 * Each line is a JSON object. Claude Desktop and Claude Code CLI write
 * the same format to the same store.
 *
 * All functions take `projectsDir` so tests point at a fixture instead
 * of the real ~/.claude/projects.
 */

import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
import type { DiscoveredSession, TranscriptTurn } from './schema.js'

export function defaultProjectsDir(): string {
  return join(homedir(), '.claude', 'projects')
}

/** Claude message content is either a string or an array of blocks. */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text: unknown }).text ?? '')
        }
        if (block && typeof block === 'object' && 'type' in block) {
          const t = (block as { type: unknown }).type
          if (t === 'tool_use') return '[tool use]'
          if (t === 'tool_result') return '[tool result]'
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

type JsonlLine = {
  type?: string
  message?: { role?: string; content?: unknown }
  cwd?: string
  entrypoint?: string
  gitBranch?: string
  timestamp?: string
}

async function* readJsonl(file: string): AsyncGenerator<JsonlLine> {
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      yield JSON.parse(line) as JsonlLine
    } catch {
      // skip malformed lines defensively
    }
  }
}

/** First `type:"user"` line that carries a message + cwd. */
async function firstMeaningful(file: string): Promise<JsonlLine | null> {
  for await (const o of readJsonl(file)) {
    if (o.type === 'user' && o.message && o.cwd) return o
  }
  return null
}

function deriveTitle(content: unknown): string | undefined {
  const text = extractText(content).replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > 100 ? `${text.slice(0, 100)}…` : text
}

export async function discoverSessions(
  projectsDir: string = defaultProjectsDir(),
): Promise<DiscoveredSession[]> {
  let dirs: string[]
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true })
    dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }

  const out: DiscoveredSession[] = []
  for (const dir of dirs) {
    const full = join(projectsDir, dir)
    let files: string[]
    try {
      files = (await readdir(full)).filter((f) => f.endsWith('.jsonl'))
    } catch {
      continue
    }
    for (const f of files) {
      const path = join(full, f)
      let st
      try {
        st = await stat(path)
      } catch {
        continue
      }
      const meta = await firstMeaningful(path)
      if (!meta || !meta.cwd) continue
      out.push({
        sessionId: f.replace(/\.jsonl$/, ''),
        cwd: meta.cwd,
        ...(meta.entrypoint ? { entrypoint: meta.entrypoint } : {}),
        ...(meta.gitBranch ? { gitBranch: meta.gitBranch } : {}),
        ...(meta.timestamp ? { firstMessageAt: meta.timestamp } : {}),
        lastModified: st.mtime.toISOString(),
        sizeBytes: st.size,
        ...(deriveTitle(meta.message?.content)
          ? { title: deriveTitle(meta.message?.content) }
          : {}),
      })
    }
  }

  out.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  )
  return out
}

/** Locate a session's .jsonl path by id (searches every project dir). */
async function findSessionFile(
  projectsDir: string,
  sessionId: string,
): Promise<string | null> {
  let dirs: string[]
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true })
    dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return null
  }
  for (const dir of dirs) {
    const candidate = join(projectsDir, dir, `${sessionId}.jsonl`)
    try {
      await stat(candidate)
      return candidate
    } catch {
      // not in this dir
    }
  }
  return null
}

/**
 * Read a session's transcript for read-only recall (the honest
 * cross-surface value prop — see docs/mcp-spike-findings.md). Caps at
 * `maxTurns` most-recent turns to keep the resource a sane size.
 */
export async function readTranscript(
  projectsDir: string,
  sessionId: string,
  maxTurns = 200,
): Promise<TranscriptTurn[] | null> {
  const file = await findSessionFile(projectsDir, sessionId)
  if (!file) return null
  const turns: TranscriptTurn[] = []
  for await (const o of readJsonl(file)) {
    if (o.type !== 'user' && o.type !== 'assistant') continue
    const role = o.message?.role
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      continue
    }
    const text = extractText(o.message?.content).trim()
    if (!text) continue
    turns.push({
      role,
      ...(o.timestamp ? { at: o.timestamp } : {}),
      text,
    })
  }
  return turns.slice(-maxTurns)
}
