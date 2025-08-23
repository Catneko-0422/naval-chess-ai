// src/store/gameStore.ts

/**
 * ============================================================
 * Naval Chess 前端狀態管理（Zustand）
 * Naval Chess Frontend State Management (Zustand)
 * ------------------------------------------------------------
 * ZH:
 * 本檔案負責整個遊戲在前端的狀態（棋盤、玩家、回合、連線）
 * 與後端 API、Socket.IO 事件的整合。提供一組方法用於：
 * - 初始化棋盤與船艦
 * - 移動／旋轉船艦與生成棋盤矩陣
 * - 連線伺服器、加入對戰（真人或 AI）
 * - 送出攻擊、接收回合同步與沉艦資訊
 *
 * EN:
 * This file manages the entire game state on the frontend (boards,
 * players, turns, and socket connection), and integrates with
 * backend REST APIs and Socket.IO. It provides methods to:
 * - Initialize board and ships
 * - Move/rotate ships and render board matrices
 * - Connect to server, join a match (human or AI)
 * - Make attacks and handle turn/sunken updates
 *
 * 使用方式 / Usage:
 * ------------------------------------------------------------
 * // 於 React 元件中使用 useGameStore
 * import useGameStore from "@/stores/game";
 *
 * const {
 *   connectToServer, joinGame, initializeShips, makeMove,
 *   ships, myMatrix, opMatrix, gameStatus, currentTurn
 * } = useGameStore();
 *
 * useEffect(() => {
 *   connectToServer();         // 連線 Socket 伺服器 / connect to Socket server
 *   initializeShips();         // 從後端取得隨機船艦配置 / fetch random ships layout
 * }, []);
 *
 * // 加入遊戲：isAi=true 表示與 AI 對戰；false 為真人對戰
 * joinGame(true);              // Join an AI game
 *
 * // 發動攻擊（x: row, y: col）
 * makeMove(3, 5);
 *
 * 設定環境變數 / Environment:
 * ------------------------------------------------------------
 * NEXT_PUBLIC_API_URL = "http(s)://your-backend-host:port"
 * 若未設定，預設為 http://localhost:5000
 * If not set, default is http://localhost:5000
 * ============================================================
 */

import { create } from "zustand";
import { io, Socket } from "socket.io-client";

/* ------------------------------------------------------------
 * 型別定義 Types
 * ----------------------------------------------------------*/

/**
 * ZH: 定義遊戲中「船艦」的資料結構
 * EN: Define the data structure of a ship in the game
 */
export interface Ship {
    id: number;                               // ZH: 船艦唯一 ID / EN: Unique ship ID
    size: number;                             // ZH: 船艦長度（佔幾格）/ EN: Ship length (number of cells)
    row: number;                              // ZH: 起始列（Row index）/ EN: Starting row index
    col: number;                              // ZH: 起始行（Col index）/ EN: Starting column index
    orientation: "horizontal" | "vertical";   // ZH: 擺放方向 / EN: Orientation
    imageId?: number;                         // ZH: 對應 UI 圖片 ID（可選）/ EN: Optional UI image ID
}

/**
 * ZH: 定義最後一步攻擊資訊
 * EN: Define the data structure of the last move
 */
interface LastMove {
    attacker: string; // ZH: 攻擊者的玩家 ID / EN: Player ID who attacked
    x: number;        // ZH: 攻擊目標列（row）/ EN: Target row index
    y: number;        // ZH: 攻擊目標行（col）/ EN: Target column index
    hit: boolean;     // ZH: 是否擊中 / EN: Whether the attack hit
}

/**
 * ZH: 定義整體遊戲狀態介面（Zustand store 形狀）
 * EN: Define the overall game state interface (Zustand store shape)
 */
