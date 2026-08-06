---
name: Chat room membership
description: Membership and file-sharing rules for team chat channels.
---

Chat channels have persistent per-user membership. Users can create, join, and leave channels; channel creators remain members and cannot leave their own channel. Posting text or files requires membership. Chat files are uploaded to private object storage and represented as attachment metadata on the message.

**Why:** The chat experience should behave like a lightweight Discord-style room system without exposing uploaded work files publicly or allowing users who left a channel to continue posting.

**How to apply:** Keep membership checks server-side for every message create request. Use the existing private object upload flow for chat files, enforce the 25 MB limit, and render attachments through authenticated `/api/storage/objects/...` URLs.