# Community compatibility hotfix

This is an unofficial compatibility package for Workshop item `3500104891`. It repairs current CS2 regressions without requiring users to subscribe to a second copy of the map.

## What it fixes

- Notes/targets descend again after the AnimGraph2 update.
- Targets are upright, fully visible, and remain shootable.
- The song list scrolls with aligned hit areas and no overlapping charter/debug text.
- The small monitor shows a clean song title.
- Judge tips use explicit enable/disable behavior.

## How the direct Workshop patch works

- The installer accepts only the exact supported original Workshop VPK hashes.
- It makes and verifies a complete rollback backup under `%LOCALAPPDATA%\mg_hachimi_community_fix\backups` before changing anything.
- It appends the selected overlay to a rebuilt copy of the split Workshop VPKs, verifies the complete output against the package manifest, and then replaces only files whose hashes changed.
- `Uninstall.cmd` restores the verified original VPKs. If Steam has installed an unknown/newer version, the uninstaller refuses to overwrite it.
- Steam integrity checking is not disabled or bypassed. Steam may restore the original files after an update, verification, or unsubscribe/resubscribe.

You normally install once. Every `Launch.cmd` run performs a quick hash check. If Steam restored the exact supported original files, the launcher automatically reapplies your previous edition once; if the files are an unknown version, it stops and asks for diagnostics instead of overwriting them.

Running the installer again with the same edition is also safe: it recognizes the complete patched hash set and skips rebuilding or rewriting the Workshop files.

## One-click commands

- `Install.cmd`: choose **Fix only** or **Fix + preview song**.
- `Launch.cmd`: choose Perfect World or Worldwide, verify the patch, and load the Workshop map in normal CS2.
- `Diagnostics.cmd`: validate package, Workshop, backup, state, and environment; then create a support ZIP.
- `Uninstall.cmd`: restore the verified original Workshop files.

The launchers do not use `-tools`, `-addon`, or `-insecure`; they start a normal Counter-Strike 2 process. The patched map was verified to load without disabling secure matchmaking.

Permanent extra disk use is approximately 242 MB for the rollback backup plus 18 MB for FixOnly or 21 MB for FixPlusSongs inside the patched Workshop item. Temporary build space is released after installation. The downloadable package contains only the patch resources and installer.

## Preview songs

The optional preview-song edition adds:

- **Unwelcome ChiMi** — chart submitted by `LYarHlXS` (`[LNBXS] HD(Hard)`), [community submission #49](https://github.com/GEEKiDoS/mg_hachimi/issues/49).

## Problem reports

Run `Diagnostics.cmd`, open an Issue at `https://github.com/WSL043/mg_hachimi/issues`, describe the visible problem and the exact action that triggered it, and attach `diagnostics-bundle-*.zip`. The bundle contains logs, hashes, and environment details, not the complete map.

[中文说明](README.zh-CN.md)
