---
name: API health probe
description: Deployment health-check behavior for the API server.
---

The deployment health probe requests `/api` directly, so the API root must return the same lightweight health response as `/api/healthz` before portal authentication middleware. Application endpoints remain protected.

**Why:** Treating the API root like a normal authenticated route causes false deployment-health failures even when the server and database are healthy.

**How to apply:** Preserve public health responses only at the root health paths; do not broaden authentication exceptions to drawing, user, storage, admin, or other application routes.