---
name: open-code-review-delegate
description: AI-driven code review using OCR deterministic rule/file selection while using the host agent as the reviewer.
---

# Open Code Review (Delegate Mode)

When asked to review code, PRs, or workspace changes:

1. **Preview Changes**:
   Run `ocr delegate preview --format json` (or add `--from <base> --to <head>` for branch comparisons).
   Identify reviewable files and ignore excluded files.

2. **Fetch Rules**:
   Run `ocr delegate rule --format json <files...>` to get the project-specific coding rules grouped by file.

3. **Get Diffs**:
   Run `git diff HEAD -- <file>` (or read untracked files directly).

4. **Perform Code Review**:
   Review each file against the fetched rules using your own model intelligence.
   Focus on:
   - Security vulnerabilities (XSS, SQL injection, auth bugs)
   - Performance and resource leaks
   - Logic bugs and edge cases
   - Naming and architectural consistency

5. **Report**:
   Group findings by file and severity (Critical, High, Medium, Low) with clear diff suggestions.
