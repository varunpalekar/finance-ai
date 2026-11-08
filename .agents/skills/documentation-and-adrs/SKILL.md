---
name: documentation-and-adrs
description: Comprehensive governance skill for managing architectural decision records (ADRs), feature ledgers, learning logs, and environment testing documentation across the repository.
---

# Documentation and ADRs Skill

This skill defines the governance and lifecycle rules for maintaining project documentation, architectural decision records (ADRs), feature ledgers, and operational learnings in this repository.

## 1. Feature Ledger (`docs/features.md`)

- **Rule**: Update or create `docs/features.md` for **every** feature or requirement change, including minor behavioral updates, manual steps, limitations, and verification status.
- **Structure**:
  - Feature Name / Requirement ID
  - Date & Author/Agent
  - Scope & Behavioral Changes
  - Manual Steps / Operator Instructions
  - Current Limitations & Edge Cases
  - Verification Status (`Planned`, `In Progress`, `Verified` with evidence)

## 2. Architectural Decision Records (`docs/decisions/`)

- **Directory**: `docs/decisions/`
- **Naming Convention**: `NNNN-short-title.md` (e.g., `0001-agent-operating-framework-and-documentation-governance.md`, four-digit sequential numbering).
- **Lifecycle & Statuses**:
  - `Proposed`: Unresolved decisions awaiting discussion or validation.
  - `Accepted`: Approved decisions actively governing implementation.
  - `Superseded`: Historical decisions replaced by a subsequent ADR (link the superseding ADR number; NEVER delete historical records).
  - `Rejected`: Decisions considered and discarded.
- **Template**:
  ```markdown
  # ADR-NNNN: [Short Title]

  - **Status**: [Proposed | Accepted | Superseded by NNNN | Rejected]
  - **Date**: YYYY-MM-DD
  - **Deciders**: [List of roles / agents / stakeholders]
  - **Consulted**: [Stakeholders consulted]

  ## Context and Problem Statement
  [What is the context, architectural problem, and motivation?]

  ## Decision Drivers
  - [Driver 1]
  - [Driver 2]

  ## Considered Options
  1. [Option 1]
  2. [Option 2]

  ## Decision Outcome
  - **Chosen Option**: [Option chosen]
  - **Justification**: [Why this option was selected]
  - **Consequences**:
    - *Positive*: [Benefits]
    - *Negative/Trade-offs*: [Costs, risks, constraints]

  ## Implementation & Validation
  [How this decision is implemented and verified]
  ```

## 3. Learnings Ledger (`docs/learning/`)

- **Directory**: `docs/learning/`
- **Naming Convention**: `NNN-short-title.md` (three-digit sequential numbering, e.g., `001-multi-agent-parallelism-and-directory-hygiene.md`).
- **Rule**: One file per finding. A learning records what was observed and the rule that follows. It does not replace `docs/features.md` or an ADR:
  - A feature change updates `docs/features.md`.
  - A choice of design gets an ADR in `docs/decisions/`.
  - An empirical insight, bug postmortem, or operational rule gets a learning in `docs/learning/`.
  - Supersede a wrong or obsolete learning by referencing its number; **do not delete it**.
- **Template**:
  ```markdown
  ---
  id: "NNN"
  title: "Short statement of the rule"
  status: "Accepted"
  date: YYYY-MM-DD
  supersedes: N/A
  ---

  ## Context
  What happened, on which target, and what was checked.

  ## Learning / Decision
  The rule to follow next time.

  ## Rejected Alternatives
  * The other fix, and why it was not used. Write "None" when there was no alternative.
  ```

## 4. Environments and Testing (`docs/environments-and-testing.md`)

- **Rule**: Create/update `docs/environments-and-testing.md` whenever:
  - Customer prerequisites (basic or per component) change.
  - Internal test infrastructure or tools change.
  - Test coverage on internal clusters/environments changes.
  - Customer-side or external validation (dry-run/write-check) changes.
- **Status Integrity**:
  - Keep statuses honest: `Planned` until implemented.
  - Mark `Verified` **only** with recorded, concrete evidence (terminal output, timestamps, commit hashes).

