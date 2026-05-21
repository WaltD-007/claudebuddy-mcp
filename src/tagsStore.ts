/**
 * Local folder-tag store: sessionId -> folder names.
 *
 * v1 persists to ~/.claudebuddy/tags.json. In a later milestone this
 * is replaced/backed by Supabase sync so tags created in the extension
 * appear here and vice versa. The file path is injectable for tests.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { tagsMapSchema, type TagsMap } from './schema.js'

export function defaultTagsFile(): string {
  return join(homedir(), '.claudebuddy', 'tags.json')
}

export async function loadTags(file: string): Promise<TagsMap> {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = tagsMapSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

async function saveTags(file: string, tags: TagsMap): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(tags, null, 2), 'utf8')
}

/** Add a folder to a session. Returns the session's folder list after. */
export async function tagSession(
  file: string,
  sessionId: string,
  folder: string,
): Promise<string[]> {
  const tags = await loadTags(file)
  const current = tags[sessionId] ?? []
  const next = current.includes(folder) ? current : [...current, folder]
  tags[sessionId] = next
  await saveTags(file, tags)
  return next
}

/** Remove a folder from a session. Returns the folder list after. */
export async function untagSession(
  file: string,
  sessionId: string,
  folder: string,
): Promise<string[]> {
  const tags = await loadTags(file)
  const current = tags[sessionId] ?? []
  const next = current.filter((f) => f !== folder)
  if (next.length > 0) tags[sessionId] = next
  else delete tags[sessionId]
  await saveTags(file, tags)
  return next
}

export function foldersForSession(
  tags: TagsMap,
  sessionId: string,
): string[] {
  return tags[sessionId] ?? []
}

export function sessionsInFolder(tags: TagsMap, folder: string): string[] {
  return Object.entries(tags)
    .filter(([, folders]) => folders.includes(folder))
    .map(([sessionId]) => sessionId)
}

export function allFolders(tags: TagsMap): string[] {
  const set = new Set<string>()
  for (const folders of Object.values(tags)) {
    for (const f of folders) set.add(f)
  }
  return Array.from(set).sort()
}
