export const DEFAULT_LOCALE = 'zh';
export const SUPPORTED_LOCALES = ['zh', 'en'];
export const LANGUAGE_STORAGE_KEY = 'chessprep.locale.v1';

const UI_TEXT = {
  zh: {
    'app.title': 'ChessPrep Lab',
    'mode.opening': '开局训练',
    'mode.endgame': '残局训练',
    'mode.prep': '备战模式',
    'top.importStatus': '导入状态',
    'status.notImported': '尚未导入',
    'opening.workbench': '开局训练工作台',
    'opening.importStudy': '导入研讨',
    'opening.loadSample': '载入示例',
    'opening.pgnContent': 'PGN 内容',
    'opening.pgnPlaceholder': '从 Lichess Study 导出 PGN 后粘贴到这里，主线和变化线都会进入训练树。',
    'opening.importPgn': '导入 PGN',
    'opening.uploadPgn': '上传 .pgn',
    'opening.appendPgn': '追加到当前研讨',
    'opening.studyUrl': '公开 Lichess Study 链接',
    'opening.importFromUrl': '从链接导入',
    'opening.trainingSide': '训练方',
    'opening.white': '白方',
    'opening.black': '黑方',
    'opening.savedStudies': '已保存研讨',
    'opening.savedEmpty': '导入后的研讨会自动保存在这里。',
    'opening.studyName': '当前研讨名称',
    'opening.renamePlaceholder': '选择或导入研讨后可改名',
    'opening.rename': '改名',
    'opening.note': '链接导入请用 $env:PORT=8788; node server.mjs 启动本地服务器。私密研讨请用 PGN 粘贴或上传；本页面不会保存你的 Lichess 登录信息。',
    'opening.initialFeedback': '先导入你的 Lichess 研讨 PGN，然后开始训练。',
    'opening.trainingStatus': '训练状态',
    'opening.optionalBranches': '可选分支',
    'opening.waiting': '等待导入 PGN 或 Lichess Study',
    'opening.preparedCandidates': '候选准备',
    'opening.answersEmpty': '走错或点击“显示答案”后，这里会列出准备走法。',
    'opening.reset': '重置本轮',
    'opening.reveal': '显示答案',
    'opening.nextRandomLine': '下一条随机线',
    'opening.continueNextLine': '继续下一条',
    'opening.currentPgn': '当前 PGN',
    'opening.backStep': '退一步',
    'opening.copyPgn': '复制 PGN',
    'opening.currentLineEmpty': '尚未开始本轮走法',
    'opening.historyEmpty': '导入后会显示本轮走法记录',
    'opening.chooseBranch': '选择对手分支，也可直接走棋盘高亮步',
    'opening.previousCompleted': '上一条完成：{pgn}',
    'prep.database': '线下棋谱库',
    'prep.notBuilt': '未构建',
    'prep.ready': '已就绪',
    'prep.databaseStatus': '数据库状态',
    'prep.statusLoading': '正在读取本地数据库状态...',
    'prep.buildDatabase': '构建/更新数据库',
    'prep.databaseNote': '系统会从已下载的公开线下 PGN 源自动构建，不需要手动导入对手棋谱；过滤条件：2010 年之后，双方 Elo 都大于 2000。',
    'prep.opponent': '对手姓名',
    'prep.opponentPlaceholder': '例如 丁立人 / Ding Liren',
    'prep.ourSide': '我方执棋',
    'prep.runReport': '生成备战报告',
    'prep.commonReplies': '对手开局树',
    'prep.commonRepliesEmpty': '生成报告后，这里会像 Lichess 开局树一样按当前局面更新：对手下过哪些步、次数、占比和得分率。',
    'prep.commonRepliesNone': '这个局面在对手样本中还没有后续走法。',
    'prep.report': '备战报告',
    'prep.waiting': '待生成',
    'prep.status': '先构建本地线下对局库，再输入对手并生成报告。',
    'prep.sampleGames': '样本',
    'prep.unseen': '未见',
    'prep.weak': '弱点',
    'prep.gaps': '缺口',
    'prep.reportEmpty': '报告会列出对手没下过的走法、低样本分支、表现差分支，以及你还没覆盖的对手常见选择。',
    'prep.lowSample': '低样本',
    'prep.unseenTitle': '对手没下过的准备',
    'prep.lowSampleTitle': '对手低样本分支',
    'prep.weakTitle': '对手表现差分支',
    'prep.gapTitle': '准备缺口',
    'endgame.course': '残局课程',
    'endgame.problem': '残局题目',
    'endgame.notStarted': '待开始',
    'endgame.targetPending': '目标：待选择',
    'endgame.chooseCourse': '选择左侧课程后开始。',
    'endgame.hintsAnswers': '提示与答案',
    'endgame.answersEmpty': '走错或点击提示后，这里会显示训练信息。',
    'endgame.reset': '重置本题',
    'endgame.hint': '显示提示',
    'endgame.answer': '显示答案',
    'endgame.next': '下一题',
    'endgame.teachingEmpty': '选择一个残局主题后，这里会显示教学重点。',
    'endgame.engineSparring': '残局引擎对练',
    'endgame.engineStatus': '从当前残局局面开始，选择档位后点击开始。',
    'endgame.engineNote': '可在任意残局题面或走题中途开启；退出后会回到进入对练前的题目局面。',
    'endgame.completed': '已完成',
    'endgame.target.win': '目标：赢棋',
    'endgame.target.draw': '目标：守和',
    'endgame.target.unknown': '目标：待确认',
    'endgame.source.example': '例 {value}',
    'endgame.source.exercise': '练习 {value}',
    'endgame.source.publicPgn': '公开 PGN',
    'endgame.source.source': '来源',
    'endgame.dl.principle': '核心规则',
    'endgame.dl.method': '判断方法',
    'endgame.dl.mistake': '常见误区',
    'endgame.playAnswer': '走答案',
    'engine.sparring': '拟人训练',
    'engine.idle': '待机',
    'engine.thinking': '思考中',
    'engine.running': '进行中',
    'engine.openingStatus': '从当前局面开始，选择档位后点击开始。',
    'engine.start': '开始',
    'engine.stop': '退出',
    'engine.note': '2200-2700 档保留原标注；后台强度已整体上调 200 Elo，并使用更严格的搜索、采样和质量过滤。',
    'engine.stockfishStrong': 'Stockfish 强引擎',
    'engine.human2200': '拟人 2200',
    'engine.human2400': '拟人 2400',
    'engine.human2600': '拟人 2600',
    'engine.human2700': '近似 2700',
    'stats.accuracy': '正确率',
    'stats.streak': '连对',
    'stats.mistakes': '错步',
    'stats.coverage': '覆盖',
    'stats.progress': '进度',
    'actions.nextRandomLine': '下一条随机线',
    'promotion.choose': '升变为',
    'promotion.q': '后',
    'promotion.r': '车',
    'promotion.b': '象',
    'promotion.n': '马',
    'lang.zh': '中文',
    'lang.en': 'English',
    'legal.notice': '© 2026 ChessPrep Lab 贡献者 · 本软件不提供任何担保',
    'legal.source': '对应源码',
    'legal.license': 'AGPL-3.0 许可',
    'legal.thirdParty': '第三方声明'
  },
  en: {
    'app.title': 'ChessPrep Lab',
    'mode.opening': 'Opening Training',
    'mode.endgame': 'Endgame Training',
    'mode.prep': 'Prep Mode',
    'top.importStatus': 'Import Status',
    'status.notImported': 'Not Imported',
    'opening.workbench': 'Opening Training Workbench',
    'opening.importStudy': 'Import Study',
    'opening.loadSample': 'Load Sample',
    'opening.pgnContent': 'PGN Content',
    'opening.pgnPlaceholder': 'Export PGN from a Lichess Study and paste it here. Main lines and variations will enter the training tree.',
    'opening.importPgn': 'Import PGN',
    'opening.uploadPgn': 'Upload .pgn',
    'opening.appendPgn': 'Append to Current Study',
    'opening.studyUrl': 'Public Lichess Study Link',
    'opening.importFromUrl': 'Import from Link',
    'opening.trainingSide': 'Training Side',
    'opening.white': 'White',
    'opening.black': 'Black',
    'opening.savedStudies': 'Saved Studies',
    'opening.savedEmpty': 'Imported studies will be saved here automatically.',
    'opening.studyName': 'Current Study Name',
    'opening.renamePlaceholder': 'Choose or import a study before renaming it',
    'opening.rename': 'Rename',
    'opening.note': 'For link import, start the local server with $env:PORT=8788; node server.mjs. For private studies, paste or upload the PGN. This page never stores your Lichess login.',
    'opening.initialFeedback': 'Import your Lichess Study PGN first, then start training.',
    'opening.trainingStatus': 'Training Status',
    'opening.optionalBranches': 'Optional Branches',
    'opening.waiting': 'Waiting for a PGN or Lichess Study',
    'opening.preparedCandidates': 'Prepared Moves',
    'opening.answersEmpty': 'After a mistake or Reveal Answer, prepared moves will appear here.',
    'opening.reset': 'Reset Line',
    'opening.reveal': 'Reveal Answer',
    'opening.nextRandomLine': 'Next Random Line',
    'opening.continueNextLine': 'Continue to Next Line',
    'opening.currentPgn': 'Current PGN',
    'opening.backStep': 'Step Back',
    'opening.copyPgn': 'Copy PGN',
    'opening.currentLineEmpty': 'No moves in this run yet',
    'opening.historyEmpty': 'Move history will appear here after import',
    'opening.chooseBranch': 'Choose the opponent branch, or play a highlighted move on the board.',
    'opening.previousCompleted': 'Previous completed line: {pgn}',
    'prep.database': 'Offline Game Library',
    'prep.notBuilt': 'Not Built',
    'prep.ready': 'Ready',
    'prep.databaseStatus': 'Database Status',
    'prep.statusLoading': 'Reading local database status...',
    'prep.buildDatabase': 'Build/Update Database',
    'prep.databaseNote': 'The app builds automatically from downloaded public offline PGN sources. No manual opponent PGN import is needed. Filter: after 2010, both players Elo above 2000.',
    'prep.opponent': 'Opponent Name',
    'prep.opponentPlaceholder': 'Example: Ding Liren / 丁立人',
    'prep.ourSide': 'My Side',
    'prep.runReport': 'Generate Prep Report',
    'prep.commonReplies': 'Opponent Opening Tree',
    'prep.commonRepliesEmpty': 'After generating a report, this updates like a Lichess opening tree for the current position: moves played, games, share, and score rate.',
    'prep.commonRepliesNone': 'No follow-up moves found for this position in the opponent sample.',
    'prep.report': 'Prep Report',
    'prep.waiting': 'Not Generated',
    'prep.status': 'Build the local offline game database, then enter an opponent and generate a report.',
    'prep.sampleGames': 'Samples',
    'prep.unseen': 'Unseen',
    'prep.weak': 'Weak',
    'prep.gaps': 'Gaps',
    'prep.reportEmpty': 'The report will list unseen prepared moves, low-sample branches, weak-performing branches, and opponent choices missing from your prep.',
    'prep.lowSample': 'Low Sample',
    'prep.unseenTitle': 'Prepared Moves They Have Not Played',
    'prep.lowSampleTitle': 'Low-Sample Opponent Branches',
    'prep.weakTitle': 'Opponent Weak-Performance Branches',
    'prep.gapTitle': 'Preparation Gaps',
    'endgame.course': 'Endgame Course',
    'endgame.problem': 'Endgame Task',
    'endgame.notStarted': 'Not Started',
    'endgame.targetPending': 'Target: Not Selected',
    'endgame.chooseCourse': 'Choose a course item on the left to begin.',
    'endgame.hintsAnswers': 'Hints and Answers',
    'endgame.answersEmpty': 'After a mistake or hint request, training information will appear here.',
    'endgame.reset': 'Reset Task',
    'endgame.hint': 'Show Hint',
    'endgame.answer': 'Show Answer',
    'endgame.next': 'Next Task',
    'endgame.teachingEmpty': 'Choose an endgame theme to see the training notes here.',
    'endgame.engineSparring': 'Endgame Engine Sparring',
    'endgame.engineStatus': 'Start from the current endgame position. Choose a level, then press Start.',
    'endgame.engineNote': 'You can start sparring from any endgame position, including mid-solution. Stopping returns to the saved task position.',
    'endgame.completed': 'Completed',
    'endgame.target.win': 'Target: Win',
    'endgame.target.draw': 'Target: Hold the Draw',
    'endgame.target.unknown': 'Target: Confirm',
    'endgame.source.example': 'Example {value}',
    'endgame.source.exercise': 'Exercise {value}',
    'endgame.source.publicPgn': 'Public PGN',
    'endgame.source.source': 'Source',
    'endgame.dl.principle': 'Core Principle',
    'endgame.dl.method': 'Decision Method',
    'endgame.dl.mistake': 'Common Pitfall',
    'endgame.playAnswer': 'Play Answer',
    'engine.sparring': 'Human-like Sparring',
    'engine.idle': 'Idle',
    'engine.thinking': 'Thinking',
    'engine.running': 'Running',
    'engine.openingStatus': 'Start from the current position. Choose a level, then press Start.',
    'engine.start': 'Start',
    'engine.stop': 'Exit',
    'engine.note': 'The 2200-2700 labels are preserved. Engine strength is calibrated 200 Elo higher internally with stricter search, sampling, and quality filtering.',
    'engine.stockfishStrong': 'Stockfish Strong',
    'engine.human2200': 'Human-like 2200',
    'engine.human2400': 'Human-like 2400',
    'engine.human2600': 'Human-like 2600',
    'engine.human2700': 'Approx. 2700',
    'stats.accuracy': 'Accuracy',
    'stats.streak': 'Streak',
    'stats.mistakes': 'Mistakes',
    'stats.coverage': 'Coverage',
    'stats.progress': 'Progress',
    'actions.nextRandomLine': 'Next Random Line',
    'promotion.choose': 'Promote to',
    'promotion.q': 'Queen',
    'promotion.r': 'Rook',
    'promotion.b': 'Bishop',
    'promotion.n': 'Knight',
    'lang.zh': '中文',
    'lang.en': 'English',
    'legal.notice': '© 2026 ChessPrep Lab contributors · No warranty',
    'legal.source': 'Corresponding Source',
    'legal.license': 'AGPL-3.0 License',
    'legal.thirdParty': 'Third-Party Notices'
  }
};

