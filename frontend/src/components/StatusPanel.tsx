import React from "react";
import useGameStore from "../store/gameStore";
import { SHIP_NAMES } from "@/utils/board";

export default function StatusPanel() {
  const {
    gameStatus,
    playerId,
    currentTurn,
    lastMove,
    lastSunken,
    sunkenShips,
  } = useGameStore();

  if (gameStatus === "waiting") return null;

  const isMyTurn = currentTurn === playerId;
  const turnText = isMyTurn ? "輪到你出招！ / Your turn!" : "對手的回合 / Opponent's turn";

  return (
    <div className="w-full bg-gray-900 text-white p-4 rounded-lg mt-6">
      <p className="mb-2 font-semibold text-lg">{turnText}</p>

      {lastMove && (
        <p className="mb-2">
          最後一擊 / Last move：
          {lastMove.attacker === playerId ? "你 / You" : "對手 / Opponent"} 在
          ({lastMove.x},{lastMove.y})，
          {lastMove.hit ? "命中 ✔️ / Hit" : "未命中 ❌ / Miss"}
        </p>
      )}

      {lastMove && lastSunken.length > 0 && (
        <p className="mb-2">
          💥{" "}
          {lastMove.attacker === playerId
            ? "你擊沉了 / You sunk"
            : "對手擊沉了 / Opponent sunk"}{" "}
          {lastSunken.map((id) => SHIP_NAMES[id]).join("、")}
        </p>
      )}

      <p>
        已沉艦艇 / Total sunk ships：{sunkenShips.length} / 5
      </p>
    </div>
  );
}
