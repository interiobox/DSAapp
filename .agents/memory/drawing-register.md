---
name: Drawing register product decisions
description: Durable product and data decisions for the architectural drawing management app.
---

The product is centered on a searchable architectural drawing library rather than generic project tasks. Drawings carry discipline, status, revision, project, sheet size, author, due date, and issue date; dashboard counts and activity are derived from that library.

Drawing files are stored in object storage behind first-party portal authentication; each drawing keeps an upload history recording the signed-in user's display name, timestamp, size, and type.

File uploads require the managed object-storage bucket environment to be provisioned before the API can generate signed upload URLs.

**Why:** The upload flow is otherwise valid, but a missing `PRIVATE_OBJECT_DIR` causes the request-url endpoint to fail before authentication and direct storage upload can complete.

**How to apply:** When setting up or restoring this app, provision managed object storage and verify its environment configuration before debugging the client upload flow.

Reviewers use the library primarily on mobile and leave named comments directly under each drawing; comments are chronological review records, not private notes.

The product is intentionally single-purpose: the drawing library remains the core workflow, while dashboard, notifications, chat, and settings are supporting navigation explicitly requested for coordination.

Drawings are organized by project in the library, with project headings, drawing counts, and a project filter; unassigned drawings remain grouped under “Unassigned.”

Projects are persisted as their own selectable records, and drawing creation/editing uses a project dropdown rather than free-text project names. User-facing drawing metadata is intentionally minimal: drawing name, discipline, status, and project; drawing numbers, revision, sheet size, author, due date, and notes are not part of the visible drawing workflow.

**Why:** The user clarified the domain after the initial generic project-management direction, so future work should preserve the drawing-register vocabulary and workflow.

**How to apply:** Extend drawing metadata and review/issue workflows before introducing unrelated project-management entities.

Assignments remain shared directory-based work records rather than permission rules: users are added to a persisted team directory, then selected when assigning drawings, while the signed-in portal profile is used when claiming work. The Assignments view groups drawings by assignee and derives visible progress from the existing drawing status workflow.

**Why:** The app now needs account-level identity for uploads, comments, assignment claims, and personal activity while retaining the shared roster and workload visibility.

**How to apply:** Use the authenticated portal profile for new user-attributed actions; preserve the directory picker for assigning work to others and keep status as the single source of truth for assignment-board progress.

My Feed combines active and completed drawings assigned to the signed-in user's display name with activity records whose actor is the signed-in portal user ID. New activity writes should continue recording that stable actor ID rather than parsing free-form messages.

**Why:** Display names are needed for the drawing UI and persisted assignment records, but stable local portal account IDs are required to reliably filter personal history.

**How to apply:** Keep the profile-name fallback order consistent across upload, comment, assignment, and feed surfaces; use actor IDs for “What I did” filtering.

Destructive drawing and account-management actions are administrator-only; regular users can edit drawing records, while the standalone Users directory is an administrator-only page. The shared roster endpoint remains available for assignment pickers.

**Why:** The portal needs collaborative editing without allowing regular users to remove shared records or browse the full directory page.

**How to apply:** Keep delete controls and delete APIs role-gated, redirect non-admins away from `/users`, and preserve only the minimum roster access needed by Assignments.

Reusable checklist templates are separate from project checklist instances; applying a template snapshots its items so later template edits do not rewrite active project work.

**Why:** Project teams need stable, auditable checklist progress even when the organization improves its standard template.

**How to apply:** Treat templates as reusable definitions and project checklists as independent working records with their own item completion and attribution.

Team chat is persisted as channels plus messages, with the signed-in local portal user recorded as the message author; the UI refreshes active conversations on a short polling interval.

**Why:** Drawing-review and site-coordination conversations need to survive reloads and be visible to other authenticated users without requiring a WebSocket service.

**How to apply:** Keep channel/message mutations behind portal authentication, use generated API hooks, and preserve immediate local updates plus periodic freshness for the active channel.

Every drawing mutation is mirrored into the persistent `drawing-reviews` chat channel, including metadata/status edits, assignments, uploads, comments, discipline changes, and deletion.

