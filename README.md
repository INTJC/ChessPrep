<p align="center">
  <img src="docs/media/chessprep-lab-mark-192.png" alt="ChessPrep Lab icon" width="96">
</p>

<h1 align="center">ChessPrep Lab</h1>

<p align="center">
  <strong>面向 MacBook 的本地优先国际象棋备战、开局记忆、残局训练和拟人对练工作台。</strong><br>
  <strong>A Mac-friendly local-first chess preparation workspace for opening recall, opponent prep, endgame training, and human-like sparring.</strong>
</p>

<p align="center">
  <a href="#zh">中文</a> ·
  <a href="#en">English</a> ·
  <a href="docs/media/chessprep-lab-demo.mp4">Demo Video</a>
</p>

<p align="center">
  <a href="docs/media/chessprep-lab-demo.mp4">
    <img src="docs/media/prep-workspace.png" alt="ChessPrep Lab preparation workspace" width="880">
  </a>
  <br>
  <sub>Click the image to watch the generated demo video.</sub>
</p>

| Opening trainer | Endgame trainer | Prep workspace |
| --- | --- | --- |
| <img src="docs/media/opening-trainer.png" alt="Opening trainer interface"> | <img src="docs/media/endgame-trainer.png" alt="Endgame trainer interface"> | <img src="docs/media/prep-workspace.png" alt="Preparation workspace interface"> |

## <a id="zh"></a>中文介绍

ChessPrep Lab 是一个本地运行的国际象棋训练工作台，用来把 Lichess Study、个人开局准备、对手历史对局、复杂残局和引擎对练放在同一个界面里。它默认只监听 `127.0.0.1`，不要求 Lichess token，也不保存登录信息。

### 核心功能

- **开局训练**：导入 Lichess Study PGN 后，系统把主线和变化树解析成可训练的准备库。你必须在棋盘上走出自己的准备着法，系统会按 PGN 变化树自动选择对手回应；走错时会提示当前位置的候选准备。
- **上传棋谱备战**：上传或粘贴对手 PGN，生成对手常走分支、样本数、胜率、和局率和得分率，再和你的准备库对照，帮助你优先补最可能遇到的线路。
- **残局训练**：课程来自高水平实战局面，不是随机题库。每题从真实 FEN 开始，要求沿着可验证主线完成赢棋或守和目标。
- **拟人训练 / 引擎训练**：从准备局面继续下，默认使用 Maia-3 23M 候选走法加 Stockfish 过滤；源码运行可切换 79M，训练离开准备后的实战处理。
- **中文简洁界面**：移除语言切换和冗余说明，优先为 MacBook 屏幕保留更大的棋盘区域。

### 快速启动

在仓库根目录运行：

```powershell
$env:PORT=8788; node server.mjs
```

然后打开：

```text
http://localhost:8788
```

如果 `8788` 被占用，可以换一个端口：

```powershell
$env:PORT=8790; node server.mjs
```

### macOS 本地版

从 GitHub 下载 `ChessPrep-Lab-macOS-*.zip` 后解压，进入目录运行：

```bash
chmod +x start-macos.sh
./start-macos.sh
```

备战模式不再要求构建大型离线数据库。请在“备战模式”上传或粘贴对手 PGN；对手姓名可选，留空时会分析上传文件中的全部对局。

如需自行打包 macOS ZIP：

```bash
scripts/build-macos-zip.sh
```

不想在本地运行命令时，可以在 fork 仓库的 GitHub Actions 中手动运行 `Build macOS package`，完成后从 workflow artifacts 或可选 Release 附件下载 ZIP。

详细说明见 [macOS 本地部署指南](README-macOS.md)。

### 数据规模

旧版备战模式曾使用本机离线对局库。当前 macOS 版本改为上传对手 PGN，不再要求这些大型数据文件。以下只是历史开发机快照：

- 可检索对局：`2,706,692` 盘。
- 已扫描数据源：`809` 个 PGN 源文件。
- 已导入数据源：`808` 个。
- 去重识别：`59,719` 盘重复对局。
- 离线库体积：约 `1.15GB`。
- 更新时间：`2026-06-09T15:45:56.767Z`。

这些大数据文件不直接提交到 Git；仓库保留核心源码、测试、构建脚本、图标、棋子资源和小型运行索引。

### 隐私与导入

私密研讨请从 Lichess 导出 PGN 后粘贴或上传。公开研讨可以粘贴 `https://lichess.org/study/...` 链接导入；链接导入需要通过 `node server.mjs` 启动，因为浏览器直接从 `localhost` 请求 Lichess 可能被跨域限制挡住。本地服务器只代理公开 PGN，不保存内容。

### 离线数据库与 Maia-3 79M

完整的公开 PGN 下载、数据库首次构建、增量更新、备战报告和 Maia 源码安装步骤见 [离线备战数据库与 Maia-3 配置指南](docs/offline-prep-and-maia3.md)。

Maia 默认使用 23M。已从源码安装并缓存 79M 后，可在启动前设置：

```powershell
engines\maia3\cache-maia3-79m.cmd
$env:MAIA3_MODEL='maia3-79m'
node server.mjs
```

运行时使用本地缓存，不会临时联网下载模型。Windows Release 同时提供 23M 标准版和 79M 高精度版；每个安装包只捆绑一个 Maia 模型，安装后自动使用对应模型。

### 许可与源码

ChessPrep Lab 按 [GNU AGPL v3.0](LICENSE) 发布。你可以运行、研究和修改代码，也可以在遵守许可证的前提下再发布；如果修改版通过网络向用户提供服务，必须让这些用户能够免费取得对应版本的完整源码。软件按“原样”提供，不附带任何担保。

