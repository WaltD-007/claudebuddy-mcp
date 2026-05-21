#!/usr/bin/env node
/**
 * ClaudeBuddy MCP companion — stdio entry point.
 *
 * Configured by the host (Claude Code / Claude Desktop) which spawns
 * this process and speaks JSON-RPC over stdio. Do NOT write to stdout
 * other than via the transport — it would corrupt the protocol stream.
 * Diagnostics go to stderr.
 */

import { configFromEnv, runStdioServer } from './server.js'

runStdioServer(configFromEnv()).catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`[claudebuddy-mcp] fatal: ${msg}\n`)
  process.exit(1)
})
