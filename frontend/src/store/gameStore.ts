import { create } from "zustand";
import { io, Socket } from "socket.io-client";

export interface Ship {
  id: number;
  size: number;
  row: number;
  col: number;
  orientation: "horizontal" | "vertical";
}

interface GameState {
  ships: Ship[];
  socket: Socket | null;
  gameStatus: "waiting" | "playing" | "finished";
  currentTurn: string | null;
  opponentId: string | null;
  roomId: string | null;
  isLocalMultiplayer: boolean;
  localPlayerId: string | null;
  localOpponentId: string | null;
  initializeShips: () => void;
  moveShip: (id: number, row: number, col: number) => void;
  rotateShip: (id: number) => void;
  showShips: (ships: Ship[]) => number[][];
  connectToServer: () => void;
  joinGame: () => void;
  updateBoard: (board: number[][]) => void;
  makeMove: (move: { row: number; col: number }) => void;
  startLocalMultiplayer: () => void;
  makeLocalMove: (move: { row: number; col: number }) => void;
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

const useGameStore = create<GameState>((set, get) => ({
  ships: [],
  socket: null,
  gameStatus: "waiting",
  currentTurn: null,
  opponentId: null,
  roomId: null,
  isLocalMultiplayer: false,
  localPlayerId: null,
  localOpponentId: null,

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

  connectToServer: () => {
    const socket = io('wss://naval-backend.nekocat.cc', {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      secure: true,
      rejectUnauthorized: false,
      forceNew: true
    });
    
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("waiting_for_opponent", () => {
      set({ gameStatus: "waiting" });
    });

    socket.on("game_started", (data) => {
      set({
        gameStatus: "playing",
        roomId: data.room_id,
        opponentId: data.player1 === socket.id ? data.player2 : data.player1,
        currentTurn: data.current_turn,
      });
    });

    socket.on("board_updated", (data) => {
      // 處理對手的棋盤更新
      console.log("Board updated by opponent:", data);
    });

    socket.on("move_made", (data) => {
      set({ currentTurn: data.next_turn });
    });

    socket.on("player_disconnected", () => {
      set({ gameStatus: "finished" });
    });

    set({ socket });
  },

  joinGame: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("join_game");
    }
  },

  updateBoard: (board) => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit("update_board", { board });
    }
  },

  makeMove: (move) => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit("make_move", { move });
    }
  },

  moveShip: (id, row, col) => {
    set((state) => {
      const boardSize = 10;
      const shipToMove = state.ships.find((ship) => ship.id === id);
      if (!shipToMove) return state;

      let newRow = row;
      let newCol = col;

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

      const newOccupiedCells = calculateOccupiedCells(
        newRow,
        newCol,
        shipToMove.size,
        shipToMove.orientation,
      );

      if (checkCollision(state.ships, id, newOccupiedCells)) {
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

      const updatedShips = state.ships.map((ship) =>
        ship.id === id ? { ...ship, row: newRow, col: newCol } : ship,
      );

      return { ships: updatedShips };
    });
  },

  rotateShip: (id) => {
    set((state) => {
      const boardSize = 10;
      const shipToRotate = state.ships.find((ship) => ship.id === id);
      if (!shipToRotate) return state;

      const newOrientation: "horizontal" | "vertical" =
        shipToRotate.orientation === "horizontal" ? "vertical" : "horizontal";
      let newRow = shipToRotate.row;
      let newCol = shipToRotate.col;

      const newOccupiedCells = calculateOccupiedCells(
        newRow,
        newCol,
        shipToRotate.size,
        newOrientation,
      );

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

      if (checkCollision(state.ships, id, newOccupiedCells)) {
        return state;
      }

      const updatedShips = state.ships.map((ship) =>
        ship.id === id
          ? { ...ship, orientation: newOrientation, row: newRow, col: newCol }
          : ship,
      );

      return { ships: updatedShips };
    });
  },

  showShips: (ships) => {
    const boardSize = 10;
    const matrix = Array.from({ length: boardSize }, () =>
      Array(boardSize).fill(0),
    );

    ships.forEach(({ row, col, size, orientation }) => {
      const isVertical = orientation === "vertical";

      for (let i = 0; i < size; i++) {
        const r = row + (isVertical ? i : 0);
        const c = col + (isVertical ? 0 : i);
        matrix[r][c] = 1;
      }
    });

    return matrix;
  },

  startLocalMultiplayer: () => {
    const playerId = Math.random().toString(36).substring(7);
    const opponentId = Math.random().toString(36).substring(7);
    set({
      isLocalMultiplayer: true,
      localPlayerId: playerId,
      localOpponentId: opponentId,
      gameStatus: "playing",
      currentTurn: playerId
    });
  },

  makeLocalMove: (move: { row: number; col: number }) => {
    const { localPlayerId, localOpponentId, currentTurn } = get();
    if (currentTurn === localPlayerId) {
      set({ currentTurn: localOpponentId });
    } else {
      set({ currentTurn: localPlayerId });
    }
    // 在這裡處理移動邏輯
    console.log("Move made:", move);
  },
}));

export default useGameStore;
