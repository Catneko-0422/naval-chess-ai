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
  // 棋盤、Socket、狀態
  ships: Ship[];
  socket: Socket | null;
  gameStatus: "waiting" | "playing" | "finished";
  currentTurn: string | null;
  // Player IDs
  playerId: string | null;
  opponentId: string | null;       // 真實的對手 ID（UUID 或 "AI"）
  roomId: string | null;
  isAiGame: boolean;
  // Side
  mySide: "player1" | "player2" | null;
  opponentSide: "player1" | "player2" | null;
  // 擊沉
  sunkenShips: number[];
  lastMove: LastMove | null;
  lastSunken: number[];
  // 矩陣
  opMatrix: number[][];
  myMatrix: number[][];
  // setter
  setOpMatrixCell: (x: number, y: number, v: number) => void;
  setMyMatrixCell: (x: number, y: number, v: number) => void;
  setPlayerId: (id: string) => void;
  setMySide: (s: "player1" | "player2") => void;
  setOpponentSide: (s: "player1" | "player2") => void;
  setSunkenShips: (ids: number[]) => void;
  setLastMove: (lm: LastMove) => void;
  setLastSunken: (ids: number[]) => void;
  // actions
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
  lastMove: null,
  lastSunken: [],
  opMatrix: emptyMatrix(),
  myMatrix: emptyMatrix(),

  // ---- setters ----
  setOpMatrixCell: (x, y, v) =>
    set((state) => {
      const m = state.opMatrix.map((r) => r.slice());
      m[x][y] = v;
      return { opMatrix: m };
    }),
  setMyMatrixCell: (x, y, v) =>
    set((state) => {
      const m = state.myMatrix.map((r) => r.slice());
      m[x][y] = v;
      return { myMatrix: m };
    }),
  setPlayerId: (id) => set({ playerId: id }),
  setMySide: (s) => set({ mySide: s }),
  setOpponentSide: (s) => set({ opponentSide: s }),
  setSunkenShips: (ids) => set({ sunkenShips: ids }),
  setLastMove: (lm) => set({ lastMove: lm }),
  setLastSunken: (ids) => set({ lastSunken: ids }),

  // ---- 初始化隨機排艦 ----
  initializeShips: async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/generate_board`
    );
    const data = await res.json();
    const shipsWithImage = data.ships.map((s: Ship) => ({
      ...s,
      imageId: s.size === 3 && s.id === 2 ? 2 : s.size,
    }));
    set({ ships: shipsWithImage });
  },

  // ---- 拖放排艦邏輯 ----
  moveShip: (id, targetRow, targetCol) => {
    const ships = get().ships;
    const ship = ships.find((s) => s.id === id);
    if (!ship) return;
    const others = ships.filter((s) => s.id !== id);
    const { row, col } = findNearestValidPosition(
      targetRow,
      targetCol,
      ship.orientation,
      ship.size,
      others
    );
    set((state) => ({
      ships: state.ships.map((s) =>
        s.id === id ? { ...s, row, col } : s
      ),
    }));
  },
  rotateShip: (id) => {
    const ships = get().ships;
    const ship = ships.find((s) => s.id === id);
    if (!ship) return;
    const newOri =
      ship.orientation === "horizontal" ? "vertical" : "horizontal";
    const others = ships.filter((s) => s.id !== id);
    const { row, col } = findNearestValidPosition(
      ship.row,
      ship.col,
      newOri,
      ship.size,
      others
    );
    set((state) => ({
      ships: state.ships.map((s) =>
        s.id === id
          ? { ...s, orientation: newOri, row, col }
          : s
      ),
    }));
  },
  showShips: (ships) => {
    const m = emptyMatrix();
    ships.forEach((sh) =>
      Array(sh.size)
        .fill(0)
        .forEach((_, i) => {
          const r =
            sh.orientation === "vertical" ? sh.row + i : sh.row;
          const c =
            sh.orientation === "horizontal" ? sh.col + i : sh.col;
          m[r][c] = 1;
        })
    );
    return m;
  },

  // ---- WebSocket & API ----
  connectToServer: () => {
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
      { transports: ["websocket"] }
    );
    socket.on("connect", () => set({ socket }));

    // 收到 room_id，PVP 時再去查 side
    socket.on("joined_game", async ({ room_id }) => {
      set({ roomId: room_id });
      if (!get().isAiGame) {
        // 請後端告訴我自己是 player1 還是 player2
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/opponent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                room_id,
                player: get().playerId!,
              }),
            }
          );
          if (!res.ok) {
            console.error("查詢 side 失敗：", await res.text());
            return;
          }
          const { your_side, opponent_side } = await res.json();
          set({ mySide: your_side, opponentSide: opponent_side });
        } catch (e) {
          console.error("呼叫 /api/opponent 發生錯誤", e);
        }
      }
    });

    // 備援：match_success 也同時回我們一組 side
    socket.on("match_success", ({ room_id }) => {
      const myId = get().playerId!;
      const side = myId === "player1" ? "player1" : "player2";
      set({
        roomId: room_id,
        mySide: side,
        opponentSide: side === "player1" ? "player2" : "player1",
      });
    });

    socket.on("game_started", ({ first_turn }) =>
      set({ gameStatus: "playing", currentTurn: first_turn })
    );

    socket.on("move_made", async ({ attacker, x, y, hit }) => {
      const prev = get().sunkenShips;
      set({ lastSunken: [] });
      set({ lastMove: { attacker, x, y, hit } });

      // 更新矩陣
      if (attacker === get().playerId) {
        get().setOpMatrixCell(x, y, hit ? 2 : 3);
      } else {
        get().setMyMatrixCell(x, y, hit ? 2 : 3);
      }

      // 換回合 or 繼續打
      const nextTurn = hit
        ? attacker
        : attacker === get().playerId
        ? get().opponentId!
        : get().playerId!;
      set({ currentTurn: nextTurn });

      // 命中就查沉艦
      const { roomId, opponentSide, mySide } = get();
      if (hit && roomId && opponentSide && mySide) {
        // 決定要查哪一方的船
        const targetSide =
          attacker === get().playerId ? opponentSide : mySide;
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/sunken_ships`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                room_id: roomId,
                player: targetSide,
              }),
            }
          );
          if (res.ok) {
            const { sunken_ship_ids } = await res.json();
            const newIds = sunken_ship_ids.filter((i) => !prev.includes(i));
            set({
              sunkenShips: sunken_ship_ids,
              lastSunken: newIds,
            });
          } else {
            console.error("Bad /api/sunken_ships:", await res.text());
          }
        } catch (e) {
          console.error("沉艦查詢失敗", e);
        }
      }
    });

    socket.on("game_over", () => set({ gameStatus: "finished" }));
  },

  // 加入遊戲（PVP / PVE）
  joinGame: (isAi = false) => {
    const { socket, ships, playerId } = get();
    if (!socket || !playerId) return;

    // AI 場預設
    set({ isAiGame: isAi });
    if (isAi) {
      set({
        opponentId: "AI",
        mySide: "player1",
        opponentSide: "player2",
      });
    } else {
      set({ opponentId: null, mySide: null, opponentSide: null });
    }

    // 傳送布陣
    const board = emptyMatrix();
    ships.forEach((ship) =>
      Array(ship.size)
        .fill(0)
        .forEach((_, i) => {
          const r = ship.orientation === "vertical"
            ? ship.row + i
            : ship.row;
          const c = ship.orientation === "horizontal"
            ? ship.col + i
            : ship.col;
          board[r][c] = 1;
        })
    );
    socket.emit("join_game", {
      player_id: playerId,
      board,
      ships,
      is_ai_game: isAi,
    });
  },

  makeMove: (x, y) => {
    const { socket, roomId, playerId, currentTurn } = get();
    if (!socket || !roomId || currentTurn !== playerId) return;
    socket.emit("make_move", { room_id: roomId, player: playerId, x, y });
  },
}));

// 幫助：找最近合法位置
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
          c: orientation === "horizontal" ? c + i : c,
        }));
        const overlap = otherShips.some((os) =>
          coords.some((pt) =>
            os.orientation === "vertical"
              ? pt.c === os.col &&
                pt.r >= os.row &&
                pt.r < os.row + os.size
              : pt.r === os.row &&
                pt.c >= os.col &&
                pt.c < os.col + os.size
          )
        );
        if (!overlap) return { row: r, col: c };
      }
    }
  }
  return { row: clampRow, col: clampCol };
}