interface GameState {
    // ------------- 基本狀態 / Base State -------------
    ships: Ship[];                                  // ZH: 我方船艦清單 / EN: Player's ships
    socket: Socket | null;                          // ZH: Socket.IO 連線物件 / EN: Socket.IO connection
    gameStatus: "waiting" | "playing" | "finished"; // ZH: 遊戲狀態 / EN: Game status
    currentTurn: string | null;                     // ZH: 當前回合玩家 ID / EN: Whose turn (player ID)
    playerId: string | null;                        // ZH: 本機玩家 ID / EN: Local player ID
    opponentId: string | null;                      // ZH: 對手玩家 ID / EN: Opponent player ID
    roomId: string | null;                          // ZH: 遊戲房間 ID / EN: Room ID
    isAiGame: boolean;                              // ZH: 是否為 AI 對戰 / EN: Is AI game
    mySide: "player1" | "player2" | null;           // ZH: 我方陣營 / EN: Which side I am
    opponentSide: "player1" | "player2" | null;     // ZH: 對手陣營 / EN: Opponent side

    // ------------- 棋盤與戰況 / Boards & Battle -------------
    sunkenShips: number[];                          // ZH: 我方被擊沉船艦 ID / EN: My sunken ship IDs
    opponent_sunkenShips: number[];                 // ZH: 對手被擊沉船艦 ID / EN: Opponent sunken ship IDs
    opponentSunkenShipsDetail: Ship[];              // ZH: 對手沉艦詳細資料 / EN: Opponent sunken ship details
    lastMove: LastMove | null;                      // ZH: 上一步攻擊資訊 / EN: Last move data
    lastSunken: number[];                           // ZH: 最近新增沉艦 ID / EN: Newly sunk ship IDs
    opMatrix: number[][];                           // ZH: 對手棋盤（顯示我方攻擊結果）/ EN: Opponent board (my attacks)
    myMatrix: number[][];                           // ZH: 我方棋盤（顯示對手攻擊結果）/ EN: My board (opponent attacks)

    // ------------- 狀態設定方法 / Mutators -------------
    setOpMatrixCell: (x: number, y: number, v: number) => void; // ZH: 設定對手棋盤一格 / EN: Set a cell on opponent board
    setMyMatrixCell: (x: number, y: number, v: number) => void; // ZH: 設定我方棋盤一格 / EN: Set a cell on my board
    setPlayerId: (id: string) => void;                           // ZH: 設定我方 ID / EN: Set my player ID
    setOpponentId: (id: string) => void;                         // ZH: 設定對手 ID / EN: Set opponent ID
    setMySide: (side: "player1" | "player2") => void;            // ZH: 設定我方陣營 / EN: Set my side
    setOpponentSide: (side: "player1" | "player2") => void;      // ZH: 設定對手陣營 / EN: Set opponent side
    setSunkenShips: (ids: number[]) => void;                     // ZH: 更新我方沉艦 / EN: Update my sunken ships
    setOpponent_SunkenShips: (ids: number[]) => void;            // ZH: 更新對手沉艦 / EN: Update opponent sunken ships
    setOpponentSunkenShipsDetail: (ships: Ship[]) => void;       // ZH: 更新對手沉艦詳情 / EN: Update opponent sunken details
    setLastMove: (lm: LastMove) => void;                         // ZH: 更新最後攻擊 / EN: Update last move
    setLastSunken: (ids: number[]) => void;                      // ZH: 更新最近沉艦 / EN: Update newly sunk IDs

    // ------------- 遊戲行為 / Game Actions -------------
    initializeShips: () => void;                                 // ZH: 從後端初始化船艦 / EN: Init ships from backend
    moveShip: (id: number, row: number, col: number) => void;    // ZH: 移動船艦 / EN: Move a ship
    rotateShip: (id: number) => void;                            // ZH: 旋轉船艦 / EN: Rotate a ship
    showShips: (ships: Ship[]) => number[][];                    // ZH: 轉為棋盤矩陣 / EN: Convert ships to matrix
    connectToServer: () => void;                                 // ZH: 連線 Socket 伺服器 / EN: Connect socket
    joinGame: (isAi: boolean) => void;                           // ZH: 加入對戰（AI/真人）/ EN: Join a match (AI/human)
    makeMove: (x: number, y: number) => void;                    // ZH: 對座標發動攻擊 / EN: Attack a coordinate
}

