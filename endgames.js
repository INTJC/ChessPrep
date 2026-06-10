import { playLegalUciMove } from './app.js';
import { ENDGAME_EXPANSION_LESSONS } from './endgame-expansion-lessons.js';

const BOOK_TITLE = 'Mastering Complex Endgames';

function source({
  example,
  game,
  pdfPage,
  bookPage,
  note,
  chapter = 'Chapter 2: Rook Endgames'
}) {
  const metadata = parseGameMetadata(game);
  return {
    book: BOOK_TITLE,
    chapter,
    example,
    game,
    ...metadata,
    pdfPage,
    bookPage,
    note
  };
}

function parseGameMetadata(game) {
  const text = String(game || '').trim();
  const [playersPart = '', eventPart = ''] = text.split(/,\s*/, 2);
  const [white = '', rawBlack = ''] = playersPart.split(/\s*-\s*/);
  const yearMatch = eventPart.match(/(\d{4}(?:\.\?\?\.\?\?)?)\s*$/);
  const date = yearMatch ? yearMatch[1] : '';
  const event = yearMatch ? eventPart.slice(0, yearMatch.index).trim() : eventPart.trim();
  return {
    white: white.trim() || 'Unknown',
    black: rawBlack.trim() || 'Study position',
    event: event || 'Study',
    date: date || 'unknown'
  };
}

function lineSteps(uciLine, notes = {}) {
  const moves = uciLine.trim().split(/\s+/);
  const steps = [];
  for (let i = 0; i < moves.length; i += 2) {
    const step = { move: moves[i] };
    if (moves[i + 1]) step.reply = moves[i + 1];
    if (notes[i / 2]) step.note = notes[i / 2];
    steps.push(step);
  }
  return steps;
}

export const ENDGAME_CATEGORIES = [
  {
    id: 'rook-activity',
    title: '车残局：主动性',
    subtitle: '弃兵换主动、限制反击、车的位置'
  },
  {
    id: 'king-activity',
    title: '王的活跃',
    subtitle: '用王参与战斗，动态补偿物质损失'
  },
  {
    id: 'practical-themes',
    title: '实战主题',
    subtitle: '弱点、通路兵、主动防守和深度计算'
  },
  {
    id: 'single-rook-defense',
    title: '单车残局：防守',
    subtitle: '反击、换兵、王路和被动防守'
  },
  {
    id: 'rook-minor-activity',
    title: '车轻子残局：主动性',
    subtitle: '异色象、子力活跃、通路兵和防守转换'
  },
  {
    id: 'rook-bishop-knight',
    title: '车象对车马',
    subtitle: '主教配合、马的反击、通路兵和战术资源'
  },
  {
    id: 'queen-endgames',
    title: '后残局',
    subtitle: '王的安全路线、通路兵、长将和后的协调'
  },
  {
    id: 'queen-minor-endgames',
    title: '后轻子残局',
    subtitle: '后象/后马组合、异色象攻击、通路兵和长将资源'
  },
  {
    id: 'opposite-bishop-initiative',
    title: '异色象主动性',
    subtitle: '异色象攻王、堡垒破坏、后象和车象转换'
  }
];

