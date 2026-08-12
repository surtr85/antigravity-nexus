---
id: 9788fa14
type: problem
status: active
confidence: high
project: homelab
created: 2026-08-12
updated: 2026-08-12
tags:
  - pyload
  - docker
  - unhealthy
  - healthcheck
  - bug
---

# Pyload-ng Healthcheck Failure Reason

The container pyload-ng (lscr.io/linuxserver/pyload-ng:latest) is currently reporting UNHEALTHY status.
Root cause: Docker health check runs `wget` targeting `localhost:8000`, which resolves to IPv6 address `[::1]:8000` inside the container, returning 'Connection refused'.
Fix/Note: May need updating healthcheck to `127.0.0.1:8000` or configuring pyload to listen on IPv6/dual stack.

## Related

- [[Docker Containers and Nginx Subdomain Mapping]]
