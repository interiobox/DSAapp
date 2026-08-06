---
name: MySQL Aiven connection
description: Environment-specific MySQL and Aiven TLS constraints for this project.
---

The Aiven MySQL endpoint requires TLS but presents a self-signed certificate chain in this environment, so the Node MySQL pool must keep SSL enabled while setting `rejectUnauthorized: false`.

**Why:** Strict certificate validation prevented the API from connecting even though the schema push succeeded.

**How to apply:** Preserve encrypted transport for this endpoint and do not put the connection string or password in source files; use the `MYSQL_URL` secret.