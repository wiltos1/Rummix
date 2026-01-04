import { generateAllMelds } from "./melds.js";

export function solveExactCover(tiles, options = {}) {
  const limit = options.limit ?? 1;
  const melds = generateAllMelds(tiles);
  const tileIndex = new Map();
  tiles.forEach((t, i) => tileIndex.set(t.id, i));

  const meldTileIndices = melds.map((meld) => meld.map((t) => tileIndex.get(t.id)));
  const tileToMelds = Array.from({ length: tiles.length }, () => []);
  meldTileIndices.forEach((indices, meldIdx) => {
    for (const tIdx of indices) {
      tileToMelds[tIdx].push(meldIdx);
    }
  });

  const covered = Array(tiles.length).fill(false);
  const solution = [];
  const stats = { nodes: 0, backtracks: 0 };
  let count = 0;
  let firstSolution = null;

  function pickNextTile() {
    let bestTile = -1;
    let bestOptions = Infinity;
    for (let i = 0; i < covered.length; i += 1) {
      if (covered[i]) continue;
      let options = 0;
      for (const meldIdx of tileToMelds[i]) {
        if (isMeldAvailable(meldTileIndices[meldIdx])) options += 1;
      }
      if (options === 0) return { tile: i, options: 0 };
      if (options < bestOptions) {
        bestOptions = options;
        bestTile = i;
        if (bestOptions === 1) break;
      }
    }
    return { tile: bestTile, options: bestOptions };
  }

  function isMeldAvailable(indices) {
    for (const idx of indices) {
      if (covered[idx]) return false;
    }
    return true;
  }

  function applyMeld(indices, value) {
    for (const idx of indices) {
      covered[idx] = value;
    }
  }

  function dfs() {
    if (count >= limit) return;
    const next = pickNextTile();
    if (next.tile === -1) {
      count += 1;
      if (!firstSolution) {
        firstSolution = solution.map((meldIdx) => melds[meldIdx]);
      }
      return;
    }
    if (next.options === 0) {
      stats.backtracks += 1;
      return;
    }

    stats.nodes += 1;
    const candidateMelds = tileToMelds[next.tile]
      .filter((meldIdx) => isMeldAvailable(meldTileIndices[meldIdx]));

    for (const meldIdx of candidateMelds) {
      const indices = meldTileIndices[meldIdx];
      applyMeld(indices, true);
      solution.push(meldIdx);
      dfs();
      solution.pop();
      applyMeld(indices, false);
      if (count >= limit) return;
    }
  }

  dfs();
  return { solution: firstSolution, count, stats };
}