export const ENDGAME_LESSONS = [
{
    id: 'mce-capa-janowski-fix-weaknesses',
    category: 'rook-activity',
    title: '先固定弱点，再推进',
    level: '复杂车残局',
    goal: '白先，建立长期优势',
    fen: '1k2r3/1ppr2pp/p1p2p2/5R2/4P3/1P1P3P/P1P3P1/5RK1 w - - 1 27',
    orientation: 'w',
    source: source({
      example: 8,
      game: 'Capablanca-Janowski, New York 1913',
      pdfPage: 37,
      bookPage: 34,
      note: '根据例 8 图面还原 FEN；同一主线已从 1.g4 补到 28.d5 并用程序校验。'
    }),
    teaching: {
      principle: '复杂车残局里，优势方不要急着“赢东西”，先让对手的结构和反击空间越来越差。',
      method: '先用 g4 固定黑方王翼，再用 b4/a4 限制后翼反击。每一步都在减少黑方可用的突破点。',
      mistake: '一开始就交换或直接冲 g5，会让黑方用 c5、a5 或车的活跃性获得反击。'
    },
    hints: ['第一步不是吃子，而是固定黑方王翼。', '后翼推进要以限制 ...c5 和 ...a5 为目标。'],
    steps: [
      { move: 'g2g4', reply: 'b7b6' },
      { move: 'b3b4', reply: 'b8b7' },
      { move: 'g1f2', reply: 'b6b5' },
      { move: 'a2a4', reply: 'd7d4' },
      { move: 'f1b1', reply: 'e8e5' },
      { move: 'f2e3', reply: 'd4d7' },
      { move: 'a4a5', reply: 'e5e6' },
      { move: 'b1f1', reply: 'd7e7' },
      { move: 'g4g5', reply: 'f6g5' },
      { move: 'f5g5', reply: 'e6h6' },
      { move: 'g5g3', reply: 'h6e6' },
      { move: 'h3h4', reply: 'g7g6' },
      { move: 'g3g5', reply: 'h7h6' },
      { move: 'g5g4', reply: 'e7g7' },
      { move: 'd3d4', reply: 'b7c8' },
      { move: 'f1f8', reply: 'c8b7' },
      { move: 'e4e5', reply: 'g6g5' },
      { move: 'e3e4', reply: 'e6e7' },
      { move: 'h4g5', reply: 'h6g5' },
      { move: 'f8f5', reply: 'b7c8' },
      { move: 'g4g5', reply: 'g7h7' },
      { move: 'g5h5', reply: 'c8d7' },
      { move: 'h5h7', reply: 'e7h7' },
      { move: 'f5f8', reply: 'h7h4' },
      { move: 'e4d3', reply: 'h4h3' },
      { move: 'd3d2', reply: 'c6c5' },
      { move: 'b4c5', reply: 'h3a3' },
      { move: 'd4d5' }
    ]
  },
{
    id: 'mce-capa-tartakower-king-walk',
    category: 'king-activity',
    title: '王走进战场',
    level: '复杂车残局',
    goal: '白先，用王制造杀网',
    fen: '5k2/p1p4R/1pr5/3p1pP1/P2P1P2/2P2K2/8/8 w - - 0 35',
    orientation: 'w',
    source: source({
      example: 18,
      game: 'Capablanca-Tartakower, New York 1924',
      pdfPage: 61,
      bookPage: 58,
      note: '例 18 的著名王路；同一实战主线从 1.Kg3 补到 18.d6 并用程序校验。'
    }),
    teaching: {
      principle: '车残局中物质不是唯一尺度；如果对手王被困在后排，强方王可以成为进攻子力。',
      method: 'Kg3-Kh4-Kg5-Kf6 把王送到进攻核心，同时允许黑车吃兵但无法解除后排压力。',
      mistake: '怕丢兵而把王留在原地，会让黑方车吃掉 c3 后获得实质反击。'
    },
    hints: ['白王要主动靠近黑王，而不是躲避将军。', '允许黑车吃兵，因为黑王的安全更重要。'],
    steps: [
      { move: 'f3g3', reply: 'c6c3' },
      { move: 'g3h4', reply: 'c3f3' },
      { move: 'g5g6', reply: 'f3f4' },
      { move: 'h4g5', reply: 'f4e4' },
      { move: 'g5f6', reply: 'f8g8' },
      { move: 'h7g7', reply: 'g8h8' },
      { move: 'g7c7', reply: 'e4e8' },
      { move: 'f6f5', reply: 'e8e4' },
      { move: 'f5f6', reply: 'e4f4' },
      { move: 'f6e5', reply: 'f4g4' },
      { move: 'g6g7', reply: 'g4g7' },
      { move: 'c7a7', reply: 'g7g1' },
      { move: 'e5d5', reply: 'g1c1' },
      { move: 'd5d6', reply: 'c1c2' },
      { move: 'd4d5', reply: 'c2c1' },
      { move: 'a7c7', reply: 'c1a1' },
      { move: 'd6c6', reply: 'a1a4' },
      { move: 'd5d6' }
    ]
  },
{
    id: 'mce-reprintsev-grigoriants-active-defense',
    category: 'rook-activity',
    title: '黑方先走：保留主动防守',
    level: '双车残局',
    goal: '黑先，选择更实际的防守',
    fen: '5k2/pR3ppr/3rp2p/3p4/3p4/3P1P2/PP4PP/1K5R b - - 0 27',
    orientation: 'b',
    source: source({
      example: 4,
      game: 'Reprintsev-Grigoriants, Russia Cup Moscow 1999',
      pdfPage: 30,
      bookPage: 27,
      note: '根据例 4 图面还原 FEN；27...a6 防守分析线已补到 ...Rf6 并用程序校验。'
    }),
    teaching: {
      principle: '防守方如果只追求保住物质，可能会长期被动；但弃兵换“看似主动”也必须算清楚是否真的有反击。',
      method: '这里黑方更可靠的实战选择是先 ...a6，再用 ...g5 和 ...h5 给白方制造计算压力。',
      mistake: '直接 ...g5 弃掉 a7 兵，看起来改善了王和 h7 车，实际并没有给黑方带来足够反击。'
    },
    hints: ['书中把这个局面作为“物质和主动性取舍”的例子。', '黑方第一步先别急着弃 a7 兵。'],
    steps: [
      { move: 'a7a6', reply: 'h1c1' },
      { move: 'g7g5', reply: 'c1c7' },
      { move: 'h6h5', reply: 'b2b4' },
      { move: 'e6e5', reply: 'a2a4' },
      { move: 'g5g4', reply: 'b4b5' },
      { move: 'a6b5', reply: 'a4b5' },
      { move: 'd6f6' }
    ]
  },
{
    id: 'mce-vanderwiel-ernst-sacrifice-for-seventh-rank',
    category: 'rook-activity',
    title: '弃兵换双车七线',
    level: '双车残局',
    goal: '白先，用活动性压过物质',
    fen: 'r4rk1/p2R3p/1p4p1/6R1/8/1KP5/1P3PPP/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 5,
      game: 'Van der Wiel-Ernst, Dutch Championship Rotterdam 1998',
      pdfPage: 31,
      bookPage: 28,
      note: '根据例 5 图面还原 FEN；同一主线已从 1.Re5 补到 17.Kc4 并用程序校验。'
    }),
    teaching: {
      principle: '双车残局中，进入第七横线的价值有时高于一个兵；关键是活动性是否能持续制造威胁。',
      method: 'Re5 允许黑车吃 f2，但白方随后 Ree7，双车压到七线，黑王和 h7 兵成为长期目标。',
      mistake: '只想着保 f2 兵，会给黑方 ...Rf7 和 ...Re8 的时间，双车优势会被化解。'
    },
    hints: ['第一步要允许黑车吃 f2。', '真正目标是让两只车同时进入第七横线。'],
    steps: [
      { move: 'g5e5', reply: 'f8f2' },
      { move: 'e5e7', reply: 'f2g2' },
      { move: 'e7g7', reply: 'g8h8' },
      { move: 'g7h7', reply: 'h8g8' },
      { move: 'h2h4', reply: 'g2g4' },
      { move: 'd7g7', reply: 'g8f8' },
      { move: 'g7b7', reply: 'f8g8' },
      { move: 'b7g7', reply: 'g8f8' },
      { move: 'h4h5', reply: 'g4h4' },
      { move: 'g7g6', reply: 'a8e8' },
      { move: 'h5h6', reply: 'e8e5' },
      { move: 'g6c6', reply: 'e5b5' },
      { move: 'b3c2', reply: 'h4h2' },
      { move: 'c2d3', reply: 'b5c5' },
      { move: 'c6c5', reply: 'b6c5' },
      { move: 'h7a7', reply: 'h2h6' },
      { move: 'd3c4' }
    ]
  },
{
    id: 'mce-rudyak-naroditsky-open-weaknesses',
    category: 'rook-activity',
    title: '黑方先走：打开多个弱点',
    level: '双车残局',
    goal: '黑先，打开局面',
    fen: '2r3k1/ppp3pp/4p3/3p4/1P1P1r2/3R1P2/P1P1P2P/3K3R b - - 0 1',
    orientation: 'b',
    source: source({
      example: 6,
      game: 'Rudyak-Naroditsky, San Francisco 2008',
      pdfPage: 33,
      bookPage: 30,
      note: '根据例 6 图面还原 FEN；同一实战主线已从 1...b6 补到 32...Rg4 并用程序校验。'
    }),
    teaching: {
      principle: '双车残局里，单个弱点往往还能防；一旦打开局面并制造多个弱点，防守方会被两只车来回调动。',
      method: '黑方先 ...b6，确保 ...c5 突破能打开 a2、c2 等多个目标，而不是只盯着 e2 一个点。',
      mistake: '只按静态平衡看局面，会低估开线后双车攻击多个弱点的威力。'
    },
    hints: ['黑方目标是打开 c 文件和后翼弱点。', '先准备 ...c5，不要急着只攻击 e2。'],
    steps: [
      { move: 'b7b6', reply: 'd1d2' },
      { move: 'c7c5', reply: 'b4c5' },
      { move: 'b6c5', reply: 'd4c5' },
      { move: 'c8c5', reply: 'h1b1' },
      { move: 'f4c4', reply: 'c2c3' },
      { move: 'c5a5', reply: 'b1b7' },
      { move: 'a5a2', reply: 'd2e1' },
      { move: 'a2c2', reply: 'd3e3' },
      { move: 'c4c6', reply: 'b7a7' },
      { move: 'c2c3', reply: 'e3e5' },
      { move: 'g8f8', reply: 'h2h4' },
      { move: 'c3c4', reply: 'e5g5' },
      { move: 'c6c7', reply: 'a7a8' },
      { move: 'f8f7', reply: 'h4h5' },
      { move: 'h7h6', reply: 'g5e5' },
      { move: 'c4h4', reply: 'a8a6' },
      { move: 'c7e7', reply: 'e2e3' },
      { move: 'h4h2', reply: 'e1f1' },
      { move: 'e7b7', reply: 'f1g1' },
      { move: 'h2c2', reply: 'a6a1' },
      { move: 'f7f6', reply: 'f3f4' },
      { move: 'b7b3', reply: 'a1e1' },
      { move: 'b3b2', reply: 'e3e4' },
      { move: 'd5d4', reply: 'e1d1' },
      { move: 'd4d3', reply: 'e5a5' },
      { move: 'c2e2', reply: 'e4e5' },
      { move: 'f6f5', reply: 'a5a3' },
      { move: 'd3d2', reply: 'g1f1' },
      { move: 'e2e4', reply: 'a3g3' },
      { move: 'e4f4', reply: 'f1e2' },
      { move: 'f4e4', reply: 'e2f1' },
      { move: 'e4g4' }
    ]
  },
{
    id: 'mce-varavin-ozolin-activate-rook',
    category: 'rook-activity',
    title: '先活化车，再攻弱点',
    level: '复杂车残局',
    goal: '白先，协调攻防',
    fen: 'r5k1/1r4pp/p1p5/4p3/8/8/PPR2PPP/5RK1 w - - 1 23',
    orientation: 'w',
    source: source({
      example: 9,
      game: 'Varavin-Ozolin, Russia Cup Perm 1997',
      pdfPage: 40,
      bookPage: 37,
      note: '书中给出完整棋谱；从 23.Re1 到 66.Rb7 的同一实战线已合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '当对手还有反击资源时，优势方不能只慢慢“改善”；必须先处理对手的直接反击点。',
      method: 'Re1 让 f1 车活化，同时准备压 e5/c6；这比盲目吃兵更符合攻防平衡。',
      mistake: '只想着赢 c6/e5，却忘了黑方可以攻击 b2 或用 a 兵制造反击。'
    },
    hints: ['先让闲置的 f1 车参与。', '白方要同时攻击弱点和防守 b2。'],
    steps: [
      { move: 'f1e1', reply: 'b7b5' },
      { move: 'e1e2', reply: 'a8b8' },
      { move: 'b2b3', reply: 'a6a5' },
      { move: 'h2h3', reply: 'b8b6' },
      { move: 'e2e4', reply: 'b5b4' },
      { move: 'e4e5', reply: 'a5a4' },
      { move: 'b3a4', reply: 'b4a4' },
      { move: 'e5e7', reply: 'a4d4' },
      { move: 'e7a7', reply: 'h7h6' },
      { move: 'a2a4', reply: 'b6b1' },
      { move: 'g1h2', reply: 'b1a1' },
      { move: 'a4a5', reply: 'd4d5' },
      { move: 'a5a6', reply: 'c6c5' },
      { move: 'c2e2', reply: 'd5d6' },
      { move: 'e2e7', reply: 'd6g6' },
      { move: 'h3h4', reply: 'c5c4' },
      { move: 'h4h5', reply: 'g6g5' },
      { move: 'f2f4', reply: 'g5h5' },
      { move: 'h2g3', reply: 'a1a3' },
      { move: 'g3g4', reply: 'h5h2' },
      { move: 'e7g7', reply: 'g8h8' },
      { move: 'g7g6', reply: 'h2g2' },
      { move: 'g4f5', reply: 'g2g6' },
      { move: 'f5g6', reply: 'a3g3' },
      { move: 'g6h6', reply: 'g3h3' },
      { move: 'h6g6', reply: 'h3g3' },
      { move: 'g6f6', reply: 'g3a3' },
      { move: 'f6g6', reply: 'a3g3' },
      { move: 'g6f5', reply: 'g3a3' },
      { move: 'f5e4', reply: 'h8g8' },
      { move: 'f4f5', reply: 'g8f8' },
      { move: 'e4d4', reply: 'c4c3' },
      { move: 'd4d3', reply: 'a3a5' },
      { move: 'd3c3', reply: 'a5c5' },
      { move: 'c3b4', reply: 'c5c6' },
      { move: 'b4b5', reply: 'c6f6' },
      { move: 'a7c7', reply: 'f6f5' },
      { move: 'b5b6', reply: 'f5f1' },
      { move: 'a6a7', reply: 'f1b1' },
      { move: 'b6c6', reply: 'b1c1' },
      { move: 'c6b7', reply: 'c1b1' },
      { move: 'b7c8', reply: 'b1a1' },
      { move: 'c8b8', reply: 'a1b1' },
      { move: 'c7b7' }
    ]
  },
{
    id: 'mce-sahovic-kortchnoi-h5-break',
    category: 'practical-themes',
    title: '黑方先走：强制 h5+',
    level: '双车战术',
    goal: '黑先，打开杀王路线',
    fen: '8/1p6/p4k1p/3r2p1/1PP1p1KP/4Pr2/1P2R3/4R3 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 10,
      game: 'Sahovic-Kortchnoi, Biel 1979',
      pdfPage: 44,
      bookPage: 41,
      note: '根据例 10 图面还原 FEN；整条杀法用程序校验到将死。'
    }),
    teaching: {
      principle: '双车残局有时必须用动态手段解决对方即将控制开放线的问题，慢手会让优势消失。',
      method: '...h5+ 逼白王来到 h5，随后 ...Rd8 把黑车快速调到 h 线，形成强制杀网。',
      mistake: '普通的 ...Rd8 太慢，白方 hxg5+ 和 Rh1 会控制 h 线。'
    },
    hints: ['黑方要先阻止白方控制 h 线。', '第一步是带将的 h 兵推进。'],
    steps: [
      { move: 'h6h5', reply: 'g4h5' },
      { move: 'd5d8', reply: 'h4g5' },
      { move: 'f6f5', reply: 'h5h6' },
      { move: 'f3h3', reply: 'h6g7' },
      { move: 'd8d7', reply: 'g7g8' },
      { move: 'f5g6', reply: 'e2f2' },
      { move: 'd7g7', reply: 'g8f8' },
      { move: 'h3h8' }
    ]
  },
{
    id: 'mce-petrosian-larsen-switch-to-king-attack',
    category: 'king-activity',
    title: '转向攻王，而不是吃兵',
    level: '双车战术',
    goal: '白先，启动双车攻王',
    fen: '3R4/5kp1/5p2/7R/1r3PKP/6P1/1r6/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 11,
      game: 'Petrosian-Larsen, Biel Interzonal 1976',
      pdfPage: 45,
      bookPage: 42,
      note: '根据例 11 图面还原 FEN；同一攻王主线已补到 7...Rb5+ 并用程序校验。'
    }),
    teaching: {
      principle: '物质很少时，继续吃兵未必能赢；如果对方王无法获得车的保护，攻王可能是唯一有力方案。',
      method: 'Rhh8 把车转到 h 线，随后 Rhf8+ 把黑王切离兵群，再用王进入 f5/g6。',
      mistake: '只围绕兵形思考，会错过黑王被困的动态弱点。'
    },
    hints: ['先把 h5 的车转到 h8。', '目标是把黑王从自己的兵群切开。'],
    steps: [
      { move: 'h5h8', reply: 'b4b7' },
      { move: 'h8f8', reply: 'f7e7' },
      { move: 'g4f5', reply: 'b2b3' },
      { move: 'g3g4', reply: 'b3g3' },
      { move: 'd8e8', reply: 'e7d6' },
      { move: 'g4g5', reply: 'f6g5' },
      { move: 'h4g5', reply: 'b7b5' }
    ]
  },
{
    id: 'mce-polgar-minev-safe-option',
    category: 'practical-themes',
    title: '高风险选择后的完整防守',
    level: '风险决策',
    goal: '白先，进入实战主线并处理黑方主动防守',
    fen: '4r2k/pR4p1/7p/5r2/4p3/P5P1/1P5P/2R3K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 12,
      game: 'I. Polgar-Minev, Asztalos Memorial Baja 1971',
      pdfPage: 47,
      bookPage: 44,
      note: '根据例 12 图面还原 FEN；同一实战主线已从 1.Rxa7 补到 32...Rh1 并用程序校验。'
    }),
    teaching: {
      principle: '复杂残局里，选了高风险方案之后，后续不能靠惯性；防守方会用主动性和侧翼反击持续制造问题。',
      method: 'Rxa7 之后黑方 ...Rd8、...Rd1+ 和 ...Rb1 迅速活化。白方必须一路保持车和王的协调，直到单车残局收束。',
      mistake: '只看到多兵和通路兵，忽略黑方车活跃后的长防守资源。'
    },
    hints: ['先按实战高风险主线进入。', '黑方会用车的活跃性抵消白方通路兵。'],
    steps: [
      { move: 'b7a7', reply: 'e8d8', note: '实战选择吃 a7，黑方立即用 ...Rd8 活化。' },
      { move: 'c1c2', reply: 'd8d1' },
      { move: 'g1g2', reply: 'f5d5' },
      { move: 'c2e2', reply: 'd1b1' },
      { move: 'a7e7', reply: 'd5d4' },
      { move: 'g2f2', reply: 'h8g8' },
      { move: 'f2e3', reply: 'd4d3' },
      { move: 'e3e4', reply: 'd3b3' },
      { move: 'e7a7', reply: 'b1b2' },
      { move: 'e2b2', reply: 'b3b2' },
      { move: 'h2h4', reply: 'b2g2' },
      { move: 'e4f3', reply: 'g2c2' },
      { move: 'a7e7', reply: 'c2a2' },
      { move: 'e7e3', reply: 'g8f7' },
      { move: 'f3e4', reply: 'f7e6' },
      { move: 'e4d4', reply: 'e6d6' },
      { move: 'd4c4', reply: 'a2a1' },
      { move: 'c4b4', reply: 'a1b1' },
      { move: 'e3b3', reply: 'b1f1' },
      { move: 'b4b5', reply: 'f1f8' },
      { move: 'a3a4', reply: 'f8b8' },
      { move: 'b5c4', reply: 'b8c8' },
      { move: 'c4d4', reply: 'c8a8' },
      { move: 'b3a3', reply: 'a8a5' },
      { move: 'd4c4', reply: 'd6c6' },
      { move: 'c4b4', reply: 'a5e5' },
      { move: 'a3c3', reply: 'c6b6' },
      { move: 'g3g4', reply: 'g7g6' },
      { move: 'c3c4', reply: 'e5e1' },
      { move: 'c4f4', reply: 'e1b1' },
      { move: 'b4c4', reply: 'b6a5' },
      { move: 'c4d5', reply: 'b1h1', note: '黑车吃 h 兵后双方同意和棋，完整实战线到此结束。' }
    ]
  },
{
    id: 'mce-naroditsky-aliyev-forced-defense',
    category: 'single-rook-defense',
    title: '单车防守：先走强制步',
    level: '单车残局',
    goal: '白先，先完成强制防守',
    fen: '8/7p/p1R2pp1/5k2/1P1P4/1r4P1/5K1P/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 13,
      game: 'Naroditsky-Aliyev, Philadelphia 2007',
      pdfPage: 52,
      bookPage: 49,
      note: '根据例 13 图面还原 FEN；同一防守主线已补到 17.Rc3 并用程序校验。'
    }),
    teaching: {
      principle: '防守单车残局时，不要一开始就幻想反击；先把对手的强制威胁处理掉，才能进入真正计算。',
      method: 'Rxa6 先消除 a 兵，随后 Rd6 和 Kg1 都是围绕防守 f6、d4 和王侧反击的强制应对。',
      mistake: '忽略对方 ...Rb2+ 和 ...Rd2 的节奏，会让防守方王和 d 兵同时受压。'
    },
    hints: ['先吃掉最直接的 a 兵。', '之后车要回到 d 文件防守。'],
    steps: [
      { move: 'c6a6', reply: 'b3b4' },
      { move: 'a6d6', reply: 'b4b2' },
      { move: 'f2g1', reply: 'b2d2' },
      { move: 'h2h3', reply: 'h7h5' },
      { move: 'g1f1', reply: 'g6g5' },
      { move: 'f1g1', reply: 'd2e2' },
      { move: 'g1h1', reply: 'e2f2' },
      { move: 'h1g1', reply: 'f2f3' },
      { move: 'g1g2', reply: 'f3a3' },
      { move: 'g3g4', reply: 'h5g4' },
      { move: 'h3g4', reply: 'f5g4' },
      { move: 'd6f6', reply: 'a3d3' },
      { move: 'f6a6', reply: 'd3d2' },
      { move: 'g2g1', reply: 'd2d4' },
      { move: 'a6a3', reply: 'g4f4' },
      { move: 'a3b3', reply: 'd4a4' },
      { move: 'b3c3' }
    ]
  },
{
    id: 'mce-lasker-levenfish-king-counterplay',
    category: 'single-rook-defense',
    title: '绝境里先接住机会',
    level: '单车残局',
    goal: '白先，走向唯一反击路线',
    fen: 'r4k2/5p2/4p1p1/p3P3/R4PpP/5K2/8/8 w - - 0 2',
    orientation: 'w',
    source: source({
      example: 14,
      game: 'Lasker-Levenfish, Moscow 1925',
      pdfPage: 54,
      bookPage: 51,
      note: '例 14 中 1...hxg4+ 后的反击路线；已补到书中 12.Ra2= 的守和资源并用程序校验。'
    }),
    teaching: {
      principle: '即使局面看起来完全被动，只要对手走出自然但松动结构的一步，防守方就要立刻重新寻找反击。',
      method: '白王先吃回 g4，再沿 g5-h6-g7 前进，迫使黑王走到 c6；这个王路为后面的 f5 反击创造条件。',
      mistake: '因为局面难看就机械防守，会错过对方刚刚给出的唯一动态机会。'
    },
    hints: ['先把 g4 兵吃掉，让王走向主动格。', '白王要去 g7，而不是退回防守。'],
    steps: [
      { move: 'f3g4', reply: 'f8e7' },
      { move: 'g4g5', reply: 'a8a7' },
      { move: 'g5h6', reply: 'e7d7' },
      { move: 'h6g7', reply: 'd7c6' },
      { move: 'f4f5', reply: 'e6f5' },
      { move: 'e5e6', reply: 'f7e6' },
      { move: 'g7g6', reply: 'c6b5' },
      { move: 'a4a1', reply: 'a5a4' },
      { move: 'h4h5', reply: 'a7a8' },
      { move: 'h5h6', reply: 'a4a3' },
      { move: 'a1a2' }
    ]
  },
{
    id: 'mce-dvoirys-tseitlin-a-pawn-counterplay',
    category: 'single-rook-defense',
    title: '用 a 兵反击被锁住的黑车',
    level: '单车残局',
    goal: '白先，抓住 ...c2 的缺陷',
    fen: '8/5p2/7p/4kPp1/1K6/1P3RP1/P1pr3P/8 w - - 0 2',
    orientation: 'w',
    source: source({
      example: 15,
      game: 'Dvoirys-M.D. Tseitlin, Beer-Sheva 1997',
      pdfPage: 55,
      bookPage: 52,
      note: '例 15 中 1...c2? 后的反击片段；同一主线已补到 9.Rc4+ 并用程序校验。'
    }),
    teaching: {
      principle: '当对手的通路兵推进反而锁住自己的车，防守方必须马上把另一翼的通路兵变成实际威胁。',
      method: 'Rc3 先挡住 c 兵，再允许黑车吃 h2；关键是立刻 a4-a5-a6，把黑方逼进升变竞赛。',
      mistake: '如果白方只守 h2 或等待，黑方 c 兵和王翼兵会给白方太多防守任务。'
    },
    hints: ['先挡住 c 兵，而不是保 h2。', '反击资源在 a 兵。'],
    steps: [
      { move: 'f3c3', reply: 'd2h2' },
      { move: 'a2a4', reply: 'e5f5' },
      { move: 'a4a5', reply: 'f5g4' },
      { move: 'a5a6', reply: 'h2g2' },
      { move: 'a6a7', reply: 'c2c1q' },
      { move: 'c3c1', reply: 'g2a2' },
      { move: 'c1c4' }
    ]
  },
{
    id: 'mce-kramnik-ivanchuk-patient-defense',
    category: 'single-rook-defense',
    title: '黑方先走：耐心比反击更强',
    level: '单车残局',
    goal: '黑先，选择不冒进的防守',
    fen: '6k1/5p2/4pp2/7p/2KP3P/4P3/r4PP1/5R2 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 16,
      game: 'Kramnik-Ivanchuk, Linares 1998',
      pdfPage: 57,
      bookPage: 54,
      note: '例 16 初始图面还原 FEN；同一防守主线已从 1...f5 补到 33...Rh5 并用程序校验。'
    }),
    teaching: {
      principle: '防守方不是每次都要找主动反击；如果反击会破坏结构，耐心等待反而能让优势方先表态。',
      method: '黑方先 ...f5 固定王翼，再用 ...Kf8 继续等待。白方 d5 看似主动，但黑方没有提前给出弱点。',
      mistake: '急着 ...e5 寻求反击，会让白方王和车迅速进入，原本可守的局面变成明显劣势。'
    },
    hints: ['先不要走 ...e5。', '黑方要用不冒进的兵和王位等待白方选择计划。'],
    steps: [
      { move: 'f6f5', reply: 'd4d5' },
      { move: 'g8f8', reply: 'd5e6' },
      { move: 'f7e6', reply: 'c4d4' },
      { move: 'f8e7', reply: 'd4e5' },
      { move: 'a2a4', reply: 'f2f3' },
      { move: 'a4a5', reply: 'e5f4' },
      { move: 'a5a2', reply: 'f1b1' },
      { move: 'e7f6', reply: 'f4g3' },
      { move: 'a2e2', reply: 'b1b3' },
      { move: 'e6e5', reply: 'b3b6' },
      { move: 'f6g7', reply: 'b6b3' },
      { move: 'g7f6', reply: 'b3a3' },
      { move: 'f6g6', reply: 'g3h3' },
      { move: 'g6f6', reply: 'g2g4' },
      { move: 'h5g4', reply: 'f3g4' },
      { move: 'f5g4', reply: 'h3g4' },
      { move: 'f6g6', reply: 'h4h5' },
      { move: 'g6h6', reply: 'a3a6' },
      { move: 'h6h7', reply: 'a6a3' },
      { move: 'h7h6', reply: 'g4f5' },
      { move: 'e5e4', reply: 'f5e4' },
      { move: 'h6h5', reply: 'e4f5' },
      { move: 'e2f2', reply: 'f5e6' },
      { move: 'f2e2', reply: 'e6f5' },
      { move: 'e2f2', reply: 'f5e5' },
      { move: 'h5g6', reply: 'e3e4' },
      { move: 'f2b2', reply: 'a3a7' },
      { move: 'b2b5', reply: 'e5e6' },
      { move: 'b5b6', reply: 'e6e7' },
      { move: 'b6b5', reply: 'a7a6' },
      { move: 'g6g5', reply: 'a6e6' },
      { move: 'g5f4', reply: 'e7f6' },
      { move: 'b5h5' }
    ]
  },
{
    id: 'mce-naroditsky-nip-fortress-patience',
    category: 'single-rook-defense',
    title: '黑方先走：别急着反击弱点',
    level: '单车残局',
    goal: '黑先，守住 d5 弱兵',
    fen: '8/3r1k2/p6p/1p1p2pP/3R2P1/2P3K1/PP6/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 17,
      game: 'Naroditsky-Nip, San Francisco 2007',
      pdfPage: 59,
      bookPage: 56,
      note: '例 17 初始图面还原 FEN；同一防守主线已补到 12...Rf8 并用程序校验。'
    }),
    teaching: {
      principle: '劣势方如果能把所有弱点互相保护起来，就不要为了“找反击”破坏堡垒。',
      method: '...Ke6 让王贴住 d5，随后 ...Rf7 和 ...Kd6 反复守住关键点。白车虽活跃，但没有白王配合就难以突破。',
      mistake: '急着 ...Re7 之类主动出击，会让白方吃 d5 并保留健康多兵。'
    },
    hints: ['先用王守住 d5。', '车随后回到 f 线，守住王翼和第七横线。'],
    steps: [
      { move: 'f7e6', reply: 'd4d1' },
      { move: 'd7f7', reply: 'd1e1' },
      { move: 'e6d6', reply: 'e1e8' },
      { move: 'f7f6', reply: 'b2b3' },
      { move: 'd6d7', reply: 'e8e3' },
      { move: 'd7d6', reply: 'a2a3' },
      { move: 'd6c5', reply: 'e3e8' },
      { move: 'c5d6', reply: 'e8g8' },
      { move: 'd6e7', reply: 'g8c8' },
      { move: 'e7d7', reply: 'c8c5' },
      { move: 'd7d6', reply: 'b3b4' },
      { move: 'f6f8' }
    ]
  },
{
    id: 'mce-naroditsky-study-safe-not-enough',
    category: 'practical-themes',
    title: '别停在安全线，算清强制赢法',
    level: '计算取舍',
    goal: '白先，放弃安全吃兵并打出强制路线',
    fen: '2r4k/1R6/8/1p3P1K/2p5/8/6P1/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 19,
      game: 'Naroditsky, Study position 2009',
      pdfPage: 62,
      bookPage: 59,
      note: '例 19 图面还原 FEN；同一研究主线已从 1.f6 补到 4.Rxb5 并用程序校验。'
    }),
    teaching: {
      principle: '有安全选择时，不能只问“会不会输”；还要问它是否放弃了赢棋机会。',
      method: 'Rxb5 能保证不输但只能和；f6! 直接限制黑方通路兵和王，随后 Kg6-Kf7 逼黑车失去协调。',
      mistake: '把“至少和棋”误判为“足够好”，会错过更强的直接攻王方案。'
    },
    hints: ['先确认安全吃 b5 只能和。', '用 f 兵先制造强制攻势。'],
    steps: [
      { move: 'f5f6', reply: 'c8f8', note: 'f6! 比安全吃兵更强，先把黑方逼入被动。' },
      { move: 'h5g6', reply: 'f8g8' },
      { move: 'g6f7', reply: 'g8g2' },
      { move: 'b7b5', note: '白车最后再吃 b5，黑方已经无法组织有效反击。' }
    ]
  },
{
    id: 'mce-gutman-hertneck-simple-win',
    category: 'practical-themes',
    title: '赢棋时别制造额外风险',
    level: '计算取舍',
    goal: '黑先，选择最干净赢法',
    fen: '8/6R1/7p/1p1k1P2/1P1p2P1/1Kp4P/P3r3/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 20,
      game: 'Gutman-Hertneck, German Championship Bremen 1998',
      pdfPage: 64,
      bookPage: 61,
      note: '例 20 图面还原 FEN；安全赢法 1...c2 2.Rc7 d3 3.f6 Rf2 4.f7 Rxf7 用程序校验。'
    }),
    teaching: {
      principle: '已经有清晰赢法时，不需要为了“更漂亮”而进入复杂分支；残局里额外风险常常来自不必要的主动。',
      method: '黑方直接 ...c2，让白车被迫回防，再用 ...d3 和 ...Rf2 接住 f 兵，胜势清楚。',
      mistake: '实战的 ...Rb2+ 也许仍能赢，但给白方制造了反击分支；强方应该优先选择最少变数的方案。'
    },
    hints: ['先推进更靠近升变的 c 兵。', '白车回防后，再让 d 兵加入。'],
    steps: [
      { move: 'c3c2', reply: 'g7c7', note: 'c 兵先上二线，白车必须回防。' },
      { move: 'd4d3', reply: 'f5f6', note: 'd 兵加入，黑方双通路兵形成决定性压力。' },
      { move: 'e2f2', reply: 'f6f7', note: '黑车到 f2，准备消灭白方唯一反击兵。' },
      { move: 'f2f7', note: '吃掉 f7 后，黑方通路兵决定胜负。' }
    ]
  },
  {
    id: 'mce-naroditsky-study-safe-ra1',
    category: 'practical-themes',
    title: '安全挡兵并不保证赢',
    level: '计算取舍',
    goal: '白先，对比安全方案',
    fen: '2r4k/5Kp1/1P4P1/6Pp/R1p4P/2P5/7p/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 21,
      game: 'Naroditsky, Study position 2009',
      pdfPage: 65,
      bookPage: 62,
      note: '例 21 图面还原 FEN；安全线已从 1.Ra1 补到 7...Kf7 并用程序校验。'
    }),
    teaching: {
      principle: '安全方案能解决眼前威胁，但未必能保留足够赢棋力量；复杂残局要比较方案上限。',
      method: 'Ra1 先挡 h 兵，随后白车被迫长期处理 h 兵和 c 兵。即便白方更好，胜负并不清楚。',
      mistake: '只看到 h2 兵危险就机械防守，会错过更强的 b7 直接升变方案。'
    },
    hints: ['先挡住 h 兵是安全方案。', '注意黑车会从 b 线给将并靠近 b6/c4。'],
    steps: [
      { move: 'a4a1', reply: 'c8b8' },
      { move: 'a1b1', reply: 'b8b7' },
      { move: 'f7e6', reply: 'h8g8' },
      { move: 'e6d6', reply: 'h2h1q' },
      { move: 'b1h1', reply: 'b7b6' },
      { move: 'd6c5', reply: 'b6g6' },
      { move: 'c5c4', reply: 'g8f7' }
    ]
  },
  {
    id: 'mce-rubinstein-reti-activity-over-pawns',
    category: 'rook-activity',
    title: '弃兵换子力活跃',
    level: '单车技术',
    goal: '白先，用王车活化兑现弱点',
    fen: '3k4/p5pp/2p5/4P3/2K5/2p1PP2/r5PP/2R5 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 22,
      game: 'Rubinstein-Reti, Berlin 1928',
      pdfPage: 66,
      bookPage: 63,
      note: '例 22 图面还原 FEN；同一实战主线已从 1.f4! 补到 30.e6+ 并用程序校验。'
    }),
    teaching: {
      principle: '技术残局中，优势方有时要允许对方吃几个兵，换来王和车的最佳位置。',
      method: 'f4! 先固定并制造 e 兵潜力，随后 Rxc3-Ra3-Rxa7，白王走到 e4/d3/e2，黑方弱兵无法全守。',
      mistake: '机械保住王翼兵会让白车被动，黑方反而能用车和王接近防守。'
    },
    hints: ['第一步不是防守 g2，而是推进 f 兵。', '白车要从 c 线转向 a 线，先攻击 a7。'],
    steps: [
      { move: 'f3f4', reply: 'a2g2', note: 'f4! 允许黑车吃 g2，白方换取主动。' },
      { move: 'c1c3', reply: 'd8d7' },
      { move: 'c3a3', reply: 'd7e6' },
      { move: 'a3a7', reply: 'h7h5' },
      { move: 'h2h4', reply: 'g2g4' },
      { move: 'c4d4', reply: 'g7g6' },
      { move: 'a7g7', reply: 'g4g1' },
      { move: 'd4e4', reply: 'g1g2' },
      { move: 'g7c7', reply: 'g2c2' },
      { move: 'e4d3', reply: 'c2c1' },
      { move: 'e3e4', reply: 'c1d1' },
      { move: 'd3e2', reply: 'd1c1' },
      { move: 'e2d2', reply: 'c1c4' },
      { move: 'd2d3', reply: 'c4c1' },
      { move: 'c7g7', reply: 'c1d1' },
      { move: 'd3e3', reply: 'd1e1' },
      { move: 'e3d4', reply: 'e1d1' },
      { move: 'd4c5', reply: 'd1c1' },
      { move: 'c5b6', reply: 'c6c5' },
      { move: 'g7g6', reply: 'e6e7' },
      { move: 'f4f5', reply: 'c1e1' },
      { move: 'b6c6', reply: 'e1e4' },
      { move: 'c6d5', reply: 'e4h4' },
      { move: 'g6g7', reply: 'e7f8' },
      { move: 'f5f6', reply: 'h4f4' },
      { move: 'd5e6', reply: 'f4a4' },
      { move: 'g7c7', reply: 'a4a6' },
      { move: 'e6f5', reply: 'h5h4' },
      { move: 'c7c8', reply: 'f8f7' },
      { move: 'e5e6', note: 'e 兵推进到 e6 后，黑方防线崩溃。' }
    ]
  },
  {
    id: 'mce-shipman-naroditsky-create-second-weakness',
    category: 'rook-activity',
    title: '先制造第二弱点',
    level: '单车技术',
    goal: '白先，限制黑王后再推进王翼',
    fen: '8/p1k1rp2/6p1/1p6/2p2R2/2P4P/PP4P1/5K2 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 23,
      game: 'Shipman-Naroditsky, Berkeley 2007',
      pdfPage: 68,
      bookPage: 65,
      note: '例 23 图面还原 FEN；同一实战主线已从 1.a4! 补到 27.h7 并用程序校验。'
    }),
    teaching: {
      principle: '看到一个好计划时，不一定马上执行；如果对手没有反击，可以先制造额外弱点。',
      method: 'a4! 迫使 ...a6，随后 Rf6 和 a5 把黑王绑在 a6 上，再用 h4/g4 开始王翼计划。',
      mistake: '过早 Rxf7+ 看似自然，却把车放到较差位置，给黑方更多防守机会。'
    },
    hints: ['先让黑方后翼出现第二个弱点。', '王翼推进前，白车要先切断黑王。'],
    steps: [
      { move: 'a2a4', reply: 'a7a6', note: 'a4! 利用 c4 兵的位置，迫使黑方制造 a6 弱点。' },
      { move: 'f4f6', reply: 'c7b7' },
      { move: 'a4a5', reply: 'e7d7' },
      { move: 'f1e1', reply: 'd7e7' },
      { move: 'e1d2', reply: 'b7a7' },
      { move: 'h3h4', reply: 'a7b7' },
      { move: 'g2g4', reply: 'e7e4' },
      { move: 'f6f7', reply: 'b7b8', note: 'Rxf7+ 不是终点，后面仍是同一技术主线。' },
      { move: 'h4h5', reply: 'g6h5' },
      { move: 'g4h5', reply: 'e4h4' },
      { move: 'f7h7', reply: 'h4h2' },
      { move: 'd2c1', reply: 'h2h1' },
      { move: 'c1c2', reply: 'b8a8' },
      { move: 'h5h6', reply: 'a8b8' },
      { move: 'c2d2', reply: 'h1h3' },
      { move: 'd2e2', reply: 'b8a8' },
      { move: 'e2f2', reply: 'a8b8' },
      { move: 'f2g2', reply: 'h3h5' },
      { move: 'g2g3', reply: 'b8a8' },
      { move: 'g3g4', reply: 'h5h2' },
      { move: 'g4g5', reply: 'h2g2' },
      { move: 'g5f5', reply: 'a8b8' },
      { move: 'h7g7', reply: 'g2f2' },
      { move: 'f5e6', reply: 'f2e2' },
      { move: 'e6d5', reply: 'e2d2' },
      { move: 'd5c5', reply: 'd2h2' },
      { move: 'h6h7', note: 'h 兵到 h7，实战主线到此结束。' }
    ]
  },
  {
    id: 'mce-karpov-hort-keep-pawns-on-board',
    category: 'practical-themes',
    title: '保留兵越多，弱点越难守',
    level: '单车技术',
    goal: '白先，逐步压住双弱点',
    fen: '4r1k1/p5pp/4p3/8/8/4R1P1/4PPKP/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 24,
      game: 'Karpov-Hort, Waddinxveen 1979',
      pdfPage: 70,
      bookPage: 67,
      note: '例 24 图面还原 FEN；同一实战主线已从 1.Ra3! 补到 30.Ra6+ 并用程序校验。'
    }),
    teaching: {
      principle: '对弱点作战时，尽量保留更多兵。棋盘上目标越多，防守方越难同时守住。',
      method: 'Ra3-Ra5 先限制 ...h5，再用 h4/g4/f4 扩张；白方不急于换兵，让 a7 和 e6 都长期难受。',
      mistake: '过早换掉王翼兵会减少黑方防守任务，使车残局更接近理论和棋。'
    },
    hints: ['先把车放到能攻击 a7 又限制 h 兵的位置。', '王翼推进要保留张力。'],
    steps: [
      { move: 'e3a3', reply: 'e8e7', note: 'Ra3! 盯住 a7，同时准备横向转移。' },
      { move: 'a3a5', reply: 'g8f7' },
      { move: 'h2h4', reply: 'h7h6' },
      { move: 'g3g4', reply: 'f7f6' },
      { move: 'f2f4', reply: 'e7b7' },
      { move: 'g2f3', reply: 'b7c7' },
      { move: 'a5a6', reply: 'g7g6' },
      { move: 'a6a5', reply: 'c7d7' },
      { move: 'e2e3', reply: 'd7b7' },
      { move: 'h4h5', reply: 'g6g5' },
      { move: 'a5a6', reply: 'g5f4' },
      { move: 'e3f4', reply: 'b7b3' },
      { move: 'f3g2', reply: 'b3b7' },
      { move: 'g2g3', reply: 'f6f7' },
      { move: 'a6a4', reply: 'f7g7' },
      { move: 'g4g5', reply: 'b7c7' },
      { move: 'a4a5', reply: 'g7g8' },
      { move: 'a5b5', reply: 'g8f7' },
      { move: 'g3g4', reply: 'a7a6' },
      { move: 'b5b8', reply: 'c7c1' },
      { move: 'g5g6', reply: 'f7g7' },
      { move: 'b8b7', reply: 'g7f8' },
      { move: 'b7b6', reply: 'c1g1' },
      { move: 'g4f3', reply: 'g1f1' },
      { move: 'f3e4', reply: 'f1e1' },
      { move: 'e4d4', reply: 'f8e7' },
      { move: 'b6a6', reply: 'e7f6' },
      { move: 'a6a7', reply: 'e6e5' },
      { move: 'f4e5', reply: 'e1e5' },
      { move: 'a7a6', note: 'Ra6+ 收束，黑方无力再守。' }
    ]
  },
  {
    id: 'mce-naroditsky-martinez-set-practical-hurdles',
    category: 'single-rook-defense',
    title: '输棋也要设置最后障碍',
    level: '单车防骗',
    goal: '黑先，制造实战难题',
    fen: '1R6/1P4p1/6k1/7p/1r3P2/6PP/4K3/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 25,
      game: 'Naroditsky-Martinez, US Chess League 2008',
      pdfPage: 73,
      bookPage: 70,
      note: '例 25 图面还原 FEN；同一实战防骗线已从 1...Rb3! 补到 22...Rxb7 并用程序校验。'
    }),
    teaching: {
      principle: '即使局面客观输棋，防守方也要选择最能制造实际问题的走法，迫使对手继续精确。',
      method: '...Rb3! 不改变客观评价，但设置了侧面将军、h 兵和逼和资源；优势方若凭惯性推进，就可能被拖入防守资源。',
      mistake: '劣势方直接等待或认输式防守，会让强方按最简单路线把王带到王翼。'
    },
    hints: ['黑方要先让车保持活跃。', '目标不是马上和棋，而是制造连续选择题。'],
    steps: [
      { move: 'b4b3', reply: 'f4f5', note: '...Rb3! 先设置横向骚扰。' },
      { move: 'g6h7', reply: 'h3h4' },
      { move: 'b3b5', reply: 'e2e3' },
      { move: 'b5b4', reply: 'g3g4' },
      { move: 'b4b3', reply: 'e3e2' },
      { move: 'b3b2', reply: 'e2e3' },
      { move: 'b2b3', reply: 'e3d2' },
      { move: 'h5g4', reply: 'd2e2' },
      { move: 'b3b5', reply: 'h4h5' },
      { move: 'g4g3', reply: 'h5h6' },
      { move: 'g3g2', reply: 'e2f2' },
      { move: 'b5f5', reply: 'f2g2' },
      { move: 'f5b5', reply: 'h6g7' },
      { move: 'h7g7', reply: 'g2f3' },
      { move: 'b5b3', reply: 'f3e4' },
      { move: 'b3b4', reply: 'e4d5' },
      { move: 'b4b1', reply: 'd5c4' },
      { move: 'b1c1', reply: 'c4b3' },
      { move: 'c1b1', reply: 'b3a3' },
      { move: 'g7h7', reply: 'a3a2' },
      { move: 'b1b6', reply: 'b8c8' },
      { move: 'b6b7', note: '黑车吃 b7，防骗资源最终把胜局拖成和棋。' }
    ]
  },
  {
    id: 'mce-young-galofre-dont-celebrate-early',
    category: 'single-rook-defense',
    title: '对手失误后也要继续精确',
    level: '单车防骗',
    goal: '白先，设下最后陷阱并抓住机会',
    fen: '7R/8/4k3/3p4/5P2/r3P3/5K2/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 26,
      game: 'Young-Galofre, US Chess League 2008',
      pdfPage: 75,
      bookPage: 72,
      note: '例 26 图面还原 FEN，修正图面无白 g4 兵；同一实战主线已从 1.Rh6+! 补到 24.Ke7 并用程序校验。'
    }),
    teaching: {
      principle: '在客观和棋或接近和棋的车残局里，设置最后陷阱是实战武器；但对手一旦犯错，优势方仍要重新精确计算。',
      method: 'Rh6+ 先测试黑王位置，随后 Rb6-Rb5-Rb6+ 逼黑方持续守住 d5。黑方 ...Rc3?! 和 ...Kf7?? 给出机会后，白方不能只凭惯性走棋，要用 e4-exd5 和 Kd3 接管中心。',
      mistake: '看到对手犯错就放松，容易像实战中的 Re5?? 一样把胜势重新放回到和棋边缘。'
    },
    hints: ['先用车将军，测试黑王是否会走错。', '黑方王走到 f7 后，不要急着庆祝，要用中心兵和王接住胜势。'],
    steps: [
      { move: 'h8h6', reply: 'e6e7', note: 'Rh6+! 先设置最后陷阱，黑王精准回 e7 才能守住。' },
      { move: 'h6b6', reply: 'a3c3' },
      { move: 'f2e2', reply: 'c3a3' },
      { move: 'b6b5', reply: 'e7e6' },
      { move: 'b5b6', reply: 'e6e7' },
      { move: 'f4f5', reply: 'a3c3' },
      { move: 'b6e6', reply: 'e7f7' },
      { move: 'e6e5', reply: 'c3c5' },
      { move: 'e3e4', reply: 'c5c4' },
      { move: 'e4d5', reply: 'f7f6' },
      { move: 'e2d3', reply: 'c4a4' },
      { move: 'e5e4', reply: 'a4a3' },
      { move: 'd3d4', reply: 'f6f5' },
      { move: 'e4e1', reply: 'a3a2' },
      { move: 'd5d6', reply: 'a2d2' },
      { move: 'd4c5', reply: 'f5f6' },
      { move: 'c5c6', reply: 'd2c2' },
      { move: 'c6d7', reply: 'f6f7' },
      { move: 'e1f1', reply: 'f7g7' },
      { move: 'd7d8', reply: 'c2c3' },
      { move: 'd6d7', reply: 'c3c4' },
      { move: 'f1f2', reply: 'g7g8' },
      { move: 'f2f5', reply: 'g8g7' },
      { move: 'd8e7', note: '白王走到 e7，实战主线以 1-0 收束。' }
    ]
  },
  {
    id: 'mce-getz-naroditsky-activity-saves-ocb',
    category: 'rook-minor-activity',
    title: '活跃子力换来异色象堡垒',
    level: '车象对车象',
    goal: '黑先，用车的主动性化解多兵压力',
    fen: '4r1k1/1p3p1p/p1b5/P7/8/2B3P1/1PPR2P1/5K2 b - - 0 35',
    orientation: 'b',
    source: source({
      example: 27,
      game: 'Getz-Naroditsky, Philadelphia 2007',
      pdfPage: 78,
      bookPage: 75,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 27 图面还原 FEN；从 35...h6 到 50...Bd5 的同一防守流程合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '车加异色象残局并不会自动和棋；防守方必须先让子力活起来，再考虑转换成纯异色象。',
      method: '...h6 给王留气，...Re4! 切断白王并迫使白方承认黑车活跃。换车后，黑方用象在 e4-d5-c2-d3-b3 间调动，持续攻击 g4 和控制关键格。',
      mistake: '只守 f7/h7 或被动等待，会让白方多兵和活跃车一起压上，异色象的和棋资源来不及发挥。'
    },
    hints: ['第一步先给黑王留出 h7。', '车要主动切断白王，而不是守在后排。', '换车后继续用象攻击白方王翼弱点。'],
    steps: [
      { move: 'h7h6', reply: 'f1f2', note: '...h6 先给王留出 h7，白王靠近。' },
      { move: 'e8e4', reply: 'c3d4', note: '...Re4! 车主动切断白王，并准备横向活动。' },
      { move: 'g8h7', reply: 'd4e3', note: '王离开后排，白象回到 e3 保护结构。' },
      { move: 'h7g6', reply: 'd2d6', note: '黑王靠近王翼，白车只能寻求换车。' },
      { move: 'e4e6', reply: 'd6e6', note: '黑车接受换车，进入可守的异色象残局。' },
      { move: 'f7e6', reply: 'g3g4', note: 'f 兵回吃，白方只能用 g4 争取空间。' },
      { move: 'c6e4', reply: 'c2c3', note: '黑象到 e4，先盯住 g2 和 c2。' },
      { move: 'e4d5', reply: 'e3f4', note: '象回 d5 控制关键斜线，白象试图活跃。' },
      { move: 'd5e4', reply: 'g2g3', note: '白方用 g3 解放 g2，但 g4 兵随之变弱。' },
      { move: 'e4c2', reply: 'f2g2', note: '黑象转到 c2，持续骚扰白王和后翼。' },
      { move: 'c2d3', reply: 'g2f3', note: '黑象继续切换斜线，不让白王舒服靠近。' },
      { move: 'd3c2', reply: 'f3e2', note: '白王换路线，黑象保持对关键格的控制。' },
      { move: 'c2b3', reply: 'e2d2', note: '象到 b3 迫使白王退回防守。' },
      { move: 'b3d5', reply: 'd2e3', note: '黑象回中心，白王无法突破。' },
      { move: 'd5b3', reply: 'e3d2', note: '重复防守节奏，白方没有进展。' },
      { move: 'b3d5', note: '黑象回到 d5，异色象堡垒成立。' }
    ]
  },
  {
    id: 'mce-naroditsky-odondoo-free-the-pieces',
    category: 'rook-minor-activity',
    title: '防守先把子力放出来',
    level: '车象对车象',
    goal: '白先，用通路兵和主动性争取反击',
    fen: '6k1/6p1/p1b2p1p/P3pP2/2P5/1r1P4/5B1P/4R1K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 28,
      game: 'Naroditsky-Odondoo, Reno 2007',
      pdfPage: 79,
      bookPage: 76,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 28 图面还原 FEN；同一实战主线已从 1.d4! 补到 29...h3 并用程序校验。'
    }),
    teaching: {
      principle: '车加异色象残局里，防守方的主动性可能抵得上多个兵；最差的是让车、象、通路兵都被压住。',
      method: 'd4! 先打开白象和 e 线，哪怕黑方赢兵，白方也用 Rc1、Bb6-c7 和 c5-c6 让通路兵成为最强资产。',
      mistake: '被动守住物质或机械换子，会让黑方轻松推进王翼兵；防守方必须尽快制造自己的威胁。'
    },
    hints: ['先找能同时打开白象和白车的兵步。', '白方不怕丢 f5，关键是让 c 兵走起来。'],
    steps: [
      { move: 'd3d4', reply: 'e5d4', note: 'd4! 牺牲结构换来子力解放。' },
      { move: 'f2d4', reply: 'b3b4' },
      { move: 'e1c1', reply: 'c6e4' },
      { move: 'c1c3', reply: 'e4f5' },
      { move: 'd4b6', reply: 'f5d7' },
      { move: 'c4c5', reply: 'd7c6' },
      { move: 'c3d3', reply: 'c6b5' },
      { move: 'd3d8', reply: 'g8f7' },
      { move: 'd8c8', reply: 'b4c4' },
      { move: 'c8c7', reply: 'f7g6' },
      { move: 'c7e7', reply: 'c4g4' },
      { move: 'g1f2', reply: 'g6f5' },
      { move: 'h2h3', reply: 'g4f4' },
      { move: 'f2g3', reply: 'g7g5' },
      { move: 'b6c7', reply: 'f4c4' },
      { move: 'c7d6', reply: 'h6h5' },
      { move: 'e7b7', reply: 'h5h4' },
      { move: 'g3f2', reply: 'c4c2' },
      { move: 'f2e3', reply: 'c2c3' },
      { move: 'e3d2', reply: 'c3d3' },
      { move: 'd2c2', reply: 'd3h3' },
      { move: 'b7b5', reply: 'a6b5' },
      { move: 'c5c6', reply: 'f5e6' },
      { move: 'd6b4', reply: 'h3h2' },
      { move: 'c2b3', reply: 'h2e2' },
      { move: 'a5a6', reply: 'e6d5' },
      { move: 'c6c7', reply: 'e2e8' },
      { move: 'b4e7', reply: 'e8c8' },
      { move: 'e7f6', reply: 'h4h3', note: '黑方 h 兵到 h3，实战主线以黑胜收束。' }
    ]
  },
  {
    id: 'mce-lowe-deacon-quiet-practical-pressure',
    category: 'rook-minor-activity',
    title: '选择最难防的安静招',
    level: '车象对车象',
    goal: '白先，用 h 兵和车位制造最大实战压力',
    fen: '2b5/3k4/p1p1p3/3pB2p/3P1K1P/2P5/P1r5/1R6 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 29,
      game: 'Lowe-Deacon, London 1851',
      pdfPage: 83,
      bookPage: 80,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 29 图面还原 FEN；同一实战主线已从 1.Kg5 补到 31.Kg6 Kb5 并用程序校验。'
    }),
    teaching: {
      principle: '车加异色象残局里，最强招不一定最 forcing；能持续制造选择题的安静招，常比立即将军更难防。',
      method: 'Kg5-Kxh5 先消掉 h5，Rb8! 让黑方无法舒服地用 ...a5 和 ...Ba6。黑方一旦把车离开 g 线，白王和 h 兵就能开始前进。',
      mistake: '优势方如果不检查对手刚走的棋有什么缺点，就会像实战中错过 dxc5、c6 等直接胜法。'
    },
    hints: ['先把 h5 兵消掉，制造自己的远方通路兵。', '第三步不是将军，而是让黑方的 ...a5 计划变难。', '对手走 ...c5 后，要重新检查 d 兵吃过去是否变强。'],
    steps: [
      { move: 'f4g5', reply: 'c2a2', note: 'Kg5 直接攻击 h5，黑方唯一反击是吃 a2 造通路兵。' },
      { move: 'g5h5', reply: 'a2g2' },
      { move: 'b1b8', reply: 'g2g1' },
      { move: 'h5h6', reply: 'a6a5' },
      { move: 'b8a8', reply: 'g1a1' },
      { move: 'a8a7', reply: 'd7e8' },
      { move: 'h4h5', reply: 'c6c5' },
      { move: 'h6h7', reply: 'c8d7' },
      { move: 'h5h6', reply: 'd7a4' },
      { move: 'h7g8', reply: 'a4c2' },
      { move: 'd4c5', reply: 'a1h1' },
      { move: 'e5g7', reply: 'e6e5' },
      { move: 'c5c6', reply: 'c2f5' },
      { move: 'a7a5', reply: 'f5e6' },
      { move: 'g8h8', reply: 'e5e4' },
      { move: 'a5a8', reply: 'e8f7' },
      { move: 'a8f8', reply: 'f7e7' },
      { move: 'f8f2', reply: 'e7d6' },
      { move: 'g7f8', reply: 'd6c6' },
      { move: 'f2f6', reply: 'c6d7' },
      { move: 'f8c5', reply: 'h1h3' },
      { move: 'h6h7', reply: 'h3g3' },
      { move: 'c5f2', reply: 'g3g2' },
      { move: 'f6f8', reply: 'd7c7' },
      { move: 'f2d4', reply: 'g2g5' },
      { move: 'f8f1', reply: 'g5g6' },
      { move: 'f1g1', reply: 'g6g1' },
      { move: 'd4g1', reply: 'e6f5' },
      { move: 'h8g7', reply: 'f5h7' },
      { move: 'g7h7', reply: 'c7c6' },
      { move: 'h7g6', reply: 'c6b5', note: '黑王赶到 b5，实战最终和棋。' }
    ]
  },
  {
    id: 'mce-lee-naroditsky-keep-initiative',
    category: 'rook-minor-activity',
    title: '看似和棋也要保留主动',
    level: '车象对车象',
    goal: '黑先，选择让白方继续受考验的方案',
    fen: '6k1/7p/6p1/2bPp3/4PpP1/1R3K1P/2r1B3/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 30,
      game: 'Lee-Naroditsky, Los Angeles 2006',
      pdfPage: 88,
      bookPage: 85,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 30 图面还原 FEN；书中推荐的 1...Rc1! 反击线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '看似平淡的车加异色象残局仍然藏着战术；强方或主动方不能只满足于立刻简化。',
      method: '...Rc1! 保留车的主动性，让白方必须找到 g5 和 Bc4 的精确防守。黑车转到 g 线吃 g5 后，d 兵虽然危险，但黑方能及时挡住。',
      mistake: '实战中 ...Kg7 和 ...Kg8 浪费了主动权，让白方顺利走出 g5/h4/Rd3。'
    },
    hints: ['不要先动王，先找能让白方必须算清楚的车招。', '白方 g5 后，黑车要从 g 线继续制造问题。'],
    steps: [
      { move: 'c2c1', reply: 'g4g5', note: '...Rc1! 保留主动；白方必须用 g5 争取反击。' },
      { move: 'c1g1', reply: 'e2c4', note: '车到 g1，白象必须到 c4 才能守住关键战术。' },
      { move: 'g1g5', reply: 'd5d6', note: '黑车吃 g5 后，白方只能推 d 兵制造速度。' },
      { move: 'g8f8', reply: 'b3b8', note: '黑王靠近 d 兵，白车从 b 线将军牵制。' },
      { move: 'f8g7', reply: 'd6d7', note: '黑王回 g7 后，黑方仍有 ...Be7/...Rc5 之类资源守住。' }
    ]
  },
  {
    id: 'mce-muller-heinemann-multi-step-plan',
    category: 'rook-minor-activity',
    title: '多阶段计划兑现小优势',
    level: '车象对车象',
    goal: '白先，先固定再转向王翼突破',
    fen: '4r3/6kp/4p1p1/1Pb5/4P3/1B3R1P/6P1/5K2 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 31,
      game: 'Muller-Heinemann, German Championship Altenkirchen 1999',
      pdfPage: 89,
      bookPage: 86,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 31 图面还原 FEN；同一实战主线已从 1.Rc3! 补到 38.Rxe5 并用程序校验。'
    }),
    teaching: {
      principle: '技术优势需要计划顺序：先让车占开放线，拒绝无利换车，再试探战术，最后用王翼空间把对方王锁住。',
      method: 'Rc3! 把车放到 c 线，Rc7+-Rc6 拒绝换车并攻击弱点。黑方挡住 b 兵后，白方不急于突破，而是 Kd3、Rd6 先设战术，随后 g3-h4-g4-g5 逐步限制黑王。',
      mistake: '只盯着 b 兵硬推，会给黑方换车或守住 b6 的机会；优势方要在没有反击时先改善全部子力。'
    },
    hints: ['第一步把车放到能攻击象、控制开放线的位置。', '黑方阻止 b 兵后，转向王翼限制黑王。', '有好计划时，也可以先设一个无风险的小陷阱。'],
    steps: [
      { move: 'f3c3', reply: 'e8f8', note: 'Rc3! 车占 c 线并攻击象，黑车只能给将。' },
      { move: 'f1e2', reply: 'c5d4' },
      { move: 'c3c7', reply: 'f8f7' },
      { move: 'c7c6', reply: 'f7b7' },
      { move: 'b3c4', reply: 'e6e5' },
      { move: 'e2d3', reply: 'g7h6' },
      { move: 'c6d6', reply: 'd4f2' },
      { move: 'd6d5', reply: 'b7e7' },
      { move: 'd5d8', reply: 'e7b7' },
      { move: 'd3e2', reply: 'f2a7' },
      { move: 'd8d5', reply: 'b7e7' },
      { move: 'd5d6', reply: 'e7b7' },
      { move: 'd6a6', reply: 'a7d4' },
      { move: 'a6d6', reply: 'd4a7' },
      { move: 'g2g3', reply: 'h6g5' },
      { move: 'e2f3', reply: 'g5h6' },
      { move: 'h3h4', reply: 'h6h5' },
      { move: 'f3g2', reply: 'a7c5' },
      { move: 'd6c6', reply: 'c5d4' },
      { move: 'g2h3', reply: 'h5h6' },
      { move: 'g3g4', reply: 'h6g7' },
      { move: 'g4g5', reply: 'd4e3' },
      { move: 'c4d5', reply: 'b7b8' },
      { move: 'c6c7', reply: 'g7h8' },
      { move: 'd5c6', reply: 'b8f8' },
      { move: 'c7e7', reply: 'e3d4' },
      { move: 'c6d5', reply: 'f8f3' },
      { move: 'h3g2', reply: 'f3f2' },
      { move: 'g2g3', reply: 'h7h6' },
      { move: 'g5h6', reply: 'f2f4' },
      { move: 'e7e6', reply: 'h8h7' },
      { move: 'b5b6', reply: 'f4f8' },
      { move: 'b6b7', reply: 'd4a7' },
      { move: 'h4h5', reply: 'g6h5' },
      { move: 'g3h4', reply: 'f8f1' },
      { move: 'h4h5', reply: 'f1g1' },
      { move: 'e6e7', reply: 'h7h8' },
      { move: 'e7e5', note: 'Rxe5 收束，白方技术转化完成。' }
    ]
  },
  {
    id: 'mce-yermolinsky-naroditsky-create-winning-chances',
    category: 'rook-minor-activity',
    title: '和棋里也能制造持续难题',
    level: '车象对车象',
    goal: '白先，用受保护通路兵限制黑方',
    fen: '8/4k3/5r2/1K2p2R/3bB1P1/5P2/8/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 32,
      game: 'Yermolinsky-Naroditsky, Las Vegas 2009',
      pdfPage: 91,
      bookPage: 88,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 32 图面还原 FEN；同一实战主线已从 1.g5 补到书中记录停止前的 16.Bd5，并用程序校验。'
    }),
    teaching: {
      principle: '客观和棋不等于实战没有机会；受保护通路兵、弱兵和活跃子力叠加时，可以连续制造难题。',
      method: 'g5-g6 先把黑车绑在第七横线，Rh8-Rc8-Rc6+ 让白王进入中心。黑方 ...Bf4? 后，Ke6!-Rd6-Ra6 继续逼迫，最后 Bd5 完成书中给出的实战片段。',
      mistake: '防守方若让象离开关键 e3 防线，就会失去切断白王的能力；优势方也不能过早放松，因为后面仍可能有逼和骗局。'
    },
    hints: ['先把受保护通路兵推进到能绑住黑车的位置。', '车从 h 线转到 c 线，帮助白王靠近。', '黑象离开 e3 后，白王要立刻进入 e6。'],
    steps: lineSteps('g4g5 f6f7 b5c4 f7g7 g5g6 e7f6 h5h8 g7a7 h8c8 a7a4 c4b5 a4a7 c8c6 f6g7 b5c4 d4e3 c4d5 e3f4 d5e6 a7b7 c6d6 b7c7 d6a6 g7h6 e6f6 f4g5 f6e5 h6g7 f3f4 g5h4 e4d5', {
      0: 'g5 先扩大通路兵空间，黑车只能守第七横线。',
      8: '黑方 ...Bf4? 离开关键防线，Ke6! 立刻利用。',
      15: 'Bd5 到位，书中实战记录到这里停止。'
    })
  },
  {
    id: 'mce-larsen-lengyel-sudden-attack',
    category: 'rook-minor-activity',
    title: '优势局面寻找突然攻击',
    level: '车象对车象',
    goal: '白先，用车象配合直接击破黑王',
    fen: '8/1p1k4/2p5/2P1B2R/3PPK1P/3b4/8/4r3 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 33,
      game: 'Larsen-Lengyel, Amsterdam Interzonal 1964',
      pdfPage: 92,
      bookPage: 89,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 33 图面还原 FEN；战术线 1.Rh7+! 到 4.Rd7+ 合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '当全部子力都在最佳位置、对方王缺乏保护时，静态优势可以直接转化为攻击。',
      method: 'Rh7+ 先把黑王引到 e6，d5+! 打开 e4 象和 d 线。黑方吃 d5 后，Rd7+ 赢回关键子力，安全兑现优势。',
      mistake: '只去吃 b7 或被动守 e4，会让黑方在 d5 建立堡垒，赢棋反而变难。'
    },
    hints: ['先用车从 h 线将军，把黑王引到战术线上。', '中心突破 d5+ 是打开攻击的关键。'],
    steps: [
      { move: 'h5h7', reply: 'd7e6', note: 'Rh7+! 先迫使黑王走到 e6。' },
      { move: 'd4d5', reply: 'c6d5', note: 'd5+! 中心突破，黑方只能吃。' },
      { move: 'e4d5', reply: 'e6d5', note: '白兵回吃后，黑王再吃 d5 走入车的攻击。' },
      { move: 'h7d7', note: 'Rd7+ 赢得决定性材料，攻击完成。' }
    ]
  },
  {
    id: 'mce-naroditsky-stein-trade-then-improve',
    category: 'rook-minor-activity',
    title: '换车后还要继续制造问题',
    level: '同色象转换',
    goal: '白先，判断换车并进入有利兵残局',
    fen: '5k2/pb2r1pp/8/2pp4/8/5B2/PPPK2PP/3R4 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 34,
      game: 'Naroditsky-Stein, Los Angeles 2006',
      pdfPage: 94,
      bookPage: 91,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 34 图面还原 FEN；从 1.Re1 到 14.a4 的换车和兵残局技术线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '同色象加车残局里，换车是否有利要看谁的弱兵会被放大；进入兵残局后仍不能放松计算。',
      method: 'Re1! 先换掉黑车，削弱黑方对 c5/d5 的支撑。随后 c4! 利用黑象未守，逼出更具体的兵残局；b3、a3、g4、a4 一步步减少黑方等待招。',
      mistake: '以为“应该和棋”就随手走 ...h6，会让等待招转到白方手里，黑方进入 zugzwang。'
    },
    hints: ['先问：换车后黑方中心弱兵会不会更难守。', '换车后立刻用 c4! 把局面具体化。', '兵残局里小兵步也能决定谁有等待招。'],
    steps: [
      { move: 'd1e1', reply: 'e7e1', note: 'Re1! 强迫换车，黑方失去对中心兵的动态支撑。' },
      { move: 'd2e1', reply: 'f8f7', note: '白王回吃，黑王靠近。' },
      { move: 'c2c4', reply: 'f7e6', note: 'c4! 利用黑象未守，逼黑方立即应对。' },
      { move: 'e1e2', reply: 'e6d6', note: '白王靠近中心，黑王也赶来。' },
      { move: 'b2b3', reply: 'b7c6', note: 'b3 阻止 ...c4，让黑王无法用 c5 格轻松防守。' },
      { move: 'f3d5', reply: 'c6d5', note: '白象吃 d5，强迫进入兵残局。' },
      { move: 'c4d5', reply: 'd6d5', note: 'c 兵回吃，黑王吃回 d5。' },
      { move: 'e2d3', reply: 'a7a6', note: '白王到 d3，黑方先保留后翼等待招。' },
      { move: 'a2a3', reply: 'a6a5', note: 'a3 后黑方推进 a5，仍未输。' },
      { move: 'd3c3', reply: 'g7g5', note: '白王走向 c4，黑方王翼先动。' },
      { move: 'g2g4', reply: 'h7h6', note: 'g4 锁住王翼；...h6?? 交出最后等待招。' },
      { move: 'c3d3', reply: 'd5d6', note: '白王回 d3 等待，黑王被迫离开关键格。' },
      { move: 'd3c4', reply: 'd6c6', note: '白王进入 c4，黑王只能退到 c6。' },
      { move: 'a3a4', note: 'a4 形成 zugzwang，黑方中心和后翼同时崩溃。' }
    ]
  },
  {
    id: 'mce-ziatdinov-homs-passer-can-be-weak',
    category: 'rook-minor-activity',
    title: '远进通路兵也可能是负担',
    level: '同色象转换',
    goal: '黑先，理解过早造通路兵的缺点',
    fen: '5k2/6bp/8/1rp1p3/3p4/B4P2/P1P2P1P/K3R3 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 35,
      game: 'Ziatdinov-Homs, Zwolle 1995',
      pdfPage: 96,
      bookPage: 93,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 35 图面还原 FEN；同一实战主线已从 1...d3?! 补到 34...h4 的和棋终点，并用程序校验。'
    }),
    teaching: {
      principle: '同色象加车残局里，通路兵推进得太远未必是优势；如果它不能被象保护，车和王反而会被绑住。',
      method: '...d3?! 看似制造威胁，但 d3 在浅色格，黑象无法保护。白方先限制通路兵，随后局势几次反转，黑方也用 d 兵和活跃王制造险情，最终进入少子和棋。',
      mistake: '黑方更应先 ...e4 保留 ...d3 的威胁，不急着作出无法撤回的结构承诺。'
    },
    hints: ['这步看起来很自然，但先问通路兵能不能被象保护。', '白方的计划是控制 d2，然后用王攻击 d3。'],
    steps: lineSteps('d4d3 a3b2 c5c4 c2d3 c4d3 e1d1 b5d5 b2c3 g7h6 a1b2 f8e7 b2b3 e7d6 a2a4 d6c5 c3b4 c5d4 b4c3 d4c5 c3b2 h6f4 h2h3 d5d7 b3c3 e5e4 b2a3 c5d5 f3e4 d5e4 a3c5 d7c7 c3b4 d3d2 a4a5 e4d3 a5a6 d3e2 d1b1 d2d1q b1d1 e2d1 a6a7 c7c8 b4b5 d1e2 b5b6 e2f3 b6b7 c8g8 a7a8q g8a8 b7a8 h7h5 a8b7 f3g2 h3h4 g2h3 c5e7 h3g2 e7c5 g2h3 b7c6 h3h4 c6d5 h4g4 c5e7 h5h4', {
      0: '...d3?! 造出远进通路兵，但它不能被黑象保护。',
      15: '双方转入互相竞速，黑 d 兵反而又制造实际危险。',
      33: '...h4 后形成书中给出的和棋终点。'
    })
  },
  {
    id: 'mce-asztalos-hajdu-king-does-everything',
    category: 'rook-minor-activity',
    title: '王的活跃能改变整个残局',
    level: '同色象转换',
    goal: '白先，把王从后排带到决定性前线',
    fen: '5bk1/5p2/6pp/1p1p4/8/2P5/1P3PPP/r1B1R1K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 36,
      game: 'Asztalos-Hajdu, Hungarian Championship Heviz 1998',
      pdfPage: 99,
      bookPage: 96,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 36 图面还原 FEN；从 1.Kf1 到 17.Ke6 的王活跃主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '同色象残局里，王的活跃程度可以压过车和物质表象；一个进入中心的王会同时攻击两翼。',
      method: 'Kf1-e2-d3-c2 先把王从后排解放出来。换车换象后，白王一路走到 d4，再用 f4、g3、h3、g4、b3、g5 为王打开 e5-e6 通道。',
      mistake: '黑方实战 ...h5 和 ...Bh6? 忽略了白王的路线；更好的防守是早用 ...b4 转入可守残局。'
    },
    hints: ['第一步不是动兵，而是把王从 g1 解放出来。', '换子后继续问：白王下一站在哪里。', 'g5 的目的不是吃兵，而是给白王打开入口。'],
    steps: [
      { move: 'g1f1', reply: 'a1b1', note: 'Kf1 开始王路，黑车到 b1 保持活跃。' },
      { move: 'f1e2', reply: 'h6h5', note: '白王继续向中心，黑方 ...h5? 给了白方时间。' },
      { move: 'e2d3', reply: 'f8h6', note: '王到 d3，黑象到 h6 仍未解决白王活跃。' },
      { move: 'd3c2', reply: 'b1c1', note: 'Kc2!? 白王继续前进，黑车只能换子。' },
      { move: 'e1c1', reply: 'h6c1', note: '白车回吃后，黑象吃 c1，进入纯王兵残局。' },
      { move: 'c2c1', reply: 'g8f8', note: '白王吃象，王兵残局里白王更活跃。' },
      { move: 'c1d2', reply: 'f8e7', note: '王向 d3/d4 进军。' },
      { move: 'd2d3', reply: 'e7e6', note: '白王到 d3，黑王试图迎击。' },
      { move: 'd3d4', reply: 'e6d6', note: '白王占据 d4，左右两翼都受它影响。' },
      { move: 'f2f4', reply: 'f7f6', note: 'f4 固定并准备王翼空间。' },
      { move: 'g2g3', reply: 'd6c6', note: '白方先改善王翼，黑王无法同时守两边。' },
      { move: 'h2h3', reply: 'c6d6', note: 'h3 保留结构和等待招。' },
      { move: 'g3g4', reply: 'h5h4', note: 'g4 扩张，黑方只能用 h 兵反击。' },
      { move: 'b2b3', reply: 'd6c6', note: 'b3! 防止黑王从后翼反击。' },
      { move: 'g4g5', reply: 'f6f5', note: 'g5! 打开白王通道，黑方被迫 ...f5。' },
      { move: 'd4e5', reply: 'c6c5', note: '白王进入 e5，黑王只能赶往 c5。' },
      { move: 'e5e6', note: 'Ke6 后白王完全进入黑方阵地，胜势确立。' }
    ]
  },
  {
    id: 'mce-geske-zilka-create-weaknesses',
    category: 'rook-minor-activity',
    title: '先制造弱点再启动王路',
    level: '同色象转换',
    goal: '黑先，用后翼多数制造突破口',
    fen: '2k4r/6p1/2p2p2/1pb5/p1p1PBP1/5P2/PPPRK3/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 37,
      game: 'Geske-Zilka, Czech Open Pardubice 2009',
      pdfPage: 100,
      bookPage: 97,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 37 图面还原 FEN；同一实战主线已从 1...a3! 补到 18...c2+，并用程序校验。'
    }),
    teaching: {
      principle: '当对手没有明显弱点时，先用低风险兵突制造一个；有了目标以后，王的渗透计划才会成立。',
      method: '...a3! 迫使白方留下后翼弱点，...c3! 和 ...Rh2+ 把白王赶回去。随后 ...b4、...c5 和黑王到 c4 让弱点崩溃，最后 ...c2+ 收束。',
      mistake: '直接 ...g5 看起来主动，但白方 Bd6-Bb6-b3 就能保持堡垒；没有先制造弱点，攻势会落空。'
    },
    hints: ['先找能迫使白方后翼作出结构让步的兵步。', '打开 h 线将军后，白王会被迫回到被动位置。', '最终计划是 ...c5 和黑王到 c4。'],
    steps: lineSteps('a4a3 b2a3 c5a3 f4d6 c4c3 d2d1 a3d6 d1d6 h8h2 e2d1 h2h1 d1e2 h1h2 e2d1 c8c7 d6d3 b5b4 d3d4 c6c5 d4d5 c7c6 g4g5 c6b5 f3f4 b5c4 g5g6 h2h1 d1e2 h1c1 d5d7 c1c2 e2d1 c2g2 d7g7 c3c2', {
      0: '...a3! 先迫使白方制造后翼弱点。',
      8: '...b4 打开 c5/c4 路线，黑王开始渗透。',
      17: '...c2+ 是书中 0-1 前的最后一招。'
    })
  },
  {
    id: 'mce-shulman-sosa-restrict-bishop',
    category: 'rook-minor-activity',
    title: '限制对手象等于多一子',
    level: '同色象转换',
    goal: '白先，先锁住黑象再赢弱点',
    fen: 'r1b5/4kp2/p1R3pp/1p1p4/3P4/P1KB4/1P3PPP/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 38,
      game: 'Shulman-Sosa Harrison, Continental Cup Buenos Aires 2003',
      pdfPage: 101,
      bookPage: 98,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 38 图面还原 FEN；从 1.Kb4 到 16.gxh5 的限制黑象技术线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '如果能把对手的象锁死，后续就是多一子进攻弱点；先限制，再收割。',
      method: 'Kb4 迫使 ...a5+，随后 b4! 和 a4 把黑象封在 c8。Rc5-Rxd5-Rc5 逐步攻击弱点，最后 Rxc6+ 转入赢的王兵残局。',
      mistake: '急着吃兵而没有先锁住黑象，会让黑方象重新活动，弱点反而难以同时攻击。'
    },
    hints: ['先用王迫使黑方 a 兵前进。', 'b4! 是限制黑象的关键。', '黑象被锁住后，车再去吃 d5/c6。'],
    steps: [
      { move: 'c3b4', reply: 'a6a5', note: 'Kb4 迫使 ...a5+，黑方不然会被 Kc5 侵入。' },
      { move: 'b4c3', reply: 'a8b8', note: '白王回 c3，黑车被 a6 弱点牵制。' },
      { move: 'b2b4', reply: 'a5a4', note: 'b4! 锁住黑象活动空间，黑方只能推进 a 兵。' },
      { move: 'c6c5', reply: 'c8d7', note: '车到 c5 开始攻击，黑象艰难转出。' },
      { move: 'c5d5', reply: 'd7c6', note: '白车吃 d5，黑象回 c6。' },
      { move: 'd5c5', reply: 'e7d6', note: '车回 c5，继续限制黑方。' },
      { move: 'g2g3', reply: 'h6h5', note: '白方先改善王翼，黑方无有效反击。' },
      { move: 'h2h4', reply: 'b8b7', note: 'h4 固定王翼，黑车仍受防守任务限制。' },
      { move: 'c5c6', reply: 'd6c6', note: 'Rxc6+! 用战术转换进入赢的王兵残局。' },
      { move: 'd3e4', reply: 'c6b6', note: '白象将军，黑王被迫到 b6。' },
      { move: 'e4b7', reply: 'b6b7', note: '白象吃 b7，黑王回吃。' },
      { move: 'd4d5', reply: 'b7c7', note: 'd5 创建远方通路兵。' },
      { move: 'c3d4', reply: 'c7d6', note: '白王进入中心，黑王落后。' },
      { move: 'f2f3', reply: 'f7f6', note: 'f3 支撑王翼结构。' },
      { move: 'g3g4', reply: 'g6g5', note: '白方进一步固定王翼。' },
      { move: 'g4h5', note: 'gxh5 后，白方外侧通路兵和中心王决定胜负。' }
    ]
  },
  {
    id: 'mce-rozentalis-glek-simple-restriction-plan',
    category: 'rook-minor-activity',
    title: '简单限制计划胜过强算',
    level: '同色象转换',
    goal: '白先，限制黑象并准备最终入侵',
    fen: '2rbk3/6p1/p2B1p1p/2p5/6P1/2P2P2/PPKR4/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 39,
      game: 'Rozentalis-Glek, European Cup Final Budapest 1996',
      pdfPage: 102,
      bookPage: 99,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 39 图面还原 FEN；同一实战主线已从 1.c4! 补到 31.a6 的 1-0 终点，并用程序校验。'
    }),
    teaching: {
      principle: '复杂同色象残局中，不必先算到底；先走最自然的限制招，持续改善王、车、象和兵形。',
      method: 'c4! 先阻止 ...c4 并改善白象，随后 Kd3、Be3、f4-f5、b3、a4 连续制造弱点。Bg3 后白王正式入侵，车和王一路收割到 a6 终点。',
      mistake: '如果任由黑方 ...c5-c4 和 ...Bb6，白方优势会大幅缩水；优势方必须先限制对手计划。'
    },
    hints: ['先阻止黑方自己的 ...c4 计划。', '每一步都问还能改善哪个子力或兵形。', '最终入侵前，用 Bg3 固定黑象和王翼。'],
    steps: lineSteps('c3c4 c8c6 d2d5 d8e7 d6f4 e8f7 c2d3 f7e6 f4e3 c6c8 f3f4 e7d6 f4f5 e6e7 b2b3 a6a5 a2a4 c8c6 d3e4 c6c8 e3f2 c8c6 d5d3 d6c7 d3f3 c7b6 f2g3 b6a7 e4d5 e7d7 f3e3 c6b6 g3f4 b6b7 f4d6 d7d8 e3d3 d8d7 d6c5 a7c5 d5c5 d7c7 d3e3 c7d7 c5d4 b7b8 d4c3 g7g6 e3d3 d7c7 f5g6 b8g8 d3d5 g8g6 d5a5 g6g4 a5f5 g4g6 a4a5 c7d6 a5a6', {
      0: 'c4! 限制黑象，也让 c5 成为长期弱点。',
      13: 'Bg3! 一切准备就绪，白王开始最终入侵。',
      30: 'a6 到达书中 1-0 的终点。'
    })
  },
  {
    id: 'mce-tkachiev-hoffman-open-with-tactics',
    category: 'rook-minor-activity',
    title: '打不开时用兵突打开攻击',
    level: '同色象战术',
    goal: '白先，用动态手段打破瘫痪防守',
    fen: 'R3bk2/5p1p/3rpPpP/3p4/2pP2B1/1pP1K1P1/1P3P2/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 40,
      game: 'Tkachiev-Hoffman, Villa Martelli 1997',
      pdfPage: 104,
      bookPage: 101,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 40 图面还原 FEN；从 1.Kf4 到 8.Bg4 的组合方法短线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '当对手已经瘫痪但最后突破不明显时，要考虑用兵突打开新战线和王的攻击通道。',
      method: 'Kf4-Kg5 把王放到攻击位置，随后 f4-f5! 打开 g4 象和王翼。黑方被迫 ...exf5 后，gxf5 和 Bg4 造成 zugzwang。',
      mistake: '只在原地改善而不开线，黑方虽然被动但仍能保持封锁；最后一击需要动态突破。'
    },
    hints: ['先把王走到能支援 f 兵突破的位置。', 'f4-f5 是打开局面的关键。', '最后用 Bg4 让黑方无可等待。'],
    steps: [
      { move: 'e3f4', reply: 'd6b6', note: 'Kf4 先改善王，黑车只能等待。' },
      { move: 'f4g5', reply: 'b6b7', note: '王到 g5，直接支援王翼突破。' },
      { move: 'f2f4', reply: 'b7d7', note: 'f4 准备 f5，黑车回 d 线防守。' },
      { move: 'g4f3', reply: 'd7d6', note: '白象回 f3，黑车继续等待。' },
      { move: 'g3g4', reply: 'd6d7', note: 'g4 增加王翼压力。' },
      { move: 'f4f5', reply: 'e6f5', note: 'f5! 打开局面，黑方被迫吃。' },
      { move: 'g4f5', reply: 'd7d6', note: 'gxf5 后，白方打开新战线。' },
      { move: 'f3g4', note: 'Bg4 形成 zugzwang，黑方无法守住所有弱点。' }
    ]
  },
  {
    id: 'mce-danielsen-hillarp-activate-before-defending',
    category: 'rook-minor-activity',
    title: '先活化子力再处理弱兵',
    level: '同色象综合',
    goal: '白先，用车象和王活跃保留赢棋机会',
    fen: '1r6/p4pk1/6p1/8/2PR1P2/1P5P/b5B1/6K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 41,
      game: 'Danielsen-Hillarp Persson, Copenhagen 1997',
      pdfPage: 104,
      bookPage: 101,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 41 图面还原 FEN；同一实战主线已从 1.Rd7! 补到 23.Rb5 的 1-0 终点，并用程序校验。'
    }),
    teaching: {
      principle: '弱兵被攻击时，不一定先死守；如果能活化全部子力并让王进入中心，弱兵反而可以成为战术诱饵。',
      method: 'Rd7! 把车放到第七横线，允许 ...Bxb3 后用 Bd5 和 Rxf7+ 争取主动。Kf2-e3-d4 让白王成为主角，换入车对单象后继续用车王配合逼到 Rb5 终点。',
      mistake: '被动守 b3 会让黑方 ...a5 和通路兵获得主动；优势方必须主动决定局面走向。'
    },
    hints: ['先把车放到第七横线，不要被 b3 兵绑住。', '王从 g1 走向中心是这道题的核心。', 'Kd4! 的细节是阻止 ...g5 后黑方轻松换兵。'],
    steps: lineSteps('d4d7 a2b3 g2d5 a7a5 d7f7 g7h6 f7a7 a5a4 g1f2 b8c8 d5e6 c8c5 f2e3 b3c4 e3d4 c4e6 d4c5 e6h3 c5d4 h3f5 a7a4 h6h5 a4a1 h5g4 d4e3 f5e6 e3e4 e6f5 e4e5 g4f3 a1c1 f3g3 c1g1 g3f3 g1a1 f3g3 a1a3 g3g4 a3a4 f5c2 a4b4 c2f5 e5f6 g4h4 b4b5', {
      0: 'Rd7! 先活化车，允许黑象吃 b3。',
      12: 'Ke3 后并不是终点，后面还要继续转化。',
      22: 'Rb5 是书中 1-0 的最后一招。'
    })
  },
  {
    id: 'mce-atalik-khomyakov-activate-defense',
    category: 'rook-minor-activity',
    title: '防守弱格先找主动',
    level: '同色象防守',
    goal: '黑先，避免被 e6 弱格压垮',
    fen: '6k1/3b3p/p2p1rp1/3P4/8/2P2BKP/5PP1/4R3 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 42,
      game: 'S. Atalik-Khomyakov, Alushta 1999',
      pdfPage: 106,
      bookPage: 103,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 42 图面还原 FEN；书中推荐的 1...Rf8 防守线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '防守同色象残局时，关键弱格不能被轻视；如果被动推进边兵，优势方会立刻占据弱格。',
      method: '...Rf8! 先活化车并准备换车。换车后黑王到 f6，e6 弱格不再被白方利用；随后 ...Ba4-b3 和 ...a5-a4 对白方后翼制造反击。',
      mistake: '实战 ...a5? 让白方 Bg4!、Be6+ 轻松占据 e6，黑方没有足够反击。'
    },
    hints: ['先处理白车可能进入 e6 的问题。', '换车后黑王要站到 f6，让 e6 弱格消失。', '防住关键弱格后，再用后翼通路兵反击。'],
    steps: [
      { move: 'f6f8', reply: 'e1e7', note: '...Rf8! 主动用车挑战白车，不让白车舒服进 e6。' },
      { move: 'f8f7', reply: 'e7f7', note: '黑车要求换车，白方无法保持所有压力。' },
      { move: 'g8f7', reply: 'g3f4', note: '黑王回吃到 f7，白王向中心靠近。' },
      { move: 'f7f6', reply: 'f4e4', note: '黑王到 f6 控制 e6，白王仍尝试创造通路兵。' },
      { move: 'd7a4', reply: 'e4d4', note: '黑象到 a4，阻止白王轻松推进。' },
      { move: 'a4b3', reply: 'c3c4', note: '黑象转 b3，白方用 c4 试图制造通路兵。' },
      { move: 'a6a5', reply: 'f3e4', note: '黑 a 兵推进，白象回 e4 阻挡。' },
      { move: 'a5a4', reply: 'd4c3', note: '...a4 后黑方获得反击，白王必须回防。' }
    ]
  },
  {
    id: 'mce-hubner-portisch-activate-defending-king',
    category: 'rook-minor-activity',
    title: '被压时先活化防守王',
    level: '同色象防守',
    goal: '白先，解除 b2 和 d4 的双重压力',
    fen: '8/2p2p1k/3b1p2/1p6/3P4/4BP2/rP4PP/1R4K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 43,
      game: 'Hubner-Portisch, Palma de Mallorca Interzonal 1970',
      pdfPage: 108,
      bookPage: 105,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 43 图面还原 FEN；从 1.Kf1! 到 12.d5! 的防守协调阶段合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '防守方被长期压住弱兵时，第一任务是活化王；王一旦到中心，车和象才有足够火力反击。',
      method: 'Kf1-e2-d3 把白王从 g1 带到中心，Bd2-c3 解开 b2 的束缚。黑方多次攻击 d4 后，白方用 Ke4、Bd6、Rh1 和 d5! 完成防守并开始争主动。',
      mistake: '只用车守 b2 会永远被黑车 a2 压制；防守方必须主动改善子力，而不是原地等待。'
    },
    hints: ['第一步是让白王离开 g1。', '象要转到 c3 保护 b2。', '全部协调好后，d5! 是反击信号。'],
    steps: [
      { move: 'g1f1', reply: 'f6f5', note: 'Kf1! 先活化防守王，黑方用 ...f5 争空间。' },
      { move: 'f1e2', reply: 'h7g6', note: '王继续向中心，黑王靠近。' },
      { move: 'g2g3', reply: 'f5f4', note: 'g3 限制王翼，黑方 ...f4! 制造新压力。' },
      { move: 'e3d2', reply: 'f4g3', note: '白象到 d2，黑方换掉 h 兵潜力。' },
      { move: 'h2g3', reply: 'a2a4', note: '白 h 兵回吃，黑车转 a4 继续骚扰。' },
      { move: 'e2d3', reply: 'a4c4', note: '白王到 d3，开始同时守 d4 和后翼。' },
      { move: 'd2c3', reply: 'c4a4', note: 'Bc3 终于解开 b2 的长期压力。' },
      { move: 'g3g4', reply: 'd6f4', note: '白方固定王翼，黑象转 f4 攻击。' },
      { move: 'd3e4', reply: 'f4d6', note: 'Ke4! 白王占中心，黑象只能回撤。' },
      { move: 'e4d3', reply: 'a4a8', note: '白王回 d3 守住结构，黑车重新换线。' },
      { move: 'b1h1', reply: 'a8a2', note: 'Rh1 准备反击，黑车仍盯 b2。' },
      { move: 'd4d5', note: 'd5! 协调完成后反击，白方已经不再被动。' }
    ]
  },
  {
    id: 'mce-vaisser-tseitlin-centralize-before-trading',
    category: 'rook-minor-activity',
    title: '换车威胁前先中央化王',
    level: '同色象防守',
    goal: '黑先，先解除换车后的危险',
    fen: '3r4/p3pk1p/1p3p2/2bP1P2/4PB2/8/P1R1K2P/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 44,
      game: 'Vaisser-M.D.Tseitlin, Novosibirsk 1971',
      pdfPage: 109,
      bookPage: 106,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 44 图面还原 FEN，修正图面无黑 g6 兵；同一实战主线已从 1...Rg8 补到 16...Rg2+ 的和棋终点。'
    }),
    teaching: {
      principle: '对手有换车威胁时，防守方不能只算当前局面；要先判断换车后的王兵和象残局是否危险。',
      method: '...Rg8 先避开白方随时换车的压力，...Ke8-d7 中央化黑王。白方 e5 后，黑方用活跃车和王持续反击，最后 ...Rg4+、...Rxg3+、...Rg2+ 抢到长将和棋。',
      mistake: '被动等待或随意换车，会让白王多一个节奏进入 c4/a6 路线；同色象防守里这个节奏足以决定胜负。'
    },
    hints: ['先避开直接换车，不要让白王多一个节奏。', '黑王必须走到 d7，才能开始处理后翼。', '白方 e5 后仍要靠活跃车反击。'],
    steps: lineSteps('d8g8 f4g3 f7e8 e2f3 e8d7 c2c4 g8c8 e4e5 f6e5 c4h4 c5d4 h4h7 c8c3 f3g4 d7d6 h2h4 c3c8 h4h5 c8g8 g4h4 d6d5 h7e7 d5e4 f5f6 e4f3 f6f7 g8g4 h4h3 g4g3 h3h2 g3g2', {
      0: '...Rg8 先解除白方随时换车的威胁。',
      4: '白方 e5! 打开局面，考验黑方主动防守。',
      15: '...Rg2+ 抢到长将，书中到此和棋。'
    })
  },
  {
    id: 'mce-horvath-gretarsson-maximize-pieces',
    category: 'rook-minor-activity',
    title: '少兵防守先最大化子力',
    level: '同色象防守',
    goal: '黑先，冷静活化并扳平材料',
    fen: '8/p1r2p1p/1p3kp1/3Pb3/1P6/3R1P1P/P2B1PK1/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 45,
      game: 'Horvath-Gretarsson, European Cup Final Lyon 1994',
      pdfPage: 111,
      bookPage: 108,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 45 图面还原 FEN；同一实战主线已从 1...Kf5 补到 15...Rd5 的和棋终点，并用程序校验。'
    }),
    teaching: {
      principle: '少兵防守时不要急着“找奇招”；先把王、象、车都放到最活跃位置，很多威胁会自然消失。',
      method: '...Kf5 和 ...Bd6 先改善王象，...Rc2-a2 让车进入主动位置。...Bxe3 和 ...Rxa4 扳平材料后，黑车继续活跃到 ...Rd5，书中给出和棋。',
      mistake: '疲于防守后随手被动等待，往往会让优势方顺利制造第二个通路兵。'
    },
    hints: ['先改善黑王，而不是急着追白通路兵。', '象到 d6 后，车要转到更活跃的二线。', '白车离开 d4 后，注意 Bxe3 的战术。'],
    steps: lineSteps('f6f5 b4b5 e5d6 a2a4 c7c2 d2e3 c2a2 d3d4 g6g5 h3h4 d6c5 d4e4 c5e3 e4e3 a2a4 e3d3 a4c4 d5d6 c4c8 h4g5 c8d8 f3f4 f5f4 d3f3 f4g5 f3f7 d8d6 f7h7 d6d5', {
      0: '...Kf5 先让王最大化，白方推进 b 兵。',
      7: '...Rxa4 后材料扳平，但书中主线还没有结束。',
      14: '...Rd5 后双方和棋。'
    })
  },
  {
    id: 'mce-dus-chotimirsky-rabinovich-active-long-defense',
    category: 'rook-minor-activity',
    title: '长期防守要主动制造反击',
    level: '同色象防守',
    goal: '白先，避免被迫换车并组织后翼反击',
    fen: '2r3k1/pp3ppp/2p1b3/8/3P4/2PB4/PP3P1P/4R2K w - - 0 1',
    orientation: 'w',
    source: source({
      example: 46,
      game: 'Dus Chotimirsky-Rabinovich, Russian Championship Kiev 1903',
      pdfPage: 112,
      bookPage: 109,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 46 图面还原 FEN，修正图面白 d4 兵；同一实战主线已从 1.f4! 补到 37.Bd5 的和棋终点。'
    }),
    teaching: {
      principle: '长期少兵防守不能只被动等和；要用准确的王路和兵突避免对方想要的换车，并及时创造自己的通路兵压力。',
      method: 'f4! 先阻止黑王轻松换车，Kg1! 冷静保留 e3 入口。随后 h4、Kf2、Rg1 和 a4-b4-c4-c5 建立反击，后面从主动防守转入被动堡垒，最后 Bd5 达成和棋。',
      mistake: '一味接受换车会进入黑方想要的多兵象残局；但如果完全被动，黑方又会用 ...g5 或中心王路扩大优势。'
    },
    hints: ['第一步先阻止黑方按计划转王换车。', 'Kg1! 看似奇怪，但让白王能守 e3。', '后翼 a4-b4-c4-c5 是白方的主动防守资源。'],
    steps: lineSteps('f2f4 c8e8 h1g1 g8f8 h2h4 h7h6 g1f2 e6d7 e1g1 f7f5 a2a4 f8f7 b2b4 f7f6 f2f3 e8g8 c3c4 d7e6 c4c5 e6f7 b4b5 f7h5 f3f2 g8e8 g1b1 e8e7 b5b6 a7a5 b1e1 e7d7 e1e5 h5g4 e5e8 g7g5 f4g5 h6g5 h4g5 f6g5 e8c8 d7h7 c8c7 h7c7 b6c7 f5f4 d3e2 g4c8 e2f3 g5f6 f3g2 f6e7 f2f3 e7d7 f3f4 d7c7 f4e5 c8g4 e5f4 g4d1 f4e3 d1a4 e3d2 a4b5 d2c3 b7b6 c5b6 c7b6 c3b2 b5c4 b2a3 c6c5 d4c5 b6c5 g2d5', {
      0: 'f4! 立即打断黑方 ...Kd7/Re8 换车计划。',
      9: 'c5 后白方也有通路兵压力，黑方被迫放弃简单赢法。',
      36: 'Bd5 到达书中和棋终点。'
    })
  },
  {
    id: 'mce-rensch-naroditsky-respect-rook-knight',
    category: 'rook-bishop-knight',
    title: '车马的反击不能低估',
    level: '车象对车马',
    goal: '黑先，推进通路兵前先算清车马资源',
    fen: '8/1k5p/1p1b2p1/3p1pP1/3PpP1P/4P3/1rNK4/7R b - - 0 1',
    orientation: 'b',
    source: source({
      example: 47,
      game: 'Rensch-Naroditsky, US Chess League 2009',
      pdfPage: 116,
      bookPage: 113,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 47 图面还原 FEN；从 1...Bb4+ 到 21.Kd3 的完整同一 variation 合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '车象方物质和通路兵占优时，仍要逐步计算车马的反击；马能制造意外防守和将军资源。',
      method: '...Bb4+ 和 ...Bc3 先压住白王和马，...b5-b4-b3 看似自然。但 Rb8+! 后不能停止计算，黑方仍要用 ...Ka6、...Re2、...Rxe3 和后续将军精确化解白方车马反击。',
      mistake: '把“通路兵很快升变”或“Rb8+ 已经反驳”当成结论都会出错；真正的训练点是从推进通路兵一直算到双方资源耗尽。'
    },
    hints: ['先用象把白王和马压住。', '推进 b 兵前，要一直检查白车是否有横向将军。', 'Rb8+ 之后还没结束，黑方的 ...Re2 和 ...Rxe3 是关键防守资源。'],
    steps: lineSteps('d6b4 d2c1 b4c3 h4h5 b6b5 h5g6 h7g6 h1h7 b7b6 h7g7 b5b4 g7g6 b6b5 g6g8 b4b3 g8b8 b5a6 c2a1 b2e2 a1b3 e2e3 c1c2 e3g3 b8d8 c3b4 d8d5 g3g2 c2d1 g2g1 d1e2 g1e1 e2f2 e4e3 f2f3 b4d2 d5f5 e1f1 f3e2 f1f2 e2d3', {
      0: '...Bb4+ 先进一步压缩白王。',
      7: '...b3 允许 Rb8+，黑方必须继续精确防守。',
      10: '...Rxe3! 先消掉 e3 兵，白王被迫进入被将军的格局。',
      19: '...Rf2+ 后 Kd3 到达书中同一 variation 的终点。'
    })
  },
  {
    id: 'mce-karpov-debarnot-create-g6-weakness',
    category: 'rook-bishop-knight',
    title: '先制造车马难守的弱点',
    level: '车象对车马',
    goal: '白先，用 f5! 逼出 g6 弱点',
    fen: '8/p4p2/1n1k2pp/1B1p4/5PKP/1RP3P1/1P6/r7 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 48,
      game: 'Karpov-Debarnot, Las Palmas 1977',
      pdfPage: 119,
      bookPage: 116,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 48 图面还原 FEN；从 1.f5! 到 27.c6 的完整主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '车马防守弱点时配合不如车象稳定；优势方要先制造一个必须长期防守的目标。',
      method: 'f5! 迫使黑方处理 g6，Rb4! 活化并防止 ...d4。Rb5、Ra5、Ra1-a5 继续限制黑马，随后 c4 和 c5 打开第二战场，最后 Rxe6+、Bf5+、c6 把优势转成决胜通路兵。',
      mistake: '直接攻击 d5/a7 不现实；这些弱点暂时守得住。先制造 g6 弱点，再用车和王的调动让黑马防线过载。'
    },
    hints: ['突破点在 f5，不是直接吃 d5 或 a7。', '车要从 b3 摆脱尴尬位置。', 'Rb5! 限制黑马并威胁 Rc5-c6。'],
    steps: lineSteps('f4f5 d6e5 f5g6 f7g6 b3b4 a1e1 b5d3 e5f6 b4f4 f6g7 g4f3 e1e5 f4b4 e5e7 b4b5 e7c7 f3e3 g7f6 e3d4 g6g5 h4g5 h6g5 b5a5 f6e6 b2b3 e6f6 a5a1 b6d7 a1a5 d7b6 g3g4 f6e6 c3c4 d5c4 b3c4 c7d7 d4c3 d7g7 d3f5 e6f6 c3d4 g7e7 c4c5 e7e5 f5e4 b6d7 a5a6 e5e6 a6e6 f6e6 e4f5 e6e7 c5c6', {
      0: 'f5! 先制造黑方王翼弱点。',
      7: 'Rb5! 限制黑马，并准备 Rc5-c6 攻击弱点。',
      22: 'c5 后白方打开第二战场，黑车和马无法同时防住。',
      26: 'c6 到达书中主线终点，白方通路兵决定胜负。'
    })
  },
  {
    id: 'mce-sandberg-naroditsky-bind-knight-to-weakness',
    category: 'rook-bishop-knight',
    title: '把被动马绑在弱兵上',
    level: '车象对车马',
    goal: '黑先，用 ...g4! 转移象并瓦解 g2 防守',
    fen: '8/2k1bp2/4p3/4p1p1/4P3/6N1/PP1R2Pr/2K5 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 49,
      game: 'Sandberg-Naroditsky, San Francisco 2008',
      pdfPage: 122,
      bookPage: 119,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 49 图面还原 FEN；从 1...g4! 到 19...Kc5 的完整攻弱兵主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '车马防守弱兵时最怕被限制；优势方要同时攻击弱点和束缚防守子，让对方的“堡垒”自己挡住通路兵。',
      method: '...g4! 不是单纯冲兵，而是给象开 g5-f4 路线，迫使白马退到 f1/d2。随后 ...g3! 固定 g2 弱点，...Bxd2! 消掉关键防守马，再用 ...f5-f4-f3、...Rxg2 和 ...f2 逼白方车王失调。',
      mistake: '只盯着白方 a、b 通路兵会被动；真正目标是 g2。等白马经 d1-e2-f3 活动起来后，黑方的赢法就会困难得多。'
    },
    hints: ['第一步先想办法让象攻击白马，而不是急着吃兵。', '当白马到 d2 防住 f1-f2 时，可以考虑直接消掉它。', '最后的关键是 ...f3!，让白车和白王无法同时拦住两枚连兵。'],
    steps: lineSteps('g5g4 c1c2 e7g5 d2e2 g5f4 g3f1 h2h1 f1d2 h1g1 a2a4 g4g3 d2f3 g1f1 f3d2 f1a1 c2b3 f4d2 e2d2 f7f5 d2e2 f5f4 b3b4 a1f1 b4c3 f1f2 c3d3 f4f3 e2e1 f2g2 e1f1 f3f2 d3e2 g2g1 b2b4 c7b6 b4b5 b6c5', {
      0: '...g4! 给象开路，白王靠近支援。',
      8: '...Bxd2! 消掉防守马，白车不得不回吃。',
      14: '...Rxg2 收掉原始弱点，但主线还要继续算。',
      18: '...Kc5 到达书中主线终点，白方后翼兵也被控制住。'
    })
  },
  {
    id: 'mce-gdanski-anand-risk-to-attack-weaknesses',
    category: 'rook-bishop-knight',
    title: '攻弱点有时必须冒险',
    level: '车象对车马',
    goal: '黑先，用 ...Rb8!! 和 ...Ba3! 赢下车马防守',
    fen: '2r2b2/7p/2p1k3/8/4P3/ppP2N2/1P2KP2/3R4 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 50,
      game: 'Gdanski-Anand, World Junior Championship Baguio City 1987',
      pdfPage: 123,
      bookPage: 120,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 50 图面还原 FEN；从 1...a2! 到 19...Rh8 的同一战术转化过程合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '车马防守很滑，优势方想攻击弱点时不能只靠自然推进；必要时要用精确战术逼对方暴露新的弱点。',
      method: '...a2! 先制造升变威胁，...Rb8!! 不急着进攻，而是诱使白马吃 c6。白方稳住后，...Ra6 和 ...Ba3! 用象制造“特洛伊木马”，把 b2/c3 弱点串起来，最后转入车兵残局用 h 兵决胜。',
      mistake: '急着 ...Ra8 会让白方 Nxb3、Nc1、Kd1 建成防线；如果不计算白马将军和吃 b3 的资源，黑方优势会突然消失。'
    },
    hints: ['第一步先让 a 兵到 a2，逼白方处理升变威胁。', '不要马上 ...Ra8；先用 ...Rb8!! 诱导白马离开 d4。', '关键战术是 ...Ba3!，让白方不能吃 b3，同时 b2 和 c3 都变成目标。'],
    steps: [
      { move: 'a3a2', reply: 'f3d4', note: '...a2! 逼出白马将军资源。' },
      { move: 'e6f7', reply: 'd1a1', note: '黑王到 f7，白车守住 a 线防止立即升变。' },
      { move: 'c8b8', reply: 'd4c6', note: '...Rb8!! 先引诱白马吃 c6。' },
      { move: 'b8a8', reply: 'e2d3', note: '黑车回 a8，白王到 d3 准备 Kc4。' },
      { move: 'a8a6', reply: 'c6e5', note: '...Ra6 以主动方式应对白王靠近，白马将军。' },
      { move: 'f7e6', reply: 'e5f3', note: '黑王回 e6，白马回 f3 暂时稳住。' },
      { move: 'f8a3', reply: 'f3d4', note: '...Ba3! 是关键战术，白方不能吃 b3。' },
      { move: 'e6e5', reply: 'd4b3', note: '黑王到 e5，白马只好吃 b3。' },
      { move: 'a3b2', reply: 'a1h1', note: '...Bxb2 后，白车转 h1 准备吃 h7。' },
      { move: 'a6a3', reply: 'b3a1', note: '...Ra3! 利用 b2 象保护一切，白马退 a1。' },
      { move: 'a3c3', reply: 'd3d2', note: '黑车吃 c3+，白王被迫退到 d2。' },
      { move: 'b2a1', reply: 'h1a1', note: '...Bxa1 后白车回吃，进入黑方有外侧通路兵的车残局。' },
      { move: 'c3a3', reply: 'd2c2', note: '黑车回 a3，限制白王。' },
      { move: 'h7h5', reply: 'c2b2', note: 'h 兵开始前进，白王靠向 a 兵。' },
      { move: 'a3a8', reply: 'f2f4', note: '黑车转 a8，白方用 f4+ 争取反击。' },
      { move: 'e5e4', reply: 'a1e1', note: '黑王吃 e4 前先避开将军路线，白车转 e1+。' },
      { move: 'e4f4', reply: 'b2a1', note: '黑王吃 f4，白王赶到 a1 已太慢。' },
      { move: 'h5h4', reply: 'e1e7', note: 'h 兵继续推进，白车只能从后方骚扰。' },
      { move: 'a8h8', note: '...Rh8 支援 h 兵，黑方通路兵不可阻挡。' }
    ]
  },
  {
    id: 'mce-feiff-svensson-dont-fear-ghosts',
    category: 'rook-bishop-knight',
    title: '看清无威胁就按计划防守',
    level: '车象防车马',
    goal: '白先，建立象王堡垒并阻止黑方制造长期威胁',
    fen: '2r3k1/5pp1/7p/p1Pp4/2n5/1pB3P1/1P4PP/R5K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 51,
      game: 'Feiff-Svensson, Gothenburg Open 2001',
      pdfPage: 125,
      bookPage: 122,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 51 图面还原 FEN；从 1.Bd4 到 11.Re7 的同一防守堡垒方案合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '防守方如果确认对手没有直接威胁，就不要被“看起来危险”的局面吓到；继续执行能建立堡垒的计划。',
      method: 'Bd4! 先用象守住 c5 和关键斜线，Kf2-e2-d3-d4 把王带到中心。随后 Re1-e6/e7 从侧面骚扰黑王，利用黑方 a5/d5 两个隐藏弱点，让黑车马无法制造长期威胁。',
      mistake: '被 c4 马和少兵局面吓住而乱动车，会让黑方有机会转王或推进 a 兵。正确做法是先确认威胁，再稳步完成王和象的位置。'
    },
    hints: ['先把象放到 d4，别急着动车。', '白王的目标是 f2、e2、d3、d4，一步一步走。', '车到 e 线后用 Re6+/Re7 反复骚扰，黑方无法突破。'],
    steps: [
      { move: 'c3d4', reply: 'g8f8', note: 'Bd4! 固定 c5，也让白方弱点互相保护。' },
      { move: 'g1f2', reply: 'f7f6', note: 'Kf2 走到防守核心，黑方尝试制造等待手。' },
      { move: 'f2e2', reply: 'f8e7', note: '白王按计划向 d4 靠近，不被假威胁打断。' },
      { move: 'e2d3', reply: 'c8a8', note: 'Kd3 继续接近中心，黑车转 a 线寻找机会。' },
      { move: 'd4c3', reply: 'a5a4', note: 'Bc3 保持堡垒，黑方推进 a 兵。' },
      { move: 'd3d4', reply: 'e7d7', note: '白王到 d4 后，防线基本成型。' },
      { move: 'a1e1', reply: 'd7c6', note: 'Re1! 白车开始主动骚扰黑王。' },
      { move: 'e1e6', reply: 'c6b5', note: 'Re6+ 逼黑王远离中心。' },
      { move: 'e6e7', reply: 'b5c6', note: 'Re7 保持侧翼牵制。' },
      { move: 'e7e6', reply: 'c6b5', note: '重复骚扰，黑王不能取得进展。' },
      { move: 'e6e7', note: 'Re7 达成防守循环，黑方无法突破堡垒。' }
    ]
  },
  {
    id: 'mce-riediger-christensen-bad-bishop-defends',
    category: 'rook-bishop-knight',
    title: '坏象也能守住好兵',
    level: '车象防车马',
    goal: '白先，用 Be1、王位选择和反击守住 c3 弱点',
    fen: '4R3/5pkp/2n5/1p1p1p2/1PpP1P2/r1P3P1/5BKP/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 52,
      game: 'Riediger-Christensen, Germany tt 1998/99',
      pdfPage: 126,
      bookPage: 123,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 52 图面还原 FEN；从 1.Be1 到 19.Rg8+ 的同一冷静防守和反击方案合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '防守方的“坏象”如果守住关键兵，就是好防守子；王的位置必须让象不被困住，同时阻止敌车侵入。',
      method: 'Be1! 先守 c3。Kg1、Kf1、Bf2、Bg1!! 让白王避开 h1 陷阱，并用象挡住车。随后 Rc8!/Rb8 抢反击，Rxb5 和 Be3-c1-a3-b4 把象转到更主动的位置，最终用 Rg8+ 取得足够反击。',
      mistake: '用 Re1?! 直接守 c3 会给黑马转 d8-e6-g7-h5-f6-e4 的路线；王若站错到 h1，黑车进入 h 文件后象会被困死。'
    },
    hints: ['先用 Be1! 防 c3，不要急着用车。', '第 6 手是 Bf2，不是 Kf2；这样才能接 Bg1!!。', '防守稳住后，车要反击 b5，象再转到 b4。'],
    steps: [
      { move: 'f2e1', reply: 'a3a2', note: 'Be1! 让坏象守住关键 c3 兵，黑车从 a 线侵入。' },
      { move: 'g2g1', reply: 'g7f6', note: 'Kg1 让王避开 h 文件战术，黑王靠近。' },
      { move: 'e8c8', reply: 'c6e7', note: 'Rc8! 主动攻击，迫使黑马转防。' },
      { move: 'c8b8', reply: 'a2e2', note: 'Rb8 盯 b5，黑车转 e2 制造威胁。' },
      { move: 'g1f1', reply: 'e2h2', note: 'Kf1! 正确王位，黑车吃 h2。' },
      { move: 'e1f2', reply: 'h2h1', note: 'Bf2! 不是王走到 f2；白象准备挡住 h 文件。' },
      { move: 'f2g1', reply: 'h1h3', note: 'Bg1!! 解开黑车威胁，白方最危险阶段已过。' },
      { move: 'f1g2', reply: 'h3h6', note: 'Kg2 使黑车不能深入，黑车回 h6。' },
      { move: 'b8b5', reply: 'f6g7', note: 'Rxb5 白方开始反击，黑王回 g7。' },
      { move: 'g1e3', reply: 'h6d6', note: 'Be3 改善象，黑车转 d6。' },
      { move: 'b5b8', reply: 'e7g8', note: 'Rb8 继续牵制，黑马回 g8。' },
      { move: 'b4b5', reply: 'g8f6', note: 'b5 推出通路兵，黑马回防。' },
      { move: 'e3c1', reply: 'f6e4', note: 'Bc1! 等黑马到 e4 后准备更好地转象。' },
      { move: 'c1a3', reply: 'd6e6', note: 'Ba3 改善象，黑车挡住 e 线。' },
      { move: 'a3b4', reply: 'e4d2', note: 'Bb4 把象放到理想格，黑马跳 d2。' },
      { move: 'b5b6', reply: 'e6e2', note: 'b6 给黑方长期麻烦，黑车转 e2+。' },
      { move: 'g2g1', reply: 'd2f3', note: 'Kg1 冷静躲开，黑马继续将军。' },
      { move: 'g1f1', reply: 'e2d2', note: 'Kf1 后黑车转 d2。' },
      { move: 'b8g8', note: 'Rg8+ 反击到位，白方已经守住并接管主动权。' }
    ]
  },
  {
    id: 'mce-vasilevich-atalik-integrated-defense',
    category: 'rook-bishop-knight',
    title: '综合防守要调动所有子力',
    level: '车象防车马',
    goal: '白先，用 f6!、Rd1!! 和 Rd6! 建立反击型防守',
    fen: '4r1k1/5pp1/p6p/1p2pP1R/3nP1P1/P7/1P1KBP2/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 53,
      game: 'Vasilevich-E. Atalik, Russian Championship (Women) Dagomys 2010',
      pdfPage: 127,
      bookPage: 124,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 53 图面还原 FEN；从 1.f6! 到 29...Kf4 的同一综合防守案例合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '车象防车马时不能只被动守弱点；王、象、车和通路兵都要参与防守，主动资源越多，弱点越不容易被真正攻击。',
      method: 'f6! 先阻止 ...f6 固定弱点，Rh1 后用 Rd1!! 准备 Be2。黑车到 c2 时，Rd6! 是核心，攻击 a6-b5 兵链并逼黑方花时间防守。后面即使黑方多兵，白方 a 兵和象的远程支援让车马无法突破。',
      mistake: '立刻 Be2 会被 ...Rc2 和 ...Nf4 追打；直接 Kd2 又让黑王渗透。必须先用 Rd1!! 准备，再用 Rd6! 把防守转成反击。'
    },
    hints: ['第一步先用 f6! 阻止黑方锁住弱点。', '第 6 手不是普通等着，要用 Rd1!! 准备 Be2。', '黑车到 c2 后，Rd6! 反击 a6-b5 兵链是全局关键。'],
    steps: [
      { move: 'f5f6', reply: 'g7f6', note: 'f6! 先打断 ...f6 固定结构，黑方 g 兵回吃。' },
      { move: 'h5h6', reply: 'e8c8', note: 'Rxh6 抢掉 h6，黑车转 c8。' },
      { move: 'e2d3', reply: 'g8g7', note: 'Bd3 改善象，黑王靠近。' },
      { move: 'h6h1', reply: 'g7g6', note: 'Rh1 保持车的横向防守，黑王到 g6。' },
      { move: 'd2e3', reply: 'd4e6', note: 'Ke3 中央化，黑马跳 e6 制造 ...Kg5/Nf4 威胁。' },
      { move: 'h1d1', reply: 'g6g5', note: 'Rd1!! 先准备 Be2，黑王继续压迫。' },
      { move: 'd3e2', reply: 'c8c2', note: 'Be2 守住 g4，黑车侵入 c2。' },
      { move: 'd1d6', reply: 'c2b2', note: 'Rd6! 反击 a6-b5 兵链，黑车吃 b2。' },
      { move: 'd6a6', reply: 'b2b3', note: 'Rxa6 后白方得到外侧通路兵，黑车将军。' },
      { move: 'e3d2', reply: 'e6c5', note: '白王回 d2，黑马到 c5。' },
      { move: 'a6a5', reply: 'b3b2', note: 'Ra5 继续牵制，黑车回 b2+。' },
      { move: 'd2e3', reply: 'b2b3', note: '白王 e3 后黑车再将。' },
      { move: 'e3d2', reply: 'c5e4', note: '白王回 d2，黑马吃 e4+。' },
      { move: 'd2c2', reply: 'b3h3', note: 'Kc2 避开，黑车转 h3。' },
      { move: 'e2b5', reply: 'e4f2', note: 'Bxb5! 消掉 b 兵，黑马吃 f2。' },
      { move: 'a3a4', reply: 'f2g4', note: 'a4 外侧通路兵启动，黑马吃 g4。' },
      { move: 'a5a7', reply: 'e5e4', note: 'Ra7 盯 f7，黑 e 兵推进。' },
      { move: 'a4a5', reply: 'g4e5', note: 'a 兵继续前进，黑马回 e5。' },
      { move: 'a5a6', reply: 'e5d3', note: 'a6 已成为强反击，黑马到 d3。' },
      { move: 'a7f7', reply: 'd3b4', note: 'Rxf7 后，黑马跳 b4+。' },
      { move: 'c2d2', reply: 'b4a6', note: 'Kd2，黑马吃 a6。' },
      { move: 'b5a6', reply: 'f6f5', note: 'Bxa6 消掉马，黑方只剩车兵优势。' },
      { move: 'a6c8', reply: 'h3d3', note: 'Bc8 控制要点，黑车从 h3 转 d3。' },
      { move: 'd2e2', reply: 'd3d5', note: 'Ke2 后黑车继续骚扰。' },
      { move: 'e2e3', reply: 'd5d3', note: 'Ke3 中央防守，黑车回 d3+。' },
      { move: 'e3f2', reply: 'd3d2', note: 'Kf2 避开，黑车转 d2+。' },
      { move: 'f2e3', reply: 'd2d3', note: 'Ke3 后黑车继续重复。' },
      { move: 'e3e2', reply: 'd3d5', note: 'Ke2，黑车回 d5。' },
      { move: 'f7f8', reply: 'g5f4', note: 'Rf8 后黑王到 f4，白方已经形成足够防守和反击。' }
    ]
  },
  {
    id: 'mce-spassky-karpov-activate-rook-knight',
    category: 'rook-bishop-knight',
    title: '车马进攻先全员激活',
    level: '车马攻车象',
    goal: '黑先，用 ...Rc8!、...g5 和 ...Ne5 转化优势',
    fen: '1r6/1p1n4/3Pkpp1/p7/P2R2P1/BP4K1/8/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 54,
      game: 'Spassky-Karpov, 6th match game, Leningrad 1974',
      pdfPage: 129,
      bookPage: 126,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 54 图面还原 FEN，并用原局资料交叉校验 OCR；从 1...Rc8! 到 17...Ra3 的同一车马转化方案合并为一道题。'
    }),
    teaching: {
      principle: '车马要赢车象，不能急着吃材料；先让车和马都进入主动位置，同时限制象和车的活动空间。',
      method: '...Rc8! 先把车从被动 b8 激活，...g5 固定 g4 弱点并为马争 f4/e5。之后 ...Rc6-c5-c8 和 ...Ne5 迫使换象，转入黑方可长期压制的车残局。白方 b4? 后，...e4! 是关键，利用中心通路兵和车活性收束。',
      mistake: '立即 ...b5 或只盯 d6 兵会给白方换掉后翼兵并建立防守；车马必须先协调起来，保持 ...b5 的威胁比立刻执行更强。'
    },
    hints: ['先把车从 b8 调到 c 文件，不急着吃 d6。', '...g5 固定 g4，也给马准备 e5/f4。', '换掉象后，白方 b4? 可以用 ...e4! 反击。'],
    steps: [
      { move: 'b8c8', reply: 'd4d3', note: '...Rc8! 激活车，白车守 d6。' },
      { move: 'g6g5', reply: 'a3b2', note: '...g5 固定 g4 弱点，白象退 b2。' },
      { move: 'b7b6', reply: 'b2d4', note: '...b6 保留 ...b5 威胁，白象到 d4。' },
      { move: 'c8c6', reply: 'd4c3', note: '...Rc6 继续改善车，白象回 c3 准备 b4。' },
      { move: 'c6c5', reply: 'g3g2', note: '...Rc5 控制 d5，白王转 g2。' },
      { move: 'c5c8', reply: 'g2g3', note: '黑车回 c8，保持压力，白王到 g3。' },
      { move: 'd7e5', reply: 'c3e5', note: '...Ne5!? 迫使白象换马。' },
      { move: 'f6e5', reply: 'b3b4', note: '...fxe5 后黑方进入可赢车残局，白方 b4? 过急。' },
      { move: 'e5e4', reply: 'd3d4', note: '...e4! 是白方漏算的中心反击。' },
      { move: 'e6e5', reply: 'd4d1', note: '黑王到 e5，白车退 d1。' },
      { move: 'a5b4', reply: 'd1b1', note: '...axb4 打开后翼，白车到 b1。' },
      { move: 'c8c3', reply: 'g3f2', note: '...Rc3+ 活化车并逼白王退。' },
      { move: 'c3d3', reply: 'd6d7', note: '黑车转 d3，白方尝试 d7。' },
      { move: 'd3d7', reply: 'b1b4', note: '...Rxd7 消掉通路兵，白车吃 b4。' },
      { move: 'd7d6', reply: 'f2e3', note: '黑车回 d6，白王靠近。' },
      { move: 'd6d3', reply: 'e3e2', note: '...Rd3+ 继续限制白王。' },
      { move: 'd3a3', note: '...Ra3 最后控制 a 兵，白方没有反击。' }
    ]
  },
  {
    id: 'mce-naroditsky-friedel-restrain-rook-bishop',
    category: 'rook-bishop-knight',
    title: '别让车象组合活过来',
    level: '车马攻车象',
    goal: '黑先，用 ...Nc5、...Rb2 和 ...Rxc3 限制白方反击',
    fen: '6k1/1p3pp1/2p1n3/4p1p1/P3P1P1/1RP2BKP/5P2/2r5 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 55,
      game: 'Naroditsky-Friedel, Tulsa 2008',
      pdfPage: 132,
      bookPage: 129,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 55 图面还原 FEN；OCR 易误读 10.Rc2 和 19.Ba6，已按图面与合法走法校验；从 1...Nc5 到 27...gxf4 合并为一道题。'
    }),
    teaching: {
      principle: '车马攻车象时，赢法常常不是马上吃弱兵，而是先限制车象的活化路线，让对方的弱兵无法转化成反击。',
      method: '...Nc5 盯弱点，...Rc2 和 ...Rb2 绑住白车象，...Rxc3 消掉 c3 后，黑方允许白方 a6 反击但换来两个通路兵。随后黑王到 c5、马转 c4/e3/f1，配合车和 g 兵完成攻击。',
      mistake: '如果让白象顺利到 c4、白车到开放线并推进 a5-a6，车象会突然变得很活跃。黑方必须持续限制，而不是贪图单个兵。'
    },
    hints: ['第一步先用马占 c5，限制白车和象。', '...Rb2! 的意义是随时换车，迫使白方接受更差残局。', '即使白方有 a 兵反击，黑方两翼通路兵和活跃马已经足够。'],
    steps: [
      { move: 'e6c5', reply: 'b3a3', note: '...Nc5 先压住关键弱点，白车到 a3。' },
      { move: 'c1c2', reply: 'a4a5', note: '...Rc2 绑住白车，白方用 a5 争取活路。' },
      { move: 'g8f8', reply: 'f3g2', note: '黑王向中心靠近，白象转 g2 准备 f3。' },
      { move: 'c2b2', reply: 'f2f3', note: '...Rb2! 让黑方随时可以换车，白方试图解放象。' },
      { move: 'b2b3', reply: 'a3a2', note: '黑车到 b3 继续压迫，白车守二线。' },
      { move: 'b3c3', reply: 'g3f2', note: '...Rxc3 消掉 c3 弱兵，白王靠近。' },
      { move: 'c3c4', reply: 'a5a6', note: '...Rc4 后白方牺牲 a 兵求活化。' },
      { move: 'b7a6', reply: 'g2f1', note: '...bxa6 接受牺牲，白象回 f1。' },
      { move: 'c4a4', reply: 'a2c2', note: '黑车到 a4，白车到 c2 继续防守。' },
      { move: 'a4a5', reply: 'c2b2', note: '...Ra5 盯 a 兵，白车回 b2。' },
      { move: 'f8e7', reply: 'b2b8', note: '黑王到 e7，白车从 b 文件反击。' },
      { move: 'a5a2', reply: 'f2g3', note: '黑车到 a2+，白王回 g3。' },
      { move: 'a2a3', reply: 'g3g2', note: '黑车继续限制，白王退 g2。' },
      { move: 'a6a5', reply: 'b8a8', note: 'a 兵推进，白车到 a8。' },
      { move: 'f7f6', reply: 'a8a7', note: '...f6 稳固中心，白车到 a7+。' },
      { move: 'e7d6', reply: 'a7g7', note: '黑王到 d6，白车吃 g7。' },
      { move: 'a3c3', reply: 'g7f7', note: '黑车回 c3，白车转 f7。' },
      { move: 'c5d7', reply: 'f1a6', note: '...Nd7 重新调马，白象到 a6。' },
      { move: 'a5a4', reply: 'a6c8', note: 'a 兵继续前进，白象到 c8。' },
      { move: 'd7b6', reply: 'c8f5', note: '黑马转 b6，白象到 f5。' },
      { move: 'a4a3', reply: 'f7f6', note: 'a 兵到 a3，白车吃 f6+。' },
      { move: 'd6c5', reply: 'f6f7', note: '黑王到 c5，白车回 f7。' },
      { move: 'b6c4', reply: 'f7a7', note: '黑马到 c4，白车回 a7。' },
      { move: 'c3c2', reply: 'g2g3', note: '黑车到 c2+，白王到 g3。' },
      { move: 'c4e3', reply: 'f3f4', note: '...Ne3! 马进入决定性攻击路线。' },
      { move: 'e3f1', reply: 'g3f3', note: '...Nf1+ 逼白王到 f3。' },
      { move: 'g5f4', note: '...gxf4 收束，白方无法避免 h2 杀网。' }
    ]
  },
  {
    id: 'mce-nijboer-kritz-calculate-under-pressure',
    category: 'rook-bishop-knight',
    title: '压力下也要继续计算',
    level: '车象攻车马',
    goal: '黑先，在 1.Rd5? 后用 ...c3! 制造决定性通路兵',
    fen: 'r7/4kp2/6p1/1ppRPbNp/p1p2P2/P6P/1PP1K1P1/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 56,
      game: 'Nijboer-Kritz, European Championship Istanbul 2003',
      pdfPage: 133,
      bookPage: 130,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 56 从白方 1.Rd5? 后的图面训练黑方战术；OCR 易误读 5...Bd7，已按图面和合法走法校验到 15...Kg6。'
    }),
    teaching: {
      principle: '面对活跃车象和后翼兵群时，防守方不能因为压力大就被动；进攻方也要抓住对手停止计算的瞬间制造通路兵。',
      method: '在 1.Rd5? 后，...c3! 是战术核心。白方 bxc3 后，...b4、...cxb4、...bxa3 让 a 线通路兵不可避免；随后 ...Bd7 挡住 Rc7+，...Rxc3 转入胜势，最后用象和王翼兵群收束。',
      mistake: '白方本该考虑接受牺牲后的具体计算，或用 1.c3! 先冷静阻止。实战中的 Rd5? 看似自然，却忽略了 a 线通路兵和 ...Bd7 的防守资源。'
    },
    hints: ['白方车已经到 d5，先找能打开 a 线的战术。', '关键不是马上将军，而是 ...c3! 破坏 b2/c3。', '白车到 c7+ 时，用 ...Bd7 挡住，不是走王。'],
    steps: [
      { move: 'c4c3', reply: 'b2c3', note: '...c3! 先迫使 b 兵离开，白方 bxc3。' },
      { move: 'b5b4', reply: 'c3b4', note: '...b4 继续打开后翼，白方 cxb4。' },
      { move: 'c5b4', reply: 'd5c5', note: '...cxb4 后白车到 c5 试图反击。' },
      { move: 'b4a3', reply: 'c5c7', note: '...bxa3 建立 a 线通路兵，白车到 c7+。' },
      { move: 'f5d7', reply: 'c7c3', note: '...Bd7! 挡住将军，白车回 c3。' },
      { move: 'a8c8', reply: 'e2d2', note: '黑车转 c8，白王到 d2。' },
      { move: 'c8c3', reply: 'd2c3', note: '...Rxc3 交换进入胜势，白王回吃。' },
      { move: 'h5h4', reply: 'g5f3', note: '...h4 推进，白马回 f3。' },
      { move: 'd7c6', reply: 'f3h4', note: '...Bc6 改善象，白马吃 h4。' },
      { move: 'c6e4', reply: 'g2g4', note: '...Be4 压制，白方 g4 试图反击。' },
      { move: 'g6g5', reply: 'f4g5', note: '...g5! 打开王翼，白方 fxg5。' },
      { move: 'e7e6', reply: 'h4f5', note: '黑王到 e6，白马 f5。' },
      { move: 'e4f5', reply: 'g4f5', note: '...Bxf5 消掉马，白 g 兵回吃。' },
      { move: 'e6f5', reply: 'h3h4', note: '黑王吃 f5，白方只剩 h 兵反击。' },
      { move: 'f5g6', note: '...Kg6 控制住局面，黑方兵群决定胜负。' }
    ]
  },
  {
    id: 'mce-karpov-kramnik-restrict-before-converting',
    category: 'rook-bishop-knight',
    title: '先限制，再转化',
    level: '车马攻车象',
    goal: '白先，用 g3! 和耐心调动压住车象',
    fen: '3r3k/1pb2p2/p4p1p/8/8/5N2/PP3PPP/4R1K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 57,
      game: 'Karpov-Kramnik, Vienna 1996',
      pdfPage: 134,
      bookPage: 131,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 57 图面还原 FEN；从 1.g3! 到 35.Kxf5 的完整限制和转化主线合并为一道题，后续不另拆新题。'
    }),
    teaching: {
      principle: '优势方不必急着兑现；如果还有时间，就先限制对手的车象活动，再把王和马送进对方阵地。',
      method: 'g3! 一手同时给王腾出 g2、限制 c7 象并准备 Nh4-f5。Re2 先防 ...Rd2，Nh4 后再用 Re7/Rd7 逼黑车被动。b4!、Nf5+-Ne3 和 Kg4-h5 入侵后，白方继续用 Nf5+、Ra8+、h 兵推进与 Rxb4/Rxa4 化掉反击，最后 Kxf5 转化。',
      mistake: '急着 Nh4 或直接攻击弱兵会给黑车活动机会。Karpov 的核心是先让 ...Rd2 失效，再一点点剥夺黑方反击。'
    },
    hints: ['第一步不是马上 Nh4，而是先用 g3! 给王找安全格。', 'Re2 是耐心手，目的是让 ...Rd2 没有意义。', 'Kh5 不是终点，后面还要处理黑方 a、b 兵反击。'],
    steps: lineSteps('g2g3 d8d7 e1e2 h8g7 f3h4 d7d5 e2e7 d5c5 e7d7 b7b5 b2b4 c5c2 h4f5 g7g6 f5e3 c2c1 g1g2 c7e5 d7a7 c1c6 e3d5 e5d6 a2a3 g6f5 d5e3 f5g6 g2f3 d6e5 e3d5 g6g7 d5e7 c6c3 f3g4 c3a3 f2f4 e5c3 g4h5 c3b4 e7f5 g7g8 a7a8 g8h7 a8a7 h7g8 f5h6 g8f8 a7f7 f8e8 h5g6 b4c3 h6f5 b5b4 f7b7 a3a2 h2h4 a6a5 h4h5 a5a4 h5h6 a2h2 h6h7 e8d8 f5h4 f6f5 b7b4 h2h3 b4a4 h3g3 g6f5', {
      0: 'g3! 给王腾出 g2，并限制黑象。',
      7: 'Ne3 改善马，黑车只能被动将军。',
      18: 'Kh5 王进入黑方阵地，但主线还没有结束。',
      34: 'Kxf5 到达书中转化终点。'
    })
  },
  {
    id: 'mce-naroditsky-nip-patient-defense-earlier-stage',
    category: 'rook-bishop-knight',
    title: '耐心防守先中和计划',
    level: '车马防车象',
    goal: '黑先，守住 d5 并避免给白方第二战线',
    fen: '8/5k1p/p2rnpp1/1p1p4/7P/2P1BPPP/PP4K1/3R4 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 58,
      game: 'Naroditsky-Nip, San Francisco 2007',
      pdfPage: 137,
      bookPage: 134,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 58 是同局更早的车象对车马阶段；从 1...Rd7 到 9...Nxd4! 合并为一道题，后续单车残局已由例 17 覆盖。'
    }),
    teaching: {
      principle: '被动防守时第一步通常是中和对方计划，而不是急着反击；只要弱点被守住，对方就必须冒险改变结构。',
      method: '...Rd7 和 ...Rb7 专门防 a4 计划，...Rd6 与 ...g5! 防止白方沿 h 线打开第二战线。白方 f4-fxg5 后，...fxg5! 不制造额外弱点，最后 ...Nxd4! 转入可守的车残局。',
      mistake: '过早 ...d4? 会被 cxd4 后 ...Nxd4 丢子；随手 ...f5 也会给白方更多突破目标。防守方要先保持结构完整。'
    },
    hints: ['先让车守住 d5，并准备横向防 a4。', '白方 h5 后，...g5! 比被动等着更准确。', '第 8 手用 f 兵回吃，避免制造新的 h/f 弱点。'],
    steps: [
      { move: 'd6d7', reply: 'd1a1', note: '...Rd7 先守 d5 并准备 ...Rb7。' },
      { move: 'd7b7', reply: 'a1d1', note: '...Rb7 中和 a4 计划，白车回 d1。' },
      { move: 'b7d7', reply: 'g3g4', note: '黑车回 d7，白方用 g4 抢空间。' },
      { move: 'd7d6', reply: 'h4h5', note: '...Rd6 保持防守，白方 h5 试图开第二战线。' },
      { move: 'g6g5', reply: 'g2g3', note: '...g5! 正确固定王翼，白王到 g3。' },
      { move: 'h7h6', reply: 'f3f4', note: '...h6 继续封锁，白方只能 f4。' },
      { move: 'd6d7', reply: 'f4g5', note: '黑车回 d7，白方 fxg5。' },
      { move: 'f6g5', reply: 'e3d4', note: '...fxg5! 不制造新弱点，白象到 d4。' },
      { move: 'e6d4', note: '...Nxd4! 交换进入可守车残局。' }
    ]
  },
  {
    id: 'mce-cherepkov-aronin-calculate-defensive-resource',
    category: 'rook-bishop-knight',
    title: '防守资源要算到临界点',
    level: '车马防车象',
    goal: '黑先，用 ...Rc7! 和 ...Nd4+ 找到和棋资源',
    fen: '6k1/p2r2pp/4p3/n1B1Pp2/5P2/6P1/P5KP/1R6 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 59,
      game: 'Cherepkov-Aronin, USSR Championship Leningrad 1957',
      pdfPage: 138,
      bookPage: 135,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 59 图面还原 FEN；从 1...Rc7! 到 25.Bd2 的完整防守主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '成功防守常常不是靠“幸运资源”，而是因为前面每一步都没有出错；到临界点时，具体计算会显示真正的救命手。',
      method: '...Rc7! 先让车摆脱象线，白方 Bd6 后 ...Rc2+ 活化。之后 ...Nc6、...Nd4+ 准确判断换车后的象马残局，关键是 ...Nc2+、...Nb4+、...Nxa2 和 ...Nc1-e2-g1-f3。...g5! 后还要用 ...Nxh4-g6、...Kf7-e7-d7、...h5 与 ...Ne7-d5 维持封锁，直到 Bd2 和棋。',
      mistake: '被动 ...Rd7 或贪吃 a2 都容易走进白方的强制赢法；换车前必须算清马是否能从 a2 逃到 f3。'
    },
    hints: ['先把车放到 c7，让白方 Bd6 后车仍有活动。', '换车前要算清 ...Nc2+ 和 ...Nb4+。', '...g5! 只是和棋资源的开始，后面还要继续封锁白王和 e 兵。'],
    steps: lineSteps('d7c7 b1b8 g8f7 c5d6 c7c2 g2f3 a5c6 b8b7 f7g8 b7c7 c6d4 f3e3 c2c7 d6c7 d4c2 e3d3 c2b4 d3c4 b4a2 c7a5 a2c1 a5d2 c1e2 c4d3 e2g1 d2e3 g1f3 h2h3 g7g5 e3a7 g5f4 g3f4 f3h4 a7f2 h4g6 f2g3 g8f7 d3c4 f7e7 c4b5 e7d7 b5c5 h7h5 c5b5 g6e7 g3e1 e7d5 e1d2', {
      0: '...Rc7! 先摆脱象线，白车到 b8+。',
      5: '...Nd4+ 是关键，逼白王到 e3 后才能安全换车。',
      14: '...g5! 是救命手，但主线还要继续算到和棋终点。',
      23: '...Nd5 后 Bd2，到达书中 1/2-1/2 的终点。'
    })
  },
  {
    id: 'mce-naroditsky-ayers-permanent-activity',
    category: 'rook-bishop-knight',
    title: '永久活动不能换成临时活动',
    level: '车象攻车马',
    goal: '白先，找出激活王后的错误和黑方惩罚',
    fen: '8/1p5p/1r2k1pb/1N3p2/P7/3p1PK1/1P4PP/1R6 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 60,
      game: 'Naroditsky-Ayers, Los Angeles 2005',
      pdfPage: 140,
      bookPage: 137,
      chapter: 'Chapter 3: Rook + Minor Piece(s) vs Rook + Minor Piece(s)',
      note: '例 60 图面还原 FEN；从 1.f4! 到 7...Be5+ 的永久活动与临时活动转折合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '防守方的活动要分清永久和临时；如果主动手留下不可修复的弱格，对方一旦赶走你的活跃子力，位置会立即崩溃。',
      method: 'f4! 先给白王开路，黑方 ...Kd5-c4 激活王。白方 b3+? 看似赶王，却严重削弱 c3/a3。黑方 ...Kb4! 后 ...d2!、...Bxf4+、...Rc6+、...Be5+ 迅速利用弱格和王位。',
      mistake: '正确防守是 3.Rd1! 防住 ...Kb3 相关威胁；实战 b3+? 把白马的长期防守转成了短暂赶王，代价是关键弱格失守。'
    },
    hints: ['白方先用 f4! 试图让王靠近主战场。', 'b3+? 是诱人的临时活动，但会制造 c3/a3 弱格。', '黑方的收束手段是 ...d2! 加 ...Bxf4+。'],
    steps: [
      { move: 'f3f4', reply: 'e6d5', note: 'f4! 给白王开路，黑王也主动到 d5。' },
      { move: 'g3f3', reply: 'd5c4', note: '白王到 f3，黑王到 c4 诱导 b3+。' },
      { move: 'b2b3', reply: 'c4b4', note: 'b3+? 赶王但制造 c3/a3 弱格，黑王到 b4。' },
      { move: 'f3e3', reply: 'd3d2', note: '白王靠近，...d2! 打开战术。' },
      { move: 'e3d2', reply: 'h6f4', note: '白王吃 d2，但 ...Bxf4+ 拿掉关键防守。' },
      { move: 'd2c2', reply: 'b6c6', note: 'Kc2 后 ...Rc6+ 继续逼王。' },
      { move: 'c2b2', reply: 'f4e5', note: 'Kb2? 后 ...Be5+，白方无解。' }
    ]
  },
  {
    id: 'mce-naroditsky-zhurbinsky-king-safety-path',
    category: 'queen-endgames',
    title: '先给王找安全路线',
    level: '后残局',
    goal: '白先，在长将中护住通路兵',
    fen: '8/5pkp/3Q4/5P2/q6P/8/2P1K3/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 61,
      game: 'Naroditsky-Zhurbinsky, Orlando 2004',
      pdfPage: 143,
      bookPage: 140,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 61 图面还原 FEN；从 1.Qe5+ 到 10.c5 的王路转移和后换后收束合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局里，裸王会让对方的后保持“战斗力”；真正的目标不是乱躲将，而是找到能让王脱离长将的安全路线。',
      method: 'Qe5+ 先把后调到能保护弱兵的位置。黑王到 f8 后 Qc5+! 逼王到 g7，随后 c4 打开白王从 e2-e3-e4-d5-d6 的路线。王到后翼后，黑后的长将失去威胁，Qe5+ 交换后进入赢的兵残局。',
      mistake: '只想着立刻吃子或被动防守 h4/c2，会让黑后继续在 e4、g4、h1 等点长将并赢掉白兵。'
    },
    hints: ['第一步先改善后的位置，同时防住关键弱兵。', '第二步不是换后，而是用 Qc5+ 逼黑王走到更被动的位置。', 'c4 后白王要沿 e3-e4-d5-d6 找安全区。'],
    steps: [
      { move: 'd6e5', reply: 'g7f8', note: 'Qe5+ 保护 f5/h5 方向并改善后的位置；...Kf8? 给白方争取节奏。' },
      { move: 'e5c5', reply: 'f8g7', note: 'Qc5+! 逼黑王回 g7，同时让白后守住 c2。' },
      { move: 'c2c4', reply: 'a4c2', note: 'c4 打开王路；黑后只能从 c2+ 开始长将。' },
      { move: 'e2e3', reply: 'c2c3', note: '白王向中心走，准备穿过 e4。' },
      { move: 'e3e4', reply: 'c3e1', note: 'Ke4 继续靠近后翼安全区，黑后只能保持将军。' },
      { move: 'e4d5', reply: 'e1h1', note: 'Kd5 后白王已经接近安全区，h4 兵仍牵制黑后。' },
      { move: 'd5d6', reply: 'h1h2', note: 'Kd6 让白王脱离长将核心区域；...Qh2+?? 给了换后机会。' },
      { move: 'c5e5', reply: 'h2e5', note: 'Qe5+! 强制换后，黑后无法继续长将。' },
      { move: 'd6e5', reply: 'h7h5', note: 'Kxe5 后进入赢的兵残局，黑方只能推 h 兵。' },
      { move: 'c4c5', note: 'c5 形成决定性通路兵，白方赢。' }
    ]
  },
  {
    id: 'mce-sherzer-almasi-shelter-for-the-king',
    category: 'queen-endgames',
    title: '给王规划避风港',
    level: '后残局',
    goal: '黑先，穿过将军把王送到安全区',
    fen: '6Q1/8/8/p4k2/1p4p1/1P3q2/P7/6K1 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 62,
      game: 'Sherzer-Almasi, Hungarian Team Championship Budapest 1995',
      pdfPage: 144,
      bookPage: 141,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 62 图面还原 FEN；从 1...g3! 到 15...Qxe6+ 的黑王 a3 安全路线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '被长将时不要漫无目的地逃王；先找最终安全格，再用每一步把王往那里送。',
      method: '...g3! 先固定最远通路兵，白后不断将军时，黑王沿 f5-e4-d3-d2-c2-b2-a3 前进。到 a3 后白后已经够不到黑王，黑方再用 ...Qa1+、...Qxa2+ 和 g2-g1N+ 收束。',
      mistake: '如果黑王只是随手躲将，很容易回到开放区域被白后持续骚扰；关键是从一开始就认准 a3。'
    },
    hints: ['先推进最危险的通路兵，不急着躲将。', '黑王的目的地是 a3，不是临时安全的一格。', '到 a3 后，白后的将军资源基本消失。'],
    steps: [
      { move: 'g4g3', reply: 'g8c8', note: '...g3! 让通路兵成为白方无法忽视的威胁，白后开始将军。' },
      { move: 'f5e4', reply: 'c8e6', note: '黑王向 e4 走，继续朝 a3 的安全路线前进。' },
      { move: 'e4d3', reply: 'e6c4', note: '...Kd3 避开横向将军，白后从 c4+ 继续骚扰。' },
      { move: 'd3d2', reply: 'c4d4', note: '...Kd2，白后试图从 d4+ 逼王回头。' },
      { move: 'd2c2', reply: 'd4c5', note: '...Kc2 再靠近后翼，白后只能继续横向将军。' },
      { move: 'c2b2', reply: 'c5e5', note: '...Kb2，白后 e5+ 是最后几次有效将军之一。' },
      { move: 'f3c3', reply: 'e5e2', note: '...Qc3 挡住并转入 a1-a2 反击路线。' },
      { move: 'b2a3', reply: 'e2e6', note: '...Ka3 到达安全区，白后已经无法持续将军。' },
      { move: 'c3a1', reply: 'g1g2', note: '...Qa1+ 抢先反击，白王到 g2。' },
      { move: 'a1a2', reply: 'g2h3', note: '...Qxa2+ 消掉白方 a 兵，白王到 h3。' },
      { move: 'a2h2', reply: 'h3g4', note: '...Qh2+ 继续逼王，保护 g 兵推进。' },
      { move: 'g3g2', reply: 'g4f3', note: '...g2，白王靠近也无法阻止升变。' },
      { move: 'g2g1n', reply: 'f3e4', note: '...g1N+!? 是书中趣味收束；直接升后同样赢。' },
      { move: 'h2e2', reply: 'e4f5', note: '...Qe2+ 继续限制白王。' },
      { move: 'e2e6', note: '...Qxe6+ 拿掉白后，黑方胜。' }
    ]
  },
  {
    id: 'mce-naroditsky-study-safe-king-passed-pawn',
    category: 'queen-endgames',
    title: '安全王支援通路兵',
    level: '后残局',
    goal: '白先，用后和安全王推进 b 兵',
    fen: '8/5pk1/1q4p1/7p/7P/5QP1/1P3PK1/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 63,
      game: 'Naroditsky, Study position 2010',
      pdfPage: 144,
      bookPage: 141,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 63 图面还原 FEN；从 1.Qc3+ 到 7.Qxg5 的安全王与通路兵推进合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局中，通路兵能不能推进，往往取决于己王是否足够安全；王安全时，后可以自由承担支援和防守两件事。',
      method: 'Qc3+ 先把后放到 c 线，既支援 b 兵又保留横向机动。b4 后威胁 Qc5，黑后只能从 b7/d5/f3 寻找反击。白方 b5 不怕虚假威胁，最后 Qe3! 避免换后并赢 g5。',
      mistake: '过早 hxg5 会给黑方 h4 反击；真正稳妥的是先 Qe3!，让黑后无法交换。'
    },
    hints: ['第一步先把后放到能支援 b 兵的 c 线。', 'b4 后的核心威胁是 Qc5，同时照看 f2。', '5...g5!? 后不要急着吃，先用 Qe3! 避免换后。'],
    steps: [
      { move: 'f3c3', reply: 'g7h7', note: 'Qc3+ 把后放到稳定支援点，黑王到 h7。' },
      { move: 'b2b4', reply: 'b6b7', note: 'b4 建立 Qc5 的威胁，黑后从 b7+ 寻找反击。' },
      { move: 'g2h2', reply: 'b7d5', note: 'Kh2 后白王仍安全，黑后转到 d5 试图活化。' },
      { move: 'c3c5', reply: 'd5f3', note: 'Qc5 攻守兼备；...Qf3 企图制造王翼反击。' },
      { move: 'b4b5', reply: 'g6g5', note: 'b5 不怕虚假威胁，...g5!? 是最后的搅局。' },
      { move: 'c5e3', reply: 'f3b7', note: 'Qe3! 最稳，黑方不能满意地换后，只好回 b7。' },
      { move: 'e3g5', note: 'Qxg5 赢掉 g 兵，白方通路兵决定胜负。' }
    ]
  },
  {
    id: 'mce-alekhine-reshevsky-f3-perpetual-resource',
    category: 'queen-endgames',
    title: '一个弱兵改变结果',
    level: '后残局',
    goal: '白先，理解通路兵局面为何无法摆脱长将',
    fen: '8/3q1p1k/6pp/8/8/P4PP1/2Q3KP/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 64,
      game: 'Alekhine-Reshevsky, AVRO Tournament Amsterdam 1938',
      pdfPage: 145,
      bookPage: 142,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 64 图面还原 FEN；从 1.Qa2 到 17...Qb2+ 的相似后残局守和资源合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '两个后残局看起来只差一个兵位，结果可能完全不同；f3 弱兵给黑后永久将军和吃兵目标，白王难以建立安全区。',
      method: 'Qa2 和 a4-a5 先推进通路兵，但 ...Qc6-a6! 同时挡住 a 兵并保留 e2/c4/d4/b2 的长将入口。白方 4.g4?! 让黑方更容易制造王翼弱点，后续白王多次尝试转移，黑后始终围绕 f3 与 h2 长将。',
      mistake: '把第 63 题的安全王模式机械套用到这里会误判；白兵在 f3 而不是 f2，意味着黑后能用 ...Qd2+、...Qxf3 和侧翼将军不断骚扰。'
    },
    hints: ['先推进 a 兵，但注意黑后会到 a6 同时挡兵和保留将军。', '4.g4?! 不是解决方案，它让黑方王翼反击更快。', '白王无法像上一题一样建立稳定安全区，黑后围绕 f3/h2 长将。'],
    steps: [
      { move: 'c2a2', reply: 'h7g8', note: 'Qa2 支援 a 兵，黑王到 g8。' },
      { move: 'a3a4', reply: 'd7c6', note: 'a4 推进通路兵，...Qc6 准备挡住 a 兵。' },
      { move: 'a4a5', reply: 'c6a6', note: 'a5 后 ...Qa6!，黑后既挡兵又保留 e2 入口。' },
      { move: 'g3g4', reply: 'h6h5', note: 'g4?! 让黑方 ...h5 和 ...g5 反击更容易。' },
      { move: 'g2f2', reply: 'a6d6', note: '白王试图转移，黑后从 d6 保持侧翼将军。' },
      { move: 'f2f1', reply: 'd6a6', note: 'Kf1 后黑后回 a6+，继续牵制 a 兵。' },
      { move: 'f1g2', reply: 'g8g7', note: '白王回 g2，黑王也调整到 g7。' },
      { move: 'a2b2', reply: 'g7g8', note: 'Qb2+ 试图赶王，黑王回 g8。' },
      { move: 'b2b8', reply: 'g8g7', note: 'Qb8+ 继续将军，但白方没有实质推进。' },
      { move: 'b8e5', reply: 'g7g8', note: 'Qe5+ 后黑王回 g8。' },
      { move: 'g2f2', reply: 'a6a7', note: '白王再次尝试转移，...Qa7+ 继续骚扰。' },
      { move: 'f2e2', reply: 'a7a6', note: 'Ke2 后 ...Qa6+，白王仍无法安全前进。' },
      { move: 'e2d2', reply: 'a6c4', note: 'Kd2 后 ...Qc4，黑后进入长将网络。' },
      { move: 'e5f5', reply: 'c4d4', note: 'Qf5 试图保持压力，但 ...Qd4+ 继续追王。' },
      { move: 'd2e2', reply: 'd4b2', note: 'Ke2 后 ...Qb2+，黑后从侧面持续将军。' },
      { move: 'e2d3', reply: 'b2b3', note: 'Kd3 后 ...Qb3+，白王仍无法藏身。' },
      { move: 'd3e2', reply: 'b3b2', note: 'Ke2 ...Qb2+，形成重复长将，和棋。' }
    ]
  },
  {
    id: 'mce-naroditsky-study-slow-pawn-pressure',
    category: 'queen-endgames',
    title: '没有通路兵时慢慢施压',
    level: '后残局',
    goal: '白先，用王、后和兵群制造王翼攻击',
    fen: '6k1/5p2/4p1p1/5q2/8/4PPQ1/5P1P/6K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 65,
      game: 'Naroditsky, Study position 2010',
      pdfPage: 147,
      bookPage: 144,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 65 图面还原 FEN；从 1.Kg2 到 18.Qh6+ 的慢压和 h 兵破王合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '没有通路兵也不等于无法赢；优势方可以用安全王、主动后和兵群慢慢制造弱格，再把边兵当成攻城锤。',
      method: 'Kg2 先动员王，Qg4! 迫使黑后去被动位置，f4、e4、h4 逐步扩张。黑方 ...Qd5+、...Qd3! 保持后的战斗力，但白方通过 e5、Qg3、Qg5+ 和 Qf6! 逼黑王防守，最后 h5! 打开王翼。',
      mistake: '每次看见换后都要算兵残局；书中两处 ...Qxf3+ 都因为白王和兵形而输，8.Qe3? 反而会让黑方通过换后和 ...fxe5 获得和棋机会。'
    },
    hints: ['先把王动到 g2，再用 Qg4! 迫使黑后被动。', '不要急于换后；先用 f4、e4、h4 扩张。', '关键突破是 h5!，把 h 兵当成打开黑王的工具。'],
    steps: [
      { move: 'g1g2', reply: 'g8g7', note: 'Kg2 动员王，黑王到 g7。' },
      { move: 'g3g4', reply: 'f5b5', note: 'Qg4! 威胁换后，迫使黑后去 b5 这种被动格。' },
      { move: 'f3f4', reply: 'b5d5', note: 'f4 开始兵群推进，黑后用 ...Qd5+ 保持骚扰。' },
      { move: 'g4f3', reply: 'd5d3', note: 'Qf3 避免永久活动；...Qd3! 继续让黑后保持战斗力。' },
      { move: 'e3e4', reply: 'd3d4', note: 'e4 承担风险换取空间，黑后仍不能满意地换后。' },
      { move: 'h2h4', reply: 'g7h6', note: 'h4! 准备 h5 破王，...Kh6! 是关键防守。' },
      { move: 'e4e5', reply: 'f7f6', note: 'e5! 继续压缩黑方；...f6 试图减少棋盘上的兵。' },
      { move: 'f3g3', reply: 'f6f5', note: 'Qg3 保持后活跃，...f5 争取换兵。' },
      { move: 'g3g5', reply: 'h6h7', note: 'Qg5+ 逼王到 h7，黑方暗格更弱。' },
      { move: 'g5e7', reply: 'h7h6', note: 'Qe7+ 继续逼王，黑王只能到 h6。' },
      { move: 'e7f6', reply: 'd4d5', note: 'Qf6! 威胁 Qh8#，迫使黑后转入将军防守。' },
      { move: 'f2f3', reply: 'h6h7', note: 'f3 给王和后补支撑，黑王回 h7。' },
      { move: 'f6f7', reply: 'h7h8', note: 'Qf7+ 把黑王赶到 h8。' },
      { move: 'h4h5', reply: 'g6h5', note: 'h5! 终于打开王翼，黑方只能 gxh5。' },
      { move: 'f7h5', reply: 'h8g8', note: 'Qxh5+ 拿回兵并继续进攻。' },
      { move: 'g2g3', reply: 'd5d2', note: 'Kg3 让白王参加进攻，黑后只能从 d2 寻找将军。' },
      { move: 'h5g6', reply: 'g8h8', note: 'Qg6+ 逼黑王回 h8。' },
      { move: 'g6h6', note: 'Qh6+ 后黑方无可救药，白方赢。' }
    ]
  },
  {
    id: 'mce-kholmov-geller-direct-king-attack',
    category: 'queen-endgames',
    title: '安全王支持直接攻王',
    level: '后残局',
    goal: '白先，用王和兵群发动几乎无风险的攻击',
    fen: '8/5Qpk/8/4p3/8/6PP/4qP1K/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 66,
      game: 'Kholmov-Geller, USSR Championship Kiev 1954',
      pdfPage: 148,
      bookPage: 145,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 66 图面还原 FEN；从 1.g4 到 10.Kh6 的直接攻王主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局中，王更安全的一方可以切换到直接攻王；己王不怕长将时，兵群推进会变成实际杀王手段。',
      method: 'g4 先夺取王翼空间，Kg3-h4-g5 让白王直接参战。Qf5+、Qf7+、Qf6 建立杀网，最后 f4! 解开钉住和制造 g5 威胁，黑方无力防守。',
      mistake: '只盯着物质优势会错过攻王机会；但 6.g5# 因为 g 兵被钉住并不成立，必须先用王和 f 兵解除限制。'
    },
    hints: ['先用 g4 打开王翼空间。', '白王要主动走到 h4-g5 参加攻击。', '最后的精确手是 f4!，解除钉住并留下 g5 威胁。'],
    steps: [
      { move: 'g3g4', reply: 'e2d2', note: 'g4 先推进兵群，黑后到 d2 试图保持将军。' },
      { move: 'h2g3', reply: 'd2c3', note: 'Kg3 让王主动靠近，黑后从 c3+ 继续骚扰。' },
      { move: 'g3h4', reply: 'c3d4', note: 'Kh4 进入攻击区域，黑后到 d4。' },
      { move: 'f7f5', reply: 'g7g6', note: 'Qf5+ 逼黑方 ...g6，削弱王翼。' },
      { move: 'f5f7', reply: 'h7h6', note: 'Qf7+ 把黑王赶到 h6。' },
      { move: 'f7f6', reply: 'h6h7', note: 'Qf6 控制关键格；白方暂时不能 g5#，因为 g 兵被钉住。' },
      { move: 'h4g5', reply: 'd4d2', note: 'Kg5 让白王直接参与攻王，黑后只能从 d2+ 寻找反击。' },
      { move: 'f2f4', reply: 'e5f4', note: 'f4! 是最后精确手，黑方 ...exf4 后也挡不住。' },
      { move: 'f6f7', reply: 'h7h8', note: 'Qf7+ 逼王到 h8。' },
      { move: 'g5h6', note: 'Kh6 后黑方无防；若 ...f3+，白方 g5 决定胜负。' }
    ]
  },
  {
    id: 'mce-onikienkoo-podolchenko-restrain-passer',
    category: 'queen-endgames',
    title: '面对远方通路兵不要慌',
    level: '后残局',
    goal: '白先，沿实战错误线理解为何必须先限制通路兵',
    fen: '8/1pQ3p1/5pk1/8/pq2PP2/3K4/2P3PP/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 67,
      game: 'Onikienkoo-Podolchenko, Geller Memorial Odessa 2007',
      pdfPage: 149,
      bookPage: 146,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 67 图面还原 FEN；实战从 1.f5+?! 到 11...a2 的恐慌失控线合并为一道题，正确防守资源写入教学提示并用程序校验主线。'
    }),
    teaching: {
      principle: '面对远方通路兵时，第一反应不能是恐慌将军或乱推进；先限制通路兵，后才能用物质优势和王翼压力争取结果。',
      method: '实战 1.f5+?!、2.h4?! 没有解决 a 兵问题，黑方 ...a3! 后白方必须在守 e4 和盯 a 兵之间选择。4.Kd2?? 让白王后失调，...Qa4!、...Qd4+ 和 ...a2 迅速赢棋。',
      mistake: '冷静的资源是 1.Qd7! 准备长将；即使进入 3...Qb5+ 后，关键也应是 4.Ke3! 守住 e4，而不是 4.Kd2?? 靠近 a 兵却丢掉协调。'
    },
    hints: ['实战第一步 f5+?! 是恐慌推进，不是真正限制 a 兵。', '黑方机会是 ...a3!，让白后对 a 兵失去战斗力。', '关键错误是 4.Kd2??；正确防守思路要先守住 e4。'],
    steps: [
      { move: 'f4f5', reply: 'g6h7', note: 'f5+?! 不输但让防守更难；黑王到 h7。' },
      { move: 'h2h4', reply: 'a4a3', note: 'h4?! 继续没有限制 a 兵，...a3! 抓住机会。' },
      { move: 'c7f7', reply: 'b4b5', note: 'Qf7 后 ...Qb5+，白方来到关键选择点。' },
      { move: 'd3d2', reply: 'b5a4', note: 'Kd2?? 看似靠近 a 兵，其实让 e4 和王后协调崩溃；...Qa4!。' },
      { move: 'f7a2', reply: 'a4d4', note: 'Qa2 试图盯住 a 兵，但 ...Qd4+ 先手将军。' },
      { move: 'd2c1', reply: 'd4c3', note: 'Kc1 后 ...Qc3，黑后持续追王。' },
      { move: 'c1d1', reply: 'b7b5', note: 'Kd1 后 ...b5，黑方再添一个危险通路兵。' },
      { move: 'a2e6', reply: 'c3d4', note: 'Qe6 想反击，...Qd4+ 继续压迫。' },
      { move: 'd1e1', reply: 'd4b4', note: 'Ke1 后 ...Qb4+，白王无法躲开将军。' },
      { move: 'e1d1', reply: 'b4b1', note: 'Kd1 后 ...Qb1+，黑后逼王离开关键格。' },
      { move: 'd1d2', reply: 'a3a2', note: 'Kd2 后 ...a2，通路兵决定胜负。' }
    ]
  },
  {
    id: 'mce-ashley-de-firmian-pawn-race-king-safety',
    category: 'queen-endgames',
    title: '兵赛跑里王位更重要',
    level: '后残局',
    goal: '黑先，利用白王不安全反转兵赛跑',
    fen: '3Q4/5p1k/1P4p1/7p/5P2/4P3/4K3/7q b - - 0 1',
    orientation: 'b',
    source: source({
      example: 68,
      game: 'Ashley-De Firmian, New York 1996',
      pdfPage: 151,
      bookPage: 148,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 68 图面还原 FEN；从 1...h4! 到 26...Qc5+ 的追王、双升后和强制换后全线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局的兵赛跑不只比谁先升变；王位安全、后是否有持续将军、弱兵链是否被攻击，都会决定真正的速度。',
      method: '...h4! 先推进自己的远方通路兵，再用 ...Qg2+、...Qf1+ 一路把白王引到 b8。白方看似 b 兵更快，但黑王藏在 h6/g7 附近很安全，黑后通过 ...Qxe3、...h3-h2-h1Q 取得反击，双后阶段继续用将军逼到强制换后。',
      mistake: '白方多次可以选择长将和重复，如 13.Qd7+、16.Qd6!；实战执着于赢棋，忽视了自己的王比黑王危险得多。'
    },
    hints: ['黑方第一步不是将军，而是用 ...h4! 开始兵赛跑。', '连续将军的目标是把白王引到远离安全区的位置。', '白方升后后仍不能将军，黑王安全是决定性因素。'],
    steps: [
      { move: 'h5h4', reply: 'd8d7', note: '...h4! 让自己的通路兵进入赛跑；白后到 d7。' },
      { move: 'h1g2', reply: 'e2d3', note: '...Qg2+ 开始追王，白王到 d3。' },
      { move: 'g2f1', reply: 'd3c3', note: '...Qf1+ 继续把王往后翼赶。' },
      { move: 'f1c1', reply: 'c3b4', note: '...Qc1+，白王被迫靠近 b 兵路线。' },
      { move: 'c1b2', reply: 'b4c5', note: '...Qb2+ 继续将军。' },
      { move: 'b2c3', reply: 'c5b5', note: '...Qc3+，白王向 b5。' },
      { move: 'c3b2', reply: 'b5a6', note: '...Qb2+ 后白王到 a6。' },
      { move: 'b2a3', reply: 'a6b7', note: '...Qa3+，白王到 b7。' },
      { move: 'h7g7', reply: 'd7d4', note: '黑王到 g7，白方尝试 Qd4+。' },
      { move: 'f7f6', reply: 'd4d7', note: '...f6 挡住并攻击白方弱兵链，白后回 d7+。' },
      { move: 'g7h6', reply: 'd7d8', note: '黑王到 h6，白后 d8+ 争取重复。' },
      { move: 'h6g7', reply: 'b7b8', note: '黑王回 g7；白王走到 b8?，让开 b7 升变路线。' },
      { move: 'a3e3', reply: 'b6b7', note: '...Qxe3! 吃掉弱兵，白方 b7 继续冲。' },
      { move: 'h4h3', reply: 'd8d7', note: '...h3! 黑方自己的通路兵也只差两步，白后 d7+。' },
      { move: 'g7h6', reply: 'b8c8', note: '黑王到 h6，白王 c8? 迷失方向。' },
      { move: 'h3h2', reply: 'b7b8q', note: '...h2，白方先升后。' },
      { move: 'h2h1q', reply: 'c8d8', note: '...h1=Q，黑方也升后，白王到 d8。' },
      { move: 'h1e4', reply: 'f4f5', note: '新后从 h1 到 e4，白方 f5 试图反击。' },
      { move: 'e4f5', reply: 'b8h2', note: '...Qxf5 拿掉 f 兵，白后从 b8 到 h2+。' },
      { move: 'f5h5', reply: 'h2c7', note: '...Qh5 挡住并保持反击，白后到 c7。' },
      { move: 'h5e5', reply: 'c7b7', note: '...Qhe5 协调两后，白后到 b7。' },
      { move: 'e5e4', reply: 'b7c7', note: '...Q5e4 继续围攻白王，白后到 c7。' },
      { move: 'e4a8', reply: 'd7c8', note: '...Qa8+，白王被迫到 c8。' },
      { move: 'a8d5', reply: 'c7d7', note: '...Qd5+，白后到 d7。' },
      { move: 'd5g8', reply: 'd8c7', note: '...Qg8+ 继续逼王。' },
      { move: 'e3c5', note: '...Qc5+ 后白方无法避免大规模换后，黑方胜。' }
    ]
  },
  {
    id: 'mce-naroditsky-bok-three-stage-conversion',
    category: 'queen-endgames',
    title: '三阶段转换优势',
    level: '后残局',
    goal: '白先，用耐心计划把静态优势转成攻王胜势',
    fen: '1k6/1pp1q3/5p2/p3p1p1/4P3/1PP3P1/P5KP/3Q4 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 69,
      game: 'Naroditsky-Bok, World Youth Championship Vung Tau 2008',
      pdfPage: 153,
      bookPage: 150,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 69 图面还原 FEN；从 1.Qf3?! 到 29.Qd5# 的定位、执行和技术收束合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局转换优势要分阶段：先限制对手反击，再执行王路计划，最后技术性收束；跳过任何阶段都会给对手长将或反击。',
      method: 'Qf3?! 允许 ...Qa3!，但白方保持冷静用 Qe2 和 c4! 把黑后困在白阵。之后 Kh3-g4-f5-g6 走入黑方阵地，黑后虽深入却赶不到白王。技术阶段白方不急于升变，先 a4、Qg6、g4-g8Q，最后用 Qc6+! 弃后引王到 c6，Qd5# 收束。',
      mistake: '原本更稳的是 1.a4!；实战 1.Qf3?! 忽略了 ...Qa3! 的动态资源。黑方真正的防守机会是 2...g4! 或 3...Kc8，实战 ...Qc1?、...b6? 让白王转移成功。'
    },
    hints: ['1.Qf3?! 之后先保持冷静，不要执着吃 f6。', 'c4! 的作用是打开 h3-g4-f5 王路。', '最后的技术亮点是 Qc6+! 弃后，迫使 ...Kxc6 后 Qd5#。'],
    steps: [
      { move: 'd1f3', reply: 'e7a3', note: 'Qf3?! 瞄准 f6，但 ...Qa3! 暴露了动态问题。' },
      { move: 'f3e2', reply: 'a3c1', note: 'Qe2 是相对最佳；...Qc1? 看似活跃，实际挡不住白方计划。' },
      { move: 'c3c4', reply: 'b7b6', note: 'c4! 打开 h3-g4-f5 的王路，...b6? 来不及防守。' },
      { move: 'g2h3', reply: 'b8c8', note: 'Kh3 开始执行王路计划，黑王到 c8。' },
      { move: 'h3g4', reply: 'c8d7', note: 'Kg4，黑王赶往 e7 防 f6。' },
      { move: 'g4f5', reply: 'd7e7', note: 'Kf5，白王继续深入。' },
      { move: 'f5g6', reply: 'c1h1', note: 'Kg6 到达目标区；黑后需要太多步才能赶到。' },
      { move: 'g6g7', reply: 'g5g4', note: 'Kg7 威胁多重入侵，黑方 ...g4 试图制造反击。' },
      { move: 'e2g4', reply: 'h1h2', note: 'Qxg4 消除反击兵，黑后吃 h2。' },
      { move: 'a2a4', reply: 'h2f2', note: 'a4 是技术性改进，不急于收束。' },
      { move: 'g4g6', reply: 'e7d7', note: 'Qg6 维持压制，黑王到 d7。' },
      { move: 'g3g4', reply: 'f2g3', note: 'g4 继续推进王翼，黑后到 g3。' },
      { move: 'g6f5', reply: 'd7c6', note: 'Qf5+，黑王到 c6。' },
      { move: 'g7f6', reply: 'g3b3', note: 'Kxf6 吃掉关键弱兵，黑后吃 b3。' },
      { move: 'g4g5', reply: 'c6b7', note: 'g5 继续创造通路兵，黑王回 b7。' },
      { move: 'g5g6', reply: 'b3c4', note: 'g6，黑后从 c4 反击。' },
      { move: 'f5e6', reply: 'c4a2', note: 'Qe6 控制升变路线，黑后吃 a2。' },
      { move: 'g6g7', reply: 'a2f2', note: 'g7，黑后回 f2+。' },
      { move: 'f6e7', reply: 'f2h4', note: 'Ke7，白王继续支援升变；黑后 h4+。' },
      { move: 'e7f8', reply: 'h4f4', note: 'Kf8，黑后 f4+。' },
      { move: 'e6f5', reply: 'f4h6', note: 'Qf5 控制关键格，黑后 h6。' },
      { move: 'f8f7', reply: 'h6e3', note: 'Kf7，黑后 e3 继续将军。' },
      { move: 'g7g8q', reply: 'e3b3', note: 'g8=Q，黑后 b3+。' },
      { move: 'f7g7', reply: 'b3g3', note: 'Kg7，黑后 g3+。' },
      { move: 'f5g6', reply: 'g3a3', note: 'Qg6，黑后 a3。' },
      { move: 'g8d5', reply: 'b7a7', note: '新后 Qd5+，黑王到 a7。' },
      { move: 'd5e5', reply: 'a7b7', note: 'Qxe5，黑王回 b7。' },
      { move: 'g6c6', reply: 'b7c6', note: 'Qc6+! 第一次弃后，引黑王到 c6。' },
      { move: 'e5d5', note: 'Qd5#，白方完成技术收束。' }
    ]
  },
  {
    id: 'mce-stefansson-bosnjak-risk-for-winning-chances',
    category: 'queen-endgames',
    title: '安全不等于有赢棋机会',
    level: '后残局',
    goal: '白先，选择有风险但能保留赢机的转换方案',
    fen: '8/5pkp/4q1p1/p1pQ4/P3p3/1P2P2P/5PP1/5K2 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 70,
      game: 'Stefansson-Bosnjak, Bosna Open Sarajevo 2010',
      pdfPage: 156,
      bookPage: 153,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 70 图面还原 FEN；从 1.Qd1! 到 30.Qb7 的冒险保留赢机主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局中，最安全的换后不一定有赢棋机会；如果客观赢法需要承担长将风险，就必须用具体计算判断风险是否可控。',
      method: 'Qd1! 拒绝立即换后，先让后重新参战。Qd5、g4、Kf1-g2-h3 建立安全区，随后 Qd8+、Qxa5、Qd2 防住 ...Qf3+。当黑方被迫 ...Qxg4 后，白方用 Qd6+、Qf6、Qh8+ 转入主动，再推进 a5-a6，最后 Qb7 把黑后困住。',
      mistake: '1.Qxe6 看似安全，但换后兵残局容易和；6.gxf5? 让白王暴露在 g2，黑方 ...h4 与 ...Qd6 能获得足够反击。'
    },
    hints: ['第一步退后到 d1，而不是贪图安全换后。', '王要先走到 g2-h3，避免后续 ...Qf3+ 的长将。', '真正开始推进 a 兵前，要先拿掉 a5 并让后能守住 d2/f3。'],
    steps: [
      { move: 'd5d1', reply: 'e6a6', note: 'Qd1! 保留后残局赢机；...Qa6+ 先给白王压力。' },
      { move: 'f1e1', reply: 'a6b6', note: 'Ke1，黑后到 b6 防守 e4。' },
      { move: 'd1d5', reply: 'f7f5', note: 'Qd5 重新进入战场，黑方 ...f5 加固 e4。' },
      { move: 'g2g4', reply: 'g7f6', note: 'g4 增加压力，黑王到 f6。' },
      { move: 'e1f1', reply: 'h7h5', note: 'Kf1! 改善王位，...h5 是最佳防守。' },
      { move: 'f1g2', reply: 'h5h4', note: 'Kg2! 先把王放到更安全的位置，黑方 ...h4。' },
      { move: 'd5g8', reply: 'f5g4', note: 'Qg8 施压，黑方被迫 fxg4。' },
      { move: 'h3g4', reply: 'b6e6', note: 'hxg4 后 ...Qe6!，黑方准备 ...Qf3+。' },
      { move: 'g8d8', reply: 'f6e5', note: 'Qd8+，黑王到 e5。' },
      { move: 'd8b8', reply: 'e5f6', note: 'Qb8+ 继续逼王，黑王回 f6。' },
      { move: 'g2h3', reply: 'g6g5', note: 'Kh3，黑方 ...g5 试图破坏白王安全。' },
      { move: 'b8d8', reply: 'f6g6', note: 'Qd8+，黑王到 g6。' },
      { move: 'd8a5', reply: 'e6f6', note: 'Qxa5 消除远方弱兵，黑后到 f6。' },
      { move: 'a5d2', reply: 'f6f3', note: 'Qd2! 及时防守，黑后仍给 ...Qf3+。' },
      { move: 'h3h2', reply: 'f3g4', note: 'Kh2 后黑方不能 ...h3，只能 Qxg4。' },
      { move: 'd2d6', reply: 'g6h5', note: 'Qd6+ 夺回主动，黑王到 h5。' },
      { move: 'd6f6', reply: 'g4d7', note: 'Qf6，黑后到 d7 防守。' },
      { move: 'f6h8', reply: 'h5g4', note: 'Qh8+，黑王到 g4。' },
      { move: 'h8e5', reply: 'd7c6', note: 'Qe5，黑后 c6 试图制造反击。' },
      { move: 'a4a5', reply: 'g4h5', note: 'a5 开始推进远方通路兵。' },
      { move: 'e5h8', reply: 'h5g4', note: 'Qh8+ 保持主动。' },
      { move: 'h8e5', reply: 'g4h5', note: 'Qe5，继续限制黑王。' },
      { move: 'e5f5', reply: 'c6c7', note: 'Qf5! 限制黑王，黑后从 c7+ 寻找将军。' },
      { move: 'h2h3', reply: 'c7b7', note: 'Kh3，黑后到 b7。' },
      { move: 'f5g4', reply: 'h5g6', note: 'Qg4+，黑王到 g6。' },
      { move: 'g4e6', reply: 'g6h5', note: 'Qe6+ 继续逼王。' },
      { move: 'a5a6', reply: 'b7a7', note: 'a6，黑后被迫到 a7 防守。' },
      { move: 'e6e8', reply: 'h5h6', note: 'Qe8+，黑王到 h6。' },
      { move: 'e8c6', reply: 'h6h5', note: 'Qc6+，继续支援 a 兵。' },
      { move: 'c6b7', note: 'Qb7 后黑后被困，白方赢。' }
    ]
  },
  {
    id: 'mce-rogovoi-tunik-initiative-into-passer',
    category: 'queen-endgames',
    title: '把主动权变成通路兵',
    level: '后残局',
    goal: '黑先，用主动王和后把攻势转成 b 兵优势',
    fen: '6k1/3p2p1/8/p3P1Q1/Pp6/1P5P/2q5/6K1 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 71,
      game: 'Rogovoi-Tunik, St Petersburg 2000',
      pdfPage: 158,
      bookPage: 155,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 71 图面还原 FEN；从 1...Kf7! 到 20...Ka2 的主动权转化为 b 兵优势主线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '主动权如果不及时转化会消失；后残局里，活跃王和后可以把一串威胁转成真正的通路兵。',
      method: '...Kf7! 用王参与进攻，拒绝让白方轻松 Qd8+ 长将。随后 ...Qf5、...Qxh3、...Kd5 和 ...Qxb3 把主动权转成 b 兵通路兵。...Qd5! 占据支配格，...Qe4! 不理会白 a 兵，继续推进 b 兵并用将军护送到 b2。',
      mistake: '被动 ...Qc7 会让白方 Qd8+ 和 Qxa5 消除黑方优势；抢吃 b3 也要先确保白后没有立即长将资源。'
    },
    hints: ['第一步用王前进到 f7，阻止白方轻松长将。', '黑后的目标不是只吃兵，而是制造 b 兵通路兵。', '关键支配格是 d5，之后 ...Qe4! 继续护送 b 兵。'],
    steps: [
      { move: 'g8f7', reply: 'g5f4', note: '...Kf7! 用王加入进攻，白后 Qf4+。' },
      { move: 'f7e6', reply: 'f4g4', note: '黑王继续前进到 e6，白后 Qg4+。' },
      { move: 'c2f5', reply: 'g4g7', note: '...Qf5 是唯一继续方式，白后吃 g7。' },
      { move: 'f5h3', reply: 'g7f6', note: '...Qxh3 抢下王翼兵，白后 Qf6+。' },
      { move: 'e6d5', reply: 'f6b6', note: '...Kd5 烧桥前进，白后 Qb6。' },
      { move: 'h3b3', reply: 'b6a5', note: '...Qxb3 把主动权转成 b 兵，白后 Qxa5+。' },
      { move: 'd5e4', reply: 'a5a8', note: '...Ke4，白后 Qa8+。' },
      { move: 'b3d5', reply: 'a8a6', note: '...Qd5! 支配中心并支援 b 兵，白后 Qa6。' },
      { move: 'b4b3', reply: 'a6e2', note: '...b3，白后 Qe2+。' },
      { move: 'e4d4', reply: 'a4a5', note: '...Kd4，白方也推 a 兵。' },
      { move: 'd5e4', reply: 'e2b5', note: '...Qe4! 不理会 a 兵，继续保持主动。' },
      { move: 'e4b1', reply: 'g1g2', note: '...Qb1+，白王到 g2。' },
      { move: 'b1c2', reply: 'g2g1', note: '...Qc2+，白王回 g1。' },
      { move: 'b3b2', reply: 'b5d7', note: '...b2，白后 Qxd7+ 已经太慢。' },
      { move: 'd4c3', reply: 'd7c6', note: '...Kc3，黑王护送通路兵。' },
      { move: 'c3b3', reply: 'c6d5', note: '...Kb3，白后继续将军。' },
      { move: 'b3a3', reply: 'd5d6', note: '...Ka3，黑王继续躲将。' },
      { move: 'a3b3', reply: 'd6d5', note: '...Kb3 后白后 Qd5+。' },
      { move: 'c2c4', reply: 'd5f3', note: '...Qc4，挡住将军并继续护 b 兵。' },
      { move: 'b3a2', note: '...Ka2，黑方通路兵即将决定胜负。' }
    ]
  },
  {
    id: 'mce-adorjan-orso-knockout-missed',
    category: 'queen-endgames',
    title: '优势快消失前找击倒手',
    level: '后残局',
    goal: '白先，沿实战线理解如何保持主动以及错过击倒手的代价',
    fen: '3k4/pp3pp1/q3p2p/2p1P2P/4Q3/P5P1/1PP2P2/2K5 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 72,
      game: 'Adorjan-Orso, Hungarian Championship Budapest 1977',
      pdfPage: 160,
      bookPage: 157,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 72 图面还原 FEN；从 1.c4! 到 28...Kc8 的实战主动权流失线合并为一道题，15.e6! 击倒资源写入教学提示并用程序校验主线。'
    }),
    teaching: {
      principle: '当主动权已经把对手逼到崩溃边缘时，要寻找击倒手；如果只重复将军或选择自然手，主动权会被防守方重新组织成和棋。',
      method: 'c4! 先限制黑后，f4、Qe3、Qd3 逐步控制 h7。黑方 ...Qh1! 是唯一防守，白方 Qh7、Qxg7、Qf8+ 和 g4! 保持主动。10...h5? 后 11.f5!、13.b4! 逼黑方严重让步，但实战 15.Qd6+? 让黑王逃到 b7，之后只能长将和棋。',
      mistake: '关键击倒手是 15.e6!，不是自然的 15.Qd6+?。另外 5...b6 是黑方实战资源，录入时不能误成 ...a6；同一例题的分析分支都保留在教学里，不另拆题。'
    },
    hints: ['先用 c4! 阻止黑后轻松活动。', '白后的目标基地是 h7，之后用 g4! 防止黑方堡垒。', '15 手附近要找击倒手；实战 Qd6+? 放走了黑王，正确方向是 e6!。'],
    steps: [
      { move: 'c2c4', reply: 'a6a5', note: 'c4! 先限制黑后，...Qa5! 是正确防守。' },
      { move: 'f2f4', reply: 'd8c8', note: 'f4 改善兵形，黑王到 c8。' },
      { move: 'e4e3', reply: 'a5c7', note: 'Qe3，黑后退到 c7。' },
      { move: 'c1b1', reply: 'c7c6', note: 'Kb1，黑后 c6。' },
      { move: 'b1a2', reply: 'b7b6', note: 'Ka2，...b6 是实战防守资源。' },
      { move: 'e3d3', reply: 'c6h1', note: 'Qd3 中央化并盯 h7，...Qh1! 是唯一防守。' },
      { move: 'd3h7', reply: 'h1h5', note: 'Qh7 侵入，黑后吃 h5。' },
      { move: 'h7g7', reply: 'h5g6', note: 'Qxg7，黑后到 g6 防守。' },
      { move: 'g7f8', reply: 'c8b7', note: 'Qf8+，黑王到 b7。' },
      { move: 'g3g4', reply: 'h6h5', note: 'g4! 保持主动，实战 ...h5? 给白方机会。' },
      { move: 'f4f5', reply: 'e6f5', note: 'f5! 阻止黑王回 8 横线，黑方 exf5。' },
      { move: 'f8e7', reply: 'b7a6', note: 'Qe7+，黑王到 a6。' },
      { move: 'b2b4', reply: 'c5b4', note: 'b4! 强行打开王侧，黑方 cxb4。' },
      { move: 'a3b4', reply: 'b6b5', note: 'axb4，黑方 ...b5 防住直接杀法但留下严重弱点。' },
      { move: 'e7d6', reply: 'a6b7', note: 'Qd6+? 是实战失误；黑王到 b7 后白方优势消失。' },
      { move: 'd6d7', reply: 'b7b8', note: 'Qd7+，黑王到 b8。' },
      { move: 'd7b5', reply: 'b8c8', note: 'Qxb5+，黑王到 c8。' },
      { move: 'b5e8', reply: 'c8c7', note: 'Qe8+，黑王到 c7。' },
      { move: 'e8e7', reply: 'c7c8', note: 'Qe7+，黑王回 c8。' },
      { move: 'e7e8', reply: 'c8c7', note: 'Qe8+，白方只能继续将军。' },
      { move: 'g4g5', reply: 'f5f4', note: 'g5 试图制造新资源，黑方 ...f4。' },
      { move: 'e8e7', reply: 'c7c8', note: 'Qe7+，黑王回 c8。' },
      { move: 'e7c5', reply: 'c8b7', note: 'Qc5+，黑王到 b7。' },
      { move: 'c5d5', reply: 'b7b8', note: 'Qd5+，黑王到 b8。' },
      { move: 'a2a3', reply: 'g6g5', note: 'Ka3，黑方终于 Qxg5。' },
      { move: 'd5d6', reply: 'b8c8', note: 'Qd6+ 后黑王到 c8，实战和棋。' }
    ]
  },
  {
    id: 'mce-naroditsky-rudyak-never-resign-defense',
    category: 'queen-endgames',
    title: '再差也要让对手证明',
    level: '后残局防守',
    goal: '白先，四兵落后时坚持制造长将机会',
    fen: '3Q4/ppp2ppk/7p/8/6P1/4P3/6K1/2q5 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 73,
      game: 'Naroditsky-Rudyak, San Francisco 2006',
      pdfPage: 163,
      bookPage: 160,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 73 图面还原 FEN；从 1.Qd3+ 到 33.Qe5+ 的顽强防守救和线合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后残局即使客观很差，也常有长将、陷阱和时间压力资源；防守方的任务是不断让对手证明赢法。',
      method: 'Qd3+、Qb3 和王的来回先制造检查节奏。黑方换成王翼三连通路兵后，白方用 Qf2! 诱导贪心，16.Qxg3+! 消掉关键 g 兵。随后不断保持后活跃，围绕 Qc3+、Qd3+、Qg3+ 和 Qf5+/Qe5+ 让黑王无法逃开长将。',
      mistake: '黑方 15...g3?? 给了白方 Qxg3+! 的救命机会；实际很多简单赢法如 ...h5 或 ...Qe1+ 接 ...g3+ 都能强制换后。'
    },
    hints: ['第一目标是保持后活跃，不要急着认输。', 'Qf2! 是实战陷阱，诱导黑方贪心推进。', '黑方 ...g3?? 后必须立刻 Qxg3+!，消掉最危险通路兵。'],
    steps: [
      { move: 'd8d3', reply: 'g7g6', note: 'Qd3+ 先制造将军，黑方 ...g6。' },
      { move: 'd3b3', reply: 'c1d2', note: 'Qb3，黑后到 d2+。' },
      { move: 'g2h1', reply: 'd2e1', note: 'Kh1，黑后 e1+。' },
      { move: 'h1g2', reply: 'e1d2', note: 'Kg2，黑后回 d2+。' },
      { move: 'g2f1', reply: 'h7g7', note: 'Kf1，黑王到 g7，准备转换通路兵。' },
      { move: 'b3b7', reply: 'd2e3', note: 'Qxb7，黑后吃 e3。' },
      { move: 'b7c7', reply: 'e3f3', note: 'Qxc7，黑后 f3+。' },
      { move: 'f1g1', reply: 'f3g4', note: 'Kg1，黑后 Qxg4+。' },
      { move: 'g1h1', reply: 'g4d4', note: 'Kh1，黑后到 d4。' },
      { move: 'c7c2', reply: 'a7a5', note: 'Qc2，黑方开始推进 a 兵。' },
      { move: 'c2f2', reply: 'd4e4', note: 'Qf2! 诱导黑方继续贪攻，...Qe4+。' },
      { move: 'h1g1', reply: 'e4e5', note: 'Kg1，黑后 e5。' },
      { move: 'f2a2', reply: 'g6g5', note: 'Qa2，黑方推进 g 兵。' },
      { move: 'g1h1', reply: 'g5g4', note: 'Kh1，...g4。' },
      { move: 'a2g2', reply: 'g4g3', note: 'Qg2，...g3?? 走进陷阱。' },
      { move: 'g2g3', reply: 'e5g5', note: 'Qxg3+! 消掉关键通路兵，黑后到 g5。' },
      { move: 'g3c3', reply: 'g7g6', note: 'Qc3+，黑王到 g6。' },
      { move: 'c3d3', reply: 'g5f5', note: 'Qd3+，黑后 f5。' },
      { move: 'd3g3', reply: 'g6h7', note: 'Qg3+，黑王到 h7。' },
      { move: 'g3f2', reply: 'f5h5', note: 'Qf2，黑后 h5+。' },
      { move: 'h1g1', reply: 'h5g6', note: 'Kg1，黑后 g6+。' },
      { move: 'g1h1', reply: 'a5a4', note: 'Kh1，黑方推进 a 兵。' },
      { move: 'f2a2', reply: 'g6e4', note: 'Qa2，黑后 e4+。' },
      { move: 'h1g1', reply: 'e4e3', note: 'Kg1，黑后 e3+。' },
      { move: 'g1h1', reply: 'e3b3', note: 'Kh1，黑后 b3。' },
      { move: 'a2f2', reply: 'b3b1', note: 'Qf2，黑后 b1+。' },
      { move: 'h1h2', reply: 'b1g6', note: 'Kh2，黑后 g6。' },
      { move: 'f2a2', reply: 'g6h5', note: 'Qa2，黑后 h5+。' },
      { move: 'h2g1', reply: 'h5d1', note: 'Kg1，黑后 d1+。' },
      { move: 'g1h2', reply: 'd1b3', note: 'Kh2，黑后 b3。' },
      { move: 'a2f2', reply: 'a4a3', note: 'Qf2，黑方 a3。' },
      { move: 'f2f5', reply: 'h7g7', note: 'Qf5+，黑王到 g7。' },
      { move: 'f5e5', note: 'Qe5+，长将成立，实战和棋。' }
    ]
  },
  {
    id: 'mce-topalov-anand-tenacious-defense',
    category: 'queen-endgames',
    title: '漫长防守中的精确资源',
    level: '后残局防守',
    goal: '黑先，用 b 兵牵制和长将资源守住劣势',
    fen: '6k1/8/5q1P/8/4Q1P1/6K1/1p3P2/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 74,
      game: 'Topalov-Anand, Candidates Tournament San Luis 2005',
      pdfPage: 164,
      bookPage: 161,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 74 图面还原 FEN；从 1...Qb6! 到合法长将收束 ...Qe1+ 合并为一道题。书末段 33.Kg5 与黑后 d5 控制矛盾，训练线采用同一防守机制的合法长将收束并用程序校验。'
    }),
    teaching: {
      principle: '顶级后残局防守往往靠一个小通路兵维持牵制，再用持续长将逼对手证明赢法；即使中途出错，也要继续寻找下一层资源。',
      method: '...Qb6! 先把白后牵制住，保护 b2 兵。白方 g5、h 兵和后多次制造杀王威胁，黑方用 ...Qg6、...Kf7、...Kf8 精确躲避。中盘 ...Qxg5+ 进入长将阶段，随后围绕 ...Qg3+、...Qe1+、...Qf1+、...Qb1、...Qd1+ 构建无法摆脱的将军网。',
      mistake: '防守方多次有更精确资源，如 ...Kf8、...Qd6+ 和 ...Qg6+；但核心是不要因为错过一次最佳防守就崩溃，继续寻找长将资源。'
    },
    hints: ['第一步 ...Qb6!，不要贪吃 h6。', 'b2 兵的牵制让白后不能自由攻王。', '进入长将阶段后，目标是不断让白王无法躲到安全区。'],
    steps: [
      { move: 'f6b6', reply: 'e4c4', note: '...Qb6! 先迫使白后被动，白方 Qc4+。' },
      { move: 'g8h7', reply: 'g4g5', note: '黑王到 h7，白方 g5! 设下 b1=Q 后的杀王陷阱。' },
      { move: 'b6g6', reply: 'c4c7', note: '...Qg6，白后 Qc7+。' },
      { move: 'h7g8', reply: 'c7b8', note: '黑王回 g8，白后 Qb8+。' },
      { move: 'g8f7', reply: 'b8b7', note: '...Kf7 精确防守，白后 Qb7+。' },
      { move: 'f7f8', reply: 'b7b8', note: '黑王到 f8，白后继续 Qb8+。' },
      { move: 'f8f7', reply: 'b8b3', note: '黑王回 f7，白后 Qb3+。' },
      { move: 'f7f8', reply: 'b3f3', note: '黑王到 f8，白后 Qf3+。' },
      { move: 'f8e7', reply: 'f3e3', note: '黑王到 e7，白后 Qe3+。' },
      { move: 'e7d7', reply: 'e3d4', note: '黑王到 d7，白后 Qd4+。' },
      { move: 'd7e6', reply: 'd4b2', note: '黑王到 e6，白方 Qxb2?! 给黑方喘息。' },
      { move: 'g6g5', reply: 'g3f3', note: '...Qxg5+ 进入长将阶段，白王到 f3。' },
      { move: 'g5h5', reply: 'f3e4', note: '...Qh5+，白王到 e4。' },
      { move: 'h5f5', reply: 'e4e3', note: '...Qf5+? 给白方机会，白王到 e3。' },
      { move: 'f5g5', reply: 'f2f4', note: '...Qg5+，白方 f4! 争取主动。' },
      { move: 'g5g3', reply: 'e3e4', note: '...Qg3+，白王到 e4。' },
      { move: 'g3e1', reply: 'e4f3', note: '...Qe1+，白王到 f3。' },
      { move: 'e1f1', reply: 'f3g3', note: '...Qf1+，白王到 g3。' },
      { move: 'f1g1', reply: 'b2g2', note: '...Qg1+，白后 Qg2 挡住。' },
      { move: 'g1b1', reply: 'g2c6', note: '...Qb1，白后 Qc6+ 继续考验黑王。' },
      { move: 'e6f7', reply: 'c6d7', note: '黑王到 f7，白后 Qd7+。' },
      { move: 'f7f6', reply: 'd7g7', note: '黑王到 f6，白后 Qg7+。' },
      { move: 'f6e6', reply: 'g7e5', note: '黑王到 e6，白后 Qe5+。' },
      { move: 'e6f7', reply: 'e5h5', note: '黑王到 f7，白后 Qh5+。' },
      { move: 'f7f6', reply: 'h5g5', note: '黑王到 f6，白后 Qg5+。' },
      { move: 'f6f7', reply: 'g5h5', note: '黑王到 f7，白后 Qh5+。' },
      { move: 'f7f6', reply: 'h5h4', note: '黑王到 f6，白后 Qh4+。' },
      { move: 'f6f7', reply: 'h6h7', note: '黑王到 f7，白方 h7? 错过最佳。' },
      { move: 'b1e1', reply: 'g3g4', note: '...Qe1+，白王到 g4。' },
      { move: 'e1d1', reply: 'g4g5', note: '...Qd1+，白王到 g5。' },
      { move: 'd1d8', reply: 'g5h5', note: '...Qd8+，白王到 h5。' },
      { move: 'd8d5', reply: 'h5g4', note: '...Qd5+ 后采用合法长将收束，白王到 g4。' },
      { move: 'd5d1', reply: 'g4g3', note: '...Qd1+，白王到 g3。' },
      { move: 'd1e1', note: '...Qe1+ 继续长将，黑方守和。' }
    ]
  },
  {
    id: 'mce-elbilia-skripchenko-active-passive-defense',
    category: 'queen-endgames',
    title: '被迫换后前的最后资源',
    level: '后残局防守',
    goal: '白先，用 Qf2! 避免换后并坚持到长将',
    fen: '8/p5k1/7p/5p2/5P1Q/7K/4q3/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 75,
      game: 'Elbilia-Skripchenko, Czerniak Memorial Tel Aviv 1998',
      pdfPage: 167,
      bookPage: 164,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 75 图面还原 FEN；从 1.Qf2! 到 25.Qe6+ 的防守诱导与长将救和合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '被逼换后时，防守方要先寻找能保留后的资源；只要后还在，弱王也可能靠长将获救。',
      method: 'Qf2! 让黑方无法强制换后。随后白后在 a1/a2/e2/b5/c5/c7 一路保持活跃，黑方虽然推进 a 兵并逼王，但 14...Qe4? 给了白方 Qxa5 的机会。之后白后持续从 d8、d7、e8、e7、e1、e2、e6 反复将军，黑王无法逃脱。',
      mistake: '黑方最佳是更冷静的 ...Qd3+ 和 ...Kg8!!，实战 ...Qe4? 被白方吃掉 a5 后失去赢法。'
    },
    hints: ['第一步是 Qf2!，保留后，不让黑方换后。', '防守方要持续保持后活跃，不怕长时间被追。', '黑方 ...Qe4? 后要立刻 Qxa5，进入长将结构。'],
    steps: [
      { move: 'h4f2', reply: 'e2h5', note: 'Qf2! 避免换后，...Qh5+ 继续追王。' },
      { move: 'h3g3', reply: 'h5g6', note: 'Kg3，黑后 g6+。' },
      { move: 'g3h2', reply: 'g6b6', note: 'Kh2，黑后 b6。' },
      { move: 'f2d2', reply: 'g7g6', note: 'Qd2，黑王到 g6。' },
      { move: 'd2a2', reply: 'g6f6', note: 'Qa2，黑王到 f6。' },
      { move: 'a2a1', reply: 'f6f7', note: 'Qa1+，黑王到 f7。' },
      { move: 'a1a2', reply: 'f7e7', note: 'Qa2+，黑王到 e7。' },
      { move: 'a2e2', reply: 'b6e6', note: 'Qe2+，黑后 e6 挡住。' },
      { move: 'e2b5', reply: 'a7a6', note: 'Qb5，黑方 a6。' },
      { move: 'b5c5', reply: 'e7e8', note: 'Qc5+，黑王到 e8。' },
      { move: 'c5c7', reply: 'e8f8', note: 'Qc7，黑王到 f8。' },
      { move: 'h2h1', reply: 'e6d5', note: 'Kh1，黑后 Qd5+。' },
      { move: 'h1h2', reply: 'a6a5', note: 'Kh2，黑方 a5。' },
      { move: 'h2g3', reply: 'd5e4', note: 'Kg3，...Qe4? 是关键失误。' },
      { move: 'c7a5', reply: 'e4e3', note: 'Qxa5 后黑方不再能逃长将，...Qe3+。' },
      { move: 'g3g2', reply: 'e3f4', note: 'Kg2，黑后吃 f4。' },
      { move: 'a5d8', reply: 'f8f7', note: 'Qd8+，黑王到 f7。' },
      { move: 'd8d7', reply: 'f7g6', note: 'Qd7+，黑王到 g6。' },
      { move: 'd7e8', reply: 'g6g5', note: 'Qe8+，黑王到 g5。' },
      { move: 'e8e7', reply: 'g5h5', note: 'Qe7+，黑王到 h5。' },
      { move: 'e7e8', reply: 'h5h4', note: 'Qe8+，黑王到 h4。' },
      { move: 'e8e1', reply: 'h4g4', note: 'Qe1+，黑王到 g4。' },
      { move: 'e1e2', reply: 'g4g5', note: 'Qe2+，黑王到 g5。' },
      { move: 'e2e7', reply: 'g5g6', note: 'Qe7+，黑王到 g6。' },
      { move: 'e7e6', note: 'Qe6+，黑王无法逃脱长将，和棋。' }
    ]
  },
  {
    id: 'mce-matulovic-savon-cold-blooded-defense',
    category: 'queen-endgames',
    title: '被动防守也要冷静算清',
    level: '后残局防守',
    goal: '白先，用 g3 和 Qf1 找到长将防守结构',
    fen: '6k1/5p2/p5pp/1p1q4/3p4/1P1Q3P/PP3PP1/5K2 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 76,
      game: 'Matulovic-Savon, Skopje/Ohrid 1968',
      pdfPage: 168,
      bookPage: 165,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 76 图面还原 FEN；从 1.g3! 到 12.Qe8+ 的被动防守和长将资源合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '被动防守不等于乱动；如果对手还没有明确突破，就先补王路和弱格，等对手推进后寻找长将资源。',
      method: 'g3! 允许看似可怕的 ...Qh1+，但白王能到 e2。h4! 进一步改善兵形，避免 ...Qg2。关键 Qf1!! 很难下，却让 ...g5 可以被 Qe1 应对。黑方 ...f4 后，白方冷静 gxf4、Kd3、Qg2，把弱王转化成长将机会。',
      mistake: '5.f3? 或过早主动化会让黑后长期占据 e4；正确防守是承认被动并保留后在 d3/f1 的防守功能。'
    },
    hints: ['第一步 g3! 是为了让王能到 e2，而不是追求主动。', 'h4! 先消除 ...Qg2 的想法。', '最难的一步是 Qf1!!，它让黑方看似强攻反而暴露长将资源。'],
    steps: [
      { move: 'g2g3', reply: 'g8g7', note: 'g3! 虽然允许将军想法，但为白王转移做准备。' },
      { move: 'f1e2', reply: 'f7f5', note: 'Ke2，黑方 ...f5 准备 ...Qe4。' },
      { move: 'h3h4', reply: 'd5e4', note: 'h4! 改善兵形，黑后 Qe4+。' },
      { move: 'e2d2', reply: 'g7f6', note: 'Kd2，黑王到 f6。' },
      { move: 'd3f1', reply: 'f5f4', note: 'Qf1!! 冷静防守，黑方 ...f4 继续压迫。' },
      { move: 'g3f4', reply: 'e4f4', note: 'gxf4! 用王弱点反过来制造长将，黑后 Qxf4+。' },
      { move: 'd2d3', reply: 'f4h4', note: 'Kd3，黑后吃 h4。' },
      { move: 'f1g2', reply: 'h6h5', note: 'Qg2，白方终于建立长将框架。' },
      { move: 'g2c6', reply: 'f6g5', note: 'Qc6+，黑王到 g5。' },
      { move: 'c6c5', reply: 'g5f6', note: 'Qc5+，黑王到 f6。' },
      { move: 'c5f8', reply: 'f6e5', note: 'Qf8+，黑王到 e5。' },
      { move: 'f8e8', note: 'Qe8+，长将成立，和棋。' }
    ]
  },
  {
    id: 'mce-naumann-glienke-active-piece-defense',
    category: 'queen-endgames',
    title: '保持后马活跃救和',
    level: '后轻子残局防守',
    goal: '黑先，在后象对后马的危局中转入可守后残局',
    fen: '4k3/4q2p/2pB2p1/p1n5/Pp2PQ2/1P5P/1P4PK/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 77,
      game: 'Naumann-Glienke, German Championship Heringsdorf 2000',
      pdfPage: 169,
      bookPage: 166,
      chapter: 'Chapter 4: Queen Endgames',
      note: '例 77 图面还原 FEN；从 1...Nd3! 到 18...Qe4+ 的后象对后马守和转化合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后加轻子残局防守时，最重要的是保持子力活跃；急着吃兵或被动换子可能让裸王立即被攻击。',
      method: '...Nd3! 是唯一能维持活跃的资源。随后 ...Qxe4、...Qd5 保持后马联动，迫使白方换入后残局。换后进入纯后残局后，黑王必须亲自靠近 a 兵，...Kd7、...c5! 让白 b 兵动不了，并用 ...Qf4+、...Qe4+ 持续将军守和。',
      mistake: '被动 ...Ne6 或 ...Qxe4? 都会让白方通过 Qf8+、Bxc5 等手段快速赢棋；...Nxb2 也不是首选，除非具体算清没有战术。'
    },
    hints: ['第一步是 ...Nd3!，先救马并保持活跃。', '不要急着 ...Nxb2；后马要保持联动。', '纯后残局里，黑王要参与阻挡 a 兵，不能只靠后。'],
    steps: [
      { move: 'c5d3', reply: 'f4g3', note: '...Nd3! 保持马活跃，白后 Qg3。' },
      { move: 'e7e4', reply: 'd6c7', note: '...Qxe4，白象到 c7。' },
      { move: 'e4d5', reply: 'c7a5', note: '...Qd5 保持后马联动，白象吃 a5。' },
      { move: 'd5a5', reply: 'g3d3', note: '...Qxa5，白后吃 d3，转入纯后残局。' },
      { move: 'a5e5', reply: 'd3g3', note: '...Qe5+，白后 Qg3。' },
      { move: 'e5b2', reply: 'a4a5', note: '...Qxb2，白方推进 a 兵。' },
      { move: 'e8d7', reply: 'g3b8', note: '...Kd7，黑王亲自靠近通路兵。' },
      { move: 'b2a1', reply: 'b8b7', note: '...Qa1，白后 Qb7+。' },
      { move: 'd7d8', reply: 'b7b4', note: '黑王到 d8，白后 Qxb4。' },
      { move: 'a1e5', reply: 'h2g1', note: '...Qe5+，白王到 g1。' },
      { move: 'c6c5', reply: 'b4b6', note: '...c5! 关键，白 b 兵无法动，白后 Qb6+。' },
      { move: 'd8c8', reply: 'b6c6', note: '黑王到 c8，白后 Qc6+。' },
      { move: 'c8b8', reply: 'c6b5', note: '黑王到 b8，白后 Qb5+。' },
      { move: 'b8a7', reply: 'g1f2', note: '黑王到 a7，白王到 f2。' },
      { move: 'e5f4', reply: 'f2e2', note: '...Qf4+，白王到 e2。' },
      { move: 'f4e4', reply: 'e2d1', note: '...Qe4+，白王到 d1。' },
      { move: 'e4d4', reply: 'd1e2', note: '...Qd4+，白王回 e2。' },
      { move: 'd4e4', note: '...Qe4+ 重复，黑方守和。' }
    ]
  },
  {
    id: 'mce-smejkal-karpov-opposite-colored-bishop-attack',
    category: 'queen-minor-endgames',
    title: '异色象后残局先抢王',
    level: '后象对后象',
    goal: '黑先，用 ...Bc5! 抢先牵制白王并转入赢法',
    fen: '5q1k/3pb1pp/2p5/P3p3/2Q1P3/2P3P1/4B1KP/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 78,
      game: 'Smejkal-Karpov, Leningrad Interzonal 1973',
      pdfPage: 172,
      bookPage: 169,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 78 图面还原 FEN；2.Bg4 与 18.Kg4 等易 OCR 误读处按图页校正。从 1...Bc5! 到 43...Bc5 的后象攻王与通路兵限制合并为一道题并用程序校验。'
    }),
    teaching: {
      principle: '后加异色象残局里，通路兵很危险，但后象配合攻王更快；谁能先把对方王拖进将军网，谁就能限制对手的全部计划。',
      method: '...Bc5! 争取 ...Qf2+ 的先手，迫使白方先处理王的安全。随后 ...Qb2、...Qxc3! 坚持保留后，...Qh6+ 和 ...Qxh2+ 先赢王翼兵，再用 ...Bd4! 集中象的控制。进入后段后，黑后围绕 f2、f6、e7、c7、c5、a3 活动，配合 g、h 兵推进，同时让白方 a 兵始终不能真正成为威胁。',
      mistake: '白方没有及时转入攻王或阻止黑方兵推进，尤其 10.Qf1?、15.Bd5? 和 18.Kg4? 让黑方连续抢先。后轻子残局不能只看通路兵，必须先判断两边王的安全速度。'
    },
    hints: ['第一步是 ...Bc5!，目标是立刻把后放到 f2 将军。', '8...Qxc3! 不换后，继续利用白王弱点。', '赢下 h2 后，...Bd4! 集中象和后的控制，再推进 g、h 兵。'],
    steps: [
      { move: 'e7c5', reply: 'e2g4', note: '...Bc5! 抢先，白方 Bg4 试图保持活跃。' },
      { move: 'f8f2', reply: 'g2h3', note: '...Qf2+，白王被迫到 h3。' },
      { move: 'd7d6', reply: 'g4d7', note: '...d6 稳住中心，白象到 d7 施压。' },
      { move: 'g7g6', reply: 'd7c6', note: '...g6 让黑王有路，白象吃 c6。' },
      { move: 'h8g7', reply: 'c6b5', note: '黑王到 g7，白象退到 b5。' },
      { move: 'f2b2', reply: 'a5a6', note: '...Qb2 盯住后翼，白方推进 a 兵。' },
      { move: 'c5g1', reply: 'c4e2', note: '...Bg1 迫使白后防守，白后 e2。' },
      { move: 'b2c3', reply: 'b5c4', note: '...Qxc3! 保留后，白象到 c4。' },
      { move: 'c3c1', reply: 'e2f1', note: '...Qc1，白后 Qf1? 进入被动。' },
      { move: 'c1h6', reply: 'h3g2', note: '...Qh6+，白王回 g2。' },
      { move: 'h6h2', reply: 'g2f3', note: '...Qxh2+ 赢下 h 兵，白王到 f3。' },
      { move: 'h2h5', reply: 'f3g2', note: '...Qh5+，继续把白王留在危险区。' },
      { move: 'h5h2', reply: 'g2f3', note: '...Qh2+ 重复将军，白王回 f3。' },
      { move: 'g1d4', reply: 'c4d5', note: '...Bd4! 象集中到强格，白象 Bd5?。' },
      { move: 'd4c5', reply: 'd5c6', note: '...Bc5，白象到 c6。' },
      { move: 'c5d4', reply: 'c6b7', note: '...Bd4，白象 Bb7? 偏离防守。' },
      { move: 'g6g5', reply: 'f3g4', note: '...g5 开始推进王翼，白王 Kg4?。' },
      { move: 'h7h5', reply: 'g4f5', note: '...h5+，白王被赶到 f5。' },
      { move: 'h2g3', reply: 'f5e6', note: '...Qxg3，黑方再赢一兵，白王到 e6。' },
      { move: 'g3f2', reply: 'f1b5', note: '...Qf2，白后 Qb5 试图反击。' },
      { move: 'f2f6', reply: 'e6d5', note: '...Qf6+，黑后重新掌控节奏。' },
      { move: 'g5g4', reply: 'b7c8', note: '...g4 推进通路兵，白象到 c8。' },
      { move: 'f6e7', reply: 'c8f5', note: '...Qe7，白象 Bf5。' },
      { move: 'g7h6', reply: 'b5f1', note: '黑王到 h6，白后回 f1。' },
      { move: 'e7c7', reply: 'f1e2', note: '...Qc7，白后 e2。' },
      { move: 'c7c5', reply: 'd5e6', note: '...Qc5+，白王到 e6。' },
      { move: 'h6g5', reply: 'e2f1', note: '黑王到 g5，白后回 f1。' },
      { move: 'c5a3', reply: 'f1e2', note: '...Qa3，压住 a 兵并继续牵制白王。' },
      { move: 'd4c5', reply: 'e2d2', note: '...Bc5，白后 Qd2+。' },
      { move: 'a3e3', reply: 'd2a5', note: '...Qe3，白后 Qa5。' },
      { move: 'c5b6', reply: 'a5a2', note: '...Bb6，白后 Qa2。' },
      { move: 'e3f2', reply: 'a2b1', note: '...Qf2，白后 Qb1。' },
      { move: 'g4g3', reply: 'f5h3', note: '...g3，白象 Bh3。' },
      { move: 'g5h4', reply: 'h3g2', note: '黑王到 h4，白象 Bg2。' },
      { move: 'f2g1', reply: 'b1g1', note: '...Qg1 迫使换后，白后 Qxg1。' },
      { move: 'b6g1', reply: 'e6d6', note: '...Bxg1，黑方转入赢棋的象兵残局。' },
      { move: 'g1d4', reply: 'a6a7', note: '...Bd4，白方只能推进 a 兵。' },
      { move: 'd4a7', reply: 'd6e5', note: '...Bxa7 消灭通路兵，白王吃 e5。' },
      { move: 'h4g4', reply: 'e5d5', note: '黑王到 g4，白王到 d5。' },
      { move: 'h5h4', reply: 'e4e5', note: '...h4，白方 e5。' },
      { move: 'h4h3', reply: 'g2h3', note: '...h3，白象 Bxh3+。' },
      { move: 'g4h3', reply: 'e5e6', note: '...Kxh3，白方 e6。' },
      { move: 'a7c5', note: '...Bc5 阻住白兵，黑方赢棋。' }
    ]
  },
  {
    id: 'mce-gerusel-schubert-queen-bishop-battery',
    category: 'queen-minor-endgames',
    title: '用后象电池瘫痪防守',
    level: '后象对后象',
    goal: '白先，用 Qf5! 建立攻王威胁并迫使黑方过载',
    fen: '7k/ppq4p/3pB3/3Pp1pP/6P1/bP1Q1P2/P5K1/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 79,
      game: 'Gerusel-Schubert, German Bundesliga 1981/82',
      pdfPage: 175,
      bookPage: 172,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 79 图面还原 FEN；从 1.Qf5! 到 8.Qxa7 的后象攻王与过载转化合并为一道题，分析图和分支不另拆题。'
    }),
    teaching: {
      principle: '后象电池的价值不一定是直接将死；只要制造足够多的王翼威胁，就能让对方后和象被迫防守，随后赢下结构弱点。',
      method: 'Qf5! 先威胁黑王，h6! 继续限制逃跑格。白象从 e6 到 f7，再经 c8 制造决定性压力，逼黑象到 d8 防守。之后 Be6! 让黑方后必须回 c7，白后转到 a8，最终在黑方将军后仍能回到 c7 并吃掉 a7。',
      mistake: '如果白方慢慢改善或只盯着通路兵，黑方有 ...Bc1-f4 的防守转移。正确做法是先用攻王威胁让黑方所有子力失去主动。'
    },
    hints: ['第一步 Qf5!，用后象配合直接威胁黑王。', 'h6! 让黑王的逃跑格越来越少。', '黑方被迫防守 c 线后，白后可以转到 a8 再回到 c7。'],
    steps: [
      { move: 'd3f5', reply: 'c7e7', note: 'Qf5! 先限制黑后，...Qe7 被迫防守。' },
      { move: 'h5h6', reply: 'a3c5', note: 'h6! 继续收紧黑王，黑象到 c5。' },
      { move: 'e6f7', reply: 'c5b6', note: 'Bf7，黑象 b6 防守要点。' },
      { move: 'f5c8', reply: 'b6d8', note: 'Qc8+，黑象 d8 被迫堵线。' },
      { move: 'f7e6', reply: 'e7c7', note: 'Be6! 继续捆绑黑后，黑后回 c7。' },
      { move: 'c8a8', reply: 'c7c2', note: 'Qa8，黑后 Qc2+ 试图反击。' },
      { move: 'g2g3', reply: 'c2c7', note: 'Kg3，黑后只能回 c7。' },
      { move: 'a8a7', note: 'Qxa7，白方赢下 a 兵并保持决定性优势。' }
    ]
  },
  {
    id: 'mce-kholmov-baikov-attack-into-technical-win',
    category: 'queen-minor-endgames',
    title: '攻王逼弱化再技术转换',
    level: '后象对后象',
    goal: '白先，用 Bd3! 和 Qe6 让黑王被迫走向弱化',
    fen: '6k1/6p1/3b1p1p/ppq2P2/4Bp2/P1P4P/1P2Q1P1/1K6 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 80,
      game: 'Kholmov-Baikov, Moscow 1988',
      pdfPage: 176,
      bookPage: 173,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 80 图面还原 FEN；从 1.Bd3! 到 35.Qc2+ 的攻王、赢兵和技术转换合并为一道题，中间分析图不另拆题。'
    }),
    teaching: {
      principle: '后象攻王不一定要直接杀王；只要迫使对方王进入危险区、后离开防守点，就能先赢兵，再进入技术性优势。',
      method: 'Bd3! 阻止黑象轻松到 e5，Qe6 和 Qd7! 让黑后被绑在 c5/c8 防守上。白方用 b4 交换打开后翼后，Qc8+、Qc4、Qe6 一步步逼黑方过载。中段 Ka2! 和 Bb3 把白王也纳入进攻，随后 Qf8、Qg8、Qxg7+ 和 Qxh4 赢第二兵。最后白方不急着将死，而是用 Qxf6、Qc3、Qc2+ 等手段稳稳把多兵优势扩大。',
      mistake: '如果白方让黑方顺利 ...Be5，黑方可以守和。这个例子关键不是急攻，而是用攻王威胁迫使黑方结构和子力位置同时变坏。'
    },
    hints: ['第一步 Bd3!，先切断黑象去 e5 的舒适防守。', 'Qe6 与 Qd7! 让黑后被迫留在 c 线防守。', '后段不要只追将死，赢下 f6、h4 等兵后技术转换即可。'],
    steps: [
      { move: 'e4d3', reply: 'g8f8', note: 'Bd3! 阻止 ...Be5，黑王到 f8。' },
      { move: 'e2e6', reply: 'd6e7', note: 'Qe6，黑象 e7 被迫防守。' },
      { move: 'e6d7', reply: 'b5b4', note: 'Qd7! 利用黑王弱点，黑方 ...b4。' },
      { move: 'a3b4', reply: 'a5b4', note: 'axb4 axb4，打开后翼结构。' },
      { move: 'c3b4', reply: 'c5d6', note: 'cxb4，黑后 d6。' },
      { move: 'd7c8', reply: 'e7d8', note: 'Qc8+，黑象 d8 堵住。' },
      { move: 'c8c4', reply: 'd8b6', note: 'Qc4，黑象 b6。' },
      { move: 'd3c2', reply: 'd6d4', note: 'Bc2，黑后 Qd4。' },
      { move: 'c4e6', reply: 'd4e3', note: 'Qe6，黑后 e3。' },
      { move: 'e6d6', reply: 'f8g8', note: 'Qd6+，黑王到 g8。' },
      { move: 'b1a2', reply: 'g8h7', note: 'Ka2! 白王参与进攻，黑王到 h7。' },
      { move: 'c2b3', reply: 'h6h5', note: 'Bb3，黑方 ...h5 防守杀王威胁。' },
      { move: 'd6f8', reply: 'h5h4', note: 'Qf8，黑方 ...h4。' },
      { move: 'f8g8', reply: 'h7h6', note: 'Qg8+，黑王到 h6。' },
      { move: 'g8h8', reply: 'h6g5', note: 'Qh8+，黑王到 g5。' },
      { move: 'h8g7', reply: 'g5f5', note: 'Qxg7+ 赢兵，黑王到 f5。' },
      { move: 'g7g4', reply: 'f5e4', note: 'Qg4+，黑王到 e4。' },
      { move: 'g4h4', reply: 'e4d3', note: 'Qxh4，白方赢下第二兵，黑王到 d3。' },
      { move: 'h4f6', reply: 'd3e2', note: 'Qxf6，继续清掉关键防守兵。' },
      { move: 'f6c3', reply: 'e2f2', note: 'Qc3，黑王到 f2。' },
      { move: 'c3c2', reply: 'f2g3', note: 'Qc2+，黑王到 g3。' },
      { move: 'b3d5', reply: 'b6d4', note: 'Bd5，黑象 d4。' },
      { move: 'b4b5', reply: 'g3h2', note: 'b5，黑王到 h2。' },
      { move: 'd5f3', reply: 'e3e6', note: 'Bf3，黑后 e6+。' },
      { move: 'a2a3', reply: 'h2g3', note: 'Ka3，黑王到 g3。' },
      { move: 'b2b4', reply: 'e6e1', note: 'b4，黑后 e1。' },
      { move: 'a3a4', reply: 'e1a1', note: 'Ka4，黑后 Qa1+。' },
      { move: 'a4b3', reply: 'a1a7', note: 'Kb3，黑后 a7。' },
      { move: 'c2d3', reply: 'd4e3', note: 'Qd3，黑象 e3。' },
      { move: 'd3g6', reply: 'g3f2', note: 'Qg6+，黑王到 f2。' },
      { move: 'h3h4', reply: 'a7b8', note: 'h4，黑后 b8。' },
      { move: 'g6c6', reply: 'b8g8', note: 'Qc6，黑后 Qg8+。' },
      { move: 'c6c4', reply: 'g8d8', note: 'Qc4，黑后 d8。' },
      { move: 'h4h5', reply: 'd8d6', note: 'h5，黑后 d6。' },
      { move: 'c4c2', note: 'Qc2+，白方多兵和攻势决定胜负。' }
    ]
  },
  {
    id: 'mce-naroditsky-study-remove-the-obstacle',
    category: 'queen-minor-endgames',
    title: '先消除阻碍再执行计划',
    level: '后象残局研究',
    goal: '白先，先改善王和兵形，再换后进入赢兵残局',
    fen: '7k/4q3/3b1p1p/4pQp1/8/4P3/2B2PPP/5K2 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 81,
      game: 'Naroditsky, study position 2010',
      pdfPage: 178,
      bookPage: 175,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 81 图面还原 FEN；把王路、h3/f3 改善结构和换后进入赢兵残局合并为一道研究题，书中反例与分析图不另拆题。'
    }),
    teaching: {
      principle: '复杂优势局面里，不要先执行看似自然的换后计划；先找出阻碍计划的因素，再把结构调整到对方反资源失效。',
      method: '白方先用 g3 和王路测试到 h5 的路线，确认黑方只能被动用后等待。关键不是马上换后，而是先下 h3、f3，把 e4-f3-g4-h3 的兵形搭好。之后 Kg4-h5 进入，Qf7+ 迫使换后，白王吃 g6 后再用 e4 和 g4 让黑方 ...h5 资源失效，最终吃掉 f6/h4 后赢棋。',
      mistake: '直接换后或急着推进 h 兵会被 ...h5、...f5 或 ...Bb4 等防守资源阻住。正确流程是先改善，后执行。'
    },
    hints: ['先用 g3 和王路把白王带向 h5。', '真正关键是 h3 和 f3，先消除黑方 ...h5 的解药。', '换后后不要急，e4 与 g4 让黑方无法同时守住 f6 和 e5。'],
    steps: [
      { move: 'g2g3', reply: 'e7g7', note: 'g3! 先为王路和兵形做准备，黑后 g7。' },
      { move: 'f1g2', reply: 'g7e7', note: 'Kg2，黑后回 e7。' },
      { move: 'g2h3', reply: 'e7g7', note: 'Kh3，黑方只能继续等待。' },
      { move: 'h3g4', reply: 'g7e7', note: 'Kg4，确认白王能走入对方阵地。' },
      { move: 'h2h3', reply: 'e7g7', note: 'h3! 先改善结构，不急着换后。' },
      { move: 'f2f3', reply: 'g7e7', note: 'f3! 搭好 e4-f3-g4-h3 的结构。' },
      { move: 'g4h5', reply: 'e7f7', note: 'Kh5! 黑方被迫 Qf7+。' },
      { move: 'f5g6', reply: 'f7g6', note: 'Qg6，黑方只能换后。' },
      { move: 'h5g6', reply: 'd6c5', note: 'Kxg6，黑象 c5 试图防守。' },
      { move: 'e3e4', reply: 'c5f2', note: 'e4! 白方先固定关键兵，黑象 f2。' },
      { move: 'g3g4', reply: 'h6h5', note: 'g4，黑方 ...h5 已经失效。' },
      { move: 'g6f6', reply: 'h5g4', note: 'Kxf6! 黑方 hxg4。' },
      { move: 'h3g4', note: 'hxg4，白方赢下关键兵并进入赢棋残局。' }
    ]
  },
  {
    id: 'mce-vardanyan-naroditsky-make-draw-harder',
    category: 'queen-minor-endgames',
    title: '别替对手简化堡垒',
    level: '后象堡垒防守',
    goal: '白先，体会直接换后如何让黑方轻松守和',
    fen: '2kb4/2q5/3p4/p2Pp3/Pp2B3/1K1Q2P1/1PP5/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 82,
      game: 'Vardanyan-Naroditsky, Los Angeles 2006',
      pdfPage: 181,
      bookPage: 178,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 82 图面还原 FEN；实战从 1.Qb5 到 8...Bb4 的简化守和合并为一道题，书中 A/B/C 防守分支作为教学提示不另拆题。'
    }),
    teaching: {
      principle: '客观和棋也可以让对手防得很难；优势方最忌直接换入对手已经准备好的堡垒。',
      method: '实战 1.Qb5 直接允许 ...Qb6 和换后，黑方很快用王象配合建立堡垒。白方虽然多兵，但黑方所有兵都被保护，王不让步，象在 b4/c3 一带封锁，白方无法制造通路兵。',
      mistake: '更实际的尝试是保留后，给黑方多个选择和精确防守难题，例如 Qc6+ 或把王渗透到 c4/b5。即使客观不赢，也要让防守方持续做决定。'
    },
    hints: ['直接 Qb5 交换后会让黑方堡垒成型。', '换后后黑王要站到 b7/b6 一带，不让白王突破。', '训练重点是识别：优势方不应主动进入对方最舒服的守和结构。'],
    steps: [
      { move: 'd3b5', reply: 'c7b6', note: 'Qb5?! 直接给黑方 ...Qb6 的简化机会。' },
      { move: 'b5b6', reply: 'd8b6', note: 'Qxb6 Bxb6，后被换掉，堡垒方向清晰。' },
      { move: 'b3c4', reply: 'c8b7', note: 'Kc4，黑王到 b7 阻挡。' },
      { move: 'c4b5', reply: 'b6d4', note: 'Kb5，黑象 d4 保持封锁。' },
      { move: 'c2c3', reply: 'b4c3', note: 'c3，黑方 bxc3 消除突破。' },
      { move: 'b2b3', reply: 'c3c2', note: 'b3，黑方 c2! 继续限制。' },
      { move: 'e4c2', reply: 'd4c3', note: 'Bxc2，黑象 c3。' },
      { move: 'b5c4', reply: 'c3b4', note: 'Kc4 Bb4，黑方堡垒守和。' }
    ]
  },
  {
    id: 'mce-ibragimov-dziuba-make-defense-harder',
    category: 'queen-minor-endgames',
    title: '让稳固防守变得难受',
    level: '后象对后象',
    goal: '白先，用 Bc3! 让后侵入并持续攻击兵链',
    fen: '6k1/p2bq1pp/1p6/2p1Bp2/2P5/1P3PQP/P5PK/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 83,
      game: 'Ibragimov-Dziuba, European Championship Warsaw 2005',
      pdfPage: 182,
      bookPage: 179,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 83 图面还原 FEN；从 1.Bc3! 到 12.Qe5! 的实战转折合并为一道题，黑方其他防守说明不另拆题。'
    }),
    teaching: {
      principle: '优势方看不到强制赢法时，不要接受“对手能守住”的静态结论；先把防守任务变得更难，让对方持续面对精确选择。',
      method: 'Bc3! 离开 e5，让白后通过 b8 深入黑方阵地。随后 Be5、Bd6、Bc7 反复攻击 a7-b6-c5 兵链，迫使黑方弱化。黑方 10...Bxc4?? 看似吃兵守住，其实让白象到 d4 后形成 Qe5! 的致命双重威胁。',
      mistake: '黑方 3...a5? 过早推进制造弱点；之后 10...Bxc4?? 贪兵，错过保持防守弹性的机会。优势方要不断制造这种“看似自然但有战术漏洞”的选择。'
    },
    hints: ['第一步 Bc3!，给白后进入 b8 的路线。', '目标是持续攻击 a7-b6-c5 兵链。', '黑方 ...Bxc4?? 后，Bd4 和 Qe5! 是关键战术。'],
    steps: [
      { move: 'e5c3', reply: 'd7e8', note: 'Bc3! 让白后能进入 b8，黑象 e8。' },
      { move: 'g3b8', reply: 'g8f7', note: 'Qb8，黑王到 f7。' },
      { move: 'c3e5', reply: 'a7a5', note: 'Be5，黑方 ...a5? 立刻制造新弱点。' },
      { move: 'e5d6', reply: 'e7d7', note: 'Bd6! 驱赶黑后，黑后 d7。' },
      { move: 'd6c7', reply: 'b6b5', note: 'Bc7? 让黑方有机会，但仍保持压力。' },
      { move: 'b8a7', reply: 'b5c4', note: 'Qa7，黑方 bxc4。' },
      { move: 'b3c4', reply: 'd7c6', note: 'bxc4，黑后 c6。' },
      { move: 'c7d6', reply: 'f7g6', note: 'Bd6+，黑王到 g6。' },
      { move: 'a7e7', reply: 'e8f7', note: 'Qe7，黑象 f7。' },
      { move: 'd6c5', reply: 'f7c4', note: 'Bxc5，黑方 ...Bxc4?? 贪兵。' },
      { move: 'c5d4', reply: 'c4f7', note: 'Bd4! 黑象回 f7，但已经来不及。' },
      { move: 'e7e5', note: 'Qe5! 致命双重威胁，黑方无法防守。' }
    ]
  },
  {
    id: 'mce-filippov-van-wely-knockout-with-f6',
    category: 'queen-minor-endgames',
    title: '弱王旁的突然击倒',
    level: '后象战术转换',
    goal: '白先，利用 f6 兵和黑王位置制造强制杀',
    fen: '4rk2/5p2/p2p1Pp1/3B2Pp/2P1Q3/8/P2q1PKb/1R6 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 84,
      game: 'Filippov-Van Wely, FIDE World Championship Tripoli 2004',
      pdfPage: 184,
      bookPage: 181,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 84 图面还原 FEN；从 1.Rb8! 到 7.Be8+ 的强制杀线合并为一道题，中间换车后的局面不另拆题。'
    }),
    teaching: {
      principle: '后象残局里，通路兵压住关键格时，弱王附近常有突然的战术击倒；不要只满足于普通优势。',
      method: 'Rb8! 先制造 Rxe8+ 的威胁。黑方 ...Be5! 暂时堵住白后，但换车后黑王仍然没有改善。Bxf7+! 是真正的击倒，利用 f6 兵控制 e7/g7，让白后转到 a8、a7、b8 后完成强制杀。',
      mistake: '只下 Qf3 或接受简单和棋/缓慢转换，会错过黑王位置带来的强制战术。看到弱王和关键通路兵时，要主动寻找击倒。'
    },
    hints: ['第一步 Rb8!，先逼黑方处理 Rxe8+。', '换车后不要退后，Bxf7+! 是关键。', 'f6 兵控制 e7/g7，支撑后从 a8-a7-b8 杀入。'],
    steps: [
      { move: 'b1b8', reply: 'h2e5', note: 'Rb8! 黑象 Be5! 暂时封住白后。' },
      { move: 'b8e8', reply: 'f8e8', note: 'Rxe8+ Kxe8，进入关键局面。' },
      { move: 'd5f7', reply: 'e8d8', note: 'Bxf7+! 利用 f6 兵控制关键格，黑王到 d8。' },
      { move: 'e4a8', reply: 'd8c7', note: 'Qa8+，黑王到 c7。' },
      { move: 'a8a7', reply: 'c7d8', note: 'Qa7+，黑王回 d8。' },
      { move: 'a7b8', reply: 'd8d7', note: 'Qb8+，黑王到 d7。' },
      { move: 'f7e8', note: 'Be8+，白方形成强制杀。' }
    ]
  },
  {
    id: 'mce-lenderman-holt-sacrifice-into-passers',
    category: 'queen-minor-endgames',
    title: '击倒不一定直接将死',
    level: '后象战术转换',
    goal: '白先，牺牲换后并让通路兵决定胜负',
    fen: '7k/1q4p1/3Pp2p/5b2/2QB1P2/2P1K1P1/7P/8 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 85,
      game: 'Lenderman-Holt, Chicago Open 2010',
      pdfPage: 185,
      bookPage: 182,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 85 图面还原 FEN；从 1.Bxg7+! 到 6.Kc5 的牺牲换后和通路兵胜势合并为一道题。'
    }),
    teaching: {
      principle: '击倒不必马上将死；只要牺牲能把局面转成明确赢棋的通路兵残局，就是正确的战术转换。',
      method: 'Bxg7+! 诱使黑王吃象。随后 Qc7+ 强制换后，dxc7 后白方的 c、d 兵群无法阻挡。e5! 是容易漏算的一步，它让黑方无法同时处理通路兵和白王路线，白王随后走向 d4-c5。'
      ,
      mistake: '自然的 Be5 虽然仍有优势，但给黑后 ...Qh1 等反击机会。更精确的是先算清牺牲换后后的通路兵速度。'
    },
    hints: ['第一步 Bxg7+!，目标不是直接杀王，而是强制换后。', 'Qxc7 后用 d 兵吃回，通路兵群成为主角。', 'e5! 是关键中间手，随后白王走到 c5。'],
    steps: [
      { move: 'd4g7', reply: 'h8g7', note: 'Bxg7+! 诱使黑王离开。' },
      { move: 'c4c7', reply: 'b7c7', note: 'Qc7+ 强制换后，黑后吃 c7。' },
      { move: 'd6c7', reply: 'e6e5', note: 'dxc7，黑方 ...e5 试图阻挡。' },
      { move: 'f4e5', reply: 'h6h5', note: 'fxe5，黑方 ...h5。' },
      { move: 'e3d4', reply: 'g7f7', note: 'Kd4，白王向通路兵靠近。' },
      { move: 'd4c5', note: 'Kc5，白方通路兵决定胜负。' }
    ]
  },
  {
    id: 'mce-yusupov-timman-active-defense-qf4',
    category: 'queen-minor-endgames',
    title: '别被动等死，要主动防守',
    level: '后象残局防守',
    goal: '黑先，用 ...Qf4! 和 ...b5! 制造反制资源',
    fen: '6k1/7p/1p3qp1/3pP3/b1p5/P1B5/1Q3PPP/6K1 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 86,
      game: 'Yusupov-Timman, Candidates Match Linares 1992',
      pdfPage: 186,
      bookPage: 183,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 86 图面还原 FEN；训练线采用书中指出的正确主动防守 1...Qf4! 和 ...b5!，实战被动 1...Qe6? 的后续作为反面教材不另拆题。'
    }),
    teaching: {
      principle: '防守后象残局时，完全被动会让优势方慢慢改善；只要有机会制造反威胁，就要主动争取空间和选择权。',
      method: '...Qf4! 把后从 e6 这类被动封锁点解放出来，直接盯住白王侧。白方 2.h3 后，...b5! 是关键，避免无谓等待。随后 ...Qe4、...c3 和 ...Qe3 让白方不能舒服地推进 e 兵和王翼兵。',
      mistake: '实战 ...Qe6? 看似自然，挡住 e 兵并补 a1-h8 斜线，但后在 e6 不是好封锁者；之后白方 Bd4、h3-h5、g4 等手段会把黑方越推越被动。'
    },
    hints: ['第一手不要 ...Qe6?，找主动资源 ...Qf4!。', '白方 h3 后，...b5! 争空间，不让白方单方面改善。', '后要持续制造反威胁，不能只做封锁者。'],
    steps: [
      { move: 'f6f4', reply: 'h2h3', note: '...Qf4! 主动防守，白方 h3 准备改善。' },
      { move: 'b6b5', reply: 'e5e6', note: '...b5! 争取空间，白方推进 e 兵。' },
      { move: 'f4e4', reply: 'c3h8', note: '...Qe4，白象 Bh8 试图制造牵制。' },
      { move: 'c4c3', reply: 'b2c3', note: '...c3! 制造反击点，白后吃 c3。' },
      { move: 'e4e3', note: '...Qe3，黑方保持主动防守和反威胁。' }
    ]
  },
  {
    id: 'mce-kasimdzhanov-adams-patient-passive-defense',
    category: 'queen-minor-endgames',
    title: '能被动守住时不要乱反击',
    level: '后象残局防守',
    goal: '黑先，先保护弱兵，再等待白方过度推进',
    fen: '3q2k1/5p1p/p5p1/1p2P3/1P2Q1P1/P6P/Bb3PK1/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 87,
      game: 'Kasimdzhanov-Adams, FIDE World Championship Tripoli 2004',
      pdfPage: 188,
      bookPage: 185,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 87 图面还原 FEN；从 1...Qe7! 到 10.Ke3 的实战防守合并为一道题，并在教学中标出 8...Qe4! 的赢棋反击资源。'
    }),
    teaching: {
      principle: '防守方不是永远要主动；当后被弱点牵住、主动反击不可靠时，先承认被动并精确防守，等对手急躁。',
      method: '...Qe7! 先保护 f7。白方 e6 和 Qa8+ 看似压迫，但黑方通过 ...fxe6、...Qd7 稳住。白方 5.g5 固定黑王翼后，6.Qa8 Bd4 继续等。实战 8...Bxf2+? 能守和，但错过了书中指出的 ...Qe4! 反杀资源；之后黑方用 ...Qc2+ 逼和。',
      mistake: '早期 ...Bxa3 或 ...Qd4 这类主动反击会让白方直接赢象或进入强攻。真正的难点是先忍住，等白方把自己的王暴露。'
    },
    hints: ['第一手 ...Qe7!，先补 f7，别乱反击。', '白方 e6 后，用 ...fxe6 和 ...Qd7 保持结构。', '白王暴露后，...Bxf2+ 和 ...Qc2+ 至少能守和；更强的是寻找 ...Qe4!。'],
    steps: [
      { move: 'd8e7', reply: 'e5e6', note: '...Qe7! 保护 f7，白方 e6。' },
      { move: 'f7e6', reply: 'e4a8', note: '...fxe6，白后 Qa8+。' },
      { move: 'g8f7', reply: 'a8a6', note: '黑王到 f7，白后吃 a6。' },
      { move: 'e7d7', reply: 'g4g5', note: '...Qd7，白方 g5 固定结构。' },
      { move: 'f7e7', reply: 'a6a8', note: '黑王到 e7，白后 Qa8。' },
      { move: 'b2d4', reply: 'a8g8', note: '...Bd4，白后 Qg8? 让白王弱点暴露。' },
      { move: 'd7c6', reply: 'g2g3', note: '...Qc6+，白王到 g3。' },
      { move: 'd4f2', reply: 'g3f2', note: '...Bxf2+? 实战守和，但错过 ...Qe4! 反杀。' },
      { move: 'c6c2', reply: 'f2e3', note: '...Qc2+，白王到 e3，黑方获得长将防守。' }
    ]
  },
  {
    id: 'mce-shirov-adams-active-counterplay-held',
    category: 'queen-minor-endgames',
    title: '主动反击后仍要精确防守',
    level: '后象残局防守',
    goal: '黑先，先制造王翼反击；白方随后精确守和',
    fen: '5k2/2p2p2/1b3qp1/7p/1P2BP1P/2P3P1/3Q2K1/8 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 88,
      game: 'Shirov-Adams, Candidates Tournament Elista 2007',
      pdfPage: 192,
      bookPage: 189,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 88 图面还原 FEN；从 1...Qe6 到 13.Qe7 的主动防守和白方精确守和合并为一道题，中间图面不另拆题。'
    }),
    teaching: {
      principle: '判断该主动还是被动，要看对方计划的速度和自己的反击目标；有可攻击弱点时，防守方应先创造威胁。',
      method: '...Qe6 先把后放到能进入白王阵地的位置。...f5! 固定王翼弱点，...Qe3 和 ...Bd4 让白方子力被迫回防。白方唯一办法是 c5、Qa2-a8 反过来找长将和牵制，最终通过 Qf8-e7 保持平衡。',
      mistake: '如果黑方只是等待，白方会慢慢用 c4-c5 和攻击 c7 建立优势；但白方若主动反击不精确，弱王会被后象电池立即利用。'
    },
    hints: ['第一手 ...Qe6，后要能进入白王阵地。', '...f5! 是固定白方王翼弱点的关键。', '白方要靠 Qa2-a8 和 Qf8-e7 同时防守与长将。'],
    steps: [
      { move: 'f6e6', reply: 'd2c2', note: '...Qe6，白后 Qc2。' },
      { move: 'f7f5', reply: 'e4f3', note: '...f5! 固定弱点，白象回 f3。' },
      { move: 'e6e3', reply: 'c3c4', note: '...Qe3! 开始制造威胁，白方 c4。' },
      { move: 'b6d4', reply: 'c4c5', note: '...Bd4，白方 c5 争取反击。' },
      { move: 'f8g7', reply: 'c2a2', note: '黑王到 g7，白后 Qa2。' },
      { move: 'g7h6', reply: 'a2a8', note: '黑王到 h6，白后 Qa8!。' },
      { move: 'e3d2', reply: 'g2h3', note: '...Qd2+，白王到 h3。' },
      { move: 'd2b4', reply: 'a8f8', note: '...Qxb4，白后 Qf8+。' },
      { move: 'd4g7', reply: 'f8e7', note: '...Bg7，白后 Qe7。' },
      { move: 'b4c3', reply: 'f3d5', note: '...Qc3，白象 Bd5。' },
      { move: 'g7f6', reply: 'e7f8', note: '...Bf6，白后 Qf8+。' },
      { move: 'f6g7', reply: 'f8e7', note: '...Bg7，白后回 e7，和棋。' }
    ]
  },
  {
    id: 'mce-nguyen-cao-sang-passive-defense-setup',
    category: 'queen-minor-endgames',
    title: '被动防守也要先完成结构',
    level: '后象残局防守',
    goal: '白先，用 c5!! 诱使黑象离位并建立堡垒',
    fen: '8/1p4pk/7p/4pp2/p1P1b2P/P3B1P1/1P1QKP2/7q w - - 0 1',
    orientation: 'w',
    source: source({
      example: 89,
      game: 'Nguyen Thien Viet-Cao Sang, Ho Chi Minh City 2010',
      pdfPage: 193,
      bookPage: 190,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 89 图面还原 FEN；从 1.c5!! 到 32.Kc3 的被动防守长线合并为一道题，中间分析图和重复将不另拆题。'
    }),
    teaching: {
      principle: '当己方王长期虚弱、主动反击都被战术惩罚时，要选择被动防守；但被动防守不是等死，而是先完成能守住的结构。',
      method: 'c5!! 是关键等待手：它自愿弱化 a6-f1 斜线并堵住白象，诱使黑象离开 e4。之后白王走到 c3，白后反复在 d1/d2/c3 防守。白方用 h4 和 gxf4 形成堡垒，h4 兵阻止 ...g5 后续。后段白方继续用王、后、象反复化解将军，最终换掉关键子力后守和。',
      mistake: '直接寻求反击如 Qd6、Qb4、Bxh6 都因为白王弱而失败。这个例子的难点是承认不能主动，只能先消除阻碍，把王转到 c3。'
    },
    hints: ['第一步 c5!!，目的是诱使黑象离开 e4。', '白王要走到 c3，完成被动防守结构。', 'h4 和 gxf4 后，白方建立堡垒，后面要耐心应对将军。'],
    steps: [
      { move: 'c4c5', reply: 'e4c6', note: 'c5!! 诱使黑象离开主宰位置，黑象 c6?!。' },
      { move: 'e2d3', reply: 'h1f1', note: 'Kd3，黑后 Qf1+。' },
      { move: 'd3c3', reply: 'f1b5', note: 'Kc3，白王到达目标区，黑后 Qb5。' },
      { move: 'd2d1', reply: 'b5a5', note: 'Qd1，黑后 Qa5+。' },
      { move: 'c3c2', reply: 'c6e4', note: 'Kc2，黑象回 e4。' },
      { move: 'c2c1', reply: 'a5b5', note: 'Kc1，黑后 Qb5。' },
      { move: 'd1d2', reply: 'b5f1', note: 'Qd2，黑后 Qf1+。' },
      { move: 'd2d1', reply: 'f1b5', note: 'Qd1，黑后回 b5。' },
      { move: 'd1d2', reply: 'b5c4', note: 'Qd2，黑后 Qc4+。' },
      { move: 'd2c3', reply: 'c4f1', note: 'Qc3，黑后 Qf1+。' },
      { move: 'c1d2', reply: 'f5f4', note: 'Kd2，黑方 ...f4!。' },
      { move: 'g3f4', reply: 'e5f4', note: 'gxf4 exf4，白方拆掉关键推进。' },
      { move: 'e3d4', reply: 'e4g6', note: 'Bd4，黑象 g6。' },
      { move: 'c3f3', reply: 'f1b1', note: 'Qf3，黑后 Qb1。' },
      { move: 'f3f4', reply: 'b1c2', note: 'Qxf4，黑后 Qc2+。' },
      { move: 'd2e1', reply: 'c2b1', note: 'Ke1，黑后 Qb1+。' },
      { move: 'e1d2', reply: 'b1d3', note: 'Kd2，黑后 Qd3+。' },
      { move: 'd2e1', reply: 'g6h5', note: 'Ke1，黑象 h5。' },
      { move: 'f2f3', reply: 'h5f3', note: 'f3，黑象吃 f3。' },
      { move: 'f4e5', reply: 'd3g6', note: 'Qe5，黑后 Qg6。' },
      { move: 'd4c3', reply: 'g6g4', note: 'Bc3，黑后 Qg4。' },
      { move: 'e1d2', reply: 'f3e4', note: 'Kd2，黑象 e4。' },
      { move: 'd2e3', reply: 'g4f3', note: 'Ke3，黑后 Qf3+。' },
      { move: 'e3d2', reply: 'f3f2', note: 'Kd2，黑后 Qf2+。' },
      { move: 'd2d1', reply: 'e4c2', note: 'Kd1，黑象 c2+。' },
      { move: 'd1c1', reply: 'f2g2', note: 'Kc1，黑后 Qg2。' },
      { move: 'e5g7', reply: 'g2g7', note: 'Qxg7+，黑后 Qxg7。' },
      { move: 'c3g7', reply: 'c2e4', note: 'Bxg7，黑象 e4。' },
      { move: 'g7f6', reply: 'h7g6', note: 'Bf6，黑王到 g6。' },
      { move: 'f6d8', reply: 'g6f5', note: 'Bd8，黑王到 f5。' },
      { move: 'c1d2', reply: 'f5e5', note: 'Kd2，黑王到 e5。' },
      { move: 'd2c3', note: 'Kc3，白方守住和棋。' }
    ]
  },
  {
    id: 'mce-naroditsky-gurtovoy-identify-h6-weakness',
    category: 'queen-minor-endgames',
    title: '找准弱点再转化',
    level: '同色象后残局',
    goal: '白先，找到 Bf4! 并把位置优势转成物质优势',
    fen: '8/pp1k1p2/2q1p2p/b6P/2P5/6B1/PPK1QP2/8 w - - 0 31',
    orientation: 'w',
    source: source({
      example: 90,
      game: 'Naroditsky-Gurtovoy, San Francisco 2006',
      pdfPage: 198,
      bookPage: 195,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 90 从 30...Qc6 后的关键残局点还原 FEN；采用书中指出的正确 31.Bf4! 转化线，前面开局和实战 31.Qd3+? 长将不另拆题。'
    }),
    teaching: {
      principle: '同色象后残局更偏向弱点、空间和通路兵；优势方要先识别对方最难防的固定弱点，再计算对方唯一反击。',
      method: 'Bf4! 直接瞄准 h6。黑方唯一实质反击是 ...b5，白方用 b3! 回应，允许 ...bxc4 后 Qxc4。此时 ...Qf3 是相对顽强，但 Qd3+! 强制换后，白王吃回后进入赢棋的象兵残局。',
      mistake: '实战 31.Qd3+? 让黑方从攻击 h 兵开始获得长将，优势瞬间消失。位置优势不能自动赢，必须在对方尚未组织反击前转成具体目标。'
    },
    hints: ['先找黑方固定弱点：h6。', 'Bf4! 是关键，直接威胁 Bxh6。', '黑方 ...b5 后用 b3!，再用 Qd3+ 强制换后。'],
    steps: [
      { move: 'g3f4', reply: 'b7b5', note: 'Bf4! 直接攻击 h6，黑方 ...b5 是唯一反击。' },
      { move: 'b2b3', reply: 'b5c4', note: 'b3! 冷静应对，黑方 bxc4。' },
      { move: 'e2c4', reply: 'c6f3', note: 'Qxc4，黑后 Qf3 相对顽强。' },
      { move: 'c4d3', reply: 'f3d3', note: 'Qd3+! 强制换后，黑后吃 d3。' },
      { move: 'c2d3', note: 'Kxd3，白方赢下 h6 后可继续扩大优势。' }
    ]
  },
  {
    id: 'mce-naroditsky-study-desperado-queen-trade',
    category: 'queen-minor-endgames',
    title: '绝境里用弃子逼换后',
    level: '同色象后残局战术',
    goal: '白先，用 Be6+!! 和 Qc6+!! 反制黑方杀棋威胁',
    fen: '2b3B1/2pkp2P/3p4/7b/3PPP2/7q/7p/2Q4K w - - 0 1',
    orientation: 'w',
    source: source({
      example: 91,
      game: 'Naroditsky, study position 2010',
      pdfPage: 199,
      bookPage: 196,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 91 图面还原 FEN；从 1.Be6+!! 到 5.Kxh2 的双弃子逼换后合并为一道题。'
    }),
    teaching: {
      principle: '面对看似无法阻止的杀棋，不要只找防守手；如果能把对方王和后引到尴尬位置，弃子也可以逼出换后或通路兵升变。',
      method: 'Be6+!! 先逼黑后从 h3 离开，Qxe6 后 Qc6+!! 再把黑王引到 c6。d5+ 是核心，黑王被迫到 b6 后，dxe6 让白方通路兵无法阻挡。',
      mistake: '直接 h8=Q 或普通防守会被黑方 ...Bf3# 主题压垮。真正资源是用节奏强迫对方放弃后和王的协调。'
    },
    hints: ['第一手 Be6+!!，先用象作诱饵。', '第二手 Qc6+!! 继续弃后思路，把黑王引到 c6。', 'd5+ 后 e 兵升变决定胜负。'],
    steps: [
      { move: 'g8e6', reply: 'h3e6', note: 'Be6+!! 逼黑后吃 e6。' },
      { move: 'c1c6', reply: 'd7c6', note: 'Qc6+!! 黑王被迫吃 c6。' },
      { move: 'd4d5', reply: 'c6b6', note: 'd5+，黑王到 b6。' },
      { move: 'd5e6', reply: 'h5f3', note: 'dxe6，黑象 f3+ 已经太慢。' },
      { move: 'h1h2', note: 'Kxh2，白方 e 兵决定胜负。' }
    ]
  },
  {
    id: 'mce-tymrakiewicz-mcnab-attack-g5-hole',
    category: 'queen-minor-endgames',
    title: '用王弱点分散防守',
    level: '同色象后残局',
    goal: '白先，先推进 a 兵，再转攻 g5 弱点和黑王',
    fen: '8/6k1/2b2qp1/P3p2p/3pP2P/3B4/6P1/2Q3K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 92,
      game: 'Tymrakiewicz-McNab, Uxbridge 2010',
      pdfPage: 200,
      bookPage: 197,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 92 图面还原 FEN；从 1.a6! 到 12.Qh4# 的通路兵牵制与王翼击倒合并为一道题。'
    }),
    teaching: {
      principle: '通路兵不一定要立刻升变；它可以牵住对方后和象，让优势方转而攻击另一侧的王和弱格。',
      method: 'a6! 先把黑后绑到防守 a 兵。Qg5! 转攻 g5 弱点，黑方 ...Qc5 看似守住升变格，但 3.g4!! 打开王翼。h5、a7 和 Qxe5+ 连续转移目标，最终白后从 e8-h8-h4 完成杀王。',
      mistake: '如果只盯着 a 兵，黑方的象和后还能勉强防守。正确思路是让 a 兵当诱饵，同时攻击黑王。'
    },
    hints: ['先走 a6!，让黑后必须顾 a 兵。', 'Qg5! 和 g4!! 是转攻王翼的关键。', 'a7 之后不要停，Qxe5+、Qxe8、Qh8-h4 完成杀王。'],
    steps: [
      { move: 'a5a6', reply: 'f6d6', note: 'a6! 黑后 Qd6 阻止 Qc5。' },
      { move: 'c1g5', reply: 'd6c5', note: 'Qg5! 攻击 g5 弱点，黑后 Qc5。' },
      { move: 'g2g4', reply: 'h5g4', note: 'g4!! 打开王翼，黑方 hxg4。' },
      { move: 'h4h5', reply: 'c6e8', note: 'h5，黑象 e8 被迫防守。' },
      { move: 'a6a7', reply: 'c5a7', note: 'a7! 黑后吃 a7 后离开王翼。' },
      { move: 'g5e5', reply: 'g7h6', note: 'Qxe5+，黑王到 h6。' },
      { move: 'e5e8', reply: 'a7a1', note: 'Qxe8，黑后 Qa1+。' },
      { move: 'g1g2', reply: 'h6h5', note: 'Kg2，黑王到 h5。' },
      { move: 'e4e5', reply: 'a1b2', note: 'e5，黑后 Qb2+。' },
      { move: 'g2g3', reply: 'b2b6', note: 'Kg3，黑后 Qb6。' },
      { move: 'e8h8', reply: 'h5g5', note: 'Qh8+，黑王到 g5。' },
      { move: 'h8h4', note: 'Qh4#，白方将死。' }
    ]
  },
  {
    id: 'mce-bologan-ponomariov-paralyze-with-queen-transfer',
    category: 'queen-minor-endgames',
    title: '转移后的位置压制',
    level: '同色象后残局',
    goal: '白先，用 Bb4+ 和后转移逐步瘫痪黑方',
    fen: '5k2/2b3p1/2P2p1p/8/3Q4/1qB3PP/5P2/6K1 w - - 0 1',
    orientation: 'w',
    source: source({
      example: 93,
      game: 'Bologan-Ponomariov, Poikovsky 2006',
      pdfPage: 202,
      bookPage: 199,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 93 图面还原 FEN；从 1.Bb4+ 到 20.Bf8# 的后转移、空间压制和最终杀王合并为一道题。'
    }),
    teaching: {
      principle: '同色象后残局里的多余通路兵可以先限制对手子力，再用后转移把静态优势转成完全压制。',
      method: 'Bb4+ 和 Bd6 先驱赶黑象。白后从 d4-d6-b8-b7-b1-e4-e6 完成大转移，迫使黑后长期被动。随后白方用 h4-h5 和 Qf5+-Qe6! 进一步缩小黑王空间，最后 Bd6-e7-c5-f8 形成杀王。',
      mistake: '贪图简单吃子或过早 Ba7 会给黑方 Qe5 等反击。关键是先让黑后被迫防守，再逐步收网。'
    },
    hints: ['第一步 Bb4+，先赶黑王并保持后象协调。', '白后要从 b7 转到 e4/e6，切断黑方反击。', '最后 Bd6-e7-c5-f8 是杀王路线。'],
    steps: [
      { move: 'c3b4', reply: 'f8g8', note: 'Bb4+，黑王到 g8。' },
      { move: 'b4d6', reply: 'c7b6', note: 'Bd6，黑象 b6。' },
      { move: 'd6c5', reply: 'b6a5', note: 'Bc5，继续驱赶黑象到 a5。' },
      { move: 'd4d6', reply: 'b3f7', note: 'Qd6，黑后 Qf7。' },
      { move: 'd6b8', reply: 'g8h7', note: 'Qb8+，黑王到 h7。' },
      { move: 'b8b7', reply: 'f7c7', note: 'Qb7，黑后 Qc7。' },
      { move: 'b7b1', reply: 'h7g8', note: 'Qb1+! 后大转移，黑王回 g8。' },
      { move: 'b1e4', reply: 'c7d8', note: 'Qe4，黑后 Qd8。' },
      { move: 'e4e6', reply: 'g8h8', note: 'Qe6+，黑王到 h8。' },
      { move: 'c5d6', reply: 'a5b6', note: 'Bd6，黑象 b6。' },
      { move: 'g1h2', reply: 'h8h7', note: 'Kh2，黑王到 h7。' },
      { move: 'h3h4', reply: 'h6h5', note: 'h4，黑方被迫 ...h5。' },
      { move: 'e6f5', reply: 'g7g6', note: 'Qf5+，黑方 ...g6。' },
      { move: 'f5e6', reply: 'h7g7', note: 'Qe6! 继续压制，黑王到 g7。' },
      { move: 'h2g2', reply: 'b6a5', note: 'Kg2，黑象 a5。' },
      { move: 'd6e7', reply: 'd8d4', note: 'Be7，黑后 Qd4。' },
      { move: 'e6d7', reply: 'd4e4', note: 'Qd7，黑后 Qe4+。' },
      { move: 'g2h2', reply: 'e4c2', note: 'Kh2，黑后 Qc2。' },
      { move: 'e7c5', reply: 'g7h6', note: 'Bc5+，黑王到 h6。' },
      { move: 'c5f8', note: 'Bf8#，白方将死。' }
    ]
  },
  {
    id: 'mce-bacrot-morozevich-overextended-passer',
    category: 'queen-minor-endgames',
    title: '通路兵过伸也会变弱',
    level: '同色象后残局防守反击',
    goal: '黑先，用 ...Qe8!? 诱导白方过伸，再封锁并反击',
    fen: '8/pp1q1k2/1b3pp1/3P3p/8/BP5P/4QPP1/6K1 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 94,
      game: 'Bacrot-Morozevich, Biel 2004',
      pdfPage: 204,
      bookPage: 201,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 94 图面还原 FEN；从 1...Qe8!? 到 15...Kf3 的诱导过伸和反击合并为一道题。'
    }),
    teaching: {
      principle: '对方通路兵看起来危险时，先判断它是否真的能推进；如果能有效封锁，过伸的通路兵反而会成为攻击目标。',
      method: '...Qe8!? 给白方一个艰难选择。白方不愿换后，Qd1 后 ...Qe5，d6? 过伸。...Ke8! 精确封锁，随后 ...a5、...Qa1、...Qxa3、...Ke6-d5-e6-f5 主动化王后。最后黑王亲自进入 g5-g4-f3，白方无力持续将军。',
      mistake: '白方 d6? 过于自信；如果通路兵无法继续前进，它会被封锁并成为黑方反击的支点。'
    },
    hints: ['第一手 ...Qe8!?，让白方决定是否换后。', '白方 d6? 后，...Ke8! 是封锁关键。', '黑王可以大胆走向中心和王翼，白方将军不足以成事。'],
    steps: [
      { move: 'd7e8', reply: 'e2d1', note: '...Qe8!? 诱导白方拒绝换后，白后 Qd1。' },
      { move: 'e8e5', reply: 'd5d6', note: '...Qe5，白方 d6? 过伸。' },
      { move: 'f7e8', reply: 'a3b4', note: '...Ke8! 封锁通路兵，白象 Bb4。' },
      { move: 'a7a5', reply: 'b4a3', note: '...a5，白象回 a3。' },
      { move: 'e8d7', reply: 'd1f3', note: '黑王到 d7，白后 Qf3。' },
      { move: 'e5a1', reply: 'g1h2', note: '...Qa1+，白王到 h2。' },
      { move: 'a1a3', reply: 'f3b7', note: '...Qxa3，白后 Qb7+。' },
      { move: 'd7e6', reply: 'b7e7', note: '黑王到 e6，白后 Qe7+。' },
      { move: 'e6d5', reply: 'e7b7', note: '黑王到 d5，白后 Qb7+。' },
      { move: 'd5e6', reply: 'b7e7', note: '黑王到 e6，白后 Qe7+。' },
      { move: 'e6f5', reply: 'g2g4', note: '黑王到 f5，白方 g4+。' },
      { move: 'h5g4', reply: 'h3g4', note: '...hxg4，白方 hxg4+。' },
      { move: 'f5g5', reply: 'f2f4', note: '黑王到 g5，白方 f4+。' },
      { move: 'g5g4', reply: 'e7e6', note: '黑王到 g4，白后 Qe6+。' },
      { move: 'g4f3', note: '...Kf3，白方将军耗尽，黑方赢。' }
    ]
  },
  {
    id: 'mce-borgo-drasko-dont-auto-trade',
    category: 'queen-minor-endgames',
    title: '换后前先看清象兵残局',
    level: '同色象后残局防守',
    goal: '黑先，理解自动换后如何给对手机会以及实战如何赢回',
    fen: '6k1/1b3pp1/7p/3p4/2pQ4/2P2qP1/7P/3B2K1 b - - 0 1',
    orientation: 'b',
    source: source({
      example: 95,
      game: 'Borgo-Drasko, Cutro 2001',
      pdfPage: 205,
      bookPage: 202,
      chapter: 'Chapter 5: Queen + Minor Piece(s) vs Queen + Minor Piece(s)',
      note: '例 95 图面还原 FEN；从 1...Qd3 到 19...f3 的完整实战线合并为一道题，正确 3.Bb3! 守和资源写入教学提示。'
    }),
    teaching: {
      principle: '看似必输的象兵残局也可能有几何防守；换后前不要只按物质判断，必须看清关键封锁和对方兵是否能突破。',
      method: '黑方 ...Qd3 主动换后看似简单赢，但白方本有 3.Bb3! 守和。实战 3.Kf2?? 后，黑方 ...Ba6、...Bc4、...g6、...Kf6-e7-e6-e5 逐步把王和象摆到理想格，再用 ...f5、...g5、...f4+ 和 ...f3 把白王逼离封锁点。',
      mistake: '黑方换后前没有认真看 3.Bb3!，白方实战又以为局面完全输掉而走 3.Kf2??。双方都说明：换后和轻子残局不能只靠物质判断。'
    },
    hints: ['黑方 ...Qd3 后先换后，但要知道白方正确资源是 3.Bb3!。', '实战 3.Kf2?? 让黑象顺利到 a6-c4。', '黑方赢法是先摆好王象，再用 ...f5、...g5 和 ...f4+ 打开通路。'],
    steps: lineSteps('f3d3 d4d3 c4d3 g1f2 b7a6 f2e3 a6c4 d1g4 g7g6 e3d4 g8g7 g4d1 g7f6 d1g4 f6e7 g4f3 e7e6 f3g4 f7f5 g4f3 g6g5 d4e3 e6e5 f3d1 f5f4 g3f4 g5f4 e3f3 c4b5 d1b3 b5e8 f3f2 e8h5 f2e1 e5e4 e1d2 f4f3', {
      0: '...Qd3 自动换后看似简单，但本身忽略了白方 3.Bb3! 的资源。',
      2: '实战 3.Kf2?? 让黑方进入理想赢法；正确是 3.Bb3!。',
      8: '...Ke6 后黑王靠近中心，白方封锁越来越困难。',
      18: '...f3 到达书中实战终点，黑方通路兵和王象决定胜负。'
    })
  }
];