const CATEGORY_TRANSLATIONS = {
  'rook-activity': {
    title: 'Rook Endgames: Activity',
    subtitle: 'Sacrificing pawns for activity, limiting counterplay, and finding the right rook placement.'
  },
  'king-activity': {
    title: 'King Activity',
    subtitle: 'Using the king as a fighting piece and converting dynamic compensation.'
  },
  'practical-themes': {
    title: 'Practical Endgame Themes',
    subtitle: 'Weaknesses, passed pawns, active defense, and deep calculation.'
  },
  'single-rook-defense': {
    title: 'Single-Rook Defense',
    subtitle: 'Counterplay, pawn trades, king routes, and passive-defense escapes.'
  },
  'rook-minor-activity': {
    title: 'Rook and Minor Piece Activity',
    subtitle: 'Opposite bishops, active pieces, passed pawns, and defensive transitions.'
  },
  'rook-bishop-knight': {
    title: 'Rook and Bishop vs Rook and Knight',
    subtitle: 'Key-square control, king routes, and outside-pawn races.'
  },
  'queen-endgames': {
    title: 'Queen Endgames',
    subtitle: 'King safety, passed pawns, perpetual checks, and queen coordination.'
  },
  'queen-minor-endgames': {
    title: 'Queen and Minor Piece Endgames',
    subtitle: 'Queen-bishop and queen-knight coordination, opposite-bishop attacks, passed pawns, and perpetual-check resources.'
  },
  'opposite-bishop-initiative': {
    title: 'Opposite-Bishop Initiative',
    subtitle: 'Attacking chances, fortress breaks, and queen-bishop or rook-bishop transitions.'
  }
};

