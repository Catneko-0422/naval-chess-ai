// src/store/gameStore.ts
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

interface LastMove {
  attacker: string;
  x: number;
  y: number;
  hit: boolean;
}

interface GameState {
  ships: Ship[];
  socket: Socket | null;
  gameStatus: "waiting" | "playing" | "finished";
  currentTurn: string | null;
  playerId: string | null;
  opponentId: string | null;
  roomId: string | null;
  isAiGame: boolean;
  mySide: "player1" | "player2" | null;
  opponentSide: "player1" | "player2" | null;
  sunkenShips: number[];
  opponent_sunkenShips: number[];
  opponentSunkenShipsDetail: Ship[];
  lastMove: LastMove | null;
  lastSunken: number[];
  opMatrix: number[][];
  myMatrix: number[][];

  setOpMatrixCell: (x: number, y: number, v: number) => void;
  setMyMatrixCell: (x: number, y: number, v: number) => void;
  setPlayerId: (id: string) => void;
  setOpponentId: (id: string) => void;
  setMySide: (side: "player1" | "player2") => void;
  setOpponentSide: (side: "player1" | "player2") => void;
  setSunkenShips: (ids: number[]) => void;
  setOpponent_SunkenShips: (ids: number[]) => void;
  setOpponentSunkenShipsDetail: (ships: Ship[]) => void;
  setLastMove: (lm: LastMove) => void;
  setLastSunken: (ids: number[]) => void;

  initializeShips: () => void;
  moveShip: (id: number, row: number, col: number) => void;
  rotateShip: (id: number) => void;
  showShips: (ships: Ship[]) => number[][];
  connectToServer: () => void;
  joinGame: (isAi: boolean) => void;
  makeMove: (x: number, y: number) => void;
}

