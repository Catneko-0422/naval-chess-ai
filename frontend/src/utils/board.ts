import { Ship } from "@/store/gameStore";

export const GRID_SIZE = 10;

export const SHIP_NAMES = [
  "海防艦 (Escort)",
  "驅逐艦 (Destroyer)",
  "巡洋艦 (Cruiser)",
  "戰艦 (Battleship)",
  "航空母艦 (Carrier)",
];

export function emptyMatrix(): number[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

export function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map((r) => r.slice());
}

export function buildShipImageUrl(ship: Ship): string {
  const { size, orientation, imageId } = ship;
  const dir = orientation === "horizontal" ? "h" : "v";
  const suffix = imageId !== undefined && imageId !== size ? `-${imageId}` : "";
  return `/images/ships/ship-${size}-${dir}${suffix}.png`;
}

export function shipsToMatrix(ships: Ship[]): number[][] {
  const m = emptyMatrix();
  ships.forEach((ship) => {
    for (let i = 0; i < ship.size; i++) {
      const r = ship.orientation === "vertical" ? ship.row + i : ship.row;
      const c = ship.orientation === "horizontal" ? ship.col + i : ship.col;
      m[r][c] = 1;
    }
  });
  return m;
}

export function findNearestValidPosition(
  targetRow: number,
  targetCol: number,
  orientation: "horizontal" | "vertical",
  size: number,
  otherShips: Ship[]
): { row: number; col: number } {
  const clampRow = Math.min(
    Math.max(0, targetRow),
    orientation === "vertical" ? GRID_SIZE - size : GRID_SIZE - 1
  );
  const clampCol = Math.min(
    Math.max(0, targetCol),
    orientation === "horizontal" ? GRID_SIZE - size : GRID_SIZE - 1
  );

  for (let radius = 0; radius <= 3; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = clampRow + dr;
        const c = clampCol + dc;

        if (r < 0 || c < 0) continue;
        if (orientation === "vertical" && r + size > GRID_SIZE) continue;
        if (orientation === "horizontal" && c + size > GRID_SIZE) continue;

        const coords = Array.from({ length: size }, (_, i) => ({
          r: orientation === "vertical" ? r + i : r,
          c: orientation === "horizontal" ? c + i : c,
        }));

        const overlap = otherShips.some((os) =>
          coords.some((pt) =>
            os.orientation === "vertical"
              ? pt.c === os.col && pt.r >= os.row && pt.r < os.row + os.size
              : pt.r === os.row && pt.c >= os.col && pt.c < os.col + os.size
          )
        );
        if (!overlap) return { row: r, col: c };
      }
    }
  }

  return { row: clampRow, col: clampCol };
}
