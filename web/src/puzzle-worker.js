import { generateDailyPuzzle } from "./generator.js";

self.addEventListener("message", (event) => {
  const { dateStr, difficulty, seedStr, maxMs } = event.data || {};
  try {
    const puzzle = generateDailyPuzzle(dateStr, {
      enforceUnique: false,
      maxMs,
      targetTier: difficulty,
      seedStr
    });
    self.postMessage({ ok: true, puzzle });
  } catch (err) {
    const message = err?.message || "Puzzle generation failed";
    self.postMessage({ ok: false, error: message });
  }
});
