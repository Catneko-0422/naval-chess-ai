// src/components/Board.tsx

/**
 * ============================================================
 * Naval Chess 棋盤元件（React / Tailwind）
 * Naval Chess Board Component (React / Tailwind)
 * ------------------------------------------------------------
 * ZH:
 * 此元件負責渲染 10x10 棋盤，依據傳入的 `who`（player/opponent）
 * 顯示我方或對手的棋盤。具備以下能力：
 * - 自動計算每格像素大小（隨容器寬度調整）
 * - 我方：等待階段可拖曳/旋轉船艦以排艦
 * - 對手：輪到自己回合時可對尚未攻擊的格子點擊出招
 * - 顯示命中/未中圖示；顯示對手已沉艦的完整外觀
 *
 * EN:
 * This component renders a 10x10 board for either the player or
 * the opponent (via `who`). It:
 * - Auto-computes cell size based on container width
 * - Player board: drag/rotate ships during setup
 * - Opponent board: click to attack when it's your turn
 * - Shows hit/miss icons; overlays sunk opponent ships
 *
 * 使用方式 / Usage:
 * ------------------------------------------------------------
 * <Board who="player" />
 * <Board who="opponent" />
 *
 * 相依狀態 / Depends on:
 * - useGameStore(): ships, matrices, actions (initialize, connect, move, rotate, attack)
 * - public 資源：/hit.png, /no_hit.png, /ships/ship-*.png
 * ============================================================
 */

import React, { useEffect, useRef, useState } from "react";
import useGameStore, { Ship } from "@/store/gameStore";

/* ------------------------------------------------------------
 * 介面定義 / Props
 * ----------------------------------------------------------*/

/**
 * ZH: 指定渲染誰的棋盤（我方或對手）
 * EN: Which board to render (player or opponent)
 */
interface BoardProps {
    who: "player" | "opponent";
}

/* ------------------------------------------------------------
 * 元件定義 / Component
 * ----------------------------------------------------------*/

