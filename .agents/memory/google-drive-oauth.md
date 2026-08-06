---
name: Google Drive OAuth secret
description: Required format for the Google OAuth client secret used by the Drawing Library Drive integration.
---

`GOOGLE_OAUTH_CLIENT_JSON` must contain the complete downloaded Google OAuth web-client JSON object. The integration reads the nested `web` configuration and requires `client_id`, `client_secret`, `auth_uri`, and `token_uri`; a Google Cloud console URL or file path is not valid.

**Why:** The secure secret form can accept a URL-like value, but the OAuth client parser needs the JSON configuration itself to generate the authorization redirect.

**How to apply:** When setting up or repairing Drive OAuth, replace the secret through the secure secret flow, restart the API workflow, and verify that the authenticated OAuth start route returns a redirect to `accounts.google.com`.