**Why:** The team needs one durable conversation stream that reflects the drawing library’s audit trail without requiring users to manually repost changes.

**How to apply:** Route server-side drawing activity through the shared activity helper so UI, API, and admin-originated mutations remain covered.

The navigation now includes operational views for projects, review queue, activity, deadlines, archive, notifications, reports, standards, issue register, files, team directory, and personal settings.

**Why:** The portal should support the complete drawing-review workflow without turning the existing single-purpose drawing library into an unrelated project-management system.

**How to apply:** Prefer live aggregations of drawings, projects, comments, uploads, checklists, users, and activity; keep settings local to the signed-in browser unless a server preference model is explicitly added.

My Feed is a distinct user-specific workspace and should remain a primary navigation destination even when shared Activity, Reports, or Team Directory tabs are consolidated or hidden.

**Why:** The user needs a personal view of assigned work and their own actions, which is not interchangeable with shared audit history or team-wide notifications.

**How to apply:** Preserve `/feed` and its sidebar entry during navigation simplification; remove only truly overlapping shared aggregation tabs.

Primary navigation should lead with Dashboard, Drawing Library, Projects, Assignments, Review Queue, Deadlines, and My Feed, followed by grouped Coordination, Reference, and Account sections.

**Why:** The daily workflow starts with overview and drawing work, then moves into review/coordination; settings and administrative tools should stay visually secondary.

**How to apply:** Preserve this order when adding or restoring sidebar destinations, and keep dashboard activity compact rather than using a wide alternating timeline in a narrow card.

Authenticated users can edit persisted projects and drawings, while projects and drawings use administrator-only recycle and restore; their supporting records remain recoverable, and drawing approval is also administrator-only and enforced server-side.

**Why:** Collaborative editing should not be blocked by the recycle-bin governance rule; project history must remain auditable and recoverable, and approval is a governance action that cannot depend on hiding a button in the client.

**How to apply:** Keep Edit available to authenticated users for persisted projects/drawings, keep deleted records out of active pickers, expose recycle/restore only to administrators, preserve associated drawing records, and guard every mutation path that sets an approved drawing status.

Recycle-bin restoration is access-aware rather than role-gated: authenticated users can restore shared records and their own personal notes, while administrators can restore every recyclable record, including other users' personal notes and portal users.

**Why:** Recovery should follow the same workspace access model as normal work, while administrators need a complete recovery path for organization-wide records.

**How to apply:** Keep the recycle-bin route authenticated, filter private personal-note entries by owner for regular users, and retain the administrator override for all restore types.

Assignments and comments should retain stable portal user IDs alongside display names; legacy name-based records remain readable, but new notification and ownership checks should prefer IDs.

**Why:** Display names can be duplicated or changed, and using them as identity caused incorrect assignment notifications and comment impersonation risks.

**How to apply:** Resolve new assignments to active users, notify by stored ID, derive comment authorship from the session, and allow comment edits/deletes only for the author or an administrator.

Drawing classifications are user-managed shared categories; any authenticated portal user may add, rename, or delete an unused category.

**Why:** The team needs to evolve drawing metadata collaboratively without routing routine category maintenance through administrator-only screens.

**How to apply:** Keep category CRUD authenticated but not admin-gated, prevent deleting categories still used by drawings, and update all user-facing language from discipline to category while preserving legacy storage compatibility.

Universal search is a signed-in app-shell command palette opened from the sidebar or Ctrl/Cmd+K, covering navigation and current drawings, projects, categories, people, and activity.

**Why:** The portal has many workflow destinations and record types, so users need a consistent way to jump directly to work without relying on sidebar scanning.

**How to apply:** Keep the palette available on every authenticated route, group results by type, respect role-aware destinations, and route record results directly to their detail or workspace page.

Chat message search is local to the selected channel and searches both message content and author names; the company brand is Design Sense Architects while Drawing Library remains the product/workspace name.

**Why:** Teams need quick retrieval within active conversations, and the company identity should be visible without replacing the established drawing-library product vocabulary.