const MESSAGE_TRANSLATIONS = new Map([
  ['先导入你的 Lichess 研讨 PGN，然后开始训练。', 'Import your Lichess Study PGN first, then start training.'],
  ['等待导入 PGN 或 Lichess Study', 'Waiting for a PGN or Lichess Study'],
  ['选择左侧课程后开始。', 'Choose a course item on the left to begin.'],
  ['本题已经完成，点击“下一题”继续。', 'This task is already complete. Click Next Task to continue.'],
  ['从当前局面开始，选择档位后点击开始。', 'Start from the current position. Choose a level, then press Start.'],
  ['从当前残局局面开始，选择档位后点击开始。', 'Start from the current endgame position. Choose a level, then press Start.'],
  ['待机', 'Idle'],
  ['待开始', 'Not Started'],
  ['目标：待选择', 'Target: Not Selected'],
  ['提示已显示。', 'Hint shown.'],
  ['本题已经完成。', 'This task is already complete.'],
  ['本题完成。', 'Task complete.'],
  ['已按答案推进，继续下一步。', 'Answer played. Continue to the next step.'],
  ['本题完成。可以复盘本题，或进入下一题。', 'Task complete. You can review it or move to the next task.'],
  ['走对了，继续下一步。', 'Correct. Continue to the next step.'],
  ['走对了，继续按主题方案推进。', 'Correct. Keep following the thematic plan.'],
  ['这不是合法走法。', 'That is not a legal move.'],
  ['这不是当前局面的合法走法。', 'That is not a legal move in the current position.'],
  ['你已落子，引擎正在思考...', 'You moved. The engine is thinking...'],
  ['引擎对练已开启。现在从当前残局局面继续自由对弈。', 'Engine sparring is on. Continue freely from this endgame position.'],
  ['残局引擎对练已开启。', 'Endgame engine sparring is on.'],
  ['拟人训练已开启。现在从当前局面继续对弈。', 'Human-like sparring is on. Continue from the current position.'],
  ['引擎对练已退出，已回到进入对练前的残局位置。', 'Engine sparring stopped. The endgame task position has been restored.'],
  ['已退出残局引擎对练。', 'Endgame engine sparring stopped.'],
  ['残局引擎对练进行中。轮到你走。', 'Endgame engine sparring is running. Your move.'],
  ['拟人训练进行中。轮到你走。', 'Human-like sparring is running. Your move.'],
  ['拟人训练中不显示准备答案；这里按实战继续下。', 'Prepared answers are hidden during sparring. Continue as in a real game.'],
  ['拟人训练进行中。轮到你时可任意走合法棋步。', 'Human-like sparring is running. When it is your turn, any legal move is allowed.'],
  ['选择对手分支：可直接在棋盘点击或拖动高亮走法。', 'Choose the opponent branch: click or drag a highlighted move on the board.'],
  ['这一条线已经走完，已记录完成。', 'This line is complete and has been recorded.'],
  ['轮到你走。只接受研讨里准备过的走法。', 'Your move. Only prepared study moves are accepted.'],
  ['当前局面的准备走法已显示。', 'Prepared moves for the current position are shown.'],
  ['这条线已经结束，没有后续准备走法。', 'This line has ended; there are no further prepared moves.'],
  ['全部 variation 已完成。正确率和连对已保留。', 'All variations are complete. Accuracy and streak are preserved.'],
  ['当前没有可返回的开局走法。', 'There is no opening move to step back to.'],
  ['已退回上一个你的选择点，统计不变。', 'Returned to your previous decision point. Stats are unchanged.'],
  ['已回到刚才下过的最终局面；点击“继续下一条”再切换。', 'Returned to the final position you just played. Click Continue to Next Line before switching.'],
  ['已回到刚才下过的局面。', 'Returned to the position you just played.'],
  ['当前还没有可复制的 PGN。', 'There is no PGN to copy yet.'],
  ['当前 PGN 已复制。', 'Current PGN copied.'],
  ['浏览器限制了自动复制，已选中当前 PGN，可按 Ctrl+C 复制。', 'The browser blocked automatic copy. The current PGN is selected; press Ctrl+C to copy it.'],
  ['请选择升变棋子。', 'Choose a promotion piece.'],
  ['当前停在上一条线的最终局面；点击“继续下一条”再开始新的训练。', 'You are paused on the final position of the previous line. Click Continue to Next Line before starting new training.'],
  ['请从棋盘高亮的对手分支里选择一步。', 'Choose one highlighted opponent branch on the board.'],
  ['这步不在你的准备里。看右侧候选走法，重试这一局面。', 'This move is not in your preparation. Check the candidate moves on the right and try this position again.'],
  ['请输入有效的 Lichess Study 链接。', 'Enter a valid Lichess Study link.'],
  ['正在从 Lichess 读取公开研讨 PGN...', 'Reading the public study PGN from Lichess...'],
  ['PGN 为空，请先粘贴或上传内容。', 'The PGN is empty. Paste or upload content first.'],
  ['导入成功但没有找到可训练的走法，请检查 PGN 是否包含主线或变化线。', 'Import succeeded, but no trainable moves were found. Check whether the PGN contains a main line or variations.'],
  ['请先选择一个已有研讨，再用追加按钮合并新内容。', 'Choose an existing study before appending new content.'],
  ['PGN 为空，请先粘贴或上传要追加的内容。', 'The PGN is empty. Paste or upload the content to append first.'],
  ['追加后的 PGN 没有可训练走法，已保持当前研讨不变。', 'The appended PGN has no trainable moves, so the current study was kept unchanged.'],
  ['这个研讨没有可训练的根局面走法。', 'This study has no trainable root-position moves.'],
  ['这个已保存研讨没有可训练走法。', 'This saved study has no trainable moves.'],
  ['请先选择或导入一个研讨。', 'Choose or import a study first.'],
  ['研讨名称不能为空。', 'The study name cannot be empty.']
]);

