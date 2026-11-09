---
id: "005"
title: "MCP server parameter alignment and ephemeral package bundling"
status: "Accepted"
date: 2026-11-09
supersedes: N/A
---

## Context
Running real-world execution of `stock-research-executor` on NSE:HEROMOTOCO revealed three infrastructure gaps:
1. `stock-research_yfinance` tools failed with `ValidationError: symbol - Field required` because skill documentation instructed agents to pass `ticker="<ticker>"`.
2. `screener-mcp`'s `ask_company_research` failed because `uvx` ran an isolated environment without optional `screener-mcp[ai]` or `pdfplumber` dependencies.
3. `tijori-finance` MCP server was missing from the loaded server registry because non-interactive background subshells lacked NVM's node in `PATH` and lacked a GitHub package entry point in plugin config.

## Learning / Decision
1. Always align skill tool invocation examples with Pydantic JSON schemas (`symbol` vs `ticker`).
2. When launching CLI tools via `uvx` that need optional extras or binary format parsers, supply `--with <extra>` arguments directly in the MCP server `args` array (`--with screener-mcp[ai] --with pdfplumber`).
3. For Node MCP servers executed via `npx` from remote GitHub repositories, ensure `package.json` declares `"bin"`, executable entrypoints include `#!/usr/bin/env node`, and absolute session storage paths (`TIJORI_SESSION_PATH`, `PPLX_SESSION_PATH`) are passed in `env` to avoid caching session state in ephemeral npm directories.

## Rejected Alternatives
* Relying on global Python/pip package installs on the host machine: rejected because `uvx` isolates execution environments by design.
* Using relative path execution for Node tools: rejected because Antigravity process runner execution working directories vary.
