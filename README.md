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
the store Claude Desktop and Claude Code CLI share. Folder tags
persist to `~/.claudebuddy/tags.json`.

## Requirements

- **Node.js ≥ 20**
- macOS or Linux (the default session and tag paths use `~/...`;
  Windows users will need to override both env vars below)
- Claude Code or Claude Desktop installed (so there's a
  `~/.claude/projects/` directory to discover sessions from)

## Install

Not yet published to npm — install from source:

```bash
git clone https://github.com/WaltD-007/claudebuddy-mcp.git
cd claudebuddy-mcp
npm install
npm run build
```

This produces `dist/index.js`, which is what you point Claude at.

### Claude Code

Add to `~/.claude/mcp_servers.json` (or run `claude mcp add`):

```json
{
  "mcpServers": {
    "claudebuddy": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/claudebuddy-mcp/dist/index.js"]
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
transmitted anywhere by this process. Folder tags are stored locally
at `~/.claudebuddy/tags.json`.

## Development

```bash
npm test         # vitest — discovery + tags store
npm run typecheck
npm run build
npm run dev       # tsc --watch
```

## License

MIT — see [LICENSE](./LICENSE).
