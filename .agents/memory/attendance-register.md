---
name: Attendance register rules
description: Durable rules for the employee attendance register.
---

Attendance is recorded as one explicit status per active portal employee per calendar date. The database uniqueness rule on employee and date makes repeated clicks and corrections safe; corrections replace the existing status rather than creating duplicate rows.

**Why:** A reliable office register must account for every active employee, distinguish “not recorded” from “absent,” and prevent duplicate or ambiguous entries.

**How to apply:** Keep employee attendance creation restricted to location-backed self-check-in, reject future dates, require a reason for absent/leave corrections, and leave employees unrecorded until they check in.

Employee self-check-in is the only attendance creation path: authenticated employees can submit one daily office or remote record with browser-provided latitude, longitude, accuracy, and capture time. Location is evidence only, not a geofence or access requirement, and administrators can correct the status only after a location-backed record exists, without overwriting the evidence.

**Why:** The product needs arrival evidence without excluding employees whose browser location is imprecise or outside the office.

**How to apply:** Keep self-check-in identity server-derived from the session, require an explicit office/remote choice, reject duplicate daily submissions, expose the evidence to administrators, and never treat coordinates as proof of office presence by themselves.

The employee self-check-in card remains visible after a successful check-in, and the admin register shows every active employee for the selected date, including self-check-in time and GPS evidence.

**Why:** A completed check-in should remain understandable to the employee, and administrators need a complete register rather than only rows that still need action.

**How to apply:** Keep the self-check-in card in its completed state instead of replacing it with an empty state, and render all active employees with explicit “not recorded” or self-check-in details.

The attendance register is readable by every signed-in employee; only administrators may correct attendance statuses.

**Why:** Employees need shared visibility into the daily register, while attendance corrections remain a controlled administrative action.

**How to apply:** Keep the register read endpoint and page available to authenticated users, keep GPS self-check-in identity-bound to the current session, and enforce administrator authorization on correction mutations.

Employee attendance actions are current-day-only: employees cannot select or submit past or future dates; administrators may review and correct prior register dates.

**Why:** Employees should only record their own arrival for the active workday, while administrators still need historical register access for legitimate corrections.

**How to apply:** Lock the employee date UI to today and enforce the same rule server-side on self-check-in requests; do not apply it to admin register review/correction routes.

Employees can view only their own attendance history by month; the full daily employee register is administrator-only.

**Why:** Attendance history is personal employee data, while administrators need the complete register for operational management.

**How to apply:** Use a session-bound monthly endpoint for employee history and keep the all-employee daily endpoint behind administrator authorization.