// src/components/StatusPanel.tsx

/**
 * ============================================================
 * Naval Chess 狀態面板（React / Tailwind）
 * Naval Chess Status Panel (React / Tailwind)
 * ------------------------------------------------------------
 * ZH:
 * 顯示當前遊戲狀態，包括：
 * - 輪到誰出招
 * - 最後一次攻擊資訊（座標與命中結果）
 * - 最近一次擊沉提示（船艦種類）
 * - 累計已沉艦數
 *
 * EN:
 * Displays current game status including:
 * - Whose turn it is
 * - Last move info (coordinate + hit/miss)
 * - Last sunk ship announcement (ship type)
 * - Total number of sunk ships
 *
 * 使用方式 / Usage:
 * ------------------------------------------------------------
 * <StatusPanel />
 *
 * 相依狀態 / Depends on:
 * - useGameStore(): gameStatus, playerId, currentTurn, lastMove, lastSunken, sunkenShips
 * ============================================================
 */

import React from "react";
import useGameStore from "../store/gameStore";

export default function StatusPanel() {
    const {
        gameStatus,
        playerId,
        currentTurn,
        lastMove,
        lastSunken,
        sunkenShips,
    } = useGameStore();

    // ZH: 遊戲尚未開始時不顯示狀態面板
    // EN: Do not render the status panel before game starts
    if (gameStatus === "waiting") return null;

    // ZH: 判斷是否輪到自己
    // EN: Determine if it's my turn
    const isMyTurn = currentTurn === playerId;
    const turnText = isMyTurn ? "輪到你出招！ / Your turn!" : "對手的回合 / Opponent's turn";

    return (
        <div className="w-full bg-gray-900 text-white p-4 rounded-lg mt-6">
            {/* --------------------------------------------------------
          回合狀態 / Turn status
         -------------------------------------------------------- */}
            <p className="mb-2 font-semibold text-lg">{turnText}</p>

            {/* --------------------------------------------------------
          最後一次攻擊結果 / Last move result
         -------------------------------------------------------- */}
            {lastMove && (
                <p className="mb-2">
                    最後一擊 / Last move：
                    {lastMove.attacker === playerId ? "你 / You" : "對手 / Opponent"} 在
                    ({lastMove.x},{lastMove.y})，
                    {lastMove.hit ? "命中 ✔️ / Hit" : "未命中 ❌ / Miss"}
                </p>
            )}

            {/* --------------------------------------------------------
          最近一次擊沉提示 / Last sunk announcement
         -------------------------------------------------------- */}
            {lastMove && lastSunken.length > 0 && (
                <p className="mb-2">
                    💥{" "}
                    {lastMove.attacker === playerId
                        ? "你擊沉了 / You sunk"
                        : "對手擊沉了 / Opponent sunk"}{" "}
                    {lastSunken
                        .map(
                            (id) =>
                                // ZH: 船艦類型對照表 / EN: Ship type lookup
                                ["海防艦 (Escort)", "驅逐艦 (Destroyer)", "巡洋艦 (Cruiser)", "戰艦 (Battleship)", "航空母艦 (Carrier)"][id]
                        )
                        .join("、")}
                </p>
            )}

            {/* --------------------------------------------------------
          累計已沉艦艇 / Total sunk ships
         -------------------------------------------------------- */}
            <p>
                已沉艦艇 / Total sunk ships：{sunkenShips.length} / 5
            </p>
        </div>
    );
}
