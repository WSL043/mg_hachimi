# mg_hachimi 社区兼容修复包

这是面向 Workshop 项目 `3500104891` 的非官方兼容修复包。它用于修复 CS2 更新后的兼容问题，不要求玩家再订阅一份重复地图。

## 修复内容

- AnimGraph2 更新后靶子重新沿轨道下降。
- 靶子保持直立、完整露出，并且判定与可见模型对齐。
- 歌单滚动位置、显示行和射击判定区重新对齐，不再叠加谱师或调试小字。
- 小电视显示干净的歌曲名。
- 判定提示改为明确启用与禁用，避免显示异常。

## 直接修补 Workshop 的方式

- 安装器只接受清单中精确匹配的原始 Workshop VPK，不会对未知版本盲目打补丁。
- 修改前会把完整原始文件备份到 `%LOCALAPPDATA%\mg_hachimi_community_fix\backups`，并逐个校验长度和 SHA-256。
- 安装器从已验证备份重建分卷 VPK，追加所选修复资源；完整输出与清单一致后，只替换哈希确实变化的文件。
- `Uninstall.cmd` 会恢复已验证的原始文件。如果 Steam 已经下载了未知或更新后的版本，卸载器不会用旧备份覆盖它。
- 本包不会关闭或绕过 Steam 完整性机制。Workshop 更新、Steam 验证完整性、退订重订都可能恢复原始文件。

正常情况下只需安装一次。每次运行 `Launch.cmd` 只进行快速哈希检查，不会重复写入 242 MB 文件；如果检测到 Steam 恰好恢复为本包支持的原始文件，就只在这一次自动补回上次选择的版本。遇到未知版本时会停止并要求生成诊断，不会强行覆盖。

重复运行安装器并选择同一个版本也不会重打：它会识别完整补丁哈希，跳过 VPK 重建和文件写入。

## 一键命令

- `Install.cmd`：选择“只修复”或“修复＋抢先歌曲”。
- `Launch.cmd`：选择国服或国际服，校验补丁并在普通 CS2 中载入创意工坊地图。
- `Diagnostics.cmd`：检查包体、Workshop、备份、状态和运行环境，并生成可上传到 Issue 的 ZIP。
- `Uninstall.cmd`：恢复已验证的原始 Workshop 文件。

启动器不使用 `-tools`、`-addon` 或 `-insecure`，启动的是普通 Counter-Strike 2 进程。修补后的地图已经验证可以在不禁用安全匹配的情况下正常载入。

永久额外占用约为：回退备份 242 MB，加上 Workshop 中“只修复”约 18 MB 或“修复＋歌曲”约 21 MB 的增量。安装时的临时构建目录会自动清理；下载包本身只包含补丁资源和安装器。

## 抢先歌曲包

可选的抢先歌曲版包含：

- **Unwelcome ChiMi**：投稿者 `LYarHlXS`，谱师标注 `[LNBXS] HD(Hard)`，[社区投稿 #49](https://github.com/GEEKiDoS/mg_hachimi/issues/49)。

## 问题反馈

先运行 `Diagnostics.cmd`，再到 `https://github.com/WSL043/mg_hachimi/issues` 新建 Issue，描述看见的问题和触发前的操作，并附上生成的 `diagnostics-bundle-*.zip`。诊断包只含日志、哈希和环境信息，不包含完整地图。
