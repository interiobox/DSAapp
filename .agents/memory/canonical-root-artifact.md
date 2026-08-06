---
name: Canonical root artifact
description: Which workspace artifact owns the user-facing root preview for the Drawing Library.
---

The complete Drawing Library frontend is the `project-hub` artifact and must exclusively own the `/` preview path. Do not create a second web artifact at `/`; it can shadow the real app or make routing ambiguous.

**Why:** A temporary scaffold artifact at the same root path caused the preview registry and workflows to conflict, while the existing project-hub implementation was already the complete product.

**How to apply:** Add Drawing Library features to `artifacts/project-hub`, keep its artifact title/description aligned with the product, and give any genuinely separate artifact a unique preview path.