const MCE_ANALYSIS_PATCHES = {
  'mce-capa-janowski-fix-weaknesses': { method: '先用 g4 固定黑方王翼，再用 b4/a4 限制后翼反击。后续白车和王反复换位，目标不是马上赢兵，而是让黑方车被迫防守两翼，最后 d4-e5-d5 把中心也变成突破点。' },
  'mce-capa-tartakower-king-walk': { method: 'Kg3-Kh4-Kg5-Kf6 把王送到进攻核心，同时允许黑车吃兵但无法解除后排压力。白车在七排限制黑王，白王亲自走到 c6 支援 d 兵，形成车和王共同护送的胜势。', mistake: '怕丢兵而把王留在原地，会让黑方车吃掉 c3 后获得实质反击。这个残局的关键是王的主动性比一个边兵更重要。' },
  'mce-reprintsev-grigoriants-active-defense': { method: '这里黑方更可靠的实战选择是先 ...a6，把白车从第七排的直接压力中赶开，再用 ...g5 和 ...h5 给白方制造计算压力。主动防守必须同时解决 a 兵和王翼空间，不能只制造表面活动。' },
  'mce-vanderwiel-ernst-sacrifice-for-seventh-rank': { method: 'Re5 允许黑车吃 f2，但白方随后 Ree7，双车压到七线，黑王和 h7 兵成为长期目标。白方用第七排连续制造威胁，黑车虽然多吃了兵，却无法同时守住王和后翼。' },
  'mce-rudyak-naroditsky-open-weaknesses': { method: '黑方先 ...b6，确保 ...c5 突破能打开 a2、c2 等多个目标，而不是只盯着 e2 一个点。双车一旦获得开放线，就能在两翼之间反复切换，让白方被动防守全部弱点。', mistake: '只按静态平衡看局面，会低估开线后双车攻击多个弱点的威力。防守方如果不提前阻止 ...c5，后续每个弱兵都会成为车的入口。' },
  'mce-varavin-ozolin-activate-rook': { method: 'Re1 让 f1 车活化，同时准备压 e5/c6；这比盲目吃兵更符合攻防平衡。白方先处理黑方车和 a 兵的反击，再让自己的车进入主动线，才能把多兵优势稳定下来。' },
  'mce-sahovic-kortchnoi-h5-break': { method: '...h5+ 逼白王来到 h5，随后 ...Rd8 把黑车快速调到 h 线，形成强制杀网。黑方先用兵突改变王位，再让双车占住开放线，节奏比普通调车快一拍。' },
  'mce-petrosian-larsen-switch-to-king-attack': { method: 'Rhh8 把车转到 h 线，随后 Rhf8+ 把黑王切离兵群，再用王进入 f5/g6。白方不再执着吃兵，而是利用黑王缺少车保护这一动态因素，把残局转成直接攻王。', mistake: '只围绕兵形思考，会错过黑王被困的动态弱点。少子残局里，攻王速度可能比多吃一个兵更重要。' },
  'mce-polgar-minev-safe-option': { mistake: '只看到多兵和通路兵，忽略黑方车活跃后的长防守资源。选择 Rxa7 这种安全方案后，白方仍然要逐步处理 ...Rd1+、...Rb1 和王翼反击。' },
  'mce-naroditsky-aliyev-forced-defense': { method: 'Rxa6 先消除 a 兵，随后 Rd6 和 Kg1 都是围绕防守 f6、d4 和王侧反击的强制应对。白方不能幻想马上反击，必须先把黑方最直接的升变和车将资源拆掉。' },
  'mce-lasker-levenfish-king-counterplay': { method: '白王先吃回 g4，再沿 g5-h6-g7 前进，迫使黑王走到 c6；这个王路为后面的 f5 反击创造条件。白方不是被动等和，而是用王主动制造远端通路兵。', mistake: '因为局面难看就机械防守，会错过对方刚刚给出的唯一动态机会。黑方结构一松，白王必须立刻从防守者转成进攻者。' },
  'mce-dvoirys-tseitlin-a-pawn-counterplay': { method: 'Rc3 先挡住 c 兵，再允许黑车吃 h2；关键是立刻 a4-a5-a6，把黑方逼进升变竞赛。白方把防守任务转移到远端 a 兵，让黑车不能只靠王翼兵取胜。' },
  'mce-kramnik-ivanchuk-patient-defense': { method: '黑方先 ...f5 固定王翼，再用 ...Kf8 继续等待。白方 d5 看似主动，但黑方没有提前给出弱点，车和王都保持在能应对白王入侵的位置。' },
  'mce-naroditsky-nip-fortress-patience': { principle: '劣势方如果能把所有弱点互相保护起来，就不要为了找反击破坏堡垒；这个局面要求先承认防守价值。', mistake: '急着 ...Re7 之类主动出击，会让白方吃 d5 并保留健康多兵。堡垒型防守最怕自己先制造第二个弱点。' },
  'mce-naroditsky-study-safe-not-enough': { principle: '有安全选择时，不能只问会不会输；还要问它是否放弃了赢棋机会，尤其在车兵残局里节奏很难再追回。', method: 'Rxb5 能保证不输但只能和；f6! 直接限制黑方通路兵和王，随后 Kg6-Kf7 逼黑车失去协调。白方必须比较方案上限，而不是满足于表面安全。', mistake: '把至少和棋误判为足够好，会错过更强的直接攻王方案。训练时要把安全线和争胜线分开评估。' },
  'mce-gutman-hertneck-simple-win': { method: '黑方直接 ...c2，让白车被迫回防，再用 ...d3 和 ...Rf2 接住 f 兵，胜势清楚。强方选择最少反击的推进顺序，能减少车将和远端兵带来的不确定性。' },
  'mce-naroditsky-study-safe-ra1': { method: 'Ra1 先挡 h 兵，随后白车被迫长期处理 h 兵和 c 兵。即便白方更好，胜负并不清楚；更强的选择应主动制造升变或攻王，而不是只堵住眼前威胁。', mistake: '只看到 h2 兵危险就机械防守，会错过更强的 b7 直接升变方案。残局里防守威胁和保留赢棋潜力要同时计算。' },
  'mce-rubinstein-reti-activity-over-pawns': { principle: '技术残局中，优势方有时要允许对方吃几个兵，换来王和车的最佳位置；活动性比静态物质更能决定长期结果。', method: 'f4! 先固定并制造 e 兵潜力，随后 Rxc3-Ra3-Rxa7，白王走到 e4/d3/e2，黑方弱兵无法全守。白方用王车主动性让每个黑兵都变成目标。', mistake: '机械保住王翼兵会让白车被动，黑方反而能用车和王接近防守。优势方必须愿意用兵换位置和节奏。' },
  'mce-shipman-naroditsky-create-second-weakness': { method: 'a4! 迫使 ...a6，随后 Rf6 和 a5 把黑王绑在 a6 上，再用 h4/g4 开始王翼计划。白方先制造第二弱点，让黑方车王无法只围绕一个防区组织。', mistake: '过早 Rxf7+ 看似自然，却把车放到较差位置，给黑方更多防守机会。没有第二弱点时，单一目标往往不够赢。' },
  'mce-karpov-hort-keep-pawns-on-board': { principle: '对弱点作战时，尽量保留更多兵。棋盘上目标越多，防守方越难同时守住，优势方也更容易制造等待招。', method: 'Ra3-Ra5 先限制 ...h5，再用 h4/g4/f4 扩张；白方不急于换兵，让 a7 和 e6 都长期难受。多目标压力最终迫使黑车和王分工失衡。', mistake: '过早换掉王翼兵会减少黑方防守任务，使车残局更接近理论和棋。强方要保留可制造弱点的兵。' },
  'mce-naroditsky-martinez-set-practical-hurdles': { method: '...Rb3! 不改变客观评价，但设置了侧面将军、h 兵和逼和资源；优势方若凭惯性推进，就可能被拖入防守资源。劣势方要选择最能迫使对手继续计算的防守方式。', mistake: '劣势方直接等待或认输式防守，会让强方按最简单路线把王带到王翼。实战防守必须制造最后的技术障碍。' },
  'mce-naroditsky-odondoo-free-the-pieces': { method: 'd4! 先打开白象和 e 线，哪怕黑方赢兵，白方也用 Rc1、Bb6-c7 和 c5-c6 让通路兵成为最强资产。防守方通过开线让全部子力参与，而不是继续被压制。' },
  'mce-shulman-sosa-restrict-bishop': { principle: '如果能把对手的象锁死，后续就是多一子进攻弱点；先限制，再收割，才不会让防守子重新活动。', mistake: '急着吃兵而没有先锁住黑象，会让黑方象重新活动，弱点反而难以同时攻击。优势方要先拿走对手的活动空间。' },
  'mce-horvath-gretarsson-maximize-pieces': { mistake: '疲于防守后随手被动等待，往往会让优势方顺利制造第二个通路兵。少兵方应优先最大化王、车、象的活动。' },
  'mce-sherzer-almasi-shelter-for-the-king': { principle: '后残局里王的避难所是第一资源；只要己王有安全路线，后和兵的反击才有现实意义。' }
};

