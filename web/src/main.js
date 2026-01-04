import { generateDailyPuzzle } from "./generator.js";

const dateStr = new Date().toISOString().slice(0, 10);
let puzzle = null;
let error = null;
const CACHE_KEY_PREFIX = "rummix:puzzle:";
const UNIQUE_BUDGET_MS = 2000;
const FALLBACK_BUDGET_MS = 15000;

try {
  const difficulty = getRequestedDifficulty();
  const cacheKey = `${dateStr}:${difficulty}`;
  const seedStr = `${dateStr}:${difficulty}`;
  puzzle = loadCachedPuzzle(cacheKey);
  if (!puzzle) {
    puzzle = generateDailyPuzzle(dateStr, {
      enforceUnique: true,
      maxMs: UNIQUE_BUDGET_MS,
      targetTier: difficulty,
      seedStr
    });
  }
} catch (err) {
  console.warn("Unique puzzle generation failed, falling back to non-unique.", err);
  try {
    const difficulty = getRequestedDifficulty();
    const seedStr = `${dateStr}:${difficulty}`;
    puzzle = generateDailyPuzzle(dateStr, {
      enforceUnique: false,
      maxMs: FALLBACK_BUDGET_MS,
      targetTier: difficulty,
      seedStr
    });
  } catch (fallbackErr) {
    error = fallbackErr;
  }
}

if (puzzle) {
  const difficulty = getRequestedDifficulty();
  const cacheKey = `${dateStr}:${difficulty}`;
  saveCachedPuzzle(cacheKey, puzzle);
}

window.dailyPuzzle = puzzle;
window.dailyPuzzleError = error;
console.log("Daily puzzle", puzzle);
if (error) console.error("Daily puzzle error", error);
if (error && window.showGlobalError) {
  window.showGlobalError(error.message || "Puzzle generation failed");
}
window.dispatchEvent(new Event("daily-puzzle-ready"));

export { puzzle };

function loadCachedPuzzle(cacheKey) {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return isValidPuzzleData(data) ? data : null;
  } catch {
    return null;
  }
}

function saveCachedPuzzle(cacheKey, data) {
  try {
    if (!isValidPuzzleData(data)) return;
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}${cacheKey}`, JSON.stringify(data));
  } catch {
    // Ignore storage failures (quota, disabled, etc.)
  }
}

function isValidPuzzleData(data) {
  if (!data || typeof data !== "object") return false;
  if (!data.date || typeof data.date !== "string") return false;
  if (!data.difficulty || typeof data.difficulty !== "object") return false;
  if (!Array.isArray(data.startingBoard) || !Array.isArray(data.requiredTiles) || !Array.isArray(data.solution)) {
    return false;
  }
  return (
    data.startingBoard.every(isMeldArray) &&
    data.solution.every(isMeldArray) &&
    data.requiredTiles.every(isTileLike)
  );
}

function isMeldArray(meld) {
  return Array.isArray(meld) && meld.every(isTileLike);
}

function isTileLike(tile) {
  return tile && typeof tile.id === "number" && typeof tile.color === "string" && typeof tile.value === "number";
}

function getRequestedDifficulty() {
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("difficulty") || "").toLowerCase();
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "easy";
}
