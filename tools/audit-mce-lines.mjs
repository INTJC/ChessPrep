import { playLegalUciMove } from '../app.js';
import { getEndgameLesson } from '../endgames.js';

const lessonLines = {
  'mce-reprintsev-grigoriants-active-defense': [
    'a6', 'Rc1', 'g5', 'Rcc7', 'h5', 'b4', 'e5', 'a4', 'g4', 'b5', 'axb5',
    'axb5', 'Rf6'
  ],
  'mce-capa-janowski-fix-weaknesses': [
    'g4', 'b6', 'b4', 'Kb7', 'Kf2', 'b5', 'a4', 'Rd4', 'Rb1', 'Re5',
    'Ke3', 'Rd7', 'a5', 'Re6', 'Rbf1', 'Rde7', 'g5', 'fxg5', 'Rxg5',
    'Rh6', 'Rg3', 'Rhe6', 'h4', 'g6', 'Rg5', 'h6', 'Rg4', 'Rg7', 'd4',
    'Kc8', 'Rf8+', 'Kb7', 'e5', 'g5', 'Ke4', 'Ree7', 'hxg5', 'hxg5',
    'Rf5', 'Kc8', 'Rgxg5', 'Rh7', 'Rh5', 'Kd7', 'Rxh7', 'Rxh7', 'Rf8',
    'Rh4+', 'Kd3', 'Rh3+', 'Kd2', 'c5', 'bxc5', 'Ra3', 'd5'
  ],
  'mce-vanderwiel-ernst-sacrifice-for-seventh-rank': [
    'Re5', 'Rxf2', 'Ree7', 'Rxg2', 'Rg7+', 'Kh8', 'Rxh7+', 'Kg8', 'h4',
    'Rg4', 'Rdg7+', 'Kf8', 'Rb7', 'Kg8', 'Rbg7+', 'Kf8', 'h5', 'Rh4',
    'Rxg6', 'Re8', 'h6', 'Re5', 'Rc6', 'Rb5+', 'Kc2', 'Rh2+', 'Kd3',
    'Rc5', 'Rxc5', 'bxc5', 'Rxa7', 'Rxh6', 'Kc4'
  ],
  'mce-rudyak-naroditsky-open-weaknesses': [
    'b6', 'Kd2', 'c5', 'bxc5', 'bxc5', 'dxc5', 'Rxc5', 'Rb1', 'Rfc4',
    'c3', 'Ra5', 'Rb7', 'Rxa2+', 'Ke1', 'Rc2', 'Re3', 'Rc6', 'Rxa7',
    'R2xc3', 'Re5', 'Kf8', 'h4', 'R3c4', 'Rg5', 'Rc7', 'Ra8+', 'Kf7',
    'h5', 'h6', 'Re5', 'Rh4', 'Ra6', 'Re7', 'e3', 'Rh2', 'Kf1', 'Rb7',
    'Kg1', 'Rc2', 'Ra1', 'Kf6', 'f4', 'Rb3', 'Re1', 'Rbb2', 'e4', 'd4',
    'Rd1', 'd3', 'Ra5', 'Re2', 'e5+', 'Kf5', 'Ra3', 'd2', 'Kf1',
    'Re4', 'Rg3', 'Rxf4+', 'Ke2', 'Re4+', 'Kf1', 'Rg4'
  ],
  'mce-varavin-ozolin-activate-rook': [
    'Re1', 'Rb5', 'Ree2', 'Rab8', 'b3', 'a5', 'h3', 'R8b6', 'Re4',
    'Rb4', 'Rxe5', 'a4', 'bxa4', 'Rxa4', 'Re7', 'Rd4', 'Ra7', 'h6',
    'a4', 'Rb1+', 'Kh2', 'Ra1', 'a5', 'Rd5', 'a6', 'c5', 'Re2', 'Rd6',
    'Ree7', 'Rg6', 'h4', 'c4', 'h5', 'Rg5', 'f4', 'Rxh5+', 'Kg3',
    'Ra3+', 'Kg4', 'Rh2', 'Rxg7+', 'Kh8', 'Rg6', 'Rxg2+', 'Kf5',
    'Rxg6', 'Kxg6', 'Rg3+', 'Kxh6', 'Rh3+', 'Kg6', 'Rg3+', 'Kf6',
    'Ra3', 'Kg6', 'Rg3+', 'Kf5', 'Ra3', 'Ke4', 'Kg8', 'f5', 'Kf8', 'Kd4', 'c3',
    'Kd3', 'Ra5', 'Kxc3', 'Rc5+', 'Kb4', 'Rc6', 'Kb5', 'Rf6', 'Rc7',
    'Rxf5+', 'Kb6', 'Rf1', 'a7', 'Rb1+', 'Kc6', 'Rc1+', 'Kb7', 'Rb1+',
    'Kc8', 'Ra1', 'Kb8', 'Rb1+', 'Rb7'
  ],
  'mce-sahovic-kortchnoi-h5-break': [
    'h5+', 'Kxh5', 'Rd8', 'hxg5+', 'Kf5', 'Kh6', 'Rh3+', 'Kg7',
    'Rd7+', 'Kg8', 'Kg6', 'Rf2', 'Rg7+', 'Kf8', 'Rh8#'
  ],
  'mce-petrosian-larsen-switch-to-king-attack': [
    'Rhh8', 'Rb7', 'Rhf8+', 'Ke7', 'Kf5', 'R2b3', 'g4', 'Rg3', 'Rde8+',
    'Kd6', 'g5', 'fxg5', 'hxg5', 'Rb5+'
  ],
  'mce-polgar-minev-safe-option': [
    'Rxa7', 'Rd8', 'Rc2', 'Rd1+', 'Kg2', 'Rfd5', 'Re2', 'Rb1', 'Re7',
    'Rd4', 'Kf2', 'Kg8', 'Ke3', 'Rd3+', 'Kxe4', 'Rb3', 'Ra7', 'R1xb2',
    'Rxb2', 'Rxb2', 'h4', 'Rg2', 'Kf3', 'Rc2', 'Re7', 'Ra2', 'Re3',
    'Kf7', 'Ke4', 'Ke6', 'Kd4+', 'Kd6', 'Kc4', 'Ra1', 'Kb4', 'Rb1+',
    'Rb3', 'Rf1', 'Kb5', 'Rf8', 'a4', 'Rb8+', 'Kc4', 'Rc8+', 'Kd4',
    'Ra8', 'Ra3', 'Ra5', 'Kc4', 'Kc6', 'Kb4', 'Re5', 'Rc3+', 'Kb6',
    'g4', 'g6', 'Rc4', 'Re1', 'Rf4', 'Rb1+', 'Kc4', 'Ka5', 'Kd5', 'Rh1'
  ],
  'mce-naroditsky-study-safe-not-enough': [
    'f6', 'Rf8', 'Kg6', 'Rg8+', 'Kf7', 'Rxg2', 'Rxb5'
  ],
  'mce-rubinstein-reti-activity-over-pawns': [
    'f4', 'Rxg2', 'Rxc3', 'Kd7', 'Ra3', 'Ke6', 'Rxa7', 'h5', 'h4',
    'Rg4', 'Kd4', 'g6', 'Rg7', 'Rg1', 'Ke4', 'Rg2', 'Rc7', 'Rc2',
    'Kd3', 'Rc1', 'e4', 'Rd1+', 'Ke2', 'Rc1', 'Kd2', 'Rc4', 'Kd3',
    'Rc1', 'Rg7', 'Rd1+', 'Ke3', 'Re1+', 'Kd4', 'Rd1+', 'Kc5', 'Rc1+',
    'Kb6', 'c5', 'Rxg6+', 'Ke7', 'f5', 'Re1', 'Kc6', 'Rxe4', 'Kd5',
    'Rxh4', 'Rg7+', 'Kf8', 'f6', 'Rf4', 'Ke6', 'Ra4', 'Rc7', 'Ra6+',
    'Kf5', 'h4', 'Rc8+', 'Kf7', 'e6+'
  ],
  'mce-shipman-naroditsky-create-second-weakness': [
    'a4', 'a6', 'Rf6', 'Kb7', 'a5', 'Rd7', 'Ke1', 'Re7+', 'Kd2',
    'Ka7', 'h4', 'Kb7', 'g4', 'Re4', 'Rxf7+', 'Kb8', 'h5', 'gxh5',
    'gxh5', 'Rh4', 'Rh7', 'Rh2+', 'Kc1', 'Rh1+', 'Kc2', 'Ka8', 'h6',
    'Kb8', 'Kd2', 'Rh3', 'Ke2', 'Ka8', 'Kf2', 'Kb8', 'Kg2', 'Rh5',
    'Kg3', 'Ka8', 'Kg4', 'Rh2', 'Kg5', 'Rg2+', 'Kf5', 'Kb8', 'Rg7',
    'Rf2+', 'Ke6', 'Re2+', 'Kd5', 'Rd2+', 'Kc5', 'Rh2', 'h7'
  ],
  'mce-karpov-hort-keep-pawns-on-board': [
    'Ra3', 'Re7', 'Ra5', 'Kf7', 'h4', 'h6', 'g4', 'Kf6', 'f4', 'Rb7',
    'Kf3', 'Rc7', 'Ra6', 'g6', 'Ra5', 'Rd7', 'e3', 'Rb7', 'h5', 'g5',
    'Ra6', 'gxf4', 'exf4', 'Rb3+', 'Kg2', 'Rb7', 'Kg3', 'Kf7', 'Ra4',
    'Kg7', 'g5', 'Rc7', 'Ra5', 'Kg8', 'Rb5', 'Kf7', 'Kg4', 'a6',
    'Rb8', 'Rc1', 'g6+', 'Kg7', 'Rb7+', 'Kf8', 'Rb6', 'Rg1+', 'Kf3',
    'Rf1+', 'Ke4', 'Re1+', 'Kd4', 'Ke7', 'Rxa6', 'Kf6', 'Ra7', 'e5+',
    'fxe5+', 'Rxe5', 'Ra6+'
  ],
  'mce-naroditsky-martinez-set-practical-hurdles': [
    'Rb3', 'f5+', 'Kh7', 'h4', 'Rb5', 'Ke3', 'Rb4', 'g4', 'Rb3+',
    'Ke2', 'Rb2+', 'Ke3', 'Rb3+', 'Kd2', 'hxg4', 'Ke2', 'Rb5', 'h5',
    'g3', 'h6', 'g2', 'Kf2', 'Rxf5+', 'Kxg2', 'Rb5', 'hxg7', 'Kxg7',
    'Kf3', 'Rb3+', 'Ke4', 'Rb4+', 'Kd5', 'Rb1', 'Kc4', 'Rc1+', 'Kb3',
    'Rb1+', 'Ka3', 'Kh7', 'Ka2', 'Rb6', 'Rc8', 'Rxb7'
  ],
  'mce-young-galofre-dont-celebrate-early': [
    'Rh6+', 'Ke7', 'Rb6', 'Rc3', 'Ke2', 'Ra3', 'Rb5', 'Ke6', 'Rb6+',
    'Ke7', 'f5', 'Rc3', 'Re6+', 'Kf7', 'Re5', 'Rc5', 'e4', 'Rc4',
    'exd5', 'Kf6', 'Kd3', 'Ra4', 'Re4', 'Ra3+', 'Kd4', 'Kxf5',
    'Re1', 'Ra2', 'd6', 'Rd2+', 'Kc5', 'Kf6', 'Kc6', 'Rc2+', 'Kd7',
    'Kf7', 'Rf1+', 'Kg7', 'Kd8', 'Rc3', 'd7', 'Rc4', 'Rf2', 'Kg8',
    'Rf5', 'Kg7', 'Ke7'
  ],
  'mce-naroditsky-odondoo-free-the-pieces': [
    'd4', 'exd4', 'Bxd4', 'Rb4', 'Rc1', 'Be4', 'Rc3', 'Bxf5', 'Bb6',
    'Bd7', 'c5', 'Bc6', 'Rd3', 'Bb5', 'Rd8+', 'Kf7', 'Rc8', 'Rc4',
    'Rc7+', 'Kg6', 'Re7', 'Rg4+', 'Kf2', 'Kf5', 'h3', 'Rf4+', 'Kg3',
    'g5', 'Bc7', 'Rc4', 'Bd6', 'h5', 'Rb7', 'h4+', 'Kf2', 'Rc2+',
    'Ke3', 'Rc3+', 'Kd2', 'Rd3+', 'Kc2', 'Rxh3', 'Rxb5', 'axb5',
    'c6', 'Ke6', 'Bb4', 'Rh2+', 'Kb3', 'Re2', 'a6', 'Kd5', 'c7',
    'Re8', 'Be7', 'Rc8', 'Bxf6', 'h3'
  ],
  'mce-lowe-deacon-quiet-practical-pressure': [
    'Kg5', 'Rxa2', 'Kxh5', 'Rg2', 'Rb8', 'Rg1', 'Kh6', 'a5', 'Ra8',
    'Ra1', 'Ra7+', 'Ke8', 'h5', 'c5', 'Kh7', 'Bd7', 'h6', 'Ba4',
    'Kg8', 'Bc2', 'dxc5', 'Rh1', 'Bg7', 'e5', 'c6', 'Bf5', 'Rxa5',
    'Be6+', 'Kh8', 'e4', 'Ra8+', 'Kf7', 'Rf8+', 'Ke7', 'Rf2', 'Kd6',
    'Bf8+', 'Kxc6', 'Rf6', 'Kd7', 'Bc5', 'Rh3', 'h7', 'Rg3', 'Bf2',
    'Rg2', 'Rf8', 'Kc7', 'Bd4', 'Rg5', 'Rf1', 'Rg6', 'Rg1', 'Rxg1',
    'Bxg1', 'Bf5', 'Kg7', 'Bxh7', 'Kxh7', 'Kc6', 'Kg6', 'Kb5'
  ],
  'mce-muller-heinemann-multi-step-plan': [
    'Rc3', 'Rf8+', 'Ke2', 'Bd4', 'Rc7+', 'Rf7', 'Rc6', 'Rb7', 'Bc4',
    'e5', 'Kd3', 'Kh6', 'Rd6', 'Bf2', 'Rd5', 'Re7', 'Rd8', 'Rb7',
    'Ke2', 'Ba7', 'Rd5', 'Re7', 'Rd6', 'Rb7', 'Ra6', 'Bd4', 'Rd6',
    'Ba7', 'g3', 'Kg5', 'Kf3', 'Kh6', 'h4', 'Kh5', 'Kg2', 'Bc5',
    'Rc6', 'Bd4', 'Kh3', 'Kh6', 'g4', 'Kg7', 'g5', 'Be3', 'Bd5',
    'Rb8', 'Rc7+', 'Kh8', 'Bc6', 'Rf8', 'Re7', 'Bd4', 'Bd5', 'Rf3+',
    'Kg2', 'Rf2+', 'Kg3', 'h6', 'gxh6', 'Rf4', 'Re6', 'Kh7', 'b6',
    'Rf8', 'b7', 'Ba7', 'h5', 'gxh5', 'Kh4', 'Rf1', 'Kxh5', 'Rg1',
    'Re7+', 'Kh8', 'Rxe5'
  ],
  'mce-yermolinsky-naroditsky-create-winning-chances': [
    'g5', 'Rf7', 'Kc4', 'Rg7', 'g6', 'Kf6', 'Rh8', 'Ra7', 'Rc8',
    'Ra4+', 'Kb5', 'Ra7', 'Rc6+', 'Kg7', 'Kc4', 'Be3', 'Kd5', 'Bf4',
    'Ke6', 'Rb7', 'Rd6', 'Rc7', 'Ra6', 'Kh6', 'Kf6', 'Bg5+', 'Kxe5',
    'Kg7', 'f4', 'Bh4', 'Bd5'
  ],
  'mce-ziatdinov-homs-passer-can-be-weak': [
    'd3', 'Bb2', 'c4', 'cxd3', 'cxd3', 'Rd1', 'Rd5', 'Bc3', 'Bh6',
    'Kb2', 'Ke7', 'Kb3', 'Kd6', 'a4', 'Kc5', 'Bb4+', 'Kd4', 'Bc3+',
    'Kc5', 'Bb2', 'Bf4', 'h3', 'Rd7', 'Kc3', 'e4', 'Ba3+', 'Kd5',
    'fxe4+', 'Kxe4', 'Bc5', 'Rc7', 'Kb4', 'd2', 'a5', 'Kd3', 'a6',
    'Ke2', 'Rb1', 'd1=Q', 'Rxd1', 'Kxd1', 'a7', 'Rc8', 'Kb5', 'Ke2',
    'Kb6', 'Kf3', 'Kb7', 'Rg8', 'a8=Q', 'Rxa8', 'Kxa8', 'h5', 'Kb7',
    'Kg2', 'h4', 'Kh3', 'Be7', 'Kg2', 'Bc5', 'Kh3', 'Kc6', 'Kxh4',
    'Kd5', 'Kg4', 'Be7', 'h4'
  ],
  'mce-geske-zilka-create-weaknesses': [
    'a3', 'bxa3', 'Bxa3', 'Bd6', 'c3', 'Rd1', 'Bxd6', 'Rxd6', 'Rh2+',
    'Kd1', 'Rh1+', 'Ke2', 'Rh2+', 'Kd1', 'Kc7', 'Rd3', 'b4', 'Rd4',
    'c5', 'Rd5', 'Kc6', 'g5', 'Kb5', 'f4', 'Kc4', 'g6', 'Rh1+',
    'Ke2', 'Rc1', 'Rd7', 'Rxc2+', 'Kd1', 'Rg2', 'Rxg7', 'c2+'
  ],
  'mce-rozentalis-glek-simple-restriction-plan': [
    'c4', 'Rc6', 'Rd5', 'Be7', 'Bf4', 'Kf7', 'Kd3', 'Ke6', 'Be3',
    'Rc8', 'f4', 'Bd6', 'f5+', 'Ke7', 'b3', 'a5', 'a4', 'Rc6', 'Ke4',
    'Rc8', 'Bf2', 'Rc6', 'Rd3', 'Bc7', 'Rf3', 'Bb6', 'Bg3', 'Ba7',
    'Kd5', 'Kd7', 'Re3', 'Rb6', 'Bf4', 'Rb7', 'Bd6', 'Kd8', 'Rd3',
    'Kd7', 'Bxc5', 'Bxc5', 'Kxc5+', 'Kc7', 'Re3', 'Kd7', 'Kd4',
    'Rb8', 'Kc3', 'g6', 'Rd3+', 'Kc7', 'fxg6', 'Rg8', 'Rd5', 'Rxg6',
    'Rxa5', 'Rxg4', 'Rf5', 'Rxg6', 'a5', 'Kd6', 'a6'
  ],
  'mce-danielsen-hillarp-activate-before-defending': [
    'Rd7', 'Bxb3', 'Bd5', 'a5', 'Rxf7+', 'Kh6', 'Ra7', 'a4', 'Kf2',
    'Rc8', 'Be6', 'Rc5', 'Ke3', 'Bxc4', 'Kd4', 'Bxe6', 'Kxc5',
    'Bxh3', 'Kd4', 'Bf5', 'Rxa4', 'Kh5', 'Ra1', 'Kg4', 'Ke3', 'Be6',
    'Ke4', 'Bf5+', 'Ke5', 'Kf3', 'Rc1', 'Kg3', 'Rg1+', 'Kf3', 'Ra1',
    'Kg3', 'Ra3+', 'Kg4', 'Ra4', 'Bc2', 'Rb4', 'Bf5', 'Kf6', 'Kh4',
    'Rb5'
  ],
  'mce-vaisser-tseitlin-centralize-before-trading': [
    'Rg8', 'Bg3', 'Ke8', 'Kf3', 'Kd7', 'Rc4', 'Rc8', 'e5', 'fxe5',
    'Rh4', 'Bd4', 'Rxh7', 'Rc3+', 'Kg4', 'Kd6', 'h4', 'Rc8', 'h5',
    'Rg8+', 'Kh4', 'Kxd5', 'Rxe7', 'Ke4', 'f6', 'Kf3', 'f7', 'Rg4+',
    'Kh3', 'Rxg3+', 'Kh2', 'Rg2+'
  ],
  'mce-horvath-gretarsson-maximize-pieces': [
    'Kf5', 'b5', 'Bd6', 'a4', 'Rc2', 'Be3', 'Ra2', 'Rd4', 'g5',
    'h4', 'Bc5', 'Re4', 'Bxe3', 'Rxe3', 'Rxa4', 'Rd3', 'Rc4', 'd6',
    'Rc8', 'hxg5', 'Rd8', 'f4', 'Kxf4', 'Rf3+', 'Kxg5', 'Rxf7',
    'Rxd6', 'Rxh7', 'Rd5'
  ],
  'mce-dus-chotimirsky-rabinovich-active-long-defense': [
    'f4', 'Re8', 'Kg1', 'Kf8', 'h4', 'h6', 'Kf2', 'Bd7', 'Rg1', 'f5',
    'a4', 'Kf7', 'b4', 'Kf6', 'Kf3', 'Rg8', 'c4', 'Be6', 'c5', 'Bf7',
    'b5', 'Bh5+', 'Kf2', 'Re8', 'Rb1', 'Re7', 'b6', 'a5', 'Re1',
    'Rd7', 'Re5', 'Bg4', 'Re8', 'g5', 'fxg5+', 'hxg5', 'hxg5+',
    'Kxg5', 'Rc8', 'Rh7', 'Rc7', 'Rxc7', 'bxc7', 'f4', 'Be2', 'Bc8',
    'Bf3', 'Kf6', 'Bg2', 'Ke7', 'Kf3', 'Kd7', 'Kxf4', 'Kxc7', 'Ke5',
    'Bg4', 'Kf4', 'Bd1', 'Ke3', 'Bxa4', 'Kd2', 'Bb5', 'Kc3', 'b6',
    'cxb6+', 'Kxb6', 'Kb2', 'Bc4', 'Ka3', 'c5', 'dxc5+', 'Kxc5',
    'Bd5'
  ],
  'mce-rensch-naroditsky-respect-rook-knight': [
    'Bb4+', 'Kc1', 'Bc3', 'h5', 'b5', 'hxg6', 'hxg6', 'Rh7+', 'Kb6',
    'Rg7', 'b4', 'Rxg6+', 'Kb5', 'Rg8', 'b3', 'Rb8+', 'Ka6', 'Na1',
    'Re2', 'Nxb3', 'Rxe3', 'Kc2', 'Rg3', 'Rd8', 'Bb4', 'Rxd5',
    'Rg2+', 'Kd1', 'Rg1+', 'Ke2', 'Re1+', 'Kf2', 'e3+', 'Kf3', 'Bd2',
    'Rxf5', 'Rf1+', 'Ke2', 'Rf2+', 'Kd3'
  ],
  'mce-karpov-debarnot-create-g6-weakness': [
    'f5', 'Ke5', 'fxg6', 'fxg6', 'Rb4', 'Re1', 'Bd3', 'Kf6', 'Rf4+',
    'Kg7', 'Kf3', 'Re5', 'Rb4', 'Re7', 'Rb5', 'Rc7', 'Ke3', 'Kf6',
    'Kd4', 'g5', 'hxg5+', 'hxg5', 'Ra5', 'Ke6', 'b3', 'Kf6', 'Ra1',
    'Nd7', 'Ra5', 'Nb6', 'g4', 'Ke6', 'c4', 'dxc4', 'bxc4', 'Rd7+',
    'Kc3', 'Rg7', 'Bf5+', 'Kf6', 'Kd4', 'Re7', 'c5', 'Re5', 'Be4',
    'Nd7', 'Ra6+', 'Re6', 'Rxe6+', 'Kxe6', 'Bf5+', 'Ke7', 'c6'
  ],
  'mce-sandberg-naroditsky-bind-knight-to-weakness': [
    'g4', 'Kc2', 'Bg5', 'Re2', 'Bf4', 'Nf1', 'Rh1', 'Nd2', 'Rg1',
    'a4', 'g3', 'Nf3', 'Rf1', 'Nd2', 'Ra1', 'Kb3', 'Bxd2', 'Rxd2',
    'f5', 'Re2', 'f4', 'Kb4', 'Rf1', 'Kc3', 'Rf2', 'Kd3', 'f3',
    'Re1', 'Rxg2', 'Rf1', 'f2', 'Ke2', 'Rg1', 'b4', 'Kb6', 'b5',
    'Kc5'
  ],
  'mce-karpov-kramnik-restrict-before-converting': [
    'g3', 'Rd7', 'Re2', 'Kg7', 'Nh4', 'Rd5', 'Re7', 'Rc5', 'Rd7',
    'b5', 'b4', 'Rc2', 'Nf5+', 'Kg6', 'Ne3', 'Rc1+', 'Kg2', 'Be5',
    'Ra7', 'Rc6', 'Nd5', 'Bd6', 'a3', 'Kf5', 'Ne3+', 'Kg6', 'Kf3',
    'Be5', 'Nd5', 'Kg7', 'Ne7', 'Rc3+', 'Kg4', 'Rxa3', 'f4', 'Bc3',
    'Kh5', 'Bxb4', 'Nf5+', 'Kg8', 'Ra8+', 'Kh7', 'Ra7', 'Kg8',
    'Nxh6+', 'Kf8', 'Rxf7+', 'Ke8', 'Kg6', 'Bc3', 'Nf5', 'b4',
    'Rb7', 'Ra2', 'h4', 'a5', 'h5', 'a4', 'h6', 'Rh2', 'h7', 'Kd8',
    'Nh4', 'f5', 'Rxb4', 'Rh3', 'Rxa4', 'Rxg3+', 'Kxf5'
  ],
  'mce-naroditsky-aliyev-forced-defense': [
    'Rxa6', 'Rxb4', 'Rd6', 'Rb2+', 'Kg1', 'Rd2', 'h3', 'h5', 'Kf1',
    'g5', 'Kg1', 'Re2', 'Kh1', 'Rf2', 'Kg1', 'Rf3', 'Kg2', 'Ra3',
    'g4+', 'hxg4', 'hxg4+', 'Kxg4', 'Rxf6', 'Rd3', 'Ra6', 'Rd2+',
    'Kg1', 'Rxd4', 'Ra3', 'Kf4', 'Rb3', 'Ra4', 'Rc3'
  ],
  'mce-lasker-levenfish-king-counterplay': [
    'Kxg4', 'Ke7', 'Kg5', 'Ra7', 'Kh6', 'Kd7', 'Kg7', 'Kc6', 'f5',
    'exf5', 'e6', 'fxe6+', 'Kxg6', 'Kb5', 'Ra1', 'a4', 'h5', 'Ra8',
    'h6', 'a3', 'Ra2'
  ],
  'mce-dvoirys-tseitlin-a-pawn-counterplay': [
    'Rc3', 'Rxh2', 'a4', 'Kxf5', 'a5', 'Kg4', 'a6', 'Rg2', 'a7',
    'c1=Q', 'Rxc1', 'Ra2', 'Rc4+'
  ],
  'mce-kramnik-ivanchuk-patient-defense': [
    'f5', 'd5', 'Kf8', 'dxe6', 'fxe6', 'Kd4', 'Ke7', 'Ke5', 'Ra4',
    'f3', 'Ra5+', 'Kf4', 'Ra2', 'Rb1', 'Kf6', 'Kg3', 'Re2', 'Rb3',
    'e5', 'Rb6+', 'Kg7', 'Rb3', 'Kf6', 'Ra3', 'Kg6', 'Kh3', 'Kf6',
    'g4', 'hxg4+', 'fxg4', 'fxg4+', 'Kxg4', 'Kg6', 'h5+', 'Kh6',
    'Ra6+', 'Kh7', 'Ra3', 'Kh6', 'Kf5', 'e4', 'Kxe4', 'Kxh5',
    'Kf5', 'Rf2+', 'Ke6', 'Re2', 'Kf5', 'Rf2+', 'Ke5', 'Kg6',
    'e4', 'Rb2', 'Ra7', 'Rb5+', 'Ke6', 'Rb6+', 'Ke7', 'Rb5',
    'Ra6+', 'Kg5', 'Re6', 'Kf4', 'Kf6', 'Rh5'
  ],
  'mce-naroditsky-nip-fortress-patience': [
    'Ke6', 'Rd1', 'Rf7', 'Re1+', 'Kd6', 'Re8', 'Rf6', 'b3', 'Kd7',
    'Re3', 'Kd6', 'a3', 'Kc5', 'Re8', 'Kd6', 'Rg8', 'Ke7', 'Rc8',
    'Kd7', 'Rc5', 'Kd6', 'b4', 'Rf8'
  ],
  'mce-naroditsky-study-safe-ra1': [
    'Ra1', 'Rb8', 'Rb1', 'Rb7+', 'Ke6', 'Kg8', 'Kd6', 'h1=Q', 'Rxh1',
    'Rxb6+', 'Kc5', 'Rxg6', 'Kxc4', 'Kf7'
  ],
  'mce-capa-tartakower-king-walk': [
    'Kg3', 'Rxc3+', 'Kh4', 'Rf3', 'g6', 'Rxf4+', 'Kg5', 'Re4', 'Kf6',
    'Kg8', 'Rg7+', 'Kh8', 'Rxc7', 'Re8', 'Kxf5', 'Re4', 'Kf6', 'Rf4+',
    'Ke5', 'Rg4', 'g7+', 'Rxg7', 'Rxa7', 'Rg1', 'Kxd5', 'Rc1', 'Kd6',
    'Rc2', 'd5', 'Rc1', 'Rc7', 'Ra1', 'Kc6', 'Rxa4', 'd6'
  ]
};

