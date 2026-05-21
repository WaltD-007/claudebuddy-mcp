import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverSessions, readTranscript } from '../src/discovery.js'

let projectsDir: string

const SESSION_ID = '59b729d2-64f3-46f5-82e0-8fbf82934728'

function jsonl(lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
}

beforeEach(async () => {
  projectsDir = await mkdtemp(join(tmpdir(), 'cb-projects-'))
  const projDir = join(projectsDir, '-Users-x-projects-demo')
  await mkdir(projDir, { recursive: true })
  await writeFile(
    join(projDir, `${SESSION_ID}.jsonl`),
    jsonl([
      { type: 'queue-operation', operation: 'enqueue' },
      {
        type: 'user',
        message: { role: 'user', content: 'Build the auth refactor please' },
        cwd: '/Users/x/projects/demo',
        entrypoint: 'claude-desktop',
        gitBranch: 'main',
        timestamp: '2026-05-16T10:00:00.000Z',
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'On it. Reading the codebase…' }],
        },
        timestamp: '2026-05-16T10:00:05.000Z',
      },
      {
        type: 'user',
        message: { role: 'user', content: 'thanks' },
        timestamp: '2026-05-16T10:01:00.000Z',
      },
    ]),
  )
})

afterEach(async () => {
  await rm(projectsDir, { recursive: true, force: true })
})

describe('discoverSessions', () => {
  it('discovers a session with parsed metadata', async () => {
    const sessions = await discoverSessions(projectsDir)
    expect(sessions).toHaveLength(1)
    const s = sessions[0]!
    expect(s.sessionId).toBe(SESSION_ID)
    expect(s.cwd).toBe('/Users/x/projects/demo')
    expect(s.entrypoint).toBe('claude-desktop')
    expect(s.gitBranch).toBe('main')
    expect(s.title).toBe('Build the auth refactor please')
    expect(s.sizeBytes).toBeGreaterThan(0)
  })

  it('returns [] for a missing projects dir', async () => {
    expect(await discoverSessions('/no/such/dir/xyz')).toEqual([])
  })

  it('skips directories with no jsonl files', async () => {
    await mkdir(join(projectsDir, 'empty-proj'), { recursive: true })
    const sessions = await discoverSessions(projectsDir)
    expect(sessions).toHaveLength(1)
  })
})

describe('readTranscript', () => {
  it('reads user + assistant turns, skips queue ops', async () => {
    const turns = await readTranscript(projectsDir, SESSION_ID)
    expect(turns).not.toBeNull()
    expect(turns!.map((t) => t.role)).toEqual([
      'user',
      'assistant',
      'user',
    ])
    expect(turns![1]!.text).toContain('Reading the codebase')
  })

  it('caps to the most recent N turns', async () => {
    const turns = await readTranscript(projectsDir, SESSION_ID, 1)
    expect(turns).toHaveLength(1)
    expect(turns![0]!.text).toBe('thanks')
  })

  it('returns null for an unknown session id', async () => {
    expect(await readTranscript(projectsDir, 'nope')).toBeNull()
  })
})
