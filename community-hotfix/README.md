# Community compatibility hotfix

This is an unofficial test package for Workshop item `3500104891`. It repairs the current CS2 compatibility regressions while keeping the author's Workshop files untouched.

## What it fixes

- Notes/targets descend again after the AnimGraph2 update.
- Targets are upright, fully visible, and remain shootable.
- The song list scrolls with aligned hit areas and no overlapping charter/debug text.
- The small monitor shows a clean song title.
- Judge tips use explicit enable/disable behavior.

## Safe install and rollback

- The installer never edits `steamapps/workshop/content/730/3500104891`.
- It never disables or bypasses Steam integrity verification.
- It extracts the already-downloaded Workshop VPKs read-only into the independent addon `mg_hachimi_community_fix`, then overlays the small hotfix payload.
- It does not create a root `pak01.vpk`; this avoids the `Failed to load file (unexpected)!` startup failure.
- The uninstaller refuses unknown directories and removes only an addon containing this package's marker.

## One-click commands

- `Install.cmd`: choose an edition interactively.
- `Install-FixOnly.cmd`: compatibility fixes only (recommended baseline).
- `Install-FixPlusSongs.cmd`: fixes plus the optional preview-song overlay.
- `Launch.cmd`: launch the independent addon through Steam.
- `Diagnostics.cmd`: validate hashes and environment, then create a support ZIP.
- `Uninstall.cmd`: remove the independent addon and return to the Workshop version.

Workshop Tools may leave Asset Browser above the game window during startup. If that happens, switch to the **Counter-Strike 2** window. The first launch can take several seconds.

The extracted addon uses about 253 MB. The preview overlay adds about 6.6 MB. The release package itself does not contain the original complete Workshop map.

## Preview songs

The `2026.07.18.1` preview pack adds:

- **A World I Built For You** — chart submitted by `RTX9999ti`, [upstream Issue #46](https://github.com/GEEKiDoS/mg_hachimi/issues/46).
- **Unwelcome ChiMi** — chart submitted by `LYarHlXS` (`[LNBXS] HD(Hard)`), [upstream Issue #49](https://github.com/GEEKiDoS/mg_hachimi/issues/49).

The installer keeps this overlay optional. If either song is accepted upstream, the preview pack will be de-duplicated against the new Workshop version.

## Problem reports

Run `Diagnostics.cmd`, open an Issue in this fork, describe the visible problem and exact action that triggered it, and attach `diagnostics-bundle-*.zip`. The bundle contains hashes and environment details, not the full Workshop content.

## Upstream handoff

Fixes remain attributable to the original project and are suitable for an upstream PR where practical. Once the author publishes a working Workshop update, this package will direct users to uninstall and return to upstream.

[中文说明](README.zh-CN.md)
