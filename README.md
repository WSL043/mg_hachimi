# mg_hachimi community hotfix

Unofficial, temporary player maintenance for [GEEKiDoS/mg_hachimi](https://github.com/GEEKiDoS/mg_hachimi) and Workshop item `3500104891`.

The current test build restores target movement/orientation, song-list scrolling and hit-area alignment, monitor titles, judge-tip visibility, and removes leaked debug/save text. An optional overlay adds the community submissions from upstream Issues [#46](https://github.com/GEEKiDoS/mg_hachimi/issues/46) and [#49](https://github.com/GEEKiDoS/mg_hachimi/issues/49).

## Install

The broken `0.1.0-test.1` standalone-addon release has been withdrawn. Use `0.1.0-test.2` or newer only.

[Download `0.1.0-test.2`](https://github.com/WSL043/mg_hachimi/releases/tag/community-hotfix-v0.1.0-test.2) · [Direct ZIP](https://github.com/WSL043/mg_hachimi/releases/download/community-hotfix-v0.1.0-test.2/mg_hachimi-community-hotfix-0.1.0-test.2.zip)

1. Subscribe to Workshop item `3500104891` and let Steam finish downloading it.
2. Download and extract the current hotfix release.
3. Run `community-hotfix/Install.cmd` and choose **Fix only** or **Fix + preview songs**.
4. Run `community-hotfix/Launch.cmd`, then choose Perfect World or Worldwide.

The installer makes a verified rollback backup and directly patches the already-subscribed Workshop VPKs, so no second map subscription or Workshop Tools mode is needed. It refuses unknown map versions. `Uninstall.cmd` restores the verified author files; `Diagnostics.cmd` creates a support ZIP for [Issue reports](https://github.com/WSL043/mg_hachimi/issues).

Installation is normally one-time. The launcher checks hashes on each run and only reapplies the selected edition if Steam restored the exact supported author version.

- [Detailed English instructions](community-hotfix/README.md)
- [中文说明](community-hotfix/README.zh-CN.md)

## Status

Current package: `0.1.0-test.2`

The original author has explicitly allowed a Workshop fork. This direct patch is the current low-friction option; a separate Workshop publication may follow after broader testing.
