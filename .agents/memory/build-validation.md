---
name: Build validation
description: Workspace-wide checks and workflow environment expectations.
---

The canonical workspace build should work both from a shell and through managed workflows. Vite configs may use workflow-provided PORT and BASE_PATH values, but must retain safe local defaults for standalone build validation.

**Why:** A strict environment-variable guard in the reusable mockup preview blocked the workspace build even though the managed preview workflow was healthy.

**How to apply:** Keep managed artifact values authoritative in workflows, and use non-secret development defaults only for config evaluation during local production builds.

For a root web artifact, its declared service port must match the managed workflow port, and the artifact-owned workflow must be the only frontend process on that port.

**Why:** A stale root artifact port combined with a manually configured duplicate frontend workflow caused the app to build successfully but return a preview 502.

**How to apply:** Register the canonical root artifact, keep its service metadata aligned with its workflow, and remove duplicate manual frontend workflows before restarting.