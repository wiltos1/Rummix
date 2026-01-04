import { generateDailyPuzzle } from "./generator.js";

const dateStr = new Date().toISOString().slice(0, 10);
let puzzle = null;
let error = null;
const CACHE_KEY_PREFIX = "rummix:puzzle:";
const UNIQUE_BUDGET_MS = 2000;
const FALLBACK_BUDGET_MS = 15000;

try {
  puzzle = loadCachedPuzzle(dateStr);
  if (!puzzle) {
    puzzle = generateDailyPuzzle(dateStr, { enforceUnique: true, maxMs: UNIQUE_BUDGET_MS });
  }
} catch (err) {
  console.warn("Unique puzzle generation failed, falling back to non-unique.", err);
  try {
    puzzle = generateDailyPuzzle(dateStr, { enforceUnique: false, maxMs: FALLBACK_BUDGET_MS });
  } catch (fallbackErr) {
    error = fallbackErr;
  }
}

if (puzzle) {
  saveCachedPuzzle(dateStr, puzzle);
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

function loadCachedPuzzle(dateStr) {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}${dateStr}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return isValidPuzzleData(data) ? data : null;
  } catch {
    return null;
  }
}

function saveCachedPuzzle(dateStr, data) {
  try {
    if (!isValidPuzzleData(data)) return;
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}${dateStr}`, JSON.stringify(data));
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
