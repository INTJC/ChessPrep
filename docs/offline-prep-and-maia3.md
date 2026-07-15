# 离线备战数据库与 Maia-3 配置指南

本文面向从源码运行 ChessPrep Lab 的用户，说明如何制作离线对局数据库、使用备战检索，以及如何在 Maia-3 23M 和 79M 之间切换。

所有命令都在仓库根目录运行。原始 PGN、生成的数据库、Python 环境和模型缓存体积较大，已由 `.gitignore` 排除，不应提交到 Git。

## 1. 目录与依赖

建议准备：

- Node.js 20 或更新版本。
- 足够的磁盘空间。完整公开 PGN 与生成数据库可能占用数 GB。
- Git 和一个可创建 Python 3.11 环境的 Conda。只做开局、残局和备战检索时不需要 Maia。
- Stockfish。Maia 拟人档位使用 Stockfish 过滤明显坏棋；只有 Maia 而没有 Stockfish，不是项目的完整拟人训练配置。
- 解压 `.zip` 的 `tar`。下载 `.zst` 来源时还需要 PATH 中可用的 `zstd`。

默认数据位置：

```text
data/endgame-expansion/sources/raw/lichess-broadcast-db/
data/endgame-expansion/sources/raw/twic/
data/endgame-expansion/sources/raw/pgnmentor/
data/player-prep/offline-games.json
data/player-prep/offline-games.bin
data/player-prep/offline-games.games-*.json
data/player-prep/opening-trees/
```

只应下载和使用公开、允许本地处理的棋谱。私密研讨或没有再分发权限的数据不要放进公开安装包。

## 2. 下载公开 PGN

先预览计划，不写入文件：

```powershell
node tools\player-prep\public-source-downloader.mjs plan
```

默认计划包括：

- Lichess Broadcast 的公开月度数据库。
- The Week in Chess（TWIC）周刊 PGN。
- PGN Mentor 的公开棋手文件。

计划可能很大。首次验证建议限制数量：

```powershell
node tools\player-prep\public-source-downloader.mjs download --limit 5
```

确认下载、解压和磁盘位置正常后，再运行完整下载：

```powershell
node tools\player-prep\public-source-downloader.mjs download
```

不需要 PGN Mentor 时：

```powershell
node tools\player-prep\public-source-downloader.mjs download --no-pgnmentor
```

下载器会跳过目标位置已经存在的来源，并把结果记录在：

```text
data/endgame-expansion/sources/raw/public-source-downloads.json
```

你也可以把自行取得的 `.pgn` 放在 `data/endgame-expansion/sources/raw/` 下。数据库构建器会递归扫描该目录。

## 3. 首次构建离线数据库

先检查发现了多少 PGN，以及数据库是否已经存在：

```powershell
node tools\player-prep\database-builder.mjs status
```

首次完整构建：

```powershell
node tools\player-prep\database-builder.mjs build
```

默认筛选规则来自 `database-builder.mjs`：

- 对局年份不早于 2010。
- 白方和黑方 Elo 都必须严格高于 2000；等于 2000 的对局会被过滤。
- 相同对局会在不同来源之间去重。

`build` 会先重置现有的 `offline-games*`，再从当前发现的全部 PGN 完整重建。网页中的“构建/更新数据库”按钮调用相同的完整重建流程。已有大型数据库时，应先停止服务器并把 `data/player-prep/offline-games*` 复制到仓库外备份。

## 4. 增量更新与维护

下载新来源后，日常更新优先使用：

```powershell
node tools\player-prep\database-builder.mjs append-missing
```

该命令读取现有清单，只追加尚未导入的来源，不重置数据库。导入状态按来源文件名识别：如果用新内容替换了同名 PGN，`append-missing` 会认为它已经导入。此时应给新文件换名，或在备份后执行完整 `build`。

大型更新可以分批执行：

```powershell
$env:APPEND_MISSING_LIMIT=10
node tools\player-prep\database-builder.mjs append-missing
Remove-Item Env:APPEND_MISSING_LIMIT
```

显式重新去重：

```powershell
node tools\player-prep\database-builder.mjs dedupe
```

再次检查状态：

```powershell
node tools\player-prep\database-builder.mjs status
```

构建被中断时，不要直接假定半写入文件完整可用。先检查 `status`；若清单或二进制存储无法读取，恢复备份后重试。下载失败可以直接重跑，已经存在的来源会被跳过。

## 5. 使用备战检索

启动本地服务：

```powershell
$env:PORT=8788
node server.mjs
```

打开 `http://localhost:8788`，进入“备战模式”：

1. 确认页面显示本地数据库已经构建，并核对可检索对局数。
2. 输入对手姓名。中国棋手可以使用中文名或拼音索引支持的名称。
3. 选择你在目标对局中准备执白还是执黑。
4. 在棋盘或候选列表中走到要分析的具体开局分支。
5. 点击“生成备战报告”。

报告会在当前分支下汇总对手的常见着法、样本数、胜率、和局率和得分率，并把对手实战分支与当前准备库进行对照。样本很少时不要把百分比当成稳定结论；优先处理样本多、对手重复使用且你的准备覆盖不足的分支。

按棋手生成的开局树缓存在 `data/player-prep/opening-trees/`。原始库更新后，应用会按数据库时间戳重新构建需要的缓存。

## 6. 拟人训练怎样工作

- `拟人 2200 / 2400 / 2600`：Maia-3 生成更接近人类分布的候选着法，开局先验可优先实战常见且安全的选择，Stockfish 再按档位阈值过滤明显掉分的候选。
- `近似 2700`：使用 Stockfish 多候选限强，不使用 Maia。
- 界面 Elo 是训练档位，不是 FIDE 等级分或官方强度认证。

