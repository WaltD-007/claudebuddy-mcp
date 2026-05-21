/**
 * ClaudeBuddy MCP server.
 *
 * Exposes the user's cross-surface Claude session library to Claude Code
 * and Claude Desktop. Capabilities are mostly tools — the spike found
 * tools are the most universally-supported MCP capability across hosts
 * (docs/mcp-spike-findings.md), so the differentiating "recall" feature
 * is a tool, not a templated resource, to minimise host-compat risk.
 *
 * Honest positioning (post-spike): this is a *recall + organise* layer.
 * It cannot re-open a past Desktop session (no API for that). It can
 * find, organise, and surface any past session's transcript so you
 * never lose a thread.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  defaultProjectsDir,
  discoverSessions,
  readTranscript,
} from './discovery.js'
import {
  allFolders,
  defaultTagsFile,
  foldersForSession,
  loadTags,
  sessionsInFolder,
  tagSession,
  untagSession,
} from './tagsStore.js'

export type ServerConfig = {
  projectsDir: string
  tagsFile: string
}

export function configFromEnv(): ServerConfig {
  return {
    projectsDir: process.env.CLAUDEBUDDY_PROJECTS_DIR ?? defaultProjectsDir(),
    tagsFile: process.env.CLAUDEBUDDY_TAGS_FILE ?? defaultTagsFile(),
  }
}

function formatTranscript(
  turns: { role: string; at?: string; text: string }[],
): string {
  return turns
    .map((t) => {
      const who =
        t.role === 'user' ? 'You' : t.role === 'assistant' ? 'Claude' : t.role
      return `### ${who}${t.at ? ` · ${t.at}` : ''}\n\n${t.text}`
    })
    .join('\n\n---\n\n')
}

export function createServer(cfg: ServerConfig): McpServer {
  const server = new McpServer({
    name: 'claudebuddy',
    version: '0.1.0',
  })

  server.registerTool(
    'list_sessions',
    {
      title: 'List Claude sessions',
      description:
        'List your Claude Code / Desktop sessions, newest first. Optionally filter by a ClaudeBuddy folder. Each result includes which folders it is tagged into.',
      inputSchema: { folder: z.string().optional() },
    },
    async ({ folder }) => {
      const [sessions, tags] = await Promise.all([
        discoverSessions(cfg.projectsDir),
        loadTags(cfg.tagsFile),
      ])
      const filtered = folder
        ? sessions.filter((s) =>
            sessionsInFolder(tags, folder).includes(s.sessionId),
          )
        : sessions
      const enriched = filtered.slice(0, 50).map((s) => ({
        ...s,
        folders: foldersForSession(tags, s.sessionId),
      }))
      return {
        content: [
          { type: 'text', text: JSON.stringify(enriched, null, 2) },
        ],
      }
    },
  )

  server.registerTool(
    'tag_session',
    {
      title: 'Add a session to a folder',
      description:
        'Tag a Claude session into a ClaudeBuddy folder so you can find it later across surfaces.',
      inputSchema: {
        sessionId: z.string(),
        folder: z.string(),
      },
    },
    async ({ sessionId, folder }) => {
      const folders = await tagSession(cfg.tagsFile, sessionId, folder)
      return {
        content: [
          {
            type: 'text',
            text: `Tagged ${sessionId.slice(0, 8)} into "${folder}". Now in: ${folders.join(', ')}`,
          },
        ],
      }
    },
  )

  server.registerTool(
    'untag_session',
    {
      title: 'Remove a session from a folder',
      description: 'Remove a Claude session from a ClaudeBuddy folder.',
      inputSchema: {
        sessionId: z.string(),
        folder: z.string(),
      },
    },
    async ({ sessionId, folder }) => {
      const folders = await untagSession(cfg.tagsFile, sessionId, folder)
      return {
        content: [
          {
            type: 'text',
            text: `Removed ${sessionId.slice(0, 8)} from "${folder}". ${
              folders.length ? `Still in: ${folders.join(', ')}` : 'No folders left.'
            }`,
          },
        ],
      }
    },
  )

  server.registerTool(
    'recall_session',
    {
      title: 'Recall a past session transcript',
      description:
        "Read a past Claude session's transcript (read-only) so you can pull its context into the current conversation. This is the cross-surface recall — works for any session from any Claude surface.",
      inputSchema: {
        sessionId: z.string(),
        maxTurns: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ sessionId, maxTurns }) => {
      const turns = await readTranscript(
        cfg.projectsDir,
        sessionId,
        maxTurns ?? 200,
      )
      if (!turns) {
        return {
          content: [
            {
              type: 'text',
              text: `No session found with id ${sessionId}.`,
            },
          ],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text', text: formatTranscript(turns) }],
      }
    },
  )

  server.registerResource(
    'sessions',
    'claudebuddy://sessions',
    {
      title: 'All Claude sessions',
      description:
        'Every discovered Claude Code / Desktop session with its folder tags.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const [sessions, tags] = await Promise.all([
        discoverSessions(cfg.projectsDir),
        loadTags(cfg.tagsFile),
      ])
      const enriched = sessions.map((s) => ({
        ...s,
        folders: foldersForSession(tags, s.sessionId),
      }))
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(enriched, null, 2),
          },
        ],
      }
    },
  )

  server.registerResource(
    'folders',
    'claudebuddy://folders',
    {
      title: 'ClaudeBuddy folders',
      description: 'Folder names with session counts.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const tags = await loadTags(cfg.tagsFile)
      const folders = allFolders(tags).map((name) => ({
        name,
        sessionCount: sessionsInFolder(tags, name).length,
      }))
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(folders, null, 2),
          },
        ],
      }
    },
  )

  return server
}

export async function runStdioServer(cfg: ServerConfig): Promise<void> {
  const server = createServer(cfg)
  await server.connect(new StdioServerTransport())
}