const TERM_TRANSLATIONS = [
  ['训练目标是把优势转换成实战胜利', 'The training target is to convert the advantage into a practical win'],
  ['训练目标是在明显劣势压力下守和', 'The training target is to hold the draw under clear pressure'],
  ['这里不能只数材料', 'do not judge this only by material'],
  ['必须用主动子力持续限制对方最顽强的防守资源', 'use active pieces to keep restricting the defender’s toughest resources'],
  ['关键是先拆掉对方最直接的赢棋路径', 'first neutralize the opponent’s most direct winning route'],
  ['再用活动性争取半分', 'then use activity to fight for the half point'],
  ['实战线从当前局面一直走到', 'The practical game line runs from this position to'],
  ['训练时要按原局连续执行', 'In training, execute the original game continuation without cutting it short'],
  ['先确认第一手为什么能保留结果', 'first identify why the initial move preserves the result'],
  ['再看每个应手如何迫使计划继续', 'then see how each reply forces the plan to continue'],
  ['最终这条线最终实战赢下', 'This line was eventually won in the actual game'],
  ['最终这条线最终实战守和', 'This line eventually held the draw in the actual game'],
  ['所以训练重点是结果导向', 'so the training focus is result-oriented'],
  ['而不是停在中途评价', 'not a mid-line evaluation shortcut'],
  ['常见错误是看到优势后提前简化或只追求多吃一兵', 'A common mistake is simplifying too early after seeing an advantage or chasing one extra pawn'],
  ['给防守方留下长将、堡垒或远端通路兵反击', 'leaving the defender perpetual checks, fortress chances, or outside-pawn counterplay'],
  ['常见错误是把防守理解成原地等待', 'A common mistake is treating defense as passive waiting'],
  ['在这种压力局面里', 'In this pressure position'],
  ['少走一步主动资源就会让对方把优势稳定兑现', 'missing one active resource lets the opponent stabilize the conversion'],
  ['后残局首先比较王安全和连续将军路线，其次才是兵数。', 'In queen endgames, compare king safety and checking geometry before counting pawns.'],
  ['后加轻子需要同时计算将军节奏、轻子控制格和升变兵。', 'With queen plus minor pieces, calculate checking tempo, minor-piece control, and promotion threats together.'],
  ['车和轻子的活动性比静态兵数更重要，支点一旦被换掉，评价会快速变化。', 'Rook-and-minor activity matters more than static pawn count; once a key support point is exchanged, the evaluation can change quickly.'],
  ['车的入口、横向调动和通路兵速度决定局面归属。', 'Rook entry squares, lateral transfers, and passed-pawn speed decide the position.'],
  ['单车残局的关键是把被动防守转换成侧面将军或兵形反击。', 'In a single-rook ending, the key is converting passive defense into side checks or pawn-structure counterplay.'],
  ['异色象结构里主动权和第二目标往往比物质更重要。', 'In opposite-bishop structures, initiative and a second target often matter more than material.'],
  ['这里的核心不是固定子力类型，而是实战转换、通路兵和防守资源的连续判断。', 'The core is not a fixed material label, but practical transitions, passed pawns, and continuous defensive-resource judgment.'],
  ['关键起点', 'Critical Start'],
  ['中段转换', 'Middlegame-to-Endgame Transition'],
  ['收束阶段', 'Closing Phase'],
  ['这一手直接把前面累积的王位压力兑现为杀棋。', 'This move converts the accumulated king pressure into a direct mate.'],
  ['带将军的节奏迫使对方先处理王安全，强迫性很高。', 'The check forces the opponent to address king safety first, making the sequence highly forcing.'],
  ['升变进入计算核心，双方必须同时比较新后和王位安全。', 'Promotion is now central to the calculation; both sides must compare the new queen and king safety.'],
  ['吃子不是单纯收材料，而是在清除防守支点或升变支撑。', 'The capture is not just material gain; it removes a defensive anchor or promotion support.'],
  ['王的站位决定后续挡将、追兵和反击能否成立。', 'King placement decides whether blocks, pawn chases, and counterplay will work.'],
  ['后的换位用来控制将军节奏，让对方没有舒服的整理手。', 'The queen shift controls the checking rhythm and denies the opponent a comfortable regrouping move.'],
  ['车的横向活动在这里决定主动权，不能只守一个点。', 'The rook’s lateral activity decides the initiative here; it cannot defend only one point.'],
  ['轻子换位是在争关键格，影响王路和通路兵路线。', 'The minor-piece move fights for key squares, shaping king routes and passed-pawn paths.'],
  ['兵形推进改变双方支点，后续计划要围绕新弱格重新组织。', 'The pawn push changes both sides’ support points, so the plan must reorganize around the new weak squares.'],
  ['对方以', 'The opponent replies with'],
  ['应对，说明这不是单步技巧，而是需要继续计算的实战资源。', 'showing this is not a one-move trick but a practical resource that must be calculated further.'],
  ['先读左侧要点，再在棋盘上走第一步', 'Read the key points on the left, then play the first move on the board'],
  ['请在棋盘上走出关键第一步', 'Play the critical first move on the board'],
  ['点击“下一题”继续', 'click Next Task to continue'],
  ['本步答案：', 'Answer for this move: '],
  ['这步不符合本题关键方案。建议走 ', 'This move does not fit the key solution. Suggested move: '],
  ['完成残局题：', 'Completed endgame task: '],
  ['残局训练：', 'Endgame training: '],
  ['白先', 'White to move'],
  ['黑先', 'Black to move'],
  ['把实战优势赢下来', 'convert the practical advantage into a win'],
  ['在压力下走出守和资源', 'find the drawing resource under pressure'],
  ['高水平复杂残局', 'High-level complex endgame'],
  ['目标：赢棋', 'Target: Win'],
  ['目标：守和', 'Target: Hold the Draw'],
  ['目标：待确认', 'Target: Confirm']
];

