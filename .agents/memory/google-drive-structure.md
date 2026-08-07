---
name: Google Drive drawing structure
description: Durable Google Drive organization and recycle-bin behavior for drawing files.
---

Google Drive uses one persistent `Drawing Library` root folder. Active drawing files belong under `Project / Category / Drawing`; gallery media belongs under `Project / Album`; recycled files move under the root-level `Deleted Drawings / Project / Category / Drawing` branch. Missing or blank categories use `Uncategorized`.

**Why:** A single stable root prevents duplicate libraries across OAuth reconnects, while a predictable hierarchy keeps project files discoverable, keeps gallery evidence grouped by album, and preserves deleted drawing evidence during the retention period. Category changes must not leave files in their former category.

**How to apply:** Reuse and validate the saved root folder ID before Drive operations, ensure the deleted branch exists, create gallery folders lazily as `Project / Album`, move files when a drawing or managed category changes, keep uncategorized files under `Uncategorized`, move files on recycle/restore, and permanently delete Drive files only when the recycle retention expires.