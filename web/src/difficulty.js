export function evaluateDifficulty({
  solverStats,
  startMelds,
  solutionMelds,
  remainingTiles
}) {
  const startGroups = buildTileGroupMap(startMelds);
  const solutionGroups = buildTileGroupMap(solutionMelds);

  let tilesMoved = 0;
  for (const tile of remainingTiles) {
    const startGroup = startGroups.get(tile.id);
    const solutionGroup = solutionGroups.get(tile.id);
    if (startGroup !== solutionGroup) tilesMoved += 1;
  }

  const startMeldSet = new Set(startMelds.map((m) => meldKey(m)));
  let unchanged = 0;
  for (const meld of solutionMelds) {
    if (startMeldSet.has(meldKey(meld))) unchanged += 1;
  }
  const meldsChanged = Math.max(0, startMelds.length - unchanged);

  let splittingRequired = false;
  const origToStartGroups = new Map();
  for (const tile of remainingTiles) {
    const solGroup = solutionGroups.get(tile.id);
    const startGroup = startGroups.get(tile.id);
    if (!origToStartGroups.has(solGroup)) origToStartGroups.set(solGroup, new Set());
    origToStartGroups.get(solGroup).add(startGroup);
    if (origToStartGroups.get(solGroup).size > 1) splittingRequired = true;
  }

  const backtracks = solverStats?.backtracks ?? 0;
  const score = backtracks + meldsChanged * 5 + tilesMoved * 0.5 + (splittingRequired ? 20 : 0);
  const tier = scoreToTier(score);

  return {
    score: Math.round(score),
    tier,
    metrics: { backtracks, meldsChanged, tilesMoved, splittingRequired }
  };
}

function buildTileGroupMap(melds) {
  const map = new Map();
  melds.forEach((meld, idx) => {
    for (const tile of meld) {
      map.set(tile.id, idx);
    }
  });
  return map;
}

function meldKey(meld) {
  const ids = meld.map((t) => t.id).sort((a, b) => a - b);
  return ids.join(",");
}

function scoreToTier(score) {
  if (score < 20) return "easy";
  if (score < 40) return "medium";
  if (score < 70) return "hard";
  return "expert";
}
