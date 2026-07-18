# mg_hachimi community hotfix

Unofficial, temporary community maintenance for [GEEKiDoS/mg_hachimi](https://github.com/GEEKiDoS/mg_hachimi) and Workshop item `3500104891`.

The current test build restores compatibility after CS2 updates broke target movement and several UI transforms. It fixes descending targets, target orientation/height, song-list scrolling and overlap, monitor titles, judge-tip visibility, and leaked debug/save text.

This fork does not replace the original author. When the Workshop version is fixed upstream, users should uninstall this addon and return to the author version.

## Install

[Download the current test release](https://github.com/WSL043/mg_hachimi/releases/tag/community-hotfix-v0.1.0-test.1). Package status and support reports are tracked in [Issue #1](https://github.com/WSL043/mg_hachimi/issues/1).

1. Subscribe to Workshop item `3500104891` and let Steam finish downloading it.
2. Download the hotfix release and extract it.
3. Run `community-hotfix/Install.cmd`.
4. Choose **Fix only** or **Fix + preview songs**.
5. Run `community-hotfix/Launch.cmd`.

The installer reads the local Workshop VPKs, extracts them into a separate addon named `mg_hachimi_community_fix`, and overlays only the selected fixes. It does not modify the Workshop item or disable Steam integrity checks.

Run `community-hotfix/Uninstall.cmd` at any time to remove only the marked community addon. Run `community-hotfix/Diagnostics.cmd` before reporting a problem and attach the generated ZIP to an Issue in this fork.

The optional preview-song pack currently adds community submissions [#46](https://github.com/GEEKiDoS/mg_hachimi/issues/46) and [#49](https://github.com/GEEKiDoS/mg_hachimi/issues/49). It is separate from the base compatibility fix.

- [Detailed English instructions](community-hotfix/README.md)
- [中文说明](community-hotfix/README.zh-CN.md)

## Status

Current package: `0.1.0-test.1`

This is a test release. Keep the original Workshop subscription installed because the package deliberately does not redistribute the complete map.
