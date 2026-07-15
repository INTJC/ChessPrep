# 离线备战数据库与 Maia-3 79M 配置设计

## 目标

在保持现有 Maia-3 23M 默认行为和离线安装器兼容性的前提下，让源码运行方式可以通过环境变量选择 Maia-3 79M，并补齐离线对局数据库、备战检索和拟人训练的可复现中文说明。

本次变更只提交源码、测试、脚本和文档。Python 环境、Maia 模型缓存、Stockfish、原始 PGN 与生成后的大型离线数据库继续留在本机，并由 `.gitignore` 排除。

## 事实依据

参考目录 `C:\Users\kevin\Documents\Codex\2026-05-30\lichess` 与当前仓库的核心服务器、备战数据库和引擎配置代码基本一致。参考目录中的 Maia-3 源码位于 `downloads\maia3-src`，版本提交为 `1e13597c42d4858b7cfd7cfdae01e297263364b2`，其模型注册表定义了：

- 23M：别名 `maia3-23m`，仓库 `UofTCSSLab/Maia3-23M`。
- 79M：别名 `maia3-79m`，仓库 `UofTCSSLab/Maia3-79M`，检查点 `maia3-79m.pt`。

当前项目的 `server.mjs`、`engines/maia3/maia3-uci.cmd` 和缓存脚本固定使用 `maia3-23m`，所以仅设置外部变量还不能切换到 79M。

## 方案

### 模型选择

保留 23M 为默认模型，新增 `MAIA3_MODEL` 环境变量。接受以下值：

- `23m` 或 `maia3-23m`，规范化为 `maia3-23m`。
- `79m` 或 `maia3-79m`，规范化为 `maia3-79m`。

变量未设置或只包含空白时使用 `maia3-23m`。其他值视为配置错误，并在尝试启动 Maia 前给出包含允许值的明确错误，不静默回退。

服务端使用同一个模型解析函数生成 Maia UCI 参数。无论 Maia 是从显式 `MAIA3_PATH`、项目内 Python 环境、pip 安装的启动器还是 PATH 启动，最终都必须使用规范化后的模型和项目内 `engines/maia3/hf-cache` 缓存目录。

项目内 `maia3-uci.cmd` 同样读取 `MAIA3_MODEL`，未设置时回退到 `maia3-23m`。这样手工启动脚本和服务器启动保持一致，不会由脚本再次覆盖服务端选择。

### 模型缓存与源码安装

保留 `cache-maia3-23m.cmd`，新增对应的 `cache-maia3-79m.cmd`。两个脚本都使用项目内 Python 环境和共享的 `hf-cache`，并通过 `HF_ENDPOINT=https://hf-mirror.com` 下载。运行时继续使用 `--local-files-only`，因此模型必须在训练前预缓存，训练过程中不会临时联网。

详细指南记录两种安装路径：

1. 现有项目环境：安装或更新参考 Maia-3 源码后，分别运行所需模型的缓存脚本。
2. 自定义环境：设置 `MAIA3_PATH` 指向兼容的 UCI 入口，同时用 `MAIA3_MODEL` 指定模型。

指南明确要求 Maia-3 源码版本必须包含 79M 注册项，可用 `maia3-uci --list-models` 验证。离线安装器仍只承诺捆绑和校验 23M；79M 是源码用户的可选配置，不改动现有安装器模型校验。

### 拟人训练配置

`拟人 2200`、`拟人 2400`、`拟人 2600` 继续使用共享档位元数据中的 Elo、Temperature、TopP、搜索时间和质量阈值。模型切换只改变 Maia 候选生成模型，不改变档位标注和现有校准参数：

1. Maia 根据当前档位生成更接近人类选择分布的候选着法。
2. 开局先验可在样本充分且没有明显掉分时优先选择实战常见着法。
3. Stockfish 对 Maia 候选做质量过滤，超过档位允许损失时回退到更可靠的候选。

`近似 2700` 继续使用 Stockfish 多候选限强，不切换到 Maia。所有档位都是训练配置，不描述为 FIDE 或官方引擎 Elo 认证。文档会说明 79M 通常更重、更慢，CPU 内存不足时应回到 23M。

## 离线备战数据库流程

新增详细中文指南，并在 README 与使用文档中链接。指南以仓库相对路径为主，覆盖以下流程：

