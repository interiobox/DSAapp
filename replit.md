# Design Sense Architects — Drawing Library

An architectural drawing management app for Design Sense Architects, maintaining a searchable drawing library, review status, issue dates, and project activity.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secret: `MYSQL_URL` — encrypted MySQL connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: MySQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the drawing library API
- `lib/db/src/schema/drawings.ts` — MySQL schema for drawings and activity
- `artifacts/api-server/src/routes/drawings.ts` — drawing CRUD and activity routes
- `artifacts/project-hub/src/pages/` — drawing library and drawing detail/review screens
- `artifacts/project-hub/src/index.css` — blueprint-inspired visual theme
- `scripts/src/build-milesweb.ts` — creates the standalone `milesweb-deploy` cPanel upload folder

## Architecture decisions

- The API contract is OpenAPI-first and generated clients are used by the React app.
- Calendar-only due and issue dates are stored as MySQL `date` values to avoid timezone shifts.
- API writes re-read inserted or updated rows because MySQL does not support PostgreSQL-style `RETURNING`.
- Status transitions are explicit actions from drawing detail, with dashboard and activity caches refreshed after mutations.
- The production frontend and API can run from one Node.js process, with the frontend mounted through `FRONTEND_DIST_DIR`.
- MilesWeb deployment is packaged separately because cPanel's Node.js app does not resolve this workspace's `workspace:*` dependencies.

## Product

- Searchable and filterable drawing library
- Drawing detail view with revision metadata and review/issue workflow
- Mobile-friendly review comments, uploads, and full edit/delete controls
- Persistent MySQL storage with authenticated activity history and personal My Feed
- First-party username/password sign-in with profile-based upload, comment, and assignment attribution
- Administrator-managed portal accounts, passwords, roles, drawing disciplines, and complete activity history

## User preferences

- Use MySQL for application persistence.

## Gotchas

- Keep `MYSQL_URL` in Replit Secrets; never put the connection string in source files.
- Run `pnpm --filter @workspace/scripts run build:milesweb` to regenerate the standalone upload folder.
- MilesWeb must provide a MySQL database and the Node.js app must define `MYSQL_URL`, `SESSION_SECRET`, and any configured Google Cloud Storage variables.
- The API refuses to start without `MYSQL_URL`; this is intentional rather than a silent fallback.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
