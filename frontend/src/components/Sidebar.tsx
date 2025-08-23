// src/components/Sidebar.tsx

/**
 * ============================================================
 * Naval Chess 側邊欄（React / Framer Motion / Tailwind）
 * Naval Chess Sidebar (React / Framer Motion / Tailwind)
 * ------------------------------------------------------------
 * ZH:
 * - 提供輸入 Player ID、選擇「與玩家對戰 / 與 AI 對戰」、重新整理
 * - 戰鬥中顯示自己的縮略棋盤（含命中/未命中疊圖與沉艦覆蓋）
 *
 * EN:
 * - Lets user input Player ID, choose "Play vs Player / Play vs AI", and refresh
 * - During battle, renders a mini version of the player's board with hit/miss overlays and sunk ships
 *
 * 使用方式 / Usage:
 * ------------------------------------------------------------
 * <Sidebar />
 *
 * 相依狀態 / Depends on:
 * - useGameStore(): gameStatus, ships, matrices, sunkenShips, setPlayerId, joinGame, showShips
 * - public 資源：/hit.png, /no_hit.png, /ships/ship-*.png
 * ============================================================
 */

import React, { useState } from "react";
import useGameStore from "../store/gameStore";
import { motion } from "framer-motion";

export default function Sidebar() {
    // ZH: 從 Zustand 取用需要的狀態與動作
    // EN: Pull required state and actions from Zustand store
    const {
        gameStatus,
        ships,
        showShips,
        myMatrix,        // ZH: 我方棋盤命中/未命中矩陣 / EN: My board hit/miss matrix
        sunkenShips,     // ZH: 已沉艦的 ID 清單 / EN: IDs of ships that have sunk
        setPlayerId,
        joinGame,
    } = useGameStore();

    // ZH: Player ID 的本地輸入值
    // EN: Local input state for Player ID
    const [input, setInput] = useState("");

    /**
     * ZH: 啟動「玩家對玩家」對戰；若未輸入 ID 則自動產生 UUID
     * EN: Start Player-vs-Player; auto-generate UUID if input is empty
     */
    const handlePvP = () => {
        const id = input.trim() || crypto.randomUUID();
        setPlayerId(id);
        joinGame(false); // false => human opponent
    };

    /**
     * ZH: 啟動「玩家對 AI」對戰；若未輸入 ID 則自動產生 UUID
     * EN: Start Player-vs-AI; auto-generate UUID if input is empty
     */
    const handlePvE = () => {
        const id = input.trim() || crypto.randomUUID();
        setPlayerId(id);
        joinGame(true); // true => AI opponent
    };

    return (
        <motion.div
            className="w-full md:w-1/3 flex flex-col gap-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
        >
            {/* ======================================================
          控制區：輸入框 + 按鈕
          Controls: input + action buttons
         ====================================================== */}
            <motion.div
                className="space-y-4"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            >
                {/* ZH: Player ID 輸入；可留空自動產生 / EN: Optional Player ID input */}
                <motion.input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="輸入 Player ID（可留空） / Enter Player ID (optional)"
                    className="w-full p-3 rounded bg-gray-700 text-white placeholder-gray-400"
                    variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                />

                {/* ZH: 與玩家對戰按鈕（等待階段可用）/ EN: PvP (enabled when waiting) */}
                <motion.button
                    onClick={handlePvP}
                    disabled={gameStatus !== "waiting"}
                    className="w-full py-3 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-disabled={gameStatus !== "waiting"}
                >
                    與玩家對戰 / Play vs Player
                </motion.button>

                {/* ZH: 與 AI 對戰按鈕（等待階段可用）/ EN: PvE (enabled when waiting) */}
                <motion.button
                    onClick={handlePvE}
                    disabled={gameStatus !== "waiting"}
                    className="w-full py-3 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-disabled={gameStatus !== "waiting"}
                >
                    與 AI 對戰 / Play vs AI
                </motion.button>

                {/* ZH: 重新整理（快速重置 UI 狀態）/ EN: Hard refresh UI state */}
                <motion.button
                    onClick={() => window.location.reload()}
                    className="w-full py-3 rounded bg-gray-600 hover:bg-gray-700 text-white"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    🔄 重新整理 / Refresh
                </motion.button>
            </motion.div>

            {/* ======================================================
          小棋盤：顯示我的棋盤＋命中/未命中＋沉艦覆蓋（僅在對戰中顯示）
          Mini board: my board + hit/miss + sunk overlays (only during play)
         ====================================================== */}
            {gameStatus === "playing" && (
                <div className="w-full aspect-square bg-gray-800 p-[1px] relative rounded">
                    {/* 10x10 栅格 / 10x10 grid */}
                    <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[1px]">
                        {showShips(ships).map((row, r) =>
                            row.map((cell, c) => {
                                const hasShip = cell === 1;
                                // 0=未打 / 2=命中 / 3=未命中
                                // 0=untouched / 2=hit / 3=miss
                                const hitState = myMatrix[r][c];

                                return (
                                    <div
                                        key={`${r}-${c}`}
                                        className={`relative aspect-square ${hasShip ? "bg-gray-400" : "bg-transparent"
                                            }`}
                                    >
                                        {hitState === 2 && (
                                            <img
                                                src="/hit.png"
                                                alt="hit"
                                                className="absolute inset-0 w-full h-full pointer-events-none"
                                            />
                                        )}
                                        {hitState === 3 && (
                                            <img
                                                src="/no_hit.png"
                                                alt="miss"
                                                className="absolute inset-0 w-full h-full pointer-events-none"
                                            />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ZH: 將所有已沉艦以完整貼圖覆蓋於相對應位置（使用百分比計算） */}
                    {/* EN: Overlay full sprites of all sunk ships at correct positions (percent-based sizing) */}
                    {sunkenShips.map((sid) => {
                        const ship = ships.find((s) => s.id === sid);
                        if (!ship) return null;

                        const { size, row, col, orientation, imageId } = ship;
                        const isSpecial = imageId !== undefined && imageId !== ship.size;
                        const imageUrl = isSpecial
                            ? `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}-${imageId}.png`
                            : `/ships/ship-${size}-${orientation === "horizontal" ? "h" : "v"}.png`;

                        // ZH: 百分比定位（每格 10%）
                        // EN: Percentage positioning (each cell = 10%)
                        const top = `${row * 10}%`;
                        const left = `${col * 10}%`;
                        const width = orientation === "horizontal" ? `${size * 10}%` : `10%`;
                        const height = orientation === "horizontal" ? `10%` : `${size * 10}%`;

                        return (
                            <img
                                key={`sunken-mini-${sid}`}
                                src={imageUrl}
                                alt={`sunken-${sid}`}
                                className="absolute opacity-80 pointer-events-none"
                                style={{ top, left, width, height }}
                            />
                        );
                    })}
                </div>
            )}

            {/* 版本資訊 / Version info */}
            <motion.p
                className="text-sm text-gray-400 mt-auto text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                版本：v1.0 / Version: v1.0
            </motion.p>
        </motion.div>
    );
}
