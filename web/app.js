import { generateDailyPuzzle } from "./src/generator.js";
import { isValidRun, isValidSet } from "./src/melds.js";

const boardEl = document.getElementById("board");
const requiredEl = document.getElementById("required-tiles");
const workspaceEl = document.getElementById("workspace");
const errorBanner = createErrorBanner();

let dragState = null;
let hasWon = false;
let isSolutionView = false;

let puzzle = null;
let baseState = null;

const CACHE_KEY_PREFIX = "rummix:puzzle:";
const UNIQUE_BUDGET_MS = 2000;
const FALLBACK_BUDGET_MS = 15000;

workspaceEl.addEventListener("pointerdown", (event) => {
  if (isInteractionLocked()) return;
  const tile = event.target.closest(".tile");
  if (!tile) return;
  startDrag(event, tile);
});

boardEl.addEventListener("pointerdown", (event) => {
  if (isInteractionLocked()) return;
  const tile = event.target.closest(".tile");
  if (!tile) return;
  startDrag(event, tile);
});

requiredEl.addEventListener("pointerdown", (event) => {
  if (isInteractionLocked()) return;
  const tile = event.target.closest(".tile");
  if (!tile) return;
  startDrag(event, tile);
});

window.addEventListener("pointermove", (event) => {
  if (!dragState) return;
  moveDrag(event);
});

window.addEventListener("pointerup", (event) => {
  if (!dragState) return;
  endDrag(event);
});

const btnReset = document.getElementById("btn-reset");
const btnSolve = document.getElementById("btn-solve");
const btnShuffle = document.getElementById("btn-shuffle");
const btnReplaySolution = document.getElementById("btn-replay-solution");

const victoryOverlay = document.getElementById("victory-overlay");
const btnReplay = document.getElementById("btn-replay");
const btnClose = document.getElementById("btn-close");
const timerEl = document.getElementById("puzzle-timer");
const victoryTimeEl = document.getElementById("victory-time");

let totalTileCount = 0;
let timerStart = Date.now();
let timerInterval = null;

initPuzzle();

function initPuzzle() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const cached = loadCachedPuzzle(dateStr);
  if (cached) {
    puzzle = cached;
  } else {
    try {
      puzzle = generateDailyPuzzle(dateStr, { enforceUnique: true, maxMs: UNIQUE_BUDGET_MS });
    } catch (err) {
      console.warn("Unique puzzle generation failed, falling back to non-unique.", err);
      try {
        puzzle = generateDailyPuzzle(dateStr, { enforceUnique: false, maxMs: FALLBACK_BUDGET_MS });
      } catch (fallbackErr) {
        const message = fallbackErr?.message || "Puzzle generation failed.";
        if (window.showGlobalError) window.showGlobalError(message);
        showError(message);
        return;
      }
    }
    saveCachedPuzzle(dateStr, puzzle);
  }

  baseState = {
    startingBoard: puzzle.startingBoard.map((meld) => [...meld]),
    requiredTiles: [...puzzle.requiredTiles],
    solution: puzzle.solution.map((meld) => [...meld])
  };
  totalTileCount = puzzle.startingBoard.flat().length + puzzle.requiredTiles.length;
  renderMeta(puzzle);
  renderPuzzle(baseState.startingBoard, baseState.requiredTiles);
  startTimer();
}

window.addEventListener("error", (event) => {
  showError(event.message || "Unexpected error");
});

window.addEventListener("unhandledrejection", (event) => {
  const message = event?.reason?.message || "Unhandled promise rejection";
  showError(message);
});

function createErrorBanner() {
  const banner = document.createElement("div");
  banner.className = "error-banner hidden";
  document.body.appendChild(banner);
  return banner;
}

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

function showError(message) {
  if (!errorBanner) return;
  errorBanner.textContent = `Error: ${message}`;
  errorBanner.classList.remove("hidden");
}

