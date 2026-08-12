---
id: 57d7c5ba
type: fact
status: active
confidence: high
project: homelab
created: 2026-08-12
updated: 2026-08-12
tags:
  - docker
  - nginx
  - services
  - subdomains
  - mapping
---

# Docker Containers and Nginx Subdomain Mapping

Docker services and non-docker services mapped to Nginx reverse proxy subdomains (*.surtr.ir):

Active Docker Services:
1. crosswatch (ghcr.io/cenodude/crosswatch) -> crosswatch.surtr.ir (127.0.0.1:8787) [Healthy]
2. plex (lscr.io/linuxserver/plex) -> plex.surtr.ir (127.0.0.1:32400) [Healthy]
3. pyload-ng (lscr.io/linuxserver/pyload-ng) -> dl.surtr.ir (127.0.0.1:8001 / container 8000) [UNHEALTHY]
4. 9router (decolua/9router) -> 9router.surtr.ir (127.0.0.1:20129) [Healthy]
5. lychee & lychee-worker (ghcr.io/lycheeorg/lychee) -> photos.surtr.ir (127.0.0.1:8000) [Healthy]
6. jellyfin (jellyfin/jellyfin) -> jellyfin.surtr.ir (127.0.0.1:8096) [Healthy]
7. vaultwarden (vaultwarden/server) -> vault.surtr.ir (127.0.0.1:8888) [Healthy]
8. navidrome (deluan/navidrome) -> music.surtr.ir (127.0.0.1:4533) [Healthy]
9. forgejo (codeberg.org/forgejo/forgejo:16-rootless) -> git.surtr.ir (127.0.0.1:3000) [Healthy]
10. glance (glanceapp/glance) -> glance.surtr.ir (127.0.0.1:8090) [Healthy]
11. jellyplex_sync (luigi311/jellyplex-watched) -> Internal sync between Jellyfin & Plex [Up]

Non-Docker Services:
- copyparty (Python app managed by runsv) -> files.surtr.ir (127.0.0.1:3923) [Running]

Inactive/Disabled Services:
- chat.surtr.ir -> configured in Nginx (127.0.0.1:3080), container LibreChat currently located in /home/amadeus/Containers/disabled/LibreChat

## Related

- [[Homelab Architecture & Folder Layout]]