const ENGINE_PROFILE_TRANSLATIONS = {
  'stockfish-strong': {
    label: 'Stockfish Strong',
    description: 'Prioritizes the strongest move to test whether your preparation survives engine scrutiny.'
  },
  'human-2200': {
    label: 'Human-like 2200',
    description: 'High-level human-like sampling with stronger search and quality filtering.'
  },
  'human-2400': {
    label: 'Human-like 2400',
    description: 'A stronger human-like profile that reduces casual moves and filters larger engine losses.'
  },
  'human-2600': {
    label: 'Human-like 2600',
    description: 'A high-strength human-like profile using Maia candidates with stricter Stockfish filtering.'
  },
  'human-2700': {
    label: 'Approx. 2700',
    description: 'A limited-strength Stockfish approximation tuned for higher-strength sparring.'
  }
};

const CHINESE_RE = /[\u4e00-\u9fff]/;

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function t(locale, key, params = {}) {
  const language = normalizeLocale(locale);
  const template = UI_TEXT[language]?.[key] ?? UI_TEXT.zh[key] ?? key;
  return formatTemplate(template, params);
}

export function translateText(text, locale) {
  if (normalizeLocale(locale) === 'zh') return String(text ?? '');
  const original = String(text ?? '');
  if (!original) return '';
  if (MESSAGE_TRANSLATIONS.has(original)) return MESSAGE_TRANSLATIONS.get(original);

  let translated = original;
  for (const [from, to] of TERM_TRANSLATIONS) {
    translated = translated.split(from).join(to);
  }
  translated = translated
    .replace(/。/g, '. ')
    .replace(/，/g, ', ')
    .replace(/；/g, '; ')
    .replace(/：/g, ': ')
    .replace(/“([^”]+)”/g, '"$1"')
    .replace(/、/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  return translated || original;
}

export function localizeEngineProfile(profile, locale) {
  if (normalizeLocale(locale) === 'zh' || !profile) return profile ? { ...profile } : profile;
  const patch = ENGINE_PROFILE_TRANSLATIONS[profile.id] || {};
  return {
    ...profile,
    label: patch.label || translateText(profile.label, locale),
    description: patch.description || translateText(profile.description, locale)
  };
}

export function localizeEndgameCategory(category, locale) {
  if (normalizeLocale(locale) === 'zh' || !category) return category ? { ...category } : category;
  const patch = CATEGORY_TRANSLATIONS[category.id] || {};
  return {
    ...category,
    title: patch.title || translateText(category.title, locale),
    subtitle: patch.subtitle || translateText(category.subtitle, locale)
  };
}

export function localizeEndgameLesson(lesson, locale) {
  if (normalizeLocale(locale) === 'zh' || !lesson) return lesson ? cloneLesson(lesson) : lesson;
  const translatedTeaching = {
    principle: translateText(lesson.teaching?.principle || '', locale),
    method: translateText(lesson.teaching?.method || '', locale),
    mistake: translateText(lesson.teaching?.mistake || '', locale)
  };
  const translatedHints = (lesson.hints || []).map((hint) => translateText(hint, locale));
  const translatedSteps = (lesson.steps || []).map((step, index) => ({
    ...step,
    note: translateText(step.note || stepNoteFallback(lesson, step, index), locale)
  }));
  const fallback = englishLessonFallback(lesson);

  return {
    ...cloneLesson(lesson),
    title: translateLessonTitle(lesson),
    level: withoutChinese(translateText(lesson.level, locale), 'High-level complex endgame'),
    goal: withoutChinese(translateText(lesson.goal, locale), fallback.goal),
    trainingTargetLabel: targetLabelForLesson(lesson, locale),
    trainingTargetReason: withoutChinese(translateText(lesson.trainingTargetReason, locale), fallback.reason),
    source: lesson.source ? localizeSource(lesson.source, locale) : lesson.source,
    teaching: {
      principle: withoutChinese(translatedTeaching.principle, fallback.principle),
      method: withoutChinese(translatedTeaching.method, fallback.method),
      mistake: withoutChinese(translatedTeaching.mistake, fallback.mistake)
    },
    hints: translatedHints.map((hint, index) => withoutChinese(hint, fallback.hints[index] || fallback.hints[0])),
    steps: translatedSteps.map((step, index) => ({
      ...step,
      note: withoutChinese(step.note, stepNoteFallback(lesson, step, index))
    }))
  };
}

export function applyStaticTranslations(root, locale) {
  if (!root) return;
  const language = normalizeLocale(locale);
  const html = root.documentElement || root.querySelector?.('html');
  if (html) html.lang = language === 'en' ? 'en' : 'zh-CN';
  const body = root.body || root.querySelector?.('body');
  if (body) {
    body.classList.toggle('locale-en', language === 'en');
    body.classList.toggle('locale-zh', language === 'zh');
  }

  root.querySelectorAll?.('[data-i18n]').forEach((element) => {
    element.textContent = t(language, element.dataset.i18n);
  });
  root.querySelectorAll?.('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', t(language, element.dataset.i18nPlaceholder));
  });
  root.querySelectorAll?.('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(language, element.dataset.i18nAriaLabel));
  });
  root.querySelectorAll?.('[data-language-option]').forEach((element) => {
    element.classList.toggle('active', element.dataset.languageOption === language);
    element.setAttribute('aria-pressed', String(element.dataset.languageOption === language));
  });
}

