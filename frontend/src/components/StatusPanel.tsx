// src/components/StatusPanel.tsx
"use client";

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

  // 遊戲尚未開始就不顯示
  if (gameStatus === "waiting") return null;

  const isMyTurn = currentTurn === playerId;
  const turnText = isMyTurn ? "輪到你出招！" : "對手的回合";

  return (
    <div className="w-full bg-gray-900 text-white p-4 rounded-lg mt-6">
        {/* 回合狀態 */}
        <p className="mb-2 font-semibold text-lg">{turnText}</p>

        {/* 最後一次攻擊結果 */}
        {lastMove && (
            <p className="mb-2">
            最後一擊：{lastMove.attacker === playerId ? "你" : "對手"} 在
            ({lastMove.x},{lastMove.y})，
            {lastMove.hit ? "命中 ✔️" : "未命中 ❌"}
            </p>
        )}

        { lastMove && lastSunken.length > 0 && (
        <p className="mb-2">
            💥 {lastMove.attacker === playerId ? "你擊沉了" : "對手擊沉了"}{" "}
            {lastSunken.map(id =>
            ["海防艦","驅逐艦","巡洋艦","戰艦","航空母艦"][id]
            ).join("、")}
        </p>
        )}

        {/* 累計已沉艦艇 */}
        <p>已沉艦艇：{sunkenShips.length} / 5</p>
    </div>
  );
}