**How to apply:** Keep chat search compatible with polling, clear it when switching channels, show author context for filtered results, and use Design Sense Architects for company-level branding and install metadata.

Personal notifications are persisted per portal user and are created for username mentions, drawing assignments, and assigned-drawing status changes; chat and comment mention delivery currently uses short polling rather than a WebSocket.

**Why:** The portal needs reliable unread/read state across reloads while preserving the existing simple deployment model.

**How to apply:** Keep notification records recipient-scoped, never cache private API responses in the service worker, and resolve mentions against active portal usernames while excluding the author.

The PWA service worker caches only the static application shell and same-origin non-API assets; authenticated API data remains network-only with an offline shell fallback.

**Why:** Installability and offline navigation are useful for site work, but caching private drawing data could expose stale or cross-user information.

**How to apply:** Expand static shell caching deliberately and keep `/api/` requests out of the cache strategy.

The portal uses a compact mobile header with a slide-out navigation drawer, while the full grouped sidebar remains the desktop navigation model; dense work surfaces should wrap controls instead of requiring horizontal scrolling.

**Why:** Reviewers use the drawing register on phones as well as desktops, and the full desktop sidebar consumed the entire mobile content area.

**How to apply:** Preserve the mobile drawer and desktop sidebar split when adding navigation, and use responsive gutters, stacked filters, wrapped action groups, and mobile channel selection for new pages.

Project summaries are navigation cards into the filtered Drawing Library, and assignment rows should separate drawing identity, progress/status, and ownership controls into distinct visual zones.

**Why:** Project cards that only display metrics feel broken when they have no next action, while mixed assignment controls make ownership work difficult to scan.

**How to apply:** Give project summaries an explicit route/action and keep assignment mutations contained beside, not mixed into, the drawing and progress information.

Projects have dedicated project workspaces separate from the project index; the workspace is the coordination home for project drawings, deadlines, checklists, directory contacts, and shared notes.

**Why:** A project card and filtered library do not provide enough context for teams coordinating a complete project.

**How to apply:** Keep `/projects` focused on finding projects, and route each project to its dedicated workspace before sending users to narrower drawing, directory, or checklist views.

Project health is derived from existing work records: overdue and unassigned drawings are attention flags, while checklist completion and in-review counts provide context; project activity is filtered from the shared drawing activity stream.

**Why:** The project page should surface coordination risk without introducing another project-status data model.

**How to apply:** Prefer computed health indicators and existing activity records before adding new project-specific persistence.

Mention autocomplete uses active portal usernames and inserts the exact `@username` token consumed by server-side notification matching in chat and drawing comments.

**Why:** Display names are useful in the interface but mention notifications resolve against stable login handles.

**How to apply:** Keep mention suggestions filtered to active users with usernames, and preserve the `@` plus username format when adding future mention-capable inputs.

Contacts are reusable firm-wide organizations/people with separate project associations carrying project-specific roles and notes.

**Why:** The same consultant, vendor, or contractor commonly supports multiple architectural projects, while their responsibility and scope can differ by project.

**How to apply:** Reuse shared contact records instead of duplicating vendors per project; query project directories through associations and keep the shared directory as the source of truth.

Project notes are shared per project, while personal notes are private to their author; administrators can view all personal notes without editing them.

**Why:** Teams need a collaborative project context area without exposing or allowing changes to individual working notes.

**How to apply:** Keep project-note access authenticated and author/admin-managed for edits and deletes; keep personal-note mutations owner-only and expose the admin overview as read-only.

All recyclable records use their own `deletedAt` timestamp for a 30-day retention window; active lists exclude them, restore access is visibility-aware, and stored upload objects are deleted only when their retention expires. Edit/recycle controls must mirror the API’s access rule, using stable portal user IDs for ownership rather than display names.

**Why:** Recovery must be reliable for both parent and child records, deleting an upload object at recycle time would make restoration incomplete, and display-name matching can expose actions to the wrong user when names are duplicated.

**How to apply:** Set `deletedAt` when recycling, calculate expiry only from that value, purge children before parents, keep object-storage deletion inside the expiry purge path, and render each action only when its matching authenticated user/role check passes.