btnReset.addEventListener("click", () => {
  if (isInteractionLocked()) return;
  renderPuzzle(baseState.startingBoard, baseState.requiredTiles);
  hideVictory();
  exitSolutionView();
  resetTimer();
});

btnSolve.addEventListener("click", () => {
  if (isInteractionLocked()) return;
  enterSolutionView();
});

btnShuffle.addEventListener("click", () => {
  if (isInteractionLocked()) return;
  shuffleBoardGroups();
});

btnReplay.addEventListener("click", () => {
  renderPuzzle(baseState.startingBoard, baseState.requiredTiles);
  hideVictory();
  exitSolutionView();
  resetTimer();
});

btnClose.addEventListener("click", () => {
  closeVictoryOverlay();
});

btnReplaySolution.addEventListener("click", () => {
  renderPuzzle(baseState.startingBoard, baseState.requiredTiles);
  exitSolutionView();
  resetTimer();
});

function renderMeta(puzzleData) {
  document.getElementById("puzzle-date").textContent = puzzleData.date;
  document.getElementById("puzzle-difficulty").textContent = `${puzzleData.difficulty.tier} (${puzzleData.difficulty.score})`;
}

function renderPuzzle(startingBoard, requiredTiles) {
  boardEl.innerHTML = "";
  requiredEl.innerHTML = "";
  workspaceEl.querySelectorAll(".tile").forEach((tile) => tile.remove());

  startingBoard.forEach((meld) => {
    const group = document.createElement("div");
    group.className = "meld-group";
    meld.forEach((tile) => group.appendChild(createTileEl(tile)));
    boardEl.appendChild(group);
  });

  requiredTiles.forEach((tile) => {
    requiredEl.appendChild(createTileEl(tile));
  });

  layoutBoardGroups();
  removeEmptyGroups();
  checkVictory();
}

function createFloatingGroup(boardRect, clientX, clientY) {
  const group = document.createElement("div");
  group.className = "meld-group";
  boardEl.appendChild(group);
  const placedRects = collectGroupRects(group);
  positionGroup(group, boardRect, placedRects, clientX, clientY);
  return group;
}

function layoutBoardGroups() {
  const boardRect = boardEl.getBoundingClientRect();
  const groups = Array.from(boardEl.querySelectorAll(".meld-group"));
  const placedRects = [];
  groups.forEach((group) => {
    const placed = positionGroup(group, boardRect, placedRects);
    placedRects.push(placed);
  });
}

function positionGroup(group, boardRect, placedRects, clientX, clientY) {
  const width = Math.max(group.offsetWidth, 140);
  const height = Math.max(group.offsetHeight, 70);
  const baseX = clientX ? clientX - boardRect.left - width / 2 : null;
  const baseY = clientY ? clientY - boardRect.top - height / 2 : null;
  const attempts = 80;
  let placed = null;

  for (let i = 0; i < attempts; i += 1) {
    const jitter = i === 0 && baseX !== null ? { x: baseX, y: baseY } : randomPoint(boardRect, width, height);
    const clampedX = Math.max(12, Math.min(boardRect.width - width - 12, jitter.x));
    const clampedY = Math.max(12, Math.min(boardRect.height - height - 12, jitter.y));
    const candidate = { x: clampedX, y: clampedY, width, height };
    if (!intersectsAny(candidate, placedRects)) {
      placed = candidate;
      break;
    }
  }

  if (!placed) {
    placed = findFirstGap(boardRect, width, height, placedRects);
  }

  group.style.left = `${placed.x}px`;
  group.style.top = `${placed.y}px`;
  return placed;
}

function collectGroupRects(exclude) {
  const boardRect = boardEl.getBoundingClientRect();
  return Array.from(boardEl.querySelectorAll(".meld-group"))
    .filter((group) => group !== exclude)
    .map((group) => measureGroup(group, boardRect));
}

function measureGroup(group, boardRect) {
  const rect = group.getBoundingClientRect();
  return {
    x: rect.left - boardRect.left,
    y: rect.top - boardRect.top,
    width: rect.width,
    height: rect.height
  };
}

