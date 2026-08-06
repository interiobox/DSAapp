---
name: Chat enhancements
description: Durable behavior for enhanced team chat and notification workflows.
---

Chat unread state is persisted per user and channel through a last-read timestamp; opening a channel marks it read, while channel lists expose unread counts excluding the signed-in user's own messages.

**Why:** Teams need reliable unread indicators across reloads without introducing a WebSocket service.

**How to apply:** Keep polling as the realtime mechanism, update read state when a room becomes active, and preserve membership checks for channel search and direct-room visibility.

Direct conversations are represented as participant-scoped rooms and are visible only to their members; message actions support replies, reactions, author/admin edit and soft-delete controls.

**Why:** The existing channel model can provide private one-to-one rooms while retaining one message and notification pipeline.

**How to apply:** Keep direct-room identity deterministic for each participant pair, never expose direct rooms in the public channel list, and keep moderation permissions enforced server-side.

Notifications are grouped and filterable by chat, mentions, unread, and other workflow events; per-item read/unread toggles coexist with mark-all-read, and polling alerts only announce newly observed unread records.

**Why:** Chat activity should be actionable without making the notification center noisy or repeatedly alerting for old records.

**How to apply:** Use persisted notification records as the source of truth, keep chat links channel-specific, and deduplicate in-app alerts by notification ID during polling.