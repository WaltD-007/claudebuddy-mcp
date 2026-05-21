# @claudebuddy/mcp

The ClaudeBuddy MCP companion. Brings your cross-surface Claude session
library into **Claude Code** and the **Claude Desktop app**.

It's a **recall + organise** layer — it does not (and cannot) re-open a
past Desktop session, because no such API exists. What it does: find,
organise into folders, and surface the full transcript of any past
Claude session from any surface, so you never lose a thread.

## What it exposes

**Tools**

| Tool | What it does |
|---|---|
| `list_sessions(folder?)` | Your Claude Code / Desktop sessions, newest first, with their folder tags. Optionally filter by a ClaudeBuddy folder. |
| `tag_session(sessionId, folder)` | Add a session to a ClaudeBuddy folder. |
| `untag_session(sessionId, folder)` | Remove a session from a folder. |
| `recall_session(sessionId, maxTurns?)` | Read a past session's transcript so you can pull its context into the current conversation. The cross-surface recall. |

**Resources**

| Resource | Content |
|---|---|
| `claudebuddy://sessions` | Every discovered session + its folder tags (JSON). |
| `claudebuddy://folders` | Folder names with session counts (JSON). |

Sessions are discovered from `~/.claude/projects/<cwd>/<id>.jsonl` —
the store Claude Desktop and Claude Code CLI share. Folder tags persist
to `~/.claudebuddy/tags.json` (later: synced via your ClaudeBuddy
account so tags made in the browser extension appear here too).

## Install

> Pre-publish: install from the built `dist/`. Once published the
> command becomes `npx -y @claudebuddy/mcp`.

```bash
cd mcp && npm install && npm run build
```

### Claude Code

Add to `~/.claude/mcp_servers.json` (or run `claude mcp add`):

```json
{
  "mcpServers": {
    "claudebuddy": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/claudemate/mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) under `mcpServers`, same shape as above, then fully quit
(Cmd+Q) and reopen Claude Desktop. Use the **absolute** path to `node`
if `node` isn't on the host's PATH (`which node`).

### Verify

In a fresh conversation:

> Use claudebuddy `list_sessions` and tell me how many sessions it found.

Then try `tag_session` / `recall_session`.

## Configuration

Env vars (optional; sensible defaults):

| Var | Default | Purpose |
|---|---|---|
| `CLAUDEBUDDY_PROJECTS_DIR` | `~/.claude/projects` | Where to discover sessions. |
| `CLAUDEBUDDY_TAGS_FILE` | `~/.claudebuddy/tags.json` | Where folder tags persist. |

## Privacy

The server reads session files **on your machine only**. Nothing is
transmitted anywhere by this process. (Cloud sync of *folder tags*
between this and the browser extension is a separate, opt-in,
Pro-tier feature — and it syncs tags, never transcript content.)

## Development

```bash
npm test         # vitest — discovery + tags store
npm run typecheck
npm run build
npm run dev       # tsc --watch
```

Architecture + roadmap: `../docs/architecture.md` §9.
Why it's recall-not-reopen: `../docs/mcp-spike-findings.md`.
