---
name: Artifact publishing run command
description: Publishing can fall back to root deployment settings when artifact registration is stale or unavailable.
---

For this workspace, keep an explicit root production build and run command alongside artifact-level production metadata so publishing can locate a runnable service even when artifact discovery is delayed.

**Why:** The app built and ran in preview, but publishing reported that it could not find a run command until the root deployment configuration declared both commands.

**How to apply:** When publishing reports a missing run command, inspect both `.replit` and each artifact's `artifact.toml`; validate any `.replit` replacement through Replit's schema-aware tool.