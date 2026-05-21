import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  allFolders,
  foldersForSession,
  loadTags,
  sessionsInFolder,
  tagSession,
  untagSession,
} from '../src/tagsStore.js'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cb-tags-'))
  file = join(dir, 'tags.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('tagsStore', () => {
  it('returns {} when the file does not exist', async () => {
    expect(await loadTags(file)).toEqual({})
  })

  it('tags a session and persists it', async () => {
    const after = await tagSession(file, 's1', 'Auth refactor')
    expect(after).toEqual(['Auth refactor'])
    expect(await loadTags(file)).toEqual({ s1: ['Auth refactor'] })
  })

  it('is idempotent — tagging the same folder twice does not duplicate', async () => {
    await tagSession(file, 's1', 'A')
    const after = await tagSession(file, 's1', 'A')
    expect(after).toEqual(['A'])
  })

  it('supports a session in multiple folders', async () => {
    await tagSession(file, 's1', 'A')
    const after = await tagSession(file, 's1', 'B')
    expect(after).toEqual(['A', 'B'])
  })

  it('untags and removes the key when no folders remain', async () => {
    await tagSession(file, 's1', 'A')
    const after = await untagSession(file, 's1', 'A')
    expect(after).toEqual([])
    expect(await loadTags(file)).toEqual({})
  })

  it('untag keeps other folders', async () => {
    await tagSession(file, 's1', 'A')
    await tagSession(file, 's1', 'B')
    const after = await untagSession(file, 's1', 'A')
    expect(after).toEqual(['B'])
  })

  it('queries: foldersForSession / sessionsInFolder / allFolders', async () => {
    await tagSession(file, 's1', 'A')
    await tagSession(file, 's2', 'A')
    await tagSession(file, 's2', 'B')
    const tags = await loadTags(file)
    expect(foldersForSession(tags, 's2').sort()).toEqual(['A', 'B'])
    expect(sessionsInFolder(tags, 'A').sort()).toEqual(['s1', 's2'])
    expect(allFolders(tags)).toEqual(['A', 'B'])
  })

  it('tolerates a corrupt tags file (returns {})', async () => {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(file, 'not json{{', 'utf8')
    expect(await loadTags(file)).toEqual({})
  })
})
