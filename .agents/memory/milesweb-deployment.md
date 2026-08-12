---
name: MilesWeb cPanel deployment
description: Standalone deployment approach for hosting the Drawing Library on MilesWeb Node.js hosting.
---

MilesWeb cPanel should receive a standalone bundle rather than the pnpm workspace. The bundle serves the compiled frontend and Express API from one Node.js process, with cPanel providing the process port.

**Why:** cPanel's Node.js application environment does not resolve workspace-only dependency specifiers, while the product needs same-origin frontend and `/api` routing.

**How to apply:** Regenerate the bundle with the MilesWeb packaging script, upload its contents, run `npm install --omit=dev`, configure `MYSQL_URL` and `SESSION_SECRET`, and start with `server.mjs`.