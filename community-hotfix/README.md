# Community compatibility hotfix

This is an unofficial, temporary player-maintained package for Workshop item `3500104891`. It repairs current CS2 compatibility regressions without requiring users to subscribe to a second copy of the map.

## What it fixes

- Notes/targets descend again after the AnimGraph2 update.
- Targets are upright, fully visible, and remain shootable.
- The song list scrolls with aligned hit areas and no overlapping charter/debug text.
- The small monitor shows a clean song title.
- Judge tips use explicit enable/disable behavior.

## How the direct Workshop patch works

- The installer accepts only the exact supported author Workshop VPK hashes.
- It makes and verifies a complete author-version backup under `%LOCALAPPDATA%\mg_hachimi_community_fix\backups` before changing anything.
- It appends the selected overlay to a rebuilt copy of the split Workshop VPKs, verifies the complete output against the package manifest, and then replaces only files whose hashes changed.
- `Uninstall.cmd` restores the verified author VPKs. If Steam has installed an unknown/newer version, the uninstaller refuses to overwrite it.
- Steam integrity checking is not disabled or bypassed. Steam may restore the author files after an update, verification, or unsubscribe/resubscribe.

You normally install once. Every `Launch.cmd` run performs a quick hash check. If Steam restored the exact supported author version, the launcher automatically reapplies your previous edition once; if the files are an unknown version, it stops and asks for diagnostics instead of overwriting them.

Running the installer again with the same edition is also safe: it recognizes the complete patched hash set and skips rebuilding or rewriting the Workshop files.

## One-click commands

- `Install.cmd`: choose an edition interactively.
- `Install-FixOnly.cmd`: compatibility fixes only.
- `Install-FixPlusSongs.cmd`: fixes plus the optional preview-song overlay.
- `Launch.cmd`: choose Perfect World or Worldwide, verify the patch, and load the original Workshop map in normal CS2.
- `Launch-PerfectWorld.cmd`: launch directly in Perfect World/China mode.
- `Launch-Worldwide.cmd`: launch directly in Worldwide/Steam mode.
- `Diagnostics.cmd`: validate package, Workshop, backup, state, and environment; then create a support ZIP.
- `Uninstall.cmd`: restore the verified author Workshop version.

The launchers do not use `-tools` or `-addon`; only the normal Counter-Strike 2 window should appear. They do use `-insecure` because this is a locally modified Workshop item. Do not enter matchmaking from that session; close CS2 and start it normally before matchmaking.

Permanent extra disk use is approximately 242 MB for the rollback backup plus 18 MB for FixOnly or 25 MB for FixPlusSongs inside the patched Workshop item. Temporary build space is released after installation. The downloadable package does not redistribute the author's complete map.

## Preview songs

The optional `2026.07.18.1` preview pack adds:

- **A World I Built For You** — chart submitted by `RTX9999ti`, [upstream Issue #46](https://github.com/GEEKiDoS/mg_hachimi/issues/46).
- **Unwelcome ChiMi** — chart submitted by `LYarHlXS` (`[LNBXS] HD(Hard)`), [upstream Issue #49](https://github.com/GEEKiDoS/mg_hachimi/issues/49).

If a submission later enters an author or maintained Workshop build, it will be removed from the preview overlay to avoid duplicates.

## Problem reports

Run `Diagnostics.cmd`, open an Issue at `https://github.com/WSL043/mg_hachimi/issues`, describe the visible problem and the exact action that triggered it, and attach `diagnostics-bundle-*.zip`. The bundle contains logs, hashes, and environment details, not the complete map.

## Upstream handoff

The original author has said that the current CS2 map will no longer be updated and explicitly allowed a Workshop fork, while work continues on a separate free Steam game. This package remains clearly unofficial. If an author-maintained version returns, users can run `Uninstall.cmd` and go back to it immediately.

[中文说明](README.zh-CN.md)