这意味着 AGPL 能阻止他人把修改版直接变成不公开源码的网络产品，但**不能禁止别人使用、复制或在同一许可证下再发布**。若需要“未经授权不得使用”的效果，应采用专有商业许可证；这会与当前 Maia-3/Stockfish 组合的开源发布方式产生冲突。

仓库目前保持私有。向他人分发安装包或开放网络访问时，还应向同一批用户提供本仓库对应提交的源码访问或源码压缩包。Maia-3 源码及 23M/79M 模型权重均按 AGPL-3.0 发布；模型卡明确要求到源码仓库查看代码/权重许可证。第三方组件的完整说明见 [第三方声明](THIRD_PARTY_NOTICES.md)。

## <a id="en"></a>English Overview

ChessPrep Lab is a local chess preparation workspace that brings Lichess Study imports, opening recall, opponent preparation, practical endgame courses, and engine sparring into one browser-based app. By default it listens only on `127.0.0.1`; it does not require a Lichess token and does not store login credentials.

### What It Does

- **Opening trainer**: import a Lichess Study PGN and turn the main lines and variations into a playable training tree. You make your prep moves on the board; the app chooses opponent replies from the PGN tree and shows candidate prep moves when you miss.
- **Opponent preparation**: upload or paste opponent PGN, build an opponent opening tree, and compare the opponent's most common branches against your own preparation.
- **Endgame trainer**: train from real high-level game positions with verifiable solution lines, focused on practical conversion and defensive technique rather than one-move tactics.
- **Human-like sparring**: continue from a prepared position using Maia-3 23M by default, or optional 79M for source installs, with Stockfish quality filtering to avoid obvious blunders.
- **Simplified Chinese interface**: the visible app chrome is Chinese-only and prioritizes a larger board on MacBook screens.

### Quick Start

Run this from the repository root:

```powershell
$env:PORT=8788; node server.mjs
```

Then open:

```text
http://localhost:8788
```

If port `8788` is already in use:

```powershell
$env:PORT=8790; node server.mjs
```

### Windows Offline Installers

| Edition | Download | Size | SHA-256 |
| --- | --- | ---: | --- |
| Maia-3 23M Standard | [ChessPrep-Lab-Setup.exe](https://github.com/zhukaizhen/ChessPrep/releases/download/v1.0.0/ChessPrep-Lab-Setup.exe) | 343,270,720 bytes | `5E4B5E21EB4FED74215C0543F1B6C7BC71A330AACB72484D2AEB443081420351` |
| Maia-3 79M High Accuracy | [ChessPrep-Lab-Maia3-79M-Setup.exe](https://github.com/zhukaizhen/ChessPrep/releases/download/v1.0.0/ChessPrep-Lab-Maia3-79M-Setup.exe) | 545,155,926 bytes | `19FC5C4950ACA8FB019C35728149B96E31369F42D16BE2D4B135728998F21D02` |

Both installers bundle Node.js, Stockfish, the Maia-3 Python environment, and a local model cache. The standard edition uses less disk and memory; the 79M edition runs the largest and most accurate Maia-3 model at a higher CPU cost.

### Local Data

Opponent prep now uses uploaded PGN files instead of a required local offline game database. The figures below are only a historical development-machine snapshot from `2026-06-09`:

- Searchable games: `2,706,692`.
- Scanned PGN sources: `809`.
- Imported PGN sources: `808`.
- Duplicate games detected: `59,719`.
- Offline database size: about `1.15GB`.
- Last update: `2026-06-09T15:45:56.767Z`.

Large generated datasets are intentionally not committed. The repository keeps the source code, tests, build scripts, icons, chess pieces, and small runtime indexes needed to rebuild or reconnect those local payloads.

### Privacy And Importing

For private studies, export PGN from Lichess and paste or upload it locally. Public studies can be imported from `https://lichess.org/study/...` links when the local Node server is running. The server only proxies public PGN content and does not persist imported studies.

### Offline Database And Maia-3 79M

See the [offline prep database and Maia-3 guide](docs/offline-prep-and-maia3.md) for public PGN acquisition, full and incremental database builds, prep reports, source installation, model caching, and troubleshooting.

Maia uses 23M by default. After a source install and 79M cache download, start with `MAIA3_MODEL=maia3-79m`. Runtime model loading stays offline. Windows Releases provide separate 23M and 79M installers; each installer contains exactly one Maia model and selects it by default.

### License And Source

ChessPrep Lab is released under the [GNU AGPL v3.0](LICENSE). You may run,
study, modify, and redistribute it subject to that license. A modified version
used over a network must offer its users free access to the complete
corresponding source. The software is provided without warranty.

AGPL prevents a modified network version from being kept closed source; it
does **not** prohibit use, copying, or compliant redistribution. The repository
currently remains private, so anyone receiving a binary or using a network
deployment must also receive access to the matching source commit or a source
archive. Maia-3 source code and the 23M/79M model weights are licensed under
AGPL-3.0; the model cards direct users to the source repository for the
code/weights license. See [Third-Party Notices](THIRD_PARTY_NOTICES.md) for the
complete component list.

## Repository Notes

The repository tracks the core app and documentation media. The following generated or downloaded payloads stay local and are ignored:

- `data/player-prep/offline-games*`
- `data/player-prep/opening-trees/`
- `data/endgame-expansion/sources/raw/`
- `data/engine-calibration/*.json`
- `installer/package/`, `installer/package-release/`
- `engines/stockfish*`, `engines/maia3/.conda/`, `engines/maia3/hf-cache/`

`data/player-prep/chinese-player-pinyin.json` remains tracked because it is a small index used by prep search.

## Tests

Run the core parser, trainer, and uploaded-PGN prep tests with:

```powershell
node --test tests\server.test.mjs tests\trainer-core.test.mjs tests\uploaded-pgn-prep.test.mjs
```
