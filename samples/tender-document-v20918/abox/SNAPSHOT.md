# A-box snapshot

| Field | Value |
|-------|-------|
| `snapshot.version` | `1.0.0` |
| `snapshot.artifactId` | `TENDER-23-CNCCC-FW-GK-1347-01` |
| `snapshot.contentHash` | `sha256:c43847c0ae5d7870d9ab3c0ad4e661f00fcb9e35589e8ac604c077dbce1496b3` |
| `snapshot.createdAt` | `2026-09-21T12:35:20-04:00` |
| `snapshot.updatedAt` | `2026-09-21T12:35:20-04:00` |

## How contentHash is computed

1. Take the business payload **without** the top-level `snapshot` object.
2. Canonicalize with `json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(',', ':'))`.
3. SHA-256 hex digest, prefixed with `sha256:`.

R-box `binding.abox.contentHash` **must** match this value.

## How to bump

1. Edit business fields in `abox/data.json` (and keep root `data.json` / `data.yaml` in sync).
2. Recompute `contentHash` and set `updatedAt`.
3. Bump `snapshot.version` (semver): patch for content edits, minor for schema-compatible structural adds, major for breaking shape changes.
4. Update `rbox/review.yaml` → `binding.abox.snapshotVersion` and `contentHash`.
5. Refresh `web/content/artifacts/tender/data.json` if it mirrors this sample.
