"use client";

import { useState } from "react";
import Board from "../components/Board";
import useGameStore from "../store/gameStore";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const [playerIdInput, setPlayerIdInput] = useState("");
  const {
    gameStatus,
    ships,
    showShips,
    setPlayerId,
    joinGame,
    socket
  } = useGameStore();

  const handleJoinGame = () => {
    const idToUse = playerIdInput.trim() || uuidv4();
    setPlayerId(idToUse);
    joinGame();
  };

  // 主棋盘：waiting→自己的棋盘；playing→对手的棋盘
  const mainWho = gameStatus === "waiting" ? "player" : "opponent";

  return (
    <main className="flex min-h-screen flex-col lg:flex-row items-start justify-center gap-8 p-6 bg-[url('/bg.jpg')] bg-cover">
      {/* 主棋盘 */}
      <div className="w-full lg:w-[60%] flex justify-center">
        <Board who={mainWho} />
      </div>

      {/* 控制区 & 小棋盘 */}
      <div className="w-full lg:w-[30%] flex flex-col items-center gap-4 mt-6 lg:mt-0 text-white">
        <h2 className="text-2xl font-bold">戰鬥控制區</h2>

        {/* Player ID 输入框 */}
        <input
          type="text"
          className="w-full py-2 px-4 text-black rounded"
          placeholder="輸入 Player ID（可留空）"
          value={playerIdInput}
          onChange={(e) => setPlayerIdInput(e.target.value)}
          disabled={gameStatus !== "waiting"}
        />

        {/* 对战按钮 */}
        <button
          onClick={handleJoinGame}
          className="w-full py-2 bg-green-600 hover:bg-green-700 rounded shadow disabled:opacity-50"
          disabled={gameStatus !== "waiting"}
        >
          與其他玩家對戰
        </button>

        <button
          onClick={() => socket?.emit("start_ai_game")}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded shadow disabled:opacity-50"
          disabled={gameStatus !== "waiting"}
        >
          與 AI 對戰
        </button>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-2 bg-gray-600 hover:bg-gray-700 rounded shadow disabled:opacity-50"
          disabled={gameStatus !== "waiting"}
        >
          🔄 重新整理
        </button>

        {/* 小棋盘：playing 后显示 */}
        {gameStatus === "playing" && (
          <div className="mt-6 w-full text-sm text-white">
            <p className="mb-2 text-center font-semibold">我方佈局</p>
            <div className="grid grid-cols-10 gap-[1px] w-full border border-white bg-gray-800">
              {showShips(ships).map((row, ri) =>
                row.map((cell, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    className={`aspect-square w-full ${
                      cell ? "bg-gray-400" : "bg-transparent"
                    }`}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <p className="text-sm opacity-80 mt-6">目前版本：v1.0</p>
      </div>
    </main>
  );
}