1. 检查 Node.js、磁盘空间和可选解压工具。
2. 用 `public-source-downloader.mjs` 的默认 `plan` 命令预览公开来源下载计划。
3. 用 `download` 命令下载 Lichess Broadcast、TWIC 和可选 PGN Mentor 数据。
4. 将自行取得的合法 PGN 放入默认原始数据目录；不复制私密或无授权数据。
5. 用 `database-builder.mjs build` 首次构建数据库。
6. 用 `append-missing` 将新来源增量写入已有数据库，避免完整重建。
7. 用 `dedupe` 做显式去重维护，并用默认 `status` 检查状态。
8. 启动本地服务器，在备战模式输入对手、选择己方执色和开局分支，再生成报告。

数据库默认读取：

- `data/endgame-expansion/sources/raw/lichess-broadcast-db`
- `data/endgame-expansion/sources/raw/twic`
- `data/endgame-expansion/sources/raw`

默认筛选为年份不早于 2010，且双方 Elo 必须严格高于 2000。输出写入 `data/player-prep/offline-games*`，按对局身份去重，并生成按棋手复用的开局树缓存。原始来源、数据库和开局树都不提交 Git。

指南必须明确区分：

- 网页“构建/更新数据库”和命令行 `build` 会重置并完整重建当前存储。
- `append-missing` 只导入清单中尚未记录的来源，适合日常增量更新。
- 同名来源被视为已经导入；替换了同名 PGN 内容时，应选择完整重建或先采用新文件名。
- 构建大型数据库前应备份现有 `offline-games*`；文档验证不会实际重建用户的 1GB 级数据库。

## 文档结构

- `README.md`：保留项目概览，增加离线数据库和 Maia 模型选择的最短命令与详细指南链接。
- `ChessPrep-Lab-使用文档.md`：改用仓库相对路径，补充备战模式操作、模型选择和实际限制。
- `engines/README.md`：记录引擎目录布局、两个缓存脚本、环境变量和运行约束。
- 新的详细指南：集中描述数据来源、数据库生命周期、79M 源码安装、拟人配置和故障排查，避免 README 过长。

文档不复制参考目录的大型 payload，也不把当前开发机数据库数量写成所有用户都能复现的固定结果。现有数据规模只作为当前机器快照，并标明会随来源、筛选和更新时间变化。

## 错误处理

- 无效 `MAIA3_MODEL`：报告允许的短名和完整名，不启动引擎。
- 79M 未缓存：保持离线运行约束，提示先运行 79M 缓存脚本，不自动联网下载。
- Maia 源码过旧：提示用 `--list-models` 检查 `maia3-79m`，再更新源码安装。
- Maia 启动或加载失败：继续使用现有友好错误包装，并在指南中列出 Python 环境、缓存路径、内存和 CPU 排查方式。
- Stockfish 缺失：说明 Maia 档位的质量过滤依赖 Stockfish，不能把未过滤结果描述为完整拟人训练配置。
- 数据源下载失败：下载器保留逐项失败记录；用户可重跑，已有文件会跳过。
- 数据库构建中断：保留备份后重新 build，或从仍可读取的存储继续 append；不承诺对半写入文件进行自动恢复。

## 测试与验证

采用测试先行方式修改模型配置：

- 测试默认值、短名和完整名规范化。
- 测试无效模型被拒绝。
- 测试显式 `MAIA3_PATH`、本地 Python 和 pip 启动器均收到所选模型参数。
- 测试默认 23M 参数保持现有行为。
- 静态检查 Windows UCI 与缓存脚本的默认值和环境变量传递。

完成后运行：

```powershell
node --test tests\server.test.mjs tests\player-prep-builder.test.mjs tests\public-source-downloader.test.mjs tests\trainer-core.test.mjs
```

文档命令只做安全验证：运行下载计划、数据库状态和测试夹具，不下载完整公开库、不重建现有大型数据库、不启动实际 79M 推理。若本机已有 79M 缓存，可额外执行 UCI 握手作为非必需验证，并单独报告结果。

## 不在本次范围

- 不在网页中增加 23M/79M 选择器。
- 不把 79M 模型打入现有离线安装器。
- 不重新校准各拟人档位的 Elo、采样或 Stockfish 过滤参数。
- 不复制参考目录中的模型、Python 环境、Stockfish、PGN 或离线数据库。
- 不改变公开数据源清单、默认年份和 Elo 筛选规则。
