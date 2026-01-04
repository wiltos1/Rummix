export const COLORS = ["red", "blue", "black", "orange"];
export const VALUES = Array.from({ length: 13 }, (_, i) => i + 1);

export function createFullTileSet() {
  const tiles = [];
  let id = 1;
  for (const color of COLORS) {
    for (const value of VALUES) {
      for (let copy = 0; copy < 2; copy += 1) {
        tiles.push({ id: id++, color, value });
      }
    }
  }
  return tiles;
}

export function tileKey(tile) {
  return `${tile.color}-${tile.value}-${tile.id}`;
}

export function cloneTile(tile) {
  return { id: tile.id, color: tile.color, value: tile.value };
}
