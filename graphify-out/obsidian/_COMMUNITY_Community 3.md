---
type: community
cohesion: 0.22
members: 9
---

# Community 3

**Cohesion:** 0.22 - loosely connected
**Members:** 9 nodes

## Members
- [[Checks if a user is authorized to interact with Antigravity.]] - rationale - matrix/matrix_antigravity_bridge.py
- [[Downloads & decrypts Matrix media from homeserver.]] - rationale - matrix/matrix_antigravity_bridge.py
- [[Handles SAS Emoji and Cross-Signing Key Verification from authorized users.]] - rationale - matrix/matrix_antigravity_bridge.py
- [[Handles image and encrypted image upload events.]] - rationale - matrix/matrix_antigravity_bridge.py
- [[custom_setup_callbacks()]] - code - matrix/matrix_antigravity_bridge.py
- [[download_matrix_media()]] - code - matrix/matrix_antigravity_bridge.py
- [[image_handler()]] - code - matrix/matrix_antigravity_bridge.py
- [[is_user_allowed()]] - code - matrix/matrix_antigravity_bridge.py
- [[to_device_callback()]] - code - matrix/matrix_antigravity_bridge.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_3
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_Community 0]]
- 2 edges to [[_COMMUNITY_Community 6]]
- 2 edges to [[_COMMUNITY_Community 5]]

## Top bridge nodes
- [[image_handler()]] - degree 6, connects to 3 communities
- [[is_user_allowed()]] - degree 6, connects to 3 communities
- [[to_device_callback()]] - degree 4, connects to 1 community
- [[download_matrix_media()]] - degree 3, connects to 1 community
- [[custom_setup_callbacks()]] - degree 2, connects to 1 community