function intersectsAny(candidate, rects) {
  return rects.some((rect) => rectsOverlap(candidate, rect));
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width + 8 < b.x ||
    a.x > b.x + b.width + 8 ||
    a.y + a.height + 8 < b.y ||
    a.y > b.y + b.height + 8
  );
}

function randomPoint(boardRect, width, height) {
  return {
    x: Math.random() * (boardRect.width - width),
    y: Math.random() * (boardRect.height - height)
  };
}

function findFirstGap(boardRect, width, height, rects) {
  const step = 12;
  for (let y = 12; y < boardRect.height - height - 12; y += step) {
    for (let x = 12; x < boardRect.width - width - 12; x += step) {
      const candidate = { x, y, width, height };
      if (!intersectsAny(candidate, rects)) return candidate;
    }
  }
  return { x: 12, y: 12, width, height };
}

function removeEmptyGroups() {
  document.querySelectorAll(".meld-group").forEach((group) => {
    if (group.querySelectorAll(".tile").length === 0) group.remove();
  });
}

function createTileEl(tile) {
  const el = document.createElement("div");
  el.className = `tile ${tile.color}`;
  el.dataset.id = tile.id;
  el.dataset.color = tile.color;
  el.dataset.value = tile.value;

  const value = document.createElement("div");
  value.className = "value";
  value.textContent = tile.value;

  el.appendChild(value);
  return el;
}

function startDrag(event, tileEl) {
  event.preventDefault();
  const rect = tileEl.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const inWorkspace = tileEl.classList.contains("workspace-tile");

  dragState = {
    tileEl,
    originParent: tileEl.parentElement,
    originIndex: Array.from(tileEl.parentElement.children).indexOf(tileEl),
    originLeft: inWorkspace ? tileEl.style.left : null,
    originTop: inWorkspace ? tileEl.style.top : null,
    offsetX,
    offsetY
  };

  tileEl.classList.add("dragging");
  tileEl.style.left = `${rect.left}px`;
  tileEl.style.top = `${rect.top}px`;
  tileEl.style.width = `${rect.width}px`;
  tileEl.style.height = `${rect.height}px`;
  document.body.appendChild(tileEl);
  moveDrag(event);
}

function moveDrag(event) {
  const { tileEl, offsetX, offsetY } = dragState;
  tileEl.style.left = `${event.clientX - offsetX}px`;
  tileEl.style.top = `${event.clientY - offsetY}px`;
}

function endDrag(event) {
  const { tileEl, originParent, originIndex } = dragState;
  const boardGroups = Array.from(document.querySelectorAll(".meld-group"));
  const workspaceRect = workspaceEl.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();
  const targetGroup = boardGroups.find((row) => isPointInside(event, row));

  tileEl.classList.remove("dragging");
  tileEl.style.width = "";
  tileEl.style.height = "";

  if (targetGroup) {
    tileEl.style.left = "";
    tileEl.style.top = "";
    tileEl.classList.remove("workspace-tile");
    insertIntoGroup(tileEl, targetGroup, event.clientX);
    resolveBoardOverlapsLocal(targetGroup);
  } else if (isPointInside(event, workspaceEl)) {
    tileEl.classList.add("workspace-tile");
    workspaceEl.appendChild(tileEl);
    const position = snapWorkspacePosition(event.clientX, event.clientY, workspaceRect, tileEl);
    tileEl.style.left = `${position.x}px`;
    tileEl.style.top = `${position.y}px`;
  } else if (isPointInside(event, boardEl)) {
    tileEl.style.left = "";
    tileEl.style.top = "";
    tileEl.classList.remove("workspace-tile");
    const group = createFloatingGroup(boardRect, event.clientX, event.clientY);
    group.appendChild(tileEl);
    resolveBoardOverlapsLocal(group);
  } else {
    restoreTile(tileEl, originParent, originIndex);
  }

  dragState = null;
  removeEmptyGroups();
  checkVictory();
}