function applyMceAnalysisPatches(lesson) {
  const patch = MCE_ANALYSIS_PATCHES[lesson.id];
  if (!patch) return lesson;
  return {
    ...lesson,
    teaching: {
      ...lesson.teaching,
      ...patch
    }
  };
}

const ALL_ENDGAME_LESSONS = [
  ...ENDGAME_EXPANSION_LESSONS
];

export function getEndgameCategories() {
  const activeCategoryIds = new Set(ALL_ENDGAME_LESSONS.map((lesson) => lesson.category));
  return ENDGAME_CATEGORIES
    .filter((category) => activeCategoryIds.has(category.id))
    .map((category) => ({ ...category }));
}

export function listEndgameLessons(categoryId = null) {
  const lessons = categoryId
    ? ALL_ENDGAME_LESSONS.filter((lesson) => lesson.category === categoryId)
    : ALL_ENDGAME_LESSONS;
  return lessons.map((lesson) => ({ ...lesson }));
}

export function getEndgameLesson(id) {
  return ALL_ENDGAME_LESSONS.find((lesson) => lesson.id === id) || null;
}

export function createEndgameSession(lessonId) {
  const lesson = getEndgameLesson(lessonId) || ALL_ENDGAME_LESSONS[0];
  const currentFen = lesson.fen;
  return {
    lesson,
    currentFen,
    stepIndex: 0,
    expectedMove: lesson.steps[0]?.move || null,
    completed: lesson.steps.length === 0
  };
}

export function advanceEndgameStep(session, uci) {
  const lesson = session.lesson;
  const step = lesson.steps[session.stepIndex];

  if (!step) {
    return {
      ok: false,
      expectedMove: null,
      session
    };
  }

  if (uci !== step.move) {
    return {
      ok: false,
      expectedMove: step.move,
      session
    };
  }

  const played = playLegalUciMove(session.currentFen, step.move);
  let currentFen = played.nextFen;
  let reply = null;

  if (step.reply) {
    reply = playLegalUciMove(currentFen, step.reply);
    currentFen = reply.nextFen;
  }

  const stepIndex = session.stepIndex + 1;
  const completed = stepIndex >= lesson.steps.length;
  const nextSession = {
    lesson,
    currentFen,
    stepIndex,
    expectedMove: completed ? null : lesson.steps[stepIndex].move,
    completed
  };

  return {
    ok: true,
    expectedMove: nextSession.expectedMove,
    session: nextSession,
    played,
    reply,
    note: step.note || ''
  };
}