export default function Board({ who }: BoardProps) {
    // ZH: 由 Zustand 取得狀態與動作
    // EN: Pull state and actions from Zustand store
    const {
        playerId,
        ships,
        opponentSunkenShipsDetail,
        showShips,
        initializeShips,
        connectToServer,
        gameStatus,
        currentTurn,
        moveShip,
        rotateShip,
        makeMove,
        opMatrix,
        myMatrix,
    } = useGameStore();

    // ZH: 控制初始化只跑一次（避免多重呼叫）
    // EN: Run initialization only once
    const inited = useRef(false);

    // ZH: 容器參照，用於動態計算每格像素
    // EN: Container ref for dynamic cell-size calculation
    const containerRef = useRef<HTMLDivElement>(null);

    // ZH: 單一格子的邊長（像素）
    // EN: Pixel size of a single cell
    const [gridSize, setGridSize] = useState(0);

    /* ----------------------------------------------------------
     * 生命週期：初始化與尺寸監聽
     * Lifecycle: init and resize handling
     * --------------------------------------------------------*/
    useEffect(() => {
        if (!inited.current) {
            initializeShips(); // ZH: 從後端取得初始配置 / EN: fetch initial layout
            connectToServer(); // ZH: 啟動 socket 連線 / EN: open socket connection
            inited.current = true;
        }

        // ZH: 根據容器寬度換算每格的像素邊長（保留 9px 邊界避免捲動條）
        // EN: Compute cell size based on container width (keep 9px margin)
        const updateSize = () => {
            if (containerRef.current) {
                const usable = containerRef.current.clientWidth - 9;
                setGridSize(Math.floor(usable / 10));
            }
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, [initializeShips, connectToServer]);

    // ZH: 角色切換：我方棋盤 or 對手棋盤
    // EN: Switch role: player board or opponent board
    const isPlayer = who === "player";

    // ZH: 以 ships 生成 0/1 棋盤（我方船位）
    // EN: Generate 0/1 matrix from ships (player ship layout)
    const matrix = showShips(ships);

    // ZH: 命中資訊矩陣：我方顯示 myMatrix、對手顯示 opMatrix
    // EN: Hit matrix: my board uses myMatrix; opponent board uses opMatrix
    const hits = isPlayer ? myMatrix : opMatrix;

    /* ----------------------------------------------------------
     * Render
     * --------------------------------------------------------*/
    return (
        <div
            ref={containerRef}
            className="w-full max-w-screen-lg overflow-x-auto bg-gray-800 p-[1px] rounded-lg"
        >
            <div
                className="relative"
                style={{ width: gridSize * 10, height: gridSize * 10 }}
            >
                {/* ======================================================
            棋格 Grid cells
            ZH: 10x10 網格；可點擊對手棋盤進行攻擊
            EN: 10x10 grid; clickable on opponent board to attack
           ====================================================== */}
                <div className="grid grid-cols-10 grid-rows-10 absolute top-0 left-0">
                    {matrix.map((row, r) =>
                        row.map((cell, c) => {
                            const showShip = isPlayer && cell === 1;
                            // ZH: hitState: 0=未打 / 2=命中 / 3=未命中
                            // EN: hitState: 0=not attacked / 2=hit / 3=miss
                            const hitState = hits[r][c];

                            // ZH: 僅在「對手棋盤」且「輪到我方」且「尚未攻擊過」時可點擊
                            // EN: Clickable only on opponent board when it's my turn and cell is untouched
                            const canClick =
                                who === "opponent" &&
                                gameStatus === "playing" &&
                                currentTurn === playerId &&
                                hitState === 0;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    className={[
                                        "aspect-square border border-gray-600",
                                        showShip ? "bg-gray-400" : "bg-gray-700",
                                        canClick ? "cursor-pointer" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    style={{ width: gridSize, height: gridSize }}
                                    // ZH: 出招點擊（僅對手棋盤條件允許下）
                                    // EN: Attack on click (only if conditions are met for opponent board)
                                    onClick={() => {
                                        if (canClick) makeMove(r, c);
                                    }}
                                    // ZH: 允許拖放（排艦）
                                    // EN: Allow drag-over for ship placement
                                    onDragOver={(e) => e.preventDefault()}
                                    // ZH: 放下船艦至該格（僅等待階段）
                                    // EN: Drop ship to this cell (waiting phase only)
                                    onDrop={(e) => {
                                        if (isPlayer && gameStatus === "waiting") {
                                            const id = e.dataTransfer.getData("shipId");
                                            if (id) moveShip(Number(id), r, c);
                                        }
                                    }}
                                >
                                    {/* ZH: 顯示命中/未中圖示；以 <img> 疊加 */}
                                    {/* EN: Overlay hit/miss icon images */}
                                    {hitState === 2 && (
                                        <img
                                            src="/images/hits_images/hit.png"
                                            alt="hit"
                                            className="w-full h-full pointer-events-none"
                                        />
                                    )}
                                    {hitState === 3 && (
                                        <img
                                            src="/images/hits_images/no_hit.png"
                                            alt="miss"
                                            className="w-full h-full pointer-events-none"
                                        />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ======================================================
            排艦階段：拖放與旋轉（我方）
            Setup phase: drag & rotate (player board)
            ZH:
             - 拖曳：onDragStart 傳遞 shipId，在格子 onDrop 取得並移動
             - 旋轉：點擊船艦切換水平/垂直
            EN:
             - Drag: onDragStart sets shipId; grid onDrop reads and moves
             - Rotate: click the ship to toggle orientation
           ====================================================== */}
                {isPlayer &&
                    gameStatus === "waiting" &&
                    ships.map((ship: Ship) => {
                        const { id, size, row, col, orientation, imageId } = ship;

                        // ZH: 特殊塗裝（示例：size=3、id=2 使用不同圖）
                        // EN: Special skin example (size=3, id=2 uses a variant)
                        const isSpecial = imageId !== size;
                        const imageUrl = isSpecial
                            ? `ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}-2.png`
                            : `ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}.png`;

                        // ZH: 計算圖示尺寸（依方向沿軸放大）
                        // EN: Compute sprite size along the orientation axis
                        const w = orientation === "horizontal" ? size * gridSize : gridSize;
                        const h = orientation === "horizontal" ? gridSize : size * gridSize;

                        return (
                            <img
                                key={id}
                                src={`/images/${imageUrl}`}
                                alt={`ship-${id}`}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("shipId", id.toString())}
                                onClick={() => rotateShip(id)}
                                className="absolute z-10"
                                style={{
                                    top: row * gridSize,
                                    left: col * gridSize,
                                    width: w,
                                    height: h,
                                    cursor: "pointer",
                                }}
                            />
                        );
                    })}

                {/* ======================================================
            對手棋盤：顯示已沉艦詳圖（回合中）
            Opponent board: render sunk-ship overlays (during play)
            ZH: 由後端回傳的沉艦資訊（包含 row/col/size/orientation）
            EN: Detailed sunk ships from backend (row/col/size/orientation)
           ====================================================== */}
                {!isPlayer &&
                    gameStatus === "playing" &&
                    opponentSunkenShipsDetail.map((ship) => {
                        const { id, size, row, col, orientation, imageId } = ship;
                        const isSpecial = imageId !== size;
                        const imageUrl = isSpecial
                            ? `ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}-2.png`
                            : `ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}.png`;
                        const w = orientation === "horizontal" ? size * gridSize : gridSize;
                        const h = orientation === "horizontal" ? gridSize : size * gridSize;

                        return (
                            <img
                                key={`sunken-detail-${id}`}
                                src={`/images/${imageUrl}`}
                                alt={`sunken-detail-${id}`}
                                className="absolute opacity-80 z-20"
                                style={{
                                    top: row * gridSize,
                                    left: col * gridSize,
                                    width: w,
                                    height: h,
                                }}
                            />
                        );
                    })}
            </div>
        </div>
    );
}