function insertIntoGroup(tileEl, group, clientX) {
  const children = Array.from(group.children).filter((child) => child !== tileEl);
  const groupRect = group.getBoundingClientRect();
  const slotWidth = 52;
  const index = Math.max(0, Math.min(children.length, Math.round((clientX - groupRect.left) / slotWidth)));

  if (index >= children.length) {
    group.appendChild(tileEl);
  } else {
    group.insertBefore(tileEl, children[index]);
  }
}

function restoreTile(tileEl, parent, index) {
  const restoreToWorkspace = parent === workspaceEl;
  if (!restoreToWorkspace) {
    tileEl.style.left = "";
    tileEl.style.top = "";
    tileEl.classList.remove("workspace-tile");
  }

  if (index >= parent.children.length) {
    parent.appendChild(tileEl);
  } else {
    parent.insertBefore(tileEl, parent.children[index]);
  }

  if (restoreToWorkspace) {
    tileEl.classList.add("workspace-tile");
    tileEl.style.left = dragState.originLeft ?? tileEl.style.left;
    tileEl.style.top = dragState.originTop ?? tileEl.style.top;
  }
}

function snapWorkspacePosition(clientX, clientY, workspaceRect, tileEl) {
  const rawX = clientX - workspaceRect.left - tileEl.offsetWidth / 2;
  const rawY = clientY - workspaceRect.top - tileEl.offsetHeight / 2;
  const snapped = snapToGrid(rawX, rawY, 12);
  const neighbor = nearestWorkspaceTile(tileEl, snapped.x, snapped.y);

  if (neighbor && neighbor.distance < 60) {
    return {
      x: neighbor.x + 66,
      y: neighbor.y
    };
  }

  return snapped;
}

function snapToGrid(x, y, gap) {
  return {
    x: Math.max(0, Math.round(x / gap) * gap),
    y: Math.max(0, Math.round(y / gap) * gap)
  };
}

function nearestWorkspaceTile(tileEl, x, y) {
  let nearest = null;
  workspaceEl.querySelectorAll(".workspace-tile").forEach((tile) => {
    if (tile === tileEl) return;
    const rect = tile.getBoundingClientRect();
    const baseRect = workspaceEl.getBoundingClientRect();
    const tileX = rect.left - baseRect.left;
    const tileY = rect.top - baseRect.top;
    const dist = Math.hypot(tileX - x, tileY - y);
    if (!nearest || dist < nearest.distance) {
      nearest = { x: tileX, y: tileY, distance: dist };
    }
  });
  return nearest;
}

function shuffleBoardGroups() {
  layoutBoardGroups();
  removeEmptyGroups();
}

function validateBoard() {
  let validCount = 0;
  let invalidCount = 0;
  let incompleteCount = 0;
  document.querySelectorAll(".meld-group").forEach((group) => {
    const tiles = Array.from(group.querySelectorAll(".tile")).map(tileFromEl);
    const isValid = tiles.length >= 3 && (isValidRun(tiles) || isValidSet(tiles));
    if (tiles.length > 0 && tiles.length < 3) {
      incompleteCount += 1;
    }
    if (isValid) validCount += 1;
    if (!isValid && tiles.length >= 3) invalidCount += 1;
  });

  if (invalidCount > 0) {
    return { message: `${invalidCount} group(s) need work.`, validCount, invalidCount, incompleteCount };
  }
  if (validCount === 0) {
    return { message: "No completed melds yet. Keep building.", validCount, invalidCount, incompleteCount };
  }
  return { message: "All completed groups are valid.", validCount, invalidCount, incompleteCount };
}

function tileFromEl(tileEl) {
  return {
    id: Number(tileEl.dataset.id),
    color: tileEl.dataset.color,
    value: Number(tileEl.dataset.value)
  };
}

