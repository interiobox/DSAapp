---
name: IST display timezone
description: User-facing timezone convention for logged events.
---

All user-facing event timestamps use Asia/Kolkata (IST), including drawing activity, uploads, comments, chat messages, admin activity, notifications, and attendance check-in times. Date-only fields remain calendar dates and are not converted as timestamps.

**Why:** The team records and reviews work in India Standard Time, so browser or server timezone differences must not change the displayed event time or attendance day.

**How to apply:** Use the shared IST date/time helpers for event timestamps and check-in times; use calendar-date formatting for due dates, attendance dates, and other date-only values.