---
name: Admin daily activity register
description: Administrator view for reviewing portal work by calendar day and user.
---

The Admin screen uses the existing drawing activity audit trail to show a selected calendar day, grouped by portal user, with uploads called out separately from other drawing actions.

**Why:** Administrators need a single daily accountability view rather than scanning an unfiltered global activity feed.

**How to apply:** Keep the date filter server-side, preserve empty user sections for the selected day, and map actor IDs through the active user directory for readable names.