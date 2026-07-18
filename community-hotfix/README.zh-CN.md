# mg_hachimi 社区兼容修复包（测试版）

这是面向 Workshop 项目 `3500104891` 的非官方、临时玩家维护包。它用于修复 CS2 更新后的兼容问题，不要求玩家再订阅一份重复地图，也不代表原作者官方接管。

## 修复内容

- AnimGraph2 更新后靶子重新沿轨道下降。
- 靶子保持直立、完整露出，并且判定与可见模型对齐。
- 歌单滚动位置、显示行和射击判定区重新对齐，不再叠加谱师或调试小字。
- 小电视显示干净的歌曲名。
- 判定提示改为明确启用与禁用，避免显示异常。

## 直接修补 Workshop 的方式

- 安装器只接受清单中精确匹配的作者版 Workshop VPK，不会对未知版本盲目打补丁。
- 修改前会把完整作者版备份到 `%LOCALAPPDATA%\mg_hachimi_community_fix\backups`，并逐个校验长度和 SHA-256。
- 安装器从已验证备份重建分卷 VPK，追加所选修复资源；完整输出与清单一致后，只替换哈希确实变化的文件。
- `Uninstall.cmd` 会恢复已验证的作者版。如果 Steam 已经下载了未知或更新后的版本，卸载器不会用旧备份覆盖它。
- 本包不会关闭或绕过 Steam 完整性机制。Workshop 更新、Steam 验证完整性、退订重订都可能恢复作者文件。

正常情况下只需安装一次。每次运行 `Launch.cmd` 只进行快速哈希检查，不会重复写入 242MB 文件；如果检测到 Steam 恰好恢复为本包支持的作者版，就只在这一次自动补回上次选择的版本。遇到未知版本时会停止并要求生成诊断，不会强行覆盖。

重复运行安装器并选择同一个版本也不会重打：它会识别完整补丁哈希，跳过 VPK 重建和文件写入。

## 一键命令

- `Install.cmd`：交互选择“只修复”或“修复＋抢先歌曲”。
- `Install-FixOnly.cmd`：只安装兼容修复。
- `Install-FixPlusSongs.cmd`：兼容修复加可选抢先歌曲包。
- `Launch.cmd`：选择国服或国际服，校验补丁并在普通 CS2 中载入原创意工坊地图。
- `Launch-PerfectWorld.cmd`：直接以 Perfect World／国服模式启动。
- `Launch-Worldwide.cmd`：直接以 Worldwide／Steam 国际服模式启动。
- `Diagnostics.cmd`：检查包体、Workshop、备份、状态和运行环境，并生成可上传到 Issue 的 ZIP。
- `Uninstall.cmd`：恢复已验证的 Workshop 作者版。

启动器不使用 `-tools` 和 `-addon`，只会出现普通 Counter-Strike 2 游戏窗口。由于本地 Workshop 文件经过修改，启动器会使用 `-insecure`；不要从该次会话进入匹配。需要匹配时先关闭 CS2，再从 Steam 正常启动。

永久额外占用约为：作者版回退备份 242MB，加上 Workshop 中“只修复”约 18MB或“修复＋歌曲”约 25MB 的增量。安装时的临时构建目录会自动清理；下载包本身不重新分发作者的完整地图。

## 抢先歌曲包

当前可选包 `2026.07.18.1` 包含：

- **A World I Built For You**：投稿者 `RTX9999ti`，[上游 Issue #46](https://github.com/GEEKiDoS/mg_hachimi/issues/46)。
- **Unwelcome ChiMi**：投稿者 `LYarHlXS`，谱师标注 `[LNBXS] HD(Hard)`，[上游 Issue #49](https://github.com/GEEKiDoS/mg_hachimi/issues/49)。

如果投稿以后进入作者版或后续维护版，会从抢先包中去重，避免重复歌曲。

## 问题反馈

先运行 `Diagnostics.cmd`，再到 `https://github.com/WSL043/mg_hachimi/issues` 新建 Issue，描述看见的问题和触发前的操作，并附上生成的 `diagnostics-bundle-*.zip`。诊断包只含日志、哈希和环境信息，不包含完整地图。

## 与作者版本的关系

原作者已经说明不再继续更新当前 CS2 地图，明确允许发布 Workshop fork，并正在制作一个带 Workshop 功能的免费独立 Steam 游戏。本包仍明确标记为非官方玩家维护；如果以后出现作者维护版本，运行 `Uninstall.cmd` 即可恢复并回归作者版。

当前测试版本：`0.1.0-test.2`
