# ChessPrep Lab

一个本地静态网页，用来导入 Lichess 研讨 PGN，并测试你是否记住了自己的开局准备。

## Git 仓库说明

仓库保存核心源码、测试、构建脚本、图标/棋子资源，以及小型运行数据。下面这些内容属于本机生成或下载的 payload，不直接提交：

- `data/player-prep/offline-games*`：本地备战对局数据库。
- `data/player-prep/opening-trees/`：按棋手生成的开局树缓存。
- `data/endgame-expansion/sources/raw/`：PGN 原始数据源。
- `data/engine-calibration/*.json`：引擎校准输出。
- `installer/package/`、`installer/package-release/`：完整离线安装器 payload。
- `engines/stockfish*`、`engines/maia3/.conda/`、`engines/maia3/hf-cache/`：本地引擎和 Maia 模型缓存。

这些内容可以通过对应脚本或本机缓存重新生成。`data/player-prep/chinese-player-pinyin.json` 是备战搜索需要的小型索引，已经保留在仓库中。

## 启动

在本目录运行：

```powershell
$env:PORT=8788; node server.mjs
```

然后打开：

```text
http://localhost:8788
```

默认启动只监听本机 `127.0.0.1`，不会把网站暴露到局域网或公网。

## 邀请少数朋友体验

推荐使用 Cloudflare Tunnel + Cloudflare Access。朋友只需要打开 HTTPS 链接并通过邮箱验证；只有运行网站的这台机器需要安装 `cloudflared`。

安全边界：

- 不要把 `8788` 端口直接映射到公网。
- 不要把 `HOST` 改成 `0.0.0.0` 后裸露给公网。
- 用 Cloudflare Access 的邮箱白名单限制受邀用户。
- 本机 trainer 继续只监听 `127.0.0.1:8788`，公网入口由 Cloudflare Tunnel 转发。

### 一次性配置 Cloudflare

1. 在 Cloudflare Zero Trust 中创建 Tunnel。
2. 给 Tunnel 绑定一个域名，例如 `gm.example.com`。
3. Tunnel 的本地服务指向：

```text
http://localhost:8788
```

4. 在 Cloudflare Access 中创建 Self-hosted Application，域名填同一个 `gm.example.com`。
5. Access policy 只允许你指定的几个邮箱，用 One-time PIN 或邮箱验证码登录。

本目录提供了模板：

```text
cloudflare-tunnel.example.yml
```

### 启动邀请体验

设置 Tunnel 名称后运行：

```powershell
$env:CLOUDFLARE_TUNNEL_NAME="你的Tunnel名称"
.\start-share-trainer.ps1
```

也可以直接传参数：

```powershell
.\start-share-trainer.ps1 -TunnelName "你的Tunnel名称"
```

保持这个窗口打开。朋友访问 Cloudflare 分配或绑定的 HTTPS 域名即可，不需要安装任何程序。

引擎接口已做简单限流，避免少数体验用户误操作时持续占用本机 CPU。正式大规模公开使用需要独立服务器、队列和账号系统，本项目当前只面向少数受邀体验。

## 国内临时分享

如果不想配置 Cloudflare，可以用 cpolar 做国内临时分享。朋友只需要打开 cpolar 给出的 HTTPS 链接，并输入你设置的访问用户名和密码。

本地模式仍然不变：trainer 继续只监听 `127.0.0.1:8788`，不要做路由器端口转发，也不要把 `8788` 直接暴露公网。

项目会优先使用 `tools\cpolar\cpolar.exe` 里的便携版 cpolar；如果没有，也会尝试使用系统 PATH 中的 `cpolar`。

第一次使用时，先在 cpolar 官网注册并复制自己的 `authtoken`，然后运行：

```powershell
$env:CPOLAR_AUTHTOKEN="你的cpolar authtoken"
$env:TRAINER_SHARE_USER="gm"
$env:TRAINER_SHARE_PASSWORD="设置一个临时访问密码"
.\start-cpolar-trainer.ps1
```

以后已经写入过 token 时，可以只运行：

```powershell
$env:TRAINER_SHARE_USER="gm"
$env:TRAINER_SHARE_PASSWORD="设置一个临时访问密码"
.\start-cpolar-trainer.ps1
```

也可以不设置环境变量，脚本会提示你输入访问用户名和密码。保持窗口打开，复制终端里显示的 `https://...` 公网地址发给受邀朋友。

## 使用方式

1. 在 Lichess Study 中导出 PGN，然后粘贴到左侧输入框，点击“导入 PGN”。
2. 也可以上传 `.pgn` 文件。
3. 如果研讨是公开的，可以粘贴 `https://lichess.org/study/...` 或 `https://lichess.org/study/.../...` 链接并点击“从链接导入”。
4. 选择训练白方或黑方。
5. 在棋盘上点起点和终点走棋。对手会从你的准备分支里随机选择一步。

如果你走的不是研讨里准备过的内容，棋盘会提示错误，右侧会显示当前局面的候选准备走法。

## 拟人训练 / 引擎训练

右侧“拟人训练”可以从当前训练局面接着和引擎下：

- `Stockfish 强引擎`：强引擎模式。
- `拟人 2200 / 2400 / 2600`：Maia-3 23M 候选走法，网站保留原档位标注；后台实际强度整体上调 200 Elo，并用 Stockfish 过滤明显掉分的选择。
- `近似 2700`：Stockfish 限强近似，不标成纯 Maia；后台实际强度同样按 +200 校准。

本项目已经按下面路径导入本地引擎：

- `engines\stockfish.exe`
- `engines\maia3\.conda`
- `engines\maia3\hf-cache`

Maia-3 使用 `https://hf-mirror.com` 缓存 Maia3-23M。需要重新缓存时运行：

```powershell
engines\maia3\cache-maia3-23m.cmd
```

2600 档属于更高强度拟人校准：仍使用 Maia-3 候选走法，但通过更长搜索和更严格的 Stockfish 质量过滤提高强度；2700 档继续使用 Stockfish 近似，不会伪装成 Maia。

## 私密研讨

网页不会要求你输入 Lichess token，也不会保存登录信息。私密研讨请从 Lichess 导出 PGN 后粘贴或上传。

## 链接导入说明

链接导入需要用 `node server.mjs` 启动，因为浏览器直接从 `localhost` 请求 Lichess 可能被跨域限制挡住。本地服务器只代理公开 PGN，不保存内容。如果 8788 被占用，可以换成 `$env:PORT=8790; node server.mjs`。

## 测试

核心解析和训练逻辑可以用 Node 测试：

```powershell
node --test tests\server.test.mjs tests\trainer-core.test.mjs
```
