import { create } from "zustand";
import { io, Socket } from "socket.io-client";

export interface Ship {
  id: number;
  size: number;
  row: number;
  col: number;
  orientation: "horizontal" | "vertical";
  imageId?: number;
}

interface GameState {
  ships: Ship[];
  socket: Socket | null;
  gameStatus: "waiting" | "playing" | "finished";
  currentTurn: string | null;
  opponentId: string | null;
  roomId: string | null;
  playerId: string | null;
  setPlayerId: (id: string) => void;
  initializeShips: () => void;
  moveShip: (id: number, row: number, col: number) => void;
  rotateShip: (id: number) => void;
  showShips: (ships: Ship[]) => number[][];
  connectToServer: () => void;
  joinGame: () => void;
  makeMove: (x: number, y: number) => void;
}

const useGameStore = create<GameState>((set, get) => ({
  ships: [],
  socket: null,
  gameStatus: "waiting",
  currentTurn: null,
  opponentId: null,
  roomId: null,
  playerId: null,
  setPlayerId: (id) => set({ playerId: id }),

  initializeShips: async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/generate_board`
    );
    const data = await res.json();
    // 给第二艘 size=3 的船分配 imageId=2
    const shipsWithImage = data.ships.map((s: Ship) => ({
      ...s,
      imageId: s.size === 3 && s.id === 2 ? 2 : s.size,
    }));
    set({ ships: shipsWithImage });
  },

  connectToServer: () => {
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
      { transports: ["websocket"] }
    );
    socket.on("connect", () => set({ socket }));
    socket.on("match_success", ({ room_id }) => set({ roomId: room_id }));
    socket.on("game_started", ({ first_turn }) =>
      set({ gameStatus: "playing", currentTurn: first_turn })
    );
    socket.on("move_made", ({ attacker, x, y, hit }) => {
      const nextTurn =
        attacker === get().currentTurn
          ? attacker === get().playerId
            ? get().opponentId
            : get().playerId
          : attacker;
      set({ currentTurn: nextTurn });
    });
    socket.on("game_over", ({ winner }) => set({ gameStatus: "finished" }));
  },

  joinGame: () => {
    const { socket, ships, playerId } = get();
    if (!socket || !playerId) return;
    const board = Array.from({ length: 10 }, () => Array(10).fill(0));
    ships.forEach((ship) =>
      Array(ship.size)
        .fill(0)
        .forEach((_, i) => {
          const r = ship.orientation === "vertical" ? ship.row + i : ship.row;
          const c = ship.orientation === "horizontal" ? ship.col + i : ship.col;
          board[r][c] = 1;
        })
    );
    socket.emit("join_game", {
      player_id: playerId,
      board,
      ships,
      is_ai_game: false,
    });
  },

  makeMove: (x, y) => {
    const { socket, roomId, playerId, currentTurn } = get();
    if (!socket || !roomId || currentTurn !== playerId) return;
    socket.emit("make_move", { room_id: roomId, player: playerId, x, y });
  },

  moveShip: (id, row, col) => {
    set((s) => ({
      ships: s.ships.map((sh) => (sh.id === id ? { ...sh, row, col } : sh)),
    }));
  },

  rotateShip: (id) => {
    set((s) => ({
      ships: s.ships.map((sh) =>
        sh.id === id
          ? {
              ...sh,
              orientation:
                sh.orientation === "horizontal" ? "vertical" : "horizontal",
            }
          : sh
      ),
    }));
  },

  showShips: (ships) => {
    const m = Array.from({ length: 10 }, () => Array(10).fill(0));
    ships.forEach((sh) =>
      Array(sh.size)
        .fill(0)
        .forEach((_, i) => {
          const r = sh.orientation === "vertical" ? sh.row + i : sh.row;
          const c = sh.orientation === "horizontal" ? sh.col + i : sh.col;
          m[r][c] = 1;
        })
    );
    return m;
  },
}));

export default useGameStore;
