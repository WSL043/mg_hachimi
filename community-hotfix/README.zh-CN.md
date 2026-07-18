# mg_hachimi 社区兼容修复包（测试版）

这是原项目公开 Fork 中的非官方临时维护补丁，不代表原作者官方接管。它用于修复 CS2 更新后《哈基米：神人地图》的兼容问题，包括靶子运动、靶子朝向与露出高度、歌曲列表滚动与重叠文字、小电视歌名以及调试文字泄漏。

## 安全与回退方式

- 不改动 `Steam\steamapps\workshop\content\730\3500104891` 下的原始 Workshop 文件。
- 不关闭、不欺骗也不绕过 Steam 完整性验证。
- 安装器从玩家本机已经下载的 Workshop 项目只读提取资源到独立 addon `mg_hachimi_community_fix`，再覆盖最小修复文件。它不会创建或挂载根 `pak01.vpk`，因此不会触发 `Failed to load file (unexpected)!`。
- `Uninstall.cmd` 只会删除带有本补丁专用标记的独立 addon。卸载后从创意工坊正常启动，就是作者原版。
- 作者更新后，建议先运行 `Uninstall.cmd`，让 Steam 更新 Workshop，再测试作者版本；如果作者版本仍有问题，可以重新安装补丁。

## 使用条件

1. 已订阅并完整下载 Workshop 项目 `3500104891`。
2. Steam 和 CS2 已安装；首次测试建议先关闭 CS2。
3. 当前测试启动方式使用 CS2 Workshop Tools 的 `-tools -addon` 模式。

## 一键使用

- 双击 `Install.cmd`：显示安装选项。
- 双击 `Install-FixOnly.cmd`：只安装兼容修复（当前推荐）。
- 双击 `Install-FixPlusSongs.cmd`：兼容修复加抢先歌曲模块；当前包含上游 Issue #46 与 #49 的两首投稿。
- 双击 `Launch.cmd`：通过 Steam 挂载独立 addon 并启动地图。
- 启动时 Workshop Tools 的 Asset Browser 可能盖在游戏窗口上；看到它并不代表卡住，切回“Counter-Strike 2”窗口即可。首次提取后的第一次进图可能需要等待数秒。
- 双击 `Diagnostics.cmd`：检查安装、Workshop 原文件、补丁哈希和运行环境，并生成可直接上传到 Issue 的诊断 ZIP。
- 双击 `Uninstall.cmd`：移除独立 addon，回到 Workshop 作者版。

安装过程会额外占用约 253MB 磁盘空间，因为它会把本机 Workshop 分卷提取为独立 addon；抢先歌曲模块另外约 6.6MB。修复包下载本身不包含作者的完整地图资源。

如果安装、启动或游戏显示异常，请先运行 `Diagnostics.cmd`，然后在 `https://github.com/WSL043/mg_hachimi/issues` 新建 Issue，并附上它生成的 `diagnostics-bundle-*.zip`。

## 为什么不直接重传完整地图

仓库目前没有覆盖全部地图素材的明确许可证。复制玩家本机已订阅内容并应用最小修复，可以避免把原作者的完整音乐、模型和贴图重新打包发布，也能保留正常的 Steam Workshop 更新与校验流程。

## 抢先歌曲模块

Issue 中投稿、且尚未进入作者版本的新谱面会去重后加入可选抢先模块，保留投稿者、原 Issue、谱面与素材来源署名。抢先模块保持非官方、非商业、可单独安装；投稿者或相关权利人提出移除时会及时下架。基础“仅修复”版不包含新增歌曲。

当前抢先包 `2026.07.18.1` 包含：

- `A World I Built For You`：投稿者 `RTX9999ti`，上游 Issue #46。
- `Unwelcome ChiMi`：投稿者 `LYarHlXS`，谱师标注 `[LNBXS] HD(Hard)`，上游 Issue #49。

当前版本：`0.1.0-test.1`

## 上游回归与交接

- 所有修复保留原作者署名与 Git 历史，能独立提交的修改优先向上游发 PR。
- 原作者恢复维护并发布可用 Workshop 版本后，本补丁会停止扩展对应兼容修复，并引导玩家卸载、回到作者版本。
- 新谱面只进入可选模块，不改变“仅修复”版本；一旦上游正式收录，就从抢先模块去重或改为跟随上游。