/* ------------------------------------------------------------
 * 常數與工具 Constants & Utilities
 * ----------------------------------------------------------*/

/** ZH: 棋盤大小（10x10）/ EN: Board size */
const GRID_SIZE = 10;

/**
 * ZH: 建立空的棋盤矩陣（全 0）
 * EN: Create an empty board matrix (all zeros)
 * @returns number[][]
 *
 * 使用 / Usage:
 * const m = emptyMatrix(); // 10x10 zeros
 */
const emptyMatrix = () =>
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

/**
 * ZH: 後端 API 端點，優先讀取環境變數
 * EN: Backend API endpoint (env overrides default)
 */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ------------------------------------------------------------
 * Store 主體 / Store Definition
 * ----------------------------------------------------------*/

export default create<GameState>((set, get) => ({
    /* ---------------- 基本初始值 / Base Defaults --------------- */
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

    /* ---------------- 狀態設定器 / Mutators -------------------- */

    /**
     * ZH: 設定對手棋盤某格的值（2=命中, 3=未中）
     * EN: Set a cell on opponent board (2=hit, 3=miss)
     */
    setOpMatrixCell: (x, y, v) =>
        set((state) => {
            const m = state.opMatrix.map((r) => r.slice());
            m[x][y] = v;
            return { opMatrix: m };
        }),

    /**
     * ZH: 設定我方棋盤某格的值（2=命中, 3=未中）
     * EN: Set a cell on my board (2=hit, 3=miss)
     */
    setMyMatrixCell: (x, y, v) =>
        set((state) => {
            const m = state.myMatrix.map((r) => r.slice());
            m[x][y] = v;
            return { myMatrix: m };
        }),

    /** ZH/EN: Setters for IDs and sides */
    setPlayerId: (id) => set({ playerId: id }),
    setOpponentId: (id) => set({ opponentId: id }),
    setMySide: (side) => set({ mySide: side }),
    setOpponentSide: (side) => set({ opponentSide: side }),
    setSunkenShips: (ids) => set({ sunkenShips: ids }),
    setOpponent_SunkenShips: (ids) => set({ opponent_sunkenShips: ids }),
    setOpponentSunkenShipsDetail: (ships) => set({ opponentSunkenShipsDetail: ships }),
    setLastMove: (lm) => set({ lastMove: lm }),
    setLastSunken: (ids) => set({ lastSunken: ids }),

    /* ---------------- 遊戲行為 / Game Actions ------------------ */

    /**
     * ZH: 向後端請求隨機棋盤，並初始化 ships 與 imageId
     * EN: Fetch random board from backend and initialize ships with imageId
     *
     * 使用 / Usage:
     * await initializeShips();
     */
    initializeShips: async () => {
        const res = await fetch(`${API}/api/generate_board`);
        const data = await res.json();
        const shipsWithImage = data.ships.map((s: Ship) => ({
            ...s,
            // ZH: 例：size=3 並且 id=2 對應 imageId=2，否則用 size
            // EN: Example mapping rule for imageId
            imageId: s.size === 3 && s.id === 2 ? 2 : s.size,
        }));
        set({ ships: shipsWithImage });
    },

    /**
     * ZH: 嘗試將指定船艦移動到 (targetRow, targetCol)，自動校正到最近合法位置
     * EN: Try moving the ship to (targetRow, targetCol) and snap to the nearest valid position
     *
     * 使用 / Usage:
     * moveShip(1, 4, 5);
     */
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
            ships: state.ships.map((s) => (s.id === id ? { ...s, row, col } : s)),
        }));
    },

    /**
     * ZH: 旋轉指定船艦（水平 ↔ 垂直），並校正到最近合法位置
     * EN: Rotate the ship (horizontal ↔ vertical) and snap to the nearest valid position
     *
     * 使用 / Usage:
     * rotateShip(1);
     */
    rotateShip: (id) => {
        const ships = get().ships;
        const ship = ships.find((s) => s.id === id);
        if (!ship) return;
        const newOri = ship.orientation === "horizontal" ? "vertical" : "horizontal";
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
                s.id === id ? { ...s, orientation: newOri, row, col } : s
            ),
        }));
    },

    /**
     * ZH: 將船艦清單轉換為棋盤矩陣（1=有船, 0=空）
     * EN: Convert the ship list into a board matrix (1=ship, 0=empty)
     *
     * 使用 / Usage:
     * const board = showShips(ships);
     */
    showShips: (ships) => {
        const m = emptyMatrix();
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

    /**
     * ZH: 連線至 Socket.IO 伺服器，並綁定各種事件（配對成功、開始、出招、結束）
     * EN: Connect to the Socket.IO server and bind events (match, start, move, game over)
     *
     * 使用 / Usage:
     * connectToServer();
     */
    connectToServer: () => {
        const socket = io(API, { transports: ["websocket"] });
        socket.on("connect", () => set({ socket }));

        // ZH: 加入遊戲後（含 AI/真人），可能需要補查對手資訊
        // EN: After joining, we may fetch opponent info (human mode)
        socket.on("joined_game", async ({ room_id }) => {
            set({ roomId: room_id });

            if (!get().isAiGame) {
                try {
                    const res = await fetch(`${API}/api/opponent`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            room_id,
                            player: get().playerId!,
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
                        opponentId: opponent_id,
                    });
                } catch (e) {
                    console.error("呼叫 /api/opponent 發生錯誤：", e);
                }
            }
        });

        // ZH: 配對完成（真人對戰）
        // EN: Match success (human vs human)
        socket.on("match_success", ({ room_id, player }) => {
            set({
                roomId: room_id,
                mySide: player,
                opponentSide: player === "player1" ? "player2" : "player1",
            });
        });

        // ZH: 遊戲開始，設定先手
        // EN: Game started, set first turn
        socket.on("game_started", ({ first_turn }) =>
            set({ gameStatus: "playing", currentTurn: first_turn })
        );

        // ZH: 有一方出招（含命中與否、沉艦查詢）
        // EN: A move is made (with hit/miss and sunken checks)
        socket.on("move_made", async ({ attacker, x, y, hit }) => {
            const prev = get().sunkenShips;
            set({ lastSunken: [] });
            set({ lastMove: { attacker, x, y, hit } });

            // ZH: 更新棋盤顯示（2=命中, 3=未中）
            // EN: Update matrices (2=hit, 3=miss)
            if (attacker === get().playerId) {
                get().setOpMatrixCell(x, y, hit ? 2 : 3);
            } else {
                get().setMyMatrixCell(x, y, hit ? 2 : 3);
            }

            // ZH: 命中則連續回合；未中則換手
            // EN: Keep the turn on hit; switch turns on miss
            const nextTurn = hit
                ? attacker
                : attacker === get().playerId
                    ? get().opponentId!
                    : get().playerId!;
            set({ currentTurn: nextTurn });

            // ZH: 若命中則查詢沉艦資訊，更新 UI 與狀態
            // EN: If hit, query sunken ships and update states
            if (hit && get().roomId && get().opponentSide) {
                const targetSide = attacker === get().playerId ? get().opponentSide! : get().mySide!;
                try {
                    const res = await fetch(`${API}/api/sunken_ships`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            room_id: get().roomId,
                            player: targetSide,
                        }),
                    });
                    if (res.ok) {
                        const { sunken_ship_ids, sunken_ships } = await res.json();
                        const newIds = sunken_ship_ids.filter((i: number) => !prev.includes(i));
                        if (attacker === get().playerId) {
                            set({
                                opponent_sunkenShips: sunken_ship_ids,
                                opponentSunkenShipsDetail: sunken_ships,
                            });
                        } else {
                            set({
                                sunkenShips: sunken_ship_ids,
                                lastSunken: newIds,
                            });
                        }
                    } else {
                        console.error("Bad /api/sunken_ships：", await res.text());
                    }
                } catch (e) {
                    console.error("沉艦查詢失敗：", e);
                }
            }
        });

        // ZH: 遊戲結束
        // EN: Game over
        socket.on("game_over", () => set({ gameStatus: "finished" }));
    },

    /**
     * ZH: 加入對戰。isAi=true 代表與 AI 對戰；false 代表真人配對。
     * EN: Join a game. isAi=true means AI opponent; false means human matchmaking.
     *
     * 使用 / Usage:
     * joinGame(true);  // AI 對戰 / AI match
     * joinGame(false); // 真人對戰 / Human match
     */
    joinGame: (isAi = false) => {
        const { socket, ships, playerId } = get();
        if (!socket || !playerId) return;

        set({ isAiGame: isAi });
        if (isAi) {
            set({
                opponentId: "AI",
                mySide: "player1",
                opponentSide: "player2",
            });
        } else {
            set({
                opponentId: null,
                mySide: null,
                opponentSide: null,
            });
        }

        // ZH: 將 ships 轉為 0/1 棋盤矩陣，送往後端
        // EN: Convert ships into 0/1 board matrix and send to backend
        const board = emptyMatrix();
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
            is_ai_game: isAi,
        });
    },

    /**
     * ZH: 對（x, y）發動攻擊，需符合「目前輪到我」且已在房間中
     * EN: Attack the coordinate (x, y). Requires it's my turn and I'm in a room.
     *
     * 使用 / Usage:
     * makeMove(2, 7);
     */
    makeMove: (x, y) => {
        const { socket, roomId, playerId, currentTurn } = get();
        if (!socket || !roomId || currentTurn !== playerId) return;
        socket.emit("make_move", { room_id: roomId, player: playerId, x, y });
    },
}));

