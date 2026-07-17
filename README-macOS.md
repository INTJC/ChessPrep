# ChessPrep Lab macOS 本地版

这是面向 MacBook 的本地运行版本。应用包含网页界面、Node.js 本地服务器、开局/残局训练数据、图标和棋子资源。备战模式不再依赖大型离线数据库；请直接上传或粘贴对手 PGN 生成报告。

## 1. 安装 Node.js

如果没有安装 Node.js，推荐使用 Homebrew：

```bash
brew install node
```

检查安装：

```bash
node --version
```

## 2. 启动应用

解压从 GitHub 下载的 `ChessPrep-Lab-macOS-*.zip`，进入解压后的目录，然后运行：

```bash
chmod +x start-macos.sh
./start-macos.sh
```

浏览器会自动打开：

```text
http://localhost:8788
```

服务器默认只监听 `127.0.0.1`，仅本机可访问。

## 3. 端口被占用

如果 `8788` 被占用：

```bash
PORT=8790 ./start-macos.sh
```

## 4. 备战模式

1. 在“开局训练”中导入你的准备 PGN。
2. 切换到“备战模式”。
3. 上传或粘贴对手 PGN。
4. 可选填写对手姓名；留空时会分析上传文件中的全部对局。
5. 选择我方执棋颜色并点击“生成备战报告”。

报告会保留原有分析维度：对手常见选择、未见准备、低样本分支、表现差分支和准备缺口。

## 5. Stockfish 与 Maia-3

开局训练、残局训练和上传 PGN 备战不需要棋类引擎。拟人对练和强引擎模式需要本地 UCI 引擎。

推荐安装 Stockfish：

```bash
brew install stockfish
```

如果 Stockfish 在其他位置：

```bash
STOCKFISH_PATH="/path/to/stockfish" ./start-macos.sh
```

也可以把 macOS Stockfish 二进制放在：

```text
engines/stockfish
```

如果你已自行安装 Maia-3，可以设置：

```bash
MAIA3_PATH="/path/to/maia3-uci" ./start-macos.sh
```

## 6. 构建 macOS ZIP

仓库维护者可以运行：

```bash
scripts/build-macos-zip.sh
```

产物位于：

```text
dist/macos/ChessPrep-Lab-macOS-1.0.0.zip
```