function targetLabelForLesson(lesson, locale) {
  if (lesson?.trainingTarget === 'win') return t(locale, 'endgame.target.win');
  if (lesson?.trainingTarget === 'draw') return t(locale, 'endgame.target.draw');
  return t(locale, 'endgame.target.unknown');
}

function englishLessonFallback(lesson) {
  const side = lesson?.orientation === 'b' ? 'Black' : 'White';
  const result = lesson?.source?.result || 'the game result';
  const source = sourceLabel(lesson?.source);
  const firstMove = lesson?.steps?.[0]?.move || 'the first move';
  const target = lesson?.trainingTarget === 'draw' ? 'hold the draw' : 'convert the win';
  return {
    goal: `${side} to move, ${target}.`,
    reason:
      lesson?.trainingTarget === 'draw'
        ? 'The source game was drawn after the defender found practical resources under pressure.'
        : 'The training side matches the eventual winner and must carry the real-game continuation to the result.',
    principle: `The key task is to evaluate the practical resources in ${source}, not to rely on a static material count.`,
    method: `Start with ${firstMove}, then follow the verified game continuation to ${result}. Focus on how each reply preserves the target result and limits the opponent's most resilient resource.`,
    mistake: `A common mistake is stopping the calculation after the first visible tactic. This task requires following the whole practical sequence before judging the result.`,
    hints: [
      `Begin by checking why ${firstMove} works in the real game continuation.`,
      'Track king safety, active pieces, and passed-pawn speed before deciding whether to simplify.',
      `The training target is to ${target}, so keep the final result in view.`
    ]
  };
}

