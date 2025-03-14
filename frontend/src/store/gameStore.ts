import { create } from "zustand";

export interface Ship {
  id: number;
  size: number;
  row: number;
  col: number;
  orientation: "horizontal" | "vertical";
}

interface GameState {
  ships: Ship[];
  initializeShips: () => void;
  moveShip: (id: number, row: number, col: number) => void;
  rotateShip: (id: number) => void;
}

// 確保船隻不會與其他船隻重疊
const checkCollision = (
  ships: Ship[],
  id: number,
  newOccupiedCells: { row: number; col: number }[],
) => {
  return ships.some(
    (ship) =>
      ship.id !== id &&
      newOccupiedCells.some((cell) =>
        ship.orientation === "horizontal"
          ? cell.row === ship.row &&
            cell.col >= ship.col &&
            cell.col < ship.col + ship.size
          : cell.col === ship.col &&
            cell.row >= ship.row &&
            cell.row < ship.row + ship.size,
      ),
  );
};

// 計算新的佔據格子
const calculateOccupiedCells = (
  row: number,
  col: number,
  size: number,
  orientation: "horizontal" | "vertical",
): { row: number; col: number }[] => {
  const occupiedCells: { row: number; col: number }[] = [];
  for (let i = 0; i < size; i++) {
    if (orientation === "horizontal") {
      occupiedCells.push({ row, col: col + i });
    } else {
      occupiedCells.push({ row: row + i, col });
    }
  }
  return occupiedCells;
};

// 隨機生成船隻位置
const getRandomPosition = (
  size: number,
  boardSize: number,
): { row: number; col: number; orientation: "horizontal" | "vertical" } => {
  const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
  const row = Math.floor(
    Math.random() * (boardSize - (orientation === "vertical" ? size : 0)),
  );
  const col = Math.floor(
    Math.random() * (boardSize - (orientation === "horizontal" ? size : 0)),
  );
  return { row, col, orientation };
};