/* ------------------------------------------------------------
 * 佈局輔助：計算最近合法位置
 * Placement Helper: find the nearest valid position
 * ----------------------------------------------------------*/

/**
 * ZH:
 * 嘗試將船艦放置到「最靠近 targetRow/targetCol 的合法位置」
 * 條件：
 * - 不可超出棋盤邊界
 * - 不可與其他船艦重疊
 * - 以擴張半徑（radius=0..3）在鄰近區域搜尋
 *
 * EN:
 * Try placing a ship at the nearest valid position around (targetRow, targetCol).
 * Constraints:
 * - Must be within the board bounds
 * - Must not overlap with other ships
 * - Search expands by radius (0..3) around the clamped target
 *
 * 回傳 / Returns:
 * { row, col }：最近的合法起始座標
 * The nearest valid starting position
 *
 * 使用 / Usage:
 * const pos = findNearestValidPosition(4, 5, "horizontal", 3, otherShips);
 */
function findNearestValidPosition(
    targetRow: number,
    targetCol: number,
    orientation: "horizontal" | "vertical",
    size: number,
    otherShips: Ship[]
): { row: number; col: number } {
    const max = GRID_SIZE;

    // ZH: 先將目標座標夾在邊界內（考慮長度與方向）
    // EN: Clamp the target within bounds considering length & orientation
    const clampRow = Math.min(
        Math.max(0, targetRow),
        orientation === "vertical" ? max - size : max - 1
    );
    const clampCol = Math.min(
        Math.max(0, targetCol),
        orientation === "horizontal" ? max - size : max - 1
    );

    // ZH: 在半徑 0..3 的鄰域中搜尋可行位置
    // EN: Search a feasible spot within radius 0..3
    for (let radius = 0; radius <= 3; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const r = clampRow + dr;
                const c = clampCol + dc;

                // ZH: 超出範圍或超出邊界者略過
                // EN: Skip invalid or out-of-bounds placements
                if (r < 0 || c < 0) continue;
                if (orientation === "vertical" && r + size > max) continue;
                if (orientation === "horizontal" && c + size > max) continue;

                // ZH: 構造船艦每一格的座標
                // EN: Build all occupied cells for the ship
                const coords = Array.from({ length: size }, (_, i) => ({
                    r: orientation === "vertical" ? r + i : r,
                    c: orientation === "horizontal" ? c + i : c,
                }));

                // ZH: 檢查是否與其他船艦重疊
                // EN: Check overlap with other ships
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

    // ZH: 若找不到更好的，回傳夾限位置
    // EN: Fallback to the clamped target if no better found
    return { row: clampRow, col: clampCol };
}