function stepNoteFallback(lesson, step, index) {
  const phase = index === 0 ? 'Critical start' : index >= Math.max(0, (lesson?.steps?.length || 1) - 2) ? 'Conversion phase' : 'Practical transition';
  const reply = step?.reply ? ` The opponent replies ${step.reply}, so continue calculating the forced sequence.` : '';
  return `${phase}: play ${step?.move || 'the move'}.${reply}`;
}

function withoutChinese(value, fallback) {
  const text = String(value || '').trim();
  if (!text || CHINESE_RE.test(text)) return fallback;
  return text;
}

function sourceLabel(source) {
  const players = [source?.white, source?.black].filter(Boolean).join(' vs ');
  const event = [source?.event, source?.date].filter(Boolean).join(' ');
  return [players, event].filter(Boolean).join(', ') || 'the source game';
}

function translateLessonTitle(lesson) {
  const source = lesson?.source || {};
  const players = [source.white, source.black].filter(Boolean).join(' vs ');
  const event = [source.event, source.date].filter(Boolean).join(' ');
  const target = lesson?.trainingTarget === 'draw' ? 'Defensive Resource' : 'Conversion Task';
  return [players, event, target].filter(Boolean).join(' · ') || translateText(lesson?.title || '', 'en');
}

function localizeSource(source, locale) {
  return {
    ...source,
    chapter: translateText(source.chapter || '', locale),
    note: translateText(source.note || '', locale),
    provider: source.provider ? t(locale, 'endgame.source.publicPgn') : source.provider
  };
}

function cloneLesson(lesson) {
  return {
    ...lesson,
    source: lesson.source ? { ...lesson.source } : lesson.source,
    teaching: lesson.teaching ? { ...lesson.teaching } : lesson.teaching,
    hints: lesson.hints ? [...lesson.hints] : lesson.hints,
    steps: lesson.steps ? lesson.steps.map((step) => ({ ...step })) : lesson.steps
  };
}

function formatTemplate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
}
