import { createFullTileSet } from "./tiles.js";
import { generateAllMelds } from "./melds.js";
import { solveExactCover } from "./solver.js";
import { evaluateDifficulty } from "./difficulty.js";
import { rngFromDate } from "./seed.js";

export function generateDailyPuzzle(dateStr, options = {}) {
  const rng = rngFromDate(dateStr);
  const targetTier = pickTargetTier(rng);
  const enforceUnique = options.enforceUnique ?? false;
  const maxMs = options.maxMs ?? Number.POSITIVE_INFINITY;
  const startTime = Date.now();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (Date.now() - startTime > maxMs) {
      throw new Error("Puzzle generation timed out");
    }
    const targetTiles = randInt(rng, 30, 50);
    const countRange = requiredCountRange(targetTier, rng);
    const minRemaining = 18;

    for (let pickAttempt = 0; pickAttempt < 60; pickAttempt += 1) {
      if (Date.now() - startTime > maxMs) {
        throw new Error("Puzzle generation timed out");
      }
      const requiredCount = Math.max(
        countRange.min,
        Math.min(countRange.max - Math.floor(pickAttempt / 10), targetTiles - minRemaining)
      );
      if (requiredCount < countRange.min) continue;

      const remainingCount = targetTiles - requiredCount;
      const startBoard = generateSolutionBoard(rng, remainingCount);
      if (!startBoard) continue;

      const remainingTiles = startBoard.flat();
      const requiredTiles = selectRequiredTilesFromPool(remainingTiles, requiredCount, targetTier, rng);
      if (!requiredTiles || requiredTiles.length !== requiredCount) continue;

      const fullTiles = [...remainingTiles, ...requiredTiles];
      const fullSolve = solveExactCover(fullTiles, { limit: 2 });
      if (!fullSolve.solution) continue;
      if (enforceUnique && fullSolve.count !== 1) continue;

      const solutionBoard = fullSolve.solution;
      if (isTrivialRepartition(solutionBoard, requiredTiles, startBoard)) continue;

      const difficulty = evaluateDifficulty({
        solverStats: fullSolve.stats,
        startMelds: startBoard,
        solutionMelds: solutionBoard,
        remainingTiles
      });

      return {
        date: dateStr,
        targetTier,
        difficulty,
        startingBoard: startBoard,
        requiredTiles,
        solution: solutionBoard
      };
    }
  }

  throw new Error("Failed to generate a puzzle after multiple attempts");
}

function generateSolutionBoard(rng, targetTiles) {
  const target = targetTiles ?? randInt(rng, 30, 50);
  const minTarget = targetTiles ?? 30;
  const maxTarget = targetTiles ?? 50;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const available = createFullTileSet();
    const board = [];
    let total = 0;

    for (let tries = 0; tries < 200 && total < target; tries += 1) {
      const meld = buildRandomMeld(available, rng);
      if (!meld) continue;
      if (total + meld.length > maxTarget && total >= minTarget) break;
      if (total + meld.length > target + 4) continue;

      board.push(meld);
      total += meld.length;
      removeTiles(available, meld);

      if (total >= minTarget && total <= maxTarget && rng() < 0.2) break;
    }
    if (total >= minTarget && total <= maxTarget) return board;
  }

  return null;
}

function buildRandomMeld(available, rng) {
  const useRun = rng() < 0.6;
  const meld = useRun ? buildRandomRun(available, rng) : buildRandomSet(available, rng);
  if (meld) return meld;

  const all = generateAllMelds(available);
  if (all.length === 0) return null;
  return all[randInt(rng, 0, all.length - 1)];
}

function buildRandomSet(available, rng) {
  const byValue = new Map();
  for (let v = 1; v <= 13; v += 1) byValue.set(v, new Map());
  for (const tile of available) {
    if (!byValue.get(tile.value).has(tile.color)) byValue.get(tile.value).set(tile.color, []);
    byValue.get(tile.value).get(tile.color).push(tile);
  }

  const values = Array.from(byValue.keys()).filter((v) => byValue.get(v).size >= 3);
  if (values.length === 0) return null;
  const value = values[randInt(rng, 0, values.length - 1)];
  const colors = Array.from(byValue.get(value).keys());
  const size = colors.length >= 4 && rng() < 0.35 ? 4 : 3;
  const chosen = shuffle(colors, rng).slice(0, size);
  return chosen.map((color) => pickRandom(byValue.get(value).get(color), rng));
}

