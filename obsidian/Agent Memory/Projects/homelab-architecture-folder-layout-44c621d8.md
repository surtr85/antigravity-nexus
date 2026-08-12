---
id: 44c621d8
type: project
status: active
confidence: high
project: homelab
created: 2026-08-12
updated: 2026-08-12
tags:
  - docker
  - nginx
  - architecture
  - homelab
---

# Homelab Architecture & Folder Layout

Homelab setup overview:
- Host OS process management: runsv / runit.
- Reverse Proxy: Non-Docker Nginx running natively on host system. Configs location: /etc/nginx/conf.d/
- Container management layout: /home/amadeus/Containers/ (enabled/, disabled/, images/)
- Domain zone: *.surtr.ir with SSL certificates in /etc/nginx/certs/
