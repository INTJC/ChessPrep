export const ENGINE_PROFILES = [
  {
    id: 'stockfish-strong',
    label: 'Stockfish 强引擎',
    mode: 'stockfish',
    estimatedElo: 3500,
    depth: 16,
    multipv: 1,
    skillLevel: 20,
    searchMoveTimeMs: 1800,
    toleranceCp: 0,
    description: '最强招优先，用来检验准备是否经得住引擎。'
  },
  {
    id: 'human-2200',
    label: '拟人 2200',
    mode: 'maia3',
    estimatedElo: 2200,
    calibratedElo: 2400,
    depth: 13,
    multipv: 5,
    skillLevel: 15,
    searchMoveTimeMs: 3000,
    toleranceCp: 35,
    maiaTemperature: 0.7,
    maiaTopP: 0.65,
    qualityFilter: {
      maxLossCp: 35,
      fallbackRank: 2
    },
    description: '高水平拟人采样，并用更长搜索过滤明显坏棋。'
  },
  {
    id: 'human-2400',
    label: '拟人 2400',
    mode: 'maia3',
    estimatedElo: 2400,
    calibratedElo: 2600,
    depth: 15,
    multipv: 5,
    skillLevel: 18,
    searchMoveTimeMs: 4200,
    toleranceCp: 18,
    maiaTemperature: 0.22,
    maiaTopP: 0.35,
    qualityFilter: {
      maxLossCp: 18,
      fallbackRank: 1
    },
    description: '更偏强招的拟人档，开局优先实战常见且不过度掉分的选择。'
  },
  {
    id: 'human-2600',
    label: '拟人 2600',
    mode: 'maia3',
    estimatedElo: 2600,
    calibratedElo: 2800,
    depth: 17,
    multipv: 4,
    skillLevel: 20,
    searchMoveTimeMs: 6000,
    toleranceCp: 8,
    maiaTemperature: 0.08,
    maiaTopP: 0.18,
    qualityFilter: {
      maxLossCp: 8,
      fallbackRank: 1
    },
    description: '更高强度的拟人档，用 Maia 候选结合 Stockfish 过滤，尽量贴近强 GM 备战压力。'
  },
  {
    id: 'human-2700',
    label: '近似 2700',
    mode: 'humanized-stockfish',
    estimatedElo: 2700,
    calibratedElo: 2900,
    depth: 24,
    multipv: 3,
    skillLevel: 20,
    searchMoveTimeMs: 14000,
    toleranceCp: 0,
    stockfishCandidateLimit: 1,
    strictEngineMove: true,
    forceBestMove: true,
    disableOpeningPrior: true,
    stockfishLimitStrength: false,
    openingPriorMaxLossCp: 0,
    openingPriorSort: 'engine-first',
    description: '用更长搜索的 Stockfish 限强近似，避免为拟人牺牲基本质量。'
  }
];

export function listEngineProfiles() {
  return ENGINE_PROFILES.map((profile) => structuredClone(profile));
}

export function getEngineProfile(id) {
  const profile = ENGINE_PROFILES.find((candidate) => candidate.id === id);
  return profile ? structuredClone(profile) : null;
}
