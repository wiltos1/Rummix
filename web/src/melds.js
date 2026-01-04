import { COLORS, VALUES } from "./tiles.js";

export function isValidSet(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const value = tiles[0].value;
  const colors = new Set();
  for (const t of tiles) {
    if (t.value !== value) return false;
    if (colors.has(t.color)) return false;
    colors.add(t.color);
  }
  return true;
}

export function isValidRun(tiles) {
  if (tiles.length < 3) return false;
  const color = tiles[0].color;
  const values = tiles.map((t) => t.value).sort((a, b) => a - b);
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i].color !== color) return false;
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function groupTilesByColorValue(tiles) {
  const byColor = new Map();
  for (const color of COLORS) {
    byColor.set(color, new Map());
    for (const value of VALUES) {
      byColor.get(color).set(value, []);
    }
  }

  for (const tile of tiles) {
    byColor.get(tile.color).get(tile.value).push(tile);
  }
  return byColor;
}

export function generateAllSets(tiles) {
  const byValue = new Map();
  for (const value of VALUES) {
    byValue.set(value, new Map());
    for (const color of COLORS) {
      byValue.get(value).set(color, []);
    }
  }

  for (const tile of tiles) {
    byValue.get(tile.value).get(tile.color).push(tile);
  }

  const melds = [];
  for (const value of VALUES) {
    const colorBuckets = byValue.get(value);
    const availableColors = COLORS.filter((c) => colorBuckets.get(c).length > 0);
    if (availableColors.length < 3) continue;

    const colorSubsets = [];
    const n = availableColors.length;
    const subsetMin = 3;
    const subsetMax = Math.min(4, n);
    for (let mask = 0; mask < (1 << n); mask += 1) {
      const subset = [];
      for (let i = 0; i < n; i += 1) {
        if (mask & (1 << i)) subset.push(availableColors[i]);
      }
      if (subset.length >= subsetMin && subset.length <= subsetMax) {
        colorSubsets.push(subset);
      }
    }

    for (const subset of colorSubsets) {
      const picks = [];
      for (const color of subset) {
        picks.push(colorBuckets.get(color));
      }
      buildCartesian(picks, 0, [], (combo) => {
        melds.push(combo);
      });
    }
  }

  return melds;
}

export function generateAllRuns(tiles) {
  const byColor = groupTilesByColorValue(tiles);
  const melds = [];

  for (const color of COLORS) {
    const buckets = byColor.get(color);
    for (let start = 1; start <= 13; start += 1) {
      if (buckets.get(start).length === 0) continue;
      let end = start;
      while (end <= 13 && buckets.get(end).length > 0) {
        const len = end - start + 1;
        if (len >= 3) {
          const picks = [];
          for (let v = start; v <= end; v += 1) {
            picks.push(buckets.get(v));
          }
          buildCartesian(picks, 0, [], (combo) => {
            melds.push(combo);
          });
        }
        end += 1;
      }
    }
  }

  return melds;
}

export function generateAllMelds(tiles) {
  return [...generateAllRuns(tiles), ...generateAllSets(tiles)];
}

function buildCartesian(pools, idx, current, onComplete) {
  if (idx >= pools.length) {
    onComplete([...current]);
    return;
  }
  for (const item of pools[idx]) {
    current.push(item);
    buildCartesian(pools, idx + 1, current, onComplete);
    current.pop();
  }
}