const boardSize = 10;
const useGameStore = create<GameState>((set) => ({
  ships: [],

  showShips: (ships: Ship[]) => {
    //建立 10x10 的0 矩陣
    const matrix = Array.from({ length: boardSize }, () =>
      Array(boardSize).fill(0),
    );

    ships.forEach(({ row, col, size, orientation }) => {
      const isVertical = orientation === "horizontal";

      for (let i = 0; i < size; i++) {
        const r = row + (isVertical ? 0 : i);
        const c = col + (isVertical ? i : 0);
        matrix[r][c] = 1;
      }
    });

    return matrix;
  },

  initializeShips: () => {
    const shipSizes = [2, 3, 3, 4, 5];
    const newShips: Ship[] = [];
    const boardSize = 10;

    shipSizes.forEach((size, index) => {
      let position: {
        row: number;
        col: number;
        orientation: "horizontal" | "vertical";
      };

      do {
        position = getRandomPosition(size, boardSize);
      } while (
        newShips.some(
          (ship) =>
            (position.orientation === "horizontal" &&
              ship.row === position.row &&
              ship.col <= position.col + size &&
              ship.col + ship.size >= position.col) ||
            (position.orientation === "vertical" &&
              ship.col === position.col &&
              ship.row <= position.row + size &&
              ship.row + ship.size >= position.row),
        )
      );

      newShips.push({
        id: index,
        size,
        row: position.row,
        col: position.col,
        orientation: position.orientation,
      });
    });

    set({ ships: newShips });
  },

  moveShip: (id, row, col) =>
    set((state) => {
      const boardSize = 10;
      const shipToMove = state.ships.find((ship) => ship.id === id);
      if (!shipToMove) return state; // 找不到該船隻則直接返回

      let newRow = row;
      let newCol = col;

      // 確保新位置不會超出邊界
      if (
        shipToMove.orientation === "horizontal" &&
        newCol + shipToMove.size > boardSize
      ) {
        newCol = boardSize - shipToMove.size;
      }
      if (
        shipToMove.orientation === "vertical" &&
        newRow + shipToMove.size > boardSize
      ) {
        newRow = boardSize - shipToMove.size;
      }

      // 計算新位置的所有佔據格子
      const newOccupiedCells = calculateOccupiedCells(
        newRow,
        newCol,
        shipToMove.size,
        shipToMove.orientation,
      );

      // 檢查是否與其他船隻重疊
      if (checkCollision(state.ships, id, newOccupiedCells)) {
        // 嘗試尋找合法位置
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            const tempRow = r;
            const tempCol = c;

            if (
              shipToMove.orientation === "horizontal" &&
              tempCol + shipToMove.size > boardSize
            )
              continue;
            if (
              shipToMove.orientation === "vertical" &&
              tempRow + shipToMove.size > boardSize
            )
              continue;

            const tempOccupiedCells = calculateOccupiedCells(
              tempRow,
              tempCol,
              shipToMove.size,
              shipToMove.orientation,
            );

            if (!checkCollision(state.ships, id, tempOccupiedCells)) {
              newRow = tempRow;
              newCol = tempCol;
              break;
            }
          }
        }
      }

      console.log(
        `船隻 ${id} 移動到 (${newRow}, ${newCol}), 方向: ${shipToMove.orientation}`,
      );

      const updatedShips = state.ships.map((ship) =>
        ship.id === id ? { ...ship, row: newRow, col: newCol } : ship,
      );

      // 計算所有被船隻佔據的格子
      const occupiedCells: { row: number; col: number }[] = [];
      updatedShips.forEach((ship) => {
        const shipOccupiedCells = calculateOccupiedCells(
          ship.row,
          ship.col,
          ship.size,
          ship.orientation,
        );
        occupiedCells.push(...shipOccupiedCells);
      });

      console.log("所有被船隻佔據的格子:", occupiedCells);

      return { ships: updatedShips };
    }),

  rotateShip: (id) =>
    set((state) => {
      const boardSize = 10;
      const shipToRotate = state.ships.find((ship) => ship.id === id);
      if (!shipToRotate) return state; // 找不到該船隻則直接返回

      const newOrientation: "horizontal" | "vertical" =
        shipToRotate.orientation === "horizontal" ? "vertical" : "horizontal";
      let newRow = shipToRotate.row;
      let newCol = shipToRotate.col;

      // 計算旋轉後的所有佔據格子
      const newOccupiedCells = calculateOccupiedCells(
        newRow,
        newCol,
        shipToRotate.size,
        newOrientation,
      );

      // 確保旋轉後的船隻不會超出邊界
      if (
        newOrientation === "horizontal" &&
        newCol + shipToRotate.size > boardSize
      ) {
        newCol = boardSize - shipToRotate.size;
      }
      if (
        newOrientation === "vertical" &&
        newRow + shipToRotate.size > boardSize
      ) {
        newRow = boardSize - shipToRotate.size;
      }

      // 檢查是否會與其他船隻重疊
      if (checkCollision(state.ships, id, newOccupiedCells)) {
        // 嘗試尋找合法的移動位置
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            const tempRow = r;
            const tempCol = c;

            if (
              newOrientation === "horizontal" &&
              tempCol + shipToRotate.size > boardSize
            )
              continue;
            if (
              newOrientation === "vertical" &&
              tempRow + shipToRotate.size > boardSize
            )
              continue;

            const tempOccupiedCells = calculateOccupiedCells(
              tempRow,
              tempCol,
              shipToRotate.size,
              newOrientation,
            );

            if (!checkCollision(state.ships, id, tempOccupiedCells)) {
              newRow = tempRow;
              newCol = tempCol;
              break;
            }
          }
        }
      }

      console.log(
        `船隻 ${id} 旋轉為 ${newOrientation} 方向, 位置: (${newRow}, ${newCol})`,
      );

      const updatedShips = state.ships.map((ship) =>
        ship.id === id
          ? { ...ship, row: newRow, col: newCol, orientation: newOrientation }
          : ship,
      );

      return { ships: updatedShips };
    }),
}));

export default useGameStore;