function checkVictory() {
  if (hasWon || isSolutionView) return;
  const results = validateBoard();
  const boardTiles = document.querySelectorAll(".meld-group .tile").length;
  const requiredTiles = requiredEl.querySelectorAll(".tile").length;
  const workspaceTiles = workspaceEl.querySelectorAll(".workspace-tile").length;

  const allPlaced = boardTiles === totalTileCount && requiredTiles === 0 && workspaceTiles === 0;
  const allValid = results.invalidCount === 0 && results.incompleteCount === 0;

  if (allPlaced && allValid) {
    showVictory();
  }
}

function showVictory() {
  hasWon = true;
  victoryOverlay.classList.remove("hidden");
  applyVictoryStyles();
  stopTimer();
  victoryTimeEl.textContent = formatElapsed(Date.now() - timerStart);
}

function hideVictory() {
  hasWon = false;
  victoryOverlay.classList.add("hidden");
  clearVictoryStyles();
}

function closeVictoryOverlay() {
  victoryOverlay.classList.add("hidden");
  applyVictoryStyles();
}

function enterSolutionView() {
  isSolutionView = true;
  renderPuzzle(baseState.solution, []);
  applyVictoryStyles();
  victoryOverlay.classList.add("hidden");
  stopTimer();
  btnReset.classList.add("hidden");
  btnSolve.classList.add("hidden");
  btnShuffle.classList.add("hidden");
  btnReplaySolution.classList.remove("hidden");
}

function exitSolutionView() {
  isSolutionView = false;
  btnReset.classList.remove("hidden");
  btnSolve.classList.remove("hidden");
  btnShuffle.classList.remove("hidden");
  btnReplaySolution.classList.add("hidden");
}

function startTimer() {
  if (timerInterval) return;
  timerStart = Date.now();
  timerEl.textContent = "00:00";
  timerInterval = window.setInterval(() => {
    timerEl.textContent = formatElapsed(Date.now() - timerStart);
  }, 1000);
}

function stopTimer() {
  if (!timerInterval) return;
  window.clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  startTimer();
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function applyVictoryStyles() {
  document.querySelectorAll(".meld-group").forEach((group) => {
    group.classList.remove("invalid");
    group.classList.add("valid");
  });
}

function clearVictoryStyles() {
  document.querySelectorAll(".meld-group").forEach((group) => {
    group.classList.remove("valid", "invalid");
  });
}

function resolveBoardOverlapsLocal(group) {
  const boardRect = boardEl.getBoundingClientRect();
  const others = Array.from(boardEl.querySelectorAll(".meld-group")).filter((g) => g !== group);
  const placedRects = others.map((g) => measureGroup(g, boardRect));

  for (let i = 0; i < 40; i += 1) {
    const current = measureGroup(group, boardRect);
    const overlap = placedRects.find((rect) => rectsOverlap(current, rect));
    if (!overlap) return;
    nudgeGroup(group, boardRect, current, overlap);
  }

  const fallback = findFirstGap(boardRect, group.offsetWidth, group.offsetHeight, placedRects);
  group.style.left = `${fallback.x}px`;
  group.style.top = `${fallback.y}px`;
}

function nudgeGroup(group, boardRect, current, overlap) {
  const currentCenter = {
    x: current.x + current.width / 2,
    y: current.y + current.height / 2
  };
  const overlapCenter = {
    x: overlap.x + overlap.width / 2,
    y: overlap.y + overlap.height / 2
  };
  const dx = currentCenter.x - overlapCenter.x || 1;
  const dy = currentCenter.y - overlapCenter.y || 1;
  const len = Math.hypot(dx, dy) || 1;
  const step = 18;
  const nextX = current.x + (dx / len) * step;
  const nextY = current.y + (dy / len) * step;

  const clampedX = Math.max(12, Math.min(boardRect.width - current.width - 12, nextX));
  const clampedY = Math.max(12, Math.min(boardRect.height - current.height - 12, nextY));
  group.style.left = `${clampedX}px`;
  group.style.top = `${clampedY}px`;
}

function isPointInside(event, element) {
  const rect = element.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function isInteractionLocked() {
  return hasWon && !isSolutionView;
}