切换 23M/79M 只改变 Maia 候选模型，不改变 `engine-profiles.mjs` 中已有的采样、思考时间和 Stockfish 质量阈值。23M 更省内存、CPU 启动更快；79M 的模型准确率更高，但检查点和推理开销更大。

## 7. 从源码安装 Maia-3

当前项目兼容参考版本 `CSSLab/maia3` 提交 `1e13597c42d4858b7cfd7cfdae01e297263364b2`，以及保留相同 23M/79M 模型注册接口的更新版本。

克隆源码：

```powershell
git clone https://github.com/CSSLab/maia3.git downloads\maia3-src
```

创建项目内 Python 3.11 环境并安装源码：

```powershell
conda create --prefix engines\maia3\.conda python=3.11 -y
engines\maia3\.conda\python.exe -m pip install --upgrade pip
engines\maia3\.conda\python.exe -m pip install -e downloads\maia3-src
```

检查安装版本是否认识 79M：

```powershell
engines\maia3\.conda\python.exe -m maia3.uci --list-models
```

输出必须同时包含 `maia3-23m` 和 `maia3-79m`。如果没有 79M，先更新 Maia 源码并重新执行 `pip install -e`。

## 8. 通过 hf-mirror 缓存模型

23M 是默认模型：

```powershell
engines\maia3\cache-maia3-23m.cmd
```

79M 是源码运行用户的可选模型：

```powershell
engines\maia3\cache-maia3-79m.cmd
```

两个脚本都设置 `HF_ENDPOINT=https://hf-mirror.com`，并把模型写入：

```text
engines/maia3/hf-cache/
```

服务器启动 Maia 时带有 `--local-files-only`。这意味着对练过程中不会临时联网下载；没有预缓存所选模型时，Maia 会启动失败。

Windows 未启用开发者模式时，Hugging Face 可能提示缓存不能使用符号链接。缓存仍可工作，但可能额外占用磁盘。

## 9. 选择 23M 或 79M

默认 23M，无需设置变量：

```powershell
node server.mjs
```

使用 79M：

```powershell
$env:MAIA3_MODEL='maia3-79m'
node server.mjs
```

短名 `79m` 也会规范化为 `maia3-79m`。支持值只有：

```text
23m
maia3-23m
79m
maia3-79m
```

切回 23M：

```powershell
$env:MAIA3_MODEL='maia3-23m'
node server.mjs
```

清除本次 PowerShell 会话中的显式选择：

```powershell
Remove-Item Env:MAIA3_MODEL -ErrorAction SilentlyContinue
```

如果 Maia 安装在其他位置，可以指向通用 `maia3-uci` 入口：

```powershell
$env:MAIA3_PATH='C:\path\to\maia3-uci.exe'
$env:MAIA3_MODEL='maia3-79m'
node server.mjs
```

`MAIA3_PATH` 指向的入口必须接受 `--model`、`--cache-dir`、`--local-files-only`、`--device` 和 `--no-use-amp` 参数。若使用预设可执行文件 `maia3-79m`，应直接手工运行该预设，不要把它配置为项目的通用 `MAIA3_PATH`。

Windows Release 提供两个互斥的完整离线安装包：`ChessPrep-Lab-Setup.exe` 捆绑并默认使用 23M，`ChessPrep-Lab-Maia3-79M-Setup.exe` 捆绑并默认使用 79M。每个包只保留一个模型，避免重复占用数百 MB。源码构建命令分别为：

```powershell
.\installer\Build-ReleaseInstaller.ps1 -MaiaModel 23m
.\installer\Build-ReleaseInstaller.ps1 -MaiaModel 79m
```

构建器会写入 `engines/maia3/default-model.txt`，裁剪未选择的缓存，并让验证器检查默认模型与检查点一致。

## 10. 离线检查 79M

缓存后可以做不走棋的 UCI 握手：

```powershell
$cache=(Resolve-Path 'engines\maia3\hf-cache').Path
@('uci','isready','quit') | engines\maia3\.conda\python.exe -m maia3.uci --model maia3-79m --cache-dir $cache --local-files-only --device cpu --no-use-amp
```

成功时应看到：

```text
uciok
readyok
Maia3 ready
```

## 11. 常见问题

### `Invalid MAIA3_MODEL`

只使用 `23m`、`maia3-23m`、`79m` 或 `maia3-79m`。项目不会对拼错的模型名静默回退。

### `--list-models` 没有 79M

当前安装的是旧版 Maia 源码。更新 `downloads/maia3-src`，再用项目 Python 重新运行 `pip install -e downloads\maia3-src`。

### 79M 找不到检查点

先运行 `engines\maia3\cache-maia3-79m.cmd`。确认 `hf-cache/models--UofTCSSLab--Maia3-79M/` 中存在 `maia3-79m.pt`，然后保持运行时的 `--local-files-only`。

### 79M 启动慢或内存不足

切回 `maia3-23m`。不要通过缩短 Stockfish 过滤时间来掩盖本机资源不足，否则会改变拟人档位的质量边界。

### Maia 能走棋但拟人训练报 Stockfish 错误

检查 `engines/stockfish.exe`，或设置 `STOCKFISH_PATH`。Maia 负责候选分布，Stockfish 负责质量兜底，两者职责不同。

### 数据库显示没有对局

先运行 `database-builder.mjs status`，检查发现的 PGN 数量。确认文件扩展名为 `.pgn`，并注意年份、双方 Elo 和解析错误都可能使对局被过滤。

### 更新后仍看不到新来源

`append-missing` 按文件名判断是否已经导入。给替换后的来源使用新文件名，或备份后完整重建。