function buildRandomRun(available, rng) {
  const byColor = new Map();
  for (const tile of available) {
    if (!byColor.has(tile.color)) byColor.set(tile.color, new Map());
    if (!byColor.get(tile.color).has(tile.value)) byColor.get(tile.color).set(tile.value, []);
    byColor.get(tile.color).get(tile.value).push(tile);
  }

  const colors = Array.from(byColor.keys()).filter((c) => byColor.get(c).size >= 3);
  if (colors.length === 0) return null;
  const color = colors[randInt(rng, 0, colors.length - 1)];
  const valueMap = byColor.get(color);
  const values = Array.from(valueMap.keys()).sort((a, b) => a - b);

  const segments = [];
  let current = [];
  for (const v of values) {
    if (current.length === 0 || v === current[current.length - 1] + 1) {
      current.push(v);
    } else {
      if (current.length >= 3) segments.push([...current]);
      current = [v];
    }
  }
  if (current.length >= 3) segments.push(current);
  if (segments.length === 0) return null;

  const segment = segments[randInt(rng, 0, segments.length - 1)];
  const maxLen = Math.min(6, segment.length);
  const len = randInt(rng, 3, maxLen);
  const startIdx = randInt(rng, 0, segment.length - len);
  const runValues = segment.slice(startIdx, startIdx + len);

  return runValues.map((v) => pickRandom(valueMap.get(v), rng));
}

function selectRequiredTilesFromPool(remainingTiles, count, tier, rng) {
  const remainingIds = new Set(remainingTiles.map((t) => t.id));
  const pool = createFullTileSet().filter((t) => !remainingIds.has(t.id));
  if (pool.length < count) return null;

  const scores = scorePoolTiles(pool, remainingTiles);
  const scored = pool.map((tile) => ({ tile, score: scores.get(tile.id) ?? 0 }));
  scored.sort((a, b) => a.score - b.score);

  const focusHigh = tier === "easy" || tier === "medium";
  const windowSize = Math.max(count * 2, Math.floor(scored.length * 0.6));
  const candidates = focusHigh
    ? scored.slice(Math.max(0, scored.length - windowSize))
    : scored.slice(0, windowSize);

  const shuffled = shuffle(candidates, rng);
  return shuffled.slice(0, count).map((entry) => entry.tile);
}

function scorePoolTiles(pool, remainingTiles) {
  const byValue = new Map();
  const byColor = new Map();
  for (const tile of remainingTiles) {
    if (!byValue.has(tile.value)) byValue.set(tile.value, new Set());
    if (!byColor.has(tile.color)) byColor.set(tile.color, new Set());
    byValue.get(tile.value).add(tile.color);
    byColor.get(tile.color).add(tile.value);
  }

  const scores = new Map();
  for (const tile of pool) {
    const setScore = (byValue.get(tile.value)?.size ?? 0);
    const valueSet = byColor.get(tile.color) ?? new Set();
    let runScore = 0;
    for (let delta = -2; delta <= 2; delta += 1) {
      if (delta === 0) continue;
      if (valueSet.has(tile.value + delta)) runScore += 1;
    }
    scores.set(tile.id, setScore * 2 + runScore);
  }
  return scores;
}

function requiredCountRange(tier, rng) {
  const ranges = {
    easy: { min: 4, max: 6 },
    medium: { min: 6, max: 9 },
    hard: { min: 8, max: 12 },
    expert: { min: 10, max: 16 }
  };
  const range = ranges[tier] ?? { min: 6, max: 9 };
  return {
    min: range.min,
    max: randInt(rng, range.min, range.max)
  };
}

function isTrivialRepartition(solutionBoard, requiredTiles, startBoard) {
  const requiredSet = requiredTilesIds(requiredTiles);
  const originalRemaining = solutionBoard
    .map((meld) => meld.filter((t) => !requiredSet.has(t.id)))
    .filter((meld) => meld.length >= 3);

  if (originalRemaining.length !== startBoard.length) return false;
  const originalKeys = new Set(originalRemaining.map((m) => meldKey(m)));
  for (const meld of startBoard) {
    if (!originalKeys.has(meldKey(meld))) return false;
  }
  return true;
}

function requiredTilesIds(requiredTiles) {
  return new Set(requiredTiles.map((t) => t.id));
}

function meldKey(meld) {
  return meld.map((t) => t.id).sort((a, b) => a - b).join(",");
}

function removeTiles(available, meld) {
  const ids = new Set(meld.map((t) => t.id));
  for (let i = available.length - 1; i >= 0; i -= 1) {
    if (ids.has(available[i].id)) available.splice(i, 1);
  }
}

function pickRandom(arr, rng) {
  return arr[randInt(rng, 0, arr.length - 1)];
}

function shuffle(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickTargetTier(rng) {
  const roll = rng();
  if (roll < 0.35) return "easy";
  if (roll < 0.65) return "medium";
  if (roll < 0.9) return "hard";
  return "expert";
}