const GRID_SIZE = 10;
const emptyMatrix = () =>
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default create<GameState>((set, get) => ({
  ships: [],
  socket: null,
  gameStatus: "waiting",
  currentTurn: null,
  playerId: null,
  opponentId: null,
  roomId: null,
  isAiGame: false,
  mySide: null,
  opponentSide: null,
  sunkenShips: [],
  opponent_sunkenShips: [],
  opponentSunkenShipsDetail: [],
  lastMove: null,
  lastSunken: [],
  opMatrix: emptyMatrix(),
  myMatrix: emptyMatrix(),

  setOpMatrixCell: (x, y, v) =>
    set(state => {
      const m = state.opMatrix.map(r => r.slice());
      m[x][y] = v;
      return { opMatrix: m };
    }),
  setMyMatrixCell: (x, y, v) =>
    set(state => {
      const m = state.myMatrix.map(r => r.slice());
      m[x][y] = v;
      return { myMatrix: m };
    }),
  setPlayerId: id => set({ playerId: id }),
  setOpponentId: id => set({ opponentId: id }),
  setMySide: side => set({ mySide: side }),
  setOpponentSide: side => set({ opponentSide: side }),
  setSunkenShips: ids => set({ sunkenShips: ids }),
  setOpponent_SunkenShips: ids => set({ opponent_sunkenShips: ids }),
  setOpponentSunkenShipsDetail: ships => set({ opponentSunkenShipsDetail: ships }),
  setLastMove: lm => set({ lastMove: lm }),
  setLastSunken: ids => set({ lastSunken: ids }),

  initializeShips: async () => {
    const res = await fetch(`${API}/api/generate_board`);
    const data = await res.json();
    const shipsWithImage = data.ships.map((s: Ship) => ({
      ...s,
      imageId: s.size === 3 && s.id === 2 ? 2 : s.size,
    }));
    set({ ships: shipsWithImage });
  },

  moveShip: (id, targetRow, targetCol) => {
    const ships = get().ships;
    const ship = ships.find(s => s.id === id);
    if (!ship) return;
    const others = ships.filter(s => s.id !== id);
    const { row, col } = findNearestValidPosition(
      targetRow, targetCol, ship.orientation, ship.size, others
    );
    set(state => ({
      ships: state.ships.map(s =>
        s.id === id ? { ...s, row, col } : s
      ),
    }));
  },
  rotateShip: id => {
    const ships = get().ships;
    const ship = ships.find(s => s.id === id);
    if (!ship) return;
    const newOri = ship.orientation === "horizontal" ? "vertical" : "horizontal";
    const others = ships.filter(s => s.id !== id);
    const { row, col } = findNearestValidPosition(
      ship.row, ship.col, newOri, ship.size, others
    );
    set(state => ({
      ships: state.ships.map(s =>
        s.id === id ? { ...s, orientation: newOri, row, col } : s
      ),
    }));
  },
  showShips: ships => {
    const m = emptyMatrix();
    ships.forEach(sh =>
      Array(sh.size).fill(0).forEach((_, i) => {
        const r = sh.orientation === "vertical" ? sh.row + i : sh.row;
        const c = sh.orientation === "horizontal" ? sh.col + i : sh.col;
        m[r][c] = 1;
      })
    );
    return m;
  },

  connectToServer: () => {
    const socket = io(API, { transports: ["websocket"] });
    socket.on("connect", () => set({ socket }));

    socket.on("joined_game", async ({ room_id }) => {
      set({ roomId: room_id });

      if (!get().isAiGame) {
        try {
          const res = await fetch(`${API}/api/opponent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room_id,
              player: get().playerId!
            }),
          });
          if (!res.ok) {
            console.error("查詢 /api/opponent 失敗：", await res.text());
            return;
          }
          const { your_side, opponent_side, opponent_id } = await res.json();
          set({
            mySide: your_side,
            opponentSide: opponent_side,
            opponentId: opponent_id
          });
        } catch (e) {
          console.error("呼叫 /api/opponent 發生錯誤：", e);
        }
      }
    });

    socket.on("match_success", ({ room_id, player }) => {
      set({
        roomId: room_id,
        mySide: player,
        opponentSide: player === "player1" ? "player2" : "player1"
      });
    });

    socket.on("game_started", ({ first_turn }) =>
      set({ gameStatus: "playing", currentTurn: first_turn })
    );

    socket.on("move_made", async ({ attacker, x, y, hit }) => {
      const prev = get().sunkenShips;
      set({ lastSunken: [] });
      set({ lastMove: { attacker, x, y, hit } });

      if (attacker === get().playerId) {
        get().setOpMatrixCell(x, y, hit ? 2 : 3);
      } else {
        get().setMyMatrixCell(x, y, hit ? 2 : 3);
      }

      const nextTurn = hit
        ? attacker
        : attacker === get().playerId
          ? get().opponentId!
          : get().playerId!;
      set({ currentTurn: nextTurn });

      if (hit && get().roomId && get().opponentSide) {
        const targetSide =
          attacker === get().playerId
            ? get().opponentSide!
            : get().mySide!;
        try {
          const res = await fetch(`${API}/api/sunken_ships`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room_id: get().roomId,
              player: targetSide
            }),
          });
          if (res.ok) {
            const { sunken_ship_ids, sunken_ships } = await res.json();
            const newIds = sunken_ship_ids.filter((i: number) => !prev.includes(i));
            set({
              sunkenShips: sunken_ship_ids,
              lastSunken: newIds,
              opponent_sunkenShips: attacker === get().playerId ? sunken_ship_ids : get().opponent_sunkenShips,
              opponentSunkenShipsDetail: attacker === get().playerId ? sunken_ships : get().opponentSunkenShipsDetail
            });
          } else {
            console.error("Bad /api/sunken_ships：", await res.text());
          }
        } catch (e) {
          console.error("沉艦查詢失敗：", e);
        }
      }
    });

    socket.on("game_over", () => set({ gameStatus: "finished" }));
  },

  joinGame: (isAi = false) => {
    const { socket, ships, playerId } = get();
    if (!socket || !playerId) return;

    set({ isAiGame: isAi });
    if (isAi) {
      set({
        opponentId: "AI",
        mySide: "player1",
        opponentSide: "player2"
      });
    } else {
      set({
        opponentId: null,
        mySide: null,
        opponentSide: null
      });
    }

    const board = emptyMatrix();
    ships.forEach(ship =>
      Array(ship.size).fill(0).forEach((_, i) => {
        const r = ship.orientation === "vertical" ? ship.row + i : ship.row;
        const c = ship.orientation === "horizontal" ? ship.col + i : ship.col;
        board[r][c] = 1;
      })
    );

    socket.emit("join_game", {
      player_id: playerId,
      board,
      ships,
      is_ai_game: isAi
    });
  },

  makeMove: (x, y) => {
    const { socket, roomId, playerId, currentTurn } = get();
    if (!socket || !roomId || currentTurn !== playerId) return;
    socket.emit("make_move", { room_id: roomId, player: playerId, x, y });
  },
}));

function findNearestValidPosition(
  targetRow: number,
  targetCol: number,
  orientation: "horizontal" | "vertical",
  size: number,
  otherShips: Ship[]
): { row: number; col: number } {
  const max = GRID_SIZE;
  const clampRow = Math.min(
    Math.max(0, targetRow),
    orientation === "vertical" ? max - size : max - 1
  );
  const clampCol = Math.min(
    Math.max(0, targetCol),
    orientation === "horizontal" ? max - size : max - 1
  );
  for (let radius = 0; radius <= 3; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const r = clampRow + dr;
        const c = clampCol + dc;
        if (r < 0 || c < 0) continue;
        if (orientation === "vertical" && r + size > max) continue;
        if (orientation === "horizontal" && c + size > max) continue;
        const coords = Array.from({ length: size }, (_, i) => ({
          r: orientation === "vertical" ? r + i : r,
          c: orientation === "horizontal" ? c + i : c
        }));
        const overlap = otherShips.some(os =>
          coords.some(pt =>
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