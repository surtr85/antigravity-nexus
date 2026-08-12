---
id: 647d9b71
type: skill
status: active
confidence: high
project: homelab
created: 2026-08-12
updated: 2026-08-12
tags:
  - jujutsu
  - jj
  - vcs
  - git
  - cheatsheet
  - tooling
---

# Jujutsu (jj) VCS Complete Usage and Architecture Guide

Comprehensive guide and reference for Jujutsu (jj v0.43.0) VCS vs Git:

1. Architecture & Core Concepts:
- Revision-based: Working copy `@` is always a commit/revision. No manual staging (`git add`) needed. Changes are recorded automatically in working revision.
- Change ID vs Commit ID: Change ID (`uwzxlkpm`) is stable across edits/rebases; Commit ID (`71a58148`) changes whenever content/parents change.
- Colocated repository: `jj git init --colocate` creates `.jj` alongside `.git` for full Git compatibility.
- Operation Log (`jj op log`): Every mutation is recorded in operation history. Any mistake/operation can be undone with `jj undo` or `jj op restore`.

2. Key Commands Reference:
- Inspection:
  * `jj status` / `jj st`: View working copy state.
  * `jj log` / `jj l`: Visual graph log of revisions.
  * `jj show [rev]`: View commit diff and metadata.
  * `jj diff`: View uncommitted changes in `@` or between revisions.

- Change Management:
  * `jj new [parent]`: Create a new working revision `@` on top of specified or current parent.
  * `jj describe -m "msg"` / `jj desc`: Set or update commit message for `@` or specified revision.
  * `jj edit <rev>`: Instantly switch working copy `@` to edit any past revision directly (auto-rebases children!).
  * `jj squash` / `jj sq`: Squash changes from `@` into parent revision (or specify source/destination).
  * `jj split [path]`: Split a revision into two separate revisions by path or interactively.
  * `jj abandon <rev>`: Delete/abandon a revision (automatically rebases child commits onto parent).
  * `jj rebase -s <source> -d <destination>`: Rebase revision or subtree onto new parent.

- Bookmarks (Git Branches):
  * `jj bookmark create <name>` / `jj bookmark set <name> -r <rev>`: Manage bookmarks.
  * `jj bookmark list`: View bookmarks.

- Operation Log & Undo:
  * `jj op log`: View operation history.
  * `jj undo`: Undo previous operation.

3. Configuration (~/.config/jj/config.toml):
[user]
name = "amadeus"
email = "surtr85@proton.me"

[ui]
paginate = "never"   # Disable interactive pagers
editor = "true"       # Non-interactive commit message editor for scripts/headless environments
