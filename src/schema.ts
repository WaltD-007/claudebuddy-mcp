/**
 * Minimal session schema for the MCP companion.
 *
 * Deliberately self-contained: the canonical schemas live in the
 * extension at src/shared/schemas.ts. Extracting a shared
 * `@claudebuddy/core` package that both import is a pre-npm-publish
 * task (tracked in docs/architecture.md §9), not a now-task. Until
 * then this mirrors the `code` half of the SessionMeta union.
 */

import { z } from 'zod'

/** A Claude Code / Desktop session discovered from disk. */
export const discoveredSessionSchema = z.object({
  sessionId: z.string().min(1),
  cwd: z.string().min(1),
  entrypoint: z.string().optional(),
  gitBranch: z.string().optional(),
  firstMessageAt: z.string().optional(), // ISO timestamp
  lastModified: z.string(), // ISO timestamp
  sizeBytes: z.number().nonnegative(),
  title: z.string().optional(), // derived from the first user message
})

export type DiscoveredSession = z.infer<typeof discoveredSessionSchema>

/** sessionId -> folder names. The unit ClaudeBuddy folders contain. */
export const tagsMapSchema = z.record(z.string(), z.array(z.string()))

export type TagsMap = z.infer<typeof tagsMapSchema>

/** One turn of a recalled transcript. */
export type TranscriptTurn = {
  role: 'user' | 'assistant' | 'system'
  at?: string
  text: string
}