function normalizeSan(san) {
  return String(san)
    .replace(/[!?]+/g, '')
    .replace(/[+#]+$/g, '')
    .replace(/^0/g, 'O')
    .replace(/=([QRBN])$/, '$1');
}

function parseSanForMatch(san) {
  const normalized = normalizeSan(san);
  if (normalized === 'O-O' || normalized === 'O-O-O') {
    return { castle: normalized };
  }
  const promotionMatch = normalized.match(/([QRBN])$/);
  const promotion = promotionMatch ? promotionMatch[1].toLowerCase() : null;
  const withoutPromotion = promotion ? normalized.slice(0, -1) : normalized;
  const target = withoutPromotion.match(/([a-h][1-8])$/)?.[1];
  if (!target) throw new Error(`Cannot parse SAN ${san}`);
  const prefix = withoutPromotion.slice(0, -2).replace('x', '');
  const piece = /^[KQRBN]/.test(prefix) ? prefix[0] : 'P';
  const sourceHint = piece === 'P' ? prefix : prefix.slice(1);
  return { piece, target, promotion, sourceHint };
}

function candidateMatchesSan(result, san) {
  const parsed = parseSanForMatch(san);
  if (parsed.castle) return normalizeSan(result.move.san) === parsed.castle;
  if (normalizeSan(result.move.san) === normalizeSan(san)) return true;

  const piece = result.move.piece.toUpperCase();
  const target = result.move.to;
  const promotion = result.move.promotion;
  if (piece !== parsed.piece) return false;
  if (target !== parsed.target) return false;
  if ((promotion || null) !== (parsed.promotion || null)) return false;
  if (!parsed.sourceHint) return true;
  return parsed.sourceHint.split('').every((hint) => result.move.from.includes(hint));
}

function colorOf(piece) {
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function parseFenPieces(fen) {
  const [placement, turn] = String(fen).split(/\s+/);
  const pieces = [];
  const ranks = placement.split('/');
  for (let rankIndex = 0; rankIndex < ranks.length; rankIndex += 1) {
    let fileIndex = 0;
    for (const char of ranks[rankIndex]) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
        continue;
      }
      pieces.push({
        piece: char,
        color: colorOf(char),
        square: `${'abcdefgh'[fileIndex]}${8 - rankIndex}`
      });
      fileIndex += 1;
    }
  }
  return { turn, pieces };
}

function buildCandidateUcis(fen, san) {
  const parsed = parseSanForMatch(san);
  const { turn, pieces } = parseFenPieces(fen);
  if (parsed.castle === 'O-O') return turn === 'w' ? ['e1g1'] : ['e8g8'];
  if (parsed.castle === 'O-O-O') return turn === 'w' ? ['e1c1'] : ['e8c8'];
  return pieces
    .filter((piece) => piece.color === turn)
    .filter((piece) => piece.piece.toUpperCase() === parsed.piece)
    .filter((piece) => !parsed.sourceHint || parsed.sourceHint.split('').every((hint) => piece.square.includes(hint)))
    .map((piece) => `${piece.square}${parsed.target}${parsed.promotion || ''}`);
}

for (const [id, sanLine] of Object.entries(lessonLines)) {
  const lesson = getEndgameLesson(id);
  if (!lesson) throw new Error(`Unknown lesson ${id}`);
  let fen = lesson.fen;
  const uci = [];
  const generatedSan = [];
  for (const san of sanLine) {
    const legal = [];
    for (const candidate of buildCandidateUcis(fen, san)) {
      try {
        const result = playLegalUciMove(fen, candidate);
        if (candidateMatchesSan(result, san)) {
          legal.push(result);
        }
      } catch {
        // Ignore illegal candidates.
      }
    }
    if (legal.length !== 1) {
      throw new Error(`${id}: ${san} matched ${legal.length} moves from ${fen}: ${legal.map((m) => m.move.uci).join(', ')}`);
    }
    uci.push(legal[0].move.uci);
    generatedSan.push(legal[0].move.san);
    fen = legal[0].nextFen;
  }
  console.log(`\n${id}`);
  console.log(`SAN ${generatedSan.join(' ')}`);
  console.log(`UCI ${uci.join(' ')}`);
  console.log(`END ${fen}`);
}
